import { type Kysely, sql } from "kysely";

import { rebuildFtsIndex } from "@/lib/fts";

import type { DB } from "./schema";

const CURRENT_FTS_VERSION = "2";

export async function migrateDatabase(db: Kysely<DB>) {
  await sql`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_filename TEXT NOT NULL,
      stored_filename TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      file_hash TEXT NOT NULL UNIQUE,
      file_size INTEGER NOT NULL,
      page_count INTEGER,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      document_date TEXT,
      content TEXT NOT NULL,
      added_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS processing_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      document_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (document_id) REFERENCES documents(id)
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `.execute(db);

  // Add language column if it doesn't exist (idempotent)
  try {
    await sql`ALTER TABLE documents ADD COLUMN language TEXT NOT NULL DEFAULT 'en'`.execute(
      db,
    );
  } catch {
    // Column already exists, ignore
  }

  // Check FTS schema version and migrate if needed
  const ftsVersionRow = await db
    .selectFrom("schema_meta")
    .select("value")
    .where("key", "=", "fts_version")
    .executeTakeFirst();

  const needsFtsMigration =
    !ftsVersionRow || ftsVersionRow.value !== CURRENT_FTS_VERSION;

  if (needsFtsMigration) {
    console.log(
      "[migrate] upgrading FTS schema to version",
      CURRENT_FTS_VERSION,
    );

    // Drop old triggers
    await sql`DROP TRIGGER IF EXISTS documents_ai`.execute(db);
    await sql`DROP TRIGGER IF EXISTS documents_ad`.execute(db);
    await sql`DROP TRIGGER IF EXISTS documents_au`.execute(db);

    // Drop old FTS table (may be content-synced or not exist yet)
    await sql`DROP TABLE IF EXISTS documents_fts`.execute(db);

    // Create standalone FTS table (no content= sync; managed in application code)
    await sql`
      CREATE VIRTUAL TABLE documents_fts USING fts5(
        title,
        description,
        content,
        original_filename,
        tokenize='unicode61'
      )
    `.execute(db);

    // Rebuild FTS index from all existing documents
    await rebuildFtsIndex(db);

    await db
      .insertInto("schema_meta")
      .values({ key: "fts_version", value: CURRENT_FTS_VERSION })
      .onConflict((oc) =>
        oc.column("key").doUpdateSet({ value: CURRENT_FTS_VERSION }),
      )
      .execute();

    console.log("[migrate] FTS schema upgrade complete");
  }
}

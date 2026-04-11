import { type Kysely, sql } from "kysely";

import type { DB } from "./schema";

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
    CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
      title,
      description,
      content,
      original_filename,
      content='documents',
      content_rowid='id',
      tokenize='porter unicode61'
    )
  `.execute(db);

  await sql`
    CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
      INSERT INTO documents_fts(rowid, title, description, content, original_filename)
      VALUES (new.id, new.title, new.description, new.content, new.original_filename);
    END
  `.execute(db);

  await sql`
    CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, title, description, content, original_filename)
      VALUES ('delete', old.id, old.title, old.description, old.content, old.original_filename);
    END
  `.execute(db);

  await sql`
    CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, title, description, content, original_filename)
      VALUES ('delete', old.id, old.title, old.description, old.content, old.original_filename);
      INSERT INTO documents_fts(rowid, title, description, content, original_filename)
      VALUES (new.id, new.title, new.description, new.content, new.original_filename);
    END
  `.execute(db);
}

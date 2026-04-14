import { type Kysely, sql } from "kysely";

import type { DB } from "./db/schema";
import { stemText } from "./stemming";

interface FtsDoc {
  id: number;
  title: string;
  description: string;
  content: string;
  original_filename: string;
  language: string;
}

export async function insertFtsEntry(db: Kysely<DB>, doc: FtsDoc) {
  await sql`
    INSERT INTO documents_fts(rowid, title, description, content, original_filename)
    VALUES (
      ${doc.id},
      ${stemText(doc.title, doc.language)},
      ${stemText(doc.description, doc.language)},
      ${stemText(doc.content, doc.language)},
      ${doc.original_filename}
    )
  `.execute(db);
}

export async function deleteFtsEntry(db: Kysely<DB>, docId: number) {
  await sql`
    DELETE FROM documents_fts WHERE rowid = ${docId}
  `.execute(db);
}

export async function updateFtsEntry(db: Kysely<DB>, doc: FtsDoc) {
  await deleteFtsEntry(db, doc.id);
  await insertFtsEntry(db, doc);
}

export async function rebuildFtsIndex(db: Kysely<DB>) {
  await sql`DELETE FROM documents_fts`.execute(db);

  const documents = await db
    .selectFrom("documents")
    .select([
      "id",
      "title",
      "description",
      "content",
      "original_filename",
      "language",
    ])
    .execute();

  console.log(`[fts] rebuilding index for ${documents.length} documents`);

  for (const doc of documents) {
    await insertFtsEntry(db, doc);
  }

  console.log("[fts] index rebuild complete");
}

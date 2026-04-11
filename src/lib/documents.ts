import { sql } from "kysely";

import { getDb } from "@/lib/db/connection";

export interface DocumentSummary {
  id: number;
  title: string;
  description: string;
  document_date: string | null;
  added_at: string;
  original_filename: string;
  mime_type: string;
  thumbnail_url: string;
}

export interface SearchResultDocument extends DocumentSummary {
  snippet: string;
}

export interface DocumentDetail extends DocumentSummary {
  stored_filename: string;
  file_size: number;
  page_count: number | null;
  content: string;
  created_at: string;
  updated_at: string;
  download_url: string;
}

export interface PaginatedDocuments<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

function buildThumbnailUrl(id: number) {
  return `/api/documents/${id}/thumbnail`;
}

function buildDownloadUrl(id: number) {
  return `/api/documents/${id}/original`;
}

export async function getDocumentCount() {
  const db = await getDb();
  const result = await db
    .selectFrom("documents")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .executeTakeFirstOrThrow();

  return Number(result.count);
}

export async function listDocuments({
  page,
  limit,
  since,
}: {
  page: number;
  limit: number;
  since?: string | null;
}): Promise<PaginatedDocuments<DocumentSummary>> {
  const db = await getDb();
  const offset = (page - 1) * limit;

  let countQuery = db
    .selectFrom("documents")
    .select((eb) => eb.fn.countAll<number>().as("count"));

  let documentsQuery = db
    .selectFrom("documents")
    .select([
      "id",
      "title",
      "description",
      "document_date",
      "added_at",
      "original_filename",
      "mime_type",
    ])
    .orderBy("added_at", "desc")
    .limit(limit)
    .offset(offset);

  if (since) {
    countQuery = countQuery.where("added_at", ">", since);
    documentsQuery = documentsQuery.where("added_at", ">", since);
  }

  const [countRow, documents] = await Promise.all([
    countQuery.executeTakeFirstOrThrow(),
    documentsQuery.execute(),
  ]);

  return {
    items: documents.map((document) => ({
      ...document,
      thumbnail_url: buildThumbnailUrl(document.id),
    })),
    total: Number(countRow.count),
    page,
    limit,
  };
}

export async function searchDocuments({
  query,
  page,
  limit,
}: {
  query: string;
  page: number;
  limit: number;
}): Promise<PaginatedDocuments<SearchResultDocument>> {
  const db = await getDb();
  const offset = (page - 1) * limit;

  const totalResult = await sql<{ count: number }>`
    SELECT COUNT(*) AS count
    FROM documents_fts
    WHERE documents_fts MATCH ${query}
  `.execute(db);

  const results = await sql<{
    id: number;
    title: string;
    description: string;
    document_date: string | null;
    added_at: string;
    original_filename: string;
    mime_type: string;
    snippet: string;
  }>`
    SELECT
      d.id,
      d.title,
      d.description,
      d.document_date,
      d.added_at,
      d.original_filename,
      d.mime_type,
      snippet(documents_fts, -1, '[[[', ']]]', '...', 18) AS snippet
    FROM documents_fts
    JOIN documents AS d ON d.id = documents_fts.rowid
    WHERE documents_fts MATCH ${query}
    ORDER BY bm25(documents_fts)
    LIMIT ${limit}
    OFFSET ${offset}
  `.execute(db);

  return {
    items: results.rows.map((row) => ({
      ...row,
      thumbnail_url: buildThumbnailUrl(row.id),
    })),
    total: Number(totalResult.rows[0]?.count ?? 0),
    page,
    limit,
  };
}

export async function getDocumentById(
  id: number,
): Promise<DocumentDetail | null> {
  const db = await getDb();
  const document = await db
    .selectFrom("documents")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!document) {
    return null;
  }

  return {
    id: document.id,
    title: document.title,
    description: document.description,
    document_date: document.document_date,
    added_at: document.added_at,
    original_filename: document.original_filename,
    mime_type: document.mime_type,
    thumbnail_url: buildThumbnailUrl(document.id),
    stored_filename: document.stored_filename,
    file_size: document.file_size,
    page_count: document.page_count,
    content: document.content,
    created_at: document.created_at,
    updated_at: document.updated_at,
    download_url: buildDownloadUrl(document.id),
  };
}

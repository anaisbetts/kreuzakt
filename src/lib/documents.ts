import { sql } from "kysely";

import { getDb } from "@/lib/db/connection";
import type { DocumentRow } from "@/lib/db/schema";
import { expandSearchQuery } from "@/lib/query-expansion";

const SEARCH_WEIGHT_BM25 = 1.0;
const SEARCH_WEIGHT_RECENCY = 8.0;
const SEARCH_RECENCY_HALF_LIFE_DAYS = 30;

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

export interface DocumentContent {
  id: number;
  content: string;
}

export interface DocumentDownload {
  id: number;
  original_filename: string;
  mime_type: string;
  file_size: number;
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

function buildDownloadUrl(id: number, baseUrl?: string) {
  const path = `/api/documents/${id}/original`;

  if (!baseUrl) {
    return path;
  }

  return new URL(path, ensureTrailingSlash(baseUrl)).toString();
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function quoteFtsPhrase(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildExpandedMatchQuery(query: string, relatedTerms: string[]) {
  if (relatedTerms.length === 0) {
    return query;
  }

  return [`(${query})`, ...relatedTerms.map(quoteFtsPhrase)].join(" OR ");
}

function uniqueIds(ids: number[]) {
  return [...new Set(ids)];
}

function reorderByRequestedIds<T extends { id: number }>(
  rows: T[],
  requestedIds: number[],
) {
  const byId = new Map(rows.map((row) => [row.id, row]));

  return requestedIds.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

function mapDocumentSummary(
  document: Pick<
    DocumentRow,
    | "id"
    | "title"
    | "description"
    | "document_date"
    | "added_at"
    | "original_filename"
    | "mime_type"
  >,
): DocumentSummary {
  return {
    ...document,
    thumbnail_url: buildThumbnailUrl(document.id),
  };
}

function mapDocumentDetail(
  document: DocumentRow,
  { baseUrl }: { baseUrl?: string } = {},
): DocumentDetail {
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
    download_url: buildDownloadUrl(document.id, baseUrl),
  };
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
    items: documents.map(mapDocumentSummary),
    total: Number(countRow.count),
    page,
    limit,
  };
}

export async function searchDocuments({
  query,
  page,
  limit,
  expandRelatedKeywords = false,
}: {
  query: string;
  page: number;
  limit: number;
  expandRelatedKeywords?: boolean;
}): Promise<PaginatedDocuments<SearchResultDocument>> {
  const db = await getDb();
  const offset = (page - 1) * limit;
  const relatedTerms = expandRelatedKeywords
    ? await expandSearchQuery(query)
    : [];
  const matchQuery = buildExpandedMatchQuery(query, relatedTerms);
  console.log("sqlite fts MATCH query", matchQuery);

  const totalResult = await sql<{ count: number }>`
    SELECT COUNT(*) AS count
    FROM documents_fts
    WHERE documents_fts MATCH ${matchQuery}
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
    WHERE documents_fts MATCH ${matchQuery}
    ORDER BY (
      ${sql.raw(String(SEARCH_WEIGHT_BM25))} * bm25(documents_fts, 10.0, 5.0, 1.0, 3.0)
      - ${sql.raw(String(SEARCH_WEIGHT_RECENCY))} * exp(
        -0.693147
        * COALESCE(julianday('now') - julianday(d.added_at), 9999)
        / ${sql.raw(String(SEARCH_RECENCY_HALF_LIFE_DAYS))}
      )
    )
    LIMIT ${limit}
    OFFSET ${offset}
  `.execute(db);

  return {
    items: results.rows.map((row) => ({
      ...mapDocumentSummary(row),
      snippet: row.snippet,
    })),
    total: Number(totalResult.rows[0]?.count ?? 0),
    page,
    limit,
  };
}

export async function getDocumentById(
  id: number,
  options?: { baseUrl?: string },
): Promise<DocumentDetail | null> {
  const [document] = await getDocumentsByIds([id], options);
  return document ?? null;
}

export async function getDocumentsByIds(
  ids: number[],
  { baseUrl }: { baseUrl?: string } = {},
): Promise<DocumentDetail[]> {
  if (ids.length === 0) {
    return [];
  }

  const db = await getDb();
  const documents = await db
    .selectFrom("documents")
    .selectAll()
    .where("id", "in", uniqueIds(ids))
    .execute();

  return reorderByRequestedIds(
    documents.map((document) => mapDocumentDetail(document, { baseUrl })),
    ids,
  );
}

export async function getDocumentContentsByIds(ids: number[]) {
  if (ids.length === 0) {
    return [];
  }

  const db = await getDb();
  const documents = await db
    .selectFrom("documents")
    .select(["id", "content"])
    .where("id", "in", uniqueIds(ids))
    .execute();

  return reorderByRequestedIds(documents, ids);
}

export async function getDocumentsForDownload(
  ids: number[],
  { baseUrl }: { baseUrl?: string } = {},
): Promise<DocumentDownload[]> {
  if (ids.length === 0) {
    return [];
  }

  const db = await getDb();
  const documents = await db
    .selectFrom("documents")
    .select(["id", "original_filename", "mime_type", "file_size"])
    .where("id", "in", uniqueIds(ids))
    .execute();

  return reorderByRequestedIds(
    documents.map((document) => ({
      ...document,
      download_url: buildDownloadUrl(document.id, baseUrl),
    })),
    ids,
  );
}

/** Removes the document row and FTS entry only; does not delete files under originals/. */
export async function deleteDocumentById(id: number): Promise<boolean> {
  const db = await getDb();

  return await db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom("documents")
      .select("id")
      .where("id", "=", id)
      .executeTakeFirst();

    if (!existing) {
      return false;
    }

    await trx
      .updateTable("processing_queue")
      .set({ document_id: null })
      .where("document_id", "=", id)
      .execute();

    await trx.deleteFrom("documents").where("id", "=", id).execute();

    return true;
  });
}

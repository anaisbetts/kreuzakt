import { sql } from "kysely";

import { getDb } from "@/lib/db/connection";
import type { ProcessingStatus, QueueRow } from "@/lib/db/schema";

export interface QueueCounts {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export async function createQueueEntry(filename: string) {
  const db = await getDb();

  const inserted = await db
    .insertInto("processing_queue")
    .values({
      filename,
      status: "pending",
      error: null,
      document_id: null,
      completed_at: null,
    })
    .returningAll()
    .executeTakeFirst();

  if (inserted) {
    return inserted;
  }

  return getLatestQueueEntryForFilename(filename);
}

export async function getQueueEntryById(id: number) {
  const db = await getDb();

  return db
    .selectFrom("processing_queue")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function getLatestQueueEntryForFilename(filename: string) {
  const db = await getDb();

  return db
    .selectFrom("processing_queue")
    .selectAll()
    .where("filename", "=", filename)
    .orderBy("id", "desc")
    .executeTakeFirst();
}

export async function ensurePendingQueueEntry(filename: string) {
  const existing = await getLatestQueueEntryForFilename(filename);

  if (!existing || existing.status === "completed") {
    return createQueueEntry(filename);
  }

  return updateQueueStatus(existing.id, "pending", {
    error: null,
    documentId: null,
    completedAt: null,
  });
}

export async function updateQueueStatus(
  id: number,
  status: ProcessingStatus,
  options: {
    error?: string | null;
    documentId?: number | null;
    completedAt?: string | null;
  } = {},
) {
  const db = await getDb();

  const completedAt =
    options.completedAt !== undefined
      ? options.completedAt
      : status === "completed" || status === "failed"
        ? new Date().toISOString()
        : null;

  const updated = await db
    .updateTable("processing_queue")
    .set({
      status,
      error: options.error ?? null,
      document_id: options.documentId ?? null,
      completed_at: completedAt,
    })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();

  if (updated) {
    return updated;
  }

  return getQueueEntryById(id);
}

export async function getQueueEntries(options?: {
  limit?: number;
  status?: ProcessingStatus;
}) {
  const db = await getDb();
  const limit = options?.limit ?? 20;

  let query = db
    .selectFrom("processing_queue")
    .selectAll()
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(limit);

  if (options?.status) {
    query = query.where("status", "=", options.status);
  }

  return query.execute();
}

export async function getQueueCounts(): Promise<QueueCounts> {
  const db = await getDb();
  const rows = await db
    .selectFrom("processing_queue")
    .select(["status", (eb) => eb.fn.countAll<number>().as("count")])
    .groupBy("status")
    .execute();

  const counts: QueueCounts = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  for (const row of rows) {
    counts[row.status] = Number(row.count);
  }

  return counts;
}

export async function getPendingEntries() {
  const db = await getDb();

  return db
    .selectFrom("processing_queue")
    .selectAll()
    .where("status", "in", ["pending", "processing", "failed"])
    .where("document_id", "is", null)
    .orderBy("created_at", "asc")
    .orderBy("id", "asc")
    .execute();
}

export async function retryQueueEntry(id: number) {
  const existing = await getQueueEntryById(id);

  if (!existing) {
    return { type: "not_found" as const };
  }

  if (existing.status !== "failed") {
    return { type: "invalid_status" as const, entry: existing };
  }

  const updated = await updateQueueStatus(id, "pending", {
    error: null,
    documentId: null,
    completedAt: null,
  });

  return { type: "ok" as const, entry: updated ?? existing };
}

export async function markDuplicateQueueEntry(
  id: number,
  duplicateDocumentId: number,
) {
  return updateQueueStatus(id, "completed", {
    documentId: duplicateDocumentId,
    error: null,
  });
}

export async function getQueueStatsSummary() {
  const db = await getDb();
  return sql<QueueRow>`
    SELECT *
    FROM processing_queue
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `.execute(db);
}

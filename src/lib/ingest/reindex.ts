import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/db/connection";
import type { ProcessingStatus, QueueRow } from "@/lib/db/schema";
import {
  DocumentOriginalNotFoundError,
  rescanDocumentById,
} from "@/lib/documents";

import { enqueueSerialIngestWork } from "./job-runner";
import { createDocumentQueueEntry, updateQueueStatus } from "./queue";

const REINDEX_QUEUE_PREFIX = "reindex-all:";

export interface ReindexAllStatus {
  batchId: string | null;
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  processed: number;
  active: boolean;
  percentComplete: number;
}

interface ReindexQueuePayload {
  batchId: string;
  documentId: number;
  originalFilename: string;
}

export async function queueReindexAllDocuments() {
  const activeStatus = await getLatestReindexAllStatus();

  if (activeStatus.active) {
    return {
      type: "already_running" as const,
      status: activeStatus,
    };
  }

  const db = await getDb();
  const documents = await db
    .selectFrom("documents")
    .select(["id", "original_filename"])
    .orderBy("id", "asc")
    .execute();
  const batchId = randomUUID();

  for (const document of documents) {
    const entry = await createDocumentQueueEntry(
      buildReindexQueueFilename({
        batchId,
        documentId: document.id,
        originalFilename: document.original_filename,
      }),
      document.id,
    );
    enqueueReindexQueueEntry(entry);
  }

  return {
    type: "queued" as const,
    status: await getReindexAllStatusForBatch(batchId),
  };
}

export async function getLatestReindexAllStatus(): Promise<ReindexAllStatus> {
  const db = await getDb();
  const latest = await db
    .selectFrom("processing_queue")
    .select("filename")
    .where("filename", "like", `${REINDEX_QUEUE_PREFIX}%`)
    .orderBy("id", "desc")
    .executeTakeFirst();
  const batchId = latest
    ? parseReindexQueueFilename(latest.filename)?.batchId
    : null;

  if (!batchId) {
    return emptyReindexStatus();
  }

  return getReindexAllStatusForBatch(batchId);
}

export function enqueueReindexQueueEntry(entry: QueueRow) {
  const payload = parseReindexQueueFilename(entry.filename);
  const documentId = payload?.documentId ?? entry.document_id;

  if (!documentId) {
    void updateQueueStatus(entry.id, "failed", {
      error: "Reindex queue entry is missing its document id",
      documentId: null,
    });
    return;
  }

  void enqueueSerialIngestWork(`reindex:${documentId}`, async () => {
    await updateQueueStatus(entry.id, "processing", {
      error: null,
      documentId,
      completedAt: null,
    });

    try {
      const document = await rescanDocumentById(documentId);

      if (!document) {
        await updateQueueStatus(entry.id, "failed", {
          error: `Document ${documentId} not found`,
          documentId,
        });
        return null;
      }

      await updateQueueStatus(entry.id, "completed", {
        error: null,
        documentId,
      });
      return document;
    } catch (error) {
      const message =
        error instanceof DocumentOriginalNotFoundError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Document reindex failed";

      await updateQueueStatus(entry.id, "failed", {
        error: message,
        documentId,
      });
      throw error;
    }
  });
}

export async function resumePendingReindexQueue() {
  const db = await getDb();
  const entries = await db
    .selectFrom("processing_queue")
    .selectAll()
    .where("filename", "like", `${REINDEX_QUEUE_PREFIX}%`)
    .where("status", "in", ["pending", "processing"])
    .orderBy("created_at", "asc")
    .orderBy("id", "asc")
    .execute();

  for (const entry of entries) {
    await updateQueueStatus(entry.id, "pending", {
      error: null,
      documentId: entry.document_id,
      completedAt: null,
    });
    enqueueReindexQueueEntry(entry);
  }
}

export function isReindexQueueEntry(entry: QueueRow) {
  return entry.filename.startsWith(REINDEX_QUEUE_PREFIX);
}

async function getReindexAllStatusForBatch(
  batchId: string,
): Promise<ReindexAllStatus> {
  const db = await getDb();
  const rows = await db
    .selectFrom("processing_queue")
    .select(["status", (eb) => eb.fn.countAll<number>().as("count")])
    .where("filename", "like", buildReindexBatchLike(batchId))
    .groupBy("status")
    .execute();

  return summarizeReindexAllStatus(batchId, rows);
}

export function summarizeReindexAllStatus(
  batchId: string | null,
  rows: Array<{ status: ProcessingStatus; count: number | string }>,
): ReindexAllStatus {
  const counts = countStatuses(rows);
  const total =
    counts.pending + counts.processing + counts.completed + counts.failed;
  const processed = counts.completed + counts.failed;

  return {
    batchId,
    total,
    ...counts,
    processed,
    active: counts.pending + counts.processing > 0,
    percentComplete: total > 0 ? Math.round((processed / total) * 100) : 100,
  };
}

function buildReindexQueueFilename(payload: ReindexQueuePayload) {
  return `${REINDEX_QUEUE_PREFIX}${payload.batchId}:${payload.documentId}:${payload.originalFilename}`;
}

function parseReindexQueueFilename(
  filename: string,
): ReindexQueuePayload | null {
  if (!filename.startsWith(REINDEX_QUEUE_PREFIX)) {
    return null;
  }

  const remainder = filename.slice(REINDEX_QUEUE_PREFIX.length);
  const [batchId, rawDocumentId, ...filenameParts] = remainder.split(":");
  const documentId = Number.parseInt(rawDocumentId ?? "", 10);

  if (!batchId || !Number.isFinite(documentId) || filenameParts.length === 0) {
    return null;
  }

  return {
    batchId,
    documentId,
    originalFilename: filenameParts.join(":"),
  };
}

function buildReindexBatchLike(batchId: string) {
  return `${REINDEX_QUEUE_PREFIX}${batchId}:%`;
}

function countStatuses(
  rows: Array<{ status: ProcessingStatus; count: number | string }>,
) {
  const counts = {
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

function emptyReindexStatus(): ReindexAllStatus {
  return {
    batchId: null,
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    processed: 0,
    active: false,
    percentComplete: 100,
  };
}

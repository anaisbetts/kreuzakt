import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let tempDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kreuzakt-reindex-"));
  process.env.DATA_DIR = tempDir;
});

afterAll(async () => {
  await rm(tempDir, { force: true, recursive: true });
});

describe("reindex queue status", () => {
  it("counts the latest reindex batch progress", async () => {
    const { getDb } = await import("@/lib/db/connection");
    const { getLatestReindexAllStatus } = await import("./reindex");
    const db = await getDb();
    const documentId = await insertDocument(db);

    await db
      .insertInto("processing_queue")
      .values([
        {
          filename: `reindex-all:batch-a:${documentId}:one.pdf`,
          status: "completed",
          error: null,
          document_id: documentId,
          completed_at: new Date().toISOString(),
        },
        {
          filename: `reindex-all:batch-a:${documentId}:two.pdf`,
          status: "pending",
          error: null,
          document_id: documentId,
          completed_at: null,
        },
        {
          filename: `reindex-all:batch-a:${documentId}:three.pdf`,
          status: "failed",
          error: "boom",
          document_id: documentId,
          completed_at: new Date().toISOString(),
        },
      ])
      .execute();

    const status = await getLatestReindexAllStatus();

    expect(status).toMatchObject({
      batchId: "batch-a",
      total: 3,
      pending: 1,
      processing: 0,
      completed: 1,
      failed: 1,
      processed: 2,
      active: true,
      percentComplete: 67,
    });
  });
});

describe("retryQueueEntry", () => {
  it("preserves the document id on failed reindex jobs", async () => {
    const { getDb } = await import("@/lib/db/connection");
    const { retryQueueEntry } = await import("./queue");
    const db = await getDb();
    const documentId = await insertDocument(db, "retry");
    const failed = await db
      .insertInto("processing_queue")
      .values({
        filename: `reindex-all:batch-b:${documentId}:retry.pdf`,
        status: "failed",
        error: "boom",
        document_id: documentId,
        completed_at: new Date().toISOString(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const result = await retryQueueEntry(failed.id);

    expect(result.type).toBe("ok");
    if (result.type !== "ok") {
      return;
    }
    expect(result.entry.document_id).toBe(documentId);
    expect(result.entry.status).toBe("pending");
    expect(result.entry.completed_at).toBeNull();
  });
});

async function insertDocument(
  db: Awaited<ReturnType<typeof import("@/lib/db/connection").getDb>>,
  suffix = "status",
) {
  const inserted = await db
    .insertInto("documents")
    .values({
      original_filename: `${suffix}.pdf`,
      stored_filename: `${suffix}.pdf`,
      mime_type: "application/pdf",
      file_hash: `hash-${suffix}`,
      file_size: 123,
      page_count: 1,
      title: "Original",
      description: "Original description",
      document_date: null,
      content: "Original content",
      language: "en",
      added_at: "2025-01-02T03:04:05.000Z",
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  return inserted.id;
}

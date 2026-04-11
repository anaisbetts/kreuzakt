import { rm, stat, unlink } from "node:fs/promises";
import path from "node:path";

import { getDb } from "@/lib/db/connection";
import {
  buildStoredFilename,
  computeFileHash,
  copyOriginalToArchive,
  findDuplicateDocumentId,
  getOriginalFilePath,
  getThumbnailPath,
} from "@/lib/files";

import { extractDocument } from "./extract";
import { generateDocumentMetadata } from "./metadata";
import { markDuplicateQueueEntry, updateQueueStatus } from "./queue";
import { generateThumbnail } from "./thumbnail";

export interface ProcessFileResult {
  kind: "completed" | "duplicate";
  documentId: number;
}

async function cleanupFailedArtifacts(
  documentId: number,
  storedFilename: string,
) {
  await Promise.allSettled([
    rm(getOriginalFilePath(storedFilename), { force: true }),
    rm(getThumbnailPath(documentId), { force: true }),
  ]);
}

export async function processIngestFile(
  filePath: string,
  queueEntryId: number,
): Promise<ProcessFileResult> {
  let insertedDocumentId: number | null = null;
  let storedFilename: string | null = null;

  try {
    await updateQueueStatus(queueEntryId, "processing", {
      error: null,
      documentId: null,
      completedAt: null,
    });

    const fileHash = await computeFileHash(filePath);
    const duplicateDocumentId = await findDuplicateDocumentId(fileHash);

    if (duplicateDocumentId) {
      await unlink(filePath);
      await markDuplicateQueueEntry(queueEntryId, duplicateDocumentId);

      return {
        kind: "duplicate",
        documentId: duplicateDocumentId,
      };
    }

    const originalFilename = path.basename(filePath);
    const fileStats = await stat(filePath);
    const extracted = await extractDocument(filePath);
    const metadata = await generateDocumentMetadata(
      extracted.content,
      originalFilename,
    );

    storedFilename = buildStoredFilename(fileHash, originalFilename);

    const db = await getDb();
    const inserted = await db
      .insertInto("documents")
      .values({
        original_filename: originalFilename,
        stored_filename: storedFilename,
        mime_type: extracted.mimeType,
        file_hash: fileHash,
        file_size: fileStats.size,
        page_count: extracted.pageCount,
        title: metadata.title,
        description: metadata.description,
        document_date: metadata.document_date,
        content: extracted.content,
        added_at: new Date().toISOString(),
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    insertedDocumentId = inserted.id;

    await copyOriginalToArchive(filePath, originalFilename, fileHash);
    await unlink(filePath);
    await generateThumbnail(
      getOriginalFilePath(storedFilename),
      extracted.mimeType,
      insertedDocumentId,
    );

    await updateQueueStatus(queueEntryId, "completed", {
      documentId: insertedDocumentId,
      error: null,
    });

    return {
      kind: "completed",
      documentId: insertedDocumentId,
    };
  } catch (error) {
    if (insertedDocumentId != null) {
      const db = await getDb();
      await db
        .deleteFrom("documents")
        .where("id", "=", insertedDocumentId)
        .execute();
    }

    if (insertedDocumentId != null && storedFilename) {
      await cleanupFailedArtifacts(insertedDocumentId, storedFilename);
    }

    const message =
      error instanceof Error ? error.message : "Document processing failed";

    await updateQueueStatus(queueEntryId, "failed", {
      error: message,
      documentId: null,
    });

    throw error;
  }
}

import { rm, stat, unlink } from "node:fs/promises";
import path from "node:path";

import { getDb } from "@/lib/db/connection";
import {
  buildStoredFilename,
  computeFileHash,
  copyOriginalToArchive,
  findDuplicateDocumentId,
  getDocumentThumbnailDir,
  getOriginalFilePath,
} from "@/lib/files";
import { deleteFtsEntry, insertFtsEntry } from "@/lib/fts";
import { extractDocument } from "./extract";
import { generateDocumentMetadata } from "./metadata";
import { isDuplicateFileHashConstraintError } from "./pipeline-errors";
import { markDuplicateQueueEntry, updateQueueStatus } from "./queue";
import { generateThumbnail } from "./thumbnail";

export interface ProcessFileResult {
  kind: "completed" | "duplicate";
  documentId: number;
}

export interface ProcessIngestOptions {
  addedAt?: string;
}

async function cleanupFailedArtifacts(
  documentId: number,
  storedFilename: string,
) {
  await Promise.allSettled([
    rm(getOriginalFilePath(storedFilename), { force: true }),
    rm(getDocumentThumbnailDir(documentId), { recursive: true, force: true }),
  ]);
}

export async function processIngestFile(
  filePath: string,
  queueEntryId: number,
  options?: ProcessIngestOptions,
): Promise<ProcessFileResult> {
  let insertedDocumentId: number | null = null;
  let ftsInserted = false;
  let fileHash: string | null = null;
  let storedFilename: string | null = null;

  try {
    await updateQueueStatus(queueEntryId, "processing", {
      error: null,
      documentId: null,
      completedAt: null,
    });

    fileHash = await computeFileHash(filePath);
    const duplicateDocumentId = await findDuplicateDocumentId(fileHash);

    if (duplicateDocumentId) {
      await rm(filePath, { force: true });
      await markDuplicateQueueEntry(queueEntryId, duplicateDocumentId);

      return {
        kind: "duplicate",
        documentId: duplicateDocumentId,
      };
    }

    const originalFilename = path.basename(filePath);
    const fileStats = await stat(filePath);
    const extracted = await extractDocument(filePath);

    console.log("[ingest] generating title/description metadata", {
      queueEntryId,
      originalFilename,
      extractedContentChars: extracted.content.length,
    });

    const metadata = await generateDocumentMetadata(
      extracted.content,
      originalFilename,
    );

    console.log("[ingest] metadata ready for insert", {
      queueEntryId,
      originalFilename,
      titleLength: metadata.title.length,
      descriptionLength: metadata.description.length,
      document_date: metadata.document_date,
    });

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
        language: metadata.language,
        added_at: options?.addedAt ?? new Date().toISOString(),
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    insertedDocumentId = inserted.id;

    await insertFtsEntry(db, {
      id: insertedDocumentId,
      title: metadata.title,
      description: metadata.description,
      content: extracted.content,
      original_filename: originalFilename,
      language: metadata.language,
    });
    ftsInserted = true;

    await copyOriginalToArchive(filePath, originalFilename, fileHash);
    await unlink(filePath);
    await generateThumbnail(
      getOriginalFilePath(storedFilename),
      extracted.mimeType,
      insertedDocumentId,
      extracted.pageCount,
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
    if (
      insertedDocumentId == null &&
      fileHash &&
      isDuplicateFileHashConstraintError(error)
    ) {
      const duplicateDocumentId = await findDuplicateDocumentId(fileHash);

      if (duplicateDocumentId) {
        await rm(filePath, { force: true });
        await markDuplicateQueueEntry(queueEntryId, duplicateDocumentId);

        return {
          kind: "duplicate",
          documentId: duplicateDocumentId,
        };
      }
    }

    if (insertedDocumentId != null) {
      const db = await getDb();
      if (ftsInserted) {
        await deleteFtsEntry(db, insertedDocumentId);
      }
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

import { createQueueEntry } from "@/lib/ingest/queue";
import { enqueueImportedFile } from "@/lib/ingest/watcher";

import { PaperlessClient } from "./paperless";

export type PaperlessImportEvent =
  | {
      type: "started";
      total: number;
    }
  | {
      type: "progress";
      current: number;
      total: number;
      filename: string;
      message?: string;
      status: "completed" | "duplicate" | "failed";
    }
  | {
      type: "complete";
      total: number;
      imported: number;
      duplicates: number;
      failed: number;
    };

export interface PaperlessImportSummary {
  total: number;
  imported: number;
  duplicates: number;
  failed: number;
}

export async function importFromPaperless(options: {
  paperlessUrl: string;
  apiKey: string;
  maxDocuments?: number;
  signal?: AbortSignal;
  onEvent?: (event: PaperlessImportEvent) => Promise<void> | void;
}) {
  const client = new PaperlessClient({
    apiKey: options.apiKey,
    baseUrl: options.paperlessUrl,
    signal: options.signal,
  });
  const documents = await client.listAllDocuments({
    maxDocuments: options.maxDocuments,
  });
  const summary: PaperlessImportSummary = {
    total: documents.length,
    imported: 0,
    duplicates: 0,
    failed: 0,
  };

  await emitEvent(options.onEvent, {
    type: "started",
    total: documents.length,
  });

  for (const [index, document] of documents.entries()) {
    options.signal?.throwIfAborted();

    try {
      const downloaded = await client.downloadOriginal(document);
      const queueEntry = await createQueueEntry(downloaded.relativePath);

      if (!queueEntry) {
        throw new Error(
          `Failed to create a queue entry for ${document.originalFilename}`,
        );
      }

      const result = await enqueueImportedFile(
        downloaded.relativePath,
        queueEntry.id,
        {
          addedAt: document.addedAt,
        },
      );
      const status =
        result && result.kind === "duplicate"
          ? "duplicate"
          : result && result.kind === "completed"
            ? "completed"
            : "failed";

      if (status === "completed") {
        summary.imported += 1;
      } else if (status === "duplicate") {
        summary.duplicates += 1;
      } else {
        summary.failed += 1;
      }

      await emitEvent(options.onEvent, {
        type: "progress",
        current: index + 1,
        total: documents.length,
        filename: document.originalFilename,
        status,
        message:
          status === "failed"
            ? `Failed to process ${document.originalFilename}`
            : undefined,
      });
    } catch (error) {
      summary.failed += 1;

      await emitEvent(options.onEvent, {
        type: "progress",
        current: index + 1,
        total: documents.length,
        filename: document.originalFilename,
        status: "failed",
        message:
          error instanceof Error ? error.message : "Paperless import failed",
      });
    }
  }

  await emitEvent(options.onEvent, {
    type: "complete",
    ...summary,
  });

  return summary;
}

async function emitEvent(
  onEvent: ((event: PaperlessImportEvent) => Promise<void> | void) | undefined,
  event: PaperlessImportEvent,
) {
  await onEvent?.(event);
}

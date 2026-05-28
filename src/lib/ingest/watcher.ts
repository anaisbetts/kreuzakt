import path from "node:path";

import { type FSWatcher, watch } from "chokidar";

import { appConfig } from "@/lib/config";
import { ensureAppDirectories, fileExists } from "@/lib/files";

import { enqueueSerialIngestWork } from "./job-runner";
import { type ProcessIngestOptions, processIngestFile } from "./pipeline";
import { ensurePendingQueueEntry, updateQueueStatus } from "./queue";

const PAPERLESS_IMPORT_QUEUE_PREFIX = "paperless-ngx/";

declare global {
  var __docsAiIngestWatcher: FSWatcher | undefined;
}

export async function startWatcher() {
  await ensureAppDirectories();

  if (globalThis.__docsAiIngestWatcher) {
    return globalThis.__docsAiIngestWatcher;
  }

  const watcher = watch(appConfig.ingestDir, {
    persistent: true,
    ignoreInitial: false,
    usePolling: appConfig.ingestWatchPoll,
    interval: appConfig.ingestWatchPollIntervalMs,
    binaryInterval: appConfig.ingestWatchPollIntervalMs,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
    ignored: (watchedPath) => path.basename(watchedPath).startsWith("."),
  });

  watcher.on("add", (filePath) => {
    void handleAddedFile(filePath);
  });

  watcher.on("error", (error) => {
    console.error("ingest watcher failed", error);
  });

  globalThis.__docsAiIngestWatcher = watcher;
  return watcher;
}

export async function enqueueQueuedFile(
  relativePath: string,
  queueEntryId: number,
) {
  const absolutePath = toAbsoluteQueueFilePath(relativePath);

  if (!(await fileExists(absolutePath))) {
    await updateQueueStatus(queueEntryId, "failed", {
      error: `File ${relativePath} no longer exists`,
      documentId: null,
    });
    return false;
  }

  scheduleProcessing(absolutePath, queueEntryId);
  return true;
}

export async function enqueueImportedFile(
  absolutePath: string,
  queueEntryId: number,
  options: ProcessIngestOptions,
) {
  if (!(await fileExists(absolutePath))) {
    await updateQueueStatus(queueEntryId, "failed", {
      error: `Import file no longer exists: ${absolutePath}`,
      documentId: null,
    });
    return null;
  }

  return scheduleProcessing(absolutePath, queueEntryId, options);
}

export async function stopWatcher() {
  if (!globalThis.__docsAiIngestWatcher) {
    return;
  }

  await globalThis.__docsAiIngestWatcher.close();
  globalThis.__docsAiIngestWatcher = undefined;
}

async function handleAddedFile(filePath: string) {
  const normalizedPath = path.resolve(filePath);

  if (!(await fileExists(normalizedPath))) {
    return;
  }

  const relativePath = toIngestRelativePath(normalizedPath);
  const queueEntry = await ensurePendingQueueEntry(relativePath);

  if (!queueEntry) {
    return;
  }

  scheduleProcessing(normalizedPath, queueEntry.id);
}

function scheduleProcessing(
  filePath: string,
  queueEntryId: number,
  options?: ProcessIngestOptions,
) {
  const normalizedPath = path.resolve(filePath);

  return enqueueSerialIngestWork(normalizedPath, async () => {
    if (!(await fileExists(normalizedPath))) {
      await updateQueueStatus(queueEntryId, "failed", {
        error: "File disappeared before processing could start",
        documentId: null,
      });
      return null;
    }

    return processIngestFile(normalizedPath, queueEntryId, options);
  });
}

function toIngestRelativePath(filePath: string) {
  return path.relative(appConfig.ingestDir, filePath).split(path.sep).join("/");
}

function toAbsoluteIngestPath(relativePath: string) {
  return path.join(appConfig.ingestDir, relativePath);
}

function toAbsoluteQueueFilePath(relativePath: string) {
  if (relativePath.startsWith(PAPERLESS_IMPORT_QUEUE_PREFIX)) {
    return path.join(appConfig.importDir, relativePath);
  }
  return toAbsoluteIngestPath(relativePath);
}

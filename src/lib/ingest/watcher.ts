import path from "node:path";

import { type FSWatcher, watch } from "chokidar";

import { appConfig } from "@/lib/config";
import { ensureAppDirectories, fileExists } from "@/lib/files";

import { type ProcessIngestOptions, processIngestFile } from "./pipeline";
import { ensurePendingQueueEntry, updateQueueStatus } from "./queue";

declare global {
  var __docsAiIngestWatcher: FSWatcher | undefined;
}

let processingChain = Promise.resolve();
const scheduledPaths = new Set<string>();

function toIngestRelativePath(filePath: string) {
  return path.relative(appConfig.ingestDir, filePath).split(path.sep).join("/");
}

function toAbsoluteIngestPath(relativePath: string) {
  return path.join(appConfig.ingestDir, relativePath);
}

function scheduleProcessing(
  filePath: string,
  queueEntryId: number,
  options?: ProcessIngestOptions,
) {
  const normalizedPath = path.resolve(filePath);

  if (scheduledPaths.has(normalizedPath)) {
    return Promise.resolve(null);
  }

  scheduledPaths.add(normalizedPath);
  let result: Awaited<ReturnType<typeof processIngestFile>> | null = null;

  processingChain = processingChain.then(async () => {
    try {
      if (!(await fileExists(normalizedPath))) {
        await updateQueueStatus(queueEntryId, "failed", {
          error: "File disappeared before processing could start",
          documentId: null,
        });
        return;
      }

      result = await processIngestFile(normalizedPath, queueEntryId, options);
    } catch (error) {
      console.error("ingest pipeline failed", error);
    } finally {
      scheduledPaths.delete(normalizedPath);
    }
  });

  return processingChain.then(() => result);
}

async function handleAddedFile(filePath: string) {
  const normalizedPath = path.resolve(filePath);

  if (scheduledPaths.has(normalizedPath)) {
    return;
  }

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

export async function enqueueQueuedFile(
  relativePath: string,
  queueEntryId: number,
) {
  const absolutePath = toAbsoluteIngestPath(relativePath);

  if (!(await fileExists(absolutePath))) {
    await updateQueueStatus(queueEntryId, "failed", {
      error: `File ${relativePath} no longer exists in ingest/`,
      documentId: null,
    });
    return false;
  }

  scheduleProcessing(absolutePath, queueEntryId);
  return true;
}

export async function enqueueImportedFile(
  relativePath: string,
  queueEntryId: number,
  options: ProcessIngestOptions,
) {
  const absolutePath = toAbsoluteIngestPath(relativePath);

  if (!(await fileExists(absolutePath))) {
    await updateQueueStatus(queueEntryId, "failed", {
      error: `File ${relativePath} no longer exists in ingest/`,
      documentId: null,
    });
    return null;
  }

  return scheduleProcessing(absolutePath, queueEntryId, options);
}

export async function startWatcher() {
  await ensureAppDirectories();

  if (globalThis.__docsAiIngestWatcher) {
    return globalThis.__docsAiIngestWatcher;
  }

  const watcher = watch(appConfig.ingestDir, {
    persistent: true,
    ignoreInitial: false,
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

export async function stopWatcher() {
  if (!globalThis.__docsAiIngestWatcher) {
    return;
  }

  await globalThis.__docsAiIngestWatcher.close();
  globalThis.__docsAiIngestWatcher = undefined;
}

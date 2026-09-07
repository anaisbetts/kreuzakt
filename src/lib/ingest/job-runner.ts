type IngestJobRunnerState = {
  processingChain: Promise<void>;
  scheduledKeys: Set<string>;
};

// Next.js bundles instrumentation (which starts the ingest watcher) and API
// routes separately, so this module can be instantiated more than once per
// process. Module-level state would give each bundle its own serial chain and
// dedup set, letting the watcher and the upload route process the same file
// concurrently. Keeping the state on globalThis makes it process-wide.
declare global {
  var __docsAiIngestJobRunner: IngestJobRunnerState | undefined;
}

export function enqueueSerialIngestWork<T>(
  key: string,
  work: () => Promise<T>,
): Promise<T | null> {
  const state = getJobRunnerState();

  if (state.scheduledKeys.has(key)) {
    return Promise.resolve(null);
  }

  state.scheduledKeys.add(key);
  let result: T | null = null;

  state.processingChain = state.processingChain.then(async () => {
    try {
      result = await work();
    } catch (error) {
      console.error("queued ingest work failed", error);
    } finally {
      state.scheduledKeys.delete(key);
    }
  });

  return state.processingChain.then(() => result);
}

export function isIngestWorkScheduled(key: string) {
  return getJobRunnerState().scheduledKeys.has(key);
}

function getJobRunnerState(): IngestJobRunnerState {
  globalThis.__docsAiIngestJobRunner ??= {
    processingChain: Promise.resolve(),
    scheduledKeys: new Set<string>(),
  };
  return globalThis.__docsAiIngestJobRunner;
}

let processingChain = Promise.resolve();

const scheduledKeys = new Set<string>();

export function enqueueSerialIngestWork<T>(
  key: string,
  work: () => Promise<T>,
): Promise<T | null> {
  if (scheduledKeys.has(key)) {
    return Promise.resolve(null);
  }

  scheduledKeys.add(key);
  let result: T | null = null;

  processingChain = processingChain.then(async () => {
    try {
      result = await work();
    } catch (error) {
      console.error("queued ingest work failed", error);
    } finally {
      scheduledKeys.delete(key);
    }
  });

  return processingChain.then(() => result);
}

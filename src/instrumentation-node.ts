import { ensureAppDirectories } from "@/lib/files";
import { startWatcher } from "@/lib/ingest/watcher";

declare global {
  var __docsAiInstrumentationStarted: boolean | undefined;
}

if (!globalThis.__docsAiInstrumentationStarted) {
  globalThis.__docsAiInstrumentationStarted = true;

  void (async () => {
    await ensureAppDirectories();
    await startWatcher();
  })();
}

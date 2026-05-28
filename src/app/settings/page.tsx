import { SystemStatusPage } from "@/components/SystemStatusPage";
import { appConfig } from "@/lib/config";
import { getDocumentCount } from "@/lib/documents";
import { ensureAppDirectories, fileExists } from "@/lib/files";
import { getQueueCounts, getQueueEntries } from "@/lib/ingest/queue";
import { getLatestReindexAllStatus } from "@/lib/ingest/reindex";
import { getPreferredLanguage } from "@/lib/settings";

export default async function SettingsPage() {
  const status = await loadStatus();

  return (
    <SystemStatusPage
      documentCount={status.documents}
      originalsDisplay={
        status.originalsDir ? appConfig.originalsDir : "Missing"
      }
      ingestDisplay={status.ingestDir ? appConfig.ingestDir : "Missing"}
      ocrModel={appConfig.ocrModel}
      metadataModel={appConfig.metadataModel}
      llmEndpoint={appConfig.openaiBaseUrl}
      preferredLanguage={status.preferredLanguage}
      queue={{
        initialEntries: status.queueEntries,
        initialCounts: status.queueCounts,
      }}
      reindex={{ initialStatus: status.reindexStatus }}
    />
  );
}

async function loadStatus() {
  await ensureAppDirectories();

  const [
    documents,
    originalsDir,
    ingestDir,
    queueEntries,
    queueCounts,
    reindexStatus,
    preferredLanguage,
  ] = await Promise.all([
    getDocumentCount(),
    fileExists(appConfig.originalsDir),
    fileExists(appConfig.ingestDir),
    getQueueEntries({ limit: 5 }),
    getQueueCounts(),
    getLatestReindexAllStatus(),
    getPreferredLanguage(),
  ]);

  return {
    documents,
    originalsDir,
    ingestDir,
    queueEntries,
    queueCounts,
    reindexStatus,
    preferredLanguage,
  };
}

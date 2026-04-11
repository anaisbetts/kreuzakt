import Link from "next/link";

import { ProcessingQueue } from "@/components/ProcessingQueue";
import { appConfig } from "@/lib/config";
import { getDocumentCount } from "@/lib/documents";
import { ensureAppDirectories, fileExists } from "@/lib/files";
import { getQueueCounts, getQueueEntries } from "@/lib/ingest/queue";

async function loadStatus() {
  await ensureAppDirectories();

  const [documents, originalsDir, ingestDir, queueEntries, queueCounts] =
    await Promise.all([
      getDocumentCount(),
      fileExists(appConfig.originalsDir),
      fileExists(appConfig.ingestDir),
      getQueueEntries({ limit: 5 }),
      getQueueCounts(),
    ]);

  return {
    documents,
    originalsDir,
    ingestDir,
    queueEntries,
    queueCounts,
  };
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <span className="text-sm font-medium text-neutral-600">{label}</span>
      <span className="text-sm text-neutral-900">{value}</span>
    </div>
  );
}

export default async function StatusPage() {
  const status = await loadStatus();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <Link
        href="/"
        className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
      >
        ← Back to search
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
          System Status
        </h1>
        <p className="text-sm text-neutral-500">
          Health, storage paths, model configuration, and the live processing
          queue for new ingests.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <StatusRow label="Database" value={`${status.documents} documents`} />
        <StatusRow
          label="Originals"
          value={status.originalsDir ? appConfig.originalsDir : "Missing"}
        />
        <StatusRow
          label="Ingest"
          value={status.ingestDir ? appConfig.ingestDir : "Missing"}
        />
        <StatusRow label="OCR Model" value={appConfig.ocrModel} />
        <StatusRow label="Metadata Model" value={appConfig.metadataModel} />
        <StatusRow label="LLM Endpoint" value={appConfig.openaiBaseUrl} />
      </div>

      <ProcessingQueue
        initialEntries={status.queueEntries}
        initialCounts={status.queueCounts}
      />
    </main>
  );
}

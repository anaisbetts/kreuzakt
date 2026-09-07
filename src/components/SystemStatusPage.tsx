import Link from "next/link";

import type { QueueCounts, QueueEntry } from "@/lib/ingest/queue";
import type { ReindexAllStatus } from "@/lib/ingest/reindex";

import { McpSetupSection } from "./McpSetupSection";
import { PaperlessImport } from "./PaperlessImport";
import { PreferredLanguageSetting } from "./PreferredLanguageSetting";
import { ProcessingQueue } from "./ProcessingQueue";
import { ReindexAllPanel } from "./ReindexAllPanel";

export type SystemStatusPageProps = {
  documentCount: number;
  originalsDisplay: string;
  ingestDisplay: string;
  ocrModel: string;
  metadataModel: string;
  ocrEndpoint: string;
  llmEndpoint: string;
  preferredLanguage: string | null;
  queue: {
    initialEntries: QueueEntry[];
    initialCounts: QueueCounts;
    enablePolling?: boolean;
  };
  reindex: {
    initialStatus: ReindexAllStatus;
  };
};

export function SystemStatusPage({
  documentCount,
  originalsDisplay,
  ingestDisplay,
  ocrModel,
  metadataModel,
  ocrEndpoint,
  llmEndpoint,
  preferredLanguage,
  queue,
  reindex,
}: SystemStatusPageProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <Link
        href="/"
        className="text-sm font-medium text-accent transition-colors hover:text-accent-deep"
      >
        ← Back to search
      </Link>

      <McpSetupSection />

      <ProcessingQueue
        enablePolling={queue.enablePolling}
        initialEntries={queue.initialEntries}
        initialCounts={queue.initialCounts}
      />

      <ReindexAllPanel
        documentCount={documentCount}
        initialStatus={reindex.initialStatus}
      />

      <PreferredLanguageSetting initialPreferredLanguage={preferredLanguage} />

      <PaperlessImport />

      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          System Status
        </h1>
        <p className="text-sm text-ink-mute">
          Health, storage paths, model configuration, and the live processing
          queue for ingests and reindex jobs.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <StatusRow label="Database" value={`${documentCount} documents`} />
        <StatusRow label="Originals" value={originalsDisplay} />
        <StatusRow label="Ingest" value={ingestDisplay} />
        <StatusRow label="OCR Model" value={ocrModel} />
        <StatusRow label="Metadata Model" value={metadataModel} />
        <StatusRow label="OCR Endpoint" value={ocrEndpoint} />
        <StatusRow label="LLM Endpoint" value={llmEndpoint} />
      </div>
    </main>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface px-4 py-3">
      <span className="text-sm font-medium text-ink-soft">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
}

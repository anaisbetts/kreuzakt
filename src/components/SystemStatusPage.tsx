import Link from "next/link";

import type { QueueRow } from "@/lib/db/schema";
import type { QueueCounts } from "@/lib/ingest/queue";

import { McpSetupSection } from "./McpSetupSection";
import { PaperlessImport } from "./PaperlessImport";
import { ProcessingQueue } from "./ProcessingQueue";

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <span className="text-sm font-medium text-neutral-600">{label}</span>
      <span className="text-sm text-neutral-900">{value}</span>
    </div>
  );
}

export type SystemStatusPageProps = {
  documentCount: number;
  originalsDisplay: string;
  ingestDisplay: string;
  ocrModel: string;
  metadataModel: string;
  llmEndpoint: string;
  queue: {
    initialEntries: QueueRow[];
    initialCounts: QueueCounts;
    enablePolling?: boolean;
  };
};

export function SystemStatusPage({
  documentCount,
  originalsDisplay,
  ingestDisplay,
  ocrModel,
  metadataModel,
  llmEndpoint,
  queue,
}: SystemStatusPageProps) {
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
        <StatusRow label="Database" value={`${documentCount} documents`} />
        <StatusRow label="Originals" value={originalsDisplay} />
        <StatusRow label="Ingest" value={ingestDisplay} />
        <StatusRow label="OCR Model" value={ocrModel} />
        <StatusRow label="Metadata Model" value={metadataModel} />
        <StatusRow label="LLM Endpoint" value={llmEndpoint} />
      </div>

      <McpSetupSection />

      <PaperlessImport />

      <ProcessingQueue
        enablePolling={queue.enablePolling}
        initialEntries={queue.initialEntries}
        initialCounts={queue.initialCounts}
      />
    </main>
  );
}

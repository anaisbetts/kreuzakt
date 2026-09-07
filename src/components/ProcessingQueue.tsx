"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ProcessingStatus } from "@/lib/db/schema";
import {
  formatProcessingDuration,
  formatRelativeTime,
} from "@/lib/format-date";
import type { QueueCounts, QueueEntry } from "@/lib/ingest/queue";

const DEFAULT_LIMIT = 5;
const SHOW_ALL_LIMIT = 100;
const REFRESH_INTERVAL_MS = 5000;

type ProcessingQueueProps = {
  initialEntries: QueueEntry[];
  initialCounts: QueueCounts;
  /** When false, keeps the initial snapshot and does not poll `/api/queue` (e.g. Storybook). */
  enablePolling?: boolean;
};

function totalCount(counts: QueueCounts) {
  return counts.pending + counts.processing + counts.completed + counts.failed;
}

function StatusDot({ status }: { status: ProcessingStatus }) {
  if (status === "processing") {
    return (
      <span className="inline-flex h-3 w-3 animate-spin rounded-full border-2 border-info/30 border-t-info" />
    );
  }

  const className =
    status === "completed"
      ? "bg-success"
      : status === "failed"
        ? "bg-danger"
        : "bg-warning";

  return <span className={`inline-flex h-3 w-3 rounded-full ${className}`} />;
}

function StatusBadge({ status }: { status: ProcessingStatus }) {
  const label =
    status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ");

  const className =
    status === "completed"
      ? "bg-success-tint text-success"
      : status === "failed"
        ? "bg-danger-tint text-danger"
        : status === "processing"
          ? "bg-info-tint text-info"
          : "bg-warning-tint text-warning";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

async function fetchQueue(limit: number) {
  const response = await fetch(`/api/queue?limit=${limit}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch processing queue");
  }

  return response.json() as Promise<{
    entries: QueueEntry[];
    counts: QueueCounts;
  }>;
}

function formatQueueTiming(entry: QueueEntry) {
  if (entry.status === "completed" && entry.completed_at) {
    return formatProcessingDuration(
      entry.created_at,
      entry.completed_at,
      entry.page_count,
    );
  }

  return `Queued ${formatRelativeTime(entry.created_at)}`;
}

export function ProcessingQueue({
  initialEntries,
  initialCounts,
  enablePolling = true,
}: ProcessingQueueProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [counts, setCounts] = useState(initialCounts);
  const [showAll, setShowAll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [retryingIds, setRetryingIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const currentLimit = showAll ? SHOW_ALL_LIMIT : DEFAULT_LIMIT;
  const totalEntries = useMemo(() => totalCount(counts), [counts]);

  const refreshQueue = useCallback(async (limit: number) => {
    try {
      setIsLoading(true);
      const next = await fetchQueue(limit);
      setEntries(next.entries);
      setCounts(next.counts);
      setError(null);
    } catch (refreshError) {
      console.error(refreshError);
      setError("Unable to refresh processing queue");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enablePolling) {
      return;
    }

    void refreshQueue(currentLimit);

    const interval = window.setInterval(() => {
      void refreshQueue(currentLimit);
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [currentLimit, refreshQueue, enablePolling]);

  async function handleRetry(id: number) {
    setRetryingIds((current) => [...current, id]);

    try {
      const response = await fetch(`/api/queue/${id}/retry`, {
        method: "POST",
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "Retry failed");
      }

      await refreshQueue(currentLimit);
    } catch (retryError) {
      console.error(retryError);
      setError(
        retryError instanceof Error ? retryError.message : "Retry failed",
      );
    } finally {
      setRetryingIds((current) => current.filter((entryId) => entryId !== id));
    }
  }

  return (
    <section className="panel flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">Processing Queue</h2>
          <p className="text-sm text-ink-mute">
            Recent ingest activity across pending, processing, completed, and
            failed files.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-ink-mute">
          {isLoading ? <span>Refreshing...</span> : null}
          {totalEntries > DEFAULT_LIMIT ? (
            <button
              type="button"
              onClick={() => setShowAll((current) => !current)}
              className="btn btn-secondary px-3 py-2"
            >
              {showAll ? "Show recent" : "Show all"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-card border border-warning-line bg-warning-tint px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-warning">
            Pending
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
            {counts.pending}
          </p>
        </div>
        <div className="rounded-card border border-info-line bg-info-tint px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-info">
            Processing
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
            {counts.processing}
          </p>
        </div>
        <div className="rounded-card border border-success-line bg-success-tint px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-success">
            Completed
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
            {counts.completed}
          </p>
        </div>
        <div className="rounded-card border border-danger-line bg-danger-tint px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-danger">
            Failed
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
            {counts.failed}
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-card border border-danger-line bg-danger-tint px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {entries.length > 0 ? (
        <div className="flex flex-col overflow-hidden rounded-card border border-line">
          {entries.map((entry) => {
            const isRetrying = retryingIds.includes(entry.id);

            return (
              <div
                key={entry.id}
                className="border-b border-line px-4 py-4 last:border-b-0"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <StatusDot status={entry.status} />
                      <p className="truncate text-sm font-medium text-ink">
                        {entry.filename}
                      </p>
                      <StatusBadge status={entry.status} />
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-ink-mute">
                      <span>{formatQueueTiming(entry)}</span>
                      <span>
                        {entry.completed_at
                          ? `Updated ${formatRelativeTime(entry.completed_at)}`
                          : "Waiting for completion"}
                      </span>
                      {entry.document_id ? (
                        <span>Document #{entry.document_id}</span>
                      ) : null}
                    </div>

                    {entry.error ? (
                      <p className="mt-2 text-sm text-danger">{entry.error}</p>
                    ) : null}
                  </div>

                  {entry.status === "failed" ? (
                    <button
                      type="button"
                      onClick={() => handleRetry(entry.id)}
                      disabled={isRetrying}
                      className="btn btn-secondary px-3 py-2"
                    >
                      {isRetrying ? "Retrying..." : "Retry"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-card border border-dashed border-line-strong px-4 py-10 text-center text-sm text-ink-mute">
          No queue entries yet.
        </div>
      )}
    </section>
  );
}

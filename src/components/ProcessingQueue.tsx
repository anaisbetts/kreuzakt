"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { QueueRow } from "@/lib/db/schema";
import type { QueueCounts } from "@/lib/ingest/queue";

const DEFAULT_LIMIT = 5;
const SHOW_ALL_LIMIT = 100;
const REFRESH_INTERVAL_MS = 5000;

type ProcessingQueueProps = {
  initialEntries: QueueRow[];
  initialCounts: QueueCounts;
};

function totalCount(counts: QueueCounts) {
  return counts.pending + counts.processing + counts.completed + counts.failed;
}

function formatRelativeTime(value: string | null) {
  if (!value) {
    return "Not finished";
  }

  const deltaSeconds = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 1000),
  );

  if (deltaSeconds < 10) {
    return "just now";
  }

  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }

  const deltaMinutes = Math.floor(deltaSeconds / 60);
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }

  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}d ago`;
}

function StatusDot({ status }: { status: QueueRow["status"] }) {
  if (status === "processing") {
    return (
      <span className="inline-flex h-3 w-3 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
    );
  }

  const className =
    status === "completed"
      ? "bg-emerald-500"
      : status === "failed"
        ? "bg-red-500"
        : "bg-amber-500";

  return <span className={`inline-flex h-3 w-3 rounded-full ${className}`} />;
}

function StatusBadge({ status }: { status: QueueRow["status"] }) {
  const label =
    status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ");

  const className =
    status === "completed"
      ? "bg-emerald-50 text-emerald-700"
      : status === "failed"
        ? "bg-red-50 text-red-700"
        : status === "processing"
          ? "bg-blue-50 text-blue-700"
          : "bg-amber-50 text-amber-700";

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
    entries: QueueRow[];
    counts: QueueCounts;
  }>;
}

export function ProcessingQueue({
  initialEntries,
  initialCounts,
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
    void refreshQueue(currentLimit);

    const interval = window.setInterval(() => {
      void refreshQueue(currentLimit);
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [currentLimit, refreshQueue]);

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
    <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
            Processing Queue
          </h2>
          <p className="text-sm text-neutral-500">
            Recent ingest activity across pending, processing, completed, and
            failed files.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-neutral-500">
          {isLoading ? <span>Refreshing...</span> : null}
          {totalEntries > DEFAULT_LIMIT ? (
            <button
              type="button"
              onClick={() => setShowAll((current) => !current)}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              {showAll ? "Show recent" : "Show all"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
            Pending
          </p>
          <p className="mt-1 text-2xl font-semibold text-amber-900">
            {counts.pending}
          </p>
        </div>
        <div className="rounded-xl bg-blue-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
            Processing
          </p>
          <p className="mt-1 text-2xl font-semibold text-blue-900">
            {counts.processing}
          </p>
        </div>
        <div className="rounded-xl bg-emerald-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            Completed
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900">
            {counts.completed}
          </p>
        </div>
        <div className="rounded-xl bg-red-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-red-700">
            Failed
          </p>
          <p className="mt-1 text-2xl font-semibold text-red-900">
            {counts.failed}
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {entries.length > 0 ? (
        <div className="flex flex-col overflow-hidden rounded-xl border border-neutral-200">
          {entries.map((entry) => {
            const isRetrying = retryingIds.includes(entry.id);

            return (
              <div
                key={entry.id}
                className="border-b border-neutral-200 px-4 py-4 last:border-b-0"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <StatusDot status={entry.status} />
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {entry.filename}
                      </p>
                      <StatusBadge status={entry.status} />
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                      <span>Queued {formatRelativeTime(entry.created_at)}</span>
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
                      <p className="mt-2 text-sm text-red-700">{entry.error}</p>
                    ) : null}
                  </div>

                  {entry.status === "failed" ? (
                    <button
                      type="button"
                      onClick={() => handleRetry(entry.id)}
                      disabled={isRetrying}
                      className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="rounded-xl border border-dashed border-neutral-300 px-4 py-10 text-center text-sm text-neutral-500">
          No queue entries yet.
        </div>
      )}
    </section>
  );
}

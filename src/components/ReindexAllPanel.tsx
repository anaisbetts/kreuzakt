"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ReindexAllStatus } from "@/lib/ingest/reindex";

const REFRESH_INTERVAL_MS = 5000;

type ReindexAllPanelProps = {
  documentCount: number;
  initialStatus: ReindexAllStatus;
};

export function ReindexAllPanel({
  documentCount,
  initialStatus,
}: ReindexAllPanelProps) {
  const [status, setStatus] = useState(initialStatus);
  const [isQueueing, setIsQueueing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasDocuments = documentCount > 0;
  const isActive = status.active || isQueueing;
  const progressPercent = status.total > 0 ? status.percentComplete : 0;
  const progressLabel = useMemo(() => {
    if (status.total === 0) {
      return "No reindex job has been queued yet.";
    }

    return `${status.processed} of ${status.total} documents processed (${status.percentComplete}%)`;
  }, [status]);

  const refreshStatus = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch("/api/reindex-all", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Unable to refresh reindex progress");
      }

      const body = (await response.json()) as { status: ReindexAllStatus };
      setStatus(body.status);
      setError(null);
    } catch (refreshError) {
      console.error(refreshError);
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to refresh reindex progress",
      );
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!status.active) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshStatus();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [refreshStatus, status.active]);

  async function handleQueueReindex() {
    const confirmed = window.confirm(
      [
        "Reindex every document?",
        "",
        "This will regenerate thumbnails, rerun image/PDF text extraction, and recreate metadata for every document.",
        "It can take a long time and may cost money if OCR or metadata models use paid APIs.",
        "Uploaded-at dates will be preserved.",
      ].join("\n"),
    );

    if (!confirmed) {
      return;
    }

    setIsQueueing(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/reindex-all", { method: "POST" });
      const body = (await response.json()) as {
        status?: ReindexAllStatus;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(body.message ?? "Unable to queue reindex job");
      }

      if (body.status) {
        setStatus(body.status);
      }
      setMessage(body.message ?? "Reindex job queued");
      void refreshStatus();
    } catch (queueError) {
      console.error(queueError);
      setError(
        queueError instanceof Error
          ? queueError.message
          : "Unable to queue reindex job",
      );
    } finally {
      setIsQueueing(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
            Reindex all documents
          </h2>
          <p className="mt-1 text-sm text-neutral-700">
            Queue a full rebuild of thumbnails, extracted text, metadata, and
            search entries while preserving each document&apos;s uploaded-at
            date.
          </p>
        </div>

        <button
          type="button"
          onClick={handleQueueReindex}
          disabled={!hasDocuments || isActive}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {isQueueing
            ? "Queueing..."
            : status.active
              ? "Reindex running"
              : "Reindex all"}
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-medium text-neutral-700">Progress</span>
          <span className="text-neutral-600">
            {isRefreshing ? "Refreshing..." : progressLabel}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-amber-500 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {status.total > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-600 sm:grid-cols-4">
            <span>{status.pending} pending</span>
            <span>{status.processing} processing</span>
            <span>{status.completed} completed</span>
            <span>{status.failed} failed</span>
          </div>
        ) : null}
      </div>

      {!hasDocuments ? (
        <p className="text-sm text-neutral-600">
          Add documents before running a full reindex.
        </p>
      ) : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}

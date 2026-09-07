"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";

type ImportEvent =
  | {
      type: "started";
      total: number;
    }
  | {
      type: "progress";
      current: number;
      total: number;
      filename: string;
      message?: string;
      status: "completed" | "duplicate" | "failed";
    }
  | {
      type: "complete";
      total: number;
      imported: number;
      duplicates: number;
      failed: number;
    }
  | {
      type: "error";
      message: string;
    };

interface ImportProgressState {
  current: number;
  total: number;
  imported: number;
  duplicates: number;
  failed: number;
  lastFilename: string | null;
  lastMessage: string | null;
  lastStatus: "completed" | "duplicate" | "failed" | null;
}

const initialProgress: ImportProgressState = {
  current: 0,
  total: 0,
  imported: 0,
  duplicates: 0,
  failed: 0,
  lastFilename: null,
  lastMessage: null,
  lastStatus: null,
};

export function PaperlessImport() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(initialProgress);

  const progressPercent = useMemo(() => {
    if (progress.total < 1) {
      return 0;
    }

    return Math.min(100, Math.round((progress.current / progress.total) * 100));
  }, [progress.current, progress.total]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isImporting) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const paperlessUrl = formData.get("url");
    const apiKey = formData.get("apiKey");

    if (typeof paperlessUrl !== "string" || typeof apiKey !== "string") {
      setError("Paperless URL and API key are required");
      return;
    }

    setIsImporting(true);
    setError(null);
    setProgress(initialProgress);

    try {
      const response = await fetch("/api/import/paperless", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: paperlessUrl.trim(),
          apiKey: apiKey.trim(),
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "Paperless import failed");
      }

      if (!response.body) {
        throw new Error("Paperless import did not return a progress stream");
      }

      await consumeImportStream(response.body, (nextEvent) => {
        if (nextEvent.type === "started") {
          setProgress((current) => ({
            ...current,
            current: 0,
            total: nextEvent.total,
          }));
          return;
        }

        if (nextEvent.type === "progress") {
          setProgress((current) => ({
            current: nextEvent.current,
            total: nextEvent.total,
            imported:
              current.imported + (nextEvent.status === "completed" ? 1 : 0),
            duplicates:
              current.duplicates + (nextEvent.status === "duplicate" ? 1 : 0),
            failed: current.failed + (nextEvent.status === "failed" ? 1 : 0),
            lastFilename: nextEvent.filename,
            lastMessage: nextEvent.message ?? null,
            lastStatus: nextEvent.status,
          }));
          return;
        }

        if (nextEvent.type === "complete") {
          setProgress((current) => ({
            ...current,
            current: nextEvent.total,
            total: nextEvent.total,
            imported: nextEvent.imported,
            duplicates: nextEvent.duplicates,
            failed: nextEvent.failed,
          }));
          return;
        }

        setError(nextEvent.message);
      });
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Paperless import failed",
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className="panel flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="section-title">Paperless-ngx Import</h2>
        <p className="text-sm text-ink-mute">
          Import documents directly from Paperless-ngx. Only the Paperless added
          date is preserved; everything else is reprocessed through the normal
          ingest pipeline.
        </p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink-soft">
            Paperless URL
          </span>
          <input
            type="url"
            name="url"
            placeholder="https://paperless.example.com"
            required
            className="field"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink-soft">API Key</span>
          <div className="flex gap-2">
            <input
              type={showApiKey ? "text" : "password"}
              name="apiKey"
              required
              autoComplete="off"
              className="field min-w-0 flex-1"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((current) => !current)}
              className="btn btn-secondary px-3 py-3"
            >
              {showApiKey ? "Hide" : "Show"}
            </button>
          </div>
          <span className="text-xs text-ink-mute">
            Create a token in your Paperless-ngx instance under Settings &gt;
            Administration &gt; Auth Tokens.
          </span>
        </label>

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-ink-mute">
            Files are downloaded into <code>ingest/</code> and then processed
            like any other upload.
          </div>
          <button
            type="submit"
            disabled={isImporting}
            className="btn btn-primary px-4 py-3"
          >
            {isImporting ? "Importing..." : "Import"}
          </button>
        </div>
      </form>

      {progress.total > 0 ? (
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface-sunken px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">
                Importing {progress.current} / {progress.total}
              </p>
              <p className="text-xs text-ink-mute">
                Imported {progress.imported}, duplicates {progress.duplicates},
                failed {progress.failed}
              </p>
            </div>
            <span className="text-sm font-medium tabular-nums text-ink-soft">
              {progressPercent}%
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-canvas-deep">
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {progress.lastFilename ? (
            <div className="text-sm text-ink-soft">
              <span className="font-medium text-ink">Latest document:</span>{" "}
              {progress.lastFilename}
              {progress.lastStatus ? ` (${progress.lastStatus})` : ""}
            </div>
          ) : null}

          {progress.lastMessage ? (
            <div className="text-sm text-danger">{progress.lastMessage}</div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-card border border-danger-line bg-danger-tint px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}
    </section>
  );
}

async function consumeImportStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: ImportEvent) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      flushBuffer(buffer, onEvent);
      return;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      parseSseChunk(part, onEvent);
    }
  }
}

function flushBuffer(buffer: string, onEvent: (event: ImportEvent) => void) {
  const trimmed = buffer.trim();
  if (!trimmed) {
    return;
  }

  parseSseChunk(trimmed, onEvent);
}

function parseSseChunk(chunk: string, onEvent: (event: ImportEvent) => void) {
  const data = chunk
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .join("\n");

  if (!data) {
    return;
  }

  onEvent(JSON.parse(data) as ImportEvent);
}

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
  const [paperlessUrl, setPaperlessUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(initialProgress);

  const canImport = paperlessUrl.trim() !== "" && apiKey.trim() !== "";
  const progressPercent = useMemo(() => {
    if (progress.total < 1) {
      return 0;
    }

    return Math.min(100, Math.round((progress.current / progress.total) * 100));
  }, [progress.current, progress.total]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canImport || isImporting) {
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
      console.error(importError);
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
    <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
          Paperless-ngx Import
        </h2>
        <p className="text-sm text-neutral-500">
          Import documents directly from Paperless-ngx. Only the Paperless added
          date is preserved; everything else is reprocessed through the normal
          ingest pipeline.
        </p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-700">
            Paperless URL
          </span>
          <input
            type="url"
            value={paperlessUrl}
            onChange={(event) => setPaperlessUrl(event.target.value)}
            placeholder="https://paperless.example.com"
            className="rounded-xl border border-neutral-300 px-4 py-3 text-sm text-neutral-900 outline-none transition-colors focus:border-blue-500"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-700">API Key</span>
          <div className="flex gap-2">
            <input
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-neutral-300 px-4 py-3 text-sm text-neutral-900 outline-none transition-colors focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((current) => !current)}
              className="rounded-xl border border-neutral-200 px-3 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              {showApiKey ? "Hide" : "Show"}
            </button>
          </div>
          <span className="text-xs text-neutral-500">
            Create a token in your Paperless-ngx instance under Settings &gt;
            Administration &gt; Auth Tokens.
          </span>
        </label>

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-neutral-500">
            Files are downloaded into <code>ingest/</code> and then processed
            like any other upload.
          </div>
          <button
            type="submit"
            disabled={!canImport || isImporting}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isImporting ? "Importing..." : "Import"}
          </button>
        </div>
      </form>

      {progress.total > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-neutral-900">
                Importing {progress.current} / {progress.total}
              </p>
              <p className="text-xs text-neutral-500">
                Imported {progress.imported}, duplicates {progress.duplicates},
                failed {progress.failed}
              </p>
            </div>
            <span className="text-sm font-medium text-neutral-700">
              {progressPercent}%
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {progress.lastFilename ? (
            <div className="text-sm text-neutral-600">
              <span className="font-medium text-neutral-900">
                Latest document:
              </span>{" "}
              {progress.lastFilename}
              {progress.lastStatus ? ` (${progress.lastStatus})` : ""}
            </div>
          ) : null}

          {progress.lastMessage ? (
            <div className="text-sm text-red-700">{progress.lastMessage}</div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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

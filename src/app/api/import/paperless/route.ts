import type { NextRequest } from "next/server";

import { jsonError } from "@/lib/api";
import {
  importFromPaperless,
  type PaperlessImportEvent,
} from "@/lib/import/orchestrator";
import { normalizePaperlessUrl, PaperlessClient } from "@/lib/import/paperless";

export const runtime = "nodejs";

declare global {
  var __docsAiPaperlessImportRunning: boolean | undefined;
}

const encoder = new TextEncoder();

export async function POST(request: NextRequest) {
  const body = await parseRequestBody(request);
  if (!body) {
    return jsonError(
      400,
      "bad_request",
      "Request body must include Paperless URL and API key",
    );
  }

  let paperlessUrl: string;

  try {
    paperlessUrl = normalizePaperlessUrl(body.url);
    new URL(paperlessUrl);
  } catch {
    return jsonError(400, "bad_request", "Paperless URL must be a valid URL");
  }

  const apiKey = body.apiKey.trim();
  if (!apiKey) {
    return jsonError(400, "bad_request", "Paperless API key is required");
  }

  if (globalThis.__docsAiPaperlessImportRunning) {
    return jsonError(409, "conflict", "A Paperless import is already running");
  }

  const client = new PaperlessClient({
    apiKey,
    baseUrl: paperlessUrl,
    signal: request.signal,
  });

  try {
    await client.checkConnection();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to connect to Paperless";
    return jsonError(502, "upstream_error", message);
  }

  globalThis.__docsAiPaperlessImportRunning = true;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const cleanup = () => {
        globalThis.__docsAiPaperlessImportRunning = false;
      };

      const close = () => {
        if (closed) {
          return;
        }

        closed = true;
        controller.close();
        cleanup();
      };

      const send = async (
        event: PaperlessImportEvent | { type: "error"; message: string },
      ) => {
        if (closed) {
          return;
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      request.signal.addEventListener(
        "abort",
        () => {
          cleanup();
          if (!closed) {
            closed = true;
          }
        },
        { once: true },
      );

      void (async () => {
        try {
          await importFromPaperless({
            paperlessUrl,
            apiKey,
            signal: request.signal,
            onEvent: send,
          });
          close();
        } catch (error) {
          if (request.signal.aborted) {
            cleanup();
            return;
          }

          console.error("paperless import failed", error);
          await send({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Paperless import failed",
          });
          close();
        }
      })();
    },
    cancel() {
      globalThis.__docsAiPaperlessImportRunning = false;
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}

async function parseRequestBody(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      apiKey?: unknown;
      url?: unknown;
    };

    if (typeof body.url !== "string" || typeof body.apiKey !== "string") {
      return null;
    }

    return {
      apiKey: body.apiKey,
      url: body.url,
    };
  } catch {
    return null;
  }
}

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { retryQueueEntry } from "@/lib/ingest/queue";
import { enqueueQueuedFile } from "@/lib/ingest/watcher";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;
  const id = Number.parseInt(rawId, 10);

  if (!Number.isFinite(id) || id < 1) {
    return jsonError(
      400,
      "bad_request",
      "Queue entry id must be a positive integer",
    );
  }

  try {
    const result = await retryQueueEntry(id);

    if (result.type === "not_found") {
      return jsonError(404, "not_found", `Queue entry ${id} not found`);
    }

    if (result.type === "invalid_status") {
      return jsonError(
        400,
        "bad_request",
        `Queue entry ${id} is not in failed status`,
      );
    }

    await enqueueQueuedFile(result.entry.filename, result.entry.id);

    return NextResponse.json({
      id: result.entry.id,
      filename: result.entry.filename,
      status: result.entry.status,
      message: "Re-queued for processing",
    });
  } catch (error) {
    console.error("queue retry failed", error);
    return jsonError(500, "internal_error", "Failed to retry queue entry");
  }
}

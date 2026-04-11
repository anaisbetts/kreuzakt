import { type NextRequest, NextResponse } from "next/server";

import { jsonError, parsePositiveInt } from "@/lib/api";
import type { ProcessingStatus } from "@/lib/db/schema";
import { getQueueCounts, getQueueEntries } from "@/lib/ingest/queue";

export const runtime = "nodejs";

function isProcessingStatus(value: string | null): value is ProcessingStatus {
  return (
    value === "pending" ||
    value === "processing" ||
    value === "completed" ||
    value === "failed"
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = parsePositiveInt(searchParams.get("limit"), 20, { max: 100 });
  const statusParam = searchParams.get("status");

  if (limit == null) {
    return jsonError(400, "bad_request", "`limit` must be a positive integer");
  }

  if (statusParam && !isProcessingStatus(statusParam)) {
    return jsonError(
      400,
      "bad_request",
      "`status` must be one of pending, processing, completed, or failed",
    );
  }

  const status = isProcessingStatus(statusParam) ? statusParam : undefined;

  try {
    const [entries, counts] = await Promise.all([
      getQueueEntries({
        limit,
        status: status ?? undefined,
      }),
      getQueueCounts(),
    ]);

    return NextResponse.json({
      entries,
      counts,
    });
  } catch (error) {
    console.error("queue fetch failed", error);
    return jsonError(500, "internal_error", "Failed to fetch processing queue");
  }
}

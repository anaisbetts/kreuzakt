import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import {
  getLatestReindexAllStatus,
  queueReindexAllDocuments,
} from "@/lib/ingest/reindex";

export const runtime = "nodejs";

export async function GET() {
  try {
    const status = await getLatestReindexAllStatus();
    return NextResponse.json({ status });
  } catch (error) {
    console.error("reindex status fetch failed", error);
    return jsonError(500, "internal_error", "Failed to fetch reindex status");
  }
}

export async function POST() {
  try {
    const result = await queueReindexAllDocuments();

    if (result.type === "already_running") {
      return NextResponse.json(
        {
          status: result.status,
          message: "A reindex job is already running",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        status: result.status,
        message: "Reindex job queued",
      },
      { status: 202 },
    );
  } catch (error) {
    console.error("reindex queue failed", error);
    return jsonError(500, "internal_error", "Failed to queue reindex job");
  }
}

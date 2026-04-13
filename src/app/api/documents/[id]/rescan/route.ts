import { type NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import {
  DocumentOriginalNotFoundError,
  rescanDocumentById,
} from "@/lib/documents";

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
      "Document id must be a positive integer",
    );
  }

  try {
    const document = await rescanDocumentById(id);

    if (!document) {
      return jsonError(404, "not_found", `Document ${id} not found`);
    }

    return NextResponse.json(document);
  } catch (error) {
    if (error instanceof DocumentOriginalNotFoundError) {
      return jsonError(404, "not_found", error.message);
    }

    console.error("document rescan failed", error);

    return jsonError(500, "internal_error", "Failed to rescan document");
  }
}

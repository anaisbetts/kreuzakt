import { type NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { deleteDocumentById, getDocumentById } from "@/lib/documents";

export const runtime = "nodejs";

export async function GET(
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
    const document = await getDocumentById(id);

    if (!document) {
      return jsonError(404, "not_found", `Document ${id} not found`);
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error("document fetch failed", error);

    return jsonError(500, "internal_error", "Failed to fetch document");
  }
}

export async function DELETE(
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
    const deleted = await deleteDocumentById(id);

    if (!deleted) {
      return jsonError(404, "not_found", `Document ${id} not found`);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("document delete failed", error);

    return jsonError(500, "internal_error", "Failed to delete document");
  }
}

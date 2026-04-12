import type { NextRequest } from "next/server";

import { jsonError } from "@/lib/api";
import { getDocumentById } from "@/lib/documents";
import { jpegThumbnailResponse } from "@/lib/fileResponse";
import { fileExists, getPageThumbnailPath } from "@/lib/files";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; page: string }> },
) {
  const { id: rawId, page: rawPage } = await context.params;
  const id = Number.parseInt(rawId, 10);
  const page = Number.parseInt(rawPage, 10);

  if (!Number.isFinite(id) || id < 1) {
    return jsonError(
      400,
      "bad_request",
      "Document id must be a positive integer",
    );
  }

  if (!Number.isFinite(page) || page < 1) {
    return jsonError(400, "bad_request", "Page must be a positive integer");
  }

  try {
    const document = await getDocumentById(id);

    if (!document) {
      return jsonError(404, "not_found", `Document ${id} not found`);
    }

    const thumbnailPath = getPageThumbnailPath(id, page);

    if (!(await fileExists(thumbnailPath))) {
      return jsonError(
        404,
        "not_found",
        `Thumbnail for document ${id} page ${page} not found`,
      );
    }

    return jpegThumbnailResponse(thumbnailPath);
  } catch (error) {
    console.error("page thumbnail fetch failed", error);

    return jsonError(500, "internal_error", "Failed to serve page thumbnail");
  }
}

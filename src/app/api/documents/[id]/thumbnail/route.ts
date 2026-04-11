import type { NextRequest } from "next/server";

import { jsonError } from "@/lib/api";
import { getDocumentById } from "@/lib/documents";
import { jpegThumbnailResponse } from "@/lib/fileResponse";
import { fileExists, getThumbnailPath } from "@/lib/files";

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

    const thumbnailPath = getThumbnailPath(id);

    if (!(await fileExists(thumbnailPath))) {
      return jsonError(
        404,
        "not_found",
        `Thumbnail for document ${id} not found`,
      );
    }

    return jpegThumbnailResponse(thumbnailPath);
  } catch (error) {
    console.error("thumbnail fetch failed", error);

    return jsonError(500, "internal_error", "Failed to serve thumbnail");
  }
}

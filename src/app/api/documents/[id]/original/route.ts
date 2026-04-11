import type { NextRequest } from "next/server";

import { jsonError } from "@/lib/api";
import { getDocumentById } from "@/lib/documents";
import { fileExists, getOriginalFilePath } from "@/lib/files";

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

    const filePath = getOriginalFilePath(document.stored_filename);

    if (!(await fileExists(filePath))) {
      return jsonError(
        404,
        "not_found",
        `Original file for document ${id} not found`,
      );
    }

    return new Response(Bun.file(filePath), {
      headers: {
        "Content-Type": document.mime_type,
        "Content-Disposition": `attachment; filename="${document.original_filename}"; filename*=UTF-8''${encodeURIComponent(document.original_filename)}`,
      },
    });
  } catch (error) {
    console.error("original download failed", error);

    return jsonError(500, "internal_error", "Failed to serve original file");
  }
}

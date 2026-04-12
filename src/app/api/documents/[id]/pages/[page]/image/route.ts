import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { jsonError } from "@/lib/api";
import { getDocumentById } from "@/lib/documents";
import { streamedFileResponse } from "@/lib/fileResponse";
import {
  ensureDirectory,
  fileExists,
  getDocumentThumbnailDir,
  getOriginalFilePath,
} from "@/lib/files";
import { getKreuzberg } from "@/lib/ingest/kreuzberg";

export const runtime = "nodejs";

function getPageImagePath(documentId: number, page: number) {
  return path.join(getDocumentThumbnailDir(documentId), `${page}-full.png`);
}

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

    if (document.mime_type.startsWith("image/")) {
      const filePath = getOriginalFilePath(document.stored_filename);

      if (!(await fileExists(filePath))) {
        return jsonError(
          404,
          "not_found",
          `Original file for document ${id} not found`,
        );
      }

      return streamedFileResponse(filePath, {
        "Content-Type": document.mime_type,
        "Cache-Control": "public, max-age=86400",
      });
    }

    if (document.mime_type === "application/pdf") {
      const cachedPath = getPageImagePath(id, page);

      if (await fileExists(cachedPath)) {
        return streamedFileResponse(cachedPath, {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        });
      }

      const originalPath = getOriginalFilePath(document.stored_filename);

      if (!(await fileExists(originalPath))) {
        return jsonError(
          404,
          "not_found",
          `Original file for document ${id} not found`,
        );
      }

      const { renderPdfPage } = getKreuzberg();
      const pageBuffer = await renderPdfPage(originalPath, page - 1, {
        dpi: 200,
      });

      await ensureDirectory(getDocumentThumbnailDir(id));
      await writeFile(cachedPath, pageBuffer);

      return streamedFileResponse(cachedPath, {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      });
    }

    return jsonError(
      404,
      "not_found",
      `Full-resolution page image not available for this document type`,
    );
  } catch (error) {
    console.error("page image fetch failed", error);

    return jsonError(500, "internal_error", "Failed to serve page image");
  }
}

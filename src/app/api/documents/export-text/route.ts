import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { buildDocumentTextExport, ExportEmptyError } from "@/lib/exportText";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { zipBuffer, filename } = await buildDocumentTextExport();

    return new NextResponse(Buffer.from(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(zipBuffer.byteLength),
      },
    });
  } catch (error) {
    if (error instanceof ExportEmptyError) {
      return jsonError(400, "bad_request", error.message);
    }

    console.error("text export failed", error);

    return jsonError(500, "internal_error", "Failed to export document text");
  }
}

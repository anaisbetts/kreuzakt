import { type NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { buildDocumentTextExport, ExportEmptyError } from "@/lib/exportText";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const baseUrl = getRequestBaseUrl(request);
    const { zipBuffer, filename } = await buildDocumentTextExport(undefined, {
      baseUrl,
    });

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

function getRequestBaseUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = forwardedHost ?? request.headers.get("host");
  const protocol =
    forwardedProto ?? request.nextUrl.protocol.replace(/:$/, "") ?? "http";

  if (host) {
    return `${protocol}://${host}`;
  }

  return request.nextUrl.origin;
}

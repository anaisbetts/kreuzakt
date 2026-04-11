import { type NextRequest, NextResponse } from "next/server";

import { jsonError, parsePositiveInt } from "@/lib/api";
import { listDocuments } from "@/lib/documents";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const limit = parsePositiveInt(searchParams.get("limit"), 20, { max: 100 });
  const since = searchParams.get("since");

  if (page == null || limit == null) {
    return jsonError(
      400,
      "bad_request",
      "Pagination parameters must be positive integers",
    );
  }

  try {
    const documents = await listDocuments({ page, limit, since });

    return NextResponse.json({
      documents: documents.items,
      total: documents.total,
      page: documents.page,
      limit: documents.limit,
    });
  } catch (error) {
    console.error("document list failed", error);

    return jsonError(500, "internal_error", "Failed to list documents");
  }
}

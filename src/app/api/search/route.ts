import { type NextRequest, NextResponse } from "next/server";

import { jsonError, parsePositiveInt } from "@/lib/api";
import { searchDocuments } from "@/lib/documents";
import { snippetMarkersToHtml } from "@/lib/snippets";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q")?.trim() ?? "";
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const limit = parsePositiveInt(searchParams.get("limit"), 20, { max: 100 });

  if (!query) {
    return jsonError(400, "bad_request", "Query parameter `q` is required");
  }

  if (page == null || limit == null) {
    return jsonError(
      400,
      "bad_request",
      "Pagination parameters must be positive integers",
    );
  }

  try {
    const results = await searchDocuments({ query, page, limit });

    return NextResponse.json({
      results: results.items.map((item) => ({
        ...item,
        snippet: snippetMarkersToHtml(item.snippet),
      })),
      total: results.total,
      page: results.page,
      limit: results.limit,
      query,
    });
  } catch (error) {
    console.error("search failed", error);

    const message =
      error instanceof Error && /fts5|syntax error/i.test(error.message)
        ? "Invalid FTS query syntax"
        : "Search failed";

    return jsonError(
      /Invalid FTS query syntax/.test(message) ? 400 : 500,
      /Invalid FTS query syntax/.test(message)
        ? "bad_request"
        : "internal_error",
      message,
    );
  }
}

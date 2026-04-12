import { SearchPageClient } from "@/components/SearchPageClient";
import { toDocumentCardProps } from "@/lib/document-card-props";
import { listDocuments, searchDocuments } from "@/lib/documents";

function loadErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/** Must match `recentPageSize` passed to SearchPageClient for infinite scroll. */
const RECENT_PAGE_SIZE = 24;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const page = Number.parseInt(params.page ?? "1", 10);
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;

  if (query) {
    try {
      const results = await searchDocuments({
        query,
        page: safePage,
        limit: 20,
      });

      return (
        <SearchPageClient
          initialQuery={query}
          recentDocuments={[]}
          recentTotal={0}
          recentPageSize={RECENT_PAGE_SIZE}
          searchResults={results.items.map(toDocumentCardProps)}
          totalResults={results.total}
          page={results.page}
          totalPages={Math.max(1, Math.ceil(results.total / results.limit))}
        />
      );
    } catch (error) {
      return (
        <SearchPageClient
          initialQuery={query}
          recentDocuments={[]}
          recentTotal={0}
          recentPageSize={RECENT_PAGE_SIZE}
          searchResults={[]}
          totalResults={0}
          page={1}
          totalPages={1}
          searchError={loadErrorMessage(error, "Search failed")}
        />
      );
    }
  }

  try {
    const recent = await listDocuments({
      page: 1,
      limit: RECENT_PAGE_SIZE,
    });

    return (
      <SearchPageClient
        initialQuery=""
        recentDocuments={recent.items.map(toDocumentCardProps)}
        recentTotal={recent.total}
        recentPageSize={RECENT_PAGE_SIZE}
        searchResults={[]}
        page={1}
        totalPages={1}
      />
    );
  } catch (error) {
    return (
      <SearchPageClient
        initialQuery=""
        recentDocuments={[]}
        recentTotal={0}
        recentPageSize={RECENT_PAGE_SIZE}
        searchResults={[]}
        page={1}
        totalPages={1}
        listError={loadErrorMessage(error, "Could not load documents")}
      />
    );
  }
}

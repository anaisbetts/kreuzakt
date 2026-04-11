import type { DocumentCardProps } from "@/components/DocumentCard";
import { SearchPageClient } from "@/components/SearchPageClient";
import { listDocuments, searchDocuments } from "@/lib/documents";

function toCardProps(document: {
  id: number;
  title: string;
  description: string;
  document_date: string | null;
  added_at: string;
  mime_type: string;
  thumbnail_url: string;
  snippet?: string;
}): DocumentCardProps {
  return {
    id: document.id,
    title: document.title,
    description: document.description,
    documentDate: document.document_date ?? document.added_at,
    mimeType: document.mime_type,
    thumbnailUrl: document.thumbnail_url,
    snippet: document.snippet,
  };
}

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
    const results = await searchDocuments({
      query,
      page: safePage,
      limit: 20,
    });

    return (
      <SearchPageClient
        initialQuery={query}
        recentDocuments={[]}
        searchResults={results.items.map(toCardProps)}
        totalResults={results.total}
        page={results.page}
        totalPages={Math.max(1, Math.ceil(results.total / results.limit))}
      />
    );
  }

  const recent = await listDocuments({
    page: 1,
    limit: 12,
  });

  return (
    <SearchPageClient
      initialQuery=""
      recentDocuments={recent.items.map(toCardProps)}
      searchResults={[]}
      page={1}
      totalPages={1}
    />
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { DocumentCardProps } from "./DocumentCard";
import { SearchPage } from "./SearchPage";

export interface SearchPageClientProps {
  initialQuery: string;
  recentDocuments: DocumentCardProps[];
  searchResults: DocumentCardProps[];
  totalResults?: number;
  page: number;
  totalPages: number;
}

export function SearchPageClient({
  initialQuery,
  recentDocuments,
  searchResults,
  totalResults,
  page,
  totalPages,
}: SearchPageClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const hasActiveSearch = initialQuery.trim().length > 0;

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const handleClear = useCallback(() => {
    setQuery("");
    router.push("/");
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!hasActiveSearch) {
      return;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") {
        return;
      }
      e.preventDefault();
      handleClear();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [hasActiveSearch, handleClear]);

  function navigateToSearch(nextQuery: string, nextPage = 1) {
    const trimmedQuery = nextQuery.trim();

    if (!trimmedQuery) {
      handleClear();
      return;
    }

    const params = new URLSearchParams({ q: trimmedQuery });

    if (nextPage > 1) {
      params.set("page", String(nextPage));
    }

    router.push(`/?${params.toString()}`);
    router.refresh();
  }

  return (
    <SearchPage
      query={query}
      hasActiveSearch={hasActiveSearch}
      recentDocuments={recentDocuments}
      searchResults={searchResults}
      totalResults={totalResults}
      page={page}
      totalPages={totalPages}
      onQueryChange={setQuery}
      onSearch={navigateToSearch}
      onClear={handleClear}
      onPageChange={(nextPage) => navigateToSearch(query, nextPage)}
      onHomeClick={handleClear}
      onDocumentClick={(id) => router.push(`/documents/${id}`)}
      onStatusClick={() => router.push("/settings")}
    />
  );
}

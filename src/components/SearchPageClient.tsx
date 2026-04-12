"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { DocumentCardProps } from "./DocumentCard";
import { SearchPage } from "./SearchPage";

const SEARCH_DEBOUNCE_MS = 750;

export interface SearchPageClientProps {
  initialQuery: string;
  recentDocuments: DocumentCardProps[];
  searchResults: DocumentCardProps[];
  totalResults?: number;
  page: number;
  totalPages: number;
  listError?: string | null;
  searchError?: string | null;
}

export function SearchPageClient({
  initialQuery,
  recentDocuments,
  searchResults,
  totalResults,
  page,
  totalPages,
  listError = null,
  searchError = null,
}: SearchPageClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const hasActiveSearch = initialQuery.trim().length > 0;
  const queryRef = useRef(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  queryRef.current = query;

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const clearDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const handleClear = useCallback(() => {
    clearDebounce();
    setQuery("");
    startTransition(() => {
      router.push("/");
      router.refresh();
    });
  }, [router, clearDebounce]);

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

  const navigateToSearch = useCallback(
    (nextQuery: string, nextPage = 1) => {
      const trimmedQuery = nextQuery.trim();

      if (!trimmedQuery) {
        handleClear();
        return;
      }

      const params = new URLSearchParams({ q: trimmedQuery });

      if (nextPage > 1) {
        params.set("page", String(nextPage));
      }

      startTransition(() => {
        router.push(`/?${params.toString()}`);
        router.refresh();
      });
    },
    [router, handleClear],
  );

  const navigateToSearchImmediate = useCallback(
    (nextQuery: string, nextPage = 1) => {
      clearDebounce();
      navigateToSearch(nextQuery, nextPage);
    },
    [clearDebounce, navigateToSearch],
  );

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed === "") {
      clearDebounce();
      if (initialQuery.trim() !== "") {
        startTransition(() => {
          router.push("/");
          router.refresh();
        });
      }
      return;
    }

    if (trimmed === initialQuery.trim()) {
      clearDebounce();
      return;
    }

    clearDebounce();
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      navigateToSearch(queryRef.current, 1);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearDebounce();
    };
  }, [query, initialQuery, navigateToSearch, clearDebounce, router]);

  return (
    <SearchPage
      query={query}
      hasActiveSearch={hasActiveSearch}
      recentDocuments={recentDocuments}
      searchResults={searchResults}
      totalResults={totalResults}
      page={page}
      totalPages={totalPages}
      listError={listError}
      searchError={searchError}
      isNavigating={isPending}
      onQueryChange={setQuery}
      onSearch={navigateToSearchImmediate}
      onClear={handleClear}
      onPageChange={(nextPage) => navigateToSearchImmediate(query, nextPage)}
      onHomeClick={handleClear}
      onDocumentClick={(id) => router.push(`/documents/${id}`)}
      onStatusClick={() => router.push("/settings")}
    />
  );
}

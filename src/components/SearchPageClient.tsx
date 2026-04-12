"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toDocumentCardProps } from "@/lib/document-card-props";
import type { DocumentSummary } from "@/lib/documents";
import { AppHeaderActions } from "./AppHeaderActions";
import type { DocumentCardProps } from "./DocumentCard";
import { SearchPage } from "./SearchPage";
import { useIngestUpload } from "./useIngestUpload";

const SEARCH_DEBOUNCE_MS = 750;

export interface SearchPageClientProps {
  initialQuery: string;
  recentDocuments: DocumentCardProps[];
  /** Total documents in the library (for recent-list infinite scroll). */
  recentTotal: number;
  /** Page size used for `/` SSR and `/api/documents` follow-up requests. */
  recentPageSize: number;
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
  recentTotal,
  recentPageSize,
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
  const [extraRecentDocuments, setExtraRecentDocuments] = useState<
    DocumentCardProps[]
  >([]);
  const [nextRecentPage, setNextRecentPage] = useState(2);
  const [recentLoadingMore, setRecentLoadingMore] = useState(false);
  const [recentLoadMoreError, setRecentLoadMoreError] = useState<string | null>(
    null,
  );
  const recentSentinelRef = useRef<HTMLDivElement | null>(null);
  const recentFetchInFlightRef = useRef(false);
  const { isUploading, notice, uploadFiles } = useIngestUpload({
    onUploadComplete: () => {
      router.refresh();
    },
  });
  const hasActiveSearch = initialQuery.trim().length > 0;
  const queryRef = useRef(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  queryRef.current = query;

  const firstPageKey = recentDocuments.map((d) => d.id).join(",");

  // Reset infinite-scroll state when the server-provided first page changes (e.g. refresh).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `firstPageKey` is intentional
  useEffect(() => {
    setExtraRecentDocuments([]);
    setNextRecentPage(2);
    setRecentLoadMoreError(null);
  }, [firstPageKey]);

  const mergedRecentDocuments = useMemo(
    () => [...recentDocuments, ...extraRecentDocuments],
    [recentDocuments, extraRecentDocuments],
  );

  const recentHasMore =
    !hasActiveSearch &&
    mergedRecentDocuments.length < recentTotal &&
    recentTotal > 0;

  const loadMoreRecent = useCallback(async () => {
    if (recentFetchInFlightRef.current || !recentHasMore) {
      return;
    }

    recentFetchInFlightRef.current = true;
    setRecentLoadingMore(true);
    setRecentLoadMoreError(null);

    try {
      const params = new URLSearchParams({
        page: String(nextRecentPage),
        limit: String(recentPageSize),
      });
      const response = await fetch(`/api/documents?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const data: unknown = await response.json();
      if (
        typeof data !== "object" ||
        data === null ||
        !("documents" in data) ||
        !Array.isArray((data as { documents: unknown }).documents)
      ) {
        throw new Error("Unexpected response");
      }

      const items = (data as { documents: DocumentSummary[] }).documents.map(
        toDocumentCardProps,
      );

      setExtraRecentDocuments((prev) => [...prev, ...items]);
      setNextRecentPage((p) => p + 1);
    } catch {
      setRecentLoadMoreError("Could not load more documents.");
    } finally {
      recentFetchInFlightRef.current = false;
      setRecentLoadingMore(false);
    }
  }, [recentHasMore, nextRecentPage, recentPageSize]);

  useEffect(() => {
    if (hasActiveSearch || !recentHasMore) {
      return;
    }

    const node = recentSentinelRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          void loadMoreRecent();
        }
      },
      { root: null, rootMargin: "480px", threshold: 0 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [hasActiveSearch, recentHasMore, loadMoreRecent]);

  const showRecentFooterExtras =
    recentHasMore || recentLoadingMore || recentLoadMoreError;

  const recentFooter =
    !hasActiveSearch && recentTotal > 0 && showRecentFooterExtras ? (
      <div className="mt-8 flex w-full flex-col items-center gap-3">
        {recentHasMore ? (
          <div
            ref={recentSentinelRef}
            className="pointer-events-none h-2 w-full shrink-0"
            aria-hidden
          />
        ) : null}
        {recentLoadingMore ? (
          <p className="text-sm text-neutral-500">Loading more…</p>
        ) : null}
        {recentLoadMoreError ? (
          <>
            <p className="text-center text-sm text-red-600">
              {recentLoadMoreError}
            </p>
            <button
              type="button"
              onClick={() => {
                void loadMoreRecent();
              }}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Try again
            </button>
          </>
        ) : null}
      </div>
    ) : null;

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
      recentDocuments={mergedRecentDocuments}
      searchResults={searchResults}
      totalResults={totalResults}
      page={page}
      totalPages={totalPages}
      listError={listError}
      searchError={searchError}
      isNavigating={isPending}
      isUploading={isUploading}
      uploadNotice={notice}
      onQueryChange={setQuery}
      onSearch={navigateToSearchImmediate}
      onClear={handleClear}
      onPageChange={(nextPage) => navigateToSearchImmediate(query, nextPage)}
      onHomeClick={handleClear}
      onDocumentClick={(id) => router.push(`/documents/${id}`)}
      onUploadFiles={(files) => {
        void uploadFiles(files);
      }}
      onStatusClick={() => router.push("/settings")}
      recentFooter={recentFooter}
      headerActions={
        <AppHeaderActions
          isUploading={isUploading}
          onUploadFiles={(files) => {
            void uploadFiles(files);
          }}
          onStatusClick={() => router.push("/settings")}
        />
      }
    />
  );
}

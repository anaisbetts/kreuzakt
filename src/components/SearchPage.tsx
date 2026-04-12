import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { DocumentCard, type DocumentCardProps } from "./DocumentCard";
import { FileDropSurface } from "./FileDropSurface";
import { SearchBar } from "./SearchBar";

export interface SearchPageProps {
  query?: string;
  expandRelatedKeywords?: boolean;
  hasActiveSearch?: boolean;
  recentDocuments?: DocumentCardProps[];
  searchResults?: DocumentCardProps[];
  totalResults?: number;
  page?: number;
  totalPages?: number;
  listError?: string | null;
  searchError?: string | null;
  isNavigating?: boolean;
  isUploading?: boolean;
  uploadNotice?: {
    kind: "success" | "error";
    message: string;
  } | null;
  onQueryChange?: (query: string) => void;
  onExpandRelatedKeywordsChange?: (enabled: boolean) => void;
  onSearch?: (query: string) => void;
  onClear?: () => void;
  onPageChange?: (page: number) => void;
  onDocumentClick?: (id: number) => void;
  onUploadFiles?: (files: File[]) => void | Promise<void>;
  onStatusClick?: () => void;
  onHomeClick?: () => void;
  headerActions?: ReactNode;
  /** Shown below the document grid on the home (recent) view — e.g. infinite-scroll sentinel */
  recentFooter?: ReactNode;
}

function StatusIcon({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
      aria-label="System status"
    >
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.47 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    </button>
  );
}

function DocumentGrid({
  documents,
  onDocumentClick,
  focusedIndex,
}: {
  documents: DocumentCardProps[];
  onDocumentClick?: (id: number) => void;
  focusedIndex: number | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {documents.map((doc, index) => (
        <DocumentCard
          key={doc.id}
          {...doc}
          variant="grid"
          isKeyboardFocused={focusedIndex === index}
          onClick={onDocumentClick}
        />
      ))}
    </div>
  );
}

function Pagination({
  page = 1,
  totalPages = 1,
  onPageChange,
}: {
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}) {
  if (!onPageChange || totalPages <= 1) {
    return null;
  }

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  const pages = Array.from(
    { length: end - start + 1 },
    (_, index) => start + index,
  );

  return (
    <nav
      className="mt-8 flex items-center justify-center gap-2"
      aria-label="Pagination"
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Prev
      </button>
      {pages.map((pageNumber) => (
        <button
          key={pageNumber}
          type="button"
          onClick={() => onPageChange(pageNumber)}
          className={[
            "min-w-10 rounded-lg px-3 py-2 text-sm",
            pageNumber === page
              ? "bg-blue-600 text-white"
              : "border border-neutral-200 bg-white text-neutral-700",
          ].join(" ")}
        >
          {pageNumber}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </nav>
  );
}

export function SearchPage({
  query,
  expandRelatedKeywords = false,
  hasActiveSearch,
  recentDocuments,
  searchResults,
  totalResults,
  page = 1,
  totalPages = 1,
  listError = null,
  searchError = null,
  isNavigating = false,
  uploadNotice = null,
  onQueryChange,
  onExpandRelatedKeywordsChange,
  onSearch,
  onClear,
  onPageChange,
  onDocumentClick,
  onUploadFiles,
  onStatusClick,
  onHomeClick,
  headerActions,
  recentFooter,
}: SearchPageProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [keyboardFocusIndex, setKeyboardFocusIndex] = useState<number | null>(
    null,
  );
  const hasQuery = hasActiveSearch ?? Boolean(query);
  const documents = (hasQuery ? searchResults : recentDocuments) ?? [];
  const hasDocuments = documents.length > 0;
  const title = hasQuery ? "Search Results" : "Recent Documents";
  const loadError = hasQuery ? searchError : listError;

  const documentIds = documents.map((doc) => doc.id).join(",");

  const documentsRef = useRef(documents);
  documentsRef.current = documents ?? [];
  const onDocumentClickRef = useRef(onDocumentClick);
  onDocumentClickRef.current = onDocumentClick;

  useEffect(() => {
    if (!hasQuery) {
      searchInputRef.current?.focus();
    }
  }, [hasQuery]);

  // Reset roving focus when the visible result set or query context changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional deps for focus reset
  useEffect(() => {
    setKeyboardFocusIndex(null);
  }, [documentIds, page, query]);

  const handleResultKeyNavigation = useCallback(
    (event: KeyboardEvent) => {
      const docs = documentsRef.current;
      if (docs.length === 0) {
        return;
      }

      if (
        event.key !== "ArrowDown" &&
        event.key !== "ArrowUp" &&
        event.key !== "Enter"
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      if (target.closest('[aria-label="Pagination"]')) {
        return;
      }

      const inSearchField =
        target.tagName === "INPUT" &&
        (target as HTMLInputElement).type === "search";

      if (event.key === "Enter" && inSearchField) {
        return;
      }

      if (event.key === "Enter") {
        const index = keyboardFocusIndex;
        if (index != null && index >= 0 && index < docs.length) {
          event.preventDefault();
          onDocumentClickRef.current?.(docs[index].id);
        }
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (inSearchField) {
          setKeyboardFocusIndex(0);
          return;
        }
        setKeyboardFocusIndex((current) => {
          const next = (current ?? -1) + 1;
          return Math.min(next, docs.length - 1);
        });
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setKeyboardFocusIndex((current) => {
          const cur = current ?? 0;
          if (cur <= 0) {
            searchInputRef.current?.focus();
            return null;
          }
          return cur - 1;
        });
      }
    },
    [keyboardFocusIndex],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleResultKeyNavigation);
    return () => {
      window.removeEventListener("keydown", handleResultKeyNavigation);
    };
  }, [handleResultKeyNavigation]);

  return (
    <FileDropSurface onFilesDrop={onUploadFiles}>
      <div className="flex min-h-screen flex-col bg-zinc-50">
        <header className="flex justify-end px-6 py-4">
          {headerActions ?? <StatusIcon onClick={onStatusClick} />}
        </header>

        <main
          className={[
            "flex flex-1 flex-col items-center px-6 pb-16 pt-10 transition-opacity duration-200",
            isNavigating ? "opacity-60" : "opacity-100",
          ].join(" ")}
        >
          <div className="flex w-full max-w-6xl flex-1 flex-col items-center">
            <div
              className={[
                "w-full max-w-3xl",
                hasQuery
                  ? "flex flex-col items-center pb-10"
                  : "flex flex-1 flex-col items-center justify-center pb-12",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={onHomeClick ?? onClear}
                className="mb-8 text-4xl font-bold tracking-tight text-neutral-900"
              >
                Kreuzact Document Search
              </button>
              <SearchBar
                ref={searchInputRef}
                size="lg"
                value={query ?? ""}
                onChange={(event) => onQueryChange?.(event.currentTarget.value)}
                onSearch={onSearch}
                onClear={onClear}
                showClearButton={Boolean(query)}
                className="w-full max-w-xl"
              />
              <label className="mt-3 flex w-full max-w-xl px-4 items-center gap-3 text-sm text-neutral-600">
                <input
                  type="checkbox"
                  checked={expandRelatedKeywords}
                  onChange={(event) =>
                    onExpandRelatedKeywordsChange?.(event.currentTarget.checked)
                  }
                  className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                />
                <span>Search related keywords</span>
              </label>
            </div>

            <div className="w-full">
              {uploadNotice ? (
                <div
                  className={[
                    "mb-6 rounded-xl px-4 py-3 text-center text-sm",
                    uploadNotice.kind === "success"
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border border-red-200 bg-red-50 text-red-800",
                  ].join(" ")}
                >
                  {uploadNotice.message}
                </div>
              ) : null}

              {loadError ? (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-800">
                  <p className="font-medium">Something went wrong</p>
                  <p className="mt-1 text-red-700">{loadError}</p>
                  <p className="mt-2 text-xs text-red-600">
                    Try refreshing the page. If the problem continues, check the
                    server logs.
                  </p>
                </div>
              ) : null}

              {hasQuery && totalResults != null && !loadError && (
                <p className="mb-6 text-center text-sm text-neutral-500">
                  {totalResults} {totalResults === 1 ? "result" : "results"}
                </p>
              )}

              {hasDocuments ? (
                <>
                  <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-neutral-400">
                    {title}
                  </p>
                  <DocumentGrid
                    documents={documents ?? []}
                    focusedIndex={keyboardFocusIndex}
                    onDocumentClick={onDocumentClick}
                  />
                  {!hasQuery ? recentFooter : null}
                  {hasQuery && (
                    <Pagination
                      page={page}
                      totalPages={totalPages}
                      onPageChange={onPageChange}
                    />
                  )}
                </>
              ) : hasQuery && !loadError ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <p className="text-lg font-medium text-neutral-700">
                    No results found
                  </p>
                  <p className="text-sm text-neutral-500">
                    Try a different search term or check the spelling.
                  </p>
                </div>
              ) : !hasQuery && !loadError ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <p className="text-lg font-medium text-neutral-700">
                    No documents yet
                  </p>
                  <p className="max-w-md text-sm text-neutral-500">
                    Use Upload or drag files onto the page to copy them into
                    your configured ingest folder. They will appear here after
                    processing.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </FileDropSurface>
  );
}

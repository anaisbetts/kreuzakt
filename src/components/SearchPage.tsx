import { useEffect, useRef } from "react";

import { DocumentCard, type DocumentCardProps } from "./DocumentCard";
import { SearchBar } from "./SearchBar";

export interface SearchPageProps {
  query?: string;
  hasActiveSearch?: boolean;
  recentDocuments?: DocumentCardProps[];
  searchResults?: DocumentCardProps[];
  totalResults?: number;
  page?: number;
  totalPages?: number;
  onQueryChange?: (query: string) => void;
  onSearch?: (query: string) => void;
  onClear?: () => void;
  onPageChange?: (page: number) => void;
  onDocumentClick?: (id: number) => void;
  onStatusClick?: () => void;
  onHomeClick?: () => void;
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
          d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
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
}: {
  documents: DocumentCardProps[];
  onDocumentClick?: (id: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          {...doc}
          variant="grid"
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
  hasActiveSearch,
  recentDocuments,
  searchResults,
  totalResults,
  page = 1,
  totalPages = 1,
  onQueryChange,
  onSearch,
  onClear,
  onPageChange,
  onDocumentClick,
  onStatusClick,
  onHomeClick,
}: SearchPageProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasQuery = hasActiveSearch ?? Boolean(query);
  const documents = hasQuery ? searchResults : recentDocuments;
  const hasDocuments = documents && documents.length > 0;
  const title = hasQuery ? "Search Results" : "Recent Documents";

  useEffect(() => {
    if (!hasQuery) {
      searchInputRef.current?.focus();
    }
  }, [hasQuery]);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="flex justify-end px-6 py-4">
        <StatusIcon onClick={onStatusClick} />
      </header>

      <main className="flex flex-1 flex-col items-center px-6 pb-16 pt-10">
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
              Docs-AI
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
          </div>

          <div className="w-full">
            {hasQuery && totalResults != null && (
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
                  documents={documents}
                  onDocumentClick={onDocumentClick}
                />
                {hasQuery && (
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    onPageChange={onPageChange}
                  />
                )}
              </>
            ) : hasQuery ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <p className="text-lg font-medium text-neutral-700">
                  No results found
                </p>
                <p className="text-sm text-neutral-500">
                  Try a different search term or check the spelling.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

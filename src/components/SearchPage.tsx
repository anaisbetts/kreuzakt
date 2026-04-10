import { SearchBar } from './SearchBar';
import { DocumentCard, type DocumentCardProps } from './DocumentCard';
import {
  SearchResultCard,
  type SearchResultCardProps,
} from './SearchResultCard';
import { Pagination } from './Pagination';

export interface SearchPageProps {
  query?: string;
  recentDocuments?: DocumentCardProps[];
  searchResults?: SearchResultCardProps[];
  totalResults?: number;
  currentPage?: number;
  totalPages?: number;
  onSearch?: (query: string) => void;
  onDocumentClick?: (id: number) => void;
  onPageChange?: (page: number) => void;
  onStatusClick?: () => void;
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

function EmptyState({
  recentDocuments,
  onSearch,
  onDocumentClick,
  onStatusClick,
}: Pick<
  SearchPageProps,
  'recentDocuments' | 'onSearch' | 'onDocumentClick' | 'onStatusClick'
>) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="flex justify-end px-6 py-4">
        <StatusIcon onClick={onStatusClick} />
      </header>

      <div className="flex flex-1 flex-col items-center px-6 pt-16">
        <h1 className="mb-8 text-4xl font-bold tracking-tight text-neutral-900">
          Docs-AI
        </h1>
        <SearchBar
          size="lg"
          onSearch={onSearch}
          className="w-full max-w-xl"
        />

        {recentDocuments && recentDocuments.length > 0 && (
          <div className="mt-16 w-full max-w-3xl">
            <h2 className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Recent Documents
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {recentDocuments.map((doc) => (
                <DocumentCard key={doc.id} {...doc} onClick={onDocumentClick} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveSearch({
  query,
  searchResults,
  totalResults,
  currentPage = 1,
  totalPages = 1,
  onSearch,
  onDocumentClick,
  onPageChange,
  onStatusClick,
}: Omit<SearchPageProps, 'recentDocuments'> & { query: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="flex items-center gap-4 border-b border-neutral-200 bg-white px-6 py-3">
        <span className="text-lg font-bold text-neutral-900">Docs-AI</span>
        <SearchBar
          size="sm"
          defaultValue={query}
          onSearch={onSearch}
          className="flex-1 max-w-xl"
        />
        <StatusIcon onClick={onStatusClick} />
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-6">
        {totalResults != null && (
          <p className="mb-4 text-sm text-neutral-500">
            {totalResults} {totalResults === 1 ? 'result' : 'results'}
          </p>
        )}

        {searchResults && searchResults.length > 0 ? (
          <div className="flex flex-col gap-3">
            {searchResults.map((result) => (
              <SearchResultCard
                key={result.id}
                {...result}
                onClick={onDocumentClick}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <p className="text-lg font-medium text-neutral-700">
              No documents found
            </p>
            <p className="text-sm text-neutral-500">
              Try a different search term or check the spelling.
            </p>
          </div>
        )}

        {searchResults && searchResults.length > 0 && totalPages > 1 && (
          <div className="mt-8">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export function SearchPage({
  query,
  recentDocuments,
  searchResults,
  totalResults,
  currentPage,
  totalPages,
  onSearch,
  onDocumentClick,
  onPageChange,
  onStatusClick,
}: SearchPageProps) {
  if (query) {
    return (
      <ActiveSearch
        query={query}
        searchResults={searchResults}
        totalResults={totalResults}
        currentPage={currentPage}
        totalPages={totalPages}
        onSearch={onSearch}
        onDocumentClick={onDocumentClick}
        onPageChange={onPageChange}
        onStatusClick={onStatusClick}
      />
    );
  }

  return (
    <EmptyState
      recentDocuments={recentDocuments}
      onSearch={onSearch}
      onDocumentClick={onDocumentClick}
      onStatusClick={onStatusClick}
    />
  );
}

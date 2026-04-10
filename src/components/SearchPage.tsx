import { SearchBar } from './SearchBar';
import { DocumentCard, type DocumentCardProps } from './DocumentCard';

export interface SearchPageProps {
  query?: string;
  recentDocuments?: DocumentCardProps[];
  searchResults?: DocumentCardProps[];
  totalResults?: number;
  onSearch?: (query: string) => void;
  onDocumentClick?: (id: number) => void;
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

function DocumentGrid({
  documents,
  onDocumentClick,
}: {
  documents: DocumentCardProps[];
  onDocumentClick?: (id: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {documents.map((doc) => (
        <DocumentCard key={doc.id} {...doc} onClick={onDocumentClick} />
      ))}
    </div>
  );
}

export function SearchPage({
  query,
  recentDocuments,
  searchResults,
  totalResults,
  onSearch,
  onDocumentClick,
  onStatusClick,
}: SearchPageProps) {
  const hasQuery = Boolean(query);
  const documents = hasQuery ? searchResults : recentDocuments;
  const hasDocuments = documents && documents.length > 0;

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
          defaultValue={query}
          onSearch={onSearch}
          className="w-full max-w-xl"
        />

        <div className="mt-12 w-full max-w-3xl pb-16">
          {hasQuery && totalResults != null && (
            <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-neutral-400">
              {totalResults} {totalResults === 1 ? 'result' : 'results'}
            </p>
          )}

          {!hasQuery && hasDocuments && (
            <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Recent Documents
            </p>
          )}

          {hasDocuments ? (
            <DocumentGrid
              documents={documents}
              onDocumentClick={onDocumentClick}
            />
          ) : hasQuery ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-lg font-medium text-neutral-700">
                No documents found
              </p>
              <p className="text-sm text-neutral-500">
                Try a different search term or check the spelling.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

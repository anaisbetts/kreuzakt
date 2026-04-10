export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      {pages.map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => onPageChange?.(page)}
          aria-current={page === currentPage ? 'page' : undefined}
          className={[
            'flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-medium transition-colors',
            page === currentPage
              ? 'bg-blue-600 text-white'
              : 'text-neutral-600 hover:bg-neutral-100',
          ].join(' ')}
        >
          {page}
        </button>
      ))}
      {currentPage < totalPages && (
        <button
          type="button"
          onClick={() => onPageChange?.(currentPage + 1)}
          className="flex h-8 items-center gap-1 rounded-md px-3 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
        >
          Next
          <span aria-hidden="true">&rarr;</span>
        </button>
      )}
    </nav>
  );
}

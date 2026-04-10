export interface SearchResultCardProps {
  id: number;
  title: string;
  documentDate: string;
  mimeType: string;
  snippet: string;
  onClick?: (id: number) => void;
}

const mimeIcon: Record<string, { label: string; color: string }> = {
  'application/pdf': { label: 'PDF', color: 'bg-red-100 text-red-700' },
  'image/jpeg': { label: 'IMG', color: 'bg-emerald-100 text-emerald-700' },
  'image/png': { label: 'IMG', color: 'bg-emerald-100 text-emerald-700' },
  'image/tiff': { label: 'IMG', color: 'bg-emerald-100 text-emerald-700' },
};

const fallbackIcon = { label: 'DOC', color: 'bg-blue-100 text-blue-700' };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function SearchResultCard({
  id,
  title,
  documentDate,
  mimeType,
  snippet,
  onClick,
}: SearchResultCardProps) {
  const icon = mimeIcon[mimeType] ?? fallbackIcon;

  return (
    <button
      type="button"
      onClick={() => onClick?.(id)}
      className="flex w-full gap-4 rounded-xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div
        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${icon.color}`}
      >
        {icon.label}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="truncate text-sm font-medium text-neutral-900">
          {title}
        </h3>
        <time className="text-xs text-neutral-500">{formatDate(documentDate)}</time>
        <p className="line-clamp-2 text-xs leading-relaxed text-neutral-600">
          {snippet}
        </p>
      </div>
    </button>
  );
}

export interface DocumentCardProps {
  id: number;
  title: string;
  description: string;
  documentDate: string;
  mimeType: string;
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
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DocumentCard({
  id,
  title,
  description,
  documentDate,
  mimeType,
  onClick,
}: DocumentCardProps) {
  const icon = mimeIcon[mimeType] ?? fallbackIcon;

  return (
    <button
      type="button"
      onClick={() => onClick?.(id)}
      className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div
        className={`flex h-20 w-full items-center justify-center rounded-lg text-sm font-semibold ${icon.color}`}
      >
        {icon.label}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="line-clamp-2 text-sm font-medium text-neutral-900">
          {title}
        </h3>
        <time className="text-xs text-neutral-500">{formatDate(documentDate)}</time>
        <p className="line-clamp-2 text-xs text-neutral-500">{description}</p>
      </div>
    </button>
  );
}

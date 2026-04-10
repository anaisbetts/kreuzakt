export interface DocumentCardProps {
  id: number;
  title: string;
  description: string;
  documentDate: string;
  mimeType: string;
  onClick?: (id: number) => void;
}

const mimeColors: Record<string, string> = {
  'application/pdf': 'bg-red-50 border-red-200',
  'image/jpeg': 'bg-emerald-50 border-emerald-200',
  'image/png': 'bg-emerald-50 border-emerald-200',
  'image/tiff': 'bg-emerald-50 border-emerald-200',
};

const mimeLineColors: Record<string, string> = {
  'application/pdf': 'bg-red-200',
  'image/jpeg': 'bg-emerald-200',
  'image/png': 'bg-emerald-200',
  'image/tiff': 'bg-emerald-200',
};

const fallbackColor = 'bg-blue-50 border-blue-200';
const fallbackLineColor = 'bg-blue-200';

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
  const bgColor = mimeColors[mimeType] ?? fallbackColor;
  const lineColor = mimeLineColors[mimeType] ?? fallbackLineColor;

  return (
    <button
      type="button"
      onClick={() => onClick?.(id)}
      className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div
        className={`flex aspect-[3/4] w-full flex-col gap-1.5 rounded-lg border p-3 ${bgColor}`}
      >
        <div className={`h-1.5 w-3/5 rounded-sm ${lineColor}`} />
        <div className={`h-1 w-2/5 rounded-sm ${lineColor} opacity-60`} />
        <div className="mt-2 flex flex-col gap-1">
          <div className={`h-1 w-full rounded-sm ${lineColor} opacity-40`} />
          <div className={`h-1 w-full rounded-sm ${lineColor} opacity-40`} />
          <div className={`h-1 w-4/5 rounded-sm ${lineColor} opacity-40`} />
        </div>
        <div className="mt-1.5 flex flex-col gap-1">
          <div className={`h-1 w-full rounded-sm ${lineColor} opacity-40`} />
          <div className={`h-1 w-3/4 rounded-sm ${lineColor} opacity-40`} />
        </div>
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

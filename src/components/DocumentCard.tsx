import type { ReactNode } from "react";

export interface DocumentCardProps {
  id: number;
  title: string;
  description: string;
  documentDate: string;
  mimeType: string;
  snippet?: string;
  thumbnailUrl?: string;
  variant?: "grid" | "list";
  onClick?: (id: number) => void;
}

const mimeColors: Record<string, string> = {
  "application/pdf": "bg-red-50 border-red-200",
  "image/jpeg": "bg-emerald-50 border-emerald-200",
  "image/png": "bg-emerald-50 border-emerald-200",
  "image/tiff": "bg-emerald-50 border-emerald-200",
};

const mimeLineColors: Record<string, string> = {
  "application/pdf": "bg-red-200",
  "image/jpeg": "bg-emerald-200",
  "image/png": "bg-emerald-200",
  "image/tiff": "bg-emerald-200",
};

const fallbackColor = "bg-blue-50 border-blue-200";
const fallbackLineColor = "bg-blue-200";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function renderHighlightedSnippet(snippet: string) {
  const parts = snippet.split(/(\[\[\[|\]\]\])/g);
  const nodes: ReactNode[] = [];
  let isHighlighted = false;

  for (const part of parts) {
    if (part === "[[[") {
      isHighlighted = true;
      continue;
    }

    if (part === "]]]") {
      isHighlighted = false;
      continue;
    }

    if (!part) {
      continue;
    }

    nodes.push(
      isHighlighted ? (
        <mark
          key={`${part}-${nodes.length}`}
          className="rounded bg-yellow-100 px-0.5 text-inherit"
        >
          {part}
        </mark>
      ) : (
        <span key={`${part}-${nodes.length}`}>{part}</span>
      ),
    );
  }

  return nodes;
}

function ThumbnailPlaceholder({ mimeType }: { mimeType: string }) {
  const bgColor = mimeColors[mimeType] ?? fallbackColor;
  const lineColor = mimeLineColors[mimeType] ?? fallbackLineColor;

  return (
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
  );
}

function Thumbnail({
  mimeType,
  thumbnailUrl,
  compact = false,
}: {
  mimeType: string;
  thumbnailUrl?: string;
  compact?: boolean;
}) {
  const className = compact
    ? "aspect-[3/4] h-28 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white"
    : "w-full";

  if (!thumbnailUrl) {
    return (
      <div className={className}>
        <ThumbnailPlaceholder mimeType={mimeType} />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* biome-ignore lint/performance/noImgElement: same-origin API thumbnails; Next/Image adds little here */}
      <img
        src={thumbnailUrl}
        alt=""
        className="h-full w-full rounded-lg object-cover"
      />
    </div>
  );
}

export function DocumentCard({
  id,
  title,
  description,
  documentDate,
  mimeType,
  snippet,
  thumbnailUrl,
  variant = "grid",
  onClick,
}: DocumentCardProps) {
  if (variant === "list") {
    return (
      <button
        type="button"
        onClick={() => onClick?.(id)}
        className="flex w-full flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md sm:flex-row"
      >
        <Thumbnail mimeType={mimeType} thumbnailUrl={thumbnailUrl} compact />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h3 className="text-lg font-medium text-neutral-900">{title}</h3>
          <time className="text-sm text-neutral-500">
            {formatDate(documentDate)}
          </time>
          <p className="line-clamp-2 text-sm text-neutral-600">{description}</p>
          {snippet && (
            <p className="text-sm leading-6 text-neutral-600">
              {renderHighlightedSnippet(snippet)}
            </p>
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClick?.(id)}
      className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <Thumbnail mimeType={mimeType} thumbnailUrl={thumbnailUrl} />
      <div className="flex flex-col gap-1">
        <h3 className="line-clamp-2 text-sm font-medium text-neutral-900">
          {title}
        </h3>
        <time className="text-xs text-neutral-500">
          {formatDate(documentDate)}
        </time>
        <p className="line-clamp-2 text-xs text-neutral-500">{description}</p>
      </div>
    </button>
  );
}

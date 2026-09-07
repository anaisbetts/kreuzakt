"use client";

import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { formatDateShort } from "@/lib/format-date";

export interface DocumentCardProps {
  id: number;
  title: string;
  description: string;
  documentDate: string;
  mimeType: string;
  snippet?: string;
  thumbnailUrl?: string;
  variant?: "grid" | "list";
  /** When using arrow-key navigation on the search page */
  isKeyboardFocused?: boolean;
  onClick?: (id: number) => void;
}

const formatDate = formatDateShort;

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
          className="rounded-[2px] bg-highlight px-0.5 text-ink"
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

function ThumbnailMissing({ compact }: { compact?: boolean }) {
  const box = compact ? "aspect-[3/4] h-28 shrink-0" : "aspect-[3/4] w-full";

  return (
    <div
      className={`flex ${box} items-center justify-center overflow-hidden rounded-field border border-line bg-canvas-deep text-ink-mute`}
      aria-hidden
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1}
        stroke="currentColor"
        className={compact ? "h-10 w-10 opacity-80" : "h-14 w-14 opacity-80"}
      >
        <title>No preview</title>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
    </div>
  );
}

function Thumbnail({
  documentId,
  thumbnailUrl,
  compact = false,
}: {
  documentId: number;
  thumbnailUrl?: string;
  compact?: boolean;
}) {
  const [loadFailed, setLoadFailed] = useState(false);
  const mountedRef = useRef(true);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** Edge and lazy-loading quirks can skip `onError`; catch zero-size decodes. */
  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img || !thumbnailUrl || loadFailed) {
      return;
    }

    function verify() {
      if (!mountedRef.current) {
        return;
      }
      const el = imgRef.current;
      if (!el) {
        return;
      }
      if (el.complete && el.naturalWidth === 0) {
        setLoadFailed(true);
      }
    }

    verify();
    img.addEventListener("load", verify);
    img.addEventListener("error", verify);
    return () => {
      img.removeEventListener("load", verify);
      img.removeEventListener("error", verify);
    };
  }, [thumbnailUrl, loadFailed]);

  const className = compact
    ? "aspect-[3/4] h-28 shrink-0 overflow-hidden rounded-field border border-line bg-canvas-deep"
    : "aspect-[3/4] w-full overflow-hidden rounded-field border border-line bg-canvas-deep";

  if (!thumbnailUrl || loadFailed) {
    return (
      <div className={className}>
        <ThumbnailMissing compact={compact} />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* biome-ignore lint/performance/noImgElement: same-origin API thumbnails; Next/Image adds little here */}
      <img
        ref={imgRef}
        key={`${documentId}-${thumbnailUrl}`}
        src={thumbnailUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={() => setLoadFailed(false)}
        onError={() => {
          if (mountedRef.current) {
            setLoadFailed(true);
          }
        }}
        className="h-full w-full rounded-field object-contain object-top"
      />
    </div>
  );
}

export function DocumentCard({
  id,
  title,
  description,
  documentDate,
  mimeType: _mimeType,
  snippet,
  thumbnailUrl,
  variant = "grid",
  isKeyboardFocused = false,
  onClick,
}: DocumentCardProps) {
  if (variant === "list") {
    return (
      <button
        type="button"
        onClick={() => onClick?.(id)}
        className="flex w-full flex-col gap-4 rounded-card border border-line bg-surface p-4 text-left shadow-card transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-raise sm:flex-row"
      >
        <Thumbnail documentId={id} thumbnailUrl={thumbnailUrl} compact />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h3 className="text-lg font-medium text-ink">{title}</h3>
          <time className="text-sm tabular-nums text-ink-mute">
            {formatDate(documentDate)}
          </time>
          <p className="line-clamp-2 text-sm text-ink-soft">{description}</p>
          {snippet && (
            <p className="text-sm leading-6 text-ink-soft">
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
      className={[
        "flex w-full flex-col gap-4 rounded-card border bg-surface p-4 text-left shadow-card transition-[border-color,box-shadow] hover:border-accent-line hover:shadow-raise",
        isKeyboardFocused
          ? "border-accent ring-2 ring-accent/25"
          : "border-line",
      ].join(" ")}
    >
      <Thumbnail documentId={id} thumbnailUrl={thumbnailUrl} />
      <div className="flex w-full flex-col gap-2">
        <h3 className="line-clamp-2 text-base font-medium text-ink">{title}</h3>
        <time className="text-sm tabular-nums text-ink-mute">
          {formatDate(documentDate)}
        </time>
        <p className="line-clamp-2 text-sm text-ink-soft">{description}</p>
        {snippet && (
          <p className="line-clamp-4 text-sm leading-6 text-ink-soft">
            {renderHighlightedSnippet(snippet)}
          </p>
        )}
      </div>
    </button>
  );
}

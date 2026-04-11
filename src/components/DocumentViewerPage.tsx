import type { ReactNode } from "react";

export interface DocumentViewerProps {
  id: number;
  title: string;
  description: string;
  documentDate: string;
  addedAt: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  pageCount?: number;
  currentPage?: number;
  content: string;
  showExtractedText?: boolean;
  onBack?: () => void;
  onDownload?: (id: number) => void;
  onToggleText?: () => void;
  onPageChange?: (page: number) => void;
  onStatusClick?: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PDFPreview({
  filename,
  currentPage = 1,
  pageCount,
}: {
  filename: string;
  currentPage?: number;
  pageCount?: number;
}) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-neutral-200 bg-neutral-800 overflow-hidden">
      <div className="flex items-center gap-2 bg-neutral-700 px-4 py-2">
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-4 w-4 text-neutral-400"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
        <span className="text-xs text-neutral-300">{filename}</span>
        {pageCount != null && (
          <span className="ml-auto text-xs text-neutral-500">
            {currentPage} / {pageCount}
          </span>
        )}
      </div>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex aspect-[8.5/11] w-full max-w-md flex-col rounded bg-white shadow-2xl">
          <div className="flex flex-1 flex-col gap-2 p-10">
            <div className="h-3 w-2/5 rounded bg-neutral-200" />
            <div className="h-2 w-1/4 rounded bg-neutral-100" />
            <div className="mt-6 h-2 w-full rounded bg-neutral-100" />
            <div className="h-2 w-full rounded bg-neutral-100" />
            <div className="h-2 w-3/4 rounded bg-neutral-100" />
            <div className="mt-4 h-2 w-full rounded bg-neutral-100" />
            <div className="h-2 w-full rounded bg-neutral-100" />
            <div className="h-2 w-5/6 rounded bg-neutral-100" />
            <div className="mt-4 h-2 w-full rounded bg-neutral-100" />
            <div className="h-2 w-2/3 rounded bg-neutral-100" />
            <div className="mt-auto h-2 w-1/3 rounded bg-neutral-200" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ImagePreview({ filename }: { filename: string }) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-neutral-200 bg-neutral-900 overflow-hidden">
      <div className="flex items-center gap-2 bg-neutral-800 px-4 py-2">
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-4 w-4 text-neutral-400"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
          />
        </svg>
        <span className="text-xs text-neutral-300">{filename}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="text-xs text-neutral-400 hover:text-neutral-200"
          >
            -
          </button>
          <span className="text-xs text-neutral-500">100%</span>
          <button
            type="button"
            className="text-xs text-neutral-400 hover:text-neutral-200"
          >
            +
          </button>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="relative flex aspect-[3/4] max-h-[80%] w-auto items-center justify-center overflow-hidden rounded shadow-2xl ring-1 ring-white/10">
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-200" />
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={0.75}
            stroke="currentColor"
            className="relative h-20 w-20 text-neutral-300"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

const pageSkeletonVariants = [
  { heading: "w-2/5", sub: "w-1/4", lines: ["w-full", "w-full", "w-3/4"] },
  { heading: "w-1/3", sub: "w-2/5", lines: ["w-full", "w-5/6", "w-full"] },
  { heading: "w-3/5", sub: "w-1/3", lines: ["w-4/5", "w-full", "w-2/3"] },
  { heading: "w-1/2", sub: "w-1/4", lines: ["w-full", "w-full", "w-4/5"] },
  { heading: "w-2/5", sub: "w-1/3", lines: ["w-full", "w-3/4", "w-full"] },
];

function PageThumbnailStrip({
  pageCount,
  currentPage = 1,
  onPageChange,
}: {
  pageCount: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}) {
  return (
    <div className="flex w-20 shrink-0 flex-col gap-3 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-100 p-2">
      {Array.from({ length: pageCount }, (_, i) => {
        const page = i + 1;
        const variant = pageSkeletonVariants[i % pageSkeletonVariants.length];
        const isActive = page === currentPage;
        return (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange?.(page)}
            className={[
              "flex flex-col items-center gap-1",
              isActive ? "opacity-100" : "opacity-60 hover:opacity-80",
            ].join(" ")}
          >
            <div
              className={[
                "flex aspect-[3/4] w-full flex-col gap-0.5 rounded border bg-white p-1.5 shadow-sm transition-all",
                isActive
                  ? "ring-2 ring-blue-500 border-blue-300"
                  : "border-neutral-200 hover:border-neutral-300",
              ].join(" ")}
            >
              <div
                className={`h-0.5 ${variant.heading} rounded-sm bg-neutral-300`}
              />
              <div
                className={`h-0.5 ${variant.sub} rounded-sm bg-neutral-200`}
              />
              <div className="mt-1 flex flex-col gap-px">
                {variant.lines.map((w, li) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder lines; order is fixed
                    key={li}
                    className={`h-px ${w} rounded-sm bg-neutral-200`}
                  />
                ))}
              </div>
            </div>
            <span
              className={[
                "text-[10px]",
                isActive ? "font-medium text-blue-600" : "text-neutral-500",
              ].join(" ")}
            >
              {page}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TextPreview({ content }: { content: string }) {
  return (
    <div className="h-full overflow-auto rounded-lg bg-neutral-50 p-6">
      <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-neutral-700">
        {content}
      </pre>
    </div>
  );
}

function MetadataField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </dt>
      <dd className="text-sm text-neutral-700">{children}</dd>
    </div>
  );
}

export function DocumentViewerPage({
  id,
  title,
  description,
  documentDate,
  addedAt,
  originalFilename,
  mimeType,
  fileSize,
  pageCount,
  currentPage = 1,
  content,
  showExtractedText = false,
  onBack,
  onDownload,
  onToggleText,
  onPageChange,
  onStatusClick,
}: DocumentViewerProps) {
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const showPageStrip =
    !showExtractedText && pageCount != null && pageCount > 1;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Back to search
        </button>
        <button
          type="button"
          onClick={onStatusClick}
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
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-6 py-6">
        <div className="flex flex-1 gap-3 min-h-[600px]">
          {showPageStrip && pageCount != null ? (
            <PageThumbnailStrip
              pageCount={pageCount}
              currentPage={currentPage}
              onPageChange={onPageChange}
            />
          ) : null}
          <div className="flex-1">
            {showExtractedText ? (
              <TextPreview content={content} />
            ) : isPdf ? (
              <PDFPreview
                filename={originalFilename}
                currentPage={currentPage}
                pageCount={pageCount}
              />
            ) : isImage ? (
              <ImagePreview filename={originalFilename} />
            ) : (
              <TextPreview content={content} />
            )}
          </div>
        </div>

        <aside className="w-80 shrink-0">
          <div className="flex flex-col gap-5 rounded-xl border border-neutral-200 bg-white p-6">
            <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>

            <dl className="flex flex-col gap-4">
              <MetadataField label="Description">{description}</MetadataField>
              <MetadataField label="Document Date">
                {formatDate(documentDate)}
              </MetadataField>
              <MetadataField label="Added">{formatDate(addedAt)}</MetadataField>
              <MetadataField label="Original File">
                <span className="font-mono text-xs">{originalFilename}</span>
              </MetadataField>
              <MetadataField label="Size">
                {formatFileSize(fileSize)}
                {pageCount != null && ` · ${pageCount} pages`}
              </MetadataField>
            </dl>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => onDownload?.(id)}
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <svg
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                Download
              </button>
              <button
                type="button"
                onClick={onToggleText}
                className="flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                <svg
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
                {showExtractedText ? "View Document" : "View Text"}
              </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

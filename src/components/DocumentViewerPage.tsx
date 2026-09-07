import type { ReactNode } from "react";

import { formatDateLong } from "@/lib/format-date";
import { AppHeaderActions } from "./AppHeaderActions";
import { FileDropSurface } from "./FileDropSurface";

type UploadNotice = {
  kind: "success" | "error";
  message: string;
} | null;

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
  onUploadFiles?: (files: File[]) => void | Promise<void>;
  isUploading?: boolean;
  uploadNotice?: UploadNotice;
  headerActions?: ReactNode;
  onDeleteDocument?: () => void | Promise<void>;
  isDeleting?: boolean;
  deleteError?: string | null;
  onRescanDocument?: () => void | Promise<void>;
  isRescanning?: boolean;
  rescanError?: string | null;
}

const formatDate = formatDateLong;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PDFPreview({
  id,
  filename,
  currentPage = 1,
  pageCount,
}: {
  id: number;
  filename: string;
  currentPage?: number;
  pageCount?: number;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-card border border-ink bg-ink">
      <div className="flex items-center gap-2 border-b border-ink-soft bg-ink px-4 py-2">
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-4 w-4 text-canvas/70"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
        <span className="text-xs text-canvas/85">{filename}</span>
        {pageCount != null && (
          <span className="ml-auto text-xs tabular-nums text-canvas/60">
            {currentPage} / {pageCount}
          </span>
        )}
      </div>
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-2 max-md:block max-md:overflow-x-hidden max-md:overflow-y-auto max-md:p-0">
          {/* biome-ignore lint/performance/noImgElement: same-origin API page images */}
          <img
            src={`/api/documents/${id}/pages/${currentPage}/image`}
            alt={`${filename} page ${currentPage}`}
            className="max-h-full max-w-full rounded-field bg-white object-contain shadow-raise max-md:max-h-none max-md:w-full max-md:rounded-none"
          />
        </div>
      </div>
    </div>
  );
}

function ImagePreview({ id, filename }: { id: number; filename: string }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-card border border-ink bg-ink">
      <div className="flex items-center gap-2 border-b border-ink-soft bg-ink px-4 py-2">
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-4 w-4 text-canvas/70"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
          />
        </svg>
        <span className="text-xs text-canvas/85">{filename}</span>
      </div>
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-2 max-md:block max-md:overflow-x-hidden max-md:overflow-y-auto max-md:p-0">
          {/* biome-ignore lint/performance/noImgElement: same-origin API page images */}
          <img
            src={`/api/documents/${id}/pages/1/image`}
            alt={filename}
            className="max-h-full max-w-full rounded-field object-contain shadow-raise ring-1 ring-canvas/10 max-md:max-h-none max-md:w-full max-md:rounded-none"
          />
        </div>
      </div>
    </div>
  );
}

function PageThumbnailStrip({
  id,
  pageCount,
  currentPage = 1,
  onPageChange,
}: {
  id: number;
  pageCount: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}) {
  return (
    <div
      className={[
        "flex shrink-0 gap-3 rounded-card border border-line bg-canvas-deep p-2",
        "flex-row overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch]",
        "md:w-20 md:flex-col md:overflow-x-hidden md:overflow-y-auto",
      ].join(" ")}
    >
      {Array.from({ length: pageCount }, (_, i) => {
        const page = i + 1;
        const isActive = page === currentPage;
        return (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange?.(page)}
            className={[
              "flex shrink-0 flex-col items-center gap-1",
              isActive ? "opacity-100" : "opacity-60 hover:opacity-80",
            ].join(" ")}
          >
            <div
              className={[
                "aspect-[3/4] w-14 overflow-hidden rounded-field border bg-white shadow-card transition-all md:w-full",
                isActive
                  ? "border-accent ring-2 ring-accent"
                  : "border-line hover:border-line-strong",
              ].join(" ")}
            >
              {/* biome-ignore lint/performance/noImgElement: same-origin API thumbnails */}
              <img
                src={`/api/documents/${id}/pages/${page}/thumbnail`}
                alt={`Page ${page}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <span
              className={[
                "text-[10px] tabular-nums",
                isActive ? "font-medium text-accent" : "text-ink-mute",
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
    <div className="h-full overflow-auto rounded-card border border-line bg-surface-sunken p-6">
      <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-ink-soft">
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
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-mute">
        {label}
      </dt>
      <dd className="text-sm text-ink-soft">{children}</dd>
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
  onUploadFiles,
  isUploading = false,
  uploadNotice = null,
  headerActions,
  onDeleteDocument,
  isDeleting = false,
  deleteError = null,
  onRescanDocument,
  isRescanning = false,
  rescanError = null,
}: DocumentViewerProps) {
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const showPageStrip =
    !showExtractedText && pageCount != null && pageCount > 1;

  return (
    <FileDropSurface onFilesDrop={onUploadFiles}>
      <div className="flex h-screen flex-col overflow-hidden bg-canvas">
        <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-deep"
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
          {headerActions ?? (
            <AppHeaderActions
              isUploading={isUploading}
              onUploadFiles={onUploadFiles}
              onStatusClick={onStatusClick}
            />
          )}
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 overflow-y-auto px-2 py-4 min-h-0 md:flex-row md:gap-6 md:overflow-hidden md:px-6 md:py-6">
          <div className="flex flex-1 flex-col gap-3 max-md:flex-none md:min-h-0 md:flex-1 md:flex-row">
            {showPageStrip && pageCount != null ? (
              <PageThumbnailStrip
                id={id}
                pageCount={pageCount}
                currentPage={currentPage}
                onPageChange={onPageChange}
              />
            ) : null}
            <div className="flex min-h-0 flex-1 flex-col max-md:h-[62dvh] max-md:min-h-[45dvh] max-md:flex-none md:min-h-0">
              {uploadNotice ? (
                <div
                  className={[
                    "mb-4 rounded-card border px-4 py-3 text-center text-sm",
                    uploadNotice.kind === "success"
                      ? "border-success-line bg-success-tint text-success"
                      : "border-danger-line bg-danger-tint text-danger",
                  ].join(" ")}
                >
                  {uploadNotice.message}
                </div>
              ) : null}
              {showExtractedText ? (
                <TextPreview content={content} />
              ) : isPdf ? (
                <PDFPreview
                  id={id}
                  filename={originalFilename}
                  currentPage={currentPage}
                  pageCount={pageCount}
                />
              ) : isImage ? (
                <ImagePreview id={id} filename={originalFilename} />
              ) : (
                <TextPreview content={content} />
              )}
            </div>
          </div>

          <aside className="w-full min-w-0 shrink-0 md:flex md:h-full md:min-h-0 md:w-80 md:flex-col">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-card border border-line bg-surface md:min-h-0">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden overscroll-y-contain p-6 [-webkit-overflow-scrolling:touch]">
                <h1 className="font-display text-lg font-semibold text-ink">
                  {title}
                </h1>

                <dl className="flex flex-col gap-4">
                  <MetadataField label="Description">
                    {description}
                  </MetadataField>
                  <MetadataField label="Document Date">
                    {formatDate(documentDate)}
                  </MetadataField>
                  <MetadataField label="Added">
                    {formatDate(addedAt)}
                  </MetadataField>
                  <MetadataField label="Original File">
                    <span className="font-mono text-xs">
                      {originalFilename}
                    </span>
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
                    className="btn btn-primary px-4 py-2.5"
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
                    disabled={isRescanning || !onRescanDocument}
                    onClick={() => void onRescanDocument?.()}
                    className="btn btn-secondary px-4 py-2.5"
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
                        d="M16.023 9.348h4.992V4.356m-.983 4.992A9 9 0 105.477 19.644M3 19.644h4.992v-4.992"
                      />
                    </svg>
                    {isRescanning ? "Regenerating…" : "Regenerate Metadata"}
                  </button>
                  {rescanError ? (
                    <p className="text-center text-xs text-danger">
                      {rescanError}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={onToggleText}
                    className="btn btn-secondary px-4 py-2.5"
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
                  <button
                    type="button"
                    disabled={isDeleting || !onDeleteDocument}
                    onClick={() => void onDeleteDocument?.()}
                    className="btn btn-destructive px-4 py-2.5"
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
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                      />
                    </svg>
                    {isDeleting ? "Deleting…" : "Delete Document"}
                  </button>
                  {deleteError ? (
                    <p className="text-center text-xs text-danger">
                      {deleteError}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </FileDropSurface>
  );
}

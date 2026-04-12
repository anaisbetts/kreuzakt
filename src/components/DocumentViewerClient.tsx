"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  DocumentViewerPage,
  type DocumentViewerProps,
} from "./DocumentViewerPage";
import { useIngestUpload } from "./useIngestUpload";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export interface DocumentViewerClientProps
  extends Omit<
    DocumentViewerProps,
    | "showExtractedText"
    | "onBack"
    | "onDownload"
    | "onToggleText"
    | "onPageChange"
    | "onStatusClick"
    | "headerActions"
  > {}

export function DocumentViewerClient({
  currentPage: initialPage,
  mimeType,
  pageCount,
  ...viewerProps
}: DocumentViewerClientProps) {
  const router = useRouter();
  const [showExtractedText, setShowExtractedText] = useState(false);
  const [currentPage, setCurrentPage] = useState(initialPage ?? 1);
  const { isUploading, notice, uploadFiles } = useIngestUpload();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) {
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (showExtractedText) {
          setShowExtractedText(false);
        } else {
          router.back();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        setShowExtractedText(true);
        return;
      }

      if (showExtractedText) {
        return;
      }

      if (
        mimeType !== "application/pdf" ||
        pageCount == null ||
        pageCount <= 1
      ) {
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCurrentPage((p) => Math.min(p + 1, pageCount));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCurrentPage((p) => Math.max(p - 1, 1));
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mimeType, pageCount, router, showExtractedText]);

  return (
    <DocumentViewerPage
      {...viewerProps}
      mimeType={mimeType}
      pageCount={pageCount}
      currentPage={currentPage}
      showExtractedText={showExtractedText}
      isUploading={isUploading}
      uploadNotice={notice}
      onBack={() => router.back()}
      onDownload={(id) => {
        window.location.href = `/api/documents/${id}/original`;
      }}
      onToggleText={() => setShowExtractedText((current) => !current)}
      onPageChange={setCurrentPage}
      onStatusClick={() => router.push("/settings")}
      onUploadFiles={uploadFiles}
    />
  );
}

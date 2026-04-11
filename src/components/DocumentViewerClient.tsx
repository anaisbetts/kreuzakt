"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  DocumentViewerPage,
  type DocumentViewerProps,
} from "./DocumentViewerPage";

export interface DocumentViewerClientProps
  extends Omit<
    DocumentViewerProps,
    | "showExtractedText"
    | "onBack"
    | "onDownload"
    | "onToggleText"
    | "onPageChange"
    | "onStatusClick"
  > {}

export function DocumentViewerClient(props: DocumentViewerClientProps) {
  const router = useRouter();
  const [showExtractedText, setShowExtractedText] = useState(false);
  const [currentPage, setCurrentPage] = useState(props.currentPage ?? 1);

  return (
    <DocumentViewerPage
      {...props}
      currentPage={currentPage}
      showExtractedText={showExtractedText}
      onBack={() => router.back()}
      onDownload={(id) => {
        window.location.href = `/api/documents/${id}/original`;
      }}
      onToggleText={() => setShowExtractedText((current) => !current)}
      onPageChange={setCurrentPage}
      onStatusClick={() => router.push("/status")}
    />
  );
}

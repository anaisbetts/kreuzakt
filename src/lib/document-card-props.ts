import type { DocumentCardProps } from "@/components/DocumentCard";

/** Maps API / DB document summaries to props for `DocumentCard`. */
export function toDocumentCardProps(document: {
  id: number;
  title: string;
  description: string;
  document_date: string | null;
  added_at: string;
  mime_type: string;
  thumbnail_url: string;
  snippet?: string;
}): DocumentCardProps {
  return {
    id: document.id,
    title: document.title,
    description: document.description,
    documentDate: document.document_date ?? document.added_at,
    mimeType: document.mime_type,
    thumbnailUrl: document.thumbnail_url,
    snippet: document.snippet,
  };
}

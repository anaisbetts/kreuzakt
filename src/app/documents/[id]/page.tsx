import { notFound } from "next/navigation";

import { DocumentViewerClient } from "@/components/DocumentViewerClient";
import { getDocumentById } from "@/lib/documents";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);

  if (!Number.isFinite(id) || id < 1) {
    notFound();
  }

  const document = await getDocumentById(id);

  if (!document) {
    notFound();
  }

  return (
    <DocumentViewerClient
      id={document.id}
      title={document.title}
      description={document.description}
      documentDate={document.document_date ?? document.added_at}
      addedAt={document.added_at}
      originalFilename={document.original_filename}
      mimeType={document.mime_type}
      fileSize={document.file_size}
      pageCount={document.page_count ?? undefined}
      content={document.content}
    />
  );
}

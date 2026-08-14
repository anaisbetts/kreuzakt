import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type {
  ExtractionConfig,
  FormatMetadata,
  PdfMetadata,
  ExtractedDocument as XbergExtractedDocument,
  ExtractionResult as XbergExtractionResult,
} from "@xberg-io/xberg";
import { pdf } from "pdf-to-img";

const PDF_POINTS_PER_INCH = 72;
const DEFAULT_RENDER_DPI = 150;

const projectRequire = createRequire(
  pathToFileURL(path.join(process.cwd(), "package.json")).href,
);

export interface ExtractionResult {
  content: string;
  mimeType: string;
  metadata?: {
    pageCount?: number;
  };
}

type RenderPdfPageOptions = {
  dpi?: number | null;
};

type XbergExtractInput = {
  kind: "uri" | "bytes";
  uri?: string;
  bytes?: Uint8Array;
  mimeType?: string | null;
  filename?: string | null;
};

type XbergNativeModule = {
  extract: (
    input: XbergExtractInput,
    config?: ExtractionConfig | null,
  ) => Promise<XbergExtractionResult>;
};

let nativeXberg: XbergNativeModule | null = null;

export async function extractFileWithNativeConfig(
  filePath: string,
  mimeType: string | null,
  config: ExtractionConfig | Record<string, unknown> | null,
): Promise<ExtractionResult> {
  return extractWithNativeConfig(
    {
      kind: "uri",
      uri: filePath,
      mimeType: mimeType ?? undefined,
    },
    mimeType,
    config,
  );
}

export async function extractBytesWithNativeConfig(
  bytes: Uint8Array,
  mimeType: string,
  filename: string,
  config: ExtractionConfig | Record<string, unknown> | null,
): Promise<ExtractionResult> {
  return extractWithNativeConfig(
    {
      kind: "bytes",
      bytes,
      mimeType,
      filename,
    },
    mimeType,
    config,
  );
}

export async function renderPdfPageWithNativeBinding(
  filePath: string,
  pageIndex: number,
  options?: RenderPdfPageOptions,
): Promise<Buffer> {
  const dpi = options?.dpi ?? DEFAULT_RENDER_DPI;
  const scale = dpi / PDF_POINTS_PER_INCH;
  const document = await pdf(filePath, { scale });
  const pageNumber = pageIndex + 1;

  if (document.length > 0 && pageNumber > document.length) {
    throw new Error(
      `PDF page ${pageNumber} is out of range (document has ${document.length} pages)`,
    );
  }

  const pageBuffer = await document.getPage(pageNumber);
  return Buffer.from(pageBuffer);
}

/** Render every PDF page to a PNG buffer via pdf.js (pdf-to-img). */
export async function listPdfPageBuffers(
  filePath: string,
  options?: RenderPdfPageOptions,
): Promise<Buffer[]> {
  const dpi = options?.dpi ?? DEFAULT_RENDER_DPI;
  const scale = dpi / PDF_POINTS_PER_INCH;
  const document = await pdf(filePath, { scale });
  const pages: Buffer[] = [];

  if (document.length > 0) {
    for (let pageNumber = 1; pageNumber <= document.length; pageNumber++) {
      const pageBuffer = await document.getPage(pageNumber);
      pages.push(Buffer.from(pageBuffer));
    }
    return pages;
  }

  for await (const page of document) {
    pages.push(Buffer.from(page));
  }

  return pages;
}

async function extractWithNativeConfig(
  input: XbergExtractInput,
  fallbackMimeType: string | null,
  config: ExtractionConfig | Record<string, unknown> | null,
): Promise<ExtractionResult> {
  const xberg = getNativeXberg();
  const envelope = await xberg.extract(
    input,
    config as ExtractionConfig | null,
  );
  const document = firstExtractedDocument(envelope);
  return {
    content: document.content ?? "",
    mimeType:
      document.mimeType ?? fallbackMimeType ?? "application/octet-stream",
    metadata: {
      pageCount: extractPageCount(document) ?? undefined,
    },
  };
}

function getNativeXberg(): XbergNativeModule {
  nativeXberg ??= projectRequire("@xberg-io/xberg") as XbergNativeModule;
  return nativeXberg;
}

function firstExtractedDocument(
  envelope: XbergExtractionResult,
): XbergExtractedDocument {
  const document = envelope.results?.[0];
  if (document) {
    return document;
  }

  const errorMessage =
    envelope.errors?.[0]?.message ?? "Xberg returned no extraction results";
  throw new Error(errorMessage);
}

function extractPageCount(document: XbergExtractedDocument): number | null {
  const fromCounts = document.counts?.pages;
  if (typeof fromCounts === "number" && fromCounts > 0) {
    return fromCounts;
  }

  const pdfMetadata = pdfMetadataFromFormat(document.metadata?.format);
  if (typeof pdfMetadata?.pageCount === "number") {
    return pdfMetadata.pageCount;
  }

  const additional = document.metadata?.additional;
  if (additional && typeof additional === "object") {
    const pageCount =
      (additional as Record<string, unknown>).page_count ??
      (additional as Record<string, unknown>).pageCount;
    if (typeof pageCount === "number") {
      return pageCount;
    }
  }

  return null;
}

function pdfMetadataFromFormat(
  format: FormatMetadata | undefined,
): PdfMetadata | null {
  if (!format || typeof format !== "object") {
    return null;
  }

  const record = format as FormatMetadata & {
    pdf?: PdfMetadata;
    0?: PdfMetadata;
  };

  if (record.format_type !== "pdf") {
    return null;
  }

  return record.pdf ?? record[0] ?? null;
}

import { extname } from "node:path";

import type { ExtractionConfig } from "@xberg-io/xberg";
import sharp from "sharp";

import { type AppConfig, appConfig } from "@/lib/config";

import {
  type ExtractionResult,
  extractBytesWithNativeConfig,
  extractFileWithNativeConfig,
  listPdfPageBuffers,
} from "./xberg";

/** Substring from Xberg when VLM/OCR backends fail transiently (network, rate limits). */
const TRANSIENT_OCR_PIPELINE_FAILURE = "All OCR pipeline backends failed";
/** liter-llm/reqwest surfaces aborted/truncated response bodies this way (often a client timeout). */
const TRANSIENT_VLM_BODY_DECODE_FAILURE = "error decoding response body";
const TRANSIENT_VLM_REQUEST_FAILURE = "VLM OCR request failed";
/** Xberg/pdf-oxide can "succeed" with blank canvases for some scanned image-only PDFs. */
const EMPTY_VLM_OCR_CONTENT = "VLM OCR returned no content";
const VLM_MAX_IMAGE_DIMENSION = 1200;
const PDF_OCR_RENDER_DPI = 150;
const PDF_PAGE_SEPARATOR = "\n\n";

type XbergExtractConfig = Pick<
  AppConfig,
  "ocrModel" | "ocrTimeoutSecs" | "ocrApiKey" | "ocrBaseUrl"
>;

export interface ExtractedDocument {
  content: string;
  mimeType: string;
  pageCount: number | null;
}

export async function extractDocument(
  filePath: string,
): Promise<ExtractedDocument> {
  const extractOptions = buildExtractOptions();

  if (extractOptions && isPdfPath(filePath)) {
    return extractPdfViaRasterizedPages(filePath, extractOptions);
  }

  let result: ExtractionResult;
  try {
    result = await extractFileWithNativeConfig(filePath, null, extractOptions);
  } catch (error) {
    if (!isTransientOcrFailure(error)) {
      throw error;
    }
    result = await extractFileWithNativeConfig(filePath, null, extractOptions);
  }

  return {
    content: result.content.trim(),
    mimeType: result.mimeType,
    pageCount: result.metadata?.pageCount ?? null,
  };
}

export function buildExtractOptions(
  config: XbergExtractConfig = appConfig,
): ExtractionConfig | null {
  if (!config.ocrApiKey) {
    return null;
  }

  return {
    forceOcr: true,
    images: {
      maxImageDimension: VLM_MAX_IMAGE_DIMENSION,
    },
    ocr: {
      backend: "vlm",
      vlmConfig: {
        model: config.ocrModel,
        baseUrl: config.ocrBaseUrl,
        apiKey: config.ocrApiKey,
        timeoutSecs: config.ocrTimeoutSecs,
      },
    },
  };
}

/**
 * Rasterize PDF pages with pdf.js (pdf-to-img), then VLM-OCR each page image.
 *
 * Xberg's pdf-oxide renderer can emit blank white canvases for image-only scanned
 * PDFs (embedded DCTDecode/JPEG XObjects). The VLM then follows its prompt and
 * returns empty content → "VLM OCR returned no content". Thumbnails already use
 * pdf-to-img successfully for these files, so reuse that path for OCR.
 */
async function extractPdfViaRasterizedPages(
  filePath: string,
  extractOptions: ExtractionConfig,
): Promise<ExtractedDocument> {
  const pageBuffers = await listPdfPageBuffers(filePath, {
    dpi: PDF_OCR_RENDER_DPI,
  });

  if (pageBuffers.length === 0) {
    throw new Error("PDF has no pages to OCR");
  }

  const pageTexts: string[] = [];
  for (let i = 0; i < pageBuffers.length; i++) {
    const pngBytes = await resizePageImageForVlm(pageBuffers[i]);
    const pageResult = await extractPageImageWithRetry(
      pngBytes,
      `page-${i + 1}.png`,
      extractOptions,
    );
    pageTexts.push(pageResult.content.trim());
  }

  const content = pageTexts
    .filter((text) => text.length > 0)
    .join(PDF_PAGE_SEPARATOR);
  if (!content) {
    throw new Error(
      `${EMPTY_VLM_OCR_CONTENT} (model=${extractOptions.ocr?.vlmConfig?.model ?? "unknown"}; rasterized ${pageBuffers.length} PDF page(s))`,
    );
  }

  return {
    content,
    mimeType: "application/pdf",
    pageCount: pageBuffers.length,
  };
}

async function extractPageImageWithRetry(
  pngBytes: Uint8Array,
  filename: string,
  extractOptions: ExtractionConfig,
): Promise<ExtractionResult> {
  try {
    return await extractBytesWithNativeConfig(
      pngBytes,
      "image/png",
      filename,
      extractOptions,
    );
  } catch (error) {
    if (!isTransientOcrFailure(error)) {
      throw error;
    }
    return extractBytesWithNativeConfig(
      pngBytes,
      "image/png",
      filename,
      extractOptions,
    );
  }
}

async function resizePageImageForVlm(pageBuffer: Buffer): Promise<Uint8Array> {
  const resized = await sharp(pageBuffer)
    .rotate()
    .resize({
      width: VLM_MAX_IMAGE_DIMENSION,
      height: VLM_MAX_IMAGE_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
  return new Uint8Array(resized);
}

function isPdfPath(filePath: string): boolean {
  return extname(filePath).toLowerCase() === ".pdf";
}

function isTransientOcrFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message;
  return (
    message.includes(TRANSIENT_OCR_PIPELINE_FAILURE) ||
    message.includes(TRANSIENT_VLM_BODY_DECODE_FAILURE) ||
    message.includes(TRANSIENT_VLM_REQUEST_FAILURE)
  );
}

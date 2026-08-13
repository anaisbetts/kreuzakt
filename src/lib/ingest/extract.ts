import type { ExtractionConfig } from "@xberg-io/xberg";

import { type AppConfig, appConfig } from "@/lib/config";

import { type ExtractionResult, extractFileWithNativeConfig } from "./xberg";

/** Substring from Xberg when VLM/OCR backends fail transiently (network, rate limits). */
const TRANSIENT_OCR_PIPELINE_FAILURE = "All OCR pipeline backends failed";
/** liter-llm/reqwest surfaces aborted/truncated response bodies this way (often a client timeout). */
const TRANSIENT_VLM_BODY_DECODE_FAILURE = "error decoding response body";
const TRANSIENT_VLM_REQUEST_FAILURE = "VLM OCR request failed";
const VLM_MAX_IMAGE_DIMENSION = 1200;

type XbergExtractConfig = Pick<
  AppConfig,
  "ocrModel" | "ocrTimeoutSecs" | "openaiApiKey" | "openaiBaseUrl"
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
  if (!config.openaiApiKey) {
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
        baseUrl: config.openaiBaseUrl,
        apiKey: config.openaiApiKey,
        timeoutSecs: config.ocrTimeoutSecs,
      },
    },
  };
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

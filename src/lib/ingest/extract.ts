import { type ExtractionResult, ParsingError } from "@kreuzberg/node";

import { appConfig } from "@/lib/config";

import { getKreuzberg } from "./kreuzberg";

/** Substring from Kreuzberg when VLM/OCR backends fail transiently (network, rate limits). */
const TRANSIENT_OCR_PIPELINE_FAILURE = "All OCR pipeline backends failed";

type KreuzbergVlmConfig = {
  model: string;
  baseUrl: string;
  base_url: string;
  apiKey?: string;
  api_key?: string;
};

export interface ExtractedDocument {
  content: string;
  mimeType: string;
  pageCount: number | null;
}

function buildVlmConfig(): KreuzbergVlmConfig {
  const config: KreuzbergVlmConfig = {
    model: appConfig.ocrModel,
    baseUrl: appConfig.openaiBaseUrl,
    base_url: appConfig.openaiBaseUrl,
  };

  if (appConfig.openaiApiKey) {
    config.apiKey = appConfig.openaiApiKey;
    config.api_key = appConfig.openaiApiKey;
  }

  return config;
}

export async function extractDocument(
  filePath: string,
): Promise<ExtractedDocument> {
  const { detectMimeTypeFromPath, extractFile } = getKreuzberg();
  const mimeType = detectMimeTypeFromPath(filePath);
  const extractOptions = {
    forceOcr: true,
    force_ocr: true,
    ocr: {
      backend: "vlm",
      vlmConfig: buildVlmConfig(),
      vlm_config: buildVlmConfig(),
    },
  } as never;

  let result: ExtractionResult;
  try {
    result = await extractFile(filePath, null, extractOptions);
  } catch (error) {
    if (!isTransientOcrPipelineFailure(error)) {
      throw error;
    }
    result = await extractFile(filePath, null, extractOptions);
  }

  const metadata = result.metadata as { pageCount?: number } | undefined;

  return {
    content: result.content.trim(),
    mimeType: result.mimeType || mimeType,
    pageCount: metadata?.pageCount ?? null,
  };
}

function isTransientOcrPipelineFailure(error: unknown): boolean {
  return (
    error instanceof ParsingError &&
    error.message.includes(TRANSIENT_OCR_PIPELINE_FAILURE)
  );
}

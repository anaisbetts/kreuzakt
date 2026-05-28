import { appConfig } from "@/lib/config";

import {
  detectMimeTypeFromPathWithNativeBinding,
  type ExtractionResult,
  extractFileWithNativeConfig,
} from "./kreuzberg";

/** Substring from Kreuzberg when VLM/OCR backends fail transiently (network, rate limits). */
const TRANSIENT_OCR_PIPELINE_FAILURE = "All OCR pipeline backends failed";
const VLM_MAX_IMAGE_DIMENSION = 1200;

type KreuzbergVlmConfig = {
  model: string;
  baseUrl: string;
  base_url: string;
  apiKey?: string;
  api_key?: string;
};

type KreuzbergImageExtractionConfig = {
  maxImageDimension: number;
  max_image_dimension: number;
};

type KreuzbergExtractOptions = {
  forceOcr: true;
  force_ocr: true;
  images: KreuzbergImageExtractionConfig;
  ocr: {
    backend: "vlm";
    vlmConfig: KreuzbergVlmConfig;
    vlm_config: KreuzbergVlmConfig;
  };
};

export interface ExtractedDocument {
  content: string;
  mimeType: string;
  pageCount: number | null;
}

export async function extractDocument(
  filePath: string,
): Promise<ExtractedDocument> {
  const mimeType = await detectMimeTypeFromPathWithNativeBinding(filePath);
  const extractOptions = buildExtractOptions();

  let result: ExtractionResult;
  try {
    result = await extractFileWithNativeConfig(filePath, null, extractOptions);
  } catch (error) {
    if (!isTransientOcrPipelineFailure(error)) {
      throw error;
    }
    result = await extractFileWithNativeConfig(filePath, null, extractOptions);
  }

  const metadata = result.metadata as { pageCount?: number } | undefined;

  return {
    content: result.content.trim(),
    mimeType: result.mimeType || mimeType,
    pageCount: metadata?.pageCount ?? null,
  };
}

function buildExtractOptions(): KreuzbergExtractOptions {
  const vlmConfig = buildVlmConfig();

  return {
    forceOcr: true,
    force_ocr: true,
    images: buildImageExtractionConfig(),
    ocr: {
      backend: "vlm",
      vlmConfig,
      vlm_config: vlmConfig,
    },
  };
}

function buildImageExtractionConfig(): KreuzbergImageExtractionConfig {
  return {
    maxImageDimension: VLM_MAX_IMAGE_DIMENSION,
    max_image_dimension: VLM_MAX_IMAGE_DIMENSION,
  };
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

function isTransientOcrPipelineFailure(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes(TRANSIENT_OCR_PIPELINE_FAILURE)
  );
}

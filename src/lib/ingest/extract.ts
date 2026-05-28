import { type AppConfig, appConfig } from "@/lib/config";

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

type KreuzbergExtractConfig = Pick<
  AppConfig,
  "ocrModel" | "openaiApiKey" | "openaiBaseUrl"
>;

type KreuzbergVlmExtractOptions = {
  forceOcr: true;
  force_ocr: true;
  images: KreuzbergImageExtractionConfig;
  ocr: {
    backend: "vlm";
    vlmConfig: KreuzbergVlmConfig;
    vlm_config: KreuzbergVlmConfig;
  };
};

type KreuzbergExtractOptions = KreuzbergVlmExtractOptions | null;

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

export function buildExtractOptions(
  config: KreuzbergExtractConfig = appConfig,
): KreuzbergExtractOptions {
  if (!config.openaiApiKey) {
    return null;
  }

  const vlmConfig = buildVlmConfig(config);

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

function buildVlmConfig(config: KreuzbergExtractConfig): KreuzbergVlmConfig {
  const vlmConfig: KreuzbergVlmConfig = {
    model: config.ocrModel,
    baseUrl: config.openaiBaseUrl,
    base_url: config.openaiBaseUrl,
    apiKey: config.openaiApiKey,
    api_key: config.openaiApiKey,
  };

  return vlmConfig;
}

function isTransientOcrPipelineFailure(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes(TRANSIENT_OCR_PIPELINE_FAILURE)
  );
}

import {
  type AppConfig,
  appConfig,
  isOpenRouterBaseUrl,
  localVlmProxyBaseUrl,
} from "@/lib/config";

import {
  detectMimeTypeFromPathWithNativeBinding,
  type ExtractionResult,
  extractFileWithNativeConfig,
} from "./kreuzberg";

/** Substring from Kreuzberg when VLM/OCR backends fail transiently (network, rate limits). */
const TRANSIENT_OCR_PIPELINE_FAILURE = "All OCR pipeline backends failed";
/** liter-llm/reqwest surfaces aborted/truncated OpenRouter bodies this way (often a client timeout). */
const TRANSIENT_VLM_BODY_DECODE_FAILURE = "error decoding response body";
const TRANSIENT_VLM_REQUEST_FAILURE = "VLM OCR request failed";
const VLM_MAX_IMAGE_DIMENSION = 1200;

type KreuzbergVlmConfig = {
  model: string;
  baseUrl: string;
  base_url: string;
  apiKey?: string;
  api_key?: string;
  timeoutSecs: number;
  timeout_secs: number;
};

type KreuzbergImageExtractionConfig = {
  maxImageDimension: number;
  max_image_dimension: number;
};

type KreuzbergExtractConfig = Pick<
  AppConfig,
  "ocrModel" | "ocrTimeoutSecs" | "openaiApiKey" | "openaiBaseUrl" | "port"
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
    if (!isTransientOcrFailure(error)) {
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
  const baseUrl = resolveVlmBaseUrl(config);

  return {
    model: config.ocrModel,
    baseUrl,
    base_url: baseUrl,
    apiKey: config.openaiApiKey,
    api_key: config.openaiApiKey,
    timeoutSecs: config.ocrTimeoutSecs,
    timeout_secs: config.ocrTimeoutSecs,
  };
}

function resolveVlmBaseUrl(config: KreuzbergExtractConfig): string {
  // OpenRouter reasoning models need a local shim; Kreuzberg cannot send
  // `reasoning: { effort: "none" }` through liter-llm 1.3 / Kreuzberg 4.9.8.
  if (isOpenRouterBaseUrl(config.openaiBaseUrl)) {
    return localVlmProxyBaseUrl(config.port);
  }

  return config.openaiBaseUrl;
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

import { appConfig } from "@/lib/config";

import { getKreuzberg } from "./kreuzberg";

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
  const result = await extractFile(filePath, null, {
    forceOcr: true,
    force_ocr: true,
    ocr: {
      backend: "vlm",
      vlmConfig: buildVlmConfig(),
      vlm_config: buildVlmConfig(),
    },
  } as never);

  const metadata = result.metadata as { pageCount?: number } | undefined;

  return {
    content: result.content.trim(),
    mimeType: result.mimeType || mimeType,
    pageCount: metadata?.pageCount ?? null,
  };
}

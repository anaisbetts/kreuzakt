import { appConfig } from "../src/lib/config";

import type { BackendConfig } from "./types";

/** Matches Kreuzberg `LlmConfig` / Node `vlmConfig` (see LLM integration docs). */
type VlmLlmConfig = {
  model: string;
  baseUrl: string;
  base_url: string;
  apiKey?: string;
  api_key?: string;
};

const OPENROUTER_BASE = process.env.OPENAI_BASE_URL ?? appConfig.openaiBaseUrl;

/** Prefer dedicated OpenRouter key; fall back to generic OpenAI-compatible key. */
function openRouterApiKey() {
  return process.env.OPENROUTER_KEY ?? process.env.OPENAI_API_KEY ?? "";
}

/** Default matches app (`src/lib/config.ts`) and spec. */
const QWEN_OPENROUTER_MODEL =
  process.env.QWEN_VLM_MODEL ??
  process.env.OCR_VLM_MODEL ??
  "qwen/qwen3.5-122b-a10b";

/**
 * Kreuzberg docs use `ocr.vlmConfig` in JS. The native validator also expects `vlm_config`.
 * We set both to the same object.
 */
function buildLlmConfig(options: {
  baseUrl: string;
  model: string;
  /** Set explicitly when the gateway expects a placeholder (e.g. single space for local). */
  apiKey?: string;
}): VlmLlmConfig {
  const { baseUrl, model, apiKey } = options;
  const llm: VlmLlmConfig = {
    model,
    baseUrl,
    base_url: baseUrl,
  };
  if (apiKey !== undefined) {
    llm.apiKey = apiKey;
    llm.api_key = apiKey;
  }
  return llm;
}

function vlmExtractionConfig(llm: VlmLlmConfig): Record<string, unknown> {
  return {
    forceOcr: true,
    force_ocr: true,
    ocr: {
      backend: "vlm",
      vlmConfig: llm,
      vlm_config: llm,
    },
  };
}

export const BACKENDS: BackendConfig[] = [
  {
    name: "tesseract",
    label: "Tesseract",
    costPerPageEstimate: 0,
    kreuzbergConfig: {
      ocr: {
        backend: "tesseract",
      },
    },
  },
  {
    name: "paddleocr",
    label: "PaddleOCR",
    costPerPageEstimate: 0,
    kreuzbergConfig: {
      ocr: {
        backend: "paddle-ocr",
      },
    },
  },
  {
    name: "vlm:qwen",
    label: "VLM Qwen 3.5 (OpenRouter)",
    costPerPageEstimate: 0.0002,
    kreuzbergConfig: vlmExtractionConfig(
      buildLlmConfig({
        baseUrl: OPENROUTER_BASE,
        model: QWEN_OPENROUTER_MODEL,
        apiKey: openRouterApiKey(),
      }),
    ),
  },
  {
    name: "vlm:claude",
    label: "VLM Claude Sonnet (OpenRouter)",
    costPerPageEstimate: 0.006,
    kreuzbergConfig: vlmExtractionConfig(
      buildLlmConfig({
        baseUrl: OPENROUTER_BASE,
        model: "anthropic/claude-sonnet-4.6",
        apiKey: openRouterApiKey(),
      }),
    ),
  },
  {
    name: "vlm:gpt54mini",
    label: "VLM GPT-5.4 Mini (OpenRouter)",
    costPerPageEstimate: 0.001,
    kreuzbergConfig: vlmExtractionConfig(
      buildLlmConfig({
        baseUrl: OPENROUTER_BASE,
        model: "openai/gpt-5.4-mini",
        apiKey: openRouterApiKey(),
      }),
    ),
  },
];

export function getBackends(names?: string[]) {
  if (!names || names.length === 0) {
    return BACKENDS;
  }

  const requested = new Set(names);
  return BACKENDS.filter((backend) => requested.has(backend.name));
}

import type { BackendConfig } from "./types";

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
    label: "VLM Qwen 3.5 122B A10B",
    costPerPageEstimate: 0.00017,
    kreuzbergConfig: {
      forceOcr: true,
      ocr: {
        backend: "vlm",
        vlmConfig: {
          model: "qwen/qwen3.5-122b-a10b",
        },
      },
    },
  },
  {
    name: "vlm:claude",
    label: "VLM Claude Sonnet",
    costPerPageEstimate: 0.006,
    kreuzbergConfig: {
      forceOcr: true,
      ocr: {
        backend: "vlm",
        vlmConfig: {
          model: "anthropic/claude-sonnet-4",
        },
      },
    },
  },
  {
    name: "vlm:gpt4o",
    label: "VLM GPT-4o",
    costPerPageEstimate: 0.0075,
    kreuzbergConfig: {
      forceOcr: true,
      ocr: {
        backend: "vlm",
        vlmConfig: {
          model: "openai/gpt-4o",
        },
      },
    },
  },
];

export function getBackends(names?: string[]) {
  if (!names || names.length === 0) {
    return BACKENDS;
  }

  const requested = new Set(names);
  return BACKENDS.filter((backend) => requested.has(backend.name));
}

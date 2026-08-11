import { describe, expect, it } from "bun:test";

import { buildExtractOptions } from "./extract";

const BASE_CONFIG = {
  ocrModel: "qwen/qwen3.7-flash",
  ocrTimeoutSecs: 300,
  openaiApiKey: "",
  openaiBaseUrl: "https://openrouter.ai/api/v1",
  port: 3000,
};

describe("buildExtractOptions", () => {
  it("uses Kreuzberg default extraction when no API key is configured", () => {
    expect(buildExtractOptions(BASE_CONFIG)).toBeNull();
  });

  it("builds VLM OCR options through the local OpenRouter reasoning shim", () => {
    const options = buildExtractOptions({
      ...BASE_CONFIG,
      openaiApiKey: "test-key",
    });

    expect(options).toMatchObject({
      forceOcr: true,
      force_ocr: true,
      images: {
        maxImageDimension: 1200,
        max_image_dimension: 1200,
      },
      ocr: {
        backend: "vlm",
        vlmConfig: {
          apiKey: "test-key",
          api_key: "test-key",
          baseUrl: "http://127.0.0.1:3000/api/vlm-proxy/v1",
          base_url: "http://127.0.0.1:3000/api/vlm-proxy/v1",
          model: "qwen/qwen3.7-flash",
          timeoutSecs: 300,
          timeout_secs: 300,
        },
      },
    });
  });

  it("keeps non-OpenRouter bases pointed at the upstream endpoint", () => {
    const options = buildExtractOptions({
      ...BASE_CONFIG,
      openaiApiKey: "test-key",
      openaiBaseUrl: "http://127.0.0.1:11434/v1",
      ocrTimeoutSecs: 120,
    });

    expect(options?.ocr.vlmConfig).toMatchObject({
      baseUrl: "http://127.0.0.1:11434/v1",
      base_url: "http://127.0.0.1:11434/v1",
      timeoutSecs: 120,
      timeout_secs: 120,
    });
  });
});

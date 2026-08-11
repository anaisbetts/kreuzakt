import { describe, expect, it } from "bun:test";

import { buildExtractOptions } from "./extract";

const BASE_CONFIG = {
  ocrModel: "qwen/qwen3.7-flash",
  ocrTimeoutSecs: 300,
  openaiApiKey: "",
  openaiBaseUrl: "https://openrouter.ai/api/v1",
};

describe("buildExtractOptions", () => {
  it("uses Kreuzberg default extraction when no API key is configured", () => {
    expect(buildExtractOptions(BASE_CONFIG)).toBeNull();
  });

  it("builds VLM OCR options when an API key is configured", () => {
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
          baseUrl: "https://openrouter.ai/api/v1",
          base_url: "https://openrouter.ai/api/v1",
          model: "qwen/qwen3.7-flash",
          timeoutSecs: 300,
          timeout_secs: 300,
        },
      },
    });
  });

  it("forwards a custom VLM timeout to Kreuzberg", () => {
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

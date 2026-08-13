import { describe, expect, it } from "bun:test";

import { buildExtractOptions } from "./extract";

const BASE_CONFIG = {
  ocrModel: "qwen/qwen3.7-flash",
  ocrTimeoutSecs: 300,
  openaiApiKey: "",
  openaiBaseUrl: "https://openrouter.ai/api/v1",
};

describe("buildExtractOptions", () => {
  it("uses Xberg default extraction when no API key is configured", () => {
    expect(buildExtractOptions(BASE_CONFIG)).toBeNull();
  });

  it("builds VLM OCR options when an API key is configured", () => {
    const options = buildExtractOptions({
      ...BASE_CONFIG,
      openaiApiKey: "test-key",
    });

    expect(options).toMatchObject({
      forceOcr: true,
      images: {
        maxImageDimension: 1200,
      },
      ocr: {
        backend: "vlm",
        vlmConfig: {
          apiKey: "test-key",
          baseUrl: "https://openrouter.ai/api/v1",
          model: "qwen/qwen3.7-flash",
          timeoutSecs: 300,
        },
      },
    });
  });

  it("forwards a custom VLM timeout to Xberg", () => {
    const options = buildExtractOptions({
      ...BASE_CONFIG,
      openaiApiKey: "test-key",
      openaiBaseUrl: "http://127.0.0.1:11434/v1",
      ocrTimeoutSecs: 120,
    });

    expect(options?.ocr?.vlmConfig).toMatchObject({
      baseUrl: "http://127.0.0.1:11434/v1",
      timeoutSecs: 120,
    });
  });
});

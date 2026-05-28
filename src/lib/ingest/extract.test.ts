import { describe, expect, it } from "bun:test";

import { buildExtractOptions } from "./extract";

const BASE_CONFIG = {
  ocrModel: "openai/gpt-5.4-mini",
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
          model: "openai/gpt-5.4-mini",
        },
      },
    });
  });
});

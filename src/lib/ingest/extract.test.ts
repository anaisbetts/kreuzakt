import { beforeEach, describe, expect, it, mock } from "bun:test";

const listPdfPageBuffers = mock(async (_filePath: string) => [
  Buffer.from("page-1-bytes"),
  Buffer.from("page-2-bytes"),
]);

const extractBytesWithNativeConfig = mock(
  async (
    _bytes: Uint8Array,
    _mimeType: string,
    filename: string,
  ): Promise<{ content: string; mimeType: string }> => ({
    content: `OCR:${filename}`,
    mimeType: "image/png",
  }),
);

const extractFileWithNativeConfig = mock(async () => {
  throw new Error("extractFileWithNativeConfig should not run for PDFs");
});

mock.module("./xberg", () => ({
  listPdfPageBuffers,
  extractBytesWithNativeConfig,
  extractFileWithNativeConfig,
}));

mock.module("sharp", () => {
  const chain = {
    rotate() {
      return chain;
    },
    resize() {
      return chain;
    },
    png() {
      return chain;
    },
    async toBuffer() {
      return Buffer.from("resized-png");
    },
  };
  return {
    default: () => chain,
  };
});

mock.module("@/lib/config", () => ({
  appConfig: {
    ocrModel: "google/gemini-3.7-flash",
    ocrTimeoutSecs: 300,
    ocrApiKey: "test-key",
    ocrBaseUrl: "https://openrouter.ai/api/v1",
  },
}));

const { buildExtractOptions, extractDocument } = await import("./extract");

describe("buildExtractOptions", () => {
  it("uses Xberg default extraction when no API key is configured", () => {
    expect(
      buildExtractOptions({
        ocrModel: "qwen/qwen3.7-flash",
        ocrTimeoutSecs: 300,
        ocrApiKey: "",
        ocrBaseUrl: "https://openrouter.ai/api/v1",
      }),
    ).toBeNull();
  });

  it("builds VLM OCR options when an API key is configured", () => {
    const options = buildExtractOptions({
      ocrModel: "qwen/qwen3.7-flash",
      ocrTimeoutSecs: 300,
      ocrApiKey: "test-key",
      ocrBaseUrl: "https://openrouter.ai/api/v1",
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
      ocrModel: "qwen/qwen3.7-flash",
      ocrTimeoutSecs: 120,
      ocrApiKey: "test-key",
      ocrBaseUrl: "http://127.0.0.1:11434/v1",
    });

    expect(options?.ocr?.vlmConfig).toMatchObject({
      baseUrl: "http://127.0.0.1:11434/v1",
      timeoutSecs: 120,
    });
  });

  it("uses an OCR-specific endpoint distinct from the shared LLM base", () => {
    const options = buildExtractOptions({
      ocrModel: "qwen/qwen3.7-flash",
      ocrTimeoutSecs: 300,
      ocrApiKey: "mistral-key",
      ocrBaseUrl: "https://api.mistral.ai/v1",
    });

    expect(options?.ocr?.vlmConfig).toMatchObject({
      apiKey: "mistral-key",
      baseUrl: "https://api.mistral.ai/v1",
    });
  });
});

describe("extractDocument PDF raster path", () => {
  beforeEach(() => {
    listPdfPageBuffers.mockClear();
    extractBytesWithNativeConfig.mockClear();
    extractFileWithNativeConfig.mockClear();
  });

  it("OCRs rasterized PDF page images instead of the PDF URI", async () => {
    const result = await extractDocument("/tmp/scan.pdf");

    expect(listPdfPageBuffers).toHaveBeenCalledTimes(1);
    expect(extractFileWithNativeConfig).not.toHaveBeenCalled();
    expect(extractBytesWithNativeConfig).toHaveBeenCalledTimes(2);
    expect(extractBytesWithNativeConfig.mock.calls[0]?.[2]).toBe("page-1.png");
    expect(extractBytesWithNativeConfig.mock.calls[1]?.[2]).toBe("page-2.png");
    expect(result).toEqual({
      content: "OCR:page-1.png\n\nOCR:page-2.png",
      mimeType: "application/pdf",
      pageCount: 2,
    });
  });
});

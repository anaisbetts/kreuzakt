import { describe, expect, it } from "bun:test";

import {
  isOpenRouterBaseUrl,
  localVlmProxyBaseUrl,
  normalizeOpenAiCompatibleBaseUrl,
  OPENROUTER_DEFAULT_BASE_URL,
} from "@/lib/config";

describe("normalizeOpenAiCompatibleBaseUrl", () => {
  it("appends /v1 to host-only OpenAI-compatible bases", () => {
    expect(
      normalizeOpenAiCompatibleBaseUrl("https://aperture.snowy-sole.ts.net"),
    ).toBe("https://aperture.snowy-sole.ts.net/v1");
    expect(normalizeOpenAiCompatibleBaseUrl("http://localhost:11434")).toBe(
      "http://localhost:11434/v1",
    );
  });

  it("strips trailing slashes before normalizing", () => {
    expect(
      normalizeOpenAiCompatibleBaseUrl("https://aperture.snowy-sole.ts.net/"),
    ).toBe("https://aperture.snowy-sole.ts.net/v1");
  });

  it("leaves bases that already include /v1 unchanged", () => {
    expect(normalizeOpenAiCompatibleBaseUrl(OPENROUTER_DEFAULT_BASE_URL)).toBe(
      OPENROUTER_DEFAULT_BASE_URL,
    );
    expect(
      normalizeOpenAiCompatibleBaseUrl("https://openrouter.ai/api/v1/"),
    ).toBe("https://openrouter.ai/api/v1");
    expect(normalizeOpenAiCompatibleBaseUrl("http://localhost:11434/v1")).toBe(
      "http://localhost:11434/v1",
    );
  });
});

describe("isOpenRouterBaseUrl", () => {
  it("detects OpenRouter hosts", () => {
    expect(isOpenRouterBaseUrl("https://openrouter.ai/api/v1")).toBe(true);
    expect(isOpenRouterBaseUrl("https://eu.openrouter.ai/api/v1")).toBe(true);
  });

  it("rejects other OpenAI-compatible hosts", () => {
    expect(isOpenRouterBaseUrl("http://localhost:11434/v1")).toBe(false);
    expect(isOpenRouterBaseUrl("https://api.openai.com/v1")).toBe(false);
  });
});

describe("localVlmProxyBaseUrl", () => {
  it("points Kreuzberg at the loopback reasoning shim", () => {
    expect(localVlmProxyBaseUrl(3333)).toBe(
      "http://127.0.0.1:3333/api/vlm-proxy/v1",
    );
  });
});

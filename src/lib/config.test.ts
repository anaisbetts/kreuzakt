import { describe, expect, it } from "bun:test";

import {
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

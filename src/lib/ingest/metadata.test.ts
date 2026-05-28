import { describe, expect, it } from "bun:test";

import { buildMetadataSystemPrompt } from "./metadata";

describe("buildMetadataSystemPrompt", () => {
  it("returns the base prompt when preferred language is unset", () => {
    const prompt = buildMetadataSystemPrompt(null);

    expect(prompt).toContain(
      "Extract metadata from the following document text.",
    );
    expect(prompt).not.toContain(
      "Generate all text in the following language:",
    );
  });

  it("appends the preferred language instruction when set", () => {
    const prompt = buildMetadataSystemPrompt("German");

    expect(prompt).toContain(
      "Extract metadata from the following document text.",
    );
    expect(prompt).toContain(
      "Generate all text in the following language: German",
    );
  });
});

import { describe, expect, it } from "bun:test";

import { buildMetadataSystemPrompt, parseMetadataResponse } from "./metadata";

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

describe("parseMetadataResponse", () => {
  const metadata = {
    title: "Water Bill 2024",
    description: "Annual water bill for the flat.",
    document_date: "2024-03-01",
    language: "de",
  };
  const json = JSON.stringify(metadata);
  const fallback = {
    title: "Scan 001",
    description: "",
    document_date: null,
    language: "en",
  };

  it("parses JSON wrapped in a ```json fence", () => {
    expect(
      parseMetadataResponse(`\`\`\`json\n${json}\n\`\`\``, "scan_001.pdf"),
    ).toEqual(metadata);
  });

  it("parses JSON surrounded by prose", () => {
    expect(
      parseMetadataResponse(
        `Here is the metadata:\n${json}\nLet me know if you need more.`,
        "scan_001.pdf",
      ),
    ).toEqual(metadata);
  });

  it("keeps fences and braces that appear inside string values", () => {
    const tricky = {
      title: "Config {draft}",
      description: "Uses ``` fences and { braces }.",
      document_date: null,
      language: "en",
    };

    expect(
      parseMetadataResponse(
        `\`\`\`json\n${JSON.stringify(tricky)}\n\`\`\``,
        "x.pdf",
      ),
    ).toEqual(tricky);
  });

  it("falls back to the filename when there is no JSON object", () => {
    for (const content of ["I cannot do that.", "```json\n```", "[1, 2]"]) {
      expect(parseMetadataResponse(content, "scan_001.pdf")).toEqual(fallback);
    }
  });
});

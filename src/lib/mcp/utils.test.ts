import { describe, expect, it } from "vitest";

import { getBaseUrl, normalizeDocumentIds, stripSnippetMarkers } from "./utils";

describe("normalizeDocumentIds", () => {
  it("prefers ids arrays and preserves order", () => {
    expect(normalizeDocumentIds({ ids: [7, 3, 7] })).toEqual([7, 3, 7]);
  });

  it("accepts the single id convenience form", () => {
    expect(normalizeDocumentIds({ id: 42 })).toEqual([42]);
  });

  it("rejects missing ids", () => {
    expect(() => normalizeDocumentIds({})).toThrow(
      "Either `ids` or `id` is required",
    );
  });

  it("rejects invalid ids", () => {
    expect(() => normalizeDocumentIds({ ids: [1, 0] })).toThrow(
      "Document ids must be positive integers",
    );
    expect(() => normalizeDocumentIds({ id: 1.5 })).toThrow(
      "Document ids must be positive integers",
    );
  });
});

describe("stripSnippetMarkers", () => {
  it("removes internal FTS highlight markers", () => {
    expect(stripSnippetMarkers("...[[[invoice]]] from [[[Telekom]]]...")).toBe(
      "...invoice from Telekom...",
    );
  });
});

describe("getBaseUrl", () => {
  it("prefers forwarded host and protocol for remote deployments", () => {
    expect(
      getBaseUrl({
        headers: {
          "x-forwarded-host": "docs.example.ts.net",
          "x-forwarded-proto": "https",
          host: "localhost:3000",
        },
        url: new URL("http://localhost:3000/mcp"),
      }),
    ).toBe("https://docs.example.ts.net");
  });

  it("falls back to the request origin when forwarded headers are absent", () => {
    expect(
      getBaseUrl({
        headers: {
          host: "localhost:3000",
        },
        url: new URL("http://localhost:3000/mcp"),
      }),
    ).toBe("http://localhost:3000");
  });
});

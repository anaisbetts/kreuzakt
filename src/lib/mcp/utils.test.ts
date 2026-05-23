import { describe, expect, it } from "bun:test";

import {
  buildUploadCurlCommand,
  getBaseUrl,
  normalizeDocumentIds,
  stripSnippetMarkers,
} from "./utils";

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

describe("buildUploadCurlCommand", () => {
  it("builds a curl command for the upload API with a default file placeholder", () => {
    expect(buildUploadCurlCommand("http://localhost:3000")).toBe(
      "curl -X POST http://localhost:3000/api/upload -F 'files=@/path/to/file'",
    );
  });

  it("uses the provided file path and strips trailing slashes from the base URL", () => {
    expect(
      buildUploadCurlCommand("https://docs.example.ts.net/", "/tmp/scan.pdf"),
    ).toBe(
      "curl -X POST https://docs.example.ts.net/api/upload -F 'files=@/tmp/scan.pdf'",
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

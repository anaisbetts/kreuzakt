import { describe, expect, it } from "bun:test";

import type { ExtractedDocument } from "@xberg-io/xberg";

import { extractPageCount } from "./xberg";

/** Only the fields `extractPageCount` reads; the rest are Xberg's business. */
function documentWith(parts: Partial<ExtractedDocument>): ExtractedDocument {
  return parts as ExtractedDocument;
}

describe("extractPageCount", () => {
  it("prefers the document's own page count", () => {
    const pageCount = extractPageCount(
      documentWith({
        counts: { pages: 3 },
        metadata: { format: { formatType: "pdf", pageCount: 9 } },
      }),
    );

    expect(pageCount).toBe(3);
  });

  it("reads pageCount from the flattened PDF format metadata", () => {
    // Xberg 1.4 tags the variant with `formatType` and inlines the PDF fields;
    // 1.1 nested them under `pdf` with a `format_type` tag.
    const pageCount = extractPageCount(
      documentWith({
        metadata: { format: { formatType: "pdf", pageCount: 12 } },
      }),
    );

    expect(pageCount).toBe(12);
  });

  it("ignores format metadata that is not a PDF", () => {
    // A stray pageCount on a non-PDF variant must not be mistaken for one.
    const docxFormat = { formatType: "docx", pageCount: 7 } as const;

    const pageCount = extractPageCount(
      documentWith({ metadata: { format: docxFormat } }),
    );

    expect(pageCount).toBeNull();
  });

  it("falls back to a page_count in the additional metadata", () => {
    const pageCount = extractPageCount(
      documentWith({
        metadata: { additional: { page_count: 5 } },
      }),
    );

    expect(pageCount).toBe(5);
  });

  it("returns null when the document has no page count at all", () => {
    expect(extractPageCount(documentWith({}))).toBeNull();
  });
});

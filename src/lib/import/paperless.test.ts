import { describe, expect, it } from "bun:test";

import { resolvePaperlessApiUrl } from "./paperless-url";

describe("resolvePaperlessApiUrl", () => {
  it("preserves the configured https origin for absolute next links", () => {
    expect(
      resolvePaperlessApiUrl(
        "https://paperless.snowy-sole.ts.net",
        "http://paperless.snowy-sole.ts.net/api/documents/?page=2&page_size=100",
      ),
    ).toBe(
      "https://paperless.snowy-sole.ts.net/api/documents/?page=2&page_size=100",
    );
  });

  it("handles relative next links against the configured base", () => {
    expect(
      resolvePaperlessApiUrl(
        "https://paperless.snowy-sole.ts.net",
        "/api/documents/?page=2&page_size=100",
      ),
    ).toBe(
      "https://paperless.snowy-sole.ts.net/api/documents/?page=2&page_size=100",
    );
  });
});

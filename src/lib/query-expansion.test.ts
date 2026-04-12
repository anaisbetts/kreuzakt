import { afterEach, describe, expect, it, mock } from "bun:test";

import { buildExpandedMatchQuery } from "./documents";
import {
  expandSearchQuery,
  normalizeExpansionTerms,
  resetQueryExpansionCache,
} from "./query-expansion";

afterEach(() => {
  resetQueryExpansionCache();
});

describe("normalizeExpansionTerms", () => {
  it("deduplicates, trims, and excludes the original query", () => {
    expect(
      normalizeExpansionTerms("tax return", [
        " 1040 ",
        "Tax return",
        "income tax",
        "income   tax",
        "",
        123,
      ]),
    ).toEqual(["1040", "income tax"]);
  });
});

describe("expandSearchQuery", () => {
  it("caches expansions for the exact trimmed query", async () => {
    const fetcher = mock(async () => ({
      related_terms: ["invoice", "billing statement"],
    }));

    const first = await expandSearchQuery(" invoice ", { fetcher });
    const second = await expandSearchQuery("invoice", { fetcher });

    expect(first).toEqual(["billing statement"]);
    expect(second).toEqual(["billing statement"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("falls back to no extra terms when expansion fails", async () => {
    const fetcher = mock(async () => {
      throw new Error("boom");
    });

    await expect(expandSearchQuery("statement", { fetcher })).resolves.toEqual(
      [],
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("falls back to no extra terms on timeout", async () => {
    const fetcher = mock(
      () =>
        new Promise<never>(() => {
          // Intentionally unresolved to exercise timeout handling.
        }),
    );

    await expect(
      expandSearchQuery("statement", {
        fetcher,
        timeoutMs: 5,
      }),
    ).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("buildExpandedMatchQuery", () => {
  it("preserves the original query and ORs in quoted related phrases", () => {
    expect(
      buildExpandedMatchQuery("annual report", [
        "financial statement",
        'directors "summary"',
      ]),
    ).toBe(
      '(annual report) OR "financial statement" OR "directors ""summary"""',
    );
  });

  it("leaves the query unchanged without extra terms", () => {
    expect(buildExpandedMatchQuery("annual report", [])).toBe("annual report");
  });
});

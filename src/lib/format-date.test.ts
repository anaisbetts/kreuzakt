import { describe, expect, it } from "bun:test";

import { formatProcessingDuration } from "./format-date";

describe("formatProcessingDuration", () => {
  it("formats total seconds and seconds per page", () => {
    expect(
      formatProcessingDuration(
        "2026-05-28 12:00:00",
        "2026-05-28T12:01:30.000Z",
        3,
      ),
    ).toBe("Processed in 90 seconds (30 seconds per page)");
  });

  it("falls back to one page when page count is missing", () => {
    expect(
      formatProcessingDuration(
        "2026-05-28 12:00:00",
        "2026-05-28T12:00:12.000Z",
        null,
      ),
    ).toBe("Processed in 12 seconds (12 seconds per page)");
  });
});

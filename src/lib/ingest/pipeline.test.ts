import { describe, expect, it } from "bun:test";

import { isDuplicateFileHashConstraintError } from "./pipeline-errors";

describe("isDuplicateFileHashConstraintError", () => {
  it("matches SQLite file hash uniqueness errors", () => {
    expect(
      isDuplicateFileHashConstraintError(
        new Error("UNIQUE constraint failed: documents.file_hash"),
      ),
    ).toBe(true);
  });

  it("ignores other errors", () => {
    expect(
      isDuplicateFileHashConstraintError(
        new Error("UNIQUE constraint failed: documents.stored_filename"),
      ),
    ).toBe(false);
    expect(isDuplicateFileHashConstraintError(new Error("boom"))).toBe(false);
    expect(isDuplicateFileHashConstraintError("boom")).toBe(false);
  });
});

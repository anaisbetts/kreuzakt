import { describe, expect, it } from "bun:test";

import { summarizeReindexAllStatus } from "./reindex";

describe("summarizeReindexAllStatus", () => {
  it("counts reindex batch progress", () => {
    const status = summarizeReindexAllStatus("batch-a", [
      { status: "completed", count: 1 },
      { status: "pending", count: 1 },
      { status: "failed", count: 1 },
    ]);

    expect(status).toEqual({
      batchId: "batch-a",
      total: 3,
      pending: 1,
      processing: 0,
      completed: 1,
      failed: 1,
      processed: 2,
      active: true,
      percentComplete: 67,
    });
  });

  it("handles empty batches as complete", () => {
    const status = summarizeReindexAllStatus(null, []);

    expect(status).toMatchObject({
      batchId: null,
      total: 0,
      processed: 0,
      active: false,
      percentComplete: 100,
    });
  });
});

import { beforeEach, describe, expect, it } from "bun:test";

import { enqueueSerialIngestWork, isIngestWorkScheduled } from "./job-runner";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("enqueueSerialIngestWork", () => {
  beforeEach(() => {
    globalThis.__docsAiIngestJobRunner = undefined;
  });

  it("runs work for different keys one after another", async () => {
    const order: string[] = [];
    const first = deferred<void>();

    const a = enqueueSerialIngestWork("a", async () => {
      order.push("a:start");
      await first.promise;
      order.push("a:end");
      return "a";
    });
    const b = enqueueSerialIngestWork("b", async () => {
      order.push("b:start");
      return "b";
    });

    await Promise.resolve();
    expect(order).toEqual(["a:start"]);

    first.resolve();
    expect(await a).toBe("a");
    expect(await b).toBe("b");
    expect(order).toEqual(["a:start", "a:end", "b:start"]);
  });

  it("drops duplicate work for a key that is still scheduled", async () => {
    const gate = deferred<void>();
    let runs = 0;

    const first = enqueueSerialIngestWork("same", async () => {
      runs += 1;
      await gate.promise;
      return "first";
    });
    expect(isIngestWorkScheduled("same")).toBe(true);

    const second = enqueueSerialIngestWork("same", async () => {
      runs += 1;
      return "second";
    });

    gate.resolve();
    expect(await first).toBe("first");
    expect(await second).toBeNull();
    expect(runs).toBe(1);
    expect(isIngestWorkScheduled("same")).toBe(false);
  });

  it("allows the same key again once earlier work has finished", async () => {
    expect(await enqueueSerialIngestWork("k", async () => 1)).toBe(1);
    expect(await enqueueSerialIngestWork("k", async () => 2)).toBe(2);
  });

  it("releases the key and keeps the chain alive when work throws", async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      const failed = await enqueueSerialIngestWork("boom", async () => {
        throw new Error("boom");
      });
      expect(failed).toBeNull();
      expect(isIngestWorkScheduled("boom")).toBe(false);
      expect(await enqueueSerialIngestWork("next", async () => "ok")).toBe(
        "ok",
      );
    } finally {
      console.error = originalError;
    }
  });

  it("shares scheduling state across module instances via globalThis", async () => {
    const gate = deferred<void>();
    void enqueueSerialIngestWork("shared", async () => {
      await gate.promise;
    });

    // A second bundle of this module would see the same global state.
    expect(
      globalThis.__docsAiIngestJobRunner?.scheduledKeys.has("shared"),
    ).toBe(true);

    gate.resolve();
    await globalThis.__docsAiIngestJobRunner?.processingChain;
    expect(isIngestWorkScheduled("shared")).toBe(false);
  });
});

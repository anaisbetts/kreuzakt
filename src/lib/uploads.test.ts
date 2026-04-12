import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { sanitizeUploadedFilename, writeBufferToUniquePath } from "./uploads";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dirPath) =>
      rm(dirPath, {
        force: true,
        recursive: true,
      }),
    ),
  );
});

async function createTempDir() {
  const dirPath = await mkdtemp(path.join(os.tmpdir(), "kreuzakt-upload-"));
  tempDirs.push(dirPath);
  return dirPath;
}

describe("sanitizeUploadedFilename", () => {
  it("removes unsafe path characters", () => {
    expect(sanitizeUploadedFilename("../quarterly/report?.pdf")).toBe(
      "report_.pdf",
    );
  });

  it("avoids hidden dotfile uploads", () => {
    expect(sanitizeUploadedFilename(".receipt.jpg")).toBe("receipt.jpg");
  });

  it("falls back to a safe default for empty names", () => {
    expect(sanitizeUploadedFilename("...")).toBe("upload");
  });
});

describe("writeBufferToUniquePath", () => {
  it("preserves the requested filename when available", async () => {
    const dirPath = await createTempDir();
    const result = await writeBufferToUniquePath(
      dirPath,
      "scan.pdf",
      new Uint8Array([1, 2, 3]),
    );

    expect(result.storedFilename).toBe("scan.pdf");
    expect(await readFile(result.destinationPath)).toEqual(
      Buffer.from([1, 2, 3]),
    );
  });

  it("adds a numeric suffix when the filename already exists", async () => {
    const dirPath = await createTempDir();
    await writeFile(path.join(dirPath, "scan.pdf"), "existing");

    const result = await writeBufferToUniquePath(
      dirPath,
      "scan.pdf",
      new Uint8Array([9, 8, 7]),
    );

    expect(result.storedFilename).toBe("scan (1).pdf");
    expect(await readFile(result.destinationPath)).toEqual(
      Buffer.from([9, 8, 7]),
    );
  });
});

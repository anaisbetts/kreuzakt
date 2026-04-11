import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { extractFile } from "@kreuzberg/node";

import { computeFileHash } from "../src/lib/files";

import type { BackendConfig, CachedExtraction, FixtureInfo } from "./types";

function getCachePath(cacheDir: string, fileHash: string, backendName: string) {
  const safeBackendName = backendName.replaceAll(":", "_");
  return path.join(cacheDir, `${fileHash}_${safeBackendName}.json`);
}

export async function loadCachedExtraction(
  fixture: FixtureInfo,
  backend: BackendConfig,
  cacheDir: string,
) {
  const fileHash = await computeFileHash(fixture.filePath);
  const cachePath = getCachePath(cacheDir, fileHash, backend.name);
  const cached = await readFile(cachePath, "utf8");
  return JSON.parse(cached) as CachedExtraction;
}

export async function extractFixture(
  fixture: FixtureInfo,
  backend: BackendConfig,
  cacheDir: string,
) {
  await mkdir(cacheDir, { recursive: true });

  const fileHash = await computeFileHash(fixture.filePath);
  const cachePath = getCachePath(cacheDir, fileHash, backend.name);

  try {
    const cached = await readFile(cachePath, "utf8");
    return JSON.parse(cached) as CachedExtraction;
  } catch {
    // Cache miss, continue with extraction.
  }

  const startedAt = performance.now();
  const result = await extractFile(
    fixture.filePath,
    null,
    backend.kreuzbergConfig,
  );
  const extractionTimeMs = performance.now() - startedAt;
  const metadata = result.metadata as { pageCount?: number } | undefined;

  const cachedExtraction: CachedExtraction = {
    file_hash: fileHash,
    backend: backend.name,
    fixture_name: fixture.fileName,
    extracted_text: result.content,
    extraction_time_ms: Math.round(extractionTimeMs),
    page_count: metadata?.pageCount ?? null,
    timestamp: new Date().toISOString(),
  };

  await writeFile(cachePath, JSON.stringify(cachedExtraction, null, 2));

  return cachedExtraction;
}

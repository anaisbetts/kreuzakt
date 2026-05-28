import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { ExtractionResult } from "@kreuzberg/node";

const projectRequire = createRequire(
  pathToFileURL(path.join(process.cwd(), "package.json")).href,
);
const NATIVE_KREUZBERG_ENTRYPOINT = path.join(
  process.cwd(),
  "node_modules",
  "@kreuzberg",
  "node",
  "index.js",
);

let nativeKreuzberg: KreuzbergNativeModule | null = null;

type KreuzbergModule = Pick<
  typeof import("@kreuzberg/node"),
  "detectMimeTypeFromPath" | "extractFile" | "renderPdfPage"
>;

type RenderPdfPageOptions = Parameters<KreuzbergModule["renderPdfPage"]>[2];
type RenderPdfPageResult = Awaited<
  ReturnType<KreuzbergModule["renderPdfPage"]>
>;

type KreuzbergNativeModule = {
  detectMimeTypeFromPath: KreuzbergModule["detectMimeTypeFromPath"];
  extractFile: (
    filePath: string,
    mimeType: string | null,
    config: unknown,
  ) => Promise<ExtractionResult>;
  renderPdfPage: (
    filePath: string,
    pageIndex: number,
    dpi: number | null,
  ) => Promise<RenderPdfPageResult>;
};

export async function detectMimeTypeFromPathWithNativeBinding(
  filePath: string,
): Promise<string> {
  const kreuzberg = getNativeKreuzberg();
  return kreuzberg.detectMimeTypeFromPath(filePath);
}

export async function extractFileWithNativeConfig(
  filePath: string,
  mimeType: string | null,
  config: unknown,
): Promise<ExtractionResult> {
  const kreuzberg = getNativeKreuzberg();
  return kreuzberg.extractFile(filePath, mimeType, config);
}

export async function renderPdfPageWithNativeBinding(
  filePath: string,
  pageIndex: number,
  options?: RenderPdfPageOptions,
): Promise<RenderPdfPageResult> {
  const kreuzberg = getNativeKreuzberg();
  return kreuzberg.renderPdfPage(filePath, pageIndex, options?.dpi ?? null);
}

function getNativeKreuzberg(): KreuzbergNativeModule {
  nativeKreuzberg ??= projectRequire(
    NATIVE_KREUZBERG_ENTRYPOINT,
  ) as KreuzbergNativeModule;

  return nativeKreuzberg;
}

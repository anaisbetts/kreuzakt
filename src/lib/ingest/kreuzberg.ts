type KreuzbergModule = Pick<
  typeof import("@kreuzberg/node"),
  "detectMimeTypeFromPath" | "extractFile" | "renderPdfPage"
>;

// Force CJS require so Turbopack emits a CJS external reference instead of an
// ESM one. The ESM entry (dist/index.mjs) calls createRequire(import.meta.url)
// which breaks in Turbopack's runtime where import.meta.url is empty. The CJS
// entry gracefully falls back to the native require which resolves via __dirname.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const kreuzberg: KreuzbergModule = require("@kreuzberg/node");

export function getKreuzberg(): KreuzbergModule {
  return kreuzberg;
}

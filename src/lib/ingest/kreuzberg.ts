import { createRequire } from "node:module";

type KreuzbergModule = Pick<
  typeof import("@kreuzberg/node"),
  "detectMimeTypeFromPath" | "extractFile" | "renderPdfPage"
>;

const require = createRequire(import.meta.url);

let cachedModule: KreuzbergModule | null = null;

export function getKreuzberg(): KreuzbergModule {
  if (cachedModule) {
    return cachedModule;
  }

  cachedModule = require("@kreuzberg/node") as KreuzbergModule;
  return cachedModule;
}

import {
  detectMimeTypeFromPath,
  extractFile,
  renderPdfPage,
} from "@kreuzberg/node";

type KreuzbergModule = Pick<
  typeof import("@kreuzberg/node"),
  "detectMimeTypeFromPath" | "extractFile" | "renderPdfPage"
>;

const kreuzberg: KreuzbergModule = {
  detectMimeTypeFromPath,
  extractFile,
  renderPdfPage,
};

export function getKreuzberg(): KreuzbergModule {
  return kreuzberg;
}

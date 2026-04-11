import sharp from "sharp";

import {
  ensureAppDirectories,
  ensureDirectory,
  getDocumentThumbnailDir,
  getPageThumbnailPath,
} from "@/lib/files";

import { getKreuzberg } from "./kreuzberg";

const THUMBNAIL_WIDTH = 300;

function isSupportedImage(mimeType: string) {
  return (
    mimeType === "image/jpeg" ||
    mimeType === "image/png" ||
    mimeType === "image/tiff" ||
    mimeType === "image/webp" ||
    mimeType === "image/gif"
  );
}

async function writeThumbnailFromBuffer(
  buffer: Buffer,
  documentId: number,
  page: number,
) {
  const outputPath = getPageThumbnailPath(documentId, page);

  await sharp(buffer)
    .rotate()
    .resize({
      width: THUMBNAIL_WIDTH,
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toFile(outputPath);

  return outputPath;
}

export async function generateThumbnail(
  filePath: string,
  mimeType: string,
  documentId: number,
  pageCount: number | null,
) {
  await ensureAppDirectories();
  await ensureDirectory(getDocumentThumbnailDir(documentId));

  if (mimeType === "application/pdf") {
    const { renderPdfPage } = getKreuzberg();
    const pages = pageCount && pageCount > 0 ? pageCount : 1;

    for (let i = 0; i < pages; i++) {
      const pageBuffer = await renderPdfPage(filePath, i, { dpi: 144 });
      await writeThumbnailFromBuffer(pageBuffer, documentId, i + 1);
    }

    return true;
  }

  if (isSupportedImage(mimeType)) {
    const imageBuffer = await sharp(filePath).rotate().toBuffer();
    await writeThumbnailFromBuffer(imageBuffer, documentId, 1);
    return true;
  }

  return false;
}

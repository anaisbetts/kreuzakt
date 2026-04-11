import { renderPdfPage } from "@kreuzberg/node";
import sharp from "sharp";

import { ensureAppDirectories, getThumbnailPath } from "@/lib/files";

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

async function writeThumbnailFromBuffer(buffer: Buffer, documentId: number) {
  const outputPath = getThumbnailPath(documentId);

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
) {
  await ensureAppDirectories();

  if (mimeType === "application/pdf") {
    const firstPage = await renderPdfPage(filePath, 0, { dpi: 144 });
    await writeThumbnailFromBuffer(firstPage, documentId);
    return true;
  }

  if (isSupportedImage(mimeType)) {
    const imageBuffer = await sharp(filePath).rotate().toBuffer();
    await writeThumbnailFromBuffer(imageBuffer, documentId);
    return true;
  }

  return false;
}

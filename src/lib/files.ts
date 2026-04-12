import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { appConfig } from "@/lib/config";
import { getDb } from "@/lib/db/connection";

export async function ensureDirectory(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
  return dirPath;
}

export async function ensureAppDirectories() {
  await Promise.all([
    ensureDirectory(appConfig.dataDir),
    ensureDirectory(appConfig.ingestDir),
    ensureDirectory(appConfig.importDir),
    ensureDirectory(appConfig.originalsDir),
    ensureDirectory(appConfig.thumbnailsDir),
  ]);
}

export async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function computeFileHash(filePath: string) {
  const hash = createHash("sha256");

  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

export function computeBufferHash(buffer: Uint8Array) {
  const hash = createHash("sha256");
  hash.update(buffer);
  return hash.digest("hex");
}

export function buildStoredFilename(
  fileHash: string,
  originalFilename: string,
) {
  const sanitizedName = originalFilename.replace(/[\\/]/g, "_");
  return `${fileHash.slice(0, 12)}_${sanitizedName}`;
}

export function getOriginalFilePath(storedFilename: string) {
  return path.join(appConfig.originalsDir, storedFilename);
}

export function getDocumentThumbnailDir(documentId: number) {
  return path.join(appConfig.thumbnailsDir, String(documentId));
}

export function getPageThumbnailPath(documentId: number, page: number) {
  return path.join(getDocumentThumbnailDir(documentId), `${page}.jpg`);
}

export function getThumbnailPath(documentId: number) {
  return getPageThumbnailPath(documentId, 1);
}

export async function findDuplicateDocumentId(fileHash: string) {
  const db = await getDb();
  const duplicate = await db
    .selectFrom("documents")
    .select("id")
    .where("file_hash", "=", fileHash)
    .executeTakeFirst();

  return duplicate?.id ?? null;
}

export async function copyOriginalToArchive(
  sourcePath: string,
  originalFilename: string,
  fileHash: string,
) {
  await ensureAppDirectories();

  const storedFilename = buildStoredFilename(fileHash, originalFilename);
  const destinationPath = getOriginalFilePath(storedFilename);

  await copyFile(sourcePath, destinationPath);

  return {
    storedFilename,
    destinationPath,
  };
}

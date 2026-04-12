import { writeFile } from "node:fs/promises";
import path from "node:path";

import { appConfig } from "@/lib/config";
import { ensureAppDirectories } from "@/lib/files";

function replaceUnsafeFilenameChars(value: string) {
  return Array.from(value, (char) => {
    const code = char.charCodeAt(0);
    const isControlChar = code <= 31 || code === 127;
    return isControlChar || '<>:"/\\|?*'.includes(char) ? "_" : char;
  }).join("");
}

function isAlreadyExistsError(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code === "EEXIST"
  );
}

function splitFilename(filename: string) {
  const extension = path.extname(filename);
  const basename = filename.slice(0, filename.length - extension.length);
  return {
    basename,
    extension,
  };
}

export function sanitizeUploadedFilename(originalFilename: string) {
  let sanitized = path.basename(originalFilename).replaceAll("\0", "_");

  sanitized = replaceUnsafeFilenameChars(sanitized)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");

  if (!sanitized || sanitized === "." || sanitized === "..") {
    sanitized = "upload";
  }

  return sanitized;
}

export async function writeBufferToUniquePath(
  targetDir: string,
  originalFilename: string,
  contents: Uint8Array,
) {
  const sanitizedFilename = sanitizeUploadedFilename(originalFilename);
  const { basename, extension } = splitFilename(sanitizedFilename);

  let attempt = 0;

  while (true) {
    const storedFilename =
      attempt === 0
        ? sanitizedFilename
        : `${basename || "upload"} (${attempt})${extension}`;
    const destinationPath = path.join(targetDir, storedFilename);

    try {
      await writeFile(destinationPath, contents, { flag: "wx" });

      return {
        destinationPath,
        relativePath: storedFilename,
        storedFilename,
      };
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        attempt += 1;
        continue;
      }

      throw error;
    }
  }
}

export async function writeUploadToIngest(file: File) {
  await ensureAppDirectories();

  const contents = new Uint8Array(await file.arrayBuffer());
  return writeBufferToUniquePath(appConfig.ingestDir, file.name, contents);
}

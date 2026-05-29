import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { zipSync } from "fflate";
import type { Kysely } from "kysely";

import type { DB } from "@/lib/db/schema";
import {
  buildDocumentDownloadUrl,
  buildDocumentPageUrl,
  type DocumentTextExportRow,
  getDocumentsForTextExport,
} from "@/lib/documents";

const EXPORT_BASENAME_MAX_LENGTH = 100;
const TEMP_DIR_PREFIX = "kreuzakt-text-export-";
const UNSAFE_FILENAME_CHARS = /[\\/:*?"<>|]/g;

export class ExportEmptyError extends Error {
  constructor() {
    super("No documents with text content to export");
    this.name = "ExportEmptyError";
  }
}

export interface TextExportResult {
  zipBuffer: Uint8Array;
  filename: string;
  documentCount: number;
}

export interface TextExportOptions {
  baseUrl?: string;
}

export async function buildDocumentTextExport(
  db?: Kysely<DB>,
  options: TextExportOptions = {},
): Promise<TextExportResult> {
  const documents = await getDocumentsForTextExport(db);
  const exportable = documents.filter((document) => document.content.trim());

  if (exportable.length === 0) {
    throw new ExportEmptyError();
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));

  try {
    const zipEntries: Record<string, Uint8Array> = {};

    for (const document of exportable) {
      const basename = sanitizeExportBasename(
        document.id,
        document.title,
        document.original_filename,
      );
      const filePath = path.join(tmpDir, basename);
      const fileContent = formatExportTextContent(document, options.baseUrl);
      await writeFile(filePath, fileContent, "utf8");
      const fileBuffer = await readFile(filePath);
      zipEntries[basename] = new Uint8Array(
        fileBuffer.buffer,
        fileBuffer.byteOffset,
        fileBuffer.byteLength,
      );
    }

    return {
      zipBuffer: zipSync(zipEntries),
      filename: formatExportZipFilename(),
      documentCount: exportable.length,
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

export function formatExportTextContent(
  document: DocumentTextExportRow,
  baseUrl?: string,
): string {
  const frontmatter = [
    "---",
    `original_filename: ${yamlScalar(document.original_filename)}`,
    `document_url: ${yamlScalar(buildDocumentPageUrl(document.id, baseUrl))}`,
    `original_url: ${yamlScalar(buildDocumentDownloadUrl(document.id, baseUrl))}`,
    "---",
  ].join("\n");

  return `${frontmatter}\n\n${document.content}`;
}

export function sanitizeExportBasename(
  id: number,
  title: string,
  originalFilename: string,
): string {
  const trimmedTitle = title.trim();
  const rawName = trimmedTitle
    ? trimmedTitle
    : stripFilenameExtension(originalFilename);
  let namePart = sanitizeNamePart(rawName);

  if (!namePart) {
    namePart = "document";
  }

  const prefix = `${id}-`;
  const suffix = ".txt";
  const maxNamePartLength =
    EXPORT_BASENAME_MAX_LENGTH - prefix.length - suffix.length;

  if (namePart.length > maxNamePartLength) {
    namePart = namePart.slice(0, maxNamePartLength);
  }

  return `${prefix}${namePart}${suffix}`;
}

export function formatExportZipFilename(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const timestamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join("");
  const clock = [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");

  return `kreuzakt-text-export-${timestamp}-${clock}.zip`;
}

function stripFilenameExtension(filename: string): string {
  return path.parse(filename).name;
}

function sanitizeNamePart(value: string): string {
  return stripControlChars(value)
    .trim()
    .replace(UNSAFE_FILENAME_CHARS, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function stripControlChars(value: string): string {
  let result = "";

  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code >= 0x20 && code !== 0x7f) {
      result += char;
    }
  }

  return result;
}

function yamlScalar(value: string): string {
  const needsQuotes =
    !value ||
    /[:#\n\r"'[\]{}>|*&!%@`,\\]/.test(value) ||
    /^\s|\s$/.test(value) ||
    /^[-?:]/.test(value);

  if (!needsQuotes) {
    return value;
  }

  return `"${value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")}"`;
}

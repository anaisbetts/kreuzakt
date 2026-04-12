import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { appConfig } from "@/lib/config";
import { ensureDirectory } from "@/lib/files";

import { resolvePaperlessApiUrl } from "./paperless-url";
import { normalizePaperlessUrl } from "./paperless-url-shared";

const DEFAULT_PAGE_SIZE = 100;

export interface PaperlessDocument {
  id: number;
  addedAt: string;
  originalFilename: string;
}

interface PaperlessDocumentPage {
  count: number;
  next: string | null;
  results: PaperlessDocument[];
}

export class PaperlessClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly signal?: AbortSignal;

  constructor(options: {
    apiKey: string;
    baseUrl: string;
    signal?: AbortSignal;
  }) {
    this.apiKey = options.apiKey.trim();
    this.baseUrl = normalizePaperlessUrl(options.baseUrl);
    this.signal = options.signal;
  }

  async checkConnection() {
    await this.listDocumentsPage();
  }

  async listAllDocuments(options?: { maxDocuments?: number }) {
    const documents: PaperlessDocument[] = [];
    const maxDocuments = options?.maxDocuments;
    let nextUrl: string | null = this.buildDocumentsUrl(
      maxDocuments && maxDocuments > 0
        ? Math.min(DEFAULT_PAGE_SIZE, maxDocuments)
        : DEFAULT_PAGE_SIZE,
    );

    while (nextUrl) {
      const page = await this.listDocumentsPage(nextUrl);
      documents.push(...page.results);

      if (maxDocuments && documents.length >= maxDocuments) {
        return documents.slice(0, maxDocuments);
      }

      nextUrl = page.next;
    }

    return documents;
  }

  async downloadOriginal(document: PaperlessDocument) {
    const relativePath = path
      .join("paperless-ngx", String(document.id), document.originalFilename)
      .split(path.sep)
      .join("/");
    const absolutePath = path.join(appConfig.ingestDir, relativePath);

    await ensureDirectory(path.dirname(absolutePath));

    const response = await this.request(this.buildDownloadUrl(document.id));
    if (!response.body) {
      throw new Error(
        `Paperless returned no content for ${document.originalFilename}`,
      );
    }

    try {
      const body = Buffer.from(await response.arrayBuffer());
      await writeFile(absolutePath, body);
    } catch (error) {
      await rm(absolutePath, { force: true });
      throw error;
    }

    return {
      absolutePath,
      relativePath,
    };
  }

  private async listDocumentsPage(url = this.buildDocumentsUrl()) {
    const response = await this.request(url);
    const payload = (await response.json()) as {
      count?: unknown;
      next?: unknown;
      results?: unknown;
    };

    if (
      typeof payload.count !== "number" ||
      !Array.isArray(payload.results) ||
      (payload.next !== null &&
        payload.next !== undefined &&
        typeof payload.next !== "string")
    ) {
      throw new Error("Paperless returned an unexpected documents response");
    }

    return {
      count: payload.count,
      next: payload.next ? this.resolveApiUrl(payload.next) : null,
      results: payload.results.map(parsePaperlessDocument),
    } satisfies PaperlessDocumentPage;
  }

  private buildDocumentsUrl(pageSize = DEFAULT_PAGE_SIZE) {
    const url = new URL("api/documents/", `${this.baseUrl}/`);
    url.searchParams.set("page", "1");
    url.searchParams.set("page_size", String(pageSize));
    return url.toString();
  }

  private buildDownloadUrl(documentId: number) {
    return new URL(
      `api/documents/${documentId}/download/`,
      `${this.baseUrl}/`,
    ).toString();
  }

  private resolveApiUrl(url: string) {
    return resolvePaperlessApiUrl(this.baseUrl, url);
  }

  private async request(url: string) {
    console.info("paperless upstream request", {
      apiKey: summarizeSecret(this.apiKey),
      url,
    });

    const response = await fetch(url, {
      headers: {
        Authorization: `Token ${this.apiKey}`,
      },
      signal: this.signal,
    });

    console.info("paperless upstream response", {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      url,
    });

    if (!response.ok) {
      throw new Error(await buildPaperlessError(response));
    }

    return response;
  }
}

function parsePaperlessDocument(value: unknown): PaperlessDocument {
  if (!value || typeof value !== "object") {
    throw new Error("Paperless returned an invalid document row");
  }

  const row = value as {
    id?: unknown;
    added?: unknown;
    archived_file_name?: unknown;
    mime_type?: unknown;
    original_file_name?: unknown;
    original_filename?: unknown;
  };

  if (typeof row.id !== "number" || typeof row.added !== "string") {
    throw new Error("Paperless document rows must include id and added");
  }

  return {
    id: row.id,
    addedAt: row.added,
    originalFilename: sanitizeFilename(
      typeof row.original_file_name === "string"
        ? row.original_file_name
        : typeof row.archived_file_name === "string"
          ? row.archived_file_name
          : typeof row.original_filename === "string"
            ? row.original_filename
            : buildFallbackFilename(row.id, row.mime_type),
    ),
  };
}

async function buildPaperlessError(response: Response) {
  const fallback = `Paperless request failed (${response.status} ${response.statusText})`;

  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as {
        detail?: unknown;
        error?: unknown;
      };

      if (typeof payload.detail === "string" && payload.detail.trim()) {
        return payload.detail;
      }

      if (typeof payload.error === "string" && payload.error.trim()) {
        return payload.error;
      }
    }

    const text = await response.text();
    if (text.trim()) {
      return text.trim();
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function sanitizeFilename(value: string) {
  const trimmed = value.trim();
  const basename = path.basename(trimmed || "paperless-document");
  const sanitized = basename.replace(/[\\/]/g, "_");
  return sanitized || "paperless-document";
}

function buildFallbackFilename(id: number, mimeType: unknown) {
  return `paperless-${id}${extensionForMimeType(mimeType)}`;
}

function extensionForMimeType(mimeType: unknown) {
  if (mimeType === "application/pdf") {
    return ".pdf";
  }

  if (mimeType === "image/jpeg") {
    return ".jpg";
  }

  if (mimeType === "image/png") {
    return ".png";
  }

  if (mimeType === "image/tiff") {
    return ".tiff";
  }

  if (mimeType === "image/webp") {
    return ".webp";
  }

  if (mimeType === "image/gif") {
    return ".gif";
  }

  return "";
}

function summarizeSecret(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "<empty>";
  }

  if (trimmed.length <= 8) {
    return `${trimmed[0] ?? ""}...${trimmed.at(-1) ?? ""} (len=${trimmed.length})`;
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)} (len=${trimmed.length})`;
}

import type { RequestInfo } from "@modelcontextprotocol/sdk/types.js";

import { appConfig } from "../config";
import type { DocumentResourceDetail } from "../documents";

export function normalizeDocumentIds(input: {
  id?: number | null | undefined;
  ids?: number[] | null | undefined;
}) {
  const ids = input.ids?.length
    ? input.ids
    : input.id != null
      ? [input.id]
      : null;

  if (!ids?.length) {
    throw new Error("Either `ids` or `id` is required");
  }

  const normalizedIds = ids.map((id) => {
    if (!Number.isInteger(id) || id < 1) {
      throw new Error("Document ids must be positive integers");
    }

    return id;
  });

  return normalizedIds;
}

export function stripSnippetMarkers(snippet: string) {
  return snippet.replaceAll("[[[", "").replaceAll("]]]", "");
}

export function getBaseUrl(requestInfo?: RequestInfo) {
  const headers = requestInfo?.headers;
  const forwardedHost = getHeader(headers, "x-forwarded-host");
  const forwardedProto = getHeader(headers, "x-forwarded-proto");
  const host = forwardedHost ?? getHeader(headers, "host");
  const protocol =
    forwardedProto ?? requestInfo?.url?.protocol.replace(/:$/, "") ?? "http";

  if (host) {
    return `${protocol}://${host}`;
  }

  return requestInfo?.url?.origin ?? `http://localhost:${appConfig.port}`;
}

export function formatDocumentResourceText(document: DocumentResourceDetail) {
  return [
    `Title: ${document.title}`,
    `Description: ${document.description}`,
    `Date: ${document.document_date ?? "Unknown"}`,
    `Added: ${document.added_at}`,
    `Original: ${document.original_filename}`,
    `Mime Type: ${document.mime_type}`,
    "",
    "---",
    "",
    document.content,
  ].join("\n");
}

function getHeader(
  headers: RequestInfo["headers"] | undefined,
  name: string,
): string | undefined {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

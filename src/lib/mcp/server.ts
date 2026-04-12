import { randomUUID } from "node:crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";

import {
  getDocumentContentsByIds,
  getDocumentsByIds,
  getDocumentsForDownload,
  listDocuments,
  searchDocuments,
} from "@/lib/documents";

import { getBaseUrl, normalizeDocumentIds, stripSnippetMarkers } from "./utils";

type McpSession = {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
};

const sessions = new Map<string, McpSession>();
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;

const searchResultSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  document_date: z.string().nullable(),
  added_at: z.string(),
  original_filename: z.string(),
  snippet: z.string(),
});

const searchOutputSchema = {
  results: z.array(searchResultSchema),
};

const documentSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  document_date: z.string().nullable(),
  added_at: z.string(),
  original_filename: z.string(),
  mime_type: z.string(),
  thumbnail_url: z.string(),
  stored_filename: z.string(),
  file_size: z.number(),
  page_count: z.number().nullable(),
  content: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  download_url: z.string(),
});

const documentOutputSchema = {
  documents: z.array(documentSchema),
};

const documentContentSchema = z.object({
  id: z.number(),
  content: z.string(),
});

const documentContentOutputSchema = {
  contents: z.array(documentContentSchema),
};

const recentDocumentSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  document_date: z.string().nullable(),
  added_at: z.string(),
});

const recentDocumentsOutputSchema = {
  documents: z.array(recentDocumentSchema),
};

const downloadSchema = z.object({
  id: z.number(),
  original_filename: z.string(),
  mime_type: z.string(),
  file_size: z.number(),
  download_url: z.string(),
});

const downloadOutputSchema = {
  downloads: z.array(downloadSchema),
};

export async function handleMcpRequest(request: Request) {
  if (request.method === "POST") {
    return handlePostRequest(request);
  }

  if (request.method === "GET" || request.method === "DELETE") {
    const sessionId = request.headers.get("mcp-session-id");
    const session = getSession(request);

    if (!session) {
      return createJsonRpcErrorResponse(
        sessionId ? 404 : 400,
        -32000,
        sessionId ? "Session not found" : "Missing or invalid session",
      );
    }

    return session.transport.handleRequest(request);
  }

  return createJsonRpcErrorResponse(405, -32000, "Method not allowed");
}

async function handlePostRequest(request: Request) {
  const parsedBody = await parseJsonBody(request);

  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  const session = getSession(request);
  const sessionId = request.headers.get("mcp-session-id");

  if (session) {
    return session.transport.handleRequest(request, { parsedBody });
  }

  if (sessionId) {
    return createJsonRpcErrorResponse(404, -32000, "Session not found");
  }

  if (!isInitializeRequest(parsedBody)) {
    return createJsonRpcErrorResponse(
      400,
      -32000,
      "Bad Request: No valid session ID provided",
    );
  }

  const newSession = await createSession();
  return newSession.transport.handleRequest(request, { parsedBody });
}

async function createSession(): Promise<McpSession> {
  const server = createKreuzaktMcpServer();

  let session: McpSession | undefined;
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: randomUUID,
    onsessioninitialized: (sessionId) => {
      if (session) {
        sessions.set(sessionId, session);
      }
    },
    onsessionclosed: (sessionId) => closeSession(sessionId),
  });

  session = { server, transport };
  transport.onclose = () => {
    const sessionId = transport.sessionId;

    if (sessionId) {
      void closeSession(sessionId);
    }
  };

  await server.connect(transport);
  return session;
}

async function closeSession(sessionId: string) {
  const session = sessions.get(sessionId);

  if (!session) {
    return;
  }

  sessions.delete(sessionId);
  await Promise.allSettled([session.server.close(), session.transport.close()]);
}

function getSession(request: Request) {
  const sessionId = request.headers.get("mcp-session-id");
  return sessionId ? sessions.get(sessionId) : undefined;
}

async function parseJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return createJsonRpcErrorResponse(400, -32700, "Invalid JSON body");
  }
}

function createKreuzaktMcpServer() {
  const server = new McpServer({
    name: "kreuzakt",
    version: "0.1.0",
  });

  server.registerTool(
    "search_documents",
    {
      description:
        "Search the document archive by natural-language query. Returns ranked document matches with snippets for quick triage.",
      inputSchema: {
        query: z
          .string()
          .trim()
          .min(1)
          .describe(
            "Search query. Uses SQLite FTS5 with stemming, so natural language and partial word variations work well.",
          ),
        limit: z
          .number()
          .int()
          .positive()
          .max(MAX_LIMIT)
          .default(DEFAULT_LIMIT)
          .describe("Maximum number of matching documents to return."),
      },
      outputSchema: searchOutputSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ query, limit }) => {
      const results = await (async () => {
        try {
          return await searchDocuments({ query, page: 1, limit });
        } catch (error) {
          if (
            error instanceof Error &&
            /fts5|syntax error/i.test(error.message)
          ) {
            throw new Error("Invalid FTS query syntax");
          }

          throw error;
        }
      })();

      const items = results.items.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        document_date: item.document_date,
        added_at: item.added_at,
        original_filename: item.original_filename,
        snippet: stripSnippetMarkers(item.snippet),
      }));

      return createArrayToolResult("results", items);
    },
  );

  server.registerTool(
    "get_document",
    {
      description:
        "Fetch one or more documents with full metadata and complete extracted text. Prefer `ids` for bulk reads.",
      inputSchema: {
        ids: z
          .array(z.number().int().positive())
          .min(1)
          .optional()
          .describe(
            "Document IDs to fetch. Preferred when reading multiple documents.",
          ),
        id: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Convenience form for reading a single document."),
      },
      outputSchema: documentOutputSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ id, ids }, extra) => {
      const normalizedIds = normalizeDocumentIds({ id, ids });
      const baseUrl = getBaseUrl(extra.requestInfo);
      const documents = await getDocumentsByIds(normalizedIds, { baseUrl });
      return createArrayToolResult("documents", documents);
    },
  );

  server.registerTool(
    "get_document_content",
    {
      description:
        "Fetch only the extracted text for one or more documents. Prefer `ids` for bulk reads when metadata is not needed.",
      inputSchema: {
        ids: z
          .array(z.number().int().positive())
          .min(1)
          .optional()
          .describe("Document IDs to fetch content for."),
        id: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "Convenience form for reading a single document's content.",
          ),
      },
      outputSchema: documentContentOutputSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ id, ids }) => {
      const normalizedIds = normalizeDocumentIds({ id, ids });
      const documents = await getDocumentContentsByIds(normalizedIds);
      return createArrayToolResult("contents", documents);
    },
  );

  server.registerTool(
    "list_recent_documents",
    {
      description:
        "List recently added documents, newest first. Optionally filter to documents added after a specific ISO 8601 timestamp.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .positive()
          .max(MAX_LIMIT)
          .default(DEFAULT_LIMIT)
          .describe("Maximum number of recent documents to return."),
        since: z
          .string()
          .optional()
          .describe(
            "Optional ISO 8601 timestamp. Only documents added after this timestamp are returned.",
          ),
      },
      outputSchema: recentDocumentsOutputSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ limit, since }) => {
      if (since && Number.isNaN(Date.parse(since))) {
        throw new Error("`since` must be a valid ISO 8601 timestamp");
      }

      const documents = await listDocuments({
        page: 1,
        limit,
        since,
      });
      const items = documents.items.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        document_date: item.document_date,
        added_at: item.added_at,
      }));

      return createArrayToolResult("documents", items);
    },
  );

  server.registerTool(
    "download_document",
    {
      description:
        "Get absolute download URLs for one or more original document files so a client can present or fetch the originals directly.",
      inputSchema: {
        ids: z
          .array(z.number().int().positive())
          .min(1)
          .optional()
          .describe("Document IDs to generate download URLs for."),
        id: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Convenience form for a single document download URL."),
      },
      outputSchema: downloadOutputSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ id, ids }, extra) => {
      const normalizedIds = normalizeDocumentIds({ id, ids });
      const baseUrl = getBaseUrl(extra.requestInfo);
      const downloads = await getDocumentsForDownload(normalizedIds, {
        baseUrl,
      });
      return createArrayToolResult("downloads", downloads);
    },
  );

  return server;
}

function createArrayToolResult<T>(key: string, items: T[]) {
  return {
    structuredContent: {
      [key]: items,
    },
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(items, null, 2),
      },
    ],
  };
}

function createJsonRpcErrorResponse(
  status: number,
  code: number,
  message: string,
) {
  return Response.json(
    {
      jsonrpc: "2.0",
      error: {
        code,
        message,
      },
      id: null,
    },
    { status },
  );
}

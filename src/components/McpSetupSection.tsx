"use client";

import { useSyncExternalStore } from "react";

const mcpUrlFromWindow = () => `${window.location.origin}/mcp`;
const subscribe = () => () => {};

export function McpSetupSection() {
  const mcpUrl = useSyncExternalStore(subscribe, mcpUrlFromWindow, () => "");

  if (!mcpUrl) return null;

  const claudeSnippet = JSON.stringify(
    {
      mcpServers: {
        docs: {
          command: "npx",
          args: ["mcp-remote@latest", mcpUrl],
        },
      },
    },
    null,
    2,
  );

  const cursorSnippet = JSON.stringify(
    {
      mcpServers: {
        docs: {
          type: "http",
          url: mcpUrl,
        },
      },
    },
    null,
    2,
  );

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
        MCP Server
      </h2>
      <p className="text-sm text-neutral-500">
        Connect an MCP client to Kreuzakt and ask questions about your
        documents. The endpoint is{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700">
          {mcpUrl}
        </code>
      </p>

      <details className="group rounded-lg border border-neutral-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-neutral-900 select-none">
          Claude Desktop &mdash;{" "}
          <code className="text-xs font-normal text-neutral-500">
            npx mcp-remote@latest
          </code>
        </summary>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <p className="text-sm text-neutral-500">
            <a
              href="https://www.npmjs.com/package/mcp-remote"
              className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              mcp-remote
            </a>{" "}
            bridges the HTTP MCP endpoint for clients that expect a local
            process. Add to your Claude Desktop config:
          </p>
          <CodeBlock>{claudeSnippet}</CodeBlock>
        </div>
      </details>

      <details className="group rounded-lg border border-neutral-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-neutral-900 select-none">
          Cursor &mdash;{" "}
          <code className="text-xs font-normal text-neutral-500">
            type: &quot;http&quot;
          </code>
        </summary>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <p className="text-sm text-neutral-500">
            Add to{" "}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700">
              .cursor/mcp.json
            </code>{" "}
            or your project&apos;s MCP settings:
          </p>
          <CodeBlock>{cursorSnippet}</CodeBlock>
        </div>
      </details>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-neutral-900 p-4 text-sm leading-relaxed text-neutral-100">
      <code>{children}</code>
    </pre>
  );
}

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
      <h2 className="section-title">MCP Server</h2>
      <p className="text-sm text-ink-mute">
        Connect an MCP client to Kreuzakt and ask questions about your
        documents. The endpoint is{" "}
        <code className="rounded-field bg-canvas-deep px-1.5 py-0.5 text-xs font-medium text-ink-soft">
          {mcpUrl}
        </code>
      </p>

      <details className="group rounded-card border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink select-none">
          Claude Desktop &mdash;{" "}
          <code className="text-xs font-normal text-ink-mute">
            npx mcp-remote@latest
          </code>
        </summary>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <p className="text-sm text-ink-mute">
            <a
              href="https://www.npmjs.com/package/mcp-remote"
              className="font-medium text-accent underline underline-offset-2 hover:text-accent-deep"
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

      <details className="group rounded-card border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink select-none">
          Cursor &mdash;{" "}
          <code className="text-xs font-normal text-ink-mute">
            type: &quot;http&quot;
          </code>
        </summary>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <p className="text-sm text-ink-mute">
            Add to{" "}
            <code className="rounded-field bg-canvas-deep px-1.5 py-0.5 text-xs font-medium text-ink-soft">
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
    <pre className="overflow-x-auto rounded-card bg-ink p-4 text-sm leading-relaxed text-canvas">
      <code>{children}</code>
    </pre>
  );
}

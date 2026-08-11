import { appConfig } from "@/lib/config";

export const runtime = "nodejs";

const UPSTREAM_CHAT_COMPLETIONS = `${appConfig.openaiBaseUrl.replace(/\/+$/, "")}/chat/completions`;

/**
 * Local OpenAI-compatible shim for Kreuzberg VLM OCR.
 *
 * Kreuzberg/liter-llm cannot send OpenRouter's `reasoning` body field, so
 * reasoning VLMs (e.g. qwen/qwen3.7-flash) spend a long time thinking and then
 * trip liter-llm's request timeout ("error decoding response body"). This route
 * injects `reasoning: { effort: "none", exclude: true }` before forwarding.
 *
 * Only accepts requests that present the configured API key (same key Kreuzberg
 * already sends). Intended for same-host calls from `kreuzakt-kreuzberg`.
 */
export async function POST(request: Request): Promise<Response> {
  const authorization = request.headers.get("authorization");
  if (!isConfiguredApiKey(authorization)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const upstreamBody = {
    ...body,
    reasoning: {
      effort: "none",
      exclude: true,
    },
  };

  const upstream = await fetch(UPSTREAM_CHAT_COMPLETIONS, {
    method: "POST",
    headers: {
      Authorization: authorization ?? "",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(upstreamBody),
    signal: AbortSignal.timeout(appConfig.ocrTimeoutSecs * 1000),
  });

  const responseBody = await upstream.arrayBuffer();
  return new Response(responseBody, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}

function isConfiguredApiKey(authorization: string | null): boolean {
  const configured = appConfig.openaiApiKey.trim();
  if (!configured || !authorization) {
    return false;
  }

  const expected = `Bearer ${configured}`;
  return authorization === expected;
}

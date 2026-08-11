import path from "node:path";

/** Dev default (`./data`); Docker image sets `DATA_DIR=/data` for one volume mount. */
const DEFAULT_DATA_DIR = path.join(process.cwd(), "data");

const _isDevMode = !!process.env.npm_command;
export function isDevMode() {
  return _isDevMode;
}

const dataDir = resolvePath(process.env.DATA_DIR, DEFAULT_DATA_DIR);

/** Default OpenAI-compatible base when `OPENAI_BASE_URL` is unset or blank. */
export const OPENROUTER_DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

/** Default per-request VLM OCR timeout (liter-llm's built-in default is only 60s). */
export const DEFAULT_OCR_VLM_TIMEOUT_SECS = 300;

const OPENAI_V1_PATH = /\/v1(?:\/|$)/;
const OPENROUTER_HOST = /(^|\.)openrouter\.ai$/i;

/** Ensure OpenAI-compatible clients hit `{origin}/v1/...`, not `{origin}/chat/completions`. */
export function normalizeOpenAiCompatibleBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return trimmed;
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");

  try {
    const parsed = new URL(withoutTrailingSlash);
    if (OPENAI_V1_PATH.test(parsed.pathname)) {
      return withoutTrailingSlash;
    }

    const pathPrefix =
      parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
    parsed.pathname = `${pathPrefix}/v1`;
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return OPENAI_V1_PATH.test(withoutTrailingSlash)
      ? withoutTrailingSlash
      : `${withoutTrailingSlash}/v1`;
  }
}

export const appConfig = {
  dataDir,
  ingestDir: resolvePath(process.env.INGEST_DIR, path.join(dataDir, "ingest")),
  importDir: resolvePath(process.env.IMPORT_DIR, path.join(dataDir, "import")),
  originalsDir: resolvePath(
    process.env.ORIGINALS_DIR,
    path.join(dataDir, "originals"),
  ),
  thumbnailsDir: resolvePath(
    process.env.THUMBNAILS_DIR,
    path.join(dataDir, "thumbnails"),
  ),
  dbPath: resolvePath(process.env.DB_PATH, path.join(dataDir, "docs-ai.db")),
  ocrModel: fromEnvVar(
    process.env.OCR_VLM_DEV_MODEL,
    process.env.OCR_VLM_MODEL,
    "qwen/qwen3.7-flash",
  ),
  /**
   * Per-request timeout for Kreuzberg → liter-llm VLM OCR calls.
   * liter-llm defaults to 60s, which is too short for reasoning VLMs
   * (e.g. qwen/qwen3.7-flash) and surfaces as "error decoding response body".
   */
  ocrTimeoutSecs: positiveIntFromEnv(
    process.env.OCR_VLM_TIMEOUT_SECS,
    DEFAULT_OCR_VLM_TIMEOUT_SECS,
  ),
  metadataModel: fromEnvVar(
    process.env.METADATA_LLM_DEV_MODEL,
    process.env.METADATA_LLM_MODEL,
    "openai/gpt-5.4",
  ),
  openaiBaseUrl: normalizeOpenAiCompatibleBaseUrl(
    fromEnvVar(
      process.env.OPENAI_DEV_URL,
      process.env.OPENAI_BASE_URL,
      OPENROUTER_DEFAULT_BASE_URL,
    ),
  ),
  openaiApiKey: fromEnvVar(
    process.env.OPENAI_DEV_API_KEY,
    process.env.OPENROUTER_KEY ?? process.env.OPENAI_API_KEY,
    process.env.OPENAI_DEV_KEY ?? "",
  ),
  port: Number(process.env.PORT ?? "3000"),
  /** Periodic WAL checkpoint; 0 disables the timer. */
  sqliteMaintenanceIntervalMs: intFromEnv(
    process.env.SQLITE_MAINTENANCE_INTERVAL_MS,
    1800_000,
  ),
  /** Optional periodic VACUUM (compaction); 0 disables. */
  sqliteVacuumIntervalMs: intFromEnv(process.env.SQLITE_VACUUM_INTERVAL_MS, 0),
  /** Poll the ingest dir instead of relying on inotify. Required on NFS/SMB/FUSE mounts. */
  ingestWatchPoll: boolFromEnv(process.env.INGEST_WATCH_POLL, false),
  ingestWatchPollIntervalMs: intFromEnv(
    process.env.INGEST_WATCH_POLL_INTERVAL_MS,
    2000,
  ),
} as const;

export type AppConfig = typeof appConfig;

/** True when the configured OpenAI-compatible base is OpenRouter. */
export function isOpenRouterBaseUrl(baseUrl: string): boolean {
  try {
    return OPENROUTER_HOST.test(new URL(baseUrl).hostname);
  } catch {
    return false;
  }
}

/**
 * Loopback OpenAI-compatible root used by Kreuzberg VLM OCR so we can inject
 * OpenRouter `reasoning` params that liter-llm cannot send.
 */
export function localVlmProxyBaseUrl(port: number = appConfig.port): string {
  return `http://127.0.0.1:${port}/api/vlm-proxy/v1`;
}

function fromEnvVar(
  devEnvVar: string | undefined,
  envVar: string | undefined,
  fallback: string,
) {
  const fromDevEnv = devEnvVar?.trim();
  if (isDevMode() && fromDevEnv) {
    return fromDevEnv;
  }

  const fromEnv = envVar?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  return fallback;
}

function resolvePath(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function intFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function positiveIntFromEnv(
  value: string | undefined,
  fallback: number,
): number {
  const n = intFromEnv(value, fallback);
  return n > 0 ? n : fallback;
}

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  const v = value?.trim().toLowerCase();
  if (!v) {
    return fallback;
  }
  if (v === "1" || v === "true" || v === "yes" || v === "on") {
    return true;
  }
  if (v === "0" || v === "false" || v === "no" || v === "off") {
    return false;
  }
  return fallback;
}

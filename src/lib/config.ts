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
    "openai/gpt-5.4-mini",
  ),
  metadataModel: fromEnvVar(
    process.env.METADATA_LLM_DEV_MODEL,
    process.env.METADATA_LLM_MODEL,
    "openai/gpt-5.4",
  ),
  openaiBaseUrl: fromEnvVar(
    process.env.OPENAI_DEV_URL,
    process.env.OPENAI_BASE_URL,
    OPENROUTER_DEFAULT_BASE_URL,
  ),
  openaiApiKey: fromEnvVar(
    process.env.OPENAI_DEV_API_KEY,
    process.env.OPENROUTER_KEY,
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
} as const;

export type AppConfig = typeof appConfig;

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

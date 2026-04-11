import path from "node:path";

const DEFAULT_DATA_DIR = path.join(process.cwd(), "data");

function resolvePath(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

const dataDir = resolvePath(process.env.DATA_DIR, DEFAULT_DATA_DIR);

/** Default OpenAI-compatible base when `OPENAI_BASE_URL` is unset or blank. */
export const OPENROUTER_DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

/** Empty `OPENAI_BASE_URL` falls back to OpenRouter (same as omitting the variable). */
function openAiCompatibleBaseUrl() {
  const fromEnv = process.env.OPENAI_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return OPENROUTER_DEFAULT_BASE_URL;
}

/** OpenRouter-first, same preference as eval; ignores empty strings so OPENROUTER_KEY is not shadowed. */
function openAiCompatibleApiKey() {
  const fromOpenRouter = process.env.OPENROUTER_KEY?.trim();
  if (fromOpenRouter) {
    return fromOpenRouter;
  }
  return process.env.OPENAI_API_KEY?.trim() ?? "";
}

export const appConfig = {
  dataDir,
  ingestDir: resolvePath(process.env.INGEST_DIR, path.join(dataDir, "ingest")),
  originalsDir: resolvePath(
    process.env.ORIGINALS_DIR,
    path.join(dataDir, "originals"),
  ),
  thumbnailsDir: resolvePath(
    process.env.THUMBNAILS_DIR,
    path.join(dataDir, "thumbnails"),
  ),
  dbPath: resolvePath(process.env.DB_PATH, path.join(dataDir, "docs-ai.db")),
  ocrModel: process.env.OCR_VLM_MODEL ?? "qwen/qwen3.5-122b-a10b",
  metadataModel: process.env.METADATA_LLM_MODEL ?? "qwen/qwen3.5-122b-a10b",
  openaiBaseUrl: openAiCompatibleBaseUrl(),
  openaiApiKey: openAiCompatibleApiKey(),
  port: Number(process.env.PORT ?? "3000"),
} as const;

export type AppConfig = typeof appConfig;

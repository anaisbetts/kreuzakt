import path from "node:path";

const DEFAULT_DATA_DIR = path.join(process.cwd(), "data");

function resolvePath(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

const dataDir = resolvePath(process.env.DATA_DIR, DEFAULT_DATA_DIR);

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
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://openrouter.ai/api/v1",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  port: Number(process.env.PORT ?? "3000"),
} as const;

export type AppConfig = typeof appConfig;

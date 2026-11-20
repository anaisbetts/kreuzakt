import path from "node:path";

import OpenAI from "openai";
import { z } from "zod";

import { appConfig } from "@/lib/config";
import { getPreferredLanguage } from "@/lib/settings";
import { isStemSupported } from "@/lib/stemming";

const metadataSchema = z.object({
  title: z.string(),
  description: z.string(),
  document_date: z.string().nullable(),
  language: z.string(),
});

export type GeneratedMetadata = z.infer<typeof metadataSchema>;

const LOG_PREFIX = "[metadata]";

function logMetadata(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args);
}

function logMetadataWarn(...args: unknown[]) {
  console.warn(LOG_PREFIX, ...args);
}

function logMetadataError(...args: unknown[]) {
  console.error(LOG_PREFIX, ...args);
}

function truncateForLog(value: string, maxChars: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxChars)}…`;
}

const openai = new OpenAI({
  baseURL: appConfig.openaiBaseUrl,
  apiKey: appConfig.openaiApiKey || "local-llm",
});

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fallbackTitle(originalFilename: string) {
  const baseName = path.parse(originalFilename).name;
  const normalized = baseName.replace(/[_-]+/g, " ").trim();
  return titleCase(normalized || "Untitled Document");
}

function fallbackMetadata(originalFilename: string): GeneratedMetadata {
  return {
    title: fallbackTitle(originalFilename),
    description: "",
    document_date: null,
    language: "en",
  };
}

const THINKING_TAG_PATTERN = /<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi;
const CODE_FENCE_PATTERN = /```[\w-]*[^\S\n]*\n?([\s\S]*?)```/g;
const OPENING_FENCE_PATTERN = /```[\w-]*[^\S\n]*\n?/;

// Some models wrap the JSON in a code fence, prepend <think> tags, or add prose around it.
function parseJsonObject(content: string): Partial<GeneratedMetadata> {
  const cleaned = content.replace(THINKING_TAG_PATTERN, "").trim();
  const candidates = [cleaned];

  for (const match of cleaned.matchAll(CODE_FENCE_PATTERN)) {
    const fenced = match[1]?.trim();
    if (fenced) {
      candidates.push(fenced);
    }
  }

  const openingFence = OPENING_FENCE_PATTERN.exec(cleaned);
  const closingFenceIndex = cleaned.lastIndexOf("```");
  if (openingFence) {
    const contentStart = openingFence.index + openingFence[0].length;
    if (closingFenceIndex > contentStart) {
      const outerFenced = cleaned.slice(contentStart, closingFenceIndex).trim();
      if (outerFenced) {
        candidates.push(outerFenced);
      }
    }
  }

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) {
    candidates.push(cleaned.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      const value: unknown = JSON.parse(candidate);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Partial<GeneratedMetadata>;
      }
    } catch {}
  }

  throw new Error("Response did not contain a JSON object");
}

export function parseMetadataResponse(
  content: string | null | undefined,
  originalFilename: string,
): GeneratedMetadata {
  if (!content) {
    logMetadataWarn(
      "LLM returned empty message content; using filename fallback",
      { originalFilename },
    );
    return fallbackMetadata(originalFilename);
  }

  try {
    const parsed = parseJsonObject(content);

    const parsedTitle =
      typeof parsed.title === "string" ? parsed.title.trim() : "";
    const title = parsedTitle || fallbackTitle(originalFilename);
    const description =
      typeof parsed.description === "string" ? parsed.description.trim() : "";
    const document_date =
      typeof parsed.document_date === "string" && parsed.document_date.trim()
        ? parsed.document_date.trim()
        : null;
    const rawLanguage =
      typeof parsed.language === "string"
        ? parsed.language.trim().toLowerCase().slice(0, 5)
        : "en";
    const language = isStemSupported(rawLanguage) ? rawLanguage : "en";

    const usedTitleFallback = !parsedTitle;
    logMetadata("parsed LLM JSON successfully", {
      originalFilename,
      usedTitleFallback,
      titleLength: title.length,
      descriptionLength: description.length,
      document_date,
      language,
    });

    return {
      title,
      description,
      document_date,
      language,
    };
  } catch (parseError) {
    logMetadataWarn("failed to parse metadata JSON; using filename fallback", {
      originalFilename,
      contentPreview: truncateForLog(content, 400),
      parseError:
        parseError instanceof Error ? parseError.message : String(parseError),
    });
    return fallbackMetadata(originalFilename);
  }
}

const METADATA_SYSTEM_PROMPT_BASE = `Extract metadata from the following document text.
Return JSON: { "title": "...", "description": "...", "document_date": "YYYY-MM-DD" | null, "language": "xx" }
- title: A concise, descriptive title for the document
- description: 1-2 sentences describing the document's content and purpose
- document_date: The date the document pertains to (not today's date), or null if unclear
- language: ISO 639-1 code for the primary language of the document (e.g. "en", "de", "fr", "es", "it", "pt", "nl", "sv", "no", "da", "fi", "ru", "cs", "ro", "hu")`;

export function buildMetadataSystemPrompt(
  preferredLanguage?: string | null,
): string {
  const trimmed = preferredLanguage?.trim();
  if (!trimmed) {
    return METADATA_SYSTEM_PROMPT_BASE;
  }

  return `${METADATA_SYSTEM_PROMPT_BASE}
Generate all text in the following language: ${trimmed}`;
}

// Strip `$schema` because some OpenAI-compatible endpoints reject it in `json_schema.schema`.
const { $schema: _metadataJsonSchemaDraft, ...METADATA_JSON_SCHEMA } =
  z.toJSONSchema(metadataSchema, { target: "draft-7" });

// llama.cpp only enforces JSON output when given a schema; a bare json_object is a hint.
// `strict` is left unset because not every OpenAI-compatible provider accepts it.
const METADATA_JSON_SCHEMA_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "document_metadata",
    schema: METADATA_JSON_SCHEMA,
  },
} as const;

// Providers that only support json_object answer json_schema with a 400 or 422.
export async function requestMetadataCompletion(
  client: OpenAI,
  model: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
) {
  try {
    return await client.chat.completions.create({
      model,
      messages,
      response_format: METADATA_JSON_SCHEMA_FORMAT,
    });
  } catch (error) {
    const status = (error as { status?: unknown } | null)?.status;
    if (status !== 400 && status !== 422) {
      throw error;
    }

    logMetadataWarn(
      "json_schema request failed with 400/422; retrying with json_object",
      { status, error: error instanceof Error ? error.message : error },
    );

    return client.chat.completions.create({
      model,
      messages,
      response_format: { type: "json_object" },
    });
  }
}

export async function generateDocumentMetadata(
  extractedText: string,
  originalFilename: string,
): Promise<GeneratedMetadata> {
  const textLength = extractedText.length;
  const textLengthTrimmed = extractedText.trim().length;

  logMetadata("generateDocumentMetadata called", {
    originalFilename,
    extractedTextChars: textLength,
    extractedTextCharsTrimmed: textLengthTrimmed,
    model: appConfig.metadataModel,
    hasApiKey: Boolean(appConfig.openaiApiKey),
  });

  if (!extractedText.trim()) {
    logMetadata(
      "no extracted text; skipping LLM, using filename fallback for title",
      { originalFilename },
    );
    return fallbackMetadata(originalFilename);
  }

  const startedAt = performance.now();

  try {
    const preferredLanguage = await getPreferredLanguage();

    logMetadata("calling metadata LLM", {
      originalFilename,
      model: appConfig.metadataModel,
      preferredLanguage,
    });

    const response = await requestMetadataCompletion(
      openai,
      appConfig.metadataModel,
      [
        {
          role: "system",
          content: buildMetadataSystemPrompt(preferredLanguage),
        },
        {
          role: "user",
          content: extractedText,
        },
      ],
    );

    const elapsedMs = Math.round(performance.now() - startedAt);
    const choice = response.choices[0];
    const rawContent = choice?.message?.content;
    const usage = response.usage;

    logMetadata("metadata LLM response received", {
      originalFilename,
      elapsedMs,
      responseId: response.id,
      model: response.model,
      finishReason: choice?.finish_reason ?? null,
      usage: usage
        ? {
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
          }
        : null,
      rawContentLength: rawContent?.length ?? 0,
      rawContentPreview: rawContent ? truncateForLog(rawContent, 300) : null,
    });

    const parsed = parseMetadataResponse(rawContent, originalFilename);

    logMetadata("generateDocumentMetadata finished", {
      originalFilename,
      elapsedMs,
      titlePreview: truncateForLog(parsed.title, 120),
      descriptionPreview: truncateForLog(parsed.description, 200),
      document_date: parsed.document_date,
      language: parsed.language,
    });

    return parsed;
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - startedAt);
    logMetadataError("metadata LLM request failed; using filename fallback", {
      originalFilename,
      elapsedMs,
      model: appConfig.metadataModel,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
    });
    return fallbackMetadata(originalFilename);
  }
}

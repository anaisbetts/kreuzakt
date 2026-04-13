import path from "node:path";

import OpenAI from "openai";

import { appConfig } from "@/lib/config";

export interface GeneratedMetadata {
  title: string;
  description: string;
  document_date: string | null;
}

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
  };
}

function parseMetadataResponse(
  content: string | null | undefined,
  originalFilename: string,
) {
  if (!content) {
    logMetadataWarn(
      "LLM returned empty message content; using filename fallback",
      { originalFilename },
    );
    return fallbackMetadata(originalFilename);
  }

  try {
    const parsed = JSON.parse(content) as Partial<GeneratedMetadata>;

    const title = parsed.title?.trim() || fallbackTitle(originalFilename);
    const description = parsed.description?.trim() || "";
    const document_date =
      typeof parsed.document_date === "string" && parsed.document_date.trim()
        ? parsed.document_date.trim()
        : null;

    const usedTitleFallback = !parsed.title?.trim();
    logMetadata("parsed LLM JSON successfully", {
      originalFilename,
      usedTitleFallback,
      titleLength: title.length,
      descriptionLength: description.length,
      document_date,
    });

    return {
      title,
      description,
      document_date,
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
    logMetadata("calling metadata LLM", {
      originalFilename,
      model: appConfig.metadataModel,
    });

    const response = await openai.chat.completions.create({
      model: appConfig.metadataModel,
      messages: [
        {
          role: "system",
          content: `Extract metadata from the following document text.
Return JSON: { "title": "...", "description": "...", "document_date": "YYYY-MM-DD" | null }
- title: A concise, descriptive title for the document
- description: 1-2 sentences describing the document's content and purpose
- document_date: The date the document pertains to (not today's date), or null if unclear`,
        },
        {
          role: "user",
          content: extractedText,
        },
      ],
      response_format: { type: "json_object" },
    });

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

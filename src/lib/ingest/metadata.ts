import path from "node:path";

import OpenAI from "openai";

import { appConfig } from "@/lib/config";

export interface GeneratedMetadata {
  title: string;
  description: string;
  document_date: string | null;
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
    return fallbackMetadata(originalFilename);
  }

  try {
    const parsed = JSON.parse(content) as Partial<GeneratedMetadata>;

    return {
      title: parsed.title?.trim() || fallbackTitle(originalFilename),
      description: parsed.description?.trim() || "",
      document_date:
        typeof parsed.document_date === "string" && parsed.document_date.trim()
          ? parsed.document_date.trim()
          : null,
    };
  } catch {
    return fallbackMetadata(originalFilename);
  }
}

export async function generateDocumentMetadata(
  extractedText: string,
  originalFilename: string,
): Promise<GeneratedMetadata> {
  if (!extractedText.trim()) {
    return fallbackMetadata(originalFilename);
  }

  try {
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

    return parseMetadataResponse(
      response.choices[0]?.message?.content,
      originalFilename,
    );
  } catch (error) {
    console.error("metadata generation failed", error);
    return fallbackMetadata(originalFilename);
  }
}

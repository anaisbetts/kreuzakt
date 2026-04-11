import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import OpenAI from "openai";

import { appConfig } from "../src/lib/config";

import type { CachedExtraction, FixtureInfo, JudgeScore } from "./types";

const JUDGE_SYSTEM_PROMPT = `You are an OCR quality evaluator. You will receive:
1. Images of the original document pages when available
2. Text extracted from that document by an OCR system

Score the extraction on three dimensions (0-5 each):

COMPLETENESS (0-5): Is all visible text from the original captured?
- 5: Every word, number, and symbol is present
- 4: Minor omissions (headers, footers, watermarks)
- 3: Noticeable gaps but most text is there
- 1-2: Significant text is missing
- 0: Most text is missing

ACCURACY (0-5): Is the extracted text correct?
- 5: Perfect transcription, no errors
- 4: Minor typos or character substitutions
- 3: Frequent errors but still readable
- 1-2: Garbled, hallucinated, or mostly wrong
- 0: Unusable

STRUCTURE (0-5): Is the document structure preserved?
- 5: Paragraphs, tables, lists, and reading order are correct
- 4: Minor structural issues
- 3: Structure is partially lost (merged columns, scrambled order)
- 1-2: Little meaningful structure preserved
- 0: No meaningful structure preserved

Return JSON:
{
  "completeness": <number>,
  "accuracy": <number>,
  "structure": <number>,
  "overall": <number>,
  "notes": "<brief explanation of major issues, if any>"
}

overall must be on the same 0-5 scale, weighted: 0.4 * accuracy + 0.35 * completeness + 0.25 * structure`;

function getImageMimeType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return null;
  }
}

async function renderDocumentImages(filePath: string) {
  const directImageMimeType = getImageMimeType(filePath);

  if (directImageMimeType) {
    const imageBuffer = await readFile(filePath);
    return {
      images: [
        {
          mimeType: directImageMimeType,
          base64: imageBuffer.toString("base64"),
        },
      ],
      warning: null,
    };
  }

  if (path.extname(filePath).toLowerCase() !== ".pdf") {
    return {
      images: [],
      warning:
        "Original document could not be rendered to images automatically for judging.",
    };
  }

  if (!Bun.which("pdftoppm")) {
    return {
      images: [],
      warning:
        "pdftoppm is not installed, so judging fell back to extracted-text-only mode.",
    };
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "docs-ai-eval-"));
  const prefix = path.join(tempDir, "page");

  try {
    const process = Bun.spawn(["pdftoppm", "-png", filePath, prefix], {
      stdout: "ignore",
      stderr: "pipe",
    });

    const exitCode = await process.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(process.stderr).text();
      return {
        images: [],
        warning: `pdftoppm failed while rendering pages: ${stderr.trim()}`,
      };
    }

    const entries = (await readdir(tempDir))
      .filter((name) => name.endsWith(".png"))
      .sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true }),
      );

    const images = await Promise.all(
      entries.map(async (name) => {
        const buffer = await readFile(path.join(tempDir, name));
        return {
          mimeType: "image/png",
          base64: buffer.toString("base64"),
        };
      }),
    );

    return {
      images,
      warning:
        images.length === 0
          ? "No page images were produced by pdftoppm; falling back to text-only judging."
          : null,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function judgeExtraction(
  fixture: FixtureInfo,
  extraction: CachedExtraction,
) {
  const openai = new OpenAI({
    baseURL: appConfig.openaiBaseUrl,
    apiKey: appConfig.openaiApiKey || "local-llm",
  });

  const rendered = await renderDocumentImages(fixture.filePath);
  const response = await openai.chat.completions.create({
    model: "anthropic/claude-4.6-opus",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: JUDGE_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Evaluate this OCR extraction.

Backend: ${extraction.backend}
Fixture: ${fixture.fileName}

${rendered.warning ? `Rendering note: ${rendered.warning}\n\n` : ""}Extracted text:
${extraction.extracted_text}`,
          },
          ...rendered.images.map((image) => ({
            type: "image_url" as const,
            image_url: {
              url: `data:${image.mimeType};base64,${image.base64}`,
            },
          })),
        ],
      },
    ],
  });

  const rawContent = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(rawContent) as JudgeScore;

  return {
    ...parsed,
    notes: rendered.warning
      ? `${parsed.notes ?? ""} ${rendered.warning}`.trim()
      : parsed.notes,
  } satisfies JudgeScore;
}

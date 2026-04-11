import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

import { getBackends } from "./config";
import { extractFixture, loadCachedExtraction } from "./extract";
import { judgeExtraction } from "./judge";
import { writeEvaluationReport } from "./report";
import type {
  CachedExtraction,
  EvaluatedFixtureResult,
  FixtureInfo,
} from "./types";

type CliOptions = {
  backends?: string[];
  judgeOnly: boolean;
  extractOnly: boolean;
  output: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    judgeOnly: false,
    extractOnly: false,
    output: path.resolve(process.cwd(), "eval/results"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--judge-only") {
      options.judgeOnly = true;
      continue;
    }

    if (arg === "--extract-only") {
      options.extractOnly = true;
      continue;
    }

    if (arg === "--backends") {
      options.backends = argv[index + 1]?.split(",").filter(Boolean) ?? [];
      index += 1;
      continue;
    }

    if (arg === "--output") {
      options.output = path.resolve(
        process.cwd(),
        argv[index + 1] ?? "eval/results",
      );
      index += 1;
    }
  }

  return options;
}

function inferDifficulty(fileName: string): FixtureInfo["difficulty"] {
  const lower = fileName.toLowerCase();

  if (
    lower.includes("blurry") ||
    lower.includes("handwritten") ||
    lower.includes("noise")
  ) {
    return "Hard";
  }

  if (
    lower.includes("scan") ||
    lower.includes("table") ||
    lower.includes("mixed")
  ) {
    return "Medium";
  }

  return "Easy";
}

async function loadFixtures(fixturesDir: string) {
  await mkdir(fixturesDir, { recursive: true });
  const entries = await readdir(fixturesDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .filter((entry) =>
      [".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif"].includes(
        path.extname(entry.name).toLowerCase(),
      ),
    )
    .map(
      (entry): FixtureInfo => ({
        fileName: entry.name,
        filePath: path.join(fixturesDir, entry.name),
        difficulty: inferDifficulty(entry.name),
      }),
    );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const fixturesDir = path.resolve(process.cwd(), "eval/fixtures");
  const outputDir = options.output;
  const cacheDir = path.join(outputDir, "cache");
  const backends = getBackends(options.backends);
  const fixtures = await loadFixtures(fixturesDir);

  if (fixtures.length === 0) {
    console.error(
      "No fixtures found in eval/fixtures. Add PDFs or images before running the evaluation.",
    );
    process.exit(1);
  }

  if (backends.length === 0) {
    console.error("No matching backends selected.");
    process.exit(1);
  }

  await mkdir(cacheDir, { recursive: true });

  const extractionMatrix = new Map<string, CachedExtraction>();

  for (const fixture of fixtures) {
    for (const backend of backends) {
      const extraction = options.judgeOnly
        ? await loadCachedExtraction(fixture, backend, cacheDir)
        : await extractFixture(fixture, backend, cacheDir);
      extractionMatrix.set(`${fixture.fileName}:${backend.name}`, extraction);
      console.log(
        `${options.judgeOnly ? "loaded cache for" : "extracted"} ${fixture.fileName} with ${backend.name}`,
      );
    }
  }

  if (options.extractOnly) {
    console.log(`Extraction cache written to ${cacheDir}`);
    return;
  }

  const results: EvaluatedFixtureResult[] = [];

  for (const fixture of fixtures) {
    for (const backend of backends) {
      const extraction = extractionMatrix.get(
        `${fixture.fileName}:${backend.name}`,
      );

      if (!extraction) {
        continue;
      }

      let score: Awaited<ReturnType<typeof judgeExtraction>> | undefined;
      let judgeError: string | undefined;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          score = await judgeExtraction(fixture, extraction);
          judgeError = undefined;
          break;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          if (attempt === 0) {
            console.error(
              `judge failed for ${fixture.fileName} (${backend.name}), retrying once: ${message}`,
            );
            continue;
          }
          judgeError = message;
        }
      }

      if (score) {
        results.push({
          fixture,
          backend,
          extraction,
          score,
        });
        console.log(`judged ${fixture.fileName} with ${backend.name}`);
      } else if (judgeError) {
        console.error(
          `judge failed for ${fixture.fileName} (${backend.name}) after retry: ${judgeError}`,
        );
        results.push({
          fixture,
          backend,
          extraction,
          judgeError,
        });
      }
    }
  }

  if (options.judgeOnly || !options.extractOnly) {
    const reportPath = await writeEvaluationReport(outputDir, {
      generatedAt: new Date().toISOString(),
      results,
    });

    console.log(`Report written to ${reportPath}`);

    const judgeFailures = results.filter((r) => r.judgeError).length;
    if (judgeFailures > 0) {
      console.error(
        `Warning: ${judgeFailures} judgement(s) failed; scores are omitted for those rows.`,
      );
      process.exitCode = 1;
    }
  }
}

await main();

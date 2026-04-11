import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { EvaluationReportData } from "./types";

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMoney(value: number) {
  return `$${value.toFixed(value < 0.01 ? 5 : 2)}`;
}

export async function writeEvaluationReport(
  outputDir: string,
  data: EvaluationReportData,
) {
  await mkdir(outputDir, { recursive: true });

  const byBackend = new Map<string, EvaluationReportData["results"]>();

  for (const result of data.results) {
    byBackend.set(result.backend.name, [
      ...(byBackend.get(result.backend.name) ?? []),
      result,
    ]);
  }

  const backendSummaries = [...byBackend.entries()]
    .map(([backendName, results]) => {
      const sample = results[0];
      const pageCount = results.reduce(
        (sum, result) => sum + (result.extraction.page_count ?? 1),
        0,
      );

      return {
        backendName,
        backendLabel: sample.backend.label,
        avgCompleteness: average(
          results.map((result) => result.score.completeness),
        ),
        avgAccuracy: average(results.map((result) => result.score.accuracy)),
        avgStructure: average(results.map((result) => result.score.structure)),
        avgOverall: average(results.map((result) => result.score.overall)),
        estimatedCost: pageCount * sample.backend.costPerPageEstimate,
        estimatedCostPerPage: sample.backend.costPerPageEstimate,
      };
    })
    .sort((left, right) => right.avgOverall - left.avgOverall);

  const recommendation = backendSummaries[0];
  const groupedByFixture = new Map<string, EvaluationReportData["results"]>();

  for (const result of data.results) {
    groupedByFixture.set(result.fixture.fileName, [
      ...(groupedByFixture.get(result.fixture.fileName) ?? []),
      result,
    ]);
  }

  const reportLines = [
    `# OCR Evaluation Report — ${data.generatedAt.slice(0, 10)}`,
    "",
    "## Summary",
    "",
    "| Backend | Avg Completeness | Avg Accuracy | Avg Structure | Avg Overall | Est. Cost/Page |",
    "|---------|------------------|--------------|---------------|-------------|----------------|",
    ...backendSummaries.map(
      (summary) =>
        `| ${summary.backendName} | ${summary.avgCompleteness.toFixed(2)} | ${summary.avgAccuracy.toFixed(2)} | ${summary.avgStructure.toFixed(2)} | ${summary.avgOverall.toFixed(2)} | ${formatMoney(summary.estimatedCostPerPage)} |`,
    ),
    "",
    recommendation
      ? `**Recommendation:** ${recommendation.backendName} — best observed overall score in this run.`
      : "**Recommendation:** No results available.",
    "",
    "## Per-Document Scores",
    "",
  ];

  for (const [fixtureName, results] of groupedByFixture.entries()) {
    const difficulty = results[0]?.fixture.difficulty ?? "Medium";
    reportLines.push(`### ${fixtureName} (${difficulty})`);
    reportLines.push(
      "| Backend | Complete | Accuracy | Structure | Overall | Notes |",
    );
    reportLines.push(
      "|---------|----------|----------|-----------|---------|-------|",
    );
    for (const result of results.sort((left, right) =>
      left.backend.name.localeCompare(right.backend.name),
    )) {
      reportLines.push(
        `| ${result.backend.name} | ${result.score.completeness.toFixed(1)} | ${result.score.accuracy.toFixed(1)} | ${result.score.structure.toFixed(1)} | ${result.score.overall.toFixed(1)} | ${result.score.notes.replaceAll("\n", " ")} |`,
      );
    }
    reportLines.push("");
  }

  reportLines.push("## Cost Analysis");
  reportLines.push("");
  reportLines.push("| Backend | Estimated Total Cost | Estimated Cost/Page |");
  reportLines.push("|---------|----------------------|---------------------|");
  for (const summary of backendSummaries) {
    reportLines.push(
      `| ${summary.backendName} | ${formatMoney(summary.estimatedCost)} | ${formatMoney(summary.estimatedCostPerPage)} |`,
    );
  }
  reportLines.push("");
  reportLines.push("## Raw Data");
  reportLines.push("");
  reportLines.push("Cached extractions are stored under `results/cache/`.");
  reportLines.push("");

  const reportPath = path.join(
    outputDir,
    `${data.generatedAt.slice(0, 10)}_report.md`,
  );
  await writeFile(reportPath, reportLines.join("\n"));

  return reportPath;
}

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { EvaluationReportData } from "./types";

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function fmtAvg(value: number | null) {
  return value == null ? "—" : value.toFixed(2);
}

function escapeCell(text: string) {
  return text.replaceAll("|", "\\|").replaceAll("\n", " ");
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
      const judged = results.filter(
        (
          result,
        ): result is typeof result & {
          score: NonNullable<(typeof result)["score"]>;
        } => result.score != null,
      );
      const avgCompleteness =
        judged.length > 0
          ? average(judged.map((result) => result.score.completeness))
          : null;
      const avgAccuracy =
        judged.length > 0
          ? average(judged.map((result) => result.score.accuracy))
          : null;
      const avgStructure =
        judged.length > 0
          ? average(judged.map((result) => result.score.structure))
          : null;
      const avgOverall =
        judged.length > 0
          ? average(judged.map((result) => result.score.overall))
          : null;

      return {
        backendName,
        backendLabel: sample.backend.label,
        judgedCount: judged.length,
        totalCount: results.length,
        avgCompleteness,
        avgAccuracy,
        avgStructure,
        avgOverall,
        estimatedCost: pageCount * sample.backend.costPerPageEstimate,
        estimatedCostPerPage: sample.backend.costPerPageEstimate,
      };
    })
    .sort((left, right) => {
      if (left.judgedCount === 0 && right.judgedCount > 0) {
        return 1;
      }
      if (left.judgedCount > 0 && right.judgedCount === 0) {
        return -1;
      }
      const lo = left.avgOverall ?? -Infinity;
      const ro = right.avgOverall ?? -Infinity;
      return ro - lo;
    });

  const recommendation = backendSummaries.find((row) => row.judgedCount > 0);
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
    "| Backend | Avg Completeness | Avg Accuracy | Avg Structure | Avg Overall | Est. Cost/Page | Judged |",
    "|---------|------------------|--------------|---------------|-------------|----------------|--------|",
    ...backendSummaries.map(
      (summary) =>
        `| ${summary.backendName} | ${fmtAvg(summary.avgCompleteness)} | ${fmtAvg(summary.avgAccuracy)} | ${fmtAvg(summary.avgStructure)} | ${fmtAvg(summary.avgOverall)} | ${formatMoney(summary.estimatedCostPerPage)} | ${summary.judgedCount}/${summary.totalCount} |`,
    ),
    "",
    recommendation
      ? `**Recommendation:** ${recommendation.backendName} — best average overall among backends with at least one successful judgement.`
      : "**Recommendation:** No successful judgements — all judge calls failed or there were no results.",
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
      if (result.judgeError) {
        reportLines.push(
          `| ${result.backend.name} | — | — | — | — | ${escapeCell(`Error: ${result.judgeError}`)} |`,
        );
      } else if (result.score) {
        reportLines.push(
          `| ${result.backend.name} | ${result.score.completeness.toFixed(1)} | ${result.score.accuracy.toFixed(1)} | ${result.score.structure.toFixed(1)} | ${result.score.overall.toFixed(1)} | ${escapeCell(result.score.notes)} |`,
        );
      }
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

  const judgeFailures = data.results.filter((r) => r.judgeError);
  if (judgeFailures.length > 0) {
    reportLines.push("## Judge failures");
    reportLines.push("");
    for (const row of judgeFailures) {
      reportLines.push(
        `- **${row.fixture.fileName}** / \`${row.backend.name}\`: ${row.judgeError}`,
      );
    }
    reportLines.push("");
  }

  const reportPath = path.join(
    outputDir,
    `${data.generatedAt.slice(0, 10)}_report.md`,
  );
  await writeFile(reportPath, reportLines.join("\n"));

  return reportPath;
}

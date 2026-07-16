import type { BenchmarkResult } from "./types.js";

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const number = (value: number) => value.toFixed(1);
const configurationLabel = (summary: BenchmarkResult["models"][number]) => `${summary.model.provider}/${summary.model.id} [thinking:${summary.settings?.reasoning ?? "unknown"}, temp:${summary.settings?.temperature ?? "?"}, max:${summary.settings?.maxTokens ?? "?"}]`;

function comparisonTable(result: BenchmarkResult): string {
  return [
    "| Model | Pass rate | Score | Mean latency | P95 latency | Mean input tokens | Mean output tokens | Cost | Errors |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...result.models.map((summary) => `| ${configurationLabel(summary)} | ${percent(summary.passRate)} | ${number(summary.meanScore)} | ${number(summary.meanLatencyMs)} ms | ${number(summary.p95LatencyMs)} ms | ${number(summary.meanInputTokens)} | ${number(summary.meanOutputTokens)} | $${summary.totalCost.toFixed(6)} | ${percent(summary.errorRate)} |`),
  ].join("\n");
}

export function renderComparisonTable(summaries: BenchmarkResult["models"]): string {
  const rows = [
    ["Model", "Pass", "Score", "Mean ms", "P95 ms", "In tok", "Out tok", "Cost", "Errors"],
    ...summaries.map((summary) => [
      configurationLabel(summary),
      percent(summary.passRate),
      number(summary.meanScore),
      number(summary.meanLatencyMs),
      number(summary.p95LatencyMs),
      number(summary.meanInputTokens),
      number(summary.meanOutputTokens),
      `$${summary.totalCost.toFixed(6)}`,
      percent(summary.errorRate),
    ]),
  ];
  const widths = rows[0]?.map((_, column) => Math.max(...rows.map((row) => row[column]?.length ?? 0))) ?? [];
  const border = `+-${widths.join("-+-")}-+`;
  const formatRow = (row: string[], header = false) => `| ${row.map((value, column) => header || column === 0 ? value.padEnd(widths[column] ?? value.length) : value.padStart(widths[column] ?? value.length)).join(" | ")} |`;
  return [border, formatRow(rows[0] ?? [], true), border, ...rows.slice(1).map((row) => formatRow(row)), border].join("\n");
}

export function renderMarkdown(result: BenchmarkResult): string {
  const lines = [
    `# Model benchmark: ${result.profile.name}`,
    "",
    result.profile.description,
    "",
    `- Run: \`${result.runId}\``,
    `- Started: ${result.startedAt}`,
    `- Finished: ${result.finishedAt}`,
    `- Tasks: ${new Set(result.records.map((record) => record.taskId)).size}`,
    `- Attempts: ${result.records.length}`,
    "",
    "## Model comparison",
    "",
    comparisonTable(result),
    "",
    "## Method",
    "",
    "- The same task prompts were used for every configuration; reasoning and request settings are shown per configuration.",
    "- Requests were run sequentially to make ordering and rate-limit behavior auditable.",
    "- Quality was graded with deterministic rules from the profile.",
    "- Raw outputs and per-attempt measurements are included below for auditability.",
    "",
    "## Per-task results",
    "",
    ...result.records.map((record) => `### ${record.model.provider}/${record.model.id} · ${record.taskId} · attempt ${record.attempt}\n\n- Grade: **${record.grade.passed ? "PASS" : "FAIL"}** (${record.grade.score.toFixed(2)}) — ${record.grade.details}\n- Latency: ${record.latencyMs.toFixed(1)} ms\n- Tokens: ${record.usage.input} input, ${record.usage.output} output\n- Cost: $${record.usage.cost.total.toFixed(6)}\n\n<details><summary>Output</summary>\n\n${record.output}\n\n</details>`),
    "",
    "## Final comparison",
    "",
    "This summary is repeated at the end so it is visible when the report opens in Pi's editor.",
    "",
    "```text",
    renderComparisonTable(result.models),
    "```",
    "",
  ];
  return lines.join("\n");
}

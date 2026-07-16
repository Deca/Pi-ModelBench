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
  return summaries.map((summary, index) => {
    const settings = summary.settings;
    const configuration = `Configuration: ${summary.model.provider}/${summary.model.id}`;
    const controls = `Thinking: ${settings?.reasoning ?? "unknown"} | Temperature: ${settings?.temperature ?? "?"} | Max tokens: ${settings?.maxTokens ?? "?"}`;
    const quality = `Pass: ${percent(summary.passRate)} | Score: ${number(summary.meanScore)}`;
    const latency = `Mean latency: ${number(summary.meanLatencyMs)} ms | P95 latency: ${number(summary.p95LatencyMs)} ms`;
    const usage = `Input tokens: ${number(summary.meanInputTokens)} | Output tokens: ${number(summary.meanOutputTokens)}`;
    const economics = `Cost: $${summary.totalCost.toFixed(6)} | Errors: ${percent(summary.errorRate)}`;
    return `${index > 0 ? "\n" : ""}${configuration}\n${controls}\n${quality}\n${latency}\n${usage}\n${economics}`;
  }).join("\n");
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

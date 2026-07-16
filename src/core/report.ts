import type { BenchmarkResult } from "./types.js";

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const number = (value: number) => value.toFixed(1);

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
    "| Model | Pass rate | Score | Mean latency | P95 latency | Mean input tokens | Mean output tokens | Cost | Errors |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...result.models.map((summary) => `| ${summary.model.provider}/${summary.model.id} | ${percent(summary.passRate)} | ${number(summary.meanScore)} | ${number(summary.meanLatencyMs)} ms | ${number(summary.p95LatencyMs)} ms | ${number(summary.meanInputTokens)} | ${number(summary.meanOutputTokens)} | $${summary.totalCost.toFixed(6)} | ${percent(summary.errorRate)} |`),
    "",
    "## Method",
    "",
    "- Same task prompts and profile settings were used for every model.",
    "- Requests were run sequentially to make ordering and rate-limit behavior auditable.",
    "- Quality was graded with deterministic rules from the profile.",
    "- Raw outputs and per-attempt measurements are included below for auditability.",
    "",
    "## Per-task results",
    "",
    ...result.records.map((record) => `### ${record.model.provider}/${record.model.id} · ${record.taskId} · attempt ${record.attempt}\n\n- Grade: **${record.grade.passed ? "PASS" : "FAIL"}** (${record.grade.score.toFixed(2)}) — ${record.grade.details}\n- Latency: ${record.latencyMs.toFixed(1)} ms\n- Tokens: ${record.usage.input} input, ${record.usage.output} output\n- Cost: $${record.usage.cost.total.toFixed(6)}\n\n<details><summary>Output</summary>\n\n${record.output}\n\n</details>`),
    "",
  ];
  return lines.join("\n");
}

import type { BenchmarkResult, ModelSummary } from "./types.js";

const percent = (value: number | null | undefined) => value == null ? "N/A" : `${(value * 100).toFixed(1)}%`;
const number = (value: number | undefined) => (value ?? 0).toFixed(1);
const money = (value: number | undefined) => `$${(value ?? 0).toFixed(6)}`;

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function configurationLabel(summary: ModelSummary): string {
  return `${summary.model.provider}/${summary.model.id} [thinking:${summary.settings?.reasoning ?? "unknown"}, temp:${summary.settings?.temperature ?? "?"}, max:${summary.settings?.maxTokens ?? "?"}]`;
}

function summaryRows(summaries: BenchmarkResult["models"]): string[][] {
  return summaries.map((summary, index) => [
    `C${index + 1}`,
    percent(summary.passRate),
    number(summary.meanScore),
    percent(summary.consistencyRate),
    `${number(summary.meanLatencyMs)}/${number(summary.p95LatencyMs)}`,
    number(summary.meanOutputTokensPerSecond),
    percent(summary.errorRate),
  ]);
}

export function renderComparisonTable(summaries: BenchmarkResult["models"], totalCost?: number): string {
  const headers = ["Cfg", "Pass", "Score", "Stable", "Mean/P95 ms", "Out tok/s", "Errors"];
  const rows = summaryRows(summaries);
  const widths = headers.map((header, column) => Math.max(header.length, ...rows.map((row) => row[column]?.length ?? 0)));
  const formatRow = (row: string[]) => `| ${row.map((value, column) => value.padEnd(widths[column] ?? value.length)).join(" | ")} |`;
  const separator = `|-${widths.map((width) => "-".repeat(width)).join("-+-")}-|`;
  const legend = summaries.map((summary, index) => `C${index + 1}: ${configurationLabel(summary)}`);
  const calculatedTotal = totalCost ?? summaries.reduce((sum, summary) => sum + (summary.totalCost ?? 0), 0);
  return [formatRow(headers), separator, ...rows.map(formatRow), `Total bench cost: ${money(calculatedTotal)}`, "", ...legend].join("\n");
}

function htmlSummaryTable(result: BenchmarkResult): string {
  const rows = result.models.map((summary, index) => `<tr>
    <td><strong>C${index + 1}</strong></td>
    <td>${escapeHtml(configurationLabel(summary))}</td>
    <td>${percent(summary.passRate)}</td>
    <td>${number(summary.meanScore)}</td>
    <td>${percent(summary.consistencyRate)}</td>
    <td>${number(summary.meanLatencyMs)} / ${number(summary.p95LatencyMs)} ms</td>
    <td>${number(summary.meanOutputTokensPerSecond)}</td>
    <td>${percent(summary.errorRate)}</td>
  </tr>`).join("\n");
  return `<table>
    <thead><tr><th>Cfg</th><th>Configuration</th><th>Pass rate</th><th>Score</th><th>Stability</th><th>Mean / P95 latency</th><th>Output tok/s</th><th>Errors</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function htmlTaskTable(result: BenchmarkResult): string {
  const rows = result.models.flatMap((model, modelIndex) => (model.tasks ?? []).map((task) => `<tr>
    <td>C${modelIndex + 1}</td>
    <td>${escapeHtml(task.taskId)}</td>
    <td>${escapeHtml(task.tags.join(", "))}</td>
    <td>${percent(task.passRate)}</td>
    <td>${number(task.meanScore)}</td>
    <td>${number(task.meanLatencyMs)} / ${number(task.p95LatencyMs)} ms</td>
    <td>${percent(task.errorRate)}</td>
  </tr>`)).join("\n");
  return `<table>
    <thead><tr><th>Cfg</th><th>Task</th><th>Tags</th><th>Pass rate</th><th>Score</th><th>Mean / P95 latency</th><th>Errors</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="7">Task summaries are unavailable in this older run artifact.</td></tr>`}</tbody>
  </table>`;
}

function htmlAttempts(result: BenchmarkResult): string {
  return result.records.map((record) => `<details class="attempt">
    <summary>${escapeHtml(`${record.model.provider}/${record.model.id} · ${record.taskId} · attempt ${record.attempt}`)} — <strong>${record.grade.passed ? "PASS" : "FAIL"}</strong></summary>
    <dl>
      <dt>Grade</dt><dd>${number(record.grade.score)} — ${escapeHtml(record.grade.details)}</dd>
      <dt>Latency</dt><dd>${number(record.latencyMs)} ms</dd>
      <dt>Tokens</dt><dd>${record.usage.input} input / ${record.usage.output} output</dd>
      ${record.error ? `<dt>Error</dt><dd class="error">${escapeHtml(record.error)}</dd>` : ""}
    </dl>
    <h4>Prompt</h4><pre>${escapeHtml(record.prompt)}</pre>
    <h4>Output</h4><pre>${escapeHtml(record.output)}</pre>
  </details>`).join("\n");
}

export function renderHtml(result: BenchmarkResult): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ModelBench — ${escapeHtml(result.profile.name)} — ${escapeHtml(result.runId)}</title>
<style>
:root { color-scheme: light dark; --bg:#10141c; --panel:#18202c; --text:#e7edf5; --muted:#9eacbd; --line:#344255; --accent:#7dd3fc; --good:#86efac; --bad:#fca5a5; }
* { box-sizing:border-box; }
body { margin:0; padding:2rem; background:var(--bg); color:var(--text); font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif; }
main { max-width:1500px; margin:auto; }
h1,h2,h3 { line-height:1.2; } h1 { color:var(--accent); } h2 { margin-top:2rem; border-bottom:1px solid var(--line); padding-bottom:.5rem; }
.meta, .method { color:var(--muted); } .panel { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:1rem; overflow:auto; }
table { width:100%; border-collapse:collapse; min-width:850px; } th,td { text-align:left; border-bottom:1px solid var(--line); padding:.55rem .65rem; vertical-align:top; } th { color:var(--accent); white-space:nowrap; } td { white-space:nowrap; }
.attempt { border:1px solid var(--line); border-radius:8px; margin:.7rem 0; padding:.7rem 1rem; background:var(--panel); } summary { cursor:pointer; } pre { white-space:pre-wrap; overflow-wrap:anywhere; background:var(--bg); padding:.8rem; border-radius:6px; color:var(--text); } dt { color:var(--muted); float:left; clear:left; width:7rem; } dd { margin-left:7rem; } .error { color:var(--bad); }
.note { color:var(--muted); font-size:.9rem; }
</style>
</head>
<body><main>
<h1>ModelBench: ${escapeHtml(result.profile.name)}</h1>
<p>${escapeHtml(result.profile.description)}</p>
<div class="meta"><strong>Run:</strong> ${escapeHtml(result.runId)}<br><strong>Started:</strong> ${escapeHtml(result.startedAt)}<br><strong>Finished:</strong> ${escapeHtml(result.finishedAt)}<br><strong>Attempts:</strong> ${result.records.length}</div>
<h2>Configuration comparison</h2>
<div class="panel"><p class="total-cost"><strong>Total bench cost:</strong> ${money(result.totalCost ?? result.models.reduce((sum, model) => sum + (model.totalCost ?? 0), 0))}</p>${htmlSummaryTable(result)}</div>
<p class="note">Pass rate and score measure graded task quality. Stability is the share of tasks whose repeated attempts agreed (N/A when tasks were run once). Output tok/s and latency measure efficiency; the benchmark total cost is shown above.</p>
<h2>Per-task capability and precision</h2>
<div class="panel">${htmlTaskTable(result)}</div>
<h2>Method</h2>
<div class="method"><ul><li>The same task prompts were used for every configuration.</li><li>Reasoning and request settings are measured per configuration.</li><li>Requests were executed sequentially.</li><li>Quality was scored with the profile's deterministic graders.</li><li>Raw attempts are retained below for auditability.</li></ul></div>
<h2>Raw attempts</h2>
${htmlAttempts(result)}
</main></body></html>\n`;
}

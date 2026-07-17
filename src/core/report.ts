import { withOverallScores } from "./statistics.js";
import type { BenchmarkResult, ModelSummary } from "./types.js";

const percent = (value: number | null | undefined) => value == null ? "N/A" : `${(value * 100).toFixed(1)}%`;
const number = (value: number | undefined) => (value ?? 0).toFixed(1);
const formatDuration = (milliseconds: number | undefined) => {
  const value = milliseconds ?? 0;
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value.toFixed(0)}ms`;
};
const money = (value: number | undefined) => `$${(value ?? 0).toFixed(6)}`;
const runMoney = (value: number) => `$${value.toFixed(2)}`;
const metricNumber = (value: number | null | undefined) => value == null ? "N/A" : value.toFixed(1);

function benchmarkRounds(summary: ModelSummary): number {
  const taskCount = summary.tasks?.length ?? 0;
  return taskCount > 0 && summary.count > 0 ? summary.count / taskCount : Math.max(1, summary.settings?.runs ?? 1);
}

export function costPerBenchmarkRun(summary: ModelSummary): number {
  return summary.totalCost / benchmarkRounds(summary);
}

export function perfPerDollar(summary: ModelSummary): number | null {
  const cost = costPerBenchmarkRun(summary);
  return cost > 0 ? (summary.passRate * 100) / cost : null;
}

function reportTitle(profileName: string): string {
  return profileName.toLowerCase() === "simplebench" ? "SimpleBench" : `ModelBench — ${profileName}`;
}

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
    String(summary.tasks?.length ?? 0),
    summary.verificationTestsTotal == null ? "N/A" : `${summary.verificationTestsPassed ?? 0}/${summary.verificationTestsTotal}`,
    percent(summary.passRate),
    number(summary.meanScore),
    number(summary.overallScore),
    percent(summary.consistencyRate),
    `${formatDuration(summary.meanLatencyMs)}/${formatDuration(summary.p95LatencyMs)}`,
    number(summary.meanOutputTokens),
    runMoney(costPerBenchmarkRun(summary)),
    metricNumber(perfPerDollar(summary)),
    number(summary.meanOutputTokensPerSecond),
    percent(summary.errorRate),
  ]);
}

export function renderComparisonTable(summaries: BenchmarkResult["models"], totalCost?: number): string {
  const headers = ["Cfg", "Tasks", "Tests", "Pass", "Score", "Overall", "Stable", "Mean/P95", "Out tok/Q", "$/run", "Perf/$", "Out tok/s", "Errors"];
  const rows = summaryRows(withOverallScores(summaries));
  const widths = headers.map((header, column) => Math.max(header.length, ...rows.map((row) => row[column]?.length ?? 0)));
  const formatRow = (row: string[]) => `| ${row.map((value, column) => value.padEnd(widths[column] ?? value.length)).join(" | ")} |`;
  const separator = `|-${widths.map((width) => "-".repeat(width)).join("-+-")}-|`;
  const legend = summaries.map((summary, index) => `C${index + 1}: ${configurationLabel(summary)}`);
  const calculatedTotal = totalCost ?? summaries.reduce((sum, summary) => sum + (summary.totalCost ?? 0), 0);
  const totalAttempts = summaries.reduce((sum, summary) => sum + summary.count, 0);
  const roundsPerConfig = summaries.length > 0 ? Math.max(...summaries.map(benchmarkRounds)) : 1;
  const tasksPerConfig = summaries[0]?.tasks?.length ?? 0;
  const footer = [
    `Rounds per model: ${roundsPerConfig}`,
    `Tasks per model: ${tasksPerConfig}`,
    `Total attempts: ${totalAttempts}`,
    `Total bench cost: ${money(calculatedTotal)}`,
    "Perf/$ = pass-rate percentage / cost for one complete benchmark run",
    "Overall = 60% pass + 20% relative cost efficiency + 20% relative latency efficiency",
    "",
    ...legend,
  ];
  return [formatRow(headers), separator, ...rows.map(formatRow), ...footer].join("\n");
}

function htmlSummaryTable(result: BenchmarkResult): string {
  const rows = withOverallScores(result.models).map((summary, index) => `<tr>
    <td><strong>C${index + 1}</strong></td>
    <td>${escapeHtml(configurationLabel(summary))}</td>
    <td>${summary.tasks?.length ?? 0}</td>
    <td>${summary.verificationTestsTotal == null ? "N/A" : `${summary.verificationTestsPassed ?? 0}/${summary.verificationTestsTotal}`}</td>
    <td>${percent(summary.passRate)}</td>
    <td>${number(summary.meanScore)}</td>
    <td>${number(summary.overallScore)}</td>
    <td>${percent(summary.consistencyRate)}</td>
    <td>${formatDuration(summary.meanLatencyMs)} / ${formatDuration(summary.p95LatencyMs)}</td>
    <td>${number(summary.meanOutputTokens)}</td>
    <td>${runMoney(costPerBenchmarkRun(summary))}</td>
    <td>${metricNumber(perfPerDollar(summary))}</td>
    <td>${number(summary.meanOutputTokensPerSecond)}</td>
    <td>${percent(summary.errorRate)}</td>
  </tr>`).join("\n");
  return `<table>
    <thead><tr><th>Cfg</th><th>Configuration</th><th>Tasks</th><th>Tests</th><th>Pass rate</th><th>Score</th><th>Overall</th><th>Stability</th><th>Mean / P95 latency</th><th>Out tok/Q</th><th>$/run</th><th>Perf/$</th><th>Output tok/s</th><th>Errors</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function sameRecordConfiguration(record: BenchmarkResult["records"][number], model: ModelSummary): boolean {
  return record.model.provider === model.model.provider
    && record.model.id === model.model.id
    && record.settings.temperature === model.settings.temperature
    && record.settings.maxTokens === model.settings.maxTokens
    && record.settings.reasoning === model.settings.reasoning;
}

function htmlAttempt(record: BenchmarkResult["records"][number]): string {
  const coding = "coding" in record ? record.coding as {
    verification: { exitCode: number | null; signal: string | null; stdout: string; stderr: string; durationMs: number; timedOut: boolean; testsPassed: number | null; testsTotal: number | null; error?: string };
    failureCategory: string;
    toolTurns: number;
    changedFiles: string[];
    outsideScopeFiles: string[];
    diff: string;
    messages: unknown[];
  } : undefined;
  return `<details class="attempt">
    <summary>${escapeHtml(`attempt ${record.attempt}`)} — <strong>${record.grade.passed ? "PASS" : "FAIL"}</strong></summary>
    <dl>
      <dt>Grade</dt><dd>${number(record.grade.score)} — ${escapeHtml(record.grade.details)}</dd>
      <dt>Latency</dt><dd>${formatDuration(record.latencyMs)}</dd>
      <dt>Tokens</dt><dd>${record.usage.input} input / ${record.usage.output} output</dd>
      ${record.error ? `<dt>Error</dt><dd class="error">${escapeHtml(record.error)}</dd>` : ""}
      ${coding ? `<dt>Tool turns</dt><dd>${coding.toolTurns}</dd>
      <dt>Verification</dt><dd>${coding.verification.exitCode === 0 && !coding.verification.timedOut ? "passed" : "failed"} (${coding.verification.testsPassed ?? "?"}/${coding.verification.testsTotal ?? "?"} tests, ${formatDuration(coding.verification.durationMs)})</dd>
      <dt>Changed files</dt><dd>${escapeHtml(coding.changedFiles.join(", ") || "none")}</dd>
      <dt>Outside scope</dt><dd>${escapeHtml(coding.outsideScopeFiles.join(", ") || "none")}</dd>
      <dt>Failure category</dt><dd>${escapeHtml(coding.failureCategory)}</dd>` : ""}
    </dl>
    <h4>Prompt</h4><pre>${escapeHtml(record.prompt)}</pre>
    <h4>Output</h4><pre>${escapeHtml(record.output)}</pre>
    ${coding ? `<h4>Verification stdout</h4><pre>${escapeHtml(coding.verification.stdout)}</pre>
    <h4>Verification stderr</h4><pre>${escapeHtml(coding.verification.stderr)}</pre>
    <h4>Diff summary</h4><pre>${escapeHtml(coding.diff || "No repository changes")}</pre>
    <details><summary>Raw agent messages</summary><pre>${escapeHtml(JSON.stringify(coding.messages, null, 2))}</pre></details>` : ""}
  </details>`;
}

function htmlTaskTable(result: BenchmarkResult): string {
  const rows = result.models.flatMap((model, modelIndex) => (model.tasks ?? []).map((task) => {
    const attempts = result.records.filter((record) => record.taskId === task.taskId && sameRecordConfiguration(record, model));
    return `<details class="task-row">
    <summary><span>C${modelIndex + 1}</span><span>${escapeHtml(task.taskId)}</span><span>${escapeHtml(task.tags.join(", "))}</span><span>${percent(task.passRate)}</span><span>${number(task.meanScore)}</span><span>${formatDuration(task.meanLatencyMs)} / ${formatDuration(task.p95LatencyMs)}</span><span>${percent(task.errorRate)}</span></summary>
    <div class="task-attempts">${attempts.map(htmlAttempt).join("")}</div>
  </details>`;
  })).join("");
  return `<div class="task-list">
    <div class="task-row task-header"><span>Cfg</span><span>Task</span><span>Tags</span><span>Pass rate</span><span>Score</span><span>Mean / P95 latency</span><span>Errors</span></div>
    ${rows || `<p>Task summaries are unavailable in this older run artifact.</p>`}
  </div>`;
}

export function renderHtml(result: BenchmarkResult): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(reportTitle(result.profile.name))} — ${escapeHtml(result.runId)}</title>
<style>
:root { color-scheme: light dark; --bg:#10141c; --panel:#18202c; --text:#e7edf5; --muted:#9eacbd; --line:#344255; --accent:#7dd3fc; --good:#86efac; --bad:#fca5a5; }
* { box-sizing:border-box; }
body { margin:0; padding:2rem; background:var(--bg); color:var(--text); font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif; }
main { max-width:1500px; margin:auto; }
h1,h2,h3 { line-height:1.2; } h1 { color:var(--accent); } h2 { margin-top:2rem; border-bottom:1px solid var(--line); padding-bottom:.5rem; }
.meta, .method { color:var(--muted); } .panel { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:1rem; overflow:auto; }
table { width:100%; border-collapse:collapse; min-width:850px; } th,td { text-align:left; border-bottom:1px solid var(--line); padding:.55rem .65rem; vertical-align:top; } th { color:var(--accent); white-space:nowrap; } td { white-space:nowrap; }
.task-list { min-width:1050px; --task-columns:4rem minmax(12rem,1.4fr) minmax(14rem,2fr) minmax(6rem,.8fr) minmax(5rem,.7fr) minmax(10rem,1.4fr) minmax(5rem,.7fr); } .task-row { border-bottom:1px solid var(--line); } details.task-row > summary, .task-header { display:grid; grid-template-columns:var(--task-columns); gap:.65rem; align-items:start; padding:.6rem .65rem .6rem 2rem; } details.task-row > summary { position:relative; cursor:pointer; list-style:none; } details.task-row > summary::-webkit-details-marker { display:none; } details.task-row > summary::before { content:"▸"; position:absolute; left:.65rem; top:.6rem; color:var(--accent); } details.task-row[open] > summary::before { content:"▾"; } .task-header { color:var(--accent); font-weight:600; white-space:nowrap; } details.task-row > summary span { min-width:0; overflow-wrap:anywhere; } .task-attempts { padding:.2rem 1rem .7rem 2rem; }
.attempt { border:1px solid var(--line); border-radius:8px; margin:.7rem 0; padding:.7rem 1rem; background:var(--panel); } summary { cursor:pointer; } pre { white-space:pre-wrap; overflow-wrap:anywhere; background:var(--bg); padding:.8rem; border-radius:6px; color:var(--text); } dt { color:var(--muted); float:left; clear:left; width:7rem; } dd { margin-left:7rem; } .error { color:var(--bad); }
.note { color:var(--muted); font-size:.9rem; }
</style>
</head>
<body><main>
<h1>${escapeHtml(reportTitle(result.profile.name))}</h1>
<p>${escapeHtml(result.profile.description)}</p>
<div class="meta"><strong>Run:</strong> ${escapeHtml(result.runId)}<br><strong>Started:</strong> ${escapeHtml(result.startedAt)}<br><strong>Finished:</strong> ${escapeHtml(result.finishedAt)}<br><strong>Attempts:</strong> ${result.records.length}<br><strong>Rounds per model:</strong> ${result.models.length > 0 ? Math.max(...result.models.map(benchmarkRounds)) : 1}<br><strong>Tasks per model:</strong> ${result.models[0]?.tasks?.length ?? 0}</div>
<h2>Configuration comparison</h2>
<div class="panel"><p class="total-cost"><strong>Total bench cost:</strong> ${money(result.totalCost ?? result.models.reduce((sum, model) => sum + (model.totalCost ?? 0), 0))}</p>${htmlSummaryTable(result)}</div>
<p class="note">Pass rate and score measure graded task quality. Perf/$ is the pass-rate percentage divided by the cost of one complete benchmark run; $/run normalizes repeated rounds. Overall is a within-run comparison: 60% pass rate, 20% relative cost efficiency, and 20% relative latency efficiency. It is not comparable across separate runs. Stability is the share of tasks whose repeated attempts agreed (N/A when tasks were run once). Output tok/Q, output tok/s, and latency measure efficiency; the benchmark total cost is shown above.</p>
<h2>Per-task capability and precision</h2>
<div class="panel">${htmlTaskTable(result)}</div>
<h2>Method</h2>
<div class="method"><ul><li>The same task prompts were used for every configuration.</li><li>Reasoning and request settings are measured per configuration.</li><li>Requests were executed sequentially.</li><li>Quality was scored with the profile's deterministic graders.</li><li>Expand each task's attempts to inspect raw prompts, outputs, and evidence.</li></ul></div>
</main></body></html>\n`;
}

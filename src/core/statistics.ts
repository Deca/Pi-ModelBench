import type { MetricSummary, ModelSummary, RunRecord, TaskSummary } from "./types.js";

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

export function summarizeRecords(records: RunRecord[]): MetricSummary {
  if (records.length === 0) {
    return {
      count: 0,
      passRate: 0,
      meanScore: 0,
      meanLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      meanInputTokens: 0,
      meanOutputTokens: 0,
      meanOutputTokensPerSecond: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      costPerSuccessfulAttempt: 0,
      consistencyRate: null,
      errorRate: 0,
    };
  }

  const total = (selector: (record: RunRecord) => number) => records.reduce((sum, record) => sum + selector(record), 0);
  const passedCount = total((record) => record.grade.passed ? 1 : 0);
  const taskGroups = new Map<string, RunRecord[]>();
  for (const record of records) {
    const group = taskGroups.get(record.taskId) ?? [];
    group.push(record);
    taskGroups.set(record.taskId, group);
  }
  const repeatedTaskGroups = [...taskGroups.values()].filter((group) => group.length > 1);
  const consistentTasks = repeatedTaskGroups.filter((group) => group.every((record) => record.grade.passed === group[0]?.grade.passed)).length;
  const codingRecords = records.filter((record): record is RunRecord & { coding: { verification: { testsPassed: number | null; testsTotal: number | null } } } => "coding" in record);
  const verificationTestsPassed = codingRecords.reduce((sum, record) => sum + (record.coding.verification.testsPassed ?? 0), 0);
  const verificationTestsTotal = codingRecords.reduce((sum, record) => sum + (record.coding.verification.testsTotal ?? 0), 0);

  return {
    count: records.length,
    passRate: passedCount / records.length,
    meanScore: total((record) => record.grade.score) / records.length,
    meanLatencyMs: total((record) => record.latencyMs) / records.length,
    p50LatencyMs: percentile(records.map((record) => record.latencyMs), 50),
    p95LatencyMs: percentile(records.map((record) => record.latencyMs), 95),
    meanInputTokens: total((record) => record.usage.input) / records.length,
    meanOutputTokens: total((record) => record.usage.output) / records.length,
    meanOutputTokensPerSecond: total((record) => record.latencyMs > 0 ? record.usage.output / (record.latencyMs / 1000) : 0) / records.length,
    totalInputTokens: total((record) => record.usage.input),
    totalOutputTokens: total((record) => record.usage.output),
    totalCost: total((record) => record.usage.cost.total),
    costPerSuccessfulAttempt: passedCount > 0 ? total((record) => record.usage.cost.total) / passedCount : 0,
    consistencyRate: repeatedTaskGroups.length > 0 ? consistentTasks / repeatedTaskGroups.length : null,
    errorRate: total((record) => record.error ? 1 : 0) / records.length,
    ...(codingRecords.length > 0 ? { verificationTestsPassed, verificationTestsTotal } : {}),
  };
}

export const OVERALL_SCORE_WEIGHTS = {
  quality: 0.6,
  cost: 0.2,
  latency: 0.2,
} as const;

/**
 * Score configurations relative to one another in the current run.
 * Quality is pass rate; cost and latency use best-value / current-value ratios.
 */
export function withOverallScores(summaries: ModelSummary[]): ModelSummary[] {
  if (summaries.length === 0) return summaries;
  const positiveCosts = summaries.map((summary) => summary.totalCost).filter((value) => value > 0);
  const positiveLatencies = summaries.map((summary) => summary.meanLatencyMs).filter((value) => value > 0);
  const bestCost = positiveCosts.length > 0 ? Math.min(...positiveCosts) : 0;
  const bestLatency = positiveLatencies.length > 0 ? Math.min(...positiveLatencies) : 0;
  return summaries.map((summary) => {
    const costEfficiency = bestCost > 0 && summary.totalCost > 0 ? bestCost / summary.totalCost : 1;
    const latencyEfficiency = bestLatency > 0 && summary.meanLatencyMs > 0 ? bestLatency / summary.meanLatencyMs : 1;
    const overallScore = 100 * (
      OVERALL_SCORE_WEIGHTS.quality * summary.passRate
      + OVERALL_SCORE_WEIGHTS.cost * costEfficiency
      + OVERALL_SCORE_WEIGHTS.latency * latencyEfficiency
    );
    return { ...summary, overallScore };
  });
}

export function summarizeTaskRecords(records: RunRecord[]): TaskSummary[] {
  const grouped = new Map<string, RunRecord[]>();
  for (const record of records) {
    const group = grouped.get(record.taskId) ?? [];
    group.push(record);
    grouped.set(record.taskId, group);
  }
  return [...grouped.entries()].map(([taskId, taskRecords]) => ({
    taskId,
    tags: [...new Set(taskRecords.flatMap((record) => record.taskTags))],
    ...summarizeRecords(taskRecords),
  }));
}

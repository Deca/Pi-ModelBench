import type { MetricSummary, RunRecord } from "./types.js";

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

export function summarizeRecords(records: RunRecord[]): MetricSummary {
  if (records.length === 0) {
    return { count: 0, passRate: 0, meanScore: 0, meanLatencyMs: 0, p50LatencyMs: 0, p95LatencyMs: 0, meanInputTokens: 0, meanOutputTokens: 0, totalCost: 0, errorRate: 0 };
  }
  const total = (selector: (record: RunRecord) => number) => records.reduce((sum, record) => sum + selector(record), 0);
  return {
    count: records.length,
    passRate: total((record) => record.grade.passed ? 1 : 0) / records.length,
    meanScore: total((record) => record.grade.score) / records.length,
    meanLatencyMs: total((record) => record.latencyMs) / records.length,
    p50LatencyMs: percentile(records.map((record) => record.latencyMs), 50),
    p95LatencyMs: percentile(records.map((record) => record.latencyMs), 95),
    meanInputTokens: total((record) => record.usage.input) / records.length,
    meanOutputTokens: total((record) => record.usage.output) / records.length,
    totalCost: total((record) => record.usage.cost.total),
    errorRate: total((record) => record.error ? 1 : 0) / records.length,
  };
}

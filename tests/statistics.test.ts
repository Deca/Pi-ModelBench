import { describe, expect, it } from "vitest";
import { summarizeRecords } from "../src/core/statistics.js";
import type { RunRecord } from "../src/core/types.js";

const record = (latencyMs: number, passed: boolean): RunRecord => ({
  runId: "run",
  startedAt: "2026-01-01T00:00:00.000Z",
  profile: "test",
  taskId: "task",
  taskTags: [],
  attempt: 1,
  model: { provider: "fake", id: "model", api: "fake", name: "Fake", contextWindow: 1000, maxTokens: 100, cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 } },
  settings: { temperature: 0, maxTokens: 100, reasoning: "off" },
  prompt: "prompt",
  output: "output",
  grade: { passed, score: passed ? 1 : 0, details: "" },
  latencyMs,
  usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0, totalTokens: 15, cost: { input: 0.01, output: 0.01, cacheRead: 0, cacheWrite: 0, total: 0.02 } },
  stopReason: "stop",
});

describe("summarizeRecords", () => {
  it("calculates pass rate, averages, percentiles, and cost", () => {
    const summary = summarizeRecords([record(10, true), record(20, false), record(30, true)]);
    expect(summary.count).toBe(3);
    expect(summary.passRate).toBeCloseTo(2 / 3);
    expect(summary.meanLatencyMs).toBe(20);
    expect(summary.p50LatencyMs).toBe(20);
    expect(summary.p95LatencyMs).toBe(30);
    expect(summary.totalCost).toBeCloseTo(0.06);
    expect(summary.consistencyRate).toBe(0);
  });

  it("reports stability as unavailable when tasks run once", () => {
    expect(summarizeRecords([record(10, true)]).consistencyRate).toBeNull();
  });
});

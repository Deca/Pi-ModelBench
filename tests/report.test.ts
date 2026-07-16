import { describe, expect, it } from "vitest";
import { renderHtml } from "../src/core/report.js";
import type { BenchmarkResult } from "../src/core/types.js";

const result: BenchmarkResult = {
  schemaVersion: 1,
  runId: "run-1",
  startedAt: "2026-01-01T00:00:00.000Z",
  finishedAt: "2026-01-01T00:00:01.000Z",
  profile: { name: "test", description: "Test profile" },
  settings: { runs: 1, temperature: 0, maxTokens: 100, reasoning: "off" },
  models: [{
    model: { provider: "fake", id: "model", api: "fake", name: "Fake", contextWindow: 1000, maxTokens: 100, cost: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 } },
    settings: { runs: 1, temperature: 0, maxTokens: 100, reasoning: "off" },
    count: 1,
    passRate: 1,
    meanScore: 1,
    meanLatencyMs: 10,
    p50LatencyMs: 10,
    p95LatencyMs: 10,
    meanInputTokens: 1,
    meanOutputTokens: 1,
    meanOutputTokensPerSecond: 100,
    totalInputTokens: 1,
    totalOutputTokens: 1,
    totalCost: 0.01,
    costPerSuccessfulAttempt: 0.01,
    consistencyRate: 1,
    errorRate: 0,
    tasks: [{
      taskId: "task",
      tags: ["test"],
      count: 1,
      passRate: 1,
      meanScore: 1,
      meanLatencyMs: 10,
      p50LatencyMs: 10,
      p95LatencyMs: 10,
      meanInputTokens: 1,
      meanOutputTokens: 1,
      meanOutputTokensPerSecond: 100,
      totalInputTokens: 1,
      totalOutputTokens: 1,
      totalCost: 0.01,
      costPerSuccessfulAttempt: 0.01,
      consistencyRate: 1,
      errorRate: 0,
    }],
  }],
  records: [{
    runId: "run-1",
    startedAt: "2026-01-01T00:00:00.000Z",
    profile: "test",
    taskId: "task",
    taskTags: [],
    attempt: 1,
    model: { provider: "fake", id: "model", api: "fake", name: "Fake", contextWindow: 1000, maxTokens: 100, cost: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 } },
    settings: { temperature: 0, maxTokens: 100, reasoning: "off" },
    prompt: "prompt",
    output: "answer",
    grade: { passed: true, score: 1, details: "matched" },
    latencyMs: 10,
    usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.01 } },
    stopReason: "stop",
  }],
};

describe("renderHtml", () => {
  it("renders comparison, task, and raw-attempt sections", () => {
    const html = renderHtml(result);

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Configuration comparison");
    expect(html).toContain("Output tok/s");
    expect(html).toContain("Per-task capability and precision");
    expect(html).toContain("answer");
  });
});

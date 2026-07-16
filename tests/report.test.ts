import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/core/report.js";
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
    count: 1,
    passRate: 1,
    meanScore: 1,
    meanLatencyMs: 10,
    p50LatencyMs: 10,
    p95LatencyMs: 10,
    meanInputTokens: 1,
    meanOutputTokens: 1,
    totalCost: 0.01,
    errorRate: 0,
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

describe("renderMarkdown", () => {
  it("ends with a quick comparison summary after raw task output", () => {
    const markdown = renderMarkdown(result);
    const outputEnd = markdown.indexOf("</details>");
    const summaryStart = markdown.lastIndexOf("## Final comparison");

    expect(summaryStart).toBeGreaterThan(outputEnd);
    expect(markdown.slice(summaryStart)).toContain("fake/model");
    expect(markdown.slice(summaryStart)).toContain("Pass");
  });
});

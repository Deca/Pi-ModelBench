import { describe, expect, it } from "vitest";
import { renderComparisonTable } from "../src/core/report.js";
import type { ModelSummary } from "../src/core/types.js";

const summary: ModelSummary = {
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
  tasks: [],
};

describe("renderComparisonTable", () => {
  it("renders an aligned text table for plain CLI output", () => {
    const table = renderComparisonTable([summary]);

    expect(table).toContain("| Cfg | Pass");
    expect(table).toContain("C1: fake/model [thinking:off");
    expect(table).toContain("100.0%");
    expect(table).toContain("Mean/P95 ms");
    expect(table).toContain("Out tok/s");
  });
});

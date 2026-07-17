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

    expect(table).toContain("Overall");
    const header = table.split("\n", 1)[0] ?? "";
    expect(header.indexOf("Score")).toBeLessThan(header.indexOf("Overall"));
    expect(table).toContain("C1: fake/model [thinking:off");
    expect(table).toContain("100.0%");
    expect(table).toContain("Mean/P95");
    expect(table).toContain("Out tok/Q");
    expect(table).toContain("$/run");
    expect(table).toContain("Perf/$");
    expect(table).toContain("Tests");
    expect(table).toContain("Rounds per model: 1");
    expect(table).toContain("Tasks per model: 0");
    expect(table).toContain("Out tok/s");
    expect(table).toContain("Overall = 60% pass");
    expect(table).toContain("Total bench cost");

    const repeatedTable = renderComparisonTable([{
      ...summary,
      count: 2,
      settings: { ...summary.settings, runs: 2 },
    }]);
    expect(repeatedTable).toContain("20000.0");
  });
});

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
  totalCost: 0.01,
  errorRate: 0,
};

describe("renderComparisonTable", () => {
  it("renders an aligned text table for plain CLI output", () => {
    const table = renderComparisonTable([summary]);

    expect(table).toContain("Configuration: fake/model");
    expect(table).toContain("Thinking: off");
    expect(table).toContain("Pass: 100.0%");
    expect(table).toContain("P95 latency: 10.0 ms");
    expect(table).not.toContain("| Pass |");
  });
});

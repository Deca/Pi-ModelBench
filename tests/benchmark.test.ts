import { describe, expect, it } from "vitest";
import type { Api, Model } from "@earendil-works/pi-ai";
import { runBenchmark } from "../src/core/benchmark.js";
import type { BenchmarkProfile, ModelRunner } from "../src/core/types.js";

const model = { provider: "fake", id: "alpha", api: "fake", name: "Alpha", contextWindow: 1000, maxTokens: 100, reasoning: false, input: ["text"], baseUrl: "fake", cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 } } as Model<Api>;
const profile: BenchmarkProfile = {
  name: "test",
  description: "test profile",
  defaults: { runs: 2, temperature: 0, maxTokens: 100, reasoning: "off" },
  tasks: [{ id: "task", prompt: "answer", grader: { type: "exact", expected: "ok" } }],
};

const runner: ModelRunner = {
  async run(currentModel, task, settings) {
    return {
      runId: "",
      startedAt: "2026-01-01T00:00:00.000Z",
      profile: "",
      taskId: task.id,
      taskTags: [],
      attempt: 0,
      model: { provider: currentModel.provider, id: currentModel.id, api: currentModel.api, name: currentModel.name, contextWindow: currentModel.contextWindow, maxTokens: currentModel.maxTokens, cost: currentModel.cost },
      settings,
      prompt: task.prompt,
      output: "ok",
      grade: { passed: true, score: 1, details: "matched" },
      latencyMs: 10,
      usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "stop",
    };
  },
};

describe("runBenchmark", () => {
  it("runs every model/task/attempt and emits stable progress", async () => {
    const progress: number[] = [];
    const result = await runBenchmark(profile, [model], runner, (_record, completed) => progress.push(completed));
    expect(result.records).toHaveLength(2);
    expect(result.records.map((record) => record.attempt)).toEqual([1, 2]);
    expect(progress).toEqual([1, 2]);
    expect(result.models[0]?.passRate).toBe(1);
  });
});

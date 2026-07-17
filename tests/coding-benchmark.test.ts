import { describe, expect, it } from "vitest";
import type { Api, Model } from "@earendil-works/pi-ai";
import { loadCodingAgentProfile } from "../src/core/coding-fixtures.js";
import { runCodingBenchmark } from "../src/core/coding-benchmark.js";
import type { CodingModelRunner, CodingRunRecord } from "../src/core/types.js";

const model = { provider: "fake", id: "coding-model", api: "fake", name: "Coding Model", contextWindow: 1000, maxTokens: 100, reasoning: false, input: ["text"], baseUrl: "fake", cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 } } as Model<Api>;
const loadedProfile = loadCodingAgentProfile(process.cwd());
const profile = {
  ...loadedProfile,
  tasks: loadedProfile.tasks.filter((task) => task.id === "bug-edge-case"),
  defaults: { ...loadedProfile.defaults, runs: 2 },
};

const runner: CodingModelRunner = {
  async run(currentModel, task, settings): Promise<CodingRunRecord> {
    const passed = task.id === "bug-edge-case";
    return {
      runId: "",
      startedAt: "2026-01-01T00:00:00.000Z",
      profile: "",
      taskId: task.id,
      taskTags: task.tags,
      attempt: 0,
      model: { provider: currentModel.provider, id: currentModel.id, api: currentModel.api, name: currentModel.name, contextWindow: currentModel.contextWindow, maxTokens: currentModel.maxTokens, cost: currentModel.cost },
      settings,
      prompt: task.prompt,
      output: "done",
      grade: { passed, score: passed ? 1 : 0, details: passed ? "Verification passed" : "Verification failed" },
      latencyMs: 10,
      usage: { input: 2, output: 3, cacheRead: 0, cacheWrite: 0, totalTokens: 5, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.01 } },
      stopReason: "stop",
      coding: {
        verification: { exitCode: passed ? 0 : 1, signal: null, stdout: "", stderr: "", durationMs: 1, timedOut: false, testsPassed: passed ? 1 : 0, testsTotal: 1 },
        failureCategory: passed ? "none" : "verification",
        toolTurns: 2,
        changedFiles: ["src/paginator.js"],
        outsideScopeFiles: [],
        diff: "diff",
        messages: [],
      },
    };
  },
};

describe("runCodingBenchmark", () => {
  it("runs coding tasks in stable model/task/attempt order and preserves coding evidence", async () => {
    const progress: number[] = [];
    const result = await runCodingBenchmark(profile, [{ model, settings: profile.defaults }], runner, (_record, completed) => progress.push(completed));

    expect(result.records).toHaveLength(2);
    expect(result.records.map((record) => record.attempt)).toEqual([1, 2]);
    expect(progress).toEqual([1, 2]);
    expect(result.records[0]?.coding.changedFiles).toEqual(["src/paginator.js"]);
    expect(result.models[0]?.passRate).toBe(1);
  });
});

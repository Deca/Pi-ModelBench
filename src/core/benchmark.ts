import { randomUUID } from "node:crypto";
import type { Api, Model } from "@earendil-works/pi-ai";
import { summarizeRecords } from "./statistics.js";
import type { BenchmarkProfile, BenchmarkResult, ModelRunner, ModelSummary, RunRecord } from "./types.js";

export async function runBenchmark(
  profile: BenchmarkProfile,
  models: Model<Api>[],
  runner: ModelRunner,
  onRecord?: (record: RunRecord, completed: number, total: number) => void,
): Promise<BenchmarkResult> {
  const runId = `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
  const startedAt = new Date().toISOString();
  const total = models.length * profile.tasks.length * profile.defaults.runs;
  const records: RunRecord[] = [];
  let completed = 0;

  // Deliberately sequential: stable ordering makes comparisons easier to audit and avoids rate-limit bursts.
  for (const model of models) {
    for (const task of profile.tasks) {
      for (let attempt = 1; attempt <= profile.defaults.runs; attempt += 1) {
        const record = await runner.run(model, task, profile.defaults);
        const completedRecord: RunRecord = { ...record, runId, profile: profile.name, attempt };
        records.push(completedRecord);
        completed += 1;
        onRecord?.(completedRecord, completed, total);
      }
    }
  }

  const summaries: ModelSummary[] = models.map((model) => ({
    model: records.find((record) => record.model.provider === model.provider && record.model.id === model.id)?.model ?? {
      provider: model.provider,
      id: model.id,
      api: model.api,
      name: model.name,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      cost: model.cost,
    },
    ...summarizeRecords(records.filter((record) => record.model.provider === model.provider && record.model.id === model.id)),
  }));

  return {
    schemaVersion: 1,
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    profile: { name: profile.name, description: profile.description },
    settings: profile.defaults,
    models: summaries,
    records,
  };
}

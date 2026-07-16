import { randomUUID } from "node:crypto";
import { summarizeRecords, summarizeTaskRecords } from "./statistics.js";
import type { BenchmarkProfile, BenchmarkResult, BenchmarkTarget, ModelRunner, ModelSummary, RunRecord } from "./types.js";

function sameSettings(
  left: Pick<BenchmarkProfile["defaults"], "temperature" | "maxTokens" | "reasoning">,
  right: BenchmarkProfile["defaults"],
): boolean {
  return left.temperature === right.temperature && left.maxTokens === right.maxTokens && left.reasoning === right.reasoning;
}

export async function runBenchmark(
  profile: BenchmarkProfile,
  targets: BenchmarkTarget[],
  runner: ModelRunner,
  onRecord?: (record: RunRecord, completed: number, total: number) => void,
): Promise<BenchmarkResult> {
  const runId = `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
  const startedAt = new Date().toISOString();
  const total = targets.reduce((sum, target) => sum + profile.tasks.length * target.settings.runs, 0);
  const records: RunRecord[] = [];
  let completed = 0;

  // Deliberately sequential: stable ordering makes comparisons easier to audit and avoids rate-limit bursts.
  for (const target of targets) {
    for (const task of profile.tasks) {
      for (let attempt = 1; attempt <= target.settings.runs; attempt += 1) {
        const record = await runner.run(target.model, task, target.settings);
        const completedRecord: RunRecord = { ...record, runId, profile: profile.name, attempt };
        records.push(completedRecord);
        completed += 1;
        onRecord?.(completedRecord, completed, total);
      }
    }
  }

  const summaries: ModelSummary[] = targets.map((target) => ({
    model: records.find((record) => record.model.provider === target.model.provider && record.model.id === target.model.id && sameSettings(record.settings, target.settings))?.model ?? {
      provider: target.model.provider,
      id: target.model.id,
      api: target.model.api,
      name: target.model.name,
      contextWindow: target.model.contextWindow,
      maxTokens: target.model.maxTokens,
      cost: target.model.cost,
    },
    settings: target.settings,
    tasks: summarizeTaskRecords(records.filter((record) => record.model.provider === target.model.provider && record.model.id === target.model.id && sameSettings(record.settings, target.settings))),
    ...summarizeRecords(records.filter((record) => record.model.provider === target.model.provider && record.model.id === target.model.id && sameSettings(record.settings, target.settings))),
  }));

  return {
    schemaVersion: 1,
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    profile: { name: profile.name, description: profile.description },
    settings: profile.defaults,
    totalCost: records.reduce((sum, record) => sum + record.usage.cost.total, 0),
    models: summaries,
    records,
  };
}

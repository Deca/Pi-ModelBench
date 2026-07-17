import { randomUUID } from "node:crypto";
import { summarizeRecords, summarizeTaskRecords, withOverallScores } from "./statistics.js";
import type { BenchmarkResult, BenchmarkTarget, CodingModelRunner, CodingAgentProfile, CodingRunRecord, ModelSummary, RunRecord } from "./types.js";

function sameConfiguration(record: RunRecord, target: BenchmarkTarget): boolean {
  return record.model.provider === target.model.provider
    && record.model.id === target.model.id
    && record.settings.temperature === target.settings.temperature
    && record.settings.maxTokens === target.settings.maxTokens
    && record.settings.reasoning === target.settings.reasoning;
}

function modelSummary(records: RunRecord[], target: BenchmarkTarget): ModelSummary {
  const matching = records.filter((record) => sameConfiguration(record, target));
  const first = matching[0];
  return {
    model: first?.model ?? {
      provider: target.model.provider,
      id: target.model.id,
      api: target.model.api,
      name: target.model.name,
      contextWindow: target.model.contextWindow,
      maxTokens: target.model.maxTokens,
      cost: target.model.cost,
    },
    settings: target.settings,
    tasks: summarizeTaskRecords(matching),
    ...summarizeRecords(matching),
  };
}

/** Run isolated coding tasks sequentially against independent model configurations. */
export async function runCodingBenchmark(
  profile: CodingAgentProfile,
  targets: BenchmarkTarget[],
  runner: CodingModelRunner,
  onRecord?: (record: CodingRunRecord, completed: number, total: number) => void,
): Promise<BenchmarkResult<CodingRunRecord>> {
  const runId = `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
  const startedAt = new Date().toISOString();
  const total = targets.reduce((sum, target) => sum + profile.tasks.length * target.settings.runs, 0);
  const records: CodingRunRecord[] = [];
  let completed = 0;

  for (const target of targets) {
    for (const task of profile.tasks) {
      for (let attempt = 1; attempt <= target.settings.runs; attempt += 1) {
        const record = await runner.run(target.model, task, target.settings);
        const completedRecord: CodingRunRecord = { ...record, runId, profile: profile.name, attempt };
        records.push(completedRecord);
        completed += 1;
        onRecord?.(completedRecord, completed, total);
      }
    }
  }

  return {
    schemaVersion: 1,
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    profile: { name: profile.name, description: profile.description },
    settings: profile.defaults,
    totalCost: records.reduce((sum, record) => sum + record.usage.cost.total, 0),
    models: withOverallScores(targets.map((target) => modelSummary(records, target))),
    records,
  };
}

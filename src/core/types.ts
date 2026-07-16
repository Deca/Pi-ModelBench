import type { Api, Model, Usage } from "@earendil-works/pi-ai";

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface GradeResult {
  passed: boolean;
  score: number;
  details: string;
}

export type BenchmarkGrader =
  | { type: "exact"; expected: string }
  | { type: "normalized-exact"; expected: string }
  | { type: "contains"; values: string[] }
  | { type: "regex"; pattern: string; flags?: string }
  | { type: "json-exact"; expected: unknown }
  | { type: "json-fields"; fields: Record<string, unknown> }
  | { type: "number"; expected: number; tolerance: number }
  | { type: "all"; graders: BenchmarkGrader[] };

export interface BenchmarkTask {
  id: string;
  prompt: string;
  grader: BenchmarkGrader;
  tags?: string[];
}

export interface BenchmarkProfile {
  name: string;
  description: string;
  defaults: {
    runs: number;
    temperature: number;
    maxTokens: number;
    reasoning: ThinkingLevel;
  };
  tasks: BenchmarkTask[];
}

export interface BenchmarkTarget {
  model: Model<Api>;
  settings: BenchmarkProfile["defaults"];
}

export interface ModelRef {
  provider: string;
  id: string;
  api: Api;
  name: string;
  contextWindow: number;
  maxTokens: number;
  cost: Model<Api>["cost"];
}

export interface RunRecord {
  runId: string;
  startedAt: string;
  profile: string;
  taskId: string;
  taskTags: string[];
  attempt: number;
  model: ModelRef;
  settings: {
    temperature: number;
    maxTokens: number;
    reasoning: ThinkingLevel;
  };
  prompt: string;
  output: string;
  grade: {
    passed: boolean;
    score: number;
    details: string;
  };
  latencyMs: number;
  usage: Usage;
  stopReason: string;
  error?: string;
}

export interface MetricSummary {
  count: number;
  passRate: number;
  meanScore: number;
  meanLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  meanInputTokens: number;
  meanOutputTokens: number;
  meanOutputTokensPerSecond: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  costPerSuccessfulAttempt: number;
  consistencyRate: number;
  errorRate: number;
}

export interface TaskSummary extends MetricSummary {
  taskId: string;
  tags: string[];
}

export interface ModelSummary extends MetricSummary {
  model: ModelRef;
  settings: BenchmarkProfile["defaults"];
  tasks: TaskSummary[];
}

export interface BenchmarkResult {
  schemaVersion: 1;
  runId: string;
  startedAt: string;
  finishedAt: string;
  profile: Pick<BenchmarkProfile, "name" | "description">;
  settings: BenchmarkProfile["defaults"];
  models: ModelSummary[];
  records: RunRecord[];
}

export interface ModelRunner {
  run(model: Model<Api>, task: BenchmarkTask, settings: BenchmarkProfile["defaults"]): Promise<RunRecord>;
}

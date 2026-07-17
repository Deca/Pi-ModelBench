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
  | { type: "final-answer"; expected: string }
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

export interface BenchmarkSettings {
  runs: number;
  temperature: number;
  maxTokens: number;
  reasoning: ThinkingLevel;
}

export type BenchmarkRequestSettings = Omit<BenchmarkSettings, "runs">;

export interface BenchmarkProfile {
  name: string;
  description: string;
  defaults: BenchmarkSettings;
  tasks: BenchmarkTask[];
}

export type CodingTaskDifficulty = "easy" | "medium" | "hard";

export interface CodingVerification {
  command: string;
  timeoutMs: number;
}

export interface CodingTaskDefinition {
  id: string;
  title: string;
  prompt: string;
  tags: string[];
  difficulty: CodingTaskDifficulty;
  workingDirectory: string;
  verification: CodingVerification;
}

export interface CodingAgentTask extends CodingTaskDefinition {
  fixtureDirectory: string;
  repositoryDirectory: string;
  verificationDirectory: string;
}

export interface CodingAgentProfile {
  kind: "coding-agent";
  name: "coding-agent";
  description: string;
  defaults: BenchmarkSettings;
  tasks: CodingAgentTask[];
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
  settings: BenchmarkRequestSettings;
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

export interface CodingVerificationResult {
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  testsPassed: number | null;
  testsTotal: number | null;
  error?: string;
}

export type CodingFailureCategory = "none" | "agent" | "verification" | "verification-timeout" | "runner";

export interface CodingAttemptDetails {
  verification: CodingVerificationResult;
  failureCategory: CodingFailureCategory;
  toolTurns: number;
  changedFiles: string[];
  outsideScopeFiles: string[];
  diff: string;
  messages: unknown[];
}

export interface CodingRunRecord extends RunRecord {
  coding: CodingAttemptDetails;
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
  consistencyRate: number | null;
  errorRate: number;
  verificationTestsPassed?: number;
  verificationTestsTotal?: number;
}

export interface TaskSummary extends MetricSummary {
  taskId: string;
  tags: string[];
}

export interface ModelSummary extends MetricSummary {
  /** Relative comparison score for this run; not comparable across runs. */
  overallScore?: number;
  model: ModelRef;
  settings: BenchmarkProfile["defaults"];
  tasks: TaskSummary[];
}

export interface BenchmarkResult<TRecord extends RunRecord = RunRecord> {
  schemaVersion: 1;
  runId: string;
  startedAt: string;
  finishedAt: string;
  profile: Pick<BenchmarkProfile, "name" | "description">;
  settings: BenchmarkProfile["defaults"];
  totalCost: number;
  models: ModelSummary[];
  records: TRecord[];
}

export interface ModelRunner {
  run(model: Model<Api>, task: BenchmarkTask, settings: BenchmarkProfile["defaults"]): Promise<RunRecord>;
}

export interface CodingModelRunner {
  run(model: Model<Api>, task: CodingAgentTask, settings: BenchmarkSettings): Promise<CodingRunRecord>;
}

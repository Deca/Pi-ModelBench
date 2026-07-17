import { createAgentSession, ModelRegistry, SessionManager } from "@earendil-works/pi-coding-agent";
import type { Api, AssistantMessage, Model, Usage } from "@earendil-works/pi-ai";
import { performance } from "node:perf_hooks";
import { executeVerification, snapshotFiles, summarizeFileChanges, withIsolatedCodingWorkspace, type VerificationResult } from "./coding-workspace.js";
import { modelRef } from "./pi-runner.js";
import type { BenchmarkSettings, CodingAgentTask, CodingFailureCategory, CodingModelRunner, CodingRunRecord, CodingVerificationResult } from "./types.js";

const zeroUsage = (): Usage => ({
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
});

function addUsage(total: Usage, next: Usage): Usage {
  return {
    input: total.input + next.input,
    output: total.output + next.output,
    cacheRead: total.cacheRead + next.cacheRead,
    cacheWrite: total.cacheWrite + next.cacheWrite,
    totalTokens: total.totalTokens + next.totalTokens,
    cost: {
      input: total.cost.input + next.cost.input,
      output: total.cost.output + next.cost.output,
      cacheRead: total.cost.cacheRead + next.cost.cacheRead,
      cacheWrite: total.cost.cacheWrite + next.cost.cacheWrite,
      total: total.cost.total + next.cost.total,
    },
  };
}

function textFromAssistant(message: AssistantMessage): string {
  return message.content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
}

function verificationPassed(result: VerificationResult): boolean {
  return result.exitCode === 0 && !result.timedOut && !result.error;
}

function failureCategory(result: VerificationResult, agentError?: string): CodingFailureCategory {
  if (agentError) return "agent";
  if (result.timedOut) return "verification-timeout";
  if (!verificationPassed(result)) return "verification";
  return "none";
}

function verificationDetails(result: VerificationResult, agentError?: string): string {
  if (agentError) return `Agent run failed: ${agentError}`;
  if (result.timedOut) return `Verification timed out after ${result.durationMs.toFixed(0)}ms`;
  if (result.error) return `Verification could not start: ${result.error}`;
  if (result.exitCode !== 0) return `Verification failed with exit code ${result.exitCode ?? "unknown"}`;
  return "Verification passed";
}

function codingVerification(result: VerificationResult): CodingVerificationResult {
  return result;
}

function failedCodingRecord(model: Model<Api>, task: CodingAgentTask, settings: BenchmarkSettings, startedAt: Date, latencyMs: number, error: string): CodingRunRecord {
  return {
    runId: "",
    startedAt: startedAt.toISOString(),
    profile: "",
    taskId: task.id,
    taskTags: task.tags,
    attempt: 0,
    model: modelRef(model),
    settings,
    prompt: task.prompt,
    output: "",
    grade: { passed: false, score: 0, details: `Run failed: ${error}` },
    latencyMs,
    usage: zeroUsage(),
    stopReason: "error",
    error,
    coding: {
      verification: { exitCode: null, signal: null, stdout: "", stderr: "", durationMs: 0, timedOut: false, testsPassed: null, testsTotal: null, error },
      failureCategory: "runner",
      toolTurns: 0,
      changedFiles: [],
      outsideScopeFiles: [],
      diff: "",
      messages: [],
    },
  };
}

interface AgentExecution {
  output: string;
  usage: Usage;
  stopReason: string;
  toolTurns: number;
  messages: unknown[];
  error?: string;
}

export class PiCodingModelRunner implements CodingModelRunner {
  public constructor(private readonly modelRegistry: ModelRegistry) {}

  private async runAgent(model: Model<Api>, task: CodingAgentTask, settings: BenchmarkSettings, workingDirectory: string): Promise<AgentExecution> {
    let toolTurns = 0;
    const { session } = await createAgentSession({
      cwd: workingDirectory,
      model,
      thinkingLevel: settings.reasoning,
      modelRegistry: this.modelRegistry,
      authStorage: this.modelRegistry.authStorage,
      sessionManager: SessionManager.inMemory(workingDirectory),
      tools: ["read", "bash", "edit", "write"],
    });
    const unsubscribe = session.subscribe((event) => {
      if (event.type === "tool_execution_start") toolTurns += 1;
    });

    try {
      await session.prompt(task.prompt);
      const messages = [...session.messages];
      const assistantMessages = messages.filter((message): message is AssistantMessage => message.role === "assistant");
      const lastAssistant = assistantMessages.at(-1);
      return {
        output: lastAssistant ? textFromAssistant(lastAssistant) : "",
        usage: assistantMessages.reduce((total, message) => addUsage(total, message.usage), zeroUsage()),
        stopReason: lastAssistant?.stopReason ?? "stop",
        toolTurns,
        messages,
        ...(lastAssistant?.errorMessage ? { error: lastAssistant.errorMessage } : {}),
      };
    } finally {
      unsubscribe();
      session.dispose();
    }
  }

  async run(model: Model<Api>, task: CodingAgentTask, settings: BenchmarkSettings): Promise<CodingRunRecord> {
    const startedAt = new Date();
    const start = performance.now();
    try {
      return await withIsolatedCodingWorkspace(task, async (workspace) => {
        const before = await snapshotFiles(workspace.repositoryDirectory);
        const beforeVerification = await snapshotFiles(workspace.verificationDirectory);
        let agent: AgentExecution;
        try {
          agent = await this.runAgent(model, task, settings, workspace.workingDirectory);
        } catch (error) {
          agent = {
            output: "",
            usage: zeroUsage(),
            stopReason: "error",
            toolTurns: 0,
            messages: [],
            error: error instanceof Error ? error.message : String(error),
          };
        }
        const after = await snapshotFiles(workspace.repositoryDirectory);
        const afterVerification = await snapshotFiles(workspace.verificationDirectory);
        const changes = summarizeFileChanges(before, after);
        const outsideScope = summarizeFileChanges(beforeVerification, afterVerification);
        const verification = await executeVerification(task.verification, workspace.workingDirectory);
        const passed = !agent.error && verificationPassed(verification);
        return {
          runId: "",
          startedAt: startedAt.toISOString(),
          profile: "",
          taskId: task.id,
          taskTags: task.tags,
          attempt: 0,
          model: modelRef(model),
          settings,
          prompt: task.prompt,
          output: agent.output,
          grade: { passed, score: passed ? 1 : 0, details: verificationDetails(verification, agent.error) },
          latencyMs: performance.now() - start,
          usage: agent.usage,
          stopReason: agent.stopReason,
          ...(agent.error ? { error: agent.error } : {}),
          coding: {
            verification: codingVerification(verification),
            failureCategory: failureCategory(verification, agent.error),
            toolTurns: agent.toolTurns,
            changedFiles: changes.changedFiles,
            outsideScopeFiles: outsideScope.changedFiles,
            diff: changes.diff,
            messages: agent.messages,
          },
        };
      });
    } catch (error) {
      return failedCodingRecord(model, task, settings, startedAt, performance.now() - start, error instanceof Error ? error.message : String(error));
    }
  }
}


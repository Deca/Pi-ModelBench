import { complete } from "@earendil-works/pi-ai/compat";
import type { Api, Message, Model } from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import { gradeOutput } from "./graders.js";
import type { BenchmarkProfile, BenchmarkTask, ModelRef, ModelRunner, RunRecord } from "./types.js";

function modelRef(model: Model<Api>): ModelRef {
  return {
    provider: model.provider,
    id: model.id,
    api: model.api,
    name: model.name,
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens,
    cost: model.cost,
  };
}

function textFromContent(content: Array<{ type: string; text?: string }>): string {
  return content.filter((item) => item.type === "text").map((item) => item.text ?? "").join("\n");
}

export class PiModelRunner implements ModelRunner {
  public constructor(private readonly modelRegistry: ModelRegistry) {}

  async run(model: Model<Api>, task: BenchmarkTask, settings: BenchmarkProfile["defaults"]): Promise<RunRecord> {
    const startedAt = new Date();
    const start = performance.now();
    const auth = await this.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok || !auth.apiKey) {
      const message = auth.ok ? `No API key configured for ${model.provider}` : auth.error;
      return this.failedRecord(model, task, settings, startedAt, performance.now() - start, message);
    }

    const userMessage: Message = { role: "user", content: task.prompt, timestamp: Date.now() };
    try {
      const response = await complete(model, { messages: [userMessage] }, {
        apiKey: auth.apiKey,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        maxRetries: 0,
        ...(auth.headers ? { headers: auth.headers } : {}),
        ...(auth.env ? { env: auth.env } : {}),
        ...(settings.reasoning !== "off" ? { reasoning: settings.reasoning } : {}),
      });
      const output = textFromContent(response.content as Array<{ type: string; text?: string }>);
      return {
        runId: "",
        startedAt: startedAt.toISOString(),
        profile: "",
        taskId: task.id,
        taskTags: task.tags ?? [],
        attempt: 0,
        model: modelRef(model),
        settings,
        prompt: task.prompt,
        output,
        grade: gradeOutput(output, task.grader),
        latencyMs: performance.now() - start,
        usage: response.usage,
        stopReason: response.stopReason,
        ...(response.errorMessage ? { error: response.errorMessage } : {}),
      };
    } catch (error) {
      return this.failedRecord(model, task, settings, startedAt, performance.now() - start, error instanceof Error ? error.message : String(error));
    }
  }

  private failedRecord(model: Model<Api>, task: BenchmarkTask, settings: BenchmarkProfile["defaults"], startedAt: Date, latencyMs: number, error: string): RunRecord {
    return {
      runId: "",
      startedAt: startedAt.toISOString(),
      profile: "",
      taskId: task.id,
      taskTags: task.tags ?? [],
      attempt: 0,
      model: modelRef(model),
      settings,
      prompt: task.prompt,
      output: "",
      grade: { passed: false, score: 0, details: `Run failed: ${error}` },
      latencyMs,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "error",
      error,
    };
  }
}

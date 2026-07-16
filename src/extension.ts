import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveModelScopeWithDiagnostics, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { runBenchmark } from "./core/benchmark.js";
import { loadProfiles } from "./core/profiles.js";
import { PiModelRunner } from "./core/pi-runner.js";
import { renderMarkdown } from "./core/report.js";
import type { BenchmarkProfile, ThinkingLevel } from "./core/types.js";

interface ParsedArgs {
  command: string;
  values: Map<string, string>;
  positional: string[];
}

function parseArgs(raw: string): ParsedArgs {
  const tokens = raw.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((token) => token.replace(/^"|"$/g, "")) ?? [];
  const positional: string[] = [];
  const values = new Map<string, string>();
  let command = "help";
  if (tokens[0] && !tokens[0].startsWith("--")) command = tokens.shift() ?? "help";
  while (tokens.length > 0) {
    const token = tokens.shift() ?? "";
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    const key = token.slice(2);
    const value = tokens[0]?.startsWith("--") ? "true" : (tokens.shift() ?? "true");
    values.set(key, value);
  }
  return { command, values, positional };
}

function usage(): string {
  return [
    "Usage:",
    "  /benchmark profiles",
    "  /benchmark models [--available]",
    "  /benchmark <profile> --models provider/model[,provider/model] [--runs 3] [--format markdown|json]",
    "  /benchmark report <run-id>",
    "",
    "Examples:",
    "  /benchmark coding --models openai/gpt-5.6,anthropic/claude-sonnet-4-5 --runs 2",
    "  /benchmark reasoning --models openai/gpt-5.6:high --format markdown",
  ].join("\n");
}

function parseNumber(value: string | undefined, fallback: number, minimum: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

function profileWithOverrides(profile: BenchmarkProfile, args: ParsedArgs): BenchmarkProfile {
  const reasoning = args.values.get("thinking") as ThinkingLevel | undefined;
  const allowed: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
  return {
    ...profile,
    defaults: {
      ...profile.defaults,
      runs: Math.floor(parseNumber(args.values.get("runs"), profile.defaults.runs, 1)),
      maxTokens: Math.floor(parseNumber(args.values.get("max-tokens"), profile.defaults.maxTokens, 1)),
      temperature: parseNumber(args.values.get("temperature"), profile.defaults.temperature, 0),
      ...(reasoning && allowed.includes(reasoning) ? { reasoning } : {}),
    },
  };
}

async function saveResult(cwd: string, result: Awaited<ReturnType<typeof runBenchmark>>): Promise<{ jsonPath: string; markdownPath: string }> {
  const directory = join(cwd, ".pi", "modelbench", "runs");
  await mkdir(directory, { recursive: true });
  const jsonPath = join(directory, `${result.runId}.json`);
  const markdownPath = join(directory, `${result.runId}.md`);
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, renderMarkdown(result), "utf8"),
  ]);
  return { jsonPath, markdownPath };
}

function formatSummary(result: Awaited<ReturnType<typeof runBenchmark>>): string {
  return result.models.map((summary) => `${summary.model.provider}/${summary.model.id}: ${(summary.passRate * 100).toFixed(1)}% pass, ${summary.meanLatencyMs.toFixed(0)}ms mean, $${summary.totalCost.toFixed(6)}`).join("\n");
}

async function showModels(ctx: ExtensionContext, availableOnly: boolean): Promise<void> {
  const list = availableOnly ? ctx.modelRegistry.getAvailable() : ctx.modelRegistry.getAll();
  const text = list.length === 0 ? "No models registered." : list.map((model) => `${model.provider}/${model.id} — ${model.name}${ctx.modelRegistry.hasConfiguredAuth(model) ? " [auth]" : ""}`).join("\n");
  if (ctx.mode === "tui") await ctx.ui.editor("Registered models", text);
  else ctx.ui.notify(text, "info");
}

export default function modelbenchExtension(pi: ExtensionAPI) {
  pi.registerCommand("benchmark", {
    description: "Compare models against deterministic benchmark profiles",
    handler: async (rawArgs, ctx) => {
      const args = parseArgs(rawArgs);
      const profiles = loadProfiles(ctx.cwd);
      if (args.command === "help") {
        if (ctx.mode === "tui") await ctx.ui.editor("Pi ModelBench", usage());
        else ctx.ui.notify(usage(), "info");
        return;
      }
      if (args.command === "profiles") {
        const text = [...profiles.values()].map((profile) => `${profile.name} — ${profile.description} (${profile.tasks.length} tasks)`).join("\n");
        ctx.ui.notify(text || "No benchmark profiles found.", "info");
        return;
      }
      if (args.command === "models") {
        await showModels(ctx, args.values.has("available"));
        return;
      }
      if (args.command === "report") {
        const id = args.positional[0];
        if (!id) {
          ctx.ui.notify("Usage: /benchmark report <run-id>", "error");
          return;
        }
        const path = existsSync(id) ? resolve(id) : join(ctx.cwd, ".pi", "modelbench", "runs", id.endsWith(".json") ? id : `${id}.json`);
        try {
          const result = JSON.parse(await readFile(path, "utf8")) as Awaited<ReturnType<typeof runBenchmark>>;
          if (ctx.mode === "tui") await ctx.ui.editor(`Benchmark ${result.runId}`, renderMarkdown(result));
          else ctx.ui.notify(formatSummary(result), "info");
        } catch (error) {
          ctx.ui.notify(`Could not read benchmark report: ${error instanceof Error ? error.message : String(error)}`, "error");
        }
        return;
      }

      const profile = profiles.get(args.command);
      if (!profile) {
        ctx.ui.notify(`Unknown benchmark profile "${args.command}".\n\n${usage()}`, "error");
        return;
      }
      let effectiveProfile = profileWithOverrides(profile, args);
      const requestedModels = args.values.get("models")?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
      const modelPatterns = requestedModels.length > 0 ? requestedModels : (ctx.model ? [`${ctx.model.provider}/${ctx.model.id}`] : []);
      if (modelPatterns.length === 0) {
        ctx.ui.notify("Select a model first or pass --models provider/model.", "error");
        return;
      }
      const resolved = await resolveModelScopeWithDiagnostics(modelPatterns, ctx.modelRegistry);
      for (const diagnostic of resolved.diagnostics) ctx.ui.notify(diagnostic.message, "warning");
      const models = resolved.scopedModels.map((item) => item.model);
      const explicitThinkingLevels = resolved.scopedModels.map((item) => item.thinkingLevel).filter((level): level is ThinkingLevel => level !== undefined);
      const explicitThinking = explicitThinkingLevels[0];
      if (!args.values.has("thinking") && explicitThinking !== undefined && explicitThinkingLevels.length === models.length && new Set(explicitThinkingLevels).size === 1) {
        effectiveProfile = { ...effectiveProfile, defaults: { ...effectiveProfile.defaults, reasoning: explicitThinking } };
      }
      if (models.length === 0) {
        ctx.ui.notify("No requested models were found. Use /benchmark models to inspect the registry.", "error");
        return;
      }

      ctx.ui.setStatus("modelbench", `benchmarking ${effectiveProfile.name}...`);
      try {
        const result = await runBenchmark(effectiveProfile, models, new PiModelRunner(ctx.modelRegistry), (record, completed, total) => {
          ctx.ui.setStatus("modelbench", `benchmarking ${effectiveProfile.name} ${completed}/${total}`);
          if (record.error) ctx.ui.notify(`${record.model.provider}/${record.model.id} · ${record.taskId}: ${record.error}`, "warning");
        });
        const paths = await saveResult(ctx.cwd, result);
        const format = args.values.get("format") ?? "markdown";
        if (ctx.mode === "tui" && format !== "json") await ctx.ui.editor(`Benchmark ${result.runId}`, renderMarkdown(result));
        ctx.ui.notify(`Benchmark complete: ${result.runId}\n${formatSummary(result)}\nSaved: ${paths.jsonPath}\n${format === "json" ? paths.jsonPath : paths.markdownPath}`, "info");
      } catch (error) {
        ctx.ui.notify(`Benchmark failed: ${error instanceof Error ? error.message : String(error)}`, "error");
      } finally {
        ctx.ui.setStatus("modelbench", undefined);
      }
    },
  });
}

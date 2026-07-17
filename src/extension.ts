import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveModelScopeWithDiagnostics, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";
import { runBenchmark } from "./core/benchmark.js";
import { runCodingBenchmark } from "./core/coding-benchmark.js";
import { loadCodingPersonalProfile } from "./core/coding-fixtures.js";
import { loadProfiles } from "./core/profiles.js";
import { PiCodingModelRunner } from "./core/coding-runner.js";
import { PiModelRunner } from "./core/pi-runner.js";
import { costPerBenchmarkRun, perfPerDollar, renderComparisonTable, renderHtml } from "./core/report.js";
import type { BenchmarkProfile, CodingPersonalProfile, ThinkingLevel } from "./core/types.js";

interface ParsedArgs {
  command: string;
  values: Map<string, string>;
  positional: string[];
}

interface ReportEntryData {
  title: string;
  runId: string;
  summary: string;
  jsonPath: string;
  htmlPath: string;
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
    "  /benchmark <profile> --models provider/model[,provider/model] [--runs 3] [--format html|json]",
    "  /benchmark report <run-id>",
    "",
    "Examples:",
    "  /benchmark coding --models openai/gpt-5.6,anthropic/claude-sonnet-4-5 --runs 2",
    "  /benchmark reasoning --models openai/gpt-5.6:high --format html",
    "  /benchmark coding-personal --models openai/gpt-5.6 --runs 2",
  ].join("\n");
}

function parseNumber(value: string | undefined, fallback: number, minimum: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

function settingsWithOverrides(defaults: BenchmarkProfile["defaults"], args: ParsedArgs): BenchmarkProfile["defaults"] {
  const reasoning = args.values.get("thinking") as ThinkingLevel | undefined;
  const allowed: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
  return {
    ...defaults,
    runs: Math.floor(parseNumber(args.values.get("runs"), defaults.runs, 1)),
    maxTokens: Math.floor(parseNumber(args.values.get("max-tokens"), defaults.maxTokens, 1)),
    temperature: parseNumber(args.values.get("temperature"), defaults.temperature, 0),
    ...(reasoning && allowed.includes(reasoning) ? { reasoning } : {}),
  };
}

function profileWithOverrides(profile: BenchmarkProfile, args: ParsedArgs): BenchmarkProfile {
  return { ...profile, defaults: settingsWithOverrides(profile.defaults, args) };
}

function codingProfileWithOverrides(profile: CodingPersonalProfile, args: ParsedArgs): CodingPersonalProfile {
  return { ...profile, defaults: settingsWithOverrides(profile.defaults, args) };
}

async function saveResult(cwd: string, result: Awaited<ReturnType<typeof runBenchmark>>): Promise<{ jsonPath: string; htmlPath: string }> {
  const directory = join(cwd, ".pi", "modelbench", "runs");
  await mkdir(directory, { recursive: true });
  const jsonPath = join(directory, `${result.runId}.json`);
  const htmlPath = join(directory, `${result.runId}.html`);
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8"),
    writeFile(htmlPath, renderHtml(result), "utf8"),
  ]);
  return { jsonPath, htmlPath };
}

function formatSummary(result: Awaited<ReturnType<typeof runBenchmark>>): string {
  return result.models.map((summary) => [
    `${summary.model.provider}/${summary.model.id} [thinking:${summary.settings?.reasoning ?? "unknown"}]`,
    `pass ${(summary.passRate * 100).toFixed(1)}%`,
    `overall ${(summary.overallScore ?? 0).toFixed(1)}/100`,
    `score ${summary.meanScore.toFixed(2)}`,
    `stable ${summary.consistencyRate == null ? "N/A" : `${(summary.consistencyRate * 100).toFixed(1)}%`}`,
    `latency ${summary.meanLatencyMs.toFixed(0)}/${summary.p95LatencyMs.toFixed(0)}ms`,
    `output ${summary.meanOutputTokens.toFixed(1)} tok/Q`,
    `output ${((summary.meanOutputTokensPerSecond ?? 0)).toFixed(1)} tok/s`,
    `$/run $${costPerBenchmarkRun(summary).toFixed(2)}`,
    `perf/$ ${perfPerDollar(summary)?.toFixed(1) ?? "N/A"}`,
    `cost ${summary.totalCost.toFixed(6)}`,
    `$/pass ${(summary.costPerSuccessfulAttempt ?? 0).toFixed(6)}`,
    `errors ${((summary.errorRate ?? 0) * 100).toFixed(1)}%`,
  ].join(" | ")).join("\n");
}

function appendReportEntry(pi: ExtensionAPI, data: ReportEntryData): void {
  pi.appendEntry<ReportEntryData>("modelbench-report", data);
}

async function showModels(ctx: ExtensionContext, availableOnly: boolean): Promise<void> {
  const list = availableOnly ? ctx.modelRegistry.getAvailable() : ctx.modelRegistry.getAll();
  const text = list.length === 0 ? "No models registered." : list.map((model) => `${model.provider}/${model.id} — ${model.name}${ctx.modelRegistry.hasConfiguredAuth(model) ? " [auth]" : ""}`).join("\n");
  ctx.ui.notify(text, "info");
}

export default function modelbenchExtension(pi: ExtensionAPI) {
  pi.registerEntryRenderer<ReportEntryData>("modelbench-report", (entry, { expanded }, theme) => {
    const data = entry.data ?? {
      title: "ModelBench report",
      runId: "unknown",
      summary: "No report data available.",
      jsonPath: "",
      htmlPath: "",
    };
    const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
    box.addChild(new Text(theme.fg("accent", theme.bold(data.title)), 0, 0));
    box.addChild(new Text(theme.fg("dim", `Run ID: ${data.runId}`), 0, 0));
    box.addChild(new Text(data.summary, 0, 0));
    box.addChild(new Text(theme.fg("dim", `JSON: ${data.jsonPath}`), 0, 0));
    if (expanded) box.addChild(new Text(theme.fg("dim", `HTML: ${data.htmlPath}`), 0, 0));
    return box;
  });

  pi.registerCommand("benchmark", {
    description: "Compare models against deterministic benchmark profiles",
    handler: async (rawArgs, ctx) => {
      const args = parseArgs(rawArgs);
      const profiles = loadProfiles(ctx.cwd);
      if (args.command === "help") {
        ctx.ui.notify(usage(), "info");
        return;
      }
      if (args.command === "profiles") {
        const entries = [...profiles.values()].map((profile) => `${profile.name} — ${profile.description} (${profile.tasks.length} tasks)`);
        try {
          const codingProfile = loadCodingPersonalProfile(ctx.cwd);
          entries.push(`${codingProfile.name} — ${codingProfile.description} (${codingProfile.tasks.length} tasks)`);
        } catch {
          // The coding-personal profile is optional for projects that only install text profiles.
        }
        ctx.ui.notify(entries.join("\n") || "No benchmark profiles found.", "info");
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
          const htmlPath = path.replace(/\.json$/i, ".html");
          await writeFile(htmlPath, renderHtml(result), "utf8");
          if (ctx.mode === "tui") {
            appendReportEntry(pi, {
              title: result.profile.name.toLowerCase() === "simplebench" ? "SimpleBench" : `Benchmark ${result.profile.name}`,
              runId: result.runId,
              summary: renderComparisonTable(result.models, result.totalCost),
              jsonPath: path,
              htmlPath,
            });
            ctx.ui.notify(`Report added to the main area: ${result.runId}`, "info");
          } else ctx.ui.notify(formatSummary(result), "info");
        } catch (error) {
          ctx.ui.notify(`Could not read benchmark report: ${error instanceof Error ? error.message : String(error)}`, "error");
        }
        return;
      }

      if (args.command === "coding-personal") {
        let codingProfile: CodingPersonalProfile;
        try {
          codingProfile = codingProfileWithOverrides(loadCodingPersonalProfile(ctx.cwd), args);
        } catch (error) {
          ctx.ui.notify(`Could not load coding-personal fixtures: ${error instanceof Error ? error.message : String(error)}`, "error");
          return;
        }
        const requestedModels = args.values.get("models")?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
        const modelPatterns = requestedModels.length > 0 ? requestedModels : (ctx.model ? [`${ctx.model.provider}/${ctx.model.id}`] : []);
        if (modelPatterns.length === 0) {
          ctx.ui.notify("Select a model first or pass --models provider/model.", "error");
          return;
        }
        const resolved = await resolveModelScopeWithDiagnostics(modelPatterns, ctx.modelRegistry);
        for (const diagnostic of resolved.diagnostics) ctx.ui.notify(diagnostic.message, "warning");
        const targets = resolved.scopedModels.map((item) => ({
          model: item.model,
          settings: item.thinkingLevel && !args.values.has("thinking")
            ? { ...codingProfile.defaults, reasoning: item.thinkingLevel }
            : codingProfile.defaults,
        }));
        if (targets.length === 0) {
          ctx.ui.notify("No requested models were found. Use /benchmark models to inspect the registry.", "error");
          return;
        }
        ctx.ui.setStatus("modelbench", `benchmarking ${codingProfile.name}...`);
        try {
          const result = await runCodingBenchmark(codingProfile, targets, new PiCodingModelRunner(ctx.modelRegistry), (record, completed, total) => {
            ctx.ui.setStatus("modelbench", `benchmarking ${codingProfile.name} ${completed}/${total}`);
            if (record.error) ctx.ui.notify(`${record.model.provider}/${record.model.id} · ${record.taskId}: ${record.error}`, "warning");
          });
          const paths = await saveResult(ctx.cwd, result);
          if (ctx.mode === "tui") {
            appendReportEntry(pi, {
              title: `Benchmark ${codingProfile.name}`,
              runId: result.runId,
              summary: renderComparisonTable(result.models, result.totalCost),
              jsonPath: paths.jsonPath,
              htmlPath: paths.htmlPath,
            });
          }
          ctx.ui.notify(`Benchmark complete: ${result.runId}\nSaved: ${paths.jsonPath}\n${args.values.get("format") === "json" ? paths.jsonPath : paths.htmlPath}`, "info");
        } catch (error) {
          ctx.ui.notify(`Benchmark failed: ${error instanceof Error ? error.message : String(error)}`, "error");
        } finally {
          ctx.ui.setStatus("modelbench", undefined);
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
      const targets = resolved.scopedModels.map((item) => ({
        model: item.model,
        settings: item.thinkingLevel && !args.values.has("thinking")
          ? { ...effectiveProfile.defaults, reasoning: item.thinkingLevel }
          : effectiveProfile.defaults,
      }));
      if (targets.length === 0) {
        ctx.ui.notify("No requested models were found. Use /benchmark models to inspect the registry.", "error");
        return;
      }

      ctx.ui.setStatus("modelbench", `benchmarking ${effectiveProfile.name}...`);
      try {
        const result = await runBenchmark(effectiveProfile, targets, new PiModelRunner(ctx.modelRegistry), (record, completed, total) => {
          ctx.ui.setStatus("modelbench", `benchmarking ${effectiveProfile.name} ${completed}/${total}`);
          if (record.error) ctx.ui.notify(`${record.model.provider}/${record.model.id} · ${record.taskId}: ${record.error}`, "warning");
        });
        const paths = await saveResult(ctx.cwd, result);
        const format = args.values.get("format") ?? "html";
        if (ctx.mode === "tui") {
          appendReportEntry(pi, {
            title: `Benchmark ${effectiveProfile.name}`,
            runId: result.runId,
            summary: renderComparisonTable(result.models, result.totalCost),
            jsonPath: paths.jsonPath,
            htmlPath: paths.htmlPath,
          });
        }
        ctx.ui.notify(`Benchmark complete: ${result.runId}\nSaved: ${paths.jsonPath}\n${format === "json" ? paths.jsonPath : paths.htmlPath}`, "info");
      } catch (error) {
        ctx.ui.notify(`Benchmark failed: ${error instanceof Error ? error.message : String(error)}`, "error");
      } finally {
        ctx.ui.setStatus("modelbench", undefined);
      }
    },
  });
}

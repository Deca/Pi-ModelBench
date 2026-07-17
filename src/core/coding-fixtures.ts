import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isAbsolute, join, normalize, relative } from "node:path";
import type {
  BenchmarkSettings,
  CodingAgentProfile,
  CodingAgentTask,
  CodingTaskDefinition,
  CodingTaskDifficulty,
} from "./types.js";

const difficulties: CodingTaskDifficulty[] = ["easy", "medium", "hard"];
const reasoningLevels = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string, source: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`Invalid ${source}: ${field} must be a non-empty string`);
  return value;
}

function relativePath(value: unknown, field: string, source: string): string {
  const path = requiredString(value, field, source);
  const normalized = normalize(path).replaceAll("\\", "/");
  if (isAbsolute(path) || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`Invalid ${source}: ${field} must be a relative path inside the fixture`);
  }
  return path;
}

function parseSettings(value: unknown, source: string): BenchmarkSettings {
  if (!isRecord(value)) throw new Error(`Invalid ${source}: defaults must be an object`);
  const runs = value.runs;
  const temperature = value.temperature;
  const maxTokens = value.maxTokens;
  const reasoning = value.reasoning;
  if (typeof runs !== "number" || !Number.isInteger(runs) || runs < 1) throw new Error(`Invalid ${source}: defaults.runs must be a positive integer`);
  if (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 0) throw new Error(`Invalid ${source}: defaults.temperature must be a non-negative number`);
  if (typeof maxTokens !== "number" || !Number.isInteger(maxTokens) || maxTokens < 1) throw new Error(`Invalid ${source}: defaults.maxTokens must be a positive integer`);
  if (typeof reasoning !== "string" || !reasoningLevels.includes(reasoning as typeof reasoningLevels[number])) {
    throw new Error(`Invalid ${source}: defaults.reasoning must be a supported thinking level`);
  }
  return { runs, temperature, maxTokens, reasoning: reasoning as BenchmarkSettings["reasoning"] };
}

/** Validate the public task.json shape without touching the fixture filesystem. */
export function validateCodingTask(value: unknown, source = "coding task"): CodingTaskDefinition {
  if (!isRecord(value)) throw new Error(`Invalid ${source}: expected an object`);
  const verification = value.verification;
  if (!isRecord(verification)) throw new Error(`Invalid ${source}: verification must be an object`);
  const tags = value.tags;
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string" || tag.trim() === "")) {
    throw new Error(`Invalid ${source}: tags must be an array of non-empty strings`);
  }
  const difficulty = value.difficulty;
  if (typeof difficulty !== "string" || !difficulties.includes(difficulty as CodingTaskDifficulty)) {
    throw new Error(`Invalid ${source}: difficulty must be easy, medium, or hard`);
  }
  const timeoutMs = verification.timeoutMs;
  if (typeof timeoutMs !== "number" || !Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error(`Invalid ${source}: verification.timeoutMs must be a positive integer`);
  }
  return {
    id: requiredString(value.id, "id", source),
    title: requiredString(value.title, "title", source),
    prompt: requiredString(value.prompt, "prompt", source),
    tags,
    difficulty: difficulty as CodingTaskDifficulty,
    workingDirectory: relativePath(value.workingDirectory, "workingDirectory", source),
    verification: {
      command: requiredString(verification.command, "verification.command", source),
      timeoutMs,
    },
  };
}

function existingDirectory(candidates: string[]): string | undefined {
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isDirectory());
}

function bundledPath(directory: "profiles" | "fixtures"): string[] {
  const currentPackagePath = fileURLToPath(new URL(`../../${directory}/`, import.meta.url));
  const sourcePackagePath = fileURLToPath(new URL(`../../../${directory}/`, import.meta.url));
  return [currentPackagePath, sourcePackagePath];
}

function parseProfileMetadata(path: string): Omit<CodingAgentProfile, "tasks"> {
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isRecord(value)) throw new Error(`Invalid coding-agent profile: ${path}`);
  const name = requiredString(value.name, "name", path);
  if (name !== "coding-agent") throw new Error(`Invalid ${path}: name must be coding-agent`);
  return {
    kind: "coding-agent",
    name: "coding-agent",
    description: requiredString(value.description, "description", path),
    defaults: parseSettings(value.defaults, path),
  };
}

/** Load the coding-agent metadata and every self-contained fixture task. */
export function loadCodingAgentProfile(cwd: string): CodingAgentProfile {
  const profilePath = existsSync(join(cwd, ".pi", "modelbench", "profiles", "coding-agent.json"))
    ? join(cwd, ".pi", "modelbench", "profiles", "coding-agent.json")
    : bundledPath("profiles").map((directory) => join(directory, "coding-agent.json")).find((path) => existsSync(path));
  if (!profilePath) throw new Error("Could not find coding-agent profile metadata");

  const fixtureRoot = existingDirectory([
    join(cwd, "fixtures", "coding-agent"),
    ...bundledPath("fixtures").map((directory) => join(directory, "coding-agent")),
  ]);
  if (!fixtureRoot) throw new Error(`Could not find coding-agent fixtures under ${cwd}`);

  const taskDirectories = readdirSync(fixtureRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));
  if (taskDirectories.length === 0) throw new Error(`No coding-agent task fixtures found in ${fixtureRoot}`);
  const ids = new Set<string>();
  const tasks: CodingAgentTask[] = taskDirectories.map((entry) => {
    const fixtureDirectory = join(fixtureRoot, entry.name);
    const taskPath = join(fixtureDirectory, "task.json");
    if (!existsSync(taskPath)) throw new Error(`Missing task.json in ${fixtureDirectory}`);
    const task = validateCodingTask(JSON.parse(readFileSync(taskPath, "utf8")), taskPath);
    if (task.id !== entry.name) throw new Error(`Invalid ${taskPath}: id must match fixture directory name (${entry.name})`);
    if (ids.has(task.id)) throw new Error(`Duplicate coding-agent task id: ${task.id}`);
    ids.add(task.id);

    const repositoryDirectory = join(fixtureDirectory, "repository");
    const verificationDirectory = join(fixtureDirectory, "verify");
    if (!existsSync(repositoryDirectory) || !statSync(repositoryDirectory).isDirectory()) throw new Error(`Missing repository directory in ${fixtureDirectory}`);
    if (!existsSync(verificationDirectory) || !statSync(verificationDirectory).isDirectory()) throw new Error(`Missing verify directory in ${fixtureDirectory}`);
    const workingDirectory = join(fixtureDirectory, task.workingDirectory);
    const fixtureRelativePath = relative(fixtureDirectory, workingDirectory);
    if (fixtureRelativePath.startsWith("..") || isAbsolute(fixtureRelativePath) || !existsSync(workingDirectory)) {
      throw new Error(`Invalid ${taskPath}: workingDirectory must point to an existing fixture directory`);
    }

    return { ...task, fixtureDirectory, repositoryDirectory, verificationDirectory };
  });

  return { ...parseProfileMetadata(profilePath), tasks };
}
import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { performance } from "node:perf_hooks";
import type { CodingAgentTask, CodingVerification } from "./types.js";

export interface VerificationResult {
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

export function parseTestCounts(output: string): { testsPassed: number | null; testsTotal: number | null } {
  const nodeTotal = output.match(/(?:^|\n)\s*ℹ\s+tests\s+(\d+)/i);
  const nodePassed = output.match(/(?:^|\n)\s*ℹ\s+pass\s+(\d+)/i);
  if (nodeTotal || nodePassed) return { testsTotal: nodeTotal ? Number(nodeTotal[1]) : null, testsPassed: nodePassed ? Number(nodePassed[1]) : null };

  const jest = output.match(/Tests:\s*(?:(\d+)\s+failed,\s*)?(?:(\d+)\s+passed,\s*)?(\d+)\s+total/i);
  if (jest) return { testsTotal: Number(jest[3]), testsPassed: jest[2] ? Number(jest[2]) : 0 };

  const pytest = output.match(/(\d+)\s+passed(?:,\s*(\d+)\s+failed)?\s+in\s+/i);
  if (pytest) {
    const passed = Number(pytest[1]);
    return { testsPassed: passed, testsTotal: passed + (pytest[2] ? Number(pytest[2]) : 0) };
  }
  return { testsPassed: null, testsTotal: null };
}

export interface CodingWorkspace {
  workspaceDirectory: string;
  repositoryDirectory: string;
  verificationDirectory: string;
  workingDirectory: string;
}

export interface IsolatedCodingResult extends CodingWorkspace {
  verification: VerificationResult;
}

export type VerificationRunner = (verification: CodingVerification, workingDirectory: string) => Promise<VerificationResult>;
export type CodingWorkspaceRunner<T> = (workspace: CodingWorkspace) => Promise<T>;
export type FileSnapshot = Map<string, string>;

async function snapshotDirectory(root: string, directory: string, snapshot: FileSnapshot): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await snapshotDirectory(root, path, snapshot);
    } else if (entry.isFile()) {
      snapshot.set(relative(root, path).replaceAll("\\", "/"), await readFile(path, "utf8"));
    }
  }
}

export async function snapshotFiles(root: string): Promise<FileSnapshot> {
  const snapshot: FileSnapshot = new Map();
  await snapshotDirectory(root, root, snapshot);
  return snapshot;
}

export function summarizeFileChanges(before: FileSnapshot, after: FileSnapshot): { changedFiles: string[]; diff: string } {
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  const changedFiles = paths.filter((path) => before.get(path) !== after.get(path));
  const sections = changedFiles.map((path) => {
    const oldContent = before.get(path);
    const newContent = after.get(path);
    const oldLines = oldContent === undefined ? [] : oldContent.split(/\r?\n/);
    const newLines = newContent === undefined ? [] : newContent.split(/\r?\n/);
    return [
      `--- a/${path}`,
      `+++ b/${path}`,
      ...oldLines.map((line) => `- ${line}`),
      ...newLines.map((line) => `+ ${line}`),
    ].join("\n");
  });
  return { changedFiles, diff: sections.join("\n\n") };
}

/** Execute one shell verification command with bounded time and captured output. */
export function executeVerification(verification: CodingVerification, workingDirectory: string): Promise<VerificationResult> {
  return new Promise((resolve) => {
    const started = performance.now();
    const child = spawn(verification.command, {
      cwd: workingDirectory,
      shell: true,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const finish = (result: Omit<VerificationResult, "testsPassed" | "testsTotal">) => {
      if (settled) return;
      settled = true;
      resolve({ ...result, ...parseTestCounts(`${stdout}\n${stderr}`) });
    };

    child.stdout?.on("data", (chunk: Buffer | string) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer | string) => { stderr += chunk.toString(); });
    child.once("error", (error) => finish({
      exitCode: null,
      signal: null,
      stdout,
      stderr,
      durationMs: performance.now() - started,
      timedOut,
      error: error.message,
    }));
    child.once("close", (exitCode, signal) => finish({
      exitCode,
      signal,
      stdout,
      stderr,
      durationMs: performance.now() - started,
      timedOut,
    }));

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, verification.timeoutMs);
    child.once("close", () => clearTimeout(timeout));
    child.once("error", () => clearTimeout(timeout));
  });
}

/** Copy a fixture into a temporary directory, run a callback, and always remove it. */
export async function withIsolatedCodingWorkspace<T>(task: CodingAgentTask, callback: CodingWorkspaceRunner<T>): Promise<T> {
  const workspaceDirectory = await mkdtemp(join(tmpdir(), "modelbench-coding-"));
  const workspace = {
    workspaceDirectory,
    repositoryDirectory: join(workspaceDirectory, "repository"),
    verificationDirectory: join(workspaceDirectory, "verify"),
    workingDirectory: join(workspaceDirectory, task.workingDirectory),
  };

  try {
    await cp(task.repositoryDirectory, workspace.repositoryDirectory, { recursive: true });
    await cp(task.verificationDirectory, workspace.verificationDirectory, { recursive: true });
    return await callback(workspace);
  } finally {
    await rm(workspaceDirectory, { recursive: true, force: true });
  }
}

/** Copy a fixture into a temporary directory, run verification, and always remove it. */
export async function runIsolatedCodingTask(task: CodingAgentTask, verificationRunner: VerificationRunner = executeVerification): Promise<IsolatedCodingResult> {
  return withIsolatedCodingWorkspace(task, async (workspace) => ({
    ...workspace,
    verification: await verificationRunner(task.verification, workspace.workingDirectory),
  }));
}

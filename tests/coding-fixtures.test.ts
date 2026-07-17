import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCodingPersonalProfile, validateCodingTask } from "../src/core/coding-fixtures.js";

describe("coding-personal fixtures", () => {
  it("loads the bundled task and preserves its fixture paths", () => {
    const profile = loadCodingPersonalProfile(process.cwd());

    expect(profile.name).toBe("coding-personal");
    expect(profile.tasks.map((task) => task.id)).toEqual(["async-error-path", "bug-edge-case", "validation-matrix"]);
    const task = profile.tasks.find((candidate) => candidate.id === "bug-edge-case");
    if (!task) throw new Error("bug-edge-case fixture missing");
    expect(task.workingDirectory).toBe("repository");
    expect(task.repositoryDirectory).toMatch(/bug-edge-case[\\/]repository$/);
    expect(task.verificationDirectory).toMatch(/bug-edge-case[\\/]verify$/);
  });

  it.each([
    ["missing id", { title: "title", prompt: "prompt", tags: [], difficulty: "medium", workingDirectory: "repository", verification: { command: "test", timeoutMs: 1 } }],
    ["absolute working directory", { id: "task", title: "title", prompt: "prompt", tags: [], difficulty: "medium", workingDirectory: "/tmp", verification: { command: "test", timeoutMs: 1 } }],
    ["invalid difficulty", { id: "task", title: "title", prompt: "prompt", tags: [], difficulty: "extreme", workingDirectory: "repository", verification: { command: "test", timeoutMs: 1 } }],
    ["invalid timeout", { id: "task", title: "title", prompt: "prompt", tags: [], difficulty: "medium", workingDirectory: "repository", verification: { command: "test", timeoutMs: 0 } }],
  ])("rejects %s task definitions", (_name, task) => {
    expect(() => validateCodingTask(task)).toThrow(/Invalid coding task/);
  });

  it("rejects a fixture that omits its verification directory", () => {
    const root = mkdtempSync(join(tmpdir(), "modelbench-fixture-"));
    const taskDirectory = join(root, "fixtures", "coding-personal", "broken-task");
    mkdirSync(join(taskDirectory, "repository"), { recursive: true });
    writeFileSync(join(taskDirectory, "task.json"), JSON.stringify({
      id: "broken-task",
      title: "Broken fixture",
      prompt: "Fix it",
      tags: ["test"],
      difficulty: "easy",
      workingDirectory: "repository",
      verification: { command: "node --test", timeoutMs: 1000 },
    }));

    try {
      expect(() => loadCodingPersonalProfile(root)).toThrow(/Missing verify directory/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

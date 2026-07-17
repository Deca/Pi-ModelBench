import { existsSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadCodingAgentProfile } from "../src/core/coding-fixtures.js";
import { parseTestCounts, runIsolatedCodingTask, type VerificationResult } from "../src/core/coding-workspace.js";

const task = loadCodingAgentProfile(process.cwd()).tasks.find((candidate) => candidate.id === "bug-edge-case");

const passingVerification: VerificationResult = {
  exitCode: 0,
  signal: null,
  stdout: "2 tests passed",
  stderr: "",
  durationMs: 1,
  timedOut: false,
  testsPassed: 2,
  testsTotal: 2,
};

describe("parseTestCounts", () => {
  it("parses Node, Jest, and pytest summaries", () => {
    expect(parseTestCounts("ℹ tests 4\nℹ pass 3\nℹ fail 1")).toEqual({ testsPassed: 3, testsTotal: 4 });
    expect(parseTestCounts("Tests: 1 failed, 2 passed, 3 total")).toEqual({ testsPassed: 2, testsTotal: 3 });
    expect(parseTestCounts("2 passed, 1 failed in 0.4s")).toEqual({ testsPassed: 2, testsTotal: 3 });
    expect(parseTestCounts("verification complete")).toEqual({ testsPassed: null, testsTotal: null });
  });
});

describe("runIsolatedCodingTask", () => {
  it("copies repository and verification fixtures before invoking the fake verifier", async () => {
    if (!task) throw new Error("fixture task missing");
    let observedWorkingDirectory = "";
    const result = await runIsolatedCodingTask(task, async (_verification, workingDirectory) => {
      observedWorkingDirectory = workingDirectory;
      expect(existsSync(`${workingDirectory}/src/paginator.js`)).toBe(true);
      expect(existsSync(`${workingDirectory}/../verify/pagination.test.js`)).toBe(true);
      writeFileSync(`${workingDirectory}/benchmark-marker.txt`, "temporary");
      return passingVerification;
    });

    expect(result.verification.exitCode).toBe(0);
    expect(observedWorkingDirectory).toBe(result.workingDirectory);
    expect(existsSync(result.workspaceDirectory)).toBe(false);
  });

  it("cleans up when verification fails", async () => {
    if (!task) throw new Error("fixture task missing");
    let observedWorkingDirectory = "";
    await expect(runIsolatedCodingTask(task, async (_verification, workingDirectory) => {
      observedWorkingDirectory = workingDirectory;
      throw new Error("fake verifier failed");
    })).rejects.toThrow("fake verifier failed");

    expect(observedWorkingDirectory).not.toBe("");
    expect(existsSync(observedWorkingDirectory.replace(/[\\/]repository$/, ""))).toBe(false);
  });
});

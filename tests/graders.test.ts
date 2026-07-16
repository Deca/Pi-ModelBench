import { describe, expect, it } from "vitest";
import { gradeOutput } from "../src/core/graders.js";

describe("gradeOutput", () => {
  it("normalizes harmless formatting for normalized-exact grading", () => {
    const result = gradeOutput("  O(N LOG N)\n", {
      type: "normalized-exact",
      expected: "o(n log n)",
    });

    expect(result).toEqual({
      passed: true,
      score: 1,
      details: "Normalized output matched the expected value",
    });
  });

  it("accepts semantically correct debugging explanations without one required phrase", () => {
    const result = gradeOutput("Bug: i <= items.length accesses an undefined item. Fix: use i < items.length.", {
      type: "regex",
      pattern: "(?:<=|one iteration|out of bounds|undefined).*(?:<\\s*items\\.length|less than|replace)",
      flags: "is",
    });

    expect(result.passed).toBe(true);
  });
});

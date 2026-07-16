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
});

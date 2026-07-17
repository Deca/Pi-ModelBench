import { describe, expect, it } from "vitest";
import { loadProfiles } from "../src/core/profiles.js";

describe("simplebench profile", () => {
  it("loads the public ten-question calibration set with deterministic answer graders", () => {
    const profile = loadProfiles(process.cwd()).get("simplebench");

    expect(profile).toBeDefined();
    expect(profile?.tasks).toHaveLength(10);
    expect(profile?.tasks[0]?.grader).toEqual({ type: "final-answer", expected: "B" });
  });
});

import type { BenchmarkGrader, GradeResult } from "./types.js";

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function getText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => deepEqual(item, right[index]));
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return deepEqual(leftKeys, rightKeys) && leftKeys.every((key) => deepEqual(leftRecord[key], rightRecord[key]));
}

function pass(details: string): GradeResult {
  return { passed: true, score: 1, details };
}

function fail(details: string): GradeResult {
  return { passed: false, score: 0, details };
}

export function gradeOutput(output: string, grader: BenchmarkGrader): GradeResult {
  switch (grader.type) {
    case "exact":
      return output === grader.expected ? pass("Output exactly matched the expected value") : fail("Output did not exactly match the expected value");
    case "normalized-exact":
      return normalize(output) === normalize(grader.expected)
        ? pass("Normalized output matched the expected value")
        : fail("Normalized output did not match the expected value");
    case "contains":
      return grader.values.every((value) => output.includes(value))
        ? pass("Output contained all required values")
        : fail(`Output was missing: ${grader.values.filter((value) => !output.includes(value)).join(", ")}`);
    case "regex": {
      const regex = new RegExp(grader.pattern, grader.flags);
      return regex.test(output) ? pass("Output matched the regular expression") : fail("Output did not match the regular expression");
    }
    case "final-answer": {
      const match = output.match(/Final Answer:\s*([A-F])/i);
      const actual = match?.[1]?.toUpperCase();
      return actual === grader.expected.toUpperCase()
        ? pass("Final answer matched the expected choice")
        : fail(actual ? `Expected final answer ${grader.expected}, got ${actual}` : "Output did not contain a valid final answer choice");
    }
    case "json-exact": {
      try {
        return deepEqual(JSON.parse(output), grader.expected)
          ? pass("Parsed JSON matched the expected value")
          : fail("Parsed JSON did not match the expected value");
      } catch {
        return fail("Output was not valid JSON");
      }
    }
    case "json-fields": {
      try {
        const parsed: unknown = JSON.parse(output);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return fail("Output was not a JSON object");
        const actual = parsed as Record<string, unknown>;
        const missing = Object.keys(grader.fields).filter((key) => !(key in actual));
        if (missing.length > 0) return fail(`JSON was missing fields: ${missing.join(", ")}`);
        return Object.keys(grader.fields).every((key) => deepEqual(actual[key], grader.fields[key]))
          ? pass("JSON contained all expected fields")
          : fail("JSON fields did not match the expected values");
      } catch {
        return fail("Output was not valid JSON");
      }
    }
    case "number": {
      const actual = Number(output.trim());
      if (!Number.isFinite(actual)) return fail("Output was not a finite number");
      return Math.abs(actual - grader.expected) <= grader.tolerance
        ? pass("Number was within tolerance")
        : fail(`Expected ${grader.expected} ± ${grader.tolerance}, got ${actual}`);
    }
    case "all": {
      const results = grader.graders.map((item) => gradeOutput(getText(output), item));
      const passed = results.every((result) => result.passed);
      return {
        passed,
        score: results.reduce((sum, result) => sum + result.score, 0) / results.length,
        details: results.map((result) => result.details).join("; "),
      };
    }
  }
}

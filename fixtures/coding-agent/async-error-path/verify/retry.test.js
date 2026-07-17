import test from "node:test";
import assert from "node:assert/strict";
import { retry } from "../repository/src/retry.js";

test("returns the first successful value and stops", async () => {
  let calls = 0;
  const result = await retry(async () => {
    calls += 1;
    if (calls < 2) throw new Error("transient");
    return "ok";
  }, 4);
  assert.equal(result, "ok");
  assert.equal(calls, 2);
});

test("rejects with the final error after the limit", async () => {
  let calls = 0;
  const finalError = new Error("final");
  await assert.rejects(() => retry(async () => {
    calls += 1;
    throw calls === 3 ? finalError : new Error(`failure-${calls}`);
  }, 3), (error) => error === finalError);
  assert.equal(calls, 3);
});

test("rejects invalid attempt counts", async () => {
  await assert.rejects(() => retry(async () => "ok", 0), RangeError);
  await assert.rejects(() => retry(async () => "ok", 1.5), TypeError);
});

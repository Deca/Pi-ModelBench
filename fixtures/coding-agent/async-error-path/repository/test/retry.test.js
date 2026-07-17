import test from "node:test";
import assert from "node:assert/strict";
import { retry } from "../src/retry.js";

test("returns the first successful value", async () => {
  assert.equal(await retry(async () => "ok", 2), "ok");
});

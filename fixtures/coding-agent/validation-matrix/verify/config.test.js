import test from "node:test";
import assert from "node:assert/strict";
import { parseConfig } from "../repository/src/config.js";

test("keeps documented defaults", () => {
  assert.deepEqual(parseConfig(), { port: 3000, retries: 3, debug: false });
});

test("parses valid string values", () => {
  assert.deepEqual(parseConfig({ port: "8080", retries: "0", debug: "true" }), {
    port: 8080,
    retries: 0,
    debug: true,
  });
});

test("rejects invalid ports", () => {
  for (const port of ["abc", "0", "65536", "2.5"]) {
    assert.throws(() => parseConfig({ port }), TypeError);
  }
});

test("rejects invalid retries and debug values", () => {
  for (const retries of ["-1", "11", "1.5"]) {
    assert.throws(() => parseConfig({ retries }), TypeError);
  }
  assert.throws(() => parseConfig({ debug: "yes" }), TypeError);
});

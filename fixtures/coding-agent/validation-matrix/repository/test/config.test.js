import test from "node:test";
import assert from "node:assert/strict";
import { parseConfig } from "../src/config.js";

test("parses the default configuration", () => {
  assert.deepEqual(parseConfig(), { port: 3000, retries: 3, debug: false });
});

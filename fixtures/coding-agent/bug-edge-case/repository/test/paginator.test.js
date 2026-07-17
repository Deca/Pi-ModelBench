import test from "node:test";
import assert from "node:assert/strict";
import { paginate } from "../src/paginator.js";

test("returns the requested page items", () => {
  assert.deepEqual(paginate(["a", "b", "c"], 2, 2).items, ["c"]);
});

test("rejects invalid page values", () => {
  assert.throws(() => paginate([], 0, 2), RangeError);
  assert.throws(() => paginate([], 1, 0), RangeError);
});

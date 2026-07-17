import test from "node:test";
import assert from "node:assert/strict";
import { paginate } from "../repository/src/paginator.js";

test("reports all pages when the item count is an exact multiple", () => {
  const result = paginate(["a", "b", "c", "d"], 1, 2);
  assert.equal(result.totalPages, 2);
});

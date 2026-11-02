import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCart, cartTotal, filterProducts } from "../src/catalog.js";

test("cart restored from storage only accepts existing products and valid quantities", () => {
  assert.deepEqual(
    normalizeCart({ classic: 2, campus: -1, roam: 100, mini: "3", unknown: 5 }),
    { classic: 2 },
  );
  for (const invalid of [null, [], "broken", 5])
    assert.deepEqual(normalizeCart(invalid), {});
});
test("total reflects the quantities and empty cart", () => {
  assert.equal(cartTotal({ classic: 2, mini: 1 }), 1370000);
  assert.equal(cartTotal({}), 0);
});
test("category and case-insensitive search combine correctly", () => {
  assert.deepEqual(
    filterProducts("school", " CAMPUS ").map((p) => p.id),
    ["campus"],
  );
  assert.deepEqual(filterProducts("travel", "campus"), []);
  assert.equal(filterProducts("all", "").length, 4);
});

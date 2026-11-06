import { test } from "node:test";
import assert from "node:assert/strict";
import { allOrders, demoOrders, sandboxOrders } from "./orders-seed.ts";
import { filterOrders, isSelectable } from "./orders.ts";

test("there are 200 demo rows plus the three sandbox rows", () => {
  assert.equal(demoOrders().length, 200);
  assert.equal(allOrders().length, 203);
});

test("only the sandbox rows are selectable for a bulk send", () => {
  const selectable = allOrders().filter(isSelectable);
  assert.deepEqual(selectable.map((o) => o.orderNo), sandboxOrders.map((o) => o.orderNo));
});

test("demo order numbers are unique", () => {
  const nos = new Set(allOrders().map((o) => o.orderNo));
  assert.equal(nos.size, 203);
});

test("the missing-tracking chip finds demo rows without tracking", () => {
  const missing = filterOrders(allOrders(), ["missingTracking"]);
  assert.ok(missing.length > 0);
  assert.ok(missing.every((o) => !o.tracking));
});

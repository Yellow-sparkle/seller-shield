import { test } from "node:test";
import assert from "node:assert/strict";
import { filterOrders, planBulk, protectionLabel, rowResultLabel, type Order } from "./orders.ts";

const base = (over: Partial<Order>): Order => ({
  orderNo: "1001",
  date: "2026-11-01",
  buyer: "Buyer A",
  amount: { currency: "EUR", value: "20.00" },
  protection: "UNKNOWN",
  held: false,
  source: "demo",
  ...over,
});

const rows: Order[] = [
  base({ orderNo: "A", tracking: "TR1", protection: "PROTECTED" }),
  base({ orderNo: "B", protection: "NOT_PROTECTED", held: true, disputeId: "PP-R-X" }),
  base({ orderNo: "C", source: "sandbox", tracking: undefined }),
];

test("no chips keeps every order", () => {
  assert.equal(filterOrders(rows, []).length, 3);
});

test("missing tracking chip finds orders without a tracking number", () => {
  assert.deepEqual(filterOrders(rows, ["missingTracking"]).map((o) => o.orderNo), ["B", "C"]);
});

test("chips combine with AND", () => {
  assert.deepEqual(filterOrders(rows, ["held", "hasDispute"]).map((o) => o.orderNo), ["B"]);
  assert.deepEqual(filterOrders(rows, ["held", "notProtected", "missingTracking"]).map((o) => o.orderNo), ["B"]);
});

test("protection label shows Protected only for PayPal's PROTECTED status", () => {
  assert.equal(protectionLabel(base({ protection: "PROTECTED" })), "Protected");
  assert.equal(protectionLabel(base({ protection: "UNKNOWN" })), "Unknown");
  assert.equal(protectionLabel(base({ protection: "ELIGIBLE" })), "Eligible");
  assert.equal(protectionLabel(base({ protection: "NOT_PROTECTED" })), "Not protected");
});

test("demo rows are skipped in the bulk plan and never sent", () => {
  const plan = planBulk([base({ orderNo: "D" })], { D: { carrier: "DHL", tracking: "123" } });
  assert.deepEqual(plan.lines, []);
  assert.deepEqual(plan.skipped, [{ orderNo: "D", reason: "Demo data, not in sandbox" }]);
});

test("sandbox rows need a carrier and a tracking number", () => {
  const sb = base({ orderNo: "S", source: "sandbox" });
  const plan = planBulk([sb], { S: { carrier: "", tracking: "123" } });
  assert.deepEqual(plan.skipped, [{ orderNo: "S", reason: "No carrier chosen" }]);
  const plan2 = planBulk([sb], { S: { carrier: "DHL", tracking: "  " } });
  assert.deepEqual(plan2.skipped, [{ orderNo: "S", reason: "No tracking number" }]);
});

test("a complete sandbox row goes into the plan with trimmed values", () => {
  const sb = base({ orderNo: "S", source: "sandbox" });
  const plan = planBulk([sb], { S: { carrier: " DHL ", tracking: " 123 " } });
  assert.deepEqual(plan.lines, [{ orderNo: "S", carrier: "DHL", tracking: "123" }]);
  assert.deepEqual(plan.skipped, []);
});

test("a failed row never shows a success label", () => {
  assert.equal(rowResultLabel({ ok: true }), "Tracking added");
  assert.equal(rowResultLabel({ ok: false, error: "INVALID_REQUEST" }), "Failed: INVALID_REQUEST");
});

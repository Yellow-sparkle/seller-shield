import { test } from "node:test";
import assert from "node:assert/strict";
import { allOrders, demoOrders, sandboxOrders } from "./orders-seed.ts";
import { filterOrders, isSelectable } from "./orders.ts";

test("there are 200 demo rows plus the five sandbox rows", () => {
  assert.equal(demoOrders().length, 200);
  assert.equal(allOrders().length, 205);
});

test("only the sandbox rows are selectable for a bulk send", () => {
  const selectable = allOrders().filter(isSelectable);
  assert.deepEqual(selectable.map((o) => o.orderNo), sandboxOrders.map((o) => o.orderNo));
});

test("demo order numbers are unique", () => {
  const nos = new Set(allOrders().map((o) => o.orderNo));
  assert.equal(nos.size, 205);
});

test("the missing-tracking chip finds demo rows without tracking", () => {
  const missing = filterOrders(allOrders(), ["missingTracking"]);
  assert.ok(missing.length > 0);
  assert.ok(missing.every((o) => !o.tracking));
});

import fixtures from "./fixtures/sandbox-disputes.json" with { type: "json" };
import demoDisputes from "./fixtures/demo-disputes.json" with { type: "json" };
import { toCase } from "./dispute.ts";

test("H4: every dispute on the case screen has its order in Orders and tracking", () => {
  const byNo = new Map(allOrders().map((o) => [o.orderNo, o]));
  for (const f of [...(fixtures as object[]), ...(demoDisputes as object[])]) {
    const c = toCase(f as never);
    const o = byNo.get(c.transactionId ?? "");
    assert.ok(o, `no order for ${c.disputeId}`);
    assert.equal(o.disputeId, c.disputeId);
    assert.equal(o.disputeReason, c.reason);
  }
});

test("M1: the demo case and its order agree on amount, protection and hold", () => {
  const c = toCase((demoDisputes as object[])[0] as never);
  const o = allOrders().find((x) => x.orderNo === c.transactionId)!;
  assert.equal(Number(o.amount.value), c.amount?.value);
  assert.equal(o.protection, "ELIGIBLE");
  assert.equal(o.held, c.holdAmount !== null);
});

test("M2: only orders whose dispute has a case carry a dispute id", () => {
  const ids = new Set([...(fixtures as object[]), ...(demoDisputes as object[])].map((f) => toCase(f as never).disputeId));
  for (const o of allOrders().filter((x) => x.disputeId)) assert.ok(ids.has(o.disputeId!), o.orderNo);
});

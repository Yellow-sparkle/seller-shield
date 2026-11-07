import { test } from "node:test";
import assert from "node:assert/strict";
import { caseLink, chipsFromQuery, filterOrders, gridSummary, planBulk, protectionLabel, rowResultLabel, type Order } from "./orders.ts";

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

test("chips come from the link, and unknown chips are ignored", () => {
  assert.deepEqual(chipsFromQuery("?chip=missingTracking"), ["missingTracking"]);
  assert.deepEqual(chipsFromQuery("?chip=held&chip=bogus"), ["held"]);
  assert.deepEqual(chipsFromQuery(""), []);
});

test("summary row totals the rows shown", () => {
  const s = gridSummary([
    base({ orderNo: "A", amount: { currency: "EUR", value: "20.00" }, held: true }),
    base({ orderNo: "B", amount: { currency: "EUR", value: "5.50" }, tracking: "T1", disputeId: "D1", source: "sandbox" }),
  ]);
  assert.equal(s.orders, 2);
  assert.equal(s.total, 25.5);
  assert.equal(s.missingTracking, 1);
  assert.equal(s.held, 1);
  assert.equal(s.disputes, 1);
  assert.equal(s.sandbox, 1);
});

test("only sandbox disputes link to a case screen", () => {
  assert.equal(caseLink(base({ disputeId: "PP-R-1", source: "sandbox" })), "/cases#PP-R-1");
  assert.equal(caseLink(base({ disputeId: "PP-R-DEMO-1", source: "demo" })), null);
  assert.equal(caseLink(base({ source: "sandbox" })), null);
});

test("the sandbox chip keeps only real sandbox orders, so the grid matches the scan card", () => {
  const shown = filterOrders(rows, chipsFromQuery("?chip=missingTracking&chip=sandbox"));
  assert.deepEqual(shown.map((o) => o.orderNo), ["C"]);
});

test("Last 30 days keeps orders dated within 30 days of today", () => {
  const base = { tracking: "T1", trackingStatus: null, carrier: "DHL", held: false, protection: "ELIGIBLE", disputeId: null, buyer: "B", amount: { value: "1.00", currency: "EUR" }, source: "demo" };
  const rows = [
    { ...base, orderNo: "NEW", date: "2026-11-01" },
    { ...base, orderNo: "EDGE", date: "2026-10-08" },
    { ...base, orderNo: "OLD", date: "2026-09-01" },
  ] as never[];
  const now = new Date("2026-11-07T12:00:00Z");
  assert.deepEqual(filterOrders(rows, ["last30"], now).map((o: { orderNo: string }) => o.orderNo), ["NEW", "EDGE"]);
});

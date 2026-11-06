import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeHealth } from "./health.ts";
import type { Order } from "./orders.ts";

const now = new Date("2026-11-06T00:00:00Z");
const order = (over: Partial<Order>): Order => ({
  orderNo: "X",
  date: "2026-11-01",
  buyer: "B",
  amount: { currency: "EUR", value: "10.00" },
  protection: "UNKNOWN",
  held: false,
  source: "sandbox",
  ...over,
});

test("sums open disputes only", () => {
  const h = summarizeHealth(
    [
      { status: "WAITING_FOR_SELLER_RESPONSE", dispute_amount: { currency_code: "EUR", value: "60.00" }, seller_response_due_date: "2026-11-08T00:00:00Z" },
      { status: "UNDER_REVIEW", dispute_amount: { currency_code: "EUR", value: "25.50" } },
      { status: "RESOLVED", dispute_amount: { currency_code: "EUR", value: "99.00" } },
    ],
    [],
    now,
  );
  assert.equal(h.moneyAtRisk.count, 2);
  assert.equal(h.moneyAtRisk.amount, 85.5);
});

test("nearest deadline counts days from now", () => {
  const h = summarizeHealth(
    [
      { status: "WAITING_FOR_SELLER_RESPONSE", seller_response_due_date: "2026-11-10T00:00:00Z" },
      { status: "WAITING_FOR_SELLER_RESPONSE", seller_response_due_date: "2026-11-08T00:00:00Z" },
    ],
    [],
    now,
  );
  assert.equal(h.nextDeadline?.daysLeft, 2);
  assert.match(h.copy, /due in 2 days/);
});

test("no open disputes means no deadline, and the copy says so", () => {
  const h = summarizeHealth([], [], now);
  assert.equal(h.nextDeadline, null);
  assert.match(h.copy, /No reply deadline found/);
});

test("missing tracking counts only sandbox orders without a tracker", () => {
  const h = summarizeHealth(
    [],
    [
      order({ orderNo: "A", tracking: "T1" }),
      order({ orderNo: "B", amount: { currency: "EUR", value: "30.00" } }),
      order({ orderNo: "C", source: "demo" }),
    ],
    now,
  );
  assert.equal(h.missingTracking.count, 1);
  assert.equal(h.missingTracking.total, 30);
});

test("demo orders without tracking are reported separately, not in the card", () => {
  const h = summarizeHealth([], [order({ orderNo: "D", source: "demo" })], now);
  assert.equal(h.missingTracking.count, 0);
  assert.equal(h.demoMissingTracking, 1);
});

test("nearest deadline names its dispute, so the card can open that case", () => {
  const h = summarizeHealth(
    [
      { dispute_id: "PP-R-LATER", status: "WAITING_FOR_SELLER_RESPONSE", seller_response_due_date: "2026-11-10T00:00:00Z" },
      { dispute_id: "PP-R-SOON", status: "WAITING_FOR_SELLER_RESPONSE", seller_response_due_date: "2026-11-08T00:00:00Z" },
    ],
    [],
    now,
  );
  assert.equal(h.nextDeadline?.disputeId, "PP-R-SOON");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { toCase, daysUntilDue } from "./dispute.ts";

test("maps a full dispute into a Case", () => {
  const c = toCase({
    dispute_id: "PP-R-GJM-10196233",
    reason: "INR",
    status: "OPEN",
    dispute_amount: { currency_code: "EUR", value: "60.00" },
    disputed_transactions: [{ seller_transaction_id: "4A183454PG821393D" }],
    create_time: "2026-11-03T10:00:00Z",
    seller_response_due_date: "2026-11-23T10:00:00Z",
    seller_protection: { status: "ELIGIBLE" },
    fund_movements: [{ type: "HOLD_PLACED", amount: { currency_code: "EUR", value: "-60.00" } }],
  });
  assert.equal(c.reason, "INR");
  assert.deepEqual(c.amount, { currency: "EUR", value: 60 });
  assert.equal(c.transactionId, "4A183454PG821393D");
  assert.equal(c.sellerProtectionEligible, true);
  assert.deepEqual(c.holdAmount, { currency: "EUR", value: -60 });
});

test("unknown reason and missing fields become null, never guessed", () => {
  const c = toCase({ dispute_id: "X", reason: "WEIRD" });
  assert.equal(c.reason, "UNKNOWN");
  assert.equal(c.amount, null);
  assert.equal(c.transactionId, null);
  assert.equal(c.sellerProtectionEligible, null);
  assert.equal(c.holdAmount, null);
});

test("days until due counts from now", () => {
  const c = toCase({ dispute_id: "X", seller_response_due_date: "2026-11-23T00:00:00Z" });
  assert.equal(daysUntilDue(c, new Date("2026-11-20T00:00:00Z")), 3);
  assert.equal(daysUntilDue(toCase({ dispute_id: "Y" })), null);
});

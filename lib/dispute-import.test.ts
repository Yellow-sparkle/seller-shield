import { test } from "node:test";
import assert from "node:assert/strict";
import { toFixture, upsertFixture } from "./dispute-import.ts";
import { toCase } from "./dispute.ts";
import { responseEligibility } from "./rules.ts";

const full = {
  dispute_id: "PP-R-NEW-10197000",
  reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
  status: "WAITING_FOR_SELLER_RESPONSE",
  dispute_amount: { currency_code: "EUR", value: "25.00" },
  disputed_transactions: [{ seller_transaction_id: "8W935552C2660182V", buyer_transaction_id: "X", seller_protection_eligible: true }],
  create_time: "2026-11-07T10:00:00Z",
  seller_response_due_date: "2026-11-27T10:00:00Z",
  dispute_life_cycle_stage: "INQUIRY",
  fund_movements: [{ type: "HOLD_PLACED", affected_party: "SELLER", amount: { currency_code: "EUR", value: "-24.00" } }],
  messages: [{ posted_by: "BUYER", content: "not here" }],
};

test("a full PayPal dispute becomes the short fixture shape the app reads", () => {
  const f = toFixture(full);
  const c = toCase(f as never);
  assert.equal(c.reason, "INR");
  assert.equal(c.sellerProtectionEligible, true);
  assert.deepEqual(c.holdAmount, { currency: "EUR", value: -24 });
  assert.equal(c.lifeCycleStage, "INQUIRY");
  assert.equal(f.messages, undefined);
  assert.equal(responseEligibility(c, new Date("2026-11-08T00:00:00Z")).canRespond, true);
});

test("a reply without a dispute id is refused", () => {
  assert.throws(() => toFixture({}), /no dispute_id/);
});

test("adding the same dispute again replaces it", () => {
  const a = toFixture(full);
  const list = upsertFixture(upsertFixture([], a), { ...a, status: "RESOLVED" });
  assert.equal(list.length, 1);
  assert.equal(list[0].status, "RESOLVED");
});

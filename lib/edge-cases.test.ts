// Edge cases beyond the happy path: bad input, boundaries, and model reply handling.
import { test } from "node:test";
import assert from "node:assert/strict";
import { toCase, daysUntilDue } from "./dispute.ts";
import { responseEligibility, requiredEvidence } from "./rules.ts";
import { applyGuard, isGrounded } from "./guard.ts";
import { parseRecommendation, factsFor } from "./recommend.ts";

// Deadline passed a few hours ago must be OVERDUE, not "0 days left".
test("due date passed a few hours ago is OVERDUE, not answerable with 0 days", () => {
  const c = toCase({ dispute_id: "X", status: "OPEN", seller_response_due_date: "2026-11-03T22:00:00Z" });
  assert.deepEqual(responseEligibility(c, new Date("2026-11-04T00:00:00Z")), { canRespond: false, reason: "OVERDUE" });
});

test("due later today is answerable with 1 day left", () => {
  const c = toCase({ dispute_id: "X", status: "OPEN", seller_response_due_date: "2026-11-04T10:00:00Z" });
  assert.deepEqual(responseEligibility(c, new Date("2026-11-04T00:00:00Z")), { canRespond: true, daysLeft: 1 });
});

test("missing due date cannot be answered", () => {
  const c = toCase({ dispute_id: "X", status: "OPEN" });
  assert.deepEqual(responseEligibility(c, new Date("2026-11-04T00:00:00Z")), { canRespond: false, reason: "NO_DUE_DATE" });
});

test("garbage due date is treated as unknown, not as a date", () => {
  const c = toCase({ dispute_id: "X", status: "OPEN", seller_response_due_date: "next tuesday" });
  assert.equal(daysUntilDue(c, new Date("2026-11-04T00:00:00Z")), null);
});

test("missing status is not treated as closed", () => {
  const c = toCase({ dispute_id: "X", seller_response_due_date: "2026-11-20T00:00:00Z" });
  assert.equal(responseEligibility(c, new Date("2026-11-04T00:00:00Z")).canRespond, true);
});

test("UNDER_REVIEW and RESOLVED cannot be answered", () => {
  for (const status of ["UNDER_REVIEW", "RESOLVED", "CANCELLED"]) {
    const c = toCase({ dispute_id: "X", status, seller_response_due_date: "2026-11-20T00:00:00Z" });
    assert.deepEqual(responseEligibility(c, new Date("2026-11-04T00:00:00Z")), { canRespond: false, reason: "CLOSED" }, status);
  }
});

test("unknown reason gives no evidence type and an UNKNOWN case", () => {
  const c = toCase({ dispute_id: "X", reason: "NEW_PAYPAL_REASON" });
  assert.equal(c.reason, "UNKNOWN");
  assert.equal(requiredEvidence(c.reason), null);
});

test("bad money values become null, not NaN", () => {
  const c = toCase({ dispute_id: "X", dispute_amount: { currency_code: "EUR", value: "abc" },
    fund_movements: [{ type: "HOLD_PLACED", amount: { value: "-5" } }] });
  assert.equal(c.amount, null);
  assert.equal(c.holdAmount, null);
});

test("no HOLD_PLACED movement gives a null hold, not another movement's amount", () => {
  const c = toCase({ dispute_id: "X", fund_movements: [{ type: "FEE", amount: { currency_code: "EUR", value: "-1.00" } }] });
  assert.equal(c.holdAmount, null);
});

test("seller_protection NOT_ELIGIBLE is false; missing protection is null", () => {
  assert.equal(toCase({ dispute_id: "X", seller_protection: { status: "NOT_ELIGIBLE" } }).sellerProtectionEligible, false);
  assert.equal(toCase({ dispute_id: "X" }).sellerProtectionEligible, null);
});

test("disputes with several transactions use the first seller transaction id", () => {
  const c = toCase({ dispute_id: "X", disputed_transactions: [{ seller_transaction_id: "A1" }, { seller_transaction_id: "B2" }] });
  assert.equal(c.transactionId, "A1");
});

test("a zero-amount dispute is kept as a real value, not dropped", () => {
  const c = toCase({ dispute_id: "X", dispute_amount: { currency_code: "EUR", value: "0.00" } });
  assert.deepEqual(c.amount, { currency: "EUR", value: 0 });
});

// Guard: values that are false or zero are real facts and must count.
test("false and zero facts count as grounded", () => {
  assert.equal(isGrounded({ text: "No tracking.", fields: ["hasTracking"] }, { hasTracking: false }), true);
  assert.equal(isGrounded({ text: "Zero hold.", fields: ["holdAmount"] }, { holdAmount: 0 }), true);
});

test("claim with a non-string text or non-array fields is removed, not thrown on", () => {
  assert.equal(isGrounded({ text: undefined as unknown as string, fields: ["reason"] }, { reason: "INR" }), true);
  assert.equal(isGrounded({ text: "x", fields: "reason" as unknown as string[] }, { reason: "INR" }), false);
});

test("normal wording with win/lose inside other words is not removed", () => {
  assert.equal(isGrounded({ text: "The window for a reply closes on 20 Nov.", fields: ["responseDueAt"] }, { responseDueAt: "x" }), true);
  assert.equal(isGrounded({ text: "The tracking close date is shown.", fields: ["responseDueAt"] }, { responseDueAt: "x" }), true);
});

test("applyGuard with an empty claims list is YOUR_CALL and LOW", () => {
  const out = applyGuard({ recommendation: "FIGHT", confidence: "HIGH", claims: [] }, {});
  assert.equal(out.recommendation, "YOUR_CALL");
  assert.equal(out.confidence, "LOW");
});

// Model replies: the model sometimes wraps JSON in prose or a code fence.
test("accepts JSON wrapped in a code fence and prose", () => {
  const r = parseRecommendation('Here you go:\n```json\n{"recommendation":"REFUND","confidence":"HIGH","claims":[{"text":"Reason is INR.","fields":["reason"]}]}\n```');
  assert.equal(r.recommendation, "REFUND");
});

test("rejects a reply whose JSON is truncated", () => {
  assert.throws(() => parseRecommendation('{"recommendation":"FIGHT","confidence":"HIGH","claims":[{"text":"Reason'));
});

test("rejects a non-array claims field", () => {
  assert.throws(() => parseRecommendation('{"recommendation":"FIGHT","confidence":"HIGH","claims":"none"}'));
});

test("prompt gives the net-of-fees note and seller answers as facts", () => {
  const c = toCase({ dispute_id: "X", reason: "SNAD", fund_movements: [{ type: "HOLD_PLACED", amount: { currency_code: "EUR", value: "-81.76" } }] });
  const f = factsFor(c, { canRespond: true, daysLeft: 3 }, { hasTracking: false, matchesListing: false });
  assert.equal(f.hasTracking, false);
  assert.equal(f.matchesListing, false);
  assert.equal(f.evidenceTypeNeeded, "OTHER");
});

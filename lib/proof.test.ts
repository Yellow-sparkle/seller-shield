import { test } from "node:test";
import assert from "node:assert/strict";
import { toCase } from "./dispute.ts";
import { inrProofRule, proofConditions, unauthorisedNotCoveredRule, unauthorisedProofRule } from "./proof.ts";
import { applyProofRule } from "./recommend.ts";

const inr = toCase({ dispute_id: "X", reason: "INR", status: "OPEN", dispute_amount: { currency_code: "EUR", value: "40.00" } });
const snad = toCase({ dispute_id: "Y", reason: "SNAD", status: "OPEN", dispute_amount: { currency_code: "EUR", value: "25.00" } });

test("INR with no tracking is REFUND", () => {
  assert.equal(inrProofRule(inr, { hasTracking: false }), "REFUND");
});

test("INR with tracking but no delivery confirmed is YOUR_CALL (wait and check)", () => {
  assert.equal(inrProofRule(inr, { hasTracking: true }), "YOUR_CALL");
  assert.equal(inrProofRule(inr, { hasTracking: true, delivered: true, deliveryDate: "2026-10-14" }), "YOUR_CALL");
});

test("INR with full proof (tracking, delivered, date, address) lets the model decide", () => {
  const full = { hasTracking: true, delivered: true, deliveryDate: "2026-10-14", deliveredToTransactionAddress: true };
  assert.equal(inrProofRule(inr, full), null);
});

test("unanswered tracking leaves the decision to the model", () => {
  assert.equal(inrProofRule(inr, {}), null);
});

test("the rule ignores non-INR reasons", () => {
  assert.equal(inrProofRule(snad, { hasTracking: false }), null);
});

test("proof conditions report met, not met, and unknown", () => {
  const p = proofConditions({ hasTracking: true, delivered: false });
  assert.equal(p.tracking, "met");
  assert.equal(p.delivered, "not met");
  assert.equal(p.addressMatch, "unknown");
});

test("applyProofRule overrides the model's FIGHT on no tracking", () => {
  const out = applyProofRule({ recommendation: "FIGHT", confidence: "HIGH", claims: [] }, inr, { hasTracking: false });
  assert.equal(out.recommendation, "REFUND");
});

test("unauthorised: shipped by the deadline with full proof lets the model decide", () => {
  const u = toCase({ dispute_id: "U", reason: "UNAUTHORISED", status: "OPEN", dispute_amount: { currency_code: "EUR", value: "75.00" } });
  const ok = { hasTracking: true, noticeDate: "2026-11-01", shipmentDate: "2026-11-02", shippedToTransactionAddress: true };
  assert.equal(unauthorisedProofRule(u, ok, new Date("2026-11-03T00:00:00Z")), null);
});

test("unauthorised: shipped after the deadline is YOUR_CALL", () => {
  const u = toCase({ dispute_id: "U", reason: "UNAUTHORISED", status: "OPEN", dispute_amount: { currency_code: "EUR", value: "75.00" } });
  const late = { hasTracking: true, noticeDate: "2026-11-01", shipmentDate: "2026-11-04", shippedToTransactionAddress: true };
  assert.equal(unauthorisedProofRule(u, late, new Date("2026-11-05T00:00:00Z")), "YOUR_CALL");
});

test("unauthorised: no notice date means no rule (the screen asks for it)", () => {
  const u = toCase({ dispute_id: "U", reason: "UNAUTHORISED", status: "OPEN", dispute_amount: { currency_code: "EUR", value: "75.00" } });
  assert.equal(unauthorisedProofRule(u, { hasTracking: true }, new Date("2026-11-05T00:00:00Z")), null);
});

test("unauthorised: deadline passed with no proof on file is YOUR_CALL", () => {
  const u = toCase({ dispute_id: "U", reason: "UNAUTHORISED", status: "OPEN", dispute_amount: { currency_code: "EUR", value: "75.00" } });
  assert.equal(unauthorisedProofRule(u, { noticeDate: "2026-11-01" }, new Date("2026-11-05T00:00:00Z")), "YOUR_CALL");
});

test("unauthorised: a failed tracking condition is YOUR_CALL", () => {
  const u = toCase({ dispute_id: "U", reason: "UNAUTHORISED", status: "OPEN", dispute_amount: { currency_code: "EUR", value: "75.00" } });
  assert.equal(unauthorisedProofRule(u, { noticeDate: "2026-11-01", hasTracking: false }, new Date("2026-11-01T12:00:00Z")), "YOUR_CALL");
});

const uNotCovered = toCase({ dispute_id: "U4", reason: "UNAUTHORISED", status: "OPEN",
  dispute_amount: { currency_code: "EUR", value: "75.00" }, seller_protection: { status: "NOT_ELIGIBLE" } });
const uEligible = toCase({ dispute_id: "U3", reason: "UNAUTHORISED", status: "OPEN",
  dispute_amount: { currency_code: "EUR", value: "75.00" }, seller_protection: { status: "ELIGIBLE" } });

test("unauthorised, not covered, no evidence: REFUND by default (case 4)", () => {
  assert.equal(unauthorisedNotCoveredRule(uNotCovered, { hasTracking: false }), "REFUND");
  assert.equal(unauthorisedNotCoveredRule(uNotCovered, {}), "REFUND");
});

test("unauthorised, not covered, with shipping evidence: YOUR_CALL", () => {
  assert.equal(unauthorisedNotCoveredRule(uNotCovered, { hasTracking: true }), "YOUR_CALL");
  assert.equal(unauthorisedNotCoveredRule(uNotCovered, { shipmentDate: "2026-10-30" }), "YOUR_CALL");
  assert.equal(unauthorisedNotCoveredRule(uNotCovered, { shippedToTransactionAddress: true }), "YOUR_CALL");
});

test("the not-covered rule does not touch eligible or unknown protection", () => {
  assert.equal(unauthorisedNotCoveredRule(uEligible, { hasTracking: false }), null);
  const u = toCase({ dispute_id: "U5", reason: "UNAUTHORISED", status: "OPEN", dispute_amount: { currency_code: "EUR", value: "75.00" } });
  assert.equal(unauthorisedNotCoveredRule(u, { hasTracking: false }), null);
});

test("applyProofRule forces REFUND with HIGH confidence for case 4", () => {
  const r = applyProofRule({ recommendation: "FIGHT", confidence: "HIGH" }, uNotCovered, { hasTracking: false });
  assert.equal(r.recommendation, "REFUND");
  assert.equal(r.confidence, "HIGH");
});

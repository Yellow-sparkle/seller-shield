import { test } from "node:test";
import assert from "node:assert/strict";
import { toCase } from "./dispute.ts";
import { inrProofRule, proofConditions } from "./proof.ts";
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

import { test } from "node:test";
import assert from "node:assert/strict";
import { toCase } from "./dispute.ts";
import { chargebackRule, inrProofRule, inrWaitNote, proofConditions, snadRule, unknownReasonRule, unauthorisedNotCoveredRule, unauthorisedProofRule } from "./proof.ts";
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

test("unauthorised: shipped after the deadline is REFUND (Kate, 5 Nov 2026)", () => {
  const u = toCase({ dispute_id: "U", reason: "UNAUTHORISED", status: "OPEN", dispute_amount: { currency_code: "EUR", value: "75.00" } });
  const late = { hasTracking: true, noticeDate: "2026-11-01", shipmentDate: "2026-11-04", shippedToTransactionAddress: true };
  assert.equal(unauthorisedProofRule(u, late, new Date("2026-11-05T00:00:00Z")), "REFUND");
});

test("unauthorised: no notice date means no rule (the screen asks for it)", () => {
  const u = toCase({ dispute_id: "U", reason: "UNAUTHORISED", status: "OPEN", dispute_amount: { currency_code: "EUR", value: "75.00" } });
  assert.equal(unauthorisedProofRule(u, { hasTracking: true }, new Date("2026-11-05T00:00:00Z")), null);
});

test("unauthorised: deadline passed with no proof on file is REFUND (Kate, 5 Nov 2026)", () => {
  const u = toCase({ dispute_id: "U", reason: "UNAUTHORISED", status: "OPEN", dispute_amount: { currency_code: "EUR", value: "75.00" } });
  assert.equal(unauthorisedProofRule(u, { noticeDate: "2026-11-01" }, new Date("2026-11-05T00:00:00Z")), "REFUND");
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

const snadCase = toCase({ dispute_id: "S5", reason: "SNAD", status: "OPEN", dispute_amount: { currency_code: "EUR", value: "25.00" }, seller_protection: { status: "ELIGIBLE" } });

test("SNAD, item matches: FIGHT even though the sandbox flag says ELIGIBLE (case 5)", () => {
  assert.equal(snadRule(snadCase, { matchesListing: true }), "FIGHT");
  const r = applyProofRule({ recommendation: "REFUND", confidence: "HIGH" }, snadCase, { matchesListing: true });
  assert.equal(r.recommendation, "FIGHT");
  assert.equal(r.confidence, "HIGH");
});

test("SNAD, match unknown or partly matches: YOUR_CALL", () => {
  assert.equal(snadRule(snadCase, {}), "YOUR_CALL");
  assert.equal(snadRule(snadCase, { matchesListing: "partly" }), "YOUR_CALL");
});

test("SNAD, item does not match: REFUND (HIGH), even though the sandbox flag says ELIGIBLE (case 5 gap 1)", () => {
  assert.equal(snadRule(snadCase, { matchesListing: false }), "REFUND");
  const r = applyProofRule({ recommendation: "FIGHT", confidence: "HIGH" }, snadCase, { matchesListing: false });
  assert.equal(r.recommendation, "REFUND");
  assert.equal(r.confidence, "HIGH");
});

test("snadRule ignores other reasons", () => {
  assert.equal(snadRule(inr, { matchesListing: true }), null);
});

test("card-issuer chargeback: YOUR_CALL whatever the answers say (case 1 chargeback variant)", () => {
  const cb = toCase({ dispute_id: "CB", reason: "SNAD", status: "OPEN", dispute_life_cycle_stage: "CHARGEBACK",
    dispute_amount: { currency_code: "EUR", value: "25.00" }, seller_protection: { status: "ELIGIBLE" } });
  assert.equal(chargebackRule(cb), "YOUR_CALL");
  const r = applyProofRule({ recommendation: "FIGHT", confidence: "HIGH" }, cb, { matchesListing: true });
  assert.equal(r.recommendation, "YOUR_CALL");
  assert.equal(chargebackRule(snadCase), null);
});

const inrDue = (due: string) => toCase({ dispute_id: "I1", reason: "INR", status: "OPEN", dispute_life_cycle_stage: "INQUIRY",
  dispute_amount: { currency_code: "EUR", value: "40.00" }, seller_response_due_date: due, seller_protection: { status: "ELIGIBLE" } });

test("case 1 WAIT: tracking, not delivered, due date far off: YOUR_CALL (wait)", () => {
  const c = inrDue("2026-11-20T10:00:00Z");
  assert.equal(inrProofRule(c, { hasTracking: true }), "YOUR_CALL");
  assert.match(inrWaitNote(c, { hasTracking: true }, new Date("2026-11-10T10:00:00Z")) ?? "", /Wait/);
});

test("case 1: tracking, not delivered, last day: still YOUR_CALL, with a prompt to refund", () => {
  const c = inrDue("2026-11-20T10:00:00Z");
  assert.equal(inrProofRule(c, { hasTracking: true }), "YOUR_CALL");
  assert.match(inrWaitNote(c, { hasTracking: true }, new Date("2026-11-19T10:00:00Z")) ?? "", /Check the tracking link/);
  assert.match(inrWaitNote(c, { hasTracking: true }, new Date("2026-11-10T10:00:00Z")) ?? "", /Wait/);
  assert.match(inrWaitNote(c, { hasTracking: true, delivered: true }, new Date("2026-11-19T10:00:00Z")) ?? "", /not confirmed/);
  assert.equal(inrWaitNote(c, { hasTracking: true, delivered: true, deliveryDate: "2026-11-12", deliveredToTransactionAddress: true }, new Date("2026-11-19T10:00:00Z")), null);
});

test("case 1: delivered but address not matching stays YOUR_CALL at the deadline", () => {
  const c = inrDue("2026-11-20T10:00:00Z");
  const a = { hasTracking: true, delivered: true, deliveryDate: "2026-11-12", deliveredToTransactionAddress: false };
  assert.equal(inrProofRule(c, a), "YOUR_CALL");
});

test("case 1: delivered but address not confirmed, last day: prompt to check, still YOUR_CALL", () => {
  const c = inrDue("2026-11-20T10:00:00Z");
  const a = { hasTracking: true, delivered: true, deliveryDate: "2026-11-12", deliveredToTransactionAddress: false };
  assert.equal(inrProofRule(c, a), "YOUR_CALL");
  assert.match(inrWaitNote(c, a, new Date("2026-11-19T10:00:00Z")) ?? "", /Who caused it/);
});

test("case 1: more than one parcel is YOUR_CALL, even with full proof", () => {
  const c = inrDue("2026-11-20T10:00:00Z");
  const a = { hasTracking: true, delivered: true, deliveryDate: "2026-11-12", deliveredToTransactionAddress: true, parcelCount: 2 };
  assert.equal(inrProofRule(c, a), "YOUR_CALL");
  assert.equal(inrProofRule(c, { ...a, parcelCount: 1 }), null);
});

test("case 1: no wait note once the buyer has gone to the card issuer", () => {
  const cb = toCase({ dispute_id: "CB1", reason: "INR", status: "OPEN", dispute_life_cycle_stage: "CHARGEBACK",
    dispute_amount: { currency_code: "EUR", value: "40.00" }, seller_response_due_date: "2026-11-20T10:00:00Z" });
  assert.equal(inrWaitNote(cb, { hasTracking: true }, new Date("2026-11-19T10:00:00Z")), null);
});

test("case 1/10: address mismatch caused by the seller is REFUND", () => {
  const c = inrDue("2026-11-20T10:00:00Z");
  const base = { hasTracking: true, delivered: true, deliveryDate: "2026-11-12", deliveredToTransactionAddress: false };
  assert.equal(inrProofRule(c, { ...base, addressMismatchCause: "seller", causeEvidence: "carrier scan" }), "REFUND");
});

test("case 1/10: address mismatch caused by the buyer or unknown stays YOUR_CALL", () => {
  const c = inrDue("2026-11-20T10:00:00Z");
  const base = { hasTracking: true, delivered: true, deliveryDate: "2026-11-12", deliveredToTransactionAddress: false };
  assert.equal(inrProofRule(c, { ...base, addressMismatchCause: "buyer" }), "YOUR_CALL");
  assert.equal(inrProofRule(c, { ...base, addressMismatchCause: "unknown" }), "YOUR_CALL");
  assert.equal(inrProofRule(c, base), "YOUR_CALL");
});

test("case 1/10: a seller cause without evidence is treated as unknown (YOUR_CALL)", () => {
  const c = inrDue("2026-11-20T10:00:00Z");
  const base = { hasTracking: true, delivered: true, deliveryDate: "2026-11-12", deliveredToTransactionAddress: false };
  assert.equal(inrProofRule(c, { ...base, addressMismatchCause: "seller" }), "YOUR_CALL");
  assert.equal(inrProofRule(c, { ...base, addressMismatchCause: "seller", causeEvidence: "carrier scan" }), "REFUND");
});

test("case 1/10: the address-mismatch note asks for the cause and says refund is final", () => {
  const c = inrDue("2026-11-20T10:00:00Z");
  const note = inrWaitNote(c, { hasTracking: true, delivered: true, deliveredToTransactionAddress: false }, new Date("2026-11-10T10:00:00Z")) ?? "";
  assert.match(note, /Who caused it/);
  assert.match(note, /Refund is final/);
  assert.match(note, /locker or relative/);
});

const unk = toCase({ dispute_id: "U15", reason: "NEW_PAYPAL_REASON", status: "OPEN", dispute_amount: { currency_code: "EUR", value: "30.00" } });

test("unknown reason: buyer right with evidence is REFUND (G15, Kate, 5 Nov 2026)", () => {
  assert.equal(unknownReasonRule(unk, { whoIsRight: "buyer", rightEvidence: "carrier scan" }), "REFUND");
});

test("unknown reason: seller right with evidence, or no evidence, is YOUR_CALL", () => {
  assert.equal(unknownReasonRule(unk, { whoIsRight: "seller", rightEvidence: "order record" }), "YOUR_CALL");
  assert.equal(unknownReasonRule(unk, { whoIsRight: "buyer" }), "YOUR_CALL");
  assert.equal(unknownReasonRule(unk, {}), "YOUR_CALL");
});

test("unknown reason rule does not touch known reasons", () => {
  assert.equal(unknownReasonRule(inr, { whoIsRight: "buyer", rightEvidence: "x" }), null);
});

test("OTHER reason is forced YOUR_CALL (G07, Kate, 5 Nov 2026)", () => {
  const other = toCase({ dispute_id: "O7", reason: "OTHER", status: "OPEN", dispute_amount: { currency_code: "EUR", value: "30.00" } });
  assert.equal(unknownReasonRule(other, {}), "YOUR_CALL");
  const r = applyProofRule({ recommendation: "FIGHT", confidence: "HIGH" }, other, {});
  assert.equal(r.recommendation, "YOUR_CALL");
});

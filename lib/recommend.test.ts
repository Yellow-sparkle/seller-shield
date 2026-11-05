import { test } from "node:test";
import assert from "node:assert/strict";
import { toCase } from "./dispute.ts";
import { applyProofRule, buildPrompt, enforceEligibility, parseRecommendation } from "./recommend.ts";

const c = toCase({ dispute_id: "X", reason: "INR", status: "OPEN",
  dispute_amount: { currency_code: "EUR", value: "60.00" } });

test("prompt carries the case facts and asks for JSON only", () => {
  const p = buildPrompt(c, { canRespond: true, daysLeft: 20 });
  assert.match(p, /"reason": "INR"/);
  assert.match(p, /"evidenceTypeNeeded": "PROOF_OF_FULFILLMENT"/);
  assert.match(p, /JSON only/);
});

test("parses a high-confidence FIGHT", () => {
  const r = parseRecommendation('{"recommendation":"FIGHT","confidence":"HIGH","claims":[{"text":"reason is INR","fields":["reason"]}]}');
  assert.equal(r.recommendation, "FIGHT");
});

test("low confidence is forced to YOUR_CALL", () => {
  const r = parseRecommendation('{"recommendation":"REFUND","confidence":"LOW","claims":[{"text":"amount unknown","fields":["amount"]}]}');
  assert.equal(r.recommendation, "YOUR_CALL");
});

test("rejects off-schema replies", () => {
  assert.throws(() => parseRecommendation("no json here"));
  assert.throws(() => parseRecommendation('{"recommendation":"MAYBE","confidence":"HIGH","claims":[]}'));
  assert.throws(() => parseRecommendation('{"recommendation":"FIGHT","confidence":"HIGH"}'));
});

// G09: PayPal is reviewing the case, so the seller cannot respond. The model said FIGHT; the rule must win.
test("G09: a FIGHT is forced to YOUR_CALL when the seller cannot respond", () => {
  const forced = enforceEligibility({ recommendation: "FIGHT", confidence: "HIGH", claims: [] },
    { canRespond: false, reason: "CLOSED" });
  assert.equal(forced.recommendation, "YOUR_CALL");
  assert.equal(forced.confidence, "LOW");
});

test("a FIGHT stands when the seller can respond", () => {
  const kept = enforceEligibility({ recommendation: "FIGHT", confidence: "HIGH", claims: [] },
    { canRespond: true, daysLeft: 5 });
  assert.equal(kept.recommendation, "FIGHT");
});

test("the recommender prompt says tracking alone is not proof of delivery", () => {
  const p = buildPrompt(c, { canRespond: true, daysLeft: 20 });
  assert.match(p, /not proof of delivery/);
  assert.match(p, /no tracking recorded/);
});

test("case 4: unauthorised, not covered, no evidence is forced to REFUND", () => {
  const u4 = toCase({ dispute_id: "G04", reason: "UNAUTHORISED", status: "WAITING_FOR_SELLER_RESPONSE",
    dispute_amount: { currency_code: "EUR", value: "75.00" }, seller_response_due_date: "2026-11-22T10:00:00Z",
    seller_protection: { status: "NOT_ELIGIBLE" } });
  const r = applyProofRule({ recommendation: "FIGHT", confidence: "HIGH" }, u4, { hasTracking: false });
  assert.equal(r.recommendation, "REFUND");
});

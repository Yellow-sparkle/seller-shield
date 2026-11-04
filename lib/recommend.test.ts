import { test } from "node:test";
import assert from "node:assert/strict";
import { toCase } from "./dispute.ts";
import { buildPrompt, enforceEligibility, parseRecommendation } from "./recommend.ts";

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

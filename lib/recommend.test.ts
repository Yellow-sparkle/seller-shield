import { test } from "node:test";
import assert from "node:assert/strict";
import { toCase } from "./dispute.ts";
import { buildPrompt, parseRecommendation } from "./recommend.ts";

const c = toCase({ dispute_id: "X", reason: "INR", status: "OPEN",
  dispute_amount: { currency_code: "EUR", value: "60.00" } });

test("prompt carries the case facts and asks for JSON only", () => {
  const p = buildPrompt(c, { canRespond: true, daysLeft: 20 });
  assert.match(p, /"reason": "INR"/);
  assert.match(p, /"evidenceTypeNeeded": "PROOF_OF_FULFILLMENT"/);
  assert.match(p, /JSON only/);
});

test("parses a high-confidence FIGHT", () => {
  const r = parseRecommendation('{"recommendation":"FIGHT","confidence":"HIGH","rationale":"reason is INR, tracking needed"}');
  assert.equal(r.recommendation, "FIGHT");
});

test("low confidence is forced to YOUR_CALL", () => {
  const r = parseRecommendation('{"recommendation":"REFUND","confidence":"LOW","rationale":"amount is null"}');
  assert.equal(r.recommendation, "YOUR_CALL");
});

test("rejects off-schema replies", () => {
  assert.throws(() => parseRecommendation("no json here"));
  assert.throws(() => parseRecommendation('{"recommendation":"MAYBE","confidence":"HIGH","rationale":"x"}'));
  assert.throws(() => parseRecommendation('{"recommendation":"FIGHT","confidence":"HIGH","rationale":""}'));
});

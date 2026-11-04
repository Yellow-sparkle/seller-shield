import { test } from "node:test";
import assert from "node:assert/strict";
import { applyGuard, isGrounded } from "./guard.ts";

const facts = { reason: "INR", holdAmount: null, sellerProtectionEligible: true };

test("keeps claims whose listed fields all have values", () => {
  const out = applyGuard(
    { recommendation: "FIGHT", confidence: "HIGH", claims: [{ text: "Reason is INR.", fields: ["reason"] }] },
    facts,
  );
  assert.equal(out.removed.length, 0);
  assert.equal(out.claims.length, 1);
});

test("removes a claim with no fields, even if it sounds sensible", () => {
  const out = applyGuard(
    { recommendation: "FIGHT", confidence: "HIGH", claims: [
      { text: "INR claims can usually be won.", fields: [] },
      { text: "Reason is INR.", fields: ["reason"] },
    ] },
    facts,
  );
  assert.equal(out.removed.length, 1);
  assert.equal(out.claims.length, 1);
});

test("removes a claim that relies on a null field", () => {
  assert.equal(isGrounded({ text: "Hold is known.", fields: ["holdAmount"] }, facts), false);
});

test("a claim naming a field that does not exist is removed", () => {
  assert.equal(isGrounded({ text: "x", fields: ["madeUp"] }, facts), false);
});

test("if nothing is grounded, the result is YOUR_CALL", () => {
  const out = applyGuard({ recommendation: "REFUND", confidence: "HIGH", claims: [{ text: "Refund.", fields: [] }] }, facts);
  assert.equal(out.recommendation, "YOUR_CALL");
});

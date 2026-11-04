import { test } from "node:test";
import assert from "node:assert/strict";
import { applyGuard, citedKeys } from "./guard.ts";

const facts = { reason: "INR", holdAmount: null, sellerProtectionEligible: true };

test("keeps sentences that cite a non-null fact", () => {
  const out = applyGuard(
    { recommendation: "FIGHT", confidence: "HIGH", rationale: "The reason is INR. Seller protection is eligible via sellerProtectionEligible." },
    facts,
  );
  assert.equal(out.removed.length, 0);
  assert.equal(out.recommendation, "FIGHT");
});

test("removes an uncited sentence", () => {
  const out = applyGuard(
    { recommendation: "FIGHT", confidence: "HIGH", rationale: "The reason is INR. Buyers always lie." },
    facts,
  );
  assert.deepEqual(out.removed, ["Buyers always lie."]);
  assert.equal(out.rationale, "The reason is INR.");
});

test("a sentence that names only a null field is not grounded", () => {
  assert.deepEqual(citedKeys("The holdAmount is unknown.", facts), []);
});

test("if nothing is grounded, the result is YOUR_CALL", () => {
  const out = applyGuard({ recommendation: "REFUND", confidence: "HIGH", rationale: "Just refund them." }, facts);
  assert.equal(out.recommendation, "YOUR_CALL");
});

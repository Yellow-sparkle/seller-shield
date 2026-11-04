import { test } from "node:test";
import assert from "node:assert/strict";
import { toCase } from "./dispute.ts";
import { requiredEvidence, responseEligibility } from "./rules.ts";
import fixtures from "./fixtures/sandbox-disputes.json" with { type: "json" };

const now = new Date("2026-11-04T00:00:00Z");

test("sandbox fixtures map to the expected evidence type", () => {
  const cases = (fixtures as object[]).map((f) => toCase(f as never));
  assert.deepEqual(cases.map((c) => requiredEvidence(c.reason)), [
    "PROOF_OF_FULFILLMENT",
    "PROOF_OF_FULFILLMENT",
    "OTHER",
  ]);
});

test("an open dispute with a future due date can be answered", () => {
  const c = toCase((fixtures as object[])[0] as never);
  assert.deepEqual(responseEligibility(c, now), { canRespond: true, daysLeft: 20 });
});

test("an overdue dispute cannot be answered", () => {
  const c = toCase({ dispute_id: "X", status: "OPEN", seller_response_due_date: "2026-11-01T00:00:00Z" });
  assert.deepEqual(responseEligibility(c, now), { canRespond: false, reason: "OVERDUE" });
});

test("a closed dispute cannot be answered", () => {
  const c = toCase({ dispute_id: "X", status: "RESOLVED", seller_response_due_date: "2026-11-30T00:00:00Z" });
  assert.deepEqual(responseEligibility(c, now), { canRespond: false, reason: "CLOSED" });
});

test("unknown reason has no evidence type", () => {
  assert.equal(requiredEvidence("UNKNOWN"), null);
});

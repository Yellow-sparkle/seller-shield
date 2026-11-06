import { test } from "node:test";
import assert from "node:assert/strict";
import { toCase } from "./dispute.ts";
import { decideBy, protectionLabel, requiredEvidence, responseEligibility } from "./rules.ts";
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
  const c = toCase({ dispute_id: "X", status: "WAITING_FOR_SELLER_RESPONSE", seller_response_due_date: "2026-11-24T00:00:00Z" });
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

test("FGC sandbox dispute: seller ID, protection and net hold match the live response", () => {
  const f = (fixtures as object[]).find((x) => (x as { dispute_id: string }).dispute_id === "PP-R-FGC-10196238");
  const c = toCase(f as never);
  assert.equal(c.transactionId, "7RX812769J8875301");
  assert.equal(c.sellerProtectionEligible, true);
  assert.deepEqual(c.holdAmount, { currency: "EUR", value: -43.12 });
});

test("NVP sandbox dispute: seller ID, protection and net hold match the live response", () => {
  const f = (fixtures as object[]).find((x) => (x as { dispute_id: string }).dispute_id === "PP-R-NVP-10196239");
  const c = toCase(f as never);
  assert.equal(c.transactionId, "11X88937YC2460212");
  assert.equal(c.sellerProtectionEligible, true);
  assert.deepEqual(c.holdAmount, { currency: "EUR", value: -81.76 });
});

test("GJM sandbox dispute: seller ID, protection and net hold match the live response", () => {
  const f = (fixtures as object[]).find((x) => (x as { dispute_id: string }).dispute_id === "PP-R-GJM-10196233");
  const c = toCase(f as never);
  assert.equal(c.transactionId, "35W222794X4866508");
  assert.equal(c.sellerProtectionEligible, true);
  assert.deepEqual(c.holdAmount, { currency: "EUR", value: -57.61 });
});

test("NVP (SNAD) shows Not covered even though the sandbox says ELIGIBLE", () => {
  const f = (fixtures as object[]).find((x) => (x as { dispute_id: string }).dispute_id === "PP-R-NVP-10196239");
  const c = toCase(f as never);
  assert.equal(c.sellerProtectionEligible, true);
  assert.match(protectionLabel(c), /^Not covered/);
});

test("non-SNAD cases keep PayPal's protection status", () => {
  const c = toCase((fixtures as object[])[0] as never);
  assert.equal(protectionLabel(c), "Eligible");
});

test("decide-by: warns two days before the due date, and reports when it has passed", () => {
  const f = (fixtures as object[])[0];
  const c = toCase(f as never);
  const due = Date.parse(c.responseDueAt as string);
  const day = 86_400_000;
  assert.equal(decideBy(c, new Date(due - 10 * day)).state, "ok");
  assert.equal(decideBy(c, new Date(due - 1 * day)).state, "warn");
  assert.equal(decideBy(c, new Date(due + 1 * day)).state, "passed");
  assert.equal(decideBy(c, new Date(due - 1 * day)).date, (c.responseDueAt as string).slice(0, 10));
});

test("response: a deadline less than an hour away counts as passed (cut-off margin, case 8)", () => {
  const c = toCase({ dispute_id: "M", reason: "INR", status: "OPEN", dispute_amount: { currency_code: "EUR", value: "10.00" },
    seller_response_due_date: "2026-11-20T10:00:00Z" });
  assert.equal(responseEligibility(c, new Date("2026-11-20T09:30:00Z")).canRespond, false);
  assert.equal(responseEligibility(c, new Date("2026-11-20T08:30:00Z")).canRespond, true);
});

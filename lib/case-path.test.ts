import { test } from "node:test";
import assert from "node:assert/strict";
import { casePath } from "./case-path.ts";

const base = { reason: "SNAD" as const, sellerMessaged: false, trackingInPayPal: false, evidenceTicked: false, waitingForBuyer: false, closed: false };
const states = (p: Parameters<typeof casePath>[0]) => casePath(p).map((s) => s.state);

test("a new case: only the opening is done, sending evidence is the current step", () => {
  assert.deepEqual(states(base), ["done", "now", "later", "later", "later"]);
});

test("evidence not ticked does not untick the later steps PayPal confirms; on a closed case it reads Skipped (M8)", () => {
  assert.deepEqual(states({ ...base, sellerMessaged: true, closed: true }), ["done", "skipped", "done", "done", "done"]);
});

test("waiting for the buyer is the current step, an unticked step before it stays open", () => {
  assert.deepEqual(states({ ...base, sellerMessaged: true, waitingForBuyer: true }), ["done", "open", "done", "now", "later"]);
});

test("item not received: step 2 is sending the order's tracking as evidence, done once it is sent", () => {
  const p = casePath({ ...base, reason: "INR", sellerMessaged: true, trackingInPayPal: true });
  assert.equal(p[1].label, "Send tracking as evidence");
  assert.match(p[1].source, /Tracking is on the order/);
  assert.deepEqual(p.map((s) => s.state), ["done", "now", "done", "later", "later"]);
  const sent = casePath({ ...base, reason: "INR", sellerMessaged: true, trackingInPayPal: true, evidenceSent: true });
  assert.deepEqual(sent.map((s) => s.state), ["done", "done", "done", "now", "later"]);
});

test("item not received with no tracking on the order says to add it first", () => {
  assert.match(casePath({ ...base, reason: "INR" })[1].source, /Add tracking in Orders and tracking first/);
  // Waiting for the buyer with no tracking on the order (case SRZ): the evidence step is not shown as done.
  assert.equal(casePath({ ...base, reason: "INR", waitingForBuyer: true })[1].state, "open");
  assert.equal(casePath({ ...base, reason: "INR", waitingForBuyer: true, trackingInPayPal: true })[1].state, "done");
});

test("not as described: step 3 is done only once the seller ticks it", () => {
  const p = casePath({ ...base, sellerMessaged: true, evidenceTicked: true });
  assert.equal(p[1].label, "Send photos and the listing");
  assert.equal(p[1].state, "done");
});

test("evidence comes before the message to the buyer: once evidence is sent, messaging is the current step", () => {
  assert.deepEqual(states({ ...base, reason: "INR", trackingInPayPal: true, evidenceSent: true }), ["done", "done", "now", "later", "later"]);
});

test("M7: a refund has its own path", () => {
  const p = casePath({ ...base, route: "refund" });
  assert.deepEqual(p.map((s) => s.label), ["Buyer opened the case", "Refund the buyer in PayPal", "PayPal closes the case"]);
  assert.deepEqual(p.map((s) => s.state), ["done", "now", "later"]);
});

test("M7: unauthorised asks for proof of shipment", () => {
  assert.match(casePath({ ...base, reason: "UNAUTHORISED" })[1].label, /proof of shipment/);
});

test("M7: under review makes PayPal's review the current step", () => {
  const p = casePath({ ...base, sellerMessaged: true, underReview: true });
  assert.equal(p[3].label, "PayPal reviews the case");
  assert.equal(p[3].state, "now");
});

test("M7: a card-issuer case shows the issuer deciding", () => {
  const p = casePath({ ...base, chargeback: true });
  assert.equal(p[p.length - 1].label, "The buyer's card issuer decides");
  assert.equal(p[p.length - 1].state, "now");
});

test("L6: messages not loaded says so on the step", () => {
  const p = casePath({ ...base, sellerMessaged: null });
  assert.match(p[2].source, /not loaded/);
});

test("ADR 0004: a case past its deadline has no refund step, only what is left outside the dispute", () => {
  const steps = casePath({ reason: "INR", route: "refund", sellerMessaged: false, trackingInPayPal: true, evidenceTicked: false, waitingForBuyer: false, overdue: true, closed: false });
  assert.deepEqual(steps.map((s) => s.label), ["Buyer opened the case", "Ask the buyer to close the case", "PayPal decides. Appeal with new evidence if needed"]);
  assert.equal(steps[1].state, "now");
  assert.ok(!steps.some((s) => /Refund/.test(s.label)));
});

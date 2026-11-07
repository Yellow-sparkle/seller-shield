import { test } from "node:test";
import assert from "node:assert/strict";
import { casePath } from "./case-path.ts";

const base = { reason: "SNAD" as const, sellerMessaged: false, trackingInPayPal: false, evidenceTicked: false, waitingForBuyer: false, closed: false };
const states = (p: Parameters<typeof casePath>[0]) => casePath(p).map((s) => s.state);

test("a new case: only the opening is done, messaging the buyer is the current step", () => {
  assert.deepEqual(states(base), ["done", "now", "later", "later", "later"]);
});

test("evidence not ticked does not untick the later steps PayPal confirms", () => {
  assert.deepEqual(states({ ...base, sellerMessaged: true, closed: true }), ["done", "done", "open", "done", "done"]);
});

test("waiting for the buyer is the current step, an unticked step before it stays open", () => {
  assert.deepEqual(states({ ...base, sellerMessaged: true, waitingForBuyer: true }), ["done", "done", "open", "now", "later"]);
});

test("item not received uses the order's PayPal tracking for step 3", () => {
  const p = casePath({ ...base, reason: "INR", sellerMessaged: true, trackingInPayPal: true });
  assert.equal(p[2].label, "Add tracking in PayPal");
  assert.deepEqual(p.map((s) => s.state), ["done", "done", "done", "now", "later"]);
});

test("not as described: step 3 is done only once the seller ticks it", () => {
  const p = casePath({ ...base, sellerMessaged: true, evidenceTicked: true });
  assert.equal(p[2].label, "Send photos and the listing");
  assert.equal(p[2].state, "done");
});

test("a seller who has not messaged the buyer sees that as the current step, even with tracking added", () => {
  assert.deepEqual(states({ ...base, reason: "INR", trackingInPayPal: true }), ["done", "now", "done", "later", "later"]);
});

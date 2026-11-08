import { test } from "node:test";
import assert from "node:assert/strict";
import { goldenAnswer, RECORDING_CARD, screenAnswer, staleRecordings, type GoldenCase } from "./eval-answers.ts";
import { forcedRecommendation } from "./proof.ts";
import { toCase } from "./dispute.ts";
import { responseEligibility } from "./rules.ts";
import cases from "./golden/cases.json" with { type: "json" };
import recorded from "./recorded/recommendations.json" with { type: "json" };
import fixtures from "./fixtures/sandbox-disputes.json" with { type: "json" };
import demoDisputes from "./fixtures/demo-disputes.json" with { type: "json" };

// Same pinned clock as scripts/golden-check.ts.
const NOW = new Date("2026-11-05T12:00:00Z");
const golden = cases as unknown as GoldenCase[];

// Second review S8 (8 Nov 2026): the live eval only tests the model where the model decides.
for (const id of ["G20", "G21"]) {
  test(`S8: ${id} is built the screen's way and left to the model (no rule decides it)`, () => {
    const g = golden.find((x) => x.id === id)!;
    assert.ok(g.order && g.card, "built from an order and card answers");
    assert.equal(forcedRecommendation(toCase(g.dispute as never), goldenAnswer(g), NOW), null);
  });
}

test("S8: G20's carrier date reaches the answer through caseAnswer", () => {
  const a = goldenAnswer(golden.find((x) => x.id === "G20")!);
  assert.equal(a.delivered, true);
  assert.equal(a.deliveryDate, "2026-10-30");
  assert.equal(a.deliveredToTransactionAddress, true);
});

test("S8: the older golden cases keep their ready-made answers", () => {
  const g01 = golden.find((x) => x.id === "G01")!;
  assert.deepEqual(goldenAnswer(g01), g01.answer);
});

test("S8: a recording is stale when the facts it was made from changed", () => {
  const out = staleRecordings(
    { A: { answer: { hasTracking: true } }, B: { answer: { hasTracking: true } }, C: {} },
    { A: { hasTracking: true, delivered: undefined }, B: { hasTracking: false }, C: {}, D: {} },
  );
  assert.deepEqual(out, [
    { id: "B", why: "facts changed" },
    { id: "C", why: "no input stored" },
  ]);
});

// Parity with the case screen: where the rules leave a case to the model, the screen shows the recorded answer,
// so one must exist. Checked with no card answers, and for the demo case with the card filled in.
const disputes = [...(fixtures as object[]), ...(demoDisputes as object[])].map((raw) => toCase(raw as never));
const closed = ["REFUNDED", "RESOLVED", "DENIED", "CANCELLED", "WAITING_FOR_BUYER_RESPONSE"];
const screenNow = new Date("2026-11-08T12:00:00Z");
for (const [label, card] of [["no card answers", {}], ["carrier date and address No", { carrierDeliveryDate: "2026-10-29", addressMismatch: "no" as const }]] as const) {
  test(`S8 parity (${label}): every case the model decides has a recorded answer`, () => {
    for (const c of disputes) {
      if (c.status && closed.includes(c.status)) continue;
      if (!responseEligibility(c, screenNow).canRespond) continue;
      const forced = forcedRecommendation(c, screenAnswer(c.disputeId, c.transactionId, card), screenNow);
      if (forced === null) assert.ok((recorded as Record<string, unknown>)[c.disputeId], `${c.disputeId} needs a recorded answer`);
    }
  });
}

test("S8 parity: recordings that kept their input still match today's facts", () => {
  const current = Object.fromEntries(disputes.map((c) => [c.disputeId, screenAnswer(c.disputeId, c.transactionId, RECORDING_CARD[c.disputeId])]));
  const stale = staleRecordings(recorded as never, current).filter((s) => s.why === "facts changed");
  assert.deepEqual(stale, [], "re-record with scripts/live-check.ts --record --only <id>");
});

test("where the seller read the delivery date doesn't count as a different fact: the AI never sees it", async () => {
  const { sameAnswer } = await import("./eval-answers.ts");
  const fromOrder = { hasTracking: true, delivered: true, deliveryDate: "2026-10-29", deliveredToTransactionAddress: true, shippedToTransactionAddress: true };
  assert.equal(sameAnswer(fromOrder, { ...fromOrder, deliverySource: "carrier tracking page" }), true);
  assert.equal(sameAnswer(fromOrder, { ...fromOrder, deliveryDate: "2026-10-30" }), false);
});

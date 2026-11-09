import { test } from "node:test";
import assert from "node:assert/strict";
import { caseAnswer } from "./case-facts.ts";
import { forcedRecommendation } from "./proof.ts";
import { toCase } from "./dispute.ts";

const now = new Date("2026-11-07T12:00:00Z");
const inr = toCase({ dispute_id: "D", reason: "INR", status: "WAITING_FOR_SELLER_RESPONSE", seller_response_due_date: "2026-11-25T09:12:00Z", dispute_life_cycle_stage: "INQUIRY" });
const delivered = { tracking: "DEMO100175", trackingStatus: "DELIVERED", deliveredDate: "2026-10-29" };

test("H1: Yes, seller caused it, with evidence gives REFUND on an INR case", () => {
  const a = caseAnswer({}, delivered, { addressMismatch: "yes", addressMismatchCause: "seller", causeEvidence: "Label shows the old address" });
  assert.equal(forcedRecommendation(inr, a, now), "REFUND");
});

test("H1: Yes, buyer caused it gives YOUR_CALL", () => {
  const a = caseAnswer({}, delivered, { addressMismatch: "yes", addressMismatchCause: "buyer", causeEvidence: "Buyer changed the address" });
  assert.equal(forcedRecommendation(inr, a, now), "YOUR_CALL");
});

test("H1: Yes, seller, but no evidence counts as unknown: YOUR_CALL", () => {
  const a = caseAnswer({}, delivered, { addressMismatch: "yes", addressMismatchCause: "seller" });
  assert.equal(forcedRecommendation(inr, a, now), "YOUR_CALL");
});

test("H2: delivered, address not answered yet: the rule says YOUR_CALL, not the model's FIGHT", () => {
  assert.equal(forcedRecommendation(inr, caseAnswer({}, delivered, {}), now), "YOUR_CALL");
});

test("H2: delivered, dated, and No to the mismatch question: full proof, the model may FIGHT", () => {
  assert.equal(forcedRecommendation(inr, caseAnswer({}, delivered, { addressMismatch: "no" }), now), null);
});

test("an order without tracking means no tracking: REFUND", () => {
  assert.equal(forcedRecommendation(inr, caseAnswer({}, { tracking: null }, {}), now), "REFUND");
});

test("answers entered for the demo win over the order", () => {
  assert.equal(caseAnswer({ hasTracking: false }, delivered, {}).hasTracking, false);
});

test("No case card answer and no order: nothing is guessed", () => {
  assert.deepEqual(caseAnswer({}, null, {}), {});
});

test("No clears the cause and evidence from the answer", () => {
  const a = caseAnswer({}, delivered, { addressMismatch: "no", addressMismatchCause: "seller", causeEvidence: "x" });
  assert.equal(a.deliveredToTransactionAddress, true);
  assert.equal(a.addressMismatchCause, undefined);
});

import { ruleReasons, normalizeDecision, routeFor, draftBasis } from "./case-facts.ts";
import { withSentTracking } from "./sent-tracking.ts";

test("PRD F3: a your-decision INR case says what would settle it", () => {
  const lines = ruleReasons("INR", caseAnswer({}, { tracking: "T", trackingStatus: "DELIVERED" }, {}), "YOUR_CALL");
  assert.match(lines[lines.length - 1], /What would settle it: the delivery date on the carrier page \(Your facts\), your answer to the address question/);
});

test("M10: old decision values map to the three options", () => {
  assert.equal(normalizeDecision("Accept refund"), "Refund");
  assert.equal(normalizeDecision("Fight. Tracking shows delivery."), "Fight");
  assert.equal(normalizeDecision("Reject recommendation"), "Not decided");
  assert.equal(normalizeDecision(undefined), "Not decided");
});

test("M10: the seller's decision drives the path and the draft, the recommendation is the fallback", () => {
  assert.equal(routeFor("Refund", "FIGHT (high confidence)"), "refund");
  assert.equal(routeFor("Not decided", "REFUND (high confidence, rule)"), "refund");
  assert.equal(routeFor("Not decided", "YOUR_CALL (low confidence)"), "fight");
  assert.equal(draftBasis("Fight", "REFUND (high confidence)"), "FIGHT");
  assert.equal(draftBasis("Not decided", "YOUR_CALL (low confidence)"), "YOUR_CALL (low confidence)");
});

test("M3: tracking sent from this browser shows on the order", () => {
  const o = withSentTracking({ orderNo: "1P" } as { orderNo: string; tracking?: string; trackingStatus?: string }, { "1P": { carrier: "DHL", tracking: "T9", at: "2026-11-07" } });
  assert.equal(o.trackingStatus, "SHIPPED");
  assert.equal(o.tracking, "T9");
});

import { addressNextStep } from "./case-facts.ts";

test("Next step on a delivered INR case follows the address answer, in plain words", () => {
  const due = "2026-11-25T09:12:00Z";
  const ans = (card: Parameters<typeof caseAnswer>[2]) => addressNextStep("INR", caseAnswer({}, delivered, card), due);
  assert.equal(ans({}), "Answer the address question below.");
  assert.match(ans({ addressMismatch: "yes" })!, /^Say who caused it/);
  assert.equal(ans({ addressMismatch: "yes", addressMismatchCause: "seller", causeEvidence: "label" }), "Refund the buyer before 25 Nov 2026. A refund is final, even if the parcel arrives later.");
  assert.equal(ans({ addressMismatch: "yes", addressMismatchCause: "buyer", causeEvidence: "msg" }), "Send the tracking as evidence before 25 Nov 2026.");
  assert.equal(ans({ addressMismatch: "no" }), "Send the tracking as evidence before 25 Nov 2026.");
  for (const s of [ans({}), ans({ addressMismatch: "yes" })]) assert.doesNotMatch(s!, /REFUND|YOUR_CALL/);
});

test("No address next step when not delivered or not INR", () => {
  assert.equal(addressNextStep("INR", caseAnswer({}, { tracking: "T", trackingStatus: "SHIPPED" }, {}), null), null);
  assert.equal(addressNextStep("SNAD", caseAnswer({}, delivered, {}), null), null);
});

// Second review S1/S2 (8 Nov 2026): "Your facts" on the card feed the rules.
test("S1: a carrier-page delivery date confirms delivery and can make an INR case strong", () => {
  const order = { tracking: "T", trackingStatus: "SHIPPED" };
  const a = caseAnswer({}, order, { carrierDeliveryDate: "2026-11-02", addressMismatch: "no" });
  assert.equal(a.delivered, true);
  assert.equal(a.deliveryDate, "2026-11-02");
  assert.equal(forcedRecommendation(inr, a, now), null);
  assert.match(ruleReasons("INR", a, "FIGHT").join(" "), /carrier page: 2026-11-02/);
});

test("S1: a malformed carrier date is ignored", () => {
  const a = caseAnswer({}, { tracking: "T", trackingStatus: "SHIPPED" }, { carrierDeliveryDate: "2 Nov" });
  assert.equal(a.delivered, false);
  assert.equal(a.deliveryDate, undefined);
});

test("S2: the order status is described as the order's status, not the carrier's", () => {
  const lines = ruleReasons("INR", caseAnswer({}, delivered, {}), "YOUR_CALL");
  assert.ok(lines.some((l) => l.startsWith("The tracking status on the order is Delivered")));
  assert.ok(!lines.some((l) => /carrier shows/.test(l)));
});

test("S1: the SNAD listing answer decides the SNAD rule", () => {
  const snad = { ...inr, reason: "SNAD" as const };
  assert.equal(forcedRecommendation(snad, caseAnswer({}, null, { matchesListing: "yes" }), now), "YOUR_CALL");
  assert.equal(forcedRecommendation(snad, caseAnswer({}, null, { matchesListing: "yes", listingEvidence: "Listing and photos before shipping" }), now), "FIGHT");
  assert.equal(forcedRecommendation(snad, caseAnswer({}, null, { matchesListing: "no" }), now), "REFUND");
  assert.equal(forcedRecommendation(snad, caseAnswer({}, null, { matchesListing: "partly" }), now), "YOUR_CALL");
  assert.match(ruleReasons("SNAD", {}, "YOUR_CALL").join(" "), /Does the item match the listing/);
});

test("S1: the card's answer wins over a coded demo answer", () => {
  assert.equal(caseAnswer({ matchesListing: "partly" }, null, { matchesListing: "yes" }).matchesListing, true);
});

test("S1: unauthorised notice and shipment dates reach the unauthorised rule", () => {
  const unauth = { ...inr, reason: "UNAUTHORISED" as const, sellerProtectionEligible: true };
  const late = caseAnswer({}, { tracking: "T", trackingStatus: "SHIPPED" }, { noticeDate: "2026-11-01", shipmentDate: "2026-11-05" });
  assert.equal(forcedRecommendation(unauth, late, now), "REFUND");
  assert.match(ruleReasons("UNAUTHORISED", {}, "YOUR_CALL").join(" "), /PayPal's notice date and the shipment date/);
});

// Found by Kate while labelling (8 Nov 2026): a parcel not yet delivered can't be "delivered to the right address".
test("answering No on the address sets shipped, and delivered only once the parcel is delivered", () => {
  const onTheWay = caseAnswer({}, { tracking: "T", trackingStatus: "SHIPPED" }, { addressMismatch: "no" });
  assert.equal(onTheWay.shippedToTransactionAddress, true);
  assert.equal(onTheWay.deliveredToTransactionAddress, undefined);
  const arrived = caseAnswer({}, { tracking: "T", trackingStatus: "SHIPPED" }, { addressMismatch: "no", carrierDeliveryDate: "2026-11-02" });
  assert.equal(arrived.deliveredToTransactionAddress, true);
});

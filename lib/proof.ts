// Proof checks from the Portugal Seller Protection terms (decisions by Kate, 5 Nov 2026).
//
// Item not received (INR): proof of delivery = verifiable tracking number, delivered status,
// delivery date, and a recipient address matching the transaction.
// Unauthorised: proof of shipment = tracking, shipment date within 2 days of PayPal's notice,
// shipped to the transaction address.
// Each condition is met, not met, or unknown (not yet answered).
import type { Case } from "./dispute.ts";
import type { SellerAnswer } from "./answers.ts";

export type ProofState = "met" | "not met" | "unknown";

export type ProofConditions = {
  tracking: ProofState;
  delivered: ProofState;
  deliveryDate: ProofState;
  addressMatch: ProofState;
};

const state = (v: boolean | string | undefined): ProofState =>
  v === true || (typeof v === "string" && v.length > 0) ? "met" : v === false ? "not met" : "unknown";

export function proofConditions(answer: SellerAnswer = {}): ProofConditions {
  return {
    tracking: state(answer.hasTracking),
    delivered: state(answer.delivered),
    deliveryDate: state(answer.deliveryDate),
    addressMatch: state(answer.deliveredToTransactionAddress),
  };
}

// INR rule (case 1 spec, Kate, 5 Nov 2026):
// - No tracking: REFUND.
// - Tracking, not yet delivered: YOUR_CALL (LOW). The seller waits and checks tracking daily. One day
//   before the response due date, the seller is prompted to refund (see inrWaitNote).
// - Delivered but not proven (date or address missing or not matching): YOUR_CALL.
// - Full proof: null, the model may FIGHT.
export function inrProofRule(c: Case, answer: SellerAnswer = {}): "REFUND" | "YOUR_CALL" | null {
  if (c.reason !== "INR") return null;
  const p = proofConditions(answer);
  if (p.tracking === "not met") return "REFUND";
  if (p.tracking === "unknown") return null;
  // More than one parcel: one parcel's tracking can't prove the whole order arrived (case 1, Kate, 5 Nov 2026).
  if ((answer.parcelCount ?? 1) > 1) return "YOUR_CALL";
  const proven = p.delivered === "met" && p.deliveryDate === "met" && p.addressMatch === "met";
  if (proven) return null;
  // Address mismatch caused by the seller (shipped to the wrong address): REFUND (Kate, 5 Nov 2026).
  // Caused by the buyer, or cause unknown: the seller decides.
  // A cause counts only with evidence; without it the cause is treated as unknown.
  const cause = answer.causeEvidence ? answer.addressMismatchCause : "unknown";
  if (p.addressMatch === "not met" && cause === "seller") return "REFUND";
  return "YOUR_CALL";
}

// Prompt for the seller on an INR case with tracking that is not yet proven (case 1, Kate, 5 Nov 2026).
// Not delivered: wait, then prompt to refund one day before the due date.
// Delivered but date or address not confirmed: prompt to check one day before the due date. Never a refund.
// Null when no prompt applies (no tracking, full proof, card-issuer chargeback, or no due date).
export function inrWaitNote(c: Case, answer: SellerAnswer = {}, now: Date = new Date()): string | null {
  if (c.reason !== "INR" || c.lifeCycleStage === "CHARGEBACK") return null;
  if (proofConditions(answer).tracking !== "met") return null;
  const proven = answer.delivered === true && !!answer.deliveryDate && answer.deliveredToTransactionAddress === true;
  if (proven) return null;
  const due = c.responseDueAt ? Date.parse(c.responseDueAt) : NaN;
  if (Number.isNaN(due)) return null;
  const lastDay = now.getTime() >= due - 86_400_000;
  if (answer.delivered === true && answer.deliveredToTransactionAddress === false) {
    return "Delivered to a different address. Who caused it? Seller's mistake gives REFUND (needs evidence, such as a carrier scan or the shipping label). Buyer's mistake or unknown gives YOUR_CALL. A locker or relative may be a valid delivery. Refund is final: if the item arrives later, the money stays with the buyer.";
  }
  if (answer.delivered === true) {
    return lastDay ? "Delivery date or address not confirmed one day before the due date. Check the tracking link before the due date." : "Delivery date or address not confirmed yet. Check the tracking link.";
  }
  if (lastDay) return "Not delivered one day before the due date. Check the tracking link, then refund unless the parcel has arrived.";
  return "Wait: tracking added, not delivered yet. Check tracking daily.";
}

// Deadline for shipment proof: 2 days after PayPal's notice. Null if the notice date is unknown.
export function shipmentDeadline(noticeDate: string | undefined): Date | null {
  if (!noticeDate) return null;
  const t = Date.parse(noticeDate);
  return Number.isNaN(t) ? null : new Date(t + 2 * 86_400_000);
}

// Unauthorised rule (case 3, approved 5 Nov 2026; past-deadline outcome changed to REFUND, Kate, 5 Nov 2026):
// - Shipped by the deadline, with tracking, to the transaction address: null (the model may FIGHT).
// - Shipped after the deadline, or the deadline passed with no proof: REFUND (protection lost, low chance to win).
// - Tracking or address condition not met, within the deadline: YOUR_CALL.
// - Nothing answered yet, or notice date unknown: null, and the screen asks for them.
export function unauthorisedProofRule(c: Case, answer: SellerAnswer = {}, now: Date = new Date()): "REFUND" | "YOUR_CALL" | null {
  if (c.reason !== "UNAUTHORISED") return null;
  const deadline = shipmentDeadline(answer.noticeDate);
  if (!deadline) return null;
  if (answer.shipmentDate) {
    const shipped = Date.parse(answer.shipmentDate);
    if (!Number.isNaN(shipped) && shipped > deadline.getTime()) return "REFUND";
  }
  if (answer.hasTracking === false || answer.shippedToTransactionAddress === false) return "YOUR_CALL";
  const proven = answer.hasTracking === true && !!answer.shipmentDate && answer.shippedToTransactionAddress === true;
  if (proven) return null;
  // Deadline passed with no proof on file: refund.
  if (now.getTime() > deadline.getTime()) return "REFUND";
  return null;
}

// Unauthorised, not covered by Seller Protection (case 4, Kate, 5 Nov 2026):
// REFUND by default. YOUR_CALL only when the seller has shipping evidence to weigh
// (tracking, a shipment date, or a shipment to the transaction address).
// Buyer-authorisation evidence has no field yet, so it is not counted here.
// Null when protection is eligible or unknown: the eligible path (case 3) applies instead.
export function unauthorisedNotCoveredRule(c: Case, answer: SellerAnswer = {}): "REFUND" | "YOUR_CALL" | null {
  if (c.reason !== "UNAUTHORISED" || c.sellerProtectionEligible !== false) return null;
  const hasEvidence = answer.hasTracking === true || !!answer.shipmentDate || answer.shippedToTransactionAddress === true;
  return hasEvidence ? "YOUR_CALL" : "REFUND";
}

// SNAD (case 5, Kate, 5 Nov 2026): SNAD is excluded in the published PT terms, so PayPal's sandbox
// "ELIGIBLE" flag does not count. Matches the listing: FIGHT. Does not match: REFUND.
// Partly matches or unknown: YOUR_CALL (the seller decides).
export function snadRule(c: Case, answer: SellerAnswer = {}): "FIGHT" | "REFUND" | "YOUR_CALL" | null {
  if (c.reason !== "SNAD") return null;
  if (answer.matchesListing === true) return "FIGHT";
  if (answer.matchesListing === false) return "REFUND";
  return "YOUR_CALL";
}

// Card-issuer route (case 1 chargeback variant, Kate, 5 Nov 2026): the buyer went to their card
// issuer, so Seller Protection does not apply and the bank decides. The seller decides (YOUR_CALL).
export function chargebackRule(c: Case): "YOUR_CALL" | null {
  return c.lifeCycleStage === "CHARGEBACK" ? "YOUR_CALL" : null;
}

// The forced answer from the deterministic rules, or null when the model decides.
// Order matters only where rules overlap; they are mutually exclusive by reason and protection.
export function forcedRecommendation(c: Case, answer: SellerAnswer = {}, now: Date = new Date()): "FIGHT" | "REFUND" | "YOUR_CALL" | null {
  return chargebackRule(c) ?? inrProofRule(c, answer) ?? unauthorisedNotCoveredRule(c, answer) ?? unauthorisedProofRule(c, answer, now) ?? snadRule(c, answer) ?? unknownReasonRule(c, answer);
}

// Unknown PayPal reason (G15, Kate, 5 Nov 2026): the app can't judge who is right, so the seller says.
// Buyer is right (with evidence): REFUND. Seller is right (with evidence): YOUR_CALL, the seller decides.
// No answer, or no evidence: YOUR_CALL.
export function unknownReasonRule(c: Case, answer: SellerAnswer = {}): "REFUND" | "YOUR_CALL" | null {
  if (c.reason !== "UNKNOWN") return null;
  if (!answer.rightEvidence) return "YOUR_CALL";
  if (answer.whoIsRight === "buyer") return "REFUND";
  return "YOUR_CALL";
}

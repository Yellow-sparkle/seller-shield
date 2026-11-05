// Proof-of-delivery check for Item Not Received (INR), from the Portugal Seller Protection terms.
// PayPal needs: a verifiable tracking number, a delivered status, a delivery date, and a recipient
// address matching the transaction. Each condition is met, not met, or unknown (not yet answered).
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

// Deterministic INR rule from Kate's decisions (5 Nov 2026).
// - No tracking: REFUND (protection cannot be met).
// - Tracking, but not yet delivered, or delivery or address unconfirmed: YOUR_CALL (wait and check).
// - Tracking, delivered, date and address confirmed: null, so the model may recommend FIGHT.
// Only applies to INR. Returns null when the rule has nothing to say.
export function inrProofRule(c: Case, answer: SellerAnswer = {}): "REFUND" | "YOUR_CALL" | null {
  if (c.reason !== "INR") return null;
  const p = proofConditions(answer);
  if (p.tracking === "not met") return "REFUND";
  if (p.tracking === "unknown") return null;
  const proven = p.delivered === "met" && p.deliveryDate === "met" && p.addressMatch === "met";
  return proven ? null : "YOUR_CALL";
}

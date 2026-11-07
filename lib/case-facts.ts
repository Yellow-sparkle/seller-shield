// The seller's answers for one case, put together from three places (review finding H1/H2, 7 Nov 2026):
// 1. answers entered for the demo (lib/answers.ts), which win when present;
// 2. the order behind the case (Orders and tracking): tracking number, carrier status and delivery date;
// 3. the address mismatch question on the case card.
// Before this, the card's answers were saved but the INR rule never read them, and an order with tracking
// was treated as "tracking unknown", so the recorded model answer (FIGHT) skipped Kate's INR proof rule.
import type { SellerAnswer } from "./answers.ts";

export type OrderFacts = { tracking?: string | null; trackingStatus?: string | null; deliveredDate?: string | null };
export type CardAnswers = {
  addressMismatch?: "yes" | "no";
  addressMismatchCause?: "seller" | "buyer" | "unknown";
  causeEvidence?: string;
};

export function caseAnswer(base: SellerAnswer = {}, order?: OrderFacts | null, card: CardAnswers = {}): SellerAnswer {
  const a: SellerAnswer = { ...base };
  if (order) {
    if (a.hasTracking === undefined) a.hasTracking = !!order.tracking;
    // A carrier status says whether it was delivered. No status: unknown.
    if (a.delivered === undefined && order.tracking && order.trackingStatus) a.delivered = order.trackingStatus === "DELIVERED";
    if (a.deliveryDate === undefined && order.deliveredDate) a.deliveryDate = order.deliveredDate;
  }
  // "Was the parcel sent to a different address than the one on the order?" Yes = address does not match.
  // The same answer feeds the unauthorised rule's "shipped to the transaction address".
  if (card.addressMismatch === "yes") a.deliveredToTransactionAddress = a.shippedToTransactionAddress = false;
  if (card.addressMismatch === "no") a.deliveredToTransactionAddress = a.shippedToTransactionAddress = true;
  if (card.addressMismatch === "yes") {
    if (card.addressMismatchCause) a.addressMismatchCause = card.addressMismatchCause;
    if (card.causeEvidence) a.causeEvidence = card.causeEvidence;
  }
  return a;
}

// Plain reasons for an answer forced by the rules, with what would settle a "your decision" case
// (PRD F3: "Not sure" says what would settle it).
export function ruleReasons(reason: string, a: SellerAnswer, forced: "FIGHT" | "REFUND" | "YOUR_CALL"): string[] {
  const lines: string[] = [];
  if (a.hasTracking === true) lines.push("A tracking number is on the order.");
  if (a.hasTracking === false) lines.push("No tracking number is on the order.");
  if (reason === "INR" && a.hasTracking) {
    if (a.delivered === true) lines.push(a.deliveryDate ? `The carrier shows it delivered on ${a.deliveryDate}.` : "The carrier shows it as delivered.");
    if (a.delivered === false) lines.push("The carrier does not show it as delivered yet.");
    if (a.deliveredToTransactionAddress === false) {
      lines.push("You said the parcel went to a different address than the one on the order.");
      const cause = a.causeEvidence ? a.addressMismatchCause : undefined;
      if (cause === "seller") lines.push("You said the seller caused it, with evidence.");
      if (cause === "buyer") lines.push("You said the buyer caused it, with evidence.");
    }
    if (a.deliveredToTransactionAddress === true) lines.push("You said it went to the address on the order.");
  }
  lines.push(forced === "FIGHT" ? "The evidence on file supports your side." : forced === "REFUND" ? "The evidence on file supports the buyer." : "The evidence on file does not settle it. You decide.");
  if (forced === "YOUR_CALL" && reason === "INR" && a.hasTracking) {
    const missing: string[] = [];
    if (a.delivered === undefined) missing.push("the carrier's delivery status");
    if (a.delivered && !a.deliveryDate) missing.push("the delivery date on the carrier page");
    if (a.delivered && a.deliveredToTransactionAddress === undefined) missing.push("your answer to the address question below");
    if (a.deliveredToTransactionAddress === false && !(a.causeEvidence && a.addressMismatchCause !== "unknown")) missing.push("who caused the address mismatch, with evidence");
    if (missing.length) lines.push(`What would settle it: ${missing.join(", ")}.`);
  }
  return lines;
}

// The seller's decision on the case grid (review finding M10). Old saved values and sample text are mapped to the
// three options; anything else is "Not decided".
export const DECISIONS = ["Not decided", "Fight", "Refund"] as const;
export type Decision = (typeof DECISIONS)[number];

export function normalizeDecision(v: string | undefined | null): Decision {
  const t = (v ?? "").trim().toLowerCase();
  if (t.startsWith("fight")) return "Fight";
  if (t.startsWith("refund") || t.startsWith("accept refund")) return "Refund";
  return "Not decided";
}

// Which path the case card shows: the seller's decision, else the recommendation.
export function routeFor(decision: Decision, recommendation: string): "fight" | "refund" {
  if (decision === "Fight") return "fight";
  if (decision === "Refund") return "refund";
  return recommendation.startsWith("REFUND") ? "refund" : "fight";
}

// Which reply draft to start from: the seller's decision, else the recommendation.
export function draftBasis(decision: Decision, recommendation: string): string {
  if (decision === "Fight") return "FIGHT";
  if (decision === "Refund") return "REFUND";
  return recommendation;
}

// The seller's answers for one case, put together from three places:
// 1. answers entered for the demo (lib/answers.ts), which win when present;
// 2. the order behind the case (Orders and tracking): tracking number, carrier status and delivery date;
// 3. the seller's answers on the case card (Your facts and the address question).
// The rules in lib/proof.ts read the result, so the case strength follows what the seller entered.
import type { SellerAnswer } from "./answers.ts";

export type OrderFacts = { tracking?: string | null; trackingStatus?: string | null; deliveredDate?: string | null };
export type CardAnswers = {
  addressMismatch?: "yes" | "no";
  addressMismatchCause?: "seller" | "buyer" | "unknown";
  causeEvidence?: string;
  // "Your facts" on the card: the inputs each rule needs, typed by the seller.
  carrierDeliveryDate?: string; // INR: the delivery date shown on the carrier's own tracking page (YYYY-MM-DD)
  matchesListing?: "yes" | "partly" | "no"; // SNAD: does the item match the listing
  listingEvidence?: string; // SNAD: what shows it matches (the listing, photos before shipping)
  noticeDate?: string; // unauthorised: the date of PayPal's notice (YYYY-MM-DD)
  shipmentDate?: string; // unauthorised: the date the seller shipped (YYYY-MM-DD)
};

const isDate = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export function caseAnswer(base: SellerAnswer = {}, order?: OrderFacts | null, card: CardAnswers = {}): SellerAnswer {
  const a: SellerAnswer = { ...base };
  if (order) {
    if (a.hasTracking === undefined) a.hasTracking = !!order.tracking;
    // A carrier status says whether it was delivered. No status: unknown.
    if (a.delivered === undefined && order.tracking && order.trackingStatus) a.delivered = order.trackingStatus === "DELIVERED";
    if (a.deliveryDate === undefined && order.deliveredDate) a.deliveryDate = order.deliveredDate;
  }
  // A delivery date the seller read on the carrier page confirms delivery and wins over the order's status,
  // which the seller sets when adding tracking.
  if (isDate(card.carrierDeliveryDate)) {
    a.delivered = true;
    a.deliveryDate = card.carrierDeliveryDate;
    a.deliverySource = "carrier tracking page";
  }
  // "Was the parcel sent to a different address than the one on the order?" Yes = address does not match.
  // The answer is about where it was sent, so it always sets "shipped to the transaction address".
  // "Delivered to the transaction address" is set only once the parcel is delivered: a parcel on its way can't
  // have been delivered anywhere (Kate found the contradiction while labelling, 8 Nov 2026).
  // A parcel sent to the wrong address can't reach the right one, so Yes also means not delivered there.
  if (card.addressMismatch === "yes") a.deliveredToTransactionAddress = a.shippedToTransactionAddress = false;
  if (card.addressMismatch === "no") {
    a.shippedToTransactionAddress = true;
    if (a.delivered === true) a.deliveredToTransactionAddress = true;
  }
  if (card.matchesListing) a.matchesListing = card.matchesListing === "yes" ? true : card.matchesListing === "no" ? false : "partly";
  if (card.matchesListing === "yes" && card.listingEvidence?.trim()) a.listingEvidence = card.listingEvidence.trim();
  if (isDate(card.noticeDate)) a.noticeDate = card.noticeDate;
  if (isDate(card.shipmentDate)) a.shipmentDate = card.shipmentDate;
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
    if (a.delivered === true && a.deliverySource === "carrier tracking page") lines.push(`You read the delivery date on the carrier page: ${a.deliveryDate}.`);
    else if (a.delivered === true) lines.push(a.deliveryDate ? `The tracking status on the order is Delivered, on ${a.deliveryDate}.` : "The tracking status on the order is Delivered.");
    if (a.delivered === false) lines.push("The tracking status on the order is not Delivered yet.");
    if (a.deliveredToTransactionAddress === false) {
      lines.push("You said the parcel went to a different address than the one on the order.");
      const cause = a.causeEvidence ? a.addressMismatchCause : undefined;
      if (cause === "seller") lines.push("You said the seller caused it, with evidence.");
      if (cause === "buyer") lines.push("You said the buyer caused it, with evidence.");
    }
    if (a.deliveredToTransactionAddress === true) lines.push("You said it went to the address on the order.");
  }
  if (reason === "SNAD") {
    if (a.matchesListing === true) lines.push(a.listingEvidence ? `You said the item matches the listing. Evidence: ${a.listingEvidence}` : "You said the item matches the listing, with no evidence added yet.");
    if (a.matchesListing === "partly") lines.push("You said the item partly matches the listing.");
    if (a.matchesListing === false) lines.push("You said the item does not match the listing.");
  }
  if (reason === "UNAUTHORISED") {
    if (a.noticeDate) lines.push(`PayPal's notice date: ${a.noticeDate}. Proof of shipment is due 2 days after it.`);
    if (a.shipmentDate) lines.push(`You shipped on ${a.shipmentDate}.`);
  }
  lines.push(forced === "FIGHT" ? "The evidence on file supports your side." : forced === "REFUND" ? "The evidence on file supports the buyer." : "The evidence on file does not settle it. You decide.");
  if (forced === "YOUR_CALL" && reason === "INR" && a.hasTracking) {
    const missing: string[] = [];
    if (a.delivered !== false && !a.deliveryDate) missing.push("the delivery date on the carrier page (Your facts)");
    if (a.delivered && a.deliveredToTransactionAddress === undefined) missing.push("your answer to the address question below");
    if (a.deliveredToTransactionAddress === false && !(a.causeEvidence && a.addressMismatchCause !== "unknown")) missing.push("who caused the address mismatch, with evidence");
    if (missing.length) lines.push(`What would settle it: ${missing.join(", ")}.`);
  }
  if (forced === "YOUR_CALL" && reason === "SNAD" && a.matchesListing === undefined) lines.push("What would settle it: your answer to \"Does the item match the listing?\" (Your facts).");
  if (forced === "YOUR_CALL" && reason === "SNAD" && a.matchesListing === true && !a.listingEvidence) lines.push("What would settle it: evidence that it matches, such as the listing and photos taken before shipping (Your facts).");
  if (forced === "YOUR_CALL" && reason === "UNAUTHORISED") {
    const missing: string[] = [];
    if (!a.noticeDate) missing.push("PayPal's notice date");
    if (!a.shipmentDate) missing.push("the shipment date");
    if (missing.length) lines.push(`What would settle it: ${missing.join(" and ")} (Your facts).`);
  }
  return lines;
}

// The seller's decision on the case grid. Old saved values and sample text are mapped to the
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

// Next step on a delivered item-not-received case, as one plain action that follows the address answer
// (Kate, 8 Nov 2026: the old note repeated the question and showed internal codes). Null when it does not apply.
export function addressNextStep(reason: string, a: SellerAnswer, dueAt: string | null): string | null {
  if (reason !== "INR" || a.hasTracking !== true || a.delivered !== true) return null;
  const t = dueAt ? Date.parse(dueAt) : NaN;
  const by = Number.isNaN(t) ? "" : ` before ${new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;
  if (a.deliveredToTransactionAddress === undefined) return "Answer the address question below.";
  if (a.deliveredToTransactionAddress === false) {
    const cause = a.causeEvidence ? a.addressMismatchCause : undefined;
    if (cause === "seller") return `Refund the buyer${by}. A refund is final, even if the parcel arrives later.`;
    if (cause !== "buyer") return "Say who caused it and add evidence, such as a carrier scan or the shipping label.";
  }
  return `Send the tracking as evidence${by}.`;
}

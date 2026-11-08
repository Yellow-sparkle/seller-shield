// Slice step 4: deterministic eligibility rules. No AI here.
// The rules decide what the seller can still do and what evidence PayPal asks for.
import type { Case, CaseReason } from "./dispute.ts";
import { daysUntilDue } from "./dispute.ts";
import { protectionText } from "./protection.ts";

// Evidence type per reason, from the PayPal Disputes guide in the PRD.
// INR and UNAUTHORISED ask for proof of fulfilment (tracking); SNAD and OTHER ask for documents and notes.
export function requiredEvidence(reason: CaseReason): "PROOF_OF_FULFILLMENT" | "OTHER" | null {
  switch (reason) {
    case "INR":
    case "UNAUTHORISED":
      return "PROOF_OF_FULFILLMENT";
    case "SNAD":
    case "OTHER":
      return "OTHER";
    default:
      return null; // unknown reason: no evidence type, the case goes to the seller to check
  }
}

export type Eligibility =
  | { canRespond: true; daysLeft: number }
  | { canRespond: false; reason: "OVERDUE" | "NO_DUE_DATE" | "CLOSED" };

export function responseEligibility(c: Case, now: Date = new Date()): Eligibility {
  if (c.status && c.status !== "OPEN" && c.status !== "WAITING_FOR_SELLER_RESPONSE") {
    return { canRespond: false, reason: "CLOSED" };
  }
  const days = daysUntilDue(c, now);
  if (days === null) return { canRespond: false, reason: "NO_DUE_DATE" };
  // Compare the real timestamp: a deadline passed a few hours ago rounds to 0 days, so the day count alone is not enough.
  // One-hour margin before PayPal's cut-off, since the stored due date is UTC (case 8 gap 3, Kate, 5 Nov 2026).
  const CUTOFF_MARGIN_MS = 60 * 60 * 1000;
  if (days < 0 || Date.parse(c.responseDueAt as string) - CUTOFF_MARGIN_MS < now.getTime()) return { canRespond: false, reason: "OVERDUE" };
  return { canRespond: true, daysLeft: days };
}

// Seller Protection label for the case screen. SNAD is excluded in PayPal's published PT terms,
// so it reads "Not covered" even when PayPal's sandbox status says ELIGIBLE.
// Same words as the orders grid (lib/protection.ts).
export function protectionLabel(c: Case): string {
  return protectionText(c.sellerProtectionStatus, c.reason);
}

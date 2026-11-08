// Ready-to-approve reply for the seller (PRD F3). Pure prompt and parse only: no API call here.
// The seller reads, edits and sends the reply themselves. Nothing is sent by this module.
import type { Recommendation } from "./recommend.ts";

export type ReplyDraft = { draft: string; placeholders: string[] };

const MAX_CHARS = 1200;
// Phrases that predict PayPal's decision. The reply must not contain them.
const PREDICTION = /\b(will (likely )?(side|rule|decide|win|refund)|likely to (win|side|rule)|guarantee[ds]?|you will win|PayPal will)\b/i;

export function buildReplyPrompt(rec: Recommendation, facts: Record<string, unknown>): string {
  return [
    "You write a short reply from a small PayPal seller to the buyer's dispute claim.",
    "Use only the facts below. Never invent a fact, a tracking number, a date, or evidence.",
    "Where a fact is missing and the seller would need to add evidence, write a bracketed placeholder such as [attach tracking screenshot].",
    "Plain English. No predictions about what PayPal will decide. No promises.",
    `The seller's recommended path is ${rec.recommendation} (confidence ${rec.confidence}). Follow it, but do not state the recommendation to the buyer.`,
    "Keep it under 150 words.",
    "Reply with JSON only, in this shape:",
    '{"draft":"the reply text","placeholders":["[attach ...]"]}',
    "",
    "Facts:",
    JSON.stringify(facts, null, 2),
  ].join("\n");
}

export function parseReply(text: string): ReplyDraft {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON object in reply");
  const raw = JSON.parse(text.slice(start, end + 1)) as Partial<ReplyDraft>;
  if (typeof raw.draft !== "string" || raw.draft.trim() === "") throw new Error("Empty draft");
  if (raw.draft.length > MAX_CHARS) throw new Error("Draft too long");
  if (PREDICTION.test(raw.draft)) throw new Error("Draft predicts the outcome");
  const placeholders = Array.isArray(raw.placeholders) ? raw.placeholders.filter((p): p is string => typeof p === "string") : [];
  return { draft: raw.draft.trim(), placeholders };
}

// Plain template reply for the screen, used until a recorded or live AI draft is available.
// It uses only the case facts passed in, and bracketed placeholders for any evidence the seller must add.
// It goes through parseReply, so it can't predict PayPal's decision or run past the length cap.
// The refund draft goes with the refund, so it never says the refund already happened. An item-not-received
// fight talks about delivery and uses the order's tracking when there is one. The draft names the order.
export function templateReply(input: {
  recommendation: string;
  amount: string;
  orderRef: string;
  reason?: string;
  tracking?: { carrier: string | null; number: string } | null;
}): ReplyDraft {
  const rec = input.recommendation.split(" ")[0];
  let draft: string;
  let placeholders: string[] = [];
  if (rec === "FIGHT" && input.reason === "INR") {
    if (input.tracking?.number) {
      const via = input.tracking.carrier ? ` with ${input.tracking.carrier}` : "";
      draft = `Thank you for your message about ${input.orderRef}. Your parcel was sent${via}, tracking number ${input.tracking.number}. You can follow it on the carrier's website. Please tell us if the carrier page shows a problem.`;
    } else {
      draft = `Thank you for your message about ${input.orderRef}. Your parcel was sent with tracking number [add tracking number].`;
      placeholders = ["[add tracking number]"];
    }
  } else if (rec === "FIGHT") {
    draft = `Thank you for your message about ${input.orderRef}. We have reviewed your claim and the evidence we hold: [attach listing photos and parcel photos]. We believe the item matches the listing.`;
    placeholders = ["[attach listing photos and parcel photos]"];
  } else if (rec === "REFUND") {
    draft = `We are sorry about ${input.orderRef}. We are accepting your claim and refunding ${input.amount} to you through PayPal.`;
  } else {
    draft = `Thank you for your message about ${input.orderRef}. We are reviewing the details of your claim and will reply as soon as we have them.`;
  }
  return parseReply(JSON.stringify({ draft, placeholders }));
}

// True while the text still holds a bracketed placeholder such as [attach ...]. Sending is blocked until it is filled.
export function hasPlaceholder(text: string): boolean {
  return /\[[^\]]{2,}\]/.test(text);
}

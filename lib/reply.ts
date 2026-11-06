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

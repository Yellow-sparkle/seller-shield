// Slice step 5: ask Claude Opus 5.5 for a fight-or-refund recommendation.
// The model sees only the Case fields and the eligibility result, never raw PayPal JSON.
// The seller always makes the final call; this module only proposes.
import Anthropic from "@anthropic-ai/sdk";
import type { Case } from "./dispute.ts";
import { requiredEvidence, type Eligibility } from "./rules.ts";
import { applyGuard, type Claim, type GuardedResult } from "./guard.ts";

export const MODEL = "claude-opus-5-5";

export type Recommendation = {
  recommendation: "FIGHT" | "REFUND" | "YOUR_CALL";
  confidence: "HIGH" | "LOW";
  claims: Claim[];
};

export function factsFor(c: Case, e: Eligibility): Record<string, unknown> {
  return {
    reason: c.reason,
    status: c.status,
    amount: c.amount,
    holdAmount: c.holdAmount,
    openedAt: c.openedAt,
    responseDueAt: c.responseDueAt,
    sellerProtectionEligible: c.sellerProtectionEligible,
    evidenceTypeNeeded: requiredEvidence(c.reason),
    canRespond: e.canRespond,
  };
}

export function buildPrompt(c: Case, e: Eligibility): string {
  const facts = factsFor(c, e);
  return [
    "You help a small PayPal seller decide whether to fight a dispute or refund the buyer.",
    "Use only the facts below. If a fact is null or missing, say so and lower your confidence.",
    "Reply with JSON only, in this shape:",
    '{"recommendation":"FIGHT|REFUND|YOUR_CALL","confidence":"HIGH|LOW","claims":[{"text":"one short claim","fields":["fieldName"]}]}',
    "Every claim must list the fact fields it relies on. A claim with no fields will be discarded. Give at most 6 claims, short ones.",
    "",
    "Facts:",
    JSON.stringify(facts, null, 2),
  ].join("\n");
}

const RECS = ["FIGHT", "REFUND", "YOUR_CALL"] as const;

// Pure parser: rejects anything off-schema, and forces YOUR_CALL on low confidence.
export function parseRecommendation(text: string): Recommendation {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON object in model reply");
  const raw = JSON.parse(text.slice(start, end + 1)) as Partial<Recommendation>;
  if (!RECS.includes(raw.recommendation as (typeof RECS)[number])) {
    throw new Error(`Unknown recommendation: ${String(raw.recommendation)}`);
  }
  if (raw.confidence !== "HIGH" && raw.confidence !== "LOW") {
    throw new Error(`Unknown confidence: ${String(raw.confidence)}`);
  }
  if (!Array.isArray(raw.claims)) throw new Error("Missing claims");
  const claims = raw.claims as Claim[];
  const recommendation = raw.confidence === "LOW" ? "YOUR_CALL" : raw.recommendation!;
  return { recommendation, confidence: raw.confidence, claims };
}

export async function recommend(
  c: Case,
  e: Eligibility,
  client: Anthropic = new Anthropic(), // reads ANTHROPIC_API_KEY from the environment
): Promise<GuardedResult> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2500,
    messages: [{ role: "user", content: buildPrompt(c, e) }],
  });
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  // Grounding guard: drop any claim whose listed fields are missing or null.
  return applyGuard(parseRecommendation(text), factsFor(c, e));
}

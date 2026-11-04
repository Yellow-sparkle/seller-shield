// Slice step 5: ask Claude Opus 5.5 for a fight-or-refund recommendation.
// The model sees only the Case fields and the eligibility result, never raw PayPal JSON.
// The seller always makes the final call; this module only proposes.
import Anthropic from "@anthropic-ai/sdk";
import type { Case } from "./dispute.ts";
import { requiredEvidence, type Eligibility } from "./rules.ts";

export const MODEL = "claude-opus-5-5";

export type Recommendation = {
  recommendation: "FIGHT" | "REFUND" | "YOUR_CALL";
  confidence: "HIGH" | "LOW";
  rationale: string;
};

export function buildPrompt(c: Case, e: Eligibility): string {
  const facts = {
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
  return [
    "You help a small PayPal seller decide whether to fight a dispute or refund the buyer.",
    "Use only the facts below. If a fact is null or missing, say so and lower your confidence.",
    "Reply with JSON only, in this shape:",
    '{"recommendation":"FIGHT|REFUND|YOUR_CALL","confidence":"HIGH|LOW","rationale":"one or two sentences, each citing a fact by its field name"}',
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
  if (typeof raw.rationale !== "string" || raw.rationale.trim() === "") {
    throw new Error("Missing rationale");
  }
  const recommendation = raw.confidence === "LOW" ? "YOUR_CALL" : raw.recommendation!;
  return { recommendation, confidence: raw.confidence, rationale: raw.rationale };
}

export async function recommend(
  c: Case,
  e: Eligibility,
  client: Anthropic = new Anthropic(), // reads ANTHROPIC_API_KEY from the environment
): Promise<Recommendation> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    messages: [{ role: "user", content: buildPrompt(c, e) }],
  });
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return parseRecommendation(text);
}

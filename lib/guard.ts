// Slice step 6: grounding guard. Every sentence of a recommendation must cite a fact
// the model was actually given (by its field name). Sentences without a citation are removed.
// If nothing survives, the recommendation falls back to YOUR_CALL.
import type { Recommendation } from "./recommend.ts";

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// A sentence is grounded if it names at least one fact key that exists in the facts object
// with a non-null value. Naming a null field does not ground a sentence.
export function citedKeys(sentence: string, facts: Record<string, unknown>): string[] {
  return Object.keys(facts).filter(
    (k) => facts[k] !== null && facts[k] !== undefined && sentence.includes(k),
  );
}

export function applyGuard(
  r: Recommendation,
  facts: Record<string, unknown>,
): Recommendation & { removed: string[] } {
  const kept: string[] = [];
  const removed: string[] = [];
  for (const s of splitSentences(r.rationale)) {
    (citedKeys(s, facts).length > 0 ? kept : removed).push(s);
  }
  if (kept.length === 0) {
    return { recommendation: "YOUR_CALL", confidence: "LOW", rationale: "No grounded reason could be given.", removed };
  }
  return { ...r, rationale: kept.join(" "), removed };
}

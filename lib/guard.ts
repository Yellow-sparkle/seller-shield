// Slice step 6: grounding guard. Each claim must list the fact fields it relies on.
// A claim is kept only if it lists at least one field, and every listed field exists
// in the facts with a non-null value. Anything else is removed.
export type Claim = { text: string; fields: string[] };

export type GuardedResult = {
  recommendation: "FIGHT" | "REFUND" | "YOUR_CALL";
  confidence: "HIGH" | "LOW";
  claims: Claim[];
  removed: Claim[];
};

export function isGrounded(claim: Claim, facts: Record<string, unknown>): boolean {
  if (!Array.isArray(claim.fields) || claim.fields.length === 0) return false;
  return claim.fields.every((f) => facts[f] !== undefined && facts[f] !== null);
}

export function applyGuard(
  r: { recommendation: GuardedResult["recommendation"]; confidence: GuardedResult["confidence"]; claims: Claim[] },
  facts: Record<string, unknown>,
): GuardedResult {
  const kept = r.claims.filter((c) => isGrounded(c, facts));
  const removed = r.claims.filter((c) => !isGrounded(c, facts));
  if (kept.length === 0) {
    return { recommendation: "YOUR_CALL", confidence: "LOW", claims: [], removed };
  }
  return { ...r, claims: kept, removed };
}

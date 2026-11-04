// Golden check: hand-written expected answers for synthetic cases (lib/golden/cases.json).
// Runs Opus 5.5 once per case and prints the match rate. Costs about 2 cents per case.
// Run: node --env-file=.env.local --experimental-strip-types scripts/golden-check.ts
import { toCase } from "../lib/dispute.ts";
import { responseEligibility } from "../lib/rules.ts";
import { recommend } from "../lib/recommend.ts";
import cases from "../lib/golden/cases.json" with { type: "json" };

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Check .env.local.");
  process.exit(1);
}

type G = { id: string; expected: string; answer: Record<string, boolean>; dispute: object };
let hit = 0;
for (const g of cases as G[]) {
  const c = toCase(g.dispute as never);
  const r = await recommend(c, responseEligibility(c), g.answer);
  const ok = r.recommendation === g.expected;
  if (ok) hit++;
  console.log(`${ok ? "MATCH " : "MISS  "} ${g.id} expected ${g.expected} got ${r.recommendation} (${r.confidence})`);
  if (!ok) for (const cl of r.claims) console.log("     -", cl.text);
}
console.log(`\nMatch rate: ${hit}/${(cases as G[]).length}`);

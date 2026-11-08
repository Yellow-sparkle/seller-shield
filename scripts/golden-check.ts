// Golden check: hand-written expected answers for synthetic cases (lib/golden/cases.json).
// Runs Opus 5.5 once per case and prints the match rate. Costs about 2 cents per case.
// Run: node --env-file=.env.local --experimental-strip-types scripts/golden-check.ts
// Cases with an order or card answers are built the way the case screen builds them (caseAnswer).
// Red-flag subset only: add --red-flag (G02, G04, G06 and the YOUR_CALL cases G08 to G11).
import { toCase } from "../lib/dispute.ts";
import { responseEligibility } from "../lib/rules.ts";
import { recommend } from "../lib/recommend.ts";
import cases from "../lib/golden/cases.json" with { type: "json" };
import { goldenAnswer, type GoldenCase } from "../lib/eval-answers.ts";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Check .env.local.");
  process.exit(1);
}

const RED_FLAG = new Set(["G02", "G04", "G06", "G08", "G09", "G10", "G11"]);
const redFlagOnly = process.argv.includes("--red-flag");
// Pinned clock so the date-based cases do not flip over time (override with CHECK_NOW).
const NOW = new Date(process.env.CHECK_NOW ?? "2026-11-05T12:00:00Z");
const selected = (cases as unknown as GoldenCase[]).filter((g) => !redFlagOnly || RED_FLAG.has(g.id));
let hit = 0;
for (const g of selected) {
  const c = toCase(g.dispute as never);
  const r = await recommend(c, responseEligibility(c, NOW), goldenAnswer(g), undefined, NOW);
  const ok = r.recommendation === g.expected;
  if (ok) hit++;
  console.log(`${ok ? "MATCH " : "MISS  "} ${g.id} expected ${g.expected} got ${r.recommendation} (${r.confidence})`);
  if (!ok) for (const cl of r.claims) console.log("     -", cl.text);
}
console.log(`\nMatch rate: ${hit}/${selected.length}${redFlagOnly ? " (red-flag subset)" : ""}`);

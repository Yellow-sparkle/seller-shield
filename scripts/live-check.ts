// One live Opus 5.5 call on the first sandbox dispute. Costs about 2 cents.
// Run: node --env-file=.env.local --experimental-strip-types scripts/live-check.ts
import { toCase } from "../lib/dispute.ts";
import { responseEligibility } from "../lib/rules.ts";
import { recommend } from "../lib/recommend.ts";
import fixtures from "../lib/fixtures/sandbox-disputes.json" with { type: "json" };

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Check .env.local.");
  process.exit(1);
}

const c = toCase((fixtures as object[])[0] as never);
const e = responseEligibility(c);
console.log("Dispute:", c.disputeId, c.reason, c.amount);
const r = await recommend(c, e);
console.log("Recommendation:", r.recommendation, "| confidence:", r.confidence);
console.log("Claims kept:");
for (const cl of r.claims) console.log(" -", cl.text, "[" + cl.fields.join(", ") + "]");
if (r.removed.length) console.log("Removed (ungrounded):", r.removed.map((x) => x.text));

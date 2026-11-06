// Live check: one Opus 5.5 call per sandbox dispute (about 2 cents each).
// Run: node --env-file=.env.local --experimental-strip-types scripts/live-check.ts
import { toCase } from "../lib/dispute.ts";
import { responseEligibility } from "../lib/rules.ts";
import { recommend } from "../lib/recommend.ts";
import { sellerAnswers } from "../lib/answers.ts";
import fixtures from "../lib/fixtures/sandbox-disputes.json" with { type: "json" };

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Check .env.local.");
  process.exit(1);
}

const record = process.argv.includes("--record");
// --only PP-R-... runs one dispute and merges it into the saved file, so the others keep their recorded answers.
const onlyIdx = process.argv.indexOf("--only");
const only = onlyIdx > -1 ? process.argv[onlyIdx + 1] : undefined;
const saved: Record<string, unknown> = {};

for (const raw of fixtures as object[]) {
  const c = toCase(raw as never);
  if (only && c.disputeId !== only) continue;
  const e = responseEligibility(c);
  console.log(`\n=== ${c.disputeId} | ${c.reason} | ${c.amount?.value} ${c.amount?.currency}`);
  const r = await recommend(c, e, sellerAnswers[c.disputeId] ?? {});
  console.log("Recommendation:", r.recommendation, "| confidence:", r.confidence);
  console.log("Claims kept:");
  for (const cl of r.claims) console.log(" -", cl.text, "[" + cl.fields.join(", ") + "]");
  if (r.removed.length) console.log("Removed (ungrounded):", r.removed.map((x) => x.text));
  saved[c.disputeId] = { recommendation: r.recommendation, confidence: r.confidence, claims: r.claims, removed: r.removed.map((x) => x.text) };
}

if (record) {
  const { writeFileSync, readFileSync } = await import("node:fs");
  const path = "lib/recorded/recommendations.json";
  const existing = only ? JSON.parse(readFileSync(path, "utf8")) : {};
  writeFileSync(path, JSON.stringify({ ...existing, ...saved }, null, 2) + "\n");
  console.log("\nSaved to lib/recorded/recommendations.json");
}

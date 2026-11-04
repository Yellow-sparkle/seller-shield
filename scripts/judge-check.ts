// Judge check: runs the golden cases through the recommender, then asks a judge model whether
// each claim is supported by the case facts, plain English, and free of predictions.
// Judge model: Sonnet 5.5, the same Anthropic processor as the generator (no new processor).
// Run: node --env-file=.env.local --experimental-strip-types scripts/judge-check.ts
import Anthropic from "@anthropic-ai/sdk";
import { toCase } from "../lib/dispute.ts";
import { responseEligibility } from "../lib/rules.ts";
import { factsFor, recommend } from "../lib/recommend.ts";
import { judgePrompt, parseJudgement, supportRate } from "../lib/judge.ts";
import cases from "../lib/golden/cases.json" with { type: "json" };

const JUDGE_MODEL = "claude-sonnet-5-5";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Check .env.local.");
  process.exit(1);
}

type G = { id: string; answer: Record<string, boolean>; dispute: object };
const client = new Anthropic();
let total = 0;
for (const g of cases as G[]) {
  const c = toCase(g.dispute as never);
  const e = responseEligibility(c);
  const r = await recommend(c, e, g.answer, client);
  const reply = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 1500,
    messages: [{ role: "user", content: judgePrompt(factsFor(c, e, g.answer), r.claims) }],
  });
  const text = reply.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  const j = parseJudgement(text);
  const rate = supportRate(j);
  total++;
  console.log(`${g.id} support ${(rate * 100).toFixed(0)}% plainEnglish=${j.plainEnglish} noPrediction=${j.noPrediction}`);
  for (const v of j.verdicts) if (!v.supported) console.log(`     - NOT SUPPORTED: ${v.claim} (${v.reason})`);
}
console.log(`\nJudged ${total} cases with ${JUDGE_MODEL}. Calibrate against hand labels before trusting the scores.`);

// Judge check: runs the golden cases through the recommender, then asks a judge model whether
// each claim is supported by the case facts, plain English, and free of predictions.
// Judge model: Sonnet 5.5, the same Anthropic processor as the generator (no new processor).
// Run: node --env-file=.env.local --experimental-strip-types scripts/judge-check.ts
// Human benchmark: add --export to also write the reasons of 10 sample cases for Kate to label (benchmark/labels.csv)
// and the judge's verdicts in a separate file. Then run scripts/judge-agreement.ts.
import Anthropic from "@anthropic-ai/sdk";
import { toCase } from "../lib/dispute.ts";
import { responseEligibility } from "../lib/rules.ts";
import { factsFor, recommend } from "../lib/recommend.ts";
import { judgePrompt, parseJudgement, supportRate } from "../lib/judge.ts";
import cases from "../lib/golden/cases.json" with { type: "json" };
import { goldenAnswer, type GoldenCase } from "../lib/eval-answers.ts";
import { BENCHMARK_CASES, factsSummary, LABELS_FILE, toCsv, VERDICTS_FILE } from "../lib/judge-benchmark.ts";
import { mkdirSync, writeFileSync } from "node:fs";

const JUDGE_MODEL = "claude-sonnet-5-5";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Check .env.local.");
  process.exit(1);
}

// Same pinned clock as golden-check, so the date-based cases match (override with CHECK_NOW).
const NOW = new Date(process.env.CHECK_NOW ?? "2026-11-05T12:00:00Z");
const client = new Anthropic();
let total = 0;
let unreadable = 0;
const exporting = process.argv.includes("--export");
const labelRows: string[][] = [["id", "case", "reason_to_check", "case_facts", "your_label (yes = supported by the facts, no = not)"]];
const verdictRows: string[][] = [["id", "judge_supported", "judge_reason"]];
for (const g of cases as unknown as GoldenCase[]) {
  const answer = goldenAnswer(g);
  const c = toCase(g.dispute as never);
  const e = responseEligibility(c, NOW);
  const r = await recommend(c, e, answer, client, NOW);
  const reply = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 1500,
    messages: [{ role: "user", content: judgePrompt(factsFor(c, e, answer), r.claims) }],
  });
  const text = reply.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  let j;
  try {
    j = parseJudgement(text);
  } catch (err) {
    unreadable++;
    console.log(`${g.id} judge output unreadable (${err instanceof Error ? err.message : "unknown error"})`);
    continue;
  }
  if (exporting && BENCHMARK_CASES.includes(g.id)) {
    const facts = factsSummary(factsFor(c, e, answer));
    j.verdicts.forEach((v, i) => {
      const id = `${g.id}-${i + 1}`;
      labelRows.push([id, g.id, v.claim, facts, ""]);
      verdictRows.push([id, v.supported ? "yes" : "no", v.reason]);
    });
  }
  const rate = supportRate(j);
  total++;
  console.log(`${g.id} support ${(rate * 100).toFixed(0)}% plainEnglish=${j.plainEnglish} noPrediction=${j.noPrediction}`);
  for (const v of j.verdicts) if (!v.supported) console.log(`     - NOT SUPPORTED: ${v.claim} (${v.reason})`);
}
if (exporting) {
  mkdirSync("benchmark", { recursive: true });
  writeFileSync(LABELS_FILE, toCsv(labelRows));
  writeFileSync(VERDICTS_FILE, toCsv(verdictRows));
  console.log(`\nWrote ${labelRows.length - 1} reasons to ${LABELS_FILE}. Label each one yes or no in the last column, without opening ${VERDICTS_FILE}.`);
}
console.log(`\nJudged ${total} cases with ${JUDGE_MODEL}${unreadable ? ` (${unreadable} unreadable, not counted)` : ""}. Calibrate against hand labels before trusting the scores.`);

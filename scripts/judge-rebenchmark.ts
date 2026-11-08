// Judges the same 58 reasons Kate labelled on 8 Nov again, with the current judge prompt, and compares with her labels.
// Use it after a change to the judge prompt, so the result is comparable with the first benchmark (56/58).
// It also judges 12 deliberately false reasons (planted-false-8-nov.csv), in separate calls so they can't sway
// the verdicts on the 58. All 58 real reasons were true, so only the planted ones show whether the judge catches false ones.
// Run: node --env-file=.env.local --experimental-strip-types scripts/judge-rebenchmark.ts
import Anthropic from "@anthropic-ai/sdk";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { judgePrompt, parseJudgement } from "../lib/judge.ts";
import { agreement, parseCsv, parseFactsSummary, toCsv } from "../lib/judge-benchmark.ts";

const JUDGE_MODEL = "claude-sonnet-5-5";
const LABELS = "docs/judge-benchmark/labels-kate-8-nov.csv";
const PLANTED = "docs/judge-benchmark/planted-false-8-nov.csv";
const OUT = "benchmark/judge-verdicts-rerun.csv";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Check .env.local.");
  process.exit(1);
}

const client = new Anthropic();

// Judges each case's reasons in one call, like judge-check does, and returns verdict rows.
async function judgeAll(labels: string[][], name: string): Promise<string[][]> {
  const byCase = new Map<string, { ids: string[]; claims: string[]; facts: string }>();
  for (const [id, c, claim, facts] of labels.slice(1)) {
    const g = byCase.get(c) ?? { ids: [], claims: [], facts };
    g.ids.push(id);
    g.claims.push(claim);
    byCase.set(c, g);
  }
  const rows: string[][] = [];
  for (const [c, g] of byCase) {
    const reply = await client.messages.create({
      model: JUDGE_MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: judgePrompt(parseFactsSummary(g.facts), g.claims.map((text) => ({ text }))) }],
    });
    const text = reply.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    try {
      const j = parseJudgement(text);
      if (j.verdicts.length !== g.claims.length) console.log(`${c}: the judge returned ${j.verdicts.length} verdicts for ${g.claims.length} reasons. Matched in order.`);
      g.ids.forEach((id, i) => {
        const v = j.verdicts[i];
        if (v) rows.push([id, v.supported ? "yes" : "no", v.reason]);
      });
      console.log(`${name} ${c}: judged ${g.claims.length}`);
    } catch (err) {
      console.log(`${name} ${c}: judge output unreadable (${err instanceof Error ? err.message : "unknown error"}), left out`);
    }
  }
  return rows;
}

const labels = parseCsv(readFileSync(LABELS, "utf8"));
const planted = parseCsv(readFileSync(PLANTED, "utf8"));
const header = ["id", "judge_supported", "judge_reason"];
const real = await judgeAll(labels, "real");
const fake = await judgeAll(planted, "planted");
const rows = [header, ...real, ...fake];
mkdirSync("benchmark", { recursive: true });
writeFileSync(OUT, toCsv(rows));

const r = agreement(labels, [header, ...real]);
const pct = r.compared ? Math.round((r.agree / r.compared) * 100) : 0;
console.log(`\nWith the new judge prompt: agrees with Kate on ${r.agree} of ${r.compared} reasons (${pct}%). First benchmark: 56 of 58 (97%).`);
console.log(`Reasons Kate marked not supported but the judge passed: ${r.missedFalse.length}. Target: 0.`);
for (const m of r.missedFalse) console.log(`  - ${m.id}: ${m.claim}`);
console.log(`Reasons the judge flagged but Kate marked supported: ${r.extraFlags.length}.`);
for (const m of r.extraFlags) console.log(`  - ${m.id}: ${m.claim}`);
const p = agreement(planted, [header, ...fake]);
console.log(`\nPlanted false reasons caught: ${p.agree} of ${p.compared}. Target: all of them.`);
for (const m of p.missedFalse) console.log(`  - passed by mistake: ${m.id}: ${m.claim}`);
console.log(`Verdicts saved to ${OUT}.`);

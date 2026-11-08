// Reading grade of the AI's reasons, by formula (no AI, no cost).
// Checks the recorded answers the case screen shows, and the 58 reasons in the judge benchmark.
// Run: node --experimental-strip-types scripts/readability-check.ts
import { readFileSync } from "node:fs";
import { readability } from "../lib/readability.ts";
import { parseCsv } from "../lib/judge-benchmark.ts";
import recorded from "../lib/recorded/recommendations.json" with { type: "json" };

const TARGET_GRADE = 8; // about the level of a newspaper; set before measuring (Kate, 8 Nov 2026)

function report(name: string, reasons: string[]) {
  const r = reasons.map((t) => ({ t, ...readability(t) }));
  const avg = r.reduce((n, x) => n + x.grade, 0) / r.length;
  const avgEase = r.reduce((n, x) => n + x.ease, 0) / r.length;
  const over = r.filter((x) => x.grade > TARGET_GRADE).sort((a, b) => b.grade - a.grade);
  console.log(`\n${name}: ${r.length} reasons`);
  console.log(`  Average reading grade ${avg.toFixed(1)} (target ${TARGET_GRADE} or below). Average reading ease ${avgEase.toFixed(0)} of 100.`);
  console.log(`  Reasons above grade ${TARGET_GRADE}: ${over.length} of ${r.length}.`);
  for (const x of over.slice(0, 5)) console.log(`   - grade ${x.grade}: ${x.t}`);
  return { avg, over: over.length, total: r.length };
}

type Recorded = Record<string, { claims?: { text: string }[] }>;
const screen = Object.values(recorded as unknown as Recorded).flatMap((a) => (a.claims ?? []).map((c) => c.text));
report("Recorded answers on the case screen", screen);
const labels = parseCsv(readFileSync("docs/judge-benchmark/labels-kate-8-nov.csv", "utf8"));
report("Judge benchmark reasons (golden cases)", labels.slice(1).map((r) => r[2]));

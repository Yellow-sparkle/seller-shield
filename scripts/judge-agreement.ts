// Compares Kate's labels with the judge's verdicts (no AI call).
// Run: node --experimental-strip-types scripts/judge-agreement.ts
import { readFileSync } from "node:fs";
import { agreement, LABELS_FILE, parseCsv, VERDICTS_FILE } from "../lib/judge-benchmark.ts";

const r = agreement(parseCsv(readFileSync(LABELS_FILE, "utf8")), parseCsv(readFileSync(VERDICTS_FILE, "utf8")));
const pct = r.compared ? Math.round((r.agree / r.compared) * 100) : 0;
console.log(`Judge agrees with the human label on ${r.agree} of ${r.compared} reasons (${pct}%). Target: at least 90%.`);
console.log(`Reasons the human marked not supported but the judge passed: ${r.missedFalse.length}. Target: 0.`);
for (const m of r.missedFalse) console.log(`  - ${m.id}: ${m.claim}`);
console.log(`Reasons the judge flagged but the human marked supported: ${r.extraFlags.length}.`);
for (const m of r.extraFlags) console.log(`  - ${m.id}: ${m.claim}`);
if (r.unlabelled) console.log(`Not labelled yet (left out): ${r.unlabelled}.`);

// Stale check (second review S8, 8 Nov 2026): lists the recorded AI answers whose facts no longer match what the
// case screen builds today. No API call.
// Run: node --experimental-strip-types scripts/stale-check.ts
import { toCase } from "../lib/dispute.ts";
import { RECORDING_CARD, screenAnswer, staleRecordings } from "../lib/eval-answers.ts";
import recorded from "../lib/recorded/recommendations.json" with { type: "json" };
import fixtures from "../lib/fixtures/sandbox-disputes.json" with { type: "json" };
import demoDisputes from "../lib/fixtures/demo-disputes.json" with { type: "json" };

const current = Object.fromEntries(
  [...(fixtures as object[]), ...(demoDisputes as object[])].map((raw) => {
    const c = toCase(raw as never);
    return [c.disputeId, screenAnswer(c.disputeId, c.transactionId, RECORDING_CARD[c.disputeId])];
  }),
);
const stale = staleRecordings(recorded as never, current);
for (const s of stale) console.log(`${s.id}: ${s.why}. Re-record: node --env-file=.env.local --experimental-strip-types scripts/live-check.ts --record --only ${s.id}`);
console.log(stale.length ? `\n${stale.length} of ${Object.keys(recorded).length} recordings to re-record.` : "All recordings match today's facts.");

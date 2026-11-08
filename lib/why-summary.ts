// The one reason the cases table shows in the Why column; the case card shows them all (Kate, 8 Nov 2026).
// Order of preference:
// 1. "What would settle it", because it tells the seller what to do on a Mixed case.
// 2. The first line that explains the case, skipping lines that only restate the buyer's claim or the verdict
//    (the strength pill already shows the verdict).
// 3. The first line.
const RESTATES = /^(The buyer (says|said|claims)|This is an?\b|It (is|was) an?\b|The evidence on file)/i;

export function whySummary(text: string): { main: string; more: number; all: string[] } {
  const all = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (all.length === 0) return { main: "", more: 0, all };
  const main = all.find((l) => l.startsWith("What would settle it")) ?? all.find((l) => !RESTATES.test(l)) ?? all[0];
  return { main, more: all.length - 1, all };
}

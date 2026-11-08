// Human benchmark for the judge: Kate labels a sample of reasons as supported or not, without seeing the judge's
// verdicts, and we measure how often the judge agrees with her (8 Nov 2026).
// judge-check --export writes two files: the reasons to label, and the judge's verdicts kept apart.
// scripts/judge-agreement.ts compares them.

// The 4 cases the AI decides, plus 6 that cover the other reasons and outcomes.
export const BENCHMARK_CASES = ["G01", "G03", "G20", "G21", "G02", "G05", "G08", "G10", "G13", "G16"];

export const LABELS_FILE = "benchmark/labels.csv";
export const VERDICTS_FILE = "benchmark/judge-verdicts.csv";

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",")).join("\n") + "\n";
}

// Reads CSV with quoted fields (commas, quotes and line breaks inside quotes). Accepts ; as the separator too,
// because Numbers and Excel in some European locales save CSV that way.
export function parseCsv(text: string): string[][] {
  const firstLine = text.split("\n", 1)[0];
  const sep = !firstLine.includes(",") && firstLine.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}

// The facts the judge saw, as short "name: value" lines, leaving out empty ones.
export function factsSummary(facts: Record<string, unknown>): string {
  return Object.entries(facts)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join("\n");
}

const yes = (v: string) => /^(y|yes|true|1|supported)$/i.test(v.trim());
const no = (v: string) => /^(n|no|false|0|not supported|unsupported)$/i.test(v.trim());

export type Agreement = {
  compared: number; // reasons with both a human label and a judge verdict
  agree: number;
  missedFalse: { id: string; claim: string }[]; // human: not supported, judge: supported. The dangerous miss.
  extraFlags: { id: string; claim: string }[]; // human: supported, judge: not supported
  unlabelled: number;
};

// labels rows: id, case, claim, facts, your_label. verdicts rows: id, judge_supported, judge_reason. First row is the header.
export function agreement(labels: string[][], verdicts: string[][]): Agreement {
  const judge = new Map(verdicts.slice(1).map((r) => [r[0], r[1]]));
  const out: Agreement = { compared: 0, agree: 0, missedFalse: [], extraFlags: [], unlabelled: 0 };
  for (const r of labels.slice(1)) {
    const [id, , claim, , label = ""] = r;
    const j = judge.get(id);
    if (j === undefined) continue;
    if (!yes(label) && !no(label)) { out.unlabelled++; continue; }
    const human = yes(label);
    const judged = j === "yes";
    out.compared++;
    if (human === judged) out.agree++;
    else if (!human && judged) out.missedFalse.push({ id, claim });
    else out.extraFlags.push({ id, claim });
  }
  return out;
}

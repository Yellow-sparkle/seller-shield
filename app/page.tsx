"use client";

// Slice step 7: the case screen. Lists the sandbox disputes in a grid.
// The grid shows facts only. Recommendations are not wired here yet.
import { useEffect, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";
import { toCase, daysUntilDue } from "../lib/dispute.ts";
import { decideBy, protectionLabel, responseEligibility } from "../lib/rules.ts";
import { forcedRecommendation, inrWaitNote } from "../lib/proof.ts";
import { sellerAnswers } from "../lib/answers.ts";
import fixtures from "../lib/fixtures/sandbox-disputes.json" with { type: "json" };
import recorded from "../lib/recorded/recommendations.json" with { type: "json" };

ModuleRegistry.registerModules([AllCommunityModule]);

type Row = {
  id: string;
  reason: string;
  amount: string;
  hold: string;
  deadline: string;
  daysLeft: number | null;
  protection: string;
  decideBy: string;
  status: string;
  recommendation: string;
  reasons: string;
  nextStep: string;
  decision: string;
};

// Recorded Opus answers (see scripts/live-check.ts --record). Shown without a live call.
// The deterministic rules (lib/proof.ts) override the recorded answer, as they do in recommend().
function recommendationFor(id: string, c: ReturnType<typeof toCase>, e: ReturnType<typeof responseEligibility>, now: Date): { recommendation: string; reasons: string; nextStep: string } {
  const r = (recorded as Record<string, { recommendation: string; confidence: string; claims: { text: string }[] }>)[id];
  const answer = sellerAnswers[id] ?? {};
  const underReview = c.status === "UNDER_REVIEW" && answer.hasTracking === true;
  const nextStep = underReview
    ? "Under PayPal review. Guidance by tracking: delivered means do not refund; not delivered means refund outside the dispute (PayPal may still hold the funds, not confirmed)."
    : inrWaitNote(c, answer, now) ?? "-";
  const forced = e.canRespond ? forcedRecommendation(c, answer, now) : "YOUR_CALL";
  if (forced) {
    return {
      recommendation: `${forced} (${forced === "YOUR_CALL" ? "low" : "high"} confidence, rule)`,
      reasons: "Set by a deterministic rule (lib/proof.ts).",
      nextStep,
    };
  }
  if (!r) return { recommendation: "Not recorded yet", reasons: "-", nextStep };
  return {
    recommendation: `${r.recommendation} (${r.confidence.toLowerCase()} confidence)`,
    reasons: r.claims.map((c) => c.text).join(" "),
    nextStep,
  };
}

function toRow(raw: object, now: Date): Row {
  const c = toCase(raw as never);
  const e = responseEligibility(c, now);
  const rec = recommendationFor(c.disputeId, c, e, now);
  return {
    id: c.disputeId,
    reason: c.reason,
    amount: c.amount ? `${c.amount.value.toFixed(2)} ${c.amount.currency}` : "-",
    hold: c.holdAmount
      ? `${Math.abs(c.holdAmount.value).toFixed(2)} ${c.holdAmount.currency} (net of PayPal fees)`
      : "-",
    deadline: c.responseDueAt ? c.responseDueAt.slice(0, 10) : "-",
    daysLeft: daysUntilDue(c, now),
    protection: protectionLabel(c),
    decideBy: (() => {
      const d = decideBy(c, now);
      if (d.state === "unknown") return "-";
      if (d.state === "passed") return `Passed (${d.date}). PayPal decides`;
      if (d.state === "warn") return `Decide now, due ${d.date}`;
      return `Decide by ${d.date}`;
    })(),
    status: e.canRespond
      ? "You can respond"
      : e.reason === "NO_DUE_DATE"
        ? "Due date unknown"
        : c.status === "UNDER_REVIEW"
        ? "Under PayPal review. You can't respond in the dispute."
        : `Closed to response (${e.reason}). You can still refund the buyer, but PayPal may still hold the funds (not confirmed).`,
    ...rec,
    decision: "Not decided",
  };
}

const columns: ColDef<Row>[] = [
  { field: "id", headerName: "Dispute", flex: 2 },
  { field: "reason", headerName: "Reason", flex: 1 },
  { field: "amount", headerName: "Amount", flex: 1 },
  { field: "hold", headerName: "Held", flex: 2 },
  { field: "deadline", headerName: "Respond by", flex: 1 },
  { field: "decideBy", headerName: "Decide by", flex: 2 },
  { field: "daysLeft", headerName: "Days left", flex: 1 },
  { field: "protection", headerName: "Seller protection", flex: 1 },
  { field: "status", headerName: "Status", flex: 2 },
  { field: "recommendation", headerName: "AI recommendation", flex: 2 },
  { field: "reasons", headerName: "Why (cited facts)", flex: 4, wrapText: true, autoHeight: true },
  { field: "nextStep", headerName: "Next step", flex: 3, wrapText: true, autoHeight: true },
  {
    field: "decision",
    headerName: "Seller decision",
    flex: 1.5,
    editable: true,
    cellEditor: "agSelectCellEditor",
    cellEditorParams: { values: ["Not decided", "Accept refund", "Fight", "Reject recommendation"] },
  },
];

const theme = themeQuartz;

// Evidence to attach before a FIGHT (case 5 gap 2, Kate, 5 Nov 2026). The checkbox state is kept in
// this browser only, per case. If storage is blocked, the boxes still work for the session.
const EVIDENCE_ITEMS = ["Listing photos (as shown to the buyer)", "Parcel photos (the item received)", "Short note on why the item matches the listing"];
const EVIDENCE_KEY = "seller-shield-evidence";

function readEvidence(): Record<string, boolean[]> {
  try {
    return JSON.parse(window.localStorage.getItem(EVIDENCE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeEvidence(v: Record<string, boolean[]>) {
  try {
    window.localStorage.setItem(EVIDENCE_KEY, JSON.stringify(v));
  } catch {
    // Storage blocked: the boxes keep their state until the page reloads.
  }
}

function EvidenceChecklist({ rows }: { rows: Row[] }) {
  const fights = rows.filter((r) => r.recommendation.startsWith("FIGHT"));
  const [checked, setChecked] = useState<Record<string, boolean[]>>({});
  useEffect(() => setChecked(readEvidence()), []);
  if (fights.length === 0) return null;
  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Evidence before you fight</h2>
      <p style={{ marginTop: 0, color: "#555", fontSize: 14 }}>Attach these to PayPal before you respond to a case the AI recommends fighting.</p>
      {fights.map((r) => {
        const boxes = checked[r.id] ?? EVIDENCE_ITEMS.map(() => false);
        return (
          <div key={r.id} style={{ border: "1px solid #ddd", borderRadius: 6, padding: 12, marginBottom: 8 }}>
            <strong>{r.id}</strong>
            {EVIDENCE_ITEMS.map((item, i) => (
              <label key={item} style={{ display: "block", marginTop: 6 }}>
                <input
                  type="checkbox"
                  checked={boxes[i]}
                  onChange={(e) => {
                    const next = [...boxes];
                    next[i] = e.target.checked;
                    const all = { ...checked, [r.id]: next };
                    setChecked(all);
                    writeEvidence(all);
                  }}
                />{" "}
                {item}
              </label>
            ))}
          </div>
        );
      })}
    </section>
  );
}

export default function CaseScreen() {
  // Dates are computed after mount, so the server render does not depend on the clock.
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    const now = new Date();
    setRows((fixtures as object[]).map((f) => toRow(f, now)));
  }, []);
  return (
    <main style={{ padding: 16, maxWidth: 1100, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Seller Shield: open disputes</h1>
      <p style={{ marginTop: 0, color: "#555" }}>Sandbox data, EUR. Held amounts are net of PayPal fees. AI recommendations are recorded from a live Claude run; the seller decides.</p>
      <div style={{ height: 260 }}>
        <AgGridReact<Row> theme={theme} rowData={rows} columnDefs={columns} domLayout="autoHeight" />
      </div>
      <EvidenceChecklist rows={rows} />
      <p style={{ color: "#555", fontSize: 14 }}>
        The seller decision is saved in this browser session only. Nothing is sent to PayPal yet.
      </p>
    </main>
  );
}

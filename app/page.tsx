"use client";

// Slice step 7: the case screen. Lists the sandbox disputes in a grid.
// The grid shows facts only. Recommendations are not wired here yet.
import { useEffect, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";
import { toCase, daysUntilDue } from "../lib/dispute.ts";
import { decideBy, protectionLabel, responseEligibility } from "../lib/rules.ts";
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
  decision: string;
};

// Recorded Opus answers (see scripts/live-check.ts --record). Shown without a live call.
function recommendationFor(id: string): { recommendation: string; reasons: string } {
  const r = (recorded as Record<string, { recommendation: string; confidence: string; claims: { text: string }[] }>)[id];
  if (!r) return { recommendation: "Not recorded yet", reasons: "-" };
  return {
    recommendation: `${r.recommendation} (${r.confidence.toLowerCase()} confidence)`,
    reasons: r.claims.map((c) => c.text).join(" "),
  };
}

function toRow(raw: object, now: Date): Row {
  const c = toCase(raw as never);
  const e = responseEligibility(c, now);
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
    status: e.canRespond ? "You can respond" : `Closed to response (${e.reason})`,
    ...recommendationFor(c.disputeId),
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
      <p style={{ color: "#555", fontSize: 14 }}>
        The seller decision is saved in this browser session only. Nothing is sent to PayPal yet.
      </p>
    </main>
  );
}

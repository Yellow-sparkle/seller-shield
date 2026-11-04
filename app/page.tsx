"use client";

// Slice step 7: the case screen. Lists the sandbox disputes in a grid.
// The grid shows facts only. Recommendations are not wired here yet.
import { useEffect, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";
import { toCase, daysUntilDue } from "../lib/dispute.ts";
import { responseEligibility } from "../lib/rules.ts";
import fixtures from "../lib/fixtures/sandbox-disputes.json" with { type: "json" };

ModuleRegistry.registerModules([AllCommunityModule]);

type Row = {
  id: string;
  reason: string;
  amount: string;
  hold: string;
  deadline: string;
  daysLeft: number | null;
  protection: string;
  status: string;
};

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
    protection: c.sellerProtectionEligible === null ? "-" : c.sellerProtectionEligible ? "Eligible" : "Not eligible",
    status: e.canRespond ? "You can respond" : `Closed to response (${e.reason})`,
  };
}

const columns: ColDef<Row>[] = [
  { field: "id", headerName: "Dispute", flex: 2 },
  { field: "reason", headerName: "Reason", flex: 1 },
  { field: "amount", headerName: "Amount", flex: 1 },
  { field: "hold", headerName: "Held", flex: 2 },
  { field: "deadline", headerName: "Respond by", flex: 1 },
  { field: "daysLeft", headerName: "Days left", flex: 1 },
  { field: "protection", headerName: "Seller protection", flex: 1 },
  { field: "status", headerName: "Status", flex: 2 },
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
      <p style={{ marginTop: 0, color: "#555" }}>Sandbox data, EUR. Held amounts are net of PayPal fees.</p>
      <div style={{ height: 260 }}>
        <AgGridReact<Row> theme={theme} rowData={rows} columnDefs={columns} domLayout="autoHeight" />
      </div>
    </main>
  );
}

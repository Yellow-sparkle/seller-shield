"use client";
// Tracking fixer (PRD F2). AG Grid Community only. Nothing is sent to PayPal from this screen:
// "Review" builds the list, and the send step is a separate confirm (not built yet).
import { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type RowSelectionOptions } from "ag-grid-community";
import { allOrders } from "@/lib/orders-seed";
import { filterOrders, isSelectable, planBulk, protectionLabel, type FilterChip, type Order } from "@/lib/orders";

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz;
const CHIPS: { id: FilterChip; label: string }[] = [
  { id: "missingTracking", label: "Missing tracking" },
  { id: "held", label: "Held" },
  { id: "notProtected", label: "Not protected" },
  { id: "hasDispute", label: "Has dispute" },
];

const rowSelection: RowSelectionOptions<Order> = { mode: "multiRow", checkboxes: true, headerCheckbox: true, isRowSelectable: (node) => (node.data ? isSelectable(node.data) : false) };

const columns: ColDef<Order>[] = [
  { field: "orderNo", headerName: "Order #", minWidth: 170 },
  { field: "date", headerName: "Date" },
  { field: "buyer", headerName: "Buyer" },
  { headerName: "Amount", valueGetter: (p) => (p.data ? `${p.data.amount.value} ${p.data.amount.currency}` : "") },
  { field: "carrier", headerName: "Carrier", valueFormatter: (p) => p.value ?? "" },
  { field: "tracking", headerName: "Tracking #", valueFormatter: (p) => p.value ?? "" },
  { field: "trackingStatus", headerName: "PayPal tracking", valueFormatter: (p) => p.value ?? "" },
  { headerName: "Seller protection", valueGetter: (p) => (p.data ? protectionLabel(p.data) : "") },
  { headerName: "Hold", valueGetter: (p) => (p.data?.held ? "Held" : "") },
  { headerName: "Dispute", valueGetter: (p) => (p.data?.disputeId ? "Dispute" : "") },
  { headerName: "Source", valueGetter: (p) => (p.data?.source === "demo" ? "Demo data" : "Sandbox") },
];

export default function OrdersPage() {
  const all = useMemo(() => allOrders(), []);
  const [chips, setChips] = useState<FilterChip[]>([]);
  const [quick, setQuick] = useState("");
  const [selected, setSelected] = useState<Order[]>([]);
  const [review, setReview] = useState<string[] | null>(null);

  const visible = useMemo(() => {
    const byChip = filterOrders(all, chips);
    const q = quick.trim().toLowerCase();
    return q ? byChip.filter((o) => `${o.orderNo} ${o.buyer} ${o.carrier ?? ""} ${o.tracking ?? ""}`.toLowerCase().includes(q)) : byChip;
  }, [all, chips, quick]);

  const toggle = (id: FilterChip) => setChips((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const plan = review ? planBulk(selected, {}) : null;

  return (
    <main style={{ padding: 16, maxWidth: 1200, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22 }}>Tracking fixer</h1>
      <p style={{ color: "#555" }}>Sandbox badge: all PayPal calls on this screen go to the sandbox. Demo rows can&apos;t be selected for sending.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        {CHIPS.map((c) => (
          <button key={c.id} onClick={() => toggle(c.id)} aria-pressed={chips.includes(c.id)} style={{ padding: "6px 12px", borderRadius: 16, border: "1px solid #999", background: chips.includes(c.id) ? "#222" : "#fff", color: chips.includes(c.id) ? "#fff" : "#222" }}>
            {c.label}
          </button>
        ))}
        <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Quick filter" aria-label="Quick filter" style={{ padding: "6px 10px", minWidth: 200 }} />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <span>{visible.length} orders shown, {selected.length} selected</span>
        <button onClick={() => setSelected(visible.filter(isSelectable))} style={{ padding: "6px 10px" }}>Select all filtered</button>
        <button disabled={selected.length === 0} onClick={() => setReview(selected.map((o) => o.orderNo))} style={{ padding: "6px 10px" }}>Review tracking to send</button>
      </div>

      <div style={{ height: 520 }}>
        <AgGridReact<Order>
          theme={theme}
          rowData={visible}
          columnDefs={columns}
          rowSelection={rowSelection}
          getRowId={(p) => p.data.orderNo}
          onSelectionChanged={(e) => setSelected(e.api.getSelectedRows())}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
        />
      </div>

      {review && plan && (
        <section style={{ marginTop: 16, padding: 12, border: "1px solid #ccc" }}>
          <h2 style={{ fontSize: 18 }}>Review before sending</h2>
          <p>Nothing is sent yet. Carrier and tracking entry, and the confirm step, come next. Until then this list only shows what was selected.</p>
          <ul>
            {review.map((no) => (
              <li key={no}>{no}</li>
            ))}
          </ul>
          {plan.skipped.length > 0 && <p>Skipped: {plan.skipped.map((s) => `${s.orderNo} (${s.reason})`).join("; ")}</p>}
          <button onClick={() => setReview(null)} style={{ padding: "6px 10px" }}>Close review</button>
        </section>
      )}
    </main>
  );
}

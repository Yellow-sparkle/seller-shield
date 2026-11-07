"use client";
// Add tracking (PRD F2). AG Grid Community only. "Review" builds the list. Only the confirm button sends,
// to the PayPal sandbox, through /api/tracking.
import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type ICellRendererParams, type RowSelectionOptions } from "ag-grid-community";
import { allOrders } from "@/lib/orders-seed";
import { Pill, type Tone } from "../pill";
import { caseLink, chipsFromQuery, filterOrders, gridSummary, isSelectable, planBulk, protectionLabel, type BulkLine, type FilterChip, type GridSummary, type Order } from "@/lib/orders";

const CARRIER_OPTIONS = ["DHL", "PostNL", "DPD", "UPS", "Other"];
type TrackingEntry = { carrier: string; tracking: string };

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({ accentColor: "#0070ba", headerBackgroundColor: "#eaf1fb", headerTextColor: "#003087", borderRadius: 6 });
const CHIPS: { id: FilterChip; label: string }[] = [
  { id: "missingTracking", label: "Missing tracking" },
  { id: "held", label: "Held" },
  { id: "notProtected", label: "Not protected" },
  { id: "hasDispute", label: "Has dispute" },
  { id: "sandbox", label: "Sandbox orders only" },
];

// Pill colours by meaning: good, warning, problem, neutral.
// The pinned top row holds the totals for the rows shown. Its cells render the summary instead of an order.
type P = ICellRendererParams<Order>;
const isSummary = (p: P) => p.node.rowPinned === "top";
type SummaryRow = Order & { summary: GridSummary };
const sumOf = (p: P) => (p.data as SummaryRow | undefined)?.summary ?? ({ orders: 0, total: 0, currency: "EUR", missingTracking: 0, held: 0, disputes: 0, sandbox: 0 } as GridSummary);
const PROTECTION_TONE: Record<Order["protection"], Tone> = { PROTECTED: "good", ELIGIBLE: "info", NOT_PROTECTED: "bad", UNKNOWN: "muted" };

const rowSelection: RowSelectionOptions<Order> = { mode: "multiRow", checkboxes: true, headerCheckbox: true, isRowSelectable: (node) => (node.data ? isSelectable(node.data) : false) };

const columns: ColDef<Order>[] = [
  { field: "orderNo", headerName: "Order #", minWidth: 190, cellRenderer: (p: P) => (isSummary(p) ? <strong>{sumOf(p).orders} orders shown</strong> : p.value) },
  {
    headerName: "Dispute",
    valueGetter: (p) => (p.data?.disputeId ? "Dispute" : ""),
    cellRenderer: (p: P) => {
      if (isSummary(p)) return <Pill tone="bad">{sumOf(p).disputes} disputes</Pill>;
      if (!p.data?.disputeId) return "";
      const href = caseLink(p.data);
      return href ? (
        <a href={href} style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 6, background: "#a3231b", color: "#fff", textDecoration: "none" }}>
          View case
        </a>
      ) : (
        <Pill tone="bad">Demo dispute</Pill>
      );
    },
  },
  {
    field: "tracking",
    headerName: "Tracking #",
    cellRenderer: (p: P) => (isSummary(p) ? <Pill tone={sumOf(p).missingTracking ? "bad" : "good"}>{sumOf(p).missingTracking} missing</Pill> : p.value ? p.value : <Pill tone="bad">Missing</Pill>),
  },
  {
    field: "trackingStatus",
    headerName: "PayPal tracking",
    cellRenderer: (p: P) => (isSummary(p) || !p.data ? "" : p.value ? <Pill tone="good">{p.value}</Pill> : p.data.tracking ? <Pill tone="muted">Not sent</Pill> : ""),
  },
  {
    headerName: "Seller protection",
    valueGetter: (p) => (p.data ? protectionLabel(p.data) : ""),
    cellRenderer: (p: P) => (isSummary(p) || !p.data ? "" : <Pill tone={PROTECTION_TONE[p.data.protection]}>{p.value}</Pill>),
  },
  {
    headerName: "Hold",
    valueGetter: (p) => (p.data?.held ? "Held" : ""),
    cellRenderer: (p: P) => (isSummary(p) ? <Pill tone="warn">{sumOf(p).held} held</Pill> : p.value ? <Pill tone="warn">Held</Pill> : ""),
  },
  {
    headerName: "Amount",
    valueGetter: (p) => (p.data ? Number(p.data.amount.value) : 0),
    cellRenderer: (p: P) => (isSummary(p) ? <strong>{sumOf(p).total.toFixed(2)} {sumOf(p).currency}</strong> : p.data ? `${p.data.amount.value} ${p.data.amount.currency}` : ""),
  },
  { field: "carrier", headerName: "Carrier", valueFormatter: (p) => p.value ?? "" },
  { field: "date", headerName: "Date" },
  { field: "buyer", headerName: "Buyer" },
  {
    headerName: "Source",
    valueGetter: (p) => (p.data?.source === "demo" ? "Demo data" : "Sandbox"),
    cellRenderer: (p: P) => (isSummary(p) ? <Pill tone="info">{sumOf(p).sandbox} sandbox</Pill> : p.value === "Sandbox" ? <Pill tone="info">Sandbox</Pill> : <Pill tone="muted">Demo data</Pill>),
  },
];

export default function OrdersPage() {
  const all = useMemo(() => allOrders(), []);
  const [chips, setChips] = useState<FilterChip[]>([]);
  const [quick, setQuick] = useState("");
  const [selected, setSelected] = useState<Order[]>([]);
  const [review, setReview] = useState<string[] | null>(null);
  const [entries, setEntries] = useState<Record<string, TrackingEntry>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [pickMsg, setPickMsg] = useState<string | null>(null);
  const [rowStatus, setRowStatus] = useState<Record<string, string>>({});
  const reviewRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (review) reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [review]);

  const visible = useMemo(() => {
    const byChip = filterOrders(all, chips);
    const q = quick.trim().toLowerCase();
    return q ? byChip.filter((o) => `${o.orderNo} ${o.buyer} ${o.carrier ?? ""} ${o.tracking ?? ""}`.toLowerCase().includes(q)) : byChip;
  }, [all, chips, quick]);

  // Chips can come from a link, for example the health scan's "missing tracking" card.
  useEffect(() => {
    const fromLink = chipsFromQuery(window.location.search);
    if (fromLink.length) setChips(fromLink);
  }, []);

  const summary = useMemo(() => gridSummary(visible), [visible]);
  // The pinned summary row carries the totals for the rows shown. Its cells render them instead of an order.
  // The totals for the rows shown, as a strip above the grid.

  const toggle = (id: FilterChip) => setChips((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const plan = review ? planBulk(selected.filter((o) => review.includes(o.orderNo)), entries) : null;
  const setEntry = (orderNo: string, patch: Partial<TrackingEntry>) =>
    setEntries((e) => {
      const prev: TrackingEntry = e[orderNo] ?? { carrier: "", tracking: "" };
      return { ...e, [orderNo]: { ...prev, ...patch } };
    });

  const confirmSend = async (lines: BulkLine[]) => {
    setStatus("Sending to PayPal sandbox...");
    try {
      const res = await fetch("/api/tracking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines }) });
      const data = (await res.json()) as { ok: boolean; status?: number; error?: string; body?: string; confirmed?: string[]; errors?: unknown[] };
      const confirmed = new Set(data.confirmed ?? []);
      const next: Record<string, string> = {};
      for (const l of lines) next[l.orderNo] = confirmed.has(l.orderNo) && !(data.errors?.length) ? "Tracking added" : `Not confirmed by PayPal${data.errors?.length ? ": batch errors" : ""}`;
      setRowStatus(next);
      setStatus(data.ok ? `PayPal sandbox replied HTTP ${data.status}. Sent ${lines.length} update(s). Response: ${data.body ?? "(empty)"}` : `Not sent: ${data.error ?? `PayPal returned HTTP ${data.status}: ${data.body ?? ""}`}`);
    } catch {
      setStatus("Not sent: the request to the server failed.");
    }
  };

  return (
    <main style={{ padding: 20, width: "100%", maxWidth: 1500, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, margin: "0 0 6px" }}>Add tracking to orders</h1>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        {CHIPS.map((c) => (
          <button key={c.id} onClick={() => toggle(c.id)} aria-pressed={chips.includes(c.id)} style={{ padding: "5px 12px", borderRadius: 999, border: chips.includes(c.id) ? "1px solid #003087" : "1px solid #b8c7da", background: chips.includes(c.id) ? "#003087" : "#eef3f9", color: chips.includes(c.id) ? "#ffffff" : "#003087", fontSize: 13, fontWeight: 500 }}>
            {chips.includes(c.id) ? "✓ " : ""}{c.label}
          </button>
        ))}
        <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Quick filter" aria-label="Quick filter" style={{ padding: "5px 12px", minWidth: 200, borderRadius: 999, border: "1px solid #b8c7da", background: "#ffffff", fontSize: 13, color: "#003087" }} />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <span>{visible.length} orders shown, {selected.length} selected</span>
        <button className="primary" aria-disabled={selected.length === 0} onClick={() => { if (selected.length === 0) { setPickMsg("Choose at least one order first. Tick the boxes on the left."); setReview(null); return; } setPickMsg(null); setReview(selected.map((o) => o.orderNo)); }} style={{ opacity: selected.length === 0 ? 0.5 : 1 }}>Review tracking to send</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
        {[
          { label: "Orders shown", value: String(summary.orders) },
          { label: "Total", value: `${summary.total.toFixed(2)} ${summary.currency}` },
          { label: "Missing tracking", value: String(summary.missingTracking) },
          { label: "Held", value: String(summary.held) },
          { label: "With a dispute", value: String(summary.disputes) },
          { label: "Sandbox orders", value: String(summary.sandbox) },
        ].map((t) => (
          <div key={t.label} style={{ background: "#ffffff", border: "1px solid #d6dee8", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 12, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#003087", fontVariantNumeric: "tabular-nums" }}>{t.value}</div>
          </div>
        ))}
      </div>

      {pickMsg && (
        <p role="alert" style={{ margin: "0 0 12px", padding: "8px 12px", borderRadius: 6, background: "#fdf1d8", color: "#7a4b00", fontSize: 14 }}>{pickMsg}</p>
      )}

      {review && plan && (
        <section ref={reviewRef} style={{ marginBottom: 16, padding: 16, background: "#e7f1fb", border: "2px solid #0070ba", borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0070ba", textTransform: "uppercase", letterSpacing: "0.06em" }}>Step 2 of 2</div>
          <h2 style={{ fontSize: 18, marginTop: 2 }}>Review before sending</h2>
          <div role="table" aria-label="Tracking to send" style={{ border: "1px solid #d6dee8", borderRadius: 8, overflow: "hidden" }}>
            <div role="row" style={{ display: "grid", gridTemplateColumns: "minmax(170px,1.3fr) minmax(130px,0.8fr) minmax(170px,1fr) minmax(150px,1fr)", gap: 12, padding: "8px 12px", background: "#eaf1fb", color: "#003087", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              <span role="columnheader">Order</span>
              <span role="columnheader">Carrier</span>
              <span role="columnheader">Tracking number</span>
              <span role="columnheader">Result</span>
            </div>
            {review.map((no) => {
              const o = all.find((x) => x.orderNo === no);
              const entry = entries[no] ?? { carrier: "", tracking: "" };
              const result = rowStatus[no];
              return (
                <div role="row" key={no} style={{ display: "grid", gridTemplateColumns: "minmax(170px,1.3fr) minmax(130px,0.8fr) minmax(170px,1fr) minmax(150px,1fr)", gap: 12, alignItems: "center", padding: "10px 12px", borderTop: "1px solid #eef1f5", background: "#ffffff" }}>
                  <span role="cell" style={{ fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>
                    {no}
                    {o?.source === "demo" && <span style={{ display: "block", fontSize: 12, color: "#4a5568" }}>Demo data, not sent</span>}
                  </span>
                  <span role="cell">
                    <select aria-label={`Carrier for ${no}`} value={entry.carrier} onChange={(e) => setEntry(no, { carrier: e.target.value })} style={{ width: "100%", padding: "6px 8px" }}>
                      <option value="">Choose carrier</option>
                      {CARRIER_OPTIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </span>
                  <span role="cell">
                    <input aria-label={`Tracking number for ${no}`} value={entry.tracking} onChange={(e) => setEntry(no, { tracking: e.target.value })} placeholder="Tracking number" style={{ width: "100%", padding: "6px 8px" }} />
                  </span>
                  <span role="cell">
                    {result ? (
                      <span role="status" style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: result === "Tracking added" ? "#e3f3ea" : "#fbe6e4", color: result === "Tracking added" ? "#1d6b3f" : "#a3231b" }}>{result}</span>
                    ) : (
                      <span style={{ color: "#8a94a6", fontSize: 13 }}>Not sent yet</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          {plan.skipped.length > 0 && (
            <p style={{ margin: "12px 0 0", padding: "8px 12px", borderRadius: 6, background: "#fdf1d8", color: "#7a4b00", fontSize: 14 }}>
              Not yet ready: {plan.skipped.map((s) => `${s.orderNo} (${s.reason.toLowerCase()})`).join("; ")}
            </p>
          )}
          <p style={{ margin: "12px 0", fontSize: 14, color: "#003087" }}><strong>Will send ({plan.lines.length}):</strong> <span style={{ color: "#4a5568" }}>{plan.lines.map((l) => `${l.orderNo} via ${l.carrier}, ${l.tracking}`).join("; ") || "nothing yet"}</span></p>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button className="primary" disabled={plan.lines.length === 0} onClick={() => confirmSend(plan.lines)}>Confirm and send</button>
            <button onClick={() => { setReview(null); setStatus(null); }} style={{ padding: "8px 14px" }}>Close review</button>
          </div>
          {status && <p role="status" style={{ marginBottom: 0 }}>{status}</p>}
        </section>
      )}

      <div style={{ height: 520 }}>
        <AgGridReact<Order>
          theme={theme}
          rowData={visible}
          columnDefs={columns}
          rowSelection={rowSelection}
          getRowId={(p) => p.data.orderNo}
          onSelectionChanged={(e) => {
            const rows = e.api.getSelectedRows();
            setSelected(rows);
            if (rows.length > 0) setPickMsg(null);
            else setReview(null);
          }}
          defaultColDef={{ sortable: true, filter: true, resizable: true, minWidth: 130, flex: 1 }}
        />
      </div>

    </main>
  );
}

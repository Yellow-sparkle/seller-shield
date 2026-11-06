"use client";
// Tracking fixer (PRD F2). AG Grid Community only. "Review" builds the list. Only the confirm button sends,
// to the PayPal sandbox, through /api/tracking.
import { useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type ICellRendererParams, type RowSelectionOptions } from "ag-grid-community";
import { allOrders } from "@/lib/orders-seed";
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
const TONES = {
  good: { background: "#e3f3ea", color: "#1d6b3f" },
  warn: { background: "#fdf1d8", color: "#7a4b00" },
  bad: { background: "#fbe6e4", color: "#a3231b" },
  info: { background: "#e7eafa", color: "#33449a" },
  muted: { background: "#eef0f3", color: "#4a5160" },
} as const;
type Tone = keyof typeof TONES;

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span style={{ ...TONES[tone], padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{children}</span>;
}

// The pinned top row holds the totals for the rows shown. Its cells render the summary instead of an order.
type P = ICellRendererParams<Order>;
const isSummary = (p: P) => p.node.rowPinned === "top";
type SummaryRow = Order & { summary: GridSummary };
const sumOf = (p: P) => (p.data as SummaryRow | undefined)?.summary ?? ({ orders: 0, total: 0, currency: "EUR", missingTracking: 0, held: 0, disputes: 0, sandbox: 0 } as GridSummary);
const PROTECTION_TONE: Record<Order["protection"], Tone> = { PROTECTED: "good", ELIGIBLE: "info", NOT_PROTECTED: "bad", UNKNOWN: "muted" };

const rowSelection: RowSelectionOptions<Order> = { mode: "multiRow", checkboxes: true, headerCheckbox: true, isRowSelectable: (node) => (node.data ? isSelectable(node.data) : false) };

const columns: ColDef<Order>[] = [
  { field: "orderNo", headerName: "Order #", minWidth: 190, pinned: "left", cellRenderer: (p: P) => (isSummary(p) ? <strong>{sumOf(p).orders} orders shown</strong> : p.value) },
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
  const [rowStatus, setRowStatus] = useState<Record<string, string>>({});

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
  const pinnedTop = useMemo(() => [{ orderNo: `summary-${summary.orders}-${summary.total}-${summary.missingTracking}-${summary.held}-${summary.disputes}`, date: "", buyer: "", amount: { currency: summary.currency, value: String(summary.total) }, protection: "UNKNOWN", held: false, source: "demo", summary } as SummaryRow], [summary]);

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
      <h1 style={{ fontSize: 22 }}>Tracking fixer</h1>
      <p style={{ color: "#555" }}>All PayPal calls on this screen go to the sandbox. Demo rows can&apos;t be selected for sending. The top row totals the orders shown.</p>

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
          pinnedTopRowData={pinnedTop}
          onSelectionChanged={(e) => setSelected(e.api.getSelectedRows())}
          defaultColDef={{ sortable: true, filter: true, resizable: true, minWidth: 130, flex: 1 }}
        />
      </div>

      {review && plan && (
        <section style={{ marginTop: 16, padding: 12, border: "1px solid #ccc" }}>
          <h2 style={{ fontSize: 18 }}>Review before sending</h2>
          <p>Enter a carrier and tracking number for each sandbox order. Nothing is sent until you confirm.</p>
          {review.map((no) => {
            const o = all.find((x) => x.orderNo === no);
            const entry = entries[no] ?? { carrier: "", tracking: "" };
            return (
              <div key={no} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "6px 0" }}>
                <span style={{ minWidth: 200 }}>{no}{o?.source === "demo" ? " (Demo data)" : ""}</span>
                <select aria-label={`Carrier for ${no}`} value={entry.carrier} onChange={(e) => setEntry(no, { carrier: e.target.value })} style={{ padding: "4px 6px" }}>
                  <option value="">Choose carrier</option>
                  {CARRIER_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input aria-label={`Tracking number for ${no}`} value={entry.tracking} onChange={(e) => setEntry(no, { tracking: e.target.value })} placeholder="Tracking number" style={{ padding: "4px 6px", minWidth: 180 }} />
                {rowStatus[no] && <span role="status">{rowStatus[no]}</span>}
              </div>
            );
          })}
          {plan.skipped.length > 0 && <p>Not sent: {plan.skipped.map((s) => `${s.orderNo} (${s.reason})`).join("; ")}</p>}
          <p><strong>Will send ({plan.lines.length}):</strong> {plan.lines.map((l) => `${l.orderNo} to ${l.carrier} ${l.tracking}`).join("; ") || "nothing yet"}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={plan.lines.length === 0} onClick={() => confirmSend(plan.lines)} style={{ padding: "6px 10px" }}>Confirm and send</button>
            <button onClick={() => { setReview(null); setStatus(null); }} style={{ padding: "6px 10px" }}>Close review</button>
          </div>
          {status && <p role="status">{status}</p>}
        </section>
      )}
    </main>
  );
}

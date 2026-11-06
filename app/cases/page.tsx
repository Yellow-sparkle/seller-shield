"use client";

// Case screen (PRD F3). Lists the sandbox disputes with the recorded AI recommendation.
// A link such as /cases#PP-R-... (from the orders grid or the health scan) highlights that case.
import { useEffect, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type CellValueChangedEvent, type ColDef } from "ag-grid-community";
import { toCase, daysUntilDue } from "../../lib/dispute.ts";
import { decideBy, protectionLabel, responseEligibility } from "../../lib/rules.ts";
import { forcedRecommendation, inrWaitNote } from "../../lib/proof.ts";
import { sellerAnswers, type SellerAnswer } from "../../lib/answers.ts";
import { templateReply } from "../../lib/reply.ts";
import fixtures from "../../lib/fixtures/sandbox-disputes.json" with { type: "json" };
import recorded from "../../lib/recorded/recommendations.json" with { type: "json" };

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
  canRespond: boolean;
  recommendation: string;
  reasons: string;
  nextStep: string;
  cause: string;
  evidence: string;
  decision: string;
};

type Override = Partial<SellerAnswer>;

// Recorded Opus answers (see scripts/live-check.ts --record). Shown without a live call.
// The deterministic rules (lib/proof.ts) override the recorded answer, as they do in recommend().
function recommendationFor(id: string, c: ReturnType<typeof toCase>, e: ReturnType<typeof responseEligibility>, now: Date, override: Override): { recommendation: string; reasons: string; nextStep: string } {
  const r = (recorded as Record<string, { recommendation: string; confidence: string; claims: { text: string }[] }>)[id];
  const answer: SellerAnswer = { ...(sellerAnswers[id] ?? {}), ...override };
  const underReview = c.status === "UNDER_REVIEW" && answer.hasTracking === true;
  const nextStep = c.lifeCycleStage === "CHARGEBACK"
    ? "Card-issuer chargeback: the bank decides. A refund within 20 hours of a pre-chargeback alert avoids the chargeback fee (PayPal, disputes overview)."
    : underReview
    ? "Under PayPal review. Guidance by tracking: delivered means do not refund; not delivered means refund outside the dispute (PayPal may still hold the funds, not confirmed)."
    : !e.canRespond && e.reason === "NO_DUE_DATE"
      ? "No response due date in our data. Check the deadline in PayPal before acting."
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

// Reason labels on the screen: PayPal's issue names (disputes overview). OTHER covers billing or
// subscription errors, requests for details and misdirected transactions (Kate, 5 Nov 2026).
const REASON_LABEL: Record<string, string> = {
  INR: "Item not received (INR)",
  SNAD: "Significantly not as described (SNAD)",
  UNAUTHORISED: "Unauthorised transaction",
  OTHER: "Other: billing, details or misdirected",
  UNKNOWN: "Unknown reason",
};

function toRow(raw: object, now: Date, override: Override = {}): Row {
  const c = toCase(raw as never);
  const e = responseEligibility(c, now);
  const rec = recommendationFor(c.disputeId, c, e, now, override);
  return {
    id: c.disputeId,
    reason: REASON_LABEL[c.reason] ?? c.reason,
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
    canRespond: e.canRespond,
    status: e.canRespond
      ? "You can respond"
      : e.reason === "NO_DUE_DATE"
        ? "Due date unknown"
        : c.status === "UNDER_REVIEW"
        ? "Under PayPal review. You can't respond in the dispute."
        : `Closed to response (${e.reason}). You can still refund the buyer, but PayPal may still hold the funds (not confirmed).`,
    ...rec,
    cause: override.addressMismatchCause ?? "unknown",
    evidence: override.causeEvidence ?? "",
    decision: "Not decided",
  };
}

const columns: ColDef<Row>[] = [
  { field: "id", headerName: "Dispute", flex: 2, minWidth: 190, pinned: "left" },
  { field: "reason", headerName: "Reason", flex: 1 },
  { field: "amount", headerName: "Amount", flex: 1 },
  { field: "hold", headerName: "Held (net of fees)", flex: 2 },
  { field: "deadline", headerName: "Respond by", flex: 1 },
  { field: "decideBy", headerName: "Decide by", flex: 2 },
  { field: "daysLeft", headerName: "Days left", flex: 1 },
  { field: "protection", headerName: "Seller protection", flex: 1 },
  { field: "status", headerName: "Status", flex: 2, minWidth: 240 },
  { field: "recommendation", headerName: "AI recommendation", flex: 2 },
  { field: "reasons", headerName: "Why (cited facts)", flex: 4, minWidth: 320, wrapText: true, autoHeight: true },
  { field: "nextStep", headerName: "Next step", flex: 3, minWidth: 260, wrapText: true, autoHeight: true },
  {
    field: "cause",
    headerName: "Address mismatch cause",
    flex: 1.5,
    editable: true,
    cellEditor: "agSelectCellEditor",
    cellEditorParams: { values: ["unknown", "seller", "buyer"] },
  },
  { field: "evidence", headerName: "Cause evidence", flex: 2, editable: true },
  {
    field: "decision",
    headerName: "Seller decision",
    flex: 1.5,
    editable: true,
    cellEditor: "agSelectCellEditor",
    cellEditorParams: { values: ["Not decided", "Accept refund", "Fight", "Reject recommendation"] },
  },
];

const theme = themeQuartz.withParams({ accentColor: "#0070ba", headerBackgroundColor: "#eaf1fb", headerTextColor: "#003087", borderRadius: 6 });

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

// Reply drafts and actions (PRD F3). The draft is a template from case facts. The seller edits it, then either
// copies it or approves a send. Sends go through /api/dispute-action to the PayPal sandbox only, and only after
// the seller presses an Approve button. Buttons are disabled when PayPal no longer accepts a response.
function ReplyDrafts({ rows }: { rows: Row[] }) {
  const cases = rows.filter((r) => /^(FIGHT|REFUND|YOUR_CALL)/.test(r.recommendation));
  if (cases.length === 0) return null;
  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Reply and act</h2>
      {cases.map((r) => {
        const draft = templateReply({ recommendation: r.recommendation, amount: r.amount, orderRef: r.id });
        return <DraftCard key={r.id} row={r} initial={draft.draft} />;
      })}
    </section>
  );
}

type Pending = "message" | "refund" | null;
type Outcome = { ok: boolean; text: string };

function DraftCard({ row, initial }: { row: Row; initial: string }) {
  const [text, setText] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const refundNote = `Full refund of ${row.amount} accepted by the seller.`;

  const send = async (action: "message" | "refund") => {
    setBusy(true);
    setOutcome(null);
    try {
      const res = await fetch("/api/dispute-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disputeId: row.id, action, text: action === "message" ? text : refundNote }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; status?: number };
      setOutcome(
        data.ok
          ? { ok: true, text: action === "message" ? `Sent to the buyer. PayPal sandbox replied HTTP ${data.status}.` : `Refund accepted. PayPal sandbox replied HTTP ${data.status}.` }
          : { ok: false, text: `Not sent. ${data.error ?? "PayPal did not accept it."}` },
      );
    } catch {
      setOutcome({ ok: false, text: "Not sent. The request to the server failed." });
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <div id={`act-${row.id}`} style={{ border: "1px solid #ddd", borderRadius: 6, padding: 12, marginBottom: 8 }}>
      <strong>{row.id}</strong> <span style={{ color: "#555", fontSize: 14 }}>AI recommendation: {row.recommendation}</span>
      <textarea
        aria-label={`Reply to the buyer for ${row.id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={2000}
        style={{ display: "block", width: "100%", marginTop: 6, fontFamily: "inherit", fontSize: 14 }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, alignItems: "center" }}>
        <button type="button" onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => setCopied(false))}>
          Copy
        </button>
        <button type="button" disabled={!row.canRespond || busy} onClick={() => setPending("message")}>
          Send to buyer...
        </button>
        <button type="button" disabled={!row.canRespond || busy} onClick={() => setPending("refund")}>
          Refund buyer...
        </button>
        {copied && <span style={{ color: "#555", fontSize: 14 }}>Copied.</span>}
      </div>
      {!row.canRespond && <p style={{ color: "#555", fontSize: 14, marginTop: 6 }}>PayPal doesn&apos;t accept a reply on this case now. {row.status}</p>}
      {pending && (
        <div role="dialog" aria-label="Approve before sending" style={{ marginTop: 8, padding: 10, borderRadius: 6, background: "#fff4d6", border: "1px solid #e8c56b" }}>
          <p style={{ margin: "0 0 6px" }}>
            {pending === "message"
              ? "Send the message above to the buyer through PayPal (sandbox)? The buyer will see it in the dispute."
              : `Refund the buyer in full (${row.amount}) and close the dispute in PayPal (sandbox)? This can't be undone.`}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="primary" disabled={busy} onClick={() => send(pending)}>
              {busy ? "Sending..." : pending === "message" ? "Approve and send" : "Approve refund"}
            </button>
            <button type="button" disabled={busy} onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {outcome && (
        <p role="status" style={{ marginTop: 6, fontWeight: 600, color: outcome.ok ? "#1d6b3f" : "#a3231b" }}>
          {outcome.text}
        </p>
      )}
    </div>
  );
}

export default function CaseScreen() {
  // Dates are computed after mount, so the server render does not depend on the clock.
  // Rows are built after mount (the clock). Seller cause and evidence typed on the screen are kept per case, for this session.
  const [now, setNow] = useState<Date | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  useEffect(() => {
    setNow(new Date());
    try {
      setOverrides(JSON.parse(window.localStorage.getItem("seller-shield-overrides") ?? "{}"));
    } catch {
      // Storage blocked: start with no typed answers.
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem("seller-shield-overrides", JSON.stringify(overrides));
    } catch {
      // Storage blocked: answers last until the page reloads.
    }
  }, [overrides]);
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setFocusId(decodeURIComponent(window.location.hash.slice(1)) || null);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const rows: Row[] = now
    ? (fixtures as object[]).map((f) => {
        const id = toCase(f as never).disputeId;
        return toRow(f, now, overrides[id] ?? {});
      })
    : [];
  const onCellValueChanged = (e: CellValueChangedEvent<Row>) => {
    if (e.colDef.field !== "cause" && e.colDef.field !== "evidence") return;
    const d = e.data;
    if (!d) return;
    setOverrides((prev) => ({
      ...prev,
      [d.id]: {
        addressMismatchCause: (d.cause as "seller" | "buyer" | "unknown") ?? "unknown",
        causeEvidence: d.evidence || undefined,
      },
    }));
  };
  return (
    <main style={{ padding: 20, width: "100%", maxWidth: 1500, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Dispute cases</h1>
      {focusId && rows.length > 0 && !rows.some((r) => r.id === focusId) && <p role="status">Case {focusId} is not in the sandbox data.</p>}
      <div>
        <AgGridReact<Row>
          key={focusId ?? "none"}
          theme={theme}
          rowData={rows}
          columnDefs={columns}
          domLayout="autoHeight"
          defaultColDef={{ minWidth: 120, wrapHeaderText: true, autoHeaderHeight: true, wrapText: true, autoHeight: true, cellStyle: { lineHeight: "1.4", paddingTop: 8, paddingBottom: 8 } }}
          suppressColumnVirtualisation
          getRowId={(p) => p.data.id}
          getRowStyle={(p) => (p.data && p.data.id === focusId ? { background: "#fff4d6", fontWeight: 600 } : undefined)}
          onRowDataUpdated={(e) => {
            const node = focusId ? e.api.getRowNode(focusId) : undefined;
            if (node) e.api.flashCells({ rowNodes: [node] });
          }}
          onCellValueChanged={onCellValueChanged}
        />
      </div>
      <EvidenceChecklist rows={rows} />
      <ReplyDrafts rows={rows} />
    </main>
  );
}

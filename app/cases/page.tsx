"use client";

// Case screen (PRD F3). Lists the sandbox disputes with the recorded AI recommendation.
// A link such as /cases#PP-R-... (from the orders grid or the health scan) highlights that case.
import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type RowSelectionOptions } from "ag-grid-community";
import { toCase, daysUntilDue } from "../../lib/dispute.ts";
import { protectionLabel, responseEligibility } from "../../lib/rules.ts";
import { forcedRecommendation, inrWaitNote } from "../../lib/proof.ts";
import { sellerAnswers, type SellerAnswer } from "../../lib/answers.ts";
import { templateReply } from "../../lib/reply.ts";
import fixtures from "../../lib/fixtures/sandbox-disputes.json" with { type: "json" };
import recorded from "../../lib/recorded/recommendations.json" with { type: "json" };
import { Pill, type Tone } from "../pill";
import { allOrders } from "@/lib/orders-seed";
import { casePath, type StepState } from "@/lib/case-path";
// One demo case where the seller must write to the buyer, so the reply draft is always visible (Kate, 7 Nov 2026).
import demoDisputes from "../../lib/fixtures/demo-disputes.json" with { type: "json" };
import feeFixtures from "../../lib/fixtures/sandbox-fees.json" with { type: "json" };
import { feeLabel, type FeeRecord } from "../../lib/fees.ts";

ModuleRegistry.registerModules([AllCommunityModule]);

type Row = {
  id: string;
  reason: string;
  amount: string;
  fee: string;
  afterFees: string;
  deadline: string;
  daysLeft: number | null;
  protection: string;
  status: string;
  canRespond: boolean;
  recommendation: string;
  reasons: string;
  nextStep: string;
  cause: string;
  evidence: string;
  mismatch: "yes" | "no" | null;
  decision: string;
  buyerFiles: string[];
  buyerClaim: string | null;
  requested: string[];
  buyerChecked: boolean;
  sellerMessages: string[];
  messages: CaseMessage[];
  order: OrderTracking | null;
};

// Orders by number, to show the order behind each case. The dispute's seller transaction ID is the order number.
const ORDER_BY_NO = new Map(allOrders().map((o) => [o.orderNo, o]));
type OrderTracking = { orderNo: string; tracking: string | null; carrier: string | null; status: string | null };

type CaseMessage = { by: string; time: string | null; text: string };

type Override = Partial<SellerAnswer> & { addressMismatch?: "yes" | "no"; decision?: string; buyerFiles?: string[] };

// Recorded Opus answers (see scripts/live-check.ts --record). Shown without a live call.
// The deterministic rules (lib/proof.ts) override the recorded answer, as they do in recommend().
function recommendationFor(id: string, c: ReturnType<typeof toCase>, e: ReturnType<typeof responseEligibility>, now: Date, override: Override): { recommendation: string; reasons: string; nextStep: string } {
  const r = (recorded as Record<string, { recommendation: string; confidence: string; claims: { text: string }[] }>)[id];
  const answer: SellerAnswer = { ...(sellerAnswers[id] ?? {}), ...override };
  const underReview = c.status === "UNDER_REVIEW" && answer.hasTracking === true;
  const nextStep = c.lifeCycleStage === "CHARGEBACK"
    ? "1. The card issuer decides.\n2. A refund within 20 hours of a pre-chargeback alert avoids the chargeback fee."
    : underReview
    ? "1. Wait for PayPal's decision.\n2. Do not refund while it is under review."
    : !e.canRespond && e.reason === "NO_DUE_DATE"
      ? "1. Check the response deadline in PayPal.\n2. No due date in our data."
      : !e.canRespond
        ? "1. Refund the buyer if you accept the claim.\n2. PayPal decides the rest."
        : answer.hasTracking === false
          ? "1. Add tracking.\n2. Reply before the due date."
          : answer.hasTracking === true
            ? "1. Send the tracking and proof of delivery as evidence.\n2. Reply before the due date."
            : inrWaitNote(c, answer, now) ?? "1. Check the tracking for this order.\n2. Reply before the due date.";
  const forced = e.canRespond ? forcedRecommendation(c, answer, now) : "YOUR_CALL";
  if (forced) {
    const verdict = forced === "FIGHT" ? "The evidence on file supports your side." : forced === "REFUND" ? "The evidence on file supports the buyer." : "The evidence on file does not settle it. You decide.";
    const tracking = answer.hasTracking === true ? "A tracking number is on the order." : answer.hasTracking === false ? "No tracking number is on the order." : "";
    return {
      recommendation: `${forced} (${forced === "YOUR_CALL" ? "low" : "high"} confidence, rule)`,
      reasons: [tracking, verdict].filter(Boolean).map((t) => `• ${t}`).join("\n"),
      nextStep,
    };
  }
  if (!r) return { recommendation: "Not recorded yet", reasons: "-", nextStep };
  return {
    recommendation: `${r.recommendation} (${r.confidence.toLowerCase()} confidence)`,
    reasons: r.claims.map((c) => `• ${c.text}`).join("\n"),
    nextStep,
  };
}

// Reason labels on the screen: PayPal's issue names (disputes overview). OTHER covers billing or
// subscription errors, requests for details and misdirected transactions (Kate, 5 Nov 2026).
const REASON_LABEL: Record<string, string> = {
  INR: "Item not received",
  SNAD: "Significantly not as described",
  UNAUTHORISED: "Unauthorised transaction",
  OTHER: "Other: billing, details or misdirected",
  UNKNOWN: "Unknown reason",
};

// PayPal statuses that mean the case is over. For these we show PayPal's status and no action.
const RESOLVED_STATUSES = ["REFUNDED", "RESOLVED", "DENIED", "CANCELLED"];

function toRow(raw: object, now: Date, override: Override = {}): Row {
  const fx = raw as Record<string, unknown>;
  const c = toCase(raw as never);
  const e = responseEligibility(c, now);
  const resolved = c.status !== null && RESOLVED_STATUSES.includes(c.status);
  // The seller has replied and PayPal is waiting for the buyer: nothing for the seller to do yet.
  const waitingForBuyer = c.status === "WAITING_FOR_BUYER_RESPONSE";
  const rec = waitingForBuyer
    ? {
        recommendation: "WAITING",
        reasons: "• You have replied. PayPal is waiting for the buyer.",
        nextStep: "1. Wait for the buyer's reply.\n2. PayPal decides if the buyer does not reply in time.",
      }
    : resolved
    ? {
        recommendation: "RESOLVED",
        reasons: c.status === "REFUNDED" ? "• PayPal has already refunded the buyer." : `• PayPal has closed this case (${c.status}).`,
        nextStep: "1. No action needed.\n2. Keep the case for your records.",
      }
    : recommendationFor(c.disputeId, c, e, now, override);
  return {
    id: c.disputeId,
    reason: REASON_LABEL[c.reason] ?? c.reason,
    amount: c.amount ? `${c.amount.value.toFixed(2)} ${c.amount.currency}` : "-",
    fee: feeLabel((feeFixtures as Record<string, FeeRecord>)[c.disputeId], "fee"),
    afterFees: feeLabel((feeFixtures as Record<string, FeeRecord>)[c.disputeId], "afterFees"),
    deadline: resolved ? "Closed" : c.responseDueAt ? c.responseDueAt.slice(0, 10) : "Not set",
    daysLeft: resolved ? null : daysUntilDue(c, now),
    protection: protectionLabel(c),
    canRespond: e.canRespond && !waitingForBuyer && !resolved,
    status: resolved
      ? c.status === "REFUNDED" ? "Refunded by PayPal" : "Resolved by PayPal"
      : waitingForBuyer
        ? "Waiting for the buyer to reply"
      : e.canRespond
      ? "You can respond"
      : e.reason === "NO_DUE_DATE"
        ? "Due date unknown"
        : c.status === "UNDER_REVIEW"
        ? "Under PayPal review. You can't respond in the dispute."
        : `Closed to response (${e.reason}). You can still refund the buyer, but PayPal may still hold the funds (not confirmed).`,
    ...rec,
    cause: override.addressMismatchCause ?? "unknown",
    evidence: override.causeEvidence ?? "",
    mismatch: override.addressMismatch ?? (override.causeEvidence || (override.addressMismatchCause && override.addressMismatchCause !== "unknown") ? "yes" : null),
    decision: override.decision ?? "Not decided",
    buyerFiles: override.buyerFiles ?? (Array.isArray(fx.buyer_files) ? (fx.buyer_files as string[]) : []),
    buyerClaim: typeof fx.buyer_claim === "string" ? fx.buyer_claim : null,
    requested: Array.isArray(fx.requested_from_seller) ? (fx.requested_from_seller as string[]) : [],
    buyerChecked: fx.buyer_checked === true,
    sellerMessages: Array.isArray(fx.seller_messages) ? (fx.seller_messages as string[]) : [],
    messages: Array.isArray(fx.messages) ? (fx.messages as CaseMessage[]) : [],
    order: (() => {
      const o = c.transactionId ? ORDER_BY_NO.get(c.transactionId) : undefined;
      return o ? { orderNo: o.orderNo, tracking: o.tracking ?? null, carrier: o.carrier ?? null, status: o.trackingStatus ?? null } : null;
    })(),
  };
}

// Ticked cases drive the lower sections, the same way ticked orders drive Review on the orders screen.
const rowSelection: RowSelectionOptions<Row> = { mode: "multiRow", checkboxes: true, headerCheckbox: true };

// Plain labels for the case read (Kate, 6 Nov 2026). The internal codes stay in the data; only the screen changes.
// The column name is "Case strength" (Kate, 6 Nov 2026).
const CASE_READ_LABEL = "Case strength";

function readTone(value: string): { label: string; tone: Tone } {
  if (value === "RESOLVED") return { label: "Closed by PayPal", tone: "muted" };
  if (value === "WAITING") return { label: "Waiting for the buyer", tone: "info" };
  if (value.startsWith("FIGHT")) return { label: "Strong case", tone: "good" };
  if (value.startsWith("REFUND")) return { label: "Weak case", tone: "bad" };
  if (value.startsWith("YOUR_CALL")) return { label: "Mixed: your decision", tone: "warn" };
  return { label: "Not checked yet", tone: "muted" };
}

function ReadBadge({ value }: { value: string }) {
  const s = readTone(value);
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

function ProtectionBadge({ value }: { value: string }) {
  const tone: Tone = value.startsWith("Eligible") ? "info" : value.startsWith("Not") ? "bad" : "muted";
  // Long explanations stay in the tooltip; the badge shows the short label.
  const short = value.startsWith("Not covered") ? "Not covered" : value;
  return <span title={value}><Pill tone={tone}>{short}</Pill></span>;
}

const columns: ColDef<Row>[] = [
  { field: "id", headerName: "Dispute", flex: 2, minWidth: 190 },
  { field: "reason", headerName: "Reason", flex: 1 },
  { field: "amount", headerName: "Amount", flex: 1 },
  { field: "afterFees", headerName: "Amount after fees", flex: 1.5 },
  { field: "deadline", headerName: "Respond by", flex: 1 },
  // Decide by was folded into Days left (Kate, 7 Nov 2026): 2 days or fewer, or passed, shows in red.
  {
    field: "daysLeft",
    headerName: "Days left",
    flex: 1,
    // 1 or 2 days left: PayPal gold. Due today or passed: red.
    cellRenderer: (p: { value: number | null; data?: Row }) => {
      if (p.value === null || p.value === undefined) return <Quiet>{p.data?.recommendation === "RESOLVED" ? "Closed" : "Not set"}</Quiet>;
      if (p.value <= 0) return <Pill tone="bad">{p.value < 0 ? "Passed" : "Due today"}</Pill>;
      if (p.value <= 2) return <span style={{ background: "#ffc439", color: "#2c2e2f", fontWeight: 700, padding: "2px 8px", borderRadius: 999, fontSize: 12 }}>{p.value} {p.value === 1 ? "day" : "days"}: decide now</span>;
      return String(p.value);
    },
  },
  { field: "protection", headerName: "Seller protection", flex: 1, cellRenderer: (p: { value: string }) => <ProtectionBadge value={p.value} /> },
  { field: "status", headerName: "Status", flex: 2, minWidth: 240 },
  { field: "recommendation", headerName: CASE_READ_LABEL, flex: 2, cellRenderer: (p: { value: string }) => <ReadBadge value={p.value} /> },
  { field: "reasons", headerName: "Why", flex: 4, minWidth: 320, wrapText: true, autoHeight: true, cellStyle: { whiteSpace: "pre-line", lineHeight: "1.5", paddingTop: 8, paddingBottom: 8 } },
  // Next step, Address mismatch cause and Cause evidence moved to the case card (Kate, 7 Nov 2026).
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
  lastEvidence = v;
  window.dispatchEvent(new Event(EVIDENCE_EVENT));
}

// Lets the case path update as soon as a box is ticked, even when storage is blocked.
const EVIDENCE_EVENT = "seller-shield-evidence-changed";
let lastEvidence: Record<string, boolean[]> | null = null;

// Two colours only (Kate, 7 Nov 2026): PayPal gold for steps (filled when done, outlined when not done
// yet), PayPal navy for the current step, grey for later. Labels are dark text, the current one navy.
const STEP_STYLE: Record<StepState, { dot: React.CSSProperties; mark: string; note: string; noteColor: string }> = {
  done: { dot: { background: "#ffc439", color: "#2c2e2f", border: "2px solid #ffc439" }, mark: "✓", note: "Done", noteColor: "#2c2e2f" },
  now: { dot: { background: "#003087", color: "#ffffff", border: "2px solid #003087" }, mark: "", note: "Now", noteColor: "#003087" },
  open: { dot: { background: "#ffffff", color: "#2c2e2f", border: "2px solid #ffc439" }, mark: "", note: "Not done yet", noteColor: "#2c2e2f" },
  later: { dot: { background: "#ffffff", color: "#6b7280", border: "2px solid #c4cdd8" }, mark: "", note: "Later", noteColor: "#6b7280" },
};

// The whole path for one case, with the steps already done (Kate, 7 Nov 2026).
function CasePath({ row }: { row: Row }) {
  const [ticks, setTicks] = useState<boolean[]>([]);
  useEffect(() => {
    const read = () => setTicks((lastEvidence ?? readEvidence())[row.id] ?? []);
    read();
    window.addEventListener(EVIDENCE_EVENT, read);
    return () => window.removeEventListener(EVIDENCE_EVENT, read);
  }, [row.id]);
  const steps = casePath({
    reason: row.reason === REASON_LABEL.INR ? "INR" : row.reason === REASON_LABEL.SNAD ? "SNAD" : "OTHER",
    sellerMessaged: row.messages.some((m) => m.by === "SELLER") || row.sellerMessages.length > 0,
    trackingInPayPal: !!row.order?.status,
    evidenceTicked: EVIDENCE_ITEMS.every((_, i) => ticks[i]),
    waitingForBuyer: row.recommendation === "WAITING",
    closed: row.recommendation === "RESOLVED",
  });
  return (
    <section style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 18, marginBottom: 6 }}>Steps for this case</h2>
      <ol style={{ listStyle: "none" }}>
        {steps.map((s, i) => {
          const st = STEP_STYLE[s.state];
          const last = i === steps.length - 1;
          return (
            <li
              key={s.label}
              style={{
                display: "flex",
                gap: 12,
                padding: "6px 10px",
                borderRadius: 6,
                background: s.state === "now" ? "#eaf1fb" : "transparent",
                borderLeft: s.state === "now" ? "4px solid #003087" : "4px solid transparent",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ ...st.dot, width: 24, height: 24, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                  {st.mark || i + 1}
                </span>
                {!last && <span style={{ width: 2, flex: 1, minHeight: 10, marginTop: 2, background: s.state === "done" ? "#ffc439" : "#d6dee8" }} />}
              </div>
              <div style={{ fontSize: 14, paddingBottom: last ? 0 : 6 }}>
                <div style={{ fontWeight: s.state === "now" ? 700 : 600, color: s.state === "later" ? "#5b6472" : "#1f2a37" }}>
                  {s.label} <span style={{ color: st.noteColor, fontSize: 12, fontWeight: 700, marginLeft: 4 }}>{st.note}</span>
                </div>
                <div style={{ color: "#5b6472", fontSize: 12 }}>{s.source}</div>
              </div>
            </li>
          );
        })}
      </ol>
      {row.recommendation === "RESOLVED" && <p style={{ fontSize: 14, color: "#5b6472", marginTop: 4 }}>No action needed. PayPal has closed this case.</p>}
    </section>
  );
}

function EvidenceChecklist({ rows, showId = true }: { rows: Row[]; showId?: boolean }) {
  const [checked, setChecked] = useState<Record<string, boolean[]>>({});
  useEffect(() => setChecked(readEvidence()), []);
  if (rows.length === 0) return null;
  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Documents</h2>
      {rows.map((r) => {
        const boxes = checked[r.id] ?? EVIDENCE_ITEMS.map(() => false);
        return (
          <div key={r.id} style={{ border: "1px solid #ddd", borderRadius: 6, padding: 12, marginBottom: 8 }}>
            {showId && <strong>{r.id}</strong>}
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
            <div style={{ marginTop: 10, fontSize: 14, display: "grid", gap: 6 }}>
              {r.requested.length > 0 && (
                <div>
                  <strong>PayPal asked you for:</strong>{" "}
                  {r.requested.map((t) => (t === "PROOF_OF_FULFILLMENT" ? "proof of delivery (tracking)" : t.toLowerCase().replace(/_/g, " "))).join(", ")}
                </div>
              )}
              {r.buyerClaim && (
                <div>
                  <strong>Buyer&apos;s claim:</strong> {r.buyerClaim}
                </div>
              )}
              <div>
                <strong>From the buyer:</strong>{" "}
                {!r.buyerChecked && r.buyerFiles.length === 0 ? (
                  <span style={{ color: "#555" }}>Not checked yet. Run add-dispute for this case.</span>
                ) : r.buyerFiles.length > 0 ? (
                  r.buyerFiles.join(", ")
                ) : (
                  <span style={{ color: "#555" }}>No files from the buyer.</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

// Address mismatch cause and its evidence, moved from the table to the card (Kate, 7 Nov 2026).
// The evidence is saved when the box loses focus, so the case row does not recalculate on every key.
function CauseForm({ row, onChange }: { row: Row; onChange: (mismatch: "yes" | "no", cause: string, evidence: string) => void }) {
  const [text, setText] = useState(row.evidence ?? "");
  useEffect(() => setText(row.evidence ?? ""), [row.evidence]);
  const cause = row.cause === "seller" || row.cause === "buyer" ? row.cause : "unknown";
  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 18, marginBottom: 6 }}>Address mismatch</h2>
      <div style={{ display: "grid", gap: 8, fontSize: 14, maxWidth: 640 }}>
        {/* First a yes or no question; the cause and evidence open only on yes (Kate, 7 Nov 2026). */}
        <div role="radiogroup" aria-label="Was the parcel sent to a different address than the one on the order?">
          <strong>Was the parcel sent to a different address than the one on the order?</strong>
          <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
            {(["yes", "no"] as const).map((v) => (
              <label key={v}>
                <input type="radio" name={`mismatch-${row.id}`} checked={row.mismatch === v} onChange={() => onChange(v, cause, text)} /> {v === "yes" ? "Yes" : "No"}
              </label>
            ))}
          </div>
        </div>
        {row.mismatch === "yes" && (
          <>
            <label>
              <strong>Who caused it?</strong>{" "}
              <select value={cause} onChange={(e) => onChange("yes", e.target.value, text)} style={{ marginLeft: 6 }}>
                <option value="unknown">Not added yet</option>
                <option value="seller">Seller</option>
                <option value="buyer">Buyer</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <strong>Evidence</strong>
              <textarea
                rows={2}
                value={text}
                placeholder="For example: Buyer asked to change the delivery address after the order was placed."
                onChange={(e) => setText(e.target.value)}
                onBlur={() => text !== (row.evidence ?? "") && onChange("yes", cause, text)}
              />
            </label>
          </>
        )}
      </div>
    </section>
  );
}

function Quiet({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "#6b7280" }}>{children}</span>;
}

// The order behind the case and its tracking (from Orders and tracking), plus a link to PayPal for actions
// this app does not do, such as uploading files.
function OrderLine({ row }: { row: Row }) {
  const o = row.order;
  return (
    <div style={{ fontSize: 14, display: "grid", gap: 4, marginTop: 4 }}>
      <div>
        <strong>Order tracking:</strong>{" "}
        {!o ? (
          <span style={{ color: "#555" }}>Order not found in Orders and tracking.</span>
        ) : (
          <>
            Order {o.orderNo} · {o.tracking ? `${o.tracking}${o.carrier ? ` (${o.carrier})` : ""}` : "No tracking number"} ·{" "}
            <Pill tone={o.status ? "good" : "muted"}>{o.status ?? (o.tracking ? "Awaiting tracking" : "No tracking")}</Pill>
          </>
        )}
      </div>
      <div>
        <a href="https://www.sandbox.paypal.com/resolutioncenter" target="_blank" rel="noreferrer" style={{ color: "#0070ba", fontWeight: 600 }}>
          Open the PayPal Resolution Center (sandbox)
        </a>
      </div>
    </div>
  );
}

// The conversation with the buyer, from PayPal's record (Kate, 7 Nov 2026): whether the seller has written,
// when, and every message in time order. Needs add-dispute to have saved the messages.
function when(t: string | null): string {
  if (!t) return "time not given";
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? t : d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Conversation({ row }: { row: Row }) {
  const fromSeller = row.messages.filter((m) => m.by === "SELLER");
  const last = fromSeller[fromSeller.length - 1];
  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Messages</h2>
      {!row.buyerChecked ? (
        <p style={{ color: "#555", fontSize: 14, margin: 0 }}>Not checked yet. Run add-dispute for this case.</p>
      ) : (
        <>
          <p style={{ fontSize: 14, margin: "0 0 8px", fontWeight: 600 }}>
            {last ? `You last messaged the buyer on ${when(last.time)}.` : "You have not messaged the buyer yet."}
          </p>
          {row.messages.length === 0 && <p style={{ color: "#555", fontSize: 14, margin: 0 }}>No messages in this case.</p>}
          {row.messages.map((m, i) => (
            <div key={i} style={{ marginTop: 6, padding: 10, border: "1px solid #d6dee8", borderRadius: 6, background: m.by === "SELLER" ? "#eaf1fb" : "#f5f7fa", fontSize: 14 }}>
              <div style={{ fontSize: 12, color: "#4a5568", marginBottom: 4 }}>
                <strong>{m.by === "SELLER" ? "You" : m.by === "BUYER" ? "Buyer" : m.by}</strong> · {when(m.time)}
              </div>
              {m.text}
            </div>
          ))}
        </>
      )}
    </section>
  );
}

// Reply drafts and actions (PRD F3). The draft is a template from case facts. The seller edits it, then either
// copies it or approves a send. Sends go through /api/dispute-action to the PayPal sandbox only, and only after
// the seller presses an Approve button. Buttons are disabled when PayPal no longer accepts a response.
function ReplyDrafts({ rows, showId = true }: { rows: Row[]; showId?: boolean }) {
  const cases = rows.filter((r) => /^(FIGHT|REFUND|YOUR_CALL)/.test(r.recommendation));
  if (cases.length === 0) return null;
  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Reply and act</h2>
      {cases.map((r) => {
        const draft = templateReply({ recommendation: r.recommendation, amount: r.amount, orderRef: r.id });
        return <DraftCard key={r.id} row={r} initial={draft.draft} showId={showId} />;
      })}
    </section>
  );
}

const isDemo = (r: Row) => r.id.includes("-DEMO-");

type Pending = "message" | "refund" | null;
type Outcome = { ok: boolean; text: string };

function DraftCard({ row, initial, showId = true }: { row: Row; initial: string; showId?: boolean }) {
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
      {showId && <strong>{row.id}</strong>} <ReadBadge value={row.recommendation} />
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
        <button type="button" disabled={!row.canRespond || busy || isDemo(row)} onClick={() => setPending("message")}>
          Send to buyer...
        </button>
        <button type="button" disabled={!row.canRespond || busy || isDemo(row)} onClick={() => setPending("refund")}>
          Refund buyer...
        </button>
        {copied && <span style={{ color: "#555", fontSize: 14 }}>Copied.</span>}
      </div>
      {!row.canRespond && <p style={{ color: "#555", fontSize: 14, marginTop: 6 }}>Replies are closed in PayPal for this case.</p>}
      {row.canRespond && isDemo(row) && <p style={{ color: "#555", fontSize: 14, marginTop: 6 }}>Demo case: you can edit and copy the text. Sending and refunds are off because it is not in PayPal.</p>}
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

// Filters above the grid, in the same style as Orders and tracking. Strength and status chips each match any
// selected option; the deadline chip must also hold. Quick filter searches every column.
const FILTERS: { id: string; label: string; group: "strength" | "status" | "deadline" }[] = [
  { id: "strong", label: "Strong case", group: "strength" },
  { id: "mixed", label: "Mixed", group: "strength" },
  { id: "weak", label: "Weak case", group: "strength" },
  { id: "canRespond", label: "You can respond", group: "status" },
  { id: "closed", label: "Closed to response", group: "status" },
  { id: "waiting", label: "Waiting for the buyer", group: "status" },
  { id: "resolved", label: "Resolved by PayPal", group: "status" },
  { id: "due7", label: "Due in 7 days", group: "deadline" },
];

function matchesFilter(r: Row, id: string): boolean {
  if (id === "strong") return r.recommendation.startsWith("FIGHT");
  if (id === "weak") return r.recommendation.startsWith("REFUND");
  if (id === "mixed") return r.recommendation.startsWith("YOUR_CALL");
  if (id === "canRespond") return r.canRespond;
  if (id === "closed") return !r.canRespond && r.recommendation !== "RESOLVED";
  if (id === "resolved") return r.recommendation === "RESOLVED";
  if (id === "waiting") return r.recommendation === "WAITING";
  if (id === "due7") return r.daysLeft !== null && r.daysLeft <= 7;
  return true;
}

function passesFilters(r: Row, chips: string[]): boolean {
  for (const group of ["strength", "status"] as const) {
    const picked = FILTERS.filter((f) => f.group === group && chips.includes(f.id));
    if (picked.length > 0 && !picked.some((f) => matchesFilter(r, f.id))) return false;
  }
  if (chips.includes("due7") && !matchesFilter(r, "due7")) return false;
  return true;
}

// Sample cause and evidence for the demo screens (see ?sample=1 above). Shown only in memory.
const SAMPLE_OVERRIDES: Record<string, Override> = {
  "PP-R-GJM-10196233": {
    addressMismatchCause: "buyer",
    causeEvidence: "Buyer asked to change the delivery address after the order was placed.",
    decision: "Refund the buyer. We do not contest the claim.",
    buyerFiles: ["damaged_item_photo.jpg", "buyer_message_12_oct.pdf"],
  },
  "PP-R-SRZ-10196872": {
    addressMismatchCause: "seller",
    causeEvidence: "Carrier scan shows delivery to the address the buyer gave at checkout.",
    decision: "Fight. Tracking shows delivery to the address on the order.",
    buyerFiles: ["buyer_photo_of_empty_box.jpg"],
  },
};

export default function CaseScreen() {
  // Dates are computed after mount, so the server render does not depend on the clock.
  // Rows are built after mount (the clock). Seller cause and evidence typed on the screen are kept per case, for this session.
  const [now, setNow] = useState<Date | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  // /cases?sample=1 shows the sample cause and evidence in memory only. Nothing is saved, and /cases clears it.
  const [sampleMode, setSampleMode] = useState(false);
  useEffect(() => {
    setNow(new Date());
    if (new URLSearchParams(window.location.search).get("sample") === "1") {
      setSampleMode(true);
      setOverrides(SAMPLE_OVERRIDES);
      return;
    }
    try {
      setOverrides(JSON.parse(window.localStorage.getItem("seller-shield-overrides") ?? "{}"));
    } catch {
      // Storage blocked: start with no typed answers.
    }
  }, []);
  useEffect(() => {
    if (sampleMode) return;
    try {
      window.localStorage.setItem("seller-shield-overrides", JSON.stringify(overrides));
    } catch {
      // Storage blocked: answers last until the page reloads.
    }
  }, [overrides, sampleMode]);
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setFocusId(decodeURIComponent(window.location.hash.slice(1)) || null);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const rows: Row[] = useMemo(
    () =>
      now
        ? ([...(fixtures as object[]), ...(demoDisputes as object[])] as object[]).map((f) => {
            const id = toCase(f as never).disputeId;
            return toRow(f, now, overrides[id] ?? {});
          })
        : [],
    [now, overrides],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [quick, setQuick] = useState("");
  const gridRef = useRef<AgGridReact<Row>>(null);
  useEffect(() => {
    gridRef.current?.api?.onFilterChanged();
  }, [chips]);
  const toggleChip = (id: string) => setChips((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  const selectedRows = rows.filter((r) => selectedIds.includes(r.id));
  const setCause = (id: string, mismatch: "yes" | "no", cause: string, evidence: string) =>
    setOverrides((prev) => ({
      ...prev,
      // "No" clears the cause and evidence, so they do not change the case strength.
      [id]:
        mismatch === "no"
          ? { ...prev[id], addressMismatch: "no", addressMismatchCause: "unknown", causeEvidence: undefined }
          : { ...prev[id], addressMismatch: "yes", addressMismatchCause: cause as "seller" | "buyer" | "unknown", causeEvidence: evidence || undefined },
    }));
  return (
    <main style={{ padding: 20, width: "100%", maxWidth: 1500, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Dispute cases</h1>
      {sampleMode ? (
        <p role="status" style={{ margin: "0 0 8px", fontSize: 14 }}>
          Showing sample cause and evidence (not saved). <a href="/cases" style={{ color: "#0070ba", fontWeight: 600 }}>Clear sample</a>
        </p>
      ) : (
        <p style={{ margin: "0 0 8px", fontSize: 14 }}>
          <a href="/cases?sample=1" style={{ color: "#0070ba", fontWeight: 600 }}>Show sample cause and evidence</a>
        </p>
      )}
      {focusId && rows.length > 0 && !rows.some((r) => r.id === focusId) && <p role="status">Case {focusId} is not in the sandbox data.</p>}
      <div role="group" aria-label="Filter cases" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", margin: "12px 0" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#003087", marginRight: 4 }}>Filter cases:</span>
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => toggleChip(f.id)} aria-pressed={chips.includes(f.id)} style={{ padding: "5px 12px", borderRadius: 999, border: chips.includes(f.id) ? "1px solid #003087" : "1px solid #b8c7da", background: chips.includes(f.id) ? "#003087" : "#eef3f9", color: chips.includes(f.id) ? "#ffffff" : "#003087", fontSize: 13, fontWeight: 500 }}>
            {f.label}
          </button>
        ))}
        <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Quick filter" aria-label="Quick filter" style={{ padding: "5px 12px", minWidth: 200, borderRadius: 999, border: "1px solid #b8c7da", background: "#ffffff", fontSize: 13, color: "#003087" }} />
      </div>
      <div>
        <AgGridReact<Row>
          ref={gridRef}
          quickFilterText={quick}
          isExternalFilterPresent={() => chips.length > 0}
          doesExternalFilterPass={(node) => (node.data ? passesFilters(node.data, chips) : true)}
          key={focusId ?? "none"}
          theme={theme}
          rowData={rows}
          columnDefs={columns}
          rowSelection={rowSelection}
          onSelectionChanged={(e) => setSelectedIds(e.api.getSelectedRows().map((r) => r.id))}
          domLayout="autoHeight"
          defaultColDef={{ sortable: true, filter: true, filterParams: { maxNumConditions: 1 }, minWidth: 120, wrapHeaderText: true, autoHeaderHeight: true, wrapText: true, autoHeight: true, cellStyle: { lineHeight: "1.4", paddingTop: 8, paddingBottom: 8 } }}
          suppressColumnVirtualisation
          getRowId={(p) => p.data.id}
          getRowStyle={(p) => (p.data && p.data.id === focusId ? { background: "#fff4d6", fontWeight: 600 } : undefined)}
          onRowDataUpdated={(e) => {
            const node = focusId ? e.api.getRowNode(focusId) : undefined;
            if (node) e.api.flashCells({ rowNodes: [node] });
          }}
        />
      </div>
      {selectedRows.length === 0 ? (
        <p style={{ marginTop: 20, color: "#555", fontSize: 14 }}>Tick a case above to see its reply and actions.</p>
      ) : (
        // One card per ticked case, so Documents and Reply and act for each case stay together.
        selectedRows.map((r) => (
          <section key={r.id} style={{ marginTop: 24, border: "1px solid #b8c7da", borderLeft: "6px solid #0070ba", borderRadius: 8, background: "#ffffff", padding: 16 }}>
            <h2 style={{ fontSize: 24, margin: "0 0 12px" }}>Case {r.id}</h2>
            {/* Two columns (Kate, 7 Nov 2026): the step path on the left, everything else on the right. */}
            <div className="case-columns">
              <div className="case-steps">
                <CasePath row={r} />
              </div>
              <div>
                <OrderLine row={r} />
                <CauseForm row={r} onChange={(mismatch, cause, evidence) => setCause(r.id, mismatch, cause, evidence)} />
                <EvidenceChecklist rows={[r]} showId={false} />
                <Conversation row={r} />
                <ReplyDrafts rows={[r]} showId={false} />
              </div>
            </div>
          </section>
        ))
      )}
    </main>
  );
}

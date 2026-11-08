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
import { hasPlaceholder, templateReply } from "../../lib/reply.ts";
import { addressNextStep, caseAnswer, DECISIONS, draftBasis, normalizeDecision, routeFor, ruleReasons, type CardAnswers } from "../../lib/case-facts.ts";
import { evidenceItems } from "../../lib/evidence.ts";
import { protectionShort, protectionTone } from "../../lib/protection.ts";
import { trackingStatusText } from "../../lib/orders.ts";
import { sameAnswer } from "../../lib/eval-answers.ts";
import { readSentTracking, withSentTracking, type SentTracking } from "../../lib/sent-tracking.ts";
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
  reasonCode: string; // PayPal's reason code; the path and the card read this, not the label (M7)
  closedReason: "OVERDUE" | "NO_DUE_DATE" | "CLOSED" | null; // why replies are closed, when they are
  underReview: boolean;
  chargeback: boolean;
  orderRef: string; // what the buyer knows: the order number, else the case id (L4)
  amount: string;
  fee: string;
  afterFees: string;
  deadline: string;
  daysLeft: number | null;
  protection: string;
  status: string;
  canRespond: boolean;
  canMessage: boolean; // PayPal takes a message to the buyer only in the inquiry stage (S6)
  canEvidence: boolean; // PayPal takes evidence only while it waits for the seller (S6)
  sentAction: SentAction | null; // a send that succeeded from this browser, before the data is reloaded (S5)
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
  facts: Facts;
  fetchedAt: string | null; // when this case's PayPal data was saved by add-dispute (S4)
};

// Orders by number, to show the order behind each case. The dispute's seller transaction ID is the order number.
const ORDER_BY_NO = new Map(allOrders().map((o) => [o.orderNo, o]));
type OrderTracking = { orderNo: string; tracking: string | null; carrier: string | null; status: string | null; deliveredDate: string | null };

type CaseMessage = { by: string; time: string | null; text: string };

type SentAction = { action: "message" | "refund" | "evidence"; at: string };
type Override = CardAnswers & { decision?: string; buyerFiles?: string[]; sent?: SentAction };

// Recorded Opus answers (see scripts/live-check.ts --record). Shown without a live call.
// The deterministic rules (lib/proof.ts) override the recorded answer, as they do in recommend().
// The answer combines the demo answers, the order behind the case and the card's address question (lib/case-facts.ts, H1/H2).
function recommendationFor(id: string, c: ReturnType<typeof toCase>, e: ReturnType<typeof responseEligibility>, now: Date, answer: SellerAnswer): { recommendation: string; reasons: string; nextStep: string } {
  const rec = (recorded as Record<string, { recommendation: string; confidence: string; claims: { text: string }[]; answer?: SellerAnswer }>)[id];
  // A recording made from other facts is not shown as the AI's answer for these facts (second review S8).
  const otherFacts = !!rec?.answer && !sameAnswer(rec.answer, answer);
  const r = otherFacts ? undefined : rec;
  const underReview = c.status === "UNDER_REVIEW";
  const nextStep = c.lifeCycleStage === "CHARGEBACK"
    ? "1. The card issuer decides.\n2. Check the chargeback in the PayPal Resolution Center for what you can still send."
    : underReview
    ? "1. Wait for PayPal's decision.\n2. Do not refund while it is under review."
    : !e.canRespond && e.reason === "NO_DUE_DATE"
      ? "1. Check the response deadline in PayPal. PayPal sent no due date.\n2. If you can still reply, reply below. PayPal refuses anything it no longer accepts."
      : !e.canRespond && e.reason === "OVERDUE"
        ? "1. Ask the buyer, outside PayPal, to close the case if the parcel arrived.\n2. After PayPal decides, you can appeal with new evidence, such as proof of delivery (window not confirmed)."
      : !e.canRespond
        ? "1. Replies are closed. PayPal decides the rest.\n2. You may still be able to refund in the PayPal Resolution Center (not confirmed)."
        : answer.hasTracking === false
          ? "1. Add tracking.\n2. Reply before the due date."
          : answer.hasTracking === true
            ? // The INR wait note (Kate's case 1 rule) comes first; it was unreachable before (H3).
              addressNextStep(c.reason, answer, c.responseDueAt) ?? inrWaitNote(c, answer, now) ?? "1. Send the tracking as evidence (Send tracking as evidence below).\n2. Reply before the due date."
            : "1. Check the tracking for this order.\n2. Reply before the due date.";
  // Deadline passed: Weak (Kate, 8 Nov 2026, G08). Other closed cases: the seller decides.
  if (!e.canRespond && e.reason === "OVERDUE") {
    return {
      recommendation: "REFUND (high confidence, rule)",
      reasons: "The reply deadline has passed.\nSeller Protection needs a reply in time, so it no longer applies.\nPayPal usually decides for the buyer.",
      nextStep,
    };
  }
  const forced = e.canRespond ? forcedRecommendation(c, answer, now) : "YOUR_CALL";
  if (forced) {
    return {
      recommendation: `${forced} (${forced === "YOUR_CALL" ? "low" : "high"} confidence, rule)`,
      reasons: ruleReasons(c.reason, answer, forced).join("\n"),
      nextStep,
    };
  }
  // No recorded AI answer yet (a newly added dispute): the seller decides, and keeps every action (second review S3).
  if (!r) return { recommendation: "YOUR_CALL (not checked by the AI yet)", reasons: [otherFacts ? "The AI checked this case with other facts. It has not checked these yet." : "Not checked by the AI yet.", ...ruleReasons(c.reason, answer, "YOUR_CALL")].join("\n"), nextStep };
  return {
    recommendation: `${r.recommendation} (${r.confidence.toLowerCase()} confidence)`,
    reasons: r.claims.map((c) => c.text).join("\n"),
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

function toRow(raw: object, now: Date, override: Override = {}, sent: SentTracking = {}): Row {
  const fx = raw as Record<string, unknown>;
  const c = toCase(raw as never);
  const e = responseEligibility(c, now);
  const seeded = c.transactionId ? ORDER_BY_NO.get(c.transactionId) : undefined;
  const o = seeded ? withSentTracking(seeded, sent) : undefined;
  const order: OrderTracking | null = o ? { orderNo: o.orderNo, tracking: o.tracking ?? null, carrier: o.carrier ?? null, status: o.trackingStatus ?? null, deliveredDate: o.deliveredDate ?? null } : null;
  const answer = caseAnswer(sellerAnswers[c.disputeId] ?? {}, o ? { tracking: o.tracking, trackingStatus: o.trackingStatus, deliveredDate: o.deliveredDate } : null, override);
  const resolved = c.status !== null && RESOLVED_STATUSES.includes(c.status);
  // The seller has replied and PayPal is waiting for the buyer: nothing for the seller to do yet.
  const waitingForBuyer = c.status === "WAITING_FOR_BUYER_RESPONSE";
  // A refund or evidence sent from this browser closes the actions until PayPal's data is reloaded (S5).
  // A message to the buyer does not: the seller may still need to send evidence or refund.
  const live = !resolved && !waitingForBuyer;
  const sentFinal = live && (override.sent?.action === "refund" || override.sent?.action === "evidence");
  // No due date from PayPal: the case stays Mixed, but the buttons stay on, because PayPal refuses what it no longer
  // accepts and the screen shows that refusal (Kate, 8 Nov 2026, G11).
  const unknownDue = !e.canRespond && e.reason === "NO_DUE_DATE";
  const open = (e.canRespond || unknownDue) && live && !sentFinal;
  const rec = waitingForBuyer
    ? {
        recommendation: "WAITING",
        reasons: "You have replied. PayPal is waiting for the buyer.",
        nextStep: "1. Wait for the buyer's reply.\n2. PayPal decides if the buyer does not reply in time.",
      }
    : resolved
    ? {
        recommendation: "RESOLVED",
        reasons: c.status === "REFUNDED" ? "PayPal has already refunded the buyer." : `PayPal has closed this case (${c.status}).`,
        nextStep: "1. No action needed.\n2. Keep the case for your records.",
      }
    : recommendationFor(c.disputeId, c, e, now, answer);
  return {
    id: c.disputeId,
    reason: REASON_LABEL[c.reason] ?? c.reason,
    reasonCode: c.reason,
    closedReason: e.canRespond ? null : e.reason,
    underReview: c.status === "UNDER_REVIEW",
    chargeback: c.lifeCycleStage === "CHARGEBACK",
    orderRef: order ? `order ${order.orderNo}` : `case ${c.disputeId}`,
    amount: c.amount ? `${c.amount.value.toFixed(2)} ${c.amount.currency}` : "-",
    fee: feeLabel((feeFixtures as Record<string, FeeRecord>)[c.disputeId], "fee"),
    afterFees: feeLabel((feeFixtures as Record<string, FeeRecord>)[c.disputeId], "afterFees"),
    deadline: resolved ? "Closed" : c.responseDueAt ? c.responseDueAt.slice(0, 10) : "Not set",
    daysLeft: resolved ? null : daysUntilDue(c, now),
    protection: protectionLabel(c),
    canRespond: open,
    canMessage: open && c.lifeCycleStage === "INQUIRY",
    canEvidence: open && c.status === "WAITING_FOR_SELLER_RESPONSE",
    sentAction: live ? override.sent ?? null : null,
    // One word for a finished case on every part of the screen: "Closed by PayPal" (M9). No raw codes.
    status: sentFinal
      ? override.sent?.action === "refund" ? "Refund sent. Waiting for PayPal to close the case." : "Evidence sent. Waiting for PayPal."
      : resolved
      ? c.status === "REFUNDED" ? "Closed by PayPal (buyer refunded)" : "Closed by PayPal"
      : waitingForBuyer
        ? "Waiting for the buyer to reply"
      : e.canRespond
      ? "You can respond"
      : e.reason === "NO_DUE_DATE"
        ? "Due date unknown. Check it in PayPal before you reply."
        : c.status === "UNDER_REVIEW"
        ? "Under PayPal review. You can't respond in the dispute."
        : e.reason === "OVERDUE"
        ? "Reply deadline passed. PayPal decides without your reply."
        : `Not open for replies (PayPal status: ${c.status ?? "not given"}).`,
    ...(sentFinal
      ? { ...rec, nextStep: override.sent?.action === "refund" ? "1. Wait for PayPal to close the case.\n2. Reload the PayPal data to see the final status." : "1. Wait for PayPal to review the evidence.\n2. Reload the PayPal data to see the new status." }
      : rec),
    cause: override.addressMismatchCause ?? "unknown",
    evidence: override.causeEvidence ?? "",
    mismatch: override.addressMismatch ?? (override.causeEvidence || (override.addressMismatchCause && override.addressMismatchCause !== "unknown") ? "yes" : null),
    decision: normalizeDecision(override.decision),
    buyerFiles: override.buyerFiles ?? (Array.isArray(fx.buyer_files) ? (fx.buyer_files as string[]) : []),
    buyerClaim: typeof fx.buyer_claim === "string" ? fx.buyer_claim : null,
    requested: Array.isArray(fx.requested_from_seller) ? (fx.requested_from_seller as string[]) : [],
    buyerChecked: fx.buyer_checked === true,
    sellerMessages: Array.isArray(fx.seller_messages) ? (fx.seller_messages as string[]) : [],
    messages: Array.isArray(fx.messages) ? (fx.messages as CaseMessage[]) : [],
    order,
    fetchedAt: typeof fx.fetched_at === "string" ? fx.fetched_at : null,
    facts: { carrierDeliveryDate: override.carrierDeliveryDate, matchesListing: override.matchesListing, listingEvidence: override.listingEvidence, noticeDate: override.noticeDate, shipmentDate: override.shipmentDate },
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
  // Same labels and colours as the orders grid (lib/protection.ts). Long explanations stay in the tooltip.
  return <span title={value}><Pill tone={protectionTone(value) as Tone}>{protectionShort(value)}</Pill></span>;
}

const columns: ColDef<Row>[] = [
  { field: "id", headerName: "Dispute", flex: 2, minWidth: 190 },
  { field: "reason", headerName: "Reason", flex: 1 },
  { field: "amount", headerName: "Amount", flex: 1 },
  { field: "afterFees", headerName: "Amount after fees", flex: 1.5, // PayPal's merchant fees page: the fees paid to receive a payment are not returned on a refund (checked 7 Nov 2026, L9).
    headerTooltip: "What the sale brought you after PayPal's fee. If you refund, the buyer gets the full amount and PayPal keeps the fee." },
  { field: "deadline", headerName: "Respond by", flex: 1 },
  // Decide by was folded into Days left (Kate, 7 Nov 2026): 2 days or fewer, or passed, shows in red.
  {
    field: "daysLeft",
    headerName: "Days left",
    flex: 1,
    // 1 or 2 days left: PayPal gold. Due today or passed: red.
    cellRenderer: (p: { value: number | null; data?: Row }) => {
      if (p.value === null || p.value === undefined) return <Quiet>{p.data?.recommendation === "RESOLVED" ? "Closed" : "Not set"}</Quiet>;
      // Same cut-off as the reply buttons (L2): once PayPal stops taking replies, the deadline reads Passed.
      if (p.data?.closedReason === "OVERDUE") return <Pill tone="bad">Passed</Pill>;
      if (p.value <= 0) return <Pill tone="bad">{p.value < 0 ? "Passed" : "Due today"}</Pill>;
      if (p.value <= 2) return <span style={{ background: "#ffc439", color: "#2c2e2f", fontWeight: 700, padding: "2px 8px", borderRadius: 999, fontSize: 12 }}>{p.value} {p.value === 1 ? "day" : "days"}: decide now</span>;
      return String(p.value);
    },
  },
  { field: "protection", headerName: "Seller protection", flex: 1, cellRenderer: (p: { value: string }) => <ProtectionBadge value={p.value} /> },
  { field: "status", headerName: "Status", flex: 2, minWidth: 240 },
  { field: "recommendation", headerName: CASE_READ_LABEL, headerTooltip: "Based on the evidence on file. It is not a prediction of PayPal's decision.", flex: 2, cellRenderer: (p: { value: string }) => <ReadBadge value={p.value} /> },
  // Why: one plain line per reason, a small gap between them, no bullets (Kate, 7 Nov 2026).
  {
    field: "reasons",
    headerName: "Why",
    flex: 4,
    minWidth: 320,
    wrapText: true,
    autoHeight: true,
    cellStyle: { lineHeight: "1.45", paddingTop: 8, paddingBottom: 8 },
    cellRenderer: (p: { value: string }) => (
      <div style={{ display: "grid", gap: 4, whiteSpace: "normal" }}>
        {String(p.value ?? "").split("\n").filter(Boolean).map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    ),
  },
  // Next step, Address mismatch cause and Cause evidence moved to the case card (Kate, 7 Nov 2026).
  {
    field: "decision",
    headerName: "Seller decision",
    flex: 1.5,
    editable: true,
    cellEditor: "agSelectCellEditor",
    // The seller's decision is saved with the case and picks the step path and the reply draft (M10).
    cellEditorParams: { values: [...DECISIONS] },
    headerTooltip: "Your decision. It sets the steps and the reply draft for this case.",
  },
];

const theme = themeQuartz.withParams({ accentColor: "#0070ba", headerBackgroundColor: "#eaf1fb", headerTextColor: "#003087", borderRadius: 6 });

// Evidence to attach before a FIGHT (case 5 gap 2, Kate, 5 Nov 2026). The checkbox state is kept in
// this browser only, per case. If storage is blocked, the boxes still work for the session.
// The items depend on the dispute reason (lib/evidence.ts, M5).
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
// yet), a gold circle with a navy ring on a light blue band for the current step, grey for later. Labels are dark text, the current one navy.
const STEP_STYLE: Record<StepState, { dot: React.CSSProperties; mark: string; note: string; noteColor: string }> = {
  done: { dot: { background: "#ffc439", color: "#2c2e2f", border: "2px solid #ffc439" }, mark: "✓", note: "Done", noteColor: "#2c2e2f" },
  now: { dot: { background: "#ffc439", color: "#2c2e2f", border: "2px solid #003087" }, mark: "", note: "Now", noteColor: "#003087" },
  open: { dot: { background: "#ffffff", color: "#2c2e2f", border: "2px solid #ffc439" }, mark: "", note: "Not done yet", noteColor: "#2c2e2f" },
  later: { dot: { background: "#ffffff", color: "#6b7280", border: "2px solid #c4cdd8" }, mark: "", note: "Later", noteColor: "#6b7280" },
  // A step never done on a closed case (M8): grey, marked Skipped.
  skipped: { dot: { background: "#ffffff", color: "#6b7280", border: "2px dashed #c4cdd8" }, mark: "–", note: "Skipped", noteColor: "#6b7280" },
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
  const items = evidenceItems(row.reasonCode);
  const steps = casePath({
    reason: (["INR", "SNAD", "UNAUTHORISED", "OTHER"].includes(row.reasonCode) ? row.reasonCode : "UNKNOWN") as "INR",
    route: routeFor(normalizeDecision(row.decision), row.recommendation),
    // Not loaded from PayPal: say so rather than show the step as not done (L6).
    sellerMessaged: row.sentAction?.action === "message" ? true : row.buyerChecked ? row.messages.some((m) => m.by === "SELLER") || row.sellerMessages.length > 0 : null,
    trackingInPayPal: !!row.order?.status,
    evidenceTicked: items.every((_, i) => ticks[i]),
    waitingForBuyer: row.recommendation === "WAITING",
    underReview: row.underReview,
    chargeback: row.chargeback,
    overdue: row.closedReason === "OVERDUE" && row.recommendation !== "RESOLVED" && row.recommendation !== "WAITING",
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
                opacity: s.state === "skipped" ? 0.75 : 1,
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
                {/* The seller's checklist sits in the step it completes (Kate, 8 Nov 2026: no separate Documents section).
                    Item not received has none: the tracking is the evidence and the app sends it. */}
                {s.evidence && row.reasonCode !== "INR" && s.state !== "skipped" && (
                  <div style={{ marginTop: 4 }}>
                    {items.map((item, k) => (
                      <label key={item} style={{ display: "flex", gap: 6, alignItems: "baseline", fontSize: 13, marginTop: 2 }}>
                        <input
                          type="checkbox"
                          checked={!!ticks[k]}
                          onChange={(e) => {
                            const all = { ...(lastEvidence ?? readEvidence()) };
                            const next = items.map((_, n) => !!(all[row.id] ?? [])[n]);
                            next[k] = e.target.checked;
                            writeEvidence({ ...all, [row.id]: next });
                          }}
                        />
                        {item}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {row.recommendation === "RESOLVED" ? (
        <p style={{ fontSize: 14, color: "#5b6472", marginTop: 4 }}>No action needed. PayPal has closed this case.</p>
      ) : (
        // The next step, including the INR "refund one day before the due date" prompt (H3).
        <div style={{ fontSize: 14, marginTop: 8, padding: "8px 10px", background: "#f5f7fa", borderRadius: 6 }}>
          <strong>Next step</strong>
          {row.nextStep.split("\n").filter(Boolean).map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
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
          <div style={{ color: "#5b6472", fontSize: 13, marginTop: 2 }}>A parcel left at a locker or with a relative at the right address counts as the right address.</div>
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

// "Your facts" (second review S1, 8 Nov 2026): only the questions the rule for this reason needs.
// Saved with the address answer, and read by caseAnswer, so the case strength follows them.
type Facts = Pick<CardAnswers, "carrierDeliveryDate" | "matchesListing" | "listingEvidence" | "noticeDate" | "shipmentDate">;
function FactsForm({ row, onChange }: { row: Row; onChange: (patch: Facts) => void }) {
  const f = row.facts;
  const dateField = (key: "carrierDeliveryDate" | "noticeDate" | "shipmentDate", label: string, hint?: string) => (
    <label style={{ display: "grid", gap: 2 }}>
      <strong>{label}</strong>
      {hint && <span style={{ color: "#5b6472", fontSize: 13 }}>{hint}</span>}
      <input type="date" value={f[key] ?? ""} onChange={(e) => onChange({ [key]: e.target.value || undefined })} style={{ maxWidth: 180 }} />
    </label>
  );
  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 18, marginBottom: 6 }}>Your facts</h2>
      <div style={{ display: "grid", gap: 10, fontSize: 14, maxWidth: 640 }}>
        {row.reasonCode === "INR" &&
          (row.order?.tracking
            ? dateField("carrierDeliveryDate", "Delivery date on the carrier's tracking page", "Open the carrier's own tracking page. Leave it empty if the parcel is not delivered yet.")
            : <span style={{ color: "#555" }}>Add tracking in Orders and tracking first.</span>)}
        {row.reasonCode === "SNAD" && (
          <div role="radiogroup" aria-label="Does the item match the listing?">
            <strong>Does the item match the listing?</strong>
            <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
              {(["yes", "partly", "no"] as const).map((v) => (
                <label key={v}>
                  <input type="radio" name={`listing-${row.id}`} checked={f.matchesListing === v} onChange={() => onChange({ matchesListing: v })} /> {v === "yes" ? "Yes" : v === "partly" ? "Partly" : "No"}
                </label>
              ))}
            </div>
            {f.matchesListing === "yes" && (
              // "Matches" is the seller's view; it counts with evidence (Kate, 8 Nov 2026, G12).
              <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
                <strong>What shows it matches?</strong>
                <span style={{ color: "#5b6472", fontSize: 13 }}>PayPal decides on evidence from both sides. Without evidence the case stays your decision.</span>
                <textarea
                  key={f.listingEvidence ?? ""}
                  rows={2}
                  defaultValue={f.listingEvidence ?? ""}
                  placeholder="For example: listing text and photos taken before shipping show the same item."
                  onBlur={(e) => e.target.value.trim() !== (f.listingEvidence ?? "") && onChange({ listingEvidence: e.target.value.trim() || undefined })}
                />
              </label>
            )}
          </div>
        )}
        {row.reasonCode === "UNAUTHORISED" && (
          <>
            {dateField("noticeDate", "Date of PayPal's notice about this claim", "Proof of shipment is due 2 days after it.")}
            {dateField("shipmentDate", "Date you shipped the order")}
          </>
        )}
      </div>
    </section>
  );
}

// The case strength, the reasons and the seller's decision at the top of the card (PRD F3, L5).
function CaseSummary({ row }: { row: Row }) {
  return (
    <section style={{ marginBottom: 12, fontSize: 14 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <strong>{CASE_READ_LABEL}:</strong> <ReadBadge value={row.recommendation} />
        <span style={{ color: "#5b6472" }}>
          {row.amount} · {row.status} · Your decision: {row.decision}
        </span>
      </div>
      <div style={{ display: "grid", gap: 2, marginTop: 6 }}>
        {row.reasons.split("\n").filter((l) => l && l !== "-").map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
      <div style={{ color: "#5b6472", fontSize: 12, marginTop: 4 }}>
        Based on the evidence on file. It is not a prediction of PayPal&apos;s decision.
        {!isDemo(row) && (row.fetchedAt ? ` PayPal data from ${when(row.fetchedAt)}.` : " PayPal data: save time not recorded.")}
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
            <Pill tone={o.status ? "good" : "muted"}>{trackingStatusText({ tracking: o.tracking, trackingStatus: o.status })}</Pill>
            {o.deliveredDate && <> · delivery date on the order: {o.deliveredDate}</>}
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
        <p style={{ color: "#555", fontSize: 14, margin: 0 }}>Messages not loaded from PayPal for this case yet. Check the conversation in the PayPal Resolution Center.</p>
      ) : (
        <>
          <p style={{ fontSize: 14, margin: "0 0 8px", fontWeight: 600 }}>
            {last ? `You last messaged the buyer on ${when(last.time)}.` : "You have not messaged the buyer yet."}
          </p>
          {row.messages.length === 0 && <p style={{ color: "#555", fontSize: 14, margin: 0 }}>No messages in this case.</p>}
          {/* The buyer's files sit with the buyer's messages (Kate, 8 Nov 2026), shown only when there are some. */}
          {row.buyerFiles.length > 0 && (
            <p style={{ fontSize: 14, margin: "6px 0 0" }}>
              <strong>Files from the buyer:</strong> {row.buyerFiles.join(", ")}
            </p>
          )}
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
type OnSent = (id: string, action: SentAction["action"]) => void;
function ReplyDrafts({ rows, showId = true, onSent }: { rows: Row[]; showId?: boolean; onSent?: OnSent }) {
  // A case past its reply deadline gets no draft: replies are closed, and the next step says what is left (third review).
  const cases = rows.filter((r) => /^(FIGHT|REFUND|YOUR_CALL)/.test(r.recommendation) && r.closedReason !== "OVERDUE");
  if (cases.length === 0) return null;
  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Reply and act</h2>
      {cases.map((r) => {
        // The draft follows the seller's decision, else the recommendation (M10).
        const basis = draftBasis(normalizeDecision(r.decision), r.recommendation);
        const draft = templateReply({
          recommendation: basis,
          amount: r.amount,
          orderRef: r.orderRef,
          reason: r.reasonCode,
          tracking: r.order?.tracking ? { carrier: r.order.carrier, number: r.order.tracking } : null,
        });
        return <DraftCard key={`${r.id}-${basis}`} row={r} initial={draft.draft} refundDraft={basis.startsWith("REFUND")} showId={showId} onSent={onSent} />;
      })}
    </section>
  );
}

const isDemo = (r: Row) => r.id.includes("-DEMO-");

type Pending = "message" | "refund" | "evidence" | null;
type Outcome = { ok: boolean; text: string };

function DraftCard({ row, initial, refundDraft, showId = true, onSent }: { row: Row; initial: string; refundDraft: boolean; showId?: boolean; onSent?: OnSent }) {
  const [text, setText] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // A refund draft goes to the buyer with the refund, never on its own, so it can't say "refunding" without a refund (H6).
  const refundNote = refundDraft ? text : `Full refund of ${row.amount} accepted by the seller.`;
  const placeholder = hasPlaceholder(text);
  // Fight on an item-not-received case sends the order's tracking to PayPal as evidence (Kate, 7 Nov 2026, H5).
  const tracking = row.reasonCode === "INR" && row.order?.tracking ? { carrier: row.order.carrier ?? "Other", number: row.order.tracking } : null;
  const evidenceNote = `Tracking for ${row.orderRef}: ${tracking ? `${tracking.carrier} ${tracking.number}` : ""}.`;

  const send = async (action: "message" | "refund" | "evidence") => {
    setBusy(true);
    setOutcome(null);
    try {
      const res = await fetch("/api/dispute-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disputeId: row.id,
          action,
          text: action === "message" ? text : action === "refund" ? refundNote : evidenceNote,
          ...(action === "evidence" && tracking ? { tracking } : {}),
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; status?: number };
      if (data.ok) onSent?.(row.id, action);
      setOutcome(
        data.ok
          ? { ok: true, text: action === "message" ? `Sent to the buyer. PayPal sandbox replied HTTP ${data.status}.` : action === "refund" ? `Refund accepted. PayPal sandbox replied HTTP ${data.status}.` : `Tracking sent to PayPal as evidence. PayPal sandbox replied HTTP ${data.status}.` }
          : // PRD F3: on failure the case ends at "Approved, ready to submit", with the error, never a fake success.
            { ok: false, text: `Approved, ready to submit. Not sent: ${data.error ?? "PayPal did not accept it."}` },
      );
    } catch {
      setOutcome({ ok: false, text: "Approved, ready to submit. Not sent: the request to the server failed." });
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
        <button type="button" disabled={!row.canMessage || busy || isDemo(row) || placeholder || refundDraft} onClick={() => setPending("message")}>
          Send to buyer...
        </button>
        {tracking && (
          <button type="button" disabled={!row.canEvidence || busy || isDemo(row)} onClick={() => setPending("evidence")}>
            Send tracking as evidence...
          </button>
        )}
        <button type="button" disabled={!row.canRespond || busy || isDemo(row)} onClick={() => setPending("refund")}>
          Refund buyer...
        </button>
        {copied && <span style={{ color: "#555", fontSize: 14 }}>Copied.</span>}
      </div>
      {!row.canRespond && (
        <p style={{ color: "#555", fontSize: 14, marginTop: 6 }}>
          {row.sentAction && row.sentAction.action !== "message"
            ? `Sent from this browser on ${when(row.sentAction.at)}. The buttons stay off until the PayPal data is reloaded.`
            : "Replies are closed in PayPal for this case."}
        </p>
      )}
      {row.canRespond && !isDemo(row) && !row.canMessage && !refundDraft && <p style={{ color: "#555", fontSize: 14, marginTop: 6 }}>PayPal takes messages to the buyer only in the inquiry stage. Copy the text into the PayPal Resolution Center instead.</p>}
      {row.canRespond && !isDemo(row) && tracking && !row.canEvidence && <p style={{ color: "#555", fontSize: 14, marginTop: 6 }}>PayPal takes evidence only while it waits for your reply.</p>}
      {row.canRespond && row.sentAction?.action === "message" && <p style={{ color: "#555", fontSize: 14, marginTop: 6 }}>Message sent from this browser on {when(row.sentAction.at)}.</p>}
      {row.canRespond && row.closedReason === "NO_DUE_DATE" && <p style={{ color: "#7a4b00", fontSize: 14, marginTop: 6 }}>Deadline unknown: check it in PayPal first.</p>}
      {row.canRespond && placeholder && <p style={{ color: "#7a4b00", fontSize: 14, marginTop: 6 }}>Fill in or remove the part in [brackets] before sending.</p>}
      {row.canRespond && refundDraft && <p style={{ color: "#555", fontSize: 14, marginTop: 6 }}>This text goes to the buyer with the refund. Use Refund buyer to send both.</p>}
      {row.canRespond && !tracking && row.reasonCode === "INR" && <p style={{ color: "#555", fontSize: 14, marginTop: 6 }}>No tracking on the order yet. Add it in Orders and tracking, then send it here as evidence.</p>}
      {row.canRespond && row.reasonCode !== "INR" && <p style={{ color: "#555", fontSize: 14, marginTop: 6 }}>Upload photos or documents in the PayPal Resolution Center.</p>}
      {row.canRespond && isDemo(row) && <p style={{ color: "#555", fontSize: 14, marginTop: 6 }}>Demo case: you can edit and copy the text. Sending and refunds are off because it is not in PayPal.</p>}
      {pending && (
        <div role="dialog" aria-label="Approve before sending" style={{ marginTop: 8, padding: 10, borderRadius: 6, background: "#fff4d6", border: "1px solid #e8c56b" }}>
          <p style={{ margin: "0 0 6px" }}>
            {pending === "message"
              ? "Send the message above to the buyer through PayPal (sandbox)? The buyer will see it in the dispute."
              : pending === "evidence"
                ? `Send proof of fulfilment to PayPal (sandbox) for this case: carrier ${tracking?.carrier}, tracking number ${tracking?.number}, note "${evidenceNote}"?`
                : `Refund the buyer in full (${row.amount}) and close the dispute in PayPal (sandbox)? The buyer gets this note: "${refundNote}". This can't be undone.`}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="primary" disabled={busy} onClick={() => send(pending)}>
              {busy ? "Sending..." : pending === "refund" ? "Approve refund" : "Approve and send"}
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
  { id: "overdue", label: "Reply deadline passed", group: "status" },
  { id: "waiting", label: "Waiting for the buyer", group: "status" },
  { id: "resolved", label: "Closed by PayPal", group: "status" },
  { id: "due7", label: "Due in 7 days", group: "deadline" },
];

function matchesFilter(r: Row, id: string): boolean {
  if (id === "strong") return r.recommendation.startsWith("FIGHT");
  if (id === "weak") return r.recommendation.startsWith("REFUND");
  if (id === "mixed") return r.recommendation.startsWith("YOUR_CALL");
  if (id === "canRespond") return r.canRespond;
  if (id === "overdue") return r.closedReason === "OVERDUE" && r.recommendation !== "RESOLVED" && r.recommendation !== "WAITING";
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
// The sample goes on the demo case only, and agrees with the rules (M11): the buyer asked for a new address after
// ordering, so the mismatch is the buyer's and the case is the seller's call.
const SAMPLE_OVERRIDES: Record<string, Override> = {
  "PP-R-DEMO-25": {
    addressMismatch: "yes",
    addressMismatchCause: "buyer",
    causeEvidence: "Buyer asked to change the delivery address after the order was placed.",
    buyerFiles: ["buyer_message_5_nov.pdf"],
  },
};

function DataAge({ rows }: { rows: Row[] }) {
  const real = rows.filter((r) => !isDemo(r));
  const times = real.map((r) => r.fetchedAt).filter((t): t is string => !!t).sort();
  const missing = real.length - times.length;
  const text = times.length
    ? `PayPal data saved ${times[0] === times[times.length - 1] ? `on ${when(times[0])}` : `between ${when(times[0])} and ${when(times[times.length - 1])}`}.`
    : "This screen reads saved PayPal data, not PayPal live.";
  return (
    <p style={{ margin: "0 0 8px", fontSize: 13, color: "#5b6472" }}>
      {text}
      {missing > 0 && ` ${missing} ${missing === 1 ? "case has" : "cases have"} no save time.`} Run add-dispute for a case to refresh it.
    </p>
  );
}

export default function CaseScreen() {
  // Dates are computed after mount, so the server render does not depend on the clock.
  // Rows are built after mount (the clock). Seller cause and evidence typed on the screen are kept per case, for this session.
  const [now, setNow] = useState<Date | null>(null);
  // Tracking the seller sent from Orders and tracking in this browser (M3), read with the clock after mount.
  const [sent, setSent] = useState<SentTracking>({});
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  // /cases?sample=1 shows the sample cause and evidence in memory only. Nothing is saved, and /cases clears it.
  const [sampleMode, setSampleMode] = useState(false);
  // The sample link is a demo tool, shown only with /cases?demo=1 (second review S11).
  const [demoTools, setDemoTools] = useState(false);
  useEffect(() => {
    setNow(new Date());
    setDemoTools(new URLSearchParams(window.location.search).get("demo") === "1");
    setSent(readSentTracking());
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
            return toRow(f, now, overrides[id] ?? {}, sent);
          })
        : [],
    [now, overrides, sent],
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
        demoTools && (
          <p style={{ margin: "0 0 8px", fontSize: 14 }}>
            <a href="/cases?sample=1" style={{ color: "#0070ba", fontWeight: 600 }}>Show sample cause and evidence</a>
          </p>
        )
      )}
      {/* S4: this screen reads saved PayPal data, not PayPal live, so it says how old the data is. */}
      {rows.length > 0 && <DataAge rows={rows} />}
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
          onCellValueChanged={(e) => {
            if (e.colDef.field === "decision" && e.data) {
              const id = e.data.id;
              setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], decision: normalizeDecision(String(e.newValue)) } }));
            }
          }}
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
            <h2 style={{ fontSize: 24, margin: "0 0 4px" }}>Case {r.id}</h2>
            {/* S7: answers are not on a server yet. */}
            <p style={{ margin: "0 0 12px", color: "#5b6472", fontSize: 13 }}>Your answers and decision on this case are saved in this browser only.</p>
            {/* Two columns (Kate, 7 Nov 2026): the step path on the left, everything else on the right. */}
            <div className="case-columns">
              <div className="case-steps">
                <CasePath row={r} />
              </div>
              <div>
                <CaseSummary row={r} />
                <OrderLine row={r} />
                {["INR", "SNAD", "UNAUTHORISED"].includes(r.reasonCode) && r.recommendation !== "RESOLVED" && r.recommendation !== "WAITING" && r.closedReason !== "OVERDUE" && (
                  <FactsForm row={r} onChange={(patch) => setOverrides((prev) => ({ ...prev, [r.id]: { ...prev[r.id], ...patch } }))} />
                )}
                {/* Only where the delivery address matters and the case is still open (M6). */}
                {/* Not after the deadline: the answers can no longer change the case (third review). */}
                {(r.reasonCode === "INR" || r.reasonCode === "UNAUTHORISED") && r.recommendation !== "RESOLVED" && r.closedReason !== "OVERDUE" && (
                  <CauseForm row={r} onChange={(mismatch, cause, evidence) => setCause(r.id, mismatch, cause, evidence)} />
                )}
                <Conversation row={r} />
                <ReplyDrafts rows={[r]} showId={false} onSent={(id, action) => setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], sent: { action, at: new Date().toISOString() } } }))} />
              </div>
            </div>
          </section>
        ))
      )}
    </main>
  );
}

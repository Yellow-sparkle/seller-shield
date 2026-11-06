"use client";

// Slice step 7: the case screen. Lists the sandbox disputes in a grid.
// The grid shows facts only. Recommendations are not wired here yet.
import { useEffect, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type CellValueChangedEvent, type ColDef } from "ag-grid-community";
import { toCase, daysUntilDue } from "../lib/dispute.ts";
import { decideBy, protectionLabel, responseEligibility } from "../lib/rules.ts";
import { forcedRecommendation, inrWaitNote } from "../lib/proof.ts";
import { sellerAnswers, type SellerAnswer } from "../lib/answers.ts";
import { templateReply } from "../lib/reply.ts";
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

// Reply drafts (PRD F3). A template for now, from case facts only. Nothing is sent by this app:
// the seller copies the text into PayPal themselves, after reading and editing it.
function ReplyDrafts({ rows }: { rows: Row[] }) {
  const cases = rows.filter((r) => /^(FIGHT|REFUND|YOUR_CALL)/.test(r.recommendation));
  if (cases.length === 0) return null;
  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Reply drafts</h2>
      <p style={{ marginTop: 0, color: "#555", fontSize: 14 }}>
        Read and edit each draft, then copy it into PayPal yourself. This app doesn&apos;t send anything.
      </p>
      {cases.map((r) => {
        const draft = templateReply({ recommendation: r.recommendation, amount: r.amount, orderRef: r.id });
        return (
          <DraftCard key={r.id} id={r.id} initial={draft.draft} />
        );
      })}
    </section>
  );
}

function DraftCard({ id, initial }: { id: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 12, marginBottom: 8 }}>
      <strong>{id}</strong>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        style={{ display: "block", width: "100%", marginTop: 6, fontFamily: "inherit", fontSize: 14 }}
      />
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(text).then(() => setCopied(true), () => setCopied(false));
        }}
        style={{ marginTop: 6 }}
      >
        Copy (not sent)
      </button>
      {copied && <span style={{ marginLeft: 8, color: "#555", fontSize: 14 }}>Copied. Paste it into PayPal yourself.</span>}
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
    <main style={{ padding: 16, maxWidth: 1100, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Seller Shield: open disputes</h1>
      <p style={{ marginTop: 0, color: "#555" }}>Sandbox data, EUR. Held amounts are net of PayPal fees. AI recommendations are recorded from a live Claude run; the seller decides.</p>
      <div style={{ height: 260 }}>
        <AgGridReact<Row> theme={theme} rowData={rows} columnDefs={columns} domLayout="autoHeight" onCellValueChanged={onCellValueChanged} />
      </div>
      <EvidenceChecklist rows={rows} />
      <ReplyDrafts rows={rows} />
      <p style={{ color: "#555", fontSize: 14 }}>
        The seller decision is saved in this browser session only. Nothing is sent to PayPal yet.
      </p>
    </main>
  );
}

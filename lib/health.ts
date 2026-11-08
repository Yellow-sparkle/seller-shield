// Health scan numbers (PRD F1). Pure: takes disputes in PayPal's shape and the order rows, returns the three cards.
import type { Order } from "./orders.ts";

export type HealthDispute = {
  dispute_id?: string;
  status?: string;
  dispute_amount?: { currency_code?: string; value?: string };
  seller_response_due_date?: string;
};

// Disputes whose money is still at stake. WAITING_FOR_BUYER_RESPONSE counts too: the seller has replied, but the
// case is not decided.
const OPEN = new Set(["OPEN", "WAITING_FOR_SELLER_RESPONSE", "WAITING_FOR_BUYER_RESPONSE", "UNDER_REVIEW"]);

export type Health = {
  moneyAtRisk: { count: number; amount: number; currency: string };
  missingTracking: { count: number; total: number; currency: string };
  demoMissingTracking: number;
  nextDeadline: { date: string; daysLeft: number; disputeId?: string } | null;
  copy: string;
};

export function summarizeHealth(disputes: HealthDispute[], orders: Order[], now: Date = new Date()): Health {
  const open = disputes.filter((d) => d.status && OPEN.has(d.status));
  const amount = open.reduce((sum, d) => sum + (Number(d.dispute_amount?.value) || 0), 0);
  const currency = open.find((d) => d.dispute_amount?.currency_code)?.dispute_amount?.currency_code ?? "EUR";

  const missing = orders.filter((o) => o.source === "sandbox" && !o.tracking);
  const missingTotal = missing.reduce((sum, o) => sum + (Number(o.amount.value) || 0), 0);
  const demoMissing = orders.filter((o) => o.source === "demo" && !o.tracking).length;

  // Reply deadlines count only where PayPal waits for the seller.
  const dues = open
    .filter((d) => d.status === "OPEN" || d.status === "WAITING_FOR_SELLER_RESPONSE")
    .filter((d) => !!d.seller_response_due_date && !Number.isNaN(Date.parse(d.seller_response_due_date)))
    .map((d) => ({ at: Date.parse(d.seller_response_due_date as string), id: d.dispute_id }))
    // A deadline already passed is not the next one: it read "due in 0 days" while the cases screen said Passed (review, 8 Nov 2026).
    .filter((d) => d.at > now.getTime())
    .sort((a, b) => a.at - b.at);
  const nextDeadline = dues.length
    ? { date: new Date(dues[0].at).toISOString(), daysLeft: Math.max(0, Math.ceil((dues[0].at - now.getTime()) / 86_400_000)), disputeId: dues[0].id }
    : null;

  const parts = [`${open.length} open disputes, ${currency} ${amount.toFixed(2)} at risk.`];
  parts.push(nextDeadline ? `Nearest reply due in ${nextDeadline.daysLeft} days.` : "No reply deadline found.");
  parts.push(`${missing.length} sandbox orders missing tracking (${currency} ${missingTotal.toFixed(2)}).`);
  parts.push(`Demo data: ${demoMissing} seeded orders also lack tracking, not counted above.`);

  return {
    moneyAtRisk: { count: open.length, amount, currency },
    missingTracking: { count: missing.length, total: missingTotal, currency },
    demoMissingTracking: demoMissing,
    nextDeadline,
    copy: parts.join(" "),
  };
}

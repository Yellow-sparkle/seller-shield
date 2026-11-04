// Slice step 2: turn a PayPal dispute detail response into one Case object.
// Pure functions only, no network calls. The field names follow the PayPal
// Disputes API v1 detail response. Anything missing becomes null, never a guess.

export type CaseReason = "INR" | "SNAD" | "UNAUTHORISED" | "OTHER" | "UNKNOWN";

export type Case = {
  disputeId: string;
  reason: CaseReason;
  status: string | null;
  amount: { currency: string; value: number } | null;
  transactionId: string | null;
  openedAt: string | null;
  responseDueAt: string | null;
  sellerProtectionEligible: boolean | null;
  holdAmount: { currency: string; value: number } | null;
};

type Money = { currency_code?: string; value?: string };

type RawDispute = {
  dispute_id?: string;
  reason?: string;
  status?: string;
  dispute_amount?: Money;
  disputed_transactions?: { seller_transaction_id?: string }[];
  create_time?: string;
  seller_response_due_date?: string;
  seller_protection?: { status?: string };
  fund_movements?: { type?: string; amount?: Money }[];
};

const KNOWN_REASONS: CaseReason[] = ["INR", "SNAD", "UNAUTHORISED", "OTHER"];

function toMoney(m: Money | undefined): { currency: string; value: number } | null {
  if (!m || !m.currency_code || m.value === undefined) return null;
  const value = Number(m.value);
  return Number.isFinite(value) ? { currency: m.currency_code, value } : null;
}

export function toCase(raw: RawDispute): Case {
  const reason = (KNOWN_REASONS as string[]).includes(raw.reason ?? "")
    ? (raw.reason as CaseReason)
    : "UNKNOWN";

  // Money held by PayPal for this dispute. Only the HOLD_PLACED movement counts.
  const hold = raw.fund_movements?.find((f) => f.type === "HOLD_PLACED");

  return {
    disputeId: raw.dispute_id ?? "",
    reason,
    status: raw.status ?? null,
    amount: toMoney(raw.dispute_amount),
    transactionId: raw.disputed_transactions?.[0]?.seller_transaction_id ?? null,
    openedAt: raw.create_time ?? null,
    responseDueAt: raw.seller_response_due_date ?? null,
    sellerProtectionEligible:
      raw.seller_protection?.status === undefined
        ? null
        : raw.seller_protection.status !== "NOT_ELIGIBLE",
    holdAmount: toMoney(hold?.amount),
  };
}

// Days left to answer, or null if the due date is unknown. Negative means overdue.
export function daysUntilDue(c: Case, now: Date = new Date()): number | null {
  if (!c.responseDueAt) return null;
  const due = Date.parse(c.responseDueAt);
  if (Number.isNaN(due)) return null;
  return Math.ceil((due - now.getTime()) / 86_400_000);
}

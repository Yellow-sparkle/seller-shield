// Turns a full PayPal dispute detail response (GET /v1/customer/disputes/{id}) into the short shape kept in
// lib/fixtures/sandbox-disputes.json. Pure. Used by scripts/add-dispute.ts.
type Money = { currency_code?: string; value?: string };
type FullDispute = {
  dispute_id?: string;
  reason?: string;
  status?: string;
  dispute_amount?: Money;
  disputed_transactions?: { seller_transaction_id?: string; seller_protection_eligible?: boolean }[];
  create_time?: string;
  seller_response_due_date?: string;
  dispute_life_cycle_stage?: string;
  fund_movements?: { type?: string; amount?: Money }[];
  evidences?: { evidence_type?: string; source?: string; notes?: string; documents?: { name?: string }[] }[];
  messages?: { posted_by?: string; content?: string }[];
};

const REASONS: Record<string, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "INR",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "SNAD",
  UNAUTHORISED: "UNAUTHORISED",
};

export function toFixture(d: FullDispute): Record<string, unknown> {
  if (!d.dispute_id) throw new Error("PayPal's reply has no dispute_id");
  const tx = d.disputed_transactions?.[0];
  const fixture: Record<string, unknown> = {
    dispute_id: d.dispute_id,
    reason: d.reason ? (REASONS[d.reason] ?? "OTHER") : "UNKNOWN",
    status: d.status,
    dispute_amount: d.dispute_amount,
    disputed_transactions: [{ seller_transaction_id: tx?.seller_transaction_id }],
    create_time: d.create_time,
    seller_response_due_date: d.seller_response_due_date,
    dispute_life_cycle_stage: d.dispute_life_cycle_stage,
    fund_movements: (d.fund_movements ?? []).map((f) => ({ type: f.type, amount: f.amount })),
  };
  // What the buyer said and sent, and what PayPal asked the seller for. Only these fields are kept.
  const evidences = d.evidences ?? [];
  const buyerClaim = evidences.find((e) => e.evidence_type === "CREATE")?.notes ?? d.messages?.find((m) => m.posted_by === "BUYER")?.content ?? null;
  fixture.buyer_claim = buyerClaim;
  fixture.requested_from_seller = evidences.filter((e) => e.source === "REQUESTED_FROM_SELLER").map((e) => e.evidence_type ?? "UNKNOWN");
  fixture.buyer_files = evidences
    .filter((e) => e.source !== "REQUESTED_FROM_SELLER")
    .flatMap((e) => (e.documents ?? []).map((doc) => doc.name ?? "(no name)"));
  fixture.buyer_checked = true;
  if (typeof tx?.seller_protection_eligible === "boolean") {
    fixture.seller_protection = { status: tx.seller_protection_eligible ? "ELIGIBLE" : "NOT_ELIGIBLE" };
  }
  return fixture;
}

// Adds the dispute to the list, or replaces the entry with the same ID.
export function upsertFixture(list: Record<string, unknown>[], f: Record<string, unknown>): Record<string, unknown>[] {
  const i = list.findIndex((x) => x.dispute_id === f.dispute_id);
  return i === -1 ? [...list, f] : list.map((x, j) => (j === i ? f : x));
}

// Order list for the tracking fixer (PRD F2). Pure logic only: filters, row labels and the bulk plan.
// Nothing here calls PayPal. The bulk send happens only after the seller confirms the plan.

export type Protection = "PROTECTED" | "NOT_PROTECTED" | "UNKNOWN";

export type Order = {
  orderNo: string;
  date: string;
  buyer: string;
  amount: { currency: string; value: string };
  carrier?: string;
  tracking?: string;
  trackingStatus?: string;
  protection: Protection;
  held: boolean;
  disputeId?: string;
  // "sandbox" rows come from PayPal sandbox data. "demo" rows are seeded for the list and can't be sent.
  source: "sandbox" | "demo";
};

export type FilterChip = "missingTracking" | "held" | "notProtected" | "hasDispute";

export function matchesChip(o: Order, chip: FilterChip): boolean {
  switch (chip) {
    case "missingTracking":
      return !o.tracking;
    case "held":
      return o.held;
    case "notProtected":
      return o.protection === "NOT_PROTECTED";
    case "hasDispute":
      return !!o.disputeId;
  }
}

// Rows that pass every chip that is switched on (AND across chips).
export function filterOrders(orders: Order[], chips: FilterChip[]): Order[] {
  return orders.filter((o) => chips.every((c) => matchesChip(o, c)));
}

// Protection label: "Protected" only when PayPal's own status says so.
export function protectionLabel(o: Order): string {
  if (o.protection === "PROTECTED") return "Protected";
  if (o.protection === "NOT_PROTECTED") return "Not protected";
  return "Unknown";
}

// Only sandbox rows can be selected for the bulk send. Demo rows are labelled and skipped.
export function isSelectable(o: Order): boolean {
  return o.source === "sandbox";
}

export type BulkLine = { orderNo: string; carrier: string; tracking: string };
export type BulkSkip = { orderNo: string; reason: string };
export type BulkPlan = { lines: BulkLine[]; skipped: BulkSkip[] };

// Builds the review list shown before the one confirm. Sends nothing.
export function planBulk(selected: Order[], input: Record<string, { carrier: string; tracking: string }>): BulkPlan {
  const lines: BulkLine[] = [];
  const skipped: BulkSkip[] = [];
  for (const o of selected) {
    if (!isSelectable(o)) {
      skipped.push({ orderNo: o.orderNo, reason: "Demo data, not in sandbox" });
      continue;
    }
    const entry = input[o.orderNo];
    const carrier = entry?.carrier.trim() ?? "";
    const tracking = entry?.tracking.trim() ?? "";
    if (!carrier) {
      skipped.push({ orderNo: o.orderNo, reason: "No carrier chosen" });
      continue;
    }
    if (!tracking) {
      skipped.push({ orderNo: o.orderNo, reason: "No tracking number" });
      continue;
    }
    lines.push({ orderNo: o.orderNo, carrier, tracking });
  }
  return { lines, skipped };
}

// Row label after a batch result. A failed row never shows a success label.
export function rowResultLabel(result: { ok: true } | { ok: false; error: string }): string {
  return result.ok ? "Tracking added" : `Failed: ${result.error}`;
}

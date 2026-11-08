// Order list for the tracking fixer (PRD F2). Pure logic only: filters, row labels and the bulk plan.
// Nothing here calls PayPal. The bulk send happens only after the seller confirms the plan.

import { protectionText, type ProtectionStatus } from "./protection.ts";

// PayPal's seller protection status for the order (see lib/protection.ts).
export type Protection = ProtectionStatus;

export type Order = {
  orderNo: string;
  date: string;
  buyer: string;
  amount: { currency: string; value: string };
  carrier?: string;
  tracking?: string;
  trackingStatus?: string;
  deliveredDate?: string; // carrier delivery date, when the carrier shows one
  protection: Protection;
  held: boolean;
  disputeId?: string;
  disputeReason?: string; // the dispute's PayPal reason (INR, SNAD, ...), so Orders and Cases show the same protection
  // "sandbox" rows come from PayPal sandbox data. "demo" rows are seeded for the list and can't be sent.
  source: "sandbox" | "demo";
};

export type FilterChip = "missingTracking" | "held" | "notProtected" | "hasDispute" | "sandbox" | "last30" | "awaitingTracking";

const DAY_MS = 86400000;

export function matchesChip(o: Order, chip: FilterChip, now?: Date): boolean {
  switch (chip) {
    case "missingTracking":
      return !o.tracking;
    case "held":
      return o.held;
    case "notProtected":
      // Not eligible, or a not-as-described dispute that Seller Protection does not cover.
      return o.protection === "NOT_ELIGIBLE" || o.disputeReason === "SNAD";
    case "hasDispute":
      return !!o.disputeId;
    case "sandbox":
      return o.source === "sandbox";
    case "awaitingTracking":
      // A tracking number exists but PayPal has no tracking status yet: ready to send.
      return !!o.tracking && !o.trackingStatus;
    case "last30": {
      // Orders dated in the last 30 days, counted in whole days from today (UTC), so the 30th day counts.
      const t = Date.parse(o.date);
      // The clock is read only when this chip is on, so the page prerender never calls new Date().
      const at = now ?? new Date();
      const today = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
      return Number.isFinite(t) && t >= today - 30 * DAY_MS;
    }
  }
}

// Rows that pass every chip that is switched on (AND across chips).
export function filterOrders(orders: Order[], chips: FilterChip[], now?: Date): Order[] {
  return orders.filter((o) => chips.every((c) => matchesChip(o, c, now)));
}

// Protection label, the same words as the case screen (lib/protection.ts).
export function protectionLabel(o: Order): string {
  return protectionText(o.protection, o.disputeReason);
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

const CHIP_IDS: FilterChip[] = ["missingTracking", "held", "notProtected", "hasDispute", "sandbox", "last30", "awaitingTracking"];

// Chips from a link such as /orders?chip=missingTracking (used by the health scan cards).
// Unknown values are ignored.
export function chipsFromQuery(search: string): FilterChip[] {
  const params = new URLSearchParams(search);
  return params.getAll("chip").filter((c): c is FilterChip => (CHIP_IDS as string[]).includes(c));
}

export type GridSummary = { orders: number; total: number; currency: string; missingTracking: number; held: number; disputes: number; sandbox: number };

// Totals for the pinned summary row: always the rows currently shown.
export function gridSummary(orders: Order[]): GridSummary {
  return {
    orders: orders.length,
    total: orders.reduce((s, o) => s + (Number(o.amount.value) || 0), 0),
    currency: orders[0]?.amount.currency ?? "EUR",
    missingTracking: orders.filter((o) => !o.tracking).length,
    held: orders.filter((o) => o.held).length,
    disputes: orders.filter((o) => !!o.disputeId).length,
    sandbox: orders.filter((o) => o.source === "sandbox").length,
  };
}

// Where a dispute flag leads. Every order with a dispute id has a case on the case screen
// (the seed only flags demo orders that have a demo case).
export function caseLink(o: Order): string | null {
  return o.disputeId ? `/cases#${encodeURIComponent(o.disputeId)}` : null;
}

// Tracking status text for the grid and the case card: PayPal's status when it has one,
// "Not in PayPal yet" when we hold a number PayPal has not got, "No tracking" when there is no number.
export function trackingStatusText(o: { tracking?: string | null; trackingStatus?: string | null }): string {
  // PayPal's codes (SHIPPED, DELIVERED) read as words, the way the reasons write them (review, 8 Nov 2026).
  if (o.trackingStatus) return o.trackingStatus.charAt(0) + o.trackingStatus.slice(1).toLowerCase().replace(/_/g, " ");
  return o.tracking ? "Not in PayPal yet" : "No tracking";
}

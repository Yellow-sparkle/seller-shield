// Order rows for the tracking fixer (PRD F2).
// Three rows are real PayPal sandbox orders, taken from the refunded dispute records (seller transaction ids).
// The rest are seeded demo rows, labelled "Demo data" in the grid and never sent to PayPal.
import type { Order } from "./orders.ts";

const CARRIERS = ["DHL", "PostNL", "DPD", "UPS"];

export function demoOrders(count = 200): Order[] {
  const rows: Order[] = [];
  for (let i = 1; i <= count; i++) {
    const day = String(((i - 1) % 28) + 1).padStart(2, "0");
    const hasTracking = i % 4 !== 0;
    rows.push({
      orderNo: `DEMO-${1000 + i}`,
      date: `2026-10-${day}`,
      buyer: `Demo buyer ${i}`,
      amount: { currency: "EUR", value: (15 + ((i * 37) % 120)).toFixed(2) },
      carrier: hasTracking ? CARRIERS[i % CARRIERS.length] : undefined,
      tracking: hasTracking ? `DEMO${String(100000 + i * 7)}` : undefined,
      trackingStatus: hasTracking ? (i % 5 === 0 ? "DELIVERED" : "SHIPPED") : undefined,
      protection: i % 3 === 0 ? "ELIGIBLE" : i % 3 === 1 ? "NOT_ELIGIBLE" : "UNKNOWN",
      held: i % 7 === 0,
      source: "demo",
    });
  }
  // DEMO-1025 is the order behind the demo case PP-R-DEMO-25 (lib/fixtures/demo-disputes.json). It matches the case:
  // 45.00 EUR, eligible, 43.24 held, delivered (review finding M1). It is the only demo order with a dispute, because
  // it is the only demo dispute with a case (finding M2).
  const demoCase = rows[24];
  if (demoCase && demoCase.orderNo === "DEMO-1025") {
    Object.assign(demoCase, {
      amount: { currency: "EUR", value: "45.00" },
      carrier: "PostNL",
      tracking: "DEMO100175",
      trackingStatus: "DELIVERED",
      deliveredDate: "2026-10-29",
      protection: "ELIGIBLE",
      held: true,
      disputeId: "PP-R-DEMO-25",
      disputeReason: "INR",
    } satisfies Partial<Order>);
  }
  return rows;
}

// Real sandbox orders. Amounts are the dispute amounts (the order total is not in the repo).
// Tracking matches the test sends that PayPal accepted in the sandbox (see commit history). Those sends use
// status SHIPPED (lib/tracking-api.ts), so PayPal's tracking status for them is SHIPPED (review finding M3;
// not re-read live).
export const sandboxOrders: Order[] = [
  {
    orderNo: "35W222794X4866508",
    carrier: "DHL",
    tracking: "TEST1235",
    trackingStatus: "SHIPPED",
    date: "2026-11-03",
    buyer: "Sandbox buyer",
    amount: { currency: "EUR", value: "60.00" },
    protection: "ELIGIBLE",
    held: false,
    disputeId: "PP-R-GJM-10196233",
    disputeReason: "INR",
    source: "sandbox",
  },
  {
    orderNo: "7RX812769J8875301",
    carrier: "DHL",
    tracking: "TEST1234567",
    trackingStatus: "SHIPPED",
    date: "2026-11-03",
    buyer: "Sandbox buyer",
    amount: { currency: "EUR", value: "45.00" },
    protection: "ELIGIBLE",
    held: false,
    disputeId: "PP-R-FGC-10196238",
    disputeReason: "INR",
    source: "sandbox",
  },
  {
    orderNo: "11X88937YC2460212",
    carrier: "DPD",
    tracking: "TEST1233",
    trackingStatus: "SHIPPED",
    date: "2026-11-03",
    buyer: "Sandbox buyer",
    amount: { currency: "EUR", value: "85.00" },
    protection: "ELIGIBLE",
    held: false,
    disputeId: "PP-R-NVP-10196239",
    disputeReason: "SNAD",
    source: "sandbox",
  },
  // The order behind the open INR dispute PP-R-SRZ-10196872 (review finding H4). No tracking yet: adding it here is
  // the fix for that dispute. Amount is the dispute amount. The dispute's fund movement is a DEBIT, not a hold: PayPal's
  // Dispute Detail report separates "Debit" (money taken from the balance) from "On temporary hold" (L10, checked
  // 7 Nov 2026 against the report spec, not the API enum). So nothing is held; the 23.80 has already left the balance.
  {
    orderNo: "1P279948DJ181945Y",
    date: "2026-11-06",
    buyer: "Sandbox buyer",
    amount: { currency: "EUR", value: "25.00" },
    protection: "ELIGIBLE",
    held: false,
    disputeId: "PP-R-SRZ-10196872",
    disputeReason: "INR",
    source: "sandbox",
  },
];

export function allOrders(): Order[] {
  return [...sandboxOrders, ...demoOrders()];
}

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
      trackingStatus: hasTracking ? (i % 5 === 0 ? "DELIVERED" : "IN_TRANSIT") : undefined,
      protection: i % 3 === 0 ? "PROTECTED" : i % 3 === 1 ? "NOT_PROTECTED" : "UNKNOWN",
      held: i % 7 === 0,
      disputeId: i % 25 === 0 ? `PP-R-DEMO-${i}` : undefined,
      source: "demo",
    });
  }
  return rows;
}

// Real sandbox orders. Amounts are the dispute amounts (the order total is not in the repo).
export const sandboxOrders: Order[] = [
  {
    orderNo: "35W222794X4866508",
    date: "2026-11-03",
    buyer: "Sandbox buyer",
    amount: { currency: "EUR", value: "60.00" },
    protection: "ELIGIBLE",
    held: false,
    disputeId: "PP-R-GJM-10196233",
    source: "sandbox",
  },
  {
    orderNo: "7RX812769J8875301",
    date: "2026-11-03",
    buyer: "Sandbox buyer",
    amount: { currency: "EUR", value: "45.00" },
    protection: "ELIGIBLE",
    held: false,
    disputeId: "PP-R-FGC-10196238",
    source: "sandbox",
  },
  {
    orderNo: "11X88937YC2460212",
    date: "2026-11-03",
    buyer: "Sandbox buyer",
    amount: { currency: "EUR", value: "85.00" },
    protection: "ELIGIBLE",
    held: false,
    disputeId: "PP-R-NVP-10196239",
    source: "sandbox",
  },
];

export function allOrders(): Order[] {
  return [...sandboxOrders, ...demoOrders()];
}

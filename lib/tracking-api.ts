// Builds the PayPal Shipment Tracking request body (POST /v1/shipping/trackers-batch, sandbox).
// Spec: developer.paypal.com/api/tracking/v1. Pure: no network here.
import type { BulkLine } from "./orders.ts";

export const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
export const TRACKERS_BATCH_PATH = "/v1/shipping/trackers-batch";

export type Tracker = {
  transaction_id: string;
  status: "SHIPPED";
  tracking_number: string;
  carrier: string;
  carrier_name_other?: string;
  notify_buyer: boolean;
};

// PayPal carrier codes, checked against developer.paypal.com/track-orders/carriers (Nov 2026).
// Only exact matches are mapped. Anything else is sent as OTHER with the name written out.
const CARRIER_CODES: Record<string, string> = {
  DHL: "DHL",
  UPS: "UPS",
  DPD: "DPD",
};

export function carrierCode(name: string): { carrier: string; carrier_name_other?: string } {
  const code = CARRIER_CODES[name.trim().toUpperCase()];
  if (code) return { carrier: code };
  return { carrier: "OTHER", carrier_name_other: name.trim().slice(0, 64) };
}

export function buildTrackers(lines: BulkLine[]): { trackers: Tracker[] } {
  if (lines.length === 0) throw new Error("No tracking lines to send");
  if (lines.length > 20) throw new Error("PayPal accepts at most 20 trackers per request");
  const trackers: Tracker[] = lines.map((l) => {
    if (!/^[A-Za-z0-9]{1,50}$/.test(l.orderNo)) throw new Error(`Transaction id not valid: ${l.orderNo}`);
    if (!/^[\x20-\x7E]{1,64}$/.test(l.tracking)) throw new Error(`Tracking number not valid ASCII: ${l.orderNo}`);
    return {
      transaction_id: l.orderNo,
      status: "SHIPPED",
      tracking_number: l.tracking,
      ...carrierCode(l.carrier),
      notify_buyer: false,
    };
  });
  return { trackers };
}

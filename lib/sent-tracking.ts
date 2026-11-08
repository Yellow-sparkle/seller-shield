// Tracking the seller sent to PayPal from Orders and tracking, kept in this browser so the grid and the case card
// show it after a confirmed send. PayPal stays the source of truth; this is a local note.
export type SentTracking = Record<string, { carrier: string; tracking: string; at: string }>;
export const SENT_TRACKING_KEY = "seller-shield-sent-tracking";

export function readSentTracking(): SentTracking {
  try {
    return JSON.parse(window.localStorage.getItem(SENT_TRACKING_KEY) ?? "{}") as SentTracking;
  } catch {
    return {};
  }
}

export function recordSentTracking(lines: { orderNo: string; carrier: string; tracking: string }[], at: Date = new Date()): SentTracking {
  const next = { ...readSentTracking() };
  for (const l of lines) next[l.orderNo] = { carrier: l.carrier, tracking: l.tracking, at: at.toISOString() };
  try {
    window.localStorage.setItem(SENT_TRACKING_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the grid still updates for this visit.
  }
  return next;
}

// An order with tracking PayPal confirmed from this browser. The status is SHIPPED, the status the send uses.
export function withSentTracking<T extends { orderNo: string; tracking?: string; carrier?: string; trackingStatus?: string }>(o: T, sent: SentTracking): T {
  const s = sent[o.orderNo];
  if (!s || o.trackingStatus) return o;
  return { ...o, tracking: s.tracking, carrier: s.carrier, trackingStatus: "SHIPPED" };
}

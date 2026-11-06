// Logic behind /api/scan and /api/tracking, kept out of the route files so it can be tested
// with a fake fetch. Sandbox only. Each function returns the HTTP status and JSON body to send.
import { summarizeHealth, type HealthDispute } from "./health.ts";
import { allOrders } from "./orders-seed.ts";
import type { BulkLine } from "./orders.ts";
import { buildTrackers, SANDBOX_BASE, TRACKERS_BATCH_PATH } from "./tracking-api.ts";

export type Creds = { id?: string; secret?: string };
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
export type RouteResult = { status: number; body: Record<string, unknown> };

const NO_CREDS = "PayPal sandbox credentials are not set on the server";

async function sandboxToken(creds: Required<Creds>, fetchFn: FetchFn): Promise<string | null> {
  const res = await fetchFn(`${SANDBOX_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${creds.id}:${creds.secret}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string };
  return json.access_token ?? null;
}

// Health scan (PRD F1). A failed PayPal call returns an error, never zero.
export async function runScan(creds: Creds, fetchFn: FetchFn, now: Date = new Date()): Promise<RouteResult> {
  const asOf = now.toISOString();
  if (!creds.id || !creds.secret) return { status: 500, body: { ok: false, asOf, error: NO_CREDS } };
  try {
    const token = await sandboxToken({ id: creds.id, secret: creds.secret }, fetchFn);
    if (!token) return { status: 502, body: { ok: false, asOf, error: "Could not get a PayPal sandbox token" } };

    const res = await fetchFn(`${SANDBOX_BASE}/v1/customer/disputes?page_size=50`, { headers: { Authorization: `Bearer ${token}` } });
    const json = (await res.json().catch(() => ({}))) as { items?: HealthDispute[]; disputes?: HealthDispute[] };
    const disputes = json.items ?? json.disputes;
    if (!res.ok || !Array.isArray(disputes)) {
      return { status: 502, body: { ok: false, asOf, error: `PayPal dispute list failed (HTTP ${res.status})` } };
    }
    return { status: 200, body: { ok: true, asOf, health: summarizeHealth(disputes, allOrders(), now), disputeCount: disputes.length } };
  } catch (err) {
    return { status: 500, body: { ok: false, asOf, error: err instanceof Error ? err.message : "Unknown error" } };
  }
}

// Tracking send (PRD F2). Only called after the seller confirms. "confirmed" lists the orders PayPal accepted.
export async function sendTracking(creds: Creds, lines: BulkLine[], fetchFn: FetchFn): Promise<RouteResult> {
  if (!creds.id || !creds.secret) return { status: 500, body: { ok: false, error: NO_CREDS } };
  let trackers;
  try {
    trackers = buildTrackers(lines);
  } catch (err) {
    return { status: 400, body: { ok: false, error: err instanceof Error ? err.message : "Bad tracking lines" } };
  }
  try {
    const token = await sandboxToken({ id: creds.id, secret: creds.secret }, fetchFn);
    if (!token) return { status: 502, body: { ok: false, error: "Could not get a PayPal sandbox token" } };

    const res = await fetchFn(`${SANDBOX_BASE}${TRACKERS_BATCH_PATH}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(trackers),
    });
    const text = await res.text();
    let parsed: { tracker_identifiers?: { transaction_id?: string }[]; errors?: unknown[] } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {};
    }
    const confirmed = (parsed.tracker_identifiers ?? []).map((t) => t.transaction_id).filter((x): x is string => typeof x === "string");
    const errors = parsed.errors ?? [];
    return { status: res.ok ? 200 : 502, body: { ok: res.ok && errors.length === 0, status: res.status, body: text.slice(0, 2000), confirmed, errors } };
  } catch (err) {
    return { status: 500, body: { ok: false, error: err instanceof Error ? err.message : "Unknown error" } };
  }
}

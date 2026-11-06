// Logic behind /api/scan, /api/tracking and /api/dispute-action, kept out of the route files so it can be tested
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

// Dispute actions (PRD F3). Only called after the seller approves on the case screen.
// "message" sends the seller's reply to the buyer (PayPal allows this only in the INQUIRY stage).
// "refund" accepts the claim with a full refund. Both go to the sandbox only.
export type DisputeAction = { disputeId: string; action: "message" | "refund"; text: string };

const DISPUTE_ID = /^PP-[A-Z0-9-]{4,60}$/;

export function validateDisputeAction(a: Partial<DisputeAction>): string | null {
  if (!a.disputeId || !DISPUTE_ID.test(a.disputeId)) return "Not a PayPal dispute ID";
  if (a.action !== "message" && a.action !== "refund") return "Unknown action";
  const text = (a.text ?? "").trim();
  if (!text) return a.action === "message" ? "The message is empty" : "The refund note is empty";
  if (text.length > 2000) return "PayPal allows at most 2000 characters";
  return null;
}

export async function sendDisputeAction(creds: Creds, input: Partial<DisputeAction>, fetchFn: FetchFn): Promise<RouteResult> {
  if (!creds.id || !creds.secret) return { status: 500, body: { ok: false, error: NO_CREDS } };
  const invalid = validateDisputeAction(input);
  if (invalid) return { status: 400, body: { ok: false, error: invalid } };
  const { disputeId, action } = input as DisputeAction;
  const text = (input.text as string).trim();
  try {
    const token = await sandboxToken({ id: creds.id, secret: creds.secret }, fetchFn);
    if (!token) return { status: 502, body: { ok: false, error: "Could not get a PayPal sandbox token" } };

    const path = action === "message" ? "send-message" : "accept-claim";
    const payload = action === "message" ? { message: text } : { note: text, accept_claim_type: "REFUND" };
    const res = await fetchFn(`${SANDBOX_BASE}/v1/customer/disputes/${encodeURIComponent(disputeId)}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    let issue: string | undefined;
    try {
      const j = JSON.parse(body) as { name?: string; message?: string; details?: { issue?: string; description?: string }[] };
      issue = j.details?.[0]?.description ?? j.details?.[0]?.issue ?? j.message ?? j.name;
    } catch {
      issue = undefined;
    }
    return res.ok
      ? { status: 200, body: { ok: true, status: res.status, action, disputeId } }
      : { status: 502, body: { ok: false, status: res.status, action, disputeId, error: `PayPal refused (HTTP ${res.status})${issue ? `: ${issue}` : ""}`, body: body.slice(0, 2000) } };
  } catch (err) {
    return { status: 500, body: { ok: false, error: err instanceof Error ? err.message : "Unknown error" } };
  }
}

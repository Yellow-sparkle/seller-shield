// Logic behind /api/scan, /api/tracking and /api/dispute-action, kept out of the route files so it can be tested
// with a fake fetch. Sandbox only. Each function returns the HTTP status and JSON body to send.
import { summarizeHealth, type HealthDispute } from "./health.ts";
import { allOrders } from "./orders-seed.ts";
import type { BulkLine } from "./orders.ts";
import { buildTrackers, carrierCode, SANDBOX_BASE, TRACKERS_BATCH_PATH } from "./tracking-api.ts";

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
// "refund" accepts the claim with a full refund.
// "evidence" sends the order's tracking as proof of fulfilment (provide-evidence), for item-not-received cases.
// Kate's call on 7 Nov 2026: Fight sends INR tracking as evidence; files for other reasons are
// uploaded in the PayPal Resolution Center. All three go to the sandbox only.
export type DisputeAction = { disputeId: string; action: "message" | "refund" | "evidence"; text: string; tracking?: { carrier: string; number: string } };

const DISPUTE_ID = /^PP-[A-Z0-9-]{4,60}$/;

export function validateDisputeAction(a: Partial<DisputeAction>): string | null {
  if (!a.disputeId || !DISPUTE_ID.test(a.disputeId)) return "Not a PayPal dispute ID";
  if (a.action !== "message" && a.action !== "refund" && a.action !== "evidence") return "Unknown action";
  if (a.action === "evidence") {
    const t = a.tracking;
    if (!t || !t.carrier?.trim() || !t.number?.trim()) return "Tracking carrier and number are needed";
    if (!/^[\x20-\x7E]{1,64}$/.test(t.number.trim())) return "Tracking number not valid";
  }
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

    const path = action === "message" ? "send-message" : action === "refund" ? "accept-claim" : "provide-evidence";
    const url = `${SANDBOX_BASE}/v1/customer/disputes/${encodeURIComponent(disputeId)}/${path}`;
    const res =
      action === "evidence"
        ? await fetchFn(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: evidenceForm((input as DisputeAction).tracking!, text) })
        : await fetchFn(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(action === "message" ? { message: text } : { note: text, accept_claim_type: "REFUND" }),
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

// provide-evidence takes multipart/form-data with the evidence as JSON in a part named "input", tracking under
// evidences[].evidence_info.tracking_info (PayPal "Integrate Disputes APIs" guide, checked 7 Nov 2026). PayPal accepts
// it only while the dispute is WAITING_FOR_SELLER_RESPONSE. Tried live on 9 Nov 2026 (PP-R-JEX-10197437): PayPal accepted it.
export function evidenceInput(tracking: { carrier: string; number: string }, notes: string) {
  const code = carrierCode(tracking.carrier);
  return {
    evidences: [
      {
        evidence_type: "PROOF_OF_FULFILLMENT",
        evidence_info: {
          tracking_info: [{ carrier_name: code.carrier, ...(code.carrier_name_other ? { carrier_name_other: code.carrier_name_other } : {}), tracking_number: tracking.number.trim() }],
        },
        notes,
      },
    ],
  };
}

function evidenceForm(tracking: { carrier: string; number: string }, notes: string): FormData {
  const form = new FormData();
  form.append("input", new Blob([JSON.stringify(evidenceInput(tracking, notes))], { type: "application/json" }));
  return form;
}

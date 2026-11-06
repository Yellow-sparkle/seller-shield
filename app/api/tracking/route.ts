// Sends confirmed tracking to PayPal SANDBOX only. Called by the confirm button after the seller's yes.
// Credentials come from server environment variables. Nothing is returned except PayPal's status and body.
import { NextResponse } from "next/server";
import { buildTrackers, SANDBOX_BASE, TRACKERS_BATCH_PATH } from "@/lib/tracking-api";
import type { BulkLine } from "@/lib/orders";

export async function POST(req: Request) {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) {
    return NextResponse.json({ ok: false, error: "PayPal sandbox credentials are not set on the server" }, { status: 500 });
  }

  let lines: BulkLine[];
  try {
    const json = (await req.json()) as { lines?: BulkLine[] };
    lines = json.lines ?? [];
    const body = buildTrackers(lines);

    const tokenRes = await fetch(`${SANDBOX_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      return NextResponse.json({ ok: false, error: "Could not get a PayPal sandbox token" }, { status: 502 });
    }

    const res = await fetch(`${SANDBOX_BASE}${TRACKERS_BATCH_PATH}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenJson.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
    const ok = res.ok && errors.length === 0;
    return NextResponse.json({ ok, status: res.status, body: text.slice(0, 2000), confirmed, errors }, { status: res.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 400 });
  }
}

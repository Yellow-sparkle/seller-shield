// Health scan (PRD F1). Reads sandbox disputes live on each call. Nothing is changed in PayPal.
import { NextResponse } from "next/server";
import { summarizeHealth, type HealthDispute } from "@/lib/health";
import { allOrders } from "@/lib/orders-seed";
import { SANDBOX_BASE } from "@/lib/tracking-api";

export async function GET(_req: Request) {
  const asOf = new Date().toISOString();
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) {
    return NextResponse.json({ ok: false, asOf, error: "PayPal sandbox credentials are not set on the server" }, { status: 500 });
  }
  try {
    const tokenRes = await fetch(`${SANDBOX_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      return NextResponse.json({ ok: false, asOf, error: "Could not get a PayPal sandbox token" }, { status: 502 });
    }

    const res = await fetch(`${SANDBOX_BASE}/v1/customer/disputes?page_size=50`, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const body = (await res.json()) as { items?: HealthDispute[]; disputes?: HealthDispute[] };
    const disputes = body.items ?? body.disputes;
    if (!res.ok || !Array.isArray(disputes)) {
      return NextResponse.json({ ok: false, asOf, error: `PayPal dispute list failed (HTTP ${res.status})` }, { status: 502 });
    }

    const health = summarizeHealth(disputes, allOrders(), new Date());
    return NextResponse.json({ ok: true, asOf, health, disputeCount: disputes.length });
  } catch (err) {
    return NextResponse.json({ ok: false, asOf, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

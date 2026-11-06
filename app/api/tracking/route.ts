// Sends confirmed tracking to PayPal SANDBOX only. Called by the confirm button after the seller's yes.
// The logic is in lib/paypal-routes.ts, where it is tested with a fake fetch.
import { NextResponse } from "next/server";
import { sendTracking } from "@/lib/paypal-routes";
import type { BulkLine } from "@/lib/orders";

export async function POST(req: Request) {
  const json = (await req.json().catch(() => ({}))) as { lines?: BulkLine[] };
  const r = await sendTracking({ id: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_CLIENT_SECRET }, json.lines ?? [], fetch);
  return NextResponse.json(r.body, { status: r.status });
}

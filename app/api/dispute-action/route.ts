// Sends the seller's approved reply or refund to PayPal SANDBOX only (PRD F3).
// Called by the case screen after the seller confirms. The logic is in lib/paypal-routes.ts, tested with a fake fetch.
import { NextResponse } from "next/server";
import { sendDisputeAction, type DisputeAction } from "@/lib/paypal-routes";

export async function POST(req: Request) {
  const input = (await req.json().catch(() => ({}))) as Partial<DisputeAction>;
  const r = await sendDisputeAction({ id: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_CLIENT_SECRET }, input, fetch);
  return NextResponse.json(r.body, { status: r.status });
}

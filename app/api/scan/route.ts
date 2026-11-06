// Health scan (PRD F1). Reads sandbox disputes live on each call. Nothing is changed in PayPal.
// The logic is in lib/paypal-routes.ts, where it is tested with a fake fetch.
import { NextResponse } from "next/server";
import { runScan } from "@/lib/paypal-routes";

export async function GET(_req: Request) {
  const r = await runScan({ id: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_CLIENT_SECRET }, fetch);
  return NextResponse.json(r.body, { status: r.status });
}

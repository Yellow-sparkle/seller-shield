// Reads the PayPal fee for each sandbox dispute's sale from its transaction record and saves it to
// lib/fixtures/sandbox-fees.json, so the cases screen can show it. Read-only in PayPal.
// Uses PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET from .env.local.
// Run: node --env-file=.env.local --experimental-strip-types scripts/fetch-fees.ts
import { readFileSync, writeFileSync } from "node:fs";
import { parseFee, type FeeRecord } from "../lib/fees.ts";

const BASE = "https://api-m.sandbox.paypal.com";
const FIXTURES = "lib/fixtures/sandbox-disputes.json";
const OUT = "lib/fixtures/sandbox-fees.json";
const { PAYPAL_CLIENT_ID: cid, PAYPAL_CLIENT_SECRET: secret } = process.env;
if (!cid || !secret) {
  console.error("PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is not set. Check .env.local.");
  process.exit(1);
}

const tokenRes = await fetch(`${BASE}/v1/oauth2/token`, {
  method: "POST",
  headers: { Authorization: "Basic " + Buffer.from(`${cid}:${secret}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials",
});
const token = ((await tokenRes.json().catch(() => ({}))) as { access_token?: string }).access_token;
if (!token) {
  console.error(`No sandbox token (HTTP ${tokenRes.status}). Check the keys in .env.local.`);
  process.exit(1);
}

type Fixture = { dispute_id: string; create_time?: string; disputed_transactions?: { seller_transaction_id?: string }[] };
const disputes = JSON.parse(readFileSync(FIXTURES, "utf8")) as Fixture[];
const out: Record<string, FeeRecord> = {};

for (const d of disputes) {
  const txId = d.disputed_transactions?.[0]?.seller_transaction_id;
  if (!txId) continue;
  // Transaction Search takes a date window of at most 31 days around the sale. Use 31 days before the dispute, to today.
  const created = d.create_time ? new Date(d.create_time) : new Date();
  const start = new Date(created.getTime() - 31 * 86400000).toISOString();
  const end = new Date().toISOString();
  const url = `${BASE}/v1/reporting/transactions?transaction_id=${encodeURIComponent(txId)}&start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}&fields=transaction_info`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = (await res.json().catch(() => ({}))) as { transaction_details?: never[] };
  if (!res.ok) {
    console.log(`${d.dispute_id}: PayPal returned HTTP ${res.status}, fee not known`);
    continue;
  }
  const rec = parseFee(body, txId);
  if (rec) {
    out[d.dispute_id] = rec;
    console.log(`${d.dispute_id}: fee ${rec.fee.value.toFixed(2)} ${rec.fee.currency}`);
  } else {
    console.log(`${d.dispute_id}: no fee in the transaction record, shown as Not known`);
  }
}

writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`Saved ${Object.keys(out).length} fee records to ${OUT}.`);

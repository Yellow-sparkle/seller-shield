// Reads one dispute from the PayPal sandbox and adds it to lib/fixtures/sandbox-disputes.json, so the case
// screen shows it. Read-only in PayPal. Uses PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET from .env.local.
// Run: node --env-file=.env.local --experimental-strip-types scripts/add-dispute.ts PP-R-XXX-12345678
// Then record its AI recommendation: node --env-file=.env.local --experimental-strip-types scripts/live-check.ts --record
import { readFileSync, writeFileSync } from "node:fs";
import { toFixture, upsertFixture } from "../lib/dispute-import.ts";

const BASE = "https://api-m.sandbox.paypal.com";
const FILE = "lib/fixtures/sandbox-disputes.json";
const id = process.argv[2];
const { PAYPAL_CLIENT_ID: cid, PAYPAL_CLIENT_SECRET: secret } = process.env;

if (!id || !/^PP-[A-Z0-9-]{4,60}$/.test(id)) {
  console.error("Give the dispute ID, for example PP-R-ABC-10196999");
  process.exit(1);
}
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

const res = await fetch(`${BASE}/v1/customer/disputes/${id}`, { headers: { Authorization: `Bearer ${token}` } });
const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`PayPal returned HTTP ${res.status}:`, JSON.stringify(body));
  process.exit(1);
}

const fixture = toFixture(body);
const list = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, unknown>[];
writeFileSync(FILE, JSON.stringify(upsertFixture(list, fixture), null, 2) + "\n");
console.log(`Saved ${id}: ${fixture.reason}, ${fixture.status}, stage ${fixture.dispute_life_cycle_stage}, due ${fixture.seller_response_due_date}`);
console.log(`The file now has ${upsertFixture(list, fixture).length} disputes.`);

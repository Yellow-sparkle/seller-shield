// Prints what PayPal's sandbox returns for one dispute: the full detail reply, then a short summary of the
// buyer's evidence (files and documents) and messages. Read-only in PayPal; changes no file.
// Uses PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET from .env.local.
// Run: node --env-file=.env.local --experimental-strip-types scripts/show-dispute.ts PP-R-XXX-12345678
const BASE = "https://api-m.sandbox.paypal.com";
const id = process.argv[2];
const { PAYPAL_CLIENT_ID: cid, PAYPAL_CLIENT_SECRET: secret } = process.env;

if (!id || !/^PP-[A-Z0-9-]{4,60}$/.test(id)) {
  console.error("Give the dispute ID, for example PP-R-SRZ-10196872");
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
const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
if (!res.ok) {
  console.error(`PayPal returned HTTP ${res.status}:`, JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log("=== Full dispute detail from PayPal ===");
console.log(JSON.stringify(body, null, 2));

// Summary of what the buyer sent. PayPal names these fields in the dispute detail reply.
type Evidence = { evidence_type?: string; evidence_info?: { tracking_info?: unknown[] }; documents?: { name?: string; doc_type?: string; size_in_bytes?: number }[]; date?: string; notes?: string };
type Msg = { posted_by?: string; time_posted?: string; content?: string };
const evidences = (body.evidences as Evidence[] | undefined) ?? [];
const messages = (body.messages as Msg[] | undefined) ?? [];

console.log("\n=== Summary ===");
console.log(`Evidence entries: ${evidences.length}`);
for (const e of evidences) {
  console.log(`- ${e.evidence_type ?? "UNKNOWN_TYPE"}${e.date ? ` (${e.date})` : ""}${e.notes ? `: ${e.notes}` : ""}`);
  for (const d of e.documents ?? []) console.log(`    file: ${d.name ?? "(no name)"} ${d.doc_type ?? ""} ${d.size_in_bytes ? `${d.size_in_bytes} bytes` : ""}`);
}
console.log(`Messages: ${messages.length}`);
for (const m of messages) console.log(`- ${m.posted_by ?? "?"} ${m.time_posted ?? ""}: ${m.content ?? ""}`);
if (evidences.length === 0) console.log("No evidence entries came back for this dispute.");

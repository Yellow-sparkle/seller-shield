import { test } from "node:test";
import assert from "node:assert/strict";
import { runScan, sendDisputeAction, sendTracking, type FetchFn } from "./paypal-routes.ts";

const creds = { id: "id", secret: "secret" };
const now = new Date("2026-11-06T00:00:00Z");
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Fake PayPal: answers the token call, then the second call with the given response.
function fakePayPal(second: () => Response, token: string | null = "tok"): { fetchFn: FetchFn; calls: string[] } {
  const calls: string[] = [];
  const fetchFn: FetchFn = async (url) => {
    calls.push(url);
    if (url.endsWith("/v1/oauth2/token")) return json(token ? 200 : 401, token ? { access_token: token } : { error: "invalid_client" });
    return second();
  };
  return { fetchFn, calls };
}

const line = { orderNo: "7RX812769J8875301", carrier: "DHL", tracking: "TEST1" };

test("scan: missing credentials is an error, and PayPal is not called", async () => {
  const { fetchFn, calls } = fakePayPal(() => json(200, { items: [] }));
  const r = await runScan({}, fetchFn, now);
  assert.equal(r.status, 500);
  assert.equal(r.body.ok, false);
  assert.equal(calls.length, 0);
});

test("scan: a rejected token is an error, not zero", async () => {
  const r = await runScan(creds, fakePayPal(() => json(200, { items: [] }), null).fetchFn, now);
  assert.equal(r.status, 502);
  assert.equal(r.body.ok, false);
  assert.equal(r.body.health, undefined);
});

test("scan: a failed dispute list is an error, not zero", async () => {
  const r = await runScan(creds, fakePayPal(() => json(500, { name: "INTERNAL_SERVER_ERROR" })).fetchFn, now);
  assert.equal(r.status, 502);
  assert.match(String(r.body.error), /HTTP 500/);
  assert.equal(r.body.health, undefined);
});

test("scan: a reply without a dispute list is an error, not zero", async () => {
  const r = await runScan(creds, fakePayPal(() => json(200, { links: [] })).fetchFn, now);
  assert.equal(r.status, 502);
  assert.equal(r.body.health, undefined);
});

test("scan: a network failure is an error, not zero", async () => {
  const r = await runScan(creds, fakePayPal(() => {
    throw new Error("fetch failed");
  }).fetchFn, now);
  assert.equal(r.status, 500);
  assert.equal(r.body.error, "fetch failed");
});

test("scan: open disputes are summed from PayPal's list", async () => {
  const items = [{ status: "WAITING_FOR_SELLER_RESPONSE", dispute_amount: { currency_code: "EUR", value: "60.00" }, seller_response_due_date: "2026-11-08T00:00:00Z" }];
  const r = await runScan(creds, fakePayPal(() => json(200, { items })).fetchFn, now);
  assert.equal(r.status, 200);
  const health = r.body.health as { moneyAtRisk: { amount: number }; nextDeadline: { daysLeft: number } };
  assert.equal(health.moneyAtRisk.amount, 60);
  assert.equal(health.nextDeadline.daysLeft, 2);
});

test("tracking: missing credentials is an error, and PayPal is not called", async () => {
  const { fetchFn, calls } = fakePayPal(() => json(200, {}));
  const r = await sendTracking({}, [line], fetchFn);
  assert.equal(r.status, 500);
  assert.equal(calls.length, 0);
});

test("tracking: empty or invalid lines are rejected before any PayPal call", async () => {
  const { fetchFn, calls } = fakePayPal(() => json(200, {}));
  assert.equal((await sendTracking(creds, [], fetchFn)).status, 400);
  assert.equal((await sendTracking(creds, [{ ...line, orderNo: "bad id!" }], fetchFn)).status, 400);
  assert.equal(calls.length, 0);
});

test("tracking: PayPal accepting the order confirms that row", async () => {
  const r = await sendTracking(creds, [line], fakePayPal(() => json(200, { tracker_identifiers: [{ transaction_id: line.orderNo }], errors: [] })).fetchFn);
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.confirmed, [line.orderNo]);
});

test("tracking: PayPal errors in a 200 reply are not a success", async () => {
  const r = await sendTracking(creds, [line], fakePayPal(() => json(200, { tracker_identifiers: [], errors: [{ name: "INVALID_REQUEST" }] })).fetchFn);
  assert.equal(r.body.ok, false);
  assert.deepEqual(r.body.confirmed, []);
});

test("tracking: a PayPal HTTP error is not a success", async () => {
  const r = await sendTracking(creds, [line], fakePayPal(() => json(400, { name: "INVALID_REQUEST" })).fetchFn);
  assert.equal(r.status, 502);
  assert.equal(r.body.ok, false);
});

test("tracking: a rejected token is not a success", async () => {
  const r = await sendTracking(creds, [line], fakePayPal(() => json(200, {}), null).fetchFn);
  assert.equal(r.status, 502);
  assert.equal(r.body.ok, false);
});

const msg = { disputeId: "PP-R-ABC-10196999", action: "message" as const, text: "Hello, your parcel left on 3 Nov." };

test("dispute action: missing credentials is an error, and PayPal is not called", async () => {
  const { fetchFn, calls } = fakePayPal(() => json(200, {}));
  const r = await sendDisputeAction({}, msg, fetchFn);
  assert.equal(r.status, 500);
  assert.equal(calls.length, 0);
});

test("dispute action: bad input is rejected before any PayPal call", async () => {
  const { fetchFn, calls } = fakePayPal(() => json(200, {}));
  assert.equal((await sendDisputeAction(creds, { ...msg, disputeId: "../oauth2/token" }, fetchFn)).status, 400);
  assert.equal((await sendDisputeAction(creds, { ...msg, text: "   " }, fetchFn)).status, 400);
  assert.equal((await sendDisputeAction(creds, { ...msg, text: "x".repeat(2001) }, fetchFn)).status, 400);
  assert.equal((await sendDisputeAction(creds, { ...msg, action: "escalate" as never }, fetchFn)).status, 400);
  assert.equal(calls.length, 0);
});

test("dispute action: a message goes to send-message with the seller's text", async () => {
  let sent: { url: string; body: string } | null = null;
  const fetchFn: FetchFn = async (url, init) => {
    if (url.endsWith("/v1/oauth2/token")) return json(200, { access_token: "tok" });
    sent = { url, body: String(init?.body) };
    return json(200, { links: [] });
  };
  const r = await sendDisputeAction(creds, msg, fetchFn);
  assert.equal(r.body.ok, true);
  assert.match(sent!.url, /\/v1\/customer\/disputes\/PP-R-ABC-10196999\/send-message$/);
  assert.deepEqual(JSON.parse(sent!.body), { message: msg.text });
});

test("dispute action: a refund accepts the claim as a full refund", async () => {
  let sent: { url: string; body: string } | null = null;
  const fetchFn: FetchFn = async (url, init) => {
    if (url.endsWith("/v1/oauth2/token")) return json(200, { access_token: "tok" });
    sent = { url, body: String(init?.body) };
    return json(200, { links: [] });
  };
  const r = await sendDisputeAction(creds, { ...msg, action: "refund", text: "Full refund." }, fetchFn);
  assert.equal(r.body.ok, true);
  assert.match(sent!.url, /\/accept-claim$/);
  assert.deepEqual(JSON.parse(sent!.body), { note: "Full refund.", accept_claim_type: "REFUND" });
});

test("dispute action: PayPal refusing is shown as not sent, with PayPal's reason", async () => {
  const r = await sendDisputeAction(creds, msg, fakePayPal(() => json(422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "CANNOT_SEND_MESSAGE", description: "Dispute is not in inquiry stage" }] })).fetchFn);
  assert.equal(r.status, 502);
  assert.equal(r.body.ok, false);
  assert.match(String(r.body.error), /HTTP 422.*not in inquiry stage/);
});

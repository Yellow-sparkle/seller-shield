import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReplyPrompt, parseReply } from "./reply.ts";

const rec = { recommendation: "REFUND" as const, confidence: "HIGH" as const, claims: [] };

test("prompt carries the facts and the no-invention rule", () => {
  const p = buildReplyPrompt(rec, { reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED", hasTracking: false });
  assert.match(p, /Never invent a fact/);
  assert.match(p, /"hasTracking": false/);
  assert.match(p, /do not state the recommendation to the buyer/);
});

test("parses a clean draft and keeps its placeholders", () => {
  const r = parseReply('{"draft":"Hello, we are sorry. [attach tracking screenshot]","placeholders":["[attach tracking screenshot]"]}');
  assert.equal(r.draft, "Hello, we are sorry. [attach tracking screenshot]");
  assert.deepEqual(r.placeholders, ["[attach tracking screenshot]"]);
});

test("rejects an empty draft", () => {
  assert.throws(() => parseReply('{"draft":"   ","placeholders":[]}'), /Empty draft/);
});

test("rejects a draft over the length cap", () => {
  assert.throws(() => parseReply(JSON.stringify({ draft: "a".repeat(1201), placeholders: [] })), /too long/);
});

test("rejects a draft that predicts PayPal's decision", () => {
  assert.throws(() => parseReply('{"draft":"PayPal will likely side with you.","placeholders":[]}'), /predicts/);
  assert.throws(() => parseReply('{"draft":"We guarantee a refund.","placeholders":[]}'), /predicts/);
});

test("placeholders default to empty when the model omits them", () => {
  const r = parseReply('{"draft":"Thanks for your message."}');
  assert.deepEqual(r.placeholders, []);
});

import { templateReply } from "./reply.ts";

test("template reply for a refund states the amount and no prediction", () => {
  const r = templateReply({ recommendation: "REFUND", amount: "15.00 EUR", orderRef: "order #1063" });
  assert.match(r.draft, /refunding 15\.00 EUR/);
  assert.doesNotMatch(r.draft, /have refunded/);
  assert.deepEqual(r.placeholders, []);
});

test("template reply for a fight keeps the evidence placeholder", () => {
  const r = templateReply({ recommendation: "FIGHT", amount: "45.00 EUR", orderRef: "order #1057" });
  assert.equal(r.placeholders.length, 1);
  assert.match(r.draft, /\[attach/);
});

test("template reply for your call makes no promise", () => {
  const r = templateReply({ recommendation: "YOUR_CALL", amount: "85.00 EUR", orderRef: "order #1063" });
  assert.doesNotMatch(r.draft, /PayPal will|will win|will refund|guarantee/i);
});

import { hasPlaceholder } from "./reply.ts";

test("H6: the refund draft does not say the refund already happened", () => {
  const r = templateReply({ recommendation: "REFUND", amount: "25.00 EUR", orderRef: "order 1P27" });
  assert.doesNotMatch(r.draft, /have refunded|has been refunded/i);
});

test("L3: an INR fight uses the order's tracking and talks about delivery, not the listing", () => {
  const r = templateReply({ recommendation: "FIGHT (high confidence)", amount: "45.00 EUR", orderRef: "order DEMO-1025", reason: "INR", tracking: { carrier: "PostNL", number: "DEMO100175" } });
  assert.match(r.draft, /PostNL, tracking number DEMO100175/);
  assert.doesNotMatch(r.draft, /listing/);
  assert.equal(hasPlaceholder(r.draft), false);
});

test("L3: placeholders are detected so the screen can block the send", () => {
  assert.equal(hasPlaceholder("See [attach listing photos]."), true);
  assert.equal(hasPlaceholder("No brackets here."), false);
  const r = templateReply({ recommendation: "FIGHT", amount: "45.00 EUR", orderRef: "order X", reason: "INR" });
  assert.equal(hasPlaceholder(r.draft), true);
});

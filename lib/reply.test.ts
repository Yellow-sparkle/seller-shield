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

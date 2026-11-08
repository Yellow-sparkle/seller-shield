import { test } from "node:test";
import assert from "node:assert/strict";
import { whySummary } from "./why-summary.ts";

test("a Mixed case shows what would settle it", () => {
  const s = whySummary("A tracking number is on the order.\nThe evidence on file does not settle it. You decide.\nWhat would settle it: your answer to the address question below.");
  assert.equal(s.main, "What would settle it: your answer to the address question below.");
  assert.equal(s.more, 2);
});

test("the buyer's claim and the verdict are skipped for the first line that explains the case", () => {
  assert.equal(whySummary("The buyer says a EUR 45 item was not received.\nNo tracking recorded.").main, "No tracking recorded.");
  assert.equal(whySummary("This is an Item Not Received dispute.\nThe evidence on file supports the buyer.\nNo tracking number is on the order.").main, "No tracking number is on the order.");
});

test("one line, or only restating lines, falls back to the first", () => {
  assert.deepEqual(whySummary("You have replied."), { main: "You have replied.", more: 0, all: ["You have replied."] });
  assert.equal(whySummary("The buyer says it never arrived.").main, "The buyer says it never arrived.");
  assert.equal(whySummary("").main, "");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readability, syllables } from "./readability.ts";

test("counts syllables close to a dictionary", () => {
  assert.equal(syllables("cat"), 1);
  assert.equal(syllables("tracking"), 2);
  assert.equal(syllables("delivered"), 3);
  assert.equal(syllables("transaction"), 3);
  assert.equal(syllables("eligible"), 4);
});

test("a short plain sentence reads at a low grade", () => {
  const r = readability("The buyer says the item did not arrive.");
  assert.ok(r.grade < 6, `grade ${r.grade}`);
  assert.ok(r.ease > 70, `ease ${r.ease}`);
});

test("long words read at a higher grade than short ones", () => {
  const plain = readability("You sent it on time to the right address.");
  const hard = readability("Fulfillment documentation substantiates eligibility determination.");
  assert.ok(hard.grade > plain.grade + 5);
});

test("dates, amounts and codes are not counted as words", () => {
  assert.equal(readability("Respond by 2026-11-20 10:00 UTC.").words, 2);
  assert.equal(readability("EUR 38.40 is on hold.").words, 3);
});

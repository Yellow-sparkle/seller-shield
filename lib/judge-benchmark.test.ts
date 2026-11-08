import { test } from "node:test";
import assert from "node:assert/strict";
import { agreement, factsSummary, parseCsv, parseFactsSummary, toCsv } from "./judge-benchmark.ts";

test("CSV round trip keeps commas, quotes and line breaks", () => {
  const rows = [["id", "claim"], ["G01-1", 'Said "delivered", on 14 Oct\nto the address']];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
});

test("CSV saved with ; by a European spreadsheet is read too", () => {
  assert.deepEqual(parseCsv("id;your_label\r\nG01-1;yes\r\n"), [["id", "your_label"], ["G01-1", "yes"]]);
});

test("facts summary leaves out empty facts", () => {
  assert.equal(factsSummary({ reason: "INR", hasTracking: true, deliveryDate: null }), "reason: INR\nhasTracking: true");
});

test("agreement counts matches, the dangerous misses and blank labels", () => {
  const labels = [["id", "case", "claim", "facts", "your_label"], ["a", "G01", "A", "", "yes"], ["b", "G01", "B", "", "no"], ["c", "G01", "C", "", "No"], ["d", "G01", "D", "", ""]];
  const verdicts = [["id", "judge_supported", "judge_reason"], ["a", "yes", ""], ["b", "yes", ""], ["c", "no", ""], ["d", "yes", ""]];
  const r = agreement(labels, verdicts);
  assert.equal(r.compared, 3);
  assert.equal(r.agree, 2);
  assert.deepEqual(r.missedFalse, [{ id: "b", claim: "B" }]);
  assert.equal(r.unlabelled, 1);
});

test("facts lines turn back into the facts object", () => {
  const facts = { reason: "INR", delivered: true, amount: 12.5, dueAt: "2026-11-20T10:00:00Z", list: ["a"] };
  assert.deepEqual(parseFactsSummary(factsSummary(facts)), facts);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { feeLabel, parseFee } from "./fees.ts";

const reply = {
  transaction_details: [
    { transaction_info: { transaction_id: "35W222794X4866508", transaction_amount: { currency_code: "EUR", value: "60.00" }, fee_amount: { currency_code: "EUR", value: "-2.39" } } },
    { transaction_info: { transaction_id: "NOFEE", transaction_amount: { currency_code: "EUR", value: "10.00" } } },
  ],
};

test("reads the fee from the transaction record and shows it as a positive amount", () => {
  const rec = parseFee(reply, "35W222794X4866508");
  assert.ok(rec);
  assert.equal(rec.fee.value, 2.39);
  assert.equal(rec.afterFees.value, 57.61);
  assert.equal(feeLabel(rec, "fee"), "2.39 EUR");
  assert.equal(feeLabel(rec, "afterFees"), "57.61 EUR");
});

test("returns null and shows 'Not known' when the record has no fee or is missing", () => {
  assert.equal(parseFee(reply, "NOFEE"), null);
  assert.equal(parseFee(reply, "MISSING"), null);
  assert.equal(feeLabel(undefined, "fee"), "Not known");
});

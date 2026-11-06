import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTrackers, carrierCode, TRACKERS_BATCH_PATH, SANDBOX_BASE } from "./tracking-api.ts";

test("known carriers use PayPal codes, others use OTHER with the name", () => {
  assert.deepEqual(carrierCode("UPS"), { carrier: "UPS" });
  assert.deepEqual(carrierCode("dpd"), { carrier: "DPD" });
  assert.deepEqual(carrierCode("PostNL"), { carrier: "OTHER", carrier_name_other: "PostNL" });
});

test("builds a batch body with the spec's required fields", () => {
  const body = buildTrackers([{ orderNo: "35W222794X4866508", carrier: "DHL", tracking: "JD0123" }]);
  assert.deepEqual(body.trackers, [
    {
      transaction_id: "35W222794X4866508",
      status: "SHIPPED",
      tracking_number: "JD0123",
      carrier: "DHL",
      notify_buyer: false,
    },
  ]);
});

test("the endpoint is the sandbox batch path", () => {
  assert.equal(SANDBOX_BASE + TRACKERS_BATCH_PATH, "https://api-m.sandbox.paypal.com/v1/shipping/trackers-batch");
});

test("rejects an empty batch and a batch over 20", () => {
  assert.throws(() => buildTrackers([]), /No tracking lines/);
  const many = Array.from({ length: 21 }, (_, i) => ({ orderNo: `T${i}`, carrier: "DHL", tracking: "1" }));
  assert.throws(() => buildTrackers(many), /at most 20/);
});

test("rejects a transaction id or tracking number outside the spec", () => {
  assert.throws(() => buildTrackers([{ orderNo: "bad-id!", carrier: "DHL", tracking: "1" }]), /Transaction id/);
  assert.throws(() => buildTrackers([{ orderNo: "OK1", carrier: "DHL", tracking: "ünï" }]), /ASCII/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { evidenceItems } from "./evidence.ts";

test("M5: item not received asks for delivery proof, not listing photos", () => {
  const items = evidenceItems("INR").join(" ");
  assert.match(items, /Tracking/);
  assert.doesNotMatch(items, /Listing photos/);
});

test("M5: not as described keeps the listing and parcel photos", () => {
  assert.match(evidenceItems("SNAD")[0], /Listing photos/);
});

test("M5: unauthorised asks for proof of shipment within 2 days", () => {
  assert.match(evidenceItems("UNAUTHORISED").join(" "), /within 2 days/);
});

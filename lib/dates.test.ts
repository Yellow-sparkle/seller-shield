import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDay, formatDaysInText } from "./dates.ts";

test("formats a plain day and a full timestamp the same way, in UTC", () => {
  assert.equal(formatDay("2026-12-20"), "20 Dec 2026");
  assert.equal(formatDay("2026-12-20T23:30:00Z"), "20 Dec 2026");
});

test("leaves words and empty values alone", () => {
  assert.equal(formatDay("Closed"), "Closed");
  assert.equal(formatDay("Not set"), "Not set");
  assert.equal(formatDay(null), "");
  // Dates inside a reason read the same way; other text is untouched.
  assert.equal(formatDaysInText("Submit proof of fulfillment by 2026-12-20."), "Submit proof of fulfillment by 20 Dec 2026.");
  assert.equal(formatDaysInText("The disputed amount is EUR 65."), "The disputed amount is EUR 65.");
});

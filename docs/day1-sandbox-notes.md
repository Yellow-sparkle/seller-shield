# Day 1 PayPal sandbox notes

Date: 6 Nov 2026. Environment: api-m.sandbox.paypal.com.

## Token
- Client credentials grant works. Token length about 97 characters.
- Token expires in about 9 hours (expires_in 32400).

## Dispute create (POST /v1/customer/disputes)
- Body shape that passes validation: top-level `reason`, `disputed_transactions[].buyer_transaction_id`, `dispute_amount`.
- `reason: NOT_A_REASON` is rejected with INPUT_VALUE_NOT_FOUND_IN_DISPUTE_REASON.
- `reason: UNAUTHORISED` is accepted as a reason value.
- `buyer_transaction_id` is required. `seller_transaction_id` alone gives "Buyer Transaction id cannot be blank".
- `MERCHANDISE_OR_SERVICE_NOT_RECEIVED` returned MISSING_OR_INVALID_REQUEST_BODY. Cause not known.
- Transactions 5WB72210GV378703P (20 EUR) and 9L905240W4620471J (15 EUR) both return TRANSACTION_NOT_ELIGIBLE for UNAUTHORISED.
- A transaction-level block that the API doesn't explain. Debug IDs: f22235421f7f5, f558243b247a6.

## Buyer-side test case
- Case ID: PP-R-JGU-10196814
- Created: 6 Nov 2026, buyer-side form, "Item not received", 15 EUR, transaction 9L905240W4620471J.
- Status: "This case is under review" straight after filing. No seller response step shown.
- Seller response due date: none shown.
- Auto-close: 26 Nov 2026, 11:34 CET. This is not a seller response deadline.
- Options on the case: Close, Change case type, Escalate to PayPal. Not used yet.

## Open
- Reason value for item not received via API (MERCHANDISE_OR_SERVICE_NOT_RECEIVED) is unconfirmed.
- Seller protection values, whether a refund releases the hold, and the notice date source are not checked.
- Whether unauthorised claims skip inquiry: the buyer-side item-not-received case also went straight to review, so the lifecycle question is not settled.

## Read of existing case PP-R-JGU-10196814 (GET /v1/customer/disputes/{id})
- dispute_life_cycle_stage: INQUIRY (the buyer timeline said "under review", but the API stage is INQUIRY).
- status: WAITING_FOR_SELLER_RESPONSE. dispute_state: REQUIRED_ACTION. dispute_channel: INTERNAL.
- reason: MERCHANDISE_OR_SERVICE_NOT_RECEIVED. This is the reason name the API accepts for item not received.
- seller_response_due_date: 2026-11-26T11:34:32.869Z (UTC). The seller page said 26 Nov 2026 11:34 CET. In November CET is UTC+1, so the UI and API disagree by one hour. Check which one the UI means before relying on it.
- seller_protection_eligible: true. seller_protection_type: EXPANDED_SELLER_PROTECTION.
- fund_movements: HOLD_PLACED, 14.14 EUR debited from the seller balance when the dispute opened. transaction_status: HELD.
- allowed_response_options: accept claim (REFUND or PARTIAL_REFUND), make offer (REFUND), provide evidence, send message, escalate.
- Evidence requested from seller: PROOF_OF_FULFILLMENT.
- Transaction IDs: buyer side 9L905240W4620471J, seller side 8W935552C2660182V. The same payment.

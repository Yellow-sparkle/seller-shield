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

## Outcome of the test case (6 Nov 2026, 11:52 CET)
- Kate sent a full refund of 15.00 EUR from the seller side. Refund ID: 37L47556W72439357.
- The buyer keeps the item. The case should now be closed.
- Open for the next check: whether the 14.14 EUR hold is released after the refund, and the status and fund_movements that the API now reports for PP-R-JGU-10196814.

## Read after refund (11:53 CET, same case)
- status: UNDER_REVIEW. dispute_state: UNDER_PAYPAL_REVIEW. dispute_life_cycle_stage: INQUIRY. transaction_status: REFUNDED.
- money_movements: seller DEBIT 15.00 (DISPUTE_SETTLEMENT); seller DEBIT 0.86 (DISPUTE_SETTLEMENT_FEE); buyer CREDIT 15.00.
- fund_movements: the 14.14 HOLD_PLACED debit from 11:37 is still listed. No hold-release entry is listed in this response.
- Answer for the hold question: a refund settles from the seller balance (15.00 plus a 0.86 settlement fee). The response does not show a separate hold release. Check the seller balance in the dashboard to confirm the net amount.
- Refund ID: 37L47556W72439357 at 11:52:27.307Z.

## Buyer receipt (11:54 CET)
- Refund of 15,00 EUR to the buyer's Visa. Buyer-side refund transaction ID: 33W35855HM198123K.
- Note on the receipt: "Credit has been processed and claim is now closed. Please refer Dispute ID PP-R-JGU-10196814."
- The seller-side refund ID (37L47556W72439357) and the buyer-side ID (33W35855HM198123K) are different IDs for the same refund.
- The buyer receipt says the claim is closed, but the API read at 11:53 CET still said UNDER_REVIEW. Re-read the case to see whether the status has updated.

## Final read (11:54 UTC, update_time)
- status: RESOLVED. dispute_state: RESOLVED. dispute_outcome: RESOLVED_BUYER_FAVOUR, reason SELLER_ISSUED_REFUND, amount_refunded 15.00 EUR.
- The status moved from UNDER_REVIEW (11:53) to RESOLVED (11:54), after the buyer receipt showed the claim as closed.
- money_movements unchanged: seller DEBIT 15.00 and 0.86 settlement fee; buyer CREDIT 15.00.
- fund_movements: the 14.14 HOLD_PLACED entry is still listed. No hold-release entry appears.
- Seller balance reported by Kate: "4810" (unit still to confirm: 48,10 EUR or 4.810 EUR).

## Balance check (open, closed as far as the sandbox allows)
- Kate's sandbox balance now: 4.810,00 EUR. Balance before the refund: not recorded.
- Dashboard does not show the 0,86 EUR settlement fee. The API does (DISPUTE_SETTLEMENT_FEE).
- Net per API: −15,00 refund and −0,86 fee to the seller.

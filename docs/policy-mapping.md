# Policy mapping: public PayPal terms vs. Seller Shield rules

Sources: PayPal public Seller Protection terms (https://pep.paypal.com/legalhub/paypal/seller-protection, read 4 Nov 2026).
Only public terms are used here. No internal PayPal documents are in this repo.
This is a product mapping, not legal advice. A lawyer should check the EU and Swiss consumer and payment rules before any real use.

| # | Public term (section) | What it says | What the app does now | Gap / action |
|---|---|---|---|---|
| 1 | Eligibility: Item Not Received | Covered, except buyer card chargebacks | Uses `seller_protection` status from PayPal | OK. We rely on PayPal's own flag. |
| 2 | Eligibility: SNAD | Not covered by Seller Protection (Ineligible Items) | SNAD FIGHT uses `matchesListing`, and the sandbox fixture for NVP says protection ELIGIBLE | Mismatch between sandbox data and the public terms. Show a warning on SNAD cases and do not claim protection covers them. |
| 3 | Evidence: proof of delivery (Physical Goods) | Tracking number, ship date, address matching the transaction, and "delivered" status | Uses `hasTracking` (yes or no) | Too weak. Add `deliveredAtBuyerAddress`, and treat "tracking exists" as not enough. Until that is answered, INR FIGHT should be YOUR_CALL. |
| 4 | Basic requirements: shipping address | Redirected items lose protection | Not checked | Add a seller question: "Was it sent to the address on the transaction?" |
| 5 | Deadline: Unauthorized claims | Proof must show the item was sent no later than 2 days after PayPal notified the seller | Shows only the response due date | Show a 2-day proof window for UNAUTHORISED cases. |
| 6 | Basic requirements: primary account address | Protection applies only if the primary PayPal account address is in the US | Not checked | Major gap for a Zurich seller. Show a warning, or ask Kate to confirm. Sandbox ELIGIBLE flags do not prove this. |
| 7 | Basic requirements: unauthorised payments | Protection only if the payment is marked eligible or partially eligible | Uses `sellerProtectionEligible` | OK. |
| 8 | Ineligible: items sent after PayPal said not to release | Not covered | Not checked | Add a question to the seller. |
| 9 | Ineligible: in-person, gift cards, etc. | Not covered | Not checked | Out of scope for the demo (online sales). Say so in the Devpost text. |

## Laws (not checked yet)
- EU consumer law (withdrawal right, refunds for distance sales) and PSD2 rules on unauthorised payments are relevant to EUR sales.
- Swiss law may also apply, since the seller is in Switzerland.
- Not reviewed. Do not state legal compliance anywhere until a lawyer has checked it.

## Decisions for Kate
1. Keep the sandbox demo as it is, and say the sandbox does not apply US-only protection? Or show a warning on every case?
2. Add the two new seller questions (delivered to the buyer's address, sent after PayPal's notice)?
3. Add the 2-day UNAUTHORISED proof window to the case screen?

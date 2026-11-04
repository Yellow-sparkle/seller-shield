# Policy mapping: PayPal public seller-protection terms vs. Seller Shield rules

Seller country: Portugal (confirmed by Kate, 4 Nov 2026). Currency: EUR.
Source used: Portugal page, https://www.paypal.com/pt/webapps/mpp/ua/seller-protection (last updated 17 July 2025, read 4 Nov 2026).
Only public PayPal terms are used. No internal PayPal documents are in this repo.
Other country pages checked for comparison: Switzerland, https://www.paypal.com/ch/webapps/mpp/ua/seller-protection (13 Jan 2025). The US legal hub is not the right source for a Portuguese seller.
This is a product mapping, not legal advice. A lawyer should check EU and Portuguese consumer and payment rules before any real use.

| # | Public term (PT page section) | What it says | What the app does now | Gap / action |
|---|---|---|---|---|
| 1 | "O que é elegível": Item Not Received | Covered, except card-issuer chargebacks | Uses PayPal's `seller_protection` status | OK. |
| 2 | "Artigos e transações não elegíveis": SNAD | Excluded (Significantly Not As Described) | SNAD FIGHT uses `matchesListing`. The sandbox NVP fixture says protection ELIGIBLE. | Conflict with the public terms. Warn on SNAD cases, and never say protection covers them. |
| 3 | "Estabelecer comprovativo de entrega": Item Not Received | Tracking number, delivery date, status "entregue" (delivered), address matching the transaction | Uses `hasTracking` (yes or no) | Too weak. Add `deliveredAtBuyerAddress`. Until that is answered, INR FIGHT should be YOUR_CALL. |
| 4 | "Requisitos básicos": unauthorised claims | Proof of shipment within 2 days after PayPal's notice | Shows only the response due date | Show a 2-day proof window for UNAUTHORISED cases. |
| 5 | "Requisitos básicos": address | Goods redirected elsewhere are ineligible | Not checked | Add a seller question: "Was it sent to the address on the transaction?" |
| 6 | "Requisitos básicos": primary account address | Must be in Portugal | Not checked | Matches Kate's country, if her PayPal primary address is in Portugal. Ask her to confirm. |
| 7 | "Requisitos básicos": payment marked eligible | Required for unauthorised claims | Uses `sellerProtectionEligible` | OK. |
| 8 | "Itens não elegíveis": shipped after PayPal advised against it | Not covered | Not checked | Add a seller question. |
| 9 | "Itens não elegíveis": in-person, gift cards, etc. | Not covered | Not checked | Out of scope for online sales. Say so in the Devpost text. |

## Laws (not checked yet)
- EU consumer law (distance-selling withdrawal right, refunds) and PSD2 rules on unauthorised payments apply to a Portuguese seller selling in EUR.
- Portuguese implementation of these rules has not been checked.
- Do not state legal compliance anywhere until a lawyer has checked it.

## Decisions still open for Kate
1. Keep the sandbox demo and disclose that the SNAD and eligibility flags differ from the public terms?
2. Add the two seller questions (delivered to the buyer's address, shipped after PayPal's advice)?
3. Add the 2-day UNAUTHORISED window to the case screen?
4. Show the policy basis on each recommendation? (Kate answered yes on 4 Nov 2026. Not built yet.)

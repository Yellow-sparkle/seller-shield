# 0002: Deterministic INR proof rule and seller proof questions

**Status:** Accepted by Kate, 5 Nov 2026. Code in `lib/proof.ts`, applied in `lib/recommend.ts`.

## Context
Item-not-received (INR) protection depends on proof of delivery: a verifiable tracking number, a delivered status, a delivery date, and a recipient address matching the transaction (PT Seller Protection terms). The app only knew whether tracking existed, so it could recommend FIGHT without the proof PayPal needs (golden case G09 and the legal review, finding 3).

## Decision
- **No tracking: REFUND**, HIGH confidence. Protection cannot be met without tracking.
- **Tracking, but delivery, date or address not confirmed: YOUR_CALL**, LOW confidence. Wait and check the carrier page, then decide.
- **Tracking, delivered, date and address confirmed: the model decides** (FIGHT is allowed).
- **Tracking unanswered: the model decides**, as before.

The rule is applied after the model and the grounding guard, so the model cannot override it. Only INR is affected.

## Seller questions (data path)
`SellerAnswer` gains `delivered`, `deliveryDate` and `deliveredToTransactionAddress`. They flow into the facts and the proof check. The case screen does not ask them yet. That UI is the next step.

## Tests
- `lib/proof.test.ts`: no tracking is REFUND; tracking without confirmed delivery is YOUR_CALL; full proof lets the model decide; unanswered tracking and non-INR cases are unaffected; the rule overrides a model FIGHT.
- All 59 unit tests pass.

## Known effects and gaps
- **Golden G01** (tracking yes, no delivery answers) now gives YOUR_CALL. Its hand-written label was FIGHT, which assumed tracking proves delivery. Kate's label is YOUR_CALL with a deadline rule, so the golden label should be updated to match. Not yet changed.
- **G02** (no tracking) now gives REFUND by rule, matching its label.
- The rule and the seller questions are not yet live-tested. Rerun the red-flag subset and the judge after pulling.
- The carrier's delivered status is only confirmed if the seller answers. Automatic tracking status depends on PayPal's API (Day-1 check, unverified).

# 0004: A missed reply deadline means REFUND

**Status:** Accepted, 8 Nov 2026 (Kate, golden case G08). Changes part of ADR 0001.

## Context
ADR 0001 forced YOUR_CALL whenever the seller cannot respond. For a case whose reply deadline has passed, that told the seller "you decide" when there is little left to decide. Seller Protection needs the seller to answer PayPal in time. Once the deadline passes, protection no longer applies in practice, and PayPal usually decides for the buyer. Source: PayPal Seller Protection terms, from memory. PayPal's pages could not be fetched to confirm the wording.

## Decision
- **OVERDUE:** REFUND with HIGH confidence (Weak case on screen). The model cannot override it.
- **Under review, closed, no due date:** unchanged, YOUR_CALL with LOW confidence (ADR 0001).

The next step on the card is: ask the buyer, outside PayPal, to close the case if the parcel arrived, or appeal after PayPal decides. The appeal window is not confirmed.

Code: `enforceEligibility` in `lib/recommend.ts`, `recommendationFor` in `app/cases/page.tsx`. Golden G08 now expects REFUND. Test: `lib/recommend.test.ts` (G08).

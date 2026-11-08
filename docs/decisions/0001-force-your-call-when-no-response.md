# 0001: Force YOUR_CALL when the seller cannot respond

**Status:** Accepted, 4 Nov 2026. Commit `2e387ed` on `claude/project-thread-asfll4`.

## Context
The AI case recommends FIGHT, REFUND or YOUR_CALL. The seller's eligibility to respond is decided by code (`responseEligibility` in `lib/rules.ts`). Before this change, the model's answer was final, and the eligibility result only went into the prompt as a fact.

The golden check case G09 exposed the gap. PayPal is reviewing the case, so the seller cannot respond. The expected answer is YOUR_CALL. The model returned FIGHT with HIGH confidence, and its own claims said "you can't respond now". Nothing in the code stopped the FIGHT.

A FIGHT on a case the seller cannot answer sends the seller to act on a recommendation that cannot be carried out. It is the same kind of error as the top PRD risk, "AI recommends fighting a case that should be refunded". The PRD already says eligibility is decided by code, not the model (PRD "Split of work", line 181).

## Decision
After the model answers and the grounding guard runs, the app checks eligibility. If `canRespond` is false, the recommendation becomes YOUR_CALL with LOW confidence. The model cannot override this.

Code: `enforceEligibility` in `lib/recommend.ts`, called from `recommend()` after `applyGuard`.

Cases where `canRespond` is false (from `responseEligibility`):
- **CLOSED:** the status is not OPEN or WAITING_FOR_SELLER_RESPONSE. This covers cases under PayPal review, provided their status is not one of those two. The mapping of PayPal's review status to CLOSED is an inference from the code; confirm it against a live review case.
- **OVERDUE:** the response due date has passed.
- **NO_DUE_DATE:** PayPal gave no due date.

## Why this approach
- **Deterministic:** the rule is in code, so it can be tested without a model call and it cannot drift.
- **Narrow:** it only changes the outcome when the seller cannot respond. Everything else is still the model's call.
- **Consistent with the seller's safety:** the seller is told to decide, not given advice they cannot act on.

## Tests
- `lib/recommend.test.ts`: G09 (FIGHT forced to YOUR_CALL when the seller cannot respond) and a FIGHT that stands when the seller can respond.
- All 46 unit tests pass.
- Live red-flag subset (`scripts/golden-check.ts --red-flag`): 7 of 7 match. G09 is YOUR_CALL. This was one run.

## Known gaps and trade-offs
- **Confidence label (resolved):** a forced YOUR_CALL now also sets confidence to LOW, because the model's confidence judged the discarded FIGHT. Before this, G09 showed YOUR_CALL with HIGH confidence.
- **Override is silent:** the model's disagreement is not recorded. We could log the original answer for review.
- **One live run:** the model can vary between runs. Repeat the red-flag subset before the demo.
- **Review status mapping:** the claim that PayPal's review status maps to CLOSED is inferred from the code. Unverified against a live review case.

## Update, 8 Nov 2026 (Kate, golden G11)
- **NO_DUE_DATE** stays YOUR_CALL (Mixed), but the reply buttons stay on with the warning "Deadline unknown: check it in PayPal first". PayPal refuses anything it no longer accepts, and the screen shows that refusal.
- **OVERDUE** now means REFUND (ADR 0004).
- All 21 golden labels are signed off by Kate (`signedOff` in lib/golden/cases.json).

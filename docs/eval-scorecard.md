# Eval results scorecard

Only measured results are shown. Golden and judge results are from one live run on 6 Nov 2026 (recommender: Claude Opus 5.5, judge: Claude Sonnet 5.5).

Status key: **Pass** meets the target. **Near** is within 10% of the target. **Below** is more than 10% under the target.

## Summary

| Category | Target | Subcomponent | Result | Status |
|---|---|---|---|---|
| Accuracy | ≥ 90% | Golden-set match rate (19 synthetic cases) | 18 / 19 (95%) | Pass |
| Accuracy | 100% | Red-flag subset match (7 cases, 5 Nov 2026) | 7 / 7 (100%) | Pass |
| Grounding | ≥ 95% | Cases where the judge found every claim supported | 19 / 19 (100%) | Pass |
| Grounding | 0% | Claims dropped by the grounding guard (3 sandbox cases) | 0 / 18 (0%) | Pass |
| Style | 100% | Cases judged plain English | 19 / 19 (100%) | Pass |
| Style | 100% | Cases judged free of outcome predictions | 19 / 19 (100%) | Pass |
| Style | 0% | Claims that predict PayPal's decision (3 sandbox cases, regex) | 0 / 18 (0%) | Pass |
| Style | 100% | Claims citing at least one case fact (3 sandbox cases) | 18 / 18 (100%) | Pass |
| Code checks | 100% | Unit tests passing | 123 / 123 (100%) | Pass |

## By dispute reason (golden set)

| Subcomponent | All (19) | Item not received (8) | Not as described (4) | Unauthorised (4) | Other or new reason (3) |
|---|---|---|---|---|---|
| Golden match rate | 18 / 19 (95%), Pass | 8 / 8 (100%), Pass | 4 / 4 (100%), Pass | 3 / 4 (75%), Below | 3 / 3 (100%), Pass |
| Judge: all claims supported | 19 / 19 (100%), Pass | 8 / 8, Pass | 4 / 4, Pass | 4 / 4, Pass | 3 / 3, Pass |

## The one miss, and the fix

- **G03 (unauthorised, expected FIGHT, got YOUR_CALL with low confidence).** The seller's shipment proof (PayPal's notice date, the shipment date, and the shipping address match) was never passed to the model, so it couldn't see the proof and played safe.
- **Fix (6 Nov 2026):** those three answers are now passed to the model as facts, with a note on the 2-day rule, and a unit test covers it. The golden check needs one more run to confirm G03.

## Notes

- The 3 sandbox cases are the real PayPal sandbox disputes recorded on 6 Nov 2026: 2 refund recommendations (high confidence) and 1 seller's-call recommendation (low confidence).
- Model output can vary between runs. These are single runs.
- The judge is also an AI model, so its scores support the other checks rather than prove them.

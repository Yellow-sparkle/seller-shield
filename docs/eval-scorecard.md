# Eval results scorecard

![Eval Results Scorecard](eval-scorecard.png)

| Category | KPI | Ratio passing | Subcomponent | All | Item not received | Not as described | Unauthorised | Other / new reason |
|---|---|---|---|---|---|---|---|---|
| Accuracy | ≥ 90% | 1 / 1 | Recommendation matches expected answer | **100%** (19/19) | 100% (8/8) | 100% (4/4) | 100% (4/4) | 100% (3/3) |
| Grounding | ≥ 95% | 2 / 2 | Cases with every claim supported (judge) | **95%** (18/19) | 100% (8/8) | 75% (3/4) | 100% (4/4) | 100% (3/3) |
| | | | Claims kept by grounding guard (sandbox) | **100%** (18/18) | 100% (12/12) | 100% (6/6) | N/A | N/A |
| Style | 100% | 2 / 2 | Plain English (judge) | **100%** (19/19) | 100% (8/8) | 100% (4/4) | 100% (4/4) | 100% (3/3) |
| | | | No prediction of PayPal's decision (judge) | **100%** (19/19) | 100% (8/8) | 100% (4/4) | 100% (4/4) | 100% (3/3) |

Below KPI: Not as described, 75% on the judge check (one case added evidence examples that are not in the facts).

## Detail

Only measured results are shown. The summary uses the latest live run on 6 Nov 2026, with the golden and judge checks run on the same code (recommender: Claude Opus 5.5, judge: Claude Sonnet 5.5).

Status key: **Pass** meets the target. **Near** is within 10% of the target. **Below** is more than 10% under the target.

## Summary

| Category | Target | Subcomponent | Result | Status |
|---|---|---|---|---|
| Accuracy | ≥ 90% | Golden-set match rate (19 synthetic cases), after the G03 fix | 19 / 19 (100%) | Pass |
| Accuracy | ≥ 90% | Golden-set match rate, first run before the fix | 18 / 19 (95%) | Pass |
| Accuracy | 100% | Red-flag subset match (7 cases, 5 Nov 2026) | 7 / 7 (100%) | Pass |
| Grounding | ≥ 95% | Cases where the judge found every claim supported | 18 / 19 (95%) | Pass |
| Grounding | 0% | Claims dropped by the grounding guard (3 sandbox cases) | 0 / 18 (0%) | Pass |
| Style | 100% | Cases judged plain English | 19 / 19 (100%) | Pass |
| Style | 100% | Cases judged free of outcome predictions | 19 / 19 (100%) | Pass |
| Style | 0% | Claims that predict PayPal's decision (3 sandbox cases, regex) | 0 / 18 (0%) | Pass |
| Style | 100% | Claims citing at least one case fact (3 sandbox cases) | 18 / 18 (100%) | Pass |
| Code checks | 100% | Unit tests passing | 125 / 125 (100%) | Pass |

## By dispute reason (golden set)

| Subcomponent | All (19) | Item not received (8) | Not as described (4) | Unauthorised (4) | Other or new reason (3) |
|---|---|---|---|---|---|
| Golden match rate, after the fix | 19 / 19 (100%), Pass | 8 / 8 (100%), Pass | 4 / 4 (100%), Pass | 4 / 4 (100%), Pass | 3 / 3 (100%), Pass |
| Golden match rate, first run | 18 / 19 (95%), Pass | 8 / 8 (100%), Pass | 4 / 4 (100%), Pass | 3 / 4 (75%), Below | 3 / 3 (100%), Pass |
| Judge: all claims supported, latest run | 18 / 19 (95%), Pass | 8 / 8 (100%), Pass | 3 / 4 (75%), Below | 4 / 4 (100%), Pass | 3 / 3 (100%), Pass |

## What the checks caught

- **G03 (unauthorised, expected FIGHT, got YOUR_CALL with low confidence).** The seller's shipment proof (PayPal's notice date, the shipment date, and the shipping address match) was never passed to the model, so it couldn't see the proof and played safe.
- **Fix (6 Nov 2026):** those three answers are now passed to the model as facts, with a note on the 2-day rule, and a unit test covers it. The rerun gave G03 FIGHT with high confidence, and 19 of 19 overall.
- **G05 (not as described), one unsupported claim.** The AI wrote that PayPal asks for evidence "such as listing photos or the description". The evidence type is right, but the examples are not in the case facts. 4 of 5 claims in that case were supported.
- **Judge reliability (fixed).** The judge once sent a corrected second answer, which crashed the run, and it flagged true "you confirmed" claims because it didn't know those facts are the seller's own answers. The parser now uses the last valid answer, and the fact notes say which facts are the seller's answers.

## Notes

- The 3 sandbox cases are the real PayPal sandbox disputes recorded on 6 Nov 2026: 2 refund recommendations (high confidence) and 1 seller's-call recommendation (low confidence).
- Model output can vary between runs. Each figure comes from a single run.
- The judge is also an AI model, so its scores support the other checks rather than prove them.

# Eval results scorecard

Only measured results are shown. A cell that says "Run pending" has not been measured yet.

Status key: **Pass** meets the target. **Near** is within 10% of the target. **Below** is more than 10% under the target.

## Summary

| Category | Target | Subcomponent | Result | Status | Source |
|---|---|---|---|---|---|
| Accuracy | ≥ 90% | Golden-set match rate (19 synthetic cases) | Run pending | — | `scripts/golden-check.ts` |
| Accuracy | 100% | Red-flag subset match (7 cases) | 7 / 7 (100%), one run, 5 Nov 2026 | Pass | `docs/decisions/0001-force-your-call-when-no-response.md` |
| Grounding | ≥ 95% | Claims supported by case facts (judge) | Run pending | — | `scripts/judge-check.ts` |
| Grounding | 0% | Claims dropped by the grounding guard (3 sandbox cases) | 0 of 18 (0%) | Pass | `lib/recorded/recommendations.json` |
| Style | 0% | Claims that predict PayPal's decision (3 sandbox cases) | 0 of 18 (0%) | Pass | `lib/recorded/recommendations.json` |
| Style | 100% | Claims citing at least one case fact (3 sandbox cases) | 18 of 18 (100%) | Pass | `lib/recorded/recommendations.json` |
| Style | 100% | Cases judged plain English | Run pending | — | `scripts/judge-check.ts` |
| Code checks | 100% | Unit tests passing | 122 of 122 (100%), 6 Nov 2026 | Pass | `lib/*.test.ts` |

## By dispute reason (golden set)

| Subcomponent | All | Item not received (8) | Not as described (4) | Unauthorised (4) | Other or new reason (3) |
|---|---|---|---|---|---|
| Golden match rate | Run pending | Run pending | Run pending | Run pending | Run pending |
| Claims supported (judge) | Run pending | Run pending | Run pending | Run pending | Run pending |

## Notes

- The 3 sandbox cases are the real PayPal sandbox disputes recorded on 6 Nov 2026: 2 refund recommendations (high confidence) and 1 seller's-call recommendation (low confidence).
- The red-flag result is from one run before later rule changes. Model output can vary between runs.
- The judge is also an AI model (Claude Sonnet 5.5), so its scores support the other checks rather than prove them.

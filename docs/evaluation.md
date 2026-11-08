# How we evaluate the AI

Based on the "Layers of LLM Evaluation" table. Only the checks Seller Shield actually runs are listed.

| Layer | The goal | When we run it | Metrics we use | How (in the repo) |
|---|---|---|---|---|
| Core quality | The recommendation is right, and its reasons are true to the case facts. | Unit tests before each push. Live checks before a demo or after a prompt change. | **Hallucination**: each reason is judged supported or not supported by the case facts. **Grounding guard**: a reason is dropped unless it names fact fields that exist in the case. **Golden-set accuracy**: the share of hand-written cases where the recommendation matches the expected answer. | `lib/judge.ts` and `scripts/judge-check.ts` (Claude as judge). `lib/guard.ts` (code, no AI). `lib/golden/cases.json` and `scripts/golden-check.ts`. |
| Style | Replies are short, plain English, valid output, and never predict PayPal's decision. | Unit tests before each push. The judge also scores plain English on live checks. | **Conciseness**: draft replies are capped at 1,200 characters, and the prompt asks for under 150 words. **Custom regex**: phrases that predict the outcome are removed from reasons and rejected in drafts. **JSON validity**: every model reply must parse into the expected shape, or it is rejected. **Plain English**: a yes/no flag from the judge. | `lib/reply.ts`, `lib/guard.ts`, `lib/judge.ts`, with tests in `lib/*.test.ts`. |

## The golden set: why it exists and what counts as passing

**Why.** The golden set (`lib/golden/cases.json`) checks that a seller gets the right case strength for the situations that matter. A wrong answer costs real money. Fighting a case the seller should refund loses the case and wastes their time. Refunding a case they would have won loses the sale. The PRD names "AI recommends fighting a case that should be refunded" as the top risk.

**How the cases were chosen.**
- At least one case for each branch of each rule: item not received, not as described, unauthorised, card issuer, other and unknown reasons, deadline passed, no due date, and under review.
- Edge cases that broke earlier versions, such as G03, where shipment proof did not reach the AI.
- Two cases (G20, G21) built the way the case screen builds them, where the rules leave the answer to the AI.
- Kate signed off every expected answer (8 Nov 2026). When a case looked wrong, she changed the rule, not the test.

**What counts as passing.** The rules and the AI are measured separately, because the rules decide 17 of the 21 cases.

| What | Target | Why this target |
|---|---|---|
| Rule-decided cases (17) | 17 / 17, every test run | The rules are code. Any miss is a bug, so the target is 100%, and it's checked without the AI. |
| AI-decided cases (4) | 4 / 4, on 3 runs | With only 4 cases, one miss is 75%, so every miss is looked at. Three runs show the answer is stable. |
| Worst error: Strong when the expected answer is Weak | 0, always | This sends a seller to fight a case they should refund (the PRD's top risk). One is a stop. |
| Judge: every reason supported by the case facts | ≥ 95% of cases | A false reason misleads the seller. The judge is also an AI, so 95% allows for its own mistakes. Every flagged reason is read by a person. |
| Style: plain English, no prediction of PayPal's decision | 100% | The app must never promise an outcome. A prediction is also removed in code. |
| Judge agrees with a human label (benchmark, 58 reasons) | ≥ 90% | The judge's own scores only count if it agrees with a person. Kate labels the reasons of 10 sample cases without seeing the judge's verdicts (`judge-check --export`, then `scripts/judge-agreement.ts`). |
| Reasons the judge passed that a human marked not supported | 0 | These are the misses that would let a false reason reach a seller. |
| Deliberately false reasons the judge catches | all | A benchmark with only true reasons can't show the judge catches false ones. 12 hand-written false reasons, judged separately (`scripts/judge-rebenchmark.ts`). |

**When to run it.** The no-AI checks run with every test run. The live AI checks run before a demo, after a prompt change, and after a rule change.

## Limits

- The judge is also an AI model, so its scores are a supporting check, not proof.
- The judge checks that each reason is true, not that each one matters for the case strength. A true but unimportant reason (for example the disputed amount) would pass. I chose not to add a relevance check for the hackathon, because I saw no such reasons in the 58 I labelled and trusting a new check would need another round of labels.
- Eligibility and the rules-based recommendation are decided in code, not by the model. The evaluations above cover the model's explanation and draft reply.
- Since 8 Nov 2026 (second review S8): the golden and judge checks build each answer the way the case screen does (`caseAnswer`) when a case holds an order and card answers (G20, G21). The rules decide 17 of the 21 golden cases. Only G01, G03, G20 and G21 test the model's own answer, so AI and rule results are reported separately and never as one total.
- Recorded answers: the case screen never calls the model live. Each new recording keeps the answer it was made from. The screen hides a recording made from other facts, and `scripts/stale-check.ts` (no AI) lists the ones to re-record. `lib/eval-answers.test.ts` checks that every case the model decides has a recording.
- All 21 golden labels are signed off by Kate (8 Nov 2026).

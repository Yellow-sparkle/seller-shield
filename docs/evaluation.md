# How we evaluate the AI

Based on the "Layers of LLM Evaluation" table. Only the checks Seller Shield actually runs are listed.

| Layer | The goal | When we run it | Metrics we use | How (in the repo) |
|---|---|---|---|---|
| Core quality | The recommendation is right, and its reasons are true to the case facts. | Unit tests before each push. Live checks before a demo or after a prompt change. | **Hallucination**: each reason is judged supported or not supported by the case facts. **Grounding guard**: a reason is dropped unless it names fact fields that exist in the case. **Golden-set accuracy**: the share of hand-written cases where the recommendation matches the expected answer. | `lib/judge.ts` and `scripts/judge-check.ts` (Claude as judge). `lib/guard.ts` (code, no AI). `lib/golden/cases.json` and `scripts/golden-check.ts`. |
| Style | Replies are short, plain English, valid output, and never predict PayPal's decision. | Unit tests before each push. The judge also scores plain English on live checks. | **Conciseness**: draft replies are capped at 1,200 characters, and the prompt asks for under 150 words. **Custom regex**: phrases that predict the outcome are removed from reasons and rejected in drafts. **JSON validity**: every model reply must parse into the expected shape, or it is rejected. **Plain English**: a yes/no flag from the judge. | `lib/reply.ts`, `lib/guard.ts`, `lib/judge.ts`, with tests in `lib/*.test.ts`. |

## Limits

- The judge is also an AI model, so its scores are a supporting check, not proof.
- Eligibility and the rules-based recommendation are decided in code, not by the model. The evaluations above cover the model's explanation and draft reply.
- Since 8 Nov 2026 (second review S8): the golden and judge checks build each answer the way the case screen does (`caseAnswer`) when a case holds an order and card answers (G20, G21). The rules decide 17 of the 21 golden cases. Only G01, G03, G20 and G21 test the model's own answer, so AI and rule results are reported separately and never as one total.
- Recorded answers: the case screen never calls the model live. Each new recording keeps the answer it was made from. The screen hides a recording made from other facts, and `scripts/stale-check.ts` (no AI) lists the ones to re-record. `lib/eval-answers.test.ts` checks that every case the model decides has a recording.
- All 21 golden labels are signed off by Kate (8 Nov 2026).

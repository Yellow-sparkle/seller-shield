# Seller Shield

A companion for small PayPal sellers. It shows money at risk and reply deadlines, helps add missing tracking to PayPal, and uses an AI model (Claude Opus 5.5) to recommend FIGHT, REFUND or YOUR_CALL (the seller decides) on each dispute. The seller always makes the final call.

Built for the PayPal AI Hackathon. PayPal sandbox only: EUR, no real buyers or money.

## Research and planning

Before building, I studied the problem and wrote a plan. Both are in this repo:

- [Target user research](docs/research/target-user-research.pdf) (PDF, 11 slides; [.pptx](docs/research/target-user-research.pptx)): how I did the research, the persona Maria Costa (a composite, not a real person), an empathy map of 16 verbatim seller quotes from the PayPal Community forum, use cases with what was built, competitors, the problem and mission, and RICE priorities.
- [Product requirements (PRD)](docs/product/PRD.md): scope, technical design, build plan, success metrics and risks, written 3 Nov and updated as decisions changed. I wrote it with AI agents playing a product, technical, research and evals review team.
- [Decisions](docs/decisions/): why each larger choice was made.

## What it does

| Screen | Address | What it does | Data |
|---|---|---|---|
| Health scan (home) | `/` | Three cards: money at risk, sandbox orders missing tracking, next reply deadline. Each card opens the rows behind its number. Shows the time it was read, and an error instead of zero if PayPal can't be reached. | Disputes are read live from the PayPal sandbox. Tracking state comes from the order data in the repo. |
| Tracking fixer | `/orders` | AG Grid of 204 orders with filters (ready to send to PayPal, missing tracking, held, not protected, has dispute, sandbox only, last 30 days), quick filter, status pills, a pinned totals row, a "View case" button on disputed orders, row selection and a review step. "Confirm and send" adds tracking in PayPal, and each row shows PayPal's result. | 4 real sandbox orders (one for each sandbox dispute), plus 200 seeded orders labelled "Demo data" that can't be sent. Sends to the PayPal sandbox only. |
| Dispute cases | `/cases` | Each dispute with amount, amount after fees, deadline, seller protection, the AI recommendation with its reasons, an evidence checklist, and a reply draft. After the seller approves, the app sends the reply to the buyer, sends the order's tracking as proof of fulfilment on item-not-received cases, or accepts the claim with a refund, through PayPal's Disputes API. Photos and documents for other reasons are uploaded in the PayPal Resolution Center. | Disputes from `lib/fixtures/sandbox-disputes.json` (copied from PayPal sandbox responses), plus the demo case from `lib/fixtures/demo-disputes.json`. Recommendations from a recorded live Claude run. Reply drafts come from fixed templates. Sends go to the PayPal sandbox only, and only for cases PayPal still accepts a response on. |

How the recommendation works: deterministic rules (`lib/proof.ts`, `lib/rules.ts`) decide eligibility and force an answer where the rules are clear. Otherwise one Claude call returns FIGHT, REFUND or YOUR_CALL, with reasons that cite the case facts they rely on. Reasons without a cited fact, or that predict PayPal's decision, are removed. Low confidence always becomes YOUR_CALL.

## Requirements

- Node.js 22.6 or newer (for `--experimental-strip-types`), and npm.
- PayPal sandbox app credentials, for the health scan and the tracking fixer. In the PayPal Developer Dashboard, open Apps & Credentials, switch to Sandbox, and open (or create) a REST app linked to a sandbox business account. Copy its Client ID and Secret.
- An Anthropic API key, only for the live AI checks. The case screen uses recorded results and doesn't need it.

## Run it

```bash
git clone https://github.com/Yellow-sparkle/seller-shield.git
cd seller-shield
npm install
```

Create `.env.local` in the project folder:

```
PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-sandbox-secret
ANTHROPIC_API_KEY=your-key-here
```

Then start the app:

```bash
npm run dev
```

Open http://localhost:3000 for the health scan. The bar at the top links to the orders grid (`/orders`) and the dispute cases (`/cases`). Restart `npm run dev` after changing `.env.local`.

Never commit `.env.local`. Files starting with `.env` are listed in `.gitignore`.

## Run the tests

```bash
node --experimental-strip-types --test lib/*.test.ts
```

## Add a new sandbox dispute to the case screen

Open a case as the sandbox buyer (Resolution Center, "Item not received"), then:

```bash
# Reads the dispute from PayPal (read-only) and adds it to lib/fixtures/sandbox-disputes.json
node --env-file=.env.local --experimental-strip-types scripts/add-dispute.ts PP-R-XXX-12345678

# Records Claude's recommendation for it, so the case screen shows it
node --env-file=.env.local --experimental-strip-types scripts/live-check.ts --record
```

## Run the AI checks

These call Claude and cost a few cents per case. They need `ANTHROPIC_API_KEY` in `.env.local`.

```bash
# Recommendation for each sandbox dispute (add --record to save results for the case screen)
node --env-file=.env.local --experimental-strip-types scripts/live-check.ts

# Golden set: 21 cases with expected answers signed off by Kate. G20 and G21 are built from an order and card answers, like the case screen
node --env-file=.env.local --experimental-strip-types scripts/golden-check.ts

# Judge: checks each reason against the case facts
node --env-file=.env.local --experimental-strip-types scripts/judge-check.ts

# No AI call: lists recorded answers whose facts no longer match what the case screen builds
node --experimental-strip-types scripts/stale-check.ts
```

The rules decide most golden cases before the AI's answer counts, so report the AI and the rules separately (see the scorecard).

How we evaluate the AI: [docs/evaluation.md](docs/evaluation.md). Results: [docs/eval-scorecard.md](docs/eval-scorecard.md).

## Not built yet

These are in the product plan but not in this version:

- Sending evidence files to PayPal's Disputes API. The app sends messages, refunds and item-not-received tracking as evidence, not files. The tracking evidence call has not yet been tried against the live sandbox.
- Reading tracking status back from PayPal for the health scan.

## Stack

Next.js (App Router, TypeScript), AG Grid Community, PayPal REST APIs (Disputes, Shipment Tracking, sandbox), Anthropic SDK (Claude Opus 5.5 for recommendations, Claude Sonnet 5.5 as judge).

## Licence

MIT. See [LICENSE](LICENSE).

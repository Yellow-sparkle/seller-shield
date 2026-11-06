# Seller Shield

A companion for small PayPal sellers. It shows open buyer disputes with their deadlines and held funds, and uses an AI model (Claude Opus 5.5) to recommend FIGHT or REFUND. The seller always makes the final call.

Built for the PayPal AI Hackathon. Sandbox only: EUR, no real buyer data.

## What it does now

- **Case screen** (`/`): lists the disputes in a grid, with amount, net held funds, response deadline, days left, seller protection and status.
- **Recommendation** (`scripts/live-check.ts`): one Claude call per dispute. It returns FIGHT, REFUND or YOUR_CALL, with claims that cite the facts they rely on. Claims without a cited fact, or that predict the outcome, are removed. Low confidence always returns YOUR_CALL.
- **Health route** (`/api/health`): returns `{"ok":true}`.

Sandbox disputes are stored in `lib/fixtures/sandbox-disputes.json`, copied from PayPal's Disputes API responses. The app does not call PayPal yet.

## Requirements

- Node.js 22.6 or newer (for `--experimental-strip-types`), and npm.
- For the recommendation: an Anthropic API key. Create one at console.anthropic.com. It is not needed for the case screen or the tests.

## Run it

```bash
git clone https://github.com/Yellow-sparkle/seller-shield.git
cd seller-shield
npm install
npm run dev
```

Open http://localhost:3000 for the case screen.

## Run the tests

```bash
node --experimental-strip-types --test lib/*.test.ts
```

How we evaluate the AI (hallucination, grounding, golden set, style checks): see [docs/evaluation.md](docs/evaluation.md).

## Run the live recommendation check

Create `.env.local` in the project folder with one line:

```
ANTHROPIC_API_KEY=your-key-here
```

Then run:

```bash
node --env-file=.env.local --experimental-strip-types scripts/live-check.ts
```

This makes one call per sandbox dispute. Each call costs about 2 cents.

Never commit `.env.local`. It is listed in `.gitignore`.

## Stack

Next.js (App Router, TypeScript), AG Grid Community, Anthropic SDK, Render (hosting), Postman (API checks).

## Licence

MIT. See [LICENSE](LICENSE).

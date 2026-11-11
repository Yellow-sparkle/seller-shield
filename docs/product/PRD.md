# PRD: Seller Shield (v1)

> The research behind the persona and the problem is in [docs/research/target-user-research.pdf](../research/target-user-research.pdf). How to run what was built is in the [README](../../README.md). Key decisions are recorded in [docs/decisions](../decisions/).

Kate · written 3 Nov 2026, final version 11 Nov 2026

Seller Shield helps small sellers who take PayPal keep the money they've earned. It finds payouts at risk, fixes missing tracking in bulk, and tells the seller in plain English whether a dispute is worth fighting, with a reply ready to approve and send. Built solo for the PayPal AI Hackathon on Devpost. Deadline **12 Nov 2026, 12:00 PST (21:00 Zurich)**.

## 1. Context

- **Event:** PayPal AI Hackathon (Devpost). Solo. 9 days, deadline 12 Nov 2026, 12:00 PST.
- **Hard requirements:** meaningful use of the PayPal developer platform (sandbox) and an AI tool; a working demo judges can run (hosted URL or run instructions); public repo with a licence; demo video under 3 min on YouTube; text description; list of tools used.
- **Judging:** technological implementation, design, potential impact, innovation, presentation.
- **Sponsor prize targeted:** Best Use of AG Grid (the orders/tracking table).

## 2. Problem

Small online sellers who take PayPal lose money and evenings to payment holds and disputes. Tracking often isn't attached to their PayPal transactions, which delays hold release and can remove Seller Protection. "Not as described" disputes feel like their word against the buyer's, so they often refund just to make the problem go away.

**Evidence** (verbatim, PayPal Community forum):
- "My first order comes through and PayPal locks down my account and freezes the funds. $30."
- "So to be clear, the customer now has the product and the money"
- "why do they always favour the buyer, without proper proof"
- "I don't want to wait 21 days or more for MY MONEY."
- "I feel helpless as I am not receiving any support from PayPal."

**Note:** these come from people who went to a forum to complain, so they show the pain is real, not how common it is. There are no seller interviews yet; the pilot (section 9) is where that gets tested.

## 3. Target user

- **Segment:** small online sellers on Shopify or WooCommerce who take PayPal, ~50–1,000 orders/month, owner handles disputes personally.
- **Persona:** Maria Costa, 34, ceramics shop in Porto, 14 months old, ~200 orders/month, avg €60, Shopify + PayPal checkout. *"I make pottery, not paperwork. One dispute can eat my whole evening."*
- **Goals:** keep the money she's earned; handle a dispute in minutes; get payouts released faster.
- **Context:** Maria handles disputes in the evening after studio work, tired, possibly on a laptop on the sofa. She doesn't know PayPal's policy vocabulary and doesn't want to learn it. The emotional job is "make me feel I'm not being robbed and I'm not stupid." Maria is a composite of real sellers from the PayPal Community forum, and her portrait is AI-generated.

## 4. Mission and hypotheses

**Mission:** We make it easy for small sellers who take PayPal to keep the money they've earned and settle disputes in minutes, not evenings.

**Hypotheses the build and pilot test**

| # | Hypothesis | Tested by |
|---|---|---|
| H1 | Many small PayPal sellers have money held or unprotected because tracking isn't on their PayPal transactions. | Pilot: ≥6 of 15 scans find ≥€200 held or unprotected |
| H2 | When shown the gap, sellers fix it right away if it's one bulk action. | Pilot: ≥5 sellers bulk-add tracking in their first session |
| H3 | A plain-English fight or refund recommendation with a ready reply gets a seller through a dispute in minutes, and they trust it enough to send. | Hackathon: demo works end-to-end. Pilot: dispute-case metric, incl. 90-day backtest |
| H4 | Sellers will pay a flat fee rather than a % of recovered money. | Pilot: ≥3 pre-pay €15–19/month; ≥40% "very disappointed" |

**Stop or pivot** if fewer than 4 of 15 scans find a real gap, or nobody pays.

## 5. Competition (checked 3 Nov 2026)

| | What it does | What it doesn't |
|---|---|---|
| PayPal today | Resolution Center, Seller Protection. Chargeback Protection: card payments via Advanced checkout, only "unauthorized" and "item not received". | No advice on whether to fight |
| Tracking-sync apps (Synctrack 5.0★/451, PaySync $0–19/mo, PalSync, AST Pro) | Push tracking to PayPal. PaySync $19 has a dispute dashboard. | No recommendations |
| Chargeflow (25% of recovered), Disputifier (20% of won) | Automated chargeback fighting for high-volume stores; auto-submit. | Not for small sellers; no human approval |

**Gap:** no tool tells a small seller, in plain English, whether a PayPal dispute is worth fighting, checks Seller Protection eligibility, and waits for her approval. Tracking sync alone is a commodity, so it sits inside the health scan rather than being the headline.

## 6. Scope

| Feature | R | I | C | E | Score | Phase |
|---|---|---|---|---|---|---|
| Tracking fixer | 12 | 7 | 5 | 2 | 210 | Now |
| Health scan | 15 | 5 | 4 | 1.5 | 200 | Now |
| Deadline alerts | 7 | 5 | 4 | 1 | 140 | Next |
| Evidence PDF | 7 | 3 | 4 | 1 | 84 | Next |
| AI dispute case | 7 | 9 | 3 | 4 | 47 | Now (stated bet: the differentiator and the core PayPal + AI use) |
| Prevention insights | 3 | 4 | 2 | 2 | 12 | Later |

R = est. sellers of 15 in pilot per month; I = 1–10; C = evidence it matters, 1–10, capped at 5 until user data; E = build days incl. technical risk. Score = R×I×C/E.
RICE scores pilot value. The AI dispute case ships Now despite its score, for hackathon fit and as the differentiator.

**Out of scope:** separate disputes inbox or tab, prevention insights, evidence PDF, separate "Today" feed, real Shopify OAuth (seeded store), account-limitation fixes, freelancer/services disputes.

### F1. Health scan (home screen), Must

Read-only summary of money held or at risk, orders missing tracking, and dispute deadlines.

**Acceptance**
- Shows three cards: *Money at risk* (open dispute amounts + held/withheld balance), *Missing tracking* (count of real sandbox orders without a tracker, with their total value), *Next deadline* (soonest seller-response due date, in days and as a date).
- Every number links to the rows behind it (tracking fixer filtered, or the dispute case).
- Numbers come from live sandbox calls on load, with "as of" time. If a call fails, the card says so instead of showing 0.

### F2. Tracking fixer, Must (AG Grid prize)

AG Grid table of ~200 orders with filters for missing tracking / held / unprotected, and bulk "add tracking to PayPal". Rows with an open dispute show a "Dispute" flag that opens the case.

**Acceptance**
- Columns: order #, date, buyer, amount, carrier, tracking #, PayPal tracking status, seller protection status (from PayPal), hold status, dispute flag.
- One-click filter chips: *Missing tracking*, *Held*, *Not protected*, *Has dispute*. Row selection with checkboxes and "Select all filtered".
- Bulk action: review screen listing what will be sent (order → carrier + tracking #), then one confirm, then the batch call. Per-row result: ✓ added / ✗ failed with reason. Nothing is sent before confirm.
- Seeded-only rows (not in sandbox) are labelled "Demo data" and can't be selected for bulk send.
- After success the row shows "Tracking added". Adding tracking doesn't make an order protected, so the app never says "Protected" on its own; it shows PayPal's seller protection status.
- Grid features (AG Grid Community): custom cell renderers (status pills, dispute flag button), filter chips, quick filter, checkbox selection, a totals strip above the grid, keyboard navigation.

### F3. AI dispute case, Must (the bet)

The app reads the case, checks Seller Protection eligibility and evidence, and rates the case Strong, Weak or Mixed with a plain-English reason. Clear-cut cases are decided by code rules; the rest by Claude, with every reason based on a fact from the case. Reply drafts are templates built from the case facts, not AI-written. The seller approves before anything is sent; then it goes to PayPal through the Disputes API.

**Acceptance**
- Opens from the dispute flag in the grid or from the health scan.
- Screen, top to bottom: (1) **What the buyer says**, two-sentence summary + the original text one click away; (2) **What you have**, evidence checklist (tracking, delivery confirmation, address match, photos, messages) with ✓ / ✗ / unknown; (3) **Seller Protection**, eligible / not eligible / partly, with the reason in one line; (4) **Our recommendation**, Fight / Refund / Your decision, with a 1–2 sentence reason that names the facts it used, and the amount at stake; (5) **Your reply**, editable draft; (6) **Approve and send**.
- Eligibility is decided by code from PayPal data and published rules, not by the model (section 7). The model explains it.
- If the inputs conflict or evidence is missing, the case is Mixed and says what would settle it, rather than guessing.
- Approve opens a confirm step that shows exactly what goes to PayPal (action, amount, message, attachments). Then the Disputes API call. On failure the case ends at **"Approved, ready to submit"** with the error shown, never a fake success.
- Shows a "Sandbox" badge whenever a call goes to PayPal sandbox.
- **Rules signed off by Kate (golden set, 8 Nov):**
  - Reply deadline passed: Weak (refund). Seller Protection needs a reply in time. The card shows no reply draft. The steps are: ask the buyer, outside PayPal, to close the case, or appeal after PayPal decides (ADR 0004).
  - Not as described: "matches the listing" makes the case Strong only with evidence, such as the listing and photos taken before shipping. Without evidence it is Mixed. PayPal decides on evidence from both sides.
  - No due date from PayPal: Mixed, but the reply buttons stay on with "Deadline unknown: check it in PayPal first". PayPal refuses what it no longer accepts.
  - "Your facts" on the case card: the carrier's delivery date (item not received), whether the item matches the listing (not as described), and PayPal's notice date and the shipment date (unauthorised). The rules read them.
  - Send to buyer only in the inquiry stage. Evidence only while PayPal waits for the seller.
  - All 21 golden-set labels are signed off by Kate. AI and rule results are reported separately.
- **No partial refund in v1.** The seller can refund in full or fight; a partial refund is done in the PayPal Resolution Center. Fight on an item-not-received case sends the order's tracking to PayPal as proof of fulfilment; photos and documents for other reasons are uploaded in the Resolution Center.

### F4. Deadline alerts, Next

Email before a dispute's seller-response deadline (e.g. 3 days and 1 day before), linking to the case. The health scan and the case list already show the deadline in v1.

## 7. Technical design

**PayPal (sandbox)**

| Need | API | Note |
|---|---|---|
| Sandbox transactions | Orders v2 create + capture, in EUR, on a Portuguese sandbox business account | Capture needs buyer approval in sandbox; the 5 sandbox orders were approved by hand. |
| Add tracking | Shipment tracking (`/v1/shipping/trackers-batch` for bulk, or Orders v2 `/track`) | Batch endpoint fits the bulk action. Carrier codes must match PayPal's enum. |
| Read disputes | Disputes API list / show details | Read claim text, reason, amount, `seller_response_due_date`, status. |
| Respond | Disputes API provide evidence (multipart for files), accept claim, make offer | Only allowed in certain statuses; read status first and disable invalid actions. |
| Move sandbox disputes | Sandbox-only simulate endpoints (e.g. require evidence, adjudicate) | For setting up demo states; never shown as the seller's action. |
| Money at risk | Disputes API | "Money at risk" is computed from open dispute amounts and labelled as such. |

**Never fake API calls.** Creating disputes via API needs the DISPUTE_CREATE scope, so sandbox disputes were opened as the buyer in the sandbox Resolution Center.

**AI.** Claude Opus 5.5 (`claude-opus-5-5`) through the Anthropic API, with structured JSON output. **Cost:** this is the only part of the stack that isn't free. Results are recorded after a live run, so judges clicking around never trigger new model calls. Inputs are case facts only: reason, status, amounts, dates, PayPal's eligibility flag, whether the seller can still reply, and the seller's answers. Output:

```json
{
  "recommendation": "FIGHT | REFUND | YOUR_CALL",
  "confidence": "HIGH | LOW",
  "claims": [{"text": "A tracking number was added.", "fields": ["hasTracking"]}]
}
```

Every claim names the case fields it is based on. A grounding guard drops any claim whose fields don't support it, and a second model, Claude Sonnet 5.5, checks each reason against the facts as a judge (see [docs/evaluation.md](../evaluation.md)).

- **Split of work:** code decides eligibility and hard rules (e.g. deadline passed → no fight). The model weighs the evidence on the cases the rules leave open, and explains. This keeps the one claim that most needs to be right (Seller Protection) deterministic and explainable.
- **Privacy:** the model gets only case facts (reason, status, amounts, dates, eligibility and the seller's answers, including any evidence note they type). No buyer names, emails, addresses or messages. For the hackathon it's sandbox data. For the pilot, send only what's needed, use an API tier that doesn't train on inputs, and add a privacy notice (sellers are in the EU).

**Stack (no paid tools apart from the AI)**

| Layer | Choice | Cost | Why |
|---|---|---|---|
| AI | Claude Opus 5.5 (recommendations) and Claude Sonnet 5.5 (judge) via the Anthropic API | Pay per use, kept small by recording results | Strong reasoning with structured output |
| App | Next.js (React, TypeScript); API routes hold the PayPal and Anthropic keys server-side | Free | One codebase for UI and server |
| Table | AG Grid **Community** (MIT) | Free | Custom cell renderers, quick filter, checkbox selection, keyboard navigation, without a licence or watermark |
| PayPal | Direct REST calls to the Disputes and Shipment Tracking APIs (sandbox) | Free | No SDK needed for the calls used |
| Data | Seed JSON in the repo | Free | PayPal sandbox stays the source of truth |
| Hosting | None: runs locally from the README ([decision 0003](../decisions/0003-no-hosted-demo.md)) | Free | Judges get sandbox keys in Devpost's private testing instructions |

**Data.** 200 seeded demo orders, plus 5 real sandbox orders with 5 real sandbox disputes, and 1 demo case. Each order row carries `in_paypal: true|false`.

## 8. Experience design

**Principles**
1. **Money first, in her currency.** Every screen leads with euros at stake.
2. **Plain English, no policy words.** "PayPal will probably side with you because tracking shows it was delivered to the buyer's address" rather than "INR claim, eligible under SP".
3. **She decides, we show our working.** Recommendation always shows the facts used. Nothing sends without a confirm that shows exactly what's sent.
4. **Honest about limits.** "Mixed: your decision" is a valid answer. "Not covered by Seller Protection" comes with what that means for her.

**Key moments**
- *Not as described, no cover:* "Seller Protection doesn't cover 'not as described' claims, so this comes down to your evidence. You have photos of the item before shipping, which helps." Then the recommendation.
- *Refund recommended:* frame as a choice that saves her evening, not a defeat: "Refunding €38 costs less than the time and return shipping to fight it."
- *Deadline close:* the Days left pill turns PayPal gold with "decide now" at 1–2 days, and red ("Due today" or "Passed") when due or once PayPal stops taking replies. Always with text, not colour alone.

**States:** loading ("Checking PayPal…"), empty (no disputes: "Nothing at risk right now"), API failure per card, case Mixed, submit failed → "Approved, ready to submit", dispute already closed, deadline passed (actions disabled with reason), seeded-only rows.

**Accessibility:** status uses icon + text + colour; contrast AA; grid fully keyboard-navigable.

Seller Protection is explained inline, in the eligibility line of the dispute case, only when relevant, rather than in a separate onboarding screen.

## 9. Success metrics

**Hackathon**
- Working end-to-end demo in under 3 minutes; all three Must features run against the sandbox.
- AI quality bar: on 21 golden cases with answers signed off by Kate, the recommendation matches in every run, and no reason states a fact that isn't in the input. Results: [docs/eval-scorecard.md](../eval-scorecard.md).

**Pilot** (15 sellers, 2–4 weeks, recruited with a screening form)
- Continue if: ≥6 of 15 scans find ≥€200 held or unprotected; ≥5 sellers bulk-add tracking in their first session; ≥3 pre-pay a flat €15–19/month; ≥40% "very disappointed" without it.
- **Dispute case.** Continue also requires:
  - *Backtest:* the app runs on each seller's disputes from the last 90 days (Disputes API list). For ≥60% of them, the seller says the recommendation is what they should have done, or would have changed their decision.
  - *Live:* of disputes that arrive during the pilot, at least half are sent with light edits only (seller changes under ~20% of the draft).
  - *Tracked, not a gate:* median time from opening a case to approving (aim < 10 min).
  - Why the backtest: at Reach 7/15 per month, a 2-week pilot may see only 3–4 live disputes, too few to judge on their own. The backtest asks sellers to judge in hindsight, so treat it as a signal, and weight live sends more.
- Stop or pivot if: <4 of 15 scans find a real gap, or nobody pays.
- Note: with n = 15, "40% very disappointed" is 6 people; treat it as a signal, not proof.

## 10. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| DISPUTE_CREATE scope unavailable | Medium | Low | Disputes opened as the buyer in the sandbox Resolution Center |
| Dispute response calls fail in sandbox | Medium | High | The case ends at "Approved, ready to submit" with the error, never a fake success |
| AI recommends fighting a case that should be refunded | Medium | High | Code-decided eligibility and hard rules; 21-case golden check; "Mixed" when the evidence doesn't settle it |
| Sandbox disputes change state | Medium | Medium | The app reads the live status and disables actions PayPal no longer accepts |
| Pilot needs real OAuth, live PayPal, partner approval | High | Medium (after the hackathon) | Plan it as its own phase |

## 11. Open questions

- Pricing: a flat €15–19/month is a hypothesis for the pilot.
- Add "refund after return" as a recommendation option for not-as-described claims?
- What the pilot needs from PayPal to act on other sellers' accounts (partner onboarding).

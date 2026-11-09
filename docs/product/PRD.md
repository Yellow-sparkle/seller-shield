# PRD: Seller Shield (v1)

> Working document, kept as written: sections 0 and 1 are the review notes and decisions from planning, and struck-through lines show what changed later. The research behind the persona and the problem is in [docs/research/target-user-research.pdf](../research/target-user-research.pdf). What was finally built is described in the [README](../../README.md).

3 Nov 2026 · Kate · Builder Team review (PM Twin, CTO, UXR, Evals Lead)

Seller Shield helps small sellers who take PayPal keep the money they've earned. It finds payouts at risk, fixes missing tracking in bulk, and tells the seller in plain English whether a dispute is worth fighting, with a reply ready to approve and send. Built solo for the PayPal AI Hackathon on Devpost. Deadline **12 Nov 2026, 12:00 PST (21:00 Zurich)**.

This PRD keeps every decision in Kate's brief (scope, cuts, RICE scores, the AI dispute case bet, success metrics). Where the team found something inconsistent or missing, it is flagged in section 1 and in context with a **⚑ Flag** marker, never silently changed.

---

## 0. Decisions needed from Kate

| # | Question | Team recommendation | Why it's Kate's call |
|---|---|---|---|
| D1 | ✅ **Decided by Kate, 3 Nov: deadline email alerts move to Next.** The health scan shows deadlines on screen. Now features drop to 7.5 build days, leaving ~1.5 days for seeding, deploy, video and write-up. | — | Decided |
| D2 | ✅ **Decided by Kate, 3 Nov: EUR.** Use a sandbox business account registered in Portugal (EUR by default), not a US account receiving EUR, which can leave payments pending until accepted by hand. All demo numbers, the health scan and the video are in €. Day 1: confirm the tracking and Disputes APIs behave the same on the PT account. | — | Decided |
| D3 | ✅ **Decided by Kate, 3 Nov: add a dispute-case pilot metric** that includes a backtest on each seller's last 90 days of disputes, so it doesn't depend on new disputes arriving (section 12). Without it, the pilot could pass on tracking sync alone, which is the commodity part. | — | Decided |
| D4 | ✅ **Decided by Kate, 3 Nov: Claude Opus 5.5** for the AI. Rest chosen by the team, with no paid tools: Next.js + AG Grid Community, ~~hosting on Render's free tier, a public Postman collection, PayPal's Server SDK for Orders~~. Changed 8 Nov: no hosting (run locally, ADR 0003), no Postman collection, direct REST calls instead of the SDK. Details in section 8. | — | Decided |

---

## 1. Inconsistencies and gaps found

Ordered by how much they could hurt the submission.

1. **The build plan doesn't fit in 9 days.** Effort for the Now features is 2 + 1.5 + 4 + 1 = 8.5 days. Not counted: seeding ~200 orders and ~12 disputes, auth and deploy, the demo video, the Devpost write-up, README and licence. Realistically that is 1.5 to 2 days. Without deadline alerts it's ~9 days with zero buffer. (Resolved 3 Nov: alerts moved to Next, D1.)
2. **RICE says the AI dispute case is second-lowest (47), yet it ships Now, while Evidence PDF (84) is cut.** The brief states this as a deliberate bet, which is fine, but the table doesn't say *why the scoring disagrees*. The reason is that RICE here measures pilot value, while the build is judged on hackathon criteria (technological implementation, innovation, PayPal + AI use). Suggest a one-line note under the table: "RICE scores pilot value; the dispute case is overridden for hackathon fit and as the differentiator." Also: C = 3 is the lowest confidence of any Now feature, so this is the riskiest thing in the build. It should be built first, not last (section 9).
3. **Cutting Evidence PDF partly cuts the dispute case.** The Disputes API "provide evidence" call accepts documents (proof of delivery, photos, invoices). For "item not received" the tracking number alone can go as structured evidence, but for "not as described" a document is usually what makes a fight winnable. Without some attachment step, a "Fight" recommendation on a not-as-described claim has nothing to submit. Suggest the dispute case lets Maria attach an existing file (photo, invoice) to the evidence call, which is not the same as generating a PDF and stays within the cut.
4. **"Not as described" isn't covered by Seller Protection.** PayPal Seller Protection covers unauthorized and item-not-received claims; significantly-not-as-described claims aren't covered. The problem section leads with "not as described" pain, so the eligibility check will say "not covered" for exactly the cases the pitch opens with. That's not wrong, but the UX must explain it (section 7), and the recommendation for these has to rest on evidence, not eligibility. *(Patterned from PayPal's published Seller Protection policy; verify the current wording on Day 1 and link it.)*
5. **A recommendation option is missing: "refund after return".** For not-as-described claims PayPal usually asks the buyer to return the item. The Disputes API's accept-claim and make-offer calls support a refund-with-return option. Without it, the forum quote "the customer now has the product and the money" isn't answered by the product. Flagged only; scope stays as Kate set it unless she adds it.
6. **"Orders marked protected" overclaims.** Adding tracking makes an order *more likely* eligible, it doesn't make it protected (address match, item type and delivery confirmation also count). The app can read PayPal's own `seller_protection` status on each capture; show that, and say "tracking added" rather than "protected" unless PayPal's status says so.
7. **Seeded orders vs. real sandbox orders.** The store has ~200 orders but only ~60 exist in PayPal sandbox. Bulk "add tracking to PayPal" and every dispute must use the 60 real ones, or the demo makes calls that can't happen. That conflicts with "never fake API calls". The "27 missing tracking" in the demo must be a subset of the real 60, and seeded-only rows must be visibly marked (or excluded from bulk actions).
8. **Currency mismatch (resolved 3 Nov: EUR, Portuguese sandbox business account).** The brief's demo said "$412" while persona and pilot were in €.
9. **Reach numbers contradict the stop rule.** Tracking fixer Reach = 12 of 15 pilot sellers (80% have missing tracking), but the stop rule fires if fewer than 4 of 15 scans find a real gap, and "continue" needs only 6 of 15. If you believe 12, the bar is low; if 6 is realistic, the RICE reach is inflated. Pick one belief.
10. **The pilot can't run on the hackathon build.** The pilot needs real Shopify/WooCommerce data (Shopify OAuth is cut), live PayPal (not sandbox), and PayPal permission to act on other sellers' accounts (third-party/partner onboarding, likely an approval process). That's fine for a hackathon, but the pilot has a hidden build phase that isn't in the plan. *(Assumed: partner approval timeline unknown.)*
11. **Confidence scale is unclear.** Impact is 1–10, Confidence is "capped at 5 until there's user data", but the brief doesn't say 5 out of what. If it's out of 10, say so in the table header.
12. **Demo numbers don't match the seed.** "3 open disputes" in the demo vs. ~12 seeded disputes. Fine if 9 are closed or resolved, but decide it up front; sandbox disputes also move state on their own over time, so seed them close to recording day.
13. **Missing from the brief:** an AI quality bar (how good the recommendation must be before demo day), a privacy line for buyer data sent to the model, the submission checklist as a task, a day-by-day plan, and what happens on screen when the AI is unsure. All added below.

Checked and fine: the RICE arithmetic is correct for every row; 12:00 PST on 12 Nov is 21:00 Zurich (both regions are on winter time by then); the cut list matches the must-have list.

---

## 2. Context

- **Event:** PayPal AI Hackathon (Devpost). Solo. 9 days, deadline 12 Nov 2026, 12:00 PST.
- **Hard requirements:** meaningful use of the PayPal developer platform (sandbox) and an AI tool; a working demo judges can run (hosted URL or run instructions); public repo with a licence; demo video < 3 min on YouTube; text description; list of tools used.
- **Judging:** technological implementation, design, potential impact, innovation, presentation.
- **Sponsor prize targeted:** Best Use of AG Grid (the orders/tracking table).

## 3. Problem

Small online sellers who take PayPal lose money and evenings to payment holds and disputes. Tracking often isn't attached to their PayPal transactions, which delays hold release and can remove Seller Protection. "Not as described" disputes feel like their word against the buyer's, so they often refund just to make the problem go away.

**Evidence** (verbatim, PayPal Community forum):
- "My first order comes through and PayPal locks down my account and freezes the funds. $30."
- "So to be clear, the customer now has the product and the money"
- "why do they always favour the buyer, without proper proof"
- "I don't want to wait 21 days or more for MY MONEY."
- "I feel helpless as I am not receiving any support from PayPal."

**UXR note:** these are strong for the video, but they come from people who went to a forum to complain, so they show the pain is real, not how common it is. No seller interviews yet. The pilot screening form can go live this week at almost no cost and give 3–5 real answers before the video is recorded.

## 4. Target user

- **Segment:** small online sellers on Shopify or WooCommerce who take PayPal, ~50–1,000 orders/month, owner handles disputes personally.
- **Persona:** Maria Costa, 34, ceramics shop in Porto, 14 months old, ~200 orders/month, avg €60, Shopify + PayPal checkout. *"I make pottery, not paperwork. One dispute can eat my whole evening."*
- **Goals:** keep the money she's earned; handle a dispute in minutes; get payouts released faster.
- **UXR context:** Maria handles disputes in the evening after studio work, tired, possibly on a laptop on the sofa. She doesn't know PayPal's policy vocabulary and doesn't want to learn it. The emotional job is "make me feel I'm not being robbed and I'm not stupid." Persona is a composite (⚑ the brief doesn't say if she's real; label her as composite in the video if so).

## 5. Mission and hypotheses

**Mission:** We make it easy for small sellers who take PayPal to keep the money they've earned and settle disputes in minutes, not evenings.

**Hypotheses the build and pilot test**

| # | Hypothesis | Tested by |
|---|---|---|
| H1 | Many small PayPal sellers have money held or unprotected because tracking isn't on their PayPal transactions. | Pilot: ≥6 of 15 scans find ≥€200 held or unprotected |
| H2 | When shown the gap, sellers fix it right away if it's one bulk action. | Pilot: ≥5 sellers bulk-add tracking in their first session |
| H3 | A plain-English fight / partial / refund recommendation with a ready draft gets a seller through a dispute in minutes, and they trust it enough to send. | Hackathon: demo works end-to-end. Pilot: dispute-case metric (D3), incl. 90-day backtest |
| H4 | Sellers will pay a flat fee rather than a % of recovered money. | Pilot: ≥3 pre-pay €15–19/month; ≥40% "very disappointed" |

**Stop or pivot** if fewer than 4 of 15 scans find a real gap, or nobody pays.

## 6. Competition (checked 3 Nov 2026)

| | What it does | What it doesn't |
|---|---|---|
| PayPal today | Resolution Center, Seller Protection. Chargeback Protection: card payments via Advanced checkout, only "unauthorized" and "item not received". | No advice on whether to fight |
| Tracking-sync apps (Synctrack 5.0★/451, PaySync $0–19/mo, PalSync, AST Pro) | Push tracking to PayPal. PaySync $19 has a dispute dashboard. | No recommendations |
| Chargeflow (25% of recovered), Disputifier (20% of won) | Automated chargeback fighting for high-volume stores; auto-submit. | Not for small sellers; no human approval |

**Gap:** no tool tells a small seller, in plain English, whether a PayPal dispute is worth fighting, checks Seller Protection eligibility, and waits for her approval. Tracking sync alone is a commodity, so it sits inside the health scan rather than being the headline.

## 7. Scope (Kate's decisions, unchanged)

| Feature | R | I | C | E | Score | Phase |
|---|---|---|---|---|---|---|
| Tracking fixer | 12 | 7 | 5 | 2 | 210 | Now |
| Health scan | 15 | 5 | 4 | 1.5 | 200 | Now |
| Deadline alerts | 7 | 5 | 4 | 1 | 140 | ~~Now (if time)~~ Next (Kate, 3 Nov, D1) |
| Evidence PDF | 7 | 3 | 4 | 1 | 84 | Next |
| AI dispute case | 7 | 9 | 3 | 4 | 47 | Now (stated bet: the differentiator and the core PayPal + AI use) |
| Prevention insights | 3 | 4 | 2 | 2 | 12 | Later |

R = est. sellers of 15 in pilot per month; I = 1–10; C = evidence it matters, capped at 5 until user data (⚑ scale unclear); E = build days incl. technical risk. Score = R×I×C/E.
⚑ Suggested note: *RICE scores pilot value. The AI dispute case is overridden for hackathon fit and as the differentiator.*

**Out of scope:** separate disputes inbox or tab, prevention insights, evidence PDF, separate "Today" feed, real Shopify OAuth (seeded store), account-limitation fixes, freelancer/services disputes.

### F1. Health scan (home screen), Must

Read-only summary of money held or at risk, orders missing tracking, and dispute deadlines.

**Acceptance**
- Shows three cards: *Money at risk* (open dispute amounts + held/withheld balance), *Missing tracking* (count of real sandbox orders without a tracker, with their total value), *Next deadline* (soonest seller-response due date, in days and as a date).
- Every number links to the rows behind it (tracking fixer filtered, or the dispute case).
- Numbers come from live sandbox calls on load, with "as of" time. If a call fails, the card says so instead of showing 0.
- Copy: "3 open disputes, €412 at risk. Nearest reply due in 2 days. 27 orders missing tracking (€1,620)."

### F2. Tracking fixer, Must (AG Grid prize)

AG Grid table of ~200 orders with filters for missing tracking / held / unprotected, and bulk "add tracking to PayPal". Rows with an open dispute show a "Dispute" flag that opens the case.

**Acceptance**
- Columns: order #, date, buyer, amount, carrier, tracking #, PayPal tracking status, seller protection status (from PayPal), hold status, dispute flag.
- One-click filter chips: *Missing tracking*, *Held*, *Not protected*, *Has dispute*. Row selection with checkboxes and "Select all filtered".
- Bulk action: review screen listing what will be sent (order → carrier + tracking #), then one confirm, then the batch call. Per-row result: ✓ added / ✗ failed with reason. Nothing is sent before confirm.
- ⚑ Seeded-only rows (not in sandbox) are labelled "Demo data" and can't be selected for bulk send.
- After success the row shows "Tracking added". It shows "Protected" only if PayPal's seller protection status says so (⚑ item 6).
- Grid features to show off for the prize: custom cell renderers (status pills, dispute flag button), quick filter, row grouping or pinned summary row, keyboard navigation. *(Check which features need AG Grid Enterprise; the Set Filter and row grouping do. A trial licence shows a watermark. Confirm the prize rules on Day 1.)*

### F3. AI dispute case, Must (the bet)

AI reads the claim, classifies the reason (not received / not as described / unauthorized), checks Seller Protection eligibility and evidence, recommends fight / refund / your decision with a plain-English reason (~~partial refund~~: not in v1, see below), ~~drafts the response~~ (changed 8 Nov: reply drafts are templates, not AI-written). The seller approves before anything is sent; then submit via the Disputes API.

**Acceptance**
- Opens from the dispute flag in the grid or from the health scan.
- Screen, top to bottom: (1) **What the buyer says**, two-sentence summary + the original text one click away; (2) **What you have**, evidence checklist (tracking, delivery confirmation, address match, photos, messages) with ✓ / ✗ / unknown; (3) **Seller Protection**, eligible / not eligible / partly, with the reason in one line; (4) **Our recommendation**, Fight / Refund / Your decision (~~Offer partial refund~~), with a 1–2 sentence reason that names the facts it used, and the amount at stake; (5) **Your reply**, editable draft; (6) **Approve and send**.
- Eligibility is decided by code from PayPal data and published rules, not by the model (section 8). The model explains it.
- If the model's inputs conflict or evidence is missing, the recommendation says "Not sure" and what would settle it, rather than guessing.
- Approve opens a confirm step that shows exactly what goes to PayPal (action, amount, message, attachments). Then the Disputes API call. On failure the case ends at **"Approved, ready to submit"** with the error shown, never a fake success.
- ⚑ Allow attaching an existing file (photo, invoice) to the evidence call (item 3).
- Shows a "Sandbox" badge whenever a call goes to PayPal sandbox.
- **Changed 8 Nov (Kate, golden set sign-off):**
  - Reply deadline passed: Weak (refund). Seller Protection needs a reply in time. The card shows no reply draft. The steps are: ask the buyer, outside PayPal, to close the case, or appeal after PayPal decides (ADR 0004).
  - Not as described: "matches the listing" makes the case Strong only with evidence, such as the listing and photos taken before shipping. Without evidence it is Mixed. PayPal decides on evidence from both sides.
  - No due date from PayPal: Mixed, but the reply buttons stay on with "Deadline unknown: check it in PayPal first". PayPal refuses what it no longer accepts.
  - "Your facts" on the case card: the carrier's delivery date (item not received), whether the item matches the listing (not as described), and PayPal's notice date and the shipment date (unauthorised). The rules read them.
  - Send to buyer only in the inquiry stage. Evidence only while PayPal waits for the seller.
  - All 21 golden-set labels are signed off by Kate. AI and rule results are reported separately.
- **Changed 7 Nov (Kate, review):** no partial refund in v1. The seller can refund in full or fight; a partial refund is done in the PayPal Resolution Center. Fight on an item-not-received case sends the order's tracking to PayPal as proof of fulfilment; photos and documents for other reasons are uploaded in the Resolution Center.

### F4. Deadline alerts, Next (moved by Kate, 3 Nov, D1)

Email before a dispute's seller-response deadline (e.g. 3 days and 1 day before), linking to the case. Moved to Next; the health scan already shows the deadline in the MVP.

## 8. Technical design (CTO)

**PayPal (sandbox)**

| Need | API | Note |
|---|---|---|
| Seed transactions | Orders v2 create + capture, in EUR, on the Portuguese sandbox business account (D2) | Capture needs buyer approval in sandbox; script it with a sandbox personal account (browser automation) or approve by hand. ~60 orders is a half day. |
| Add tracking | Shipment tracking (`/v1/shipping/trackers-batch` for bulk, or Orders v2 `/track`) | Batch endpoint fits the bulk action. Carrier codes must match PayPal's enum. |
| Read disputes | Disputes API list / show details | Read claim text, reason, amount, `seller_response_due_date`, status. |
| Respond | Disputes API provide evidence (multipart for files), accept claim, make offer | Only allowed in certain statuses; read status first and disable invalid actions. |
| Move sandbox disputes | Sandbox-only simulate endpoints (e.g. require evidence, adjudicate) | For setting up demo states; never shown as the seller's action. |
| Money held | Balances / Transaction Search reporting APIs | ⚑ Verify Day 1 that the sandbox app has the reporting scope and that held/withheld amounts appear; Transaction Search has a delay of a few hours. Fallback: compute "at risk" from open disputes + pending captures and label it. |

**Known risk (from brief):** creating disputes via API needs the DISPUTE_CREATE scope. Fallback: create the ~12 disputes as the buyer in the sandbox Resolution Center (≈5 min each) and say so on screen. Never fake API calls.

**AI.** Claude Opus 5.5 (`claude-opus-5-5`, Kate's choice) through the Anthropic API with a JSON schema for structured output. One call per dispute, cached per dispute version. **Cost:** this is the only part of the stack that isn't free. Results are stored after the first run, so judges clicking around never trigger new model calls; total spend is the ~~12-case~~ 21-case golden check plus prompt iterations. Check Devpost or the sponsor pages for hackathon API credits on Day 1. Inputs: ~~claim text~~, reason code, amount, ~~order data~~, tracking/delivery status, the eligibility result from code. Changed 8 Nov: the model gets only case facts (reason, status, amounts, dates, PayPal's eligibility flag, whether the seller can still reply, and the seller's answers), not the claim text or order data. Output:

```json
{
  "reason_category": "not_received | not_as_described | unauthorized | other",
  "claim_summary": "≤2 sentences",
  "evidence": [{"item": "tracking", "status": "have|missing|unknown", "source": "order 1043"}],
  "recommendation": "fight | partial_refund | refund | not_sure",
  "partial_refund_amount": null,
  "reason_plain": "≤2 sentences, names the facts used",
  "facts_used": ["tracking shows delivered 14 Oct", "address matches"],
  "draft_response": "…"   (changed 8 Nov: not used, drafts are templates)
}
```

- **Split of work (CTO/UXR/PM synthesis):** code decides eligibility and hard rules (e.g. deadline passed → no fight; amount < return shipping cost → lean refund). The model classifies, summarises, weighs evidence and writes. This keeps the one claim that most needs to be right (Seller Protection) deterministic and explainable.
- **Optional innovation point:** PayPal's Agent Toolkit / MCP server exposes dispute and tracking tools. Using it for *read* tools would let the model fetch context itself and is a strong "PayPal + AI" story. Writes stay in app code behind the approval step. *(Patterned: check the toolkit's current tool list on Day 1; skip if it costs more than half a day.)*
- **Privacy:** ~~buyer names and addresses go to the model~~. Changed 8 Nov: the model gets only case facts (reason, status, amounts, dates, eligibility and the seller's answers, including any evidence note they type). No buyer names, emails, addresses or messages. For the hackathon it's sandbox data. For the pilot, send only what's needed, use an API tier that doesn't train on inputs, and add a privacy notice (sellers are in the EU).

**Stack (no paid tools; decided 3 Nov, D4)**

| Layer | Choice | Cost | Why |
|---|---|---|---|
| AI | Claude Opus 5.5 via Anthropic API | Pay per use, kept small by caching | Kate's choice |
| App | Next.js (React, TypeScript); API routes hold PayPal and Anthropic keys server-side | Free | One codebase for UI and server; deploys anywhere |
| Table | AG Grid **Community** (MIT) | Free | Sponsor prize. Enterprise features (Set Filter, row grouping, master/detail) need a licence and a trial shows a watermark, so build with Community: custom cell renderers, quick filter, checkbox selection, pinned summary row, keyboard navigation |
| Data | Seed JSON in the repo, loaded into SQLite (or memory) at start | Free | Render's free disk is wiped on restart; PayPal sandbox stays the source of truth, so nothing important is lost |
| Hosting | ~~**Render** free web service (sponsor)~~ Changed 8 Nov: not used, runs locally (D4) | Free | Sponsor tool. Free services sleep after ~15 min idle and take up to a minute to wake: show a "waking up" screen, put this in the README, and keep it warm during judging with a free uptime pinger |
| API craft | ~~**Postman** public collection of every PayPal call used (sponsor)~~ Changed 8 Nov: not made (D4) | Free | ~2 hours. Judges can rerun the calls; doubles as the run instructions and as proof that nothing is faked |
| PayPal SDK | ~~PayPal Server SDK for Orders (believed to be generated by **APIMatic**, sponsor)~~ Changed 8 Nov: direct REST calls (D4) | Free | Typed Orders calls for seeding. Disputes and tracking via plain REST if the SDK doesn't cover them. *(Verify Day 1 that it's APIMatic-built before listing APIMatic as a tool.)* |
| Seeding automation | ~~Playwright, run locally~~ Changed 8 Nov: not used; 4 sandbox orders made by hand | Free | Approves sandbox buyer payments for the ~60 real orders |

**Sponsor tools not used:** Zapier (would only fit the deadline emails, now in Next), Elastic, Bryntum, Channel3, KERNEL and Astropods. None of them helps the three Must features enough to be worth the build time. KERNEL could host the seeding browser, but local Playwright does the same thing for free.

~~One demo login so judges see the seeded store.~~ Changed 6 Nov: no hosted demo. Judges run it locally from the README, with sandbox keys in Devpost's private testing instructions (repo: docs/decisions/0003-no-hosted-demo.md).

**Data.** Seeded store of ~200 orders in a JSON/SQLite file; ~~~60 linked to real sandbox captures; ~12 sandbox disputes on those 60~~. Changed 8 Nov: 200 seeded demo orders plus 4 real sandbox orders, 4 real sandbox disputes and 1 demo case. Each seeded row carries `in_paypal: true|false`.

**Day-1 spikes (from brief, plus two):** (1) create/read a sandbox dispute; (2) does a Shopify dev store send tracking to PayPal on its own (affects the pitch, not the build); (3) can the sandbox read held/withheld balance; (4) which AG Grid features the prize expects and whether Enterprise is needed.

## 9. Build plan (CTO, risk-first)

Today is 3 Nov evening (Zurich). Submit by 12 Nov 21:00 Zurich; aim for 12 Nov 12:00 Zurich to keep a buffer.

| Day | Date | Work |
|---|---|---|
| 0 | Tue 3 Nov eve | ~~Decide stack~~ (decided, D4). Repo + licence. Ask DISPUTE_CREATE in PayPal Discord. |
| 1 | Wed 4 | Spikes 1–4. Deploy a hello-world. Create first sandbox dispute. |
| 2 | Thu 5 | Seed 60 real orders + 140 demo rows. Create 12 disputes. Kate labels the right answer for each (before seeing any AI output). |
| 3 | Fri 6 | **AI dispute case thin slice end-to-end**: read dispute → eligibility code → model → screen → approve → submit, on one dispute. |
| 4 | Sat 7 | Dispute case for all three reasons; run the 12-case check; prompt fixes. |
| 5 | Sun 8 | Dispute case polish: states, errors, file attach, confirm step. **Checkpoint:** if submit still fails, lock the "Approved, ready to submit" ending. |
| 6 | Mon 9 | Tracking fixer: grid, filters, bulk review, batch call. |
| 7 | Tue 10 | Tracking fixer polish (prize features) + health scan. |
| 8 | Wed 11 | Health scan polish, Postman collection, end-to-end run, record video, write Devpost text and tools list. |
| 9 | Thu 12 | Buffer. Re-seed dispute states if they moved. Submit by midday. |

Deadline alerts are out of the build (Next, D1). Their day goes to buffer.
**Debate:** PM wanted the tracking fixer first because it's the surest thing to demo and carries the sponsor prize. CTO pushed for the dispute case first because C = 3 and 4 days of effort make it the likeliest to slip, and a slip there removes the headline. **Synthesis:** dispute case first, as a thin slice on Day 3, with a hard checkpoint on Day 5; the grid is lower-risk and can be done in two days at the end.

## 10. Experience design (UXR)

**Principles**
1. **Money first, in her currency.** Every screen leads with euros at stake.
2. **Plain English, no policy words.** "PayPal will probably side with you because tracking shows it was delivered to the buyer's address" rather than "INR claim, eligible under SP".
3. **She decides, we show our working.** Recommendation always shows the facts used. Nothing sends without a confirm that shows exactly what's sent.
4. **Honest about limits.** "Not sure" is a valid answer. "Not covered by Seller Protection" comes with what that means for her.

**Key moments**
- *Not-as-described with no cover* (⚑ item 4): "Seller Protection doesn't cover 'not as described' claims, so this comes down to your evidence. You have photos of the item before shipping, which helps." Then the recommendation.
- *Refund recommended:* frame as a choice that saves her evening, not a defeat: "Refunding €38 costs less than the time and return shipping to fight it."
- *Deadline close:* ~~deadline pill turns amber at ≤3 days, red at ≤1 day~~ Changed by Kate, 7 Nov: the Days left pill turns PayPal gold with "decide now" at 1–2 days, and red ("Due today" or "Passed") when due or once PayPal stops taking replies. Always with text, not colour alone.

**States to design:** loading (skeleton cards, "Checking PayPal…"), empty (no disputes: "Nothing at risk right now"), API failure per card, AI unsure, submit failed → "Approved, ready to submit", dispute already closed, deadline passed (actions disabled with reason), seeded-only rows.

**Accessibility:** status uses icon + text + colour; contrast AA; grid fully keyboard-navigable; confirm dialogs focus-trapped.

**Disagreement logged:** UXR wanted a lightweight onboarding explainer of Seller Protection; PM cut it as out of scope for a 3-minute demo. Synthesis: the explanation lives inline in the eligibility line of the dispute case, only when relevant.

## 11. Demo flow (under 3 minutes)

Plan from 3 Nov, kept for the record. The numbers below were planned, not measured; the final video follows the app as built (4 sandbox disputes and one demo case).

| Time | Beat |
|---|---|
| 0:00–0:20 | Maria's problem, two forum quotes on screen. |
| 0:20–0:35 | Connect PayPal sandbox business account, load the store. |
| 0:35–0:55 | Health scan: "3 open disputes, €412 at risk, nearest reply due in 2 days; 27 orders missing tracking." |
| 0:55–1:30 | Tracking fixer: filter *Missing tracking*, select all, review, send. Rows flip to "Tracking added". |
| 1:30–2:30 | Dispute case (not-received, fight): summary, evidence, eligibility, recommendation and reason, edit a line, approve, submit. Quick cut to a not-as-described case where it recommends a refund. |
| 2:30–2:55 | How it works (PayPal APIs + AI, human approval), what's next (pilot). |

## 12. Success metrics

**Hackathon**
- Working end-to-end demo in under 3 minutes; all three Must features run against the sandbox.
- ⚑ Added: on the 12 seeded disputes, reason classified correctly 12/12, recommendation matches Kate's pre-labelled answer on ≥10/12, and no draft states a fact not in the input. Show "n = 12" when quoting it.

**Pilot** (15 sellers, 2–4 weeks, recruited with a screening form)
- Continue if: ≥6 of 15 scans find ≥€200 held or unprotected; ≥5 sellers bulk-add tracking in their first session; ≥3 pre-pay a flat €15–19/month; ≥40% "very disappointed" without it.
- **Dispute case (added by Kate, 3 Nov, D3).** Continue also requires:
  - *Backtest:* the app runs on each seller's disputes from the last 90 days (Disputes API list). For ≥60% of them, the seller says the recommendation is what they should have done, or would have changed their decision.
  - *Live:* of disputes that arrive during the pilot, at least half are sent with light edits only (seller changes under ~20% of the draft).
  - *Tracked, not a gate:* median time from opening a case to approving (aim < 10 min).
  - Why the backtest: at Reach 7/15 per month, a 2-week pilot may see only 3–4 live disputes, too few to judge on their own. Note that the backtest asks sellers to judge in hindsight, so treat it as a signal, and weight live sends more.
- Stop or pivot if: <4 of 15 scans find a real gap, or nobody pays.
- Note: with n = 15, "40% very disappointed" is 6 people; treat it as a signal, not proof.

## 13. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| DISPUTE_CREATE scope unavailable | Medium | Low | Create disputes as buyer in Resolution Center; say so on screen |
| Dispute response calls fail in sandbox | Medium | High | Day-5 checkpoint; end at "Approved, ready to submit" |
| AI recommends fighting a case that should be refunded | Medium | High | Code-decided eligibility and hard rules; ~~12-case~~ 21-case golden check; "Not sure" path |
| Schedule slips (7.5 days of features in 9 after D1) | Medium | High | Alerts moved to Next; risk-first order; Day 9 buffer |
| Held balance not readable in sandbox | Medium | Medium | Compute "at risk" from disputes + pending; label it |
| Sandbox disputes change state before recording | Medium | Medium | Seed late; simulate endpoints to reset |
| AG Grid Enterprise watermark / licence | Low | Medium | Check prize rules Day 1; stick to Community features if needed |
| Pilot needs real OAuth, live PayPal, partner approval | High | Medium (post-hackathon) | Plan it as its own phase; ask PayPal at the hackathon |

## 14. Submission checklist

- [x] Local run instructions in the README (no hosted URL, see decision 0003)
- [ ] Sandbox keys in Devpost's private testing instructions, kept active until 15 Dec
- [ ] Public repo with licence (MIT suggested)
- [ ] YouTube video < 3 min
- [ ] Devpost text: problem, how it works, PayPal APIs used, AI use, human-approval principle
- [ ] Tools list: ~~PayPal Orders,~~ Shipment Tracking and Disputes APIs; ~~PayPal Server SDK~~; Anthropic API (Claude Opus 5.5 and Sonnet 5.5 as judge); AG Grid Community; Next.js; ~~Render; Postman; APIMatic (if confirmed); Playwright~~ (changed 8 Nov: not used)
- [ ] ~~Public Postman collection link~~ (changed 8 Nov: no Postman collection)
- [ ] Note in README which disputes were created in the Resolution Center vs. via API

## 15. Open questions

- ~~AI model and frontend stack~~ Decided 3 Nov (D4).
- Are there hackathon credits for the Anthropic API?
- Whether DISPUTE_CREATE can be enabled for hackathon participants (ask in the PayPal Discord).
- Pricing: flat €15–19/month is a hypothesis for the pilot.
- Add "refund after return" as a recommendation option? (item 5)
- ~~Demo currency~~ Decided 3 Nov: EUR on a Portuguese sandbox business account (D2).
- Is Maria a real seller or a composite?

---

## 16. Evals Report: Seller Shield PRD

**GROUNDED CLAIMS**
- Seller pain around holds and disputes exists. Basis: five verbatim PayPal Community quotes.
- Competitor features and pricing (Synctrack, PaySync, PalSync, AST Pro, Chargeflow 25%, Disputifier 20%). Basis: Kate's check on 3 Nov 2026.
- RICE scores. Basis: arithmetic verified for all six rows.
- Deadline time conversion. Basis: both regions on standard time on 12 Nov.

**PATTERNED CLAIMS** (reasonable inference, labelled)
- Seller Protection doesn't cover not-as-described claims. Basis: PayPal's published policy as the team knows it; link the current page.
- PayPal Agent Toolkit exposes dispute and tracking tools. Basis: team's knowledge of the toolkit; verify Day 1.
- Missing tracking delays hold release and weakens Seller Protection. Basis: PayPal policy plus forum reports.
- The market gap ("no tool tells a small seller whether to fight"). Basis: scan of six competitors; absence in a scan isn't proof of absence.

**ASSUMED CLAIMS** (need grounding or an explicit risk label)
- Tracking fixer Reach 12/15 and dispute Reach 7/15. Why it matters: drives the RICE order and contradicts the 6/15 continue bar.
- Effort estimates (2, 1.5, 4, 1 days). Why it matters: the plan has no buffer; one slip removes a feature.
- Small sellers "often refund just to make it go away". Why it matters: core of the dispute-case value; forum quotes show it happens, not how often.
- Held/withheld balance is readable in sandbox. Why it matters: the health scan's headline number.
- Sellers will trust an AI recommendation enough to send. Why it matters: H3 is the differentiator and has no pilot metric yet.

**COMPLETENESS GAPS**
- No AI quality bar in the brief (added in section 12).
- ~~No pilot metric for the dispute case~~ Added 3 Nov (D3).
- No plan for the pilot's real integrations and PayPal partner permissions.
- No privacy line for buyer data sent to the model (added in section 8).
- Evidence attachment for not-as-described fights (item 3).

**CONFIDENCE MISCALIBRATIONS**
- "Orders marked protected" after adding tracking states more certainty than PayPal gives.
- The dispute case is called "the differentiator" with C = 3, the lowest confidence in the Now set. That's honest in the table but the narrative treats it as settled.

**ESCALATE TO KATE**
- None open. D1–D4 decided 3 Nov.

**VERDICT: Ready to act on (after Kate's decisions on 3 Nov).**
The brief is unusually well-grounded for a hackathon plan: real quotes, a dated competitor check, an explicit bet, and an honest fallback that refuses fake API calls. The two things that would change the outcome are the time budget (8.5 feature days in 9 with nothing reserved for submission) and the missing measure for the dispute case, which is the whole pitch. Kate resolved the time budget on 3 Nov by moving alerts to Next (D1) and chose EUR (D2). She also added a dispute-case pilot metric with a 90-day backtest (D3). The stack is set (D4: Opus 5.5 and free tools). The plan is ready to build; the remaining flags are Day-1 checks, not blockers.

// The answer the eval and the recordings use, built the same way as the case screen.
// The golden set, the judge, live-check and the case screen all build the answer with caseAnswer(), so the eval
// tests what the seller sees.
import type { SellerAnswer } from "./answers.ts";
import { sellerAnswers } from "./answers.ts";
import { caseAnswer, type CardAnswers, type OrderFacts } from "./case-facts.ts";
import { allOrders } from "./orders-seed.ts";

export type GoldenCase = {
  id: string;
  expected: string;
  note?: string;
  answer?: SellerAnswer;
  order?: OrderFacts;
  card?: CardAnswers;
  dispute: object;
};

// A golden case with an order or card answers is built the screen's way; an older case keeps its ready-made answer.
export function goldenAnswer(g: GoldenCase): SellerAnswer {
  if (g.order || g.card) return caseAnswer(g.answer ?? {}, g.order ?? null, g.card ?? {});
  return g.answer ?? {};
}

// The answer the case screen builds for a dispute before the seller types anything on the card:
// the demo answers plus the order behind the case.
export function screenAnswer(disputeId: string, transactionId: string | null, card: CardAnswers = {}): SellerAnswer {
  const o = transactionId ? allOrders().find((x) => x.orderNo === transactionId) : undefined;
  return caseAnswer(sellerAnswers[disputeId] ?? {}, o ? { tracking: o.tracking, trackingStatus: o.trackingStatus, deliveredDate: o.deliveredDate } : null, card);
}

// Card answers used when recording the model's answer. The screen shows a recorded answer only when the rules leave
// the case to the model, and for the demo case that needs the carrier date and the address answer.
export const RECORDING_CARD: Record<string, CardAnswers> = {
  "PP-R-DEMO-25": { carrierDeliveryDate: "2026-10-29", addressMismatch: "no" },
};

// Same facts? Compares two answers with undefined keys dropped and keys sorted.
// deliverySource is left out: the AI never sees it (factsFor), so it can't change the AI's answer. Without this, the demo
// case read Mixed when the seller answered the address question but kept the order's delivery date (review, 8 Nov 2026).
export function sameAnswer(a: SellerAnswer, b: SellerAnswer): boolean {
  const facts = (x: SellerAnswer) => { const rest = plainAnswer(x); delete rest.deliverySource; return sortKeys(rest); };
  return JSON.stringify(facts(a)) === JSON.stringify(facts(b));
}

// Drops undefined keys, so a stored answer (JSON) and a built answer compare equal.
export function plainAnswer(a: SellerAnswer): SellerAnswer {
  return JSON.parse(JSON.stringify(a)) as SellerAnswer;
}

type Recorded = Record<string, { answer?: SellerAnswer }>;

// A recorded AI answer is stale when the facts it was made from differ from what the screen builds today.
// "no input stored": recorded before 8 Nov 2026, when the input was not kept. Re-record to check it.
export function staleRecordings(recorded: Recorded, current: Record<string, SellerAnswer>): { id: string; why: "facts changed" | "no input stored" }[] {
  const out: { id: string; why: "facts changed" | "no input stored" }[] = [];
  for (const [id, now] of Object.entries(current)) {
    const r = recorded[id];
    if (!r) continue;
    if (!r.answer) out.push({ id, why: "no input stored" });
    else if (!sameAnswer(r.answer, now)) out.push({ id, why: "facts changed" });
  }
  return out;
}

function sortKeys(a: object): object {
  return Object.fromEntries(Object.entries(a).sort(([x], [y]) => x.localeCompare(y)));
}

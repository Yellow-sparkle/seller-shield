// The whole path of a dispute case, step by step, with what is already done (Kate, 7 Nov 2026).
// Each step is marked done from its own signal only. A step that is not done does not stop later
// steps from showing as done: if the seller has not ticked their evidence but PayPal has closed the
// case, the close still shows as done (Kate: "do not make the other statuses that come after not to be ticked").

export type StepState = "done" | "now" | "open" | "later";
export type PathStep = { label: string; state: StepState; source: string };

export type PathInput = {
  reason: "INR" | "SNAD" | "OTHER";
  sellerMessaged: boolean; // PayPal's messages include one from the seller
  trackingInPayPal: boolean; // the order has a PayPal tracking status (from Orders and tracking)
  evidenceTicked: boolean; // the seller ticked every box in Documents (this browser only)
  waitingForBuyer: boolean; // PayPal status WAITING_FOR_BUYER_RESPONSE
  closed: boolean; // PayPal refunded or resolved the case
};

export function casePath(p: PathInput): PathStep[] {
  const third =
    p.reason === "INR"
      ? { label: "Add tracking in PayPal", done: p.trackingInPayPal, source: "From Orders and tracking, not confirmed by PayPal for this case" }
      : { label: p.reason === "SNAD" ? "Send photos and the listing" : "Send your evidence in PayPal", done: p.evidenceTicked, source: "Done when you tick every box in Documents" };
  const steps = [
    { label: "Buyer opened the case", done: true, source: "From PayPal" },
    { label: "Message the buyer", done: p.sellerMessaged, source: "From PayPal messages" },
    third,
    { label: "Wait for the buyer to reply", done: p.closed, source: "From PayPal status" },
    { label: "PayPal decides and closes the case", done: p.closed, source: "From PayPal status" },
  ];
  // The current step is the first one not done after the last done step. While PayPal waits for the
  // buyer, that is the waiting step. Steps not done before it stay open; steps after it come later.
  const lastDone = steps.reduce((acc, s, i) => (s.done ? i : acc), -1);
  let now = p.closed ? -1 : p.waitingForBuyer ? 3 : steps.findIndex((s, i) => !s.done && i > lastDone);
  return steps.map((s, i) => ({
    label: s.label,
    source: s.source,
    state: s.done ? "done" : i === now ? "now" : now === -1 || i < now ? "open" : "later",
  }));
}

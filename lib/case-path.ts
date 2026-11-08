// The whole path of a dispute case, step by step, with what is already done (Kate, 7 Nov 2026).
// Each step is marked done from its own signal only. A step that is not done does not stop later
// steps from showing as done: if the seller has not ticked their evidence but PayPal has closed the
// case, the close still shows as done (Kate: "do not make the other statuses that come after not to be ticked").
//
// How the path reads:
// - The path follows the seller's decision, or the recommendation when the seller has not decided. A refund
//   has its own path. Unauthorised asks for proof of shipment. Under review and card-issuer cases have their own step.
// - On a closed case, a step that was never done reads "Skipped", not "Not done yet".
// - When PayPal's messages were not loaded, "Message the buyer" says so instead of looking undone.

export type StepState = "done" | "now" | "open" | "later" | "skipped";
export type PathStep = { label: string; state: StepState; source: string; evidence?: boolean };

export type PathInput = {
  reason: "INR" | "SNAD" | "UNAUTHORISED" | "OTHER" | "UNKNOWN";
  route?: "fight" | "refund"; // the seller's decision, or the recommendation; default fight
  sellerMessaged: boolean | null; // PayPal's messages include one from the seller; null when messages were not loaded
  trackingInPayPal: boolean; // the order has a PayPal tracking status (from Orders and tracking)
  evidenceTicked: boolean; // the seller ticked every box in Documents (this browser only)
  waitingForBuyer: boolean; // PayPal status WAITING_FOR_BUYER_RESPONSE
  underReview?: boolean; // PayPal status UNDER_REVIEW
  chargeback?: boolean; // the buyer went to their card issuer
  overdue?: boolean; // the reply deadline passed: PayPal decides without the seller (Kate, 8 Nov 2026, ADR 0003)
  closed: boolean; // PayPal refunded or resolved the case
};

type Step = { label: string; done: boolean; source: string; evidence?: boolean };

function evidenceStep(p: PathInput): Step {
  if (p.reason === "INR") return { label: "Add tracking in PayPal", done: p.trackingInPayPal, source: "From Orders and tracking, not confirmed by PayPal for this case", evidence: true };
  const label =
    p.reason === "SNAD" ? "Send photos and the listing" : p.reason === "UNAUTHORISED" ? "Send proof of shipment (within 2 days of PayPal's notice)" : "Send your evidence in PayPal";
  return { label, done: p.evidenceTicked, source: "Upload in the PayPal Resolution Center, then tick each item", evidence: true };
}

export function casePath(p: PathInput): PathStep[] {
  const opened: Step = { label: "Buyer opened the case", done: true, source: "From PayPal" };
  let steps: Step[];
  let waitIndex = -1;
  if (p.chargeback) {
    steps = [opened, evidenceStep(p), { label: "The buyer's card issuer decides", done: p.closed, source: "From PayPal status" }];
    waitIndex = 2;
  } else if (p.overdue) {
    // Replies are closed, so no refund or evidence step in the dispute: what is left happens outside it.
    steps = [
      opened,
      { label: "Ask the buyer to close the case", done: p.closed, source: "Outside PayPal, if the parcel arrived" },
      { label: "PayPal decides. Appeal with new evidence if needed", done: p.closed, source: "From PayPal status. Appeal window not confirmed" },
    ];
  } else if (p.route === "refund") {
    steps = [
      opened,
      { label: "Refund the buyer in PayPal", done: p.closed, source: "Use Refund buyer below, or the PayPal Resolution Center" },
      { label: "PayPal closes the case", done: p.closed, source: "From PayPal status" },
    ];
  } else {
    const messaged: Step =
      p.sellerMessaged === null
        ? { label: "Message the buyer", done: false, source: "PayPal messages not loaded for this case" }
        : { label: "Message the buyer", done: p.sellerMessaged, source: "From PayPal messages" };
    steps = [
      opened,
      messaged,
      evidenceStep(p),
      p.underReview
        ? { label: "PayPal reviews the case", done: p.closed, source: "From PayPal status" }
        : { label: "Wait for the buyer to reply", done: p.closed, source: "From PayPal status" },
      { label: "PayPal decides and closes the case", done: p.closed, source: "From PayPal status" },
    ];
    waitIndex = 3;
  }
  // The current step is the first one not done, so a seller who has not messaged the buyer sees that
  // first. While PayPal waits for the buyer or reviews the case, that step is current. Steps not done before the
  // current one stay open; steps after it come later (done ones keep their tick). On a closed case, undone steps were skipped.
  const now = p.closed ? -1 : (p.waitingForBuyer || p.underReview || p.chargeback) && waitIndex >= 0 ? waitIndex : steps.findIndex((s) => !s.done);
  return steps.map((s, i) => ({
    label: s.label,
    source: s.source,
    ...(s.evidence ? { evidence: true } : {}),
    state: s.done ? "done" : p.closed ? "skipped" : i === now ? "now" : i < now ? "open" : "later",
  }));
}

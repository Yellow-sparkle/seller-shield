// Shared glossary for the facts. The recommender and the judge both read these notes,
// so the judge does not flag correct terms (such as "net of fees") as invented.
export const FACT_NOTES: string[] = [
  "holdAmount is the amount PayPal holds, net of PayPal fees. The minus sign is how PayPal records it. It is not an error.",
  "hasTracking only says whether a tracking number was added. It is not proof of delivery.",
  "PayPal's Item Not Received rule needs a delivered status and a recipient address that matches the transaction, as well as tracking.",
  "If hasTracking is false, say 'no tracking recorded'. Do not say the seller cannot prove delivery or has no evidence, unless a fact says so.",
];

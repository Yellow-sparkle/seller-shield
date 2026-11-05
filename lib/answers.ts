// Slice step 8 (demo): the seller's yes/no answers, entered by Kate for the sandbox demo.
// They become facts the model may cite. Nothing here comes from PayPal or a shop.
export type SellerAnswer = {
  hasTracking?: boolean;
  matchesListing?: boolean;
  delivered?: boolean; // carrier tracking shows "delivered"
  deliveryDate?: string; // date shown by the carrier, e.g. "2026-10-14"
  deliveredToTransactionAddress?: boolean;
};

export const sellerAnswers: Record<string, SellerAnswer> = {
  "PP-R-GJM-10196233": { hasTracking: false },
  "PP-R-FGC-10196238": { hasTracking: false },
  "PP-R-NVP-10196239": { matchesListing: false },
};

// Slice step 8 (demo): the seller's yes/no answers, entered by Kate for the sandbox demo.
// They become facts the model may cite. Nothing here comes from PayPal or a shop.
export type SellerAnswer = {
  hasTracking?: boolean;
  matchesListing?: boolean | "partly"; // true: matches, "partly": partly matches, false: does not match
  delivered?: boolean; // carrier tracking shows "delivered"
  deliveryDate?: string; // date shown by the carrier, e.g. "2026-10-14"
  deliveredToTransactionAddress?: boolean;
  noticeDate?: string; // PayPal's notice about an unauthorised claim, entered by the seller (YYYY-MM-DD)
  shipmentDate?: string; // date the seller shipped the item (YYYY-MM-DD)
  shippedToTransactionAddress?: boolean;
  deliverySource?: string; // where the seller checked the delivery facts, e.g. the carrier tracking page (seller-entered for the pilot)
  parcelCount?: number; // number of parcels in the order; more than one means the seller decides
};

export const sellerAnswers: Record<string, SellerAnswer> = {
  "PP-R-GJM-10196233": { hasTracking: false },
  "PP-R-FGC-10196238": { hasTracking: false },
  "PP-R-NVP-10196239": { matchesListing: false },
};

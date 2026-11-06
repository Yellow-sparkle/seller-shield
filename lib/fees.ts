// PayPal fee for a sale, read from its transaction record (Transaction Search, GET /v1/reporting/transactions).
// Pure. Used by scripts/fetch-fees.ts (writes lib/fixtures/sandbox-fees.json) and by the cases screen.
// PayPal reports the fee as a negative amount on the seller side; we show it as a positive amount.
export type Money = { value: number; currency: string };
export type FeeRecord = { sellerTransactionId: string; gross: Money; fee: Money; afterFees: Money };

type ReportingItem = {
  transaction_info?: {
    transaction_id?: string;
    transaction_amount?: { currency_code?: string; value?: string };
    fee_amount?: { currency_code?: string; value?: string };
  };
};

// Returns the fee record for one transaction id, or null when PayPal's reply has no usable fee.
export function parseFee(reply: { transaction_details?: ReportingItem[] }, sellerTransactionId: string): FeeRecord | null {
  const info = reply.transaction_details?.find((t) => t.transaction_info?.transaction_id === sellerTransactionId)?.transaction_info;
  if (!info?.transaction_amount?.value || !info.fee_amount?.value || !info.transaction_amount.currency_code) return null;
  const gross = Number(info.transaction_amount.value);
  const fee = Math.abs(Number(info.fee_amount.value));
  if (!Number.isFinite(gross) || !Number.isFinite(fee)) return null;
  const currency = info.transaction_amount.currency_code;
  return {
    sellerTransactionId,
    gross: { value: gross, currency },
    fee: { value: fee, currency: info.fee_amount.currency_code ?? currency },
    afterFees: { value: Math.round((gross - fee) * 100) / 100, currency },
  };
}

// Label for the cases screen: the record's figure, or "Not known" when none was read.
export function feeLabel(rec: FeeRecord | undefined, which: "fee" | "afterFees"): string {
  if (!rec) return "Not known";
  const m = which === "fee" ? rec.fee : rec.afterFees;
  return `${m.value.toFixed(2)} ${m.currency}`;
}

// One set of Seller Protection labels for Orders and Cases (review findings M4 and L13, 7 Nov 2026).
// The status values are PayPal's seller_protection values ELIGIBLE, PARTIALLY_ELIGIBLE and NOT_ELIGIBLE (Orders v2
// seller_protection reference, checked 7 Nov 2026, L13). PayPal has no "PROTECTED" status. UNKNOWN means we have no status.
// SNAD is excluded in PayPal's published PT terms, so a not-as-described dispute reads "Not covered" on both screens,
// whatever the sandbox status says.
export type ProtectionStatus = "ELIGIBLE" | "PARTIALLY_ELIGIBLE" | "NOT_ELIGIBLE" | "UNKNOWN";

export const NOT_COVERED_SNAD = "Not covered (SNAD is excluded in PayPal PT terms)";

export function toProtectionStatus(raw: string | null | undefined): ProtectionStatus {
  return raw === "ELIGIBLE" || raw === "PARTIALLY_ELIGIBLE" || raw === "NOT_ELIGIBLE" ? raw : "UNKNOWN";
}

export function protectionText(status: ProtectionStatus, reason?: string | null): string {
  if (reason === "SNAD") return NOT_COVERED_SNAD;
  if (status === "ELIGIBLE") return "Eligible";
  if (status === "PARTIALLY_ELIGIBLE") return "Partly eligible";
  if (status === "NOT_ELIGIBLE") return "Not eligible";
  return "Unknown";
}

// Short form for a pill; the long SNAD text goes in the tooltip.
export function protectionShort(text: string): string {
  return text.startsWith("Not covered") ? "Not covered" : text;
}

export type ProtectionTone = "good" | "info" | "warn" | "bad" | "muted";
export function protectionTone(text: string): ProtectionTone {
  if (text === "Eligible") return "info";
  if (text === "Partly eligible") return "warn";
  if (text.startsWith("Not")) return "bad";
  return "muted";
}

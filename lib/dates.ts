// One date format for every screen (UXR review, 8 Nov 2026): "20 Dec 2026", read in UTC like PayPal's deadlines.
// Text that is not a date ("Closed", "Not set") is returned as it is.
export function formatDay(value: string | null | undefined): string {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const t = Date.parse(value.length === 10 ? value + "T00:00:00Z" : value);
  if (Number.isNaN(t)) return value;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// Dates written inside a sentence (AI reasons, rule reasons) in the same format, so a reason never says
// "2026-12-20" next to a column that says "20 Dec 2026" (review, 9 Nov 2026).
export function formatDaysInText(text: string): string {
  return text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (d) => formatDay(d));
}

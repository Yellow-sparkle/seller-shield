// Readability of the AI's reasons, by formula (no AI): Flesch reading ease and the Flesch-Kincaid grade.
// It measures sentence and word length, not whether a reason is clear, so it sits next to the judge's
// plain English check rather than replacing it (Kate, 8 Nov 2026).

// Syllables in one English word, by counting vowel groups. An estimate, as in the standard formula.
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

// Words only: dates, amounts and codes in capitals (2026-11-20, EUR, UTC, 38.40) are left out, because the formula
// would count them as long words, and a seller reads them at a glance.
function words(text: string): string[] {
  return text.split(/\s+/).map((t) => t.replace(/^[^A-Za-z]+|[^A-Za-z']+$/g, "")).filter((t) => /^[A-Za-z][A-Za-z']*$/.test(t) && !/^[A-Z]{2,}$/.test(t));
}

function sentences(text: string): number {
  return Math.max(1, text.split(/[.!?]+(?:\s|$)/).filter((s) => /[A-Za-z]/.test(s)).length);
}

export type Readability = { words: number; grade: number; ease: number };

export function readability(text: string): Readability {
  const w = words(text);
  if (w.length === 0) return { words: 0, grade: 0, ease: 100 };
  const s = sentences(text);
  const syl = w.reduce((n, x) => n + syllables(x), 0);
  const wps = w.length / s;
  const spw = syl / w.length;
  return {
    words: w.length,
    grade: Math.round((0.39 * wps + 11.8 * spw - 15.59) * 10) / 10,
    ease: Math.round((206.835 - 1.015 * wps - 84.6 * spw) * 10) / 10,
  };
}

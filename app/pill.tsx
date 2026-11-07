// Status pills shared by Orders and tracking and Dispute cases, so the same state looks the same on both screens.
import type { ReactNode } from "react";

export const TONES = {
  good: { background: "#e3f3ea", color: "#1d6b3f" },
  warn: { background: "#fdf1d8", color: "#7a4b00" },
  bad: { background: "#fbe6e4", color: "#a3231b" },
  info: { background: "#e7eafa", color: "#33449a" },
  muted: { background: "#eef0f3", color: "#4a5160" },
} as const;
export type Tone = keyof typeof TONES;

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span style={{ ...TONES[tone], padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{children}</span>;
}

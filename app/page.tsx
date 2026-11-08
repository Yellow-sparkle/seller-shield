"use client";
// Health scan (PRD F1), the home page. Numbers come from /api/scan, read live from the PayPal sandbox on load.
// Each card opens the rows behind its number.
import { useEffect, useState } from "react";
import type { Health } from "@/lib/health";

type ScanResult = { ok: boolean; asOf: string; health?: Health; error?: string };

export default function ScanPage() {
  const [result, setResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    fetch("/api/scan")
      .then((r) => r.json() as Promise<ScanResult>)
      .then(setResult)
      .catch(() => setResult({ ok: false, asOf: new Date().toISOString(), error: "The scan request failed." }));
  }, []);

  return (
    <main style={{ padding: 16, width: "100%", maxWidth: 900, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22 }}>Health scan</h1>
      <p style={{ color: "#4a5568", fontSize: 13, margin: "0 0 16px" }}>{result ? `${result.ok ? "Read" : "Tried"} ${new Date(result.asOf).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : "Reading PayPal..."}</p>

      {result && !result.ok && (
        <>
          <p role="alert">Could not read PayPal: {result.error}</p>
          {/* The other screens read saved data, so the seller is not left at a dead end (review, 8 Nov 2026). */}
          <p style={{ fontSize: 14 }}>
            Your orders and dispute cases are still available: <a href="/orders">Orders and tracking</a> · <a href="/cases">Dispute cases</a>
          </p>
        </>
      )}

      {result?.ok && result.health && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <Card title="Money at risk" value={`${result.health.moneyAtRisk.currency} ${result.health.moneyAtRisk.amount.toFixed(2)}`} detail={`${result.health.moneyAtRisk.count} open disputes`} href="/cases" action="Open the dispute cases" />
            <Card
              title="Missing tracking"
              value={`${result.health.missingTracking.count} orders`}
              detail={`${result.health.missingTracking.currency} ${result.health.missingTracking.total.toFixed(2)}`}
              href="/orders?chip=missingTracking&chip=sandbox"
              action="Show these orders in the grid"
            />
            <Card
              title="Next deadline"
              value={result.health.nextDeadline ? `${result.health.nextDeadline.daysLeft} days` : "None"}
              detail={result.health.nextDeadline ? new Date(result.health.nextDeadline.date).toLocaleDateString() : "No open deadline"}
              href={result.health.nextDeadline?.disputeId ? `/cases#${result.health.nextDeadline.disputeId}` : "/cases"}
              action={result.health.nextDeadline?.disputeId ? "Open this case" : "Open the dispute cases"}
            />
          </div>
        </>
      )}
    </main>
  );
}

function Card({ title, value, detail, href, action }: { title: string; value: string; detail: string; href: string; action: string }) {
  return (
    <a href={href} style={{ display: "block", padding: 18, background: "#ffffff", border: "1px solid #d6dee8", borderTop: "6px solid #ffc439", borderRadius: 8, color: "inherit", textDecoration: "none", boxShadow: "0 1px 2px rgba(0,48,135,0.06)" }}>
      <div style={{ fontSize: 13, color: "#555" }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#003087" }}>{value}</div>
      <div style={{ fontSize: 13, color: "#555" }}>{detail}</div>
      <div style={{ fontSize: 13, marginTop: 8, color: "#0070ba", fontWeight: 600 }}>{action} →</div>
    </a>
  );
}

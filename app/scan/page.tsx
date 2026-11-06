"use client";
// Health scan (PRD F1). Numbers come from /api/scan, read live from the PayPal sandbox on load.
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
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22 }}>Health scan</h1>
      <p style={{ color: "#555" }}>Sandbox. Read-only.{result ? ` As of ${new Date(result.asOf).toLocaleString()}.` : " Loading..."}</p>

      {result && !result.ok && <p role="alert">Could not read PayPal: {result.error}</p>}

      {result?.ok && result.health && (
        <>
          <p style={{ fontSize: 16 }}>{result.health.copy}</p>
          <p style={{ fontSize: 13, color: "#555" }}>Demo data: {result.health.demoMissingTracking} seeded orders also lack tracking. These are not counted in the cards.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <Card title="Money at risk" value={`${result.health.moneyAtRisk.currency} ${result.health.moneyAtRisk.amount.toFixed(2)}`} detail={`${result.health.moneyAtRisk.count} open disputes`} href="/" />
            <Card
              title="Missing tracking"
              value={`${result.health.missingTracking.count} orders`}
              detail={`${result.health.missingTracking.currency} ${result.health.missingTracking.total.toFixed(2)}`}
              href="/orders"
            />
            <Card
              title="Next deadline"
              value={result.health.nextDeadline ? `${result.health.nextDeadline.daysLeft} days` : "None"}
              detail={result.health.nextDeadline ? new Date(result.health.nextDeadline.date).toLocaleDateString() : "No open deadline"}
              href="/"
            />
          </div>
        </>
      )}
    </main>
  );
}

function Card({ title, value, detail, href }: { title: string; value: string; detail: string; href: string }) {
  return (
    <a href={href} style={{ display: "block", padding: 16, border: "1px solid #ccc", borderRadius: 8, color: "inherit", textDecoration: "none" }}>
      <div style={{ fontSize: 13, color: "#555" }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 13, color: "#555" }}>{detail}</div>
    </a>
  );
}

"use client";
// One bar across all three screens, so they read as one product. The badge says every PayPal call is sandbox.
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Health scan" },
  { href: "/orders", label: "Orders and tracking" },
  { href: "/cases", label: "Dispute cases" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, padding: "12px 20px", background: "#003087", color: "#ffffff", fontFamily: "system-ui, sans-serif" }}>
      <strong style={{ fontSize: 17 }}>Seller Shield</strong>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined} style={{ color: "#ffffff", textDecoration: "none", opacity: path === l.href ? 1 : 0.8, borderBottom: path === l.href ? "3px solid #ffc439" : "3px solid transparent", paddingBottom: 2, fontWeight: path === l.href ? 600 : 400 }}>
          {l.label}
        </Link>
      ))}
      <span title="Every PayPal call in this app goes to the PayPal sandbox. No real money." style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, padding: "2px 10px", borderRadius: 999, background: "#ffc439", color: "#003087", border: "none" }}>
        PayPal sandbox
      </span>
    </nav>
  );
}

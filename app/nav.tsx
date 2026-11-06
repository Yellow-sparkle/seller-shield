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
    <nav aria-label="Main" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, padding: "10px 16px", borderBottom: "1px solid #ddd", fontFamily: "system-ui, sans-serif" }}>
      <strong style={{ fontSize: 16 }}>Seller Shield</strong>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined} style={{ color: "inherit", textDecoration: path === l.href ? "underline" : "none", fontWeight: path === l.href ? 600 : 400 }}>
          {l.label}
        </Link>
      ))}
      <span title="Every PayPal call in this app goes to the PayPal sandbox. No real money." style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, padding: "2px 10px", borderRadius: 999, background: "#fff4d6", color: "#7a4b00", border: "1px solid #e8c56b" }}>
        PayPal sandbox
      </span>
    </nav>
  );
}

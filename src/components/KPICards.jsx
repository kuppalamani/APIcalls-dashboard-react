import React from "react";

const fmt = (n) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}K`
    : n;

const cards = [
  { key: "totalCalls", label: "Total API Calls", color: "#00e5ff" },
  { key: "lastDayCalls", label: "Last Day Calls", color: "#22d3ee" },
  { key: "dailyAverage", label: "Daily Average", color: "#a78bfa" },
  { key: "activeTenants", label: "Active Tenants", color: "#34d399" },
  { key: "activeConnectors", label: "Connectors", color: "#fbbf24" },
];

export default function KPICards({ metrics }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16 }}>
      {cards.map((c) => (
        <div key={c.key} style={{ padding: 20, background: "#0d1526", borderRadius: 12 }}>
          <div style={{ color: "#64748b", fontSize: 11 }}>{c.label}</div>
          <div style={{ fontSize: 24, color: "#fff", marginTop: 6 }}>
            {fmt(metrics[c.key] || 0)}
          </div>
        </div>
      ))}
    </div>
  );
}

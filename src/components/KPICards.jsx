// src/components/KPICards.jsx
import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";

import SectionHeader from "./SectionHeader";
import ChartCard from "./ChartCard";
import CustomTooltip from "./CustomTooltip";

const CHART_THEME = {
  gridColor: "#1e293b",
  textColor: "#94a3b8"
};

const fmt = (n) => {
  if (!n) return "0";

  return n >= 1000000
    ? `${(n / 1000000).toFixed(1)}M`
    : n >= 1000
    ? `${(n / 1000).toFixed(1)}K`
    : n.toLocaleString();
};

const cards = [
  { key: "totalCalls", label: "Total API Calls", icon: "◈", color: "#00e5ff", sub: "All time" },
  { key: "dailyAverage", label: "Daily Average", icon: "⟡", color: "#a78bfa", sub: "Calls / day" },
  { key: "activeTenants", label: "Active Tenants", icon: "⬡", color: "#34d399", sub: "With traffic" },
  { key: "activeConnectors", label: "Connectors", icon: "⊕", color: "#fbbf24", sub: "Unique" },
  { key: "thisMonthCalls", label: "This Month", icon: "◉", color: "#f87171", sub: "Current period" }
];

export default function KPICards({ metrics = {}, hourlyTrend = [] }) {
  return (
    <>
      <SectionHeader label="Last 24 Hour API Calls" />

      <ChartCard title="24 Hour Traffic" subtitle="API calls distribution by hour">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={hourlyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridColor} />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: CHART_THEME.textColor }} />
            <YAxis tick={{ fontSize: 10, fill: CHART_THEME.textColor }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="calls" fill="#00e5ff" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "16px",
          marginBottom: "28px"
        }}
      >
        {cards.map(({ key, label, icon, color, sub }, i) => {
          const value = metrics[key] ?? 0;

          return (
            <div
              key={key}
              style={{
                background: "linear-gradient(135deg,#0d1526 0%,#111827 100%)",
                border: `1px solid ${color}22`,
                borderRadius: "14px",
                padding: "20px 18px",
                position: "relative",
                overflow: "hidden",
                animation: `fadeUp 0.5s ease ${i * 0.07}s both`,
                cursor: "default",
                transition: "transform 0.2s, box-shadow 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow = `0 8px 30px ${color}22`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "2px",
                  background: `linear-gradient(90deg,${color},transparent)`
                }}
              />

              <div
                style={{
                  position: "absolute",
                  top: -20,
                  right: -20,
                  width: 80,
                  height: 80,
                  background: color,
                  borderRadius: "50%",
                  opacity: 0.04,
                  filter: "blur(20px)"
                }}
              />

              <div style={{ fontSize: 22, marginBottom: 10, opacity: 0.6, color }}>
                {icon}
              </div>

              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 26,
                  fontWeight: 600,
                  color: "#f1f5f9",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                  marginBottom: 6
                }}
              >
                {fmt(value)}
              </div>

              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em"
                }}
              >
                {label}
              </div>

              <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>
                {sub}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

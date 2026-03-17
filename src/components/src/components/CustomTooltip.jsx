// src/components/CustomTooltip.jsx
import React from "react";

export default function CustomTooltip({ active, payload, label }) {

  if (!active || !payload || !payload.length) return null;

  return (
    <div
      style={{
        background: "#0d1526",
        border: "1px solid #1e293b",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12
      }}
    >

      <div
        style={{
          color: "#94a3b8",
          marginBottom: 6
        }}
      >
        {label}
      </div>

      {payload.map((p, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            color: p.color
          }}
        >
          <span>{p.name}</span>
          <span style={{ fontFamily: "monospace" }}>
            {(p.value || 0).toLocaleString()}
          </span>
        </div>
      ))}

    </div>
  );
}

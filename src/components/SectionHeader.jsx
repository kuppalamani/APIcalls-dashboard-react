// src/components/SectionHeader.jsx
import React from "react";

export default function SectionHeader({ label }) {
  return (
    <div
      style={{
        fontSize: 14,
        fontWeight: 600,
        margin: "28px 0 12px",
        color: "#94a3b8",
        textTransform: "uppercase",
        letterSpacing: "0.08em"
      }}
    >
      {label}
    </div>
  );
}

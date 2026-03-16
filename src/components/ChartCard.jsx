// src/components/ChartCard.jsx
import React from 'react';

export default function ChartCard({ title, subtitle, children, style = {} }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0d1526 0%, #0f1923 100%)',
      border: '1px solid #1e293b',
      borderRadius: '14px',
      padding: '20px',
      ...style,
    }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 14, fontWeight: 700,
          color: '#e2e8f0', letterSpacing: '0.01em',
        }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      {children}
    </div>
  );
}

export function SectionHeader({ label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      margin: '28px 0 16px 0',
    }}>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10, fontWeight: 600,
        color: '#334155', letterSpacing: '0.15em', textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #1e293b, transparent)' }} />
    </div>
  );
}

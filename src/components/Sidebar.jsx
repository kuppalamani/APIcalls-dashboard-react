// src/components/Sidebar.jsx
import React, { useState } from 'react';

const MultiSelect = ({ label, options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const allSelected = value.length === 0;

  return (
    <div style={{ marginBottom: 16, position: 'relative' }}>
      <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontWeight: 600 }}>
        {label}
      </div>
      <div
        onClick={() => setOpen(!open)}
        style={{
          background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 8,
          padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: '#94a3b8',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span>{allSelected ? `All ${label}` : `${value.length} selected`}</span>
        <span style={{ opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 100,
          background: '#0d1526', border: '1px solid #1e293b', borderRadius: 8,
          maxHeight: 200, overflowY: 'auto', marginTop: 4,
        }}>
          <div
            onClick={() => { onChange([]); setOpen(false); }}
            style={{ padding: '8px 12px', fontSize: 12, color: '#64748b', cursor: 'pointer', borderBottom: '1px solid #1e293b' }}
          >
            All {label}
          </div>
          {options.map(opt => (
            <div
              key={opt}
              onClick={() => {
                const next = value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt];
                onChange(next);
              }}
              style={{
                padding: '8px 12px', fontSize: 12, cursor: 'pointer',
                color: value.includes(opt) ? '#00e5ff' : '#94a3b8',
                background: value.includes(opt) ? 'rgba(0,229,255,0.05)' : 'transparent',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span style={{
                width: 12, height: 12, borderRadius: 3,
                border: `1px solid ${value.includes(opt) ? '#00e5ff' : '#334155'}`,
                background: value.includes(opt) ? '#00e5ff' : 'transparent',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, color: '#000', flexShrink: 0,
              }}>
                {value.includes(opt) ? '✓' : ''}
              </span>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function Sidebar({
  tenants, connectors, dateRange, allTenants, allConnectors,
  onTenantChange, onConnectorChange, onDateChange, onEmailChange,
  emailSearch, spikeZ, onSpikeZChange, topN, onTopNChange,
  onFileUpload, isDemo,
}) {
  return (
    <div style={{
      width: 240, flexShrink: 0,
      background: '#080d1a',
      borderRight: '1px solid #0f172a',
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflowY: 'auto',
      position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 16px' }}>
        <div style={{
          fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800,
          color: '#f1f5f9', letterSpacing: '-0.02em',
        }}>
          <span style={{ color: '#00e5ff' }}>API</span> Analytics
        </div>
        <div style={{ fontSize: 10, color: '#334155', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
          USAGE INTELLIGENCE
        </div>
      </div>

      <div style={{ height: 1, background: '#0f172a', margin: '0 20px' }} />

      {/* Upload */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600 }}>
          Data Source
        </div>
        <label style={{
          display: 'block', border: '1px dashed #1e3a5f', borderRadius: 8,
          padding: '12px', textAlign: 'center', cursor: 'pointer',
          transition: 'border-color 0.2s',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#00e5ff'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#1e3a5f'}
        >
          <input type="file" accept=".xlsx,.xls" onChange={onFileUpload} style={{ display: 'none' }} />
          <div style={{ fontSize: 20, marginBottom: 4 }}>📂</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Upload Excel File</div>
          <div style={{ fontSize: 9, color: '#334155', marginTop: 2 }}>.xlsx / .xls</div>
        </label>
        {isDemo && (
          <div style={{
            marginTop: 8, padding: '6px 10px', background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.2)', borderRadius: 6,
            fontSize: 10, color: '#fbbf24',
          }}>
            🎲 Using demo data
          </div>
        )}
      </div>

      <div style={{ height: 1, background: '#0f172a', margin: '0 20px' }} />

      {/* Filters */}
      <div style={{ padding: '16px 20px', flex: 1 }}>
        <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, fontWeight: 600 }}>
          Filters
        </div>

        <MultiSelect label="Tenants" options={allTenants} value={tenants} onChange={onTenantChange} />
        <MultiSelect label="Connectors" options={allConnectors} value={connectors} onChange={onConnectorChange} />

        {/* Date range */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontWeight: 600 }}>
            Date Range
          </div>
          <input type="date" value={dateRange.start} onChange={e => onDateChange({ ...dateRange, start: e.target.value })}
            style={inputStyle} />
          <input type="date" value={dateRange.end} onChange={e => onDateChange({ ...dateRange, end: e.target.value })}
            style={{ ...inputStyle, marginTop: 6 }} />
        </div>

        {/* Email search */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontWeight: 600 }}>
            Customer Email
          </div>
          <input
            type="text" value={emailSearch} onChange={e => onEmailChange(e.target.value)}
            placeholder="Search email..."
            style={inputStyle}
          />
        </div>

        <div style={{ height: 1, background: '#0f172a', margin: '8px 0 16px' }} />

        {/* Settings */}
        <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, fontWeight: 600 }}>
          Settings
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>Spike threshold (σ)</span>
            <span style={{ color: '#00e5ff', fontFamily: 'JetBrains Mono' }}>{spikeZ}</span>
          </div>
          <input type="range" min="1.5" max="4" step="0.1" value={spikeZ}
            onChange={e => onSpikeZChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#00e5ff' }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>Top N items</span>
            <span style={{ color: '#a78bfa', fontFamily: 'JetBrains Mono' }}>{topN}</span>
          </div>
          <input type="range" min="5" max="20" step="1" value={topN}
            onChange={e => onTopNChange(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: '#a78bfa' }} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #0f172a' }}>
        <div style={{ fontSize: 9, color: '#1e293b', fontFamily: 'JetBrains Mono', textAlign: 'center' }}>
          API USAGE ANALYTICS v1.0
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', background: '#0a0f1e', border: '1px solid #1e293b',
  borderRadius: 8, padding: '7px 10px', fontSize: 11, color: '#94a3b8',
  outline: 'none', boxSizing: 'border-box', colorScheme: 'dark',
};

// src/components/Sidebar.jsx
import React, { useState } from "react";

const MultiSelect = ({ label, options = [], value = [], onChange }) => {
  const [open, setOpen] = useState(false);

  const selected = value || [];
  const opts = options || [];
  const allSelected = selected.length === 0;

  return (
    <div style={{ marginBottom: 16, position: "relative" }}>
      <div
        style={{
          fontSize: 10,
          color: "#475569",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        {label}
      </div>

      <div
        onClick={() => setOpen(!open)}
        style={{
          background: "#0a0f1e",
          border: "1px solid #1e293b",
          borderRadius: 8,
          padding: "8px 12px",
          cursor: "pointer",
          fontSize: 12,
          color: "#94a3b8",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>
          {allSelected ? `All ${label}` : `${selected.length} selected`}
        </span>
        <span style={{ opacity: 0.5 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "100%",
            zIndex: 100,
            background: "#0d1526",
            border: "1px solid #1e293b",
            borderRadius: 8,
            maxHeight: 200,
            overflowY: "auto",
            marginTop: 4,
          }}
        >
          <div
            onClick={() => {
              onChange([]);
              setOpen(false);
            }}
            style={{
              padding: "8px 12px",
              fontSize: 12,
              color: "#64748b",
              cursor: "pointer",
              borderBottom: "1px solid #1e293b",
            }}
          >
            All {label}
          </div>

          {opts.map((opt) => (
            <div
              key={opt}
              onClick={() => {
                const next = selected.includes(opt)
                  ? selected.filter((v) => v !== opt)
                  : [...selected, opt];
                onChange(next);
              }}
              style={{
                padding: "8px 12px",
                fontSize: 12,
                cursor: "pointer",
                color: selected.includes(opt) ? "#00e5ff" : "#94a3b8",
                background: selected.includes(opt)
                  ? "rgba(0,229,255,0.05)"
                  : "transparent",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  border: `1px solid ${
                    selected.includes(opt) ? "#00e5ff" : "#334155"
                  }`,
                  background: selected.includes(opt)
                    ? "#00e5ff"
                    : "transparent",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 8,
                  color: "#000",
                  flexShrink: 0,
                }}
              >
                {selected.includes(opt) ? "✓" : ""}
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
  tenants = [],
  connectors = [],
  dateRange = {},
  allTenants = [],
  allConnectors = [],
  onTenantChange,
  onConnectorChange,
  onDateChange,
  onEmailChange,
  emailSearch = "",
  spikeZ = 2.5,
  onSpikeZChange,
  topN = 10,
  onTopNChange,
  onFileUpload,
  isDemo,
}) {
  const start = dateRange?.start || "";
  const end = dateRange?.end || "";

  return (
    <div
      style={{
        width: 240,
        flexShrink: 0,
        background: "#080d1a",
        borderRight: "1px solid #0f172a",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflowY: "auto",
        position: "sticky",
        top: 0,
      }}
    >
      <div style={{ padding: "24px 20px 16px" }}>
        <div
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 16,
            fontWeight: 800,
            color: "#f1f5f9",
          }}
        >
          <span style={{ color: "#00e5ff" }}>API</span> Analytics
        </div>
      </div>

      <div style={{ height: 1, background: "#0f172a", margin: "0 20px" }} />

      <div style={{ padding: "16px 20px" }}>
        <label
          style={{
            display: "block",
            border: "1px dashed #1e3a5f",
            borderRadius: 8,
            padding: "12px",
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={onFileUpload}
            style={{ display: "none" }}
          />
          Upload Excel File
        </label>

        {isDemo && (
          <div
            style={{
              marginTop: 8,
              fontSize: 10,
              color: "#fbbf24",
            }}
          >
            Using demo data
          </div>
        )}
      </div>

      <div style={{ padding: "16px 20px", flex: 1 }}>
        <MultiSelect
          label="Tenants"
          options={allTenants}
          value={tenants}
          onChange={onTenantChange}
        />

        <MultiSelect
          label="Connectors"
          options={allConnectors}
          value={connectors}
          onChange={onConnectorChange}
        />

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, marginBottom: 6 }}>Date Range</div>

          <input
            type="date"
            value={start}
            onChange={(e) =>
              onDateChange({ ...dateRange, start: e.target.value })
            }
            style={inputStyle}
          />

          <input
            type="date"
            value={end}
            onChange={(e) =>
              onDateChange({ ...dateRange, end: e.target.value })
            }
            style={{ ...inputStyle, marginTop: 6 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            value={emailSearch}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="Search email..."
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: "#0a0f1e",
  border: "1px solid #1e293b",
  borderRadius: 8,
  padding: "7px 10px",
  fontSize: 11,
  color: "#94a3b8",
  outline: "none",
  boxSizing: "border-box",
};

import { useState, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";
import {
  Upload, Activity, Users, Plug, TrendingUp,
  Download, Sparkles, Search, ChevronUp, ChevronDown, X
} from "lucide-react";

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#050d1a",
  panel: "#0a1628",
  border: "#132040",
  cyan: "#00c8ff",
  green: "#00e5a0",
  amber: "#ffb800",
  magenta: "#ff4d8f",
  text: "#b8cfe8",
  white: "#e8f2ff",
  muted: "#4a6a8a",
};

const CONNECTOR_COLORS = [
  "#00c8ff","#00e5a0","#ffb800","#ff4d8f",
  "#a78bfa","#fb923c","#34d399","#f472b6","#60a5fa","#fbbf24"
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtK = n =>
  n >= 1e6 ? (n / 1e6).toFixed(2) + "M" :
  n >= 1e3 ? (n / 1e3).toFixed(1) + "K" :
  (n || 0).toLocaleString();

const connectorKey = (raw = "") => {
  const m = raw.match(/MS_([^_]+(?:v\d+)?(?:_live)?)/i);
  if (m) return m[1].replace("_live", "");
  if (raw.startsWith("OPENAPI_")) return "OPENAPI workforceNow";
  return raw.split("_")[0] || raw;
};

// ── Excel Parser ──────────────────────────────────────────────────────────────
function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array" });

        const sheetName =
          wb.SheetNames.find(n => n.toLowerCase().includes("tenant")) ||
          wb.SheetNames[0];

        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: 0 });

        if (!rows.length) throw new Error("No data found in sheet");

        const allKeys = Object.keys(rows[0]);
        const fixedCols = allKeys.slice(0, 3);
        const dateCols = allKeys.slice(3);

        resolve({ rows, fixedCols, dateCols, sheetName, allSheets: wb.SheetNames });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

// ── Spark Bars ────────────────────────────────────────────────────────────────
function SparkBars({ values }) {
  const max = Math.max(...values, 1);
  const isUp = values[values.length - 1] >= values[0];
  const color = isUp ? C.green : C.magenta;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 20 }}>
      {values.slice(-3).map((v, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: Math.max(3, (v / max) * 20),
            background: color,
            borderRadius: 2,
            opacity: 0.5 + i * 0.25,
          }}
        />
      ))}
    </div>
  );
}

// ── Upload Screen ─────────────────────────────────────────────────────────────
function UploadScreen({ onData }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  const handle = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError("Please upload an .xlsx or .xls file");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await parseExcel(file);
      onData(data, file.name);
    } catch (err) {
      setError("Failed to parse file: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [onData]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handle(e.dataTransfer.files[0]);
  }, [handle]);

  return (
    <div style={{
      background: C.bg, minHeight: "100vh", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif", padding: 24,
    }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{
          width: 64, height: 64,
          background: "linear-gradient(135deg,#0a2a5e,#0d3d80)",
          borderRadius: 16, display: "flex", alignItems: "center",
          justifyContent: "center", margin: "0 auto 20px",
          boxShadow: "0 0 30px #00c8ff33",
        }}>
          <Activity size={28} color={C.cyan} />
        </div>
        <p style={{
          fontSize: 11, letterSpacing: 4, color: C.muted,
          textTransform: "uppercase", marginBottom: 8,
          fontFamily: "'Space Mono', monospace",
        }}>
          ADP Integration Platform
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: C.white, marginBottom: 8 }}>
          API Call Monitor
        </h1>
        <p style={{ color: C.muted, fontSize: 14 }}>
          Upload your daily Excel report to visualize API usage
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          width: "100%", maxWidth: 440,
          border: `2px dashed ${dragging ? C.cyan : C.border}`,
          borderRadius: 16,
          background: dragging ? "#0a2040" : C.panel,
          padding: "48px 32px", textAlign: "center",
          cursor: "pointer", transition: "all 0.2s",
          boxShadow: dragging ? `0 0 30px ${C.cyan}22` : "none",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: "none" }}
          onChange={(e) => handle(e.target.files[0])}
        />
        {loading ? (
          <div>
            <div className="spin" style={{
              width: 40, height: 40,
              border: `3px solid ${C.border}`,
              borderTop: `3px solid ${C.cyan}`,
              borderRadius: "50%", margin: "0 auto 16px",
            }} />
            <p style={{ color: C.text, fontSize: 14 }}>Parsing your Excel file...</p>
          </div>
        ) : (
          <>
            <Upload size={36} color={C.cyan} style={{ margin: "0 auto 16px" }} />
            <p style={{ color: C.white, fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
              Drag & drop your Excel file
            </p>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>or click to browse</p>
            <button style={{
              background: "linear-gradient(135deg,#0d7a5f,#00c896)",
              color: "#fff", border: "none", borderRadius: 8,
              padding: "10px 24px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
            }}>
              <Download size={14} /> Select .xlsx file
            </button>
          </>
        )}
      </div>

      {error && (
        <p style={{ color: C.magenta, fontSize: 13, marginTop: 16, maxWidth: 440, textAlign: "center" }}>
          {error}
        </p>
      )}
      <p style={{ color: C.muted, fontSize: 12, marginTop: 20 }}>
        Supports the standard ADP API calls Excel format
      </p>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ data, fileName, onReset }) {
  const { rows, dateCols } = data;
  const [search, setSearch] = useState("");
  const [connFilter, setConnFilter] = useState("All");
  const [sortCol, setSortCol] = useState("total");
  const [sortDir, setSortDir] = useState("desc");
  const [aiInsights, setAiInsights] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAI, setShowAI] = useState(false);

  const tenantCol = Object.keys(rows[0] || {})[2] || "Tenant Name";
  const connCol   = Object.keys(rows[0] || {})[0] || "Connector";
  const tableDates = dateCols.slice(-3);

  // Enrich rows
  const enriched = useMemo(() => rows.map(r => {
    const total = dateCols.reduce((s, d) => s + (Number(r[d]) || 0), 0);
    const first = Number(r[dateCols[0]]) || 0;
    const last  = Number(r[dateCols[dateCols.length - 1]]) || 0;
    const trend = first ? (((last - first) / first) * 100).toFixed(1) : "0.0";
    return {
      ...r,
      _total: total,
      _trend: parseFloat(trend),
      _spark: dateCols.slice(-5).map(d => Number(r[d]) || 0),
      _connKey: connectorKey(r[connCol] || ""),
    };
  }), [rows, dateCols, connCol]);

  // KPIs
  const totalCalls   = useMemo(() => enriched.reduce((s, r) => s + r._total, 0), [enriched]);
  const activeTenants = enriched.length;
  const connectors   = useMemo(() => [...new Set(enriched.map(r => r._connKey))], [enriched]);
  const lastTotal    = useMemo(() => enriched.reduce((s, r) => s + (Number(r[dateCols[dateCols.length - 1]]) || 0), 0), [enriched, dateCols]);
  const prevTotal    = useMemo(() => dateCols.length > 1
    ? enriched.reduce((s, r) => s + (Number(r[dateCols[dateCols.length - 2]]) || 0), 0)
    : lastTotal, [enriched, dateCols, lastTotal]);
  const dailyChange  = prevTotal ? (((lastTotal - prevTotal) / prevTotal) * 100).toFixed(1) : "0.0";
  const dateRange    = dateCols.length ? `${dateCols[0]} — ${dateCols[dateCols.length - 1]}` : "";

  // Charts data
  const dailyVolume = useMemo(() => {
    const cols = dateCols.length > 14 ? dateCols.slice(-14) : dateCols;
    return cols.map(d => ({
      date: d,
      calls: enriched.reduce((s, r) => s + (Number(r[d]) || 0), 0),
    }));
  }, [enriched, dateCols]);

  const connectorTotals = useMemo(() => {
    const map = {};
    enriched.forEach(r => { map[r._connKey] = (map[r._connKey] || 0) + r._total; });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, calls]) => ({ name, calls }));
  }, [enriched]);

  // Filtered table
  const filtered = useMemo(() => {
    let list = enriched;
    if (connFilter !== "All") list = list.filter(r => r._connKey === connFilter);
    if (search) list = list.filter(r =>
      (r[tenantCol] || "").toLowerCase().includes(search.toLowerCase())
    );
    const key = sortCol === "total" ? "_total" : "_trend";
    return [...list].sort((a, b) =>
      sortDir === "desc" ? b[key] - a[key] : a[key] - b[key]
    );
  }, [enriched, connFilter, search, sortCol, sortDir, tenantCol]);

  const toggleSort = (col) => {
    if (sortCol === col) setDir(d => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  };
  const setDir = setSortDir;

  // Export CSV
  const exportCSV = () => {
    const cols = [connCol, "OID", tenantCol, ...tableDates, "Total", "Trend%"];
    const csvRows = [
      cols.join(","),
      ...filtered.map(r => [
        `"${r[connCol] || ""}"`,
        `"${r[Object.keys(rows[0])[1]] || ""}"`,
        `"${r[tenantCol] || ""}"`,
        ...tableDates.map(d => r[d] || 0),
        r._total,
        r._trend,
      ].join(",")),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "adp_api_calls.csv";
    a.click();
  };

  // AI Insights
  const fetchAI = async () => {
    setAiLoading(true);
    setShowAI(true);
    const top5 = filtered.slice(0, 5).map(r => ({
      tenant: r[tenantCol], total: r._total, trend: r._trend,
    }));
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 600,
          messages: [{
            role: "user",
            content: `ADP API usage: totalCalls=${totalCalls}, tenants=${activeTenants}, connectors=${connectors.length}, dailyChange=${dailyChange}%, top5=${JSON.stringify(top5)}. Give exactly 3 insights as JSON array [{title,insight}]. Title max 4 words ALL CAPS. Insight 1-2 sentences. Respond ONLY with the JSON array.`,
          }],
        }),
      });
      const d = await res.json();
      const text = d.content?.find(c => c.type === "text")?.text || "[]";
      setAiInsights(JSON.parse(text.replace(/```json|```/g, "").trim()));
    } catch {
      setAiInsights([{ title: "UNAVAILABLE", insight: "Could not load AI insights at this time." }]);
    }
    setAiLoading(false);
  };

  const tooltipStyle = {
    background: "#0d1e38", border: `1px solid ${C.border}`,
    borderRadius: 6, fontSize: 12, color: C.text,
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 28px", borderBottom: `1px solid ${C.border}`,
        background: C.panel, flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36,
            background: "linear-gradient(135deg,#0a2a5e,#0d3d80)",
            borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Activity size={18} color={C.cyan} />
          </div>
          <div>
            <p style={{
              fontSize: 9, letterSpacing: 3, color: C.muted,
              textTransform: "uppercase", fontFamily: "'Space Mono', monospace",
            }}>
              ADP Integration Platform
            </p>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: C.white }}>API Call Monitor</h1>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 10, color: C.muted }}>Report period</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.cyan, fontFamily: "'Space Mono', monospace" }}>
              {dateRange}
            </p>
          </div>
          <button className="btn-hover" onClick={exportCSV} style={{
            background: "#0d3d20", border: `1px solid ${C.green}55`,
            color: C.green, borderRadius: 8, padding: "8px 14px",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Download size={13} /> Export CSV
          </button>
          <button className="btn-hover" onClick={fetchAI} style={{
            background: "linear-gradient(135deg,#2a0a4a,#4a0a7a)",
            border: "1px solid #9b6dff55", color: "#c084fc",
            borderRadius: 8, padding: "8px 14px",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Sparkles size={13} /> AI Insights
          </button>
          <button onClick={onReset} style={{
            background: "transparent", border: `1px solid ${C.border}`,
            color: C.muted, borderRadius: 8, padding: "8px 10px", cursor: "pointer",
          }}>
            <X size={14} />
          </button>
        </div>
      </div>

      <div style={{ padding: "20px 28px" }}>

        {/* ── KPI Cards ── */}
        <div className="fade-in" style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))",
          gap: 16, marginBottom: 20,
        }}>
          {[
            { label: "Total API Calls",  value: fmtK(totalCalls),    sub: `${dateCols.length}-period total`,                          icon: <Activity size={18} />,    color: C.cyan    },
            { label: "Active Tenants",   value: activeTenants,        sub: "unique orgs",                                              icon: <Users size={18} />,       color: C.green   },
            { label: "Connectors Used",  value: connectors.length,    sub: "connector types",                                          icon: <Plug size={18} />,        color: C.amber   },
            { label: "Daily Avg Calls",  value: fmtK(Math.round(totalCalls / (dateCols.length || 1))), sub: `${Number(dailyChange) > 0 ? "+" : ""}${dailyChange}% last period`, icon: <TrendingUp size={18} />, color: "#fb923c" },
          ].map((k, i) => (
            <div key={i} style={{
              background: C.panel, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: "16px 20px",
              borderTop: `2px solid ${k.color}40`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <p style={{ fontSize: 11, color: C.muted, letterSpacing: 1, textTransform: "uppercase" }}>{k.label}</p>
                <span style={{ color: k.color, opacity: 0.7 }}>{k.icon}</span>
              </div>
              <p style={{ fontSize: 28, fontWeight: 700, color: k.color, marginBottom: 4 }}>{k.value}</p>
              <p style={{ fontSize: 11, color: C.muted }}>{k.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Charts Row ── */}
        <div className="fade-in" style={{
          display: "grid", gridTemplateColumns: "1.4fr 1fr",
          gap: 16, marginBottom: 20,
        }}>
          {/* Daily volume */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <p style={{
              fontSize: 10, letterSpacing: 3, color: C.muted,
              textTransform: "uppercase", marginBottom: 16,
              fontFamily: "'Space Mono', monospace",
            }}>
              Daily Call Volume
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyVolume} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#132040" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmtK} width={50} />
                <Tooltip formatter={v => [fmtK(v), "Calls"]} contentStyle={tooltipStyle} />
                <Bar dataKey="calls" fill={C.cyan} opacity={0.8} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top connectors */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <p style={{
              fontSize: 10, letterSpacing: 3, color: C.muted,
              textTransform: "uppercase", marginBottom: 16,
              fontFamily: "'Space Mono', monospace",
            }}>
              Top Connectors
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart layout="vertical" data={connectorTotals} margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                <XAxis type="number" tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmtK} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fill: C.text, fontSize: 11, fontFamily: "'Space Mono', monospace" }} tickLine={false} axisLine={false} />
                <Tooltip formatter={v => [fmtK(v), "Calls"]} contentStyle={tooltipStyle} />
                <Bar dataKey="calls" radius={[0, 3, 3, 0]}>
                  {connectorTotals.map((_, i) => (
                    <Cell key={i} fill={CONNECTOR_COLORS[i % CONNECTOR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── AI Insights ── */}
        {showAI && (
          <div className="fade-in" style={{
            background: C.panel, border: "1px solid #9b6dff44",
            borderRadius: 12, padding: 20, marginBottom: 20,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={14} color="#c084fc" />
                <p style={{
                  fontSize: 10, letterSpacing: 3, color: "#c084fc",
                  textTransform: "uppercase", fontFamily: "'Space Mono', monospace",
                }}>
                  AI Insights
                </p>
              </div>
              <button onClick={() => setShowAI(false)} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}>
                <X size={14} />
              </button>
            </div>
            {aiLoading ? (
              <p style={{ color: C.muted, fontSize: 13 }}>Analyzing your API data...</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
                {(aiInsights || []).map((ins, i) => (
                  <div key={i} style={{
                    background: "#0d1628", border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: "12px 14px",
                  }}>
                    <p style={{
                      fontSize: 9, letterSpacing: 2, marginBottom: 6,
                      color: ["#c084fc", C.cyan, C.green][i] || C.cyan,
                      fontFamily: "'Space Mono', monospace",
                    }}>
                      {ins.title}
                    </p>
                    <p style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{ins.insight}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tenant Table ── */}
        <div className="fade-in" style={{
          background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 12, overflow: "hidden",
        }}>
          {/* Table header controls */}
          <div style={{
            padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
            display: "flex", justifyContent: "space-between",
            alignItems: "center", flexWrap: "wrap", gap: 12,
          }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.white }}>Top Tenants by API Usage</p>
              <p style={{ fontSize: 11, color: C.muted }}>{filtered.length} tenants shown</p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {/* Search */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#0d1628", border: `1px solid ${C.border}`,
                borderRadius: 8, padding: "6px 12px",
              }}>
                <Search size={13} color={C.muted} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search tenant..."
                  style={{
                    background: "transparent", border: "none", outline: "none",
                    color: C.white, fontSize: 12, width: 140,
                  }}
                />
              </div>
              {/* Connector filter */}
              <select
                value={connFilter}
                onChange={e => setConnFilter(e.target.value)}
                style={{
                  background: "#0d1628", border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: "6px 12px",
                  color: C.text, fontSize: 12, cursor: "pointer",
                }}
              >
                <option value="All">All Connectors</option>
                {connectors.sort().map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {/* Quick filter pills */}
              {connectors.slice(0, 3).map((c, i) => (
                <button
                  key={c}
                  onClick={() => setConnFilter(f => f === c ? "All" : c)}
                  style={{
                    background: connFilter === c ? CONNECTOR_COLORS[i] + "33" : "transparent",
                    border: `1px solid ${connFilter === c ? CONNECTOR_COLORS[i] : C.border}`,
                    color: connFilter === c ? CONNECTOR_COLORS[i] : C.muted,
                    borderRadius: 6, padding: "4px 10px",
                    fontSize: 11, cursor: "pointer",
                    fontFamily: "'Space Mono', monospace",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["#", "Tenant", "Connector", ...tableDates, "Spark"].map(h => (
                    <th key={h} style={{
                      padding: "10px 16px", color: C.muted, fontWeight: 500,
                      textAlign: h === "#" || h === "Spark" ? "center" : "left",
                      fontSize: 11, letterSpacing: 1, textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                  <th
                    onClick={() => toggleSort("total")}
                    style={{
                      padding: "10px 16px", cursor: "pointer", userSelect: "none",
                      color: sortCol === "total" ? C.cyan : C.muted,
                      fontWeight: 500, textAlign: "right",
                      fontSize: 11, letterSpacing: 1, textTransform: "uppercase",
                    }}
                  >
                    Total {sortCol === "total" && (sortDir === "desc"
                      ? <ChevronDown size={11} style={{ display: "inline" }} />
                      : <ChevronUp size={11} style={{ display: "inline" }} />)}
                  </th>
                  <th
                    onClick={() => toggleSort("trend")}
                    style={{
                      padding: "10px 16px", cursor: "pointer", userSelect: "none",
                      color: sortCol === "trend" ? C.cyan : C.muted,
                      fontWeight: 500, textAlign: "right",
                      fontSize: 11, letterSpacing: 1, textTransform: "uppercase",
                    }}
                  >
                    Trend {sortCol === "trend" && (sortDir === "desc"
                      ? <ChevronDown size={11} style={{ display: "inline" }} />
                      : <ChevronUp size={11} style={{ display: "inline" }} />)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((r, i) => {
                  const tn = r[tenantCol] || "—";
                  const cn = r._connKey;
                  const colIdx = connectors.indexOf(cn) % CONNECTOR_COLORS.length;
                  const trendUp = r._trend > 0;
                  return (
                    <tr key={i} className="row-hover" style={{ borderBottom: `1px solid ${C.border}22` }}>
                      <td style={{ padding: "10px 16px", color: C.muted, fontFamily: "'Space Mono',monospace", fontSize: 11, textAlign: "center" }}>
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td style={{ padding: "10px 16px", color: C.white, fontWeight: 500, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {tn}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <span style={{
                          background: CONNECTOR_COLORS[colIdx] + "22",
                          color: CONNECTOR_COLORS[colIdx],
                          borderRadius: 4, padding: "2px 8px",
                          fontSize: 10, fontFamily: "'Space Mono',monospace", whiteSpace: "nowrap",
                        }}>
                          {cn}
                        </span>
                      </td>
                      {tableDates.map(d => (
                        <td key={d} style={{ padding: "10px 12px", color: C.text, textAlign: "right", fontFamily: "'Space Mono',monospace", fontSize: 11 }}>
                          {(Number(r[d]) || 0).toLocaleString()}
                        </td>
                      ))}
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <SparkBars values={r._spark} />
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: C.cyan, fontFamily: "'Space Mono',monospace", fontSize: 12 }}>
                        {fmtK(r._total)}
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "'Space Mono',monospace", fontSize: 12 }}>
                        <span style={{ color: trendUp ? C.green : r._trend < 0 ? C.magenta : C.muted }}>
                          {trendUp ? "↑" : "↓"} {Math.abs(r._trend)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length > 100 && (
              <p style={{ padding: "10px 20px", color: C.muted, fontSize: 11, fontFamily: "'Space Mono',monospace" }}>
                Showing 100 of {filtered.length} rows
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState(null);

  if (!state) {
    return <UploadScreen onData={(data, name) => setState({ data, name })} />;
  }
  return (
    <Dashboard
      data={state.data}
      fileName={state.name}
      onReset={() => setState(null)}
    />
  );
}

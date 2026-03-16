// src/App.jsx
import React, { useState, useMemo, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Area,
} from 'recharts';

import Sidebar from './components/Sidebar';
import KPICards from './components/KPICards';
import ChartCard, { SectionHeader } from './components/ChartCard';
import Heatmap from './components/Heatmap';
import { parseExcelFile, computeKPIs, getDailyTrend, getMonthlyTrend, getTopTenants, getTopConnectors, getConnectorByTenant, getHeatmapData, getDayOfWeekAvg, detectSpikes, segmentTenants, getActiveTenants, getConnectorTrend, getUniqueTenants, getUniqueConnectors, getDateRange } from './utils/dataProcessor';
import { generateDemoData } from './utils/demoData';

// ── Constants ────────────────────────────────────────────────────
const COLORS = ['#00e5ff','#a78bfa','#34d399','#fbbf24','#f87171','#38bdf8','#fb7185','#4ade80','#c084fc','#facc15'];

const CHART_THEME = {
  background: 'transparent',
  gridColor: '#1e293b',
  textColor: '#475569',
  tooltipBg: '#0d1526',
  tooltipBorder: '#1e293b',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: CHART_THEME.tooltipBg, border: `1px solid ${CHART_THEME.tooltipBorder}`, borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 12, color: p.color, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span>{p.name}</span>
          <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{Number(p.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

// ── App ──────────────────────────────────────────────────────────
export default function App() {
  const [rawData, setRawData] = useState(null);
  const [isDemo, setIsDemo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [selTenants, setSelTenants] = useState([]);
  const [selConnectors, setSelConnectors] = useState([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [emailSearch, setEmailSearch] = useState('');
  const [spikeZ, setSpikeZ] = useState(2.5);
  const [topN, setTopN] = useState(10);

  // Load demo on first render
  const demoData = useMemo(() => generateDemoData(), []);
  const baseData = rawData || demoData;

  // Date boundaries
  const { min: absMin, max: absMax } = useMemo(() => getDateRange(baseData), [baseData]);

  // Apply filters
  const filtered = useMemo(() => {
    let d = baseData;
    if (selTenants.length) d = d.filter(r => selTenants.includes(r['Tenant Name']));
    if (selConnectors.length) d = d.filter(r => selConnectors.includes(r['Connector Name']));
    const start = dateRange.start || absMin;
    const end = dateRange.end || absMax;
    if (start) d = d.filter(r => r.DateStr >= start);
    if (end) d = d.filter(r => r.DateStr <= end);
    if (emailSearch) d = d.filter(r => (r['Customer Email'] || '').toLowerCase().includes(emailSearch.toLowerCase()));
    return d;
  }, [baseData, selTenants, selConnectors, dateRange, emailSearch, absMin, absMax]);

  // All analytics derived from filtered data
  const metrics = useMemo(() => computeKPIs(filtered), [filtered]);
  const dailyTrend = useMemo(() => getDailyTrend(filtered), [filtered]);
  const monthlyTrend = useMemo(() => getMonthlyTrend(filtered), [filtered]);
  const topTenants = useMemo(() => getTopTenants(filtered, topN), [filtered, topN]);
  const topConnectors = useMemo(() => getTopConnectors(filtered, topN), [filtered, topN]);
  const connByTenant = useMemo(() => getConnectorByTenant(filtered), [filtered]);
  const heatmapData = useMemo(() => getHeatmapData(filtered), [filtered]);
  const dayOfWeek = useMemo(() => getDayOfWeekAvg(filtered), [filtered]);
  const spikes = useMemo(() => detectSpikes(filtered, spikeZ), [filtered, spikeZ]);
  const segments = useMemo(() => segmentTenants(filtered), [filtered]);
  const activeTenants = useMemo(() => getActiveTenants(filtered), [filtered]);
  const connTrend = useMemo(() => getConnectorTrend(filtered), [filtered]);
  const allTenants = useMemo(() => getUniqueTenants(baseData), [baseData]);
  const allConnectors = useMemo(() => getUniqueConnectors(baseData), [baseData]);
  const allConnectorNames = useMemo(() => [...new Set(filtered.map(r => r['Connector Name']))], [filtered]);
  const pieData = useMemo(() => getTopConnectors(filtered, 8), [filtered]);

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await parseExcelFile(file);
      setRawData(data);
      setIsDemo(false);
      setSelTenants([]);
      setSelConnectors([]);
      setDateRange({ start: '', end: '' });
      setEmailSearch('');
    } catch (err) {
      setError(`Failed to parse file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080d1a', fontFamily: "'Outfit', sans-serif", color: '#e2e8f0' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #080d1a; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
        input[type=range] { -webkit-appearance: none; height: 4px; border-radius: 2px; background: #1e293b; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; cursor: pointer; }
      `}</style>

      <Sidebar
        tenants={selTenants} connectors={selConnectors}
        dateRange={dateRange} allTenants={allTenants} allConnectors={allConnectors}
        onTenantChange={setSelTenants} onConnectorChange={setSelConnectors}
        onDateChange={setDateRange} onEmailChange={setEmailSearch}
        emailSearch={emailSearch} spikeZ={spikeZ} onSpikeZChange={setSpikeZ}
        topN={topN} onTopNChange={setTopN}
        onFileUpload={handleFileUpload} isDemo={isDemo}
      />

      {/* Main content */}
      <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto', minWidth: 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.03em', color: '#f1f5f9' }}>
              API Usage <span style={{ color: '#00e5ff' }}>Analytics</span>
            </h1>
            <div style={{ fontSize: 12, color: '#334155', marginTop: 4, fontFamily: 'JetBrains Mono' }}>
              {absMin} → {absMax} · {filtered.length.toLocaleString()} data points
            </div>
          </div>
          {loading && <div style={{ fontSize: 12, color: '#00e5ff', animation: 'fadeUp 0.3s ease' }}>⟳ Loading…</div>}
          {error && <div style={{ fontSize: 12, color: '#f87171', maxWidth: 300 }}>⚠ {error}</div>}
        </div>

        {/* KPI Cards */}
        <KPICards metrics={metrics} />

        {/* Trend Charts */}
        <SectionHeader label="Usage Trends" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 0 }}>
          <ChartCard title="Daily API Calls" subtitle="With 7-day rolling average">
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={dailyTrend}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00e5ff" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#00e5ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridColor} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: CHART_THEME.textColor }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: CHART_THEME.textColor }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="calls" name="Daily Calls" fill="url(#areaGrad)" stroke="#00e5ff" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="avg" name="7d Avg" stroke="#a78bfa" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Monthly API Usage" subtitle="Total calls per month">
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridColor} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: CHART_THEME.textColor }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: CHART_THEME.textColor }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="calls" name="Monthly Calls" fill="#a78bfa" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Line type="monotone" dataKey="calls" stroke="#00e5ff" strokeWidth={1.5} dot={{ fill: '#00e5ff', r: 3 }} name="Trend" />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Rankings */}
        <SectionHeader label="Rankings" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <ChartCard title={`Top ${topN} Tenants`} subtitle="By total API calls">
            <ResponsiveContainer width="100%" height={topN > 10 ? 360 : 280}>
              <BarChart data={topTenants} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridColor} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: CHART_THEME.textColor }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: CHART_THEME.textColor }} width={100} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="calls" name="API Calls" radius={[0, 4, 4, 0]} maxBarSize={16}>
                  {topTenants.map((_, i) => <Cell key={i} fill={`${COLORS[0]}${i === 0 ? 'ff' : i < 3 ? 'bb' : '77'}`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title={`Top ${topN} Connectors`} subtitle="By total API calls">
            <ResponsiveContainer width="100%" height={topN > 10 ? 360 : 280}>
              <BarChart data={topConnectors} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridColor} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: CHART_THEME.textColor }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: CHART_THEME.textColor }} width={110} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="calls" name="API Calls" radius={[0, 4, 4, 0]} maxBarSize={16}>
                  {topConnectors.map((_, i) => <Cell key={i} fill={`${COLORS[1]}${i === 0 ? 'ff' : i < 3 ? 'bb' : '77'}`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Connector Analysis */}
        <SectionHeader label="Connector Analysis" />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <ChartCard title="Connector Mix per Tenant" subtitle="Stacked API calls by connector">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={connByTenant}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridColor} />
                <XAxis dataKey="tenant" tick={{ fontSize: 9, fill: CHART_THEME.textColor }} angle={-25} textAnchor="end" height={50} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: CHART_THEME.textColor }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#475569' }} />
                {allConnectorNames.slice(0, 8).map((conn, i) => (
                  <Bar key={conn} dataKey={conn} stackId="a" fill={COLORS[i % COLORS.length]} maxBarSize={40} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="API Distribution" subtitle="Share by connector">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="calls" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#475569' }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Heatmap */}
        <SectionHeader label="Usage Heatmap" />
        <ChartCard title="API Calls Heatmap" subtitle="Tenant × Date — hover for details">
          <Heatmap data={heatmapData} />
        </ChartCard>

        {/* Advanced Analytics */}
        <SectionHeader label="Advanced Analytics" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <ChartCard title="Connector Performance" subtitle="Top 5 connectors over time">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={connTrend.data}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridColor} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: CHART_THEME.textColor }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: CHART_THEME.textColor }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#475569' }} />
                {connTrend.connectors.map((conn, i) => (
                  <Line key={conn} type="monotone" dataKey={conn} stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Peak Usage by Day" subtitle="Average API calls per weekday">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dayOfWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridColor} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: CHART_THEME.textColor }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: CHART_THEME.textColor }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="calls" name="Avg Calls" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  {dayOfWeek.map((entry, i) => (
                    <Cell key={i} fill={['Sat', 'Sun'].includes(entry.day) ? '#334155' : '#34d399'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Spikes & Segmentation */}
        <SectionHeader label="Anomaly Detection & Segmentation" />
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
          {/* Spikes */}
          <ChartCard title="⚡ API Call Spikes" subtitle={`Anomalies above ${spikeZ}σ threshold`}>
            {spikes.length === 0 ? (
              <div style={{ fontSize: 12, color: '#34d399', padding: '16px 0' }}>✅ No significant spikes detected</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {spikes.map((s, i) => (
                  <div key={i} style={{
                    background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
                    borderRadius: 8, padding: '6px 12px', fontSize: 11,
                  }}>
                    <div style={{ color: '#f87171', fontWeight: 600 }}>{s.tenant}</div>
                    <div style={{ color: '#64748b', fontSize: 10 }}>{s.connector} · {s.date}</div>
                    <div style={{ color: '#fbbf24', fontFamily: 'JetBrains Mono', fontSize: 11, marginTop: 2 }}>
                      {s.calls.toLocaleString()} calls (+{s.pct}%)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>

          {/* Segmentation */}
          <ChartCard title="Tenant Segmentation" subtitle="Low / Medium / High usage">
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {segments.map((s, i) => {
                const colors = { Low: '#34d399', Medium: '#fbbf24', High: '#f87171' };
                const c = colors[s.segment];
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', padding: '7px 0',
                    borderBottom: '1px solid #0f172a', gap: 10,
                  }}>
                    <div style={{ flex: 1, fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#475569', fontFamily: 'JetBrains Mono' }}>{s.calls.toLocaleString()}</div>
                    <div style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: `${c}15`, border: `1px solid ${c}44`, color: c,
                      textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
                    }}>{s.segment}</div>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </div>

        {/* Active Tenants Table */}
        <SectionHeader label="Active Tenants" />
        <ChartCard title="Tenant Summary" subtitle="All tenants with API activity">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e293b' }}>
                  {['Tenant', 'Total Calls', 'Connectors', 'Active Days', 'Avg/Day', 'Last Seen'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeTenants.map((t, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #0f172a', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#0d1526'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '9px 12px', color: '#e2e8f0', fontWeight: 500 }}>{t.name}</td>
                    <td style={{ padding: '9px 12px', color: '#00e5ff', fontFamily: 'JetBrains Mono' }}>{t.calls.toLocaleString()}</td>
                    <td style={{ padding: '9px 12px', color: '#94a3b8' }}>{t.connectors}</td>
                    <td style={{ padding: '9px 12px', color: '#94a3b8' }}>{t.days}</td>
                    <td style={{ padding: '9px 12px', color: '#a78bfa', fontFamily: 'JetBrains Mono' }}>{t.avgPerDay.toLocaleString()}</td>
                    <td style={{ padding: '9px 12px', color: '#475569', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{t.lastSeen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        {/* Footer */}
        <div style={{ textAlign: 'center', color: '#1e293b', fontSize: 10, fontFamily: 'JetBrains Mono', padding: '32px 0 8px', letterSpacing: '0.1em' }}>
          API USAGE ANALYTICS · REACT EDITION
        </div>
      </div>
    </div>
  );
}

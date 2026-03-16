// src/App.jsx
import React, { useState, useMemo, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
} from "recharts";

import Sidebar from "./components/Sidebar";
import KPICards from "./components/KPICards";
import ChartCard, { SectionHeader } from "./components/ChartCard";
import Heatmap from "./components/Heatmap";

import {
  parseExcelFile,
  computeKPIs,
  getDailyTrend,
  getMonthlyTrend,
  getTopTenants,
  getTopConnectors,
  getConnectorByTenant,
  getHeatmapData,
  getDayOfWeekAvg,
  detectSpikes,
  segmentTenants,
  getActiveTenants,
  getConnectorTrend,
  getUniqueTenants,
  getUniqueConnectors,
  getDateRange,
} from "./utils/dataProcessor";

import { generateDemoData } from "./utils/demoData";

const COLORS = [
  "#00e5ff",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#38bdf8",
];

const CHART_THEME = {
  gridColor: "#1e293b",
  textColor: "#475569",
  tooltipBg: "#0d1526",
  tooltipBorder: "#1e293b",
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: CHART_THEME.tooltipBg,
        border: `1px solid ${CHART_THEME.tooltipBorder}`,
        padding: 10,
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 12, color: p.color }}>
          {p.name}: {Number(p.value || 0).toLocaleString()}
        </div>
      ))}
    </div>
  );
};

export default function App() {
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const demoData = useMemo(() => generateDemoData(), []);
  const baseData = rawData || demoData;

  const { minDate: absMin, maxDate: absMax } = useMemo(
    () => getDateRange(baseData || []),
    [baseData]
  );

  const metrics = useMemo(() => computeKPIs(baseData || []), [baseData]);
  const dailyTrend = useMemo(() => getDailyTrend(baseData || []), [baseData]);
  const monthlyTrend = useMemo(
    () => getMonthlyTrend(baseData || []),
    [baseData]
  );

  const topTenants = useMemo(() => getTopTenants(baseData || []), [baseData]);
  const topConnectors = useMemo(
    () => getTopConnectors(baseData || []),
    [baseData]
  );

  const connByTenant = useMemo(
    () => getConnectorByTenant(baseData || []),
    [baseData]
  );

  const heatmapData = useMemo(() => getHeatmapData(baseData || []), [baseData]);

  const dayOfWeek = useMemo(
    () => getDayOfWeekAvg(baseData || []),
    [baseData]
  );

  const spikes = useMemo(() => detectSpikes(baseData || []), [baseData]);

  const segments = useMemo(() => segmentTenants(baseData || []), [baseData]);

  const activeTenants = useMemo(
    () => getActiveTenants(baseData || []),
    [baseData]
  );

  const connTrend = useMemo(
    () => getConnectorTrend(baseData || []),
    [baseData]
  );

  const pieData = useMemo(
    () => getTopConnectors(baseData || []).slice(0, 8),
    [baseData]
  );

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const result = await parseExcelFile(file);
      setRawData(result.data || result.records || []);
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  }, []);

  return (
    <div style={{ background: "#080d1a", minHeight: "100vh", color: "#e2e8f0" }}>
      <Sidebar onFileUpload={handleFileUpload} />

      <div style={{ padding: 24 }}>

        <h1 style={{ fontSize: 24 }}>
          API Usage Analytics
        </h1>

        <div style={{ fontSize: 12, marginBottom: 20 }}>
          {absMin} → {absMax} · {(baseData?.length || 0).toLocaleString()} rows
        </div>

        {loading && <div>Loading...</div>}
        {error && <div style={{ color: "red" }}>{error}</div>}

        <KPICards metrics={metrics} />

        <SectionHeader label="Daily Trend" />

        <ChartCard>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={dailyTrend || []}>
              <CartesianGrid stroke={CHART_THEME.gridColor} />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />

              <Area
                dataKey="calls"
                fill="#00e5ff33"
                stroke="#00e5ff"
              />

              <Line
                dataKey="avg"
                stroke="#a78bfa"
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <SectionHeader label="Monthly Trend" />

        <ChartCard>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyTrend || []}>
              <CartesianGrid stroke={CHART_THEME.gridColor} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />

              <Bar dataKey="calls" fill="#a78bfa" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <SectionHeader label="Top Connectors" />

        <ChartCard>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData || []}
                dataKey="calls"
                nameKey="name"
                innerRadius={60}
                outerRadius={100}
              >
                {(pieData || []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>

              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <SectionHeader label="Connector Trend" />

        <ChartCard>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart>
              <CartesianGrid stroke={CHART_THEME.gridColor} />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              {(connTrend || []).slice(0,5).map((c,i)=>(
                <Line
                  key={c.connector}
                  data={c.trend}
                  dataKey="calls"
                  name={c.connector}
                  stroke={COLORS[i % COLORS.length]}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <SectionHeader label="Heatmap" />

        <ChartCard>
          <Heatmap data={heatmapData || []} />
        </ChartCard>

      </div>
    </div>
  );
}

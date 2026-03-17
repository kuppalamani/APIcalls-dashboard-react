import React, { useState, useMemo } from "react";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

import Sidebar from "./components/Sidebar";
import KPICards from "./components/KPICards";
import ChartCard from "./components/ChartCard";
import Heatmap from "./components/Heatmap";

import {
  parseExcelFile,
  computeKPIs,
  getDailyTrend,
  getMonthlyTrend,
  getHeatmapData,
  getUniqueTenants,
  getUniqueConnectors,
  getHourlyTrend
} from "./utils/dataProcessor";

function App() {

  const [records, setRecords] = useState([]);

  const handleUpload = async (e) => {

    const file = e.target.files[0];
    if (!file) return;

    const result = await parseExcelFile(file);

    setRecords(result.data || []);

  };

  const metrics = useMemo(() => computeKPIs(records), [records]);

  const dailyTrend = useMemo(() => getDailyTrend(records), [records]);

  const monthlyTrend = useMemo(() => getMonthlyTrend(records), [records]);

  const hourlyTrend = useMemo(() => getHourlyTrend(records), [records]);

  const heatmap = useMemo(() => getHeatmapData(records), [records]);

  const tenants = useMemo(() => getUniqueTenants(records), [records]);

  const connectors = useMemo(() => getUniqueConnectors(records), [records]);

  return (

    <div style={{ display: "flex", minHeight: "100vh", background: "#0b1220" }}>

      <Sidebar
        allTenants={tenants}
        allConnectors={connectors}
        onFileUpload={handleUpload}
      />

      <div style={{ flex: 1, padding: "30px" }}>

        <h2 style={{ color: "#fff", marginBottom: 10 }}>
          API Usage Analytics
        </h2>

        <h4 style={{ color: "#94a3b8", marginBottom: 20 }}>
          LAST 24 HOUR API CALLS
        </h4>

        {/* 24 Hour Traffic */}

        <ChartCard title="24 Hour Traffic">

          <ResponsiveContainer width="100%" height={300}>

            <LineChart data={hourlyTrend}>

              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

              <XAxis dataKey="hour" stroke="#94a3b8" />

              <YAxis stroke="#94a3b8" />

              <Tooltip />

              <Line
                type="monotone"
                dataKey="calls"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={false}
              />

            </LineChart>

          </ResponsiveContainer>

        </ChartCard>

        {/* KPI Cards */}

        <KPICards metrics={metrics} />

        {/* Daily Trend */}

        <ChartCard title="Daily Calls">

          <ResponsiveContainer width="100%" height={300}>

            <LineChart data={dailyTrend}>

              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

              <XAxis dataKey="date" stroke="#94a3b8" />

              <YAxis stroke="#94a3b8" />

              <Tooltip />

              <Line
                type="monotone"
                dataKey="calls"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={true}
              />

            </LineChart>

          </ResponsiveContainer>

        </ChartCard>

        {/* Monthly Trend */}

        <ChartCard title="Monthly Calls">

          <ResponsiveContainer width="100%" height={300}>

            <BarChart data={monthlyTrend}>

              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

              <XAxis dataKey="month" stroke="#94a3b8" />

              <YAxis stroke="#94a3b8" />

              <Tooltip />

              <Bar dataKey="calls" fill="#a78bfa" />

            </BarChart>

          </ResponsiveContainer>

        </ChartCard>

        {/* Heatmap */}

        <ChartCard title="Usage Heatmap">

          <Heatmap data={heatmap} />

        </ChartCard>

      </div>

    </div>

  );

}

export default App;

import React, { useState, useMemo } from "react";

import Sidebar from "./components/Sidebar";
import KPICards from "./components/KPICards";
import ChartCard from "./components/ChartCard";
import Heatmap from "./components/Heatmap";

import {
  parseExcelFile,
  computeKPIs,
  getDailyTrend,
  getMonthlyTrend,
  getTopTenants,
  getTopConnectors,
  getHeatmapData,
  getLastDayCalls,
  getUniqueTenants,
  getUniqueConnectors,
} from "./utils/dataProcessor";

export default function App() {
  const [data, setData] = useState([]);

  const metrics = useMemo(() => computeKPIs(data), [data]);
  const lastDayCalls = useMemo(() => getLastDayCalls(data), [data]);

  const dailyTrend = useMemo(() => getDailyTrend(data), [data]);
  const monthlyTrend = useMemo(() => getMonthlyTrend(data), [data]);

  const tenants = useMemo(() => getUniqueTenants(data), [data]);
  const connectors = useMemo(() => getUniqueConnectors(data), [data]);

  const heatmap = useMemo(() => getHeatmapData(data), [data]);

  const handleUpload = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;

      const res = await parseExcelFile(file);
      setData(res.data || []);
    } catch (err) {
      alert("Upload failed: " + err.message);
    }
  };

  return (
    <div style={{ display: "flex" }}>
      <Sidebar
        onFileUpload={handleUpload}
        allTenants={tenants}
        allConnectors={connectors}
      />

      <div style={{ flex: 1, padding: 20 }}>
        <h2>Welcome to Aqure - Team SRE</h2>

        <ChartCard title="Last Day API Calls">
          <h1>{lastDayCalls.toLocaleString()}</h1>
        </ChartCard>

        <KPICards
          metrics={{
            ...metrics,
            lastDayCalls,
          }}
        />

        <ChartCard title="Daily Trend">
          <pre>{JSON.stringify(dailyTrend.slice(0, 5), null, 2)}</pre>
        </ChartCard>

        <ChartCard title="Monthly Trend">
          <pre>{JSON.stringify(monthlyTrend, null, 2)}</pre>
        </ChartCard>

        <ChartCard title="Heatmap">
          <Heatmap data={heatmap} />
        </ChartCard>
      </div>
    </div>
  );
}

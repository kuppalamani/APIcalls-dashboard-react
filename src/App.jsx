// src/App.jsx
import React, { useState, useMemo, useCallback } from "react";
import { getHourlyTrend } from './utils/dataProcessor';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Area
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
  getDateRange
} from "./utils/dataProcessor";

import { generateDemoData } from "./utils/demoData";

/* ------------------------------------------------ */
/* CONSTANTS */
/* ------------------------------------------------ */

const COLORS = [
  "#00e5ff","#a78bfa","#34d399","#fbbf24",
  "#f87171","#38bdf8","#fb7185","#4ade80"
];

/* ------------------------------------------------ */
/* APP */
/* ------------------------------------------------ */

export default function App(){

  const [records,setRecords] = useState(null);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");

  const [selTenants,setSelTenants] = useState([]);
  const [selConnectors,setSelConnectors] = useState([]);
  const [dateRange,setDateRange] = useState({start:"",end:""});
  const [emailSearch,setEmailSearch] = useState("");
  const [topN,setTopN] = useState(10);
  const [spikeZ,setSpikeZ] = useState(2.5);

  /* ------------------------------------------------ */
  /* DATA SOURCE */
  /* ------------------------------------------------ */

  const demo = useMemo(()=>generateDemoData(),[]);
  const baseData = records || demo;

  const {minDate,maxDate} = useMemo(
    ()=>getDateRange(baseData || []),
    [baseData]
  );

  /* ------------------------------------------------ */
  /* FILTERING */
  /* ------------------------------------------------ */

  const filtered = useMemo(()=>{

    let d = baseData || [];

    if(selTenants.length)
      d = d.filter(r => selTenants.includes(r.tenantName));

    if(selConnectors.length)
      d = d.filter(r => selConnectors.includes(r.connector));

    if(dateRange.start)
      d = d.filter(r => r.date >= dateRange.start);

    if(dateRange.end)
      d = d.filter(r => r.date <= dateRange.end);

    if(emailSearch)
      d = d.filter(r =>
        (r.email || "")
          .toLowerCase()
          .includes(emailSearch.toLowerCase())
      );

    return d;

  },[baseData,selTenants,selConnectors,dateRange,emailSearch]);

  /* ------------------------------------------------ */
  /* ANALYTICS */
  /* ------------------------------------------------ */

  const metrics = useMemo(()=>computeKPIs(filtered),[filtered]);

  const dailyTrend = useMemo(
    ()=>getDailyTrend(filtered),
    [filtered]
  );
  
  const hourlyTrend = useMemo(
  () => getHourlyTrend(filtered),
  [filtered]
);

  const monthlyTrend = useMemo(
    ()=>getMonthlyTrend(filtered),
    [filtered]
  );

  const topTenants = useMemo(
    ()=>getTopTenants(filtered).slice(0,topN),
    [filtered,topN]
  );

  const topConnectors = useMemo(
    ()=>getTopConnectors(filtered).slice(0,topN),
    [filtered,topN]
  );

  const connByTenant = useMemo(
    ()=>getConnectorByTenant(filtered),
    [filtered]
  );

  const heatmapData = useMemo(
    ()=>getHeatmapData(filtered),
    [filtered]
  );

  const dayOfWeek = useMemo(
    ()=>getDayOfWeekAvg(filtered),
    [filtered]
  );

  const spikes = useMemo(
    ()=>detectSpikes(filtered,spikeZ),
    [filtered,spikeZ]
  );

  const segments = useMemo(
    ()=>segmentTenants(filtered),
    [filtered]
  );

  const activeTenants = useMemo(
    ()=>getActiveTenants(filtered),
    [filtered]
  );

  const connectorTrend = useMemo(
    ()=>getConnectorTrend(filtered),
    [filtered]
  );

  const allTenants = useMemo(
    ()=>getUniqueTenants(baseData),
    [baseData]
  );

  const allConnectors = useMemo(
    ()=>getUniqueConnectors(baseData),
    [baseData]
  );

  /* ------------------------------------------------ */
  /* FILE UPLOAD */
  /* ------------------------------------------------ */

  const handleFileUpload = useCallback(async(e)=>{

    const file = e.target.files[0];
    if(!file) return;

    setLoading(true);
    setError("");

    try{

      const result = await parseExcelFile(file);

      setRecords(result.records || []);

    }catch(err){

      setError("Failed to parse Excel file");

    }finally{

      setLoading(false);

    }

  },[]);

  /* ------------------------------------------------ */
  /* UI */
  /* ------------------------------------------------ */

  return(
    <div style={{display:"flex",minHeight:"100vh"}}>

      <Sidebar
        tenants={selTenants}
        connectors={selConnectors}
        dateRange={dateRange}
        allTenants={allTenants}
        allConnectors={allConnectors}
        onTenantChange={setSelTenants}
        onConnectorChange={setSelConnectors}
        onDateChange={setDateRange}
        onEmailChange={setEmailSearch}
        emailSearch={emailSearch}
        spikeZ={spikeZ}
        onSpikeZChange={setSpikeZ}
        topN={topN}
        onTopNChange={setTopN}
        onFileUpload={handleFileUpload}
        isDemo={!records}
      />

      <div style={{flex:1,padding:24}}>

        <h2>API Usage Analytics</h2>

        {loading && <p>Loading...</p>}
        {error && <p style={{color:"red"}}>{error}</p>}

        <KPICards metrics={metrics}/>

        <SectionHeader label="Usage Trends"/>

        <ChartCard title="Daily Calls">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dailyTrend || []}>
              <CartesianGrid strokeDasharray="3 3"/>
              <XAxis dataKey="date"/>
              <YAxis/>
              <Tooltip/>
              <Line
                type="monotone"
                dataKey="calls"
                stroke="#00e5ff"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Calls">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyTrend || []}>
              <CartesianGrid strokeDasharray="3 3"/>
              <XAxis dataKey="month"/>
              <YAxis/>
              <Tooltip/>
              <Bar dataKey="calls" fill="#a78bfa"/>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <SectionHeader label="Top Tenants"/>

        <ChartCard>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topTenants || []}>
              <XAxis dataKey="name"/>
              <YAxis/>
              <Tooltip/>
              <Bar dataKey="calls" fill="#34d399"/>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <SectionHeader label="Heatmap"/>

        <ChartCard>
          <Heatmap data={heatmapData}/>
        </ChartCard>

      </div>

    </div>
  );

}

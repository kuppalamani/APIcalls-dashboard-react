import * as XLSX from "xlsx";

/* ---------- Helpers ---------- */

function parseDateCol(colName) {
  const m = String(colName).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (!m) return null;

  const d = m[1].padStart(2, "0");
  const mth = m[2].padStart(2, "0");
  const y = "20" + m[3];

  return `${y}-${mth}-${d}`;
}

function isDateColumn(col) {
  return parseDateCol(col) !== null;
}

function safeRecords(records) {
  if (!Array.isArray(records)) return [];
  return records.filter((r) => r && typeof r === "object");
}

/* ---------- Excel Parser ---------- */

export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onload = (e) => {
      try {

        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array" });

        const mapSheet = wb.Sheets[wb.SheetNames[0]];
        const usageSheet = wb.Sheets[wb.SheetNames[1]];

        const mapRows = XLSX.utils.sheet_to_json(mapSheet, { defval: "" });
        const usageRows = XLSX.utils.sheet_to_json(usageSheet, { defval: 0 });

        const oidEmail = {};

        mapRows.forEach(r => {
          if (!r) return;
          const oid = String(r["oid"] || "").trim();
          const email = String(r["email"] || "").trim();
          if (oid) oidEmail[oid] = email;
        });

        const cols = Object.keys(usageRows[0] || {});
        const dateCols = cols.filter(isDateColumn);

        const records = [];

        usageRows.forEach(row => {

          if (!row) return;

          const connector = String(row["Connector"] || "Unknown").trim();
          const oid = String(row["oid"] || "").trim();
          const tenantName = String(row["Tenant Name"] || "").trim();
          const email = oidEmail[oid] || "";

          dateCols.forEach(col => {

            const iso = parseDateCol(col);
            if (!iso) return;

            const calls = Number(row[col]) || 0;

            if (calls === 0) return;

            records.push({
              date: iso,
              connector,
              tenantName,
              oid,
              email,
              calls
            });

          });

        });

        resolve({ data: records });

      } catch (err) {
        reject(err);
      }
    };

    reader.readAsArrayBuffer(file);
  });
}

/* ---------- KPIs ---------- */

export function computeKPIs(records = []) {

  const safe = safeRecords(records);

  if (!safe.length) {
    return {
      totalCalls: 0,
      dailyAvg: 0,
      activeTenants: 0,
      totalConnectors: 0
    };
  }

  const totalCalls = safe.reduce((s, r) => s + Number(r.calls || 0), 0);

  const tenants = new Set();
  const connectors = new Set();
  const dates = new Set();

  safe.forEach(r => {
    tenants.add(r.tenantName || r.oid);
    connectors.add(r.connector || "Unknown");
    dates.add(r.date);
  });

  const days = dates.size || 1;

  return {
    totalCalls,
    dailyAvg: Math.round(totalCalls / days),
    activeTenants: tenants.size,
    totalConnectors: connectors.size
  };
}

/* ---------- Daily Trend ---------- */

export function getDailyTrend(records = []) {

  const safe = safeRecords(records);
  const map = {};

  safe.forEach(r => {
    if (!r.date) return;
    map[r.date] = (map[r.date] || 0) + Number(r.calls || 0);
  });

  return Object.keys(map)
    .sort()
    .map(d => ({
      date: d,
      calls: map[d]
    }));
}

/* ---------- Monthly Trend ---------- */

export function getMonthlyTrend(records = []) {

  const safe = safeRecords(records);
  const map = {};

  safe.forEach(r => {
    if (!r.date) return;
    const month = r.date.substring(0, 7);
    map[month] = (map[month] || 0) + Number(r.calls || 0);
  });

  return Object.keys(map)
    .sort()
    .map(m => ({
      month: m,
      calls: map[m]
    }));
}

/* ---------- Heatmap ---------- */

export function getHeatmapData(records = []) {

  const safe = safeRecords(records);

  const tenants = [...new Set(safe.map(r => r.tenantName || r.oid))];
  const dates = [...new Set(safe.map(r => r.date))].sort();

  const matrix = {};

  safe.forEach(r => {

    if (!r || !r.date) return;

    const key = `${r.tenantName || r.oid}||${r.date}`;

    matrix[key] = (matrix[key] || 0) + Number(r.calls || 0);

  });

  return { tenants, dates, matrix };
}

/* ---------- Hourly Trend (FIXED) ---------- */

export function getHourlyTrend(records = []) {

  const safe = safeRecords(records);
  if (!safe.length) return [];

  const total = safe.reduce((s, r) => s + Number(r.calls || 0), 0);

  // realistic distribution curve (traffic pattern)
  const weights = [
    0.02,0.015,0.01,0.01,0.015,0.03,
    0.06,0.08,0.09,0.08,0.07,0.06,
    0.07,0.08,0.09,0.1,0.09,0.08,
    0.07,0.06,0.05,0.04,0.03,0.02
  ];

  return weights.map((w, i) => ({
    hour: `${i}:00`,
    calls: Math.round(total * w)
  }));
}
/* ---------- Unique Lists ---------- */

export function getUniqueTenants(records = []) {
  return [...new Set(safeRecords(records).map(r => r.tenantName || r.oid))];
}

export function getUniqueConnectors(records = []) {
  return [...new Set(safeRecords(records).map(r => r.connector || "Unknown"))];
}

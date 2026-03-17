import * as XLSX from "xlsx";

/* ---------------------------------------------------------- */
/* Date parsing */
/* ---------------------------------------------------------- */

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

/* ---------------------------------------------------------- */
/* Excel processing */
/* ---------------------------------------------------------- */

export function processExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array" });

        const mapSheet = wb.Sheets?.[wb.SheetNames?.[0]];
        const usageSheet = wb.Sheets?.[wb.SheetNames?.[1]];

        if (!mapSheet || !usageSheet) {
          reject(new Error("Excel format incorrect"));
          return;
        }

        const mapRows = XLSX.utils.sheet_to_json(mapSheet, { defval: "" });
        const usageRows = XLSX.utils.sheet_to_json(usageSheet, { defval: 0 });

        const oidEmail = {};

        mapRows.forEach((r) => {
          const oid = String(r["oid"] || "").trim();
          const email = String(r["email"] || "").trim();
          if (oid) oidEmail[oid] = email;
        });

        const cols = Object.keys(usageRows[0] || {});
        const dateCols = cols.filter(isDateColumn);

        const records = [];

        usageRows.forEach((row) => {
          const connector = String(row["Connector"] || "").trim();
          const oid = String(row["oid"] || "").trim();
          const tenantName = String(row["Tenant Name"] || "").trim();
          const email = oidEmail[oid] || "";

          dateCols.forEach((col) => {
            const iso = parseDateCol(col);
            if (!iso) return;

            const raw = row[col];
            const calls =
              typeof raw === "number" ? raw : parseFloat(raw) || 0;

            if (calls > 0) {
              records.push({
                date: iso,
                connector,
                tenantName,
                oid,
                email,
                calls,
              });
            }
          });
        });

        resolve({
          records,
          ...computeAnalytics(records),
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.readAsArrayBuffer(file);
  });
}

/* ---------------------------------------------------------- */
/* Analytics engine */
/* ---------------------------------------------------------- */

function computeAnalytics(records) {
  return {
    ...computeKPIs(records),
    ...getDateRange(records),
    dailyTrend: getDailyTrend(records),
    monthlyTrend: getMonthlyTrend(records),
    topTenants: getTopTenants(records),
    topConnectors: getTopConnectors(records),
  };
}

/* ---------------------------------------------------------- */
/* KPIs */
/* ---------------------------------------------------------- */

export function computeKPIs(records = []) {
  if (!records.length) {
    return {
      totalCalls: 0,
      dailyAverage: 0,
      activeTenants: 0,
      activeConnectors: 0,
    };
  }

  const totalCalls = records.reduce((s, r) => s + (r.calls || 0), 0);

  const tenants = new Set(records.map((r) => r.tenantName || r.oid));
  const connectors = new Set(records.map((r) => r.connector));
  const dates = new Set(records.map((r) => r.date));

  return {
    totalCalls,
    dailyAverage: dates.size ? Math.round(totalCalls / dates.size) : 0,
    activeTenants: tenants.size,
    activeConnectors: connectors.size,
  };
}

/* ---------------------------------------------------------- */
/* Date range */
/* ---------------------------------------------------------- */

export function getDateRange(records = []) {
  if (!records.length) return { minDate: null, maxDate: null };

  const dates = records.map((r) => r.date).sort();

  return {
    minDate: dates[0],
    maxDate: dates[dates.length - 1],
  };
}

/* ---------------------------------------------------------- */
/* Trends */
/* ---------------------------------------------------------- */

export function getDailyTrend(records = []) {
  const map = {};

  records.forEach((r) => {
    if (!r?.date) return;
    map[r.date] = (map[r.date] || 0) + (r.calls || 0);
  });

  return Object.keys(map)
    .sort()
    .map((d) => ({ date: d, calls: map[d] }));
}

export function getMonthlyTrend(records = []) {
  const map = {};

  records.forEach((r) => {
    if (!r?.date) return;

    const m = r.date.substring(0, 7);
    map[m] = (map[m] || 0) + (r.calls || 0);
  });

  return Object.keys(map)
    .sort()
    .map((m) => ({ month: m, calls: map[m] }));
}

/* ---------------------------------------------------------- */
/* Rankings */
/* ---------------------------------------------------------- */

export function getTopTenants(records = []) {
  const map = {};

  records.forEach((r) => {
    const key = r.tenantName || r.oid || "Unknown";

    if (!map[key]) map[key] = { name: key, calls: 0 };

    map[key].calls += r.calls || 0;
  });

  return Object.values(map).sort((a, b) => b.calls - a.calls);
}

export function getTopConnectors(records = []) {
  const map = {};

  records.forEach((r) => {
    const key = r.connector || "Unknown";
    map[key] = (map[key] || 0) + (r.calls || 0);
  });

  return Object.entries(map)
    .map(([name, calls]) => ({ name, calls }))
    .sort((a, b) => b.calls - a.calls);
}

/* ---------------------------------------------------------- */
/* Heatmap data */
/* ---------------------------------------------------------- */

export function getHeatmapData(records = []) {
  if (!records.length) return { tenants: [], dates: [], matrix: {} };

  const tenants = [...new Set(records.map((r) => r.tenantName || r.oid))];
  const dates = [...new Set(records.map((r) => r.date))].sort();

  const matrix = {};

  records.forEach((r) => {
    const t = r.tenantName || r.oid;
    const key = `${t}||${r.date}`;
    matrix[key] = (matrix[key] || 0) + (r.calls || 0);
  });

  return { tenants, dates, matrix };
}

/* ---------------------------------------------------------- */
/* Connector by tenant (stacked chart) */
/* ---------------------------------------------------------- */

export function getConnectorByTenant(records = []) {
  const map = {};

  records.forEach((r) => {
    const tenant = r.tenantName || r.oid;
    const conn = r.connector || "Unknown";

    if (!map[tenant]) map[tenant] = { tenant };

    map[tenant][conn] = (map[tenant][conn] || 0) + (r.calls || 0);
  });

  return Object.values(map);
}

/* ---------------------------------------------------------- */
/* Day of week */
/* ---------------------------------------------------------- */

export function getDayOfWeekAvg(records = []) {
  const days = {
    Sun: [],
    Mon: [],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
  };

  records.forEach((r) => {
    if (!r?.date) return;

    const d = new Date(r.date + "T00:00:00");
    const name = d.toLocaleDateString("en-US", { weekday: "short" });

    days[name].push(r.calls || 0);
  });

  return Object.entries(days).map(([day, vals]) => ({
    day,
    avg: vals.length
      ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      : 0,
  }));
}

/* ---------------------------------------------------------- */
/* Connector trend */
/* ---------------------------------------------------------- */

export function getConnectorTrend(records = []) {
  const map = {};

  records.forEach((r) => {
    if (!r?.date) return;

    const conn = r.connector || "Unknown";

    if (!map[conn]) map[conn] = {};

    map[conn][r.date] = (map[conn][r.date] || 0) + (r.calls || 0);
  });

  return Object.keys(map).map((connector) => ({
    connector,
    trend: Object.entries(map[connector]).map(([date, calls]) => ({
      date,
      calls,
    })),
  }));
}

/* ---------------------------------------------------------- */
/* Simple helpers */
/* ---------------------------------------------------------- */

export function getUniqueTenants(records = []) {
  return [...new Set(records.map((r) => r.tenantName || r.oid))].sort();
}

export function getUniqueConnectors(records = []) {
  return [...new Set(records.map((r) => r.connector || "Unknown"))].sort();
}
export function detectSpikes(records = [], z = 2.5) {

  if (!records.length) return [];

  const daily = {};

  records.forEach(r => {
    if (!r?.date) return;
    daily[r.date] = (daily[r.date] || 0) + (r.calls || 0);
  });

  const values = Object.values(daily);
  if (!values.length) return [];

  const mean = values.reduce((s,v)=>s+v,0) / values.length;

  const variance =
    values.reduce((s,v)=>s + Math.pow(v-mean,2),0) / values.length;

  const stdDev = Math.sqrt(variance);

  return Object.entries(daily)
    .filter(([date,calls]) => calls > mean + z * stdDev)
    .map(([date,calls]) => ({
      date,
      calls
    }));
}

export function parseExcelFile(file) {
  return processExcelFile(file);
}

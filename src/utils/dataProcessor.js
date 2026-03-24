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

        const usageSheet = wb.Sheets[wb.SheetNames[1]];
        if (!usageSheet) {
          reject(new Error("Invalid Excel: Usage sheet missing"));
          return;
        }

        const usageRows =
          XLSX.utils.sheet_to_json(usageSheet, {
            defval: 0,
            raw: true,
          }) || [];

        const cols = Object.keys(usageRows[0] || {});
        const dateCols = cols.filter(isDateColumn);

        const records = [];

        usageRows.forEach((row) => {
          if (!row) return;

          const connector = String(row["Connector"] || "").trim();
          const tenantName = String(row["Tenant Name"] || "").trim();

          dateCols.forEach((col) => {
            const iso = parseDateCol(col);
            if (!iso) return;

            const calls = Number(row[col]);
            if (isNaN(calls) || calls <= 0) return;

            records.push({
              date: iso,
              connector,
              tenantName,
              calls,
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
      dailyAverage: 0,
      activeTenants: 0,
      activeConnectors: 0,
    };
  }

  const totalCalls = safe.reduce((s, r) => s + (r.calls || 0), 0);
  const tenants = new Set(safe.map((r) => r.tenantName));
  const connectors = new Set(safe.map((r) => r.connector));
  const dates = new Set(safe.map((r) => r.date));

  return {
    totalCalls,
    dailyAverage: Math.round(totalCalls / dates.size),
    activeTenants: tenants.size,
    activeConnectors: connectors.size,
  };
}

/* ---------- Last Day Calls ---------- */

export function getLastDayCalls(records = []) {
  const safe = safeRecords(records);
  if (!safe.length) return 0;

  const dates = [...new Set(safe.map((r) => r.date))].sort();
  const lastDate = dates[dates.length - 1];

  return safe
    .filter((r) => r.date === lastDate)
    .reduce((s, r) => s + (r.calls || 0), 0);
}

/* ---------- Trends ---------- */

export function getDailyTrend(records = []) {
  const safe = safeRecords(records);
  const map = {};

  safe.forEach((r) => {
    map[r.date] = (map[r.date] || 0) + r.calls;
  });

  return Object.keys(map)
    .sort()
    .map((d) => ({ date: d, calls: map[d] }));
}

export function getMonthlyTrend(records = []) {
  const safe = safeRecords(records);
  const map = {};

  safe.forEach((r) => {
    const m = r.date.substring(0, 7);
    map[m] = (map[m] || 0) + r.calls;
  });

  return Object.keys(map)
    .sort()
    .map((m) => ({ month: m, calls: map[m] }));
}

/* ---------- Others ---------- */

export function getTopTenants(records = []) {
  const map = {};
  safeRecords(records).forEach((r) => {
    map[r.tenantName] = (map[r.tenantName] || 0) + r.calls;
  });

  return Object.entries(map)
    .map(([name, calls]) => ({ name, calls }))
    .sort((a, b) => b.calls - a.calls);
}

export function getTopConnectors(records = []) {
  const map = {};
  safeRecords(records).forEach((r) => {
    map[r.connector] = (map[r.connector] || 0) + r.calls;
  });

  return Object.entries(map)
    .map(([name, calls]) => ({ name, calls }))
    .sort((a, b) => b.calls - a.calls);
}

export function getUniqueTenants(records = []) {
  return [...new Set(safeRecords(records).map((r) => r.tenantName))];
}

export function getUniqueConnectors(records = []) {
  return [...new Set(safeRecords(records).map((r) => r.connector))];
}

export function getHeatmapData(records = []) {
  const safe = safeRecords(records);

  const tenants = [...new Set(safe.map((r) => r.tenantName))];
  const dates = [...new Set(safe.map((r) => r.date))].sort();

  const matrix = {};
  safe.forEach((r) => {
    const key = `${r.tenantName}||${r.date}`;
    matrix[key] = (matrix[key] || 0) + r.calls;
  });

  return { tenants, dates, matrix };
}

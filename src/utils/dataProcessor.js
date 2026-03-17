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

        mapRows.forEach((r) => {
          if (!r) return;

          const oid = String(r["oid"] || "").trim();
          const email = String(r["email"] || "").trim();

          if (oid) oidEmail[oid] = email;
        });

        const cols = Object.keys(usageRows[0] || {});
        const dateCols = cols.filter(isDateColumn);

        const records = [];

        usageRows.forEach((row) => {

          if (!row) return;

          const connector = String(row["Connector"] || "").trim();
          const oid = String(row["oid"] || "").trim();
          const tenantName = String(row["Tenant Name"] || "").trim();
          const email = oidEmail[oid] || "";

          dateCols.forEach((col) => {

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

  const tenants = new Set(safe.map((r) => r.tenantName || r.oid));
  const connectors = new Set(safe.map((r) => r.connector));
  const dates = new Set(safe.map((r) => r.date));

  return {
    totalCalls,
    dailyAvg: dates.size ? Math.round(totalCalls / dates.size) : 0,
    activeTenants: tenants.size,
    totalConnectors: connectors.size
  };

}

/* ---------- Date Range ---------- */

export function getDateRange(records = []) {

  const safe = safeRecords(records);

  if (!safe.length) return { min: null, max: null };

  const dates = safe.map((r) => r.date).sort();

  return {
    min: dates[0] || null,
    max: dates[dates.length - 1] || null
  };

}

/* ---------- Daily Trend ---------- */

export function getDailyTrend(records = []) {

  const safe = safeRecords(records);

  const map = {};

  safe.forEach((r) => {

    if (!r.date) return;

    map[r.date] = (map[r.date] || 0) + Number(r.calls || 0);

  });

  return Object.keys(map)
    .sort()
    .map((d) => ({
      date: d,
      calls: map[d]
    }));

}

/* ---------- Monthly Trend ---------- */

export function getMonthlyTrend(records = []) {

  const safe = safeRecords(records);

  const map = {};

  safe.forEach((r) => {

    if (!r.date) return;

    const month = r.date.substring(0, 7);

    map[month] = (map[month] || 0) + Number(r.calls || 0);

  });

  return Object.keys(map)
    .sort()
    .map((m) => ({
      month: m,
      calls: map[m]
    }));

}

/* ---------- Top Tenants ---------- */

export function getTopTenants(records = []) {

  const safe = safeRecords(records);

  const map = {};

  safe.forEach((r) => {

    const key = r.tenantName || r.oid || "Unknown";

    if (!map[key]) map[key] = { name: key, calls: 0 };

    map[key].calls += Number(r.calls || 0);

  });

  return Object.values(map).sort((a, b) => b.calls - a.calls);

}

/* ---------- Top Connectors ---------- */

export function getTopConnectors(records = []) {

  const safe = safeRecords(records);

  const map = {};

  safe.forEach((r) => {

    const key = r.connector || "Unknown";

    map[key] = (map[key] || 0) + Number(r.calls || 0);

  });

  return Object.entries(map)
    .map(([name, calls]) => ({ name, calls }))
    .sort((a, b) => b.calls - a.calls);

}

/* ---------- Connector Trend ---------- */

export function getConnectorTrend(records = []) {

  const safe = safeRecords(records);

  const connectors = [...new Set(safe.map((r) => r.connector))];
  const dates = [...new Set(safe.map((r) => r.date))].sort();

  const data = dates.map((d) => {

    const row = { date: d };

    connectors.forEach((c) => {

      row[c] = safe
        .filter((r) => r.connector === c && r.date === d)
        .reduce((s, r) => s + Number(r.calls || 0), 0);

    });

    return row;

  });

  return { data, connectors };

}

/* ---------- Unique Lists ---------- */

export function getUniqueTenants(records = []) {

  const safe = safeRecords(records);

  return [...new Set(safe.map((r) => r.tenantName || r.oid))];

}

export function getUniqueConnectors(records = []) {

  const safe = safeRecords(records);

  return [...new Set(safe.map((r) => r.connector))];

}

/* ---------- Hourly Trend ---------- */

export function getHourlyTrend(records = []) {

  const safe = safeRecords(records);

  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    calls: 0
  }));

  safe.forEach((r) => {

    const d = new Date(r.date + "T00:00:00");

    if (isNaN(d)) return;

    const h = d.getHours();

    hours[h].calls += Number(r.calls || 0);

  });

  return hours;

}

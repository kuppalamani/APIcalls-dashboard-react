import * as XLSX from "xlsx";

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

export function processExcelFile(file) {
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
            const calls = Number(raw) || 0;

            records.push({
              date: iso,
              connector,
              tenantName,
              oid,
              email,
              calls,
            });
          });
        });

        resolve(computeAnalytics(records));
      } catch (err) {
        reject(err);
      }
    };

    reader.readAsArrayBuffer(file);
  });
}

function computeAnalytics(records) {
  return {
    ...computeKPIs(records),
    ...getDateRange(records),
    dailyTrend: getDailyTrend(records),
    monthlyTrend: getMonthlyTrend(records),
    topTenants: getTopTenants(records),
    topConnectors: getTopConnectors(records),
    records,
  };
}

export function computeKPIs(records) {
  if (!records || !records.length) {
    return {
      totalCalls: 0,
      dailyAvg: 0,
      activeTenants: 0,
      totalConnectors: 0,
    };
  }

  const totalCalls = records.reduce((s, r) => s + (r.calls || 0), 0);
  const tenants = new Set(records.map((r) => r.tenantName || r.oid));
  const connectors = new Set(records.map((r) => r.connector));
  const dates = new Set(records.map((r) => r.date));

  return {
    totalCalls,
    dailyAvg: Math.round(totalCalls / dates.size),
    activeTenants: tenants.size,
    totalConnectors: connectors.size,
  };
}

export function getDateRange(records) {
  if (!records || !records.length) return { min: null, max: null };

  const dates = records.map((r) => r.date).sort();

  return {
    min: dates[0],
    max: dates[dates.length - 1],
  };
}

export function getDailyTrend(records) {
  const map = {};

  records.forEach((r) => {
    map[r.date] = (map[r.date] || 0) + (r.calls || 0);
  });

  return Object.keys(map)
    .sort()
    .map((d) => ({ date: d, calls: map[d] }));
}

export function getMonthlyTrend(records) {
  const map = {};

  records.forEach((r) => {
    const m = r.date.substring(0, 7);
    map[m] = (map[m] || 0) + (r.calls || 0);
  });

  return Object.keys(map)
    .sort()
    .map((m) => ({ month: m, calls: map[m] }));
}

export function getTopTenants(records) {
  const map = {};

  records.forEach((r) => {
    const key = r.tenantName || r.oid || "Unknown";

    if (!map[key]) map[key] = { name: key, calls: 0, email: r.email };

    map[key].calls += r.calls || 0;
  });

  return Object.values(map).sort((a, b) => b.calls - a.calls);
}

export function getTopConnectors(records) {
  const map = {};

  records.forEach((r) => {
    const key = r.connector || "Unknown";
    map[key] = (map[key] || 0) + (r.calls || 0);
  });

  return Object.entries(map)
    .map(([name, calls]) => ({ name, calls }))
    .sort((a, b) => b.calls - a.calls);
}

export function getConnectorByTenant(records) {
  const map = {};

  records.forEach((r) => {
    const tenant = r.tenantName || r.oid || "Unknown";
    const connector = r.connector || "Unknown";

    if (!map[tenant]) map[tenant] = {};

    map[tenant][connector] =
      (map[tenant][connector] || 0) + (r.calls || 0);
  });

  return Object.keys(map).map((tenant) => ({
    tenant,
    connectors: Object.entries(map[tenant]).map(([name, calls]) => ({
      name,
      calls,
    })),
  }));
}

export function getHeatmapData(records) {
  const tenants = [...new Set(records.map((r) => r.tenantName || r.oid))];
  const dates = [...new Set(records.map((r) => r.date))].sort();
  const matrix = {};

  records.forEach((r) => {
    const key = `${r.tenantName}||${r.date}`;
    matrix[key] = (matrix[key] || 0) + (r.calls || 0);
  });

  return { tenants, dates, matrix };
}

export function getDayOfWeekAvg(records) {
  const days = [
    { day: "Sun", calls: 0 },
    { day: "Mon", calls: 0 },
    { day: "Tue", calls: 0 },
    { day: "Wed", calls: 0 },
    { day: "Thu", calls: 0 },
    { day: "Fri", calls: 0 },
    { day: "Sat", calls: 0 },
  ];

  records.forEach((r) => {
    const d = new Date(r.date + "T00:00:00");
    const day = d.getDay();
    days[day].calls += r.calls || 0;
  });

  return days;
}

export function detectSpikes(records) {
  return [];
}

export function segmentTenants(records) {
  return getTopTenants(records);
}

export function getActiveTenants(records) {
  return getTopTenants(records);
}

export function getConnectorTrend(records) {
  const connectors = [...new Set(records.map((r) => r.connector))];
  const dates = [...new Set(records.map((r) => r.date))].sort();

  const data = dates.map((d) => {
    const row = { date: d };

    connectors.forEach((c) => {
      row[c] = records
        .filter((r) => r.connector === c && r.date === d)
        .reduce((s, r) => s + r.calls, 0);
    });

    return row;
  });

  return { data, connectors };
}

export function getUniqueTenants(records) {
  return [...new Set(records.map((r) => r.tenantName || r.oid))];
}

export function getUniqueConnectors(records) {
  return [...new Set(records.map((r) => r.connector))];
}

export function getHourlyTrend(records) {
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    calls: 0,
  }));

  records.forEach((r) => {
    const d = new Date(r.date + "T00:00:00");
    const h = d.getHours();
    hours[h].calls += r.calls || 0;
  });

  return hours;
}

export function parseExcelFile(file) {
  return processExcelFile(file);
}

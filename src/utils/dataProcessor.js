// src/utils/dataProcessor.js
// Core data transformation: wide Excel → long time-series + analytics

import * as XLSX from 'xlsx';

// ── Helpers ──────────────────────────────────────────────────────
const isDateString = (str) => {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  // Match patterns like 2024-01-01, 01/01/2024, Jan 2024, etc.
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ||
    /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s) ||
    /^\d{4}\/\d{2}\/\d{2}$/.test(s) ||
    /^[A-Za-z]{3,9}\s+\d{4}$/.test(s);
};

const isExcelDateNumber = (val, colName) => {
  if (typeof val !== 'number') return false;
  if (typeof colName === 'number' && colName > 40000 && colName < 55000) return true;
  return false;
};

const excelNumToDate = (n) => {
  const date = XLSX.SSF.parse_date_code(n);
  if (!date) return null;
  return `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`;
};

const parseDate = (val) => {
  if (!val) return null;
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  } catch (_) {}
  return null;
};

const normalizeColName = (col) => {
  const s = String(col).toLowerCase().replace(/[\s_-]+/g, ' ').trim();
  if (s.includes('tenant')) return 'Tenant Name';
  if (s.includes('connector')) return 'Connector Name';
  if (s.includes('oid')) return 'OID';
  if (s.includes('email')) return 'Customer Email';
  return col;
};

// ── Main Parser ──────────────────────────────────────────────────
export const parseExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });

        const sheetNames = workbook.SheetNames;
        if (sheetNames.length === 0) throw new Error('No sheets found in workbook');

        // Sheet 1: API Usage (wide format)
        const usageSheet = workbook.Sheets[sheetNames[0]];
        const usageRaw = XLSX.utils.sheet_to_json(usageSheet, { header: 1, defval: '' });

        // Sheet 2: Tenant Mapping
        let mappingData = [];
        if (sheetNames.length > 1) {
          const mappingSheet = workbook.Sheets[sheetNames[1]];
          const mappingRaw = XLSX.utils.sheet_to_json(mappingSheet, { defval: '' });
          mappingData = mappingRaw.map(row => {
            const normalized = {};
            Object.keys(row).forEach(k => {
              normalized[normalizeColName(k)] = row[k];
            });
            return normalized;
          });
        }

        if (usageRaw.length < 2) throw new Error('Usage sheet has no data rows');

        // Parse header row
        const headers = usageRaw[0].map((h, i) => {
          const s = String(h).trim();
          if (!s) return `col_${i}`;
          // Handle Excel serial date numbers in headers
          if (typeof h === 'number' && h > 40000 && h < 55000) {
            return excelNumToDate(h) || s;
          }
          return s;
        });

        // Identify fixed vs date columns
        const fixedIndices = [];
        const dateIndices = [];
        headers.forEach((h, i) => {
          const norm = normalizeColName(h);
          if (['Tenant Name', 'Connector Name', 'OID'].includes(norm)) {
            fixedIndices.push({ idx: i, name: norm });
          } else if (isDateString(h) || isExcelDateNumber(usageRaw[0][i], h)) {
            dateIndices.push({ idx: i, name: h });
          }
        });

        // Fallback: first 3 columns are fixed, rest are dates
        if (fixedIndices.length === 0) {
          headers.slice(0, 3).forEach((h, i) => fixedIndices.push({ idx: i, name: normalizeColName(h) }));
          headers.slice(3).forEach((h, i) => {
            if (h && !h.startsWith('col_')) dateIndices.push({ idx: i + 3, name: h });
          });
        }

        // Build long-format records
        const longData = [];
        for (let r = 1; r < usageRaw.length; r++) {
          const row = usageRaw[r];
          if (row.every(v => v === '' || v === null || v === undefined)) continue;

          const fixed = {};
          fixedIndices.forEach(({ idx, name }) => {
            fixed[name] = String(row[idx] || '').trim() || 'Unknown';
          });
          // Ensure all 3 fixed cols exist
          if (!fixed['Tenant Name']) fixed['Tenant Name'] = 'Unknown';
          if (!fixed['Connector Name']) fixed['Connector Name'] = 'Unknown';
          if (!fixed['OID']) fixed['OID'] = `OID_${r}`;

          dateIndices.forEach(({ idx, name }) => {
            const rawVal = row[idx];
            const calls = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal) || 0;
            const dateObj = parseDate(name);
            if (!dateObj) return;

            longData.push({
              'Tenant Name': fixed['Tenant Name'],
              'Connector Name': fixed['Connector Name'],
              'OID': fixed['OID'],
              Date: dateObj,
              DateStr: dateObj.toISOString().split('T')[0],
              Month: `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`,
              DayOfWeek: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
              'API Calls': Math.max(0, Math.round(calls)),
            });
          });
        }

        // Join with mapping
        const mappingByOID = {};
        mappingData.forEach(row => {
          if (row['OID']) mappingByOID[String(row['OID']).trim()] = row;
        });

        longData.forEach(row => {
          const mapped = mappingByOID[row['OID']];
          if (mapped) {
            row['Customer Email'] = mapped['Customer Email'] || 'N/A';
          } else {
            row['Customer Email'] = 'N/A';
          }
        });

        resolve({ data: longData, sheetNames });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

// ── Analytics ────────────────────────────────────────────────────
export const computeKPIs = (data) => {
  if (!data.length) return { totalCalls: 0, dailyAvg: 0, activeTenants: 0, totalConnectors: 0, thisMonth: 0 };

  const totalCalls = data.reduce((s, r) => s + r['API Calls'], 0);

  const byDate = {};
  data.forEach(r => {
    byDate[r.DateStr] = (byDate[r.DateStr] || 0) + r['API Calls'];
  });
  const dailyTotals = Object.values(byDate);
  const dailyAvg = dailyTotals.length ? Math.round(dailyTotals.reduce((s, v) => s + v, 0) / dailyTotals.length) : 0;

  const activeTenants = new Set(data.filter(r => r['API Calls'] > 0).map(r => r['Tenant Name'])).size;
  const totalConnectors = new Set(data.map(r => r['Connector Name'])).size;

  const latestMonth = data.reduce((max, r) => r.Month > max ? r.Month : max, '');
  const thisMonth = data.filter(r => r.Month === latestMonth).reduce((s, r) => s + r['API Calls'], 0);

  return { totalCalls, dailyAvg, activeTenants, totalConnectors, thisMonth };
};

export const getDailyTrend = (data) => {
  const byDate = {};
  data.forEach(r => {
    byDate[r.DateStr] = (byDate[r.DateStr] || 0) + r['API Calls'];
  });
  const sorted = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b));

  // 7-day rolling avg
  return sorted.map(([date, calls], i) => {
    const window = sorted.slice(Math.max(0, i - 6), i + 1).map(([, v]) => v);
    const avg = Math.round(window.reduce((s, v) => s + v, 0) / window.length);
    return { date: date.slice(5), fullDate: date, calls, avg };
  });
};

export const getMonthlyTrend = (data) => {
  const byMonth = {};
  data.forEach(r => { byMonth[r.Month] = (byMonth[r.Month] || 0) + r['API Calls']; });
  return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b))
    .map(([month, calls]) => ({ month, calls }));
};

export const getTopTenants = (data, n = 10) => {
  const byTenant = {};
  data.forEach(r => { byTenant[r['Tenant Name']] = (byTenant[r['Tenant Name']] || 0) + r['API Calls']; });
  return Object.entries(byTenant).sort(([, a], [, b]) => b - a).slice(0, n)
    .map(([name, calls]) => ({ name, calls }));
};

export const getTopConnectors = (data, n = 10) => {
  const byConn = {};
  data.forEach(r => { byConn[r['Connector Name']] = (byConn[r['Connector Name']] || 0) + r['API Calls']; });
  return Object.entries(byConn).sort(([, a], [, b]) => b - a).slice(0, n)
    .map(([name, calls]) => ({ name, calls }));
};

export const getConnectorByTenant = (data) => {
  const map = {};
  data.forEach(r => {
    if (!map[r['Tenant Name']]) map[r['Tenant Name']] = {};
    map[r['Tenant Name']][r['Connector Name']] = (map[r['Tenant Name']][r['Connector Name']] || 0) + r['API Calls'];
  });
  const allConnectors = [...new Set(data.map(r => r['Connector Name']))];
  return Object.entries(map).map(([tenant, connMap]) => {
    const row = { tenant };
    allConnectors.forEach(c => { row[c] = connMap[c] || 0; });
    return row;
  });
};

export const getHeatmapData = (data) => {
  const tenants = [...new Set(data.map(r => r['Tenant Name']))];
  const dates = [...new Set(data.map(r => r.DateStr))].sort();

  // Sample max 30 dates
  const step = Math.ceil(dates.length / 30);
  const sampledDates = dates.filter((_, i) => i % step === 0);

  const matrix = {};
  data.forEach(r => {
    const key = `${r['Tenant Name']}||${r.DateStr}`;
    matrix[key] = (matrix[key] || 0) + r['API Calls'];
  });

  return { tenants, dates: sampledDates, matrix };
};

export const getDayOfWeekAvg = (data) => {
  const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const byDay = {};
  const countByDay = {};
  data.forEach(r => {
    byDay[r.DayOfWeek] = (byDay[r.DayOfWeek] || 0) + r['API Calls'];
    countByDay[r.DayOfWeek] = (countByDay[r.DayOfWeek] || 0) + 1;
  });
  return order.map(day => ({
    day: day.slice(0, 3),
    calls: countByDay[day] ? Math.round(byDay[day] / countByDay[day]) : 0,
  }));
};

export const detectSpikes = (data, zThreshold = 2.5) => {
  const groups = {};
  data.forEach(r => {
    const key = `${r['Tenant Name']}||${r['Connector Name']}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push({ date: r.DateStr, calls: r['API Calls'] });
  });

  const spikes = [];
  Object.entries(groups).forEach(([key, records]) => {
    const [tenant, connector] = key.split('||');
    const vals = records.map(r => r.calls);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) || 1;
    records.forEach(({ date, calls }) => {
      const z = (calls - mean) / std;
      if (z > zThreshold) {
        spikes.push({ tenant, connector, date, calls, z: z.toFixed(1), pct: Math.round((calls - mean) / mean * 100) });
      }
    });
  });
  return spikes.sort((a, b) => b.z - a.z).slice(0, 15);
};

export const segmentTenants = (data) => {
  const byTenant = {};
  data.forEach(r => { byTenant[r['Tenant Name']] = (byTenant[r['Tenant Name']] || 0) + r['API Calls']; });
  const entries = Object.entries(byTenant).sort(([, a], [, b]) => b - a);
  const vals = entries.map(([, v]) => v).sort((a, b) => a - b);
  const q33 = vals[Math.floor(vals.length * 0.33)] || 0;
  const q66 = vals[Math.floor(vals.length * 0.66)] || 0;
  return entries.map(([name, calls]) => ({
    name, calls,
    segment: calls <= q33 ? 'Low' : calls <= q66 ? 'Medium' : 'High',
  }));
};

export const getActiveTenants = (data) => {
  const map = {};
  data.forEach(r => {
    if (!map[r['Tenant Name']]) {
      map[r['Tenant Name']] = { name: r['Tenant Name'], calls: 0, connectors: new Set(), days: new Set(), lastSeen: '' };
    }
    map[r['Tenant Name']].calls += r['API Calls'];
    map[r['Tenant Name']].connectors.add(r['Connector Name']);
    map[r['Tenant Name']].days.add(r.DateStr);
    if (r.DateStr > map[r['Tenant Name']].lastSeen) map[r['Tenant Name']].lastSeen = r.DateStr;
  });
  return Object.values(map)
    .map(t => ({ ...t, connectors: t.connectors.size, days: t.days.size, avgPerDay: Math.round(t.calls / t.days.size) }))
    .sort((a, b) => b.calls - a.calls);
};

export const getConnectorTrend = (data) => {
  const topConnectors = getTopConnectors(data, 5).map(c => c.name);
  const byConnDate = {};
  data.filter(r => topConnectors.includes(r['Connector Name'])).forEach(r => {
    const key = `${r['Connector Name']}||${r.DateStr}`;
    byConnDate[key] = (byConnDate[key] || 0) + r['API Calls'];
  });

  const dates = [...new Set(data.map(r => r.DateStr))].sort();
  const step = Math.ceil(dates.length / 30);
  const sampledDates = dates.filter((_, i) => i % step === 0);

  // Rolling avg per connector
  const result = sampledDates.map(date => {
    const row = { date: date.slice(5) };
    topConnectors.forEach(c => { row[c] = byConnDate[`${c}||${date}`] || 0; });
    return row;
  });
  return { data: result, connectors: topConnectors };
};

export const getUniqueTenants = (data) => [...new Set(data.map(r => r['Tenant Name']))].sort();
export const getUniqueConnectors = (data) => [...new Set(data.map(r => r['Connector Name']))].sort();
export const getDateRange = (data) => {
  const dates = data.map(r => r.DateStr).sort();
  return { min: dates[0], max: dates[dates.length - 1] };
};

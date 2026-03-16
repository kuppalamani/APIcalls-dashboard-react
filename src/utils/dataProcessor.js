import * as XLSX from 'xlsx';

// ─── Parse date string "D/M/YY" → ISO "YYYY-MM-DD" ──────────────────────────
function parseDateCol(colName) {
  // Expect format like "1/1/26", "15/3/26", etc.  (day/month/2-digit-year)
  const match = String(colName).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (!match) return null;
  const day   = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year  = '20' + match[3];           // "26" → "2026"
  return `${year}-${month}-${day}`;
}

// ─── Is this column name a real date column? ────────────────────────────────
function isDateColumn(colName) {
  return parseDateCol(colName) !== null;
}

// ─── Main processor ──────────────────────────────────────────────────────────
export function processExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // ── Sheet names ──────────────────────────────────────────────────────
        const sheetNames = workbook.SheetNames;
        console.log('Sheets found:', sheetNames);

        // Sheet 1  →  TenantName-OID  (mapping: oid | email | Tenant name)
        // Sheet 2  →  ADP API Calls   (usage: Connector | oid | Tenant Name | <date cols...>)
        const mappingSheetName = sheetNames[0];   // "TenantName-OID"
        const usageSheetName   = sheetNames[1];   // "ADP API Calls"

        // ── Parse mapping sheet ──────────────────────────────────────────────
        const mappingSheet = workbook.Sheets[mappingSheetName];
        const mappingRaw   = XLSX.utils.sheet_to_json(mappingSheet, { defval: '' });

        // Build oid → email lookup  (column is lowercase "email" and "Tenant name")
        const oidToEmail = {};
        mappingRaw.forEach(row => {
          const oid   = String(row['oid']          || '').trim();
          const email = String(row['email']         || '').trim();
          if (oid) oidToEmail[oid] = email;
        });

        // ── Parse usage sheet ────────────────────────────────────────────────
        const usageSheet = workbook.Sheets[usageSheetName];
        const usageRaw   = XLSX.utils.sheet_to_json(usageSheet, { defval: 0 });

        if (!usageRaw || usageRaw.length === 0) {
          reject(new Error('No data found in the ADP API Calls sheet.'));
          return;
        }

        // ── Identify real date columns (filter out Column### junk) ───────────
        const allCols   = Object.keys(usageRaw[0]);
        const dateCols  = allCols.filter(isDateColumn);
        const fixedCols = ['Connector', 'oid', 'Tenant Name'];

        console.log(`Found ${dateCols.length} date columns, ${usageRaw.length} rows`);

        if (dateCols.length === 0) {
          reject(new Error('No date columns found. Expected format: D/M/YY (e.g. 1/1/26)'));
          return;
        }

        // ── Build normalised records ─────────────────────────────────────────
        // Each record: { date, connector, tenantName, oid, email, calls }
        const records = [];

        usageRaw.forEach(row => {
          const connector  = String(row['Connector']    || '').trim();
          const oid        = String(row['oid']          || '').trim();
          const tenantName = String(row['Tenant Name']  || '').trim();
          const email      = oidToEmail[oid] || '';

          dateCols.forEach(col => {
            const isoDate = parseDateCol(col);
            if (!isoDate) return;

            const rawVal = row[col];
            const calls  = typeof rawVal === 'number'
              ? rawVal
              : parseFloat(rawVal) || 0;

            if (calls > 0) {   // skip zero-call rows for performance
              records.push({
                date:       isoDate,
                connector,
                tenantName,
                oid,
                email,
                calls,
              });
            }
          });
        });

        console.log(`Built ${records.length} non-zero records`);

        if (records.length === 0) {
          reject(new Error('All API call values are zero. Please check the file.'));
          return;
        }

        // ── Derive analytics ─────────────────────────────────────────────────
        const analytics = computeAnalytics(records, dateCols);
        resolve(analytics);

      } catch (err) {
        console.error('Error processing Excel:', err);
        reject(new Error('Failed to parse Excel file: ' + err.message));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Compute all analytics from flat records ─────────────────────────────────
function computeAnalytics(records, dateCols) {

  // ── All unique dates (sorted) ─────────────────────────────────────────────
  const allDates = [...new Set(records.map(r => r.date))].sort();
  const minDate  = allDates[0];
  const maxDate  = allDates[allDates.length - 1];

  // ── Daily totals ──────────────────────────────────────────────────────────
  const dailyMap = {};
  records.forEach(r => {
    dailyMap[r.date] = (dailyMap[r.date] || 0) + r.calls;
  });
  const dailyData = allDates.map(date => ({
    date,
    calls:        dailyMap[date] || 0,
    displayDate:  formatDisplayDate(date),
  }));

  // ── 7-day rolling average ─────────────────────────────────────────────────
  dailyData.forEach((d, i) => {
    const window = dailyData.slice(Math.max(0, i - 6), i + 1);
    d.rollingAvg = Math.round(window.reduce((s, x) => s + x.calls, 0) / window.length);
  });

  // ── Monthly totals ────────────────────────────────────────────────────────
  const monthlyMap = {};
  records.forEach(r => {
    const mon = r.date.substring(0, 7);           // "2026-01"
    monthlyMap[mon] = (monthlyMap[mon] || 0) + r.calls;
  });
  const monthlyData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, calls]) => ({
      month,
      calls,
      displayMonth: formatMonth(month),
    }));

  // ── Top tenants ───────────────────────────────────────────────────────────
  const tenantMap = {};
  records.forEach(r => {
    const key = r.tenantName || r.oid || 'Unknown';
    if (!tenantMap[key]) tenantMap[key] = { name: key, calls: 0, email: r.email };
    tenantMap[key].calls += r.calls;
  });
  const topTenants = Object.values(tenantMap)
    .sort((a, b) => b.calls - a.calls);

  // ── Top connectors ────────────────────────────────────────────────────────
  const connectorMap = {};
  records.forEach(r => {
    const key = r.connector || 'Unknown';
    connectorMap[key] = (connectorMap[key] || 0) + r.calls;
  });
  const topConnectors = Object.entries(connectorMap)
    .sort(([, a], [, b]) => b - a)
    .map(([name, calls]) => ({ name, calls }));

  // ── This month's total ────────────────────────────────────────────────────
  const thisMonth     = maxDate.substring(0, 7);
  const thisMonthData = monthlyMap[thisMonth] || 0;

  // ── KPI summary ───────────────────────────────────────────────────────────
  const totalCalls     = records.reduce((s, r) => s + r.calls, 0);
  const activeTenants  = new Set(records.map(r => r.tenantName || r.oid)).size;
  const activeConns    = new Set(records.map(r => r.connector)).size;
  const dailyAverage   = dailyData.length > 0
    ? Math.round(totalCalls / dailyData.length)
    : 0;

  // ── Tenant usage over time (for heatmap / table) ──────────────────────────
  const tenantDailyMap = {};
  records.forEach(r => {
    const key = r.tenantName || r.oid;
    if (!tenantDailyMap[key]) tenantDailyMap[key] = {};
    tenantDailyMap[key][r.date] = (tenantDailyMap[key][r.date] || 0) + r.calls;
  });

  // ── Connector daily breakdown ─────────────────────────────────────────────
  const connectorDailyMap = {};
  records.forEach(r => {
    const key = r.connector;
    if (!connectorDailyMap[key]) connectorDailyMap[key] = {};
    connectorDailyMap[key][r.date] = (connectorDailyMap[key][r.date] || 0) + r.calls;
  });

  // ── Spike detection ───────────────────────────────────────────────────────
  const values   = dailyData.map(d => d.calls);
  const mean     = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev   = Math.sqrt(variance);
  const spikes   = dailyData.filter(d => d.calls > mean + 2.5 * stdDev);

  // ── Unique tenants list (for filter dropdown) ─────────────────────────────
  const tenantList = Object.values(tenantMap)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(t => ({ name: t.name, email: t.email }));

  const connectorList = topConnectors.map(c => c.name);

  return {
    // KPIs
    totalCalls,
    dailyAverage,
    activeTenants,
    activeConnectors: activeConns,
    thisMonthCalls:   thisMonthData,

    // Date range
    minDate,
    maxDate,
    allDates,

    // Charts
    dailyData,
    monthlyData,

    // Rankings
    topTenants,
    topConnectors,

    // Advanced
    spikes,
    tenantDailyMap,
    connectorDailyMap,

    // Filter options
    tenantList,
    connectorList,

    // Raw for custom filtering
    records,
  };
}

// ─── Apply filters to raw records and recompute ───────────────────────────────
export function applyFilters(fullAnalytics, filters = {}) {
  const {
    tenantName   = null,
    connectorName = null,
    startDate    = null,
    endDate      = null,
    emailSearch  = '',
  } = filters;

  let filtered = fullAnalytics.records;

  if (tenantName)    filtered = filtered.filter(r => r.tenantName === tenantName);
  if (connectorName) filtered = filtered.filter(r => r.connector  === connectorName);
  if (startDate)     filtered = filtered.filter(r => r.date >= startDate);
  if (endDate)       filtered = filtered.filter(r => r.date <= endDate);
  if (emailSearch)   filtered = filtered.filter(r =>
    r.email.toLowerCase().includes(emailSearch.toLowerCase()) ||
    r.tenantName.toLowerCase().includes(emailSearch.toLowerCase())
  );

  if (filtered.length === 0) return null;   // no data matches filter

  // Get date columns from filtered records
  const dateCols = [...new Set(filtered.map(r => r.date))].sort();
  return computeAnalytics(filtered, dateCols);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDisplayDate(isoDate) {
  // "2026-01-15" → "Jan 15"
  try {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return isoDate; }
}

function formatMonth(yearMonth) {
  // "2026-01" → "Jan 2026"
  try {
    const [y, m] = yearMonth.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch { return yearMonth; }
}

import * as XLSX from 'xlsx';

// ─── Parse date string "D/M/YY" → ISO "YYYY-MM-DD" ──────────────────────────
function parseDateCol(colName) {
  const match = String(colName).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (!match) return null;

  const day   = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year  = '20' + match[3];

  return `${year}-${month}-${day}`;
}

function isDateColumn(colName) {
  return parseDateCol(colName) !== null;
}

// ─── Main processor ─────────────────────────────────────────────────────────
export function processExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        const sheetNames = workbook.SheetNames;
        console.log('Sheets found:', sheetNames);

        const mappingSheetName = sheetNames[0];
        const usageSheetName   = sheetNames[1];

        const mappingSheet = workbook.Sheets[mappingSheetName];
        const mappingRaw   = XLSX.utils.sheet_to_json(mappingSheet, { defval: '' });

        const oidToEmail = {};

        mappingRaw.forEach(row => {
          const oid   = String(row['oid'] || '').trim();
          const email = String(row['email'] || '').trim();
          if (oid) oidToEmail[oid] = email;
        });

        const usageSheet = workbook.Sheets[usageSheetName];
        const usageRaw   = XLSX.utils.sheet_to_json(usageSheet, { defval: 0 });

        if (!usageRaw || usageRaw.length === 0) {
          reject(new Error('No data found in the ADP API Calls sheet.'));
          return;
        }

        const allCols  = Object.keys(usageRaw[0]);
        const dateCols = allCols.filter(isDateColumn);

        console.log(`Found ${dateCols.length} date columns, ${usageRaw.length} rows`);

        if (dateCols.length === 0) {
          reject(new Error('No date columns found. Expected format: D/M/YY'));
          return;
        }

        const records = [];

        usageRaw.forEach(row => {
          const connector  = String(row['Connector'] || '').trim();
          const oid        = String(row['oid'] || '').trim();
          const tenantName = String(row['Tenant Name'] || '').trim();
          const email      = oidToEmail[oid] || '';

          dateCols.forEach(col => {
            const isoDate = parseDateCol(col);
            if (!isoDate) return;

            const rawVal = row[col];
            const calls  = typeof rawVal === 'number'
              ? rawVal
              : parseFloat(rawVal) || 0;

            if (calls > 0) {
              records.push({
                date: isoDate,
                connector,
                tenantName,
                oid,
                email,
                calls
              });
            }
          });
        });

        console.log(`Built ${records.length} non-zero records`);

        if (records.length === 0) {
          reject(new Error('All API call values are zero.'));
          return;
        }

        const analytics = computeAnalytics(records, dateCols);
        resolve(analytics);

      } catch (err) {
        console.error(err);
        reject(new Error('Failed to parse Excel file: ' + err.message));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Compute analytics ──────────────────────────────────────────────────────
function computeAnalytics(records, dateCols) {

  const allDates = [...new Set(records.map(r => r.date))].sort();
  const minDate  = allDates[0];
  const maxDate  = allDates[allDates.length - 1];

  const dailyMap = {};
  records.forEach(r => {
    dailyMap[r.date] = (dailyMap[r.date] || 0) + r.calls;
  });

  const dailyData = allDates.map(date => ({
    date,
    calls: dailyMap[date] || 0,
    displayDate: formatDisplayDate(date)
  }));

  dailyData.forEach((d, i) => {
    const window = dailyData.slice(Math.max(0, i - 6), i + 1);
    d.rollingAvg = Math.round(
      window.reduce((s, x) => s + x.calls, 0) / window.length
    );
  });

  const monthlyMap = {};
  records.forEach(r => {
    const mon = r.date.substring(0, 7);
    monthlyMap[mon] = (monthlyMap[mon] || 0) + r.calls;
  });

  const monthlyData = Object.entries(monthlyMap)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([month,calls]) => ({
      month,
      calls,
      displayMonth: formatMonth(month)
    }));

  const tenantMap = {};
  records.forEach(r => {
    const key = r.tenantName || r.oid || 'Unknown';
    if (!tenantMap[key]) tenantMap[key] = { name: key, calls: 0, email: r.email };
    tenantMap[key].calls += r.calls;
  });

  const topTenants = Object.values(tenantMap)
    .sort((a,b) => b.calls - a.calls);

  const connectorMap = {};
  records.forEach(r => {
    const key = r.connector || 'Unknown';
    connectorMap[key] = (connectorMap[key] || 0) + r.calls;
  });

  const topConnectors = Object.entries(connectorMap)
    .sort(([,a],[,b]) => b - a)
    .map(([name,calls]) => ({ name, calls }));

  const thisMonth     = maxDate.substring(0,7);
  const thisMonthData = monthlyMap[thisMonth] || 0;

  const totalCalls = records.reduce((s,r) => s + r.calls, 0);
  const activeTenants = new Set(records.map(r => r.tenantName || r.oid)).size;
  const activeConns   = new Set(records.map(r => r.connector)).size;

  const dailyAverage = dailyData.length
    ? Math.round(totalCalls / dailyData.length)
    : 0;

  const tenantDailyMap = {};
  records.forEach(r => {
    const key = r.tenantName || r.oid;
    if (!tenantDailyMap[key]) tenantDailyMap[key] = {};
    tenantDailyMap[key][r.date] =
      (tenantDailyMap[key][r.date] || 0) + r.calls;
  });

  const connectorDailyMap = {};
  records.forEach(r => {
    const key = r.connector;
    if (!connectorDailyMap[key]) connectorDailyMap[key] = {};
    connectorDailyMap[key][r.date] =
      (connectorDailyMap[key][r.date] || 0) + r.calls;
  });

  const values = dailyData.map(d => d.calls);
  const mean   = values.reduce((s,v)=>s+v,0) / values.length;
  const variance = values.reduce((s,v)=>s + Math.pow(v-mean,2),0) / values.length;
  const stdDev = Math.sqrt(variance);

  const spikes = dailyData.filter(d => d.calls > mean + 2.5 * stdDev);

  const tenantList = Object.values(tenantMap)
    .sort((a,b)=>a.name.localeCompare(b.name))
    .map(t => ({ name: t.name, email: t.email }));

  const connectorList = topConnectors.map(c => c.name);

  return {
    totalCalls,
    dailyAverage,
    activeTenants,
    activeConnectors: activeConns,
    thisMonthCalls: thisMonthData,
    minDate,
    maxDate,
    allDates,
    dailyData,
    monthlyData,
    topTenants,
    topConnectors,
    spikes,
    tenantDailyMap,
    connectorDailyMap,
    tenantList,
    connectorList,
    records
  };
}

// ─── Filters ────────────────────────────────────────────────────────────────
export function applyFilters(fullAnalytics, filters = {}) {

  const {
    tenantName = null,
    connectorName = null,
    startDate = null,
    endDate = null,
    emailSearch = ''
  } = filters;

  let filtered = fullAnalytics.records;

  if (tenantName)
    filtered = filtered.filter(r => r.tenantName === tenantName);

  if (connectorName)
    filtered = filtered.filter(r => r.connector === connectorName);

  if (startDate)
    filtered = filtered.filter(r => r.date >= startDate);

  if (endDate)
    filtered = filtered.filter(r => r.date <= endDate);

  if (emailSearch)
    filtered = filtered.filter(r =>
      r.email.toLowerCase().includes(emailSearch.toLowerCase()) ||
      r.tenantName.toLowerCase().includes(emailSearch.toLowerCase())
    );

  if (!filtered.length) return null;

  const dateCols = [...new Set(filtered.map(r => r.date))].sort();
  return computeAnalytics(filtered, dateCols);
}

// ─── Added missing export (fix for your build error) ─────────────────────────
export function getDateRange(records) {
  if (!records || records.length === 0) {
    return { minDate: null, maxDate: null };
  }

  const dates = records.map(r => r.date).sort();

  return {
    minDate: dates[0],
    maxDate: dates[dates.length - 1]
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatDisplayDate(isoDate) {
  try {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  } catch {
    return isoDate;
  }
}

function formatMonth(yearMonth) {
  try {
    const [y,m] = yearMonth.split('-');
    const d = new Date(Number(y), Number(m)-1, 1);
    return d.toLocaleDateString('en-US',{month:'short',year:'numeric'});
  } catch {
    return yearMonth;
  }
}

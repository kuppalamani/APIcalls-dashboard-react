import * as XLSX from 'xlsx';

function parseDateCol(colName) {
  const match = String(colName).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (!match) return null;

  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = '20' + match[3];

  return `${year}-${month}-${day}`;
}

function isDateColumn(colName) {
  return parseDateCol(colName) !== null;
}

export function processExcelFile(file) {
  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onload = (e) => {
      try {

        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        const sheetNames = workbook.SheetNames;

        const mappingSheetName = sheetNames[0];
        const usageSheetName = sheetNames[1];

        const mappingSheet = workbook.Sheets[mappingSheetName];
        const mappingRaw = XLSX.utils.sheet_to_json(mappingSheet, { defval: '' });

        const oidToEmail = {};

        mappingRaw.forEach(row => {
          const oid = String(row['oid'] || '').trim();
          const email = String(row['email'] || '').trim();

          if (oid) oidToEmail[oid] = email;
        });

        const usageSheet = workbook.Sheets[usageSheetName];
        const usageRaw = XLSX.utils.sheet_to_json(usageSheet, { defval: 0 });

        if (!usageRaw || usageRaw.length === 0) {
          reject(new Error('No data found in sheet'));
          return;
        }

        const allCols = Object.keys(usageRaw[0]);
        const dateCols = allCols.filter(isDateColumn);

        if (!dateCols.length) {
          reject(new Error('No date columns found'));
          return;
        }

        const records = [];

        usageRaw.forEach(row => {

          const connector = String(row['Connector'] || '').trim();
          const oid = String(row['oid'] || '').trim();
          const tenantName = String(row['Tenant Name'] || '').trim();
          const email = oidToEmail[oid] || '';

          dateCols.forEach(col => {

            const isoDate = parseDateCol(col);
            if (!isoDate) return;

            const rawVal = row[col];

            const calls =
              typeof rawVal === 'number'
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

        const analytics = computeAnalytics(records, dateCols);

        resolve(analytics);

      } catch (err) {
        reject(new Error('Failed to parse Excel: ' + err.message));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));

    reader.readAsArrayBuffer(file);

  });
}

function computeAnalytics(records) {

  const allDates = [...new Set(records.map(r => r.date))].sort();

  const minDate = allDates[0];
  const maxDate = allDates[allDates.length - 1];

  const dailyMap = {};

  records.forEach(r => {
    dailyMap[r.date] = (dailyMap[r.date] || 0) + r.calls;
  });

  const dailyData = allDates.map(date => ({
    date,
    calls: dailyMap[date] || 0,
    displayDate: formatDisplayDate(date)
  }));

  const monthlyMap = {};

  records.forEach(r => {
    const m = r.date.substring(0, 7);
    monthlyMap[m] = (monthlyMap[m] || 0) + r.calls;
  });

  const monthlyData =
    Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, calls]) => ({
        month,
        calls,
        displayMonth: formatMonth(month)
      }));

  const tenantMap = {};

  records.forEach(r => {

    const key = r.tenantName || r.oid || 'Unknown';

    if (!tenantMap[key])
      tenantMap[key] = { name: key, calls: 0, email: r.email };

    tenantMap[key].calls += r.calls;

  });

  const topTenants =
    Object.values(tenantMap)
      .sort((a, b) => b.calls - a.calls);

  const connectorMap = {};

  records.forEach(r => {
    const key = r.connector || 'Unknown';
    connectorMap[key] = (connectorMap[key] || 0) + r.calls;
  });

  const topConnectors =
    Object.entries(connectorMap)
      .sort(([, a], [, b]) => b - a)
      .map(([name, calls]) => ({ name, calls }));

  const kpis = computeKPIs(records);

  return {
    ...kpis,
    minDate,
    maxDate,
    allDates,
    dailyData,
    monthlyData,
    topTenants,
    topConnectors,
    records
  };
}

export function computeKPIs(records) {

  if (!records || !records.length) {
    return {
      totalCalls: 0,
      dailyAverage: 0,
      activeTenants: 0,
      activeConnectors: 0
    };
  }

  const totalCalls = records.reduce((s, r) => s + r.calls, 0);

  const activeTenants =
    new Set(records.map(r => r.tenantName || r.oid)).size;

  const activeConnectors =
    new Set(records.map(r => r.connector)).size;

  const uniqueDates =
    [...new Set(records.map(r => r.date))];

  const dailyAverage =
    Math.round(totalCalls / uniqueDates.length);

  return {
    totalCalls,
    dailyAverage,
    activeTenants,
    activeConnectors
  };
}

export function getDateRange(records) {

  if (!records || !records.length) {
    return { minDate: null, maxDate: null };
  }

  const dates = records.map(r => r.date).sort();

  return {
    minDate: dates[0],
    maxDate: dates[dates.length - 1]
  };
}

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

  return computeAnalytics(filtered);
}

function formatDisplayDate(date) {

  try {
    const d = new Date(date + 'T00:00:00');

    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });

  } catch {
    return date;
  }
}

function formatMonth(month) {

  try {
    const [y, m] = month.split('-');

    const d = new Date(Number(y), Number(m) - 1, 1);

    return d.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    });

  } catch {
    return month;
  }
}

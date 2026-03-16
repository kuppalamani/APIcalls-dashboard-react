import * as XLSX from 'xlsx';

function parseDateCol(colName){
  const m = String(colName).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if(!m) return null;

  const d = m[1].padStart(2,'0');
  const mth = m[2].padStart(2,'0');
  const y = '20'+m[3];

  return `${y}-${mth}-${d}`;
}

function isDateColumn(col){
  return parseDateCol(col) !== null;
}

export function processExcelFile(file){

  return new Promise((resolve,reject)=>{

    const reader = new FileReader();

    reader.onload = (e)=>{

      try{

        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data,{type:'array'});

        const mapSheet = wb.Sheets[wb.SheetNames[0]];
        const usageSheet = wb.Sheets[wb.SheetNames[1]];

        const mapRows = XLSX.utils.sheet_to_json(mapSheet,{defval:''});
        const usageRows = XLSX.utils.sheet_to_json(usageSheet,{defval:0});

        const oidEmail = {};
        mapRows.forEach(r=>{
          const oid = String(r['oid']||'').trim();
          const email = String(r['email']||'').trim();
          if(oid) oidEmail[oid]=email;
        });

        const cols = Object.keys(usageRows[0]);
        const dateCols = cols.filter(isDateColumn);

        const records=[];

        usageRows.forEach(row=>{

          const connector = String(row['Connector']||'').trim();
          const oid = String(row['oid']||'').trim();
          const tenantName = String(row['Tenant Name']||'').trim();
          const email = oidEmail[oid] || '';

          dateCols.forEach(col=>{

            const iso = parseDateCol(col);
            if(!iso) return;

            const raw = row[col];
            const calls = typeof raw==='number'?raw:parseFloat(raw)||0;

            if(calls>0){
              records.push({
                date:iso,
                connector,
                tenantName,
                oid,
                email,
                calls
              });
            }

          });

        });

        resolve(computeAnalytics(records));

      }catch(err){
        reject(err);
      }

    };

    reader.readAsArrayBuffer(file);

  });

}

function computeAnalytics(records){

  return{
    ...computeKPIs(records),
    ...getDateRange(records),
    dailyTrend:getDailyTrend(records),
    monthlyTrend:getMonthlyTrend(records),
    topTenants:getTopTenants(records),
    topConnectors:getTopConnectors(records),
    records
  };

}

export function computeKPIs(records){

  if(!records.length){
    return{
      totalCalls:0,
      dailyAverage:0,
      activeTenants:0,
      activeConnectors:0
    };
  }

  const totalCalls = records.reduce((s,r)=>s+r.calls,0);

  const tenants = new Set(records.map(r=>r.tenantName||r.oid));
  const connectors = new Set(records.map(r=>r.connector));
  const dates = new Set(records.map(r=>r.date));

  return{
    totalCalls,
    dailyAverage:Math.round(totalCalls/dates.size),
    activeTenants:tenants.size,
    activeConnectors:connectors.size
  };

}

export function getDateRange(records){

  if(!records.length) return {minDate:null,maxDate:null};

  const dates = records.map(r=>r.date).sort();

  return{
    minDate:dates[0],
    maxDate:dates[dates.length-1]
  };

}

export function getDailyTrend(records){

  const map={};

  records.forEach(r=>{
    map[r.date]=(map[r.date]||0)+r.calls;
  });

  return Object.keys(map)
    .sort()
    .map(d=>({date:d,calls:map[d]}));

}

export function getMonthlyTrend(records){

  const map={};

  records.forEach(r=>{
    const m = r.date.substring(0,7);
    map[m]=(map[m]||0)+r.calls;
  });

  return Object.keys(map)
    .sort()
    .map(m=>({month:m,calls:map[m]}));

}

export function getTopTenants(records){

  const map={};

  records.forEach(r=>{
    const key = r.tenantName || r.oid || 'Unknown';

    if(!map[key])
      map[key]={name:key,calls:0,email:r.email};

    map[key].calls += r.calls;
  });

  return Object.values(map)
    .sort((a,b)=>b.calls-a.calls);

}

export function getTopConnectors(records){

  const map={};

  records.forEach(r=>{
    const key = r.connector || 'Unknown';
    map[key]=(map[key]||0)+r.calls;
  });

  return Object.entries(map)
    .map(([name,calls])=>({name,calls}))
    .sort((a,b)=>b.calls-a.calls);

}

export function applyFilters(fullAnalytics,filters={}){

  let filtered = fullAnalytics.records;

  const{
    tenantName=null,
    connectorName=null,
    startDate=null,
    endDate=null,
    emailSearch=''
  }=filters;

  if(tenantName)
    filtered=filtered.filter(r=>r.tenantName===tenantName);

  if(connectorName)
    filtered=filtered.filter(r=>r.connector===connectorName);

  if(startDate)
    filtered=filtered.filter(r=>r.date>=startDate);

  if(endDate)
    filtered=filtered.filter(r=>r.date<=endDate);

  if(emailSearch)
    filtered=filtered.filter(r=>
      r.email.toLowerCase().includes(emailSearch.toLowerCase()) ||
      r.tenantName.toLowerCase().includes(emailSearch.toLowerCase())
    );

  if(!filtered.length) return null;

  return computeAnalytics(filtered);

}
export function getConnectorByTenant(records){

  const map = {};

  records.forEach(r=>{

    const tenant = r.tenantName || r.oid || 'Unknown';
    const connector = r.connector || 'Unknown';

    if(!map[tenant])
      map[tenant] = {};

    map[tenant][connector] =
      (map[tenant][connector] || 0) + r.calls;

  });

  return Object.keys(map).map(tenant=>({

    tenant,

    connectors: Object.entries(map[tenant])
      .map(([name,calls])=>({name,calls}))
      .sort((a,b)=>b.calls-a.calls)

  }));

}
export function getHeatmapData(records){

  if(!records || !records.length) return [];

  const map = {};

  records.forEach(r=>{

    const tenant = r.tenantName || r.oid || 'Unknown';
    const date = r.date;

    if(!map[tenant])
      map[tenant] = {};

    map[tenant][date] =
      (map[tenant][date] || 0) + r.calls;

  });

  return Object.keys(map).map(tenant=>({

    tenant,

    dates: Object.entries(map[tenant])
      .map(([date,calls])=>({
        date,
        calls
      }))
      .sort((a,b)=>a.date.localeCompare(b.date))

  }));

}
export function getDayOfWeekAvg(records){

  if(!records || !records.length) return [];

  const days = {
    0:{name:'Sun',total:0,count:0},
    1:{name:'Mon',total:0,count:0},
    2:{name:'Tue',total:0,count:0},
    3:{name:'Wed',total:0,count:0},
    4:{name:'Thu',total:0,count:0},
    5:{name:'Fri',total:0,count:0},
    6:{name:'Sat',total:0,count:0}
  };

  records.forEach(r=>{

    const d = new Date(r.date + 'T00:00:00');
    const day = d.getDay();

    days[day].total += r.calls;
    days[day].count += 1;

  });

  return Object.values(days).map(d=>({
    day:d.name,
    avg: d.count ? Math.round(d.total / d.count) : 0
  }));

}
export function detectSpikes(records){

  if(!records || !records.length) return [];

  const daily = {};

  records.forEach(r=>{
    daily[r.date] = (daily[r.date] || 0) + r.calls;
  });

  const values = Object.values(daily);

  const mean =
    values.reduce((s,v)=>s+v,0) / values.length;

  const variance =
    values.reduce((s,v)=>s + Math.pow(v-mean,2),0) / values.length;

  const stdDev = Math.sqrt(variance);

  return Object.entries(daily)
    .filter(([date,calls]) => calls > mean + 2.5 * stdDev)
    .map(([date,calls]) => ({
      date,
      calls
    }));

}
export function segmentTenants(records){

  if(!records || !records.length) return [];

  const tenantMap = {};

  records.forEach(r=>{

    const key = r.tenantName || r.oid || 'Unknown';

    if(!tenantMap[key])
      tenantMap[key] = { name:key, calls:0 };

    tenantMap[key].calls += r.calls;

  });

  const tenants = Object.values(tenantMap);

  return tenants.map(t=>{

    let segment = 'Low';

    if(t.calls > 100000) segment = 'High';
    else if(t.calls > 10000) segment = 'Medium';

    return {
      name: t.name,
      calls: t.calls,
      segment
    };

  });

}
export function getActiveTenants(records){

  if(!records || !records.length) return [];

  const map = {};

  records.forEach(r=>{

    const key = r.tenantName || r.oid || 'Unknown';

    if(!map[key])
      map[key] = {
        name:key,
        email:r.email || '',
        calls:0
      };

    map[key].calls += r.calls;

  });

  return Object.values(map)
    .sort((a,b)=>b.calls-a.calls);

}

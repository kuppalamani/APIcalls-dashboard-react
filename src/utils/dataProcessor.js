import * as XLSX from "xlsx";

/* ---------------- DATE PARSER ---------------- */

function parseDateCol(colName){
  const m = String(colName).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if(!m) return null;

  const d = m[1].padStart(2,"0");
  const mth = m[2].padStart(2,"0");
  const y = "20"+m[3];

  return `${y}-${mth}-${d}`;
}

function isDateColumn(col){
  return parseDateCol(col) !== null;
}

/* ---------------- EXCEL PARSER ---------------- */

export function parseExcelFile(file){

  return new Promise((resolve,reject)=>{

    const reader = new FileReader();

    reader.onload = (e)=>{

      try{

        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data,{type:"array"});

        const mapSheet = wb.Sheets[wb.SheetNames[0]];
        const usageSheet = wb.Sheets[wb.SheetNames[1]];

        const mapRows = XLSX.utils.sheet_to_json(mapSheet,{defval:""});
        const usageRows = XLSX.utils.sheet_to_json(usageSheet,{defval:0});

        const oidEmail = {};

        mapRows.forEach(r=>{
          const oid = String(r["oid"]||"").trim();
          const email = String(r["email"]||"").trim();
          if(oid) oidEmail[oid] = email;
        });

        const cols = Object.keys(usageRows[0] || {});
        const dateCols = cols.filter(isDateColumn);

        const records = [];

        usageRows.forEach(row=>{

          if(!row) return;

          const connector = String(row["Connector"]||"").trim();
          const oid = String(row["oid"]||"").trim();
          const tenantName = String(row["Tenant Name"]||"").trim();
          const email = oidEmail[oid] || "";

          dateCols.forEach(col=>{

            const iso = parseDateCol(col);
            if(!iso) return;

            const calls = Number(row[col]) || 0;

            if(calls === 0) return;

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

      }catch(err){
        reject(err);
      }

    };

    reader.readAsArrayBuffer(file);

  });

}

/* ---------------- KPIs ---------------- */

export function computeKPIs(records){

  if(!records?.length){
    return {
      totalCalls:0,
      dailyAvg:0,
      activeTenants:0,
      totalConnectors:0
    };
  }

  const totalCalls = records.reduce((s,r)=>s+(r.calls||0),0);

  const tenants = new Set(records.map(r=>r.tenantName));
  const connectors = new Set(records.map(r=>r.connector));
  const dates = new Set(records.map(r=>r.date));

  return {
    totalCalls,
    dailyAvg: Math.round(totalCalls / dates.size),
    activeTenants: tenants.size,
    totalConnectors: connectors.size
  };

}

/* ---------------- DATE RANGE ---------------- */

export function getDateRange(records){

  if(!records?.length) return {min:null,max:null};

  const dates = records.map(r=>r.date).sort();

  return {
    min:dates[0],
    max:dates[dates.length-1]
  };

}

/* ---------------- DAILY TREND ---------------- */

export function getDailyTrend(records){

  const map = {};

  records.forEach(r=>{
    if(!r) return;
    map[r.date] = (map[r.date] || 0) + (r.calls || 0);
  });

  return Object.keys(map)
    .sort()
    .map(d=>({
      date:d,
      calls:map[d]
    }));

}

/* ---------------- MONTHLY TREND ---------------- */

export function getMonthlyTrend(records){

  const map = {};

  records.forEach(r=>{
    const m = r.date.substring(0,7);
    map[m] = (map[m]||0) + (r.calls||0);
  });

  return Object.keys(map)
    .sort()
    .map(m=>({
      month:m,
      calls:map[m]
    }));

}

/* ---------------- TOP TENANTS ---------------- */

export function getTopTenants(records){

  const map = {};

  records.forEach(r=>{

    const key = r.tenantName || r.oid || "Unknown";

    if(!map[key])
      map[key] = { name:key, calls:0 };

    map[key].calls += r.calls;

  });

  return Object.values(map)
    .sort((a,b)=>b.calls-a.calls);

}

/* ---------------- TOP CONNECTORS ---------------- */

export function getTopConnectors(records){

  const map = {};

  records.forEach(r=>{

    const key = r.connector || "Unknown";

    map[key] = (map[key]||0) + r.calls;

  });

  return Object.entries(map)
    .map(([name,calls])=>({name,calls}))
    .sort((a,b)=>b.calls-a.calls);

}

/* ---------------- CONNECTOR BY TENANT ---------------- */

export function getConnectorByTenant(records){

  const map = {};

  records.forEach(r=>{

    const tenant = r.tenantName || "Unknown";
    const connector = r.connector || "Unknown";

    if(!map[tenant]) map[tenant] = {};

    map[tenant][connector] =
      (map[tenant][connector]||0) + r.calls;

  });

  return Object.keys(map).map(t=>({

    tenant:t,
    connectors:Object.entries(map[t])
      .map(([name,calls])=>({name,calls}))

  }));

}

/* ---------------- HEATMAP ---------------- */

export function getHeatmapData(records){

  const tenants = [...new Set(records.map(r=>r.tenantName))];
  const dates = [...new Set(records.map(r=>r.date))].sort();

  const matrix = {};

  records.forEach(r=>{
    const key = `${r.tenantName}||${r.date}`;
    matrix[key] = (matrix[key]||0) + r.calls;
  });

  return { tenants, dates, matrix };

}

/* ---------------- DAY OF WEEK ---------------- */

export function getDayOfWeekAvg(records){

  const days = {
    0:{name:"Sun",total:0,count:0},
    1:{name:"Mon",total:0,count:0},
    2:{name:"Tue",total:0,count:0},
    3:{name:"Wed",total:0,count:0},
    4:{name:"Thu",total:0,count:0},
    5:{name:"Fri",total:0,count:0},
    6:{name:"Sat",total:0,count:0}
  };

  records.forEach(r=>{

    const d = new Date(r.date+"T00:00:00");
    const day = d.getDay();

    days[day].total += r.calls;
    days[day].count++;

  });

  return Object.values(days).map(d=>({
    day:d.name,
    calls:d.count ? Math.round(d.total/d.count) : 0
  }));

}

/* ---------------- SPIKES ---------------- */

export function detectSpikes(){ return []; }

/* ---------------- TENANT SEGMENT ---------------- */

export function segmentTenants(records){ return getTopTenants(records); }

/* ---------------- ACTIVE TENANTS ---------------- */

export function getActiveTenants(records){ return getTopTenants(records); }

/* ---------------- CONNECTOR TREND ---------------- */

export function getConnectorTrend(records){

  const connectors = [...new Set(records.map(r=>r.connector))];
  const dates = [...new Set(records.map(r=>r.date))].sort();

  const data = dates.map(d=>{

    const row = { date:d };

    connectors.forEach(c=>{

      row[c] = records
        .filter(r=>r.connector===c && r.date===d)
        .reduce((s,r)=>s+r.calls,0);

    });

    return row;

  });

  return { data, connectors };

}

/* ---------------- UNIQUE VALUES ---------------- */

export function getUniqueTenants(records){
  return [...new Set(records.map(r=>r.tenantName))];
}

export function getUniqueConnectors(records){
  return [...new Set(records.map(r=>r.connector))];
}

/* ---------------- HOURLY TREND ---------------- */

/* ---------- Hourly Trend ---------- */

export function getHourlyTrend(records = []) {

  const safe = safeRecords(records)

  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    calls: 0
  }))

  safe.forEach(r => {

    if (!r || !r.date) return

    const d = new Date(r.date + "T00:00:00")
    if (isNaN(d)) return

    const h = d.getHours()

    hours[h].calls += Number(r.calls || 0)

  })

  return hours

}

import * as XLSX from 'xlsx'

function parseDateCol(colName){
  const m = String(colName).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if(!m) return null

  const d = m[1].padStart(2,'0')
  const mth = m[2].padStart(2,'0')
  const y = '20'+m[3]

  return `${y}-${mth}-${d}`
}

function isDateColumn(col){
  return parseDateCol(col) !== null
}

export function processExcelFile(file){

  return new Promise((resolve,reject)=>{

    const reader = new FileReader()

    reader.onload = (e)=>{

      try{

        const data = new Uint8Array(e.target.result)
        const wb = XLSX.read(data,{type:'array'})

        const mapSheet = wb.Sheets[wb.SheetNames[0]]
        const usageSheet = wb.Sheets[wb.SheetNames[1]]

        const mapRows = XLSX.utils.sheet_to_json(mapSheet,{defval:''})
        const usageRows = XLSX.utils.sheet_to_json(usageSheet,{defval:0})

        const oidEmail = {}

        mapRows.forEach(r=>{
          const oid = String(r['oid']||'').trim()
          const email = String(r['email']||'').trim()
          if(oid) oidEmail[oid]=email
        })

        const cols = Object.keys(usageRows[0] || {})
        const dateCols = cols.filter(isDateColumn)

        const records=[]

        usageRows.forEach(row=>{

          const connector = String(row['Connector']||'').trim()
          const oid = String(row['oid']||'').trim()
          const tenantName = String(row['Tenant Name']||'').trim()
          const email = oidEmail[oid] || ''

          dateCols.forEach(col=>{

            const iso = parseDateCol(col)
            if(!iso) return

            const raw = row[col]
            const calls = Number(raw) || 0

            records.push({
              date: iso,
              connector,
              tenantName,
              oid,
              email,
              calls
            })

          })

        })

        resolve(computeAnalytics(records))

      }catch(err){
        reject(err)
      }

    }

    reader.readAsArrayBuffer(file)

  })

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
  }

}

export function computeKPIs(records){

  if(!records || !records.length){
    return{
      totalCalls:0,
      dailyAvg:0,
      activeTenants:0,
      totalConnectors:0
    }
  }

  const totalCalls = records.reduce((s,r)=>s+Number(r.calls||0),0)

  const tenants = new Set(records.map(r=>r.tenantName||r.oid))
  const connectors = new Set(records.map(r=>r.connector))
  const dates = new Set(records.map(r=>r.date))

  return{
    totalCalls,
    dailyAvg: dates.size ? Math.round(totalCalls/dates.size) : 0,
    activeTenants:tenants.size,
    totalConnectors:connectors.size
  }

}

export function getDateRange(records){

  if(!records || !records.length) return {min:null,max:null}

  const dates = records
    .filter(r=>r.date)
    .map(r=>r.date)
    .sort()

  return{
    min:dates[0] || null,
    max:dates[dates.length-1] || null
  }

}

export function getDailyTrend(records){

  if(!records || !records.length) return []

  const map={}

  records.forEach(r=>{
    if(!r || !r.date) return
    map[r.date]=(map[r.date]||0)+Number(r.calls||0)
  })

  return Object.keys(map)
    .sort()
    .map(d=>({date:d,calls:map[d]}))

}

export function getMonthlyTrend(records){

  if(!records || !records.length) return []

  const map={}

  records.forEach(r=>{

    if(!r || !r.date) return

    const month = r.date.substring(0,7)

    map[month]=(map[month]||0)+Number(r.calls||0)

  })

  return Object.keys(map)
    .sort()
    .map(m=>({month:m,calls:map[m]}))

}

export function getTopTenants(records){

  const map={}

  records.forEach(r=>{

    const key = r.tenantName || r.oid || 'Unknown'

    if(!map[key])
      map[key]={name:key,calls:0,email:r.email||''}

    map[key].calls += Number(r.calls||0)

  })

  return Object.values(map)
    .sort((a,b)=>b.calls-a.calls)

}

export function getTopConnectors(records){

  const map={}

  records.forEach(r=>{

    const key = r.connector || 'Unknown'

    map[key]=(map[key]||0)+Number(r.calls||0)

  })

  return Object.entries(map)
    .map(([name,calls])=>({name,calls}))
    .sort((a,b)=>b.calls-a.calls)

}

export function getConnectorByTenant(records){

  const map={}

  records.forEach(r=>{

    const tenant=r.tenantName||r.oid||'Unknown'
    const connector=r.connector||'Unknown'

    if(!map[tenant]) map[tenant]={}

    map[tenant][connector]=(map[tenant][connector]||0)+Number(r.calls||0)

  })

  return Object.keys(map).map(tenant=>({

    tenant,

    connectors:Object.entries(map[tenant])
      .map(([name,calls])=>({name,calls}))
      .sort((a,b)=>b.calls-a.calls)

  }))

}

export function getHeatmapData(records){

  if(!records || !records.length) return {tenants:[],dates:[],matrix:{}}

  const tenants=[...new Set(records.map(r=>r.tenantName||r.oid||'Unknown'))]
  const dates=[...new Set(records.map(r=>r.date))].sort()

  const matrix={}

  records.forEach(r=>{

    const tenant=r.tenantName||r.oid||'Unknown'
    const key=`${tenant}||${r.date}`

    matrix[key]=(matrix[key]||0)+Number(r.calls||0)

  })

  return{
    tenants,
    dates,
    matrix
  }

}

export function getDayOfWeekAvg(records){

  if(!records || !records.length) return []

  const days={
    0:{name:'Sun',total:0,count:0},
    1:{name:'Mon',total:0,count:0},
    2:{name:'Tue',total:0,count:0},
    3:{name:'Wed',total:0,count:0},
    4:{name:'Thu',total:0,count:0},
    5:{name:'Fri',total:0,count:0},
    6:{name:'Sat',total:0,count:0}
  }

  records.forEach(r=>{

    if(!r || !r.date) return

    const d=new Date(r.date+'T00:00:00')
    if(isNaN(d)) return

    const day=d.getDay()

    days[day].total+=Number(r.calls||0)
    days[day].count+=1

  })

  return Object.values(days).map(d=>({
    day:d.name,
    calls:d.count?Math.round(d.total/d.count):0
  }))

}

export function detectSpikes(records){

  if(!records || !records.length) return []

  const daily={}

  records.forEach(r=>{
    if(!r || !r.date) return
    daily[r.date]=(daily[r.date]||0)+Number(r.calls||0)
  })

  const values=Object.values(daily)

  if(!values.length) return []

  const mean=values.reduce((s,v)=>s+v,0)/values.length
  const variance=values.reduce((s,v)=>s+Math.pow(v-mean,2),0)/values.length
  const stdDev=Math.sqrt(variance)

  return Object.entries(daily)
    .filter(([date,calls])=>calls>mean+2.5*stdDev)
    .map(([date,calls])=>({date,calls}))

}

export function segmentTenants(records){

  if(!records || !records.length) return []

  const tenantMap={}

  records.forEach(r=>{

    const key=r.tenantName||r.oid||'Unknown'

    if(!tenantMap[key])
      tenantMap[key]={name:key,calls:0}

    tenantMap[key].calls+=Number(r.calls||0)

  })

  return Object.values(tenantMap).map(t=>{

    let segment='Low'

    if(t.calls>100000) segment='High'
    else if(t.calls>10000) segment='Medium'

    return{
      name:t.name,
      calls:t.calls,
      segment
    }

  })

}

export function getActiveTenants(records){

  if(!records || !records.length) return []

  const map={}

  records.forEach(r=>{

    const key=r.tenantName||r.oid||'Unknown'

    if(!map[key])
      map[key]={name:key,email:r.email||'',calls:0}

    map[key].calls+=Number(r.calls||0)

  })

  return Object.values(map)
    .sort((a,b)=>b.calls-a.calls)

}

export function getUniqueTenants(records){

  if(!records || !records.length) return []

  const set=new Set()

  records.forEach(r=>{
    const name=r.tenantName||r.oid||'Unknown'
    set.add(name)
  })

  return Array.from(set).sort()

}

export function getUniqueConnectors(records){

  if(!records || !records.length) return []

  const set=new Set()

  records.forEach(r=>{
    const connector=r.connector||'Unknown'
    set.add(connector)
  })

  return Array.from(set).sort()

}

export function getHourlyTrend(records){

  if(!records || !records.length) return []

  const hours = {}

  for(let i=0;i<24;i++){
    hours[i] = 0
  }

  records.forEach(r => {

    if(!r || !r.date) return

    const d = new Date(r.date + "T00:00:00")

    if(isNaN(d)) return

    const hour = d.getHours()

    hours[hour] = (hours[hour] || 0) + (r.calls || 0)

  })

  return Object.keys(hours).map(h => ({
    hour: `${h}:00`,
    calls: hours[h]
  }))

}
export function parseExcelFile(file){
  return processExcelFile(file)
}

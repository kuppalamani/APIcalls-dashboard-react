// src/utils/demoData.js
// Generates realistic demo data when no file is uploaded

export const generateDemoData = () => {
  const tenants = ['Acme Corp', 'Globex Inc', 'Initech', 'Umbrella Ltd', 'Massive Dyn',
    'Soylent Co', 'Buy N Large', 'Vault-Tec', 'Cyberdyne', 'Weyland-Yutani'];
  const connectors = ['Salesforce CRM', 'HubSpot', 'Stripe Payments', 'SendGrid Email',
    'Twilio SMS', 'Slack Notify', 'Jira Tickets', 'AWS S3', 'Google Analytics'];
  const emails = tenants.map(t => `admin@${t.toLowerCase().replace(/\s+/g, '').replace('.', '')}.com`);
  const oids = tenants.map((_, i) => `OID${10000 + i}`);

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 89);

  const dates = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  const data = [];
  const seeded = mulberry32(42);

  tenants.forEach((tenant, i) => {
    const nConns = 2 + Math.floor(seeded() * 3);
    const shuffled = [...connectors].sort(() => seeded() - 0.5);
    const chosen = shuffled.slice(0, nConns);

    chosen.forEach(connector => {
      const base = 50 + Math.floor(seeded() * 450);
      const trend = (seeded() - 0.3) * 1.5;

      dates.forEach((d, j) => {
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const weekdayFactor = isWeekend ? 0.25 : 1.0;
        const seasonal = base * (1 + trend * j / 100);
        const noise = (seeded() - 0.5) * base * 0.25;
        const spike = seeded() < 0.02 ? base * (2 + seeded() * 3) : 0;
        const calls = Math.max(0, Math.round(seasonal * weekdayFactor + noise + spike));

        const dateStr = d.toISOString().split('T')[0];
        data.push({
          'Tenant Name': tenant,
          'Connector Name': connector,
          'OID': oids[i],
          'Customer Email': emails[i],
          Date: d,
          DateStr: dateStr,
          Month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          DayOfWeek: d.toLocaleDateString('en-US', { weekday: 'long' }),
          'API Calls': calls,
        });
      });
    });
  });

  return data;
};

// Deterministic seeded RNG
function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

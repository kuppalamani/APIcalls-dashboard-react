// src/components/Heatmap.jsx
import React from 'react';

const lerp = (a, b, t) => a + (b - a) * t;
const colorScale = (val, max) => {
  if (max === 0) return '#0d1526';
  const t = Math.min(val / max, 1);
  if (t < 0.25) return `rgb(${Math.round(lerp(13,30,t/0.25))},${Math.round(lerp(21,58,t/0.25))},${Math.round(lerp(38,95,t/0.25))})`;
  if (t < 0.5) return `rgb(${Math.round(lerp(30,29,( t-0.25)/0.25))},${Math.round(lerp(58,78,(t-0.25)/0.25))},${Math.round(lerp(95,216,(t-0.25)/0.25))})`;
  if (t < 0.75) return `rgb(${Math.round(lerp(29,0,(t-0.5)/0.25))},${Math.round(lerp(78,229,(t-0.5)/0.25))},${Math.round(lerp(216,255,(t-0.5)/0.25))})`;
  return `rgb(${Math.round(lerp(0,248,(t-0.75)/0.25))},${Math.round(lerp(229,113,(t-0.75)/0.25))},${Math.round(lerp(255,113,(t-0.75)/0.25))})`;
};

export default function Heatmap({ data }) {
  const { tenants, dates, matrix } = data;
  if (!tenants.length || !dates.length) return null;

  const maxVal = Math.max(...tenants.flatMap(t => dates.map(d => matrix[`${t}||${d}`] || 0)));
  const [tooltip, setTooltip] = React.useState(null);

  return (
    <div style={{ overflowX: 'auto', position: 'relative' }}>
      <div style={{ display: 'flex', minWidth: 'max-content' }}>
        {/* Y-axis labels */}
        <div style={{ display: 'flex', flexDirection: 'column', marginRight: 8 }}>
          <div style={{ height: 20 }} />
          {tenants.map(t => (
            <div key={t} style={{
              height: 22, display: 'flex', alignItems: 'center',
              fontSize: 10, color: '#64748b', whiteSpace: 'nowrap',
              paddingRight: 8, width: 120, overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{t}</div>
          ))}
        </div>

        {/* Grid */}
        <div>
          {/* X-axis labels */}
          <div style={{ display: 'flex', marginBottom: 2 }}>
            {dates.map((d, i) => (
              <div key={d} style={{
                width: 18, height: 20, fontSize: 8, color: '#334155',
                writingMode: 'vertical-rl', textAlign: 'right',
                overflow: 'hidden',
                display: i % 7 === 0 ? 'block' : 'none',
              }}>{d.slice(5)}</div>
            ))}
          </div>
          {/* Cells */}
          {tenants.map(tenant => (
            <div key={tenant} style={{ display: 'flex', marginBottom: 2 }}>
              {dates.map(date => {
                const val = matrix[`${tenant}||${date}`] || 0;
                const bg = colorScale(val, maxVal);
                return (
                  <div
                    key={date}
                    style={{ width: 18, height: 18, borderRadius: 2, background: bg, marginRight: 2, cursor: 'pointer', flexShrink: 0 }}
                    onMouseEnter={e => setTooltip({ tenant, date, val, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 10, zIndex: 9999,
          background: '#0d1526', border: '1px solid #1e293b', borderRadius: 8,
          padding: '8px 12px', fontSize: 11, pointerEvents: 'none',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}>
          <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{tooltip.tenant}</div>
          <div style={{ color: '#64748b', marginTop: 2 }}>{tooltip.date}</div>
          <div style={{ color: '#00e5ff', fontFamily: 'JetBrains Mono', marginTop: 4 }}>
            {tooltip.val.toLocaleString()} calls
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
        <span style={{ fontSize: 9, color: '#334155' }}>Low</span>
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <div key={t} style={{ width: 20, height: 8, borderRadius: 2, background: colorScale(t * maxVal, maxVal) }} />
        ))}
        <span style={{ fontSize: 9, color: '#334155' }}>High</span>
      </div>
    </div>
  );
}

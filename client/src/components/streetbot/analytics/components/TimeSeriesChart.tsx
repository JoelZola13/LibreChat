// Tiny dependency-free area chart. SVG, scales to its container.
// We don't pull in recharts/d3 — this is a viewer, not a charting library.
//
// Style notes: every visual style is inline so the chart renders the same
// regardless of which Tailwind theme is or isn't applied to the route.

import * as React from 'react';
import { formatNumber, formatDay } from '../lib/format';

interface Series {
  key:    string;
  label:  string;
  color:  string;
  values: { day: string; value: number }[];
}

interface Props {
  series: Series[];
  height?: number;
  showLegend?: boolean;
}

export function TimeSeriesChart({ series, height = 240, showLegend = true }: Props) {
  const days = uniqueDaysAcross(series);
  const max  = series.reduce(
    (m, s) => Math.max(m, ...s.values.map(v => v.value)), 0
  ) || 1;
  const w     = 800;
  const padL  = 44;   // room for left axis labels
  const padR  = 16;
  const padT  = 14;
  const padB  = 26;   // room for date labels
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;
  const stepX  = days.length > 1 ? innerW / (days.length - 1) : innerW;

  // Y-axis ticks (5 lines incl. 0)
  const tickCount = 4;
  const niceMax   = niceCeil(max);
  const ticks     = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((niceMax / tickCount) * i)
  );

  // X-axis labels — only every ~5th day to avoid overlap
  const labelStep = Math.max(1, Math.ceil(days.length / 7));

  const empty = days.length === 0 || series.length === 0;

  return (
    <div style={{ width: '100%' }}>
      {empty ? (
        <div style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--sv-grey-1, #6b7280)',
          fontSize: 16,
        }}>
          No data in window.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${w} ${height}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height, display: 'block' }}
        >
          {/* Y grid + labels */}
          {ticks.map((t, i) => {
            const y = padT + innerH - (t / niceMax) * innerH;
            return (
              <g key={`grid-${i}`}>
                <line
                  x1={padL} y1={y} x2={w - padR} y2={y}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={padL - 8} y={y + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill="#6b7280"
                  fontFamily="Rubik, system-ui, sans-serif"
                >
                  {formatNumber(t)}
                </text>
              </g>
            );
          })}

          {/* Series — area fill + stroke */}
          {series.map((s) => {
            const points = days.map((d, i) => {
              const v = s.values.find(p => p.day === d)?.value ?? 0;
              const x = padL + i * stepX;
              const y = padT + innerH - (v / niceMax) * innerH;
              return [x, y] as const;
            });
            if (points.length === 0) return null;
            const linePath = points
              .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
              .join(' ');
            const lastX  = points[points.length - 1][0];
            const firstX = points[0][0];
            const baseY  = padT + innerH;
            const areaPath = `${linePath} L ${lastX.toFixed(1)} ${baseY} L ${firstX.toFixed(1)} ${baseY} Z`;
            return (
              <g key={s.key}>
                <path d={areaPath} fill={s.color} opacity={0.18} />
                <path
                  d={linePath}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.25}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {/* dots on each point — only if not too many days */}
                {days.length <= 14
                  ? points.map(([x, y], i) => (
                      <circle key={i} cx={x} cy={y} r={3} fill={s.color} />
                    ))
                  : null}
              </g>
            );
          })}

          {/* X-axis labels */}
          {days.map((d, i) => {
            if (i % labelStep !== 0 && i !== days.length - 1) return null;
            return (
              <text
                key={d}
                x={padL + i * stepX}
                y={height - 6}
                textAnchor="middle"
                fontSize={11}
                fill="#6b7280"
                fontFamily="Rubik, system-ui, sans-serif"
              >
                {formatDay(d)}
              </text>
            );
          })}
        </svg>
      )}

      {showLegend && !empty ? (
        <div style={{
          marginTop: 12,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          fontSize: 13,
          fontFamily: 'Rubik, system-ui, sans-serif',
        }}>
          {series.map((s) => {
            const total = s.values.reduce((sum, v) => sum + v.value, 0);
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: s.color,
                }} />
                <span style={{ color: 'var(--sv-grey-1, #6b7280)', fontWeight: 600 }}>
                  {s.label}
                </span>
                <span style={{ color: 'var(--sv-black, #111315)', fontWeight: 700 }}>
                  {formatNumber(total)}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function uniqueDaysAcross(series: Series[]): string[] {
  const set = new Set<string>();
  for (const s of series) for (const v of s.values) set.add(v.day);
  return Array.from(set).sort();
}

// Round max up to a "nice" axis ceiling (powers of 1, 2, 5).
function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const exp  = Math.floor(Math.log10(n));
  const base = Math.pow(10, exp);
  const mant = n / base;
  let nice: number;
  if (mant <= 1)      nice = 1;
  else if (mant <= 2) nice = 2;
  else if (mant <= 5) nice = 5;
  else                nice = 10;
  return nice * base;
}

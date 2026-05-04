// Retention heatmap. Rows = cohort weeks, cols = week_offset, cells colored
// by retained / cohort_size.

import * as React from 'react';
import { formatPercent, formatDay } from '../lib/format';

export interface RetentionRow {
  cohort_week:    string;
  week_offset:    number;
  cohort_size:    number;
  retained:       number;
}

export function RetentionGrid({ rows }: { rows: RetentionRow[] }) {
  const cohorts = Array.from(new Set(rows.map(r => r.cohort_week))).sort().reverse();
  const offsets = Array.from(new Set(rows.map(r => r.week_offset))).sort((a, b) => a - b);
  const lookup  = new Map<string, RetentionRow>();
  for (const r of rows) lookup.set(`${r.cohort_week}:${r.week_offset}`, r);

  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left text-text-secondary">Cohort</th>
            <th className="px-2 py-1 text-left text-text-secondary">Size</th>
            {offsets.map(o => (
              <th key={o} className="px-2 py-1 text-center text-text-secondary">W+{o}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map(week => {
            const head = lookup.get(`${week}:0`);
            return (
              <tr key={week}>
                <td className="px-2 py-1 text-text-primary whitespace-nowrap">{formatDay(week)}</td>
                <td className="px-2 py-1 text-text-secondary">{head?.cohort_size ?? '—'}</td>
                {offsets.map(o => {
                  const r = lookup.get(`${week}:${o}`);
                  if (!r) return <td key={o} className="px-1 py-1" />;
                  const ratio = r.cohort_size ? r.retained / r.cohort_size : 0;
                  const bg = `rgba(59, 130, 246, ${Math.max(0.06, Math.min(0.85, ratio))})`;
                  return (
                    <td key={o} className="p-0">
                      <div className="px-2 py-1 text-center"
                           style={{ background: bg, color: ratio > 0.4 ? 'white' : 'inherit' }}>
                        {formatPercent(ratio * 100)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

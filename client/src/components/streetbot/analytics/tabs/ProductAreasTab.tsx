import * as React from 'react';
import { api } from '../lib/api';
import { formatNumber, formatMs } from '../lib/format';

export function ProductAreasTab() {
  const [rows, setRows] = React.useState<any[]>([]);
  const [days, setDays] = React.useState(28);

  React.useEffect(() => {
    let alive = true;
    api.productAreas(days).then((d) => alive && setRows(d.product_areas));
    return () => { alive = false; };
  }, [days]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <label className="text-sm text-text-secondary">Window:</label>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
                className="px-2 py-1 text-sm bg-surface-primary border border-border-light rounded-md">
          {[7, 28, 90].map(n => <option key={n} value={n}>{n}d</option>)}
        </select>
      </div>
      <div className="rounded-lg border border-border-light bg-surface-primary overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-text-secondary">
            <tr>
              <th className="px-3 py-2 text-left">Product area</th>
              <th className="px-3 py-2 text-right">Active users</th>
              <th className="px-3 py-2 text-right">Activations</th>
              <th className="px-3 py-2 text-right">Conversions</th>
              <th className="px-3 py-2 text-right">Page views</th>
              <th className="px-3 py-2 text-right">Avg active time</th>
              <th className="px-3 py-2 text-right">Errors</th>
              <th className="px-3 py-2 text-right">Quality</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {rows.map((r) => (
              <tr key={r.product_area} className="hover:bg-surface-tertiary/40">
                <td className="px-3 py-2 text-text-primary font-medium">{r.product_area}</td>
                <td className="px-3 py-2 text-right">{formatNumber(r.active_users)}</td>
                <td className="px-3 py-2 text-right">{formatNumber(r.activations)}</td>
                <td className="px-3 py-2 text-right">{formatNumber(r.conversions)}</td>
                <td className="px-3 py-2 text-right">{formatNumber(r.page_views)}</td>
                <td className="px-3 py-2 text-right">{formatMs(r.avg_active_time_ms)}</td>
                <td className="px-3 py-2 text-right text-rose-400">{formatNumber(r.errors)}</td>
                <td className="px-3 py-2 text-right">{r.event_quality_score ?? 100}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

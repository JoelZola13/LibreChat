import * as React from 'react';
import { api } from '../lib/api';
import { formatMs, formatNumber } from '../lib/format';

export function JourneysTab() {
  const [rows, setRows] = React.useState<any[]>([]);
  const [days, setDays] = React.useState(7);

  React.useEffect(() => {
    let alive = true;
    api.journeys(days).then((d) => alive && setRows(d.journeys));
    return () => { alive = false; };
  }, [days]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm text-text-secondary">Window:</label>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
                className="px-2 py-1 text-sm bg-surface-primary border border-border-light rounded-md">
          {[1, 7, 28, 90].map(n => <option key={n} value={n}>{n}d</option>)}
        </select>
      </div>

      <div className="rounded-lg border border-border-light bg-surface-primary overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-text-secondary">
            <tr>
              <th className="px-3 py-2 text-left">Entry</th>
              <th className="px-3 py-2 text-left">Exit</th>
              <th className="px-3 py-2 text-right">Sessions</th>
              <th className="px-3 py-2 text-right">Avg pages</th>
              <th className="px-3 py-2 text-right">Avg active time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-surface-tertiary/40">
                <td className="px-3 py-2 font-mono text-xs">{r.entry_route_pattern ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.exit_route_pattern ?? '—'}</td>
                <td className="px-3 py-2 text-right">{formatNumber(r.sessions)}</td>
                <td className="px-3 py-2 text-right">{r.avg_pages ?? '—'}</td>
                <td className="px-3 py-2 text-right">{formatMs(r.avg_active_ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import * as React from 'react';
import { api } from '../lib/api';
import { MetricCard } from '../components/MetricCard';
import { formatRelativeTime, formatPercent } from '../lib/format';

export function StreetProfilesTab() {
  const [profiles, setProfiles] = React.useState<any[]>([]);
  const [needsNudge, setNeedsNudge] = React.useState(false);
  const [sort, setSort] = React.useState<'completeness' | 'views' | 'last_seen' | 'active'>('completeness');
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    api.profiles({ sort, needs_nudge: needsNudge, limit: 100 })
       .then((d) => alive && setProfiles(d.profiles), (e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [sort, needsNudge]);

  const aggregates = React.useMemo(() => {
    if (profiles.length === 0) return null;
    const activated = profiles.filter(p => p.is_activated).length;
    const retained  = profiles.filter(p => p.is_retained_7d).length;
    const avgComplete = profiles.reduce((s, p) => s + (p.completeness ?? 0), 0) / profiles.length;
    const crossArea = profiles.filter(p => (p.cross_area_count_7d ?? 0) >= 2).length;
    return { activated, retained, avgComplete, crossArea };
  }, [profiles]);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex gap-2">
          <select value={sort} onChange={(e) => setSort(e.target.value as any)}
                  className="px-2 py-1 text-sm bg-surface-primary border border-border-light rounded-md">
            <option value="completeness">Sort: completeness</option>
            <option value="views">Sort: profile views (7d)</option>
            <option value="last_seen">Sort: last seen</option>
            <option value="active">Sort: activation</option>
          </select>
          <label className="flex items-center gap-1 text-sm text-text-secondary">
            <input type="checkbox" checked={needsNudge} onChange={(e) => setNeedsNudge(e.target.checked)} />
            Needs nudge
          </label>
        </div>
      </div>

      {aggregates ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Profiles in view" value={profiles.length} />
          <MetricCard label="Activated"        value={aggregates.activated} hint={`${formatPercent((aggregates.activated / profiles.length) * 100)} of view`} intent="positive" />
          <MetricCard label="Avg completeness" value={`${Math.round(aggregates.avgComplete)}%`} />
          <MetricCard label="Cross-area 7d"    value={aggregates.crossArea} hint="active in 2+ areas" />
        </div>
      ) : null}

      {err ? <div className="text-sm text-rose-500">{err}</div> : null}

      <div className="rounded-lg border border-border-light bg-surface-primary overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-text-secondary">
            <tr>
              <th className="px-3 py-2 text-left">Profile</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-right">Completeness</th>
              <th className="px-3 py-2 text-right">Views 7d</th>
              <th className="px-3 py-2 text-right">CTAs</th>
              <th className="px-3 py-2 text-right">Cross-area 7d</th>
              <th className="px-3 py-2 text-left">First activated</th>
              <th className="px-3 py-2 text-left">Last seen</th>
              <th className="px-3 py-2 text-left">Nudge?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {profiles.map((p) => (
              <tr key={p.street_profile_id} className="hover:bg-surface-tertiary/40">
                <td className="px-3 py-2 font-mono text-xs text-text-primary truncate max-w-[180px]">{p.street_profile_id}</td>
                <td className="px-3 py-2 text-text-secondary">{p.profile_role ?? 'unknown'}</td>
                <td className="px-3 py-2 text-right">{p.completeness ?? 0}%</td>
                <td className="px-3 py-2 text-right">{p.profile_views_7d ?? 0}</td>
                <td className="px-3 py-2 text-right">{p.cta_clicks ?? 0}</td>
                <td className="px-3 py-2 text-right">{p.cross_area_count_7d ?? 0}</td>
                <td className="px-3 py-2 text-text-secondary">{p.first_activated_area ?? '—'}</td>
                <td className="px-3 py-2 text-text-secondary">{formatRelativeTime(p.last_seen_at)}</td>
                <td className="px-3 py-2 text-text-secondary">{p.needs_nudge ? p.nudge_reason ?? 'yes' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

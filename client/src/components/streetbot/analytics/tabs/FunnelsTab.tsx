import * as React from 'react';
import { api } from '../lib/api';
import { FunnelChart, type FunnelStep } from '../components/FunnelChart';
import { formatDay } from '../lib/format';

const FUNNELS: { key: string; label: string }[] = [
  { key: 'new_user_activation',     label: 'New user activation' },
  { key: 'street_profile_activation', label: 'Street Profile activation' },
  { key: 'directory_impact',        label: 'Directory impact' },
  { key: 'job_seeker',              label: 'Job seeker' },
  { key: 'employer',                label: 'Employer' },
  { key: 'artist',                  label: 'Artist' },
  { key: 'learner',                 label: 'Learner' },
  { key: 'community_connection',    label: 'Community connection' },
  { key: 'ai_service_referral',     label: 'AI service referral' },
];

export function FunnelsTab() {
  const [active, setActive] = React.useState(FUNNELS[0].key);
  const [data, setData] = React.useState<any>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setData(null);
    api.funnel(active).then((d) => alive && setData(d), (e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [active]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FUNNELS.map((f) => (
          <button key={f.key} onClick={() => setActive(f.key)}
                  className={[
                    'px-3 py-1.5 rounded-md text-sm border',
                    f.key === active
                      ? 'bg-blue-500/15 border-blue-500/40 text-text-primary'
                      : 'border-border-light text-text-secondary hover:bg-surface-tertiary',
                  ].join(' ')}>
            {f.label}
          </button>
        ))}
      </div>

      {err ? <div className="text-sm text-rose-500">{err}</div> : null}

      {data?.snapshot ? (
        <>
          <div className="text-xs text-text-secondary">
            Cohort {formatDay(data.snapshot.cohort_window_start)} – {formatDay(data.snapshot.cohort_window_end)} ·
            cohort size {data.snapshot.cohort_size} · computed {formatDay(data.snapshot.computed_at)}
          </div>
          <FunnelChart cohortSize={data.snapshot.cohort_size} steps={data.snapshot.steps as FunnelStep[]} />
        </>
      ) : data ? (
        <div className="text-sm text-text-secondary">
          No snapshot yet for this funnel. Snapshots are computed nightly.
        </div>
      ) : (
        <div className="text-sm text-text-secondary">Loading…</div>
      )}
    </div>
  );
}

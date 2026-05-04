import * as React from 'react';
import { api } from '../lib/api';
import { RetentionGrid, type RetentionRow } from '../components/RetentionGrid';

const COHORTS = [
  { key: 'all',                   label: 'All users' },
  { key: 'profile_complete',      label: 'Street Profile complete' },
  { key: 'gallery_uploader',      label: 'Gallery uploaders' },
  { key: 'job_applicant',         label: 'Job applicants' },
  { key: 'employer',              label: 'Employers' },
  { key: 'academy_enrolled',      label: 'Academy enrollees' },
  { key: 'directory_action_user', label: 'Directory action users' },
  { key: 'message_sender',        label: 'Message senders' },
  { key: 'ai_user',               label: 'AI users' },
];

const AREAS = [
  { key: '_all', label: 'All product areas' },
  { key: 'street_profile', label: 'Street Profile' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'directory', label: 'Directory' },
  { key: 'academy', label: 'Academy' },
  { key: 'messages', label: 'Messages' },
  { key: 'ai', label: 'AI' },
];

export function RetentionTab() {
  const [cohort, setCohort] = React.useState('all');
  const [area, setArea]     = React.useState('_all');
  const [rows, setRows]     = React.useState<RetentionRow[]>([]);
  const [err, setErr]       = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    api.retention(cohort, area).then((d) => alive && setRows(d.rows as RetentionRow[]), (e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [cohort, area]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <select value={cohort} onChange={(e) => setCohort(e.target.value)}
                className="px-2 py-1 text-sm bg-surface-primary border border-border-light rounded-md">
          {COHORTS.map(c => <option key={c.key} value={c.key}>Cohort: {c.label}</option>)}
        </select>
        <select value={area} onChange={(e) => setArea(e.target.value)}
                className="px-2 py-1 text-sm bg-surface-primary border border-border-light rounded-md">
          {AREAS.map(a => <option key={a.key} value={a.key}>Area: {a.label}</option>)}
        </select>
      </div>

      {err ? <div className="text-sm text-rose-500">{err}</div> : null}

      <div className="rounded-lg border border-border-light p-3 bg-surface-primary">
        {rows.length === 0
          ? <div className="text-sm text-text-secondary">No retention data for this slice yet.</div>
          : <RetentionGrid rows={rows} />}
      </div>

      <div className="text-xs text-text-secondary">
        Cells colored by retained / cohort_size. <code>retained</code> means the user took a meaningful action
        in the offset week. Use the cohort/area selectors to slice.
      </div>
    </div>
  );
}

// Case Management section dashboard.
// Question: are case workers staying on top of cases, completing
// follow-up tasks, and using AI summaries effectively?
//
// NOTE: this product area is "operational" — events here may carry
// hashed case IDs but no PII. Display uses aggregate counts only.

import * as React from 'react';
import { MetricCard, BigNumberTriple } from '../../components/MetricCard';
import { SectionTitle } from '../../components/SectionTitle';
import { TimeSeriesChart } from '../../components/TimeSeriesChart';
import { formatNumber, formatPercent } from '../../lib/format';

interface CasePayload {
  cards: {
    views_7d: number; views_28d: number;
    opens_7d: number; opens_28d: number;
    tasks_created_28d: number; tasks_completed_28d: number;
    ai_summaries_7d: number; ai_summaries_28d: number;
    exports_28d: number; active_workers_7d: number; unique_cases_7d: number;
    task_completion: number; ai_share: number; tasks_per_open: number;
  };
  by_view_mode:   { view_mode: string; n: number }[];
  by_role:        { role: string; n: number }[];
  by_open_source: { source: string; n: number }[];
  by_task_type:   { task_type: string; created: number; completed: number }[];
  by_export_type: { export_type: string; n: number }[];
  by_ai_source:   { source: string; n: number }[];
  daily: { day: string; opens: number; tasks_created: number; tasks_completed: number; ai_summaries: number }[];
}

const TASK_COLORS: Record<string, string> = {
  follow_up: '#FFD600',
  document_request: '#3B82F6',
  referral: '#A78BFA',
  intake: '#34D399',
  assessment: '#F59E0B',
  closure: '#FB7185',
};

function pretty(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function CaseManagementSection() {
  const [data, setData] = React.useState<CasePayload | null>(null);
  const [err,  setErr]  = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch('/api/analytics/query/section/case-management', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((d: CasePayload) => alive && setData(d))
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, []);

  if (err)   return <div className="sv-spinner" style={{ color: 'rgb(190, 18, 60)' }}>Error: {err}</div>;
  if (!data) return <div className="sv-spinner">Loading…</div>;

  const c = data.cards;
  const completionIntent: 'positive' | 'neutral' | 'warn' =
    c.task_completion >= 0.70 ? 'positive' : c.task_completion >= 0.50 ? 'neutral' : 'warn';
  const aiIntent: 'positive' | 'neutral' | 'warn' =
    c.ai_share >= 0.20 ? 'positive' : c.ai_share >= 0.10 ? 'neutral' : 'warn';

  const totalView    = data.by_view_mode.reduce((s, r) => s + r.n, 0) || 1;
  const totalRole    = data.by_role.reduce((s, r) => s + r.n, 0) || 1;
  const totalSource  = data.by_open_source.reduce((s, r) => s + r.n, 0) || 1;
  const totalExport  = data.by_export_type.reduce((s, r) => s + r.n, 0) || 1;
  const totalAiSrc   = data.by_ai_source.reduce((s, r) => s + r.n, 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280, margin: '0 auto' }}>
      <div>
        <span className="sv-datecap">SECTION ANALYTICS · LAST 7 DAYS</span>
        <h1 className="sv-h1" style={{ marginTop: 6 }}>Case Management</h1>
        <p style={{ color: 'var(--sv-grey-1)', marginTop: 10, fontSize: 19, lineHeight: 1.55, maxWidth: 820 }}>
          Are case workers staying on top of cases, completing follow-up
          tasks, and using AI summaries effectively? This view tracks case
          activity, task throughput by type, and AI summary adoption.
          Aggregate counts only — no case IDs or PII surface in this view.
        </p>
      </div>

      <div className="sv-card sv-card--padded">
        <SectionTitle right={<span className="sv-pill sv-pill--soft">7-day window</span>}>
          This Week
        </SectionTitle>
        <BigNumberTriple items={[
          { label: 'CASES TOUCHED',  value: c.unique_cases_7d, sub: `${formatNumber(c.opens_7d)} opens this week` },
          { label: 'ACTIVE WORKERS', value: c.active_workers_7d, sub: `${formatNumber(c.views_7d)} dashboard loads` },
          { label: 'AI SUMMARIES',   value: c.ai_summaries_28d, sub: `${formatNumber(c.ai_summaries_7d)} this week` },
        ]} />
      </div>

      <div>
        <SectionTitle>Workflow Health</SectionTitle>
        <div className="sv-grid-4">
          <MetricCard label="TASK COMPLETION" value={formatPercent(c.task_completion * 100)} icon="✅" intent={completionIntent}
                      hint={`${formatNumber(c.tasks_completed_28d)} / ${formatNumber(c.tasks_created_28d)} tasks (28d)`} />
          <MetricCard label="TASKS PER OPEN" value={c.tasks_per_open.toFixed(2)} icon="📋"
                      hint={`${formatNumber(c.tasks_created_28d)} tasks / ${formatNumber(c.opens_28d)} opens`} />
          <MetricCard label="AI SUMMARY USAGE" value={formatPercent(c.ai_share * 100)} icon="🤖" intent={aiIntent}
                      hint={`${formatNumber(c.ai_summaries_28d)} / ${formatNumber(c.opens_28d)} opens`} />
          <MetricCard label="EXPORTS 28D" value={c.exports_28d} icon="📤"
                      hint="exports generated" />
          <MetricCard label="OPENS 28D" value={c.opens_28d} icon="📂"
                      hint={`${formatNumber(c.opens_7d)} this week`} />
          <MetricCard label="DASHBOARD VIEWS" value={c.views_28d} icon="🏷️"
                      hint={`${formatNumber(c.views_7d)} this week`} />
          <MetricCard label="TASKS CREATED" value={c.tasks_created_28d} icon="➕"
                      hint="cumulative tasks (28d)" />
          <MetricCard label="UNIQUE CASES" value={c.unique_cases_7d} icon="📁"
                      hint="distinct cases this week" />
        </div>
      </div>

      <div className="sv-card sv-card--padded">
        <SectionTitle>Daily Activity (28 days)</SectionTitle>
        <TimeSeriesChart series={[
          { key: 'opens',           label: 'Cases opened',     color: '#FFD600',
            values: data.daily.map(d => ({ day: d.day, value: d.opens })) },
          { key: 'tasks_created',   label: 'Tasks created',    color: '#111315',
            values: data.daily.map(d => ({ day: d.day, value: d.tasks_created })) },
          { key: 'tasks_completed', label: 'Tasks completed',  color: '#34D399',
            values: data.daily.map(d => ({ day: d.day, value: d.tasks_completed })) },
          { key: 'ai_summaries',    label: 'AI summaries',     color: '#A78BFA',
            values: data.daily.map(d => ({ day: d.day, value: d.ai_summaries })) },
        ]} />
      </div>

      <div className="sv-card sv-card--padded">
        <SectionTitle>Tasks by Type (28d)</SectionTitle>
        {data.by_task_type.length === 0 ? (
          <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No tasks in window.</div>
        ) : (
          <table className="sv-table">
            <thead>
              <tr>
                <th>Task type</th>
                <th style={{textAlign:'right'}}>Created</th>
                <th style={{textAlign:'right',width:120}}>Completed</th>
                <th style={{textAlign:'right',width:140}}>Completion</th>
              </tr>
            </thead>
            <tbody>
              {data.by_task_type.map(r => {
                const completion = r.created ? r.completed / r.created : 0;
                const isLow = completion < 0.50;
                const color = TASK_COLORS[r.task_type] ?? 'var(--sv-yellow)';
                return (
                  <tr key={r.task_type}>
                    <td style={{ fontWeight: 600 }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color, marginRight: 8 }} />
                      {pretty(r.task_type)}
                    </td>
                    <td className="numeric">{r.created}</td>
                    <td className="numeric">{r.completed}</td>
                    <td className="numeric" style={{ fontWeight: 700, color: isLow ? 'rgb(190, 18, 60)' : 'rgb(5, 150, 105)' }}>
                      {formatPercent(completion * 100)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>Open Source (28d)</SectionTitle>
          {data.by_open_source.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No data.</div>
          ) : (
            <table className="sv-table">
              <thead><tr><th>Source</th><th style={{textAlign:'right'}}>Opens</th><th style={{textAlign:'right',width:160}}>Share</th></tr></thead>
              <tbody>
                {data.by_open_source.map(r => {
                  const pct = (r.n / totalSource) * 100;
                  return (
                    <tr key={r.source}>
                      <td style={{ fontWeight: 600 }}>{pretty(r.source)}</td>
                      <td className="numeric">{r.n}</td>
                      <td><div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
                        <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%` }} /></div>
                        <span style={{ fontWeight: 700, minWidth: 44 }}>{formatPercent(pct)}</span>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="sv-card sv-card--padded">
          <SectionTitle>Workers by Role (28d)</SectionTitle>
          {data.by_role.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No role data.</div>
          ) : (
            <table className="sv-table">
              <thead><tr><th>Role</th><th style={{textAlign:'right'}}>Loads</th><th style={{textAlign:'right',width:160}}>Share</th></tr></thead>
              <tbody>
                {data.by_role.map(r => {
                  const pct = (r.n / totalRole) * 100;
                  return (
                    <tr key={r.role}>
                      <td style={{ fontWeight: 600 }}>{pretty(r.role)}</td>
                      <td className="numeric">{r.n}</td>
                      <td><div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
                        <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%` }} /></div>
                        <span style={{ fontWeight: 700, minWidth: 44 }}>{formatPercent(pct)}</span>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>View Mode (28d)</SectionTitle>
          {data.by_view_mode.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No data.</div>
          ) : (
            <table className="sv-table">
              <thead><tr><th>Mode</th><th style={{textAlign:'right'}}>Loads</th><th style={{textAlign:'right',width:160}}>Share</th></tr></thead>
              <tbody>
                {data.by_view_mode.map(r => {
                  const pct = (r.n / totalView) * 100;
                  return (
                    <tr key={r.view_mode}>
                      <td style={{ fontWeight: 600 }}>{pretty(r.view_mode)}</td>
                      <td className="numeric">{r.n}</td>
                      <td><div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
                        <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%` }} /></div>
                        <span style={{ fontWeight: 700, minWidth: 44 }}>{formatPercent(pct)}</span>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="sv-card sv-card--padded">
          <SectionTitle>Export Format (28d)</SectionTitle>
          {data.by_export_type.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No exports.</div>
          ) : (
            <table className="sv-table">
              <thead><tr><th>Format</th><th style={{textAlign:'right'}}>Count</th><th style={{textAlign:'right',width:160}}>Share</th></tr></thead>
              <tbody>
                {data.by_export_type.map(r => {
                  const pct = (r.n / totalExport) * 100;
                  return (
                    <tr key={r.export_type}>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>.{r.export_type}</td>
                      <td className="numeric">{r.n}</td>
                      <td><div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
                        <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%` }} /></div>
                        <span style={{ fontWeight: 700, minWidth: 44 }}>{formatPercent(pct)}</span>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="sv-card sv-card--padded">
        <SectionTitle>AI Summary Trigger Source (28d)</SectionTitle>
        {data.by_ai_source.length === 0 ? (
          <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No AI summaries.</div>
        ) : (
          <table className="sv-table">
            <thead><tr><th>Source</th><th style={{textAlign:'right'}}>Count</th><th style={{textAlign:'right',width:200}}>Share</th></tr></thead>
            <tbody>
              {data.by_ai_source.map(r => {
                const pct = (r.n / totalAiSrc) * 100;
                return (
                  <tr key={r.source}>
                    <td style={{ fontWeight: 600 }}>{pretty(r.source)}</td>
                    <td className="numeric">{r.n}</td>
                    <td><div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
                      <div className="sv-bar" style={{ width: 120 }}><span style={{ width: `${pct}%`, background: '#A78BFA' }} /></div>
                      <span style={{ fontWeight: 700, minWidth: 44 }}>{formatPercent(pct)}</span>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

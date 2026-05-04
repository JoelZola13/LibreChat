// Calendar section dashboard.
// Question: are people creating events, attaching reminders, and
// connecting external calendars?

import * as React from 'react';
import { MetricCard, BigNumberTriple } from '../../components/MetricCard';
import { SectionTitle } from '../../components/SectionTitle';
import { TimeSeriesChart } from '../../components/TimeSeriesChart';
import { formatNumber, formatPercent } from '../../lib/format';

interface CalendarPayload {
  cards: {
    views_7d: number; views_28d: number;
    events_created_7d: number; events_created_28d: number;
    events_updated_28d: number; tasks_scheduled_28d: number;
    externals_enabled_28d: number; reminders_28d: number;
    active_creators_7d: number;
    edit_rate: number; reminder_attach_rate: number; external_enable_rate: number;
  };
  by_view_mode:  { view_mode: string; n: number }[];
  by_event_type: { event_type: string; n: number }[];
  by_provider:   { provider: string; enabled: number; disabled: number }[];
  by_reminder:   { bucket: string; n: number }[];
  daily: { day: string; views: number; events_created: number; tasks_scheduled: number }[];
}

const PROVIDER_ICON: Record<string, string> = {
  google: '🔵',
  apple: '🍎',
  outlook: '📧',
  ical: '📅',
};

function pretty(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function CalendarSection() {
  const [data, setData] = React.useState<CalendarPayload | null>(null);
  const [err,  setErr]  = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch('/api/analytics/query/section/calendar', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((d: CalendarPayload) => alive && setData(d))
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, []);

  if (err)   return <div className="sv-spinner" style={{ color: 'rgb(190, 18, 60)' }}>Error: {err}</div>;
  if (!data) return <div className="sv-spinner">Loading…</div>;

  const c = data.cards;
  const reminderIntent: 'positive' | 'neutral' | 'warn' =
    c.reminder_attach_rate >= 0.70 ? 'positive' : c.reminder_attach_rate >= 0.40 ? 'neutral' : 'warn';
  const externalIntent: 'positive' | 'neutral' | 'warn' =
    c.external_enable_rate >= 0.70 ? 'positive' : c.external_enable_rate >= 0.40 ? 'neutral' : 'warn';

  const totalView = data.by_view_mode.reduce((s, r) => s + r.n, 0) || 1;
  const totalType = data.by_event_type.reduce((s, r) => s + r.n, 0) || 1;
  const totalReminder = data.by_reminder.reduce((s, r) => s + r.n, 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280, margin: '0 auto' }}>
      <div>
        <span className="sv-datecap">SECTION ANALYTICS · LAST 7 DAYS</span>
        <h1 className="sv-h1" style={{ marginTop: 6 }}>Calendar</h1>
        <p style={{ color: 'var(--sv-grey-1)', marginTop: 10, fontSize: 19, lineHeight: 1.55, maxWidth: 820 }}>
          Are people creating events, attaching reminders, and connecting
          external calendars? This view tracks event creation cadence, view
          mode preference, reminder attachment rate, and external-calendar
          adoption by provider.
        </p>
      </div>

      <div className="sv-card sv-card--padded">
        <SectionTitle right={<span className="sv-pill sv-pill--soft">7-day window</span>}>
          This Week
        </SectionTitle>
        <BigNumberTriple items={[
          { label: 'EVENTS CREATED',    value: c.events_created_28d, sub: `${formatNumber(c.events_created_7d)} in last 7 days` },
          { label: 'ACTIVE CREATORS',   value: c.active_creators_7d, sub: `${formatNumber(c.views_7d)} calendar views` },
          { label: 'TASKS SCHEDULED',   value: c.tasks_scheduled_28d, sub: `${formatNumber(c.reminders_28d)} reminders set` },
        ]} />
      </div>

      <div>
        <SectionTitle>Calendar Health</SectionTitle>
        <div className="sv-grid-4">
          <MetricCard label="REMINDER ATTACH RATE" value={formatPercent(c.reminder_attach_rate * 100)} icon="🔔" intent={reminderIntent}
                      hint={`${formatNumber(c.reminders_28d)} reminders / ${formatNumber(c.events_created_28d)} events`} />
          <MetricCard label="EVENT EDIT RATE" value={formatPercent(c.edit_rate * 100)} icon="✏️"
                      hint={`${formatNumber(c.events_updated_28d)} edits / ${formatNumber(c.events_created_28d)} events`} />
          <MetricCard label="EXTERNAL ENABLE RATE" value={formatPercent(c.external_enable_rate * 100)} icon="🔗" intent={externalIntent}
                      hint={`${formatNumber(c.externals_enabled_28d)} enabled toggles (28d)`} />
          <MetricCard label="VIEWS 7D" value={c.views_7d} icon="👁️"
                      hint={`${formatNumber(c.views_28d)} total this month`} />
          <MetricCard label="EVENTS 7D" value={c.events_created_7d} icon="📌"
                      hint="new events this week" />
          <MetricCard label="EVENTS UPDATED" value={c.events_updated_28d} icon="🔄"
                      hint="edits applied (28d)" />
          <MetricCard label="TASKS SCHEDULED" value={c.tasks_scheduled_28d} icon="📋"
                      hint="tasks pinned to calendar" />
          <MetricCard label="EXTERNAL TOGGLES" value={c.externals_enabled_28d} icon="🔌"
                      hint="external connections enabled" />
        </div>
      </div>

      <div className="sv-card sv-card--padded">
        <SectionTitle>Daily Activity (28 days)</SectionTitle>
        <TimeSeriesChart series={[
          { key: 'views',           label: 'Calendar views',   color: '#FFD600',
            values: data.daily.map(d => ({ day: d.day, value: d.views })) },
          { key: 'events_created',  label: 'Events created',   color: '#111315',
            values: data.daily.map(d => ({ day: d.day, value: d.events_created })) },
          { key: 'tasks_scheduled', label: 'Tasks scheduled',  color: '#A78BFA',
            values: data.daily.map(d => ({ day: d.day, value: d.tasks_scheduled })) },
        ]} />
      </div>

      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>View Mode Preference (28d)</SectionTitle>
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
          <SectionTitle>Event Types (28d)</SectionTitle>
          {data.by_event_type.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No events in window.</div>
          ) : (
            <table className="sv-table">
              <thead><tr><th>Type</th><th style={{textAlign:'right'}}>Count</th><th style={{textAlign:'right',width:160}}>Share</th></tr></thead>
              <tbody>
                {data.by_event_type.map(r => {
                  const pct = (r.n / totalType) * 100;
                  return (
                    <tr key={r.event_type}>
                      <td style={{ fontWeight: 600 }}>{pretty(r.event_type)}</td>
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
          <SectionTitle>External Calendar Connections (28d)</SectionTitle>
          {data.by_provider.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No external connections.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th style={{textAlign:'right'}}>Enabled</th>
                  <th style={{textAlign:'right',width:120}}>Disabled</th>
                  <th style={{textAlign:'right',width:140}}>Net</th>
                </tr>
              </thead>
              <tbody>
                {data.by_provider.map(r => {
                  const net = r.enabled - r.disabled;
                  return (
                    <tr key={r.provider}>
                      <td style={{ fontWeight: 600 }}>{PROVIDER_ICON[r.provider] ?? '📅'} {pretty(r.provider)}</td>
                      <td className="numeric" style={{ color: 'rgb(5, 150, 105)', fontWeight: 700 }}>+{r.enabled}</td>
                      <td className="numeric" style={{ color: 'rgb(190, 18, 60)' }}>-{r.disabled}</td>
                      <td className="numeric" style={{ fontWeight: 700, color: net >= 0 ? 'rgb(5, 150, 105)' : 'rgb(190, 18, 60)' }}>
                        {net > 0 ? '+' : ''}{net}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="sv-card sv-card--padded">
          <SectionTitle>Reminder Lead Time (28d)</SectionTitle>
          {data.by_reminder.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No reminders set.</div>
          ) : (
            <table className="sv-table">
              <thead><tr><th>Lead time</th><th style={{textAlign:'right'}}>Count</th><th style={{textAlign:'right',width:160}}>Share</th></tr></thead>
              <tbody>
                {data.by_reminder.map(r => {
                  const pct = (r.n / totalReminder) * 100;
                  return (
                    <tr key={r.bucket}>
                      <td style={{ fontWeight: 600 }}>{r.bucket}</td>
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
    </div>
  );
}

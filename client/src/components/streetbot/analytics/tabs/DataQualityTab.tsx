// Data Quality tab — schema validation, missing context, source mix, daily violations.

import * as React from 'react';
import { api } from '../lib/api';
import { MetricCard, BigNumberTriple } from '../components/MetricCard';
import { SectionTitle } from '../components/SectionTitle';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { formatNumber, formatPercent } from '../lib/format';

interface DQResponse {
  by_type:  { violation_type: string; count: number }[];
  by_event: { event_name: string | null; violation_type: string; count: number }[];
  volume: {
    events_7d: number;
    server_events: number;
    client_events: number;
    both_events: number;
    unique_events: number;
    unknown_users: number;
    missing_profile_ctx: number;
    missing_route_pattern: number;
    no_consent_events: number;
  };
  total_violations: number;
  daily: { day: string; violations: number }[];
  window_days: number;
}

const TYPE_PRETTY: Record<string, string> = {
  missing_required_property:  '🚫  Missing required prop',
  unknown_event:              '❓  Unknown event',
  invalid_type:               '🔢  Invalid type',
  disallowed_pii:             '🔒  Disallowed PII',
  replay_on_sensitive_route:  '⚠️  Replay on sensitive route',
  client_server_mismatch:     '↔️  Client/server mismatch',
  duplicate_event_id:         '♻️  Duplicate event_id',
  missing_envelope:           '✉️  Missing envelope',
};
const prettyType = (t: string) => TYPE_PRETTY[t] ?? t;

export function DataQualityTab() {
  const [data, setData] = React.useState<DQResponse | null>(null);
  const [days, setDays] = React.useState(7);
  const [err,  setErr]  = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setData(null);
    api.dataQuality(days).then(
      (d) => alive && setData(d as DQResponse),
      (e) => alive && setErr(String(e)),
    );
    return () => { alive = false; };
  }, [days]);

  if (err)  return <div className="sv-spinner" style={{ color: 'rgb(190, 18, 60)' }}>Error: {err}</div>;
  if (!data) return <div className="sv-spinner">Loading…</div>;

  const v = data.volume;
  const totalEvents = v.events_7d || 0;
  const violations  = data.total_violations;
  // Health = % of events that landed clean (no violation row tied to them).
  const healthScore = totalEvents > 0
    ? Math.max(0, Math.min(100, ((totalEvents - violations) / totalEvents) * 100))
    : 100;

  const healthIntent: 'positive' | 'neutral' | 'warn' | 'critical' =
    healthScore >= 99    ? 'positive' :
    healthScore >= 97    ? 'neutral'  :
    healthScore >= 92    ? 'warn'     : 'critical';
  const unknownIntent: 'positive' | 'warn' =
    v.unknown_users === 0 ? 'positive' : 'warn';
  const profileIntent: 'positive' | 'warn' =
    v.missing_profile_ctx === 0 ? 'positive' : 'warn';

  const totalViolByType = data.by_type.reduce((s, r) => s + r.count, 0) || 1;
  const sourceTotal = (v.server_events + v.client_events + v.both_events) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280, margin: '0 auto' }}>
      <div>
        <span className="sv-datecap">QUALITY · LAST {days} DAYS</span>
        <h1 className="sv-h1" style={{ marginTop: 6 }}>Data Quality</h1>
        <p style={{ color: 'var(--sv-grey-1)', marginTop: 10, fontSize: 19, lineHeight: 1.55, maxWidth: 820 }}>
          Are events landing with the right shape? This view tracks schema
          violations, missing Street Profile context, unknown users, and the
          balance between client-emitted and server-emitted truth events.
        </p>
      </div>

      {/* Window picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label className="sv-label">WINDOW</label>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{
          padding: '10px 14px',
          border: '1px solid var(--sv-grey-3)',
          borderRadius: 10,
          fontFamily: 'inherit', fontSize: 15,
          background: 'var(--sv-bg)', color: 'var(--sv-black)',
        }}>
          {[1, 7, 28].map(n => <option key={n} value={n}>{n}d</option>)}
        </select>
      </div>

      {/* Hero */}
      <div className="sv-card sv-card--padded">
        <SectionTitle right={<span className="sv-pill sv-pill--soft">{days}-day window</span>}>
          Quality Snapshot
        </SectionTitle>
        <BigNumberTriple items={[
          { label: 'TOTAL EVENTS',  value: totalEvents,                                 sub: `${formatNumber(v.unique_events)} unique types` },
          { label: 'VIOLATIONS',    value: violations,                                  sub: `${formatPercent((violations / Math.max(totalEvents, 1)) * 100, false)} of all events` },
          { label: 'HEALTH SCORE',  value: `${healthScore.toFixed(2)}%`,                sub: 'clean ÷ total' },
        ]} />
      </div>

      {/* Health grid */}
      <div>
        <SectionTitle>Health Indicators</SectionTitle>
        <div className="sv-grid-4">
          <MetricCard label="SERVER-ONLY"
                      value={v.server_events}
                      icon="🛡"
                      intent="positive"
                      hint="trusted truth events" />
          <MetricCard label="CLIENT-ONLY"
                      value={v.client_events}
                      icon="🌐"
                      hint="browser-emitted" />
          <MetricCard label="DEDUPED (BOTH)"
                      value={v.both_events}
                      icon="✅"
                      intent="positive"
                      hint="event_id matched" />
          <MetricCard label="HEALTH SCORE"
                      value={`${healthScore.toFixed(1)}%`}
                      icon="❤️"
                      intent={healthIntent}
                      hint="events without violations" />
          <MetricCard label="UNIQUE EVENTS"
                      value={v.unique_events}
                      icon="🏷"
                      hint="distinct event_name" />
          <MetricCard label="UNKNOWN USERS"
                      value={v.unknown_users}
                      icon="👻"
                      intent={unknownIntent}
                      hint="auth=true, no user_id" />
          <MetricCard label="MISSING PROFILE"
                      value={v.missing_profile_ctx}
                      icon="🪪"
                      intent={profileIntent}
                      hint="user_id but no street_profile_id" />
          <MetricCard label="MISSING ROUTE"
                      value={v.missing_route_pattern}
                      icon="🧭"
                      intent={v.missing_route_pattern > 0 ? 'warn' : 'positive'}
                      hint="empty route_pattern" />
        </div>
      </div>

      {/* Source mix */}
      <div className="sv-card sv-card--padded">
        <SectionTitle>Source Mix (where events came from)</SectionTitle>
        <div style={{ display: 'flex', height: 36, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
          <div title={`Client-only · ${formatNumber(v.client_events)}`}
               style={{ width: `${(v.client_events / sourceTotal) * 100}%`, background: '#FFD600', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sv-black)', fontWeight: 700, fontSize: 13 }}>
            {(v.client_events / sourceTotal) * 100 >= 8 ? `Client ${formatPercent((v.client_events / sourceTotal) * 100)}` : ''}
          </div>
          <div title={`Server-only · ${formatNumber(v.server_events)}`}
               style={{ width: `${(v.server_events / sourceTotal) * 100}%`, background: '#111315', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sv-yellow)', fontWeight: 700, fontSize: 13 }}>
            {(v.server_events / sourceTotal) * 100 >= 8 ? `Server ${formatPercent((v.server_events / sourceTotal) * 100)}` : ''}
          </div>
          <div title={`Deduped · ${formatNumber(v.both_events)}`}
               style={{ width: `${(v.both_events / sourceTotal) * 100}%`, background: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sv-black)', fontWeight: 700, fontSize: 13 }}>
            {(v.both_events / sourceTotal) * 100 >= 8 ? `Deduped ${formatPercent((v.both_events / sourceTotal) * 100)}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, fontSize: 14, color: 'var(--sv-grey-1)', flexWrap: 'wrap' }}>
          <Legend color="#FFD600" label={`Client only · ${formatNumber(v.client_events)}`} />
          <Legend color="#111315" label={`Server only · ${formatNumber(v.server_events)}`} />
          <Legend color="#9CA3AF" label={`Deduped (both) · ${formatNumber(v.both_events)}`} />
        </div>
      </div>

      {/* Daily violations chart */}
      {data.daily.length > 0 ? (
        <div className="sv-card sv-card--padded">
          <SectionTitle right={<span className="sv-pill sv-pill--soft">28-day trend</span>}>
            Daily Violations
          </SectionTitle>
          <TimeSeriesChart
            showLegend={false}
            series={[{
              key: 'violations', label: 'Violations', color: '#F43F5E',
              values: data.daily.map(d => ({ day: d.day, value: d.violations })),
            }]}
          />
        </div>
      ) : null}

      {/* Two-column: by type + by event */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>Violations by Type</SectionTitle>
          {data.by_type.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>
              No violations in window. ✨
            </div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Count</th>
                  <th style={{ textAlign: 'right', width: 160 }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {data.by_type.map((row) => {
                  const pct = (row.count / totalViolByType) * 100;
                  return (
                    <tr key={row.violation_type}>
                      <td style={{ fontWeight: 600 }}>{prettyType(row.violation_type)}</td>
                      <td className="numeric">{row.count}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <div className="sv-bar" style={{ width: 80 }}>
                            <span style={{ width: `${pct}%` }} />
                          </div>
                          <span style={{ fontWeight: 700, minWidth: 44 }}>{formatPercent(pct)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="sv-card sv-card--padded">
          <SectionTitle>Top Offending Events</SectionTitle>
          {data.by_event.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>
              No offending events.
            </div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Violation</th>
                  <th style={{ textAlign: 'right' }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {data.by_event.map((row, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 700 }}>
                      {row.event_name ?? '—'}
                    </td>
                    <td style={{ fontSize: 14, color: 'var(--sv-grey-1)' }}>
                      {prettyType(row.violation_type)}
                    </td>
                    <td className="numeric">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: color }} />
      {label}
    </span>
  );
}

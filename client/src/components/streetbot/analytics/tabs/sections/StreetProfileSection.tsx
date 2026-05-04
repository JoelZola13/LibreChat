// Street Profile section dashboard.
// Question: are people building profiles, are they getting viewed,
// and are viewers taking action?

import * as React from 'react';
import { MetricCard, BigNumberTriple } from '../../components/MetricCard';
import { SectionTitle } from '../../components/SectionTitle';
import { TimeSeriesChart } from '../../components/TimeSeriesChart';
import { formatNumber, formatPercent } from '../../lib/format';

interface ProfilePayload {
  cards: {
    dir_views_7d: number;
    create_started_7d: number;
    create_started_28d: number;
    created_7d: number;
    created_28d: number;
    views_24h: number;
    views_7d: number;
    updates_7d: number;
    active_editors_7d: number;
    ctas_7d: number;
    bookings_7d: number;
    avg_completeness: number | null;
    activation_rate: number;
    cta_per_view: number;
    owner_view_share: number;
    booking_per_view: number;
    avatar_attach_rate: number;
  };
  funnel: { dir_viewed: number; started: number; step_basics: number; step_about: number; step_portfolio: number; step_services: number; created: number }[];
  by_tab:                { tab: string; n: number }[];
  by_cta:                { cta: string; n: number }[];
  by_view_source:        { source: string; n: number }[];
  by_field_updated:      { field: string; n: number }[];
  by_completeness_delta: { bucket: string; n: number }[];
  daily:                 { day: string; viewed: number; updated: number; cta_clicks: number }[];
}

const CTA_COLORS: Record<string, string> = {
  follow:  '#FFD600',
  message: '#3B82F6',
  book:    '#34D399',
  share:   '#A78BFA',
  save:    '#F59E0B',
  website: '#9CA3AF',
};

function prettyTab(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function prettySource(s: string): string {
  const map: Record<string,string> = {
    direct_link: 'Direct link',
    notification: 'Notification',
    feed: 'Feed',
    directory: 'Directory',
    search: 'Search',
  };
  return map[s] ?? s;
}

export function StreetProfileSection() {
  const [data, setData] = React.useState<ProfilePayload | null>(null);
  const [err,  setErr]  = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch('/api/analytics/query/section/street-profile', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((d: ProfilePayload) => alive && setData(d))
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, []);

  if (err)   return <div className="sv-spinner" style={{ color: 'rgb(190, 18, 60)' }}>Error: {err}</div>;
  if (!data) return <div className="sv-spinner">Loading…</div>;

  const c = data.cards;
  const f = data.funnel?.[0];

  const activationIntent: 'positive' | 'neutral' | 'warn' =
    c.activation_rate >= 0.45 ? 'positive' : c.activation_rate >= 0.25 ? 'neutral' : 'warn';
  const ctaIntent: 'positive' | 'neutral' | 'warn' =
    c.cta_per_view >= 0.20 ? 'positive' : c.cta_per_view >= 0.10 ? 'neutral' : 'warn';
  const completenessIntent: 'positive' | 'neutral' | 'warn' =
    (c.avg_completeness ?? 0) >= 70 ? 'positive' : (c.avg_completeness ?? 0) >= 50 ? 'neutral' : 'warn';

  const totalTabs   = data.by_tab.reduce((s, r) => s + r.n, 0) || 1;
  const totalCtas   = data.by_cta.reduce((s, r) => s + r.n, 0) || 1;
  const totalSource = data.by_view_source.reduce((s, r) => s + r.n, 0) || 1;
  const totalFields = data.by_field_updated.reduce((s, r) => s + r.n, 0) || 1;
  const totalDelta  = data.by_completeness_delta.reduce((s, r) => s + r.n, 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280, margin: '0 auto' }}>
      <div>
        <span className="sv-datecap">SECTION ANALYTICS · LAST 7 DAYS</span>
        <h1 className="sv-h1" style={{ marginTop: 6 }}>Street Profile</h1>
        <p style={{ color: 'var(--sv-grey-1)', marginTop: 10, fontSize: 19, lineHeight: 1.55, maxWidth: 820 }}>
          Are creatives building profiles, are profiles getting found, and are
          viewers taking action? This view tracks the create funnel, view
          sources, tab engagement, CTA conversion, and edit cadence.
        </p>
      </div>

      {/* Hero */}
      <div className="sv-card sv-card--padded">
        <SectionTitle right={<span className="sv-pill sv-pill--soft">7-day window</span>}>
          This Week
        </SectionTitle>
        <BigNumberTriple items={[
          { label: 'PROFILES CREATED', value: c.created_28d,        sub: `${formatNumber(c.created_7d)} in last 7 days` },
          { label: 'ACTIVE EDITORS',   value: c.active_editors_7d,  sub: `${formatNumber(c.updates_7d)} edits this week` },
          { label: 'PROFILES VIEWED',  value: c.views_7d,           sub: `${formatNumber(c.views_24h)} in last 24h` },
        ]} />
      </div>

      {/* Engagement grid */}
      <div>
        <SectionTitle>Activation & Engagement</SectionTitle>
        <div className="sv-grid-4">
          <MetricCard label="ACTIVATION RATE"
                      value={formatPercent(c.activation_rate * 100)}
                      icon="✨"
                      intent={activationIntent}
                      hint={`${formatNumber(c.create_started_28d)} started → ${formatNumber(c.created_28d)} finished (28d)`} />
          <MetricCard label="AVG COMPLETENESS"
                      value={c.avg_completeness != null ? `${c.avg_completeness.toFixed(0)}%` : '—'}
                      icon="📋"
                      intent={completenessIntent}
                      hint="of newly created profiles (28d)" />
          <MetricCard label="CTA PER VIEW"
                      value={formatPercent(c.cta_per_view * 100)}
                      icon="👆"
                      intent={ctaIntent}
                      hint={`${formatNumber(c.ctas_7d)} clicks / ${formatNumber(c.views_7d)} views`} />
          <MetricCard label="OWNER-VIEW SHARE"
                      value={formatPercent(c.owner_view_share * 100)}
                      icon="🪞"
                      hint="of profile views are self-views" />
          <MetricCard label="AVATAR ATTACH RATE"
                      value={formatPercent(c.avatar_attach_rate * 100)}
                      icon="🖼️"
                      hint="of created profiles upload an avatar" />
          <MetricCard label="BOOKING START RATE"
                      value={formatPercent(c.booking_per_view * 100)}
                      icon="📅"
                      hint={`${formatNumber(c.bookings_7d)} bookings started`} />
          <MetricCard label="DIR VIEWS 7D"
                      value={c.dir_views_7d}
                      icon="🗂️"
                      hint="directory landings this week" />
          <MetricCard label="28D CREATED"
                      value={c.created_28d}
                      icon="📈"
                      hint="cumulative new profiles" />
        </div>
      </div>

      {/* Create funnel */}
      {f ? (
        <div className="sv-card sv-card--padded">
          <SectionTitle>Profile Creation Funnel (28 days)</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {([
              { label: 'Directory viewed',  value: f.dir_viewed },
              { label: 'Create started',    value: f.started },
              { label: 'Step 1 · Basics',   value: f.step_basics },
              { label: 'Step 2 · About',    value: f.step_about },
              { label: 'Step 3 · Portfolio',value: f.step_portfolio },
              { label: 'Step 4 · Services', value: f.step_services },
              { label: 'Profile created',   value: f.created },
            ] as const).map((row, i) => {
              const max = f.dir_viewed || 1;
              const pct = (row.value / max) * 100;
              const isCreated = row.label === 'Profile created';
              return (
                <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 80px 80px', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sv-grey-1)' }}>{row.label}</span>
                  <div className="sv-bar" style={{ width: '100%' }}>
                    <span style={{ width: `${pct}%`, background: isCreated ? '#34D399' : 'var(--sv-yellow)' }} />
                  </div>
                  <span className="numeric" style={{ fontSize: 17, fontWeight: 700 }}>{formatNumber(row.value)}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--sv-grey-1)', textAlign: 'right' }}>
                    {i === 0 ? '100%' : formatPercent(pct)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Daily activity */}
      <div className="sv-card sv-card--padded">
        <SectionTitle>Daily Activity (28 days)</SectionTitle>
        <TimeSeriesChart
          series={[
            { key: 'viewed',     label: 'Profile views',  color: '#FFD600',
              values: data.daily.map(d => ({ day: d.day, value: d.viewed })) },
            { key: 'cta_clicks', label: 'CTA clicks',     color: '#111315',
              values: data.daily.map(d => ({ day: d.day, value: d.cta_clicks })) },
            { key: 'updated',    label: 'Profile edits',  color: '#9CA3AF',
              values: data.daily.map(d => ({ day: d.day, value: d.updated })) },
          ]}
        />
      </div>

      {/* Tabs + view sources */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>Tab Engagement</SectionTitle>
          {data.by_tab.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No tab views in window.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Tab</th><th style={{textAlign:'right'}}>Views</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_tab.map((r) => {
                  const pct = (r.n / totalTabs) * 100;
                  return (
                    <tr key={r.tab}>
                      <td style={{ fontWeight: 600 }}>{prettyTab(r.tab)}</td>
                      <td className="numeric">{r.n}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%` }} /></div>
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
          <SectionTitle>View Sources</SectionTitle>
          {data.by_view_source.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No source data.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Source</th><th style={{textAlign:'right'}}>Views</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_view_source.map((r) => {
                  const pct = (r.n / totalSource) * 100;
                  return (
                    <tr key={r.source}>
                      <td style={{ fontWeight: 600 }}>{prettySource(r.source)}</td>
                      <td className="numeric">{r.n}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%` }} /></div>
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
      </div>

      {/* CTAs + fields edited */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>CTA Mix</SectionTitle>
          {data.by_cta.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No CTA clicks.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>CTA</th><th style={{textAlign:'right'}}>Clicks</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_cta.map((r) => {
                  const pct = (r.n / totalCtas) * 100;
                  const color = CTA_COLORS[r.cta] ?? 'var(--sv-yellow)';
                  return (
                    <tr key={r.cta}>
                      <td style={{ fontWeight: 600 }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color, marginRight: 8 }} />
                        {prettyTab(r.cta)}
                      </td>
                      <td className="numeric">{r.n}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%`, background: color }} /></div>
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
          <SectionTitle>Most-Edited Fields (28d)</SectionTitle>
          {data.by_field_updated.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No edits in window.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Field</th><th style={{textAlign:'right'}}>Edits</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_field_updated.map((r) => {
                  const pct = (r.n / totalFields) * 100;
                  return (
                    <tr key={r.field}>
                      <td style={{ fontWeight: 600 }}>{prettyTab(r.field.replace(/_/g, ' '))}</td>
                      <td className="numeric">{r.n}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%` }} /></div>
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
      </div>

      {/* Completeness delta */}
      <div className="sv-card sv-card--padded">
        <SectionTitle>Completeness Change per Edit (28d)</SectionTitle>
        {data.by_completeness_delta.length === 0 ? (
          <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No edits in window.</div>
        ) : (
          <table className="sv-table">
            <thead>
              <tr><th>Delta</th><th style={{textAlign:'right'}}>Edits</th><th style={{textAlign:'right',width:200}}>Share</th></tr>
            </thead>
            <tbody>
              {data.by_completeness_delta.map((r) => {
                const pct = (r.n / totalDelta) * 100;
                const isImprovement = r.bucket.startsWith('+');
                return (
                  <tr key={r.bucket}>
                    <td style={{ fontWeight: 600, color: isImprovement ? 'rgb(5, 150, 105)' : r.bucket === 'decreased' ? 'rgb(190, 18, 60)' : 'var(--sv-black)' }}>
                      {r.bucket}
                    </td>
                    <td className="numeric">{r.n}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                        <div className="sv-bar" style={{ width: 120 }}>
                          <span style={{ width: `${pct}%`, background: isImprovement ? '#34D399' : r.bucket === 'decreased' ? '#FB7185' : 'var(--sv-yellow)' }} />
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
    </div>
  );
}

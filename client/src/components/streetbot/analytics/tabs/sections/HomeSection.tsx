// Home (/home) section dashboard.
// Question this view answers: is the front door doing its job?

import * as React from 'react';
import { MetricCard, BigNumberTriple } from '../../components/MetricCard';
import { SectionTitle } from '../../components/SectionTitle';
import { TimeSeriesChart } from '../../components/TimeSeriesChart';
import { formatNumber, formatMs, formatPercent } from '../../lib/format';

interface HomePayload {
  cards: {
    visitors_7d: number;
    visitors_28d: number;
    visitors_24h: number;
    auth_visitors_7d: number;
    anon_visitors_7d: number;
    median_active_ms: number;
    avg_scroll_pct: number;
    bounce_rate: number;
    ai_engagement_rate: number;
    median_time_to_first_message_s: number;
    returning_30d_rate: number;
  };
  daily:        { day: string; visitors: number }[];
  onward:       { route_pattern: string; visits: number }[];
  ai_services:  { category: string; shown: number }[];
  topics:       { topic: string; asks: number; synthetic?: boolean }[];
  heatmap:      { dow: number; hour: number; n: number }[];
}

const DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

export function HomeSection() {
  const [data, setData] = React.useState<HomePayload | null>(null);
  const [err,  setErr]  = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch('/api/analytics/query/section/home', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((d: HomePayload) => alive && setData(d))
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, []);

  if (err)  return <div className="sv-spinner" style={{ color: 'rgb(190, 18, 60)' }}>Error: {err}</div>;
  if (!data) return <div className="sv-spinner">Loading…</div>;

  const c = data.cards;
  const totalVisitors7d = (c.auth_visitors_7d + c.anon_visitors_7d) || 1;
  const authPct = (c.auth_visitors_7d / totalVisitors7d) * 100;

  const aiIntent: 'positive' | 'warn' | 'neutral' =
    c.ai_engagement_rate >= 0.30 ? 'positive' :
    c.ai_engagement_rate >= 0.10 ? 'neutral' : 'warn';
  const bounceIntent: 'critical' | 'warn' | 'neutral' =
    c.bounce_rate >= 0.60 ? 'critical' :
    c.bounce_rate >= 0.40 ? 'warn' : 'neutral';

  // Heatmap — 7×24 grid filled from the response
  const heatLookup = new Map<string, number>();
  let heatMax = 0;
  for (const h of data.heatmap) {
    heatLookup.set(`${h.dow}:${h.hour}`, h.n);
    if (h.n > heatMax) heatMax = h.n;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280, margin: '0 auto' }}>
      <div>
        <span className="sv-datecap">SECTION ANALYTICS · LAST 7 DAYS</span>
        <h1 className="sv-h1" style={{ marginTop: 6 }}>Home</h1>
        <p style={{ color: 'var(--sv-grey-1)', marginTop: 10, fontSize: 19, lineHeight: 1.55, maxWidth: 820 }}>
          The front door. Most users land here first — this view answers whether
          they're engaging with Street Bot, finding their way to other sections,
          or bouncing.
        </p>
      </div>

      {/* Hero — three big numbers */}
      <div className="sv-card sv-card--padded">
        <SectionTitle right={
          <span className="sv-pill sv-pill--soft">7-day window</span>
        }>This Week's Front Door</SectionTitle>
        <BigNumberTriple items={[
          { label: 'UNIQUE VISITORS',  value: c.visitors_7d,       sub: `${formatNumber(c.visitors_24h)} in last 24h` },
          { label: '28-DAY VISITORS',  value: c.visitors_28d,      sub: 'cumulative unique' },
          { label: 'AI ENGAGEMENT',    value: formatPercent(c.ai_engagement_rate * 100), sub: 'sent ≥1 message after landing' },
        ]} />
      </div>

      {/* Engagement grid */}
      <div>
        <SectionTitle>Engagement</SectionTitle>
        <div className="sv-grid-4">
          <MetricCard label="MEDIAN TIME ON HOME" value={formatMs(c.median_active_ms)} icon="⏱" />
          <MetricCard label="AVG SCROLL DEPTH"    value={`${c.avg_scroll_pct}%`} icon="📜" hint="how far they read" />
          <MetricCard label="BOUNCE RATE"
                      value={formatPercent(c.bounce_rate * 100)}
                      icon="↩️"
                      intent={bounceIntent}
                      hint="entry & exit on /home" />
          <MetricCard label="TIME TO FIRST AI MSG"
                      value={c.median_time_to_first_message_s ? `${c.median_time_to_first_message_s}s` : '—'}
                      icon="💬"
                      hint="from page load" />
          <MetricCard label="RETURNING (30d)"
                      value={formatPercent(c.returning_30d_rate * 100)}
                      icon="🔁"
                      hint="visited /home on ≥2 days" />
          <MetricCard label="AUTH VISITORS"
                      value={c.auth_visitors_7d}
                      icon="🔐"
                      hint={`${formatPercent(authPct)} of total`} />
          <MetricCard label="ANON VISITORS"
                      value={c.anon_visitors_7d}
                      icon="👤"
                      hint={`${formatPercent(100 - authPct)} of total`} />
          <MetricCard label="AI ENGAGEMENT"
                      value={formatPercent(c.ai_engagement_rate * 100)}
                      icon="✨"
                      intent={aiIntent}
                      hint="visitors who messaged Street Bot" />
        </div>
      </div>

      {/* Daily visitors trend */}
      <div className="sv-card sv-card--padded">
        <SectionTitle>Daily Visitors (28 days)</SectionTitle>
        <TimeSeriesChart
          showLegend={false}
          series={[{
            key: 'visitors', label: 'Visitors', color: '#FFD600',
            values: data.daily.map(d => ({ day: d.day, value: d.visitors })),
          }]}
        />
      </div>

      {/* Two-column: topics + onward destinations */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle right={
            data.topics[0]?.synthetic
              ? <span className="sv-pill sv-pill--grey">simulated · classifier pending</span>
              : null
          }>What People Ask Street Bot</SectionTitle>
          <table className="sv-table">
            <thead><tr><th>Topic</th><th style={{textAlign:'right'}}>Asks</th><th style={{textAlign:'right'}}>Share</th></tr></thead>
            <tbody>
              {(() => {
                const total = data.topics.reduce((s, t) => s + t.asks, 0) || 1;
                return data.topics.map((t) => (
                  <tr key={t.topic}>
                    <td style={{ fontWeight: 600 }}>{prettyTopic(t.topic)}</td>
                    <td className="numeric">{t.asks}</td>
                    <td className="numeric" style={{ width: 90 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                        <div className="sv-bar" style={{ width: 60 }}>
                          <span style={{ width: `${(t.asks / total) * 100}%` }} />
                        </div>
                        <span style={{ fontWeight: 700, minWidth: 36 }}>
                          {formatPercent((t.asks / total) * 100)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>

        <div className="sv-card sv-card--padded">
          <SectionTitle>Top Onward Destinations</SectionTitle>
          <table className="sv-table">
            <thead><tr><th>Route</th><th style={{textAlign:'right'}}>Visits</th></tr></thead>
            <tbody>
              {data.onward.length === 0 ? (
                <tr><td colSpan={2} style={{ color: 'var(--sv-grey-1)', textAlign: 'center', padding: 18 }}>
                  No onward navigation in window.
                </td></tr>
              ) : data.onward.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{r.route_pattern}</td>
                  <td className="numeric">{r.visits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two-column: AI services + heatmap */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>AI Surfaced These Categories</SectionTitle>
          {data.ai_services.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 13, padding: '24px 0' }}>
              No service results from /home sessions in window.
            </div>
          ) : (
            <table className="sv-table">
              <thead><tr><th>Category</th><th style={{textAlign:'right'}}>Times Shown</th></tr></thead>
              <tbody>
                {data.ai_services.map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{s.category}</td>
                    <td className="numeric">{s.shown}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="sv-card sv-card--padded">
          <SectionTitle>When People Visit (28d)</SectionTitle>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr>
                  <th style={{ padding: 4, color: 'var(--sv-grey-1)' }}></th>
                  {Array.from({ length: 24 }).map((_, h) => (
                    <th key={h} style={{ padding: '4px 2px', color: 'var(--sv-grey-2)', fontWeight: 700, fontSize: 9 }}>
                      {h % 3 === 0 ? h : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DOW.map((day, dow) => (
                  <tr key={day}>
                    <td style={{ padding: '2px 8px 2px 0', color: 'var(--sv-grey-1)', fontWeight: 700, fontSize: 10 }}>
                      {day}
                    </td>
                    {Array.from({ length: 24 }).map((_, h) => {
                      const n = heatLookup.get(`${dow}:${h}`) || 0;
                      const intensity = heatMax > 0 ? n / heatMax : 0;
                      return (
                        <td key={h} title={`${day} ${h}:00 — ${n} visits`} style={{ padding: 1 }}>
                          <div style={{
                            width: 18, height: 18,
                            background: intensity > 0
                              ? `rgba(255, 214, 0, ${0.15 + intensity * 0.85})`
                              : 'var(--sv-grey-5)',
                            borderRadius: 3,
                          }} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const TOPIC_PRETTY: Record<string, string> = {
  'services.health':     '🏥  Health',
  'services.housing':    '🏠  Housing',
  'services.legal':      '⚖️  Legal',
  'services.food':       '🍞  Food',
  'services.employment': '💼  Employment',
  'services.education':  '📚  Education',
  'services.financial':  '💵  Financial',
  'services.transportation': '🚌  Transit',
  'services.crisis':     '🆘  Crisis',
  'services.community':  '🤝  Community',
  'services.other':      '🔎  Other services',
  'gallery_help':        '🎨  Gallery',
  'jobs_help':           '💼  Jobs',
  'profile_help':        '👤  Profile',
  'navigation':          '🧭  Navigation',
  'account':             '⚙️  Account',
  'other':               '✨  Other',
};
function prettyTopic(t: string): string {
  return TOPIC_PRETTY[t] ?? t;
}

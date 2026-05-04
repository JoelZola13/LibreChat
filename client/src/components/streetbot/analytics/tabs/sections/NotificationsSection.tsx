// Notifications (/notifications) section dashboard.
// Question: are notifications driving action or just noise?

import * as React from 'react';
import { MetricCard, BigNumberTriple } from '../../components/MetricCard';
import { SectionTitle } from '../../components/SectionTitle';
import { TimeSeriesChart } from '../../components/TimeSeriesChart';
import { formatNumber, formatMs, formatPercent } from '../../lib/format';

interface NotifsPayload {
  cards: {
    delivered_24h: number;
    delivered_7d: number;
    delivered_28d: number;
    read_7d: number;
    clicked_7d: number;
    unique_recipients_7d: number;
    ctr: number;
    read_rate: number;
    median_ttr_s: number;
    p95_ttr_s: number;
    median_page_active_ms: number;
    empty_visit_rate: number;
    conversion_rate: number;
  };
  by_type:      { notification_type: string; delivered: number; read_count: number; clicked: number; ctr: number }[];
  daily:        { day: string; delivered: number; read_: number; clicked: number }[];
  destinations: { destination: string; clicks: number }[];
}

export function NotificationsSection() {
  const [data, setData] = React.useState<NotifsPayload | null>(null);
  const [err,  setErr]  = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch('/api/analytics/query/section/notifications', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((d: NotifsPayload) => alive && setData(d))
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, []);

  if (err)   return <div className="sv-spinner" style={{ color: 'rgb(190, 18, 60)' }}>Error: {err}</div>;
  if (!data) return <div className="sv-spinner">Loading…</div>;

  const c = data.cards;

  const ctrIntent: 'positive' | 'warn' | 'critical' | 'neutral' =
    c.ctr >= 0.30 ? 'positive' : c.ctr >= 0.15 ? 'neutral' : c.ctr > 0 ? 'warn' : 'neutral';
  const conversionIntent: 'positive' | 'neutral' | 'warn' =
    c.conversion_rate >= 0.40 ? 'positive' : c.conversion_rate >= 0.20 ? 'neutral' : 'warn';
  const readRateIntent: 'positive' | 'warn' | 'neutral' =
    c.read_rate >= 0.70 ? 'positive' : c.read_rate >= 0.50 ? 'neutral' : 'warn';

  // Identify "ignored" types: high volume + low CTR (sort by volume, lowest CTR first).
  const ignored = [...data.by_type]
    .filter(t => t.delivered >= 30 && t.ctr < 0.20)
    .sort((a, b) => a.ctr - b.ctr)
    .slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280, margin: '0 auto' }}>
      <div>
        <span className="sv-datecap">SECTION ANALYTICS · LAST 7 DAYS</span>
        <h1 className="sv-h1" style={{ marginTop: 6 }}>Notifications</h1>
        <p style={{ color: 'var(--sv-grey-1)', marginTop: 10, fontSize: 19, lineHeight: 1.55, maxWidth: 820 }}>
          Are notifications driving action or just noise? This view tracks
          delivery, read & click rates per type, and whether a click actually
          turns into a meaningful action within five minutes.
        </p>
      </div>

      {/* Hero */}
      <div className="sv-card sv-card--padded">
        <SectionTitle right={<span className="sv-pill sv-pill--soft">7-day window</span>}>
          This Week's Notifications
        </SectionTitle>
        <BigNumberTriple items={[
          { label: 'DELIVERED',  value: c.delivered_7d, sub: `${formatNumber(c.delivered_24h)} in last 24h` },
          { label: 'READ',       value: c.read_7d,      sub: `${formatPercent(c.read_rate * 100)} read rate` },
          { label: 'CLICKED',    value: c.clicked_7d,   sub: `${formatPercent(c.ctr * 100)} CTR` },
        ]} />
      </div>

      {/* Engagement grid */}
      <div>
        <SectionTitle>Engagement</SectionTitle>
        <div className="sv-grid-4">
          <MetricCard label="UNIQUE RECIPIENTS" value={c.unique_recipients_7d} icon="📨" hint="users notified 7d" />
          <MetricCard label="CTR"
                      value={formatPercent(c.ctr * 100)}
                      icon="🖱"
                      intent={ctrIntent}
                      hint="clicks ÷ delivered" />
          <MetricCard label="READ RATE"
                      value={formatPercent(c.read_rate * 100)}
                      icon="👁"
                      intent={readRateIntent}
                      hint="reads ÷ delivered" />
          <MetricCard label="CONVERSION"
                      value={formatPercent(c.conversion_rate * 100)}
                      icon="✅"
                      intent={conversionIntent}
                      hint="clicked → action <5min" />
          <MetricCard label="TIME TO OPEN"
                      value={c.median_ttr_s ? formatTimeFromS(c.median_ttr_s) : '—'}
                      icon="⏱"
                      hint={c.p95_ttr_s ? `p95 ${formatTimeFromS(c.p95_ttr_s)}` : ''} />
          <MetricCard label="PAGE TIME"
                      value={c.median_page_active_ms ? formatMs(c.median_page_active_ms) : '—'}
                      icon="📜"
                      hint="median time on /notifications" />
          <MetricCard label="EMPTY VISITS"
                      value={formatPercent(c.empty_visit_rate * 100)}
                      icon="📭"
                      hint="zero-unread arrivals" />
          <MetricCard label="DELIVERED 28D"
                      value={c.delivered_28d}
                      icon="📊"
                      hint="cumulative monthly volume" />
        </div>
      </div>

      {/* Trend */}
      <div className="sv-card sv-card--padded">
        <SectionTitle>Daily Funnel (28 days)</SectionTitle>
        <TimeSeriesChart
          series={[
            { key: 'delivered', label: 'Delivered',   color: '#FFD600',
              values: data.daily.map(d => ({ day: d.day, value: d.delivered })) },
            { key: 'read',      label: 'Read',        color: '#9CA3AF',
              values: data.daily.map(d => ({ day: d.day, value: d.read_ })) },
            { key: 'clicked',   label: 'Clicked',     color: '#111315',
              values: data.daily.map(d => ({ day: d.day, value: d.clicked })) },
          ]}
        />
      </div>

      {/* Per-type breakdown */}
      <div className="sv-card sv-card--padded">
        <SectionTitle>By Notification Type</SectionTitle>
        <table className="sv-table">
          <thead>
            <tr>
              <th>Type</th>
              <th style={{ textAlign: 'right' }}>Delivered</th>
              <th style={{ textAlign: 'right' }}>Read</th>
              <th style={{ textAlign: 'right' }}>Clicked</th>
              <th style={{ textAlign: 'right' }}>CTR</th>
              <th style={{ textAlign: 'right', width: 200 }}>Performance</th>
            </tr>
          </thead>
          <tbody>
            {data.by_type.map((t) => {
              const ctr = Number(t.ctr);
              const ctrColor = ctr >= 0.30 ? 'rgb(5, 150, 105)' : ctr >= 0.15 ? 'var(--sv-black)' : 'rgb(190, 18, 60)';
              return (
                <tr key={t.notification_type}>
                  <td style={{ fontWeight: 600 }}>{prettyType(t.notification_type)}</td>
                  <td className="numeric">{formatNumber(t.delivered)}</td>
                  <td className="numeric">{formatNumber(t.read_count)}</td>
                  <td className="numeric">{formatNumber(t.clicked)}</td>
                  <td className="numeric" style={{ color: ctrColor, fontWeight: 700 }}>
                    {formatPercent(ctr * 100)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <div className="sv-bar" style={{ width: 140 }}>
                        <span style={{ width: `${Math.min(100, ctr * 100 / 0.6 * 100)}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Two-column: ignored types + destinations */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle right={<span className="sv-pill sv-pill--rose">Low CTR · ≥30 sent</span>}>
            Most Ignored
          </SectionTitle>
          {ignored.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>
              No notification types meet the "ignored" criteria — everything is performing reasonably.
            </div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Type</th><th style={{textAlign:'right'}}>Delivered</th><th style={{textAlign:'right'}}>CTR</th></tr>
              </thead>
              <tbody>
                {ignored.map((t) => (
                  <tr key={t.notification_type}>
                    <td style={{ fontWeight: 600 }}>{prettyType(t.notification_type)}</td>
                    <td className="numeric">{formatNumber(t.delivered)}</td>
                    <td className="numeric" style={{ color: 'rgb(190, 18, 60)', fontWeight: 700 }}>
                      {formatPercent(Number(t.ctr) * 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="sv-card sv-card--padded">
          <SectionTitle>Top Click Destinations</SectionTitle>
          {data.destinations.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>
              No destination data in window.
            </div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Route</th><th style={{textAlign:'right'}}>Clicks</th></tr>
              </thead>
              <tbody>
                {data.destinations.map((d, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14 }}>{d.destination}</td>
                    <td className="numeric">{formatNumber(d.clicks)}</td>
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

function formatTimeFromS(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)}d`;
}

const TYPE_PRETTY: Record<string, string> = {
  'messages.dm_received':           '💬  DM received',
  'messages.reply':                 '↩️  Message reply',
  'jobs.application_status':        '💼  Job application status',
  'directory.review_received':      '⭐  Directory review',
  'news.weekly_digest':             '📰  Weekly news digest',
  'gallery.artwork_favorited':      '🎨  Artwork favorited',
  'academy.lesson_reminder':        '📚  Academy reminder',
  'groups.invite':                  '👥  Group invite',
  'admin.system_announcement':      '📣  System announcement',
  'grantwriter.deadline_reminder':  '⏰  Grant deadline',
};
function prettyType(t: string): string {
  return TYPE_PRETTY[t] ?? t;
}

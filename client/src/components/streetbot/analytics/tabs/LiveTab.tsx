// Live tab — real-time event stream with branded visual treatment.
//
// Shows: pulsing LIVE indicator + huge rate counter, event-rate sparkline
// (last 5 minutes in 5s buckets), Hot Areas + Top Events bar charts (last
// 60s), and the streaming event list with animated entry per row.

import * as React from 'react';
import { openLiveStream, type LiveSummary } from '../lib/liveStream';
import { SectionTitle } from '../components/SectionTitle';
import { formatRelativeTime, formatNumber } from '../lib/format';

const MAX_EVENTS         = 200;
const SPARKLINE_BUCKETS  = 60;     // 60 buckets × 5s = 5 min window
const SPARKLINE_BUCKET_S = 5;
const HOT_WINDOW_S       = 60;     // hot lists count last 60s

// Stable color per product area — yellow/black + a few accents.
const AREA_COLOR: Record<string, string> = {
  home:           '#FFD600',
  ai:             '#111315',
  street_profile: '#A78BFA',
  gallery:        '#F472B6',
  jobs:           '#34D399',
  academy:        '#60A5FA',
  directory:      '#FB923C',
  messages:       '#22D3EE',
  groups:         '#F87171',
  news:           '#FACC15',
  tasks:          '#A78BFA',
  documents:      '#94A3B8',
  calendar:       '#4ADE80',
  case_management:'#EF4444',
  social_media:   '#EC4899',
  storage:        '#64748B',
  data:           '#6366F1',
  grantwriter:    '#F59E0B',
  agents:         '#0EA5E9',
  admin:          '#475569',
  platform:       '#9CA3AF',
  auth:           '#84CC16',
  _global:        '#6B7280',
};
function colorForArea(area: string | null | undefined): string {
  return AREA_COLOR[area ?? '_global'] ?? '#9CA3AF';
}

export function LiveTab() {
  const [events, setEvents] = React.useState<LiveSummary[]>([]);
  const [paused, setPaused] = React.useState(false);
  const [tick,   setTick]   = React.useState(0);  // forces 1Hz re-render for sparkline + relative times
  const buffer = React.useRef<LiveSummary[]>([]);
  const pausedRef = React.useRef(false);

  React.useEffect(() => { pausedRef.current = paused; }, [paused]);

  React.useEffect(() => {
    const close = openLiveStream((e) => {
      if (pausedRef.current) return;
      buffer.current = [e, ...buffer.current].slice(0, MAX_EVENTS);
      setEvents([...buffer.current]);
    });
    return close;
  }, []);

  // 1Hz redraw so sparkline + relative times stay current.
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const recent60 = events.filter(e => e.occurred_at && now - new Date(e.occurred_at).getTime() < HOT_WINDOW_S * 1000);
  const eventsPerMin = recent60.length;

  // Sparkline buckets: last 5 min × 5s buckets.
  const buckets = new Array(SPARKLINE_BUCKETS).fill(0);
  const windowMs = SPARKLINE_BUCKETS * SPARKLINE_BUCKET_S * 1000;
  for (const e of events) {
    if (!e.occurred_at) continue;
    const age = now - new Date(e.occurred_at).getTime();
    if (age < 0 || age > windowMs) continue;
    const idx = SPARKLINE_BUCKETS - 1 - Math.floor(age / (SPARKLINE_BUCKET_S * 1000));
    if (idx >= 0 && idx < SPARKLINE_BUCKETS) buckets[idx]++;
  }
  const bucketMax = Math.max(1, ...buckets);

  // Hot areas + top events from last 60s.
  const areaTally: Record<string, number>  = {};
  const eventTally: Record<string, number> = {};
  for (const e of recent60) {
    if (e.product_area) areaTally[e.product_area]   = (areaTally[e.product_area] ?? 0) + 1;
    if (e.event_name)   eventTally[e.event_name]    = (eventTally[e.event_name] ?? 0) + 1;
  }
  const hotAreas  = Object.entries(areaTally).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topEvents = Object.entries(eventTally).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const areaMax   = Math.max(1, ...hotAreas.map(([, n]) => n));
  const eventMax  = Math.max(1, ...topEvents.map(([, n]) => n));

  // Sparkline SVG path
  const W = 960, H = 80, padX = 4, padY = 6;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const stepX  = innerW / (SPARKLINE_BUCKETS - 1);
  const points = buckets.map((v, i) => {
    const x = padX + i * stepX;
    const y = padY + innerH - (v / bucketMax) * innerH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `${linePath} L ${padX + (SPARKLINE_BUCKETS - 1) * stepX},${H - padY} L ${padX},${H - padY} Z`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280, margin: '0 auto' }}>
      <div>
        <span className="sv-datecap">REAL-TIME · LAST 60 SECONDS</span>
        <h1 className="sv-h1" style={{ marginTop: 6 }}>Live</h1>
      </div>

      {/* Hero: status pill + huge rate + pause/resume */}
      <div className="sv-card sv-card--padded">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div className="sv-live-hero">
            <span className={`sv-live-status ${paused ? 'sv-live-status--paused' : ''}`}>
              <span className="sv-live-dot" />
              {paused ? 'Paused' : 'Live'}
            </span>
            <div>
              <div className="sv-live-hero__rate">{eventsPerMin}</div>
              <div className="sv-label" style={{ marginTop: 8 }}>events / minute</div>
            </div>
            <div style={{ borderLeft: '1px solid var(--sv-grey-4)', height: 56, marginLeft: 8 }} />
            <div>
              <div className="sv-metric-sm">{formatNumber(events.length)}</div>
              <div className="sv-label" style={{ marginTop: 4 }}>buffered</div>
            </div>
            <div>
              <div className="sv-metric-sm">{Object.keys(areaTally).length}</div>
              <div className="sv-label" style={{ marginTop: 4 }}>active areas</div>
            </div>
          </div>
          <button
            data-track="analytics.live.toggle_pause"
            onClick={() => setPaused((p) => !p)}
            className={paused ? 'sv-btn sv-btn--primary' : 'sv-btn sv-btn--ghost'}
            style={{ width: 'auto', padding: '12px 24px' }}
          >
            {paused ? '▶  Resume stream' : '⏸  Pause stream'}
          </button>
        </div>
      </div>

      {/* Sparkline: event-rate over last 5 minutes */}
      <div className="sv-card sv-card--padded">
        <SectionTitle right={
          <span className="sv-pill sv-pill--soft">
            5-min window · {SPARKLINE_BUCKET_S}s buckets
          </span>
        }>Event Rate</SectionTitle>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 90, color: 'var(--sv-yellow)' }}>
          <defs>
            <linearGradient id="sv-spark-grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#FFD600" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#FFD600" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY} stroke="currentColor" strokeOpacity={0.10} />
          <path d={areaPath} fill="url(#sv-spark-grad)" />
          <path d={linePath} fill="none" stroke="#111315" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--sv-grey-1)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>
          <span>5 MIN AGO</span>
          <span>NOW</span>
        </div>
      </div>

      {/* Hot lists row */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle right={<span className="sv-pill sv-pill--soft">Last 60s</span>}>
            Hot Product Areas
          </SectionTitle>
          {hotAreas.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>
              No events yet — waiting for activity…
            </div>
          ) : (
            <div>
              {hotAreas.map(([area, n]) => (
                <div key={area} className="sv-bar-row">
                  <div className="sv-bar-row__label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: colorForArea(area) }} />
                    {area}
                  </div>
                  <div className="sv-bar"><span style={{ width: `${(n / areaMax) * 100}%` }} /></div>
                  <div className="sv-bar-row__value">{n}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sv-card sv-card--padded">
          <SectionTitle right={<span className="sv-pill sv-pill--soft">Last 60s</span>}>
            Top Events
          </SectionTitle>
          {topEvents.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>
              No events yet — waiting for activity…
            </div>
          ) : (
            <div>
              {topEvents.map(([name, n]) => (
                <div key={name} className="sv-bar-row" style={{ gridTemplateColumns: '220px 1fr 60px' }}>
                  <div className="sv-bar-row__label" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 700 }}>
                    {name}
                  </div>
                  <div className="sv-bar"><span style={{ width: `${(n / eventMax) * 100}%` }} /></div>
                  <div className="sv-bar-row__value">{n}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live event stream */}
      <div className="sv-card sv-card--padded" style={{ padding: 0 }}>
        <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid var(--sv-grey-5)' }}>
          <SectionTitle right={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--sv-grey-1)', fontWeight: 700, letterSpacing: 0.5 }}>
              <span className="sv-live-dot" style={{ width: 8, height: 8, borderWidth: 1.5 }} />
              Streaming · last {events.length} events
            </span>
          }>Event Stream</SectionTitle>
        </div>
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {events.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--sv-grey-1)', fontSize: 16 }}>
              Waiting for events… click around the app to fire some.
            </div>
          ) : events.map((e, i) => (
            <div key={`${e.occurred_at}-${i}`} className="sv-event-row">
              <span className="sv-event-row__dot" style={{ background: colorForArea(e.product_area) }} />
              <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span className="sv-event-row__name">{e.event_name ?? '(unknown)'}</span>
                <span className="sv-event-row__meta">
                  {e.product_area ? <>· <strong style={{ color: 'var(--sv-black)', fontWeight: 700 }}>{e.product_area}</strong></> : null}
                  {e.route_pattern ? <> · <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{e.route_pattern}</span></> : null}
                  {e.user_role ? <> · {e.user_role}</> : null}
                </span>
              </div>
              <span className="sv-event-row__time">{formatRelativeTime(e.occurred_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

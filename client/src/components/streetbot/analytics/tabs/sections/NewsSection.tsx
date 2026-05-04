// News section dashboard.
// Question: are readers reading what we publish, and is the editorial
// side using the AI tools effectively?

import * as React from 'react';
import { MetricCard, BigNumberTriple } from '../../components/MetricCard';
import { SectionTitle } from '../../components/SectionTitle';
import { TimeSeriesChart } from '../../components/TimeSeriesChart';
import { formatNumber, formatPercent } from '../../lib/format';

interface NewsPayload {
  cards: {
    home_views_7d: number;
    article_views_7d: number;
    article_views_24h: number;
    article_views_28d: number;
    reads_7d: number;
    reads_28d: number;
    shares_7d: number;
    bookmarks_7d: number;
    readers_7d: number;
    drafts_7d: number;
    drafts_28d: number;
    ai_started_7d: number;
    ai_succeeded_7d: number;
    ai_completed_7d: number;
    median_read_ms: number | null;
    ai_p95_latency_ms: number | null;
    read_through_rate: number;
    bookmark_rate: number;
    share_rate: number;
    ai_success_rate: number;
  };
  by_category:     { category: string; n: number }[];
  by_source:       { source: string; n: number }[];
  by_share_method: { share_method: string; n: number }[];
  by_scroll_depth: { bucket: string; n: number }[];
  by_ai_type:      { generation_type: string; attempts: number; successes: number; median_latency_ms: number }[];
  by_draft_source: { source: string; n: number }[];
  daily: { day: string; home_views: number; article_views: number; reads: number; drafts: number }[];
}

const CATEGORY_COLORS: Record<string, string> = {
  community: '#FFD600',
  arts: '#A78BFA',
  jobs: '#3B82F6',
  events: '#34D399',
  announcements: '#F59E0B',
  opinion: '#FB7185',
  how_to: '#9CA3AF',
};

function pretty(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}m ${sec}s`;
}

export function NewsSection() {
  const [data, setData] = React.useState<NewsPayload | null>(null);
  const [err,  setErr]  = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch('/api/analytics/query/section/news', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((d: NewsPayload) => alive && setData(d))
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, []);

  if (err)   return <div className="sv-spinner" style={{ color: 'rgb(190, 18, 60)' }}>Error: {err}</div>;
  if (!data) return <div className="sv-spinner">Loading…</div>;

  const c = data.cards;

  const readThroughIntent: 'positive' | 'neutral' | 'warn' =
    c.read_through_rate >= 0.50 ? 'positive' : c.read_through_rate >= 0.30 ? 'neutral' : 'warn';
  const bookmarkIntent: 'positive' | 'neutral' | 'warn' =
    c.bookmark_rate >= 0.08 ? 'positive' : c.bookmark_rate >= 0.04 ? 'neutral' : 'warn';
  const aiSuccessIntent: 'positive' | 'warn' | 'critical' | 'neutral' =
    c.ai_success_rate >= 0.95 ? 'positive' : c.ai_success_rate >= 0.85 ? 'neutral' : c.ai_success_rate >= 0.70 ? 'warn' : 'critical';
  const aiLatencyIntent: 'positive' | 'neutral' | 'warn' =
    (c.ai_p95_latency_ms ?? 0) < 15000 ? 'positive' : (c.ai_p95_latency_ms ?? 0) < 30000 ? 'neutral' : 'warn';

  const totalCategory = data.by_category.reduce((s, r) => s + r.n, 0) || 1;
  const totalSource   = data.by_source.reduce((s, r) => s + r.n, 0) || 1;
  const totalShare    = data.by_share_method.reduce((s, r) => s + r.n, 0) || 1;
  const totalScroll   = data.by_scroll_depth.reduce((s, r) => s + r.n, 0) || 1;
  const totalDraft    = data.by_draft_source.reduce((s, r) => s + r.n, 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280, margin: '0 auto' }}>
      <div>
        <span className="sv-datecap">SECTION ANALYTICS · LAST 7 DAYS</span>
        <h1 className="sv-h1" style={{ marginTop: 6 }}>News</h1>
        <p style={{ color: 'var(--sv-grey-1)', marginTop: 10, fontSize: 19, lineHeight: 1.55, maxWidth: 820 }}>
          Are readers actually reading what we publish, and is the editorial
          side using the AI tools effectively? This view tracks the read funnel,
          category mix, and AI generation success and latency by type.
        </p>
      </div>

      {/* Hero */}
      <div className="sv-card sv-card--padded">
        <SectionTitle right={<span className="sv-pill sv-pill--soft">7-day window</span>}>
          This Week
        </SectionTitle>
        <BigNumberTriple items={[
          { label: 'ARTICLES READ',  value: c.reads_28d,        sub: `${formatNumber(c.reads_7d)} in last 7 days` },
          { label: 'DAILY READERS',  value: c.readers_7d,       sub: `${formatNumber(c.article_views_7d)} article views` },
          { label: 'AI GENERATIONS', value: c.ai_completed_7d,  sub: `${formatPercent(c.ai_success_rate * 100)} success rate` },
        ]} />
      </div>

      {/* Engagement grid */}
      <div>
        <SectionTitle>Reader & Editorial Health</SectionTitle>
        <div className="sv-grid-4">
          <MetricCard label="READ-THROUGH RATE"
                      value={formatPercent(c.read_through_rate * 100)}
                      icon="📖"
                      intent={readThroughIntent}
                      hint={`${formatNumber(c.reads_7d)} reads / ${formatNumber(c.article_views_7d)} views`} />
          <MetricCard label="BOOKMARK RATE"
                      value={formatPercent(c.bookmark_rate * 100)}
                      icon="🔖"
                      intent={bookmarkIntent}
                      hint={`${formatNumber(c.bookmarks_7d)} bookmarks this week`} />
          <MetricCard label="SHARE RATE"
                      value={formatPercent(c.share_rate * 100)}
                      icon="📤"
                      hint={`${formatNumber(c.shares_7d)} shares this week`} />
          <MetricCard label="MEDIAN READ TIME"
                      value={formatDuration(c.median_read_ms)}
                      icon="⏱️"
                      hint="when reading ≥70% of article" />
          <MetricCard label="AI SUCCESS RATE"
                      value={formatPercent(c.ai_success_rate * 100)}
                      icon="🤖"
                      intent={aiSuccessIntent}
                      hint={`${formatNumber(c.ai_succeeded_7d)} / ${formatNumber(c.ai_completed_7d)} completed`} />
          <MetricCard label="AI P95 LATENCY"
                      value={formatDuration(c.ai_p95_latency_ms)}
                      icon="⚡"
                      intent={aiLatencyIntent}
                      hint="end-to-end (success only)" />
          <MetricCard label="DRAFTS 7D"
                      value={c.drafts_7d}
                      icon="✏️"
                      hint={`${formatNumber(c.drafts_28d)} in last 28 days`} />
          <MetricCard label="28D ARTICLE VIEWS"
                      value={c.article_views_28d}
                      icon="📊"
                      hint="cumulative monthly readership" />
        </div>
      </div>

      {/* Read funnel */}
      <div className="sv-card sv-card--padded">
        <SectionTitle>Read Funnel (7 days)</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {([
            { label: 'News home viewed', value: c.home_views_7d },
            { label: 'Article opened',   value: c.article_views_7d },
            { label: 'Read ≥70%',        value: c.reads_7d },
            { label: 'Bookmarked',       value: c.bookmarks_7d },
            { label: 'Shared',           value: c.shares_7d },
          ] as const).map((row) => {
            const max = Math.max(c.home_views_7d, c.article_views_7d) || 1;
            const pct = (row.value / max) * 100;
            const isShared = row.label === 'Shared';
            return (
              <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 80px 80px', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sv-grey-1)' }}>{row.label}</span>
                <div className="sv-bar" style={{ width: '100%' }}>
                  <span style={{ width: `${Math.min(pct, 100)}%`, background: isShared ? '#34D399' : 'var(--sv-yellow)' }} />
                </div>
                <span className="numeric" style={{ fontSize: 17, fontWeight: 700 }}>{formatNumber(row.value)}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--sv-grey-1)', textAlign: 'right' }}>
                  {formatPercent(pct)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily activity */}
      <div className="sv-card sv-card--padded">
        <SectionTitle>Daily Activity (28 days)</SectionTitle>
        <TimeSeriesChart
          series={[
            { key: 'article_views', label: 'Article views',  color: '#FFD600',
              values: data.daily.map(d => ({ day: d.day, value: d.article_views })) },
            { key: 'reads',         label: 'Reads (≥70%)',   color: '#111315',
              values: data.daily.map(d => ({ day: d.day, value: d.reads })) },
            { key: 'home_views',    label: 'Home views',     color: '#9CA3AF',
              values: data.daily.map(d => ({ day: d.day, value: d.home_views })) },
            { key: 'drafts',        label: 'Drafts created', color: '#A78BFA',
              values: data.daily.map(d => ({ day: d.day, value: d.drafts })) },
          ]}
        />
      </div>

      {/* Categories + sources */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>Top Categories (28d)</SectionTitle>
          {data.by_category.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No category data.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Category</th><th style={{textAlign:'right'}}>Views</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_category.map((r) => {
                  const pct = (r.n / totalCategory) * 100;
                  const color = CATEGORY_COLORS[r.category] ?? 'var(--sv-yellow)';
                  return (
                    <tr key={r.category}>
                      <td style={{ fontWeight: 600 }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color, marginRight: 8 }} />
                        {pretty(r.category)}
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
          <SectionTitle>How Readers Get to Articles (28d)</SectionTitle>
          {data.by_source.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No source data.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Source</th><th style={{textAlign:'right'}}>Views</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_source.map((r) => {
                  const pct = (r.n / totalSource) * 100;
                  return (
                    <tr key={r.source}>
                      <td style={{ fontWeight: 600 }}>{pretty(r.source)}</td>
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

      {/* Scroll depth + share methods */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>Scroll Depth (≥70% reads, 28d)</SectionTitle>
          {data.by_scroll_depth.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No reads in window.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Depth</th><th style={{textAlign:'right'}}>Reads</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_scroll_depth.map((r) => {
                  const pct = (r.n / totalScroll) * 100;
                  const isFull = r.bucket === '100%';
                  return (
                    <tr key={r.bucket}>
                      <td style={{ fontWeight: 600, color: isFull ? 'rgb(5, 150, 105)' : 'var(--sv-black)' }}>{r.bucket}</td>
                      <td className="numeric">{r.n}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%`, background: isFull ? '#34D399' : 'var(--sv-yellow)' }} /></div>
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
          <SectionTitle>Share Methods (28d)</SectionTitle>
          {data.by_share_method.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No shares in window.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Method</th><th style={{textAlign:'right'}}>Shares</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_share_method.map((r) => {
                  const pct = (r.n / totalShare) * 100;
                  return (
                    <tr key={r.share_method}>
                      <td style={{ fontWeight: 600 }}>{pretty(r.share_method)}</td>
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

      {/* Editorial: AI generation by type + draft sources */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>AI Generation by Type (28d)</SectionTitle>
          {data.by_ai_type.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No AI generations in window.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th style={{textAlign:'right'}}>Attempts</th>
                  <th style={{textAlign:'right',width:120}}>Success</th>
                  <th style={{textAlign:'right',width:140}}>Median latency</th>
                </tr>
              </thead>
              <tbody>
                {data.by_ai_type.map((r) => {
                  const successRate = r.attempts ? (r.successes / r.attempts) : 0;
                  const isLow = successRate < 0.85;
                  return (
                    <tr key={r.generation_type}>
                      <td style={{ fontWeight: 600 }}>{pretty(r.generation_type)}</td>
                      <td className="numeric">{r.attempts}</td>
                      <td className="numeric" style={{ color: isLow ? 'rgb(190, 18, 60)' : 'rgb(5, 150, 105)', fontWeight: 700 }}>
                        {formatPercent(successRate * 100)}
                      </td>
                      <td className="numeric">{formatDuration(r.median_latency_ms)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="sv-card sv-card--padded">
          <SectionTitle>Draft Sources (28d)</SectionTitle>
          {data.by_draft_source.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No drafts in window.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Source</th><th style={{textAlign:'right'}}>Drafts</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_draft_source.map((r) => {
                  const pct = (r.n / totalDraft) * 100;
                  const isAi = r.source === 'ai_generated';
                  return (
                    <tr key={r.source}>
                      <td style={{ fontWeight: 600 }}>
                        {isAi ? '🤖 ' : ''}{pretty(r.source)}
                      </td>
                      <td className="numeric">{r.n}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%`, background: isAi ? '#A78BFA' : 'var(--sv-yellow)' }} /></div>
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
    </div>
  );
}

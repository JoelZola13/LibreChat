// Search messages section dashboard.
// Question: is search actually finding what people want?

import * as React from 'react';
import { MetricCard, BigNumberTriple } from '../../components/MetricCard';
import { SectionTitle } from '../../components/SectionTitle';
import { TimeSeriesChart } from '../../components/TimeSeriesChart';
import { formatNumber, formatPercent } from '../../lib/format';

interface SearchPayload {
  cards: {
    searches_24h: number;
    searches_7d: number;
    searches_28d: number;
    searchers_7d: number;
    clicks_7d: number;
    searches_per_user: number;
    no_results_rate: number;
    median_results: number;
    p95_results: number;
    ctr: number;
    refinement_rate: number;
    power_users: number;
    power_user_share_of_searches: number;
  };
  by_category:    { category: string; searches: number; zero_results: number }[];
  by_length:      { bucket: string; n: number }[];
  position_dist:  { position: number; clicks: number }[];
  daily:          { day: string; searches: number; clicks: number; zero_results: number }[];
}

export function SearchSection() {
  const [data, setData] = React.useState<SearchPayload | null>(null);
  const [err,  setErr]  = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch('/api/analytics/query/section/search', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((d: SearchPayload) => alive && setData(d))
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, []);

  if (err)   return <div className="sv-spinner" style={{ color: 'rgb(190, 18, 60)' }}>Error: {err}</div>;
  if (!data) return <div className="sv-spinner">Loading…</div>;

  const c = data.cards;
  const noResultsIntent: 'positive' | 'warn' | 'critical' | 'neutral' =
    c.no_results_rate <= 0.10 ? 'positive' :
    c.no_results_rate <= 0.20 ? 'neutral' :
    c.no_results_rate <= 0.35 ? 'warn' : 'critical';
  const ctrIntent: 'positive' | 'warn' | 'neutral' =
    c.ctr >= 0.50 ? 'positive' : c.ctr >= 0.25 ? 'neutral' : 'warn';
  const refinementIntent: 'positive' | 'warn' | 'neutral' =
    c.refinement_rate <= 0.15 ? 'positive' : c.refinement_rate <= 0.30 ? 'neutral' : 'warn';

  const totalCategorySearches = data.by_category.reduce((s, c) => s + c.searches, 0) || 1;
  const totalLengthSearches   = data.by_length.reduce((s, c) => s + c.n, 0) || 1;
  const totalClicks           = data.position_dist.reduce((s, c) => s + c.clicks, 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280, margin: '0 auto' }}>
      <div>
        <span className="sv-datecap">SECTION ANALYTICS · LAST 7 DAYS</span>
        <h1 className="sv-h1" style={{ marginTop: 6 }}>Search Messages</h1>
        <p style={{ color: 'var(--sv-grey-1)', marginTop: 10, fontSize: 19, lineHeight: 1.55, maxWidth: 820 }}>
          When users go looking for past conversations, are they finding what
          they need? This view tracks search volume, no-results rate, click
          behaviour, and how often users refine.
        </p>
      </div>

      <div className="sv-card sv-card--padded">
        <SectionTitle right={<span className="sv-pill sv-pill--soft">7-day window</span>}>
          This Week's Searches
        </SectionTitle>
        <BigNumberTriple items={[
          { label: 'SEARCHES',      value: c.searches_7d, sub: `${formatNumber(c.searches_24h)} in last 24h` },
          { label: 'UNIQUE SEARCHERS', value: c.searchers_7d, sub: `${c.searches_per_user.toFixed(1)} searches per user` },
          { label: 'CTR',           value: formatPercent(c.ctr * 100), sub: `${formatNumber(c.clicks_7d)} result clicks` },
        ]} />
      </div>

      <div>
        <SectionTitle>Search Quality</SectionTitle>
        <div className="sv-grid-4">
          <MetricCard label="NO-RESULTS RATE"
                      value={formatPercent(c.no_results_rate * 100)}
                      icon="🔍"
                      intent={noResultsIntent}
                      hint="zero-result searches" />
          <MetricCard label="MEDIAN RESULTS"
                      value={c.median_results}
                      icon="📊"
                      hint={`p95 ${c.p95_results}`} />
          <MetricCard label="CTR"
                      value={formatPercent(c.ctr * 100)}
                      icon="🖱"
                      intent={ctrIntent}
                      hint="click within 60s" />
          <MetricCard label="REFINEMENT"
                      value={formatPercent(c.refinement_rate * 100)}
                      icon="↻"
                      intent={refinementIntent}
                      hint="re-search within 2 min" />
          <MetricCard label="POWER USERS"
                      value={c.power_users}
                      icon="⚡"
                      hint="top 10% by volume" />
          <MetricCard label="THEIR SHARE"
                      value={formatPercent(c.power_user_share_of_searches * 100)}
                      icon="🎯"
                      hint="% of all searches by power users" />
          <MetricCard label="SEARCHES / USER"
                      value={c.searches_per_user.toFixed(1)}
                      icon="👤"
                      hint="avg per searcher 7d" />
          <MetricCard label="28D VOLUME"
                      value={c.searches_28d}
                      icon="📈"
                      hint="cumulative searches" />
        </div>
      </div>

      <div className="sv-card sv-card--padded">
        <SectionTitle>Daily Trend (28 days)</SectionTitle>
        <TimeSeriesChart
          series={[
            { key: 'searches',     label: 'Searches',      color: '#FFD600',
              values: data.daily.map(d => ({ day: d.day, value: d.searches })) },
            { key: 'clicks',       label: 'Result clicks', color: '#111315',
              values: data.daily.map(d => ({ day: d.day, value: d.clicks })) },
            { key: 'zero',         label: 'No-result',     color: '#9CA3AF',
              values: data.daily.map(d => ({ day: d.day, value: d.zero_results })) },
          ]}
        />
      </div>

      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>By Category</SectionTitle>
          <table className="sv-table">
            <thead>
              <tr>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Searches</th>
                <th style={{ textAlign: 'right' }}>0-result</th>
                <th style={{ textAlign: 'right', width: 160 }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {data.by_category.map((cat) => {
                const pct = (cat.searches / totalCategorySearches) * 100;
                const failPct = cat.searches ? (cat.zero_results / cat.searches) * 100 : 0;
                const failColor = failPct >= 30 ? 'rgb(190, 18, 60)' : failPct >= 15 ? 'var(--sv-black)' : 'rgb(5, 150, 105)';
                return (
                  <tr key={cat.category}>
                    <td style={{ fontWeight: 600 }}>{prettyCategory(cat.category)}</td>
                    <td className="numeric">{cat.searches}</td>
                    <td className="numeric" style={{ color: failColor, fontWeight: 700 }}>
                      {cat.zero_results} ({formatPercent(failPct)})
                    </td>
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
        </div>

        <div className="sv-card sv-card--padded">
          <SectionTitle>Query Length</SectionTitle>
          <table className="sv-table">
            <thead>
              <tr>
                <th>Length</th>
                <th style={{ textAlign: 'right' }}>Searches</th>
                <th style={{ textAlign: 'right', width: 160 }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {data.by_length.map((l) => {
                const pct = (l.n / totalLengthSearches) * 100;
                return (
                  <tr key={l.bucket}>
                    <td style={{ fontWeight: 600 }}>{prettyLength(l.bucket)}</td>
                    <td className="numeric">{l.n}</td>
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
        </div>
      </div>

      <div className="sv-card sv-card--padded">
        <SectionTitle right={
          <span className="sv-pill sv-pill--soft">
            healthy = top results clicked
          </span>
        }>Click Position Distribution</SectionTitle>
        <p style={{ color: 'var(--sv-grey-1)', fontSize: 16, marginTop: 0, marginBottom: 18 }}>
          Where in the result list users click. If most clicks are positions
          1–3, ranking is working. Lots of clicks past position 5 means users
          are scanning — ranking might need work.
        </p>
        <table className="sv-table">
          <thead>
            <tr>
              <th>Position</th>
              <th style={{ textAlign: 'right' }}>Clicks</th>
              <th style={{ textAlign: 'right', width: 240 }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {data.position_dist.map((p) => {
              const pct = (p.clicks / totalClicks) * 100;
              return (
                <tr key={p.position}>
                  <td style={{ fontWeight: 600 }}>#{p.position}</td>
                  <td className="numeric">{p.clicks}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <div className="sv-bar" style={{ width: 160 }}>
                        <span style={{ width: `${pct}%` }} />
                      </div>
                      <span style={{ fontWeight: 700, minWidth: 50 }}>{formatPercent(pct)}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const CATEGORY_PRETTY: Record<string, string> = {
  recipient_search: '👤  By Person',
  topic:            '💭  By Topic',
  attachment:       '📎  By Attachment',
  date_range:       '📅  By Date Range',
  unclassified:     '🔎  Unclassified',
};
function prettyCategory(c: string): string { return CATEGORY_PRETTY[c] ?? c; }

const LENGTH_PRETTY: Record<string, string> = {
  '1-3':  '1–3 chars (very short)',
  '4-10': '4–10 chars (short)',
  '11-30':'11–30 chars (typical)',
  '31+':  '31+ chars (long)',
};
function prettyLength(b: string): string { return LENGTH_PRETTY[b] ?? b; }

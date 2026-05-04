// Directory section dashboard.
// Question: are people finding services they need, getting through to
// contact actions, and is review/claim activity healthy?

import * as React from 'react';
import { MetricCard, BigNumberTriple } from '../../components/MetricCard';
import { SectionTitle } from '../../components/SectionTitle';
import { TimeSeriesChart } from '../../components/TimeSeriesChart';
import { formatNumber, formatPercent } from '../../lib/format';

interface DirectoryPayload {
  cards: {
    dir_views_7d: number;
    dir_views_24h: number;
    searches_7d: number;
    no_results_7d: number;
    impressions_7d: number;
    service_views_7d: number;
    service_views_28d: number;
    actions_7d: number;
    saved_7d: number;
    reviews_28d: number;
    claims_started_28d: number;
    claims_completed_28d: number;
    searchers_7d: number;
    map_views_7d: number;
    avg_rating: number | null;
    search_action_rate: number;
    no_results_rate: number;
    detail_ctr: number;
    action_per_detail: number;
    save_per_detail: number;
    claim_conversion: number;
    map_share: number;
  };
  by_action:        { action: string; n: number }[];
  by_filter:        { filter_type: string; n: number }[];
  by_view_source:   { source: string; n: number }[];
  by_rating:        { rating: number; n: number }[];
  by_provider_type: { provider_type: string; n: number }[];
  by_view_mode:     { view_mode: string; n: number }[];
  daily:            { day: string; dir_views: number; service_views: number; actions: number; claims: number }[];
}

const ACTION_COLORS: Record<string, string> = {
  call: '#34D399',
  website: '#3B82F6',
  directions: '#FFD600',
  email: '#A78BFA',
  message: '#FB7185',
  book: '#F59E0B',
};

function pretty(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function ratingStars(r: number): string {
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

export function DirectorySection() {
  const [data, setData] = React.useState<DirectoryPayload | null>(null);
  const [err,  setErr]  = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch('/api/analytics/query/section/directory', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((d: DirectoryPayload) => alive && setData(d))
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, []);

  if (err)   return <div className="sv-spinner" style={{ color: 'rgb(190, 18, 60)' }}>Error: {err}</div>;
  if (!data) return <div className="sv-spinner">Loading…</div>;

  const c = data.cards;

  const actionRateIntent: 'positive' | 'neutral' | 'warn' =
    c.search_action_rate >= 0.40 ? 'positive' : c.search_action_rate >= 0.20 ? 'neutral' : 'warn';
  const noResultsIntent: 'positive' | 'warn' | 'critical' | 'neutral' =
    c.no_results_rate <= 0.10 ? 'positive' : c.no_results_rate <= 0.20 ? 'neutral' : c.no_results_rate <= 0.30 ? 'warn' : 'critical';
  const ctrIntent: 'positive' | 'neutral' | 'warn' =
    c.detail_ctr >= 0.10 ? 'positive' : c.detail_ctr >= 0.05 ? 'neutral' : 'warn';
  const actionPerDetailIntent: 'positive' | 'neutral' | 'warn' =
    c.action_per_detail >= 0.25 ? 'positive' : c.action_per_detail >= 0.15 ? 'neutral' : 'warn';
  const claimIntent: 'positive' | 'neutral' | 'warn' =
    c.claim_conversion >= 0.60 ? 'positive' : c.claim_conversion >= 0.40 ? 'neutral' : 'warn';
  const ratingIntent: 'positive' | 'neutral' | 'warn' =
    (c.avg_rating ?? 0) >= 4.2 ? 'positive' : (c.avg_rating ?? 0) >= 3.5 ? 'neutral' : 'warn';

  const totalAction   = data.by_action.reduce((s, r) => s + r.n, 0) || 1;
  const totalFilter   = data.by_filter.reduce((s, r) => s + r.n, 0) || 1;
  const totalSource   = data.by_view_source.reduce((s, r) => s + r.n, 0) || 1;
  const totalRating   = data.by_rating.reduce((s, r) => s + r.n, 0) || 1;
  const totalProvider = data.by_provider_type.reduce((s, r) => s + r.n, 0) || 1;
  const listMode = data.by_view_mode.find(v => v.view_mode === 'list')?.n ?? 0;
  const mapMode  = data.by_view_mode.find(v => v.view_mode === 'map')?.n ?? 0;
  const totalMode = listMode + mapMode || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280, margin: '0 auto' }}>
      <div>
        <span className="sv-datecap">SECTION ANALYTICS · LAST 7 DAYS</span>
        <h1 className="sv-h1" style={{ marginTop: 6 }}>Directory</h1>
        <p style={{ color: 'var(--sv-grey-1)', marginTop: 10, fontSize: 19, lineHeight: 1.55, maxWidth: 820 }}>
          Are visitors finding the services they need, getting through to a
          contact action, and is review and claim activity keeping the
          listings healthy? This view tracks the search-to-action funnel,
          contact-action mix, and claim conversion.
        </p>
      </div>

      {/* Hero */}
      <div className="sv-card sv-card--padded">
        <SectionTitle right={<span className="sv-pill sv-pill--soft">7-day window</span>}>
          This Week
        </SectionTitle>
        <BigNumberTriple items={[
          { label: 'SERVICES VIEWED',  value: c.service_views_28d, sub: `${formatNumber(c.service_views_7d)} in last 7 days` },
          { label: 'ACTIVE SEARCHERS', value: c.searchers_7d,      sub: `${formatNumber(c.searches_7d)} searches this week` },
          { label: 'CONTACT ACTIONS',  value: c.actions_7d,        sub: `${formatNumber(c.dir_views_24h)} dir views in 24h` },
        ]} />
      </div>

      {/* Engagement grid */}
      <div>
        <SectionTitle>Search → Action Health</SectionTitle>
        <div className="sv-grid-4">
          <MetricCard label="SEARCH→ACTION RATE"
                      value={formatPercent(c.search_action_rate * 100)}
                      icon="🎯"
                      intent={actionRateIntent}
                      hint={`${formatNumber(c.actions_7d)} actions / ${formatNumber(c.searches_7d)} searches`} />
          <MetricCard label="NO-RESULTS RATE"
                      value={formatPercent(c.no_results_rate * 100)}
                      icon="🚫"
                      intent={noResultsIntent}
                      hint={`${formatNumber(c.no_results_7d)} dead-end queries`} />
          <MetricCard label="DETAIL CTR"
                      value={formatPercent(c.detail_ctr * 100)}
                      icon="🔍"
                      intent={ctrIntent}
                      hint={`${formatNumber(c.service_views_7d)} detail / ${formatNumber(c.impressions_7d)} impressions`} />
          <MetricCard label="ACTION PER DETAIL"
                      value={formatPercent(c.action_per_detail * 100)}
                      icon="📞"
                      intent={actionPerDetailIntent}
                      hint={`${formatNumber(c.actions_7d)} actions / ${formatNumber(c.service_views_7d)} views`} />
          <MetricCard label="SAVE PER DETAIL"
                      value={formatPercent(c.save_per_detail * 100)}
                      icon="🔖"
                      hint={`${formatNumber(c.saved_7d)} saved this week`} />
          <MetricCard label="AVG RATING"
                      value={c.avg_rating != null ? `${c.avg_rating.toFixed(1)} ★` : '—'}
                      icon="⭐"
                      intent={ratingIntent}
                      hint={`from ${formatNumber(c.reviews_28d)} reviews (28d)`} />
          <MetricCard label="CLAIM CONVERSION"
                      value={formatPercent(c.claim_conversion * 100)}
                      icon="✅"
                      intent={claimIntent}
                      hint={`${formatNumber(c.claims_completed_28d)} claimed / ${formatNumber(c.claims_started_28d)} started (28d)`} />
          <MetricCard label="MAP MODE SHARE"
                      value={formatPercent(c.map_share * 100)}
                      icon="🗺️"
                      hint={`${formatNumber(c.map_views_7d)} map views this week`} />
        </div>
      </div>

      {/* Discovery funnel */}
      <div className="sv-card sv-card--padded">
        <SectionTitle>Discovery Funnel (7 days)</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {([
            { label: 'Directory viewed',    value: c.dir_views_7d },
            { label: 'Service impressions', value: c.impressions_7d },
            { label: 'Service detail',      value: c.service_views_7d },
            { label: 'Contact action',      value: c.actions_7d },
            { label: 'Saved',               value: c.saved_7d },
          ] as const).map((row) => {
            const max = c.impressions_7d || 1;
            const pct = (row.value / max) * 100;
            const isFinal = row.label === 'Saved';
            return (
              <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 80px 80px', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sv-grey-1)' }}>{row.label}</span>
                <div className="sv-bar" style={{ width: '100%' }}>
                  <span style={{ width: `${Math.min(pct, 100)}%`, background: isFinal ? '#34D399' : 'var(--sv-yellow)' }} />
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
            { key: 'dir_views',     label: 'Directory views', color: '#FFD600',
              values: data.daily.map(d => ({ day: d.day, value: d.dir_views })) },
            { key: 'service_views', label: 'Service detail',  color: '#111315',
              values: data.daily.map(d => ({ day: d.day, value: d.service_views })) },
            { key: 'actions',       label: 'Contact actions', color: '#34D399',
              values: data.daily.map(d => ({ day: d.day, value: d.actions })) },
            { key: 'claims',        label: 'Claims',          color: '#A78BFA',
              values: data.daily.map(d => ({ day: d.day, value: d.claims })) },
          ]}
        />
      </div>

      {/* Contact actions + filters */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>Contact Actions (28d)</SectionTitle>
          {data.by_action.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No actions in window.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Action</th><th style={{textAlign:'right'}}>Clicks</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_action.map((r) => {
                  const pct = (r.n / totalAction) * 100;
                  const color = ACTION_COLORS[r.action] ?? 'var(--sv-yellow)';
                  return (
                    <tr key={r.action}>
                      <td style={{ fontWeight: 600 }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color, marginRight: 8 }} />
                        {pretty(r.action)}
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
          <SectionTitle>Filter Mix (28d)</SectionTitle>
          {data.by_filter.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No filter changes in window.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Filter</th><th style={{textAlign:'right'}}>Uses</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_filter.map((r) => {
                  const pct = (r.n / totalFilter) * 100;
                  return (
                    <tr key={r.filter_type}>
                      <td style={{ fontWeight: 600 }}>{pretty(r.filter_type)}</td>
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

      {/* Review ratings + claim provider types */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>Review Rating Distribution (28d)</SectionTitle>
          {data.by_rating.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No reviews in window.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Rating</th><th style={{textAlign:'right'}}>Count</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_rating.map((r) => {
                  const pct = (r.n / totalRating) * 100;
                  const isHigh = r.rating >= 4;
                  const isLow  = r.rating <= 2;
                  return (
                    <tr key={r.rating}>
                      <td style={{ fontWeight: 600, color: isHigh ? 'rgb(5, 150, 105)' : isLow ? 'rgb(190, 18, 60)' : 'var(--sv-black)' }}>
                        {ratingStars(r.rating)}
                      </td>
                      <td className="numeric">{r.n}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <div className="sv-bar" style={{ width: 80 }}>
                            <span style={{ width: `${pct}%`, background: isHigh ? '#34D399' : isLow ? '#FB7185' : 'var(--sv-yellow)' }} />
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
          <SectionTitle>Claim Provider Types (28d)</SectionTitle>
          {data.by_provider_type.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No claims in window.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Provider</th><th style={{textAlign:'right'}}>Claimed</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_provider_type.map((r) => {
                  const pct = (r.n / totalProvider) * 100;
                  return (
                    <tr key={r.provider_type}>
                      <td style={{ fontWeight: 600 }}>{pretty(r.provider_type)}</td>
                      <td className="numeric">{r.n}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%`, background: '#A78BFA' }} /></div>
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

      {/* List vs map view + view sources */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>List vs Map (28d)</SectionTitle>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', height: 40, borderRadius: 8, overflow: 'hidden', background: 'var(--sv-grey-3, #f3f4f6)' }}>
              <div style={{
                width: `${(listMode / totalMode) * 100}%`,
                background: 'var(--sv-yellow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14, color: 'var(--sv-black)',
              }}>
                {listMode > 0 ? `${listMode} list` : ''}
              </div>
              <div style={{
                width: `${(mapMode / totalMode) * 100}%`,
                background: 'var(--sv-black)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14, color: '#fff',
              }}>
                {mapMode > 0 ? `${mapMode} map` : ''}
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 15, color: 'var(--sv-grey-1)' }}>
              {formatPercent((mapMode / totalMode) * 100)} of directory loads use map mode.
            </div>
          </div>
        </div>

        <div className="sv-card sv-card--padded">
          <SectionTitle>How Users Reach Service Detail (28d)</SectionTitle>
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
    </div>
  );
}

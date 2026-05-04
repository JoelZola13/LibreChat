// Street Gallery section dashboard.
// Question: are artists uploading, are visitors finding work,
// and is anything converting to engagement or sales?

import * as React from 'react';
import { MetricCard, BigNumberTriple } from '../../components/MetricCard';
import { SectionTitle } from '../../components/SectionTitle';
import { TimeSeriesChart } from '../../components/TimeSeriesChart';
import { formatNumber, formatPercent } from '../../lib/format';

interface GalleryPayload {
  cards: {
    views_7d: number;
    views_24h: number;
    impressions_7d: number;
    detail_views_7d: number;
    favs_7d: number;
    comments_7d: number;
    shares_7d: number;
    artist_clicks_7d: number;
    uploads_started_28d: number;
    uploads_blocked_28d: number;
    uploads_28d: number;
    uploads_7d: number;
    sold_28d: number;
    active_artists_7d: number;
    for_sale_28d: number;
    upload_conversion: number;
    block_rate: number;
    detail_ctr: number;
    engagement_rate: number;
    for_sale_share: number;
    sold_rate: number;
    artist_ctr: number;
  };
  by_medium:       { medium: string; n: number }[];
  by_block_reason: { reason: string; n: number }[];
  by_share_method: { share_method: string; n: number }[];
  by_price:        { bucket: string; n: number }[];
  by_sold_price:   { price_bucket: string; n: number }[];
  by_comment_type: { comment_type: string; n: number }[];
  daily: { day: string; viewed: number; detail_viewed: number; favorited: number; uploaded: number }[];
}

const MEDIUM_COLORS: Record<string, string> = {
  painting: '#FFD600',
  photo: '#3B82F6',
  digital: '#A78BFA',
  sculpture: '#F59E0B',
  illustration: '#34D399',
  print: '#FB7185',
  mixed: '#9CA3AF',
};

const COMMENT_COLORS: Record<string, string> = {
  praise: '#34D399',
  question: '#3B82F6',
  feedback: '#FFD600',
  tag: '#A78BFA',
  spam: '#FB7185',
};

function pretty(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function StreetGallerySection() {
  const [data, setData] = React.useState<GalleryPayload | null>(null);
  const [err,  setErr]  = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch('/api/analytics/query/section/gallery', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((d: GalleryPayload) => alive && setData(d))
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, []);

  if (err)   return <div className="sv-spinner" style={{ color: 'rgb(190, 18, 60)' }}>Error: {err}</div>;
  if (!data) return <div className="sv-spinner">Loading…</div>;

  const c = data.cards;

  const conversionIntent: 'positive' | 'neutral' | 'warn' =
    c.upload_conversion >= 0.65 ? 'positive' : c.upload_conversion >= 0.40 ? 'neutral' : 'warn';
  const blockIntent: 'positive' | 'warn' | 'critical' | 'neutral' =
    c.block_rate < 0.05 ? 'positive' : c.block_rate < 0.15 ? 'neutral' : c.block_rate < 0.25 ? 'warn' : 'critical';
  const ctrIntent: 'positive' | 'neutral' | 'warn' =
    c.detail_ctr >= 0.10 ? 'positive' : c.detail_ctr >= 0.05 ? 'neutral' : 'warn';
  const engagementIntent: 'positive' | 'neutral' | 'warn' =
    c.engagement_rate >= 0.15 ? 'positive' : c.engagement_rate >= 0.07 ? 'neutral' : 'warn';
  const soldIntent: 'positive' | 'neutral' | 'warn' =
    c.sold_rate >= 0.20 ? 'positive' : c.sold_rate >= 0.10 ? 'neutral' : 'warn';

  const totalMedium  = data.by_medium.reduce((s, r) => s + r.n, 0) || 1;
  const totalBlock   = data.by_block_reason.reduce((s, r) => s + r.n, 0) || 1;
  const totalShare   = data.by_share_method.reduce((s, r) => s + r.n, 0) || 1;
  const totalSold    = data.by_sold_price.reduce((s, r) => s + r.n, 0) || 1;
  const totalComment = data.by_comment_type.reduce((s, r) => s + r.n, 0) || 1;
  const forSaleRow   = data.by_price.find(r => r.bucket === 'for_sale')?.n ?? 0;
  const notForSaleRow = data.by_price.find(r => r.bucket === 'not_for_sale')?.n ?? 0;
  const totalUploadsBucketed = forSaleRow + notForSaleRow || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280, margin: '0 auto' }}>
      <div>
        <span className="sv-datecap">SECTION ANALYTICS · LAST 7 DAYS</span>
        <h1 className="sv-h1" style={{ marginTop: 6 }}>Street Gallery</h1>
        <p style={{ color: 'var(--sv-grey-1)', marginTop: 10, fontSize: 19, lineHeight: 1.55, maxWidth: 820 }}>
          Are artists uploading, are visitors finding work, and is anything
          converting to engagement or sales? This view covers the upload
          funnel, the impression→detail→engagement pipeline, and the
          for-sale → sold rate.
        </p>
      </div>

      {/* Hero */}
      <div className="sv-card sv-card--padded">
        <SectionTitle right={<span className="sv-pill sv-pill--soft">7-day window</span>}>
          This Week
        </SectionTitle>
        <BigNumberTriple items={[
          { label: 'ARTWORKS UPLOADED', value: c.uploads_28d,        sub: `${formatNumber(c.uploads_7d)} in last 7 days` },
          { label: 'ACTIVE ARTISTS',    value: c.active_artists_7d,  sub: `${formatNumber(c.uploads_7d)} uploads this week` },
          { label: 'GALLERY VIEWS',     value: c.views_7d,           sub: `${formatNumber(c.views_24h)} in last 24h` },
        ]} />
      </div>

      {/* Engagement grid */}
      <div>
        <SectionTitle>Funnel & Engagement</SectionTitle>
        <div className="sv-grid-4">
          <MetricCard label="UPLOAD CONVERSION"
                      value={formatPercent(c.upload_conversion * 100)}
                      icon="⬆️"
                      intent={conversionIntent}
                      hint={`${formatNumber(c.uploads_started_28d)} started → ${formatNumber(c.uploads_28d)} done (28d)`} />
          <MetricCard label="UPLOAD BLOCK RATE"
                      value={formatPercent(c.block_rate * 100)}
                      icon="🚫"
                      intent={blockIntent}
                      hint={`${formatNumber(c.uploads_blocked_28d)} blocked starts (28d)`} />
          <MetricCard label="DETAIL CTR"
                      value={formatPercent(c.detail_ctr * 100)}
                      icon="🔍"
                      intent={ctrIntent}
                      hint={`${formatNumber(c.detail_views_7d)} detail / ${formatNumber(c.impressions_7d)} impressions`} />
          <MetricCard label="ENGAGEMENT PER VIEW"
                      value={formatPercent(c.engagement_rate * 100)}
                      icon="❤️"
                      intent={engagementIntent}
                      hint={`${formatNumber(c.favs_7d + c.comments_7d)} faves+comments / ${formatNumber(c.detail_views_7d)} views`} />
          <MetricCard label="FOR-SALE SHARE"
                      value={formatPercent(c.for_sale_share * 100)}
                      icon="💵"
                      hint={`${formatNumber(c.for_sale_28d)} listed / ${formatNumber(c.uploads_28d)} uploads`} />
          <MetricCard label="SOLD RATE"
                      value={formatPercent(c.sold_rate * 100)}
                      icon="🏷️"
                      intent={soldIntent}
                      hint={`${formatNumber(c.sold_28d)} sold / ${formatNumber(c.for_sale_28d)} listed`} />
          <MetricCard label="ARTIST-LINK CTR"
                      value={formatPercent(c.artist_ctr * 100)}
                      icon="🎨"
                      hint={`${formatNumber(c.artist_clicks_7d)} clicks to artist / detail views`} />
          <MetricCard label="28D UPLOADS"
                      value={c.uploads_28d}
                      icon="📦"
                      hint="cumulative monthly artworks" />
        </div>
      </div>

      {/* Funnel: gallery → impressions → detail → favorited */}
      <div className="sv-card sv-card--padded">
        <SectionTitle>Engagement Funnel (7 days)</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {([
            { label: 'Gallery viewed',   value: c.views_7d },
            { label: 'Artwork impressions', value: c.impressions_7d },
            { label: 'Detail views',     value: c.detail_views_7d },
            { label: 'Favorited',        value: c.favs_7d },
            { label: 'Commented',        value: c.comments_7d },
            { label: 'Shared',           value: c.shares_7d },
          ] as const).map((row, i) => {
            const max = c.impressions_7d || 1;
            const pct = (row.value / max) * 100;
            const isFinal = row.label === 'Shared';
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
            { key: 'viewed',        label: 'Gallery views',  color: '#FFD600',
              values: data.daily.map(d => ({ day: d.day, value: d.viewed })) },
            { key: 'detail_viewed', label: 'Detail views',   color: '#111315',
              values: data.daily.map(d => ({ day: d.day, value: d.detail_viewed })) },
            { key: 'favorited',     label: 'Favorited',      color: '#FB7185',
              values: data.daily.map(d => ({ day: d.day, value: d.favorited })) },
            { key: 'uploaded',      label: 'Uploaded',       color: '#34D399',
              values: data.daily.map(d => ({ day: d.day, value: d.uploaded })) },
          ]}
        />
      </div>

      {/* Medium + comment type */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>Uploads by Medium (28d)</SectionTitle>
          {data.by_medium.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No uploads in window.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Medium</th><th style={{textAlign:'right'}}>Uploads</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_medium.map((r) => {
                  const pct = (r.n / totalMedium) * 100;
                  const color = MEDIUM_COLORS[r.medium] ?? 'var(--sv-yellow)';
                  return (
                    <tr key={r.medium}>
                      <td style={{ fontWeight: 600 }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color, marginRight: 8 }} />
                        {pretty(r.medium)}
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
          <SectionTitle>Comment Types (28d)</SectionTitle>
          {data.by_comment_type.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No comments in window.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Type</th><th style={{textAlign:'right'}}>Comments</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_comment_type.map((r) => {
                  const pct = (r.n / totalComment) * 100;
                  const color = COMMENT_COLORS[r.comment_type] ?? 'var(--sv-yellow)';
                  const isSpam = r.comment_type === 'spam';
                  return (
                    <tr key={r.comment_type}>
                      <td style={{ fontWeight: 600, color: isSpam ? 'rgb(190, 18, 60)' : 'var(--sv-black)' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color, marginRight: 8 }} />
                        {pretty(r.comment_type)}
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
      </div>

      {/* Block reasons + share methods */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>Upload Block Reasons (28d)</SectionTitle>
          {data.by_block_reason.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No blocked uploads.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Reason</th><th style={{textAlign:'right'}}>Count</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_block_reason.map((r) => {
                  const pct = (r.n / totalBlock) * 100;
                  return (
                    <tr key={r.reason}>
                      <td style={{ fontWeight: 600, color: 'rgb(190, 18, 60)' }}>{pretty(r.reason)}</td>
                      <td className="numeric">{r.n}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%`, background: '#FB7185' }} /></div>
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

      {/* For-sale split + sold price buckets */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>For-Sale Listings (28d)</SectionTitle>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', height: 40, borderRadius: 8, overflow: 'hidden', background: 'var(--sv-grey-3, #f3f4f6)' }}>
              <div style={{
                width: `${(forSaleRow / totalUploadsBucketed) * 100}%`,
                background: 'var(--sv-yellow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14, color: 'var(--sv-black)',
              }}>
                {forSaleRow > 0 ? `${forSaleRow} for sale` : ''}
              </div>
              <div style={{
                width: `${(notForSaleRow / totalUploadsBucketed) * 100}%`,
                background: 'var(--sv-black)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14, color: '#fff',
              }}>
                {notForSaleRow > 0 ? `${notForSaleRow} not for sale` : ''}
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 15, color: 'var(--sv-grey-1)' }}>
              {formatPercent(c.for_sale_share * 100)} of uploads are listed for sale.
            </div>
          </div>
        </div>

        <div className="sv-card sv-card--padded">
          <SectionTitle>Sold by Price Bucket (28d)</SectionTitle>
          {data.by_sold_price.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No sales in window.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Price</th><th style={{textAlign:'right'}}>Sold</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_sold_price.map((r) => {
                  const pct = (r.n / totalSold) * 100;
                  return (
                    <tr key={r.price_bucket}>
                      <td style={{ fontWeight: 600, color: 'rgb(5, 150, 105)' }}>${pretty(r.price_bucket)}</td>
                      <td className="numeric">{r.n}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%`, background: '#34D399' }} /></div>
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

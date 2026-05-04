import * as React from 'react';
import { api, type OverviewResponse } from '../lib/api';
import { MetricCard, BigNumberTriple } from '../components/MetricCard';
import { SectionTitle } from '../components/SectionTitle';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { formatPercent } from '../lib/format';

export function OverviewTab() {
  const [data, setData] = React.useState<OverviewResponse | null>(null);
  const [err,  setErr]  = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    api.overview(28).then(
      (d) => alive && setData(d),
      (e) => alive && setErr(String(e)),
    );
    return () => { alive = false; };
  }, []);

  if (err)  return <div className="sv-spinner" style={{ color: 'rgb(190, 18, 60)' }}>Error: {err}</div>;
  if (!data) return <div className="sv-spinner">Loading…</div>;

  const c = data.cards;
  const errorIntent = c.errors_24h > 50 ? 'critical' : c.errors_24h > 10 ? 'warn' : 'neutral';
  const rageIntent  = c.rage_clicks_24h > 20 ? 'warn' : 'neutral';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280, margin: '0 auto' }}>
      <div>
        <span className="sv-datecap">SNAPSHOT · LAST 7 DAYS</span>
        <h1 className="sv-h1" style={{ marginTop: 6 }}>Overview</h1>
      </div>

      <div className="sv-card sv-card--padded">
        <SectionTitle>This Week</SectionTitle>
        <BigNumberTriple items={[
          { label: 'WEEKLY ACTIVE',  value: c.wau,             sub: 'unique users 7d' },
          { label: 'DAILY ACTIVE',   value: c.dau,             sub: 'last 24h' },
          { label: 'NEW PROFILES',   value: c.new_profiles_7d, sub: 'street profiles created' },
        ]} />
      </div>

      <div>
        <SectionTitle>Conversions (7 days)</SectionTitle>
        <div className="sv-grid-4">
          <MetricCard label="JOB APPLICATIONS"   value={c.applications_7d}    icon="📨" />
          <MetricCard label="ARTWORKS UPLOADED"  value={c.artworks_7d}        icon="🎨" />
          <MetricCard label="LESSONS COMPLETED"  value={c.lessons_7d}         icon="🎓" />
          <MetricCard label="SERVICE ACTIONS"    value={c.service_actions_7d} icon="📞" />
          <MetricCard label="MESSAGES SENT"      value={c.messages_7d}        icon="💬" />
          <MetricCard label="ERRORS 24H"         value={c.errors_24h}         icon="⚠️" intent={errorIntent} />
          <MetricCard label="RAGE CLICKS 24H"    value={c.rage_clicks_24h}    icon="😡" intent={rageIntent} />
          <MetricCard label="HEALTH"
                      value={c.applications_7d > 10 ? '↗ healthy' : '—'}
                      icon="📈"
                      hint="conversions look good" />
        </div>
      </div>

      <div className="sv-card sv-card--padded">
        <SectionTitle>Daily Activity (28 days)</SectionTitle>
        <TimeSeriesChart
          series={[
            { key: 'dau',         label: 'Daily active users',  color: '#FFD600',
              values: data.daily.map(d => ({ day: d.day, value: d.dau })) },
            { key: 'meaningful',  label: 'Meaningful actions',  color: '#111315',
              values: data.daily.map(d => ({ day: d.day, value: d.meaningful_actions })) },
            { key: 'conversions', label: 'Conversions',         color: '#9CA3AF',
              values: data.daily.map(d => ({ day: d.day, value: d.conversions })) },
          ]}
        />
      </div>

      <div className="sv-card sv-card--padded">
        <SectionTitle>Adoption by Product Area (28 days)</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.by_product_area.slice(0, 12).map((row) => {
            const max = data.by_product_area[0]?.active_users || 1;
            const pct = (row.active_users / max) * 100;
            const conv = row.conversions
              ? formatPercent((row.conversions / Math.max(row.active_users, 1)) * 100)
              : '';
            return (
              <div key={row.product_area} style={{
                display: 'grid',
                gridTemplateColumns: '210px 1fr 110px 120px',
                alignItems: 'center',
                gap: 16,
                fontSize: 18,
                padding: '6px 0',
              }}>
                <div style={{ fontWeight: 600, color: 'var(--sv-black)' }}>{row.product_area}</div>
                <div className="sv-bar"><span style={{ width: `${pct}%` }} /></div>
                <div style={{
                  textAlign: 'right', fontWeight: 700, fontSize: 19,
                  fontVariantNumeric: 'tabular-nums', color: 'var(--sv-black)',
                }}>{row.active_users.toLocaleString()}</div>
                <div style={{
                  textAlign: 'right', fontSize: 15, fontWeight: 600, color: 'var(--sv-grey-1)',
                }}>{conv ? `${conv} conv` : ''}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

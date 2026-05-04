// Platform tab — service health, latency trend, API routes, alerts.

import * as React from 'react';
import { api } from '../lib/api';
import { SectionTitle } from '../components/SectionTitle';
import { BigNumberTriple, MetricCard } from '../components/MetricCard';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { formatMs, formatNumber, formatRelativeTime, formatPercent } from '../lib/format';

interface ServiceRow {
  service: string;
  avg_latency_ms: number | null;
  p50: number | null;
  p95: number | null;
  failures: number | null;
  samples: number | null;
  last_seen: string | null;
  avg_24h: number | null;
  p95_24h: number | null;
  failures_24h: number | null;
  samples_24h: number | null;
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
}
interface PlatformResponse {
  services: ServiceRow[];
  trend: { hour: string; p50: number; p95: number; samples: number; failures: number }[];
  hero: {
    services_active: number;
    services_seen_24h: number;
    api_requests_24h: number;
    failures_24h: number;
    open_alerts: number;
    p95_overall: number | null;
    p50_overall: number | null;
  };
}

const STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  healthy:  { color: 'rgb(5, 150, 105)',  bg: 'rgba(16, 185, 129, 0.10)', label: 'Healthy' },
  degraded: { color: 'rgb(180, 83, 9)',   bg: 'rgba(245, 158, 11, 0.15)', label: 'Degraded' },
  down:     { color: 'rgb(190, 18, 60)',  bg: 'rgba(244, 63, 94, 0.10)',  label: 'Down' },
};

export function PlatformHealthTab() {
  const [data, setData] = React.useState<PlatformResponse | null>(null);
  const [routes, setRoutes] = React.useState<any[]>([]);
  const [alerts, setAlerts] = React.useState<any[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    Promise.all([api.platformHealth(), api.platformApi(), api.alerts()])
      .then(([h, r, a]) => {
        if (!alive) return;
        setData(h as PlatformResponse);
        setRoutes(r.routes);
        setAlerts(a.alerts);
      })
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, []);

  if (err)  return <div className="sv-spinner" style={{ color: 'rgb(190, 18, 60)' }}>Error: {err}</div>;
  if (!data) return <div className="sv-spinner">Loading…</div>;

  const openAlerts = alerts.filter((a: any) => a.state === 'open');
  const errorRate = data.hero.api_requests_24h > 0
    ? (data.hero.failures_24h / data.hero.api_requests_24h)
    : 0;
  const errorRateIntent: 'positive' | 'warn' | 'critical' | 'neutral' =
    errorRate < 0.01 ? 'positive' : errorRate < 0.05 ? 'neutral' : errorRate < 0.10 ? 'warn' : 'critical';

  const p95Intent: 'positive' | 'warn' | 'critical' | 'neutral' =
    !data.hero.p95_overall ? 'neutral' :
    data.hero.p95_overall < 800  ? 'positive' :
    data.hero.p95_overall < 1500 ? 'neutral'  :
    data.hero.p95_overall < 3000 ? 'warn'     : 'critical';

  const alertsIntent: 'positive' | 'warn' | 'critical' | 'neutral' =
    openAlerts.length === 0 ? 'positive' :
    openAlerts.some((a: any) => a.severity === 'critical') ? 'critical' : 'warn';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280, margin: '0 auto' }}>
      <div>
        <span className="sv-datecap">PLATFORM · LAST HOUR + 24H CONTEXT</span>
        <h1 className="sv-h1" style={{ marginTop: 6 }}>Platform</h1>
        <p style={{ color: 'var(--sv-grey-1)', marginTop: 10, fontSize: 19, lineHeight: 1.55, maxWidth: 820 }}>
          Are the services up and snappy? This view tracks per-service health,
          API latency trends, error rates, and any alerts firing right now.
        </p>
      </div>

      {/* Open alerts banner — pushed to the top so it can't be missed */}
      {openAlerts.length > 0 ? (
        <div className="sv-card" style={{
          padding: '18px 22px',
          borderColor: 'rgba(244, 63, 94, 0.45)',
          background: 'rgba(244, 63, 94, 0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{
              fontSize: 22, lineHeight: 1,
            }}>🚨</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: 'rgb(190, 18, 60)', letterSpacing: 0.5 }}>
              {openAlerts.length} OPEN {openAlerts.length === 1 ? 'ALERT' : 'ALERTS'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {openAlerts.map((a: any) => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                padding: '8px 0', borderTop: '1px solid rgba(244, 63, 94, 0.15)',
                fontSize: 16,
              }}>
                <span className={a.severity === 'critical' ? 'sv-pill sv-pill--rose' : 'sv-pill sv-pill--soft'}>
                  {a.severity}
                </span>
                <span style={{ fontWeight: 700, color: 'var(--sv-black)' }}>{a.title}</span>
                <span style={{ color: 'var(--sv-grey-1)', fontSize: 14 }}>· fired {formatRelativeTime(a.fired_at)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Hero */}
      <div className="sv-card sv-card--padded">
        <SectionTitle right={<span className="sv-pill sv-pill--soft">Live · last hour</span>}>
          Right Now
        </SectionTitle>
        <BigNumberTriple items={[
          { label: 'ACTIVE SERVICES', value: data.hero.services_active,   sub: `${formatNumber(data.hero.services_seen_24h)} seen in 24h` },
          { label: 'API REQUESTS 24H',value: formatNumber(data.hero.api_requests_24h), sub: `${formatNumber(data.hero.failures_24h)} failed` },
          { label: 'OPEN ALERTS',     value: data.hero.open_alerts,       sub: openAlerts.some((a: any) => a.severity === 'critical') ? 'critical present' : openAlerts.length ? 'monitor' : 'all clear' },
        ]} />
      </div>

      {/* Metric grid */}
      <div className="sv-grid-4">
        <MetricCard label="P50 LATENCY"
                    value={data.hero.p50_overall ? formatMs(data.hero.p50_overall) : '—'}
                    icon="⚡"
                    hint="median request" />
        <MetricCard label="P95 LATENCY"
                    value={data.hero.p95_overall ? formatMs(data.hero.p95_overall) : '—'}
                    icon="⚡"
                    intent={p95Intent}
                    hint="95th percentile" />
        <MetricCard label="ERROR RATE 24H"
                    value={formatPercent(errorRate * 100)}
                    icon="⚠️"
                    intent={errorRateIntent}
                    hint="failed ÷ all API requests" />
        <MetricCard label="ALERT STATE"
                    value={openAlerts.length === 0 ? '✓ Clear' : `${openAlerts.length} open`}
                    icon="🛎"
                    intent={alertsIntent}
                    hint={openAlerts.length === 0 ? 'no active alerts' : 'see banner above'} />
      </div>

      {/* Latency trend */}
      {data.trend.length > 0 ? (
        <div className="sv-card sv-card--padded">
          <SectionTitle right={<span className="sv-pill sv-pill--soft">24h hourly</span>}>
            Latency Trend
          </SectionTitle>
          <TimeSeriesChart
            series={[
              { key: 'p95', label: 'p95', color: '#111315',
                values: data.trend.map(t => ({ day: t.hour, value: t.p95 || 0 })) },
              { key: 'p50', label: 'p50', color: '#FFD600',
                values: data.trend.map(t => ({ day: t.hour, value: t.p50 || 0 })) },
            ]}
          />
        </div>
      ) : null}

      {/* Service status grid */}
      <div className="sv-card sv-card--padded">
        <SectionTitle right={<span className="sv-pill sv-pill--soft">Last hour</span>}>
          Services
        </SectionTitle>
        {data.services.length === 0 ? (
          <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>
            No samples in the last hour.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 14,
          }}>
            {data.services.map((s) => {
              const style = STATUS_STYLES[s.status];
              return (
                <div key={s.service} className="sv-card sv-card--compact"
                     style={{ borderColor: s.status === 'healthy' ? 'var(--sv-card-border)' : style.color }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: style.color,
                      boxShadow: s.status === 'healthy' ? '0 0 0 3px rgba(16, 185, 129, 0.15)' : `0 0 0 3px ${style.bg}`,
                    }} />
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 14, color: 'var(--sv-black)', flex: 1 }}>
                      {s.service}
                    </span>
                    <span className="sv-pill" style={{
                      color: style.color, background: style.bg, fontSize: 11,
                    }}>{style.label}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                    <div>
                      <div className="sv-metric-sm" style={{ fontSize: 22 }}>{s.p50 != null ? formatMs(s.p50) : '—'}</div>
                      <div className="sv-label" style={{ marginTop: 4 }}>P50</div>
                    </div>
                    <div>
                      <div className="sv-metric-sm" style={{ fontSize: 22 }}>{s.p95 != null ? formatMs(s.p95) : '—'}</div>
                      <div className="sv-label" style={{ marginTop: 4 }}>P95</div>
                    </div>
                  </div>
                  <div style={{
                    marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--sv-grey-5)',
                    fontSize: 13, color: 'var(--sv-grey-1)', display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span>{formatNumber(s.samples ?? 0)} samples · {formatNumber(s.failures ?? 0)} fail</span>
                    <span>{s.last_seen ? formatRelativeTime(s.last_seen) : 'never'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* API routes */}
      <div className="sv-card sv-card--padded">
        <SectionTitle right={<span className="sv-pill sv-pill--soft">24-hour window</span>}>
          API Routes
        </SectionTitle>
        {routes.length === 0 ? (
          <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>
            No API request samples.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sv-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Method</th>
                  <th>Route</th>
                  <th style={{ textAlign: 'right' }}>Samples</th>
                  <th style={{ textAlign: 'right' }}>Avg</th>
                  <th style={{ textAlign: 'right' }}>p95</th>
                  <th style={{ textAlign: 'right' }}>5xx</th>
                  <th style={{ textAlign: 'right' }}>4xx</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r, i) => {
                  const slow = r.p95 > 1500;
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 700 }}>{r.service ?? '—'}</td>
                      <td><span className="sv-pill sv-pill--grey">{r.method}</span></td>
                      <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{r.route_pattern}</td>
                      <td className="numeric">{formatNumber(r.samples)}</td>
                      <td className="numeric">{formatMs(r.avg_latency_ms)}</td>
                      <td className="numeric" style={{ color: slow ? 'rgb(180, 83, 9)' : 'inherit', fontWeight: slow ? 800 : 700 }}>
                        {formatMs(r.p95)}
                      </td>
                      <td className="numeric" style={{ color: r.errors_5xx > 0 ? 'rgb(190, 18, 60)' : 'inherit', fontWeight: r.errors_5xx > 0 ? 800 : 700 }}>
                        {r.errors_5xx}
                      </td>
                      <td className="numeric" style={{ color: r.errors_4xx > 0 ? 'rgb(180, 83, 9)' : 'inherit' }}>
                        {r.errors_4xx}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* All alerts */}
      <div className="sv-card sv-card--padded">
        <SectionTitle>All Alerts</SectionTitle>
        {alerts.length === 0 ? (
          <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>
            No alerts in window.
          </div>
        ) : (
          <table className="sv-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Alert</th>
                <th>State</th>
                <th>Threshold / Observed</th>
                <th>Fired</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a: any) => {
                const stateColor = a.state === 'open' ? 'rgb(190, 18, 60)' : a.state === 'acknowledged' ? 'rgb(180, 83, 9)' : 'rgb(5, 150, 105)';
                return (
                  <tr key={a.id}>
                    <td>
                      <span className={a.severity === 'critical' ? 'sv-pill sv-pill--rose' : a.severity === 'warn' ? 'sv-pill sv-pill--soft' : 'sv-pill sv-pill--grey'}>
                        {a.severity}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>{a.title}</td>
                    <td><span style={{ color: stateColor, fontWeight: 700, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1 }}>{a.state}</span></td>
                    <td style={{ fontSize: 14, color: 'var(--sv-grey-1)' }}>
                      {a.threshold != null ? `${a.threshold}` : '—'} / {a.observed != null ? `${a.observed}` : '—'}
                    </td>
                    <td style={{ color: 'var(--sv-grey-1)', fontSize: 14 }}>{formatRelativeTime(a.fired_at)}</td>
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

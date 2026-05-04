// Email section dashboard.
// Question: is the email tool actually being used, and does it convert?

import * as React from 'react';
import { MetricCard, BigNumberTriple } from '../../components/MetricCard';
import { SectionTitle } from '../../components/SectionTitle';
import { TimeSeriesChart } from '../../components/TimeSeriesChart';
import { formatNumber, formatPercent } from '../../lib/format';

interface EmailPayload {
  cards: {
    composed_24h: number;
    composed_7d: number;
    composed_28d: number;
    sent_7d: number;
    sent_24h: number;
    failed_7d: number;
    received_7d: number;
    opened_7d: number;
    replied_7d: number;
    active_senders_7d: number;
    send_rate: number;
    send_failure_rate: number;
    open_rate: number;
    reply_rate: number;
    attachment_rate: number;
    reply_share: number;
  };
  by_compose_time:    { bucket: string; n: number }[];
  by_recipient_count: { bucket: string; n: number }[];
  by_reply_time:      { bucket: string; n: number }[];
  by_error_code:      { error_code: string; n: number }[];
  by_from_domain:     { bucket: string; n: number }[];
  daily:              { day: string; composed: number; sent: number; received: number; replied: number }[];
}

export function EmailSection() {
  const [data, setData] = React.useState<EmailPayload | null>(null);
  const [err,  setErr]  = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch('/api/analytics/query/section/email', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((d: EmailPayload) => alive && setData(d))
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, []);

  if (err)   return <div className="sv-spinner" style={{ color: 'rgb(190, 18, 60)' }}>Error: {err}</div>;
  if (!data) return <div className="sv-spinner">Loading…</div>;

  const c = data.cards;
  const sendRateIntent: 'positive' | 'warn' | 'neutral' =
    c.send_rate >= 0.70 ? 'positive' : c.send_rate >= 0.40 ? 'neutral' : 'warn';
  const failureIntent: 'positive' | 'warn' | 'critical' | 'neutral' =
    c.send_failure_rate < 0.02 ? 'positive' : c.send_failure_rate < 0.08 ? 'warn' : 'critical';
  const replyIntent: 'positive' | 'neutral' | 'warn' =
    c.reply_rate >= 0.30 ? 'positive' : c.reply_rate >= 0.15 ? 'neutral' : 'warn';
  const openIntent: 'positive' | 'neutral' | 'warn' =
    c.open_rate >= 0.70 ? 'positive' : c.open_rate >= 0.50 ? 'neutral' : 'warn';

  const totalCompose = data.by_compose_time.reduce((s, r) => s + r.n, 0) || 1;
  const totalRecip   = data.by_recipient_count.reduce((s, r) => s + r.n, 0) || 1;
  const totalReply   = data.by_reply_time.reduce((s, r) => s + r.n, 0) || 1;
  const totalDomain  = data.by_from_domain.reduce((s, r) => s + r.n, 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280, margin: '0 auto' }}>
      <div>
        <span className="sv-datecap">SECTION ANALYTICS · LAST 7 DAYS</span>
        <h1 className="sv-h1" style={{ marginTop: 6 }}>Email</h1>
        <p style={{ color: 'var(--sv-grey-1)', marginTop: 10, fontSize: 19, lineHeight: 1.55, maxWidth: 820 }}>
          Is the email tool getting used, and is it converting? This view tracks
          compose-to-send funnel, reply rates on inbound, send failures, and
          attachment usage.
        </p>
      </div>

      <div className="sv-card sv-card--padded">
        <SectionTitle right={<span className="sv-pill sv-pill--soft">7-day window</span>}>
          This Week
        </SectionTitle>
        <BigNumberTriple items={[
          { label: 'EMAILS SENT',    value: c.sent_7d,           sub: `${formatNumber(c.sent_24h)} in last 24h` },
          { label: 'ACTIVE SENDERS', value: c.active_senders_7d, sub: `${formatNumber(c.received_7d)} inbound this week` },
          { label: 'REPLY RATE',     value: formatPercent(c.reply_rate * 100), sub: `${formatNumber(c.replied_7d)} replies sent` },
        ]} />
      </div>

      <div>
        <SectionTitle>Quality & Funnel</SectionTitle>
        <div className="sv-grid-4">
          <MetricCard label="SEND-RATE FROM COMPOSE"
                      value={formatPercent(c.send_rate * 100)}
                      icon="📤"
                      intent={sendRateIntent}
                      hint={`${formatNumber(c.composed_7d)} composed → ${formatNumber(c.sent_7d)} sent`} />
          <MetricCard label="SEND FAILURE"
                      value={formatPercent(c.send_failure_rate * 100)}
                      icon="⚠️"
                      intent={failureIntent}
                      hint={`${formatNumber(c.failed_7d)} failed sends`} />
          <MetricCard label="OPEN RATE"
                      value={formatPercent(c.open_rate * 100)}
                      icon="📬"
                      intent={openIntent}
                      hint={`${formatNumber(c.opened_7d)} opens / ${formatNumber(c.received_7d)} inbound`} />
          <MetricCard label="REPLY RATE"
                      value={formatPercent(c.reply_rate * 100)}
                      icon="↩️"
                      intent={replyIntent}
                      hint="opened → replied" />
          <MetricCard label="ATTACHMENT %"
                      value={formatPercent(c.attachment_rate * 100)}
                      icon="📎"
                      hint="sends with attachments" />
          <MetricCard label="REPLY SHARE"
                      value={formatPercent(c.reply_share * 100)}
                      icon="🔁"
                      hint="of sends that were replies" />
          <MetricCard label="COMPOSED 24H"
                      value={c.composed_24h}
                      icon="✏️"
                      hint="drafts opened today" />
          <MetricCard label="28D SENDS"
                      value={c.composed_28d}
                      icon="📊"
                      hint="cumulative monthly compose" />
        </div>
      </div>

      {/* Daily funnel */}
      <div className="sv-card sv-card--padded">
        <SectionTitle>Daily Funnel (28 days)</SectionTitle>
        <TimeSeriesChart
          series={[
            { key: 'composed', label: 'Composed',  color: '#FFD600',
              values: data.daily.map(d => ({ day: d.day, value: d.composed })) },
            { key: 'sent',     label: 'Sent',      color: '#111315',
              values: data.daily.map(d => ({ day: d.day, value: d.sent })) },
            { key: 'received', label: 'Received',  color: '#9CA3AF',
              values: data.daily.map(d => ({ day: d.day, value: d.received })) },
            { key: 'replied',  label: 'Replied',   color: '#34D399',
              values: data.daily.map(d => ({ day: d.day, value: d.replied })) },
          ]}
        />
      </div>

      {/* Two-column: compose time + recipient count */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>Compose Time</SectionTitle>
          {data.by_compose_time.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No data.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Time bucket</th><th style={{textAlign:'right'}}>Sends</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_compose_time.map((r) => {
                  const pct = (r.n / totalCompose) * 100;
                  return (
                    <tr key={r.bucket}>
                      <td style={{ fontWeight: 600 }}>{r.bucket}</td>
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
          <SectionTitle>Recipient Count</SectionTitle>
          {data.by_recipient_count.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No data.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Recipients</th><th style={{textAlign:'right'}}>Sends</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_recipient_count.map((r) => {
                  const pct = (r.n / totalRecip) * 100;
                  return (
                    <tr key={r.bucket}>
                      <td style={{ fontWeight: 600 }}>{r.bucket}</td>
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

      {/* Two-column: reply time + from domain */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>Time to Reply</SectionTitle>
          {data.by_reply_time.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No replies in window.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Window</th><th style={{textAlign:'right'}}>Replies</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_reply_time.map((r) => {
                  const pct = (r.n / totalReply) * 100;
                  const isFast = ['<1m','1-15m'].includes(r.bucket);
                  return (
                    <tr key={r.bucket}>
                      <td style={{ fontWeight: 600, color: isFast ? 'rgb(5, 150, 105)' : 'var(--sv-black)' }}>{r.bucket}</td>
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
          <SectionTitle>Inbound by Sender</SectionTitle>
          {data.by_from_domain.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No inbound data.</div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr><th>Sender bucket</th><th style={{textAlign:'right'}}>Inbound</th><th style={{textAlign:'right',width:160}}>Share</th></tr>
              </thead>
              <tbody>
                {data.by_from_domain.map((r) => {
                  const pct = (r.n / totalDomain) * 100;
                  return (
                    <tr key={r.bucket}>
                      <td style={{ fontWeight: 600 }}>{prettyDomain(r.bucket)}</td>
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

      {/* Send errors — only shown if there are any */}
      {data.by_error_code.length > 0 ? (
        <div className="sv-card sv-card--padded">
          <SectionTitle right={<span className="sv-pill sv-pill--rose">Last 28 days</span>}>
            Send Errors
          </SectionTitle>
          <table className="sv-table">
            <thead>
              <tr><th>Error code</th><th style={{textAlign:'right'}}>Count</th></tr>
            </thead>
            <tbody>
              {data.by_error_code.map((r) => (
                <tr key={r.error_code}>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: 'rgb(190, 18, 60)' }}>{r.error_code}</td>
                  <td className="numeric">{r.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

const DOMAIN_PRETTY: Record<string, string> = {
  internal:        '🏢  Internal',
  known_partner:   '🤝  Known partner',
  common_provider: '✉️  Common provider',
  unknown:         '❓  Unknown',
};
function prettyDomain(b: string): string { return DOMAIN_PRETTY[b] ?? b; }

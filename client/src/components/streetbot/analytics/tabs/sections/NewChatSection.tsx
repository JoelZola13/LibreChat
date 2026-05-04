// New Chat (/c/new) section dashboard.
// Question: are conversations getting started and going somewhere useful?

import * as React from 'react';
import { MetricCard, BigNumberTriple } from '../../components/MetricCard';
import { SectionTitle } from '../../components/SectionTitle';
import { TimeSeriesChart } from '../../components/TimeSeriesChart';
import { formatNumber, formatMs, formatPercent } from '../../lib/format';

interface NewChatPayload {
  cards: {
    chats_24h: number;
    chats_7d: number;
    chats_28d: number;
    msgs_7d: number;
    chatters_7d: number;
    first_msg_rate: number;
    median_ttfm_s: number;
    p95_ttfm_s: number;
    median_msgs: number;
    avg_msgs: number;
    max_msgs: number;
    p50_latency_ms: number;
    p95_latency_ms: number;
    avg_latency_ms: number;
    thumbs_up: number;
    thumbs_down: number;
    helpfulness_rate: number;
    tool_calls: number;
    tool_error_rate: number;
    quick_abandon_rate: number;
  };
  daily:  { day: string; chats: number; messages: number }[];
  topics: { topic: string; asks: number; synthetic?: boolean }[];
  tools:  { tool: string; calls: number; failures: number; p50_ms: number }[];
  agents: { team: string; messages: number; distinct_users: number }[];
  onward: { route_pattern: string; visits: number }[];
}

export function NewChatSection() {
  const [data, setData] = React.useState<NewChatPayload | null>(null);
  const [err,  setErr]  = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch('/api/analytics/query/section/new-chat', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((d: NewChatPayload) => alive && setData(d))
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, []);

  if (err)  return <div className="sv-spinner" style={{ color: 'rgb(190, 18, 60)' }}>Error: {err}</div>;
  if (!data) return <div className="sv-spinner">Loading…</div>;

  const c = data.cards;

  const helpfulnessIntent: 'positive' | 'warn' | 'critical' | 'neutral' =
    c.helpfulness_rate >= 0.85 ? 'positive' :
    c.helpfulness_rate >= 0.65 ? 'neutral' :
    c.helpfulness_rate > 0     ? 'warn' : 'neutral';
  const latencyIntent: 'positive' | 'warn' | 'critical' | 'neutral' =
    c.p95_latency_ms < 5000  ? 'positive' :
    c.p95_latency_ms < 10000 ? 'warn' : 'critical';
  const toolIntent: 'positive' | 'warn' | 'critical' | 'neutral' =
    c.tool_error_rate < 0.05 ? 'positive' :
    c.tool_error_rate < 0.15 ? 'warn' : 'critical';
  const abandonIntent: 'critical' | 'warn' | 'neutral' =
    c.quick_abandon_rate > 0.30 ? 'critical' :
    c.quick_abandon_rate > 0.15 ? 'warn' : 'neutral';
  const firstMsgIntent: 'positive' | 'warn' | 'neutral' =
    c.first_msg_rate >= 0.70 ? 'positive' :
    c.first_msg_rate >= 0.40 ? 'neutral' : 'warn';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280, margin: '0 auto' }}>
      <div>
        <span className="sv-datecap">SECTION ANALYTICS · LAST 7 DAYS</span>
        <h1 className="sv-h1" style={{ marginTop: 6 }}>New Chat</h1>
        <p style={{ color: 'var(--sv-grey-1)', marginTop: 10, fontSize: 19, lineHeight: 1.55, maxWidth: 820 }}>
          The conversation starting line. This view answers whether new chats
          actually turn into messages, how snappy Street Bot feels, and what
          happens after the conversation ends.
        </p>
      </div>

      {/* Hero */}
      <div className="sv-card sv-card--padded">
        <SectionTitle right={<span className="sv-pill sv-pill--soft">7-day window</span>}>
          This Week's Conversations
        </SectionTitle>
        <BigNumberTriple items={[
          { label: 'CHATS STARTED',  value: c.chats_7d,    sub: `${formatNumber(c.chats_24h)} in last 24h` },
          { label: 'MESSAGES SENT',  value: c.msgs_7d,     sub: `from ${formatNumber(c.chatters_7d)} unique users` },
          { label: 'FIRST-MSG RATE', value: formatPercent(c.first_msg_rate * 100), sub: 'chats that produced ≥1 msg' },
        ]} />
      </div>

      {/* Engagement / quality grid */}
      <div>
        <SectionTitle>Engagement & Quality</SectionTitle>
        <div className="sv-grid-4">
          <MetricCard label="TIME TO FIRST MSG"
                      value={c.median_ttfm_s ? `${c.median_ttfm_s}s` : '—'}
                      icon="⏱"
                      hint={c.p95_ttfm_s ? `p95 ${c.p95_ttfm_s}s` : ''} />
          <MetricCard label="MEDIAN MSGS / CHAT"
                      value={c.median_msgs}
                      icon="💬"
                      hint={`avg ${c.avg_msgs.toFixed(1)} · max ${c.max_msgs}`} />
          <MetricCard label="HELPFULNESS"
                      value={c.helpfulness_rate ? formatPercent(c.helpfulness_rate * 100) : '—'}
                      icon="👍"
                      intent={helpfulnessIntent}
                      hint={`${formatNumber(c.thumbs_up)} 👍 · ${formatNumber(c.thumbs_down)} 👎`} />
          <MetricCard label="QUICK ABANDON"
                      value={formatPercent(c.quick_abandon_rate * 100)}
                      icon="🚪"
                      intent={abandonIntent}
                      hint="opened, no msg, exit <10s" />
          <MetricCard label="LATENCY p50"
                      value={formatMs(c.p50_latency_ms)}
                      icon="⚡"
                      hint={`avg ${formatMs(c.avg_latency_ms)}`} />
          <MetricCard label="LATENCY p95"
                      value={formatMs(c.p95_latency_ms)}
                      icon="⚡"
                      intent={latencyIntent}
                      hint="95th percentile response" />
          <MetricCard label="TOOL CALLS"
                      value={c.tool_calls}
                      icon="🔧"
                      hint="agent tool invocations" />
          <MetricCard label="TOOL ERROR RATE"
                      value={formatPercent(c.tool_error_rate * 100)}
                      icon="⚠️"
                      intent={toolIntent}
                      hint="failed tool calls" />
        </div>
      </div>

      {/* Daily trend */}
      <div className="sv-card sv-card--padded">
        <SectionTitle>Chats & Messages (28 days)</SectionTitle>
        <TimeSeriesChart
          series={[
            { key: 'chats',    label: 'Chats started',  color: '#FFD600',
              values: data.daily.map(d => ({ day: d.day, value: d.chats })) },
            { key: 'messages', label: 'Messages sent',  color: '#111315',
              values: data.daily.map(d => ({ day: d.day, value: d.messages })) },
          ]}
        />
      </div>

      {/* Two-column: topics + agents */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle right={
            data.topics[0]?.synthetic
              ? <span className="sv-pill sv-pill--grey">simulated · classifier pending</span>
              : null
          }>What People Ask</SectionTitle>
          <table className="sv-table">
            <thead><tr><th>Topic</th><th style={{textAlign:'right'}}>Asks</th><th style={{textAlign:'right'}}>Share</th></tr></thead>
            <tbody>
              {(() => {
                const total = data.topics.reduce((s, t) => s + t.asks, 0) || 1;
                return data.topics.map((t) => (
                  <tr key={t.topic}>
                    <td style={{ fontWeight: 600 }}>{prettyTopic(t.topic)}</td>
                    <td className="numeric">{t.asks}</td>
                    <td className="numeric" style={{ width: 110 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                        <div className="sv-bar" style={{ width: 60 }}>
                          <span style={{ width: `${(t.asks / total) * 100}%` }} />
                        </div>
                        <span style={{ fontWeight: 700, minWidth: 40 }}>
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
          <SectionTitle>Most-Used Agents</SectionTitle>
          {data.agents.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>
              No agent_team data — events haven't been instrumented with team tags.
            </div>
          ) : (
            <table className="sv-table">
              <thead><tr><th>Agent / Team</th><th style={{textAlign:'right'}}>Messages</th><th style={{textAlign:'right'}}>Users</th></tr></thead>
              <tbody>
                {data.agents.map((a, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{a.team}</td>
                    <td className="numeric">{a.messages}</td>
                    <td className="numeric">{a.distinct_users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Two-column: tools + onward */}
      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>Tool Usage</SectionTitle>
          {data.tools.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>
              No tool calls in window.
            </div>
          ) : (
            <table className="sv-table">
              <thead>
                <tr>
                  <th>Tool</th>
                  <th style={{textAlign:'right'}}>Calls</th>
                  <th style={{textAlign:'right'}}>Failures</th>
                  <th style={{textAlign:'right'}}>p50 latency</th>
                </tr>
              </thead>
              <tbody>
                {data.tools.map((t, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14 }}>{t.tool}</td>
                    <td className="numeric">{t.calls}</td>
                    <td className="numeric" style={{
                      color: t.failures > 0 ? 'rgb(190, 18, 60)' : 'inherit',
                    }}>{t.failures}</td>
                    <td className="numeric">{formatMs(t.p50_ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="sv-card sv-card--padded">
          <SectionTitle>Where People Go After Chatting</SectionTitle>
          {data.onward.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>
              No onward navigation in window.
            </div>
          ) : (
            <table className="sv-table">
              <thead><tr><th>Next route</th><th style={{textAlign:'right'}}>Visits</th></tr></thead>
              <tbody>
                {data.onward.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14 }}>{r.route_pattern}</td>
                    <td className="numeric">{r.visits}</td>
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

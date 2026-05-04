// Replay tab — Session Inspector.
// Reconstructs what happened in any session by stepping through the
// chronological event timeline. No video — but every page entry, click,
// AI message, error, and conversion is tied to a session.

import * as React from 'react';
import { SectionTitle } from '../components/SectionTitle';
import { BigNumberTriple } from '../components/MetricCard';
import { formatNumber, formatRelativeTime, formatMs, formatPercent } from '../lib/format';

interface SessionRow {
  session_id: string;
  user_id: string | null;
  anonymous_id: string | null;
  street_profile_id: string | null;
  user_role: string | null;
  device_type: string | null;
  viewport_bucket: string | null;
  started_at: string;
  last_seen_at: string;
  duration_s: number;
  page_view_count: number;
  event_count: number;
  active_time_ms: number;
  idle_time_ms: number;
  rage_click_count: number;
  error_count: number;
  entry_route_pattern: string | null;
  exit_route_pattern: string | null;
  first_product_area: string | null;
  last_product_area: string | null;
}

interface SessionsResponse {
  summary: {
    total_sessions: number;
    sessions_with_errors: number;
    sessions_with_rage: number;
    bounced: number;
    avg_duration_s: number;
    median_duration_s: number;
  };
  sessions: SessionRow[];
}

interface SessionEvent {
  event_id: string;
  event_name: string;
  product_area: string | null;
  route: string | null;
  route_pattern: string | null;
  page_title: string | null;
  properties: any;
  occurred_at: string;
  t_offset_s: number;
}
interface SessionDetailResponse {
  session: SessionRow & {
    user_agent_family: string;
    os_family: string;
    app_variant: string;
    app_version: string;
    environment: string;
  };
  events:  SessionEvent[];
  by_name: { event_name: string; n: number }[];
}

const AREA_COLOR: Record<string, string> = {
  home: '#FFD600', ai: '#111315', street_profile: '#A78BFA', gallery: '#F472B6',
  jobs: '#34D399', academy: '#60A5FA', directory: '#FB923C', messages: '#22D3EE',
  groups: '#F87171', news: '#FACC15', tasks: '#A78BFA', documents: '#94A3B8',
  calendar: '#4ADE80', case_management: '#EF4444', social_media: '#EC4899',
  storage: '#64748B', data: '#6366F1', grantwriter: '#F59E0B', agents: '#0EA5E9',
  admin: '#475569', platform: '#9CA3AF', auth: '#84CC16', _global: '#6B7280',
};
const colorForArea = (a: string | null | undefined) => AREA_COLOR[a ?? '_global'] ?? '#9CA3AF';

export function ReplayTab() {
  const [data, setData] = React.useState<SessionsResponse | null>(null);
  const [err,  setErr]  = React.useState<string | null>(null);
  const [openSid, setOpenSid] = React.useState<string | null>(null);

  const [userId,    setUserId]    = React.useState('');
  const [profileId, setProfileId] = React.useState('');
  const [since,     setSince]     = React.useState('');
  const [onlyErr,   setOnlyErr]   = React.useState(false);
  const [onlyRage,  setOnlyRage]  = React.useState(false);
  const [days,      setDays]      = React.useState(7);

  const search = React.useCallback(() => {
    setErr(null);
    const q = new URLSearchParams();
    q.set('days', String(days));
    q.set('limit', '100');
    if (userId.trim())    q.set('user_id', userId.trim());
    if (profileId.trim()) q.set('street_profile_id', profileId.trim());
    if (since.trim())     q.set('since', since.trim());
    if (onlyErr)          q.set('errors', '1');
    if (onlyRage)         q.set('rage', '1');
    fetch(`/api/analytics/query/replay/sessions?${q.toString()}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((d: SessionsResponse) => setData(d))
      .catch((e) => setErr(String(e)));
  }, [userId, profileId, since, onlyErr, onlyRage, days]);

  React.useEffect(() => { search(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280, margin: '0 auto' }}>
      <div>
        <span className="sv-datecap">SESSION INSPECTOR · REPLAY WITHOUT RECORDING</span>
        <h1 className="sv-h1" style={{ marginTop: 6 }}>Replay</h1>
        <p style={{ color: 'var(--sv-grey-1)', marginTop: 10, fontSize: 19, lineHeight: 1.55, maxWidth: 820 }}>
          Reconstruct any session by stepping through the chronological event
          timeline. No video recording — but every page entry, click, AI
          message, error, and conversion is tied to a session, so you can see
          what actually happened.
        </p>
      </div>

      {data ? (
        <div className="sv-card sv-card--padded">
          <SectionTitle right={<span className="sv-pill sv-pill--soft">{days}-day window</span>}>
            Sessions This Window
          </SectionTitle>
          <BigNumberTriple items={[
            { label: 'TOTAL SESSIONS', value: data.summary.total_sessions, sub: `${formatNumber(data.summary.bounced)} bounced` },
            { label: 'WITH ERRORS',    value: data.summary.sessions_with_errors, sub: `${formatPercent((data.summary.sessions_with_errors / Math.max(data.summary.total_sessions, 1)) * 100)} of total` },
            { label: 'WITH RAGE',      value: data.summary.sessions_with_rage, sub: 'rage-click sessions' },
          ]} />
          <div style={{ marginTop: 16, display: 'flex', gap: 32, paddingTop: 16, borderTop: '1px solid var(--sv-grey-5)' }}>
            <div>
              <div className="sv-metric-sm">{formatDuration(data.summary.median_duration_s)}</div>
              <div className="sv-label" style={{ marginTop: 6 }}>median duration</div>
            </div>
            <div>
              <div className="sv-metric-sm">{formatDuration(data.summary.avg_duration_s)}</div>
              <div className="sv-label" style={{ marginTop: 6 }}>avg duration</div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="sv-card sv-card--padded">
        <SectionTitle>Filters</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, alignItems: 'end' }}>
          <Field label="USER ID"           value={userId}    onChange={setUserId} />
          <Field label="STREET PROFILE ID" value={profileId} onChange={setProfileId} />
          <Field label="SINCE (YYYY-MM-DD)" value={since}    onChange={setSince} />
          <div>
            <label className="sv-label" style={{ display: 'block', marginBottom: 6 }}>WINDOW</label>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={selectStyle}>
              {[1, 7, 28, 90].map(n => <option key={n} value={n}>{n}d</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 18, paddingBottom: 8, fontSize: 15, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <input type="checkbox" checked={onlyErr} onChange={(e) => setOnlyErr(e.target.checked)} />
              Errors only
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <input type="checkbox" checked={onlyRage} onChange={(e) => setOnlyRage(e.target.checked)} />
              Rage only
            </label>
          </div>
          <button onClick={search} className="sv-btn sv-btn--primary" style={{ width: 'auto', padding: '12px 24px', height: 44 }}>
            Search
          </button>
        </div>
      </div>

      {err ? <div className="sv-spinner" style={{ color: 'rgb(190, 18, 60)', height: 'auto', padding: 16 }}>Error: {err}</div> : null}

      <div className="sv-card sv-card--padded" style={{ padding: 0 }}>
        <div style={{ padding: '22px 24px 14px', borderBottom: '1px solid var(--sv-grey-5)' }}>
          <SectionTitle right={data ? <span className="sv-pill sv-pill--soft">{data.sessions.length} shown</span> : null}>
            Sessions
          </SectionTitle>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="sv-table">
            <thead>
              <tr>
                <th>Who</th>
                <th>Started</th>
                <th style={{ textAlign: 'right' }}>Duration</th>
                <th style={{ textAlign: 'right' }}>Events</th>
                <th style={{ textAlign: 'right' }}>Pages</th>
                <th>Health</th>
                <th>Path</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--sv-grey-1)' }}>Loading…</td></tr>
              ) : data.sessions.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--sv-grey-1)' }}>
                  No sessions match the current filters.
                </td></tr>
              ) : data.sessions.map((s) => (
                <tr key={s.session_id} style={{ cursor: 'pointer' }} onClick={() => setOpenSid(s.session_id)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {s.user_id
                        ? <>👤 <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{s.user_id}</span></>
                        : <>🕶 <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{s.anonymous_id ?? 'anon'}</span></>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--sv-grey-1)', fontWeight: 600 }}>
                      {s.user_role ?? 'unknown'} · {s.device_type ?? '?'}
                    </div>
                  </td>
                  <td style={{ color: 'var(--sv-grey-1)', fontSize: 14 }}>{formatRelativeTime(s.started_at)}</td>
                  <td className="numeric">{formatDuration(s.duration_s)}</td>
                  <td className="numeric">{s.event_count}</td>
                  <td className="numeric">{s.page_view_count}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {s.error_count > 0      ? <span className="sv-pill sv-pill--rose">⚠ {s.error_count} err</span> : null}
                      {s.rage_click_count > 0 ? <span className="sv-pill sv-pill--rose">😡 {s.rage_click_count} rage</span> : null}
                      {s.error_count === 0 && s.rage_click_count === 0
                        ? <span className="sv-pill sv-pill--green">healthy</span> : null}
                    </div>
                  </td>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                    <span style={{ color: 'var(--sv-grey-1)' }}>{s.entry_route_pattern ?? '—'}</span>
                    <span style={{ margin: '0 6px', color: 'var(--sv-grey-2)' }}>→</span>
                    <span style={{ color: 'var(--sv-black)' }}>{s.exit_route_pattern ?? s.entry_route_pattern ?? '—'}</span>
                  </td>
                  <td>
                    <button className="sv-btn sv-btn--ghost"
                            style={{ width: 'auto', padding: '6px 14px', fontSize: 12 }}
                            onClick={(e) => { e.stopPropagation(); setOpenSid(s.session_id); }}>
                      Inspect →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {openSid ? <SessionDrawer sid={openSid} onClose={() => setOpenSid(null)} /> : null}
    </div>
  );
}

function SessionDrawer({ sid, onClose }: { sid: string; onClose: () => void }) {
  const [data, setData] = React.useState<SessionDetailResponse | null>(null);
  const [err,  setErr]  = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setData(null);
    fetch(`/api/analytics/query/replay/session/${sid}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((d: SessionDetailResponse) => alive && setData(d))
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [sid]);

  React.useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(17, 19, 21, 0.45)',
      zIndex: 1000, display: 'flex', justifyContent: 'flex-end',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--sv-bg)', height: '100%',
        width: 'min(720px, 100%)',
        boxShadow: '-12px 0 32px rgba(17, 19, 21, 0.10)',
        overflowY: 'auto',
      }}>
        <div style={{
          padding: '20px 28px',
          borderBottom: '1px solid var(--sv-grey-5)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'var(--sv-bg)', zIndex: 1,
        }}>
          <div>
            <span className="sv-datecap">SESSION INSPECTOR</span>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 700, marginTop: 4, color: 'var(--sv-black)' }}>
              {sid}
            </div>
          </div>
          <button onClick={onClose} className="sv-btn sv-btn--ghost" style={{ width: 'auto', padding: '8px 16px' }}>
            ✕  Close
          </button>
        </div>

        {!data && !err ? <div className="sv-spinner">Loading session…</div> : null}
        {err ? <div className="sv-spinner" style={{ color: 'rgb(190, 18, 60)' }}>Error: {err}</div> : null}

        {data ? (
          <div style={{ padding: '22px 28px 60px', display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div className="sv-card sv-card--padded">
              <SectionTitle>Session</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, fontSize: 15 }}>
                <Meta label="WHO"      value={data.session.user_id ? `👤 ${data.session.user_id}` : `🕶 ${data.session.anonymous_id ?? 'anon'}`} />
                <Meta label="ROLE"     value={data.session.user_role ?? '—'} />
                <Meta label="DEVICE"   value={`${data.session.device_type} · ${data.session.viewport_bucket}`} />
                <Meta label="BROWSER"  value={`${data.session.user_agent_family ?? '?'} · ${data.session.os_family ?? '?'}`} />
                <Meta label="STARTED"  value={new Date(data.session.started_at).toLocaleString()} />
                <Meta label="DURATION" value={formatDuration(data.session.duration_s)} />
                <Meta label="ENTRY"    value={data.session.entry_route_pattern ?? '—'} mono />
                <Meta label="EXIT"     value={data.session.exit_route_pattern ?? '—'} mono />
              </div>

              <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="sv-pill sv-pill--soft">{data.session.event_count} events</span>
                <span className="sv-pill sv-pill--soft">{data.session.page_view_count} pages</span>
                <span className="sv-pill sv-pill--soft">{formatMs(data.session.active_time_ms)} active</span>
                <span className="sv-pill sv-pill--soft">{formatMs(data.session.idle_time_ms)} idle</span>
                {data.session.rage_click_count > 0
                  ? <span className="sv-pill sv-pill--rose">😡 {data.session.rage_click_count} rage</span>
                  : null}
                {data.session.error_count > 0
                  ? <span className="sv-pill sv-pill--rose">⚠ {data.session.error_count} err</span>
                  : null}
              </div>
            </div>

            <div className="sv-card sv-card--padded">
              <SectionTitle>Event Mix</SectionTitle>
              {data.by_name.length === 0 ? (
                <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '12px 0' }}>No events captured.</div>
              ) : (
                <div>
                  {data.by_name.slice(0, 10).map((n) => {
                    const max = data.by_name[0]?.n || 1;
                    return (
                      <div key={n.event_name} className="sv-bar-row" style={{ gridTemplateColumns: '220px 1fr 60px' }}>
                        <div className="sv-bar-row__label" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 700 }}>
                          {n.event_name}
                        </div>
                        <div className="sv-bar"><span style={{ width: `${(n.n / max) * 100}%` }} /></div>
                        <div className="sv-bar-row__value">{n.n}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="sv-card sv-card--padded">
              <SectionTitle right={<span className="sv-pill sv-pill--soft">{data.events.length} events</span>}>
                Timeline
              </SectionTitle>
              {data.events.length === 0 ? (
                <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '12px 0' }}>No events captured.</div>
              ) : (
                <div style={{ position: 'relative', paddingLeft: 22 }}>
                  <div style={{
                    position: 'absolute', left: 7, top: 6, bottom: 6,
                    width: 2, background: 'var(--sv-grey-4)',
                  }} />
                  {data.events.map((e) => (
                    <div key={e.event_id} style={{ position: 'relative', padding: '8px 0' }}>
                      <span style={{
                        position: 'absolute', left: -22, top: 14,
                        width: 14, height: 14, borderRadius: '50%',
                        background: colorForArea(e.product_area),
                        border: '2px solid var(--sv-bg)',
                        boxShadow: '0 0 0 1px var(--sv-grey-3)',
                      }} />
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{
                          fontFamily: 'ui-monospace, monospace',
                          fontSize: 13, fontWeight: 700, color: 'var(--sv-grey-1)',
                          fontVariantNumeric: 'tabular-nums',
                          minWidth: 56,
                        }}>+{formatTOffset(e.t_offset_s)}</span>
                        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, fontWeight: 700, color: 'var(--sv-black)' }}>
                          {e.event_name}
                        </span>
                        {e.product_area ? <span className="sv-pill sv-pill--grey">{e.product_area}</span> : null}
                        {e.route_pattern
                          ? <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--sv-grey-1)' }}>{e.route_pattern}</span>
                          : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'block' }}>
      <span className="sv-label" style={{ display: 'block', marginBottom: 6 }}>{label}</span>
      <input data-mask value={value} onChange={(e) => onChange(e.target.value)}
             style={{
               width: '100%', padding: '10px 12px',
               border: '1px solid var(--sv-grey-3)',
               borderRadius: 10,
               fontFamily: 'inherit', fontSize: 15,
               background: 'var(--sv-bg)', color: 'var(--sv-black)',
             }} />
    </label>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="sv-label">{label}</div>
      <div style={{
        marginTop: 4, fontWeight: 600, color: 'var(--sv-black)',
        fontFamily: mono ? 'ui-monospace, monospace' : 'inherit',
        fontSize: mono ? 14 : 16,
      }}>{value}</div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--sv-grey-3)',
  borderRadius: 10,
  fontFamily: 'inherit', fontSize: 15,
  background: 'var(--sv-bg)', color: 'var(--sv-black)',
};

function formatDuration(s: number): string {
  if (!s) return '—';
  if (s < 60)    return `${s}s`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function formatTOffset(s: number): string {
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

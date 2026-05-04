// Job Board section dashboard.
// Question: are job seekers finding listings, applying, and are
// employers publishing listings that get filled?

import * as React from 'react';
import { MetricCard, BigNumberTriple } from '../../components/MetricCard';
import { SectionTitle } from '../../components/SectionTitle';
import { TimeSeriesChart } from '../../components/TimeSeriesChart';
import { formatNumber, formatPercent } from '../../lib/format';

interface JobsPayload {
  cards: {
    board_views_7d: number; searches_7d: number; impressions_7d: number;
    job_views_7d: number; job_views_28d: number; saved_7d: number;
    apps_started_7d: number; apps_started_28d: number;
    apps_submitted_7d: number; apps_submitted_28d: number;
    withdrawn_28d: number; external_7d: number; active_applicants_7d: number;
    resumes_started_28d: number; resumes_completed_28d: number;
    cover_ai_28d: number;
    listings_started_28d: number; listings_published_28d: number;
    detail_ctr: number; save_per_view: number;
    apply_start_rate: number; apply_completion: number;
    withdraw_rate: number; resume_completion: number;
    ai_cover_share: number; listing_publish_rate: number;
  };
  by_submission:          { submission_type: string; n: number }[];
  by_work_mode:           { work_mode: string; n: number }[];
  by_filter:              { filter_type: string; n: number }[];
  by_resume_completeness: { bucket: string; n: number }[];
  by_status_change:       { to_status: string; n: number }[];
  by_listing_category:    { category: string; n: number }[];
  daily: { day: string; board_views: number; job_views: number; apps_submitted: number; listings: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  under_review: '#FFD600',
  interview: '#3B82F6',
  offer: '#34D399',
  rejected: '#FB7185',
  hired: '#A78BFA',
};

function pretty(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function JobBoardSection() {
  const [data, setData] = React.useState<JobsPayload | null>(null);
  const [err,  setErr]  = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch('/api/analytics/query/section/jobs', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((d: JobsPayload) => alive && setData(d))
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, []);

  if (err)   return <div className="sv-spinner" style={{ color: 'rgb(190, 18, 60)' }}>Error: {err}</div>;
  if (!data) return <div className="sv-spinner">Loading…</div>;

  const c = data.cards;
  const ctrIntent: 'positive' | 'neutral' | 'warn' =
    c.detail_ctr >= 0.10 ? 'positive' : c.detail_ctr >= 0.05 ? 'neutral' : 'warn';
  const applyIntent: 'positive' | 'neutral' | 'warn' =
    c.apply_completion >= 0.60 ? 'positive' : c.apply_completion >= 0.40 ? 'neutral' : 'warn';
  const withdrawIntent: 'positive' | 'warn' | 'critical' | 'neutral' =
    c.withdraw_rate < 0.05 ? 'positive' : c.withdraw_rate < 0.10 ? 'neutral' : c.withdraw_rate < 0.20 ? 'warn' : 'critical';
  const resumeIntent: 'positive' | 'neutral' | 'warn' =
    c.resume_completion >= 0.60 ? 'positive' : c.resume_completion >= 0.40 ? 'neutral' : 'warn';
  const listingIntent: 'positive' | 'neutral' | 'warn' =
    c.listing_publish_rate >= 0.55 ? 'positive' : c.listing_publish_rate >= 0.35 ? 'neutral' : 'warn';

  const totalSubmission = data.by_submission.reduce((s, r) => s + r.n, 0) || 1;
  const totalWorkMode   = data.by_work_mode.reduce((s, r) => s + r.n, 0) || 1;
  const totalFilter     = data.by_filter.reduce((s, r) => s + r.n, 0) || 1;
  const totalResume     = data.by_resume_completeness.reduce((s, r) => s + r.n, 0) || 1;
  const totalStatus     = data.by_status_change.reduce((s, r) => s + r.n, 0) || 1;
  const totalCategory   = data.by_listing_category.reduce((s, r) => s + r.n, 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280, margin: '0 auto' }}>
      <div>
        <span className="sv-datecap">SECTION ANALYTICS · LAST 7 DAYS</span>
        <h1 className="sv-h1" style={{ marginTop: 6 }}>Job Board</h1>
        <p style={{ color: 'var(--sv-grey-1)', marginTop: 10, fontSize: 19, lineHeight: 1.55, maxWidth: 820 }}>
          Are job seekers finding listings, finishing applications, and are
          employers publishing listings that perform? This view tracks the
          impression→detail→apply funnel, resume readiness, AI cover-letter
          usage, and employer publishing health.
        </p>
      </div>

      <div className="sv-card sv-card--padded">
        <SectionTitle right={<span className="sv-pill sv-pill--soft">7-day window</span>}>
          This Week
        </SectionTitle>
        <BigNumberTriple items={[
          { label: 'JOB VIEWS',         value: c.job_views_28d,        sub: `${formatNumber(c.job_views_7d)} in last 7 days` },
          { label: 'ACTIVE APPLICANTS', value: c.active_applicants_7d, sub: `${formatNumber(c.apps_submitted_7d)} apps submitted` },
          { label: 'NEW LISTINGS',      value: c.listings_published_28d, sub: `${formatNumber(c.listings_started_28d)} drafts started` },
        ]} />
      </div>

      <div>
        <SectionTitle>Funnel & Health</SectionTitle>
        <div className="sv-grid-4">
          <MetricCard label="DETAIL CTR" value={formatPercent(c.detail_ctr * 100)} icon="🔍" intent={ctrIntent}
                      hint={`${formatNumber(c.job_views_7d)} detail / ${formatNumber(c.impressions_7d)} impressions`} />
          <MetricCard label="APPLY START RATE" value={formatPercent(c.apply_start_rate * 100)} icon="📝"
                      hint={`${formatNumber(c.apps_started_7d)} starts / ${formatNumber(c.job_views_7d)} views`} />
          <MetricCard label="APPLY COMPLETION" value={formatPercent(c.apply_completion * 100)} icon="✅" intent={applyIntent}
                      hint={`${formatNumber(c.apps_submitted_28d)} / ${formatNumber(c.apps_started_28d)} (28d)`} />
          <MetricCard label="WITHDRAW RATE" value={formatPercent(c.withdraw_rate * 100)} icon="↩️" intent={withdrawIntent}
                      hint={`${formatNumber(c.withdrawn_28d)} withdrawn (28d)`} />
          <MetricCard label="RESUME COMPLETION" value={formatPercent(c.resume_completion * 100)} icon="📄" intent={resumeIntent}
                      hint={`${formatNumber(c.resumes_completed_28d)} / ${formatNumber(c.resumes_started_28d)} (28d)`} />
          <MetricCard label="AI COVER USAGE" value={formatPercent(c.ai_cover_share * 100)} icon="🤖"
                      hint={`${formatNumber(c.cover_ai_28d)} AI letters generated`} />
          <MetricCard label="LISTING PUBLISH RATE" value={formatPercent(c.listing_publish_rate * 100)} icon="📢" intent={listingIntent}
                      hint={`${formatNumber(c.listings_published_28d)} / ${formatNumber(c.listings_started_28d)} drafts`} />
          <MetricCard label="EXTERNAL APPLY 7D" value={c.external_7d} icon="🔗"
                      hint="redirected to off-platform employer" />
        </div>
      </div>

      <div className="sv-card sv-card--padded">
        <SectionTitle>Application Funnel (7 days)</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {([
            { label: 'Board viewed',     value: c.board_views_7d },
            { label: 'Job impressions',  value: c.impressions_7d },
            { label: 'Job detail',       value: c.job_views_7d },
            { label: 'Saved',            value: c.saved_7d },
            { label: 'Application started', value: c.apps_started_7d },
            { label: 'Application submitted', value: c.apps_submitted_7d },
          ] as const).map((row) => {
            const max = c.impressions_7d || 1;
            const pct = (row.value / max) * 100;
            const isFinal = row.label === 'Application submitted';
            return (
              <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '200px 1fr 80px 80px', alignItems: 'center', gap: 12 }}>
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

      <div className="sv-card sv-card--padded">
        <SectionTitle>Daily Activity (28 days)</SectionTitle>
        <TimeSeriesChart series={[
          { key: 'board_views',    label: 'Board views',    color: '#FFD600',
            values: data.daily.map(d => ({ day: d.day, value: d.board_views })) },
          { key: 'job_views',      label: 'Job detail',     color: '#111315',
            values: data.daily.map(d => ({ day: d.day, value: d.job_views })) },
          { key: 'apps_submitted', label: 'Apps submitted', color: '#34D399',
            values: data.daily.map(d => ({ day: d.day, value: d.apps_submitted })) },
          { key: 'listings',       label: 'Listings published', color: '#A78BFA',
            values: data.daily.map(d => ({ day: d.day, value: d.listings })) },
        ]} />
      </div>

      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>Submission Type (28d)</SectionTitle>
          {data.by_submission.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No submissions in window.</div>
          ) : (
            <table className="sv-table">
              <thead><tr><th>Type</th><th style={{textAlign:'right'}}>Count</th><th style={{textAlign:'right',width:160}}>Share</th></tr></thead>
              <tbody>
                {data.by_submission.map(r => {
                  const pct = (r.n / totalSubmission) * 100;
                  return (
                    <tr key={r.submission_type}>
                      <td style={{ fontWeight: 600 }}>{pretty(r.submission_type)}</td>
                      <td className="numeric">{r.n}</td>
                      <td><div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
                        <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%` }} /></div>
                        <span style={{ fontWeight: 700, minWidth: 44 }}>{formatPercent(pct)}</span>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="sv-card sv-card--padded">
          <SectionTitle>Work Mode Mix (28d)</SectionTitle>
          {data.by_work_mode.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No data.</div>
          ) : (
            <table className="sv-table">
              <thead><tr><th>Mode</th><th style={{textAlign:'right'}}>Impressions</th><th style={{textAlign:'right',width:160}}>Share</th></tr></thead>
              <tbody>
                {data.by_work_mode.map(r => {
                  const pct = (r.n / totalWorkMode) * 100;
                  return (
                    <tr key={r.work_mode}>
                      <td style={{ fontWeight: 600 }}>{pretty(r.work_mode)}</td>
                      <td className="numeric">{r.n}</td>
                      <td><div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
                        <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%` }} /></div>
                        <span style={{ fontWeight: 700, minWidth: 44 }}>{formatPercent(pct)}</span>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>Filter Mix (28d)</SectionTitle>
          {data.by_filter.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No filter changes.</div>
          ) : (
            <table className="sv-table">
              <thead><tr><th>Filter</th><th style={{textAlign:'right'}}>Uses</th><th style={{textAlign:'right',width:160}}>Share</th></tr></thead>
              <tbody>
                {data.by_filter.map(r => {
                  const pct = (r.n / totalFilter) * 100;
                  return (
                    <tr key={r.filter_type}>
                      <td style={{ fontWeight: 600 }}>{pretty(r.filter_type)}</td>
                      <td className="numeric">{r.n}</td>
                      <td><div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
                        <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%` }} /></div>
                        <span style={{ fontWeight: 700, minWidth: 44 }}>{formatPercent(pct)}</span>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="sv-card sv-card--padded">
          <SectionTitle>Resume Completeness (28d)</SectionTitle>
          {data.by_resume_completeness.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No completed resumes.</div>
          ) : (
            <table className="sv-table">
              <thead><tr><th>Score</th><th style={{textAlign:'right'}}>Count</th><th style={{textAlign:'right',width:160}}>Share</th></tr></thead>
              <tbody>
                {data.by_resume_completeness.map(r => {
                  const pct = (r.n / totalResume) * 100;
                  const isHigh = r.bucket === '90+';
                  const isLow = r.bucket === '<50';
                  return (
                    <tr key={r.bucket}>
                      <td style={{ fontWeight: 600, color: isHigh ? 'rgb(5, 150, 105)' : isLow ? 'rgb(190, 18, 60)' : 'var(--sv-black)' }}>
                        {r.bucket}
                      </td>
                      <td className="numeric">{r.n}</td>
                      <td><div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
                        <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%`, background: isHigh ? '#34D399' : isLow ? '#FB7185' : 'var(--sv-yellow)' }} /></div>
                        <span style={{ fontWeight: 700, minWidth: 44 }}>{formatPercent(pct)}</span>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>Applicant Status Outcomes (28d)</SectionTitle>
          {data.by_status_change.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No status changes in window.</div>
          ) : (
            <table className="sv-table">
              <thead><tr><th>Status</th><th style={{textAlign:'right'}}>Count</th><th style={{textAlign:'right',width:160}}>Share</th></tr></thead>
              <tbody>
                {data.by_status_change.map(r => {
                  const pct = (r.n / totalStatus) * 100;
                  const color = STATUS_COLORS[r.to_status] ?? 'var(--sv-yellow)';
                  return (
                    <tr key={r.to_status}>
                      <td style={{ fontWeight: 600 }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color, marginRight: 8 }} />
                        {pretty(r.to_status)}
                      </td>
                      <td className="numeric">{r.n}</td>
                      <td><div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
                        <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%`, background: color }} /></div>
                        <span style={{ fontWeight: 700, minWidth: 44 }}>{formatPercent(pct)}</span>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="sv-card sv-card--padded">
          <SectionTitle>Listings Published by Category (28d)</SectionTitle>
          {data.by_listing_category.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No listings published.</div>
          ) : (
            <table className="sv-table">
              <thead><tr><th>Category</th><th style={{textAlign:'right'}}>Listings</th><th style={{textAlign:'right',width:160}}>Share</th></tr></thead>
              <tbody>
                {data.by_listing_category.map(r => {
                  const pct = (r.n / totalCategory) * 100;
                  return (
                    <tr key={r.category}>
                      <td style={{ fontWeight: 600 }}>{pretty(r.category)}</td>
                      <td className="numeric">{r.n}</td>
                      <td><div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
                        <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%` }} /></div>
                        <span style={{ fontWeight: 700, minWidth: 44 }}>{formatPercent(pct)}</span>
                      </div></td>
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

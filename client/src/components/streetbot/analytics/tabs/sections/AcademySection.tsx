// Academy section dashboard.
// Question: are learners enrolling, finishing lessons, passing quizzes,
// and is the AI tutor actually helpful?

import * as React from 'react';
import { MetricCard, BigNumberTriple } from '../../components/MetricCard';
import { SectionTitle } from '../../components/SectionTitle';
import { TimeSeriesChart } from '../../components/TimeSeriesChart';
import { formatNumber, formatPercent } from '../../lib/format';

interface AcademyPayload {
  cards: {
    home_views_7d: number; course_views_7d: number; course_views_28d: number;
    enroll_started_28d: number; enroll_completed_28d: number; enroll_completed_7d: number;
    lessons_started_28d: number; lessons_completed_28d: number; lessons_completed_7d: number;
    assignments_28d: number; quizzes_completed_28d: number; quizzes_passed_28d: number;
    certs_28d: number; ai_tutor_7d: number; ai_tutor_28d: number;
    live_28d: number; active_learners_7d: number;
    avg_lesson_time_ms: number | null;
    enrollment_conversion: number; lesson_completion: number;
    quiz_pass_rate: number; ai_helpful_rate: number;
  };
  by_score:     { bucket: string; n: number }[];
  by_milestone: { milestone: string; n: number }[];
  by_speed:     { speed: string; n: number }[];
  by_role:      { role: string; n: number }[];
  top_courses:  { course_id: string; views: number; enrolls: number }[];
  daily: { day: string; course_views: number; enrollments: number; lessons_completed: number; certs: number }[];
}

function pretty(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(0)}s`;
  return `${Math.floor(s/60)}m ${Math.round(s%60)}s`;
}

export function AcademySection() {
  const [data, setData] = React.useState<AcademyPayload | null>(null);
  const [err,  setErr]  = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch('/api/analytics/query/section/academy', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((d: AcademyPayload) => alive && setData(d))
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, []);

  if (err)   return <div className="sv-spinner" style={{ color: 'rgb(190, 18, 60)' }}>Error: {err}</div>;
  if (!data) return <div className="sv-spinner">Loading…</div>;

  const c = data.cards;
  const enrollIntent: 'positive' | 'neutral' | 'warn' =
    c.enrollment_conversion >= 0.65 ? 'positive' : c.enrollment_conversion >= 0.40 ? 'neutral' : 'warn';
  const lessonIntent: 'positive' | 'neutral' | 'warn' =
    c.lesson_completion >= 0.60 ? 'positive' : c.lesson_completion >= 0.40 ? 'neutral' : 'warn';
  const quizIntent: 'positive' | 'neutral' | 'warn' =
    c.quiz_pass_rate >= 0.75 ? 'positive' : c.quiz_pass_rate >= 0.55 ? 'neutral' : 'warn';
  const aiIntent: 'positive' | 'neutral' | 'warn' =
    c.ai_helpful_rate >= 0.70 ? 'positive' : c.ai_helpful_rate >= 0.50 ? 'neutral' : 'warn';

  const totalScore     = data.by_score.reduce((s, r) => s + r.n, 0) || 1;
  const totalMilestone = data.by_milestone.reduce((s, r) => s + r.n, 0) || 1;
  const totalSpeed     = data.by_speed.reduce((s, r) => s + r.n, 0) || 1;
  const totalRole      = data.by_role.reduce((s, r) => s + r.n, 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280, margin: '0 auto' }}>
      <div>
        <span className="sv-datecap">SECTION ANALYTICS · LAST 7 DAYS</span>
        <h1 className="sv-h1" style={{ marginTop: 6 }}>Academy</h1>
        <p style={{ color: 'var(--sv-grey-1)', marginTop: 10, fontSize: 19, lineHeight: 1.55, maxWidth: 820 }}>
          Are learners enrolling, finishing lessons, passing quizzes, and is
          the AI tutor actually helpful? This view tracks the
          discover→enroll→complete funnel, video engagement, quiz pass rates,
          and AI tutor helpfulness.
        </p>
      </div>

      <div className="sv-card sv-card--padded">
        <SectionTitle right={<span className="sv-pill sv-pill--soft">7-day window</span>}>
          This Week
        </SectionTitle>
        <BigNumberTriple items={[
          { label: 'ACTIVE LEARNERS', value: c.active_learners_7d, sub: `${formatNumber(c.lessons_completed_7d)} lessons completed` },
          { label: 'ENROLLMENTS',     value: c.enroll_completed_28d, sub: `${formatNumber(c.enroll_completed_7d)} in last 7 days` },
          { label: 'CERTIFICATES',    value: c.certs_28d, sub: `from ${formatNumber(c.enroll_completed_28d)} enrollments` },
        ]} />
      </div>

      <div>
        <SectionTitle>Learning Health</SectionTitle>
        <div className="sv-grid-4">
          <MetricCard label="ENROLLMENT CONVERSION" value={formatPercent(c.enrollment_conversion * 100)} icon="📚" intent={enrollIntent}
                      hint={`${formatNumber(c.enroll_completed_28d)} / ${formatNumber(c.enroll_started_28d)} starts (28d)`} />
          <MetricCard label="LESSON COMPLETION" value={formatPercent(c.lesson_completion * 100)} icon="✅" intent={lessonIntent}
                      hint={`${formatNumber(c.lessons_completed_28d)} / ${formatNumber(c.lessons_started_28d)} (28d)`} />
          <MetricCard label="QUIZ PASS RATE" value={formatPercent(c.quiz_pass_rate * 100)} icon="🎯" intent={quizIntent}
                      hint={`${formatNumber(c.quizzes_passed_28d)} passed / ${formatNumber(c.quizzes_completed_28d)} taken`} />
          <MetricCard label="AI HELPFUL RATE" value={formatPercent(c.ai_helpful_rate * 100)} icon="🤖" intent={aiIntent}
                      hint={`${formatNumber(c.ai_tutor_28d)} tutor calls (28d)`} />
          <MetricCard label="AVG LESSON TIME" value={formatDuration(c.avg_lesson_time_ms)} icon="⏱️"
                      hint="time spent per completed lesson" />
          <MetricCard label="ASSIGNMENTS 28D" value={c.assignments_28d} icon="📝"
                      hint="assignments submitted" />
          <MetricCard label="LIVE SESSIONS" value={c.live_28d} icon="🎙️"
                      hint="live sessions joined (28d)" />
          <MetricCard label="COURSE VIEWS 28D" value={c.course_views_28d} icon="📊"
                      hint={`${formatNumber(c.course_views_7d)} this week`} />
        </div>
      </div>

      <div className="sv-card sv-card--padded">
        <SectionTitle>Learning Funnel (28 days)</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {([
            { label: 'Course viewed',       value: c.course_views_28d },
            { label: 'Enrollment started',  value: c.enroll_started_28d },
            { label: 'Enrollment completed', value: c.enroll_completed_28d },
            { label: 'Lessons completed',   value: c.lessons_completed_28d },
            { label: 'Certificates earned', value: c.certs_28d },
          ] as const).map((row) => {
            const max = c.course_views_28d || 1;
            const pct = (row.value / max) * 100;
            const isFinal = row.label === 'Certificates earned';
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
          { key: 'course_views',     label: 'Course views',  color: '#FFD600',
            values: data.daily.map(d => ({ day: d.day, value: d.course_views })) },
          { key: 'enrollments',      label: 'Enrollments',   color: '#111315',
            values: data.daily.map(d => ({ day: d.day, value: d.enrollments })) },
          { key: 'lessons_completed', label: 'Lessons completed', color: '#3B82F6',
            values: data.daily.map(d => ({ day: d.day, value: d.lessons_completed })) },
          { key: 'certs',            label: 'Certificates',  color: '#34D399',
            values: data.daily.map(d => ({ day: d.day, value: d.certs })) },
        ]} />
      </div>

      <div className="sv-grid-2">
        <div className="sv-card sv-card--padded">
          <SectionTitle>Quiz Score Distribution (28d)</SectionTitle>
          {data.by_score.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No quizzes in window.</div>
          ) : (
            <table className="sv-table">
              <thead><tr><th>Score</th><th style={{textAlign:'right'}}>Count</th><th style={{textAlign:'right',width:160}}>Share</th></tr></thead>
              <tbody>
                {data.by_score.map(r => {
                  const pct = (r.n / totalScore) * 100;
                  const isHigh = r.bucket === '90-100';
                  const isLow = r.bucket === '<60';
                  return (
                    <tr key={r.bucket}>
                      <td style={{ fontWeight: 600, color: isHigh ? 'rgb(5, 150, 105)' : isLow ? 'rgb(190, 18, 60)' : 'var(--sv-black)' }}>{r.bucket}</td>
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

        <div className="sv-card sv-card--padded">
          <SectionTitle>Video Milestone Reach (28d)</SectionTitle>
          {data.by_milestone.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No video data.</div>
          ) : (
            <table className="sv-table">
              <thead><tr><th>Milestone</th><th style={{textAlign:'right'}}>Hits</th><th style={{textAlign:'right',width:160}}>Share</th></tr></thead>
              <tbody>
                {data.by_milestone.map(r => {
                  const pct = (r.n / totalMilestone) * 100;
                  const isFull = r.milestone === '100';
                  return (
                    <tr key={r.milestone}>
                      <td style={{ fontWeight: 600, color: isFull ? 'rgb(5, 150, 105)' : 'var(--sv-black)' }}>{r.milestone}%</td>
                      <td className="numeric">{r.n}</td>
                      <td><div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
                        <div className="sv-bar" style={{ width: 80 }}><span style={{ width: `${pct}%`, background: isFull ? '#34D399' : 'var(--sv-yellow)' }} /></div>
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
          <SectionTitle>Playback Speed (28d)</SectionTitle>
          {data.by_speed.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No playback data.</div>
          ) : (
            <table className="sv-table">
              <thead><tr><th>Speed</th><th style={{textAlign:'right'}}>Hits</th><th style={{textAlign:'right',width:160}}>Share</th></tr></thead>
              <tbody>
                {data.by_speed.map(r => {
                  const pct = (r.n / totalSpeed) * 100;
                  return (
                    <tr key={r.speed}>
                      <td style={{ fontWeight: 600 }}>{r.speed}</td>
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
          <SectionTitle>Visitors by Role (28d)</SectionTitle>
          {data.by_role.length === 0 ? (
            <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No role data.</div>
          ) : (
            <table className="sv-table">
              <thead><tr><th>Role</th><th style={{textAlign:'right'}}>Views</th><th style={{textAlign:'right',width:160}}>Share</th></tr></thead>
              <tbody>
                {data.by_role.map(r => {
                  const pct = (r.n / totalRole) * 100;
                  return (
                    <tr key={r.role}>
                      <td style={{ fontWeight: 600 }}>{pretty(r.role)}</td>
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

      <div className="sv-card sv-card--padded">
        <SectionTitle>Top Courses (28d)</SectionTitle>
        {data.top_courses.length === 0 ? (
          <div style={{ color: 'var(--sv-grey-1)', fontSize: 16, padding: '24px 0' }}>No courses in window.</div>
        ) : (
          <table className="sv-table">
            <thead>
              <tr>
                <th>Course ID</th>
                <th style={{textAlign:'right'}}>Views</th>
                <th style={{textAlign:'right',width:120}}>Enrollments</th>
                <th style={{textAlign:'right',width:140}}>Conv.</th>
              </tr>
            </thead>
            <tbody>
              {data.top_courses.map(r => {
                const conv = r.views ? r.enrolls / r.views : 0;
                const isHigh = conv >= 0.20;
                return (
                  <tr key={r.course_id}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 14 }}>{r.course_id}</td>
                    <td className="numeric">{r.views}</td>
                    <td className="numeric">{r.enrolls}</td>
                    <td className="numeric" style={{ color: isHigh ? 'rgb(5, 150, 105)' : 'var(--sv-black)', fontWeight: 700 }}>
                      {formatPercent(conv * 100)}
                    </td>
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

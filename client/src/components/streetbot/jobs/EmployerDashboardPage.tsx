/* eslint-disable i18next/no-literal-string */
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  CalendarDays,
  ChevronDown,
  Filter,
  Gift,
  MessageSquare,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  checkAndExpireJobs,
  ensureEmployerDashboardApplications,
  getApplicationsForJob,
  getEmployerListings,
  seedIfNeeded,
} from './jobsStorage';
import JobBoardTopNav from './JobBoardTopNav';
import { sampleProfilePhotoForName } from '../shared/sampleProfilePhotos';
import type { ApplicationStatus, EmployerListing, JobApplication } from './types';

type DashboardMetric = {
  label: string;
  value: number;
  detail: string;
  trend: string;
  trendDirection: 'up' | 'down';
  color: string;
  icon: typeof Briefcase;
};

type ListingRow = {
  id: string;
  title: string;
  type: string;
  location: string;
  applicants: number;
  status: string;
};

type DashboardDateRange = 'week' | 'last7' | 'month' | 'last30';
type DashboardStatusFilter = 'all' | 'active' | 'review' | 'filled';
type DashboardTypeFilter = 'all' | 'full-time' | 'part-time' | 'contract';

type RecentApplicationRow = Pick<
  JobApplication,
  'id' | 'status' | 'appliedAt' | 'applicantName' | 'applicantEmail' | 'jobSnapshot'
> & {
  avatarUrl?: string | null;
  profilePath: string;
};

type HiringActivityDay = {
  label: string;
  applicants: number;
  hired: number;
  newApplicants: number;
  avgTimeToHire: number;
};

const DATE_RANGE_OPTIONS: Array<{ key: DashboardDateRange; label: string; helper: string }> = [
  { key: 'week', label: 'May 15 - May 21, 2026', helper: 'This week' },
  { key: 'last7', label: 'Last 7 days', helper: 'Rolling window' },
  { key: 'month', label: 'May 2026', helper: 'This month' },
  { key: 'last30', label: 'Last 30 days', helper: 'Recent activity' },
];

const STATUS_FILTER_OPTIONS: Array<{ key: DashboardStatusFilter; label: string }> = [
  { key: 'all', label: 'All statuses' },
  { key: 'active', label: 'Active' },
  { key: 'review', label: 'Needs review' },
  { key: 'filled', label: 'Filled' },
];

const TYPE_FILTER_OPTIONS: Array<{ key: DashboardTypeFilter; label: string }> = [
  { key: 'all', label: 'All roles' },
  { key: 'full-time', label: 'Full-time' },
  { key: 'part-time', label: 'Part-time' },
  { key: 'contract', label: 'Contract' },
];

const SYNTHETIC_LISTINGS: ListingRow[] = [
  {
    id: 'emp_seed_1',
    title: 'Community Outreach Coordinator',
    type: 'Full-time',
    location: 'Toronto, ON',
    applicants: 18,
    status: 'active',
  },
  {
    id: 'emp_seed_2',
    title: 'Youth Program Assistant',
    type: 'Part-time',
    location: 'Toronto, ON',
    applicants: 12,
    status: 'active',
  },
  {
    id: 'emp_seed_3',
    title: 'Grant Writer',
    type: 'Contract',
    location: 'Remote',
    applicants: 7,
    status: 'review',
  },
];

function getUserId(): string {
  const key = 'sb_user_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function formatRelativeTime(value?: string) {
  if (!value) return 'just now';
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.max(1, Math.round(diff / (60 * 60 * 1000)));
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function applicantAvatarUrl(name?: string) {
  return sampleProfilePhotoForName(name || 'Street Voices Applicant');
}

function statusLabel(status: ApplicationStatus) {
  if (status === 'under_review') return 'Reviewed';
  if (status === 'screening') return 'Shortlisted';
  if (status === 'interview') return 'Interview';
  if (status === 'offered') return 'Offer';
  if (status === 'hired') return 'Hired';
  if (status === 'rejected') return 'Rejected';
  return 'New';
}

function statusClass(status: ApplicationStatus) {
  if (status === 'interview') return 'warning';
  if (status === 'screening' || status === 'hired') return 'success';
  if (status === 'under_review') return 'info';
  if (status === 'rejected') return 'danger';
  return 'new';
}

function statusCount(applications: JobApplication[], status: ApplicationStatus, fallback: number) {
  if (!applications.length) return fallback;
  const count = applications.filter((app) => app.status === status).length;
  return count;
}

function profilePathFromName(name?: string) {
  if (!name) return '/profiles';
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `/profiles/${slug}` : '/profiles';
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function formatChartDate(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildHiringActivity(applications: JobApplication[]): HiringActivityDay[] {
  const today = startOfDay(new Date());
  const windowDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (7 - index));
    return day;
  });
  const hiredApps = applications.filter((application) => application.status === 'hired');
  const averageTimeToHire =
    hiredApps.length > 0
      ? hiredApps.reduce((sum, application) => {
          const appliedAt = new Date(application.appliedAt).getTime();
          const updatedAt = new Date(application.updatedAt || application.appliedAt).getTime();
          return sum + Math.max(0, updatedAt - appliedAt) / 86400000;
        }, 0) / hiredApps.length
      : 0;

  return windowDays.map((day) => {
    const dayStart = startOfDay(day).getTime();
    const dayEnd = endOfDay(day).getTime();
    return {
      label: formatChartDate(day),
      applicants: applications.filter(
        (application) => new Date(application.appliedAt).getTime() <= dayEnd,
      ).length,
      hired: hiredApps.filter((application) => new Date(application.updatedAt).getTime() <= dayEnd)
        .length,
      newApplicants: applications.filter((application) => {
        const appliedAt = new Date(application.appliedAt).getTime();
        return appliedAt >= dayStart && appliedAt <= dayEnd;
      }).length,
      avgTimeToHire: averageTimeToHire,
    };
  });
}

function chartPoints(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  return values.map((value, index) => ({
    x: 32 + index * 82,
    y: 188 - ((value - min) / range) * 116,
  }));
}

function pointString(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

export default function EmployerDashboardPage() {
  const [listings, setListings] = useState<EmployerListing[]>([]);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DashboardDateRange>('week');
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DashboardStatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<DashboardTypeFilter>('all');
  const userId = useMemo(() => getUserId(), []);
  const selectedDateRange =
    DATE_RANGE_OPTIONS.find((option) => option.key === dateRange) || DATE_RANGE_OPTIONS[0];

  const reload = useCallback(() => {
    setListings(getEmployerListings(userId));
  }, [userId]);

  useEffect(() => {
    seedIfNeeded(userId);
    ensureEmployerDashboardApplications(userId);
    checkAndExpireJobs(userId);
    reload();
  }, [reload, userId]);

  const applications = useMemo(
    () => listings.flatMap((listing) => getApplicationsForJob(listing.jobId)),
    [listings],
  );

  const activeListings = useMemo(
    () => listings.filter((listing) => listing.isActive && !listing.positionFilled),
    [listings],
  );

  const listingRows = useMemo(() => {
    const storedRows = activeListings.length
      ? activeListings.map((listing) => {
          let status = 'review';
          if (listing.positionFilled) {
            status = 'filled';
          } else if (listing.isActive) {
            status = 'active';
          }
          return {
            id: listing.jobId,
            title: listing.jobSnapshot.title,
            type: listing.jobSnapshot.opportunity_type || 'Open role',
            location: listing.jobSnapshot.location || 'Remote',
            applicants: listing.stats.applicationCount,
            status,
          };
        })
      : SYNTHETIC_LISTINGS;
    const rows = [
      ...storedRows,
      ...SYNTHETIC_LISTINGS.filter((listing) => !storedRows.some((row) => row.id === listing.id)),
    ];

    const query = search.toLowerCase();
    return rows
      .filter((row) => {
        const matchesSearch =
          !query || `${row.title} ${row.type} ${row.location}`.toLowerCase().includes(query);
        const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
        const normalizedType = row.type.toLowerCase().replace(/\s+/g, '-');
        return (
          matchesSearch && matchesStatus && (typeFilter === 'all' || normalizedType === typeFilter)
        );
      })
      .slice(0, 3);
  }, [activeListings, search, statusFilter, typeFilter]);

  const recentApplications = useMemo(() => {
    const rows: RecentApplicationRow[] = applications
      .slice()
      .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
      .slice(0, 5)
      .map((application) => ({
        ...application,
        avatarUrl: applicantAvatarUrl(application.applicantName),
        profilePath: profilePathFromName(application.applicantName),
      }));

    if (!rows.length) {
      return [];
    }

    const appsWithAvatars = rows.map((application) => ({
      ...application,
      avatarUrl:
        application.avatarUrl ||
        applicantAvatarUrl(application.applicantName) ||
        applicantAvatarUrl(application.applicantEmail),
    }));

    if (!search.trim()) return appsWithAvatars;
    const query = search.toLowerCase();
    return appsWithAvatars.filter((app) =>
      `${app.applicantName || ''} ${app.jobSnapshot.title}`.toLowerCase().includes(query),
    );
  }, [applications, search]);

  const hiringActivity = useMemo(() => buildHiringActivity(applications), [applications]);
  const chartTotalApplicants = hiringActivity[hiringActivity.length - 1]?.applicants || 0;
  const newApplicants = hiringActivity.reduce((sum, day) => sum + day.newApplicants, 0);
  const averageTimeToHire = hiringActivity[hiringActivity.length - 1]?.avgTimeToHire || 0;
  const applicantChartPoints = chartPoints(hiringActivity.map((day) => day.applicants));
  const hiredChartPoints = chartPoints(hiringActivity.map((day) => day.hired));
  const totalApplicants =
    applications.length ||
    listings.reduce((sum, listing) => sum + listing.stats.applicationCount, 0);
  const interviews = statusCount(applications, 'interview', 6);
  const offers = statusCount(applications, 'offered', 2);
  const hired = statusCount(applications, 'hired', 1);
  const activeJobCount = activeListings.length || 3;

  const metrics: DashboardMetric[] = [
    {
      label: 'Active Job Listings',
      value: activeJobCount,
      detail: 'vs last 7 days',
      trend: '20%',
      trendDirection: 'up',
      color: '#3b82f6',
      icon: Briefcase,
    },
    {
      label: 'Total Applicants',
      value: totalApplicants,
      detail: 'vs last 7 days',
      trend: '18%',
      trendDirection: 'up',
      color: '#10b981',
      icon: Users,
    },
    {
      label: 'Interviews Scheduled',
      value: interviews,
      detail: 'vs last 7 days',
      trend: '8%',
      trendDirection: 'down',
      color: '#8b5cf6',
      icon: MessageSquare,
    },
    {
      label: 'Offers Extended',
      value: offers,
      detail: 'vs last 7 days',
      trend: '100%',
      trendDirection: 'up',
      color: '#f59e0b',
      icon: Gift,
    },
    {
      label: 'Hired',
      value: hired,
      detail: 'vs last 7 days',
      trend: '100%',
      trendDirection: 'up',
      color: '#22c55e',
      icon: UserCheck,
    },
  ];

  return (
    <main className="employer-workspace-page">
      <style>{employerWorkspaceStyles}</style>
      <JobBoardTopNav
        searchValue={search}
        onSearchChange={setSearch}
        placeholder="Search jobs, candidates, or skills..."
      />

      <section className="emp-header">
        <div>
          <h1>Good morning, Jordan</h1>
          <p>Here&apos;s what&apos;s happening with your hiring today.</p>
        </div>
        <div className="emp-header-actions">
          <div className="emp-action-wrap">
            <button
              type="button"
              className="emp-date-button"
              aria-expanded={showDateMenu}
              aria-controls="employer-date-menu"
              onClick={() => {
                setShowDateMenu((value) => !value);
                setShowFilters(false);
              }}
            >
              <CalendarDays size={18} />
              {selectedDateRange.label}
              <ChevronDown size={17} />
            </button>
            {showDateMenu && (
              <div id="employer-date-menu" className="emp-popover emp-date-menu">
                {DATE_RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={option.key === dateRange ? 'is-active' : ''}
                    onClick={() => {
                      setDateRange(option.key);
                      setShowDateMenu(false);
                    }}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.helper}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="emp-action-wrap">
            <button
              type="button"
              className="emp-filter-button"
              aria-expanded={showFilters}
              aria-controls="employer-filter-menu"
              onClick={() => {
                setShowFilters((value) => !value);
                setShowDateMenu(false);
              }}
            >
              <Filter size={18} />
              Filters
              <SlidersHorizontal size={17} />
            </button>
            {showFilters && (
              <div id="employer-filter-menu" className="emp-popover emp-filter-menu">
                <h3>Filter listings</h3>
                <p>Use these to narrow the active listing card.</p>
                <h4>Status</h4>
                <div className="emp-filter-chips">
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={option.key === statusFilter ? 'is-active' : ''}
                      onClick={() => setStatusFilter(option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <h4>Role type</h4>
                <div className="emp-filter-chips">
                  {TYPE_FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={option.key === typeFilter ? 'is-active' : ''}
                      onClick={() => setTypeFilter(option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="emp-filter-reset"
                  onClick={() => {
                    setStatusFilter('all');
                    setTypeFilter('all');
                  }}
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>
          <Link to="/jobs/post" className="emp-post-button">
            <Plus size={20} />
            Post a Job
          </Link>
        </div>
      </section>

      <section className="emp-metrics" aria-label="Hiring metrics">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article
              key={metric.label}
              className="emp-metric-card"
              style={accentStyle(metric.color)}
            >
              <span className="emp-metric-icon">
                <Icon size={26} />
              </span>
              <strong>{metric.value}</strong>
              <p>{metric.label}</p>
              <small className={metric.trendDirection === 'up' ? 'up' : 'down'}>
                {metric.trendDirection === 'up' ? '▲' : '▼'} {metric.trend}
                <span>{metric.detail}</span>
              </small>
            </article>
          );
        })}
      </section>

      <section className="emp-main-grid">
        <article className="emp-panel emp-chart-panel">
          <PanelHeader
            title="Applicants Overview"
            action={selectedDateRange.helper}
            onAction={() => {
              setShowDateMenu((value) => !value);
              setShowFilters(false);
            }}
          />
          <div className="emp-chart-legend">
            <span className="purple-dot" />
            Applicants
            <span className="green-dot" />
            Hired
          </div>
          <svg className="emp-chart" viewBox="0 0 560 220" preserveAspectRatio="xMidYMid meet">
            {[56, 96, 136, 176].map((line) => (
              <line key={line} x1="24" x2="536" y1={line} y2={line} />
            ))}
            <polyline points={pointString(applicantChartPoints)} />
            <polyline className="hired-line" points={pointString(hiredChartPoints)} />
            {applicantChartPoints.map(({ x, y }) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="7" />
            ))}
            {hiredChartPoints.map(({ x, y }) => (
              <circle key={`hired-${x}-${y}`} className="hired-point" cx={x} cy={y} r="6" />
            ))}
          </svg>
          <div className="emp-chart-labels">
            {hiringActivity.map((day) => (
              <span key={day.label}>{day.label}</span>
            ))}
          </div>
          <div className="emp-chart-summary">
            <ChartSummary value={chartTotalApplicants} label="Total Applicants" trend="18%" />
            <ChartSummary value={newApplicants} label="New Applicants" trend="9%" />
            <ChartSummary
              value={`${averageTimeToHire.toFixed(1)} days`}
              label="Avg. Time to Hire"
              trend="0.8 days"
              down
            />
          </div>
        </article>

        <article className="emp-panel emp-listings-panel">
          <PanelHeader title="Active Job Listings" link="/jobs" />
          <div className="emp-listing-stack">
            {listingRows.map((listing) => (
              <Link key={listing.id} to={`/jobs/${listing.id}`} className="emp-listing-row">
                <span className={listing.status === 'review' ? 'is-review' : ''} />
                <div>
                  <strong>{listing.title}</strong>
                  <small>
                    {listing.type} · {listing.location}
                  </small>
                </div>
                <b>{listing.applicants}</b>
                <em>Applicants</em>
              </Link>
            ))}
          </div>
          <Link to="/jobs/employer/candidates" className="emp-outline-button">
            <CalendarDays size={18} />
            Manage Job Listings
          </Link>
        </article>

        <article className="emp-panel emp-applications-panel">
          <PanelHeader title="Recent Applications" link="/jobs/employer/candidates" />
          <div className="emp-application-stack">
            {recentApplications.slice(0, 5).map((application) => (
              <Link
                key={application.id}
                to={application.profilePath}
                className="emp-application-row"
              >
                <span className="emp-application-avatar">
                  <img
                    src={application.avatarUrl || applicantAvatarUrl(application.applicantName)}
                    alt={`${application.applicantName || 'Applicant'} profile photo`}
                    loading="lazy"
                  />
                </span>
                <div>
                  <strong>{application.applicantName || 'Street Voices Applicant'}</strong>
                  <small>{application.jobSnapshot.title}</small>
                </div>
                <time>{formatRelativeTime(application.appliedAt)}</time>
                <em className={statusClass(application.status)}>
                  {statusLabel(application.status)}
                </em>
              </Link>
            ))}
          </div>
          <Link to="/jobs/employer/candidates" className="emp-outline-button">
            <Users size={18} />
            View All Applicants
          </Link>
        </article>
      </section>

      <section className="emp-panel emp-pipeline">
        <div>
          <h2>Hiring Pipeline</h2>
          <p>Track your candidates through every stage</p>
        </div>
        <div className="emp-pipeline-flow">
          <PipelineStep
            icon={Briefcase}
            value={totalApplicants}
            label="Applicants"
            color="#8b5cf6"
          />
          <span>100%</span>
          <PipelineStep icon={Users} value={interviews} label="Interviews" color="#38bdf8" />
          <span>16%</span>
          <PipelineStep icon={Gift} value={offers} label="Offers" color="#f59e0b" />
          <span>5%</span>
          <PipelineStep icon={ShieldCheck} value={hired} label="Hired" color="#22c55e" />
        </div>
        <Link to="/jobs/employer/candidates" className="emp-pipeline-button">
          View Pipeline
        </Link>
      </section>
    </main>
  );
}

function accentStyle(color: string) {
  return { '--emp-accent': color } as CSSProperties;
}

function PanelHeader({
  title,
  action,
  link,
  onAction,
}: {
  title: string;
  action?: string;
  link?: string;
  onAction?: () => void;
}) {
  return (
    <header className="emp-panel-header">
      <h2>{title}</h2>
      {link ? (
        <Link to={link}>View all</Link>
      ) : (
        <button type="button" onClick={onAction}>
          {action}
          <ChevronDown size={15} />
        </button>
      )}
    </header>
  );
}

function ChartSummary({
  value,
  label,
  trend,
  down,
}: {
  value: number | string;
  label: string;
  trend: string;
  down?: boolean;
}) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
      <small className={down ? 'down' : 'up'}>
        {down ? '▼' : '▲'} {trend} vs last 7 days
      </small>
    </div>
  );
}

function PipelineStep({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof Briefcase;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="emp-pipeline-step" style={accentStyle(color)}>
      <span>
        <Icon size={26} />
      </span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

const employerWorkspaceStyles = `
.employer-workspace-page {
  --emp-bg: #030914;
  --emp-panel: rgba(14, 24, 45, 0.8);
  --emp-panel-strong: rgba(17, 26, 48, 0.92);
  --emp-border: rgba(148, 163, 184, 0.2);
  --emp-text: #f8fafc;
  --emp-muted: rgba(226, 232, 240, 0.72);
  --emp-soft: rgba(226, 232, 240, 0.52);
	  --emp-yellow: #ffd600;
	  min-height: 100dvh;
	  padding: 0 48px 60px;
  color: var(--emp-text);
  background:
    radial-gradient(circle at 58% 18%, rgba(99, 64, 222, 0.32), transparent 32%),
    radial-gradient(circle at 16% 72%, rgba(20, 184, 166, 0.18), transparent 28%),
    radial-gradient(circle at 84% 70%, rgba(244, 114, 182, 0.14), transparent 26%),
    linear-gradient(135deg, #020713 0%, #061326 46%, #050816 100%);
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

	.employer-workspace-page a,
	.employer-workspace-page button,
	.employer-workspace-page input {
  font: inherit;
}

.emp-header,
.emp-header-actions,
.emp-panel-header,
.emp-chart-legend,
.emp-chart-summary,
.emp-listing-row,
.emp-application-row,
.emp-pipeline,
.emp-pipeline-flow,
.emp-pipeline-step {
  display: flex;
  align-items: center;
}

	.emp-post-button,
	.emp-outline-button,
	.emp-pipeline-button {
  text-decoration: none;
  border-radius: 12px;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.emp-post-button {
  min-height: 48px;
  padding: 0 28px;
  color: #030712;
  background: linear-gradient(135deg, var(--emp-yellow), #ffbf00);
  box-shadow: 0 18px 38px rgba(255, 214, 0, 0.2);
}

.emp-header {
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 26px;
}

.emp-header h1 {
  margin: 0;
  font-size: clamp(2rem, 3vw, 3.1rem);
  line-height: 1.02;
  font-weight: 950;
}

.emp-header p,
.emp-panel p {
  color: var(--emp-muted);
}

.emp-header p {
  margin: 8px 0 0;
  font-size: 17px;
}

.emp-header-actions {
  gap: 14px;
}

.emp-action-wrap {
  position: relative;
  display: inline-flex;
}

.emp-date-button,
.emp-filter-button,
.emp-panel-header button {
  min-height: 48px;
  border-radius: 12px;
  border: 1px solid var(--emp-border);
  background: rgba(15, 23, 42, 0.58);
  color: var(--emp-muted);
  padding: 0 18px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.emp-date-button[aria-expanded="true"],
.emp-filter-button[aria-expanded="true"],
.emp-panel-header button:hover {
  border-color: rgba(255, 214, 0, 0.46);
  color: var(--emp-text);
}

.emp-popover {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 20;
  width: 286px;
  border: 1px solid var(--emp-border);
  border-radius: 16px;
  background: rgba(7, 13, 27, 0.96);
  box-shadow: 0 22px 54px rgba(0, 0, 0, 0.38);
  backdrop-filter: blur(22px);
}

.emp-date-menu {
  padding: 10px;
}

.emp-date-menu button {
  width: 100%;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--emp-text);
  padding: 12px;
  text-align: left;
  cursor: pointer;
}

.emp-date-menu button + button {
  margin-top: 4px;
}

.emp-date-menu button strong,
.emp-date-menu button span {
  display: block;
}

.emp-date-menu button strong {
  font-weight: 900;
}

.emp-date-menu button span {
  margin-top: 3px;
  color: var(--emp-soft);
  font-size: 12px;
  font-weight: 750;
}

.emp-date-menu button:hover,
.emp-date-menu button.is-active,
.emp-filter-chips button:hover,
.emp-filter-chips button.is-active {
  border-color: rgba(255, 214, 0, 0.5);
  background: rgba(255, 214, 0, 0.12);
  color: var(--emp-yellow);
}

.emp-filter-menu {
  padding: 16px;
}

.emp-filter-menu h3,
.emp-filter-menu h4,
.emp-filter-menu p {
  margin: 0;
}

.emp-filter-menu h3 {
  font-size: 16px;
  font-weight: 950;
}

.emp-filter-menu p {
  margin-top: 5px;
  color: var(--emp-soft);
  font-size: 12px;
}

.emp-filter-menu h4 {
  margin-top: 16px;
  color: var(--emp-muted);
  font-size: 12px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.emp-filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 9px;
}

.emp-filter-chips button,
.emp-filter-reset {
  border: 1px solid var(--emp-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--emp-muted);
  padding: 8px 11px;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
}

.emp-filter-reset {
  width: 100%;
  margin-top: 16px;
  border-radius: 12px;
  color: var(--emp-yellow);
}

.emp-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 18px;
  margin-bottom: 20px;
}

.emp-panel,
.emp-metric-card {
  border: 1px solid var(--emp-border);
  background: linear-gradient(145deg, rgba(20, 34, 60, 0.82), rgba(10, 16, 33, 0.76));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(24px);
}

.emp-metric-card {
  min-height: 140px;
  border-radius: 16px;
  padding: 22px;
  position: relative;
  overflow: hidden;
}

.emp-metric-card::after {
  content: "";
  position: absolute;
  inset: auto -20px -48px auto;
  width: 130px;
  height: 130px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--emp-accent) 22%, transparent);
  filter: blur(20px);
}

.emp-metric-icon {
  width: 52px;
  height: 52px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  color: var(--emp-accent);
  background: color-mix(in srgb, var(--emp-accent) 18%, rgba(15, 23, 42, 0.7));
  margin-bottom: 12px;
}

.emp-metric-card strong {
  font-size: 31px;
  line-height: 1;
}

.emp-metric-card p {
  margin: 8px 0 18px;
}

.emp-metric-card small,
.emp-chart-summary small {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #22c55e;
  font-weight: 900;
}

.emp-metric-card small.down,
.emp-chart-summary small.down {
  color: #f59e0b;
}

.emp-metric-card small span {
  color: var(--emp-soft);
  font-weight: 700;
}

.emp-main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.98fr) minmax(320px, 1.1fr);
  gap: 18px;
  margin-bottom: 20px;
}

.emp-panel {
  border-radius: 18px;
  padding: 24px;
  min-width: 0;
}

.emp-panel-header {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.emp-panel-header h2,
.emp-pipeline h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 950;
}

.emp-panel-header a {
  color: #60a5fa;
  text-decoration: none;
  font-weight: 850;
}

.emp-panel-header button {
  min-height: 36px;
  padding: 0 12px;
  font-size: 13px;
}

.emp-chart-legend {
  gap: 14px;
  color: var(--emp-muted);
  font-size: 13px;
  margin-bottom: 10px;
}

.emp-chart-legend span {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.purple-dot {
  background: #8b5cf6;
}

.green-dot {
  background: #34d399;
}

.emp-chart {
  width: 100%;
  height: 210px;
  overflow: visible;
}

.emp-chart line {
  stroke: rgba(148, 163, 184, 0.15);
  stroke-width: 1;
  stroke-dasharray: 7 10;
}

.emp-chart polyline {
  fill: none;
  stroke: #8b5cf6;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.emp-chart .hired-line {
  stroke: #34d399;
  stroke-width: 3;
}

.emp-chart circle {
  fill: #a78bfa;
  vector-effect: non-scaling-stroke;
}

.emp-chart .hired-point {
  fill: #34d399;
}

.emp-chart-labels {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  color: var(--emp-soft);
  font-size: 12px;
  margin-top: -4px;
}

.emp-chart-summary {
  margin: 20px -24px -24px;
  border-top: 1px solid var(--emp-border);
}

.emp-chart-summary div {
  flex: 1;
  padding: 20px 24px;
  border-right: 1px solid rgba(148, 163, 184, 0.12);
}

.emp-chart-summary div:last-child {
  border-right: 0;
}

.emp-chart-summary strong {
  display: block;
  color: #8b5cf6;
  font-size: 24px;
}

.emp-chart-summary span {
  display: block;
  color: var(--emp-muted);
  margin: 5px 0;
}

.emp-listing-stack,
.emp-application-stack {
  display: flex;
  flex-direction: column;
}

.emp-listing-row {
  min-height: 82px;
  gap: 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  color: inherit;
  text-decoration: none;
  transition:
    background 0.18s ease,
    border-color 0.18s ease;
}

.emp-listing-row:hover {
  border-color: rgba(255, 214, 0, 0.24);
  background: rgba(255, 255, 255, 0.035);
}

.emp-listing-row > span {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12);
}

.emp-listing-row > span.is-review {
  background: #f59e0b;
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.12);
}

.emp-listing-row div,
.emp-application-row div {
  min-width: 0;
  flex: 1;
}

.emp-listing-row strong,
.emp-application-row strong {
  display: block;
  color: var(--emp-text);
  font-weight: 950;
}

.emp-listing-row small,
.emp-application-row small {
  display: block;
  color: var(--emp-soft);
  margin-top: 7px;
}

.emp-listing-row b {
  font-size: 18px;
}

.emp-listing-row em {
  color: var(--emp-muted);
  font-size: 12px;
  font-style: normal;
}

.emp-outline-button,
.emp-pipeline-button {
  width: 100%;
  min-height: 44px;
  margin-top: 18px;
  border: 1px solid rgba(255, 214, 0, 0.74);
  background: rgba(255, 214, 0, 0.06);
  color: var(--emp-yellow);
}

.emp-application-row {
  min-height: 64px;
  gap: 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  color: inherit;
  text-decoration: none;
  transition: background 0.18s ease;
}

.emp-application-row:hover {
  background: rgba(255, 255, 255, 0.035);
}

.emp-application-avatar {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  display: block;
  flex: 0 0 auto;
  background: linear-gradient(135deg, #334155, #8b5cf6);
  overflow: hidden;
  color: #fff;
  text-align: center;
  line-height: 42px;
  font-size: 13px;
  font-weight: 950;
}

.emp-application-avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.emp-application-row time {
  color: var(--emp-muted);
  font-size: 12px;
}

.emp-application-row em {
  min-width: 72px;
  border-radius: 999px;
  padding: 5px 10px;
  color: #fff;
  background: #7c3aed;
  text-align: center;
  font-size: 12px;
  font-style: normal;
  font-weight: 850;
}

.emp-application-row em.info {
  background: #2563eb;
}

.emp-application-row em.warning {
  background: #f59e0b;
  color: #1f1300;
}

.emp-application-row em.success {
  background: #10b981;
}

.emp-application-row em.danger {
  background: #ef4444;
}

.emp-pipeline {
  min-height: 150px;
  justify-content: space-between;
  gap: 26px;
}

.emp-pipeline p {
  margin: 8px 0 0;
}

.emp-pipeline-flow {
  flex: 1;
  gap: 22px;
  justify-content: center;
}

.emp-pipeline-flow > span {
  min-width: 82px;
  color: var(--emp-soft);
  text-align: center;
  position: relative;
}

.emp-pipeline-flow > span::before,
.emp-pipeline-flow > span::after {
  content: "";
  position: absolute;
  top: 50%;
  width: 32px;
  height: 1px;
  background: rgba(148, 163, 184, 0.35);
}

.emp-pipeline-flow > span::before {
  left: -28px;
}

.emp-pipeline-flow > span::after {
  right: -28px;
}

.emp-pipeline-step {
  gap: 14px;
}

.emp-pipeline-step span {
  width: 58px;
  height: 58px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  color: var(--emp-accent);
  background: color-mix(in srgb, var(--emp-accent) 20%, rgba(15, 23, 42, 0.7));
  border: 1px solid color-mix(in srgb, var(--emp-accent) 44%, transparent);
}

.emp-pipeline-step strong {
  font-size: 24px;
}

.emp-pipeline-step small {
  color: var(--emp-muted);
  font-weight: 800;
}

.emp-pipeline-button {
  width: auto;
  min-width: 150px;
  margin-top: 0;
  padding: 0 22px;
}

:where(.light, [data-theme='light']) .employer-workspace-page {
  --emp-bg: #f7f8fc;
  --emp-panel: rgba(255, 255, 255, 0.8);
  --emp-panel-strong: rgba(255, 255, 255, 0.94);
  --emp-border: rgba(17, 24, 39, 0.1);
  --emp-text: #111827;
  --emp-muted: #4b5563;
  --emp-soft: #6b7280;
  background:
    radial-gradient(circle at 18% 16%, rgba(56, 189, 248, 0.1), transparent 28%),
    radial-gradient(circle at 82% 18%, rgba(255, 214, 0, 0.12), transparent 30%),
    radial-gradient(circle at 74% 78%, rgba(236, 72, 153, 0.08), transparent 30%),
    var(--sb-color-background);
}

:where(.light, [data-theme='light']) .employer-workspace-page .emp-panel,
:where(.light, [data-theme='light']) .employer-workspace-page .emp-metric-card {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.9));
  box-shadow: 0 16px 40px rgba(17, 24, 39, 0.08);
}

:where(.light, [data-theme='light']) .employer-workspace-page .emp-date-button,
:where(.light, [data-theme='light']) .employer-workspace-page .emp-filter-button,
:where(.light, [data-theme='light']) .employer-workspace-page .emp-panel-header button,
:where(.light, [data-theme='light']) .employer-workspace-page .emp-filter-chips button,
:where(.light, [data-theme='light']) .employer-workspace-page .emp-filter-reset {
  background: rgba(255, 255, 255, 0.76);
  color: var(--emp-text);
  box-shadow: 0 10px 24px rgba(17, 24, 39, 0.06);
}

:where(.light, [data-theme='light']) .employer-workspace-page .emp-popover {
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 22px 54px rgba(17, 24, 39, 0.14);
}

:where(.light, [data-theme='light']) .employer-workspace-page .emp-date-menu button:hover,
:where(.light, [data-theme='light']) .employer-workspace-page .emp-date-menu button.is-active,
:where(.light, [data-theme='light']) .employer-workspace-page .emp-filter-chips button:hover,
:where(.light, [data-theme='light']) .employer-workspace-page .emp-filter-chips button.is-active,
:where(.light, [data-theme='light']) .employer-workspace-page .emp-filter-reset,
:where(.light, [data-theme='light']) .employer-workspace-page .emp-outline-button,
:where(.light, [data-theme='light']) .employer-workspace-page .emp-pipeline-button {
  color: #111827;
}

:where(.light, [data-theme='light']) .employer-workspace-page .emp-outline-button,
:where(.light, [data-theme='light']) .employer-workspace-page .emp-pipeline-button {
  background: rgba(255, 214, 0, 0.12);
}

:where(.light, [data-theme='light']) .employer-workspace-page .emp-listing-row:hover,
:where(.light, [data-theme='light']) .employer-workspace-page .emp-application-row:hover {
  background: rgba(17, 24, 39, 0.035);
}

@media (max-width: 1280px) {
	  .employer-workspace-page {
	    padding-left: 32px;
	    padding-right: 32px;
	  }

  .emp-metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .emp-main-grid {
    grid-template-columns: 1fr;
  }

  .emp-pipeline {
    align-items: flex-start;
    flex-direction: column;
  }

  .emp-pipeline-flow {
    width: 100%;
    justify-content: flex-start;
    overflow-x: auto;
  }
}

	@media (max-width: 760px) {
	  .employer-workspace-page {
	    padding: 0 18px 48px;
	  }

	  .emp-header,
	  .emp-header-actions {
	    align-items: stretch;
	    flex-direction: column;
	  }

	  .emp-header-actions {
	    margin-left: 0;
	  }

  .emp-metrics {
    grid-template-columns: 1fr;
  }

  .emp-chart-summary {
    flex-direction: column;
  }
}
`;

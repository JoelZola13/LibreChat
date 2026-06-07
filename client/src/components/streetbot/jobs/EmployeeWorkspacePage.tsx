/* eslint-disable i18next/no-literal-string, no-nested-ternary */
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Bookmark,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Eye,
  FileText,
  Gift,
  Grid3X3,
  Lightbulb,
  List,
  Lock,
  MessageCircle,
  MoreVertical,
  Pencil,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UploadCloud,
  UserRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getApplications, getResumeVersions, getUploadedDocuments } from './jobsStorage';
import JobBoardTopNav from './JobBoardTopNav';
import type { ApplicationStatus, JobApplication, ResumeVersion, UploadedDocument } from './types';

type WorkspaceView = 'applications' | 'resume' | 'editor' | 'opportunities';
type ApplicationFilter = 'all' | ApplicationStatus | 'withdrawn';
type DocumentTab = 'resume' | 'coverLetters';

const FILTERS: { key: ApplicationFilter; label: string; fallbackCount: number }[] = [
  { key: 'all', label: 'All', fallbackCount: 8 },
  { key: 'applied', label: 'Applied', fallbackCount: 2 },
  { key: 'screening', label: 'Screening', fallbackCount: 2 },
  { key: 'under_review', label: 'Under Review', fallbackCount: 1 },
  { key: 'interview', label: 'Interview', fallbackCount: 2 },
  { key: 'offered', label: 'Offered', fallbackCount: 1 },
  { key: 'hired', label: 'Hired', fallbackCount: 1 },
  { key: 'rejected', label: 'Rejected', fallbackCount: 1 },
  { key: 'withdrawn', label: 'Withdrawn', fallbackCount: 1 },
];

const SAMPLE_EMPLOYEE_APPLICATIONS: JobApplication[] = [
  {
    id: 'employee-demo-app-1',
    jobId: 'sample-26',
    userId: 'demo-employee',
    status: 'applied',
    appliedAt: '2026-05-20T14:30:00.000Z',
    updatedAt: '2026-05-20T14:30:00.000Z',
    withdrawn: false,
    applicantName: 'Joel',
    applicantEmail: 'joel@streetvoices.ca',
    coverNote: 'I can help write interviews, profiles, blog posts, and community stories.',
    jobSnapshot: {
      title: 'Volunteer Writer',
      organization: 'Street Voices',
      logo_url: '/job-logos/street-voices.svg',
      opportunity_type: 'Volunteer',
      location: 'Remote / Hybrid',
      compensation: 'Volunteer (unpaid)',
    },
  },
  {
    id: 'employee-demo-app-2',
    jobId: 'sample-27',
    userId: 'demo-employee',
    status: 'screening',
    appliedAt: '2026-05-18T16:15:00.000Z',
    updatedAt: '2026-05-19T10:45:00.000Z',
    withdrawn: false,
    applicantName: 'Joel',
    applicantEmail: 'joel@streetvoices.ca',
    coverNote:
      'I have event media experience and can support shoots, reels, and behind-the-scenes capture.',
    jobSnapshot: {
      title: 'Volunteer Videographer',
      organization: 'Street Voices',
      logo_url: '/job-logos/street-voices.svg',
      opportunity_type: 'Volunteer',
      location: 'Toronto / Hybrid',
      compensation: 'Volunteer (unpaid)',
    },
  },
  {
    id: 'employee-demo-app-3',
    jobId: 'sample-28',
    userId: 'demo-employee',
    status: 'screening',
    appliedAt: '2026-05-16T18:05:00.000Z',
    updatedAt: '2026-05-17T12:00:00.000Z',
    withdrawn: false,
    applicantName: 'Joel',
    applicantEmail: 'joel@streetvoices.ca',
    coverNote:
      'I can help with production planning, guest outreach, and weekly episode coordination.',
    jobSnapshot: {
      title: 'Podcast Producer',
      organization: 'Street Voices',
      logo_url: '/job-logos/street-voices.svg',
      opportunity_type: 'Part-time',
      location: 'Remote',
      compensation: '$150 per episode',
    },
  },
  {
    id: 'employee-demo-app-4',
    jobId: 'sample-1',
    userId: 'demo-employee',
    status: 'under_review',
    appliedAt: '2026-05-12T11:10:00.000Z',
    updatedAt: '2026-05-15T09:20:00.000Z',
    withdrawn: false,
    applicantName: 'Joel',
    applicantEmail: 'joel@streetvoices.ca',
    coverNote:
      'I am interested in growing my frontend skills and contributing to local web projects.',
    jobSnapshot: {
      title: 'Junior Web Developer',
      organization: 'TechStart Toronto',
      logo_url: '/job-logos/techstart.svg',
      opportunity_type: 'Full-time',
      location: 'Toronto, ON',
      compensation: '$55,000-65,000/year',
    },
  },
  {
    id: 'employee-demo-app-5',
    jobId: 'sample-2',
    userId: 'demo-employee',
    status: 'interview',
    appliedAt: '2026-05-08T13:45:00.000Z',
    updatedAt: '2026-05-21T15:00:00.000Z',
    withdrawn: false,
    applicantName: 'Joel',
    applicantEmail: 'joel@streetvoices.ca',
    coverNote:
      'I can plan content calendars, write captions, and support short-form campaign ideas.',
    jobSnapshot: {
      title: 'Social Media Coordinator',
      organization: 'Maple Leaf Marketing',
      logo_url: '/job-logos/mapleleaf.svg',
      opportunity_type: 'Full-time',
      location: 'Vancouver, BC',
      compensation: '$45,000-52,000/year',
    },
  },
  {
    id: 'employee-demo-app-6',
    jobId: 'sample-4',
    userId: 'demo-employee',
    status: 'offered',
    appliedAt: '2026-05-03T09:00:00.000Z',
    updatedAt: '2026-05-18T17:30:00.000Z',
    withdrawn: false,
    applicantName: 'Joel',
    applicantEmail: 'joel@streetvoices.ca',
    coverNote:
      'My portfolio includes campaign layouts, social graphics, and nonprofit design support.',
    jobSnapshot: {
      title: 'Graphic Designer',
      organization: 'Creative Collective Studio',
      logo_url: '/job-logos/creative-collective.svg',
      opportunity_type: 'Contract',
      location: 'Montreal, QC',
      compensation: '$35-50/hour',
    },
  },
  {
    id: 'employee-demo-app-7',
    jobId: 'sample-13',
    userId: 'demo-employee',
    status: 'hired',
    appliedAt: '2026-04-24T12:00:00.000Z',
    updatedAt: '2026-05-07T10:00:00.000Z',
    withdrawn: false,
    applicantName: 'Joel',
    applicantEmail: 'joel@streetvoices.ca',
    coverNote: 'I can support intake, scheduling, and community care coordination.',
    jobSnapshot: {
      title: 'Community Support Worker',
      organization: 'Community Care Network',
      logo_url: '/job-logos/community-care.svg',
      opportunity_type: 'Full-time',
      location: 'Toronto, ON',
      compensation: '$42,000-50,000/year',
    },
  },
  {
    id: 'employee-demo-app-8',
    jobId: 'sample-5',
    userId: 'demo-employee',
    status: 'rejected',
    appliedAt: '2026-04-19T10:30:00.000Z',
    updatedAt: '2026-04-28T11:30:00.000Z',
    withdrawn: true,
    applicantName: 'Joel',
    applicantEmail: 'joel@streetvoices.ca',
    coverNote: 'I withdrew this application after choosing a better-fit role.',
    jobSnapshot: {
      title: 'Delivery Driver',
      organization: 'QuickShip Logistics',
      logo_url: '/job-logos/quickship.svg',
      opportunity_type: 'Full-time',
      location: 'Ottawa, ON',
      compensation: '$18-22/hour + mileage',
    },
  },
];

const RECOMMENDED_ROLES = [
  {
    title: 'Volunteer Personality',
    company: 'Street Voices',
    location: 'Toronto',
    mode: 'Hybrid / Event-based',
    hours: '20-30 hrs/week',
    match: 92,
    matchLabel: 'Excellent Match',
    tags: ['Communication', 'Event Planning', 'People Skills', '+2'],
    accent: '#7c3aed',
    icon: UserRound,
    note: 'You have strong people skills and event experience. Great fit!',
  },
  {
    title: 'Volunteer Writer',
    company: 'Street Voices',
    location: 'Remote',
    mode: 'Hybrid',
    hours: '20-30 hrs/week',
    match: 86,
    matchLabel: 'Strong Match',
    tags: ['Writing', 'Content Creation', 'Research', '+1'],
    accent: '#4f46e5',
    icon: Pencil,
    note: 'Your writing and research skills align well with this role.',
  },
  {
    title: 'Volunteer Videographer',
    company: 'Street Voices',
    location: 'Toronto',
    mode: 'Hybrid / Event-based',
    hours: '10-20 hrs/week',
    match: 78,
    matchLabel: 'Good Match',
    tags: ['Video Editing', 'Storytelling', 'Adobe Premiere', '+1'],
    accent: '#14b8a6',
    icon: Eye,
    note: 'Your creative background and tech skills are a great match.',
  },
];

const SKILLS = [
  'Project Management',
  'Data Analysis',
  'Problem Solving',
  'Microsoft Excel',
  'SQL',
  'Communication',
  'Leadership',
  'Data Visualization',
  'Agile Methodologies',
];

const INTERESTS = [
  'Data & Analytics',
  'Technology Innovation',
  'Community Development',
  'Sustainability',
  'Education',
  'Nonprofit',
  'Digital Media',
];

function getUserId(): string {
  const key = 'sb_user_id';
  let userId = localStorage.getItem(key);
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(key, userId);
  }
  return userId;
}

function getInitialView(pathname: string, search: string): WorkspaceView {
  const params = new URLSearchParams(search);
  const tab = params.get('tab');
  if (tab === 'resume' || pathname.includes('/resume')) return 'resume';
  if (tab === 'opportunities') return 'opportunities';
  if (tab === 'editor') return 'editor';
  return 'applications';
}

function formatShortDate(value?: string) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function filterApplications(applications: JobApplication[], filter: ApplicationFilter) {
  if (filter === 'all') return applications;
  if (filter === 'withdrawn') return applications.filter((application) => application.withdrawn);
  return applications.filter(
    (application) => !application.withdrawn && application.status === filter,
  );
}

function searchApplications(applications: JobApplication[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return applications;

  return applications.filter((application) =>
    [
      application.applicantName,
      application.jobSnapshot.title,
      application.jobSnapshot.organization,
      application.jobSnapshot.location,
      application.status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalized),
  );
}

function getWorkspaceApplications(storedApplications: JobApplication[]) {
  const storedIds = new Set(storedApplications.map((application) => application.id));
  const demoApplications = SAMPLE_EMPLOYEE_APPLICATIONS.filter(
    (application) => !storedIds.has(application.id),
  );
  return [...storedApplications, ...demoApplications];
}

function formatApplicationStatus(application: JobApplication) {
  if (application.withdrawn) return 'Withdrawn';
  if (application.status === 'under_review') return 'Under Review';
  return application.status.charAt(0).toUpperCase() + application.status.slice(1);
}

function countApplications(
  applications: JobApplication[],
  filter: ApplicationFilter,
  fallback: number,
) {
  if (!applications.length) return fallback;
  return filterApplications(applications, filter).length;
}

function getResumeLabel(resumeVersions: ResumeVersion[], uploadedDocs: UploadedDocument[]) {
  const defaultVersion = resumeVersions.find((resume) => resume.isDefault) || resumeVersions[0];
  const defaultUpload = uploadedDocs.find((doc) => doc.kind === 'resume' && doc.isDefault);
  return defaultVersion?.label || defaultUpload?.label || 'Marketing Specialist Resume';
}

function accentStyle(accent: string): CSSProperties {
  return { '--accent': accent } as CSSProperties;
}

export default function EmployeeWorkspacePage() {
  const location = useLocation();
  const [activeView, setActiveView] = useState<WorkspaceView>(() =>
    getInitialView(location.pathname, location.search),
  );
  const [applicationFilter, setApplicationFilter] = useState<ApplicationFilter>('all');
  const [documentTab, setDocumentTab] = useState<DocumentTab>('resume');
  const [navSearch, setNavSearch] = useState('');

  const userId = useMemo(() => getUserId(), []);
  const storedApplications = useMemo(() => getApplications(userId), [userId]);
  const applications = useMemo(
    () => getWorkspaceApplications(storedApplications),
    [storedApplications],
  );
  const resumeVersions = useMemo(() => getResumeVersions(userId), [userId]);
  const uploadedDocs = useMemo(() => getUploadedDocuments(userId), [userId]);

  useEffect(() => {
    setActiveView(getInitialView(location.pathname, location.search));
  }, [location.pathname, location.search]);

  const activeApplications = applications.filter((application) => !application.withdrawn);
  const interviews = activeApplications.filter((application) => application.status === 'interview');
  const offers = activeApplications.filter((application) => application.status === 'offered');
  const visibleApplications = searchApplications(
    filterApplications(applications, applicationFilter),
    navSearch,
  );
  const resumeLabel = getResumeLabel(resumeVersions, uploadedDocs);

  const stats = [
    {
      label: 'Active Applications',
      value: activeApplications.length || 6,
      meta: '2 new this week',
      icon: Briefcase,
      accent: '#3b5bff',
    },
    {
      label: 'Interviews',
      value: interviews.length || 2,
      meta: 'scheduled',
      icon: CalendarDays,
      accent: '#7c3aed',
    },
    {
      label: 'Offers',
      value: offers.length || 1,
      meta: 'Last offer on May 3',
      icon: Gift,
      accent: '#16a34a',
    },
    {
      label: 'Saved Jobs',
      value: 18,
      meta: "Jobs you're interested in",
      icon: Bookmark,
      accent: '#f59e0b',
    },
  ];

  const mainTabs = [
    { key: 'applications' as const, label: 'My Applications', icon: Briefcase },
    { key: 'resume' as const, label: 'My Resume', icon: FileText },
  ];

  return (
    <div className="employee-workspace-page">
      <style>{employeeWorkspaceStyles}</style>
      <JobBoardTopNav
        searchValue={navSearch}
        onSearchChange={setNavSearch}
        placeholder="Search jobs, applications, resume..."
      />

      <div className="ew-main-shell">
        {activeView === 'editor' ? (
          <EditorView setActiveView={setActiveView} />
        ) : activeView === 'opportunities' ? (
          <OpportunitiesView setActiveView={setActiveView} />
        ) : (
          <main className="ew-content">
            <Link to="/jobs" className="ew-back-link">
              <ArrowLeft size={18} />
              Back to Jobs
            </Link>

            <section className="ew-hero">
              <h1>Employee Workspace</h1>
              <p>Track applications, manage your resume, and keep your job materials ready.</p>
            </section>

            <nav className="ew-main-tabs" aria-label="Employee workspace sections">
              {mainTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeView === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    className={['ew-main-tab', isActive ? 'is-active' : '']
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setActiveView(tab.key)}
                  >
                    <Icon size={18} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {activeView === 'applications' ? (
              <ApplicationsView
                stats={stats}
                applications={visibleApplications}
                allApplications={applications}
                applicationFilter={applicationFilter}
                setApplicationFilter={setApplicationFilter}
                setActiveView={setActiveView}
              />
            ) : (
              <ResumeView
                documentTab={documentTab}
                setDocumentTab={setDocumentTab}
                resumeLabel={resumeLabel}
                setActiveView={setActiveView}
              />
            )}
          </main>
        )}
      </div>
    </div>
  );
}

function ApplicationsView({
  stats,
  applications,
  allApplications,
  applicationFilter,
  setApplicationFilter,
  setActiveView,
}: {
  stats: Array<{
    label: string;
    value: number;
    meta: string;
    icon: LucideIcon;
    accent: string;
  }>;
  applications: JobApplication[];
  allApplications: JobApplication[];
  applicationFilter: ApplicationFilter;
  setApplicationFilter: (filter: ApplicationFilter) => void;
  setActiveView: (view: WorkspaceView) => void;
}) {
  return (
    <>
      <section className="ew-stats-grid" aria-label="Workspace stats">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article key={stat.label} className="ew-stat-card" style={accentStyle(stat.accent)}>
              <div className="ew-stat-icon">
                <Icon size={31} />
              </div>
              <div>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <small>{stat.meta}</small>
              </div>
            </article>
          );
        })}
      </section>

      <div className="ew-work-grid">
        <section className="ew-work-main">
          <div className="ew-filter-bar" aria-label="Application filters">
            {FILTERS.map((filter) => {
              const isActive = applicationFilter === filter.key;
              return (
                <button
                  key={filter.key}
                  type="button"
                  className={['ew-filter-pill', isActive ? 'is-active' : '']
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setApplicationFilter(filter.key)}
                >
                  {filter.label}
                  <span>
                    {countApplications(allApplications, filter.key, filter.fallbackCount)}
                  </span>
                </button>
              );
            })}
          </div>

          {applications.length ? (
            <div className="ew-application-list">
              {applications.map((application) => (
                <ApplicationRow key={application.id} application={application} />
              ))}
            </div>
          ) : (
            <div className="ew-empty-panel">
              <div className="ew-empty-visual">
                <div className="ew-folder-card">
                  <Search size={74} />
                </div>
                <Sparkles className="ew-floating-sparkle one" size={15} />
                <Sparkles className="ew-floating-sparkle two" size={18} />
              </div>
              <h2>No applications found</h2>
              <p>You haven&apos;t applied to any jobs yet.</p>
              <div className="ew-empty-actions">
                <Link to="/jobs" className="ew-primary-button">
                  Browse Jobs
                  <ArrowRight size={19} />
                </Link>
                <button
                  type="button"
                  className="ew-secondary-button"
                  onClick={() => setActiveView('resume')}
                >
                  <Upload size={18} />
                  Upload Resume
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="ew-right-rail" aria-label="Application guidance">
          <ProfileCompletionCard
            actionLabel="Complete Profile"
            onAction={() => setActiveView('editor')}
          />
          <NextStepsCard setActiveView={setActiveView} />
          <TipCard setActiveView={setActiveView} />
        </aside>
      </div>
    </>
  );
}

function ApplicationRow({ application }: { application: JobApplication }) {
  return (
    <Link to={`/jobs/${application.jobId}?apply=1`} className="ew-application-row">
      <div className="ew-app-icon">
        <Briefcase size={24} />
      </div>
      <div>
        <strong>{application.jobSnapshot.title}</strong>
        <span>
          {application.jobSnapshot.organization || 'Street Voices'} ·{' '}
          {application.jobSnapshot.location || 'Remote / Hybrid'}
        </span>
        <small>Applied {formatShortDate(application.appliedAt)}</small>
      </div>
      <span className="ew-status-chip">{formatApplicationStatus(application)}</span>
    </Link>
  );
}

function ResumeView({
  documentTab,
  setDocumentTab,
  resumeLabel,
  setActiveView,
}: {
  documentTab: DocumentTab;
  setDocumentTab: (tab: DocumentTab) => void;
  resumeLabel: string;
  setActiveView: (view: WorkspaceView) => void;
}) {
  return (
    <div className="ew-resume-grid">
      <section className="ew-documents">
        <header className="ew-section-heading">
          <h2>My Documents</h2>
          <p>Upload or create your resume and cover letter to apply for jobs faster.</p>
        </header>

        <div className="ew-document-tabs" aria-label="Document type">
          <button
            type="button"
            className={documentTab === 'resume' ? 'is-active' : ''}
            onClick={() => setDocumentTab('resume')}
          >
            <FileText size={18} />
            Resume
          </button>
          <button
            type="button"
            className={documentTab === 'coverLetters' ? 'is-active' : ''}
            onClick={() => setDocumentTab('coverLetters')}
          >
            <MessageCircle size={18} />
            Cover Letters
          </button>
        </div>

        <div className="ew-action-card-grid">
          <button
            type="button"
            className="ew-document-action-card upload"
            onClick={() => setActiveView('editor')}
          >
            <span className="ew-action-orb">
              <UploadCloud size={33} />
            </span>
            <span>
              <strong>Upload Resume</strong>
              <small>
                Upload an existing PDF or Word file and we&apos;ll help you keep it organized.
              </small>
            </span>
            <span className="ew-card-art resume-stack" />
            <span className="ew-secondary-button compact">
              <Upload size={17} />
              Upload File
            </span>
          </button>

          <button
            type="button"
            className="ew-document-action-card create"
            onClick={() => setActiveView('editor')}
          >
            <span className="ew-action-orb amber">
              <Sparkles size={31} />
            </span>
            <span>
              <strong>Create Resume</strong>
              <small>Build a professional resume with our guided builder and expert tips.</small>
            </span>
            <span className="ew-card-art profile-stack" />
            <span className="ew-primary-button compact">
              <Sparkles size={17} />
              Create New Resume
            </span>
          </button>
        </div>

        <section className="ew-saved-resumes">
          <header className="ew-section-heading">
            <h2>Your Saved Resumes</h2>
            <p>Manage and use your saved resumes for job applications.</p>
          </header>

          <article className="ew-saved-row">
            <div className="ew-file-icon">
              <FileText size={22} />
            </div>
            <div>
              <strong>{resumeLabel}</strong>
              <span>Updated May 1, 2025 · 2 pages</span>
            </div>
            <span className="ew-default-chip">Default</span>
            <div className="ew-row-actions">
              <button type="button" onClick={() => setActiveView('editor')}>
                <Eye size={18} />
                Preview
              </button>
              <button type="button" onClick={() => setActiveView('editor')}>
                <Pencil size={18} />
                Edit
              </button>
              <button
                type="button"
                className="ew-primary-button compact"
                onClick={() => setActiveView('editor')}
              >
                Use for Applications
              </button>
              <button
                type="button"
                aria-label="More options"
                onClick={() => setDocumentTab('coverLetters')}
              >
                <MoreVertical size={18} />
              </button>
            </div>
          </article>

          <button
            type="button"
            className="ew-add-resume-row"
            onClick={() => setActiveView('editor')}
          >
            <Plus size={24} />
            <span>
              <strong>Add another resume</strong>
              <small>Upload or create a new resume</small>
            </span>
            <ChevronRight size={21} />
          </button>
        </section>
      </section>

      <aside className="ew-resume-preview" aria-label="Resume preview">
        <div className="ew-preview-card">
          <header>
            <span className="ew-linked-icon">
              <FileText size={21} />
            </span>
            <span>
              <strong>Continue Editing</strong>
              <small>Jump back into your latest resume.</small>
            </span>
          </header>
          <div className="ew-paper-preview">
            <strong>Jordan Taylor</strong>
            <small>Marketing Specialist</small>
            <span />
            <p>Professional Summary</p>
            <em />
            <em />
            <p>Experience</p>
            <em />
            <em />
            <p>Education</p>
            <em />
          </div>
          <button
            type="button"
            className="ew-purple-button"
            onClick={() => setActiveView('editor')}
          >
            <Pencil size={18} />
            Continue Editing
          </button>
          <button
            type="button"
            className="ew-secondary-button wide"
            onClick={() => setActiveView('editor')}
          >
            <Eye size={18} />
            Preview Full Resume
          </button>
        </div>
        <p className="ew-secure-note">
          <Lock size={18} />
          Your documents are private and secure.
        </p>
      </aside>
    </div>
  );
}

function EditorView({ setActiveView }: { setActiveView: (view: WorkspaceView) => void }) {
  return (
    <main className="ew-editor-content">
      <Link to="/jobs/employee-workspace?tab=resume" className="ew-back-link">
        <ArrowLeft size={18} />
        Back to Employee Workspace
      </Link>

      <div className="ew-editor-header">
        <div>
          <h1>Editing: My Resume</h1>
          <span className="ew-muted-row">
            <CheckCircle2 size={18} />
            Auto-saved · Last updated just now
          </span>
        </div>
        <div className="ew-editor-actions">
          <button type="button" className="ew-secondary-button">
            <Eye size={18} />
            Preview
          </button>
          <button type="button" className="ew-secondary-button">
            <Save size={18} />
            Save Draft
          </button>
          <button type="button" className="ew-primary-button">
            <Upload size={18} />
            Publish Resume
          </button>
        </div>
      </div>

      <div className="ew-builder-grid">
        <section>
          <div className="ew-stepper">
            {[
              ['1', 'Build', 'Add your experience'],
              ['2', 'Review', 'Optimize your content'],
              ['3', 'Preview', 'See your resume'],
              ['4', 'Publish', 'Make it discoverable'],
            ].map(([number, label, description], index) => (
              <div key={label} className={index === 0 ? 'is-active' : ''}>
                <strong>{number}</strong>
                <span>
                  {label}
                  <small>{description}</small>
                </span>
              </div>
            ))}
          </div>

          <EditorSection
            icon={BookOpen}
            title="Education"
            description="Add your educational background to showcase your foundation."
            action="Add Education"
          >
            <div className="ew-editor-item">
              <strong>Bachelor of Science in Information Technology</strong>
              <span>State University · Graduated May 2022 · GPA: 3.6</span>
              <button type="button">Edit</button>
            </div>
          </EditorSection>

          <EditorSection
            icon={Sparkles}
            title="Core Competencies & Skills"
            description="Highlight the key technical and transferable skills that set you apart."
            action="Add Skill"
          >
            <TagCloud tags={SKILLS} placeholder="Add a skill and press Enter..." />
          </EditorSection>

          <EditorSection
            icon={Search}
            title="Career Interests"
            description="Tell us the types of roles, industries, or causes you care about."
            action="Add Interest"
          >
            <TagCloud tags={INTERESTS} placeholder="Add an interest and press Enter..." />
          </EditorSection>

          <EditorSection
            icon={Award}
            title="Certifications"
            description="Include licenses and certifications that strengthen your profile."
            action="Add Certification"
          >
            <div className="ew-editor-item">
              <strong>Google Data Analytics Professional Certificate</strong>
              <span>Coursera · Issued Jan 2024</span>
              <button type="button">Edit</button>
            </div>
          </EditorSection>
        </section>

        <aside className="ew-right-rail editor">
          <ProfileCompletionCard actionLabel="View Suggestions" />
          <ResumeTipsCard />
          <InspirationCard />
          <ShortcutsCard />
        </aside>
      </div>

      <div className="ew-save-bar">
        <span>You&apos;re doing great. Keep going to build a standout resume.</span>
        <button type="button" className="ew-primary-button" onClick={() => setActiveView('resume')}>
          <Save size={18} />
          Save & Preview Resume
        </button>
      </div>
    </main>
  );
}

function EditorSection({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action: string;
  children: ReactNode;
}) {
  return (
    <section className="ew-editor-section">
      <header>
        <span className="ew-section-icon">
          <Icon size={23} />
        </span>
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <button type="button">
          <Plus size={18} />
          {action}
        </button>
        <ChevronDown size={18} />
      </header>
      {children}
    </section>
  );
}

function TagCloud({ tags, placeholder }: { tags: string[]; placeholder: string }) {
  return (
    <div className="ew-tag-editor">
      <div>
        {tags.map((tag) => (
          <span key={tag}>
            {tag}
            <X size={15} />
          </span>
        ))}
      </div>
      <label>
        <input placeholder={placeholder} />
        <button type="button" aria-label="Add">
          <Plus size={18} />
        </button>
      </label>
    </div>
  );
}

function OpportunitiesView({ setActiveView }: { setActiveView: (view: WorkspaceView) => void }) {
  return (
    <main className="ew-editor-content opportunities">
      <Link to="/jobs/employee-workspace" className="ew-back-link">
        <ArrowLeft size={18} />
        Back to Workspace
      </Link>

      <section className="ew-hero compact">
        <h1>
          <Sparkles size={34} />
          Tailored Opportunities for You
        </h1>
        <p>Smart recommendations based on your skills, interests, and experience.</p>
      </section>

      <div className="ew-builder-grid">
        <section>
          <div className="ew-complete-banner">
            <Sparkles size={26} />
            <span>
              <strong>Let&apos;s improve your matches even more</strong>
              <small>
                Your profile is 72% complete. Add skills, interests, and experience to unlock more
                relevant opportunities.
              </small>
            </span>
            <button type="button" onClick={() => setActiveView('editor')}>
              Complete Profile
              <ArrowRight size={18} />
            </button>
            <X size={18} />
          </div>

          <div className="ew-opportunity-toolbar">
            <button type="button">
              Sort: Best Match
              <ChevronDown size={17} />
            </button>
            <button type="button" className="is-active">
              All Roles
            </button>
            <button type="button">
              Location
              <ChevronDown size={17} />
            </button>
            <button type="button">
              Time Commitment
              <ChevronDown size={17} />
            </button>
            <button type="button">
              Work Mode
              <ChevronDown size={17} />
            </button>
            <button type="button">
              <SlidersHorizontal size={17} />
              More Filters
            </button>
            <span className="ew-view-toggle">
              <Grid3X3 size={18} />
              <List size={18} />
            </span>
          </div>

          <div className="ew-role-list">
            {RECOMMENDED_ROLES.map((role) => {
              const Icon = role.icon;
              return (
                <article key={role.title} className="ew-role-card" style={accentStyle(role.accent)}>
                  <div className="ew-role-avatar">
                    <Icon size={35} />
                    <span />
                  </div>
                  <div className="ew-role-main">
                    <h2>{role.title}</h2>
                    <p>
                      {role.company} · {role.location} / {role.mode}
                    </p>
                    <div className="ew-role-meta">
                      <span>{role.hours}</span>
                      <span>{role.location}</span>
                      <span>{role.mode}</span>
                    </div>
                    <div className="ew-role-tags">
                      {role.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                    <small>
                      <Sparkles size={15} /> {role.note}
                    </small>
                  </div>
                  <div className="ew-match-score">
                    <strong>{role.match}%</strong>
                    <span>{role.matchLabel}</span>
                    <button type="button">Why this match?</button>
                  </div>
                  <div className="ew-role-actions">
                    <Link to="/jobs" className="ew-primary-button compact">
                      View Role
                      <ArrowRight size={18} />
                    </Link>
                    <button type="button" className="ew-secondary-button compact">
                      <Bookmark size={17} />
                      Save
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="ew-right-rail opportunities">
          <ProfileCompletionCard
            title="Your Opportunity Snapshot"
            actionLabel="Complete Profile"
            onAction={() => setActiveView('editor')}
          />
          <DemandSkillsCard />
          <WhyRolesCard />
        </aside>
      </div>
    </main>
  );
}

function ProfileCompletionCard({
  title = 'Profile Completion',
  actionLabel,
  onAction,
}: {
  title?: string;
  actionLabel: string;
  onAction?: () => void;
}) {
  return (
    <article className="ew-side-card profile-completion">
      <h3>{title}</h3>
      <div className="ew-progress-row">
        <div className="ew-progress-ring">72%</div>
        <span>
          <strong>Almost there!</strong>
          <small>Complete your profile to get better job matches.</small>
        </span>
      </div>
      <button type="button" className="ew-secondary-button wide" onClick={onAction}>
        {actionLabel}
        <ArrowRight size={17} />
      </button>
    </article>
  );
}

function NextStepsCard({ setActiveView }: { setActiveView: (view: WorkspaceView) => void }) {
  const steps = [
    ['Upload your resume', 'Get discovered by more employers', FileText, 'resume' as const],
    ['Add skills & interests', 'Improve your match accuracy', ClipboardList, 'editor' as const],
    ['Enable job alerts', 'Never miss relevant opportunities', Bell, 'opportunities' as const],
  ];
  return (
    <article className="ew-side-card">
      <h3>Next Steps</h3>
      {steps.map(([title, description, Icon, view]) => (
        <button
          key={title}
          type="button"
          className="ew-step-link"
          onClick={() => setActiveView(view)}
        >
          <span>
            <Icon size={18} />
          </span>
          <strong>{title}</strong>
          <small>{description}</small>
          <ChevronRight size={19} />
        </button>
      ))}
    </article>
  );
}

function TipCard({ setActiveView }: { setActiveView: (view: WorkspaceView) => void }) {
  return (
    <article className="ew-side-card blue">
      <h3>
        <Lightbulb size={23} />
        Job Search Tip
      </h3>
      <p>
        Tailor your resume for each role you apply to. Highlight skills and experience that match
        the job description.
      </p>
      <button type="button" onClick={() => setActiveView('opportunities')}>
        View more tips
        <ArrowRight size={17} />
      </button>
    </article>
  );
}

function ResumeTipsCard() {
  const tips = [
    ['Add more skills', 'Include 3-5 more skills'],
    ['Quantify achievements', 'Use numbers to stand out'],
    ['Keep it concise', 'Aim for 1-2 pages'],
  ];
  return (
    <article className="ew-side-card">
      <h3>Resume Tips</h3>
      {tips.map(([title, subtitle]) => (
        <button key={title} type="button" className="ew-step-link">
          <span>
            <ClipboardList size={18} />
          </span>
          <strong>{title}</strong>
          <small>{subtitle}</small>
          <ChevronRight size={19} />
        </button>
      ))}
    </article>
  );
}

function InspirationCard() {
  return (
    <article className="ew-side-card purple">
      <h3>Need Inspiration?</h3>
      <p>See examples of strong resumes</p>
      <button type="button">
        View Sample Resumes
        <ArrowRight size={17} />
      </button>
    </article>
  );
}

function ShortcutsCard() {
  return (
    <article className="ew-side-card shortcuts">
      <h3>Keyboard Shortcuts</h3>
      <p>
        <kbd>Ctrl + S</kbd>
        Save draft
      </p>
      <p>
        <kbd>Ctrl + P</kbd>
        Preview resume
      </p>
      <p>
        <kbd>Ctrl + 1-4</kbd>
        Navigate sections
      </p>
    </article>
  );
}

function DemandSkillsCard() {
  const skills = [
    ['Event Planning', 'High demand'],
    ['Content Creation', 'High demand'],
    ['Video Editing', 'Medium demand'],
    ['Writing', 'High demand'],
  ];
  return (
    <article className="ew-side-card">
      <h3>Top Skills in Demand</h3>
      {skills.map(([skill, demand]) => (
        <p key={skill} className="ew-demand-row">
          <span>{skill}</span>
          <strong>{demand}</strong>
        </p>
      ))}
      <button type="button" className="ew-text-link">
        Explore all in-demand skills
        <ArrowRight size={17} />
      </button>
    </article>
  );
}

function WhyRolesCard() {
  return (
    <article className="ew-side-card">
      <h3>Why these roles?</h3>
      <p>These opportunities match your skills, interests, and preferred work style.</p>
      {[
        'Align with your experience',
        'Fit your location preference',
        'Match your time availability',
      ].map((item) => (
        <p key={item} className="ew-check-row">
          <CheckCircle2 size={18} />
          {item}
        </p>
      ))}
      <button type="button" className="ew-text-link">
        Update preferences
        <ArrowRight size={17} />
      </button>
    </article>
  );
}

const employeeWorkspaceStyles = `
.employee-workspace-page {
  --ew-bg: #030914;
  --ew-panel: rgba(12, 23, 43, 0.82);
  --ew-panel-strong: rgba(15, 27, 50, 0.94);
  --ew-border: rgba(148, 163, 184, 0.2);
  --ew-border-bright: rgba(77, 132, 255, 0.46);
  --ew-text: #f8fafc;
  --ew-muted: rgba(226, 232, 240, 0.72);
  --ew-soft: rgba(226, 232, 240, 0.5);
  --ew-yellow: #ffd600;
  min-height: 100dvh;
  background:
    radial-gradient(circle at 62% 30%, rgba(100, 44, 190, 0.34), transparent 32%),
    radial-gradient(circle at 82% 74%, rgba(14, 165, 233, 0.16), transparent 28%),
    linear-gradient(135deg, #020713 0%, #061326 42%, #050816 100%);
  color: var(--ew-text);
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.employee-workspace-page button,
.employee-workspace-page a {
  font: inherit;
}

.ew-sidebar {
  min-height: 100dvh;
  border-right: 1px solid var(--ew-border);
  background: rgba(2, 10, 24, 0.76);
  backdrop-filter: blur(22px);
  padding: 32px 16px;
  display: flex;
  flex-direction: column;
  gap: 28px;
  position: sticky;
  top: 0;
}

.ew-logo-link {
  color: var(--ew-yellow);
  text-decoration: none;
  font-size: 24px;
  font-weight: 950;
  letter-spacing: 0;
}

.ew-side-nav,
.ew-side-footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ew-side-footer {
  margin-top: auto;
  padding-top: 24px;
  border-top: 1px solid var(--ew-border);
}

.ew-side-link {
  width: 100%;
  min-height: 64px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--ew-muted);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 22px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 800;
  text-align: left;
}

.ew-side-link.is-active {
  color: var(--ew-yellow);
  border-color: rgba(255, 214, 0, 0.72);
  border-left-color: var(--ew-yellow);
  background: linear-gradient(135deg, rgba(255, 214, 0, 0.1), rgba(56, 102, 195, 0.18));
}

.ew-side-link:hover {
  background: rgba(255, 255, 255, 0.055);
}

.ew-main-shell {
  min-width: 0;
  position: relative;
}

.ew-topbar {
  height: 96px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 34px 0 48px;
}

.ew-top-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.ew-icon-button,
.ew-donate,
.ew-profile-button {
  min-height: 52px;
  border-radius: 12px;
  border: 1px solid var(--ew-border);
  background: rgba(9, 18, 35, 0.78);
  color: var(--ew-text);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 16px;
  cursor: pointer;
}

.ew-icon-button {
  width: 52px;
  padding: 0;
}

.ew-bell {
  position: relative;
}

.ew-bell span {
  position: absolute;
  top: -7px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  border-radius: 999px;
  background: #ef2f5b;
  color: #fff;
  font-size: 11px;
  font-weight: 900;
  display: grid;
  place-items: center;
}

.ew-donate {
  font-weight: 900;
  padding: 0 22px;
}

.ew-profile-button span {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #8b5cf6, #4f46e5);
  font-weight: 900;
}

.ew-content,
.ew-editor-content {
  padding: 34px 48px 80px;
  max-width: 1660px;
}

.ew-back-link {
  color: var(--ew-muted);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  margin-bottom: 30px;
}

.ew-hero {
  margin-bottom: 24px;
}

.ew-hero.compact {
  margin-bottom: 32px;
}

.ew-hero h1,
.ew-editor-header h1 {
  margin: 0;
  font-size: clamp(2.7rem, 4vw, 4.5rem);
  line-height: 1;
  font-weight: 950;
  color: var(--ew-text);
  display: flex;
  align-items: center;
  gap: 18px;
}

.ew-hero p {
  margin: 16px 0 0;
  color: var(--ew-muted);
  font-size: 17px;
}

.ew-main-tabs {
  display: inline-flex;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.58);
  overflow: hidden;
  border-bottom: 2px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 28px;
}

.ew-main-tab {
  min-width: 190px;
  height: 62px;
  border: none;
  background: transparent;
  color: var(--ew-muted);
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 10px;
  white-space: nowrap;
  line-height: 1;
  cursor: pointer;
  font-weight: 900;
  position: relative;
}

.ew-main-tab.is-active {
  color: var(--ew-text);
}

.ew-main-tab.is-active::after {
  content: "";
  position: absolute;
  left: 32px;
  right: 32px;
  bottom: 0;
  height: 3px;
  border-radius: 999px;
  background: var(--ew-yellow);
  box-shadow: 0 0 22px rgba(255, 214, 0, 0.4);
}

.ew-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 22px;
  margin-bottom: 22px;
}

.ew-stat-card,
.ew-side-card,
.ew-empty-panel,
.ew-document-action-card,
.ew-saved-row,
.ew-add-resume-row,
.ew-preview-card,
.ew-editor-section,
.ew-role-card,
.ew-complete-banner {
  background: linear-gradient(145deg, rgba(18, 31, 55, 0.88), rgba(8, 15, 31, 0.82));
  border: 1px solid var(--ew-border);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(24px);
}

.ew-stat-card {
  min-height: 132px;
  border-radius: 18px;
  border-color: color-mix(in srgb, var(--accent) 44%, var(--ew-border));
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 22px;
}

.ew-stat-icon,
.ew-action-orb,
.ew-role-avatar,
.ew-file-icon,
.ew-linked-icon,
.ew-section-icon,
.ew-app-icon {
  background: radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--accent, #4f46e5) 90%, #fff 8%), color-mix(in srgb, var(--accent, #4f46e5) 45%, #020617));
  color: #fff;
  display: grid;
  place-items: center;
}

.ew-stat-icon {
  width: 72px;
  height: 72px;
  border-radius: 999px;
}

.ew-stat-card span,
.ew-side-card small,
.ew-saved-row span,
.ew-add-resume-row small,
.ew-document-action-card small,
.ew-muted-row {
  color: var(--ew-muted);
}

.ew-stat-card strong {
  display: block;
  font-size: 36px;
  line-height: 1;
  margin-top: 6px;
}

.ew-stat-card small {
  display: block;
  color: color-mix(in srgb, var(--accent) 72%, #fff);
  margin-top: 8px;
  font-size: 14px;
}

.ew-work-grid,
.ew-resume-grid,
.ew-builder-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 390px;
  gap: 26px;
  align-items: start;
}

.ew-work-main,
.ew-documents {
  min-width: 0;
}

.ew-filter-bar {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 16px;
  border-radius: 18px 18px 0 0;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid var(--ew-border);
  border-bottom: none;
}

.ew-filter-pill,
.ew-document-tabs button,
.ew-opportunity-toolbar button,
.ew-view-toggle {
  border-radius: 999px;
  border: 1px solid var(--ew-border);
  background: rgba(15, 23, 42, 0.72);
  color: var(--ew-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  white-space: nowrap;
  font-weight: 850;
}

.ew-filter-pill {
  height: 44px;
  padding: 0 20px;
}

.ew-filter-pill span {
  min-width: 24px;
  min-height: 24px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.07);
  color: var(--ew-muted);
}

.ew-filter-pill.is-active,
.ew-document-tabs .is-active,
.ew-opportunity-toolbar .is-active {
  color: #050816;
  background: var(--ew-yellow);
  border-color: var(--ew-yellow);
}

.ew-empty-panel {
  min-height: 520px;
  border-radius: 0 0 18px 18px;
  border-color: var(--ew-border-bright);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 44px 24px;
  background:
    radial-gradient(circle at 62% 20%, rgba(85, 64, 212, 0.38), transparent 36%),
    linear-gradient(145deg, rgba(10, 36, 67, 0.86), rgba(14, 15, 58, 0.92));
}

.ew-empty-visual {
  position: relative;
  width: 184px;
  height: 150px;
  margin-bottom: 18px;
}

.ew-folder-card {
  width: 118px;
  height: 98px;
  border-radius: 18px;
  margin: 28px auto 0;
  display: grid;
  place-items: center;
  color: var(--ew-yellow);
  background: linear-gradient(145deg, rgba(116, 97, 255, 0.95), rgba(29, 42, 98, 0.94));
  box-shadow: 18px 16px 0 rgba(76, 61, 173, 0.36), -18px -12px 0 rgba(133, 118, 255, 0.2);
}

.ew-floating-sparkle {
  position: absolute;
  color: #a78bfa;
}

.ew-floating-sparkle.one {
  left: 20px;
  top: 62px;
}

.ew-floating-sparkle.two {
  right: 14px;
  top: 20px;
}

.ew-empty-panel h2 {
  font-size: 30px;
  margin: 0 0 10px;
}

.ew-empty-panel p {
  color: var(--ew-muted);
  margin: 0 0 28px;
  font-size: 17px;
}

.ew-empty-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.ew-primary-button,
.ew-secondary-button,
.ew-purple-button,
.ew-text-link {
  min-height: 48px;
  border-radius: 10px;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 26px;
  text-decoration: none;
  cursor: pointer;
  font-weight: 950;
}

.ew-primary-button {
  min-width: 230px;
  background: var(--ew-yellow);
  color: #050816;
  box-shadow: 0 18px 36px rgba(255, 214, 0, 0.2);
}

.ew-secondary-button {
  background: rgba(15, 23, 42, 0.72);
  color: var(--ew-text);
  border-color: var(--ew-border);
}

.ew-purple-button {
  width: 100%;
  background: linear-gradient(135deg, #8b5cf6, #5b35e8);
  color: #fff;
}

.ew-primary-button.compact,
.ew-secondary-button.compact {
  min-width: 0;
  min-height: 42px;
  padding: 0 18px;
}

.ew-secondary-button.wide {
  width: 100%;
}

.ew-right-rail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ew-side-card {
  border-radius: 18px;
  padding: 22px;
}

.ew-side-card h3 {
  margin: 0 0 16px;
  font-size: 19px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.ew-progress-row {
  display: grid;
  grid-template-columns: 108px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
}

.ew-progress-ring {
  width: 96px;
  height: 96px;
  border-radius: 999px;
  background:
    radial-gradient(circle, #10182d 0 57%, transparent 58%),
    conic-gradient(#8b5cf6 0 72%, rgba(148, 163, 184, 0.16) 72% 100%);
  display: grid;
  place-items: center;
  font-size: 26px;
  font-weight: 950;
  position: relative;
}

.ew-progress-ring {
  color: var(--ew-text);
}

.ew-progress-row strong,
.ew-step-link strong {
  display: block;
  color: var(--ew-text);
  margin-bottom: 4px;
}

.ew-progress-row small,
.ew-step-link small {
  display: block;
  line-height: 1.35;
}

.ew-step-link {
  width: 100%;
  border: none;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  background: transparent;
  color: var(--ew-muted);
  min-height: 70px;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 20px;
  grid-template-rows: auto auto;
  column-gap: 12px;
  align-items: center;
  text-align: left;
  cursor: pointer;
  padding: 0;
}

.ew-step-link span:first-child {
  grid-row: 1 / span 2;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: rgba(124, 58, 237, 0.72);
  display: grid;
  place-items: center;
  color: #fff;
}

.ew-step-link svg:last-child {
  grid-row: 1 / span 2;
  grid-column: 3;
}

.ew-side-card.blue {
  border-color: rgba(14, 165, 233, 0.5);
  background: linear-gradient(145deg, rgba(10, 62, 118, 0.78), rgba(8, 19, 41, 0.88));
}

.ew-side-card.purple {
  border-color: rgba(139, 92, 246, 0.46);
}

.ew-side-card p {
  color: var(--ew-muted);
  line-height: 1.45;
}

.ew-side-card button,
.ew-text-link {
  color: #80aaff;
  background: transparent;
  border: none;
  padding: 0;
  min-height: auto;
  font-weight: 850;
}

.ew-application-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ew-application-row {
  border-radius: 18px;
  border: 1px solid var(--ew-border);
  background: rgba(12, 23, 43, 0.84);
  color: var(--ew-text);
  text-decoration: none;
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 18px;
}

.ew-app-icon,
.ew-file-icon,
.ew-linked-icon {
  --accent: #4f46e5;
  width: 46px;
  height: 46px;
  border-radius: 12px;
}

.ew-application-row strong,
.ew-saved-row strong,
.ew-document-action-card strong {
  display: block;
  color: var(--ew-text);
  font-size: 18px;
  margin-bottom: 6px;
}

.ew-application-row span,
.ew-application-row small {
  color: var(--ew-muted);
}

.ew-status-chip,
.ew-default-chip {
  border-radius: 999px;
  background: rgba(124, 58, 237, 0.42);
  color: #ddd6fe;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 900;
  text-transform: capitalize;
}

.ew-resume-grid {
  margin-top: 8px;
}

.ew-section-heading h2 {
  margin: 0 0 10px;
  font-size: 28px;
}

.ew-section-heading p {
  margin: 0 0 22px;
  color: var(--ew-muted);
  font-size: 16px;
}

.ew-document-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 22px;
}

.ew-document-tabs button {
  height: 48px;
  border-radius: 10px;
  padding: 0 20px;
}

.ew-action-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22px;
  margin-bottom: 38px;
}

.ew-document-action-card {
  min-height: 315px;
  border-radius: 18px;
  padding: 30px;
  text-align: left;
  color: var(--ew-text);
  position: relative;
  overflow: hidden;
  cursor: pointer;
}

.ew-document-action-card.upload {
  border-color: rgba(59, 130, 246, 0.45);
  background: radial-gradient(circle at 80% 52%, rgba(64, 87, 223, 0.5), transparent 34%),
    linear-gradient(145deg, rgba(17, 46, 97, 0.86), rgba(27, 22, 83, 0.85));
}

.ew-document-action-card.create {
  border-color: rgba(234, 179, 8, 0.22);
  background: radial-gradient(circle at 82% 56%, rgba(253, 186, 116, 0.24), transparent 34%),
    linear-gradient(145deg, rgba(31, 34, 73, 0.9), rgba(61, 44, 36, 0.86));
}

.ew-action-orb {
  --accent: #335dff;
  width: 70px;
  height: 70px;
  border-radius: 999px;
  margin-bottom: 30px;
}

.ew-action-orb.amber {
  --accent: #f59e0b;
}

.ew-document-action-card small {
  max-width: 310px;
  display: block;
  line-height: 1.5;
  font-size: 16px;
}

.ew-document-action-card .compact {
  margin-top: 28px;
}

.ew-card-art {
  position: absolute;
  right: 34px;
  bottom: 52px;
  width: 130px;
  height: 112px;
  border-radius: 18px;
  background: linear-gradient(145deg, rgba(158, 134, 255, 0.9), rgba(35, 45, 105, 0.88));
  box-shadow: 18px 16px 0 rgba(61, 70, 170, 0.38);
  transform: rotate(4deg);
}

.ew-card-art.profile-stack {
  background: linear-gradient(145deg, rgba(245, 158, 11, 0.35), rgba(20, 24, 46, 0.96));
  box-shadow: 18px 16px 0 rgba(73, 86, 174, 0.28);
}

.ew-saved-resumes {
  margin-top: 10px;
}

.ew-saved-row,
.ew-add-resume-row {
  min-height: 98px;
  border-radius: 16px;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto auto;
  gap: 14px;
  align-items: center;
  padding: 18px 26px;
  color: var(--ew-text);
}

.ew-file-icon {
  --accent: #7c3aed;
}

.ew-row-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.ew-row-actions button,
.ew-add-resume-row {
  border: 1px solid var(--ew-border);
  background: rgba(15, 23, 42, 0.68);
  color: var(--ew-text);
  min-height: 48px;
  border-radius: 10px;
  padding: 0 18px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 850;
}

.ew-add-resume-row {
  width: 100%;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  text-align: left;
  margin-top: 14px;
  border-style: dashed;
}

.ew-resume-preview {
  position: sticky;
  top: 26px;
}

.ew-preview-card {
  border-radius: 18px;
  padding: 28px;
}

.ew-preview-card header {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-bottom: 24px;
}

.ew-paper-preview {
  min-height: 460px;
  background: #fff;
  color: #111827;
  border-radius: 8px;
  padding: 36px 34px;
  margin-bottom: 24px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
}

.ew-paper-preview strong,
.ew-paper-preview small,
.ew-paper-preview p,
.ew-paper-preview em,
.ew-paper-preview span {
  display: block;
}

.ew-paper-preview strong {
  font-size: 18px;
}

.ew-paper-preview small {
  margin: 4px 0 12px;
}

.ew-paper-preview span {
  height: 1px;
  background: #111827;
  margin-bottom: 22px;
}

.ew-paper-preview p {
  text-transform: uppercase;
  font-weight: 900;
  font-size: 10px;
  margin: 18px 0 8px;
}

.ew-paper-preview em {
  height: 8px;
  background: #d1d5db;
  margin: 7px 0;
  width: 100%;
}

.ew-paper-preview em:nth-of-type(even) {
  width: 72%;
}

.ew-secure-note {
  color: var(--ew-muted);
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 24px 0 0;
}

.ew-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 28px;
}

.ew-editor-header h1 {
  font-size: clamp(2rem, 3vw, 3.2rem);
}

.ew-muted-row {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin-top: 12px;
}

.ew-editor-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.ew-stepper {
  border-radius: 18px;
  border: 1px solid rgba(124, 58, 237, 0.35);
  background: rgba(13, 24, 46, 0.82);
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  overflow: hidden;
  margin-bottom: 18px;
}

.ew-stepper div {
  min-height: 72px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  border-right: 1px solid rgba(148, 163, 184, 0.12);
}

.ew-stepper div:last-child {
  border-right: none;
}

.ew-stepper .is-active {
  border: 1px solid rgba(255, 214, 0, 0.5);
  background: rgba(255, 214, 0, 0.08);
}

.ew-stepper strong {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid var(--ew-border);
}

.ew-stepper .is-active strong {
  color: #050816;
  background: var(--ew-yellow);
}

.ew-stepper span {
  font-weight: 900;
}

.ew-stepper small {
  display: block;
  color: var(--ew-muted);
  font-weight: 500;
  margin-top: 3px;
}

.ew-editor-section {
  border-radius: 18px;
  padding: 20px 24px;
  margin-bottom: 14px;
}

.ew-editor-section > header {
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr) auto 20px;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.ew-section-icon {
  --accent: #335dff;
  width: 48px;
  height: 48px;
  border-radius: 999px;
}

.ew-editor-section header strong {
  display: block;
  font-size: 18px;
}

.ew-editor-section header small {
  color: var(--ew-muted);
}

.ew-editor-section header button {
  border: 1px solid var(--ew-border);
  background: rgba(15, 23, 42, 0.64);
  color: var(--ew-text);
  border-radius: 10px;
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  cursor: pointer;
  font-weight: 850;
}

.ew-editor-item {
  border: 1px solid var(--ew-border);
  background: rgba(15, 23, 42, 0.58);
  border-radius: 14px;
  min-height: 74px;
  padding: 16px 20px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.ew-editor-item span {
  color: var(--ew-muted);
}

.ew-editor-item button {
  grid-row: 1 / span 2;
  grid-column: 2;
}

.ew-tag-editor {
  border: 1px solid var(--ew-border);
  border-radius: 14px;
  padding: 14px;
  background: rgba(15, 23, 42, 0.58);
}

.ew-tag-editor div {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.ew-tag-editor span {
  min-height: 34px;
  border-radius: 10px;
  background: rgba(124, 58, 237, 0.24);
  color: var(--ew-text);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
}

.ew-tag-editor label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.ew-tag-editor input {
  flex: 1;
  min-height: 42px;
  border: 1px solid var(--ew-border);
  border-radius: 10px;
  background: rgba(2, 6, 23, 0.38);
  color: var(--ew-text);
  padding: 0 14px;
}

.ew-tag-editor label button {
  min-width: 42px;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  border: 1px solid var(--ew-yellow);
  background: rgba(255, 214, 0, 0.08);
  color: var(--ew-yellow);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.ew-save-bar {
  position: sticky;
  bottom: 0;
  z-index: 3;
  min-height: 64px;
  border-radius: 10px 10px 0 0;
  background: linear-gradient(90deg, rgba(43, 35, 89, 0.94), rgba(87, 45, 161, 0.94));
  border: 1px solid rgba(124, 58, 237, 0.4);
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 480px) minmax(0, 1fr);
  align-items: center;
  gap: 20px;
  padding: 8px 20px;
}

.ew-save-bar span {
  grid-column: 1;
  justify-self: end;
  color: var(--ew-muted);
}

.ew-save-bar button {
  grid-column: 2;
  width: 100%;
}

.ew-complete-banner {
  min-height: 100px;
  border-radius: 12px;
  border-color: rgba(255, 214, 0, 0.48);
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto 22px;
  align-items: center;
  gap: 18px;
  padding: 20px 24px;
  margin-bottom: 28px;
}

.ew-complete-banner > svg:first-child {
  color: var(--ew-yellow);
}

.ew-complete-banner strong {
  display: block;
  font-size: 18px;
  margin-bottom: 6px;
}

.ew-complete-banner small {
  color: var(--ew-muted);
}

.ew-complete-banner button {
  min-height: 48px;
  border: none;
  border-radius: 10px;
  background: var(--ew-yellow);
  color: #050816;
  padding: 0 24px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 950;
  cursor: pointer;
}

.ew-opportunity-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 28px;
}

.ew-opportunity-toolbar button,
.ew-view-toggle {
  min-height: 46px;
  padding: 0 18px;
  border-radius: 12px;
}

.ew-view-toggle {
  margin-left: auto;
}

.ew-role-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ew-role-card {
  --accent: #4f46e5;
  min-height: 210px;
  border-radius: 16px;
  border-color: color-mix(in srgb, var(--accent) 44%, var(--ew-border));
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr) 170px 190px;
  gap: 22px;
  align-items: center;
  padding: 28px;
}

.ew-role-avatar {
  width: 86px;
  height: 86px;
  border-radius: 999px;
  position: relative;
}

.ew-role-avatar span {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #22c55e;
  border: 3px solid #0c172b;
}

.ew-role-main h2 {
  margin: 0 0 8px;
  font-size: 24px;
}

.ew-role-main p {
  margin: 0 0 12px;
  color: var(--ew-muted);
}

.ew-role-meta,
.ew-role-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.ew-role-meta span,
.ew-role-tags span {
  border: 1px solid var(--ew-border);
  border-radius: 999px;
  padding: 6px 12px;
  color: var(--ew-muted);
}

.ew-role-tags span {
  color: #bfdbfe;
  background: rgba(59, 130, 246, 0.12);
}

.ew-role-main small {
  color: var(--ew-muted);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ew-role-main small svg {
  color: var(--ew-yellow);
}

.ew-match-score {
  min-height: 150px;
  border-left: 1px solid rgba(148, 163, 184, 0.16);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.ew-match-score strong {
  width: 92px;
  height: 92px;
  border-radius: 999px;
  background: conic-gradient(var(--accent) 0 86%, rgba(148, 163, 184, 0.16) 86% 100%);
  display: grid;
  place-items: center;
  font-size: 27px;
}

.ew-match-score span {
  color: #34d399;
  font-weight: 900;
}

.ew-match-score button {
  border: none;
  background: transparent;
  color: var(--ew-muted);
}

.ew-role-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ew-demand-row,
.ew-check-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ew-demand-row strong,
.ew-check-row svg {
  color: #34d399;
}

.ew-check-row {
  justify-content: flex-start;
}

.ew-shortcuts kbd {
  border: 1px solid var(--ew-border);
  border-radius: 6px;
  padding: 5px 10px;
  margin-right: 18px;
  background: rgba(15, 23, 42, 0.7);
  color: var(--ew-text);
}

:where(.light, [data-theme='light']) .employee-workspace-page {
  --ew-bg: #f7f8fc;
  --ew-panel: rgba(255, 255, 255, 0.78);
  --ew-panel-strong: rgba(255, 255, 255, 0.92);
  --ew-border: rgba(17, 24, 39, 0.1);
  --ew-border-bright: rgba(59, 130, 246, 0.2);
  --ew-text: #111827;
  --ew-muted: #4b5563;
  --ew-soft: #6b7280;
  background:
    radial-gradient(circle at 18% 16%, rgba(56, 189, 248, 0.1), transparent 28%),
    radial-gradient(circle at 82% 18%, rgba(255, 214, 0, 0.12), transparent 30%),
    radial-gradient(circle at 74% 78%, rgba(236, 72, 153, 0.08), transparent 30%),
    var(--sb-color-background);
}

:where(.light, [data-theme='light']) .employee-workspace-page .ew-main-tabs,
:where(.light, [data-theme='light']) .employee-workspace-page .ew-filter-bar,
:where(.light, [data-theme='light']) .employee-workspace-page .ew-filter-pill,
:where(.light, [data-theme='light']) .employee-workspace-page .ew-document-tabs button,
:where(.light, [data-theme='light']) .employee-workspace-page .ew-opportunity-toolbar button,
:where(.light, [data-theme='light']) .employee-workspace-page .ew-view-toggle,
:where(.light, [data-theme='light']) .employee-workspace-page .ew-icon-button,
:where(.light, [data-theme='light']) .employee-workspace-page .ew-donate,
:where(.light, [data-theme='light']) .employee-workspace-page .ew-profile-button {
  background: rgba(255, 255, 255, 0.76);
  border-color: var(--ew-border);
  color: var(--ew-text);
  box-shadow: 0 10px 24px rgba(17, 24, 39, 0.06);
}

:where(.light, [data-theme='light']) .employee-workspace-page .ew-main-tabs {
  border-bottom-color: rgba(17, 24, 39, 0.08);
}

:where(.light, [data-theme='light']) .employee-workspace-page .ew-stat-card,
:where(.light, [data-theme='light']) .employee-workspace-page .ew-side-card,
:where(.light, [data-theme='light']) .employee-workspace-page .ew-empty-panel,
:where(.light, [data-theme='light']) .employee-workspace-page .ew-document-action-card,
:where(.light, [data-theme='light']) .employee-workspace-page .ew-saved-row,
:where(.light, [data-theme='light']) .employee-workspace-page .ew-add-resume-row,
:where(.light, [data-theme='light']) .employee-workspace-page .ew-preview-card,
:where(.light, [data-theme='light']) .employee-workspace-page .ew-editor-section,
:where(.light, [data-theme='light']) .employee-workspace-page .ew-role-card,
:where(.light, [data-theme='light']) .employee-workspace-page .ew-complete-banner {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.9));
  box-shadow: 0 16px 40px rgba(17, 24, 39, 0.08);
}

:where(.light, [data-theme='light']) .employee-workspace-page .ew-empty-panel {
  background:
    radial-gradient(circle at 68% 18%, rgba(139, 92, 246, 0.12), transparent 34%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(245, 248, 255, 0.92));
}

:where(.light, [data-theme='light']) .employee-workspace-page .ew-folder-card {
  color: #111827;
  background: linear-gradient(145deg, rgba(255, 214, 0, 0.96), rgba(59, 130, 246, 0.22));
  box-shadow: 18px 16px 0 rgba(59, 130, 246, 0.12), -18px -12px 0 rgba(255, 214, 0, 0.16);
}

:where(.light, [data-theme='light']) .employee-workspace-page .ew-application-row {
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid var(--ew-border);
}

:where(.light, [data-theme='light']) .employee-workspace-page .ew-role-avatar span {
  border-color: #fff;
}

:where(.light, [data-theme='light']) .employee-workspace-page .ew-role-tags span {
  color: #1d4ed8;
  background: rgba(59, 130, 246, 0.1);
}

:where(.light, [data-theme='light']) .employee-workspace-page .ew-stat-card small,
:where(.light, [data-theme='light']) .employee-workspace-page .ew-text-link {
  color: color-mix(in srgb, var(--accent, #2563eb) 62%, #111827);
}

:where(.light, [data-theme='light']) .employee-workspace-page .ew-shortcuts kbd {
  background: rgba(255, 255, 255, 0.82);
}

@media (max-width: 1180px) {
  .employee-workspace-page {
    grid-template-columns: 1fr;
  }

  .ew-sidebar {
    display: none;
  }

  .ew-topbar {
    padding-left: 24px;
  }

  .ew-content,
  .ew-editor-content {
    padding-left: 24px;
    padding-right: 24px;
  }

  .ew-stats-grid,
  .ew-action-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ew-work-grid,
  .ew-resume-grid,
  .ew-builder-grid {
    grid-template-columns: 1fr;
  }

  .ew-resume-preview {
    position: static;
  }
}

@media (max-width: 1079px) {
  .ew-filter-bar {
    flex-wrap: wrap;
    overflow-x: visible;
  }

  .ew-filter-pill {
    flex: 1 1 150px;
    justify-content: center;
  }
}

@media (max-width: 760px) {
  .ew-topbar {
    height: auto;
    padding: 16px;
  }

  .ew-top-actions {
    width: 100%;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .ew-content,
  .ew-editor-content {
    padding: 16px 16px 56px;
  }

  .ew-hero h1,
  .ew-editor-header h1 {
    font-size: 2.3rem;
  }

  .ew-stats-grid,
  .ew-action-card-grid,
  .ew-stepper {
    grid-template-columns: 1fr;
  }

  .ew-main-tabs {
    width: 100%;
  }

  .ew-main-tab {
    min-width: 0;
    flex: 1;
  }

  .ew-filter-pill {
    flex-basis: calc(50% - 10px);
    padding: 0 14px;
  }

  .ew-stat-card,
  .ew-application-row,
  .ew-saved-row,
  .ew-add-resume-row,
  .ew-role-card,
  .ew-complete-banner,
  .ew-editor-header {
    grid-template-columns: 1fr;
  }

  .ew-role-card,
  .ew-complete-banner,
  .ew-editor-header {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .ew-row-actions,
  .ew-editor-actions,
  .ew-opportunity-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .ew-save-bar {
    position: static;
    grid-template-columns: 1fr;
  }

  .ew-save-bar span,
  .ew-save-bar button {
    grid-column: auto;
    justify-self: stretch;
  }
}
`;

import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  BookmarkCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  GraduationCap,
  Heart,
  MessageCircle,
  Search,
  Star,
  UserRound,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { sbFetch } from '../shared/sbFetch';
import {
  filterVisibleAcademyCourses,
  filterVisibleAcademyPrograms,
  getAcademyProgramCourseDisplayTitle,
  getLearningPathCourseMap,
} from './academyLearningPaths';
import { getCourseCardArt } from './academyCardArt';
import { useAcademyLearningPaths } from './useAcademyLearningPaths';
import { useAcademySavedItems } from './useAcademySavedItems';
import { useAcademyUserId } from './useAcademyUserId';
import AcademyNavigationChrome, { ACADEMY_DESKTOP_CONTENT_LEFT } from './AcademyNavigationChrome';
import { useResponsive } from '../hooks/useResponsive';

type Course = {
  id: string;
  title: string;
  description?: string | null;
  level?: string | null;
  duration?: string | null;
  category?: string | null;
  instructor_name?: string | null;
  instructor?: string | null;
  instructor_id?: string | null;
  state?: 'draft' | 'published' | 'archived';
  module_count?: number;
  lesson_count?: number;
  image_url?: string | null;
  thumbnail_url?: string | null;
};

type Enrollment = {
  course_id: string;
  status: 'active' | 'completed' | 'dropped';
  progress_percent: number;
};

function normalizeList<T>(data: unknown, keys: string | string[]): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  }

  const candidateKeys = Array.isArray(keys) ? keys : [keys];

  if (data && typeof data === 'object') {
    for (const key of candidateKeys) {
      if (Array.isArray((data as Record<string, unknown>)[key])) {
        return (data as Record<string, T[]>)[key];
      }
    }
  }

  return [];
}

const studentWorkspaceSamples = {
  stats: [
    {
      label: 'Assignments',
      value: 6,
      detail: '3 graded · 2 submitted · 1 open',
      icon: ClipboardList,
      tone: '#FFD600',
    },
    {
      label: 'Quizzes & Tests',
      value: 4,
      detail: '2 complete · 1 due tomorrow · 1 practice',
      icon: CheckCircle2,
      tone: '#22C55E',
    },
    {
      label: 'Current Grade',
      value: '88%',
      detail: 'B+ average across sample coursework',
      icon: Star,
      tone: '#FFD600',
    },
    {
      label: 'Feedback',
      value: 5,
      detail: 'Instructor notes ready to review',
      icon: MessageCircle,
      tone: '#38BDF8',
    },
  ],
  coursework: [
    {
      type: 'Quiz',
      title: 'Know Your Rights Checkpoint Quiz',
      course: 'Know Your Rights',
      status: 'Due tomorrow',
      grade: 'Not started',
    },
    {
      type: 'Assignment',
      title: 'Rights Scenario Reflection',
      course: 'Know Your Rights',
      status: 'Graded',
      grade: '86 / 100 · B+',
    },
    {
      type: 'Test',
      title: 'Media Literacy Mini Test',
      course: 'Digital Literacy Basics',
      status: 'Graded',
      grade: '27 / 30 · A',
    },
    {
      type: 'Assignment',
      title: 'Community Resource Map',
      course: 'Communication Essentials',
      status: 'Submitted',
      grade: 'Waiting for review',
    },
  ],
  grades: [
    {
      course: 'Know Your Rights',
      assignments: '2 / 3 submitted',
      quizAverage: '90%',
      currentGrade: 'B+',
      progress: 88,
    },
    {
      course: 'Communication Essentials',
      assignments: '1 / 2 submitted',
      quizAverage: '84%',
      currentGrade: 'B',
      progress: 82,
    },
    {
      course: 'Digital Literacy Basics',
      assignments: '3 / 3 submitted',
      quizAverage: '93%',
      currentGrade: 'A-',
      progress: 91,
    },
  ],
};

export default function AcademyMyCoursesPage() {
  const userId = useAcademyUserId();
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const basePath = location.pathname.startsWith('/learning') ? '/learning' : '/academy';
  const isStudentWorkspaceRoute = true;
  const isSavedRoute = location.pathname.endsWith('/saved');
  const activeCourseTab =
    isSavedRoute || new URLSearchParams(location.search).get('tab') === 'saved'
      ? 'saved'
      : 'courses';
  const workspaceRoute = `${basePath}/student-workspace`;
  const workspaceTitle = 'Student Workspace';
  const { paths: learningPaths } = useAcademyLearningPaths();
  const { savedCourses, isCourseSaved, toggleCourseSaved } = useAcademySavedItems();
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const colors = useMemo(
    () => ({
      bg: 'var(--sb-color-background)',
      cardBg: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.35)',
      cardBgStrong: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.58)',
      border: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.6)',
      text: isDark ? '#fff' : '#111',
      textSecondary: isDark ? 'rgba(255, 255, 255, 0.72)' : '#4b5563',
      textMuted: isDark ? 'rgba(255, 255, 255, 0.5)' : '#6b7280',
      accent: '#FFD600',
      accentText: isDark ? '#FFD600' : '#111827',
      purple: '#8B5CF6',
      green: '#22C55E',
      blue: '#38BDF8',
      shadow: isDark ? '0 18px 55px rgba(0, 0, 0, 0.28)' : '0 16px 36px rgba(31, 38, 135, 0.14)',
    }),
    [isDark],
  );

  const visibleLearningPaths = useMemo(
    () => filterVisibleAcademyPrograms(learningPaths),
    [learningPaths],
  );
  const visibleCourses = useMemo(
    () => filterVisibleAcademyCourses(courses, visibleLearningPaths),
    [courses, visibleLearningPaths],
  );
  const coursePathMap = useMemo(
    () => getLearningPathCourseMap(visibleCourses, visibleLearningPaths),
    [visibleCourses, visibleLearningPaths],
  );

  useEffect(() => {
    async function load() {
      try {
        const [coursesResp, enrollmentsResp] = await Promise.all([
          sbFetch('/api/academy/courses'),
          sbFetch(`/api/academy/enrollments?user_id=${encodeURIComponent(userId)}`),
        ]);

        if (coursesResp.ok) {
          const data = await coursesResp.json();
          setCourses(normalizeList<Course>(data, 'courses'));
        }

        if (enrollmentsResp.ok) {
          const data = await enrollmentsResp.json();
          setEnrollments(normalizeList<Enrollment>(data, ['enrollments', 'courses', 'data']));
        }
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [userId]);

  const activeEnrollments = useMemo(
    () => enrollments.filter((enrollment) => enrollment.status !== 'dropped'),
    [enrollments],
  );
  const enrollmentByCourseId = useMemo(() => {
    return new Map(activeEnrollments.map((enrollment) => [enrollment.course_id, enrollment]));
  }, [activeEnrollments]);
  const attendingCourses = useMemo(() => {
    return visibleCourses.filter((course) => enrollmentByCourseId.has(course.id));
  }, [enrollmentByCourseId, visibleCourses]);
  const savedCourseCards = useMemo(() => {
    return visibleCourses.filter(
      (course) =>
        (!course.state || course.state === 'published') && savedCourses.includes(course.id),
    );
  }, [savedCourses, visibleCourses]);
  const filteredSections = useMemo(() => {
    const value = searchQuery.trim().toLowerCase();
    const matches = (course: Course) =>
      !value ||
      `${course.title} ${course.description ?? ''} ${course.category ?? ''} ${course.instructor_name ?? ''}`
        .toLowerCase()
        .includes(value);

    return {
      attending: attendingCourses.filter(matches),
      saved: savedCourseCards.filter(matches),
    };
  }, [attendingCourses, savedCourseCards, searchQuery]);

  const completedCount = activeEnrollments.filter(
    (enrollment) => enrollment.status === 'completed',
  ).length;
  const inProgressCount = activeEnrollments.filter(
    (enrollment) => enrollment.status === 'active',
  ).length;
  const courseOverviewStats = isStudentWorkspaceRoute
    ? [
        {
          icon: BookOpen,
          label: 'Enrolled',
          value: activeEnrollments.length,
          color: colors.accent,
        },
        {
          icon: BookmarkCheck,
          label: 'Saved',
          value: savedCourseCards.length,
          color: colors.accent,
        },
      ]
    : activeCourseTab === 'saved'
      ? [
          {
            icon: BookmarkCheck,
            label: 'Saved',
            value: savedCourseCards.length,
            color: colors.accent,
          },
        ]
      : [
          {
            icon: BookOpen,
            label: 'Enrolled',
            value: activeEnrollments.length,
            color: colors.accent,
          },
        ];

  const visibleCourseSection =
    activeCourseTab === 'saved' ? filteredSections.saved : filteredSections.attending;
  const progressStats = [
    {
      icon: GraduationCap,
      label: 'In Progress',
      value: inProgressCount,
      text: 'Courses you can continue now.',
      color: colors.purple,
    },
    {
      icon: UserRound,
      label: 'Completed',
      value: completedCount,
      text: 'Courses finished or credential-ready.',
      color: colors.green,
    },
    ...(isStudentWorkspaceRoute
      ? [
          {
            icon: Heart,
            label: 'Saved for Later',
            value: savedCourseCards.length,
            text: 'Courses you marked to revisit.',
            color: colors.accent,
          },
          {
            icon: Award,
            label: 'Certificates Earned',
            value: completedCount,
            text: 'Milestones and achievements.',
            color: colors.blue,
          },
        ]
      : []),
  ];

  const tabStyle = (active: boolean) => ({
    padding: '0 0 10px',
    borderRadius: 0,
    fontSize: 14,
    fontWeight: 600 as const,
    background: 'transparent',
    color: active ? colors.text : colors.textSecondary,
    borderBottom: active ? `3px solid ${colors.accent}` : '3px solid transparent',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    cursor: 'pointer',
  });

  const handleCourseTabChange = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigate(href);
    setSearchQuery('');
  };

  const inputStyle: CSSProperties = {
    width: '100%',
    background: isDark ? 'rgba(8, 13, 24, 0.62)' : 'rgba(255,255,255,0.62)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.12)'}`,
    borderRadius: 18,
    color: colors.text,
    padding: '13px 16px 13px 44px',
    fontSize: 14,
    outline: 'none',
    boxShadow: isDark
      ? 'inset 0 1px 0 rgba(255,255,255,0.08)'
      : 'inset 0 1px 0 rgba(255,255,255,0.7)',
  };

  const renderCourseCard = (course: Course, mode: 'attending' | 'saved') => {
    const visual = getCourseCardArt(course);
    const displayTitle = getAcademyProgramCourseDisplayTitle(course.title);
    const enrollment = enrollmentByCourseId.get(course.id);
    const linkedPaths = coursePathMap.get(course.id) ?? [];
    const actionHref = enrollment
      ? `${basePath}/courses/${course.id}`
      : `${basePath}/courses/${course.id}/enroll`;

    return (
      <article
        key={`${mode}-${course.id}`}
        className="group overflow-hidden rounded-[26px] border transition-transform duration-300 hover:-translate-y-1"
        style={{
          borderColor: colors.border,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.075), rgba(255,255,255,0.035))',
          boxShadow: colors.shadow,
        }}
      >
        <div className="grid gap-0 md:grid-cols-[220px,1fr]">
          <div className="relative min-h-[190px] overflow-hidden">
            <img
              src={visual.src}
              alt={displayTitle}
              className="h-full min-h-[190px] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              onError={(event) => {
                if (event.currentTarget.dataset.fallbackApplied === 'true') {
                  return;
                }
                event.currentTarget.dataset.fallbackApplied = 'true';
                event.currentTarget.src = visual.fallbackSrc;
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
            <span
              className="absolute left-4 top-4 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ background: 'rgba(15,23,42,0.65)', color: visual.accent }}
            >
              {visual.eyebrow}
            </span>
          </div>

          <div className="flex min-h-[190px] flex-col p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex flex-wrap gap-2">
                  {linkedPaths.slice(0, 2).map((path) => (
                    <span
                      key={path.slug}
                      className="rounded-full px-3 py-1 text-[11px] font-semibold"
                      style={{ background: `${path.color}18`, color: path.color }}
                    >
                      {path.title}
                    </span>
                  ))}
                  {enrollment && (
                    <span
                      className="rounded-full px-3 py-1 text-[11px] font-semibold"
                      style={{
                        background:
                          enrollment.status === 'completed'
                            ? 'rgba(19,185,129,0.12)'
                            : 'rgba(109,76,255,0.12)',
                        color: enrollment.status === 'completed' ? colors.green : colors.purple,
                      }}
                    >
                      {enrollment.status === 'completed' ? 'Completed' : 'In Progress'}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-semibold">
                  <a
                    href={`${basePath}/courses/${course.id}`}
                    className="transition-colors hover:!text-[#FFD600]"
                    style={{ color: colors.text }}
                  >
                    {displayTitle}
                  </a>
                </h2>
              </div>

              <button
                onClick={() => toggleCourseSaved(course.id)}
                className="rounded-full p-2"
                style={{ background: 'rgba(255,214,0,0.12)', border: `1px solid ${colors.border}` }}
                aria-label={isCourseSaved(course.id) ? 'Remove saved course' : 'Save course'}
              >
                <Heart
                  className="h-4 w-4"
                  style={{
                    color: colors.accent,
                    fill: isCourseSaved(course.id) ? colors.accent : 'transparent',
                  }}
                />
              </button>
            </div>

            <p className="mt-3 line-clamp-2 text-sm" style={{ color: colors.textSecondary }}>
              {course.description ||
                'Open this course to view the overview, requirements, and learning materials.'}
            </p>

            <div className="mt-4 flex flex-wrap gap-3 text-xs" style={{ color: colors.textMuted }}>
              <span>
                {course.level
                  ? course.level.charAt(0).toUpperCase() + course.level.slice(1)
                  : 'Beginner'}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {course.duration || 'Self-paced'}
              </span>
              <span>{course.module_count || course.lesson_count || 0} lessons</span>
              {(course.instructor_name || course.instructor) && (
                <span>{course.instructor_name || course.instructor}</span>
              )}
            </div>

            {enrollment && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span style={{ color: colors.textSecondary }}>Progress</span>
                  <span style={{ color: colors.accent }}>{enrollment.progress_percent}%</span>
                </div>
                <div
                  className="h-2 w-full rounded-full"
                  style={{ background: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.1)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${enrollment.progress_percent}%`,
                      background: 'linear-gradient(90deg, #FFD600, #FFF1A6)',
                    }}
                  />
                </div>
              </div>
            )}

            <div className="mt-auto flex flex-wrap gap-3 pt-5">
              <a
                href={`${basePath}/courses/${course.id}`}
                className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                style={{
                  background: colors.cardBg,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                }}
              >
                View course
              </a>
              <a
                href={actionHref}
                className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                style={{
                  background: colors.accent,
                  color: '#000',
                  boxShadow: '0 10px 24px rgba(255,214,0,0.18)',
                }}
              >
                {enrollment ? 'Continue' : 'Enroll'}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </article>
    );
  };

  const renderEmptyState = (title: string, description: string, href: string, label: string) => (
    <div
      className="rounded-[24px] border p-6 text-center"
      style={{ borderColor: colors.border, background: colors.cardBg, color: colors.textSecondary }}
    >
      <p className="text-base font-semibold" style={{ color: colors.text }}>
        {title}
      </p>
      <p className="mx-auto mt-2 max-w-xl text-sm">{description}</p>
      <a
        href={href}
        className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
        style={{
          background: colors.accent,
          color: '#000',
          border: '1px solid rgba(255,214,0,0.9)',
          boxShadow: '0 10px 24px rgba(255,214,0,0.18)',
        }}
      >
        {label}
        <ArrowRight className="h-4 w-4" />
      </a>
    </div>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 78% 10%, rgba(255,214,0,0.08), transparent 30%), radial-gradient(circle at 14% 18%, rgba(56,189,248,0.10), transparent 28%), var(--sb-color-background)',
        padding: `88px 24px 48px ${ACADEMY_DESKTOP_CONTENT_LEFT}px`,
      }}
    >
      <AcademyNavigationChrome />
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div
          className="mb-8 overflow-hidden rounded-[28px] border p-6 md:p-8"
          style={{
            borderColor: colors.border,
            background: isDark
              ? 'linear-gradient(135deg, rgba(2,8,15,0.98), rgba(11,23,32,0.94) 52%, rgba(255,214,0,0.09))'
              : 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(245,248,255,0.98) 46%, rgba(255,249,224,0.94) 100%)',
            boxShadow: isDark
              ? '0 24px 70px rgba(0,0,0,0.32), 0 0 42px rgba(255,214,0,0.08)'
              : '0 18px 46px rgba(31,41,55,0.10), 0 0 32px rgba(255,214,0,0.12)',
          }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div
                className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ background: 'rgba(255,214,0,0.16)', color: colors.accentText }}
              >
                <BookmarkCheck className="h-3.5 w-3.5" />
                {isStudentWorkspaceRoute ? 'Street Voices Academy' : 'Course workspace'}
              </div>
              <h1 className="text-3xl font-bold md:text-4xl" style={{ color: colors.text }}>
                {workspaceTitle}
              </h1>
              <p
                className="mt-3 max-w-2xl text-sm md:text-base"
                style={{ color: colors.textSecondary }}
              >
                {isStudentWorkspaceRoute
                  ? 'Manage your enrolled courses, saved courses, progress, assignments, quizzes, and certificates in one place.'
                  : 'See the courses you are enrolled in and continue your learning.'}
              </p>
              <div
                className="mt-5 inline-flex flex-wrap items-center gap-6 border-b"
                style={{ borderColor: colors.border }}
              >
                <a
                  href={workspaceRoute}
                  onMouseDown={handleCourseTabChange(workspaceRoute)}
                  onClick={handleCourseTabChange(workspaceRoute)}
                  style={tabStyle(activeCourseTab === 'courses')}
                >
                  My Learning
                </a>
                <a
                  href={`${workspaceRoute}?tab=saved`}
                  onMouseDown={handleCourseTabChange(`${workspaceRoute}?tab=saved`)}
                  onClick={handleCourseTabChange(`${workspaceRoute}?tab=saved`)}
                  style={tabStyle(activeCourseTab === 'saved')}
                >
                  Saved
                </a>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href={basePath}
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
                style={{
                  background: colors.accent,
                  color: '#000',
                  border: '1px solid rgba(255,214,0,0.9)',
                  boxShadow: '0 12px 30px rgba(255,214,0,0.24)',
                }}
              >
                Back to Academy
                <ArrowLeft className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <section
          className="grid gap-4 rounded-[24px] border p-4 md:grid-cols-[1fr,240px]"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.10)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.035))',
            boxShadow: isDark
              ? '0 18px 48px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.06)'
              : colors.shadow,
            backdropFilter: 'blur(18px) saturate(140%)',
            WebkitBackdropFilter: 'blur(18px) saturate(140%)',
          }}
        >
          <div className="relative flex items-center">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: colors.textMuted }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={
                isMobile
                  ? 'Search courses'
                  : activeCourseTab === 'saved'
                    ? 'Search your saved courses'
                    : isStudentWorkspaceRoute
                      ? 'Search your saved and enrolled courses'
                      : 'Search your enrolled courses'
              }
              style={inputStyle}
            />
          </div>
          <div
            className={`grid gap-2 text-center text-xs ${
              isStudentWorkspaceRoute ? 'grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {courseOverviewStats.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border px-3 py-3"
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)',
                  background: isDark ? 'rgba(8,13,24,0.52)' : 'rgba(255,255,255,0.55)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                }}
              >
                <item.icon className="mx-auto mb-1 h-4 w-4" style={{ color: item.color }} />
                <div className="text-lg font-bold" style={{ color: colors.text }}>
                  {item.value}
                </div>
                <div style={{ color: colors.textMuted }}>{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section
          className={`mt-8 grid gap-5 ${
            isStudentWorkspaceRoute ? 'md:grid-cols-4' : 'md:grid-cols-2'
          }`}
        >
          {progressStats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-[26px] border p-5"
              style={{
                borderColor: colors.border,
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.075), rgba(255,255,255,0.035))',
                boxShadow: colors.shadow,
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: `${stat.color}1f` }}
                >
                  <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
                </div>
                <div>
                  <div className="text-3xl font-bold" style={{ color: colors.text }}>
                    {stat.value}
                  </div>
                  <p className="text-sm font-semibold" style={{ color: colors.text }}>
                    {stat.label}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                {stat.text}
              </p>
            </div>
          ))}
        </section>

        {isStudentWorkspaceRoute && (
          <section
            className="mt-8 rounded-[28px] border p-5 md:p-6"
            style={{
              borderColor: colors.border,
              background:
                'linear-gradient(90deg, rgba(84,109,132,0.20), rgba(83,87,126,0.16), rgba(255,214,0,0.06))',
              boxShadow: colors.shadow,
              backdropFilter: 'blur(24px) saturate(150%)',
              WebkitBackdropFilter: 'blur(24px) saturate(150%)',
            }}
          >
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-[0.18em]"
                  style={{ color: colors.accent }}
                >
                  Learning Progress
                </p>
                <h2 className="mt-2 text-2xl font-semibold" style={{ color: colors.text }}>
                  Assignments, quizzes, tests, and grades
                </h2>
                <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                  Track what is due, what you submitted, and the grades you have earned.
                </p>
              </div>
              <a
                href={`${basePath}/dashboard#academy-course-assignments`}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                style={{
                  border: '1px solid rgba(255,214,0,0.9)',
                  background: colors.accent,
                  color: '#000',
                  boxShadow: '0 10px 24px rgba(255,214,0,0.18)',
                }}
              >
                Open learning activity
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              {studentWorkspaceSamples.stats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[20px] border p-4"
                  style={{ borderColor: colors.border, background: 'rgba(255,255,255,0.055)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `${item.tone}20`, color: item.tone }}
                    >
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold" style={{ color: colors.text }}>
                        {item.value}
                      </div>
                      <p className="text-sm font-semibold" style={{ color: colors.text }}>
                        {item.label}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-5" style={{ color: colors.textSecondary }}>
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr,0.85fr]">
              <div
                className="overflow-hidden rounded-[22px] border"
                style={{ borderColor: colors.border }}
              >
                {studentWorkspaceSamples.coursework.map((item, index) => (
                  <div
                    key={`${item.type}-${item.title}`}
                    className="grid gap-3 px-4 py-4 md:grid-cols-[120px,1fr,150px,150px]"
                    style={{
                      background: index % 2 === 0 ? colors.cardBg : colors.cardBgStrong,
                      borderTop: index === 0 ? undefined : `1px solid ${colors.border}`,
                    }}
                  >
                    <span
                      className="text-xs font-semibold uppercase tracking-[0.16em]"
                      style={{ color: colors.accent }}
                    >
                      {item.type}
                    </span>
                    <div>
                      <p className="font-semibold" style={{ color: colors.text }}>
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                        {item.course}
                      </p>
                    </div>
                    <span className="text-sm" style={{ color: colors.textSecondary }}>
                      {item.status}
                    </span>
                    <span className="text-sm font-semibold" style={{ color: colors.text }}>
                      {item.grade}
                    </span>
                  </div>
                ))}
              </div>

              <div
                className="rounded-[22px] border p-4"
                style={{ borderColor: colors.border, background: 'rgba(2,8,15,0.56)' }}
              >
                <h3 className="text-lg font-semibold" style={{ color: colors.text }}>
                  Gradebook snapshot
                </h3>
                <div className="mt-4 space-y-3">
                  {studentWorkspaceSamples.grades.map((item) => (
                    <div
                      key={item.course}
                      className="rounded-2xl border p-3"
                      style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold" style={{ color: colors.text }}>
                          {item.course}
                        </p>
                        <span className="text-sm font-bold" style={{ color: colors.green }}>
                          {item.currentGrade}
                        </span>
                      </div>
                      <div
                        className="mt-3 h-2 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.1)' }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${item.progress}%`,
                            background: 'linear-gradient(90deg, #FFD600, #FFF1A6)',
                          }}
                        />
                      </div>
                      <p className="mt-2 text-xs" style={{ color: colors.textSecondary }}>
                        {item.assignments} · Quiz average {item.quizAverage}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mt-8 space-y-8">
          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                  {activeCourseTab === 'saved' ? 'Saved Courses' : 'Enrolled Courses'}
                </h2>
                <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                  {activeCourseTab === 'saved'
                    ? 'Courses you saved so you can come back to them.'
                    : 'Courses you are enrolled in or currently completing.'}
                </p>
              </div>
              <span className="text-sm" style={{ color: colors.textMuted }}>
                {isLoading
                  ? 'Loading...'
                  : activeCourseTab === 'saved'
                    ? `${filteredSections.saved.length} saved`
                    : `${filteredSections.attending.length} courses`}
              </span>
            </div>
            <div className="grid gap-5">
              {visibleCourseSection.map((course) =>
                renderCourseCard(course, activeCourseTab === 'saved' ? 'saved' : 'attending'),
              )}
              {!isLoading &&
                visibleCourseSection.length === 0 &&
                (activeCourseTab === 'saved'
                  ? renderEmptyState(
                      'No saved courses yet.',
                      'Use the heart on a course card to keep it in your personal course list.',
                      `${basePath}/courses`,
                      'Find courses to save',
                    )
                  : renderEmptyState(
                      'No attending courses yet.',
                      'Browse the course catalog and enroll when you find a course that fits your next step.',
                      `${basePath}/courses`,
                      'Browse courses',
                    ))}
            </div>
          </div>

          {isStudentWorkspaceRoute && activeCourseTab !== 'saved' && (
            <div>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                    Saved Courses
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                    Courses you saved so you can come back to them.
                  </p>
                </div>
                <span className="text-sm" style={{ color: colors.textMuted }}>
                  {isLoading ? 'Loading...' : `${filteredSections.saved.length} saved`}
                </span>
              </div>
              <div className="grid gap-5">
                {filteredSections.saved.map((course) => renderCourseCard(course, 'saved'))}
                {!isLoading &&
                  filteredSections.saved.length === 0 &&
                  renderEmptyState(
                    'No saved courses yet.',
                    'Use the heart on a course card to keep it in your personal course list.',
                    basePath,
                    'Back to Academy',
                  )}
              </div>
            </div>
          )}

          {isStudentWorkspaceRoute && (
            <div
              className="overflow-hidden rounded-[24px] border px-5 py-5"
              style={{
                borderColor: 'rgba(255,214,0,0.28)',
                background:
                  'linear-gradient(90deg, rgba(255,214,0,0.18), rgba(255,214,0,0.08), rgba(2,8,15,0.38))',
                boxShadow: colors.shadow,
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ background: 'rgba(255,214,0,0.14)', color: colors.accent }}
                  >
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: colors.text }}>
                      Learn. Grow. Lead.
                    </p>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      Stay consistent, complete your courses, and build skills that open doors.
                    </p>
                  </div>
                </div>
                <a
                  href={basePath}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                  style={{
                    background: colors.accent,
                    color: '#000',
                    border: '1px solid rgba(255,214,0,0.9)',
                  }}
                >
                  Back to Academy
                  <ArrowLeft className="h-4 w-4" />
                </a>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

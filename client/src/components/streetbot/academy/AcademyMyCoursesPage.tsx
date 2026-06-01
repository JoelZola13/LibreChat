import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookmarkCheck,
  BriefcaseBusiness,
  Clock,
  GraduationCap,
  Heart,
  Search,
  UserRound,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { sbFetch } from '../shared/sbFetch';
import {
  filterVisibleAcademyCourses,
  filterVisibleAcademyPrograms,
  getLearningPathCourseMap,
} from './academyLearningPaths';
import { getCourseCardArt } from './academyCardArt';
import { useAcademyLearningPaths } from './useAcademyLearningPaths';
import { useAcademySavedItems } from './useAcademySavedItems';
import { useAcademyUserId } from './useAcademyUserId';

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
    { label: 'Assignments', value: 6, detail: '3 graded · 2 submitted · 1 open' },
    { label: 'Quizzes & Tests', value: 4, detail: '2 complete · 1 due tomorrow · 1 practice' },
    { label: 'Current Grade', value: '88%', detail: 'B+ average across sample coursework' },
    { label: 'Feedback', value: 5, detail: 'Instructor notes ready to review' },
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
    { course: 'Know Your Rights', assignments: '2 / 3 submitted', quizAverage: '90%', currentGrade: 'B+' },
    { course: 'Communication Essentials', assignments: '1 / 2 submitted', quizAverage: '84%', currentGrade: 'B' },
    { course: 'Digital Literacy Basics', assignments: '3 / 3 submitted', quizAverage: '93%', currentGrade: 'A-' },
  ],
};

export default function AcademyMyCoursesPage() {
  const userId = useAcademyUserId();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/learning') ? '/learning' : '/academy';
  const isStudentWorkspaceRoute = location.pathname.includes('/student-workspace');
  const workspaceTitle = isStudentWorkspaceRoute ? 'Student Workspace' : 'My Courses';
  const { paths: learningPaths } = useAcademyLearningPaths();
  const { savedCourses, isCourseSaved, toggleCourseSaved } = useAcademySavedItems();
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachingCourses, setTeachingCourses] = useState<Course[]>([]);
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
      purple: '#6D4CFF',
      green: '#13B981',
      orange: '#F97316',
      shadow: isDark ? '0 10px 30px rgba(0, 0, 0, 0.35)' : '0 10px 30px rgba(31, 38, 135, 0.16)',
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
        const [coursesResp, enrollmentsResp, instructorResp] = await Promise.all([
          sbFetch('/api/academy/courses'),
          sbFetch(`/api/academy/enrollments?user_id=${encodeURIComponent(userId)}`),
          sbFetch(`/api/academy/courses?instructor_id=${encodeURIComponent(userId)}`),
        ]);

        if (coursesResp.ok) {
          const data = await coursesResp.json();
          setCourses(normalizeList<Course>(data, 'courses'));
        }

        if (enrollmentsResp.ok) {
          const data = await enrollmentsResp.json();
          setEnrollments(normalizeList<Enrollment>(data, ['enrollments', 'courses', 'data']));
        }

        if (instructorResp.ok) {
          const data = await instructorResp.json();
          setTeachingCourses(normalizeList<Course>(data, 'courses'));
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
  const teachingCourseCards = useMemo(() => {
    const directMatches = courses.filter(
      (course) => course.instructor_id && course.instructor_id === userId,
    );
    const merged = [...teachingCourses, ...directMatches];
    return Array.from(new Map(merged.map((course) => [course.id, course])).values()).filter(
      (course) => course.state !== 'archived',
    );
  }, [courses, teachingCourses, userId]);
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
      teaching: teachingCourseCards.filter(matches),
    };
  }, [attendingCourses, savedCourseCards, searchQuery, teachingCourseCards]);

  const completedCount = activeEnrollments.filter(
    (enrollment) => enrollment.status === 'completed',
  ).length;
  const inProgressCount = activeEnrollments.filter(
    (enrollment) => enrollment.status === 'active',
  ).length;

  const tabStyle = (active: boolean) => ({
    padding: '10px 18px',
    borderRadius: 9999,
    fontSize: 14,
    fontWeight: 600 as const,
    background: active ? colors.accent : 'transparent',
    color: active ? '#000' : colors.textSecondary,
    border: active ? 'none' : `1px solid ${colors.border}`,
  });

  const inputStyle: CSSProperties = {
    width: '100%',
    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
    border: `1px solid ${colors.border}`,
    borderRadius: 9999,
    color: colors.text,
    padding: '12px 16px 12px 40px',
    fontSize: 14,
    outline: 'none',
  };

  const renderCourseCard = (course: Course, mode: 'attending' | 'saved' | 'teaching') => {
    const visual = getCourseCardArt(course);
    const enrollment = enrollmentByCourseId.get(course.id);
    const linkedPaths = coursePathMap.get(course.id) ?? [];
    const actionHref =
      mode === 'teaching'
        ? `${basePath}/instructor/courses/${course.id}`
        : enrollment
          ? `${basePath}/courses/${course.id}`
          : `${basePath}/courses/${course.id}/enroll`;

    return (
      <article
        key={`${mode}-${course.id}`}
        className="group overflow-hidden rounded-[26px] border transition-transform duration-300 hover:-translate-y-1"
        style={{
          borderColor: colors.border,
          background: colors.cardBgStrong,
          boxShadow: colors.shadow,
        }}
      >
        <div className="grid gap-0 md:grid-cols-[220px,1fr]">
          <div className="relative min-h-[190px] overflow-hidden">
            <img
              src={visual.src}
              alt={course.title}
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
              {mode === 'teaching' ? 'Teaching' : visual.eyebrow}
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
                <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                  {course.title}
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
                  <span style={{ color: colors.purple }}>{enrollment.progress_percent}%</span>
                </div>
                <div
                  className="h-2 w-full rounded-full"
                  style={{ background: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.1)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${enrollment.progress_percent}%`, background: colors.purple }}
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
                  background: mode === 'teaching' ? colors.purple : colors.accent,
                  color: mode === 'teaching' ? '#fff' : '#000',
                }}
              >
                {mode === 'teaching' ? 'Manage course' : enrollment ? 'Continue' : 'Enroll'}
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
          background: colors.cardBgStrong,
          color: colors.text,
          border: `1px solid ${colors.border}`,
        }}
      >
        {label}
        <ArrowRight className="h-4 w-4" />
      </a>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, padding: '88px 24px 48px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div
              className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
              style={{ background: 'rgba(109,76,255,0.12)', color: colors.purple }}
            >
              <BookmarkCheck className="h-3.5 w-3.5" />
              {isStudentWorkspaceRoute ? 'Student workspace' : 'Course workspace'}
            </div>
            <h1 className="text-3xl font-bold md:text-4xl" style={{ color: colors.text }}>
              {workspaceTitle}
            </h1>
            <p
              className="mt-3 max-w-2xl text-sm md:text-base"
              style={{ color: colors.textSecondary }}
            >
              See the courses you saved, the classes you are attending, and the courses you teach.
            </p>
            <div
              className="mt-5 inline-flex flex-wrap items-center gap-2 rounded-full p-1"
              style={{ background: colors.cardBgStrong }}
            >
              <a href={`${basePath}/paths`} style={tabStyle(false)}>
                Programs
              </a>
              <a href={`${basePath}/courses`} style={tabStyle(false)}>
                Courses
              </a>
              <a href={`${basePath}/student-workspace`} style={tabStyle(true)}>
                Student Workspace
              </a>
              <a href={`${basePath}/saved`} style={tabStyle(false)}>
                Saved
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`${basePath}/courses`}
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
              style={{
                background: colors.cardBgStrong,
                color: colors.text,
                border: `1px solid ${colors.border}`,
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Browse Courses
            </a>
          </div>
        </div>

        <section
          className="grid gap-4 rounded-[28px] border p-5 md:grid-cols-[1fr,280px]"
          style={{
            borderColor: colors.border,
            background: colors.cardBg,
            boxShadow: colors.shadow,
          }}
        >
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: colors.textMuted }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search your saved, attending, and teaching courses"
              style={inputStyle}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {[
              {
                icon: BookOpen,
                label: 'Attending',
                value: activeEnrollments.length,
                color: colors.accent,
              },
              {
                icon: BookmarkCheck,
                label: 'Saved',
                value: savedCourseCards.length,
                color: colors.purple,
              },
              {
                icon: BriefcaseBusiness,
                label: 'Teaching',
                value: teachingCourseCards.length,
                color: colors.orange,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border px-3 py-3"
                style={{ borderColor: colors.border, background: colors.cardBgStrong }}
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

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          {[
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
            {
              icon: Heart,
              label: 'Saved for Later',
              value: savedCourseCards.length,
              text: 'Courses you marked to revisit.',
              color: colors.accent,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-[26px] border p-5"
              style={{
                borderColor: colors.border,
                background: colors.cardBgStrong,
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

        <section
          className="mt-8 rounded-[28px] border p-5 md:p-6"
          style={{
            borderColor: colors.border,
            background: colors.cardBgStrong,
            boxShadow: colors.shadow,
          }}
        >
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ color: colors.purple }}
              >
                Coursework
              </p>
              <h2 className="mt-2 text-2xl font-semibold" style={{ color: colors.text }}>
                Assignments, quizzes, tests, and grades
              </h2>
              <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                Sample classroom data is loaded here so students can see what is due, what was
                submitted, and what has been graded.
              </p>
            </div>
            <a
              href={`${basePath}/dashboard#academy-course-assignments`}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
              style={{
                border: `1px solid ${colors.border}`,
                background: colors.cardBg,
                color: colors.text,
              }}
            >
              Open class work
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {studentWorkspaceSamples.stats.map((item) => (
              <div
                key={item.label}
                className="rounded-[20px] border p-4"
                style={{ borderColor: colors.border, background: colors.cardBg }}
              >
                <div className="text-2xl font-bold" style={{ color: colors.text }}>
                  {item.value}
                </div>
                <p className="mt-1 text-sm font-semibold" style={{ color: colors.text }}>
                  {item.label}
                </p>
                <p className="mt-2 text-xs leading-5" style={{ color: colors.textSecondary }}>
                  {item.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr,0.85fr]">
            <div className="overflow-hidden rounded-[22px] border" style={{ borderColor: colors.border }}>
              {studentWorkspaceSamples.coursework.map((item, index) => (
                <div
                  key={`${item.type}-${item.title}`}
                  className="grid gap-3 px-4 py-4 md:grid-cols-[120px,1fr,150px,150px]"
                  style={{
                    background: index % 2 === 0 ? colors.cardBg : colors.cardBgStrong,
                    borderTop: index === 0 ? undefined : `1px solid ${colors.border}`,
                  }}
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: colors.purple }}>
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

            <div className="rounded-[22px] border p-4" style={{ borderColor: colors.border, background: colors.cardBg }}>
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
                    <p className="mt-2 text-xs" style={{ color: colors.textSecondary }}>
                      {item.assignments} · Quiz average {item.quizAverage}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 space-y-8">
          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                  Attending
                </h2>
                <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                  Courses you are enrolled in or currently completing.
                </p>
              </div>
              <span className="text-sm" style={{ color: colors.textMuted }}>
                {isLoading ? 'Loading...' : `${filteredSections.attending.length} courses`}
              </span>
            </div>
            <div className="grid gap-5">
              {filteredSections.attending.map((course) => renderCourseCard(course, 'attending'))}
              {!isLoading &&
                filteredSections.attending.length === 0 &&
                renderEmptyState(
                  'No attending courses yet.',
                  'Browse the course catalog and enroll when you find a class that fits your next step.',
                  `${basePath}/courses`,
                  'Browse courses',
                )}
            </div>
          </div>

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
                  `${basePath}/courses`,
                  'Find courses to save',
                )}
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                  Teaching
                </h2>
                <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                  Courses connected to you as an instructor.
                </p>
              </div>
              <span className="text-sm" style={{ color: colors.textMuted }}>
                {isLoading ? 'Loading...' : `${filteredSections.teaching.length} courses`}
              </span>
            </div>
            <div className="grid gap-5">
              {filteredSections.teaching.map((course) => renderCourseCard(course, 'teaching'))}
              {!isLoading &&
                filteredSections.teaching.length === 0 &&
                renderEmptyState(
                  'No teaching courses found.',
                  'When you create or are assigned to teach a course, it will show up here.',
                  `${basePath}/dashboard`,
                  'Open dashboard',
                )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

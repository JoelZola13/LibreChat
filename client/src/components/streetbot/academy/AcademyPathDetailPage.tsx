import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, Heart, Map, Target, Video } from 'lucide-react';
import { useLocation, useParams } from 'react-router-dom';
import { sbFetch } from '../shared/sbFetch';
import { getCourseCardArt } from './academyCardArt';
import {
  filterVisibleAcademyCourses,
  filterVisibleAcademyPrograms,
  getAcademyProgramCourseDisplayTitle,
  getAcademyProgramCourseSchedule,
  getAcademyLearningPathFromCollection,
  getLearningPathDisplayCourseCount,
  getLearningPathDisplayCourseTitles,
  getLearningPathDurationLabel,
  resolveLearningPathCourses,
} from './academyLearningPaths';
import { getCourseWorkshopSessions } from './academyCourseMeta';
import { useAcademyLearningPaths } from './useAcademyLearningPaths';
import { useAcademySavedItems } from './useAcademySavedItems';
import { useAcademyUserId } from './useAcademyUserId';
import AcademyNavigationChrome, { ACADEMY_DESKTOP_CONTENT_LEFT } from './AcademyNavigationChrome';

type Course = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  duration?: string | null;
  level?: string | null;
  module_count?: number;
  lesson_count?: number;
  image_url?: string | null;
  thumbnail_url?: string | null;
};

type Enrollment = {
  course_id: string;
  progress_percent: number;
  status?: string;
};

export default function AcademyPathDetailPage() {
  const { slug } = useParams();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/learning') ? '/learning' : '/academy';
  const userId = useAcademyUserId();
  const { paths: learningPaths, loading: learningPathsLoading } = useAcademyLearningPaths();
  const { isCourseSaved, toggleCourseSaved } = useAcademySavedItems();
  const visibleLearningPaths = useMemo(
    () => filterVisibleAcademyPrograms(learningPaths),
    [learningPaths],
  );
  const path = getAcademyLearningPathFromCollection(slug, visibleLearningPaths);
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  const colors = useMemo(
    () => ({
      bg: 'var(--sb-color-background)',
      cardBg: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.4)',
      cardBgStrong: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255,255,255,0.58)',
      border: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)',
      text: isDark ? '#fff' : '#111',
      textSecondary: isDark ? 'rgba(255,255,255,0.72)' : '#4b5563',
      textMuted: isDark ? 'rgba(255,255,255,0.52)' : '#6b7280',
      accent: path?.color ?? '#FFD600',
      shadow: isDark ? '0 10px 30px rgba(0, 0, 0, 0.35)' : '0 10px 30px rgba(31, 38, 135, 0.16)',
    }),
    [isDark, path],
  );

  useEffect(() => {
    async function load() {
      if (!path) {
        setLoading(false);
        return;
      }

      try {
        const [coursesResp, enrollmentsResp] = await Promise.all([
          sbFetch('/api/academy/courses'),
          sbFetch(`/api/academy/enrollments?user_id=${encodeURIComponent(userId)}`),
        ]);

        if (coursesResp.ok) {
          const courseData = await coursesResp.json();
          setCourses(Array.isArray(courseData) ? courseData : []);
        }

        if (enrollmentsResp.ok) {
          const enrollmentData = await enrollmentsResp.json();
          setEnrollments(Array.isArray(enrollmentData) ? enrollmentData : []);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [path, userId]);

  const activeEnrollments = useMemo(
    () => enrollments.filter((entry) => entry.status !== 'dropped'),
    [enrollments],
  );
  const enrolledCourseIds = useMemo(
    () => new Set(activeEnrollments.map((enrollment) => enrollment.course_id)),
    [activeEnrollments],
  );
  const visibleCourses = useMemo(
    () => filterVisibleAcademyCourses(courses, visibleLearningPaths),
    [courses, visibleLearningPaths],
  );

  const pathCourses = useMemo(() => {
    return path ? resolveLearningPathCourses(path, visibleCourses) : [];
  }, [path, visibleCourses]);

  const nextCourse = useMemo(() => {
    for (const course of pathCourses) {
      const enrollment = activeEnrollments.find((entry) => entry.course_id === course.id);
      if (!enrollment || enrollment.progress_percent < 100) {
        return course;
      }
    }
    return pathCourses[0] ?? null;
  }, [activeEnrollments, pathCourses]);

  const pathProgress = useMemo(() => {
    if (pathCourses.length === 0) {
      return 0;
    }

    const totalProgress = pathCourses.reduce((sum, course) => {
      const enrollment = activeEnrollments.find((entry) => entry.course_id === course.id);
      return sum + (enrollment?.progress_percent ?? 0);
    }, 0);

    return Math.round(totalProgress / pathCourses.length);
  }, [activeEnrollments, pathCourses]);

  const pathDurationLabel = useMemo(() => {
    if (!path) {
      return '0 weeks';
    }
    return getLearningPathDurationLabel(path, visibleCourses);
  }, [path, visibleCourses]);

  const pathOverviewParagraphs = useMemo(() => {
    if (!path) {
      return [];
    }

    const sampleCourses = getLearningPathDisplayCourseTitles(path, visibleCourses)
      .slice(0, 4)
      .join(', ');

    return [
      `${path.title} is designed as a guided program, not just a list of classes. It gives learners a clear order to follow, a manageable pace, and a focused outcome at the end of the plan.`,
      sampleCourses
        ? `Inside this path, learners move through ${sampleCourses}. The full program is built for ${path.level.toLowerCase()} learners and can be joined ${path.deliveryMode.toLowerCase()}.`
        : `This plan is built for ${path.level.toLowerCase()} learners and can be joined ${path.deliveryMode.toLowerCase()}.`,
    ];
  }, [path, visibleCourses]);

  const nextStepLabel = useMemo(() => {
    if (nextCourse?.title) {
      return nextCourse.title;
    }

    if (!path) {
      return 'Choose a course';
    }

    return getLearningPathDisplayCourseTitles(path, visibleCourses)[0] ?? 'Choose a course';
  }, [nextCourse, path, visibleCourses]);

  if (!path && learningPathsLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--sb-color-background)',
          padding: '88px 24px 40px',
        }}
      >
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div
            className="h-64 rounded-[28px] border"
            style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
          />
        </div>
      </div>
    );
  }

  if (!path && !learningPathsLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--sb-color-background)',
          padding: '88px 24px 40px',
        }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div
            className="rounded-3xl border p-10 text-center"
            style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
          >
            <Map className="mx-auto mb-4 h-12 w-12" style={{ color: '#8B5CF6' }} />
            <h1 className="text-3xl font-bold text-white">Program not found</h1>
            <p className="mt-3 text-sm text-white/70">
              This path is not available in the current Academy catalog.
            </p>
            <a
              href={`${basePath}/paths`}
              className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
              style={{ background: '#8B5CF6', color: '#fff' }}
            >
              Back to programs
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.bg,
        padding: `88px 24px 40px ${ACADEMY_DESKTOP_CONTENT_LEFT}px`,
      }}
    >
      <AcademyNavigationChrome />
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <a
            href={`${basePath}/paths`}
            className="text-sm font-medium hover:opacity-80"
            style={{ color: colors.textSecondary }}
          >
            Programs
          </a>
          <span style={{ color: colors.textMuted }}>/</span>
          <span className="text-sm font-medium" style={{ color: colors.accent }}>
            {path.title}
          </span>
        </div>

        <section
          className="rounded-[28px] border p-8"
          style={{
            borderColor: colors.border,
            background: colors.cardBg,
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
            <div>
              <div
                className="mb-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: `${path.color}20`, color: path.color }}
              >
                Street Voices Academy Path
              </div>
              <h1 className="text-4xl font-bold" style={{ color: colors.text }}>
                {path.title}
              </h1>
              <p className="mt-4 text-base" style={{ color: colors.textSecondary }}>
                {path.description}
              </p>
              <div
                className="mt-6 flex flex-wrap items-center gap-3 text-sm"
                style={{ color: colors.textSecondary }}
              >
                <span className="inline-flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  {path.level}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {pathDurationLabel}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  {path.deliveryMode}
                </span>
              </div>
            </div>

            <div
              className="rounded-[24px] border p-5"
              style={{ borderColor: colors.border, background: colors.cardBgStrong }}
            >
              <p
                className="text-xs uppercase tracking-[0.22em]"
                style={{ color: colors.textMuted }}
              >
                Path details
              </p>
              <div className="mt-4 space-y-3 text-sm" style={{ color: colors.textSecondary }}>
                <div className="flex items-center justify-between gap-3">
                  <span>Included courses</span>
                  <strong style={{ color: colors.text }}>
                    {getLearningPathDisplayCourseCount(path, courses)}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Progress</span>
                  <strong style={{ color: colors.text }}>{pathProgress}%</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Next step</span>
                  <strong style={{ color: colors.text }}>{nextStepLabel}</strong>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {pathCourses.length > 0 ? (
                  <a
                    href={`${basePath}/paths/${path.slug}/enroll`}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                    style={{ background: path.color, color: '#fff' }}
                  >
                    Sign up Now
                    <ArrowRight className="h-4 w-4" />
                  </a>
                ) : (
                  <a
                    href={`${basePath}/paths`}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                    style={{ background: path.color, color: '#fff' }}
                  >
                    Back to Programs
                    <ArrowRight className="h-4 w-4" />
                  </a>
                )}
                <a
                  href={nextCourse ? `${basePath}/courses/${nextCourse.id}` : `${basePath}/courses`}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                  style={{
                    background: colors.cardBgStrong,
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  View Courses
                </a>
              </div>
            </div>
          </div>
        </section>

        <section
          className="mt-8 rounded-[28px] border p-6"
          style={{ borderColor: colors.border, background: colors.cardBg }}
        >
          <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
            Path Overview
          </h2>
          <div className="mt-4 space-y-4">
            {pathOverviewParagraphs.map((paragraph) => (
              <p
                key={paragraph}
                className="text-sm leading-7"
                style={{ color: colors.textSecondary }}
              >
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        {path.schedule && path.schedule.length > 0 && (
          <section
            className="mt-8 rounded-[28px] border p-6"
            style={{ borderColor: colors.border, background: colors.cardBg }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                  Wednesday program schedule
                </h2>
                <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                  The program moves month by month through the official course sequence.
                </p>
              </div>
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: `${path.color}20`, color: path.color }}
              >
                Aug 5-Nov 25, 2026
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {path.schedule.map((block, index) => (
                <div
                  key={block.title}
                  className="rounded-[22px] border p-4"
                  style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                >
                  <p
                    className="text-xs font-semibold uppercase tracking-[0.18em]"
                    style={{ color: colors.textMuted }}
                  >
                    Step {index + 1} · {block.month}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold" style={{ color: colors.text }}>
                    {block.title}
                  </h3>
                  <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                    {block.dates.join(', ')}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div
            className="rounded-[28px] border p-6"
            style={{ borderColor: colors.border, background: colors.cardBg }}
          >
            <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
              Requirements
            </h2>
            <ul className="mt-5 space-y-3">
              {path.requirements.map((requirement) => (
                <li
                  key={requirement}
                  className="flex items-start gap-3 rounded-2xl border p-4"
                  style={{ borderColor: colors.border }}
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5" style={{ color: path.color }} />
                  <span className="text-sm" style={{ color: colors.textSecondary }}>
                    {requirement}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="rounded-[28px] border p-6"
            style={{ borderColor: colors.border, background: colors.cardBg }}
          >
            <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
              What you&apos;ll learn
            </h2>
            <ul className="mt-5 space-y-3">
              {path.whatYoullLearn.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border p-4"
                  style={{ borderColor: colors.border }}
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5" style={{ color: path.color }} />
                  <span className="text-sm" style={{ color: colors.textSecondary }}>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                Program courses
              </h2>
              <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                {loading
                  ? 'Loading courses...'
                  : 'Move through the four courses in order, then open each course for its full detail page.'}
              </p>
            </div>
            <span className="text-sm" style={{ color: colors.textMuted }}>
              {getLearningPathDisplayCourseCount(path, visibleCourses)} courses
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {pathCourses.length > 0
              ? pathCourses.map((course) => {
                  const linkedPaths = [path];
                  const enrollment = activeEnrollments.find(
                    (entry) => entry.course_id === course.id,
                  );
                  const visual = getCourseCardArt(course);
                  const displayTitle = getAcademyProgramCourseDisplayTitle(course.title);
                  const schedule = getAcademyProgramCourseSchedule(path, displayTitle);
                  const workshopCount = getCourseWorkshopSessions(course.title).length;
                  const courseDuration =
                    workshopCount > 0
                      ? `${workshopCount} Wednesdays`
                      : schedule
                        ? `${schedule.dates.length} Wednesdays`
                        : course.duration || 'Self-paced';

                  return (
                    <article
                      key={course.id}
                      className="group rounded-[26px] border p-6 transition-transform duration-300 hover:-translate-y-2"
                      style={{
                        borderColor: colors.border,
                        background: colors.cardBg,
                        boxShadow: colors.shadow,
                      }}
                    >
                      <div
                        className="relative mb-5 overflow-hidden rounded-[24px] border"
                        style={{ borderColor: colors.border }}
                      >
                        <img
                          src={visual.src}
                          alt={displayTitle}
                          className="h-[220px] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          onError={(event) => {
                            if (event.currentTarget.dataset.fallbackApplied === 'true') {
                              return;
                            }
                            event.currentTarget.dataset.fallbackApplied = 'true';
                            event.currentTarget.src = visual.fallbackSrc;
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                        <div
                          className="absolute left-4 top-4 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                          style={{ background: 'rgba(15,23,42,0.65)', color: visual.accent }}
                        >
                          {visual.eyebrow}
                        </div>
                      </div>

                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="mb-2 flex flex-wrap gap-2">
                            {linkedPaths.map((linkedPath) => (
                              <span
                                key={linkedPath.slug}
                                className="rounded-full px-3 py-1 text-[11px] font-semibold"
                                style={{
                                  background: `${linkedPath.color}18`,
                                  color: linkedPath.color,
                                }}
                              >
                                Part of {linkedPath.title}
                              </span>
                            ))}
                          </div>
                          <h3 className="text-2xl font-semibold">
                            <a
                              href={`${basePath}/courses/${course.id}`}
                              className="transition-colors hover:!text-[#FFD600]"
                              style={{ color: colors.text }}
                            >
                              {displayTitle}
                            </a>
                          </h3>
                        </div>
                        <button
                          onClick={() => toggleCourseSaved(course.id)}
                          className="rounded-full p-2"
                          style={{
                            background: 'rgba(255,214,0,0.12)',
                            border: `1px solid ${colors.border}`,
                          }}
                          aria-label="Save course"
                        >
                          <Heart
                            className="h-4 w-4"
                            style={{
                              color: '#FFD600',
                              fill: isCourseSaved(course.id) ? '#FFD600' : 'transparent',
                            }}
                          />
                        </button>
                      </div>

                      <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                        {course.description ||
                          'Open this course to view the overview, requirements, and what you will learn.'}
                      </p>

                      <div
                        className="mt-4 flex flex-wrap gap-3 text-xs"
                        style={{ color: colors.textMuted }}
                      >
                        <span>
                          {course.level
                            ? course.level.charAt(0).toUpperCase() + course.level.slice(1)
                            : path.level}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {courseDuration}
                        </span>
                        <span>
                          {workshopCount > 0
                            ? `${workshopCount} sessions`
                            : `${course.module_count || 0} modules`}
                        </span>
                      </div>

                      {enrollment && (
                        <div className="mt-4">
                          <div className="mb-2 flex items-center justify-between text-xs">
                            <span style={{ color: colors.textSecondary }}>Progress</span>
                            <span style={{ color: '#FFD600' }}>{enrollment.progress_percent}%</span>
                          </div>
                          <div
                            className="h-2 w-full rounded-full"
                            style={{ background: 'rgba(255,255,255,0.14)' }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${enrollment.progress_percent}%`,
                                background: '#FFD600',
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="mt-6 flex flex-wrap gap-3">
                        <a
                          href={`${basePath}/courses/${course.id}`}
                          className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                          style={{
                            background: colors.cardBgStrong,
                            color: colors.text,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          Learn More
                        </a>
                        <a
                          href={
                            enrolledCourseIds.has(course.id)
                              ? `${basePath}/courses/${course.id}`
                              : `${basePath}/courses/${course.id}/enroll`
                          }
                          className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                          style={{ background: '#FFD600', color: '#000' }}
                        >
                          {enrolledCourseIds.has(course.id) ? 'Open Course' : 'Sign up Now'}
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      </div>
                    </article>
                  );
                })
              : getLearningPathDisplayCourseTitles(path, visibleCourses).map(
                  (courseTitle, index) => {
                    const displayTitle = getAcademyProgramCourseDisplayTitle(courseTitle);
                    const schedule = getAcademyProgramCourseSchedule(path, displayTitle);
                    const visual = getCourseCardArt({
                      id: `${path.slug}-${index}`,
                      title: displayTitle,
                      description: path.description,
                      category: 'Media Training',
                      level: path.level,
                    });

                    return (
                      <article
                        key={`${path.slug}-${courseTitle}-${index}`}
                        className="group rounded-[26px] border p-6 transition-transform duration-300 hover:-translate-y-2"
                        style={{
                          borderColor: colors.border,
                          background: colors.cardBg,
                          boxShadow: colors.shadow,
                        }}
                      >
                        <div
                          className="relative mb-5 overflow-hidden rounded-[24px] border"
                          style={{ borderColor: colors.border }}
                        >
                          <img
                            src={visual.src}
                            alt={displayTitle}
                            className="h-[220px] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            onError={(event) => {
                              if (event.currentTarget.dataset.fallbackApplied === 'true') {
                                return;
                              }
                              event.currentTarget.dataset.fallbackApplied = 'true';
                              event.currentTarget.src = visual.fallbackSrc;
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                          <div
                            className="absolute left-4 top-4 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                            style={{ background: 'rgba(15,23,42,0.65)', color: visual.accent }}
                          >
                            {visual.eyebrow}
                          </div>
                        </div>

                        <div className="mb-2 flex flex-wrap gap-2">
                          <span
                            className="rounded-full px-3 py-1 text-[11px] font-semibold"
                            style={{ background: `${path.color}18`, color: path.color }}
                          >
                            Part of {path.title}
                          </span>
                        </div>
                        <h3 className="text-2xl font-semibold">
                          <a
                            href={`${basePath}/courses?search=${encodeURIComponent(displayTitle)}`}
                            className="transition-colors hover:!text-[#FFD600]"
                            style={{ color: colors.text }}
                          >
                            {displayTitle}
                          </a>
                        </h3>
                        <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                          This course is part of the {path.title} program lineup and will appear
                          here as a full course card once it is added to the Academy catalog.
                        </p>
                        <div
                          className="mt-4 flex flex-wrap gap-3 text-xs"
                          style={{ color: colors.textMuted }}
                        >
                          <span>{path.level}</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {schedule ? `${schedule.dates.length} Wednesdays` : path.deliveryMode}
                          </span>
                          <span>Program course</span>
                        </div>
                        <a
                          href={`${basePath}/courses?search=${encodeURIComponent(displayTitle)}`}
                          className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                          style={{
                            background: colors.cardBgStrong,
                            color: colors.text,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          Find Course
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      </article>
                    );
                  },
                )}
          </div>
        </section>
      </div>
    </div>
  );
}

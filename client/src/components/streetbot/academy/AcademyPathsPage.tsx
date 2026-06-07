import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Clock, Heart, Sparkles } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { sbFetch } from '../shared/sbFetch';
import { getCourseCardArt, getLearningPathCardArt } from './academyCardArt';
import {
  buildAcademyFallbackCourses,
  filterVisibleAcademyCourses,
  filterVisibleAcademyPrograms,
  getAcademyProgramCourseDisplayTitle,
  getAcademyProgramCourseSchedule,
  getLearningPathDisplayCourseCount,
  getLearningPathDisplayCourseTitles,
  getLearningPathDurationLabel,
  resolveLearningPathCourses,
} from './academyLearningPaths';
import { useAcademyLearningPaths } from './useAcademyLearningPaths';
import { useAcademyUserId } from './useAcademyUserId';
import { useAcademySavedItems } from './useAcademySavedItems';

type Course = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  duration?: string | null;
  level?: string | null;
  image_url?: string | null;
  thumbnail_url?: string | null;
};

type Enrollment = {
  course_id: string;
  progress_percent: number;
  status: 'active' | 'completed' | 'dropped';
};

export default function AcademyPathsPage() {
  const userId = useAcademyUserId();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/learning') ? '/learning' : '/academy';
  const { paths: learningPaths } = useAcademyLearningPaths();
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const { isPathSaved, togglePathSaved } = useAcademySavedItems();

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
      shadow: isDark ? '0 10px 30px rgba(0, 0, 0, 0.35)' : '0 10px 30px rgba(31, 38, 135, 0.16)',
    }),
    [isDark],
  );

  const visibleLearningPaths = useMemo(
    () => filterVisibleAcademyPrograms(learningPaths),
    [learningPaths],
  );
  const fallbackCourses = useMemo(
    () => buildAcademyFallbackCourses(visibleLearningPaths),
    [visibleLearningPaths],
  );

  const visibleCourses = useMemo(
    () => filterVisibleAcademyCourses(courses, visibleLearningPaths),
    [courses, visibleLearningPaths],
  );

  useEffect(() => {
    async function load() {
      const [coursesResp, enrollmentsResp] = await Promise.all([
        sbFetch('/api/academy/courses'),
        sbFetch(`/api/academy/enrollments?user_id=${encodeURIComponent(userId)}`),
      ]);

      if (coursesResp.ok) {
        const courseData = await coursesResp.json();
        const nextCourses = Array.isArray(courseData) ? courseData : [];
        setCourses(nextCourses.length > 0 ? nextCourses : fallbackCourses);
      } else {
        setCourses(fallbackCourses);
      }

      if (enrollmentsResp.ok) {
        const enrollmentData = await enrollmentsResp.json();
        setEnrollments(Array.isArray(enrollmentData) ? enrollmentData : []);
      }
    }

    load();
  }, [fallbackCourses, userId]);

  const activeEnrollments = useMemo(
    () => enrollments.filter((enrollment) => enrollment.status !== 'dropped'),
    [enrollments],
  );

  const pathSummaries = useMemo(() => {
    return visibleLearningPaths.map((path) => {
      const includedCourses = resolveLearningPathCourses(path, visibleCourses);
      const enrolledCourses = includedCourses.filter((course) =>
        activeEnrollments.some((entry) => entry.course_id === course.id),
      ).length;
      const totalProgress = includedCourses.reduce((sum, course) => {
        const enrollment = activeEnrollments.find((entry) => entry.course_id === course.id);
        return sum + (enrollment?.progress_percent ?? 0);
      }, 0);
      const progress =
        includedCourses.length > 0 ? Math.round(totalProgress / includedCourses.length) : 0;

      return {
        path,
        includedCourses,
        enrolledCourses,
        progress,
      };
    });
  }, [activeEnrollments, visibleCourses, visibleLearningPaths]);

  const featuredPathSummaries = useMemo(() => {
    return [...pathSummaries].sort((left, right) => {
      const leftGenerated = left.path.source === 'generated' ? 1 : 0;
      const rightGenerated = right.path.source === 'generated' ? 1 : 0;
      if (leftGenerated !== rightGenerated) {
        return rightGenerated - leftGenerated;
      }
      return left.path.title.localeCompare(right.path.title);
    });
  }, [pathSummaries]);

  const tabStyle = (active: boolean) => ({
    padding: '10px 18px',
    borderRadius: 9999,
    fontSize: 14,
    fontWeight: 600 as const,
    background: active ? colors.accent : 'transparent',
    color: active ? '#000' : colors.textSecondary,
    border: active ? 'none' : `1px solid ${colors.border}`,
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.bg,
        padding: '88px 24px 48px',
      }}
    >
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div
              className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: 'rgba(255,214,0,0.12)', color: colors.accent }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Start here
            </div>
            <h1 className="text-3xl font-bold md:text-4xl" style={{ color: colors.text }}>
              Choose how you want to learn.
            </h1>
            <p
              className="mt-3 max-w-2xl text-sm md:text-base"
              style={{ color: colors.textSecondary }}
            >
              Pick a full program or switch to individual courses.
            </p>
            <div
              className="mt-5 inline-flex items-center gap-2 rounded-full p-1"
              style={{ background: colors.cardBgStrong }}
            >
              <a href={`${basePath}/paths`} style={tabStyle(true)}>
                Programs
              </a>
              <a href={`${basePath}/courses`} style={tabStyle(false)}>
                Courses
              </a>
              <a href={`${basePath}/student-workspace`} style={tabStyle(false)}>
                Student Workspace
              </a>
              <a href={`${basePath}/student-workspace?tab=saved`} style={tabStyle(false)}>
                Saved
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={basePath}
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
              style={{
                background: colors.cardBgStrong,
                color: colors.text,
                border: `1px solid ${colors.border}`,
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Academy
            </a>
          </div>
        </div>

        <section className="mt-2 flex justify-center">
          <div className="grid w-full max-w-6xl gap-6">
            {featuredPathSummaries.map((summary) => {
              const visual = getLearningPathCardArt(summary.path);
              const featuredCourses = summary.includedCourses.slice(0, 4);
              const fallbackCourseTitles = getLearningPathDisplayCourseTitles(
                summary.path,
                visibleCourses,
              ).slice(0, 4);

              return (
                <article
                  key={summary.path.slug}
                  className="group rounded-[32px] border p-6 transition-transform duration-300 hover:-translate-y-2 md:p-8"
                  style={{
                    borderColor: colors.border,
                    background: colors.cardBg,
                    boxShadow: colors.shadow,
                  }}
                >
                  <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr] lg:items-stretch">
                    <div
                      className="relative overflow-hidden rounded-[28px] border"
                      style={{ borderColor: colors.border }}
                    >
                      <img
                        src={visual.src}
                        alt={summary.path.title}
                        className="h-[280px] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] lg:h-full lg:min-h-[540px]"
                        onError={(event) => {
                          if (event.currentTarget.dataset.fallbackApplied === 'true') {
                            return;
                          }
                          event.currentTarget.dataset.fallbackApplied = 'true';
                          event.currentTarget.src = visual.fallbackSrc;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                      <div
                        className="absolute left-5 top-5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                        style={{ background: 'rgba(15,23,42,0.72)', color: visual.accent }}
                      >
                        {visual.eyebrow}
                      </div>
                    </div>

                    <div className="flex flex-col justify-center">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <p
                            className="text-xs font-semibold uppercase tracking-[0.22em]"
                            style={{ color: summary.path.color }}
                          >
                            {summary.path.level}
                          </p>
                          <p
                            className="mt-2 text-xs font-semibold uppercase tracking-[0.22em]"
                            style={{ color: colors.textMuted }}
                          >
                            New Program
                          </p>
                        </div>
                        <button
                          onClick={() => togglePathSaved(summary.path.slug)}
                          className="rounded-full p-2"
                          style={{
                            background: `${summary.path.color}18`,
                            border: `1px solid ${colors.border}`,
                          }}
                          aria-label="Save program"
                        >
                          <Heart
                            className="h-4 w-4"
                            style={{
                              color: summary.path.color,
                              fill: isPathSaved(summary.path.slug)
                                ? summary.path.color
                                : 'transparent',
                            }}
                          />
                        </button>
                      </div>

                      <h3 className="text-3xl font-semibold leading-tight md:text-4xl">
                        <a
                          href={`${basePath}/paths/${summary.path.slug}`}
                          className="transition-colors hover:!text-[#FFD600]"
                          style={{ color: colors.text }}
                        >
                          {summary.path.title}
                        </a>
                      </h3>
                      <p
                        className="mt-3 text-base leading-7"
                        style={{ color: colors.textSecondary }}
                      >
                        {summary.path.description}
                      </p>
                      <p className="mt-4 text-sm font-medium" style={{ color: colors.textMuted }}>
                        Based on your goal: {summary.path.title}
                      </p>

                      <div
                        className="mt-6 flex flex-wrap gap-4 text-sm"
                        style={{ color: colors.textSecondary }}
                      >
                        <span className="inline-flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          {getLearningPathDisplayCourseCount(summary.path, visibleCourses)} courses
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {getLearningPathDurationLabel(summary.path, visibleCourses)}
                        </span>
                        <span>{summary.path.level}</span>
                      </div>

                      <div className="mt-6">
                        <p
                          className="mb-3 text-xs font-semibold uppercase tracking-[0.22em]"
                          style={{ color: colors.textMuted }}
                        >
                          Recommended Courses
                        </p>
                        <div className="space-y-3">
                          {featuredCourses.length > 0
                            ? featuredCourses.map((course, index) => {
                                const courseVisual = getCourseCardArt(course);
                                const displayTitle = getAcademyProgramCourseDisplayTitle(
                                  course.title,
                                );
                                const schedule = getAcademyProgramCourseSchedule(
                                  summary.path,
                                  displayTitle,
                                );

                                return (
                                  <div
                                    key={course.id}
                                    className="rounded-2xl border px-4 py-3"
                                    style={{
                                      borderColor: colors.border,
                                      background: colors.cardBgStrong,
                                    }}
                                  >
                                    <div className="flex items-start gap-3">
                                      <img
                                        src={courseVisual.src}
                                        alt={displayTitle}
                                        className="h-16 w-20 rounded-2xl object-cover"
                                        onError={(event) => {
                                          if (
                                            event.currentTarget.dataset.fallbackApplied === 'true'
                                          ) {
                                            return;
                                          }
                                          event.currentTarget.dataset.fallbackApplied = 'true';
                                          event.currentTarget.src = courseVisual.fallbackSrc;
                                        }}
                                      />
                                      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                                        <div>
                                          <a
                                            href={`${basePath}/courses/${course.id}`}
                                            className="text-sm font-semibold transition-colors hover:!text-[#FFD600]"
                                            style={{ color: colors.text }}
                                          >
                                            {displayTitle}
                                          </a>
                                          <p
                                            className="mt-1 text-xs"
                                            style={{ color: colors.textSecondary }}
                                          >
                                            {schedule
                                              ? `${schedule.month} · ${schedule.dates.join(', ')}`
                                              : `${(course.level || 'Beginner').toLowerCase()}${
                                                  course.duration ? ` · ${course.duration}` : ''
                                                }`}
                                          </p>
                                        </div>
                                        <a
                                          href={`${basePath}/courses/${course.id}`}
                                          className="text-xs font-semibold"
                                          style={{ color: colors.accent }}
                                        >
                                          Step {index + 1}
                                        </a>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            : fallbackCourseTitles.map((courseTitle, index) => {
                                const displayTitle =
                                  getAcademyProgramCourseDisplayTitle(courseTitle);
                                const schedule = getAcademyProgramCourseSchedule(
                                  summary.path,
                                  displayTitle,
                                );

                                return (
                                  <div
                                    key={`${summary.path.slug}-${courseTitle}-${index}`}
                                    className="rounded-2xl border px-4 py-3 text-sm"
                                    style={{
                                      borderColor: colors.border,
                                      background: colors.cardBgStrong,
                                      color: colors.text,
                                    }}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <a
                                          href={`${basePath}/courses?search=${encodeURIComponent(displayTitle)}`}
                                          className="text-sm font-semibold transition-colors hover:!text-[#FFD600]"
                                          style={{ color: colors.text }}
                                        >
                                          {displayTitle}
                                        </a>
                                        <p
                                          className="mt-1 text-xs"
                                          style={{ color: colors.textSecondary }}
                                        >
                                          {schedule
                                            ? `${schedule.month} · ${schedule.dates.join(', ')}`
                                            : `Included in ${summary.path.title}`}
                                        </p>
                                      </div>
                                      <span
                                        className="text-xs font-semibold"
                                        style={{ color: colors.accent }}
                                      >
                                        Step {index + 1}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                        </div>
                      </div>

                      <div className="mt-7 flex flex-wrap gap-3">
                        <a
                          href={`${basePath}/paths/${summary.path.slug}`}
                          className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
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
                            summary.includedCourses.length > 0
                              ? `${basePath}/paths/${summary.path.slug}/enroll`
                              : `${basePath}/paths/${summary.path.slug}`
                          }
                          className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
                          style={{ background: summary.path.color, color: '#fff' }}
                        >
                          {summary.includedCourses.length > 0 ? 'Sign up Now' : 'View Program'}
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

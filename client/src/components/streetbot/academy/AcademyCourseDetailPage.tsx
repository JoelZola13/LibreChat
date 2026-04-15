import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, ChevronRight, Clock3, Layers3, Users, Video } from "lucide-react";
import { useLocation, useParams } from "react-router-dom";
import { sbFetch } from "../shared/sbFetch";
import { useAcademyUserId } from "./useAcademyUserId";
import {
  formatCourseLevel,
  getCourseCohortMeta,
  getCourseDeliveryModeFromTags,
  getCourseDetailedOverview,
  getCourseLearningPoints,
  getCourseRequirements,
} from "./academyCourseMeta";

type Course = {
  id: string;
  title: string;
  description?: string | null;
  level?: string | null;
  duration?: string | null;
  category?: string | null;
  instructor_name?: string | null;
  instructor?: string | null;
  module_count?: number;
  lesson_count?: number;
  enrolled_count?: number;
  progress?: number;
  tags?: string[] | null;
};

type Module = {
  id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  sort_order?: number | null;
};

type Lesson = {
  id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  duration?: string | null;
  video_url?: string | null;
  sort_order?: number | null;
};

type Enrollment = {
  id: string;
  course_id: string;
  progress_percent: number;
  status: string;
  last_accessed_at?: string | null;
};

export default function AcademyCourseDetailPage() {
  const reviewFormSrc = "https://airtable.com/embed/appBQoHCfq4nfspKj/pagqRRLsxVpfnq7or/form";
  const { courseId } = useParams();
  const location = useLocation();
  const basePath = location.pathname.startsWith("/learning") ? "/learning" : "/academy";
  const userId = useAcademyUserId();
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Array<Module & { lessons: Lesson[] }>>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showUnenrollConfirm, setShowUnenrollConfirm] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [unenrollMessage, setUnenrollMessage] = useState<string | null>(null);

  const colors = useMemo(
    () => ({
      bg: "var(--sb-color-background)",
      cardBg: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.42)",
      border: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)",
      text: isDark ? "#fff" : "#111",
      textSecondary: isDark ? "rgba(255,255,255,0.72)" : "#4b5563",
      textMuted: isDark ? "rgba(255,255,255,0.5)" : "#6b7280",
      accent: "#FFD600",
    }),
    [isDark],
  );

  useEffect(() => {
    async function load() {
      if (!courseId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      setNotFound(false);
      setShowUnenrollConfirm(false);
      setUnenrollMessage(null);

      try {
        const [courseResp, modulesResp, enrollmentsResp] = await Promise.all([
          sbFetch(`/api/academy/courses/${courseId}`),
          sbFetch(`/api/academy/courses/${courseId}/modules`),
          sbFetch(`/api/academy/enrollments?user_id=${encodeURIComponent(userId)}&course_id=${encodeURIComponent(courseId)}`),
        ]);

        if (!courseResp.ok) {
          setCourse(null);
          setModules([]);
          setEnrollment(null);
          setNotFound(true);
          return;
        }

        const courseData = await courseResp.json();
        setCourse(courseData);

        const moduleData = modulesResp.ok ? await modulesResp.json() : [];
        const sortedModules = Array.isArray(moduleData) ? moduleData : [];

        const modulesWithLessons = await Promise.all(
          sortedModules.map(async (module: Module) => {
            const lessonsResp = await sbFetch(`/api/academy/modules/${module.id}/lessons`);
            const lessonData = lessonsResp.ok ? await lessonsResp.json() : [];
            return {
              ...module,
              lessons: Array.isArray(lessonData) ? lessonData : [],
            };
          }),
        );

        setModules(modulesWithLessons);

        const enrollmentData = enrollmentsResp.ok ? await enrollmentsResp.json() : [];
        const matchingEnrollment = (Array.isArray(enrollmentData) ? enrollmentData : []).find(
          (entry: Enrollment) => entry.course_id === courseId && entry.status !== "dropped",
        );
        setEnrollment(matchingEnrollment ?? null);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [courseId, userId]);

  const courseRequirements = useMemo(() => {
    return course ? getCourseRequirements(course) : [];
  }, [course]);

  const courseLearningPoints = useMemo(() => {
    return course ? getCourseLearningPoints(course, modules) : [];
  }, [course, modules]);

  const cohortMeta = useMemo(() => getCourseCohortMeta(course?.id), [course?.id]);
  const courseDuration = cohortMeta.durationLabel;
  const deliveryMode = useMemo(
    () => getCourseDeliveryModeFromTags(course?.tags) || "In person and live stream",
    [course?.tags],
  );
  const courseOverviewParagraphs = useMemo(() => {
    return course
      ? getCourseDetailedOverview(course, {
          moduleCount: modules.length || course.module_count,
          lessonCount: modules.reduce((sum, module) => sum + module.lessons.length, 0) || course.lesson_count,
          deliveryMode,
          duration: courseDuration,
        })
      : [];
  }, [course, courseDuration, deliveryMode, modules]);

  async function handleUnenroll() {
    if (!enrollment?.id) {
      return;
    }

    setUnenrolling(true);
    setUnenrollMessage(null);
    try {
      const response = await sbFetch(`/api/academy/enrollments/${enrollment.id}`, {
        method: "DELETE",
      });

      if (!response.ok && response.status !== 204) {
        throw new Error(`Unable to unenroll from this course (${response.status})`);
      }

      setEnrollment(null);
      setShowUnenrollConfirm(false);
      setUnenrollMessage("You have been unenrolled from this course. You can enroll again anytime.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to unenroll right now.";
      setUnenrollMessage(message);
    } finally {
      setUnenrolling(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: colors.bg, padding: "88px 24px 40px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="h-64 rounded-[32px]" style={{ background: colors.cardBg, border: `1px solid ${colors.border}` }} />
        </div>
      </div>
    );
  }

  if (notFound || !course) {
    return (
      <div style={{ minHeight: "100vh", background: colors.bg, padding: "88px 24px 40px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div className="rounded-[32px] border p-10 text-center" style={{ borderColor: colors.border, background: colors.cardBg }}>
            <BookOpen className="mx-auto mb-4 h-12 w-12" style={{ color: colors.accent }} />
            <h1 className="text-3xl font-bold" style={{ color: colors.text }}>Course not found</h1>
            <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
              This Academy course could not be found. The route is live, but the course ID is invalid in this environment.
            </p>
            <a href={`${basePath}/courses`} className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold" style={{ background: colors.accent, color: "#000" }}>
              Back to courses
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, padding: "88px 24px 40px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <a href={basePath} className="text-sm font-medium hover:opacity-80" style={{ color: colors.textSecondary }}>Academy</a>
          <span style={{ color: colors.textMuted }}>/</span>
          <a href={`${basePath}/courses`} className="text-sm font-medium hover:opacity-80" style={{ color: colors.textSecondary }}>Courses</a>
          <span style={{ color: colors.textMuted }}>/</span>
          <span className="text-sm font-medium" style={{ color: colors.accent }}>{course.title}</span>
        </div>

        <section className="rounded-[32px] border p-8" style={{ borderColor: colors.border, background: colors.cardBg, backdropFilter: "blur(20px)" }}>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div style={{ maxWidth: 720 }}>
              <div className="mb-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgba(255,214,0,0.18)", color: colors.accent }}>
                Street Voices Academy Course
              </div>
              <h1 className="text-4xl font-bold" style={{ color: colors.text }}>{course.title}</h1>
              <p className="mt-4 text-base" style={{ color: colors.textSecondary }}>
                {course.description || "This Academy course page gives you a clear overview before you enroll."}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-sm" style={{ color: colors.textSecondary }}>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{formatCourseLevel(course.level)}</span>
                <span className="inline-flex items-center gap-2"><Layers3 className="h-4 w-4" />{modules.length || course.module_count || 0} modules</span>
                <span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4" />{modules.reduce((sum, module) => sum + module.lessons.length, 0) || course.lesson_count || 0} lessons</span>
                <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4" />{courseDuration}</span>
                <span className="inline-flex items-center gap-2"><Video className="h-4 w-4" />{deliveryMode}</span>
                {(course.instructor_name || course.instructor) && (
                  <span className="inline-flex items-center gap-2"><Users className="h-4 w-4" />{course.instructor_name || course.instructor}</span>
                )}
              </div>
            </div>

            <div className="min-w-[260px] rounded-[28px] border p-5" style={{ borderColor: colors.border, background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.65)" }}>
              <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>Course details</p>
              <div className="mt-4 space-y-3 text-sm" style={{ color: colors.textSecondary }}>
                <div className="flex items-center justify-between gap-3">
                  <span>Level</span>
                  <strong style={{ color: colors.text }}>{formatCourseLevel(course.level)}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Duration</span>
                  <strong style={{ color: colors.text }}>{courseDuration}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Format</span>
                  <strong style={{ color: colors.text }}>{deliveryMode}</strong>
                </div>
              </div>
              <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                {enrollment
                  ? "You’re enrolled in this Academy course."
                  : "Enroll to unlock the course dashboard, live support, assignments, materials, and discussion with instructors."}
              </p>
              <div className="mt-5 space-y-3">
                {enrollment ? (
                  <a href={`${basePath}/dashboard`} className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold" style={{ background: colors.accent, color: "#000" }}>
                    Open Dashboard
                    <ChevronRight className="h-4 w-4" />
                  </a>
                ) : (
                  <a
                    href={`${basePath}/courses/${course.id}/enroll`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                    style={{ background: colors.accent, color: "#000", border: "none" }}
                  >
                    Enroll Now
                    <ChevronRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>Course Overview</h2>
          <div className="mt-4 space-y-4">
            {courseOverviewParagraphs.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-7" style={{ color: colors.textSecondary }}>
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
            <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>Requirements</h2>
            <ul className="mt-5 space-y-3">
              {courseRequirements.map((requirement) => (
                <li key={requirement} className="flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: colors.border }}>
                  <CheckCircle2 className="mt-0.5 h-5 w-5" style={{ color: colors.accent }} />
                  <span className="text-sm" style={{ color: colors.textSecondary }}>{requirement}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
            <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>What you&apos;ll learn</h2>
            <ul className="mt-5 space-y-3">
              {courseLearningPoints.map((point) => (
                <li key={point} className="flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: colors.border }}>
                  <CheckCircle2 className="mt-0.5 h-5 w-5" style={{ color: colors.accent }} />
                  <span className="text-sm" style={{ color: colors.textSecondary }}>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-8 rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>Course Review Form</h2>
              <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                Enrolled students can submit course feedback here.
              </p>
            </div>
          </div>
          {enrollment ? (
            <div className="overflow-hidden rounded-[24px] border" style={{ borderColor: colors.border, background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.58)" }}>
              <iframe
                title={`${course.title} review form`}
                src={reviewFormSrc}
                width="100%"
                height="533"
                frameBorder="0"
                loading="lazy"
                style={{ background: "transparent", border: "none", display: "block" }}
              />
            </div>
          ) : (
            <div className="rounded-[24px] border p-5" style={{ borderColor: colors.border, background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.58)" }}>
              <p className="text-sm leading-7" style={{ color: colors.textSecondary }}>
                Enroll in this course to unlock the review form and share your feedback after you start learning.
              </p>
              <a
                href={`${basePath}/courses/${course.id}/enroll`}
                className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                style={{ background: colors.accent, color: "#000" }}
              >
                Enroll Now
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <div className="mb-4 flex items-center gap-3">
            <Users className="h-5 w-5" style={{ color: "#8B5CF6" }} />
            <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>{cohortMeta.name}</h2>
          </div>
          <div className="rounded-[24px] border p-5" style={{ borderColor: colors.border, background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.6)" }}>
            <p className="text-lg font-semibold" style={{ color: colors.text }}>
              Starts {cohortMeta.startLabel} - {cohortMeta.durationLabel}
            </p>
            <p className="mt-3 text-sm leading-7" style={{ color: colors.textSecondary }}>
              {cohortMeta.summary}
            </p>
            <p className="mt-3 text-sm font-medium" style={{ color: colors.text }}>
              Last day to Enroll: {cohortMeta.enrollmentDeadlineLabel}
            </p>
            <a
              href={enrollment ? `${basePath}/dashboard` : `${basePath}/courses/${course.id}/enroll`}
              className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
              style={{ background: "#8B5CF6", color: "#fff", border: "none" }}
            >
              {enrollment ? "Open Dashboard" : "Join Fall Cohort"}
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </section>

        {(enrollment || unenrollMessage) && (
          <section className="mt-8 rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>Course Access</h2>
                <p className="mt-2 text-sm leading-7" style={{ color: colors.textSecondary }}>
                  {enrollment
                    ? "If you leave this course, it will be removed from your student dashboard and you will no longer see its live sessions, materials, assignments, or instructor discussion."
                    : "You are not enrolled in this course right now. If you want access again, use the Enroll Now button above."}
                </p>
              </div>

              {enrollment && !showUnenrollConfirm && (
                <button
                  type="button"
                  onClick={() => {
                    setShowUnenrollConfirm(true);
                    setUnenrollMessage(null);
                  }}
                  className="rounded-full px-4 py-3 text-sm font-semibold"
                  style={{ background: colors.cardBg, color: colors.text, border: `1px solid ${colors.border}` }}
                >
                  Unenroll in this Course
                </button>
              )}

              {enrollment && showUnenrollConfirm && (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setShowUnenrollConfirm(false)}
                    className="rounded-full px-4 py-3 text-sm font-semibold"
                    style={{ background: colors.cardBg, color: colors.text, border: `1px solid ${colors.border}` }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleUnenroll()}
                    disabled={unenrolling}
                    className="rounded-full px-4 py-3 text-sm font-semibold disabled:opacity-60"
                    style={{ background: "#ef4444", color: "#fff" }}
                  >
                    {unenrolling ? "Confirming..." : "Confirm"}
                  </button>
                </div>
              )}
            </div>

            {unenrollMessage && (
              <div
                className="mt-4 rounded-[18px] border px-4 py-3 text-sm"
                style={{
                  borderColor: unenrollMessage.toLowerCase().includes("unable") ? "rgba(239,68,68,0.3)" : colors.border,
                  background: unenrollMessage.toLowerCase().includes("unable") ? "rgba(239,68,68,0.08)" : colors.cardBg,
                  color: unenrollMessage.toLowerCase().includes("unable") ? "#ef4444" : colors.textSecondary,
                }}
              >
                {unenrollMessage}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

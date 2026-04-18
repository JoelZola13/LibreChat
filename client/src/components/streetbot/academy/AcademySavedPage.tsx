import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Heart, HeartOff } from "lucide-react";
import { useLocation } from "react-router-dom";
import { sbFetch } from "../shared/sbFetch";
import { getCourseCardArt, getLearningPathCardArt } from "./academyCardArt";
import {
  getLearningPathDisplayCourseCount,
  getLearningPathDisplayCourseTitles,
  getLearningPathDurationLabel,
  resolveLearningPathCourses,
} from "./academyLearningPaths";
import { useAcademyLearningPaths } from "./useAcademyLearningPaths";
import { useAcademyUserId } from "./useAcademyUserId";
import { useAcademySavedItems } from "./useAcademySavedItems";

type Course = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  duration?: string | null;
  level?: string | null;
  state?: "draft" | "published" | "archived";
  image_url?: string | null;
  thumbnail_url?: string | null;
};

type Enrollment = {
  course_id: string;
  progress_percent: number;
  status: "active" | "completed" | "dropped";
};

export default function AcademySavedPage() {
  const userId = useAcademyUserId();
  const location = useLocation();
  const basePath = location.pathname.startsWith("/learning") ? "/learning" : "/academy";
  const { paths: learningPaths } = useAcademyLearningPaths();
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const { savedPaths, savedCourses, isPathSaved, isCourseSaved, togglePathSaved, toggleCourseSaved } =
    useAcademySavedItems();

  const colors = useMemo(
    () => ({
      bg: "var(--sb-color-background)",
      cardBg: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.35)",
      cardBgStrong: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.58)",
      border: isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.6)",
      text: isDark ? "#fff" : "#111",
      textSecondary: isDark ? "rgba(255, 255, 255, 0.72)" : "#4b5563",
      textMuted: isDark ? "rgba(255, 255, 255, 0.5)" : "#6b7280",
      accent: "#FFD600",
      shadow: isDark ? "0 10px 30px rgba(0, 0, 0, 0.35)" : "0 10px 30px rgba(31, 38, 135, 0.16)",
    }),
    [isDark],
  );

  useEffect(() => {
    async function load() {
      try {
        const [coursesResp, enrollmentsResp] = await Promise.all([
          sbFetch("/api/academy/courses"),
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
  }, [userId]);

  const activeEnrollments = useMemo(
    () => enrollments.filter((entry) => entry.status !== "dropped"),
    [enrollments],
  );
  const enrolledCourseIds = useMemo(
    () => new Set(activeEnrollments.map((entry) => entry.course_id)),
    [activeEnrollments],
  );

  const savedPathSummaries = useMemo(() => {
    return learningPaths
      .filter((path) => savedPaths.includes(path.slug))
      .map((path) => {
        const includedCourses = resolveLearningPathCourses(path, courses);
        const totalProgress = includedCourses.reduce((sum, course) => {
          const enrollment = activeEnrollments.find((entry) => entry.course_id === course.id);
          return sum + (enrollment?.progress_percent ?? 0);
        }, 0);
        const progress = includedCourses.length > 0 ? Math.round(totalProgress / includedCourses.length) : 0;

        return {
          path,
          includedCourses,
          progress,
        };
      });
  }, [activeEnrollments, courses, learningPaths, savedPaths]);

  const savedCourseCards = useMemo(() => {
    return courses.filter(
      (course) => (!course.state || course.state === "published") && savedCourses.includes(course.id),
    );
  }, [courses, savedCourses]);

  const tabStyle = (active: boolean) => ({
    padding: "10px 18px",
    borderRadius: 9999,
    fontSize: 14,
    fontWeight: 600 as const,
    background: active ? colors.accent : "transparent",
    color: active ? "#000" : colors.textSecondary,
    border: active ? "none" : `1px solid ${colors.border}`,
  });

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, padding: "88px 24px 48px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold md:text-4xl" style={{ color: colors.text }}>
              Saved
            </h1>
            <p className="mt-3 max-w-2xl text-sm md:text-base" style={{ color: colors.textSecondary }}>
              Keep your favorite paths and courses here.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full p-1" style={{ background: colors.cardBgStrong }}>
              <a href={`${basePath}/paths`} style={tabStyle(false)}>
                Programs
              </a>
              <a href={`${basePath}/courses`} style={tabStyle(false)}>
                Courses
              </a>
              <a href={`${basePath}/saved`} style={tabStyle(true)}>
                Saved
              </a>
            </div>
          </div>

          <a
            href={basePath}
            className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
            style={{ background: colors.cardBgStrong, color: colors.text, border: `1px solid ${colors.border}` }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Homepage
          </a>
        </div>

        <section className="rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg, boxShadow: colors.shadow }}>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
              Saved Programs
            </h2>
            <span className="text-sm" style={{ color: colors.textMuted }}>
              {loading ? "Loading..." : `${savedPathSummaries.length} saved`}
            </span>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-3">
            {savedPathSummaries.map((summary) => {
              const visual = getLearningPathCardArt(summary.path);
              return (
                <article
                  key={summary.path.slug}
                  className="group rounded-[26px] border p-6 transition-transform duration-300 hover:-translate-y-2"
                  style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                >
                  <div className="relative mb-5 overflow-hidden rounded-[24px] border" style={{ borderColor: colors.border }}>
                    <img
                      src={visual.src}
                      alt={summary.path.title}
                      className="h-[210px] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      onError={(event) => {
                        if (event.currentTarget.dataset.fallbackApplied === "true") {
                          return;
                        }
                        event.currentTarget.dataset.fallbackApplied = "true";
                        event.currentTarget.src = visual.fallbackSrc;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                    <div className="absolute left-4 top-4 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ background: "rgba(15,23,42,0.65)", color: visual.accent }}>
                      {visual.eyebrow}
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div
                        className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                        style={{ background: `${summary.path.color}18` }}
                      >
                        <summary.path.icon className="h-6 w-6" style={{ color: summary.path.color }} />
                      </div>
                      <h3 className="text-2xl font-semibold" style={{ color: colors.text }}>
                        {summary.path.title}
                      </h3>
                    </div>
                    <button
                      onClick={() => togglePathSaved(summary.path.slug)}
                      className="rounded-full p-2"
                      style={{ background: `${summary.path.color}18`, border: `1px solid ${colors.border}` }}
                      aria-label="Remove saved path"
                    >
                      {isPathSaved(summary.path.slug) ? (
                        <Heart className="h-4 w-4" style={{ color: summary.path.color, fill: summary.path.color }} />
                      ) : (
                        <HeartOff className="h-4 w-4" style={{ color: summary.path.color }} />
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                    {summary.path.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs" style={{ color: colors.textMuted }}>
                    <span>{summary.path.level}</span>
                    <span>{getLearningPathDurationLabel(summary.path, courses)}</span>
                    <span>{getLearningPathDisplayCourseCount(summary.path, courses)} courses</span>
                    <span>{summary.progress}% complete</span>
                  </div>
                  <div className="mt-5 space-y-2">
                    {getLearningPathDisplayCourseTitles(summary.path, courses).slice(0, 3).map((courseTitle, index) => (
                      <div
                        key={`${summary.path.slug}-${courseTitle}-${index}`}
                        className="rounded-2xl border px-4 py-3 text-sm"
                        style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
                      >
                        {courseTitle}
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href={`${basePath}/paths/${summary.path.slug}`}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                      style={{ background: colors.cardBg, color: colors.text, border: `1px solid ${colors.border}` }}
                    >
                      Learn More
                    </a>
                    <a
                      href={
                        summary.includedCourses.length > 0
                          ? `${basePath}/paths/${summary.path.slug}/enroll`
                          : `${basePath}/paths/${summary.path.slug}`
                      }
                      className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                      style={{ background: summary.path.color, color: "#fff" }}
                    >
                      {summary.includedCourses.length > 0 ? "Enroll Now" : "View Program"}
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </article>
              );
            })}

            {!loading && savedPathSummaries.length === 0 && (
              <div className="rounded-[26px] border p-8 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                No saved paths yet.
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg, boxShadow: colors.shadow }}>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
              Saved Courses
            </h2>
            <span className="text-sm" style={{ color: colors.textMuted }}>
              {loading ? "Loading..." : `${savedCourseCards.length} saved`}
            </span>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {savedCourseCards.map((course) => {
              const visual = getCourseCardArt(course);
              return (
                <article
                  key={course.id}
                  className="group rounded-[26px] border p-6 transition-transform duration-300 hover:-translate-y-2"
                  style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                >
                  <div className="relative mb-5 overflow-hidden rounded-[24px] border" style={{ borderColor: colors.border }}>
                    <img
                      src={visual.src}
                      alt={course.title}
                      className="h-[210px] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      onError={(event) => {
                        if (event.currentTarget.dataset.fallbackApplied === "true") {
                          return;
                        }
                        event.currentTarget.dataset.fallbackApplied = "true";
                        event.currentTarget.src = visual.fallbackSrc;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                    <div className="absolute left-4 top-4 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ background: "rgba(15,23,42,0.65)", color: visual.accent }}>
                      {visual.eyebrow}
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-2xl font-semibold" style={{ color: colors.text }}>
                        {course.title}
                      </h3>
                      <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                        {course.description || "Open this course for the full overview."}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleCourseSaved(course.id)}
                      className="rounded-full p-2"
                      style={{ background: "rgba(255,214,0,0.12)", border: `1px solid ${colors.border}` }}
                      aria-label="Remove saved course"
                    >
                      {isCourseSaved(course.id) ? (
                        <Heart className="h-4 w-4" style={{ color: colors.accent, fill: colors.accent }} />
                      ) : (
                        <HeartOff className="h-4 w-4" style={{ color: colors.accent }} />
                      )}
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3 text-xs" style={{ color: colors.textMuted }}>
                    <span>{course.level ? course.level.charAt(0).toUpperCase() + course.level.slice(1) : "Beginner"}</span>
                    <span>{course.duration || "Self-paced"}</span>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href={`${basePath}/courses/${course.id}`}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                      style={{ background: colors.cardBg, color: colors.text, border: `1px solid ${colors.border}` }}
                    >
                      Learn More
                    </a>
                    <a
                      href={enrolledCourseIds.has(course.id) ? `${basePath}/courses/${course.id}` : `${basePath}/courses/${course.id}/enroll`}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                      style={{ background: colors.accent, color: "#000" }}
                    >
                      {enrolledCourseIds.has(course.id) ? "Open Course" : "Enroll Now"}
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </article>
              );
            })}

            {!loading && savedCourseCards.length === 0 && (
              <div className="rounded-[26px] border p-8 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                No saved courses yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

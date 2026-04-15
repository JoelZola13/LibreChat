import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Clock, Heart, Search } from "lucide-react";
import { useLocation } from "react-router-dom";
import { sbFetch } from "../shared/sbFetch";
import { getLearningPathCourseMap } from "./academyLearningPaths";
import { getCourseCardArt } from "./academyCardArt";
import { useAcademyLearningPaths } from "./useAcademyLearningPaths";
import { useAcademyUserId } from "./useAcademyUserId";
import { useAcademySavedItems } from "./useAcademySavedItems";

type Course = {
  id: string;
  title: string;
  description?: string | null;
  level?: string | null;
  duration?: string | null;
  category?: string | null;
  instructor_name?: string | null;
  instructor?: string | null;
  state?: "draft" | "published" | "archived";
  module_count?: number;
  lesson_count?: number;
  image_url?: string | null;
  thumbnail_url?: string | null;
};

type Enrollment = {
  course_id: string;
  status: "active" | "completed" | "dropped";
  progress_percent: number;
};

export default function AcademyCoursesPage() {
  const currentUserId = useAcademyUserId();
  const location = useLocation();
  const basePath = location.pathname.startsWith("/learning") ? "/learning" : "/academy";
  const { paths: learningPaths } = useAcademyLearningPaths();
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("All");
  const { isCourseSaved, toggleCourseSaved } = useAcademySavedItems();

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
          sbFetch(`/api/academy/enrollments?user_id=${encodeURIComponent(currentUserId)}`),
        ]);

        if (coursesResp.ok) {
          const data = await coursesResp.json();
          setCourses(Array.isArray(data) ? data : []);
        }

        if (enrollmentsResp.ok) {
          const data = await enrollmentsResp.json();
          setEnrollments(Array.isArray(data) ? data : []);
        }
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [currentUserId]);

  const activeEnrollments = useMemo(
    () => enrollments.filter((enrollment) => enrollment.status !== "dropped"),
    [enrollments],
  );
  const enrolledCourseIds = useMemo(
    () => new Set(activeEnrollments.map((enrollment) => enrollment.course_id)),
    [activeEnrollments],
  );
  const coursePathMap = useMemo(() => getLearningPathCourseMap(courses, learningPaths), [courses, learningPaths]);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      if (course.state && course.state !== "published") {
        return false;
      }

      if (
        selectedLevel !== "All" &&
        (course.level ? course.level.toLowerCase() : "beginner") !== selectedLevel.toLowerCase()
      ) {
        return false;
      }

      if (!searchQuery) {
        return true;
      }

      const haystack = `${course.title} ${course.description ?? ""}`.toLowerCase();
      return haystack.includes(searchQuery.toLowerCase());
    });
  }, [courses, searchQuery, selectedLevel]);

  const tabStyle = (active: boolean) => ({
    padding: "10px 18px",
    borderRadius: 9999,
    fontSize: 14,
    fontWeight: 600 as const,
    background: active ? colors.accent : "transparent",
    color: active ? "#000" : colors.textSecondary,
    border: active ? "none" : `1px solid ${colors.border}`,
  });

  const inputStyle: CSSProperties = {
    width: "100%",
    background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
    border: `1px solid ${colors.border}`,
    borderRadius: 9999,
    color: colors.text,
    padding: "12px 16px",
    fontSize: 14,
    outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, padding: "88px 24px 48px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold md:text-4xl" style={{ color: colors.text }}>
              Pick a single course.
            </h1>
            <p className="mt-3 max-w-2xl text-sm md:text-base" style={{ color: colors.textSecondary }}>
              Choose one course now, or go back to learning paths for a full plan.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full p-1" style={{ background: colors.cardBgStrong }}>
              <a href={`${basePath}/paths`} style={tabStyle(false)}>
                Learning Paths
              </a>
              <a href={`${basePath}/courses`} style={tabStyle(true)}>
                Courses
              </a>
              <a href={`${basePath}/saved`} style={tabStyle(false)}>
                Saved
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`${basePath}/dashboard`}
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
              style={{ background: colors.accent, color: "#000" }}
            >
              Open Dashboard
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={basePath}
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
              style={{ background: colors.cardBgStrong, color: colors.text, border: `1px solid ${colors.border}` }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Homepage
            </a>
          </div>
        </div>

        <section className="grid gap-4 rounded-[28px] border p-5 md:grid-cols-[1.2fr,0.8fr,0.6fr]" style={{ borderColor: colors.border, background: colors.cardBg, boxShadow: colors.shadow }}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: colors.textMuted }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search courses"
              style={{ ...inputStyle, paddingLeft: 40 }}
            />
          </div>
          <select value={selectedLevel} onChange={(event) => setSelectedLevel(event.target.value)} style={inputStyle}>
            <option value="All">All levels</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
          <a
            href={`${basePath}/paths`}
            className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
            style={{ background: colors.cardBgStrong, color: colors.text, border: `1px solid ${colors.border}` }}
          >
            View Paths
          </a>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {isLoading &&
            [1, 2, 3].map((item) => (
              <div key={item} className="h-[280px] rounded-[26px] border" style={{ borderColor: colors.border, background: colors.cardBg }} />
            ))}

          {!isLoading &&
            filteredCourses.map((course) => {
              const linkedPaths = coursePathMap.get(course.id) ?? [];
              const enrollment = activeEnrollments.find((entry) => entry.course_id === course.id);
              const visual = getCourseCardArt(course);

              return (
                <article
                  key={course.id}
                  className="rounded-[26px] border p-6"
                  style={{ borderColor: colors.border, background: colors.cardBg, boxShadow: colors.shadow }}
                >
                  <div className="relative mb-5 overflow-hidden rounded-[24px] border" style={{ borderColor: colors.border }}>
                    <img
                      src={visual.src}
                      alt={course.title}
                      className="h-[220px] w-full object-cover"
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
                      <div className="mb-2 flex flex-wrap gap-2">
                        {linkedPaths.slice(0, 2).map((path) => (
                          <span
                            key={path.slug}
                            className="rounded-full px-3 py-1 text-[11px] font-semibold"
                            style={{ background: `${path.color}18`, color: path.color }}
                          >
                            Part of {path.title}
                          </span>
                        ))}
                      </div>
                      <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                        {course.title}
                      </h2>
                    </div>
                    <button
                      onClick={() => toggleCourseSaved(course.id)}
                      className="rounded-full p-2"
                      style={{ background: "rgba(255,214,0,0.12)", border: `1px solid ${colors.border}` }}
                      aria-label="Save course"
                    >
                      <Heart
                        className="h-4 w-4"
                        style={{ color: colors.accent, fill: isCourseSaved(course.id) ? colors.accent : "transparent" }}
                      />
                    </button>
                  </div>

                  <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                    {course.description || "Open this course to view the overview, requirements, and what you will learn."}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3 text-xs" style={{ color: colors.textMuted }}>
                    <span>{course.level ? course.level.charAt(0).toUpperCase() + course.level.slice(1) : "Beginner"}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {course.duration || "Self-paced"}
                    </span>
                    <span>{course.module_count || 0} modules</span>
                  </div>

                  {enrollment && (
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span style={{ color: colors.textSecondary }}>Progress</span>
                        <span style={{ color: colors.accent }}>{enrollment.progress_percent}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full" style={{ background: "rgba(255,255,255,0.14)" }}>
                        <div className="h-full rounded-full" style={{ width: `${enrollment.progress_percent}%`, background: colors.accent }} />
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href={`${basePath}/courses/${course.id}`}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                      style={{ background: colors.cardBgStrong, color: colors.text, border: `1px solid ${colors.border}` }}
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
        </section>

        {!isLoading && filteredCourses.length === 0 && (
          <div className="mt-10 rounded-[26px] border p-8 text-center" style={{ borderColor: colors.border, background: colors.cardBg, color: colors.textSecondary }}>
            No courses match this filter yet. Try a different level, search, or switch back to Learning Paths.
          </div>
        )}
      </div>
    </div>
  );
}

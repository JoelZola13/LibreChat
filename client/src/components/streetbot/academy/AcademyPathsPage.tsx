import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Clock, Heart, Sparkles, Target } from "lucide-react";
import { useLocation } from "react-router-dom";
import { sbFetch } from "../shared/sbFetch";
import { getCourseCardArt, getLearningPathCardArt } from "./academyCardArt";
import {
  academyGoalOptions,
  getAcademyGoalOption,
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
  image_url?: string | null;
  thumbnail_url?: string | null;
};

type Enrollment = {
  course_id: string;
  progress_percent: number;
  status: "active" | "completed" | "dropped";
};

const GOAL_STORAGE_KEY = "streetvoices-academy-goal";

export default function AcademyPathsPage() {
  const userId = useAcademyUserId();
  const location = useLocation();
  const basePath = location.pathname.startsWith("/learning") ? "/learning" : "/academy";
  const { paths: learningPaths, loading: learningPathsLoading } = useAcademyLearningPaths();
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState("digital-confidence");
  const { isPathSaved, togglePathSaved } = useAcademySavedItems();

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
    const storedGoal = localStorage.getItem(GOAL_STORAGE_KEY);
    const legacyGoalMap: Record<string, string> = {
      "job-ready": "job-search",
      "digital-basics": "digital-confidence",
      "housing-stability": "housing-support",
    };
    const normalizedGoal = legacyGoalMap[storedGoal ?? ""] ?? storedGoal;
    if (normalizedGoal && academyGoalOptions.some((goal) => goal.id === normalizedGoal)) {
      setSelectedGoal(normalizedGoal);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(GOAL_STORAGE_KEY, selectedGoal);
  }, [selectedGoal]);

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
    () => enrollments.filter((enrollment) => enrollment.status !== "dropped"),
    [enrollments],
  );

  const selectedGoalOption = useMemo(
    () => getAcademyGoalOption(selectedGoal) ?? academyGoalOptions[0],
    [selectedGoal],
  );

  const pathSummaries = useMemo(() => {
    return learningPaths.map((path) => {
      const includedCourses = resolveLearningPathCourses(path, courses);
      const enrolledCourses = includedCourses.filter((course) =>
        activeEnrollments.some((entry) => entry.course_id === course.id),
      ).length;
      const totalProgress = includedCourses.reduce((sum, course) => {
        const enrollment = activeEnrollments.find((entry) => entry.course_id === course.id);
        return sum + (enrollment?.progress_percent ?? 0);
      }, 0);
      const progress = includedCourses.length > 0 ? Math.round(totalProgress / includedCourses.length) : 0;

      return {
        path,
        includedCourses,
        enrolledCourses,
        progress,
      };
    });
  }, [activeEnrollments, courses, learningPaths]);

  const generatedPathSummaries = useMemo(
    () => pathSummaries.filter((summary) => summary.path.source === "generated"),
    [pathSummaries],
  );

  const orderedPathSummaries = useMemo(() => {
    return [...pathSummaries].sort((left, right) => {
      const leftGenerated = left.path.source === "generated" ? 1 : 0;
      const rightGenerated = right.path.source === "generated" ? 1 : 0;
      if (leftGenerated !== rightGenerated) {
        return rightGenerated - leftGenerated;
      }
      return left.path.title.localeCompare(right.path.title);
    });
  }, [pathSummaries]);

  const recommendedPaths = useMemo(() => {
    const slugs = selectedGoalOption?.recommendedPathSlugs ?? [];
    const summaries = slugs
      .map((slug) => pathSummaries.find((summary) => summary.path.slug === slug) ?? null)
      .filter((summary): summary is (typeof pathSummaries)[number] => summary !== null);

    return summaries.length > 0 ? summaries : pathSummaries.slice(0, 2);
  }, [pathSummaries, selectedGoalOption]);

  const recommendedPath = recommendedPaths[0] ?? null;
  const recommendedPathVisual = recommendedPath ? getLearningPathCardArt(recommendedPath.path) : null;

  const recommendedCourses = useMemo(() => {
    if (!selectedGoalOption) {
      return recommendedPath?.includedCourses.slice(0, 4) ?? [];
    }

    const keywordMatches = new Map<string, number>();
    const pathCoursePool = recommendedPaths.flatMap((summary) => summary.includedCourses);
    const uniqueCourses = Array.from(new Map(pathCoursePool.map((course) => [course.id, course])).values());

    for (const course of uniqueCourses) {
      const haystack = `${course.title} ${course.category ?? ""} ${course.description ?? ""} ${course.level ?? ""}`.toLowerCase();
      const score = selectedGoalOption.preferredCourseKeywords.reduce(
        (total, keyword) => total + (haystack.includes(keyword.toLowerCase()) ? 1 : 0),
        0,
      );
      keywordMatches.set(course.id, score);
    }

    return [...uniqueCourses]
      .sort((left, right) => {
        const scoreDelta = (keywordMatches.get(right.id) ?? 0) - (keywordMatches.get(left.id) ?? 0);
        if (scoreDelta !== 0) {
          return scoreDelta;
        }
        return left.title.localeCompare(right.title);
      })
      .slice(0, 4);
  }, [recommendedPath, recommendedPaths, selectedGoalOption]);

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
    <div
      style={{
        minHeight: "100vh",
        background: colors.bg,
        padding: "88px 24px 48px",
      }}
    >
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgba(255,214,0,0.12)", color: colors.accent }}>
              <Sparkles className="h-3.5 w-3.5" />
              Start here
            </div>
            <h1 className="text-3xl font-bold md:text-4xl" style={{ color: colors.text }}>
              Choose how you want to learn.
            </h1>
            <p className="mt-3 max-w-2xl text-sm md:text-base" style={{ color: colors.textSecondary }}>
              Pick a full learning path or switch to individual courses.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full p-1" style={{ background: colors.cardBgStrong }}>
              <a href={`${basePath}/paths`} style={tabStyle(true)}>
                Learning Paths
              </a>
              <a href={`${basePath}/courses`} style={tabStyle(false)}>
                Courses
              </a>
              <a href={`${basePath}/saved`} style={tabStyle(false)}>
                Saved
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeEnrollments.length > 0 && (
              <a
                href={`${basePath}/dashboard`}
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
                style={{ background: colors.accent, color: "#000" }}
              >
                Open Dashboard
                <ArrowRight className="h-4 w-4" />
              </a>
            )}
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

        <section className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="rounded-[28px] border p-6 md:p-7" style={{ borderColor: colors.border, background: colors.cardBg, boxShadow: colors.shadow }}>
            <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
              Not sure where to start?
            </h2>
            <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
              Tell us your goal and we&apos;ll point you to the best path and first courses to take.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {academyGoalOptions.map((goal) => {
                const isActive = selectedGoal === goal.id;
                return (
                  <button
                    key={goal.id}
                    onClick={() => setSelectedGoal(goal.id)}
                    className="rounded-[20px] border p-4 text-left transition-colors"
                    style={{
                      borderColor: isActive ? goal.color : colors.border,
                      background: isActive ? `${goal.color}16` : colors.cardBgStrong,
                    }}
                  >
                    <goal.icon className="h-5 w-5" style={{ color: goal.color }} />
                    <p className="mt-3 text-sm font-semibold" style={{ color: colors.text }}>
                      {goal.title}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: colors.textSecondary }}>
                      {goal.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[28px] border p-6 md:p-7" style={{ borderColor: colors.border, background: colors.cardBg, boxShadow: colors.shadow }}>
            {recommendedPathVisual && (
              <div className="relative mb-5 overflow-hidden rounded-[24px] border" style={{ borderColor: colors.border }}>
                <img
                  src={recommendedPathVisual.src}
                  alt={recommendedPath?.path.title ?? "Learning path"}
                  className="h-[210px] w-full object-cover"
                  onError={(event) => {
                    if (event.currentTarget.dataset.fallbackApplied === "true") {
                      return;
                    }
                    event.currentTarget.dataset.fallbackApplied = "true";
                    event.currentTarget.src = recommendedPathVisual.fallbackSrc;
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                <div className="absolute left-4 top-4 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ background: "rgba(15,23,42,0.65)", color: recommendedPathVisual.accent }}>
                  {recommendedPathVisual.eyebrow}
                </div>
              </div>
            )}
            <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
              Suggested plan
            </p>
            <div className="mt-3 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: colors.text }}>
                  {recommendedPath?.path.title ?? "Learning Path"}
                </h2>
                <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                  {recommendedPath?.path.description ?? "Pick a path to see a full plan of courses."}
                </p>
                {selectedGoalOption && (
                  <p className="mt-2 text-xs font-medium" style={{ color: colors.textMuted }}>
                    Based on your goal: {selectedGoalOption.title}
                  </p>
                )}
              </div>
              {recommendedPath && (
                <button
                  onClick={() => togglePathSaved(recommendedPath.path.slug)}
                  className="rounded-full p-2"
                  style={{ background: `${recommendedPath.path.color}18`, border: `1px solid ${colors.border}` }}
                  aria-label="Save learning path"
                >
                  <Heart
                    className="h-4 w-4"
                    style={{
                      color: recommendedPath.path.color,
                      fill: isPathSaved(recommendedPath.path.slug) ? recommendedPath.path.color : "transparent",
                    }}
                  />
                </button>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3 text-sm" style={{ color: colors.textSecondary }}>
              <span className="inline-flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                {recommendedPath?.includedCourses.length ?? 0} courses
              </span>
              <span className="inline-flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {recommendedPath ? getLearningPathDurationLabel(recommendedPath.path, courses) : "0 weeks"}
              </span>
              <span className="inline-flex items-center gap-2">
                <Target className="h-4 w-4" />
                {recommendedPath?.path.level ?? "Beginner"}
              </span>
            </div>

            {recommendedPaths.length > 1 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {recommendedPaths.slice(1).map((summary) => (
                  <span
                    key={summary.path.slug}
                    className="rounded-full px-3 py-1 text-xs font-medium"
                    style={{ background: colors.cardBgStrong, color: colors.textSecondary, border: `1px solid ${colors.border}` }}
                  >
                    Also fits: {summary.path.title}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                Recommended Courses
              </p>
              <div className="space-y-2">
                {recommendedCourses.map((course) => {
                  const visual = getCourseCardArt(course);
                  return (
                  <div
                    key={course.id}
                    className="rounded-2xl border px-4 py-3"
                    style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={visual.src}
                        alt={course.title}
                        className="h-16 w-20 rounded-2xl object-cover"
                        onError={(event) => {
                          if (event.currentTarget.dataset.fallbackApplied === "true") {
                            return;
                          }
                          event.currentTarget.dataset.fallbackApplied = "true";
                          event.currentTarget.src = visual.fallbackSrc;
                        }}
                      />
                      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: colors.text }}>
                            {course.title}
                          </p>
                          <p className="mt-1 text-xs" style={{ color: colors.textSecondary }}>
                            {course.level || "Beginner"}{course.duration ? ` · ${course.duration}` : ""}
                          </p>
                        </div>
                        <a
                          href={`${basePath}/courses/${course.id}`}
                          className="text-xs font-semibold"
                          style={{ color: colors.accent }}
                        >
                          Learn More
                        </a>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={recommendedPath ? `${basePath}/paths/${recommendedPath.path.slug}` : `${basePath}/paths`}
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
                style={{ background: colors.cardBgStrong, color: colors.text, border: `1px solid ${colors.border}` }}
              >
                Learn More
              </a>
              <a
                href={recommendedPath ? `${basePath}/paths/${recommendedPath.path.slug}/enroll` : `${basePath}/paths`}
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
                style={{ background: colors.accent, color: "#000" }}
              >
                Enroll Now
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                Learning Paths
              </h2>
              {generatedPathSummaries.length > 0 && (
                <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                  New instructor-created learning paths appear first below so learners can open them right away.
                </p>
              )}
            </div>
            <p className="text-sm" style={{ color: colors.textMuted }}>
              {loading || learningPathsLoading ? "Loading..." : `${pathSummaries.length} paths available`}
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            {orderedPathSummaries.map((summary) => {
              const visual = getLearningPathCardArt(summary.path);

              return (
                <article
                  key={summary.path.slug}
                  className="rounded-[26px] border p-6"
                  style={{ borderColor: colors.border, background: colors.cardBg, boxShadow: colors.shadow }}
                >
                  <div className="relative mb-5 overflow-hidden rounded-[24px] border" style={{ borderColor: colors.border }}>
                    <img
                      src={visual.src}
                      alt={summary.path.title}
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
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-xl"
                        style={{ background: `${summary.path.color}18` }}
                      >
                        <summary.path.icon className="h-6 w-6" style={{ color: summary.path.color }} />
                      </div>
                      {summary.path.source === "generated" && (
                        <span
                          className="mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                          style={{ background: `${summary.path.color}18`, color: summary.path.color }}
                        >
                          New Path
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => togglePathSaved(summary.path.slug)}
                      className="rounded-full p-2"
                      style={{ background: `${summary.path.color}18`, border: `1px solid ${colors.border}` }}
                      aria-label="Save learning path"
                    >
                      <Heart
                        className="h-4 w-4"
                        style={{
                          color: summary.path.color,
                          fill: isPathSaved(summary.path.slug) ? summary.path.color : "transparent",
                        }}
                      />
                    </button>
                  </div>
                  <h3 className="text-2xl font-semibold" style={{ color: colors.text }}>
                    {summary.path.title}
                  </h3>
                  <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                    {summary.path.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3 text-xs" style={{ color: colors.textMuted }}>
                    <span>{summary.path.level}</span>
                    <span>{getLearningPathDurationLabel(summary.path, courses)}</span>
                    <span>{summary.includedCourses.length} courses</span>
                  </div>

                  <div className="mt-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                      Included courses
                    </p>
                    <div className="space-y-2">
                      {summary.includedCourses.slice(0, 3).map((course) => (
                        <div
                          key={course.id}
                          className="rounded-2xl border px-4 py-3 text-sm"
                          style={{ borderColor: colors.border, background: colors.cardBgStrong, color: colors.text }}
                        >
                          {course.title}
                        </div>
                      ))}
                    </div>
                  </div>

                  {summary.progress > 0 && (
                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span style={{ color: colors.textSecondary }}>Progress</span>
                        <span style={{ color: summary.path.color }}>{summary.progress}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full" style={{ background: "rgba(255,255,255,0.12)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${summary.progress}%`, background: summary.path.color }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href={`${basePath}/paths/${summary.path.slug}`}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                      style={{ background: colors.cardBgStrong, color: colors.text, border: `1px solid ${colors.border}` }}
                    >
                      Learn More
                    </a>
                    <a
                      href={`${basePath}/paths/${summary.path.slug}/enroll`}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                      style={{ background: summary.path.color, color: "#fff" }}
                    >
                      {summary.enrolledCourses > 0 ? "Continue" : "Enroll Now"}
                      <ArrowRight className="h-4 w-4" />
                    </a>
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

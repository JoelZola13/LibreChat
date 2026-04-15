import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock, Map, Target, Video } from "lucide-react";
import { useLocation, useParams } from "react-router-dom";
import { sbFetch } from "../shared/sbFetch";
import {
  getAcademyLearningPathFromCollection,
  getLearningPathDurationLabel,
  resolveLearningPathCourses,
} from "./academyLearningPaths";
import { useAcademyLearningPaths } from "./useAcademyLearningPaths";
import { useAcademyUserId } from "./useAcademyUserId";

type Course = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  duration?: string | null;
  level?: string | null;
};

type Enrollment = {
  course_id: string;
  progress_percent: number;
  status?: string;
};

export default function AcademyPathDetailPage() {
  const { slug } = useParams();
  const location = useLocation();
  const basePath = location.pathname.startsWith("/learning") ? "/learning" : "/academy";
  const userId = useAcademyUserId();
  const { paths: learningPaths, loading: learningPathsLoading } = useAcademyLearningPaths();
  const path = getAcademyLearningPathFromCollection(slug, learningPaths);
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";

  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  const colors = useMemo(
    () => ({
      bg: "var(--sb-color-background)",
      cardBg: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.4)",
      cardBgStrong: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(255,255,255,0.58)",
      border: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)",
      text: isDark ? "#fff" : "#111",
      textSecondary: isDark ? "rgba(255,255,255,0.72)" : "#4b5563",
      textMuted: isDark ? "rgba(255,255,255,0.52)" : "#6b7280",
      accent: path?.color ?? "#FFD600",
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
  }, [path, userId]);

  const activeEnrollments = useMemo(
    () => enrollments.filter((entry) => entry.status !== "dropped"),
    [enrollments],
  );

  const pathCourses = useMemo(() => {
    return path ? resolveLearningPathCourses(path, courses) : [];
  }, [courses, path]);

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
      return "0 weeks";
    }
    return getLearningPathDurationLabel(path, courses);
  }, [courses, path]);

  const pathOverviewParagraphs = useMemo(() => {
    if (!path) {
      return [];
    }

    const sampleCourses = pathCourses.slice(0, 3).map((course) => course.title).join(", ");

    return [
      `${path.title} is designed as a guided program, not just a list of classes. It gives learners a clear order to follow, a manageable pace, and a focused outcome at the end of the plan.`,
      sampleCourses
        ? `Inside this path, learners move through courses like ${sampleCourses}. The full program is built for ${path.level.toLowerCase()} learners and can be joined ${path.deliveryMode.toLowerCase()}.`
        : `This plan is built for ${path.level.toLowerCase()} learners and can be joined ${path.deliveryMode.toLowerCase()}.`,
    ];
  }, [path, pathCourses]);

  if (!path && learningPathsLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--sb-color-background)", padding: "88px 24px 40px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div className="h-64 rounded-[28px] border" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }} />
        </div>
      </div>
    );
  }

  if (!path && !learningPathsLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--sb-color-background)", padding: "88px 24px 40px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div className="rounded-3xl border p-10 text-center" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}>
            <Map className="mx-auto mb-4 h-12 w-12" style={{ color: "#8B5CF6" }} />
            <h1 className="text-3xl font-bold text-white">Learning path not found</h1>
            <p className="mt-3 text-sm text-white/70">This path is not available in the current Academy catalog.</p>
            <a href={`${basePath}/paths`} className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold" style={{ background: "#8B5CF6", color: "#fff" }}>
              Back to learning paths
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, padding: "88px 24px 40px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <a href={`${basePath}/paths`} className="text-sm font-medium hover:opacity-80" style={{ color: colors.textSecondary }}>
            Learning Paths
          </a>
          <span style={{ color: colors.textMuted }}>/</span>
          <span className="text-sm font-medium" style={{ color: colors.accent }}>{path.title}</span>
        </div>

        <section className="rounded-[28px] border p-8" style={{ borderColor: colors.border, background: colors.cardBg, backdropFilter: "blur(20px)" }}>
          <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
            <div>
              <div className="mb-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{ background: `${path.color}20`, color: path.color }}>
                Street Voices Academy Path
              </div>
              <h1 className="text-4xl font-bold" style={{ color: colors.text }}>{path.title}</h1>
              <p className="mt-4 text-base" style={{ color: colors.textSecondary }}>{path.description}</p>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm" style={{ color: colors.textSecondary }}>
                <span className="inline-flex items-center gap-2"><Target className="h-4 w-4" />{path.level}</span>
                <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4" />{pathDurationLabel}</span>
                <span className="inline-flex items-center gap-2"><Video className="h-4 w-4" />{path.deliveryMode}</span>
              </div>
            </div>

            <div className="rounded-[24px] border p-5" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
              <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>Path details</p>
              <div className="mt-4 space-y-3 text-sm" style={{ color: colors.textSecondary }}>
                <div className="flex items-center justify-between gap-3">
                  <span>Included courses</span>
                  <strong style={{ color: colors.text }}>{pathCourses.length}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Progress</span>
                  <strong style={{ color: colors.text }}>{pathProgress}%</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Next step</span>
                  <strong style={{ color: colors.text }}>{nextCourse?.title ?? "Choose a course"}</strong>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={`${basePath}/paths/${path.slug}/enroll`}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                  style={{ background: path.color, color: "#fff" }}
                >
                  Enroll Now
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href={nextCourse ? `${basePath}/courses/${nextCourse.id}` : `${basePath}/courses`}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                  style={{ background: colors.cardBgStrong, color: colors.text, border: `1px solid ${colors.border}` }}
                >
                  View Courses
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>Path Overview</h2>
          <div className="mt-4 space-y-4">
            {pathOverviewParagraphs.map((paragraph) => (
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
              {path.requirements.map((requirement) => (
                <li key={requirement} className="flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: colors.border }}>
                  <CheckCircle2 className="mt-0.5 h-5 w-5" style={{ color: path.color }} />
                  <span className="text-sm" style={{ color: colors.textSecondary }}>{requirement}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
            <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>What you&apos;ll learn</h2>
            <ul className="mt-5 space-y-3">
              {path.whatYoullLearn.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: colors.border }}>
                  <CheckCircle2 className="mt-0.5 h-5 w-5" style={{ color: path.color }} />
                  <span className="text-sm" style={{ color: colors.textSecondary }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-8 rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>Included courses</h2>
              <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                {loading ? "Loading courses..." : "This is the step-by-step course plan for this path."}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {pathCourses.map((course, index) => {
              const enrollment = activeEnrollments.find((entry) => entry.course_id === course.id);
              return (
                <article
                  key={course.id}
                  className="rounded-[24px] border p-5"
                  style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                >
                  <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>Course {index + 1}</p>
                  <h3 className="mt-2 text-lg font-semibold" style={{ color: colors.text }}>{course.title}</h3>
                  <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                    {course.description || "Open the course page for full details, requirements, and enrollment."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs" style={{ color: colors.textMuted }}>
                    <span>{course.level ? course.level.charAt(0).toUpperCase() + course.level.slice(1) : "Beginner"}</span>
                    <span>{course.duration || "Self-paced"}</span>
                    <span>{enrollment ? `${enrollment.progress_percent}% complete` : "Not enrolled yet"}</span>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <a
                      href={`${basePath}/courses/${course.id}`}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                      style={{ background: colors.cardBg, color: colors.text, border: `1px solid ${colors.border}` }}
                    >
                      Learn More
                    </a>
                    <a
                      href={enrollment ? `${basePath}/courses/${course.id}` : `${basePath}/courses/${course.id}/enroll`}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                      style={{ background: path.color, color: "#fff" }}
                    >
                      {enrollment ? "Open Course" : "Enroll Now"}
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </article>
              );
            })}

            {!loading && pathCourses.length === 0 && (
              <div className="rounded-[24px] border p-6 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                No courses are connected to this path yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

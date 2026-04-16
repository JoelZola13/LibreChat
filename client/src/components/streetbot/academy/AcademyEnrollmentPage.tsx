import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock, Video } from "lucide-react";
import { useLocation, useParams } from "react-router-dom";
import { useAuthContext } from "~/hooks/AuthContext";
import { sbFetch } from "../shared/sbFetch";
import { ensureStreetProfileForAcademyUser } from "../profile/academyProfileSync";
import {
  getAcademyLearningPathFromCollection,
  getLearningPathDurationLabel,
  resolveLearningPathCourses,
} from "./academyLearningPaths";
import { useAcademyLearningPaths } from "./useAcademyLearningPaths";
import { useAcademyUserId } from "./useAcademyUserId";
import {
  formatCourseLevel,
  getCourseCohortMeta,
  getCourseDeliveryMode,
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
  state?: "draft" | "published" | "archived";
};

type Enrollment = {
  course_id: string;
  status?: string;
};

export default function AcademyEnrollmentPage() {
  const { slug, courseId } = useParams();
  const location = useLocation();
  const { user } = useAuthContext();
  const basePath = location.pathname.startsWith("/learning") ? "/learning" : "/academy";
  const userId = useAcademyUserId();
  const { paths: learningPaths, loading: learningPathsLoading } = useAcademyLearningPaths();
  const path = getAcademyLearningPathFromCollection(slug, learningPaths);
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";

  const [course, setCourse] = useState<Course | null>(null);
  const [catalogCourses, setCatalogCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const colors = useMemo(
    () => ({
      bg: "var(--sb-color-background)",
      cardBg: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.42)",
      cardBgStrong: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.58)",
      border: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)",
      text: isDark ? "#fff" : "#111",
      textSecondary: isDark ? "rgba(255,255,255,0.72)" : "#4b5563",
      textMuted: isDark ? "rgba(255,255,255,0.5)" : "#6b7280",
      accent: path?.color ?? "#FFD600",
    }),
    [isDark, path],
  );

  useEffect(() => {
    async function load() {
      try {
        const requests: Promise<Response>[] = [
          sbFetch("/api/academy/courses"),
          sbFetch(`/api/academy/enrollments?user_id=${encodeURIComponent(userId)}`),
        ];

        if (courseId) {
          requests.push(sbFetch(`/api/academy/courses/${courseId}`));
        }

        const responses = await Promise.all(requests);
        const [catalogResp, enrollmentsResp, courseResp] = responses;

        if (catalogResp.ok) {
          const catalogData = await catalogResp.json();
          const courseData = Array.isArray(catalogData) ? catalogData : [];
          setCatalogCourses(courseData.filter((item: Course) => !item.state || item.state === "published"));
        }

        if (enrollmentsResp.ok) {
          const enrollmentData = await enrollmentsResp.json();
          setEnrollments(Array.isArray(enrollmentData) ? enrollmentData : []);
        }

        if (courseResp?.ok) {
          const courseData = await courseResp.json();
          setCourse(courseData);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [courseId, userId]);

  const activeEnrollments = useMemo(
    () => enrollments.filter((enrollment) => enrollment.status !== "dropped"),
    [enrollments],
  );

  const targetCourses = useMemo(() => {
    if (path) {
      return resolveLearningPathCourses(path, catalogCourses);
    }

    return course ? [course] : [];
  }, [catalogCourses, course, path]);

  const enrolledCourseIds = useMemo(
    () => new Set(activeEnrollments.map((enrollment) => enrollment.course_id)),
    [activeEnrollments],
  );

  const pendingCourses = useMemo(
    () => targetCourses.filter((item) => !enrolledCourseIds.has(item.id)),
    [enrolledCourseIds, targetCourses],
  );

  const detailTitle = path?.title ?? course?.title ?? "Academy enrollment";
  const detailDescription =
    path?.description ??
    course?.description ??
    "Confirm enrollment to start learning and unlock your next Academy steps.";

  const detailRequirements = path?.requirements ?? (course ? getCourseRequirements(course) : []);
  const detailLearningPoints = path?.whatYoullLearn ?? (course ? getCourseLearningPoints(course) : []);
  const detailLevel = path?.level ?? formatCourseLevel(course?.level);
  const cohortMeta = getCourseCohortMeta(course?.id);
  const detailDuration = path ? getLearningPathDurationLabel(path, catalogCourses) : cohortMeta.durationLabel;
  const detailDelivery = path?.deliveryMode ?? getCourseDeliveryMode({ sessionCount: 1, cohortCount: 1 });

  const handleConfirmEnrollment = async () => {
    if (targetCourses.length === 0) {
      setMessage("This selection is not ready for enrollment yet.");
      return;
    }

    if (pendingCourses.length === 0) {
      window.location.href = `${basePath}/dashboard`;
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      for (const item of pendingCourses) {
        await sbFetch("/api/academy/enrollments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ course_id: item.id, user_id: userId }),
        });
      }

      await ensureStreetProfileForAcademyUser({
        userId,
        user,
        roleHint: "student",
        force: true,
      });

      setMessage("Enrollment complete. Opening your dashboard...");
      window.setTimeout(() => {
        window.location.href = `${basePath}/dashboard`;
      }, 500);
    } catch {
      setMessage("We couldn’t complete enrollment just yet. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!loading && !learningPathsLoading && !path && !course) {
    return (
      <div style={{ minHeight: "100vh", background: colors.bg, padding: "88px 24px 40px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div className="rounded-[28px] border p-10 text-center" style={{ borderColor: colors.border, background: colors.cardBg }}>
            <h1 className="text-3xl font-bold" style={{ color: colors.text }}>Enrollment page not found</h1>
            <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
              The path or course you selected is not available right now.
            </p>
            <a href={`${basePath}/paths`} className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold" style={{ background: colors.accent, color: "#000" }}>
              Back to Academy
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (learningPathsLoading && slug && !path) {
    return (
      <div style={{ minHeight: "100vh", background: colors.bg, padding: "88px 24px 40px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div className="h-64 rounded-[28px]" style={{ background: colors.cardBg, border: `1px solid ${colors.border}` }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, padding: "88px 24px 40px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <a href={`${basePath}/paths`} className="text-sm font-medium hover:opacity-80" style={{ color: colors.textSecondary }}>
            Academy
          </a>
          <span style={{ color: colors.textMuted }}>/</span>
          <span className="text-sm font-medium" style={{ color: colors.accent }}>
            Enroll
          </span>
        </div>

        <section className="rounded-[28px] border p-8" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <div>
              <div className="mb-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{ background: `${colors.accent}20`, color: colors.accent }}>
                Confirm enrollment
              </div>
              <h1 className="text-4xl font-bold" style={{ color: colors.text }}>
                {detailTitle}
              </h1>
              <p className="mt-4 text-base" style={{ color: colors.textSecondary }}>
                {detailDescription}
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm" style={{ color: colors.textSecondary }}>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{detailLevel}</span>
                <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4" />{detailDuration}</span>
                <span className="inline-flex items-center gap-2"><Video className="h-4 w-4" />{detailDelivery}</span>
              </div>
            </div>

            <div className="rounded-[24px] border p-5" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
              <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>What happens next</p>
              <div className="mt-4 space-y-3 text-sm" style={{ color: colors.textSecondary }}>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4" style={{ color: colors.accent }} />
                  <span>You’ll unlock your Dashboard and Live pages.</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4" style={{ color: colors.accent }} />
                  <span>You’ll see your recommended next course right away.</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4" style={{ color: colors.accent }} />
                  <span>{path ? `This will enroll you in ${targetCourses.length} courses in the path.` : "This will enroll you in the selected course."}</span>
                </div>
              </div>

              {message && (
                <div className="mt-5 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                  {message}
                </div>
              )}

              <button
                onClick={handleConfirmEnrollment}
                disabled={submitting || loading || targetCourses.length === 0}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
                style={{
                  background: colors.accent,
                  color: "#000",
                  border: "none",
                  opacity: submitting || targetCourses.length === 0 ? 0.7 : 1,
                }}
              >
                {pendingCourses.length === 0 ? "Open Dashboard" : "Confirm Enrollment"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
            <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>Requirements</h2>
            <ul className="mt-5 space-y-3">
              {detailRequirements.map((requirement) => (
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
              {detailLearningPoints.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: colors.border }}>
                  <CheckCircle2 className="mt-0.5 h-5 w-5" style={{ color: colors.accent }} />
                  <span className="text-sm" style={{ color: colors.textSecondary }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-8 rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
            {path ? "Included courses" : "Selected course"}
          </h2>
          <div className="mt-5 space-y-3">
            {targetCourses.map((item) => (
              <div key={item.id} className="rounded-2xl border px-4 py-4" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: colors.text }}>{item.title}</p>
                    <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                      {item.description || "Open the course page for the full overview."}
                    </p>
                  </div>
                  <div className="text-xs" style={{ color: colors.textMuted }}>
                    {enrolledCourseIds.has(item.id) ? "Already enrolled" : "Ready to enroll"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

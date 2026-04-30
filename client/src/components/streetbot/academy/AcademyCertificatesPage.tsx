import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useOutletContext } from "react-router-dom";
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Compass,
  Copy,
  LayoutDashboard,
  Target,
} from "lucide-react";
import type { ContextType } from "~/common";
import { NAV_WIDTH } from "~/components/Nav";
import { DashboardSkeleton } from ".";
import { sbFetch } from "../shared/sbFetch";
import { getLearningPathDurationLabel, resolveLearningPathCourses } from "./academyLearningPaths";
import { useAcademyLearningPaths } from "./useAcademyLearningPaths";
import { useAcademyUserId } from "./useAcademyUserId";

type Course = {
  id: string;
  title: string;
  description?: string | null;
  level?: string | null;
  duration?: string | null;
  category?: string | null;
  instructor?: string | null;
  instructor_name?: string | null;
  state?: "draft" | "published" | "archived";
};

type Enrollment = {
  id: string;
  user_id: string;
  course_id: string;
  status: "active" | "completed" | "dropped";
  progress_percent: number;
  last_accessed_at?: string | null;
};

type Certificate = {
  id: string;
  user_id: string;
  recipient_name?: string | null;
  course_id?: string | null;
  learning_path_id?: string | null;
  target_type?: "course" | "learning_path";
  target_id?: string | null;
  target_title?: string | null;
  certificate_title?: string | null;
  issuer_name?: string | null;
  signature_name?: string | null;
  award_date?: string | null;
  certificate_url?: string | null;
  badge_url?: string | null;
  verification_code: string;
  issued_at: string;
  updated_at?: string | null;
  expires_at?: string | null;
};

function useResponsive() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
  };
}

function UnifiedLayout({ children, bgToUse }: { children: ReactNode; bgToUse?: string }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: bgToUse || "var(--sb-color-background, #0f0f19)",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function formatDate(isoDate?: string | null) {
  if (!isoDate) {
    return "Recently issued";
  }

  return new Date(isoDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function dedupeCertificates(certificates: Certificate[]) {
  return Array.from(
    new Map(
      certificates.map((certificate) => {
        const type = certificate.target_type || (certificate.learning_path_id ? "learning_path" : "course");
        const targetId = certificate.target_id || certificate.learning_path_id || certificate.course_id || certificate.id;
        return [`${type}:${targetId}`, certificate];
      }),
    ).values(),
  );
}

async function fetchCourses(): Promise<Course[]> {
  const response = await sbFetch("/api/academy/courses");
  if (!response.ok) {
    throw new Error("Failed to fetch courses");
  }
  const data = await response.json();
  return Array.isArray(data) ? data : data.courses || [];
}

export default function AcademyCertificatesPage() {
  const userId = useAcademyUserId();
  const location = useLocation();
  const { paths: learningPaths } = useAcademyLearningPaths();
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const outletContext = useOutletContext<ContextType | undefined>();
  const navVisible = outletContext?.navVisible ?? false;
  const academyBasePath = location.pathname.startsWith("/learning") ? "/learning" : "/academy";

  const pagePaddingX = isMobile ? "16px" : isTablet ? "24px" : "32px";
  const collapsedNavRailWidth = 56;
  const desktopNavInset = isDesktop ? (navVisible ? NAV_WIDTH.DESKTOP : collapsedNavRailWidth) : 0;
  const desktopHeaderGap = navVisible ? 24 : 10;
  const navPaddingLeft = isDesktop ? `${desktopNavInset + desktopHeaderGap}px` : pagePaddingX;
  const contentPaddingLeft = isDesktop ? `${desktopNavInset + 24}px` : pagePaddingX;

  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCertificateId, setCopiedCertificateId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const storedName = localStorage.getItem("sv_user_name");
    if (storedName) {
      setUserName(storedName);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const [courseData, enrollmentsResp, certificatesResp] = await Promise.all([
          fetchCourses().catch(() => []),
          sbFetch(`/api/academy/enrollments?user_id=${encodeURIComponent(userId)}`),
          sbFetch(`/api/academy/certificates/${encodeURIComponent(userId)}`),
        ]);

        if (!isMounted) {
          return;
        }

        const enrollmentData = enrollmentsResp.ok ? await enrollmentsResp.json() : [];
        const activeEnrollmentData = Array.isArray(enrollmentData) ? enrollmentData : [];
        const completedCourseIds = activeEnrollmentData
          .filter(
            (enrollment: Enrollment) =>
              enrollment.status !== "dropped" &&
              (enrollment.status === "completed" || enrollment.progress_percent >= 100),
          )
          .map((enrollment: Enrollment) => enrollment.course_id);

        let certificateData = certificatesResp.ok ? await certificatesResp.json() : [];
        certificateData = Array.isArray(certificateData) ? certificateData : [];

        const existingCertificateIds = new Set(
          certificateData.map((certificate: Certificate) => certificate.course_id),
        );
        const missingCertificateIds = completedCourseIds.filter((courseId) => !existingCertificateIds.has(courseId));

        if (missingCertificateIds.length > 0) {
          const autoIssuedCertificates = await Promise.all(
            missingCertificateIds.map(async (courseId) => {
              const response = await sbFetch(
                `/api/academy/certificates/auto-issue?user_id=${encodeURIComponent(userId)}&course_id=${encodeURIComponent(courseId)}`,
                { method: "POST" },
              );
              return response.ok ? ((await response.json()) as Certificate) : null;
            }),
          );

          certificateData = dedupeCertificates([
            ...certificateData,
            ...autoIssuedCertificates.filter(Boolean) as Certificate[],
          ]);
        }

        if (!isMounted) {
          return;
        }

        setCourses(courseData);
        setEnrollments(activeEnrollmentData);
        setCertificates(certificateData);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const colors = useMemo(
    () => ({
      bg: "var(--sb-color-background)",
      surface: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.25)",
      border: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.5)",
      text: isDark ? "#fff" : "#111",
      textSecondary: isDark ? "rgba(255, 255, 255, 0.7)" : "#4b5563",
      textMuted: isDark ? "rgba(255, 255, 255, 0.5)" : "#6b7280",
      accent: "#FFD600",
      cardBg: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.3)",
      cardBgStrong: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.5)",
      glassShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.3)" : "0 8px 32px rgba(31, 38, 135, 0.15)",
    }),
    [isDark],
  );

  const publishedCourses = useMemo(
    () => courses.filter((course) => !course.state || course.state === "published"),
    [courses],
  );

  const activeEnrollments = useMemo(
    () => enrollments.filter((enrollment) => enrollment.status !== "dropped"),
    [enrollments],
  );

  const hasEnrollment = activeEnrollments.length > 0;

  const completedEnrollments = useMemo(
    () =>
      activeEnrollments.filter(
        (enrollment) => enrollment.status === "completed" || enrollment.progress_percent >= 100,
      ),
    [activeEnrollments],
  );

  const completedCourseIds = useMemo(
    () => new Set(completedEnrollments.map((enrollment) => enrollment.course_id)),
    [completedEnrollments],
  );

  const enrolledCourseIds = useMemo(
    () => new Set(activeEnrollments.map((enrollment) => enrollment.course_id)),
    [activeEnrollments],
  );

  const courseById = useMemo(
    () => new Map(publishedCourses.map((course) => [course.id, course])),
    [publishedCourses],
  );

  const earnedCertificates = useMemo(
    () =>
      [...certificates].sort(
        (left, right) =>
          new Date(right.updated_at || right.issued_at).getTime() -
          new Date(left.updated_at || left.issued_at).getTime(),
      ),
    [certificates],
  );

  const completedCourses = useMemo(
    () => publishedCourses.filter((course) => completedCourseIds.has(course.id)),
    [completedCourseIds, publishedCourses],
  );

  const completedPathSummaries = useMemo(() => {
    return learningPaths
      .map((path) => {
        const includedCourses = resolveLearningPathCourses(path, publishedCourses);
        const isComplete =
          includedCourses.length > 0 &&
          includedCourses.every(
            (course) => enrolledCourseIds.has(course.id) && completedCourseIds.has(course.id),
          );

        return {
          path,
          includedCourses,
          isComplete,
        };
      })
      .filter((summary) => summary.isComplete);
  }, [completedCourseIds, enrolledCourseIds, learningPaths, publishedCourses]);

  const dashboardStats = useMemo(
    () => [
      { label: "Certificates", value: `${earnedCertificates.length}`, icon: Award, color: "#F59E0B" },
      { label: "Passed Courses", value: `${completedCourses.length}`, icon: CheckCircle2, color: "#10B981" },
      { label: "Completed Paths", value: `${completedPathSummaries.length}`, icon: Target, color: "#8B5CF6" },
    ],
    [completedCourses.length, completedPathSummaries.length, earnedCertificates.length],
  );

  const navLinks = [
    { href: `${academyBasePath}`, label: "Home", icon: Compass },
    { href: `${academyBasePath}/paths`, label: "Programs", icon: Target },
    { href: `${academyBasePath}/courses`, label: "Courses", icon: BookOpen },
    { href: `${academyBasePath}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
    { href: `${academyBasePath}/certificates`, label: "Certificates", icon: Award },
  ];

  const copyCode = async (certificateId: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCertificateId(certificateId);
      window.setTimeout(() => setCopiedCertificateId((current) => (current === certificateId ? null : current)), 1800);
    } catch {
      setCopiedCertificateId(null);
    }
  };

  const backgroundOrbs = (
    <>
      <div
        style={{
          position: "fixed",
          top: "-30%",
          left: "30%",
          width: "800px",
          height: "800px",
          background: isDark
            ? "radial-gradient(circle, rgba(139, 92, 246, 0.5) 0%, rgba(139, 92, 246, 0.2) 30%, transparent 60%)"
            : "radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.1) 30%, transparent 60%)",
          pointerEvents: "none",
          zIndex: 0,
          filter: "blur(40px)",
        }}
        aria-hidden="true"
      />
      <div
        style={{
          position: "fixed",
          top: "25%",
          right: "-10%",
          width: "580px",
          height: "580px",
          background: isDark
            ? "radial-gradient(circle, rgba(245, 158, 11, 0.36) 0%, rgba(245, 158, 11, 0.12) 30%, transparent 60%)"
            : "radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, rgba(245, 158, 11, 0.08) 30%, transparent 60%)",
          pointerEvents: "none",
          zIndex: 0,
          filter: "blur(60px)",
        }}
        aria-hidden="true"
      />
      <div
        style={{
          position: "fixed",
          bottom: "-10%",
          left: "-10%",
          width: "700px",
          height: "700px",
          background: isDark
            ? "radial-gradient(circle, rgba(6, 182, 212, 0.35) 0%, rgba(6, 182, 212, 0.1) 30%, transparent 60%)"
            : "radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, rgba(6, 182, 212, 0.05) 30%, transparent 60%)",
          pointerEvents: "none",
          zIndex: 0,
          filter: "blur(50px)",
        }}
        aria-hidden="true"
      />
    </>
  );

  const topNav = (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: colors.surface,
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        borderBottom: `1px solid ${colors.border}`,
        boxShadow: colors.glassShadow,
      }}
    >
      <div
        className="w-full pr-4 sm:pr-6 lg:pr-8"
        style={{
          paddingLeft: navPaddingLeft,
          paddingRight: pagePaddingX,
          transition: "padding-left 0.2s ease-out",
        }}
      >
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="hidden min-w-[140px] md:block">
            <span className="text-sm font-semibold" style={{ color: colors.text }}>
              Certificates
            </span>
          </div>

          <div className="flex items-center gap-4 overflow-x-auto md:hidden">
            {navLinks.map((item) => {
              const isRootAcademyLink = item.href === academyBasePath;
              const isActive = isRootAcademyLink
                ? location.pathname === item.href
                : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap text-sm transition-colors"
                  style={{ color: isActive ? colors.text : colors.textSecondary }}
                >
                  {item.label}
                </a>
              );
            })}
          </div>

          <div className="hidden items-center gap-6 md:flex">
            {navLinks.map((item) => {
              const isRootAcademyLink = item.href === academyBasePath;
              const isActive = isRootAcademyLink
                ? location.pathname === item.href
                : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className="transition-colors"
                  style={{ color: isActive ? colors.text : colors.textSecondary }}
                >
                  {item.label}
                </a>
              );
            })}
          </div>

          <div className="w-10 min-w-[140px] text-right md:w-auto">
            <a
              href={`${academyBasePath}/instructor`}
              className="hidden text-sm font-medium md:inline-flex"
              style={{ color: "#C084FC" }}
            >
              Instructor Workspace
            </a>
          </div>
        </div>
      </div>
    </nav>
  );

  return (
    <UnifiedLayout bgToUse={colors.bg}>
      {backgroundOrbs}
      {topNav}

      <div
        className="pb-8 pt-24"
        style={{
          paddingLeft: contentPaddingLeft,
          paddingRight: pagePaddingX,
          transition: "padding-left 0.2s ease-out",
        }}
      >
        <div className="w-full min-w-0">
          {loading ? (
            <DashboardSkeleton />
          ) : !hasEnrollment ? (
            <section>
              <div
                className="rounded-[28px] border p-8 text-center md:p-10"
                style={{
                  borderColor: colors.border,
                  background: colors.cardBg,
                  backdropFilter: "blur(24px)",
                  boxShadow: colors.glassShadow,
                }}
              >
                <div
                  className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: "rgba(245,158,11,0.14)" }}
                >
                  <Award className="h-7 w-7" style={{ color: "#F59E0B" }} />
                </div>
                <h1 className="text-3xl font-bold md:text-4xl" style={{ color: colors.text }}>
                  Enroll to unlock your certificates
                </h1>
                <p className="mx-auto mt-3 max-w-2xl text-sm md:text-base" style={{ color: colors.textSecondary }}>
                  Finish your courses first, then your passed classes and certificates will show up here.
                </p>
                <a
                  href={`${academyBasePath}/paths`}
                  className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
                  style={{ background: colors.accent, color: "#000" }}
                >
                  Choose a path
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </section>
          ) : (
            <>
              <section className="mb-8">
                <div
                  className="rounded-[28px] border p-6 md:p-8"
                  style={{
                    borderColor: colors.border,
                    background: colors.cardBg,
                    backdropFilter: "blur(24px)",
                    boxShadow: colors.glassShadow,
                  }}
                >
                  <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
                    <div>
                      <div
                        className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                        style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}
                      >
                        <Award className="h-3.5 w-3.5" />
                        Certificates
                      </div>
                      <h1 className="text-3xl font-bold md:text-4xl" style={{ color: colors.text }}>
                        {userName ? `${userName}'s achievements` : "Your achievements"}
                      </h1>
                      <p className="mt-3 max-w-2xl text-base" style={{ color: colors.textSecondary }}>
                        See the courses you passed, the certificates you earned, and the programs you completed.
                      </p>
                    </div>

                    <div
                      className="rounded-[24px] border p-5"
                      style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                    >
                      <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                        Keep going
                      </p>
                      <h2 className="mt-2 text-xl font-semibold" style={{ color: colors.text }}>
                        Your dashboard stays connected
                      </h2>
                      <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                        Passed classes here stay aligned with the same curriculum, live sessions, materials, assignments,
                        and instructor discussions inside your student dashboard.
                      </p>
                      <a
                        href={`${academyBasePath}/dashboard`}
                        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"
                        style={{ color: colors.accent }}
                      >
                        Open dashboard
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-3 lg:gap-6">
                {dashboardStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[24px] border"
                    style={{
                      background: colors.cardBg,
                      backdropFilter: "blur(24px)",
                      borderRadius: isMobile ? "16px" : "24px",
                      border: `1px solid ${colors.border}`,
                      padding: isMobile ? "16px" : "24px",
                      boxShadow: colors.glassShadow,
                    }}
                  >
                    <div
                      className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                      style={{ background: `${stat.color}20` }}
                    >
                      <stat.icon className="h-6 w-6" style={{ color: stat.color }} />
                    </div>
                    <div className="text-3xl font-bold" style={{ color: colors.text }}>
                      {stat.value}
                    </div>
                    <div className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </section>

              <section className="mb-8">
                <div
                  className="rounded-[28px] border p-6 md:p-7"
                  style={{ borderColor: colors.border, background: colors.cardBg, boxShadow: colors.glassShadow }}
                >
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                        Earned certificates
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold" style={{ color: colors.text }}>
                        Certificates you’ve earned
                      </h2>
                    </div>
                    <a
                      href={`${academyBasePath}/dashboard`}
                      className="text-sm font-semibold"
                      style={{ color: colors.accent }}
                    >
                      Open student dashboard
                    </a>
                  </div>

                  {earnedCertificates.length === 0 ? (
                    <div
                      className="rounded-[22px] border p-6 text-sm"
                      style={{ borderColor: colors.border, background: colors.cardBgStrong, color: colors.textSecondary }}
                    >
                      Finish a course or receive an instructor-issued certificate to see it here.
                    </div>
                  ) : (
                    <div className="grid gap-4 xl:grid-cols-2">
                      {earnedCertificates.map((certificate) => {
                        const targetType = certificate.target_type || (certificate.learning_path_id ? "learning_path" : "course");
                        const course = certificate.course_id ? courseById.get(certificate.course_id) : null;
                        const path = targetType === "learning_path"
                          ? learningPaths.find(
                              (item) => item.slug === certificate.target_id || item.id === certificate.target_id,
                            ) ?? null
                          : null;
                        const awardTitle =
                          certificate.target_title ||
                          path?.title ||
                          course?.title ||
                          (targetType === "learning_path" ? "Completed program" : "Completed course");
                        const issuerName =
                          certificate.signature_name ||
                          certificate.issuer_name ||
                          course?.instructor_name ||
                          course?.instructor ||
                          "Street Voices Academy";
                        const targetHref =
                          targetType === "learning_path"
                            ? `${academyBasePath}/paths/${certificate.target_id || path?.slug || ""}`
                            : `${academyBasePath}/courses/${certificate.course_id || certificate.target_id || ""}`;

                        return (
                          <div
                            key={certificate.id}
                            className="rounded-[24px] border p-5"
                            style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div
                                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                                  style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  {targetType === "learning_path" ? "Program" : "Course"}
                                </div>
                                <h3 className="mt-3 text-xl font-semibold" style={{ color: colors.text }}>
                                  {awardTitle}
                                </h3>
                                <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                                  {certificate.recipient_name ? `${certificate.recipient_name} · ` : ""}
                                  Issued {formatDate(certificate.award_date || certificate.issued_at)} · {issuerName}
                                </p>
                              </div>
                              <span className="text-sm font-semibold" style={{ color: "#F59E0B" }}>
                                {certificate.certificate_title || "Certificate"}
                              </span>
                            </div>

                            <div className="mt-5 rounded-[20px] border p-4" style={{ borderColor: colors.border, background: colors.cardBg }}>
                              <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                                Verification code
                              </p>
                              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                                <span className="text-sm font-semibold" style={{ color: colors.text }}>
                                  {certificate.verification_code}
                                </span>
                                <button
                                  onClick={() => copyCode(certificate.id, certificate.verification_code)}
                                  className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold"
                                  style={{ background: colors.cardBgStrong, color: colors.text }}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  {copiedCertificateId === certificate.id ? "Copied" : "Copy"}
                                </button>
                              </div>
                            </div>

                            <div className="mt-5 flex flex-wrap gap-3">
                              <a
                                href={targetHref}
                                className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                                style={{ background: colors.cardBg, color: colors.text, border: `1px solid ${colors.border}` }}
                              >
                                {targetType === "learning_path" ? "View program" : "View course"}
                              </a>
                              <a
                                href={`${academyBasePath}/dashboard`}
                                className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                                style={{ background: colors.accent, color: "#000" }}
                              >
                                Open dashboard
                                <ArrowRight className="h-4 w-4" />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              <section className="mb-8 grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
                <div
                  className="rounded-[28px] border p-6 md:p-7"
                  style={{ borderColor: colors.border, background: colors.cardBg, boxShadow: colors.glassShadow }}
                >
                  <div className="mb-5">
                    <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                      Passed courses
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold" style={{ color: colors.text }}>
                      Courses you completed
                    </h2>
                  </div>

                  <div className="space-y-4">
                    {completedCourses.length === 0 && (
                      <div
                        className="rounded-[22px] border p-5 text-sm"
                        style={{ borderColor: colors.border, background: colors.cardBgStrong, color: colors.textSecondary }}
                      >
                        Your passed courses will show here once you complete them.
                      </div>
                    )}

                    {completedCourses.map((course) => (
                      <div
                        key={course.id}
                        className="rounded-[22px] border p-4"
                        style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: colors.text }}>
                              {course.title}
                            </p>
                            <p className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                              {course.duration || "Self-paced"} · {course.level || "All levels"}
                            </p>
                          </div>
                          <span
                            className="rounded-full px-3 py-1 text-[11px] font-semibold"
                            style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}
                          >
                            100% complete
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="rounded-[28px] border p-6 md:p-7"
                  style={{ borderColor: colors.border, background: colors.cardBg, boxShadow: colors.glassShadow }}
                >
                  <div className="mb-5">
                    <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                      Completed paths
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold" style={{ color: colors.text }}>
                      Programs you finished
                    </h2>
                  </div>

                  <div className="space-y-4">
                    {completedPathSummaries.length === 0 && (
                      <div
                        className="rounded-[22px] border p-5 text-sm"
                        style={{ borderColor: colors.border, background: colors.cardBgStrong, color: colors.textSecondary }}
                      >
                        Finish every course in a path and it will appear here.
                      </div>
                    )}

                    {completedPathSummaries.map((summary) => (
                      <div
                        key={summary.path.slug}
                        className="rounded-[22px] border p-4"
                        style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: colors.text }}>
                              {summary.path.title}
                            </p>
                            <p className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                              {getLearningPathDurationLabel(summary.path, courses)} · {summary.path.deliveryMode}
                            </p>
                          </div>
                          <span
                            className="rounded-full px-3 py-1 text-[11px] font-semibold"
                            style={{ background: `${summary.path.color}20`, color: summary.path.color }}
                          >
                            Path complete
                          </span>
                        </div>
                        <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                          {summary.path.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </UnifiedLayout>
  );
}

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useOutletContext } from "react-router-dom";
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  Compass,
  GraduationCap,
  LayoutDashboard,
  Menu,
  PlayCircle,
  Target,
  X,
} from "lucide-react";
import type { ContextType } from "~/common";
import { NAV_WIDTH } from "~/components/Nav";
import { AiTutorFloatingButton, DashboardSkeleton } from ".";
import { AcademySidebar } from "./AcademySidebar";
import { AssignmentList } from "./AssignmentList";
import { CourseMaterialsBrowser } from "./CourseMaterialsBrowser";
import { ForumsPanel } from "./ForumsPanel";
import { sbFetch } from "../shared/sbFetch";
import { resolveLearningPathCourses } from "./academyLearningPaths";
import { useAcademyLearningPaths } from "./useAcademyLearningPaths";
import { useAcademyUserId } from "./useAcademyUserId";
import { listSessions, type LiveSession } from "./api/live-sessions";

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

function useResponsiveSidebar() {
  const [isOpen, setIsOpen] = useState(false);

  return {
    isOpen,
    toggle: () => setIsOpen((value) => !value),
    close: () => setIsOpen(false),
  };
}

function UnifiedLayout({ children, bgToUse }: { children: React.ReactNode; bgToUse?: string }) {
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

function LearningHatIcon({ size = 24 }: { size?: number }) {
  return <GraduationCap style={{ width: size, height: size, color: "#000" }} />;
}

function getPersonalizedGreeting(name: string | null) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return name ? `${greeting}, ${name}` : greeting;
}

function formatCountdown(isoDate: string) {
  const diffMs = new Date(isoDate).getTime() - Date.now();
  if (diffMs <= 0) {
    return "Starting now";
  }

  const totalMinutes = Math.round(diffMs / 60000);
  if (totalMinutes < 60) {
    return `Starts in ${totalMinutes}m`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    return `Starts in ${totalHours}h ${totalMinutes % 60}m`;
  }

  const totalDays = Math.floor(totalHours / 24);
  return `Starts in ${totalDays}d ${totalHours % 24}h`;
}

type Course = {
  id: string;
  title: string;
  description?: string;
  level?: string;
  duration?: string;
  category?: string;
  instructor?: string;
  instructor_name?: string;
  progress?: number;
  state?: "draft" | "published" | "archived";
  module_count?: number;
  lesson_count?: number;
};

type Enrollment = {
  id: string;
  user_id: string;
  course_id: string;
  status: "active" | "completed" | "dropped";
  progress_percent: number;
  last_accessed_at?: string | null;
};

type Module = {
  id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
};

type Lesson = {
  id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  duration?: string | null;
};

async function fetchCourses(): Promise<Course[]> {
  const response = await sbFetch("/api/academy/courses");
  if (!response.ok) {
    throw new Error("Failed to fetch courses");
  }
  const data = await response.json();
  return Array.isArray(data) ? data : data.courses || [];
}

export default function AcademyClient() {
  const userId = useAcademyUserId();
  const location = useLocation();
  const { paths: learningPaths } = useAcademyLearningPaths();
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const sidebar = useResponsiveSidebar();
  const outletContext = useOutletContext<ContextType | undefined>();
  const navVisible = outletContext?.navVisible ?? false;
  const academyBasePath = location.pathname.startsWith("/learning") ? "/learning" : "/academy";
  const isDashboardRoute = /\/dashboard\/?$/.test(location.pathname);

  const pagePaddingX = isMobile ? "16px" : isTablet ? "24px" : "32px";
  const collapsedNavRailWidth = 56;
  const desktopNavInset = isDesktop ? (navVisible ? NAV_WIDTH.DESKTOP : collapsedNavRailWidth) : 0;
  const contentMaxWidth = isDesktop ? 1220 : 1160;
  const dashboardBasePaddingLeft = isDesktop ? `${desktopNavInset + 240 + 32}px` : pagePaddingX;

  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [selectedDashboardCourseId, setSelectedDashboardCourseId] = useState<string | null>(null);
  const [dashboardModules, setDashboardModules] = useState<Array<Module & { lessons: Lesson[] }>>([]);
  const [dashboardModulesLoading, setDashboardModulesLoading] = useState(false);

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
        const [courseData, enrollmentsResp, sessionResponse] = await Promise.all([
          fetchCourses().catch(() => []),
          sbFetch(`/api/academy/enrollments?user_id=${encodeURIComponent(userId)}`),
          listSessions({ userId }).catch(() => ({ sessions: [], total: 0, upcoming_count: 0, live_count: 0 })),
        ]);

        if (!isMounted) {
          return;
        }

        setCourses(courseData);
        setSessions(sessionResponse.sessions || []);

        if (enrollmentsResp.ok) {
          const enrollmentData = await enrollmentsResp.json();
          setEnrollments(Array.isArray(enrollmentData) ? enrollmentData : []);
        } else {
          setEnrollments([]);
        }
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
      surfaceHover: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.35)",
      border: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.5)",
      borderHover: isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.7)",
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
  const dashboardPaddingLeft = isDesktop && hasEnrollment ? dashboardBasePaddingLeft : pagePaddingX;
  const showDesktopAcademySidebar = isDashboardRoute && isDesktop && hasEnrollment;
  const showOverlayAcademySidebar = isDashboardRoute && !isDesktop && hasEnrollment;

  const enrollmentByCourseId = useMemo(
    () => Object.fromEntries(activeEnrollments.map((enrollment) => [enrollment.course_id, enrollment])),
    [activeEnrollments],
  );
  const enrolledCourseIds = useMemo(
    () => new Set(activeEnrollments.map((enrollment) => enrollment.course_id)),
    [activeEnrollments],
  );
  const enrolledCourses = useMemo(
    () => publishedCourses.filter((course) => enrolledCourseIds.has(course.id)),
    [enrolledCourseIds, publishedCourses],
  );

  const pathSummaries = useMemo(() => {
    return learningPaths.map((path) => {
      const includedCourses = resolveLearningPathCourses(path, publishedCourses);
      const completedCount = includedCourses.filter(
        (course) => (enrollmentByCourseId[course.id]?.progress_percent ?? 0) >= 100,
      ).length;
      const totalProgress = includedCourses.reduce(
        (sum, course) => sum + (enrollmentByCourseId[course.id]?.progress_percent ?? 0),
        0,
      );
      const progress = includedCourses.length > 0 ? Math.round(totalProgress / includedCourses.length) : 0;
      const nextCourse =
        includedCourses.find((course) => (enrollmentByCourseId[course.id]?.progress_percent ?? 0) < 100) ??
        includedCourses[0] ??
        null;

      return {
        path,
        includedCourses,
        completedCount,
        progress,
        nextCourse,
      };
    });
  }, [enrollmentByCourseId, learningPaths, publishedCourses]);

  const enrolledPathSummaries = useMemo(
    () =>
      pathSummaries.filter((summary) =>
        summary.includedCourses.some((course) => enrolledCourseIds.has(course.id)),
      ),
    [enrolledCourseIds, pathSummaries],
  );

  const recommendedPath = useMemo(() => {
    const inProgressPath = [...pathSummaries]
      .filter((summary) => summary.progress > 0)
      .sort((left, right) => right.progress - left.progress)[0];

    return (
      inProgressPath ??
      pathSummaries.find((summary) => summary.path.slug === "digital-basics") ??
      pathSummaries[0] ??
      null
    );
  }, [pathSummaries]);

  const continueCourse = useMemo(() => {
    return (
      enrolledCourses.find((course) => {
        const progress = enrollmentByCourseId[course.id]?.progress_percent ?? 0;
        return progress > 0 && progress < 100;
      }) ??
      enrolledCourses[0] ??
      null
    );
  }, [enrollmentByCourseId, enrolledCourses]);

  const completedCourses = useMemo(
    () => activeEnrollments.filter((enrollment) => enrollment.progress_percent >= 100).length,
    [activeEnrollments],
  );

  const inProgressCourses = useMemo(
    () =>
      activeEnrollments.filter(
        (enrollment) => enrollment.progress_percent > 0 && enrollment.progress_percent < 100,
      ).length,
    [activeEnrollments],
  );

  const upcomingSessions = useMemo(() => {
    const now = Date.now();
    return [...sessions]
      .filter((session) => session.status === "scheduled" && new Date(session.scheduled_end).getTime() >= now)
      .sort((left, right) => new Date(left.scheduled_start).getTime() - new Date(right.scheduled_start).getTime());
  }, [sessions]);

  const enrolledUpcomingSessions = useMemo(
    () => upcomingSessions.filter((session) => enrolledCourseIds.has(session.course_id)),
    [enrolledCourseIds, upcomingSessions],
  );

  const dashboardStats = useMemo(
    () => [
      { label: "Courses Enrolled", value: `${activeEnrollments.length}`, icon: BookOpen, color: "#FACC15" },
      { label: "In Progress", value: `${inProgressCourses}`, icon: Target, color: "#8B5CF6" },
      { label: "Upcoming Live", value: `${enrolledUpcomingSessions.length}`, icon: CalendarDays, color: "#10B981" },
      { label: "Completed", value: `${completedCourses}`, icon: PlayCircle, color: "#60A5FA" },
    ],
    [activeEnrollments.length, completedCourses, enrolledUpcomingSessions.length, inProgressCourses],
  );

  useEffect(() => {
    if (!hasEnrollment) {
      setSelectedDashboardCourseId(null);
      return;
    }

    if (
      selectedDashboardCourseId &&
      enrolledCourses.some((course) => course.id === selectedDashboardCourseId)
    ) {
      return;
    }

    setSelectedDashboardCourseId(continueCourse?.id ?? enrolledCourses[0]?.id ?? null);
  }, [continueCourse, enrolledCourses, hasEnrollment, selectedDashboardCourseId]);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardModules() {
      if (!isDashboardRoute || !selectedDashboardCourseId) {
        setDashboardModules([]);
        return;
      }

      setDashboardModulesLoading(true);

      try {
        const modulesResponse = await sbFetch(`/api/academy/courses/${selectedDashboardCourseId}/modules`);
        const modulesData = modulesResponse.ok ? await modulesResponse.json() : [];
        const sortedModules = Array.isArray(modulesData) ? modulesData : [];

        const modulesWithLessons = await Promise.all(
          sortedModules.map(async (module: Module) => {
            const lessonsResponse = await sbFetch(`/api/academy/modules/${module.id}/lessons`);
            const lessonsData = lessonsResponse.ok ? await lessonsResponse.json() : [];

            return {
              ...module,
              lessons: Array.isArray(lessonsData) ? lessonsData : [],
            };
          }),
        );

        if (isMounted) {
          setDashboardModules(modulesWithLessons);
        }
      } catch {
        if (isMounted) {
          setDashboardModules([]);
        }
      } finally {
        if (isMounted) {
          setDashboardModulesLoading(false);
        }
      }
    }

    loadDashboardModules();

    return () => {
      isMounted = false;
    };
  }, [isDashboardRoute, selectedDashboardCourseId]);

  const selectedDashboardCourse = useMemo(
    () => enrolledCourses.find((course) => course.id === selectedDashboardCourseId) ?? continueCourse ?? enrolledCourses[0] ?? null,
    [continueCourse, enrolledCourses, selectedDashboardCourseId],
  );

  const selectedDashboardPath = useMemo(() => {
    if (!selectedDashboardCourse) {
      return recommendedPath ?? null;
    }

    return (
      pathSummaries.find((summary) =>
        summary.includedCourses.some((course) => course.id === selectedDashboardCourse.id),
      ) ?? recommendedPath ?? null
    );
  }, [pathSummaries, recommendedPath, selectedDashboardCourse]);

  const selectedDashboardPathCourses = useMemo(() => {
    if (!selectedDashboardPath) {
      return [];
    }

    return selectedDashboardPath.includedCourses.filter((course) => enrolledCourseIds.has(course.id));
  }, [enrolledCourseIds, selectedDashboardPath]);

  const selectedDashboardSessions = useMemo(() => {
    if (!selectedDashboardCourse) {
      return [];
    }

    return enrolledUpcomingSessions.filter((session) => session.course_id === selectedDashboardCourse.id);
  }, [enrolledUpcomingSessions, selectedDashboardCourse]);

  const navLinks = [
    { href: `${academyBasePath}`, label: "Home", icon: Compass },
    { href: `${academyBasePath}/paths`, label: "Learning Paths", icon: Target },
    { href: `${academyBasePath}/courses`, label: "Courses", icon: BookOpen },
    ...(hasEnrollment
      ? [
          { href: `${academyBasePath}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
          { href: `${academyBasePath}/certificates`, label: "Certificates", icon: Award },
        ]
      : []),
  ];

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
          top: "20%",
          right: "-10%",
          width: "600px",
          height: "600px",
          background: isDark
            ? "radial-gradient(circle, rgba(236, 72, 153, 0.4) 0%, rgba(236, 72, 153, 0.15) 30%, transparent 60%)"
            : "radial-gradient(circle, rgba(236, 72, 153, 0.25) 0%, rgba(236, 72, 153, 0.08) 30%, transparent 60%)",
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
      <div
        style={{
          position: "fixed",
          top: "50%",
          right: "20%",
          width: "400px",
          height: "400px",
          background: isDark
            ? "radial-gradient(circle, rgba(255, 214, 0, 0.25) 0%, transparent 50%)"
            : "radial-gradient(circle, rgba(255, 214, 0, 0.15) 0%, transparent 50%)",
          pointerEvents: "none",
          zIndex: 0,
          filter: "blur(40px)",
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
        style={{
          marginLeft: isDesktop ? desktopNavInset : 0,
          width: isDesktop ? `calc(100% - ${desktopNavInset}px)` : "100%",
          paddingLeft: pagePaddingX,
          paddingRight: pagePaddingX,
          transition: "margin-left 0.2s ease-out, width 0.2s ease-out",
        }}
      >
        <div className="relative h-16">
          <div className="flex h-full items-center justify-between gap-4 md:hidden">
            <div className="w-10">
              {showOverlayAcademySidebar && (
                <button
                  onClick={sidebar.toggle}
                  className="rounded-lg p-2 hover:bg-white/10 transition-colors"
                  aria-label={sidebar.isOpen ? "Close menu" : "Open menu"}
                >
                  {sidebar.isOpen ? (
                    <X className="h-6 w-6" style={{ color: colors.text }} />
                  ) : (
                    <Menu className="h-6 w-6" style={{ color: colors.text }} />
                  )}
                </button>
              )}
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-center gap-4 overflow-x-auto">
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

            <div className="w-10" />
          </div>

          <div className="hidden h-full items-center md:grid md:grid-cols-[1fr_auto_1fr]">
            <div />

            <div
              className="flex items-center justify-center gap-6"
              style={{ maxWidth: `min(${contentMaxWidth}px, calc(100vw - ${desktopNavInset}px - 240px))` }}
            >
              {navLinks.map((item) => {
                const isRootAcademyLink = item.href === academyBasePath;
                const isActive = isRootAcademyLink
                  ? location.pathname === item.href
                  : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className="whitespace-nowrap transition-colors"
                    style={{ color: isActive ? colors.text : colors.textSecondary }}
                  >
                    {item.label}
                  </a>
                );
              })}
            </div>

            <div className="justify-self-end text-right">
              <a
                href={`${academyBasePath}/instructor`}
                className="inline-flex text-sm font-medium"
                style={{ color: "#C084FC" }}
              >
                Instructor Workspace
              </a>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );

  if (isDashboardRoute) {
    return (
      <UnifiedLayout bgToUse={colors.bg}>
        {backgroundOrbs}
        {topNav}

        <AnimatePresence>
          {showOverlayAcademySidebar && sidebar.isOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={sidebar.close}
                className="fixed inset-0 z-40"
                style={{ background: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(4px)" }}
              />
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed left-0 top-0 bottom-0 z-50 w-72"
                style={{
                  background: colors.surface,
                  backdropFilter: "blur(24px)",
                  borderRight: `1px solid ${colors.border}`,
                }}
              >
                <div className="border-b p-4" style={{ borderColor: colors.border }}>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold" style={{ color: colors.text }}>
                      Academy
                    </span>
                    <button onClick={sidebar.close} className="rounded-lg p-2 hover:bg-white/10">
                      <X className="h-5 w-5" style={{ color: colors.text }} />
                    </button>
                  </div>
                </div>
                <AcademySidebar layout="inline" />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {showDesktopAcademySidebar && <AcademySidebar offsetLeft={desktopNavInset} />}

        <div
          className="pb-8 pt-24"
          style={{
            paddingLeft: dashboardPaddingLeft,
            paddingRight: pagePaddingX,
            transition: "padding-left 0.2s ease-out",
          }}
        >
          <div className="mx-auto w-full max-w-6xl">
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
                    style={{ background: "rgba(255,214,0,0.12)" }}
                  >
                    <LayoutDashboard className="h-7 w-7" style={{ color: colors.accent }} />
                  </div>
                  <h1 className="text-3xl font-bold md:text-4xl" style={{ color: colors.text }}>
                    Enroll to unlock your dashboard
                  </h1>
                  <p className="mx-auto mt-3 max-w-2xl text-sm md:text-base" style={{ color: colors.textSecondary }}>
                    Start with a learning path or a course first, then your dashboard will open here.
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
                    <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
                      <div>
                        <div
                          className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                          style={{ background: "rgba(255,214,0,0.12)", color: colors.accent }}
                        >
                          <LayoutDashboard className="h-3.5 w-3.5" />
                          Dashboard
                        </div>
                        <h1 className="text-3xl font-bold md:text-4xl" style={{ color: colors.text }}>
                          {getPersonalizedGreeting(userName)}
                        </h1>
                        <p className="mt-3 max-w-2xl text-base" style={{ color: colors.textSecondary }}>
                          Continue your course and see what is next.
                        </p>
                      </div>

                      <div
                        className="rounded-[24px] border p-5"
                        style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                      >
                        <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                          Recommended next step
                        </p>
                        <h2 className="mt-2 text-xl font-semibold" style={{ color: colors.text }}>
                          {continueCourse?.title ?? "Choose your first course"}
                        </h2>
                        <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                          {selectedDashboardPath ? `From ${selectedDashboardPath.path.title}.` : "Pick a path to begin."}
                        </p>
                        <a
                          href={continueCourse ? `${academyBasePath}/courses/${continueCourse.id}` : `${academyBasePath}/paths`}
                          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"
                          style={{ color: colors.accent }}
                        >
                          {continueCourse ? "Continue Learning" : "Choose a Learning Path"}
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
                  {dashboardStats.map((stat) => (
                    <div
                      key={stat.label}
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

                <section className="mb-8 grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
                  <div
                    className="rounded-[28px] border p-6"
                    style={{ borderColor: colors.border, background: colors.cardBg }}
                  >
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                        Your Enrolled Paths
                      </h2>
                      <span className="text-sm" style={{ color: colors.textMuted }}>
                        {enrolledPathSummaries.length} active
                      </span>
                    </div>

                    <div className="space-y-3">
                      {enrolledPathSummaries.map((summary) => {
                        const isSelected = selectedDashboardPath?.path.slug === summary.path.slug;
                        return (
                          <div
                            key={summary.path.slug}
                            className="rounded-[22px] border p-4"
                            style={{
                              borderColor: isSelected ? summary.path.color : colors.border,
                              background: isSelected ? colors.cardBgStrong : colors.cardBg,
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold" style={{ color: colors.text }}>
                                  {summary.path.title}
                                </p>
                                <p className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                                  {summary.includedCourses.filter((course) => enrolledCourseIds.has(course.id)).length} enrolled courses
                                </p>
                              </div>
                              <span className="text-sm font-semibold" style={{ color: summary.path.color }}>
                                {summary.progress}%
                              </span>
                            </div>
                            <div className="mt-3 h-2 w-full rounded-full" style={{ background: "rgba(255,255,255,0.12)" }}>
                              <div className="h-full rounded-full" style={{ width: `${summary.progress}%`, background: summary.path.color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    className="rounded-[28px] border p-6"
                    style={{ borderColor: colors.border, background: colors.cardBg }}
                  >
                    <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                      Current path
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold" style={{ color: colors.text }}>
                      {selectedDashboardPath?.path.title ?? "Your learning path"}
                    </h2>
                    <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                      {selectedDashboardPath?.path.description ??
                        "Enroll in a path to see your full program plan here."}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-3 text-sm" style={{ color: colors.textSecondary }}>
                      <span>{selectedDashboardPathCourses.length} enrolled courses</span>
                      <span>{selectedDashboardPath?.completedCount ?? 0} completed</span>
                      <span>{selectedDashboardPath?.progress ?? 0}% complete</span>
                    </div>

                    <div className="mt-5 space-y-3">
                      {selectedDashboardPathCourses.map((course) => {
                        const progress = enrollmentByCourseId[course.id]?.progress_percent ?? 0;
                        return (
                          <div
                            key={course.id}
                            className="rounded-[22px] border p-4"
                            style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold" style={{ color: colors.text }}>
                                  {course.title}
                                </p>
                                <p className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                                  {course.duration || "Self-paced"}
                                </p>
                              </div>
                              <span className="text-sm font-semibold" style={{ color: colors.accent }}>
                                {progress}%
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {selectedDashboardPathCourses.length === 0 && (
                        <div className="rounded-[22px] border p-5 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                          Your enrolled classes will appear here as part of your learning path.
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="mb-8 grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
                  <div
                    className="rounded-[28px] border p-6"
                    style={{ borderColor: colors.border, background: colors.cardBg }}
                  >
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                        Your Enrolled Classes
                      </h2>
                      <span className="text-sm" style={{ color: colors.textMuted }}>
                        {enrolledCourses.length} active
                      </span>
                    </div>

                    <div className="space-y-3">
                      {enrolledCourses.map((course) => {
                        const progress = enrollmentByCourseId[course.id]?.progress_percent ?? 0;
                        const isActive = selectedDashboardCourse?.id === course.id;
                        return (
                          <button
                            key={course.id}
                            onClick={() => setSelectedDashboardCourseId(course.id)}
                            className="w-full rounded-[22px] border p-4 text-left transition-colors"
                            style={{
                              borderColor: isActive ? colors.accent : colors.border,
                              background: isActive ? colors.cardBgStrong : colors.cardBg,
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold" style={{ color: colors.text }}>
                                  {course.title}
                                </p>
                                <p className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                                  {course.category || "General"} · {course.duration || "Self-paced"}
                                </p>
                              </div>
                              <span className="text-sm font-semibold" style={{ color: colors.accent }}>
                                {progress}%
                              </span>
                            </div>
                            <div className="mt-3 h-2 w-full rounded-full" style={{ background: "rgba(255,255,255,0.12)" }}>
                              <div className="h-full rounded-full" style={{ width: `${progress}%`, background: colors.accent }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    className="rounded-[28px] border p-6"
                    style={{ borderColor: colors.border, background: colors.cardBg }}
                  >
                    <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                      Selected class
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold" style={{ color: colors.text }}>
                      {selectedDashboardCourse?.title ?? "Choose a class"}
                    </h2>
                    <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                      {selectedDashboardCourse?.description ??
                        "Choose an enrolled class to see its curriculum, live sessions, assignments, materials, and discussion space."}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-3 text-sm" style={{ color: colors.textSecondary }}>
                      <span>{selectedDashboardPath?.path.title ?? "Learning path"}</span>
                      <span>{selectedDashboardCourse?.duration || "Self-paced"}</span>
                      <span>{selectedDashboardSessions.length} live sessions</span>
                      <span>{selectedDashboardCourse?.instructor_name || selectedDashboardCourse?.instructor || "Street Voices Academy"}</span>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <a
                        href={selectedDashboardCourse ? `${academyBasePath}/courses/${selectedDashboardCourse.id}` : `${academyBasePath}/courses`}
                        className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                        style={{ background: colors.cardBgStrong, color: colors.text, border: `1px solid ${colors.border}` }}
                      >
                        Learn More
                      </a>
                      <a
                        href={
                          selectedDashboardSessions[0]
                            ? `${academyBasePath}/live-sessions/${selectedDashboardSessions[0].id}`
                            : "#academy-dashboard-live-sessions"
                        }
                        className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                        style={{ background: colors.accent, color: "#000" }}
                      >
                        View Live Sessions
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </section>

                <section className="mb-8 grid gap-6 lg:grid-cols-2">
                  <div
                    className="rounded-[28px] border p-6"
                    style={{ borderColor: colors.border, background: colors.cardBg }}
                  >
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                        Curriculum
                      </h2>
                      <a
                        href={selectedDashboardCourse ? `${academyBasePath}/courses/${selectedDashboardCourse.id}` : `${academyBasePath}/courses`}
                        className="text-sm font-semibold"
                        style={{ color: colors.accent }}
                      >
                        View course
                      </a>
                    </div>

                    <div className="space-y-4">
                      {dashboardModulesLoading && (
                        <div className="rounded-[22px] border p-5 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                          Loading curriculum...
                        </div>
                      )}

                      {!dashboardModulesLoading &&
                        dashboardModules.slice(0, 3).map((module, index) => (
                          <div
                            key={module.id}
                            className="rounded-[22px] border p-4"
                            style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                          >
                            <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                              Module {index + 1}
                            </p>
                            <p className="mt-2 text-sm font-semibold" style={{ color: colors.text }}>
                              {module.title || module.name || "Untitled module"}
                            </p>
                            <p className="mt-2 text-xs" style={{ color: colors.textSecondary }}>
                              {module.lessons.length} lessons
                            </p>
                          </div>
                        ))}

                      {!dashboardModulesLoading && dashboardModules.length === 0 && (
                        <div className="rounded-[22px] border p-5 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                          This enrolled class has no curriculum loaded yet.
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className="rounded-[28px] border p-6"
                    style={{ borderColor: colors.border, background: colors.cardBg }}
                  >
                    <div id="academy-dashboard-live-sessions" />
                    <h2 className="mb-4 text-2xl font-semibold" style={{ color: colors.text }}>
                      Live Sessions
                    </h2>
                    <div className="space-y-4">
                      {selectedDashboardSessions.slice(0, 3).map((session) => (
                        <a
                          key={session.id}
                          href={`${academyBasePath}/live-sessions/${session.id}`}
                          className="block rounded-[22px] border p-4 transition-colors hover:border-white/30"
                          style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold" style={{ color: colors.text }}>
                                {session.title}
                              </p>
                              <p className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                                {new Date(session.scheduled_start).toLocaleDateString(undefined, {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}{" "}
                                ·{" "}
                                {new Date(session.scheduled_start).toLocaleTimeString(undefined, {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                            <span
                              className="rounded-full px-3 py-1 text-[11px] font-semibold"
                              style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}
                            >
                              {formatCountdown(session.scheduled_start)}
                            </span>
                          </div>
                        </a>
                      ))}

                      {selectedDashboardSessions.length === 0 && (
                        <div className="rounded-[22px] border p-5 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                          No live sessions are scheduled for this enrolled class yet.
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {selectedDashboardCourse && (
                  <>
                    <section className="mb-8 grid gap-6 lg:grid-cols-2">
                      <div
                        className="rounded-[28px] border p-6"
                        style={{ borderColor: colors.border, background: colors.cardBg }}
                      >
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                            Materials
                          </h2>
                        </div>
                        <CourseMaterialsBrowser entityType="course" entityId={selectedDashboardCourse.id} />
                      </div>

                      <div
                        className="rounded-[28px] border p-6"
                        style={{ borderColor: colors.border, background: colors.cardBg }}
                      >
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                            Assignments
                          </h2>
                        </div>
                        <AssignmentList courseId={selectedDashboardCourse.id} userId={userId} />
                      </div>
                    </section>

                    <section
                      className="rounded-[28px] border p-6"
                      style={{ borderColor: colors.border, background: colors.cardBg }}
                    >
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                          Discussion With Instructors
                        </h2>
                        <span className="text-sm" style={{ color: colors.textMuted }}>
                          {selectedDashboardCourse.title}
                        </span>
                      </div>
                      <ForumsPanel courseId={selectedDashboardCourse.id} colors={colors} />
                    </section>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <AiTutorFloatingButton
          position="bottom-right"
          theme="dark"
          onClick={() => {
            window.location.href = `${academyBasePath}/courses`;
          }}
        />
      </UnifiedLayout>
    );
  }

  return (
    <UnifiedLayout bgToUse={colors.bg}>
      {backgroundOrbs}
      {topNav}

      <section
        className="relative"
        style={{
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          paddingTop: "128px",
          paddingBottom: "96px",
          paddingLeft: pagePaddingX,
          paddingRight: pagePaddingX,
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,215,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,215,0,0.03)_1px,transparent_1px)] bg-[size:50px_50px] opacity-30" />
        <div className="relative mx-auto max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 18px",
                marginBottom: "28px",
                borderRadius: "9999px",
                background: colors.cardBg,
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: `1px solid rgba(255, 214, 0, 0.3)`,
                boxShadow: colors.glassShadow,
              }}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-400">
                <LearningHatIcon size={20} />
              </div>
              <span className="text-sm font-semibold uppercase tracking-[0.08em] text-yellow-400 sm:text-base">
                Street Voices Academy
              </span>
            </div>

            <h1 className="text-5xl font-bold leading-tight md:text-7xl">
              Learn with
              <br />
              <span className="bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
                a clear path
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400 md:text-xl">
              Join practical learning paths and courses designed to help you build real skills without getting lost.
            </p>
            <div className="mt-8">
              <a
                href={`${academyBasePath}/paths`}
                className="inline-flex items-center gap-2 rounded-full px-6 py-4 text-base font-semibold"
                style={{ background: colors.accent, color: "#000" }}
              >
                Start Now
                <ArrowRight className="h-5 w-5" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <AiTutorFloatingButton
        position="bottom-right"
        theme="dark"
        onClick={() => {
          window.location.href = `${academyBasePath}/paths`;
        }}
      />
    </UnifiedLayout>
  );
}

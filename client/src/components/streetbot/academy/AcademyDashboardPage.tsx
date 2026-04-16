import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  Compass,
  LayoutDashboard,
  PlayCircle,
  Target,
} from "lucide-react";
import { DashboardSkeleton } from ".";
import { AssignmentList } from "./AssignmentList";
import { CourseMaterialsBrowser } from "./CourseMaterialsBrowser";
import { CourseDiscussionsPanel } from "./CourseDiscussionsPanel";
import { sbFetch } from "../shared/sbFetch";
import { resolveLearningPathCourses } from "./academyLearningPaths";
import { useAcademyLearningPaths } from "./useAcademyLearningPaths";
import { useAcademyUserId } from "./useAcademyUserId";
import { listSessions, type LiveSession } from "./api/live-sessions";
import { listCourseScheduleItems, type CourseScheduleItem } from "./api/course-schedule";

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
};

type Lesson = {
  id: string;
  title?: string | null;
  name?: string | null;
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

async function fetchCourses(): Promise<Course[]> {
  const response = await sbFetch("/api/academy/courses");
  if (!response.ok) {
    throw new Error("Failed to fetch courses");
  }
  const data = await response.json();
  return Array.isArray(data) ? data : data.courses || [];
}

export default function AcademyDashboardPage() {
  const userId = useAcademyUserId();
  const location = useLocation();
  const { paths: learningPaths } = useAcademyLearningPaths();
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const academyBasePath = location.pathname.startsWith("/learning") ? "/learning" : "/academy";

  const pagePaddingX = isMobile ? "16px" : isTablet ? "24px" : "32px";
  const contentMaxWidth = isDesktop ? 1220 : 1160;

  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [dashboardModules, setDashboardModules] = useState<Array<Module & { lessons: Lesson[] }>>([]);
  const [dashboardModulesLoading, setDashboardModulesLoading] = useState(false);
  const [selectedCourseScheduleItems, setSelectedCourseScheduleItems] = useState<CourseScheduleItem[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

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
      setSelectedCourseId(null);
      return;
    }

    if (selectedCourseId && enrolledCourses.some((course) => course.id === selectedCourseId)) {
      return;
    }

    setSelectedCourseId(continueCourse?.id ?? enrolledCourses[0]?.id ?? null);
  }, [continueCourse, enrolledCourses, hasEnrollment, selectedCourseId]);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardModules() {
      if (!selectedCourseId) {
        setDashboardModules([]);
        setDashboardModulesLoading(false);
        return;
      }

      setDashboardModulesLoading(true);

      try {
        const modulesResponse = await sbFetch(`/api/academy/courses/${selectedCourseId}/modules`);
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
  }, [selectedCourseId]);

  useEffect(() => {
    let isMounted = true;

    async function loadSelectedSchedule() {
      if (!selectedCourseId) {
        setSelectedCourseScheduleItems([]);
        setScheduleLoading(false);
        return;
      }

      setScheduleLoading(true);
      try {
        const data = await listCourseScheduleItems(selectedCourseId).catch(() => []);
        if (isMounted) {
          setSelectedCourseScheduleItems(data);
        }
      } catch {
        if (isMounted) {
          setSelectedCourseScheduleItems([]);
        }
      } finally {
        if (isMounted) {
          setScheduleLoading(false);
        }
      }
    }

    loadSelectedSchedule();

    return () => {
      isMounted = false;
    };
  }, [selectedCourseId]);

  const selectedCourse = useMemo(
    () => enrolledCourses.find((course) => course.id === selectedCourseId) ?? continueCourse ?? enrolledCourses[0] ?? null,
    [continueCourse, enrolledCourses, selectedCourseId],
  );

  const selectedPath = useMemo(() => {
    if (!selectedCourse) {
      return enrolledPathSummaries[0] ?? null;
    }

    return (
      enrolledPathSummaries.find((summary) =>
        summary.includedCourses.some((course) => course.id === selectedCourse.id),
      ) ?? enrolledPathSummaries[0] ?? null
    );
  }, [enrolledPathSummaries, selectedCourse]);

  const selectedPathCourses = useMemo(() => {
    if (!selectedPath) {
      return [];
    }

    return selectedPath.includedCourses.filter((course) => enrolledCourseIds.has(course.id));
  }, [enrolledCourseIds, selectedPath]);

  const selectedCourseSessions = useMemo(() => {
    if (!selectedCourse) {
      return [];
    }

    return enrolledUpcomingSessions.filter((session) => session.course_id === selectedCourse.id);
  }, [enrolledUpcomingSessions, selectedCourse]);

  const selectedCourseProgress = useMemo(() => {
    if (!selectedCourse) {
      return 0;
    }

    return enrollmentByCourseId[selectedCourse.id]?.progress_percent ?? 0;
  }, [enrollmentByCourseId, selectedCourse]);

  const navLinks = [
    { href: `${academyBasePath}`, label: "Home", icon: Compass },
    { href: `${academyBasePath}/paths`, label: "Programs", icon: Target },
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
          paddingLeft: pagePaddingX,
          paddingRight: pagePaddingX,
        }}
      >
        <div style={{ maxWidth: contentMaxWidth, margin: "0 auto" }}>
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="hidden min-w-[140px] md:block">
              <span className="text-sm font-semibold" style={{ color: colors.text }}>
                Student Dashboard
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

            <div className="hidden md:flex items-center gap-6">
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
          paddingLeft: pagePaddingX,
          paddingRight: pagePaddingX,
        }}
      >
        <div className="w-full min-w-0" style={{ maxWidth: contentMaxWidth, margin: "0 auto" }}>
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
                  Enroll to unlock your student dashboard
                </h1>
                <p className="mx-auto mt-3 max-w-2xl text-sm md:text-base" style={{ color: colors.textSecondary }}>
                  Start with a program or a course first, then your enrolled classes will open here.
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
                        Student Dashboard
                      </div>
                      <h1 className="text-3xl font-bold md:text-4xl" style={{ color: colors.text }}>
                        {getPersonalizedGreeting(userName)}
                      </h1>
                      <p className="mt-3 max-w-2xl text-base" style={{ color: colors.textSecondary }}>
                        This dashboard only shows the paths and classes you enrolled in.
                      </p>
                    </div>

                    <div
                      className="rounded-[24px] border p-5"
                      style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                    >
                      <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                        Connected with your instructors
                      </p>
                      <h2 className="mt-2 text-xl font-semibold" style={{ color: colors.text }}>
                        {selectedCourse?.title ?? "Choose your first class"}
                      </h2>
                      <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                        The class view below stays aligned with the same curriculum, live sessions, materials, assignments,
                        and discussion spaces your instructors manage.
                      </p>
                      <a
                        href={selectedCourse ? `${academyBasePath}/courses/${selectedCourse.id}` : `${academyBasePath}/paths`}
                        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"
                        style={{ color: colors.accent }}
                      >
                        {selectedCourse ? "Open course overview" : "Choose a program"}
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
                  className="rounded-[28px] border p-5 md:p-6"
                  style={{ borderColor: colors.border, background: colors.cardBg, boxShadow: colors.glassShadow }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                        Course Tabs
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold" style={{ color: colors.text }}>
                        Each enrolled class has its own tab.
                      </h2>
                    </div>
                    <span className="text-sm" style={{ color: colors.textMuted }}>
                      {enrolledCourses.length} active
                    </span>
                  </div>

                  <div
                    className="mt-5 flex gap-3 overflow-x-auto pb-2"
                    role="tablist"
                    aria-label="Enrolled course tabs"
                  >
                    {enrolledCourses.map((course) => {
                      const progress = enrollmentByCourseId[course.id]?.progress_percent ?? 0;
                      const isActive = selectedCourse?.id === course.id;
                      const tabId = `academy-course-tab-${course.id}`;
                      const panelId = `academy-course-panel-${course.id}`;
                      return (
                        <button
                          key={course.id}
                          onClick={() => setSelectedCourseId(course.id)}
                          id={tabId}
                          role="tab"
                          aria-selected={isActive}
                          aria-controls={panelId}
                          className="min-w-[220px] rounded-[22px] border px-5 py-4 text-left transition-colors"
                          style={{
                            borderColor: isActive ? colors.accent : colors.border,
                            background: isActive ? "rgba(255,214,0,0.14)" : colors.cardBg,
                            boxShadow: isActive ? "0 0 0 1px rgba(255,214,0,0.28) inset" : "none",
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: isActive ? colors.accent : colors.textMuted }}>
                                Class Tab
                              </p>
                              <p className="truncate text-sm font-semibold" style={{ color: colors.text }}>
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

                  {selectedCourse && (
                    <div
                      className="mt-4 rounded-[22px] border px-4 py-3 text-sm"
                      style={{ borderColor: colors.border, background: colors.cardBgStrong, color: colors.textSecondary }}
                    >
                      Now viewing: <span style={{ color: colors.text, fontWeight: 600 }}>{selectedCourse.title}</span>
                    </div>
                  )}
                </div>
              </section>

              <section className="mb-8 grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
                <div
                  id={selectedCourse ? `academy-course-panel-${selectedCourse.id}` : undefined}
                  role="tabpanel"
                  aria-labelledby={selectedCourse ? `academy-course-tab-${selectedCourse.id}` : undefined}
                  className="min-w-0 rounded-[28px] border p-6 md:p-7"
                  style={{ borderColor: colors.border, background: colors.cardBg, boxShadow: colors.glassShadow }}
                >
                  <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                    Selected class
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold" style={{ color: colors.text }}>
                    {selectedCourse?.title ?? "Choose a class"}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm md:text-base" style={{ color: colors.textSecondary }}>
                    {selectedCourse?.description ??
                      "Choose an enrolled class to see its curriculum, live sessions, materials, assignments, and discussion space."}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3 text-sm" style={{ color: colors.textSecondary }}>
                    <span>{selectedPath?.path.title ?? "Program"}</span>
                    <span>{selectedCourse?.duration || "Self-paced"}</span>
                    <span>{selectedCourseSessions.length} live sessions</span>
                    <span>{selectedCourse?.instructor_name || selectedCourse?.instructor || "Street Voices Academy"}</span>
                    <span>{selectedCourseProgress}% complete</span>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href={selectedCourse ? `${academyBasePath}/courses/${selectedCourse.id}` : `${academyBasePath}/courses`}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                      style={{ background: colors.cardBgStrong, color: colors.text, border: `1px solid ${colors.border}` }}
                    >
                      Course Overview
                    </a>
                    <a
                      href={
                        selectedCourseSessions[0]
                          ? `${academyBasePath}/live-sessions/${selectedCourseSessions[0].id}`
                          : "#academy-course-live-sessions"
                      }
                      className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                      style={{ background: colors.accent, color: "#000" }}
                    >
                      View Live Sessions
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>

                <div
                  className="min-w-0 rounded-[28px] border p-6 md:p-7"
                  style={{ borderColor: colors.border, background: colors.cardBg, boxShadow: colors.glassShadow }}
                >
                  <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                    Current path
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold" style={{ color: colors.text }}>
                    {selectedPath?.path.title ?? "Your program"}
                  </h2>
                  <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                    {selectedPath?.path.description ?? "Enroll in a path to see your full program plan here."}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3 text-sm" style={{ color: colors.textSecondary }}>
                    <span>{selectedPathCourses.length} enrolled courses</span>
                    <span>{selectedPath?.completedCount ?? 0} completed</span>
                    <span>{selectedPath?.progress ?? 0}% complete</span>
                  </div>

                  <div className="mt-5 space-y-3">
                    {selectedPathCourses.map((course) => {
                      const progress = enrollmentByCourseId[course.id]?.progress_percent ?? 0;
                      return (
                        <div
                          key={course.id}
                          className="rounded-[22px] border p-4"
                          style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold" style={{ color: colors.text }}>
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
                  </div>
                </div>
              </section>

              <section className="mb-8 grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
                <div className="min-w-0 rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                      Curriculum
                    </h2>
                    <a
                      href={selectedCourse ? `${academyBasePath}/courses/${selectedCourse.id}` : `${academyBasePath}/courses`}
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
                      dashboardModules.slice(0, 4).map((module, index) => (
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
                  </div>
                </div>

                <div className="min-w-0 rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
                  <div id="academy-course-live-sessions" />
                  <h2 className="mb-4 text-2xl font-semibold" style={{ color: colors.text }}>
                    Live Sessions
                  </h2>
                  <div className="space-y-4">
                    {selectedCourseSessions.map((session) => (
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

                    {selectedCourseSessions.length === 0 && (
                      <div className="rounded-[22px] border p-5 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                        No live sessions are scheduled for this enrolled class yet.
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {selectedCourse && (
                <>
                  <section className="mb-8 rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                        Discussion With Instructors
                      </h2>
                      <span className="text-sm" style={{ color: colors.textMuted }}>
                        {selectedCourse.title}
                      </span>
                    </div>
                    <CourseDiscussionsPanel
                      courseId={selectedCourse.id}
                      colors={colors}
                      authorId={userId}
                      authorName={userName || "Academy learner"}
                    />
                  </section>

                  <section className="mb-8">
                    <div
                      className="rounded-[28px] border p-6"
                      style={{ borderColor: colors.border, background: colors.cardBg, boxShadow: colors.glassShadow }}
                    >
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div>
                          <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                            Course Schedule
                          </h2>
                          <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                            Assignments, readings, and shared materials for this enrolled class.
                          </p>
                        </div>
                        <span className="text-sm" style={{ color: colors.textMuted }}>
                          {selectedCourse.title}
                        </span>
                      </div>

                      <div className="space-y-4">
                        {scheduleLoading && (
                          <div className="rounded-[22px] border p-5 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                            Loading your course schedule...
                          </div>
                        )}

                        {!scheduleLoading &&
                          [...selectedCourseScheduleItems]
                            .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime())
                            .map((item) => (
                              <div
                                key={item.id}
                                className="rounded-[22px] border p-4"
                                style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-xs uppercase tracking-[0.18em]" style={{ color: colors.textMuted }}>
                                      {item.category === "assignment"
                                        ? "Assignment"
                                        : item.category === "reading"
                                          ? "Reading"
                                          : "Material"}
                                    </p>
                                    <p className="mt-2 text-sm font-semibold" style={{ color: colors.text }}>
                                      {item.title}
                                    </p>
                                    <p className="mt-2 text-xs" style={{ color: colors.textSecondary }}>
                                      {item.notes || "Added by your instructor for this course."}
                                    </p>
                                  </div>
                                  <span
                                    className="rounded-full px-3 py-1 text-[11px] font-semibold"
                                    style={{ background: "rgba(255,214,0,0.14)", color: colors.accent }}
                                  >
                                    {new Date(item.scheduledAt).toLocaleDateString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                </div>
                              </div>
                            ))}

                        {!scheduleLoading && selectedCourseScheduleItems.length === 0 && (
                          <div className="rounded-[22px] border p-5 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                            No course updates are scheduled for this class yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="mb-8 grid gap-6 xl:grid-cols-[0.82fr,1.18fr]">
                    <div className="min-w-0 rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                          Materials
                        </h2>
                      </div>
                      <CourseMaterialsBrowser entityType="course" entityId={selectedCourse.id} />
                    </div>

                    <div className="space-y-6 min-w-0">
                      <div className="rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                            Quizzes
                          </h2>
                          <span className="text-sm" style={{ color: colors.textMuted }}>
                            {selectedCourse.title}
                          </span>
                        </div>
                        <AssignmentList
                          key={`${selectedCourse.id}-quizzes`}
                          courseId={selectedCourse.id}
                          userId={userId}
                          contentType="quiz"
                        />
                      </div>

                      <div className="rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                            Assignments
                          </h2>
                          <span className="text-sm" style={{ color: colors.textMuted }}>
                            {selectedCourse.title}
                          </span>
                        </div>
                        <AssignmentList
                          key={`${selectedCourse.id}-assignments`}
                          courseId={selectedCourse.id}
                          userId={userId}
                          contentType="assignment"
                        />
                      </div>
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </UnifiedLayout>
  );
}

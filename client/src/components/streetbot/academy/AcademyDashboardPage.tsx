import { useCallback, useContext, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { ThemeContext, isDark as checkDark } from '@librechat/client';
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  FileText,
  GraduationCap,
  Layers,
  LayoutDashboard,
  PlayCircle,
  PlusCircle,
  Sparkles,
  Target,
  Video,
} from 'lucide-react';
import { DashboardSkeleton } from '.';
import AcademyCertificatesPage from './AcademyCertificatesPage';
import { AssignmentList } from './AssignmentList';
import { CourseMaterialsBrowser } from './CourseMaterialsBrowser';
import { CourseDiscussionsPanel } from './CourseDiscussionsPanel';
import { sbFetch } from '../shared/sbFetch';
import {
  filterVisibleAcademyCourses,
  filterVisibleAcademyPrograms,
  resolveLearningPathCourses,
} from './academyLearningPaths';
import { getCourseCardArt, getLearningPathCardArt } from './academyCardArt';
import { useAcademyLearningPaths } from './useAcademyLearningPaths';
import { useAcademyUserId } from './useAcademyUserId';
import { useAcademyNavScrolled } from './useAcademyNavScrolled';
import { listSessions, type LiveSession } from './api/live-sessions';
import { listCourseScheduleItems, type CourseScheduleItem } from './api/course-schedule';
import { getAcademyRoleForProfile } from '../profile/academyStreetProfiles';
import { useAuthContext } from '~/hooks/AuthContext';
import type { ContextType } from '~/common';
import { NAV_WIDTH } from '~/components/Nav';
import { getGlassNavBarStyle } from '../shared/glassNav';
import AcademyNavigationChrome, { ACADEMY_DESKTOP_CONTENT_LEFT } from './AcademyNavigationChrome';

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
  state?: 'draft' | 'published' | 'archived';
  module_count?: number;
  lesson_count?: number;
};

type Enrollment = {
  id: string;
  user_id: string;
  course_id: string;
  status: 'active' | 'completed' | 'dropped';
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
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
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
        minHeight: '100vh',
        background: bgToUse || 'var(--sb-color-background, #0f0f19)',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

function getPersonalizedGreeting(name: string | null) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${greeting}, ${name}` : greeting;
}

function formatCountdown(isoDate: string) {
  const diffMs = new Date(isoDate).getTime() - Date.now();
  if (diffMs <= 0) {
    return 'Starting now';
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
  const response = await sbFetch('/api/academy/courses');
  if (!response.ok) {
    throw new Error('Failed to fetch courses');
  }
  const data = await response.json();
  return Array.isArray(data) ? data : data.courses || [];
}

export default function AcademyDashboardPage() {
  const { user } = useAuthContext();
  const { theme } = useContext(ThemeContext);
  const userId = useAcademyUserId();
  const location = useLocation();
  const outletContext = useOutletContext<ContextType | undefined>();
  const { paths: learningPaths } = useAcademyLearningPaths();
  const visibleLearningPaths = useMemo(
    () => filterVisibleAcademyPrograms(learningPaths),
    [learningPaths],
  );
  const isDark = checkDark(theme);
  const isNavScrolled = useAcademyNavScrolled();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const academyBasePath = location.pathname.startsWith('/learning') ? '/learning' : '/academy';
  const navVisible = outletContext?.navVisible ?? false;

  const pagePaddingX = isMobile ? '16px' : isTablet ? '24px' : '32px';
  const collapsedNavRailWidth = 56;
  const desktopNavInset = isDesktop ? (navVisible ? NAV_WIDTH.DESKTOP : collapsedNavRailWidth) : 0;
  const contentMaxWidth = isDesktop ? 1220 : 1160;

  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [dashboardModules, setDashboardModules] = useState<Array<Module & { lessons: Lesson[] }>>(
    [],
  );
  const [dashboardModulesLoading, setDashboardModulesLoading] = useState(false);
  const [selectedCourseScheduleItems, setSelectedCourseScheduleItems] = useState<
    CourseScheduleItem[]
  >([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  useEffect(() => {
    const storedName = localStorage.getItem('sv_user_name');
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
          listSessions({ userId }).catch(() => ({
            sessions: [],
            total: 0,
            upcoming_count: 0,
            live_count: 0,
          })),
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
      bg: isDark
        ? 'var(--sb-color-background)'
        : 'linear-gradient(135deg, #f8fbff 0%, #ffffff 42%, #fff7fb 100%)',
      surface: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.86)',
      border: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(15, 23, 42, 0.1)',
      text: isDark ? '#fff' : '#0f172a',
      textSecondary: isDark ? 'rgba(255, 255, 255, 0.72)' : '#475569',
      textMuted: isDark ? 'rgba(255, 255, 255, 0.52)' : '#64748b',
      accent: isDark ? '#A78BFA' : '#6D5DFD',
      cardBg: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.82)',
      cardBgStrong: isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(255, 255, 255, 0.96)',
      glassShadow: isDark
        ? '0 18px 56px rgba(0, 0, 0, 0.32)'
        : '0 20px 60px rgba(79, 70, 229, 0.08)',
    }),
    [isDark],
  );

  const publishedCourses = useMemo(
    () =>
      filterVisibleAcademyCourses(
        courses.filter((course) => !course.state || course.state === 'published'),
        visibleLearningPaths,
      ),
    [courses, visibleLearningPaths],
  );

  const activeEnrollments = useMemo(
    () => enrollments.filter((enrollment) => enrollment.status !== 'dropped'),
    [enrollments],
  );

  const academyRole = useMemo(
    () =>
      getAcademyRoleForProfile({
        user_id: userId,
        username: String((user as { username?: string | null } | null)?.username || ''),
        primary_roles: Array.isArray((user as { primary_roles?: string[] } | null)?.primary_roles)
          ? (user as { primary_roles?: string[] }).primary_roles
          : [],
      }),
    [user, userId],
  );

  const isInstructor = academyRole === 'instructor';
  const hasEnrollment = activeEnrollments.length > 0;

  const enrollmentByCourseId = useMemo(
    () =>
      Object.fromEntries(activeEnrollments.map((enrollment) => [enrollment.course_id, enrollment])),
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
    return visibleLearningPaths.map((path) => {
      const includedCourses = resolveLearningPathCourses(path, publishedCourses);
      const completedCount = includedCourses.filter(
        (course) => (enrollmentByCourseId[course.id]?.progress_percent ?? 0) >= 100,
      ).length;
      const totalProgress = includedCourses.reduce(
        (sum, course) => sum + (enrollmentByCourseId[course.id]?.progress_percent ?? 0),
        0,
      );
      const progress =
        includedCourses.length > 0 ? Math.round(totalProgress / includedCourses.length) : 0;
      const nextCourse =
        includedCourses.find(
          (course) => (enrollmentByCourseId[course.id]?.progress_percent ?? 0) < 100,
        ) ??
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
  }, [enrollmentByCourseId, publishedCourses, visibleLearningPaths]);

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
    () =>
      activeEnrollments.filter(
        (enrollment) => enrollment.status === 'completed' || enrollment.progress_percent >= 100,
      ).length,
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
      .filter(
        (session) =>
          session.status === 'scheduled' && new Date(session.scheduled_end).getTime() >= now,
      )
      .sort(
        (left, right) =>
          new Date(left.scheduled_start).getTime() - new Date(right.scheduled_start).getTime(),
      );
  }, [sessions]);

  const enrolledUpcomingSessions = useMemo(
    () => upcomingSessions.filter((session) => enrolledCourseIds.has(session.course_id)),
    [enrolledCourseIds, upcomingSessions],
  );

  const dashboardStats = useMemo(
    () => [
      {
        label: 'Courses Enrolled',
        value: `${activeEnrollments.length}`,
        icon: BookOpen,
        color: '#FACC15',
      },
      { label: 'In Progress', value: `${inProgressCourses}`, icon: Target, color: '#8B5CF6' },
      {
        label: 'Upcoming Live',
        value: `${enrolledUpcomingSessions.length}`,
        icon: CalendarDays,
        color: '#10B981',
      },
      { label: 'Completed', value: `${completedCourses}`, icon: PlayCircle, color: '#60A5FA' },
    ],
    [
      activeEnrollments.length,
      completedCourses,
      enrolledUpcomingSessions.length,
      inProgressCourses,
    ],
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
    () =>
      enrolledCourses.find((course) => course.id === selectedCourseId) ??
      continueCourse ??
      enrolledCourses[0] ??
      null,
    [continueCourse, enrolledCourses, selectedCourseId],
  );

  const selectedPath = useMemo(() => {
    if (!selectedCourse) {
      return enrolledPathSummaries[0] ?? null;
    }

    return (
      enrolledPathSummaries.find((summary) =>
        summary.includedCourses.some((course) => course.id === selectedCourse.id),
      ) ??
      enrolledPathSummaries[0] ??
      null
    );
  }, [enrolledPathSummaries, selectedCourse]);

  const selectedPathCourses = useMemo(() => {
    if (!selectedPath) {
      return [];
    }

    return selectedPath.includedCourses.filter((course) => enrolledCourseIds.has(course.id));
  }, [enrolledCourseIds, selectedPath]);

  const selectedCourseArt = selectedCourse ? getCourseCardArt(selectedCourse) : null;
  const continueCourseArt = continueCourse ? getCourseCardArt(continueCourse) : selectedCourseArt;
  const selectedPathArt = selectedPath ? getLearningPathCardArt(selectedPath.path) : null;

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

  const sortedSelectedCourseScheduleItems = useMemo(
    () =>
      [...selectedCourseScheduleItems].sort(
        (left, right) =>
          new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime(),
      ),
    [selectedCourseScheduleItems],
  );

  const nextScheduleItem = useMemo(() => {
    const now = Date.now();
    return (
      sortedSelectedCourseScheduleItems.find(
        (item) => new Date(item.scheduledAt).getTime() >= now,
      ) ??
      sortedSelectedCourseScheduleItems[0] ??
      null
    );
  }, [sortedSelectedCourseScheduleItems]);

  const nextLiveSession = selectedCourseSessions[0] ?? enrolledUpcomingSessions[0] ?? null;
  const primaryLearnerHref = selectedCourse
    ? `${academyBasePath}/courses/${selectedCourse.id}`
    : `${academyBasePath}#programs`;
  const primaryLearnerLabel = selectedCourse ? 'Continue course' : 'Choose a program';
  const roleSummary = isInstructor
    ? 'Learning and teaching workspace'
    : 'Learning workspace with teaching controls';
  const focusTitle =
    nextScheduleItem?.title ??
    nextLiveSession?.title ??
    selectedCourse?.title ??
    'Choose your first program';
  const focusDetail = nextScheduleItem
    ? `Scheduled ${new Date(nextScheduleItem.scheduledAt).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : nextLiveSession
      ? `${formatCountdown(nextLiveSession.scheduled_start)} · ${new Date(
          nextLiveSession.scheduled_start,
        ).toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}`
      : selectedCourse
        ? `${selectedCourseProgress}% complete · ${selectedCourse.duration || 'Self-paced'}`
        : 'Programs, courses, certificates, and teaching controls are ready here.';
  const dashboardName =
    userName ||
    String(
      (user as { name?: string | null; username?: string | null } | null)?.name ||
        (user as { username?: string | null } | null)?.username ||
        'there',
    );

  const universalHighlights = [
    {
      label: 'Learning',
      value: hasEnrollment ? `${activeEnrollments.length} active` : 'Ready to start',
      detail: hasEnrollment
        ? `${inProgressCourses} in progress · ${completedCourses} completed`
        : 'Pick a program or course to unlock your learner view.',
      icon: GraduationCap,
      color: '#FACC15',
    },
    {
      label: 'Next date',
      value: nextScheduleItem
        ? new Date(nextScheduleItem.scheduledAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })
        : nextLiveSession
          ? formatCountdown(nextLiveSession.scheduled_start)
          : 'No date yet',
      detail:
        nextScheduleItem?.title ??
        nextLiveSession?.title ??
        'Assigned dates and live sessions will surface here.',
      icon: CalendarDays,
      color: '#10B981',
    },
    {
      label: 'Teaching',
      value: '6 controls',
      detail: 'Schedule sessions, generate courses, issue certificates, and manage programs.',
      icon: Sparkles,
      color: '#F97316',
    },
  ];

  const learnerActions = [
    {
      href: primaryLearnerHref,
      label: primaryLearnerLabel,
      description: selectedCourse
        ? 'Open the current course with modules, lessons, live sessions, and assignments.'
        : 'Start from the Academy programs list and enroll in your first path.',
      icon: PlayCircle,
      color: colors.accent,
    },
    {
      href: '#certificates',
      label: 'Certificates',
      description: hasEnrollment
        ? 'Review completed courses and earned certificates without leaving the dashboard.'
        : 'Certificates appear here after enrollment and completion.',
      icon: Award,
      color: '#60A5FA',
    },
    {
      href: nextLiveSession
        ? `${academyBasePath}/live-sessions/${nextLiveSession.id}`
        : '#academy-course-live-sessions',
      label: 'Live sessions',
      description: nextLiveSession
        ? `${formatCountdown(nextLiveSession.scheduled_start)} for ${nextLiveSession.title}.`
        : 'See upcoming instructor-led sessions for the selected class.',
      icon: Video,
      color: '#10B981',
    },
  ];

  const instructorActions = [
    {
      tab: 'schedule' as const,
      href: `${academyBasePath}/instructor/schedule`,
      label: 'Schedule',
      description: 'Plan live sessions, readings, assignments, and material dates.',
      icon: CalendarDays,
      color: '#10B981',
    },
    {
      tab: 'generate' as const,
      href: `${academyBasePath}/instructor/generate`,
      label: 'Generate Course',
      description: 'Use the course generator to draft new Academy lessons faster.',
      icon: Sparkles,
      color: '#F97316',
    },
    {
      tab: 'certificate-generator' as const,
      href: `${academyBasePath}/instructor/certificate-generator`,
      label: 'Certificate Generator',
      description: 'Create and issue credentials for completed learning.',
      icon: Award,
      color: '#60A5FA',
    },
    {
      tab: 'learning-path-generator' as const,
      href: `${academyBasePath}/instructor/learning-path-generator`,
      label: 'Program Generator',
      description: 'Build complete learning paths and Street Voices programs.',
      icon: Layers,
      color: '#8B5CF6',
    },
    {
      tab: 'courses' as const,
      href: `${academyBasePath}/instructor/courses`,
      label: 'Courses',
      description: 'Review the course library and manage existing classes.',
      icon: BookOpen,
      color: '#FACC15',
    },
    {
      tab: 'add-course' as const,
      href: `${academyBasePath}/instructor/add-course`,
      label: 'Add Course',
      description: 'Create a course manually when you already know the structure.',
      icon: PlusCircle,
      color: '#EC4899',
    },
  ];

  const overviewStatCards = dashboardStats.map((stat) => {
    const copyByLabel: Record<string, { detail: string; cta: string; href: string }> = {
      'Courses Enrolled': {
        detail: 'Keep learning and building new skills.',
        cta: 'View my courses',
        href: '#student-dashboard',
      },
      'In Progress': {
        detail: 'Classes currently moving forward.',
        cta: 'Continue',
        href: primaryLearnerHref,
      },
      'Upcoming Live': {
        detail: 'Across your learning and teaching.',
        cta: 'View schedule',
        href: '#academy-course-live-sessions',
      },
      Completed: {
        detail: 'Course completions and credentials.',
        cta: 'View certificates',
        href: '#certificates',
      },
    };

    return {
      ...stat,
      ...(copyByLabel[stat.label] ?? {
        detail: 'Academy activity is available here.',
        cta: 'Open',
        href: '#student-dashboard',
      }),
    };
  });

  const navLinks = [
    { href: `${academyBasePath}#academy-top`, label: 'Academy' },
    { href: `${academyBasePath}#programs`, label: 'Programs', icon: Target },
    { href: `${academyBasePath}/courses`, label: 'Courses', icon: BookOpen },
    {
      href: `${academyBasePath}/student-workspace`,
      label: 'Student Workspace',
      icon: GraduationCap,
    },
    { href: `${academyBasePath}/instructor`, label: 'Instructor Workspace', icon: Sparkles },
    { href: `${academyBasePath}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
  ];

  const getAcademyNavLinkStyle = (href: string): CSSProperties => {
    const [hrefPath, hrefHash] = href.split('#');
    const normalizedHrefPath = hrefPath.replace(/\/$/, '');
    const normalizedPath = location.pathname.replace(/\/$/, '');
    const normalizedHash = location.hash.replace(/^#/, '');
    const isActive = hrefHash
      ? normalizedPath === academyBasePath &&
        (normalizedHash === hrefHash || (hrefHash === 'academy-top' && !normalizedHash))
      : normalizedPath === normalizedHrefPath ||
        normalizedPath.startsWith(`${normalizedHrefPath}/`);

    return {
      color: isActive ? colors.text : colors.textSecondary,
      fontFamily: 'Rubik, sans-serif',
      fontSize: 14,
      fontWeight: 700,
      letterSpacing: 0,
      whiteSpace: 'nowrap',
    };
  };

  const backgroundOrbs = (
    <>
      <div
        style={{
          position: 'fixed',
          top: '-30%',
          left: '30%',
          width: '800px',
          height: '800px',
          background: isDark
            ? 'radial-gradient(circle, rgba(139, 92, 246, 0.5) 0%, rgba(139, 92, 246, 0.2) 30%, transparent 60%)'
            : 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.1) 30%, transparent 60%)',
          pointerEvents: 'none',
          zIndex: 0,
          filter: 'blur(40px)',
        }}
        aria-hidden="true"
      />
      <div
        style={{
          position: 'fixed',
          top: '20%',
          right: '-10%',
          width: '600px',
          height: '600px',
          background: isDark
            ? 'radial-gradient(circle, rgba(236, 72, 153, 0.4) 0%, rgba(236, 72, 153, 0.15) 30%, transparent 60%)'
            : 'radial-gradient(circle, rgba(236, 72, 153, 0.25) 0%, rgba(236, 72, 153, 0.08) 30%, transparent 60%)',
          pointerEvents: 'none',
          zIndex: 0,
          filter: 'blur(60px)',
        }}
        aria-hidden="true"
      />
      <div
        style={{
          position: 'fixed',
          bottom: '-10%',
          left: '-10%',
          width: '700px',
          height: '700px',
          background: isDark
            ? 'radial-gradient(circle, rgba(6, 182, 212, 0.35) 0%, rgba(6, 182, 212, 0.1) 30%, transparent 60%)'
            : 'radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, rgba(6, 182, 212, 0.05) 30%, transparent 60%)',
          pointerEvents: 'none',
          zIndex: 0,
          filter: 'blur(50px)',
        }}
        aria-hidden="true"
      />
    </>
  );

  const academyNavGlassStyle = getGlassNavBarStyle(isDark);

  const topNav = (
    <nav
      data-academy-top-nav="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        ...(isNavScrolled
          ? academyNavGlassStyle
          : {
              background: 'transparent',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              borderBottom: '1px solid transparent',
              boxShadow: 'none',
            }),
        transition:
          'background 0.2s ease, backdrop-filter 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      <div
        style={{
          marginLeft: isDesktop ? desktopNavInset : 0,
          width: isDesktop ? `calc(100% - ${desktopNavInset}px)` : '100%',
          paddingLeft: pagePaddingX,
          paddingRight: pagePaddingX,
          transition: 'margin-left 0.2s ease-out, width 0.2s ease-out',
        }}
      >
        <div className="relative h-[60px]">
          <a
            href="/home"
            aria-label="Street Voices home"
            title="Street Voices home"
            className="absolute top-1/2 hidden -translate-y-1/2 items-center md:inline-flex"
            style={{
              left: 0,
              textDecoration: 'none',
            }}
          >
            <img
              src={isDark ? '/assets/streetvoices-text.svg' : '/assets/streetvoices-text-dark.svg'}
              alt="Street Voices"
              style={{
                height: 30,
                maxWidth: 132,
                display: 'block',
              }}
            />
          </a>

          <div className="flex h-full items-center justify-between gap-4 md:hidden">
            <div className="w-10" />

            <div className="flex min-w-0 flex-1 items-center justify-center gap-4 overflow-x-auto">
              {navLinks.map((item) => {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className="inline-flex rounded-lg px-2 py-2 transition-colors duration-200 hover:bg-black/5 hover:text-[#0b0f19] xl:px-3"
                    style={getAcademyNavLinkStyle(item.href)}
                  >
                    {item.label}
                  </a>
                );
              })}
            </div>

            <div className="w-10" aria-hidden="true" />
          </div>

          <div className="hidden h-full items-center md:flex">
            <div
              className="pointer-events-auto fixed top-0 flex h-[60px] items-center justify-center gap-0 overflow-x-auto xl:gap-1"
              style={{
                left: '50%',
                maxWidth: `min(${contentMaxWidth}px, calc(100vw - 220px))`,
                transform: 'translateX(-50%)',
              }}
            >
              {navLinks.map((item) => {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className="inline-flex rounded-lg px-2 py-2 transition-colors duration-200 hover:bg-black/5 hover:text-[#0b0f19] xl:px-3"
                    style={getAcademyNavLinkStyle(item.href)}
                  >
                    {item.label}
                  </a>
                );
              })}
            </div>

            <div className="ml-auto min-w-[132px]" aria-hidden="true" />
          </div>
        </div>
      </div>
    </nav>
  );

  return (
    <UnifiedLayout bgToUse={colors.bg}>
      {backgroundOrbs}
      <AcademyNavigationChrome />

      <div
        className="pb-8 pt-24"
        style={{
          paddingLeft: isDesktop ? ACADEMY_DESKTOP_CONTENT_LEFT : pagePaddingX,
          paddingRight: pagePaddingX,
        }}
      >
        <div className="w-full min-w-0" style={{ maxWidth: contentMaxWidth, margin: '0 auto' }}>
          <section
            className="mb-5 overflow-hidden rounded-[32px] border p-6 md:p-8"
            style={{
              borderColor: colors.border,
              background: isDark
                ? `linear-gradient(135deg, ${colors.cardBgStrong}, ${colors.cardBg})`
                : 'linear-gradient(135deg, rgba(247,243,255,0.98) 0%, rgba(255,255,255,0.96) 48%, rgba(255,239,226,0.92) 100%)',
              boxShadow: colors.glassShadow,
              backdropFilter: 'blur(28px)',
            }}
          >
            <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr] xl:items-center">
              <div className="min-w-0">
                <p
                  className="text-xs font-semibold uppercase tracking-[0.24em]"
                  style={{ color: colors.textMuted }}
                >
                  Welcome back, {dashboardName}
                </p>
                <h1
                  className="mt-4 max-w-3xl text-4xl font-bold leading-tight md:text-5xl"
                  style={{ color: colors.text }}
                >
                  You&apos;re teaching. You&apos;re learning. You&apos;re making an impact.
                </h1>
                <p
                  className="mt-5 max-w-2xl text-base leading-7"
                  style={{ color: colors.textSecondary }}
                >
                  Here&apos;s your unified overview of student learning, teaching operations,
                  certificates, schedules, materials, assignments, and program progress.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  {learnerActions.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-transform hover:-translate-y-0.5"
                      style={{
                        borderColor: colors.border,
                        background: colors.cardBgStrong,
                        color: colors.text,
                      }}
                    >
                      <item.icon className="h-4 w-4" style={{ color: item.color }} />
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {universalHighlights.map((item) => (
                  <a
                    key={item.label}
                    href={
                      item.label === 'Teaching'
                        ? `${academyBasePath}/instructor`
                        : '#student-dashboard'
                    }
                    className="group flex items-start gap-4 rounded-[24px] border p-4 transition-transform hover:-translate-y-0.5"
                    style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                  >
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                      style={{ background: `${item.color}1f` }}
                    >
                      <item.icon className="h-5 w-5" style={{ color: item.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: colors.text }}>
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                        {item.value} · {item.detail}
                      </p>
                    </div>
                    <ArrowRight
                      className="ml-auto mt-1 h-4 w-4 shrink-0 opacity-60 transition-transform group-hover:translate-x-1"
                      style={{ color: colors.textMuted }}
                    />
                  </a>
                ))}
              </div>
            </div>
          </section>

          <section className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {overviewStatCards.map((stat) => (
              <a
                key={stat.label}
                href={stat.href}
                className="group rounded-[24px] border p-5 transition-transform hover:-translate-y-0.5"
                style={{
                  borderColor: colors.border,
                  background: colors.cardBgStrong,
                  boxShadow: colors.glassShadow,
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{ background: `${stat.color}20` }}
                  >
                    <stat.icon className="h-6 w-6" style={{ color: stat.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-3xl font-bold leading-none" style={{ color: colors.text }}>
                      {stat.value}
                    </p>
                    <p className="mt-2 text-sm font-semibold" style={{ color: colors.text }}>
                      {stat.label}
                    </p>
                    <p className="mt-2 text-sm leading-5" style={{ color: colors.textSecondary }}>
                      {stat.detail}
                    </p>
                    <span
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"
                      style={{ color: colors.accent }}
                    >
                      {stat.cta}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </section>

          <section className="mb-8 grid gap-5 xl:grid-cols-[1.08fr_0.9fr_1fr]">
            <div
              className="overflow-hidden rounded-[28px] border"
              style={{
                borderColor: colors.border,
                background: colors.cardBgStrong,
                boxShadow: colors.glassShadow,
              }}
            >
              <div className="p-5 md:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold" style={{ color: colors.text }}>
                    Continue Learning
                  </h2>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}
                  >
                    {hasEnrollment ? 'In Progress' : 'Ready'}
                  </span>
                </div>

                <div className="grid gap-5 sm:grid-cols-[136px_1fr]">
                  <div className="overflow-hidden rounded-[18px] bg-slate-100">
                    {continueCourseArt ? (
                      <img
                        src={continueCourseArt.src}
                        alt=""
                        className="h-full min-h-[126px] w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.src = continueCourseArt.fallbackSrc;
                        }}
                      />
                    ) : (
                      <div
                        className="flex min-h-[126px] items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #ede9fe, #fed7aa)' }}
                      >
                        <BookOpen className="h-8 w-8" style={{ color: colors.accent }} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold" style={{ color: colors.text }}>
                      {continueCourse?.title ?? selectedCourse?.title ?? 'Choose your first class'}
                    </h3>
                    <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                      {continueCourse
                        ? `${continueCourse.category || 'Course'} · Street Voices Academy`
                        : 'Start from a program and your active class will appear here.'}
                    </p>
                    <div
                      className="mt-5 h-2 rounded-full"
                      style={{ background: isDark ? 'rgba(255,255,255,0.12)' : '#e9eaf2' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${selectedCourseProgress}%`, background: colors.accent }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span style={{ color: colors.textMuted }}>Progress</span>
                      <span className="font-semibold" style={{ color: colors.text }}>
                        {selectedCourseProgress}%
                      </span>
                    </div>
                    <a
                      href={primaryLearnerHref}
                      className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                      style={{ background: colors.accent, color: '#fff' }}
                    >
                      {primaryLearnerLabel}
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="rounded-[28px] border p-5 md:p-6"
              style={{
                borderColor: colors.border,
                background: colors.cardBgStrong,
                boxShadow: colors.glassShadow,
              }}
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold" style={{ color: colors.text }}>
                    Instructor Workspace
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                    {roleSummary}
                  </p>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: 'rgba(249,115,22,0.12)', color: '#F97316' }}
                >
                  Course operations
                </span>
              </div>
              <div className="grid gap-3">
                {instructorActions.map((action) => (
                  <a
                    key={action.label}
                    href={action.href}
                    className="group flex items-center gap-3 rounded-[18px] border p-3 transition-transform hover:-translate-y-0.5"
                    style={{
                      borderColor: colors.border,
                      background: colors.cardBg,
                    }}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                      style={{ background: `${action.color}1f` }}
                    >
                      <action.icon className="h-5 w-5" style={{ color: action.color }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold" style={{ color: colors.text }}>
                        {action.label}
                      </span>
                      <span className="mt-0.5 block text-xs" style={{ color: colors.textMuted }}>
                        {action.description}
                      </span>
                    </span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 opacity-60 transition-transform group-hover:translate-x-1"
                      style={{ color: colors.textMuted }}
                    />
                  </a>
                ))}
              </div>
            </div>

            <div
              className="rounded-[28px] border p-5 md:p-6"
              style={{
                borderColor: colors.border,
                background: colors.cardBgStrong,
                boxShadow: colors.glassShadow,
              }}
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold" style={{ color: colors.text }}>
                  Current Program
                </h2>
                <a
                  href={`${academyBasePath}#programs`}
                  className="inline-flex items-center gap-1 text-sm font-semibold"
                  style={{ color: colors.accent }}
                >
                  View all
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
              <div className="grid gap-5 sm:grid-cols-[1fr_132px] xl:grid-cols-1 2xl:grid-cols-[1fr_132px]">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold" style={{ color: colors.text }}>
                    {selectedPath?.path.title ?? 'Choose a program'}
                  </h3>
                  <p className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
                    {selectedPath?.path.description ??
                      'Your program pathway will show progress, enrolled courses, and completions here.'}
                  </p>
                  <div
                    className="mt-5 h-2 rounded-full"
                    style={{ background: isDark ? 'rgba(255,255,255,0.12)' : '#e9eaf2' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${selectedPath?.progress ?? 0}%`,
                        background: colors.accent,
                      }}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    {[
                      { label: 'Courses', value: selectedPathCourses.length },
                      { label: 'Completed', value: selectedPath?.completedCount ?? 0 },
                      { label: 'Complete', value: `${selectedPath?.progress ?? 0}%` },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border px-3 py-2"
                        style={{ borderColor: colors.border, background: colors.cardBg }}
                      >
                        <p className="text-sm font-semibold" style={{ color: colors.text }}>
                          {item.value}
                        </p>
                        <p className="mt-1 text-[11px]" style={{ color: colors.textMuted }}>
                          {item.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="overflow-hidden rounded-[18px] bg-slate-100">
                  {selectedPathArt ? (
                    <img
                      src={selectedPathArt.src}
                      alt=""
                      className="h-full min-h-[132px] w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.src = selectedPathArt.fallbackSrc;
                      }}
                    />
                  ) : (
                    <div
                      className="flex min-h-[132px] items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #e0f2fe, #f5d0fe)' }}
                    >
                      <Layers className="h-8 w-8" style={{ color: colors.accent }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p
                className="text-xs uppercase tracking-[0.22em]"
                style={{ color: colors.textMuted }}
              >
                Learning workspace
              </p>
              <h2 className="mt-1 text-2xl font-semibold" style={{ color: colors.text }}>
                Student dashboard
              </h2>
            </div>
            <a
              href={`${academyBasePath}/instructor`}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: colors.border, color: colors.text, background: colors.cardBg }}
            >
              Instructor Workspace
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          {loading ? (
            <section id="student-dashboard">
              <DashboardSkeleton />
            </section>
          ) : (
            <>
              {!hasEnrollment ? (
                <section id="student-dashboard" className="mb-8">
                  <div
                    className="rounded-[28px] border p-8 text-center md:p-10"
                    style={{
                      borderColor: colors.border,
                      background: colors.cardBg,
                      backdropFilter: 'blur(24px)',
                      boxShadow: colors.glassShadow,
                    }}
                  >
                    <div
                      className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                      style={{ background: 'rgba(255,214,0,0.12)' }}
                    >
                      <LayoutDashboard className="h-7 w-7" style={{ color: colors.accent }} />
                    </div>
                    <h1 className="text-3xl font-bold md:text-4xl" style={{ color: colors.text }}>
                      Enroll to unlock your dashboard
                    </h1>
                    <p
                      className="mx-auto mt-3 max-w-2xl text-sm md:text-base"
                      style={{ color: colors.textSecondary }}
                    >
                      Start with a program or a course first, then your enrolled classes,
                      certificates, and teaching controls will open here.
                    </p>
                    <a
                      href={`${academyBasePath}#programs`}
                      className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
                      style={{ background: colors.accent, color: '#000' }}
                    >
                      Choose a path
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </section>
              ) : (
                <section id="student-dashboard">
                  <section className="mb-8">
                    <div
                      className="rounded-[28px] border p-6 md:p-8"
                      style={{
                        borderColor: colors.border,
                        background: colors.cardBg,
                        backdropFilter: 'blur(24px)',
                        boxShadow: colors.glassShadow,
                      }}
                    >
                      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                        <div>
                          <div
                            className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                            style={{ background: 'rgba(255,214,0,0.12)', color: colors.accent }}
                          >
                            <LayoutDashboard className="h-3.5 w-3.5" />
                            Dashboard
                          </div>
                          <h1
                            className="text-3xl font-bold md:text-4xl"
                            style={{ color: colors.text }}
                          >
                            {getPersonalizedGreeting(userName)}
                          </h1>
                          <p
                            className="mt-3 max-w-2xl text-base"
                            style={{ color: colors.textSecondary }}
                          >
                            Your courses, certificates, and teaching controls now live in one
                            dashboard.
                          </p>
                        </div>

                        <div
                          className="rounded-[24px] border p-5"
                          style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                        >
                          <p
                            className="text-xs uppercase tracking-[0.22em]"
                            style={{ color: colors.textMuted }}
                          >
                            Connected with your instructors
                          </p>
                          <h2 className="mt-2 text-xl font-semibold" style={{ color: colors.text }}>
                            {selectedCourse?.title ?? 'Choose your first class'}
                          </h2>
                          <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                            The class view below stays aligned with the same curriculum, live
                            sessions, materials, assignments, and discussion spaces your instructors
                            manage.
                          </p>
                          <a
                            href={
                              selectedCourse
                                ? `${academyBasePath}/courses/${selectedCourse.id}`
                                : `${academyBasePath}#programs`
                            }
                            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"
                            style={{ color: colors.accent }}
                          >
                            {selectedCourse ? 'Open course overview' : 'Choose a program'}
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
                          backdropFilter: 'blur(24px)',
                          borderRadius: isMobile ? '16px' : '24px',
                          border: `1px solid ${colors.border}`,
                          padding: isMobile ? '16px' : '24px',
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
                      style={{
                        borderColor: colors.border,
                        background: colors.cardBg,
                        boxShadow: colors.glassShadow,
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p
                            className="text-xs uppercase tracking-[0.22em]"
                            style={{ color: colors.textMuted }}
                          >
                            Course Tabs
                          </p>
                          <h2
                            className="mt-2 text-2xl font-semibold"
                            style={{ color: colors.text }}
                          >
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
                                background: isActive ? 'rgba(255,214,0,0.14)' : colors.cardBg,
                                boxShadow: isActive
                                  ? '0 0 0 1px rgba(255,214,0,0.28) inset'
                                  : 'none',
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p
                                    className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                                    style={{ color: isActive ? colors.accent : colors.textMuted }}
                                  >
                                    Class Tab
                                  </p>
                                  <p
                                    className="truncate text-sm font-semibold"
                                    style={{ color: colors.text }}
                                  >
                                    {course.title}
                                  </p>
                                  <p className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                                    {course.category || 'General'} ·{' '}
                                    {course.duration || 'Self-paced'}
                                  </p>
                                </div>
                                <span
                                  className="text-sm font-semibold"
                                  style={{ color: colors.accent }}
                                >
                                  {progress}%
                                </span>
                              </div>
                              <div
                                className="mt-3 h-2 w-full rounded-full"
                                style={{ background: 'rgba(255,255,255,0.12)' }}
                              >
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${progress}%`, background: colors.accent }}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {selectedCourse && (
                        <div
                          className="mt-4 rounded-[22px] border px-4 py-3 text-sm"
                          style={{
                            borderColor: colors.border,
                            background: colors.cardBgStrong,
                            color: colors.textSecondary,
                          }}
                        >
                          Now viewing:{' '}
                          <span style={{ color: colors.text, fontWeight: 600 }}>
                            {selectedCourse.title}
                          </span>
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="mb-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <div
                      id={selectedCourse ? `academy-course-panel-${selectedCourse.id}` : undefined}
                      role="tabpanel"
                      aria-labelledby={
                        selectedCourse ? `academy-course-tab-${selectedCourse.id}` : undefined
                      }
                      className="min-w-0 rounded-[28px] border p-6 md:p-7"
                      style={{
                        borderColor: colors.border,
                        background: colors.cardBg,
                        boxShadow: colors.glassShadow,
                      }}
                    >
                      <p
                        className="text-xs uppercase tracking-[0.22em]"
                        style={{ color: colors.textMuted }}
                      >
                        Selected class
                      </p>
                      <h2 className="mt-2 text-3xl font-semibold" style={{ color: colors.text }}>
                        {selectedCourse?.title ?? 'Choose a class'}
                      </h2>
                      <p
                        className="mt-3 max-w-3xl text-sm md:text-base"
                        style={{ color: colors.textSecondary }}
                      >
                        {selectedCourse?.description ??
                          'Choose an enrolled class to see its curriculum, live sessions, materials, assignments, and discussion space.'}
                      </p>

                      <div
                        className="mt-5 flex flex-wrap gap-3 text-sm"
                        style={{ color: colors.textSecondary }}
                      >
                        <span>{selectedPath?.path.title ?? 'Program'}</span>
                        <span>{selectedCourse?.duration || 'Self-paced'}</span>
                        <span>{selectedCourseSessions.length} live sessions</span>
                        <span>
                          {selectedCourse?.instructor_name ||
                            selectedCourse?.instructor ||
                            'Street Voices Academy'}
                        </span>
                        <span>{selectedCourseProgress}% complete</span>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-3">
                        <a
                          href={
                            selectedCourse
                              ? `${academyBasePath}/courses/${selectedCourse.id}`
                              : `${academyBasePath}/courses`
                          }
                          className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                          style={{
                            background: colors.cardBgStrong,
                            color: colors.text,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          Course Overview
                        </a>
                        <a
                          href={
                            selectedCourseSessions[0]
                              ? `${academyBasePath}/live-sessions/${selectedCourseSessions[0].id}`
                              : '#academy-course-live-sessions'
                          }
                          className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                          style={{ background: colors.accent, color: '#000' }}
                        >
                          View Live Sessions
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      </div>
                    </div>

                    <div
                      className="min-w-0 rounded-[28px] border p-6 md:p-7"
                      style={{
                        borderColor: colors.border,
                        background: colors.cardBg,
                        boxShadow: colors.glassShadow,
                      }}
                    >
                      <p
                        className="text-xs uppercase tracking-[0.22em]"
                        style={{ color: colors.textMuted }}
                      >
                        Current path
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold" style={{ color: colors.text }}>
                        {selectedPath?.path.title ?? 'Your program'}
                      </h2>
                      <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                        {selectedPath?.path.description ??
                          'Enroll in a path to see your full program plan here.'}
                      </p>

                      <div
                        className="mt-5 flex flex-wrap gap-3 text-sm"
                        style={{ color: colors.textSecondary }}
                      >
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
                              style={{
                                borderColor: colors.border,
                                background: colors.cardBgStrong,
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p
                                    className="truncate text-sm font-semibold"
                                    style={{ color: colors.text }}
                                  >
                                    {course.title}
                                  </p>
                                  <p className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                                    {course.duration || 'Self-paced'}
                                  </p>
                                </div>
                                <span
                                  className="text-sm font-semibold"
                                  style={{ color: colors.accent }}
                                >
                                  {progress}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>

                  <section className="mb-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <div
                      className="min-w-0 rounded-[28px] border p-6"
                      style={{ borderColor: colors.border, background: colors.cardBg }}
                    >
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                          Curriculum
                        </h2>
                        <a
                          href={
                            selectedCourse
                              ? `${academyBasePath}/courses/${selectedCourse.id}`
                              : `${academyBasePath}/courses`
                          }
                          className="text-sm font-semibold"
                          style={{ color: colors.accent }}
                        >
                          View course
                        </a>
                      </div>

                      <div className="space-y-4">
                        {dashboardModulesLoading && (
                          <div
                            className="rounded-[22px] border p-5 text-sm"
                            style={{ borderColor: colors.border, color: colors.textSecondary }}
                          >
                            Loading curriculum...
                          </div>
                        )}

                        {!dashboardModulesLoading &&
                          dashboardModules.slice(0, 4).map((module, index) => (
                            <div
                              key={module.id}
                              className="rounded-[22px] border p-4"
                              style={{
                                borderColor: colors.border,
                                background: colors.cardBgStrong,
                              }}
                            >
                              <p
                                className="text-xs uppercase tracking-[0.22em]"
                                style={{ color: colors.textMuted }}
                              >
                                Module {index + 1}
                              </p>
                              <p
                                className="mt-2 text-sm font-semibold"
                                style={{ color: colors.text }}
                              >
                                {module.title || module.name || 'Untitled module'}
                              </p>
                              <p className="mt-2 text-xs" style={{ color: colors.textSecondary }}>
                                {module.lessons.length} lessons
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div
                      className="min-w-0 rounded-[28px] border p-6"
                      style={{ borderColor: colors.border, background: colors.cardBg }}
                    >
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
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                  })}{' '}
                                  ·{' '}
                                  {new Date(session.scheduled_start).toLocaleTimeString(undefined, {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                              <span
                                className="rounded-full px-3 py-1 text-[11px] font-semibold"
                                style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}
                              >
                                {formatCountdown(session.scheduled_start)}
                              </span>
                            </div>
                          </a>
                        ))}

                        {selectedCourseSessions.length === 0 && (
                          <div
                            className="rounded-[22px] border p-5 text-sm"
                            style={{ borderColor: colors.border, color: colors.textSecondary }}
                          >
                            No live sessions are scheduled for this enrolled class yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  {selectedCourse && (
                    <>
                      <section
                        className="mb-8 rounded-[28px] border p-6"
                        style={{ borderColor: colors.border, background: colors.cardBg }}
                      >
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
                          authorName={userName || 'Academy learner'}
                        />
                      </section>

                      <section className="mb-8">
                        <div
                          className="rounded-[28px] border p-6"
                          style={{
                            borderColor: colors.border,
                            background: colors.cardBg,
                            boxShadow: colors.glassShadow,
                          }}
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
                              <div
                                className="rounded-[22px] border p-5 text-sm"
                                style={{ borderColor: colors.border, color: colors.textSecondary }}
                              >
                                Loading your course schedule...
                              </div>
                            )}

                            {!scheduleLoading &&
                              sortedSelectedCourseScheduleItems.map((item) => (
                                <div
                                  key={item.id}
                                  className="rounded-[22px] border p-4"
                                  style={{
                                    borderColor: colors.border,
                                    background: colors.cardBgStrong,
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p
                                        className="text-xs uppercase tracking-[0.18em]"
                                        style={{ color: colors.textMuted }}
                                      >
                                        {item.category === 'assignment'
                                          ? 'Assignment'
                                          : item.category === 'reading'
                                            ? 'Reading'
                                            : 'Material'}
                                      </p>
                                      <p
                                        className="mt-2 text-sm font-semibold"
                                        style={{ color: colors.text }}
                                      >
                                        {item.title}
                                      </p>
                                      <p
                                        className="mt-2 text-xs"
                                        style={{ color: colors.textSecondary }}
                                      >
                                        {item.notes || 'Added by your instructor for this course.'}
                                      </p>
                                    </div>
                                    <span
                                      className="rounded-full px-3 py-1 text-[11px] font-semibold"
                                      style={{
                                        background: 'rgba(255,214,0,0.14)',
                                        color: colors.accent,
                                      }}
                                    >
                                      {new Date(item.scheduledAt).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                      })}
                                    </span>
                                  </div>
                                </div>
                              ))}

                            {!scheduleLoading && selectedCourseScheduleItems.length === 0 && (
                              <div
                                className="rounded-[22px] border p-5 text-sm"
                                style={{ borderColor: colors.border, color: colors.textSecondary }}
                              >
                                No course updates are scheduled for this class yet.
                              </div>
                            )}
                          </div>
                        </div>
                      </section>

                      <section className="mb-8 grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
                        <div
                          className="min-w-0 rounded-[28px] border p-6"
                          style={{ borderColor: colors.border, background: colors.cardBg }}
                        >
                          <div className="mb-4 flex items-center justify-between gap-4">
                            <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
                              Materials
                            </h2>
                          </div>
                          <CourseMaterialsBrowser
                            entityType="course"
                            entityId={selectedCourse.id}
                          />
                        </div>

                        <div className="min-w-0 space-y-6">
                          <div
                            className="rounded-[28px] border p-6"
                            style={{ borderColor: colors.border, background: colors.cardBg }}
                          >
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

                          <div
                            className="rounded-[28px] border p-6"
                            style={{ borderColor: colors.border, background: colors.cardBg }}
                          >
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
                </section>
              )}
              <section id="certificates" className="mb-8 scroll-mt-24">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p
                      className="text-xs uppercase tracking-[0.22em]"
                      style={{ color: colors.textMuted }}
                    >
                      Credentials workspace
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold" style={{ color: colors.text }}>
                      Certificates and completions
                    </h2>
                  </div>
                  <a
                    href={`${academyBasePath}/instructor/certificate-generator`}
                    className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"
                    style={{
                      borderColor: colors.border,
                      color: colors.text,
                      background: colors.cardBg,
                    }}
                  >
                    Certificate generator
                    <FileText className="h-4 w-4" />
                  </a>
                </div>
                <AcademyCertificatesPage embedded />
              </section>
            </>
          )}
        </div>
      </div>
    </UnifiedLayout>
  );
}

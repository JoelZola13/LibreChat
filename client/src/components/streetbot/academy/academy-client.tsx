import { AnimatePresence, motion } from 'framer-motion';
import { useContext, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { ThemeContext, isDark as checkDark } from '@librechat/client';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Camera,
  Clock,
  GraduationCap,
  Info,
  LayoutDashboard,
  Menu,
  Mic,
  PlayCircle,
  Sparkles,
  Target,
  Users,
  Video,
  X,
} from 'lucide-react';
import type { ContextType } from '~/common';
import { NAV_WIDTH } from '~/components/Nav';
import { useAuthContext } from '~/hooks/AuthContext';
import { AiTutorFloatingButton, DashboardSkeleton } from '.';
import { AcademySidebar } from './AcademySidebar';
import { AssignmentList } from './AssignmentList';
import { CourseMaterialsBrowser } from './CourseMaterialsBrowser';
import { ForumsPanel } from './ForumsPanel';
import { sbFetch } from '../shared/sbFetch';
import { ensureStreetProfileForAcademyUser } from '../profile/academyProfileSync';
import { getCourseCardArt, getLearningPathCardArt } from './academyCardArt';
import {
  buildAcademyFallbackCourses,
  filterVisibleAcademyCourses,
  filterVisibleAcademyPrograms,
  getAcademyProgramCourseDisplayTitle,
  getLearningPathCourseMap,
  getLearningPathDisplayCourseCount,
  getLearningPathDisplayCourseTitles,
  getLearningPathDurationLabel,
  resolveLearningPathCourses,
} from './academyLearningPaths';
import { useAcademyLearningPaths } from './useAcademyLearningPaths';
import { useAcademyNavScrolled } from './useAcademyNavScrolled';
import { useAcademyUserId } from './useAcademyUserId';
import { listSessions, type LiveSession } from './api/live-sessions';
import { getGlassNavBarStyle } from '../shared/glassNav';
import AcademyNavigationChrome from './AcademyNavigationChrome';
import NavDropdown from '../shared/NavDropdown';
import {
  STREET_PROFILE_NAV_ITEMS,
  isStreetProfileNavActive,
} from '../shared/streetProfileNavItems';

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

function LearningHatIcon({ size = 24 }: { size?: number }) {
  return <GraduationCap style={{ width: size, height: size, color: '#000' }} />;
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
  image_url?: string | null;
  thumbnail_url?: string | null;
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
  const response = await sbFetch('/api/academy/courses');
  if (!response.ok) {
    throw new Error('Failed to fetch courses');
  }
  const data = await response.json();
  return Array.isArray(data) ? data : data.courses || [];
}

function mergeAcademyCoursesWithFallback(courses: Course[], fallbackCourses: Course[]): Course[] {
  const courseMap = new Map<string, Course>();
  courses.forEach((course) => {
    courseMap.set(course.id, course);
    courseMap.set(course.title.toLowerCase(), course);
  });

  const merged = [...courses];
  fallbackCourses.forEach((course) => {
    const key = course.title.toLowerCase();
    if (!courseMap.has(course.id) && !courseMap.has(key)) {
      merged.push(course);
    }
  });

  return merged;
}

function getAcademyAnchorFromLocation(pathname: string, hash: string) {
  const normalizedHash = hash.replace(/^#/, '');
  if (['academy-top', 'programs', 'courses'].includes(normalizedHash)) {
    return normalizedHash;
  }
  if (/\/paths\/?$/.test(pathname)) {
    return 'programs';
  }
  if (/\/courses\/?$/.test(pathname)) {
    return 'courses';
  }
  return '';
}

function getAcademyScrollTargetId(anchor: string) {
  return anchor === 'academy-top' ? 'academy-top' : `academy-${anchor}`;
}

export default function AcademyClient() {
  const { user } = useAuthContext();
  const { theme } = useContext(ThemeContext);
  const userId = useAcademyUserId();
  const location = useLocation();
  const { paths: learningPaths } = useAcademyLearningPaths();
  const visibleLearningPaths = useMemo(
    () => filterVisibleAcademyPrograms(learningPaths),
    [learningPaths],
  );
  const fallbackCourses = useMemo(
    () => buildAcademyFallbackCourses(visibleLearningPaths),
    [visibleLearningPaths],
  );
  const isDark = checkDark(theme);
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const sidebar = useResponsiveSidebar();
  const isNavScrolled = useAcademyNavScrolled();
  const outletContext = useOutletContext<ContextType | undefined>();
  const navVisible = outletContext?.navVisible ?? false;
  const academyBasePath = location.pathname.startsWith('/learning') ? '/learning' : '/academy';
  const isDashboardRoute = /\/dashboard\/?$/.test(location.pathname);

  const pagePaddingX = isMobile ? '16px' : isTablet ? '24px' : '32px';
  const collapsedNavRailWidth = 56;
  const desktopNavInset = isDesktop ? (navVisible ? NAV_WIDTH.DESKTOP : collapsedNavRailWidth) : 0;
  const contentMaxWidth = isDesktop ? 1220 : 1160;
  const academyWideContentMaxWidth = isDesktop
    ? 'min(1600px, calc(100vw - 96px))'
    : `${contentMaxWidth}px`;
  const academySideNavWidth = 0;
  const academySideNavLeft = 0;
  const academyContentPaddingLeft = pagePaddingX;
  const dashboardBasePaddingLeft = isDesktop ? `${desktopNavInset + 240 + 32}px` : pagePaddingX;

  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [selectedDashboardCourseId, setSelectedDashboardCourseId] = useState<string | null>(null);
  const [dashboardModules, setDashboardModules] = useState<Array<Module & { lessons: Lesson[] }>>(
    [],
  );
  const [dashboardModulesLoading, setDashboardModulesLoading] = useState(false);
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

        setCourses(mergeAcademyCoursesWithFallback(courseData, fallbackCourses));
        setSessions(sessionResponse.sessions || []);

        let enrollmentData: Enrollment[] = [];
        if (enrollmentsResp.ok) {
          const data = await enrollmentsResp.json();
          enrollmentData = Array.isArray(data) ? data : [];
        }

        setEnrollments(enrollmentData);
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
  }, [fallbackCourses, userId]);

  const colors = useMemo(
    () => ({
      bg: 'var(--sb-color-background)',
      surface: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.25)',
      surfaceHover: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.35)',
      border: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.5)',
      borderHover: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.7)',
      text: isDark ? '#fff' : '#111',
      textSecondary: isDark ? 'rgba(255, 255, 255, 0.7)' : '#4b5563',
      textMuted: isDark ? 'rgba(255, 255, 255, 0.5)' : '#6b7280',
      accent: '#FFD600',
      cardBg: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.3)',
      cardBgStrong: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.5)',
      glassShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 8px 32px rgba(31, 38, 135, 0.15)',
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

  const coursePathMap = useMemo(
    () => getLearningPathCourseMap(publishedCourses, visibleLearningPaths),
    [publishedCourses, visibleLearningPaths],
  );

  const activeEnrollments = useMemo(
    () => enrollments.filter((enrollment) => enrollment.status !== 'dropped'),
    [enrollments],
  );

  useEffect(() => {
    if (!userId || activeEnrollments.length === 0) {
      return;
    }

    void ensureStreetProfileForAcademyUser({
      userId,
      user,
      roleHint: 'student',
      force: true,
    });
  }, [activeEnrollments.length, user, userId]);

  const hasEnrollment = activeEnrollments.length > 0;
  const dashboardPaddingLeft =
    isDesktop && isDashboardRoute ? dashboardBasePaddingLeft : pagePaddingX;
  const showDesktopAcademySidebar = false;
  const showOverlayAcademySidebar = false;

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

  const recommendedPath = useMemo(() => {
    const inProgressPath = [...pathSummaries]
      .filter((summary) => summary.progress > 0)
      .sort((left, right) => right.progress - left.progress)[0];

    return (
      inProgressPath ??
      pathSummaries.find((summary) => summary.path.slug === 'street-voices-media-training') ??
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
        const modulesResponse = await sbFetch(
          `/api/academy/courses/${selectedDashboardCourseId}/modules`,
        );
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
    () =>
      enrolledCourses.find((course) => course.id === selectedDashboardCourseId) ??
      continueCourse ??
      enrolledCourses[0] ??
      null,
    [continueCourse, enrolledCourses, selectedDashboardCourseId],
  );

  const selectedDashboardPath = useMemo(() => {
    if (!selectedDashboardCourse) {
      return recommendedPath ?? null;
    }

    return (
      pathSummaries.find((summary) =>
        summary.includedCourses.some((course) => course.id === selectedDashboardCourse.id),
      ) ??
      recommendedPath ??
      null
    );
  }, [pathSummaries, recommendedPath, selectedDashboardCourse]);

  const selectedDashboardPathCourses = useMemo(() => {
    if (!selectedDashboardPath) {
      return [];
    }

    return selectedDashboardPath.includedCourses.filter((course) =>
      enrolledCourseIds.has(course.id),
    );
  }, [enrolledCourseIds, selectedDashboardPath]);

  const selectedDashboardSessions = useMemo(() => {
    if (!selectedDashboardCourse) {
      return [];
    }

    return enrolledUpcomingSessions.filter(
      (session) => session.course_id === selectedDashboardCourse.id,
    );
  }, [enrolledUpcomingSessions, selectedDashboardCourse]);

  const currentAnchor = useMemo(
    () => getAcademyAnchorFromLocation(location.pathname, location.hash),
    [location.hash, location.pathname],
  );

  useEffect(() => {
    if (isDashboardRoute || !currentAnchor) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(getAcademyScrollTargetId(currentAnchor))?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentAnchor, isDashboardRoute, loading]);

  const handleAcademyNavClick = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const targetUrl = new URL(href, window.location.origin);
    const targetAnchor = targetUrl.hash.replace(/^#/, '');
    const isSameAcademyPage =
      targetUrl.pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, '');

    if (!isSameAcademyPage || !targetAnchor) {
      return;
    }

    const targetElement = document.getElementById(getAcademyScrollTargetId(targetAnchor));
    if (!targetElement) {
      return;
    }

    event.preventDefault();
    window.history.pushState(null, '', `${targetUrl.pathname}${targetUrl.hash}`);
    targetElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const isAcademyNavLinkActive = (href: string) => {
    const [hrefPath, hrefHash] = href.split('#');
    const normalizedHrefPath = hrefPath.replace(/\/$/, '');
    const normalizedPath = location.pathname.replace(/\/$/, '');

    if (hrefHash) {
      return currentAnchor === hrefHash;
    }

    if (normalizedHrefPath === academyBasePath) {
      return normalizedPath === academyBasePath && !currentAnchor;
    }

    return (
      normalizedPath === normalizedHrefPath || normalizedPath.startsWith(`${normalizedHrefPath}/`)
    );
  };

  const mainNavLinks = [
    { href: '/profiles', label: 'Street Profile' },
    { href: '/gallery', label: 'Street Gallery' },
    { href: academyBasePath, label: 'Academy' },
    { href: '/jobs', label: 'Job Board' },
    { href: '/directory', label: 'Directory' },
    { href: '/news', label: 'News' },
  ];

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

  const academySectionLinks = navLinks.filter((item) => item.label !== 'Academy');

  const isMainNavLinkActive = (href: string) => {
    const normalizedHref = href.replace(/\/$/, '');
    const normalizedPath = location.pathname.replace(/\/$/, '');

    if (normalizedHref === academyBasePath) {
      return normalizedPath === academyBasePath || normalizedPath.startsWith(`${academyBasePath}/`);
    }

    return normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
  };

  const getMainNavLinkStyle = (href: string): CSSProperties => {
    const isActive = isMainNavLinkActive(href);

    return {
      color: isActive ? colors.text : colors.textSecondary,
      fontFamily: 'Rubik, sans-serif',
      fontSize: 14,
      fontWeight: 700,
      letterSpacing: 0,
      whiteSpace: 'nowrap',
    };
  };

  const academySideNav = (
    <aside
      aria-label="Academy navigation"
      style={{
        position: isDesktop ? 'fixed' : 'sticky',
        top: isDesktop ? 60 : 72,
        bottom: isDesktop ? 0 : undefined,
        left: isDesktop ? academySideNavLeft : undefined,
        zIndex: 30,
        width: isDesktop ? academySideNavWidth : 'auto',
        margin: isDesktop ? undefined : `0 ${pagePaddingX} 20px`,
        padding: isDesktop ? '22px 16px' : 10,
        borderRadius: isDesktop ? 0 : 22,
        borderTop: isDesktop ? 'none' : `1px solid ${colors.border}`,
        borderRight: `1px solid ${colors.border}`,
        borderBottom: isDesktop ? 'none' : `1px solid ${colors.border}`,
        borderLeft: isDesktop ? 'none' : `1px solid ${colors.border}`,
        background: isDark ? 'rgba(15, 16, 28, 0.72)' : 'rgba(255, 255, 255, 0.82)',
        backdropFilter: 'blur(24px) saturate(170%)',
        WebkitBackdropFilter: 'blur(24px) saturate(170%)',
        boxShadow: isDesktop ? 'none' : colors.glassShadow,
        overflowY: isDesktop ? 'auto' : undefined,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: isDesktop ? 'column' : 'row',
          gap: 6,
          overflowX: isDesktop ? 'visible' : 'auto',
        }}
      >
        {academySectionLinks.map((item) => {
          const Icon = item.icon;
          const isActive = isAcademyNavLinkActive(item.href);

          return (
            <a
              key={item.href}
              href={item.href}
              onClick={(event) => handleAcademyNavClick(event, item.href)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                minHeight: 42,
                padding: '10px 12px',
                borderRadius: 14,
                color: isActive ? '#080808' : colors.textSecondary,
                background: isActive ? colors.accent : 'transparent',
                fontFamily: 'Rubik, sans-serif',
                fontSize: 14,
                fontWeight: 800,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                transition: 'background 0.18s ease, color 0.18s ease',
              }}
            >
              {Icon && <Icon size={16} strokeWidth={2.2} />}
              {item.label}
            </a>
          );
        })}
      </div>
    </aside>
  );

  const backgroundOrbs = (
    <>
      <div
        style={{
          position: 'fixed',
          top: '-18%',
          left: '28%',
          width: '820px',
          height: '820px',
          background:
            'radial-gradient(circle, rgba(168, 132, 255, 0.24) 0%, rgba(168, 132, 255, 0.11) 32%, transparent 66%)',
          pointerEvents: 'none',
          zIndex: 0,
          filter: 'blur(70px)',
        }}
        aria-hidden="true"
      />
      <div
        style={{
          position: 'fixed',
          top: '28%',
          right: '-12%',
          width: '720px',
          height: '720px',
          background:
            'radial-gradient(circle, rgba(255, 146, 193, 0.24) 0%, rgba(255, 146, 193, 0.1) 34%, transparent 68%)',
          pointerEvents: 'none',
          zIndex: 0,
          filter: 'blur(76px)',
        }}
        aria-hidden="true"
      />
      <div
        style={{
          position: 'fixed',
          bottom: '8%',
          left: '-14%',
          width: '640px',
          height: '640px',
          background:
            'radial-gradient(circle, rgba(127, 224, 255, 0.2) 0%, rgba(127, 224, 255, 0.08) 34%, transparent 68%)',
          pointerEvents: 'none',
          zIndex: 0,
          filter: 'blur(72px)',
        }}
        aria-hidden="true"
      />
      <div
        style={{
          position: 'fixed',
          bottom: '-18%',
          left: '35%',
          width: '580px',
          height: '580px',
          background:
            'radial-gradient(circle, rgba(255, 214, 0, 0.24) 0%, rgba(255, 214, 0, 0.08) 36%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
          filter: 'blur(78px)',
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
          <div className="flex h-full items-center justify-between gap-4 md:hidden">
            <div className="w-10">
              {showOverlayAcademySidebar && (
                <button
                  onClick={sidebar.toggle}
                  className="rounded-lg p-2 transition-colors hover:bg-white/10"
                  aria-label={sidebar.isOpen ? 'Close menu' : 'Open menu'}
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
              {mainNavLinks.map((item) => {
                const isActive =
                  item.label === 'Street Profile'
                    ? isStreetProfileNavActive(location.pathname)
                    : isMainNavLinkActive(item.href);

                if (item.label === 'Street Profile') {
                  return (
                    <NavDropdown
                      key={item.href}
                      label={item.label}
                      href={item.href}
                      items={STREET_PROFILE_NAV_ITEMS}
                      textColor={isActive ? colors.text : colors.textSecondary}
                      fontSize={14}
                      buttonStyle={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        fontWeight: 700,
                      }}
                      menuMinWidth={170}
                    />
                  );
                }

                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className="inline-flex rounded-lg px-2 py-2 transition-colors duration-200 hover:bg-black/5 hover:text-[#0b0f19] xl:px-3"
                    style={getMainNavLinkStyle(item.href)}
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
              {mainNavLinks.map((item) => {
                const isActive =
                  item.label === 'Street Profile'
                    ? isStreetProfileNavActive(location.pathname)
                    : isMainNavLinkActive(item.href);

                if (item.label === 'Street Profile') {
                  return (
                    <NavDropdown
                      key={item.href}
                      label={item.label}
                      href={item.href}
                      items={STREET_PROFILE_NAV_ITEMS}
                      textColor={isActive ? colors.text : colors.textSecondary}
                      fontSize={14}
                      buttonStyle={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        fontWeight: 700,
                      }}
                      menuMinWidth={170}
                    />
                  );
                }

                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className="inline-flex rounded-lg px-2 py-2 transition-colors duration-200 hover:bg-black/5 hover:text-[#0b0f19] xl:px-3"
                    style={getMainNavLinkStyle(item.href)}
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

  if (isDashboardRoute) {
    return (
      <UnifiedLayout bgToUse={colors.bg}>
        {backgroundOrbs}
        <AcademyNavigationChrome />

        <AnimatePresence>
          {showOverlayAcademySidebar && sidebar.isOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={sidebar.close}
                className="fixed inset-0 z-40"
                style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed bottom-0 left-0 top-0 z-50 w-72"
                style={{
                  background: colors.surface,
                  backdropFilter: 'blur(24px)',
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
            transition: 'padding-left 0.2s ease-out',
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
                    Start with a program or a course first, then your dashboard will open here.
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
              <>
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
                    <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
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
                          Continue your course and see what is next.
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
                          Recommended next step
                        </p>
                        <h2 className="mt-2 text-xl font-semibold" style={{ color: colors.text }}>
                          {continueCourse?.title ?? 'Choose your first course'}
                        </h2>
                        <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                          {selectedDashboardPath
                            ? `From ${selectedDashboardPath.path.title}.`
                            : 'Pick a path to begin.'}
                        </p>
                        <a
                          href={
                            continueCourse
                              ? `${academyBasePath}/courses/${continueCourse.id}`
                              : `${academyBasePath}#programs`
                          }
                          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"
                          style={{ color: colors.accent }}
                        >
                          {continueCourse ? 'Continue Learning' : 'Choose a Program'}
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
                                  {
                                    summary.includedCourses.filter((course) =>
                                      enrolledCourseIds.has(course.id),
                                    ).length
                                  }{' '}
                                  enrolled courses
                                </p>
                              </div>
                              <span
                                className="text-sm font-semibold"
                                style={{ color: summary.path.color }}
                              >
                                {summary.progress}%
                              </span>
                            </div>
                            <div
                              className="mt-3 h-2 w-full rounded-full"
                              style={{ background: 'rgba(255,255,255,0.12)' }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${summary.progress}%`,
                                  background: summary.path.color,
                                }}
                              />
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
                    <p
                      className="text-xs uppercase tracking-[0.22em]"
                      style={{ color: colors.textMuted }}
                    >
                      Current path
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold" style={{ color: colors.text }}>
                      {selectedDashboardPath?.path.title ?? 'Your program'}
                    </h2>
                    <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                      {selectedDashboardPath?.path.description ??
                        'Enroll in a path to see your full program plan here.'}
                    </p>

                    <div
                      className="mt-5 flex flex-wrap gap-3 text-sm"
                      style={{ color: colors.textSecondary }}
                    >
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

                      {selectedDashboardPathCourses.length === 0 && (
                        <div
                          className="rounded-[22px] border p-5 text-sm"
                          style={{ borderColor: colors.border, color: colors.textSecondary }}
                        >
                          Your enrolled classes will appear here as part of your program.
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
                                  {course.category || 'General'} · {course.duration || 'Self-paced'}
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
                  </div>

                  <div
                    className="rounded-[28px] border p-6"
                    style={{ borderColor: colors.border, background: colors.cardBg }}
                  >
                    <p
                      className="text-xs uppercase tracking-[0.22em]"
                      style={{ color: colors.textMuted }}
                    >
                      Selected class
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold" style={{ color: colors.text }}>
                      {selectedDashboardCourse?.title ?? 'Choose a class'}
                    </h2>
                    <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                      {selectedDashboardCourse?.description ??
                        'Choose an enrolled class to see its curriculum, live sessions, assignments, materials, and discussion space.'}
                    </p>

                    <div
                      className="mt-5 flex flex-wrap gap-3 text-sm"
                      style={{ color: colors.textSecondary }}
                    >
                      <span>{selectedDashboardPath?.path.title ?? 'Program'}</span>
                      <span>{selectedDashboardCourse?.duration || 'Self-paced'}</span>
                      <span>{selectedDashboardSessions.length} live sessions</span>
                      <span>
                        {selectedDashboardCourse?.instructor_name ||
                          selectedDashboardCourse?.instructor ||
                          'Street Voices Academy'}
                      </span>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <a
                        href={
                          selectedDashboardCourse
                            ? `${academyBasePath}/courses/${selectedDashboardCourse.id}`
                            : `${academyBasePath}/courses`
                        }
                        className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                        style={{
                          background: colors.cardBgStrong,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        Learn More
                      </a>
                      <a
                        href={
                          selectedDashboardSessions[0]
                            ? `${academyBasePath}/live-sessions/${selectedDashboardSessions[0].id}`
                            : '#academy-dashboard-live-sessions'
                        }
                        className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                        style={{ background: colors.accent, color: '#000' }}
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
                        href={
                          selectedDashboardCourse
                            ? `${academyBasePath}/courses/${selectedDashboardCourse.id}`
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
                        dashboardModules.slice(0, 3).map((module, index) => (
                          <div
                            key={module.id}
                            className="rounded-[22px] border p-4"
                            style={{ borderColor: colors.border, background: colors.cardBgStrong }}
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

                      {!dashboardModulesLoading && dashboardModules.length === 0 && (
                        <div
                          className="rounded-[22px] border p-5 text-sm"
                          style={{ borderColor: colors.border, color: colors.textSecondary }}
                        >
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

                      {selectedDashboardSessions.length === 0 && (
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
                        <CourseMaterialsBrowser
                          entityType="course"
                          entityId={selectedDashboardCourse.id}
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
      <AcademyNavigationChrome />

      <section
        id="academy-top"
        className="relative"
        style={{
          zIndex: 1,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          paddingTop: '108px',
          paddingBottom: '104px',
          paddingLeft: academyContentPaddingLeft,
          paddingRight: pagePaddingX,
        }}
      >
        <div className="relative mx-auto max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 24px',
                marginBottom: '56px',
                borderRadius: '9999px',
                background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.58)',
                border: isDark ? '1.5px solid rgba(255, 214, 0, 0.82)' : '1.5px solid #F7C600',
                boxShadow: isDark
                  ? '0 18px 44px rgba(255, 214, 0, 0.12), inset 0 1px 0 rgba(255,255,255,0.14)'
                  : '0 18px 42px rgba(247, 198, 0, 0.08)',
                backdropFilter: isDark ? 'blur(18px) saturate(170%)' : undefined,
                WebkitBackdropFilter: isDark ? 'blur(18px) saturate(170%)' : undefined,
              }}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFD600]">
                <LearningHatIcon size={17} />
              </div>
              <span className="text-sm font-bold uppercase tracking-[0.08em] text-[#F5B700] sm:text-base">
                Street Voices Academy
              </span>
            </div>

            <p
              className="mx-auto max-w-3xl text-xl font-normal leading-[1.75] md:text-2xl"
              style={{
                color: isDark ? 'rgba(236, 239, 255, 0.82)' : '#465568',
                textShadow: isDark ? '0 2px 22px rgba(0, 0, 0, 0.34)' : 'none',
              }}
            >
              Street Voices Academy is an online learning platform{' '}
              <br className="hidden md:block" />
              where students can discover courses and workshops, <br className="hidden md:block" />
              and educators can deliver engaging learning experiences{' '}
              <br className="hidden md:block" />
              through a range of programs and accessible learning tools.
            </p>
            <div className="mt-24 flex items-center justify-center">
              <div
                className="inline-flex overflow-hidden rounded-full border p-1.5 shadow-[0_18px_40px_rgba(255,214,0,0.18)]"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.78)',
                  borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.12)',
                  backdropFilter: 'blur(18px) saturate(170%)',
                  WebkitBackdropFilter: 'blur(18px) saturate(170%)',
                }}
              >
                <a
                  href={`${academyBasePath}#programs`}
                  onClick={(event) => handleAcademyNavClick(event, `${academyBasePath}#programs`)}
                  className="inline-flex min-w-[210px] items-center justify-center gap-3 rounded-full px-8 py-3.5 text-base font-bold transition-transform duration-200 hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(180deg, #FFD600 0%, #F8C900 100%)',
                    color: '#080808',
                  }}
                >
                  Explore Programs
                  <ArrowRight className="h-5 w-5" />
                </a>
                <a
                  href={`${academyBasePath}#courses`}
                  onClick={(event) => handleAcademyNavClick(event, `${academyBasePath}#courses`)}
                  className="inline-flex min-w-[160px] items-center justify-center gap-3 rounded-full px-8 py-3.5 text-base font-bold transition-transform duration-200 hover:-translate-y-0.5"
                  style={{
                    color: isDark ? '#f8fafc' : '#111827',
                  }}
                >
                  Courses
                  <ArrowRight className="h-5 w-5" />
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section
        id="academy-programs"
        className="relative"
        style={{
          zIndex: 1,
          paddingLeft: academyContentPaddingLeft,
          paddingRight: pagePaddingX,
          paddingBottom: '96px',
          scrollMarginTop: '88px',
        }}
      >
        <div className="mx-auto" style={{ maxWidth: academyWideContentMaxWidth }}>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid gap-6"
          >
            {pathSummaries.map((summary) => {
              const visual = getLearningPathCardArt(summary.path);
              const featuredCourses = summary.includedCourses.slice(0, 4);
              const fallbackCourseTitles = getLearningPathDisplayCourseTitles(
                summary.path,
                publishedCourses,
              ).slice(0, 4);
              const courseTitles =
                featuredCourses.length > 0
                  ? featuredCourses.map((course) => course.title)
                  : fallbackCourseTitles;
              const courseIcons = [Users, Video, Camera, Mic];
              const programDisplayTitle =
                summary.path.slug === 'street-voices-media-training' &&
                !/program/i.test(summary.path.title)
                  ? `${summary.path.title} Program`
                  : summary.path.title;
              const academyProgramGlassTheme = {
                border: 'rgba(255, 255, 255, 0.14)',
                borderStrong: 'rgba(255, 255, 255, 0.2)',
                cardBackground:
                  'linear-gradient(135deg, rgba(31, 34, 42, 0.9) 0%, rgba(66, 66, 74, 0.66) 48%, rgba(47, 43, 52, 0.74) 100%)',
                tileBackground:
                  'linear-gradient(135deg, rgba(255,255,255,0.075), rgba(255,255,255,0.035))',
                accent: '#FFD600',
                accentSoft: 'rgba(255, 214, 0, 0.16)',
                accentBorder: 'rgba(255, 214, 0, 0.34)',
              };

              return (
                <article
                  key={summary.path.slug}
                  className="group overflow-hidden rounded-[34px] border p-4 transition-transform duration-300 hover:-translate-y-1 md:p-5 lg:p-6"
                  style={{
                    borderColor: academyProgramGlassTheme.borderStrong,
                    background: academyProgramGlassTheme.cardBackground,
                    backdropFilter: 'blur(24px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(160%)',
                    boxShadow:
                      '0 28px 80px rgba(0, 0, 0, 0.34), inset 0 0 0 1px rgba(255, 255, 255, 0.04)',
                  }}
                >
                  <div className="grid gap-7 lg:grid-cols-[0.95fr,1fr] lg:items-stretch">
                    <div
                      className="relative min-h-[360px] overflow-hidden rounded-[28px] border lg:min-h-[560px]"
                      style={{ borderColor: academyProgramGlassTheme.border }}
                    >
                      <img
                        src={visual.src}
                        alt={programDisplayTitle}
                        className="h-full min-h-[360px] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] lg:min-h-[560px]"
                        loading="lazy"
                        onError={(event) => {
                          if (event.currentTarget.dataset.fallbackApplied === 'true') {
                            return;
                          }
                          event.currentTarget.dataset.fallbackApplied = 'true';
                          event.currentTarget.src = visual.fallbackSrc;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-yellow-950/25 via-slate-950/15 to-slate-950/60" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                      <div
                        className="absolute left-7 top-7 inline-flex items-center gap-3 rounded-full px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-black shadow-[0_16px_42px_rgba(255,214,0,0.24)]"
                        style={{
                          background: 'linear-gradient(180deg, #FFD600 0%, #F8C900 100%)',
                        }}
                      >
                        <Sparkles className="h-4 w-4" />
                        {summary.path.level}
                      </div>
                    </div>

                    <div className="flex flex-col justify-center py-4 lg:py-8">
                      <div className="text-white/72 grid gap-4 text-sm font-bold sm:grid-cols-3">
                        <span className="inline-flex items-center gap-3">
                          <BookOpen
                            className="h-5 w-5"
                            style={{ color: academyProgramGlassTheme.accent }}
                          />
                          {getLearningPathDisplayCourseCount(summary.path, publishedCourses)}{' '}
                          Courses
                        </span>
                        <span className="inline-flex items-center gap-3">
                          <Clock
                            className="h-5 w-5"
                            style={{ color: academyProgramGlassTheme.accent }}
                          />
                          16 Weeks
                        </span>
                        <span className="inline-flex items-center gap-3">
                          <BarChart3
                            className="h-5 w-5"
                            style={{ color: academyProgramGlassTheme.accent }}
                          />
                          {summary.progress}% Complete
                        </span>
                      </div>

                      <h3 className="mt-8 text-4xl font-black leading-tight md:text-5xl">
                        <a
                          href={`${academyBasePath}/paths/${summary.path.slug}`}
                          className="text-white transition-colors duration-200 hover:!text-[#FFD600] focus-visible:!text-[#FFD600] focus-visible:outline-none"
                        >
                          {programDisplayTitle}
                        </a>
                      </h3>
                      <div
                        className="mt-6 h-1 w-24 rounded-full shadow-[0_0_24px_rgba(255,214,0,0.55)]"
                        style={{ background: academyProgramGlassTheme.accent }}
                      />
                      <p className="mt-7 max-w-3xl text-lg font-semibold leading-8 text-white/70">
                        Build real-world media skills through hands-on projects, expert mentorship,
                        and a supportive community.
                      </p>

                      <div className="mt-9 grid gap-4 md:grid-cols-2">
                        {courseTitles.map((courseTitle, index) => {
                          const Icon = courseIcons[index] ?? BookOpen;
                          const displayCourseTitle =
                            getAcademyProgramCourseDisplayTitle(courseTitle);
                          const normalizedCourseTitle = courseTitle.trim().toLowerCase();
                          const course =
                            featuredCourses[index] ??
                            publishedCourses.find(
                              (item) => item.title.trim().toLowerCase() === normalizedCourseTitle,
                            );
                          const courseHref = course
                            ? `${academyBasePath}/courses/${course.id}`
                            : `${academyBasePath}/courses`;

                          return (
                            <div
                              key={`${summary.path.slug}-${courseTitle}-${index}`}
                              className="flex items-center gap-5 rounded-[20px] border p-5"
                              style={{
                                borderColor: academyProgramGlassTheme.border,
                                background: academyProgramGlassTheme.tileBackground,
                              }}
                            >
                              <span
                                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border"
                                style={{
                                  borderColor: academyProgramGlassTheme.accentBorder,
                                  background: academyProgramGlassTheme.accentSoft,
                                  color: academyProgramGlassTheme.accent,
                                }}
                              >
                                <Icon className="h-8 w-8" />
                              </span>
                              <span>
                                <a
                                  href={courseHref}
                                  className="block text-lg font-black transition-colors duration-200 focus-visible:outline-none"
                                  style={{ color: '#fff' }}
                                  onMouseEnter={(event) => {
                                    event.currentTarget.style.color =
                                      academyProgramGlassTheme.accent;
                                  }}
                                  onMouseLeave={(event) => {
                                    event.currentTarget.style.color = '#fff';
                                  }}
                                  onFocus={(event) => {
                                    event.currentTarget.style.color =
                                      academyProgramGlassTheme.accent;
                                  }}
                                  onBlur={(event) => {
                                    event.currentTarget.style.color = '#fff';
                                  }}
                                >
                                  {displayCourseTitle}
                                </a>
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-10 grid gap-4 sm:grid-cols-2">
                        <a
                          href={`${academyBasePath}/paths/${summary.path.slug}`}
                          className="inline-flex min-h-[64px] items-center justify-center gap-3 rounded-full border px-8 text-base font-black text-white transition-transform duration-200 hover:-translate-y-0.5"
                          style={{
                            borderColor: academyProgramGlassTheme.accentBorder,
                            background: 'rgba(255,255,255,0.02)',
                          }}
                        >
                          <Info className="h-5 w-5" />
                          Learn More
                        </a>
                        <a
                          href={
                            summary.includedCourses.length > 0
                              ? `${academyBasePath}/paths/${summary.path.slug}/enroll`
                              : `${academyBasePath}/paths/${summary.path.slug}`
                          }
                          className="inline-flex min-h-[64px] items-center justify-center gap-4 rounded-full px-8 text-base font-black text-white transition-transform duration-200 hover:-translate-y-0.5"
                          style={{
                            background: 'linear-gradient(180deg, #FFD600 0%, #F8C900 100%)',
                            color: '#080808',
                            boxShadow: '0 18px 44px rgba(255, 214, 0, 0.26)',
                          }}
                        >
                          <ArrowRight className="h-6 w-6" />
                          Sign Up Now
                        </a>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            {pathSummaries.length === 0 && (
              <div
                className="rounded-[24px] border p-6 text-sm"
                style={{
                  borderColor: colors.border,
                  background: colors.cardBgStrong,
                  color: colors.textSecondary,
                }}
              >
                Programs will appear here once the Academy catalog is loaded.
              </div>
            )}
          </motion.div>
        </div>
      </section>

      <section
        id="academy-courses"
        className="relative"
        style={{
          zIndex: 1,
          paddingLeft: academyContentPaddingLeft,
          paddingRight: pagePaddingX,
          paddingBottom: '96px',
          scrollMarginTop: '88px',
        }}
      >
        <div className="mx-auto" style={{ maxWidth: academyWideContentMaxWidth }}>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {loading &&
              [1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-[280px] rounded-[26px] border"
                  style={{ borderColor: colors.border, background: colors.cardBg }}
                />
              ))}

            {!loading &&
              publishedCourses.map((course) => {
                const linkedPaths = coursePathMap.get(course.id) ?? [];
                const enrollment = activeEnrollments.find((entry) => entry.course_id === course.id);
                const visual = getCourseCardArt(course);

                return (
                  <article
                    key={course.id}
                    className="group rounded-[26px] border p-6 transition-transform duration-300 hover:-translate-y-1"
                    style={{
                      borderColor: colors.border,
                      background: colors.cardBg,
                      boxShadow: colors.glassShadow,
                    }}
                  >
                    <div
                      className="relative mb-5 overflow-hidden rounded-[24px] border"
                      style={{ borderColor: colors.border }}
                    >
                      <img
                        src={visual.src}
                        alt={course.title}
                        className="h-[220px] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        loading="lazy"
                        onError={(event) => {
                          if (event.currentTarget.dataset.fallbackApplied === 'true') {
                            return;
                          }
                          event.currentTarget.dataset.fallbackApplied = 'true';
                          event.currentTarget.src = visual.fallbackSrc;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                      <div
                        className="absolute left-4 top-4 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                        style={{ background: 'rgba(15,23,42,0.65)', color: visual.accent }}
                      >
                        {visual.eyebrow}
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2">
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

                    <h3 className="text-2xl font-semibold">
                      <a
                        href={`${academyBasePath}/courses/${course.id}`}
                        className="transition-colors duration-200 focus-visible:outline-none"
                        style={{ color: colors.text, textDecoration: 'none' }}
                        onMouseEnter={(event) => {
                          event.currentTarget.style.color = colors.accent;
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.color = colors.text;
                        }}
                        onFocus={(event) => {
                          event.currentTarget.style.color = colors.accent;
                        }}
                        onBlur={(event) => {
                          event.currentTarget.style.color = colors.text;
                        }}
                      >
                        {course.title}
                      </a>
                    </h3>
                    <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                      {course.description ||
                        'Open this course to view the overview, requirements, and what you will learn.'}
                    </p>

                    <div
                      className="mt-4 flex flex-wrap gap-3 text-xs"
                      style={{ color: colors.textMuted }}
                    >
                      <span>
                        {course.level
                          ? course.level.charAt(0).toUpperCase() + course.level.slice(1)
                          : 'Beginner'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {course.duration || 'Self-paced'}
                      </span>
                      <span>{course.module_count || 0} modules</span>
                    </div>

                    {enrollment && (
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <span style={{ color: colors.textSecondary }}>Progress</span>
                          <span style={{ color: colors.accent }}>
                            {enrollment.progress_percent}%
                          </span>
                        </div>
                        <div
                          className="h-2 w-full rounded-full"
                          style={{ background: 'rgba(255,255,255,0.14)' }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${enrollment.progress_percent}%`,
                              background: colors.accent,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-6 flex flex-wrap gap-3">
                      <a
                        href={`${academyBasePath}/courses/${course.id}`}
                        className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                        style={{
                          background: colors.cardBgStrong,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        Learn More
                      </a>
                      <a
                        href={
                          enrolledCourseIds.has(course.id)
                            ? `${academyBasePath}/courses/${course.id}`
                            : `${academyBasePath}/courses/${course.id}/enroll`
                        }
                        className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
                        style={{ background: colors.accent, color: '#000' }}
                      >
                        Sign up Now
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </div>
                  </article>
                );
              })}
          </div>

          {!loading && publishedCourses.length === 0 && (
            <div
              className="mt-10 rounded-[26px] border p-8 text-center"
              style={{
                borderColor: colors.border,
                background: colors.cardBg,
                color: colors.textSecondary,
              }}
            >
              Courses will appear here once the Academy catalog is loaded.
            </div>
          )}
        </div>
      </section>

      <AiTutorFloatingButton
        position="bottom-right"
        theme="dark"
        onClick={() => {
          window.location.href = `${academyBasePath}#programs`;
        }}
      />
    </UnifiedLayout>
  );
}

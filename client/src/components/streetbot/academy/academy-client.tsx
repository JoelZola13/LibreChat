import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import {
  Play,
  BookOpen,
  Award,
  ArrowRight,
  Sparkles,
  Video,
  Brain,
  Trophy,
  Clock,
  TrendingUp,
  Target,
  ChevronRight,
  Briefcase,
  Laptop,
  Home,
  ClipboardCheck,
  MessageCircle,
  Search,
  Bell,
  Menu,
  X,
  GraduationCap,
  CalendarDays,
} from "lucide-react";
import { CrossLink } from "../shared/CrossLink";
import { AcademySidebar } from "./AcademySidebar";
import {
  AiTutorFloatingButton,
  DashboardSkeleton,
  Breadcrumb,
  BreadcrumbCompact,
} from ".";
import { sbFetch } from "../shared/sbFetch";

// =============================================================================
// Inline helpers (replace SBP-specific imports)
// =============================================================================

/** Simple responsive hook (replaces @/hooks/useResponsive) */
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
    toggle: () => setIsOpen((v) => !v),
    close: () => setIsOpen(false),
  };
}

/** Personalized greeting (replaces @/lib/utils/greeting) */
function getPersonalizedGreeting(name: string | null): string {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return name ? `${greeting}, ${name}` : `${greeting}!`;
}

function getMotivationalMessage(inProgressCount: number, streakDays: number): string {
  if (streakDays >= 7) return `Amazing ${streakDays}-day streak! Keep the momentum going.`;
  if (inProgressCount > 0) return `You have ${inProgressCount} course${inProgressCount > 1 ? "s" : ""} in progress. Let's keep learning!`;
  return "Ready to start something new today?";
}

/** Simple layout wrapper (replaces @/components/UnifiedLayout) */
function UnifiedLayout({ children, bgToUse }: { children: React.ReactNode; variant?: string; bgToUse?: string }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: bgToUse || "var(--sb-color-background, #0f0f19)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

/** Learning hat icon (replaces @/components/LearningHatIcon) */
function LearningHatIcon({ size = 24 }: { size?: number; strokeWidth?: number }) {
  return <GraduationCap style={{ width: size, height: size, color: "#000" }} />;
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
  thumbnail?: string;
  image_url?: string;
  progress?: number;
  state?: "draft" | "published" | "archived";
  tags?: string[];
  module_count?: number;
  lesson_count?: number;
  enrolled_count?: number;
  created_at?: string;
  updated_at?: string;
};

const features = [
  {
    icon: BookOpen,
    title: "Interactive Courses",
    description: "Engage with video, audio, articles, and interactive content designed for modern learners.",
  },
  {
    icon: Target,
    title: "Learning Paths",
    description: "Follow curated sequences of courses to achieve specific goals like job readiness or housing stability.",
  },
  {
    icon: Brain,
    title: "AI-Powered Learning",
    description: "Get personalized study plans, smart recommendations, and AI tutor assistance.",
  },
  {
    icon: Trophy,
    title: "Certificates & Badges",
    description: "Earn verified certificates and OpenBadges to showcase your achievements.",
  },
];

const stats = [
  { value: "10K+", label: "Active Learners" },
  { value: "500+", label: "Courses" },
  { value: "98%", label: "Completion Rate" },
  { value: "4.9", label: "Average Rating" },
];

const dashboardStats = [
  { label: "Courses Enrolled", value: "12", icon: BookOpen, color: "text-yellow-400", bg: "bg-yellow-400/10" },
  { label: "Hours Learned", value: "48", icon: Clock, color: "text-blue-400", bg: "bg-blue-400/10" },
  { label: "Certificates", value: "3", icon: Award, color: "text-green-400", bg: "bg-green-400/10" },
  { label: "Current Streak", value: "7 days", icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-400/10" },
];

async function fetchCourses(): Promise<Course[]> {
  try {
    // Use Street Voices academy courses endpoint with local fallback data.
    const response = await sbFetch('/api/academy/courses');
    if (!response.ok) throw new Error("Failed to fetch courses");
    const data = await response.json();
    return Array.isArray(data) ? data : data.courses || [];
  } catch (error) {
    console.error("Error fetching courses:", error);
    return getFallbackCourses();
  }
}

function getFallbackCourses(): Course[] {
  return [
    {
      id: "1",
      title: "Digital Marketing Fundamentals",
      description: "Learn the basics of digital marketing, social media strategy, and content creation",
      level: "Beginner",
      duration: "6 weeks",
      category: "Marketing",
      instructor: "Sarah Johnson",
      progress: 65,
    },
    {
      id: "2",
      title: "Web Development Bootcamp",
      description: "Full-stack web development with React, Node.js, and MongoDB",
      level: "Intermediate",
      duration: "12 weeks",
      category: "Technology",
      instructor: "Michael Chen",
      progress: 30,
    },
    {
      id: "3",
      title: "Entrepreneurship 101",
      description: "Start and grow your own business with practical strategies and real-world examples",
      level: "Beginner",
      duration: "8 weeks",
      category: "Business",
      instructor: "David Williams",
      progress: 0,
    },
    {
      id: "4",
      title: "Graphic Design Essentials",
      description: "Master the fundamentals of graphic design, typography, and visual communication",
      level: "Beginner",
      duration: "10 weeks",
      category: "Design",
      instructor: "Emily Rodriguez",
      progress: 90,
    },
  ];
}

export default function AcademyClient() {
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const { isMobile, isTablet } = useResponsive();
  const sidebar = useResponsiveSidebar();

  const navPaddingLeft = isMobile ? "16px" : "calc(max(16px, var(--sidebar-width, 0px)) + 20px)";
  const [view, setView] = useState<"landing" | "dashboard">("landing");
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // User state for personalization (would typically come from auth context)
  const [userName, setUserName] = useState<string | null>(null);
  const [userStats] = useState({
    coursesEnrolled: 0,
    hoursLearned: 0,
    certificates: 0,
    streakDays: 0,
  });

  // Fetch user profile for personalization
  useEffect(() => {
    async function fetchUserProfile() {
      try {
        // Try to get user from localStorage or API
        const storedName = localStorage.getItem("sv_user_name");
        if (storedName) {
          setUserName(storedName);
        }
        // In production, you would fetch from API:
        // const response = await fetch(`${API_BASE_URL}/users/me`);
        // const user = await response.json();
        // setUserName(user.name);
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    }
    fetchUserProfile();
  }, []);

  useEffect(() => {
    fetchCourses().then((data) => {
      const courseList = data.length > 0 ? data : getFallbackCourses();
      setCourses(courseList);
      setLoading(false);
    });
  }, []);

  // Theme-aware colors - TRUE GLASSMORPHISM
  const colors = useMemo(
    () => ({
      bg: isDark ? "var(--sb-color-background)" : "var(--sb-color-background)",
      // Glass surfaces - VERY translucent so background shows through
      surface: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.25)",
      surfaceHover: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.35)",
      // Glass borders - subtle white edge to catch light
      border: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.5)",
      borderHover: isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.7)",
      text: isDark ? "#fff" : "#111",
      textSecondary: isDark ? "rgba(255, 255, 255, 0.7)" : "#4b5563",
      textMuted: isDark ? "rgba(255, 255, 255, 0.5)" : "#6b7280",
      accent: "#FFD600",
      // Glass card - very translucent
      cardBg: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.3)",
      // Glass shadow - soft and subtle
      glassShadow: isDark
        ? "0 8px 32px rgba(0, 0, 0, 0.3)"
        : "0 8px 32px rgba(31, 38, 135, 0.15)",
    }),
    [isDark]
  );

  if (view === "dashboard") {
    return (
      <UnifiedLayout variant="dashboard" bgToUse={colors.bg}>
        {/* GLASSMORPHISM Background - Vivid colors that show through glass */}
        {/* Primary gradient orb - top center (purple/violet) */}
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
        {/* Secondary gradient orb - right (pink/magenta) */}
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
        {/* Tertiary gradient orb - bottom left (cyan/teal) */}
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
        {/* Accent gradient orb - center right (yellow/gold) */}
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

        <nav style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
          background: colors.surface, backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderBottom: `1px solid ${colors.border}`,
          boxShadow: colors.glassShadow,
        }}>
          <div
            className="w-full pr-4 sm:pr-6 lg:pr-8"
            style={{ paddingLeft: navPaddingLeft }}
          >
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                {/* Mobile menu toggle */}
                {isMobile && (
                  <button
                    onClick={sidebar.toggle}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    aria-label={sidebar.isOpen ? "Close menu" : "Open menu"}
                  >
                    {sidebar.isOpen ? (
                      <X className="w-6 h-6" style={{ color: colors.text }} />
                    ) : (
                      <Menu className="w-6 h-6" style={{ color: colors.text }} />
                    )}
                  </button>
                )}

                <button
                  onClick={() => setView("landing")}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <div className="w-10 h-10 rounded-xl bg-yellow-400 flex items-center justify-center">
                    <LearningHatIcon size={24} strokeWidth={1.8} />
                  </div>
                  {!isMobile && (
                    <span className="font-bold text-xl">Street Voices Academy</span>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  title="Search courses"
                >
                  <Search className="w-5 h-5 text-gray-400" />
                </button>
                <button
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors relative"
                  title="Notifications"
                >
                  <Bell className="w-5 h-5 text-gray-400" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                </button>
                {!isMobile && (
                  <button
                    onClick={() => setView("landing")}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Exit Dashboard
                  </button>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isMobile && sidebar.isOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={sidebar.close}
                className="fixed inset-0 z-40"
                style={{ background: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(4px)" }}
              />
              {/* Sidebar */}
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
                <div className="p-4 border-b" style={{ borderColor: colors.border }}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg" style={{ color: colors.text }}>Menu</span>
                    <button onClick={sidebar.close} className="p-2 rounded-lg hover:bg-white/10">
                      <X className="w-5 h-5" style={{ color: colors.text }} />
                    </button>
                  </div>
                </div>
                <AcademySidebar />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Desktop Sidebar */}
        {!isMobile && <AcademySidebar />}

        {/* Dashboard Content */}
        <div
          className="pt-24 px-4 sm:px-6 pb-8"
          style={{
            marginLeft: isMobile ? 0 : isTablet ? "60px" : "calc(var(--sidebar-width, 0px) + 240px)",
            transition: "margin-left 0.3s ease",
          }}
        >
          {/* Breadcrumb Navigation */}
          {isMobile ? (
            <BreadcrumbCompact
              items={[
                { label: "Academy", href: "/academy", icon: "home" },
                { label: "Dashboard", icon: "home" },
              ]}
              className="mb-4"
            />
          ) : (
            <Breadcrumb
              items={[
                { label: "Academy", href: "/academy", icon: "home" },
                { label: "Dashboard" },
              ]}
              className="mb-6"
            />
          )}

          {/* Loading State with Skeleton */}
          {loading ? (
            <DashboardSkeleton />
          ) : (
            <>
              <>
              {/* Welcome Section - Personalized */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
              >
                <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: colors.text }}>
                  {getPersonalizedGreeting(userName)}
                </h2>
                <p style={{ color: colors.textSecondary }}>
                  {getMotivationalMessage(courses.filter(c => (c.progress || 0) > 0 && (c.progress || 0) < 100).length, userStats.streakDays)}
                </p>
              </motion.div>

              {/* Stats Grid - Responsive */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8 sm:mb-12">
                {dashboardStats.map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    style={{
                      background: colors.cardBg,
                      backdropFilter: "blur(24px) saturate(180%)",
                      WebkitBackdropFilter: "blur(24px) saturate(180%)",
                      borderRadius: isMobile ? "16px" : "24px",
                      border: `1px solid ${colors.border}`,
                      padding: isMobile ? "16px" : "24px",
                      boxShadow: colors.glassShadow,
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isMobile) {
                        e.currentTarget.style.transform = "translateY(-4px)";
                        e.currentTarget.style.borderColor = colors.borderHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isMobile) {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.borderColor = colors.border;
                      }
                    }}
                  >
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${stat.bg} flex items-center justify-center mb-3 sm:mb-4`}>
                      <stat.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.color}`} />
                    </div>
                    <div className="text-xl sm:text-3xl font-bold mb-1" style={{ color: colors.text }}>{stat.value}</div>
                    <div style={{ color: colors.textSecondary }} className="text-xs sm:text-sm">{stat.label}</div>
                  </motion.div>
                ))}
              </div>

              {/* Continue Learning - Responsive */}
              <div className="mb-8 sm:mb-12">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h3 className="text-xl sm:text-2xl font-bold" style={{ color: colors.text }}>Continue Learning</h3>
                  <a
                    href="/academy/courses"
                    className="text-yellow-400 hover:text-yellow-300 text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2"
                  >
                    View All <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                  </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {courses.slice(0, 2).map((course, index) => (
                    <motion.div
                      key={course.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + index * 0.1 }}
                      style={{
                        background: colors.cardBg,
                        backdropFilter: "blur(24px) saturate(180%)",
                        WebkitBackdropFilter: "blur(24px) saturate(180%)",
                        borderRadius: isMobile ? "16px" : "24px",
                        border: `1px solid ${colors.border}`,
                        padding: isMobile ? "16px" : "24px",
                        boxShadow: colors.glassShadow,
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                      className="group"
                      onMouseEnter={(e) => {
                        if (!isMobile) {
                          e.currentTarget.style.transform = "translateY(-4px)";
                          e.currentTarget.style.borderColor = "rgba(255, 214, 0, 0.5)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isMobile) {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.borderColor = colors.border;
                        }
                      }}
                    >
                      <div className="flex items-start justify-between mb-3 sm:mb-4">
                        <div className="flex-1 min-w-0">
                          <span style={{ color: colors.textMuted }} className="text-xs uppercase tracking-wide">{course.category}</span>
                          <h4 style={{ color: colors.text }} className="text-base sm:text-lg font-bold mt-1 group-hover:text-yellow-400 transition-colors truncate">
                            {course.title}
                          </h4>
                        </div>
                        <Play className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
                      </div>
                      <p style={{ color: colors.textSecondary }} className="text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">{course.description}</p>

                      {/* Progress Bar */}
                      {course.progress !== undefined && (
                        <div>
                          <div className="flex items-center justify-between text-xs sm:text-sm mb-2">
                            <span style={{ color: colors.textSecondary }}>Progress</span>
                            <span className="text-yellow-400 font-medium">{course.progress}%</span>
                          </div>
                          <div style={{ background: "rgba(255, 255, 255, 0.1)" }} className="w-full rounded-full h-1.5 sm:h-2">
                            <motion.div
                              className="bg-yellow-400 h-full rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${course.progress}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* All Courses - Responsive */}
              <div>
                <h3 style={{ color: colors.text }} className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Explore Courses</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                  {courses.map((course, index) => (
                    <motion.div
                      key={course.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      viewport={{ once: true }}
                      style={{
                        background: colors.cardBg,
                        backdropFilter: "blur(24px) saturate(180%)",
                        WebkitBackdropFilter: "blur(24px) saturate(180%)",
                        borderRadius: isMobile ? "16px" : "24px",
                        border: `1px solid ${colors.border}`,
                        overflow: "hidden",
                        boxShadow: colors.glassShadow,
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        cursor: "pointer",
                      }}
                      className="group"
                      onMouseEnter={(e) => {
                        if (!isMobile) {
                          e.currentTarget.style.transform = "translateY(-4px)";
                          e.currentTarget.style.borderColor = "rgba(255, 214, 0, 0.5)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isMobile) {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.borderColor = colors.border;
                        }
                      }}
                    >
                      {/* Thumbnail Placeholder */}
                      <div className="h-24 sm:h-40 bg-gradient-to-br from-yellow-400/20 to-purple-600/20 flex items-center justify-center">
                        <BookOpen className="w-8 h-8 sm:w-12 sm:h-12 text-yellow-400 opacity-50" />
                      </div>

                      <div className="p-3 sm:p-4">
                        <span style={{ color: colors.textMuted }} className="text-[10px] sm:text-xs uppercase tracking-wide">{course.category}</span>
                        <h4 style={{ color: colors.text }} className="font-bold text-sm sm:text-base mt-1 mb-1 sm:mb-2 group-hover:text-yellow-400 transition-colors line-clamp-1 sm:line-clamp-none">
                          {course.title}
                        </h4>
                        <p style={{ color: colors.textSecondary }} className="text-xs sm:text-sm mb-2 sm:mb-3 line-clamp-2 hidden sm:block">{course.description}</p>

                        <div style={{ color: colors.textMuted }} className="flex items-center justify-between text-[10px] sm:text-xs">
                          <span>{course.level}</span>
                          <span className="hidden sm:inline">{course.duration}</span>
                        </div>

                        {/* Ask Instructor Button - Hidden on mobile for space */}
                        {course.instructor && !isMobile && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const context = encodeURIComponent(
                                `I have a question about the course "${course.title}"${course.instructor ? ` taught by ${course.instructor}` : ""}. Can you help me?`
                              );
                              window.location.href = `/chat?context=${context}`;
                            }}
                            className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all"
                            style={{
                              background: isDark ? "rgba(255, 214, 0, 0.15)" : "rgba(255, 214, 0, 0.2)",
                              color: colors.accent,
                              border: `1px solid ${isDark ? "rgba(255, 214, 0, 0.3)" : "rgba(255, 214, 0, 0.4)"}`,
                            }}
                          >
                            <MessageCircle size={14} />
                            Ask About Course
                          </button>
                        )}
                        {!isMobile && (
                          <div style={{ marginTop: 8 }}>
                            <CrossLink
                              icon={CalendarDays}
                              label="Schedule Study"
                              to={`/calendar?action=new&title=${encodeURIComponent('Study: ' + course.title)}`}
                              variant="chip"
                              color="#8b5cf6"
                            />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
              </>
            </>
          )}
        </div>
      </UnifiedLayout>
    );
  }

  return (
    <UnifiedLayout variant="full" bgToUse={colors.bg}>
      {/* GLASSMORPHISM Background - Vivid colors that show through glass */}
      {/* Primary gradient orb - top center (purple/violet) */}
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
      {/* Secondary gradient orb - right (pink/magenta) */}
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
      {/* Tertiary gradient orb - bottom left (cyan/teal) */}
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
      {/* Accent gradient orb - center right (yellow/gold) */}
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

      {/* Navigation */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        background: colors.surface, backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        borderBottom: `1px solid ${colors.border}`,
        boxShadow: colors.glassShadow,
      }}>
          <div
            className="w-full pr-4 sm:pr-6 lg:pr-8"
            style={{ paddingLeft: navPaddingLeft }}
          >
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-yellow-400 flex items-center justify-center">
                <LearningHatIcon size={24} strokeWidth={1.8} />
              </div>
              <span className="font-bold text-xl">Street Voices Academy</span>
            </div>

            {/* Nav Links - Clean landing page nav */}
            <div className="hidden md:flex items-center gap-6">
              <a href="/academy/courses" className="text-gray-400 hover:text-white transition-colors">
                Courses
              </a>
              <a href="/academy/paths" className="text-gray-400 hover:text-white transition-colors">
                Learning Paths
              </a>
              <a href="/academy/live-sessions" className="text-green-400 hover:text-green-300 transition-colors flex items-center gap-1">
                <Video className="w-4 h-4" />
                Live
              </a>
              <a href="/academy/instructor" className="text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1">
                <ClipboardCheck className="w-4 h-4" />
                Instructor
              </a>
              <a href="/groups" className="text-gray-400 hover:text-white transition-colors">
                Community
              </a>
            </div>

            {/* CTA Button */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setView("dashboard")}
                className="px-6 py-2 bg-yellow-400 text-black rounded-full font-medium hover:bg-yellow-300 transition-colors"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden" style={{ zIndex: 1 }}>
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,215,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,215,0,0.03)_1px,transparent_1px)] bg-[size:50px_50px] opacity-30" />

        <div className="relative max-w-7xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            {/* Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "9999px",
                background: colors.cardBg,
                backdropFilter: "blur(24px) saturate(180%)",
                WebkitBackdropFilter: "blur(24px) saturate(180%)",
                border: `1px solid rgba(255, 214, 0, 0.3)`,
                marginBottom: "32px",
              }}
            >
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-yellow-400 font-medium">AI-Powered Learning Platform</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              The Future of
              <br />
              <span className="bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
                Learning is Here
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
              Immerse yourself in a futuristic learning experience with AI tutors, live classes, and personalized
              learning paths designed for the next generation of creators.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => setView("dashboard")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "16px 32px",
                  background: colors.accent,
                  color: "#000",
                  borderRadius: "9999px",
                  fontWeight: 700,
                  fontSize: "18px",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(255, 214, 0, 0.4)",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 30px rgba(255, 214, 0, 0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 20px rgba(255, 214, 0, 0.4)";
                }}
              >
                Start Learning Free
                <ArrowRight className="w-5 h-5" />
              </button>
              <a
                href="/academy/courses"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "16px 32px",
                  background: colors.cardBg,
                  backdropFilter: "blur(24px) saturate(180%)",
                  WebkitBackdropFilter: "blur(24px) saturate(180%)",
                  color: colors.text,
                  borderRadius: "9999px",
                  fontWeight: 500,
                  fontSize: "18px",
                  border: `1px solid ${colors.border}`,
                  textDecoration: "none",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255, 214, 0, 0.5)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <Play className="w-5 h-5" />
                Explore Courses
              </a>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20"
          >
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-yellow-400 mb-2">{stat.value}</div>
                <div className="text-gray-400">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4" style={{ position: "relative", zIndex: 1 }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 style={{ color: colors.text }} className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to
              <span className="text-yellow-400"> Level Up</span>
            </h2>
            <p style={{ color: colors.textSecondary }} className="max-w-2xl mx-auto">
              A complete learning ecosystem designed for the modern creator, powered by cutting-edge technology.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                style={{
                  background: colors.cardBg,
                  backdropFilter: "blur(24px) saturate(180%)",
                  WebkitBackdropFilter: "blur(24px) saturate(180%)",
                  borderRadius: "24px",
                  border: `1px solid ${colors.border}`,
                  padding: "24px",
                  boxShadow: colors.glassShadow,
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                className="group"
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.borderColor = "rgba(255, 214, 0, 0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = colors.border;
                }}
              >
                <div className="w-12 h-12 rounded-xl bg-yellow-400/10 flex items-center justify-center mb-4 group-hover:bg-yellow-400/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-yellow-400" />
                </div>
                <h3 style={{ color: colors.text }} className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p style={{ color: colors.textSecondary }} className="text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Learning Paths Section */}
      <section className="py-20 px-4" style={{ position: "relative", zIndex: 1 }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 style={{ color: colors.text }} className="text-3xl md:text-4xl font-bold mb-4">
              Follow a <span className="text-yellow-400">Learning Path</span>
            </h2>
            <p style={{ color: colors.textSecondary }} className="max-w-2xl mx-auto">
              Structured sequences of courses designed to help you achieve specific goals.
              Perfect for building skills progressively.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {[
              {
                icon: Briefcase,
                title: "Job Ready",
                description: "Complete path to employment readiness",
                color: "#10B981",
                courses: 4,
                hours: 40,
                slug: "job-ready",
              },
              {
                icon: Laptop,
                title: "Digital Basics",
                description: "Essential computer and internet skills",
                color: "#3B82F6",
                courses: 4,
                hours: 24,
                slug: "digital-basics",
              },
              {
                icon: Home,
                title: "Housing Stability",
                description: "Skills for finding and keeping housing",
                color: "#8B5CF6",
                courses: 4,
                hours: 32,
                slug: "housing-stability",
              },
            ].map((path, index) => (
              <motion.div
                key={path.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <a href={`/academy/paths/${path.slug}`}>
                  <div
                    style={{
                      background: colors.cardBg,
                      backdropFilter: "blur(24px) saturate(180%)",
                      WebkitBackdropFilter: "blur(24px) saturate(180%)",
                      borderRadius: "24px",
                      border: `1px solid ${colors.border}`,
                      padding: "24px",
                      boxShadow: colors.glassShadow,
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      height: "100%",
                    }}
                    className="group"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px)";
                      e.currentTarget.style.borderColor = "rgba(255, 214, 0, 0.5)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.borderColor = colors.border;
                    }}
                  >
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
                      style={{ backgroundColor: `${path.color}20` }}
                    >
                      <path.icon className="w-7 h-7" style={{ color: path.color }} />
                    </div>
                    <h3 style={{ color: colors.text }} className="font-bold text-xl mb-2 group-hover:text-yellow-400 transition-colors">
                      {path.title}
                    </h3>
                    <p style={{ color: colors.textSecondary }} className="text-sm mb-4">{path.description}</p>
                    <div style={{ color: colors.textMuted }} className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-4 h-4" />
                        {path.courses} courses
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {path.hours}h
                      </span>
                    </div>
                  </div>
                </a>
              </motion.div>
            ))}
          </div>

          <div className="text-center">
            <a
              href="/academy/paths"
              className="inline-flex items-center gap-2 text-yellow-400 hover:text-yellow-300 font-medium"
            >
              View All Learning Paths
              <ChevronRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>

      {/* Featured Courses */}
      {!loading && courses.length > 0 && (
        <section className="py-20 px-4" style={{ position: "relative", zIndex: 1 }}>
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 style={{ color: colors.text }} className="text-3xl font-bold">Popular Courses</h2>
              <a
                href="/academy/courses"
                className="text-yellow-400 hover:text-yellow-300 font-medium flex items-center gap-2"
              >
                View All <ChevronRight className="w-5 h-5" />
              </a>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {courses.slice(0, 4).map((course, index) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                  style={{
                    background: colors.cardBg,
                    backdropFilter: "blur(24px) saturate(180%)",
                    WebkitBackdropFilter: "blur(24px) saturate(180%)",
                    borderRadius: "24px",
                    border: `1px solid ${colors.border}`,
                    overflow: "hidden",
                    boxShadow: colors.glassShadow,
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    cursor: "pointer",
                  }}
                  className="group"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.borderColor = "rgba(255, 214, 0, 0.5)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  <div className="h-40 bg-gradient-to-br from-yellow-400/20 to-purple-600/20 flex items-center justify-center">
                    <BookOpen className="w-12 h-12 text-yellow-400 opacity-50" />
                  </div>

                  <div className="p-4">
                    <span style={{ color: colors.textMuted }} className="text-xs uppercase tracking-wide">{course.category}</span>
                    <h4 style={{ color: colors.text }} className="font-bold mt-1 mb-2 group-hover:text-yellow-400 transition-colors">
                      {course.title}
                    </h4>
                    <p style={{ color: colors.textSecondary }} className="text-sm mb-3 line-clamp-2">{course.description}</p>

                    <div style={{ color: colors.textMuted }} className="flex items-center justify-between text-xs">
                      <span>{course.level}</span>
                      <span>{course.duration}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 px-4" style={{ position: "relative", zIndex: 1 }}>
        <div className="max-w-4xl mx-auto">
          <div
            style={{
              position: "relative",
              background: colors.cardBg,
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              border: `1px solid ${colors.border}`,
              borderRadius: "32px",
              padding: "48px",
              textAlign: "center",
              overflow: "hidden",
              boxShadow: colors.glassShadow,
            }}
          >
            {/* Inner gradient glow */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "radial-gradient(ellipse at center, rgba(255, 214, 0, 0.1) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />
            <div className="relative">
              <h2 style={{ color: colors.text }} className="text-3xl md:text-4xl font-bold mb-4">Ready to Transform Your Learning?</h2>
              <p style={{ color: colors.textSecondary }} className="mb-8 max-w-xl mx-auto">
                Join thousands of learners already experiencing the future of education. Start your journey today.
              </p>
              <button
                onClick={() => setView("dashboard")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "16px 32px",
                  background: colors.accent,
                  color: "#000",
                  borderRadius: "9999px",
                  fontWeight: 700,
                  fontSize: "18px",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(255, 214, 0, 0.4)",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 30px rgba(255, 214, 0, 0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 20px rgba(255, 214, 0, 0.4)";
                }}
              >
                Get Started for Free
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: `1px solid ${colors.border}`,
          padding: "48px 0",
          background: colors.surface,
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center" style={{ color: colors.textMuted }}>
            <p>&copy; 2024 Street Voices. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* AI Tutor Floating Button */}
      <AiTutorFloatingButton showPulse />
    </UnifiedLayout>
  );
}

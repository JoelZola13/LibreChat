import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Compass,
  GraduationCap,
  Layers3,
  Sparkles,
  Target,
  Users,
  Video,
} from "lucide-react";
import { useAcademyOverviewData, type AcademyOverviewCertificate } from "../academy/useAcademyOverviewData";
import { getAcademyRoleForProfile, getInstructorNameForProfile, type AcademyProfileRole } from "./academyStreetProfiles";

type StreetProfileAcademyTabProps = {
  profile: {
    user_id: string;
    username: string;
    display_name: string;
    primary_roles?: string[];
    academy_role?: AcademyProfileRole;
  };
  canEditProfile?: boolean;
  isDark: boolean;
  colors: {
    accent: string;
    text: string;
    textSecondary: string;
    border?: string;
  };
};

type SectionCardProps = {
  title: string;
  eyebrow?: string;
  description: string;
  children: React.ReactNode;
  href?: string;
  footerLabel?: string;
  colors: StreetProfileAcademyTabProps["colors"];
  isDark: boolean;
};

type ListItem = {
  id: string;
  title: string;
  detail?: string;
  badge?: string;
  href?: string;
};

function formatSessionDate(isoDate?: string | null) {
  if (!isoDate) {
    return "Scheduled soon";
  }

  return new Date(isoDate).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeDate(isoDate?: string | null) {
  if (!isoDate) {
    return "Recently";
  }

  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (Number.isNaN(diffMs)) {
    return "Recently";
  }

  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays}d ago`;
  }

  return new Date(isoDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function sortByNewest<T>(items: T[], pickDate: (item: T) => string | null | undefined) {
  return [...items].sort((left, right) => {
    const leftDate = new Date(pickDate(left) || 0).getTime();
    const rightDate = new Date(pickDate(right) || 0).getTime();
    return rightDate - leftDate;
  });
}

function SectionCard({ title, eyebrow, description, children, href, footerLabel, colors, isDark }: SectionCardProps) {
  const borderColor = colors.border ?? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)");
  const surface = isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.84)";
  const card = (
    <section
      style={{
        borderRadius: "24px",
        padding: "24px",
        background: surface,
        border: `1px solid ${borderColor}`,
        boxShadow: isDark ? "0 18px 48px rgba(0,0,0,0.22)" : "0 18px 48px rgba(31,41,55,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
        transition: href ? "transform 0.18s ease, box-shadow 0.18s ease" : undefined,
        cursor: href ? "pointer" : "default",
      }}
    >
      <div>
        {eyebrow ? (
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: colors.textSecondary,
              marginBottom: "8px",
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <h3 style={{ margin: "0 0 8px 0", fontSize: "22px", fontWeight: 800, color: colors.text }}>{title}</h3>
        <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6, color: colors.textSecondary }}>{description}</p>
      </div>

      <div style={{ display: "grid", gap: "12px" }}>{children}</div>

      {footerLabel ? (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: colors.accent,
            fontWeight: 700,
          }}
        >
          {footerLabel}
          <ArrowRight size={15} />
        </div>
      ) : null}
    </section>
  );

  return href ? (
    <Link to={href} style={{ textDecoration: "none", display: "block" }}>
      {card}
    </Link>
  ) : (
    card
  );
}

function EmptyMessage({ message, colors }: { message: string; colors: StreetProfileAcademyTabProps["colors"] }) {
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "18px",
        background: "rgba(255,255,255,0.04)",
        color: colors.textSecondary,
        fontSize: "14px",
        lineHeight: 1.6,
      }}
    >
      {message}
    </div>
  );
}

function ListRows({
  items,
  colors,
  isDark,
  icon,
}: {
  items: ListItem[];
  colors: StreetProfileAcademyTabProps["colors"];
  isDark: boolean;
  icon?: React.ReactNode;
}) {
  const borderColor = colors.border ?? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)");
  const surface = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.92)";

  return (
    <>
      {items.map((item) => {
        const content = (
          <div
            style={{
              borderRadius: "18px",
              padding: "16px",
              background: surface,
              border: `1px solid ${borderColor}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", minWidth: 0 }}>
              {icon ? (
                <div style={{ marginTop: "2px", color: colors.accent, flexShrink: 0 }}>{icon}</div>
              ) : null}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "15px", fontWeight: 700, color: colors.text }}>{item.title}</div>
                {item.detail ? (
                  <div style={{ marginTop: "4px", fontSize: "13px", lineHeight: 1.5, color: colors.textSecondary }}>
                    {item.detail}
                  </div>
                ) : null}
              </div>
            </div>
            {item.badge ? (
              <div
                style={{
                  padding: "6px 10px",
                  borderRadius: "999px",
                  background: "rgba(255,214,0,0.12)",
                  color: colors.accent,
                  fontSize: "12px",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {item.badge}
              </div>
            ) : null}
          </div>
        );

        return item.href ? (
          <Link key={item.id} to={item.href} style={{ textDecoration: "none" }}>
            {content}
          </Link>
        ) : (
          <div key={item.id}>{content}</div>
        );
      })}
    </>
  );
}

function certificateSortDate(certificate: AcademyOverviewCertificate) {
  return certificate.award_date || certificate.issued_at || certificate.updated_at || null;
}

export default function StreetProfileAcademyTab({
  profile,
  canEditProfile = false,
  isDark,
  colors,
}: StreetProfileAcademyTabProps) {
  const location = useLocation();
  const academyRole = getAcademyRoleForProfile(profile);
  const instructorName = getInstructorNameForProfile(profile);
  const {
    targetUserId,
    role,
    hasAcademyData,
    paths,
    loading,
    publishedCourses,
    activeEnrollments,
    enrolledUpcomingSessions,
    enrollmentByCourseId,
    enrolledCourses,
    enrolledPathSummaries,
    recommendedPath,
    certificates,
    inProgressCoursesCount,
    completedCoursesCount,
    instructorCourses,
    instructorSessions,
    instructorCourseEnrollmentMap,
  } = useAcademyOverviewData({
    academyUserId: profile.user_id,
    academyRole,
    instructorName,
  });

  const effectiveRole = role ?? academyRole ?? "student";
  const borderColor = colors.border ?? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)");
  const surface = isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.82)";
  const surfaceStrong = isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.94)";

  const currentPath = useMemo(() => {
    const inFlight = enrolledPathSummaries
      .filter((summary) => summary.progress > 0 && summary.progress < 100)
      .sort((left, right) => right.progress - left.progress)[0];
    return inFlight ?? recommendedPath;
  }, [enrolledPathSummaries, recommendedPath]);

  const currentCourses = useMemo(
    () =>
      enrolledCourses
        .filter((course) => {
          const progress = enrollmentByCourseId[course.id]?.progress_percent ?? 0;
          return progress > 0 && progress < 100;
        })
        .sort(
          (left, right) =>
            (enrollmentByCourseId[right.id]?.progress_percent ?? 0) -
            (enrollmentByCourseId[left.id]?.progress_percent ?? 0),
        ),
    [enrolledCourses, enrollmentByCourseId],
  );

  const completedCourses = useMemo(
    () =>
      sortByNewest(
        enrolledCourses.filter((course) => (enrollmentByCourseId[course.id]?.progress_percent ?? 0) >= 100),
        (course) => enrollmentByCourseId[course.id]?.completed_at || enrollmentByCourseId[course.id]?.last_accessed_at,
      ),
    [enrolledCourses, enrollmentByCourseId],
  );

  const pathById = useMemo(
    () => {
      const map = new Map<string, (typeof paths)[number]>();
      paths.forEach((path) => {
        map.set(path.slug, path);
        if (path.id) {
          map.set(path.id, path);
        }
      });
      return map;
    },
    [paths],
  );

  const courseById = useMemo(
    () => new Map(publishedCourses.map((course) => [course.id, course])),
    [publishedCourses],
  );

  const achievementItems = useMemo(() => {
    const certificateItems = sortByNewest(certificates, certificateSortDate).map((certificate) => {
      const isPathCertificate =
        certificate.target_type === "learning_path" || Boolean(certificate.learning_path_id);
      const targetId = certificate.target_id || certificate.learning_path_id || certificate.course_id || certificate.id;
      const matchingPath = isPathCertificate ? pathById.get(targetId || "") : null;
      const matchingCourse = certificate.course_id ? courseById.get(certificate.course_id) : null;
      const title =
        certificate.target_title ||
        matchingPath?.title ||
        matchingCourse?.title ||
        certificate.certificate_title ||
        "Academy achievement";

      return {
        id: certificate.id,
        title: isPathCertificate ? `${title} - Completed` : `Certificate: ${certificate.certificate_title || title}`,
        detail: isPathCertificate
          ? "Completed program"
          : `Issued ${formatRelativeDate(certificateSortDate(certificate))}`,
        href: isPathCertificate
          ? matchingPath
            ? `/academy/paths/${matchingPath.slug}`
            : "/academy/paths"
          : certificate.course_id
            ? `/academy/courses/${certificate.course_id}`
            : "/academy/certificates",
      };
    });

    const fallbackPathAchievements = enrolledPathSummaries
      .filter((summary) => summary.progress >= 100)
      .map((summary) => ({
        id: `path-${summary.path.slug}`,
        title: `${summary.path.title} - Completed`,
        detail: "Completed program",
        href: `/academy/paths/${summary.path.slug}`,
      }));

    return Array.from(
      new Map(
        [...certificateItems, ...fallbackPathAchievements].map((item) => [item.title.toLowerCase(), item]),
      ).values(),
    ).slice(0, 4);
  }, [certificates, courseById, enrolledPathSummaries, pathById]);

  const lastActiveAt = useMemo(() => {
    const timestamps = activeEnrollments
      .map((enrollment) => enrollment.last_accessed_at)
      .filter((value): value is string => Boolean(value));
    return sortByNewest(timestamps, (value) => value)[0] ?? null;
  }, [activeEnrollments]);

  const recentActivityItems = useMemo(() => {
    const items: ListItem[] = [];

    if (lastActiveAt) {
      items.push({
        id: "last-active",
        title: `Last active ${formatRelativeDate(lastActiveAt)}`,
        detail: "Still showing up and building momentum in Academy.",
      });
    }

    completedCourses.slice(0, 2).forEach((course) => {
      items.push({
        id: `completed-${course.id}`,
        title: `Completed ${course.title}`,
        detail: `Finished ${formatRelativeDate(
          enrollmentByCourseId[course.id]?.completed_at || enrollmentByCourseId[course.id]?.last_accessed_at,
        )}`,
        href: `/academy/courses/${course.id}`,
      });
    });

    enrolledUpcomingSessions.slice(0, 1).forEach((session) => {
      items.push({
        id: `session-${session.id}`,
        title: session.title,
        detail: `Upcoming live session - ${formatSessionDate(session.scheduled_start)}`,
        href: `/academy/live-sessions/${session.id}`,
      });
    });

    return items.slice(0, 4);
  }, [completedCourses, enrolledUpcomingSessions, enrollmentByCourseId, lastActiveAt]);

  const instructorCourseSummaries = useMemo(
    () =>
      instructorCourses
        .map((course) => {
          const enrollments = (instructorCourseEnrollmentMap[course.id] || []).filter(
            (enrollment) => enrollment.status !== "dropped",
          );
          const studentCount = new Set(enrollments.map((enrollment) => enrollment.user_id)).size;
          const activeStudentCount = enrollments.filter((enrollment) => enrollment.progress_percent < 100).length;
          const completedStudentCount = enrollments.filter((enrollment) => enrollment.progress_percent >= 100).length;

          return {
            course,
            studentCount,
            activeStudentCount,
            completedStudentCount,
            statusLabel: activeStudentCount > 0 || course.state === "published" ? "Active" : "Completed",
          };
        })
        .sort((left, right) => right.studentCount - left.studentCount),
    [instructorCourseEnrollmentMap, instructorCourses],
  );

  const instructorCourseIds = useMemo(
    () => new Set(instructorCourses.map((course) => course.id)),
    [instructorCourses],
  );

  const instructorPaths = useMemo(
    () =>
      paths.filter((path) => {
        const createdByInstructor = Boolean(targetUserId) && path.createdBy === targetUserId;
        const pathCourseIds = Array.isArray(path.courseIds) ? path.courseIds : [];
        const includesInstructorCourse = pathCourseIds.some((courseId) => instructorCourseIds.has(courseId));
        return createdByInstructor || includesInstructorCourse;
      }),
    [instructorCourseIds, paths, targetUserId],
  );

  const sortedInstructorSessions = useMemo(
    () =>
      [...instructorSessions].sort(
        (left, right) => new Date(right.scheduled_start).getTime() - new Date(left.scheduled_start).getTime(),
      ),
    [instructorSessions],
  );

  const totalStudentsTaught = useMemo(() => {
    const learnerIds = new Set<string>();
    Object.values(instructorCourseEnrollmentMap).forEach((enrollments) => {
      enrollments.forEach((enrollment) => {
        if (enrollment.status !== "dropped") {
          learnerIds.add(enrollment.user_id);
        }
      });
    });
    return learnerIds.size;
  }, [instructorCourseEnrollmentMap]);

  const studentStats = [
    { label: "Programs", value: `${enrolledPathSummaries.length || (currentPath ? 1 : 0)}`, icon: Compass, color: "#FACC15" },
    { label: "In Progress", value: `${inProgressCoursesCount}`, icon: Target, color: "#8B5CF6" },
    { label: "Completed", value: `${completedCoursesCount}`, icon: CheckCircle2, color: "#10B981" },
    { label: "Achievements", value: `${achievementItems.length}`, icon: Award, color: "#60A5FA" },
  ];

  const instructorStats = [
    { label: "Courses Taught", value: `${instructorCourses.length}`, icon: BookOpen, color: "#FACC15" },
    { label: "Students Taught", value: `${totalStudentsTaught}`, icon: Users, color: "#8B5CF6" },
    { label: "Live Sessions", value: `${sortedInstructorSessions.length}`, icon: Video, color: "#10B981" },
    { label: "Programs", value: `${instructorPaths.length}`, icon: Layers3, color: "#60A5FA" },
  ];

  const heroTitle =
    effectiveRole === "instructor"
      ? "What I teach and what I've built"
      : "What I'm learning and what I've completed";
  const heroDescription =
    effectiveRole === "instructor"
      ? "This is what I teach. Courses, programs, live sessions, and the impact I have built through Street Voices Academy all live here inside the same Street Profile system."
      : "This is what I'm learning. Courses, completions, achievements, and recent activity are connected directly to Street Voices Academy so growth shows up right on the profile.";
  const detailBasePath = location.pathname.startsWith("/settings")
    ? "/settings/academy"
    : `/creatives/${profile.username}/academy`;
  const currentLearningHref = `${detailBasePath}/currently-learning`;
  const completedCoursesHref = `${detailBasePath}/completed-courses`;
  const achievementsHref = `${detailBasePath}/achievements`;
  const activityHref = `${detailBasePath}/activity`;
  const coursesTaughtHref = `${detailBasePath}/courses-taught`;
  const learningPathsHref = `${detailBasePath}/learning-paths`;
  const liveSessionsHref = `${detailBasePath}/live-sessions`;
  const primaryHref =
    effectiveRole === "instructor"
      ? canEditProfile
        ? "/academy/instructor"
        : instructorCourses[0]
          ? `/academy/courses/${instructorCourses[0].id}`
          : "/academy/courses"
      : currentPath
        ? `/academy/paths/${currentPath.path.slug}`
        : "/academy/dashboard";
  const primaryLabel =
    effectiveRole === "instructor"
      ? canEditProfile
        ? "Open Academy Instructor View"
        : "Browse Taught Courses"
      : "Open Academy Dashboard";

  if (loading) {
    return (
      <div
        style={{
          borderRadius: "24px",
          padding: "32px",
          background: surface,
          border: `1px solid ${borderColor}`,
          color: colors.textSecondary,
        }}
      >
        Loading Academy profile data...
      </div>
    );
  }

  if (!hasAcademyData) {
    return (
      <div
        style={{
          borderRadius: "24px",
          padding: "32px",
          background: surface,
          border: `1px solid ${borderColor}`,
          display: "grid",
          gap: "16px",
        }}
      >
        <div style={{ fontSize: "24px", fontWeight: 800, color: colors.text }}>Academy tab not connected yet</div>
        <p style={{ margin: 0, fontSize: "15px", lineHeight: 1.6, color: colors.textSecondary }}>
          This profile does not have connected Street Voices Academy activity yet. Once courses, enrollments, or
          teaching activity exist, this tab will populate automatically.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          <Link
            to="/academy"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 18px",
              borderRadius: "999px",
              background: colors.accent,
              color: "#000",
              fontWeight: 700,
              fontSize: "14px",
              textDecoration: "none",
            }}
          >
            Open Academy Home
            <ArrowRight size={16} />
          </Link>
          {canEditProfile ? (
            <Link
              to="/settings"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 18px",
                borderRadius: "999px",
                background: surfaceStrong,
                color: colors.text,
                fontWeight: 700,
                fontSize: "14px",
                textDecoration: "none",
                border: `1px solid ${borderColor}`,
              }}
            >
              Update Profile
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <section
        style={{
          borderRadius: "28px",
          padding: "32px",
          background: isDark
            ? "linear-gradient(135deg, rgba(255,214,0,0.08), rgba(59,130,246,0.08) 55%, rgba(16,185,129,0.08))"
            : "linear-gradient(135deg, rgba(255,214,0,0.14), rgba(59,130,246,0.08) 55%, rgba(16,185,129,0.08))",
          border: `1px solid ${borderColor}`,
          boxShadow: isDark ? "0 18px 48px rgba(0,0,0,0.22)" : "0 18px 48px rgba(31,41,55,0.08)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              borderRadius: "999px",
              background: "rgba(255,214,0,0.14)",
              color: colors.accent,
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <GraduationCap size={14} />
            Street Voices Academy
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              borderRadius: "999px",
              background: surfaceStrong,
              color: colors.textSecondary,
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {effectiveRole === "instructor" ? <Sparkles size={14} /> : <Target size={14} />}
            {effectiveRole === "instructor" ? "Instructor Profile" : "Student Profile"}
          </span>
        </div>

        <h2 style={{ margin: "0 0 10px 0", fontSize: "32px", lineHeight: 1.1, fontWeight: 800, color: colors.text }}>
          {heroTitle}
        </h2>
        <p style={{ margin: 0, maxWidth: "860px", fontSize: "15px", lineHeight: 1.6, color: colors.textSecondary }}>
          {profile.display_name}'s Academy tab is role-aware inside one shared profile layout. {heroDescription}
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "24px" }}>
          <Link
            to={primaryHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 18px",
              borderRadius: "999px",
              background: colors.accent,
              color: "#000",
              fontWeight: 700,
              fontSize: "14px",
              textDecoration: "none",
            }}
          >
            {primaryLabel}
            <ArrowRight size={16} />
          </Link>
          <Link
            to="/academy"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 18px",
              borderRadius: "999px",
              background: surfaceStrong,
              color: colors.text,
              fontWeight: 700,
              fontSize: "14px",
              textDecoration: "none",
              border: `1px solid ${borderColor}`,
            }}
          >
            Open Academy Home
          </Link>
          {canEditProfile ? (
            <Link
              to="/settings"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 18px",
                borderRadius: "999px",
                background: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.68)",
                color: colors.text,
                fontWeight: 700,
                fontSize: "14px",
                textDecoration: "none",
                border: `1px solid ${borderColor}`,
              }}
            >
              Update Profile
            </Link>
          ) : null}
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
        {(effectiveRole === "instructor" ? instructorStats : studentStats).map((stat) => (
          <div
            key={stat.label}
            style={{
              borderRadius: "22px",
              padding: "20px",
              background: surface,
              border: `1px solid ${borderColor}`,
              boxShadow: isDark ? "0 18px 48px rgba(0,0,0,0.22)" : "0 18px 48px rgba(31,41,55,0.08)",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: `${stat.color}18`,
                marginBottom: "14px",
              }}
            >
              <stat.icon size={22} color={stat.color} />
            </div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: colors.text }}>{stat.value}</div>
            <div style={{ marginTop: "4px", fontSize: "13px", color: colors.textSecondary }}>{stat.label}</div>
          </div>
        ))}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
        {effectiveRole === "instructor" ? (
          <>
            <SectionCard
              title="Courses Taught"
              description="What I teach and the learners I am supporting right now."
              href={coursesTaughtHref}
              footerLabel="View all courses taught"
              colors={colors}
              isDark={isDark}
            >
              {instructorCourseSummaries.length > 0 ? (
                <ListRows
                  items={instructorCourseSummaries.slice(0, 4).map((summary) => ({
                    id: summary.course.id,
                    title: summary.course.title,
                    detail: `${summary.studentCount} ${summary.studentCount === 1 ? "student" : "students"} - ${summary.statusLabel}`,
                    badge: summary.statusLabel,
                  }))}
                  colors={colors}
                  isDark={isDark}
                  icon={<BookOpen size={16} />}
                />
              ) : (
                <EmptyMessage message="Courses taught through Academy will show up here." colors={colors} />
              )}
            </SectionCard>

            <SectionCard
              title="Programs"
              description="Programs this instructor contributes to or has created."
              href={learningPathsHref}
              footerLabel="View all programs"
              colors={colors}
              isDark={isDark}
            >
              {instructorPaths.length > 0 ? (
                <ListRows
                  items={instructorPaths.slice(0, 4).map((path) => ({
                    id: path.slug,
                    title: path.title,
                    detail: `${Array.isArray(path.courseIds) && path.courseIds.length > 0 ? path.courseIds.length : path.courses} courses - ${path.hours} hours`,
                  }))}
                  colors={colors}
                  isDark={isDark}
                  icon={<Compass size={16} />}
                />
              ) : (
                <EmptyMessage message="Programs linked to this instructor will appear here." colors={colors} />
              )}
            </SectionCard>

            <SectionCard
              title="Live Sessions"
              description="Sessions, workshops, and office hours hosted through Academy."
              href={liveSessionsHref}
              footerLabel="View all live sessions"
              colors={colors}
              isDark={isDark}
            >
              {sortedInstructorSessions.length > 0 ? (
                <ListRows
                  items={sortedInstructorSessions.slice(0, 4).map((session) => ({
                    id: session.id,
                    title: session.title,
                    detail: `${formatSessionDate(session.scheduled_start)} - ${session.status === "scheduled" ? "Scheduled" : "Completed"}`,
                  }))}
                  colors={colors}
                  isDark={isDark}
                  icon={<CalendarDays size={16} />}
                />
              ) : (
                <EmptyMessage message="Hosted sessions will appear here once they are scheduled." colors={colors} />
              )}
            </SectionCard>

            <SectionCard
              title="Impact"
              description="A quick view of the reach and structure behind this instructor's Academy work."
              colors={colors}
              isDark={isDark}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
                {[
                  { label: "Students taught", value: `${totalStudentsTaught}` },
                  { label: "Courses created", value: `${instructorCourses.length}` },
                  { label: "Active courses", value: `${instructorCourseSummaries.filter((item) => item.statusLabel === "Active").length}` },
                  { label: "Sessions hosted", value: `${sortedInstructorSessions.length}` },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      padding: "16px",
                      borderRadius: "18px",
                      background: surfaceStrong,
                      border: `1px solid ${borderColor}`,
                    }}
                  >
                    <div style={{ fontSize: "24px", fontWeight: 800, color: colors.text }}>{item.value}</div>
                    <div style={{ marginTop: "4px", fontSize: "13px", color: colors.textSecondary }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </>
        ) : (
          <>
            <SectionCard
              title="Currently Learning"
              description="What I'm learning right now and how far I've come in the current path."
              href={currentLearningHref}
              footerLabel="View all programs"
              colors={colors}
              isDark={isDark}
            >
              {currentPath ? (
                <div
                  style={{
                    borderRadius: "18px",
                    padding: "18px",
                    background: surfaceStrong,
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.textSecondary }}>
                    Current Program
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "20px", fontWeight: 800, color: colors.text }}>
                    {currentPath.path.title}
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "14px", color: colors.textSecondary }}>
                    Progress: {currentPath.progress}% complete
                  </div>
                </div>
              ) : null}

              {currentCourses.length > 0 ? (
                <ListRows
                  items={currentCourses.slice(0, 4).map((course) => ({
                    id: course.id,
                    title: course.title,
                    detail: "Current course",
                    badge: `${enrollmentByCourseId[course.id]?.progress_percent ?? 0}% complete`,
                  }))}
                  colors={colors}
                  isDark={isDark}
                  icon={<BookOpen size={16} />}
                />
              ) : (
                <EmptyMessage message="Current courses will appear here once learning is underway." colors={colors} />
              )}
            </SectionCard>

            <SectionCard
              title="Completed Courses"
              description="Finished Academy courses with clear signals that work has been completed."
              href={completedCoursesHref}
              footerLabel="View all completed courses"
              colors={colors}
              isDark={isDark}
            >
              {completedCourses.length > 0 ? (
                <ListRows
                  items={completedCourses.slice(0, 4).map((course) => ({
                    id: course.id,
                    title: course.title,
                    detail: "Completed course",
                  }))}
                  colors={colors}
                  isDark={isDark}
                  icon={<CheckCircle2 size={16} />}
                />
              ) : (
                <EmptyMessage message="Completed courses will show up here with checkmarks and certificates." colors={colors} />
              )}
            </SectionCard>

            <SectionCard
              title="Achievements"
              description="Certificates earned and programs completed through Academy."
              href={achievementsHref}
              footerLabel="View all achievements"
              colors={colors}
              isDark={isDark}
            >
              {achievementItems.length > 0 ? (
                <ListRows
                  items={achievementItems.map((item) => ({
                    ...item,
                    href: undefined,
                  }))}
                  colors={colors}
                  isDark={isDark}
                  icon={<Award size={16} />}
                />
              ) : (
                <EmptyMessage message="Certificates and completed programs will appear here as progress turns into milestones." colors={colors} />
              )}
            </SectionCard>

            <SectionCard
              title="Activity"
              description="Recent Academy activity, from last active moments to fresh completions."
              href={activityHref}
              footerLabel="View all activity"
              colors={colors}
              isDark={isDark}
            >
              {recentActivityItems.length > 0 ? (
                <ListRows
                  items={recentActivityItems.map((item) => ({
                    ...item,
                    href: undefined,
                  }))}
                  colors={colors}
                  isDark={isDark}
                  icon={<CalendarDays size={16} />}
                />
              ) : (
                <EmptyMessage message="Recent Academy activity will show up here once the learner starts engaging with courses and sessions." colors={colors} />
              )}
            </SectionCard>
          </>
        )}
      </section>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AcademyLearningPath } from "./academyLearningPaths";
import { resolveLearningPathCourses } from "./academyLearningPaths";
import { listSessions, type LiveSession } from "./api/live-sessions";
import { useAcademyLearningPaths } from "./useAcademyLearningPaths";
import { useAcademyUserId } from "./useAcademyUserId";
import { sbFetch } from "../shared/sbFetch";
import { subscribeToAcademyDataRefresh } from "../shared/academyDataSync";
import type { AcademyProfileRole } from "../profile/academyStreetProfiles";

export type AcademyOverviewCourse = {
  id: string;
  title: string;
  description?: string;
  level?: string;
  duration?: string;
  category?: string;
  instructor?: string;
  instructor_id?: string | null;
  instructor_name?: string | null;
  progress?: number;
  state?: "draft" | "published" | "archived";
  module_count?: number;
  lesson_count?: number;
};

export type AcademyOverviewEnrollment = {
  id: string;
  user_id: string;
  course_id: string;
  status: "active" | "completed" | "dropped";
  progress_percent: number;
  last_accessed_at?: string | null;
  enrolled_at?: string | null;
  completed_at?: string | null;
};

export type AcademyOverviewCertificate = {
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
  issued_at?: string | null;
  updated_at?: string | null;
  verification_code?: string | null;
};

export type AcademyOverviewPathSummary = {
  path: AcademyLearningPath;
  includedCourses: AcademyOverviewCourse[];
  completedCount: number;
  progress: number;
  nextCourse: AcademyOverviewCourse | null;
};

export type AcademyOverviewOptions = {
  academyUserId?: string | null;
  academyRole?: AcademyProfileRole | null;
  instructorName?: string | null;
  enabled?: boolean;
};

function normalizeArray<T>(data: unknown, fallbacks: string[] = []): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  }

  if (data && typeof data === "object") {
    for (const key of fallbacks) {
      const candidate = (data as Record<string, unknown>)[key];
      if (Array.isArray(candidate)) {
        return candidate as T[];
      }
    }
  }

  return [];
}

async function fetchCourses(query?: Record<string, string>): Promise<AcademyOverviewCourse[]> {
  const params = new URLSearchParams(query);
  const response = await sbFetch(`/api/academy/courses${params.toString() ? `?${params.toString()}` : ""}`);
  if (!response.ok) {
    throw new Error("Failed to fetch courses");
  }

  const data = await response.json();
  return normalizeArray<AcademyOverviewCourse>(data, ["courses", "data"]);
}

async function fetchEnrollments(query: Record<string, string>): Promise<AcademyOverviewEnrollment[]> {
  const params = new URLSearchParams(query);
  const response = await sbFetch(`/api/academy/enrollments?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch enrollments");
  }

  const data = await response.json();
  return normalizeArray<AcademyOverviewEnrollment>(data, ["enrollments", "courses", "data"]);
}

async function fetchCertificates(userId: string): Promise<AcademyOverviewCertificate[]> {
  const response = await sbFetch(`/api/academy/certificates/${encodeURIComponent(userId)}`);
  if (!response.ok) {
    throw new Error("Failed to fetch certificates");
  }

  const data = await response.json();
  return normalizeArray<AcademyOverviewCertificate>(data, ["certificates", "data"]);
}

function dedupeCourses(courses: AcademyOverviewCourse[]) {
  return Array.from(new Map(courses.map((course) => [course.id, course])).values());
}

export function useAcademyOverviewData(options: AcademyOverviewOptions = {}) {
  const fallbackUserId = useAcademyUserId();
  const { paths, loading: learningPathsLoading } = useAcademyLearningPaths();
  const explicitUserId = options.academyUserId?.trim() || "";
  const isEnabled = options.enabled !== false;
  const targetUserId = explicitUserId || (isEnabled ? fallbackUserId : "");
  const normalizedInstructorName = options.instructorName?.trim().toLowerCase() || "";

  const [courses, setCourses] = useState<AcademyOverviewCourse[]>([]);
  const [enrollments, setEnrollments] = useState<AcademyOverviewEnrollment[]>([]);
  const [certificates, setCertificates] = useState<AcademyOverviewCertificate[]>([]);
  const [userSessions, setUserSessions] = useState<LiveSession[]>([]);
  const [instructorCourses, setInstructorCourses] = useState<AcademyOverviewCourse[]>([]);
  const [instructorSessions, setInstructorSessions] = useState<LiveSession[]>([]);
  const [instructorCourseEnrollmentMap, setInstructorCourseEnrollmentMap] = useState<
    Record<string, AcademyOverviewEnrollment[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const refresh = useCallback(() => {
    setRefreshNonce((current) => current + 1);
  }, []);

  useEffect(() => {
    return subscribeToAcademyDataRefresh(refresh);
  }, [refresh]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!isEnabled) {
        if (isMounted) {
          setCourses([]);
          setEnrollments([]);
          setCertificates([]);
          setUserSessions([]);
          setInstructorCourses([]);
          setInstructorSessions([]);
          setInstructorCourseEnrollmentMap({});
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        const shouldLoadInstructor = Boolean(targetUserId) || Boolean(normalizedInstructorName);
        const emptySessionResponse = {
          sessions: [],
          total: 0,
          upcoming_count: 0,
          live_count: 0,
        };

        const [
          allCourses,
          enrollmentData,
          certificateData,
          learnerSessionResponse,
          queriedInstructorCourses,
          instructorSessionResponse,
        ] = await Promise.all([
          fetchCourses().catch(() => []),
          targetUserId ? fetchEnrollments({ user_id: targetUserId }).catch(() => []) : Promise.resolve([]),
          targetUserId ? fetchCertificates(targetUserId).catch(() => []) : Promise.resolve([]),
          targetUserId ? listSessions({ userId: targetUserId }).catch(() => emptySessionResponse) : Promise.resolve(emptySessionResponse),
          shouldLoadInstructor && targetUserId
            ? fetchCourses({ instructor_id: targetUserId }).catch(() => [])
            : Promise.resolve([]),
          shouldLoadInstructor && targetUserId
            ? listSessions({ instructorId: targetUserId }).catch(() => emptySessionResponse)
            : Promise.resolve(emptySessionResponse),
        ]);

        const fallbackInstructorCourses = shouldLoadInstructor
          ? allCourses.filter((course) => {
              const matchesInstructorId = Boolean(targetUserId) && course.instructor_id === targetUserId;
              const instructorNames = [course.instructor_name, course.instructor]
                .map((value) => String(value || "").trim().toLowerCase())
                .filter(Boolean);
              const matchesInstructorName = Boolean(normalizedInstructorName) && instructorNames.includes(normalizedInstructorName);
              return matchesInstructorId || matchesInstructorName;
            })
          : [];

        const finalInstructorCourses = dedupeCourses([
          ...normalizeArray<AcademyOverviewCourse>(queriedInstructorCourses, ["courses", "data"]),
          ...fallbackInstructorCourses,
        ]);

        const instructorEnrollmentGroups = finalInstructorCourses.length
          ? await Promise.all(
              finalInstructorCourses.map((course) =>
                fetchEnrollments({ course_id: course.id }).catch(() => []),
              ),
            )
          : [];

        if (!isMounted) {
          return;
        }

        setCourses(allCourses);
        setEnrollments(enrollmentData);
        setCertificates(certificateData);
        setUserSessions(learnerSessionResponse.sessions || []);
        setInstructorCourses(finalInstructorCourses);
        setInstructorSessions((instructorSessionResponse.sessions || []).filter((session) => session.status !== "cancelled"));
        setInstructorCourseEnrollmentMap(
          Object.fromEntries(
            finalInstructorCourses.map((course, index) => [course.id, instructorEnrollmentGroups[index] || []]),
          ),
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [isEnabled, normalizedInstructorName, refreshNonce, targetUserId]);

  const publishedCourses = useMemo(
    () => courses.filter((course) => !course.state || course.state === "published"),
    [courses],
  );

  const activeEnrollments = useMemo(
    () => enrollments.filter((enrollment) => enrollment.status !== "dropped"),
    [enrollments],
  );

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

  const pathSummaries = useMemo<AcademyOverviewPathSummary[]>(
    () =>
      paths.map((path) => {
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
      }),
    [enrollmentByCourseId, paths, publishedCourses],
  );

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

  const continueCourse = useMemo(
    () =>
      enrolledCourses.find((course) => {
        const progress = enrollmentByCourseId[course.id]?.progress_percent ?? 0;
        return progress > 0 && progress < 100;
      }) ??
      enrolledCourses[0] ??
      null,
    [enrollmentByCourseId, enrolledCourses],
  );

  const completedCoursesCount = useMemo(
    () => activeEnrollments.filter((enrollment) => enrollment.progress_percent >= 100).length,
    [activeEnrollments],
  );

  const inProgressCoursesCount = useMemo(
    () =>
      activeEnrollments.filter(
        (enrollment) => enrollment.progress_percent > 0 && enrollment.progress_percent < 100,
      ).length,
    [activeEnrollments],
  );

  const upcomingSessions = useMemo(() => {
    const now = Date.now();
    return [...userSessions]
      .filter((session) => session.status === "scheduled" && new Date(session.scheduled_end).getTime() >= now)
      .sort((left, right) => new Date(left.scheduled_start).getTime() - new Date(right.scheduled_start).getTime());
  }, [userSessions]);

  const enrolledUpcomingSessions = useMemo(
    () => upcomingSessions.filter((session) => enrolledCourseIds.has(session.course_id)),
    [enrolledCourseIds, upcomingSessions],
  );

  const resolvedRole = useMemo<AcademyProfileRole | null>(() => {
    if (instructorCourses.length > 0 || instructorSessions.length > 0) {
      return "instructor";
    }
    if (activeEnrollments.length > 0 || certificates.length > 0) {
      return "student";
    }
    return options.academyRole ?? null;
  }, [activeEnrollments.length, certificates.length, instructorCourses.length, instructorSessions.length, options.academyRole]);

  const hasAcademyData =
    activeEnrollments.length > 0 ||
    certificates.length > 0 ||
    instructorCourses.length > 0 ||
    instructorSessions.length > 0;

  return {
    targetUserId,
    role: resolvedRole,
    hasAcademyData,
    paths,
    loading: loading || learningPathsLoading,
    hasEnrollment: activeEnrollments.length > 0,
    publishedCourses,
    activeEnrollments,
    upcomingSessions,
    enrolledUpcomingSessions,
    enrollmentByCourseId,
    enrolledCourses,
    enrolledPathSummaries,
    recommendedPath,
    continueCourse,
    completedCoursesCount,
    inProgressCoursesCount,
    certificates,
    instructorCourses,
    instructorSessions,
    instructorCourseEnrollmentMap,
    refresh,
  };
}

import { useEffect, useMemo, useState } from "react";
import { sbFetch } from "../shared/sbFetch";
import { useAcademyUserId } from "./useAcademyUserId";

type Enrollment = {
  id?: string;
  course_id: string;
  status?: "active" | "completed" | "dropped" | string;
  progress_percent?: number;
};

export function useAcademyEnrollmentAccess() {
  const userId = useAcademyUserId();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const response = await sbFetch(`/api/academy/enrollments?user_id=${encodeURIComponent(userId)}`);
        if (!isMounted) {
          return;
        }

        if (!response.ok) {
          setEnrollments([]);
          return;
        }

        const data = await response.json();
        setEnrollments(Array.isArray(data) ? data : []);
      } catch {
        if (isMounted) {
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

  const activeEnrollments = useMemo(
    () => enrollments.filter((enrollment) => enrollment.status !== "dropped"),
    [enrollments],
  );

  return {
    userId,
    enrollments: activeEnrollments,
    loading,
    hasEnrollment: activeEnrollments.length > 0,
  };
}

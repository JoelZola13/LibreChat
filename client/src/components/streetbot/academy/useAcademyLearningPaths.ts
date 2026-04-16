import { useCallback, useEffect, useMemo, useState } from "react";
import { Compass } from "lucide-react";
import { sbFetch } from "../shared/sbFetch";
import { subscribeToAcademyDataRefresh } from "../shared/academyDataSync";
import { academyLearningPaths, type AcademyLearningPath } from "./academyLearningPaths";

type LearningPathApiRecord = {
  id?: string;
  slug?: string;
  title?: string;
  description?: string;
  courses?: number;
  hours?: number;
  level?: string;
  delivery_mode?: string;
  color?: string;
  requirements?: string[];
  what_youll_learn?: string[];
  milestones?: string[];
  outcomes?: string[];
  preferred_categories?: string[];
  course_ids?: string[];
  courseIds?: string[];
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  source?: string;
};

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function transformApiLearningPath(record: LearningPathApiRecord): AcademyLearningPath | null {
  const slug = String(record.slug || "").trim();
  const title = String(record.title || "").trim();
  if (!slug || !title) {
    return null;
  }

  const courseIds = toStringArray(record.course_ids ?? record.courseIds);

  return {
    id: record.id,
    slug,
    title,
    description: String(record.description || "").trim() || `${title} is a guided Academy learning path.`,
    courses: courseIds.length || Number(record.courses) || 0,
    hours: Number(record.hours) || Math.max(courseIds.length * 8, 8),
    level: String(record.level || "").trim() || "Beginner",
    deliveryMode: String(record.delivery_mode || "").trim() || "Online and In person",
    color: String(record.color || "").trim() || "#F97316",
    icon: Compass,
    requirements: toStringArray(record.requirements),
    whatYoullLearn: toStringArray(record.what_youll_learn),
    milestones: toStringArray(record.milestones),
    outcomes: toStringArray(record.outcomes),
    preferredCategories: toStringArray(record.preferred_categories),
    courseIds,
    createdBy: record.created_by ?? null,
    createdAt: record.created_at ?? null,
    updatedAt: record.updated_at ?? null,
    source: "generated",
  };
}

export function useAcademyLearningPaths() {
  const [runtimePaths, setRuntimePaths] = useState<AcademyLearningPath[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await sbFetch("/api/academy/learning-paths");
      if (!response.ok) {
        throw new Error("Failed to fetch learning paths");
      }

      const data = await response.json();
      const normalized = Array.isArray(data)
        ? data
            .map((item) => transformApiLearningPath(item))
            .filter((item): item is AcademyLearningPath => item !== null)
        : [];
      setRuntimePaths(normalized);
    } catch {
      setRuntimePaths([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return subscribeToAcademyDataRefresh(() => {
      void refresh();
    });
  }, [refresh]);

  const paths = useMemo(() => {
    const merged = new Map<string, AcademyLearningPath>();
    academyLearningPaths.forEach((path) =>
      merged.set(path.slug, {
        ...path,
        courseIds: Array.isArray(path.courseIds) ? path.courseIds : [],
      }),
    );
    runtimePaths.forEach((path) =>
      merged.set(path.slug, {
        ...path,
        courseIds: Array.isArray(path.courseIds) ? path.courseIds : [],
      }),
    );
    return Array.from(merged.values());
  }, [runtimePaths]);

  return {
    paths,
    loading,
    refresh,
  };
}

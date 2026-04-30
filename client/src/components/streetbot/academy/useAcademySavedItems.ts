import { useEffect, useMemo, useState } from "react";

const SAVED_PATHS_KEY = "streetvoices-academy-saved-paths";
const SAVED_COURSES_KEY = "streetvoices-academy-saved-courses";

function readSavedItems(key: string) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function useAcademySavedItems() {
  const [savedPaths, setSavedPaths] = useState<string[]>([]);
  const [savedCourses, setSavedCourses] = useState<string[]>([]);

  useEffect(() => {
    setSavedPaths(readSavedItems(SAVED_PATHS_KEY));
    setSavedCourses(readSavedItems(SAVED_COURSES_KEY));
  }, []);

  useEffect(() => {
    localStorage.setItem(SAVED_PATHS_KEY, JSON.stringify(savedPaths));
  }, [savedPaths]);

  useEffect(() => {
    localStorage.setItem(SAVED_COURSES_KEY, JSON.stringify(savedCourses));
  }, [savedCourses]);

  const savedPathSet = useMemo(() => new Set(savedPaths), [savedPaths]);
  const savedCourseSet = useMemo(() => new Set(savedCourses), [savedCourses]);

  return {
    savedPaths,
    savedCourses,
    isPathSaved: (slug: string) => savedPathSet.has(slug),
    isCourseSaved: (courseId: string) => savedCourseSet.has(courseId),
    togglePathSaved: (slug: string) =>
      setSavedPaths((current) => (current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug])),
    toggleCourseSaved: (courseId: string) =>
      setSavedCourses((current) =>
        current.includes(courseId) ? current.filter((item) => item !== courseId) : [...current, courseId],
      ),
  };
}

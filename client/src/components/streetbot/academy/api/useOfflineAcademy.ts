/**
 * Offline Academy hook adapter for LibreChat (Vite).
 * Provides a stub implementation since Service Worker-based offline
 * features require the full SBP offline infrastructure.
 * Components using this hook will work but without actual offline capability.
 */

import { useState, useCallback } from 'react';

export interface UseOfflineAcademyResult {
  isOnline: boolean;
  downloadedCourses: unknown[];
  isLoading: boolean;
  downloadCourse: (courseId: string) => Promise<void>;
  removeCourse: (courseId: string) => Promise<void>;
  isDownloading: boolean;
  downloadProgress: number;
  getCourse: (courseId: string) => Promise<{ course: null; modules: []; lessons: [] }>;
  getLesson: (lessonId: string) => Promise<null>;
  isCourseOffline: (courseId: string) => Promise<boolean>;
  saveProgress: (courseId: string, lessonId: string, status: string) => Promise<void>;
  pendingSyncCount: number;
  syncNow: () => Promise<{ synced: number; failed: number }>;
  storageUsage: { usage: number; quota: number; percent: number };
}

/**
 * Stub hook for offline academy features.
 * Returns sensible defaults; offline download is not supported in LibreChat context.
 */
export function useOfflineAcademy(_userId: string): UseOfflineAcademyResult {
  const [isOnline] = useState(navigator.onLine);

  const downloadCourse = useCallback(async (_courseId: string) => {
    console.warn('Offline download not available in this environment');
  }, []);

  const removeCourse = useCallback(async (_courseId: string) => {
    console.warn('Offline remove not available in this environment');
  }, []);

  const getCourse = useCallback(async (_courseId: string) => {
    return { course: null, modules: [] as [], lessons: [] as [] };
  }, []);

  const getLesson = useCallback(async (_lessonId: string) => {
    return null;
  }, []);

  const isCourseOffline = useCallback(async (_courseId: string) => {
    return false;
  }, []);

  const saveProgress = useCallback(async (_courseId: string, _lessonId: string, _status: string) => {
    // No-op in stub
  }, []);

  const syncNow = useCallback(async () => {
    return { synced: 0, failed: 0 };
  }, []);

  return {
    isOnline,
    downloadedCourses: [],
    isLoading: false,
    downloadCourse,
    removeCourse,
    isDownloading: false,
    downloadProgress: 0,
    getCourse,
    getLesson,
    isCourseOffline,
    saveProgress,
    pendingSyncCount: 0,
    syncNow,
    storageUsage: { usage: 0, quota: 0, percent: 0 },
  };
}

export default useOfflineAcademy;

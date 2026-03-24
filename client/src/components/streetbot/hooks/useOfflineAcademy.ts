/**
 * React hook for offline Academy features.
 * Provides access to offline course content and sync status.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  isOffline,
  onNetworkChange,
  downloadCourseForOffline,
  removeOfflineCourse,
  getDownloadedCourses,
  isCourseAvailableOffline,
  getOfflineCourse,
  getOfflineLesson,
  saveProgressOffline,
  syncPendingChanges,
  initOfflineSync,
  getStorageUsage,
  getPendingSync,
  Course,
  Module,
  Lesson,
} from '@/lib/offline';

export interface UseOfflineAcademyResult {
  // Network status
  isOnline: boolean;

  // Downloaded courses
  downloadedCourses: Course[];
  isLoading: boolean;

  // Download management
  downloadCourse: (courseId: string) => Promise<void>;
  removeCourse: (courseId: string) => Promise<void>;
  isDownloading: boolean;
  downloadProgress: number;

  // Content access
  getCourse: (courseId: string) => Promise<{
    course: Course | null;
    modules: Module[];
    lessons: Lesson[];
  }>;
  getLesson: (lessonId: string) => Promise<Lesson | null>;
  isCourseOffline: (courseId: string) => Promise<boolean>;

  // Progress
  saveProgress: (courseId: string, lessonId: string, status: string) => Promise<void>;

  // Sync
  pendingSyncCount: number;
  syncNow: () => Promise<{ synced: number; failed: number }>;

  // Storage
  storageUsage: { usage: number; quota: number; percent: number };
}

export function useOfflineAcademy(userId: string): UseOfflineAcademyResult {
  const [isOnline, setIsOnline] = useState(true);
  const [downloadedCourses, setDownloadedCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [storageUsage, setStorageUsage] = useState({ usage: 0, quota: 0, percent: 0 });

  // Initialize offline support
  useEffect(() => {
    // Set initial online status
    setIsOnline(navigator.onLine);

    // Initialize offline sync
    const unsubscribe = initOfflineSync(userId);

    // Listen for network changes
    const unsubscribeNetwork = onNetworkChange((online) => {
      setIsOnline(online);
      if (online) {
        // Refresh pending sync count
        refreshPendingCount();
      }
    });

    // Load downloaded courses
    loadDownloadedCourses();

    // Load storage usage
    loadStorageUsage();

    return () => {
      unsubscribe();
      unsubscribeNetwork();
    };
  }, [userId]);

  const loadDownloadedCourses = useCallback(async () => {
    setIsLoading(true);
    try {
      const courses = await getDownloadedCourses();
      setDownloadedCourses(courses);
    } catch (error) {
      console.error('Failed to load downloaded courses:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadStorageUsage = useCallback(async () => {
    try {
      const usage = await getStorageUsage();
      setStorageUsage(usage);
    } catch (error) {
      console.error('Failed to get storage usage:', error);
    }
  }, []);

  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await getPendingSync();
      setPendingSyncCount(pending.length);
    } catch (error) {
      console.error('Failed to get pending sync count:', error);
    }
  }, []);

  const downloadCourse = useCallback(async (courseId: string) => {
    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      // Simulate progress (actual progress would require streaming)
      const progressInterval = setInterval(() => {
        setDownloadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      await downloadCourseForOffline(courseId);

      clearInterval(progressInterval);
      setDownloadProgress(100);

      // Refresh downloaded courses list
      await loadDownloadedCourses();
      await loadStorageUsage();
    } catch (error) {
      console.error('Failed to download course:', error);
      throw error;
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }, [loadDownloadedCourses, loadStorageUsage]);

  const removeCourse = useCallback(async (courseId: string) => {
    try {
      await removeOfflineCourse(courseId);
      await loadDownloadedCourses();
      await loadStorageUsage();
    } catch (error) {
      console.error('Failed to remove course:', error);
      throw error;
    }
  }, [loadDownloadedCourses, loadStorageUsage]);

  const getCourse = useCallback(async (courseId: string) => {
    return getOfflineCourse(courseId);
  }, []);

  const getLesson = useCallback(async (lessonId: string) => {
    return getOfflineLesson(lessonId);
  }, []);

  const isCourseOffline = useCallback(async (courseId: string) => {
    return isCourseAvailableOffline(courseId);
  }, []);

  const saveProgress = useCallback(async (
    courseId: string,
    lessonId: string,
    status: string
  ) => {
    await saveProgressOffline(userId, courseId, lessonId, status);
    await refreshPendingCount();
  }, [userId, refreshPendingCount]);

  const syncNow = useCallback(async () => {
    const result = await syncPendingChanges(userId);
    await refreshPendingCount();
    return result;
  }, [userId, refreshPendingCount]);

  return {
    isOnline,
    downloadedCourses,
    isLoading,
    downloadCourse,
    removeCourse,
    isDownloading,
    downloadProgress,
    getCourse,
    getLesson,
    isCourseOffline,
    saveProgress,
    pendingSyncCount,
    syncNow,
    storageUsage,
  };
}

export default useOfflineAcademy;

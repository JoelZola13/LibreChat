/**
 * Offline Sync Service for Academy.
 * Handles downloading content for offline use and syncing progress.
 */

import {
  initDB,
  saveRecords,
  saveRecord,
  getRecord,
  getByIndex,
  getAllRecords,
  addPendingSync,
  getPendingSync,
  removePendingSync,
  isOffline,
  onNetworkChange,
} from './indexedDB';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Course {
  id: string;
  title: string;
  slug: string;
  description?: string;
  category?: string;
  difficulty?: string;
  thumbnail_url?: string;
  duration_hours?: number;
  is_downloaded?: boolean;
  downloaded_at?: string;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  order_index: number;
}

export interface Lesson {
  id: string;
  module_id: string;
  course_id: string;
  title: string;
  content_type: string;
  content?: string;
  video_url?: string;
  duration_minutes?: number;
  order_index: number;
}

export interface Progress {
  id: string;
  user_id: string;
  course_id: string;
  lesson_id: string;
  status: string;
  completed_at?: string;
}

/**
 * Download a course for offline access.
 */
export async function downloadCourseForOffline(courseId: string): Promise<void> {
  await initDB();

  try {
    // Fetch course details
    const courseRes = await fetch(`${API_BASE}/api/academy/courses/${courseId}`);
    const course = await courseRes.json();

    // Fetch modules
    const modulesRes = await fetch(`${API_BASE}/api/academy/courses/${courseId}/modules`);
    const modules = await modulesRes.json();

    // Fetch all lessons
    const lessons: Lesson[] = [];
    for (const mod of modules) {
      const lessonsRes = await fetch(`${API_BASE}/api/academy/modules/${mod.id}/lessons`);
      const moduleLessons = await lessonsRes.json();
      lessons.push(
        ...moduleLessons.map((l: Lesson) => ({
          ...l,
          course_id: courseId,
        }))
      );
    }

    // Save to IndexedDB
    await saveRecord('courses', {
      ...course,
      is_downloaded: true,
      downloaded_at: new Date().toISOString(),
    });

    await saveRecords('modules', modules);
    await saveRecords('lessons', lessons);

    // Cache media files if available
    if ('caches' in window) {
      const cache = await caches.open('academy-media');
      for (const lesson of lessons) {
        if (lesson.video_url) {
          try {
            await cache.add(lesson.video_url);
          } catch (error) {
            console.warn(`Failed to cache video: ${lesson.video_url}`, error);
          }
        }
      }
    }

    console.log(`Course ${courseId} downloaded for offline access`);
  } catch (error) {
    console.error('Failed to download course:', error);
    throw error;
  }
}

/**
 * Check if a course is available offline.
 */
export async function isCourseAvailableOffline(courseId: string): Promise<boolean> {
  const course = await getRecord<Course>('courses', courseId);
  return course?.is_downloaded === true;
}

/**
 * Get downloaded courses.
 */
export async function getDownloadedCourses(): Promise<Course[]> {
  const courses = await getAllRecords<Course>('courses');
  return courses.filter((c) => c.is_downloaded);
}

/**
 * Get course content from offline storage.
 */
export async function getOfflineCourse(courseId: string): Promise<{
  course: Course | null;
  modules: Module[];
  lessons: Lesson[];
}> {
  const course = await getRecord<Course>('courses', courseId);
  const modules = await getByIndex<Module>('modules', 'course_id', courseId);
  const lessons = await getByIndex<Lesson>('lessons', 'course_id', courseId);

  return {
    course,
    modules: modules.sort((a, b) => a.order_index - b.order_index),
    lessons: lessons.sort((a, b) => a.order_index - b.order_index),
  };
}

/**
 * Get a specific lesson from offline storage.
 */
export async function getOfflineLesson(lessonId: string): Promise<Lesson | null> {
  return getRecord<Lesson>('lessons', lessonId);
}

/**
 * Save progress locally (for offline sync later).
 */
export async function saveProgressOffline(
  userId: string,
  courseId: string,
  lessonId: string,
  status: string
): Promise<void> {
  const progressId = `${userId}-${lessonId}`;
  const progress: Progress = {
    id: progressId,
    user_id: userId,
    course_id: courseId,
    lesson_id: lessonId,
    status,
    completed_at: status === 'completed' ? new Date().toISOString() : undefined,
  };

  await saveRecord('progress', progress);

  // Add to pending sync queue
  await addPendingSync('progress', {
    lesson_id: lessonId,
    status,
    completed_at: progress.completed_at,
  });
}

/**
 * Get offline progress for a course.
 */
export async function getOfflineProgress(
  userId: string,
  courseId: string
): Promise<Progress[]> {
  const allProgress = await getByIndex<Progress>('progress', 'course_id', courseId);
  return allProgress.filter((p) => p.user_id === userId);
}

/**
 * Sync pending changes when back online.
 */
export async function syncPendingChanges(userId: string): Promise<{
  synced: number;
  failed: number;
}> {
  if (isOffline()) {
    return { synced: 0, failed: 0 };
  }

  const pendingItems = await getPendingSync();
  let synced = 0;
  let failed = 0;

  for (const item of pendingItems) {
    try {
      if (item.type === 'progress') {
        const data = item.data as { lesson_id: string; status: string };
        await fetch(`${API_BASE}/api/academy/lessons/${data.lesson_id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, status: data.status }),
        });
      }

      await removePendingSync(item.id);
      synced++;
    } catch (error) {
      console.error(`Failed to sync item ${item.id}:`, error);
      failed++;
    }
  }

  return { synced, failed };
}

/**
 * Initialize offline sync and auto-sync when online.
 */
export function initOfflineSync(userId: string): () => void {
  initDB().catch(console.error);

  const unsubscribe = onNetworkChange(async (online) => {
    if (online) {
      console.log('Back online, syncing pending changes...');
      const result = await syncPendingChanges(userId);
      console.log(`Synced ${result.synced} items, ${result.failed} failed`);
    }
  });

  return unsubscribe;
}

/**
 * Remove downloaded course from offline storage.
 */
export async function removeOfflineCourse(courseId: string): Promise<void> {
  await initDB();

  // Get the course
  const course = await getRecord<Course>('courses', courseId);
  if (course) {
    course.is_downloaded = false;
    await saveRecord('courses', course);
  }

  // Note: We don't delete modules/lessons to allow for partial caching
  // They will be overwritten on next download

  // Clear cached media
  if ('caches' in window) {
    const lessons = await getByIndex<Lesson>('lessons', 'course_id', courseId);
    const cache = await caches.open('academy-media');
    for (const lesson of lessons) {
      if (lesson.video_url) {
        try {
          await cache.delete(lesson.video_url);
        } catch (error) {
          console.warn(`Failed to remove cached video: ${lesson.video_url}`, error);
        }
      }
    }
  }
}

/**
 * Get storage usage info.
 */
export async function getStorageUsage(): Promise<{
  usage: number;
  quota: number;
  percent: number;
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percent = quota > 0 ? (usage / quota) * 100 : 0;
    return { usage, quota, percent };
  }
  return { usage: 0, quota: 0, percent: 0 };
}

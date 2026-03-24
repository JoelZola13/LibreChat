/**
 * Drip Content API service - manages lesson scheduling and availability
 */

const API_BASE = '/sbapi';
const ACADEMY_API = `${API_BASE}/academy`;

// ============================================================================
// TYPES
// ============================================================================

export interface LessonDripSettings {
  available_from?: string | null;
  available_until?: string | null;
  unlock_after_lesson_id?: string | null;
  unlock_after_days?: number | null;
}

export interface LessonAvailability {
  lesson_id: string;
  lesson_title: string;
  module_id: string;
  module_title: string;
  is_available: boolean;
  reason?: string;
  available_from?: string;
  available_until?: string;
  days_until_available?: number;
  prerequisite_lesson_id?: string;
  prerequisite_lesson_title?: string;
}

export interface CourseDripSchedule {
  course_id: string;
  course_title: string;
  lessons: LessonAvailability[];
  total_lessons: number;
  available_lessons: number;
  locked_lessons: number;
}

export interface UnlockSchedule {
  course_id: string;
  locked_lessons: LockedLessonInfo[];
  total_locked: number;
}

export interface LockedLessonInfo {
  lesson_id: string;
  lesson_title: string;
  module_title: string;
  reason?: string;
  available_from?: string;
  days_until_available?: number;
  prerequisite_lesson_id?: string;
}

export interface NextLessonInfo {
  lesson_id?: string;
  lesson_title?: string;
  module_title?: string;
  message?: string;
}

export type DripMode = "weekly" | "daily" | "sequential" | "custom" | "clear";

export interface BulkDripRequest {
  mode: DripMode;
  start_date?: string;
  interval_days?: number;
  require_previous_completion?: boolean;
  lesson_updates?: DripScheduleUpdate[];
}

export interface DripScheduleUpdate {
  lesson_id: string;
  available_from?: string | null;
  available_until?: string | null;
  unlock_after_lesson_id?: string | null;
  unlock_after_days?: number | null;
  clear_drip?: boolean;
}

export interface BulkDripResponse {
  success: boolean;
  mode: DripMode;
  updated_lessons: number;
  total_lessons: number;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Check if a lesson is available for a user
 */
export async function checkLessonAvailability(
  lessonId: string,
  userId: string
): Promise<{ is_available: boolean; reason?: string; available_from?: string; days_until_available?: number }> {
  const response = await fetch(
    `${ACADEMY_API}/lessons/${lessonId}/availability/${userId}`
  );
  if (!response.ok) {
    throw new Error(`Failed to check availability: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Update drip settings for a single lesson
 */
export async function updateLessonDripSettings(
  lessonId: string,
  settings: LessonDripSettings
): Promise<void> {
  const response = await fetch(`${ACADEMY_API}/lessons/${lessonId}/drip`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    throw new Error(`Failed to update drip settings: ${response.statusText}`);
  }
}

/**
 * Clear all drip settings for a lesson
 */
export async function clearLessonDripSettings(lessonId: string): Promise<void> {
  const response = await fetch(`${ACADEMY_API}/lessons/${lessonId}/drip`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to clear drip settings: ${response.statusText}`);
  }
}

/**
 * Get the full drip schedule for a course
 */
export async function getCourseDripSchedule(
  courseId: string,
  userId: string
): Promise<CourseDripSchedule> {
  const response = await fetch(
    `${ACADEMY_API}/courses/${courseId}/drip-schedule/${userId}`
  );
  if (!response.ok) {
    throw new Error(`Failed to get drip schedule: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get the next available lesson for a user
 */
export async function getNextAvailableLesson(
  courseId: string,
  userId: string
): Promise<NextLessonInfo> {
  const response = await fetch(
    `${ACADEMY_API}/courses/${courseId}/next-lesson/${userId}`
  );
  if (!response.ok) {
    throw new Error(`Failed to get next lesson: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Apply bulk drip schedule to a course
 */
export async function applyBulkDripSchedule(
  courseId: string,
  config: BulkDripRequest
): Promise<BulkDripResponse> {
  const response = await fetch(
    `${ACADEMY_API}/courses/${courseId}/drip-schedule/bulk`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to apply bulk drip schedule: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get unlock schedule for locked lessons
 */
export async function getUnlockSchedule(
  courseId: string,
  userId: string
): Promise<UnlockSchedule> {
  const response = await fetch(
    `${ACADEMY_API}/courses/${courseId}/unlock-schedule/${userId}`
  );
  if (!response.ok) {
    throw new Error(`Failed to get unlock schedule: ${response.statusText}`);
  }
  return response.json();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format days until available as a human-readable string
 */
export function formatDaysUntil(days: number): string {
  if (days === 0) return "Available today";
  if (days === 1) return "Available tomorrow";
  if (days < 7) return `Available in ${days} days`;
  if (days < 14) return "Available next week";
  const weeks = Math.floor(days / 7);
  return `Available in ${weeks} week${weeks > 1 ? "s" : ""}`;
}

/**
 * Format available_from date as relative time
 */
export function formatAvailableDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Now available";
  return formatDaysUntil(diffDays);
}

/**
 * Check if a lesson is currently locked based on drip settings
 */
export function isLessonLocked(availability: LessonAvailability): boolean {
  return !availability.is_available;
}

/**
 * Get lock reason as a user-friendly message
 */
export function getLockReasonMessage(availability: LessonAvailability): string {
  if (availability.is_available) return "";

  if (availability.prerequisite_lesson_title) {
    return `Complete "${availability.prerequisite_lesson_title}" first`;
  }

  if (availability.days_until_available !== undefined) {
    return formatDaysUntil(availability.days_until_available);
  }

  if (availability.available_from) {
    return formatAvailableDate(availability.available_from);
  }

  return availability.reason || "This lesson is locked";
}

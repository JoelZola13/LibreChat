/**
 * API client for Academy Cohorts.
 * Time-bound group learning with cohort management.
 */

import { sbFetch } from '../../shared/sbFetch';

const API_BASE = '/api/academy/cohorts';

export interface Cohort {
  id: string;
  course_id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  max_capacity?: number;
  current_enrollment: number;
  status: string;
  is_self_paced: boolean;
  enrollment_deadline?: string;
  instructor_id: string;
  created_at: string;
  updated_at: string;
}

export interface CohortEnrollment {
  id: string;
  cohort_id: string;
  user_id: string;
  status: string;
  progress_percent: number;
  enrolled_at: string;
  completed_at?: string;
}

export interface CohortDeadline {
  id: string;
  cohort_id: string;
  module_id?: string;
  lesson_id?: string;
  assignment_id?: string;
  deadline: string;
  description?: string;
  created_at: string;
}

export interface CohortAnnouncement {
  id: string;
  cohort_id: string;
  author_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
}

export interface CohortAnalytics {
  total_enrolled: number;
  active_count: number;
  completed_count: number;
  average_progress: number;
  completion_rate: number;
  enrollment_by_date: Array<{ date: string; count: number }>;
}

// Cohort CRUD
export async function createCohort(
  data: Omit<Cohort, 'id' | 'current_enrollment' | 'status' | 'created_at' | 'updated_at'>,
  instructorId: string
): Promise<Cohort> {
  const response = await sbFetch(`${API_BASE}?instructor_id=${encodeURIComponent(instructorId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create cohort');
  return response.json();
}

export async function getCohort(cohortId: string): Promise<Cohort> {
  const response = await sbFetch(`${API_BASE}/${cohortId}`);
  if (!response.ok) throw new Error('Cohort not found');
  return response.json();
}

export async function getCourseCohorts(courseId: string, includePast = false): Promise<Cohort[]> {
  const response = await sbFetch(`${API_BASE}/course/${courseId}?include_past=${includePast}`);
  if (!response.ok) throw new Error('Failed to fetch cohorts');
  return response.json();
}

export async function updateCohort(cohortId: string, data: Partial<Cohort>): Promise<Cohort> {
  const response = await sbFetch(`${API_BASE}/${cohortId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update cohort');
  return response.json();
}

export async function deleteCohort(cohortId: string): Promise<void> {
  const response = await sbFetch(`${API_BASE}/${cohortId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete cohort');
}

// Enrollment
export async function enrollInCohort(cohortId: string, userId: string): Promise<{ success: boolean; message: string; enrollment?: CohortEnrollment }> {
  const response = await sbFetch(`${API_BASE}/${cohortId}/enroll?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
  });
  return response.json();
}

export async function unenrollFromCohort(cohortId: string, userId: string): Promise<void> {
  const response = await sbFetch(`${API_BASE}/${cohortId}/enroll?user_id=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to unenroll');
}

export async function getCohortEnrollments(cohortId: string): Promise<CohortEnrollment[]> {
  const response = await sbFetch(`${API_BASE}/${cohortId}/enrollments`);
  if (!response.ok) throw new Error('Failed to fetch enrollments');
  return response.json();
}

export async function getUserCohorts(userId: string): Promise<Cohort[]> {
  const response = await sbFetch(`${API_BASE}/user/${encodeURIComponent(userId)}`);
  if (!response.ok) throw new Error('Failed to fetch user cohorts');
  return response.json();
}

// Deadlines
export async function createDeadline(
  cohortId: string,
  data: { module_id?: string; lesson_id?: string; assignment_id?: string; deadline: string; description?: string }
): Promise<CohortDeadline> {
  const response = await sbFetch(`${API_BASE}/${cohortId}/deadlines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create deadline');
  return response.json();
}

export async function getCohortDeadlines(cohortId: string): Promise<CohortDeadline[]> {
  const response = await sbFetch(`${API_BASE}/${cohortId}/deadlines`);
  if (!response.ok) throw new Error('Failed to fetch deadlines');
  return response.json();
}

export async function getUserDeadlines(userId: string, daysAhead = 14): Promise<CohortDeadline[]> {
  const response = await sbFetch(`${API_BASE}/user/${encodeURIComponent(userId)}/deadlines?days_ahead=${daysAhead}`);
  if (!response.ok) throw new Error('Failed to fetch deadlines');
  return response.json();
}

// Announcements
export async function createAnnouncement(
  cohortId: string,
  data: { title: string; content: string; is_pinned?: boolean },
  authorId: string
): Promise<CohortAnnouncement> {
  const response = await sbFetch(`${API_BASE}/${cohortId}/announcements?author_id=${encodeURIComponent(authorId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create announcement');
  return response.json();
}

export async function getCohortAnnouncements(cohortId: string, limit = 20): Promise<CohortAnnouncement[]> {
  const response = await sbFetch(`${API_BASE}/${cohortId}/announcements?limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch announcements');
  return response.json();
}

// Analytics
export async function getCohortAnalytics(cohortId: string): Promise<CohortAnalytics> {
  const response = await sbFetch(`${API_BASE}/${cohortId}/analytics`);
  if (!response.ok) throw new Error('Failed to fetch analytics');
  return response.json();
}

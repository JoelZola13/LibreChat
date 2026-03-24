/**
 * Moodle API adapter for LibreChat Academy frontend.
 *
 * Provides typed access to the Moodle-specific backend endpoints
 * exposed at /api/academy/moodle/...
 */

import { sbFetch } from '../../shared/sbFetch';

const MOODLE_BASE = '/api/academy/moodle';

// =============================================================================
// Types
// =============================================================================

export interface MoodleForum {
  id: number;
  course: number;
  name: string;
  intro: string;
  type: string;
  numdiscussions?: number;
}

export interface MoodleDiscussion {
  id: number;
  name: string;
  subject: string;
  message: string;
  userfullname: string;
  userid: number;
  created: number;
  modified: number;
  numreplies: number;
  pinned: boolean;
  timemodified: number;
}

export interface MoodleGradeItem {
  id: number;
  itemname: string;
  itemtype: string;
  itemmodule?: string;
  graderaw?: number | null;
  gradeformatted?: string;
  grademin?: number;
  grademax?: number;
  percentageformatted?: string;
  feedback?: string;
}

export interface MoodleCalendarEvent {
  id: number;
  name: string;
  description: string;
  modulename?: string;
  courseid?: number;
  coursefullname?: string;
  timestart: number;
  timeduration: number;
  eventtype: string;
  url?: string;
  action?: {
    name: string;
    url: string;
    actionable: boolean;
  };
}

export interface MoodleBadge {
  id: number;
  name: string;
  description: string;
  badgeurl?: string;
  issuername?: string;
  courseid?: number;
  dateissued?: number;
  timecreated?: number;
  timemodified?: number;
}

export interface MoodleAssignment {
  id: number;
  cmid: number;
  course: number;
  name: string;
  intro?: string;
  duedate: number;
  allowsubmissionsfromdate: number;
  cutoffdate: number;
  grade: number;
  nosubmissions: number;
  submissiondrafts: number;
}

// =============================================================================
// Forums API
// =============================================================================

export async function getCourseForums(courseId: string): Promise<MoodleForum[]> {
  const res = await sbFetch(`${MOODLE_BASE}/forums/${courseId}`);
  if (!res.ok) throw new Error(`Failed to fetch forums: ${res.status}`);
  const data = await res.json();
  return data.forums || [];
}

export async function getForumDiscussions(
  forumId: number,
  page = 0,
  perPage = 25,
): Promise<MoodleDiscussion[]> {
  const res = await sbFetch(
    `${MOODLE_BASE}/forums/${forumId}/discussions?page=${page}&per_page=${perPage}`,
  );
  if (!res.ok) throw new Error(`Failed to fetch discussions: ${res.status}`);
  const data = await res.json();
  return data.discussions || [];
}

export async function createForumDiscussion(
  forumId: number,
  subject: string,
  message: string,
): Promise<unknown> {
  const res = await sbFetch(`${MOODLE_BASE}/forums/${forumId}/discussions`, {
    method: 'POST',
    body: JSON.stringify({ subject, message }),
  });
  if (!res.ok) throw new Error(`Failed to create discussion: ${res.status}`);
  return res.json();
}

// =============================================================================
// Grades API
// =============================================================================

export async function getCourseGrades(
  userId: string,
  courseId: string,
): Promise<MoodleGradeItem[]> {
  const res = await sbFetch(`${MOODLE_BASE}/grades/${userId}/${courseId}`);
  if (!res.ok) throw new Error(`Failed to fetch grades: ${res.status}`);
  const data = await res.json();
  return data.grade_items || [];
}

// =============================================================================
// Calendar API
// =============================================================================

export async function getCalendarEvents(
  userId: string,
): Promise<MoodleCalendarEvent[]> {
  const res = await sbFetch(`${MOODLE_BASE}/calendar/${userId}`);
  if (!res.ok) throw new Error(`Failed to fetch calendar: ${res.status}`);
  const data = await res.json();
  return data.events || [];
}

// =============================================================================
// Badges API
// =============================================================================

export async function getUserBadges(
  userId: string,
  courseId?: string,
): Promise<MoodleBadge[]> {
  let url = `${MOODLE_BASE}/badges/${userId}`;
  if (courseId) url += `?course_id=${courseId}`;
  const res = await sbFetch(url);
  if (!res.ok) throw new Error(`Failed to fetch badges: ${res.status}`);
  const data = await res.json();
  return data.badges || [];
}

// =============================================================================
// Assignments API
// =============================================================================

export async function getCourseAssignments(
  courseId: string,
): Promise<MoodleAssignment[]> {
  const res = await sbFetch(`${MOODLE_BASE}/assignments/${courseId}`);
  if (!res.ok) throw new Error(`Failed to fetch assignments: ${res.status}`);
  const data = await res.json();
  return data.assignments || [];
}

export async function submitAssignment(
  assignmentId: number,
  text: string,
): Promise<unknown> {
  const res = await sbFetch(`${MOODLE_BASE}/assignments/${assignmentId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Failed to submit assignment: ${res.status}`);
  return res.json();
}

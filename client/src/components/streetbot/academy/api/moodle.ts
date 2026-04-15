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

export interface MoodleDiscussionReply {
  id: number;
  message: string;
  userfullname: string;
  userid: string | number;
  author_role?: 'student' | 'instructor';
  created: number;
}

export interface MoodleDiscussionReactions {
  up: Array<string | number>;
  down: Array<string | number>;
}

export type MoodleDiscussionReactionType = 'up' | 'down';

export interface MoodleDiscussion {
  id: number;
  name: string;
  subject: string;
  message: string;
  userfullname: string;
  userid: string | number;
  author_role?: 'student' | 'instructor';
  created: number;
  modified: number;
  numreplies: number;
  pinned: boolean;
  timemodified: number;
  replies?: MoodleDiscussionReply[];
  reactions?: MoodleDiscussionReactions;
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

export interface CreateForumDiscussionOptions {
  authorName?: string;
  authorId?: string | number;
  authorRole?: 'student' | 'instructor';
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
  options: CreateForumDiscussionOptions = {},
): Promise<MoodleDiscussion> {
  const res = await sbFetch(`${MOODLE_BASE}/forums/${forumId}/discussions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject,
      message,
      author_name: options.authorName,
      author_id: options.authorId,
      author_role: options.authorRole,
    }),
  });
  if (!res.ok) throw new Error(`Failed to create discussion: ${res.status}`);
  return res.json();
}

export async function deleteForumDiscussion(forumId: number, discussionId: number): Promise<void> {
  const res = await sbFetch(`${MOODLE_BASE}/forums/${forumId}/discussions/${discussionId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete discussion: ${res.status}`);
}

export async function replyToForumDiscussion(
  forumId: number,
  discussionId: number,
  message: string,
  options: CreateForumDiscussionOptions = {},
): Promise<MoodleDiscussion> {
  const res = await sbFetch(`${MOODLE_BASE}/forums/${forumId}/discussions/${discussionId}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      author_name: options.authorName,
      author_id: options.authorId,
      author_role: options.authorRole,
    }),
  });
  if (!res.ok) throw new Error(`Failed to reply to discussion: ${res.status}`);
  return res.json();
}

export async function reactToForumDiscussion(
  forumId: number,
  discussionId: number,
  reaction: MoodleDiscussionReactionType,
  options: CreateForumDiscussionOptions = {},
): Promise<MoodleDiscussion> {
  const res = await sbFetch(`${MOODLE_BASE}/forums/${forumId}/discussions/${discussionId}/reactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reaction,
      author_name: options.authorName,
      author_id: options.authorId,
      author_role: options.authorRole,
    }),
  });
  if (!res.ok) throw new Error(`Failed to update discussion reaction: ${res.status}`);
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

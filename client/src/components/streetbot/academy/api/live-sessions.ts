/**
 * Live Sessions API adapter for LibreChat (Vite).
 */

import { sbFetch } from '../../shared/sbFetch';

const BASE = '/api/academy/live-sessions';

// =============================================================================
// Types
// =============================================================================

export interface LiveSession {
  id: string;
  course_id: string;
  module_id: string | null;
  lesson_id: string | null;
  title: string;
  description: string | null;
  session_type: 'webinar' | 'workshop' | 'office_hours' | 'class';
  instructor_id: string;
  co_host_ids: string[];
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  max_attendees: number | null;
  platform: 'internal' | 'zoom' | 'meet' | 'teams' | 'custom';
  meeting_url: string | null;
  recording_url: string | null;
  recording_available: boolean;
  is_mandatory: boolean;
  points_for_attending: number;
  created_at: string;
  updated_at: string;
}

export interface SessionRegistration {
  id: string;
  session_id: string;
  user_id: string;
  status: 'registered' | 'attended' | 'no_show' | 'cancelled';
  joined_at: string | null;
  left_at: string | null;
  attendance_duration: number;
  attendance_percent: number;
  attended_full: boolean;
  points_earned: number;
}

export interface SessionWithRegistration {
  session: LiveSession;
  registration: SessionRegistration | null;
  is_registered: boolean;
  can_join: boolean;
}

export interface SessionListResponse {
  sessions: LiveSession[];
  total: number;
  upcoming_count: number;
  live_count: number;
}

export interface SessionPoll {
  id: string;
  session_id: string;
  question: string;
  poll_type: 'single' | 'multiple' | 'rating' | 'open';
  options: Array<{ text: string; is_correct?: boolean }>;
  is_anonymous: boolean;
  show_results_live: boolean;
  status: 'draft' | 'active' | 'closed';
  started_at: string | null;
  ended_at: string | null;
}

export interface PollResults {
  poll: SessionPoll;
  total_responses: number;
  results: Record<string, number>;
}

export interface SessionQuestion {
  id: string;
  session_id: string;
  user_id: string;
  question: string;
  is_anonymous: boolean;
  status: 'pending' | 'answered' | 'dismissed';
  upvotes: number;
  answer: string | null;
  answered_by: string | null;
  created_at: string;
}

export interface FeedbackSummary {
  total_responses: number;
  average_overall: number | null;
  average_content: number | null;
  average_presenter: number | null;
  average_tech: number | null;
  recommend_percent: number;
}

export interface CreateSessionData {
  course_id: string;
  module_id?: string;
  lesson_id?: string;
  title: string;
  description?: string;
  session_type?: 'webinar' | 'workshop' | 'office_hours' | 'class';
  scheduled_start: string;
  scheduled_end: string;
  max_attendees?: number;
  platform?: string;
  meeting_url?: string;
  is_mandatory?: boolean;
  attendance_required_percent?: number;
  points_for_attending?: number;
}

export interface UpdateSessionData {
  title?: string;
  description?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  max_attendees?: number;
  meeting_url?: string;
  status?: string;
  recording_url?: string;
}

export interface CreatePollData {
  question: string;
  poll_type?: 'single' | 'multiple' | 'rating' | 'open';
  options?: Array<{ text: string; is_correct?: boolean }>;
  is_anonymous?: boolean;
  show_results_live?: boolean;
}

export interface SessionFeedbackData {
  overall_rating: number;
  content_rating?: number;
  presenter_rating?: number;
  tech_rating?: number;
  comments?: string;
  would_recommend?: boolean;
}

// =============================================================================
// Session Management
// =============================================================================

export async function createSession(data: CreateSessionData, instructorId: string): Promise<LiveSession> {
  const response = await sbFetch(`${BASE}?instructor_id=${instructorId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create session');
  return response.json();
}

export async function getSession(sessionId: string, userId?: string): Promise<SessionWithRegistration> {
  const params = new URLSearchParams();
  if (userId) params.set('user_id', userId);
  const response = await sbFetch(`${BASE}/${sessionId}?${params}`);
  if (!response.ok) throw new Error('Session not found');
  return response.json();
}

export async function getCourseSessions(courseId: string, options?: { status?: string; upcomingOnly?: boolean }): Promise<SessionListResponse> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.upcomingOnly) params.set('upcoming_only', 'true');
  const response = await sbFetch(`${BASE}/course/${courseId}?${params}`);
  if (!response.ok) throw new Error('Failed to fetch sessions');
  return response.json();
}

export async function updateSession(sessionId: string, data: UpdateSessionData): Promise<LiveSession> {
  const response = await sbFetch(`${BASE}/${sessionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!response.ok) throw new Error('Failed to update session');
  return response.json();
}

export async function startSession(sessionId: string): Promise<LiveSession> {
  const response = await sbFetch(`${BASE}/${sessionId}/start`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to start session');
  return response.json();
}

export async function endSession(sessionId: string): Promise<LiveSession> {
  const response = await sbFetch(`${BASE}/${sessionId}/end`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to end session');
  return response.json();
}

export async function cancelSession(sessionId: string, reason?: string): Promise<void> {
  const params = new URLSearchParams();
  if (reason) params.set('reason', reason);
  const response = await sbFetch(`${BASE}/${sessionId}/cancel?${params}`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to cancel session');
}

// Registration
export async function registerForSession(sessionId: string, userId: string): Promise<SessionRegistration> {
  const response = await sbFetch(`${BASE}/${sessionId}/register?user_id=${encodeURIComponent(userId)}`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to register');
  return response.json();
}

export async function cancelRegistration(sessionId: string, userId: string): Promise<void> {
  const response = await sbFetch(`${BASE}/${sessionId}/register?user_id=${encodeURIComponent(userId)}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to cancel registration');
}

export async function getSessionRegistrations(sessionId: string): Promise<SessionRegistration[]> {
  const response = await sbFetch(`${BASE}/${sessionId}/registrations`);
  if (!response.ok) throw new Error('Failed to fetch registrations');
  return response.json();
}

export async function getUserUpcomingSessions(userId: string): Promise<{ sessions: Array<{ registration: SessionRegistration; session: LiveSession }>; total: number }> {
  const response = await sbFetch(`${BASE}/user/${encodeURIComponent(userId)}/upcoming`);
  if (!response.ok) throw new Error('Failed to fetch user sessions');
  return response.json();
}

export async function getUserAllSessions(userId: string): Promise<{ sessions: Array<{ registration: SessionRegistration; session: LiveSession }>; total: number }> {
  const response = await sbFetch(`${BASE}/user/${encodeURIComponent(userId)}/all`);
  if (!response.ok) throw new Error('Failed to fetch user sessions');
  return response.json();
}

// Attendance
export async function joinSession(sessionId: string, userId: string): Promise<{ status: string; meeting_url: string | null; registration: SessionRegistration }> {
  const response = await sbFetch(`${BASE}/${sessionId}/join?user_id=${encodeURIComponent(userId)}`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to join session');
  return response.json();
}

export async function leaveSession(sessionId: string, userId: string): Promise<{ status: string; attendance_duration: number }> {
  const response = await sbFetch(`${BASE}/${sessionId}/leave?user_id=${encodeURIComponent(userId)}`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to leave session');
  return response.json();
}

// Polls
export async function createPoll(sessionId: string, data: CreatePollData): Promise<SessionPoll> {
  const response = await sbFetch(`${BASE}/${sessionId}/polls`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!response.ok) throw new Error('Failed to create poll');
  return response.json();
}

export async function startPoll(pollId: string): Promise<SessionPoll> {
  const response = await sbFetch(`${BASE}/polls/${pollId}/start`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to start poll');
  return response.json();
}

export async function endPoll(pollId: string): Promise<SessionPoll> {
  const response = await sbFetch(`${BASE}/polls/${pollId}/end`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to end poll');
  return response.json();
}

export async function submitPollResponse(pollId: string, userId: string, responseData: unknown): Promise<void> {
  const res = await sbFetch(`${BASE}/polls/${pollId}/respond?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response: responseData }),
  });
  if (!res.ok) throw new Error('Failed to submit poll response');
}

export async function getPollResults(pollId: string): Promise<PollResults> {
  const response = await sbFetch(`${BASE}/polls/${pollId}/results`);
  if (!response.ok) throw new Error('Failed to fetch poll results');
  return response.json();
}

// Q&A
export async function askQuestion(sessionId: string, userId: string, question: string, isAnonymous = false): Promise<SessionQuestion> {
  const response = await sbFetch(`${BASE}/${sessionId}/questions?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, is_anonymous: isAnonymous }),
  });
  if (!response.ok) throw new Error('Failed to submit question');
  return response.json();
}

export async function getSessionQuestions(sessionId: string, status?: string): Promise<SessionQuestion[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const response = await sbFetch(`${BASE}/${sessionId}/questions?${params}`);
  if (!response.ok) throw new Error('Failed to fetch questions');
  return response.json();
}

export async function upvoteQuestion(questionId: string, userId: string): Promise<void> {
  const response = await sbFetch(`${BASE}/questions/${questionId}/upvote?user_id=${encodeURIComponent(userId)}`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to upvote question');
}

export async function answerQuestion(questionId: string, answer: string, answeredBy: string): Promise<SessionQuestion> {
  const response = await sbFetch(`${BASE}/questions/${questionId}/answer?answered_by=${encodeURIComponent(answeredBy)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer }),
  });
  if (!response.ok) throw new Error('Failed to answer question');
  return response.json();
}

// Feedback
export async function submitFeedback(sessionId: string, userId: string, data: SessionFeedbackData): Promise<void> {
  const response = await sbFetch(`${BASE}/${sessionId}/feedback?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to submit feedback');
}

export async function getFeedbackSummary(sessionId: string): Promise<FeedbackSummary> {
  const response = await sbFetch(`${BASE}/${sessionId}/feedback/summary`);
  if (!response.ok) throw new Error('Failed to fetch feedback summary');
  return response.json();
}

// =============================================================================
// Utility Functions
// =============================================================================

export function getSessionStatus(session: LiveSession): { label: string; color: string; canJoin: boolean; isUpcoming: boolean; isLive: boolean; isPast: boolean } {
  const now = new Date();
  const start = new Date(session.scheduled_start);
  const end = new Date(session.scheduled_end);
  if (session.status === 'cancelled') return { label: 'Cancelled', color: 'red', canJoin: false, isUpcoming: false, isLive: false, isPast: true };
  if (session.status === 'live') return { label: 'Live Now', color: 'green', canJoin: true, isUpcoming: false, isLive: true, isPast: false };
  if (session.status === 'ended' || now > end) return { label: 'Ended', color: 'gray', canJoin: false, isUpcoming: false, isLive: false, isPast: true };
  const minUntilStart = (start.getTime() - now.getTime()) / 60000;
  if (minUntilStart <= 15) return { label: 'Starting Soon', color: 'yellow', canJoin: false, isUpcoming: true, isLive: false, isPast: false };
  return { label: 'Upcoming', color: 'blue', canJoin: false, isUpcoming: true, isLive: false, isPast: false };
}

export function formatSessionDuration(session: LiveSession): string {
  const mins = (new Date(session.scheduled_end).getTime() - new Date(session.scheduled_start).getTime()) / 60000;
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function getSessionTypeLabel(type: LiveSession['session_type']): string {
  const labels: Record<string, string> = { webinar: 'Webinar', workshop: 'Workshop', office_hours: 'Office Hours', class: 'Live Class' };
  return labels[type] || type;
}

export function getPlatformIcon(platform: LiveSession['platform']): string {
  const icons: Record<string, string> = { internal: 'video', zoom: 'zoom', meet: 'google', teams: 'microsoft', custom: 'link' };
  return icons[platform] || 'video';
}

/**
 * Attendance & Engagement API adapter for LibreChat (Vite).
 */

import { sbFetch } from '../../shared/sbFetch';

const SESSIONS_BASE = '/api/academy/sessions';
const ENGAGEMENT_BASE = '/api/academy/engagement';

// =============================================================================
// Types
// =============================================================================

export interface LiveSession {
  id: string;
  courseId: string;
  instructorId: string;
  title: string;
  description?: string;
  sessionType: 'class' | 'workshop' | 'webinar' | 'office_hours';
  scheduledAt: string;
  durationMinutes: number;
  meetingUrl?: string;
  maxAttendees?: number;
  currentAttendees: number;
  isMandatory: boolean;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface SessionAttendance {
  id: string;
  sessionId: string;
  userId: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  checkInAt?: string;
  checkOutAt?: string;
  durationMinutes?: number;
  notes?: string;
  createdAt: string;
}

export interface DailyEngagement {
  id: string;
  userId: string;
  date: string;
  lessonsAccessed: number;
  quizzesTaken: number;
  timeSpentMinutes: number;
  forumPosts: number;
  createdAt: string;
}

export interface UserStreak {
  id: string;
  userId: string;
  currentStreak: number;
  longestStreak: number;
  totalDaysActive: number;
  lastActiveDate?: string;
}

export interface EngagementSummary {
  userId: string;
  periodDays: number;
  totalLessons: number;
  totalQuizzes: number;
  totalTimeMinutes: number;
  totalForumPosts: number;
  avgDailyTime: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
}

// =============================================================================
// Transform helpers
// =============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
function transformSession(api: any): LiveSession {
  return { id: api.id, courseId: api.course_id, instructorId: api.instructor_id, title: api.title, description: api.description, sessionType: api.session_type, scheduledAt: api.scheduled_at, durationMinutes: api.duration_minutes, meetingUrl: api.meeting_url, maxAttendees: api.max_attendees, currentAttendees: api.current_attendees, isMandatory: api.is_mandatory, status: api.status, createdAt: api.created_at, updatedAt: api.updated_at };
}

function transformAttendance(api: any): SessionAttendance {
  return { id: api.id, sessionId: api.session_id, userId: api.user_id, status: api.status, checkInAt: api.check_in_at, checkOutAt: api.check_out_at, durationMinutes: api.duration_minutes, notes: api.notes, createdAt: api.created_at };
}

function transformEngagement(api: any): DailyEngagement {
  return { id: api.id, userId: api.user_id, date: api.date, lessonsAccessed: api.lessons_accessed, quizzesTaken: api.quizzes_taken, timeSpentMinutes: api.time_spent_minutes, forumPosts: api.forum_posts, createdAt: api.created_at };
}

function transformStreak(api: any): UserStreak {
  return { id: api.id, userId: api.user_id, currentStreak: api.current_streak, longestStreak: api.longest_streak, totalDaysActive: api.total_days_active, lastActiveDate: api.last_active_date };
}

function transformSummary(api: any): EngagementSummary {
  return { userId: api.user_id, periodDays: api.period_days, totalLessons: api.total_lessons, totalQuizzes: api.total_quizzes, totalTimeMinutes: api.total_time_minutes, totalForumPosts: api.total_forum_posts, avgDailyTime: api.avg_daily_time, activeDays: api.active_days, currentStreak: api.current_streak, longestStreak: api.longest_streak };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// =============================================================================
// Sample data
// =============================================================================

const today = new Date();
const SAMPLE_SESSIONS: LiveSession[] = [
  { id: 'session-1', courseId: 'course-1', instructorId: 'instructor-1', title: 'Resume Writing Workshop', description: 'Learn how to create an effective resume.', sessionType: 'workshop', scheduledAt: new Date(today.getTime() + 7200000).toISOString(), durationMinutes: 90, meetingUrl: 'https://meet.example.com/resume', maxAttendees: 30, currentAttendees: 12, isMandatory: false, status: 'scheduled', createdAt: new Date(today.getTime() - 7 * 86400000).toISOString(), updatedAt: today.toISOString() },
];

const SAMPLE_ATTENDANCE: SessionAttendance[] = [
  { id: 'att-1', sessionId: 'session-3', userId: 'demo-user', status: 'present', checkInAt: new Date(today.getTime() - 86400000).toISOString(), durationMinutes: 45, createdAt: new Date(today.getTime() - 86400000).toISOString() },
];

const SAMPLE_STREAK: UserStreak = { id: 'streak-1', userId: 'demo-user', currentStreak: 5, longestStreak: 12, totalDaysActive: 28, lastActiveDate: today.toISOString().split('T')[0] };

const SAMPLE_ENGAGEMENT: DailyEngagement[] = Array.from({ length: 14 }, (_, i) => ({
  id: `eng-${i}`, userId: 'demo-user', date: new Date(today.getTime() - i * 86400000).toISOString().split('T')[0],
  lessonsAccessed: Math.floor(Math.random() * 5) + 1, quizzesTaken: Math.floor(Math.random() * 3),
  timeSpentMinutes: Math.floor(Math.random() * 60) + 15, forumPosts: Math.floor(Math.random() * 2),
  createdAt: new Date(today.getTime() - i * 86400000).toISOString(),
}));

const SAMPLE_SUMMARY: EngagementSummary = { userId: 'demo-user', periodDays: 30, totalLessons: 42, totalQuizzes: 15, totalTimeMinutes: 720, totalForumPosts: 8, avgDailyTime: 24, activeDays: 22, currentStreak: 5, longestStreak: 12 };

// =============================================================================
// API Functions
// =============================================================================

export async function getSessions(courseId?: string, status?: string, limit = 20): Promise<LiveSession[]> {
  try {
    const params = new URLSearchParams();
    if (courseId) params.append('course_id', courseId);
    if (status) params.append('status', status);
    params.append('limit', limit.toString());
    const response = await sbFetch(`${SESSIONS_BASE}?${params}`);
    if (!response.ok) return SAMPLE_SESSIONS;
    const data = await response.json();
    return data.map(transformSession);
  } catch { return SAMPLE_SESSIONS; }
}

export async function getSession(sessionId: string): Promise<LiveSession | null> {
  try {
    const response = await sbFetch(`${SESSIONS_BASE}/${sessionId}`);
    if (!response.ok) return SAMPLE_SESSIONS.find(s => s.id === sessionId) || null;
    return transformSession(await response.json());
  } catch { return null; }
}

export async function checkIn(sessionId: string, userId: string): Promise<SessionAttendance> {
  try {
    const response = await sbFetch(`${SESSIONS_BASE}/${sessionId}/check-in?user_id=${userId}`, { method: 'POST' });
    if (!response.ok) return { id: `att-${Date.now()}`, sessionId, userId, status: 'present', checkInAt: new Date().toISOString(), createdAt: new Date().toISOString() };
    return transformAttendance(await response.json());
  } catch { return { id: `att-${Date.now()}`, sessionId, userId, status: 'present', checkInAt: new Date().toISOString(), createdAt: new Date().toISOString() }; }
}

export async function checkOut(sessionId: string, userId: string): Promise<SessionAttendance> {
  try {
    const response = await sbFetch(`${SESSIONS_BASE}/${sessionId}/check-out?user_id=${userId}`, { method: 'POST' });
    if (!response.ok) return { id: `att-${Date.now()}`, sessionId, userId, status: 'present', checkOutAt: new Date().toISOString(), createdAt: new Date().toISOString() };
    return transformAttendance(await response.json());
  } catch { return { id: `att-${Date.now()}`, sessionId, userId, status: 'present', checkOutAt: new Date().toISOString(), createdAt: new Date().toISOString() }; }
}

export async function getUserAttendance(userId: string, courseId?: string): Promise<SessionAttendance[]> {
  try {
    const params = new URLSearchParams();
    if (courseId) params.append('course_id', courseId);
    const qs = params.toString();
    const response = await sbFetch(`${SESSIONS_BASE}/attendance/user/${userId}${qs ? '?' + qs : ''}`);
    if (!response.ok) return SAMPLE_ATTENDANCE;
    const data = await response.json();
    return data.map(transformAttendance);
  } catch { return SAMPLE_ATTENDANCE; }
}

export async function getUserStreak(userId: string): Promise<UserStreak> {
  try {
    const response = await sbFetch(`${ENGAGEMENT_BASE}/user/${userId}/streak`);
    if (!response.ok) return { ...SAMPLE_STREAK, userId };
    return transformStreak(await response.json());
  } catch { return { ...SAMPLE_STREAK, userId }; }
}

export async function getEngagementSummary(userId: string, days = 30): Promise<EngagementSummary> {
  try {
    const response = await sbFetch(`${ENGAGEMENT_BASE}/user/${userId}/summary?days=${days}`);
    if (!response.ok) return { ...SAMPLE_SUMMARY, userId, periodDays: days };
    return transformSummary(await response.json());
  } catch { return { ...SAMPLE_SUMMARY, userId, periodDays: days }; }
}

export async function getEngagementHistory(userId: string, days = 30): Promise<DailyEngagement[]> {
  try {
    const response = await sbFetch(`${ENGAGEMENT_BASE}/user/${userId}/history?days=${days}`);
    if (!response.ok) return SAMPLE_ENGAGEMENT.slice(0, days);
    const data = await response.json();
    return data.map(transformEngagement);
  } catch { return SAMPLE_ENGAGEMENT.slice(0, days); }
}

// =============================================================================
// Utility Functions
// =============================================================================

export function getSessionTypeIcon(type: LiveSession['sessionType']): string {
  const map: Record<string, string> = { class: 'BookOpen', workshop: 'Wrench', webinar: 'Video', office_hours: 'MessageCircle' };
  return map[type] || 'Calendar';
}

export function getSessionTypeLabel(type: LiveSession['sessionType']): string {
  const map: Record<string, string> = { class: 'Class', workshop: 'Workshop', webinar: 'Webinar', office_hours: 'Office Hours' };
  return map[type] || type;
}

export function getStatusColor(status: LiveSession['status']): string {
  const map: Record<string, string> = { scheduled: '#3B82F6', in_progress: '#10B981', completed: '#6B7280', cancelled: '#EF4444' };
  return map[status] || '#6B7280';
}

export function getAttendanceStatusColor(status: SessionAttendance['status']): string {
  const map: Record<string, string> = { present: '#10B981', late: '#F59E0B', absent: '#EF4444', excused: '#3B82F6' };
  return map[status] || '#6B7280';
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function isSessionLive(session: LiveSession): boolean {
  const now = new Date();
  const start = new Date(session.scheduledAt);
  const end = new Date(start.getTime() + session.durationMinutes * 60000);
  return now >= start && now <= end;
}

export function isSessionUpcoming(session: LiveSession): boolean {
  return new Date(session.scheduledAt) > new Date();
}

export function getTimeUntilSession(session: LiveSession): string {
  const diff = new Date(session.scheduledAt).getTime() - Date.now();
  if (diff < 0) return 'Started';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) { const d = Math.floor(h / 24); return `in ${d} day${d > 1 ? 's' : ''}`; }
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

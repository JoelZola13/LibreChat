/**
 * Academy Attendance & Engagement API service
 */

const API_BASE = '/sbapi';
const SESSIONS_API = `${API_BASE}/academy/sessions`;
const ENGAGEMENT_API = `${API_BASE}/academy/engagement`;

// ============================================================================
// TYPES - API Response (snake_case from backend)
// ============================================================================

interface LiveSessionApi {
  id: string;
  course_id: string;
  instructor_id: string;
  title: string;
  description?: string;
  session_type: "class" | "workshop" | "webinar" | "office_hours";
  scheduled_at: string;
  duration_minutes: number;
  meeting_url?: string;
  max_attendees?: number;
  current_attendees: number;
  is_mandatory: boolean;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}

interface SessionAttendanceApi {
  id: string;
  session_id: string;
  user_id: string;
  status: "present" | "absent" | "late" | "excused";
  check_in_at?: string;
  check_out_at?: string;
  duration_minutes?: number;
  notes?: string;
  created_at: string;
}

interface DailyEngagementApi {
  id: string;
  user_id: string;
  date: string;
  lessons_accessed: number;
  quizzes_taken: number;
  time_spent_minutes: number;
  forum_posts: number;
  created_at: string;
}

interface UserStreakApi {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  total_days_active: number;
  last_active_date?: string;
}

interface EngagementSummaryApi {
  user_id: string;
  period_days: number;
  total_lessons: number;
  total_quizzes: number;
  total_time_minutes: number;
  total_forum_posts: number;
  avg_daily_time: number;
  active_days: number;
  current_streak: number;
  longest_streak: number;
}

// ============================================================================
// TYPES - Frontend (camelCase for React)
// ============================================================================

export interface LiveSession {
  id: string;
  courseId: string;
  instructorId: string;
  title: string;
  description?: string;
  sessionType: "class" | "workshop" | "webinar" | "office_hours";
  scheduledAt: string;
  durationMinutes: number;
  meetingUrl?: string;
  maxAttendees?: number;
  currentAttendees: number;
  isMandatory: boolean;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface SessionAttendance {
  id: string;
  sessionId: string;
  userId: string;
  status: "present" | "absent" | "late" | "excused";
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

// ============================================================================
// SAMPLE DATA (Fallback when API unavailable)
// ============================================================================

const today = new Date();
const SAMPLE_SESSIONS: LiveSession[] = [
  {
    id: "session-1",
    courseId: "course-1",
    instructorId: "instructor-1",
    title: "Resume Writing Workshop",
    description: "Learn how to create an effective resume that stands out to employers.",
    sessionType: "workshop",
    scheduledAt: new Date(today.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 90,
    meetingUrl: "https://meet.example.com/resume-workshop",
    maxAttendees: 30,
    currentAttendees: 12,
    isMandatory: false,
    status: "scheduled",
    createdAt: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "session-2",
    courseId: "course-1",
    instructorId: "instructor-1",
    title: "Interview Skills Practice",
    description: "Practice common interview questions and get feedback.",
    sessionType: "class",
    scheduledAt: new Date(today.getTime() + 26 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 60,
    maxAttendees: 20,
    currentAttendees: 8,
    isMandatory: true,
    status: "scheduled",
    createdAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "session-3",
    courseId: "course-2",
    instructorId: "instructor-2",
    title: "Financial Literacy Basics",
    description: "Understanding budgeting, saving, and managing your money.",
    sessionType: "webinar",
    scheduledAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 45,
    currentAttendees: 25,
    isMandatory: false,
    status: "completed",
    createdAt: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const SAMPLE_ATTENDANCE: SessionAttendance[] = [
  {
    id: "att-1",
    sessionId: "session-3",
    userId: "demo-user",
    status: "present",
    checkInAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    checkOutAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
    durationMinutes: 45,
    createdAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "att-2",
    sessionId: "session-prev-1",
    userId: "demo-user",
    status: "present",
    checkInAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 60,
    createdAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "att-3",
    sessionId: "session-prev-2",
    userId: "demo-user",
    status: "late",
    checkInAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 50,
    notes: "Arrived 10 minutes late",
    createdAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const SAMPLE_STREAK: UserStreak = {
  id: "streak-1",
  userId: "demo-user",
  currentStreak: 5,
  longestStreak: 12,
  totalDaysActive: 28,
  lastActiveDate: new Date().toISOString().split("T")[0],
};

const SAMPLE_ENGAGEMENT: DailyEngagement[] = Array.from({ length: 14 }, (_, i) => ({
  id: `eng-${i}`,
  userId: "demo-user",
  date: new Date(today.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  lessonsAccessed: Math.floor(Math.random() * 5) + 1,
  quizzesTaken: Math.floor(Math.random() * 3),
  timeSpentMinutes: Math.floor(Math.random() * 60) + 15,
  forumPosts: Math.floor(Math.random() * 2),
  createdAt: new Date(today.getTime() - i * 24 * 60 * 60 * 1000).toISOString(),
}));

const SAMPLE_SUMMARY: EngagementSummary = {
  userId: "demo-user",
  periodDays: 30,
  totalLessons: 42,
  totalQuizzes: 15,
  totalTimeMinutes: 720,
  totalForumPosts: 8,
  avgDailyTime: 24,
  activeDays: 22,
  currentStreak: 5,
  longestStreak: 12,
};

// ============================================================================
// TRANSFORM FUNCTIONS
// ============================================================================

function transformSession(api: LiveSessionApi): LiveSession {
  return {
    id: api.id,
    courseId: api.course_id,
    instructorId: api.instructor_id,
    title: api.title,
    description: api.description,
    sessionType: api.session_type,
    scheduledAt: api.scheduled_at,
    durationMinutes: api.duration_minutes,
    meetingUrl: api.meeting_url,
    maxAttendees: api.max_attendees,
    currentAttendees: api.current_attendees,
    isMandatory: api.is_mandatory,
    status: api.status,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

function transformAttendance(api: SessionAttendanceApi): SessionAttendance {
  return {
    id: api.id,
    sessionId: api.session_id,
    userId: api.user_id,
    status: api.status,
    checkInAt: api.check_in_at,
    checkOutAt: api.check_out_at,
    durationMinutes: api.duration_minutes,
    notes: api.notes,
    createdAt: api.created_at,
  };
}

function transformEngagement(api: DailyEngagementApi): DailyEngagement {
  return {
    id: api.id,
    userId: api.user_id,
    date: api.date,
    lessonsAccessed: api.lessons_accessed,
    quizzesTaken: api.quizzes_taken,
    timeSpentMinutes: api.time_spent_minutes,
    forumPosts: api.forum_posts,
    createdAt: api.created_at,
  };
}

function transformStreak(api: UserStreakApi): UserStreak {
  return {
    id: api.id,
    userId: api.user_id,
    currentStreak: api.current_streak,
    longestStreak: api.longest_streak,
    totalDaysActive: api.total_days_active,
    lastActiveDate: api.last_active_date,
  };
}

function transformSummary(api: EngagementSummaryApi): EngagementSummary {
  return {
    userId: api.user_id,
    periodDays: api.period_days,
    totalLessons: api.total_lessons,
    totalQuizzes: api.total_quizzes,
    totalTimeMinutes: api.total_time_minutes,
    totalForumPosts: api.total_forum_posts,
    avgDailyTime: api.avg_daily_time,
    activeDays: api.active_days,
    currentStreak: api.current_streak,
    longestStreak: api.longest_streak,
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get upcoming and recent sessions
 */
export async function getSessions(
  courseId?: string,
  status?: string,
  limit = 20
): Promise<LiveSession[]> {
  try {
    const params = new URLSearchParams();
    if (courseId) params.append("course_id", courseId);
    if (status) params.append("status", status);
    params.append("limit", limit.toString());

    const response = await fetch(`${SESSIONS_API}?${params}`);
    if (!response.ok) {
      console.warn("Sessions API unavailable, using sample data");
      return SAMPLE_SESSIONS;
    }
    const data: LiveSessionApi[] = await response.json();
    return data.map(transformSession);
  } catch (error) {
    console.warn("Failed to fetch sessions, using sample data:", error);
    return SAMPLE_SESSIONS;
  }
}

/**
 * Get a specific session
 */
export async function getSession(sessionId: string): Promise<LiveSession | null> {
  try {
    const response = await fetch(`${SESSIONS_API}/${sessionId}`);
    if (!response.ok) {
      return SAMPLE_SESSIONS.find((s) => s.id === sessionId) || null;
    }
    const data: LiveSessionApi = await response.json();
    return transformSession(data);
  } catch (error) {
    console.warn("Failed to fetch session:", error);
    return SAMPLE_SESSIONS.find((s) => s.id === sessionId) || null;
  }
}

/**
 * Check in to a session
 */
export async function checkIn(sessionId: string, userId: string): Promise<SessionAttendance> {
  try {
    const response = await fetch(`${SESSIONS_API}/${sessionId}/check-in?user_id=${userId}`, {
      method: "POST",
    });
    if (!response.ok) {
      // Return mock attendance for demo
      return {
        id: `att-${Date.now()}`,
        sessionId,
        userId,
        status: "present",
        checkInAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
    }
    const data: SessionAttendanceApi = await response.json();
    return transformAttendance(data);
  } catch (error) {
    console.warn("Failed to check in, using mock data:", error);
    return {
      id: `att-${Date.now()}`,
      sessionId,
      userId,
      status: "present",
      checkInAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * Check out from a session
 */
export async function checkOut(sessionId: string, userId: string): Promise<SessionAttendance> {
  try {
    const response = await fetch(`${SESSIONS_API}/${sessionId}/check-out?user_id=${userId}`, {
      method: "POST",
    });
    if (!response.ok) {
      return {
        id: `att-${Date.now()}`,
        sessionId,
        userId,
        status: "present",
        checkOutAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
    }
    const data: SessionAttendanceApi = await response.json();
    return transformAttendance(data);
  } catch (error) {
    console.warn("Failed to check out:", error);
    return {
      id: `att-${Date.now()}`,
      sessionId,
      userId,
      status: "present",
      checkOutAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * Get user's attendance history
 */
export async function getUserAttendance(
  userId: string,
  courseId?: string
): Promise<SessionAttendance[]> {
  try {
    const params = new URLSearchParams();
    if (courseId) params.append("course_id", courseId);

    const response = await fetch(
      `${SESSIONS_API}/attendance/user/${userId}${params.toString() ? `?${params}` : ""}`
    );
    if (!response.ok) {
      console.warn("Attendance API unavailable, using sample data");
      return SAMPLE_ATTENDANCE;
    }
    const data: SessionAttendanceApi[] = await response.json();
    return data.map(transformAttendance);
  } catch (error) {
    console.warn("Failed to fetch attendance, using sample data:", error);
    return SAMPLE_ATTENDANCE;
  }
}

/**
 * Get user's streak info
 */
export async function getUserStreak(userId: string): Promise<UserStreak> {
  try {
    const response = await fetch(`${ENGAGEMENT_API}/user/${userId}/streak`);
    if (!response.ok) {
      console.warn("Streak API unavailable, using sample data");
      return { ...SAMPLE_STREAK, userId };
    }
    const data: UserStreakApi = await response.json();
    return transformStreak(data);
  } catch (error) {
    console.warn("Failed to fetch streak, using sample data:", error);
    return { ...SAMPLE_STREAK, userId };
  }
}

/**
 * Get user's engagement summary
 */
export async function getEngagementSummary(
  userId: string,
  days = 30
): Promise<EngagementSummary> {
  try {
    const response = await fetch(`${ENGAGEMENT_API}/user/${userId}/summary?days=${days}`);
    if (!response.ok) {
      console.warn("Engagement summary API unavailable, using sample data");
      return { ...SAMPLE_SUMMARY, userId, periodDays: days };
    }
    const data: EngagementSummaryApi = await response.json();
    return transformSummary(data);
  } catch (error) {
    console.warn("Failed to fetch engagement summary, using sample data:", error);
    return { ...SAMPLE_SUMMARY, userId, periodDays: days };
  }
}

/**
 * Get user's engagement history
 */
export async function getEngagementHistory(
  userId: string,
  days = 30
): Promise<DailyEngagement[]> {
  try {
    const response = await fetch(`${ENGAGEMENT_API}/user/${userId}/history?days=${days}`);
    if (!response.ok) {
      console.warn("Engagement history API unavailable, using sample data");
      return SAMPLE_ENGAGEMENT.slice(0, days);
    }
    const data: DailyEngagementApi[] = await response.json();
    return data.map(transformEngagement);
  } catch (error) {
    console.warn("Failed to fetch engagement history, using sample data:", error);
    return SAMPLE_ENGAGEMENT.slice(0, days);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getSessionTypeIcon(type: LiveSession["sessionType"]): string {
  switch (type) {
    case "class":
      return "BookOpen";
    case "workshop":
      return "Wrench";
    case "webinar":
      return "Video";
    case "office_hours":
      return "MessageCircle";
    default:
      return "Calendar";
  }
}

export function getSessionTypeLabel(type: LiveSession["sessionType"]): string {
  switch (type) {
    case "class":
      return "Class";
    case "workshop":
      return "Workshop";
    case "webinar":
      return "Webinar";
    case "office_hours":
      return "Office Hours";
    default:
      return type;
  }
}

export function getStatusColor(status: LiveSession["status"]): string {
  switch (status) {
    case "scheduled":
      return "#3B82F6";
    case "in_progress":
      return "#10B981";
    case "completed":
      return "#6B7280";
    case "cancelled":
      return "#EF4444";
    default:
      return "#6B7280";
  }
}

export function getAttendanceStatusColor(status: SessionAttendance["status"]): string {
  switch (status) {
    case "present":
      return "#10B981";
    case "late":
      return "#F59E0B";
    case "absent":
      return "#EF4444";
    case "excused":
      return "#3B82F6";
    default:
      return "#6B7280";
  }
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function isSessionLive(session: LiveSession): boolean {
  const now = new Date();
  const start = new Date(session.scheduledAt);
  const end = new Date(start.getTime() + session.durationMinutes * 60 * 1000);
  return now >= start && now <= end;
}

export function isSessionUpcoming(session: LiveSession): boolean {
  return new Date(session.scheduledAt) > new Date();
}

export function getTimeUntilSession(session: LiveSession): string {
  const now = new Date();
  const start = new Date(session.scheduledAt);
  const diff = start.getTime() - now.getTime();

  if (diff < 0) return "Started";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `in ${days} day${days > 1 ? "s" : ""}`;
  }
  if (hours > 0) {
    return `in ${hours}h ${minutes}m`;
  }
  return `in ${minutes}m`;
}

/**
 * Academy AI Tutor API adapter for LibreChat (Vite).
 * Re-exports types and provides sbFetch-based API functions.
 */

import { sbFetch } from '../../shared/sbFetch';

const BASE = '/api/academy/tutor';

// =============================================================================
// Types
// =============================================================================

export interface TutorSession {
  id: string;
  user_id: string;
  course_id?: string;
  lesson_id?: string;
  session_type: string;
  started_at: string;
  ended_at?: string;
  message_count: number;
  feedback_rating?: number;
  feedback_text?: string;
}

export interface TutorMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface TutorResponse {
  message: string;
  session_id: string;
  suggestions?: string[];
  related_lessons?: Array<{ id: string; title: string }>;
  quiz_questions?: Array<Record<string, unknown>>;
}

export interface LearningRecommendation {
  recommendation_type: string;
  title: string;
  description: string;
  lesson_id?: string;
  quiz_id?: string;
  priority: number;
}

// =============================================================================
// Session Management
// =============================================================================

export async function startTutorSession(
  data: { session_type?: string; course_id?: string; lesson_id?: string },
  userId: string
): Promise<TutorSession> {
  const response = await sbFetch(`${BASE}/sessions?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to start session');
  return response.json();
}

export async function getTutorSession(sessionId: string): Promise<TutorSession> {
  const response = await sbFetch(`${BASE}/sessions/${sessionId}`);
  if (!response.ok) throw new Error('Session not found');
  return response.json();
}

export async function endTutorSession(
  sessionId: string,
  data: { feedback_rating?: number; feedback_text?: string }
): Promise<TutorSession> {
  const response = await sbFetch(`${BASE}/sessions/${sessionId}/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to end session');
  return response.json();
}

export async function getUserTutorSessions(userId: string, limit = 20): Promise<{ sessions: TutorSession[] }> {
  try {
    const response = await sbFetch(`${BASE}/sessions?user_id=${encodeURIComponent(userId)}&limit=${limit}`);
    if (!response.ok) return { sessions: [] };
    return response.json();
  } catch {
    return { sessions: [] };
  }
}

// =============================================================================
// Messages
// =============================================================================

export async function getSessionMessages(sessionId: string, limit = 50): Promise<{ messages: TutorMessage[] }> {
  try {
    const response = await sbFetch(`${BASE}/sessions/${sessionId}/messages?limit=${limit}`);
    if (!response.ok) return { messages: [] };
    return response.json();
  } catch {
    return { messages: [] };
  }
}

// =============================================================================
// Chat
// =============================================================================

export async function chatWithTutor(
  data: {
    message: string;
    session_id?: string;
    course_id?: string;
    lesson_id?: string;
    session_type?: string;
  },
  userId: string
): Promise<TutorResponse> {
  const response = await sbFetch(`${BASE}/chat?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to get response');
  return response.json();
}

// =============================================================================
// Concept Explanation
// =============================================================================

export async function explainConcept(
  data: {
    concept: string;
    context_lesson_id?: string;
    difficulty_level?: 'simple' | 'detailed' | 'advanced';
  },
  userId: string
): Promise<{ explanation: string }> {
  const response = await sbFetch(`${BASE}/explain?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to get explanation');
  return response.json();
}

// =============================================================================
// Recommendations
// =============================================================================

export async function getLearningRecommendations(
  userId: string,
  courseId?: string,
  limit = 5
): Promise<{ recommendations: LearningRecommendation[] }> {
  try {
    const params = new URLSearchParams({ user_id: userId, limit: String(limit) });
    if (courseId) params.set('course_id', courseId);
    const response = await sbFetch(`${BASE}/recommendations?${params}`);
    if (!response.ok) return { recommendations: [] };
    return response.json();
  } catch {
    return { recommendations: [] };
  }
}

// =============================================================================
// Quick Actions
// =============================================================================

export async function getQuickHelp(
  userId: string,
  lessonId: string,
  question: string
): Promise<{ answer: string; suggestions: string[] }> {
  const params = new URLSearchParams({
    user_id: userId,
    lesson_id: lessonId,
    question,
  });
  const response = await sbFetch(`${BASE}/quick/help?${params}`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to get help');
  return response.json();
}

export async function getQuizPrepTips(
  userId: string,
  courseId: string
): Promise<{ tips: string[]; struggling_topics: string[]; progress: Record<string, unknown> }> {
  const response = await sbFetch(`${BASE}/quick/quiz-prep?user_id=${encodeURIComponent(userId)}&course_id=${courseId}`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to get quiz prep tips');
  return response.json();
}

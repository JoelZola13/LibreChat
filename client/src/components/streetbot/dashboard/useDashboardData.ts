import { useState, useEffect, useCallback } from 'react';
import { sbFetch } from '../shared/sbFetch';
import { useAuthContext } from '~/hooks/AuthContext';
import { getOrCreateUserId } from '../shared/userId';

interface TaskItem {
  id: string;
  name: string;
  status: string;
  priority?: string;
  due_date?: string;
}

interface ConversationItem {
  id: number;
  name?: string;
  last_message?: { content?: string; created_at?: string };
  unread_count?: number;
}

interface DocumentItem {
  id: string;
  title: string;
  status?: string;
  document_type?: string;
  updated_at?: string;
}

interface EnrollmentItem {
  id: string;
  course_name?: string;
  progress?: number;
  status?: string;
}

interface ActivityItem {
  id: string;
  action?: string;
  description?: string;
  entity_type?: string;
  created_at?: string;
  link?: string;
}

interface WidgetData<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface DashboardData {
  userId: string;
  tasksToday: WidgetData<TaskItem[]>;
  tasksOverdue: WidgetData<TaskItem[]>;
  conversations: WidgetData<ConversationItem[]>;
  recentDocs: WidgetData<DocumentItem[]>;
  enrollments: WidgetData<EnrollmentItem[]>;
  activityFeed: WidgetData<ActivityItem[]>;
  refresh: () => void;
}

async function fetchSafe<T>(fn: () => Promise<T>): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (e: unknown) {
    return { data: null, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

async function getJson<T>(path: string, extraHeaders?: Record<string, string>): Promise<T> {
  const res = await sbFetch(path, extraHeaders ? { headers: extraHeaders } : undefined);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export function useDashboardData(): DashboardData {
  const { user: authUser } = useAuthContext();
  const userId = getOrCreateUserId(authUser?.id);

  const [tasksToday, setTasksToday] = useState<WidgetData<TaskItem[]>>({ data: null, loading: true, error: null });
  const [tasksOverdue, setTasksOverdue] = useState<WidgetData<TaskItem[]>>({ data: null, loading: true, error: null });
  const [conversations, setConversations] = useState<WidgetData<ConversationItem[]>>({ data: null, loading: true, error: null });
  const [recentDocs, setRecentDocs] = useState<WidgetData<DocumentItem[]>>({ data: null, loading: true, error: null });
  const [enrollments, setEnrollments] = useState<WidgetData<EnrollmentItem[]>>({ data: null, loading: true, error: null });
  const [activityFeed, setActivityFeed] = useState<WidgetData<ActivityItem[]>>({ data: null, loading: true, error: null });

  const load = useCallback(async () => {
    if (!userId) return;

    // Reset loading states
    const loading = { data: null, loading: true, error: null };
    setTasksToday(loading);
    setTasksOverdue(loading);
    setConversations(loading);
    setRecentDocs(loading);
    setEnrollments(loading);
    setActivityFeed(loading);

    // Fire all requests in parallel
    const [todayRes, overdueRes, convoRes, docsRes, enrollRes, activityRes] = await Promise.allSettled([
      fetchSafe(() => getJson<any>(`/api/tasks/today?user_id=${encodeURIComponent(userId)}`).then(r => Array.isArray(r) ? r : r.tasks || r.results || [])),
      fetchSafe(() => getJson<any>(`/api/tasks/overdue?user_id=${encodeURIComponent(userId)}`).then(r => Array.isArray(r) ? r : r.tasks || r.results || [])),
      fetchSafe(() => getJson<any>(`/api/messaging/conversations?user_id=${encodeURIComponent(userId)}`).then(r => Array.isArray(r) ? r : r.conversations || [])),
      fetchSafe(() => getJson<any>(`/api/documents/recent?user_id=${encodeURIComponent(userId)}&limit=3`).then(r => Array.isArray(r) ? r : r.documents || [])),
      fetchSafe(() => getJson<any>(`/api/academy/enrollments/${encodeURIComponent(userId)}`).then(r => Array.isArray(r) ? r : r.enrollments || r.courses || [])),
      fetchSafe(() => getJson<any>('/activity/feed?limit=5', { 'X-User-ID': userId }).then(r => Array.isArray(r) ? r : r.items || r.feed || [])),
    ]);

    const resolve = <T,>(result: PromiseSettledResult<{ data: T | null; error: string | null }>): WidgetData<T> => {
      if (result.status === 'rejected') return { data: null, loading: false, error: 'Request failed' };
      return { data: result.value.data, loading: false, error: result.value.error };
    };

    setTasksToday(resolve(todayRes));
    setTasksOverdue(resolve(overdueRes));
    setConversations(resolve(convoRes));
    setRecentDocs(resolve(docsRes));
    setEnrollments(resolve(enrollRes));
    setActivityFeed(resolve(activityRes));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return { userId, tasksToday, tasksOverdue, conversations, recentDocs, enrollments, activityFeed, refresh: load };
}

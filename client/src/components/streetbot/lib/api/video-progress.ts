/**
 * API client for Academy Video Progress.
 * Track video playback progress, bookmarks, and notes.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/sbapi';

export interface VideoProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  video_url: string;
  current_time: number;
  duration?: number;
  progress_percent: number;
  watch_count: number;
  total_watch_time: number;
  completed: boolean;
  completed_at?: string;
  watched_segments: number[][];
  playback_speed: number;
  quality: string;
  last_watched_at: string;
}

export interface VideoBookmark {
  id: string;
  user_id: string;
  lesson_id: string;
  timestamp: number;
  title?: string;
  note?: string;
  created_at: string;
}

export interface VideoNote {
  id: string;
  user_id: string;
  lesson_id: string;
  timestamp: number;
  content: string;
  created_at: string;
}

export interface LessonVideoStats {
  total_views: number;
  unique_viewers: number;
  avg_progress: number;
  completion_rate: number;
  completed_count: number;
}

// Progress Tracking
export async function getVideoProgress(lessonId: string, userId: string): Promise<VideoProgress | null> {
  const response = await fetch(`${API_BASE}/api/academy/video/progress/${lessonId}?user_id=${encodeURIComponent(userId)}`);
  if (!response.ok) return null;
  return response.json();
}

export async function updateVideoProgress(
  lessonId: string,
  data: {
    current_time: number;
    duration?: number;
    playback_speed?: number;
    quality?: string;
  },
  userId: string,
  videoUrl: string
): Promise<VideoProgress> {
  const params = new URLSearchParams({
    user_id: userId,
    video_url: videoUrl,
  });
  const response = await fetch(`${API_BASE}/api/academy/video/progress/${lessonId}?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update progress');
  return response.json();
}

export async function getLessonVideoStats(lessonId: string): Promise<LessonVideoStats> {
  const response = await fetch(`${API_BASE}/api/academy/video/stats/${lessonId}`);
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

// Bookmarks
export async function createBookmark(
  lessonId: string,
  data: { timestamp: number; title?: string; note?: string },
  userId: string
): Promise<VideoBookmark> {
  const response = await fetch(`${API_BASE}/api/academy/video/bookmarks/${lessonId}?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create bookmark');
  return response.json();
}

export async function getBookmarks(lessonId: string, userId: string): Promise<VideoBookmark[]> {
  const response = await fetch(`${API_BASE}/api/academy/video/bookmarks/${lessonId}?user_id=${encodeURIComponent(userId)}`);
  if (!response.ok) throw new Error('Failed to fetch bookmarks');
  return response.json();
}

export async function deleteBookmark(bookmarkId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/academy/video/bookmarks/${bookmarkId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete bookmark');
}

// Notes
export async function createNote(
  lessonId: string,
  data: { timestamp: number; content: string },
  userId: string
): Promise<VideoNote> {
  const response = await fetch(`${API_BASE}/api/academy/video/notes/${lessonId}?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create note');
  return response.json();
}

export async function getNotes(lessonId: string, userId: string): Promise<VideoNote[]> {
  const response = await fetch(`${API_BASE}/api/academy/video/notes/${lessonId}?user_id=${encodeURIComponent(userId)}`);
  if (!response.ok) throw new Error('Failed to fetch notes');
  return response.json();
}

export async function updateNote(noteId: string, content: string): Promise<VideoNote> {
  const response = await fetch(`${API_BASE}/api/academy/video/notes/${noteId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) throw new Error('Failed to update note');
  return response.json();
}

export async function deleteNote(noteId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/academy/video/notes/${noteId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete note');
}

/**
 * API client for Academy Discussions.
 * Per-course/lesson discussion forums with Q&A support.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/sbapi';

export interface Discussion {
  id: string;
  course_id: string;
  module_id?: string;
  lesson_id?: string;
  cohort_id?: string;
  title: string;
  content: string;
  author_id: string;
  discussion_type: string;
  is_pinned: boolean;
  is_locked: boolean;
  is_anonymous: boolean;
  view_count: number;
  reply_count: number;
  upvote_count: number;
  is_answered: boolean;
  accepted_answer_id?: string;
  moderation_status: string;
  created_at: string;
  updated_at: string;
}

export interface Reply {
  id: string;
  discussion_id: string;
  parent_reply_id?: string;
  author_id: string;
  content: string;
  is_anonymous: boolean;
  upvote_count: number;
  is_instructor_answer: boolean;
  is_accepted_answer: boolean;
  moderation_status: string;
  created_at: string;
  updated_at: string;
}

export interface DiscussionFilters {
  course_id?: string;
  module_id?: string;
  lesson_id?: string;
  cohort_id?: string;
  discussion_type?: string;
  is_answered?: boolean;
  author_id?: string;
}

// Discussion CRUD
export async function createDiscussion(
  data: {
    course_id: string;
    title: string;
    content: string;
    module_id?: string;
    lesson_id?: string;
    cohort_id?: string;
    discussion_type?: string;
    is_anonymous?: boolean;
  },
  authorId: string
): Promise<Discussion> {
  const response = await fetch(`${API_BASE}/api/academy/discussions?author_id=${encodeURIComponent(authorId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create discussion');
  return response.json();
}

export async function getDiscussion(
  discussionId: string,
  userId?: string
): Promise<{ discussion: Discussion; replies: Reply[]; user_upvoted: boolean }> {
  const params = new URLSearchParams();
  if (userId) params.set('user_id', userId);
  const response = await fetch(`${API_BASE}/api/academy/discussions/${discussionId}?${params}`);
  if (!response.ok) throw new Error('Discussion not found');
  return response.json();
}

export async function listDiscussions(
  filters: DiscussionFilters,
  options: { sort_by?: string; sort_desc?: boolean; limit?: number; offset?: number } = {}
): Promise<{ discussions: Discussion[]; total: number; limit: number; offset: number }> {
  const params = new URLSearchParams();

  if (filters.course_id) params.set('course_id', filters.course_id);
  if (filters.module_id) params.set('module_id', filters.module_id);
  if (filters.lesson_id) params.set('lesson_id', filters.lesson_id);
  if (filters.cohort_id) params.set('cohort_id', filters.cohort_id);
  if (filters.discussion_type) params.set('discussion_type', filters.discussion_type);
  if (filters.is_answered !== undefined) params.set('is_answered', String(filters.is_answered));
  if (filters.author_id) params.set('author_id', filters.author_id);

  if (options.sort_by) params.set('sort_by', options.sort_by);
  if (options.sort_desc !== undefined) params.set('sort_desc', String(options.sort_desc));
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));

  const response = await fetch(`${API_BASE}/api/academy/discussions?${params}`);
  if (!response.ok) throw new Error('Failed to fetch discussions');
  return response.json();
}

export async function updateDiscussion(
  discussionId: string,
  data: { title?: string; content?: string; is_pinned?: boolean; is_locked?: boolean },
  userId: string
): Promise<Discussion> {
  const response = await fetch(`${API_BASE}/api/academy/discussions/${discussionId}?user_id=${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update discussion');
  return response.json();
}

export async function deleteDiscussion(discussionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/academy/discussions/${discussionId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete discussion');
}

// Replies
export async function createReply(
  discussionId: string,
  data: { content: string; parent_reply_id?: string; is_anonymous?: boolean },
  authorId: string,
  isInstructor = false
): Promise<Reply> {
  const response = await fetch(
    `${API_BASE}/api/academy/discussions/${discussionId}/replies?author_id=${encodeURIComponent(authorId)}&is_instructor=${isInstructor}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!response.ok) throw new Error('Failed to create reply');
  return response.json();
}

export async function updateReply(replyId: string, content: string): Promise<Reply> {
  const response = await fetch(`${API_BASE}/api/academy/discussions/replies/${replyId}?content=${encodeURIComponent(content)}`, {
    method: 'PUT',
  });
  if (!response.ok) throw new Error('Failed to update reply');
  return response.json();
}

export async function deleteReply(discussionId: string, replyId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/academy/discussions/${discussionId}/replies/${replyId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete reply');
}

// Voting
export async function upvoteDiscussion(discussionId: string, userId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/api/academy/discussions/${discussionId}/upvote?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
  });
  return response.json();
}

export async function removeDiscussionUpvote(discussionId: string, userId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/academy/discussions/${discussionId}/upvote?user_id=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  return response.json();
}

export async function upvoteReply(replyId: string, userId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/academy/discussions/replies/${replyId}/upvote?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
  });
  return response.json();
}

// Q&A
export async function acceptAnswer(discussionId: string, replyId: string, userId: string): Promise<{ success: boolean }> {
  const response = await fetch(
    `${API_BASE}/api/academy/discussions/${discussionId}/accept-answer?reply_id=${replyId}&user_id=${encodeURIComponent(userId)}`,
    { method: 'POST' }
  );
  if (!response.ok) throw new Error('Failed to accept answer');
  return response.json();
}

// Subscriptions
export async function subscribeToDiscussion(discussionId: string, userId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/academy/discussions/${discussionId}/subscribe?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
  });
  return response.json();
}

export async function unsubscribeFromDiscussion(discussionId: string, userId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/academy/discussions/${discussionId}/subscribe?user_id=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  return response.json();
}

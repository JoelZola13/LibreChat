// Connect to Street Bot Pro unified API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || 'http://localhost:3000';

function mapPostFromApi(post: any) {
  const author = post.author || {};
  const username = author.username || 'user';

  return {
    id: post.id,
    name: author.display_name || username,
    handle: `@${username}`,
    time: new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    content: post.content,
    replies: post.replies_count ?? 0,
    reposts: post.reblogs_count ?? 0,
    likes: post.favourites_count ?? 0,
    image: Array.isArray(post.media_attachments) && post.media_attachments.length > 0,
  };
}

export async function fetchHomeTimeline(limit: number = 20): Promise<any[]> {
  const url = `${API_BASE_URL}/social/timeline/home?limit=${encodeURIComponent(limit)}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to load home timeline: ${res.status}`);
  }

  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  return items.map(mapPostFromApi);
}

export async function fetchGlobalTimeline(limit: number = 20): Promise<any[]> {
  const url = `${API_BASE_URL}/social/timeline/global?limit=${encodeURIComponent(limit)}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to load global timeline: ${res.status}`);
  }

  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  return items.map(mapPostFromApi);
}

export async function fetchUserTimeline(username: string, limit: number = 20): Promise<any[]> {
  const url = `${API_BASE_URL}/social/timeline/user/${encodeURIComponent(username)}?limit=${encodeURIComponent(limit)}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to load user timeline: ${res.status}`);
  }

  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  return items.map(mapPostFromApi);
}

export async function createStatus(content: string, authorId: string = 'demo-profile-1'): Promise<any> {
  const url = `${API_BASE_URL}/social/statuses?author_id=${encodeURIComponent(authorId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content,
      summary: null,
      visibility: 'public',
      in_reply_to_id: null,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create status: ${res.status}`);
  }

  const data = await res.json();
  return mapPostFromApi(data);
}

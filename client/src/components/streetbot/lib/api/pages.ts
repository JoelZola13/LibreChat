/**
 * Pages API - Wiki/Documentation
 */

const API_BASE = '/sbapi';

// Types
export interface Page {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  description: string | null;
  content: string;
  content_json: Record<string, unknown> | null;
  color: string;
  icon: string | null;
  parent_page_id: string | null;
  position: number;
  is_locked: boolean;
  locked_by: string | null;
  is_private: boolean;
  access_members: string[];
  is_archived: boolean;
  archived_at: string | null;
  version: number;
  word_count: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface PageVersion {
  id: string;
  page_id: string;
  version: number;
  name: string;
  content: string;
  content_json: Record<string, unknown> | null;
  user_id: string;
  change_summary: string | null;
  created_at: string;
}

export interface PageTreeNode {
  id: string;
  name: string;
  icon: string | null;
  color: string;
  parent_page_id: string | null;
  position: number;
  is_private: boolean;
  is_archived: boolean;
  children: PageTreeNode[];
}

export interface PageCreate {
  name: string;
  description?: string;
  content?: string;
  content_json?: Record<string, unknown>;
  color?: string;
  icon?: string;
  parent_page_id?: string;
  is_private?: boolean;
  access_members?: string[];
}

export interface PageUpdate {
  name?: string;
  description?: string;
  content?: string;
  content_json?: Record<string, unknown>;
  color?: string;
  icon?: string;
  parent_page_id?: string;
  is_locked?: boolean;
  is_private?: boolean;
  access_members?: string[];
  is_archived?: boolean;
  change_summary?: string;
}

// API Functions

export async function getPages(
  projectId: string,
  userId: string,
  options: { includeArchived?: boolean; parentPageId?: string } = {}
): Promise<Page[]> {
  const params = new URLSearchParams({ user_id: userId });
  if (options.includeArchived) params.append('include_archived', 'true');
  if (options.parentPageId) params.append('parent_page_id', options.parentPageId);

  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages?${params}`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch pages');
  return res.json();
}

export async function getPageTree(
  projectId: string,
  includeArchived: boolean = false
): Promise<PageTreeNode[]> {
  const params = new URLSearchParams();
  if (includeArchived) params.append('include_archived', 'true');

  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages/tree?${params}`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch page tree');
  return res.json();
}

export async function getRecentPages(
  projectId: string,
  userId: string,
  limit: number = 10
): Promise<Page[]> {
  const params = new URLSearchParams({
    user_id: userId,
    limit: limit.toString(),
  });

  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages/recent?${params}`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch recent pages');
  return res.json();
}

export async function getFavoritePages(
  projectId: string,
  userId: string
): Promise<Page[]> {
  const params = new URLSearchParams({ user_id: userId });

  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages/favorites?${params}`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch favorite pages');
  return res.json();
}

export async function searchPages(
  projectId: string,
  query: string,
  limit: number = 20
): Promise<Page[]> {
  const params = new URLSearchParams({
    q: query,
    limit: limit.toString(),
  });

  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages/search?${params}`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to search pages');
  return res.json();
}

export async function getPage(
  projectId: string,
  pageId: string,
  userId?: string
): Promise<Page> {
  const params = new URLSearchParams();
  if (userId) params.append('user_id', userId);

  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages/${pageId}?${params}`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch page');
  return res.json();
}

export async function createPage(
  projectId: string,
  data: PageCreate,
  userId: string
): Promise<Page> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages?user_id=${userId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error('Failed to create page');
  return res.json();
}

export async function updatePage(
  projectId: string,
  pageId: string,
  data: PageUpdate,
  userId: string
): Promise<Page> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages/${pageId}?user_id=${userId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error('Failed to update page');
  return res.json();
}

export async function deletePage(projectId: string, pageId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages/${pageId}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error('Failed to delete page');
}

export async function movePage(
  projectId: string,
  pageId: string,
  newParentId: string | null,
  newPosition: number
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages/${pageId}/move`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        new_parent_id: newParentId,
        new_position: newPosition,
      }),
    }
  );
  if (!res.ok) throw new Error('Failed to move page');
}

export async function duplicatePage(
  projectId: string,
  pageId: string,
  userId: string,
  includeChildren: boolean = false
): Promise<Page> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages/${pageId}/duplicate?user_id=${userId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ include_children: includeChildren }),
    }
  );
  if (!res.ok) throw new Error('Failed to duplicate page');
  return res.json();
}

export async function archivePage(
  projectId: string,
  pageId: string,
  userId: string
): Promise<Page> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages/${pageId}/archive?user_id=${userId}`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error('Failed to archive page');
  return res.json();
}

export async function unarchivePage(
  projectId: string,
  pageId: string,
  userId: string
): Promise<Page> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages/${pageId}/unarchive?user_id=${userId}`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error('Failed to unarchive page');
  return res.json();
}

// Favorites

export async function addFavorite(
  projectId: string,
  pageId: string,
  userId: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages/${pageId}/favorite?user_id=${userId}`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error('Failed to add favorite');
}

export async function removeFavorite(
  projectId: string,
  pageId: string,
  userId: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages/${pageId}/favorite?user_id=${userId}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error('Failed to remove favorite');
}

// Locking

export async function lockPage(
  projectId: string,
  pageId: string,
  userId: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages/${pageId}/lock?user_id=${userId}`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error('Failed to lock page');
}

export async function unlockPage(
  projectId: string,
  pageId: string,
  userId: string,
  force: boolean = false
): Promise<void> {
  const params = new URLSearchParams({ user_id: userId });
  if (force) params.append('force', 'true');

  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages/${pageId}/unlock?${params}`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error('Failed to unlock page');
}

// Versions

export async function getPageVersions(
  projectId: string,
  pageId: string,
  limit: number = 50,
  offset: number = 0
): Promise<PageVersion[]> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages/${pageId}/versions?${params}`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch page versions');
  return res.json();
}

export async function getPageVersion(
  projectId: string,
  pageId: string,
  version: number
): Promise<PageVersion> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages/${pageId}/versions/${version}`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch page version');
  return res.json();
}

export async function restorePageVersion(
  projectId: string,
  pageId: string,
  version: number,
  userId: string
): Promise<Page> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/pages/${pageId}/restore?user_id=${userId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version }),
    }
  );
  if (!res.ok) throw new Error('Failed to restore page version');
  return res.json();
}

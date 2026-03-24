/**
 * Documents API adapter for LibreChat (Vite).
 * Minimal subset needed by DocumentPickerModal.
 */

import { sbFetch } from '../../shared/sbFetch';

const BASE = '/api/documents';

// =============================================================================
// Types
// =============================================================================

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  slug: string;
  icon: string;
  color: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  workspaceId?: string;
  parentId?: string;
  name: string;
  description?: string;
  icon: string;
  color?: string;
  sortOrder: number;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  title: string;
  slug?: string;
  workspaceId?: string;
  folderId?: string;
  templateId?: string;
  documentType: string;
  status: string;
  wordCount: number;
  readingTimeMinutes: number;
  authorId?: string;
  isPinned: boolean;
  isArchived: boolean;
  isLocked: boolean;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Transform helpers
// =============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
function transformWorkspace(api: any): Workspace {
  return { id: api.id, name: api.name, description: api.description, slug: api.slug, icon: api.icon, color: api.color, isDefault: api.is_default, createdAt: api.created_at, updatedAt: api.updated_at };
}

function transformFolder(api: any): Folder {
  return { id: api.id, workspaceId: api.workspace_id, parentId: api.parent_id, name: api.name, description: api.description, icon: api.icon, color: api.color, sortOrder: api.sort_order, documentCount: api.document_count, createdAt: api.created_at, updatedAt: api.updated_at };
}

function transformDocument(api: any): Document {
  return { id: api.id, title: api.title, slug: api.slug, workspaceId: api.workspace_id, folderId: api.folder_id, templateId: api.template_id, documentType: api.document_type, status: api.status, wordCount: api.word_count, readingTimeMinutes: api.reading_time_minutes, authorId: api.author_id, isPinned: api.is_pinned, isArchived: api.is_archived, isLocked: api.is_locked, tags: api.tags || [], isFavorite: api.is_favorite, createdAt: api.created_at, updatedAt: api.updated_at };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// =============================================================================
// API Functions
// =============================================================================

export async function fetchWorkspaces(): Promise<Workspace[]> {
  try {
    const response = await sbFetch(`${BASE}/workspaces`);
    if (!response.ok) return [];
    const data = await response.json();
    return (Array.isArray(data) ? data : data.workspaces || []).map(transformWorkspace);
  } catch { return []; }
}

export async function fetchFolders(workspaceId?: string, parentId?: string): Promise<Folder[]> {
  try {
    const params = new URLSearchParams();
    if (workspaceId) params.set('workspace_id', workspaceId);
    if (parentId) params.set('parent_id', parentId);
    const qs = params.toString();
    const response = await sbFetch(`${BASE}/folders${qs ? '?' + qs : ''}`);
    if (!response.ok) return [];
    const data = await response.json();
    return (Array.isArray(data) ? data : data.folders || []).map(transformFolder);
  } catch { return []; }
}

export async function fetchDocuments(options?: { workspaceId?: string; folderId?: string; limit?: number; offset?: number }): Promise<Document[]> {
  try {
    const params = new URLSearchParams();
    if (options?.workspaceId) params.set('workspace_id', options.workspaceId);
    if (options?.folderId) params.set('folder_id', options.folderId);
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());
    const qs = params.toString();
    const response = await sbFetch(`${BASE}${qs ? '?' + qs : ''}`);
    if (!response.ok) return [];
    const data = await response.json();
    const docs = Array.isArray(data) ? data : data.documents || [];
    return docs.map(transformDocument);
  } catch { return []; }
}

export async function searchDocuments(query: string, limit = 20): Promise<Document[]> {
  try {
    const response = await sbFetch(`${BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    if (!response.ok) return [];
    const data = await response.json();
    const docs = Array.isArray(data) ? data : data.documents || data.results || [];
    return docs.map(transformDocument);
  } catch { return []; }
}

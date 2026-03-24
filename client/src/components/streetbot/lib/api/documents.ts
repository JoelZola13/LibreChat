/**
 * Documents API service - connects frontend to backend document management
 * Internal Word-Doc System for Street Voices
 */

// ============================================================================
// Types matching the backend API responses (snake_case from API)
// ============================================================================

interface WorkspaceApiResponse {
  id: string;
  name: string;
  description?: string;
  slug: string;
  icon: string;
  color: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface FolderApiResponse {
  id: string;
  workspace_id?: string;
  parent_id?: string;
  name: string;
  description?: string;
  icon: string;
  color?: string;
  sort_order: number;
  document_count: number;
  created_at: string;
  updated_at: string;
}

interface TemplateApiResponse {
  id: string;
  name: string;
  description?: string;
  template_type: string;
  category: string;
  icon: string;
  thumbnail_url?: string;
  usage_count: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateDetailApiResponse extends TemplateApiResponse {
  structure: Record<string, unknown>;
  content: TipTapContent;
  variables: Record<string, unknown>[];
  styles: Record<string, unknown>;
}

interface DocumentApiResponse {
  id: string;
  title: string;
  slug?: string;
  workspace_id?: string;
  folder_id?: string;
  template_id?: string;
  document_type: string;
  status: string;
  word_count: number;
  reading_time_minutes: number;
  author_id?: string;
  is_pinned: boolean;
  is_archived: boolean;
  is_locked: boolean;
  version_count: number;
  comment_count: number;
  share_count: number;
  view_count: number;
  tags: string[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

interface DocumentDetailApiResponse extends DocumentApiResponse {
  content: TipTapContent;
  content_text: string;
  metadata: Record<string, unknown>;
  last_edited_by?: string;
  published_at?: string;
}

interface VersionApiResponse {
  id: string;
  document_id: string;
  version_number: number;
  title: string;
  word_count: number;
  change_note?: string;
  change_type: string;
  author_id?: string;
  created_at: string;
}

interface ShareApiResponse {
  id: string;
  document_id: string;
  user_id?: string;
  email?: string;
  permission: string;
  share_token?: string;
  is_external: boolean;
  expires_at?: string;
  created_at: string;
}

interface CommentApiResponse {
  id: string;
  document_id: string;
  parent_id?: string;
  user_id?: string;
  content: string;
  anchor_type: string;
  anchor_from?: number;
  anchor_to?: number;
  anchor_text?: string;
  is_resolved: boolean;
  assigned_to?: string;
  reply_count: number;
  created_at: string;
  updated_at: string;
}

interface ActivityApiResponse {
  id: string;
  document_id: string;
  user_id?: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface DocumentListApiResponse {
  documents: DocumentApiResponse[];
  total: number;
}

// ============================================================================
// Frontend types (camelCase for React)
// ============================================================================

export interface TipTapContent {
  type?: string;  // Optional for JSONContent compatibility
  content?: TipTapNode[];
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: TipTapMark[];
  content?: TipTapNode[];
  text?: string;
}

export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

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

export interface Template {
  id: string;
  name: string;
  description?: string;
  templateType: string;
  category: string;
  icon: string;
  thumbnailUrl?: string;
  usageCount: number;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateDetail extends Template {
  structure: Record<string, unknown>;
  content: TipTapContent;
  variables: Record<string, unknown>[];
  styles: Record<string, unknown>;
}

export interface Document {
  id: string;
  title: string;
  slug?: string;
  workspaceId?: string;
  folderId?: string;
  templateId?: string;
  documentType: DocumentType;
  status: DocumentStatus;
  wordCount: number;
  readingTimeMinutes: number;
  authorId?: string;
  isPinned: boolean;
  isArchived: boolean;
  isLocked: boolean;
  versionCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends Document {
  content: TipTapContent;
  contentText: string;
  metadata: Record<string, unknown>;
  lastEditedBy?: string;
  publishedAt?: string;
}

export interface Version {
  id: string;
  documentId: string;
  versionNumber: number;
  title: string;
  wordCount: number;
  changeNote?: string;
  changeType: string;
  authorId?: string;
  createdAt: string;
}

export interface Share {
  id: string;
  documentId: string;
  userId?: string;
  email?: string;
  permission: SharePermission;
  shareToken?: string;
  isExternal: boolean;
  expiresAt?: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  documentId: string;
  parentId?: string;
  userId?: string;
  content: string;
  anchorType: "document" | "selection" | "block";
  anchorFrom?: number;
  anchorTo?: number;
  anchorText?: string;
  isResolved: boolean;
  assignedTo?: string;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  documentId: string;
  userId?: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

// ============================================================================
// Enums and Constants
// ============================================================================

export type DocumentType =
  | "general"
  | "memo"
  | "report"
  | "policy"
  | "procedure"
  | "proposal"
  | "letter"
  | "article"
  | "press_release"
  | "meeting_minutes"
  | "grant_proposal"
  | "training_material"
  | "contract"
  | "invoice"
  | "scope_of_work";

export type DocumentStatus =
  | "draft"
  | "review"
  | "approved"
  | "published"
  | "archived";

export type SharePermission = "view" | "comment" | "edit" | "admin";

export const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: "general", label: "General" },
  { value: "memo", label: "Memo" },
  { value: "report", label: "Report" },
  { value: "policy", label: "Policy" },
  { value: "procedure", label: "Procedure" },
  { value: "proposal", label: "Proposal" },
  { value: "letter", label: "Letter" },
  { value: "article", label: "Article" },
  { value: "press_release", label: "Press Release" },
  { value: "meeting_minutes", label: "Meeting Minutes" },
  { value: "grant_proposal", label: "Grant Proposal" },
  { value: "training_material", label: "Training Material" },
  { value: "contract", label: "Contract" },
  { value: "invoice", label: "Invoice" },
  { value: "scope_of_work", label: "Scope of Work" },
];

export const DOCUMENT_STATUSES: { value: DocumentStatus; label: string; color: string }[] = [
  { value: "draft", label: "Draft", color: "#6B7280" },
  { value: "review", label: "In Review", color: "#F59E0B" },
  { value: "approved", label: "Approved", color: "#10B981" },
  { value: "published", label: "Published", color: "#3B82F6" },
  { value: "archived", label: "Archived", color: "#9CA3AF" },
];

// ============================================================================
// Transform functions (API -> Frontend)
// ============================================================================

function transformWorkspace(api: WorkspaceApiResponse): Workspace {
  return {
    id: api.id,
    name: api.name,
    description: api.description,
    slug: api.slug,
    icon: api.icon,
    color: api.color,
    isDefault: api.is_default,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

function transformFolder(api: FolderApiResponse): Folder {
  return {
    id: api.id,
    workspaceId: api.workspace_id,
    parentId: api.parent_id,
    name: api.name,
    description: api.description,
    icon: api.icon,
    color: api.color,
    sortOrder: api.sort_order,
    documentCount: api.document_count,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

function transformTemplate(api: TemplateApiResponse): Template {
  return {
    id: api.id,
    name: api.name,
    description: api.description,
    templateType: api.template_type,
    category: api.category,
    icon: api.icon,
    thumbnailUrl: api.thumbnail_url,
    usageCount: api.usage_count,
    isSystem: api.is_system,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

function transformTemplateDetail(api: TemplateDetailApiResponse): TemplateDetail {
  return {
    ...transformTemplate(api),
    structure: api.structure,
    content: api.content,
    variables: api.variables,
    styles: api.styles,
  };
}

function transformDocument(api: DocumentApiResponse): Document {
  return {
    id: api.id,
    title: api.title,
    slug: api.slug,
    workspaceId: api.workspace_id,
    folderId: api.folder_id,
    templateId: api.template_id,
    documentType: api.document_type as DocumentType,
    status: api.status as DocumentStatus,
    wordCount: api.word_count,
    readingTimeMinutes: api.reading_time_minutes,
    authorId: api.author_id,
    isPinned: api.is_pinned,
    isArchived: api.is_archived,
    isLocked: api.is_locked,
    versionCount: api.version_count,
    commentCount: api.comment_count,
    shareCount: api.share_count,
    viewCount: api.view_count,
    tags: api.tags || [],
    isFavorite: api.is_favorite,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

function transformDocumentDetail(api: DocumentDetailApiResponse): DocumentDetail {
  return {
    ...transformDocument(api),
    content: api.content,
    contentText: api.content_text,
    metadata: api.metadata,
    lastEditedBy: api.last_edited_by,
    publishedAt: api.published_at,
  };
}

function transformVersion(api: VersionApiResponse): Version {
  return {
    id: api.id,
    documentId: api.document_id,
    versionNumber: api.version_number,
    title: api.title,
    wordCount: api.word_count,
    changeNote: api.change_note,
    changeType: api.change_type,
    authorId: api.author_id,
    createdAt: api.created_at,
  };
}

function transformShare(api: ShareApiResponse): Share {
  return {
    id: api.id,
    documentId: api.document_id,
    userId: api.user_id,
    email: api.email,
    permission: api.permission as SharePermission,
    shareToken: api.share_token,
    isExternal: api.is_external,
    expiresAt: api.expires_at,
    createdAt: api.created_at,
  };
}

function transformComment(api: CommentApiResponse): Comment {
  return {
    id: api.id,
    documentId: api.document_id,
    parentId: api.parent_id,
    userId: api.user_id,
    content: api.content,
    anchorType: api.anchor_type as "document" | "selection" | "block",
    anchorFrom: api.anchor_from,
    anchorTo: api.anchor_to,
    anchorText: api.anchor_text,
    isResolved: api.is_resolved,
    assignedTo: api.assigned_to,
    replyCount: api.reply_count,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

function transformActivity(api: ActivityApiResponse): Activity {
  return {
    id: api.id,
    documentId: api.document_id,
    userId: api.user_id,
    action: api.action,
    details: api.details,
    createdAt: api.created_at,
  };
}

// ============================================================================
// API Error class
// ============================================================================

export class DocumentsApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "DocumentsApiError";
  }
}

// ============================================================================
// Helper for API calls
// ============================================================================

async function apiCall<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorDetail;
    try {
      errorDetail = await response.json();
    } catch {
      errorDetail = await response.text();
    }
    throw new DocumentsApiError(
      `API error: ${response.statusText}`,
      response.status,
      errorDetail
    );
  }

  return response.json();
}

// ============================================================================
// Workspaces API
// ============================================================================

export async function fetchWorkspaces(userId: string): Promise<Workspace[]> {
  const data = await apiCall<WorkspaceApiResponse[]>(
    `/api/document-workspaces?user_id=${userId}`
  );
  return data.map(transformWorkspace);
}

export async function fetchWorkspace(workspaceId: string): Promise<Workspace> {
  const data = await apiCall<WorkspaceApiResponse>(
    `/api/document-workspaces/${workspaceId}`
  );
  return transformWorkspace(data);
}

export async function createWorkspace(
  userId: string,
  workspace: { name: string; description?: string; slug: string; icon?: string; color?: string }
): Promise<Workspace> {
  const data = await apiCall<WorkspaceApiResponse>(
    `/api/document-workspaces?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify(workspace),
    }
  );
  return transformWorkspace(data);
}

export async function updateWorkspace(
  workspaceId: string,
  updates: Partial<{ name: string; description: string; icon: string; color: string }>
): Promise<Workspace> {
  const data = await apiCall<WorkspaceApiResponse>(
    `/api/document-workspaces/${workspaceId}`,
    {
      method: "PATCH",
      body: JSON.stringify(updates),
    }
  );
  return transformWorkspace(data);
}

// ============================================================================
// Folders API
// ============================================================================

export async function fetchFolders(workspaceId: string): Promise<Folder[]> {
  const data = await apiCall<FolderApiResponse[]>(
    `/api/document-workspaces/${workspaceId}/folders`
  );
  return data.map(transformFolder);
}

export async function createFolder(
  workspaceId: string,
  userId: string,
  folder: { name: string; description?: string; parentId?: string; icon?: string; color?: string }
): Promise<Folder> {
  const data = await apiCall<FolderApiResponse>(
    `/api/document-workspaces/${workspaceId}/folders?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({
        workspace_id: workspaceId,
        parent_id: folder.parentId,
        name: folder.name,
        description: folder.description,
        icon: folder.icon,
        color: folder.color,
      }),
    }
  );
  return transformFolder(data);
}

// ============================================================================
// Templates API
// ============================================================================

export async function fetchTemplates(category?: string): Promise<Template[]> {
  const params = new URLSearchParams();
  if (category) params.append("category", category);

  const url = `/api/document-templates${params.toString() ? `?${params}` : ""}`;
  const data = await apiCall<TemplateApiResponse[]>(url);
  return data.map(transformTemplate);
}

export async function fetchTemplate(templateId: string): Promise<TemplateDetail> {
  const data = await apiCall<TemplateDetailApiResponse>(
    `/api/document-templates/${templateId}`
  );
  return transformTemplateDetail(data);
}

export async function createTemplate(
  userId: string,
  template: {
    name: string;
    description?: string;
    templateType?: string;
    category?: string;
    icon?: string;
    structure?: Record<string, unknown>;
    content?: TipTapContent | Record<string, unknown>;  // Accept any JSON content
    variables?: Record<string, unknown>[];
    styles?: Record<string, unknown>;
  }
): Promise<Template> {
  const data = await apiCall<TemplateApiResponse>(
    `/api/document-templates?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({
        name: template.name,
        description: template.description,
        template_type: template.templateType,
        category: template.category,
        icon: template.icon,
        structure: template.structure,
        content: template.content,
        variables: template.variables,
        styles: template.styles,
      }),
    }
  );
  return transformTemplate(data);
}

export async function updateTemplate(
  templateId: string,
  updates: Partial<{
    name: string;
    description: string;
    templateType: string;
    category: string;
    icon: string;
    structure: Record<string, unknown>;
    content: TipTapContent;
    variables: Record<string, unknown>[];
    styles: Record<string, unknown>;
  }>
): Promise<Template> {
  const data = await apiCall<TemplateApiResponse>(
    `/api/document-templates/${templateId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        name: updates.name,
        description: updates.description,
        template_type: updates.templateType,
        category: updates.category,
        icon: updates.icon,
        structure: updates.structure,
        content: updates.content,
        variables: updates.variables,
        styles: updates.styles,
      }),
    }
  );
  return transformTemplate(data);
}

export async function deleteTemplate(
  templateId: string,
  userId: string
): Promise<void> {
  await apiCall<{ success: boolean }>(
    `/api/document-templates/${templateId}?user_id=${userId}`,
    { method: "DELETE" }
  );
}

export async function duplicateTemplate(
  templateId: string,
  userId: string
): Promise<Template> {
  const data = await apiCall<TemplateApiResponse>(
    `/api/document-templates/${templateId}/duplicate?user_id=${userId}`,
    { method: "POST" }
  );
  return transformTemplate(data);
}

// ============================================================================
// Documents API
// ============================================================================

export interface FetchDocumentsOptions {
  userId: string;
  workspaceId?: string;
  folderId?: string;
  status?: DocumentStatus;
  documentType?: DocumentType;
  limit?: number;
  offset?: number;
}

export async function fetchDocuments(
  options: FetchDocumentsOptions
): Promise<{ documents: Document[]; total: number }> {
  const params = new URLSearchParams({ user_id: options.userId });
  if (options.workspaceId) params.append("workspace_id", options.workspaceId);
  if (options.folderId) params.append("folder_id", options.folderId);
  if (options.status) params.append("status", options.status);
  if (options.documentType) params.append("document_type", options.documentType);
  if (options.limit) params.append("limit", options.limit.toString());
  if (options.offset) params.append("offset", options.offset.toString());

  const data = await apiCall<DocumentListApiResponse>(
    `/api/documents?${params.toString()}`
  );
  return {
    documents: data.documents.map(transformDocument),
    total: data.total,
  };
}

export async function searchDocuments(
  userId: string,
  query: string,
  options?: {
    workspaceId?: string;
    status?: DocumentStatus;
    documentType?: DocumentType;
    limit?: number;
  }
): Promise<{ documents: Document[]; total: number }> {
  const params = new URLSearchParams({ user_id: userId, q: query });
  if (options?.workspaceId) params.append("workspace_id", options.workspaceId);
  if (options?.status) params.append("status", options.status);
  if (options?.documentType) params.append("document_type", options.documentType);
  if (options?.limit) params.append("limit", options.limit.toString());

  const data = await apiCall<DocumentListApiResponse>(
    `/api/documents/search?${params.toString()}`
  );
  return {
    documents: data.documents.map(transformDocument),
    total: data.total,
  };
}

export async function fetchRecentDocuments(
  userId: string,
  limit?: number
): Promise<Document[]> {
  const params = new URLSearchParams({ user_id: userId });
  if (limit) params.append("limit", limit.toString());

  const data = await apiCall<DocumentApiResponse[]>(
    `/api/documents/recent?${params.toString()}`
  );
  return data.map(transformDocument);
}

export async function fetchFavoriteDocuments(userId: string): Promise<Document[]> {
  const data = await apiCall<DocumentApiResponse[]>(
    `/api/documents/favorites?user_id=${userId}`
  );
  return data.map(transformDocument);
}

export async function fetchTrashDocuments(
  userId: string,
  limit?: number,
  offset?: number
): Promise<{ documents: Document[]; total: number }> {
  const params = new URLSearchParams({ user_id: userId });
  if (limit) params.append("limit", limit.toString());
  if (offset) params.append("offset", offset.toString());

  const data = await apiCall<DocumentListApiResponse>(
    `/api/documents/trash?${params.toString()}`
  );
  return {
    documents: data.documents.map(transformDocument),
    total: data.total,
  };
}

export async function emptyTrash(userId: string): Promise<{ deletedCount: number }> {
  const data = await apiCall<{ success: boolean; deleted_count: number }>(
    `/api/documents/trash/empty?user_id=${userId}`,
    { method: "DELETE" }
  );
  return { deletedCount: data.deleted_count };
}

export async function fetchDocument(
  documentId: string,
  userId: string
): Promise<DocumentDetail> {
  const data = await apiCall<DocumentDetailApiResponse>(
    `/api/documents/${documentId}?user_id=${userId}`
  );
  return transformDocumentDetail(data);
}

export async function createDocument(
  userId: string,
  document: {
    title?: string;
    workspaceId?: string;
    folderId?: string;
    documentType?: DocumentType;
    content?: TipTapContent | Record<string, unknown>;  // Accept any JSON content
    tags?: string[];
  }
): Promise<DocumentDetail> {
  const data = await apiCall<DocumentDetailApiResponse>(
    `/api/documents?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({
        title: document.title,
        workspace_id: document.workspaceId,
        folder_id: document.folderId,
        document_type: document.documentType,
        content: document.content,
        tags: document.tags,
      }),
    }
  );
  return transformDocumentDetail(data);
}

export async function createDocumentFromTemplate(
  userId: string,
  templateId: string,
  options?: {
    title?: string;
    workspaceId?: string;
    folderId?: string;
  }
): Promise<DocumentDetail> {
  const data = await apiCall<DocumentDetailApiResponse>(
    `/api/documents/from-template?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({
        template_id: templateId,
        title: options?.title,
        workspace_id: options?.workspaceId,
        folder_id: options?.folderId,
      }),
    }
  );
  return transformDocumentDetail(data);
}

export async function updateDocument(
  documentId: string,
  userId: string,
  updates: Partial<{
    title: string;
    workspaceId: string;
    folderId: string;
    documentType: DocumentType;
    status: DocumentStatus;
    content: TipTapContent | Record<string, unknown>;  // Accept any JSON content
    isPinned: boolean;
    isArchived: boolean;
    metadata: Record<string, unknown>;
    tags: string[];
  }>
): Promise<DocumentDetail> {
  const data = await apiCall<DocumentDetailApiResponse>(
    `/api/documents/${documentId}?user_id=${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        title: updates.title,
        workspace_id: updates.workspaceId,
        folder_id: updates.folderId,
        document_type: updates.documentType,
        status: updates.status,
        content: updates.content,
        is_pinned: updates.isPinned,
        is_archived: updates.isArchived,
        metadata: updates.metadata,
        tags: updates.tags,
      }),
    }
  );
  return transformDocumentDetail(data);
}

export async function deleteDocument(
  documentId: string,
  userId: string,
  hardDelete = false
): Promise<void> {
  await apiCall<{ success: boolean }>(
    `/api/documents/${documentId}?user_id=${userId}&hard_delete=${hardDelete}`,
    { method: "DELETE" }
  );
}

export async function restoreDocument(
  documentId: string,
  userId: string
): Promise<DocumentDetail> {
  const data = await apiCall<DocumentDetailApiResponse>(
    `/api/documents/${documentId}/restore?user_id=${userId}`,
    { method: "POST" }
  );
  return transformDocumentDetail(data);
}

// ============================================================================
// Favorites API
// ============================================================================

export async function addFavorite(documentId: string, userId: string): Promise<void> {
  await apiCall<{ success: boolean }>(
    `/api/documents/${documentId}/favorite?user_id=${userId}`,
    { method: "POST" }
  );
}

export async function removeFavorite(documentId: string, userId: string): Promise<void> {
  await apiCall<{ success: boolean }>(
    `/api/documents/${documentId}/favorite?user_id=${userId}`,
    { method: "DELETE" }
  );
}

// ============================================================================
// Versions API
// ============================================================================

export async function fetchVersions(
  documentId: string,
  limit?: number
): Promise<Version[]> {
  const params = limit ? `?limit=${limit}` : "";
  const data = await apiCall<{ versions: VersionApiResponse[] }>(
    `/api/documents/${documentId}/versions${params}`
  );
  return data.versions.map(transformVersion);
}

export async function restoreVersion(
  documentId: string,
  versionId: string,
  userId: string
): Promise<DocumentDetail> {
  const data = await apiCall<DocumentDetailApiResponse>(
    `/api/documents/${documentId}/restore/${versionId}?user_id=${userId}`,
    { method: "POST" }
  );
  return transformDocumentDetail(data);
}

// ============================================================================
// Shares API
// ============================================================================

export async function fetchShares(documentId: string): Promise<Share[]> {
  const data = await apiCall<ShareApiResponse[]>(
    `/api/documents/${documentId}/shares`
  );
  return data.map(transformShare);
}

export async function createShare(
  documentId: string,
  userId: string,
  share: {
    userId?: string;
    email?: string;
    permission?: SharePermission;
    isExternal?: boolean;
    expiresAt?: string;
  }
): Promise<Share> {
  const data = await apiCall<ShareApiResponse>(
    `/api/documents/${documentId}/shares?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({
        user_id: share.userId,
        email: share.email,
        permission: share.permission,
        is_external: share.isExternal,
        expires_at: share.expiresAt,
      }),
    }
  );
  return transformShare(data);
}

export async function updateShare(
  documentId: string,
  shareId: string,
  updates: Partial<{ permission: SharePermission; expiresAt: string }>
): Promise<Share> {
  const data = await apiCall<ShareApiResponse>(
    `/api/documents/${documentId}/shares/${shareId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        permission: updates.permission,
        expires_at: updates.expiresAt,
      }),
    }
  );
  return transformShare(data);
}

export async function deleteShare(
  documentId: string,
  shareId: string,
  userId: string
): Promise<void> {
  await apiCall<{ success: boolean }>(
    `/api/documents/${documentId}/shares/${shareId}?user_id=${userId}`,
    { method: "DELETE" }
  );
}

// ============================================================================
// Comments API
// ============================================================================

export async function fetchComments(documentId: string): Promise<Comment[]> {
  const data = await apiCall<{ comments: CommentApiResponse[] }>(
    `/api/documents/${documentId}/comments`
  );
  return data.comments.map(transformComment);
}

export async function createComment(
  documentId: string,
  userId: string,
  comment: {
    content: string;
    parentId?: string;
    anchorType?: "document" | "selection" | "block";
    anchorFrom?: number;
    anchorTo?: number;
    anchorText?: string;
    assignedTo?: string;
  }
): Promise<Comment> {
  const data = await apiCall<CommentApiResponse>(
    `/api/documents/${documentId}/comments?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({
        content: comment.content,
        parent_id: comment.parentId,
        anchor_type: comment.anchorType,
        anchor_from: comment.anchorFrom,
        anchor_to: comment.anchorTo,
        anchor_text: comment.anchorText,
        assigned_to: comment.assignedTo,
      }),
    }
  );
  return transformComment(data);
}

export async function updateComment(
  documentId: string,
  commentId: string,
  content: string
): Promise<Comment> {
  const data = await apiCall<CommentApiResponse>(
    `/api/documents/${documentId}/comments/${commentId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ content }),
    }
  );
  return transformComment(data);
}

export async function resolveComment(
  documentId: string,
  commentId: string,
  userId: string
): Promise<Comment> {
  const data = await apiCall<CommentApiResponse>(
    `/api/documents/${documentId}/comments/${commentId}/resolve?user_id=${userId}`,
    { method: "POST" }
  );
  return transformComment(data);
}

export async function deleteComment(
  documentId: string,
  commentId: string
): Promise<void> {
  await apiCall<{ success: boolean }>(
    `/api/documents/${documentId}/comments/${commentId}`,
    { method: "DELETE" }
  );
}

// ============================================================================
// Tags API
// ============================================================================

export async function fetchTags(documentId: string): Promise<string[]> {
  return apiCall<string[]>(`/api/documents/${documentId}/tags`);
}

export async function addTag(documentId: string, tag: string): Promise<void> {
  await apiCall<{ success: boolean }>(
    `/api/documents/${documentId}/tags?tag=${encodeURIComponent(tag)}`,
    { method: "POST" }
  );
}

export async function removeTag(documentId: string, tag: string): Promise<void> {
  await apiCall<{ success: boolean }>(
    `/api/documents/${documentId}/tags/${encodeURIComponent(tag)}`,
    { method: "DELETE" }
  );
}

// ============================================================================
// Activity API
// ============================================================================

export async function fetchActivity(
  documentId: string,
  limit?: number
): Promise<Activity[]> {
  const params = limit ? `?limit=${limit}` : "";
  const data = await apiCall<ActivityApiResponse[]>(
    `/api/documents/${documentId}/activity${params}`
  );
  return data.map(transformActivity);
}

// ============================================================================
// Export API
// ============================================================================

export type ExportFormat = "pdf" | "docx" | "markdown" | "html";

export const EXPORT_FORMATS: { value: ExportFormat; label: string; extension: string; mimeType: string }[] = [
  { value: "pdf", label: "PDF Document", extension: ".pdf", mimeType: "application/pdf" },
  { value: "docx", label: "Word Document", extension: ".docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { value: "markdown", label: "Markdown", extension: ".md", mimeType: "text/markdown" },
  { value: "html", label: "HTML", extension: ".html", mimeType: "text/html" },
];

export async function exportDocument(
  documentId: string,
  userId: string,
  format: ExportFormat,
  includeMetadata = true
): Promise<Blob> {
  const response = await fetch(
    `/api/documents/${documentId}/export?user_id=${userId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        format,
        include_metadata: includeMetadata,
      }),
    }
  );

  if (!response.ok) {
    let errorDetail;
    try {
      errorDetail = await response.json();
    } catch {
      errorDetail = await response.text();
    }
    throw new DocumentsApiError(
      `Export failed: ${response.statusText}`,
      response.status,
      errorDetail
    );
  }

  return response.blob();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// Suggestions (Track Changes) API
// ============================================================================

interface SuggestionApiResponse {
  id: string;
  document_id: string;
  suggestion_id: string;
  suggestion_type: "insertion" | "deletion";
  original_text?: string;
  suggested_text?: string;
  anchor_from: number;
  anchor_to: number;
  author_id?: string;
  author_name?: string;
  author_color?: string;
  status: "pending" | "accepted" | "rejected";
  resolved_by?: string;
  resolved_at?: string;
  resolution_note?: string;
  created_at: string;
  updated_at: string;
}

interface SuggestionStatsApiResponse {
  pending: number;
  accepted: number;
  rejected: number;
  total: number;
}

export interface Suggestion {
  id: string;
  documentId: string;
  suggestionId: string;
  suggestionType: "insertion" | "deletion";
  originalText?: string;
  suggestedText?: string;
  anchorFrom: number;
  anchorTo: number;
  authorId?: string;
  authorName?: string;
  authorColor?: string;
  status: "pending" | "accepted" | "rejected";
  resolvedBy?: string;
  resolvedAt?: Date;
  resolutionNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SuggestionStats {
  pending: number;
  accepted: number;
  rejected: number;
  total: number;
}

export interface CreateSuggestionData {
  suggestionId: string;
  suggestionType: "insertion" | "deletion";
  originalText?: string;
  suggestedText?: string;
  anchorFrom: number;
  anchorTo: number;
  authorName?: string;
  authorColor?: string;
}

function transformSuggestion(data: SuggestionApiResponse): Suggestion {
  return {
    id: data.id,
    documentId: data.document_id,
    suggestionId: data.suggestion_id,
    suggestionType: data.suggestion_type,
    originalText: data.original_text,
    suggestedText: data.suggested_text,
    anchorFrom: data.anchor_from,
    anchorTo: data.anchor_to,
    authorId: data.author_id,
    authorName: data.author_name,
    authorColor: data.author_color,
    status: data.status,
    resolvedBy: data.resolved_by,
    resolvedAt: data.resolved_at ? new Date(data.resolved_at) : undefined,
    resolutionNote: data.resolution_note,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

export async function fetchSuggestions(
  documentId: string,
  options?: {
    status?: "pending" | "accepted" | "rejected";
    authorId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<Suggestion[]> {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.authorId) params.set("author_id", options.authorId);
  if (options?.limit) params.set("limit", options.limit.toString());
  if (options?.offset) params.set("offset", options.offset.toString());

  const queryString = params.toString();
  const url = `/api/documents/${documentId}/suggestions${queryString ? `?${queryString}` : ""}`;

  const data = await apiCall<SuggestionApiResponse[]>(url);
  return data.map(transformSuggestion);
}

export async function fetchSuggestionStats(documentId: string): Promise<SuggestionStats> {
  return apiCall<SuggestionStatsApiResponse>(
    `/api/documents/${documentId}/suggestions/stats`
  );
}

export async function createSuggestion(
  documentId: string,
  userId: string,
  data: CreateSuggestionData
): Promise<Suggestion> {
  const response = await apiCall<SuggestionApiResponse>(
    `/api/documents/${documentId}/suggestions?user_id=${userId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suggestion_id: data.suggestionId,
        suggestion_type: data.suggestionType,
        original_text: data.originalText,
        suggested_text: data.suggestedText,
        anchor_from: data.anchorFrom,
        anchor_to: data.anchorTo,
        author_name: data.authorName,
        author_color: data.authorColor,
      }),
    }
  );
  return transformSuggestion(response);
}

export async function acceptSuggestion(
  documentId: string,
  suggestionId: string,
  userId: string,
  note?: string
): Promise<Suggestion> {
  const response = await apiCall<SuggestionApiResponse>(
    `/api/documents/${documentId}/suggestions/${suggestionId}/accept?user_id=${userId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    }
  );
  return transformSuggestion(response);
}

export async function rejectSuggestion(
  documentId: string,
  suggestionId: string,
  userId: string,
  note?: string
): Promise<Suggestion> {
  const response = await apiCall<SuggestionApiResponse>(
    `/api/documents/${documentId}/suggestions/${suggestionId}/reject?user_id=${userId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    }
  );
  return transformSuggestion(response);
}

export async function acceptAllSuggestions(
  documentId: string,
  userId: string
): Promise<{ acceptedCount: number }> {
  const response = await apiCall<{ success: boolean; accepted_count: number }>(
    `/api/documents/${documentId}/suggestions/accept-all?user_id=${userId}`,
    { method: "POST" }
  );
  return { acceptedCount: response.accepted_count };
}

export async function rejectAllSuggestions(
  documentId: string,
  userId: string
): Promise<{ rejectedCount: number }> {
  const response = await apiCall<{ success: boolean; rejected_count: number }>(
    `/api/documents/${documentId}/suggestions/reject-all?user_id=${userId}`,
    { method: "POST" }
  );
  return { rejectedCount: response.rejected_count };
}

export async function deleteSuggestion(
  documentId: string,
  suggestionId: string
): Promise<void> {
  await apiCall<{ success: boolean }>(
    `/api/documents/${documentId}/suggestions/${suggestionId}`,
    { method: "DELETE" }
  );
}

// ============================================================================
// Folder Tree API
// ============================================================================

export interface FolderTreeNode {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  depth: number;
  icon: string;
  color: string | null;
  documentCount: number;
  isExpanded: boolean;
  children: FolderTreeNode[];
}

interface FolderTreeApiResponse {
  id: string;
  name: string;
  parent_id: string | null;
  path: string;
  depth: number;
  icon: string;
  color: string | null;
  document_count: number;
  is_expanded: boolean;
  children: FolderTreeApiResponse[];
}

function transformFolderTree(data: FolderTreeApiResponse): FolderTreeNode {
  return {
    id: data.id,
    name: data.name,
    parentId: data.parent_id,
    path: data.path,
    depth: data.depth,
    icon: data.icon,
    color: data.color,
    documentCount: data.document_count,
    isExpanded: data.is_expanded,
    children: data.children?.map(transformFolderTree) || [],
  };
}

export async function fetchFolderTree(
  workspaceId: string,
  parentId?: string
): Promise<FolderTreeNode[]> {
  const params = new URLSearchParams();
  if (parentId) params.set("parent_id", parentId);
  const queryString = params.toString();
  const url = `/api/documents/folders/tree/${workspaceId}${queryString ? `?${queryString}` : ""}`;

  const data = await apiCall<FolderTreeApiResponse[]>(url);
  return data.map(transformFolderTree);
}

export async function moveFolder(
  folderId: string,
  newParentId: string | null,
  newSortOrder?: number
): Promise<void> {
  await apiCall<{ success: boolean }>("/api/documents/folders/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      folder_id: folderId,
      new_parent_id: newParentId,
      new_sort_order: newSortOrder,
    }),
  });
}

export async function reorderFolders(
  updates: Array<{ id: string; sort_order?: number; parent_id?: string }>
): Promise<void> {
  await apiCall<{ success: boolean }>("/api/documents/folders/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
  });
}

// ============================================================================
// Workspace Roles & Permissions API
// ============================================================================

export interface WorkspaceRole {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  permissions: Record<string, Record<string, boolean>>;
  isSystem: boolean;
  createdAt: Date;
}

interface WorkspaceRoleApiResponse {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  permissions: Record<string, Record<string, boolean>>;
  is_system: boolean;
  created_at: string;
}

function transformWorkspaceRole(data: WorkspaceRoleApiResponse): WorkspaceRole {
  return {
    id: data.id,
    workspaceId: data.workspace_id,
    name: data.name,
    description: data.description,
    permissions: data.permissions,
    isSystem: data.is_system,
    createdAt: new Date(data.created_at),
  };
}

export async function fetchWorkspaceRoles(workspaceId: string): Promise<WorkspaceRole[]> {
  const data = await apiCall<WorkspaceRoleApiResponse[]>(
    `/api/documents/workspaces/${workspaceId}/roles`
  );
  return data.map(transformWorkspaceRole);
}

export async function createWorkspaceRole(
  workspaceId: string,
  data: {
    name: string;
    description?: string;
    permissions: Record<string, Record<string, boolean>>;
  }
): Promise<WorkspaceRole> {
  const response = await apiCall<WorkspaceRoleApiResponse>(
    `/api/documents/workspaces/${workspaceId}/roles`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  return transformWorkspaceRole(response);
}

export async function updateWorkspaceRole(
  workspaceId: string,
  roleId: string,
  data: {
    name?: string;
    description?: string;
    permissions?: Record<string, Record<string, boolean>>;
  }
): Promise<WorkspaceRole> {
  const response = await apiCall<WorkspaceRoleApiResponse>(
    `/api/documents/workspaces/${workspaceId}/roles/${roleId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  return transformWorkspaceRole(response);
}

export async function deleteWorkspaceRole(
  workspaceId: string,
  roleId: string
): Promise<void> {
  await apiCall<{ success: boolean }>(
    `/api/documents/workspaces/${workspaceId}/roles/${roleId}`,
    { method: "DELETE" }
  );
}

export interface WorkspaceMemberWithRole {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  roleName: string | null;
  rolePermissions: Record<string, Record<string, boolean>> | null;
  userName: string | null;
  userEmail: string | null;
  createdAt: Date;
}

export async function fetchWorkspaceMembers(
  workspaceId: string
): Promise<WorkspaceMemberWithRole[]> {
  const data = await apiCall<Array<{
    id: string;
    workspace_id: string;
    user_id: string;
    role: string;
    role_name: string | null;
    role_permissions: Record<string, Record<string, boolean>> | null;
    user_name: string | null;
    user_email: string | null;
    created_at: string;
  }>>(`/api/documents/workspaces/${workspaceId}/members`);

  return data.map(m => ({
    id: m.id,
    workspaceId: m.workspace_id,
    userId: m.user_id,
    role: m.role,
    roleName: m.role_name,
    rolePermissions: m.role_permissions,
    userName: m.user_name,
    userEmail: m.user_email,
    createdAt: new Date(m.created_at),
  }));
}

export async function assignRoleToMember(
  workspaceId: string,
  userId: string,
  roleId: string
): Promise<void> {
  await apiCall<{ success: boolean }>(
    `/api/documents/workspaces/${workspaceId}/members/assign-role`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role_id: roleId }),
    }
  );
}

export async function checkPermission(
  workspaceId: string,
  userId: string,
  resource: string,
  action: string
): Promise<boolean> {
  const response = await apiCall<{ allowed: boolean }>(
    `/api/documents/workspaces/${workspaceId}/check-permission?user_id=${userId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource, action }),
    }
  );
  return response.allowed;
}

// ============================================================================
// Document Analytics API
// ============================================================================

export interface DocumentAnalytics {
  documentId: string;
  totalViews: number;
  uniqueViewers: number;
  avgTimeSpentSeconds: number;
  totalEdits: number;
  totalComments: number;
  totalShares: number;
  viewsByDay: Array<{ date: string; views: number }>;
  topViewers: Array<{ userId: string; name: string; views: number }>;
  periodDays: number;
}

interface DocumentAnalyticsApiResponse {
  document_id: string;
  total_views: number;
  unique_viewers: number;
  avg_time_spent_seconds: number;
  total_edits: number;
  total_comments: number;
  total_shares: number;
  views_by_day: Array<{ date: string; views: number }>;
  top_viewers: Array<{ user_id: string; name: string; views: number }>;
  period_days: number;
}

export async function fetchDocumentAnalytics(
  documentId: string,
  days = 30
): Promise<DocumentAnalytics> {
  const data = await apiCall<DocumentAnalyticsApiResponse>(
    `/api/documents/analytics/${documentId}?days=${days}`
  );
  return {
    documentId: data.document_id,
    totalViews: data.total_views,
    uniqueViewers: data.unique_viewers,
    avgTimeSpentSeconds: data.avg_time_spent_seconds,
    totalEdits: data.total_edits,
    totalComments: data.total_comments,
    totalShares: data.total_shares,
    viewsByDay: data.views_by_day,
    topViewers: data.top_viewers.map(v => ({
      userId: v.user_id,
      name: v.name,
      views: v.views,
    })),
    periodDays: data.period_days,
  };
}

export async function trackDocumentView(
  documentId: string,
  userId: string,
  data?: {
    sessionId?: string;
    timeSpentSeconds?: number;
    scrollDepth?: number;
    deviceType?: string;
    referrer?: string;
  }
): Promise<void> {
  await apiCall<{ success: boolean }>(
    `/api/documents/analytics/track-view?user_id=${userId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_id: documentId,
        session_id: data?.sessionId,
        time_spent_seconds: data?.timeSpentSeconds || 0,
        scroll_depth: data?.scrollDepth || 0,
        device_type: data?.deviceType,
        referrer: data?.referrer,
      }),
    }
  );
}

export interface WorkspaceAnalytics {
  workspaceId: string;
  totalDocuments: number;
  documentsCreated: number;
  documentsUpdated: number;
  totalViews: number;
  uniqueUsers: number;
  storageUsedBytes: number;
  mostViewedDocuments: Array<{ id: string; title: string; views: number }>;
  mostActiveUsers: Array<{ userId: string; name: string; actions: number }>;
  periodDays: number;
}

export async function fetchWorkspaceAnalytics(
  workspaceId: string,
  days = 30
): Promise<WorkspaceAnalytics> {
  const data = await apiCall<{
    workspace_id: string;
    total_documents: number;
    documents_created: number;
    documents_updated: number;
    total_views: number;
    unique_users: number;
    storage_used_bytes: number;
    most_viewed_documents: Array<{ id: string; title: string; views: number }>;
    most_active_users: Array<{ user_id: string; name: string; actions: number }>;
    period_days: number;
  }>(`/api/documents/analytics/workspace/${workspaceId}?days=${days}`);

  return {
    workspaceId: data.workspace_id,
    totalDocuments: data.total_documents,
    documentsCreated: data.documents_created,
    documentsUpdated: data.documents_updated,
    totalViews: data.total_views,
    uniqueUsers: data.unique_users,
    storageUsedBytes: data.storage_used_bytes,
    mostViewedDocuments: data.most_viewed_documents,
    mostActiveUsers: data.most_active_users.map(u => ({
      userId: u.user_id,
      name: u.name,
      actions: u.actions,
    })),
    periodDays: data.period_days,
  };
}

// ============================================================================
// Document Notifications API
// ============================================================================

export interface DocumentNotification {
  id: string;
  userId: string;
  documentId: string | null;
  workspaceId: string | null;
  notificationType: string;
  title: string;
  message: string | null;
  metadata: Record<string, unknown>;
  isRead: boolean;
  readAt: Date | null;
  actionUrl: string | null;
  actorId: string | null;
  actorName: string | null;
  createdAt: Date;
}

interface DocumentNotificationApiResponse {
  id: string;
  user_id: string;
  document_id: string | null;
  workspace_id: string | null;
  notification_type: string;
  title: string;
  message: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  action_url: string | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

function transformNotification(data: DocumentNotificationApiResponse): DocumentNotification {
  return {
    id: data.id,
    userId: data.user_id,
    documentId: data.document_id,
    workspaceId: data.workspace_id,
    notificationType: data.notification_type,
    title: data.title,
    message: data.message,
    metadata: data.metadata,
    isRead: data.is_read,
    readAt: data.read_at ? new Date(data.read_at) : null,
    actionUrl: data.action_url,
    actorId: data.actor_id,
    actorName: data.actor_name,
    createdAt: new Date(data.created_at),
  };
}

export async function fetchDocumentNotifications(
  userId: string,
  options?: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<DocumentNotification[]> {
  const params = new URLSearchParams({ user_id: userId });
  if (options?.unreadOnly) params.set("unread_only", "true");
  if (options?.limit) params.set("limit", options.limit.toString());
  if (options?.offset) params.set("offset", options.offset.toString());

  const data = await apiCall<DocumentNotificationApiResponse[]>(
    `/api/documents/notifications?${params.toString()}`
  );
  return data.map(transformNotification);
}

export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const response = await apiCall<{ count: number }>(
    `/api/documents/notifications/count?user_id=${userId}`
  );
  return response.count;
}

export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<void> {
  await apiCall<{ success: boolean }>(
    `/api/documents/notifications/${notificationId}/read?user_id=${userId}`,
    { method: "POST" }
  );
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const response = await apiCall<{ success: boolean; count: number }>(
    `/api/documents/notifications/read-all?user_id=${userId}`,
    { method: "POST" }
  );
  return response.count;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  notifyOnShare: boolean;
  notifyOnComment: boolean;
  notifyOnMention: boolean;
  notifyOnSuggestion: boolean;
  notifyOnDocumentUpdate: boolean;
  digestFrequency: "instant" | "daily" | "weekly";
  digestTime: string | null;
}

export async function fetchNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const data = await apiCall<{
    id: string;
    user_id: string;
    email_enabled: boolean;
    push_enabled: boolean;
    in_app_enabled: boolean;
    notify_on_share: boolean;
    notify_on_comment: boolean;
    notify_on_mention: boolean;
    notify_on_suggestion: boolean;
    notify_on_document_update: boolean;
    digest_frequency: "instant" | "daily" | "weekly";
    digest_time: string | null;
  }>(`/api/documents/notifications/preferences?user_id=${userId}`);

  return {
    id: data.id,
    userId: data.user_id,
    emailEnabled: data.email_enabled,
    pushEnabled: data.push_enabled,
    inAppEnabled: data.in_app_enabled,
    notifyOnShare: data.notify_on_share,
    notifyOnComment: data.notify_on_comment,
    notifyOnMention: data.notify_on_mention,
    notifyOnSuggestion: data.notify_on_suggestion,
    notifyOnDocumentUpdate: data.notify_on_document_update,
    digestFrequency: data.digest_frequency,
    digestTime: data.digest_time,
  };
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<Omit<NotificationPreferences, "id" | "userId">>
): Promise<NotificationPreferences> {
  const data = await apiCall<{
    id: string;
    user_id: string;
    email_enabled: boolean;
    push_enabled: boolean;
    in_app_enabled: boolean;
    notify_on_share: boolean;
    notify_on_comment: boolean;
    notify_on_mention: boolean;
    notify_on_suggestion: boolean;
    notify_on_document_update: boolean;
    digest_frequency: "instant" | "daily" | "weekly";
    digest_time: string | null;
  }>(`/api/documents/notifications/preferences?user_id=${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email_enabled: preferences.emailEnabled,
      push_enabled: preferences.pushEnabled,
      in_app_enabled: preferences.inAppEnabled,
      notify_on_share: preferences.notifyOnShare,
      notify_on_comment: preferences.notifyOnComment,
      notify_on_mention: preferences.notifyOnMention,
      notify_on_suggestion: preferences.notifyOnSuggestion,
      notify_on_document_update: preferences.notifyOnDocumentUpdate,
      digest_frequency: preferences.digestFrequency,
      digest_time: preferences.digestTime,
    }),
  });

  return {
    id: data.id,
    userId: data.user_id,
    emailEnabled: data.email_enabled,
    pushEnabled: data.push_enabled,
    inAppEnabled: data.in_app_enabled,
    notifyOnShare: data.notify_on_share,
    notifyOnComment: data.notify_on_comment,
    notifyOnMention: data.notify_on_mention,
    notifyOnSuggestion: data.notify_on_suggestion,
    notifyOnDocumentUpdate: data.notify_on_document_update,
    digestFrequency: data.digest_frequency,
    digestTime: data.digest_time,
  };
}

// ============================================================================
// Document Import API
// ============================================================================

export interface ImportResult {
  success: boolean;
  importId: string;
  documentId?: string;
  title: string;
  extractedTextLength: number;
  pageCount?: number;
  imagesCount?: number;
  tablesCount?: number;
}

export async function importPdf(
  file: File,
  userId: string,
  options?: {
    workspaceId?: string;
    folderId?: string;
    createDocument?: boolean;
  }
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);

  const params = new URLSearchParams({ user_id: userId });
  if (options?.workspaceId) params.set("workspace_id", options.workspaceId);
  if (options?.folderId) params.set("folder_id", options.folderId);
  if (options?.createDocument !== undefined) {
    params.set("create_document", options.createDocument.toString());
  }

  const response = await fetch(`/api/documents/import/pdf?${params.toString()}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new DocumentsApiError(
      error.detail || "PDF import failed",
      response.status,
      error
    );
  }

  const data = await response.json();
  return {
    success: data.success,
    importId: data.import_id,
    documentId: data.document_id,
    title: data.title,
    extractedTextLength: data.extracted_text_length,
    pageCount: data.page_count,
    imagesCount: data.images_count,
  };
}

export async function importDocx(
  file: File,
  userId: string,
  options?: {
    workspaceId?: string;
    folderId?: string;
    createDocument?: boolean;
  }
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);

  const params = new URLSearchParams({ user_id: userId });
  if (options?.workspaceId) params.set("workspace_id", options.workspaceId);
  if (options?.folderId) params.set("folder_id", options.folderId);
  if (options?.createDocument !== undefined) {
    params.set("create_document", options.createDocument.toString());
  }

  const response = await fetch(`/api/documents/import/docx?${params.toString()}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new DocumentsApiError(
      error.detail || "DOCX import failed",
      response.status,
      error
    );
  }

  const data = await response.json();
  return {
    success: data.success,
    importId: data.import_id,
    documentId: data.document_id,
    title: data.title,
    extractedTextLength: data.extracted_text_length,
    imagesCount: data.images_count,
    tablesCount: data.tables_count,
  };
}

export async function importMarkdown(
  content: string,
  filename: string,
  userId: string,
  options?: {
    workspaceId?: string;
    folderId?: string;
    createDocument?: boolean;
  }
): Promise<ImportResult> {
  const data = await apiCall<{
    success: boolean;
    import_id: string;
    document_id?: string;
    title: string;
    extracted_text_length: number;
  }>(`/api/documents/import/markdown?user_id=${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content,
      filename,
      workspace_id: options?.workspaceId,
      folder_id: options?.folderId,
      create_document: options?.createDocument ?? true,
    }),
  });

  return {
    success: data.success,
    importId: data.import_id,
    documentId: data.document_id,
    title: data.title,
    extractedTextLength: data.extracted_text_length,
  };
}

// ============================================================================
// DOCX Export/Import Functions
// ============================================================================

/**
 * Export a document as DOCX format
 */
export async function exportAsDocx(
  documentId: string,
  userId: string,
  filename?: string
): Promise<void> {
  const response = await fetch(
    `/api/documents/${documentId}/export/docx?user_id=${encodeURIComponent(userId)}`,
    { method: "GET" }
  );

  if (!response.ok) {
    throw new Error(`Failed to export document as DOCX: ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename || "document"}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import a DOCX file as a new document
 */
export async function importDocxAsDocument(
  file: File,
  userId: string,
  options?: {
    workspaceId?: string;
    folderId?: string;
  }
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  if (options?.workspaceId) {
    formData.append("workspace_id", options.workspaceId);
  }
  if (options?.folderId) {
    formData.append("folder_id", options.folderId);
  }

  const response = await fetch(
    `/api/documents/import/docx?user_id=${encodeURIComponent(userId)}`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to import DOCX: ${response.status}`);
  }

  const data = await response.json();

  return {
    success: data.success,
    importId: data.import_id,
    documentId: data.document_id,
    title: data.title,
    extractedTextLength: data.extracted_text_length || 0,
  };
}

/**
 * Convert a TipTap document to Office format (for OnlyOffice editing)
 */
export async function convertToOffice(
  documentId: string,
  userId: string,
  format: string = "docx"
): Promise<{ success: boolean; officeFileUrl?: string }> {
  const data = await apiCall<{
    success: boolean;
    office_file_url?: string;
  }>(`/api/documents/${documentId}/convert/office?user_id=${encodeURIComponent(userId)}&format=${format}`, {
    method: "POST",
  });

  return {
    success: data.success,
    officeFileUrl: data.office_file_url,
  };
}

/**
 * Convert an Office document back to TipTap format
 */
export async function convertToTipTap(
  documentId: string,
  userId: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  const data = await apiCall<{
    success: boolean;
    content?: string;
    error?: string;
  }>(`/api/documents/${documentId}/convert/tiptap?user_id=${encodeURIComponent(userId)}`, {
    method: "POST",
  });

  return {
    success: data.success,
    content: data.content,
    error: data.error,
  };
}

// ============================================================================
// Office File Upload
// ============================================================================

export interface OfficeUploadResult {
  success: boolean;
  documentId?: string;
  fileUrl?: string;
  error?: string;
}

/**
 * Upload an Office file (docx, xlsx, pptx) to a document
 */
export async function uploadOfficeFile(
  documentId: string,
  file: File,
  userId: string,
  source: string = "user_upload"
): Promise<OfficeUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("source", source);

  const response = await fetch(
    `/api/documents/${documentId}/upload/office?user_id=${encodeURIComponent(userId)}`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    return {
      success: false,
      error: `Upload failed: ${response.status}`,
    };
  }

  const data = await response.json();

  return {
    success: data.success,
    documentId: data.document_id,
    fileUrl: data.file_url,
    error: data.error,
  };
}

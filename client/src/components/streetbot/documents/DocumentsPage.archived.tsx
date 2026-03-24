import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import "@/styles/glassmorphism.css";
import {
  Search,
  Plus,
  MoreHorizontal,
  Grid3X3,
  List,
  FileText,
  File,
  FileSpreadsheet,
  FileImage,
  FolderOpen,
  Folder,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Clock,
  Star,
  StarOff,
  Trash2,
  Share2,
  Download,
  Edit3,
  Copy,
  Move,
  Eye,
  X,
  Check,
  Loader2,
  Upload,
  SortAsc,
  SortDesc,
  Filter,
  Users,
  Lock,
  History,
  MessageSquare,
  Tag,
  Archive,
  RotateCcw,
  ChevronLeft,
  Home,
  Presentation,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { useGlassStyles, GlassBackground } from "@/hooks/useGlassStyles";
import { sbFetch, sbGet, sbPost, sbPatch, sbDelete } from "@/shared/sbFetch";
import { useAuthContext } from "~/hooks/AuthContext";
import { getOrCreateUserId } from "@/shared/userId";

// ============================================================================
// Types
// ============================================================================

interface DocumentItem {
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

interface DocumentDetail extends DocumentItem {
  content: Record<string, unknown>;
  content_text: string;
  metadata: Record<string, unknown>;
  last_edited_by?: string;
  published_at?: string;
}

interface FolderItem {
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

interface WorkspaceItem {
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

interface TemplateItem {
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

interface VersionItem {
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

interface ShareItem {
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

interface CommentItem {
  id: string;
  document_id: string;
  parent_id?: string;
  user_id?: string;
  content: string;
  anchor_type: string;
  is_resolved: boolean;
  reply_count: number;
  created_at: string;
  updated_at: string;
}

type ViewMode = "grid" | "list";
type SortField = "updated_at" | "created_at" | "title" | "word_count";
type SortDir = "asc" | "desc";
type SidebarSection = "all" | "recent" | "favorites" | "shared" | "trash" | "folder";

// ============================================================================
// Helpers
// ============================================================================

function getDocIcon(docType: string): React.ReactNode {
  switch (docType) {
    case "spreadsheet":
    case "xlsx":
      return <FileSpreadsheet size={20} />;
    case "presentation":
    case "pptx":
      return <Presentation size={20} />;
    case "image":
      return <FileImage size={20} />;
    default:
      return <FileText size={20} />;
  }
}

function getDocTypeColor(docType: string): string {
  switch (docType) {
    case "spreadsheet":
    case "xlsx":
      return "#22c55e";
    case "presentation":
    case "pptx":
      return "#f59e0b";
    case "image":
      return "#ec4899";
    default:
      return "#3b82f6";
  }
}

function statusBadgeColor(status: string): { bg: string; text: string } {
  switch (status) {
    case "published":
      return { bg: "rgba(34, 197, 94, 0.15)", text: "#22c55e" };
    case "review":
      return { bg: "rgba(245, 158, 11, 0.15)", text: "#f59e0b" };
    case "approved":
      return { bg: "rgba(59, 130, 246, 0.15)", text: "#3b82f6" };
    case "archived":
      return { bg: "rgba(107, 114, 128, 0.15)", text: "#6b7280" };
    default:
      return { bg: "rgba(139, 92, 246, 0.15)", text: "#8b5cf6" };
  }
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  return date.toLocaleDateString();
}

function truncate(str: string, len: number): string {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "..." : str;
}

// ============================================================================
// DocumentsPage Component
// ============================================================================

export function DocumentsPage() {
  const { isDark, colors, glassCard, glassSurface, glassButton, glassInput, accentButton, glassTag, gradientOrbs, cardHoverHandlers, buttonHoverHandlers, accentButtonHoverHandlers } = useGlassStyles();
  const { user: authUser } = useAuthContext();
  const userId = getOrCreateUserId(authUser?.id);

  // ------ State ------
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarSection, setSidebarSection] = useState<SidebarSection>("all");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Multi-select
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showVersionsPanel, setShowVersionsPanel] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Active document context
  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(null);
  const [activeDocDetail, setActiveDocDetail] = useState<DocumentDetail | null>(null);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; doc: DocumentItem } | null>(null);

  // Create form
  const [newDocTitle, setNewDocTitle] = useState("Untitled Document");
  const [newDocType, setNewDocType] = useState("general");
  const [newFolderName, setNewFolderName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState("view");
  const [moveFolderId, setMoveFolderId] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState("pdf");

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ------ API Helpers ------
  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = { user_id: userId };
      if (selectedWorkspaceId) params.workspace_id = selectedWorkspaceId;
      if (selectedFolderId) params.folder_id = selectedFolderId;

      let data: { documents: DocumentItem[]; total: number };
      if (searchQuery.trim()) {
        params.q = searchQuery.trim();
        data = await sbGet<{ documents: DocumentItem[]; total: number }>("/api/documents/search", params);
      } else if (sidebarSection === "recent") {
        const docs = await sbGet<DocumentItem[]>("/api/documents/recent", { user_id: userId, limit: "20" });
        data = { documents: docs, total: docs.length };
      } else if (sidebarSection === "favorites") {
        const docs = await sbGet<DocumentItem[]>("/api/documents/favorites", { user_id: userId });
        data = { documents: docs, total: docs.length };
      } else if (sidebarSection === "trash") {
        data = await sbGet<{ documents: DocumentItem[]; total: number }>("/api/documents/trash", { user_id: userId });
      } else {
        data = await sbGet<{ documents: DocumentItem[]; total: number }>("/api/documents", params);
      }
      setDocuments(data.documents || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load documents";
      setError(msg);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [userId, selectedWorkspaceId, selectedFolderId, searchQuery, sidebarSection]);

  const fetchFolders = useCallback(async () => {
    if (!selectedWorkspaceId) return;
    try {
      const data = await sbGet<FolderItem[]>(`/api/document-workspaces/${selectedWorkspaceId}/folders`);
      setFolders(data || []);
    } catch {
      setFolders([]);
    }
  }, [selectedWorkspaceId]);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const data = await sbGet<WorkspaceItem[]>("/api/document-workspaces", { user_id: userId });
      setWorkspaces(data || []);
      if (data && data.length > 0 && !selectedWorkspaceId) {
        const defaultWs = data.find((w: WorkspaceItem) => w.is_default) || data[0];
        setSelectedWorkspaceId(defaultWs.id);
      }
    } catch {
      setWorkspaces([]);
    }
  }, [userId, selectedWorkspaceId]);

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await sbGet<TemplateItem[]>("/api/document-templates");
      setTemplates(data || []);
    } catch {
      setTemplates([]);
    }
  }, []);

  // ------ Effects ------
  useEffect(() => {
    fetchWorkspaces();
    fetchTemplates();
  }, [fetchWorkspaces, fetchTemplates]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if (selectedWorkspaceId) fetchFolders();
  }, [selectedWorkspaceId, fetchFolders]);

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => setContextMenu(null);
    if (contextMenu) window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu]);

  // ------ Sorted & Filtered Docs ------
  const sortedDocuments = useMemo(() => {
    const sorted = [...documents].sort((a, b) => {
      let cmp = 0;
      if (sortField === "title") {
        cmp = a.title.localeCompare(b.title);
      } else if (sortField === "word_count") {
        cmp = a.word_count - b.word_count;
      } else if (sortField === "created_at") {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [documents, sortField, sortDir]);

  // ------ Actions ------
  const handleCreateDocument = useCallback(async () => {
    try {
      const body: Record<string, unknown> = {
        title: newDocTitle || "Untitled Document",
        document_type: newDocType,
      };
      if (selectedWorkspaceId) body.workspace_id = selectedWorkspaceId;
      if (selectedFolderId) body.folder_id = selectedFolderId;

      await sbPost("/api/documents?user_id=" + encodeURIComponent(userId), body);
      setShowCreateModal(false);
      setNewDocTitle("Untitled Document");
      setNewDocType("general");
      fetchDocuments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create document";
      setError(msg);
    }
  }, [newDocTitle, newDocType, selectedWorkspaceId, selectedFolderId, userId, fetchDocuments]);

  const handleCreateFromTemplate = useCallback(async (templateId: string) => {
    try {
      const body: Record<string, unknown> = { template_id: templateId };
      if (selectedWorkspaceId) body.workspace_id = selectedWorkspaceId;
      if (selectedFolderId) body.folder_id = selectedFolderId;

      await sbPost("/api/documents/from-template?user_id=" + encodeURIComponent(userId), body);
      setShowTemplateModal(false);
      fetchDocuments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create from template";
      setError(msg);
    }
  }, [selectedWorkspaceId, selectedFolderId, userId, fetchDocuments]);

  const handleDeleteDocument = useCallback(async (doc: DocumentItem) => {
    try {
      await sbDelete(`/api/documents/${doc.id}?user_id=${encodeURIComponent(userId)}`);
      setShowDeleteConfirm(false);
      setActiveDoc(null);
      fetchDocuments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete document";
      setError(msg);
    }
  }, [userId, fetchDocuments]);

  const handleRestoreDocument = useCallback(async (doc: DocumentItem) => {
    try {
      await sbPost(`/api/documents/${doc.id}/restore?user_id=${encodeURIComponent(userId)}`);
      fetchDocuments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to restore document";
      setError(msg);
    }
  }, [userId, fetchDocuments]);

  const handleToggleFavorite = useCallback(async (doc: DocumentItem) => {
    try {
      if (doc.is_favorite) {
        await sbDelete(`/api/documents/${doc.id}/favorite?user_id=${encodeURIComponent(userId)}`);
      } else {
        await sbPost(`/api/documents/${doc.id}/favorite?user_id=${encodeURIComponent(userId)}`);
      }
      fetchDocuments();
    } catch {
      // silent
    }
  }, [userId, fetchDocuments]);

  const handleRename = useCallback(async () => {
    if (!activeDoc || !renameValue.trim()) return;
    try {
      await sbPatch(`/api/documents/${activeDoc.id}?user_id=${encodeURIComponent(userId)}`, { title: renameValue.trim() });
      setShowRenameModal(false);
      setRenameValue("");
      fetchDocuments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to rename";
      setError(msg);
    }
  }, [activeDoc, renameValue, userId, fetchDocuments]);

  const handleMove = useCallback(async () => {
    if (!activeDoc) return;
    try {
      await sbPatch(`/api/documents/${activeDoc.id}?user_id=${encodeURIComponent(userId)}`, { folder_id: moveFolderId });
      setShowMoveModal(false);
      setMoveFolderId(null);
      fetchDocuments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to move";
      setError(msg);
    }
  }, [activeDoc, moveFolderId, userId, fetchDocuments]);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim() || !selectedWorkspaceId) return;
    try {
      await sbPost(`/api/document-workspaces/${selectedWorkspaceId}/folders?user_id=${encodeURIComponent(userId)}`, {
        workspace_id: selectedWorkspaceId,
        name: newFolderName.trim(),
      });
      setShowCreateFolder(false);
      setNewFolderName("");
      fetchFolders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create folder";
      setError(msg);
    }
  }, [newFolderName, selectedWorkspaceId, userId, fetchFolders]);

  const handleShare = useCallback(async () => {
    if (!activeDoc || !shareEmail.trim()) return;
    try {
      await sbPost(`/api/documents/${activeDoc.id}/shares?user_id=${encodeURIComponent(userId)}`, {
        email: shareEmail.trim(),
        permission: sharePermission,
        is_external: true,
      });
      setShareEmail("");
      // Refresh shares
      const data = await sbGet<ShareItem[]>(`/api/documents/${activeDoc.id}/shares`);
      setShares(data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to share";
      setError(msg);
    }
  }, [activeDoc, shareEmail, sharePermission, userId]);

  const handleRemoveShare = useCallback(async (shareId: string) => {
    if (!activeDoc) return;
    try {
      await sbDelete(`/api/documents/${activeDoc.id}/shares/${shareId}?user_id=${encodeURIComponent(userId)}`);
      const data = await sbGet<ShareItem[]>(`/api/documents/${activeDoc.id}/shares`);
      setShares(data || []);
    } catch {
      // silent
    }
  }, [activeDoc, userId]);

  const handleExport = useCallback(async () => {
    if (!activeDoc) return;
    try {
      const res = await sbFetch(`/api/documents/${activeDoc.id}/export?user_id=${encodeURIComponent(userId)}`, {
        method: "POST",
        body: JSON.stringify({ format: exportFormat, include_metadata: true }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const extMap: Record<string, string> = { pdf: ".pdf", docx: ".docx", markdown: ".md", html: ".html" };
      a.download = `${activeDoc.title}${extMap[exportFormat] || ""}`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExportModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Export failed";
      setError(msg);
    }
  }, [activeDoc, exportFormat, userId]);

  const openDocument = useCallback(async (doc: DocumentItem) => {
    try {
      const detail = await sbGet<DocumentDetail>(`/api/documents/${doc.id}?user_id=${encodeURIComponent(userId)}`);
      setActiveDocDetail(detail);
      setActiveDoc(doc);
      setShowEditorModal(true);
    } catch {
      setActiveDoc(doc);
      setShowEditorModal(true);
    }
  }, [userId]);

  const openVersions = useCallback(async (doc: DocumentItem) => {
    setActiveDoc(doc);
    try {
      const data = await sbGet<{ versions: VersionItem[] }>(`/api/documents/${doc.id}/versions`);
      setVersions(data.versions || []);
    } catch {
      setVersions([]);
    }
    setShowVersionsPanel(true);
  }, []);

  const openShareModal = useCallback(async (doc: DocumentItem) => {
    setActiveDoc(doc);
    try {
      const data = await sbGet<ShareItem[]>(`/api/documents/${doc.id}/shares`);
      setShares(data || []);
    } catch {
      setShares([]);
    }
    setShowShareModal(true);
  }, []);

  const handleBulkDelete = useCallback(async () => {
    for (const docId of selectedDocIds) {
      try {
        await sbDelete(`/api/documents/${docId}?user_id=${encodeURIComponent(userId)}`);
      } catch {
        // continue
      }
    }
    setSelectedDocIds(new Set());
    fetchDocuments();
  }, [selectedDocIds, userId, fetchDocuments]);

  const toggleDocSelection = useCallback((docId: string) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }, []);

  const selectAllDocs = useCallback(() => {
    if (selectedDocIds.size === sortedDocuments.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(sortedDocuments.map(d => d.id)));
    }
  }, [selectedDocIds, sortedDocuments]);

  const handleContextMenu = useCallback((e: React.MouseEvent, doc: DocumentItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, doc });
  }, []);

  // Keyboard shortcut: Cmd+K for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ------ Breadcrumbs ------
  const breadcrumbs = useMemo(() => {
    const items: { label: string; onClick?: () => void }[] = [
      { label: "Documents", onClick: () => { setSelectedFolderId(null); setSidebarSection("all"); } },
    ];
    if (selectedFolderId) {
      const folder = folders.find(f => f.id === selectedFolderId);
      if (folder) items.push({ label: folder.name });
    }
    return items;
  }, [selectedFolderId, folders]);

  // ------ Folder tree ------
  const rootFolders = useMemo(() => folders.filter(f => !f.parent_id), [folders]);
  const childFoldersOf = useCallback((parentId: string) => folders.filter(f => f.parent_id === parentId), [folders]);

  // ============================================================================
  // Render helpers
  // ============================================================================

  const renderSidebarItem = (
    label: string,
    icon: React.ReactNode,
    section: SidebarSection,
    count?: number,
  ) => {
    const isActive = sidebarSection === section && !selectedFolderId;
    return (
      <button
        key={section}
        onClick={() => { setSidebarSection(section); setSelectedFolderId(null); }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "10px 14px",
          borderRadius: 12,
          border: "none",
          background: isActive ? colors.surfaceActive : "transparent",
          color: isActive ? colors.text : colors.textSecondary,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: isActive ? 600 : 400,
          fontFamily: "Rubik, sans-serif",
          transition: "all 0.15s ease",
          textAlign: "left",
        }}
        onMouseEnter={e => {
          if (!isActive) e.currentTarget.style.background = colors.surfaceHover;
        }}
        onMouseLeave={e => {
          if (!isActive) e.currentTarget.style.background = "transparent";
        }}
      >
        {icon}
        {!sidebarCollapsed && (
          <>
            <span style={{ flex: 1 }}>{label}</span>
            {count !== undefined && (
              <span style={{ fontSize: 11, color: colors.textMuted, background: colors.surface, borderRadius: 8, padding: "2px 8px" }}>
                {count}
              </span>
            )}
          </>
        )}
      </button>
    );
  };

  const renderFolderTreeItem = (folder: FolderItem, depth: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const children = childFoldersOf(folder.id);

    return (
      <div key={folder.id}>
        <button
          onClick={() => {
            setSelectedFolderId(folder.id);
            setSidebarSection("folder");
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "8px 14px",
            paddingLeft: 14 + depth * 16,
            borderRadius: 10,
            border: "none",
            background: isSelected ? colors.surfaceActive : "transparent",
            color: isSelected ? colors.text : colors.textSecondary,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: isSelected ? 600 : 400,
            fontFamily: "Rubik, sans-serif",
            transition: "all 0.15s ease",
            textAlign: "left",
          }}
          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = colors.surfaceHover; }}
          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
        >
          {children.length > 0 && (
            <span
              onClick={e => {
                e.stopPropagation();
                setExpandedFolders(prev => {
                  const next = new Set(prev);
                  if (next.has(folder.id)) next.delete(folder.id);
                  else next.add(folder.id);
                  return next;
                });
              }}
              style={{ display: "flex", alignItems: "center" }}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}
          {isExpanded ? <FolderOpen size={16} style={{ color: folder.color || colors.accent }} /> : <Folder size={16} style={{ color: folder.color || colors.accent }} />}
          {!sidebarCollapsed && (
            <>
              <span style={{ flex: 1 }}>{truncate(folder.name, 20)}</span>
              <span style={{ fontSize: 11, color: colors.textMuted }}>{folder.document_count}</span>
            </>
          )}
        </button>
        {isExpanded && children.map(child => renderFolderTreeItem(child, depth + 1))}
      </div>
    );
  };

  // ============================================================================
  // Document card (grid view)
  // ============================================================================

  const renderDocCard = (doc: DocumentItem) => {
    const isSelected = selectedDocIds.has(doc.id);
    const statusColors = statusBadgeColor(doc.status);
    const typeColor = getDocTypeColor(doc.document_type);

    return (
      <div
        key={doc.id}
        onClick={() => openDocument(doc)}
        onContextMenu={e => handleContextMenu(e, doc)}
        style={{
          ...glassCard,
          padding: 0,
          cursor: "pointer",
          position: "relative",
          transition: "all 0.25s cubic-bezier(.4,0,.2,1)",
          transform: isSelected ? "scale(0.98)" : "none",
          outline: isSelected ? `2px solid ${colors.accent}` : "none",
          overflow: "hidden",
        }}
        {...cardHoverHandlers}
      >
        {/* Thumbnail / Type indicator */}
        <div style={{
          height: 120,
          background: `linear-gradient(135deg, ${typeColor}15 0%, ${typeColor}08 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          borderBottom: `1px solid ${colors.border}`,
        }}>
          <div style={{ color: typeColor, opacity: 0.6 }}>
            {React.cloneElement(getDocIcon(doc.document_type) as React.ReactElement, { size: 48 })}
          </div>

          {/* Selection checkbox */}
          <div
            onClick={e => { e.stopPropagation(); toggleDocSelection(doc.id); }}
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              width: 22,
              height: 22,
              borderRadius: 6,
              border: `2px solid ${isSelected ? colors.accent : colors.border}`,
              background: isSelected ? colors.accent : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {isSelected && <Check size={14} color="#000" />}
          </div>

          {/* Favorite star */}
          <div
            onClick={e => { e.stopPropagation(); handleToggleFavorite(doc); }}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              cursor: "pointer",
              color: doc.is_favorite ? colors.accent : colors.textMuted,
              transition: "all 0.15s ease",
            }}
          >
            {doc.is_favorite ? <Star size={18} fill={colors.accent} /> : <Star size={18} />}
          </div>

          {/* Status badge */}
          <div style={{
            position: "absolute",
            bottom: 10,
            right: 10,
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            padding: "3px 8px",
            borderRadius: 6,
            background: statusColors.bg,
            color: statusColors.text,
          }}>
            {doc.status}
          </div>

          {/* Lock indicator */}
          {doc.is_locked && (
            <div style={{ position: "absolute", bottom: 10, left: 10, color: colors.warning }}>
              <Lock size={14} />
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: "14px 16px" }}>
          <h3 style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: colors.text,
            fontFamily: "Rubik, sans-serif",
            lineHeight: 1.3,
            marginBottom: 6,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {doc.title}
          </h3>

          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: colors.textMuted }}>
            <Clock size={12} />
            <span>{timeAgo(doc.updated_at)}</span>
            {doc.word_count > 0 && (
              <>
                <span style={{ opacity: 0.4 }}>|</span>
                <span>{doc.word_count.toLocaleString()} words</span>
              </>
            )}
          </div>

          {/* Tags */}
          {doc.tags && doc.tags.length > 0 && (
            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
              {doc.tags.slice(0, 3).map(tag => (
                <span key={tag} style={{ ...glassTag, fontSize: 10, padding: "2px 6px" }}>
                  {tag}
                </span>
              ))}
              {doc.tags.length > 3 && (
                <span style={{ ...glassTag, fontSize: 10, padding: "2px 6px" }}>
                  +{doc.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Footer indicators */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 10,
            fontSize: 11,
            color: colors.textMuted,
          }}>
            {doc.share_count > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <Users size={12} /> {doc.share_count}
              </span>
            )}
            {doc.comment_count > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <MessageSquare size={12} /> {doc.comment_count}
              </span>
            )}
            {doc.version_count > 1 && (
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <History size={12} /> v{doc.version_count}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // Document row (list view)
  // ============================================================================

  const renderDocRow = (doc: DocumentItem) => {
    const isSelected = selectedDocIds.has(doc.id);
    const statusColors = statusBadgeColor(doc.status);
    const typeColor = getDocTypeColor(doc.document_type);

    return (
      <div
        key={doc.id}
        onClick={() => openDocument(doc)}
        onContextMenu={e => handleContextMenu(e, doc)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          borderRadius: 12,
          background: isSelected ? colors.surfaceActive : "transparent",
          cursor: "pointer",
          transition: "all 0.15s ease",
          borderBottom: `1px solid ${colors.border}`,
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = colors.surfaceHover; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? colors.surfaceActive : "transparent"; }}
      >
        {/* Checkbox */}
        <div
          onClick={e => { e.stopPropagation(); toggleDocSelection(doc.id); }}
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            border: `2px solid ${isSelected ? colors.accent : colors.border}`,
            background: isSelected ? colors.accent : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {isSelected && <Check size={12} color="#000" />}
        </div>

        {/* Icon */}
        <div style={{ color: typeColor, flexShrink: 0 }}>
          {getDocIcon(doc.document_type)}
        </div>

        {/* Title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14,
            fontWeight: 500,
            color: colors.text,
            fontFamily: "Rubik, sans-serif",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {doc.title}
          </div>
          {doc.tags && doc.tags.length > 0 && (
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              {doc.tags.slice(0, 2).map(tag => (
                <span key={tag} style={{ ...glassTag, fontSize: 10, padding: "1px 6px" }}>{tag}</span>
              ))}
            </div>
          )}
        </div>

        {/* Status */}
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          padding: "3px 10px",
          borderRadius: 6,
          background: statusColors.bg,
          color: statusColors.text,
          flexShrink: 0,
        }}>
          {doc.status}
        </span>

        {/* Word count */}
        <span style={{ fontSize: 12, color: colors.textMuted, width: 80, textAlign: "right", flexShrink: 0 }}>
          {doc.word_count > 0 ? `${doc.word_count.toLocaleString()} w` : "--"}
        </span>

        {/* Modified */}
        <span style={{ fontSize: 12, color: colors.textMuted, width: 80, textAlign: "right", flexShrink: 0 }}>
          {timeAgo(doc.updated_at)}
        </span>

        {/* Indicators */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, width: 80 }}>
          {doc.share_count > 0 && <Users size={14} style={{ color: colors.textMuted }} />}
          {doc.is_locked && <Lock size={14} style={{ color: colors.warning }} />}
          <div
            onClick={e => { e.stopPropagation(); handleToggleFavorite(doc); }}
            style={{ cursor: "pointer", color: doc.is_favorite ? colors.accent : colors.textMuted }}
          >
            {doc.is_favorite ? <Star size={14} fill={colors.accent} /> : <Star size={14} />}
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={e => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, doc }); }}
          style={{
            background: "none",
            border: "none",
            color: colors.textMuted,
            cursor: "pointer",
            padding: 4,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
          }}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
    );
  };

  // ============================================================================
  // Context Menu
  // ============================================================================

  const renderContextMenu = () => {
    if (!contextMenu) return null;
    const doc = contextMenu.doc;
    const items = [
      { icon: <Eye size={14} />, label: "Open", action: () => openDocument(doc) },
      { icon: <Edit3 size={14} />, label: "Rename", action: () => { setActiveDoc(doc); setRenameValue(doc.title); setShowRenameModal(true); } },
      { icon: <Share2 size={14} />, label: "Share", action: () => openShareModal(doc) },
      { icon: <Move size={14} />, label: "Move to...", action: () => { setActiveDoc(doc); setShowMoveModal(true); } },
      { icon: <Copy size={14} />, label: "Duplicate", action: async () => {
        try {
          await sbPost(`/api/documents?user_id=${encodeURIComponent(userId)}`, { title: doc.title + " (Copy)", document_type: doc.document_type, workspace_id: doc.workspace_id, folder_id: doc.folder_id });
          fetchDocuments();
        } catch { /* silent */ }
      }},
      { icon: <Download size={14} />, label: "Export", action: () => { setActiveDoc(doc); setShowExportModal(true); } },
      { icon: <History size={14} />, label: "Version history", action: () => openVersions(doc) },
      { icon: doc.is_favorite ? <StarOff size={14} /> : <Star size={14} />, label: doc.is_favorite ? "Remove favorite" : "Add to favorites", action: () => handleToggleFavorite(doc) },
      null, // divider
      { icon: <Trash2 size={14} />, label: "Delete", action: () => { setActiveDoc(doc); setShowDeleteConfirm(true); }, danger: true },
    ];

    return (
      <div
        style={{
          position: "fixed",
          top: contextMenu.y,
          left: contextMenu.x,
          zIndex: 9999,
          ...glassSurface,
          padding: "6px",
          minWidth: 200,
          boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {items.map((item, i) => {
          if (!item) return <div key={i} style={{ height: 1, background: colors.border, margin: "4px 0" }} />;
          return (
            <button
              key={i}
              onClick={() => { item.action(); setContextMenu(null); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: (item as { danger?: boolean }).danger ? colors.error : colors.text,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "Rubik, sans-serif",
                textAlign: "left",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = colors.surfaceHover; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </div>
    );
  };

  // ============================================================================
  // Modals
  // ============================================================================

  const modalOverlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000,
    padding: 20,
  };

  const modalContentStyle: React.CSSProperties = {
    ...glassSurface,
    padding: 28,
    width: "100%",
    maxWidth: 520,
    maxHeight: "80vh",
    overflowY: "auto",
    borderRadius: 20,
    boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
  };

  const modalTitleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
    color: colors.text,
    fontFamily: "Rubik, sans-serif",
    marginBottom: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };

  const inputStyle: React.CSSProperties = {
    ...glassInput,
    width: "100%",
    padding: "12px 16px",
    fontSize: 14,
    fontFamily: "Rubik, sans-serif",
    boxSizing: "border-box",
  };

  const btnRow: React.CSSProperties = {
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 20,
  };

  const renderCreateModal = () => {
    if (!showCreateModal) return null;
    return (
      <div style={modalOverlayStyle} onClick={() => setShowCreateModal(false)}>
        <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
          <div style={modalTitleStyle}>
            <span>New Document</span>
            <button onClick={() => setShowCreateModal(false)} style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer" }}><X size={18} /></button>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontFamily: "Rubik, sans-serif" }}>Title</label>
            <input
              style={inputStyle}
              value={newDocTitle}
              onChange={e => setNewDocTitle(e.target.value)}
              placeholder="Document title"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") handleCreateDocument(); }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontFamily: "Rubik, sans-serif" }}>Type</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { value: "general", label: "Document", icon: <FileText size={16} /> },
                { value: "spreadsheet", label: "Spreadsheet", icon: <FileSpreadsheet size={16} /> },
                { value: "presentation", label: "Presentation", icon: <Presentation size={16} /> },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setNewDocType(opt.value)}
                  style={{
                    ...glassButton,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 16px",
                    fontSize: 13,
                    fontFamily: "Rubik, sans-serif",
                    background: newDocType === opt.value ? colors.surfaceActive : colors.surface,
                    borderColor: newDocType === opt.value ? colors.accent : colors.border,
                    color: newDocType === opt.value ? colors.accent : colors.text,
                  }}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={btnRow}>
            <button
              onClick={() => setShowCreateModal(false)}
              style={{ ...glassButton, padding: "10px 20px", fontSize: 13, fontFamily: "Rubik, sans-serif" }}
              {...buttonHoverHandlers}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateDocument}
              style={{ ...accentButton, padding: "10px 24px", fontSize: 13, fontFamily: "Rubik, sans-serif" }}
              {...accentButtonHoverHandlers}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderTemplateModal = () => {
    if (!showTemplateModal) return null;
    return (
      <div style={modalOverlayStyle} onClick={() => setShowTemplateModal(false)}>
        <div style={{ ...modalContentStyle, maxWidth: 640 }} onClick={e => e.stopPropagation()}>
          <div style={modalTitleStyle}>
            <span>Create from Template</span>
            <button onClick={() => setShowTemplateModal(false)} style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer" }}><X size={18} /></button>
          </div>

          {templates.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: colors.textMuted }}>
              <File size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: 14, fontFamily: "Rubik, sans-serif" }}>No templates available</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              {templates.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => handleCreateFromTemplate(tpl.id)}
                  style={{
                    ...glassCard,
                    padding: 16,
                    cursor: "pointer",
                    textAlign: "center",
                    border: `1px solid ${colors.border}`,
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = colors.accent; e.currentTarget.style.background = colors.surfaceHover; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.background = colors.cardBg; }}
                >
                  <FileText size={28} style={{ color: colors.accent, marginBottom: 8 }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, fontFamily: "Rubik, sans-serif", marginBottom: 4 }}>
                    {tpl.name}
                  </div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>{tpl.category}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderShareModal = () => {
    if (!showShareModal || !activeDoc) return null;
    return (
      <div style={modalOverlayStyle} onClick={() => setShowShareModal(false)}>
        <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
          <div style={modalTitleStyle}>
            <span>Share "{truncate(activeDoc.title, 30)}"</span>
            <button onClick={() => setShowShareModal(false)} style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer" }}><X size={18} /></button>
          </div>

          {/* Add share */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={shareEmail}
              onChange={e => setShareEmail(e.target.value)}
              placeholder="Email address"
              onKeyDown={e => { if (e.key === "Enter") handleShare(); }}
            />
            <select
              value={sharePermission}
              onChange={e => setSharePermission(e.target.value)}
              style={{ ...inputStyle, width: 100, cursor: "pointer" }}
            >
              <option value="view">View</option>
              <option value="comment">Comment</option>
              <option value="edit">Edit</option>
            </select>
            <button onClick={handleShare} style={{ ...accentButton, padding: "10px 16px", fontSize: 13 }} {...accentButtonHoverHandlers}>
              Share
            </button>
          </div>

          {/* Current shares */}
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10, fontFamily: "Rubik, sans-serif" }}>
            People with access
          </div>
          {shares.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20, color: colors.textMuted, fontSize: 13 }}>
              No one else has access
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {shares.map(share => (
                <div key={share.id} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: colors.cardBg,
                  border: `1px solid ${colors.border}`,
                }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: colors.surface,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: colors.textSecondary,
                  }}>
                    <Users size={14} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: colors.text, fontFamily: "Rubik, sans-serif" }}>
                      {share.email || share.user_id || "User"}
                    </div>
                  </div>
                  <span style={{ ...glassTag, textTransform: "capitalize" }}>{share.permission}</span>
                  <button
                    onClick={() => handleRemoveShare(share.id)}
                    style={{ background: "none", border: "none", color: colors.error, cursor: "pointer", padding: 4 }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderVersionsPanel = () => {
    if (!showVersionsPanel || !activeDoc) return null;
    return (
      <div style={modalOverlayStyle} onClick={() => setShowVersionsPanel(false)}>
        <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
          <div style={modalTitleStyle}>
            <span>Version History</span>
            <button onClick={() => setShowVersionsPanel(false)} style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer" }}><X size={18} /></button>
          </div>

          {versions.length === 0 ? (
            <div style={{ textAlign: "center", padding: 30, color: colors.textMuted, fontSize: 13 }}>
              <History size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
              <div>No version history</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {versions.map(v => (
                <div key={v.id} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: colors.cardBg,
                  border: `1px solid ${colors.border}`,
                }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: colors.surface,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: colors.accent,
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "Rubik, sans-serif",
                    flexShrink: 0,
                  }}>
                    v{v.version_number}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: colors.text, fontFamily: "Rubik, sans-serif" }}>
                      {v.title}
                    </div>
                    <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                      {v.change_note || v.change_type} -- {timeAgo(v.created_at)}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await sbPost(`/api/documents/${activeDoc.id}/restore/${v.id}?user_id=${encodeURIComponent(userId)}`);
                        setShowVersionsPanel(false);
                        fetchDocuments();
                      } catch { /* silent */ }
                    }}
                    style={{ ...glassButton, padding: "6px 12px", fontSize: 12, fontFamily: "Rubik, sans-serif" }}
                    {...buttonHoverHandlers}
                  >
                    <RotateCcw size={12} style={{ marginRight: 4 }} />
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRenameModal = () => {
    if (!showRenameModal || !activeDoc) return null;
    return (
      <div style={modalOverlayStyle} onClick={() => setShowRenameModal(false)}>
        <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
          <div style={modalTitleStyle}>
            <span>Rename Document</span>
            <button onClick={() => setShowRenameModal(false)} style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer" }}><X size={18} /></button>
          </div>
          <input
            style={inputStyle}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === "Enter") handleRename(); }}
          />
          <div style={btnRow}>
            <button onClick={() => setShowRenameModal(false)} style={{ ...glassButton, padding: "10px 20px", fontSize: 13, fontFamily: "Rubik, sans-serif" }} {...buttonHoverHandlers}>Cancel</button>
            <button onClick={handleRename} style={{ ...accentButton, padding: "10px 24px", fontSize: 13, fontFamily: "Rubik, sans-serif" }} {...accentButtonHoverHandlers}>Rename</button>
          </div>
        </div>
      </div>
    );
  };

  const renderMoveModal = () => {
    if (!showMoveModal || !activeDoc) return null;
    return (
      <div style={modalOverlayStyle} onClick={() => setShowMoveModal(false)}>
        <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
          <div style={modalTitleStyle}>
            <span>Move "{truncate(activeDoc.title, 25)}"</span>
            <button onClick={() => setShowMoveModal(false)} style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer" }}><X size={18} /></button>
          </div>

          <button
            onClick={() => setMoveFolderId(null)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "none",
              background: moveFolderId === null ? colors.surfaceActive : "transparent",
              color: colors.text,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "Rubik, sans-serif",
              marginBottom: 4,
            }}
          >
            <Home size={16} /> Root (No folder)
          </button>
          {folders.map(f => (
            <button
              key={f.id}
              onClick={() => setMoveFolderId(f.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                background: moveFolderId === f.id ? colors.surfaceActive : "transparent",
                color: colors.text,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "Rubik, sans-serif",
                marginBottom: 4,
              }}
            >
              <Folder size={16} style={{ color: f.color || colors.accent }} /> {f.name}
            </button>
          ))}
          <div style={btnRow}>
            <button onClick={() => setShowMoveModal(false)} style={{ ...glassButton, padding: "10px 20px", fontSize: 13, fontFamily: "Rubik, sans-serif" }} {...buttonHoverHandlers}>Cancel</button>
            <button onClick={handleMove} style={{ ...accentButton, padding: "10px 24px", fontSize: 13, fontFamily: "Rubik, sans-serif" }} {...accentButtonHoverHandlers}>Move</button>
          </div>
        </div>
      </div>
    );
  };

  const renderDeleteConfirm = () => {
    if (!showDeleteConfirm || !activeDoc) return null;
    return (
      <div style={modalOverlayStyle} onClick={() => setShowDeleteConfirm(false)}>
        <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
          <div style={modalTitleStyle}>
            <span>Delete Document</span>
            <button onClick={() => setShowDeleteConfirm(false)} style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer" }}><X size={18} /></button>
          </div>
          <div style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 8, fontFamily: "Rubik, sans-serif", lineHeight: 1.6 }}>
            Are you sure you want to delete <strong style={{ color: colors.text }}>"{activeDoc.title}"</strong>?
            This will move it to trash.
          </div>
          <div style={btnRow}>
            <button onClick={() => setShowDeleteConfirm(false)} style={{ ...glassButton, padding: "10px 20px", fontSize: 13, fontFamily: "Rubik, sans-serif" }} {...buttonHoverHandlers}>Cancel</button>
            <button
              onClick={() => handleDeleteDocument(activeDoc)}
              style={{ ...accentButton, padding: "10px 24px", fontSize: 13, fontFamily: "Rubik, sans-serif", background: colors.error, boxShadow: "none" }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderExportModal = () => {
    if (!showExportModal || !activeDoc) return null;
    return (
      <div style={modalOverlayStyle} onClick={() => setShowExportModal(false)}>
        <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
          <div style={modalTitleStyle}>
            <span>Export "{truncate(activeDoc.title, 25)}"</span>
            <button onClick={() => setShowExportModal(false)} style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer" }}><X size={18} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { value: "pdf", label: "PDF", desc: "Best for sharing" },
              { value: "docx", label: "Word (.docx)", desc: "Editable document" },
              { value: "markdown", label: "Markdown", desc: "Plain text format" },
              { value: "html", label: "HTML", desc: "Web format" },
            ].map(fmt => (
              <button
                key={fmt.value}
                onClick={() => setExportFormat(fmt.value)}
                style={{
                  ...glassCard,
                  padding: "14px 16px",
                  cursor: "pointer",
                  textAlign: "left",
                  borderColor: exportFormat === fmt.value ? colors.accent : colors.border,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = colors.surfaceHover; }}
                onMouseLeave={e => { e.currentTarget.style.background = colors.cardBg; }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: exportFormat === fmt.value ? colors.accent : colors.text, fontFamily: "Rubik, sans-serif" }}>
                  {fmt.label}
                </div>
                <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{fmt.desc}</div>
              </button>
            ))}
          </div>
          <div style={btnRow}>
            <button onClick={() => setShowExportModal(false)} style={{ ...glassButton, padding: "10px 20px", fontSize: 13, fontFamily: "Rubik, sans-serif" }} {...buttonHoverHandlers}>Cancel</button>
            <button onClick={handleExport} style={{ ...accentButton, padding: "10px 24px", fontSize: 13, fontFamily: "Rubik, sans-serif" }} {...accentButtonHoverHandlers}>
              <Download size={14} style={{ marginRight: 6 }} /> Export
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCreateFolderModal = () => {
    if (!showCreateFolder) return null;
    return (
      <div style={modalOverlayStyle} onClick={() => setShowCreateFolder(false)}>
        <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
          <div style={modalTitleStyle}>
            <span>New Folder</span>
            <button onClick={() => setShowCreateFolder(false)} style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer" }}><X size={18} /></button>
          </div>
          <input
            style={inputStyle}
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            autoFocus
            onKeyDown={e => { if (e.key === "Enter") handleCreateFolder(); }}
          />
          <div style={btnRow}>
            <button onClick={() => setShowCreateFolder(false)} style={{ ...glassButton, padding: "10px 20px", fontSize: 13, fontFamily: "Rubik, sans-serif" }} {...buttonHoverHandlers}>Cancel</button>
            <button onClick={handleCreateFolder} style={{ ...accentButton, padding: "10px 24px", fontSize: 13, fontFamily: "Rubik, sans-serif" }} {...accentButtonHoverHandlers}>Create</button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // Editor Modal (OnlyOffice or content preview)
  // ============================================================================

  const renderEditorModal = () => {
    if (!showEditorModal || !activeDoc) return null;

    return (
      <div style={{
        position: "fixed",
        inset: 0,
        background: isDark ? "rgba(0,0,0,0.9)" : "rgba(0,0,0,0.8)",
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Editor header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 20px",
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surface,
          backdropFilter: "blur(20px)",
        }}>
          <button
            onClick={() => { setShowEditorModal(false); setActiveDoc(null); setActiveDocDetail(null); }}
            style={{ ...glassButton, padding: "8px 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, fontFamily: "Rubik, sans-serif" }}
            {...buttonHoverHandlers}
          >
            <ChevronLeft size={16} />
            Back
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: colors.text, fontFamily: "Rubik, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {activeDoc.title}
            </div>
            <div style={{ fontSize: 11, color: colors.textMuted }}>
              Last edited {timeAgo(activeDoc.updated_at)}
              {activeDoc.word_count > 0 && ` -- ${activeDoc.word_count.toLocaleString()} words`}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => openShareModal(activeDoc)}
              style={{ ...glassButton, padding: "8px 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, fontFamily: "Rubik, sans-serif" }}
              {...buttonHoverHandlers}
            >
              <Share2 size={14} /> Share
            </button>
            <button
              onClick={() => openVersions(activeDoc)}
              style={{ ...glassButton, padding: "8px 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, fontFamily: "Rubik, sans-serif" }}
              {...buttonHoverHandlers}
            >
              <History size={14} /> History
            </button>
            <button
              onClick={() => { setShowExportModal(true); }}
              style={{ ...glassButton, padding: "8px 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, fontFamily: "Rubik, sans-serif" }}
              {...buttonHoverHandlers}
            >
              <Download size={14} /> Export
            </button>
          </div>
        </div>

        {/* Editor body */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", padding: 32 }}>
          <div style={{
            ...glassCard,
            maxWidth: 800,
            width: "100%",
            padding: "40px 48px",
            minHeight: 600,
          }}>
            {activeDocDetail ? (
              <div>
                <h1 style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: colors.text,
                  fontFamily: "Rubik, sans-serif",
                  marginBottom: 24,
                  lineHeight: 1.3,
                }}>
                  {activeDocDetail.title}
                </h1>

                {/* Metadata */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginBottom: 24,
                  paddingBottom: 20,
                  borderBottom: `1px solid ${colors.border}`,
                }}>
                  <span style={{
                    ...statusBadgeColor(activeDocDetail.status),
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: statusBadgeColor(activeDocDetail.status).bg,
                    color: statusBadgeColor(activeDocDetail.status).text,
                  } as React.CSSProperties}>
                    {activeDocDetail.status}
                  </span>
                  <span style={{ fontSize: 12, color: colors.textMuted }}>
                    {activeDocDetail.word_count.toLocaleString()} words
                  </span>
                  <span style={{ fontSize: 12, color: colors.textMuted }}>
                    {activeDocDetail.reading_time_minutes} min read
                  </span>
                  {activeDocDetail.tags.map(tag => (
                    <span key={tag} style={glassTag}>{tag}</span>
                  ))}
                </div>

                {/* Content */}
                {activeDocDetail.content_text ? (
                  <div style={{
                    fontSize: 15,
                    lineHeight: 1.8,
                    color: colors.text,
                    fontFamily: "Rubik, sans-serif",
                    whiteSpace: "pre-wrap",
                  }}>
                    {activeDocDetail.content_text}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: 60, color: colors.textMuted }}>
                    <FileText size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <div style={{ fontSize: 15, fontFamily: "Rubik, sans-serif", marginBottom: 8 }}>
                      This document is empty
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.7 }}>
                      Open in OnlyOffice to start editing
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const config = await sbGet<Record<string, unknown>>(
                            `/api/documents/documents/office/config/${activeDoc.id}?user_id=${encodeURIComponent(userId)}`
                          );
                          // Open OnlyOffice in new window
                          if (config && typeof config === "object") {
                            const docUrl = ((config as { document?: { url?: string } }).document as { url?: string })?.url;
                            if (docUrl) window.open(docUrl, "_blank");
                          }
                        } catch {
                          // Fallback: open WOPI token endpoint
                          window.open(`/sbapi/api/documents/documents/office/config/${activeDoc.id}?user_id=${encodeURIComponent(userId)}`, "_blank");
                        }
                      }}
                      style={{ ...accentButton, padding: "12px 24px", fontSize: 14, fontFamily: "Rubik, sans-serif", marginTop: 16 }}
                      {...accentButtonHoverHandlers}
                    >
                      <ExternalLink size={16} style={{ marginRight: 8 }} />
                      Open in OnlyOffice
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, color: colors.textMuted }}>
                <Loader2 size={24} className="animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // Main Layout
  // ============================================================================

  return (
    <div style={{
      width: "100%",
      height: "100vh",
      display: "flex",
      fontFamily: "Rubik, sans-serif",
      background: "var(--sb-color-background)",
      color: colors.text,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background orbs */}
      <GlassBackground />

      {/* ===== Sidebar ===== */}
      <div style={{
        width: sidebarCollapsed ? 60 : 260,
        flexShrink: 0,
        borderRight: `1px solid ${colors.border}`,
        background: colors.surface,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.2s ease",
        position: "relative",
        zIndex: 10,
        overflow: "hidden",
      }}>
        {/* Sidebar header */}
        <div style={{
          padding: sidebarCollapsed ? "16px 12px" : "16px 16px",
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          {!sidebarCollapsed && (
            <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: colors.text }}>
              Documents
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              background: "none",
              border: "none",
              color: colors.textMuted,
              cursor: "pointer",
              padding: 6,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
            }}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* New document button */}
        <div style={{ padding: sidebarCollapsed ? "12px 8px" : "12px 16px" }}>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              ...accentButton,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              padding: sidebarCollapsed ? "10px" : "10px 16px",
              fontSize: 13,
            }}
            {...accentButtonHoverHandlers}
          >
            <Plus size={16} />
            {!sidebarCollapsed && "New Document"}
          </button>
        </div>

        {/* Navigation items */}
        <div style={{ padding: sidebarCollapsed ? "4px 8px" : "4px 12px", flex: 1, overflowY: "auto" }}>
          {renderSidebarItem("All Documents", <FileText size={18} />, "all", documents.length)}
          {renderSidebarItem("Recent", <Clock size={18} />, "recent")}
          {renderSidebarItem("Favorites", <Star size={18} />, "favorites")}
          {renderSidebarItem("Shared with Me", <Users size={18} />, "shared")}
          {renderSidebarItem("Trash", <Trash2 size={18} />, "trash")}

          {/* Folders section */}
          {!sidebarCollapsed && (
            <div style={{ marginTop: 20 }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 14px",
                marginBottom: 4,
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: colors.textMuted }}>
                  Folders
                </span>
                <button
                  onClick={() => setShowCreateFolder(true)}
                  style={{
                    background: "none",
                    border: "none",
                    color: colors.textMuted,
                    cursor: "pointer",
                    padding: 2,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="New folder"
                >
                  <FolderPlus size={14} />
                </button>
              </div>
              {rootFolders.map(f => renderFolderTreeItem(f))}
              {rootFolders.length === 0 && (
                <div style={{ padding: "10px 14px", fontSize: 12, color: colors.textMuted, fontStyle: "italic" }}>
                  No folders yet
                </div>
              )}
            </div>
          )}

          {/* Templates section */}
          {!sidebarCollapsed && (
            <div style={{ marginTop: 20 }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 14px",
                marginBottom: 4,
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: colors.textMuted }}>
                  Templates
                </span>
              </div>
              <button
                onClick={() => setShowTemplateModal(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "transparent",
                  color: colors.textSecondary,
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: "Rubik, sans-serif",
                  textAlign: "left",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = colors.surfaceHover; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <File size={16} />
                Create from template...
              </button>
            </div>
          )}
        </div>

        {/* Sidebar footer */}
        {!sidebarCollapsed && (
          <div style={{
            padding: "12px 16px",
            borderTop: `1px solid ${colors.border}`,
            fontSize: 11,
            color: colors.textMuted,
          }}>
            {workspaces.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: workspaces[0]?.color || colors.accent }} />
                {workspaces[0]?.name || "Workspace"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== Main Content ===== */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        zIndex: 5,
      }}>
        {/* Top bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 24px",
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surface,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          flexShrink: 0,
        }}>
          {/* Breadcrumbs */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {breadcrumbs.map((bc, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight size={14} style={{ color: colors.textMuted }} />}
                <button
                  onClick={bc.onClick}
                  style={{
                    background: "none",
                    border: "none",
                    color: i === breadcrumbs.length - 1 ? colors.text : colors.textMuted,
                    cursor: bc.onClick ? "pointer" : "default",
                    fontSize: 14,
                    fontWeight: i === breadcrumbs.length - 1 ? 600 : 400,
                    fontFamily: "Rubik, sans-serif",
                    padding: "2px 4px",
                  }}
                >
                  {bc.label}
                </button>
              </React.Fragment>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* Search */}
          <div style={{
            ...glassInput,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            width: 280,
          }}>
            <Search size={16} style={{ color: colors.textMuted, flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              style={{
                background: "none",
                border: "none",
                outline: "none",
                color: colors.text,
                fontSize: 13,
                fontFamily: "Rubik, sans-serif",
                width: "100%",
              }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search documents... (Cmd+K)"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer", padding: 2 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort */}
          <button
            onClick={() => {
              if (sortDir === "desc") setSortDir("asc");
              else {
                const fields: SortField[] = ["updated_at", "created_at", "title", "word_count"];
                const idx = fields.indexOf(sortField);
                setSortField(fields[(idx + 1) % fields.length]);
                setSortDir("desc");
              }
            }}
            style={{ ...glassButton, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "Rubik, sans-serif" }}
            {...buttonHoverHandlers}
            title={`Sort: ${sortField} ${sortDir}`}
          >
            {sortDir === "desc" ? <SortDesc size={14} /> : <SortAsc size={14} />}
            {sortField === "updated_at" ? "Modified" : sortField === "created_at" ? "Created" : sortField === "title" ? "Name" : "Words"}
          </button>

          {/* View toggle */}
          <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: `1px solid ${colors.border}` }}>
            <button
              onClick={() => setViewMode("grid")}
              style={{
                padding: "8px 12px",
                background: viewMode === "grid" ? colors.surfaceActive : colors.surface,
                border: "none",
                color: viewMode === "grid" ? colors.accent : colors.textMuted,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Grid3X3 size={16} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              style={{
                padding: "8px 12px",
                background: viewMode === "list" ? colors.surfaceActive : colors.surface,
                border: "none",
                borderLeft: `1px solid ${colors.border}`,
                color: viewMode === "list" ? colors.accent : colors.textMuted,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <List size={16} />
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetchDocuments()}
            style={{ ...glassButton, padding: 8, display: "flex", alignItems: "center" }}
            {...buttonHoverHandlers}
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Bulk actions bar */}
        {selectedDocIds.size > 0 && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 24px",
            background: `${colors.accent}15`,
            borderBottom: `1px solid ${colors.accent}30`,
          }}>
            <button
              onClick={selectAllDocs}
              style={{
                ...glassButton,
                padding: "6px 12px",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "Rubik, sans-serif",
              }}
              {...buttonHoverHandlers}
            >
              {selectedDocIds.size === sortedDocuments.length ? <X size={14} /> : <Check size={14} />}
              {selectedDocIds.size === sortedDocuments.length ? "Deselect All" : "Select All"}
            </button>
            <span style={{ fontSize: 13, color: colors.text, fontWeight: 500 }}>
              {selectedDocIds.size} selected
            </span>
            <div style={{ flex: 1 }} />
            <button
              onClick={handleBulkDelete}
              style={{
                ...glassButton,
                padding: "6px 12px",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: colors.error,
                fontFamily: "Rubik, sans-serif",
              }}
            >
              <Trash2 size={14} /> Delete Selected
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 24px",
            background: colors.errorBg,
            color: colors.error,
            fontSize: 13,
            fontFamily: "Rubik, sans-serif",
          }}>
            <AlertCircle size={16} />
            {error}
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: colors.error, cursor: "pointer", marginLeft: "auto" }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Document grid/list */}
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {loading ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 16,
              color: colors.textMuted,
            }}>
              <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 14, fontFamily: "Rubik, sans-serif" }}>Loading documents...</span>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : sortedDocuments.length === 0 ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 16,
              color: colors.textMuted,
            }}>
              <FileText size={56} style={{ opacity: 0.3 }} />
              <div style={{ fontSize: 18, fontWeight: 600, color: colors.text, fontFamily: "Rubik, sans-serif" }}>
                {searchQuery ? "No documents found" : sidebarSection === "trash" ? "Trash is empty" : "No documents yet"}
              </div>
              <div style={{ fontSize: 14, opacity: 0.7 }}>
                {searchQuery ? "Try a different search term" : "Create your first document to get started"}
              </div>
              {!searchQuery && sidebarSection !== "trash" && (
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    style={{ ...accentButton, padding: "12px 24px", fontSize: 14, display: "flex", alignItems: "center", gap: 8, fontFamily: "Rubik, sans-serif" }}
                    {...accentButtonHoverHandlers}
                  >
                    <Plus size={16} /> New Document
                  </button>
                  <button
                    onClick={() => setShowTemplateModal(true)}
                    style={{ ...glassButton, padding: "12px 24px", fontSize: 14, display: "flex", alignItems: "center", gap: 8, fontFamily: "Rubik, sans-serif" }}
                    {...buttonHoverHandlers}
                  >
                    <File size={16} /> From Template
                  </button>
                </div>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 16,
            }}>
              {sortedDocuments.map(doc => renderDocCard(doc))}
            </div>
          ) : (
            <div style={{
              ...glassSurface,
              overflow: "hidden",
            }}>
              {/* List header */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
                borderBottom: `1px solid ${colors.border}`,
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: colors.textMuted,
              }}>
                <div style={{ width: 20 }}>
                  <button
                    onClick={selectAllDocs}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: `2px solid ${selectedDocIds.size > 0 ? colors.accent : colors.border}`,
                      background: selectedDocIds.size === sortedDocuments.length ? colors.accent : "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {selectedDocIds.size === sortedDocuments.length && <Check size={10} color="#000" />}
                  </button>
                </div>
                <div style={{ width: 20 }} />
                <div style={{ flex: 1 }}>Name</div>
                <div style={{ width: 80, textAlign: "center" }}>Status</div>
                <div style={{ width: 80, textAlign: "right" }}>Words</div>
                <div style={{ width: 80, textAlign: "right" }}>Modified</div>
                <div style={{ width: 80 }} />
                <div style={{ width: 24 }} />
              </div>
              {sortedDocuments.map(doc => renderDocRow(doc))}
            </div>
          )}

          {/* Trash section: Restore hint */}
          {sidebarSection === "trash" && sortedDocuments.length > 0 && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 16,
              padding: "10px 16px",
              borderRadius: 12,
              background: colors.warningBg,
              fontSize: 13,
              color: colors.warning,
              fontFamily: "Rubik, sans-serif",
            }}>
              <AlertCircle size={16} />
              Right-click a document to restore it from trash.
            </div>
          )}
        </div>
      </div>

      {/* ===== Modals ===== */}
      {renderCreateModal()}
      {renderTemplateModal()}
      {renderShareModal()}
      {renderVersionsPanel()}
      {renderEditorModal()}
      {renderContextMenu()}
      {renderRenameModal()}
      {renderMoveModal()}
      {renderDeleteConfirm()}
      {renderExportModal()}
      {renderCreateFolderModal()}
    </div>
  );
}

export default DocumentsPage;

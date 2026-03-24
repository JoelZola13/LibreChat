import React, { useState, useEffect, useCallback, useMemo } from "react";
import "@/styles/glassmorphism.css";
import {
  Search,
  Plus,
  FileText,
  File,
  FileSpreadsheet,
  Folder,
  FolderPlus,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Clock,
  Star,
  Trash2,
  Share2,
  Download,
  Edit3,
  X,
  Loader2,
  Upload,
  MoreHorizontal,
  Grid3X3,
  List,
  Eye,
  Users,
  Lock,
  History,
  Tag,
  RefreshCw,
  Presentation,
  ArrowLeft,
  ExternalLink,
  Globe,
  MessageSquare,
} from "lucide-react";
import { useGlassStyles } from "@/hooks/useGlassStyles";
import { CrossLink } from "../shared/CrossLink";
import { sbFetch, sbGet, sbPost, sbPatch, sbDelete } from "@/shared/sbFetch";
import { useAuthContext } from "~/hooks/AuthContext";
import { getOrCreateUserId } from "@/shared/userId";

// ── Types ──────────────────────────────────────────────────────────────

interface Document {
  id: string;
  title: string;
  slug?: string;
  workspace_id?: string;
  folder_id?: string;
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

interface DocumentFolder {
  id: string;
  name: string;
  workspace_id: string;
  parent_folder_id?: string;
  document_count: number;
  created_at: string;
}

interface Workspace {
  id: string;
  name: string;
  description?: string;
  document_count: number;
  folder_count: number;
}

// ── Helpers ────────────────────────────────────────────────────────────

const DOC_TYPE_ICONS: Record<string, typeof FileText> = {
  document: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  default: File,
};

const DOC_TYPE_COLORS: Record<string, string> = {
  document: "#3b82f6",
  spreadsheet: "#22c55e",
  presentation: "#f59e0b",
  default: "#6b7280",
};

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#6b7280" },
  published: { label: "Published", color: "#22c55e" },
  archived: { label: "Archived", color: "#f59e0b" },
  review: { label: "In Review", color: "#8b5cf6" },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getDocIcon(type: string) {
  return DOC_TYPE_ICONS[type] || DOC_TYPE_ICONS.default;
}

function getDocColor(type: string) {
  return DOC_TYPE_COLORS[type] || DOC_TYPE_COLORS.default;
}

// ── EDITOR URL ─────────────────────────────────────────────────────────
// LibreOffice Online / Collabora at port 4100. For OnlyOffice use 8088.
const EDITOR_BASE_URL = "http://localhost:4100";

// ── Component ──────────────────────────────────────────────────────────

function DocumentsPage() {
  const { colors, isDark } = useGlassStyles();
  const { user: authUser } = useAuthContext();
  const userId = getOrCreateUserId(authUser?.id);

  // ── State ──
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navigation
  const [activeSection, setActiveSection] = useState<"all" | "recent" | "favorites" | "shared" | "trash">("all");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // View
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"updated" | "title" | "created">("updated");

  // Editor
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [editorUrl, setEditorUrl] = useState<string>(EDITOR_BASE_URL);

  // Create
  const [showCreateDoc, setShowCreateDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocType, setNewDocType] = useState<"document" | "spreadsheet" | "presentation">("document");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ doc: Document; x: number; y: number } | null>(null);

  // ── Data Loading ──

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = { user_id: userId, limit: "100" };
      if (selectedWorkspaceId) params.workspace_id = selectedWorkspaceId;
      if (selectedFolderId) params.folder_id = selectedFolderId;
      if (activeSection === "favorites") params.is_favorite = "true";
      if (activeSection === "trash") params.status = "deleted";

      let docs: Document[] = [];

      if (activeSection === "recent") {
        try {
          const result = await sbGet<{ documents: Document[] }>("/api/documents/recent", { user_id: userId, limit: "50" });
          docs = result.documents || result as unknown as Document[] || [];
        } catch {
          const result = await sbGet<{ documents: Document[]; total: number }>("/api/documents", { ...params, limit: "50" });
          docs = result.documents || [];
        }
      } else if (searchQuery.trim()) {
        try {
          const result = await sbGet<{ documents: Document[] }>("/api/documents/search", { user_id: userId, q: searchQuery });
          docs = result.documents || result as unknown as Document[] || [];
        } catch {
          docs = [];
        }
      } else {
        const result = await sbGet<{ documents: Document[]; total: number }>("/api/documents", params);
        docs = result.documents || [];
      }

      setDocuments(docs);
    } catch (err) {
      console.error("Failed to load documents:", err);
      setError("Failed to load documents");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [userId, selectedWorkspaceId, selectedFolderId, activeSection, searchQuery]);

  const loadWorkspacesAndFolders = useCallback(async () => {
    try {
      const ws = await sbGet<Workspace[]>("/api/document-workspaces", { user_id: userId }).catch(() => []);
      setWorkspaces(Array.isArray(ws) ? ws : []);
      if (Array.isArray(ws) && ws.length > 0 && !selectedWorkspaceId) {
        setSelectedWorkspaceId(ws[0].id);
        const flds = await sbGet<DocumentFolder[]>(`/api/document-workspaces/${ws[0].id}/folders`, { user_id: userId }).catch(() => []);
        setFolders(Array.isArray(flds) ? flds : []);
      }
    } catch {
      setWorkspaces([]);
      setFolders([]);
    }
  }, [userId, selectedWorkspaceId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    loadWorkspacesAndFolders();
  }, [loadWorkspacesAndFolders]);

  // ── Actions ──

  const createDocument = async () => {
    if (!newDocTitle.trim()) return;
    try {
      const newDoc = await sbPost<Document>("/api/documents", {
        user_id: userId,
        title: newDocTitle.trim(),
        document_type: newDocType,
        workspace_id: selectedWorkspaceId,
        folder_id: selectedFolderId,
        content: {},
      });
      setDocuments(prev => [newDoc, ...prev]);
      setNewDocTitle("");
      setShowCreateDoc(false);
      // Open in editor
      openDocument(newDoc);
    } catch (err) {
      console.error("Failed to create document:", err);
      setError("Failed to create document");
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim() || !selectedWorkspaceId) return;
    try {
      const newFolder = await sbPost<DocumentFolder>(`/api/document-workspaces/${selectedWorkspaceId}/folders`, {
        user_id: userId,
        name: newFolderName.trim(),
        parent_folder_id: selectedFolderId,
      });
      setFolders(prev => [...prev, newFolder]);
      setNewFolderName("");
      setShowCreateFolder(false);
    } catch (err) {
      console.error("Failed to create folder:", err);
    }
  };

  const deleteDocument = async (doc: Document) => {
    try {
      await sbDelete(`/api/documents/${doc.id}?user_id=${userId}`);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      setContextMenu(null);
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const toggleFavorite = async (doc: Document) => {
    try {
      if (doc.is_favorite) {
        await sbDelete(`/api/documents/${doc.id}/favorite?user_id=${userId}`);
      } else {
        await sbPost(`/api/documents/${doc.id}/favorite`, { user_id: userId });
      }
      setDocuments(prev => prev.map(d =>
        d.id === doc.id ? { ...d, is_favorite: !d.is_favorite } : d
      ));
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  const openDocument = async (doc: Document) => {
    // Try to get OnlyOffice config for proper WOPI editing
    try {
      const config = await sbGet<{ document?: { url?: string } }>(
        `/api/documents/office/config/${doc.id}`,
        { user_id: userId }
      );
      if (config?.document?.url) {
        // If we get a config, use the OnlyOffice editor URL
        setEditorUrl(`http://localhost:8088/web-apps/apps/documenteditor/main/index.html?url=${encodeURIComponent(config.document.url)}`);
      } else {
        setEditorUrl(EDITOR_BASE_URL);
      }
    } catch {
      // Fallback: just use the base editor URL
      setEditorUrl(EDITOR_BASE_URL);
    }
    setEditingDoc(doc);
  };

  const closeEditor = () => {
    setEditingDoc(null);
    setEditorUrl(EDITOR_BASE_URL);
    loadDocuments(); // Refresh to pick up changes
  };

  // ── Filtered & sorted docs ──

  const displayDocs = useMemo(() => {
    let filtered = [...documents];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    filtered.sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "created") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    return filtered;
  }, [documents, searchQuery, sortBy]);

  // ── Close context menu on click outside ──
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu]);

  // ── Styles ──

  const sidebarStyle: React.CSSProperties = {
    width: "240px",
    minWidth: "240px",
    height: "100%",
    borderRight: `1px solid ${colors.border}`,
    background: isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.5)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  const sidebarBtnStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "100%",
    padding: "9px 14px",
    borderRadius: "8px",
    background: active ? (isDark ? "rgba(255,214,0,0.12)" : "rgba(59,130,246,0.1)") : "transparent",
    border: "none",
    cursor: "pointer",
    color: active ? colors.accent : colors.textSecondary,
    fontSize: "0.85rem",
    fontWeight: active ? 600 : 400,
    textAlign: "left" as const,
    transition: "background 0.15s",
  });

  // ── Render: Editor View ──

  if (editingDoc) {
    return (
      <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", background: colors.background }}>
        {/* Editor top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "8px 16px",
            borderBottom: `1px solid ${colors.border}`,
            background: isDark ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.7)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            minHeight: "48px",
          }}
        >
          <button
            onClick={closeEditor}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
              border: `1px solid ${colors.border}`,
              cursor: "pointer",
              color: colors.text,
              fontSize: "0.85rem",
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div style={{ width: "1px", height: "24px", background: colors.border }} />

          {/* Doc icon + title */}
          {(() => {
            const Icon = getDocIcon(editingDoc.document_type);
            const iconColor = getDocColor(editingDoc.document_type);
            return (
              <>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    background: `${iconColor}20`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={16} color={iconColor} />
                </div>
                <span style={{ fontSize: "0.9rem", fontWeight: 600, color: colors.text, flex: 1 }}>
                  {editingDoc.title}
                </span>
              </>
            );
          })()}

          {/* Status badge */}
          {(() => {
            const badge = STATUS_BADGES[editingDoc.status] || STATUS_BADGES.draft;
            return (
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: "12px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  background: `${badge.color}20`,
                  color: badge.color,
                  border: `1px solid ${badge.color}40`,
                }}
              >
                {badge.label}
              </span>
            );
          })()}

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {[
              { icon: Share2, label: "Share", action: () => {} },
              { icon: History, label: "History", action: () => {} },
              { icon: Download, label: "Export", action: () => {} },
              { icon: ExternalLink, label: "Open in new tab", action: () => window.open(editorUrl, "_blank") },
            ].map(({ icon: BtnIcon, label, action }) => (
              <button
                key={label}
                onClick={action}
                title={label}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: colors.textMuted,
                  transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
                  e.currentTarget.style.color = colors.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = colors.textMuted;
                }}
              >
                <BtnIcon size={16} />
              </button>
            ))}
          </div>
        </div>

        {/* Editor iframe */}
        <iframe
          src={editorUrl}
          style={{
            flex: 1,
            width: "100%",
            border: "none",
            background: isDark ? "#1a1a2e" : "#fff",
          }}
          title={`Editing: ${editingDoc.title}`}
          allow="clipboard-read; clipboard-write"
        />
      </div>
    );
  }

  // ── Render: Document Browser ──

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        background: colors.background,
        fontFamily: "'Rubik', sans-serif",
        overflow: "hidden",
      }}
      onClick={() => setContextMenu(null)}
    >
      {/* Sidebar */}
      <aside style={sidebarStyle}>
        {/* Sidebar header */}
        <div style={{ padding: "16px 14px 8px", borderBottom: `1px solid ${colors.border}` }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: colors.text, margin: 0, marginBottom: "12px" }}>
            Documents
          </h2>

          {/* Quick actions */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
            <button
              onClick={() => setShowCreateDoc(true)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "8px",
                borderRadius: "8px",
                background: colors.accent,
                border: "none",
                cursor: "pointer",
                color: "#000",
                fontSize: "0.8rem",
                fontWeight: 600,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            >
              <Plus size={14} />
              New
            </button>
            <button
              onClick={() => setShowCreateFolder(true)}
              style={{
                width: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "8px",
                background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                border: `1px solid ${colors.border}`,
                cursor: "pointer",
                color: colors.textMuted,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}
              title="New folder"
            >
              <FolderPlus size={14} />
            </button>
          </div>
        </div>

        {/* Navigation sections */}
        <div style={{ padding: "8px 6px", flex: 1, overflowY: "auto" }}>
          {[
            { id: "all" as const, icon: FileText, label: "All Documents" },
            { id: "recent" as const, icon: Clock, label: "Recent" },
            { id: "favorites" as const, icon: Star, label: "Favorites" },
            { id: "shared" as const, icon: Users, label: "Shared with Me" },
            { id: "trash" as const, icon: Trash2, label: "Trash" },
          ].map(({ id, icon: NavIcon, label }) => (
            <button
              key={id}
              onClick={() => {
                setActiveSection(id);
                setSelectedFolderId(null);
              }}
              style={sidebarBtnStyle(activeSection === id && !selectedFolderId)}
              onMouseEnter={(e) => {
                if (activeSection !== id || selectedFolderId) {
                  e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeSection !== id || selectedFolderId) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <NavIcon size={16} />
              {label}
            </button>
          ))}

          {/* Folders */}
          {folders.length > 0 && (
            <div style={{ marginTop: "16px" }}>
              <div
                style={{
                  padding: "4px 14px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: colors.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Folders
              </div>
              {folders.map(folder => {
                const isActive = selectedFolderId === folder.id;
                return (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setSelectedFolderId(isActive ? null : folder.id);
                      setActiveSection("all");
                    }}
                    style={sidebarBtnStyle(isActive)}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {isActive ? <FolderOpen size={16} /> : <Folder size={16} />}
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {folder.name}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: colors.textMuted }}>{folder.document_count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Open Editor button at bottom */}
        <div style={{ padding: "8px 10px", borderTop: `1px solid ${colors.border}` }}>
          <button
            onClick={() => window.open(EDITOR_BASE_URL, "_blank")}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "10px",
              borderRadius: "8px",
              background: "transparent",
              border: `1px dashed ${colors.border}`,
              cursor: "pointer",
              color: colors.textMuted,
              fontSize: "0.82rem",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = colors.accent;
              e.currentTarget.style.color = colors.accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.border;
              e.currentTarget.style.color = colors.textMuted;
            }}
          >
            <Globe size={14} />
            Open LibreOffice
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "10px 16px",
            borderBottom: `1px solid ${colors.border}`,
            background: isDark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.6)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {/* Search */}
          <div
            style={{
              flex: 1,
              maxWidth: "400px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "7px 12px",
              borderRadius: "8px",
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              border: `1px solid ${colors.border}`,
            }}
          >
            <Search size={15} color={colors.textMuted} />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                border: "none",
                background: "none",
                outline: "none",
                color: colors.text,
                fontSize: "0.85rem",
                fontFamily: "'Rubik', sans-serif",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: colors.textMuted, display: "flex", padding: 0 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            style={{
              padding: "7px 10px",
              borderRadius: "8px",
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              border: `1px solid ${colors.border}`,
              color: colors.text,
              fontSize: "0.82rem",
              fontFamily: "'Rubik', sans-serif",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="updated">Last Modified</option>
            <option value="title">Title</option>
            <option value="created">Date Created</option>
          </select>

          {/* View toggle */}
          <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: `1px solid ${colors.border}` }}>
            {[
              { mode: "grid" as const, icon: Grid3X3 },
              { mode: "list" as const, icon: List },
            ].map(({ mode, icon: ViewIcon }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  width: "34px",
                  height: "34px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: viewMode === mode
                    ? (isDark ? "rgba(255,214,0,0.15)" : "rgba(59,130,246,0.12)")
                    : "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: viewMode === mode ? colors.accent : colors.textMuted,
                  transition: "background 0.15s",
                }}
              >
                <ViewIcon size={16} />
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={loadDocuments}
            style={{
              width: "34px",
              height: "34px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "8px",
              background: "transparent",
              border: `1px solid ${colors.border}`,
              cursor: "pointer",
              color: colors.textMuted,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = colors.text}
            onMouseLeave={(e) => e.currentTarget.style.color = colors.textMuted}
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
        </header>

        {/* Document area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px", gap: "10px", color: colors.textMuted }}>
              <Loader2 size={20} className="spin" style={{ animation: "spin 1s linear infinite" }} />
              Loading documents...
            </div>
          ) : error ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "200px", gap: "8px", color: colors.textMuted }}>
              <span>{error}</span>
              <button onClick={loadDocuments} style={{ padding: "6px 16px", borderRadius: "6px", background: colors.accent, color: "#000", border: "none", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>
                Retry
              </button>
            </div>
          ) : displayDocs.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "300px", gap: "12px" }}>
              <FileText size={48} color={colors.textMuted} style={{ opacity: 0.3 }} />
              <span style={{ color: colors.textMuted, fontSize: "0.9rem" }}>
                {searchQuery ? "No documents match your search" : "No documents yet"}
              </span>
              <button
                onClick={() => setShowCreateDoc(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 20px",
                  borderRadius: "8px",
                  background: colors.accent,
                  color: "#000",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              >
                <Plus size={16} />
                Create Document
              </button>
            </div>
          ) : viewMode === "grid" ? (
            /* ── Grid View ── */
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              {displayDocs.map(doc => {
                const Icon = getDocIcon(doc.document_type);
                const iconColor = getDocColor(doc.document_type);
                const badge = STATUS_BADGES[doc.status] || STATUS_BADGES.draft;
                return (
                  <div
                    key={doc.id}
                    onClick={() => openDocument(doc)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({ doc, x: e.clientX, y: e.clientY });
                    }}
                    style={{
                      borderRadius: "12px",
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
                      border: `1px solid ${colors.border}`,
                      cursor: "pointer",
                      transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
                      overflow: "hidden",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.borderColor = `${iconColor}60`;
                      e.currentTarget.style.boxShadow = `0 8px 24px ${isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.08)"}`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "none";
                      e.currentTarget.style.borderColor = colors.border;
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {/* Colored header strip */}
                    <div
                      style={{
                        height: "80px",
                        background: `linear-gradient(135deg, ${iconColor}15, ${iconColor}08)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                      }}
                    >
                      <Icon size={32} color={iconColor} style={{ opacity: 0.6 }} />
                      {/* Favorite star */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(doc);
                        }}
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          width: "26px",
                          height: "26px",
                          borderRadius: "6px",
                          background: doc.is_favorite ? `${colors.accent}20` : "rgba(0,0,0,0.2)",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: doc.is_favorite ? colors.accent : "rgba(255,255,255,0.6)",
                        }}
                      >
                        <Star size={13} fill={doc.is_favorite ? colors.accent : "none"} />
                      </button>
                      {/* Lock indicator */}
                      {doc.is_locked && (
                        <Lock
                          size={12}
                          style={{
                            position: "absolute",
                            top: "10px",
                            left: "10px",
                            color: "#f59e0b",
                          }}
                        />
                      )}
                    </div>

                    {/* Card body */}
                    <div style={{ padding: "12px" }}>
                      <div style={{ fontSize: "0.88rem", fontWeight: 600, color: colors.text, marginBottom: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {doc.title}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "10px",
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            background: `${badge.color}18`,
                            color: badge.color,
                          }}
                        >
                          {badge.label}
                        </span>
                        {doc.word_count > 0 && (
                          <span style={{ fontSize: "0.7rem", color: colors.textMuted }}>
                            {doc.word_count.toLocaleString()} words
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.72rem", color: colors.textMuted }}>
                          {timeAgo(doc.updated_at)}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <CrossLink
                            icon={MessageSquare}
                            label=""
                            to={`/messages?share_doc=${encodeURIComponent(doc.id)}&doc_title=${encodeURIComponent(doc.title)}`}
                            variant="icon-only"
                            color="#FFD600"
                            title="Share via Message"
                          />
                          {doc.share_count > 0 && (
                            <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "0.7rem", color: colors.textMuted }}>
                              <Users size={11} /> {doc.share_count}
                            </span>
                          )}
                          {doc.comment_count > 0 && (
                            <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "0.7rem", color: colors.textMuted }}>
                              <Edit3 size={11} /> {doc.comment_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── List View ── */
            <div
              style={{
                borderRadius: "12px",
                background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.6)",
                border: `1px solid ${colors.border}`,
                overflow: "hidden",
              }}
            >
              {/* List header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 100px 100px 40px",
                  padding: "10px 16px",
                  borderBottom: `1px solid ${colors.border}`,
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: colors.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <span>Name</span>
                <span>Status</span>
                <span>Modified</span>
                <span>Words</span>
                <span />
              </div>
              {displayDocs.map(doc => {
                const Icon = getDocIcon(doc.document_type);
                const iconColor = getDocColor(doc.document_type);
                const badge = STATUS_BADGES[doc.status] || STATUS_BADGES.draft;
                return (
                  <div
                    key={doc.id}
                    onClick={() => openDocument(doc)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({ doc, x: e.clientX, y: e.clientY });
                    }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 100px 100px 100px 40px",
                      padding: "10px 16px",
                      alignItems: "center",
                      borderBottom: `1px solid ${colors.border}20`,
                      cursor: "pointer",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                      <Icon size={18} color={iconColor} />
                      <span style={{ fontSize: "0.85rem", fontWeight: 500, color: colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {doc.title}
                      </span>
                      {doc.is_favorite && <Star size={12} color={colors.accent} fill={colors.accent} />}
                      {doc.is_locked && <Lock size={12} color="#f59e0b" />}
                    </div>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "10px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        background: `${badge.color}18`,
                        color: badge.color,
                        width: "fit-content",
                      }}
                    >
                      {badge.label}
                    </span>
                    <span style={{ fontSize: "0.78rem", color: colors.textMuted }}>{timeAgo(doc.updated_at)}</span>
                    <span style={{ fontSize: "0.78rem", color: colors.textMuted }}>{doc.word_count > 0 ? doc.word_count.toLocaleString() : "—"}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setContextMenu({ doc, x: rect.left, y: rect.bottom });
                      }}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: colors.textMuted,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ── Context Menu ── */}
      {contextMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            minWidth: "180px",
            background: isDark ? "rgba(30,30,40,0.95)" : "rgba(255,255,255,0.95)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: `1px solid ${colors.border}`,
            borderRadius: "10px",
            boxShadow: isDark ? "0 12px 40px rgba(0,0,0,0.5)" : "0 12px 40px rgba(0,0,0,0.15)",
            zIndex: 1000,
            overflow: "hidden",
            padding: "4px 0",
          }}
        >
          {[
            { icon: Eye, label: "Open", action: () => { openDocument(contextMenu.doc); setContextMenu(null); } },
            { icon: Edit3, label: "Rename", action: () => setContextMenu(null) },
            { icon: Star, label: contextMenu.doc.is_favorite ? "Unfavorite" : "Favorite", action: () => { toggleFavorite(contextMenu.doc); setContextMenu(null); } },
            { icon: Share2, label: "Share", action: () => setContextMenu(null) },
            { icon: Download, label: "Export", action: () => setContextMenu(null) },
            { icon: History, label: "Version History", action: () => setContextMenu(null) },
            null, // divider
            { icon: Trash2, label: "Delete", action: () => deleteDocument(contextMenu.doc), danger: true },
          ].map((item, i) =>
            item === null ? (
              <div key={`div-${i}`} style={{ height: "1px", background: colors.border, margin: "4px 0" }} />
            ) : (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "9px 14px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: (item as any).danger ? "#ef4444" : colors.text,
                  fontSize: "0.83rem",
                  textAlign: "left",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = (item as any).danger ? "rgba(239,68,68,0.1)" : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)")}
                onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                <item.icon size={15} />
                {item.label}
              </button>
            )
          )}
        </div>
      )}

      {/* ── Create Document Modal ── */}
      {showCreateDoc && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => setShowCreateDoc(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "420px",
              background: isDark ? "rgba(30,30,40,0.95)" : "rgba(255,255,255,0.97)",
              backdropFilter: "blur(24px)",
              border: `1px solid ${colors.border}`,
              borderRadius: "16px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
              padding: "24px",
            }}
          >
            <h3 style={{ margin: "0 0 20px", fontSize: "1.1rem", fontWeight: 700, color: colors.text }}>
              New Document
            </h3>

            <input
              type="text"
              placeholder="Document title"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createDocument();
                if (e.key === "Escape") setShowCreateDoc(false);
              }}
              autoFocus
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                border: `1px solid ${colors.border}`,
                color: colors.text,
                fontSize: "0.9rem",
                fontFamily: "'Rubik', sans-serif",
                outline: "none",
                marginBottom: "16px",
                boxSizing: "border-box",
              }}
            />

            {/* Type selector */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              {[
                { type: "document" as const, icon: FileText, label: "Document", color: "#3b82f6" },
                { type: "spreadsheet" as const, icon: FileSpreadsheet, label: "Spreadsheet", color: "#22c55e" },
                { type: "presentation" as const, icon: Presentation, label: "Slides", color: "#f59e0b" },
              ].map(({ type, icon: TypeIcon, label, color }) => (
                <button
                  key={type}
                  onClick={() => setNewDocType(type)}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                    padding: "14px 8px",
                    borderRadius: "10px",
                    background: newDocType === type ? `${color}15` : "transparent",
                    border: `2px solid ${newDocType === type ? color : colors.border}`,
                    cursor: "pointer",
                    color: newDocType === type ? color : colors.textMuted,
                    transition: "all 0.15s",
                  }}
                >
                  <TypeIcon size={22} />
                  <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>{label}</span>
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCreateDoc(false)}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  background: "transparent",
                  border: `1px solid ${colors.border}`,
                  cursor: "pointer",
                  color: colors.textMuted,
                  fontSize: "0.85rem",
                }}
              >
                Cancel
              </button>
              <button
                onClick={createDocument}
                disabled={!newDocTitle.trim()}
                style={{
                  padding: "9px 24px",
                  borderRadius: "8px",
                  background: newDocTitle.trim() ? colors.accent : `${colors.accent}40`,
                  border: "none",
                  cursor: newDocTitle.trim() ? "pointer" : "default",
                  color: "#000",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Folder Modal ── */}
      {showCreateFolder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => setShowCreateFolder(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "360px",
              background: isDark ? "rgba(30,30,40,0.95)" : "rgba(255,255,255,0.97)",
              backdropFilter: "blur(24px)",
              border: `1px solid ${colors.border}`,
              borderRadius: "16px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
              padding: "24px",
            }}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: "1.05rem", fontWeight: 700, color: colors.text }}>
              New Folder
            </h3>
            <input
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createFolder();
                if (e.key === "Escape") setShowCreateFolder(false);
              }}
              autoFocus
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                border: `1px solid ${colors.border}`,
                color: colors.text,
                fontSize: "0.9rem",
                fontFamily: "'Rubik', sans-serif",
                outline: "none",
                marginBottom: "16px",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCreateFolder(false)}
                style={{ padding: "9px 18px", borderRadius: "8px", background: "transparent", border: `1px solid ${colors.border}`, cursor: "pointer", color: colors.textMuted, fontSize: "0.85rem" }}
              >
                Cancel
              </button>
              <button
                onClick={createFolder}
                disabled={!newFolderName.trim()}
                style={{ padding: "9px 24px", borderRadius: "8px", background: newFolderName.trim() ? colors.accent : `${colors.accent}40`, border: "none", cursor: newFolderName.trim() ? "pointer" : "default", color: "#000", fontSize: "0.85rem", fontWeight: 600 }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spinner keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default DocumentsPage;
export { DocumentsPage };

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Check,
  Clock,
  ArrowLeft,
} from "lucide-react";
import {
  fetchWorkspaces,
  fetchFolders,
  fetchDocuments,
  searchDocuments,
  type Workspace,
  type Folder as FolderType,
  type Document,
} from "./api/documents";
import {
  MaterialType,
  MATERIAL_TYPES,
  MATERIAL_TYPE_LABELS,
  MATERIAL_TYPE_ICONS,
} from "./api/course-materials";

// ============================================================================
// Types
// ============================================================================

export interface DocumentPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (
    documentId: string,
    documentTitle: string,
    materialType: MaterialType
  ) => void;
  userId: string;
  excludeDocumentIds?: string[];
  defaultMaterialType?: MaterialType;
}

interface BreadcrumbItem {
  id: string;
  name: string;
  type: "root" | "workspace" | "folder";
}

// ============================================================================
// Component
// ============================================================================

export function DocumentPickerModal({
  isOpen,
  onClose,
  onSelect,
  userId,
  excludeDocumentIds = [],
  defaultMaterialType = "supplementary",
}: DocumentPickerModalProps) {
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";

  // State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Navigation state
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [currentFolder, setCurrentFolder] = useState<FolderType | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: "root", name: "Workspaces", type: "root" },
  ]);

  // Selection state
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedMaterialType, setSelectedMaterialType] = useState<MaterialType>(defaultMaterialType);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Document[]>([]);

  // Theme-aware colors
  const colors = useMemo(
    () => ({
      bg: isDark ? "rgba(17, 24, 39, 0.95)" : "rgba(255, 255, 255, 0.95)",
      surface: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
      surfaceHover: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)",
      border: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)",
      text: isDark ? "#fff" : "#111",
      textSecondary: isDark ? "rgba(255, 255, 255, 0.7)" : "#6b7280",
      accent: "#facc15",
    }),
    [isDark]
  );

  // Load workspaces on open
  useEffect(() => {
    if (isOpen) {
      loadWorkspaces();
      // Reset state
      setCurrentWorkspace(null);
      setCurrentFolder(null);
      setBreadcrumbs([{ id: "root", name: "Workspaces", type: "root" }]);
      setSelectedDocument(null);
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [isOpen, userId]);

  // Load workspaces
  const loadWorkspaces = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchWorkspaces();
      setWorkspaces(data);
    } catch (err) {
      setError("Failed to load workspaces");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Load folders for a workspace
  const loadFolders = useCallback(async (workspaceId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchFolders(workspaceId);
      setFolders(data);
    } catch (err) {
      setError("Failed to load folders");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load documents
  const loadDocuments = useCallback(
    async (workspaceId?: string, folderId?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchDocuments({
          workspaceId,
          folderId,
        });
        // Filter out already linked documents
        const filtered = data.filter(
          (doc) => !excludeDocumentIds.includes(doc.id)
        );
        setDocuments(filtered);
      } catch (err) {
        setError("Failed to load documents");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    [userId, excludeDocumentIds]
  );

  // Handle search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await searchDocuments(searchQuery, 20);
        // Filter out already linked documents
        const filtered = data.filter(
          (doc) => !excludeDocumentIds.includes(doc.id)
        );
        setSearchResults(filtered);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, userId, excludeDocumentIds]);

  // Navigate to workspace
  const handleWorkspaceClick = useCallback(
    async (workspace: Workspace) => {
      setCurrentWorkspace(workspace);
      setCurrentFolder(null);
      setBreadcrumbs([
        { id: "root", name: "Workspaces", type: "root" },
        { id: workspace.id, name: workspace.name, type: "workspace" },
      ]);
      await loadFolders(workspace.id);
      await loadDocuments(workspace.id);
    },
    [loadFolders, loadDocuments]
  );

  // Navigate to folder
  const handleFolderClick = useCallback(
    async (folder: FolderType) => {
      setCurrentFolder(folder);
      setBreadcrumbs((prev) => [
        ...prev,
        { id: folder.id, name: folder.name, type: "folder" },
      ]);
      await loadDocuments(currentWorkspace?.id, folder.id);
    },
    [currentWorkspace, loadDocuments]
  );

  // Navigate via breadcrumb
  const handleBreadcrumbClick = useCallback(
    async (item: BreadcrumbItem) => {
      if (item.type === "root") {
        setCurrentWorkspace(null);
        setCurrentFolder(null);
        setBreadcrumbs([{ id: "root", name: "Workspaces", type: "root" }]);
        setDocuments([]);
      } else if (item.type === "workspace") {
        const workspace = workspaces.find((w) => w.id === item.id);
        if (workspace) {
          setCurrentWorkspace(workspace);
          setCurrentFolder(null);
          setBreadcrumbs([
            { id: "root", name: "Workspaces", type: "root" },
            { id: workspace.id, name: workspace.name, type: "workspace" },
          ]);
          await loadFolders(workspace.id);
          await loadDocuments(workspace.id);
        }
      }
    },
    [workspaces, loadFolders, loadDocuments]
  );

  // Handle document selection
  const handleDocumentClick = useCallback((doc: Document) => {
    setSelectedDocument(doc);
  }, []);

  // Handle confirm selection
  const handleConfirm = useCallback(() => {
    if (selectedDocument) {
      onSelect(selectedDocument.id, selectedDocument.title, selectedMaterialType);
      onClose();
    }
  }, [selectedDocument, selectedMaterialType, onSelect, onClose]);

  // Render workspace list
  const renderWorkspaces = () => (
    <div className="space-y-2">
      {workspaces.map((workspace) => (
        <motion.button
          key={workspace.id}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => handleWorkspaceClick(workspace)}
          className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors"
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
          }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
            style={{ background: workspace.color || colors.accent }}
          >
            {workspace.icon === "folder" ? "📁" : workspace.icon}
          </div>
          <div className="flex-1 text-left">
            <div style={{ color: colors.text, fontWeight: 500 }}>
              {workspace.name}
            </div>
            {workspace.description && (
              <div className="text-sm" style={{ color: colors.textSecondary }}>
                {workspace.description}
              </div>
            )}
          </div>
          <ChevronRight size={20} style={{ color: colors.textSecondary }} />
        </motion.button>
      ))}
    </div>
  );

  // Render folders and documents
  const renderFoldersAndDocs = () => {
    const displayDocs = searchQuery ? searchResults : documents;
    const displayFolders = searchQuery
      ? []
      : folders.filter((f) =>
          currentFolder ? f.parentId === currentFolder.id : !f.parentId
        );

    return (
      <div className="space-y-2">
        {/* Folders */}
        {displayFolders.map((folder) => (
          <motion.button
            key={folder.id}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => handleFolderClick(folder)}
            className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors"
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
            }}
          >
            <FolderOpen size={20} style={{ color: folder.color || colors.accent }} />
            <div className="flex-1 text-left">
              <div style={{ color: colors.text }}>{folder.name}</div>
              <div className="text-xs" style={{ color: colors.textSecondary }}>
                {folder.documentCount} document{folder.documentCount !== 1 ? "s" : ""}
              </div>
            </div>
            <ChevronRight size={20} style={{ color: colors.textSecondary }} />
          </motion.button>
        ))}

        {/* Documents */}
        {displayDocs.map((doc) => (
          <motion.button
            key={doc.id}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => handleDocumentClick(doc)}
            className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors"
            style={{
              background:
                selectedDocument?.id === doc.id
                  ? `${colors.accent}22`
                  : colors.surface,
              border: `1px solid ${
                selectedDocument?.id === doc.id ? colors.accent : colors.border
              }`,
            }}
          >
            <FileText size={20} style={{ color: colors.accent }} />
            <div className="flex-1 text-left">
              <div style={{ color: colors.text }}>{doc.title}</div>
              <div className="flex items-center gap-2 text-xs" style={{ color: colors.textSecondary }}>
                <span>{doc.wordCount} words</span>
                <span>·</span>
                <Clock size={12} />
                <span>{doc.readingTimeMinutes} min read</span>
              </div>
            </div>
            {selectedDocument?.id === doc.id && (
              <Check size={20} style={{ color: colors.accent }} />
            )}
          </motion.button>
        ))}

        {/* Empty state */}
        {displayFolders.length === 0 && displayDocs.length === 0 && !isLoading && (
          <div
            className="text-center py-8"
            style={{ color: colors.textSecondary }}
          >
            {searchQuery ? "No documents found" : "No documents in this location"}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0, 0, 0, 0.6)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[80vh] rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-4"
            style={{ borderBottom: `1px solid ${colors.border}` }}
          >
            <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
              Select Document
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={20} style={{ color: colors.textSecondary }} />
            </button>
          </div>

          {/* Search */}
          <div className="p-4" style={{ borderBottom: `1px solid ${colors.border}` }}>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: colors.surface }}
            >
              <Search size={18} style={{ color: colors.textSecondary }} />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: colors.text }}
              />
              {isSearching && (
                <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>

          {/* Breadcrumbs */}
          {!searchQuery && (
            <div
              className="flex items-center gap-1 px-4 py-2 text-sm overflow-x-auto"
              style={{ borderBottom: `1px solid ${colors.border}` }}
            >
              {breadcrumbs.map((item, index) => (
                <React.Fragment key={item.id}>
                  {index > 0 && (
                    <ChevronRight
                      size={14}
                      style={{ color: colors.textSecondary, flexShrink: 0 }}
                    />
                  )}
                  <button
                    onClick={() => handleBreadcrumbClick(item)}
                    className="hover:underline whitespace-nowrap"
                    style={{
                      color:
                        index === breadcrumbs.length - 1
                          ? colors.text
                          : colors.textSecondary,
                    }}
                  >
                    {item.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-400">{error}</div>
            ) : !currentWorkspace && !searchQuery ? (
              renderWorkspaces()
            ) : (
              renderFoldersAndDocs()
            )}
          </div>

          {/* Material Type Selection */}
          {selectedDocument && (
            <div className="p-4" style={{ borderTop: `1px solid ${colors.border}` }}>
              <div className="mb-2 text-sm" style={{ color: colors.textSecondary }}>
                Material Type
              </div>
              <div className="flex flex-wrap gap-2">
                {MATERIAL_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedMaterialType(type)}
                    className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                    style={{
                      background:
                        selectedMaterialType === type
                          ? colors.accent
                          : colors.surface,
                      color:
                        selectedMaterialType === type
                          ? "#000"
                          : colors.text,
                      border: `1px solid ${
                        selectedMaterialType === type
                          ? colors.accent
                          : colors.border
                      }`,
                    }}
                  >
                    {MATERIAL_TYPE_ICONS[type]} {MATERIAL_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div
            className="flex items-center justify-between p-4"
            style={{ borderTop: `1px solid ${colors.border}` }}
          >
            <div style={{ color: colors.textSecondary }} className="text-sm">
              {selectedDocument
                ? `Selected: ${selectedDocument.title}`
                : "Select a document to add as course material"}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm transition-colors"
                style={{
                  background: colors.surface,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedDocument}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: colors.accent,
                  color: "#000",
                }}
              >
                Add Material
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default DocumentPickerModal;

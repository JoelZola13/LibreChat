import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Download,
  ExternalLink,
  Clock,
  ChevronDown,
  ChevronRight,
  Search,
  BookOpen,
} from "lucide-react";
import {
  type CourseMaterial,
  type MaterialType,
  getLessonMaterials,
  getModuleMaterials,
  getCourseMaterials,
  groupMaterialsByType,
  calculateTotalReadingTime,
  formatReadingTime,
  MATERIAL_TYPE_LABELS,
  MATERIAL_TYPE_ICONS,
  MATERIAL_TYPES,
} from "./api/course-materials";

// ============================================================================
// Types
// ============================================================================

export interface CourseMaterialsBrowserProps {
  entityType: "lesson" | "module" | "course";
  entityId: string;
  onViewDocument?: (documentId: string) => void;
  onDownloadDocument?: (documentId: string) => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function CourseMaterialsBrowser({
  entityType,
  entityId,
  onViewDocument,
  onDownloadDocument,
  className = "",
}: CourseMaterialsBrowserProps) {
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";

  // State
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTypes, setExpandedTypes] = useState<Set<MaterialType>>(
    new Set(MATERIAL_TYPES)
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Theme-aware colors
  const colors = useMemo(
    () => ({
      bg: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.02)",
      surface: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.8)",
      surfaceHover: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.95)",
      border: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.08)",
      text: isDark ? "#fff" : "#111",
      textSecondary: isDark ? "rgba(255, 255, 255, 0.7)" : "#6b7280",
      accent: "#facc15",
      glassShadow: isDark
        ? "0 4px 16px rgba(0, 0, 0, 0.2)"
        : "0 4px 16px rgba(0, 0, 0, 0.08)",
    }),
    [isDark]
  );

  // Load materials
  useEffect(() => {
    async function loadMaterials() {
      setIsLoading(true);
      setError(null);
      try {
        let data: CourseMaterial[];
        switch (entityType) {
          case "lesson":
            data = await getLessonMaterials(entityId);
            break;
          case "module":
            data = await getModuleMaterials(entityId);
            break;
          case "course":
            data = await getCourseMaterials(entityId);
            break;
          default:
            data = [];
        }
        setMaterials(data);
      } catch (err) {
        setError("Failed to load materials");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    if (entityId) {
      loadMaterials();
    }
  }, [entityType, entityId]);

  // Group materials by type
  const groupedMaterials = useMemo(() => {
    return groupMaterialsByType(materials);
  }, [materials]);

  // Filter materials by search query
  const filteredGroupedMaterials = useMemo(() => {
    if (!searchQuery.trim()) {
      return groupedMaterials;
    }

    const query = searchQuery.toLowerCase();
    const filtered: Record<MaterialType, CourseMaterial[]> = {
      syllabus: [],
      handout: [],
      reading: [],
      worksheet: [],
      reference: [],
      supplementary: [],
    };

    for (const type of MATERIAL_TYPES) {
      filtered[type] = groupedMaterials[type].filter((m) =>
        m.title.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [groupedMaterials, searchQuery]);

  // Total reading time
  const totalReadingTime = useMemo(() => {
    return calculateTotalReadingTime(materials);
  }, [materials]);

  // Toggle type expansion
  const toggleType = useCallback((type: MaterialType) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // Handle view document
  const handleView = useCallback(
    (documentId: string) => {
      if (onViewDocument) {
        onViewDocument(documentId);
      } else {
        // Default: open in new tab
        window.open(`/documents/${documentId}`, "_blank");
      }
    },
    [onViewDocument]
  );

  // Handle download document
  const handleDownload = useCallback(
    (documentId: string) => {
      if (onDownloadDocument) {
        onDownloadDocument(documentId);
      } else {
        // Default: trigger download
        window.open(`/api/documents/${documentId}/download`, "_blank");
      }
    },
    [onDownloadDocument]
  );

  // Check if any materials exist
  const hasMaterials = materials.length > 0;

  // Count materials matching search
  const matchCount = useMemo(() => {
    return MATERIAL_TYPES.reduce(
      (sum, type) => sum + filteredGroupedMaterials[type].length,
      0
    );
  }, [filteredGroupedMaterials]);

  if (isLoading) {
    return (
      <div
        className={`p-6 rounded-xl ${className}`}
        style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
      >
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`p-6 rounded-xl ${className}`}
        style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
      >
        <div className="text-center text-red-400 py-4">{error}</div>
      </div>
    );
  }

  if (!hasMaterials) {
    return (
      <div
        className={`p-6 rounded-xl ${className}`}
        style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
      >
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <BookOpen size={48} style={{ color: colors.textSecondary }} className="mb-4" />
          <div style={{ color: colors.textSecondary }}>
            No materials available for this {entityType}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        boxShadow: colors.glassShadow,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4"
        style={{ borderBottom: `1px solid ${colors.border}` }}
      >
        <div className="flex items-center gap-3">
          <BookOpen size={20} style={{ color: colors.accent }} />
          <div>
            <h3 className="font-semibold" style={{ color: colors.text }}>
              Course Materials
            </h3>
            <div className="text-sm" style={{ color: colors.textSecondary }}>
              {materials.length} material{materials.length !== 1 ? "s" : ""} ·{" "}
              {formatReadingTime(totalReadingTime)} total reading time
            </div>
          </div>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: colors.surface }}
        >
          <Search size={16} style={{ color: colors.textSecondary }} />
          <input
            type="text"
            placeholder="Search materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent outline-none text-sm w-40"
            style={{ color: colors.text }}
          />
        </div>
      </div>

      {/* Materials List */}
      <div className="p-4 space-y-3">
        {MATERIAL_TYPES.map((type) => {
          const typeMaterials = filteredGroupedMaterials[type];
          if (typeMaterials.length === 0) return null;

          const isExpanded = expandedTypes.has(type);

          return (
            <div
              key={type}
              className="rounded-lg overflow-hidden"
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
              }}
            >
              {/* Type Header */}
              <button
                onClick={() => toggleType(type)}
                className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{MATERIAL_TYPE_ICONS[type]}</span>
                  <span style={{ color: colors.text, fontWeight: 500 }}>
                    {MATERIAL_TYPE_LABELS[type]}
                  </span>
                  <span
                    className="text-sm px-2 py-0.5 rounded-full"
                    style={{
                      background: `${colors.accent}22`,
                      color: colors.accent,
                    }}
                  >
                    {typeMaterials.length}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronDown size={18} style={{ color: colors.textSecondary }} />
                ) : (
                  <ChevronRight size={18} style={{ color: colors.textSecondary }} />
                )}
              </button>

              {/* Materials in Type */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div
                      className="px-3 pb-3 space-y-2"
                      style={{ borderTop: `1px solid ${colors.border}` }}
                    >
                      <div className="pt-3">
                        {typeMaterials.map((material) => (
                          <div
                            key={material.linkId}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <FileText
                                size={18}
                                style={{ color: colors.accent, flexShrink: 0 }}
                              />
                              <div className="flex-1 min-w-0">
                                <div
                                  className="truncate"
                                  style={{ color: colors.text }}
                                >
                                  {material.title}
                                </div>
                                <div
                                  className="flex items-center gap-2 text-xs"
                                  style={{ color: colors.textSecondary }}
                                >
                                  <span>{material.wordCount} words</span>
                                  <span>·</span>
                                  <Clock size={10} />
                                  <span>
                                    {formatReadingTime(material.readingTimeMinutes)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleView(material.documentId)}
                                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                title="View document"
                              >
                                <ExternalLink
                                  size={16}
                                  style={{ color: colors.accent }}
                                />
                              </button>
                              <button
                                onClick={() => handleDownload(material.documentId)}
                                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                title="Download document"
                              >
                                <Download
                                  size={16}
                                  style={{ color: colors.textSecondary }}
                                />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* No matches for search */}
        {searchQuery && matchCount === 0 && (
          <div
            className="text-center py-6"
            style={{ color: colors.textSecondary }}
          >
            No materials match &quot;{searchQuery}&quot;
          </div>
        )}
      </div>
    </div>
  );
}

export default CourseMaterialsBrowser;

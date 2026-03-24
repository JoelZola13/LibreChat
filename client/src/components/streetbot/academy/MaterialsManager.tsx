import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  Plus,
  Trash2,
  GripVertical,
  FileText,
  Clock,
  ChevronDown,
  Save,
  AlertCircle,
} from "lucide-react";
import {
  type CourseMaterial,
  type MaterialType,
  type LinkDocumentRequest,
  getLessonMaterials,
  getModuleMaterials,
  getCourseMaterials,
  linkDocumentToLesson,
  linkDocumentToModule,
  linkDocumentToCourse,
  removeMaterialLink,
  reorderLessonMaterials,
  updateMaterialType,
  formatReadingTime,
  MATERIAL_TYPES,
  MATERIAL_TYPE_LABELS,
  MATERIAL_TYPE_ICONS,
} from "./api/course-materials";
import { DocumentPickerModal } from "./DocumentPickerModal";

// ============================================================================
// Types
// ============================================================================

export interface MaterialsManagerProps {
  entityType: "lesson" | "module" | "course";
  entityId: string;
  userId: string;
  onMaterialsChange?: (materials: CourseMaterial[]) => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function MaterialsManager({
  entityType,
  entityId,
  userId,
  onMaterialsChange,
  className = "",
}: MaterialsManagerProps) {
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";

  // State
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      danger: "#ef4444",
      glassShadow: isDark
        ? "0 4px 16px rgba(0, 0, 0, 0.2)"
        : "0 4px 16px rgba(0, 0, 0, 0.08)",
    }),
    [isDark]
  );

  // Load materials
  const loadMaterials = useCallback(async () => {
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
      onMaterialsChange?.(data);
    } catch (err) {
      setError("Failed to load materials");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [entityType, entityId, onMaterialsChange]);

  useEffect(() => {
    if (entityId) {
      loadMaterials();
    }
  }, [entityId, loadMaterials]);

  // Already linked document IDs
  const linkedDocumentIds = useMemo(() => {
    return materials.map((m) => m.documentId);
  }, [materials]);

  // Handle add document
  const handleAddDocument = useCallback(
    async (documentId: string, documentTitle: string, materialType: MaterialType) => {
      setIsSaving(true);
      try {
        const request: LinkDocumentRequest = {
          documentId,
          materialType,
          sortOrder: materials.length,
        };

        let result;
        switch (entityType) {
          case "lesson":
            result = await linkDocumentToLesson(entityId, request, userId);
            break;
          case "module":
            result = await linkDocumentToModule(entityId, request, userId);
            break;
          case "course":
            result = await linkDocumentToCourse(entityId, request, userId);
            break;
        }

        if (result?.success) {
          await loadMaterials();
        }
      } catch (err) {
        console.error("Failed to add material:", err);
        setError("Failed to add material");
      } finally {
        setIsSaving(false);
      }
    },
    [entityType, entityId, userId, materials.length, loadMaterials]
  );

  // Handle remove material
  const handleRemove = useCallback(
    async (linkId: string) => {
      setDeletingId(linkId);
      try {
        const result = await removeMaterialLink(linkId);
        if (result.success) {
          setMaterials((prev) => prev.filter((m) => m.linkId !== linkId));
          onMaterialsChange?.(materials.filter((m) => m.linkId !== linkId));
        }
      } catch (err) {
        console.error("Failed to remove material:", err);
        setError("Failed to remove material");
      } finally {
        setDeletingId(null);
      }
    },
    [materials, onMaterialsChange]
  );

  // Handle reorder
  const handleReorder = useCallback((newOrder: CourseMaterial[]) => {
    setMaterials(newOrder);
    setHasUnsavedChanges(true);
  }, []);

  // Save order
  const saveOrder = useCallback(async () => {
    if (entityType !== "lesson") {
      // Only lesson reordering is currently supported
      setHasUnsavedChanges(false);
      return;
    }

    setIsSaving(true);
    try {
      const linkIds = materials.map((m) => m.linkId);
      const result = await reorderLessonMaterials(entityId, linkIds);
      if (result.success) {
        setHasUnsavedChanges(false);
        onMaterialsChange?.(materials);
      }
    } catch (err) {
      console.error("Failed to save order:", err);
      setError("Failed to save order");
    } finally {
      setIsSaving(false);
    }
  }, [entityType, entityId, materials, onMaterialsChange]);

  // Handle material type change
  const handleTypeChange = useCallback(
    async (linkId: string, newType: MaterialType) => {
      try {
        const result = await updateMaterialType(linkId, newType);
        if (result.success) {
          setMaterials((prev) =>
            prev.map((m) =>
              m.linkId === linkId ? { ...m, materialType: newType } : m
            )
          );
        }
      } catch (err) {
        console.error("Failed to update material type:", err);
      }
    },
    []
  );

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

  return (
    <>
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
          <div>
            <h3 className="font-semibold" style={{ color: colors.text }}>
              Manage Materials
            </h3>
            <div className="text-sm" style={{ color: colors.textSecondary }}>
              {materials.length} material{materials.length !== 1 ? "s" : ""} linked
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <button
                onClick={saveOrder}
                disabled={isSaving}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: colors.accent,
                  color: "#000",
                }}
              >
                <Save size={16} />
                Save Order
              </button>
            )}
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: colors.surface,
                color: colors.text,
                border: `1px solid ${colors.border}`,
              }}
            >
              <Plus size={16} />
              Add Document
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="flex items-center gap-2 px-4 py-3 text-sm"
            style={{
              background: `${colors.danger}22`,
              color: colors.danger,
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <AlertCircle size={16} />
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-auto hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Materials List */}
        <div className="p-4">
          {materials.length === 0 ? (
            <div
              className="text-center py-8"
              style={{ color: colors.textSecondary }}
            >
              <FileText size={48} className="mx-auto mb-4 opacity-50" />
              <div>No materials linked yet</div>
              <div className="text-sm mt-2">
                Click &quot;Add Document&quot; to link documents as course materials
              </div>
            </div>
          ) : (
            <Reorder.Group
              axis="y"
              values={materials}
              onReorder={handleReorder}
              className="space-y-2"
            >
              {materials.map((material) => (
                <Reorder.Item
                  key={material.linkId}
                  value={material}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <motion.div
                    layout
                    className="flex items-center gap-3 p-3 rounded-lg group"
                    style={{
                      background: colors.surface,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    {/* Drag Handle */}
                    <GripVertical
                      size={18}
                      style={{ color: colors.textSecondary }}
                      className="cursor-grab"
                    />

                    {/* Document Info */}
                    <FileText size={18} style={{ color: colors.accent }} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate" style={{ color: colors.text }}>
                        {material.title}
                      </div>
                      <div
                        className="flex items-center gap-2 text-xs"
                        style={{ color: colors.textSecondary }}
                      >
                        <span>{material.wordCount} words</span>
                        <span>·</span>
                        <Clock size={10} />
                        <span>{formatReadingTime(material.readingTimeMinutes)}</span>
                      </div>
                    </div>

                    {/* Material Type Selector */}
                    <div className="relative">
                      <select
                        value={material.materialType}
                        onChange={(e) =>
                          handleTypeChange(material.linkId, e.target.value as MaterialType)
                        }
                        className="appearance-none px-3 py-1.5 pr-8 rounded-lg text-sm cursor-pointer outline-none"
                        style={{
                          background: colors.surfaceHover,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        {MATERIAL_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {MATERIAL_TYPE_ICONS[type]} {MATERIAL_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        style={{ color: colors.textSecondary }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                      />
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleRemove(material.linkId)}
                      disabled={deletingId === material.linkId}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
                      title="Remove material"
                    >
                      {deletingId === material.linkId ? (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 size={16} style={{ color: colors.danger }} />
                      )}
                    </button>
                  </motion.div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          )}
        </div>

        {/* Footer hint */}
        {materials.length > 1 && (
          <div
            className="px-4 py-3 text-xs text-center"
            style={{
              borderTop: `1px solid ${colors.border}`,
              color: colors.textSecondary,
            }}
          >
            Drag materials to reorder · Changes are saved automatically
          </div>
        )}
      </div>

      {/* Document Picker Modal */}
      <DocumentPickerModal
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleAddDocument}
        userId={userId}
        excludeDocumentIds={linkedDocumentIds}
      />
    </>
  );
}

export default MaterialsManager;

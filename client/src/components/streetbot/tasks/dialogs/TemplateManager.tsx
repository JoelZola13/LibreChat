"use client";

import React, { useMemo } from "react";
import { Zap, X, Trash2 } from "lucide-react";
import type { TaskTemplate } from "@/lib/api/tasks-advanced";
import type { PopoverColors } from "../popovers";

interface TemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
  templates: TaskTemplate[];
  colors: PopoverColors;
  onApplyTemplate: (template: TaskTemplate) => void;
  onDeleteTemplate: (templateId: string) => Promise<void>;
}

/**
 * Modal dialog for managing task templates
 */
export function TemplateManager({
  isOpen,
  onClose,
  templates,
  colors,
  onApplyTemplate,
  onDeleteTemplate,
}: TemplateManagerProps) {
  // Group templates by category
  const templatesByCategory = useMemo(() => {
    const grouped: Record<string, TaskTemplate[]> = {};
    templates.forEach((t) => {
      const cat = t.category || "Uncategorized";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(t);
    });
    return grouped;
  }, [templates]);

  const handleDelete = async (template: TaskTemplate) => {
    if (confirm(`Delete template "${template.name}"?`)) {
      await onDeleteTemplate(template.id);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(30,30,40,0.95)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "12px",
          width: "600px",
          maxWidth: "90vw",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Zap size={20} color={colors.accent} />
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#fff" }}>
              Manage Templates
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.5)",
              padding: "4px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {templates.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <Zap
                size={40}
                style={{ opacity: 0.3, color: colors.accent, marginBottom: "16px" }}
              />
              <p style={{ fontSize: "1rem", color: "#fff", margin: "0 0 8px 0" }}>
                No templates yet
              </p>
              <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", margin: 0 }}>
                Save tasks as templates using the task menu, then manage them here.
              </p>
            </div>
          ) : (
            Object.entries(templatesByCategory).map(
              ([category, categoryTemplates]) =>
                categoryTemplates.length > 0 && (
                  <div key={category} style={{ marginBottom: "20px" }}>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "rgba(255,255,255,0.5)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: "10px",
                        paddingBottom: "6px",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {category} ({categoryTemplates.length})
                    </div>
                    {categoryTemplates.map((template) => (
                      <TemplateItem
                        key={template.id}
                        template={template}
                        colors={colors}
                        onApply={onApplyTemplate}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )
            )
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateItem({
  template,
  colors,
  onApply,
  onDelete,
}: {
  template: TaskTemplate;
  colors: PopoverColors;
  onApply: (template: TaskTemplate) => void;
  onDelete: (template: TaskTemplate) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: "8px",
        marginBottom: "8px",
      }}
    >
      <Zap size={16} color={colors.accent} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "0.9rem", color: "#fff", fontWeight: 500 }}>
          {template.name}
        </div>
        {template.description && (
          <div
            style={{
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.5)",
              marginTop: "2px",
            }}
          >
            {template.description}
          </div>
        )}
        <div
          style={{
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.4)",
            marginTop: "4px",
          }}
        >
          Used {template.useCount} times
          {template.isGlobal && " • Global template"}
        </div>
      </div>
      <button
        onClick={() => onApply(template)}
        style={{
          padding: "6px 12px",
          background: `${colors.accent}20`,
          border: `1px solid ${colors.accent}40`,
          borderRadius: "6px",
          color: colors.accent,
          fontSize: "0.8rem",
          cursor: "pointer",
        }}
      >
        Use
      </button>
      <button
        onClick={() => onDelete(template)}
        style={{
          padding: "6px 10px",
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: "6px",
          color: "#ef4444",
          cursor: "pointer",
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

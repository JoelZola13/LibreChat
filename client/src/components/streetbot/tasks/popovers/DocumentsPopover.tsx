"use client";

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Plus, ExternalLink, X, Loader2 } from "lucide-react";
import { PopoverWrapper, PopoverColors, PopoverPosition } from "./PopoverWrapper";
import type { Document } from "@/lib/api/documents";

// Stub components - DocumentPicker and DocumentPreviewCard are not yet available
function DocumentPicker(_props: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (doc: Document) => void;
  userId: string;
  isDark: boolean;
  title?: string;
  subtitle?: string;
  showCreateNew?: boolean;
  onCreateNew?: () => void;
}) {
  if (!_props.isOpen) return null;
  return null;
}

function DocumentPreviewCard(_props: {
  document: Document;
  isDark: boolean;
  variant?: string;
  showActions?: boolean;
  className?: string;
}) {
  return (
    <div style={{ fontSize: "0.85rem" }}>{_props.document.title}</div>
  );
}

interface DocumentsPopoverProps {
  taskId: string;
  position: PopoverPosition;
  documents: Document[];
  colors: PopoverColors;
  isDark: boolean;
  loading: boolean;
  userId: string;
  onClose: () => void;
  onAttachDocument: (taskId: string, document: Document) => Promise<void>;
  onRemoveDocument: (taskId: string, documentId: string) => Promise<void>;
}

/**
 * Popover for viewing and attaching documents to tasks
 */
export function DocumentsPopover({
  taskId,
  position,
  documents,
  colors,
  isDark,
  loading,
  userId,
  onClose,
  onAttachDocument,
  onRemoveDocument,
}: DocumentsPopoverProps) {
  const navigate = useNavigate();
  const [showPicker, setShowPicker] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  const handleAttach = async (doc: Document) => {
    setIsAttaching(true);
    try {
      await onAttachDocument(taskId, doc);
      setShowPicker(false);
    } catch (err) {
      console.error("Failed to attach document:", err);
    } finally {
      setIsAttaching(false);
    }
  };

  const handleRemove = async (documentId: string) => {
    setIsRemoving(documentId);
    try {
      await onRemoveDocument(taskId, documentId);
    } catch (err) {
      console.error("Failed to remove document:", err);
    } finally {
      setIsRemoving(null);
    }
  };

  return (
    <>
      <PopoverWrapper
        position={position}
        onClose={onClose}
        colors={colors}
        isDark={isDark}
        width={360}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: `1px solid ${colors.border}` }}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: colors.accent }} />
            <span style={{ color: colors.text, fontWeight: 600, fontSize: "14px" }}>
              Attached Documents
            </span>
          </div>
          <button
            onClick={() => setShowPicker(true)}
            disabled={isAttaching}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors"
            style={{
              background: colors.accent,
              color: "#000",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {isAttaching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            Add
          </button>
        </div>

        {/* Documents List */}
        <div className="p-3 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: colors.textMuted }} />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText
                className="w-10 h-10 mx-auto mb-2"
                style={{ color: colors.textMuted, opacity: 0.5 }}
              />
              <p style={{ color: colors.textMuted, fontSize: "13px" }}>
                No documents attached
              </p>
              <button
                onClick={() => setShowPicker(true)}
                className="mt-3 text-sm transition-colors"
                style={{ color: colors.accent }}
              >
                Attach a document
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="group flex items-center gap-2 p-2 rounded-lg transition-colors"
                  style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}
                >
                  <DocumentPreviewCard
                    document={doc}
                    isDark={isDark}
                    variant="compact"
                    showActions={false}
                    className="flex-1"
                  />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => navigate(`/documents/${doc.id}`)}
                      className="p-1.5 rounded transition-colors"
                      style={{ color: colors.textMuted }}
                      title="Open document"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemove(doc.id)}
                      disabled={isRemoving === doc.id}
                      className="p-1.5 rounded transition-colors hover:bg-red-500/20"
                      style={{ color: "#ef4444" }}
                      title="Remove attachment"
                    >
                      {isRemoving === doc.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {documents.length > 0 && (
          <div
            className="px-4 py-2 text-center"
            style={{
              borderTop: `1px solid ${colors.border}`,
              color: colors.textMuted,
              fontSize: "11px",
            }}
          >
            Click a document to view it in the Documents app
          </div>
        )}
      </PopoverWrapper>

      {/* Document Picker Modal */}
      <DocumentPicker
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleAttach}
        userId={userId}
        isDark={isDark}
        title="Attach Document"
        subtitle="Choose a document to attach to this task"
        showCreateNew={true}
        onCreateNew={() => {
          navigate(`/documents/new?returnTo=/tasks`);
        }}
      />
    </>
  );
}

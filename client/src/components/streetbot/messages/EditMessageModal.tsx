"use client";

import React, { useCallback, useState, useRef, useEffect } from "react";
import { X, Edit3, Save } from "lucide-react";

interface EditMessageModalProps {
  messageId: number;
  currentContent: string;
  onClose: () => void;
  onSave: (messageId: number, newContent: string) => void;
  colors: {
    surface: string;
    surfaceHover: string;
    border: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    danger: string;
  };
}

export function EditMessageModal({
  messageId,
  currentContent,
  onClose,
  onSave,
  colors,
}: EditMessageModalProps) {
  const [content, setContent] = useState(currentContent);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const hasChanges = content !== currentContent;
  const canSave = content.trim().length > 0 && hasChanges;

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Focus textarea and select all on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
    }
  }, [content]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setIsSaving(true);
    await onSave(messageId, content.trim());
    setIsSaving(false);
    onClose();
  }, [canSave, content, messageId, onClose, onSave]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSave) {
        handleSave();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [canSave, handleSave, onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        ref={modalRef}
        style={{
          width: "500px",
          background: colors.surface,
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: `1px solid ${colors.border}`,
          borderRadius: "16px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px",
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Edit3 size={18} color={colors.accent} />
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: colors.text }}>
              Edit Message
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: colors.textSecondary,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "16px" }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter your message..."
            style={{
              width: "100%",
              minHeight: "100px",
              maxHeight: "300px",
              padding: "12px",
              borderRadius: "12px",
              border: `1px solid ${colors.border}`,
              background: colors.surfaceHover,
              color: colors.text,
              fontSize: "0.875rem",
              lineHeight: 1.5,
              resize: "none",
              outline: "none",
              fontFamily: "inherit",
            }}
          />

          {/* Character count and hints */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "8px",
              fontSize: "0.75rem",
              color: colors.textMuted,
            }}
          >
            <span>
              {hasChanges ? "Message has been modified" : "No changes made"}
            </span>
            <span>{content.length} characters</span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: `1px solid ${colors.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: colors.textMuted }}>
            Press <kbd style={{
              padding: "2px 6px",
              background: colors.surfaceHover,
              borderRadius: "4px",
              fontFamily: "monospace",
            }}>
              {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter
            </kbd> to save
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={onClose}
              style={{
                padding: "10px 16px",
                borderRadius: "8px",
                border: `1px solid ${colors.border}`,
                background: "transparent",
                color: colors.textSecondary,
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave || isSaving}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                background: canSave && !isSaving ? colors.accent : colors.surfaceHover,
                color: canSave && !isSaving ? "#000" : colors.textMuted,
                cursor: canSave && !isSaving ? "pointer" : "not-allowed",
                fontSize: "0.875rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Save size={16} />
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline edit component for editing in-place
interface InlineEditMessageProps {
  content: string;
  onSave: (newContent: string) => void;
  onCancel: () => void;
  colors: {
    surface: string;
    surfaceHover: string;
    border: string;
    text: string;
    textSecondary: string;
    accent: string;
  };
}

export function InlineEditMessage({
  content: initialContent,
  onSave,
  onCancel,
  colors,
}: InlineEditMessageProps) {
  const [content, setContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasChanges = content !== initialContent;
  const canSave = content.trim().length > 0 && hasChanges;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSave) {
        onSave(content.trim());
      }
    }
  };

  return (
    <div>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: "100%",
          padding: "8px 12px",
          borderRadius: "8px",
          border: `2px solid ${colors.accent}`,
          background: colors.surfaceHover,
          color: colors.text,
          fontSize: "0.875rem",
          lineHeight: 1.5,
          resize: "none",
          outline: "none",
          fontFamily: "inherit",
          minHeight: "60px",
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "8px",
        }}
      >
        <span style={{ fontSize: "0.75rem", color: colors.textSecondary }}>
          Press Escape to cancel, Enter to save
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: `1px solid ${colors.border}`,
              background: "transparent",
              color: colors.textSecondary,
              cursor: "pointer",
              fontSize: "0.75rem",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => canSave && onSave(content.trim())}
            disabled={!canSave}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
              background: canSave ? colors.accent : colors.surfaceHover,
              color: canSave ? "#000" : colors.textSecondary,
              cursor: canSave ? "pointer" : "not-allowed",
              fontSize: "0.75rem",
              fontWeight: 500,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditMessageModal;

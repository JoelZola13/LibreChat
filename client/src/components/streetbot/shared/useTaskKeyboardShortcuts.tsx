"use client";

import { useEffect, useCallback } from "react";

interface KeyboardShortcutsConfig {
  onNewTask?: () => void;
  onSearch?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onComplete?: () => void;
  onEscape?: () => void;
  onSelectAll?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onViewList?: () => void;
  onViewBoard?: () => void;
  onViewCalendar?: () => void;
  onNextTask?: () => void;
  onPrevTask?: () => void;
  onExpandTask?: () => void;
  onCollapseAll?: () => void;
  onRefresh?: () => void;
  onHelp?: () => void;
  enabled?: boolean;
}

export interface ShortcutInfo {
  key: string;
  description: string;
  modifiers?: string[];
}

export const SHORTCUTS: ShortcutInfo[] = [
  { key: "n", description: "New task" },
  { key: "/", description: "Search tasks" },
  { key: "e", description: "Edit selected task" },
  { key: "Delete", description: "Delete selected tasks" },
  { key: "c", description: "Mark complete/incomplete" },
  { key: "Escape", description: "Cancel / Clear selection" },
  { key: "a", description: "Select all tasks", modifiers: ["Ctrl/Cmd"] },
  { key: "z", description: "Undo", modifiers: ["Ctrl/Cmd"] },
  { key: "y", description: "Redo", modifiers: ["Ctrl/Cmd"] },
  { key: "1", description: "List view" },
  { key: "2", description: "Board view" },
  { key: "3", description: "Calendar view" },
  { key: "j", description: "Next task" },
  { key: "k", description: "Previous task" },
  { key: "x", description: "Expand/collapse task" },
  { key: "h", description: "Collapse all" },
  { key: "r", description: "Refresh", modifiers: ["Ctrl/Cmd"] },
  { key: "?", description: "Show shortcuts", modifiers: ["Shift"] },
];

export function useTaskKeyboardShortcuts(config: KeyboardShortcutsConfig) {
  const {
    onNewTask,
    onSearch,
    onDelete,
    onEdit,
    onComplete,
    onEscape,
    onSelectAll,
    onUndo,
    onRedo,
    onViewList,
    onViewBoard,
    onViewCalendar,
    onNextTask,
    onPrevTask,
    onExpandTask,
    onCollapseAll,
    onRefresh,
    onHelp,
    enabled = true,
  } = config;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if typing in an input/textarea
      const target = e.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Allow escape even in input fields
      if (e.key === "Escape" && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }

      // Don't trigger shortcuts when typing in inputs
      if (isInputField) return;

      const isMeta = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

      // Meta + key combinations
      if (isMeta) {
        switch (e.key.toLowerCase()) {
          case "a":
            if (onSelectAll) {
              e.preventDefault();
              onSelectAll();
            }
            break;
          case "z":
            if (!isShift && onUndo) {
              e.preventDefault();
              onUndo();
            } else if (isShift && onRedo) {
              e.preventDefault();
              onRedo();
            }
            break;
          case "y":
            if (onRedo) {
              e.preventDefault();
              onRedo();
            }
            break;
          case "r":
            if (onRefresh) {
              e.preventDefault();
              onRefresh();
            }
            break;
        }
        return;
      }

      // Shift + key combinations
      if (isShift && e.key === "?") {
        if (onHelp) {
          e.preventDefault();
          onHelp();
        }
        return;
      }

      // Single key shortcuts
      switch (e.key.toLowerCase()) {
        case "n":
          if (onNewTask) {
            e.preventDefault();
            onNewTask();
          }
          break;
        case "/":
          if (onSearch) {
            e.preventDefault();
            onSearch();
          }
          break;
        case "e":
          if (onEdit) {
            e.preventDefault();
            onEdit();
          }
          break;
        case "delete":
        case "backspace":
          if (onDelete) {
            e.preventDefault();
            onDelete();
          }
          break;
        case "c":
          if (onComplete) {
            e.preventDefault();
            onComplete();
          }
          break;
        case "1":
          if (onViewList) {
            e.preventDefault();
            onViewList();
          }
          break;
        case "2":
          if (onViewBoard) {
            e.preventDefault();
            onViewBoard();
          }
          break;
        case "3":
          if (onViewCalendar) {
            e.preventDefault();
            onViewCalendar();
          }
          break;
        case "j":
          if (onNextTask) {
            e.preventDefault();
            onNextTask();
          }
          break;
        case "k":
          if (onPrevTask) {
            e.preventDefault();
            onPrevTask();
          }
          break;
        case "x":
          if (onExpandTask) {
            e.preventDefault();
            onExpandTask();
          }
          break;
        case "h":
          if (onCollapseAll) {
            e.preventDefault();
            onCollapseAll();
          }
          break;
      }
    },
    [
      enabled,
      onNewTask,
      onSearch,
      onDelete,
      onEdit,
      onComplete,
      onEscape,
      onSelectAll,
      onUndo,
      onRedo,
      onViewList,
      onViewBoard,
      onViewCalendar,
      onNextTask,
      onPrevTask,
      onExpandTask,
      onCollapseAll,
      onRefresh,
      onHelp,
    ]
  );

  useEffect(() => {
    if (enabled) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [handleKeyDown, enabled]);
}

// Helper component to display shortcuts
export function KeyboardShortcutsHelp({
  isOpen,
  onClose,
  colors,
  isDark,
}: {
  isOpen: boolean;
  onClose: () => void;
  colors: {
    text: string;
    textMuted: string;
    surface: string;
    surfaceHover: string;
    border: string;
    accent: string;
  };
  isDark: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "480px",
          maxHeight: "600px",
          background: colors.surface,
          backdropFilter: "blur(24px)",
          border: `1px solid ${colors.border}`,
          borderRadius: "16px",
          boxShadow: isDark
            ? "0 24px 48px rgba(0,0,0,0.5)"
            : "0 24px 48px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: colors.text }}>
            Keyboard Shortcuts
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: colors.textMuted,
              padding: "4px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Shortcuts List */}
        <div style={{ padding: "16px 24px", overflowY: "auto", maxHeight: "500px" }}>
          <div style={{ display: "grid", gap: "8px" }}>
            {SHORTCUTS.map((shortcut, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                <span style={{ color: colors.text, fontSize: "0.9rem" }}>
                  {shortcut.description}
                </span>
                <div style={{ display: "flex", gap: "4px" }}>
                  {shortcut.modifiers?.map((mod, i) => (
                    <kbd
                      key={i}
                      style={{
                        padding: "4px 8px",
                        background: colors.surfaceHover,
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: colors.textMuted,
                        border: `1px solid ${colors.border}`,
                      }}
                    >
                      {mod}
                    </kbd>
                  ))}
                  <kbd
                    style={{
                      padding: "4px 10px",
                      background: colors.surfaceHover,
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: colors.text,
                      border: `1px solid ${colors.border}`,
                      minWidth: "32px",
                      textAlign: "center",
                    }}
                  >
                    {shortcut.key}
                  </kbd>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

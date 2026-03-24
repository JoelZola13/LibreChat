"use client";

import React from "react";
import { Trash2, X, Loader2, Flag, RefreshCw } from "lucide-react";
import type { Task } from "@/lib/api/tasks";
import type { PopoverColors } from "../popovers";

// Priority config matching the main page
const PRIORITIES = {
  urgent: { label: "Urgent", color: "#ef4444", flagColor: "#ef4444" },
  high: { label: "High", color: "#f97316", flagColor: "#f97316" },
  medium: { label: "Medium", color: "#eab308", flagColor: "#eab308" },
  low: { label: "Low", color: "#22c55e", flagColor: "#22c55e" },
  none: { label: "None", color: "#6b7280", flagColor: "#6b7280" },
};

interface TrashViewProps {
  isOpen: boolean;
  onClose: () => void;
  trashedTasks: Task[];
  loading: boolean;
  colors: PopoverColors;
  onRestore: (taskId: string) => Promise<void>;
  onPermanentDelete: (taskId: string) => Promise<void>;
  onEmptyTrash: () => Promise<void>;
}

/**
 * Modal dialog for viewing and managing trashed tasks
 */
export function TrashView({
  isOpen,
  onClose,
  trashedTasks,
  loading,
  colors,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
}: TrashViewProps) {
  if (!isOpen) return null;

  const handlePermanentDelete = async (taskId: string) => {
    if (confirm("Permanently delete this task? This cannot be undone.")) {
      await onPermanentDelete(taskId);
    }
  };

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
            <Trash2 size={20} color="#ef4444" />
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#fff" }}>
              Trash
            </h3>
            {trashedTasks.length > 0 && (
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: "10px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#ef4444",
                }}
              >
                {trashedTasks.length} items
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {trashedTasks.length > 0 && (
              <button
                onClick={onEmptyTrash}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#ef4444",
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Trash2 size={14} />
                Empty Trash
              </button>
            )}
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
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <Loader2
                size={24}
                style={{ color: colors.accent, animation: "spin 1s linear infinite" }}
              />
            </div>
          ) : trashedTasks.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <Trash2
                size={48}
                style={{ opacity: 0.3, color: colors.textMuted, marginBottom: "16px" }}
              />
              <p style={{ fontSize: "1rem", color: "#fff", margin: "0 0 8px 0" }}>
                Trash is empty
              </p>
              <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", margin: 0 }}>
                Deleted tasks will appear here for 30 days.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {trashedTasks.map((task) => (
                <TrashTaskItem
                  key={task.id}
                  task={task}
                  colors={colors}
                  onRestore={onRestore}
                  onPermanentDelete={handlePermanentDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer Info */}
        {trashedTasks.length > 0 && (
          <div
            style={{
              padding: "12px 24px",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.4)",
              textAlign: "center",
            }}
          >
            Items in trash will be permanently deleted after 30 days
          </div>
        )}
      </div>
    </div>
  );
}

function TrashTaskItem({
  task,
  colors,
  onRestore,
  onPermanentDelete,
}: {
  task: Task;
  colors: PopoverColors;
  onRestore: (taskId: string) => Promise<void>;
  onPermanentDelete: (taskId: string) => void;
}) {
  const priorityInfo = PRIORITIES[task.priority as keyof typeof PRIORITIES] || PRIORITIES.none;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* Priority Flag */}
      <Flag
        size={14}
        fill={task.priority !== "none" ? priorityInfo.flagColor : "transparent"}
        color={task.priority !== "none" ? priorityInfo.flagColor : colors.textMuted}
        style={{ opacity: task.priority === "none" ? 0.3 : 1, flexShrink: 0 }}
      />

      {/* Task Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "0.9rem",
            color: "#fff",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {task.title}
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.5)",
            marginTop: "4px",
          }}
        >
          Deleted {task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : "recently"}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        <button
          onClick={() => onRestore(task.id)}
          title="Restore task"
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            background: "rgba(34, 197, 94, 0.15)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            color: "#22c55e",
            fontSize: "0.75rem",
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <RefreshCw size={12} />
          Restore
        </button>
        <button
          onClick={() => onPermanentDelete(task.id)}
          title="Delete permanently"
          style={{
            padding: "6px 10px",
            borderRadius: "6px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            color: "#ef4444",
            fontSize: "0.75rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

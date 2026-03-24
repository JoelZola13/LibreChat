"use client";

import React, { ReactNode } from "react";
import { ChevronDown, ChevronRight, Plus, Settings } from "lucide-react";
import type { Task } from "@/lib/api/tasks";
import type { CustomField } from "@/lib/api/tasks-advanced";
import { TasksColorTheme } from "./constants";

interface StatusConfig {
  id: string;
  name: string;
  color: string;
  category?: string;
}

interface DragState {
  taskId: string;
  overStatus: string | null;
  overIndex: number;
  overPosition: "before" | "after";
}

interface StatusGroupProps {
  status: StatusConfig;
  tasks: Task[];
  isCollapsed: boolean;
  gridTemplate: string;
  customFields: CustomField[];
  colors: TasksColorTheme;
  dragState: DragState | null;
  onToggleCollapse: (statusId: string) => void;
  onDragOver: (e: React.DragEvent, statusId: string, index: number, position: "before" | "after") => void;
  onDrop: (e: React.DragEvent, statusId: string, index: number, position: "before" | "after") => void;
  onShowFieldManager: () => void;
  renderTaskRow: (task: Task, statusId: string, index: number) => ReactNode;
  renderAddTaskRow?: (statusId: string) => ReactNode;
}

/**
 * Status group component for task list view
 * Displays a collapsible section with header, column headers, and task rows
 */
export function StatusGroup({
  status,
  tasks,
  isCollapsed,
  gridTemplate,
  customFields,
  colors,
  dragState,
  onToggleCollapse,
  onDragOver,
  onDrop,
  onShowFieldManager,
  renderTaskRow,
  renderAddTaskRow,
}: StatusGroupProps) {
  const isDropTargetHeader = dragState && dragState.overStatus === status.id && dragState.overIndex === -1;
  const showEndDropZone = dragState && dragState.overStatus === status.id && dragState.overIndex === tasks.length;

  return (
    <div>
      {/* Status Header - droppable for moving tasks to this status */}
      <div
        onClick={() => onToggleCollapse(status.id)}
        onDragOver={(e) => {
          if (dragState) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            onDragOver(e, status.id, -1, "after");
          }
        }}
        onDrop={(e) => {
          if (dragState) {
            e.preventDefault();
            onDrop(e, status.id, tasks.length, "after");
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 16px",
          cursor: "pointer",
          userSelect: "none",
          background: isDropTargetHeader ? `${colors.accent}10` : "transparent",
          borderRadius: isDropTargetHeader ? "6px" : "0",
          border: isDropTargetHeader ? `1px dashed ${colors.accent}` : "1px solid transparent",
          transition: "all 0.15s",
        }}
      >
        <button
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            color: colors.textMuted,
          }}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Status Badge - Circle + Name */}
        <div
          style={{
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            border: `2px solid ${status.color}`,
            background: "transparent",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "0.85rem",
            fontWeight: 600,
            color: colors.text,
          }}
        >
          {status.name}
        </span>

        <span
          style={{
            fontSize: "0.8rem",
            color: colors.textMuted,
            fontWeight: 400,
          }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Column Headers */}
      {!isCollapsed && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: gridTemplate,
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            fontSize: "0.75rem",
            fontWeight: 500,
            color: colors.textMuted,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <span></span>
          <span>Name</span>
          <span style={{ textAlign: "center" }}>Assignee</span>
          <span style={{ textAlign: "center" }}>Due date</span>
          <span style={{ textAlign: "center" }}>Priority</span>
          {/* Custom Field Headers */}
          {customFields.map((field) => (
            <span key={field.id} style={{ textAlign: "center" }} title={field.name}>
              {field.name.length > 12 ? `${field.name.slice(0, 10)}...` : field.name}
            </span>
          ))}
          {/* Last column: Settings button to manage fields */}
          <span style={{ display: "flex", justifyContent: "center" }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShowFieldManager();
              }}
              title={customFields.length > 0 ? "Manage custom fields" : "Add custom fields"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "3px",
                padding: "4px 6px",
                background: "transparent",
                border: customFields.length === 0 ? `1px dashed ${colors.border}` : "none",
                borderRadius: "4px",
                color: colors.textMuted,
                fontSize: "0.7rem",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.surfaceHover;
                e.currentTarget.style.color = colors.accent;
                if (customFields.length === 0) {
                  e.currentTarget.style.borderColor = colors.accent;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = colors.textMuted;
                if (customFields.length === 0) {
                  e.currentTarget.style.borderColor = colors.border;
                }
              }}
            >
              {customFields.length === 0 ? (
                <>
                  <Plus size={10} />
                  Fields
                </>
              ) : (
                <Settings size={12} />
              )}
            </button>
          </span>
        </div>
      )}

      {/* Task Rows */}
      {!isCollapsed && (
        <>
          {tasks.map((task, index) => renderTaskRow(task, status.id, index))}

          {/* Drop zone at end of status group */}
          {dragState && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                onDragOver(e, status.id, tasks.length, "after");
              }}
              onDrop={(e) => onDrop(e, status.id, tasks.length, "after")}
              style={{
                height: showEndDropZone ? "40px" : "16px",
                background: showEndDropZone ? `${colors.accent}15` : "transparent",
                borderTop: showEndDropZone
                  ? `2px dashed ${colors.accent}`
                  : "2px dashed transparent",
                borderRadius: "4px",
                margin: "4px 16px",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {showEndDropZone && (
                <span style={{ fontSize: "0.75rem", color: colors.accent, fontWeight: 500 }}>
                  Drop here to add at end
                </span>
              )}
            </div>
          )}

          {/* Add Task Row */}
          {renderAddTaskRow && renderAddTaskRow(status.id)}
        </>
      )}
    </div>
  );
}

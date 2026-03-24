"use client";

import React, { useState, ReactNode } from "react";
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  CheckCheck,
  Lock,
  GitMerge,
  Plus,
  Tag,
  Edit3,
  Eye,
  MessageSquare,
  User,
  Calendar,
  Flag,
  MoreHorizontal,
} from "lucide-react";
import type { Task, Label } from "@/lib/api/tasks";
import { PRIORITIES, TasksColorTheme, formatDueDate, UserInfo } from "./constants";

interface TaskRowProps {
  task: Task;
  statusId: string;
  index: number;
  gridTemplate: string;
  colors: TasksColorTheme;
  labels: Label[];
  users: Record<string, UserInfo>;
  activeStatuses: { id: string; name: string; color: string }[];

  // State
  isEditing: boolean;
  editTaskTitle: string;
  isExpanded: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  dropPosition: "before" | "after" | null;
  isBlocked: boolean;
  dependencyCount: number;
  taskMenuOpen: boolean;

  // Callbacks
  onToggleComplete: (taskId: string) => void;
  onToggleExpand: (taskId: string) => void;
  onStartEdit: (task: Task) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditTitleChange: (value: string) => void;
  onStartAddSubtask: (taskId: string) => void;
  onOpenTagsPopover: (taskId: string, position: { top: number; left: number }) => void;
  onOpenAssigneePopover: (taskId: string, position: { top: number; left: number }) => void;
  onOpenDueDatePopover: (taskId: string, position: { top: number; left: number }) => void;
  onOpenPriorityPopover: (taskId: string, position: { top: number; left: number }) => void;
  onOpenCommentsPopover: (taskId: string, position: { top: number; left: number }) => void;
  onOpenDependencyPicker: (task: Task) => void;
  onToggleMenu: (taskId: string | null) => void;

  // Drag and drop
  onDragStart: (e: React.DragEvent, task: Task, statusId: string, index: number) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, statusId: string, index: number, position: "before" | "after") => void;
  onDrop: (e: React.DragEvent, statusId: string, index: number, position: "before" | "after") => void;

  // Optional: Render custom field cells
  renderCustomFields?: (task: Task) => ReactNode;

  // Optional: Render task menu
  renderTaskMenu?: (task: Task) => ReactNode;

  // Optional: Render subtasks
  renderSubtasks?: (task: Task) => ReactNode;
}

/**
 * Task row component for list view
 * Displays a single task with all its properties and actions
 */
export function TaskRow({
  task,
  statusId,
  index,
  gridTemplate,
  colors,
  labels,
  users,
  activeStatuses,
  isEditing,
  editTaskTitle,
  isExpanded,
  isDragging,
  isDropTarget,
  dropPosition,
  isBlocked,
  dependencyCount,
  taskMenuOpen,
  onToggleComplete,
  onToggleExpand,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditTitleChange,
  onStartAddSubtask,
  onOpenTagsPopover,
  onOpenAssigneePopover,
  onOpenDueDatePopover,
  onOpenPriorityPopover,
  onOpenCommentsPopover,
  onOpenDependencyPicker,
  onToggleMenu,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  renderCustomFields,
  renderTaskMenu,
  renderSubtasks,
}: TaskRowProps) {
  const isDone = task.status === "done";
  const dueInfo = formatDueDate(task.dueAt);
  const priorityInfo = PRIORITIES[task.priority as keyof typeof PRIORITIES] || PRIORITIES.none;
  const statusInfo = activeStatuses.find((s) => s.id === task.status);
  const showDropBefore = isDropTarget && dropPosition === "before";
  const showDropAfter = isDropTarget && dropPosition === "after";

  const handleDragOver = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? "before" : "after";
    onDragOver(e, statusId, index, position);
  };

  const handleDrop = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? "before" : "after";
    onDrop(e, statusId, index, position);
  };

  return (
    <div key={task.id}>
      <div
        className="task-row"
        draggable
        onDragStart={(e) => onDragStart(e, task, statusId, index)}
        onDragEnd={onDragEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          display: "grid",
          gridTemplateColumns: gridTemplate,
          alignItems: "center",
          gap: "8px",
          padding: "8px 16px",
          transition: "background 0.1s, opacity 0.15s, border-color 0.15s",
          background: "transparent",
          position: "relative",
          opacity: isDragging ? 0.5 : 1,
          cursor: "grab",
          borderTop: showDropBefore ? `2px solid ${colors.accent}` : "2px solid transparent",
          borderBottom: showDropAfter ? `2px solid ${colors.accent}` : "2px solid transparent",
          marginTop: showDropBefore ? "-2px" : "0",
          marginBottom: showDropAfter ? "-2px" : "0",
        }}
        onMouseEnter={(e) => {
          if (!isDragging) {
            e.currentTarget.style.background = colors.rowHover;
          }
          const actions = e.currentTarget.querySelector(".task-hover-actions") as HTMLElement;
          if (actions) actions.style.opacity = "1";
          const dragHandle = e.currentTarget.querySelector(".drag-handle") as HTMLElement;
          if (dragHandle) dragHandle.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          const actions = e.currentTarget.querySelector(".task-hover-actions") as HTMLElement;
          if (actions) actions.style.opacity = "0";
          const dragHandle = e.currentTarget.querySelector(".drag-handle") as HTMLElement;
          if (dragHandle) dragHandle.style.opacity = "0";
        }}
      >
        {/* Drag Handle + Expand/Collapse + Checkbox */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "2px" }}>
          <DragHandle colors={colors} />
          <ExpandButton
            task={task}
            isExpanded={isExpanded}
            colors={colors}
            onToggle={onToggleExpand}
          />
          <CompletionCheckbox
            task={task}
            isDone={isDone}
            statusColor={statusInfo?.color}
            colors={colors}
            onToggle={onToggleComplete}
          />
        </div>

        {/* Task Name + Hover Actions */}
        <TaskNameCell
          task={task}
          isEditing={isEditing}
          editTaskTitle={editTaskTitle}
          isDone={isDone}
          isBlocked={isBlocked}
          dependencyCount={dependencyCount}
          labels={labels}
          colors={colors}
          onStartEdit={onStartEdit}
          onSaveEdit={onSaveEdit}
          onCancelEdit={onCancelEdit}
          onEditTitleChange={onEditTitleChange}
          onStartAddSubtask={onStartAddSubtask}
          onOpenTagsPopover={onOpenTagsPopover}
          onOpenCommentsPopover={onOpenCommentsPopover}
          onOpenDependencyPicker={onOpenDependencyPicker}
        />

        {/* Assignee Cell */}
        <AssigneeCell
          task={task}
          users={users}
          colors={colors}
          onOpen={onOpenAssigneePopover}
        />

        {/* Due Date Cell */}
        <DueDateCell
          task={task}
          dueInfo={dueInfo}
          colors={colors}
          onOpen={onOpenDueDatePopover}
        />

        {/* Priority Cell */}
        <PriorityCell
          task={task}
          priorityInfo={priorityInfo}
          colors={colors}
          onOpen={onOpenPriorityPopover}
        />

        {/* Custom Field Cells */}
        {renderCustomFields && renderCustomFields(task)}

        {/* More Menu */}
        <MoreMenu
          task={task}
          isOpen={taskMenuOpen}
          colors={colors}
          onToggle={onToggleMenu}
          renderMenu={renderTaskMenu}
        />
      </div>

      {/* Subtasks section */}
      {isExpanded && renderSubtasks && renderSubtasks(task)}
    </div>
  );
}

// Sub-components

function DragHandle({ colors }: { colors: TasksColorTheme }) {
  return (
    <div
      className="drag-handle"
      style={{
        opacity: 0,
        transition: "opacity 0.15s",
        cursor: "grab",
        display: "flex",
        alignItems: "center",
        padding: "2px",
        marginRight: "2px",
      }}
    >
      <GripVertical size={12} color={colors.textMuted} />
    </div>
  );
}

function ExpandButton({
  task,
  isExpanded,
  colors,
  onToggle,
}: {
  task: Task;
  isExpanded: boolean;
  colors: TasksColorTheme;
  onToggle: (taskId: string) => void;
}) {
  if (task.subtaskCount === 0) {
    return <div style={{ width: "16px" }} />;
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle(task.id);
      }}
      style={{
        width: "16px",
        height: "16px",
        borderRadius: "2px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        color: colors.textMuted,
      }}
    >
      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
    </button>
  );
}

function CompletionCheckbox({
  task,
  isDone,
  statusColor,
  colors,
  onToggle,
}: {
  task: Task;
  isDone: boolean;
  statusColor?: string;
  colors: TasksColorTheme;
  onToggle: (taskId: string) => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle(task.id);
      }}
      style={{
        width: "18px",
        height: "18px",
        borderRadius: "50%",
        border: isDone ? "none" : `2px solid ${statusColor || colors.border}`,
        background: isDone ? colors.success : "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        transition: "all 0.15s",
      }}
    >
      {isDone && <CheckCheck size={10} color="#fff" />}
    </button>
  );
}

function TaskNameCell({
  task,
  isEditing,
  editTaskTitle,
  isDone,
  isBlocked,
  dependencyCount,
  labels,
  colors,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditTitleChange,
  onStartAddSubtask,
  onOpenTagsPopover,
  onOpenCommentsPopover,
  onOpenDependencyPicker,
}: {
  task: Task;
  isEditing: boolean;
  editTaskTitle: string;
  isDone: boolean;
  isBlocked: boolean;
  dependencyCount: number;
  labels: Label[];
  colors: TasksColorTheme;
  onStartEdit: (task: Task) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditTitleChange: (value: string) => void;
  onStartAddSubtask: (taskId: string) => void;
  onOpenTagsPopover: (taskId: string, position: { top: number; left: number }) => void;
  onOpenCommentsPopover: (taskId: string, position: { top: number; left: number }) => void;
  onOpenDependencyPicker: (task: Task) => void;
}) {
  return (
    <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: "8px", position: "relative" }}>
      {isEditing ? (
        <input
          type="text"
          value={editTaskTitle}
          onChange={(e) => onEditTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSaveEdit();
            if (e.key === "Escape") onCancelEdit();
          }}
          onBlur={onSaveEdit}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            padding: "4px 8px",
            fontSize: "0.9rem",
            background: colors.surface,
            border: `1px solid ${colors.accent}`,
            borderRadius: "4px",
            color: colors.text,
            outline: "none",
          }}
        />
      ) : (
        <>
          <span
            onDoubleClick={(e) => {
              e.stopPropagation();
              onStartEdit(task);
            }}
            style={{
              fontSize: "0.9rem",
              color: isDone ? colors.textMuted : colors.text,
              textDecoration: isDone ? "line-through" : "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {task.title}
          </span>

          {/* Blocked Indicator */}
          {isBlocked && (
            <div
              title="This task is blocked by dependencies"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 6px",
                borderRadius: "4px",
                background: "rgba(239, 68, 68, 0.15)",
                marginLeft: "8px",
                flexShrink: 0,
              }}
            >
              <Lock size={10} color="#ef4444" />
              <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#ef4444" }}>
                BLOCKED
              </span>
            </div>
          )}

          {/* Dependencies Indicator */}
          {dependencyCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenDependencyPicker(task);
              }}
              title={`${dependencyCount} dependencies`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "3px",
                padding: "2px 6px",
                borderRadius: "4px",
                background: "rgba(99, 102, 241, 0.15)",
                border: "none",
                cursor: "pointer",
                marginLeft: "6px",
                flexShrink: 0,
              }}
            >
              <GitMerge size={10} color="#6366f1" />
              <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#6366f1" }}>
                {dependencyCount}
              </span>
            </button>
          )}

          {/* Task Labels */}
          {task.labels.length > 0 && (
            <div style={{ display: "flex", gap: "4px", flexShrink: 0, marginLeft: "8px" }}>
              {task.labels.slice(0, 3).map((labelId) => {
                const label = labels.find((l) => l.id === labelId);
                if (!label) return null;
                return (
                  <span
                    key={labelId}
                    title={label.name}
                    style={{
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: `${label.color}20`,
                      color: label.color,
                      fontSize: "0.7rem",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label.name}
                  </span>
                );
              })}
              {task.labels.length > 3 && (
                <span style={{ fontSize: "0.7rem", color: colors.textMuted }}>
                  +{task.labels.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Hover Action Buttons */}
          <HoverActions
            task={task}
            colors={colors}
            onStartAddSubtask={onStartAddSubtask}
            onOpenTagsPopover={onOpenTagsPopover}
            onStartEdit={onStartEdit}
            onOpenCommentsPopover={onOpenCommentsPopover}
          />
        </>
      )}

      {/* Comment count */}
      {!isEditing && task.commentCount > 0 && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            onOpenCommentsPopover(task.id, { top: rect.bottom + 4, left: rect.left - 200 });
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            color: colors.textMuted,
            fontSize: "0.75rem",
            flexShrink: 0,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = colors.accent)}
          onMouseLeave={(e) => (e.currentTarget.style.color = colors.textMuted)}
        >
          <MessageSquare size={12} />
          {task.commentCount}
        </span>
      )}
    </div>
  );
}

function HoverActions({
  task,
  colors,
  onStartAddSubtask,
  onOpenTagsPopover,
  onStartEdit,
  onOpenCommentsPopover,
}: {
  task: Task;
  colors: TasksColorTheme;
  onStartAddSubtask: (taskId: string) => void;
  onOpenTagsPopover: (taskId: string, position: { top: number; left: number }) => void;
  onStartEdit: (task: Task) => void;
  onOpenCommentsPopover: (taskId: string, position: { top: number; left: number }) => void;
}) {
  const buttonStyle = {
    padding: "4px 8px",
    borderRadius: "4px",
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    color: colors.textSecondary,
    fontSize: "0.7rem",
    fontWeight: 500,
    whiteSpace: "nowrap" as const,
  };

  return (
    <div
      className="task-hover-actions"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "2px",
        marginLeft: "auto",
        opacity: 0,
        transition: "opacity 0.15s",
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onStartAddSubtask(task.id);
        }}
        title="Add subtask"
        style={buttonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = colors.surfaceHover;
          e.currentTarget.style.borderColor = colors.accent;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = colors.surface;
          e.currentTarget.style.borderColor = colors.border;
        }}
      >
        <Plus size={12} />
        Add subtask
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          onOpenTagsPopover(task.id, { top: rect.bottom + 4, left: rect.left });
        }}
        title="Edit tags"
        style={buttonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = colors.surfaceHover;
          e.currentTarget.style.borderColor = colors.accent;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = colors.surface;
          e.currentTarget.style.borderColor = colors.border;
        }}
      >
        <Tag size={12} />
        Edit tags
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onStartEdit(task);
        }}
        title="Rename"
        style={buttonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = colors.surfaceHover;
          e.currentTarget.style.borderColor = colors.accent;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = colors.surface;
          e.currentTarget.style.borderColor = colors.border;
        }}
      >
        <Edit3 size={12} />
        Rename
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "2px", marginLeft: "4px" }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStartEdit(task);
          }}
          title="Open task"
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "4px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.textMuted,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <Eye size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            onOpenCommentsPopover(task.id, { top: rect.bottom + 4, left: rect.left - 200 });
          }}
          title="Add comment"
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "4px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.textMuted,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <MessageSquare size={14} />
        </button>
      </div>
    </div>
  );
}

function AssigneeCell({
  task,
  users,
  colors,
  onOpen,
}: {
  task: Task;
  users: Record<string, UserInfo>;
  colors: TasksColorTheme;
  onOpen: (taskId: string, position: { top: number; left: number }) => void;
}) {
  return (
    <div
      style={{ display: "flex", justifyContent: "center", position: "relative" }}
      onClick={(e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        onOpen(task.id, { top: rect.bottom + 4, left: rect.left });
      }}
    >
      <div
        style={{
          padding: "4px 8px",
          borderRadius: "4px",
          cursor: "pointer",
          transition: "background 0.15s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {task.assignees.length > 0 ? (
          <div style={{ display: "flex" }}>
            {task.assignees.slice(0, 2).map((assignee, i) => {
              const user = users[assignee];
              return (
                <div
                  key={assignee}
                  title={user?.name || assignee}
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "50%",
                    background: user?.avatar || "#6b7280",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    marginLeft: i > 0 ? "-8px" : 0,
                    border: `2px solid ${colors.headerBg}`,
                    zIndex: 2 - i,
                  }}
                >
                  {user?.initials || assignee.charAt(0).toUpperCase()}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "50%",
              border: `2px dashed ${colors.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: colors.textMuted,
            }}
          >
            <User size={12} />
          </div>
        )}
      </div>
    </div>
  );
}

function DueDateCell({
  task,
  dueInfo,
  colors,
  onOpen,
}: {
  task: Task;
  dueInfo: { text: string; color: string } | null;
  colors: TasksColorTheme;
  onOpen: (taskId: string, position: { top: number; left: number }) => void;
}) {
  return (
    <div
      style={{ display: "flex", justifyContent: "center", position: "relative" }}
      onClick={(e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        onOpen(task.id, { top: rect.bottom + 4, left: rect.left - 100 });
      }}
    >
      <div
        style={{
          padding: "4px 8px",
          borderRadius: "4px",
          cursor: "pointer",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {dueInfo ? (
          <span style={{ fontSize: "0.8rem", color: dueInfo.color, fontWeight: 500 }}>
            {dueInfo.text}
          </span>
        ) : (
          <Calendar size={14} color={colors.textMuted} style={{ opacity: 0.5 }} />
        )}
      </div>
    </div>
  );
}

function PriorityCell({
  task,
  priorityInfo,
  colors,
  onOpen,
}: {
  task: Task;
  priorityInfo: { label: string; color: string; flagColor: string };
  colors: TasksColorTheme;
  onOpen: (taskId: string, position: { top: number; left: number }) => void;
}) {
  return (
    <div
      style={{ display: "flex", justifyContent: "center", position: "relative" }}
      onClick={(e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        onOpen(task.id, { top: rect.bottom + 4, left: rect.left - 60 });
      }}
    >
      <div
        style={{
          padding: "4px 8px",
          borderRadius: "4px",
          cursor: "pointer",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {task.priority !== "none" ? (
          <Flag size={14} fill={priorityInfo.flagColor} color={priorityInfo.flagColor} />
        ) : (
          <Flag size={14} color={colors.textMuted} style={{ opacity: 0.3 }} />
        )}
      </div>
    </div>
  );
}

function MoreMenu({
  task,
  isOpen,
  colors,
  onToggle,
  renderMenu,
}: {
  task: Task;
  isOpen: boolean;
  colors: TasksColorTheme;
  onToggle: (taskId: string | null) => void;
  renderMenu?: (task: Task) => ReactNode;
}) {
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(isOpen ? null : task.id);
        }}
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "4px",
          border: "none",
          background: isOpen ? colors.surfaceHover : "transparent",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.textMuted,
          opacity: isOpen ? 1 : 0.5,
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.opacity = "0.5";
        }}
      >
        <MoreHorizontal size={16} />
      </button>

      {isOpen && renderMenu && renderMenu(task)}
    </div>
  );
}

"use client";

import React, { useState, useCallback } from "react";
import {
  CheckCheck,
  Flag,
  Calendar,
  User,
  MessageSquare,
  Plus,
  MoreHorizontal,
  GripVertical,
} from "lucide-react";
import { Task, updateTask } from "@/lib/api/tasks";

interface BoardViewProps {
  tasks: Task[];
  statuses: { id: string; name: string; color: string; category?: string }[];
  labels?: { id: string; name: string; color: string }[];
  users: Record<string, { name: string; avatar: string; initials: string }>;
  userId?: string;
  onTaskUpdate?: (task: Task) => void;
  onTaskCreate?: (statusId: string, title?: string) => void;
  onTaskClick: (task: Task) => void;
  onStatusChange?: (taskId: string, newStatus: string) => void;
  selectedTaskIds?: Set<string>;
  onSelectTask?: (taskId: string, selected: boolean) => void;
}

// Default colors for the board view
const DEFAULT_COLORS = {
  text: "#e5e5e5",
  textSecondary: "#a3a3a3",
  textMuted: "#737373",
  surface: "rgba(38, 38, 38, 0.8)",
  surfaceHover: "rgba(64, 64, 64, 0.8)",
  border: "rgba(82, 82, 82, 0.5)",
  accent: "#FFD700",
  success: "#22c55e",
};

interface DragState {
  taskId: string | null;
  sourceStatus: string | null;
  overStatus: string | null;
}

const PRIORITIES: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "#ef4444" },
  high: { label: "High", color: "#f97316" },
  medium: { label: "Medium", color: "#eab308" },
  low: { label: "Low", color: "#22c55e" },
  none: { label: "None", color: "#6b7280" },
};

export function BoardView({
  tasks,
  statuses,
  labels = [],
  users,
  userId = "",
  onTaskUpdate,
  onTaskCreate,
  onTaskClick,
  onStatusChange,
  selectedTaskIds = new Set(),
  onSelectTask,
}: BoardViewProps) {
  const colors = DEFAULT_COLORS;
  const isDark = true; // Default to dark mode styling
  const [dragState, setDragState] = useState<DragState>({
    taskId: null,
    sourceStatus: null,
    overStatus: null,
  });
  const [addingInColumn, setAddingInColumn] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  // Group tasks by status
  const tasksByStatus: Record<string, Task[]> = {};
  statuses.forEach((s) => {
    tasksByStatus[s.id] = [];
  });
  tasks.forEach((task) => {
    if (!task.parentTaskId) {
      if (tasksByStatus[task.status]) {
        tasksByStatus[task.status].push(task);
      } else if (statuses.length > 0) {
        tasksByStatus[statuses[0].id]?.push(task);
      }
    }
  });

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
    setDragState({
      taskId: task.id,
      sourceStatus: task.status,
      overStatus: null,
    });
  };

  const handleDragOver = (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragState.overStatus !== statusId) {
      setDragState((prev) => ({ ...prev, overStatus: statusId }));
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the column entirely
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget?.closest('[data-column]')) {
      setDragState((prev) => ({ ...prev, overStatus: null }));
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    const task = tasks.find((t) => t.id === taskId);

    if (task && task.status !== targetStatus) {
      // Use onStatusChange if provided (parent handles the update)
      if (onStatusChange) {
        onStatusChange(taskId, targetStatus);
      } else if (onTaskUpdate) {
        // Fall back to direct API update
        try {
          const completedAt = targetStatus === "done" ? new Date().toISOString() : undefined;
          await updateTask(taskId, userId, {
            status: targetStatus,
            completed_at: completedAt,
          });
          onTaskUpdate({
            ...task,
            status: targetStatus,
            completedAt,
          });
        } catch (err) {
          console.error("Failed to update task status:", err);
        }
      }
    }

    setDragState({ taskId: null, sourceStatus: null, overStatus: null });
  };

  const handleDragEnd = () => {
    setDragState({ taskId: null, sourceStatus: null, overStatus: null });
  };

  const handleAddTask = async (statusId: string) => {
    if (!newTaskTitle.trim()) {
      setAddingInColumn(null);
      return;
    }
    onTaskCreate?.(statusId, newTaskTitle.trim());
    setNewTaskTitle("");
    setAddingInColumn(null);
  };

  const formatDueDate = (dueAt: string | undefined) => {
    if (!dueAt) return null;
    const due = new Date(dueAt);
    const now = new Date();
    const diffDays = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const month = due.toLocaleDateString("en-US", { month: "short" });
    const day = due.getDate();

    let color = colors.textMuted;
    if (diffDays < 0) color = "#ef4444";
    else if (diffDays <= 3) color = "#f97316";

    return { text: `${month} ${day}`, color };
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "16px",
        padding: "16px",
        overflowX: "auto",
        height: "100%",
        alignItems: "flex-start",
      }}
    >
      {statuses.map((status) => {
        const columnTasks = tasksByStatus[status.id] || [];
        const isOver = dragState.overStatus === status.id;
        const isDragging = dragState.taskId !== null;

        return (
          <div
            key={status.id}
            data-column={status.id}
            onDragOver={(e) => handleDragOver(e, status.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status.id)}
            style={{
              width: "300px",
              minWidth: "300px",
              display: "flex",
              flexDirection: "column",
              background: isOver ? colors.surfaceHover : colors.surface,
              borderRadius: "12px",
              border: `1px solid ${isOver ? colors.accent : colors.border}`,
              transition: "all 0.2s",
              maxHeight: "calc(100vh - 200px)",
            }}
          >
            {/* Column Header */}
            <div
              style={{
                padding: "12px 16px",
                borderBottom: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: status.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: colors.text,
                  flex: 1,
                }}
              >
                {status.name}
              </span>
              <span
                style={{
                  fontSize: "0.8rem",
                  color: colors.textMuted,
                  background: colors.surfaceHover,
                  padding: "2px 8px",
                  borderRadius: "10px",
                }}
              >
                {columnTasks.length}
              </span>
            </div>

            {/* Tasks */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {columnTasks.map((task) => {
                const isDone = task.status === "done";
                const dueInfo = formatDueDate(task.dueAt);
                const priorityInfo = PRIORITIES[task.priority] || PRIORITIES.none;
                const isDraggingThis = dragState.taskId === task.id;

                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onTaskClick(task)}
                    style={{
                      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)",
                      borderRadius: "8px",
                      padding: "12px",
                      cursor: "grab",
                      border: `1px solid ${isDraggingThis ? colors.accent : "transparent"}`,
                      opacity: isDraggingThis ? 0.5 : 1,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isDragging) {
                        e.currentTarget.style.borderColor = colors.border;
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = isDraggingThis ? colors.accent : "transparent";
                      e.currentTarget.style.transform = "none";
                    }}
                  >
                    {/* Drag Handle + Priority */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "8px",
                      }}
                    >
                      <GripVertical size={12} color={colors.textMuted} style={{ opacity: 0.5 }} />
                      {task.priority !== "none" && (
                        <Flag size={12} fill={priorityInfo.color} color={priorityInfo.color} />
                      )}
                      {task.labels.slice(0, 2).map((labelId) => {
                        const label = labels.find((l) => l.id === labelId);
                        if (!label) return null;
                        return (
                          <span
                            key={labelId}
                            style={{
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: `${label.color}20`,
                              color: label.color,
                              fontSize: "0.65rem",
                              fontWeight: 500,
                            }}
                          >
                            {label.name}
                          </span>
                        );
                      })}
                    </div>

                    {/* Task Title */}
                    <div
                      style={{
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        color: isDone ? colors.textMuted : colors.text,
                        textDecoration: isDone ? "line-through" : "none",
                        marginBottom: "10px",
                        lineHeight: 1.4,
                      }}
                    >
                      {task.title}
                    </div>

                    {/* Task Meta */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      {/* Due Date */}
                      {dueInfo && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            color: dueInfo.color,
                            fontSize: "0.75rem",
                          }}
                        >
                          <Calendar size={12} />
                          {dueInfo.text}
                        </div>
                      )}

                      {/* Subtasks */}
                      {task.subtaskCount > 0 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            color: colors.textMuted,
                            fontSize: "0.75rem",
                          }}
                        >
                          <CheckCheck size={12} />
                          {task.completedSubtasks}/{task.subtaskCount}
                        </div>
                      )}

                      {/* Comments */}
                      {task.commentCount > 0 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            color: colors.textMuted,
                            fontSize: "0.75rem",
                          }}
                        >
                          <MessageSquare size={12} />
                          {task.commentCount}
                        </div>
                      )}

                      {/* Assignees */}
                      <div style={{ marginLeft: "auto", display: "flex" }}>
                        {task.assignees.slice(0, 2).map((assigneeId, i) => {
                          const user = users[assigneeId];
                          return (
                            <div
                              key={assigneeId}
                              title={user?.name || assigneeId}
                              style={{
                                width: "22px",
                                height: "22px",
                                borderRadius: "50%",
                                background: user?.avatar || "#6b7280",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff",
                                fontSize: "0.6rem",
                                fontWeight: 700,
                                marginLeft: i > 0 ? "-6px" : 0,
                                border: `2px solid ${colors.surface}`,
                              }}
                            >
                              {user?.initials || assigneeId.charAt(0).toUpperCase()}
                            </div>
                          );
                        })}
                        {task.assignees.length === 0 && (
                          <div
                            style={{
                              width: "22px",
                              height: "22px",
                              borderRadius: "50%",
                              border: `1px dashed ${colors.border}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: colors.textMuted,
                            }}
                          >
                            <User size={10} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add Task Button/Input */}
              {addingInColumn === status.id ? (
                <div
                  style={{
                    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)",
                    borderRadius: "8px",
                    padding: "12px",
                    border: `1px solid ${colors.accent}`,
                  }}
                >
                  <input
                    type="text"
                    placeholder="Task name"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddTask(status.id);
                      if (e.key === "Escape") {
                        setAddingInColumn(null);
                        setNewTaskTitle("");
                      }
                    }}
                    onBlur={() => {
                      if (!newTaskTitle.trim()) {
                        setAddingInColumn(null);
                      }
                    }}
                    autoFocus
                    style={{
                      width: "100%",
                      padding: "8px",
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      color: colors.text,
                      fontSize: "0.9rem",
                    }}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setAddingInColumn(status.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 12px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    color: colors.textMuted,
                    fontSize: "0.85rem",
                    width: "100%",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.surfaceHover;
                    e.currentTarget.style.color = colors.text;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = colors.textMuted;
                  }}
                >
                  <Plus size={14} />
                  Add task
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Add Column Button */}
      <button
        style={{
          minWidth: "280px",
          padding: "40px 20px",
          background: colors.surface,
          border: `2px dashed ${colors.border}`,
          borderRadius: "12px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          color: colors.textMuted,
          fontSize: "0.9rem",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = colors.accent;
          e.currentTarget.style.color = colors.text;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = colors.border;
          e.currentTarget.style.color = colors.textMuted;
        }}
      >
        <Plus size={16} />
        Add Status
      </button>
    </div>
  );
}

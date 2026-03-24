"use client";

import React, { useMemo } from "react";
import { User, Calendar, CheckCheck, Clock, AlertTriangle } from "lucide-react";
import { Task } from "@/lib/api/tasks";

interface WorkloadViewProps {
  tasks: Task[];
  users: Record<string, { name: string; avatar: string; initials: string }>;
  onTaskClick: (task: Task) => void;
  onAssigneeChange?: (taskId: string, newAssignee: string | null) => void;
}

// Default colors for the workload view
const DEFAULT_COLORS = {
  text: "#e5e5e5",
  textSecondary: "#a3a3a3",
  textMuted: "#737373",
  surface: "rgba(38, 38, 38, 0.8)",
  surfaceHover: "rgba(64, 64, 64, 0.8)",
  border: "rgba(82, 82, 82, 0.5)",
  accent: "#FFD700",
  success: "#22c55e",
  warning: "#f97316",
  danger: "#ef4444",
};

interface UserWorkload {
  userId: string;
  user: { name: string; avatar: string; initials: string };
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  urgentTasks: number;
  totalTimeTracked: number;
  estimatedTime: number;
  tasks: Task[];
}

export function WorkloadView({
  tasks,
  users,
  onTaskClick,
  onAssigneeChange,
}: WorkloadViewProps) {
  const colors = DEFAULT_COLORS;
  const isDark = true; // Default to dark mode styling
  // Calculate workload per user
  const workloads = useMemo(() => {
    const now = new Date();
    const workloadMap: Record<string, UserWorkload> = {};

    // Initialize all users
    Object.entries(users).forEach(([userId, user]) => {
      workloadMap[userId] = {
        userId,
        user,
        totalTasks: 0,
        completedTasks: 0,
        overdueTasks: 0,
        urgentTasks: 0,
        totalTimeTracked: 0,
        estimatedTime: 0,
        tasks: [],
      };
    });

    // Also track unassigned
    workloadMap["unassigned"] = {
      userId: "unassigned",
      user: { name: "Unassigned", avatar: "#6b7280", initials: "?" },
      totalTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
      urgentTasks: 0,
      totalTimeTracked: 0,
      estimatedTime: 0,
      tasks: [],
    };

    // Process tasks
    tasks.filter(t => !t.parentTaskId).forEach((task) => {
      const assignees = task.assignees.length > 0 ? task.assignees : ["unassigned"];

      assignees.forEach((assigneeId) => {
        if (!workloadMap[assigneeId]) {
          workloadMap[assigneeId] = {
            userId: assigneeId,
            user: users[assigneeId] || { name: assigneeId, avatar: "#6b7280", initials: "?" },
            totalTasks: 0,
            completedTasks: 0,
            overdueTasks: 0,
            urgentTasks: 0,
            totalTimeTracked: 0,
            estimatedTime: 0,
            tasks: [],
          };
        }

        const workload = workloadMap[assigneeId];
        workload.totalTasks++;
        workload.tasks.push(task);

        if (task.status === "done") {
          workload.completedTasks++;
        }

        if (task.dueAt && new Date(task.dueAt) < now && task.status !== "done") {
          workload.overdueTasks++;
        }

        if (task.priority === "urgent" && task.status !== "done") {
          workload.urgentTasks++;
        }

        // Note: Time tracking fields not yet implemented in Task type
        // workload.totalTimeTracked += task.timeTrackedSeconds || 0;
        // workload.estimatedTime += task.timeEstimateSeconds || 0;
      });
    });

    // Convert to array and sort by total tasks
    return Object.values(workloadMap)
      .filter(w => w.totalTasks > 0 || w.userId !== "unassigned")
      .sort((a, b) => b.totalTasks - a.totalTasks);
  }, [tasks, users]);

  // Calculate max for progress bars
  const maxTasks = Math.max(...workloads.map(w => w.totalTasks), 1);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getWorkloadLevel = (workload: UserWorkload) => {
    const incomplete = workload.totalTasks - workload.completedTasks;
    if (incomplete > 10 || workload.overdueTasks > 3) return "overloaded";
    if (incomplete > 5 || workload.overdueTasks > 1) return "high";
    if (incomplete > 2) return "medium";
    return "low";
  };

  const getWorkloadColor = (level: string) => {
    switch (level) {
      case "overloaded": return colors.danger;
      case "high": return colors.warning;
      case "medium": return colors.accent;
      default: return colors.success;
    }
  };

  return (
    <div
      style={{
        padding: "24px",
        height: "100%",
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600, color: colors.text }}>
          Team Workload
        </h2>
        <div style={{ display: "flex", gap: "16px", fontSize: "0.8rem", color: colors.textMuted }}>
          <span>Total: {tasks.filter(t => !t.parentTaskId).length} tasks</span>
          <span>Completed: {tasks.filter(t => t.status === "done" && !t.parentTaskId).length}</span>
        </div>
      </div>

      {/* Workload Cards */}
      <div style={{ display: "grid", gap: "16px" }}>
        {workloads.map((workload) => {
          const level = getWorkloadLevel(workload);
          const levelColor = getWorkloadColor(level);
          const completionPct = workload.totalTasks > 0
            ? Math.round((workload.completedTasks / workload.totalTasks) * 100)
            : 0;

          return (
            <div
              key={workload.userId}
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: "12px",
                padding: "20px",
              }}
            >
              {/* User Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: workload.user.avatar,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                  }}
                >
                  {workload.user.initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: colors.text }}>
                    {workload.user.name}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: colors.textMuted }}>
                    {workload.totalTasks} tasks assigned
                  </div>
                </div>
                <div
                  style={{
                    padding: "4px 12px",
                    borderRadius: "12px",
                    background: `${levelColor}20`,
                    color: levelColor,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "capitalize",
                  }}
                >
                  {level}
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                    fontSize: "0.75rem",
                    color: colors.textMuted,
                  }}
                >
                  <span>Progress</span>
                  <span>{completionPct}% complete</span>
                </div>
                <div
                  style={{
                    height: "8px",
                    background: colors.surfaceHover,
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${completionPct}%`,
                      background: `linear-gradient(90deg, ${colors.success}, ${colors.accent})`,
                      borderRadius: "4px",
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>

              {/* Stats Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    background: colors.surfaceHover,
                    borderRadius: "8px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      color: colors.text,
                    }}
                  >
                    {workload.totalTasks - workload.completedTasks}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: colors.textMuted }}>
                    To Do
                  </div>
                </div>
                <div
                  style={{
                    padding: "12px",
                    background: colors.surfaceHover,
                    borderRadius: "8px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      color: colors.success,
                    }}
                  >
                    {workload.completedTasks}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: colors.textMuted }}>
                    Done
                  </div>
                </div>
                <div
                  style={{
                    padding: "12px",
                    background: workload.overdueTasks > 0 ? `${colors.danger}15` : colors.surfaceHover,
                    borderRadius: "8px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      color: workload.overdueTasks > 0 ? colors.danger : colors.textMuted,
                    }}
                  >
                    {workload.overdueTasks}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: colors.textMuted }}>
                    Overdue
                  </div>
                </div>
                <div
                  style={{
                    padding: "12px",
                    background: workload.urgentTasks > 0 ? `${colors.warning}15` : colors.surfaceHover,
                    borderRadius: "8px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      color: workload.urgentTasks > 0 ? colors.warning : colors.textMuted,
                    }}
                  >
                    {workload.urgentTasks}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: colors.textMuted }}>
                    Urgent
                  </div>
                </div>
              </div>

              {/* Time Tracking */}
              {(workload.totalTimeTracked > 0 || workload.estimatedTime > 0) && (
                <div
                  style={{
                    display: "flex",
                    gap: "24px",
                    padding: "12px",
                    background: colors.surfaceHover,
                    borderRadius: "8px",
                    fontSize: "0.8rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Clock size={14} color={colors.textMuted} />
                    <span style={{ color: colors.textMuted }}>Tracked:</span>
                    <span style={{ color: colors.text, fontWeight: 500 }}>
                      {formatTime(workload.totalTimeTracked)}
                    </span>
                  </div>
                  {workload.estimatedTime > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ color: colors.textMuted }}>Estimated:</span>
                      <span style={{ color: colors.text, fontWeight: 500 }}>
                        {formatTime(workload.estimatedTime)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Recent Tasks Preview */}
              {workload.tasks.slice(0, 3).length > 0 && (
                <div style={{ marginTop: "16px" }}>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: colors.textMuted,
                      marginBottom: "8px",
                      textTransform: "uppercase",
                    }}
                  >
                    Active Tasks
                  </div>
                  {workload.tasks
                    .filter(t => t.status !== "done")
                    .slice(0, 3)
                    .map((task) => (
                      <div
                        key={task.id}
                        onClick={() => onTaskClick(task)}
                        style={{
                          padding: "8px 12px",
                          background: colors.surfaceHover,
                          borderRadius: "6px",
                          marginBottom: "6px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isDark
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,0,0,0.06)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = colors.surfaceHover;
                        }}
                      >
                        {task.priority === "urgent" && (
                          <AlertTriangle size={12} color={colors.danger} />
                        )}
                        <span
                          style={{
                            fontSize: "0.85rem",
                            color: colors.text,
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {task.title}
                        </span>
                        {task.dueAt && (
                          <span
                            style={{
                              fontSize: "0.7rem",
                              color:
                                new Date(task.dueAt) < new Date()
                                  ? colors.danger
                                  : colors.textMuted,
                            }}
                          >
                            {new Date(task.dueAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    ))}
                  {workload.tasks.filter(t => t.status !== "done").length > 3 && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: colors.textMuted,
                        textAlign: "center",
                        padding: "4px",
                      }}
                    >
                      +{workload.tasks.filter(t => t.status !== "done").length - 3} more tasks
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

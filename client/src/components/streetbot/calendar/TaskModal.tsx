import React, { useState } from "react";
import {
  X,
  CheckSquare,
  Clock,
  AlignLeft,
  Flag,
  ExternalLink,
  Check,
  Square,
  Calendar,
  FolderOpen,
  PlayCircle,
} from "lucide-react";
import { CalendarItem } from "./calendarUtils";

interface ProjectData {
  id: string;
  name: string;
  color: string;
}

interface CalendarData {
  id: string;
  name: string;
  color: string;
}

interface TaskModalProps {
  colors: Record<string, string>;
  task: CalendarItem | null;
  projects: ProjectData[];
  calendars: CalendarData[];
  selectedDate: Date | null;
  mode: "view" | "create";
  onSave: (taskData: any) => void;
  onComplete?: () => void;
  onSchedule?: (taskId: string, calendarId: string, startAt: Date, endAt: Date) => void;
  onViewInTasks?: () => void;
  onClose: () => void;
}

const PRIORITY_OPTIONS = [
  { value: "urgent", label: "Urgent", color: "#ef4444" },
  { value: "high", label: "High", color: "#f97316" },
  { value: "medium", label: "Medium", color: "#eab308" },
  { value: "low", label: "Low", color: "#22c55e" },
  { value: "none", label: "None", color: "#6b7280" },
];

export default function TaskModal({
  colors,
  task,
  projects,
  calendars,
  selectedDate,
  mode,
  onSave,
  onComplete,
  onSchedule,
  onViewInTasks,
  onClose,
}: TaskModalProps) {
  const isViewMode = mode === "view" && task;

  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [projectId, setProjectId] = useState(task?.projectId || projects[0]?.id || "");
  const [priority, setPriority] = useState(task?.taskPriority || "none");
  const [dueDate, setDueDate] = useState(
    task?.startAt
      ? new Date(task.startAt).toISOString().slice(0, 10)
      : selectedDate
      ? selectedDate.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );

  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleCalendarId, setScheduleCalendarId] = useState(calendars[0]?.id || "");
  const [scheduleDate, setScheduleDate] = useState(dueDate);
  const [scheduleStartTime, setScheduleStartTime] = useState("09:00");
  const [scheduleEndTime, setScheduleEndTime] = useState("10:00");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      project_id: projectId,
      title: title.trim(),
      description: description.trim() || null,
      due_at: new Date(dueDate).toISOString(),
      priority,
    });
  };

  const handleScheduleWorkSession = () => {
    if (task && onSchedule) {
      const startAt = new Date(`${scheduleDate}T${scheduleStartTime}:00`);
      const endAt = new Date(`${scheduleDate}T${scheduleEndTime}:00`);
      onSchedule(task.id, scheduleCalendarId, startAt, endAt);
      setShowSchedule(false);
    }
  };

  const selectedPriority = PRIORITY_OPTIONS.find((p) => p.value === priority);
  const isCompleted = task?.taskStatus === "done";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: colors.cardBg || colors.surface,
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderRadius: "24px",
          width: "100%",
          maxWidth: "500px",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: colors.glassShadow || "0 20px 60px rgba(0,0,0,0.4)",
          border: `1px solid ${colors.border}`,
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
            background: colors.surface,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <CheckSquare size={20} color={colors.accent} />
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: colors.text }}>
              {isViewMode ? "Task Details" : "New Task"}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "8px",
              background: "transparent",
              border: "1px solid transparent",
              cursor: "pointer",
              color: colors.textSecondary,
              borderRadius: "10px",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.surfaceHover || "rgba(255,255,255,0.1)";
              e.currentTarget.style.borderColor = colors.border;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "transparent";
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        {isViewMode ? (
          // View Mode
          <div style={{ padding: "24px" }}>
            {/* Task Title with Completion */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                marginBottom: "24px",
              }}
            >
              <button
                onClick={onComplete}
                style={{
                  padding: "4px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: isCompleted ? colors.success : colors.textSecondary,
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              >
                {isCompleted ? <Check size={24} /> : <Square size={24} />}
              </button>
              <h3
                style={{
                  fontSize: "20px",
                  fontWeight: 600,
                  color: colors.text,
                  textDecoration: isCompleted ? "line-through" : "none",
                  opacity: isCompleted ? 0.7 : 1,
                }}
              >
                {task.title}
              </h3>
            </div>

            {/* Task Info */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Priority */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Flag size={18} color={colors.textSecondary} />
                <span style={{ color: colors.textSecondary, width: "80px" }}>Priority:</span>
                <span
                  style={{
                    padding: "4px 12px",
                    background: `${selectedPriority?.color}20`,
                    color: selectedPriority?.color,
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
                >
                  {selectedPriority?.label}
                </span>
              </div>

              {/* Due Date */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Clock size={18} color={colors.textSecondary} />
                <span style={{ color: colors.textSecondary, width: "80px" }}>Due:</span>
                <span style={{ color: colors.text }}>
                  {new Date(task.startAt).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>

              {/* Status */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <CheckSquare size={18} color={colors.textSecondary} />
                <span style={{ color: colors.textSecondary, width: "80px" }}>Status:</span>
                <span
                  style={{
                    padding: "4px 12px",
                    background: isCompleted
                      ? "rgba(34, 197, 94, 0.2)"
                      : "rgba(255, 214, 0, 0.2)",
                    color: isCompleted ? "#22c55e" : colors.accent,
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
                >
                  {task.taskStatus === "done"
                    ? "Completed"
                    : task.taskStatus === "in_progress"
                    ? "In Progress"
                    : "To Do"}
                </span>
              </div>

              {/* Description */}
              {task.description && (
                <div style={{ marginTop: "8px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "8px",
                    }}
                  >
                    <AlignLeft size={18} color={colors.textSecondary} />
                    <span style={{ color: colors.textSecondary }}>Description</span>
                  </div>
                  <p
                    style={{
                      color: colors.text,
                      fontSize: "14px",
                      lineHeight: 1.6,
                      padding: "12px",
                      background: colors.surface,
                      borderRadius: "8px",
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    {task.description}
                  </p>
                </div>
              )}
            </div>

            {/* Schedule Work Session */}
            {showSchedule && (
              <div
                style={{
                  marginTop: "24px",
                  padding: "16px",
                  background: colors.surface,
                  borderRadius: "12px",
                  border: `1px solid ${colors.border}`,
                }}
              >
                <h4
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: colors.text,
                    marginBottom: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Calendar size={16} />
                  Schedule Work Session
                </h4>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <select
                    value={scheduleCalendarId}
                    onChange={(e) => setScheduleCalendarId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      fontSize: "14px",
                      background: colors.surfaceHover,
                      border: `1px solid ${colors.border}`,
                      borderRadius: "8px",
                      color: colors.text,
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    {calendars.map((cal) => (
                      <option key={cal.id} value={cal.id}>
                        {cal.name}
                      </option>
                    ))}
                  </select>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        fontSize: "14px",
                        background: colors.surfaceHover,
                        border: `1px solid ${colors.border}`,
                        borderRadius: "8px",
                        color: colors.text,
                        outline: "none",
                      }}
                    />
                    <input
                      type="time"
                      value={scheduleStartTime}
                      onChange={(e) => setScheduleStartTime(e.target.value)}
                      style={{
                        width: "100px",
                        padding: "10px 12px",
                        fontSize: "14px",
                        background: colors.surfaceHover,
                        border: `1px solid ${colors.border}`,
                        borderRadius: "8px",
                        color: colors.text,
                        outline: "none",
                      }}
                    />
                    <span style={{ color: colors.textSecondary, alignSelf: "center" }}>to</span>
                    <input
                      type="time"
                      value={scheduleEndTime}
                      onChange={(e) => setScheduleEndTime(e.target.value)}
                      style={{
                        width: "100px",
                        padding: "10px 12px",
                        fontSize: "14px",
                        background: colors.surfaceHover,
                        border: `1px solid ${colors.border}`,
                        borderRadius: "8px",
                        color: colors.text,
                        outline: "none",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setShowSchedule(false)}
                      style={{
                        padding: "8px 16px",
                        background: colors.surface,
                        border: `1px solid ${colors.border}`,
                        borderRadius: "8px",
                        color: colors.text,
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleScheduleWorkSession}
                      style={{
                        padding: "8px 16px",
                        background: colors.accent,
                        border: "none",
                        borderRadius: "8px",
                        color: "#000",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Add to Calendar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                marginTop: "24px",
                paddingTop: "16px",
                borderTop: `1px solid ${colors.border}`,
              }}
            >
              <button
                onClick={onComplete}
                style={{
                  flex: 1,
                  padding: "12px 18px",
                  background: isCompleted
                    ? "rgba(34, 197, 94, 0.1)"
                    : colors.surface,
                  border: `1px solid ${
                    isCompleted ? "rgba(34, 197, 94, 0.3)" : colors.border
                  }`,
                  borderRadius: "12px",
                  color: isCompleted ? "#22c55e" : colors.text,
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "all 0.2s ease",
                }}
              >
                {isCompleted ? <Check size={18} /> : <Square size={18} />}
                {isCompleted ? "Completed" : "Mark Complete"}
              </button>

              <button
                onClick={() => setShowSchedule(!showSchedule)}
                style={{
                  flex: 1,
                  padding: "12px 18px",
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "12px",
                  color: colors.text,
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "all 0.2s ease",
                }}
              >
                <PlayCircle size={18} />
                Schedule Time
              </button>
            </div>

            {/* View in Tasks */}
            <button
              onClick={onViewInTasks}
              style={{
                width: "100%",
                padding: "12px 18px",
                marginTop: "12px",
                background: colors.accent,
                border: "none",
                borderRadius: "12px",
                color: "#000",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "0 4px 14px rgba(255, 214, 0, 0.4)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(255, 214, 0, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 14px rgba(255, 214, 0, 0.4)";
              }}
            >
              <ExternalLink size={18} />
              View in Tasks
            </button>
          </div>
        ) : (
          // Create Mode
          <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
            {/* Title */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              autoFocus
              style={{
                width: "100%",
                padding: "14px 18px",
                fontSize: "18px",
                fontWeight: 500,
                background: colors.surface,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: `1px solid ${colors.border}`,
                borderRadius: "14px",
                color: colors.text,
                marginBottom: "24px",
                outline: "none",
                transition: "all 0.2s ease",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.accent;
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255, 214, 0, 0.15)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.boxShadow = "none";
              }}
            />

            {/* Project Selector */}
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: colors.textSecondary,
                  marginBottom: "8px",
                }}
              >
                <FolderOpen size={16} />
                Project
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: "14px",
                  background: colors.surfaceHover,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "8px",
                  color: colors.text,
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: colors.textSecondary,
                  marginBottom: "8px",
                }}
              >
                <Clock size={16} />
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: "14px",
                  background: colors.surfaceHover,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "8px",
                  color: colors.text,
                  outline: "none",
                }}
              />
            </div>

            {/* Priority */}
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: colors.textSecondary,
                  marginBottom: "8px",
                }}
              >
                <Flag size={16} />
                Priority
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    style={{
                      padding: "8px 14px",
                      background:
                        priority === opt.value
                          ? `${opt.color}20`
                          : colors.surface,
                      border: `1px solid ${
                        priority === opt.value ? opt.color : colors.border
                      }`,
                      borderRadius: "8px",
                      color: priority === opt.value ? opt.color : colors.text,
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: colors.textSecondary,
                  marginBottom: "8px",
                }}
              >
                <AlignLeft size={16} />
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add description (optional)"
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: "14px",
                  background: colors.surfaceHover,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "8px",
                  color: colors.text,
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "12px 20px",
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "12px",
                  color: colors.text,
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    colors.surfaceHover || "rgba(255,255,255,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colors.surface;
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || !projectId}
                style={{
                  padding: "12px 24px",
                  background:
                    title.trim() && projectId ? colors.accent : colors.textMuted,
                  border: "none",
                  borderRadius: "12px",
                  color: title.trim() && projectId ? "#000" : colors.textSecondary,
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: title.trim() && projectId ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow:
                    title.trim() && projectId
                      ? "0 4px 14px rgba(255, 214, 0, 0.4)"
                      : "none",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (title.trim() && projectId) {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 6px 20px rgba(255, 214, 0, 0.5)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    title.trim() && projectId
                      ? "0 4px 14px rgba(255, 214, 0, 0.4)"
                      : "none";
                }}
              >
                <Check size={16} />
                Create Task
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

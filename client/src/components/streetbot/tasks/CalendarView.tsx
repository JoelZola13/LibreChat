"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Flag,
  CheckCheck,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Task } from "@/lib/api/tasks";

interface CalendarViewProps {
  tasks: Task[];
  labels?: { id: string; name: string; color: string }[];
  users?: Record<string, { name: string; avatar: string; initials: string }>;
  onTaskClick: (task: Task) => void;
  onAddTask?: (date: Date) => void;
  onDateChange?: (taskId: string, newDate: string | null) => void;
  selectedTaskIds?: Set<string>;
  onSelectTask?: (taskId: string, selected: boolean) => void;
}

// Default colors for the calendar view
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

const PRIORITIES: Record<string, { color: string }> = {
  urgent: { color: "#ef4444" },
  high: { color: "#f97316" },
  medium: { color: "#eab308" },
  low: { color: "#22c55e" },
  none: { color: "#6b7280" },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function CalendarView({
  tasks,
  labels = [],
  users = {},
  onTaskClick,
  onAddTask,
  onDateChange,
  selectedTaskIds = new Set(),
  onSelectTask,
}: CalendarViewProps) {
  const colors = DEFAULT_COLORS;
  const isDark = true; // Default to dark mode styling
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get calendar days for current month view
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

    const days: Date[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [currentDate]);

  // Get week days for week view
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  }, [currentDate]);

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};

    tasks.forEach((task) => {
      if (task.dueAt && !task.parentTaskId) {
        const date = new Date(task.dueAt);
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        if (!map[key]) {
          map[key] = [];
        }
        map[key].push(task);
      }
    });

    return map;
  }, [tasks]);

  const getDateKey = (date: Date) => {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };

  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const prevPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 7);
    }
    setCurrentDate(newDate);
  };

  const nextPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const renderTask = (task: Task, compact: boolean = false) => {
    const isDone = task.status === "done";
    const priorityInfo = PRIORITIES[task.priority] || PRIORITIES.none;

    return (
      <div
        key={task.id}
        onClick={(e) => {
          e.stopPropagation();
          onTaskClick(task);
        }}
        style={{
          padding: compact ? "4px 6px" : "6px 8px",
          borderRadius: "4px",
          background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
          borderLeft: `3px solid ${priorityInfo.color}`,
          cursor: "pointer",
          transition: "all 0.15s",
          marginBottom: compact ? "2px" : "4px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = isDark
            ? "rgba(255,255,255,0.12)"
            : "rgba(0,0,0,0.08)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isDark
            ? "rgba(255,255,255,0.08)"
            : "rgba(0,0,0,0.05)";
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {isDone && <CheckCheck size={10} color={colors.success} />}
          <span
            style={{
              fontSize: compact ? "0.7rem" : "0.75rem",
              color: isDone ? colors.textMuted : colors.text,
              textDecoration: isDone ? "line-through" : "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {task.title}
          </span>
          {!compact && task.assignees.length > 0 && (
            <div
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                background: users[task.assignees[0]]?.avatar || "#6b7280",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: "0.5rem",
                fontWeight: 700,
              }}
            >
              {users[task.assignees[0]]?.initials || task.assignees[0].charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDayCell = (date: Date) => {
    const dateKey = getDateKey(date);
    const dayTasks = tasksByDate[dateKey] || [];
    const isInMonth = isCurrentMonth(date);
    const isTodayDate = isToday(date);
    const maxTasks = viewMode === "week" ? 10 : 3;

    return (
      <div
        key={dateKey}
        onClick={() => onAddTask?.(date)}
        style={{
          minHeight: viewMode === "week" ? "200px" : "100px",
          padding: "6px",
          background: isTodayDate
            ? isDark ? "rgba(255, 214, 0, 0.08)" : "rgba(255, 214, 0, 0.15)"
            : "transparent",
          borderRight: `1px solid ${colors.border}`,
          borderBottom: `1px solid ${colors.border}`,
          opacity: isInMonth || viewMode === "week" ? 1 : 0.5,
          cursor: "pointer",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!isTodayDate) {
            e.currentTarget.style.background = colors.surfaceHover;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isTodayDate
            ? isDark ? "rgba(255, 214, 0, 0.08)" : "rgba(255, 214, 0, 0.15)"
            : "transparent";
        }}
      >
        {/* Date Number */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "6px",
          }}
        >
          <span
            style={{
              width: isTodayDate ? "24px" : "auto",
              height: isTodayDate ? "24px" : "auto",
              borderRadius: "50%",
              background: isTodayDate ? colors.accent : "transparent",
              color: isTodayDate ? "#000" : colors.text,
              fontSize: "0.8rem",
              fontWeight: isTodayDate ? 700 : 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {date.getDate()}
          </span>
          {dayTasks.length > maxTasks && (
            <span style={{ fontSize: "0.65rem", color: colors.textMuted }}>
              +{dayTasks.length - maxTasks} more
            </span>
          )}
        </div>

        {/* Tasks */}
        <div style={{ overflow: "hidden" }}>
          {dayTasks.slice(0, maxTasks).map((task) => renderTask(task, viewMode === "month"))}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Calendar Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: colors.surface,
        }}
      >
        {/* Left - Navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={goToToday}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: `1px solid ${colors.border}`,
              background: "transparent",
              color: colors.text,
              fontSize: "0.85rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Today
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <button
              onClick={prevPeriod}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "6px",
                border: `1px solid ${colors.border}`,
                background: "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: colors.text,
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={nextPeriod}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "6px",
                border: `1px solid ${colors.border}`,
                background: "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: colors.text,
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <h2
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              color: colors.text,
              margin: 0,
            }}
          >
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
        </div>

        {/* Right - View Toggle */}
        <div
          style={{
            display: "flex",
            background: colors.surfaceHover,
            borderRadius: "8px",
            padding: "3px",
          }}
        >
          {(["month", "week"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: "6px 16px",
                borderRadius: "6px",
                border: "none",
                background: viewMode === mode ? colors.surface : "transparent",
                color: viewMode === mode ? colors.text : colors.textMuted,
                fontSize: "0.85rem",
                fontWeight: 500,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Day Headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            borderBottom: `1px solid ${colors.border}`,
            position: "sticky",
            top: 0,
            background: colors.surface,
            zIndex: 10,
          }}
        >
          {DAYS.map((day) => (
            <div
              key={day}
              style={{
                padding: "12px 8px",
                textAlign: "center",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: colors.textMuted,
                textTransform: "uppercase",
                borderRight: `1px solid ${colors.border}`,
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
          }}
        >
          {(viewMode === "week" ? weekDays : calendarDays).map(renderDayCell)}
        </div>
      </div>

      {/* Task Count Summary */}
      <div
        style={{
          padding: "12px 20px",
          borderTop: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          gap: "20px",
          background: colors.surface,
          fontSize: "0.8rem",
          color: colors.textMuted,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <CalendarIcon size={14} />
          <span>
            {tasks.filter((t) => t.dueAt && !t.parentTaskId).length} tasks with due dates
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Flag size={14} color="#ef4444" />
          <span>
            {tasks.filter((t) => t.priority === "urgent" && !t.parentTaskId).length} urgent
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <CheckCheck size={14} color={colors.success} />
          <span>
            {tasks.filter((t) => t.status === "done" && !t.parentTaskId).length} completed
          </span>
        </div>
      </div>
    </div>
  );
}

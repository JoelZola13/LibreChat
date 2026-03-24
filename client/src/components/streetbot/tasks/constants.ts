/**
 * Task Component Constants
 * Shared constants and types for task-related components
 */

// Priority configuration
export const PRIORITIES = {
  urgent: { label: "Urgent", color: "#ef4444", flagColor: "#ef4444" },
  high: { label: "High", color: "#f97316", flagColor: "#f97316" },
  medium: { label: "Medium", color: "#eab308", flagColor: "#eab308" },
  low: { label: "Low", color: "#22c55e", flagColor: "#22c55e" },
  none: { label: "None", color: "#6b7280", flagColor: "#6b7280" },
} as const;

export type PriorityKey = keyof typeof PRIORITIES;

// Default statuses with ClickUp-style colors
export const DEFAULT_STATUSES = [
  { id: "backlog", name: "BACKLOG", color: "#a3a3a3", category: "backlog" },
  { id: "todo", name: "TO DO", color: "#6b7280", category: "open" },
  { id: "in_progress", name: "IN PROGRESS", color: "#eab308", category: "in_progress" },
  { id: "done", name: "COMPLETE", color: "#22c55e", category: "done" },
] as const;

export type StatusConfig = typeof DEFAULT_STATUSES[number];

// User info type for assignee display
export interface UserInfo {
  name: string;
  avatar: string;
  initials: string;
}

// Default column grid template for task list
export const DEFAULT_GRID_TEMPLATE = "40px minmax(250px, 1fr) 80px 100px 60px 50px";
export const SUBTASK_GRID_TEMPLATE = "24px minmax(200px, 1fr) 60px 80px 50px 30px";

// Color theme interface (extracted from page.tsx DEFAULT_COLORS)
export interface TasksColorTheme {
  // Backgrounds
  headerBg: string;
  sidebar: string;
  surface: string;
  surfaceHover: string;
  rowHover: string;
  sidebarHover: string;
  sidebarActive: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;

  // Borders
  border: string;

  // Accent
  accent: string;
  success: string;
}

// Default dark theme colors (matching page.tsx)
export const DEFAULT_COLORS: TasksColorTheme = {
  headerBg: "rgba(20, 20, 28, 0.95)",
  sidebar: "rgba(26, 26, 36, 0.98)",
  surface: "rgba(40, 40, 56, 0.9)",
  surfaceHover: "rgba(50, 50, 70, 0.9)",
  rowHover: "rgba(35, 35, 50, 0.4)",
  sidebarHover: "rgba(50, 50, 70, 0.5)",
  sidebarActive: "rgba(60, 60, 80, 0.7)",
  text: "#ffffff",
  textSecondary: "rgba(255, 255, 255, 0.85)",
  textMuted: "rgba(255, 255, 255, 0.5)",
  border: "rgba(255, 255, 255, 0.08)",
  accent: "#FFD600",
  success: "#22c55e",
};

// Date formatting utility
export function formatDueDate(dueAt?: string): { text: string; color: string } | null {
  if (!dueAt) return null;

  const dueDate = new Date(dueAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  dueDate.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: `${Math.abs(diffDays)}d overdue`, color: "#ef4444" };
  } else if (diffDays === 0) {
    return { text: "Today", color: "#f97316" };
  } else if (diffDays === 1) {
    return { text: "Tomorrow", color: "#eab308" };
  } else if (diffDays <= 7) {
    return { text: `${diffDays}d`, color: "#22c55e" };
  } else {
    return {
      text: dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      color: "#6b7280",
    };
  }
}

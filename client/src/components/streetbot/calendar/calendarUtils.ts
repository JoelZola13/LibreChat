/**
 * Calendar utility functions - no external library dependencies.
 * Ported from Street Bot Pro to LibreChat.
 */

// Types
export interface CalendarItem {
  id: string;
  type: "event" | "task";
  title: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  color: string;
  calendarId?: string;
  location?: string;
  rrule?: string;
  status?: string;
  taskStatus?: string;
  taskPriority?: string;
  projectId?: string;
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  events: CalendarItem[];
}

// ============================================================================
// Date Navigation
// ============================================================================

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (6 - day));
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

// ============================================================================
// Comparison Functions
// ============================================================================

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function isPast(date: Date): boolean {
  return date < startOfDay(new Date());
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// ============================================================================
// Month View Helpers
// ============================================================================

export function getMonthDays(year: number, month: number): CalendarDay[] {
  const firstOfMonth = new Date(year, month, 1);

  const startDate = startOfWeek(firstOfMonth);

  const days: CalendarDay[] = [];
  const today = new Date();

  for (let i = 0; i < 42; i++) {
    const date = addDays(startDate, i);
    days.push({
      date,
      isCurrentMonth: date.getMonth() === month,
      isToday: isSameDay(date, today),
      isWeekend: isWeekend(date),
      events: [],
    });
  }

  return days;
}

export function getWeekDays(date: Date): CalendarDay[] {
  const start = startOfWeek(date);
  const today = new Date();
  const days: CalendarDay[] = [];

  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    days.push({
      date: d,
      isCurrentMonth: true,
      isToday: isSameDay(d, today),
      isWeekend: isWeekend(d),
      events: [],
    });
  }

  return days;
}

// ============================================================================
// Event Filtering
// ============================================================================

export function getEventsForDay(
  events: CalendarItem[],
  date: Date
): CalendarItem[] {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  return events.filter((event) => {
    const eventStart = new Date(event.startAt);
    const eventEnd = new Date(event.endAt);
    return eventStart <= dayEnd && eventEnd >= dayStart;
  });
}

export function getEventsForWeek(
  events: CalendarItem[],
  startDate: Date
): CalendarItem[] {
  const weekStart = startOfWeek(startDate);
  const weekEnd = endOfWeek(startDate);

  return events.filter((event) => {
    const eventStart = new Date(event.startAt);
    const eventEnd = new Date(event.endAt);
    return eventStart <= weekEnd && eventEnd >= weekStart;
  });
}

export function getEventsForMonth(
  events: CalendarItem[],
  year: number,
  month: number
): CalendarItem[] {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));

  return events.filter((event) => {
    const eventStart = new Date(event.startAt);
    const eventEnd = new Date(event.endAt);
    return eventStart <= monthEnd && eventEnd >= monthStart;
  });
}

// ============================================================================
// Time Helpers
// ============================================================================

export function getHourSlots(startHour: number = 0, endHour: number = 24): number[] {
  const slots: number[] = [];
  for (let h = startHour; h < endHour; h++) {
    slots.push(h);
  }
  return slots;
}

export function getEventTopPosition(
  eventStart: Date,
  dayStart: number = 0,
  dayEnd: number = 24
): number {
  const hours = eventStart.getHours() + eventStart.getMinutes() / 60;
  const totalHours = dayEnd - dayStart;
  return ((hours - dayStart) / totalHours) * 100;
}

export function getEventHeight(
  eventStart: Date,
  eventEnd: Date,
  dayStart: number = 0,
  dayEnd: number = 24
): number {
  const startHours = eventStart.getHours() + eventStart.getMinutes() / 60;
  const endHours = eventEnd.getHours() + eventEnd.getMinutes() / 60;
  const duration = endHours - startHours;
  const totalHours = dayEnd - dayStart;
  return Math.max((duration / totalHours) * 100, 2);
}

// ============================================================================
// Formatting
// ============================================================================

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateShort(date: Date): string {
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export function formatDayName(date: Date, short: boolean = false): string {
  return date.toLocaleDateString([], {
    weekday: short ? "short" : "long",
  });
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
}

export function formatDateRange(start: Date, end: Date): string {
  if (isSameDay(start, end)) {
    return `${formatTime(start)} - ${formatTime(end)}`;
  }
  return `${formatDateShort(start)} - ${formatDateShort(end)}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

// ============================================================================
// API Helpers
// ============================================================================

export function parseApiEvents(events: any[]): CalendarItem[] {
  return events.map((event) => ({
    id: event.id,
    type: "event" as const,
    title: event.title,
    description: event.description,
    startAt: new Date(event.start_at),
    endAt: new Date(event.end_at),
    allDay: event.all_day || false,
    color: event.color || "#FFD700",
    calendarId: event.calendar_id,
    location: event.location,
    rrule: event.rrule,
    status: event.status,
  }));
}

export function parseApiTasks(tasks: any[]): CalendarItem[] {
  return tasks.map((task) => ({
    id: task.id,
    type: "task" as const,
    title: task.title,
    description: task.description,
    startAt: new Date(task.start_at),
    endAt: new Date(task.end_at),
    allDay: task.all_day || true,
    color: task.color || "#6b7280",
    taskStatus: task.task_status,
    taskPriority: task.task_priority,
    projectId: task.project_id,
  }));
}

export function getCalendarColors() {
  return [
    "#FFD700", // Gold
    "#3b82f6", // Blue
    "#22c55e", // Green
    "#ef4444", // Red
    "#8b5cf6", // Purple
    "#f97316", // Orange
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#84cc16", // Lime
    "#f59e0b", // Amber
  ];
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

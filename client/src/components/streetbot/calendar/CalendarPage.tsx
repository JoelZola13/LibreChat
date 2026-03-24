import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useGlassStyles } from "../shared/useGlassStyles";
import { GlassBackground } from "../shared/GlassBackground";
import { useResponsive } from "../hooks/useResponsive";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  List,
  Grid3X3,
  LayoutGrid,
  CalendarDays,
  CheckSquare,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SB_API_BASE } from "~/components/streetbot/shared/apiConfig";
import {
  CalendarItem,
  addMonths,
  addWeeks,
  addDays,
  formatMonthYear,
  formatDate,
  formatDateShort,
  formatDayName,
  parseApiEvents,
  parseApiTasks,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
} from "./calendarUtils";
import MonthView from "./MonthView";
import WeekView from "./WeekView";
import DayView from "./DayView";
import AgendaView from "./AgendaView";
import EventModal from "./EventModal";
import TaskModal from "./TaskModal";
import CalendarSidebar from "./CalendarSidebar";

type CalendarViewType = "month" | "week" | "day" | "agenda";

interface CalendarData {
  id: string;
  name: string;
  color: string;
  visibility: string;
  isDefault: boolean;
  isExternal: boolean;
}

interface ProjectData {
  id: string;
  name: string;
  color: string;
}

const CALENDAR_API_URL = `${SB_API_BASE}/api/calendar`;

// Inline getOrCreateUserId to avoid extra dependency
function getOrCreateUserId(): string {
  const STORAGE_KEY = "streetbot:user-id";
  const DEFAULT_ID = "demo-user";
  if (typeof window === "undefined") return DEFAULT_ID;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && stored !== DEFAULT_ID && stored !== "anonymous") return stored;
  return DEFAULT_ID;
}

export default function CalendarPage() {
  const { isDark, colors: sharedColors, glassCard, glassSurface, glassButton, accentButton, gradientOrbs } = useGlassStyles();
  const { isMobile } = useResponsive();
  const userId = getOrCreateUserId();
  const navigate = useNavigate();

  // Core state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>(isMobile ? "agenda" : "month");
  const [calendars, setCalendars] = useState<CalendarData[]>([]);
  const [events, setEvents] = useState<CalendarItem[]>([]);
  const [tasks, setTasks] = useState<CalendarItem[]>([]);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarItem | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showSidebar, setShowSidebar] = useState(!isMobile);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [showCreateCalendarModal, setShowCreateCalendarModal] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState("");
  const [newCalendarColor, setNewCalendarColor] = useState("#FFD700");

  // Task modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CalendarItem | null>(null);
  const [taskModalMode, setTaskModalMode] = useState<"view" | "create">("view");

  // Google integration state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Extend shared colors with page-specific calendar colors
  const colors = useMemo(
    () => ({
      ...sharedColors,
      borderLight: isDark ? "rgba(255, 255, 255, 0.10)" : "rgba(255, 255, 255, 0.3)",
      accentHover: "#FFC000",
      today: isDark ? "rgba(255, 214, 0, 0.15)" : "rgba(255, 214, 0, 0.25)",
      weekend: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)",
      glassGlow: isDark
        ? "0 0 0 1px rgba(255, 255, 255, 0.1)"
        : "0 0 0 1px rgba(255, 255, 255, 0.4)",
    }),
    [sharedColors, isDark]
  );

  // Get date range for current view
  const getDateRange = useCallback(() => {
    switch (view) {
      case "month": {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        return {
          start: startOfWeek(monthStart),
          end: endOfWeek(monthEnd),
        };
      }
      case "week":
        return {
          start: startOfWeek(currentDate),
          end: endOfWeek(currentDate),
        };
      case "day":
        return {
          start: startOfDay(currentDate),
          end: endOfDay(currentDate),
        };
      case "agenda":
        return {
          start: startOfDay(currentDate),
          end: addDays(currentDate, 30),
        };
      default:
        return {
          start: startOfMonth(currentDate),
          end: endOfMonth(currentDate),
        };
    }
  }, [currentDate, view]);

  // Create default calendars for a new user
  const createDefaultCalendars = useCallback(async (): Promise<CalendarData[]> => {
    const defaults = [
      { name: "Personal", color: "#FFD700", is_default: true },
      { name: "Work", color: "#3b82f6", is_default: false },
      { name: "Community Events", color: "#22c55e", is_default: false },
    ];
    const created: CalendarData[] = [];
    for (const cal of defaults) {
      try {
        const resp = await fetch(`${CALENDAR_API_URL}/calendars`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, ...cal }),
        });
        if (resp.ok) {
          const c = await resp.json();
          created.push({
            id: c.id,
            name: c.name,
            color: c.color,
            visibility: c.visibility,
            isDefault: c.is_default,
            isExternal: c.is_external,
          });
        }
      } catch (err) {
        console.error("Failed to create default calendar:", err);
      }
    }
    return created;
  }, [userId]);

  // Fetch calendars (auto-create defaults if none exist)
  const fetchCalendars = useCallback(async () => {
    try {
      const resp = await fetch(
        `${CALENDAR_API_URL}/calendars?user_id=${encodeURIComponent(userId)}`
      );
      if (resp.ok) {
        let data = await resp.json();

        // Auto-create default calendars for new users
        if (Array.isArray(data) && data.length === 0) {
          const created = await createDefaultCalendars();
          if (created.length > 0) {
            setCalendars(created);
            setSelectedCalendarIds(created.map((c) => c.id));
            return;
          }
        }

        setCalendars(
          data.map((c: any) => ({
            id: c.id,
            name: c.name,
            color: c.color,
            visibility: c.visibility,
            isDefault: c.is_default,
            isExternal: c.is_external,
          }))
        );
        if (selectedCalendarIds.length === 0) {
          setSelectedCalendarIds(data.map((c: any) => c.id));
        }
      }
    } catch (err) {
      console.error("Failed to fetch calendars:", err);
    }
  }, [userId, selectedCalendarIds.length, createDefaultCalendars]);

  // Fetch events and tasks
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { start, end } = getDateRange();
      const params = new URLSearchParams({
        user_id: userId,
        start: start.toISOString(),
        end: end.toISOString(),
        include_tasks: "true",
      });

      // Fetch all events for the user; filtering by visible calendars is done
      // client-side in allItems so toggling calendars is instant without re-fetch.
      const resp = await fetch(`${CALENDAR_API_URL}/events?${params}`);

      if (resp.ok) {
        const data = await resp.json();

        const parsedEvents = parseApiEvents(data.events || []).map((e) => {
          const cal = calendars.find((c) => c.id === e.calendarId);
          return { ...e, color: cal?.color || e.color };
        });

        setEvents(parsedEvents);
        setTasks(parseApiTasks(data.tasks || []));
      } else {
        setError("Failed to load calendar events");
      }
    } catch (err) {
      console.error("Failed to fetch events:", err);
      setError("Failed to load calendar events");
    } finally {
      setLoading(false);
    }
  }, [userId, getDateRange, calendars]);

  // Check Google connection status
  const checkGoogleStatus = useCallback(async () => {
    try {
      const resp = await fetch(
        `${SB_API_BASE}/api/integrations/google/status?user_id=${encodeURIComponent(userId)}`
      );
      if (resp.ok) {
        const data = await resp.json();
        setGoogleConnected(data.connected);
      }
    } catch (err) {
      console.error("Failed to check Google status:", err);
    }
  }, [userId]);

  // Fetch projects for task creation
  const fetchProjects = useCallback(async () => {
    try {
      const resp = await fetch(`${SB_API_BASE}/api/projects?user_id=${encodeURIComponent(userId)}`);
      if (resp.ok) {
        const data = await resp.json();
        setProjects(
          data.map((p: any) => ({
            id: p.id,
            name: p.name,
            color: p.color || "#FFD700",
          }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    fetchCalendars();
    checkGoogleStatus();
    fetchProjects();
  }, [fetchCalendars, checkGoogleStatus, fetchProjects]);

  // Fetch events when date/view/calendars change
  useEffect(() => {
    if (calendars.length > 0) {
      fetchEvents();
    }
  }, [currentDate, view, calendars, fetchEvents]);

  // Combined items for views, filtered by selected (visible) calendars
  const allItems = useMemo(() => {
    const combined = [...events, ...tasks];
    // If no calendar toggle filtering active, show all items
    if (selectedCalendarIds.length === 0 || selectedCalendarIds.length === calendars.length) {
      return combined;
    }
    // Filter to only show events from selected calendars
    return combined.filter(
      (item) => !item.calendarId || selectedCalendarIds.includes(item.calendarId)
    );
  }, [events, tasks, selectedCalendarIds, calendars.length]);

  // Navigation
  const navigatePrev = () => {
    switch (view) {
      case "month":
        setCurrentDate(addMonths(currentDate, -1));
        break;
      case "week":
        setCurrentDate(addWeeks(currentDate, -1));
        break;
      case "day":
      case "agenda":
        setCurrentDate(addDays(currentDate, -1));
        break;
    }
  };

  const navigateNext = () => {
    switch (view) {
      case "month":
        setCurrentDate(addMonths(currentDate, 1));
        break;
      case "week":
        setCurrentDate(addWeeks(currentDate, 1));
        break;
      case "day":
      case "agenda":
        setCurrentDate(addDays(currentDate, 1));
        break;
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Event handlers
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    if (view === "month") {
      setView("day");
      setCurrentDate(date);
    }
  };

  const handleEventClick = (item: CalendarItem) => {
    setSelectedItem(item);
    if (item.type === "event") {
      setEditingEvent(item);
      setShowEventModal(true);
    } else if (item.type === "task") {
      setSelectedTask(item);
      setTaskModalMode("view");
      setShowTaskModal(true);
    }
  };

  const handleCreateEvent = () => {
    setEditingEvent(null);
    setSelectedDate(currentDate);
    setShowEventModal(true);
  };

  const handleSaveEvent = async (eventData: any) => {
    try {
      const method = editingEvent ? "PATCH" : "POST";
      const url = editingEvent
        ? `${CALENDAR_API_URL}/events/${editingEvent.id}`
        : `${CALENDAR_API_URL}/events`;

      const resp = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
      });

      if (resp.ok) {
        setShowEventModal(false);
        setEditingEvent(null);
        fetchEvents();
      }
    } catch (err) {
      console.error("Failed to save event:", err);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const resp = await fetch(`${CALENDAR_API_URL}/events/${eventId}`, {
        method: "DELETE",
      });
      if (resp.ok) {
        setShowEventModal(false);
        setEditingEvent(null);
        fetchEvents();
      }
    } catch (err) {
      console.error("Failed to delete event:", err);
    }
  };

  const handleToggleCalendar = (calendarId: string) => {
    setSelectedCalendarIds((prev) =>
      prev.includes(calendarId)
        ? prev.filter((id) => id !== calendarId)
        : [...prev, calendarId]
    );
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch(`${SB_API_BASE}/api/integrations/google/sync?user_id=${encodeURIComponent(userId)}`, {
        method: "POST",
      });
      await fetchEvents();
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  // Task handlers
  const handleCreateTask = () => {
    setSelectedTask(null);
    setTaskModalMode("create");
    setSelectedDate(currentDate);
    setShowTaskModal(true);
  };

  const handleSaveTask = async (taskData: any) => {
    try {
      const resp = await fetch(`${CALENDAR_API_URL}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          ...taskData,
        }),
      });

      if (resp.ok) {
        setShowTaskModal(false);
        setSelectedTask(null);
        fetchEvents();
      }
    } catch (err) {
      console.error("Failed to create task:", err);
    }
  };

  const handleCompleteTask = async () => {
    if (!selectedTask) return;

    try {
      const resp = await fetch(`${CALENDAR_API_URL}/tasks/${selectedTask.id}/complete`, {
        method: "PATCH",
      });

      if (resp.ok) {
        const updatedTask = await resp.json();
        setSelectedTask({
          ...selectedTask,
          taskStatus: updatedTask.task_status,
        });
        fetchEvents();
      }
    } catch (err) {
      console.error("Failed to toggle task completion:", err);
    }
  };

  const handleScheduleWorkSession = async (
    taskId: string,
    calendarId: string,
    startAt: Date,
    endAt: Date
  ) => {
    try {
      const resp = await fetch(`${CALENDAR_API_URL}/tasks/${taskId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          calendar_id: calendarId,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
        }),
      });

      if (resp.ok) {
        setShowTaskModal(false);
        fetchEvents();
      }
    } catch (err) {
      console.error("Failed to schedule work session:", err);
    }
  };

  const handleViewInTasks = () => {
    if (selectedTask) {
      navigate(`/tasks?task=${selectedTask.id}`);
    }
  };

  // Get header title
  const getHeaderTitle = () => {
    switch (view) {
      case "month":
        return formatMonthYear(currentDate);
      case "week": {
        const weekStart = startOfWeek(currentDate);
        const weekEnd = endOfWeek(currentDate);
        return `${formatDateShort(weekStart)} - ${formatDateShort(weekEnd)}`;
      }
      case "day":
        return `${formatDayName(currentDate)}, ${formatDate(currentDate)}`;
      case "agenda":
        return "Upcoming Events";
      default:
        return formatMonthYear(currentDate);
    }
  };

  // View icons
  const viewIcons: Record<CalendarViewType, React.ReactNode> = {
    month: <Grid3X3 size={16} />,
    week: <CalendarDays size={16} />,
    day: <LayoutGrid size={16} />,
    agenda: <List size={16} />,
  };

  return (
    <div>
      <GlassBackground />

      {/* Main Calendar Container */}
      <div
        style={{
          display: "flex",
          height: isMobile ? "calc(100vh - 60px)" : "calc(100vh - 80px)",
          background: colors.cardBg,
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderRadius: isMobile ? "12px" : "24px",
          overflow: "hidden",
          border: `1px solid ${colors.border}`,
          boxShadow: colors.glassShadow,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Sidebar — overlay on mobile */}
        {showSidebar && isMobile && (
          <div
            onClick={() => setShowSidebar(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 10,
            }}
          />
        )}
        {showSidebar && (
          <div style={isMobile ? { position: "absolute", top: 0, left: 0, bottom: 0, zIndex: 11, width: "260px" } : undefined}>

          <CalendarSidebar
            colors={colors}
            calendars={calendars}
            selectedCalendarIds={selectedCalendarIds}
            onToggleCalendar={handleToggleCalendar}
            currentDate={currentDate}
            onDateSelect={(date) => {
              setCurrentDate(date);
              setView("day");
            }}
            googleConnected={googleConnected}
            onGoogleConnect={() => {
              window.location.href = `${SB_API_BASE}/api/integrations/google/connect?user_id=${encodeURIComponent(userId)}`;
            }}
            onCreateCalendar={() => {
              setNewCalendarName("");
              setNewCalendarColor("#FFD700");
              setShowCreateCalendarModal(true);
            }}
          />
          </div>
        )}

        {/* Main Content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Header - Glass styling */}
          <div
            style={{
              padding: isMobile ? "10px 12px" : "16px 24px",
              borderBottom: `1px solid ${colors.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: colors.surface,
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              gap: isMobile ? "8px" : undefined,
              flexWrap: isMobile ? "wrap" : undefined,
            }}
          >
            {/* Left: Navigation */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                style={{
                  padding: "10px",
                  background: colors.surface,
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: `1px solid ${colors.border}`,
                  cursor: "pointer",
                  color: colors.textSecondary,
                  borderRadius: "12px",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.surfaceHover;
                  e.currentTarget.style.borderColor = colors.borderHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colors.surface;
                  e.currentTarget.style.borderColor = colors.border;
                }}
              >
                <CalendarIcon size={20} />
              </button>

              <button
                onClick={goToToday}
                style={{
                  padding: "10px 18px",
                  background: colors.surface,
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: `1px solid ${colors.border}`,
                  borderRadius: "12px",
                  cursor: "pointer",
                  color: colors.text,
                  fontWeight: 500,
                  fontSize: "14px",
                  boxShadow: colors.glassShadow,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.surfaceHover;
                  e.currentTarget.style.borderColor = colors.borderHover;
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colors.surface;
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                Today
              </button>

              <div
                style={{
                  display: "flex",
                  gap: "4px",
                  background: colors.surface,
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  padding: "4px",
                  borderRadius: "12px",
                  border: `1px solid ${colors.border}`,
                }}
              >
                <button
                  onClick={navigatePrev}
                  style={{
                    padding: "8px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: colors.textSecondary,
                    borderRadius: "8px",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.surfaceHover;
                    e.currentTarget.style.color = colors.text;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = colors.textSecondary;
                  }}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={navigateNext}
                  style={{
                    padding: "8px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: colors.textSecondary,
                    borderRadius: "8px",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.surfaceHover;
                    e.currentTarget.style.color = colors.text;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = colors.textSecondary;
                  }}
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <h1
                style={{
                  fontSize: isMobile ? "1rem" : "20px",
                  fontWeight: 600,
                  color: colors.text,
                  margin: 0,
                  minWidth: isMobile ? undefined : "220px",
                }}
              >
                {getHeaderTitle()}
              </h1>
            </div>

            {/* Center: View Switcher - Glass styling */}
            <div
              style={{
                display: "flex",
                gap: "4px",
                padding: "5px",
                background: colors.surface,
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                borderRadius: "16px",
                border: `1px solid ${colors.border}`,
                boxShadow: colors.glassShadow,
              }}
            >
              {(["month", "week", "day", "agenda"] as CalendarViewType[]).map(
                (v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    style={{
                      padding: isMobile ? "8px 10px" : "8px 16px",
                      background: view === v ? colors.accent : "transparent",
                      border: "none",
                      borderRadius: "10px",
                      cursor: "pointer",
                      color: view === v ? "#000" : colors.textSecondary,
                      fontWeight: view === v ? 600 : 400,
                      fontSize: "13px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: view === v ? "0 4px 12px rgba(255, 214, 0, 0.3)" : "none",
                      textTransform: "capitalize",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (view !== v) {
                        e.currentTarget.style.background = colors.surfaceHover;
                        e.currentTarget.style.color = colors.text;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (view !== v) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = colors.textSecondary;
                      }
                    }}
                  >
                    {viewIcons[v]}
                    {!isMobile && v}
                  </button>
                )
              )}
            </div>

            {/* Right: Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "6px" : "12px" }}>
              {googleConnected && (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  style={{
                    padding: "10px",
                    background: colors.surface,
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: `1px solid ${colors.border}`,
                    cursor: syncing ? "default" : "pointer",
                    color: syncing ? colors.textMuted : colors.textSecondary,
                    borderRadius: "12px",
                    transition: "all 0.2s ease",
                  }}
                  title="Sync with Google Calendar"
                  onMouseEnter={(e) => {
                    if (!syncing) {
                      e.currentTarget.style.background = colors.surfaceHover;
                      e.currentTarget.style.borderColor = colors.borderHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.surface;
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  <RefreshCw
                    size={18}
                    style={{
                      animation: syncing ? "spin 1s linear infinite" : "none",
                    }}
                  />
                </button>
              )}

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={handleCreateTask}
                  style={{
                    padding: "10px 16px",
                    background: colors.surface,
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: `1px solid ${colors.border}`,
                    borderRadius: "12px",
                    cursor: "pointer",
                    color: colors.text,
                    fontWeight: 500,
                    fontSize: "14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.surfaceHover;
                    e.currentTarget.style.borderColor = colors.borderHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.surface;
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                  title="Create Task"
                >
                  <CheckSquare size={16} />
                  {!isMobile && "Task"}
                </button>
                <button
                  onClick={handleCreateEvent}
                  style={{
                    padding: "10px 20px",
                    background: colors.accent,
                    border: "none",
                    borderRadius: "12px",
                    cursor: "pointer",
                    color: "#000",
                    fontWeight: 600,
                    fontSize: "14px",
                    display: "flex",
                    alignItems: "center",
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
                  title="Create Event"
                >
                  <Plus size={18} />
                  {!isMobile && "Event"}
                </button>
              </div>
            </div>
          </div>

          {/* Calendar View - Glass container */}
          <div
            style={{
              flex: 1,
              overflow: "auto",
              background: "transparent",
              padding: isMobile ? "8px" : "16px",
            }}
          >
            {loading && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  color: colors.textSecondary,
                  padding: "20px 32px",
                  background: colors.surface,
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  borderRadius: "16px",
                  border: `1px solid ${colors.border}`,
                  boxShadow: colors.glassShadow,
                }}
              >
                Loading...
              </div>
            )}

            {error && (
              <div
                style={{
                  padding: "20px 32px",
                  textAlign: "center",
                  color: colors.error,
                  background: "rgba(239, 68, 68, 0.1)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  borderRadius: "16px",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  margin: "16px",
                }}
              >
                {error}
              </div>
            )}

            {!loading && !error && (
              <>
                {view === "month" && (
                  <MonthView
                    colors={colors}
                    currentDate={currentDate}
                    events={allItems}
                    onDateClick={handleDateClick}
                    onEventClick={handleEventClick}
                  />
                )}
                {view === "week" && (
                  <WeekView
                    colors={colors}
                    currentDate={currentDate}
                    events={allItems}
                    onDateClick={handleDateClick}
                    onEventClick={handleEventClick}
                    onTimeSlotClick={(date) => {
                      setSelectedDate(date);
                      setShowEventModal(true);
                    }}
                  />
                )}
                {view === "day" && (
                  <DayView
                    colors={colors}
                    currentDate={currentDate}
                    events={allItems}
                    onEventClick={handleEventClick}
                    onTimeSlotClick={(date) => {
                      setSelectedDate(date);
                      setShowEventModal(true);
                    }}
                  />
                )}
                {view === "agenda" && (
                  <AgendaView
                    colors={colors}
                    events={allItems}
                    onEventClick={handleEventClick}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <EventModal
          colors={colors}
          event={editingEvent}
          calendars={calendars}
          selectedDate={selectedDate}
          onSave={handleSaveEvent}
          onDelete={editingEvent ? () => handleDeleteEvent(editingEvent.id) : undefined}
          onClose={() => {
            setShowEventModal(false);
            setEditingEvent(null);
          }}
        />
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <TaskModal
          colors={colors}
          task={selectedTask}
          projects={projects}
          calendars={calendars}
          selectedDate={selectedDate}
          mode={taskModalMode}
          onSave={handleSaveTask}
          onComplete={handleCompleteTask}
          onSchedule={handleScheduleWorkSession}
          onViewInTasks={handleViewInTasks}
          onClose={() => {
            setShowTaskModal(false);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Create Calendar Modal */}
      {showCreateCalendarModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowCreateCalendarModal(false)}
        >
          <div
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: "20px",
              padding: "32px",
              width: "420px",
              maxWidth: "90vw",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 24px", fontSize: "18px", fontWeight: 700, color: colors.text }}>
              Create Calendar
            </h3>

            {/* Name input */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.textSecondary, marginBottom: "8px" }}>
                Name
              </label>
              <input
                type="text"
                value={newCalendarName}
                onChange={(e) => setNewCalendarName(e.target.value)}
                placeholder="e.g., Appointments, Deadlines..."
                autoFocus
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${colors.border}`,
                  borderRadius: "12px",
                  color: colors.text,
                  fontSize: "15px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Color picker */}
            <div style={{ marginBottom: "28px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.textSecondary, marginBottom: "10px" }}>
                Color
              </label>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {["#FFD700", "#3b82f6", "#22c55e", "#ef4444", "#a855f7", "#f97316", "#ec4899", "#06b6d4"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewCalendarColor(c)}
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: c,
                      border: newCalendarColor === c ? "3px solid #fff" : "2px solid transparent",
                      cursor: "pointer",
                      boxShadow: newCalendarColor === c ? `0 0 12px ${c}80` : "none",
                      transition: "all 0.15s",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCreateCalendarModal(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "12px",
                  fontSize: "14px",
                  fontWeight: 600,
                  background: "transparent",
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newCalendarName.trim()) return;
                  try {
                    const resp = await fetch(`${CALENDAR_API_URL}/calendars`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        user_id: userId,
                        name: newCalendarName.trim(),
                        color: newCalendarColor,
                        is_default: false,
                      }),
                    });
                    if (resp.ok) {
                      setShowCreateCalendarModal(false);
                      fetchCalendars();
                    }
                  } catch (err) {
                    console.error("Failed to create calendar:", err);
                  }
                }}
                style={{
                  padding: "10px 24px",
                  borderRadius: "12px",
                  fontSize: "14px",
                  fontWeight: 600,
                  background: colors.accent,
                  color: "#000",
                  border: "none",
                  cursor: "pointer",
                  opacity: newCalendarName.trim() ? 1 : 0.5,
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

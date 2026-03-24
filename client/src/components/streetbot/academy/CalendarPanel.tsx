import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  BookOpen,
  FileText,
  AlertCircle,
  ExternalLink,
  Loader2,
  CalendarDays,
} from "lucide-react";
import {
  getCalendarEvents,
  type MoodleCalendarEvent,
} from "./api/moodle";

interface CalendarPanelProps {
  userId: string;
  colors: Record<string, string>;
}

function getEventTypeColor(eventType: string): { bg: string; text: string; icon: typeof Calendar } {
  switch (eventType) {
    case "due":
      return { bg: "rgba(239, 68, 68, 0.15)", text: "#EF4444", icon: AlertCircle };
    case "course":
      return { bg: "rgba(59, 130, 246, 0.15)", text: "#3B82F6", icon: BookOpen };
    case "group":
      return { bg: "rgba(16, 185, 129, 0.15)", text: "#10B981", icon: FileText };
    default:
      return { bg: "rgba(139, 92, 246, 0.15)", text: "#8B5CF6", icon: Calendar };
  }
}

function formatEventDate(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = d.toDateString() === now.toDateString();
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  if (isToday) {
    return `Today at ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (isTomorrow) {
    return `Tomorrow at ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRelativeTimeLabel(ts: number): { label: string; urgent: boolean } {
  const now = Date.now();
  const eventMs = ts * 1000;
  const diff = eventMs - now;

  if (diff < 0) return { label: "Past due", urgent: true };
  if (diff < 3600000) return { label: `${Math.ceil(diff / 60000)}m left`, urgent: true };
  if (diff < 86400000) return { label: `${Math.ceil(diff / 3600000)}h left`, urgent: true };
  if (diff < 86400000 * 3) return { label: `${Math.ceil(diff / 86400000)}d left`, urgent: false };
  return { label: "", urgent: false };
}

/**
 * Group events by day.
 */
function groupByDay(events: MoodleCalendarEvent[]): Map<string, MoodleCalendarEvent[]> {
  const groups = new Map<string, MoodleCalendarEvent[]>();
  for (const ev of events) {
    const dayKey = new Date(ev.timestart * 1000).toDateString();
    if (!groups.has(dayKey)) groups.set(dayKey, []);
    groups.get(dayKey)!.push(ev);
  }
  return groups;
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function CalendarPanel({ userId, colors }: CalendarPanelProps) {
  const [events, setEvents] = useState<MoodleCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getCalendarEvents(userId);
        setEvents(data);
      } catch (err) {
        console.error("Failed to load calendar events:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2
          className="w-8 h-8 animate-spin"
          style={{ color: colors.accent }}
        />
      </div>
    );
  }

  const grouped = groupByDay(events);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3
          className="text-xl font-semibold flex items-center gap-2"
          style={{ color: colors.text }}
        >
          <CalendarDays className="w-5 h-5" style={{ color: "#3B82F6" }} />
          Upcoming Events
        </h3>
        <span
          className="text-sm px-3 py-1 rounded-full"
          style={{
            background: "rgba(59, 130, 246, 0.1)",
            color: "#3B82F6",
          }}
        >
          {events.length} event{events.length !== 1 ? "s" : ""}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12">
          <Calendar
            className="w-16 h-16 mx-auto mb-4 opacity-30"
            style={{ color: colors.textMuted }}
          />
          <p className="text-lg font-medium" style={{ color: colors.text }}>
            Nothing on the horizon
          </p>
          <p
            className="text-sm mt-1"
            style={{ color: colors.textSecondary }}
          >
            No upcoming events or deadlines right now.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([dayKey, dayEvents]) => (
            <div key={dayKey}>
              {/* Day Header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="h-px flex-1"
                  style={{ background: colors.border }}
                />
                <span
                  className="text-sm font-medium px-3 py-1 rounded-full"
                  style={{
                    background: colors.cardBg,
                    color: colors.textSecondary,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  {getDayLabel(dayKey)}
                </span>
                <div
                  className="h-px flex-1"
                  style={{ background: colors.border }}
                />
              </div>

              {/* Events for this day */}
              <div className="space-y-3">
                {dayEvents.map((ev, index) => {
                  const typeInfo = getEventTypeColor(ev.eventtype);
                  const Icon = typeInfo.icon;
                  const relative = getRelativeTimeLabel(ev.timestart);

                  return (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="flex gap-4 p-4 rounded-xl transition-all"
                      style={{
                        background: colors.cardBg,
                        backdropFilter: "blur(20px)",
                        border: `1px solid ${colors.border}`,
                      }}
                    >
                      {/* Time indicator */}
                      <div className="flex flex-col items-center">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: typeInfo.bg }}
                        >
                          <Icon
                            className="w-5 h-5"
                            style={{ color: typeInfo.text }}
                          />
                        </div>
                        {/* Time line connector for grouped events */}
                        {index < dayEvents.length - 1 && (
                          <div
                            className="w-px flex-1 mt-2"
                            style={{ background: colors.border }}
                          />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className="font-semibold truncate"
                            style={{ color: colors.text }}
                          >
                            {ev.name}
                          </h4>
                          {relative.label && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                              style={{
                                background: relative.urgent
                                  ? "rgba(239, 68, 68, 0.15)"
                                  : "rgba(245, 158, 11, 0.15)",
                                color: relative.urgent ? "#EF4444" : "#F59E0B",
                              }}
                            >
                              {relative.label}
                            </span>
                          )}
                        </div>

                        {ev.coursefullname && (
                          <p
                            className="text-sm mt-0.5"
                            style={{ color: colors.textSecondary }}
                          >
                            {ev.coursefullname}
                          </p>
                        )}

                        <div
                          className="flex items-center gap-3 mt-2 text-xs"
                          style={{ color: colors.textMuted }}
                        >
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatEventDate(ev.timestart)}
                          </span>
                          {ev.timeduration > 0 && (
                            <span>
                              {Math.round(ev.timeduration / 60)} min
                            </span>
                          )}
                          {ev.modulename && (
                            <span
                              className="px-2 py-0.5 rounded"
                              style={{
                                background: typeInfo.bg,
                                color: typeInfo.text,
                              }}
                            >
                              {ev.modulename}
                            </span>
                          )}
                        </div>

                        {ev.action?.url && ev.action.actionable && (
                          <a
                            href={ev.action.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 text-sm font-medium transition-colors"
                            style={{ color: typeInfo.text }}
                          >
                            {ev.action.name || "Open"}
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CalendarPanel;

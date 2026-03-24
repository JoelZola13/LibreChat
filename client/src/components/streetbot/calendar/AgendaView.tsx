import React, { useMemo } from "react";
import {
  CalendarItem,
  formatDate,
  formatTime,
  formatDayName,
  isSameDay,
  isToday,
  addDays,
} from "./calendarUtils";
import { CheckCircle2, Circle, MapPin, Clock, Calendar } from "lucide-react";

interface AgendaViewProps {
  colors: Record<string, string>;
  events: CalendarItem[];
  onEventClick: (event: CalendarItem) => void;
}

interface GroupedEvents {
  date: Date;
  events: CalendarItem[];
}

export default function AgendaView({
  colors,
  events,
  onEventClick,
}: AgendaViewProps) {
  const groupedEvents = useMemo(() => {
    const groups: Map<string, CalendarItem[]> = new Map();

    const sorted = [...events].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );

    sorted.forEach((event) => {
      const dateKey = new Date(event.startAt).toDateString();
      const existing = groups.get(dateKey) || [];
      groups.set(dateKey, [...existing, event]);
    });

    const result: GroupedEvents[] = [];
    groups.forEach((groupEvents, dateKey) => {
      result.push({
        date: new Date(dateKey),
        events: groupEvents,
      });
    });

    return result;
  }, [events]);

  if (events.length === 0) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: colors.textSecondary,
          padding: "40px",
        }}
      >
        <Calendar size={48} style={{ marginBottom: "16px", opacity: 0.5 }} />
        <div style={{ fontSize: "18px", fontWeight: 500, marginBottom: "8px" }}>
          No upcoming events
        </div>
        <div style={{ fontSize: "14px", color: colors.textMuted }}>
          Events and tasks will appear here
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "16px 24px" }}>
      {groupedEvents.map((group) => (
        <DateGroup
          key={group.date.toISOString()}
          date={group.date}
          events={group.events}
          colors={colors}
          onEventClick={onEventClick}
        />
      ))}
    </div>
  );
}

interface DateGroupProps {
  date: Date;
  events: CalendarItem[];
  colors: Record<string, string>;
  onEventClick: (event: CalendarItem) => void;
}

function DateGroup({ date, events, colors, onEventClick }: DateGroupProps) {
  const dayIsToday = isToday(date);
  const isTomorrow = isSameDay(date, addDays(new Date(), 1));

  const getDateLabel = () => {
    if (dayIsToday) return "Today";
    if (isTomorrow) return "Tomorrow";
    return formatDayName(date);
  };

  return (
    <div style={{ marginBottom: "24px" }}>
      {/* Date Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
          padding: "8px 0",
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "12px",
            background: dayIsToday ? colors.accent : colors.surfaceHover,
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontWeight: 500,
              color: dayIsToday ? "#000" : colors.textSecondary,
              textTransform: "uppercase",
            }}
          >
            {formatDayName(date, true).slice(0, 3)}
          </span>
          <span
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: dayIsToday ? "#000" : colors.text,
            }}
          >
            {date.getDate()}
          </span>
        </div>
        <div>
          <div style={{ fontSize: "16px", fontWeight: 600, color: colors.text }}>
            {getDateLabel()}
          </div>
          <div style={{ fontSize: "13px", color: colors.textSecondary }}>
            {formatDate(date)}
          </div>
        </div>
      </div>

      {/* Events List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {events.map((event) => (
          <AgendaEventCard
            key={event.id}
            event={event}
            colors={colors}
            onClick={() => onEventClick(event)}
          />
        ))}
      </div>
    </div>
  );
}

interface AgendaEventCardProps {
  event: CalendarItem;
  colors: Record<string, string>;
  onClick: () => void;
}

function AgendaEventCard({ event, colors, onClick }: AgendaEventCardProps) {
  const isTask = event.type === "task";
  const isCompleted = isTask && event.taskStatus === "done";

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        gap: "12px",
        padding: "12px 16px",
        borderRadius: "12px",
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        cursor: "pointer",
        transition: "all 0.15s ease",
        textDecoration: isCompleted ? "line-through" : "none",
        opacity: isCompleted ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = colors.surfaceHover;
        e.currentTarget.style.borderColor = event.color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = colors.surface;
        e.currentTarget.style.borderColor = colors.border;
      }}
    >
      {/* Color indicator */}
      <div
        style={{
          width: "4px",
          borderRadius: "2px",
          background: event.color,
          flexShrink: 0,
        }}
      />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "4px",
          }}
        >
          {isTask &&
            (isCompleted ? (
              <CheckCircle2 size={16} color={event.color} />
            ) : (
              <Circle size={16} color={event.color} />
            ))}
          <span
            style={{
              fontSize: "15px",
              fontWeight: 500,
              color: colors.text,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {event.title}
          </span>
          {isTask && event.taskPriority && event.taskPriority !== "none" && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: "4px",
                background: event.color,
                color: "#fff",
                textTransform: "uppercase",
              }}
            >
              {event.taskPriority}
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "13px",
            color: colors.textSecondary,
          }}
        >
          {/* Time */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Clock size={14} />
            {event.allDay ? (
              "All day"
            ) : (
              <>
                {formatTime(event.startAt)} - {formatTime(event.endAt)}
              </>
            )}
          </div>

          {/* Location */}
          {event.location && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <MapPin size={14} />
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "200px",
                }}
              >
                {event.location}
              </span>
            </div>
          )}
        </div>

        {/* Description preview */}
        {event.description && (
          <div
            style={{
              fontSize: "13px",
              color: colors.textMuted,
              marginTop: "6px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {event.description}
          </div>
        )}
      </div>
    </div>
  );
}

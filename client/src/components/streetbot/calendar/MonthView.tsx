import React, { useMemo } from "react";
import {
  CalendarItem,
  CalendarDay,
  getMonthDays,
  getEventsForDay,
} from "./calendarUtils";
import { CheckCircle2, Circle } from "lucide-react";

interface MonthViewProps {
  colors: Record<string, string>;
  currentDate: Date;
  events: CalendarItem[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarItem) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_EVENTS = 3;

export default function MonthView({
  colors,
  currentDate,
  events,
  onDateClick,
  onEventClick,
}: MonthViewProps) {
  const days = useMemo(() => {
    return getMonthDays(currentDate.getFullYear(), currentDate.getMonth());
  }, [currentDate]);

  const daysWithEvents = useMemo(() => {
    return days.map((day) => ({
      ...day,
      events: getEventsForDay(events, day.date),
    }));
  }, [days, events]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: colors.cardBg || colors.surface,
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderRadius: "16px",
        border: `1px solid ${colors.border}`,
        overflow: "hidden",
        boxShadow: colors.glassShadow || "0 8px 32px rgba(0, 0, 0, 0.2)",
      }}
    >
      {/* Weekday Headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surface,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {WEEKDAYS.map((day, i) => (
          <div
            key={day}
            style={{
              padding: "14px 8px",
              textAlign: "center",
              fontSize: "12px",
              fontWeight: 600,
              color: i === 0 || i === 6 ? colors.textMuted : colors.textSecondary,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gridTemplateRows: "repeat(6, 1fr)",
        }}
      >
        {daysWithEvents.map((day, index) => (
          <DayCell
            key={index}
            day={day}
            colors={colors}
            onDateClick={onDateClick}
            onEventClick={onEventClick}
          />
        ))}
      </div>
    </div>
  );
}

interface DayCellProps {
  day: CalendarDay;
  colors: Record<string, string>;
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarItem) => void;
}

function DayCell({ day, colors, onDateClick, onEventClick }: DayCellProps) {
  const { date, isCurrentMonth, isToday: dayIsToday, isWeekend, events } = day;
  const visibleEvents = events.slice(0, MAX_VISIBLE_EVENTS);
  const moreCount = events.length - MAX_VISIBLE_EVENTS;

  return (
    <div
      onClick={() => onDateClick(date)}
      style={{
        borderRight: `1px solid ${colors.border}`,
        borderBottom: `1px solid ${colors.border}`,
        padding: "4px",
        minHeight: "100px",
        cursor: "pointer",
        background: dayIsToday
          ? colors.today
          : isWeekend
          ? colors.weekend
          : "transparent",
        opacity: isCurrentMonth ? 1 : 0.4,
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (!dayIsToday) {
          e.currentTarget.style.background = colors.surfaceHover;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = dayIsToday
          ? colors.today
          : isWeekend
          ? colors.weekend
          : "transparent";
      }}
    >
      {/* Date Number */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "4px",
        }}
      >
        <span
          style={{
            width: "28px",
            height: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            fontSize: "13px",
            fontWeight: dayIsToday ? 600 : 400,
            color: dayIsToday ? "#000" : isCurrentMonth ? colors.text : colors.textMuted,
            background: dayIsToday ? colors.accent : "transparent",
          }}
        >
          {date.getDate()}
        </span>
      </div>

      {/* Events */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {visibleEvents.map((event) => (
          <EventPill
            key={event.id}
            event={event}
            colors={colors}
            onClick={(e) => {
              e.stopPropagation();
              onEventClick(event);
            }}
          />
        ))}

        {moreCount > 0 && (
          <div
            style={{
              fontSize: "11px",
              color: colors.textSecondary,
              padding: "2px 6px",
              cursor: "pointer",
            }}
          >
            +{moreCount} more
          </div>
        )}
      </div>
    </div>
  );
}

interface EventPillProps {
  event: CalendarItem;
  colors: Record<string, string>;
  onClick: (e: React.MouseEvent) => void;
}

function EventPill({ event, colors, onClick }: EventPillProps) {
  const isTask = event.type === "task";
  const isCompleted = isTask && event.taskStatus === "done";

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px 8px",
        borderRadius: "6px",
        fontSize: "11px",
        fontWeight: 500,
        background: `${event.color}25`,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        color: event.color,
        borderLeft: `3px solid ${event.color}`,
        cursor: "pointer",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        textDecoration: isCompleted ? "line-through" : "none",
        opacity: isCompleted ? 0.6 : 1,
        transition: "all 0.2s ease",
        boxShadow: `0 2px 4px ${event.color}15`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${event.color}35`;
        e.currentTarget.style.transform = "translateX(2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `${event.color}25`;
        e.currentTarget.style.transform = "translateX(0)";
      }}
    >
      {isTask && (
        isCompleted ? (
          <CheckCircle2 size={10} style={{ flexShrink: 0 }} />
        ) : (
          <Circle size={10} style={{ flexShrink: 0 }} />
        )
      )}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
        {event.title}
      </span>
    </div>
  );
}

import React, { useMemo, useRef, useEffect } from "react";
import {
  CalendarItem,
  getEventsForDay,
  formatTime,
  formatDate,
  formatDayName,
  getHourSlots,
  getEventTopPosition,
  getEventHeight,
  isToday,
} from "./calendarUtils";
import { CheckCircle2, Circle, MapPin, Clock } from "lucide-react";

interface DayViewProps {
  colors: Record<string, string>;
  currentDate: Date;
  events: CalendarItem[];
  onEventClick: (event: CalendarItem) => void;
  onTimeSlotClick: (date: Date) => void;
}

const START_HOUR = 0;
const END_HOUR = 24;

export default function DayView({
  colors,
  currentDate,
  events,
  onEventClick,
  onTimeSlotClick,
}: DayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hours = useMemo(() => getHourSlots(START_HOUR, END_HOUR), []);
  const dayIsToday = isToday(currentDate);

  const dayEvents = useMemo(
    () => getEventsForDay(events, currentDate),
    [events, currentDate]
  );

  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay: CalendarItem[] = [];
    const timed: CalendarItem[] = [];

    dayEvents.forEach((e) => {
      if (e.allDay) {
        allDay.push(e);
      } else {
        timed.push(e);
      }
    });

    return { allDayEvents: allDay, timedEvents: timed };
  }, [dayEvents]);

  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const currentHour = now.getHours();
      const scrollTop = currentHour * 60 - 200;
      scrollRef.current.scrollTop = Math.max(0, scrollTop);
    }
  }, []);

  const now = new Date();
  const currentTimePosition = getEventTopPosition(now, START_HOUR, END_HOUR);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Day Header */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surface,
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: colors.textSecondary,
            textTransform: "uppercase",
            marginBottom: "4px",
          }}
        >
          {formatDayName(currentDate)}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              fontSize: "24px",
              fontWeight: 600,
              color: dayIsToday ? "#000" : colors.text,
              background: dayIsToday ? colors.accent : "transparent",
            }}
          >
            {currentDate.getDate()}
          </div>
          <div>
            <div style={{ fontSize: "14px", color: colors.textSecondary }}>
              {formatDate(currentDate)}
            </div>
            <div style={{ fontSize: "13px", color: colors.textMuted }}>
              {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div
          style={{
            padding: "12px 24px",
            borderBottom: `1px solid ${colors.border}`,
            background: colors.surface,
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 500,
              color: colors.textMuted,
              marginBottom: "8px",
              textTransform: "uppercase",
            }}
          >
            All Day
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {allDayEvents.map((event) => (
              <AllDayEventCard
                key={event.id}
                event={event}
                colors={colors}
                onClick={() => onEventClick(event)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto" }}>
        <div style={{ display: "flex", position: "relative", minHeight: "100%" }}>
          {/* Time labels */}
          <div style={{ width: "80px", flexShrink: 0 }}>
            {hours.map((hour) => (
              <div
                key={hour}
                style={{
                  height: "60px",
                  padding: "0 12px",
                  fontSize: "12px",
                  color: colors.textMuted,
                  textAlign: "right",
                  position: "relative",
                }}
              >
                <span style={{ position: "absolute", top: "-8px", right: "12px" }}>
                  {hour === 0
                    ? "12 AM"
                    : hour < 12
                    ? `${hour} AM`
                    : hour === 12
                    ? "12 PM"
                    : `${hour - 12} PM`}
                </span>
              </div>
            ))}
          </div>

          {/* Events area */}
          <div
            style={{
              flex: 1,
              position: "relative",
              borderLeft: `1px solid ${colors.border}`,
            }}
          >
            {/* Hour lines */}
            {hours.map((hour) => (
              <div
                key={hour}
                onClick={() => {
                  const clickDate = new Date(currentDate);
                  clickDate.setHours(hour, 0, 0, 0);
                  onTimeSlotClick(clickDate);
                }}
                style={{
                  height: "60px",
                  borderBottom: `1px solid ${colors.borderLight}`,
                  cursor: "pointer",
                }}
              />
            ))}

            {/* Current time indicator */}
            {dayIsToday && (
              <div
                style={{
                  position: "absolute",
                  top: `${currentTimePosition}%`,
                  left: 0,
                  right: 0,
                  height: "2px",
                  background: colors.error,
                  zIndex: 5,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: "-5px",
                    top: "-4px",
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: colors.error,
                  }}
                />
              </div>
            )}

            {/* Timed events */}
            {timedEvents.map((event) => (
              <TimedEventCard
                key={event.id}
                event={event}
                colors={colors}
                startHour={START_HOUR}
                endHour={END_HOUR}
                onClick={() => onEventClick(event)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface AllDayEventCardProps {
  event: CalendarItem;
  colors: Record<string, string>;
  onClick: () => void;
}

function AllDayEventCard({ event, colors, onClick }: AllDayEventCardProps) {
  const isTask = event.type === "task";
  const isCompleted = isTask && event.taskStatus === "done";

  return (
    <div
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: "8px",
        background: `${event.color}15`,
        borderLeft: `4px solid ${event.color}`,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        textDecoration: isCompleted ? "line-through" : "none",
        opacity: isCompleted ? 0.6 : 1,
      }}
    >
      {isTask &&
        (isCompleted ? (
          <CheckCircle2 size={16} color={event.color} />
        ) : (
          <Circle size={16} color={event.color} />
        ))}
      <div>
        <div style={{ fontSize: "14px", fontWeight: 500, color: colors.text }}>
          {event.title}
        </div>
        {event.location && (
          <div
            style={{
              fontSize: "12px",
              color: colors.textSecondary,
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginTop: "2px",
            }}
          >
            <MapPin size={12} />
            {event.location}
          </div>
        )}
      </div>
    </div>
  );
}

interface TimedEventCardProps {
  event: CalendarItem;
  colors: Record<string, string>;
  startHour: number;
  endHour: number;
  onClick: () => void;
}

function TimedEventCard({
  event,
  colors,
  startHour,
  endHour,
  onClick,
}: TimedEventCardProps) {
  const top = getEventTopPosition(event.startAt, startHour, endHour);
  const height = getEventHeight(event.startAt, event.endAt, startHour, endHour);
  const isTask = event.type === "task";
  const isCompleted = isTask && event.taskStatus === "done";

  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        top: `${top}%`,
        left: "8px",
        right: "8px",
        height: `${height}%`,
        minHeight: "36px",
        background: `${event.color}`,
        borderRadius: "8px",
        padding: "8px 12px",
        cursor: "pointer",
        overflow: "hidden",
        zIndex: 2,
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        textDecoration: isCompleted ? "line-through" : "none",
        opacity: isCompleted ? 0.6 : 1,
      }}
    >
      <div
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        {isTask &&
          (isCompleted ? <CheckCircle2 size={14} /> : <Circle size={14} />)}
        {event.title}
      </div>
      <div
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,0.85)",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          marginTop: "4px",
        }}
      >
        <Clock size={12} />
        {formatTime(event.startAt)} - {formatTime(event.endAt)}
      </div>
      {event.location && (
        <div
          style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.75)",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            marginTop: "2px",
          }}
        >
          <MapPin size={12} />
          {event.location}
        </div>
      )}
      {event.description && (
        <div
          style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.7)",
            marginTop: "6px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {event.description}
        </div>
      )}
    </div>
  );
}

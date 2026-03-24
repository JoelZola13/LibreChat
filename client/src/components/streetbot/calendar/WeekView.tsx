import React, { useMemo, useRef, useEffect } from "react";
import {
  CalendarItem,
  getWeekDays,
  getEventsForDay,
  formatTime,
  formatDayName,
  getHourSlots,
  getEventTopPosition,
  getEventHeight,
} from "./calendarUtils";
import { CheckCircle2, Circle, MapPin } from "lucide-react";

interface WeekViewProps {
  colors: Record<string, string>;
  currentDate: Date;
  events: CalendarItem[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarItem) => void;
  onTimeSlotClick: (date: Date) => void;
}

const START_HOUR = 6;
const END_HOUR = 22;

export default function WeekView({
  colors,
  currentDate,
  events,
  onDateClick,
  onEventClick,
  onTimeSlotClick,
}: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const hours = useMemo(() => getHourSlots(START_HOUR, END_HOUR), []);

  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay: CalendarItem[] = [];
    const timed: CalendarItem[] = [];

    events.forEach((e) => {
      if (e.allDay) {
        allDay.push(e);
      } else {
        timed.push(e);
      }
    });

    return { allDayEvents: allDay, timedEvents: timed };
  }, [events]);

  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const currentHour = now.getHours();
      const scrollTop = (currentHour - START_HOUR) * 60 - 100;
      scrollRef.current.scrollTop = Math.max(0, scrollTop);
    }
  }, []);

  const now = new Date();
  const currentTimePosition = getEventTopPosition(now, START_HOUR, END_HOUR);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header with day names */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "60px repeat(7, 1fr)",
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surface,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ borderRight: `1px solid ${colors.border}` }} />

        {days.map((day) => (
          <div
            key={day.date.toISOString()}
            onClick={() => onDateClick(day.date)}
            style={{
              padding: "12px 8px",
              textAlign: "center",
              borderRight: `1px solid ${colors.border}`,
              cursor: "pointer",
              background: day.isToday ? colors.today : "transparent",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color: colors.textSecondary,
                textTransform: "uppercase",
                marginBottom: "4px",
              }}
            >
              {formatDayName(day.date, true)}
            </div>
            <div
              style={{
                width: "32px",
                height: "32px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                fontSize: "16px",
                fontWeight: day.isToday ? 600 : 400,
                color: day.isToday ? "#000" : colors.text,
                background: day.isToday ? colors.accent : "transparent",
              }}
            >
              {day.date.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* All-day events row */}
      {allDayEvents.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60px repeat(7, 1fr)",
            borderBottom: `1px solid ${colors.border}`,
            minHeight: "40px",
            background: colors.surface,
          }}
        >
          <div
            style={{
              padding: "8px 4px",
              fontSize: "10px",
              color: colors.textMuted,
              textAlign: "right",
              borderRight: `1px solid ${colors.border}`,
            }}
          >
            ALL DAY
          </div>
          {days.map((day) => {
            const dayAllDayEvents = getEventsForDay(allDayEvents, day.date);
            return (
              <div
                key={day.date.toISOString()}
                style={{
                  padding: "4px",
                  borderRight: `1px solid ${colors.border}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                {dayAllDayEvents.map((event) => (
                  <AllDayEventChip
                    key={event.id}
                    event={event}
                    colors={colors}
                    onClick={() => onEventClick(event)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Scrollable time grid */}
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60px repeat(7, 1fr)",
            position: "relative",
          }}
        >
          {/* Time labels column */}
          <div style={{ borderRight: `1px solid ${colors.border}` }}>
            {hours.map((hour) => (
              <div
                key={hour}
                style={{
                  height: "60px",
                  padding: "0 8px",
                  fontSize: "11px",
                  color: colors.textMuted,
                  textAlign: "right",
                  position: "relative",
                }}
              >
                <span style={{ position: "absolute", top: "-6px", right: "8px" }}>
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

          {/* Day columns */}
          {days.map((day) => {
            const dayTimedEvents = getEventsForDay(timedEvents, day.date);
            return (
              <div
                key={day.date.toISOString()}
                style={{
                  borderRight: `1px solid ${colors.border}`,
                  position: "relative",
                }}
              >
                {/* Hour slots */}
                {hours.map((hour) => (
                  <div
                    key={hour}
                    onClick={() => {
                      const clickDate = new Date(day.date);
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
                {day.isToday && (
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
                {dayTimedEvents.map((event) => (
                  <TimedEventBlock
                    key={event.id}
                    event={event}
                    colors={colors}
                    startHour={START_HOUR}
                    endHour={END_HOUR}
                    onClick={() => onEventClick(event)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface AllDayEventChipProps {
  event: CalendarItem;
  colors: Record<string, string>;
  onClick: () => void;
}

function AllDayEventChip({ event, colors, onClick }: AllDayEventChipProps) {
  const isTask = event.type === "task";
  const isCompleted = isTask && event.taskStatus === "done";

  return (
    <div
      onClick={onClick}
      style={{
        padding: "2px 6px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 500,
        background: event.color,
        color: "#fff",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        textDecoration: isCompleted ? "line-through" : "none",
        opacity: isCompleted ? 0.6 : 1,
      }}
    >
      {isTask &&
        (isCompleted ? <CheckCircle2 size={10} /> : <Circle size={10} />)}
      {event.title}
    </div>
  );
}

interface TimedEventBlockProps {
  event: CalendarItem;
  colors: Record<string, string>;
  startHour: number;
  endHour: number;
  onClick: () => void;
}

function TimedEventBlock({
  event,
  colors,
  startHour,
  endHour,
  onClick,
}: TimedEventBlockProps) {
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
        left: "4px",
        right: "4px",
        height: `${height}%`,
        minHeight: "20px",
        background: `${event.color}ee`,
        borderRadius: "4px",
        padding: "4px 6px",
        cursor: "pointer",
        overflow: "hidden",
        zIndex: 2,
        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
        textDecoration: isCompleted ? "line-through" : "none",
        opacity: isCompleted ? 0.6 : 1,
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        {isTask &&
          (isCompleted ? <CheckCircle2 size={10} /> : <Circle size={10} />)}
        {event.title}
      </div>
      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.8)" }}>
        {formatTime(event.startAt)} - {formatTime(event.endAt)}
      </div>
      {event.location && (
        <div
          style={{
            fontSize: "10px",
            color: "rgba(255,255,255,0.7)",
            display: "flex",
            alignItems: "center",
            gap: "2px",
            marginTop: "2px",
          }}
        >
          <MapPin size={10} />
          {event.location}
        </div>
      )}
    </div>
  );
}

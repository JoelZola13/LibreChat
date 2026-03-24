import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Check,
  Zap,
  CheckSquare,
} from "lucide-react";
import {
  getMonthDays,
  formatMonthYear,
  addMonths,
  isSameDay,
  isToday,
} from "./calendarUtils";

interface CalendarData {
  id: string;
  name: string;
  color: string;
  visibility: string;
  isDefault: boolean;
  isExternal: boolean;
}

interface CalendarSidebarProps {
  colors: Record<string, string>;
  calendars: CalendarData[];
  selectedCalendarIds: string[];
  onToggleCalendar: (calendarId: string) => void;
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  googleConnected: boolean;
  onGoogleConnect: () => void;
  onCreateCalendar: () => void;
}

const WEEKDAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

export default function CalendarSidebar({
  colors,
  calendars,
  selectedCalendarIds,
  onToggleCalendar,
  currentDate,
  onDateSelect,
  googleConnected,
  onGoogleConnect,
  onCreateCalendar,
}: CalendarSidebarProps) {
  const navigate = useNavigate();
  const [miniCalMonth, setMiniCalMonth] = useState(new Date());

  const miniCalDays = useMemo(() => {
    return getMonthDays(miniCalMonth.getFullYear(), miniCalMonth.getMonth());
  }, [miniCalMonth]);

  const localCalendars = calendars.filter((c) => !c.isExternal);
  const externalCalendars = calendars.filter((c) => c.isExternal);

  return (
    <div
      style={{
        width: "260px",
        borderRight: `1px solid ${colors.border}`,
        background: colors.surface,
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Create Button */}
      <div style={{ padding: "16px" }}>
        <button
          onClick={onCreateCalendar}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: colors.accent,
            border: "none",
            borderRadius: "16px",
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
          <Plus size={18} />
          Create
        </button>
      </div>

      {/* Mini Calendar */}
      <div style={{ padding: "0 16px 16px" }}>
        {/* Month Navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <button
            onClick={() => setMiniCalMonth(addMonths(miniCalMonth, -1))}
            style={{
              padding: "6px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: colors.textSecondary,
              borderRadius: "8px",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.surfaceHover || "rgba(255,255,255,0.1)";
              e.currentTarget.style.color = colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = colors.textSecondary;
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: colors.text,
            }}
          >
            {formatMonthYear(miniCalMonth)}
          </span>
          <button
            onClick={() => setMiniCalMonth(addMonths(miniCalMonth, 1))}
            style={{
              padding: "6px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: colors.textSecondary,
              borderRadius: "8px",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.surfaceHover || "rgba(255,255,255,0.1)";
              e.currentTarget.style.color = colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = colors.textSecondary;
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Weekday Headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            marginBottom: "4px",
          }}
        >
          {WEEKDAYS_SHORT.map((day, i) => (
            <div
              key={i}
              style={{
                textAlign: "center",
                fontSize: "10px",
                fontWeight: 500,
                color: colors.textMuted,
                padding: "4px 0",
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "2px",
          }}
        >
          {miniCalDays.map((day, i) => {
            const isSelected = isSameDay(day.date, currentDate);
            const dayIsToday = isToday(day.date);

            return (
              <button
                key={i}
                onClick={() => onDateSelect(day.date)}
                style={{
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: isSelected || dayIsToday ? 600 : 400,
                  color: isSelected
                    ? "#000"
                    : day.isCurrentMonth
                    ? dayIsToday
                      ? colors.accent
                      : colors.text
                    : colors.textMuted,
                  background: isSelected
                    ? colors.accent
                    : dayIsToday
                    ? `${colors.accent}20`
                    : "transparent",
                  border: "none",
                  borderRadius: "50%",
                  cursor: "pointer",
                  transition: "all 0.1s ease",
                }}
              >
                {day.date.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendars List */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 16px" }}>
        {/* My Calendars */}
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: colors.textSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              My Calendars
            </span>
            <button
              onClick={onCreateCalendar}
              style={{
                padding: "4px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: colors.textSecondary,
                borderRadius: "4px",
              }}
            >
              <Plus size={14} />
            </button>
          </div>

          {localCalendars.map((cal) => (
            <CalendarListItem
              key={cal.id}
              calendar={cal}
              colors={colors}
              isSelected={selectedCalendarIds.includes(cal.id)}
              onToggle={() => onToggleCalendar(cal.id)}
            />
          ))}
        </div>

        {/* Google Calendars */}
        {googleConnected && externalCalendars.length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <span
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: colors.textSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "8px",
              }}
            >
              Google Calendars
            </span>

            {externalCalendars.map((cal) => (
              <CalendarListItem
                key={cal.id}
                calendar={cal}
                colors={colors}
                isSelected={selectedCalendarIds.includes(cal.id)}
                onToggle={() => onToggleCalendar(cal.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* View Tasks Button */}
      <div
        style={{
          padding: "0 16px 16px",
        }}
      >
        <button
          onClick={() => navigate("/tasks")}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: colors.surface,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: `1px solid ${colors.border}`,
            borderRadius: "12px",
            color: colors.text,
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.surfaceHover || "rgba(255,255,255,0.12)";
            e.currentTarget.style.borderColor = colors.accent;
            e.currentTarget.style.color = colors.accent;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = colors.surface;
            e.currentTarget.style.borderColor = colors.border;
            e.currentTarget.style.color = colors.text;
          }}
        >
          <CheckSquare size={16} />
          View All Tasks
        </button>
      </div>

      {/* Google Connect */}
      <div
        style={{
          padding: "16px",
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        {googleConnected ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 16px",
              background: "rgba(34, 197, 94, 0.15)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderRadius: "12px",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              fontSize: "13px",
              color: colors.success,
            }}
          >
            <Check size={16} />
            Google Calendar connected
          </div>
        ) : (
          <button
            onClick={onGoogleConnect}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: colors.surface,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: `1px solid ${colors.border}`,
              borderRadius: "12px",
              color: colors.text,
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.surfaceHover || "rgba(255,255,255,0.12)";
              e.currentTarget.style.borderColor = colors.borderHover || "rgba(255,255,255,0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.surface;
              e.currentTarget.style.borderColor = colors.border;
            }}
          >
            <Zap size={16} />
            Connect Google Calendar
          </button>
        )}
      </div>
    </div>
  );
}

interface CalendarListItemProps {
  calendar: CalendarData;
  colors: Record<string, string>;
  isSelected: boolean;
  onToggle: () => void;
}

function CalendarListItem({
  calendar,
  colors,
  isSelected,
  onToggle,
}: CalendarListItemProps) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 12px",
        borderRadius: "10px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        border: "1px solid transparent",
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
      {/* Checkbox */}
      <div
        style={{
          width: "18px",
          height: "18px",
          borderRadius: "6px",
          border: isSelected ? "none" : `2px solid ${colors.border}`,
          background: isSelected ? calendar.color : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: isSelected ? `0 2px 8px ${calendar.color}40` : "none",
          transition: "all 0.2s ease",
        }}
      >
        {isSelected && <Check size={12} color="#fff" />}
      </div>

      {/* Name */}
      <span
        style={{
          fontSize: "13px",
          fontWeight: isSelected ? 500 : 400,
          color: colors.text,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {calendar.name}
      </span>

      {/* Default indicator */}
      {calendar.isDefault && (
        <span
          style={{
            fontSize: "10px",
            fontWeight: 500,
            color: colors.accent,
            marginLeft: "auto",
            padding: "2px 6px",
            background: "rgba(255, 214, 0, 0.15)",
            borderRadius: "4px",
          }}
        >
          Default
        </span>
      )}
    </div>
  );
}

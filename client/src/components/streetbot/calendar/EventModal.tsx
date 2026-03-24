import React, { useState } from "react";
import {
  X,
  Calendar,
  Clock,
  MapPin,
  AlignLeft,
  Bell,
  Trash2,
  Check,
  MessageCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CalendarItem } from "./calendarUtils";

interface CalendarData {
  id: string;
  name: string;
  color: string;
}

interface EventModalProps {
  colors: Record<string, string>;
  event: CalendarItem | null;
  calendars: CalendarData[];
  selectedDate: Date | null;
  onSave: (eventData: any) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export default function EventModal({
  colors,
  event,
  calendars,
  selectedDate,
  onSave,
  onDelete,
  onClose,
}: EventModalProps) {
  const navigate = useNavigate();
  const isEditing = !!event;

  const [title, setTitle] = useState(event?.title || "");
  const [description, setDescription] = useState(event?.description || "");
  const [location, setLocation] = useState(event?.location || "");
  const [calendarId, setCalendarId] = useState(
    event?.calendarId || calendars[0]?.id || ""
  );
  const [allDay, setAllDay] = useState(event?.allDay || false);
  const [startDate, setStartDate] = useState(
    event?.startAt
      ? new Date(event.startAt).toISOString().slice(0, 10)
      : selectedDate
      ? selectedDate.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState(
    event?.startAt
      ? new Date(event.startAt).toTimeString().slice(0, 5)
      : "09:00"
  );
  const [endDate, setEndDate] = useState(
    event?.endAt
      ? new Date(event.endAt).toISOString().slice(0, 10)
      : selectedDate
      ? selectedDate.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [endTime, setEndTime] = useState(
    event?.endAt
      ? new Date(event.endAt).toTimeString().slice(0, 5)
      : "10:00"
  );
  const [reminder, setReminder] = useState<number | null>(15);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    const start = allDay
      ? new Date(`${startDate}T00:00:00`)
      : new Date(`${startDate}T${startTime}:00`);

    const end = allDay
      ? new Date(`${endDate}T23:59:59`)
      : new Date(`${endDate}T${endTime}:00`);

    onSave({
      calendar_id: calendarId,
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      all_day: allDay,
      status: "confirmed",
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: colors.cardBg || colors.surface,
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderRadius: "24px",
          width: "100%",
          maxWidth: "500px",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: colors.glassShadow || "0 20px 60px rgba(0,0,0,0.4)",
          border: `1px solid ${colors.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: colors.surface,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: colors.text }}>
            {isEditing ? "Edit Event" : "New Event"}
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: "8px",
              background: "transparent",
              border: "1px solid transparent",
              cursor: "pointer",
              color: colors.textSecondary,
              borderRadius: "10px",
              transition: "all 0.2s ease",
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
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add title"
            autoFocus
            style={{
              width: "100%",
              padding: "14px 18px",
              fontSize: "18px",
              fontWeight: 500,
              background: colors.surface,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: `1px solid ${colors.border}`,
              borderRadius: "14px",
              color: colors.text,
              marginBottom: "24px",
              outline: "none",
              transition: "all 0.2s ease",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = colors.accent;
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255, 214, 0, 0.15)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = colors.border;
              e.currentTarget.style.boxShadow = "none";
            }}
          />

          {/* Calendar Selector */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                color: colors.textSecondary,
                marginBottom: "8px",
              }}
            >
              <Calendar size={16} />
              Calendar
            </label>
            <select
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: "14px",
                background: colors.surfaceHover,
                border: `1px solid ${colors.border}`,
                borderRadius: "8px",
                color: colors.text,
                cursor: "pointer",
                outline: "none",
              }}
            >
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.name}
                </option>
              ))}
            </select>
          </div>

          {/* All Day Toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                color: colors.text,
                fontSize: "14px",
              }}
            >
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                style={{
                  width: "18px",
                  height: "18px",
                  accentColor: colors.accent,
                }}
              />
              All day
            </label>
          </div>

          {/* Date/Time Pickers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: allDay ? "1fr" : "1fr 1fr",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            {/* Start */}
            <div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: colors.textSecondary,
                  marginBottom: "8px",
                }}
              >
                <Clock size={16} />
                Start
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    fontSize: "14px",
                    background: colors.surfaceHover,
                    border: `1px solid ${colors.border}`,
                    borderRadius: "8px",
                    color: colors.text,
                    outline: "none",
                  }}
                />
                {!allDay && (
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={{
                      width: "120px",
                      padding: "10px 12px",
                      fontSize: "14px",
                      background: colors.surfaceHover,
                      border: `1px solid ${colors.border}`,
                      borderRadius: "8px",
                      color: colors.text,
                      outline: "none",
                    }}
                  />
                )}
              </div>
            </div>

            {/* End */}
            <div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: colors.textSecondary,
                  marginBottom: "8px",
                }}
              >
                <Clock size={16} />
                End
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    fontSize: "14px",
                    background: colors.surfaceHover,
                    border: `1px solid ${colors.border}`,
                    borderRadius: "8px",
                    color: colors.text,
                    outline: "none",
                  }}
                />
                {!allDay && (
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    style={{
                      width: "120px",
                      padding: "10px 12px",
                      fontSize: "14px",
                      background: colors.surfaceHover,
                      border: `1px solid ${colors.border}`,
                      borderRadius: "8px",
                      color: colors.text,
                      outline: "none",
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Location */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                color: colors.textSecondary,
                marginBottom: "8px",
              }}
            >
              <MapPin size={16} />
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add location"
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: "14px",
                background: colors.surfaceHover,
                border: `1px solid ${colors.border}`,
                borderRadius: "8px",
                color: colors.text,
                outline: "none",
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                color: colors.textSecondary,
                marginBottom: "8px",
              }}
            >
              <AlignLeft size={16} />
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description"
              rows={3}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: "14px",
                background: colors.surfaceHover,
                border: `1px solid ${colors.border}`,
                borderRadius: "8px",
                color: colors.text,
                outline: "none",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Reminder */}
          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                color: colors.textSecondary,
                marginBottom: "8px",
              }}
            >
              <Bell size={16} />
              Reminder
            </label>
            <select
              value={reminder ?? "none"}
              onChange={(e) =>
                setReminder(e.target.value === "none" ? null : parseInt(e.target.value))
              }
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: "14px",
                background: colors.surfaceHover,
                border: `1px solid ${colors.border}`,
                borderRadius: "8px",
                color: colors.text,
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="none">No reminder</option>
              <option value="0">At time of event</option>
              <option value="5">5 minutes before</option>
              <option value="15">15 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">1 hour before</option>
              <option value="1440">1 day before</option>
            </select>
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "space-between",
              paddingTop: "8px",
            }}
          >
            <div style={{ display: "flex", gap: "12px" }}>
              {isEditing && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  style={{
                    padding: "12px 18px",
                    background: "rgba(239, 68, 68, 0.1)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "12px",
                    color: colors.error,
                    fontSize: "14px",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                    e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.5)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                    e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
                  }}
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              )}

              {/* Discuss Event */}
              {isEditing && title && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    const context = encodeURIComponent(
                      `I'd like to discuss the event "${title}"${location ? ` at ${location}` : ""}. Can you help me coordinate or prepare for it?`
                    );
                    navigate(`/chat?context=${context}`);
                  }}
                  style={{
                    padding: "12px 18px",
                    background: "rgba(255, 214, 0, 0.1)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: "1px solid rgba(255, 214, 0, 0.3)",
                    borderRadius: "12px",
                    color: colors.accent,
                    fontSize: "14px",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 214, 0, 0.2)";
                    e.currentTarget.style.borderColor = "rgba(255, 214, 0, 0.5)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 214, 0, 0.1)";
                    e.currentTarget.style.borderColor = "rgba(255, 214, 0, 0.3)";
                  }}
                >
                  <MessageCircle size={16} />
                  Discuss
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px", marginLeft: "auto" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "12px 20px",
                  background: colors.surface,
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: `1px solid ${colors.border}`,
                  borderRadius: "12px",
                  color: colors.text,
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.surfaceHover || "rgba(255,255,255,0.1)";
                  e.currentTarget.style.borderColor = colors.borderHover || colors.border;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colors.surface;
                  e.currentTarget.style.borderColor = colors.border;
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                style={{
                  padding: "12px 24px",
                  background: title.trim() ? colors.accent : colors.textMuted,
                  border: "none",
                  borderRadius: "12px",
                  color: title.trim() ? "#000" : colors.textSecondary,
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: title.trim() ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: title.trim() ? "0 4px 14px rgba(255, 214, 0, 0.4)" : "none",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (title.trim()) {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 20px rgba(255, 214, 0, 0.5)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = title.trim() ? "0 4px 14px rgba(255, 214, 0, 0.4)" : "none";
                }}
              >
                <Check size={16} />
                {isEditing ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Video,
  BookOpen,
  Wrench,
  MessageCircle,
  Clock,
  Users,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  LogIn,
  LogOut,
} from "lucide-react";
import {
  LiveSession,
  getStatusColor,
  getSessionTypeLabel,
  formatDuration,
  formatTime,
  formatDate,
  isSessionLive,
  isSessionUpcoming,
  getTimeUntilSession,
  checkIn,
  checkOut,
} from "./api/attendance";

interface SessionCardProps {
  session: LiveSession;
  userId: string;
  isCheckedIn?: boolean;
  onCheckIn?: () => void;
  onCheckOut?: () => void;
}

const sessionTypeIcons = {
  class: BookOpen,
  workshop: Wrench,
  webinar: Video,
  office_hours: MessageCircle,
};

export function SessionCard({
  session,
  userId,
  isCheckedIn = false,
  onCheckIn,
  onCheckOut,
}: SessionCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState(isCheckedIn);

  const IconComponent = sessionTypeIcons[session.sessionType] || Video;
  const isLive = isSessionLive(session);
  const isUpcoming = isSessionUpcoming(session);
  const statusColor = getStatusColor(session.status);

  const handleCheckIn = async () => {
    setIsLoading(true);
    try {
      await checkIn(session.id, userId);
      setCheckedIn(true);
      onCheckIn?.();
    } catch (error) {
      console.error("Check-in failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setIsLoading(true);
    try {
      await checkOut(session.id, userId);
      setCheckedIn(false);
      onCheckOut?.();
    } catch (error) {
      console.error("Check-out failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      style={{
        background: isLive
          ? "linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))"
          : "rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(20px)",
        borderRadius: "16px",
        border: isLive
          ? "1px solid rgba(16, 185, 129, 0.3)"
          : "1px solid rgba(255, 255, 255, 0.12)",
        padding: "20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Live Indicator */}
      {isLive && (
        <motion.div
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded-full"
          style={{ background: "rgba(16, 185, 129, 0.2)" }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: "#10B981" }}
          />
          <span className="text-xs font-medium" style={{ color: "#10B981" }}>
            LIVE
          </span>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div
          className="p-3 rounded-xl"
          style={{
            background: `${statusColor}15`,
          }}
        >
          <IconComponent
            className="w-6 h-6"
            style={{ color: statusColor }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                background: `${statusColor}15`,
                color: statusColor,
              }}
            >
              {getSessionTypeLabel(session.sessionType)}
            </span>
            {session.isMandatory && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#EF4444",
                }}
              >
                <AlertCircle className="w-3 h-3" />
                Required
              </span>
            )}
          </div>
          <h3
            className="font-semibold text-lg truncate"
            style={{ color: "rgba(255, 255, 255, 0.95)" }}
          >
            {session.title}
          </h3>
          {session.description && (
            <p
              className="text-sm mt-1 line-clamp-2"
              style={{ color: "rgba(255, 255, 255, 0.6)" }}
            >
              {session.description}
            </p>
          )}
        </div>
      </div>

      {/* Details Row */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4" style={{ color: "rgba(255, 255, 255, 0.5)" }} />
          <span className="text-sm" style={{ color: "rgba(255, 255, 255, 0.7)" }}>
            {formatDate(session.scheduledAt)} at {formatTime(session.scheduledAt)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
            {formatDuration(session.durationMinutes)}
          </span>
        </div>
        {session.maxAttendees && (
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4" style={{ color: "rgba(255, 255, 255, 0.5)" }} />
            <span className="text-sm" style={{ color: "rgba(255, 255, 255, 0.7)" }}>
              {session.currentAttendees}/{session.maxAttendees}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        {/* Status/Time Info */}
        <div>
          {isUpcoming && (
            <span className="text-sm" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              Starts {getTimeUntilSession(session)}
            </span>
          )}
          {session.status === "completed" && (
            <span
              className="text-sm flex items-center gap-1"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              <CheckCircle className="w-4 h-4" style={{ color: "#6B7280" }} />
              Completed
            </span>
          )}
          {session.status === "cancelled" && (
            <span
              className="text-sm flex items-center gap-1"
              style={{ color: "#EF4444" }}
            >
              <AlertCircle className="w-4 h-4" />
              Cancelled
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {isLive && session.meetingUrl && (
            <a
              href={session.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-transform hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #10B981, #059669)",
                color: "#fff",
              }}
            >
              <ExternalLink className="w-4 h-4" />
              Join Now
            </a>
          )}

          {(isLive || session.status === "in_progress") && !checkedIn && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCheckIn}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm"
              style={{
                background: "linear-gradient(135deg, #8B5CF6, #6366F1)",
                color: "#fff",
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              <LogIn className="w-4 h-4" />
              Check In
            </motion.button>
          )}

          {(isLive || session.status === "in_progress") && checkedIn && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCheckOut}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm"
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                color: "#EF4444",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              <LogOut className="w-4 h-4" />
              Check Out
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Compact version for lists
export function SessionCardCompact({ session }: { session: LiveSession }) {
  const IconComponent = sessionTypeIcons[session.sessionType] || Video;
  const statusColor = getStatusColor(session.status);
  const isLive = isSessionLive(session);

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg"
      style={{
        background: isLive
          ? "rgba(16, 185, 129, 0.1)"
          : "rgba(255, 255, 255, 0.05)",
      }}
    >
      <div
        className="p-2 rounded-lg"
        style={{ background: `${statusColor}15` }}
      >
        <IconComponent className="w-4 h-4" style={{ color: statusColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="font-medium text-sm truncate"
          style={{ color: "rgba(255, 255, 255, 0.9)" }}
        >
          {session.title}
        </p>
        <p className="text-xs" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
          {formatTime(session.scheduledAt)} - {formatDuration(session.durationMinutes)}
        </p>
      </div>
      {isLive && (
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: "#10B981" }}
        />
      )}
    </div>
  );
}

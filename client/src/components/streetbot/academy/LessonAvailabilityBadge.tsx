import React from "react";
import { motion } from "framer-motion";
import { Lock, Unlock, Clock, CheckCircle, AlertCircle } from "lucide-react";
import {
  LessonAvailability,
  getLockReasonMessage,
  isLessonLocked,
} from "./api/drip-content";

interface LessonAvailabilityBadgeProps {
  availability: LessonAvailability;
  showDetails?: boolean;
  size?: "sm" | "md" | "lg";
}

export function LessonAvailabilityBadge({
  availability,
  showDetails = false,
  size = "md",
}: LessonAvailabilityBadgeProps) {
  const locked = isLessonLocked(availability);
  const reason = getLockReasonMessage(availability);

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };

  const iconSize = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  if (!locked) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`inline-flex items-center gap-1.5 rounded-full ${sizeClasses[size]}`}
        style={{
          background: "rgba(16, 185, 129, 0.15)",
          color: "#10B981",
          border: "1px solid rgba(16, 185, 129, 0.3)",
        }}
      >
        <Unlock size={iconSize[size]} />
        <span>Available</span>
      </motion.div>
    );
  }

  // Determine badge style based on reason
  const hasTimelock = availability.available_from || availability.days_until_available;
  const hasPrerequisite = !!availability.prerequisite_lesson_id;

  let bgColor = "rgba(239, 68, 68, 0.15)";
  let textColor = "#EF4444";
  let borderColor = "rgba(239, 68, 68, 0.3)";
  let Icon = Lock;

  if (hasTimelock) {
    bgColor = "rgba(245, 158, 11, 0.15)";
    textColor = "#F59E0B";
    borderColor = "rgba(245, 158, 11, 0.3)";
    Icon = Clock;
  } else if (hasPrerequisite) {
    bgColor = "rgba(139, 92, 246, 0.15)";
    textColor = "#8B5CF6";
    borderColor = "rgba(139, 92, 246, 0.3)";
    Icon = AlertCircle;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1.5 rounded-full ${sizeClasses[size]}`}
      style={{
        background: bgColor,
        color: textColor,
        border: `1px solid ${borderColor}`,
      }}
      title={reason}
    >
      <Icon size={iconSize[size]} />
      <span>{showDetails ? reason : "Locked"}</span>
    </motion.div>
  );
}

interface LessonLockOverlayProps {
  availability: LessonAvailability;
  onPrerequisiteClick?: (lessonId: string) => void;
}

export function LessonLockOverlay({
  availability,
  onPrerequisiteClick,
}: LessonLockOverlayProps) {
  const locked = isLessonLocked(availability);

  if (!locked) return null;

  const reason = getLockReasonMessage(availability);
  const hasPrerequisite = !!availability.prerequisite_lesson_id;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 flex flex-col items-center justify-center z-10 rounded-xl"
      style={{
        background: "rgba(15, 15, 26, 0.85)",
        backdropFilter: "blur(4px)",
      }}
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        <Lock
          size={48}
          style={{ color: "rgba(255, 255, 255, 0.3)" }}
          className="mb-4"
        />
      </motion.div>
      <p
        className="text-center font-medium mb-2"
        style={{ color: "rgba(255, 255, 255, 0.9)" }}
      >
        {reason}
      </p>
      {hasPrerequisite && onPrerequisiteClick && (
        <button
          onClick={() =>
            onPrerequisiteClick(availability.prerequisite_lesson_id!)
          }
          className="mt-2 px-4 py-2 rounded-lg text-sm transition-colors"
          style={{
            background: "rgba(139, 92, 246, 0.2)",
            color: "#8B5CF6",
            border: "1px solid rgba(139, 92, 246, 0.3)",
          }}
        >
          Go to {availability.prerequisite_lesson_title}
        </button>
      )}
    </motion.div>
  );
}

import React from "react";
import { motion } from "framer-motion";
import { Flame, Trophy, Calendar, Zap } from "lucide-react";
import { UserStreak } from "./api/attendance";

interface StreakDisplayProps {
  streak: UserStreak;
  compact?: boolean;
}

export function StreakDisplay({ streak, compact = false }: StreakDisplayProps) {
  const isActiveToday = streak.lastActiveDate === new Date().toISOString().split("T")[0];
  const streakColor = streak.currentStreak >= 7 ? "#F59E0B" : "#EF4444";

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <motion.div
          animate={isActiveToday ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.5, repeat: isActiveToday ? Infinity : 0, repeatDelay: 2 }}
          className="flex items-center gap-1.5"
        >
          <Flame
            className="w-5 h-5"
            style={{ color: streakColor, fill: isActiveToday ? streakColor : "transparent" }}
          />
          <span
            className="font-bold text-lg"
            style={{ color: streakColor }}
          >
            {streak.currentStreak}
          </span>
        </motion.div>
        <span
          className="text-sm"
          style={{ color: "rgba(255, 255, 255, 0.5)" }}
        >
          day streak
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        background: "linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(239, 68, 68, 0.1))",
        backdropFilter: "blur(20px)",
        borderRadius: "20px",
        border: "1px solid rgba(245, 158, 11, 0.3)",
        padding: "24px",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3
          className="font-semibold text-lg flex items-center gap-2"
          style={{ color: "rgba(255, 255, 255, 0.95)" }}
        >
          <Flame className="w-5 h-5" style={{ color: "#F59E0B" }} />
          Learning Streak
        </h3>
        {isActiveToday && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1"
            style={{
              background: "rgba(16, 185, 129, 0.2)",
              color: "#10B981",
            }}
          >
            <Zap className="w-3 h-3" />
            Active Today
          </motion.div>
        )}
      </div>

      {/* Main Streak Display */}
      <div className="text-center mb-6">
        <motion.div
          animate={isActiveToday ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 1, repeat: isActiveToday ? Infinity : 0, repeatDelay: 3 }}
          className="inline-flex items-center justify-center"
        >
          <div
            className="relative p-6 rounded-full"
            style={{
              background: "linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(239, 68, 68, 0.2))",
            }}
          >
            <Flame
              className="w-16 h-16"
              style={{
                color: streakColor,
                fill: streak.currentStreak > 0 ? streakColor : "transparent",
              }}
            />
            {streak.currentStreak > 0 && (
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${streakColor}20 0%, transparent 70%)`,
                }}
              />
            )}
          </div>
        </motion.div>
        <div
          className="text-5xl font-bold mt-4"
          style={{ color: streakColor }}
        >
          {streak.currentStreak}
        </div>
        <div
          className="text-lg mt-1"
          style={{ color: "rgba(255, 255, 255, 0.6)" }}
        >
          {streak.currentStreak === 1 ? "Day" : "Days"} in a row
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className="p-4 rounded-xl text-center"
          style={{ background: "rgba(0, 0, 0, 0.2)" }}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Trophy className="w-4 h-4" style={{ color: "#F59E0B" }} />
            <span
              className="text-2xl font-bold"
              style={{ color: "#F59E0B" }}
            >
              {streak.longestStreak}
            </span>
          </div>
          <div
            className="text-xs"
            style={{ color: "rgba(255, 255, 255, 0.5)" }}
          >
            Longest Streak
          </div>
        </div>
        <div
          className="p-4 rounded-xl text-center"
          style={{ background: "rgba(0, 0, 0, 0.2)" }}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Calendar className="w-4 h-4" style={{ color: "#10B981" }} />
            <span
              className="text-2xl font-bold"
              style={{ color: "#10B981" }}
            >
              {streak.totalDaysActive}
            </span>
          </div>
          <div
            className="text-xs"
            style={{ color: "rgba(255, 255, 255, 0.5)" }}
          >
            Total Active Days
          </div>
        </div>
      </div>

      {/* Motivation Message */}
      {streak.currentStreak > 0 && streak.currentStreak < streak.longestStreak && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 p-3 rounded-lg text-center"
          style={{ background: "rgba(139, 92, 246, 0.1)" }}
        >
          <p
            className="text-sm"
            style={{ color: "rgba(255, 255, 255, 0.7)" }}
          >
            {streak.longestStreak - streak.currentStreak} more day
            {streak.longestStreak - streak.currentStreak > 1 ? "s" : ""} to beat
            your record!
          </p>
        </motion.div>
      )}

      {streak.currentStreak >= streak.longestStreak && streak.currentStreak > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 p-3 rounded-lg text-center"
          style={{ background: "rgba(16, 185, 129, 0.1)" }}
        >
          <p
            className="text-sm font-medium"
            style={{ color: "#10B981" }}
          >
            You&apos;re on your longest streak ever! Keep it up!
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

// Mini version for sidebars
export function StreakMini({ streak }: { streak: UserStreak }) {
  return (
    <div className="flex items-center gap-2">
      <Flame
        className="w-4 h-4"
        style={{
          color: streak.currentStreak > 0 ? "#F59E0B" : "#6B7280",
          fill: streak.currentStreak > 0 ? "#F59E0B" : "transparent",
        }}
      />
      <span
        className="font-medium"
        style={{ color: streak.currentStreak > 0 ? "#F59E0B" : "#6B7280" }}
      >
        {streak.currentStreak}
      </span>
    </div>
  );
}

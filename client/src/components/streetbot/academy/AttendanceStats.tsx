import React from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  BookOpen,
  HelpCircle,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import { EngagementSummary, formatDuration } from "./api/attendance";

interface AttendanceStatsProps {
  summary: EngagementSummary;
}

export function AttendanceStats({ summary }: AttendanceStatsProps) {
  const stats = [
    {
      label: "Active Days",
      value: summary.activeDays,
      subtext: `of ${summary.periodDays} days`,
      icon: Calendar,
      color: "#10B981",
      bgColor: "rgba(16, 185, 129, 0.15)",
    },
    {
      label: "Total Time",
      value: formatDuration(summary.totalTimeMinutes),
      subtext: `${Math.round(summary.avgDailyTime)}m avg/day`,
      icon: Clock,
      color: "#3B82F6",
      bgColor: "rgba(59, 130, 246, 0.15)",
    },
    {
      label: "Lessons",
      value: summary.totalLessons,
      subtext: "completed",
      icon: BookOpen,
      color: "#8B5CF6",
      bgColor: "rgba(139, 92, 246, 0.15)",
    },
    {
      label: "Quizzes",
      value: summary.totalQuizzes,
      subtext: "taken",
      icon: HelpCircle,
      color: "#F59E0B",
      bgColor: "rgba(245, 158, 11, 0.15)",
    },
    {
      label: "Forum Posts",
      value: summary.totalForumPosts,
      subtext: "contributions",
      icon: MessageSquare,
      color: "#EC4899",
      bgColor: "rgba(236, 72, 153, 0.15)",
    },
  ];

  const attendanceRate = Math.round((summary.activeDays / summary.periodDays) * 100);

  return (
    <div className="space-y-4">
      {/* Attendance Rate Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: "rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(20px)",
          borderRadius: "16px",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          padding: "20px",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl"
              style={{ background: "rgba(16, 185, 129, 0.15)" }}
            >
              <TrendingUp className="w-5 h-5" style={{ color: "#10B981" }} />
            </div>
            <div>
              <h3
                className="font-semibold"
                style={{ color: "rgba(255, 255, 255, 0.95)" }}
              >
                Engagement Rate
              </h3>
              <p
                className="text-sm"
                style={{ color: "rgba(255, 255, 255, 0.5)" }}
              >
                Last {summary.periodDays} days
              </p>
            </div>
          </div>
          <div
            className="text-3xl font-bold"
            style={{
              color:
                attendanceRate >= 80
                  ? "#10B981"
                  : attendanceRate >= 60
                  ? "#F59E0B"
                  : "#EF4444",
            }}
          >
            {attendanceRate}%
          </div>
        </div>

        {/* Progress Bar */}
        <div
          className="h-3 rounded-full overflow-hidden"
          style={{ background: "rgba(255, 255, 255, 0.1)" }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${attendanceRate}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{
              background:
                attendanceRate >= 80
                  ? "linear-gradient(90deg, #10B981, #34D399)"
                  : attendanceRate >= 60
                  ? "linear-gradient(90deg, #F59E0B, #FBBF24)"
                  : "linear-gradient(90deg, #EF4444, #F87171)",
            }}
          />
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-4 rounded-xl text-center"
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
            }}
          >
            <div
              className="p-2 rounded-lg w-fit mx-auto mb-2"
              style={{ background: stat.bgColor }}
            >
              <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
            </div>
            <div
              className="text-2xl font-bold"
              style={{ color: stat.color }}
            >
              {stat.value}
            </div>
            <div
              className="text-xs mt-1"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              {stat.label}
            </div>
            <div
              className="text-xs"
              style={{ color: "rgba(255, 255, 255, 0.4)" }}
            >
              {stat.subtext}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

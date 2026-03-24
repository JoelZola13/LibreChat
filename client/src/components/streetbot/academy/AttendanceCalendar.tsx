import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import { DailyEngagement } from "./api/attendance";

interface AttendanceCalendarProps {
  engagementHistory: DailyEngagement[];
  weeks?: number;
}

export function AttendanceCalendar({
  engagementHistory,
  weeks = 12,
}: AttendanceCalendarProps) {
  // Build a map of date -> engagement level (0-4)
  const engagementMap = useMemo(() => {
    const map: Record<string, { level: number; data: DailyEngagement }> = {};

    engagementHistory.forEach((day) => {
      // Calculate engagement level based on time spent
      let level = 0;
      if (day.timeSpentMinutes > 0) level = 1;
      if (day.timeSpentMinutes >= 15) level = 2;
      if (day.timeSpentMinutes >= 30) level = 3;
      if (day.timeSpentMinutes >= 60) level = 4;

      map[day.date] = { level, data: day };
    });

    return map;
  }, [engagementHistory]);

  // Generate calendar grid (weeks x 7 days)
  const calendarDays = useMemo(() => {
    const days: { date: string; dayOfWeek: number }[] = [];
    const today = new Date();
    const totalDays = weeks * 7;

    // Start from (totalDays) days ago
    for (let i = totalDays - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      days.push({
        date: date.toISOString().split("T")[0],
        dayOfWeek: date.getDay(),
      });
    }

    return days;
  }, [weeks]);

  // Group days into weeks
  const calendarWeeks = useMemo(() => {
    const weeksList: { date: string; dayOfWeek: number }[][] = [];
    let currentWeek: { date: string; dayOfWeek: number }[] = [];

    calendarDays.forEach((day, index) => {
      currentWeek.push(day);
      if (currentWeek.length === 7 || index === calendarDays.length - 1) {
        weeksList.push(currentWeek);
        currentWeek = [];
      }
    });

    return weeksList;
  }, [calendarDays]);

  const getLevelColor = (level: number): string => {
    switch (level) {
      case 0:
        return "rgba(255, 255, 255, 0.05)";
      case 1:
        return "rgba(16, 185, 129, 0.2)";
      case 2:
        return "rgba(16, 185, 129, 0.4)";
      case 3:
        return "rgba(16, 185, 129, 0.6)";
      case 4:
        return "rgba(16, 185, 129, 0.8)";
      default:
        return "rgba(255, 255, 255, 0.05)";
    }
  };

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  const monthLabels: { month: string; weekIndex: number }[] = [];

  // Calculate month labels
  let lastMonth = "";
  calendarWeeks.forEach((week, weekIndex) => {
    const firstDayOfWeek = new Date(week[0].date);
    const month = firstDayOfWeek.toLocaleDateString("en-US", { month: "short" });
    if (month !== lastMonth) {
      monthLabels.push({ month, weekIndex });
      lastMonth = month;
    }
  });

  return (
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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3
          className="font-semibold flex items-center gap-2"
          style={{ color: "rgba(255, 255, 255, 0.95)" }}
        >
          <Calendar className="w-5 h-5" style={{ color: "#10B981" }} />
          Activity Calendar
        </h3>
        <div className="flex items-center gap-2">
          <span
            className="text-xs"
            style={{ color: "rgba(255, 255, 255, 0.4)" }}
          >
            Less
          </span>
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className="w-3 h-3 rounded-sm"
              style={{ background: getLevelColor(level) }}
            />
          ))}
          <span
            className="text-xs"
            style={{ color: "rgba(255, 255, 255, 0.4)" }}
          >
            More
          </span>
        </div>
      </div>

      {/* Month Labels */}
      <div className="flex ml-6 mb-1">
        {monthLabels.map(({ month, weekIndex }, index) => (
          <div
            key={`${month}-${index}`}
            className="text-xs"
            style={{
              color: "rgba(255, 255, 255, 0.4)",
              marginLeft: index === 0 ? `${weekIndex * 14}px` : undefined,
              width: index < monthLabels.length - 1
                ? `${(monthLabels[index + 1].weekIndex - weekIndex) * 14}px`
                : undefined,
            }}
          >
            {month}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex gap-1">
        {/* Day Labels */}
        <div className="flex flex-col gap-0.5 mr-1">
          {dayLabels.map((day, index) => (
            <div
              key={index}
              className="h-3 text-xs flex items-center justify-center"
              style={{
                color: "rgba(255, 255, 255, 0.4)",
                width: "12px",
                visibility: index % 2 === 1 ? "visible" : "hidden",
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="flex gap-0.5 overflow-x-auto">
          {calendarWeeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-0.5">
              {week.map((day) => {
                const engagement = engagementMap[day.date];
                const level = engagement?.level || 0;
                const data = engagement?.data;

                return (
                  <motion.div
                    key={day.date}
                    whileHover={{ scale: 1.3 }}
                    className="w-3 h-3 rounded-sm cursor-pointer relative group"
                    style={{ background: getLevelColor(level) }}
                    title={
                      data
                        ? `${day.date}: ${data.timeSpentMinutes}m, ${data.lessonsAccessed} lessons`
                        : `${day.date}: No activity`
                    }
                  >
                    {/* Tooltip */}
                    <div
                      className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                      style={{
                        background: "rgba(0, 0, 0, 0.9)",
                        color: "rgba(255, 255, 255, 0.9)",
                      }}
                    >
                      {data ? (
                        <>
                          <div className="font-medium">{day.date}</div>
                          <div>{data.timeSpentMinutes}m learning</div>
                          <div>{data.lessonsAccessed} lessons</div>
                        </>
                      ) : (
                        <div>{day.date}: No activity</div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div
        className="mt-4 pt-4 flex items-center justify-between text-sm"
        style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}
      >
        <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>
          {engagementHistory.filter((d) => d.timeSpentMinutes > 0).length} active
          days in the last {weeks * 7} days
        </span>
        <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>
          {Math.round(
            engagementHistory.reduce((sum, d) => sum + d.timeSpentMinutes, 0) / 60
          )}
          h total
        </span>
      </div>
    </motion.div>
  );
}

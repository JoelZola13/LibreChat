import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  Video,
  RefreshCw,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import {
  LiveSession,
  UserStreak,
  EngagementSummary,
  DailyEngagement,
  SessionAttendance,
  getSessions,
  getUserStreak,
  getEngagementSummary,
  getEngagementHistory,
  getUserAttendance,
} from "./api/attendance";
import { AttendanceStats } from "./AttendanceStats";
import { StreakDisplay } from "./StreakDisplay";
import { SessionCard } from "./SessionCard";
import { AttendanceCalendar } from "./AttendanceCalendar";

interface AttendanceDashboardProps {
  userId: string;
}

type TabType = "overview" | "sessions" | "history";

export function AttendanceDashboard({ userId }: AttendanceDashboardProps) {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [summary, setSummary] = useState<EngagementSummary | null>(null);
  const [engagementHistory, setEngagementHistory] = useState<DailyEngagement[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<SessionAttendance[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    try {
      const [sessionsData, streakData, summaryData, historyData, attendanceData] =
        await Promise.all([
          getSessions(),
          getUserStreak(userId),
          getEngagementSummary(userId, 30),
          getEngagementHistory(userId, 90),
          getUserAttendance(userId),
        ]);

      setSessions(sessionsData);
      setStreak(streakData);
      setSummary(summaryData);
      setEngagementHistory(historyData);
      setAttendanceHistory(attendanceData);
      setError(null);
    } catch (err) {
      console.error("Failed to load attendance data:", err);
      setError("Failed to load attendance data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Separate sessions by status
  const upcomingSessions = sessions.filter(
    (s) => s.status === "scheduled" || s.status === "in_progress"
  );
  const liveSessions = sessions.filter(
    (s) => s.status === "in_progress"
  );
  const completedSessions = sessions.filter(
    (s) => s.status === "completed"
  );

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center p-12"
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          borderRadius: "20px",
          minHeight: "400px",
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Calendar className="w-10 h-10" style={{ color: "rgba(16, 185, 129, 0.8)" }} />
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="text-center p-8 rounded-xl"
        style={{
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.2)",
        }}
      >
        <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "#EF4444" }} />
        <p style={{ color: "#EF4444" }}>{error}</p>
        <button
          onClick={() => loadData()}
          className="mt-4 px-4 py-2 rounded-lg"
          style={{
            background: "rgba(255, 255, 255, 0.1)",
            color: "rgba(255, 255, 255, 0.7)",
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: Calendar },
    { id: "sessions", label: "Sessions", icon: Video },
    { id: "history", label: "History", icon: Clock },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold flex items-center gap-3"
            style={{ color: "rgba(255, 255, 255, 0.95)" }}
          >
            <Calendar className="w-7 h-7" style={{ color: "#10B981" }} />
            Attendance & Engagement
          </h1>
          <p className="mt-1" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
            Track your learning progress and session attendance
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => loadData(true)}
          disabled={isRefreshing}
          className="p-2 rounded-lg transition-colors"
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            color: "rgba(255, 255, 255, 0.6)",
          }}
        >
          <motion.div
            animate={isRefreshing ? { rotate: 360 } : {}}
            transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}
          >
            <RefreshCw className="w-5 h-5" />
          </motion.div>
        </motion.button>
      </div>

      {/* Live Sessions Alert */}
      {liveSessions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl flex items-center justify-between"
          style={{
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))",
            border: "1px solid rgba(16, 185, 129, 0.3)",
          }}
        >
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="p-2 rounded-full"
              style={{ background: "rgba(16, 185, 129, 0.3)" }}
            >
              <Video className="w-5 h-5" style={{ color: "#10B981" }} />
            </motion.div>
            <div>
              <p className="font-medium" style={{ color: "#10B981" }}>
                {liveSessions.length} Live Session{liveSessions.length > 1 ? "s" : ""} Now
              </p>
              <p className="text-sm" style={{ color: "rgba(255, 255, 255, 0.6)" }}>
                {liveSessions[0].title}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("sessions")}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{
              background: "rgba(16, 185, 129, 0.2)",
              color: "#10B981",
            }}
          >
            View
            <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Streak Display */}
      {streak && <StreakDisplay streak={streak} />}

      {/* Tabs */}
      <div
        className="flex gap-2 p-1 rounded-xl"
        style={{ background: "rgba(255, 255, 255, 0.05)" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all"
            style={{
              background:
                activeTab === tab.id
                  ? "linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(16, 185, 129, 0.15))"
                  : "transparent",
              color:
                activeTab === tab.id
                  ? "rgba(255, 255, 255, 0.95)"
                  : "rgba(255, 255, 255, 0.5)",
              border:
                activeTab === tab.id
                  ? "1px solid rgba(16, 185, 129, 0.3)"
                  : "1px solid transparent",
            }}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Stats */}
            {summary && <AttendanceStats summary={summary} />}

            {/* Activity Calendar */}
            <AttendanceCalendar engagementHistory={engagementHistory} weeks={12} />

            {/* Upcoming Sessions Preview */}
            {upcomingSessions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3
                    className="font-semibold"
                    style={{ color: "rgba(255, 255, 255, 0.95)" }}
                  >
                    Upcoming Sessions
                  </h3>
                  <button
                    onClick={() => setActiveTab("sessions")}
                    className="text-sm flex items-center gap-1"
                    style={{ color: "#10B981" }}
                  >
                    View All
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  {upcomingSessions.slice(0, 3).map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      userId={userId}
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "sessions" && (
          <motion.div
            key="sessions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Live Now */}
            {liveSessions.length > 0 && (
              <div>
                <h3
                  className="font-semibold mb-4 flex items-center gap-2"
                  style={{ color: "#10B981" }}
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-2 h-2 rounded-full"
                    style={{ background: "#10B981" }}
                  />
                  Live Now
                </h3>
                <div className="space-y-3">
                  {liveSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      userId={userId}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming */}
            {upcomingSessions.filter((s) => s.status === "scheduled").length > 0 && (
              <div>
                <h3
                  className="font-semibold mb-4"
                  style={{ color: "rgba(255, 255, 255, 0.95)" }}
                >
                  Upcoming Sessions
                </h3>
                <div className="space-y-3">
                  {upcomingSessions
                    .filter((s) => s.status === "scheduled")
                    .map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        userId={userId}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Completed */}
            {completedSessions.length > 0 && (
              <div>
                <h3
                  className="font-semibold mb-4"
                  style={{ color: "rgba(255, 255, 255, 0.7)" }}
                >
                  Past Sessions
                </h3>
                <div className="space-y-3">
                  {completedSessions.slice(0, 5).map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      userId={userId}
                    />
                  ))}
                </div>
              </div>
            )}

            {sessions.length === 0 && (
              <div
                className="text-center p-12 rounded-xl"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <Video
                  className="w-16 h-16 mx-auto mb-4"
                  style={{ color: "rgba(255, 255, 255, 0.3)" }}
                />
                <p
                  className="text-lg font-medium"
                  style={{ color: "rgba(255, 255, 255, 0.7)" }}
                >
                  No sessions available
                </p>
                <p
                  className="mt-2"
                  style={{ color: "rgba(255, 255, 255, 0.4)" }}
                >
                  Check back later for upcoming live sessions
                </p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "history" && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <h3
              className="font-semibold"
              style={{ color: "rgba(255, 255, 255, 0.95)" }}
            >
              Attendance History
            </h3>

            {attendanceHistory.length > 0 ? (
              <div className="space-y-2">
                {attendanceHistory.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 rounded-lg"
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          background:
                            record.status === "present"
                              ? "#10B981"
                              : record.status === "late"
                              ? "#F59E0B"
                              : record.status === "excused"
                              ? "#3B82F6"
                              : "#EF4444",
                        }}
                      />
                      <div>
                        <p
                          className="font-medium"
                          style={{ color: "rgba(255, 255, 255, 0.9)" }}
                        >
                          Session Attendance
                        </p>
                        <p
                          className="text-sm"
                          style={{ color: "rgba(255, 255, 255, 0.5)" }}
                        >
                          {new Date(record.createdAt).toLocaleDateString()} at{" "}
                          {new Date(record.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-medium capitalize"
                        style={{
                          background:
                            record.status === "present"
                              ? "rgba(16, 185, 129, 0.15)"
                              : record.status === "late"
                              ? "rgba(245, 158, 11, 0.15)"
                              : record.status === "excused"
                              ? "rgba(59, 130, 246, 0.15)"
                              : "rgba(239, 68, 68, 0.15)",
                          color:
                            record.status === "present"
                              ? "#10B981"
                              : record.status === "late"
                              ? "#F59E0B"
                              : record.status === "excused"
                              ? "#3B82F6"
                              : "#EF4444",
                        }}
                      >
                        {record.status}
                      </span>
                      {record.durationMinutes && (
                        <p
                          className="text-xs mt-1"
                          style={{ color: "rgba(255, 255, 255, 0.4)" }}
                        >
                          {record.durationMinutes}m attended
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="text-center p-12 rounded-xl"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <Clock
                  className="w-16 h-16 mx-auto mb-4"
                  style={{ color: "rgba(255, 255, 255, 0.3)" }}
                />
                <p
                  className="text-lg font-medium"
                  style={{ color: "rgba(255, 255, 255, 0.7)" }}
                >
                  No attendance history
                </p>
                <p
                  className="mt-2"
                  style={{ color: "rgba(255, 255, 255, 0.4)" }}
                >
                  Attend live sessions to build your history
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

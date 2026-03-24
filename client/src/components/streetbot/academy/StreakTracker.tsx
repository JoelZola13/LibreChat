import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Flame,
  Calendar,
  Target,
  Trophy,
  TrendingUp,
  Check,
  Star,
  Zap,
} from "lucide-react";
import {
  getUserStreaks,
  updateStreak,
  Streak,
  getStreakTypeLabel,
} from "./api/gamification";

interface StreakTrackerProps {
  userId: string;
  colors: Record<string, string>;
  courseId?: string;
}

export function StreakTracker({ userId, colors, courseId }: StreakTrackerProps) {
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function loadStreaks() {
      try {
        const data = await getUserStreaks(userId);
        setStreaks(data);
      } catch (error) {
        console.error("Failed to load streaks:", error);
      } finally {
        setLoading(false);
      }
    }

    loadStreaks();
  }, [userId]);

  const handleCheckIn = async (streakType: "daily_login" | "daily_lesson" | "daily_quiz") => {
    setUpdating(true);
    try {
      const updated = await updateStreak(userId, streakType, courseId);
      setStreaks((prev) =>
        prev.map((s) => (s.streak_type === streakType ? updated : s))
      );
    } catch (error) {
      console.error("Failed to update streak:", error);
    } finally {
      setUpdating(false);
    }
  };

  const getStreakIcon = (type: string) => {
    switch (type) {
      case "daily_login":
        return Calendar;
      case "daily_lesson":
        return Target;
      case "daily_quiz":
        return Zap;
      default:
        return Flame;
    }
  };

  const getStreakColor = (type: string) => {
    switch (type) {
      case "daily_login":
        return "#F59E0B";
      case "daily_lesson":
        return "#3B82F6";
      case "daily_quiz":
        return "#8B5CF6";
      default:
        return "#EF4444";
    }
  };

  const isActiveToday = (streak: Streak) => {
    if (!streak.last_activity_date) return false;
    const today = new Date().toDateString();
    const lastActivity = new Date(streak.last_activity_date).toDateString();
    return today === lastActivity;
  };

  // Get the main login streak for the big display
  const loginStreak = streaks.find((s) => s.streak_type === "daily_login");
  const otherStreaks = streaks.filter((s) => s.streak_type !== "daily_login");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-3 border-orange-400 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Streak Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 overflow-hidden relative"
        style={{
          background: "linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(245, 158, 11, 0.1))",
          backdropFilter: "blur(24px)",
          border: `1px solid rgba(239, 68, 68, 0.3)`,
        }}
      >
        {/* Background Flame Animation */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute -bottom-20 -right-20 w-64 h-64 opacity-10"
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Flame className="w-full h-full text-orange-500" />
          </motion.div>
        </div>

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Streak Display */}
            <div className="flex items-center gap-6">
              <motion.div
                className="w-24 h-24 rounded-2xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #EF4444, #F59E0B)",
                  boxShadow: "0 8px 32px rgba(239, 68, 68, 0.4)",
                }}
                animate={{
                  scale: loginStreak && loginStreak.current_streak > 0 ? [1, 1.05, 1] : 1,
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <Flame className="w-12 h-12 text-white" />
              </motion.div>

              <div>
                <h3 className="text-4xl font-bold" style={{ color: colors.text }}>
                  {loginStreak?.current_streak || 0}
                </h3>
                <p className="text-lg font-medium" style={{ color: colors.textSecondary }}>
                  Day Streak
                </p>
                <p className="text-sm" style={{ color: colors.textMuted }}>
                  Best: {loginStreak?.longest_streak || 0} days
                </p>
              </div>
            </div>

            {/* Check-in Button */}
            <div className="flex flex-col items-center gap-2">
              {loginStreak && isActiveToday(loginStreak) ? (
                <div
                  className="flex items-center gap-2 px-6 py-3 rounded-xl"
                  style={{ background: "rgba(16, 185, 129, 0.2)" }}
                >
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="font-medium text-green-400">Checked in today!</span>
                </div>
              ) : (
                <button
                  onClick={() => handleCheckIn("daily_login")}
                  disabled={updating}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all hover:scale-105 disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #EF4444, #F59E0B)",
                    color: "#fff",
                  }}
                >
                  <Flame className="w-5 h-5" />
                  {updating ? "Checking in..." : "Check In"}
                </button>
              )}
              <p className="text-xs" style={{ color: colors.textMuted }}>
                Don't break your streak!
              </p>
            </div>
          </div>

          {/* Streak Milestones */}
          <div className="mt-6 pt-6" style={{ borderTop: `1px solid rgba(239, 68, 68, 0.2)` }}>
            <p className="text-sm font-medium mb-3" style={{ color: colors.textSecondary }}>
              Streak Milestones
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[7, 14, 30, 60, 100, 365].map((milestone) => {
                const achieved = (loginStreak?.longest_streak || 0) >= milestone;
                const current = (loginStreak?.current_streak || 0) >= milestone;

                return (
                  <div
                    key={milestone}
                    className="flex-shrink-0 w-16 text-center"
                  >
                    <div
                      className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-1"
                      style={{
                        background: current
                          ? "linear-gradient(135deg, #EF4444, #F59E0B)"
                          : achieved
                          ? "rgba(245, 158, 11, 0.2)"
                          : `${colors.text}10`,
                        border: `2px solid ${
                          current ? "#F59E0B" : achieved ? "rgba(245, 158, 11, 0.4)" : colors.border
                        }`,
                      }}
                    >
                      {current ? (
                        <Flame className="w-5 h-5 text-white" />
                      ) : achieved ? (
                        <Check className="w-5 h-5 text-amber-400" />
                      ) : (
                        <span
                          className="text-xs font-medium"
                          style={{ color: colors.textMuted }}
                        >
                          {milestone}
                        </span>
                      )}
                    </div>
                    <p
                      className="text-xs"
                      style={{
                        color: current || achieved ? colors.text : colors.textMuted,
                      }}
                    >
                      {milestone}d
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Weekly Calendar View */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl p-6"
        style={{
          background: colors.cardBg,
          backdropFilter: "blur(24px)",
          border: `1px solid ${colors.border}`,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold" style={{ color: colors.text }}>
            This Week
          </h4>
          <Calendar className="w-5 h-5" style={{ color: colors.textMuted }} />
        </div>

        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, index) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - index));
            const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
            const dayNum = date.getDate();
            const isToday = index === 6;

            // Check if this day had activity (simplified - just check if within streak)
            const streakStart = loginStreak?.streak_start_date
              ? new Date(loginStreak.streak_start_date)
              : null;
            const hasActivity =
              streakStart && date >= streakStart && date <= new Date();

            return (
              <div key={index} className="text-center">
                <p
                  className="text-xs mb-2"
                  style={{ color: colors.textMuted }}
                >
                  {dayName}
                </p>
                <div
                  className="w-10 h-10 mx-auto rounded-lg flex items-center justify-center"
                  style={{
                    background: hasActivity
                      ? "linear-gradient(135deg, #EF4444, #F59E0B)"
                      : isToday
                      ? `${colors.accent}20`
                      : `${colors.text}05`,
                    border: isToday ? `2px solid ${colors.accent}` : "none",
                  }}
                >
                  {hasActivity ? (
                    <Flame className="w-4 h-4 text-white" />
                  ) : (
                    <span
                      className="text-sm"
                      style={{ color: isToday ? colors.accent : colors.textMuted }}
                    >
                      {dayNum}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Other Streaks */}
      {otherStreaks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {otherStreaks.map((streak, index) => {
            const Icon = getStreakIcon(streak.streak_type);
            const color = getStreakColor(streak.streak_type);
            const active = isActiveToday(streak);

            return (
              <motion.div
                key={streak.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className="rounded-2xl p-5"
                style={{
                  background: colors.cardBg,
                  backdropFilter: "blur(24px)",
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{
                      background: `${color}20`,
                      border: `1px solid ${color}40`,
                    }}
                  >
                    <Icon className="w-7 h-7" style={{ color }} />
                  </div>

                  <div className="flex-1">
                    <p className="font-medium" style={{ color: colors.text }}>
                      {getStreakTypeLabel(streak.streak_type)}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold" style={{ color }}>
                        {streak.current_streak}
                      </span>
                      <span className="text-sm" style={{ color: colors.textMuted }}>
                        / {streak.longest_streak} best
                      </span>
                    </div>
                  </div>

                  {active ? (
                    <div
                      className="px-3 py-1.5 rounded-lg"
                      style={{ background: "rgba(16, 185, 129, 0.1)" }}
                    >
                      <Check className="w-5 h-5 text-green-400" />
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        handleCheckIn(
                          streak.streak_type as "daily_login" | "daily_lesson" | "daily_quiz"
                        )
                      }
                      disabled={updating}
                      className="px-3 py-1.5 rounded-lg transition-all hover:scale-105 disabled:opacity-50"
                      style={{
                        background: color,
                        color: "#fff",
                      }}
                    >
                      <TrendingUp className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* Progress to next milestone */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: colors.textMuted }}>
                      Next milestone: {getNextMilestone(streak.current_streak)} days
                    </span>
                    <span style={{ color }}>
                      {Math.round(
                        (streak.current_streak / getNextMilestone(streak.current_streak)) * 100
                      )}
                      %
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: `${color}20` }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: color }}
                      initial={{ width: 0 }}
                      animate={{
                        width: `${
                          (streak.current_streak / getNextMilestone(streak.current_streak)) * 100
                        }%`,
                      }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Streak Benefits */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl p-6"
        style={{
          background: colors.cardBg,
          backdropFilter: "blur(24px)",
          border: `1px solid ${colors.border}`,
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5" style={{ color: colors.accent }} />
          <h4 className="font-semibold" style={{ color: colors.text }}>
            Streak Benefits
          </h4>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { days: 7, bonus: "+10% XP", icon: Star },
            { days: 14, bonus: "+20% XP", icon: Star },
            { days: 30, bonus: "+30% XP + Badge", icon: Trophy },
            { days: 100, bonus: "+50% XP + Badge", icon: Trophy },
          ].map((benefit) => {
            const achieved = (loginStreak?.current_streak || 0) >= benefit.days;
            const Icon = benefit.icon;

            return (
              <div
                key={benefit.days}
                className="p-3 rounded-xl text-center"
                style={{
                  background: achieved ? `${colors.accent}10` : `${colors.text}05`,
                  border: `1px solid ${achieved ? colors.accent : colors.border}`,
                  opacity: achieved ? 1 : 0.6,
                }}
              >
                <Icon
                  className="w-5 h-5 mx-auto mb-1"
                  style={{ color: achieved ? colors.accent : colors.textMuted }}
                />
                <p
                  className="text-xs font-medium"
                  style={{ color: achieved ? colors.accent : colors.textMuted }}
                >
                  {benefit.days}+ days
                </p>
                <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                  {benefit.bonus}
                </p>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

function getNextMilestone(current: number): number {
  const milestones = [7, 14, 30, 60, 100, 365, 500, 1000];
  return milestones.find((m) => m > current) || milestones[milestones.length - 1];
}

export default StreakTracker;

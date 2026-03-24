import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Star,
  Target,
  Flame,
  TrendingUp,
  Medal,
  Crown,
  Zap,
  Award,
  Gift,
  Clock,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  getGamificationDashboard,
  GamificationDashboard as GamificationData,
  getRarityColor,
  getRarityBgColor,
  getActionTypeLabel,
  formatPoints,
  getStreakTypeLabel,
} from "./api/gamification";

// Sub-components
import { StatsOverview } from "./StatsOverview";
import { BadgesShowcase } from "./BadgesShowcase";
import { AchievementsProgress } from "./AchievementsProgress";
import { LeaderboardView } from "./LeaderboardView";
import { StreakTracker } from "./StreakTracker";

interface GamificationDashboardProps {
  userId: string;
}

export function GamificationDashboard({ userId }: GamificationDashboardProps) {
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";

  const [data, setData] = useState<GamificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "badges" | "achievements" | "leaderboard">("overview");

  const colors = useMemo(
    () => ({
      bg: isDark ? "#0a0a0f" : "#f8fafc",
      cardBg: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.7)",
      cardBgHover: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.9)",
      text: isDark ? "#ffffff" : "#1e293b",
      textSecondary: isDark ? "rgba(255, 255, 255, 0.6)" : "#64748b",
      textMuted: isDark ? "rgba(255, 255, 255, 0.4)" : "#94a3b8",
      border: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
      borderHover: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.15)",
      accent: "#FFD600",
      accentGlow: "rgba(255, 214, 0, 0.3)",
      glassShadow: isDark
        ? "0 8px 32px rgba(0, 0, 0, 0.4)"
        : "0 8px 32px rgba(0, 0, 0, 0.1)",
    }),
    [isDark]
  );

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const dashboardData = await getGamificationDashboard(userId);
        setData(dashboardData);
        setError(null);
      } catch (err) {
        console.error("Failed to load gamification data:", err);
        setError("Failed to load your achievements. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      loadData();
    }
  }, [userId]);

  const tabs = [
    { id: "overview", label: "Overview", icon: Sparkles },
    { id: "badges", label: "Badges", icon: Medal },
    { id: "achievements", label: "Achievements", icon: Target },
    { id: "leaderboard", label: "Leaderboard", icon: Crown },
  ] as const;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full"
        />
        <p style={{ color: colors.textSecondary }}>Loading your achievements...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 rounded-2xl"
        style={{
          background: colors.cardBg,
          border: `1px solid ${colors.border}`,
        }}
      >
        <Trophy className="w-16 h-16 text-yellow-400 opacity-50" />
        <p style={{ color: colors.text }} className="text-lg font-medium">
          {error}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 rounded-xl font-medium transition-all"
          style={{
            background: colors.accent,
            color: "#000",
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Header with Level & XP */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-8"
        style={{
          background: `linear-gradient(135deg, ${isDark ? "rgba(255, 214, 0, 0.1)" : "rgba(255, 214, 0, 0.15)"}, ${isDark ? "rgba(139, 92, 246, 0.1)" : "rgba(139, 92, 246, 0.15)"})`,
          backdropFilter: "blur(24px)",
          border: `1px solid ${colors.border}`,
        }}
      >
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 opacity-10">
          <Trophy className="w-full h-full" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${colors.accent}, #F59E0B)`,
                  boxShadow: `0 4px 20px ${colors.accentGlow}`,
                }}
              >
                <span className="text-2xl font-bold text-black">
                  {data.level_info.level}
                </span>
              </div>
              <div>
                <h2 className="text-2xl font-bold" style={{ color: colors.text }}>
                  {data.level_info.title || `Level ${data.level_info.level}`}
                </h2>
                <p style={{ color: colors.textSecondary }}>
                  {data.points_summary.total_xp.toLocaleString()} Total XP
                </p>
              </div>
            </div>

            {/* XP Progress Bar */}
            <div className="mt-4 max-w-md">
              <div className="flex justify-between text-sm mb-2">
                <span style={{ color: colors.textSecondary }}>
                  Level {data.level_info.level}
                </span>
                <span style={{ color: colors.textSecondary }}>
                  Level {data.level_info.level + 1}
                </span>
              </div>
              <div
                className="h-3 rounded-full overflow-hidden"
                style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${colors.accent}, #F59E0B)`,
                    boxShadow: `0 0 20px ${colors.accentGlow}`,
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${data.level_info.progress_percent}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              <p className="text-sm mt-2" style={{ color: colors.textMuted }}>
                {data.level_info.current_level_xp.toLocaleString()} / {(data.level_info.current_level_xp + data.level_info.xp_to_next_level).toLocaleString()} XP
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap gap-4">
            <QuickStat
              icon={Star}
              label="Points"
              value={data.points_summary.total_points.toLocaleString()}
              color="#FFD600"
              colors={colors}
            />
            <QuickStat
              icon={Medal}
              label="Badges"
              value={`${data.badges_earned}/${data.badges_total}`}
              color="#8B5CF6"
              colors={colors}
            />
            <QuickStat
              icon={Flame}
              label="Streak"
              value={`${data.current_streak.current_streak} days`}
              color="#EF4444"
              colors={colors}
            />
            {data.global_rank && (
              <QuickStat
                icon={Crown}
                label="Rank"
                value={`#${data.global_rank}`}
                color="#10B981"
                colors={colors}
              />
            )}
          </div>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div
        className="flex gap-2 p-2 rounded-2xl overflow-x-auto"
        style={{
          background: colors.cardBg,
          backdropFilter: "blur(16px)",
          border: `1px solid ${colors.border}`,
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap"
              style={{
                background: isActive
                  ? `linear-gradient(135deg, ${colors.accent}, #F59E0B)`
                  : "transparent",
                color: isActive ? "#000" : colors.textSecondary,
              }}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "overview" && (
            <OverviewTab data={data} colors={colors} userId={userId} />
          )}
          {activeTab === "badges" && (
            <BadgesShowcase userId={userId} colors={colors} />
          )}
          {activeTab === "achievements" && (
            <AchievementsProgress userId={userId} colors={colors} />
          )}
          {activeTab === "leaderboard" && (
            <LeaderboardView userId={userId} colors={colors} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// Quick Stat Component
// =============================================================================

interface QuickStatProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  colors: Record<string, string>;
}

function QuickStat({ icon: Icon, label, value, color, colors }: QuickStatProps) {
  return (
    <div
      className="px-5 py-3 rounded-xl"
      style={{
        background: colors.cardBg,
        backdropFilter: "blur(16px)",
        border: `1px solid ${colors.border}`,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: `${color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div>
          <p className="text-lg font-bold" style={{ color: colors.text }}>
            {value}
          </p>
          <p className="text-sm" style={{ color: colors.textMuted }}>
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Overview Tab
// =============================================================================

interface OverviewTabProps {
  data: GamificationData;
  colors: Record<string, string>;
  userId: string;
}

function OverviewTab({ data, colors, userId }: OverviewTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column - Stats & Streak */}
      <div className="lg:col-span-2 space-y-6">
        <StatsOverview data={data} colors={colors} />
        <StreakTracker userId={userId} colors={colors} />
      </div>

      {/* Right Column - Recent Activity & Badges */}
      <div className="space-y-6">
        {/* Recent Badges */}
        {data.recent_badges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-2xl p-6"
            style={{
              background: colors.cardBg,
              backdropFilter: "blur(24px)",
              border: `1px solid ${colors.border}`,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: colors.text }}>
                Recent Badges
              </h3>
              <Medal className="w-5 h-5" style={{ color: colors.accent }} />
            </div>
            <div className="space-y-3">
              {data.recent_badges.slice(0, 3).map((userBadge, index) => (
                <motion.div
                  key={userBadge.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{
                    background: getRarityBgColor(userBadge.badge.rarity),
                    border: `1px solid ${getRarityColor(userBadge.badge.rarity)}40`,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                    style={{
                      background: getRarityColor(userBadge.badge.rarity),
                    }}
                  >
                    {userBadge.badge.icon_url ? (
                      <img loading="lazy" decoding="async" src={userBadge.badge.icon_url} alt="" className="w-6 h-6" />
                    ) : (
                      <Award className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: colors.text }}>
                      {userBadge.badge.name}
                    </p>
                    <p className="text-xs" style={{ color: getRarityColor(userBadge.badge.rarity) }}>
                      {userBadge.badge.rarity.charAt(0).toUpperCase() + userBadge.badge.rarity.slice(1)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl p-6"
          style={{
            background: colors.cardBg,
            backdropFilter: "blur(24px)",
            border: `1px solid ${colors.border}`,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" style={{ color: colors.text }}>
              Recent Activity
            </h3>
            <Clock className="w-5 h-5" style={{ color: colors.textMuted }} />
          </div>
          <div className="space-y-3">
            {data.recent_activity.slice(0, 5).map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between py-2 border-b last:border-0"
                style={{ borderColor: colors.border }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(255, 214, 0, 0.1)" }}
                  >
                    <Zap className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: colors.text }}>
                      {getActionTypeLabel(activity.action_type)}
                    </p>
                    <p className="text-xs" style={{ color: colors.textMuted }}>
                      {new Date(activity.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-400">
                    {formatPoints(activity.points)} pts
                  </p>
                  {activity.xp > 0 && (
                    <p className="text-xs text-purple-400">
                      +{activity.xp} XP
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Active Achievements */}
        {data.active_achievements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl p-6"
            style={{
              background: colors.cardBg,
              backdropFilter: "blur(24px)",
              border: `1px solid ${colors.border}`,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: colors.text }}>
                In Progress
              </h3>
              <Target className="w-5 h-5" style={{ color: colors.accent }} />
            </div>
            <div className="space-y-4">
              {data.active_achievements.slice(0, 3).map((userAch, index) => (
                <div key={userAch.id}>
                  <div className="flex justify-between mb-1">
                    <p className="text-sm font-medium" style={{ color: colors.text }}>
                      {userAch.achievement.name}
                    </p>
                    <p className="text-sm" style={{ color: colors.textMuted }}>
                      {userAch.current_value}/{userAch.target_value}
                    </p>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: `${colors.border}` }}
                  >
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-amber-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${userAch.progress_percent}%` }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default GamificationDashboard;

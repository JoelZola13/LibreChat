import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Check,
  Clock,
  Star,
  Zap,
  Award,
  ChevronRight,
  Filter,
  Trophy,
  RefreshCw,
} from "lucide-react";
import {
  getUserAchievements,
  getAllAchievements,
  Achievement,
  UserAchievement,
} from "./api/gamification";

interface AchievementsProgressProps {
  userId: string;
  colors: Record<string, string>;
}

type StatusFilter = "all" | "in_progress" | "completed";
type CategoryFilter = "all" | "learning" | "social" | "mastery" | "streak";

export function AchievementsProgress({ userId, colors }: AchievementsProgressProps) {
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  useEffect(() => {
    async function loadAchievements() {
      try {
        const [userAch, allAch] = await Promise.all([
          getUserAchievements(userId, undefined, true),
          getAllAchievements(),
        ]);
        setUserAchievements(userAch);
        setAllAchievements(allAch);
      } catch (error) {
        console.error("Failed to load achievements:", error);
      } finally {
        setLoading(false);
      }
    }

    loadAchievements();
  }, [userId]);

  // Create a map of user achievements by achievement_id
  const userAchMap = new Map(userAchievements.map((ua) => [ua.achievement_id, ua]));

  // Get all achievements with user progress
  const achievementsWithProgress = allAchievements.map((ach) => {
    const userProgress = userAchMap.get(ach.id);
    return {
      achievement: ach,
      progress: userProgress || null,
      isCompleted: userProgress?.completed_at !== null && userProgress?.completed_at !== undefined,
      progressPercent: userProgress ? userProgress.progress_percent : 0,
    };
  });

  // Filter achievements
  const filteredAchievements = achievementsWithProgress.filter((item) => {
    if (statusFilter === "completed" && !item.isCompleted) return false;
    if (statusFilter === "in_progress" && (item.isCompleted || !item.progress)) return false;
    if (categoryFilter !== "all" && item.achievement.category !== categoryFilter) return false;
    return true;
  });

  // Sort: in progress first, then by progress %, then completed
  const sortedAchievements = [...filteredAchievements].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    if (!a.isCompleted && !b.isCompleted) {
      // Both in progress - sort by progress percent descending
      return b.progressPercent - a.progressPercent;
    }
    return 0;
  });

  const completedCount = achievementsWithProgress.filter((a) => a.isCompleted).length;
  const inProgressCount = achievementsWithProgress.filter(
    (a) => a.progress && !a.isCompleted
  ).length;

  const statusFilters: { value: StatusFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: allAchievements.length },
    { value: "in_progress", label: "In Progress", count: inProgressCount },
    { value: "completed", label: "Completed", count: completedCount },
  ];

  const categoryFilters: { value: CategoryFilter; label: string; icon: React.ElementType }[] = [
    { value: "all", label: "All", icon: Target },
    { value: "learning", label: "Learning", icon: Target },
    { value: "social", label: "Social", icon: Target },
    { value: "mastery", label: "Mastery", icon: Trophy },
    { value: "streak", label: "Streak", icon: RefreshCw },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-3 border-yellow-400 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: colors.cardBg,
          backdropFilter: "blur(24px)",
          border: `1px solid ${colors.border}`,
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-semibold" style={{ color: colors.text }}>
              Achievements
            </h3>
            <p style={{ color: colors.textSecondary }}>
              {completedCount} of {allAchievements.length} completed
            </p>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex gap-2">
            {statusFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: statusFilter === f.value ? colors.accent : colors.cardBg,
                  color: statusFilter === f.value ? "#000" : colors.textSecondary,
                  border: `1px solid ${statusFilter === f.value ? colors.accent : colors.border}`,
                }}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>
        </div>

        {/* Overall Progress */}
        <div>
          <div className="flex justify-between mb-2">
            <span style={{ color: colors.textSecondary }}>Overall Progress</span>
            <span style={{ color: colors.accent }}>
              {Math.round((completedCount / allAchievements.length) * 100)}%
            </span>
          </div>
          <div
            className="h-3 rounded-full overflow-hidden"
            style={{ background: `${colors.accent}20` }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${colors.accent}, #F59E0B)`,
              }}
              initial={{ width: 0 }}
              animate={{
                width: `${(completedCount / allAchievements.length) * 100}%`,
              }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {categoryFilters.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(cat.value)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all"
                style={{
                  background: categoryFilter === cat.value ? `${colors.accent}20` : "transparent",
                  color: categoryFilter === cat.value ? colors.accent : colors.textMuted,
                  border: `1px solid ${categoryFilter === cat.value ? colors.accent : "transparent"}`,
                }}
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Achievements List */}
      <div className="space-y-4">
        {sortedAchievements.map((item, index) => (
          <AchievementCard
            key={item.achievement.id}
            achievement={item.achievement}
            userProgress={item.progress}
            isCompleted={item.isCompleted}
            progressPercent={item.progressPercent}
            colors={colors}
            index={index}
          />
        ))}
      </div>

      {/* Empty State */}
      {sortedAchievements.length === 0 && (
        <div className="text-center py-12" style={{ color: colors.textSecondary }}>
          <Target className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No achievements found</p>
          <p className="text-sm">Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Achievement Card Component
// =============================================================================

interface AchievementCardProps {
  achievement: Achievement;
  userProgress: UserAchievement | null;
  isCompleted: boolean;
  progressPercent: number;
  colors: Record<string, string>;
  index: number;
}

function AchievementCard({
  achievement,
  userProgress,
  isCompleted,
  progressPercent,
  colors,
  index,
}: AchievementCardProps) {
  const getTypeColor = (type: string) => {
    const typeColors: Record<string, string> = {
      progress: "#3B82F6",
      milestone: "#8B5CF6",
      challenge: "#EF4444",
      daily: "#10B981",
      weekly: "#F59E0B",
    };
    return typeColors[type] || "#6B7280";
  };

  const typeColor = getTypeColor(achievement.achievement_type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="rounded-2xl p-5 transition-all hover:scale-[1.01]"
      style={{
        background: colors.cardBg,
        backdropFilter: "blur(24px)",
        border: `1px solid ${isCompleted ? "#10B981" : colors.border}`,
        opacity: isCompleted ? 0.8 : 1,
      }}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: isCompleted
              ? "linear-gradient(135deg, #10B981, #059669)"
              : `${typeColor}20`,
          }}
        >
          {isCompleted ? (
            <Check className="w-7 h-7 text-white" />
          ) : achievement.icon_url ? (
            <img loading="lazy" decoding="async" src={achievement.icon_url} alt="" className="w-8 h-8" />
          ) : (
            <Target className="w-7 h-7" style={{ color: typeColor }} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold" style={{ color: colors.text }}>
                {achievement.name}
              </h4>
              {achievement.description && (
                <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                  {achievement.description}
                </p>
              )}
            </div>

            {/* Type Badge */}
            <span
              className="px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap"
              style={{
                background: `${typeColor}20`,
                color: typeColor,
              }}
            >
              {achievement.achievement_type}
            </span>
          </div>

          {/* Progress Bar */}
          {!isCompleted && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: colors.textMuted }}>
                  {userProgress
                    ? `${userProgress.current_value} / ${userProgress.target_value}`
                    : `0 / ${achievement.target_value}`}
                </span>
                <span style={{ color: typeColor }}>
                  {Math.round(progressPercent)}%
                </span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: `${typeColor}20` }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: typeColor }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                />
              </div>
            </div>
          )}

          {/* Rewards */}
          <div className="flex items-center gap-4 mt-3">
            {achievement.points_reward > 0 && (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-400" />
                <span className="text-sm" style={{ color: colors.textSecondary }}>
                  {achievement.points_reward} pts
                </span>
              </div>
            )}
            {achievement.xp_reward > 0 && (
              <div className="flex items-center gap-1">
                <Zap className="w-4 h-4 text-purple-400" />
                <span className="text-sm" style={{ color: colors.textSecondary }}>
                  {achievement.xp_reward} XP
                </span>
              </div>
            )}
            {achievement.badge_reward_id && (
              <div className="flex items-center gap-1">
                <Award className="w-4 h-4 text-amber-400" />
                <span className="text-sm" style={{ color: colors.textSecondary }}>
                  Badge
                </span>
              </div>
            )}
            {achievement.is_repeatable && (
              <div className="flex items-center gap-1">
                <RefreshCw className="w-4 h-4 text-blue-400" />
                <span className="text-sm" style={{ color: colors.textSecondary }}>
                  Repeatable
                </span>
              </div>
            )}
          </div>

          {/* Completed Info */}
          {isCompleted && userProgress && (
            <div className="flex items-center gap-2 mt-3">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400">
                Completed on {new Date(userProgress.completed_at!).toLocaleDateString()}
              </span>
              {userProgress.completion_count > 1 && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(16, 185, 129, 0.1)" }}
                >
                  x{userProgress.completion_count}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default AchievementsProgress;

import React from "react";
import { motion } from "framer-motion";
import {
  Star,
  Zap,
  TrendingUp,
  Calendar,
  Target,
  Trophy,
  Award,
  Flame,
} from "lucide-react";
import { GamificationDashboard } from "./api/gamification";

interface StatsOverviewProps {
  data: GamificationDashboard;
  colors: Record<string, string>;
}

export function StatsOverview({ data, colors }: StatsOverviewProps) {
  const stats = [
    {
      label: "Total Points",
      value: data.points_summary.total_points.toLocaleString(),
      icon: Star,
      color: "#FFD600",
      bgColor: "rgba(255, 214, 0, 0.1)",
      description: "Lifetime earned",
    },
    {
      label: "Weekly Points",
      value: data.points_summary.weekly_points.toLocaleString(),
      icon: TrendingUp,
      color: "#10B981",
      bgColor: "rgba(16, 185, 129, 0.1)",
      description: "This week",
    },
    {
      label: "Total XP",
      value: data.points_summary.total_xp.toLocaleString(),
      icon: Zap,
      color: "#8B5CF6",
      bgColor: "rgba(139, 92, 246, 0.1)",
      description: `Level ${data.level_info.level}`,
    },
    {
      label: "Badges Earned",
      value: data.badges_earned.toString(),
      icon: Award,
      color: "#F59E0B",
      bgColor: "rgba(245, 158, 11, 0.1)",
      description: `of ${data.badges_total} total`,
    },
    {
      label: "Achievements",
      value: data.achievements_completed.toString(),
      icon: Target,
      color: "#3B82F6",
      bgColor: "rgba(59, 130, 246, 0.1)",
      description: `of ${data.achievements_total} completed`,
    },
    {
      label: "Current Streak",
      value: `${data.current_streak.current_streak}`,
      icon: Flame,
      color: "#EF4444",
      bgColor: "rgba(239, 68, 68, 0.1)",
      description: `days (best: ${data.current_streak.longest_streak})`,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-6"
      style={{
        background: colors.cardBg,
        backdropFilter: "blur(24px)",
        border: `1px solid ${colors.border}`,
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold" style={{ color: colors.text }}>
          Your Stats
        </h3>
        <Trophy className="w-6 h-6" style={{ color: colors.accent }} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 rounded-xl transition-all hover:scale-105"
              style={{
                background: stat.bgColor,
                border: `1px solid ${stat.color}30`,
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: `${stat.color}20` }}
                >
                  <Icon className="w-5 h-5" style={{ color: stat.color }} />
                </div>
              </div>
              <div className="text-2xl font-bold" style={{ color: colors.text }}>
                {stat.value}
              </div>
              <div className="text-sm font-medium" style={{ color: stat.color }}>
                {stat.label}
              </div>
              <div className="text-xs mt-1" style={{ color: colors.textMuted }}>
                {stat.description}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Points Breakdown */}
      <div className="mt-6 pt-6" style={{ borderTop: `1px solid ${colors.border}` }}>
        <h4 className="text-sm font-medium mb-4" style={{ color: colors.textSecondary }}>
          Points Breakdown
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <PointsBar
            label="Weekly"
            value={data.points_summary.weekly_points}
            maxValue={Math.max(data.points_summary.weekly_points, data.points_summary.monthly_points, 100)}
            color="#10B981"
            colors={colors}
          />
          <PointsBar
            label="Monthly"
            value={data.points_summary.monthly_points}
            maxValue={Math.max(data.points_summary.weekly_points, data.points_summary.monthly_points, 100)}
            color="#3B82F6"
            colors={colors}
          />
          <PointsBar
            label="Lifetime"
            value={data.points_summary.lifetime_points}
            maxValue={data.points_summary.lifetime_points || 100}
            color="#FFD600"
            colors={colors}
          />
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Points Bar Component
// =============================================================================

interface PointsBarProps {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  colors: Record<string, string>;
}

function PointsBar({ label, value, maxValue, color, colors }: PointsBarProps) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div>
      <div className="flex justify-between mb-2">
        <span className="text-sm" style={{ color: colors.textSecondary }}>
          {label}
        </span>
        <span className="text-sm font-medium" style={{ color }}>
          {value.toLocaleString()}
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
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
}

export default StatsOverview;

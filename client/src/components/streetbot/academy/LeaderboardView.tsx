import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Medal,
  Crown,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Calendar,
  Globe,
  Star,
  ChevronRight,
} from "lucide-react";
import {
  getLeaderboard,
  getUserRank,
  Leaderboard,
  LeaderboardEntry,
} from "./api/gamification";

interface LeaderboardViewProps {
  userId: string;
  colors: Record<string, string>;
  courseId?: string;
}

type LeaderboardType = "global" | "weekly" | "monthly";

export function LeaderboardView({ userId, colors, courseId }: LeaderboardViewProps) {
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<LeaderboardType>("global");

  useEffect(() => {
    async function loadLeaderboard() {
      setLoading(true);
      try {
        const [board, rank] = await Promise.all([
          getLeaderboard(activeType, courseId, 100),
          getUserRank(userId, activeType, courseId),
        ]);
        setLeaderboard(board);
        setUserRank(rank);
      } catch (error) {
        console.error("Failed to load leaderboard:", error);
      } finally {
        setLoading(false);
      }
    }

    loadLeaderboard();
  }, [userId, courseId, activeType]);

  const leaderboardTypes: { value: LeaderboardType; label: string; icon: React.ElementType }[] = [
    { value: "global", label: "All Time", icon: Globe },
    { value: "weekly", label: "This Week", icon: Calendar },
    { value: "monthly", label: "This Month", icon: Trophy },
  ];

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-300" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return null;
  };

  const getRankBgColor = (rank: number) => {
    if (rank === 1) return "linear-gradient(135deg, rgba(255, 214, 0, 0.2), rgba(245, 158, 11, 0.1))";
    if (rank === 2) return "linear-gradient(135deg, rgba(192, 192, 192, 0.2), rgba(156, 163, 175, 0.1))";
    if (rank === 3) return "linear-gradient(135deg, rgba(217, 119, 6, 0.2), rgba(180, 83, 9, 0.1))";
    return colors.cardBg;
  };

  const getRankBorderColor = (rank: number) => {
    if (rank === 1) return "#FFD600";
    if (rank === 2) return "#C0C0C0";
    if (rank === 3) return "#CD7F32";
    return colors.border;
  };

  const getRankChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

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
      {/* Header with Type Selector */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: colors.cardBg,
          backdropFilter: "blur(24px)",
          border: `1px solid ${colors.border}`,
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(255, 214, 0, 0.1)" }}
            >
              <Trophy className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold" style={{ color: colors.text }}>
                Leaderboard
              </h3>
              <p style={{ color: colors.textSecondary }}>
                {leaderboard?.total_participants || 0} participants
              </p>
            </div>
          </div>

          {/* Type Tabs */}
          <div className="flex gap-2">
            {leaderboardTypes.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.value}
                  onClick={() => setActiveType(type.value)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: activeType === type.value ? colors.accent : colors.cardBg,
                    color: activeType === type.value ? "#000" : colors.textSecondary,
                    border: `1px solid ${activeType === type.value ? colors.accent : colors.border}`,
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {type.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* User's Current Rank Card */}
        {userRank && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${colors.accent}20, ${colors.accent}05)`,
              border: `1px solid ${colors.accent}`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg"
                  style={{
                    background: colors.accent,
                    color: "#000",
                  }}
                >
                  #{userRank.rank}
                </div>
                <div>
                  <p className="font-semibold" style={{ color: colors.text }}>
                    Your Rank
                  </p>
                  <p className="text-sm" style={{ color: colors.textSecondary }}>
                    {userRank.score.toLocaleString()} points
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getRankChangeIcon(userRank.rank_change)}
                <span
                  className="text-sm"
                  style={{
                    color:
                      userRank.rank_change > 0
                        ? "#10B981"
                        : userRank.rank_change < 0
                        ? "#EF4444"
                        : colors.textMuted,
                  }}
                >
                  {userRank.rank_change > 0 && "+"}
                  {userRank.rank_change !== 0 ? userRank.rank_change : "—"}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Top 3 Podium */}
      {leaderboard && leaderboard.entries.length >= 3 && (
        <div className="grid grid-cols-3 gap-4">
          {/* Second Place */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="pt-8"
          >
            <PodiumCard
              entry={leaderboard.entries[1]}
              rank={2}
              colors={colors}
              isCurrentUser={leaderboard.entries[1]?.user_id === userId}
            />
          </motion.div>

          {/* First Place */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <PodiumCard
              entry={leaderboard.entries[0]}
              rank={1}
              colors={colors}
              isCurrentUser={leaderboard.entries[0]?.user_id === userId}
            />
          </motion.div>

          {/* Third Place */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="pt-12"
          >
            <PodiumCard
              entry={leaderboard.entries[2]}
              rank={3}
              colors={colors}
              isCurrentUser={leaderboard.entries[2]?.user_id === userId}
            />
          </motion.div>
        </div>
      )}

      {/* Full Leaderboard List */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: colors.cardBg,
          backdropFilter: "blur(24px)",
          border: `1px solid ${colors.border}`,
        }}
      >
        <div className="p-4 border-b" style={{ borderColor: colors.border }}>
          <h4 className="font-semibold" style={{ color: colors.text }}>
            Rankings
          </h4>
        </div>

        <div className="divide-y" style={{ borderColor: colors.border }}>
          {leaderboard?.entries.slice(3).map((entry, index) => (
            <LeaderboardRow
              key={entry.id}
              entry={entry}
              index={index + 3}
              colors={colors}
              isCurrentUser={entry.user_id === userId}
              getRankChangeIcon={getRankChangeIcon}
            />
          ))}
        </div>

        {leaderboard?.entries.length === 0 && (
          <div className="text-center py-12" style={{ color: colors.textSecondary }}>
            <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No participants yet</p>
            <p className="text-sm">Be the first to earn points!</p>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Podium Card Component
// =============================================================================

interface PodiumCardProps {
  entry: LeaderboardEntry;
  rank: number;
  colors: Record<string, string>;
  isCurrentUser: boolean;
}

function PodiumCard({ entry, rank, colors, isCurrentUser }: PodiumCardProps) {
  const getRankColor = (r: number) => {
    if (r === 1) return "#FFD600";
    if (r === 2) return "#C0C0C0";
    if (r === 3) return "#CD7F32";
    return colors.textMuted;
  };

  const rankColor = getRankColor(rank);

  return (
    <div
      className="rounded-2xl p-4 text-center transition-all hover:scale-105"
      style={{
        background: isCurrentUser
          ? `linear-gradient(135deg, ${colors.accent}20, ${colors.accent}05)`
          : colors.cardBg,
        border: `2px solid ${isCurrentUser ? colors.accent : rankColor}`,
        boxShadow: rank === 1 ? `0 8px 32px ${rankColor}40` : undefined,
      }}
    >
      {/* Crown/Medal Icon */}
      <div className="flex justify-center mb-3">
        {rank === 1 ? (
          <Crown className="w-8 h-8" style={{ color: rankColor }} />
        ) : (
          <Medal className="w-7 h-7" style={{ color: rankColor }} />
        )}
      </div>

      {/* Avatar */}
      <div
        className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3 text-2xl font-bold"
        style={{
          background: `linear-gradient(135deg, ${rankColor}, ${rankColor}80)`,
          color: rank === 1 ? "#000" : "#fff",
          border: `3px solid ${rankColor}`,
        }}
      >
        {entry.avatar_url ? (
          <img loading="lazy" decoding="async"
            src={entry.avatar_url}
            alt=""
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          entry.display_name?.charAt(0) || entry.username?.charAt(0) || "?"
        )}
      </div>

      {/* Name */}
      <p
        className="font-semibold truncate"
        style={{ color: isCurrentUser ? colors.accent : colors.text }}
      >
        {entry.display_name || entry.username || "Anonymous"}
        {isCurrentUser && " (You)"}
      </p>

      {/* Level */}
      <div className="flex items-center justify-center gap-1 mt-1">
        <Star className="w-3 h-3" style={{ color: rankColor }} />
        <span className="text-xs" style={{ color: colors.textMuted }}>
          Level {entry.level}
        </span>
      </div>

      {/* Score */}
      <div
        className="mt-3 py-2 px-4 rounded-xl inline-block"
        style={{ background: `${rankColor}20` }}
      >
        <span className="font-bold text-lg" style={{ color: rankColor }}>
          {entry.score.toLocaleString()}
        </span>
        <span className="text-xs ml-1" style={{ color: colors.textMuted }}>
          pts
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// Leaderboard Row Component
// =============================================================================

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  index: number;
  colors: Record<string, string>;
  isCurrentUser: boolean;
  getRankChangeIcon: (change: number) => React.ReactNode;
}

function LeaderboardRow({
  entry,
  index,
  colors,
  isCurrentUser,
  getRankChangeIcon,
}: LeaderboardRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      className="flex items-center gap-4 p-4 transition-all hover:bg-white/5"
      style={{
        background: isCurrentUser ? `${colors.accent}10` : "transparent",
        borderLeft: isCurrentUser ? `3px solid ${colors.accent}` : "3px solid transparent",
      }}
    >
      {/* Rank */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center font-bold"
        style={{
          background: isCurrentUser ? colors.accent : `${colors.text}10`,
          color: isCurrentUser ? "#000" : colors.text,
        }}
      >
        {entry.rank}
      </div>

      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium"
        style={{
          background: `${colors.accent}20`,
          color: colors.accent,
        }}
      >
        {entry.avatar_url ? (
          <img loading="lazy" decoding="async"
            src={entry.avatar_url}
            alt=""
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          entry.display_name?.charAt(0) || entry.username?.charAt(0) || "?"
        )}
      </div>

      {/* Name & Level */}
      <div className="flex-1 min-w-0">
        <p
          className="font-medium truncate"
          style={{ color: isCurrentUser ? colors.accent : colors.text }}
        >
          {entry.display_name || entry.username || "Anonymous"}
          {isCurrentUser && " (You)"}
        </p>
        <p className="text-xs" style={{ color: colors.textMuted }}>
          Level {entry.level}
        </p>
      </div>

      {/* Rank Change */}
      <div className="flex items-center gap-1">
        {getRankChangeIcon(entry.rank_change)}
        <span
          className="text-xs"
          style={{
            color:
              entry.rank_change > 0
                ? "#10B981"
                : entry.rank_change < 0
                ? "#EF4444"
                : colors.textMuted,
          }}
        >
          {entry.rank_change > 0 && "+"}
          {entry.rank_change !== 0 ? entry.rank_change : "—"}
        </span>
      </div>

      {/* Score */}
      <div className="text-right">
        <p className="font-bold" style={{ color: colors.accent }}>
          {entry.score.toLocaleString()}
        </p>
        <p className="text-xs" style={{ color: colors.textMuted }}>
          points
        </p>
      </div>
    </motion.div>
  );
}

export default LeaderboardView;

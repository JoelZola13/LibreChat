import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Medal,
  Award,
  Lock,
  Check,
  Star,
  Sparkles,
  Filter,
  X,
} from "lucide-react";
import { sbFetch } from "../shared/sbFetch";

// ============================================================================
// Types (from gamification API, kept for UI compat)
// ============================================================================

interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  badge_type: string;
  category: string | null;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  points_value: number;
  xp_value: number;
  is_active: boolean;
  is_secret: boolean;
  course_id: string | null;
  created_at: string;
  updated_at: string;
}

interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  course_id: string | null;
  metadata: Record<string, unknown>;
  badge: Badge;
}

// ============================================================================
// Moodle badge -> internal Badge mapper
// ============================================================================

function mapMoodleBadge(mb: Record<string, unknown>): Badge {
  // Moodle badges have: id, name, description, badgeurl, issuername, etc.
  return {
    id: String(mb.id ?? ""),
    name: (mb.name as string) || "Badge",
    description: (mb.description as string) || null,
    icon_url: (mb.badgeurl as string) || (mb.icon_url as string) || null,
    badge_type: "achievement",
    category: (mb.issuername as string) || null,
    rarity: "common", // Moodle doesn't have rarity — default to common
    points_value: 0,
    xp_value: 0,
    is_active: true,
    is_secret: false,
    course_id: mb.courseid ? String(mb.courseid) : null,
    created_at: mb.timecreated
      ? new Date((mb.timecreated as number) * 1000).toISOString()
      : new Date().toISOString(),
    updated_at: mb.timemodified
      ? new Date((mb.timemodified as number) * 1000).toISOString()
      : new Date().toISOString(),
  };
}

function mapMoodleBadgeToUserBadge(mb: Record<string, unknown>, userId: string): UserBadge {
  const badge = mapMoodleBadge(mb);
  return {
    id: `ub-${badge.id}`,
    user_id: userId,
    badge_id: badge.id,
    earned_at: mb.dateissued
      ? new Date((mb.dateissued as number) * 1000).toISOString()
      : new Date().toISOString(),
    course_id: badge.course_id,
    metadata: {},
    badge,
  };
}

// ============================================================================
// Utility functions
// ============================================================================

function getRarityColor(rarity: Badge["rarity"]): string {
  const colors = {
    common: "#9CA3AF",
    uncommon: "#10B981",
    rare: "#3B82F6",
    epic: "#8B5CF6",
    legendary: "#F59E0B",
  };
  return colors[rarity] || colors.common;
}

function getRarityBgColor(rarity: Badge["rarity"]): string {
  const colors = {
    common: "rgba(156, 163, 175, 0.1)",
    uncommon: "rgba(16, 185, 129, 0.1)",
    rare: "rgba(59, 130, 246, 0.1)",
    epic: "rgba(139, 92, 246, 0.1)",
    legendary: "rgba(245, 158, 11, 0.1)",
  };
  return colors[rarity] || colors.common;
}

interface BadgesShowcaseProps {
  userId: string;
  colors: Record<string, string>;
}

type RarityFilter = "all" | "common" | "uncommon" | "rare" | "epic" | "legendary";

export function BadgesShowcase({ userId, colors }: BadgesShowcaseProps) {
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [filter, setFilter] = useState<RarityFilter>("all");
  const [showEarnedOnly, setShowEarnedOnly] = useState(false);

  useEffect(() => {
    async function loadBadges() {
      try {
        // Fetch from Moodle badges endpoint
        const resp = await sbFetch(`/api/academy/moodle/badges/${encodeURIComponent(userId)}`);

        if (resp.ok) {
          const data = await resp.json();
          const moodleBadges: Record<string, unknown>[] = data?.badges || [];

          // Map Moodle badges to both UserBadge and Badge arrays
          const earnedList: UserBadge[] = moodleBadges.map((mb) =>
            mapMoodleBadgeToUserBadge(mb, userId)
          );
          const allList: Badge[] = moodleBadges.map(mapMoodleBadge);

          setUserBadges(earnedList);
          setAllBadges(allList);
        } else {
          // Fall back to SBP gamification API
          const [earnedResp, allResp] = await Promise.all([
            sbFetch(`/api/academy/gamification/users/${encodeURIComponent(userId)}/badges`),
            sbFetch(`/api/academy/gamification/badges`),
          ]);

          if (earnedResp.ok) {
            const earnedData = await earnedResp.json();
            setUserBadges(Array.isArray(earnedData) ? earnedData : []);
          }
          if (allResp.ok) {
            const allData = await allResp.json();
            setAllBadges(Array.isArray(allData) ? allData : []);
          }
        }
      } catch (error) {
        console.error("Failed to load badges:", error);
      } finally {
        setLoading(false);
      }
    }

    loadBadges();
  }, [userId]);

  const earnedBadgeIds = new Set(userBadges.map((ub) => ub.badge_id));

  const filteredBadges = allBadges.filter((badge) => {
    if (showEarnedOnly && !earnedBadgeIds.has(badge.id)) return false;
    if (filter !== "all" && badge.rarity !== filter) return false;
    return true;
  });

  const rarityOrder = ["common", "uncommon", "rare", "epic", "legendary"];
  const sortedBadges = [...filteredBadges].sort((a, b) => {
    // Sort by earned first, then by rarity
    const aEarned = earnedBadgeIds.has(a.id);
    const bEarned = earnedBadgeIds.has(b.id);
    if (aEarned !== bEarned) return bEarned ? 1 : -1;
    return rarityOrder.indexOf(b.rarity) - rarityOrder.indexOf(a.rarity);
  });

  const rarityFilters: { value: RarityFilter; label: string; color: string }[] = [
    { value: "all", label: "All", color: colors.textSecondary },
    { value: "common", label: "Common", color: "#9CA3AF" },
    { value: "uncommon", label: "Uncommon", color: "#10B981" },
    { value: "rare", label: "Rare", color: "#3B82F6" },
    { value: "epic", label: "Epic", color: "#8B5CF6" },
    { value: "legendary", label: "Legendary", color: "#F59E0B" },
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
      {/* Header & Filters */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: colors.cardBg,
          backdropFilter: "blur(24px)",
          border: `1px solid ${colors.border}`,
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold" style={{ color: colors.text }}>
              Badge Collection
            </h3>
            <p style={{ color: colors.textSecondary }}>
              {earnedBadgeIds.size} of {allBadges.length} badges earned
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Earned Only Toggle */}
            <button
              onClick={() => setShowEarnedOnly(!showEarnedOnly)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
              style={{
                background: showEarnedOnly ? colors.accent : colors.cardBg,
                color: showEarnedOnly ? "#000" : colors.textSecondary,
                border: `1px solid ${showEarnedOnly ? colors.accent : colors.border}`,
              }}
            >
              {showEarnedOnly ? <Check className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
              Earned Only
            </button>

            {/* Rarity Filter */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: colors.cardBg }}>
              {rarityFilters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: filter === f.value ? f.color : "transparent",
                    color: filter === f.value ? (f.value === "all" ? colors.text : "#fff") : colors.textMuted,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Progress Overview */}
        <div className="mt-6 grid grid-cols-5 gap-3">
          {rarityFilters.slice(1).map((r) => {
            const total = allBadges.filter((b) => b.rarity === r.value).length;
            const earned = userBadges.filter((ub) => ub.badge.rarity === r.value).length;
            const percentage = total > 0 ? (earned / total) * 100 : 0;

            return (
              <div key={r.value}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: r.color }}>{r.label}</span>
                  <span style={{ color: colors.textMuted }}>{earned}/{total}</span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: `${r.color}20` }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: r.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Badge Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {sortedBadges.map((badge, index) => {
          const isEarned = earnedBadgeIds.has(badge.id);
          const userBadge = userBadges.find((ub) => ub.badge_id === badge.id);

          return (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.02 }}
              onClick={() => setSelectedBadge(badge)}
              className="relative cursor-pointer group"
            >
              <div
                className="p-4 rounded-2xl transition-all duration-300"
                style={{
                  background: isEarned ? getRarityBgColor(badge.rarity) : colors.cardBg,
                  border: `1px solid ${isEarned ? getRarityColor(badge.rarity) : colors.border}`,
                  opacity: isEarned ? 1 : 0.5,
                  filter: isEarned ? "none" : "grayscale(100%)",
                }}
              >
                {/* Badge Icon */}
                <div className="relative">
                  <div
                    className="w-16 h-16 mx-auto rounded-xl flex items-center justify-center mb-3"
                    style={{
                      background: isEarned
                        ? `linear-gradient(135deg, ${getRarityColor(badge.rarity)}, ${getRarityColor(badge.rarity)}80)`
                        : colors.cardBg,
                      boxShadow: isEarned
                        ? `0 4px 20px ${getRarityColor(badge.rarity)}40`
                        : "none",
                    }}
                  >
                    {badge.icon_url ? (
                      <img loading="lazy" decoding="async" src={badge.icon_url} alt="" className="w-10 h-10" />
                    ) : (
                      <Award className="w-8 h-8 text-white" />
                    )}
                  </div>

                  {/* Lock Icon for unearned */}
                  {!isEarned && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Lock className="w-6 h-6" style={{ color: colors.textMuted }} />
                    </div>
                  )}

                  {/* Rarity indicator */}
                  <div
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full"
                    style={{
                      background: getRarityColor(badge.rarity),
                      boxShadow: `0 0 8px ${getRarityColor(badge.rarity)}`,
                    }}
                  />
                </div>

                {/* Badge Name */}
                <p
                  className="text-sm font-medium text-center truncate"
                  style={{ color: isEarned ? colors.text : colors.textMuted }}
                >
                  {badge.name}
                </p>

                {/* Earned Date */}
                {userBadge && (
                  <p className="text-xs text-center mt-1" style={{ color: colors.textMuted }}>
                    {new Date(userBadge.earned_at).toLocaleDateString()}
                  </p>
                )}

                {/* Hover Effect */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: `linear-gradient(135deg, ${getRarityColor(badge.rarity)}10, transparent)`,
                  }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Empty State */}
      {sortedBadges.length === 0 && (
        <div className="text-center py-12" style={{ color: colors.textSecondary }}>
          <Medal className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No badges found</p>
          <p className="text-sm">Try adjusting your filters</p>
        </div>
      )}

      {/* Badge Detail Modal */}
      <AnimatePresence>
        {selectedBadge && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0, 0, 0, 0.7)" }}
            onClick={() => setSelectedBadge(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl p-6"
              style={{
                background: colors.cardBg,
                backdropFilter: "blur(24px)",
                border: `1px solid ${getRarityColor(selectedBadge.rarity)}`,
              }}
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedBadge(null)}
                className="absolute top-4 right-4 p-2 rounded-full transition-colors"
                style={{ background: colors.cardBg }}
              >
                <X className="w-5 h-5" style={{ color: colors.textSecondary }} />
              </button>

              {/* Badge Display */}
              <div className="text-center">
                <div
                  className="w-24 h-24 mx-auto rounded-2xl flex items-center justify-center mb-4"
                  style={{
                    background: `linear-gradient(135deg, ${getRarityColor(selectedBadge.rarity)}, ${getRarityColor(selectedBadge.rarity)}80)`,
                    boxShadow: `0 8px 32px ${getRarityColor(selectedBadge.rarity)}40`,
                  }}
                >
                  {selectedBadge.icon_url ? (
                    <img loading="lazy" decoding="async" src={selectedBadge.icon_url} alt="" className="w-14 h-14" />
                  ) : (
                    <Award className="w-12 h-12 text-white" />
                  )}
                </div>

                <h3 className="text-xl font-bold mb-1" style={{ color: colors.text }}>
                  {selectedBadge.name}
                </h3>

                <p
                  className="text-sm font-medium mb-3"
                  style={{ color: getRarityColor(selectedBadge.rarity) }}
                >
                  {selectedBadge.rarity.charAt(0).toUpperCase() + selectedBadge.rarity.slice(1)} Badge
                </p>

                {selectedBadge.description && (
                  <p className="mb-4" style={{ color: colors.textSecondary }}>
                    {selectedBadge.description}
                  </p>
                )}

                {/* Rewards */}
                <div className="flex justify-center gap-6 mb-4">
                  {selectedBadge.points_value > 0 && (
                    <div className="text-center">
                      <div className="flex items-center gap-1 justify-center">
                        <Star className="w-5 h-5 text-yellow-400" />
                        <span className="text-lg font-bold" style={{ color: colors.text }}>
                          {selectedBadge.points_value}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: colors.textMuted }}>
                        Points
                      </p>
                    </div>
                  )}
                  {selectedBadge.xp_value > 0 && (
                    <div className="text-center">
                      <div className="flex items-center gap-1 justify-center">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        <span className="text-lg font-bold" style={{ color: colors.text }}>
                          {selectedBadge.xp_value}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: colors.textMuted }}>
                        XP
                      </p>
                    </div>
                  )}
                </div>

                {/* Earned Status */}
                {earnedBadgeIds.has(selectedBadge.id) ? (
                  <div
                    className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl"
                    style={{ background: "rgba(16, 185, 129, 0.1)" }}
                  >
                    <Check className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-medium">Earned!</span>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl"
                    style={{ background: colors.cardBg }}
                  >
                    <Lock className="w-5 h-5" style={{ color: colors.textMuted }} />
                    <span style={{ color: colors.textMuted }}>Not yet earned</span>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BadgesShowcase;

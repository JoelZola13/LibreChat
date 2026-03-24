import React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle,
  Clock,
  Star,
  Award,
  TrendingUp,
  ThumbsUp,
} from "lucide-react";
import { ReviewerStats } from "./api/peer-review";

interface PeerReviewStatsProps {
  stats: ReviewerStats;
}

export function PeerReviewStats({ stats }: PeerReviewStatsProps) {
  const statItems = [
    {
      label: "Reviews Completed",
      value: stats.reviewsCompleted,
      icon: CheckCircle,
      color: "#10B981",
      bgColor: "rgba(16, 185, 129, 0.15)",
    },
    {
      label: "Reviews Pending",
      value: stats.reviewsPending,
      icon: Clock,
      color: "#F59E0B",
      bgColor: "rgba(245, 158, 11, 0.15)",
    },
    {
      label: "Points Earned",
      value: stats.totalPointsEarned,
      icon: Award,
      color: "#8B5CF6",
      bgColor: "rgba(139, 92, 246, 0.15)",
    },
    {
      label: "Quality Score",
      value: stats.averageQualityScore
        ? `${Math.round(stats.averageQualityScore)}%`
        : "N/A",
      icon: TrendingUp,
      color: "#3B82F6",
      bgColor: "rgba(59, 130, 246, 0.15)",
    },
    {
      label: "Helpfulness",
      value: stats.helpfulnessRatingAvg
        ? `${stats.helpfulnessRatingAvg.toFixed(1)}/5`
        : "N/A",
      icon: ThumbsUp,
      color: "#EC4899",
      bgColor: "rgba(236, 72, 153, 0.15)",
    },
  ];

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(20px)",
        borderRadius: "16px",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        padding: "20px",
      }}
    >
      <h3
        className="font-semibold mb-4 flex items-center gap-2"
        style={{ color: "rgba(255, 255, 255, 0.95)" }}
      >
        <Star className="w-5 h-5" style={{ color: "#F59E0B" }} />
        Your Reviewer Stats
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statItems.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-3 rounded-xl text-center"
            style={{
              background: item.bgColor,
            }}
          >
            <item.icon
              className="w-5 h-5 mx-auto mb-2"
              style={{ color: item.color }}
            />
            <div
              className="text-xl font-bold"
              style={{ color: item.color }}
            >
              {item.value}
            </div>
            <div
              className="text-xs mt-1"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              {item.label}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Progress to next level hint */}
      {stats.reviewsCompleted > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <div className="flex items-center justify-between text-sm mb-2">
            <span style={{ color: "rgba(255, 255, 255, 0.6)" }}>
              Reviewing progress
            </span>
            <span style={{ color: "#8B5CF6" }}>
              {stats.reviewsCompleted} reviews
            </span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: "rgba(255, 255, 255, 0.1)" }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((stats.reviewsCompleted / 10) * 100, 100)}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{
                background: "linear-gradient(90deg, #8B5CF6, #6366F1)",
              }}
            />
          </div>
          <p
            className="text-xs mt-2"
            style={{ color: "rgba(255, 255, 255, 0.4)" }}
          >
            Complete {Math.max(0, 10 - stats.reviewsCompleted)} more reviews to reach &quot;Trusted Reviewer&quot; status
          </p>
        </div>
      )}
    </div>
  );
}

// Compact version for sidebar/dashboard
export function PeerReviewStatsMini({ stats }: PeerReviewStatsProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-4 h-4" style={{ color: "#10B981" }} />
        <span className="text-sm" style={{ color: "rgba(255, 255, 255, 0.7)" }}>
          {stats.reviewsCompleted} completed
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4" style={{ color: "#F59E0B" }} />
        <span className="text-sm" style={{ color: "rgba(255, 255, 255, 0.7)" }}>
          {stats.reviewsPending} pending
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Award className="w-4 h-4" style={{ color: "#8B5CF6" }} />
        <span className="text-sm" style={{ color: "rgba(255, 255, 255, 0.7)" }}>
          {stats.totalPointsEarned} pts
        </span>
      </div>
    </div>
  );
}

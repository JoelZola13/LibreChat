import React from "react";
import { motion } from "framer-motion";

/**
 * Skeleton loader components for the Academy
 * Provides visual placeholders during content loading
 */

// Base shimmer animation
const shimmerAnimation = {
  initial: { backgroundPosition: "-200% 0" },
  animate: { backgroundPosition: "200% 0" },
  transition: { duration: 1.5, repeat: Infinity, ease: "linear" },
} as const;

// Hook for skeleton colors
function useSkeletonColors() {
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";

  return {
    base: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.06)",
    shimmer: isDark
      ? "linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)"
      : "linear-gradient(90deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.02) 50%, rgba(0,0,0,0.06) 100%)",
    border: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
    cardBg: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.7)",
  };
}

// Base skeleton element with shimmer
interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
}

export function Skeleton({
  className = "",
  style = {},
  width,
  height,
  borderRadius = "8px",
}: SkeletonProps) {
  const colors = useSkeletonColors();

  return (
    <motion.div
      className={className}
      style={{
        width,
        height,
        borderRadius,
        background: colors.shimmer,
        backgroundSize: "200% 100%",
        ...style,
      }}
      initial={shimmerAnimation.initial}
      animate={shimmerAnimation.animate}
      transition={shimmerAnimation.transition}
    />
  );
}

// Course card skeleton
export function CourseCardSkeleton() {
  const colors = useSkeletonColors();

  return (
    <div
      style={{
        background: colors.cardBg,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderRadius: "24px",
        border: `1px solid ${colors.border}`,
        overflow: "hidden",
      }}
    >
      {/* Thumbnail skeleton */}
      <Skeleton height="160px" borderRadius="0" />

      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        {/* Category */}
        <Skeleton width="60px" height="12px" />

        {/* Title */}
        <Skeleton width="100%" height="20px" />

        {/* Description lines */}
        <div className="space-y-2">
          <Skeleton width="100%" height="14px" />
          <Skeleton width="80%" height="14px" />
        </div>

        {/* Footer */}
        <div className="flex justify-between pt-2">
          <Skeleton width="50px" height="12px" />
          <Skeleton width="60px" height="12px" />
        </div>
      </div>
    </div>
  );
}

// Stats card skeleton
export function StatsCardSkeleton() {
  const colors = useSkeletonColors();

  return (
    <div
      style={{
        background: colors.cardBg,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderRadius: "24px",
        border: `1px solid ${colors.border}`,
        padding: "24px",
      }}
    >
      {/* Icon skeleton */}
      <Skeleton width="48px" height="48px" borderRadius="12px" className="mb-4" />

      {/* Value */}
      <Skeleton width="80px" height="32px" className="mb-2" />

      {/* Label */}
      <Skeleton width="100px" height="14px" />
    </div>
  );
}

// Continue learning card skeleton (larger)
export function ContinueLearningCardSkeleton() {
  const colors = useSkeletonColors();

  return (
    <div
      style={{
        background: colors.cardBg,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderRadius: "24px",
        border: `1px solid ${colors.border}`,
        padding: "24px",
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2 flex-1">
          <Skeleton width="80px" height="12px" />
          <Skeleton width="200px" height="24px" />
        </div>
        <Skeleton width="32px" height="32px" borderRadius="50%" />
      </div>

      {/* Description */}
      <div className="space-y-2 mb-4">
        <Skeleton width="100%" height="14px" />
        <Skeleton width="70%" height="14px" />
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton width="50px" height="12px" />
          <Skeleton width="30px" height="12px" />
        </div>
        <Skeleton width="100%" height="8px" borderRadius="4px" />
      </div>
    </div>
  );
}

// Learning path card skeleton
export function LearningPathCardSkeleton() {
  const colors = useSkeletonColors();

  return (
    <div
      style={{
        background: colors.cardBg,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderRadius: "24px",
        border: `1px solid ${colors.border}`,
        padding: "24px",
      }}
    >
      {/* Icon */}
      <Skeleton width="56px" height="56px" borderRadius="12px" className="mb-4" />

      {/* Title */}
      <Skeleton width="140px" height="24px" className="mb-2" />

      {/* Description */}
      <Skeleton width="100%" height="14px" className="mb-4" />

      {/* Meta info */}
      <div className="flex gap-4">
        <Skeleton width="80px" height="14px" />
        <Skeleton width="50px" height="14px" />
      </div>
    </div>
  );
}

// Sidebar navigation item skeleton
export function SidebarItemSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton width="20px" height="20px" borderRadius="6px" />
      <Skeleton width="100px" height="16px" />
    </div>
  );
}

// Quiz question skeleton
export function QuizQuestionSkeleton() {
  const colors = useSkeletonColors();

  return (
    <div
      style={{
        background: colors.cardBg,
        borderRadius: "16px",
        border: `1px solid ${colors.border}`,
        padding: "24px",
      }}
    >
      {/* Question number */}
      <Skeleton width="100px" height="14px" className="mb-4" />

      {/* Question text */}
      <Skeleton width="100%" height="24px" className="mb-6" />

      {/* Options */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton width="24px" height="24px" borderRadius="50%" />
            <Skeleton width="80%" height="18px" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Leaderboard row skeleton
export function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3 px-4">
      <Skeleton width="30px" height="24px" />
      <Skeleton width="40px" height="40px" borderRadius="50%" />
      <div className="flex-1">
        <Skeleton width="120px" height="16px" className="mb-1" />
        <Skeleton width="80px" height="12px" />
      </div>
      <Skeleton width="60px" height="20px" />
    </div>
  );
}

// Badge skeleton
export function BadgeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2">
      <Skeleton width="64px" height="64px" borderRadius="16px" />
      <Skeleton width="80px" height="14px" />
    </div>
  );
}

// Video player skeleton
export function VideoPlayerSkeleton() {
  const colors = useSkeletonColors();

  return (
    <div
      style={{
        background: colors.cardBg,
        borderRadius: "16px",
        overflow: "hidden",
        aspectRatio: "16/9",
        position: "relative",
      }}
    >
      <Skeleton width="100%" height="100%" borderRadius="0" />

      {/* Play button overlay */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.3)" }}
      >
        <Skeleton width="64px" height="64px" borderRadius="50%" />
      </div>

      {/* Controls skeleton */}
      <div
        className="absolute bottom-0 left-0 right-0 p-4 flex items-center gap-4"
        style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.7))" }}
      >
        <Skeleton width="24px" height="24px" borderRadius="4px" />
        <Skeleton width="100%" height="4px" borderRadius="2px" style={{ flex: 1 }} />
        <Skeleton width="50px" height="14px" />
      </div>
    </div>
  );
}

// Assignment card skeleton
export function AssignmentCardSkeleton() {
  const colors = useSkeletonColors();

  return (
    <div
      style={{
        background: colors.cardBg,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderRadius: "16px",
        border: `1px solid ${colors.border}`,
        padding: "20px",
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <Skeleton width="60%" height="20px" />
        <Skeleton width="70px" height="24px" borderRadius="12px" />
      </div>

      <Skeleton width="100%" height="14px" className="mb-2" />
      <Skeleton width="80%" height="14px" className="mb-4" />

      <div className="flex items-center gap-4">
        <Skeleton width="100px" height="14px" />
        <Skeleton width="80px" height="14px" />
      </div>
    </div>
  );
}

// Dashboard skeleton - combines multiple skeletons
export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Welcome section skeleton */}
      <div className="space-y-2">
        <Skeleton width="300px" height="36px" />
        <Skeleton width="400px" height="20px" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      {/* Continue learning skeleton */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <Skeleton width="200px" height="28px" />
          <Skeleton width="80px" height="16px" />
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <ContinueLearningCardSkeleton />
          <ContinueLearningCardSkeleton />
        </div>
      </div>

      {/* Courses grid skeleton */}
      <div>
        <Skeleton width="180px" height="28px" className="mb-6" />
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <CourseCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Courses page skeleton
export function CoursesPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton width="150px" height="32px" />
        <div className="flex gap-3">
          <Skeleton width="120px" height="40px" borderRadius="12px" />
          <Skeleton width="100px" height="40px" borderRadius="12px" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width="80px" height="36px" borderRadius="18px" />
        ))}
      </div>

      {/* Courses grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <CourseCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

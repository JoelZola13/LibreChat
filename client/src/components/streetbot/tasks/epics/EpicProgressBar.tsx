'use client';

import type { Epic } from '@/lib/api/modules';

interface EpicProgressBarProps {
  epic: Epic;
  showLabel?: boolean;
  height?: number;
}

export default function EpicProgressBar({
  epic,
  showLabel = true,
  height = 8,
}: EpicProgressBarProps) {
  // Calculate different segments
  const completedPercent = epic.total_children > 0
    ? (epic.completed_children / epic.total_children) * 100
    : 0;
  const inProgressPercent = 0; // Would need more data for this
  const remainingPercent = 100 - completedPercent - inProgressPercent;

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5 text-xs">
          <span className="text-white/60">
            {epic.completed_children} of {epic.total_children} completed
          </span>
          <span className="text-white font-medium">{epic.progress_percentage}%</span>
        </div>
      )}

      <div
        className="w-full bg-white/10 rounded-full overflow-hidden flex"
        style={{ height }}
      >
        {/* Completed segment */}
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${completedPercent}%`,
            backgroundColor: epic.color,
          }}
        />

        {/* In progress segment (lighter shade) */}
        {inProgressPercent > 0 && (
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${inProgressPercent}%`,
              backgroundColor: `${epic.color}80`,
            }}
          />
        )}
      </div>

      {/* Legend for multi-segment */}
      {showLabel && epic.total_story_points > 0 && (
        <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
          <span>{epic.completed_story_points} / {epic.total_story_points} story points</span>
        </div>
      )}
    </div>
  );
}

'use client';

import type { WorkItemType } from '@/lib/api/modules';
import TypeIcon from './TypeIcon';

interface TypeBadgeProps {
  type: WorkItemType;
  onClick?: () => void;
  showLabel?: boolean;
}

export default function TypeBadge({ type, onClick, showLabel = true }: TypeBadgeProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors
                hover:bg-white/10"
      style={{
        backgroundColor: `${type.color}15`,
      }}
    >
      <TypeIcon type={type} size="sm" />
      {showLabel && (
        <span className="text-xs" style={{ color: type.color }}>
          {type.name}
        </span>
      )}
    </button>
  );
}

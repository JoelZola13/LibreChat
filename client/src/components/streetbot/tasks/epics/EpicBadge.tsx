'use client';

import { Zap } from 'lucide-react';
import type { Epic } from '@/lib/api/modules';

interface EpicBadgeProps {
  epic: Epic;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

export default function EpicBadge({ epic, onClick, size = 'sm' }: EpicBadgeProps) {
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs gap-1',
    md: 'px-2 py-1 text-sm gap-1.5',
  };

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`inline-flex items-center rounded transition-colors
                hover:bg-white/10 ${sizeClasses[size]}`}
      style={{
        backgroundColor: `${epic.color}20`,
        color: epic.color,
      }}
    >
      {epic.icon ? (
        <span>{epic.icon}</span>
      ) : (
        <Zap className={iconSize} />
      )}
      <span className="truncate max-w-[100px]">{epic.name}</span>
    </button>
  );
}

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { StateGroup } from '@/lib/api/modules';

interface StateGroupHeaderProps {
  group: StateGroup;
  taskCount: number;
  isExpanded?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}

export default function StateGroupHeader({
  group,
  taskCount,
  isExpanded = true,
  onToggle,
  children,
}: StateGroupHeaderProps) {
  const groupTypeIcons: Record<string, string> = {
    backlog: 'Backlog',
    unstarted: 'Not Started',
    started: 'In Progress',
    completed: 'Done',
    cancelled: 'Cancelled',
  };

  return (
    <div className="space-y-2">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 py-2 hover:bg-white/5 rounded-lg px-2 transition-colors"
      >
        {onToggle && (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-white/40" />
          ) : (
            <ChevronRight className="w-4 h-4 text-white/40" />
          )
        )}
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: group.color }}
        />
        <span className="text-sm font-medium text-white">{group.name}</span>
        <span className="text-xs text-white/40 px-1.5 py-0.5 bg-white/10 rounded">
          {taskCount}
        </span>
        <span className="text-xs text-white/30 ml-auto">
          {groupTypeIcons[group.group_type] || group.group_type}
        </span>
      </button>

      {isExpanded && children}
    </div>
  );
}

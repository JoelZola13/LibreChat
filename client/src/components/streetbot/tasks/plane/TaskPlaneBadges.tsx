'use client';

import type { Cycle } from '@/lib/api/cycles';
import type { Module, Epic, WorkItemType } from '@/lib/api/modules';
import { RotateCcw, Layers, Zap } from 'lucide-react';
import { TypeIcon } from '../work-items';

interface TaskPlaneBadgesProps {
  cycle?: Cycle | null;
  module?: Module | null;
  epic?: Epic | null;
  workItemType?: WorkItemType | null;
  onCycleClick?: () => void;
  onModuleClick?: () => void;
  onEpicClick?: () => void;
  onTypeClick?: () => void;
  compact?: boolean;
}

/**
 * Renders Plane feature badges for a task row.
 * Shows cycle, module, epic, and work item type badges if available.
 */
export default function TaskPlaneBadges({
  cycle,
  module,
  epic,
  workItemType,
  onCycleClick,
  onModuleClick,
  onEpicClick,
  onTypeClick,
  compact = true,
}: TaskPlaneBadgesProps) {
  if (!cycle && !module && !epic && !workItemType) {
    return null;
  }

  const baseButtonStyle = compact
    ? 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs'
    : 'inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm';

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {/* Work Item Type Badge */}
      {workItemType && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTypeClick?.();
          }}
          className={`${baseButtonStyle} hover:bg-white/10 transition-colors`}
          style={{ backgroundColor: `${workItemType.color}15` }}
          title={workItemType.name}
        >
          <TypeIcon type={workItemType} size="sm" />
          {!compact && <span style={{ color: workItemType.color }}>{workItemType.name}</span>}
        </button>
      )}

      {/* Cycle Badge */}
      {cycle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCycleClick?.();
          }}
          className={`${baseButtonStyle} hover:bg-white/10 transition-colors`}
          style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)' }}
          title={`Cycle: ${cycle.name}`}
        >
          <RotateCcw className="w-3 h-3 text-indigo-400" />
          {!compact && <span className="text-indigo-400 truncate max-w-[80px]">{cycle.name}</span>}
        </button>
      )}

      {/* Module Badge */}
      {module && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onModuleClick?.();
          }}
          className={`${baseButtonStyle} hover:bg-white/10 transition-colors`}
          style={{ backgroundColor: `${module.color}20` }}
          title={`Module: ${module.name}`}
        >
          <Layers className="w-3 h-3" style={{ color: module.color }} />
          {!compact && (
            <span style={{ color: module.color }} className="truncate max-w-[80px]">
              {module.name}
            </span>
          )}
        </button>
      )}

      {/* Epic Badge */}
      {epic && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEpicClick?.();
          }}
          className={`${baseButtonStyle} hover:bg-white/10 transition-colors`}
          style={{ backgroundColor: `${epic.color}20` }}
          title={`Epic: ${epic.name}`}
        >
          <Zap className="w-3 h-3" style={{ color: epic.color }} />
          {!compact && (
            <span style={{ color: epic.color }} className="truncate max-w-[80px]">
              {epic.name}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

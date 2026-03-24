'use client';

import { format } from 'date-fns';
import { Zap, Calendar, User, ChevronRight } from 'lucide-react';
import type { Epic } from '@/lib/api/modules';

interface EpicCardProps {
  epic: Epic;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

export default function EpicCard({
  epic,
  isSelected = false,
  onClick,
  compact = false,
}: EpicCardProps) {
  const statusColors: Record<string, string> = {
    open: 'bg-gray-500/20 text-gray-400',
    in_progress: 'bg-blue-500/20 text-blue-400',
    done: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
  };

  const priorityColors: Record<string, string> = {
    none: 'text-white/40',
    low: 'text-gray-400',
    medium: 'text-yellow-400',
    high: 'text-orange-400',
    urgent: 'text-red-400',
  };

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-3 ${
          isSelected
            ? 'bg-white/10 border border-white/20'
            : 'hover:bg-white/5 border border-transparent'
        }`}
      >
        <div
          className="w-1.5 h-8 rounded-full flex-shrink-0"
          style={{ backgroundColor: epic.color }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white truncate">{epic.name}</span>
            {epic.priority !== 'none' && (
              <span className={`text-xs ${priorityColors[epic.priority]}`}>
                {epic.priority}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-white/40">
            <span>{epic.completed_children}/{epic.total_children} tasks</span>
            <span>|</span>
            <span>{epic.progress_percentage}%</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0" />
      </button>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`glass-card p-4 rounded-xl cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-offset-2 ring-offset-black' : 'hover:bg-white/5'
      }`}
      style={{
        '--tw-ring-color': epic.color,
        borderLeft: `4px solid ${epic.color}`,
      } as React.CSSProperties}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${epic.color}20` }}
          >
            {epic.icon ? (
              <span className="text-lg">{epic.icon}</span>
            ) : (
              <Zap className="w-5 h-5" style={{ color: epic.color }} />
            )}
          </div>
          <div>
            <h3 className="text-base font-medium text-white flex items-center gap-2">
              {epic.name}
              {epic.priority !== 'none' && (
                <span className={`text-xs ${priorityColors[epic.priority]} capitalize`}>
                  {epic.priority}
                </span>
              )}
            </h3>
            {epic.description && (
              <p className="text-sm text-white/50 line-clamp-1 mt-0.5">
                {epic.description}
              </p>
            )}
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded ${statusColors[epic.status]}`}>
          {epic.status.replace('_', ' ')}
        </span>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="text-white/60">
              {epic.completed_children}/{epic.total_children} tasks
            </span>
            <span className="text-white/40">
              {epic.completed_story_points}/{epic.total_story_points} pts
            </span>
          </div>
          <span className="text-white font-medium">{epic.progress_percentage}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${epic.progress_percentage}%`,
              backgroundColor: epic.color,
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
        <div className="flex items-center gap-3 text-xs text-white/40">
          {epic.target_date && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{format(new Date(epic.target_date), 'MMM d, yyyy')}</span>
            </div>
          )}
          {epic.owner_id && (
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>Owner assigned</span>
            </div>
          )}
        </div>
        {epic.labels.length > 0 && (
          <div className="flex items-center gap-1">
            {epic.labels.slice(0, 2).map((label, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 text-xs bg-white/10 rounded text-white/60"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

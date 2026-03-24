'use client';

import { format, differenceInDays, isAfter, isBefore, isWithinInterval } from 'date-fns';
import { Calendar, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import type { Cycle } from '@/lib/api/cycles';

interface CycleCardProps {
  cycle: Cycle;
  isSelected?: boolean;
  isActive?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

export default function CycleCard({
  cycle,
  isSelected = false,
  isActive = false,
  onClick,
  compact = true,
}: CycleCardProps) {
  const startDate = new Date(cycle.start_date);
  const endDate = new Date(cycle.end_date);
  const now = new Date();

  // Calculate days remaining/overdue
  const daysRemaining = differenceInDays(endDate, now);
  const totalDays = differenceInDays(endDate, startDate);
  const daysElapsed = differenceInDays(now, startDate);
  const timeProgress = Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100));

  const isOverdue = isAfter(now, endDate) && cycle.status !== 'completed';
  const isUpcoming = isBefore(now, startDate);
  const isInProgress = isWithinInterval(now, { start: startDate, end: endDate });

  // Status colors
  const statusColors: Record<string, string> = {
    planned: 'bg-yellow-500/20 text-yellow-400',
    active: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
  };

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
          isSelected
            ? 'bg-indigo-500/20 border border-indigo-500/40'
            : 'hover:bg-white/5 border border-transparent'
        } ${isActive ? 'border-l-2 border-l-blue-500' : ''}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm text-white truncate">{cycle.name}</span>
            {isOverdue && <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />}
          </div>
          <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[cycle.status]}`}>
            {cycle.status}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-xs text-white/40">
            <span>{cycle.completed_tasks}/{cycle.total_tasks} tasks</span>
            <span>{cycle.progress}%</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
              style={{ width: `${cycle.progress}%` }}
            />
          </div>
        </div>

        {/* Date info */}
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-white/40">
          <Calendar className="w-3 h-3" />
          <span>{format(startDate, 'MMM d')} - {format(endDate, 'MMM d')}</span>
          {isInProgress && daysRemaining >= 0 && (
            <span className="ml-auto text-white/60">{daysRemaining}d left</span>
          )}
          {isOverdue && (
            <span className="ml-auto text-red-400">{Math.abs(daysRemaining)}d overdue</span>
          )}
        </div>
      </button>
    );
  }

  // Full card view
  return (
    <div
      onClick={onClick}
      className={`glass-card p-4 rounded-xl cursor-pointer transition-all ${
        isSelected
          ? 'ring-2 ring-indigo-500'
          : 'hover:bg-white/5'
      } ${isActive ? 'border-l-4 border-l-blue-500' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-medium text-white">{cycle.name}</h3>
          {cycle.description && (
            <p className="text-sm text-white/60 mt-1 line-clamp-2">{cycle.description}</p>
          )}
        </div>
        <span className={`text-xs px-2 py-1 rounded ${statusColors[cycle.status]}`}>
          {cycle.status}
        </span>
      </div>

      {/* Progress section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-white/60">
              <CheckCircle2 className="w-4 h-4" />
              <span>{cycle.completed_tasks}/{cycle.total_tasks}</span>
            </div>
            <div className="text-white/40">
              {cycle.completed_points}/{cycle.total_points} pts
            </div>
          </div>
          <span className="text-white font-medium">{cycle.progress}%</span>
        </div>

        {/* Task progress */}
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
            style={{ width: `${cycle.progress}%` }}
          />
        </div>

        {/* Time progress (for active cycles) */}
        {isInProgress && (
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                timeProgress > cycle.progress ? 'bg-orange-500/60' : 'bg-green-500/40'
              }`}
              style={{ width: `${timeProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Clock className="w-4 h-4" />
          <span>{format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}</span>
        </div>

        {isInProgress && daysRemaining >= 0 && (
          <span className="text-sm text-white/60">{daysRemaining} days remaining</span>
        )}
        {isOverdue && (
          <span className="text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {Math.abs(daysRemaining)} days overdue
          </span>
        )}
        {isUpcoming && (
          <span className="text-sm text-yellow-400">
            Starts in {differenceInDays(startDate, now)} days
          </span>
        )}
      </div>
    </div>
  );
}

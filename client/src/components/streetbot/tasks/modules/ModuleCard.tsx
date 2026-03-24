'use client';

import { format } from 'date-fns';
import { Layers, User, Calendar, Archive } from 'lucide-react';
import type { Module } from '@/lib/api/modules';

interface ModuleCardProps {
  module: Module;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

export default function ModuleCard({
  module,
  isSelected = false,
  onClick,
  compact = false,
}: ModuleCardProps) {
  const statusColors: Record<string, string> = {
    backlog: 'bg-gray-500/20 text-gray-400',
    in_progress: 'bg-blue-500/20 text-blue-400',
    paused: 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
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
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: module.color }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white truncate">{module.name}</span>
            {module.is_archived && (
              <Archive className="w-3 h-3 text-white/40 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${module.progress}%`,
                  backgroundColor: module.color,
                }}
              />
            </div>
            <span className="text-xs text-white/40">{module.progress}%</span>
          </div>
        </div>
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
        '--tw-ring-color': module.color,
        borderLeft: `3px solid ${module.color}`,
      } as React.CSSProperties}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${module.color}20` }}
          >
            {module.icon ? (
              <span className="text-lg">{module.icon}</span>
            ) : (
              <Layers className="w-5 h-5" style={{ color: module.color }} />
            )}
          </div>
          <div>
            <h3 className="text-base font-medium text-white">{module.name}</h3>
            {module.description && (
              <p className="text-sm text-white/50 line-clamp-1 mt-0.5">
                {module.description}
              </p>
            )}
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded ${statusColors[module.status]}`}>
          {module.status.replace('_', ' ')}
        </span>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">
            {module.completed_tasks}/{module.total_tasks} tasks
          </span>
          <span className="text-white font-medium">{module.progress}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${module.progress}%`,
              backgroundColor: module.color,
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
        <div className="flex items-center gap-3 text-xs text-white/40">
          {module.target_date && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{format(new Date(module.target_date), 'MMM d')}</span>
            </div>
          )}
          {module.lead_id && (
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>Lead assigned</span>
            </div>
          )}
        </div>
        {module.labels.length > 0 && (
          <div className="flex items-center gap-1">
            {module.labels.slice(0, 2).map((label, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 text-xs bg-white/10 rounded text-white/60"
              >
                {label}
              </span>
            ))}
            {module.labels.length > 2 && (
              <span className="text-xs text-white/40">+{module.labels.length - 2}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

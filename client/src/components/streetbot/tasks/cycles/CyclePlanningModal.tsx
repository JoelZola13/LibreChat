'use client';

import { useState } from 'react';
import { X, Calendar, AlertCircle } from 'lucide-react';
import { format, addDays, addWeeks } from 'date-fns';
import type { CycleCreate } from '@/lib/api/cycles';

interface CyclePlanningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CycleCreate) => Promise<void>;
  existingCycle?: {
    id: string;
    name: string;
    description?: string;
    start_date: string;
    end_date: string;
    status: string;
  };
}

export default function CyclePlanningModal({
  isOpen,
  onClose,
  onSubmit,
  existingCycle,
}: CyclePlanningModalProps) {
  const isEditing = !!existingCycle;
  const today = new Date();
  const defaultStart = existingCycle
    ? existingCycle.start_date
    : format(addDays(today, 1), 'yyyy-MM-dd');
  const defaultEnd = existingCycle
    ? existingCycle.end_date
    : format(addWeeks(addDays(today, 1), 2), 'yyyy-MM-dd');

  const [name, setName] = useState(existingCycle?.name || '');
  const [description, setDescription] = useState(existingCycle?.description || '');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [status, setStatus] = useState(existingCycle?.status || 'planned');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick duration presets
  const presets = [
    { label: '1 week', days: 7 },
    { label: '2 weeks', days: 14 },
    { label: '3 weeks', days: 21 },
    { label: '4 weeks', days: 28 },
  ];

  const applyPreset = (days: number) => {
    const start = new Date(startDate);
    setEndDate(format(addDays(start, days - 1), 'yyyy-MM-dd'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Cycle name is required');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      setError('End date must be after start date');
      return;
    }

    try {
      setLoading(true);
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        start_date: startDate,
        end_date: endDate,
        status,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save cycle');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass-card w-full max-w-lg mx-4 p-6 rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            {isEditing ? 'Edit Cycle' : 'Create New Cycle'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Cycle Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sprint 1, Q1 Week 3, etc."
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg
                       text-white placeholder-white/40 focus:outline-none focus:ring-2
                       focus:ring-indigo-500/50 focus:border-indigo-500/50"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Goals for this cycle..."
              rows={2}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg
                       text-white placeholder-white/40 focus:outline-none focus:ring-2
                       focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Start Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg
                           text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                           focus:border-indigo-500/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                End Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg
                           text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                           focus:border-indigo-500/50"
                />
              </div>
            </div>
          </div>

          {/* Duration presets */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50">Duration:</span>
            {presets.map((preset) => (
              <button
                key={preset.days}
                type="button"
                onClick={() => applyPreset(preset.days)}
                className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded
                         text-white/60 hover:text-white transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Status (for editing) */}
          {isEditing && (
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg
                         text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                         focus:border-indigo-500/50"
              >
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-white/60 hover:text-white
                       hover:bg-white/10 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500
                       text-white rounded-lg transition-colors disabled:opacity-50
                       disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {isEditing ? 'Save Changes' : 'Create Cycle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

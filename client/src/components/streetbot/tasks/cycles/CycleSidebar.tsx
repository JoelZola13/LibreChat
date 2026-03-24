'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Plus, Calendar, Target, RotateCcw } from 'lucide-react';
import type { Cycle } from '@/lib/api/cycles';
import { getCycles, getActiveCycle } from '@/lib/api/cycles';
import CycleCard from './CycleCard';

interface CycleSidebarProps {
  projectId: string;
  userId: string;
  selectedCycleId?: string;
  onSelectCycle: (cycle: Cycle | null) => void;
  onCreateCycle: () => void;
}

export default function CycleSidebar({
  projectId,
  userId,
  selectedCycleId,
  onSelectCycle,
  onCreateCycle,
}: CycleSidebarProps) {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    loadCycles();
  }, [projectId, showArchived]);

  const loadCycles = async () => {
    try {
      setLoading(true);
      const [allCycles, active] = await Promise.all([
        getCycles(projectId, { includeArchived: showArchived }),
        getActiveCycle(projectId),
      ]);
      setCycles(allCycles);
      setActiveCycle(active);
    } catch (error) {
      console.error('Failed to load cycles:', error);
    } finally {
      setLoading(false);
    }
  };

  const plannedCycles = cycles.filter(c => c.status === 'planned' && !c.is_archived);
  const completedCycles = cycles.filter(c => c.status === 'completed');
  const archivedCycles = cycles.filter(c => c.is_archived);

  return (
    <div className="glass-card p-3 rounded-xl">
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer mb-2"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-white/60" />
          ) : (
            <ChevronRight className="w-4 h-4 text-white/60" />
          )}
          <RotateCcw className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-white">Cycles</span>
          <span className="text-xs text-white/40 bg-white/10 px-1.5 py-0.5 rounded">
            {cycles.filter(c => !c.is_archived).length}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCreateCycle();
          }}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <Plus className="w-4 h-4 text-white/60" />
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 mt-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Active Cycle */}
              {activeCycle && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-white/50 px-2">
                    <Target className="w-3 h-3" />
                    <span>Active Sprint</span>
                  </div>
                  <CycleCard
                    cycle={activeCycle}
                    isSelected={selectedCycleId === activeCycle.id}
                    isActive
                    onClick={() => onSelectCycle(activeCycle)}
                  />
                </div>
              )}

              {/* Planned Cycles */}
              {plannedCycles.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-white/50 px-2">
                    <Calendar className="w-3 h-3" />
                    <span>Planned</span>
                  </div>
                  {plannedCycles.map(cycle => (
                    <CycleCard
                      key={cycle.id}
                      cycle={cycle}
                      isSelected={selectedCycleId === cycle.id}
                      onClick={() => onSelectCycle(cycle)}
                    />
                  ))}
                </div>
              )}

              {/* Completed Cycles */}
              {completedCycles.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-white/50 px-2">
                    <span>Completed ({completedCycles.length})</span>
                  </div>
                  {completedCycles.slice(0, 3).map(cycle => (
                    <CycleCard
                      key={cycle.id}
                      cycle={cycle}
                      isSelected={selectedCycleId === cycle.id}
                      onClick={() => onSelectCycle(cycle)}
                    />
                  ))}
                </div>
              )}

              {/* Show All / Backlog button */}
              <button
                onClick={() => onSelectCycle(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  !selectedCycleId
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:bg-white/5'
                }`}
              >
                All Tasks (Backlog)
              </button>

              {/* Toggle archived */}
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="w-full text-left px-3 py-1 text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                {showArchived ? 'Hide' : 'Show'} archived ({archivedCycles.length})
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

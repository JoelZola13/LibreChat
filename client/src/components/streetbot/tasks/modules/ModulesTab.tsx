'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Layers, Grid, List } from 'lucide-react';
import type { Module } from '@/lib/api/modules';
import { getModules } from '@/lib/api/modules';
import ModuleCard from './ModuleCard';

interface ModulesTabProps {
  projectId: string;
  userId: string;
  onSelectModule: (module: Module | null) => void;
  onCreateModule: () => void;
}

export default function ModulesTab({
  projectId,
  userId,
  onSelectModule,
  onCreateModule,
}: ModulesTabProps) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    loadModules();
  }, [projectId, showArchived]);

  const loadModules = async () => {
    try {
      setLoading(true);
      const data = await getModules(projectId, { includeArchived: showArchived });
      setModules(data);
    } catch (error) {
      console.error('Failed to load modules:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter modules
  const filteredModules = modules.filter((module) => {
    if (searchQuery && !module.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (statusFilter !== 'all' && module.status !== statusFilter) {
      return false;
    }
    return true;
  });

  // Group by status for list view
  const groupedModules = {
    backlog: filteredModules.filter((m) => m.status === 'backlog'),
    in_progress: filteredModules.filter((m) => m.status === 'in_progress'),
    paused: filteredModules.filter((m) => m.status === 'paused'),
    completed: filteredModules.filter((m) => m.status === 'completed'),
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-medium text-white">Modules</h2>
          <span className="text-sm text-white/40">({filteredModules.length})</span>
        </div>

        <button
          onClick={onCreateModule}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500
                   text-white text-sm rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Module</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search modules..."
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg
                     text-white placeholder-white/40 text-sm focus:outline-none
                     focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                   text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        >
          <option value="all">All Status</option>
          <option value="backlog">Backlog</option>
          <option value="in_progress">In Progress</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
        </select>

        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded ${
              viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/40'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded ${
              viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/40'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-white/60">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/5"
          />
          Show archived
        </label>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="glass-card p-12 rounded-xl text-center">
          <Layers className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No modules found</h3>
          <p className="text-sm text-white/60 mb-6">
            {searchQuery
              ? 'Try adjusting your search or filters'
              : 'Create your first module to organize related tasks'}
          </p>
          <button
            onClick={onCreateModule}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white
                     text-sm rounded-lg transition-colors"
          >
            Create Module
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModules.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              onClick={() => onSelectModule(module)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedModules).map(([status, mods]) =>
            mods.length > 0 ? (
              <div key={status}>
                <h3 className="text-sm font-medium text-white/60 mb-3 capitalize">
                  {status.replace('_', ' ')} ({mods.length})
                </h3>
                <div className="space-y-2">
                  {mods.map((module) => (
                    <ModuleCard
                      key={module.id}
                      module={module}
                      compact
                      onClick={() => onSelectModule(module)}
                    />
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

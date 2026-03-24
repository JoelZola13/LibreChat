import React from 'react';
import {
  ListTodo, LayoutGrid, CalendarDays, Search, Plus, Filter, X,
} from 'lucide-react';
import { DEFAULT_COLORS } from '../tasks/constants';
import type { ViewMode, FilterState } from './types';

const C = DEFAULT_COLORS;

interface Props {
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  onCreateTask: () => void;
  taskCount: number;
  listName?: string;
}

export default function ClickUpToolbar({
  viewMode, onViewChange, filters, onFiltersChange, onCreateTask, taskCount, listName,
}: Props) {
  const activeFilters = filters.statuses.length + filters.priorities.length +
    filters.assignees.length + filters.labels.length + (filters.search ? 1 : 0);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: '0.75rem', fontWeight: 600,
    background: active ? C.surface : 'transparent',
    color: active ? C.text : C.textMuted,
    transition: 'all 0.12s',
  });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 16px',
      borderBottom: `1px solid ${C.border}`,
      background: C.headerBg,
      flexWrap: 'wrap',
    }}>
      {/* Current context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text }}>
          {listName || 'All Tasks'}
        </span>
        <span style={{
          fontSize: '0.65rem', fontWeight: 500, padding: '2px 8px', borderRadius: 10,
          background: C.surface, color: C.textMuted,
        }}>
          {taskCount}
        </span>
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: C.border, margin: '0 4px' }} />

      {/* View tabs */}
      <div style={{
        display: 'flex', gap: 2, padding: 2, borderRadius: 8,
        background: 'rgba(255,255,255,0.03)',
      }}>
        <button onClick={() => onViewChange('list')} style={tabStyle(viewMode === 'list')}>
          <ListTodo size={14} /> List
        </button>
        <button onClick={() => onViewChange('board')} style={tabStyle(viewMode === 'board')}>
          <LayoutGrid size={14} /> Board
        </button>
        <button onClick={() => onViewChange('calendar')} style={tabStyle(viewMode === 'calendar')}>
          <CalendarDays size={14} /> Calendar
        </button>
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: C.border, margin: '0 4px' }} />

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 10px', borderRadius: 6,
        background: C.surface, border: `1px solid ${C.border}`,
        flex: '0 1 200px', minWidth: 120,
      }}>
        <Search size={13} color={C.textMuted} />
        <input
          type="text"
          placeholder="Search tasks..."
          value={filters.search}
          onChange={e => onFiltersChange({ ...filters, search: e.target.value })}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: C.text, fontSize: '0.75rem', width: '100%',
          }}
        />
        {filters.search && (
          <button
            onClick={() => onFiltersChange({ ...filters, search: '' })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
          >
            <X size={12} color={C.textMuted} />
          </button>
        )}
      </div>

      {/* Clear filters */}
      {activeFilters > 0 && (
        <button
          onClick={() => onFiltersChange({ statuses: [], priorities: [], assignees: [], labels: [], search: '' })}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`,
            background: 'transparent', color: C.textMuted, cursor: 'pointer',
            fontSize: '0.7rem', fontWeight: 500,
          }}
        >
          <Filter size={12} />
          {activeFilters} filter{activeFilters > 1 ? 's' : ''}
          <X size={11} />
        </button>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* + Task button */}
      <button
        onClick={onCreateTask}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: C.accent, color: '#000', fontWeight: 700, fontSize: '0.8rem',
          transition: 'opacity 0.12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
      >
        <Plus size={15} strokeWidth={3} />
        Task
      </button>
    </div>
  );
}

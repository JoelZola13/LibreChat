import { useState, useEffect, useCallback, useMemo } from 'react';
import { paperclipFetch, relayFetch } from './config';
import { useMissionControlData } from './useMissionControlData';
import {
  buildHierarchy, buildAgentMap, filterIssues, groupByStatus,
  issuesToTasks, paperclipLabelsToLabels,
} from './paperclipAdapter';
import type {
  PaperclipLabel, PaperclipGoal, FilterState, ViewMode,
  ClickUpSpace, DispatchRequest, DispatchResponse,
} from './types';
import type { Task, Label } from '@/lib/api/tasks';
import type { UserInfo } from '../tasks/constants';

interface ClickUpData {
  // Raw Paperclip data (from useMissionControlData)
  raw: ReturnType<typeof useMissionControlData>;

  // Derived
  hierarchy: ClickUpSpace | null;
  filteredTasks: Task[];
  tasksByStatus: Record<string, Task[]>;
  agentMap: Record<string, UserInfo>;
  labels: Label[];

  // State
  selectedListId: string | null;
  setSelectedListId: (id: string | null) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  filters: FilterState;
  setFilters: (f: FilterState | ((prev: FilterState) => FilterState)) => void;
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  showCreateModal: boolean;
  setShowCreateModal: (v: boolean) => void;

  // Actions
  createTask: (payload: { title: string; description?: string; priority?: string; agentName?: string }) => Promise<void>;
  refresh: () => void;
  loading: boolean;
}

const EMPTY_FILTERS: FilterState = { statuses: [], priorities: [], assignees: [], labels: [], search: '' };

export function useClickUpData(): ClickUpData {
  const raw = useMissionControlData();

  // Extra data not in useMissionControlData
  const [paperclipLabels, setPaperclipLabels] = useState<PaperclipLabel[]>([]);

  // UI state
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch labels on mount
  useEffect(() => {
    paperclipFetch<PaperclipLabel[]>('/labels')
      .then(setPaperclipLabels)
      .catch(() => {});
  }, []);

  // Derived: hierarchy
  const hierarchy = useMemo(() => {
    if (!raw.agents.data || !raw.issues.data) return null;
    return buildHierarchy(raw.agents.data, raw.issues.data);
  }, [raw.agents.data, raw.issues.data]);

  // Derived: agent map for UserInfo
  const agentMap = useMemo(() => {
    if (!raw.agents.data) return {};
    return buildAgentMap(raw.agents.data);
  }, [raw.agents.data]);

  // Derived: labels
  const labels = useMemo(() => paperclipLabelsToLabels(paperclipLabels), [paperclipLabels]);

  // Derived: filtered issues → tasks
  const filteredTasks = useMemo(() => {
    if (!raw.issues.data) return [];
    const filtered = filterIssues(raw.issues.data, {
      listId: selectedListId,
      statuses: filters.statuses,
      priorities: filters.priorities,
      assignees: filters.assignees,
      labels: filters.labels,
      search: filters.search,
    });
    return issuesToTasks(filtered);
  }, [raw.issues.data, selectedListId, filters]);

  // Derived: tasks grouped by status
  const tasksByStatus = useMemo(() => {
    if (!raw.issues.data) return { backlog: [], todo: [], in_progress: [], done: [] };
    const filtered = filterIssues(raw.issues.data, {
      listId: selectedListId,
      statuses: filters.statuses,
      priorities: filters.priorities,
      assignees: filters.assignees,
      labels: filters.labels,
      search: filters.search,
    });
    return groupByStatus(filtered, raw.issues.data);
  }, [raw.issues.data, selectedListId, filters]);

  // Create task action — always use direct Paperclip API with assigneeAgentId
  const createTask = useCallback(async (payload: {
    title: string;
    description?: string;
    priority?: string;
    agentName?: string;
    agentId?: string;
    parentId?: string;
  }) => {
    // Resolve agentId from agentName if needed
    let assigneeAgentId = payload.agentId || undefined;
    if (!assigneeAgentId && payload.agentName && raw.agents.data) {
      const agent = raw.agents.data.find(a => a.name === payload.agentName);
      if (agent) assigneeAgentId = agent.id;
    }

    const body: Record<string, unknown> = {
      title: payload.title,
      description: payload.description || '',
      priority: payload.priority || 'medium',
      status: 'todo',
    };
    if (assigneeAgentId) body.assigneeAgentId = assigneeAgentId;
    if (payload.parentId) body.parentId = payload.parentId;

    await paperclipFetch('/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Refresh data after creation
    raw.refresh();
  }, [raw]);

  const loading = raw.agents.loading || raw.issues.loading;

  return {
    raw,
    hierarchy,
    filteredTasks,
    tasksByStatus,
    agentMap,
    labels,
    selectedListId, setSelectedListId,
    viewMode, setViewMode,
    filters, setFilters,
    selectedTaskId, setSelectedTaskId,
    showCreateModal, setShowCreateModal,
    createTask,
    refresh: raw.refresh,
    loading,
  };
}

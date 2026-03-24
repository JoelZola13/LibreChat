"use client";

import { useState, useMemo, useCallback } from "react";
import type { Task, Project, Status, Label } from "@/lib/api/tasks";
import type { SavedFilter, Milestone } from "@/lib/api/tasks-advanced";

// Filter criteria interface
export interface FilterCriteria {
  status?: string | string[];
  priority?: string | string[];
  assignee?: string | string[];
  labels?: string[];
  milestone?: string;
  dueDate?: "today" | "week" | "overdue" | "no_date" | string;
  search?: string;
}

// Sort options
export type SortField = "created" | "updated" | "due" | "priority" | "title" | "status";
export type SortDirection = "asc" | "desc";

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

// Priority sort order
const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

// Status sort order
const STATUS_ORDER: Record<string, number> = {
  todo: 0,
  in_progress: 1,
  review: 2,
  done: 3,
  cancelled: 4,
};

interface UseTaskFilteringConfig {
  tasks: Task[];
  selectedProject: Project | null;
  savedFilters?: SavedFilter[];
  milestones?: Milestone[];
}

/**
 * Hook for task filtering, searching, and sorting.
 * Memoizes filtered results for performance.
 */
export function useTaskFiltering(config: UseTaskFilteringConfig) {
  const { tasks, selectedProject, savedFilters = [], milestones = [] } = config;

  // Search query
  const [searchQuery, setSearchQuery] = useState("");

  // Filter state
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({});

  // Sort state
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "created",
    direction: "desc",
  });

  // Active saved filter
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);

  // Milestone filter
  const [selectedMilestoneFilter, setSelectedMilestoneFilter] = useState<string | null>(null);

  // Collapsed status groups
  const [collapsedStatuses, setCollapsedStatuses] = useState<Set<string>>(new Set());

  // Selected list filter
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  /**
   * Get project tasks (root level, excluding subtasks)
   */
  const projectTasks = useMemo(() => {
    return tasks.filter((t) => t.parentTaskId === null);
  }, [tasks]);

  /**
   * Get the active saved filter object
   */
  const activeFilter = useMemo(() => {
    if (!activeFilterId) return null;
    return savedFilters.find((f) => f.id === activeFilterId) || null;
  }, [activeFilterId, savedFilters]);

  /**
   * Apply filter criteria from a saved filter
   */
  const applyFilter = useCallback((filterId: string | null) => {
    setActiveFilterId(filterId);
    if (!filterId) {
      setFilterCriteria({});
      return;
    }

    const filter = savedFilters.find((f) => f.id === filterId);
    if (filter) {
      setFilterCriteria(filter.filters as FilterCriteria);
    }
  }, [savedFilters]);

  /**
   * Check if a task matches the current filter criteria
   */
  const matchesFilter = useCallback(
    (task: Task, criteria: FilterCriteria): boolean => {
      // Status filter
      if (criteria.status) {
        const statuses = Array.isArray(criteria.status)
          ? criteria.status
          : [criteria.status];
        if (!statuses.includes(task.status)) return false;
      }

      // Priority filter
      if (criteria.priority) {
        const priorities = Array.isArray(criteria.priority)
          ? criteria.priority
          : [criteria.priority];
        if (!priorities.includes(task.priority)) return false;
      }

      // Assignee filter
      if (criteria.assignee) {
        const assignees = Array.isArray(criteria.assignee)
          ? criteria.assignee
          : [criteria.assignee];
        const hasAssignee = task.assignees?.some((a) => assignees.includes(a));
        if (!hasAssignee) return false;
      }

      // Labels filter
      if (criteria.labels && criteria.labels.length > 0) {
        const hasLabel = task.labels?.some((l) => criteria.labels!.includes(l));
        if (!hasLabel) return false;
      }

      // Milestone filter
      if (criteria.milestone) {
        if (task.milestoneId !== criteria.milestone) return false;
      }

      // Due date filter
      if (criteria.dueDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const taskDue = task.dueAt ? new Date(task.dueAt) : null;

        switch (criteria.dueDate) {
          case "today":
            if (!taskDue) return false;
            const taskDueDay = new Date(taskDue);
            taskDueDay.setHours(0, 0, 0, 0);
            if (taskDueDay.getTime() !== today.getTime()) return false;
            break;
          case "week":
            if (!taskDue) return false;
            const weekFromNow = new Date(today);
            weekFromNow.setDate(weekFromNow.getDate() + 7);
            if (taskDue < today || taskDue > weekFromNow) return false;
            break;
          case "overdue":
            if (!taskDue) return false;
            if (taskDue >= today) return false;
            break;
          case "no_date":
            if (taskDue) return false;
            break;
          default:
            // Custom date string
            if (taskDue?.toISOString().split("T")[0] !== criteria.dueDate) return false;
        }
      }

      return true;
    },
    []
  );

  /**
   * Check if a task matches the search query
   */
  const matchesSearch = useCallback(
    (task: Task, query: string): boolean => {
      if (!query.trim()) return true;

      const searchLower = query.toLowerCase();

      // Search in title
      if (task.title.toLowerCase().includes(searchLower)) return true;

      // Search in description
      if (task.description?.toLowerCase().includes(searchLower)) return true;

      // Search in labels
      if (task.labels?.some((l) => l.toLowerCase().includes(searchLower))) return true;

      return false;
    },
    []
  );

  /**
   * Sort tasks according to current sort config
   */
  const sortTasks = useCallback(
    (tasksToSort: Task[]): Task[] => {
      return [...tasksToSort].sort((a, b) => {
        let comparison = 0;

        switch (sortConfig.field) {
          case "title":
            comparison = a.title.localeCompare(b.title);
            break;
          case "priority":
            comparison =
              (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4);
            break;
          case "status":
            comparison =
              (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0);
            break;
          case "due":
            if (!a.dueAt && !b.dueAt) comparison = 0;
            else if (!a.dueAt) comparison = 1;
            else if (!b.dueAt) comparison = -1;
            else comparison = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
            break;
          case "updated":
            comparison =
              new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
            break;
          case "created":
          default:
            comparison =
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
        }

        return sortConfig.direction === "asc" ? comparison : -comparison;
      });
    },
    [sortConfig]
  );

  /**
   * Get filtered and sorted tasks
   */
  const filteredTasks = useMemo(() => {
    let result = projectTasks;

    // Apply milestone filter
    if (selectedMilestoneFilter) {
      result = result.filter((t) => t.milestoneId === selectedMilestoneFilter);
    }

    // Apply saved filter criteria
    if (activeFilter) {
      result = result.filter((t) => matchesFilter(t, activeFilter.filters as FilterCriteria));
    }

    // Apply manual filter criteria
    if (Object.keys(filterCriteria).length > 0) {
      result = result.filter((t) => matchesFilter(t, filterCriteria));
    }

    // Apply search
    if (searchQuery.trim()) {
      result = result.filter((t) => matchesSearch(t, searchQuery));
    }

    // Apply list filter
    // Note: This would need list_id on tasks if implemented

    // Sort
    result = sortTasks(result);

    return result;
  }, [
    projectTasks,
    selectedMilestoneFilter,
    activeFilter,
    filterCriteria,
    searchQuery,
    matchesFilter,
    matchesSearch,
    sortTasks,
  ]);

  /**
   * Group tasks by status
   */
  const tasksByStatus = useMemo(() => {
    const groups: Record<string, Task[]> = {};

    filteredTasks.forEach((task) => {
      const status = task.status || "todo";
      if (!groups[status]) {
        groups[status] = [];
      }
      groups[status].push(task);
    });

    return groups;
  }, [filteredTasks]);

  /**
   * Get task counts by status
   */
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    projectTasks.forEach((task) => {
      const status = task.status || "todo";
      counts[status] = (counts[status] || 0) + 1;
    });

    return counts;
  }, [projectTasks]);

  /**
   * Toggle status group collapse
   */
  const toggleStatusCollapse = useCallback((statusId: string) => {
    setCollapsedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(statusId)) {
        next.delete(statusId);
      } else {
        next.add(statusId);
      }
      return next;
    });
  }, []);

  /**
   * Set sort configuration
   */
  const setSort = useCallback((field: SortField, direction?: SortDirection) => {
    setSortConfig((prev) => ({
      field,
      direction: direction ?? (prev.field === field && prev.direction === "asc" ? "desc" : "asc"),
    }));
  }, []);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setFilterCriteria({});
    setActiveFilterId(null);
    setSelectedMilestoneFilter(null);
  }, []);

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = useMemo(() => {
    return (
      searchQuery.trim() !== "" ||
      Object.keys(filterCriteria).length > 0 ||
      activeFilterId !== null ||
      selectedMilestoneFilter !== null
    );
  }, [searchQuery, filterCriteria, activeFilterId, selectedMilestoneFilter]);

  return {
    // Filtered results
    filteredTasks,
    tasksByStatus,
    statusCounts,
    projectTasks,

    // Search
    search: {
      query: searchQuery,
      setQuery: setSearchQuery,
    },

    // Filter criteria
    filter: {
      criteria: filterCriteria,
      setCriteria: setFilterCriteria,
      active: activeFilter,
      activeId: activeFilterId,
      apply: applyFilter,
      clear: clearFilters,
      hasActive: hasActiveFilters,
    },

    // Sort
    sort: {
      config: sortConfig,
      setSort,
    },

    // Milestone filter
    milestone: {
      selected: selectedMilestoneFilter,
      setSelected: setSelectedMilestoneFilter,
    },

    // Status groups
    statusGroups: {
      collapsed: collapsedStatuses,
      toggle: toggleStatusCollapse,
      isCollapsed: (statusId: string) => collapsedStatuses.has(statusId),
    },

    // List filter
    list: {
      selectedId: selectedListId,
      setSelectedId: setSelectedListId,
    },
  };
}

export type UseTaskFilteringReturn = ReturnType<typeof useTaskFiltering>;

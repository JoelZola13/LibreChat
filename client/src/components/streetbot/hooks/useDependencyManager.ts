"use client";

import { useState, useCallback, useEffect } from "react";
import type { Task, TaskDependency } from "@/lib/api/tasks";
import {
  addTaskDependency,
  removeTaskDependency,
  updateTaskDependency,
  isTaskBlocked,
  updateTask as apiUpdateTask,
} from "@/lib/api/tasks";

// Dependency action for undo/redo
export interface DependencyAction {
  type: "create" | "delete" | "update";
  taskId: string;
  dependsOnTaskId: string;
  dep: TaskDependency;
  previousLagDays?: number;
  newLagDays?: number;
  timestamp: number;
}

// Schedule action for undo/redo
export interface ScheduleAction {
  type: "auto-schedule";
  changes: Array<{
    taskId: string;
    previousStartAt: string | null;
    previousDueAt: string | null;
    newStartAt: string;
    newDueAt: string;
  }>;
  timestamp: number;
}

// Pending dependency for confirmation
export interface PendingDependency {
  sourceTaskId: string;
  targetTaskId: string;
  sourceTaskTitle: string;
  targetTaskTitle: string;
  dependencyType: "finish_to_start" | "start_to_start" | "finish_to_finish";
  x: number;
  y: number;
}

// Editing dependency state
export interface EditingDependency {
  taskId: string;
  dependsOnTaskId: string;
  dep: TaskDependency;
  x: number;
  y: number;
  fromTaskTitle: string;
  toTaskTitle: string;
}

interface UseDependencyManagerConfig {
  userId: string;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  filteredTasks: Task[];
  setError?: (error: string | null) => void;
  viewMode: string;
}

/**
 * Hook for managing task dependencies with undo/redo support.
 * Handles dependency creation, deletion, updates, and auto-scheduling.
 */
export function useDependencyManager(config: UseDependencyManagerConfig) {
  const { userId, tasks, setTasks, filteredTasks, setError, viewMode } = config;

  // Dependencies state
  const [taskDependencies, setTaskDependencies] = useState<Record<string, TaskDependency[]>>({});
  const [taskDependents, setTaskDependents] = useState<Record<string, TaskDependency[]>>({});
  const [blockedTasks, setBlockedTasks] = useState<Set<string>>(new Set());

  // Pending dependency for confirmation
  const [pendingDependency, setPendingDependency] = useState<PendingDependency | null>(null);
  const [pendingLagDays, setPendingLagDays] = useState<number>(0);

  // Editing dependency
  const [editingDependency, setEditingDependency] = useState<EditingDependency | null>(null);
  const [editingLagDays, setEditingLagDays] = useState<number>(0);

  // Undo/redo stacks
  const [dependencyUndoStack, setDependencyUndoStack] = useState<DependencyAction[]>([]);
  const [dependencyRedoStack, setDependencyRedoStack] = useState<DependencyAction[]>([]);
  const [scheduleUndoStack, setScheduleUndoStack] = useState<ScheduleAction[]>([]);
  const [scheduleRedoStack, setScheduleRedoStack] = useState<ScheduleAction[]>([]);

  // Toast state
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [lastActionType, setLastActionType] = useState<"undo" | "redo" | "action" | "schedule">("action");

  // Auto-schedule state
  const [isAutoScheduling, setIsAutoScheduling] = useState(false);

  // Loading state
  const [loadingDependencies, setLoadingDependencies] = useState(false);

  /**
   * Check which tasks are blocked by incomplete dependencies
   */
  const checkBlockedTasks = useCallback(async () => {
    const blocked = new Set<string>();

    for (const task of tasks) {
      try {
        const result = await isTaskBlocked(task.id);
        if (result.isBlocked) {
          blocked.add(task.id);
        }
      } catch {
        // Ignore errors for individual tasks
      }
    }

    setBlockedTasks(blocked);
  }, [tasks]);

  /**
   * Add a new dependency
   */
  const handleAddDependency = useCallback(
    async (taskId: string, dependsOnTaskId: string, dependencyType: string, lagDays: number = 0) => {
      try {
        const newDep = await addTaskDependency(taskId, dependsOnTaskId, userId, dependencyType, lagDays);

        setTaskDependencies((prev) => ({
          ...prev,
          [taskId]: [...(prev[taskId] || []), newDep],
        }));

        // Add to undo stack
        setDependencyUndoStack((prev) => [
          ...prev,
          {
            type: "create",
            taskId,
            dependsOnTaskId,
            dep: newDep,
            timestamp: Date.now(),
          },
        ]);
        setDependencyRedoStack([]);
        setLastActionType("action");
        setShowUndoToast(true);
        setTimeout(() => setShowUndoToast(false), 5000);

        checkBlockedTasks();
        return newDep;
      } catch (err) {
        console.error("Failed to create dependency:", err);
        setError?.("Failed to create dependency. Check for circular dependencies.");
        throw err;
      }
    },
    [userId, checkBlockedTasks, setError]
  );

  /**
   * Confirm pending dependency creation
   */
  const handleConfirmDependency = useCallback(async () => {
    if (!pendingDependency) return;

    const { sourceTaskId, targetTaskId, dependencyType } = pendingDependency;

    try {
      await handleAddDependency(targetTaskId, sourceTaskId, dependencyType, pendingLagDays);
    } catch {
      // Error already handled
    }

    setPendingDependency(null);
  }, [pendingDependency, pendingLagDays, handleAddDependency]);

  /**
   * Remove a dependency
   */
  const handleRemoveDependency = useCallback(
    async (taskId: string, dependsOnTaskId: string) => {
      const deps = taskDependencies[taskId] || [];
      const dep = deps.find((d) => d.dependsOnTaskId === dependsOnTaskId);
      if (!dep) return;

      try {
        await removeTaskDependency(taskId, dependsOnTaskId, userId);

        setTaskDependencies((prev) => ({
          ...prev,
          [taskId]: (prev[taskId] || []).filter((d) => d.dependsOnTaskId !== dependsOnTaskId),
        }));

        // Add to undo stack
        setDependencyUndoStack((prev) => [
          ...prev,
          {
            type: "delete",
            taskId,
            dependsOnTaskId,
            dep,
            timestamp: Date.now(),
          },
        ]);
        setDependencyRedoStack([]);
        setLastActionType("action");
        setShowUndoToast(true);
        setTimeout(() => setShowUndoToast(false), 5000);

        checkBlockedTasks();
      } catch (err) {
        console.error("Failed to remove dependency:", err);
        setError?.("Failed to remove dependency.");
      }
    },
    [taskDependencies, userId, checkBlockedTasks, setError]
  );

  /**
   * Update dependency lag days
   */
  const handleUpdateLagDays = useCallback(
    async (taskId: string, dependsOnTaskId: string, newLagDays: number) => {
      const deps = taskDependencies[taskId] || [];
      const dep = deps.find((d) => d.dependsOnTaskId === dependsOnTaskId);
      if (!dep) return;

      const previousLagDays = dep.lagDays;

      try {
        await updateTaskDependency(taskId, dependsOnTaskId, userId, { lagDays: newLagDays });

        setTaskDependencies((prev) => ({
          ...prev,
          [taskId]: (prev[taskId] || []).map((d) =>
            d.dependsOnTaskId === dependsOnTaskId ? { ...d, lagDays: newLagDays } : d
          ),
        }));

        // Add to undo stack
        setDependencyUndoStack((prev) => [
          ...prev,
          {
            type: "update",
            taskId,
            dependsOnTaskId,
            dep: { ...dep, lagDays: newLagDays },
            previousLagDays,
            newLagDays,
            timestamp: Date.now(),
          },
        ]);
        setDependencyRedoStack([]);
        setLastActionType("action");
        setShowUndoToast(true);
        setTimeout(() => setShowUndoToast(false), 5000);
      } catch (err) {
        console.error("Failed to update dependency:", err);
        setError?.("Failed to update dependency.");
      }
    },
    [taskDependencies, userId, setError]
  );

  /**
   * Undo last dependency action
   */
  const handleUndoDependency = useCallback(async () => {
    if (dependencyUndoStack.length === 0) return;

    const lastAction = dependencyUndoStack[dependencyUndoStack.length - 1];
    setDependencyUndoStack((prev) => prev.slice(0, -1));

    try {
      switch (lastAction.type) {
        case "create":
          await removeTaskDependency(lastAction.taskId, lastAction.dependsOnTaskId, userId);
          setTaskDependencies((prev) => ({
            ...prev,
            [lastAction.taskId]: (prev[lastAction.taskId] || []).filter(
              (d) => d.dependsOnTaskId !== lastAction.dependsOnTaskId
            ),
          }));
          break;

        case "delete":
          const restoredDep = await addTaskDependency(
            lastAction.taskId,
            lastAction.dependsOnTaskId,
            userId,
            lastAction.dep.dependencyType,
            lastAction.dep.lagDays
          );
          setTaskDependencies((prev) => ({
            ...prev,
            [lastAction.taskId]: [...(prev[lastAction.taskId] || []), restoredDep],
          }));
          break;

        case "update":
          if (lastAction.previousLagDays !== undefined) {
            await updateTaskDependency(lastAction.taskId, lastAction.dependsOnTaskId, userId, {
              lagDays: lastAction.previousLagDays,
            });
            setTaskDependencies((prev) => ({
              ...prev,
              [lastAction.taskId]: (prev[lastAction.taskId] || []).map((d) =>
                d.dependsOnTaskId === lastAction.dependsOnTaskId
                  ? { ...d, lagDays: lastAction.previousLagDays! }
                  : d
              ),
            }));
          }
          break;
      }

      setDependencyRedoStack((prev) => [...prev, lastAction]);
      setLastActionType("undo");
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 5000);
      checkBlockedTasks();
    } catch (err) {
      console.error("Failed to undo:", err);
      setError?.("Failed to undo. Please try again.");
    }
  }, [dependencyUndoStack, userId, checkBlockedTasks, setError]);

  /**
   * Redo last undone dependency action
   */
  const handleRedoDependency = useCallback(async () => {
    if (dependencyRedoStack.length === 0) return;

    const lastAction = dependencyRedoStack[dependencyRedoStack.length - 1];
    setDependencyRedoStack((prev) => prev.slice(0, -1));

    try {
      switch (lastAction.type) {
        case "create":
          const newDep = await addTaskDependency(
            lastAction.taskId,
            lastAction.dependsOnTaskId,
            userId,
            lastAction.dep.dependencyType,
            lastAction.dep.lagDays
          );
          setTaskDependencies((prev) => ({
            ...prev,
            [lastAction.taskId]: [...(prev[lastAction.taskId] || []), newDep],
          }));
          break;

        case "delete":
          await removeTaskDependency(lastAction.taskId, lastAction.dependsOnTaskId, userId);
          setTaskDependencies((prev) => ({
            ...prev,
            [lastAction.taskId]: (prev[lastAction.taskId] || []).filter(
              (d) => d.dependsOnTaskId !== lastAction.dependsOnTaskId
            ),
          }));
          break;

        case "update":
          if (lastAction.newLagDays !== undefined) {
            await updateTaskDependency(lastAction.taskId, lastAction.dependsOnTaskId, userId, {
              lagDays: lastAction.newLagDays,
            });
            setTaskDependencies((prev) => ({
              ...prev,
              [lastAction.taskId]: (prev[lastAction.taskId] || []).map((d) =>
                d.dependsOnTaskId === lastAction.dependsOnTaskId
                  ? { ...d, lagDays: lastAction.newLagDays! }
                  : d
              ),
            }));
          }
          break;
      }

      setDependencyUndoStack((prev) => [...prev, lastAction]);
      setLastActionType("redo");
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 5000);
      checkBlockedTasks();
    } catch (err) {
      console.error("Failed to redo:", err);
      setError?.("Failed to redo. Please try again.");
    }
  }, [dependencyRedoStack, userId, checkBlockedTasks, setError]);

  // Schedule undo/redo (simplified implementations)
  const handleUndoSchedule = useCallback(async () => {
    if (scheduleUndoStack.length === 0) return;

    const lastAction = scheduleUndoStack[scheduleUndoStack.length - 1];
    setScheduleUndoStack((prev) => prev.slice(0, -1));

    try {
      for (const change of lastAction.changes) {
        await apiUpdateTask(change.taskId, userId, {
          start_at: change.previousStartAt ?? undefined,
          due_at: change.previousDueAt ?? undefined,
        });
        setTasks((prev) =>
          prev.map((t) =>
            t.id === change.taskId
              ? { ...t, startAt: change.previousStartAt ?? undefined, dueAt: change.previousDueAt ?? undefined }
              : t
          )
        );
      }

      setScheduleRedoStack((prev) => [...prev, lastAction]);
      setLastActionType("undo");
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 5000);
    } catch (err) {
      console.error("Failed to undo schedule:", err);
    }
  }, [scheduleUndoStack, userId, setTasks]);

  const handleRedoSchedule = useCallback(async () => {
    if (scheduleRedoStack.length === 0) return;

    const lastAction = scheduleRedoStack[scheduleRedoStack.length - 1];
    setScheduleRedoStack((prev) => prev.slice(0, -1));

    try {
      for (const change of lastAction.changes) {
        await apiUpdateTask(change.taskId, userId, {
          start_at: change.newStartAt,
          due_at: change.newDueAt,
        });
        setTasks((prev) =>
          prev.map((t) =>
            t.id === change.taskId ? { ...t, startAt: change.newStartAt, dueAt: change.newDueAt } : t
          )
        );
      }

      setScheduleUndoStack((prev) => [...prev, lastAction]);
      setLastActionType("redo");
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 5000);
    } catch (err) {
      console.error("Failed to redo schedule:", err);
    }
  }, [scheduleRedoStack, userId, setTasks]);

  /**
   * Combined undo handler
   */
  const handleUndo = useCallback(() => {
    const depTimestamp =
      dependencyUndoStack.length > 0
        ? dependencyUndoStack[dependencyUndoStack.length - 1].timestamp
        : 0;
    const schedTimestamp =
      scheduleUndoStack.length > 0 ? scheduleUndoStack[scheduleUndoStack.length - 1].timestamp : 0;

    if (schedTimestamp > depTimestamp && scheduleUndoStack.length > 0) {
      // Handle schedule undo (simplified)
      handleUndoSchedule();
    } else if (depTimestamp > 0) {
      handleUndoDependency();
    }
  }, [dependencyUndoStack, scheduleUndoStack, handleUndoDependency, handleUndoSchedule]);

  /**
   * Combined redo handler
   */
  const handleRedo = useCallback(() => {
    const depTimestamp =
      dependencyRedoStack.length > 0
        ? dependencyRedoStack[dependencyRedoStack.length - 1].timestamp
        : 0;
    const schedTimestamp =
      scheduleRedoStack.length > 0 ? scheduleRedoStack[scheduleRedoStack.length - 1].timestamp : 0;

    if (schedTimestamp > depTimestamp && scheduleRedoStack.length > 0) {
      handleRedoSchedule();
    } else if (depTimestamp > 0) {
      handleRedoDependency();
    }
  }, [dependencyRedoStack, scheduleRedoStack, handleRedoDependency, handleRedoSchedule]);

  // Keyboard shortcuts for undo/redo in Gantt view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && viewMode === "gantt") {
        const hasUndo = dependencyUndoStack.length > 0 || scheduleUndoStack.length > 0;
        const hasRedo = dependencyRedoStack.length > 0 || scheduleRedoStack.length > 0;

        if (e.shiftKey && hasRedo) {
          e.preventDefault();
          handleRedo();
        } else if (!e.shiftKey && hasUndo) {
          e.preventDefault();
          handleUndo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y" && viewMode === "gantt") {
        const hasRedo = dependencyRedoStack.length > 0 || scheduleRedoStack.length > 0;
        if (hasRedo) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, dependencyUndoStack, dependencyRedoStack, scheduleUndoStack, scheduleRedoStack, handleUndo, handleRedo]);

  /**
   * Check if a task is blocked
   */
  const isBlocked = useCallback(
    (taskId: string) => {
      return blockedTasks.has(taskId);
    },
    [blockedTasks]
  );

  return {
    // Dependencies state
    dependencies: taskDependencies,
    setDependencies: setTaskDependencies,
    dependents: taskDependents,
    setDependents: setTaskDependents,
    blocked: blockedTasks,
    isBlocked,
    loading: loadingDependencies,
    setLoading: setLoadingDependencies,

    // Pending dependency
    pending: {
      dependency: pendingDependency,
      lagDays: pendingLagDays,
      setDependency: setPendingDependency,
      setLagDays: setPendingLagDays,
      confirm: handleConfirmDependency,
      cancel: () => setPendingDependency(null),
    },

    // Editing dependency
    editing: {
      dependency: editingDependency,
      lagDays: editingLagDays,
      setDependency: setEditingDependency,
      setLagDays: setEditingLagDays,
    },

    // Actions
    add: handleAddDependency,
    remove: handleRemoveDependency,
    updateLag: handleUpdateLagDays,
    checkBlocked: checkBlockedTasks,

    // Undo/redo
    undo: handleUndo,
    redo: handleRedo,
    undoDependency: handleUndoDependency,
    redoDependency: handleRedoDependency,
    canUndo: dependencyUndoStack.length > 0 || scheduleUndoStack.length > 0,
    canRedo: dependencyRedoStack.length > 0 || scheduleRedoStack.length > 0,

    // Toast
    toast: {
      show: showUndoToast,
      setShow: setShowUndoToast,
      lastAction: lastActionType,
    },

    // Auto-schedule
    autoSchedule: {
      isRunning: isAutoScheduling,
      setIsRunning: setIsAutoScheduling,
    },

    // Schedule undo stack (for auto-schedule)
    schedule: {
      undoStack: scheduleUndoStack,
      redoStack: scheduleRedoStack,
      pushUndo: (action: ScheduleAction) => setScheduleUndoStack((prev) => [...prev, action]),
      clearRedo: () => setScheduleRedoStack([]),
    },
  };
}

export type UseDependencyManagerReturn = ReturnType<typeof useDependencyManager>;

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Task } from "@/lib/api/tasks";
import { updateTask as apiUpdateTask } from "@/lib/api/tasks";

// Gantt drag state for task rescheduling
export interface GanttDragState {
  taskId: string;
  originalStartDate: Date | null;
  originalEndDate: Date | null;
  dragStartX: number;
  currentOffsetDays: number;
  mode: "move" | "resize-start" | "resize-end";
}

// Dependency drag state
export interface DependencyDragState {
  sourceTaskId: string;
  sourceTaskTitle: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  targetTaskId: string | null;
  dependencyType: "finish_to_start" | "start_to_start" | "finish_to_finish";
}

// Gantt quick add state
export interface GanttQuickAddState {
  show: boolean;
  date: Date;
  x: number;
  y: number;
}

// List view drag state
export interface ListDragState {
  taskId: string;
  sourceStatus: string;
  sourceIndex: number;
  overStatus: string | null;
  overIndex: number | null;
  overPosition: "before" | "after" | null;
}

interface UseGanttDragDropConfig {
  userId: string;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  lockedTaskIds: Set<string>;
  setError?: (error: string | null) => void;
}

/**
 * Hook for managing Gantt chart and list view drag-and-drop operations.
 * Handles task rescheduling, dependency dragging, and list reordering.
 */
export function useGanttDragDrop(config: UseGanttDragDropConfig) {
  const { userId, tasks, setTasks, lockedTaskIds, setError } = config;

  // Refs for timeline scrolling
  const ganttContainerRef = useRef<HTMLDivElement>(null);
  const ganttTimelineRef = useRef<HTMLDivElement>(null);

  // Gantt view state
  const [ganttStartDate, setGanttStartDate] = useState<Date>(() => {
    const today = new Date();
    today.setDate(today.getDate() - 7);
    return today;
  });
  const [ganttZoom, setGanttZoom] = useState<"day" | "week" | "month">("week");
  const [ganttDaysToShow, setGanttDaysToShow] = useState(28);

  // Gantt drag state
  const [draggingTask, setDraggingTask] = useState<GanttDragState | null>(null);

  // Dependency drag state
  const [dependencyDrag, setDependencyDrag] = useState<DependencyDragState | null>(null);
  const [hoveredDependency, setHoveredDependency] = useState<string | null>(null);

  // Gantt quick add state
  const [ganttQuickAdd, setGanttQuickAdd] = useState<GanttQuickAddState | null>(null);
  const [ganttQuickAddTitle, setGanttQuickAddTitle] = useState("");

  // List view drag state
  const [listDragState, setListDragState] = useState<ListDragState | null>(null);

  // Critical path highlighting
  const [showCriticalPath, setShowCriticalPath] = useState(false);

  /**
   * Start dragging a task on the Gantt chart
   */
  const handleGanttDragStart = useCallback(
    (
      e: React.MouseEvent,
      task: Task,
      mode: "move" | "resize-start" | "resize-end" = "move"
    ) => {
      // Don't allow dragging locked tasks
      if (lockedTaskIds.has(task.id)) {
        return;
      }

      const startDate = task.startAt ? new Date(task.startAt) : null;
      const endDate = task.dueAt ? new Date(task.dueAt) : null;

      setDraggingTask({
        taskId: task.id,
        originalStartDate: startDate,
        originalEndDate: endDate,
        dragStartX: e.clientX,
        currentOffsetDays: 0,
        mode,
      });
    },
    [lockedTaskIds]
  );

  /**
   * Handle mouse move during Gantt drag
   */
  const handleGanttDragMove = useCallback(
    (e: MouseEvent, dayWidth: number) => {
      if (!draggingTask) return;

      const deltaX = e.clientX - draggingTask.dragStartX;
      const offsetDays = Math.round(deltaX / dayWidth);

      if (offsetDays !== draggingTask.currentOffsetDays) {
        setDraggingTask((prev) =>
          prev ? { ...prev, currentOffsetDays: offsetDays } : null
        );
      }
    },
    [draggingTask]
  );

  /**
   * End Gantt drag and apply changes
   */
  const handleGanttDragEnd = useCallback(async () => {
    if (!draggingTask) return;

    const { taskId, originalStartDate, originalEndDate, currentOffsetDays, mode } = draggingTask;

    if (currentOffsetDays === 0) {
      setDraggingTask(null);
      return;
    }

    let newStartDate = originalStartDate;
    let newEndDate = originalEndDate;

    switch (mode) {
      case "move":
        if (originalStartDate) {
          newStartDate = new Date(originalStartDate);
          newStartDate.setDate(newStartDate.getDate() + currentOffsetDays);
        }
        if (originalEndDate) {
          newEndDate = new Date(originalEndDate);
          newEndDate.setDate(newEndDate.getDate() + currentOffsetDays);
        }
        break;

      case "resize-start":
        if (originalStartDate) {
          newStartDate = new Date(originalStartDate);
          newStartDate.setDate(newStartDate.getDate() + currentOffsetDays);
          // Ensure start doesn't go past end
          if (newEndDate && newStartDate > newEndDate) {
            newStartDate = new Date(newEndDate);
          }
        }
        break;

      case "resize-end":
        if (originalEndDate) {
          newEndDate = new Date(originalEndDate);
          newEndDate.setDate(newEndDate.getDate() + currentOffsetDays);
          // Ensure end doesn't go before start
          if (newStartDate && newEndDate < newStartDate) {
            newEndDate = new Date(newStartDate);
          }
        }
        break;
    }

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              startAt: newStartDate?.toISOString(),
              dueAt: newEndDate?.toISOString(),
            }
          : t
      )
    );

    setDraggingTask(null);

    try {
      await apiUpdateTask(taskId, userId, {
        start_at: newStartDate?.toISOString(),
        due_at: newEndDate?.toISOString(),
      });
    } catch (err) {
      console.error("Failed to update task dates:", err);
      // Revert on error
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                startAt: originalStartDate?.toISOString(),
                dueAt: originalEndDate?.toISOString(),
              }
            : t
        )
      );
      setError?.("Failed to update task dates.");
    }
  }, [draggingTask, userId, setTasks, setError]);

  /**
   * Start dependency drag from a task
   */
  const handleDependencyDragStart = useCallback(
    (
      e: React.MouseEvent,
      task: Task,
      barLeftX: number,
      barRightX: number,
      barCenterY: number
    ) => {
      const timeline = ganttTimelineRef.current;
      if (!timeline) return;

      const rect = timeline.getBoundingClientRect();
      const scrollLeft = timeline.scrollLeft;
      const scrollTop = timeline.scrollTop;

      // Shift = start-to-start, Ctrl = finish-to-finish, otherwise finish-to-start
      const depType = e.shiftKey
        ? "start_to_start"
        : e.ctrlKey || e.metaKey
        ? "finish_to_finish"
        : "finish_to_start";
      const startX = depType === "start_to_start" ? barLeftX : barRightX;

      setDependencyDrag({
        sourceTaskId: task.id,
        sourceTaskTitle: task.title,
        startX,
        startY: barCenterY,
        currentX: e.clientX - rect.left + scrollLeft,
        currentY: e.clientY - rect.top + scrollTop,
        targetTaskId: null,
        dependencyType: depType,
      });
    },
    []
  );

  /**
   * Handle dependency drag move
   */
  const handleDependencyDragMove = useCallback(
    (e: MouseEvent, barLeftX?: number, barRightX?: number) => {
      if (!dependencyDrag) return;

      const timeline = ganttTimelineRef.current;
      if (!timeline) return;

      const rect = timeline.getBoundingClientRect();
      const scrollLeft = timeline.scrollLeft;
      const scrollTop = timeline.scrollTop;

      // Update dependency type based on modifier keys
      const newDepType = e.shiftKey
        ? "start_to_start"
        : e.ctrlKey || e.metaKey
        ? "finish_to_finish"
        : "finish_to_start";
      const depTypeChanged = newDepType !== dependencyDrag.dependencyType;

      setDependencyDrag((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentX: e.clientX - rect.left + scrollLeft,
          currentY: e.clientY - rect.top + scrollTop,
          dependencyType: newDepType,
          ...(depTypeChanged && barLeftX !== undefined && barRightX !== undefined
            ? { startX: newDepType === "start_to_start" ? barLeftX : barRightX }
            : {}),
        };
      });
    },
    [dependencyDrag]
  );

  /**
   * End dependency drag
   */
  const handleDependencyDragEnd = useCallback(() => {
    // The actual dependency creation is handled by the parent component
    // This just provides the drag state
    return dependencyDrag;
  }, [dependencyDrag]);

  /**
   * Clear dependency drag state
   */
  const clearDependencyDrag = useCallback(() => {
    setDependencyDrag(null);
  }, []);

  /**
   * Set target task for dependency drag
   */
  const setDependencyTarget = useCallback((taskId: string | null) => {
    setDependencyDrag((prev) =>
      prev ? { ...prev, targetTaskId: taskId } : null
    );
  }, []);

  // List view drag handlers
  const handleListDragStart = useCallback(
    (e: React.DragEvent, task: Task, statusId: string, index: number) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", task.id);
      if (e.currentTarget instanceof HTMLElement) {
        e.dataTransfer.setDragImage(e.currentTarget, 20, 20);
      }
      setListDragState({
        taskId: task.id,
        sourceStatus: statusId,
        sourceIndex: index,
        overStatus: null,
        overIndex: null,
        overPosition: null,
      });
    },
    []
  );

  const handleListDragOver = useCallback(
    (
      e: React.DragEvent,
      statusId: string,
      index: number,
      position: "before" | "after"
    ) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (listDragState) {
        if (
          listDragState.overStatus !== statusId ||
          listDragState.overIndex !== index ||
          listDragState.overPosition !== position
        ) {
          setListDragState((prev) =>
            prev
              ? {
                  ...prev,
                  overStatus: statusId,
                  overIndex: index,
                  overPosition: position,
                }
              : null
          );
        }
      }
    },
    [listDragState]
  );

  const handleListDragEnd = useCallback(() => {
    setListDragState(null);
  }, []);

  /**
   * Handle Gantt quick add click
   */
  const handleGanttQuickAddClick = useCallback(
    (e: React.MouseEvent, date: Date) => {
      const timeline = ganttTimelineRef.current;
      if (!timeline) return;

      const rect = timeline.getBoundingClientRect();
      setGanttQuickAdd({
        show: true,
        date,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setGanttQuickAddTitle("");
    },
    []
  );

  /**
   * Close Gantt quick add
   */
  const closeGanttQuickAdd = useCallback(() => {
    setGanttQuickAdd(null);
    setGanttQuickAddTitle("");
  }, []);

  // Mouse up/move handlers for Gantt drag
  useEffect(() => {
    if (!draggingTask) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate day width from container - this would need to be passed in
      // For now, use a default approximation
      const dayWidth = ganttZoom === "day" ? 60 : ganttZoom === "week" ? 30 : 15;
      handleGanttDragMove(e, dayWidth);
    };

    const handleMouseUp = () => {
      handleGanttDragEnd();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingTask, ganttZoom, handleGanttDragMove, handleGanttDragEnd]);

  return {
    // Refs
    refs: {
      container: ganttContainerRef,
      timeline: ganttTimelineRef,
    },

    // Gantt view settings
    view: {
      startDate: ganttStartDate,
      setStartDate: setGanttStartDate,
      zoom: ganttZoom,
      setZoom: setGanttZoom,
      daysToShow: ganttDaysToShow,
      setDaysToShow: setGanttDaysToShow,
      showCriticalPath,
      setShowCriticalPath,
    },

    // Gantt task drag
    taskDrag: {
      state: draggingTask,
      start: handleGanttDragStart,
      move: handleGanttDragMove,
      end: handleGanttDragEnd,
      isLocked: (taskId: string) => lockedTaskIds.has(taskId),
    },

    // Dependency drag
    dependencyDrag: {
      state: dependencyDrag,
      start: handleDependencyDragStart,
      move: handleDependencyDragMove,
      end: handleDependencyDragEnd,
      clear: clearDependencyDrag,
      setTarget: setDependencyTarget,
      hoveredId: hoveredDependency,
      setHoveredId: setHoveredDependency,
    },

    // Gantt quick add
    quickAdd: {
      state: ganttQuickAdd,
      title: ganttQuickAddTitle,
      setTitle: setGanttQuickAddTitle,
      handleClick: handleGanttQuickAddClick,
      close: closeGanttQuickAdd,
    },

    // List drag
    listDrag: {
      state: listDragState,
      start: handleListDragStart,
      over: handleListDragOver,
      end: handleListDragEnd,
    },
  };
}

export type UseGanttDragDropReturn = ReturnType<typeof useGanttDragDrop>;

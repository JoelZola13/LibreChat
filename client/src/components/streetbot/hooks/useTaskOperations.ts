"use client";

import { useState, useCallback } from "react";
import {
  Task,
  Project,
  createTask as apiCreateTask,
  updateTask as apiUpdateTask,
  deleteTask as apiDeleteTask,
  fetchProjectTasks,
  createProject as apiCreateProject,
} from "@/lib/api/tasks";
import { trashTask } from "@/lib/api/tasks-advanced";

interface UseTaskOperationsConfig {
  userId: string;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  selectedProject: Project | null;
  setProjects?: React.Dispatch<React.SetStateAction<Project[]>>;
  setSelectedProject?: React.Dispatch<React.SetStateAction<Project | null>>;
  setError?: (error: string | null) => void;
}

/**
 * Hook for task CRUD operations with optimistic updates and error recovery.
 * Consolidates task creation, update, delete, and subtask management.
 */
export function useTaskOperations(config: UseTaskOperationsConfig) {
  const {
    userId,
    tasks,
    setTasks,
    selectedProject,
    setProjects,
    setSelectedProject,
    setError,
  } = config;

  // Editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTaskInStatus, setAddingTaskInStatus] = useState<string | null>(null);

  // Subtask state
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Project creation state
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectColor, setNewProjectColor] = useState("#FFD700");

  /**
   * Toggle task completion status
   */
  const toggleTaskComplete = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const isDone = task.status === "done";
      const newStatus = isDone ? "todo" : "done";
      const completedAt = isDone ? undefined : new Date().toISOString();

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: newStatus, completedAt } : t
        )
      );

      try {
        await apiUpdateTask(taskId, userId, {
          status: newStatus,
          completed_at: completedAt,
        });
      } catch (err) {
        console.error("Failed to update task:", err);
        // Revert on error
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: task.status, completedAt: task.completedAt }
              : t
          )
        );
      }
    },
    [tasks, setTasks, userId]
  );

  /**
   * Create a new task in a specific status
   */
  const createTaskInStatus = useCallback(
    async (statusId: string) => {
      if (!newTaskTitle.trim() || !selectedProject) return;

      const title = newTaskTitle.trim();
      setNewTaskTitle("");
      setAddingTaskInStatus(null);

      try {
        const newTask = await apiCreateTask(userId, {
          project_id: selectedProject.id,
          title,
          status: statusId,
          priority: "none",
        });
        setTasks((prev) => [...prev, newTask]);
      } catch (err) {
        console.error("Failed to create task:", err);
        setError?.("Failed to create task.");
      }
    },
    [newTaskTitle, selectedProject, userId, setTasks, setError]
  );

  /**
   * Create a new project
   */
  const createProject = useCallback(async () => {
    if (!newProjectName.trim()) return;

    const name = newProjectName.trim();
    setNewProjectName("");
    setShowCreateProject(false);

    try {
      const newProject = await apiCreateProject(userId, {
        name,
        color: newProjectColor,
      });
      setProjects?.((prev) => [...prev, newProject]);
      setSelectedProject?.(newProject);
    } catch (err) {
      console.error("Failed to create project:", err);
      setError?.("Failed to create project.");
    }
  }, [
    newProjectName,
    newProjectColor,
    userId,
    setProjects,
    setSelectedProject,
    setError,
  ]);

  /**
   * Delete a task
   */
  const deleteTask = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      // Optimistic removal
      setTasks((prev) => prev.filter((t) => t.id !== taskId));

      try {
        await apiDeleteTask(taskId, userId);
      } catch (err) {
        console.error("Failed to delete task:", err);
        // Revert on error
        setTasks((prev) => [...prev, task]);
      }
    },
    [tasks, setTasks, userId]
  );

  /**
   * Toggle task expansion (for subtasks)
   */
  const toggleTaskExpanded = useCallback((taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  /**
   * Start adding a subtask to a parent task
   */
  const startAddingSubtask = useCallback((parentTaskId: string) => {
    setAddingSubtaskTo(parentTaskId);
    setNewSubtaskTitle("");
    // Auto-expand the parent task
    setExpandedTasks((prev) => new Set([...prev, parentTaskId]));
  }, []);

  /**
   * Create a subtask under a parent task
   */
  const createSubtask = useCallback(
    async (parentTaskId: string) => {
      if (!newSubtaskTitle.trim() || !selectedProject) return;

      const title = newSubtaskTitle.trim();
      const parentTask = tasks.find((t) => t.id === parentTaskId);
      if (!parentTask) return;

      setNewSubtaskTitle("");
      setAddingSubtaskTo(null);

      try {
        const newSubtask = await apiCreateTask(userId, {
          project_id: selectedProject.id,
          parent_task_id: parentTaskId,
          title,
          status: parentTask.status,
          priority: "none",
        });

        // Add subtask to tasks list
        setTasks((prev) => [...prev, newSubtask]);

        // Update parent task's subtask count
        setTasks((prev) =>
          prev.map((t) =>
            t.id === parentTaskId
              ? { ...t, subtaskCount: t.subtaskCount + 1 }
              : t
          )
        );
      } catch (err) {
        console.error("Failed to create subtask:", err);
        setError?.("Failed to create subtask.");
      }
    },
    [newSubtaskTitle, selectedProject, tasks, userId, setTasks, setError]
  );

  /**
   * Get subtasks for a parent task
   */
  const getSubtasks = useCallback(
    (parentTaskId: string): Task[] => {
      return tasks.filter((t) => t.parentTaskId === parentTaskId);
    },
    [tasks]
  );

  /**
   * Start editing a task title
   */
  const startEditingTask = useCallback((task: Task) => {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
  }, []);

  /**
   * Save task title edit
   */
  const saveTaskEdit = useCallback(async () => {
    if (!editingTaskId || !editTaskTitle.trim()) {
      setEditingTaskId(null);
      setEditTaskTitle("");
      return;
    }

    const newTitle = editTaskTitle.trim();
    const taskId = editingTaskId;
    setEditingTaskId(null);
    setEditTaskTitle("");

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, title: newTitle } : t))
    );

    try {
      await apiUpdateTask(taskId, userId, { title: newTitle });
    } catch (err) {
      console.error("Failed to update task:", err);
    }
  }, [editingTaskId, editTaskTitle, setTasks, userId]);

  /**
   * Cancel task editing
   */
  const cancelEditingTask = useCallback(() => {
    setEditingTaskId(null);
    setEditTaskTitle("");
  }, []);

  /**
   * Update a task with arbitrary updates (used by views and bulk actions)
   */
  const handleUpdateTask = useCallback(
    async (taskId: string, updates: Partial<Task>) => {
      try {
        // Optimistic update
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
        );

        // Convert Task updates to API format
        const apiUpdates: Record<string, unknown> = {};
        if (updates.status !== undefined) apiUpdates.status = updates.status;
        if (updates.priority !== undefined) apiUpdates.priority = updates.priority;
        if (updates.assignees !== undefined) apiUpdates.assignees = updates.assignees;
        if (updates.dueAt !== undefined) apiUpdates.due_at = updates.dueAt;
        if (updates.startAt !== undefined) apiUpdates.start_at = updates.startAt;
        if (updates.title !== undefined) apiUpdates.title = updates.title;
        if (updates.description !== undefined) apiUpdates.description = updates.description;
        if (updates.labels !== undefined) apiUpdates.labels = updates.labels;
        if (updates.milestoneId !== undefined) apiUpdates.milestone_id = updates.milestoneId;
        if (updates.recurrenceRule !== undefined) apiUpdates.recurrence_rule = updates.recurrenceRule;

        await apiUpdateTask(taskId, userId, apiUpdates);
      } catch (err) {
        console.error("Failed to update task:", err);
        // Revert on error
        if (selectedProject) {
          const freshTasks = await fetchProjectTasks(selectedProject.id, userId);
          setTasks(freshTasks);
        }
      }
    },
    [userId, setTasks, selectedProject]
  );

  /**
   * Delete a task (alternate interface for views)
   */
  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      try {
        // Optimistic removal
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        await apiDeleteTask(taskId, userId);
      } catch (err) {
        console.error("Failed to delete task:", err);
        // Revert on error
        if (selectedProject) {
          const freshTasks = await fetchProjectTasks(selectedProject.id, userId);
          setTasks(freshTasks);
        }
      }
    },
    [userId, setTasks, selectedProject]
  );

  /**
   * Archive (soft delete) a task
   */
  const handleArchiveTask = useCallback(
    async (taskId: string) => {
      try {
        // Optimistic removal from view
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        await trashTask(taskId, userId);
      } catch (err) {
        console.error("Failed to archive task:", err);
        // Revert on error
        if (selectedProject) {
          const freshTasks = await fetchProjectTasks(selectedProject.id, userId);
          setTasks(freshTasks);
        }
      }
    },
    [userId, setTasks, selectedProject]
  );

  return {
    // Editing state
    editing: {
      taskId: editingTaskId,
      taskTitle: editTaskTitle,
      setTaskTitle: setEditTaskTitle,
      start: startEditingTask,
      save: saveTaskEdit,
      cancel: cancelEditingTask,
    },

    // New task state
    newTask: {
      title: newTaskTitle,
      setTitle: setNewTaskTitle,
      inStatus: addingTaskInStatus,
      setInStatus: setAddingTaskInStatus,
      create: createTaskInStatus,
    },

    // Subtask state
    subtask: {
      addingTo: addingSubtaskTo,
      newTitle: newSubtaskTitle,
      setNewTitle: setNewSubtaskTitle,
      startAdding: startAddingSubtask,
      create: createSubtask,
      cancel: () => setAddingSubtaskTo(null),
      getSubtasks,
    },

    // Task expansion
    expanded: {
      tasks: expandedTasks,
      toggle: toggleTaskExpanded,
      isExpanded: (taskId: string) => expandedTasks.has(taskId),
    },

    // Project creation state
    projectCreation: {
      show: showCreateProject,
      setShow: setShowCreateProject,
      name: newProjectName,
      setName: setNewProjectName,
      color: newProjectColor,
      setColor: setNewProjectColor,
      create: createProject,
    },

    // Task operations
    toggleComplete: toggleTaskComplete,
    deleteTask,
    updateTask: handleUpdateTask,
    archiveTask: handleArchiveTask,
  };
}

export type UseTaskOperationsReturn = ReturnType<typeof useTaskOperations>;

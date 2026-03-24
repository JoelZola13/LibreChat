"use client";

import { useState, useCallback } from "react";
import type { Comment } from "@/lib/api/tasks";

// Popover position type
export interface PopoverPosition {
  top: number;
  left: number;
}

// Popover state with taskId and position
export interface PopoverState {
  taskId: string;
  position: PopoverPosition;
}

// Custom field popover has additional field info
export interface CustomFieldPopoverState {
  taskId: string;
  fieldId: string;
  field: {
    id: string;
    name: string;
    fieldType: string;
    options?: string[];
  };
  position: PopoverPosition;
}

// Custom recurrence configuration
export interface RecurrenceConfig {
  interval: number;
  unit: "day" | "week" | "month" | "year";
}

// All popover types
export type PopoverType =
  | "assignee"
  | "dueDate"
  | "priority"
  | "tags"
  | "comments"
  | "milestone"
  | "recurrence"
  | "customField";

/**
 * Hook to manage all popover/inline editor state for the tasks page.
 * Consolidates 10+ individual useState calls into one manageable hook.
 */
export function usePopovers() {
  // Popover states
  const [assigneePopover, setAssigneePopover] = useState<PopoverState | null>(null);
  const [dueDatePopover, setDueDatePopover] = useState<PopoverState | null>(null);
  const [priorityPopover, setPriorityPopover] = useState<PopoverState | null>(null);
  const [tagsPopover, setTagsPopover] = useState<PopoverState | null>(null);
  const [commentsPopover, setCommentsPopover] = useState<PopoverState | null>(null);
  const [milestonePopover, setMilestonePopover] = useState<PopoverState | null>(null);
  const [recurrencePopover, setRecurrencePopover] = useState<PopoverState | null>(null);
  const [customFieldPopover, setCustomFieldPopover] = useState<CustomFieldPopoverState | null>(null);

  // Menu states
  const [taskMenuOpen, setTaskMenuOpen] = useState<string | null>(null);
  const [folderMenuOpen, setFolderMenuOpen] = useState<string | null>(null);
  const [listMenuOpen, setListMenuOpen] = useState<string | null>(null);

  // Tag creation state
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#FFD600");

  // Comment state
  const [taskComments, setTaskComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);

  // Recurrence state
  const [customRecurrence, setCustomRecurrence] = useState<RecurrenceConfig>({
    interval: 1,
    unit: "day",
  });

  // Custom field edit value
  const [customFieldEditValue, setCustomFieldEditValue] = useState<string>("");

  /**
   * Close all popovers and menus, reset temporary input state
   */
  const closeAllPopovers = useCallback(() => {
    setAssigneePopover(null);
    setDueDatePopover(null);
    setPriorityPopover(null);
    setTagsPopover(null);
    setCommentsPopover(null);
    setMilestonePopover(null);
    setRecurrencePopover(null);
    setCustomFieldPopover(null);
    setTaskMenuOpen(null);
    setFolderMenuOpen(null);
    setListMenuOpen(null);
    setNewLabelName("");
    setNewCommentText("");
    setTaskComments([]);
    setCustomFieldEditValue("");
  }, []);

  /**
   * Open a specific popover at a position
   */
  const openPopover = useCallback(
    (
      type: PopoverType,
      taskId: string,
      position: PopoverPosition,
      fieldInfo?: CustomFieldPopoverState["field"]
    ) => {
      // Close any existing popovers first
      closeAllPopovers();

      switch (type) {
        case "assignee":
          setAssigneePopover({ taskId, position });
          break;
        case "dueDate":
          setDueDatePopover({ taskId, position });
          break;
        case "priority":
          setPriorityPopover({ taskId, position });
          break;
        case "tags":
          setTagsPopover({ taskId, position });
          break;
        case "comments":
          setCommentsPopover({ taskId, position });
          break;
        case "milestone":
          setMilestonePopover({ taskId, position });
          break;
        case "recurrence":
          setRecurrencePopover({ taskId, position });
          break;
        case "customField":
          if (fieldInfo) {
            setCustomFieldPopover({
              taskId,
              fieldId: fieldInfo.id,
              field: fieldInfo,
              position,
            });
          }
          break;
      }
    },
    [closeAllPopovers]
  );

  /**
   * Close a specific popover type
   */
  const closePopover = useCallback((type: PopoverType) => {
    switch (type) {
      case "assignee":
        setAssigneePopover(null);
        break;
      case "dueDate":
        setDueDatePopover(null);
        break;
      case "priority":
        setPriorityPopover(null);
        break;
      case "tags":
        setTagsPopover(null);
        setNewLabelName("");
        break;
      case "comments":
        setCommentsPopover(null);
        setNewCommentText("");
        setTaskComments([]);
        break;
      case "milestone":
        setMilestonePopover(null);
        break;
      case "recurrence":
        setRecurrencePopover(null);
        break;
      case "customField":
        setCustomFieldPopover(null);
        setCustomFieldEditValue("");
        break;
    }
  }, []);

  /**
   * Get the currently active popover type and taskId
   */
  const getActivePopover = useCallback((): { type: PopoverType; taskId: string } | null => {
    if (assigneePopover) return { type: "assignee", taskId: assigneePopover.taskId };
    if (dueDatePopover) return { type: "dueDate", taskId: dueDatePopover.taskId };
    if (priorityPopover) return { type: "priority", taskId: priorityPopover.taskId };
    if (tagsPopover) return { type: "tags", taskId: tagsPopover.taskId };
    if (commentsPopover) return { type: "comments", taskId: commentsPopover.taskId };
    if (milestonePopover) return { type: "milestone", taskId: milestonePopover.taskId };
    if (recurrencePopover) return { type: "recurrence", taskId: recurrencePopover.taskId };
    if (customFieldPopover) return { type: "customField", taskId: customFieldPopover.taskId };
    return null;
  }, [
    assigneePopover,
    dueDatePopover,
    priorityPopover,
    tagsPopover,
    commentsPopover,
    milestonePopover,
    recurrencePopover,
    customFieldPopover,
  ]);

  return {
    // Popover states
    popovers: {
      assignee: assigneePopover,
      dueDate: dueDatePopover,
      priority: priorityPopover,
      tags: tagsPopover,
      comments: commentsPopover,
      milestone: milestonePopover,
      recurrence: recurrencePopover,
      customField: customFieldPopover,
    },

    // Menu states
    menus: {
      task: taskMenuOpen,
      folder: folderMenuOpen,
      list: listMenuOpen,
    },

    // Menu setters
    setTaskMenu: setTaskMenuOpen,
    setFolderMenu: setFolderMenuOpen,
    setListMenu: setListMenuOpen,

    // Tag creation
    newLabel: {
      name: newLabelName,
      color: newLabelColor,
      setName: setNewLabelName,
      setColor: setNewLabelColor,
    },

    // Comments
    comments: {
      items: taskComments,
      newText: newCommentText,
      loading: loadingComments,
      setItems: setTaskComments,
      setNewText: setNewCommentText,
      setLoading: setLoadingComments,
    },

    // Recurrence
    recurrence: {
      config: customRecurrence,
      setConfig: setCustomRecurrence,
    },

    // Custom field
    customField: {
      editValue: customFieldEditValue,
      setEditValue: setCustomFieldEditValue,
    },

    // Actions
    openPopover,
    closePopover,
    closeAllPopovers,
    getActivePopover,
  };
}

export type UsePopoversReturn = ReturnType<typeof usePopovers>;

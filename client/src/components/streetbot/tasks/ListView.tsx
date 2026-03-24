"use client";

import React, { ReactNode } from "react";
import type { Task, Label } from "@/lib/api/tasks";
import type { CustomField } from "@/lib/api/tasks-advanced";
import { StatusGroup } from "./StatusGroup";
import { TasksColorTheme, UserInfo } from "./constants";

interface StatusConfig {
  id: string;
  name: string;
  color: string;
  category?: string;
}

interface DragState {
  taskId: string;
  overStatus: string | null;
  overIndex: number;
  overPosition: "before" | "after";
}

interface ListViewProps {
  statuses: StatusConfig[];
  tasksByStatus: Record<string, Task[]>;
  collapsedStatuses: Set<string>;
  gridTemplate: string;
  customFields: CustomField[];
  colors: TasksColorTheme;
  labels: Label[];
  users: Record<string, UserInfo>;
  dragState: DragState | null;

  // Callbacks
  onToggleStatusCollapse: (statusId: string) => void;
  onDragOver: (e: React.DragEvent, statusId: string, index: number, position: "before" | "after") => void;
  onDrop: (e: React.DragEvent, statusId: string, index: number, position: "before" | "after") => void;
  onShowFieldManager: () => void;

  // Render functions (provided by parent to maintain state)
  renderTaskRow: (task: Task, statusId: string, index: number) => ReactNode;
  renderAddTaskRow?: (statusId: string) => ReactNode;
}

/**
 * List view component for tasks
 * Displays tasks grouped by status with drag-and-drop support
 */
export function ListView({
  statuses,
  tasksByStatus,
  collapsedStatuses,
  gridTemplate,
  customFields,
  colors,
  dragState,
  onToggleStatusCollapse,
  onDragOver,
  onDrop,
  onShowFieldManager,
  renderTaskRow,
  renderAddTaskRow,
}: ListViewProps) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        paddingBottom: "100px",
      }}
    >
      {statuses.map((status) => (
        <StatusGroup
          key={status.id}
          status={status}
          tasks={tasksByStatus[status.id] || []}
          isCollapsed={collapsedStatuses.has(status.id)}
          gridTemplate={gridTemplate}
          customFields={customFields}
          colors={colors}
          dragState={dragState}
          onToggleCollapse={onToggleStatusCollapse}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onShowFieldManager={onShowFieldManager}
          renderTaskRow={renderTaskRow}
          renderAddTaskRow={renderAddTaskRow}
        />
      ))}
    </div>
  );
}

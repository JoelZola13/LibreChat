"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import "@/styles/glassmorphism.css";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Calendar,
  Users,
  Flag,
  CheckCircle2,
  Circle,
  Clock,
  Folder,
  FolderOpen,
  FolderPlus,
  ListTodo,
  LayoutGrid,
  CalendarDays,
  Filter,
  SortAsc,
  X,
  Edit3,
  Trash2,
  Copy,
  Link,
  MessageSquare,
  MessageCircle,
  Paperclip,
  Tag,
  User,
  AlertCircle,
  CheckCheck,
  Loader2,
  GripVertical,
  Hash,
  Star,
  Archive,
  Settings,
  RefreshCw,
  Play,
  Pause,
  History,
  Info,
  Send,
  Square,
  List,
  Eye,
  Zap,
  BarChart3,
  Keyboard,
  Download,
  GitMerge,
  ArrowRight,
  Lock,
  Unlock,
  GanttChart,
  ChevronLeft,
  Upload,
  FileText,
  BookOpen,
  PieChart,
  TrendingUp,
} from "lucide-react";
import {
  BoardView,
  CalendarView,
  WorkloadView,
  BulkActions,
  // Popover components
  AssigneePopover,
  DueDatePopover,
  PriorityPopover,
  TagsPopover,
  CommentsPopover,
  MilestonePopover,
  CustomFieldPopover,
  // Dialog components
  TrashView,
  TemplateManager,
  MilestoneManager,
  AutomationManager,
  ImportTasksModal,
  // Constants
  PRIORITIES,
  DEFAULT_STATUSES,
  DEFAULT_COLORS,
  formatDueDate,
  type TasksColorTheme,
  type UserInfo,
} from "./index";
import { useTaskKeyboardShortcuts, KeyboardShortcutsHelp } from "@/hooks/useTaskKeyboardShortcuts";
import { useTheme } from "@/app/providers/theme-provider";
import { CrossLink } from "../shared/CrossLink";
import { UnifiedLayout } from "../shared/UnifiedLayout";
import { getOrCreateUserId } from "@/lib/userId";
import { useAuthContext } from "~/hooks/AuthContext";
import {
  fetchProjects,
  fetchProjectTasks,
  fetchSubtasks,
  createProject as apiCreateProject,
  createTask as apiCreateTask,
  updateTask as apiUpdateTask,
  deleteTask as apiDeleteTask,
  fetchComments,
  createComment as apiCreateComment,
  fetchTaskActivity,
  fetchChecklist,
  createChecklistItem as apiCreateChecklistItem,
  toggleChecklistItem as apiToggleChecklistItem,
  deleteChecklistItem as apiDeleteChecklistItem,
  fetchTimeEntries,
  startTimer as apiStartTimer,
  stopTimer as apiStopTimer,
  formatDuration,
  fetchProjectStatuses,
  createStatus as apiCreateStatus,
  updateStatus as apiUpdateStatus,
  deleteStatus as apiDeleteStatus,
  reorderStatuses as apiReorderStatuses,
  fetchLabels,
  createLabel as apiCreateLabel,
  deleteLabel as apiDeleteLabel,
  // Folder & List API
  fetchFolders,
  createFolder as apiCreateFolder,
  updateFolder as apiUpdateFolder,
  deleteFolder as apiDeleteFolder,
  fetchLists,
  createList as apiCreateList,
  updateList as apiUpdateList,
  deleteList as apiDeleteList,
  // Dependencies API
  fetchTaskDependencies,
  fetchDependentTasks,
  addTaskDependency,
  updateTaskDependency,
  removeTaskDependency,
  isTaskBlocked,
  moveTask,
  type Project,
  type Task,
  type Status,
  type Label,
  type Comment,
  type Folder as FolderType,
  type TaskList,
  type TaskDependency,
  bulkCloneTasks,
  bulkMoveTasks,
  bulkDeleteTasks,
  bulkUpdateTasks,
  importTasks,
  parseTasksCsv,
  type ImportTaskItem,
  // Sprint 3G: Analytics, Pages, Views
  fetchAnalytics,
  fetchPages,
  createPage as apiCreatePage,
  updatePage as apiUpdatePage,
  deletePage as apiDeletePage,
  fetchViews,
  createView as apiCreateView,
  updateView as apiUpdateView,
  deleteView as apiDeleteView,
} from "@/lib/api/tasks";
import {
  fetchSavedFilters,
  createSavedFilter,
  updateSavedFilter,
  deleteSavedFilter,
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  useTemplate,
  fetchMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  fetchCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  getTaskFieldValues,
  setTaskFieldValue,
  fetchTaskHistory,
  trashTask,
  restoreTask,
  fetchTrash,
  emptyTrash,
  fetchAutomationRules,
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
  fetchTimeReport,
  exportTasksCsv,
  exportTasksJson,
  type SavedFilter,
  type SavedFilterCreateData,
  type TaskTemplate,
  type TaskTemplateCreateData,
  type Milestone,
  type MilestoneCreateData,
  type CustomField,
  type CustomFieldCreateData,
  type TaskHistoryEntry,
  type AutomationRule,
  type AutomationRuleCreateData,
  type TimeReport,
} from "@/lib/api/tasks-advanced";

// PRIORITIES and DEFAULT_STATUSES are now imported from @/components/tasks

// Sample users for assignees
const USERS: Record<string, { name: string; avatar: string; initials: string }> = {
  "demo-user": { name: "You", avatar: "#FFD700", initials: "Y" },
  "jz": { name: "Joel Zola", avatar: "#3b82f6", initials: "JZ" },
  "lr": { name: "Lisa Rivera", avatar: "#ec4899", initials: "LR" },
  "sarah-chen": { name: "Sarah Chen", avatar: "#00FFDD", initials: "SC" },
  "marcus-lee": { name: "Marcus Lee", avatar: "#FF0055", initials: "ML" },
  "alex-rivera": { name: "Alex Rivera", avatar: "#7700FF", initials: "AR" },
};

type ViewMode = "list" | "board" | "calendar" | "workload" | "gantt";
const PROJECTS_CACHE_KEY = "streetbot:tasks:cached-projects";
const LOCAL_DEMO_PROJECT_ID = "local-demo-project";
type CreateTaskPayload = Parameters<typeof apiCreateTask>[1];

interface SavedView {
  id: string;
  name: string;
  description?: string;
  query_data?: Record<string, unknown> | null;
  filters?: SavedFilter["filters"] | null;
  view_type?: string | null;
  viewType?: string | null;
}

interface ActiveFilterState {
  name: string;
  color: string;
  filters: SavedFilter["filters"];
}

function createLocalFallbackProject(): Project {
  const now = new Date().toISOString();
  return {
    id: LOCAL_DEMO_PROJECT_ID,
    name: "Local Demo Project",
    description: "Using local fallback because the projects API is unavailable.",
    status: "active",
    color: "#6366F1",
    memberCount: 1,
    taskCount: 0,
    completedCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function generateLocalTaskId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeDueDateFilter(value: unknown): SavedFilter["filters"]["dueDate"] | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const data = value as Record<string, unknown>;
  const type = data.type;
  if (type !== "overdue" && type !== "today" && type !== "this_week" && type !== "range") {
    return undefined;
  }

  const normalized: SavedFilter["filters"]["dueDate"] = { type };
  if (typeof data.start === "string") {
    normalized.start = data.start;
  }
  if (typeof data.end === "string") {
    normalized.end = data.end;
  }
  return normalized;
}

function normalizeFilterPayload(value: unknown): SavedFilter["filters"] {
  if (!value || typeof value !== "object") {
    return {};
  }

  const data = value as Record<string, unknown>;
  const search = typeof data.search === "string" ? data.search : undefined;

  return {
    status: toStringArray(data.status),
    priority: toStringArray(data.priority),
    assignees: toStringArray(data.assignees),
    labels: toStringArray(data.labels),
    dueDate: normalizeDueDateFilter(data.dueDate),
    search,
  };
}

function extractSavedViewFilters(view: SavedView): SavedFilter["filters"] {
  if (view.filters && typeof view.filters === "object") {
    return normalizeFilterPayload(view.filters);
  }

  const queryData = view.query_data && typeof view.query_data === "object"
    ? view.query_data
    : null;

  if (queryData && typeof queryData.filters === "object") {
    return normalizeFilterPayload(queryData.filters);
  }

  return normalizeFilterPayload(queryData);
}

function extractSavedViewMode(view: SavedView): ViewMode | null {
  const queryData = view.query_data && typeof view.query_data === "object"
    ? view.query_data
    : null;

  const rawMode =
    view.view_type ??
    view.viewType ??
    (typeof queryData?.view_type === "string" ? queryData.view_type : null) ??
    (typeof queryData?.viewType === "string" ? queryData.viewType : null);

  if (!rawMode) {
    return null;
  }

  const normalized = rawMode.toLowerCase();
  if (normalized === "timeline") {
    return "list";
  }
  if (normalized === "kanban") {
    return "board";
  }
  if (normalized === "list" || normalized === "board" || normalized === "calendar" || normalized === "workload" || normalized === "gantt") {
    return normalized;
  }
  return null;
}

function countActiveFilterCriteria(filters: SavedFilter["filters"]): number {
  let count = 0;
  if (filters.status?.length) count += 1;
  if (filters.priority?.length) count += 1;
  if (filters.assignees?.length) count += 1;
  if (filters.labels?.length) count += 1;
  if (filters.dueDate) count += 1;
  if (filters.search) count += 1;
  return count;
}

// Folder/List hierarchy types for rendering
interface FolderHierarchyItem {
  id: string;
  name: string;
  type: "folder";
  color: string;
  isExpanded: boolean;
  children: (FolderHierarchyItem | ListHierarchyItem)[];
  listCount: number;
  taskCount: number;
}

interface ListHierarchyItem {
  id: string;
  name: string;
  type: "list";
  color: string;
  taskCount: number;
  completedCount: number;
  folderId: string | null;
}

export default function TasksPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user: authUser } = useAuthContext();
  const userId = getOrCreateUserId(authUser?.id);

  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [usingLocalProjectsFallback, setUsingLocalProjectsFallback] = useState(false);
  const isLocalTasksMode = usingLocalProjectsFallback || selectedProject?.id === LOCAL_DEMO_PROJECT_ID;
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectColor, setNewProjectColor] = useState("#FFD700");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [taskMenuOpen, setTaskMenuOpen] = useState<string | null>(null);

  // Inline popover states
  const [assigneePopover, setAssigneePopover] = useState<{ taskId: string; position: { top: number; left: number } } | null>(null);
  const [dueDatePopover, setDueDatePopover] = useState<{ taskId: string; position: { top: number; left: number } } | null>(null);
  const [priorityPopover, setPriorityPopover] = useState<{ taskId: string; position: { top: number; left: number } } | null>(null);
  const [tagsPopover, setTagsPopover] = useState<{ taskId: string; position: { top: number; left: number } } | null>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#FFD600");
  const [commentsPopover, setCommentsPopover] = useState<{ taskId: string; position: { top: number; left: number } } | null>(null);
  const [taskComments, setTaskComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [milestonePopover, setMilestonePopover] = useState<{ taskId: string; position: { top: number; left: number } } | null>(null);
  const [recurrencePopover, setRecurrencePopover] = useState<{ taskId: string; position: { top: number; left: number } } | null>(null);
  const [customRecurrence, setCustomRecurrence] = useState({ interval: 1, unit: "day" as "day" | "week" | "month" | "year" });

  // Subtask states
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  // Collapsible status groups
  const [collapsedStatuses, setCollapsedStatuses] = useState<Set<string>>(new Set());

  // Folder/List sidebar state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  // Folder and List state (API-backed)
  const [apiFolders, setApiFolders] = useState<FolderType[]>([]);
  const [apiLists, setApiLists] = useState<TaskList[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showCreateList, setShowCreateList] = useState(false);
  const [createListInFolder, setCreateListInFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newListName, setNewListName] = useState("");
  const [addingTaskInList, setAddingTaskInList] = useState<string | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [showSidebarTasks, setShowSidebarTasks] = useState(true);
  const [addingSidebarSubtask, setAddingSidebarSubtask] = useState<string | null>(null);
  const [sidebarSubtaskTitle, setSidebarSubtaskTitle] = useState("");
  const [folderMenuOpen, setFolderMenuOpen] = useState<string | null>(null);
  const [listMenuOpen, setListMenuOpen] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [editListName, setEditListName] = useState("");

  // Custom statuses
  const [statuses, setStatuses] = useState<Status[]>([]);

  // Labels
  const [labels, setLabels] = useState<Label[]>([]);

  // Locked tasks (prevent auto-scheduling) - persisted to localStorage
  const [lockedTaskIds, setLockedTaskIds] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lockedTaskIds");
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch {
          return new Set();
        }
      }
    }
    return new Set();
  });

  // Persist locked tasks to localStorage
  useEffect(() => {
    localStorage.setItem("lockedTaskIds", JSON.stringify([...lockedTaskIds]));
  }, [lockedTaskIds]);

  // Toggle task lock
  const toggleTaskLock = useCallback((taskId: string) => {
    setLockedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  // Inline task creation state per status
  const [addingTaskInStatus, setAddingTaskInStatus] = useState<string | null>(null);

  // Bulk selection state for multi-task operations
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [focusedTaskIndex, setFocusedTaskIndex] = useState<number>(-1);

  // Saved Filters state
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");
  const [filterMenuOpen, setFilterMenuOpen] = useState<string | null>(null);

  // Task Templates state
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [saveAsTemplateTask, setSaveAsTemplateTask] = useState<Task | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);

  // Milestones state
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedMilestoneFilter, setSelectedMilestoneFilter] = useState<string | null>(null);
  const [showMilestoneManager, setShowMilestoneManager] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);

  // Custom Fields state
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [taskFieldValues, setTaskFieldValues] = useState<Record<string, Record<string, unknown>>>({});
  const [showFieldManager, setShowFieldManager] = useState(false);
  const [showCreateField, setShowCreateField] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<CustomField["fieldType"]>("text");
  const [customFieldPopover, setCustomFieldPopover] = useState<{
    taskId: string;
    fieldId: string;
    field: CustomField;
    position: { top: number; left: number };
  } | null>(null);
  const [customFieldEditValue, setCustomFieldEditValue] = useState<string>("");

  // Task History state
  const [taskHistory, setTaskHistory] = useState<TaskHistoryEntry[]>([]);
  const [showTaskHistory, setShowTaskHistory] = useState(false);
  const [historyTaskId, setHistoryTaskId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Trash state
  const [trashedTasks, setTrashedTasks] = useState<Task[]>([]);
  const [showTrashView, setShowTrashView] = useState(false);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [trashCount, setTrashCount] = useState(0);

  // Automation Rules state
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [showAutomationManager, setShowAutomationManager] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);

  // Time Reports state
  const [timeReport, setTimeReport] = useState<TimeReport | null>(null);
  const [showTimeReports, setShowTimeReports] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportGroupBy, setReportGroupBy] = useState<"day" | "week" | "task" | "user">("day");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");

  // Export state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);

  // Sprint 3G: Analytics state
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsXAxis, setAnalyticsXAxis] = useState<string>("state__group");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Sprint 3G: Pages state
  const [showPages, setShowPages] = useState(false);
  const [pages, setPages] = useState<any[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [newPageDescription, setNewPageDescription] = useState("");
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editPageName, setEditPageName] = useState("");
  const [editPageDescription, setEditPageDescription] = useState("");

  // Sprint 3G: Views (Saved Filters) state
  const [showViews, setShowViews] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [viewsLoading, setViewsLoading] = useState(false);
  const [showCreateView, setShowCreateView] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [newViewDescription, setNewViewDescription] = useState("");

  // Task Dependencies state
  const [taskDependencies, setTaskDependencies] = useState<Record<string, TaskDependency[]>>({});
  const [taskDependents, setTaskDependents] = useState<Record<string, TaskDependency[]>>({});
  const [blockedTasks, setBlockedTasks] = useState<Set<string>>(new Set());
  const [showDependencyPicker, setShowDependencyPicker] = useState(false);
  const [dependencyPickerTask, setDependencyPickerTask] = useState<Task | null>(null);
  const [dependencySearch, setDependencySearch] = useState("");
  const [loadingDependencies, setLoadingDependencies] = useState(false);
  const [selectedDependencyType, setSelectedDependencyType] = useState<TaskDependency["dependencyType"]>("finish_to_start");

  // Gantt Chart state
  const [ganttStartDate, setGanttStartDate] = useState<Date>(() => {
    const today = new Date();
    today.setDate(today.getDate() - 7); // Start 1 week ago
    return today;
  });
  const [ganttZoom, setGanttZoom] = useState<"day" | "week" | "month">("week");
  const [ganttDaysToShow, setGanttDaysToShow] = useState(28); // 4 weeks default

  // Gantt drag-to-reschedule state
  const [draggingTask, setDraggingTask] = useState<{
    taskId: string;
    originalStartDate: Date | null;
    originalEndDate: Date | null;
    dragStartX: number;
    currentOffsetDays: number;
    mode: "move" | "resize-start" | "resize-end";
  } | null>(null);
  const ganttContainerRef = useRef<HTMLDivElement>(null);
  const ganttTimelineRef = useRef<HTMLDivElement>(null);

  // Gantt click-to-create state
  const [ganttQuickAdd, setGanttQuickAdd] = useState<{
    show: boolean;
    date: Date;
    x: number;
    y: number;
  } | null>(null);
  const [ganttQuickAddTitle, setGanttQuickAddTitle] = useState("");
  const [hoveredDependency, setHoveredDependency] = useState<string | null>(null);
  const [dependencyDrag, setDependencyDrag] = useState<{
    sourceTaskId: string;
    sourceTaskTitle: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    targetTaskId: string | null;
    dependencyType: "finish_to_start" | "start_to_start" | "finish_to_finish";
  } | null>(null);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [editingDependency, setEditingDependency] = useState<{
    taskId: string;
    dependsOnTaskId: string;
    dep: TaskDependency;
    x: number;
    y: number;
    fromTaskTitle: string;
    toTaskTitle: string;
  } | null>(null);
  const [editingLagDays, setEditingLagDays] = useState<number>(0);
  const [pendingDependency, setPendingDependency] = useState<{
    sourceTaskId: string;
    targetTaskId: string;
    sourceTaskTitle: string;
    targetTaskTitle: string;
    dependencyType: "finish_to_start" | "start_to_start" | "finish_to_finish";
    x: number;
    y: number;
  } | null>(null);
  const [pendingLagDays, setPendingLagDays] = useState<number>(0);

  // Undo/redo history for dependency changes
  type DependencyAction = {
    type: "create" | "delete" | "update";
    taskId: string;
    dependsOnTaskId: string;
    dep: TaskDependency;
    previousLagDays?: number;
    newLagDays?: number;
    timestamp: number;
  };
  const [dependencyUndoStack, setDependencyUndoStack] = useState<DependencyAction[]>([]);
  const [dependencyRedoStack, setDependencyRedoStack] = useState<DependencyAction[]>([]);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [lastActionType, setLastActionType] = useState<"undo" | "redo" | "action" | "schedule">("action");

  // Undo/redo history for schedule changes (batch task date updates)
  type ScheduleAction = {
    type: "auto-schedule";
    changes: Array<{
      taskId: string;
      previousStartAt: string | null;
      previousDueAt: string | null;
      newStartAt: string;
      newDueAt: string;
    }>;
    timestamp: number;
  };
  const [scheduleUndoStack, setScheduleUndoStack] = useState<ScheduleAction[]>([]);
  const [scheduleRedoStack, setScheduleRedoStack] = useState<ScheduleAction[]>([]);

  // List view drag-to-reorder state
  interface ListDragState {
    taskId: string;
    sourceStatus: string;
    sourceIndex: number;
    overStatus: string | null;
    overIndex: number | null;
    overPosition: "before" | "after" | null;
  }
  const [listDragState, setListDragState] = useState<ListDragState | null>(null);

  // Computed active statuses
  // Map backend state groups to frontend status IDs
  const BACKEND_GROUP_TO_STATUS: Record<string, string> = {
    backlog: "backlog",
    unstarted: "todo",
    started: "in_progress",
    completed: "done",
    cancelled: "done",
  };

  const activeStatuses = useMemo((): { id: string; name: string; color: string; category: string }[] => {
    if (statuses.length > 0) {
      // Map backend states to frontend statuses, deduplicating by mapped ID
      // (e.g. "completed" and "cancelled" both map to "done")
      const seen = new Set<string>();
      const mapped: { id: string; name: string; color: string; category: string }[] = [];
      for (const s of statuses) {
        const frontendId = BACKEND_GROUP_TO_STATUS[s.category] || s.category;
        if (!seen.has(frontendId)) {
          seen.add(frontendId);
          mapped.push({
            id: frontendId,
            name: s.name.toUpperCase(),
            color: s.color,
            category: s.category,
          });
        }
      }
      return mapped;
    }
    return [...DEFAULT_STATUSES];
  }, [statuses]);

  // Build folder/list hierarchy from API data
  // ClickUp hierarchy: Workspace (Project) → Folder → List → Task → Subtask
  const folderHierarchy = useMemo((): (FolderHierarchyItem | ListHierarchyItem)[] => {
    const hierarchy: (FolderHierarchyItem | ListHierarchyItem)[] = [];

    // Group lists by folder
    const listsByFolder = new Map<string | null, TaskList[]>();
    apiLists.forEach(list => {
      const key = list.folderId;
      if (!listsByFolder.has(key)) {
        listsByFolder.set(key, []);
      }
      listsByFolder.get(key)!.push(list);
    });

    // Add folders with their lists
    apiFolders.forEach(folder => {
      const folderLists = listsByFolder.get(folder.id) || [];
      hierarchy.push({
        id: folder.id,
        name: folder.name,
        type: "folder" as const,
        color: folder.color,
        isExpanded: expandedFolders.has(folder.id),
        listCount: folder.listCount,
        taskCount: folder.taskCount,
        children: folderLists.map(list => ({
          id: list.id,
          name: list.name,
          type: "list" as const,
          color: list.color,
          taskCount: list.taskCount,
          completedCount: list.completedCount,
          folderId: list.folderId,
        })),
      });
    });

    // Add folderless lists at root level
    const folderlessLists = listsByFolder.get(null) || [];
    folderlessLists.forEach(list => {
      hierarchy.push({
        id: list.id,
        name: list.name,
        type: "list" as const,
        color: list.color,
        taskCount: list.taskCount,
        completedCount: list.completedCount,
        folderId: null,
      });
    });

    return hierarchy;
  }, [apiFolders, apiLists, expandedFolders]);

  // Load projects, folders, lists, and labels on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        setError(null);
        const [projectsData, labelsData] = await Promise.all([
          fetchProjects(userId),
          fetchLabels(userId).catch(() => []),
        ]);
        setProjects(projectsData);
        setLabels(labelsData);
        setUsingLocalProjectsFallback(false);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(projectsData));
        }

        // Select first project and load its folders/lists
        if (projectsData.length > 0) {
          const firstProject = projectsData[0];
          setSelectedProject(firstProject);

          // Load folders and lists for the selected project
          const [foldersData, listsData] = await Promise.all([
            fetchFolders(firstProject.id, userId).catch(() => []),
            fetchLists(firstProject.id, userId).catch(() => []),
          ]);
          setApiFolders(foldersData);
          setApiLists(listsData);

          // Expand all folders by default
          setExpandedFolders(new Set(foldersData.map(f => f.id)));

          // Select first list if available
          if (listsData.length > 0) {
            setSelectedListId(listsData[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load projects:", err);
        let cachedProjects: Project[] = [];
        if (typeof window !== "undefined") {
          try {
            const raw = window.localStorage.getItem(PROJECTS_CACHE_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                cachedProjects = parsed;
              }
            }
          } catch (cacheError) {
            console.warn("Failed to read cached projects:", cacheError);
          }
        }

        const fallbackProjects = cachedProjects.length > 0 ? cachedProjects : [createLocalFallbackProject()];
        setProjects(fallbackProjects);
        setSelectedProject(fallbackProjects[0] ?? null);
        setTasks([]);
        setStatuses([]);
        setApiFolders([]);
        setApiLists([]);
        setSelectedListId(null);
        setUsingLocalProjectsFallback(true);
        setError(null);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, [userId]);

  // Load tasks, statuses, folders, and lists when selected project changes
  useEffect(() => {
    async function loadProjectData() {
      if (!selectedProject) {
        setTasks([]);
        setStatuses([]);
        setApiFolders([]);
        setApiLists([]);
        return;
      }

      if (usingLocalProjectsFallback || selectedProject.id === LOCAL_DEMO_PROJECT_ID) {
        setTasks([]);
        setStatuses([]);
        setApiFolders([]);
        setApiLists([]);
        setLoadingTasks(false);
        return;
      }
      try {
        setLoadingTasks(true);
        const results = await Promise.all([
          fetchProjectTasks(selectedProject.id, userId),
          fetchProjectStatuses(selectedProject.id, userId).catch(() => [] as Status[]),
          fetchFolders(selectedProject.id, userId).catch(() => [] as FolderType[]),
          fetchLists(selectedProject.id, userId).catch(() => [] as TaskList[]),
          fetchSavedFilters(userId, selectedProject.id).catch(() => [] as SavedFilter[]),
          fetchTemplates(userId, selectedProject.id, true).catch(() => [] as TaskTemplate[]),
          fetchMilestones(selectedProject.id).catch(() => [] as Milestone[]),
          fetchCustomFields(selectedProject.id).catch(() => [] as CustomField[]),
        ]);
        const tasksData = results[0];
        const statusesData = results[1];
        const foldersData = results[2];
        const listsData = results[3];
        const filtersData = results[4];
        const templatesData = results[5];
        const milestonesData = results[6];
        const customFieldsData = results[7];
        setTasks(tasksData);
        setStatuses(statusesData);
        setApiFolders(foldersData);
        setApiLists(listsData);
        setSavedFilters(filtersData);
        setTemplates(templatesData);
        setMilestones(milestonesData);
        setCustomFields(customFieldsData);
        // Clear active filter when changing projects
        setActiveFilterId(null);
        setActiveViewId(null);
        setSavedViews([]);
        setSearchQuery("");
        setSelectedMilestoneFilter(null);
        // Expand all folders by default
        setExpandedFolders(new Set(foldersData.map(f => f.id)));
      } catch (err) {
        console.error("Failed to load project data:", err);
        setError("Failed to load tasks. Please try again.");
      } finally {
        setLoadingTasks(false);
      }
    }
    loadProjectData();
  }, [selectedProject?.id, userId, usingLocalProjectsFallback]);

  // Refresh data
  const refreshData = useCallback(async () => {
    if (!selectedProject) return;
    try {
      setLoadingTasks(true);
      const [tasksData, foldersData, listsData] = await Promise.all([
        fetchProjectTasks(selectedProject.id, userId),
        fetchFolders(selectedProject.id, userId).catch(() => []),
        fetchLists(selectedProject.id, userId).catch(() => []),
      ]);
      setTasks(tasksData);
      setApiFolders(foldersData);
      setApiLists(listsData);
    } catch (err) {
      console.error("Failed to refresh tasks:", err);
    } finally {
      setLoadingTasks(false);
    }
  }, [selectedProject, userId]);

  // Theme colors - Street Voices brand with glassmorphism
  const colors = useMemo(
    () => ({
      bg: isDark ? "var(--sb-color-background)" : "var(--sb-color-background)",
      surface: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.25)",
      surfaceHover: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.35)",
      border: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.5)",
      borderHover: isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.7)",
      text: isDark ? "#fff" : "#111",
      textSecondary: isDark ? "rgba(255, 255, 255, 0.7)" : "#4b5563",
      textMuted: isDark ? "rgba(255, 255, 255, 0.5)" : "#6b7280",
      accent: "#FFD600", // Street Voices gold
      accentHover: "#e6c200",
      sidebar: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.2)",
      sidebarHover: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)",
      sidebarActive: isDark ? "rgba(255, 214, 0, 0.15)" : "rgba(255, 214, 0, 0.2)",
      headerBg: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.3)",
      rowHover: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.02)",
      success: "#22c55e",
      warning: "#eab308",
      danger: "#ef4444",
    }),
    [isDark]
  );

  const createLocalTask = useCallback((taskData: CreateTaskPayload): Task => {
    const now = new Date().toISOString();
    const projectTasks = tasks.filter((task) => task.projectId === taskData.project_id);
    const nextPosition = projectTasks.length > 0
      ? Math.max(...projectTasks.map((task) => task.position ?? 0)) + 1
      : 0;

    return {
      id: generateLocalTaskId(),
      projectId: taskData.project_id,
      parentTaskId: taskData.parent_task_id ?? null,
      title: taskData.title,
      description: taskData.description,
      status: taskData.status ?? "todo",
      priority: taskData.priority ?? "none",
      dueAt: taskData.due_at,
      startAt: taskData.start_at,
      completedAt: undefined,
      assignees: taskData.assignees ?? [],
      labels: [],
      createdAt: now,
      updatedAt: now,
      position: nextPosition,
      subtaskCount: 0,
      completedSubtasks: 0,
      commentCount: 0,
      milestoneId: null,
      recurrenceRule: null,
    };
  }, [tasks]);

  const createTaskWithFallback = useCallback(async (taskData: CreateTaskPayload): Promise<Task> => {
    if (isLocalTasksMode || taskData.project_id === LOCAL_DEMO_PROJECT_ID) {
      return createLocalTask(taskData);
    }
    return apiCreateTask(userId, taskData);
  }, [createLocalTask, isLocalTasksMode, userId]);

  // Visible custom fields (sorted by position)
  const visibleCustomFields = useMemo(() => {
    return customFields.filter(f => f.isVisible).sort((a, b) => a.position - b.position);
  }, [customFields]);

  // Dynamic grid template including custom fields
  const gridTemplate = useMemo(() => {
    const base = "40px 1fr 120px 120px 100px";
    const customFieldColumns = visibleCustomFields.map(field => {
      switch (field.width) {
        case "small": return "80px";
        case "large": return "180px";
        default: return "120px"; // medium
      }
    }).join(" ");
    const end = "40px";
    return customFieldColumns ? `${base} ${customFieldColumns} ${end}` : `${base} ${end}`;
  }, [visibleCustomFields]);

  // Subtask grid template (smaller first column)
  const subtaskGridTemplate = useMemo(() => {
    const base = "36px 1fr 120px 120px 100px";
    const customFieldColumns = visibleCustomFields.map(field => {
      switch (field.width) {
        case "small": return "80px";
        case "large": return "180px";
        default: return "120px"; // medium
      }
    }).join(" ");
    const end = "40px";
    return customFieldColumns ? `${base} ${customFieldColumns} ${end}` : `${base} ${end}`;
  }, [visibleCustomFields]);

  // Fetch task field values when tasks or custom fields change
  useEffect(() => {
    async function loadFieldValues() {
      if (visibleCustomFields.length === 0 || tasks.length === 0) return;

      const newValues: Record<string, Record<string, unknown>> = {};

      // Fetch field values for each task (batch would be better, but using what we have)
      await Promise.all(
        tasks.slice(0, 50).map(async (task) => { // Limit to first 50 for performance
          try {
            const values = await getTaskFieldValues(task.id);
            if (Object.keys(values).length > 0) {
              newValues[task.id] = values;
            }
          } catch {
            // Task might not have any field values
          }
        })
      );

      if (Object.keys(newValues).length > 0) {
        setTaskFieldValues(prev => ({ ...prev, ...newValues }));
      }
    }

    loadFieldValues();
  }, [tasks.length, visibleCustomFields.length]);

  // Filter tasks for selected project (top-level only)
  const projectTasks = tasks.filter(
    (t) => t.projectId === selectedProject?.id && !t.parentTaskId
  );

  // Resolve active filter state from either saved filters or saved views
  const activeFilter = useMemo<ActiveFilterState | null>(() => {
    if (activeFilterId) {
      const matchedFilter = savedFilters.find((filter) => filter.id === activeFilterId);
      if (!matchedFilter) {
        return null;
      }
      return {
        name: matchedFilter.name,
        color: matchedFilter.color,
        filters: matchedFilter.filters || {},
      };
    }

    if (activeViewId) {
      const matchedView = savedViews.find((view) => view.id === activeViewId);
      if (!matchedView) {
        return null;
      }
      return {
        name: matchedView.name,
        color: "#6366F1",
        filters: extractSavedViewFilters(matchedView),
      };
    }

    return null;
  }, [activeFilterId, savedFilters, activeViewId, savedViews]);

  // Apply search filter and saved filter criteria
  const filteredTasks = useMemo(() => {
    return projectTasks.filter((task) => {
      // Apply search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = task.title.toLowerCase().includes(query) ||
               task.description?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Apply saved filter criteria
      if (activeFilter?.filters) {
        const f = activeFilter.filters;

        // Status filter
        if (f.status && f.status.length > 0) {
          if (!f.status.includes(task.status)) return false;
        }

        // Priority filter
        if (f.priority && f.priority.length > 0) {
          if (!f.priority.includes(task.priority)) return false;
        }

        // Assignees filter
        if (f.assignees && f.assignees.length > 0) {
          const hasMatchingAssignee = task.assignees.some(a => f.assignees!.includes(a));
          if (!hasMatchingAssignee) return false;
        }

        // Labels filter
        if (f.labels && f.labels.length > 0) {
          const hasMatchingLabel = task.labels.some(l => f.labels!.includes(l));
          if (!hasMatchingLabel) return false;
        }

        // Due date filter
        if (f.dueDate) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const taskDue = task.dueAt ? new Date(task.dueAt) : null;

          if (f.dueDate.type === "overdue") {
            if (!taskDue || taskDue >= today) return false;
          } else if (f.dueDate.type === "today") {
            if (!taskDue) return false;
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            if (taskDue < today || taskDue >= tomorrow) return false;
          } else if (f.dueDate.type === "this_week") {
            if (!taskDue) return false;
            const endOfWeek = new Date(today);
            endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
            if (taskDue < today || taskDue > endOfWeek) return false;
          } else if (f.dueDate.type === "range" && f.dueDate.start && f.dueDate.end) {
            if (!taskDue) return false;
            const start = new Date(f.dueDate.start);
            const end = new Date(f.dueDate.end);
            if (taskDue < start || taskDue > end) return false;
          }
        }
      }

      return true;
    });
  }, [projectTasks, searchQuery, activeFilter]);

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    activeStatuses.forEach((s) => {
      groups[s.id] = [];
    });
    filteredTasks.forEach((task) => {
      if (groups[task.status]) {
        groups[task.status].push(task);
      } else {
        // Put in first status if unknown
        const firstStatus = activeStatuses[0]?.id;
        if (firstStatus && groups[firstStatus]) {
          groups[firstStatus].push(task);
        }
      }
    });
    return groups;
  }, [filteredTasks, activeStatuses]);

  // Toggle folder expansion
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Toggle status group collapse
  const toggleStatusCollapse = (statusId: string) => {
    setCollapsedStatuses(prev => {
      const next = new Set(prev);
      if (next.has(statusId)) {
        next.delete(statusId);
      } else {
        next.add(statusId);
      }
      return next;
    });
  };

  // Select a list
  const selectList = (listId: string) => {
    setSelectedListId(listId);
    setListMenuOpen(null);
  };

  // Create new folder (API-backed)
  const createFolder = async () => {
    if (!newFolderName.trim() || !selectedProject) return;

    try {
      const newFolder = await apiCreateFolder(selectedProject.id, userId, {
        name: newFolderName.trim(),
      });
      setApiFolders(prev => [...prev, newFolder]);
      setExpandedFolders(prev => new Set([...prev, newFolder.id]));
      setNewFolderName("");
      setShowCreateFolder(false);
    } catch (err) {
      console.error("Failed to create folder:", err);
      setError("Failed to create folder.");
    }
  };

  // Delete folder (API-backed)
  const deleteFolder = async (folderId: string) => {
    if (!selectedProject) return;

    try {
      await apiDeleteFolder(selectedProject.id, folderId, true);
      setApiFolders(prev => prev.filter(f => f.id !== folderId));
      // Also remove lists that were in this folder
      setApiLists(prev => prev.filter(l => l.folderId !== folderId));
      setFolderMenuOpen(null);
    } catch (err) {
      console.error("Failed to delete folder:", err);
      setError("Failed to delete folder.");
    }
  };

  // Rename folder (API-backed)
  const renameFolder = async (folderId: string) => {
    if (!editFolderName.trim() || !selectedProject) {
      setEditingFolderId(null);
      setEditFolderName("");
      return;
    }

    try {
      const updatedFolder = await apiUpdateFolder(selectedProject.id, folderId, {
        name: editFolderName.trim(),
      });
      setApiFolders(prev => prev.map(f =>
        f.id === folderId ? updatedFolder : f
      ));
      setEditingFolderId(null);
      setEditFolderName("");
    } catch (err) {
      console.error("Failed to rename folder:", err);
      setError("Failed to rename folder.");
    }
  };

  // Start editing folder name
  const startEditingFolder = (folder: FolderType) => {
    setEditingFolderId(folder.id);
    setEditFolderName(folder.name);
    setFolderMenuOpen(null);
  };

  // Create new list (API-backed)
  const createList = async (folderId?: string | null) => {
    if (!newListName.trim() || !selectedProject) return;

    try {
      const newList = await apiCreateList(selectedProject.id, userId, {
        name: newListName.trim(),
        folderId: folderId || undefined,
      });
      setApiLists(prev => [...prev, newList]);
      setSelectedListId(newList.id);
      setNewListName("");
      setShowCreateList(false);
      setCreateListInFolder(null);
    } catch (err) {
      console.error("Failed to create list:", err);
      setError("Failed to create list.");
    }
  };

  // Delete list (API-backed)
  const deleteList = async (listId: string) => {
    if (!selectedProject) return;

    try {
      await apiDeleteList(selectedProject.id, listId, true);
      setApiLists(prev => prev.filter(l => l.id !== listId));
      // If the deleted list was selected, clear selection
      if (selectedListId === listId) {
        const remainingLists = apiLists.filter(l => l.id !== listId);
        setSelectedListId(remainingLists.length > 0 ? remainingLists[0].id : null);
      }
      setListMenuOpen(null);
    } catch (err) {
      console.error("Failed to delete list:", err);
      setError("Failed to delete list.");
    }
  };

  // Rename list (API-backed)
  const renameList = async (listId: string) => {
    if (!editListName.trim() || !selectedProject) {
      setEditingListId(null);
      setEditListName("");
      return;
    }

    try {
      const updatedList = await apiUpdateList(selectedProject.id, listId, {
        name: editListName.trim(),
      });
      setApiLists(prev => prev.map(l =>
        l.id === listId ? updatedList : l
      ));
      setEditingListId(null);
      setEditListName("");
    } catch (err) {
      console.error("Failed to rename list:", err);
      setError("Failed to rename list.");
    }
  };

  // Start editing list name
  const startEditingList = (list: TaskList) => {
    setEditingListId(list.id);
    setEditListName(list.name);
    setListMenuOpen(null);
  };

  // ============================================================
  // SAVED FILTERS HANDLERS
  // ============================================================

  // Apply a saved filter
  const applyFilter = (filterId: string | null) => {
    setActiveViewId(null);
    setActiveFilterId(filterId);
    const filter = filterId ? savedFilters.find(f => f.id === filterId) : null;
    setSearchQuery(filter?.filters?.search || "");

    // Optionally switch view mode based on filter's viewType
    if (filter?.viewType) {
      const nextViewMode = filter.viewType === "timeline" ? "list" : filter.viewType;
      if ((nextViewMode === "list" || nextViewMode === "board" || nextViewMode === "calendar") && nextViewMode !== viewMode) {
        setViewMode(nextViewMode);
      }
    }
    setFilterMenuOpen(null);
  };

  // Save current search/filter as a saved filter
  const handleSaveFilter = async () => {
    if (!newFilterName.trim() || !selectedProject) return;

    try {
      const filterData: SavedFilterCreateData = {
        name: newFilterName.trim(),
        filters: {
          search: searchQuery || undefined,
        },
        viewType: viewMode === "workload" || viewMode === "gantt" ? "list" : viewMode,
        sortBy: "position",
        sortOrder: "asc",
        projectId: selectedProject.id,
        isPinned: true,
      };

      const newFilter = await createSavedFilter(userId, filterData);
      setSavedFilters(prev => [...prev, newFilter]);
      setNewFilterName("");
      setShowSaveFilterModal(false);
      setActiveViewId(null);
      setActiveFilterId(newFilter.id);
    } catch (err) {
      console.error("Failed to save filter:", err);
      setError("Failed to save filter.");
    }
  };

  // Delete a saved filter
  const handleDeleteFilter = async (filterId: string) => {
    try {
      await deleteSavedFilter(filterId);
      setSavedFilters(prev => prev.filter(f => f.id !== filterId));
      if (activeFilterId === filterId) {
        setActiveFilterId(null);
      }
      setFilterMenuOpen(null);
    } catch (err) {
      console.error("Failed to delete filter:", err);
      setError("Failed to delete filter.");
    }
  };

  // Toggle filter pin status
  const handleToggleFilterPin = async (filterId: string) => {
    const filter = savedFilters.find(f => f.id === filterId);
    if (!filter) return;

    try {
      const updatedFilter = await updateSavedFilter(filterId, {
        isPinned: !filter.isPinned,
      });
      setSavedFilters(prev => prev.map(f =>
        f.id === filterId ? updatedFilter : f
      ));
      setFilterMenuOpen(null);
    } catch (err) {
      console.error("Failed to update filter:", err);
      setError("Failed to update filter.");
    }
  };

  // ============================================================
  // Task Template Handlers
  // ============================================================

  // Apply template to pre-fill task creation
  const handleApplyTemplate = (template: TaskTemplate) => {
    setSelectedTemplate(template);
    setShowTemplateSelector(false);
    // Pre-fill task title from template
    if (template.templateData.title) {
      setNewTaskTitle(template.templateData.title);
    }
    // Track template usage
    useTemplate(template.id).catch(console.error);
  };

  // Create task from template
  const createTaskFromTemplate = async (statusId: string = "todo") => {
    if (!selectedProject || !selectedTemplate) return;

    const templateData = selectedTemplate.templateData;
    try {
      const newTask = await createTaskWithFallback({
        title: newTaskTitle.trim() || templateData.title || "New Task",
        description: templateData.description,
        status: templateData.status || statusId,
        priority: templateData.priority || "none",
        assignees: templateData.assignees || [],
        project_id: selectedProject.id,
      });

      setTasks((prev) => [newTask, ...prev]);
      setNewTaskTitle("");
      setSelectedTemplate(null);
    } catch (err) {
      console.error("Failed to create task from template:", err);
      setError("Failed to create task from template.");
    }
  };

  // Save current task as template
  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim() || !saveAsTemplateTask) return;

    try {
      const templateData: TaskTemplateCreateData = {
        name: newTemplateName.trim(),
        category: newTemplateCategory.trim() || undefined,
        templateData: {
          title: saveAsTemplateTask.title,
          description: saveAsTemplateTask.description,
          status: saveAsTemplateTask.status,
          priority: saveAsTemplateTask.priority,
          labels: saveAsTemplateTask.labels,
          assignees: saveAsTemplateTask.assignees,
        },
        projectId: selectedProject?.id,
      };

      const newTemplate = await createTemplate(userId, templateData);
      setTemplates((prev) => [newTemplate, ...prev]);
      setShowSaveAsTemplate(false);
      setSaveAsTemplateTask(null);
      setNewTemplateName("");
      setNewTemplateCategory("");
    } catch (err) {
      console.error("Failed to save template:", err);
      setError("Failed to save template.");
    }
  };

  // Delete template
  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await deleteTemplate(templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      if (editingTemplate?.id === templateId) {
        setEditingTemplate(null);
      }
    } catch (err) {
      console.error("Failed to delete template:", err);
      setError("Failed to delete template.");
    }
  };

  // Group templates by category
  const templatesByCategory = useMemo(() => {
    const grouped: Record<string, TaskTemplate[]> = { Uncategorized: [] };
    templates.forEach((template) => {
      const category = template.category || "Uncategorized";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(template);
    });
    return grouped;
  }, [templates]);

  // ============================================================
  // Milestone Handlers
  // ============================================================

  // Create new milestone (used by MilestoneManager component)
  const handleCreateMilestoneFromData = async (data: MilestoneCreateData) => {
    if (!selectedProject) return;

    try {
      const newMilestone = await createMilestone(selectedProject.id, userId, data);
      setMilestones((prev) => [...prev, newMilestone]);
    } catch (err) {
      console.error("Failed to create milestone:", err);
      setError("Failed to create milestone.");
    }
  };

  // Update milestone
  const handleUpdateMilestone = async (milestoneId: string, data: Partial<MilestoneCreateData>) => {
    try {
      const updatedMilestone = await updateMilestone(milestoneId, data);
      setMilestones((prev) =>
        prev.map((m) => (m.id === milestoneId ? updatedMilestone : m))
      );
      setEditingMilestone(null);
    } catch (err) {
      console.error("Failed to update milestone:", err);
      setError("Failed to update milestone.");
    }
  };

  // Delete milestone
  const handleDeleteMilestone = async (milestoneId: string) => {
    try {
      await deleteMilestone(milestoneId);
      setMilestones((prev) => prev.filter((m) => m.id !== milestoneId));
      if (selectedMilestoneFilter === milestoneId) {
        setSelectedMilestoneFilter(null);
      }
    } catch (err) {
      console.error("Failed to delete milestone:", err);
      setError("Failed to delete milestone.");
    }
  };

  // Get active (non-completed) milestones
  const activeMilestones = useMemo(() => {
    return milestones.filter((m) => m.status !== "completed" && m.status !== "cancelled");
  }, [milestones]);

  // ============================================================
  // Custom Fields Handlers
  // ============================================================

  // Create custom field
  const handleCreateField = async () => {
    if (!newFieldName.trim() || !selectedProject) return;

    try {
      const fieldData: CustomFieldCreateData = {
        name: newFieldName.trim(),
        fieldType: newFieldType,
      };

      const newField = await createCustomField(selectedProject.id, fieldData);
      setCustomFields((prev) => [...prev, newField]);
      setShowCreateField(false);
      setNewFieldName("");
      setNewFieldType("text");
    } catch (err) {
      console.error("Failed to create custom field:", err);
      setError("Failed to create custom field.");
    }
  };

  // Delete custom field
  const handleDeleteField = async (fieldId: string) => {
    try {
      await deleteCustomField(fieldId);
      setCustomFields((prev) => prev.filter((f) => f.id !== fieldId));
    } catch (err) {
      console.error("Failed to delete custom field:", err);
      setError("Failed to delete custom field.");
    }
  };

  // Update task field value
  const handleSetFieldValue = async (taskId: string, fieldId: string, value: unknown) => {
    try {
      await setTaskFieldValue(taskId, fieldId, value);
      setTaskFieldValues((prev) => ({
        ...prev,
        [taskId]: {
          ...prev[taskId],
          [fieldId]: value,
        },
      }));
    } catch (err) {
      console.error("Failed to update field value:", err);
      setError("Failed to update field value.");
    }
  };

  // ============================================================
  // Task History Handlers
  // ============================================================

  // Load task history
  const loadTaskHistory = async (taskId: string) => {
    setHistoryTaskId(taskId);
    setShowTaskHistory(true);
    setLoadingHistory(true);
    try {
      const history = await fetchTaskHistory(taskId);
      setTaskHistory(history);
    } catch (err) {
      console.error("Failed to load task history:", err);
      setTaskHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Format history change type with icon and color
  const getChangeTypeInfo = (changeType: string): { label: string; icon: React.ReactNode; color: string } => {
    const typeMap: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
      created: { label: "Task created", icon: <Plus size={12} />, color: "#22c55e" },
      status_changed: { label: "Status changed", icon: <Circle size={12} />, color: "#6366f1" },
      priority_changed: { label: "Priority changed", icon: <Flag size={12} />, color: "#f59e0b" },
      title_changed: { label: "Title updated", icon: <Edit3 size={12} />, color: "#8b5cf6" },
      description_changed: { label: "Description updated", icon: <Edit3 size={12} />, color: "#8b5cf6" },
      assignee_added: { label: "Assignee added", icon: <User size={12} />, color: "#22c55e" },
      assignee_removed: { label: "Assignee removed", icon: <User size={12} />, color: "#ef4444" },
      label_added: { label: "Label added", icon: <Tag size={12} />, color: "#22c55e" },
      label_removed: { label: "Label removed", icon: <Tag size={12} />, color: "#ef4444" },
      due_date_changed: { label: "Due date changed", icon: <Calendar size={12} />, color: "#3b82f6" },
      start_date_changed: { label: "Start date changed", icon: <Calendar size={12} />, color: "#3b82f6" },
      completed: { label: "Marked complete", icon: <CheckCircle2 size={12} />, color: "#22c55e" },
      reopened: { label: "Reopened", icon: <RefreshCw size={12} />, color: "#f59e0b" },
      moved: { label: "Moved", icon: <ArrowRight size={12} />, color: "#6366f1" },
      dependency_added: { label: "Dependency added", icon: <GitMerge size={12} />, color: "#6366f1" },
      dependency_removed: { label: "Dependency removed", icon: <GitMerge size={12} />, color: "#ef4444" },
      comment_added: { label: "Comment added", icon: <MessageSquare size={12} />, color: "#3b82f6" },
      attachment_added: { label: "Attachment added", icon: <Paperclip size={12} />, color: "#22c55e" },
      time_tracked: { label: "Time logged", icon: <Clock size={12} />, color: "#8b5cf6" },
    };
    return typeMap[changeType] || {
      label: changeType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
      icon: <History size={12} />,
      color: colors.textMuted
    };
  };

  // Format value for display
  const formatHistoryValue = (value: unknown, fieldName?: string): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "string") {
      // Check if it's a date
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      }
      // Status formatting
      if (fieldName === "status") {
        const status = activeStatuses.find(s => s.id === value);
        return status?.name || value;
      }
      // Priority formatting
      if (fieldName === "priority") {
        return PRIORITIES[value as keyof typeof PRIORITIES]?.label || value;
      }
      return value.length > 50 ? `${value.slice(0, 50)}...` : value;
    }
    if (Array.isArray(value)) return value.join(", ") || "—";
    return String(value);
  };

  // ============================================================
  // Trash Handlers
  // ============================================================

  // Load trashed tasks
  const loadTrashedTasks = async () => {
    if (!selectedProject) return;
    setLoadingTrash(true);
    try {
      const trashed = await fetchTrash(userId, selectedProject.id);
      // Map the API response to Task type
      const mappedTasks: Task[] = trashed.map((t: any) => ({
        id: t.id,
        projectId: t.project_id,
        parentTaskId: t.parent_task_id || null,
        title: t.title,
        description: t.description || "",
        status: t.status || "todo",
        priority: t.priority || "none",
        dueAt: t.due_at,
        startAt: t.start_at,
        completedAt: t.completed_at,
        assignees: t.assignees || [],
        labels: t.labels || [],
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        position: t.position || 0,
        subtaskCount: t.subtask_count || 0,
        completedSubtasks: t.completed_subtasks || t.subtask_completed_count || 0,
        commentCount: t.comment_count || 0,
      }));
      setTrashedTasks(mappedTasks);
      setTrashCount(mappedTasks.length);
    } catch (err) {
      console.error("Failed to load trashed tasks:", err);
      setTrashedTasks([]);
    } finally {
      setLoadingTrash(false);
    }
  };

  // Move task to trash
  const moveToTrash = async (taskId: string) => {
    try {
      await trashTask(taskId, userId);
      // Remove from active tasks list
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setTrashCount(prev => prev + 1);
      setTaskMenuOpen(null);
    } catch (err) {
      console.error("Failed to move task to trash:", err);
    }
  };

  // Restore task from trash
  const restoreFromTrash = async (taskId: string) => {
    try {
      await restoreTask(taskId);
      const restoredTask = trashedTasks.find(t => t.id === taskId);
      if (restoredTask) {
        setTasks(prev => [...prev, restoredTask]);
        setTrashedTasks(prev => prev.filter(t => t.id !== taskId));
        setTrashCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Failed to restore task:", err);
    }
  };

  // Permanently delete task
  const permanentlyDeleteTask = async (taskId: string) => {
    try {
      await apiDeleteTask(taskId, userId);
      setTrashedTasks(prev => prev.filter(t => t.id !== taskId));
      setTrashCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to permanently delete task:", err);
    }
  };

  // Empty trash (delete all)
  const handleEmptyTrash = async () => {
    if (!selectedProject) return;
    if (!confirm("Are you sure you want to permanently delete all trashed tasks? This cannot be undone.")) {
      return;
    }
    try {
      await emptyTrash(userId, selectedProject.id);
      setTrashedTasks([]);
      setTrashCount(0);
    } catch (err) {
      console.error("Failed to empty trash:", err);
    }
  };

  // Open trash view
  const openTrashView = () => {
    setShowTrashView(true);
    loadTrashedTasks();
  };

  // ============================================================
  // Automation Rules Handlers
  // ============================================================

  // Load automation rules
  const loadAutomationRules = async () => {
    if (!selectedProject) return;
    setLoadingRules(true);
    try {
      const rules = await fetchAutomationRules(selectedProject.id);
      setAutomationRules(rules);
    } catch (err) {
      console.error("Failed to load automation rules:", err);
      setAutomationRules([]);
    } finally {
      setLoadingRules(false);
    }
  };

  // Open automation manager
  const openAutomationManager = () => {
    setShowAutomationManager(true);
    loadAutomationRules();
  };

  // Create automation rule (used by AutomationManager component)
  const handleCreateRule = async (data: AutomationRuleCreateData) => {
    if (!selectedProject) return;
    try {
      const created = await createAutomationRule(selectedProject.id, userId, data);
      setAutomationRules(prev => [...prev, created]);
    } catch (err) {
      console.error("Failed to create rule:", err);
    }
  };

  // Update automation rule (used by AutomationManager component)
  const handleUpdateRule = async (ruleId: string, data: Partial<AutomationRuleCreateData>) => {
    try {
      const updated = await updateAutomationRule(ruleId, data);
      setAutomationRules(prev => prev.map(r => r.id === updated.id ? updated : r));
    } catch (err) {
      console.error("Failed to update rule:", err);
    }
  };

  // Toggle rule enabled/disabled
  const toggleRuleEnabled = async (ruleId: string) => {
    const rule = automationRules.find(r => r.id === ruleId);
    if (!rule) return;

    try {
      const updated = await updateAutomationRule(ruleId, { isEnabled: !rule.isEnabled });
      setAutomationRules(prev => prev.map(r => r.id === updated.id ? updated : r));
    } catch (err) {
      console.error("Failed to toggle rule:", err);
    }
  };

  // Delete rule (confirm is handled by AutomationManager component)
  const handleDeleteRule = async (ruleId: string) => {
    try {
      await deleteAutomationRule(ruleId);
      setAutomationRules(prev => prev.filter(r => r.id !== ruleId));
    } catch (err) {
      console.error("Failed to delete rule:", err);
    }
  };

  // ===========================================
  // Time Reports Handlers
  // ===========================================

  const loadTimeReport = async () => {
    if (!selectedProject) return;

    setLoadingReport(true);
    try {
      const report = await fetchTimeReport(userId, {
        projectId: selectedProject.id,
        startDate: reportStartDate || undefined,
        endDate: reportEndDate || undefined,
        groupBy: reportGroupBy,
      });
      setTimeReport(report);
    } catch (err) {
      console.error("Failed to load time report:", err);
    } finally {
      setLoadingReport(false);
    }
  };

  const openTimeReports = () => {
    // Set default date range to last 30 days
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setReportStartDate(start.toISOString().split("T")[0]);
    setReportEndDate(end.toISOString().split("T")[0]);
    setShowTimeReports(true);
  };

  // Trigger report load when modal opens or filters change
  useEffect(() => {
    if (showTimeReports && selectedProject) {
      loadTimeReport();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTimeReports, reportGroupBy, reportStartDate, reportEndDate]);

  // Format seconds to readable time
  const formatReportTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // ===========================================
  // Sprint 3G: Analytics Handlers
  // ===========================================

  const loadAnalytics = async (xAxis?: string) => {
    if (!selectedProject) return;
    setAnalyticsLoading(true);
    try {
      const axis = xAxis || analyticsXAxis;
      const data = await fetchAnalytics(selectedProject.id, userId, axis, "issue_count");
      setAnalyticsData(data);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setAnalyticsData(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const openAnalytics = () => {
    setShowAnalytics(true);
    loadAnalytics();
  };

  useEffect(() => {
    if (showAnalytics && selectedProject) {
      loadAnalytics();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsXAxis]);

  // ===========================================
  // Sprint 3G: Pages Handlers
  // ===========================================

  const loadPages = async () => {
    if (!selectedProject) return;
    setPagesLoading(true);
    try {
      const data = await fetchPages(selectedProject.id, userId);
      setPages(data);
    } catch (err) {
      console.error("Failed to load pages:", err);
      setPages([]);
    } finally {
      setPagesLoading(false);
    }
  };

  const openPages = () => {
    setShowPages(true);
    loadPages();
  };

  const handleCreatePage = async () => {
    if (!selectedProject || !newPageName.trim()) return;
    try {
      const page = await apiCreatePage(selectedProject.id, userId, {
        name: newPageName.trim(),
        description: newPageDescription.trim() || undefined,
      });
      setPages(prev => [...prev, page]);
      setNewPageName("");
      setNewPageDescription("");
      setShowCreatePage(false);
    } catch (err) {
      console.error("Failed to create page:", err);
    }
  };

  const handleUpdatePage = async () => {
    if (!selectedProject || !editingPageId || !editPageName.trim()) return;
    try {
      const updated = await apiUpdatePage(selectedProject.id, editingPageId, userId, {
        name: editPageName.trim(),
        description: editPageDescription.trim() || undefined,
      });
      setPages(prev => prev.map(p => p.id === editingPageId ? updated : p));
      setEditingPageId(null);
      setEditPageName("");
      setEditPageDescription("");
    } catch (err) {
      console.error("Failed to update page:", err);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (!selectedProject) return;
    try {
      await apiDeletePage(selectedProject.id, pageId, userId);
      setPages(prev => prev.filter(p => p.id !== pageId));
    } catch (err) {
      console.error("Failed to delete page:", err);
    }
  };

  // ===========================================
  // Sprint 3G: Views (Saved Filters) Handlers
  // ===========================================

  const loadViews = async () => {
    if (!selectedProject) return;
    setViewsLoading(true);
    try {
      const data = await fetchViews(selectedProject.id, userId);
      setSavedViews((data || []) as SavedView[]);
    } catch (err) {
      console.error("Failed to load views:", err);
      setSavedViews([]);
    } finally {
      setViewsLoading(false);
    }
  };

  const openViews = () => {
    setShowViews(true);
    loadViews();
  };

  const handleCreateView = async () => {
    if (!selectedProject || !newViewName.trim()) return;
    try {
      const activeFilters = activeFilter?.filters || {};
      const filtersPayload: SavedFilter["filters"] = {
        status: activeFilters.status,
        priority: activeFilters.priority,
        assignees: activeFilters.assignees,
        labels: activeFilters.labels,
        dueDate: activeFilters.dueDate,
        search: searchQuery || undefined,
      };

      const view = await apiCreateView(selectedProject.id, userId, {
        name: newViewName.trim(),
        description: newViewDescription.trim() || undefined,
        filters: filtersPayload,
        query_data: {
          filters: filtersPayload,
          view_type: viewMode,
        },
        view_type: viewMode,
      });
      setSavedViews(prev => [...prev, view as SavedView]);
      if (view?.id) {
        setActiveViewId(view.id);
      }
      setActiveFilterId(null);
      setNewViewName("");
      setNewViewDescription("");
      setShowCreateView(false);
    } catch (err) {
      console.error("Failed to create view:", err);
    }
  };

  const handleDeleteView = async (viewId: string) => {
    if (!selectedProject) return;
    try {
      await apiDeleteView(selectedProject.id, viewId, userId);
      setSavedViews(prev => prev.filter(v => v.id !== viewId));
      if (activeViewId === viewId) {
        setActiveViewId(null);
        setSearchQuery("");
      }
    } catch (err) {
      console.error("Failed to delete view:", err);
    }
  };

  const handleApplyView = (view: SavedView) => {
    const viewFilters = extractSavedViewFilters(view);
    const nextViewMode = extractSavedViewMode(view);

    setActiveFilterId(null);
    setActiveViewId(view.id);
    setSearchQuery(viewFilters.search || "");

    if (nextViewMode && nextViewMode !== viewMode) {
      setViewMode(nextViewMode);
    }

    setFilterMenuOpen(null);
    setShowViews(false);
  };

  // ===========================================
  // Export Handlers
  // ===========================================

  const handleExportCsv = async () => {
    if (!selectedProject) return;

    setExporting(true);
    try {
      const csvContent = await exportTasksCsv(selectedProject.id, true);

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${selectedProject.name.replace(/\s+/g, "_")}_tasks.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export CSV:", err);
      setError("Failed to export tasks as CSV");
    } finally {
      setExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleExportJson = async () => {
    if (!selectedProject) return;

    setExporting(true);
    try {
      const tasksData = await exportTasksJson(selectedProject.id, true);

      // Create and download file
      const jsonContent = JSON.stringify(tasksData, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${selectedProject.name.replace(/\s+/g, "_")}_tasks.json`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export JSON:", err);
      setError("Failed to export tasks as JSON");
    } finally {
      setExporting(false);
      setShowExportMenu(false);
    }
  };

  // Import Handler (used by ImportTasksModal component)
  const handleImportTasks = async (csvContent: string): Promise<{
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
  }> => {
    if (!selectedProject) {
      return { success: false, imported: 0, skipped: 0, errors: ["No project selected"] };
    }

    try {
      const parsedTasks = parseTasksCsv(csvContent);
      if (parsedTasks.length === 0) {
        return { success: false, imported: 0, skipped: 0, errors: ["No valid tasks found in CSV"] };
      }

      const result = await importTasks(
        selectedProject.id,
        parsedTasks,
        userId,
        { skipDuplicates: true }
      );

      // Refresh tasks after import
      const updated = await fetchProjectTasks(selectedProject.id, userId);
      setTasks(updated);

      return {
        success: result.status === "success",
        imported: result.importedCount,
        skipped: result.skippedCount,
        errors: result.errors?.map(e => `${e.title}: ${e.error}`) || [],
      };
    } catch (error) {
      console.error("Import failed:", error);
      return {
        success: false,
        imported: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : "Import failed"],
      };
    }
  };

  // ===========================================
  // Task Dependencies Handlers
  // ===========================================

  const DEPENDENCY_TYPES = [
    { value: "finish_to_start", label: "Finish to Start", description: "Task can't start until dependency finishes", icon: "→" },
    { value: "start_to_start", label: "Start to Start", description: "Task can't start until dependency starts", icon: "⇉" },
    { value: "finish_to_finish", label: "Finish to Finish", description: "Task can't finish until dependency finishes", icon: "⇶" },
  ] as const;

  // Load dependencies for a task
  const loadTaskDependencies = async (taskId: string) => {
    try {
      const [deps, dependents] = await Promise.all([
        fetchTaskDependencies(taskId),
        fetchDependentTasks(taskId),
      ]);
      setTaskDependencies(prev => ({ ...prev, [taskId]: deps }));
      setTaskDependents(prev => ({ ...prev, [taskId]: dependents }));
    } catch (err) {
      console.error("Failed to load dependencies:", err);
    }
  };

  // Check which tasks are blocked (for visual indicators)
  const checkBlockedTasks = async () => {
    const blockedSet = new Set<string>();
    for (const task of tasks) {
      try {
        const result = await isTaskBlocked(task.id);
        if (result.isBlocked) {
          blockedSet.add(task.id);
        }
      } catch {
        // Ignore errors for individual task checks
      }
    }
    setBlockedTasks(blockedSet);
  };

  // Load blocked status when tasks change
  useEffect(() => {
    if (tasks.length > 0) {
      checkBlockedTasks();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.length]);

  // Open dependency picker
  const openDependencyPicker = async (task: Task) => {
    setDependencyPickerTask(task);
    setDependencySearch("");
    setSelectedDependencyType("finish_to_start");
    setShowDependencyPicker(true);
    setLoadingDependencies(true);
    await loadTaskDependencies(task.id);
    setLoadingDependencies(false);
  };

  // Add a dependency
  const handleAddDependency = async (dependsOnTaskId: string) => {
    if (!dependencyPickerTask) return;

    try {
      const newDep = await addTaskDependency(
        dependencyPickerTask.id,
        dependsOnTaskId,
        userId,
        selectedDependencyType
      );
      setTaskDependencies(prev => ({
        ...prev,
        [dependencyPickerTask.id]: [...(prev[dependencyPickerTask.id] || []), newDep],
      }));
      // Refresh blocked status
      checkBlockedTasks();
    } catch (err) {
      console.error("Failed to add dependency:", err);
      setError("Failed to add dependency. Check for circular dependencies.");
    }
  };

  // Remove a dependency
  const handleRemoveDependency = async (taskId: string, dependsOnTaskId: string) => {
    try {
      // Save to undo stack before removing
      const deps = taskDependencies[taskId] || [];
      const removedDep = deps.find(d => d.dependsOnTaskId === dependsOnTaskId);
      if (removedDep) {
        setDependencyUndoStack(prev => [...prev, {
          type: "delete",
          taskId,
          dependsOnTaskId,
          dep: removedDep,
          timestamp: Date.now(),
        }]);
        setDependencyRedoStack([]); // Clear redo stack on new action
        setLastActionType("action");
        setShowUndoToast(true);
        setTimeout(() => setShowUndoToast(false), 5000);
      }

      await removeTaskDependency(taskId, dependsOnTaskId, userId);
      setTaskDependencies(prev => ({
        ...prev,
        [taskId]: (prev[taskId] || []).filter(d => d.dependsOnTaskId !== dependsOnTaskId),
      }));
      // Refresh blocked status
      checkBlockedTasks();
    } catch (err) {
      console.error("Failed to remove dependency:", err);
      // Remove from undo stack on error
      setDependencyUndoStack(prev => prev.slice(0, -1));
    }
  };

  // Update a dependency (lag/lead time)
  const handleUpdateDependencyLag = async (taskId: string, dependsOnTaskId: string, lagDays: number) => {
    try {
      // Save previous state to undo stack
      const deps = taskDependencies[taskId] || [];
      const existingDep = deps.find(d => d.dependsOnTaskId === dependsOnTaskId);
      if (existingDep && existingDep.lagDays !== lagDays) {
        setDependencyUndoStack(prev => [...prev, {
          type: "update",
          taskId,
          dependsOnTaskId,
          dep: existingDep,
          previousLagDays: existingDep.lagDays,
          newLagDays: lagDays,
          timestamp: Date.now(),
        }]);
        setDependencyRedoStack([]); // Clear redo stack on new action
        setLastActionType("action");
        setShowUndoToast(true);
        setTimeout(() => setShowUndoToast(false), 5000);
      }

      const updated = await updateTaskDependency(taskId, dependsOnTaskId, userId, { lagDays });
      setTaskDependencies(prev => ({
        ...prev,
        [taskId]: (prev[taskId] || []).map(d =>
          d.dependsOnTaskId === dependsOnTaskId ? { ...d, lagDays: updated.lagDays } : d
        ),
      }));
      setEditingDependency(null);
    } catch (err) {
      console.error("Failed to update dependency:", err);
      // Remove from undo stack on error
      setDependencyUndoStack(prev => prev.slice(0, -1));
    }
  };

  // Get available tasks for dependency picker (exclude self and existing dependencies)
  const availableDependencyTasks = useMemo(() => {
    if (!dependencyPickerTask) return [];
    const existingDepIds = new Set(
      (taskDependencies[dependencyPickerTask.id] || []).map(d => d.dependsOnTaskId)
    );
    return tasks.filter(t =>
      t.id !== dependencyPickerTask.id &&
      !existingDepIds.has(t.id) &&
      t.title.toLowerCase().includes(dependencySearch.toLowerCase())
    );
  }, [dependencyPickerTask, tasks, taskDependencies, dependencySearch]);

  // Calculate critical path - longest chain of dependent tasks
  const criticalPathTaskIds = useMemo(() => {
    if (!showCriticalPath || filteredTasks.length === 0) return new Set<string>();

    // Build task info map with dates and dependencies including lag/lead
    const taskInfo = new Map<string, {
      id: string;
      startDate: Date;
      endDate: Date;
      duration: number;
      dependsOn: { taskId: string; lagDays: number; type: string }[];
      dependents: { taskId: string; lagDays: number; type: string }[];
    }>();

    // Initialize task info
    filteredTasks.forEach(task => {
      const startDate = task.startAt ? new Date(task.startAt) : task.dueAt ? new Date(task.dueAt) : null;
      const endDate = task.dueAt ? new Date(task.dueAt) : startDate;
      if (!startDate || !endDate) return;

      const duration = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1);
      const deps = taskDependencies[task.id] || [];

      taskInfo.set(task.id, {
        id: task.id,
        startDate,
        endDate,
        duration,
        dependsOn: deps
          .filter(d => taskInfo.has(d.dependsOnTaskId) || filteredTasks.some(t => t.id === d.dependsOnTaskId))
          .map(d => ({ taskId: d.dependsOnTaskId, lagDays: d.lagDays, type: d.dependencyType })),
        dependents: [],
      });
    });

    // Build reverse dependency map (who depends on this task)
    taskInfo.forEach((info, taskId) => {
      info.dependsOn.forEach(dep => {
        const depInfo = taskInfo.get(dep.taskId);
        if (depInfo) {
          depInfo.dependents.push({ taskId, lagDays: dep.lagDays, type: dep.type });
        }
      });
    });

    // Calculate earliest start (ES) and earliest finish (EF) using forward pass
    const es = new Map<string, number>(); // Earliest start in days from project start
    const ef = new Map<string, number>(); // Earliest finish in days from project start

    // Find project start date (earliest task start)
    let projectStart = Infinity;
    taskInfo.forEach(info => {
      projectStart = Math.min(projectStart, info.startDate.getTime());
    });

    // Topological sort for forward pass
    const visited = new Set<string>();
    const sorted: string[] = [];

    const topoSort = (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);
      const info = taskInfo.get(taskId);
      if (info) {
        info.dependsOn.forEach(dep => topoSort(dep.taskId));
        sorted.push(taskId);
      }
    };

    taskInfo.forEach((_, taskId) => topoSort(taskId));

    // Forward pass - calculate ES and EF
    sorted.forEach(taskId => {
      const info = taskInfo.get(taskId);
      if (!info) return;

      // ES is max of all predecessor constraint points + lag, or task's actual start
      let earliestStart = Math.floor((info.startDate.getTime() - projectStart) / (24 * 60 * 60 * 1000));

      info.dependsOn.forEach(dep => {
        const depInfo = taskInfo.get(dep.taskId);
        const depEf = ef.get(dep.taskId);
        const depEs = es.get(dep.taskId);
        if (depInfo && depEf !== undefined && depEs !== undefined) {
          // Calculate constraint based on dependency type
          let constraint: number;
          switch (dep.type) {
            case "start_to_start":
              // Task can start when predecessor starts + lag
              constraint = depEs + dep.lagDays;
              break;
            case "finish_to_finish":
              // Task must finish when predecessor finishes + lag, so start = finish - duration
              constraint = depEf + dep.lagDays - info.duration;
              break;
            case "finish_to_start":
            default:
              // Task can start when predecessor finishes + lag
              constraint = depEf + dep.lagDays;
              break;
          }
          earliestStart = Math.max(earliestStart, constraint);
        }
      });

      es.set(taskId, earliestStart);
      ef.set(taskId, earliestStart + info.duration);
    });

    // Find project end (latest EF)
    let projectEnd = 0;
    ef.forEach(finish => {
      projectEnd = Math.max(projectEnd, finish);
    });

    // Backward pass - calculate LS and LF
    const ls = new Map<string, number>(); // Latest start
    const lf = new Map<string, number>(); // Latest finish

    // Process in reverse order
    for (let i = sorted.length - 1; i >= 0; i--) {
      const taskId = sorted[i];
      const info = taskInfo.get(taskId);
      if (!info) continue;

      // LF is min of all successor constraint points - lag, or project end if no successors
      let latestFinish = projectEnd;
      info.dependents.forEach(dep => {
        const depInfo = taskInfo.get(dep.taskId);
        const depLs = ls.get(dep.taskId);
        const depLf = lf.get(dep.taskId);
        if (depInfo && depLs !== undefined && depLf !== undefined) {
          // Calculate constraint based on dependency type
          let constraint: number;
          switch (dep.type) {
            case "start_to_start":
              // This task's start constrains successor's start, so this finish = successor start - lag + this duration
              constraint = depLs - dep.lagDays + info.duration;
              break;
            case "finish_to_finish":
              // This task's finish constrains successor's finish
              constraint = depLf - dep.lagDays;
              break;
            case "finish_to_start":
            default:
              // This task's finish constrains successor's start
              constraint = depLs - dep.lagDays;
              break;
          }
          latestFinish = Math.min(latestFinish, constraint);
        }
      });

      lf.set(taskId, latestFinish);
      ls.set(taskId, latestFinish - info.duration);
    }

    // Tasks on critical path have zero float (ES === LS)
    const criticalTasks = new Set<string>();
    taskInfo.forEach((info, taskId) => {
      const taskEs = es.get(taskId);
      const taskLs = ls.get(taskId);
      if (taskEs !== undefined && taskLs !== undefined) {
        const float = taskLs - taskEs;
        if (float <= 0) {
          criticalTasks.add(taskId);
        }
      }
    });

    // If no critical path found (no dependencies), highlight tasks with latest end dates
    if (criticalTasks.size === 0 && filteredTasks.length > 0) {
      // Find tasks that end at project end
      taskInfo.forEach((info, taskId) => {
        const taskEf = ef.get(taskId);
        if (taskEf !== undefined && taskEf >= projectEnd - 1) {
          criticalTasks.add(taskId);
        }
      });
    }

    return criticalTasks;
  }, [showCriticalPath, filteredTasks, taskDependencies]);

  // ===========================================
  // Gantt Drag-to-Reschedule Handlers
  // ===========================================

  const getColumnWidth = useCallback(() => {
    return ganttZoom === "day" ? 40 : ganttZoom === "week" ? 24 : 12;
  }, [ganttZoom]);

  const handleGanttDragStart = useCallback((
    e: React.MouseEvent,
    task: Task,
    mode: "move" | "resize-start" | "resize-end"
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const startDate = task.startAt ? new Date(task.startAt) : task.dueAt ? new Date(task.dueAt) : null;
    const endDate = task.dueAt ? new Date(task.dueAt) : startDate;

    setDraggingTask({
      taskId: task.id,
      originalStartDate: startDate,
      originalEndDate: endDate,
      dragStartX: e.clientX,
      currentOffsetDays: 0,
      mode,
    });
  }, []);

  const handleGanttDragMove = useCallback((e: MouseEvent) => {
    if (!draggingTask) return;

    const columnWidth = getColumnWidth();
    const deltaX = e.clientX - draggingTask.dragStartX;
    const dayOffset = Math.round(deltaX / columnWidth);

    if (dayOffset !== draggingTask.currentOffsetDays) {
      setDraggingTask(prev => prev ? { ...prev, currentOffsetDays: dayOffset } : null);
    }
  }, [draggingTask, getColumnWidth]);

  const handleGanttDragEnd = useCallback(async () => {
    if (!draggingTask || draggingTask.currentOffsetDays === 0) {
      setDraggingTask(null);
      return;
    }

    const task = tasks.find(t => t.id === draggingTask.taskId);
    if (!task) {
      setDraggingTask(null);
      return;
    }

    const offsetMs = draggingTask.currentOffsetDays * 24 * 60 * 60 * 1000;
    let newStartDate: string | undefined;
    let newDueDate: string | undefined;

    if (draggingTask.mode === "move") {
      // Move both dates
      if (draggingTask.originalStartDate) {
        newStartDate = new Date(draggingTask.originalStartDate.getTime() + offsetMs).toISOString();
      }
      if (draggingTask.originalEndDate) {
        newDueDate = new Date(draggingTask.originalEndDate.getTime() + offsetMs).toISOString();
      }
    } else if (draggingTask.mode === "resize-start" && draggingTask.originalStartDate) {
      // Only change start date
      newStartDate = new Date(draggingTask.originalStartDate.getTime() + offsetMs).toISOString();
      // Ensure start doesn't go past end
      if (draggingTask.originalEndDate && new Date(newStartDate) > draggingTask.originalEndDate) {
        newStartDate = draggingTask.originalEndDate.toISOString();
      }
    } else if (draggingTask.mode === "resize-end" && draggingTask.originalEndDate) {
      // Only change due date
      newDueDate = new Date(draggingTask.originalEndDate.getTime() + offsetMs).toISOString();
      // Ensure end doesn't go before start
      if (draggingTask.originalStartDate && new Date(newDueDate) < draggingTask.originalStartDate) {
        newDueDate = draggingTask.originalStartDate.toISOString();
      }
    }

    // Update the task
    const updates: { start_at?: string; due_at?: string } = {};
    if (newStartDate) updates.start_at = newStartDate;
    if (newDueDate) updates.due_at = newDueDate;

    if (Object.keys(updates).length > 0) {
      // Optimistic update
      setTasks(prev => prev.map(t => {
        if (t.id === draggingTask.taskId) {
          return {
            ...t,
            startAt: newStartDate || t.startAt,
            dueAt: newDueDate || t.dueAt,
          };
        }
        return t;
      }));

      try {
        await apiUpdateTask(draggingTask.taskId, userId, updates);
      } catch (err) {
        console.error("Failed to update task dates:", err);
        // Revert on error
        setTasks(prev => prev.map(t => {
          if (t.id === draggingTask.taskId) {
            return {
              ...t,
              startAt: draggingTask.originalStartDate?.toISOString(),
              dueAt: draggingTask.originalEndDate?.toISOString(),
            };
          }
          return t;
        }));
      }
    }

    setDraggingTask(null);
  }, [draggingTask, tasks, userId]);

  // Global mouse event listeners for drag
  useEffect(() => {
    if (draggingTask) {
      const handleMouseMove = (e: MouseEvent) => handleGanttDragMove(e);
      const handleMouseUp = () => handleGanttDragEnd();

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [draggingTask, handleGanttDragMove, handleGanttDragEnd]);

  // Calculate preview position for dragging task
  const getDragPreviewOffset = useCallback((taskId: string) => {
    if (!draggingTask || draggingTask.taskId !== taskId) return 0;
    return draggingTask.currentOffsetDays * getColumnWidth();
  }, [draggingTask, getColumnWidth]);

  // ===========================================
  // Gantt Click-to-Create Handlers
  // ===========================================

  const handleGanttTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Don't trigger if clicking on a task bar or dragging
    if (draggingTask) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-task-bar]")) return;

    const timeline = ganttTimelineRef.current;
    if (!timeline) return;

    const rect = timeline.getBoundingClientRect();
    const scrollLeft = timeline.scrollLeft;
    const clickX = e.clientX - rect.left + scrollLeft;
    const clickY = e.clientY - rect.top;

    // Calculate which date was clicked
    const columnWidth = getColumnWidth();
    const dayIndex = Math.floor(clickX / columnWidth);
    const clickedDate = new Date(ganttStartDate);
    clickedDate.setDate(clickedDate.getDate() + dayIndex);

    // Show quick-add popover
    setGanttQuickAdd({
      show: true,
      date: clickedDate,
      x: e.clientX,
      y: e.clientY,
    });
    setGanttQuickAddTitle("");
  }, [draggingTask, ganttStartDate, getColumnWidth]);

  const handleGanttQuickAddSubmit = async () => {
    if (!ganttQuickAdd || !ganttQuickAddTitle.trim() || !selectedProject) return;

    const startDate = ganttQuickAdd.date.toISOString();
    const dueDate = new Date(ganttQuickAdd.date);
    dueDate.setDate(dueDate.getDate() + 1); // Default 1 day duration

    try {
      const newTask = await createTaskWithFallback({
        project_id: selectedProject.id,
        title: ganttQuickAddTitle.trim(),
        start_at: startDate,
        due_at: dueDate.toISOString(),
        status: "todo",
        priority: "none",
      });

      setTasks(prev => [...prev, newTask]);
      setGanttQuickAdd(null);
      setGanttQuickAddTitle("");
    } catch (err) {
      console.error("Failed to create task:", err);
      setError("Failed to create task");
    }
  };

  const handleGanttQuickAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGanttQuickAddSubmit();
    } else if (e.key === "Escape") {
      setGanttQuickAdd(null);
    }
  };

  // ===========================================
  // Gantt Drag-to-Create Dependency Handlers
  // ===========================================

  const handleDependencyDragStart = useCallback((
    e: React.MouseEvent,
    task: Task,
    barLeftX: number,
    barRightX: number,
    barCenterY: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const timeline = ganttTimelineRef.current;
    if (!timeline) return;

    const rect = timeline.getBoundingClientRect();
    const scrollLeft = timeline.scrollLeft;
    const scrollTop = timeline.scrollTop;

    // Shift = start-to-start, Ctrl = finish-to-finish, otherwise finish-to-start
    const depType = e.shiftKey ? "start_to_start" : e.ctrlKey || e.metaKey ? "finish_to_finish" : "finish_to_start";
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
  }, []);

  const handleDependencyDragMove = useCallback((e: MouseEvent, barLeftX?: number, barRightX?: number) => {
    if (!dependencyDrag) return;

    const timeline = ganttTimelineRef.current;
    if (!timeline) return;

    const rect = timeline.getBoundingClientRect();
    const scrollLeft = timeline.scrollLeft;
    const scrollTop = timeline.scrollTop;

    // Update dependency type based on modifier keys
    // Shift = start-to-start, Ctrl/Cmd = finish-to-finish, otherwise finish-to-start
    const newDepType = e.shiftKey ? "start_to_start" : e.ctrlKey || e.metaKey ? "finish_to_finish" : "finish_to_start";
    const depTypeChanged = newDepType !== dependencyDrag.dependencyType;

    setDependencyDrag(prev => {
      if (!prev) return null;
      return {
        ...prev,
        currentX: e.clientX - rect.left + scrollLeft,
        currentY: e.clientY - rect.top + scrollTop,
        dependencyType: newDepType,
        // Update startX if type changed and we have the positions
        ...(depTypeChanged && barLeftX !== undefined && barRightX !== undefined
          ? { startX: newDepType === "start_to_start" ? barLeftX : barRightX }
          : {}),
      };
    });
  }, [dependencyDrag]);

  const handleDependencyDragEnd = useCallback(async () => {
    if (!dependencyDrag || !dependencyDrag.targetTaskId) {
      setDependencyDrag(null);
      return;
    }

    const { sourceTaskId, sourceTaskTitle, targetTaskId, dependencyType, currentX, currentY } = dependencyDrag;

    // Don't create self-dependency
    if (sourceTaskId === targetTaskId) {
      setDependencyDrag(null);
      return;
    }

    // Check if dependency already exists
    const existingDeps = taskDependencies[targetTaskId] || [];
    if (existingDeps.some(d => d.dependsOnTaskId === sourceTaskId)) {
      setDependencyDrag(null);
      return;
    }

    // Find target task title
    const targetTask = tasks.find(t => t.id === targetTaskId);
    const targetTaskTitle = targetTask?.title || "Unknown";

    // Show confirmation popover with lag input
    setPendingDependency({
      sourceTaskId,
      targetTaskId,
      sourceTaskTitle,
      targetTaskTitle,
      dependencyType,
      x: currentX,
      y: currentY,
    });
    setPendingLagDays(0);
    setDependencyDrag(null);
  }, [dependencyDrag, taskDependencies, tasks]);

  // Confirm pending dependency creation
  const handleConfirmDependency = useCallback(async () => {
    if (!pendingDependency) return;

    const { sourceTaskId, targetTaskId, dependencyType } = pendingDependency;

    try {
      const newDep = await addTaskDependency(
        targetTaskId,
        sourceTaskId,
        userId,
        dependencyType,
        pendingLagDays
      );
      setTaskDependencies(prev => ({
        ...prev,
        [targetTaskId]: [...(prev[targetTaskId] || []), newDep],
      }));

      // Add to undo stack
      setDependencyUndoStack(prev => [...prev, {
        type: "create",
        taskId: targetTaskId,
        dependsOnTaskId: sourceTaskId,
        dep: newDep,
        timestamp: Date.now(),
      }]);
      setDependencyRedoStack([]); // Clear redo stack on new action
      setLastActionType("action");
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 5000);

      checkBlockedTasks();
    } catch (err) {
      console.error("Failed to create dependency:", err);
      setError("Failed to create dependency. Check for circular dependencies.");
    }

    setPendingDependency(null);
  }, [pendingDependency, pendingLagDays, userId, checkBlockedTasks]);

  // Undo last dependency change
  const handleUndoDependency = useCallback(async () => {
    if (dependencyUndoStack.length === 0) return;

    const lastAction = dependencyUndoStack[dependencyUndoStack.length - 1];
    setDependencyUndoStack(prev => prev.slice(0, -1));

    try {
      switch (lastAction.type) {
        case "create":
          // Undo create = delete the dependency
          await removeTaskDependency(lastAction.taskId, lastAction.dependsOnTaskId, userId);
          setTaskDependencies(prev => ({
            ...prev,
            [lastAction.taskId]: (prev[lastAction.taskId] || []).filter(
              d => d.dependsOnTaskId !== lastAction.dependsOnTaskId
            ),
          }));
          break;

        case "delete":
          // Undo delete = recreate the dependency
          const restoredDep = await addTaskDependency(
            lastAction.taskId,
            lastAction.dependsOnTaskId,
            userId,
            lastAction.dep.dependencyType,
            lastAction.dep.lagDays
          );
          setTaskDependencies(prev => ({
            ...prev,
            [lastAction.taskId]: [...(prev[lastAction.taskId] || []), restoredDep],
          }));
          break;

        case "update":
          // Undo update = restore previous lag value
          if (lastAction.previousLagDays !== undefined) {
            await updateTaskDependency(
              lastAction.taskId,
              lastAction.dependsOnTaskId,
              userId,
              { lagDays: lastAction.previousLagDays }
            );
            setTaskDependencies(prev => ({
              ...prev,
              [lastAction.taskId]: (prev[lastAction.taskId] || []).map(d =>
                d.dependsOnTaskId === lastAction.dependsOnTaskId
                  ? { ...d, lagDays: lastAction.previousLagDays! }
                  : d
              ),
            }));
          }
          break;
      }

      // Push to redo stack
      setDependencyRedoStack(prev => [...prev, lastAction]);
      setLastActionType("undo");
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 5000);
      checkBlockedTasks();
    } catch (err) {
      console.error("Failed to undo dependency change:", err);
      setError("Failed to undo. Please try again.");
    }
  }, [dependencyUndoStack, userId, checkBlockedTasks]);

  // Redo last undone dependency change
  const handleRedoDependency = useCallback(async () => {
    if (dependencyRedoStack.length === 0) return;

    const lastAction = dependencyRedoStack[dependencyRedoStack.length - 1];
    setDependencyRedoStack(prev => prev.slice(0, -1));

    try {
      switch (lastAction.type) {
        case "create":
          // Redo create = recreate the dependency
          const newDep = await addTaskDependency(
            lastAction.taskId,
            lastAction.dependsOnTaskId,
            userId,
            lastAction.dep.dependencyType,
            lastAction.dep.lagDays
          );
          setTaskDependencies(prev => ({
            ...prev,
            [lastAction.taskId]: [...(prev[lastAction.taskId] || []), newDep],
          }));
          break;

        case "delete":
          // Redo delete = delete the dependency again
          await removeTaskDependency(lastAction.taskId, lastAction.dependsOnTaskId, userId);
          setTaskDependencies(prev => ({
            ...prev,
            [lastAction.taskId]: (prev[lastAction.taskId] || []).filter(
              d => d.dependsOnTaskId !== lastAction.dependsOnTaskId
            ),
          }));
          break;

        case "update":
          // Redo update = apply the new lag value
          if (lastAction.newLagDays !== undefined) {
            await updateTaskDependency(
              lastAction.taskId,
              lastAction.dependsOnTaskId,
              userId,
              { lagDays: lastAction.newLagDays }
            );
            setTaskDependencies(prev => ({
              ...prev,
              [lastAction.taskId]: (prev[lastAction.taskId] || []).map(d =>
                d.dependsOnTaskId === lastAction.dependsOnTaskId
                  ? { ...d, lagDays: lastAction.newLagDays! }
                  : d
              ),
            }));
          }
          break;
      }

      // Push back to undo stack
      setDependencyUndoStack(prev => [...prev, lastAction]);
      setLastActionType("redo");
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 5000);
      checkBlockedTasks();
    } catch (err) {
      console.error("Failed to redo dependency change:", err);
      setError("Failed to redo. Please try again.");
    }
  }, [dependencyRedoStack, userId, checkBlockedTasks]);

  // Undo schedule changes (auto-schedule)
  const handleUndoSchedule = useCallback(async () => {
    if (scheduleUndoStack.length === 0) return;

    const lastAction = scheduleUndoStack[scheduleUndoStack.length - 1];
    setScheduleUndoStack(prev => prev.slice(0, -1));

    try {
      // Restore all previous dates
      const updates = lastAction.changes.map(change =>
        apiUpdateTask(change.taskId, userId, {
          start_at: change.previousStartAt ?? undefined,
          due_at: change.previousDueAt ?? undefined,
        }).then(() => {
          setTasks(prev => prev.map(t =>
            t.id === change.taskId
              ? { ...t, startAt: change.previousStartAt ?? undefined, dueAt: change.previousDueAt ?? undefined }
              : t
          ));
        })
      );

      await Promise.all(updates);

      // Push to redo stack
      setScheduleRedoStack(prev => [...prev, lastAction]);
      setLastActionType("undo");
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 5000);
    } catch (err) {
      console.error("Failed to undo schedule change:", err);
      setError("Failed to undo. Please try again.");
    }
  }, [scheduleUndoStack, userId]);

  // Redo schedule changes
  const handleRedoSchedule = useCallback(async () => {
    if (scheduleRedoStack.length === 0) return;

    const lastAction = scheduleRedoStack[scheduleRedoStack.length - 1];
    setScheduleRedoStack(prev => prev.slice(0, -1));

    try {
      // Re-apply all new dates
      const updates = lastAction.changes.map(change =>
        apiUpdateTask(change.taskId, userId, {
          start_at: change.newStartAt,
          due_at: change.newDueAt,
        }).then(() => {
          setTasks(prev => prev.map(t =>
            t.id === change.taskId
              ? { ...t, startAt: change.newStartAt, dueAt: change.newDueAt }
              : t
          ));
        })
      );

      await Promise.all(updates);

      // Push back to undo stack
      setScheduleUndoStack(prev => [...prev, lastAction]);
      setLastActionType("redo");
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 5000);
    } catch (err) {
      console.error("Failed to redo schedule change:", err);
      setError("Failed to redo. Please try again.");
    }
  }, [scheduleRedoStack, userId]);

  // Combined undo handler (handles both dependency and schedule changes)
  const handleUndo = useCallback(() => {
    // Undo the most recent action (compare timestamps)
    const depTimestamp = dependencyUndoStack.length > 0
      ? dependencyUndoStack[dependencyUndoStack.length - 1].timestamp
      : 0;
    const schedTimestamp = scheduleUndoStack.length > 0
      ? scheduleUndoStack[scheduleUndoStack.length - 1].timestamp
      : 0;

    if (schedTimestamp > depTimestamp) {
      handleUndoSchedule();
    } else if (depTimestamp > 0) {
      handleUndoDependency();
    }
  }, [dependencyUndoStack, scheduleUndoStack, handleUndoDependency, handleUndoSchedule]);

  // Combined redo handler
  const handleRedo = useCallback(() => {
    // Redo the most recent undone action
    const depTimestamp = dependencyRedoStack.length > 0
      ? dependencyRedoStack[dependencyRedoStack.length - 1].timestamp
      : 0;
    const schedTimestamp = scheduleRedoStack.length > 0
      ? scheduleRedoStack[scheduleRedoStack.length - 1].timestamp
      : 0;

    if (schedTimestamp > depTimestamp) {
      handleRedoSchedule();
    } else if (depTimestamp > 0) {
      handleRedoDependency();
    }
  }, [dependencyRedoStack, scheduleRedoStack, handleRedoDependency, handleRedoSchedule]);

  // Keyboard shortcuts for undo/redo (Ctrl+Z / Ctrl+Shift+Z in Gantt view)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && viewMode === "gantt") {
        const hasUndo = dependencyUndoStack.length > 0 || scheduleUndoStack.length > 0;
        const hasRedo = dependencyRedoStack.length > 0 || scheduleRedoStack.length > 0;

        if (e.shiftKey) {
          // Redo
          if (hasRedo) {
            e.preventDefault();
            handleRedo();
          }
        } else {
          // Undo
          if (hasUndo) {
            e.preventDefault();
            handleUndo();
          }
        }
      }
      // Also support Ctrl+Y for redo
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

  // Auto-schedule state
  const [isAutoScheduling, setIsAutoScheduling] = useState(false);

  // Auto-schedule tasks based on dependencies
  const handleAutoSchedule = useCallback(async () => {
    if (filteredTasks.length === 0) return;

    setIsAutoScheduling(true);

    try {
      // Build task info map
      const taskInfo = new Map<string, {
        id: string;
        title: string;
        startDate: Date | null;
        endDate: Date | null;
        duration: number;
        deps: Array<{ taskId: string; lagDays: number; type: string }>;
      }>();

      // Initialize task info
      filteredTasks.forEach(task => {
        const startDate = task.startAt ? new Date(task.startAt) : null;
        const endDate = task.dueAt ? new Date(task.dueAt) : null;
        const duration = startDate && endDate
          ? Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1)
          : 1;
        const deps = (taskDependencies[task.id] || []).map(d => ({
          taskId: d.dependsOnTaskId,
          lagDays: d.lagDays,
          type: d.dependencyType,
        }));

        taskInfo.set(task.id, {
          id: task.id,
          title: task.title,
          startDate,
          endDate,
          duration,
          deps,
        });
      });

      // Topological sort to process tasks in dependency order
      const visited = new Set<string>();
      const sorted: string[] = [];

      const topoSort = (taskId: string) => {
        if (visited.has(taskId)) return;
        visited.add(taskId);
        const info = taskInfo.get(taskId);
        if (info) {
          info.deps.forEach(dep => {
            if (taskInfo.has(dep.taskId)) {
              topoSort(dep.taskId);
            }
          });
          sorted.push(taskId);
        }
      };

      taskInfo.forEach((_, taskId) => topoSort(taskId));

      // Calculate new dates based on dependencies
      const newDates = new Map<string, { startAt: Date; dueAt: Date }>();

      sorted.forEach(taskId => {
        const info = taskInfo.get(taskId);
        if (!info) return;

        let earliestStart: Date | null = null;
        let earliestEnd: Date | null = null;

        // Check all dependencies to find earliest possible start
        info.deps.forEach(dep => {
          const depInfo = taskInfo.get(dep.taskId);
          if (!depInfo) return;

          // Get predecessor dates (use calculated dates if available)
          const predDates = newDates.get(dep.taskId);
          const predStart = predDates?.startAt || depInfo.startDate;
          const predEnd = predDates?.dueAt || depInfo.endDate;

          if (!predStart || !predEnd) return;

          let constraintDate: Date;

          switch (dep.type) {
            case "start_to_start":
              // Task can start when predecessor starts + lag
              constraintDate = new Date(predStart.getTime() + dep.lagDays * 24 * 60 * 60 * 1000);
              if (!earliestStart || constraintDate > earliestStart) {
                earliestStart = constraintDate;
              }
              break;

            case "finish_to_finish":
              // Task must finish when predecessor finishes + lag
              // So task start = predecessor finish + lag - task duration
              constraintDate = new Date(predEnd.getTime() + dep.lagDays * 24 * 60 * 60 * 1000);
              if (!earliestEnd || constraintDate > earliestEnd) {
                earliestEnd = constraintDate;
              }
              break;

            case "finish_to_start":
            default:
              // Task can start when predecessor finishes + lag
              constraintDate = new Date(predEnd.getTime() + (dep.lagDays + 1) * 24 * 60 * 60 * 1000);
              if (!earliestStart || constraintDate > earliestStart) {
                earliestStart = constraintDate;
              }
              break;
          }
        });

        // Skip locked tasks - they keep their current dates but are still used as constraints
        if (lockedTaskIds.has(taskId)) {
          if (info.startDate && info.endDate) {
            newDates.set(taskId, { startAt: info.startDate, dueAt: info.endDate });
          }
          return;
        }

        // Calculate new dates
        if (earliestStart !== null) {
          const newStart = earliestStart as Date;
          const newEnd = new Date(newStart.getTime() + (info.duration - 1) * 24 * 60 * 60 * 1000);
          newDates.set(taskId, { startAt: newStart, dueAt: newEnd });
        } else if (earliestEnd !== null) {
          const newEnd = earliestEnd as Date;
          const newStart = new Date(newEnd.getTime() - (info.duration - 1) * 24 * 60 * 60 * 1000);
          newDates.set(taskId, { startAt: newStart, dueAt: newEnd });
        } else if (info.startDate && info.endDate) {
          // No dependencies, keep existing dates
          newDates.set(taskId, { startAt: info.startDate, dueAt: info.endDate });
        }
      });

      // Collect changes and apply new dates
      const updates: Promise<void>[] = [];
      const scheduleChanges: ScheduleAction["changes"] = [];

      newDates.forEach((dates, taskId) => {
        const info = taskInfo.get(taskId);
        if (!info) return;

        const currentStart = info.startDate?.toDateString();
        const currentEnd = info.endDate?.toDateString();
        const newStart = dates.startAt.toDateString();
        const newEnd = dates.dueAt.toDateString();

        // Only update if dates changed
        if (currentStart !== newStart || currentEnd !== newEnd) {
          const newStartAt = dates.startAt.toISOString();
          const newDueAt = dates.dueAt.toISOString();

          // Track change for undo
          scheduleChanges.push({
            taskId,
            previousStartAt: info.startDate?.toISOString() || null,
            previousDueAt: info.endDate?.toISOString() || null,
            newStartAt,
            newDueAt,
          });

          updates.push(
            apiUpdateTask(taskId, userId, {
              start_at: newStartAt,
              due_at: newDueAt,
            }).then(() => {
              // Update local state
              setTasks(prev => prev.map(t =>
                t.id === taskId
                  ? { ...t, startAt: newStartAt, dueAt: newDueAt }
                  : t
              ));
            })
          );
        }
      });

      await Promise.all(updates);

      if (scheduleChanges.length > 0) {
        // Push to undo stack
        setScheduleUndoStack(prev => [...prev, {
          type: "auto-schedule",
          changes: scheduleChanges,
          timestamp: Date.now(),
        }]);
        setScheduleRedoStack([]); // Clear redo stack on new action

        setError(null);
        setShowUndoToast(true);
        setLastActionType("schedule");
        setTimeout(() => setShowUndoToast(false), 5000);
      }
    } catch (err) {
      console.error("Failed to auto-schedule tasks:", err);
      setError("Failed to auto-schedule tasks. Please try again.");
    } finally {
      setIsAutoScheduling(false);
    }
  }, [filteredTasks, taskDependencies, userId, lockedTaskIds]);

  // Mouse event listeners for dependency drag
  useEffect(() => {
    if (dependencyDrag) {
      const handleMouseMove = (e: MouseEvent) => handleDependencyDragMove(e);
      const handleMouseUp = () => handleDependencyDragEnd();

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dependencyDrag, handleDependencyDragMove, handleDependencyDragEnd]);

  // Toggle task completion
  const toggleTaskComplete = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const isDone = task.status === "done";
    const newStatus = isDone ? "todo" : "done";
    const completedAt = isDone ? undefined : new Date().toISOString();

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: newStatus, completedAt } : t
      )
    );

    try {
      await apiUpdateTask(taskId, userId, {
        status: newStatus,
        completed_at: completedAt,
      }, selectedProject?.id);
    } catch (err) {
      console.error("Failed to update task:", err);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: task.status, completedAt: task.completedAt } : t
        )
      );
    }
  };

  // Create task in specific status
  const createTaskInStatus = async (statusId: string) => {
    if (!newTaskTitle.trim() || !selectedProject) return;

    const title = newTaskTitle.trim();
    setNewTaskTitle("");
    setAddingTaskInStatus(null);

    try {
      const newTask = await createTaskWithFallback({
        project_id: selectedProject.id,
        title,
        status: statusId,
        priority: "none",
      });
      setTasks((prev) => [...prev, newTask]);
    } catch (err) {
      console.error("Failed to create task:", err);
      setError("Failed to create task.");
    }
  };

  // Create new project
  const createProject = async () => {
    if (!newProjectName.trim()) return;

    const name = newProjectName.trim();
    setNewProjectName("");
    setShowCreateProject(false);

    try {
      const newProject = await apiCreateProject(userId, { name, color: newProjectColor });
      setProjects((prev) => [...prev, newProject]);
      setSelectedProject(newProject);
      setSelectedListId(newProject.id);
    } catch (err) {
      console.error("Failed to create project:", err);
      setError("Failed to create project.");
    }
  };

  // Delete task
  const deleteTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      await apiDeleteTask(taskId, userId, selectedProject?.id);
    } catch (err) {
      console.error("Failed to delete task:", err);
      setTasks((prev) => [...prev, task]);
    }
  };

  // Toggle task expansion (for subtasks)
  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Start adding subtask
  const startAddingSubtask = (parentTaskId: string) => {
    setAddingSubtaskTo(parentTaskId);
    setNewSubtaskTitle("");
    // Auto-expand the parent task
    setExpandedTasks(prev => new Set([...prev, parentTaskId]));
  };

  // Create subtask
  const createSubtask = async (parentTaskId: string) => {
    if (!newSubtaskTitle.trim() || !selectedProject) return;

    const title = newSubtaskTitle.trim();
    const parentTask = tasks.find(t => t.id === parentTaskId);
    if (!parentTask) return;

    setNewSubtaskTitle("");
    setAddingSubtaskTo(null);

    try {
      const newSubtask = await createTaskWithFallback({
        project_id: selectedProject.id,
        parent_task_id: parentTaskId,
        title,
        status: parentTask.status,
        priority: "none",
      });

      // Add subtask to tasks list
      setTasks(prev => [...prev, newSubtask]);

      // Update parent task's subtask count
      setTasks(prev => prev.map(t =>
        t.id === parentTaskId
          ? { ...t, subtaskCount: t.subtaskCount + 1 }
          : t
      ));
    } catch (err) {
      console.error("Failed to create subtask:", err);
      setError("Failed to create subtask.");
    }
  };

  // Get subtasks for a task
  const getSubtasks = (parentTaskId: string): Task[] => {
    return tasks.filter(t => t.parentTaskId === parentTaskId);
  };

  // Quick add task from sidebar
  const quickAddTaskInList = async () => {
    if (!quickTaskTitle.trim() || !selectedProject) return;
    const title = quickTaskTitle.trim();
    setQuickTaskTitle("");
    setAddingTaskInList(null);
    try {
      const newTask = await createTaskWithFallback({
        project_id: selectedProject.id,
        title,
        status: "todo",
        priority: "none",
      });
      setTasks(prev => [...prev, newTask]);
    } catch (err) {
      console.error("Failed to create task:", err);
      setError("Failed to create task.");
    }
  };

  // Create subtask from sidebar mini-tree
  const createSidebarSubtask = async (parentTaskId: string) => {
    if (!sidebarSubtaskTitle.trim() || !selectedProject) return;
    const title = sidebarSubtaskTitle.trim();
    const parentTask = tasks.find(t => t.id === parentTaskId);
    if (!parentTask) return;
    setSidebarSubtaskTitle("");
    setAddingSidebarSubtask(null);
    try {
      const newSubtask = await createTaskWithFallback({
        project_id: selectedProject.id,
        parent_task_id: parentTaskId,
        title,
        status: parentTask.status,
        priority: "none",
      });
      setTasks(prev => [...prev, newSubtask]);
      setTasks(prev => prev.map(t =>
        t.id === parentTaskId ? { ...t, subtaskCount: t.subtaskCount + 1 } : t
      ));
    } catch (err) {
      console.error("Failed to create subtask:", err);
      setError("Failed to create subtask.");
    }
  };

  // Start editing task
  const startEditingTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
  };

  // Save task edit
  const saveTaskEdit = async () => {
    if (!editingTaskId || !editTaskTitle.trim()) {
      setEditingTaskId(null);
      setEditTaskTitle("");
      return;
    }

    const newTitle = editTaskTitle.trim();
    const taskId = editingTaskId;
    setEditingTaskId(null);
    setEditTaskTitle("");

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, title: newTitle } : t))
    );

    try {
      await apiUpdateTask(taskId, userId, { title: newTitle }, selectedProject?.id);
    } catch (err) {
      console.error("Failed to update task:", err);
    }
  };

  // Close all popovers
  const closeAllPopovers = () => {
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
    setNewLabelName("");
    setNewCommentText("");
    setTaskComments([]);
  };

  // Helper function to update a task (used by views and bulk actions)
  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      // Optimistic update
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));

      // Convert Task updates to API format
      const apiUpdates: Record<string, unknown> = {};
      if (updates.status !== undefined) apiUpdates.status = updates.status;
      if (updates.priority !== undefined) apiUpdates.priority = updates.priority;
      if (updates.assignees !== undefined) apiUpdates.assignees = updates.assignees;
      if (updates.dueAt !== undefined) apiUpdates.due_at = updates.dueAt;
      if (updates.title !== undefined) apiUpdates.title = updates.title;

      await apiUpdateTask(taskId, userId, apiUpdates, selectedProject?.id);
    } catch (err) {
      console.error("Failed to update task:", err);
      // Revert on error
      if (selectedProject) {
        const freshTasks = await fetchProjectTasks(selectedProject.id, userId);
        setTasks(freshTasks);
      }
    }
  };

  // Helper function to delete a task
  const handleDeleteTask = async (taskId: string) => {
    try {
      // Optimistic removal
      setTasks(prev => prev.filter(t => t.id !== taskId));
      await apiDeleteTask(taskId, userId, selectedProject?.id);
    } catch (err) {
      console.error("Failed to delete task:", err);
      // Revert on error
      if (selectedProject) {
        const freshTasks = await fetchProjectTasks(selectedProject.id, userId);
        setTasks(freshTasks);
      }
    }
  };

  // Helper function to archive (soft delete) a task
  const handleArchiveTask = async (taskId: string) => {
    try {
      // Optimistic removal from view
      setTasks(prev => prev.filter(t => t.id !== taskId));
      await trashTask(taskId, userId);
    } catch (err) {
      console.error("Failed to archive task:", err);
      // Revert on error
      if (selectedProject) {
        const freshTasks = await fetchProjectTasks(selectedProject.id, userId);
        setTasks(freshTasks);
      }
    }
  };

  // List view drag-to-reorder handlers
  const handleListDragStart = (e: React.DragEvent, task: Task, statusId: string, index: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
    // Set drag image with slight offset for better visual
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
  };

  const handleListDragOver = (e: React.DragEvent, statusId: string, index: number, position: "before" | "after") => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (listDragState) {
      // Only update if changed to avoid excessive re-renders
      if (listDragState.overStatus !== statusId || listDragState.overIndex !== index || listDragState.overPosition !== position) {
        setListDragState(prev => prev ? {
          ...prev,
          overStatus: statusId,
          overIndex: index,
          overPosition: position,
        } : null);
      }
    }
  };

  const handleListDragEnd = () => {
    setListDragState(null);
  };

  const handleListDrop = async (e: React.DragEvent, targetStatusId: string, targetIndex: number, position: "before" | "after") => {
    e.preventDefault();
    if (!listDragState || !selectedProject) {
      setListDragState(null);
      return;
    }

    const taskId = listDragState.taskId;
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      setListDragState(null);
      return;
    }

    // Get tasks in target status (excluding the dragged task)
    const targetStatusTasks = tasks
      .filter(t => t.status === targetStatusId && !t.parentTaskId && t.id !== taskId)
      .sort((a, b) => a.position - b.position);

    // Calculate new position
    let newPosition: number;
    if (targetStatusTasks.length === 0) {
      newPosition = 0;
    } else if (targetIndex >= targetStatusTasks.length) {
      // Dropping at the end
      newPosition = targetStatusTasks[targetStatusTasks.length - 1].position + 1000;
    } else {
      const targetTask = targetStatusTasks[targetIndex];
      if (position === "before") {
        const prevTask = targetIndex > 0 ? targetStatusTasks[targetIndex - 1] : null;
        newPosition = prevTask
          ? Math.floor((prevTask.position + targetTask.position) / 2)
          : targetTask.position - 1000;
      } else {
        const nextTask = targetIndex < targetStatusTasks.length - 1 ? targetStatusTasks[targetIndex + 1] : null;
        newPosition = nextTask
          ? Math.floor((targetTask.position + nextTask.position) / 2)
          : targetTask.position + 1000;
      }
    }

    // Optimistic update
    const updatedTask = {
      ...task,
      status: targetStatusId,
      position: newPosition,
    };
    setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
    setListDragState(null);

    try {
      // Call moveTask API
      await moveTask(taskId, {
        project_id: selectedProject.id,
        new_position: newPosition,
      });

      // Also update status if it changed
      if (task.status !== targetStatusId) {
        await apiUpdateTask(taskId, userId, { status: targetStatusId }, selectedProject?.id);
      }
    } catch (err) {
      console.error("Failed to move task:", err);
      // Revert on error
      const freshTasks = await fetchProjectTasks(selectedProject.id, userId);
      setTasks(freshTasks);
    }
  };

  // Wire up keyboard shortcuts
  useTaskKeyboardShortcuts({
    onNewTask: () => setAddingTaskInStatus(activeStatuses[0]?.id || "todo"),
    onSearch: () => {
      const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
      searchInput?.focus();
    },
    onDelete: async () => {
      if (selectedTaskIds.size > 0) {
        await Promise.all(Array.from(selectedTaskIds).map(id => apiDeleteTask(id, userId)));
        setTasks(prev => prev.filter(t => !selectedTaskIds.has(t.id)));
        setSelectedTaskIds(new Set());
      }
    },
    onComplete: async () => {
      if (selectedTaskIds.size > 0) {
        const doneStatus = activeStatuses.find(s => s.category === "done")?.id || "done";
        await Promise.all(Array.from(selectedTaskIds).map(id =>
          apiUpdateTask(id, userId, { status: doneStatus })
        ));
        setTasks(prev => prev.map(t =>
          selectedTaskIds.has(t.id) ? { ...t, status: doneStatus } : t
        ));
        setSelectedTaskIds(new Set());
      }
    },
    onEscape: () => {
      setSelectedTaskIds(new Set());
      setEditingTaskId(null);
      setAddingTaskInStatus(null);
      closeAllPopovers();
    },
    onSelectAll: () => {
      setSelectedTaskIds(new Set(tasks.map(t => t.id)));
    },
    onViewList: () => setViewMode("list"),
    onViewBoard: () => setViewMode("board"),
    onViewCalendar: () => setViewMode("calendar"),
    onNextTask: () => {
      if (tasks.length > 0) {
        setFocusedTaskIndex(prev => Math.min(prev + 1, tasks.length - 1));
      }
    },
    onPrevTask: () => {
      if (tasks.length > 0) {
        setFocusedTaskIndex(prev => Math.max(prev - 1, 0));
      }
    },
    onCollapseAll: () => setCollapsedStatuses(new Set(activeStatuses.map(s => s.id))),
    onRefresh: async () => {
      if (selectedProject) {
        setLoadingTasks(true);
        const freshTasks = await fetchProjectTasks(selectedProject.id, userId);
        setTasks(freshTasks);
        setLoadingTasks(false);
      }
    },
    onHelp: () => setShowKeyboardShortcuts(true),
    enabled: true,
  });

  // Update task assignee
  const updateTaskAssignee = async (taskId: string, assigneeId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newAssignees = task.assignees.includes(assigneeId)
      ? task.assignees.filter(a => a !== assigneeId)
      : [...task.assignees, assigneeId];

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, assignees: newAssignees } : t));
    closeAllPopovers();

    try {
      await apiUpdateTask(taskId, userId, { assignees: newAssignees });
    } catch (err) {
      console.error("Failed to update assignee:", err);
    }
  };

  // Update task due date
  const updateTaskDueDate = async (taskId: string, dueAt: string | null) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, dueAt: dueAt || undefined } : t));
    closeAllPopovers();

    try {
      await apiUpdateTask(taskId, userId, { due_at: dueAt ?? undefined });
    } catch (err) {
      console.error("Failed to update due date:", err);
    }
  };

  // Update task priority
  const updateTaskPriority = async (taskId: string, priority: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority } : t));
    closeAllPopovers();

    try {
      await apiUpdateTask(taskId, userId, { priority });
    } catch (err) {
      console.error("Failed to update priority:", err);
    }
  };

  // Toggle label on task
  const toggleTaskLabel = async (taskId: string, labelId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newLabels = task.labels.includes(labelId)
      ? task.labels.filter(l => l !== labelId)
      : [...task.labels, labelId];

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, labels: newLabels } : t));

    try {
      await apiUpdateTask(taskId, userId, { labels: newLabels });
    } catch (err) {
      console.error("Failed to update labels:", err);
    }
  };

  // Create new label
  const createNewLabel = async () => {
    if (!newLabelName.trim()) return;

    try {
      const newLabel = await apiCreateLabel(userId, {
        name: newLabelName.trim(),
        color: newLabelColor,
      });
      setLabels(prev => [...prev, newLabel]);
      setNewLabelName("");
      setNewLabelColor("#FFD600");
    } catch (err) {
      console.error("Failed to create label:", err);
    }
  };

  // Delete label
  const deleteLabel = async (labelId: string) => {
    try {
      await apiDeleteLabel(labelId);
      setLabels(prev => prev.filter(l => l.id !== labelId));
      // Remove label from all tasks that have it
      setTasks(prev => prev.map(t => ({
        ...t,
        labels: t.labels.filter(l => l !== labelId)
      })));
    } catch (err) {
      console.error("Failed to delete label:", err);
    }
  };

  // Predefined label colors
  const LABEL_COLORS = [
    "#FFD600", // Gold (Street Voices)
    "#ef4444", // Red
    "#f97316", // Orange
    "#eab308", // Yellow
    "#22c55e", // Green
    "#14b8a6", // Teal
    "#3b82f6", // Blue
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#6b7280", // Gray
  ];

  // Open comments popover and load comments
  const openCommentsPopover = async (taskId: string, position: { top: number; left: number }) => {
    setCommentsPopover({ taskId, position });
    setAssigneePopover(null);
    setDueDatePopover(null);
    setPriorityPopover(null);
    setTagsPopover(null);
    setLoadingComments(true);
    setTaskComments([]);

    try {
      const comments = await fetchComments(taskId);
      setTaskComments(comments);
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setLoadingComments(false);
    }
  };

  // Create new comment
  const createComment = async () => {
    if (!newCommentText.trim() || !commentsPopover) return;

    const taskId = commentsPopover.taskId;
    const body = newCommentText.trim();
    setNewCommentText("");

    try {
      const newComment = await apiCreateComment(taskId, {
        user_id: userId,
        body,
      });
      setTaskComments(prev => [...prev, newComment]);
      // Update comment count on the task
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, commentCount: t.commentCount + 1 } : t
      ));
    } catch (err) {
      console.error("Failed to create comment:", err);
      setNewCommentText(body); // Restore the text on error
    }
  };

  // Format relative time for comments
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Get quick date options
  const getQuickDateOptions = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const twoWeeks = new Date(today);
    twoWeeks.setDate(twoWeeks.getDate() + 14);

    return [
      { label: "Today", date: today.toISOString(), sublabel: "Today" },
      { label: "Tomorrow", date: tomorrow.toISOString(), sublabel: new Date(tomorrow).toLocaleDateString('en-US', { weekday: 'short' }) },
      { label: "Next week", date: nextWeek.toISOString(), sublabel: new Date(nextWeek).toLocaleDateString('en-US', { weekday: 'short' }) },
      { label: "2 weeks", date: twoWeeks.toISOString(), sublabel: new Date(twoWeeks).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
      { label: "Clear", date: null, sublabel: "" },
    ];
  };

  // Format due date
  const formatDueDate = (dueAt: string | undefined) => {
    if (!dueAt) return null;

    const due = new Date(dueAt);
    const now = new Date();
    const diffDays = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const month = due.getMonth() + 1;
    const day = due.getDate();
    const year = due.getFullYear().toString().slice(-2);
    const dateStr = `${month}/${day}/${year}`;

    let color = colors.textSecondary;
    if (diffDays < 0) {
      color = "#ef4444"; // Overdue - red
    } else if (diffDays <= 3) {
      color = "#f97316"; // Soon - orange
    }

    return { text: dateStr, color };
  };

  // Render sidebar folder/list item (ClickUp-style hierarchy)
  const renderSidebarItem = (item: FolderHierarchyItem | ListHierarchyItem, depth: number = 0) => {
    const paddingLeft = 12 + depth * 16;

    if (item.type === "folder") {
      const folder = item as FolderHierarchyItem;
      const isExpanded = expandedFolders.has(folder.id);
      const isEditing = editingFolderId === folder.id;
      const folderData = apiFolders.find(f => f.id === folder.id);

      return (
        <div key={folder.id}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              position: "relative",
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget.querySelector('.folder-menu-btn') as HTMLElement;
              if (btn) btn.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget.querySelector('.folder-menu-btn') as HTMLElement;
              if (btn && folderMenuOpen !== folder.id) btn.style.opacity = '0';
            }}
          >
            <button
              onClick={() => toggleFolder(folder.id)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                paddingLeft: `${paddingLeft}px`,
                paddingRight: "32px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: colors.textSecondary,
                fontSize: "0.85rem",
                fontWeight: 500,
                textAlign: "left",
              }}
            >
              {isExpanded ? (
                <ChevronDown size={14} style={{ flexShrink: 0 }} />
              ) : (
                <ChevronRight size={14} style={{ flexShrink: 0 }} />
              )}
              <FolderOpen size={14} style={{ flexShrink: 0, color: folder.color || colors.accent }} />
              {isEditing ? (
                <input
                  type="text"
                  value={editFolderName}
                  onChange={(e) => setEditFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameFolder(folder.id);
                    if (e.key === "Escape") {
                      setEditingFolderId(null);
                      setEditFolderName("");
                    }
                  }}
                  onBlur={() => renameFolder(folder.id)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  style={{
                    flex: 1,
                    padding: "2px 6px",
                    fontSize: "0.85rem",
                    background: colors.surface,
                    border: `1px solid ${colors.accent}`,
                    borderRadius: "4px",
                    color: colors.text,
                    outline: "none",
                  }}
                />
              ) : (
                <>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {folder.name}
                  </span>
                  <span style={{ fontSize: "0.7rem", color: colors.textMuted, fontWeight: 400, marginLeft: "4px" }}>
                    {folder.listCount} list{folder.listCount !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </button>

            {/* Folder menu button */}
            <button
              className="folder-menu-btn"
              onClick={(e) => {
                e.stopPropagation();
                setFolderMenuOpen(folderMenuOpen === folder.id ? null : folder.id);
              }}
              style={{
                position: "absolute",
                right: "8px",
                width: "24px",
                height: "24px",
                borderRadius: "4px",
                background: folderMenuOpen === folder.id ? colors.surfaceHover : "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: colors.textMuted,
                opacity: folderMenuOpen === folder.id ? 1 : 0,
                transition: "opacity 0.15s",
              }}
            >
              <MoreHorizontal size={14} />
            </button>

            {/* Folder context menu */}
            {folderMenuOpen === folder.id && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: "8px",
                  marginTop: "4px",
                  minWidth: "160px",
                  background: colors.sidebar,
                  backdropFilter: "blur(24px) saturate(180%)",
                  WebkitBackdropFilter: "blur(24px) saturate(180%)",
                  border: `1px solid ${colors.border}`,
                  borderRadius: "8px",
                  boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.15)",
                  zIndex: 100,
                  overflow: "hidden",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    setCreateListInFolder(folder.id);
                    setShowCreateList(true);
                    setFolderMenuOpen(null);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: "none",
                    border: "none",
                    color: colors.text,
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                >
                  <Plus size={14} />
                  Add List
                </button>
                <button
                  onClick={() => {
                    setAddingTaskInList("__sidebar__");
                    setQuickTaskTitle("");
                    setFolderMenuOpen(null);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: "none",
                    border: "none",
                    color: colors.accent,
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                >
                  <Circle size={14} />
                  Add Task
                </button>
                <div style={{ height: "1px", background: colors.border }} />
                <button
                  onClick={() => folderData && startEditingFolder(folderData)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: "none",
                    border: "none",
                    color: colors.text,
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                >
                  <Edit3 size={14} />
                  Rename
                </button>
                <div style={{ height: "1px", background: colors.border }} />
                <button
                  onClick={() => {
                    if (confirm(`Delete folder "${folder.name}" and all its lists?`)) deleteFolder(folder.id);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                >
                  <Trash2 size={14} />
                  Delete Folder
                </button>
              </div>
            )}
          </div>
          {isExpanded && folder.children.map(child => renderSidebarItem(child, depth + 1))}
          {/* Inline list creation input inside this folder */}
          {isExpanded && showCreateList && createListInFolder === folder.id && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "7px 12px",
                paddingLeft: `${12 + (depth + 1) * 16}px`,
              }}
            >
              <ListTodo size={14} style={{ color: colors.accent, flexShrink: 0 }} />
              <input
                type="text"
                placeholder="List name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createList(folder.id);
                  if (e.key === "Escape") {
                    setShowCreateList(false);
                    setCreateListInFolder(null);
                    setNewListName("");
                  }
                }}
                onBlur={() => {
                  if (!newListName.trim()) {
                    setShowCreateList(false);
                    setCreateListInFolder(null);
                    setNewListName("");
                  }
                }}
                autoFocus
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  fontSize: "0.85rem",
                  background: colors.surface,
                  border: `1px solid ${colors.accent}`,
                  borderRadius: "6px",
                  color: colors.text,
                  outline: "none",
                }}
              />
            </div>
          )}
        </div>
      );
    }

    // List item
    const list = item as ListHierarchyItem;
    const isSelected = selectedListId === list.id;
    const isEditing = editingListId === list.id;
    const listData = apiLists.find(l => l.id === list.id);

    return (
      <React.Fragment key={list.id}>
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.querySelectorAll('.list-menu-btn, .list-add-btn').forEach((btn: Element) => {
            (btn as HTMLElement).style.opacity = '1';
          });
        }}
        onMouseLeave={(e) => {
          e.currentTarget.querySelectorAll('.list-menu-btn, .list-add-btn').forEach((btn: Element) => {
            if (listMenuOpen !== list.id) (btn as HTMLElement).style.opacity = '0';
          });
        }}
      >
        <button
          onClick={() => selectList(list.id)}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "7px 12px",
            paddingLeft: `${paddingLeft}px`,
            paddingRight: "56px",
            background: isSelected ? colors.sidebarActive : "transparent",
            border: isSelected ? `1px solid ${colors.accent}40` : "1px solid transparent",
            cursor: "pointer",
            color: isSelected ? colors.accent : colors.textSecondary,
            fontSize: "0.85rem",
            fontWeight: isSelected ? 600 : 400,
            textAlign: "left",
            borderRadius: "4px",
            margin: "1px 4px",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            if (!isSelected) e.currentTarget.style.background = colors.sidebarHover;
          }}
          onMouseLeave={(e) => {
            if (!isSelected) e.currentTarget.style.background = "transparent";
          }}
        >
          <List size={14} style={{ flexShrink: 0, color: list.color || colors.textMuted }} />
          {isEditing ? (
            <input
              type="text"
              value={editListName}
              onChange={(e) => setEditListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") renameList(list.id);
                if (e.key === "Escape") {
                  setEditingListId(null);
                  setEditListName("");
                }
              }}
              onBlur={() => renameList(list.id)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              style={{
                flex: 1,
                padding: "2px 6px",
                fontSize: "0.85rem",
                background: colors.surface,
                border: `1px solid ${colors.accent}`,
                borderRadius: "4px",
                color: colors.text,
                outline: "none",
              }}
            />
          ) : (
            <>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {list.name}
              </span>
              <span style={{ fontSize: "0.75rem", color: colors.textMuted, fontWeight: 400 }}>
                {list.taskCount}
              </span>
            </>
          )}
        </button>

        {/* Quick add task button */}
        <button
          className="list-add-btn"
          onClick={(e) => {
            e.stopPropagation();
            setAddingTaskInList(addingTaskInList === list.id ? null : list.id);
            setQuickTaskTitle("");
          }}
          style={{
            position: "absolute",
            right: "36px",
            width: "22px",
            height: "22px",
            borderRadius: "4px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.accent,
            opacity: addingTaskInList === list.id ? 1 : 0,
            transition: "opacity 0.15s, background 0.15s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          title="Add task"
        >
          <Plus size={13} />
        </button>

        {/* List menu button */}
        <button
          className="list-menu-btn"
          onClick={(e) => {
            e.stopPropagation();
            setListMenuOpen(listMenuOpen === list.id ? null : list.id);
          }}
          style={{
            position: "absolute",
            right: "12px",
            width: "24px",
            height: "24px",
            borderRadius: "4px",
            background: listMenuOpen === list.id ? colors.surfaceHover : "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.textMuted,
            opacity: listMenuOpen === list.id ? 1 : 0,
            transition: "opacity 0.15s",
          }}
        >
          <MoreHorizontal size={14} />
        </button>

        {/* List context menu */}
        {listMenuOpen === list.id && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: "8px",
              marginTop: "4px",
              minWidth: "140px",
              background: colors.sidebar,
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              border: `1px solid ${colors.border}`,
              borderRadius: "8px",
              boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.15)",
              zIndex: 100,
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setAddingTaskInList(list.id);
                setQuickTaskTitle("");
                setListMenuOpen(null);
              }}
              style={{
                width: "100%",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "none",
                border: "none",
                color: colors.accent,
                cursor: "pointer",
                fontSize: "0.85rem",
                textAlign: "left",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
            >
              <Plus size={14} />
              Add Task
            </button>
            <div style={{ height: "1px", background: colors.border }} />
            <button
              onClick={() => listData && startEditingList(listData)}
              style={{
                width: "100%",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "none",
                border: "none",
                color: colors.text,
                cursor: "pointer",
                fontSize: "0.85rem",
                textAlign: "left",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
            >
              <Edit3 size={14} />
              Rename
            </button>
            <div style={{ height: "1px", background: colors.border }} />
            <button
              onClick={() => {
                if (confirm(`Delete list "${list.name}" and all its tasks?`)) deleteList(list.id);
              }}
              style={{
                width: "100%",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "none",
                border: "none",
                color: "#ef4444",
                cursor: "pointer",
                fontSize: "0.85rem",
                textAlign: "left",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
            >
              <Trash2 size={14} />
              Delete List
            </button>
          </div>
        )}
      </div>
      {/* Inline task creation below list item */}
      {addingTaskInList === list.id && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "3px 12px 3px",
            paddingLeft: `${paddingLeft + 14}px`,
          }}
        >
          <Circle size={12} style={{ color: colors.accent, flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Task name..."
            value={quickTaskTitle}
            onChange={(e) => setQuickTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") quickAddTaskInList();
              if (e.key === "Escape") {
                setAddingTaskInList(null);
                setQuickTaskTitle("");
              }
            }}
            onBlur={() => {
              if (!quickTaskTitle.trim()) {
                setAddingTaskInList(null);
                setQuickTaskTitle("");
              }
            }}
            autoFocus
            style={{
              flex: 1,
              padding: "4px 8px",
              fontSize: "0.8rem",
              background: colors.surface,
              border: `1px solid ${colors.accent}60`,
              borderRadius: "4px",
              color: colors.text,
              outline: "none",
            }}
          />
        </div>
      )}
      </React.Fragment>
    );
  };

  // Render custom field cell based on field type
  const renderCustomFieldCell = (task: Task, field: CustomField) => {
    const value = taskFieldValues[task.id]?.[field.id];

    const cellStyle: React.CSSProperties = {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "0.8rem",
      color: colors.text,
      padding: "4px 8px",
      borderRadius: "4px",
      cursor: "pointer",
      transition: "background 0.15s",
      minWidth: 0,
      overflow: "hidden",
    };

    const emptyStyle: React.CSSProperties = {
      ...cellStyle,
      color: colors.textMuted,
      opacity: 0.5,
    };

    const openFieldPopover = (e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      setCustomFieldPopover({
        taskId: task.id,
        fieldId: field.id,
        field,
        position: { top: rect.bottom + 4, left: rect.left },
      });
      setCustomFieldEditValue(String(value ?? ""));
    };

    switch (field.fieldType) {
      case "checkbox":
        const isChecked = Boolean(value);
        return (
          <div
            key={field.id}
            style={cellStyle}
            onClick={async (e) => {
              e.stopPropagation();
              const newValue = !isChecked;
              try {
                await setTaskFieldValue(task.id, field.id, newValue);
                setTaskFieldValues(prev => ({
                  ...prev,
                  [task.id]: { ...prev[task.id], [field.id]: newValue }
                }));
              } catch (err) {
                console.error("Failed to update checkbox:", err);
              }
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <div style={{
              width: "18px",
              height: "18px",
              borderRadius: "4px",
              border: isChecked ? "none" : `2px solid ${colors.border}`,
              background: isChecked ? colors.accent : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {isChecked && <CheckCheck size={12} color="#000" />}
            </div>
          </div>
        );

      case "select":
        const option = field.config.options?.find(o => o.value === value);
        return (
          <div
            key={field.id}
            style={option ? cellStyle : emptyStyle}
            onClick={openFieldPopover}
            onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            {option ? (
              <span style={{
                padding: "2px 8px",
                borderRadius: "4px",
                background: option.color ? `${option.color}20` : colors.surface,
                color: option.color || colors.text,
                fontSize: "0.75rem",
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {option.label}
              </span>
            ) : (
              <span style={{ fontSize: "0.75rem" }}>—</span>
            )}
          </div>
        );

      case "rating":
        const maxRating = field.config.maxRating || 5;
        const ratingValue = typeof value === "number" ? value : 0;
        return (
          <div
            key={field.id}
            style={cellStyle}
            onClick={openFieldPopover}
            onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ display: "flex", gap: "2px" }}>
              {Array.from({ length: maxRating }).map((_, i) => (
                <Star
                  key={i}
                  size={12}
                  fill={i < ratingValue ? colors.accent : "transparent"}
                  color={i < ratingValue ? colors.accent : colors.textMuted}
                />
              ))}
            </div>
          </div>
        );

      case "progress":
        const progressValue = typeof value === "number" ? Math.min(100, Math.max(0, value)) : 0;
        return (
          <div
            key={field.id}
            style={cellStyle}
            onClick={openFieldPopover}
            onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%" }}>
              <div style={{
                flex: 1,
                height: "6px",
                borderRadius: "3px",
                background: colors.surface,
                overflow: "hidden",
              }}>
                <div style={{
                  width: `${progressValue}%`,
                  height: "100%",
                  background: progressValue >= 100 ? colors.success : colors.accent,
                  borderRadius: "3px",
                  transition: "width 0.2s",
                }} />
              </div>
              <span style={{ fontSize: "0.7rem", color: colors.textMuted }}>{progressValue}%</span>
            </div>
          </div>
        );

      case "date":
        const dateValue = value ? new Date(value as string) : null;
        return (
          <div
            key={field.id}
            style={dateValue ? cellStyle : emptyStyle}
            onClick={openFieldPopover}
            onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            {dateValue ? (
              <span style={{ fontSize: "0.75rem" }}>
                {dateValue.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            ) : (
              <Calendar size={14} style={{ opacity: 0.5 }} />
            )}
          </div>
        );

      case "number":
      case "currency":
      case "percent":
        const numValue = typeof value === "number" ? value : null;
        const prefix = field.fieldType === "currency" ? (field.config.currency || "$") : "";
        const suffix = field.fieldType === "percent" ? "%" : "";
        return (
          <div
            key={field.id}
            style={numValue !== null ? cellStyle : emptyStyle}
            onClick={openFieldPopover}
            onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ fontSize: "0.8rem", fontWeight: 500 }}>
              {numValue !== null ? `${prefix}${numValue}${suffix}` : "—"}
            </span>
          </div>
        );

      case "url":
        return (
          <div
            key={field.id}
            style={value ? cellStyle : emptyStyle}
            onClick={(e) => {
              if (value) {
                e.stopPropagation();
                window.open(value as string, "_blank");
              } else {
                openFieldPopover(e);
              }
            }}
            onDoubleClick={openFieldPopover}
            onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            {value ? (
              <Link size={14} color={colors.accent} />
            ) : (
              <span style={{ fontSize: "0.75rem" }}>—</span>
            )}
          </div>
        );

      case "email":
        return (
          <div
            key={field.id}
            style={value ? cellStyle : emptyStyle}
            onClick={openFieldPopover}
            onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <span style={{
              fontSize: "0.75rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {value ? String(value) : "—"}
            </span>
          </div>
        );

      case "text":
      default:
        return (
          <div
            key={field.id}
            style={value ? cellStyle : emptyStyle}
            onClick={openFieldPopover}
            onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <span style={{
              fontSize: "0.8rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {value ? String(value) : "—"}
            </span>
          </div>
        );
    }
  };

  // Render task row (ClickUp style) with drag-drop support
  const renderTaskRow = (task: Task, statusId: string, index: number) => {
    const isDone = task.status === "done";
    const isEditing = editingTaskId === task.id;
    const dueInfo = formatDueDate(task.dueAt);
    const priorityInfo = PRIORITIES[task.priority as keyof typeof PRIORITIES] || PRIORITIES.none;
    const statusInfo = activeStatuses.find(s => s.id === task.status);
    const isDragging = listDragState?.taskId === task.id;
    const isDropTarget = listDragState && listDragState.overStatus === statusId && listDragState.overIndex === index;
    const showDropBefore = isDropTarget && listDragState?.overPosition === "before";
    const showDropAfter = isDropTarget && listDragState?.overPosition === "after";

    const taskRow = (
      <div
        key={task.id}
        className="task-row"
        draggable
        onDragStart={(e) => handleListDragStart(e, task, statusId, index)}
        onDragEnd={handleListDragEnd}
        onDragOver={(e) => {
          // Determine if cursor is in top or bottom half
          const rect = e.currentTarget.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const position = e.clientY < midY ? "before" : "after";
          handleListDragOver(e, statusId, index, position);
        }}
        onDrop={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const position = e.clientY < midY ? "before" : "after";
          handleListDrop(e, statusId, index, position);
        }}
        style={{
          display: "grid",
          gridTemplateColumns: gridTemplate,
          alignItems: "center",
          gap: "8px",
          padding: "8px 16px",
          transition: "background 0.1s, opacity 0.15s, border-color 0.15s",
          background: "transparent",
          position: "relative",
          opacity: isDragging ? 0.5 : 1,
          cursor: "grab",
          borderTop: showDropBefore ? `2px solid ${colors.accent}` : "2px solid transparent",
          borderBottom: showDropAfter ? `2px solid ${colors.accent}` : "2px solid transparent",
          marginTop: showDropBefore ? "-2px" : "0",
          marginBottom: showDropAfter ? "-2px" : "0",
        }}
        onMouseEnter={(e) => {
          if (!listDragState) {
            e.currentTarget.style.background = colors.rowHover;
          }
          const actions = e.currentTarget.querySelector('.task-hover-actions') as HTMLElement;
          if (actions) actions.style.opacity = '1';
          const dragHandle = e.currentTarget.querySelector('.drag-handle') as HTMLElement;
          if (dragHandle) dragHandle.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          const actions = e.currentTarget.querySelector('.task-hover-actions') as HTMLElement;
          if (actions) actions.style.opacity = '0';
          const dragHandle = e.currentTarget.querySelector('.drag-handle') as HTMLElement;
          if (dragHandle) dragHandle.style.opacity = '0';
        }}
      >
        {/* Drag Handle + Expand/Collapse + Checkbox */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "2px" }}>
          {/* Drag handle */}
          <div
            className="drag-handle"
            style={{
              opacity: 0,
              transition: "opacity 0.15s",
              cursor: "grab",
              display: "flex",
              alignItems: "center",
              padding: "2px",
              marginRight: "2px",
            }}
          >
            <GripVertical size={12} color={colors.textMuted} />
          </div>
          {/* Expand chevron - show if has subtasks or adding subtask */}
          {(task.subtaskCount > 0 || addingSubtaskTo === task.id) ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleTaskExpanded(task.id);
              }}
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "2px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                color: colors.textMuted,
              }}
            >
              {expandedTasks.has(task.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : (
            <div style={{ width: "16px" }} />
          )}

          {/* Checkbox - Circle style like ClickUp */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleTaskComplete(task.id);
            }}
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              border: isDone ? "none" : `2px solid ${statusInfo?.color || colors.border}`,
              background: isDone ? colors.success : "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              transition: "all 0.15s",
            }}
          >
            {isDone && <CheckCheck size={10} color="#fff" />}
          </button>
        </div>

        {/* Task Name + Hover Actions */}
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: "8px", position: "relative" }}>
          {isEditing ? (
            <input
              type="text"
              value={editTaskTitle}
              onChange={(e) => setEditTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTaskEdit();
                if (e.key === "Escape") {
                  setEditingTaskId(null);
                  setEditTaskTitle("");
                }
              }}
              onBlur={saveTaskEdit}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                padding: "4px 8px",
                fontSize: "0.9rem",
                background: colors.surface,
                border: `1px solid ${colors.accent}`,
                borderRadius: "4px",
                color: colors.text,
                outline: "none",
              }}
            />
          ) : (
            <>
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startEditingTask(task);
                }}
                style={{
                  fontSize: "0.9rem",
                  color: isDone ? colors.textMuted : colors.text,
                  textDecoration: isDone ? "line-through" : "none",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {task.title}
              </span>

              {/* Blocked Indicator */}
              {blockedTasks.has(task.id) && (
                <div
                  title="This task is blocked by dependencies"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: "rgba(239, 68, 68, 0.15)",
                    marginLeft: "8px",
                    flexShrink: 0,
                  }}
                >
                  <Lock size={10} color="#ef4444" />
                  <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#ef4444" }}>
                    BLOCKED
                  </span>
                </div>
              )}

              {/* Dependencies Indicator */}
              {(taskDependencies[task.id]?.length > 0 || taskDependents[task.id]?.length > 0) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openDependencyPicker(task);
                  }}
                  title={`${taskDependencies[task.id]?.length || 0} dependencies, ${taskDependents[task.id]?.length || 0} dependents`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: "rgba(99, 102, 241, 0.15)",
                    border: "none",
                    cursor: "pointer",
                    marginLeft: "6px",
                    flexShrink: 0,
                  }}
                >
                  <GitMerge size={10} color="#6366f1" />
                  <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#6366f1" }}>
                    {(taskDependencies[task.id]?.length || 0) + (taskDependents[task.id]?.length || 0)}
                  </span>
                </button>
              )}

              {/* Task Labels/Tags */}
              {task.labels.length > 0 && (
                <div style={{ display: "flex", gap: "4px", flexShrink: 0, marginLeft: "8px" }}>
                  {task.labels.slice(0, 3).map((labelId) => {
                    const label = labels.find(l => l.id === labelId);
                    if (!label) return null;
                    return (
                      <span
                        key={labelId}
                        title={label.name}
                        style={{
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: `${label.color}20`,
                          color: label.color,
                          fontSize: "0.7rem",
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {label.name}
                      </span>
                    );
                  })}
                  {task.labels.length > 3 && (
                    <span style={{ fontSize: "0.7rem", color: colors.textMuted }}>
                      +{task.labels.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Hover Action Buttons */}
              <div
                className="task-hover-actions"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                  marginLeft: "auto",
                  opacity: 0,
                  transition: "opacity 0.15s",
                }}
              >
                {/* Add Subtask */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startAddingSubtask(task.id);
                  }}
                  title="Add subtask"
                  style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    color: colors.textSecondary,
                    fontSize: "0.7rem",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.surfaceHover;
                    e.currentTarget.style.borderColor = colors.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.surface;
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  <Plus size={12} />
                  Add subtask
                </button>

                {/* Edit Tags */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTagsPopover({ taskId: task.id, position: { top: rect.bottom + 4, left: rect.left } });
                    setAssigneePopover(null);
                    setDueDatePopover(null);
                    setPriorityPopover(null);
                  }}
                  title="Edit tags"
                  style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    color: colors.textSecondary,
                    fontSize: "0.7rem",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.surfaceHover;
                    e.currentTarget.style.borderColor = colors.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.surface;
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  <Tag size={12} />
                  Edit tags
                </button>

                {/* Rename */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditingTask(task);
                  }}
                  title="Rename"
                  style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    color: colors.textSecondary,
                    fontSize: "0.7rem",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.surfaceHover;
                    e.currentTarget.style.borderColor = colors.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.surface;
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  <Edit3 size={12} />
                  Rename
                </button>

                {/* Quick action icons */}
                <div style={{ display: "flex", alignItems: "center", gap: "2px", marginLeft: "4px" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Open task - for now start editing
                      startEditingTask(task);
                    }}
                    title="Open task"
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "4px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: colors.textMuted,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      openCommentsPopover(task.id, { top: rect.bottom + 4, left: rect.left - 200 });
                    }}
                    title="Add comment"
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "4px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: colors.textMuted,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <MessageSquare size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
          {!isEditing && task.commentCount > 0 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                openCommentsPopover(task.id, { top: rect.bottom + 4, left: rect.left - 200 });
              }}
              style={{ display: "flex", alignItems: "center", gap: "2px", color: colors.textMuted, fontSize: "0.75rem", flexShrink: 0, cursor: "pointer" }}
              onMouseEnter={(e) => e.currentTarget.style.color = colors.accent}
              onMouseLeave={(e) => e.currentTarget.style.color = colors.textMuted}
            >
              <MessageSquare size={12} />
              {task.commentCount}
            </span>
          )}
        </div>

        {/* Assignee - Clickable */}
        <div
          style={{ display: "flex", justifyContent: "center", position: "relative" }}
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setAssigneePopover({ taskId: task.id, position: { top: rect.bottom + 4, left: rect.left } });
            setDueDatePopover(null);
            setPriorityPopover(null);
          }}
        >
          <div
            style={{
              padding: "4px 8px",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "background 0.15s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            {task.assignees.length > 0 ? (
              <div style={{ display: "flex" }}>
                {task.assignees.slice(0, 2).map((assignee, i) => {
                  const user = USERS[assignee];
                  return (
                    <div
                      key={assignee}
                      title={user?.name || assignee}
                      style={{
                        width: "26px",
                        height: "26px",
                        borderRadius: "50%",
                        background: user?.avatar || "#6b7280",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        marginLeft: i > 0 ? "-8px" : 0,
                        border: `2px solid ${colors.headerBg}`,
                        zIndex: 2 - i,
                      }}
                    >
                      {user?.initials || assignee.charAt(0).toUpperCase()}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "50%",
                  border: `2px dashed ${colors.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: colors.textMuted,
                }}
              >
                <User size={12} />
              </div>
            )}
          </div>
        </div>

        {/* Due Date - Clickable */}
        <div
          style={{ display: "flex", justifyContent: "center", position: "relative" }}
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setDueDatePopover({ taskId: task.id, position: { top: rect.bottom + 4, left: rect.left - 100 } });
            setAssigneePopover(null);
            setPriorityPopover(null);
          }}
        >
          <div
            style={{
              padding: "4px 8px",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            {dueInfo ? (
              <span style={{ fontSize: "0.8rem", color: dueInfo.color, fontWeight: 500 }}>
                {dueInfo.text}
              </span>
            ) : (
              <Calendar size={14} color={colors.textMuted} style={{ opacity: 0.5 }} />
            )}
          </div>
        </div>

        {/* Priority - Clickable */}
        <div
          style={{ display: "flex", justifyContent: "center", position: "relative" }}
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setPriorityPopover({ taskId: task.id, position: { top: rect.bottom + 4, left: rect.left - 60 } });
            setAssigneePopover(null);
            setDueDatePopover(null);
          }}
        >
          <div
            style={{
              padding: "4px 8px",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            {task.priority !== "none" ? (
              <Flag size={14} fill={priorityInfo.flagColor} color={priorityInfo.flagColor} />
            ) : (
              <Flag size={14} color={colors.textMuted} style={{ opacity: 0.3 }} />
            )}
          </div>
        </div>

        {/* Custom Field Cells */}
        {visibleCustomFields.map(field => renderCustomFieldCell(task, field))}

        {/* More Menu */}
        <div style={{ position: "relative" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTaskMenuOpen(taskMenuOpen === task.id ? null : task.id);
            }}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "4px",
              border: "none",
              background: taskMenuOpen === task.id ? colors.surfaceHover : "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: colors.textMuted,
              opacity: taskMenuOpen === task.id ? 1 : 0.5,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
            onMouseLeave={(e) => {
              if (taskMenuOpen !== task.id) e.currentTarget.style.opacity = "0.5";
            }}
          >
            <MoreHorizontal size={16} />
          </button>

          {taskMenuOpen === task.id && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "4px",
                minWidth: "140px",
                background: colors.sidebar,
                border: `1px solid ${colors.border}`,
                borderRadius: "8px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                zIndex: 100,
                overflow: "hidden",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  startEditingTask(task);
                  setTaskMenuOpen(null);
                }}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "none",
                  border: "none",
                  color: colors.text,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                <Edit3 size={14} />
                Edit
              </button>
              {/* Message Assignee - Only show if task has assignees */}
              {task.assignees.length > 0 && (
                <button
                  onClick={async () => {
                    setTaskMenuOpen(null);
                    // Create conversation with first assignee and navigate to messages
                    const assigneeId = task.assignees[0];
                    const assigneeInfo = USERS[assigneeId];
                    try {
                      const resp = await fetch("/api/messages/conversations/find-or-create", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          participant_ids: [userId, assigneeId],
                        }),
                      });
                      if (resp.ok) {
                        const conv = await resp.json();
                        // Store context for the message
                        sessionStorage.setItem(
                          "messaging_context",
                          JSON.stringify({
                            conversationId: conv.id,
                            recipientName: assigneeInfo?.name || assigneeId,
                            contextMessage: `Regarding task: "${task.title}"`,
                          })
                        );
                        navigate(`/messages?conversation=${conv.id}`);
                      }
                    } catch (err) {
                      console.error("Failed to start conversation:", err);
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: "none",
                    border: "none",
                    color: colors.text,
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                >
                  <MessageCircle size={14} />
                  Message Assignee
                </button>
              )}
              <button
                onClick={() => {
                  setSaveAsTemplateTask(task);
                  setNewTemplateName(task.title);
                  setShowSaveAsTemplate(true);
                  setTaskMenuOpen(null);
                }}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "none",
                  border: "none",
                  color: colors.text,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                <Zap size={14} />
                Save as Template
              </button>
              <button
                onClick={() => {
                  loadTaskHistory(task.id);
                  setTaskMenuOpen(null);
                }}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "none",
                  border: "none",
                  color: colors.text,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                <History size={14} />
                View History
              </button>
              <button
                onClick={() => {
                  setTaskMenuOpen(null);
                  openDependencyPicker(task);
                }}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "none",
                  border: "none",
                  color: colors.text,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                <GitMerge size={14} />
                Dependencies
                {(taskDependencies[task.id]?.length || 0) > 0 && (
                  <span
                    style={{
                      marginLeft: "auto",
                      padding: "1px 6px",
                      borderRadius: "8px",
                      fontSize: "0.7rem",
                      background: "rgba(99, 102, 241, 0.2)",
                      color: "#6366f1",
                    }}
                  >
                    {taskDependencies[task.id]?.length}
                  </span>
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMilestonePopover({
                    taskId: task.id,
                    position: { top: rect.top, left: rect.right + 8 },
                  });
                  setTaskMenuOpen(null);
                }}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "none",
                  border: "none",
                  color: colors.text,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                <Flag size={14} />
                Set Milestone
                {task.milestoneId && (
                  <span style={{
                    marginLeft: "auto",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "0.7rem",
                    background: milestones.find(m => m.id === task.milestoneId)?.color || colors.accent,
                    color: "#fff",
                  }}>
                    {milestones.find(m => m.id === task.milestoneId)?.name?.slice(0, 8) || "•"}
                  </span>
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setRecurrencePopover({
                    taskId: task.id,
                    position: { top: rect.top, left: rect.right + 8 },
                  });
                  setTaskMenuOpen(null);
                }}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "none",
                  border: "none",
                  color: colors.text,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                <RefreshCw size={14} />
                Set Recurrence
                {task.recurrenceRule && (
                  <span style={{
                    marginLeft: "auto",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "0.7rem",
                    background: "rgba(99, 102, 241, 0.2)",
                    color: "#6366f1",
                  }}>
                    {task.recurrenceRule.includes("DAILY") ? "Daily" :
                     task.recurrenceRule.includes("WEEKLY") ? "Weekly" :
                     task.recurrenceRule.includes("MONTHLY") ? "Monthly" : "Custom"}
                  </span>
                )}
              </button>
              <div style={{ height: "1px", background: colors.border }} />
              <button
                onClick={() => moveToTrash(task.id)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "none",
                  border: "none",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                <Trash2 size={14} />
                Move to Trash
              </button>
            </div>
          )}
        </div>
      </div>
    );

    const subtasks = getSubtasks(task.id);
    const isExpanded = expandedTasks.has(task.id);

    return (
      <div key={task.id}>
        {taskRow}

        {/* Subtasks section */}
        {isExpanded && (
          <div style={{ marginLeft: "40px", borderLeft: `2px solid ${colors.border}`, marginBottom: "4px" }}>
            {/* Existing subtasks */}
            {subtasks.map(subtask => {
              const subtaskDone = subtask.status === "done";
              const subtaskStatusInfo = activeStatuses.find(s => s.id === subtask.status);

              return (
                <div
                  key={subtask.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: subtaskGridTemplate,
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 16px",
                    paddingLeft: "12px",
                    transition: "background 0.1s",
                    background: "transparent",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.rowHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  {/* Subtask checkbox */}
                  <button
                    onClick={() => toggleTaskComplete(subtask.id)}
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      border: subtaskDone ? "none" : `2px solid ${subtaskStatusInfo?.color || colors.border}`,
                      background: subtaskDone ? colors.success : "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                      marginLeft: "auto",
                    }}
                  >
                    {subtaskDone && <CheckCheck size={8} color="#fff" />}
                  </button>

                  {/* Subtask title */}
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: subtaskDone ? colors.textMuted : colors.text,
                      textDecoration: subtaskDone ? "line-through" : "none",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {subtask.title}
                  </span>

                  {/* Empty cells for alignment */}
                  <div />
                  <div />
                  <div />
                  {/* Empty cells for custom fields */}
                  {visibleCustomFields.map(field => (
                    <div key={field.id} />
                  ))}

                  {/* Delete subtask */}
                  <button
                    onClick={() => {
                      if (confirm("Delete this subtask?")) {
                        deleteTask(subtask.id);
                        // Update parent subtask count
                        setTasks(prev => prev.map(t =>
                          t.id === task.id
                            ? { ...t, subtaskCount: Math.max(0, t.subtaskCount - 1) }
                            : t
                        ));
                      }
                    }}
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "4px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: colors.textMuted,
                      opacity: 0.5,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "1";
                      e.currentTarget.style.color = "#ef4444";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "0.5";
                      e.currentTarget.style.color = colors.textMuted;
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}

            {/* Add subtask input */}
            {addingSubtaskTo === task.id ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: subtaskGridTemplate,
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 16px",
                  paddingLeft: "12px",
                }}
              >
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    border: `2px solid ${colors.border}`,
                    marginLeft: "auto",
                  }}
                />
                <input
                  type="text"
                  placeholder="Subtask name"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createSubtask(task.id);
                    if (e.key === "Escape") {
                      setAddingSubtaskTo(null);
                      setNewSubtaskTitle("");
                    }
                  }}
                  onBlur={() => {
                    if (!newSubtaskTitle.trim()) {
                      setAddingSubtaskTo(null);
                    }
                  }}
                  autoFocus
                  style={{
                    padding: "4px 8px",
                    fontSize: "0.85rem",
                    background: "transparent",
                    border: "none",
                    borderBottom: `1px solid ${colors.accent}`,
                    color: colors.text,
                    outline: "none",
                  }}
                />
              </div>
            ) : (
              <button
                onClick={() => startAddingSubtask(task.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 16px",
                  paddingLeft: "48px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: colors.textMuted,
                  fontSize: "0.8rem",
                  width: "100%",
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = colors.text}
                onMouseLeave={(e) => e.currentTarget.style.color = colors.textMuted}
              >
                <Plus size={12} />
                Add subtask
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render status group (collapsible) - ClickUp style with drag-drop support
  const renderStatusGroup = (status: { id: string; name: string; color: string; category: string }) => {
    const statusTasks = tasksByStatus[status.id] || [];
    const isCollapsed = collapsedStatuses.has(status.id);
    const isDropTargetHeader = listDragState && listDragState.overStatus === status.id && listDragState.overIndex === -1;

    return (
      <div key={status.id}>
        {/* Status Header - droppable for moving tasks to this status */}
        <div
          onClick={() => toggleStatusCollapse(status.id)}
          onDragOver={(e) => {
            if (listDragState) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              // Use index -1 to indicate dropping on header (add to end)
              if (listDragState.overStatus !== status.id || listDragState.overIndex !== -1) {
                setListDragState(prev => prev ? {
                  ...prev,
                  overStatus: status.id,
                  overIndex: -1,
                  overPosition: "after",
                } : null);
              }
            }
          }}
          onDrop={(e) => {
            if (listDragState) {
              e.preventDefault();
              handleListDrop(e, status.id, statusTasks.length, "after");
            }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            cursor: "pointer",
            userSelect: "none",
            background: isDropTargetHeader ? `${colors.accent}10` : "transparent",
            borderRadius: isDropTargetHeader ? "6px" : "0",
            border: isDropTargetHeader ? `1px dashed ${colors.accent}` : "1px solid transparent",
            transition: "all 0.15s",
          }}
        >
          <button
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              color: colors.textMuted,
            }}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>

          {/* Status Badge - Circle + Name */}
          <div
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "50%",
              border: `2px solid ${status.color}`,
              background: "transparent",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: colors.text,
            }}
          >
            {status.name}
          </span>

          <span
            style={{
              fontSize: "0.8rem",
              color: colors.textMuted,
              fontWeight: 400,
            }}
          >
            {statusTasks.length}
          </span>
        </div>

        {/* Column Headers */}
        {!isCollapsed && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: gridTemplate,
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              fontSize: "0.75rem",
              fontWeight: 500,
              color: colors.textMuted,
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <span></span>
            <span>Name</span>
            <span style={{ textAlign: "center" }}>Assignee</span>
            <span style={{ textAlign: "center" }}>Due date</span>
            <span style={{ textAlign: "center" }}>Priority</span>
            {/* Custom Field Headers */}
            {visibleCustomFields.map(field => (
              <span key={field.id} style={{ textAlign: "center" }} title={field.name}>
                {field.name.length > 12 ? `${field.name.slice(0, 10)}...` : field.name}
              </span>
            ))}
            {/* Last column: Settings button to manage fields, or "+ Fields" if none exist */}
            <span style={{ display: "flex", justifyContent: "center" }}>
              <button
                onClick={() => setShowFieldManager(true)}
                title={visibleCustomFields.length > 0 ? "Manage custom fields" : "Add custom fields"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                  padding: "4px 6px",
                  background: "transparent",
                  border: visibleCustomFields.length === 0 ? `1px dashed ${colors.border}` : "none",
                  borderRadius: "4px",
                  color: colors.textMuted,
                  fontSize: "0.7rem",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.surfaceHover;
                  e.currentTarget.style.color = colors.accent;
                  if (visibleCustomFields.length === 0) {
                    e.currentTarget.style.borderColor = colors.accent;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = colors.textMuted;
                  if (visibleCustomFields.length === 0) {
                    e.currentTarget.style.borderColor = colors.border;
                  }
                }}
              >
                {visibleCustomFields.length === 0 ? (
                  <>
                    <Plus size={10} />
                    Fields
                  </>
                ) : (
                  <Settings size={12} />
                )}
              </button>
            </span>
          </div>
        )}

        {/* Task Rows */}
        {!isCollapsed && (
          <>
            {statusTasks.map((task, index) => renderTaskRow(task, status.id, index))}

            {/* Drop zone at end of status group */}
            {listDragState && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  handleListDragOver(e, status.id, statusTasks.length, "after");
                }}
                onDrop={(e) => handleListDrop(e, status.id, statusTasks.length, "after")}
                style={{
                  height: listDragState.overStatus === status.id && listDragState.overIndex === statusTasks.length ? "40px" : "16px",
                  background: listDragState.overStatus === status.id && listDragState.overIndex === statusTasks.length
                    ? `${colors.accent}15`
                    : "transparent",
                  borderTop: listDragState.overStatus === status.id && listDragState.overIndex === statusTasks.length
                    ? `2px dashed ${colors.accent}`
                    : "2px dashed transparent",
                  borderRadius: "4px",
                  margin: "4px 16px",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {listDragState.overStatus === status.id && listDragState.overIndex === statusTasks.length && (
                  <span style={{ fontSize: "0.75rem", color: colors.accent, fontWeight: 500 }}>
                    Drop here to add at end
                  </span>
                )}
              </div>
            )}

            {/* Add Task Row - always show */}
            {addingTaskInStatus === status.id ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: gridTemplate,
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                }}
              >
                <div
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    border: `2px solid ${colors.border}`,
                    marginLeft: "auto",
                    marginRight: "auto",
                  }}
                />
                <input
                  type="text"
                  placeholder="Task name"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createTaskInStatus(status.id);
                    if (e.key === "Escape") {
                      setAddingTaskInStatus(null);
                      setNewTaskTitle("");
                    }
                  }}
                  onBlur={() => {
                    if (!newTaskTitle.trim()) {
                      setAddingTaskInStatus(null);
                    }
                  }}
                  autoFocus
                  style={{
                    padding: "6px 10px",
                    fontSize: "0.9rem",
                    background: "transparent",
                    border: "none",
                    borderBottom: `1px solid ${colors.accent}`,
                    color: colors.text,
                    outline: "none",
                  }}
                />
              </div>
            ) : (
              <button
                onClick={() => setAddingTaskInStatus(status.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 16px",
                  paddingLeft: "56px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: colors.textMuted,
                  fontSize: "0.85rem",
                  textAlign: "left",
                  transition: "color 0.15s",
                  width: "100%",
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = colors.text}
                onMouseLeave={(e) => e.currentTarget.style.color = colors.textMuted}
              >
                <Circle size={14} style={{ opacity: 0.5 }} />
                Add Task
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <UnifiedLayout variant="dashboard">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "calc(100vh - 80px)",
            background: colors.bg,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <Loader2
              size={40}
              style={{ color: colors.accent, animation: "spin 1s linear infinite" }}
            />
            <p style={{ color: colors.textSecondary, marginTop: "16px" }}>
              Loading tasks...
            </p>
          </div>
        </div>
      </UnifiedLayout>
    );
  }

  return (
    <UnifiedLayout variant="dashboard">
      {/* Glassmorphism Background Orbs */}
      <div style={{ position: "fixed", top: "-30%", left: "30%", width: "800px", height: "800px", background: isDark ? "radial-gradient(circle, rgba(139, 92, 246, 0.5) 0%, rgba(139, 92, 246, 0.2) 30%, transparent 60%)" : "radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.1) 30%, transparent 60%)", pointerEvents: "none", zIndex: 0, filter: "blur(40px)" }} aria-hidden="true" />
      <div style={{ position: "fixed", top: "20%", right: "-10%", width: "600px", height: "600px", background: isDark ? "radial-gradient(circle, rgba(236, 72, 153, 0.4) 0%, rgba(236, 72, 153, 0.15) 30%, transparent 60%)" : "radial-gradient(circle, rgba(236, 72, 153, 0.25) 0%, rgba(236, 72, 153, 0.08) 30%, transparent 60%)", pointerEvents: "none", zIndex: 0, filter: "blur(60px)" }} aria-hidden="true" />
      <div style={{ position: "fixed", bottom: "-10%", left: "-10%", width: "700px", height: "700px", background: isDark ? "radial-gradient(circle, rgba(6, 182, 212, 0.35) 0%, rgba(6, 182, 212, 0.1) 30%, transparent 60%)" : "radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, rgba(6, 182, 212, 0.05) 30%, transparent 60%)", pointerEvents: "none", zIndex: 0, filter: "blur(50px)" }} aria-hidden="true" />
      <div style={{ position: "fixed", top: "50%", right: "20%", width: "400px", height: "400px", background: isDark ? "radial-gradient(circle, rgba(255, 214, 0, 0.25) 0%, transparent 50%)" : "radial-gradient(circle, rgba(255, 214, 0, 0.15) 0%, transparent 50%)", pointerEvents: "none", zIndex: 0, filter: "blur(40px)" }} aria-hidden="true" />

      <div
        style={{
          display: "flex",
          height: "calc(100vh - 80px)",
          background: colors.surface,
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderRadius: "16px",
          overflow: "hidden",
          border: `1px solid ${colors.border}`,
          boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.3)" : "0 8px 32px rgba(31, 38, 135, 0.15)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Sidebar - Folder/List Structure */}
        <aside
          style={{
            width: "260px",
            background: colors.sidebar,
            backdropFilter: "blur(16px) saturate(150%)",
            WebkitBackdropFilter: "blur(16px) saturate(150%)",
            borderRight: `1px solid ${colors.border}`,
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
          }}
        >
          {/* Sidebar Header */}
          <div
            style={{
              padding: "16px",
              borderBottom: `1px solid ${colors.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  background: "linear-gradient(135deg, #FFD600 0%, #e6c200 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Zap size={14} color="#000" />
              </div>
              <span style={{ fontWeight: 700, color: colors.text, fontSize: "0.95rem" }}>
                Street Voices
              </span>
            </div>
            <button
              onClick={() => setShowCreateProject(true)}
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "4px",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: colors.textMuted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Saved Filters Section */}
          <div
            style={{
              padding: "8px 12px",
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: colors.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Filters
              </span>
              <div style={{ display: "flex", gap: "4px" }}>
                {activeFilter && (
                  <button
                    onClick={() => applyFilter(null)}
                    style={{
                      padding: "2px 6px",
                      fontSize: "0.65rem",
                      background: "rgba(239, 68, 68, 0.15)",
                      border: "none",
                      borderRadius: "4px",
                      color: "#ef4444",
                      cursor: "pointer",
                    }}
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setShowSaveFilterModal(true)}
                  title="Save current filter"
                  style={{
                    width: "20px",
                    height: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "none",
                    border: `1px dashed ${colors.border}`,
                    borderRadius: "4px",
                    cursor: "pointer",
                    color: colors.textMuted,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.accent;
                    e.currentTarget.style.color = colors.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = colors.border;
                    e.currentTarget.style.color = colors.textMuted;
                  }}
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
            {savedFilters.length === 0 ? (
              <div
                style={{
                  padding: "12px",
                  textAlign: "center",
                  color: colors.textMuted,
                  fontSize: "0.75rem",
                }}
              >
                <Filter size={20} style={{ opacity: 0.3, marginBottom: "8px" }} />
                <div>No saved filters</div>
                <button
                  onClick={() => setShowSaveFilterModal(true)}
                  style={{
                    marginTop: "8px",
                    padding: "4px 10px",
                    fontSize: "0.7rem",
                    background: `${colors.accent}15`,
                    border: `1px solid ${colors.accent}30`,
                    borderRadius: "4px",
                    color: colors.accent,
                    cursor: "pointer",
                  }}
                >
                  Create Filter
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {/* Pinned filters first */}
                {savedFilters.filter(f => f.isPinned).map(filter => (
                  <div
                    key={filter.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      background: activeFilterId === filter.id
                        ? `${filter.color}20`
                        : "transparent",
                      border: activeFilterId === filter.id
                        ? `1px solid ${filter.color}40`
                        : "1px solid transparent",
                      transition: "all 0.15s",
                    }}
                    onClick={() => applyFilter(filter.id)}
                    onMouseEnter={(e) => {
                      if (activeFilterId !== filter.id) {
                        e.currentTarget.style.background = colors.surfaceHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeFilterId !== filter.id) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Star size={12} fill={filter.color} color={filter.color} />
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: activeFilterId === filter.id ? colors.text : colors.textSecondary,
                          fontWeight: activeFilterId === filter.id ? 500 : 400,
                        }}
                      >
                        {filter.name}
                      </span>
                    </div>
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFilterMenuOpen(filterMenuOpen === filter.id ? null : filter.id);
                        }}
                        style={{
                          width: "20px",
                          height: "20px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: colors.textMuted,
                          borderRadius: "4px",
                          opacity: 0.5,
                        }}
                      >
                        <MoreHorizontal size={12} />
                      </button>
                      {filterMenuOpen === filter.id && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            right: 0,
                            minWidth: "140px",
                            background: colors.sidebar,
                            backdropFilter: "blur(24px) saturate(180%)",
                            border: `1px solid ${colors.border}`,
                            borderRadius: "8px",
                            boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.15)",
                            zIndex: 100,
                            overflow: "hidden",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleToggleFilterPin(filter.id)}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: colors.textSecondary,
                              fontSize: "0.8rem",
                              textAlign: "left",
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                            onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                          >
                            <Star size={14} />
                            Unpin
                          </button>
                          <button
                            onClick={() => handleDeleteFilter(filter.id)}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "#ef4444",
                              fontSize: "0.8rem",
                              textAlign: "left",
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {/* Unpinned filters */}
                {savedFilters.filter(f => !f.isPinned).map(filter => (
                  <div
                    key={filter.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      background: activeFilterId === filter.id
                        ? `${filter.color}20`
                        : "transparent",
                      border: activeFilterId === filter.id
                        ? `1px solid ${filter.color}40`
                        : "1px solid transparent",
                      transition: "all 0.15s",
                    }}
                    onClick={() => applyFilter(filter.id)}
                    onMouseEnter={(e) => {
                      if (activeFilterId !== filter.id) {
                        e.currentTarget.style.background = colors.surfaceHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeFilterId !== filter.id) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: filter.color,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: activeFilterId === filter.id ? colors.text : colors.textSecondary,
                          fontWeight: activeFilterId === filter.id ? 500 : 400,
                        }}
                      >
                        {filter.name}
                      </span>
                    </div>
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFilterMenuOpen(filterMenuOpen === filter.id ? null : filter.id);
                        }}
                        style={{
                          width: "20px",
                          height: "20px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: colors.textMuted,
                          borderRadius: "4px",
                          opacity: 0.5,
                        }}
                      >
                        <MoreHorizontal size={12} />
                      </button>
                      {filterMenuOpen === filter.id && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            right: 0,
                            minWidth: "140px",
                            background: colors.sidebar,
                            backdropFilter: "blur(24px) saturate(180%)",
                            border: `1px solid ${colors.border}`,
                            borderRadius: "8px",
                            boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.15)",
                            zIndex: 100,
                            overflow: "hidden",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleToggleFilterPin(filter.id)}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: colors.textSecondary,
                              fontSize: "0.8rem",
                              textAlign: "left",
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                            onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                          >
                            <Star size={14} />
                            Pin to top
                          </button>
                          <button
                            onClick={() => handleDeleteFilter(filter.id)}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "#ef4444",
                              fontSize: "0.8rem",
                              textAlign: "left",
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Milestones Section */}
          {milestones.length > 0 && (
            <div style={{ padding: "12px 12px 8px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: colors.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Milestones
                </span>
                <button
                  onClick={() => setShowMilestoneManager(true)}
                  style={{
                    padding: "2px 6px",
                    fontSize: "0.65rem",
                    background: "rgba(99, 102, 241, 0.15)",
                    border: "none",
                    borderRadius: "4px",
                    color: colors.accent,
                    cursor: "pointer",
                  }}
                >
                  Manage
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {activeMilestones.map((milestone) => (
                  <button
                    key={milestone.id}
                    onClick={() => setSelectedMilestoneFilter(
                      selectedMilestoneFilter === milestone.id ? null : milestone.id
                    )}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      background: selectedMilestoneFilter === milestone.id
                        ? `${milestone.color}20`
                        : "transparent",
                      border: selectedMilestoneFilter === milestone.id
                        ? `1px solid ${milestone.color}40`
                        : "1px solid transparent",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "2px",
                        background: milestone.color,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: selectedMilestoneFilter === milestone.id ? colors.text : colors.textSecondary,
                          fontWeight: selectedMilestoneFilter === milestone.id ? 500 : 400,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {milestone.name}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          marginTop: "4px",
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            height: "4px",
                            background: `${milestone.color}30`,
                            borderRadius: "2px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${milestone.progress}%`,
                              height: "100%",
                              background: milestone.color,
                              borderRadius: "2px",
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            color: colors.textMuted,
                            flexShrink: 0,
                          }}
                        >
                          {milestone.progress}%
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Automations Section */}
          <div style={{ padding: "12px 12px 4px" }}>
            <button
              onClick={openAutomationManager}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                background: showAutomationManager ? colors.sidebarActive : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!showAutomationManager) e.currentTarget.style.background = colors.sidebarHover;
              }}
              onMouseLeave={(e) => {
                if (!showAutomationManager) e.currentTarget.style.background = "transparent";
              }}
            >
              <Zap
                size={16}
                color={showAutomationManager ? colors.accent : colors.textMuted}
              />
              <span
                style={{
                  flex: 1,
                  textAlign: "left",
                  fontSize: "0.85rem",
                  fontWeight: showAutomationManager ? 500 : 400,
                  color: showAutomationManager ? colors.text : colors.textSecondary,
                }}
              >
                Automations
              </span>
              {automationRules.filter(r => r.isEnabled).length > 0 && (
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    background: "rgba(34, 197, 94, 0.15)",
                    color: "#22c55e",
                  }}
                >
                  {automationRules.filter(r => r.isEnabled).length}
                </span>
              )}
            </button>
          </div>

          {/* Time Reports Section */}
          <div style={{ padding: "4px 12px 4px" }}>
            <button
              onClick={openTimeReports}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                background: showTimeReports ? colors.sidebarActive : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!showTimeReports) e.currentTarget.style.background = colors.sidebarHover;
              }}
              onMouseLeave={(e) => {
                if (!showTimeReports) e.currentTarget.style.background = "transparent";
              }}
            >
              <BarChart3
                size={16}
                color={showTimeReports ? colors.accent : colors.textMuted}
              />
              <span
                style={{
                  flex: 1,
                  textAlign: "left",
                  fontSize: "0.85rem",
                  fontWeight: showTimeReports ? 500 : 400,
                  color: showTimeReports ? colors.text : colors.textSecondary,
                }}
              >
                Time Reports
              </span>
            </button>
          </div>

          {/* Trash Section */}
          <div style={{ padding: "4px 12px 8px" }}>
            <button
              onClick={openTrashView}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                background: showTrashView ? colors.sidebarActive : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!showTrashView) e.currentTarget.style.background = colors.sidebarHover;
              }}
              onMouseLeave={(e) => {
                if (!showTrashView) e.currentTarget.style.background = "transparent";
              }}
            >
              <Trash2
                size={16}
                color={showTrashView ? colors.accent : colors.textMuted}
              />
              <span
                style={{
                  flex: 1,
                  textAlign: "left",
                  fontSize: "0.85rem",
                  fontWeight: showTrashView ? 500 : 400,
                  color: showTrashView ? colors.text : colors.textSecondary,
                }}
              >
                Trash
              </span>
              {trashCount > 0 && (
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    background: "rgba(239, 68, 68, 0.15)",
                    color: "#ef4444",
                  }}
                >
                  {trashCount}
                </span>
              )}
            </button>
          </div>

          {/* Sprint 3G: Analytics, Pages, Views Sidebar Buttons */}
          <div style={{ padding: "4px 12px" }}>
            <button
              onClick={openAnalytics}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                background: showAnalytics ? colors.sidebarActive : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!showAnalytics) e.currentTarget.style.background = colors.sidebarHover;
              }}
              onMouseLeave={(e) => {
                if (!showAnalytics) e.currentTarget.style.background = "transparent";
              }}
            >
              <PieChart
                size={16}
                color={showAnalytics ? colors.accent : colors.textMuted}
              />
              <span
                style={{
                  flex: 1,
                  textAlign: "left",
                  fontSize: "0.85rem",
                  fontWeight: showAnalytics ? 500 : 400,
                  color: showAnalytics ? colors.text : colors.textSecondary,
                }}
              >
                Analytics
              </span>
            </button>
          </div>
          <div style={{ padding: "4px 12px" }}>
            <button
              onClick={openPages}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                background: showPages ? colors.sidebarActive : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!showPages) e.currentTarget.style.background = colors.sidebarHover;
              }}
              onMouseLeave={(e) => {
                if (!showPages) e.currentTarget.style.background = "transparent";
              }}
            >
              <FileText
                size={16}
                color={showPages ? colors.accent : colors.textMuted}
              />
              <span
                style={{
                  flex: 1,
                  textAlign: "left",
                  fontSize: "0.85rem",
                  fontWeight: showPages ? 500 : 400,
                  color: showPages ? colors.text : colors.textSecondary,
                }}
              >
                Pages
              </span>
            </button>
          </div>
          <div style={{ padding: "4px 12px 8px" }}>
            <button
              onClick={openViews}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                background: showViews ? colors.sidebarActive : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!showViews) e.currentTarget.style.background = colors.sidebarHover;
              }}
              onMouseLeave={(e) => {
                if (!showViews) e.currentTarget.style.background = "transparent";
              }}
            >
              <BookOpen
                size={16}
                color={showViews ? colors.accent : colors.textMuted}
              />
              <span
                style={{
                  flex: 1,
                  textAlign: "left",
                  fontSize: "0.85rem",
                  fontWeight: showViews ? 500 : 400,
                  color: showViews ? colors.text : colors.textSecondary,
                }}
              >
                Saved Views
              </span>
            </button>
          </div>

          {/* Folder/List Tree */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {folderHierarchy.map(item => renderSidebarItem(item))}

            {/* Create Folder Input (inline) */}
            {showCreateFolder ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  marginLeft: "4px",
                  marginTop: "8px",
                }}
              >
                <Folder size={14} style={{ color: colors.accent, flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createFolder();
                    if (e.key === "Escape") {
                      setShowCreateFolder(false);
                      setNewFolderName("");
                    }
                  }}
                  onBlur={() => {
                    if (!newFolderName.trim()) {
                      setShowCreateFolder(false);
                    }
                  }}
                  autoFocus
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    fontSize: "0.85rem",
                    background: colors.surface,
                    border: `1px solid ${colors.accent}`,
                    borderRadius: "6px",
                    color: colors.text,
                    outline: "none",
                  }}
                />
              </div>
            ) : (
              <button
                onClick={() => setShowCreateFolder(true)}
                style={{
                  width: "calc(100% - 8px)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  marginLeft: "4px",
                  marginTop: "8px",
                  background: "none",
                  border: `1px dashed ${colors.border}`,
                  borderRadius: "6px",
                  cursor: "pointer",
                  color: colors.textMuted,
                  fontSize: "0.85rem",
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.accent}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = colors.border}
              >
                <FolderPlus size={14} />
                New Folder
              </button>
            )}

            {/* Add List Input (inline) or Button */}
            {showCreateList && !createListInFolder ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  marginLeft: "4px",
                  marginTop: "4px",
                }}
              >
                <ListTodo size={14} style={{ color: colors.accent, flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="List name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createList(null);
                    if (e.key === "Escape") {
                      setShowCreateList(false);
                      setNewListName("");
                    }
                  }}
                  onBlur={() => {
                    if (!newListName.trim()) {
                      setShowCreateList(false);
                      setNewListName("");
                    }
                  }}
                  autoFocus
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    fontSize: "0.85rem",
                    background: colors.surface,
                    border: `1px solid ${colors.accent}`,
                    borderRadius: "6px",
                    color: colors.text,
                    outline: "none",
                  }}
                />
              </div>
            ) : !showCreateList ? (
              <button
                onClick={() => setShowCreateList(true)}
                style={{
                  width: "calc(100% - 8px)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  marginLeft: "4px",
                  marginTop: "4px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: colors.textMuted,
                  fontSize: "0.85rem",
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = colors.text}
                onMouseLeave={(e) => e.currentTarget.style.color = colors.textMuted}
              >
                <Plus size={14} />
                New List
              </button>
            ) : null}

            {/* New Task button */}
            {addingTaskInList === "__sidebar__" ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  marginLeft: "4px",
                  marginTop: "4px",
                }}
              >
                <Circle size={14} style={{ color: colors.accent, flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Task name"
                  value={quickTaskTitle}
                  onChange={(e) => setQuickTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") quickAddTaskInList();
                    if (e.key === "Escape") {
                      setAddingTaskInList(null);
                      setQuickTaskTitle("");
                    }
                  }}
                  onBlur={() => {
                    if (!quickTaskTitle.trim()) {
                      setAddingTaskInList(null);
                      setQuickTaskTitle("");
                    }
                  }}
                  autoFocus
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    fontSize: "0.85rem",
                    background: colors.surface,
                    border: `1px solid ${colors.accent}`,
                    borderRadius: "6px",
                    color: colors.text,
                    outline: "none",
                  }}
                />
              </div>
            ) : (
              <button
                onClick={() => {
                  setAddingTaskInList("__sidebar__");
                  setQuickTaskTitle("");
                }}
                style={{
                  width: "calc(100% - 8px)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  marginLeft: "4px",
                  marginTop: "4px",
                  background: "none",
                  border: `1px dashed ${colors.accent}40`,
                  borderRadius: "6px",
                  cursor: "pointer",
                  color: colors.accent,
                  fontSize: "0.85rem",
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.accent;
                  e.currentTarget.style.background = `${colors.accent}10`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = `${colors.accent}40`;
                  e.currentTarget.style.background = "none";
                }}
              >
                <Plus size={14} />
                New Task
              </button>
            )}

            {/* Sidebar Tasks mini-section */}
            {projectTasks.length > 0 && (
              <div style={{ marginTop: "12px", borderTop: `1px solid ${colors.border}`, paddingTop: "8px" }}>
                <button
                  onClick={() => setShowSidebarTasks(!showSidebarTasks)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    width: "100%",
                    padding: "4px 12px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: colors.textMuted,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {showSidebarTasks ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  Tasks ({projectTasks.filter(t => !t.parentTaskId).length})
                </button>
                {showSidebarTasks && (
                  <div style={{ maxHeight: "240px", overflowY: "auto", padding: "2px 0" }}>
                    {projectTasks
                      .filter(t => !t.parentTaskId)
                      .slice(0, 20)
                      .map(task => {
                        const statusColor = activeStatuses.find(s => s.id === task.status)?.color || colors.textMuted;
                        const subtasks = getSubtasks(task.id);
                        const isTaskExpanded = expandedTasks.has(task.id);
                        return (
                          <React.Fragment key={task.id}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "4px 12px 4px 16px",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                                color: task.status === "done" ? colors.textMuted : colors.text,
                                textDecoration: task.status === "done" ? "line-through" : "none",
                                transition: "background 0.15s",
                                borderRadius: "4px",
                                margin: "0 4px",
                              }}
                              onClick={() => setSelectedTask(task)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = colors.sidebarHover;
                                const btn = e.currentTarget.querySelector('.subtask-add-btn') as HTMLElement;
                                if (btn) btn.style.opacity = '1';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent";
                                const btn = e.currentTarget.querySelector('.subtask-add-btn') as HTMLElement;
                                if (btn && addingSidebarSubtask !== task.id) btn.style.opacity = '0';
                              }}
                            >
                              {(task.subtaskCount > 0 || subtasks.length > 0) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTaskExpanded(task.id);
                                  }}
                                  style={{
                                    width: "14px",
                                    height: "14px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: colors.textMuted,
                                    padding: 0,
                                    flexShrink: 0,
                                  }}
                                >
                                  {isTaskExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                </button>
                              )}
                              <div
                                style={{
                                  width: "10px",
                                  height: "10px",
                                  borderRadius: "50%",
                                  border: `2px solid ${statusColor}`,
                                  background: task.status === "done" ? statusColor : "transparent",
                                  flexShrink: 0,
                                }}
                              />
                              <span style={{
                                flex: 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}>
                                {task.title}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAddingSidebarSubtask(addingSidebarSubtask === task.id ? null : task.id);
                                  setSidebarSubtaskTitle("");
                                }}
                                style={{
                                  width: "18px",
                                  height: "18px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: colors.textMuted,
                                  opacity: 0,
                                  transition: "opacity 0.15s",
                                  flexShrink: 0,
                                  padding: 0,
                                  borderRadius: "3px",
                                }}
                                className="subtask-add-btn"
                                title="Add subtask"
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = colors.accent;
                                  e.currentTarget.style.background = colors.surfaceHover;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = colors.textMuted;
                                  e.currentTarget.style.background = "none";
                                }}
                              >
                                <Plus size={11} />
                              </button>
                            </div>
                            {/* Subtask inline creation */}
                            {addingSidebarSubtask === task.id && (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  padding: "2px 12px 2px 40px",
                                }}
                              >
                                <Circle size={9} style={{ color: colors.accent, flexShrink: 0 }} />
                                <input
                                  type="text"
                                  placeholder="Subtask name..."
                                  value={sidebarSubtaskTitle}
                                  onChange={(e) => setSidebarSubtaskTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") createSidebarSubtask(task.id);
                                    if (e.key === "Escape") {
                                      setAddingSidebarSubtask(null);
                                      setSidebarSubtaskTitle("");
                                    }
                                  }}
                                  onBlur={() => {
                                    if (!sidebarSubtaskTitle.trim()) {
                                      setAddingSidebarSubtask(null);
                                      setSidebarSubtaskTitle("");
                                    }
                                  }}
                                  autoFocus
                                  style={{
                                    flex: 1,
                                    padding: "3px 6px",
                                    fontSize: "0.78rem",
                                    background: colors.surface,
                                    border: `1px solid ${colors.accent}60`,
                                    borderRadius: "3px",
                                    color: colors.text,
                                    outline: "none",
                                  }}
                                />
                              </div>
                            )}
                            {/* Expanded subtasks */}
                            {isTaskExpanded && subtasks.map(sub => (
                              <div
                                key={sub.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  padding: "3px 12px 3px 40px",
                                  cursor: "pointer",
                                  fontSize: "0.78rem",
                                  color: sub.status === "done" ? colors.textMuted : colors.textSecondary,
                                  textDecoration: sub.status === "done" ? "line-through" : "none",
                                  transition: "background 0.15s",
                                  borderRadius: "4px",
                                  margin: "0 4px",
                                }}
                                onClick={() => setSelectedTask(sub)}
                                onMouseEnter={(e) => e.currentTarget.style.background = colors.sidebarHover}
                                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                              >
                                <div
                                  style={{
                                    width: "8px",
                                    height: "8px",
                                    borderRadius: "50%",
                                    border: `1.5px solid ${activeStatuses.find(s => s.id === sub.status)?.color || colors.textMuted}`,
                                    background: sub.status === "done" ? (activeStatuses.find(s => s.id === sub.status)?.color || colors.textMuted) : "transparent",
                                    flexShrink: 0,
                                  }}
                                />
                                <span style={{
                                  flex: 1,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}>
                                  {sub.title}
                                </span>
                              </div>
                            ))}
                          </React.Fragment>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Header with breadcrumb and view tabs */}
          <header
            style={{
              padding: "10px 16px",
              borderBottom: `1px solid ${colors.border}`,
              background: colors.headerBg,
              backdropFilter: "blur(12px) saturate(150%)",
              WebkitBackdropFilter: "blur(12px) saturate(150%)",
            }}
          >
            {/* Top row - Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
              <div
                style={{
                  width: "18px",
                  height: "18px",
                  borderRadius: "4px",
                  background: colors.accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <List size={10} color="#000" />
              </div>
              <span style={{ color: colors.text, fontSize: "0.9rem", fontWeight: 500 }}>
                {selectedProject?.name || "Select a list"}
              </span>
              <ChevronDown size={14} color={colors.textMuted} />
            </div>

            {/* Bottom row - View tabs and actions */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {/* View tabs */}
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                {[
                  { mode: "list" as ViewMode, icon: List, label: "List" },
                  { mode: "board" as ViewMode, icon: LayoutGrid, label: "Board" },
                  { mode: "calendar" as ViewMode, icon: CalendarDays, label: "Calendar" },
                  { mode: "workload" as ViewMode, icon: BarChart3, label: "Workload" },
                  { mode: "gantt" as ViewMode, icon: GanttChart, label: "Gantt" },
                ].map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    style={{
                      padding: "6px 12px",
                      paddingBottom: "8px",
                      background: "transparent",
                      border: "none",
                      borderBottom: viewMode === mode ? `2px solid ${colors.accent}` : "2px solid transparent",
                      borderRadius: 0,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: viewMode === mode ? colors.text : colors.textMuted,
                      fontSize: "0.85rem",
                      fontWeight: viewMode === mode ? 500 : 400,
                    }}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
                {/* Keyboard shortcuts button */}
                <button
                  onClick={() => setShowKeyboardShortcuts(true)}
                  style={{
                    padding: "6px 12px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    color: colors.textMuted,
                    fontSize: "0.85rem",
                  }}
                  title="Keyboard shortcuts (?)"
                >
                  <Keyboard size={14} />
                </button>
              </div>

              {/* Right side actions */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {/* Calendar cross-link */}
                <CrossLink
                  icon={CalendarDays}
                  label="Calendar"
                  to="/calendar"
                  variant="chip"
                  color="#3b82f6"
                />
                {/* Save Filter Button - shown when filter is active */}
                {(searchQuery || activeFilter) && (
                  <button
                    onClick={() => setShowSaveFilterModal(true)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "5px 10px",
                      borderRadius: "4px",
                      background: colors.surface,
                      border: `1px solid ${colors.border}`,
                      cursor: "pointer",
                      color: colors.textSecondary,
                      fontSize: "0.75rem",
                    }}
                    title="Save current filter"
                  >
                    <Filter size={12} />
                    Save
                  </button>
                )}

                {/* Active Filter Indicator */}
                {activeFilter && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "4px 10px",
                      borderRadius: "4px",
                      background: `${activeFilter.color}20`,
                      border: `1px solid ${activeFilter.color}40`,
                    }}
                  >
                    <div
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: activeFilter.color,
                      }}
                    />
                    <span style={{ fontSize: "0.75rem", color: colors.text }}>
                      {activeFilter.name}
                    </span>
                    <button
                      onClick={() => applyFilter(null)}
                      style={{
                        width: "14px",
                        height: "14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: colors.textMuted,
                        padding: 0,
                      }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}

                {/* Search */}
                <button
                  style={{
                    padding: "6px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: colors.textMuted,
                  }}
                >
                  <Search size={16} />
                </button>

                {/* Export Button */}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={exporting || !selectedProject}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "6px 10px",
                      borderRadius: "4px",
                      background: colors.surface,
                      border: `1px solid ${colors.border}`,
                      cursor: selectedProject ? "pointer" : "not-allowed",
                      color: exporting ? colors.accent : colors.textSecondary,
                      fontSize: "0.8rem",
                      opacity: selectedProject ? 1 : 0.5,
                    }}
                    title="Export Tasks"
                  >
                    {exporting ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Download size={12} />
                    )}
                    Export
                    <ChevronDown size={12} />
                  </button>

                  {/* Export Dropdown */}
                  {showExportMenu && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        right: 0,
                        minWidth: "180px",
                        background: colors.surface,
                        border: `1px solid ${colors.border}`,
                        borderRadius: "8px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                        zIndex: 100,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          padding: "10px 12px",
                          borderBottom: `1px solid ${colors.border}`,
                        }}
                      >
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: colors.textMuted }}>
                          EXPORT FORMAT
                        </span>
                      </div>
                      <button
                        onClick={handleExportCsv}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          width: "100%",
                          padding: "10px 12px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: colors.text,
                          fontSize: "0.85rem",
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = colors.sidebarHover}
                        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                      >
                        <div
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "6px",
                            background: "rgba(34, 197, 94, 0.15)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#22c55e" }}>CSV</span>
                        </div>
                        <div>
                          <div style={{ fontWeight: 500 }}>Export as CSV</div>
                          <div style={{ fontSize: "0.7rem", color: colors.textMuted }}>
                            Spreadsheet format
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={handleExportJson}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          width: "100%",
                          padding: "10px 12px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: colors.text,
                          fontSize: "0.85rem",
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = colors.sidebarHover}
                        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                      >
                        <div
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "6px",
                            background: "rgba(59, 130, 246, 0.15)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#3b82f6" }}>JSON</span>
                        </div>
                        <div>
                          <div style={{ fontWeight: 500 }}>Export as JSON</div>
                          <div style={{ fontSize: "0.7rem", color: colors.textMuted }}>
                            Data interchange format
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* Import Button */}
                <button
                  onClick={() => setShowImportModal(true)}
                  disabled={!selectedProject}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 10px",
                    borderRadius: "4px",
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    cursor: selectedProject ? "pointer" : "not-allowed",
                    color: colors.textSecondary,
                    fontSize: "0.8rem",
                    opacity: selectedProject ? 1 : 0.5,
                  }}
                  title="Import Tasks from CSV"
                >
                  <Upload size={12} />
                  Import
                </button>

                {/* Template Selector */}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "6px 10px",
                      borderRadius: "4px",
                      background: selectedTemplate ? `${colors.accent}20` : colors.surface,
                      border: `1px solid ${selectedTemplate ? colors.accent : colors.border}`,
                      cursor: "pointer",
                      color: selectedTemplate ? colors.accent : colors.textSecondary,
                      fontSize: "0.8rem",
                    }}
                    title={selectedTemplate ? `Using: ${selectedTemplate.name}` : "Use Template"}
                  >
                    <Zap size={12} />
                    {selectedTemplate ? selectedTemplate.name : "Template"}
                    <ChevronDown size={12} />
                  </button>

                  {/* Template Dropdown */}
                  {showTemplateSelector && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        right: 0,
                        width: "280px",
                        maxHeight: "400px",
                        overflowY: "auto",
                        background: colors.surface,
                        border: `1px solid ${colors.border}`,
                        borderRadius: "8px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                        zIndex: 100,
                      }}
                    >
                      <div
                        style={{
                          padding: "12px",
                          borderBottom: `1px solid ${colors.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: colors.text }}>
                          Task Templates
                        </span>
                        <button
                          onClick={() => {
                            setShowTemplateSelector(false);
                            setShowTemplateManager(true);
                          }}
                          style={{
                            padding: "4px 8px",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: colors.accent,
                            fontSize: "0.75rem",
                          }}
                        >
                          Manage
                        </button>
                      </div>

                      {templates.length === 0 ? (
                        <div style={{ padding: "20px", textAlign: "center", color: colors.textMuted }}>
                          <Zap size={24} style={{ opacity: 0.5, marginBottom: "8px" }} />
                          <p style={{ fontSize: "0.85rem", margin: "0 0 8px 0" }}>No templates yet</p>
                          <p style={{ fontSize: "0.75rem", margin: 0 }}>
                            Save tasks as templates for quick reuse
                          </p>
                        </div>
                      ) : (
                        <>
                          {selectedTemplate && (
                            <div
                              style={{
                                padding: "8px 12px",
                                background: `${colors.accent}10`,
                                borderBottom: `1px solid ${colors.border}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <span style={{ fontSize: "0.75rem", color: colors.textSecondary }}>
                                Using: {selectedTemplate.name}
                              </span>
                              <button
                                onClick={() => setSelectedTemplate(null)}
                                style={{
                                  padding: "2px 6px",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: colors.textMuted,
                                  fontSize: "0.7rem",
                                }}
                              >
                                Clear
                              </button>
                            </div>
                          )}
                          {Object.entries(templatesByCategory).map(([category, categoryTemplates]) =>
                            categoryTemplates.length > 0 && (
                              <div key={category}>
                                {category !== "Uncategorized" && (
                                  <div
                                    style={{
                                      padding: "8px 12px 4px",
                                      fontSize: "0.7rem",
                                      color: colors.textMuted,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.5px",
                                    }}
                                  >
                                    {category}
                                  </div>
                                )}
                                {categoryTemplates.map((template) => (
                                  <button
                                    key={template.id}
                                    onClick={() => handleApplyTemplate(template)}
                                    style={{
                                      width: "100%",
                                      padding: "10px 12px",
                                      background: selectedTemplate?.id === template.id ? `${colors.accent}15` : "transparent",
                                      border: "none",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: "10px",
                                      textAlign: "left",
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = `${colors.accent}10`}
                                    onMouseLeave={(e) => e.currentTarget.style.background = selectedTemplate?.id === template.id ? `${colors.accent}15` : "transparent"}
                                  >
                                    <Zap size={14} color={colors.accent} style={{ marginTop: "2px" }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: "0.85rem", color: colors.text, fontWeight: 500 }}>
                                        {template.name}
                                      </div>
                                      {template.description && (
                                        <div
                                          style={{
                                            fontSize: "0.75rem",
                                            color: colors.textMuted,
                                            marginTop: "2px",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          {template.description}
                                        </div>
                                      )}
                                      <div
                                        style={{
                                          fontSize: "0.7rem",
                                          color: colors.textMuted,
                                          marginTop: "4px",
                                          display: "flex",
                                          gap: "8px",
                                        }}
                                      >
                                        {template.templateData.priority && template.templateData.priority !== "none" && (
                                          <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                                            <Flag size={10} color={PRIORITIES[template.templateData.priority as keyof typeof PRIORITIES]?.color || "#6b7280"} />
                                            {template.templateData.priority}
                                          </span>
                                        )}
                                        {template.templateData.labels?.length ? (
                                          <span>{template.templateData.labels.length} labels</span>
                                        ) : null}
                                        <span>Used {template.useCount}x</span>
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* + Task Button */}
                <button
                  onClick={() => {
                    if (selectedTemplate) {
                      createTaskFromTemplate(activeStatuses[0]?.id || "todo");
                    } else {
                      setAddingTaskInStatus(activeStatuses[0]?.id || "todo");
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 14px",
                    borderRadius: "4px",
                    background: `linear-gradient(135deg, ${colors.accent} 0%, #e6c200 100%)`,
                    border: "none",
                    color: "#000",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                >
                  <Plus size={14} />
                  {selectedTemplate ? "Create from Template" : "Task"}
                </button>
              </div>
            </div>
          </header>

          {/* Main Content Area - Conditional View Rendering */}
          <div style={{ flex: 1, overflowY: "auto", background: colors.headerBg }}>
            {loadingTasks ? (
              <div style={{ padding: "40px", textAlign: "center" }}>
                <Loader2
                  size={24}
                  style={{ color: colors.accent, animation: "spin 1s linear infinite" }}
                />
              </div>
            ) : selectedProject ? (
              <>
                {/* List View (default) */}
                {viewMode === "list" && (
                  <>
                    {/* Only show statuses that have tasks, or at minimum show first status */}
                    {activeStatuses
                      .filter((status, index) => {
                        const hasTasks = (tasksByStatus[status.id] || []).length > 0;
                        // Always show first status (TO DO) or statuses with tasks
                        return index === 0 || hasTasks;
                      })
                      .map(renderStatusGroup)}

                    {/* + New status button */}
                    <button
                      onClick={() => {
                        // For now, just show all statuses by clearing the filter logic
                        // In future: open a modal to create custom status
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "12px 16px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: colors.textMuted,
                        fontSize: "0.85rem",
                        width: "100%",
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = colors.text}
                      onMouseLeave={(e) => e.currentTarget.style.color = colors.textMuted}
                    >
                      <Plus size={14} />
                      New status
                    </button>
                  </>
                )}

                {/* Board View (Kanban) */}
                {viewMode === "board" && (
                  <BoardView
                    tasks={tasks}
                    statuses={activeStatuses}
                    onTaskClick={(task) => setEditingTaskId(task.id)}
                    onStatusChange={async (taskId, newStatus) => {
                      await handleUpdateTask(taskId, { status: newStatus });
                    }}
                    onTaskCreate={async (statusId, title) => {
                      if (title && selectedProject) {
                        try {
                          const newTask = await createTaskWithFallback({
                            project_id: selectedProject.id,
                            title,
                            status: statusId,
                            priority: "none",
                          });
                          setTasks((prev) => [...prev, newTask]);
                        } catch (err) {
                          console.error("Failed to create task from board:", err);
                          setError("Failed to create task.");
                        }
                      } else {
                        setAddingTaskInStatus(statusId);
                      }
                    }}
                    selectedTaskIds={selectedTaskIds}
                    onSelectTask={(taskId, selected) => {
                      setSelectedTaskIds(prev => {
                        const next = new Set(prev);
                        if (selected) {
                          next.add(taskId);
                        } else {
                          next.delete(taskId);
                        }
                        return next;
                      });
                    }}
                    users={USERS}
                  />
                )}

                {/* Calendar View */}
                {viewMode === "calendar" && (
                  <CalendarView
                    tasks={tasks}
                    onTaskClick={(task) => setEditingTaskId(task.id)}
                    onDateChange={async (taskId, newDate) => {
                      await handleUpdateTask(taskId, { dueAt: newDate || undefined });
                    }}
                    selectedTaskIds={selectedTaskIds}
                    onSelectTask={(taskId, selected) => {
                      setSelectedTaskIds(prev => {
                        const next = new Set(prev);
                        if (selected) {
                          next.add(taskId);
                        } else {
                          next.delete(taskId);
                        }
                        return next;
                      });
                    }}
                  />
                )}

                {/* Workload View */}
                {viewMode === "workload" && (
                  <WorkloadView
                    tasks={tasks}
                    users={USERS}
                    onTaskClick={(task) => setEditingTaskId(task.id)}
                    onAssigneeChange={async (taskId, newAssignee) => {
                      await handleUpdateTask(taskId, { assignees: newAssignee ? [newAssignee] : [] });
                    }}
                  />
                )}

                {/* Gantt Chart View */}
                {viewMode === "gantt" && (
                  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                    {/* Gantt Controls */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        borderBottom: `1px solid ${colors.border}`,
                        background: colors.surface,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {/* Navigation */}
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <button
                            onClick={() => {
                              const newDate = new Date(ganttStartDate);
                              newDate.setDate(newDate.getDate() - (ganttZoom === "day" ? 7 : ganttZoom === "week" ? 14 : 30));
                              setGanttStartDate(newDate);
                            }}
                            style={{
                              padding: "6px",
                              borderRadius: "4px",
                              background: colors.surfaceHover,
                              border: "none",
                              cursor: "pointer",
                              color: colors.text,
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            onClick={() => {
                              const today = new Date();
                              today.setDate(today.getDate() - 7);
                              setGanttStartDate(today);
                            }}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "4px",
                              background: colors.surfaceHover,
                              border: "none",
                              cursor: "pointer",
                              color: colors.text,
                              fontSize: "0.8rem",
                              fontWeight: 500,
                            }}
                          >
                            Today
                          </button>
                          <button
                            onClick={() => {
                              const newDate = new Date(ganttStartDate);
                              newDate.setDate(newDate.getDate() + (ganttZoom === "day" ? 7 : ganttZoom === "week" ? 14 : 30));
                              setGanttStartDate(newDate);
                            }}
                            style={{
                              padding: "6px",
                              borderRadius: "4px",
                              background: colors.surfaceHover,
                              border: "none",
                              cursor: "pointer",
                              color: colors.text,
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>

                        {/* Date Range Display */}
                        <span style={{ fontSize: "0.85rem", color: colors.textSecondary }}>
                          {ganttStartDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          {" - "}
                          {new Date(ganttStartDate.getTime() + ganttDaysToShow * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>

                      {/* Zoom Controls */}
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        {(["day", "week", "month"] as const).map((zoom) => (
                          <button
                            key={zoom}
                            onClick={() => {
                              setGanttZoom(zoom);
                              setGanttDaysToShow(zoom === "day" ? 14 : zoom === "week" ? 28 : 90);
                            }}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "4px",
                              background: ganttZoom === zoom ? colors.accent : colors.surfaceHover,
                              border: "none",
                              cursor: "pointer",
                              color: ganttZoom === zoom ? "#000" : colors.text,
                              fontSize: "0.8rem",
                              fontWeight: 500,
                            }}
                          >
                            {zoom.charAt(0).toUpperCase() + zoom.slice(1)}
                          </button>
                        ))}
                      </div>

                      {/* Critical Path Toggle */}
                      <button
                        onClick={() => setShowCriticalPath(!showCriticalPath)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          marginLeft: "12px",
                          borderRadius: "4px",
                          background: showCriticalPath ? "rgba(239, 68, 68, 0.2)" : colors.surfaceHover,
                          border: showCriticalPath ? "1px solid #ef4444" : `1px solid ${colors.border}`,
                          cursor: "pointer",
                          color: showCriticalPath ? "#ef4444" : colors.text,
                          fontSize: "0.8rem",
                          fontWeight: 500,
                          transition: "all 0.15s ease",
                        }}
                        title={`${showCriticalPath ? "Hide" : "Show"} Critical Path\n\nThe critical path is the longest sequence of dependent tasks that determines the minimum project duration. Tasks on the critical path have zero slack - any delay will delay the project.${showCriticalPath && criticalPathTaskIds.size > 0 ? `\n\n${criticalPathTaskIds.size} task${criticalPathTaskIds.size !== 1 ? "s" : ""} on critical path` : ""}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                        </svg>
                        Critical Path
                        {showCriticalPath && criticalPathTaskIds.size > 0 && (
                          <span
                            style={{
                              background: "#ef4444",
                              color: "white",
                              padding: "1px 6px",
                              borderRadius: "10px",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                            }}
                          >
                            {criticalPathTaskIds.size}
                          </span>
                        )}
                      </button>

                      {/* Auto-Schedule Button */}
                      <button
                        onClick={handleAutoSchedule}
                        disabled={isAutoScheduling}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          marginLeft: "8px",
                          borderRadius: "4px",
                          background: isAutoScheduling ? "rgba(34, 197, 94, 0.3)" : colors.surfaceHover,
                          border: `1px solid ${isAutoScheduling ? "#22c55e" : colors.border}`,
                          cursor: isAutoScheduling ? "wait" : "pointer",
                          color: isAutoScheduling ? "#22c55e" : colors.text,
                          fontSize: "0.8rem",
                          fontWeight: 500,
                          transition: "all 0.15s ease",
                          opacity: isAutoScheduling ? 0.8 : 1,
                        }}
                        title="Auto-Schedule Tasks&#10;&#10;Automatically adjust task dates based on dependencies and lag/lead times.&#10;&#10;• Finish-to-Start: Task starts after predecessor ends&#10;• Start-to-Start: Task starts when predecessor starts&#10;• Finish-to-Finish: Task ends when predecessor ends&#10;&#10;Lag (positive) adds delay, Lead (negative) allows overlap."
                      >
                        {isAutoScheduling ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                            <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                            <path d="M8 14l2 2 4-4" />
                          </svg>
                        )}
                        {isAutoScheduling ? "Scheduling..." : "Auto-Schedule"}
                      </button>

                      {/* Dependency Legend */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          marginLeft: "16px",
                          paddingLeft: "16px",
                          borderLeft: `1px solid ${colors.border}`,
                          fontSize: "0.75rem",
                          color: colors.textMuted,
                        }}
                      >
                        <span style={{ fontWeight: 500 }} title="Drag from task circle to create dependencies">Dependencies:</span>
                        <div
                          style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "help" }}
                          title="Finish-to-Start (Default)&#10;Task B waits for Task A to finish before starting&#10;&#10;Shortcut: Drag without modifier keys"
                        >
                          <div
                            style={{
                              width: "16px",
                              height: "3px",
                              background: "#6366f1",
                              borderRadius: "2px",
                            }}
                          />
                          <span>F→S</span>
                        </div>
                        <div
                          style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "help" }}
                          title="Start-to-Start&#10;Task B starts when Task A starts&#10;&#10;Shortcut: Hold Shift while dragging"
                        >
                          <div
                            style={{
                              width: "16px",
                              height: "3px",
                              background: "#f59e0b",
                              borderRadius: "2px",
                            }}
                          />
                          <span>S→S</span>
                        </div>
                        <div
                          style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "help" }}
                          title="Finish-to-Finish&#10;Task B finishes when Task A finishes&#10;&#10;Shortcut: Hold Ctrl/Cmd while dragging"
                        >
                          <div
                            style={{
                              width: "16px",
                              height: "3px",
                              background: "#10b981",
                              borderRadius: "2px",
                            }}
                          />
                          <span>F→F</span>
                        </div>
                      </div>
                    </div>

                    {/* Gantt Chart Container */}
                    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                      {/* Task List Sidebar */}
                      <div
                        style={{
                          width: "280px",
                          flexShrink: 0,
                          borderRight: `1px solid ${colors.border}`,
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        {/* Header */}
                        <div
                          style={{
                            height: "50px",
                            padding: "0 16px",
                            display: "flex",
                            alignItems: "center",
                            borderBottom: `1px solid ${colors.border}`,
                            background: colors.surfaceHover,
                          }}
                        >
                          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: colors.text }}>
                            Tasks ({filteredTasks.length})
                          </span>
                        </div>

                        {/* Task List */}
                        <div style={{ flex: 1, overflowY: "auto" }}>
                          {filteredTasks.map((task, index) => {
                            const statusInfo = activeStatuses.find(s => s.id === task.status);
                            const isBlocked = blockedTasks.has(task.id);
                            const isOnCriticalPath = showCriticalPath && criticalPathTaskIds.has(task.id);
                            const isScheduleLocked = lockedTaskIds.has(task.id);
                            return (
                              <div
                                key={task.id}
                                onClick={() => setEditingTaskId(task.id)}
                                style={{
                                  height: "40px",
                                  padding: "0 16px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                  borderBottom: `1px solid ${colors.border}`,
                                  cursor: "pointer",
                                  background: isOnCriticalPath
                                    ? "rgba(239, 68, 68, 0.1)"
                                    : index % 2 === 0 ? "transparent" : colors.surfaceHover,
                                }}
                              >
                                <div
                                  style={{
                                    width: "8px",
                                    height: "8px",
                                    borderRadius: "50%",
                                    background: isOnCriticalPath ? "#ef4444" : (statusInfo?.color || "#6b7280"),
                                    flexShrink: 0,
                                    boxShadow: isOnCriticalPath ? "0 0 6px rgba(239, 68, 68, 0.6)" : "none",
                                  }}
                                />
                                {isOnCriticalPath && (
                                  <svg
                                    width="10"
                                    height="10"
                                    viewBox="0 0 24 24"
                                    fill="#ef4444"
                                    style={{ flexShrink: 0, marginLeft: "-6px" }}
                                  >
                                    <title>Critical Path</title>
                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                  </svg>
                                )}
                                {isScheduleLocked && (
                                  <span title="Locked from auto-schedule" style={{ display: "flex", flexShrink: 0 }}>
                                    <Lock size={10} color="#f59e0b" />
                                  </span>
                                )}
                                {isBlocked && <Lock size={10} color="#ef4444" />}
                                <span
                                  style={{
                                    fontSize: "0.8rem",
                                    color: task.status === "done" ? colors.textMuted : colors.text,
                                    textDecoration: task.status === "done" ? "line-through" : "none",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {task.title}
                                </span>
                              </div>
                            );
                          })}

                          {/* Milestones label row (synced with timeline) */}
                          {milestones.length > 0 && (
                            <div
                              style={{
                                height: "28px",
                                padding: "0 16px",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                borderBottom: `1px solid ${colors.border}`,
                                background: "rgba(99, 102, 241, 0.08)",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                color: colors.textMuted,
                                flexShrink: 0,
                              }}
                            >
                              <div
                                style={{
                                  width: "8px",
                                  height: "8px",
                                  background: "#6366f1",
                                  transform: "rotate(45deg)",
                                  flexShrink: 0,
                                }}
                              />
                              Milestones ({milestones.length})
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Timeline Area */}
                      <div
                        ref={ganttTimelineRef}
                        onClick={handleGanttTimelineClick}
                        style={{ flex: 1, overflow: "auto", cursor: "crosshair" }}
                      >
                        {/* Timeline Header */}
                        <div
                          style={{
                            height: "50px",
                            display: "flex",
                            borderBottom: `1px solid ${colors.border}`,
                            background: colors.surfaceHover,
                            position: "sticky",
                            top: 0,
                            zIndex: 10,
                          }}
                        >
                          {Array.from({ length: ganttDaysToShow }).map((_, i) => {
                            const date = new Date(ganttStartDate);
                            date.setDate(date.getDate() + i);
                            const isToday = date.toDateString() === new Date().toDateString();
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                            const showLabel = ganttZoom === "day" || (ganttZoom === "week" && date.getDay() === 1) || (ganttZoom === "month" && date.getDate() === 1);
                            const columnWidth = ganttZoom === "day" ? 40 : ganttZoom === "week" ? 24 : 12;

                            return (
                              <div
                                key={i}
                                style={{
                                  width: `${columnWidth}px`,
                                  flexShrink: 0,
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  borderRight: `1px solid ${isWeekend ? colors.border : "rgba(255,255,255,0.05)"}`,
                                  background: isToday
                                    ? "rgba(255,215,0,0.15)"
                                    : isWeekend
                                    ? "rgba(255,255,255,0.02)"
                                    : "transparent",
                                }}
                              >
                                {showLabel && (
                                  <>
                                    <span style={{ fontSize: "0.65rem", color: colors.textMuted }}>
                                      {date.toLocaleDateString("en-US", { weekday: "short" })}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: "0.75rem",
                                        fontWeight: isToday ? 700 : 500,
                                        color: isToday ? "#FFD700" : colors.text,
                                      }}
                                    >
                                      {date.getDate()}
                                    </span>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Milestone Markers Row */}
                        {milestones.length > 0 && (
                          <div
                            style={{
                              height: "28px",
                              display: "flex",
                              position: "relative",
                              borderBottom: `1px solid ${colors.border}`,
                              background: "rgba(99, 102, 241, 0.05)",
                            }}
                          >
                            {/* Background grid for milestone row */}
                            <div style={{ position: "absolute", inset: 0, display: "flex" }}>
                              {Array.from({ length: ganttDaysToShow }).map((_, i) => {
                                const columnWidth = ganttZoom === "day" ? 40 : ganttZoom === "week" ? 24 : 12;
                                const date = new Date(ganttStartDate);
                                date.setDate(date.getDate() + i);
                                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                return (
                                  <div
                                    key={i}
                                    style={{
                                      width: `${columnWidth}px`,
                                      flexShrink: 0,
                                      borderRight: `1px solid ${isWeekend ? colors.border : "rgba(255,255,255,0.03)"}`,
                                    }}
                                  />
                                );
                              })}
                            </div>

                            {/* Milestone diamonds */}
                            {milestones.map(milestone => {
                              if (!milestone.dueDate) return null;
                              const columnWidth = ganttZoom === "day" ? 40 : ganttZoom === "week" ? 24 : 12;
                              const msDate = new Date(milestone.dueDate);
                              const daysDiff = Math.floor((msDate.getTime() - ganttStartDate.getTime()) / (24 * 60 * 60 * 1000));
                              const msLeft = daysDiff * columnWidth + columnWidth / 2;

                              // Skip if outside visible range
                              if (msLeft < -20 || msLeft > ganttDaysToShow * columnWidth + 20) return null;

                              const isCompleted = milestone.status === "completed";
                              const isPast = msDate < new Date() && !isCompleted;

                              return (
                                <div
                                  key={milestone.id}
                                  title={`${milestone.name}\nDue: ${msDate.toLocaleDateString()}\nStatus: ${milestone.status}\nProgress: ${milestone.progress}%`}
                                  onClick={() => setShowMilestoneManager(true)}
                                  style={{
                                    position: "absolute",
                                    left: `${msLeft}px`,
                                    top: "50%",
                                    transform: "translate(-50%, -50%) rotate(45deg)",
                                    width: "12px",
                                    height: "12px",
                                    background: isCompleted
                                      ? "#22c55e"
                                      : isPast
                                      ? "#ef4444"
                                      : milestone.color || "#6366f1",
                                    border: `2px solid ${isCompleted ? "#16a34a" : isPast ? "#dc2626" : milestone.color || "#4f46e5"}`,
                                    cursor: "pointer",
                                    boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                                    zIndex: 5,
                                  }}
                                />
                              );
                            })}

                          </div>
                        )}

                        {/* Task Bars */}
                        <div style={{ position: "relative" }}>
                          {/* Dependency Arrows SVG Overlay */}
                          <svg
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: `${ganttDaysToShow * (ganttZoom === "day" ? 40 : ganttZoom === "week" ? 24 : 12)}px`,
                              height: `${filteredTasks.length * 40}px`,
                              pointerEvents: "none",
                              zIndex: 5,
                              overflow: "visible",
                            }}
                          >
                            <defs>
                              {/* Arrow markers - normal state */}
                              <marker id="arrowhead-fts" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                                <polygon points="0 0, 8 3, 0 6" fill="#6366f1" />
                              </marker>
                              <marker id="arrowhead-sts" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                                <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" />
                              </marker>
                              <marker id="arrowhead-ftf" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                                <polygon points="0 0, 8 3, 0 6" fill="#10b981" />
                              </marker>
                              {/* Arrow markers - highlighted state */}
                              <marker id="arrowhead-fts-hover" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                                <polygon points="0 0, 10 4, 0 8" fill="#818cf8" />
                              </marker>
                              <marker id="arrowhead-sts-hover" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                                <polygon points="0 0, 10 4, 0 8" fill="#fbbf24" />
                              </marker>
                              <marker id="arrowhead-ftf-hover" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                                <polygon points="0 0, 10 4, 0 8" fill="#34d399" />
                              </marker>
                              {/* Glow filter for hover effect */}
                              <filter id="dependency-glow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                <feMerge>
                                  <feMergeNode in="coloredBlur" />
                                  <feMergeNode in="SourceGraphic" />
                                </feMerge>
                              </filter>
                            </defs>
                            {filteredTasks.flatMap((task, taskIndex) => {
                              const deps = taskDependencies[task.id] || [];
                              return deps.map(dep => {
                                const depTask = filteredTasks.find(t => t.id === dep.dependsOnTaskId);
                                if (!depTask) return null;
                                const depIndex = filteredTasks.indexOf(depTask);
                                if (depIndex === -1) return null;

                                const depKey = `${task.id}-${dep.id}`;
                                const isHovered = hoveredDependency === depKey;
                                const columnWidth = ganttZoom === "day" ? 40 : ganttZoom === "week" ? 24 : 12;
                                const rowHeight = 40;
                                const barTopOffset = 8;
                                const barHeight = 24;

                                // Get blocking task (depTask) bar position
                                const depStartDate = depTask.startAt ? new Date(depTask.startAt) : depTask.dueAt ? new Date(depTask.dueAt) : null;
                                const depEndDate = depTask.dueAt ? new Date(depTask.dueAt) : depStartDate;
                                if (!depStartDate || !depEndDate) return null;

                                const depDaysDiff = Math.floor((depStartDate.getTime() - ganttStartDate.getTime()) / (24 * 60 * 60 * 1000));
                                const depDuration = Math.max(1, Math.ceil((depEndDate.getTime() - depStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1);
                                const depBarLeft = depDaysDiff * columnWidth;
                                const depBarWidth = depDuration * columnWidth;

                                // Get dependent task bar position
                                const taskStartDate = task.startAt ? new Date(task.startAt) : task.dueAt ? new Date(task.dueAt) : null;
                                const taskEndDate = task.dueAt ? new Date(task.dueAt) : taskStartDate;
                                if (!taskStartDate || !taskEndDate) return null;

                                const taskDaysDiff = Math.floor((taskStartDate.getTime() - ganttStartDate.getTime()) / (24 * 60 * 60 * 1000));
                                const taskDuration = Math.max(1, Math.ceil((taskEndDate.getTime() - taskStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1);
                                const taskBarLeft = taskDaysDiff * columnWidth;
                                const taskBarWidth = taskDuration * columnWidth;

                                // Calculate connection points based on dependency type
                                let startX: number, startY: number, endX: number, endY: number;
                                let arrowColor: string;
                                let arrowColorHover: string;
                                let markerId: string;
                                let markerIdHover: string;
                                let depTypeLabel: string;

                                switch (dep.dependencyType) {
                                  case "start_to_start":
                                    startX = Math.max(0, depBarLeft);
                                    startY = depIndex * rowHeight + barTopOffset + barHeight / 2;
                                    endX = Math.max(0, taskBarLeft);
                                    endY = taskIndex * rowHeight + barTopOffset + barHeight / 2;
                                    arrowColor = "#f59e0b";
                                    arrowColorHover = "#fbbf24";
                                    markerId = "url(#arrowhead-sts)";
                                    markerIdHover = "url(#arrowhead-sts-hover)";
                                    depTypeLabel = "Start → Start";
                                    break;
                                  case "finish_to_finish":
                                    startX = depBarLeft + depBarWidth;
                                    startY = depIndex * rowHeight + barTopOffset + barHeight / 2;
                                    endX = taskBarLeft + taskBarWidth;
                                    endY = taskIndex * rowHeight + barTopOffset + barHeight / 2;
                                    arrowColor = "#10b981";
                                    arrowColorHover = "#34d399";
                                    markerId = "url(#arrowhead-ftf)";
                                    markerIdHover = "url(#arrowhead-ftf-hover)";
                                    depTypeLabel = "Finish → Finish";
                                    break;
                                  case "finish_to_start":
                                  default:
                                    startX = depBarLeft + depBarWidth;
                                    startY = depIndex * rowHeight + barTopOffset + barHeight / 2;
                                    endX = Math.max(0, taskBarLeft);
                                    endY = taskIndex * rowHeight + barTopOffset + barHeight / 2;
                                    arrowColor = "#6366f1";
                                    arrowColorHover = "#818cf8";
                                    markerId = "url(#arrowhead-fts)";
                                    markerIdHover = "url(#arrowhead-fts-hover)";
                                    depTypeLabel = "Finish → Start";
                                    break;
                                }

                                // Skip if both points are outside visible area
                                const maxX = ganttDaysToShow * columnWidth;
                                if ((startX < 0 && endX < 0) || (startX > maxX && endX > maxX)) return null;

                                // Calculate path
                                const midX = startX + (endX - startX) / 2;
                                const horizontalGap = endX - startX;

                                let pathD: string;
                                if (Math.abs(taskIndex - depIndex) <= 1 && horizontalGap > 30) {
                                  pathD = `M ${startX} ${startY} C ${startX + 20} ${startY}, ${endX - 20} ${endY}, ${endX} ${endY}`;
                                } else if (horizontalGap > 0) {
                                  const curveOffset = Math.min(30, horizontalGap / 3);
                                  pathD = `M ${startX} ${startY}
                                           C ${startX + curveOffset} ${startY},
                                             ${startX + curveOffset} ${startY + (endY - startY) * 0.3},
                                             ${midX} ${startY + (endY - startY) * 0.5}
                                           S ${endX - curveOffset} ${endY},
                                             ${endX} ${endY}`;
                                } else {
                                  const loopOffset = 25;
                                  const midY = (startY + endY) / 2;
                                  pathD = `M ${startX} ${startY}
                                           L ${startX + loopOffset} ${startY}
                                           Q ${startX + loopOffset + 10} ${startY}, ${startX + loopOffset + 10} ${startY + (midY - startY) * 0.5}
                                           L ${startX + loopOffset + 10} ${midY}
                                           Q ${startX + loopOffset + 10} ${endY - (midY - startY) * 0.5}, ${endX - loopOffset} ${endY}
                                           L ${endX} ${endY}`;
                                }

                                // Lag/lead time label
                                const lagLabel = dep.lagDays > 0
                                  ? `+${dep.lagDays}d lag`
                                  : dep.lagDays < 0
                                  ? `${dep.lagDays}d lead`
                                  : "";

                                // Tooltip text
                                const tooltipText = `${depTask.title} → ${task.title}\n${depTypeLabel}${lagLabel ? `\n${lagLabel}` : ""}\nClick to edit`;

                                return (
                                  <g
                                    key={depKey}
                                    style={{
                                      cursor: "pointer",
                                      pointerEvents: "auto",
                                      transition: "opacity 0.15s ease",
                                    }}
                                    onMouseEnter={() => setHoveredDependency(depKey)}
                                    onMouseLeave={() => setHoveredDependency(null)}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const rect = (e.target as SVGElement).ownerSVGElement?.getBoundingClientRect();
                                      setEditingDependency({
                                        taskId: task.id,
                                        dependsOnTaskId: dep.dependsOnTaskId,
                                        dep,
                                        x: e.clientX - (rect?.left || 0),
                                        y: e.clientY - (rect?.top || 0),
                                        fromTaskTitle: depTask.title,
                                        toTaskTitle: task.title,
                                      });
                                      setEditingLagDays(dep.lagDays);
                                      setHoveredDependency(null);
                                    }}
                                  >
                                    <title>{tooltipText}</title>
                                    {/* Invisible wider hit area for easier hovering */}
                                    <path
                                      d={pathD}
                                      fill="none"
                                      stroke="transparent"
                                      strokeWidth="12"
                                      strokeLinecap="round"
                                    />
                                    {/* Shadow/glow effect */}
                                    <path
                                      d={pathD}
                                      fill="none"
                                      stroke={isHovered ? arrowColorHover : "rgba(0,0,0,0.3)"}
                                      strokeWidth={isHovered ? 8 : 4}
                                      strokeLinecap="round"
                                      opacity={isHovered ? 0.4 : 1}
                                      filter={isHovered ? "url(#dependency-glow)" : undefined}
                                      style={{ transition: "all 0.15s ease" }}
                                    />
                                    {/* Main arrow line */}
                                    <path
                                      d={pathD}
                                      fill="none"
                                      stroke={isHovered ? arrowColorHover : arrowColor}
                                      strokeWidth={isHovered ? 3 : 2}
                                      strokeLinecap="round"
                                      markerEnd={isHovered ? markerIdHover : markerId}
                                      opacity={isHovered ? 1 : 0.8}
                                      style={{ transition: "all 0.15s ease" }}
                                    />
                                    {/* Start circle */}
                                    <circle
                                      cx={startX}
                                      cy={startY}
                                      r={isHovered ? 6 : 4}
                                      fill={isHovered ? arrowColorHover : arrowColor}
                                      stroke={isHovered ? "white" : "rgba(0,0,0,0.3)"}
                                      strokeWidth={isHovered ? 2 : 1}
                                      style={{ transition: "all 0.15s ease" }}
                                    />
                                    {/* End circle (visible on hover) */}
                                    {isHovered && (
                                      <>
                                        <circle
                                          cx={endX}
                                          cy={endY}
                                          r="6"
                                          fill={arrowColorHover}
                                          stroke="white"
                                          strokeWidth="2"
                                        />
                                        {/* Edit indicator on hover */}
                                        <g transform={`translate(${(startX + endX) / 2 - 8}, ${(startY + endY) / 2 - 8})`}>
                                          <circle cx="8" cy="8" r="10" fill="rgba(99, 102, 241, 0.9)" stroke="white" strokeWidth="1.5" />
                                          <path d="M5 11 L7 9 L11 5 L13 7 L9 11 L7 13 Z" fill="white" />
                                          <line x1="11" y1="5" x2="13" y2="7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                                        </g>
                                      </>
                                    )}
                                    {/* Lag/lead time label on arrow */}
                                    {dep.lagDays !== 0 && !isHovered && (
                                      <g transform={`translate(${(startX + endX) / 2}, ${(startY + endY) / 2})`}>
                                        <rect
                                          x="-16"
                                          y="-8"
                                          width="32"
                                          height="16"
                                          rx="4"
                                          fill={dep.lagDays > 0 ? "rgba(239, 68, 68, 0.85)" : "rgba(34, 197, 94, 0.85)"}
                                          stroke="white"
                                          strokeWidth="1"
                                        />
                                        <text
                                          x="0"
                                          y="4"
                                          textAnchor="middle"
                                          fill="white"
                                          fontSize="9"
                                          fontWeight="600"
                                        >
                                          {dep.lagDays > 0 ? `+${dep.lagDays}d` : `${dep.lagDays}d`}
                                        </text>
                                      </g>
                                    )}
                                  </g>
                                );
                              });
                            })}

                            {/* Dependency drag preview line */}
                            {dependencyDrag && (() => {
                              const depType = dependencyDrag.dependencyType;
                              const isStartToStart = depType === "start_to_start";
                              const isFinishToFinish = depType === "finish_to_finish";
                              const baseColor = isStartToStart ? "#f59e0b" : isFinishToFinish ? "#10b981" : "#6366f1";
                              const activeColor = dependencyDrag.targetTaskId ? "#22c55e" : baseColor;
                              const depTypeLabel = isStartToStart ? "Start → Start" : isFinishToFinish ? "Finish → Finish" : "Finish → Start";
                              const depTypeShort = isStartToStart ? "S→S" : isFinishToFinish ? "F→F" : "F→S";

                              // Hint text for switching modes
                              let hintText = "";
                              let hintWidth = 150;
                              if (isStartToStart) {
                                hintText = "Release Shift for F→S, Ctrl for F→F";
                                hintWidth = 175;
                              } else if (isFinishToFinish) {
                                hintText = "Release Ctrl for F→S, Shift for S→S";
                                hintWidth = 180;
                              } else {
                                hintText = "Shift: S→S, Ctrl: F→F";
                                hintWidth = 115;
                              }

                              return (
                                <g>
                                  {/* Animated dashed line from source to cursor */}
                                  <path
                                    d={`M ${dependencyDrag.startX} ${dependencyDrag.startY}
                                        C ${dependencyDrag.startX + (isStartToStart ? -30 : 30)} ${dependencyDrag.startY},
                                          ${dependencyDrag.currentX - 30} ${dependencyDrag.currentY},
                                          ${dependencyDrag.currentX} ${dependencyDrag.currentY}`}
                                    fill="none"
                                    stroke={activeColor}
                                    strokeWidth="3"
                                    strokeDasharray="8,4"
                                    strokeLinecap="round"
                                    opacity="0.9"
                                    style={{
                                      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                                    }}
                                  >
                                    <animate
                                      attributeName="stroke-dashoffset"
                                      values="24;0"
                                      dur="0.5s"
                                      repeatCount="indefinite"
                                    />
                                  </path>
                                  {/* Source circle */}
                                  <circle
                                    cx={dependencyDrag.startX}
                                    cy={dependencyDrag.startY}
                                    r="6"
                                    fill={baseColor}
                                    stroke="white"
                                    strokeWidth="2"
                                  />
                                  {/* Cursor circle */}
                                  <circle
                                    cx={dependencyDrag.currentX}
                                    cy={dependencyDrag.currentY}
                                    r={dependencyDrag.targetTaskId ? 8 : 5}
                                    fill={activeColor}
                                    stroke="white"
                                    strokeWidth="2"
                                    style={{
                                      filter: dependencyDrag.targetTaskId
                                        ? "drop-shadow(0 0 8px rgba(34, 197, 94, 0.8))"
                                        : "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                                    }}
                                  />
                                  {/* Label showing dependency type and action */}
                                  <g transform={`translate(${dependencyDrag.currentX + 15}, ${dependencyDrag.currentY - 10})`}>
                                    <rect
                                      x="0"
                                      y="-10"
                                      width={dependencyDrag.targetTaskId ? 135 : 150}
                                      height="20"
                                      rx="4"
                                      fill="rgba(0,0,0,0.85)"
                                    />
                                    <text
                                      x="6"
                                      y="3"
                                      fill="white"
                                      fontSize="10"
                                      fontFamily="system-ui, sans-serif"
                                    >
                                      {dependencyDrag.targetTaskId
                                        ? `${depTypeLabel} • Release`
                                        : `${depTypeLabel} • Drop on task`}
                                    </text>
                                  </g>
                                  {/* Modifier key hints */}
                                  {!dependencyDrag.targetTaskId && (
                                    <g transform={`translate(${dependencyDrag.currentX + 15}, ${dependencyDrag.currentY + 15})`}>
                                      <rect
                                        x="0"
                                        y="-10"
                                        width={hintWidth}
                                        height="18"
                                        rx="3"
                                        fill="rgba(0,0,0,0.6)"
                                      />
                                      <text
                                        x="6"
                                        y="2"
                                        fill="#9ca3af"
                                        fontSize="9"
                                        fontFamily="system-ui, sans-serif"
                                      >
                                        {hintText}
                                      </text>
                                    </g>
                                  )}
                                </g>
                              );
                            })()}
                          </svg>

                          {/* Pending Dependency Creation Popover */}
                          {pendingDependency && (
                            <div
                              style={{
                                position: "absolute",
                                left: `${pendingDependency.x}px`,
                                top: `${pendingDependency.y}px`,
                                transform: "translate(-50%, -100%) translateY(-10px)",
                                background: colors.surface,
                                border: `1px solid ${colors.border}`,
                                borderRadius: "8px",
                                padding: "12px",
                                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                                zIndex: 100,
                                minWidth: "220px",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: colors.text, marginBottom: "4px" }}>
                                Create Dependency
                              </div>
                              <div style={{ fontSize: "0.7rem", color: colors.textMuted, marginBottom: "8px" }}>
                                {pendingDependency.sourceTaskTitle} → {pendingDependency.targetTaskTitle}
                              </div>
                              <div style={{
                                fontSize: "0.7rem",
                                color: pendingDependency.dependencyType === "finish_to_start" ? "#6366f1" :
                                       pendingDependency.dependencyType === "start_to_start" ? "#f59e0b" : "#10b981",
                                marginBottom: "12px",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}>
                                <div style={{
                                  width: "8px",
                                  height: "3px",
                                  background: pendingDependency.dependencyType === "finish_to_start" ? "#6366f1" :
                                              pendingDependency.dependencyType === "start_to_start" ? "#f59e0b" : "#10b981",
                                  borderRadius: "1px",
                                }} />
                                {pendingDependency.dependencyType === "finish_to_start" ? "Finish → Start" :
                                 pendingDependency.dependencyType === "start_to_start" ? "Start → Start" : "Finish → Finish"}
                              </div>

                              {/* Lag/Lead input */}
                              <div style={{ marginBottom: "12px" }}>
                                <label style={{ display: "block", fontSize: "0.75rem", color: colors.text, marginBottom: "4px" }}>
                                  Lag / Lead Time
                                </label>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <button
                                    onClick={() => setPendingLagDays(prev => prev - 1)}
                                    style={{
                                      width: "28px",
                                      height: "28px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      background: colors.surfaceHover,
                                      border: `1px solid ${colors.border}`,
                                      borderRadius: "4px",
                                      color: colors.text,
                                      fontSize: "1rem",
                                      cursor: "pointer",
                                    }}
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    value={pendingLagDays}
                                    onChange={(e) => setPendingLagDays(parseInt(e.target.value) || 0)}
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleConfirmDependency();
                                      if (e.key === "Escape") setPendingDependency(null);
                                    }}
                                    style={{
                                      width: "50px",
                                      padding: "6px 4px",
                                      background: colors.surfaceHover,
                                      border: `1px solid ${colors.border}`,
                                      borderRadius: "4px",
                                      color: colors.text,
                                      fontSize: "0.85rem",
                                      textAlign: "center",
                                    }}
                                  />
                                  <button
                                    onClick={() => setPendingLagDays(prev => prev + 1)}
                                    style={{
                                      width: "28px",
                                      height: "28px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      background: colors.surfaceHover,
                                      border: `1px solid ${colors.border}`,
                                      borderRadius: "4px",
                                      color: colors.text,
                                      fontSize: "1rem",
                                      cursor: "pointer",
                                    }}
                                  >
                                    +
                                  </button>
                                  <span style={{ fontSize: "0.8rem", color: colors.textMuted }}>days</span>
                                </div>
                                <div style={{ fontSize: "0.65rem", color: colors.textMuted, marginTop: "4px" }}>
                                  {pendingLagDays > 0 ? `+${pendingLagDays} day lag (delay)` :
                                   pendingLagDays < 0 ? `${pendingLagDays} day lead (overlap)` : "No lag or lead (0)"}
                                </div>
                              </div>

                              {/* Action buttons */}
                              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                                <button
                                  onClick={() => setPendingDependency(null)}
                                  style={{
                                    padding: "6px 12px",
                                    background: "transparent",
                                    border: `1px solid ${colors.border}`,
                                    borderRadius: "4px",
                                    color: colors.text,
                                    fontSize: "0.75rem",
                                    cursor: "pointer",
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleConfirmDependency}
                                  style={{
                                    padding: "6px 12px",
                                    background: "rgba(34, 197, 94, 0.2)",
                                    border: "1px solid #22c55e",
                                    borderRadius: "4px",
                                    color: "#22c55e",
                                    fontSize: "0.75rem",
                                    cursor: "pointer",
                                  }}
                                >
                                  Create
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Dependency Editor Popover */}
                          {editingDependency && (
                            <div
                              style={{
                                position: "absolute",
                                left: `${editingDependency.x}px`,
                                top: `${editingDependency.y}px`,
                                transform: "translate(-50%, -100%) translateY(-10px)",
                                background: colors.surface,
                                border: `1px solid ${colors.border}`,
                                borderRadius: "8px",
                                padding: "12px",
                                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                                zIndex: 100,
                                minWidth: "220px",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div style={{ fontSize: "0.75rem", color: colors.textMuted, marginBottom: "8px" }}>
                                {editingDependency.fromTaskTitle} → {editingDependency.toTaskTitle}
                              </div>
                              <div style={{ fontSize: "0.7rem", color: colors.textMuted, marginBottom: "12px" }}>
                                {editingDependency.dep.dependencyType === "finish_to_start" ? "Finish → Start" :
                                 editingDependency.dep.dependencyType === "start_to_start" ? "Start → Start" : "Finish → Finish"}
                              </div>

                              {/* Lag/Lead input */}
                              <div style={{ marginBottom: "12px" }}>
                                <label style={{ display: "block", fontSize: "0.75rem", color: colors.text, marginBottom: "4px" }}>
                                  Lag / Lead Time
                                </label>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <button
                                    onClick={() => setEditingLagDays(prev => prev - 1)}
                                    style={{
                                      width: "28px",
                                      height: "28px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      background: colors.surfaceHover,
                                      border: `1px solid ${colors.border}`,
                                      borderRadius: "4px",
                                      color: colors.text,
                                      fontSize: "1rem",
                                      cursor: "pointer",
                                    }}
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    value={editingLagDays}
                                    onChange={(e) => setEditingLagDays(parseInt(e.target.value) || 0)}
                                    style={{
                                      width: "50px",
                                      padding: "6px 4px",
                                      background: colors.surfaceHover,
                                      border: `1px solid ${colors.border}`,
                                      borderRadius: "4px",
                                      color: colors.text,
                                      fontSize: "0.85rem",
                                      textAlign: "center",
                                    }}
                                  />
                                  <button
                                    onClick={() => setEditingLagDays(prev => prev + 1)}
                                    style={{
                                      width: "28px",
                                      height: "28px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      background: colors.surfaceHover,
                                      border: `1px solid ${colors.border}`,
                                      borderRadius: "4px",
                                      color: colors.text,
                                      fontSize: "1rem",
                                      cursor: "pointer",
                                    }}
                                  >
                                    +
                                  </button>
                                  <span style={{ fontSize: "0.8rem", color: colors.textMuted }}>days</span>
                                </div>
                                <div style={{ fontSize: "0.65rem", color: colors.textMuted, marginTop: "4px" }}>
                                  {editingLagDays > 0 ? `+${editingLagDays} day lag (delay)` :
                                   editingLagDays < 0 ? `${editingLagDays} day lead (overlap)` : "No lag or lead"}
                                </div>
                              </div>

                              {/* Action buttons */}
                              <div style={{ display: "flex", gap: "8px", justifyContent: "space-between" }}>
                                <button
                                  onClick={() => {
                                    handleRemoveDependency(editingDependency.taskId, editingDependency.dependsOnTaskId);
                                    setEditingDependency(null);
                                  }}
                                  style={{
                                    padding: "6px 12px",
                                    background: "rgba(239, 68, 68, 0.2)",
                                    border: "1px solid #ef4444",
                                    borderRadius: "4px",
                                    color: "#ef4444",
                                    fontSize: "0.75rem",
                                    cursor: "pointer",
                                  }}
                                >
                                  Remove
                                </button>
                                <div style={{ display: "flex", gap: "8px" }}>
                                  <button
                                    onClick={() => setEditingDependency(null)}
                                    style={{
                                      padding: "6px 12px",
                                      background: "transparent",
                                      border: `1px solid ${colors.border}`,
                                      borderRadius: "4px",
                                      color: colors.text,
                                      fontSize: "0.75rem",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleUpdateDependencyLag(
                                      editingDependency.taskId,
                                      editingDependency.dependsOnTaskId,
                                      editingLagDays
                                    )}
                                    style={{
                                      padding: "6px 12px",
                                      background: "rgba(99, 102, 241, 0.2)",
                                      border: "1px solid #6366f1",
                                      borderRadius: "4px",
                                      color: "#6366f1",
                                      fontSize: "0.75rem",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Undo/Redo Toast */}
                          {showUndoToast && (dependencyUndoStack.length > 0 || dependencyRedoStack.length > 0 || scheduleUndoStack.length > 0 || scheduleRedoStack.length > 0) && (
                            <div
                              style={{
                                position: "fixed",
                                bottom: "24px",
                                left: "50%",
                                transform: "translateX(-50%)",
                                background: colors.surface,
                                border: `1px solid ${colors.border}`,
                                borderRadius: "8px",
                                padding: "10px 16px",
                                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                                zIndex: 1000,
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                animation: "slideUp 0.2s ease-out",
                              }}
                            >
                              <span style={{ fontSize: "0.85rem", color: colors.text }}>
                                {lastActionType === "undo" ? (
                                  "Action undone"
                                ) : lastActionType === "redo" ? (
                                  "Action redone"
                                ) : lastActionType === "schedule" && scheduleUndoStack.length > 0 ? (
                                  `Auto-scheduled ${scheduleUndoStack[scheduleUndoStack.length - 1].changes.length} task${scheduleUndoStack[scheduleUndoStack.length - 1].changes.length === 1 ? "" : "s"}`
                                ) : dependencyUndoStack.length > 0 ? (
                                  dependencyUndoStack[dependencyUndoStack.length - 1].type === "create"
                                    ? "Dependency created"
                                    : dependencyUndoStack[dependencyUndoStack.length - 1].type === "delete"
                                    ? "Dependency removed"
                                    : "Lag time updated"
                                ) : ""}
                              </span>

                              {/* Undo button */}
                              {(dependencyUndoStack.length > 0 || scheduleUndoStack.length > 0) && (
                                <button
                                  onClick={handleUndo}
                                  style={{
                                    padding: "4px 12px",
                                    background: "rgba(99, 102, 241, 0.2)",
                                    border: "1px solid #6366f1",
                                    borderRadius: "4px",
                                    color: "#6366f1",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                  title="Undo (Ctrl+Z)"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 10h10a5 5 0 0 1 5 5v2M3 10l4-4M3 10l4 4" />
                                  </svg>
                                  Undo
                                </button>
                              )}

                              {/* Redo button */}
                              {(dependencyRedoStack.length > 0 || scheduleRedoStack.length > 0) && (
                                <button
                                  onClick={handleRedo}
                                  style={{
                                    padding: "4px 12px",
                                    background: "rgba(34, 197, 94, 0.2)",
                                    border: "1px solid #22c55e",
                                    borderRadius: "4px",
                                    color: "#22c55e",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                  title="Redo (Ctrl+Shift+Z)"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 10H11a5 5 0 0 0-5 5v2M21 10l-4-4M21 10l-4 4" />
                                  </svg>
                                  Redo
                                </button>
                              )}

                              <button
                                onClick={() => setShowUndoToast(false)}
                                style={{
                                  padding: "4px",
                                  background: "transparent",
                                  border: "none",
                                  color: colors.textMuted,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                              </button>
                              <span style={{ fontSize: "0.65rem", color: colors.textMuted }}>
                                {(dependencyUndoStack.length > 0 || scheduleUndoStack.length > 0) && (dependencyRedoStack.length > 0 || scheduleRedoStack.length > 0)
                                  ? "Z / ⇧Z"
                                  : (dependencyRedoStack.length > 0 || scheduleRedoStack.length > 0)
                                  ? "⇧Z"
                                  : "Z"}
                              </span>
                            </div>
                          )}

                          {/* Milestone vertical lines (behind task bars) */}
                          {milestones.map(milestone => {
                            if (!milestone.dueDate) return null;
                            const columnWidth = ganttZoom === "day" ? 40 : ganttZoom === "week" ? 24 : 12;
                            const msDate = new Date(milestone.dueDate);
                            const daysDiff = Math.floor((msDate.getTime() - ganttStartDate.getTime()) / (24 * 60 * 60 * 1000));
                            const msLeft = daysDiff * columnWidth + columnWidth / 2;

                            // Skip if outside visible range
                            if (msLeft < 0 || msLeft > ganttDaysToShow * columnWidth) return null;

                            const isCompleted = milestone.status === "completed";

                            return (
                              <div
                                key={`line-${milestone.id}`}
                                style={{
                                  position: "absolute",
                                  left: `${msLeft}px`,
                                  top: 0,
                                  bottom: 0,
                                  width: "2px",
                                  background: `linear-gradient(to bottom, ${milestone.color || "#6366f1"}60, ${milestone.color || "#6366f1"}20)`,
                                  opacity: isCompleted ? 0.4 : 0.6,
                                  pointerEvents: "none",
                                  zIndex: 1,
                                }}
                              />
                            );
                          })}

                          {/* Today Marker Line */}
                          {(() => {
                            const columnWidth = ganttZoom === "day" ? 40 : ganttZoom === "week" ? 24 : 12;
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const ganttStart = new Date(ganttStartDate);
                            ganttStart.setHours(0, 0, 0, 0);
                            const daysDiff = Math.floor((today.getTime() - ganttStart.getTime()) / (24 * 60 * 60 * 1000));
                            const todayLeft = daysDiff * columnWidth + columnWidth / 2;

                            // Only show if today is within visible range
                            if (todayLeft < 0 || todayLeft > ganttDaysToShow * columnWidth) return null;

                            return (
                              <div
                                style={{
                                  position: "absolute",
                                  left: `${todayLeft}px`,
                                  top: 0,
                                  bottom: 0,
                                  width: "2px",
                                  background: "#FFD700",
                                  zIndex: 10,
                                  pointerEvents: "none",
                                }}
                              >
                                {/* Today label */}
                                <div
                                  style={{
                                    position: "absolute",
                                    top: "-22px",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    background: "#FFD700",
                                    color: "#000",
                                    padding: "2px 8px",
                                    borderRadius: "4px",
                                    fontSize: "0.65rem",
                                    fontWeight: 700,
                                    whiteSpace: "nowrap",
                                    boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                                  }}
                                >
                                  TODAY
                                </div>
                                {/* Arrow pointing down */}
                                <div
                                  style={{
                                    position: "absolute",
                                    top: "-6px",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    width: 0,
                                    height: 0,
                                    borderLeft: "5px solid transparent",
                                    borderRight: "5px solid transparent",
                                    borderTop: "6px solid #FFD700",
                                  }}
                                />
                              </div>
                            );
                          })()}

                          {filteredTasks.map((task, taskIndex) => {
                            const columnWidth = ganttZoom === "day" ? 40 : ganttZoom === "week" ? 24 : 12;
                            const startDate = task.startAt ? new Date(task.startAt) : task.dueAt ? new Date(task.dueAt) : null;
                            const endDate = task.dueAt ? new Date(task.dueAt) : startDate;

                            // Calculate bar position
                            let barLeft = 0;
                            let barWidth = columnWidth; // Default to 1 day
                            let hasValidDates = false;

                            if (startDate && endDate) {
                              hasValidDates = true;
                              const daysDiff = Math.floor((startDate.getTime() - ganttStartDate.getTime()) / (24 * 60 * 60 * 1000));
                              const duration = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1);
                              barLeft = daysDiff * columnWidth;
                              barWidth = duration * columnWidth;
                            } else if (task.createdAt) {
                              // Fallback to created date
                              const createdDate = new Date(task.createdAt);
                              const daysDiff = Math.floor((createdDate.getTime() - ganttStartDate.getTime()) / (24 * 60 * 60 * 1000));
                              barLeft = daysDiff * columnWidth;
                            }

                            const statusInfo = activeStatuses.find(s => s.id === task.status);
                            const priorityInfo = PRIORITIES[task.priority as keyof typeof PRIORITIES] || PRIORITIES.none;
                            const isBlocked = blockedTasks.has(task.id);

                            return (
                              <div
                                key={task.id}
                                style={{
                                  height: "40px",
                                  position: "relative",
                                  borderBottom: `1px solid ${colors.border}`,
                                  background: taskIndex % 2 === 0 ? "transparent" : colors.surfaceHover,
                                }}
                              >
                                {/* Background grid lines */}
                                <div style={{ position: "absolute", inset: 0, display: "flex" }}>
                                  {Array.from({ length: ganttDaysToShow }).map((_, i) => {
                                    const date = new Date(ganttStartDate);
                                    date.setDate(date.getDate() + i);
                                    const isToday = date.toDateString() === new Date().toDateString();
                                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                    return (
                                      <div
                                        key={i}
                                        style={{
                                          width: `${columnWidth}px`,
                                          flexShrink: 0,
                                          borderRight: `1px solid ${isWeekend ? colors.border : "rgba(255,255,255,0.03)"}`,
                                          background: isToday
                                            ? "rgba(255,215,0,0.08)"
                                            : isWeekend
                                            ? "rgba(255,255,255,0.01)"
                                            : "transparent",
                                        }}
                                      />
                                    );
                                  })}
                                </div>

                                {/* Task Bar */}
                                {(hasValidDates || task.createdAt) && barLeft >= -barWidth && barLeft < ganttDaysToShow * columnWidth && (() => {
                                  const isDragging = draggingTask?.taskId === task.id;
                                  const dragOffset = getDragPreviewOffset(task.id);
                                  const adjustedLeft = barLeft + dragOffset;
                                  const actualBarWidth = Math.min(barWidth, (ganttDaysToShow * columnWidth) - adjustedLeft);

                                  // Calculate progress percentage
                                  const taskProgress = task.status === "done"
                                    ? 100
                                    : task.subtaskCount > 0
                                    ? Math.round((task.completedSubtasks / task.subtaskCount) * 100)
                                    : 0;
                                  const hasProgress = taskProgress > 0 && taskProgress < 100;

                                  // Dependency drag state
                                  const isDependencyDragSource = dependencyDrag?.sourceTaskId === task.id;
                                  const isDependencyDragTarget = dependencyDrag?.targetTaskId === task.id;
                                  const canBeDropTarget = dependencyDrag && dependencyDrag.sourceTaskId !== task.id;

                                  // Critical path state
                                  const isOnCriticalPath = showCriticalPath && criticalPathTaskIds.has(task.id);

                                  // Schedule lock state (prevents auto-scheduling)
                                  const isScheduleLocked = lockedTaskIds.has(task.id);

                                  return (
                                    <div
                                      data-task-bar="true"
                                      data-task-id={task.id}
                                      style={{
                                        position: "absolute",
                                        top: "8px",
                                        left: `${Math.max(0, adjustedLeft)}px`,
                                        width: `${actualBarWidth}px`,
                                        height: "24px",
                                        borderRadius: "4px",
                                        background: isDependencyDragTarget
                                          ? "linear-gradient(90deg, #22c55e, #16a34a)"
                                          : isOnCriticalPath
                                          ? "linear-gradient(90deg, #ef4444, #dc2626)"
                                          : task.status === "done"
                                          ? `linear-gradient(90deg, ${statusInfo?.color || "#22c55e"}80, ${statusInfo?.color || "#22c55e"}60)`
                                          : isBlocked
                                          ? `linear-gradient(90deg, #ef4444, #dc2626)`
                                          : `linear-gradient(90deg, ${statusInfo?.color || "#6366f1"}40, ${statusInfo?.color || "#6366f1"}30)`,
                                        border: isDependencyDragTarget
                                          ? "2px solid #22c55e"
                                          : isOnCriticalPath
                                          ? "2px solid #ef4444"
                                          : isScheduleLocked
                                          ? "2px dashed #f59e0b"
                                          : isDragging
                                          ? "2px solid #FFD700"
                                          : `1px solid ${statusInfo?.color || "#6366f1"}`,
                                        cursor: isDragging ? "grabbing" : canBeDropTarget ? "crosshair" : "grab",
                                        display: "flex",
                                        alignItems: "center",
                                        overflow: "hidden",
                                        boxShadow: isDependencyDragTarget
                                          ? "0 0 12px rgba(34, 197, 94, 0.6)"
                                          : isOnCriticalPath
                                          ? "0 0 12px rgba(239, 68, 68, 0.5), inset 0 0 0 1px rgba(255,255,255,0.2)"
                                          : isDragging
                                          ? "0 4px 12px rgba(255, 215, 0, 0.4)"
                                          : "0 2px 4px rgba(0,0,0,0.2)",
                                        opacity: task.status === "done" ? 0.6 : showCriticalPath && !isOnCriticalPath ? 0.5 : 1,
                                        transition: isDragging ? "none" : "all 0.15s",
                                        userSelect: "none",
                                        transform: isDependencyDragTarget ? "scale(1.02)" : "none",
                                      }}
                                      title={`${task.title}${isOnCriticalPath ? " (Critical Path)" : ""}${isScheduleLocked ? " 🔒 Locked" : ""}\n${startDate ? `Start: ${startDate.toLocaleDateString()}` : ""}\n${endDate ? `Due: ${endDate.toLocaleDateString()}` : ""}${task.subtaskCount > 0 ? `\nProgress: ${taskProgress}% (${task.completedSubtasks}/${task.subtaskCount} subtasks)` : ""}\n\nDrag to reschedule • Drag circle to create dependency${isScheduleLocked ? "\n\n⚠️ This task is locked and will not be moved by auto-schedule" : ""}`}
                                      onMouseDown={(e) => {
                                        if (!dependencyDrag) {
                                          handleGanttDragStart(e, task, "move");
                                        }
                                      }}
                                      onMouseEnter={() => {
                                        if (canBeDropTarget) {
                                          setDependencyDrag(prev => prev ? { ...prev, targetTaskId: task.id } : null);
                                        }
                                      }}
                                      onMouseLeave={() => {
                                        if (dependencyDrag?.targetTaskId === task.id) {
                                          setDependencyDrag(prev => prev ? { ...prev, targetTaskId: null } : null);
                                        }
                                      }}
                                      onClick={(e) => {
                                        if (!isDragging && !dependencyDrag) {
                                          e.stopPropagation();
                                          setEditingTaskId(task.id);
                                        }
                                      }}
                                    >
                                      {/* Progress fill overlay */}
                                      {(hasProgress || task.status === "done") && (
                                        <div
                                          style={{
                                            position: "absolute",
                                            left: 0,
                                            top: 0,
                                            bottom: 0,
                                            width: `${taskProgress}%`,
                                            background: task.status === "done"
                                              ? "transparent"
                                              : isBlocked
                                              ? "linear-gradient(90deg, #ef4444, #dc2626)"
                                              : `linear-gradient(90deg, ${statusInfo?.color || "#6366f1"}, ${statusInfo?.color || "#6366f1"}cc)`,
                                            borderRadius: taskProgress >= 100 ? "3px" : "3px 0 0 3px",
                                            transition: "width 0.3s ease",
                                          }}
                                        />
                                      )}
                                      {/* Left resize handle */}
                                      {hasValidDates && barWidth > 40 && (
                                        <div
                                          onMouseDown={(e) => {
                                            e.stopPropagation();
                                            handleGanttDragStart(e, task, "resize-start");
                                          }}
                                          style={{
                                            position: "absolute",
                                            left: 0,
                                            top: 0,
                                            bottom: 0,
                                            width: "8px",
                                            cursor: "ew-resize",
                                            background: "transparent",
                                            borderRadius: "4px 0 0 4px",
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.background = "rgba(255,255,255,0.2)";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.background = "transparent";
                                          }}
                                        />
                                      )}

                                      {/* Bar content */}
                                      <div
                                        style={{
                                          flex: 1,
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "6px",
                                          padding: "0 8px",
                                          overflow: "hidden",
                                          position: "relative",
                                          zIndex: 2,
                                        }}
                                      >
                                        {isBlocked && <Lock size={10} color="#fff" />}
                                        {barWidth > 60 && (
                                          <span
                                            style={{
                                              fontSize: "0.7rem",
                                              fontWeight: 500,
                                              color: "#fff",
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                              whiteSpace: "nowrap",
                                              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                                              flex: 1,
                                            }}
                                          >
                                            {task.title}
                                          </span>
                                        )}
                                        {!hasValidDates && (
                                          <span
                                            style={{
                                              fontSize: "0.6rem",
                                              color: "rgba(255,255,255,0.7)",
                                              fontStyle: "italic",
                                            }}
                                          >
                                            (no dates)
                                          </span>
                                        )}
                                        {/* Progress badge */}
                                        {task.subtaskCount > 0 && barWidth > 80 && (
                                          <span
                                            style={{
                                              fontSize: "0.6rem",
                                              fontWeight: 700,
                                              color: taskProgress === 100 ? "#22c55e" : "#fff",
                                              background: taskProgress === 100
                                                ? "rgba(34, 197, 94, 0.3)"
                                                : "rgba(0,0,0,0.3)",
                                              padding: "1px 5px",
                                              borderRadius: "3px",
                                              whiteSpace: "nowrap",
                                              flexShrink: 0,
                                            }}
                                          >
                                            {taskProgress}%
                                          </span>
                                        )}
                                        {/* Schedule lock toggle */}
                                        {barWidth > 50 && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleTaskLock(task.id);
                                            }}
                                            style={{
                                              background: isScheduleLocked ? "rgba(245, 158, 11, 0.4)" : "rgba(0,0,0,0.2)",
                                              border: "none",
                                              borderRadius: "3px",
                                              padding: "2px 4px",
                                              cursor: "pointer",
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              flexShrink: 0,
                                              transition: "all 0.15s",
                                            }}
                                            title={isScheduleLocked ? "Unlock task (allow auto-schedule)" : "Lock task (prevent auto-schedule)"}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.background = isScheduleLocked
                                                ? "rgba(245, 158, 11, 0.6)"
                                                : "rgba(255,255,255,0.2)";
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.background = isScheduleLocked
                                                ? "rgba(245, 158, 11, 0.4)"
                                                : "rgba(0,0,0,0.2)";
                                            }}
                                          >
                                            {isScheduleLocked ? (
                                              <Lock size={10} color="#f59e0b" />
                                            ) : (
                                              <Unlock size={10} color="rgba(255,255,255,0.7)" />
                                            )}
                                          </button>
                                        )}
                                      </div>

                                      {/* Right resize handle */}
                                      {hasValidDates && barWidth > 40 && !dependencyDrag && (
                                        <div
                                          onMouseDown={(e) => {
                                            e.stopPropagation();
                                            handleGanttDragStart(e, task, "resize-end");
                                          }}
                                          style={{
                                            position: "absolute",
                                            right: 0,
                                            top: 0,
                                            bottom: 0,
                                            width: "8px",
                                            cursor: "ew-resize",
                                            background: "transparent",
                                            borderRadius: "0 4px 4px 0",
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.background = "rgba(255,255,255,0.2)";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.background = "transparent";
                                          }}
                                        />
                                      )}

                                      {/* Dependency drag handle */}
                                      {!dependencyDrag && (
                                        <div
                                          onMouseDown={(e) => {
                                            e.stopPropagation();
                                            const barLeftX = Math.max(0, adjustedLeft);
                                            const barRightX = barLeftX + actualBarWidth;
                                            const barCenterY = taskIndex * 40 + 8 + 12; // row offset + top offset + half height
                                            handleDependencyDragStart(e, task, barLeftX, barRightX, barCenterY);
                                          }}
                                          style={{
                                            position: "absolute",
                                            right: "-6px",
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            width: "12px",
                                            height: "12px",
                                            borderRadius: "50%",
                                            background: statusInfo?.color || "#6366f1",
                                            border: "2px solid white",
                                            cursor: "crosshair",
                                            boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                                            zIndex: 10,
                                            opacity: 0,
                                            transition: "opacity 0.15s, transform 0.15s",
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.opacity = "1";
                                            e.currentTarget.style.transform = "translateY(-50%) scale(1.2)";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.opacity = "0";
                                            e.currentTarget.style.transform = "translateY(-50%)";
                                          }}
                                          title="Drag to link&#10;Shift: Start→Start&#10;Ctrl: Finish→Finish"
                                        />
                                      )}

                                      {/* Source indicator during dependency drag */}
                                      {isDependencyDragSource && (() => {
                                        const depType = dependencyDrag?.dependencyType;
                                        const isStartToStart = depType === "start_to_start";
                                        const isFinishToFinish = depType === "finish_to_finish";
                                        const color = isStartToStart ? "#f59e0b" : isFinishToFinish ? "#10b981" : "#6366f1";
                                        const glow = isStartToStart
                                          ? "0 0 8px rgba(245, 158, 11, 0.8)"
                                          : isFinishToFinish
                                          ? "0 0 8px rgba(16, 185, 129, 0.8)"
                                          : "0 0 8px rgba(99, 102, 241, 0.8)";

                                        return (
                                          <div
                                            style={{
                                              position: "absolute",
                                              ...(isStartToStart ? { left: "-6px" } : { right: "-6px" }),
                                              top: "50%",
                                              transform: "translateY(-50%)",
                                              width: "14px",
                                              height: "14px",
                                              borderRadius: "50%",
                                              background: color,
                                              border: "2px solid white",
                                              boxShadow: glow,
                                              zIndex: 10,
                                            }}
                                          />
                                        );
                                      })()}

                                      {/* Drag indicator */}
                                      {isDragging && draggingTask.currentOffsetDays !== 0 && (
                                        <div
                                          style={{
                                            position: "absolute",
                                            top: "-20px",
                                            left: "50%",
                                            transform: "translateX(-50%)",
                                            padding: "2px 6px",
                                            borderRadius: "4px",
                                            background: "#FFD700",
                                            color: "#000",
                                            fontSize: "0.65rem",
                                            fontWeight: 700,
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          {draggingTask.currentOffsetDays > 0 ? "+" : ""}
                                          {draggingTask.currentOffsetDays}d
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}

                              </div>
                            );
                          })}

                          {/* Empty state */}
                          {filteredTasks.length === 0 && (
                            <div
                              style={{
                                padding: "60px 40px",
                                textAlign: "center",
                                color: colors.textMuted,
                              }}
                            >
                              <GanttChart size={48} style={{ marginBottom: "16px", opacity: 0.3 }} />
                              <p style={{ margin: 0, fontSize: "1rem" }}>No tasks to display</p>
                              <p style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>
                                Add tasks with start and due dates to see them on the timeline
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: "40px", textAlign: "center", color: colors.textMuted }}>
                Select a list to view tasks
              </div>
            )}
          </div>

          {/* Bulk Actions Bar */}
          {selectedTaskIds.size > 0 && (
            <BulkActions
              selectedCount={selectedTaskIds.size}
              onClearSelection={() => setSelectedTaskIds(new Set())}
              onStatusChange={async (status) => {
                try {
                  const result = await bulkUpdateTasks(
                    Array.from(selectedTaskIds),
                    { status },
                    userId
                  );
                  if (result.errors?.length) {
                    console.error("Bulk status update errors:", result.errors);
                  }
                  // Refresh tasks
                  if (selectedProject) {
                    const updated = await fetchProjectTasks(selectedProject.id, userId);
                    setTasks(updated);
                  }
                } catch (error) {
                  console.error("Bulk status update failed:", error);
                }
                setSelectedTaskIds(new Set());
              }}
              onPriorityChange={async (priority) => {
                try {
                  const result = await bulkUpdateTasks(
                    Array.from(selectedTaskIds),
                    { priority },
                    userId
                  );
                  if (result.errors?.length) {
                    console.error("Bulk priority update errors:", result.errors);
                  }
                  // Refresh tasks
                  if (selectedProject) {
                    const updated = await fetchProjectTasks(selectedProject.id, userId);
                    setTasks(updated);
                  }
                } catch (error) {
                  console.error("Bulk priority update failed:", error);
                }
                setSelectedTaskIds(new Set());
              }}
              onAssigneeChange={async (assignee) => {
                try {
                  const result = await bulkUpdateTasks(
                    Array.from(selectedTaskIds),
                    { assignees: assignee ? [assignee] : [] },
                    userId
                  );
                  if (result.errors?.length) {
                    console.error("Bulk assignee update errors:", result.errors);
                  }
                  // Refresh tasks
                  if (selectedProject) {
                    const updated = await fetchProjectTasks(selectedProject.id, userId);
                    setTasks(updated);
                  }
                } catch (error) {
                  console.error("Bulk assignee update failed:", error);
                }
                setSelectedTaskIds(new Set());
              }}
              onDelete={async () => {
                try {
                  const result = await bulkDeleteTasks(
                    Array.from(selectedTaskIds),
                    userId,
                    false // soft delete (move to trash)
                  );
                  if (result.errors?.length) {
                    console.error("Bulk delete errors:", result.errors);
                  }
                  // Refresh tasks
                  if (selectedProject) {
                    const updated = await fetchProjectTasks(selectedProject.id, userId);
                    setTasks(updated);
                  }
                } catch (error) {
                  console.error("Bulk delete failed:", error);
                }
                setSelectedTaskIds(new Set());
              }}
              onArchive={async () => {
                await Promise.all(
                  Array.from(selectedTaskIds).map(id => handleArchiveTask(id))
                );
                setSelectedTaskIds(new Set());
              }}
              onMove={async (projectId) => {
                try {
                  const result = await bulkMoveTasks(
                    Array.from(selectedTaskIds),
                    userId,
                    { targetProjectId: projectId }
                  );
                  if (result.errors?.length) {
                    console.error("Bulk move errors:", result.errors);
                  }
                  // Refresh tasks
                  if (selectedProject) {
                    const updated = await fetchProjectTasks(selectedProject.id, userId);
                    setTasks(updated);
                  }
                } catch (error) {
                  console.error("Bulk move failed:", error);
                }
                setSelectedTaskIds(new Set());
              }}
              onDuplicate={async () => {
                try {
                  const result = await bulkCloneTasks(
                    Array.from(selectedTaskIds),
                    userId,
                    { includeSubtasks: true }
                  );
                  if (result.errors?.length) {
                    console.error("Bulk clone errors:", result.errors);
                  }
                  // Refresh tasks to show cloned tasks
                  if (selectedProject) {
                    const updated = await fetchProjectTasks(selectedProject.id, userId);
                    setTasks(updated);
                  }
                } catch (error) {
                  console.error("Bulk clone failed:", error);
                }
                setSelectedTaskIds(new Set());
              }}
              projects={projects.map(p => ({ id: p.id, name: p.name }))}
              statuses={activeStatuses}
              users={USERS}
            />
          )}
        </main>

      </div>

      {/* Assignee Popover */}
      {assigneePopover && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
          }}
          onClick={closeAllPopovers}
        >
          <div
            style={{
              position: "fixed",
              top: assigneePopover.position.top,
              left: assigneePopover.position.left,
              minWidth: "220px",
              background: colors.sidebar,
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              border: `1px solid ${colors.border}`,
              borderRadius: "8px",
              boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.4)" : "0 8px 32px rgba(31, 38, 135, 0.2)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search */}
            <div style={{ padding: "8px", borderBottom: `1px solid ${colors.border}` }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 10px",
                  background: colors.surface,
                  borderRadius: "6px",
                  border: `1px solid ${colors.border}`,
                }}
              >
                <Search size={14} color={colors.textMuted} />
                <input
                  type="text"
                  placeholder="Search or enter email..."
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: colors.text,
                    fontSize: "0.85rem",
                  }}
                />
              </div>
            </div>

            {/* People section */}
            <div style={{ padding: "8px 0" }}>
              <div style={{ padding: "4px 12px", fontSize: "0.7rem", fontWeight: 600, color: colors.textMuted, textTransform: "uppercase" }}>
                People
              </div>
              {Object.entries(USERS).map(([id, user]) => {
                const task = tasks.find(t => t.id === assigneePopover.taskId);
                const isAssigned = task?.assignees.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => updateTaskAssignee(assigneePopover.taskId, id)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 12px",
                      background: isAssigned ? colors.sidebarActive : "transparent",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => { if (!isAssigned) e.currentTarget.style.background = colors.sidebarHover; }}
                    onMouseLeave={(e) => { if (!isAssigned) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: user.avatar,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                      }}
                    >
                      {user.initials}
                    </div>
                    <span style={{ fontSize: "0.85rem", color: colors.text }}>{user.name}</span>
                    {isAssigned && <CheckCheck size={14} color={colors.accent} style={{ marginLeft: "auto" }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Due Date Popover */}
      {dueDatePopover && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
          }}
          onClick={closeAllPopovers}
        >
          <div
            style={{
              position: "fixed",
              top: dueDatePopover.position.top,
              left: dueDatePopover.position.left,
              minWidth: "200px",
              background: colors.sidebar,
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              border: `1px solid ${colors.border}`,
              borderRadius: "8px",
              boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.4)" : "0 8px 32px rgba(31, 38, 135, 0.2)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "8px 0" }}>
              {getQuickDateOptions().map((option) => (
                <button
                  key={option.label}
                  onClick={() => updateTaskDueDate(dueDatePopover.taskId, option.date)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.sidebarHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <span style={{ fontSize: "0.85rem", color: option.label === "Clear" ? colors.danger : colors.text }}>
                    {option.label}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: colors.textMuted }}>
                    {option.sublabel}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Priority Popover */}
      {priorityPopover && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
          }}
          onClick={closeAllPopovers}
        >
          <div
            style={{
              position: "fixed",
              top: priorityPopover.position.top,
              left: priorityPopover.position.left,
              minWidth: "160px",
              background: colors.sidebar,
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              border: `1px solid ${colors.border}`,
              borderRadius: "8px",
              boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.4)" : "0 8px 32px rgba(31, 38, 135, 0.2)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "6px 12px", fontSize: "0.7rem", fontWeight: 600, color: colors.textMuted, textTransform: "uppercase", borderBottom: `1px solid ${colors.border}` }}>
              Task Priority
            </div>
            <div style={{ padding: "4px 0" }}>
              {Object.entries(PRIORITIES).map(([key, value]) => {
                const task = tasks.find(t => t.id === priorityPopover.taskId);
                const isSelected = task?.priority === key;
                return (
                  <button
                    key={key}
                    onClick={() => updateTaskPriority(priorityPopover.taskId, key)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 12px",
                      background: isSelected ? colors.sidebarActive : "transparent",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = colors.sidebarHover; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                  >
                    <Flag size={14} fill={value.flagColor} color={value.flagColor} />
                    <span style={{ fontSize: "0.85rem", color: colors.text }}>{value.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tags Popover */}
      {tagsPopover && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
          }}
          onClick={closeAllPopovers}
        >
          <div
            style={{
              position: "fixed",
              top: tagsPopover.position.top,
              left: tagsPopover.position.left,
              minWidth: "260px",
              maxHeight: "400px",
              background: colors.sidebar,
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              border: `1px solid ${colors.border}`,
              borderRadius: "8px",
              boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.4)" : "0 8px 32px rgba(31, 38, 135, 0.2)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: colors.text }}>Tags</span>
              <button
                onClick={closeAllPopovers}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: colors.textMuted,
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Existing labels */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {labels.length === 0 ? (
                <div style={{ padding: "12px", textAlign: "center", color: colors.textMuted, fontSize: "0.8rem" }}>
                  No tags yet. Create one below!
                </div>
              ) : (
                labels.map((label) => {
                  const task = tasks.find(t => t.id === tagsPopover.taskId);
                  const isSelected = task?.labels.includes(label.id);
                  return (
                    <div
                      key={label.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 12px",
                        background: isSelected ? colors.sidebarActive : "transparent",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = colors.sidebarHover; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = isSelected ? colors.sidebarActive : "transparent"; }}
                      onClick={() => toggleTaskLabel(tagsPopover.taskId, label.id)}
                    >
                      <div
                        style={{
                          width: "12px",
                          height: "12px",
                          borderRadius: "3px",
                          background: label.color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: "0.85rem", color: colors.text, flex: 1 }}>{label.name}</span>
                      {isSelected && <CheckCheck size={14} color={colors.accent} />}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete tag "${label.name}"?`)) {
                            deleteLabel(label.id);
                          }
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "2px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: colors.textMuted,
                          opacity: 0.5,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = colors.danger; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; e.currentTarget.style.color = colors.textMuted; }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Create new label */}
            <div style={{ borderTop: `1px solid ${colors.border}`, padding: "12px" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, color: colors.textMuted, textTransform: "uppercase", marginBottom: "8px" }}>
                Create new tag
              </div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <input
                  type="text"
                  placeholder="Tag name"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createNewLabel()}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: `1px solid ${colors.border}`,
                    background: colors.surface,
                    color: colors.text,
                    fontSize: "0.85rem",
                    outline: "none",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
                {LABEL_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewLabelColor(color)}
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "4px",
                      background: color,
                      border: newLabelColor === color ? `2px solid ${colors.text}` : "2px solid transparent",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                ))}
              </div>
              <button
                onClick={createNewLabel}
                disabled={!newLabelName.trim()}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "none",
                  background: newLabelName.trim() ? `linear-gradient(135deg, ${colors.accent} 0%, #e6c200 100%)` : colors.surface,
                  color: newLabelName.trim() ? "#000" : colors.textMuted,
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: newLabelName.trim() ? "pointer" : "not-allowed",
                }}
              >
                Create Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments Popover */}
      {commentsPopover && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
          }}
          onClick={closeAllPopovers}
        >
          <div
            style={{
              position: "fixed",
              top: commentsPopover.position.top,
              left: Math.max(10, commentsPopover.position.left),
              width: "360px",
              maxHeight: "480px",
              background: colors.sidebar,
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              border: `1px solid ${colors.border}`,
              borderRadius: "12px",
              boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.4)" : "0 8px 32px rgba(31, 38, 135, 0.2)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <MessageSquare size={16} color={colors.accent} />
                <span style={{ fontSize: "0.9rem", fontWeight: 600, color: colors.text }}>Comments</span>
                <span style={{ fontSize: "0.75rem", color: colors.textMuted }}>
                  ({tasks.find(t => t.id === commentsPopover.taskId)?.commentCount || 0})
                </span>
              </div>
              <button
                onClick={closeAllPopovers}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: colors.textMuted,
                  borderRadius: "4px",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                <X size={16} />
              </button>
            </div>

            {/* Comments list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {loadingComments ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", color: colors.textMuted }}>
                  <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                  <span style={{ marginLeft: "8px", fontSize: "0.85rem" }}>Loading comments...</span>
                </div>
              ) : taskComments.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px", color: colors.textMuted }}>
                  <MessageSquare size={32} style={{ opacity: 0.3, marginBottom: "8px" }} />
                  <p style={{ fontSize: "0.85rem", margin: 0 }}>No comments yet</p>
                  <p style={{ fontSize: "0.75rem", margin: "4px 0 0" }}>Be the first to add a comment!</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {taskComments.map((comment) => {
                    const user = USERS[comment.userId] || { name: comment.userId, initials: comment.userId.charAt(0).toUpperCase(), avatar: "#6b7280" };
                    return (
                      <div key={comment.id} style={{ display: "flex", gap: "10px" }}>
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            background: user.avatar,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {user.initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: colors.text }}>{user.name}</span>
                            <span style={{ fontSize: "0.7rem", color: colors.textMuted }}>{formatRelativeTime(comment.createdAt)}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.85rem", color: colors.textSecondary, lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                            {comment.body}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add comment input */}
            <div style={{ borderTop: `1px solid ${colors.border}`, padding: "12px 16px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: USERS[userId]?.avatar || "#FFD700",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {USERS[userId]?.initials || "Y"}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                  <textarea
                    placeholder="Write a comment..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        createComment();
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: `1px solid ${colors.border}`,
                      background: colors.surface,
                      color: colors.text,
                      fontSize: "0.85rem",
                      outline: "none",
                      resize: "none",
                      minHeight: "60px",
                      fontFamily: "inherit",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.7rem", color: colors.textMuted }}>
                      Press Enter to send, Shift+Enter for new line
                    </span>
                    <button
                      onClick={createComment}
                      disabled={!newCommentText.trim()}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "6px",
                        border: "none",
                        background: newCommentText.trim() ? `linear-gradient(135deg, ${colors.accent} 0%, #e6c200 100%)` : colors.surface,
                        color: newCommentText.trim() ? "#000" : colors.textMuted,
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        cursor: newCommentText.trim() ? "pointer" : "not-allowed",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Send size={14} />
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Field Edit Popover */}
      {customFieldPopover && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
          }}
          onClick={() => setCustomFieldPopover(null)}
        >
          <div
            style={{
              position: "fixed",
              top: Math.min(customFieldPopover.position.top, window.innerHeight - 300),
              left: Math.min(customFieldPopover.position.left, window.innerWidth - 280),
              minWidth: "240px",
              maxWidth: "320px",
              background: colors.sidebar,
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              border: `1px solid ${colors.border}`,
              borderRadius: "12px",
              boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.4)" : "0 8px 32px rgba(31, 38, 135, 0.2)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: "12px 16px",
              borderBottom: `1px solid ${colors.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <span style={{ fontWeight: 600, fontSize: "0.9rem", color: colors.text }}>
                {customFieldPopover.field.name}
              </span>
              <button
                onClick={() => setCustomFieldPopover(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: colors.textMuted,
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Field Editor based on type */}
            <div style={{ padding: "12px 16px" }}>
              {/* Select field */}
              {customFieldPopover.field.fieldType === "select" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {customFieldPopover.field.config.options?.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={async () => {
                        try {
                          await setTaskFieldValue(customFieldPopover.taskId, customFieldPopover.fieldId, opt.value);
                          setTaskFieldValues(prev => ({
                            ...prev,
                            [customFieldPopover.taskId]: { ...prev[customFieldPopover.taskId], [customFieldPopover.fieldId]: opt.value }
                          }));
                          setCustomFieldPopover(null);
                        } catch (err) {
                          console.error("Failed to update field:", err);
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 12px",
                        background: taskFieldValues[customFieldPopover.taskId]?.[customFieldPopover.fieldId] === opt.value
                          ? colors.sidebarActive
                          : "transparent",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = colors.sidebarHover}
                      onMouseLeave={(e) => e.currentTarget.style.background = taskFieldValues[customFieldPopover.taskId]?.[customFieldPopover.fieldId] === opt.value ? colors.sidebarActive : "transparent"}
                    >
                      <div style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "3px",
                        background: opt.color || colors.accent,
                      }} />
                      <span style={{ color: colors.text, fontSize: "0.85rem" }}>{opt.label}</span>
                    </button>
                  ))}
                  <button
                    onClick={async () => {
                      try {
                        await setTaskFieldValue(customFieldPopover.taskId, customFieldPopover.fieldId, null);
                        setTaskFieldValues(prev => ({
                          ...prev,
                          [customFieldPopover.taskId]: { ...prev[customFieldPopover.taskId], [customFieldPopover.fieldId]: null }
                        }));
                        setCustomFieldPopover(null);
                      } catch (err) {
                        console.error("Failed to clear field:", err);
                      }
                    }}
                    style={{
                      padding: "8px 12px",
                      background: "transparent",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      textAlign: "left",
                      color: colors.textMuted,
                      fontSize: "0.85rem",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = colors.sidebarHover}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    Clear value
                  </button>
                </div>
              )}

              {/* Rating field */}
              {customFieldPopover.field.fieldType === "rating" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                    {Array.from({ length: customFieldPopover.field.config.maxRating || 5 }).map((_, i) => {
                      const currentRating = Number(taskFieldValues[customFieldPopover.taskId]?.[customFieldPopover.fieldId]) || 0;
                      return (
                        <button
                          key={i}
                          onClick={async () => {
                            const newRating = i + 1;
                            try {
                              await setTaskFieldValue(customFieldPopover.taskId, customFieldPopover.fieldId, newRating);
                              setTaskFieldValues(prev => ({
                                ...prev,
                                [customFieldPopover.taskId]: { ...prev[customFieldPopover.taskId], [customFieldPopover.fieldId]: newRating }
                              }));
                            } catch (err) {
                              console.error("Failed to update rating:", err);
                            }
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "4px",
                          }}
                        >
                          <Star
                            size={24}
                            fill={i < currentRating ? colors.accent : "transparent"}
                            color={i < currentRating ? colors.accent : colors.textMuted}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await setTaskFieldValue(customFieldPopover.taskId, customFieldPopover.fieldId, 0);
                        setTaskFieldValues(prev => ({
                          ...prev,
                          [customFieldPopover.taskId]: { ...prev[customFieldPopover.taskId], [customFieldPopover.fieldId]: 0 }
                        }));
                      } catch (err) {
                        console.error("Failed to clear rating:", err);
                      }
                    }}
                    style={{
                      padding: "6px 12px",
                      background: "transparent",
                      border: `1px solid ${colors.border}`,
                      borderRadius: "6px",
                      cursor: "pointer",
                      color: colors.textMuted,
                      fontSize: "0.8rem",
                    }}
                  >
                    Clear rating
                  </button>
                </div>
              )}

              {/* Progress field */}
              {customFieldPopover.field.fieldType === "progress" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Number(customFieldEditValue) || 0}
                    onChange={(e) => setCustomFieldEditValue(e.target.value)}
                    style={{ width: "100%" }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customFieldEditValue}
                      onChange={(e) => setCustomFieldEditValue(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: "6px",
                        border: `1px solid ${colors.border}`,
                        background: colors.surface,
                        color: colors.text,
                        fontSize: "0.9rem",
                      }}
                    />
                    <span style={{ color: colors.textMuted }}>%</span>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const val = Math.min(100, Math.max(0, Number(customFieldEditValue) || 0));
                        await setTaskFieldValue(customFieldPopover.taskId, customFieldPopover.fieldId, val);
                        setTaskFieldValues(prev => ({
                          ...prev,
                          [customFieldPopover.taskId]: { ...prev[customFieldPopover.taskId], [customFieldPopover.fieldId]: val }
                        }));
                        setCustomFieldPopover(null);
                      } catch (err) {
                        console.error("Failed to update progress:", err);
                      }
                    }}
                    style={{
                      padding: "8px 16px",
                      background: colors.accent,
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      color: "#000",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                    }}
                  >
                    Save
                  </button>
                </div>
              )}

              {/* Date field */}
              {customFieldPopover.field.fieldType === "date" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <input
                    type="date"
                    value={customFieldEditValue ? new Date(customFieldEditValue).toISOString().split('T')[0] : ""}
                    onChange={async (e) => {
                      const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                      try {
                        await setTaskFieldValue(customFieldPopover.taskId, customFieldPopover.fieldId, val);
                        setTaskFieldValues(prev => ({
                          ...prev,
                          [customFieldPopover.taskId]: { ...prev[customFieldPopover.taskId], [customFieldPopover.fieldId]: val }
                        }));
                        setCustomFieldPopover(null);
                      } catch (err) {
                        console.error("Failed to update date:", err);
                      }
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "6px",
                      border: `1px solid ${colors.border}`,
                      background: colors.surface,
                      color: colors.text,
                      fontSize: "0.9rem",
                    }}
                  />
                  <button
                    onClick={async () => {
                      try {
                        await setTaskFieldValue(customFieldPopover.taskId, customFieldPopover.fieldId, null);
                        setTaskFieldValues(prev => ({
                          ...prev,
                          [customFieldPopover.taskId]: { ...prev[customFieldPopover.taskId], [customFieldPopover.fieldId]: null }
                        }));
                        setCustomFieldPopover(null);
                      } catch (err) {
                        console.error("Failed to clear date:", err);
                      }
                    }}
                    style={{
                      padding: "6px 12px",
                      background: "transparent",
                      border: `1px solid ${colors.border}`,
                      borderRadius: "6px",
                      cursor: "pointer",
                      color: colors.textMuted,
                      fontSize: "0.8rem",
                    }}
                  >
                    Clear date
                  </button>
                </div>
              )}

              {/* Text, Email, URL, Number, Currency, Percent fields */}
              {["text", "email", "url", "number", "currency", "percent"].includes(customFieldPopover.field.fieldType) && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <input
                    type={["number", "currency", "percent"].includes(customFieldPopover.field.fieldType) ? "number" : "text"}
                    value={customFieldEditValue}
                    onChange={(e) => setCustomFieldEditValue(e.target.value)}
                    placeholder={`Enter ${customFieldPopover.field.name}...`}
                    autoFocus
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        try {
                          const val = ["number", "currency", "percent"].includes(customFieldPopover.field.fieldType)
                            ? Number(customFieldEditValue) || null
                            : customFieldEditValue || null;
                          await setTaskFieldValue(customFieldPopover.taskId, customFieldPopover.fieldId, val);
                          setTaskFieldValues(prev => ({
                            ...prev,
                            [customFieldPopover.taskId]: { ...prev[customFieldPopover.taskId], [customFieldPopover.fieldId]: val }
                          }));
                          setCustomFieldPopover(null);
                        } catch (err) {
                          console.error("Failed to update field:", err);
                        }
                      } else if (e.key === "Escape") {
                        setCustomFieldPopover(null);
                      }
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "6px",
                      border: `1px solid ${colors.border}`,
                      background: colors.surface,
                      color: colors.text,
                      fontSize: "0.9rem",
                      outline: "none",
                    }}
                  />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={async () => {
                        try {
                          const val = ["number", "currency", "percent"].includes(customFieldPopover.field.fieldType)
                            ? Number(customFieldEditValue) || null
                            : customFieldEditValue || null;
                          await setTaskFieldValue(customFieldPopover.taskId, customFieldPopover.fieldId, val);
                          setTaskFieldValues(prev => ({
                            ...prev,
                            [customFieldPopover.taskId]: { ...prev[customFieldPopover.taskId], [customFieldPopover.fieldId]: val }
                          }));
                          setCustomFieldPopover(null);
                        } catch (err) {
                          console.error("Failed to update field:", err);
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: "8px 16px",
                        background: colors.accent,
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        color: "#000",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setCustomFieldPopover(null)}
                      style={{
                        padding: "8px 16px",
                        background: "transparent",
                        border: `1px solid ${colors.border}`,
                        borderRadius: "6px",
                        cursor: "pointer",
                        color: colors.text,
                        fontSize: "0.85rem",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Milestone Assignment Popover */}
      {milestonePopover && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
          }}
          onClick={() => setMilestonePopover(null)}
        >
          <div
            style={{
              position: "fixed",
              top: Math.min(milestonePopover.position.top, window.innerHeight - 350),
              left: Math.min(milestonePopover.position.left, window.innerWidth - 280),
              minWidth: "260px",
              maxWidth: "320px",
              background: colors.sidebar,
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              border: `1px solid ${colors.border}`,
              borderRadius: "12px",
              boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.4)" : "0 8px 32px rgba(31, 38, 135, 0.2)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: "12px 16px",
              borderBottom: `1px solid ${colors.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <span style={{ fontWeight: 600, fontSize: "0.9rem", color: colors.text }}>
                Set Milestone
              </span>
              <button
                onClick={() => setMilestonePopover(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: colors.textMuted,
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Milestone List */}
            <div style={{ padding: "8px", maxHeight: "300px", overflowY: "auto" }}>
              {milestones.length === 0 ? (
                <div style={{
                  padding: "20px",
                  textAlign: "center",
                  color: colors.textMuted,
                }}>
                  <Flag size={24} style={{ marginBottom: "8px", opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: "0.85rem" }}>No milestones yet</p>
                  <button
                    onClick={() => {
                      setMilestonePopover(null);
                      setShowMilestoneManager(true);
                    }}
                    style={{
                      marginTop: "12px",
                      padding: "8px 16px",
                      background: colors.accent,
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      color: "#000",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                    }}
                  >
                    Create Milestone
                  </button>
                </div>
              ) : (
                <>
                  {milestones.map((milestone) => {
                    const task = tasks.find(t => t.id === milestonePopover.taskId);
                    const isSelected = task?.milestoneId === milestone.id;
                    return (
                      <button
                        key={milestone.id}
                        onClick={async () => {
                          try {
                            await apiUpdateTask(milestonePopover.taskId, userId, {
                              milestone_id: isSelected ? null : milestone.id,
                            });
                            setTasks(prev => prev.map(t =>
                              t.id === milestonePopover.taskId
                                ? { ...t, milestoneId: isSelected ? null : milestone.id }
                                : t
                            ));
                            setMilestonePopover(null);
                          } catch (err) {
                            console.error("Failed to update milestone:", err);
                          }
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "10px 12px",
                          background: isSelected ? colors.sidebarActive : "transparent",
                          border: "none",
                          borderRadius: "8px",
                          cursor: "pointer",
                          textAlign: "left",
                          marginBottom: "4px",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = colors.sidebarHover;
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <div style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                          background: milestone.color,
                          flexShrink: 0,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            color: colors.text,
                            fontSize: "0.85rem",
                            fontWeight: isSelected ? 600 : 400,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}>
                            {milestone.name}
                          </div>
                          {milestone.dueDate && (
                            <div style={{
                              fontSize: "0.75rem",
                              color: colors.textMuted,
                            }}>
                              Due {new Date(milestone.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </div>
                          )}
                        </div>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}>
                          <div style={{
                            width: "40px",
                            height: "4px",
                            borderRadius: "2px",
                            background: colors.surface,
                            overflow: "hidden",
                          }}>
                            <div style={{
                              width: `${milestone.progress}%`,
                              height: "100%",
                              background: milestone.color,
                            }} />
                          </div>
                          <span style={{
                            fontSize: "0.7rem",
                            color: colors.textMuted,
                          }}>
                            {milestone.progress}%
                          </span>
                        </div>
                        {isSelected && (
                          <CheckCheck size={16} color={colors.accent} />
                        )}
                      </button>
                    );
                  })}

                  {/* Clear milestone option */}
                  {tasks.find(t => t.id === milestonePopover.taskId)?.milestoneId && (
                    <button
                      onClick={async () => {
                        try {
                          await apiUpdateTask(milestonePopover.taskId, userId, {
                            milestone_id: null,
                          });
                          setTasks(prev => prev.map(t =>
                            t.id === milestonePopover.taskId
                              ? { ...t, milestoneId: null }
                              : t
                          ));
                          setMilestonePopover(null);
                        } catch (err) {
                          console.error("Failed to clear milestone:", err);
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        background: "transparent",
                        border: `1px dashed ${colors.border}`,
                        borderRadius: "8px",
                        cursor: "pointer",
                        color: colors.textMuted,
                        fontSize: "0.85rem",
                        marginTop: "8px",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = colors.sidebarHover}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      Remove from milestone
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recurrence Popover */}
      {recurrencePopover && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
          }}
          onClick={() => setRecurrencePopover(null)}
        >
          <div
            style={{
              position: "fixed",
              top: Math.min(recurrencePopover.position.top, window.innerHeight - 400),
              left: Math.min(recurrencePopover.position.left, window.innerWidth - 300),
              minWidth: "280px",
              maxWidth: "340px",
              background: colors.sidebar,
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              border: `1px solid ${colors.border}`,
              borderRadius: "12px",
              boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.4)" : "0 8px 32px rgba(31, 38, 135, 0.2)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: "12px 16px",
              borderBottom: `1px solid ${colors.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <span style={{ fontWeight: 600, fontSize: "0.9rem", color: colors.text }}>
                Set Recurrence
              </span>
              <button
                onClick={() => setRecurrencePopover(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: colors.textMuted,
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick options */}
            <div style={{ padding: "8px" }}>
              {[
                { label: "Daily", rule: "RRULE:FREQ=DAILY;INTERVAL=1" },
                { label: "Weekdays", rule: "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
                { label: "Weekly", rule: "RRULE:FREQ=WEEKLY;INTERVAL=1" },
                { label: "Bi-weekly", rule: "RRULE:FREQ=WEEKLY;INTERVAL=2" },
                { label: "Monthly", rule: "RRULE:FREQ=MONTHLY;INTERVAL=1" },
                { label: "Quarterly", rule: "RRULE:FREQ=MONTHLY;INTERVAL=3" },
                { label: "Yearly", rule: "RRULE:FREQ=YEARLY;INTERVAL=1" },
              ].map(({ label, rule }) => {
                const task = tasks.find(t => t.id === recurrencePopover.taskId);
                const isSelected = task?.recurrenceRule === rule;
                return (
                  <button
                    key={label}
                    onClick={async () => {
                      try {
                        await apiUpdateTask(recurrencePopover.taskId, userId, {
                          recurrence_rule: isSelected ? null : rule,
                        });
                        setTasks(prev => prev.map(t =>
                          t.id === recurrencePopover.taskId
                            ? { ...t, recurrenceRule: isSelected ? null : rule }
                            : t
                        ));
                        setRecurrencePopover(null);
                      } catch (err) {
                        console.error("Failed to update recurrence:", err);
                      }
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 12px",
                      background: isSelected ? colors.sidebarActive : "transparent",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      textAlign: "left",
                      marginBottom: "4px",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = colors.sidebarHover;
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <RefreshCw size={14} color={isSelected ? colors.accent : colors.textMuted} />
                    <span style={{
                      color: colors.text,
                      fontSize: "0.85rem",
                      fontWeight: isSelected ? 600 : 400,
                    }}>
                      {label}
                    </span>
                    {isSelected && (
                      <CheckCheck size={16} color={colors.accent} style={{ marginLeft: "auto" }} />
                    )}
                  </button>
                );
              })}

              {/* Custom recurrence */}
              <div style={{
                marginTop: "8px",
                padding: "12px",
                background: colors.surface,
                borderRadius: "8px",
                border: `1px solid ${colors.border}`,
              }}>
                <div style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: colors.textMuted,
                  marginBottom: "8px",
                  textTransform: "uppercase",
                }}>
                  Custom
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: colors.text, fontSize: "0.85rem" }}>Every</span>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={customRecurrence.interval}
                    onChange={(e) => setCustomRecurrence(prev => ({
                      ...prev,
                      interval: Math.max(1, Math.min(99, parseInt(e.target.value) || 1))
                    }))}
                    style={{
                      width: "50px",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: `1px solid ${colors.border}`,
                      background: colors.sidebar,
                      color: colors.text,
                      fontSize: "0.85rem",
                      textAlign: "center",
                    }}
                  />
                  <select
                    value={customRecurrence.unit}
                    onChange={(e) => setCustomRecurrence(prev => ({
                      ...prev,
                      unit: e.target.value as "day" | "week" | "month" | "year"
                    }))}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: `1px solid ${colors.border}`,
                      background: colors.sidebar,
                      color: colors.text,
                      fontSize: "0.85rem",
                    }}
                  >
                    <option value="day">day(s)</option>
                    <option value="week">week(s)</option>
                    <option value="month">month(s)</option>
                    <option value="year">year(s)</option>
                  </select>
                </div>
                <button
                  onClick={async () => {
                    const freqMap = { day: "DAILY", week: "WEEKLY", month: "MONTHLY", year: "YEARLY" };
                    const rule = `RRULE:FREQ=${freqMap[customRecurrence.unit]};INTERVAL=${customRecurrence.interval}`;
                    try {
                      await apiUpdateTask(recurrencePopover.taskId, userId, {
                        recurrence_rule: rule,
                      });
                      setTasks(prev => prev.map(t =>
                        t.id === recurrencePopover.taskId
                          ? { ...t, recurrenceRule: rule }
                          : t
                      ));
                      setRecurrencePopover(null);
                    } catch (err) {
                      console.error("Failed to set custom recurrence:", err);
                    }
                  }}
                  style={{
                    width: "100%",
                    marginTop: "10px",
                    padding: "8px",
                    background: colors.accent,
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    color: "#000",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                  }}
                >
                  Apply
                </button>
              </div>

              {/* Clear recurrence */}
              {tasks.find(t => t.id === recurrencePopover.taskId)?.recurrenceRule && (
                <button
                  onClick={async () => {
                    try {
                      await apiUpdateTask(recurrencePopover.taskId, userId, {
                        recurrence_rule: null,
                      });
                      setTasks(prev => prev.map(t =>
                        t.id === recurrencePopover.taskId
                          ? { ...t, recurrenceRule: null }
                          : t
                      ));
                      setRecurrencePopover(null);
                    } catch (err) {
                      console.error("Failed to clear recurrence:", err);
                    }
                  }}
                  style={{
                    width: "100%",
                    marginTop: "8px",
                    padding: "10px 12px",
                    background: "transparent",
                    border: `1px dashed ${colors.border}`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    color: colors.textMuted,
                    fontSize: "0.85rem",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.sidebarHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  Remove recurrence
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateProject && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCreateProject(false)}
        >
          <div
            style={{
              background: colors.sidebar,
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              borderRadius: "16px",
              border: `1px solid ${colors.border}`,
              padding: "24px",
              width: "400px",
              maxWidth: "90vw",
              boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.4)" : "0 8px 32px rgba(31, 38, 135, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 20px 0", color: colors.text }}>Create New List</h3>
            <input
              type="text"
              placeholder="List name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createProject()}
              autoFocus
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.text,
                fontSize: "1rem",
                marginBottom: "16px",
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCreateProject(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: `1px solid ${colors.border}`,
                  background: "none",
                  color: colors.textSecondary,
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                Cancel
              </button>
              <button
                onClick={createProject}
                disabled={!newProjectName.trim()}
                style={{
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "none",
                  background: `linear-gradient(135deg, ${colors.accent} 0%, #e6c200 100%)`,
                  color: "#000",
                  cursor: newProjectName.trim() ? "pointer" : "not-allowed",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  opacity: newProjectName.trim() ? 1 : 0.5,
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            padding: "12px 20px",
            background: "#ef4444",
            color: "#fff",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <AlertCircle size={18} />
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              padding: "2px",
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Save Filter Modal */}
      {showSaveFilterModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => setShowSaveFilterModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(30,30,40,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "24px",
              width: "400px",
              maxWidth: "90vw",
            }}
          >
            <h3
              style={{
                margin: "0 0 16px 0",
                fontSize: "18px",
                fontWeight: 600,
                color: "#fff",
              }}
            >
              Save Current Filter
            </h3>
            <p
              style={{
                margin: "0 0 16px 0",
                fontSize: "14px",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              Save your current filter settings for quick access later.
            </p>
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.7)",
                  marginBottom: "6px",
                }}
              >
                Filter Name
              </label>
              <input
                type="text"
                value={newFilterName}
                onChange={(e) => setNewFilterName(e.target.value)}
                placeholder="e.g., High Priority This Week"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFilterName.trim()) {
                    handleSaveFilter();
                  }
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.5)",
                  marginBottom: "8px",
                }}
              >
                Filter Criteria:
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                }}
              >
                {searchQuery ? (
                  <span
                    style={{
                      padding: "4px 8px",
                      background: "rgba(99,102,241,0.2)",
                      borderRadius: "4px",
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.8)",
                    }}
                  >
                    Search: {searchQuery}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.5)",
                      fontStyle: "italic",
                    }}
                  >
                    Current view settings
                  </span>
                )}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setShowSaveFilterModal(false);
                  setNewFilterName("");
                }}
                style={{
                  padding: "10px 16px",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFilter}
                disabled={!newFilterName.trim()}
                style={{
                  padding: "10px 20px",
                  background: newFilterName.trim()
                    ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                    : "rgba(255,255,255,0.1)",
                  border: "none",
                  borderRadius: "8px",
                  color: newFilterName.trim() ? "#fff" : "rgba(255,255,255,0.4)",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: newFilterName.trim() ? "pointer" : "not-allowed",
                }}
              >
                Save Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save as Template Modal */}
      {showSaveAsTemplate && saveAsTemplateTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => {
            setShowSaveAsTemplate(false);
            setSaveAsTemplateTask(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(30,30,40,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "24px",
              width: "450px",
              maxWidth: "90vw",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <Zap size={20} color={colors.accent} />
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#fff" }}>
                Save as Template
              </h3>
            </div>
            <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>
              Save &quot;{saveAsTemplateTask.title}&quot; as a reusable template.
            </p>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.7)", marginBottom: "6px" }}>
                Template Name
              </label>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Weekly Report"
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.7)", marginBottom: "6px" }}>
                Category (optional)
              </label>
              <input
                type="text"
                value={newTemplateCategory}
                onChange={(e) => setNewTemplateCategory(e.target.value)}
                placeholder="e.g., Reports, Meetings, Planning"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "20px",
              }}
            >
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "8px" }}>
                Template will include:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                <span style={{ padding: "4px 8px", background: "rgba(99,102,241,0.2)", borderRadius: "4px", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
                  Title pattern
                </span>
                {saveAsTemplateTask.priority && saveAsTemplateTask.priority !== "none" && (
                  <span style={{ padding: "4px 8px", background: "rgba(234,179,8,0.2)", borderRadius: "4px", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
                    Priority: {saveAsTemplateTask.priority}
                  </span>
                )}
                {saveAsTemplateTask.status && (
                  <span style={{ padding: "4px 8px", background: "rgba(34,197,94,0.2)", borderRadius: "4px", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
                    Status: {saveAsTemplateTask.status}
                  </span>
                )}
                {saveAsTemplateTask.labels?.length > 0 && (
                  <span style={{ padding: "4px 8px", background: "rgba(239,68,68,0.2)", borderRadius: "4px", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
                    {saveAsTemplateTask.labels.length} labels
                  </span>
                )}
                {saveAsTemplateTask.assignees?.length > 0 && (
                  <span style={{ padding: "4px 8px", background: "rgba(168,85,247,0.2)", borderRadius: "4px", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
                    {saveAsTemplateTask.assignees.length} assignees
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowSaveAsTemplate(false);
                  setSaveAsTemplateTask(null);
                  setNewTemplateName("");
                  setNewTemplateCategory("");
                }}
                style={{
                  padding: "10px 16px",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsTemplate}
                disabled={!newTemplateName.trim()}
                style={{
                  padding: "10px 20px",
                  background: newTemplateName.trim()
                    ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                    : "rgba(255,255,255,0.1)",
                  border: "none",
                  borderRadius: "8px",
                  color: newTemplateName.trim() ? "#fff" : "rgba(255,255,255,0.4)",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: newTemplateName.trim() ? "pointer" : "not-allowed",
                }}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Manager Modal - Using extracted component */}
      <TemplateManager
        isOpen={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
        templates={templates}
        colors={colors}
        onApplyTemplate={handleApplyTemplate}
        onDeleteTemplate={handleDeleteTemplate}
      />

      {/* Milestone Manager Modal - Using extracted component */}
      <MilestoneManager
        isOpen={showMilestoneManager}
        onClose={() => setShowMilestoneManager(false)}
        milestones={milestones}
        colors={colors}
        onCreateMilestone={handleCreateMilestoneFromData}
        onDeleteMilestone={handleDeleteMilestone}
      />

      {/* Task History Modal */}
      {showTaskHistory && historyTaskId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => {
            setShowTaskHistory(false);
            setHistoryTaskId(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(30,30,40,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              width: "500px",
              maxWidth: "90vw",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <History size={20} color={colors.accent} />
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#fff" }}>
                  Task History
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowTaskHistory(false);
                  setHistoryTaskId(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.5)",
                  padding: "4px",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {loadingHistory ? (
                <div style={{ padding: "40px", textAlign: "center" }}>
                  <Loader2 size={24} style={{ color: colors.accent, animation: "spin 1s linear infinite" }} />
                </div>
              ) : taskHistory.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center" }}>
                  <History size={40} style={{ opacity: 0.3, color: colors.accent, marginBottom: "16px" }} />
                  <p style={{ fontSize: "1rem", color: "#fff", margin: "0 0 8px 0" }}>
                    No history yet
                  </p>
                  <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", margin: 0 }}>
                    Changes to this task will appear here.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {taskHistory.map((entry, index) => {
                    const changeInfo = getChangeTypeInfo(entry.changeType);
                    const isLast = index === taskHistory.length - 1;
                    return (
                      <div
                        key={entry.id}
                        style={{
                          display: "flex",
                          gap: "12px",
                          padding: "12px 0",
                          position: "relative",
                        }}
                      >
                        {/* Timeline line */}
                        {!isLast && (
                          <div
                            style={{
                              position: "absolute",
                              left: "11px",
                              top: "34px",
                              bottom: "-2px",
                              width: "2px",
                              background: "rgba(255,255,255,0.1)",
                            }}
                          />
                        )}
                        {/* Icon */}
                        <div
                          style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            background: `${changeInfo.color}20`,
                            border: `2px solid ${changeInfo.color}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            color: changeInfo.color,
                          }}
                        >
                          {changeInfo.icon}
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 500 }}>
                              {changeInfo.label}
                            </span>
                            <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)" }}>
                              {new Date(entry.createdAt).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {/* Before/After values */}
                          {entry.changedFields.map(field => {
                            const prevVal = entry.previousValue?.[field];
                            const newVal = entry.newValue?.[field];
                            if (prevVal === undefined && newVal === undefined) return null;
                            return (
                              <div
                                key={field}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  fontSize: "0.8rem",
                                  marginTop: "4px",
                                  padding: "6px 10px",
                                  background: "rgba(255,255,255,0.03)",
                                  borderRadius: "6px",
                                }}
                              >
                                <span style={{ color: "rgba(255,255,255,0.5)", textTransform: "capitalize" }}>
                                  {field.replace(/_/g, " ")}:
                                </span>
                                {prevVal !== undefined && (
                                  <>
                                    <span style={{ color: "rgba(239,68,68,0.8)", textDecoration: "line-through" }}>
                                      {formatHistoryValue(prevVal, field)}
                                    </span>
                                    <ArrowRight size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
                                  </>
                                )}
                                <span style={{ color: "#22c55e" }}>
                                  {formatHistoryValue(newVal, field)}
                                </span>
                              </div>
                            );
                          })}
                          {/* Change note */}
                          {entry.changeNote && (
                            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: "6px", fontStyle: "italic" }}>
                              &ldquo;{entry.changeNote}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gantt Quick-Add Popover */}
      {ganttQuickAdd && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
          }}
          onClick={() => setGanttQuickAdd(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              left: `${ganttQuickAdd.x}px`,
              top: `${ganttQuickAdd.y}px`,
              transform: "translate(-50%, -100%) translateY(-10px)",
              background: "rgba(30, 30, 40, 0.98)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "10px",
              padding: "16px",
              minWidth: "280px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: "12px" }}>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: colors.textMuted,
                  marginBottom: "4px",
                }}
              >
                CREATE TASK
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.85rem",
                  color: colors.textSecondary,
                }}
              >
                <CalendarDays size={14} color="#FFD700" />
                {ganttQuickAdd.date.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>

            {/* Input */}
            <input
              type="text"
              value={ganttQuickAddTitle}
              onChange={(e) => setGanttQuickAddTitle(e.target.value)}
              onKeyDown={handleGanttQuickAddKeyDown}
              placeholder="Enter task title..."
              autoFocus
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "6px",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff",
                fontSize: "0.9rem",
                outline: "none",
                marginBottom: "12px",
              }}
            />

            {/* Actions */}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setGanttQuickAdd(null)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  color: colors.textSecondary,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleGanttQuickAddSubmit}
                disabled={!ganttQuickAddTitle.trim()}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  background: ganttQuickAddTitle.trim() ? colors.accent : "rgba(255,255,255,0.1)",
                  border: "none",
                  color: ganttQuickAddTitle.trim() ? "#000" : colors.textMuted,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: ganttQuickAddTitle.trim() ? "pointer" : "not-allowed",
                }}
              >
                Create Task
              </button>
            </div>

            {/* Hint */}
            <div
              style={{
                marginTop: "10px",
                fontSize: "0.7rem",
                color: colors.textMuted,
                textAlign: "center",
              }}
            >
              Press Enter to create • Esc to cancel
            </div>

            {/* Arrow pointing down */}
            <div
              style={{
                position: "absolute",
                bottom: "-8px",
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "8px solid transparent",
                borderRight: "8px solid transparent",
                borderTop: "8px solid rgba(30, 30, 40, 0.98)",
              }}
            />
          </div>
        </div>
      )}

      {/* Task Dependencies Picker Modal */}
      {showDependencyPicker && dependencyPickerTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => setShowDependencyPicker(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(30,30,40,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              width: "700px",
              maxWidth: "90vw",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <GitMerge size={20} color="#6366f1" />
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#fff" }}>
                    Task Dependencies
                  </h3>
                  <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#999" }}>
                    {dependencyPickerTask.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDependencyPicker(false)}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#999",
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              {loadingDependencies ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: "#6366f1" }} />
                  <span style={{ marginLeft: "10px", color: "#999" }}>Loading dependencies...</span>
                </div>
              ) : (
                <>
                  {/* Current Dependencies */}
                  <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    <h4 style={{ margin: "0 0 12px", fontSize: "0.85rem", fontWeight: 600, color: "#999" }}>
                      WAITING ON ({taskDependencies[dependencyPickerTask.id]?.length || 0})
                    </h4>
                    {(taskDependencies[dependencyPickerTask.id]?.length || 0) === 0 ? (
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "#666" }}>
                        No dependencies. This task can start anytime.
                      </p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {taskDependencies[dependencyPickerTask.id]?.map(dep => {
                          const depTask = tasks.find(t => t.id === dep.dependsOnTaskId);
                          const depType = DEPENDENCY_TYPES.find(dt => dt.value === dep.dependencyType);
                          const isDone = depTask?.status === "done";
                          return (
                            <div
                              key={dep.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                padding: "10px 14px",
                                borderRadius: "8px",
                                background: isDone ? "rgba(34, 197, 94, 0.1)" : "rgba(255,255,255,0.05)",
                                border: `1px solid ${isDone ? "rgba(34, 197, 94, 0.3)" : "rgba(255,255,255,0.1)"}`,
                              }}
                            >
                              {isDone ? (
                                <CheckCircle2 size={16} color="#22c55e" />
                              ) : (
                                <Circle size={16} color="#999" />
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: "0.9rem",
                                    fontWeight: 500,
                                    color: isDone ? "#22c55e" : "#fff",
                                    textDecoration: isDone ? "line-through" : "none",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {depTask?.title || "Unknown Task"}
                                </div>
                                <div style={{ fontSize: "0.7rem", color: "#888", marginTop: "2px" }}>
                                  {depType?.icon} {depType?.label}
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveDependency(dependencyPickerTask.id, dep.dependsOnTaskId)}
                                style={{
                                  width: "24px",
                                  height: "24px",
                                  borderRadius: "4px",
                                  background: "rgba(239, 68, 68, 0.1)",
                                  border: "none",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "#ef4444",
                                }}
                                title="Remove dependency"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Blocking (tasks that depend on this one) */}
                  {(taskDependents[dependencyPickerTask.id]?.length || 0) > 0 && (
                    <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      <h4 style={{ margin: "0 0 12px", fontSize: "0.85rem", fontWeight: 600, color: "#999" }}>
                        BLOCKING ({taskDependents[dependencyPickerTask.id]?.length || 0})
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {taskDependents[dependencyPickerTask.id]?.map(dep => {
                          const depTask = tasks.find(t => t.id === dep.taskId);
                          return (
                            <div
                              key={dep.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                padding: "10px 14px",
                                borderRadius: "8px",
                                background: "rgba(239, 68, 68, 0.05)",
                                border: "1px solid rgba(239, 68, 68, 0.2)",
                              }}
                            >
                              <Lock size={14} color="#ef4444" />
                              <div style={{ flex: 1 }}>
                                <div
                                  style={{
                                    fontSize: "0.9rem",
                                    fontWeight: 500,
                                    color: "#fff",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {depTask?.title || "Unknown Task"}
                                </div>
                                <div style={{ fontSize: "0.7rem", color: "#ef4444", marginTop: "2px" }}>
                                  Waiting on this task
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add New Dependency */}
                  <div style={{ padding: "20px 24px" }}>
                    <h4 style={{ margin: "0 0 12px", fontSize: "0.85rem", fontWeight: 600, color: "#999" }}>
                      ADD DEPENDENCY
                    </h4>

                    {/* Dependency Type Selector */}
                    <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                      {DEPENDENCY_TYPES.map(type => (
                        <button
                          key={type.value}
                          onClick={() => setSelectedDependencyType(type.value)}
                          style={{
                            flex: 1,
                            padding: "10px 12px",
                            borderRadius: "8px",
                            background: selectedDependencyType === type.value
                              ? "rgba(99, 102, 241, 0.2)"
                              : "rgba(255,255,255,0.05)",
                            border: `1px solid ${selectedDependencyType === type.value
                              ? "#6366f1"
                              : "rgba(255,255,255,0.1)"}`,
                            cursor: "pointer",
                            color: selectedDependencyType === type.value ? "#6366f1" : "#999",
                            textAlign: "left",
                          }}
                        >
                          <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                            {type.icon} {type.label}
                          </div>
                          <div style={{ fontSize: "0.7rem", marginTop: "4px", opacity: 0.8 }}>
                            {type.description}
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Search Tasks */}
                    <div style={{ position: "relative", marginBottom: "12px" }}>
                      <Search
                        size={14}
                        style={{
                          position: "absolute",
                          left: "12px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#666",
                        }}
                      />
                      <input
                        type="text"
                        value={dependencySearch}
                        onChange={(e) => setDependencySearch(e.target.value)}
                        placeholder="Search tasks to add as dependency..."
                        style={{
                          width: "100%",
                          padding: "10px 12px 10px 36px",
                          borderRadius: "8px",
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          color: "#fff",
                          fontSize: "0.9rem",
                          outline: "none",
                        }}
                      />
                    </div>

                    {/* Available Tasks */}
                    <div
                      style={{
                        maxHeight: "200px",
                        overflowY: "auto",
                        borderRadius: "8px",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      {availableDependencyTasks.length === 0 ? (
                        <div style={{ padding: "20px", textAlign: "center", color: "#666", fontSize: "0.85rem" }}>
                          {dependencySearch
                            ? "No matching tasks found"
                            : "No available tasks to add as dependencies"}
                        </div>
                      ) : (
                        availableDependencyTasks.slice(0, 10).map((task, index) => {
                          const statusInfo = activeStatuses.find(s => s.id === task.status);
                          return (
                            <button
                              key={task.id}
                              onClick={() => handleAddDependency(task.id)}
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                padding: "10px 14px",
                                background: "none",
                                border: "none",
                                borderBottom: index < Math.min(availableDependencyTasks.length - 1, 9)
                                  ? "1px solid rgba(255,255,255,0.05)"
                                  : "none",
                                cursor: "pointer",
                                color: "#fff",
                                textAlign: "left",
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                            >
                              <div
                                style={{
                                  width: "8px",
                                  height: "8px",
                                  borderRadius: "50%",
                                  background: statusInfo?.color || "#6b7280",
                                }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: "0.85rem",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {task.title}
                                </div>
                                <div style={{ fontSize: "0.7rem", color: "#666" }}>
                                  {statusInfo?.name || task.status}
                                </div>
                              </div>
                              <Plus size={14} color="#6366f1" />
                            </button>
                          );
                        })
                      )}
                      {availableDependencyTasks.length > 10 && (
                        <div style={{ padding: "10px", textAlign: "center", color: "#666", fontSize: "0.75rem" }}>
                          +{availableDependencyTasks.length - 10} more tasks. Refine your search.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Time Reports Modal */}
      {showTimeReports && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => setShowTimeReports(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(30,30,40,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              width: "800px",
              maxWidth: "90vw",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <BarChart3 size={20} color="#FFD700" />
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#fff" }}>
                  Time Reports
                </h3>
              </div>
              <button
                onClick={() => setShowTimeReports(false)}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#999",
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Filters */}
            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              {/* Date Range */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ fontSize: "0.8rem", color: "#999" }}>From:</label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#fff",
                    fontSize: "0.85rem",
                  }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ fontSize: "0.8rem", color: "#999" }}>To:</label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#fff",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              {/* Group By */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
                <label style={{ fontSize: "0.8rem", color: "#999" }}>Group by:</label>
                <select
                  value={reportGroupBy}
                  onChange={(e) => setReportGroupBy(e.target.value as typeof reportGroupBy)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#fff",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="task">Task</option>
                  <option value="user">User</option>
                </select>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              {loadingReport ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: "#FFD700" }} />
                  <span style={{ marginLeft: "10px", color: "#999" }}>Loading report...</span>
                </div>
              ) : !timeReport ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
                  <BarChart3 size={48} style={{ marginBottom: "16px", opacity: 0.3 }} />
                  <p style={{ margin: 0 }}>No time data available</p>
                </div>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "16px",
                      marginBottom: "24px",
                    }}
                  >
                    <div
                      style={{
                        padding: "20px",
                        borderRadius: "10px",
                        background: "rgba(255,215,0,0.1)",
                        border: "1px solid rgba(255,215,0,0.2)",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "#999", marginBottom: "4px" }}>
                        TOTAL TIME
                      </div>
                      <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#FFD700" }}>
                        {(timeReport.totalHours ?? 0).toFixed(1)}h
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#999" }}>
                        {formatReportTime(timeReport.totalSeconds ?? 0)}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "20px",
                        borderRadius: "10px",
                        background: "rgba(99,102,241,0.1)",
                        border: "1px solid rgba(99,102,241,0.2)",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "#999", marginBottom: "4px" }}>
                        TIME ENTRIES
                      </div>
                      <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#6366f1" }}>
                        {timeReport.entryCount ?? 0}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#999" }}>
                        total entries
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "20px",
                        borderRadius: "10px",
                        background: "rgba(34,197,94,0.1)",
                        border: "1px solid rgba(34,197,94,0.2)",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "#999", marginBottom: "4px" }}>
                        AVG PER ENTRY
                      </div>
                      <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#22c55e" }}>
                        {(timeReport.entryCount ?? 0) > 0
                          ? formatReportTime(Math.round((timeReport.totalSeconds ?? 0) / (timeReport.entryCount ?? 1)))
                          : "0m"}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#999" }}>
                        average duration
                      </div>
                    </div>
                  </div>

                  {/* Grouped Data */}
                  {timeReport.grouped && Object.keys(timeReport.grouped).length > 0 && (
                    <div>
                      <h4 style={{ margin: "0 0 16px", fontSize: "0.9rem", fontWeight: 600, color: "#fff" }}>
                        Time by {reportGroupBy.charAt(0).toUpperCase() + reportGroupBy.slice(1)}
                      </h4>
                      <div
                        style={{
                          background: "rgba(255,255,255,0.02)",
                          borderRadius: "10px",
                          border: "1px solid rgba(255,255,255,0.1)",
                          overflow: "hidden",
                        }}
                      >
                        {Object.entries(timeReport.grouped)
                          .sort((a, b) => b[1] - a[1])
                          .map(([key, seconds], index) => {
                            const maxSeconds = Math.max(...Object.values(timeReport.grouped));
                            const percentage = (seconds / maxSeconds) * 100;
                            return (
                              <div
                                key={key}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  padding: "14px 16px",
                                  borderBottom: index < Object.keys(timeReport.grouped).length - 1
                                    ? "1px solid rgba(255,255,255,0.05)"
                                    : "none",
                                }}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontSize: "0.85rem",
                                      fontWeight: 500,
                                      color: "#fff",
                                      marginBottom: "6px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {key}
                                  </div>
                                  <div
                                    style={{
                                      height: "6px",
                                      borderRadius: "3px",
                                      background: "rgba(255,255,255,0.1)",
                                      overflow: "hidden",
                                    }}
                                  >
                                    <div
                                      style={{
                                        height: "100%",
                                        width: `${percentage}%`,
                                        borderRadius: "3px",
                                        background: "linear-gradient(90deg, #FFD700, #FF9500)",
                                        transition: "width 0.3s",
                                      }}
                                    />
                                  </div>
                                </div>
                                <div
                                  style={{
                                    marginLeft: "20px",
                                    fontSize: "0.9rem",
                                    fontWeight: 600,
                                    color: "#FFD700",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {formatReportTime(seconds)}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* No grouped data message */}
                  {(!timeReport.grouped || Object.keys(timeReport.grouped).length === 0) && (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "30px",
                        background: "rgba(255,255,255,0.02)",
                        borderRadius: "10px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#666",
                      }}
                    >
                      <Clock size={32} style={{ marginBottom: "12px", opacity: 0.3 }} />
                      <p style={{ margin: 0, fontSize: "0.9rem" }}>
                        No time entries for the selected period
                      </p>
                      <p style={{ margin: "8px 0 0", fontSize: "0.8rem" }}>
                        Start tracking time on tasks to see reports here
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trash View Modal - Using extracted component */}
      <TrashView
        isOpen={showTrashView}
        onClose={() => setShowTrashView(false)}
        trashedTasks={trashedTasks}
        loading={loadingTrash}
        colors={colors}
        onRestore={restoreFromTrash}
        onPermanentDelete={permanentlyDeleteTask}
        onEmptyTrash={handleEmptyTrash}
      />

      {/* Automation Rules Manager Modal - Using extracted component */}
      <AutomationManager
        isOpen={showAutomationManager}
        onClose={() => setShowAutomationManager(false)}
        rules={automationRules}
        loading={loadingRules}
        colors={colors}
        onToggleEnabled={toggleRuleEnabled}
        onCreateRule={handleCreateRule}
        onUpdateRule={handleUpdateRule}
        onDeleteRule={handleDeleteRule}
      />

      {/* Custom Field Manager Modal */}
      {showFieldManager && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => setShowFieldManager(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(30,30,40,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              width: "500px",
              maxWidth: "90vw",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Settings size={20} color={colors.accent} />
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#fff" }}>
                  Custom Fields
                </h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={() => setShowCreateField(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 12px",
                    background: `${colors.accent}20`,
                    border: `1px solid ${colors.accent}40`,
                    borderRadius: "6px",
                    color: colors.accent,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} />
                  Add
                </button>
                <button
                  onClick={() => setShowFieldManager(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "rgba(255,255,255,0.5)",
                    padding: "4px",
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {customFields.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center" }}>
                  <Settings size={40} style={{ opacity: 0.3, color: colors.accent, marginBottom: "16px" }} />
                  <p style={{ fontSize: "1rem", color: "#fff", margin: "0 0 8px 0" }}>
                    No custom fields
                  </p>
                  <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", margin: 0 }}>
                    Add custom fields to capture project-specific data.
                  </p>
                </div>
              ) : (
                customFields.map((field) => (
                  <div
                    key={field.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: "8px",
                      marginBottom: "8px",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.9rem", color: "#fff", fontWeight: 500 }}>
                        {field.name}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: "2px" }}>
                        Type: {field.fieldType}
                        {field.isRequired && " • Required"}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Delete field "${field.name}"?`)) {
                          handleDeleteField(field.id);
                        }
                      }}
                      style={{
                        padding: "6px 10px",
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.3)",
                        borderRadius: "6px",
                        color: "#ef4444",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Field Modal */}
      {showCreateField && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2100,
          }}
          onClick={() => setShowCreateField(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(30,30,40,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "24px",
              width: "400px",
              maxWidth: "90vw",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <Settings size={20} color={colors.accent} />
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#fff" }}>
                Create Custom Field
              </h3>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.7)", marginBottom: "6px" }}>
                Field Name
              </label>
              <input
                type="text"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                placeholder="e.g., Sprint, Story Points"
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.7)", marginBottom: "6px" }}>
                Field Type
              </label>
              <select
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value as CustomField["fieldType"])}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "14px",
                  outline: "none",
                }}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="checkbox">Checkbox</option>
                <option value="select">Select (Dropdown)</option>
                <option value="url">URL</option>
                <option value="email">Email</option>
                <option value="currency">Currency</option>
                <option value="percent">Percent</option>
                <option value="rating">Rating</option>
                <option value="progress">Progress</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowCreateField(false);
                  setNewFieldName("");
                  setNewFieldType("text");
                }}
                style={{
                  padding: "10px 16px",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateField}
                disabled={!newFieldName.trim()}
                style={{
                  padding: "10px 20px",
                  background: newFieldName.trim()
                    ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                    : "rgba(255,255,255,0.1)",
                  border: "none",
                  borderRadius: "8px",
                  color: newFieldName.trim() ? "#fff" : "rgba(255,255,255,0.4)",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: newFieldName.trim() ? "pointer" : "not-allowed",
                }}
              >
                Create Field
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Tasks Modal - Using extracted component */}
      <ImportTasksModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        projectName={selectedProject?.name || ""}
        colors={colors}
        onImport={handleImportTasks}
      />

      {/* Sprint 3G: Analytics Modal */}
      {showAnalytics && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAnalytics(false); }}
        >
          <div
            style={{
              width: "720px",
              maxHeight: "80vh",
              borderRadius: "16px",
              background: isDark ? "rgba(30, 30, 35, 0.98)" : "rgba(255,255,255,0.98)",
              border: `1px solid ${colors.border}`,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 25px 50px rgba(0,0,0,0.4)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <PieChart size={20} color={colors.accent} />
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: colors.text }}>
                  Project Analytics
                </h3>
              </div>
              <button
                onClick={() => setShowAnalytics(false)}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  background: colors.surface,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: colors.textMuted,
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Axis Selector */}
            <div
              style={{
                padding: "16px 24px",
                borderBottom: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <label style={{ fontSize: "0.85rem", color: colors.textMuted }}>Group by:</label>
              <select
                value={analyticsXAxis}
                onChange={(e) => setAnalyticsXAxis(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                <option value="state__group">State</option>
                <option value="priority">Priority</option>
                <option value="label__name">Label</option>
                <option value="assignees__id">Assignee</option>
              </select>
              <button
                onClick={() => loadAnalytics()}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  background: colors.accent,
                  color: "#000",
                  border: "none",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
              {analyticsLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: colors.accent }} />
                  <span style={{ marginLeft: "10px", color: colors.textMuted }}>Loading analytics...</span>
                </div>
              ) : !analyticsData ? (
                <div style={{ textAlign: "center", padding: "40px", color: colors.textMuted }}>
                  <PieChart size={48} style={{ marginBottom: "16px", opacity: 0.3 }} />
                  <p style={{ margin: 0 }}>No analytics data available</p>
                  <p style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>
                    Select a project and click Refresh to load analytics.
                  </p>
                </div>
              ) : (
                <div>
                  {/* Render analytics as horizontal bar chart */}
                  {(() => {
                    // analyticsData may be {distribution: [{key, value}]} or directly an array
                    const entries: Array<{key: string; value: number}> =
                      Array.isArray(analyticsData) ? analyticsData
                      : analyticsData?.distribution ? analyticsData.distribution
                      : Object.entries(analyticsData).filter(([k]) => k !== "total").map(([k, v]) => ({ key: k, value: v as number }));

                    if (!entries || entries.length === 0) {
                      return (
                        <div style={{ textAlign: "center", padding: "20px", color: colors.textMuted }}>
                          No distribution data returned.
                        </div>
                      );
                    }

                    const maxValue = Math.max(...entries.map(e => typeof e.value === "number" ? e.value : 0), 1);
                    const total = entries.reduce((sum, e) => sum + (typeof e.value === "number" ? e.value : 0), 0);

                    const barColors = ["#FFD600", "#3b82f6", "#22c55e", "#ec4899", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];

                    return (
                      <>
                        {/* Summary */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "16px",
                            marginBottom: "24px",
                            padding: "16px",
                            borderRadius: "12px",
                            background: colors.surface,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          <TrendingUp size={20} color={colors.accent} />
                          <div>
                            <div style={{ fontSize: "0.8rem", color: colors.textMuted }}>Total Issues</div>
                            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: colors.text }}>{total}</div>
                          </div>
                          <div style={{ marginLeft: "auto" }}>
                            <div style={{ fontSize: "0.8rem", color: colors.textMuted }}>Categories</div>
                            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: colors.text }}>{entries.length}</div>
                          </div>
                        </div>

                        {/* Horizontal bars */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          {entries.map((entry, idx) => {
                            const val = typeof entry.value === "number" ? entry.value : 0;
                            const pct = maxValue > 0 ? (val / maxValue) * 100 : 0;
                            const color = barColors[idx % barColors.length];
                            const label = String(entry.key || "Unknown")
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, c => c.toUpperCase());

                            return (
                              <div key={idx}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    marginBottom: "4px",
                                    fontSize: "0.85rem",
                                  }}
                                >
                                  <span style={{ color: colors.text, fontWeight: 500 }}>{label}</span>
                                  <span style={{ color: colors.textMuted }}>{val} ({total > 0 ? Math.round((val / total) * 100) : 0}%)</span>
                                </div>
                                <div
                                  style={{
                                    height: "24px",
                                    borderRadius: "6px",
                                    background: colors.surface,
                                    overflow: "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      height: "100%",
                                      width: `${pct}%`,
                                      borderRadius: "6px",
                                      background: color,
                                      transition: "width 0.5s ease",
                                      minWidth: val > 0 ? "4px" : "0",
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sprint 3G: Pages Modal */}
      {showPages && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPages(false); }}
        >
          <div
            style={{
              width: "640px",
              maxHeight: "80vh",
              borderRadius: "16px",
              background: isDark ? "rgba(30, 30, 35, 0.98)" : "rgba(255,255,255,0.98)",
              border: `1px solid ${colors.border}`,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 25px 50px rgba(0,0,0,0.4)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <FileText size={20} color={colors.accent} />
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: colors.text }}>
                  Project Pages
                </h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={() => setShowCreatePage(true)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    background: colors.accent,
                    color: "#000",
                    border: "none",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Plus size={14} />
                  New Page
                </button>
                <button
                  onClick={() => setShowPages(false)}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    background: colors.surface,
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: colors.textMuted,
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Create Page Inline Form */}
            {showCreatePage && (
              <div
                style={{
                  padding: "16px 24px",
                  borderBottom: `1px solid ${colors.border}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <input
                  type="text"
                  placeholder="Page title..."
                  value={newPageName}
                  onChange={(e) => setNewPageName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreatePage(); if (e.key === "Escape") setShowCreatePage(false); }}
                  autoFocus
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                    fontSize: "0.9rem",
                    outline: "none",
                  }}
                />
                <textarea
                  placeholder="Description (optional)..."
                  value={newPageDescription}
                  onChange={(e) => setNewPageDescription(e.target.value)}
                  rows={2}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                    fontSize: "0.85rem",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => { setShowCreatePage(false); setNewPageName(""); setNewPageDescription(""); }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      background: "transparent",
                      border: `1px solid ${colors.border}`,
                      color: colors.textSecondary,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreatePage}
                    disabled={!newPageName.trim()}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      background: newPageName.trim() ? colors.accent : colors.surface,
                      color: newPageName.trim() ? "#000" : colors.textMuted,
                      border: "none",
                      fontSize: "0.85rem",
                      fontWeight: 500,
                      cursor: newPageName.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    Create
                  </button>
                </div>
              </div>
            )}

            {/* Pages List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {pagesLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: colors.accent }} />
                  <span style={{ marginLeft: "10px", color: colors.textMuted }}>Loading pages...</span>
                </div>
              ) : pages.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: colors.textMuted }}>
                  <FileText size={48} style={{ marginBottom: "16px", opacity: 0.3 }} />
                  <p style={{ margin: 0, fontSize: "0.9rem" }}>No pages yet</p>
                  <p style={{ margin: "8px 0 0", fontSize: "0.8rem" }}>
                    Create your first project page to document ideas, specs, or notes.
                  </p>
                </div>
              ) : (
                pages.map((page) => (
                  <div
                    key={page.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 24px",
                      borderBottom: `1px solid ${colors.border}`,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = colors.rowHover}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <FileText size={16} color={colors.accent} style={{ flexShrink: 0 }} />
                    {editingPageId === page.id ? (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                        <input
                          type="text"
                          value={editPageName}
                          onChange={(e) => setEditPageName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleUpdatePage(); if (e.key === "Escape") setEditingPageId(null); }}
                          autoFocus
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            background: colors.surface,
                            border: `1px solid ${colors.border}`,
                            color: colors.text,
                            fontSize: "0.85rem",
                            outline: "none",
                          }}
                        />
                        <textarea
                          value={editPageDescription}
                          onChange={(e) => setEditPageDescription(e.target.value)}
                          rows={2}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            background: colors.surface,
                            border: `1px solid ${colors.border}`,
                            color: colors.text,
                            fontSize: "0.8rem",
                            outline: "none",
                            resize: "vertical",
                          }}
                        />
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={handleUpdatePage}
                            style={{
                              padding: "4px 10px",
                              borderRadius: "6px",
                              background: colors.accent,
                              color: "#000",
                              border: "none",
                              fontSize: "0.8rem",
                              cursor: "pointer",
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingPageId(null)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: "6px",
                              background: "transparent",
                              border: `1px solid ${colors.border}`,
                              color: colors.textMuted,
                              fontSize: "0.8rem",
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.9rem", fontWeight: 500, color: colors.text }}>
                            {page.name}
                          </div>
                          {(page.description || page.description_html) && (
                            <div style={{ fontSize: "0.8rem", color: colors.textMuted, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {page.description || "Has content"}
                            </div>
                          )}
                          <div style={{ fontSize: "0.75rem", color: colors.textMuted, marginTop: "4px" }}>
                            {page.created_at ? new Date(page.created_at).toLocaleDateString() : ""}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setEditingPageId(page.id);
                            setEditPageName(page.name || "");
                            setEditPageDescription(page.description || "");
                          }}
                          style={{
                            padding: "4px",
                            borderRadius: "4px",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: colors.textMuted,
                          }}
                          title="Edit page"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete page "${page.name}"?`)) {
                              handleDeletePage(page.id);
                            }
                          }}
                          style={{
                            padding: "4px",
                            borderRadius: "4px",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: colors.textMuted,
                          }}
                          title="Delete page"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sprint 3G: Saved Views Modal */}
      {showViews && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowViews(false); }}
        >
          <div
            style={{
              width: "580px",
              maxHeight: "70vh",
              borderRadius: "16px",
              background: isDark ? "rgba(30, 30, 35, 0.98)" : "rgba(255,255,255,0.98)",
              border: `1px solid ${colors.border}`,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 25px 50px rgba(0,0,0,0.4)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <BookOpen size={20} color={colors.accent} />
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: colors.text }}>
                  Saved Views
                </h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={() => setShowCreateView(true)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    background: colors.accent,
                    color: "#000",
                    border: "none",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Plus size={14} />
                  Save View
                </button>
                <button
                  onClick={() => setShowViews(false)}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    background: colors.surface,
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: colors.textMuted,
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Create View Inline Form */}
            {showCreateView && (
              <div
                style={{
                  padding: "16px 24px",
                  borderBottom: `1px solid ${colors.border}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <input
                  type="text"
                  placeholder="View name..."
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateView(); if (e.key === "Escape") setShowCreateView(false); }}
                  autoFocus
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                    fontSize: "0.9rem",
                    outline: "none",
                  }}
                />
                <input
                  type="text"
                  placeholder="Description (optional)..."
                  value={newViewDescription}
                  onChange={(e) => setNewViewDescription(e.target.value)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                    fontSize: "0.85rem",
                    outline: "none",
                  }}
                />
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => { setShowCreateView(false); setNewViewName(""); setNewViewDescription(""); }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      background: "transparent",
                      border: `1px solid ${colors.border}`,
                      color: colors.textSecondary,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateView}
                    disabled={!newViewName.trim()}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      background: newViewName.trim() ? colors.accent : colors.surface,
                      color: newViewName.trim() ? "#000" : colors.textMuted,
                      border: "none",
                      fontSize: "0.85rem",
                      fontWeight: 500,
                      cursor: newViewName.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Views List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {viewsLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: colors.accent }} />
                  <span style={{ marginLeft: "10px", color: colors.textMuted }}>Loading views...</span>
                </div>
              ) : savedViews.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: colors.textMuted }}>
                  <BookOpen size={48} style={{ marginBottom: "16px", opacity: 0.3 }} />
                  <p style={{ margin: 0, fontSize: "0.9rem" }}>No saved views yet</p>
                  <p style={{ margin: "8px 0 0", fontSize: "0.8rem" }}>
                    Save a view to quickly apply filter combinations later.
                  </p>
                </div>
              ) : (
                savedViews.map((view) => {
                  const viewFilters = extractSavedViewFilters(view);
                  const criteriaCount = countActiveFilterCriteria(viewFilters);
                  const isActiveView = activeViewId === view.id;

                  return (
                  <div
                    key={view.id}
                    role="button"
                    tabIndex={0}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 24px",
                      borderBottom: `1px solid ${colors.border}`,
                      transition: "background 0.15s",
                      cursor: "pointer",
                      background: isActiveView ? `${colors.accent}14` : "transparent",
                    }}
                    onClick={() => handleApplyView(view)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleApplyView(view);
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (!isActiveView) {
                        e.currentTarget.style.background = colors.rowHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isActiveView ? `${colors.accent}14` : "transparent";
                    }}
                  >
                    <Eye size={16} color={isActiveView ? colors.accent : colors.textMuted} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.9rem", fontWeight: isActiveView ? 600 : 500, color: colors.text }}>
                        {view.name}
                      </div>
                      {view.description && (
                        <div style={{ fontSize: "0.8rem", color: colors.textMuted, marginTop: "2px" }}>
                          {view.description}
                        </div>
                      )}
                      {criteriaCount > 0 && (
                        <div style={{ fontSize: "0.75rem", color: colors.textMuted, marginTop: "4px" }}>
                          {criteriaCount} filter{criteriaCount !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        if (confirm(`Delete view "${view.name}"?`)) {
                          handleDeleteView(view.id);
                        }
                      }}
                      style={{
                        padding: "4px",
                        borderRadius: "4px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: colors.textMuted,
                      }}
                      title="Delete view"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )})
              )}
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showKeyboardShortcuts && (
        <KeyboardShortcutsHelp
          isOpen={showKeyboardShortcuts}
          onClose={() => setShowKeyboardShortcuts(false)}
          colors={{
            text: colors.text,
            textMuted: colors.textMuted,
            surface: colors.surface,
            surfaceHover: colors.surfaceHover,
            border: colors.border,
            accent: colors.accent,
          }}
          isDark={isDark}
        />
      )}
    </UnifiedLayout>
  );
}

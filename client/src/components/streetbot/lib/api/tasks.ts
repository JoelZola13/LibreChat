/**
 * Tasks API service - connects frontend to backend task management
 */

// Types matching the backend API responses (snake_case from API)
interface ProjectApiResponse {
  id: string;
  name: string;
  description?: string;
  status: string;
  color: string;
  icon?: string;
  member_count: number;
  task_count: number;
  completed_count: number;
  created_at: string;
  updated_at: string;
}

interface TaskApiResponse {
  id: string;
  project_id?: string;
  parent_task_id?: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_at?: string;
  start_at?: string;
  completed_at?: string;
  assignees: string[];
  labels: string[];
  created_at: string;
  updated_at: string;
  position: number;
  subtask_count: number;
  completed_subtasks: number;
  comment_count: number;
  milestone_id?: string;
  recurrence_rule?: string;
}

interface CommentApiResponse {
  id: string;
  task_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

// Frontend types (camelCase for React)
export interface Project {
  id: string;
  name: string;
  description?: string;
  status: "active" | "archived";
  color: string;
  icon?: string;
  memberCount: number;
  taskCount: number;
  completedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueAt?: string;
  startAt?: string;
  completedAt?: string;
  assignees: string[];
  labels: string[];
  createdAt: string;
  updatedAt: string;
  position: number;
  subtaskCount: number;
  completedSubtasks: number;
  commentCount: number;
  milestoneId?: string | null;
  recurrenceRule?: string | null;
  // Advanced task metadata fields
  cycleId?: string | null;
  moduleId?: string | null;
  epicId?: string | null;
  stateGroupId?: string | null;
  estimate?: number | null;
  workItemTypeId?: string | null;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  body: string;
  createdAt: string;
}

// Transform API response to frontend format
function transformProject(api: ProjectApiResponse): Project {
  return {
    id: api.id,
    name: api.name,
    description: api.description,
    status: api.status as "active" | "archived",
    color: api.color,
    icon: api.icon,
    memberCount: api.member_count,
    taskCount: api.task_count,
    completedCount: api.completed_count,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

function transformTask(api: TaskApiResponse): Task {
  return {
    id: api.id,
    projectId: api.project_id || "",
    parentTaskId: api.parent_task_id || null,
    title: api.title,
    description: api.description,
    status: api.status,
    priority: api.priority,
    dueAt: api.due_at,
    startAt: api.start_at,
    completedAt: api.completed_at,
    assignees: api.assignees || [],
    labels: api.labels || [],
    createdAt: api.created_at,
    updatedAt: api.updated_at,
    position: api.position,
    subtaskCount: api.subtask_count,
    completedSubtasks: api.completed_subtasks,
    commentCount: api.comment_count,
    milestoneId: api.milestone_id || null,
    recurrenceRule: api.recurrence_rule || null,
  };
}

function transformComment(api: CommentApiResponse): Comment {
  return {
    id: api.id,
    taskId: api.task_id,
    userId: api.user_id,
    body: api.body,
    createdAt: api.created_at,
  };
}

// API Error class
export class TasksApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "TasksApiError";
  }
}

// Helper for API calls - uses /sbapi proxy to StreetBot backend
async function apiCall<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  // Prepend /sbapi for StreetBot backend proxy (proxy strips /sbapi, keeps /api/)
  const apiUrl = url.startsWith('/api/') ? `/sbapi${url}` : url;
  const response = await fetch(apiUrl, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorDetail;
    try {
      errorDetail = await response.json();
    } catch {
      errorDetail = await response.text();
    }
    throw new TasksApiError(
      `API error: ${response.statusText}`,
      response.status,
      errorDetail
    );
  }

  return response.json();
}

// ============ Projects API ============

export async function fetchProjects(
  userId: string,
  status?: string
): Promise<Project[]> {
  const params = new URLSearchParams({ user_id: userId });
  if (status) params.append("status", status);

  const data = await apiCall<ProjectApiResponse[]>(
    `/api/projects?${params.toString()}`
  );
  return data.map(transformProject);
}

export async function fetchProject(projectId: string): Promise<Project> {
  const data = await apiCall<ProjectApiResponse>(`/api/projects/${projectId}`);
  return transformProject(data);
}

export async function createProject(
  userId: string,
  project: { name: string; description?: string; color?: string }
): Promise<Project> {
  const data = await apiCall<ProjectApiResponse>(
    `/api/projects?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify(project),
    }
  );
  return transformProject(data);
}

export async function updateProject(
  projectId: string,
  updates: { name?: string; description?: string; color?: string; status?: string }
): Promise<Project> {
  const data = await apiCall<ProjectApiResponse>(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  return transformProject(data);
}

export async function archiveProject(projectId: string): Promise<Project> {
  const data = await apiCall<ProjectApiResponse>(
    `/api/projects/${projectId}/archive`,
    { method: "POST" }
  );
  return transformProject(data);
}

// ============ Tasks API ============

export interface FetchTasksOptions {
  status?: string;
  priority?: string;
  assignee?: string;
  parentTaskId?: string | null;
  search?: string;
  limit?: number;
}

export async function fetchProjectTasks(
  projectId: string,
  userId?: string,
  options: FetchTasksOptions = {}
): Promise<Task[]> {
  const params = new URLSearchParams();
  // user_id is required by the backend
  if (userId) params.append("user_id", userId);
  if (options.status) params.append("status", options.status);
  if (options.priority) params.append("priority", options.priority);
  if (options.assignee) params.append("assignee", options.assignee);
  if (options.parentTaskId !== undefined) {
    params.append("parent_task_id", options.parentTaskId || "null");
  }
  if (options.search) params.append("search", options.search);
  if (options.limit) params.append("limit", options.limit.toString());

  const queryString = params.toString();
  const url = `/api/projects/${projectId}/tasks${queryString ? `?${queryString}` : ""}`;

  const data = await apiCall<TaskApiResponse[]>(url);
  return data.map(transformTask);
}

export async function fetchTask(taskId: string, userId?: string, projectId?: string): Promise<Task> {
  const params = new URLSearchParams();
  if (userId) params.append("user_id", userId);
  if (projectId) params.append("project_id", projectId);
  const queryString = params.toString();
  const url = `/api/tasks/${taskId}${queryString ? `?${queryString}` : ""}`;
  const data = await apiCall<TaskApiResponse>(url);
  return transformTask(data);
}

export async function fetchSubtasks(taskId: string): Promise<Task[]> {
  const data = await apiCall<TaskApiResponse[]>(`/api/tasks/${taskId}/subtasks`);
  return data.map(transformTask);
}

export async function createTask(
  userId: string,
  task: {
    project_id: string;
    parent_task_id?: string;
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    start_at?: string;
    due_at?: string;
    assignees?: string[];
  }
): Promise<Task> {
  // Task creation is via project endpoint
  const { project_id, ...taskData } = task;
  const data = await apiCall<TaskApiResponse>(
    `/api/projects/${project_id}/tasks?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({ project_id, ...taskData }),
    }
  );
  return transformTask(data);
}

export async function updateTask(
  taskId: string,
  userId: string,
  updates: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    due_at?: string;
    start_at?: string;
    completed_at?: string;
    assignees?: string[];
    labels?: string[];
    position?: number;
    milestone_id?: string | null;
    recurrence_rule?: string | null;
  },
  projectId?: string,
): Promise<Task> {
  const params = new URLSearchParams({ user_id: userId });
  if (projectId) params.append("project_id", projectId);
  const data = await apiCall<TaskApiResponse>(`/api/tasks/${taskId}?${params.toString()}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  return transformTask(data);
}

export async function deleteTask(taskId: string, userId: string, projectId?: string): Promise<void> {
  const params = new URLSearchParams({ user_id: userId });
  if (projectId) params.append("project_id", projectId);
  await apiCall<void>(`/api/tasks/${taskId}?${params.toString()}`, { method: "DELETE" });
}

export async function moveTask(
  taskId: string,
  move: {
    new_parent_task_id?: string;
    new_position: number;
    project_id: string;
  }
): Promise<Task> {
  const data = await apiCall<TaskApiResponse>(`/api/tasks/${taskId}/move`, {
    method: "POST",
    body: JSON.stringify(move),
  });
  return transformTask(data);
}

// ============ Comments API ============

export async function fetchComments(taskId: string): Promise<Comment[]> {
  const data = await apiCall<CommentApiResponse[]>(
    `/api/tasks/${taskId}/comments`
  );
  return data.map(transformComment);
}

export async function createComment(
  taskId: string,
  comment: { user_id: string; body: string }
): Promise<Comment> {
  const data = await apiCall<CommentApiResponse>(
    `/api/tasks/${taskId}/comments`,
    {
      method: "POST",
      body: JSON.stringify(comment),
    }
  );
  return transformComment(data);
}

// ============ Labels API ============

export interface Label {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export async function fetchLabels(userId: string): Promise<Label[]> {
  const data = await apiCall<
    Array<{ id: string; name: string; color: string; created_at: string }>
  >(`/api/tasks/labels?user_id=${userId}`);
  return data.map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color,
    createdAt: l.created_at,
  }));
}

export async function createLabel(
  userId: string,
  label: { name: string; color: string }
): Promise<Label> {
  const data = await apiCall<{
    id: string;
    name: string;
    color: string;
    created_at: string;
  }>(`/api/tasks/labels?user_id=${userId}`, {
    method: "POST",
    body: JSON.stringify(label),
  });
  return {
    id: data.id,
    name: data.name,
    color: data.color,
    createdAt: data.created_at,
  };
}

export async function deleteLabel(labelId: string): Promise<void> {
  await apiCall<void>(`/api/tasks/labels/${labelId}`, { method: "DELETE" });
}

// ============ Smart Views API ============

export async function fetchTasksToday(userId: string): Promise<Task[]> {
  const data = await apiCall<TaskApiResponse[]>(
    `/api/tasks/today?user_id=${userId}`
  );
  return data.map(transformTask);
}

export async function fetchOverdueTasks(userId: string): Promise<Task[]> {
  const data = await apiCall<TaskApiResponse[]>(
    `/api/tasks/overdue?user_id=${userId}`
  );
  return data.map(transformTask);
}

export async function fetchUpcomingTasks(
  userId: string,
  days: number = 7
): Promise<Task[]> {
  const data = await apiCall<TaskApiResponse[]>(
    `/api/tasks/upcoming?user_id=${userId}&days=${days}`
  );
  return data.map(transformTask);
}

// ============ Quick Add API ============

export interface QuickAddResult {
  task: Task;
  parsed: {
    title: string;
    priority?: string;
    labels: string[];
    project_name?: string;
    due_date?: string;
  };
}

export async function quickAddTask(
  userId: string,
  text: string,
  projectId?: string
): Promise<QuickAddResult> {
  const data = await apiCall<{
    task: TaskApiResponse;
    parsed: {
      title: string;
      priority?: string;
      labels: string[];
      project_name?: string;
      due_date?: string;
    };
  }>(`/api/tasks/quick-add?user_id=${userId}`, {
    method: "POST",
    body: JSON.stringify({ text, project_id: projectId }),
  });
  return {
    task: transformTask(data.task),
    parsed: data.parsed,
  };
}

// ============ Task Dependencies API ============

export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: "finish_to_start" | "start_to_start" | "finish_to_finish";
  lagDays: number; // positive = lag (delay), negative = lead (overlap)
  createdAt: string;
  blockingTask?: Task;
}

interface DependencyApiResponse {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: string;
  lag_days?: number;
  created_at: string;
  blocking_task?: TaskApiResponse;
}

function transformDependency(api: DependencyApiResponse): TaskDependency {
  return {
    id: api.id,
    taskId: api.task_id,
    dependsOnTaskId: api.depends_on_task_id,
    dependencyType: api.dependency_type as TaskDependency["dependencyType"],
    lagDays: api.lag_days ?? 0,
    createdAt: api.created_at,
    blockingTask: api.blocking_task ? transformTask(api.blocking_task) : undefined,
  };
}

export async function fetchTaskDependencies(taskId: string): Promise<TaskDependency[]> {
  const data = await apiCall<DependencyApiResponse[]>(
    `/api/tasks/${taskId}/dependencies`
  );
  return data.map(transformDependency);
}

export async function fetchDependentTasks(taskId: string): Promise<TaskDependency[]> {
  const data = await apiCall<DependencyApiResponse[]>(
    `/api/tasks/${taskId}/dependents`
  );
  return data.map(transformDependency);
}

export async function addTaskDependency(
  taskId: string,
  dependsOnTaskId: string,
  userId: string,
  dependencyType: string = "finish_to_start",
  lagDays: number = 0
): Promise<TaskDependency> {
  const data = await apiCall<DependencyApiResponse>(
    `/api/tasks/${taskId}/dependencies?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({
        depends_on_task_id: dependsOnTaskId,
        dependency_type: dependencyType,
        lag_days: lagDays,
      }),
    }
  );
  return transformDependency(data);
}

export async function updateTaskDependency(
  taskId: string,
  dependsOnTaskId: string,
  userId: string,
  updates: { dependencyType?: string; lagDays?: number }
): Promise<TaskDependency> {
  // Backend doesn't support PATCH on dependencies - use delete+create
  // First get the existing dependency to preserve fields
  const existing = await fetchTaskDependencies(taskId);
  const existingDep = existing.find(d => d.dependsOnTaskId === dependsOnTaskId);

  // Delete the old dependency
  await removeTaskDependency(taskId, dependsOnTaskId, userId);

  // Re-create with updated values
  return addTaskDependency(
    taskId,
    dependsOnTaskId,
    userId,
    updates.dependencyType || existingDep?.dependencyType || "finish_to_start",
    updates.lagDays ?? existingDep?.lagDays ?? 0,
  );
}

export async function removeTaskDependency(
  taskId: string,
  dependsOnTaskId: string,
  userId: string
): Promise<void> {
  await apiCall<void>(
    `/api/tasks/${taskId}/dependencies/${dependsOnTaskId}?user_id=${userId}`,
    { method: "DELETE" }
  );
}

export async function fetchBlockingTasks(taskId: string): Promise<Task[]> {
  const data = await apiCall<TaskApiResponse[]>(
    `/api/tasks/${taskId}/blocking`
  );
  return data.map(transformTask);
}

export async function isTaskBlocked(taskId: string): Promise<{ isBlocked: boolean; blockingCount: number }> {
  const data = await apiCall<{ is_blocked: boolean; blocking_count: number }>(
    `/api/tasks/${taskId}/is-blocked`
  );
  return {
    isBlocked: data.is_blocked,
    blockingCount: data.blocking_count,
  };
}

// ============ Task Attachments API ============

export interface TaskAttachment {
  id: string;
  taskId: string;
  userId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  createdAt: string;
  downloadUrl?: string;
}

interface AttachmentApiResponse {
  id: string;
  task_id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
  download_url?: string;
}

function transformAttachment(api: AttachmentApiResponse): TaskAttachment {
  return {
    id: api.id,
    taskId: api.task_id,
    userId: api.user_id,
    fileName: api.file_name,
    fileType: api.file_type,
    fileSize: api.file_size,
    storagePath: api.storage_path,
    createdAt: api.created_at,
    downloadUrl: api.download_url,
  };
}

export async function fetchTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  const data = await apiCall<AttachmentApiResponse[]>(
    `/api/tasks/${taskId}/attachments`
  );
  return data.map(transformAttachment);
}

export async function createAttachment(
  taskId: string,
  userId: string,
  attachment: {
    fileName: string;
    fileType: string;
    fileSize: number;
    storagePath: string;
  }
): Promise<TaskAttachment> {
  const data = await apiCall<AttachmentApiResponse>(
    `/api/tasks/${taskId}/attachments?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({
        file_name: attachment.fileName,
        file_type: attachment.fileType,
        file_size: attachment.fileSize,
        storage_path: attachment.storagePath,
      }),
    }
  );
  return transformAttachment(data);
}

export async function deleteAttachment(
  taskId: string,
  attachmentId: string,
  userId: string
): Promise<{ storagePath: string }> {
  const data = await apiCall<{ status: string; id: string; storage_path: string }>(
    `/api/tasks/${taskId}/attachments/${attachmentId}?user_id=${userId}`,
    { method: "DELETE" }
  );
  return { storagePath: data.storage_path };
}

// Helper to format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ============ Custom Statuses API (ClickUp-style) ============

export interface Status {
  id: string;
  projectId: string;
  name: string;
  color: string;
  category: "open" | "in_progress" | "done" | "cancelled";
  position: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StatusApiResponse {
  id: string;
  project_id: string;
  name: string;
  color: string;
  category: string;
  position: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

function transformStatus(api: StatusApiResponse): Status {
  return {
    id: api.id,
    projectId: api.project_id,
    name: api.name,
    color: api.color,
    category: api.category as Status["category"],
    position: api.position,
    isDefault: api.is_default,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

export async function fetchProjectStatuses(projectId: string, userId?: string): Promise<Status[]> {
  const params = new URLSearchParams();
  if (userId) params.append("user_id", userId);
  const queryString = params.toString();
  const data = await apiCall<StatusApiResponse[]>(
    `/api/projects/${projectId}/statuses${queryString ? `?${queryString}` : ""}`
  );
  return data.map(transformStatus);
}

export async function createStatus(
  projectId: string,
  status: { name: string; color?: string; category?: string; isDefault?: boolean }
): Promise<Status> {
  const data = await apiCall<StatusApiResponse>(
    `/api/projects/${projectId}/statuses`,
    {
      method: "POST",
      body: JSON.stringify({
        name: status.name,
        color: status.color || "#6B7280",
        category: status.category || "in_progress",
        is_default: status.isDefault || false,
      }),
    }
  );
  return transformStatus(data);
}

export async function updateStatus(
  projectId: string,
  statusId: string,
  updates: { name?: string; color?: string; category?: string; position?: number; isDefault?: boolean }
): Promise<Status> {
  const data = await apiCall<StatusApiResponse>(
    `/api/projects/${projectId}/statuses/${statusId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        name: updates.name,
        color: updates.color,
        category: updates.category,
        position: updates.position,
        is_default: updates.isDefault,
      }),
    }
  );
  return transformStatus(data);
}

export async function deleteStatus(projectId: string, statusId: string): Promise<void> {
  await apiCall<void>(`/api/projects/${projectId}/statuses/${statusId}`, {
    method: "DELETE",
  });
}

export async function reorderStatuses(projectId: string, statusIds: string[]): Promise<void> {
  await apiCall<void>(`/api/projects/${projectId}/statuses/reorder`, {
    method: "POST",
    body: JSON.stringify({ status_ids: statusIds }),
  });
}

// ============ Time Tracking API ============

export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  entryType: "timer" | "manual";
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TimeEntryApiResponse {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  entry_type: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

function transformTimeEntry(api: TimeEntryApiResponse): TimeEntry {
  return {
    id: api.id,
    taskId: api.task_id,
    userId: api.user_id,
    startedAt: api.started_at,
    endedAt: api.ended_at,
    durationSeconds: api.duration_seconds,
    entryType: api.entry_type as TimeEntry["entryType"],
    description: api.description,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

export async function fetchTimeEntries(taskId: string): Promise<TimeEntry[]> {
  const data = await apiCall<TimeEntryApiResponse[]>(
    `/api/tasks/${taskId}/time-entries`
  );
  return data.map(transformTimeEntry);
}

export async function startTimer(
  taskId: string,
  userId: string,
  description?: string
): Promise<TimeEntry> {
  const data = await apiCall<TimeEntryApiResponse>(
    `/api/tasks/${taskId}/timer/start?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({ description }),
    }
  );
  return transformTimeEntry(data);
}

export async function stopTimer(taskId: string, userId: string): Promise<TimeEntry> {
  const data = await apiCall<TimeEntryApiResponse>(
    `/api/tasks/${taskId}/timer/stop?user_id=${userId}`,
    { method: "POST" }
  );
  return transformTimeEntry(data);
}

export async function getRunningTimer(userId: string): Promise<TimeEntry | null> {
  try {
    const data = await apiCall<TimeEntryApiResponse | null>(
      `/api/tasks/my-timer?user_id=${userId}`
    );
    return data ? transformTimeEntry(data) : null;
  } catch {
    return null;
  }
}

export async function createTimeEntry(
  taskId: string,
  userId: string,
  entry: {
    startedAt?: string;
    endedAt?: string;
    durationSeconds?: number;
    description?: string;
  }
): Promise<TimeEntry> {
  const data = await apiCall<TimeEntryApiResponse>(
    `/api/tasks/${taskId}/time-entries?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({
        started_at: entry.startedAt,
        ended_at: entry.endedAt,
        duration_seconds: entry.durationSeconds,
        description: entry.description,
      }),
    }
  );
  return transformTimeEntry(data);
}

export async function deleteTimeEntry(taskId: string, entryId: string): Promise<void> {
  await apiCall<void>(`/api/tasks/${taskId}/time-entries/${entryId}`, {
    method: "DELETE",
  });
}

export async function getTaskTotalTime(taskId: string): Promise<{
  totalSeconds: number;
  formatted: string;
}> {
  const data = await apiCall<{
    task_id: string;
    total_seconds: number;
    formatted: string;
  }>(`/api/tasks/${taskId}/total-time`);
  return {
    totalSeconds: data.total_seconds,
    formatted: data.formatted,
  };
}

// Helper to format duration
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

// ============ Checklists API ============

export interface ChecklistItem {
  id: string;
  taskId: string;
  content: string;
  isChecked: boolean;
  checkedAt: string | null;
  checkedBy: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

interface ChecklistItemApiResponse {
  id: string;
  task_id: string;
  content: string;
  is_checked: boolean;
  checked_at: string | null;
  checked_by: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

function transformChecklistItem(api: ChecklistItemApiResponse): ChecklistItem {
  return {
    id: api.id,
    taskId: api.task_id,
    content: api.content,
    isChecked: api.is_checked,
    checkedAt: api.checked_at,
    checkedBy: api.checked_by,
    position: api.position,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

export async function fetchChecklist(taskId: string): Promise<ChecklistItem[]> {
  const data = await apiCall<ChecklistItemApiResponse[]>(
    `/api/tasks/${taskId}/checklist`
  );
  return data.map(transformChecklistItem);
}

export async function createChecklistItem(
  taskId: string,
  userId: string,
  content: string
): Promise<ChecklistItem> {
  const data = await apiCall<ChecklistItemApiResponse>(
    `/api/tasks/${taskId}/checklist?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({ content }),
    }
  );
  return transformChecklistItem(data);
}

export async function updateChecklistItem(
  taskId: string,
  itemId: string,
  userId: string,
  updates: { content?: string; isChecked?: boolean; position?: number }
): Promise<ChecklistItem> {
  const data = await apiCall<ChecklistItemApiResponse>(
    `/api/tasks/${taskId}/checklist/${itemId}?user_id=${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        content: updates.content,
        is_checked: updates.isChecked,
        position: updates.position,
      }),
    }
  );
  return transformChecklistItem(data);
}

export async function toggleChecklistItem(
  taskId: string,
  itemId: string,
  userId: string
): Promise<ChecklistItem> {
  const data = await apiCall<ChecklistItemApiResponse>(
    `/api/tasks/${taskId}/checklist/${itemId}/toggle?user_id=${userId}`,
    { method: "POST" }
  );
  return transformChecklistItem(data);
}

export async function deleteChecklistItem(taskId: string, itemId: string): Promise<void> {
  await apiCall<void>(`/api/tasks/${taskId}/checklist/${itemId}`, {
    method: "DELETE",
  });
}

export async function reorderChecklist(taskId: string, itemIds: string[]): Promise<void> {
  await apiCall<void>(`/api/tasks/${taskId}/checklist/reorder`, {
    method: "POST",
    body: JSON.stringify({ item_ids: itemIds }),
  });
}

// ============ Activity API ============

export interface ActivityEntry {
  id: string;
  projectId: string | null;
  taskId: string | null;
  userId: string;
  eventType: string;
  eventData: Record<string, unknown>;
  createdAt: string;
}

interface ActivityApiResponse {
  id: string;
  project_id: string | null;
  task_id: string | null;
  user_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
}

function transformActivity(api: ActivityApiResponse): ActivityEntry {
  return {
    id: api.id,
    projectId: api.project_id,
    taskId: api.task_id,
    userId: api.user_id,
    eventType: api.event_type,
    eventData: api.event_data,
    createdAt: api.created_at,
  };
}

export async function fetchTaskActivity(
  taskId: string,
  limit: number = 50
): Promise<ActivityEntry[]> {
  const data = await apiCall<ActivityApiResponse[]>(
    `/api/tasks/${taskId}/activity?limit=${limit}`
  );
  return data.map(transformActivity);
}

export async function fetchProjectActivity(
  projectId: string,
  limit: number = 50
): Promise<ActivityEntry[]> {
  const data = await apiCall<ActivityApiResponse[]>(
    `/api/projects/${projectId}/activity?limit=${limit}`
  );
  return data.map(transformActivity);
}

// ============ Folders API (ClickUp-style hierarchy) ============

export interface Folder {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  position: number;
  listCount: number;
  taskCount: number;
  isCollapsed: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FolderApiResponse {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  position: number;
  list_count: number;
  task_count: number;
  is_collapsed: boolean;
  created_at: string;
  updated_at: string;
}

function transformFolder(api: FolderApiResponse): Folder {
  return {
    id: api.id,
    projectId: api.project_id,
    userId: api.user_id,
    name: api.name,
    description: api.description,
    color: api.color,
    icon: api.icon,
    position: api.position,
    listCount: api.list_count,
    taskCount: api.task_count,
    isCollapsed: api.is_collapsed,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

export async function fetchFolders(
  projectId: string,
  userId: string
): Promise<Folder[]> {
  const data = await apiCall<FolderApiResponse[]>(
    `/api/projects/${projectId}/folders?user_id=${userId}`
  );
  return data.map(transformFolder);
}

export async function fetchFolder(
  projectId: string,
  folderId: string
): Promise<Folder> {
  const data = await apiCall<FolderApiResponse>(
    `/api/projects/${projectId}/folders/${folderId}`
  );
  return transformFolder(data);
}

export async function createFolder(
  projectId: string,
  userId: string,
  folder: { name: string; description?: string; color?: string; icon?: string }
): Promise<Folder> {
  const data = await apiCall<FolderApiResponse>(
    `/api/projects/${projectId}/folders?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify(folder),
    }
  );
  return transformFolder(data);
}

export async function updateFolder(
  projectId: string,
  folderId: string,
  updates: { name?: string; description?: string; color?: string; icon?: string; isCollapsed?: boolean }
): Promise<Folder> {
  const data = await apiCall<FolderApiResponse>(
    `/api/projects/${projectId}/folders/${folderId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        name: updates.name,
        description: updates.description,
        color: updates.color,
        icon: updates.icon,
        is_collapsed: updates.isCollapsed,
      }),
    }
  );
  return transformFolder(data);
}

export async function deleteFolder(
  projectId: string,
  folderId: string,
  cascade: boolean = true
): Promise<void> {
  await apiCall<void>(
    `/api/projects/${projectId}/folders/${folderId}?cascade=${cascade}`,
    { method: "DELETE" }
  );
}

export async function reorderFolders(
  projectId: string,
  folderIds: string[]
): Promise<void> {
  const params = new URLSearchParams();
  folderIds.forEach(id => params.append("folder_ids", id));
  await apiCall<void>(
    `/api/projects/${projectId}/folders/reorder?${params.toString()}`,
    { method: "POST" }
  );
}

// ============ Lists API (ClickUp-style hierarchy) ============

export interface TaskList {
  id: string;
  projectId: string;
  folderId: string | null;
  userId: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  position: number;
  taskCount: number;
  completedCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ListApiResponse {
  id: string;
  project_id: string;
  folder_id: string | null;
  user_id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  position: number;
  task_count: number;
  completed_count: number;
  created_at: string;
  updated_at: string;
}

function transformList(api: ListApiResponse): TaskList {
  return {
    id: api.id,
    projectId: api.project_id,
    folderId: api.folder_id,
    userId: api.user_id,
    name: api.name,
    description: api.description,
    color: api.color,
    icon: api.icon,
    position: api.position,
    taskCount: api.task_count,
    completedCount: api.completed_count,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

export async function fetchLists(
  projectId: string,
  userId: string,
  folderId?: string | null
): Promise<TaskList[]> {
  const params = new URLSearchParams({ user_id: userId });
  if (folderId !== undefined) {
    params.append("folder_id", folderId === null ? "null" : folderId);
  }
  const data = await apiCall<ListApiResponse[]>(
    `/api/projects/${projectId}/lists?${params.toString()}`
  );
  return data.map(transformList);
}

export async function fetchFolderLists(
  projectId: string,
  folderId: string
): Promise<TaskList[]> {
  const data = await apiCall<ListApiResponse[]>(
    `/api/projects/${projectId}/folders/${folderId}/lists`
  );
  return data.map(transformList);
}

export async function fetchList(
  projectId: string,
  listId: string
): Promise<TaskList> {
  const data = await apiCall<ListApiResponse>(
    `/api/projects/${projectId}/lists/${listId}`
  );
  return transformList(data);
}

export async function createList(
  projectId: string,
  userId: string,
  list: { name: string; description?: string; color?: string; icon?: string; folderId?: string }
): Promise<TaskList> {
  const data = await apiCall<ListApiResponse>(
    `/api/projects/${projectId}/lists?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({
        name: list.name,
        description: list.description,
        color: list.color,
        icon: list.icon,
        folder_id: list.folderId,
      }),
    }
  );
  return transformList(data);
}

export async function updateList(
  projectId: string,
  listId: string,
  updates: { name?: string; description?: string; color?: string; icon?: string; folderId?: string }
): Promise<TaskList> {
  const data = await apiCall<ListApiResponse>(
    `/api/projects/${projectId}/lists/${listId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        name: updates.name,
        description: updates.description,
        color: updates.color,
        icon: updates.icon,
        folder_id: updates.folderId,
      }),
    }
  );
  return transformList(data);
}

export async function deleteList(
  projectId: string,
  listId: string,
  cascade: boolean = true
): Promise<void> {
  await apiCall<void>(
    `/api/projects/${projectId}/lists/${listId}?cascade=${cascade}`,
    { method: "DELETE" }
  );
}

export async function moveList(
  projectId: string,
  listId: string,
  folderId: string | null
): Promise<TaskList> {
  const params = folderId ? `?folder_id=${folderId}` : "?folder_id=null";
  const data = await apiCall<ListApiResponse>(
    `/api/projects/${projectId}/lists/${listId}/move${params}`,
    { method: "POST" }
  );
  return transformList(data);
}

export async function reorderLists(
  projectId: string,
  listIds: string[],
  folderId?: string | null
): Promise<void> {
  const params = new URLSearchParams();
  listIds.forEach(id => params.append("list_ids", id));
  if (folderId !== undefined) {
    params.append("folder_id", folderId === null ? "null" : folderId);
  }
  await apiCall<void>(
    `/api/projects/${projectId}/lists/reorder?${params.toString()}`,
    { method: "POST" }
  );
}

// ============ Bulk Operations API ============

export interface BulkOperationResult {
  status: string;
  updatedCount?: number;
  deletedCount?: number;
  movedCount?: number;
  clonedCount?: number;
  totalRequested: number;
  errors?: Array<{ taskId: string; error: string }>;
  clonedTasks?: Array<{ originalId: string; clonedId: string; title: string }>;
}

export async function bulkUpdateTasks(
  taskIds: string[],
  updates: Partial<{
    status: string;
    priority: string;
    due_at: string | null;
    assignees: string[];
    labels: string[];
    milestone_id: string | null;
  }>,
  userId: string
): Promise<BulkOperationResult> {
  const data = await apiCall<{
    status: string;
    updated_count: number;
    total_requested: number;
    errors?: Array<{ task_id: string; error: string }>;
  }>(`/api/tasks/bulk/update?user_id=${userId}`, {
    method: "POST",
    body: JSON.stringify({ task_ids: taskIds, updates }),
  });
  return {
    status: data.status,
    updatedCount: data.updated_count,
    totalRequested: data.total_requested,
    errors: data.errors?.map(e => ({ taskId: e.task_id, error: e.error })),
  };
}

export async function bulkDeleteTasks(
  taskIds: string[],
  userId: string,
  permanent: boolean = false
): Promise<BulkOperationResult> {
  const data = await apiCall<{
    status: string;
    deleted_count: number;
    total_requested: number;
    permanent: boolean;
    errors?: Array<{ task_id: string; error: string }>;
  }>(`/api/tasks/bulk/delete?user_id=${userId}`, {
    method: "POST",
    body: JSON.stringify({ task_ids: taskIds, permanent }),
  });
  return {
    status: data.status,
    deletedCount: data.deleted_count,
    totalRequested: data.total_requested,
    errors: data.errors?.map(e => ({ taskId: e.task_id, error: e.error })),
  };
}

export async function bulkMoveTasks(
  taskIds: string[],
  userId: string,
  options: {
    targetProjectId?: string;
    targetListId?: string;
    targetStatus?: string;
  }
): Promise<BulkOperationResult> {
  const data = await apiCall<{
    status: string;
    moved_count: number;
    total_requested: number;
    errors?: Array<{ task_id: string; error: string }>;
  }>(`/api/tasks/bulk/move?user_id=${userId}`, {
    method: "POST",
    body: JSON.stringify({
      task_ids: taskIds,
      target_project_id: options.targetProjectId,
      target_list_id: options.targetListId,
      target_status: options.targetStatus,
    }),
  });
  return {
    status: data.status,
    movedCount: data.moved_count,
    totalRequested: data.total_requested,
    errors: data.errors?.map(e => ({ taskId: e.task_id, error: e.error })),
  };
}

export async function bulkCloneTasks(
  taskIds: string[],
  userId: string,
  options: {
    includeSubtasks?: boolean;
    includeComments?: boolean;
    includeAttachments?: boolean;
    targetProjectId?: string;
  } = {}
): Promise<BulkOperationResult> {
  const data = await apiCall<{
    status: string;
    cloned_tasks: Array<{ original_id: string; cloned_id: string; title: string }>;
    cloned_count: number;
    total_requested: number;
    errors?: Array<{ task_id: string; error: string }>;
  }>(`/api/tasks/bulk/clone?user_id=${userId}`, {
    method: "POST",
    body: JSON.stringify({
      task_ids: taskIds,
      include_subtasks: options.includeSubtasks ?? true,
      include_comments: options.includeComments ?? false,
      include_attachments: options.includeAttachments ?? false,
      target_project_id: options.targetProjectId,
    }),
  });
  return {
    status: data.status,
    clonedCount: data.cloned_count,
    clonedTasks: data.cloned_tasks.map(t => ({
      originalId: t.original_id,
      clonedId: t.cloned_id,
      title: t.title,
    })),
    totalRequested: data.total_requested,
    errors: data.errors?.map(e => ({ taskId: e.task_id, error: e.error })),
  };
}

// ============ Import Tasks API ============

export interface ImportTaskItem {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  dueAt?: string;
  startAt?: string;
  assignees?: string[];
  labels?: string[];
  parentTitle?: string;
}

export interface ImportResult {
  status: string;
  importedCount: number;
  skippedCount: number;
  totalRequested: number;
  importedTasks: Array<{
    id: string;
    title: string;
    isSubtask: boolean;
    parentId?: string;
  }>;
  skipped?: Array<{ title: string; reason: string }>;
  errors?: Array<{ title: string; error: string }>;
}

export async function importTasks(
  projectId: string,
  tasks: ImportTaskItem[],
  userId: string,
  options: {
    listId?: string;
    skipDuplicates?: boolean;
  } = {}
): Promise<ImportResult> {
  const data = await apiCall<{
    status: string;
    imported_tasks: Array<{
      id: string;
      title: string;
      is_subtask: boolean;
      parent_id?: string;
    }>;
    imported_count: number;
    skipped_count: number;
    skipped?: Array<{ title: string; reason: string }>;
    total_requested: number;
    errors?: Array<{ title: string; error: string }>;
  }>(`/api/tasks/import?user_id=${userId}`, {
    method: "POST",
    body: JSON.stringify({
      project_id: projectId,
      list_id: options.listId,
      skip_duplicates: options.skipDuplicates ?? true,
      tasks: tasks.map(t => ({
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        due_at: t.dueAt,
        start_at: t.startAt,
        assignees: t.assignees,
        labels: t.labels,
        parent_title: t.parentTitle,
      })),
    }),
  });
  return {
    status: data.status,
    importedCount: data.imported_count,
    skippedCount: data.skipped_count,
    totalRequested: data.total_requested,
    importedTasks: data.imported_tasks.map(t => ({
      id: t.id,
      title: t.title,
      isSubtask: t.is_subtask,
      parentId: t.parent_id,
    })),
    skipped: data.skipped,
    errors: data.errors,
  };
}

/**
 * Parse CSV content into task items for import
 */
export function parseTasksCsv(csvContent: string): ImportTaskItem[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const tasks: ImportTaskItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const task: ImportTaskItem = { title: "" };

    headers.forEach((header, idx) => {
      const value = values[idx];
      if (!value) return;

      switch (header) {
        case "title":
        case "name":
        case "task":
          task.title = value;
          break;
        case "description":
        case "details":
          task.description = value;
          break;
        case "status":
          task.status = value.toLowerCase();
          break;
        case "priority":
          task.priority = value.toLowerCase();
          break;
        case "due":
        case "due_date":
        case "duedate":
        case "due_at":
          task.dueAt = value;
          break;
        case "start":
        case "start_date":
        case "startdate":
        case "start_at":
          task.startAt = value;
          break;
        case "parent":
        case "parent_task":
        case "parent_title":
          task.parentTitle = value;
          break;
      }
    });

    if (task.title) {
      tasks.push(task);
    }
  }

  return tasks;
}

// =============================================================================
// Estimates
// =============================================================================

export async function fetchEstimates(projectId: string, userId: string): Promise<any[]> {
  return apiCall<any[]>(`/api/projects/${projectId}/estimates?user_id=${userId}`);
}

export async function createEstimate(
  projectId: string,
  userId: string,
  data: { name: string; description?: string },
): Promise<any> {
  return apiCall<any>(`/api/projects/${projectId}/estimates?user_id=${userId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteEstimate(projectId: string, userId: string, estimateId: string): Promise<void> {
  await apiCall<void>(`/api/projects/${projectId}/estimates/${estimateId}?user_id=${userId}`, {
    method: "DELETE",
  });
}

// =============================================================================
// Issue Relations
// =============================================================================

export async function fetchIssueRelations(projectId: string, taskId: string, userId: string): Promise<any[]> {
  return apiCall<any[]>(`/api/projects/${projectId}/tasks/${taskId}/relations?user_id=${userId}`);
}

export async function createRelation(
  projectId: string,
  taskId: string,
  userId: string,
  data: { related_issue_id: string; relation_type: string },
): Promise<any> {
  return apiCall<any>(`/api/projects/${projectId}/tasks/${taskId}/relations?user_id=${userId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteRelation(
  projectId: string,
  taskId: string,
  relationId: string,
  userId: string,
): Promise<void> {
  await apiCall<void>(
    `/api/projects/${projectId}/tasks/${taskId}/relations/${relationId}?user_id=${userId}`,
    { method: "DELETE" },
  );
}

// =============================================================================
// Views (Saved Filters)
// =============================================================================

export async function fetchViews(projectId: string, userId: string): Promise<any[]> {
  return apiCall<any[]>(`/api/projects/${projectId}/views?user_id=${userId}`);
}

export async function createView(
  projectId: string,
  userId: string,
  data: {
    name: string;
    description?: string;
    filters?: Record<string, unknown>;
    query_data?: Record<string, unknown>;
    view_type?: "list" | "board" | "calendar" | "workload" | "gantt" | "timeline";
  },
): Promise<any> {
  return apiCall<any>(`/api/projects/${projectId}/views?user_id=${userId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateView(
  projectId: string,
  viewId: string,
  userId: string,
  data: {
    name?: string;
    description?: string;
    filters?: Record<string, unknown>;
    query_data?: Record<string, unknown>;
    view_type?: "list" | "board" | "calendar" | "workload" | "gantt" | "timeline";
  },
): Promise<any> {
  return apiCall<any>(`/api/projects/${projectId}/views/${viewId}?user_id=${userId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteView(projectId: string, viewId: string, userId: string): Promise<void> {
  await apiCall<void>(`/api/projects/${projectId}/views/${viewId}?user_id=${userId}`, {
    method: "DELETE",
  });
}

// =============================================================================
// Pages (Documents)
// =============================================================================

export async function fetchPages(projectId: string, userId: string): Promise<any[]> {
  return apiCall<any[]>(`/api/projects/${projectId}/pages?user_id=${userId}`);
}

export async function createPage(
  projectId: string,
  userId: string,
  data: { name: string; description?: string; description_html?: string },
): Promise<any> {
  return apiCall<any>(`/api/projects/${projectId}/pages?user_id=${userId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePage(
  projectId: string,
  pageId: string,
  userId: string,
  data: { name?: string; description?: string; description_html?: string },
): Promise<any> {
  return apiCall<any>(`/api/projects/${projectId}/pages/${pageId}?user_id=${userId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deletePage(projectId: string, pageId: string, userId: string): Promise<void> {
  await apiCall<void>(`/api/projects/${projectId}/pages/${pageId}?user_id=${userId}`, {
    method: "DELETE",
  });
}

// =============================================================================
// Analytics
// =============================================================================

export async function fetchAnalytics(
  projectId: string,
  userId: string,
  xAxis: string = "state__group",
  yAxis: string = "issue_count",
): Promise<any> {
  return apiCall<any>(
    `/api/projects/${projectId}/analytics?user_id=${userId}&x_axis=${xAxis}&y_axis=${yAxis}`,
  );
}

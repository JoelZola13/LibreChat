/**
 * Advanced Tasks API - Templates, Custom Fields, Filters, Milestones, etc.
 */

const API_BASE = "/sbapi";

async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  // Handle empty responses
  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}

// ============================================================
// Task Templates
// ============================================================

export interface TaskTemplate {
  id: string;
  userId: string;
  projectId?: string;
  name: string;
  description?: string;
  templateData: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    labels?: string[];
    assignees?: string[];
    checklist?: { content: string; isChecked: boolean }[];
    subtasks?: { title: string; status?: string }[];
    estimatedTime?: number;
    recurrenceRule?: string;
  };
  category?: string;
  isGlobal: boolean;
  useCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskTemplateCreateData {
  name: string;
  description?: string;
  templateData: TaskTemplate["templateData"];
  category?: string;
  isGlobal?: boolean;
  projectId?: string;
}

export async function fetchTemplates(
  userId: string,
  projectId?: string,
  includeGlobal: boolean = true
): Promise<TaskTemplate[]> {
  const params = new URLSearchParams({ user_id: userId });
  if (projectId) params.append("project_id", projectId);
  if (!includeGlobal) params.append("include_global", "false");

  const data = await apiCall<{ templates: any[] }>(
    `/tasks/advanced/templates?${params}`
  );
  return data.templates.map(mapTemplate);
}

export async function createTemplate(
  userId: string,
  data: TaskTemplateCreateData
): Promise<TaskTemplate> {
  const result = await apiCall<any>(
    `/tasks/advanced/templates?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        description: data.description,
        template_data: data.templateData,
        category: data.category,
        is_global: data.isGlobal || false,
        project_id: data.projectId,
      }),
    }
  );
  return mapTemplate(result);
}

export async function updateTemplate(
  templateId: string,
  data: Partial<TaskTemplateCreateData>
): Promise<TaskTemplate> {
  const result = await apiCall<any>(`/tasks/advanced/templates/${templateId}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      template_data: data.templateData,
      category: data.category,
      is_global: data.isGlobal,
      project_id: data.projectId,
    }),
  });
  return mapTemplate(result);
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await apiCall(`/tasks/advanced/templates/${templateId}`, { method: "DELETE" });
}

export async function useTemplate(templateId: string): Promise<void> {
  await apiCall(`/tasks/advanced/templates/${templateId}/use`, { method: "POST" });
}

function mapTemplate(data: any): TaskTemplate {
  return {
    id: data.id,
    userId: data.user_id,
    projectId: data.project_id,
    name: data.name,
    description: data.description,
    templateData: data.template_data,
    category: data.category,
    isGlobal: data.is_global,
    useCount: data.use_count,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ============================================================
// Custom Fields
// ============================================================

export interface CustomField {
  id: string;
  projectId: string;
  name: string;
  fieldType: "text" | "number" | "date" | "checkbox" | "select" | "multiselect" | "url" | "email" | "currency" | "percent" | "rating" | "progress";
  config: {
    options?: { value: string; label: string; color?: string }[];
    min?: number;
    max?: number;
    precision?: number;
    currency?: string;
    maxRating?: number;
  };
  position: number;
  width: "small" | "medium" | "large";
  isRequired: boolean;
  isVisible: boolean;
  defaultValue?: any;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldCreateData {
  name: string;
  fieldType: CustomField["fieldType"];
  config?: CustomField["config"];
  position?: number;
  width?: CustomField["width"];
  isRequired?: boolean;
  isVisible?: boolean;
  defaultValue?: any;
}

export async function fetchCustomFields(projectId: string): Promise<CustomField[]> {
  const data = await apiCall<{ fields: any[] }>(
    `/tasks/advanced/projects/${projectId}/custom-fields`
  );
  return data.fields.map(mapCustomField);
}

export async function createCustomField(
  projectId: string,
  data: CustomFieldCreateData
): Promise<CustomField> {
  const result = await apiCall<any>(
    `/tasks/advanced/projects/${projectId}/custom-fields`,
    {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        field_type: data.fieldType,
        config: data.config || {},
        position: data.position || 0,
        width: data.width || "medium",
        is_required: data.isRequired || false,
        is_visible: data.isVisible !== false,
        default_value: data.defaultValue,
      }),
    }
  );
  return mapCustomField(result);
}

export async function updateCustomField(
  fieldId: string,
  data: Partial<CustomFieldCreateData>
): Promise<CustomField> {
  const result = await apiCall<any>(`/tasks/advanced/custom-fields/${fieldId}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: data.name,
      field_type: data.fieldType,
      config: data.config,
      position: data.position,
      width: data.width,
      is_required: data.isRequired,
      is_visible: data.isVisible,
      default_value: data.defaultValue,
    }),
  });
  return mapCustomField(result);
}

export async function deleteCustomField(fieldId: string): Promise<void> {
  await apiCall(`/tasks/advanced/custom-fields/${fieldId}`, { method: "DELETE" });
}

export async function getTaskFieldValues(taskId: string): Promise<Record<string, any>> {
  const data = await apiCall<{ values: Record<string, any> }>(
    `/tasks/advanced/tasks/${taskId}/field-values`
  );
  return data.values;
}

export async function setTaskFieldValue(
  taskId: string,
  fieldId: string,
  value: any
): Promise<void> {
  await apiCall(`/tasks/advanced/tasks/${taskId}/field-values/${fieldId}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}

function mapCustomField(data: any): CustomField {
  return {
    id: data.id,
    projectId: data.project_id,
    name: data.name,
    fieldType: data.field_type,
    config: data.config,
    position: data.position,
    width: data.width,
    isRequired: data.is_required,
    isVisible: data.is_visible,
    defaultValue: data.default_value,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ============================================================
// Saved Filters
// ============================================================

export interface SavedFilter {
  id: string;
  userId: string;
  projectId?: string;
  name: string;
  description?: string;
  icon?: string;
  color: string;
  filters: {
    status?: string[];
    priority?: string[];
    assignees?: string[];
    labels?: string[];
    dueDate?: { type: "overdue" | "today" | "this_week" | "range"; start?: string; end?: string };
    search?: string;
  };
  sortBy: string;
  sortOrder: "asc" | "desc";
  viewType: "list" | "board" | "calendar" | "timeline";
  groupBy?: string;
  position: number;
  isDefault: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavedFilterCreateData {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  filters: SavedFilter["filters"];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  viewType?: SavedFilter["viewType"];
  groupBy?: string;
  position?: number;
  isDefault?: boolean;
  isPinned?: boolean;
  projectId?: string;
}

export async function fetchSavedFilters(
  userId: string,
  projectId?: string
): Promise<SavedFilter[]> {
  const params = new URLSearchParams({ user_id: userId });
  if (projectId) params.append("project_id", projectId);

  const data = await apiCall<{ filters: any[] }>(
    `/tasks/advanced/filters?${params}`
  );
  return data.filters.map(mapSavedFilter);
}

export async function createSavedFilter(
  userId: string,
  data: SavedFilterCreateData
): Promise<SavedFilter> {
  const result = await apiCall<any>(`/tasks/advanced/filters?user_id=${userId}`, {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      icon: data.icon,
      color: data.color || "#6366F1",
      filters: data.filters,
      sort_by: data.sortBy || "position",
      sort_order: data.sortOrder || "asc",
      view_type: data.viewType || "list",
      group_by: data.groupBy,
      position: data.position || 0,
      is_default: data.isDefault || false,
      is_pinned: data.isPinned || false,
      project_id: data.projectId,
    }),
  });
  return mapSavedFilter(result);
}

export async function updateSavedFilter(
  filterId: string,
  data: Partial<SavedFilterCreateData>
): Promise<SavedFilter> {
  const result = await apiCall<any>(`/tasks/advanced/filters/${filterId}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      icon: data.icon,
      color: data.color,
      filters: data.filters,
      sort_by: data.sortBy,
      sort_order: data.sortOrder,
      view_type: data.viewType,
      group_by: data.groupBy,
      position: data.position,
      is_default: data.isDefault,
      is_pinned: data.isPinned,
    }),
  });
  return mapSavedFilter(result);
}

export async function deleteSavedFilter(filterId: string): Promise<void> {
  await apiCall(`/tasks/advanced/filters/${filterId}`, { method: "DELETE" });
}

function mapSavedFilter(data: any): SavedFilter {
  return {
    id: data.id,
    userId: data.user_id,
    projectId: data.project_id,
    name: data.name,
    description: data.description,
    icon: data.icon,
    color: data.color,
    filters: data.filters,
    sortBy: data.sort_by,
    sortOrder: data.sort_order,
    viewType: data.view_type,
    groupBy: data.group_by,
    position: data.position,
    isDefault: data.is_default,
    isPinned: data.is_pinned,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ============================================================
// Milestones
// ============================================================

export interface Milestone {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  status: "open" | "in_progress" | "completed" | "cancelled";
  progressMode: "auto" | "manual";
  manualProgress: number;
  progress: number;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface MilestoneCreateData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  startDate?: string;
  dueDate?: string;
  status?: Milestone["status"];
  progressMode?: "auto" | "manual";
  manualProgress?: number;
  position?: number;
}

export async function fetchMilestones(
  projectId: string,
  includeCompleted: boolean = true
): Promise<Milestone[]> {
  const params = new URLSearchParams();
  if (!includeCompleted) params.append("include_completed", "false");

  const data = await apiCall<{ milestones: any[] }>(
    `/tasks/advanced/projects/${projectId}/milestones?${params}`
  );
  return data.milestones.map(mapMilestone);
}

export async function createMilestone(
  projectId: string,
  userId: string,
  data: MilestoneCreateData
): Promise<Milestone> {
  const result = await apiCall<any>(
    `/tasks/advanced/projects/${projectId}/milestones?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        description: data.description,
        color: data.color || "#6366F1",
        icon: data.icon,
        start_date: data.startDate,
        due_date: data.dueDate,
        status: data.status || "open",
        progress_mode: data.progressMode || "auto",
        manual_progress: data.manualProgress || 0,
        position: data.position || 0,
      }),
    }
  );
  return mapMilestone(result);
}

export async function updateMilestone(
  milestoneId: string,
  data: Partial<MilestoneCreateData>
): Promise<Milestone> {
  const result = await apiCall<any>(`/tasks/advanced/milestones/${milestoneId}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
      start_date: data.startDate,
      due_date: data.dueDate,
      status: data.status,
      progress_mode: data.progressMode,
      manual_progress: data.manualProgress,
      position: data.position,
    }),
  });
  return mapMilestone(result);
}

export async function deleteMilestone(milestoneId: string): Promise<void> {
  await apiCall(`/tasks/advanced/milestones/${milestoneId}`, { method: "DELETE" });
}

function mapMilestone(data: any): Milestone {
  return {
    id: data.id,
    projectId: data.project_id,
    userId: data.user_id,
    name: data.name,
    description: data.description,
    color: data.color,
    icon: data.icon,
    startDate: data.start_date,
    dueDate: data.due_date,
    completedAt: data.completed_at,
    status: data.status,
    progressMode: data.progress_mode,
    manualProgress: data.manual_progress,
    progress: data.progress || 0,
    position: data.position,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ============================================================
// Task History
// ============================================================

export interface TaskHistoryEntry {
  id: string;
  taskId: string;
  userId: string;
  changeType: string;
  previousValue?: Record<string, any>;
  newValue?: Record<string, any>;
  changedFields: string[];
  changeNote?: string;
  createdAt: string;
}

export async function fetchTaskHistory(
  taskId: string,
  limit: number = 50
): Promise<TaskHistoryEntry[]> {
  const data = await apiCall<{ history: any[] }>(
    `/tasks/advanced/tasks/${taskId}/history?limit=${limit}`
  );
  return data.history.map(mapHistoryEntry);
}

function mapHistoryEntry(data: any): TaskHistoryEntry {
  return {
    id: data.id,
    taskId: data.task_id,
    userId: data.user_id,
    changeType: data.change_type,
    previousValue: data.previous_value,
    newValue: data.new_value,
    changedFields: data.changed_fields || [],
    changeNote: data.change_note,
    createdAt: data.created_at,
  };
}

// ============================================================
// Automation Rules
// ============================================================

export interface AutomationRule {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  description?: string;
  triggerType: string;
  conditions: { field: string; operator: string; value: any }[];
  actions: { type: string; value: any }[];
  isEnabled: boolean;
  lastTriggeredAt?: string;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRuleCreateData {
  name: string;
  description?: string;
  triggerType: string;
  conditions?: AutomationRule["conditions"];
  actions: AutomationRule["actions"];
  isEnabled?: boolean;
}

export async function fetchAutomationRules(
  projectId: string,
  enabledOnly: boolean = false
): Promise<AutomationRule[]> {
  const params = new URLSearchParams();
  if (enabledOnly) params.append("enabled_only", "true");

  const data = await apiCall<{ rules: any[] }>(
    `/tasks/advanced/projects/${projectId}/automation-rules?${params}`
  );
  return data.rules.map(mapAutomationRule);
}

export async function createAutomationRule(
  projectId: string,
  userId: string,
  data: AutomationRuleCreateData
): Promise<AutomationRule> {
  const result = await apiCall<any>(
    `/tasks/advanced/projects/${projectId}/automation-rules?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        description: data.description,
        trigger_type: data.triggerType,
        conditions: data.conditions || [],
        actions: data.actions,
        is_enabled: data.isEnabled !== false,
      }),
    }
  );
  return mapAutomationRule(result);
}

export async function updateAutomationRule(
  ruleId: string,
  data: Partial<AutomationRuleCreateData>
): Promise<AutomationRule> {
  const result = await apiCall<any>(`/tasks/advanced/automation-rules/${ruleId}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      trigger_type: data.triggerType,
      conditions: data.conditions,
      actions: data.actions,
      is_enabled: data.isEnabled,
    }),
  });
  return mapAutomationRule(result);
}

export async function deleteAutomationRule(ruleId: string): Promise<void> {
  await apiCall(`/tasks/advanced/automation-rules/${ruleId}`, { method: "DELETE" });
}

function mapAutomationRule(data: any): AutomationRule {
  return {
    id: data.id,
    projectId: data.project_id,
    userId: data.user_id,
    name: data.name,
    description: data.description,
    triggerType: data.trigger_type,
    conditions: data.conditions || [],
    actions: data.actions || [],
    isEnabled: data.is_enabled,
    lastTriggeredAt: data.last_triggered_at,
    triggerCount: data.trigger_count || 0,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ============================================================
// Trash / Soft Delete
// ============================================================

export async function trashTask(taskId: string, userId: string): Promise<void> {
  await apiCall(`/tasks/advanced/tasks/${taskId}/trash?user_id=${userId}`, {
    method: "POST",
  });
}

export async function restoreTask(taskId: string): Promise<void> {
  await apiCall(`/tasks/advanced/tasks/${taskId}/restore`, { method: "POST" });
}

export async function fetchTrash(
  userId: string,
  projectId?: string
): Promise<any[]> {
  const params = new URLSearchParams({ user_id: userId });
  if (projectId) params.append("project_id", projectId);

  const data = await apiCall<{ tasks: any[] }>(`/tasks/advanced/trash?${params}`);
  return data.tasks;
}

export async function emptyTrash(
  userId: string,
  projectId?: string
): Promise<number> {
  const params = new URLSearchParams({ user_id: userId });
  if (projectId) params.append("project_id", projectId);

  const data = await apiCall<{ deleted_count: number }>(
    `/tasks/advanced/trash?${params}`,
    { method: "DELETE" }
  );
  return data.deleted_count;
}

// ============================================================
// Time Reports
// ============================================================

export interface TimeReport {
  totalSeconds: number;
  totalHours: number;
  entryCount: number;
  entries: any[];
  grouped: Record<string, number>;
}

export async function fetchTimeReport(
  userId: string,
  options: {
    projectId?: string;
    startDate?: string;
    endDate?: string;
    groupBy?: "day" | "week" | "task" | "user";
  } = {}
): Promise<TimeReport> {
  const params = new URLSearchParams({ user_id: userId });
  if (options.projectId) params.append("project_id", options.projectId);
  if (options.startDate) params.append("start_date", options.startDate);
  if (options.endDate) params.append("end_date", options.endDate);
  if (options.groupBy) params.append("group_by", options.groupBy);

  const data = await apiCall<any>(`/tasks/advanced/time-reports?${params}`);
  return {
    totalSeconds: data.total_seconds ?? 0,
    totalHours: data.total_hours ?? 0,
    entryCount: data.entry_count ?? 0,
    entries: data.entries ?? [],
    grouped: data.grouped ?? {},
  };
}

// ============================================================
// Export
// ============================================================

export async function exportTasksCsv(
  projectId: string,
  includeSubtasks: boolean = true
): Promise<string> {
  const params = new URLSearchParams();
  if (!includeSubtasks) params.append("include_subtasks", "false");

  const response = await fetch(
    `${API_BASE}/tasks/advanced/projects/${projectId}/export/csv?${params}`
  );
  return response.text();
}

export async function exportTasksJson(
  projectId: string,
  includeSubtasks: boolean = true
): Promise<any[]> {
  const params = new URLSearchParams();
  if (!includeSubtasks) params.append("include_subtasks", "false");

  const data = await apiCall<{ tasks: any[] }>(
    `/tasks/advanced/projects/${projectId}/export/json?${params}`
  );
  return data.tasks;
}

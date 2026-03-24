/**
 * Modules API - Feature Groupings
 */

const API_BASE = '/sbapi';

// Types
export interface Module {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  status: 'backlog' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
  is_archived: boolean;
  start_date: string | null;
  target_date: string | null;
  lead_id: string | null;
  member_ids: string[];
  labels: string[];
  total_tasks: number;
  completed_tasks: number;
  created_at: string;
  updated_at: string;
  progress: number;
}

export interface ModuleCreate {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  start_date?: string;
  target_date?: string;
  lead_id?: string;
  labels?: string[];
}

export interface ModuleUpdate {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  status?: string;
  start_date?: string;
  target_date?: string;
  lead_id?: string;
  labels?: string[];
  is_archived?: boolean;
}

// API Functions

export async function getModules(
  projectId: string,
  options: { includeArchived?: boolean; status?: string } = {}
): Promise<Module[]> {
  const params = new URLSearchParams();
  if (options.includeArchived) params.append('include_archived', 'true');
  if (options.status) params.append('status', options.status);

  const res = await fetch(
    `${API_BASE}/projects/${projectId}/modules?${params}`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch modules');
  return res.json();
}

export async function getModule(projectId: string, moduleId: string): Promise<Module> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/modules/${moduleId}`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch module');
  return res.json();
}

export async function createModule(
  projectId: string,
  data: ModuleCreate,
  userId: string
): Promise<Module> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/modules?user_id=${userId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error('Failed to create module');
  return res.json();
}

export async function updateModule(
  projectId: string,
  moduleId: string,
  data: ModuleUpdate
): Promise<Module> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/modules/${moduleId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error('Failed to update module');
  return res.json();
}

export async function deleteModule(projectId: string, moduleId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/modules/${moduleId}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error('Failed to delete module');
}

export async function archiveModule(projectId: string, moduleId: string): Promise<Module> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/modules/${moduleId}/archive`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error('Failed to archive module');
  return res.json();
}

export async function unarchiveModule(projectId: string, moduleId: string): Promise<Module> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/modules/${moduleId}/unarchive`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error('Failed to unarchive module');
  return res.json();
}

export async function addTasksToModule(
  projectId: string,
  moduleId: string,
  taskIds: string[],
  userId: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/modules/${moduleId}/tasks?user_id=${userId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_ids: taskIds }),
    }
  );
  if (!res.ok) throw new Error('Failed to add tasks to module');
}

export async function removeTaskFromModule(
  projectId: string,
  moduleId: string,
  taskId: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/modules/${moduleId}/tasks/${taskId}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error('Failed to remove task from module');
}


// =============================================================================
// Epics API
// =============================================================================

export interface Epic {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  status: 'open' | 'in_progress' | 'done' | 'cancelled';
  start_date: string | null;
  target_date: string | null;
  completed_at: string | null;
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  owner_id: string | null;
  labels: string[];
  parent_epic_id: string | null;
  total_children: number;
  completed_children: number;
  total_story_points: number;
  completed_story_points: number;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface EpicCreate {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  start_date?: string;
  target_date?: string;
  priority?: string;
  owner_id?: string;
  labels?: string[];
  parent_epic_id?: string;
}

export interface EpicUpdate {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  status?: string;
  start_date?: string;
  target_date?: string;
  priority?: string;
  owner_id?: string;
  labels?: string[];
  parent_epic_id?: string;
}

export async function getEpics(
  projectId: string,
  options: { status?: string; parent_epic_id?: string } = {}
): Promise<Epic[]> {
  const params = new URLSearchParams();
  if (options.status) params.append('status', options.status);
  if (options.parent_epic_id) params.append('parent_epic_id', options.parent_epic_id);

  const res = await fetch(
    `${API_BASE}/projects/${projectId}/epics?${params}`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch epics');
  return res.json();
}

export async function getEpic(projectId: string, epicId: string): Promise<Epic> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/epics/${epicId}`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch epic');
  return res.json();
}

export async function getEpicChildren(
  projectId: string,
  epicId: string
): Promise<{ children: unknown[] }> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/epics/${epicId}/children`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch epic children');
  return res.json();
}

export async function createEpic(
  projectId: string,
  data: EpicCreate,
  userId: string
): Promise<Epic> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/epics?user_id=${userId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error('Failed to create epic');
  return res.json();
}

export async function updateEpic(
  projectId: string,
  epicId: string,
  data: EpicUpdate
): Promise<Epic> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/epics/${epicId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error('Failed to update epic');
  return res.json();
}

export async function deleteEpic(projectId: string, epicId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/epics/${epicId}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error('Failed to delete epic');
}

export async function addTasksToEpic(
  projectId: string,
  epicId: string,
  taskIds: string[]
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/epics/${epicId}/tasks`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_ids: taskIds }),
    }
  );
  if (!res.ok) throw new Error('Failed to add tasks to epic');
}

export async function removeTaskFromEpic(
  projectId: string,
  epicId: string,
  taskId: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/epics/${epicId}/tasks/${taskId}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error('Failed to remove task from epic');
}


// =============================================================================
// Work Item Types API
// =============================================================================

export interface WorkItemType {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string;
  hierarchy_level: number;
  is_default: boolean;
  is_enabled: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface WorkItemTypeCreate {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  hierarchy_level?: number;
  is_default?: boolean;
}

export interface WorkItemTypeUpdate {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  hierarchy_level?: number;
  is_default?: boolean;
  is_enabled?: boolean;
  position?: number;
}

export async function getWorkItemTypes(projectId: string): Promise<WorkItemType[]> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/work-item-types`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch work item types');
  return res.json();
}

export async function createWorkItemType(
  projectId: string,
  data: WorkItemTypeCreate
): Promise<WorkItemType> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/work-item-types`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error('Failed to create work item type');
  return res.json();
}

export async function updateWorkItemType(
  projectId: string,
  typeId: string,
  data: WorkItemTypeUpdate
): Promise<WorkItemType> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/work-item-types/${typeId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error('Failed to update work item type');
  return res.json();
}

export async function deleteWorkItemType(projectId: string, typeId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/work-item-types/${typeId}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error('Failed to delete work item type');
}

export async function setDefaultWorkItemType(
  projectId: string,
  typeId: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/work-item-types/${typeId}/set-default`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error('Failed to set default work item type');
}


// =============================================================================
// State Groups API
// =============================================================================

export interface StateGroup {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  color: string;
  group_type: 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';
  position: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface StateGroupCreate {
  name: string;
  description?: string;
  color?: string;
  group_type: string;
}

export interface StateGroupUpdate {
  name?: string;
  description?: string;
  color?: string;
  position?: number;
}

export async function getStateGroups(projectId: string): Promise<StateGroup[]> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/state-groups`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch state groups');
  return res.json();
}

export async function createStateGroup(
  projectId: string,
  data: StateGroupCreate
): Promise<StateGroup> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/state-groups`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error('Failed to create state group');
  return res.json();
}

export async function updateStateGroup(
  projectId: string,
  groupId: string,
  data: StateGroupUpdate
): Promise<StateGroup> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/state-groups/${groupId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error('Failed to update state group');
  return res.json();
}

export async function deleteStateGroup(projectId: string, groupId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/state-groups/${groupId}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error('Failed to delete state group');
}

export async function assignStatusToGroup(
  projectId: string,
  statusId: string,
  groupId: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/statuses/${statusId}/assign-group`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId }),
    }
  );
  if (!res.ok) throw new Error('Failed to assign status to group');
}

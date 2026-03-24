/**
 * Cycles API - Sprint/Iteration Management
 */

const API_BASE = '/sbapi';

// Types
export interface Cycle {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  is_archived: boolean;
  total_tasks: number;
  completed_tasks: number;
  total_points: number;
  completed_points: number;
  burndown_data: BurndownPoint[];
  created_at: string;
  updated_at: string;
  progress: number;
}

export interface BurndownPoint {
  date: string;
  remaining_tasks: number;
  remaining_points: number;
  ideal_remaining: number;
}

export interface VelocityData {
  cycle_id: string;
  cycle_name: string;
  completed_points: number;
  completed_tasks: number;
  duration_days: number;
  velocity: number;
}

export interface CycleCreate {
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  status?: string;
}

export interface CycleUpdate {
  name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  is_archived?: boolean;
}

// API Functions

export async function getCycles(
  projectId: string,
  options: { includeArchived?: boolean; status?: string } = {}
): Promise<Cycle[]> {
  const params = new URLSearchParams();
  if (options.includeArchived) params.append('include_archived', 'true');
  if (options.status) params.append('status', options.status);

  const res = await fetch(
    `${API_BASE}/projects/${projectId}/cycles?${params}`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch cycles');
  return res.json();
}

export async function getCycle(projectId: string, cycleId: string): Promise<Cycle> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/cycles/${cycleId}`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch cycle');
  return res.json();
}

export async function getActiveCycle(projectId: string): Promise<Cycle | null> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/cycles/active`,
    { cache: 'no-store' }
  );
  if (!res.ok) return null;
  return res.json();
}

export async function createCycle(
  projectId: string,
  data: CycleCreate,
  userId: string
): Promise<Cycle> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/cycles?user_id=${userId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error('Failed to create cycle');
  return res.json();
}

export async function updateCycle(
  projectId: string,
  cycleId: string,
  data: CycleUpdate
): Promise<Cycle> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/cycles/${cycleId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error('Failed to update cycle');
  return res.json();
}

export async function deleteCycle(projectId: string, cycleId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/cycles/${cycleId}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error('Failed to delete cycle');
}

export async function archiveCycle(projectId: string, cycleId: string): Promise<Cycle> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/cycles/${cycleId}/archive`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error('Failed to archive cycle');
  return res.json();
}

export async function unarchiveCycle(projectId: string, cycleId: string): Promise<Cycle> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/cycles/${cycleId}/unarchive`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error('Failed to unarchive cycle');
  return res.json();
}

export async function addTasksToCycle(
  projectId: string,
  cycleId: string,
  taskIds: string[],
  userId: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/cycles/${cycleId}/tasks?user_id=${userId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_ids: taskIds }),
    }
  );
  if (!res.ok) throw new Error('Failed to add tasks to cycle');
}

export async function removeTaskFromCycle(
  projectId: string,
  cycleId: string,
  taskId: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/cycles/${cycleId}/tasks/${taskId}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error('Failed to remove task from cycle');
}

export async function transferTasks(
  projectId: string,
  fromCycleId: string,
  toCycleId: string,
  taskIds: string[],
  userId: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/cycles/transfer?user_id=${userId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_ids: taskIds,
        from_cycle_id: fromCycleId,
        to_cycle_id: toCycleId,
      }),
    }
  );
  if (!res.ok) throw new Error('Failed to transfer tasks');
}

export async function getCycleBurndown(
  projectId: string,
  cycleId: string
): Promise<{ burndown: BurndownPoint[] }> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/cycles/${cycleId}/burndown`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch burndown data');
  return res.json();
}

export async function getVelocity(
  projectId: string,
  cycleCount: number = 5
): Promise<{ velocity: VelocityData[]; average_velocity: number }> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/cycles/velocity?cycle_count=${cycleCount}`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch velocity data');
  return res.json();
}

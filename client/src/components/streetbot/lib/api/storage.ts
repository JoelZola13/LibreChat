/**
 * Storage API service - connects frontend to backend storage management
 * Internal admin app for tracking and managing storage including Supabase Storage
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/sbapi';

// ============================================================================
// Types matching the backend API responses (snake_case from API)
// ============================================================================

export interface SupabasePlanUsage {
  plan_name: string;
  storage_used_bytes: number;
  storage_used_formatted: string;
  storage_limit_bytes: number;
  storage_limit_formatted: string;
  storage_percent: number;
  storage_exceeded: boolean;
  database_limit_bytes: number;
  database_limit_formatted: string;
  bandwidth_limit_bytes: number;
  bandwidth_limit_formatted: string;
  is_over_quota: boolean;
  grace_period_end?: string;
  warning_message?: string;
}

export interface StorageOverview {
  total_buckets: number;
  total_size_bytes: number;
  total_size_formatted: string;
  total_objects: number;
  trash_size_bytes: number;
  trash_count: number;
  orphan_count: number;
  pending_jobs: number;
  growth_30d_bytes: number;
  growth_30d_percent: number;
  estimated_monthly_cost?: number;
  supabase_usage?: SupabasePlanUsage;
}

export interface GrowthDataPoint {
  date: string;
  total_size_bytes: number;
  object_count: number;
  size_delta: number;
  count_delta: number;
}

export interface TopDriver {
  name: string;
  size_bytes: number;
  object_count: number;
  percent_of_total: number;
  growth_bytes: number;
}

export interface StorageBucket {
  id: string;
  name: string;
  provider: string;
  is_public: boolean;
  file_size_limit?: number;
  allowed_mime_types: string[];
  total_size_bytes: number;
  object_count: number;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BucketStats {
  name: string;
  total_size_bytes: number;
  object_count: number;
  trash_size_bytes: number;
  trash_count: number;
  largest_file_bytes: number;
  avg_file_size_bytes: number;
  growth_30d_bytes: number;
  growth_30d_percent: number;
}

export interface StorageObject {
  id: string;
  bucket: string;
  path: string;
  name: string;
  size_bytes: number;
  mime_type?: string;
  owner_user_id?: string;
  module?: string;
  is_deleted: boolean;
  deleted_at?: string;
  deleted_by?: string;
  original_path?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ExplorerItem {
  type: 'file' | 'folder';
  name: string;
  path: string;
  bucket: string;
  size_bytes?: number;
  mime_type?: string;
  object_count?: number;
  created_at?: string;
  updated_at?: string;
  is_deleted: boolean;
  metadata: Record<string, unknown>;
}

export interface ExplorerResponse {
  bucket: string;
  prefix: string;
  items: ExplorerItem[];
  total_items: number;
  total_size_bytes: number;
  has_more: boolean;
  continuation_token?: string;
}

export interface OrphanCandidate {
  id: string;
  bucket: string;
  path: string;
  size_bytes: number;
  first_seen_at: string;
  last_checked_at: string;
  confidence_score: number;
  status: string;
  notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface StoragePolicy {
  id: string;
  name: string;
  description?: string;
  bucket: string;
  prefix?: string;
  mode: string;
  older_than_days: number;
  min_size_bytes?: number;
  mime_types: string[];
  schedule_cron?: string;
  dry_run: boolean;
  enabled: boolean;
  last_run_at?: string;
  next_run_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PolicyRunResult {
  policy_id: string;
  policy_name: string;
  is_dry_run: boolean;
  affected_count: number;
  affected_size_bytes: number;
  affected_paths: string[];
  errors: string[];
  run_at: string;
}

export interface StorageJob {
  id: string;
  type: string;
  status: string;
  priority: number;
  started_at?: string;
  finished_at?: string;
  requested_by?: string;
  params: Record<string, unknown>;
  progress: number;
  items_total: number;
  items_processed: number;
  items_failed: number;
  result_summary?: Record<string, unknown>;
  error_message?: string;
  report_url?: string;
  created_at: string;
  updated_at: string;
}

export interface StorageAuditLog {
  id: string;
  actor_user_id?: string;
  actor_email?: string;
  actor_role?: string;
  action: string;
  bucket?: string;
  paths?: string[];
  reason?: string;
  ip_address?: string;
  user_agent?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface QuotaStatus {
  user_id: string;
  max_storage_bytes: number;
  current_usage_bytes: number;
  usage_percent: number;
  remaining_bytes: number;
  max_file_size: number;
  is_warning: boolean;
  is_exceeded: boolean;
}

export interface StorageAlert {
  id: string;
  type: string;
  severity: string;
  bucket?: string;
  user_id?: string;
  message: string;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface BulkOperationResult {
  job_id: string;
  operation: string;
  total_items: number;
  processed: number;
  failed: number;
  status: string;
  errors: string[];
}

// List Responses
export interface BucketListResponse {
  buckets: StorageBucket[];
  total: number;
}

export interface ObjectListResponse {
  objects: StorageObject[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface OrphanListResponse {
  orphans: OrphanCandidate[];
  total: number;
  total_size_bytes: number;
  page: number;
  page_size: number;
}

export interface PolicyListResponse {
  policies: StoragePolicy[];
  total: number;
}

export interface JobListResponse {
  jobs: StorageJob[];
  total: number;
  page: number;
  page_size: number;
}

export interface AuditLogListResponse {
  logs: StorageAuditLog[];
  total: number;
  page: number;
  page_size: number;
}

export interface AlertListResponse {
  alerts: StorageAlert[];
  total: number;
  unacknowledged_count: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}/api${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// API Functions
// ============================================================================

// Overview / Dashboard
export async function getStorageOverview(): Promise<StorageOverview> {
  return fetchApi<StorageOverview>('/storage/overview');
}

export async function getGrowthData(bucket?: string, days = 30): Promise<GrowthDataPoint[]> {
  const params = new URLSearchParams();
  if (bucket) params.set('bucket', bucket);
  params.set('days', days.toString());
  return fetchApi<GrowthDataPoint[]>(`/storage/growth?${params}`);
}

export async function getTopDrivers(limit = 10): Promise<TopDriver[]> {
  return fetchApi<TopDriver[]>(`/storage/top-drivers?limit=${limit}`);
}

// Buckets
export async function listBuckets(): Promise<BucketListResponse> {
  return fetchApi<BucketListResponse>('/storage/buckets');
}

export async function getBucket(name: string): Promise<StorageBucket> {
  return fetchApi<StorageBucket>(`/storage/buckets/${name}`);
}

export async function getBucketStats(name: string): Promise<BucketStats> {
  return fetchApi<BucketStats>(`/storage/buckets/${name}/stats`);
}

export async function syncBuckets(): Promise<StorageBucket[]> {
  return fetchApi<StorageBucket[]>('/storage/buckets/sync', { method: 'POST' });
}

// Objects
export interface ListObjectsParams {
  bucket?: string;
  prefix?: string;
  query?: string;
  owner_user_id?: string;
  module?: string;
  min_size_bytes?: number;
  max_size_bytes?: number;
  include_deleted?: boolean;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export async function listObjects(params: ListObjectsParams = {}): Promise<ObjectListResponse> {
  const searchParams = new URLSearchParams();
  if (params.bucket) searchParams.set('bucket', params.bucket);
  if (params.prefix) searchParams.set('prefix', params.prefix);
  if (params.query) searchParams.set('q', params.query);
  if (params.owner_user_id) searchParams.set('owner_user_id', params.owner_user_id);
  if (params.module) searchParams.set('module', params.module);
  if (params.min_size_bytes) searchParams.set('min_size_bytes', params.min_size_bytes.toString());
  if (params.max_size_bytes) searchParams.set('max_size_bytes', params.max_size_bytes.toString());
  if (params.include_deleted) searchParams.set('include_deleted', 'true');
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.page_size) searchParams.set('page_size', params.page_size.toString());
  if (params.sort_by) searchParams.set('sort_by', params.sort_by);
  if (params.sort_order) searchParams.set('sort_order', params.sort_order);
  return fetchApi<ObjectListResponse>(`/storage/objects?${searchParams}`);
}

export async function getLargestObjects(bucket?: string, limit = 20): Promise<StorageObject[]> {
  const params = new URLSearchParams();
  if (bucket) params.set('bucket', bucket);
  params.set('limit', limit.toString());
  return fetchApi<StorageObject[]>(`/storage/objects/largest?${params}`);
}

export async function getRecentObjects(bucket?: string, limit = 20): Promise<StorageObject[]> {
  const params = new URLSearchParams();
  if (bucket) params.set('bucket', bucket);
  params.set('limit', limit.toString());
  return fetchApi<StorageObject[]>(`/storage/objects/recent?${params}`);
}

export async function getObject(bucket: string, path: string): Promise<StorageObject> {
  return fetchApi<StorageObject>(`/storage/objects/${bucket}/${path}`);
}

// Explorer
export async function exploreBucket(bucket: string, prefix = '', limit = 100): Promise<ExplorerResponse> {
  const params = new URLSearchParams();
  params.set('prefix', prefix);
  params.set('limit', limit.toString());
  return fetchApi<ExplorerResponse>(`/storage/explore/${bucket}?${params}`);
}

// Trash / Delete / Restore
export async function trashObjects(bucket: string, paths: string[], reason: string): Promise<BulkOperationResult> {
  return fetchApi<BulkOperationResult>('/storage/trash', {
    method: 'POST',
    body: JSON.stringify({ bucket, paths, reason }),
  });
}

export async function deleteObjects(
  bucket: string,
  paths: string[],
  reason: string,
  confirmationPhrase: string
): Promise<BulkOperationResult> {
  return fetchApi<BulkOperationResult>('/storage/delete', {
    method: 'POST',
    body: JSON.stringify({
      bucket,
      paths,
      reason,
      confirmation_phrase: confirmationPhrase,
    }),
  });
}

export async function restoreObjects(bucket: string, paths: string[]): Promise<BulkOperationResult> {
  return fetchApi<BulkOperationResult>('/storage/restore', {
    method: 'POST',
    body: JSON.stringify({ bucket, paths }),
  });
}

// Orphans
export async function listOrphans(status = 'pending', page = 1, pageSize = 50): Promise<OrphanListResponse> {
  const params = new URLSearchParams();
  params.set('status', status);
  params.set('page', page.toString());
  params.set('page_size', pageSize.toString());
  return fetchApi<OrphanListResponse>(`/storage/orphans?${params}`);
}

export async function scanForOrphans(bucket?: string): Promise<StorageJob> {
  const params = bucket ? `?bucket=${bucket}` : '';
  return fetchApi<StorageJob>(`/storage/orphans/scan${params}`, { method: 'POST' });
}

export async function updateOrphan(orphanId: string, status: string, notes?: string): Promise<OrphanCandidate> {
  return fetchApi<OrphanCandidate>(`/storage/orphans/${orphanId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  });
}

// Policies
export async function listPolicies(enabledOnly = false): Promise<PolicyListResponse> {
  return fetchApi<PolicyListResponse>(`/storage/policies?enabled_only=${enabledOnly}`);
}

export interface CreatePolicyParams {
  name: string;
  description?: string;
  bucket: string;
  prefix?: string;
  mode: 'trash' | 'delete' | 'archive';
  older_than_days: number;
  min_size_bytes?: number;
  mime_types?: string[];
  schedule_cron?: string;
  dry_run?: boolean;
  enabled?: boolean;
}

export async function createPolicy(params: CreatePolicyParams): Promise<StoragePolicy> {
  return fetchApi<StoragePolicy>('/storage/policies', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updatePolicy(policyId: string, updates: Partial<CreatePolicyParams>): Promise<StoragePolicy> {
  return fetchApi<StoragePolicy>(`/storage/policies/${policyId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function runPolicy(policyId: string, dryRun = true): Promise<PolicyRunResult> {
  return fetchApi<PolicyRunResult>(`/storage/policies/${policyId}/run?dry_run=${dryRun}`, {
    method: 'POST',
  });
}

// Jobs
export async function listJobs(
  status?: string,
  type?: string,
  page = 1,
  pageSize = 50
): Promise<JobListResponse> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (type) params.set('type', type);
  params.set('page', page.toString());
  params.set('page_size', pageSize.toString());
  return fetchApi<JobListResponse>(`/storage/jobs?${params}`);
}

export async function getJob(jobId: string): Promise<StorageJob> {
  return fetchApi<StorageJob>(`/storage/jobs/${jobId}`);
}

// Audit Logs
export interface ListAuditLogsParams {
  actor_user_id?: string;
  action?: string;
  bucket?: string;
  created_after?: string;
  created_before?: string;
  page?: number;
  page_size?: number;
}

export async function listAuditLogs(params: ListAuditLogsParams = {}): Promise<AuditLogListResponse> {
  const searchParams = new URLSearchParams();
  if (params.actor_user_id) searchParams.set('actor_user_id', params.actor_user_id);
  if (params.action) searchParams.set('action', params.action);
  if (params.bucket) searchParams.set('bucket', params.bucket);
  if (params.created_after) searchParams.set('created_after', params.created_after);
  if (params.created_before) searchParams.set('created_before', params.created_before);
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.page_size) searchParams.set('page_size', params.page_size.toString());
  return fetchApi<AuditLogListResponse>(`/storage/audit-logs?${searchParams}`);
}

// Quotas
export async function getUserQuota(userId: string): Promise<QuotaStatus> {
  return fetchApi<QuotaStatus>(`/storage/quotas/${userId}`);
}

export async function updateUserQuota(
  userId: string,
  updates: { max_storage_bytes?: number; max_file_size?: number; warn_at_percent?: number }
): Promise<QuotaStatus> {
  return fetchApi<QuotaStatus>(`/storage/quotas/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// Alerts
export async function listAlerts(unacknowledgedOnly = true, page = 1, pageSize = 50): Promise<AlertListResponse> {
  const params = new URLSearchParams();
  params.set('unacknowledged_only', unacknowledgedOnly.toString());
  params.set('page', page.toString());
  params.set('page_size', pageSize.toString());
  return fetchApi<AlertListResponse>(`/storage/alerts?${params}`);
}

export async function acknowledgeAlert(alertId: string): Promise<StorageAlert> {
  return fetchApi<StorageAlert>(`/storage/alerts/${alertId}/acknowledge`, { method: 'POST' });
}

// Sync / Inventory
export async function syncInventory(bucket?: string, prefix?: string, fullSync = false): Promise<{ job_id: string }> {
  return fetchApi<{ job_id: string }>('/storage/index/sync', {
    method: 'POST',
    body: JSON.stringify({ bucket, prefix, full_sync: fullSync }),
  });
}

export async function recordSnapshot(): Promise<{ status: string; message: string }> {
  return fetchApi<{ status: string; message: string }>('/storage/snapshots/record', {
    method: 'POST',
  });
}

// Export utility
export { formatBytes };

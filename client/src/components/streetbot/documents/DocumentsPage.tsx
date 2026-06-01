import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import "@/styles/glassmorphism.css";
import {
  Search,
  Plus,
  FileText,
  File,
  FileSpreadsheet,
  Folder,
  FolderPlus,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Clock,
  Star,
  Trash2,
  Share2,
  Download,
  Edit3,
  X,
  Loader2,
  Upload,
  MoreHorizontal,
  Grid3X3,
  List,
  Eye,
  Users,
  Lock,
  History,
  Tag,
  RefreshCw,
  Presentation,
  ArrowLeft,
  ExternalLink,
  MessageSquare,
  RotateCcw,
  BarChart3,
  AlertTriangle,
  Bell,
  Bookmark,
  BookmarkPlus,
  CalendarClock,
} from "lucide-react";
import { useGlassStyles } from "@/hooks/useGlassStyles";
import { CrossLink } from "../shared/CrossLink";
import { sbFetch, sbGet, sbPost, sbPatch, sbDelete } from "@/shared/sbFetch";
import { SB_API_BASE } from "@/shared/apiConfig";
import { useAuthContext } from "~/hooks/AuthContext";
import { getOrCreateUserId } from "@/shared/userId";
import TiptapDocumentEditor, {
  TIPTAP_PAGE_SETTINGS_METADATA_KEY,
  TiptapDocumentSaveConflictError,
  type TiptapCommentCreatePayload,
  type TiptapCollaborationConfig,
  type TiptapMediaUploadResult,
  type TiptapMentionOption,
  type TiptapPageSettings,
  type TiptapReviewComment,
  type TiptapReviewSuggestion,
  type TiptapSavePayload,
} from "./TiptapDocumentEditor";
import type { SuggestionData } from "../lib/tiptap/TrackChangesExtension";

// ── Types ──────────────────────────────────────────────────────────────

interface Document {
  id: string;
  title: string;
  slug?: string;
  workspace_id?: string;
  folder_id?: string;
  document_type: string;
  status: string;
  content_text?: string;
  word_count: number;
  reading_time_minutes: number;
  author_id?: string;
  is_pinned: boolean;
  is_archived: boolean;
  is_locked: boolean;
  version_count: number;
  comment_count: number;
  share_count: number;
  view_count: number;
  tags: string[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

interface DocumentFolder {
  id: string;
  name: string;
  workspace_id: string;
  parent_folder_id?: string;
  document_count: number;
  created_at: string;
}

interface Workspace {
  id: string;
  name: string;
  description?: string;
  document_count: number;
  folder_count: number;
}

interface DocumentDetail extends Document {
  content?: Record<string, unknown> | null;
  content_text?: string;
  metadata?: Record<string, unknown>;
  last_edited_by?: string;
  published_at?: string;
}

interface SuggestionApiResponse {
  id: string;
  document_id: string;
  suggestion_id: string;
  suggestion_type: "insertion" | "deletion";
  original_text?: string;
  suggested_text?: string;
  anchor_from: number;
  anchor_to: number;
  author_id?: string;
  author_name?: string;
  author_color?: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  updated_at: string;
}

interface CommentApiResponse {
  id: string;
  document_id: string;
  parent_id?: string;
  user_id?: string;
  content: string;
  anchor_type: "document" | "selection" | "block";
  anchor_from?: number;
  anchor_to?: number;
  anchor_text?: string;
  is_resolved: boolean;
  assigned_to?: string;
  reply_count: number;
  created_at: string;
  updated_at: string;
}

interface WorkspaceMemberApiResponse {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  role_name?: string | null;
  user_name?: string | null;
  user_email?: string | null;
}

interface DocumentShareApiResponse {
  id: string;
  user_id?: string;
  email?: string;
  permission?: string;
  is_external?: boolean;
}

interface UploadedEditorMediaApiResponse {
  file_id?: string;
  filepath?: string;
  filename?: string;
  type?: string;
  source?: string;
  user?: string;
  bytes?: number;
  width?: number;
  height?: number;
}

interface DocumentsCollaborationTokenResponse {
  auth_required: boolean;
  document_id: string;
  room_name: string;
  token: string | null;
  expires_at: string | null;
}

interface DocumentsCollaborationLock {
  document_id: string;
  room_name: string;
  lock_id: string;
  user_id: string;
  user_name: string;
  acquired_at: string | null;
  renewed_at: string | null;
  expires_at: string | null;
  active: boolean;
}

interface DocumentsCollaborationLockResponse {
  document_id: string;
  room_name: string;
  lock: DocumentsCollaborationLock | null;
  ttl_ms?: number;
  message?: string;
}

type DocumentsCollaborationLockStatus = "idle" | "acquiring" | "owned" | "blocked" | "unavailable" | "error";
type DocumentVersionRetentionPolicy = "keep-latest" | "keep-forever" | "retain-until";

interface DocumentVersion {
  id: string;
  document_id?: string;
  version_number: number;
  schema_version?: number;
  title: string;
  word_count?: number;
  change_note?: string;
  change_type?: string;
  retention_policy?: DocumentVersionRetentionPolicy | string;
  retained_until?: string | null;
  origin?: string;
  client_snapshot_id?: string;
  source_version_id?: string;
  content_hash?: string;
  author_id?: string;
  created_at: string;
  source?: "server" | "durable" | "local";
  content?: Record<string, unknown> | null;
  content_text?: string;
  metadata?: Record<string, unknown>;
  updated_at?: string;
}

interface DocumentVersionRetentionReport {
  schema_version?: number;
  max_snapshots: number;
  total_count: number;
  keep_latest_count: number;
  keep_forever_count: number;
  retain_until_count: number;
  active_retain_until_count: number;
  expired_retain_until_count: number;
  protected_count: number;
  prunable_count: number;
  over_limit_count: number;
  oldest_snapshot_at?: string | null;
  newest_snapshot_at?: string | null;
  origins?: Array<{ origin: string; count: number }>;
  schema_versions?: Array<{ schema_version: number; count: number }>;
}

interface DurableDocumentVersionHistory {
  versions: DocumentVersion[];
  retentionReport: DocumentVersionRetentionReport | null;
  retentionTrendReport: DocumentVersionRetentionTrendReport | null;
}

interface DurableDocumentVersionRetentionUpdate {
  version: DocumentVersion | null;
  retentionReport: DocumentVersionRetentionReport | null;
}

interface DocumentVersionRetentionExportSnapshot {
  id: string;
  snapshot_id: string;
  document_id?: string;
  version_number: number;
  title: string;
  word_count?: number;
  change_note?: string;
  change_type?: string;
  schema_version?: number;
  retention_policy: DocumentVersionRetentionPolicy;
  retained_until?: string | null;
  origin?: string;
  client_snapshot_id?: string;
  source_version_id?: string;
  author_id?: string;
  content_hash?: string;
  created_at: string;
  updated_at?: string;
}

interface DocumentVersionRetentionExportPayload {
  type: "documents_version_retention_report";
  schema_version: number;
  generated_at: string;
  document_id: string;
  document_title?: string;
  retention_report: DocumentVersionRetentionReport;
  snapshots: DocumentVersionRetentionExportSnapshot[];
}

interface DocumentVersionRetentionTrendBucket {
  date: string;
  start_at?: string;
  end_at?: string;
  created_count: number;
  cumulative_count: number;
  keep_latest_count: number;
  keep_forever_count: number;
  retain_until_count: number;
  active_retain_until_count: number;
  expired_retain_until_count: number;
  protected_count: number;
  prunable_count: number;
  over_limit_count: number;
  top_origin?: string | null;
  top_origin_count?: number;
}

interface DocumentVersionRetentionTrendReport {
  type?: "documents_version_retention_trends";
  schema_version?: number;
  generated_at?: string;
  document_id?: string;
  window: {
    days: number;
    from?: string;
    to?: string;
    bucket: "day";
  };
  retention_report?: DocumentVersionRetentionReport | null;
  buckets: DocumentVersionRetentionTrendBucket[];
}

interface DocumentRetentionDashboardDocumentSummary {
  document_id: string;
  title: string;
  latest_version_number?: number | null;
  latest_snapshot_at?: string | null;
  snapshot_count: number;
  captured_in_window_count: number;
  protected_count: number;
  prunable_count: number;
  over_limit_count: number;
  expired_retain_until_count: number;
  keep_latest_count: number;
  keep_forever_count: number;
  retain_until_count: number;
  primary_origin?: string | null;
  primary_origin_count?: number;
  schema_version?: number | null;
  risk_score: number;
}

type DocumentRetentionDashboardAlertSeverity = "critical" | "warning" | "info";

interface DocumentRetentionDashboardAlert {
  id: string;
  type: string;
  severity: DocumentRetentionDashboardAlertSeverity;
  scope: "dashboard" | "document";
  document_id?: string | null;
  title?: string | null;
  count: number;
  risk_score: number;
  message: string;
  recommended_action: string;
}

interface DocumentRetentionDashboardAlertingSummary {
  max_alerts: number;
  alert_count: number;
  critical_count: number;
  warning_count: number;
}

interface DocumentRetentionDashboardExportSchedule {
  cadence: "weekly";
  next_export_at?: string | null;
  timezone: string;
  format: "json";
  content_free: boolean;
  retention_window_days: number;
  max_documents: number;
  includes: string[];
}

interface DocumentRetentionDashboardPolicyAction {
  id: string;
  type: string;
  severity: DocumentRetentionDashboardAlertSeverity;
  scope: "dashboard" | "document";
  document_id?: string | null;
  title?: string | null;
  count: number;
  reason: string;
  suggested_action: string;
  safe_to_auto_apply: boolean;
  requires_admin_confirmation: boolean;
}

interface DocumentRetentionDashboardPolicyAutomation {
  mode: "dry-run";
  max_actions: number;
  action_count: number;
  destructive_action_count: number;
  requires_admin_confirmation: boolean;
  actions: DocumentRetentionDashboardPolicyAction[];
}

type DocumentRetentionDashboardDeliveryStatus = "scheduled" | "ready" | "disabled" | "delivered" | "failed";

interface DocumentRetentionDashboardDeliveryEvent {
  status: DocumentRetentionDashboardDeliveryStatus;
  occurred_at?: string | null;
  message: string;
  manifest_id: string;
  payload_hash: string;
  storage_adapter?: string;
  storage_status?: string;
  storage_ref?: string | null;
  storage_path?: string | null;
  storage_hash?: string;
  storage_content_free?: boolean | null;
  stored_at?: string | null;
  pending_alert_count: number;
  pending_policy_action_count: number;
  retry_after_at?: string | null;
  retry_backoff_seconds: number;
}

interface DocumentRetentionDashboardExportDelivery {
  status: DocumentRetentionDashboardDeliveryStatus;
  background_worker: string;
  delivery_id: string;
  idempotency_key: string;
  next_attempt_at?: string | null;
  next_retry_at?: string | null;
  last_delivery_at?: string | null;
  last_failure_at?: string | null;
  last_failure_message: string;
  attempt_count: number;
  failure_count: number;
  retry_backoff_seconds: number;
  channels: string[];
  payload_type: "documents_version_retention_dashboard";
  payload_content_free: boolean;
  pending_alert_count: number;
  pending_policy_action_count: number;
  requires_worker: boolean;
  persisted: boolean;
  delivery_history_count: number;
  last_delivery_status?: DocumentRetentionDashboardDeliveryStatus | null;
  last_delivery_message?: string;
  delivery_events: DocumentRetentionDashboardDeliveryEvent[];
  generated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  retention_window_days?: number;
  max_documents?: number;
}

interface DocumentRetentionDashboardExportReliability {
  job_count: number;
  scheduled_count: number;
  delivered_count: number;
  failed_count: number;
  retry_ready_count: number;
  pending_retry_count: number;
  attempt_count: number;
  failure_count: number;
  max_retry_backoff_seconds: number;
  last_failure_at?: string | null;
  last_delivery_at?: string | null;
}

interface DocumentRetentionDashboardWorkerObservability {
  type?: "documents_retention_export_worker_observability" | "documents_retention_reminder_notification_worker_observability";
  health: "healthy" | "degraded" | "running" | "manual";
  heartbeat_at?: string | null;
  scheduled_at?: string | null;
  stopped_at?: string | null;
  next_run_at?: string | null;
  next_run_in_ms?: number | null;
  scheduler_lag_ms: number;
  last_started_at?: string | null;
  last_completed_at?: string | null;
  run_count: number;
  completed_count: number;
  failed_count: number;
  skipped_count: number;
  consecutive_failure_count: number;
  last_duration_ms: number;
  max_duration_ms: number;
  summary: string;
}

interface DocumentRetentionDashboardExportWorkerStatus {
  type?: "documents_retention_export_worker_status" | "documents_retention_reminder_notification_worker_status";
  worker: string;
  scheduler_enabled: boolean;
  scheduler_status: "enabled" | "disabled";
  interval_ms: number;
  interval_label: string;
  batch_limit: number;
  mode: "interval-dispatch" | "manual-dispatch-only" | "interval-retry" | "manual-retry-only";
  payload_content_free: boolean;
  scheduled: boolean;
  running: boolean;
  due_job_count: number;
  health: "healthy" | "degraded" | "running" | "manual";
  next_run_at?: string | null;
  observability: DocumentRetentionDashboardWorkerObservability;
  last_run_at?: string | null;
  last_run_status?: string | null;
  last_run_message: string;
  summary: string;
  safeguards: string[];
}

interface DocumentRetentionDashboardReport {
  type?: "documents_version_retention_dashboard";
  schema_version?: number;
  generated_at?: string;
  scope: "admin" | "accessible";
  window: {
    days: number;
    from?: string;
    to?: string;
    bucket: "day";
  };
  retention_report: DocumentVersionRetentionReport;
  buckets: DocumentVersionRetentionTrendBucket[];
  documents_count: number;
  returned_documents_count: number;
  document_summaries: DocumentRetentionDashboardDocumentSummary[];
  alerting: DocumentRetentionDashboardAlertingSummary;
  alerts: DocumentRetentionDashboardAlert[];
  export_schedule: DocumentRetentionDashboardExportSchedule;
  policy_automation: DocumentRetentionDashboardPolicyAutomation;
  export_delivery: DocumentRetentionDashboardExportDelivery;
  export_reliability: DocumentRetentionDashboardExportReliability;
  export_worker: DocumentRetentionDashboardExportWorkerStatus;
  reminder_notification_worker: DocumentRetentionDashboardExportWorkerStatus;
  prune_audit_history: DocumentRetentionDashboardPruneAudit[];
  scheduled_prune_automation: DocumentRetentionDashboardScheduledPruneAutomation;
  backup_verification: DocumentRetentionDashboardBackupVerification;
  delivery_history: DocumentRetentionDashboardExportDelivery[];
}

interface DocumentRetentionDashboardDispatchResult {
  type?: "documents_version_retention_export_dispatch";
  attempted_count: number;
  dispatched_count: number;
  failed_count: number;
  deliveries: DocumentRetentionDashboardExportDelivery[];
}

interface DocumentRetentionDashboardRestoreDrillExecutionResult {
  type?: "documents_version_retention_restore_drill_execution";
  audit_id: string;
  status: "completed" | "blocked";
  payload_content_free: boolean;
  confirmation_required: boolean;
  confirmation_token: string;
  backup_handoff_required: boolean;
  backup_handoff_confirmed: boolean;
  restore_drill: DocumentRetentionDashboardRestoreDrill | null;
  audit: DocumentRetentionDashboardPruneAudit | null;
  scheduled_prune_automation: DocumentRetentionDashboardScheduledPruneAutomation;
  executed_at?: string | null;
}

type DocumentRetentionRestoreDownloadStatus = "blocked" | "metadata-only" | "ready" | "verified" | "failed";

interface DocumentRetentionRestoreDownloadVerification {
  type?: "documents_version_retention_restore_download_verification";
  schema_version?: number;
  generated_at?: string | null;
  downloaded_at?: string | null;
  payload_content_free: boolean;
  status: DocumentRetentionRestoreDownloadStatus;
  restore_download_ready: boolean;
  delivery_id?: string | null;
  manifest_id?: string | null;
  payload_hash?: string | null;
  storage_adapter?: string | null;
  storage_status?: string | null;
  storage_ref?: string | null;
  storage_path?: string | null;
  storage_hash_expected?: string | null;
  storage_hash_actual?: string | null;
  manifest_id_matched: boolean;
  payload_hash_matched: boolean;
  storage_hash_matched: boolean;
  content_free: boolean;
  error_message?: string;
  checks: string[];
  message: string;
}

interface DocumentRetentionDashboardPruneCandidate {
  snapshot_id: string;
  document_id: string;
  title: string;
  version_number: number;
  retention_policy: DocumentVersionRetentionPolicy;
  retained_until?: string | null;
  origin?: string;
  schema_version?: number;
  content_hash: string;
  saved_at?: string | null;
}

interface DocumentRetentionDashboardPruneDocumentSummary {
  document_id: string;
  title: string;
  snapshot_count: number;
  protected_count: number;
  prunable_count: number;
  over_limit_count: number;
  candidate_count: number;
  latest_snapshot_at?: string | null;
  oldest_candidate_at?: string | null;
  newest_candidate_at?: string | null;
}

type DocumentRetentionDashboardRestoreDrillStatus = "required" | "not-required" | "completed" | "blocked";

interface DocumentRetentionDashboardRestoreDrill {
  type?: "documents_version_retention_restore_drill";
  status: DocumentRetentionDashboardRestoreDrillStatus;
  payload_content_free: boolean;
  deleted_count: number;
  remaining_candidate_count: number;
  sample?: {
    snapshot_id?: string;
    document_id?: string;
    version_number?: number;
    content_hash?: string;
    saved_at?: string | null;
  } | null;
  checks: string[];
  message: string;
  generated_at?: string | null;
  completed_at?: string | null;
  backup_handoff?: {
    status: "required" | "confirmed" | "not-required";
    payload_content_free: boolean;
    source: string;
    required: boolean;
    confirmed: boolean;
  } | null;
  primary_history_check?: {
    status: "passed" | "failed";
    payload_content_free: boolean;
    checked_at?: string | null;
    sample_snapshot_id?: string | null;
    sample_snapshot_present: boolean;
  } | null;
  automation_clearance?: {
    scheduled_prune_allowed: boolean;
    reason: string;
  } | null;
  execution?: {
    type?: "documents_version_retention_restore_drill_execution";
    drill_id?: string;
    audit_id?: string;
    status: "completed" | "blocked";
    requested_by?: string | null;
    payload_content_free: boolean;
    confirmation_matched: boolean;
    backup_handoff_confirmed: boolean;
    executed_at?: string | null;
  } | null;
}

interface DocumentRetentionDashboardPruneAudit {
  audit_id: string;
  type?: "documents_version_retention_prune_audit";
  mode: "confirmed-delete";
  status: "completed" | "failed";
  requested_by?: string | null;
  payload_content_free: boolean;
  deleted_count: number;
  remaining_candidate_count: number;
  affected_documents_count: number;
  candidates: DocumentRetentionDashboardPruneCandidate[];
  documents: DocumentRetentionDashboardPruneDocumentSummary[];
  restore_drill: DocumentRetentionDashboardRestoreDrill | null;
  executed_at?: string | null;
}

interface DocumentRetentionDashboardScheduledPruneAutomation {
  type?: "documents_version_retention_scheduled_prune_guardrails";
  payload_content_free: boolean;
  enabled_requested: boolean;
  status: "manual-only" | "blocked" | "ready";
  scheduled_prune_allowed: boolean;
  required_restore_drill_count: number;
  latest_audit_id?: string | null;
  latest_restore_drill_status?: DocumentRetentionDashboardRestoreDrillStatus | null;
  last_completed_restore_drill_at?: string | null;
  confirmation_token: string;
  safeguards: string[];
  message: string;
  generated_at?: string | null;
}

interface DocumentRetentionRunbookEvidence {
  type?: "documents_version_retention_runbook_evidence";
  evidence_id: string;
  evidence_type: string;
  status: "verified" | "handoff-required" | "export-required";
  requested_by?: string | null;
  payload_content_free: boolean;
  storage_adapter: string;
  report_hash: string;
  latest_manifest_id?: string | null;
  latest_payload_hash?: string | null;
  latest_delivery_id?: string | null;
  latest_delivery_at?: string | null;
  backup_storage_ready: boolean;
  latest_storage_adapter?: string | null;
  latest_storage_status?: string | null;
  latest_storage_ref?: string | null;
  latest_storage_hash?: string | null;
  latest_stored_at?: string | null;
  backup_export_ready: boolean;
  backup_handoff_ready: boolean;
  delivered_manifest_count: number;
  failed_delivery_count: number;
  pending_delivery_count: number;
  prune_audit_count: number;
  required_restore_drill_count: number;
  completed_restore_drill_count: number;
  scheduled_prune_allowed: boolean;
  scheduled_prune_status: "manual-only" | "blocked" | "ready";
  recorded_at?: string | null;
  expires_at?: string | null;
}

type DocumentRetentionEvidenceReviewStatus = "missing" | "current" | "expiring-soon" | "expired";
type DocumentRetentionEvidenceReviewSeverity = "info" | "warning" | "critical";

interface DocumentRetentionEvidenceReminder {
  type?: "documents_version_retention_evidence_reminder";
  payload_content_free: boolean;
  status: DocumentRetentionEvidenceReviewStatus;
  severity: DocumentRetentionEvidenceReviewSeverity;
  review_required: boolean;
  latest_evidence_id?: string | null;
  latest_evidence_at?: string | null;
  expires_at?: string | null;
  days_until_expiry?: number | null;
  next_review_at?: string | null;
  due_at?: string | null;
  channels: string[];
  recommended_action: string;
  message: string;
}

interface DocumentRetentionReminderNotification {
  type?: "documents_version_retention_evidence_reminder_notification";
  notification_id: string;
  idempotency_key: string;
  reminder_status: DocumentRetentionEvidenceReviewStatus;
  severity: DocumentRetentionEvidenceReviewSeverity;
  review_required: boolean;
  status: "scheduled" | "delivered" | "failed" | "skipped";
  delivery_adapter: "internal-ledger" | "webhook" | string;
  delivery_target: string;
  channels: string[];
  payload_content_free: boolean;
  payload_hash: string;
  latest_evidence_id?: string | null;
  latest_manifest_id?: string | null;
  latest_payload_hash?: string | null;
  due_at?: string | null;
  next_review_at?: string | null;
  generated_at?: string | null;
  delivered_at?: string | null;
  last_failure_at?: string | null;
  last_failure_message: string;
  attempt_count: number;
  failure_count: number;
  retry_after_at?: string | null;
  retry_backoff_seconds: number;
  response_status: number;
  response_body_hash: string;
  message: string;
}

interface DocumentRetentionDashboardBackupVerification {
  type?: "documents_version_retention_backup_verification";
  payload_content_free: boolean;
  status: "verified" | "handoff-required" | "export-required";
  backup_export_ready: boolean;
  backup_handoff_ready: boolean;
  backup_storage_ready: boolean;
  latest_manifest_id?: string | null;
  latest_payload_hash?: string | null;
  latest_delivery_id?: string | null;
  latest_delivery_at?: string | null;
  latest_storage_adapter?: string | null;
  latest_storage_status?: string | null;
  latest_storage_ref?: string | null;
  latest_storage_path?: string | null;
  latest_storage_hash?: string | null;
  latest_storage_content_free: boolean;
  latest_stored_at?: string | null;
  restore_download_ready: boolean;
  restore_download_status: "blocked" | "metadata-only" | "ready";
  delivered_manifest_count: number;
  failed_delivery_count: number;
  pending_delivery_count: number;
  prune_audit_count: number;
  required_restore_drill_count: number;
  completed_restore_drill_count: number;
  scheduled_prune_allowed: boolean;
  scheduled_prune_status: "manual-only" | "blocked" | "ready";
  evidence_count: number;
  latest_evidence_id?: string | null;
  latest_evidence_at?: string | null;
  latest_evidence_expires_at?: string | null;
  evidence_storage_adapter: string;
  evidence_retention_days: number;
  evidence_review_status: DocumentRetentionEvidenceReviewStatus;
  evidence_fresh: boolean;
  evidence_expired: boolean;
  evidence_expires_in_days?: number | null;
  evidence_review_required: boolean;
  evidence_review_severity: DocumentRetentionEvidenceReviewSeverity;
  evidence_next_review_at?: string | null;
  evidence_review_due_at?: string | null;
  evidence_reminder: DocumentRetentionEvidenceReminder | null;
  evidence_reminder_notification_count: number;
  evidence_reminder_notification_failed_count: number;
  evidence_reminder_notification_retry_ready_count: number;
  evidence_reminder_notification_pending_retry_count: number;
  evidence_reminder_notification_attempt_count: number;
  evidence_reminder_notification_failure_count: number;
  evidence_reminder_notification_max_retry_backoff_seconds: number;
  latest_evidence_reminder_notification_failure_at?: string | null;
  latest_evidence_reminder_notification_delivery_at?: string | null;
  latest_evidence_reminder_notification: DocumentRetentionReminderNotification | null;
  evidence_reminder_notification_history: DocumentRetentionReminderNotification[];
  evidence_history: DocumentRetentionRunbookEvidence[];
  checks: string[];
  runbook_steps: string[];
  message: string;
  generated_at?: string | null;
}

interface DocumentRetentionBackupEvidenceRecordResult {
  type?: "documents_version_retention_backup_verification_evidence_record";
  payload_content_free: boolean;
  created: boolean;
  evidence: DocumentRetentionRunbookEvidence | null;
  verification: DocumentRetentionDashboardBackupVerification;
}

interface DocumentRetentionReminderNotificationDispatchResult {
  type?: "documents_version_retention_evidence_reminder_notification_dispatch";
  payload_content_free: boolean;
  attempted_count: number;
  delivered_count: number;
  failed_count: number;
  skipped_count: number;
  created: boolean;
  notification: DocumentRetentionReminderNotification | null;
  reminder: DocumentRetentionEvidenceReminder | null;
  verification: DocumentRetentionDashboardBackupVerification;
  message: string;
}

interface DocumentRetentionReminderNotificationRetryResult {
  type?: "documents_version_retention_evidence_reminder_notification_retry_dispatch";
  payload_content_free: boolean;
  attempted_count: number;
  delivered_count: number;
  failed_count: number;
  skipped_count: number;
  retry_ready_count: number;
  pending_retry_count: number;
  notifications: DocumentRetentionReminderNotification[];
  verification: DocumentRetentionDashboardBackupVerification;
  message: string;
}

interface DocumentRetentionDashboardPrunePreview {
  type?: "documents_version_retention_prune_preview" | "documents_version_retention_prune_execution";
  mode: "dry-run" | "confirmed-delete";
  payload_content_free: boolean;
  confirmation_required: boolean;
  confirmation_token: string;
  max_snapshots: number;
  candidate_limit: number;
  total_candidate_count: number;
  candidate_count: number;
  limited: boolean;
  documents_count: number;
  affected_documents_count: number;
  documents: DocumentRetentionDashboardPruneDocumentSummary[];
  candidates: DocumentRetentionDashboardPruneCandidate[];
  safeguards: string[];
  audit_id?: string | null;
  audit?: DocumentRetentionDashboardPruneAudit | null;
  audit_history: DocumentRetentionDashboardPruneAudit[];
  restore_drill?: DocumentRetentionDashboardRestoreDrill | null;
  scheduled_prune_automation?: DocumentRetentionDashboardScheduledPruneAutomation | null;
  confirmed?: boolean;
  requested_by?: string | null;
  deleted_count?: number;
  remaining_candidate_count?: number;
  executed_at?: string;
}

interface DocumentsOrganizerFolder {
  folder_key: string;
  folder_name: string;
  document_type: string;
  count: number;
  total_size_bytes: number;
  latest_modified_at?: string | null;
}

interface DocumentsOrganizerFile {
  id: string;
  filename: string;
  basename: string;
  extension: string;
  document_type: string;
  folder_key: string;
  folder_name: string;
  source_root?: string;
  source_path?: string;
  display_path: string;
  relative_path: string;
  size_bytes: number;
  modified_at?: string | null;
  physical_move_performed?: boolean;
}

interface DocumentsOrganizerSummary {
  type?: "documents_organizer_summary";
  storage: "mongodb";
  roots: string[];
  content_indexed: boolean;
  physical_moves_performed: boolean;
  scanned_file_count: number;
  missing_file_count: number;
  moved_file_count: number;
  folder_count: number;
  total_size_bytes: number;
  latest_scan_at?: string | null;
  folders: DocumentsOrganizerFolder[];
  recent_files: DocumentsOrganizerFile[];
  safeguards: string[];
  message: string;
}

interface DocumentsOrganizerFilesResult {
  type?: "documents_organizer_files";
  storage: "mongodb";
  folder_key: string;
  source_root: string;
  source_display_root: string;
  query: string;
  sort_by: DocumentsOrganizerFileSortKey;
  limit: number;
  offset: number;
  next_offset: number;
  has_more: boolean;
  total_count: number;
  returned_count: number;
  files: DocumentsOrganizerFile[];
  content_indexed: boolean;
  message: string;
}

interface DocumentsOrganizerSourceCollection {
  source_root: string;
  source_display_root: string;
  count: number;
  total_size_bytes: number;
  latest_modified_at?: string | null;
  folder_count: number;
  folders: DocumentsOrganizerFolder[];
}

interface DocumentsOrganizerCollectionsResult {
  type?: "documents_organizer_collections";
  storage: "mongodb";
  content_indexed: boolean;
  physical_moves_performed: boolean;
  scanned_file_count: number;
  total_size_bytes: number;
  source_root_count: number;
  document_type_count: number;
  returned_source_root_count: number;
  returned_document_type_count: number;
  latest_scan_at?: string | null;
  physical_target_root: string;
  physical_target_display_root: string;
  source_roots: DocumentsOrganizerSourceCollection[];
  document_types: DocumentsOrganizerFolder[];
  safeguards: string[];
  message: string;
}

interface DocumentsOrganizerRecommendation {
  id: string;
  name: string;
  description: string;
  reason: string;
  folder_key: string;
  folder_name: string;
  source_root?: string;
  source_display_root?: string;
  search_query: string;
  sort_by: DocumentsOrganizerFileSortKey;
  matched_file_count: number;
  total_size_bytes: number;
  latest_modified_at: string | null;
  priority: number;
  sample_files: DocumentsOrganizerFile[];
}

interface DocumentsOrganizerRecommendationsResult {
  type?: "documents_organizer_recommendations";
  storage: "mongodb";
  scanned_file_count: number;
  total_candidate_count: number;
  returned_count: number;
  recommendations: DocumentsOrganizerRecommendation[];
  content_indexed: boolean;
  physical_moves_performed: boolean;
  safeguards: string[];
  message: string;
}

interface DocumentsOrganizerDuplicateGroup {
  duplicate_key: string;
  filename: string;
  size_bytes: number;
  count: number;
  duplicate_size_bytes: number;
  latest_modified_at: string | null;
  hidden_file_count: number;
  files: DocumentsOrganizerFile[];
}

interface DocumentsOrganizerDuplicatesResult {
  type?: "documents_organizer_duplicates";
  storage: "mongodb";
  duplicate_group_count: number;
  returned_group_count: number;
  duplicate_file_count: number;
  reclaimable_size_bytes: number;
  include_project_files: boolean;
  include_technical_files: boolean;
  project_filter_applied: boolean;
  technical_filter_applied: boolean;
  groups: DocumentsOrganizerDuplicateGroup[];
  content_indexed: boolean;
  safeguards: string[];
  message: string;
}

interface DocumentsOrganizerScanResult {
  type?: "documents_organizer_scan";
  scan_id: string;
  storage: "mongodb";
  roots: string[];
  skipped_roots: Array<{ root: string; reason: string }>;
  max_files: number;
  max_depth: number;
  scanned_file_count: number;
  indexed_file_count: number;
  folder_count: number;
  folders: DocumentsOrganizerFolder[];
  content_indexed: boolean;
  physical_moves_performed: boolean;
  completed_at: string;
  summary: DocumentsOrganizerSummary;
  message: string;
}

interface DocumentsOrganizerMoveAction {
  file_id: string;
  filename: string;
  folder_key: string;
  folder_name: string;
  source_display_path: string;
  target_display_path: string;
  target_display_folder: string;
  size_bytes: number;
  collision_index: number;
  action: "move";
  reason?: string | null;
}

interface DocumentsOrganizerMoveSkippedFile {
  file_id: string;
  filename: string;
  folder_key: string;
  folder_name: string;
  document_type: string;
  source_display_path: string;
  size_bytes: number;
  action: "skip";
  reason: string;
}

interface DocumentsOrganizerMoveSkippedReason {
  reason: string;
  count: number;
  total_size_bytes: number;
}

interface DocumentsOrganizerMovePlan {
  type?: "documents_organizer_move_plan";
  storage: "filesystem+mongodb";
  target_root: string;
  target_display_root: string;
  confirmation_phrase: string;
  requires_confirmation: boolean;
  scanned_file_count: number;
  move_count: number;
  skipped_count: number;
  already_organized_count: number;
  project_file_skipped_count: number;
  collision_count: number;
  folder_count: number;
  total_size_bytes: number;
  content_indexed: boolean;
  physical_moves_performed: boolean;
  folders: DocumentsOrganizerFolder[];
  actions: DocumentsOrganizerMoveAction[];
  action_sample_count: number;
  skipped_reason_counts: DocumentsOrganizerMoveSkippedReason[];
  skipped_files: DocumentsOrganizerMoveSkippedFile[];
  skipped_file_sample_count: number;
  safeguards: string[];
  message: string;
}

interface DocumentsOrganizerMovePlanExport {
  type?: "documents_organizer_move_plan_export";
  storage: "filesystem+mongodb";
  format: "json";
  schema_version: number;
  generated_at: string;
  manifest_hash: string;
  action_count: number;
  move_count: number;
  skipped_count: number;
  skipped_file_count: number;
  skipped_reason_counts: DocumentsOrganizerMoveSkippedReason[];
  already_organized_count: number;
  project_file_skipped_count: number;
  collision_count: number;
  total_size_bytes: number;
  content_indexed: boolean;
  physical_moves_performed: boolean;
  plan: DocumentsOrganizerMovePlan;
  safeguards: string[];
  message: string;
}

interface DocumentsOrganizerMoveResult {
  type?: "documents_organizer_move_result";
  move_id: string;
  storage: "filesystem+mongodb";
  target_root: string;
  target_display_root: string;
  requested_move_count: number;
  moved_count: number;
  failed_count: number;
  skipped_count: number;
  content_indexed: boolean;
  physical_moves_performed: boolean;
  moved_files: DocumentsOrganizerMoveAction[];
  failed_files: DocumentsOrganizerMoveAction[];
  completed_at: string;
  summary: DocumentsOrganizerSummary;
  message: string;
}

interface DocumentsOrganizerDoclingImportResult {
  type?: "documents_organizer_docling_import";
  storage: "filesystem+mongodb+docling";
  source_file: DocumentsOrganizerFile;
  docling: DoclingImportResponse;
  content_indexed: boolean;
  physical_moves_performed: boolean;
  message: string;
}

interface DocumentsOrganizerBulkImportResult {
  file_id: string;
  filename: string;
  status: "imported" | "failed" | "skipped";
  document_id?: string;
  title?: string;
  error?: string;
}

type DocumentsOrganizerImportRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "cancelled";

type DocumentsOrganizerImportRunItemStatus =
  | "pending"
  | "importing"
  | "imported"
  | "failed"
  | "skipped";

interface DocumentsOrganizerImportRunItem {
  file_id: string;
  path_hash: string;
  filename: string;
  display_path: string;
  folder_key: string;
  folder_name: string;
  document_type: string;
  size_bytes: number;
  status: DocumentsOrganizerImportRunItemStatus;
  document_id: string;
  title: string;
  error: string;
  started_at: string | null;
  completed_at: string | null;
}

interface DocumentsOrganizerImportRun {
  id: string;
  type?: "documents_organizer_import_run";
  storage: "mongodb";
  status: DocumentsOrganizerImportRunStatus;
  requested_count: number;
  imported_count: number;
  failed_count: number;
  skipped_count: number;
  source: string;
  started_at: string | null;
  completed_at: string | null;
  items: DocumentsOrganizerImportRunItem[];
  content_indexed: boolean;
  message: string;
}

interface DocumentsOrganizerImportRunsResult {
  type?: "documents_organizer_import_runs";
  storage: "mongodb";
  limit: number;
  total_count: number;
  returned_count: number;
  runs: DocumentsOrganizerImportRun[];
  content_indexed: boolean;
  message: string;
}

interface DocumentsOrganizerImportPreviewSourceRoot {
  source_root: string;
  source_display_root: string;
  count: number;
  total_size_bytes: number;
  latest_modified_at: string | null;
}

interface DocumentsOrganizerImportPreview {
  type?: "documents_organizer_import_preview";
  storage: "mongodb";
  requested_count: number;
  preview_file_count: number;
  missing_file_count: number;
  total_size_bytes: number;
  max_file_size_bytes: number;
  oversized_file_count: number;
  estimated_docling_file_count: number;
  conversion_provider: string;
  conversion_exports: string[];
  requires_confirmation_phrase: string;
  content_indexed: boolean;
  physical_moves_performed: boolean;
  folders: DocumentsOrganizerFolder[];
  source_roots: DocumentsOrganizerImportPreviewSourceRoot[];
  files: DocumentsOrganizerFile[];
  file_sample_count: number;
  oversized_files: DocumentsOrganizerFile[];
  safeguards: string[];
  message: string;
}

interface DocumentsOrganizerSavedView {
  id: string;
  type?: "documents_organizer_saved_view";
  storage: "mongodb";
  name: string;
  folder_key: string;
  folder_name: string;
  source_root: string;
  source_display_root: string;
  search_query: string;
  sort_by: DocumentsOrganizerFileSortKey;
  view_key: string;
  last_opened_at: string | null;
  matched_file_count: number;
  matched_size_bytes: number;
  latest_modified_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  content_indexed: boolean;
}

interface DocumentsOrganizerSavedViewsResult {
  type?: "documents_organizer_saved_views";
  storage: "mongodb";
  limit: number;
  total_count: number;
  returned_count: number;
  views: DocumentsOrganizerSavedView[];
  content_indexed: boolean;
  message: string;
}

const DOCUMENTS_ORGANIZER_IMPORT_CONFIRMATION = "IMPORT FILES";

// ── Helpers ────────────────────────────────────────────────────────────

const DOC_TYPE_ICONS: Record<string, typeof FileText> = {
  document: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  default: File,
};

const DOC_TYPE_COLORS: Record<string, string> = {
  document: "#3b82f6",
  spreadsheet: "#22c55e",
  presentation: "#f59e0b",
  default: "#6b7280",
};

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#6b7280" },
  published: { label: "Published", color: "#22c55e" },
  archived: { label: "Archived", color: "#f59e0b" },
  review: { label: "In Review", color: "#8b5cf6" },
};

const CREATED_DOCUMENT_IDS_STORAGE_KEY = "streetbot:created-document-ids";
const REVIEW_COMMENTS_METADATA_KEY = "streetbot_review_comments";
const DOCUMENT_TEMPLATE_METADATA_KEY = "streetbot_template";
const DOCUMENT_LOCAL_VERSION_HISTORY_KEY = "streetbot:document-version-history:v1";
const DOCUMENT_LOCAL_VERSION_HISTORY_LIMIT = 30;
const DOCUMENT_DURABLE_VERSION_HISTORY_PATH = "/api/documents/history";

type DocumentExportFormat = "markdown" | "html" | "docx";
type CreateDocumentType = "document" | "spreadsheet" | "presentation";
type BuiltInDocumentTemplateId =
  | "blank"
  | "grant-proposal"
  | "case-note"
  | "meeting-minutes"
  | "policy-memo"
  | "program-report";

interface BuiltInDocumentTemplate {
  id: BuiltInDocumentTemplateId;
  title: string;
  category: string;
  description: string;
  suggestedTitle: string;
  content: Record<string, unknown>;
  contentText: string;
  tags: string[];
}

const DOCUMENT_EXPORT_OPTIONS: Array<{
  value: DocumentExportFormat;
  label: string;
  extension: string;
}> = [
  { value: "markdown", label: "Markdown", extension: ".md" },
  { value: "html", label: "HTML", extension: ".html" },
  { value: "docx", label: "Word", extension: ".docx" },
];

const DOCUMENT_VERSION_BACKUP_TYPE = "streetbot.documentVersionHistory";
const DOCUMENT_VERSION_BACKUP_SCHEMA_VERSION = 1;
const DOCUMENTS_ORGANIZER_FILE_PAGE_SIZE = 24;
const DOCUMENTS_ORGANIZER_DEFAULT_FILE_SORT = "modified_desc";
const DOCUMENTS_ORGANIZER_STAGE_LIMIT_OPTIONS = [24, 50, 100] as const;
const DOCUMENTS_ORGANIZER_FILE_SORT_OPTIONS = [
  { value: "modified_desc", label: "Newest" },
  { value: "modified_asc", label: "Oldest" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "name_desc", label: "Name Z-A" },
  { value: "size_desc", label: "Largest" },
  { value: "size_asc", label: "Smallest" },
  { value: "type_asc", label: "Type" },
] as const;
type DocumentsOrganizerFileSortKey = typeof DOCUMENTS_ORGANIZER_FILE_SORT_OPTIONS[number]["value"];

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function stringFromUnknown(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberFromUnknown(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function booleanFromUnknown(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function normalizeOrganizerFileSortKey(value: unknown): DocumentsOrganizerFileSortKey {
  const normalized = stringFromUnknown(value);
  return DOCUMENTS_ORGANIZER_FILE_SORT_OPTIONS.some(option => option.value === normalized)
    ? normalized as DocumentsOrganizerFileSortKey
    : DOCUMENTS_ORGANIZER_DEFAULT_FILE_SORT;
}

function organizerFileSortLabel(sortBy: DocumentsOrganizerFileSortKey): string {
  return DOCUMENTS_ORGANIZER_FILE_SORT_OPTIONS.find(option => option.value === sortBy)?.label || "Newest";
}

function recordFromUnknown(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function formatBytes(bytes: number): string {
  const normalizedBytes = Math.max(0, Number(bytes) || 0);
  if (normalizedBytes < 1024) return `${normalizedBytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = normalizedBytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function normalizeOrganizerFolder(value: unknown): DocumentsOrganizerFolder | null {
  const record = recordFromUnknown(value);
  if (!record) return null;
  const folderKey = stringFromUnknown(record.folder_key) || stringFromUnknown(record.folderKey);
  const folderName = stringFromUnknown(record.folder_name) || stringFromUnknown(record.folderName);
  if (!folderKey || !folderName) return null;

  return {
    folder_key: folderKey,
    folder_name: folderName,
    document_type: stringFromUnknown(record.document_type) || stringFromUnknown(record.documentType) || folderKey,
    count: numberFromUnknown(record.count),
    total_size_bytes: numberFromUnknown(record.total_size_bytes ?? record.totalSizeBytes),
    latest_modified_at: stringFromUnknown(record.latest_modified_at) || stringFromUnknown(record.latestModifiedAt) || null,
  };
}

function normalizeOrganizerFile(value: unknown): DocumentsOrganizerFile | null {
  const record = recordFromUnknown(value);
  if (!record) return null;
  const id = stringFromUnknown(record.id) || stringFromUnknown(record.path_hash) || stringFromUnknown(record.pathHash);
  const filename = stringFromUnknown(record.filename);
  if (!id || !filename) return null;

  return {
    id,
    filename,
    basename: stringFromUnknown(record.basename) || filename,
    extension: stringFromUnknown(record.extension) || "",
    document_type: stringFromUnknown(record.document_type) || stringFromUnknown(record.documentType) || "document",
    folder_key: stringFromUnknown(record.folder_key) || stringFromUnknown(record.folderKey) || "documents",
    folder_name: stringFromUnknown(record.folder_name) || stringFromUnknown(record.folderName) || "Documents",
    source_root: stringFromUnknown(record.source_root) || stringFromUnknown(record.sourceRoot) || undefined,
    source_path: stringFromUnknown(record.source_path) || stringFromUnknown(record.sourcePath) || undefined,
    display_path: stringFromUnknown(record.display_path) || stringFromUnknown(record.displayPath) || filename,
    relative_path: stringFromUnknown(record.relative_path) || stringFromUnknown(record.relativePath) || filename,
    size_bytes: numberFromUnknown(record.size_bytes ?? record.sizeBytes),
    modified_at: stringFromUnknown(record.modified_at) || stringFromUnknown(record.modifiedAt) || null,
    physical_move_performed: booleanFromUnknown(record.physical_move_performed ?? record.physicalMovePerformed),
  };
}

function normalizeOrganizerMoveAction(value: unknown): DocumentsOrganizerMoveAction | null {
  const record = recordFromUnknown(value);
  if (!record) return null;
  const fileId = stringFromUnknown(record.file_id) || stringFromUnknown(record.fileId);
  const filename = stringFromUnknown(record.filename);
  const targetDisplayPath = stringFromUnknown(record.target_display_path) || stringFromUnknown(record.targetDisplayPath);
  if (!fileId || !filename || !targetDisplayPath) return null;

  return {
    file_id: fileId,
    filename,
    folder_key: stringFromUnknown(record.folder_key) || stringFromUnknown(record.folderKey) || "documents",
    folder_name: stringFromUnknown(record.folder_name) || stringFromUnknown(record.folderName) || "Documents",
    source_display_path: stringFromUnknown(record.source_display_path) || stringFromUnknown(record.sourceDisplayPath) || filename,
    target_display_path: targetDisplayPath,
    target_display_folder: stringFromUnknown(record.target_display_folder) || stringFromUnknown(record.targetDisplayFolder) || "",
    size_bytes: numberFromUnknown(record.size_bytes ?? record.sizeBytes),
    collision_index: numberFromUnknown(record.collision_index ?? record.collisionIndex),
    action: "move",
    reason: stringFromUnknown(record.reason) || null,
  };
}

function normalizeOrganizerMoveSkippedFile(value: unknown): DocumentsOrganizerMoveSkippedFile | null {
  const record = recordFromUnknown(value);
  if (!record) return null;
  const fileId = stringFromUnknown(record.file_id) || stringFromUnknown(record.fileId);
  const filename = stringFromUnknown(record.filename);
  if (!fileId || !filename) return null;

  return {
    file_id: fileId,
    filename,
    folder_key: stringFromUnknown(record.folder_key) || stringFromUnknown(record.folderKey) || "documents",
    folder_name: stringFromUnknown(record.folder_name) || stringFromUnknown(record.folderName) || "Documents",
    document_type: stringFromUnknown(record.document_type) || stringFromUnknown(record.documentType) || "document",
    source_display_path: stringFromUnknown(record.source_display_path) || stringFromUnknown(record.sourceDisplayPath) || filename,
    size_bytes: numberFromUnknown(record.size_bytes ?? record.sizeBytes),
    action: "skip",
    reason: stringFromUnknown(record.reason) || "skipped",
  };
}

function normalizeOrganizerMoveSkippedReason(value: unknown): DocumentsOrganizerMoveSkippedReason | null {
  const record = recordFromUnknown(value);
  if (!record) return null;
  const reason = stringFromUnknown(record.reason);
  if (!reason) return null;

  return {
    reason,
    count: numberFromUnknown(record.count),
    total_size_bytes: numberFromUnknown(record.total_size_bytes ?? record.totalSizeBytes),
  };
}

function normalizeOrganizerSummary(value: unknown): DocumentsOrganizerSummary {
  const record = recordFromUnknown(value) || {};
  const rawFolders = Array.isArray(record.folders) ? record.folders : [];
  const rawRecentFiles = Array.isArray(record.recent_files)
    ? record.recent_files
    : Array.isArray(record.recentFiles) ? record.recentFiles : [];
  const rawRoots = Array.isArray(record.roots) ? record.roots : [];
  const rawSafeguards = Array.isArray(record.safeguards) ? record.safeguards : [];

  return {
    type: "documents_organizer_summary",
    storage: "mongodb",
    roots: rawRoots.map(item => stringFromUnknown(item)).filter((item): item is string => Boolean(item)),
    content_indexed: booleanFromUnknown(record.content_indexed ?? record.contentIndexed),
    physical_moves_performed: booleanFromUnknown(record.physical_moves_performed ?? record.physicalMovesPerformed),
    scanned_file_count: numberFromUnknown(record.scanned_file_count ?? record.scannedFileCount),
    missing_file_count: numberFromUnknown(record.missing_file_count ?? record.missingFileCount),
    moved_file_count: numberFromUnknown(record.moved_file_count ?? record.movedFileCount),
    folder_count: numberFromUnknown(record.folder_count ?? record.folderCount, rawFolders.length),
    total_size_bytes: numberFromUnknown(record.total_size_bytes ?? record.totalSizeBytes),
    latest_scan_at: stringFromUnknown(record.latest_scan_at) || stringFromUnknown(record.latestScanAt) || null,
    folders: rawFolders.map(normalizeOrganizerFolder).filter((folder): folder is DocumentsOrganizerFolder => Boolean(folder)),
    recent_files: rawRecentFiles.map(normalizeOrganizerFile).filter((file): file is DocumentsOrganizerFile => Boolean(file)),
    safeguards: rawSafeguards.map(item => stringFromUnknown(item)).filter((item): item is string => Boolean(item)),
    message: stringFromUnknown(record.message) || "Local document metadata is ready for organization.",
  };
}

function normalizeOrganizerFilesResult(value: unknown): DocumentsOrganizerFilesResult {
  const record = recordFromUnknown(value) || {};
  const rawFiles = Array.isArray(record.files) ? record.files : [];

  return {
    type: "documents_organizer_files",
    storage: "mongodb",
    folder_key: stringFromUnknown(record.folder_key) || stringFromUnknown(record.folderKey) || "all",
    source_root: stringFromUnknown(record.source_root) || stringFromUnknown(record.sourceRoot) || "",
    source_display_root: stringFromUnknown(record.source_display_root) || stringFromUnknown(record.sourceDisplayRoot) || "",
    query: stringFromUnknown(record.query) || "",
    sort_by: normalizeOrganizerFileSortKey(record.sort_by ?? record.sortBy),
    limit: numberFromUnknown(record.limit, DOCUMENTS_ORGANIZER_FILE_PAGE_SIZE),
    offset: numberFromUnknown(record.offset),
    next_offset: numberFromUnknown(record.next_offset ?? record.nextOffset, rawFiles.length),
    has_more: booleanFromUnknown(record.has_more ?? record.hasMore),
    total_count: numberFromUnknown(record.total_count ?? record.totalCount, rawFiles.length),
    returned_count: numberFromUnknown(record.returned_count ?? record.returnedCount, rawFiles.length),
    files: rawFiles.map(normalizeOrganizerFile).filter((file): file is DocumentsOrganizerFile => Boolean(file)),
    content_indexed: booleanFromUnknown(record.content_indexed ?? record.contentIndexed),
    message: stringFromUnknown(record.message) || "Indexed local files are ready.",
  };
}

function normalizeOrganizerSourceCollection(value: unknown): DocumentsOrganizerSourceCollection | null {
  const record = recordFromUnknown(value);
  if (!record) return null;
  const sourceRoot = stringFromUnknown(record.source_root) || stringFromUnknown(record.sourceRoot);
  const sourceDisplayRoot = stringFromUnknown(record.source_display_root) || stringFromUnknown(record.sourceDisplayRoot) || sourceRoot;
  const rawFolders = Array.isArray(record.folders) ? record.folders : [];
  if (!sourceRoot || !sourceDisplayRoot) return null;

  return {
    source_root: sourceRoot,
    source_display_root: sourceDisplayRoot,
    count: numberFromUnknown(record.count),
    total_size_bytes: numberFromUnknown(record.total_size_bytes ?? record.totalSizeBytes),
    latest_modified_at: stringFromUnknown(record.latest_modified_at) || stringFromUnknown(record.latestModifiedAt) || null,
    folder_count: numberFromUnknown(record.folder_count ?? record.folderCount),
    folders: rawFolders.map(normalizeOrganizerFolder).filter((folder): folder is DocumentsOrganizerFolder => Boolean(folder)),
  };
}

function normalizeOrganizerCollectionsResult(value: unknown): DocumentsOrganizerCollectionsResult {
  const record = recordFromUnknown(value) || {};
  const rawSourceRoots = Array.isArray(record.source_roots)
    ? record.source_roots
    : Array.isArray(record.sourceRoots) ? record.sourceRoots : [];
  const rawDocumentTypes = Array.isArray(record.document_types)
    ? record.document_types
    : Array.isArray(record.documentTypes) ? record.documentTypes : [];
  const rawSafeguards = Array.isArray(record.safeguards) ? record.safeguards : [];
  const sourceRoots = rawSourceRoots
    .map(normalizeOrganizerSourceCollection)
    .filter((collection): collection is DocumentsOrganizerSourceCollection => Boolean(collection));
  const documentTypes = rawDocumentTypes
    .map(normalizeOrganizerFolder)
    .filter((folder): folder is DocumentsOrganizerFolder => Boolean(folder));

  return {
    type: "documents_organizer_collections",
    storage: "mongodb",
    content_indexed: booleanFromUnknown(record.content_indexed ?? record.contentIndexed),
    physical_moves_performed: booleanFromUnknown(record.physical_moves_performed ?? record.physicalMovesPerformed),
    scanned_file_count: numberFromUnknown(record.scanned_file_count ?? record.scannedFileCount),
    total_size_bytes: numberFromUnknown(record.total_size_bytes ?? record.totalSizeBytes),
    source_root_count: numberFromUnknown(record.source_root_count ?? record.sourceRootCount, sourceRoots.length),
    document_type_count: numberFromUnknown(record.document_type_count ?? record.documentTypeCount, documentTypes.length),
    returned_source_root_count: numberFromUnknown(record.returned_source_root_count ?? record.returnedSourceRootCount, sourceRoots.length),
    returned_document_type_count: numberFromUnknown(record.returned_document_type_count ?? record.returnedDocumentTypeCount, documentTypes.length),
    latest_scan_at: stringFromUnknown(record.latest_scan_at) || stringFromUnknown(record.latestScanAt) || null,
    physical_target_root: stringFromUnknown(record.physical_target_root) || stringFromUnknown(record.physicalTargetRoot) || "",
    physical_target_display_root: stringFromUnknown(record.physical_target_display_root) || stringFromUnknown(record.physicalTargetDisplayRoot) || "",
    source_roots: sourceRoots,
    document_types: documentTypes,
    safeguards: rawSafeguards.map(item => stringFromUnknown(item)).filter((item): item is string => Boolean(item)),
    message: stringFromUnknown(record.message) || "Organizer collections are ready.",
  };
}

function normalizeOrganizerRecommendation(value: unknown): DocumentsOrganizerRecommendation | null {
  const record = recordFromUnknown(value);
  if (!record) return null;
  const id = stringFromUnknown(record.id);
  const name = stringFromUnknown(record.name);
  if (!id || !name) return null;
  const rawSampleFiles = Array.isArray(record.sample_files)
    ? record.sample_files
    : Array.isArray(record.sampleFiles) ? record.sampleFiles : [];

  return {
    id,
    name,
    description: stringFromUnknown(record.description) || "",
    reason: stringFromUnknown(record.reason) || "",
    folder_key: stringFromUnknown(record.folder_key) || stringFromUnknown(record.folderKey) || "all",
    folder_name: stringFromUnknown(record.folder_name) || stringFromUnknown(record.folderName) || "All local files",
    source_root: stringFromUnknown(record.source_root) || stringFromUnknown(record.sourceRoot) || undefined,
    source_display_root: stringFromUnknown(record.source_display_root) || stringFromUnknown(record.sourceDisplayRoot) || undefined,
    search_query: stringFromUnknown(record.search_query) || stringFromUnknown(record.searchQuery) || "",
    sort_by: normalizeOrganizerFileSortKey(record.sort_by ?? record.sortBy),
    matched_file_count: numberFromUnknown(record.matched_file_count ?? record.matchedFileCount),
    total_size_bytes: numberFromUnknown(record.total_size_bytes ?? record.totalSizeBytes),
    latest_modified_at: stringFromUnknown(record.latest_modified_at) || stringFromUnknown(record.latestModifiedAt) || null,
    priority: numberFromUnknown(record.priority),
    sample_files: rawSampleFiles.map(normalizeOrganizerFile).filter((file): file is DocumentsOrganizerFile => Boolean(file)),
  };
}

function normalizeOrganizerRecommendationsResult(value: unknown): DocumentsOrganizerRecommendationsResult {
  const record = recordFromUnknown(value) || {};
  const rawRecommendations = Array.isArray(record.recommendations) ? record.recommendations : [];
  const rawSafeguards = Array.isArray(record.safeguards) ? record.safeguards : [];
  const recommendations = rawRecommendations
    .map(normalizeOrganizerRecommendation)
    .filter((recommendation): recommendation is DocumentsOrganizerRecommendation => Boolean(recommendation));

  return {
    type: "documents_organizer_recommendations",
    storage: "mongodb",
    scanned_file_count: numberFromUnknown(record.scanned_file_count ?? record.scannedFileCount),
    total_candidate_count: numberFromUnknown(record.total_candidate_count ?? record.totalCandidateCount, recommendations.length),
    returned_count: numberFromUnknown(record.returned_count ?? record.returnedCount, recommendations.length),
    recommendations,
    content_indexed: booleanFromUnknown(record.content_indexed ?? record.contentIndexed),
    physical_moves_performed: booleanFromUnknown(record.physical_moves_performed ?? record.physicalMovesPerformed),
    safeguards: rawSafeguards.map(item => stringFromUnknown(item)).filter((item): item is string => Boolean(item)),
    message: stringFromUnknown(record.message) || "Organizer recommendations are ready.",
  };
}

function normalizeOrganizerDuplicateGroup(value: unknown): DocumentsOrganizerDuplicateGroup | null {
  const record = recordFromUnknown(value);
  if (!record) return null;
  const rawFiles = Array.isArray(record.files) ? record.files : [];
  const files = rawFiles.map(normalizeOrganizerFile).filter((file): file is DocumentsOrganizerFile => Boolean(file));
  const duplicateKey = stringFromUnknown(record.duplicate_key) || stringFromUnknown(record.duplicateKey);
  const filename = stringFromUnknown(record.filename) || files[0]?.filename || duplicateKey;
  if (!filename) return null;

  return {
    duplicate_key: duplicateKey || `${filename.toLowerCase()}:${numberFromUnknown(record.size_bytes ?? record.sizeBytes)}`,
    filename,
    size_bytes: numberFromUnknown(record.size_bytes ?? record.sizeBytes),
    count: numberFromUnknown(record.count, files.length),
    duplicate_size_bytes: numberFromUnknown(record.duplicate_size_bytes ?? record.duplicateSizeBytes),
    latest_modified_at: stringFromUnknown(record.latest_modified_at) || stringFromUnknown(record.latestModifiedAt) || null,
    hidden_file_count: numberFromUnknown(record.hidden_file_count ?? record.hiddenFileCount),
    files,
  };
}

function normalizeOrganizerDuplicatesResult(value: unknown): DocumentsOrganizerDuplicatesResult {
  const record = recordFromUnknown(value) || {};
  const rawGroups = Array.isArray(record.groups) ? record.groups : [];
  const rawSafeguards = Array.isArray(record.safeguards) ? record.safeguards : [];
  const groups = rawGroups
    .map(normalizeOrganizerDuplicateGroup)
    .filter((group): group is DocumentsOrganizerDuplicateGroup => Boolean(group));

  return {
    type: "documents_organizer_duplicates",
    storage: "mongodb",
    duplicate_group_count: numberFromUnknown(record.duplicate_group_count ?? record.duplicateGroupCount, groups.length),
    returned_group_count: numberFromUnknown(record.returned_group_count ?? record.returnedGroupCount, groups.length),
    duplicate_file_count: numberFromUnknown(record.duplicate_file_count ?? record.duplicateFileCount),
    reclaimable_size_bytes: numberFromUnknown(record.reclaimable_size_bytes ?? record.reclaimableSizeBytes),
    include_project_files: booleanFromUnknown(record.include_project_files ?? record.includeProjectFiles),
    include_technical_files: booleanFromUnknown(record.include_technical_files ?? record.includeTechnicalFiles ?? record.include_project_files ?? record.includeProjectFiles),
    project_filter_applied: booleanFromUnknown(record.project_filter_applied ?? record.projectFilterApplied, true),
    technical_filter_applied: booleanFromUnknown(record.technical_filter_applied ?? record.technicalFilterApplied ?? record.project_filter_applied ?? record.projectFilterApplied, true),
    groups,
    content_indexed: booleanFromUnknown(record.content_indexed ?? record.contentIndexed),
    safeguards: rawSafeguards.map(item => stringFromUnknown(item)).filter((item): item is string => Boolean(item)),
    message: stringFromUnknown(record.message) || "Duplicate metadata is ready.",
  };
}

function normalizeOrganizerMovePlan(value: unknown): DocumentsOrganizerMovePlan {
  const record = recordFromUnknown(value) || {};
  const rawFolders = Array.isArray(record.folders) ? record.folders : [];
  const rawActions = Array.isArray(record.actions) ? record.actions : [];
  const rawSkippedReasons = Array.isArray(record.skipped_reason_counts)
    ? record.skipped_reason_counts
    : Array.isArray(record.skippedReasonCounts) ? record.skippedReasonCounts : [];
  const rawSkippedFiles = Array.isArray(record.skipped_files)
    ? record.skipped_files
    : Array.isArray(record.skippedFiles) ? record.skippedFiles : [];
  const rawSafeguards = Array.isArray(record.safeguards) ? record.safeguards : [];

  return {
    type: "documents_organizer_move_plan",
    storage: "filesystem+mongodb",
    target_root: stringFromUnknown(record.target_root) || stringFromUnknown(record.targetRoot) || "",
    target_display_root: stringFromUnknown(record.target_display_root) || stringFromUnknown(record.targetDisplayRoot) || "",
    confirmation_phrase: stringFromUnknown(record.confirmation_phrase) || stringFromUnknown(record.confirmationPhrase) || "MOVE FILES",
    requires_confirmation: booleanFromUnknown(record.requires_confirmation ?? record.requiresConfirmation, true),
    scanned_file_count: numberFromUnknown(record.scanned_file_count ?? record.scannedFileCount),
    move_count: numberFromUnknown(record.move_count ?? record.moveCount),
    skipped_count: numberFromUnknown(record.skipped_count ?? record.skippedCount),
    already_organized_count: numberFromUnknown(record.already_organized_count ?? record.alreadyOrganizedCount),
    project_file_skipped_count: numberFromUnknown(record.project_file_skipped_count ?? record.projectFileSkippedCount),
    collision_count: numberFromUnknown(record.collision_count ?? record.collisionCount),
    folder_count: numberFromUnknown(record.folder_count ?? record.folderCount, rawFolders.length),
    total_size_bytes: numberFromUnknown(record.total_size_bytes ?? record.totalSizeBytes),
    content_indexed: booleanFromUnknown(record.content_indexed ?? record.contentIndexed),
    physical_moves_performed: booleanFromUnknown(record.physical_moves_performed ?? record.physicalMovesPerformed),
    folders: rawFolders.map(normalizeOrganizerFolder).filter((folder): folder is DocumentsOrganizerFolder => Boolean(folder)),
    actions: rawActions.map(normalizeOrganizerMoveAction).filter((action): action is DocumentsOrganizerMoveAction => Boolean(action)),
    action_sample_count: numberFromUnknown(record.action_sample_count ?? record.actionSampleCount, rawActions.length),
    skipped_reason_counts: rawSkippedReasons
      .map(normalizeOrganizerMoveSkippedReason)
      .filter((reason): reason is DocumentsOrganizerMoveSkippedReason => Boolean(reason)),
    skipped_files: rawSkippedFiles
      .map(normalizeOrganizerMoveSkippedFile)
      .filter((file): file is DocumentsOrganizerMoveSkippedFile => Boolean(file)),
    skipped_file_sample_count: numberFromUnknown(record.skipped_file_sample_count ?? record.skippedFileSampleCount, rawSkippedFiles.length),
    safeguards: rawSafeguards.map(item => stringFromUnknown(item)).filter((item): item is string => Boolean(item)),
    message: stringFromUnknown(record.message) || "Physical organization preview is ready.",
  };
}

function normalizeOrganizerImportRunItem(value: unknown): DocumentsOrganizerImportRunItem | null {
  const record = recordFromUnknown(value);
  if (!record) return null;
  const fileId = stringFromUnknown(record.file_id) || stringFromUnknown(record.fileId);
  const filename = stringFromUnknown(record.filename);
  if (!fileId || !filename) return null;

  const rawStatus = stringFromUnknown(record.status) || "pending";
  const status: DocumentsOrganizerImportRunItemStatus = (
    rawStatus === "importing" ||
    rawStatus === "imported" ||
    rawStatus === "failed" ||
    rawStatus === "skipped"
  ) ? rawStatus : "pending";

  return {
    file_id: fileId,
    path_hash: stringFromUnknown(record.path_hash) || stringFromUnknown(record.pathHash) || "",
    filename,
    display_path: stringFromUnknown(record.display_path) || stringFromUnknown(record.displayPath) || filename,
    folder_key: stringFromUnknown(record.folder_key) || stringFromUnknown(record.folderKey) || "documents",
    folder_name: stringFromUnknown(record.folder_name) || stringFromUnknown(record.folderName) || "Documents",
    document_type: stringFromUnknown(record.document_type) || stringFromUnknown(record.documentType) || "document",
    size_bytes: numberFromUnknown(record.size_bytes ?? record.sizeBytes),
    status,
    document_id: stringFromUnknown(record.document_id) || stringFromUnknown(record.documentId) || "",
    title: stringFromUnknown(record.title) || "",
    error: stringFromUnknown(record.error) || "",
    started_at: stringFromUnknown(record.started_at) || stringFromUnknown(record.startedAt) || null,
    completed_at: stringFromUnknown(record.completed_at) || stringFromUnknown(record.completedAt) || null,
  };
}

function normalizeOrganizerImportRun(value: unknown): DocumentsOrganizerImportRun | null {
  const record = recordFromUnknown(value);
  if (!record) return null;
  const id = stringFromUnknown(record.id);
  if (!id) return null;
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const rawStatus = stringFromUnknown(record.status) || "pending";
  const status: DocumentsOrganizerImportRunStatus = (
    rawStatus === "running" ||
    rawStatus === "completed" ||
    rawStatus === "completed_with_errors" ||
    rawStatus === "failed" ||
    rawStatus === "cancelled"
  ) ? rawStatus : "pending";

  return {
    id,
    type: "documents_organizer_import_run",
    storage: "mongodb",
    status,
    requested_count: numberFromUnknown(record.requested_count ?? record.requestedCount, rawItems.length),
    imported_count: numberFromUnknown(record.imported_count ?? record.importedCount),
    failed_count: numberFromUnknown(record.failed_count ?? record.failedCount),
    skipped_count: numberFromUnknown(record.skipped_count ?? record.skippedCount),
    source: stringFromUnknown(record.source) || "documents-organizer",
    started_at: stringFromUnknown(record.started_at) || stringFromUnknown(record.startedAt) || null,
    completed_at: stringFromUnknown(record.completed_at) || stringFromUnknown(record.completedAt) || null,
    items: rawItems.map(normalizeOrganizerImportRunItem).filter((item): item is DocumentsOrganizerImportRunItem => Boolean(item)),
    content_indexed: booleanFromUnknown(record.content_indexed ?? record.contentIndexed),
    message: stringFromUnknown(record.message) || "Organizer import run is ready.",
  };
}

function normalizeOrganizerImportRunsResult(value: unknown): DocumentsOrganizerImportRunsResult {
  const record = recordFromUnknown(value) || {};
  const rawRuns = Array.isArray(record.runs) ? record.runs : [];
  const runs = rawRuns.map(normalizeOrganizerImportRun).filter((run): run is DocumentsOrganizerImportRun => Boolean(run));

  return {
    type: "documents_organizer_import_runs",
    storage: "mongodb",
    limit: numberFromUnknown(record.limit, 6),
    total_count: numberFromUnknown(record.total_count ?? record.totalCount, runs.length),
    returned_count: numberFromUnknown(record.returned_count ?? record.returnedCount, runs.length),
    runs,
    content_indexed: booleanFromUnknown(record.content_indexed ?? record.contentIndexed),
    message: stringFromUnknown(record.message) || "Recent organizer imports are ready.",
  };
}

function normalizeOrganizerImportPreviewSourceRoot(value: unknown): DocumentsOrganizerImportPreviewSourceRoot | null {
  const record = recordFromUnknown(value);
  if (!record) return null;
  const sourceRoot = stringFromUnknown(record.source_root) || stringFromUnknown(record.sourceRoot);
  if (!sourceRoot) return null;

  return {
    source_root: sourceRoot,
    source_display_root: stringFromUnknown(record.source_display_root) || stringFromUnknown(record.sourceDisplayRoot) || sourceRoot,
    count: numberFromUnknown(record.count),
    total_size_bytes: numberFromUnknown(record.total_size_bytes ?? record.totalSizeBytes),
    latest_modified_at: stringFromUnknown(record.latest_modified_at) || stringFromUnknown(record.latestModifiedAt) || null,
  };
}

function normalizeOrganizerImportPreview(value: unknown): DocumentsOrganizerImportPreview {
  const record = recordFromUnknown(value) || {};
  const rawFolders = Array.isArray(record.folders) ? record.folders : [];
  const rawSourceRoots = Array.isArray(record.source_roots)
    ? record.source_roots
    : Array.isArray(record.sourceRoots) ? record.sourceRoots : [];
  const rawFiles = Array.isArray(record.files) ? record.files : [];
  const rawOversizedFiles = Array.isArray(record.oversized_files)
    ? record.oversized_files
    : Array.isArray(record.oversizedFiles) ? record.oversizedFiles : [];
  const rawExports = Array.isArray(record.conversion_exports)
    ? record.conversion_exports
    : Array.isArray(record.conversionExports) ? record.conversionExports : [];
  const rawSafeguards = Array.isArray(record.safeguards) ? record.safeguards : [];
  const files = rawFiles.map(normalizeOrganizerFile).filter((file): file is DocumentsOrganizerFile => Boolean(file));

  return {
    type: "documents_organizer_import_preview",
    storage: "mongodb",
    requested_count: numberFromUnknown(record.requested_count ?? record.requestedCount),
    preview_file_count: numberFromUnknown(record.preview_file_count ?? record.previewFileCount, files.length),
    missing_file_count: numberFromUnknown(record.missing_file_count ?? record.missingFileCount),
    total_size_bytes: numberFromUnknown(record.total_size_bytes ?? record.totalSizeBytes),
    max_file_size_bytes: numberFromUnknown(record.max_file_size_bytes ?? record.maxFileSizeBytes),
    oversized_file_count: numberFromUnknown(record.oversized_file_count ?? record.oversizedFileCount),
    estimated_docling_file_count: numberFromUnknown(record.estimated_docling_file_count ?? record.estimatedDoclingFileCount),
    conversion_provider: stringFromUnknown(record.conversion_provider) || stringFromUnknown(record.conversionProvider) || "docling",
    conversion_exports: rawExports.map(item => stringFromUnknown(item)).filter((item): item is string => Boolean(item)),
    requires_confirmation_phrase: stringFromUnknown(record.requires_confirmation_phrase) || stringFromUnknown(record.requiresConfirmationPhrase) || DOCUMENTS_ORGANIZER_IMPORT_CONFIRMATION,
    content_indexed: booleanFromUnknown(record.content_indexed ?? record.contentIndexed),
    physical_moves_performed: booleanFromUnknown(record.physical_moves_performed ?? record.physicalMovesPerformed),
    folders: rawFolders.map(normalizeOrganizerFolder).filter((folder): folder is DocumentsOrganizerFolder => Boolean(folder)),
    source_roots: rawSourceRoots
      .map(normalizeOrganizerImportPreviewSourceRoot)
      .filter((source): source is DocumentsOrganizerImportPreviewSourceRoot => Boolean(source)),
    files,
    file_sample_count: numberFromUnknown(record.file_sample_count ?? record.fileSampleCount, files.length),
    oversized_files: rawOversizedFiles.map(normalizeOrganizerFile).filter((file): file is DocumentsOrganizerFile => Boolean(file)),
    safeguards: rawSafeguards.map(item => stringFromUnknown(item)).filter((item): item is string => Boolean(item)),
    message: stringFromUnknown(record.message) || "Import preview is ready.",
  };
}

function normalizeOrganizerSavedView(value: unknown): DocumentsOrganizerSavedView | null {
  const record = recordFromUnknown(value);
  if (!record) return null;
  const id = stringFromUnknown(record.id);
  const name = stringFromUnknown(record.name);
  if (!id || !name) return null;

  return {
    id,
    type: "documents_organizer_saved_view",
    storage: "mongodb",
    name,
    folder_key: stringFromUnknown(record.folder_key) || stringFromUnknown(record.folderKey) || "all",
    folder_name: stringFromUnknown(record.folder_name) || stringFromUnknown(record.folderName) || "All local files",
    source_root: stringFromUnknown(record.source_root) || stringFromUnknown(record.sourceRoot) || "",
    source_display_root: stringFromUnknown(record.source_display_root) || stringFromUnknown(record.sourceDisplayRoot) || "",
    search_query: stringFromUnknown(record.search_query) || stringFromUnknown(record.searchQuery) || "",
    sort_by: normalizeOrganizerFileSortKey(record.sort_by ?? record.sortBy),
    view_key: stringFromUnknown(record.view_key) || stringFromUnknown(record.viewKey) || "",
    last_opened_at: stringFromUnknown(record.last_opened_at) || stringFromUnknown(record.lastOpenedAt) || null,
    matched_file_count: numberFromUnknown(record.matched_file_count ?? record.matchedFileCount),
    matched_size_bytes: numberFromUnknown(record.matched_size_bytes ?? record.matchedSizeBytes),
    latest_modified_at: stringFromUnknown(record.latest_modified_at) || stringFromUnknown(record.latestModifiedAt) || null,
    created_at: stringFromUnknown(record.created_at) || stringFromUnknown(record.createdAt) || null,
    updated_at: stringFromUnknown(record.updated_at) || stringFromUnknown(record.updatedAt) || null,
    content_indexed: booleanFromUnknown(record.content_indexed ?? record.contentIndexed),
  };
}

function normalizeOrganizerSavedViewsResult(value: unknown): DocumentsOrganizerSavedViewsResult {
  const record = recordFromUnknown(value) || {};
  const rawViews = Array.isArray(record.views) ? record.views : [];
  const views = rawViews
    .map(normalizeOrganizerSavedView)
    .filter((view): view is DocumentsOrganizerSavedView => Boolean(view));

  return {
    type: "documents_organizer_saved_views",
    storage: "mongodb",
    limit: numberFromUnknown(record.limit, 8),
    total_count: numberFromUnknown(record.total_count ?? record.totalCount, views.length),
    returned_count: numberFromUnknown(record.returned_count ?? record.returnedCount, views.length),
    views,
    content_indexed: booleanFromUnknown(record.content_indexed ?? record.contentIndexed),
    message: stringFromUnknown(record.message) || "Saved organizer views are ready.",
  };
}

function organizerFileFromImportRunItem(item: DocumentsOrganizerImportRunItem): DocumentsOrganizerFile {
  const extension = item.filename.toLowerCase().match(/(\.[a-z0-9]+)$/)?.[1] || "";

  return {
    id: item.file_id,
    filename: item.filename,
    basename: extension ? item.filename.slice(0, -extension.length) : item.filename,
    extension,
    document_type: item.document_type,
    folder_key: item.folder_key,
    folder_name: item.folder_name,
    display_path: item.display_path || item.filename,
    relative_path: item.display_path || item.filename,
    size_bytes: item.size_bytes,
    modified_at: null,
    physical_move_performed: false,
  };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeDocumentVersionSource(value: unknown): DocumentVersion["source"] {
  if (value === "local") return "local";
  if (value === "durable" || value === "backend") return "durable";
  return "server";
}

function normalizeDocumentVersionRetentionPolicy(value: unknown): DocumentVersion["retention_policy"] | undefined {
  const normalized = typeof value === "string" ? value.trim().replace(/_/g, "-").toLowerCase() : "";
  if (!normalized) return undefined;
  if (normalized === "keep-latest" || normalized === "keep-forever" || normalized === "retain-until") {
    return normalized;
  }
  return normalized;
}

function documentVersionRetentionPolicyValue(version: DocumentVersion): DocumentVersionRetentionPolicy {
  const normalized = normalizeDocumentVersionRetentionPolicy(version.retention_policy);
  if (normalized === "keep-forever" || normalized === "retain-until") {
    return normalized;
  }
  return "keep-latest";
}

function defaultDocumentVersionRetainedUntil(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
}

function documentVersionRetainedUntilDateValue(version: DocumentVersion): string {
  const date = version.retained_until ? new Date(version.retained_until) : new Date(defaultDocumentVersionRetainedUntil());
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function retainedUntilDateInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeDocumentVersion(raw: unknown, index: number): DocumentVersion | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const versionNumber = Number(record.version_number ?? record.versionNumber ?? index + 1);
  const contentRecord = recordFromUnknown(record.content);
  const metadataRecord = recordFromUnknown(record.metadata);
  const createdAt =
    stringFromUnknown(record.created_at) ||
    stringFromUnknown(record.createdAt) ||
    stringFromUnknown(record.updated_at) ||
    new Date().toISOString();
  const id =
    stringFromUnknown(record.id) ||
    stringFromUnknown(record._id) ||
    stringFromUnknown(record.version_id) ||
    `version-${versionNumber}-${createdAt}`;

  return {
    id,
    document_id: stringFromUnknown(record.document_id) || stringFromUnknown(record.documentId),
    version_number: Number.isFinite(versionNumber) ? versionNumber : index + 1,
    schema_version: Number.isFinite(Number(record.schema_version ?? record.schemaVersion))
      ? Number(record.schema_version ?? record.schemaVersion)
      : undefined,
    title: stringFromUnknown(record.title) || `Version ${Number.isFinite(versionNumber) ? versionNumber : index + 1}`,
    word_count: Number.isFinite(Number(record.word_count)) ? Number(record.word_count) : undefined,
    change_note: stringFromUnknown(record.change_note) || stringFromUnknown(record.changeNote),
    change_type: stringFromUnknown(record.change_type) || stringFromUnknown(record.changeType),
    retention_policy: normalizeDocumentVersionRetentionPolicy(record.retention_policy ?? record.retentionPolicy),
    retained_until: stringFromUnknown(record.retained_until) || stringFromUnknown(record.retainedUntil) || null,
    origin: stringFromUnknown(record.origin),
    client_snapshot_id: stringFromUnknown(record.client_snapshot_id) || stringFromUnknown(record.clientSnapshotId),
    source_version_id: stringFromUnknown(record.source_version_id) || stringFromUnknown(record.sourceVersionId),
    content_hash: stringFromUnknown(record.content_hash) || stringFromUnknown(record.contentHash),
    author_id: stringFromUnknown(record.author_id) || stringFromUnknown(record.authorId),
    created_at: createdAt,
    source: normalizeDocumentVersionSource(record.source),
    content: contentRecord || (record.content === null ? null : undefined),
    content_text: stringFromUnknown(record.content_text) || stringFromUnknown(record.contentText),
    metadata: metadataRecord,
    updated_at: stringFromUnknown(record.updated_at) || stringFromUnknown(record.updatedAt),
  };
}

function normalizeDocumentVersions(payload: unknown): DocumentVersion[] {
  const records = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { versions?: unknown }).versions)
      ? (payload as { versions: unknown[] }).versions
      : [];

  return records
    .map((record, index) => normalizeDocumentVersion(record, index))
    .filter((version): version is DocumentVersion => Boolean(version))
    .sort(compareDocumentVersions);
}

function normalizeRetentionReportEntries<T extends string>(
  value: unknown,
  key: T
): Array<Record<T, string | number> & { count: number }> {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => {
      const record = recordFromUnknown(item);
      if (!record) return null;
      const rawValue = record[key];
      const normalizedValue = typeof rawValue === "number"
        ? rawValue
        : stringFromUnknown(rawValue);
      if (normalizedValue === undefined) return null;

      return {
        [key]: normalizedValue,
        count: numberFromUnknown(record.count),
      } as Record<T, string | number> & { count: number };
    })
    .filter((entry): entry is Record<T, string | number> & { count: number } => Boolean(entry));
}

function normalizeDocumentVersionRetentionReport(value: unknown): DocumentVersionRetentionReport | null {
  const record = recordFromUnknown(value);
  if (!record) return null;

  return {
    schema_version: Number.isFinite(Number(record.schema_version ?? record.schemaVersion))
      ? Number(record.schema_version ?? record.schemaVersion)
      : undefined,
    max_snapshots: numberFromUnknown(record.max_snapshots ?? record.maxSnapshots, 100),
    total_count: numberFromUnknown(record.total_count ?? record.totalCount),
    keep_latest_count: numberFromUnknown(record.keep_latest_count ?? record.keepLatestCount),
    keep_forever_count: numberFromUnknown(record.keep_forever_count ?? record.keepForeverCount),
    retain_until_count: numberFromUnknown(record.retain_until_count ?? record.retainUntilCount),
    active_retain_until_count: numberFromUnknown(record.active_retain_until_count ?? record.activeRetainUntilCount),
    expired_retain_until_count: numberFromUnknown(record.expired_retain_until_count ?? record.expiredRetainUntilCount),
    protected_count: numberFromUnknown(record.protected_count ?? record.protectedCount),
    prunable_count: numberFromUnknown(record.prunable_count ?? record.prunableCount),
    over_limit_count: numberFromUnknown(record.over_limit_count ?? record.overLimitCount),
    oldest_snapshot_at: stringFromUnknown(record.oldest_snapshot_at) || stringFromUnknown(record.oldestSnapshotAt) || null,
    newest_snapshot_at: stringFromUnknown(record.newest_snapshot_at) || stringFromUnknown(record.newestSnapshotAt) || null,
    origins: normalizeRetentionReportEntries(record.origins, "origin")
      .map(entry => ({ origin: String(entry.origin), count: entry.count })),
    schema_versions: normalizeRetentionReportEntries(record.schema_versions ?? record.schemaVersions, "schema_version")
      .map(entry => ({ schema_version: Number(entry.schema_version), count: entry.count }))
      .filter(entry => Number.isFinite(entry.schema_version)),
  };
}

function documentVersionRetentionReportFromPayload(payload: unknown): DocumentVersionRetentionReport | null {
  const record = recordFromUnknown(payload);
  if (!record) return null;
  return normalizeDocumentVersionRetentionReport(record.retention_report ?? record.retentionReport);
}

function normalizeDocumentVersionRetentionTrendBucket(value: unknown): DocumentVersionRetentionTrendBucket | null {
  const record = recordFromUnknown(value);
  const date = record ? stringFromUnknown(record.date) : undefined;
  if (!record || !date) return null;

  return {
    date,
    start_at: stringFromUnknown(record.start_at) || stringFromUnknown(record.startAt),
    end_at: stringFromUnknown(record.end_at) || stringFromUnknown(record.endAt),
    created_count: numberFromUnknown(record.created_count ?? record.createdCount),
    cumulative_count: numberFromUnknown(record.cumulative_count ?? record.cumulativeCount),
    keep_latest_count: numberFromUnknown(record.keep_latest_count ?? record.keepLatestCount),
    keep_forever_count: numberFromUnknown(record.keep_forever_count ?? record.keepForeverCount),
    retain_until_count: numberFromUnknown(record.retain_until_count ?? record.retainUntilCount),
    active_retain_until_count: numberFromUnknown(record.active_retain_until_count ?? record.activeRetainUntilCount),
    expired_retain_until_count: numberFromUnknown(record.expired_retain_until_count ?? record.expiredRetainUntilCount),
    protected_count: numberFromUnknown(record.protected_count ?? record.protectedCount),
    prunable_count: numberFromUnknown(record.prunable_count ?? record.prunableCount),
    over_limit_count: numberFromUnknown(record.over_limit_count ?? record.overLimitCount),
    top_origin: stringFromUnknown(record.top_origin) || stringFromUnknown(record.topOrigin) || null,
    top_origin_count: numberFromUnknown(record.top_origin_count ?? record.topOriginCount),
  };
}

function normalizeDocumentVersionRetentionTrendReport(value: unknown): DocumentVersionRetentionTrendReport | null {
  const record = recordFromUnknown(value);
  const windowRecord = recordFromUnknown(record?.window);
  const buckets = Array.isArray(record?.buckets)
    ? record.buckets
      .map(normalizeDocumentVersionRetentionTrendBucket)
      .filter((bucket): bucket is DocumentVersionRetentionTrendBucket => Boolean(bucket))
    : [];

  if (!record || !windowRecord || buckets.length === 0) return null;

  return {
    type: record.type === "documents_version_retention_trends"
      ? "documents_version_retention_trends"
      : undefined,
    schema_version: Number.isFinite(Number(record.schema_version ?? record.schemaVersion))
      ? Number(record.schema_version ?? record.schemaVersion)
      : undefined,
    generated_at: stringFromUnknown(record.generated_at) || stringFromUnknown(record.generatedAt),
    document_id: stringFromUnknown(record.document_id) || stringFromUnknown(record.documentId),
    window: {
      days: numberFromUnknown(windowRecord.days, 30),
      from: stringFromUnknown(windowRecord.from),
      to: stringFromUnknown(windowRecord.to),
      bucket: "day",
    },
    retention_report: documentVersionRetentionReportFromPayload(record),
    buckets,
  };
}

function documentVersionRetentionTrendFromPayload(payload: unknown): DocumentVersionRetentionTrendReport | null {
  return normalizeDocumentVersionRetentionTrendReport(payload);
}

function normalizeRetentionDashboardDocumentSummary(value: unknown): DocumentRetentionDashboardDocumentSummary | null {
  const record = recordFromUnknown(value);
  const documentId = record
    ? stringFromUnknown(record.document_id) || stringFromUnknown(record.documentId)
    : undefined;

  if (!record || !documentId) return null;

  const latestVersionNumber = Number(record.latest_version_number ?? record.latestVersionNumber);
  const schemaVersion = Number(record.schema_version ?? record.schemaVersion);

  return {
    document_id: documentId,
    title: stringFromUnknown(record.title) || "Untitled Document",
    latest_version_number: Number.isFinite(latestVersionNumber) ? latestVersionNumber : null,
    latest_snapshot_at: stringFromUnknown(record.latest_snapshot_at) || stringFromUnknown(record.latestSnapshotAt) || null,
    snapshot_count: numberFromUnknown(record.snapshot_count ?? record.snapshotCount),
    captured_in_window_count: numberFromUnknown(record.captured_in_window_count ?? record.capturedInWindowCount),
    protected_count: numberFromUnknown(record.protected_count ?? record.protectedCount),
    prunable_count: numberFromUnknown(record.prunable_count ?? record.prunableCount),
    over_limit_count: numberFromUnknown(record.over_limit_count ?? record.overLimitCount),
    expired_retain_until_count: numberFromUnknown(record.expired_retain_until_count ?? record.expiredRetainUntilCount),
    keep_latest_count: numberFromUnknown(record.keep_latest_count ?? record.keepLatestCount),
    keep_forever_count: numberFromUnknown(record.keep_forever_count ?? record.keepForeverCount),
    retain_until_count: numberFromUnknown(record.retain_until_count ?? record.retainUntilCount),
    primary_origin: stringFromUnknown(record.primary_origin) || stringFromUnknown(record.primaryOrigin) || null,
    primary_origin_count: numberFromUnknown(record.primary_origin_count ?? record.primaryOriginCount),
    schema_version: Number.isFinite(schemaVersion) ? schemaVersion : null,
    risk_score: numberFromUnknown(record.risk_score ?? record.riskScore),
  };
}

function normalizeRetentionDashboardAlertSeverity(value: unknown): DocumentRetentionDashboardAlertSeverity {
  if (value === "critical" || value === "warning" || value === "info") return value;
  return "info";
}

function normalizeRetentionDashboardAlert(value: unknown): DocumentRetentionDashboardAlert | null {
  const record = recordFromUnknown(value);
  if (!record) return null;

  const type = stringFromUnknown(record.type) || "retention-alert";
  const documentId = stringFromUnknown(record.document_id) || stringFromUnknown(record.documentId) || null;
  const scope = record.scope === "document" ? "document" : "dashboard";
  const id = stringFromUnknown(record.id) || `${scope}:${type}:${documentId || "dashboard"}`;

  return {
    id,
    type,
    severity: normalizeRetentionDashboardAlertSeverity(record.severity),
    scope,
    document_id: documentId,
    title: stringFromUnknown(record.title) || null,
    count: numberFromUnknown(record.count),
    risk_score: numberFromUnknown(record.risk_score ?? record.riskScore),
    message: stringFromUnknown(record.message) || "Retention posture needs review.",
    recommended_action: stringFromUnknown(record.recommended_action) || stringFromUnknown(record.recommendedAction) || "Review the retention dashboard.",
  };
}

function normalizeRetentionDashboardAlertingSummary(
  value: unknown,
  alerts: DocumentRetentionDashboardAlert[]
): DocumentRetentionDashboardAlertingSummary {
  const record = recordFromUnknown(value);

  return {
    max_alerts: numberFromUnknown(record?.max_alerts ?? record?.maxAlerts, 20),
    alert_count: numberFromUnknown(record?.alert_count ?? record?.alertCount, alerts.length),
    critical_count: numberFromUnknown(
      record?.critical_count ?? record?.criticalCount,
      alerts.filter(alert => alert.severity === "critical").length
    ),
    warning_count: numberFromUnknown(
      record?.warning_count ?? record?.warningCount,
      alerts.filter(alert => alert.severity === "warning").length
    ),
  };
}

function normalizeRetentionDashboardExportSchedule(
  value: unknown,
  days: number,
  maxDocuments: number
): DocumentRetentionDashboardExportSchedule {
  const record = recordFromUnknown(value);
  const includes = Array.isArray(record?.includes)
    ? record.includes.map(item => stringFromUnknown(item)).filter((item): item is string => Boolean(item))
    : ["retention_report", "daily_buckets", "document_summaries", "alerts"];

  return {
    cadence: "weekly",
    next_export_at: stringFromUnknown(record?.next_export_at) || stringFromUnknown(record?.nextExportAt) || nextWeeklyRetentionExportAt().toISOString(),
    timezone: stringFromUnknown(record?.timezone) || "UTC",
    format: "json",
    content_free: record?.content_free === false || record?.contentFree === false ? false : true,
    retention_window_days: numberFromUnknown(record?.retention_window_days ?? record?.retentionWindowDays, days),
    max_documents: numberFromUnknown(record?.max_documents ?? record?.maxDocuments, maxDocuments),
    includes,
  };
}

function normalizeRetentionDashboardPolicyAction(value: unknown): DocumentRetentionDashboardPolicyAction | null {
  const record = recordFromUnknown(value);
  if (!record) return null;

  const type = stringFromUnknown(record.type) || "policy-review";
  const documentId = stringFromUnknown(record.document_id) || stringFromUnknown(record.documentId) || null;
  const scope = record.scope === "document" ? "document" : "dashboard";
  const id = stringFromUnknown(record.id) || `${scope}:${type}:${documentId || "dashboard"}`;

  return {
    id,
    type,
    severity: normalizeRetentionDashboardAlertSeverity(record.severity),
    scope,
    document_id: documentId,
    title: stringFromUnknown(record.title) || null,
    count: numberFromUnknown(record.count),
    reason: stringFromUnknown(record.reason) || "Retention policy automation needs review.",
    suggested_action: stringFromUnknown(record.suggested_action) || stringFromUnknown(record.suggestedAction) || "Review the retention policy action.",
    safe_to_auto_apply: record.safe_to_auto_apply === true || record.safeToAutoApply === true,
    requires_admin_confirmation: record.requires_admin_confirmation === false || record.requiresAdminConfirmation === false ? false : true,
  };
}

function normalizeRetentionDashboardPolicyAutomation(value: unknown): DocumentRetentionDashboardPolicyAutomation {
  const record = recordFromUnknown(value);
  const rawActions = record?.actions;
  const actions = Array.isArray(rawActions)
    ? rawActions
      .map(normalizeRetentionDashboardPolicyAction)
      .filter((action): action is DocumentRetentionDashboardPolicyAction => Boolean(action))
    : [];

  return {
    mode: "dry-run",
    max_actions: numberFromUnknown(record?.max_actions ?? record?.maxActions, 20),
    action_count: numberFromUnknown(record?.action_count ?? record?.actionCount, actions.length),
    destructive_action_count: numberFromUnknown(
      record?.destructive_action_count ?? record?.destructiveActionCount,
      actions.filter(action => action.type.includes("prune")).length
    ),
    requires_admin_confirmation: record?.requires_admin_confirmation === false || record?.requiresAdminConfirmation === false
      ? false
      : actions.length > 0,
    actions,
  };
}

function normalizeRetentionDashboardDeliveryStatus(value: unknown): DocumentRetentionDashboardDeliveryStatus {
  return value === "ready" || value === "disabled" || value === "delivered" || value === "failed"
    ? value
    : "scheduled";
}

function normalizeRetentionDashboardDeliveryEvent(value: unknown): DocumentRetentionDashboardDeliveryEvent | null {
  const record = recordFromUnknown(value);
  if (!record) return null;

  return {
    status: normalizeRetentionDashboardDeliveryStatus(record.status),
    occurred_at: stringFromUnknown(record.occurred_at) || stringFromUnknown(record.occurredAt) || null,
    message: stringFromUnknown(record.message) || "",
    manifest_id: stringFromUnknown(record.manifest_id) || stringFromUnknown(record.manifestId) || "",
    payload_hash: stringFromUnknown(record.payload_hash) || stringFromUnknown(record.payloadHash) || "",
    storage_adapter: stringFromUnknown(record.storage_adapter) || stringFromUnknown(record.storageAdapter) || "",
    storage_status: stringFromUnknown(record.storage_status) || stringFromUnknown(record.storageStatus) || "",
    storage_ref: stringFromUnknown(record.storage_ref) || stringFromUnknown(record.storageRef) || null,
    storage_path: stringFromUnknown(record.storage_path) || stringFromUnknown(record.storagePath) || null,
    storage_hash: stringFromUnknown(record.storage_hash) || stringFromUnknown(record.storageHash) || "",
    storage_content_free: record.storage_content_free === undefined && record.storageContentFree === undefined
      ? null
      : record.storage_content_free === false || record.storageContentFree === false ? false : true,
    stored_at: stringFromUnknown(record.stored_at) || stringFromUnknown(record.storedAt) || null,
    pending_alert_count: numberFromUnknown(record.pending_alert_count ?? record.pendingAlertCount),
    pending_policy_action_count: numberFromUnknown(
      record.pending_policy_action_count ?? record.pendingPolicyActionCount
    ),
    retry_after_at: stringFromUnknown(record.retry_after_at) || stringFromUnknown(record.retryAfterAt) || null,
    retry_backoff_seconds: numberFromUnknown(record.retry_backoff_seconds ?? record.retryBackoffSeconds),
  };
}

function normalizeRetentionDashboardExportDelivery(
  value: unknown,
  schedule: DocumentRetentionDashboardExportSchedule,
  alerts: DocumentRetentionDashboardAlert[],
  policyAutomation: DocumentRetentionDashboardPolicyAutomation
): DocumentRetentionDashboardExportDelivery {
  const record = recordFromUnknown(value);
  const rawChannels = record?.channels;
  const channels = Array.isArray(rawChannels)
    ? rawChannels.map(item => stringFromUnknown(item)).filter((item): item is string => Boolean(item))
    : ["admin-dashboard-download", "background-export-worker"];
  const status = normalizeRetentionDashboardDeliveryStatus(record?.status);
  const fallbackKey = `documents-retention:${schedule.next_export_at || "pending"}:${schedule.retention_window_days}:${schedule.max_documents}`;
  const rawDeliveryEvents = record?.delivery_events ?? record?.deliveryEvents;
  const deliveryEvents = Array.isArray(rawDeliveryEvents)
    ? rawDeliveryEvents
      .map(normalizeRetentionDashboardDeliveryEvent)
      .filter((event): event is DocumentRetentionDashboardDeliveryEvent => Boolean(event))
    : [];
  const nextAttemptAt = stringFromUnknown(record?.next_attempt_at)
    || stringFromUnknown(record?.nextAttemptAt)
    || schedule.next_export_at
    || null;

  return {
    status,
    background_worker: stringFromUnknown(record?.background_worker) || stringFromUnknown(record?.backgroundWorker) || "documents-retention-export",
    delivery_id: stringFromUnknown(record?.delivery_id) || stringFromUnknown(record?.deliveryId) || `documents-retention-${Math.abs(fallbackKey.length * 2654435761).toString(16).slice(0, 8)}`,
    idempotency_key: stringFromUnknown(record?.idempotency_key) || stringFromUnknown(record?.idempotencyKey) || fallbackKey,
    next_attempt_at: nextAttemptAt,
    next_retry_at: stringFromUnknown(record?.next_retry_at)
      || stringFromUnknown(record?.nextRetryAt)
      || (status === "failed" ? nextAttemptAt : null),
    last_delivery_at: stringFromUnknown(record?.last_delivery_at) || stringFromUnknown(record?.lastDeliveryAt) || null,
    last_failure_at: stringFromUnknown(record?.last_failure_at) || stringFromUnknown(record?.lastFailureAt) || null,
    last_failure_message: stringFromUnknown(record?.last_failure_message) || stringFromUnknown(record?.lastFailureMessage) || "",
    attempt_count: numberFromUnknown(record?.attempt_count ?? record?.attemptCount),
    failure_count: numberFromUnknown(record?.failure_count ?? record?.failureCount),
    retry_backoff_seconds: numberFromUnknown(record?.retry_backoff_seconds ?? record?.retryBackoffSeconds),
    channels,
    payload_type: "documents_version_retention_dashboard",
    payload_content_free: record?.payload_content_free === false || record?.payloadContentFree === false ? false : true,
    pending_alert_count: numberFromUnknown(record?.pending_alert_count ?? record?.pendingAlertCount, alerts.length),
    pending_policy_action_count: numberFromUnknown(
      record?.pending_policy_action_count ?? record?.pendingPolicyActionCount,
      policyAutomation.action_count
    ),
    requires_worker: record?.requires_worker === false || record?.requiresWorker === false ? false : true,
    persisted: record?.persisted === true,
    delivery_history_count: numberFromUnknown(record?.delivery_history_count ?? record?.deliveryHistoryCount),
    last_delivery_status: record?.last_delivery_status || record?.lastDeliveryStatus
      ? normalizeRetentionDashboardDeliveryStatus(record?.last_delivery_status ?? record?.lastDeliveryStatus)
      : null,
    last_delivery_message: stringFromUnknown(record?.last_delivery_message) || stringFromUnknown(record?.lastDeliveryMessage) || "",
    delivery_events: deliveryEvents,
    generated_at: stringFromUnknown(record?.generated_at) || stringFromUnknown(record?.generatedAt) || null,
    created_at: stringFromUnknown(record?.created_at) || stringFromUnknown(record?.createdAt) || null,
    updated_at: stringFromUnknown(record?.updated_at) || stringFromUnknown(record?.updatedAt) || null,
    retention_window_days: numberFromUnknown(
      record?.retention_window_days ?? record?.retentionWindowDays,
      schedule.retention_window_days
    ),
    max_documents: numberFromUnknown(record?.max_documents ?? record?.maxDocuments, schedule.max_documents),
  };
}

function normalizeRetentionDashboardExportReliability(
  value: unknown,
  deliveryHistory: DocumentRetentionDashboardExportDelivery[],
  exportDelivery: DocumentRetentionDashboardExportDelivery
): DocumentRetentionDashboardExportReliability {
  const record = recordFromUnknown(value);
  if (record) {
    return {
      job_count: numberFromUnknown(record.job_count ?? record.jobCount),
      scheduled_count: numberFromUnknown(record.scheduled_count ?? record.scheduledCount),
      delivered_count: numberFromUnknown(record.delivered_count ?? record.deliveredCount),
      failed_count: numberFromUnknown(record.failed_count ?? record.failedCount),
      retry_ready_count: numberFromUnknown(record.retry_ready_count ?? record.retryReadyCount),
      pending_retry_count: numberFromUnknown(record.pending_retry_count ?? record.pendingRetryCount),
      attempt_count: numberFromUnknown(record.attempt_count ?? record.attemptCount),
      failure_count: numberFromUnknown(record.failure_count ?? record.failureCount),
      max_retry_backoff_seconds: numberFromUnknown(
        record.max_retry_backoff_seconds ?? record.maxRetryBackoffSeconds
      ),
      last_failure_at: stringFromUnknown(record.last_failure_at) || stringFromUnknown(record.lastFailureAt) || null,
      last_delivery_at: stringFromUnknown(record.last_delivery_at) || stringFromUnknown(record.lastDeliveryAt) || null,
    };
  }

  const jobs = deliveryHistory.length > 0 ? deliveryHistory : [exportDelivery];
  return jobs.reduce<DocumentRetentionDashboardExportReliability>((summary, job) => {
    summary.job_count += 1;
    summary.attempt_count += job.attempt_count;
    summary.failure_count += job.failure_count;
    summary.max_retry_backoff_seconds = Math.max(summary.max_retry_backoff_seconds, job.retry_backoff_seconds);
    if (job.status === "delivered") {
      summary.delivered_count += 1;
    } else if (job.status === "failed") {
      summary.failed_count += 1;
      summary.pending_retry_count += job.next_retry_at ? 1 : 0;
    } else {
      summary.scheduled_count += 1;
    }
    summary.last_failure_at = summary.last_failure_at || job.last_failure_at || null;
    summary.last_delivery_at = summary.last_delivery_at || job.last_delivery_at || null;
    return summary;
  }, {
    job_count: 0,
    scheduled_count: 0,
    delivered_count: 0,
    failed_count: 0,
    retry_ready_count: 0,
    pending_retry_count: 0,
    attempt_count: 0,
    failure_count: 0,
    max_retry_backoff_seconds: 0,
    last_failure_at: null,
    last_delivery_at: null,
  });
}

function normalizeRetentionDashboardExportWorkerStatus(value: unknown): DocumentRetentionDashboardExportWorkerStatus {
  const record = recordFromUnknown(value);
  const schedulerEnabled = record?.scheduler_enabled === true || record?.schedulerEnabled === true;
  const schedulerStatus = schedulerEnabled ? "enabled" : "disabled";
  const worker = stringFromUnknown(record?.worker) || "documents-retention-export";
  const workerType = stringFromUnknown(record?.type);
  const isReminderWorker = worker === "documents-retention-reminder-notification" ||
    workerType === "documents_retention_reminder_notification_worker_status";
  const observabilityRecord = recordFromUnknown(record?.observability);
  const observabilityType = stringFromUnknown(observabilityRecord?.type);
  const healthValue = stringFromUnknown(record?.health) || stringFromUnknown(observabilityRecord?.health);
  const health = healthValue === "healthy" || healthValue === "degraded" || healthValue === "running" || healthValue === "manual"
    ? healthValue
    : schedulerEnabled ? "healthy" : "manual";
  const rawSafeguards = record?.safeguards;
  const safeguards = Array.isArray(rawSafeguards)
    ? rawSafeguards.map(item => stringFromUnknown(item)).filter((item): item is string => Boolean(item))
    : [
        schedulerEnabled
          ? isReminderWorker ? "Server interval can wake due failed reminder notification retries." : "Server interval can wake due documents retention export jobs."
          : isReminderWorker ? "Server interval is off until DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_ENABLED=true." : "Server interval is off until DOCUMENTS_RETENTION_EXPORT_WORKER_ENABLED=true.",
        isReminderWorker ? "Worker retry payloads are content-free." : "Worker dispatch only emits content-free delivery manifests.",
        "The worker does not prune snapshots or perform destructive retention actions.",
      ];
  const observability: DocumentRetentionDashboardWorkerObservability = {
    type: observabilityType === "documents_retention_export_worker_observability" ||
      observabilityType === "documents_retention_reminder_notification_worker_observability"
      ? observabilityType
      : undefined,
    health,
    heartbeat_at: stringFromUnknown(observabilityRecord?.heartbeat_at) || stringFromUnknown(observabilityRecord?.heartbeatAt) || null,
    scheduled_at: stringFromUnknown(observabilityRecord?.scheduled_at) || stringFromUnknown(observabilityRecord?.scheduledAt) || null,
    stopped_at: stringFromUnknown(observabilityRecord?.stopped_at) || stringFromUnknown(observabilityRecord?.stoppedAt) || null,
    next_run_at: stringFromUnknown(observabilityRecord?.next_run_at) || stringFromUnknown(observabilityRecord?.nextRunAt) || stringFromUnknown(record?.next_run_at) || stringFromUnknown(record?.nextRunAt) || null,
    next_run_in_ms: observabilityRecord && ("next_run_in_ms" in observabilityRecord || "nextRunInMs" in observabilityRecord)
      ? numberFromUnknown(observabilityRecord.next_run_in_ms ?? observabilityRecord.nextRunInMs)
      : null,
    scheduler_lag_ms: numberFromUnknown(observabilityRecord?.scheduler_lag_ms ?? observabilityRecord?.schedulerLagMs),
    last_started_at: stringFromUnknown(observabilityRecord?.last_started_at) || stringFromUnknown(observabilityRecord?.lastStartedAt) || null,
    last_completed_at: stringFromUnknown(observabilityRecord?.last_completed_at) || stringFromUnknown(observabilityRecord?.lastCompletedAt) || null,
    run_count: numberFromUnknown(observabilityRecord?.run_count ?? observabilityRecord?.runCount),
    completed_count: numberFromUnknown(observabilityRecord?.completed_count ?? observabilityRecord?.completedCount),
    failed_count: numberFromUnknown(observabilityRecord?.failed_count ?? observabilityRecord?.failedCount),
    skipped_count: numberFromUnknown(observabilityRecord?.skipped_count ?? observabilityRecord?.skippedCount),
    consecutive_failure_count: numberFromUnknown(observabilityRecord?.consecutive_failure_count ?? observabilityRecord?.consecutiveFailureCount),
    last_duration_ms: numberFromUnknown(observabilityRecord?.last_duration_ms ?? observabilityRecord?.lastDurationMs),
    max_duration_ms: numberFromUnknown(observabilityRecord?.max_duration_ms ?? observabilityRecord?.maxDurationMs),
    summary: stringFromUnknown(observabilityRecord?.summary) || (
      health === "manual"
        ? "The scheduler is disabled; manual dispatch remains available."
        : health === "degraded"
          ? "The worker has recent failures and needs operator review."
          : health === "running"
            ? isReminderWorker
              ? "The worker is currently retrying failed content-free reminder notifications."
              : "The worker is currently dispatching due content-free export jobs."
            : "The worker scheduler is healthy."
    ),
  };

  return {
    type: workerType === "documents_retention_export_worker_status" ||
      workerType === "documents_retention_reminder_notification_worker_status"
      ? workerType
      : undefined,
    worker,
    scheduler_enabled: schedulerEnabled,
    scheduler_status: schedulerStatus,
    interval_ms: numberFromUnknown(record?.interval_ms ?? record?.intervalMs, 15 * 60 * 1000),
    interval_label: stringFromUnknown(record?.interval_label) || stringFromUnknown(record?.intervalLabel) || "15 minutes",
    batch_limit: numberFromUnknown(record?.batch_limit ?? record?.batchLimit, 10),
    mode: isReminderWorker
      ? schedulerEnabled ? "interval-retry" : "manual-retry-only"
      : schedulerEnabled ? "interval-dispatch" : "manual-dispatch-only",
    payload_content_free: record?.payload_content_free === false || record?.payloadContentFree === false ? false : true,
    scheduled: record?.scheduled === true,
    running: record?.running === true,
    due_job_count: numberFromUnknown(
      record?.due_job_count ?? record?.dueJobCount ?? record?.due_notification_count ?? record?.dueNotificationCount
    ),
    health,
    next_run_at: observability.next_run_at,
    observability,
    last_run_at: stringFromUnknown(record?.last_run_at) || stringFromUnknown(record?.lastRunAt) || null,
    last_run_status: stringFromUnknown(record?.last_run_status) || stringFromUnknown(record?.lastRunStatus) || null,
    last_run_message: stringFromUnknown(record?.last_run_message) || stringFromUnknown(record?.lastRunMessage) || "",
    summary: stringFromUnknown(record?.summary) || (
      schedulerEnabled
        ? isReminderWorker
          ? "The evidence reminder notification retry worker is enabled and can retry due failed webhook notifications on an interval."
          : "The documents retention export worker is enabled and can dispatch due content-free export jobs on an interval."
        : isReminderWorker
          ? "The evidence reminder notification retry interval is disabled. Admin manual retry remains available."
          : "The documents retention export worker interval is disabled. Admin manual dispatch remains available."
    ),
    safeguards,
  };
}

function normalizeRetentionDashboardPruneCandidate(value: unknown): DocumentRetentionDashboardPruneCandidate | null {
  const record = recordFromUnknown(value);
  const snapshotId = stringFromUnknown(record?.snapshot_id) || stringFromUnknown(record?.snapshotId);
  const documentId = stringFromUnknown(record?.document_id) || stringFromUnknown(record?.documentId);

  if (!record || !snapshotId || !documentId) return null;

  return {
    snapshot_id: snapshotId,
    document_id: documentId,
    title: stringFromUnknown(record.title) || "Untitled Document",
    version_number: numberFromUnknown(record.version_number ?? record.versionNumber),
    retention_policy: normalizeDocumentVersionRetentionPolicy(record.retention_policy ?? record.retentionPolicy),
    retained_until: stringFromUnknown(record.retained_until) || stringFromUnknown(record.retainedUntil) || null,
    origin: stringFromUnknown(record.origin) || "legacy",
    schema_version: numberFromUnknown(record.schema_version ?? record.schemaVersion),
    content_hash: stringFromUnknown(record.content_hash) || stringFromUnknown(record.contentHash) || "",
    saved_at: stringFromUnknown(record.saved_at) || stringFromUnknown(record.savedAt) || null,
  };
}

function normalizeRetentionDashboardPruneDocumentSummary(value: unknown): DocumentRetentionDashboardPruneDocumentSummary | null {
  const record = recordFromUnknown(value);
  const documentId = stringFromUnknown(record?.document_id) || stringFromUnknown(record?.documentId);

  if (!record || !documentId) return null;

  return {
    document_id: documentId,
    title: stringFromUnknown(record.title) || "Untitled Document",
    snapshot_count: numberFromUnknown(record.snapshot_count ?? record.snapshotCount),
    protected_count: numberFromUnknown(record.protected_count ?? record.protectedCount),
    prunable_count: numberFromUnknown(record.prunable_count ?? record.prunableCount),
    over_limit_count: numberFromUnknown(record.over_limit_count ?? record.overLimitCount),
    candidate_count: numberFromUnknown(record.candidate_count ?? record.candidateCount),
    latest_snapshot_at: stringFromUnknown(record.latest_snapshot_at) || stringFromUnknown(record.latestSnapshotAt) || null,
    oldest_candidate_at: stringFromUnknown(record.oldest_candidate_at) || stringFromUnknown(record.oldestCandidateAt) || null,
    newest_candidate_at: stringFromUnknown(record.newest_candidate_at) || stringFromUnknown(record.newestCandidateAt) || null,
  };
}

function normalizeRetentionDashboardRestoreDrillStatus(value: unknown): DocumentRetentionDashboardRestoreDrillStatus {
  return value === "completed" || value === "blocked" || value === "not-required" || value === "required"
    ? value
    : "not-required";
}

function normalizeRetentionDashboardRestoreDrill(value: unknown): DocumentRetentionDashboardRestoreDrill | null {
  const record = recordFromUnknown(value);
  if (!record) return null;

  const rawChecks = record.checks;
  const checks = Array.isArray(rawChecks)
    ? rawChecks.map(item => stringFromUnknown(item)).filter((item): item is string => Boolean(item))
    : [];
  const sampleRecord = recordFromUnknown(record.sample);
  const backupHandoffRecord = recordFromUnknown(record.backup_handoff ?? record.backupHandoff);
  const primaryHistoryCheckRecord = recordFromUnknown(record.primary_history_check ?? record.primaryHistoryCheck);
  const automationClearanceRecord = recordFromUnknown(record.automation_clearance ?? record.automationClearance);
  const executionRecord = recordFromUnknown(record.execution);
  const backupHandoffStatus = backupHandoffRecord?.status === "confirmed" || backupHandoffRecord?.status === "required" || backupHandoffRecord?.status === "not-required"
    ? backupHandoffRecord.status
    : "not-required";
  const primaryHistoryCheckStatus = primaryHistoryCheckRecord?.status === "failed" ? "failed" : "passed";
  const executionStatus = executionRecord?.status === "blocked" ? "blocked" : "completed";

  return {
    type: record.type === "documents_version_retention_restore_drill"
      ? "documents_version_retention_restore_drill"
      : undefined,
    status: normalizeRetentionDashboardRestoreDrillStatus(record.status),
    payload_content_free: record.payload_content_free === false || record.payloadContentFree === false ? false : true,
    deleted_count: numberFromUnknown(record.deleted_count ?? record.deletedCount),
    remaining_candidate_count: numberFromUnknown(record.remaining_candidate_count ?? record.remainingCandidateCount),
    sample: sampleRecord
      ? {
          snapshot_id: stringFromUnknown(sampleRecord.snapshot_id) || stringFromUnknown(sampleRecord.snapshotId) || undefined,
          document_id: stringFromUnknown(sampleRecord.document_id) || stringFromUnknown(sampleRecord.documentId) || undefined,
          version_number: numberFromUnknown(sampleRecord.version_number ?? sampleRecord.versionNumber),
          content_hash: stringFromUnknown(sampleRecord.content_hash) || stringFromUnknown(sampleRecord.contentHash) || undefined,
          saved_at: stringFromUnknown(sampleRecord.saved_at) || stringFromUnknown(sampleRecord.savedAt) || null,
        }
      : null,
    checks,
    message: stringFromUnknown(record.message) || "",
    generated_at: stringFromUnknown(record.generated_at) || stringFromUnknown(record.generatedAt) || null,
    completed_at: stringFromUnknown(record.completed_at) || stringFromUnknown(record.completedAt) || null,
    backup_handoff: backupHandoffRecord
      ? {
          status: backupHandoffStatus,
          payload_content_free: backupHandoffRecord.payload_content_free === false || backupHandoffRecord.payloadContentFree === false ? false : true,
          source: stringFromUnknown(backupHandoffRecord.source) || "external-backup-or-export",
          required: backupHandoffRecord.required === true,
          confirmed: backupHandoffRecord.confirmed === true,
        }
      : null,
    primary_history_check: primaryHistoryCheckRecord
      ? {
          status: primaryHistoryCheckStatus,
          payload_content_free: primaryHistoryCheckRecord.payload_content_free === false || primaryHistoryCheckRecord.payloadContentFree === false ? false : true,
          checked_at: stringFromUnknown(primaryHistoryCheckRecord.checked_at) || stringFromUnknown(primaryHistoryCheckRecord.checkedAt) || null,
          sample_snapshot_id: stringFromUnknown(primaryHistoryCheckRecord.sample_snapshot_id) || stringFromUnknown(primaryHistoryCheckRecord.sampleSnapshotId) || null,
          sample_snapshot_present: primaryHistoryCheckRecord.sample_snapshot_present === true || primaryHistoryCheckRecord.sampleSnapshotPresent === true,
        }
      : null,
    automation_clearance: automationClearanceRecord
      ? {
          scheduled_prune_allowed: automationClearanceRecord.scheduled_prune_allowed === true || automationClearanceRecord.scheduledPruneAllowed === true,
          reason: stringFromUnknown(automationClearanceRecord.reason) || "",
        }
      : null,
    execution: executionRecord
      ? {
          type: executionRecord.type === "documents_version_retention_restore_drill_execution"
            ? "documents_version_retention_restore_drill_execution"
            : undefined,
          drill_id: stringFromUnknown(executionRecord.drill_id) || stringFromUnknown(executionRecord.drillId) || undefined,
          audit_id: stringFromUnknown(executionRecord.audit_id) || stringFromUnknown(executionRecord.auditId) || undefined,
          status: executionStatus,
          requested_by: stringFromUnknown(executionRecord.requested_by) || stringFromUnknown(executionRecord.requestedBy) || null,
          payload_content_free: executionRecord.payload_content_free === false || executionRecord.payloadContentFree === false ? false : true,
          confirmation_matched: executionRecord.confirmation_matched !== false && executionRecord.confirmationMatched !== false,
          backup_handoff_confirmed: executionRecord.backup_handoff_confirmed !== false && executionRecord.backupHandoffConfirmed !== false,
          executed_at: stringFromUnknown(executionRecord.executed_at) || stringFromUnknown(executionRecord.executedAt) || null,
        }
      : null,
  };
}

function normalizeRetentionDashboardPruneAudit(value: unknown): DocumentRetentionDashboardPruneAudit | null {
  const record = recordFromUnknown(value);
  const auditId = stringFromUnknown(record?.audit_id) || stringFromUnknown(record?.auditId);
  if (!record || !auditId) return null;

  const rawCandidates = record.candidates;
  const candidates = Array.isArray(rawCandidates)
    ? rawCandidates
      .map(normalizeRetentionDashboardPruneCandidate)
      .filter((candidate): candidate is DocumentRetentionDashboardPruneCandidate => Boolean(candidate))
    : [];
  const rawDocuments = record.documents;
  const documents = Array.isArray(rawDocuments)
    ? rawDocuments
      .map(normalizeRetentionDashboardPruneDocumentSummary)
      .filter((document): document is DocumentRetentionDashboardPruneDocumentSummary => Boolean(document))
    : [];

  return {
    audit_id: auditId,
    type: record.type === "documents_version_retention_prune_audit"
      ? "documents_version_retention_prune_audit"
      : undefined,
    mode: "confirmed-delete",
    status: record.status === "failed" ? "failed" : "completed",
    requested_by: stringFromUnknown(record.requested_by) || stringFromUnknown(record.requestedBy) || null,
    payload_content_free: record.payload_content_free === false || record.payloadContentFree === false ? false : true,
    deleted_count: numberFromUnknown(record.deleted_count ?? record.deletedCount),
    remaining_candidate_count: numberFromUnknown(record.remaining_candidate_count ?? record.remainingCandidateCount),
    affected_documents_count: numberFromUnknown(record.affected_documents_count ?? record.affectedDocumentsCount, documents.length),
    candidates,
    documents,
    restore_drill: normalizeRetentionDashboardRestoreDrill(record.restore_drill ?? record.restoreDrill),
    executed_at: stringFromUnknown(record.executed_at) || stringFromUnknown(record.executedAt) || null,
  };
}

function normalizeRetentionDashboardScheduledPruneAutomation(value: unknown): DocumentRetentionDashboardScheduledPruneAutomation {
  const record = recordFromUnknown(value);
  const rawSafeguards = record?.safeguards;
  const safeguards = Array.isArray(rawSafeguards)
    ? rawSafeguards.map(item => stringFromUnknown(item)).filter((item): item is string => Boolean(item))
    : [
        "No scheduled prune worker is registered by this guardrail report.",
        "Scheduled pruning stays blocked until required restore drills pass.",
        "Automation must keep a content-free preview and explicit admin confirmation gate.",
      ];
  const status = record?.status === "ready" || record?.status === "blocked" || record?.status === "manual-only"
    ? record.status
    : "manual-only";

  return {
    type: record?.type === "documents_version_retention_scheduled_prune_guardrails"
      ? "documents_version_retention_scheduled_prune_guardrails"
      : undefined,
    payload_content_free: record?.payload_content_free === false || record?.payloadContentFree === false ? false : true,
    enabled_requested: record?.enabled_requested === true || record?.enabledRequested === true,
    status,
    scheduled_prune_allowed: record?.scheduled_prune_allowed === true || record?.scheduledPruneAllowed === true,
    required_restore_drill_count: numberFromUnknown(record?.required_restore_drill_count ?? record?.requiredRestoreDrillCount),
    latest_audit_id: stringFromUnknown(record?.latest_audit_id) || stringFromUnknown(record?.latestAuditId) || null,
    latest_restore_drill_status: record?.latest_restore_drill_status || record?.latestRestoreDrillStatus
      ? normalizeRetentionDashboardRestoreDrillStatus(record?.latest_restore_drill_status ?? record?.latestRestoreDrillStatus)
      : null,
    last_completed_restore_drill_at: stringFromUnknown(record?.last_completed_restore_drill_at) || stringFromUnknown(record?.lastCompletedRestoreDrillAt) || null,
    confirmation_token: stringFromUnknown(record?.confirmation_token) || stringFromUnknown(record?.confirmationToken) || "PRUNE_DOCUMENT_VERSION_SNAPSHOTS",
    safeguards,
    message: stringFromUnknown(record?.message) || (
      status === "ready"
        ? "Scheduled pruning guardrails are clear, but destructive automation still needs a separate scheduler implementation."
        : status === "blocked"
          ? "Scheduled pruning is blocked until required restore drills pass."
          : "Scheduled pruning is disabled; manual prune execution remains the only delete path."
    ),
    generated_at: stringFromUnknown(record?.generated_at) || stringFromUnknown(record?.generatedAt) || null,
  };
}

function normalizeRetentionDashboardRunbookEvidence(value: unknown): DocumentRetentionRunbookEvidence | null {
  const record = recordFromUnknown(value);
  const evidenceId = stringFromUnknown(record?.evidence_id) || stringFromUnknown(record?.evidenceId);
  const status = record?.status === "verified" || record?.status === "handoff-required" || record?.status === "export-required"
    ? record.status
    : "export-required";
  const scheduledStatus = record?.scheduled_prune_status === "ready" || record?.scheduled_prune_status === "blocked" || record?.scheduled_prune_status === "manual-only"
    ? record.scheduled_prune_status
    : record?.scheduledPruneStatus === "ready" || record?.scheduledPruneStatus === "blocked" || record?.scheduledPruneStatus === "manual-only"
      ? record.scheduledPruneStatus
      : "manual-only";

  if (!record || !evidenceId) return null;

  return {
    type: record.type === "documents_version_retention_runbook_evidence"
      ? "documents_version_retention_runbook_evidence"
      : undefined,
    evidence_id: evidenceId,
    evidence_type: stringFromUnknown(record.evidence_type) || stringFromUnknown(record.evidenceType) || "backup-verification",
    status,
    requested_by: stringFromUnknown(record.requested_by) || stringFromUnknown(record.requestedBy) || null,
    payload_content_free: record.payload_content_free === false || record.payloadContentFree === false ? false : true,
    storage_adapter: stringFromUnknown(record.storage_adapter) || stringFromUnknown(record.storageAdapter) || "database",
    report_hash: stringFromUnknown(record.report_hash) || stringFromUnknown(record.reportHash) || "",
    latest_manifest_id: stringFromUnknown(record.latest_manifest_id) || stringFromUnknown(record.latestManifestId) || null,
    latest_payload_hash: stringFromUnknown(record.latest_payload_hash) || stringFromUnknown(record.latestPayloadHash) || null,
    latest_delivery_id: stringFromUnknown(record.latest_delivery_id) || stringFromUnknown(record.latestDeliveryId) || null,
    latest_delivery_at: stringFromUnknown(record.latest_delivery_at) || stringFromUnknown(record.latestDeliveryAt) || null,
    backup_storage_ready: record.backup_storage_ready === true || record.backupStorageReady === true,
    latest_storage_adapter: stringFromUnknown(record.latest_storage_adapter) || stringFromUnknown(record.latestStorageAdapter) || null,
    latest_storage_status: stringFromUnknown(record.latest_storage_status) || stringFromUnknown(record.latestStorageStatus) || null,
    latest_storage_ref: stringFromUnknown(record.latest_storage_ref) || stringFromUnknown(record.latestStorageRef) || null,
    latest_storage_hash: stringFromUnknown(record.latest_storage_hash) || stringFromUnknown(record.latestStorageHash) || null,
    latest_stored_at: stringFromUnknown(record.latest_stored_at) || stringFromUnknown(record.latestStoredAt) || null,
    backup_export_ready: record.backup_export_ready === true || record.backupExportReady === true,
    backup_handoff_ready: record.backup_handoff_ready === true || record.backupHandoffReady === true,
    delivered_manifest_count: numberFromUnknown(record.delivered_manifest_count ?? record.deliveredManifestCount),
    failed_delivery_count: numberFromUnknown(record.failed_delivery_count ?? record.failedDeliveryCount),
    pending_delivery_count: numberFromUnknown(record.pending_delivery_count ?? record.pendingDeliveryCount),
    prune_audit_count: numberFromUnknown(record.prune_audit_count ?? record.pruneAuditCount),
    required_restore_drill_count: numberFromUnknown(record.required_restore_drill_count ?? record.requiredRestoreDrillCount),
    completed_restore_drill_count: numberFromUnknown(record.completed_restore_drill_count ?? record.completedRestoreDrillCount),
    scheduled_prune_allowed: record.scheduled_prune_allowed === true || record.scheduledPruneAllowed === true,
    scheduled_prune_status: scheduledStatus,
    recorded_at: stringFromUnknown(record.recorded_at) || stringFromUnknown(record.recordedAt) || null,
    expires_at: stringFromUnknown(record.expires_at) || stringFromUnknown(record.expiresAt) || null,
  };
}

function normalizeRetentionDashboardEvidenceReminder(value: unknown): DocumentRetentionEvidenceReminder | null {
  const record = recordFromUnknown(value);
  const status = record?.status === "current" ||
    record?.status === "expiring-soon" ||
    record?.status === "expired" ||
    record?.status === "missing"
    ? record.status
    : null;
  const severity = record?.severity === "critical" ||
    record?.severity === "warning" ||
    record?.severity === "info"
    ? record.severity
    : status === "expired"
      ? "critical"
      : status === "missing" || status === "expiring-soon"
        ? "warning"
        : "info";
  const rawChannels = record?.channels;
  const channels = Array.isArray(rawChannels)
    ? rawChannels.map(item => stringFromUnknown(item)).filter((item): item is string => Boolean(item))
    : ["retention-dashboard"];

  if (!record || !status) return null;

  return {
    type: record.type === "documents_version_retention_evidence_reminder"
      ? "documents_version_retention_evidence_reminder"
      : undefined,
    payload_content_free: record.payload_content_free === false || record.payloadContentFree === false ? false : true,
    status,
    severity,
    review_required: record.review_required === true || record.reviewRequired === true,
    latest_evidence_id: stringFromUnknown(record.latest_evidence_id) || stringFromUnknown(record.latestEvidenceId) || null,
    latest_evidence_at: stringFromUnknown(record.latest_evidence_at) || stringFromUnknown(record.latestEvidenceAt) || null,
    expires_at: stringFromUnknown(record.expires_at) || stringFromUnknown(record.expiresAt) || null,
    days_until_expiry: record.days_until_expiry === null || record.daysUntilExpiry === null
      ? null
      : numberFromUnknown(record.days_until_expiry ?? record.daysUntilExpiry, 0),
    next_review_at: stringFromUnknown(record.next_review_at) || stringFromUnknown(record.nextReviewAt) || null,
    due_at: stringFromUnknown(record.due_at) || stringFromUnknown(record.dueAt) || null,
    channels,
    recommended_action: stringFromUnknown(record.recommended_action) ||
      stringFromUnknown(record.recommendedAction) ||
      "Record or review backup verification evidence.",
    message: stringFromUnknown(record.message) || "Review backup verification evidence.",
  };
}

function normalizeRetentionReminderNotification(value: unknown): DocumentRetentionReminderNotification | null {
  const record = recordFromUnknown(value);
  if (!record) return null;

  const reminderStatus = record.reminder_status === "current" ||
    record.reminder_status === "expiring-soon" ||
    record.reminder_status === "expired" ||
    record.reminder_status === "missing"
    ? record.reminder_status
    : record.reminderStatus === "current" ||
      record.reminderStatus === "expiring-soon" ||
      record.reminderStatus === "expired" ||
      record.reminderStatus === "missing"
      ? record.reminderStatus
      : "missing";
  const severity = record.severity === "critical" ||
    record.severity === "warning" ||
    record.severity === "info"
    ? record.severity
    : reminderStatus === "expired"
      ? "critical"
      : reminderStatus === "current"
        ? "info"
        : "warning";
  const status = record.status === "delivered" ||
    record.status === "failed" ||
    record.status === "skipped" ||
    record.status === "scheduled"
    ? record.status
    : "scheduled";
  const rawChannels = record.channels;
  const channels = Array.isArray(rawChannels)
    ? rawChannels.map(item => stringFromUnknown(item)).filter((item): item is string => Boolean(item))
    : ["retention-dashboard", "admin-runbook"];

  return {
    type: record.type === "documents_version_retention_evidence_reminder_notification"
      ? "documents_version_retention_evidence_reminder_notification"
      : undefined,
    notification_id: stringFromUnknown(record.notification_id) || stringFromUnknown(record.notificationId) || "",
    idempotency_key: stringFromUnknown(record.idempotency_key) || stringFromUnknown(record.idempotencyKey) || "",
    reminder_status: reminderStatus,
    severity,
    review_required: record.review_required === true || record.reviewRequired === true,
    status,
    delivery_adapter: stringFromUnknown(record.delivery_adapter) || stringFromUnknown(record.deliveryAdapter) || "internal-ledger",
    delivery_target: stringFromUnknown(record.delivery_target) || stringFromUnknown(record.deliveryTarget) || "retention-dashboard",
    channels,
    payload_content_free: record.payload_content_free === false || record.payloadContentFree === false ? false : true,
    payload_hash: stringFromUnknown(record.payload_hash) || stringFromUnknown(record.payloadHash) || "",
    latest_evidence_id: stringFromUnknown(record.latest_evidence_id) || stringFromUnknown(record.latestEvidenceId) || null,
    latest_manifest_id: stringFromUnknown(record.latest_manifest_id) || stringFromUnknown(record.latestManifestId) || null,
    latest_payload_hash: stringFromUnknown(record.latest_payload_hash) || stringFromUnknown(record.latestPayloadHash) || null,
    due_at: stringFromUnknown(record.due_at) || stringFromUnknown(record.dueAt) || null,
    next_review_at: stringFromUnknown(record.next_review_at) || stringFromUnknown(record.nextReviewAt) || null,
    generated_at: stringFromUnknown(record.generated_at) || stringFromUnknown(record.generatedAt) || null,
    delivered_at: stringFromUnknown(record.delivered_at) || stringFromUnknown(record.deliveredAt) || null,
    last_failure_at: stringFromUnknown(record.last_failure_at) || stringFromUnknown(record.lastFailureAt) || null,
    last_failure_message: stringFromUnknown(record.last_failure_message) || stringFromUnknown(record.lastFailureMessage) || "",
    attempt_count: numberFromUnknown(record.attempt_count ?? record.attemptCount),
    failure_count: numberFromUnknown(record.failure_count ?? record.failureCount),
    retry_after_at: stringFromUnknown(record.retry_after_at) || stringFromUnknown(record.retryAfterAt) || null,
    retry_backoff_seconds: numberFromUnknown(record.retry_backoff_seconds ?? record.retryBackoffSeconds),
    response_status: numberFromUnknown(record.response_status ?? record.responseStatus),
    response_body_hash: stringFromUnknown(record.response_body_hash) || stringFromUnknown(record.responseBodyHash) || "",
    message: stringFromUnknown(record.message) || "Evidence reminder notification recorded.",
  };
}

function normalizeRetentionRestoreDownloadVerification(value: unknown): DocumentRetentionRestoreDownloadVerification | null {
  const record = recordFromUnknown(value);
  if (!record) return null;

  const status = record.status === "verified" ||
    record.status === "failed" ||
    record.status === "metadata-only" ||
    record.status === "ready" ||
    record.status === "blocked"
    ? record.status
    : "blocked";
  const rawChecks = record.checks;
  const checks = Array.isArray(rawChecks)
    ? rawChecks.map(item => stringFromUnknown(item)).filter((item): item is string => Boolean(item))
    : [];

  return {
    type: record.type === "documents_version_retention_restore_download_verification"
      ? "documents_version_retention_restore_download_verification"
      : undefined,
    schema_version: numberFromUnknown(record.schema_version ?? record.schemaVersion, 0) || undefined,
    generated_at: stringFromUnknown(record.generated_at) || stringFromUnknown(record.generatedAt) || null,
    downloaded_at: stringFromUnknown(record.downloaded_at) || stringFromUnknown(record.downloadedAt) || null,
    payload_content_free: record.payload_content_free === false || record.payloadContentFree === false ? false : true,
    status,
    restore_download_ready: record.restore_download_ready === true || record.restoreDownloadReady === true,
    delivery_id: stringFromUnknown(record.delivery_id) || stringFromUnknown(record.deliveryId) || null,
    manifest_id: stringFromUnknown(record.manifest_id) || stringFromUnknown(record.manifestId) || null,
    payload_hash: stringFromUnknown(record.payload_hash) || stringFromUnknown(record.payloadHash) || null,
    storage_adapter: stringFromUnknown(record.storage_adapter) || stringFromUnknown(record.storageAdapter) || null,
    storage_status: stringFromUnknown(record.storage_status) || stringFromUnknown(record.storageStatus) || null,
    storage_ref: stringFromUnknown(record.storage_ref) || stringFromUnknown(record.storageRef) || null,
    storage_path: stringFromUnknown(record.storage_path) || stringFromUnknown(record.storagePath) || null,
    storage_hash_expected: stringFromUnknown(record.storage_hash_expected) || stringFromUnknown(record.storageHashExpected) || null,
    storage_hash_actual: stringFromUnknown(record.storage_hash_actual) || stringFromUnknown(record.storageHashActual) || null,
    manifest_id_matched: record.manifest_id_matched === true || record.manifestIdMatched === true,
    payload_hash_matched: record.payload_hash_matched === true || record.payloadHashMatched === true,
    storage_hash_matched: record.storage_hash_matched === true || record.storageHashMatched === true,
    content_free: record.content_free === true || record.contentFree === true,
    error_message: stringFromUnknown(record.error_message) || stringFromUnknown(record.errorMessage) || "",
    checks,
    message: stringFromUnknown(record.message) || "Restore-download verification is unavailable.",
  };
}

function normalizeRetentionDashboardBackupVerification(value: unknown): DocumentRetentionDashboardBackupVerification {
  const record = recordFromUnknown(value);
  const rawChecks = record?.checks;
  const checks = Array.isArray(rawChecks)
    ? rawChecks.map(item => stringFromUnknown(item)).filter((item): item is string => Boolean(item))
    : [
        "No delivered content-free retention export manifest is available yet.",
        "Document body content, content_text, and metadata are excluded from verification payloads.",
      ];
  const rawRunbookSteps = record?.runbook_steps ?? record?.runbookSteps;
  const runbookSteps = Array.isArray(rawRunbookSteps)
    ? rawRunbookSteps.map(item => stringFromUnknown(item)).filter((item): item is string => Boolean(item))
    : [
        "Dispatch or download the retention dashboard export and archive the content-free manifest hash.",
        "Keep scheduled pruning disabled until export evidence and restore-drill evidence are both ready.",
      ];
  const status = record?.status === "verified" || record?.status === "handoff-required" || record?.status === "export-required"
    ? record.status
    : "export-required";
  const scheduledStatus = record?.scheduled_prune_status === "ready" || record?.scheduled_prune_status === "blocked" || record?.scheduled_prune_status === "manual-only"
    ? record.scheduled_prune_status
    : record?.scheduledPruneStatus === "ready" || record?.scheduledPruneStatus === "blocked" || record?.scheduledPruneStatus === "manual-only"
      ? record.scheduledPruneStatus
      : "manual-only";
  const rawEvidenceHistory = record?.evidence_history ?? record?.evidenceHistory;
  const evidenceHistory = Array.isArray(rawEvidenceHistory)
    ? rawEvidenceHistory
      .map(normalizeRetentionDashboardRunbookEvidence)
      .filter((item): item is DocumentRetentionRunbookEvidence => Boolean(item))
    : [];
  const evidenceReviewStatus = record?.evidence_review_status === "current" ||
    record?.evidence_review_status === "expiring-soon" ||
    record?.evidence_review_status === "expired" ||
    record?.evidence_review_status === "missing"
    ? record.evidence_review_status
    : record?.evidenceReviewStatus === "current" ||
      record?.evidenceReviewStatus === "expiring-soon" ||
      record?.evidenceReviewStatus === "expired" ||
      record?.evidenceReviewStatus === "missing"
      ? record.evidenceReviewStatus
      : evidenceHistory.length > 0 ? "current" : "missing";
  const evidenceReminder = normalizeRetentionDashboardEvidenceReminder(
    record?.evidence_reminder ?? record?.evidenceReminder
  );
  const latestReminderNotification = normalizeRetentionReminderNotification(
    record?.latest_evidence_reminder_notification ?? record?.latestEvidenceReminderNotification
  );
  const rawReminderNotificationHistory =
    record?.evidence_reminder_notification_history ?? record?.evidenceReminderNotificationHistory;
  const reminderNotificationHistory = Array.isArray(rawReminderNotificationHistory)
    ? rawReminderNotificationHistory
      .map(normalizeRetentionReminderNotification)
      .filter((item): item is DocumentRetentionReminderNotification => Boolean(item))
    : latestReminderNotification ? [latestReminderNotification] : [];
  const evidenceReviewSeverity = record?.evidence_review_severity === "critical" ||
    record?.evidence_review_severity === "warning" ||
    record?.evidence_review_severity === "info"
    ? record.evidence_review_severity
    : record?.evidenceReviewSeverity === "critical" ||
      record?.evidenceReviewSeverity === "warning" ||
      record?.evidenceReviewSeverity === "info"
      ? record.evidenceReviewSeverity
      : evidenceReminder?.severity || (
          evidenceReviewStatus === "expired"
            ? "critical"
            : evidenceReviewStatus === "missing" || evidenceReviewStatus === "expiring-soon"
              ? "warning"
              : "info"
        );
  const rawRestoreDownloadStatus = record?.restore_download_status ?? record?.restoreDownloadStatus;
  const restoreDownloadStatus = rawRestoreDownloadStatus === "ready" ||
    rawRestoreDownloadStatus === "metadata-only" ||
    rawRestoreDownloadStatus === "blocked"
    ? rawRestoreDownloadStatus
    : record?.latest_storage_status === "stored" || record?.latestStorageStatus === "stored"
      ? "ready"
      : record?.latest_storage_status === "metadata-only" || record?.latestStorageStatus === "metadata-only"
        ? "metadata-only"
        : "blocked";

  return {
    type: record?.type === "documents_version_retention_backup_verification"
      ? "documents_version_retention_backup_verification"
      : undefined,
    payload_content_free: record?.payload_content_free === false || record?.payloadContentFree === false ? false : true,
    status,
    backup_export_ready: record?.backup_export_ready === true || record?.backupExportReady === true,
    backup_handoff_ready: record?.backup_handoff_ready === true || record?.backupHandoffReady === true,
    backup_storage_ready: record?.backup_storage_ready === true || record?.backupStorageReady === true,
    latest_manifest_id: stringFromUnknown(record?.latest_manifest_id) || stringFromUnknown(record?.latestManifestId) || null,
    latest_payload_hash: stringFromUnknown(record?.latest_payload_hash) || stringFromUnknown(record?.latestPayloadHash) || null,
    latest_delivery_id: stringFromUnknown(record?.latest_delivery_id) || stringFromUnknown(record?.latestDeliveryId) || null,
    latest_delivery_at: stringFromUnknown(record?.latest_delivery_at) || stringFromUnknown(record?.latestDeliveryAt) || null,
    latest_storage_adapter: stringFromUnknown(record?.latest_storage_adapter) || stringFromUnknown(record?.latestStorageAdapter) || null,
    latest_storage_status: stringFromUnknown(record?.latest_storage_status) || stringFromUnknown(record?.latestStorageStatus) || null,
    latest_storage_ref: stringFromUnknown(record?.latest_storage_ref) || stringFromUnknown(record?.latestStorageRef) || null,
    latest_storage_path: stringFromUnknown(record?.latest_storage_path) || stringFromUnknown(record?.latestStoragePath) || null,
    latest_storage_hash: stringFromUnknown(record?.latest_storage_hash) || stringFromUnknown(record?.latestStorageHash) || null,
    latest_storage_content_free: record?.latest_storage_content_free === false || record?.latestStorageContentFree === false ? false : true,
    latest_stored_at: stringFromUnknown(record?.latest_stored_at) || stringFromUnknown(record?.latestStoredAt) || null,
    restore_download_ready: record?.restore_download_ready === true || record?.restoreDownloadReady === true,
    restore_download_status: restoreDownloadStatus,
    delivered_manifest_count: numberFromUnknown(record?.delivered_manifest_count ?? record?.deliveredManifestCount),
    failed_delivery_count: numberFromUnknown(record?.failed_delivery_count ?? record?.failedDeliveryCount),
    pending_delivery_count: numberFromUnknown(record?.pending_delivery_count ?? record?.pendingDeliveryCount),
    prune_audit_count: numberFromUnknown(record?.prune_audit_count ?? record?.pruneAuditCount),
    required_restore_drill_count: numberFromUnknown(record?.required_restore_drill_count ?? record?.requiredRestoreDrillCount),
    completed_restore_drill_count: numberFromUnknown(record?.completed_restore_drill_count ?? record?.completedRestoreDrillCount),
    scheduled_prune_allowed: record?.scheduled_prune_allowed === true || record?.scheduledPruneAllowed === true,
    scheduled_prune_status: scheduledStatus,
    evidence_count: numberFromUnknown(record?.evidence_count ?? record?.evidenceCount, evidenceHistory.length),
    latest_evidence_id: stringFromUnknown(record?.latest_evidence_id) || stringFromUnknown(record?.latestEvidenceId) || evidenceHistory[0]?.evidence_id || null,
    latest_evidence_at: stringFromUnknown(record?.latest_evidence_at) || stringFromUnknown(record?.latestEvidenceAt) || evidenceHistory[0]?.recorded_at || null,
    latest_evidence_expires_at: stringFromUnknown(record?.latest_evidence_expires_at) || stringFromUnknown(record?.latestEvidenceExpiresAt) || evidenceHistory[0]?.expires_at || null,
    evidence_storage_adapter: stringFromUnknown(record?.evidence_storage_adapter) || stringFromUnknown(record?.evidenceStorageAdapter) || evidenceHistory[0]?.storage_adapter || "database",
    evidence_retention_days: numberFromUnknown(record?.evidence_retention_days ?? record?.evidenceRetentionDays, 180),
    evidence_review_status: evidenceReviewStatus,
    evidence_fresh: record?.evidence_fresh === true || record?.evidenceFresh === true,
    evidence_expired: record?.evidence_expired === true || record?.evidenceExpired === true,
    evidence_expires_in_days: record?.evidence_expires_in_days === null || record?.evidenceExpiresInDays === null
      ? null
      : numberFromUnknown(record?.evidence_expires_in_days ?? record?.evidenceExpiresInDays, 0),
    evidence_review_required: record?.evidence_review_required === true ||
      record?.evidenceReviewRequired === true ||
      evidenceReminder?.review_required === true,
    evidence_review_severity: evidenceReviewSeverity,
    evidence_next_review_at: stringFromUnknown(record?.evidence_next_review_at) ||
      stringFromUnknown(record?.evidenceNextReviewAt) ||
      evidenceReminder?.next_review_at ||
      null,
    evidence_review_due_at: stringFromUnknown(record?.evidence_review_due_at) ||
      stringFromUnknown(record?.evidenceReviewDueAt) ||
      evidenceReminder?.due_at ||
      null,
    evidence_reminder: evidenceReminder,
    evidence_reminder_notification_count: numberFromUnknown(
      record?.evidence_reminder_notification_count ?? record?.evidenceReminderNotificationCount,
      reminderNotificationHistory.length
    ),
    evidence_reminder_notification_failed_count: numberFromUnknown(
      record?.evidence_reminder_notification_failed_count ?? record?.evidenceReminderNotificationFailedCount
    ),
    evidence_reminder_notification_retry_ready_count: numberFromUnknown(
      record?.evidence_reminder_notification_retry_ready_count ?? record?.evidenceReminderNotificationRetryReadyCount
    ),
    evidence_reminder_notification_pending_retry_count: numberFromUnknown(
      record?.evidence_reminder_notification_pending_retry_count ?? record?.evidenceReminderNotificationPendingRetryCount
    ),
    evidence_reminder_notification_attempt_count: numberFromUnknown(
      record?.evidence_reminder_notification_attempt_count ?? record?.evidenceReminderNotificationAttemptCount
    ),
    evidence_reminder_notification_failure_count: numberFromUnknown(
      record?.evidence_reminder_notification_failure_count ?? record?.evidenceReminderNotificationFailureCount
    ),
    evidence_reminder_notification_max_retry_backoff_seconds: numberFromUnknown(
      record?.evidence_reminder_notification_max_retry_backoff_seconds ?? record?.evidenceReminderNotificationMaxRetryBackoffSeconds
    ),
    latest_evidence_reminder_notification_failure_at:
      stringFromUnknown(record?.latest_evidence_reminder_notification_failure_at) ||
      stringFromUnknown(record?.latestEvidenceReminderNotificationFailureAt) ||
      null,
    latest_evidence_reminder_notification_delivery_at:
      stringFromUnknown(record?.latest_evidence_reminder_notification_delivery_at) ||
      stringFromUnknown(record?.latestEvidenceReminderNotificationDeliveryAt) ||
      null,
    latest_evidence_reminder_notification: latestReminderNotification || reminderNotificationHistory[0] || null,
    evidence_reminder_notification_history: reminderNotificationHistory,
    evidence_history: evidenceHistory,
    checks,
    runbook_steps: runbookSteps,
    message: stringFromUnknown(record?.message) || (
      status === "verified"
        ? "Backup/export verification is ready."
        : status === "handoff-required"
          ? "Backup/export manifest evidence exists, but restore-drill handoff verification still needs attention."
          : "Backup/export verification needs a delivered content-free retention export manifest."
    ),
    generated_at: stringFromUnknown(record?.generated_at) || stringFromUnknown(record?.generatedAt) || null,
  };
}

function normalizeRetentionDashboardPrunePreview(value: unknown): DocumentRetentionDashboardPrunePreview | null {
  const record = recordFromUnknown(value);
  if (!record) return null;

  const rawCandidates = record.candidates;
  const candidates = Array.isArray(rawCandidates)
    ? rawCandidates
      .map(normalizeRetentionDashboardPruneCandidate)
      .filter((candidate): candidate is DocumentRetentionDashboardPruneCandidate => Boolean(candidate))
    : [];
  const rawDocuments = record.documents;
  const documents = Array.isArray(rawDocuments)
    ? rawDocuments
      .map(normalizeRetentionDashboardPruneDocumentSummary)
      .filter((document): document is DocumentRetentionDashboardPruneDocumentSummary => Boolean(document))
    : [];
  const rawSafeguards = record.safeguards;
  const audit = normalizeRetentionDashboardPruneAudit(record.audit);
  const restoreDrill = normalizeRetentionDashboardRestoreDrill(record.restore_drill ?? record.restoreDrill) || audit?.restore_drill || null;
  const rawAuditHistory = record.audit_history ?? record.auditHistory;
  const auditHistory = Array.isArray(rawAuditHistory)
    ? rawAuditHistory
      .map(normalizeRetentionDashboardPruneAudit)
      .filter((item): item is DocumentRetentionDashboardPruneAudit => Boolean(item))
    : audit ? [audit] : [];
  const safeguards = Array.isArray(rawSafeguards)
    ? rawSafeguards.map(item => stringFromUnknown(item)).filter((item): item is string => Boolean(item))
    : [
        "Deletes only unprotected snapshots beyond the keep-latest cap.",
        "Keep-forever and active retain-until snapshots are excluded.",
        "Preview and execution payloads exclude document body content.",
      ];
  const type = record.type === "documents_version_retention_prune_execution"
    ? "documents_version_retention_prune_execution"
    : "documents_version_retention_prune_preview";

  return {
    type,
    mode: type === "documents_version_retention_prune_execution" ? "confirmed-delete" : "dry-run",
    payload_content_free: record.payload_content_free === false || record.payloadContentFree === false ? false : true,
    confirmation_required: record.confirmation_required === false || record.confirmationRequired === false ? false : true,
    confirmation_token: stringFromUnknown(record.confirmation_token) || stringFromUnknown(record.confirmationToken) || "PRUNE_DOCUMENT_VERSION_SNAPSHOTS",
    max_snapshots: numberFromUnknown(record.max_snapshots ?? record.maxSnapshots, 100),
    candidate_limit: numberFromUnknown(record.candidate_limit ?? record.candidateLimit, 100),
    total_candidate_count: numberFromUnknown(record.total_candidate_count ?? record.totalCandidateCount, candidates.length),
    candidate_count: numberFromUnknown(record.candidate_count ?? record.candidateCount, candidates.length),
    limited: record.limited === true,
    documents_count: numberFromUnknown(record.documents_count ?? record.documentsCount, documents.length),
    affected_documents_count: numberFromUnknown(record.affected_documents_count ?? record.affectedDocumentsCount, documents.length),
    documents,
    candidates,
    safeguards,
    audit_id: stringFromUnknown(record.audit_id) || stringFromUnknown(record.auditId) || audit?.audit_id || null,
    audit,
    audit_history: auditHistory,
    restore_drill: restoreDrill,
    scheduled_prune_automation: record.scheduled_prune_automation || record.scheduledPruneAutomation
      ? normalizeRetentionDashboardScheduledPruneAutomation(record.scheduled_prune_automation ?? record.scheduledPruneAutomation)
      : null,
    confirmed: record.confirmed === true,
    requested_by: stringFromUnknown(record.requested_by) || stringFromUnknown(record.requestedBy) || null,
    deleted_count: numberFromUnknown(record.deleted_count ?? record.deletedCount),
    remaining_candidate_count: numberFromUnknown(record.remaining_candidate_count ?? record.remainingCandidateCount),
    executed_at: stringFromUnknown(record.executed_at) || stringFromUnknown(record.executedAt) || undefined,
  };
}

function normalizeDocumentRetentionDashboardReport(value: unknown): DocumentRetentionDashboardReport | null {
  const record = recordFromUnknown(value);
  const windowRecord = recordFromUnknown(record?.window);
  const retentionReport = normalizeDocumentVersionRetentionReport(record?.retention_report ?? record?.retentionReport);
  const rawDocumentSummaries = record?.document_summaries ?? record?.documentSummaries;
  const buckets = Array.isArray(record?.buckets)
    ? record.buckets
      .map(normalizeDocumentVersionRetentionTrendBucket)
      .filter((bucket): bucket is DocumentVersionRetentionTrendBucket => Boolean(bucket))
    : [];
  const documentSummaries = Array.isArray(rawDocumentSummaries)
    ? rawDocumentSummaries
      .map(normalizeRetentionDashboardDocumentSummary)
      .filter((summary): summary is DocumentRetentionDashboardDocumentSummary => Boolean(summary))
    : [];
  const alerts = Array.isArray(record?.alerts)
    ? record.alerts
      .map(normalizeRetentionDashboardAlert)
      .filter((alert): alert is DocumentRetentionDashboardAlert => Boolean(alert))
    : [];

  if (!record || !windowRecord || !retentionReport || buckets.length === 0) return null;
  const days = numberFromUnknown(windowRecord.days, 30);
  const documentsCount = numberFromUnknown(record.documents_count ?? record.documentsCount, documentSummaries.length);
  const returnedDocumentsCount = numberFromUnknown(
    record.returned_documents_count ?? record.returnedDocumentsCount,
    documentSummaries.length
  );
  const exportSchedule = normalizeRetentionDashboardExportSchedule(
    record.export_schedule ?? record.exportSchedule,
    days,
    returnedDocumentsCount
  );
  const policyAutomation = normalizeRetentionDashboardPolicyAutomation(record.policy_automation ?? record.policyAutomation);
  const rawDeliveryHistory = record.delivery_history ?? record.deliveryHistory;
  const deliveryHistory = Array.isArray(rawDeliveryHistory)
    ? rawDeliveryHistory
      .map(item => normalizeRetentionDashboardExportDelivery(item, exportSchedule, alerts, policyAutomation))
      .filter(item => item.delivery_id)
    : [];
  const rawPruneAuditHistory = record.prune_audit_history ?? record.pruneAuditHistory;
  const pruneAuditHistory = Array.isArray(rawPruneAuditHistory)
    ? rawPruneAuditHistory
      .map(normalizeRetentionDashboardPruneAudit)
      .filter((item): item is DocumentRetentionDashboardPruneAudit => Boolean(item))
    : [];
  const exportDelivery = normalizeRetentionDashboardExportDelivery(
    record.export_delivery ?? record.exportDelivery,
    exportSchedule,
    alerts,
    policyAutomation
  );

  return {
    type: record.type === "documents_version_retention_dashboard"
      ? "documents_version_retention_dashboard"
      : undefined,
    schema_version: Number.isFinite(Number(record.schema_version ?? record.schemaVersion))
      ? Number(record.schema_version ?? record.schemaVersion)
      : undefined,
    generated_at: stringFromUnknown(record.generated_at) || stringFromUnknown(record.generatedAt),
    scope: record.scope === "admin" ? "admin" : "accessible",
    window: {
      days,
      from: stringFromUnknown(windowRecord.from),
      to: stringFromUnknown(windowRecord.to),
      bucket: "day",
    },
    retention_report: retentionReport,
    buckets,
    documents_count: documentsCount,
    returned_documents_count: returnedDocumentsCount,
    document_summaries: documentSummaries,
    alerting: normalizeRetentionDashboardAlertingSummary(record.alerting, alerts),
    alerts,
    export_schedule: exportSchedule,
    policy_automation: policyAutomation,
    export_delivery: exportDelivery,
    export_reliability: normalizeRetentionDashboardExportReliability(
      record.export_reliability ?? record.exportReliability,
      deliveryHistory,
      exportDelivery
    ),
    export_worker: normalizeRetentionDashboardExportWorkerStatus(record.export_worker ?? record.exportWorker),
    reminder_notification_worker: normalizeRetentionDashboardExportWorkerStatus(
      record.reminder_notification_worker ?? record.reminderNotificationWorker
    ),
    prune_audit_history: pruneAuditHistory,
    scheduled_prune_automation: normalizeRetentionDashboardScheduledPruneAutomation(
      record.scheduled_prune_automation ?? record.scheduledPruneAutomation
    ),
    backup_verification: normalizeRetentionDashboardBackupVerification(
      record.backup_verification ?? record.backupVerification
    ),
    delivery_history: deliveryHistory,
  };
}

function compareDocumentVersions(a: DocumentVersion, b: DocumentVersion): number {
  return b.version_number - a.version_number || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function readLocalDocumentVersionMap(): Record<string, unknown[]> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DOCUMENT_LOCAL_VERSION_HISTORY_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, unknown[]>>((acc, [documentId, versions]) => {
      if (Array.isArray(versions)) acc[documentId] = versions;
      return acc;
    }, {});
  } catch {
    return {};
  }
}

function writeLocalDocumentVersionMap(map: Record<string, unknown[]>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DOCUMENT_LOCAL_VERSION_HISTORY_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn("Could not persist local document version history:", err);
  }
}

function readLocalDocumentVersions(documentId: string): DocumentVersion[] {
  return normalizeDocumentVersions(readLocalDocumentVersionMap()[documentId] || [])
    .map(version => ({ ...version, source: "local" as const }));
}

function restorableLocalVersion(version: DocumentVersion): boolean {
  return version.content !== undefined || version.content_text !== undefined;
}

function documentVersionSignature(version: Pick<DocumentVersion, "title" | "content" | "content_text" | "metadata">): string {
  return JSON.stringify({
    title: version.title,
    content: version.content || null,
    content_text: version.content_text || "",
    metadata: version.metadata || {},
  });
}

function documentDetailSignature(document: Document | DocumentDetail): string {
  const detail = document as DocumentDetail;
  return documentVersionSignature({
    title: detail.title,
    content: detail.content || null,
    content_text: detail.content_text || "",
    metadata: detail.metadata || {},
  });
}

function documentChangedSinceHistoryOpened(
  openedDocument: Document | DocumentDetail,
  latestDocument: DocumentDetail
): boolean {
  const openedUpdatedAt = openedDocument.updated_at || "";
  const latestUpdatedAt = latestDocument.updated_at || "";
  if (!openedUpdatedAt || !latestUpdatedAt || openedUpdatedAt === latestUpdatedAt) return false;

  const openedDetail = openedDocument as DocumentDetail;
  if (openedDetail.content || openedDetail.content_text || openedDetail.metadata) {
    return documentDetailSignature(openedDocument) !== documentDetailSignature(latestDocument);
  }

  return true;
}

function writeLocalDocumentVersionSnapshot(
  document: DocumentDetail,
  options: { changeNote?: string; authorId?: string } = {}
): DocumentVersion[] {
  if (typeof window === "undefined") return [];

  const map = readLocalDocumentVersionMap();
  const existingRecords = map[document.id] || [];
  const existingVersions = normalizeDocumentVersions(existingRecords).map(version => ({
    ...version,
    source: "local" as const,
  }));
  const content = document.content || null;
  const contentText = document.content_text || "";
  const metadata = document.metadata || {};
  const nextSignature = documentVersionSignature({
    title: document.title,
    content,
    content_text: contentText,
    metadata,
  });
  const latestSignature = existingVersions[0] ? documentVersionSignature(existingVersions[0]) : null;

  if (nextSignature === latestSignature) return existingVersions;

  const now = new Date().toISOString();
  const nextVersionNumber = Math.max(
    document.version_count || 0,
    ...existingVersions.map(version => version.version_number),
    0
  ) + 1;
  const snapshot: DocumentVersion = {
    id: `local-${uuidv4()}`,
    document_id: document.id,
    version_number: nextVersionNumber,
    title: document.title,
    word_count: document.word_count,
      change_note: options.changeNote || "Local snapshot",
      change_type: "local_snapshot",
      retention_policy: "keep-latest",
      origin: "tiptap_editor",
      author_id: options.authorId || document.last_edited_by || document.author_id,
      created_at: document.updated_at || now,
      source: "local",
    content,
    content_text: contentText,
    metadata,
    updated_at: document.updated_at || now,
  };
  const nextVersions = [snapshot, ...existingVersions].slice(0, DOCUMENT_LOCAL_VERSION_HISTORY_LIMIT);
  map[document.id] = nextVersions;
  writeLocalDocumentVersionMap(map);
  return nextVersions;
}

function createLocalDocumentVersionBackup(document: Document | DocumentDetail): Record<string, unknown> {
  const versions = readLocalDocumentVersions(document.id)
    .filter(restorableLocalVersion)
    .map(version => ({
      id: version.id,
      document_id: document.id,
      version_number: version.version_number,
      title: version.title,
      word_count: version.word_count,
      change_note: version.change_note,
      change_type: version.change_type,
      schema_version: version.schema_version || 2,
      retention_policy: version.retention_policy || "keep-latest",
      retained_until: version.retained_until || null,
      origin: version.origin || "local_history",
      client_snapshot_id: version.client_snapshot_id || version.id,
      source_version_id: version.source_version_id,
      author_id: version.author_id,
      created_at: version.created_at,
      source: "local",
      content: version.content || null,
      content_text: version.content_text || "",
      metadata: version.metadata || {},
      updated_at: version.updated_at,
    }));

  return {
    type: DOCUMENT_VERSION_BACKUP_TYPE,
    schema_version: DOCUMENT_VERSION_BACKUP_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    document_id: document.id,
    document_title: document.title,
    versions,
  };
}

function documentVersionRetentionExportSnapshot(
  version: DocumentVersion
): DocumentVersionRetentionExportSnapshot {
  return {
    id: version.id,
    snapshot_id: version.id,
    document_id: version.document_id,
    version_number: version.version_number,
    title: version.title,
    word_count: version.word_count,
    change_note: version.change_note,
    change_type: version.change_type,
    schema_version: version.schema_version,
    retention_policy: documentVersionRetentionPolicyValue(version),
    retained_until: version.retained_until || null,
    origin: version.origin,
    client_snapshot_id: version.client_snapshot_id,
    source_version_id: version.source_version_id,
    author_id: version.author_id,
    content_hash: version.content_hash,
    created_at: version.created_at,
    updated_at: version.updated_at,
  };
}

function createDocumentVersionRetentionExportPayload(
  document: Document | DocumentDetail,
  report: DocumentVersionRetentionReport,
  versions: DocumentVersion[]
): DocumentVersionRetentionExportPayload {
  const durableVersions = versions
    .filter(version => version.source === "durable")
    .sort(compareDocumentVersions);

  return {
    type: "documents_version_retention_report",
    schema_version: report.schema_version || 2,
    generated_at: new Date().toISOString(),
    document_id: document.id,
    document_title: document.title,
    retention_report: report,
    snapshots: durableVersions.map(documentVersionRetentionExportSnapshot),
  };
}

function mergeImportedLocalDocumentVersions(
  documentId: string,
  payload: unknown
): { versions: DocumentVersion[]; added: number } {
  const record = recordFromUnknown(payload);
  const backupDocumentId = record
    ? stringFromUnknown(record.document_id) || stringFromUnknown(record.documentId)
    : undefined;

  if (backupDocumentId && backupDocumentId !== documentId) {
    throw new Error("History backup belongs to a different document.");
  }

  const rawVersions = Array.isArray(payload)
    ? payload
    : record && Array.isArray(record.versions)
      ? record.versions
      : [];
  const importedVersions = normalizeDocumentVersions(rawVersions)
    .filter(version => (!version.document_id || version.document_id === documentId) && restorableLocalVersion(version))
    .map(version => ({
      ...version,
      document_id: documentId,
      source: "local" as const,
    }));

  if (importedVersions.length === 0) {
    throw new Error("No restorable snapshots found.");
  }

  const map = readLocalDocumentVersionMap();
  const existingVersions = normalizeDocumentVersions(map[documentId] || []).map(version => ({
    ...version,
    document_id: documentId,
    source: "local" as const,
  }));
  const seen = new Set(existingVersions.map(documentVersionSignature));
  let nextVersionNumber = Math.max(0, ...existingVersions.map(version => version.version_number));
  const additions: DocumentVersion[] = [];

  [...importedVersions]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .forEach(version => {
      const signature = documentVersionSignature(version);
      if (seen.has(signature)) return;
      seen.add(signature);
      nextVersionNumber += 1;
      additions.push({
        ...version,
        id: `local-${uuidv4()}`,
        document_id: documentId,
        version_number: nextVersionNumber,
        source: "local",
      change_note: version.change_note || "Imported snapshot",
      change_type: version.change_type || "local_import",
      retention_policy: version.retention_policy || "keep-latest",
      retained_until: version.retained_until || null,
      origin: version.origin || "local_history",
      client_snapshot_id: version.client_snapshot_id || version.id,
      source_version_id: version.source_version_id,
      created_at: version.created_at || new Date().toISOString(),
    });
  });

  if (additions.length === 0) {
    return { versions: existingVersions, added: 0 };
  }

  const nextVersions = [...additions, ...existingVersions]
    .sort(compareDocumentVersions)
    .slice(0, DOCUMENT_LOCAL_VERSION_HISTORY_LIMIT);
  map[documentId] = nextVersions;
  writeLocalDocumentVersionMap(map);
  return { versions: nextVersions, added: additions.length };
}

function combineDocumentVersions(
  documentId: string,
  serverVersions: DocumentVersion[],
  durableVersions: DocumentVersion[] = []
): DocumentVersion[] {
  const restorableSignatures = new Set<string>();
  const combined: DocumentVersion[] = [];

  const addVersion = (version: DocumentVersion, source: DocumentVersion["source"]) => {
    const nextVersion = { ...version, document_id: version.document_id || documentId, source };

    if (restorableLocalVersion(nextVersion)) {
      const signature = documentVersionSignature(nextVersion);
      if (restorableSignatures.has(signature)) return;
      restorableSignatures.add(signature);
    }

    combined.push(nextVersion);
  };

  serverVersions.forEach(version => addVersion(version, "server"));
  durableVersions.forEach(version => addVersion(version, "durable"));
  readLocalDocumentVersions(documentId).forEach(version => addVersion(version, "local"));

  return combined.sort(compareDocumentVersions);
}

function documentVersionSourceLabel(version: DocumentVersion): string | null {
  if (version.source === "durable") return "Durable";
  if (version.source === "local") return "Local";
  return null;
}

function documentVersionRetentionLabel(version: DocumentVersion): string | null {
  if (version.retention_policy === "keep-forever") return "Keep forever";
  if (version.retention_policy === "retain-until" && version.retained_until) {
    return `Retain until ${new Date(version.retained_until).toLocaleDateString()}`;
  }
  if (
    version.source === "durable" &&
    (!version.retention_policy || version.retention_policy === "keep-latest")
  ) {
    return "Keep latest";
  }
  return null;
}

function buildDocumentVersionRetentionReport(
  versions: DocumentVersion[],
  maxSnapshots = 100
): DocumentVersionRetentionReport {
  const durableVersions = versions.filter(version => version.source === "durable");
  const now = Date.now();
  const origins = new Map<string, number>();
  const schemaVersions = new Map<number, number>();
  let oldestSnapshotAt: string | null = null;
  let newestSnapshotAt: string | null = null;

  const report: DocumentVersionRetentionReport = {
    max_snapshots: maxSnapshots,
    total_count: durableVersions.length,
    keep_latest_count: 0,
    keep_forever_count: 0,
    retain_until_count: 0,
    active_retain_until_count: 0,
    expired_retain_until_count: 0,
    protected_count: 0,
    prunable_count: 0,
    over_limit_count: Math.max(0, durableVersions.length - maxSnapshots),
    oldest_snapshot_at: null,
    newest_snapshot_at: null,
    origins: [],
    schema_versions: [],
  };

  durableVersions.forEach(version => {
    const retentionPolicy = documentVersionRetentionPolicyValue(version);
    const retainedUntilTime = version.retained_until ? new Date(version.retained_until).getTime() : Number.NaN;
    const createdAtTime = new Date(version.created_at).getTime();

    if (retentionPolicy === "keep-forever") {
      report.keep_forever_count += 1;
      report.protected_count += 1;
    } else if (retentionPolicy === "retain-until") {
      report.retain_until_count += 1;
      if (Number.isFinite(retainedUntilTime) && retainedUntilTime > now) {
        report.active_retain_until_count += 1;
        report.protected_count += 1;
      } else {
        report.expired_retain_until_count += 1;
        report.prunable_count += 1;
      }
    } else {
      report.keep_latest_count += 1;
      report.prunable_count += 1;
    }

    const origin = version.origin || "legacy";
    origins.set(origin, (origins.get(origin) || 0) + 1);

    const schemaVersion = Number(version.schema_version || 0);
    if (Number.isFinite(schemaVersion) && schemaVersion > 0) {
      schemaVersions.set(schemaVersion, (schemaVersions.get(schemaVersion) || 0) + 1);
    }

    if (Number.isFinite(createdAtTime)) {
      if (!oldestSnapshotAt || createdAtTime < new Date(oldestSnapshotAt).getTime()) {
        oldestSnapshotAt = version.created_at;
      }
      if (!newestSnapshotAt || createdAtTime > new Date(newestSnapshotAt).getTime()) {
        newestSnapshotAt = version.created_at;
      }
    }
  });

  report.oldest_snapshot_at = oldestSnapshotAt;
  report.newest_snapshot_at = newestSnapshotAt;
  report.origins = Array.from(origins.entries())
    .map(([origin, count]) => ({ origin, count }))
    .sort((a, b) => b.count - a.count || a.origin.localeCompare(b.origin));
  report.schema_versions = Array.from(schemaVersions.entries())
    .map(([schema_version, count]) => ({ schema_version, count }))
    .sort((a, b) => b.count - a.count || b.schema_version - a.schema_version);

  return report;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function nextWeeklyRetentionExportAt(now = new Date()): Date {
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    9,
    0,
    0,
    0
  ));

  while (next <= now || next.getUTCDay() !== 1) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next;
}

function retentionDashboardSeverityRank(severity: DocumentRetentionDashboardAlertSeverity): number {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}

function formatRetentionDashboardBackoff(seconds: number): string {
  const normalizedSeconds = Math.max(0, Math.floor(seconds));
  if (normalizedSeconds <= 0) return "None";
  const hours = Math.floor(normalizedSeconds / 3600);
  const minutes = Math.floor((normalizedSeconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${Math.max(1, minutes)}m`;
}

function formatRetentionDashboardDuration(ms: number | null | undefined): string {
  const normalizedMs = Math.max(0, Math.floor(Number(ms) || 0));
  if (normalizedMs <= 0) return "0ms";
  if (normalizedMs < 1000) return `${normalizedMs}ms`;
  const seconds = Math.round(normalizedMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function createRetentionDashboardAlert(
  alert: Omit<DocumentRetentionDashboardAlert, "risk_score"> & { risk_score?: number }
): DocumentRetentionDashboardAlert {
  return {
    risk_score: 0,
    ...alert,
  };
}

function createRetentionDashboardAlerts(
  retentionReport: DocumentVersionRetentionReport,
  documentSummaries: DocumentRetentionDashboardDocumentSummary[],
  maxAlerts = 20
): DocumentRetentionDashboardAlert[] {
  const alerts: DocumentRetentionDashboardAlert[] = [];

  if (retentionReport.expired_retain_until_count > 0) {
    alerts.push(createRetentionDashboardAlert({
      id: "dashboard-expired-retain-until",
      type: "expired-retain-until",
      severity: "critical",
      scope: "dashboard",
      document_id: null,
      title: null,
      count: retentionReport.expired_retain_until_count,
      message: `${retentionReport.expired_retain_until_count} retained snapshot${retentionReport.expired_retain_until_count === 1 ? " has" : "s have"} expired retain-until dates.`,
      recommended_action: "Review expired retained snapshots and move them to keep-latest or extend their retention date.",
    }));
  }

  if (retentionReport.over_limit_count > 0) {
    alerts.push(createRetentionDashboardAlert({
      id: "dashboard-over-snapshot-cap",
      type: "over-snapshot-cap",
      severity: "warning",
      scope: "dashboard",
      document_id: null,
      title: null,
      count: retentionReport.over_limit_count,
      message: `${retentionReport.over_limit_count} keep-latest snapshot${retentionReport.over_limit_count === 1 ? " is" : "s are"} beyond the configured retention cap.`,
      recommended_action: "Export the retention report, then prune or protect snapshots that need explicit retention.",
    }));
  }

  if (retentionReport.prunable_count >= 10) {
    alerts.push(createRetentionDashboardAlert({
      id: "dashboard-prunable-volume",
      type: "prunable-volume",
      severity: "info",
      scope: "dashboard",
      document_id: null,
      title: null,
      count: retentionReport.prunable_count,
      message: `${retentionReport.prunable_count} snapshots are currently prunable under keep-latest retention.`,
      recommended_action: "Include prunable posture in the next scheduled retention export.",
    }));
  }

  documentSummaries.forEach(summary => {
    if (summary.expired_retain_until_count > 0) {
      alerts.push(createRetentionDashboardAlert({
        id: `document-expired-retain-until:${summary.document_id}`,
        type: "expired-retain-until",
        severity: "critical",
        scope: "document",
        document_id: summary.document_id,
        title: summary.title,
        count: summary.expired_retain_until_count,
        risk_score: summary.risk_score,
        message: `${summary.title} has ${summary.expired_retain_until_count} expired retain-until snapshot${summary.expired_retain_until_count === 1 ? "" : "s"}.`,
        recommended_action: "Open Version History for this document and update expired retain-until policies.",
      }));
    }

    if (summary.over_limit_count > 0) {
      alerts.push(createRetentionDashboardAlert({
        id: `document-over-snapshot-cap:${summary.document_id}`,
        type: "over-snapshot-cap",
        severity: "warning",
        scope: "document",
        document_id: summary.document_id,
        title: summary.title,
        count: summary.over_limit_count,
        risk_score: summary.risk_score,
        message: `${summary.title} is ${summary.over_limit_count} snapshot${summary.over_limit_count === 1 ? "" : "s"} over the keep-latest cap.`,
        recommended_action: "Review document history and protect snapshots that should survive pruning.",
      }));
    }
  });

  return alerts
    .sort((a, b) => (
      retentionDashboardSeverityRank(b.severity) - retentionDashboardSeverityRank(a.severity) ||
      b.count - a.count ||
      b.risk_score - a.risk_score ||
      a.id.localeCompare(b.id)
    ))
    .slice(0, Math.max(1, maxAlerts));
}

function createRetentionDashboardAlertingSummary(
  alerts: DocumentRetentionDashboardAlert[],
  maxAlerts = 20
): DocumentRetentionDashboardAlertingSummary {
  return {
    max_alerts: maxAlerts,
    alert_count: alerts.length,
    critical_count: alerts.filter(alert => alert.severity === "critical").length,
    warning_count: alerts.filter(alert => alert.severity === "warning").length,
  };
}

function createRetentionDashboardExportSchedule(
  days: number,
  maxDocuments: number
): DocumentRetentionDashboardExportSchedule {
  return {
    cadence: "weekly",
    next_export_at: nextWeeklyRetentionExportAt().toISOString(),
    timezone: "UTC",
    format: "json",
    content_free: true,
    retention_window_days: days,
    max_documents: maxDocuments,
    includes: ["retention_report", "daily_buckets", "document_summaries", "alerts"],
  };
}

function createRetentionDashboardPolicyAction(
  action: DocumentRetentionDashboardPolicyAction
): DocumentRetentionDashboardPolicyAction {
  return action;
}

function createRetentionDashboardPolicyAutomationPlan(
  retentionReport: DocumentVersionRetentionReport,
  documentSummaries: DocumentRetentionDashboardDocumentSummary[],
  maxActions = 20
): DocumentRetentionDashboardPolicyAutomation {
  const actions: DocumentRetentionDashboardPolicyAction[] = [];

  if (retentionReport.expired_retain_until_count > 0) {
    actions.push(createRetentionDashboardPolicyAction({
      id: "dashboard-review-expired-retain-until",
      type: "review-expired-retain-until",
      severity: "critical",
      scope: "dashboard",
      document_id: null,
      title: null,
      count: retentionReport.expired_retain_until_count,
      reason: "Expired retain-until snapshots require an admin decision before retention is shortened or extended.",
      suggested_action: "Review expired retain-until snapshots and either extend retained_until or move them back to keep-latest.",
      safe_to_auto_apply: false,
      requires_admin_confirmation: true,
    }));
  }

  if (retentionReport.over_limit_count > 0) {
    actions.push(createRetentionDashboardPolicyAction({
      id: "dashboard-prune-over-cap-preview",
      type: "prune-over-cap-preview",
      severity: "warning",
      scope: "dashboard",
      document_id: null,
      title: null,
      count: retentionReport.over_limit_count,
      reason: "The keep-latest retention cap has overflowed; pruning candidates should be reviewed before deletion.",
      suggested_action: "Run a prune preview, export the dashboard package, then prune unprotected over-cap snapshots.",
      safe_to_auto_apply: false,
      requires_admin_confirmation: true,
    }));
  }

  documentSummaries.forEach(summary => {
    if (summary.expired_retain_until_count > 0) {
      actions.push(createRetentionDashboardPolicyAction({
        id: `document-review-expired-retain-until:${summary.document_id}`,
        type: "review-expired-retain-until",
        severity: "critical",
        scope: "document",
        document_id: summary.document_id,
        title: summary.title,
        count: summary.expired_retain_until_count,
        reason: "This document has expired retain-until snapshots.",
        suggested_action: "Open the document Version History and update expired retain-until policies.",
        safe_to_auto_apply: false,
        requires_admin_confirmation: true,
      }));
    }

    if (summary.over_limit_count > 0) {
      actions.push(createRetentionDashboardPolicyAction({
        id: `document-prune-over-cap-preview:${summary.document_id}`,
        type: "prune-over-cap-preview",
        severity: "warning",
        scope: "document",
        document_id: summary.document_id,
        title: summary.title,
        count: summary.over_limit_count,
        reason: "This document is over the keep-latest snapshot cap.",
        suggested_action: "Review document history and protect snapshots that should not be pruned.",
        safe_to_auto_apply: false,
        requires_admin_confirmation: true,
      }));
    }
  });

  const limitedActions = actions
    .sort((a, b) => (
      retentionDashboardSeverityRank(b.severity) - retentionDashboardSeverityRank(a.severity) ||
      b.count - a.count ||
      a.id.localeCompare(b.id)
    ))
    .slice(0, maxActions);

  return {
    mode: "dry-run",
    max_actions: maxActions,
    action_count: limitedActions.length,
    destructive_action_count: limitedActions.filter(action => action.type.includes("prune")).length,
    requires_admin_confirmation: limitedActions.length > 0,
    actions: limitedActions,
  };
}

function createRetentionDashboardExportDeliveryPlan(
  schedule: DocumentRetentionDashboardExportSchedule,
  alerts: DocumentRetentionDashboardAlert[],
  policyAutomation: DocumentRetentionDashboardPolicyAutomation
): DocumentRetentionDashboardExportDelivery {
  const seed = `documents-retention:${schedule.next_export_at || "pending"}:${schedule.retention_window_days}:${schedule.max_documents}`;

  return {
    status: "scheduled",
    background_worker: "documents-retention-export",
    delivery_id: `documents-retention-${Math.abs(seed.length * 2654435761).toString(16).slice(0, 8)}`,
    idempotency_key: seed,
    next_attempt_at: schedule.next_export_at || null,
    next_retry_at: null,
    last_delivery_at: null,
    last_failure_at: null,
    last_failure_message: "",
    attempt_count: 0,
    failure_count: 0,
    retry_backoff_seconds: 0,
    channels: ["admin-dashboard-download", "background-export-worker"],
    payload_type: "documents_version_retention_dashboard",
    payload_content_free: true,
    pending_alert_count: alerts.length,
    pending_policy_action_count: policyAutomation.action_count,
    requires_worker: true,
    persisted: false,
    delivery_history_count: 0,
    last_delivery_status: null,
    last_delivery_message: "",
    delivery_events: [],
    generated_at: new Date().toISOString(),
    created_at: null,
    updated_at: null,
    retention_window_days: schedule.retention_window_days,
    max_documents: schedule.max_documents,
  };
}

function documentVersionTrendDateKey(value: string): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function buildDocumentVersionRetentionTrendReport(
  versions: DocumentVersion[],
  report: DocumentVersionRetentionReport,
  days = 30
): DocumentVersionRetentionTrendReport {
  const durableVersions = versions.filter(version => version.source === "durable");
  const normalizedDays = Math.max(1, Math.min(Math.floor(days) || 30, 365));
  const today = startOfUtcDay(new Date());
  const windowStart = addUtcDays(today, -(normalizedDays - 1));
  const buckets: DocumentVersionRetentionTrendBucket[] = [];

  for (let index = 0; index < normalizedDays; index += 1) {
    const startAt = addUtcDays(windowStart, index);
    const endAt = addUtcDays(startAt, 1);
    const date = startAt.toISOString().slice(0, 10);
    const createdInBucket = durableVersions.filter(version => documentVersionTrendDateKey(version.created_at) === date);
    const cumulative = durableVersions.filter(version => {
      const createdAt = new Date(version.created_at).getTime();
      return Number.isFinite(createdAt) && createdAt < endAt.getTime();
    });
    const cumulativeReport = buildDocumentVersionRetentionReport(cumulative, report.max_snapshots);
    const originCounts = createdInBucket.reduce<Map<string, number>>((acc, version) => {
      const origin = version.origin || "legacy";
      acc.set(origin, (acc.get(origin) || 0) + 1);
      return acc;
    }, new Map());
    const [topOrigin] = Array.from(originCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    buckets.push({
      date,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      created_count: createdInBucket.length,
      cumulative_count: cumulativeReport.total_count,
      keep_latest_count: cumulativeReport.keep_latest_count,
      keep_forever_count: cumulativeReport.keep_forever_count,
      retain_until_count: cumulativeReport.retain_until_count,
      active_retain_until_count: cumulativeReport.active_retain_until_count,
      expired_retain_until_count: cumulativeReport.expired_retain_until_count,
      protected_count: cumulativeReport.protected_count,
      prunable_count: cumulativeReport.prunable_count,
      over_limit_count: cumulativeReport.over_limit_count,
      top_origin: topOrigin?.[0] || null,
      top_origin_count: topOrigin?.[1] || 0,
    });
  }

  return {
    type: "documents_version_retention_trends",
    schema_version: report.schema_version || 2,
    generated_at: new Date().toISOString(),
    window: {
      days: normalizedDays,
      from: windowStart.toISOString(),
      to: addUtcDays(today, 1).toISOString(),
      bucket: "day",
    },
    retention_report: report,
    buckets,
  };
}

function mergeRetentionReportOrigins(reports: DocumentVersionRetentionReport[]): Array<{ origin: string; count: number }> {
  const counts = new Map<string, number>();

  reports.forEach(report => {
    (report.origins || []).forEach(entry => {
      counts.set(entry.origin, (counts.get(entry.origin) || 0) + entry.count);
    });
  });

  return Array.from(counts.entries())
    .map(([origin, count]) => ({ origin, count }))
    .sort((a, b) => b.count - a.count || a.origin.localeCompare(b.origin));
}

function mergeRetentionReportSchemaVersions(
  reports: DocumentVersionRetentionReport[]
): Array<{ schema_version: number; count: number }> {
  const counts = new Map<number, number>();

  reports.forEach(report => {
    (report.schema_versions || []).forEach(entry => {
      counts.set(entry.schema_version, (counts.get(entry.schema_version) || 0) + entry.count);
    });
  });

  return Array.from(counts.entries())
    .map(([schema_version, count]) => ({ schema_version, count }))
    .sort((a, b) => b.count - a.count || b.schema_version - a.schema_version);
}

function combineDocumentVersionRetentionReports(
  reports: DocumentVersionRetentionReport[],
  maxSnapshots = 100
): DocumentVersionRetentionReport {
  const dateValues = reports.flatMap(report => [
    report.oldest_snapshot_at,
    report.newest_snapshot_at,
  ]).filter((value): value is string => Boolean(value));
  const oldest = dateValues
    .map(value => new Date(value))
    .filter(date => Number.isFinite(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const newest = dateValues
    .map(value => new Date(value))
    .filter(date => Number.isFinite(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    schema_version: reports.find(report => report.schema_version)?.schema_version || 2,
    max_snapshots: maxSnapshots,
    total_count: reports.reduce((total, report) => total + report.total_count, 0),
    keep_latest_count: reports.reduce((total, report) => total + report.keep_latest_count, 0),
    keep_forever_count: reports.reduce((total, report) => total + report.keep_forever_count, 0),
    retain_until_count: reports.reduce((total, report) => total + report.retain_until_count, 0),
    active_retain_until_count: reports.reduce((total, report) => total + report.active_retain_until_count, 0),
    expired_retain_until_count: reports.reduce((total, report) => total + report.expired_retain_until_count, 0),
    protected_count: reports.reduce((total, report) => total + report.protected_count, 0),
    prunable_count: reports.reduce((total, report) => total + report.prunable_count, 0),
    over_limit_count: reports.reduce((total, report) => total + report.over_limit_count, 0),
    oldest_snapshot_at: oldest?.toISOString() || null,
    newest_snapshot_at: newest?.toISOString() || null,
    origins: mergeRetentionReportOrigins(reports),
    schema_versions: mergeRetentionReportSchemaVersions(reports),
  };
}

function combineDocumentVersionRetentionTrendReports(
  reports: DocumentVersionRetentionTrendReport[],
  days = 30
): DocumentVersionRetentionTrendReport {
  const normalizedDays = Math.max(1, Math.min(Math.floor(days) || 30, 365));
  const today = startOfUtcDay(new Date());
  const windowStart = addUtcDays(today, -(normalizedDays - 1));
  const reportByDate = new Map<string, DocumentVersionRetentionTrendBucket[]>();

  reports.forEach(report => {
    report.buckets.forEach(bucket => {
      reportByDate.set(bucket.date, [...(reportByDate.get(bucket.date) || []), bucket]);
    });
  });

  const buckets = Array.from({ length: normalizedDays }, (_item, index) => {
    const startAt = addUtcDays(windowStart, index);
    const endAt = addUtcDays(startAt, 1);
    const date = startAt.toISOString().slice(0, 10);
    const dayBuckets = reportByDate.get(date) || [];

    return {
      date,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      created_count: dayBuckets.reduce((total, bucket) => total + bucket.created_count, 0),
      cumulative_count: dayBuckets.reduce((total, bucket) => total + bucket.cumulative_count, 0),
      keep_latest_count: dayBuckets.reduce((total, bucket) => total + bucket.keep_latest_count, 0),
      keep_forever_count: dayBuckets.reduce((total, bucket) => total + bucket.keep_forever_count, 0),
      retain_until_count: dayBuckets.reduce((total, bucket) => total + bucket.retain_until_count, 0),
      active_retain_until_count: dayBuckets.reduce((total, bucket) => total + bucket.active_retain_until_count, 0),
      expired_retain_until_count: dayBuckets.reduce((total, bucket) => total + bucket.expired_retain_until_count, 0),
      protected_count: dayBuckets.reduce((total, bucket) => total + bucket.protected_count, 0),
      prunable_count: dayBuckets.reduce((total, bucket) => total + bucket.prunable_count, 0),
      over_limit_count: dayBuckets.reduce((total, bucket) => total + bucket.over_limit_count, 0),
      top_origin: null,
      top_origin_count: 0,
    };
  });

  return {
    type: "documents_version_retention_trends",
    schema_version: reports.find(report => report.schema_version)?.schema_version || 2,
    generated_at: new Date().toISOString(),
    window: {
      days: normalizedDays,
      from: windowStart.toISOString(),
      to: addUtcDays(today, 1).toISOString(),
      bucket: "day",
    },
    retention_report: null,
    buckets,
  };
}

function createDocumentRetentionDashboardFromTrendReports(
  entries: Array<{ document: Document; trend: DocumentVersionRetentionTrendReport }>,
  days = 30
): DocumentRetentionDashboardReport | null {
  if (entries.length === 0) return null;

  const retentionReports = entries
    .map(entry => entry.trend.retention_report)
    .filter((report): report is DocumentVersionRetentionReport => Boolean(report));
  const maxSnapshots = retentionReports[0]?.max_snapshots || 100;
  const retentionReport = combineDocumentVersionRetentionReports(retentionReports, maxSnapshots);
  const trendReport = combineDocumentVersionRetentionTrendReports(entries.map(entry => entry.trend), days);
  const documentSummaries = entries.map(({ document, trend }) => {
    const report = trend.retention_report || buildDocumentVersionRetentionReport([], maxSnapshots);
    const latestBucket = trend.buckets[trend.buckets.length - 1] || null;
    const [primaryOrigin] = report.origins || [];
    const [primarySchemaVersion] = report.schema_versions || [];
    const riskScore =
      report.over_limit_count * 5 +
      report.expired_retain_until_count * 4 +
      report.prunable_count;

    return {
      document_id: document.id,
      title: document.title,
      latest_version_number: null,
      latest_snapshot_at: report.newest_snapshot_at || document.updated_at,
      snapshot_count: report.total_count,
      captured_in_window_count: trend.buckets.reduce((total, bucket) => total + bucket.created_count, 0),
      protected_count: report.protected_count,
      prunable_count: report.prunable_count,
      over_limit_count: report.over_limit_count,
      expired_retain_until_count: report.expired_retain_until_count,
      keep_latest_count: report.keep_latest_count,
      keep_forever_count: report.keep_forever_count,
      retain_until_count: report.retain_until_count,
      primary_origin: primaryOrigin?.origin || latestBucket?.top_origin || null,
      primary_origin_count: primaryOrigin?.count || latestBucket?.top_origin_count || 0,
      schema_version: primarySchemaVersion?.schema_version || null,
      risk_score: Math.max(0, riskScore),
    };
  }).sort((a, b) => (
    b.risk_score - a.risk_score ||
    b.prunable_count - a.prunable_count ||
    b.snapshot_count - a.snapshot_count
  ));
  const alerts = createRetentionDashboardAlerts(retentionReport, documentSummaries);
  const exportSchedule = createRetentionDashboardExportSchedule(days, documentSummaries.length);
  const policyAutomation = createRetentionDashboardPolicyAutomationPlan(retentionReport, documentSummaries);
  const exportDelivery = createRetentionDashboardExportDeliveryPlan(exportSchedule, alerts, policyAutomation);

  return {
    type: "documents_version_retention_dashboard",
    schema_version: retentionReport.schema_version || 2,
    generated_at: new Date().toISOString(),
    scope: "accessible",
    window: trendReport.window,
    retention_report: retentionReport,
    buckets: trendReport.buckets,
    documents_count: entries.length,
    returned_documents_count: documentSummaries.length,
    document_summaries: documentSummaries,
    alerting: createRetentionDashboardAlertingSummary(alerts),
    alerts,
    export_schedule: exportSchedule,
    policy_automation: policyAutomation,
    export_delivery: exportDelivery,
    export_reliability: normalizeRetentionDashboardExportReliability(null, [exportDelivery], exportDelivery),
    export_worker: normalizeRetentionDashboardExportWorkerStatus(null),
    reminder_notification_worker: normalizeRetentionDashboardExportWorkerStatus({
      type: "documents_retention_reminder_notification_worker_status",
      worker: "documents-retention-reminder-notification",
    }),
    prune_audit_history: [],
    scheduled_prune_automation: normalizeRetentionDashboardScheduledPruneAutomation(null),
    backup_verification: normalizeRetentionDashboardBackupVerification(null),
    delivery_history: [exportDelivery],
  };
}

function retentionReportPrimaryOrigin(report: DocumentVersionRetentionReport): string {
  const [origin] = report.origins || [];
  if (!origin) return "Mixed";
  return `${documentVersionOriginLabel(origin.origin)} (${origin.count})`;
}

function documentVersionOriginLabel(value?: string): string {
  const normalized = (value || "").trim();
  if (!normalized) return "Legacy";
  if (normalized === "tiptap_editor") return "Tiptap editor";
  if (normalized === "version_history_panel") return "Version history panel";
  if (normalized === "local_history") return "Local history";
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function compactDocumentVersionId(value?: string): string | null {
  const normalized = (value || "").trim();
  if (!normalized) return null;
  return normalized.length > 22
    ? `${normalized.slice(0, 10)}...${normalized.slice(-8)}`
    : normalized;
}

function documentVersionProvenanceItems(version: DocumentVersion): Array<{ label: string; value: string }> {
  const items: Array<{ label: string; value: string | null | undefined }> = [
    { label: "Origin", value: documentVersionOriginLabel(version.origin) },
    { label: "Schema", value: version.schema_version ? `v${version.schema_version}` : "Legacy" },
    { label: "Captured", value: new Date(version.created_at).toLocaleString() },
    { label: "Change type", value: version.change_type },
    { label: "Author", value: version.author_id },
    { label: "Content hash", value: compactDocumentVersionId(version.content_hash) },
    { label: "Snapshot ID", value: compactDocumentVersionId(version.id) },
    { label: "Client ID", value: compactDocumentVersionId(version.client_snapshot_id) },
    { label: "Source version", value: compactDocumentVersionId(version.source_version_id) },
  ];

  return items.filter((item): item is { label: string; value: string } => Boolean(item.value));
}

function documentVersionRestoresThroughPatch(version: DocumentVersion): boolean {
  return version.source === "local" || version.source === "durable";
}

function documentVersionPayload(version: DocumentVersion): Record<string, unknown> {
  return {
    id: version.id,
    document_id: version.document_id,
    version_number: version.version_number,
    schema_version: version.schema_version || 2,
    title: version.title,
    word_count: version.word_count,
    change_note: version.change_note,
    change_type: version.change_type,
    retention_policy: version.retention_policy || "keep-latest",
    retained_until: version.retained_until || null,
    origin: version.origin || (version.source === "local" ? "local_history" : "tiptap_editor"),
    client_snapshot_id: version.client_snapshot_id || version.id,
    source_version_id: version.source_version_id,
    author_id: version.author_id,
    created_at: version.created_at,
    source: version.source,
    content: version.content || null,
    content_text: version.content_text || "",
    metadata: version.metadata || {},
    updated_at: version.updated_at || version.created_at,
  };
}

function documentDetailVersionPayload(
  document: DocumentDetail,
  options: { changeNote?: string; changeType?: string; authorId?: string } = {}
): Record<string, unknown> {
  return {
    document_id: document.id,
    schema_version: 2,
    title: document.title,
    word_count: document.word_count,
    change_note: options.changeNote || "Saved from Tiptap editor",
    change_type: options.changeType || "tiptap_snapshot",
    retention_policy: "keep-latest",
    retained_until: null,
    origin: options.changeType === "pre_restore_snapshot" || options.changeType === "restored_snapshot"
      ? "version_history_panel"
      : "tiptap_editor",
    author_id: options.authorId || document.last_edited_by || document.author_id,
    content: document.content || null,
    content_text: document.content_text || "",
    metadata: document.metadata || {},
    updated_at: document.updated_at,
  };
}

function getDocumentsDurableVersionHistoryBases(): string[] {
  const historyPath = DOCUMENT_DURABLE_VERSION_HISTORY_PATH;
  const configuredUrl = (
    (import.meta.env.VITE_DOCUMENTS_HISTORY_URL as string | undefined) ||
    (import.meta.env.VITE_DOCUMENTS_HISTORY_API_BASE as string | undefined)
  )?.trim();

  if (configuredUrl) {
    return [configuredUrl.replace(/\/$/, "")];
  }

  if (typeof window === "undefined") {
    return [historyPath];
  }

  const configuredPort = (
    (import.meta.env.VITE_DOCUMENTS_HISTORY_PORT as string | undefined) ||
    (import.meta.env.VITE_DOCUMENTS_COLLABORATION_PORT as string | undefined)
  )?.trim();
  const domainServerUrl = (import.meta.env.DOMAIN_SERVER as string | undefined)?.trim();
  const domainServerPort = (() => {
    if (!domainServerUrl) return "";
    try {
      return new URL(domainServerUrl).port;
    } catch {
      return "";
    }
  })();
  const localBackendPort = configuredPort || domainServerPort || "3080";
  const localBackendBase = `${window.location.protocol}//${window.location.hostname}:${localBackendPort}${historyPath}`;

  if (import.meta.env.DEV && window.location.port && window.location.port !== localBackendPort) {
    return Array.from(new Set([historyPath, localBackendBase]));
  }

  return [historyPath];
}

async function documentsHistoryFetch<T = unknown>(
  path: string,
  authToken: string | undefined,
  init: RequestInit = {}
): Promise<T> {
  if (!authToken) {
    throw new Error("Document history auth token unavailable");
  }

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> || {}),
    Authorization: `Bearer ${authToken}`,
  };

  if (init.body && typeof init.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const bases = getDocumentsDurableVersionHistoryBases();
  let lastError: unknown = null;

  for (let index = 0; index < bases.length; index += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    let response: Response;

    try {
      response = await fetch(`${bases[index]}${path}`, {
        ...init,
        headers,
        credentials: init.credentials || "include",
        signal: init.signal || controller.signal,
      });
    } catch (err) {
      lastError = err;

      if (index >= bases.length - 1) {
        throw err;
      }

      continue;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const canRetry = index < bases.length - 1 && (
        response.status === 401 ||
        response.status === 403 ||
        response.status === 404 ||
        response.status >= 500
      );

      if (canRetry) {
        lastError = new Error(`Document history request failed: ${response.status}`);
        continue;
      }

      throw new Error(`Document history request failed: ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type") || "";
    const looksJson = contentType.toLowerCase().includes("application/json");

    if (!looksJson) {
      const nonJsonError = new Error("Document history request returned non-JSON response");

      if (index < bases.length - 1) {
        lastError = nonJsonError;
        continue;
      }

      throw nonJsonError;
    }

    try {
      return await response.json() as T;
    } catch (err) {
      if (index < bases.length - 1) {
        lastError = err;
        continue;
      }

      throw err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Document history request failed");
}

async function loadDurableDocumentVersions(
  documentId: string,
  userId: string,
  authToken: string | undefined
): Promise<DurableDocumentVersionHistory> {
  if (!authToken) {
    return { versions: [], retentionReport: null, retentionTrendReport: null };
  }

  const params = new URLSearchParams({ user_id: userId, limit: "50" });
  const payload = await documentsHistoryFetch<unknown>(
    `/${encodeURIComponent(documentId)}/versions?${params.toString()}`,
    authToken
  );

  return {
    versions: normalizeDocumentVersions(payload).map(version => ({ ...version, source: "durable" as const })),
    retentionReport: documentVersionRetentionReportFromPayload(payload),
    retentionTrendReport: null,
  };
}

async function loadDurableDocumentRetentionReport(
  documentId: string,
  userId: string,
  authToken: string | undefined
): Promise<Record<string, unknown>> {
  if (!authToken) {
    throw new Error("Document history auth token unavailable");
  }

  const params = new URLSearchParams({ user_id: userId });
  const payload = await documentsHistoryFetch<Record<string, unknown>>(
    `/${encodeURIComponent(documentId)}/retention-report?${params.toString()}`,
    authToken
  );

  return payload;
}

async function loadDurableDocumentRetentionTrends(
  documentId: string,
  userId: string,
  authToken: string | undefined,
  days = 30
): Promise<DocumentVersionRetentionTrendReport | null> {
  if (!authToken) {
    return null;
  }

  const params = new URLSearchParams({ user_id: userId, days: String(days) });
  const payload = await documentsHistoryFetch<unknown>(
    `/${encodeURIComponent(documentId)}/retention-trends?${params.toString()}`,
    authToken
  );

  return documentVersionRetentionTrendFromPayload(payload);
}

async function loadAdminDocumentRetentionDashboard(
  userId: string,
  authToken: string | undefined,
  days = 30
): Promise<DocumentRetentionDashboardReport | null> {
  if (!authToken) {
    return null;
  }

  const params = new URLSearchParams({
    user_id: userId,
    days: String(days),
    max_documents: "50",
    max_alerts: "20",
    max_automation_actions: "20",
  });
  const payload = await documentsHistoryFetch<unknown>(
    `/admin/retention-dashboard?${params.toString()}`,
    authToken
  );

  return normalizeDocumentRetentionDashboardReport(payload);
}

async function dispatchAdminDocumentRetentionExports(
  userId: string,
  authToken: string | undefined,
  limit = 10
): Promise<DocumentRetentionDashboardDispatchResult> {
  if (!authToken) {
    throw new Error("Document history auth token unavailable");
  }

  const params = new URLSearchParams({ user_id: userId });
  const payload = await documentsHistoryFetch<Record<string, unknown>>(
    `/admin/retention-dashboard/dispatch?${params.toString()}`,
    authToken,
    {
      method: "POST",
      body: JSON.stringify({ limit }),
    }
  );
  const deliveries = Array.isArray(payload.deliveries)
    ? payload.deliveries
      .map(item => normalizeRetentionDashboardExportDelivery(
        item,
        createRetentionDashboardExportSchedule(30, 50),
        [],
        normalizeRetentionDashboardPolicyAutomation(null)
      ))
      .filter(delivery => delivery.delivery_id)
    : [];

  return {
    type: payload.type === "documents_version_retention_export_dispatch"
      ? "documents_version_retention_export_dispatch"
      : undefined,
    attempted_count: numberFromUnknown(payload.attempted_count ?? payload.attemptedCount),
    dispatched_count: numberFromUnknown(payload.dispatched_count ?? payload.dispatchedCount),
    failed_count: numberFromUnknown(payload.failed_count ?? payload.failedCount),
    deliveries,
  };
}

async function recordAdminDocumentRetentionBackupEvidence(
  userId: string,
  authToken: string | undefined
): Promise<DocumentRetentionBackupEvidenceRecordResult> {
  if (!authToken) {
    throw new Error("Document history auth token unavailable");
  }

  const params = new URLSearchParams({ user_id: userId });
  const payload = await documentsHistoryFetch<Record<string, unknown>>(
    `/admin/retention-dashboard/backup-verification/evidence?${params.toString()}`,
    authToken,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );

  return {
    type: payload.type === "documents_version_retention_backup_verification_evidence_record"
      ? "documents_version_retention_backup_verification_evidence_record"
      : undefined,
    payload_content_free: payload.payload_content_free === false || payload.payloadContentFree === false ? false : true,
    created: payload.created === true,
    evidence: normalizeRetentionDashboardRunbookEvidence(payload.evidence),
    verification: normalizeRetentionDashboardBackupVerification(payload.verification),
  };
}

async function verifyAdminDocumentRetentionRestoreDownload(
  userId: string,
  authToken: string | undefined,
  manifestId?: string | null
): Promise<DocumentRetentionRestoreDownloadVerification | null> {
  if (!authToken) {
    throw new Error("Document history auth token unavailable");
  }

  const params = new URLSearchParams({ user_id: userId });
  const payload = await documentsHistoryFetch<unknown>(
    `/admin/retention-dashboard/backup-verification/restore-download?${params.toString()}`,
    authToken,
    {
      method: "POST",
      body: JSON.stringify(manifestId ? { manifest_id: manifestId } : {}),
    }
  );

  return normalizeRetentionRestoreDownloadVerification(payload);
}

async function notifyAdminDocumentRetentionEvidenceReminder(
  userId: string,
  authToken: string | undefined
): Promise<DocumentRetentionReminderNotificationDispatchResult> {
  if (!authToken) {
    throw new Error("Document history auth token unavailable");
  }

  const params = new URLSearchParams({ user_id: userId });
  const payload = await documentsHistoryFetch<Record<string, unknown>>(
    `/admin/retention-dashboard/backup-verification/evidence-reminder/notify?${params.toString()}`,
    authToken,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );

  return {
    type: payload.type === "documents_version_retention_evidence_reminder_notification_dispatch"
      ? "documents_version_retention_evidence_reminder_notification_dispatch"
      : undefined,
    payload_content_free: payload.payload_content_free === false || payload.payloadContentFree === false ? false : true,
    attempted_count: numberFromUnknown(payload.attempted_count ?? payload.attemptedCount),
    delivered_count: numberFromUnknown(payload.delivered_count ?? payload.deliveredCount),
    failed_count: numberFromUnknown(payload.failed_count ?? payload.failedCount),
    skipped_count: numberFromUnknown(payload.skipped_count ?? payload.skippedCount),
    created: payload.created === true,
    notification: normalizeRetentionReminderNotification(payload.notification),
    reminder: normalizeRetentionDashboardEvidenceReminder(payload.reminder),
    verification: normalizeRetentionDashboardBackupVerification(payload.verification),
    message: stringFromUnknown(payload.message) || "Evidence reminder notification recorded.",
  };
}

async function retryAdminDocumentRetentionEvidenceReminderNotifications(
  userId: string,
  authToken: string | undefined
): Promise<DocumentRetentionReminderNotificationRetryResult> {
  if (!authToken) {
    throw new Error("Document history auth token unavailable");
  }

  const params = new URLSearchParams({ user_id: userId });
  const payload = await documentsHistoryFetch<Record<string, unknown>>(
    `/admin/retention-dashboard/backup-verification/evidence-reminder/retry?${params.toString()}`,
    authToken,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
  const rawNotifications = Array.isArray(payload.notifications) ? payload.notifications : [];

  return {
    type: payload.type === "documents_version_retention_evidence_reminder_notification_retry_dispatch"
      ? "documents_version_retention_evidence_reminder_notification_retry_dispatch"
      : undefined,
    payload_content_free: payload.payload_content_free === false || payload.payloadContentFree === false ? false : true,
    attempted_count: numberFromUnknown(payload.attempted_count ?? payload.attemptedCount),
    delivered_count: numberFromUnknown(payload.delivered_count ?? payload.deliveredCount),
    failed_count: numberFromUnknown(payload.failed_count ?? payload.failedCount),
    skipped_count: numberFromUnknown(payload.skipped_count ?? payload.skippedCount),
    retry_ready_count: numberFromUnknown(payload.retry_ready_count ?? payload.retryReadyCount),
    pending_retry_count: numberFromUnknown(payload.pending_retry_count ?? payload.pendingRetryCount),
    notifications: rawNotifications
      .map(normalizeRetentionReminderNotification)
      .filter((item): item is DocumentRetentionReminderNotification => Boolean(item)),
    verification: normalizeRetentionDashboardBackupVerification(payload.verification),
    message: stringFromUnknown(payload.message) || "No failed reminder notifications are due for retry.",
  };
}

async function loadAdminDocumentRetentionPrunePreview(
  userId: string,
  authToken: string | undefined,
  limit = 100
): Promise<DocumentRetentionDashboardPrunePreview | null> {
  if (!authToken) {
    return null;
  }

  const params = new URLSearchParams({
    user_id: userId,
    limit: String(limit),
  });
  const payload = await documentsHistoryFetch<unknown>(
    `/admin/retention-dashboard/prune-preview?${params.toString()}`,
    authToken
  );

  return normalizeRetentionDashboardPrunePreview(payload);
}

async function executeAdminDocumentRetentionPrune(
  userId: string,
  authToken: string | undefined,
  confirmation: string,
  limit = 100
): Promise<DocumentRetentionDashboardPrunePreview> {
  if (!authToken) {
    throw new Error("Document history auth token unavailable");
  }

  const params = new URLSearchParams({ user_id: userId });
  const payload = await documentsHistoryFetch<unknown>(
    `/admin/retention-dashboard/prune?${params.toString()}`,
    authToken,
    {
      method: "POST",
      body: JSON.stringify({ confirmation, limit }),
    }
  );
  const normalized = normalizeRetentionDashboardPrunePreview(payload);

  if (!normalized) {
    throw new Error("Invalid retention prune response");
  }

  return normalized;
}

async function executeAdminDocumentRetentionRestoreDrill(
  userId: string,
  authToken: string | undefined,
  auditId: string,
  confirmation: string
): Promise<DocumentRetentionDashboardRestoreDrillExecutionResult> {
  if (!authToken) {
    throw new Error("Document history auth token unavailable");
  }

  const params = new URLSearchParams({ user_id: userId });
  const payload = await documentsHistoryFetch<Record<string, unknown>>(
    `/admin/retention-dashboard/prune-audits/${encodeURIComponent(auditId)}/restore-drill?${params.toString()}`,
    authToken,
    {
      method: "POST",
      body: JSON.stringify({
        confirmation,
        backup_handoff_confirmed: true,
      }),
    }
  );
  const audit = normalizeRetentionDashboardPruneAudit(payload.audit);
  const restoreDrill = normalizeRetentionDashboardRestoreDrill(payload.restore_drill ?? payload.restoreDrill) || audit?.restore_drill || null;

  return {
    type: payload.type === "documents_version_retention_restore_drill_execution"
      ? "documents_version_retention_restore_drill_execution"
      : undefined,
    audit_id: stringFromUnknown(payload.audit_id) || stringFromUnknown(payload.auditId) || auditId,
    status: payload.status === "blocked" ? "blocked" : "completed",
    payload_content_free: payload.payload_content_free === false || payload.payloadContentFree === false ? false : true,
    confirmation_required: payload.confirmation_required === true || payload.confirmationRequired === true,
    confirmation_token: stringFromUnknown(payload.confirmation_token) || stringFromUnknown(payload.confirmationToken) || "CONFIRM_RESTORE_DRILL_BACKUP_HANDOFF",
    backup_handoff_required: payload.backup_handoff_required === true || payload.backupHandoffRequired === true,
    backup_handoff_confirmed: payload.backup_handoff_confirmed !== false && payload.backupHandoffConfirmed !== false,
    restore_drill: restoreDrill,
    audit,
    scheduled_prune_automation: normalizeRetentionDashboardScheduledPruneAutomation(
      payload.scheduled_prune_automation ?? payload.scheduledPruneAutomation
    ),
    executed_at: stringFromUnknown(payload.executed_at) || stringFromUnknown(payload.executedAt) || null,
  };
}

async function loadAccessibleDocumentRetentionDashboard(
  documents: Document[],
  userId: string,
  authToken: string | undefined,
  days = 30
): Promise<DocumentRetentionDashboardReport | null> {
  if (!authToken) {
    return null;
  }

  const candidateDocuments = documents
    .filter(document => document.document_type === "document")
    .slice(0, 25);
  const results = await Promise.allSettled(
    candidateDocuments.map(async document => {
      const trend = await loadDurableDocumentRetentionTrends(document.id, userId, authToken, days);
      return trend ? { document, trend } : null;
    })
  );
  const entries = results
    .filter((result): result is PromiseFulfilledResult<{ document: Document; trend: DocumentVersionRetentionTrendReport } | null> => (
      result.status === "fulfilled"
    ))
    .map(result => result.value)
    .filter((entry): entry is { document: Document; trend: DocumentVersionRetentionTrendReport } => Boolean(entry));

  return createDocumentRetentionDashboardFromTrendReports(entries, days);
}

async function persistDurableDocumentVersionSnapshot(
  document: DocumentDetail,
  userId: string,
  authToken: string | undefined,
  options: { changeNote?: string; changeType?: string; authorId?: string } = {}
): Promise<DocumentVersion | null> {
  if (!authToken) return null;

  const params = new URLSearchParams({ user_id: userId });
  const payload = await documentsHistoryFetch<{ version?: unknown }>(
    `/${encodeURIComponent(document.id)}/versions?${params.toString()}`,
    authToken,
    {
      method: "POST",
      body: JSON.stringify(documentDetailVersionPayload(document, {
        ...options,
        authorId: options.authorId || userId,
      })),
    }
  );
  const [version] = normalizeDocumentVersions(payload?.version ? [payload.version] : []);
  return version ? { ...version, source: "durable" } : null;
}

async function persistDurableDocumentVersionSnapshots(
  documentId: string,
  versions: DocumentVersion[],
  userId: string,
  authToken: string | undefined
): Promise<DocumentVersion[]> {
  if (!authToken) return [];

  const restorableVersions = versions.filter(restorableLocalVersion);
  if (restorableVersions.length === 0) return [];

  const params = new URLSearchParams({ user_id: userId });
  const payload = await documentsHistoryFetch<unknown>(
    `/${encodeURIComponent(documentId)}/versions/import?${params.toString()}`,
    authToken,
    {
      method: "POST",
      body: JSON.stringify({
        versions: restorableVersions.map(documentVersionPayload),
      }),
    }
  );

  return normalizeDocumentVersions(payload).map(version => ({ ...version, source: "durable" as const }));
}

async function updateDurableDocumentVersionRetention(
  documentId: string,
  versionId: string,
  userId: string,
  authToken: string | undefined,
  retentionPolicy: DocumentVersionRetentionPolicy,
  retainedUntil: string | null = null
): Promise<DurableDocumentVersionRetentionUpdate> {
  if (!authToken) {
    return { version: null, retentionReport: null };
  }

  const params = new URLSearchParams({ user_id: userId });
  const payload = await documentsHistoryFetch<{ version?: unknown }>(
    `/${encodeURIComponent(documentId)}/versions/${encodeURIComponent(versionId)}/retention?${params.toString()}`,
    authToken,
    {
      method: "PATCH",
      body: JSON.stringify({
        retention_policy: retentionPolicy,
        retained_until: retentionPolicy === "retain-until" ? retainedUntil : null,
      }),
    }
  );
  const [version] = normalizeDocumentVersions(payload?.version ? [payload.version] : []);
  return {
    version: version ? { ...version, source: "durable" } : null,
    retentionReport: documentVersionRetentionReportFromPayload(payload),
  };
}

function getDocIcon(type: string) {
  return DOC_TYPE_ICONS[type] || DOC_TYPE_ICONS.default;
}

function getDocColor(type: string) {
  return DOC_TYPE_COLORS[type] || DOC_TYPE_COLORS.default;
}

function createEmptyTiptapContent() {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

function tiptapText(text: string): Record<string, unknown> {
  return { type: "text", text };
}

function tiptapParagraph(text = ""): Record<string, unknown> {
  return text
    ? { type: "paragraph", content: [tiptapText(text)] }
    : { type: "paragraph" };
}

function tiptapAlignedParagraph(text = "", textAlign?: "left" | "center" | "right"): Record<string, unknown> {
  const paragraph = tiptapParagraph(text);
  if (textAlign) {
    return { ...paragraph, attrs: { textAlign } };
  }
  return paragraph;
}

function tiptapHeading(text: string, level: 1 | 2 | 3 | 4 | 5 | 6 = 2): Record<string, unknown> {
  return {
    type: "heading",
    attrs: { level },
    content: [tiptapText(text)],
  };
}

function tiptapBulletList(items: string[]): Record<string, unknown> {
  return {
    type: "bulletList",
    content: items.map(item => ({
      type: "listItem",
      content: [tiptapParagraph(item)],
    })),
  };
}

function tiptapOrderedList(items: string[]): Record<string, unknown> {
  return {
    type: "orderedList",
    content: items.map(item => ({
      type: "listItem",
      content: [tiptapParagraph(item)],
    })),
  };
}

function tiptapDoc(content: Record<string, unknown>[]): Record<string, unknown> {
  return {
    type: "doc",
    content,
  };
}

type MarkdownImportConversion = {
  content: Record<string, unknown>;
  contentText: string;
};

type MarkdownTableAlignment = "left" | "center" | "right" | undefined;

function stripMarkdownInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\\([\\`*_{}\[\]()#+\-.!|>])/g, "$1")
    .trim();
}

function splitMarkdownTableRow(line: string): string[] {
  let value = line.trim();
  if (!value.includes("|")) return [];
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);

  const cells: string[] = [];
  let current = "";
  let escaped = false;
  for (const char of value) {
    if (char === "|" && !escaped) {
      cells.push(stripMarkdownInline(current));
      current = "";
      continue;
    }
    if (char === "\\" && !escaped) {
      escaped = true;
      current += char;
      continue;
    }
    escaped = false;
    current += char;
  }
  cells.push(stripMarkdownInline(current));
  return cells;
}

function isMarkdownTableSeparator(line: string): boolean {
  const cells = splitMarkdownTableRow(line);
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")));
}

function markdownTableAlignments(separatorLine: string): MarkdownTableAlignment[] {
  return splitMarkdownTableRow(separatorLine).map(cell => {
    const value = cell.replace(/\s+/g, "");
    if (/^:-{3,}:$/.test(value)) return "center";
    if (/^-{3,}:$/.test(value)) return "right";
    if (/^:-{3,}$/.test(value)) return "left";
    return undefined;
  });
}

function normalizeMarkdownTableCells(cells: string[], length: number): string[] {
  const normalized = cells.slice(0, length);
  while (normalized.length < length) normalized.push("");
  return normalized;
}

function tiptapTableCell(
  text: string,
  type: "tableHeader" | "tableCell",
  textAlign?: "left" | "center" | "right",
): Record<string, unknown> {
  return {
    type,
    attrs: { colspan: 1, rowspan: 1, colwidth: null },
    content: [tiptapAlignedParagraph(text, textAlign)],
  };
}

function tiptapTable(rows: string[][], alignments: MarkdownTableAlignment[]): Record<string, unknown> {
  const width = Math.max(...rows.map(row => row.length), 1);
  return {
    type: "table",
    content: rows.map((row, rowIndex) => ({
      type: "tableRow",
      content: normalizeMarkdownTableCells(row, width).map((cell, cellIndex) =>
        tiptapTableCell(cell, rowIndex === 0 ? "tableHeader" : "tableCell", alignments[cellIndex])
      ),
    })),
  };
}

function isMarkdownUnorderedListLine(trimmedLine: string): boolean {
  return /^[-*+]\s+/.test(trimmedLine);
}

function isMarkdownOrderedListLine(trimmedLine: string): boolean {
  return /^\d+[.)]\s+/.test(trimmedLine);
}

function isMarkdownBlockStart(lines: string[], index: number): boolean {
  const trimmed = lines[index]?.trim() || "";
  if (!trimmed) return false;
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  if (/^`{3,}/.test(trimmed)) return true;
  if (/^>\s?/.test(trimmed)) return true;
  if (/^([-*_])\s*\1\s*\1\s*$/.test(trimmed)) return true;
  if (isMarkdownUnorderedListLine(trimmed) || isMarkdownOrderedListLine(trimmed)) return true;
  return index + 1 < lines.length && splitMarkdownTableRow(trimmed).length > 1 && isMarkdownTableSeparator(lines[index + 1]);
}

function convertMarkdownToTiptap(markdown: string): MarkdownImportConversion {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const content: Record<string, unknown>[] = [];
  const plainLines: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] || "";
    const trimmed = line.trim();
    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^`{3,}/.test(trimmed)) {
      const language = trimmed.replace(/^`{3,}/, "").trim().split(/\s+/)[0] || undefined;
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^`{3,}/.test((lines[index] || "").trim())) {
        codeLines.push(lines[index] || "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      const codeText = codeLines.join("\n");
      content.push({
        type: "codeBlock",
        attrs: language ? { language } : {},
        content: codeText ? [tiptapText(codeText)] : undefined,
      });
      if (codeText.trim()) plainLines.push(codeText.trim());
      continue;
    }

    if (index + 1 < lines.length && splitMarkdownTableRow(trimmed).length > 1 && isMarkdownTableSeparator(lines[index + 1])) {
      const rows = [splitMarkdownTableRow(trimmed)];
      const alignments = markdownTableAlignments(lines[index + 1]);
      index += 2;
      while (index < lines.length) {
        const row = splitMarkdownTableRow(lines[index] || "");
        if (row.length < 1 || !(lines[index] || "").includes("|")) break;
        rows.push(row);
        index += 1;
      }
      content.push(tiptapTable(rows, alignments));
      plainLines.push(rows.map(row => row.join("\t")).join("\n"));
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const headingText = stripMarkdownInline(headingMatch[2]);
      content.push(tiptapHeading(headingText, headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6));
      plainLines.push(headingText);
      index += 1;
      continue;
    }

    if (isMarkdownUnorderedListLine(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && isMarkdownUnorderedListLine((lines[index] || "").trim())) {
        items.push(stripMarkdownInline((lines[index] || "").trim().replace(/^[-*+]\s+/, "")));
        index += 1;
      }
      content.push(tiptapBulletList(items));
      plainLines.push(items.join("\n"));
      continue;
    }

    if (isMarkdownOrderedListLine(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && isMarkdownOrderedListLine((lines[index] || "").trim())) {
        items.push(stripMarkdownInline((lines[index] || "").trim().replace(/^\d+[.)]\s+/, "")));
        index += 1;
      }
      content.push(tiptapOrderedList(items));
      plainLines.push(items.join("\n"));
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test((lines[index] || "").trim())) {
        quoteLines.push(stripMarkdownInline((lines[index] || "").trim().replace(/^>\s?/, "")));
        index += 1;
      }
      const quoteText = quoteLines.join(" ").trim();
      content.push({ type: "blockquote", content: [tiptapParagraph(quoteText)] });
      if (quoteText) plainLines.push(quoteText);
      continue;
    }

    if (/^([-*_])\s*\1\s*\1\s*$/.test(trimmed)) {
      content.push({ type: "horizontalRule" });
      index += 1;
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && (lines[index] || "").trim() && !isMarkdownBlockStart(lines, index)) {
      paragraphLines.push(stripMarkdownInline((lines[index] || "").trim()));
      index += 1;
    }
    const paragraphText = paragraphLines.join(" ").trim();
    if (paragraphText) {
      content.push(tiptapParagraph(paragraphText));
      plainLines.push(paragraphText);
    } else {
      index += 1;
    }
  }

  return {
    content: tiptapDoc(content.length ? content : [tiptapParagraph()]),
    contentText: plainLines.join("\n").trim(),
  };
}

function plainTextFromSections(lines: string[]): string {
  return lines.join("\n").trim();
}

const BUILT_IN_DOCUMENT_TEMPLATES: BuiltInDocumentTemplate[] = [
  {
    id: "blank",
    title: "Blank Document",
    category: "General",
    description: "A clean page for writing from scratch.",
    suggestedTitle: "Untitled Document",
    content: createEmptyTiptapContent(),
    contentText: "",
    tags: [],
  },
  {
    id: "grant-proposal",
    title: "Grant Proposal",
    category: "Fundraising",
    description: "Narrative sections for funder-ready program proposals.",
    suggestedTitle: "Grant Proposal Draft",
    content: tiptapDoc([
      tiptapHeading("Grant Proposal", 1),
      tiptapHeading("Executive Summary"),
      tiptapParagraph("Summarize the funding request, community need, proposed program, and expected outcomes."),
      tiptapHeading("Organization Snapshot"),
      tiptapBulletList([
        "Mission and history",
        "Core programs and communities served",
        "Relevant partners, credentials, and capacity",
      ]),
      tiptapHeading("Program Need"),
      tiptapParagraph("Describe the problem, who is affected, and the evidence that supports the need."),
      tiptapHeading("Goals and Outcomes"),
      tiptapBulletList([
        "Primary goal",
        "Measurable outcomes",
        "Participant or community-level impact",
      ]),
      tiptapHeading("Program Design"),
      tiptapParagraph("Explain activities, staffing, timeline, eligibility, and participant experience."),
      tiptapHeading("Evaluation Plan"),
      tiptapParagraph("Define how progress will be measured, reviewed, and reported."),
      tiptapHeading("Budget Narrative"),
      tiptapParagraph("Connect the requested funds to personnel, operations, materials, and sustainability."),
    ]),
    contentText: plainTextFromSections([
      "Grant Proposal",
      "Executive Summary",
      "Summarize the funding request, community need, proposed program, and expected outcomes.",
      "Organization Snapshot",
      "Mission and history",
      "Core programs and communities served",
      "Relevant partners, credentials, and capacity",
      "Program Need",
      "Describe the problem, who is affected, and the evidence that supports the need.",
      "Goals and Outcomes",
      "Primary goal",
      "Measurable outcomes",
      "Participant or community-level impact",
      "Program Design",
      "Explain activities, staffing, timeline, eligibility, and participant experience.",
      "Evaluation Plan",
      "Define how progress will be measured, reviewed, and reported.",
      "Budget Narrative",
      "Connect the requested funds to personnel, operations, materials, and sustainability.",
    ]),
    tags: ["template", "grant", "proposal"],
  },
  {
    id: "case-note",
    title: "Case Note",
    category: "Services",
    description: "Structured notes for client support and follow-up.",
    suggestedTitle: "Case Note",
    content: tiptapDoc([
      tiptapHeading("Case Note", 1),
      tiptapHeading("Client Snapshot"),
      tiptapBulletList([
        "Client or household",
        "Date and contact method",
        "Staff member",
      ]),
      tiptapHeading("Presenting Need"),
      tiptapParagraph("Capture the immediate reason for contact and any relevant context."),
      tiptapHeading("Assessment"),
      tiptapParagraph("Summarize strengths, barriers, urgency, and service eligibility."),
      tiptapHeading("Actions Taken"),
      tiptapBulletList([
        "Resources provided",
        "Referrals or warm handoffs",
        "Documents requested or received",
      ]),
      tiptapHeading("Follow-Up Plan"),
      tiptapParagraph("List next steps, owners, deadlines, and preferred contact method."),
      tiptapHeading("Risk and Safety Notes"),
      tiptapParagraph("Document safety concerns, mandated reporting considerations, or escalation steps."),
    ]),
    contentText: plainTextFromSections([
      "Case Note",
      "Client Snapshot",
      "Client or household",
      "Date and contact method",
      "Staff member",
      "Presenting Need",
      "Capture the immediate reason for contact and any relevant context.",
      "Assessment",
      "Summarize strengths, barriers, urgency, and service eligibility.",
      "Actions Taken",
      "Resources provided",
      "Referrals or warm handoffs",
      "Documents requested or received",
      "Follow-Up Plan",
      "List next steps, owners, deadlines, and preferred contact method.",
      "Risk and Safety Notes",
      "Document safety concerns, mandated reporting considerations, or escalation steps.",
    ]),
    tags: ["template", "case-note", "services"],
  },
  {
    id: "meeting-minutes",
    title: "Meeting Minutes",
    category: "Operations",
    description: "Agenda, decisions, action items, and unresolved questions.",
    suggestedTitle: "Meeting Minutes",
    content: tiptapDoc([
      tiptapHeading("Meeting Minutes", 1),
      tiptapHeading("Meeting Details"),
      tiptapBulletList([
        "Date and time",
        "Attendees",
        "Facilitator",
        "Notetaker",
      ]),
      tiptapHeading("Agenda"),
      tiptapOrderedList([
        "Opening updates",
        "Discussion topics",
        "Decisions and next steps",
      ]),
      tiptapHeading("Decisions"),
      tiptapBulletList([
        "Decision, owner, and rationale",
        "Decision, owner, and rationale",
      ]),
      tiptapHeading("Action Items"),
      tiptapBulletList([
        "Owner - task - due date",
        "Owner - task - due date",
      ]),
      tiptapHeading("Open Questions"),
      tiptapParagraph("Capture items that need more research, approval, or follow-up."),
    ]),
    contentText: plainTextFromSections([
      "Meeting Minutes",
      "Meeting Details",
      "Date and time",
      "Attendees",
      "Facilitator",
      "Notetaker",
      "Agenda",
      "Opening updates",
      "Discussion topics",
      "Decisions and next steps",
      "Decisions",
      "Decision, owner, and rationale",
      "Action Items",
      "Owner - task - due date",
      "Open Questions",
      "Capture items that need more research, approval, or follow-up.",
    ]),
    tags: ["template", "meeting-minutes", "operations"],
  },
  {
    id: "policy-memo",
    title: "Policy Memo",
    category: "Leadership",
    description: "A concise recommendation memo with context and risks.",
    suggestedTitle: "Policy Memo",
    content: tiptapDoc([
      tiptapHeading("Policy Memo", 1),
      tiptapParagraph("To:"),
      tiptapParagraph("From:"),
      tiptapParagraph("Date:"),
      tiptapParagraph("Re:"),
      tiptapHeading("Summary"),
      tiptapParagraph("State the decision or recommendation in one clear paragraph."),
      tiptapHeading("Background"),
      tiptapParagraph("Explain the context, constraints, and current state."),
      tiptapHeading("Recommendation"),
      tiptapParagraph("Describe the proposed approach and why it is the best path."),
      tiptapHeading("Implementation Steps"),
      tiptapOrderedList([
        "First action and owner",
        "Second action and owner",
        "Review point or approval gate",
      ]),
      tiptapHeading("Risks and Tradeoffs"),
      tiptapParagraph("Name risks, mitigation options, and any unresolved dependencies."),
    ]),
    contentText: plainTextFromSections([
      "Policy Memo",
      "To:",
      "From:",
      "Date:",
      "Re:",
      "Summary",
      "State the decision or recommendation in one clear paragraph.",
      "Background",
      "Explain the context, constraints, and current state.",
      "Recommendation",
      "Describe the proposed approach and why it is the best path.",
      "Implementation Steps",
      "First action and owner",
      "Second action and owner",
      "Review point or approval gate",
      "Risks and Tradeoffs",
      "Name risks, mitigation options, and any unresolved dependencies.",
    ]),
    tags: ["template", "policy", "memo"],
  },
  {
    id: "program-report",
    title: "Program Report",
    category: "Reporting",
    description: "Progress reporting with metrics, outcomes, and next steps.",
    suggestedTitle: "Program Report",
    content: tiptapDoc([
      tiptapHeading("Program Report", 1),
      tiptapHeading("Reporting Period"),
      tiptapParagraph("Name the program, dates covered, author, and audience."),
      tiptapHeading("Highlights"),
      tiptapBulletList([
        "Major win or milestone",
        "Participant story or qualitative insight",
        "Partnership, outreach, or operational update",
      ]),
      tiptapHeading("Metrics Snapshot"),
      tiptapBulletList([
        "Participants served",
        "Sessions, workshops, or service units delivered",
        "Completion, retention, or satisfaction measures",
      ]),
      tiptapHeading("Participant Outcomes"),
      tiptapParagraph("Connect activities to measurable change, participant feedback, and community value."),
      tiptapHeading("Challenges"),
      tiptapParagraph("Document constraints, barriers, and lessons learned."),
      tiptapHeading("Next Period Priorities"),
      tiptapOrderedList([
        "Priority and owner",
        "Priority and owner",
        "Priority and owner",
      ]),
    ]),
    contentText: plainTextFromSections([
      "Program Report",
      "Reporting Period",
      "Name the program, dates covered, author, and audience.",
      "Highlights",
      "Major win or milestone",
      "Participant story or qualitative insight",
      "Partnership, outreach, or operational update",
      "Metrics Snapshot",
      "Participants served",
      "Sessions, workshops, or service units delivered",
      "Completion, retention, or satisfaction measures",
      "Participant Outcomes",
      "Connect activities to measurable change, participant feedback, and community value.",
      "Challenges",
      "Document constraints, barriers, and lessons learned.",
      "Next Period Priorities",
      "Priority and owner",
    ]),
    tags: ["template", "program-report", "reporting"],
  },
];

function getBuiltInDocumentTemplate(id: BuiltInDocumentTemplateId): BuiltInDocumentTemplate {
  return BUILT_IN_DOCUMENT_TEMPLATES.find(template => template.id === id) || BUILT_IN_DOCUMENT_TEMPLATES[0];
}

function defaultTitleForDocumentType(type: CreateDocumentType): string {
  if (type === "spreadsheet") return "Untitled Spreadsheet";
  if (type === "presentation") return "Untitled Slides";
  return "Untitled Document";
}

function cloneTiptapContent(content: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(content)) as Record<string, unknown>;
}

function sanitizeExportFilename(filename: string): string {
  return filename
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 140) || "document";
}

function filenameFromDisposition(disposition: string | null): string | null {
  if (!disposition) return null;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1].replace(/"/g, ""));
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] || null;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.addEventListener("load", () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      URL.revokeObjectURL(objectUrl);
      if (width && height) {
        resolve({ width, height });
      } else {
        reject(new Error("Image dimensions were unavailable."));
      }
    });

    image.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not read image dimensions for ${file.name}.`));
    });

    image.src = objectUrl;
  });
}

function uploadedMediaSource(
  uploaded: UploadedEditorMediaApiResponse,
  fallbackUserId: string
): string {
  const filepath = uploaded.filepath || "";
  if (/^(https?:|data:|blob:)/i.test(filepath)) {
    return filepath;
  }

  if (uploaded.file_id) {
    return `${SB_API_BASE}/api/files/download/${encodeURIComponent(
      uploaded.user || fallbackUserId
    )}/${encodeURIComponent(uploaded.file_id)}`;
  }

  return filepath;
}

function extensionForImportFile(file: File): string {
  const match = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

const MARKDOWN_IMPORT_EXTENSIONS = new Set(["md", "markdown", "txt", "text"]);
const DOCLING_IMPORT_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "pptx",
  "xlsx",
  "html",
  "htm",
  "xhtml",
  "md",
  "markdown",
  "adoc",
  "asciidoc",
  "tex",
  "latex",
  "csv",
  "txt",
  "text",
  "png",
  "jpg",
  "jpeg",
  "tif",
  "tiff",
  "bmp",
  "webp",
  "wav",
  "mp3",
  "m4a",
  "aac",
  "ogg",
  "flac",
  "mp4",
  "avi",
  "mov",
  "vtt",
  "webvtt",
  "xml",
  "xbrl",
  "json",
]);
const DOCUMENT_IMPORT_ACCEPT = [
  ".md",
  ".markdown",
  ".txt",
  ".text",
  ".docx",
  ".pdf",
  ".pptx",
  ".xlsx",
  ".csv",
  ".html",
  ".htm",
  ".xhtml",
  ".adoc",
  ".asciidoc",
  ".tex",
  ".latex",
  ".png",
  ".jpg",
  ".jpeg",
  ".tif",
  ".tiff",
  ".bmp",
  ".webp",
  ".wav",
  ".mp3",
  ".m4a",
  ".aac",
  ".ogg",
  ".flac",
  ".mp4",
  ".avi",
  ".mov",
  ".vtt",
  ".webvtt",
  ".xml",
  ".xbrl",
  ".json",
  "text/markdown",
  "text/plain",
  "text/csv",
  "text/html",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "image/bmp",
  "image/webp",
  "audio/*",
  "video/*",
].join(",");

type DoclingImportResponse = {
  success?: boolean;
  converter?: string;
  conversion_id?: string;
  filename?: string;
  title?: string;
  markdown?: string | null;
  text?: string | null;
  html?: string | null;
  doctags?: string | null;
  assets?: unknown[];
  tables?: unknown[];
  figures?: unknown[];
  multimodal_pages?: unknown[];
  document?: unknown;
  exports?: {
    markdown?: string | null;
    text?: string | null;
    html?: string | null;
    json?: unknown;
    doctags?: string | null;
    vtt?: string | null;
    tables?: unknown[];
    figures?: unknown[];
    multimodal_pages?: unknown[];
  };
  metadata?: {
    page_count?: number;
    table_count?: number;
    picture_count?: number;
    conversion_seconds?: number;
  };
  error?: string;
  detail?: string;
};

const DOCLING_IMPORT_METADATA_KEY = "streetbot_docling_import";

type DoclingImportSource = {
  name: string;
  type?: string | null;
  size?: number | null;
  lastModified?: number | null;
  modifiedAt?: string | null;
};

function limitDoclingRecords(records: unknown, limit: number): unknown[] {
  return Array.isArray(records) ? records.slice(0, limit) : [];
}

function buildDoclingImportMetadata(
  doclingResult: DoclingImportResponse,
  source: DoclingImportSource,
  extraMetadata: Record<string, unknown> = {},
): Record<string, unknown> {
  const exports = doclingResult.exports || {};
  const tableRecords = limitDoclingRecords(doclingResult.tables || exports.tables, 25);
  const assetRecords = limitDoclingRecords(doclingResult.assets, 100);
  const figureRecords = limitDoclingRecords(doclingResult.figures || exports.figures, 50);
  const multimodalRecords = limitDoclingRecords(doclingResult.multimodal_pages || exports.multimodal_pages, 25);
  const sourceModifiedAt = typeof source.modifiedAt === "string" && source.modifiedAt
    ? source.modifiedAt
    : typeof source.lastModified === "number" && Number.isFinite(source.lastModified)
      ? new Date(source.lastModified).toISOString()
      : null;

  return {
    [DOCLING_IMPORT_METADATA_KEY]: {
      imported_at: new Date().toISOString(),
      converter: doclingResult.converter || "docling",
      conversion_id: doclingResult.conversion_id,
      source_filename: source.name,
      source_type: source.type || null,
      source_size: typeof source.size === "number" ? source.size : null,
      source_modified_at: sourceModifiedAt,
      docling_filename: doclingResult.filename,
      exports_available: Object.entries(exports)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key]) => key),
      metadata: doclingResult.metadata || {},
      assets: assetRecords,
      tables: tableRecords,
      figures: figureRecords,
      multimodal_pages: multimodalRecords,
      multimodal_page_count: Array.isArray(doclingResult.multimodal_pages || exports.multimodal_pages)
        ? (doclingResult.multimodal_pages || exports.multimodal_pages || []).length
        : 0,
      has_lossless_json: Boolean(exports.json || doclingResult.document),
      has_html: Boolean(exports.html || doclingResult.html),
      has_doctags: Boolean(exports.doctags || doclingResult.doctags),
      has_vtt: Boolean(exports.vtt),
      ...extraMetadata,
    },
  };
}

function rememberedDocumentIdsKey(userId: string): string {
  return `${CREATED_DOCUMENT_IDS_STORAGE_KEY}:${userId}`;
}

function readRememberedDocumentIds(userId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(rememberedDocumentIdsKey(userId)) || "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeRememberedDocumentIds(userId: string, ids: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(rememberedDocumentIdsKey(userId), JSON.stringify(ids.slice(0, 50)));
}

function rememberCreatedDocumentId(userId: string, documentId: string): void {
  const ids = readRememberedDocumentIds(userId).filter(id => id !== documentId);
  writeRememberedDocumentIds(userId, [documentId, ...ids]);
}

function forgetCreatedDocumentId(userId: string, documentId: string): void {
  writeRememberedDocumentIds(userId, readRememberedDocumentIds(userId).filter(id => id !== documentId));
}

function transformSuggestion(data: SuggestionApiResponse): TiptapReviewSuggestion {
  return {
    id: data.id,
    suggestionId: data.suggestion_id,
    suggestionType: data.suggestion_type,
    originalText: data.original_text,
    suggestedText: data.suggested_text,
    authorName: data.author_name,
    authorColor: data.author_color,
    status: data.status,
    createdAt: data.created_at,
  };
}

function transformComment(data: CommentApiResponse): TiptapReviewComment {
  return {
    id: data.id,
    content: data.content,
    anchorType: data.anchor_type,
    anchorFrom: data.anchor_from,
    anchorTo: data.anchor_to,
    anchorText: data.anchor_text,
    isResolved: data.is_resolved,
    createdAt: data.created_at,
  };
}

function mentionFromWorkspaceMember(member: WorkspaceMemberApiResponse): TiptapMentionOption | null {
  const label = (member.user_name || member.user_email || member.user_id || "").trim();
  if (!label) return null;
  return {
    id: member.user_id || member.id,
    label,
    description: member.role_name || member.role || member.user_email || "Workspace member",
  };
}

function mentionFromDocumentShare(share: DocumentShareApiResponse): TiptapMentionOption | null {
  const label = (share.email || share.user_id || "").trim();
  if (!label) return null;
  return {
    id: share.user_id || share.email || share.id,
    label,
    description: share.permission ? `Shared: ${share.permission}` : "Shared document access",
  };
}

function mergeMentionOptions(options: TiptapMentionOption[]): TiptapMentionOption[] {
  const seen = new Set<string>();
  return options.filter(option => {
    const key = `${option.id || ""}::${option.label}`.toLowerCase();
    const labelKey = option.label.toLowerCase();
    if (!option.id || !option.label || seen.has(key) || seen.has(labelKey)) return false;
    seen.add(key);
    seen.add(labelKey);
    return true;
  });
}

function reviewCommentFromMetadata(value: unknown): TiptapReviewComment | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.content !== "string") return null;

  const anchorType =
    record.anchorType === "selection" || record.anchorType === "block" || record.anchorType === "document"
      ? record.anchorType
      : "document";

  return {
    id: record.id,
    content: record.content,
    anchorType,
    anchorFrom: typeof record.anchorFrom === "number" ? record.anchorFrom : undefined,
    anchorTo: typeof record.anchorTo === "number" ? record.anchorTo : undefined,
    anchorText: typeof record.anchorText === "string" ? record.anchorText : undefined,
    isResolved: typeof record.isResolved === "boolean" ? record.isResolved : false,
    createdAt:
      typeof record.createdAt === "string" || record.createdAt instanceof Date ? record.createdAt : undefined,
  };
}

function reviewCommentsFromMetadata(metadata?: Record<string, unknown>): TiptapReviewComment[] {
  const rawComments = metadata?.[REVIEW_COMMENTS_METADATA_KEY];
  if (!Array.isArray(rawComments)) return [];
  return rawComments
    .map(reviewCommentFromMetadata)
    .filter((comment): comment is TiptapReviewComment => comment !== null);
}

function serializeReviewComments(comments: TiptapReviewComment[]): TiptapReviewComment[] {
  return comments.map(comment => ({
    id: comment.id,
    content: comment.content,
    anchorType: comment.anchorType,
    anchorFrom: comment.anchorFrom,
    anchorTo: comment.anchorTo,
    anchorText: comment.anchorText,
    isResolved: comment.isResolved,
    createdAt: comment.createdAt instanceof Date ? comment.createdAt.toISOString() : comment.createdAt,
  }));
}

function metadataWithReviewComments(
  metadata: Record<string, unknown> | undefined,
  comments: TiptapReviewComment[]
): Record<string, unknown> {
  return {
    ...(metadata || {}),
    [REVIEW_COMMENTS_METADATA_KEY]: serializeReviewComments(comments),
  };
}

function mergeReviewComments(
  primary: TiptapReviewComment[],
  fallback: TiptapReviewComment[]
): TiptapReviewComment[] {
  const seen = new Set<string>();
  return [...primary, ...fallback].filter(comment => {
    if (seen.has(comment.id)) return false;
    seen.add(comment.id);
    return true;
  });
}

function upsertComment(
  comments: TiptapReviewComment[],
  comment: TiptapReviewComment
): TiptapReviewComment[] {
  return [comment, ...comments.filter(item => item.id !== comment.id)];
}

function openCommentCount(comments: TiptapReviewComment[]): number {
  return comments.filter(comment => !comment.isResolved).length;
}

function suggestionFromTrackChange(suggestion: SuggestionData): TiptapReviewSuggestion {
  return {
    id: suggestion.id,
    suggestionId: suggestion.id,
    suggestionType: suggestion.type,
    originalText: suggestion.type === "deletion" ? suggestion.originalText || suggestion.text : undefined,
    suggestedText: suggestion.type === "insertion" ? suggestion.text : undefined,
    authorName: suggestion.authorName,
    authorColor: suggestion.authorColor,
    status: "pending",
    createdAt: suggestion.createdAt,
  };
}

function upsertSuggestion(
  suggestions: TiptapReviewSuggestion[],
  suggestion: TiptapReviewSuggestion
): TiptapReviewSuggestion[] {
  const index = suggestions.findIndex(item => item.suggestionId === suggestion.suggestionId);
  if (index === -1) return [suggestion, ...suggestions];
  return suggestions.map(item => item.suggestionId === suggestion.suggestionId ? { ...item, ...suggestion } : item);
}

function matchesDocumentSearch(doc: Document, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    doc.title.toLowerCase().includes(q) ||
    doc.content_text?.toLowerCase().includes(q) ||
    doc.tags?.some(t => t.toLowerCase().includes(q)) ||
    false
  );
}

function mergeDocuments(primary: Document[], extras: Document[]): Document[] {
  const seen = new Set<string>();
  return [...extras, ...primary].filter(doc => {
    if (seen.has(doc.id)) return false;
    seen.add(doc.id);
    return true;
  });
}

// ── Office fallback ────────────────────────────────────────────────────
// Tiptap is the primary editor. Office services remain useful for high-fidelity imports/exports.
const OFFICE_EDITOR_BASE_URL = "http://localhost:4100";
const DOCUMENTS_RETENTION_RESTORE_DRILL_CONFIRMATION = "CONFIRM_RESTORE_DRILL_BACKUP_HANDOFF";
const COLLABORATION_COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#0891b2",
  "#ca8a04",
  "#be185d",
  "#4f46e5",
];

function getDocumentsCollaborationWebsocketUrl(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const configuredUrl = (import.meta.env.VITE_DOCUMENTS_COLLABORATION_URL as string | undefined)?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const localBackendPort = (import.meta.env.VITE_DOCUMENTS_COLLABORATION_PORT as string | undefined)?.trim();

  if (import.meta.env.DEV && localBackendPort && window.location.port && window.location.port !== localBackendPort) {
    return `${protocol}//${window.location.hostname}:${localBackendPort}/api/documents/collaboration`;
  }

  return `${protocol}//${window.location.host}/api/documents/collaboration`;
}

function getDocumentsCollaborationRoomName(documentId: string): string {
  return `document-${documentId}`;
}

function collaborationColorForUser(userId: string): string {
  let hash = 0;

  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  }

  return COLLABORATION_COLORS[hash % COLLABORATION_COLORS.length];
}

// ── Component ──────────────────────────────────────────────────────────

function DocumentsPage() {
  const { colors, isDark } = useGlassStyles();
  const { user: authUser, token: authToken } = useAuthContext();
  const userId = getOrCreateUserId(authUser?.id);

  // ── State ──
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navigation
  const [activeSection, setActiveSection] = useState<"all" | "recent" | "favorites" | "shared" | "trash">("all");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // View
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"updated" | "title" | "created">("updated");
  const [documentsViewportWidth, setDocumentsViewportWidth] = useState(() => (
    typeof window === "undefined" ? 1280 : window.innerWidth
  ));
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [organizerSummary, setOrganizerSummary] = useState<DocumentsOrganizerSummary | null>(null);
  const [organizerSelectedFolderKey, setOrganizerSelectedFolderKey] = useState("all");
  const [organizerSelectedSourceRoot, setOrganizerSelectedSourceRoot] = useState("");
  const [organizerFileSearch, setOrganizerFileSearch] = useState("");
  const [organizerFileSort, setOrganizerFileSort] =
    useState<DocumentsOrganizerFileSortKey>(DOCUMENTS_ORGANIZER_DEFAULT_FILE_SORT);
  const [organizerFiles, setOrganizerFiles] = useState<DocumentsOrganizerFilesResult | null>(null);
  const [organizerFilesLoading, setOrganizerFilesLoading] = useState(false);
  const [organizerFilesError, setOrganizerFilesError] = useState<string | null>(null);
  const [organizerRecommendations, setOrganizerRecommendations] = useState<DocumentsOrganizerRecommendationsResult | null>(null);
  const [organizerRecommendationsLoading, setOrganizerRecommendationsLoading] = useState(false);
  const [organizerRecommendationsError, setOrganizerRecommendationsError] = useState<string | null>(null);
  const [organizerCollections, setOrganizerCollections] = useState<DocumentsOrganizerCollectionsResult | null>(null);
  const [organizerCollectionsLoading, setOrganizerCollectionsLoading] = useState(false);
  const [organizerCollectionsError, setOrganizerCollectionsError] = useState<string | null>(null);
  const [organizerDuplicates, setOrganizerDuplicates] = useState<DocumentsOrganizerDuplicatesResult | null>(null);
  const [organizerDuplicatesLoading, setOrganizerDuplicatesLoading] = useState(false);
  const [organizerDuplicatesError, setOrganizerDuplicatesError] = useState<string | null>(null);
  const [organizerIncludeProjectDuplicates, setOrganizerIncludeProjectDuplicates] = useState(false);
  const [organizerLoading, setOrganizerLoading] = useState(false);
  const [organizerScanning, setOrganizerScanning] = useState(false);
  const [organizerError, setOrganizerError] = useState<string | null>(null);
  const [organizerScanStatus, setOrganizerScanStatus] = useState<string | null>(null);
  const [organizerMovePlan, setOrganizerMovePlan] = useState<DocumentsOrganizerMovePlan | null>(null);
  const [organizerMovePlanLoading, setOrganizerMovePlanLoading] = useState(false);
  const [organizerMoveExporting, setOrganizerMoveExporting] = useState(false);
  const [organizerMoveApplying, setOrganizerMoveApplying] = useState(false);
  const [organizerMoveConfirmation, setOrganizerMoveConfirmation] = useState("");
  const [organizerMoveStatus, setOrganizerMoveStatus] = useState<string | null>(null);
  const [organizerImportingFileId, setOrganizerImportingFileId] = useState<string | null>(null);
  const [organizerImportStatus, setOrganizerImportStatus] = useState<string | null>(null);
  const [organizerSelectedFileIds, setOrganizerSelectedFileIds] = useState<Set<string>>(new Set());
  const [organizerBulkImportConfirmation, setOrganizerBulkImportConfirmation] = useState("");
  const [organizerBulkImporting, setOrganizerBulkImporting] = useState(false);
  const [organizerBulkImportProgress, setOrganizerBulkImportProgress] = useState({ completed: 0, total: 0 });
  const [organizerBulkImportResults, setOrganizerBulkImportResults] = useState<DocumentsOrganizerBulkImportResult[]>([]);
  const [organizerImportPreview, setOrganizerImportPreview] = useState<DocumentsOrganizerImportPreview | null>(null);
  const [organizerImportPreviewLoading, setOrganizerImportPreviewLoading] = useState(false);
  const [organizerImportPreviewError, setOrganizerImportPreviewError] = useState<string | null>(null);
  const [organizerImportRuns, setOrganizerImportRuns] = useState<DocumentsOrganizerImportRun[]>([]);
  const [organizerImportRunsLoading, setOrganizerImportRunsLoading] = useState(false);
  const [organizerImportRunsError, setOrganizerImportRunsError] = useState<string | null>(null);
  const [organizerResumingImportRunId, setOrganizerResumingImportRunId] = useState<string | null>(null);
  const [organizerSavedViews, setOrganizerSavedViews] = useState<DocumentsOrganizerSavedView[]>([]);
  const [organizerSavedViewsLoading, setOrganizerSavedViewsLoading] = useState(false);
  const [organizerSavedViewsError, setOrganizerSavedViewsError] = useState<string | null>(null);
  const [organizerSavingView, setOrganizerSavingView] = useState(false);
  const [organizerDeletingViewId, setOrganizerDeletingViewId] = useState<string | null>(null);
  const [organizerStagingViewId, setOrganizerStagingViewId] = useState<string | null>(null);
  const [organizerStagingRecommendationId, setOrganizerStagingRecommendationId] = useState<string | null>(null);
  const [organizerStagingCollectionId, setOrganizerStagingCollectionId] = useState<string | null>(null);
  const [organizerSavedViewStageLimit, setOrganizerSavedViewStageLimit] = useState<typeof DOCUMENTS_ORGANIZER_STAGE_LIMIT_OPTIONS[number]>(24);

  // Editor
  const [editingDoc, setEditingDoc] = useState<DocumentDetail | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<TiptapReviewSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [comments, setComments] = useState<TiptapReviewComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [editorMentionOptions, setEditorMentionOptions] = useState<TiptapMentionOption[]>([]);
  const [mentionOptionsLoading, setMentionOptionsLoading] = useState(false);
  const [mentionOptionsError, setMentionOptionsError] = useState<string | null>(null);
  const [collaborationTicket, setCollaborationTicket] = useState<DocumentsCollaborationTokenResponse | null>(null);
  const [collaborationTicketError, setCollaborationTicketError] = useState<string | null>(null);
  const [collaborationLock, setCollaborationLock] = useState<DocumentsCollaborationLock | null>(null);
  const [collaborationLockStatus, setCollaborationLockStatus] = useState<DocumentsCollaborationLockStatus>("idle");
  const [collaborationLockError, setCollaborationLockError] = useState<string | null>(null);
  const collaborationLockIdRef = useRef<string | null>(null);
  const organizerPendingStagedFileIdsRef = useRef<Set<string> | null>(null);
  const organizerVisibleFiles = useMemo(
    () => organizerFiles?.files || organizerSummary?.recent_files || [],
    [organizerFiles?.files, organizerSummary?.recent_files]
  );
  const organizerSelectedVisibleFiles = useMemo(
    () => organizerVisibleFiles.filter(file => organizerSelectedFileIds.has(file.id)),
    [organizerSelectedFileIds, organizerVisibleFiles]
  );
  const organizerSelectedVisibleFileIdsKey = useMemo(
    () => organizerSelectedVisibleFiles.map(file => file.id).sort().join("|"),
    [organizerSelectedVisibleFiles]
  );
  const organizerAllVisibleFilesSelected = Boolean(
    organizerVisibleFiles.length > 0 &&
      organizerVisibleFiles.every(file => organizerSelectedFileIds.has(file.id))
  );
  const organizerFilesHasMore = Boolean(
    organizerFiles &&
      (organizerFiles.has_more || organizerFiles.total_count > organizerVisibleFiles.length)
  );
  const documentsCompact = documentsViewportWidth < 980;
  const documentsSidebarCollapsed = documentsViewportWidth < 760;
  const documentsVeryCompact = documentsViewportWidth < 620;
  const documentsSidebarWidth = documentsSidebarCollapsed ? 72 : 240;
  const organizerImportBusy = organizerBulkImporting || Boolean(organizerImportingFileId) || Boolean(organizerResumingImportRunId);
  const organizerSelectedImportPreviewReady = organizerSelectedVisibleFiles.length === 0 || Boolean(
    organizerImportPreview &&
      !organizerImportPreviewLoading &&
      !organizerImportPreviewError &&
      organizerImportPreview.preview_file_count > 0
  );
  const organizerBulkImportReady =
    organizerBulkImportConfirmation.trim() === DOCUMENTS_ORGANIZER_IMPORT_CONFIRMATION &&
    organizerSelectedImportPreviewReady;
	  const organizerSelectedFolderName = useMemo(() => {
	    if (organizerSelectedFolderKey === "all") {
	      return "All local files";
	    }
	    return organizerSummary?.folders.find(folder => folder.folder_key === organizerSelectedFolderKey)?.folder_name ||
	      organizerSelectedFolderKey;
	  }, [organizerSelectedFolderKey, organizerSummary?.folders]);
	  const organizerSelectedSourceLabel = useMemo(() => {
	    if (!organizerSelectedSourceRoot) {
	      return "";
	    }
	    return organizerCollections?.source_roots.find(collection => collection.source_root === organizerSelectedSourceRoot)?.source_display_root ||
	      organizerFiles?.source_display_root ||
	      organizerSelectedSourceRoot;
	  }, [organizerCollections?.source_roots, organizerFiles?.source_display_root, organizerSelectedSourceRoot]);
	  const organizerCurrentViewSaved = useMemo(() => {
	    const normalizedSearch = organizerFileSearch.trim().replace(/\s+/g, " ").toLowerCase();
	    const normalizedSourceRoot = organizerSelectedSourceRoot.trim();
	    return organizerSavedViews.some(view => (
	      view.folder_key === organizerSelectedFolderKey &&
	      (view.source_root || "") === normalizedSourceRoot &&
	      view.search_query.trim().replace(/\s+/g, " ").toLowerCase() === normalizedSearch &&
	      view.sort_by === organizerFileSort
	    ));
	  }, [organizerFileSearch, organizerFileSort, organizerSavedViews, organizerSelectedFolderKey, organizerSelectedSourceRoot]);
  const editorUserName = authUser?.name || authUser?.username || authUser?.email || userId;
  const editorCollaborationRoomName = useMemo(() => {
    if (!editingDoc || editingDoc.document_type !== "document") {
      return null;
    }

    return getDocumentsCollaborationRoomName(editingDoc.id);
  }, [editingDoc?.document_type, editingDoc?.id]);
  const editorCollaboration = useMemo<TiptapCollaborationConfig | null>(() => {
    if (!editingDoc || !editorCollaborationRoomName) {
      return null;
    }

    return {
      enabled: collaborationTicket?.auth_required === false || Boolean(collaborationTicket?.token),
      websocketUrl: getDocumentsCollaborationWebsocketUrl(),
      roomName: editorCollaborationRoomName,
      roomToken: collaborationTicket?.token || null,
      user: {
        id: userId,
        name: editorUserName,
        color: collaborationColorForUser(userId),
      },
    };
  }, [collaborationTicket?.auth_required, collaborationTicket?.token, editingDoc, editorCollaborationRoomName, editorUserName, userId]);

  const editorHasOwnedLock = Boolean(
    collaborationLockStatus === "owned" &&
      collaborationLock?.document_id === editingDoc?.id &&
      collaborationLock?.lock_id === collaborationLockIdRef.current
  );
  const editorUsingSoloLockFallback = collaborationLockStatus === "unavailable";
  const editorReadOnly = Boolean(
    editingDoc?.document_type === "document" &&
      !editorHasOwnedLock &&
      !editorUsingSoloLockFallback
  );
  const editorReadOnlyReason = useMemo(() => {
    if (!editorReadOnly) return null;

    if (collaborationLockStatus === "acquiring") {
      return "Securing edit lock";
    }

    if (collaborationLockStatus === "blocked" && collaborationLock) {
      const expiresAt = collaborationLock.expires_at ? new Date(collaborationLock.expires_at) : null;
      const expiresLabel = expiresAt && Number.isFinite(expiresAt.getTime())
        ? ` until ${expiresAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
        : "";
      return `${collaborationLock.user_name || "Another editor"} is editing${expiresLabel}`;
    }

    return collaborationLockError || "Document editing is temporarily locked";
  }, [collaborationLock, collaborationLockError, collaborationLockStatus, editorReadOnly]);
  const collaborationLockBadgeLabel = collaborationLockStatus === "unavailable"
    ? collaborationLockError || "Solo editing without an edit lock"
    : editorReadOnlyReason || "You hold the edit lock for this document";

  // Create
  const [showCreateDoc, setShowCreateDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocType, setNewDocType] = useState<CreateDocumentType>("document");
  const [selectedTemplateId, setSelectedTemplateId] = useState<BuiltInDocumentTemplateId>("blank");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<DocumentExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [historyDoc, setHistoryDoc] = useState<Document | DocumentDetail | null>(null);
  const [historyVersions, setHistoryVersions] = useState<DocumentVersion[]>([]);
  const [historyRetentionReport, setHistoryRetentionReport] = useState<DocumentVersionRetentionReport | null>(null);
  const [historyRetentionTrendReport, setHistoryRetentionTrendReport] =
    useState<DocumentVersionRetentionTrendReport | null>(null);
  const [showRetentionDashboard, setShowRetentionDashboard] = useState(false);
  const [retentionDashboard, setRetentionDashboard] = useState<DocumentRetentionDashboardReport | null>(null);
  const [retentionDashboardLoading, setRetentionDashboardLoading] = useState(false);
  const [retentionDashboardError, setRetentionDashboardError] = useState<string | null>(null);
  const [retentionDashboardDispatching, setRetentionDashboardDispatching] = useState(false);
  const [retentionDashboardDispatchStatus, setRetentionDashboardDispatchStatus] = useState<string | null>(null);
  const [retentionBackupEvidenceRecording, setRetentionBackupEvidenceRecording] = useState(false);
  const [retentionBackupEvidenceStatus, setRetentionBackupEvidenceStatus] = useState<string | null>(null);
  const [retentionEvidenceReminderNotifying, setRetentionEvidenceReminderNotifying] = useState(false);
  const [retentionEvidenceReminderNotifyStatus, setRetentionEvidenceReminderNotifyStatus] = useState<string | null>(null);
  const [retentionEvidenceReminderRetrying, setRetentionEvidenceReminderRetrying] = useState(false);
  const [retentionEvidenceReminderRetryStatus, setRetentionEvidenceReminderRetryStatus] = useState<string | null>(null);
  const [retentionRestoreDownloadVerifying, setRetentionRestoreDownloadVerifying] = useState(false);
  const [retentionRestoreDownloadStatus, setRetentionRestoreDownloadStatus] = useState<string | null>(null);
  const [retentionRestoreDownloadResult, setRetentionRestoreDownloadResult] =
    useState<DocumentRetentionRestoreDownloadVerification | null>(null);
  const [retentionPrunePreview, setRetentionPrunePreview] = useState<DocumentRetentionDashboardPrunePreview | null>(null);
  const [retentionPruneLoading, setRetentionPruneLoading] = useState(false);
  const [retentionPruneExecuting, setRetentionPruneExecuting] = useState(false);
  const [retentionPruneConfirmation, setRetentionPruneConfirmation] = useState("");
  const [retentionPruneStatus, setRetentionPruneStatus] = useState<string | null>(null);
  const [retentionRestoreDrillConfirmation, setRetentionRestoreDrillConfirmation] = useState("");
  const [retentionRestoreDrillExecuting, setRetentionRestoreDrillExecuting] = useState(false);
  const [retentionRestoreDrillStatus, setRetentionRestoreDrillStatus] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [expandedHistoryVersionId, setExpandedHistoryVersionId] = useState<string | null>(null);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [updatingRetentionVersionId, setUpdatingRetentionVersionId] = useState<string | null>(null);
  const [exportingRetentionReport, setExportingRetentionReport] = useState(false);
  const historyImportInputRef = useRef<HTMLInputElement | null>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ doc: Document; x: number; y: number } | null>(null);

  // ── Data Loading ──

  useEffect(() => {
    setCollaborationTicket(null);
    setCollaborationTicketError(null);

    if (!editingDoc || !editorCollaborationRoomName || editingDoc.document_type !== "document") {
      return;
    }

    if (!authToken) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    async function loadCollaborationTicket() {
      try {
        const response = await fetch("/api/documents/collaboration/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            document_id: editingDoc.id,
            room_name: editorCollaborationRoomName,
            user_id: userId,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Collaboration token failed: ${response.status}`);
        }

        const ticket = await response.json() as DocumentsCollaborationTokenResponse;

        if (!cancelled && ticket.room_name === editorCollaborationRoomName) {
          setCollaborationTicket(ticket);
        }
      } catch (err) {
        if (!cancelled && !controller.signal.aborted) {
          console.warn("Failed to load documents collaboration token", err);
          setCollaborationTicketError("Live collaboration unavailable.");
        }
      }
    }

    void loadCollaborationTicket();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [authToken, editingDoc, editorCollaborationRoomName, userId]);

  useEffect(() => {
    setCollaborationLock(null);
    setCollaborationLockError(null);
    setCollaborationLockStatus("idle");
    collaborationLockIdRef.current = null;

    if (!editingDoc || !editorCollaborationRoomName || editingDoc.document_type !== "document") {
      return;
    }

    if (!authToken) {
      setCollaborationLockStatus("error");
      setCollaborationLockError("Sign in required to edit this document.");
      return;
    }

    const controller = new AbortController();
    const lockId = uuidv4();
    let cancelled = false;
    let acquired = false;
    let heartbeatTimer: number | null = null;
    collaborationLockIdRef.current = lockId;

    const requestHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    };
    const requestBody = {
      document_id: editingDoc.id,
      room_name: editorCollaborationRoomName,
      lock_id: lockId,
      user_id: userId,
    };

    async function readLockResponse(response: Response): Promise<DocumentsCollaborationLockResponse> {
      return await response.json().catch(() => ({
        document_id: editingDoc.id,
        room_name: editorCollaborationRoomName,
        lock: null,
      }));
    }

    async function heartbeatLock() {
      try {
        const response = await fetch(`/api/documents/collaboration/locks/${encodeURIComponent(lockId)}/heartbeat`, {
          method: "POST",
          headers: requestHeaders,
          body: JSON.stringify(requestBody),
        });
        const data = await readLockResponse(response);

        if (cancelled) return;

        if (response.status === 409) {
          acquired = false;
          setCollaborationLock(data.lock);
          setCollaborationLockStatus(data.lock ? "blocked" : "error");
          setCollaborationLockError(data.message || "Document lock expired.");
          if (heartbeatTimer !== null) {
            window.clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
          return;
        }

        if (!response.ok || !data.lock) {
          if (response.status === 401 || response.status === 403) {
            acquired = false;
            setCollaborationLock(null);
            setCollaborationLockStatus("error");
            setCollaborationLockError(data.message || "You do not have edit access to this document.");
            if (heartbeatTimer !== null) {
              window.clearInterval(heartbeatTimer);
              heartbeatTimer = null;
            }
            return;
          }

          acquired = false;
          setCollaborationLock(null);
          setCollaborationLockStatus("unavailable");
          setCollaborationLockError("Edit lock unavailable; using solo editing.");
          if (heartbeatTimer !== null) {
            window.clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
          return;
        }

        acquired = true;
        setCollaborationLock(data.lock);
        setCollaborationLockStatus("owned");
        setCollaborationLockError(null);
      } catch (err) {
        if (!cancelled) {
          console.warn("Failed to renew documents collaboration lock", err);
          acquired = false;
          setCollaborationLock(null);
          setCollaborationLockStatus("unavailable");
          setCollaborationLockError("Edit lock heartbeat unavailable; using solo editing.");
        }
      }
    }

    async function acquireLock() {
      setCollaborationLockStatus("acquiring");

      try {
        const response = await fetch("/api/documents/collaboration/locks", {
          method: "POST",
          headers: requestHeaders,
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        const data = await readLockResponse(response);

        if (cancelled) return;

        if (response.status === 409) {
          acquired = false;
          setCollaborationLock(data.lock);
          setCollaborationLockStatus("blocked");
          setCollaborationLockError(null);
          return;
        }

        if (!response.ok || !data.lock) {
          if (response.status === 401 || response.status === 403) {
            acquired = false;
            setCollaborationLock(null);
            setCollaborationLockStatus("error");
            setCollaborationLockError(data.message || "You do not have edit access to this document.");
            return;
          }

          acquired = false;
          setCollaborationLock(null);
          setCollaborationLockStatus("unavailable");
          setCollaborationLockError("Edit lock unavailable; using solo editing.");
          return;
        }

        acquired = true;
        setCollaborationLock(data.lock);
        setCollaborationLockStatus("owned");
        setCollaborationLockError(null);

        const heartbeatMs = Math.max(5_000, Math.min(15_000, Math.floor((data.ttl_ms || 45_000) / 3)));
        heartbeatTimer = window.setInterval(() => {
          void heartbeatLock();
        }, heartbeatMs);
      } catch (err) {
        if (!cancelled && !controller.signal.aborted) {
          console.warn("Failed to acquire documents collaboration lock", err);
          setCollaborationLock(null);
          setCollaborationLockStatus("unavailable");
          setCollaborationLockError("Edit lock unavailable; using solo editing.");
        }
      }
    }

    void acquireLock();

    return () => {
      cancelled = true;
      controller.abort();
      if (heartbeatTimer !== null) {
        window.clearInterval(heartbeatTimer);
      }

      if (acquired) {
        const params = new URLSearchParams({
          document_id: editingDoc.id,
          room_name: editorCollaborationRoomName,
          user_id: userId,
        });
        void fetch(`/api/documents/collaboration/locks/${encodeURIComponent(lockId)}?${params.toString()}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          keepalive: true,
        }).catch(() => undefined);
      }
    };
  }, [authToken, editingDoc?.document_type, editingDoc?.id, editorCollaborationRoomName, userId]);

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = { user_id: userId, limit: "100" };
      if (selectedWorkspaceId) params.workspace_id = selectedWorkspaceId;
      if (selectedFolderId) params.folder_id = selectedFolderId;
      if (activeSection === "favorites") params.is_favorite = "true";
      if (activeSection === "trash") params.status = "deleted";

      let docs: Document[] = [];

      if (activeSection === "recent") {
        try {
          const result = await sbGet<{ documents: Document[] }>("/api/documents/recent", { user_id: userId, limit: "50" });
          docs = result.documents || result as unknown as Document[] || [];
        } catch {
          const result = await sbGet<{ documents: Document[]; total: number }>("/api/documents", { ...params, limit: "50" });
          docs = result.documents || [];
        }
      } else if (searchQuery.trim()) {
        try {
          const result = await sbGet<{ documents: Document[] }>("/api/documents/search", { user_id: userId, q: searchQuery });
          docs = result.documents || result as unknown as Document[] || [];
        } catch {
          docs = [];
        }
      } else {
        const result = await sbGet<{ documents: Document[]; total: number }>("/api/documents", params);
        docs = result.documents || [];
      }

      const rememberedDocs = await Promise.all(
        readRememberedDocumentIds(userId)
          .filter(id => !docs.some(doc => doc.id === id))
          .map(id => sbGet<DocumentDetail>(`/api/documents/${id}`, { user_id: userId }).catch(() => null))
      );
      const rememberedMatches = rememberedDocs.filter((doc): doc is DocumentDetail => {
        if (!doc) return false;
        if (selectedWorkspaceId && doc.workspace_id !== selectedWorkspaceId) return false;
        if (selectedFolderId && doc.folder_id !== selectedFolderId) return false;
        if (activeSection === "favorites" && !doc.is_favorite) return false;
        if (activeSection === "trash" && doc.status !== "deleted") return false;
        if (activeSection === "shared") return false;
        return matchesDocumentSearch(doc, searchQuery);
      });

      setDocuments(mergeDocuments(docs, rememberedMatches));
    } catch (err) {
      console.error("Failed to load documents:", err);
      setError("Failed to load documents");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [userId, selectedWorkspaceId, selectedFolderId, activeSection, searchQuery]);

  const loadWorkspacesAndFolders = useCallback(async () => {
    try {
      const ws = await sbGet<Workspace[]>("/api/document-workspaces", { user_id: userId }).catch(() => []);
      setWorkspaces(Array.isArray(ws) ? ws : []);
      if (Array.isArray(ws) && ws.length > 0 && !selectedWorkspaceId) {
        setSelectedWorkspaceId(ws[0].id);
        const flds = await sbGet<DocumentFolder[]>(`/api/document-workspaces/${ws[0].id}/folders`, { user_id: userId }).catch(() => []);
        setFolders(Array.isArray(flds) ? flds : []);
      }
    } catch {
      setWorkspaces([]);
      setFolders([]);
    }
  }, [userId, selectedWorkspaceId]);

  const documentsOrganizerFetch = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> || {}),
    };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    if (init.body && typeof init.body === "string" && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`/api/documents/organizer${path}`, {
      ...init,
      headers,
    });
    if (!response.ok) {
      throw new Error(`${init.method || "GET"} /api/documents/organizer${path} failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }, [authToken]);

  const loadOrganizerSummary = useCallback(async () => {
    try {
      setOrganizerLoading(true);
      setOrganizerError(null);
      const params = new URLSearchParams({ user_id: userId, limit: "12" });
      const payload = await documentsOrganizerFetch<unknown>(`/summary?${params.toString()}`);
      setOrganizerSummary(normalizeOrganizerSummary(payload));
    } catch (err) {
      console.error("Failed to load document organizer:", err);
      setOrganizerError("Could not load local organizer.");
    } finally {
      setOrganizerLoading(false);
    }
  }, [documentsOrganizerFetch, userId]);

  const loadOrganizerFiles = useCallback(async (options: { append?: boolean; offset?: number } = {}) => {
    const append = options.append === true;
    const offset = Math.max(0, Math.floor(options.offset || 0));
    try {
      setOrganizerFilesLoading(true);
      setOrganizerFilesError(null);
	      const params = new URLSearchParams({
	        user_id: userId,
	        limit: String(DOCUMENTS_ORGANIZER_FILE_PAGE_SIZE),
	        offset: String(offset),
	        folder_key: organizerSelectedFolderKey,
	        sort_by: organizerFileSort,
	      });
	      if (organizerSelectedSourceRoot.trim()) {
	        params.set("source_root", organizerSelectedSourceRoot.trim());
	      }
	      if (organizerFileSearch.trim()) {
	        params.set("q", organizerFileSearch.trim());
	      }

      const payload = await documentsOrganizerFetch<unknown>(`/files?${params.toString()}`);
      const nextFiles = normalizeOrganizerFilesResult(payload);
      setOrganizerFiles(current => {
        if (!append || offset === 0 || !current) {
          return nextFiles;
        }

        const seenFileIds = new Set(current.files.map(file => file.id));
        const mergedFiles = [
          ...current.files,
          ...nextFiles.files.filter(file => !seenFileIds.has(file.id)),
        ];

        return {
          ...nextFiles,
          offset: 0,
          returned_count: mergedFiles.length,
          files: mergedFiles,
        };
      });
    } catch (err) {
      console.error("Failed to load local organizer files:", err);
      setOrganizerFilesError("Could not load indexed local files.");
    } finally {
      setOrganizerFilesLoading(false);
    }
	  }, [documentsOrganizerFetch, organizerFileSearch, organizerFileSort, organizerSelectedFolderKey, organizerSelectedSourceRoot, userId]);

  const loadMoreOrganizerFiles = useCallback(async () => {
    if (organizerFilesLoading || !organizerFilesHasMore) {
      return;
    }

    await loadOrganizerFiles({ append: true, offset: organizerVisibleFiles.length });
  }, [loadOrganizerFiles, organizerFilesHasMore, organizerFilesLoading, organizerVisibleFiles.length]);

  const loadOrganizerImportRuns = useCallback(async () => {
    try {
      setOrganizerImportRunsLoading(true);
      setOrganizerImportRunsError(null);
      const params = new URLSearchParams({ user_id: userId, limit: "6" });
      const payload = await documentsOrganizerFetch<unknown>(`/imports/runs?${params.toString()}`);
      setOrganizerImportRuns(normalizeOrganizerImportRunsResult(payload).runs);
    } catch (err) {
      console.error("Failed to load organizer import runs:", err);
      setOrganizerImportRunsError("Could not load import history.");
    } finally {
      setOrganizerImportRunsLoading(false);
    }
  }, [documentsOrganizerFetch, userId]);

	  const loadOrganizerRecommendations = useCallback(async () => {
    try {
      setOrganizerRecommendationsLoading(true);
      setOrganizerRecommendationsError(null);
      const params = new URLSearchParams({ user_id: userId, limit: "6" });
      const payload = await documentsOrganizerFetch<unknown>(`/recommendations?${params.toString()}`);
      setOrganizerRecommendations(normalizeOrganizerRecommendationsResult(payload));
    } catch (err) {
      console.error("Failed to load organizer recommendations:", err);
      setOrganizerRecommendationsError("Could not load organizer recommendations.");
    } finally {
      setOrganizerRecommendationsLoading(false);
    }
	  }, [documentsOrganizerFetch, userId]);

	  const loadOrganizerCollections = useCallback(async () => {
	    try {
	      setOrganizerCollectionsLoading(true);
	      setOrganizerCollectionsError(null);
	      const params = new URLSearchParams({ user_id: userId, limit: "8" });
	      const payload = await documentsOrganizerFetch<unknown>(`/collections?${params.toString()}`);
	      setOrganizerCollections(normalizeOrganizerCollectionsResult(payload));
	    } catch (err) {
	      console.error("Failed to load organizer collections:", err);
	      setOrganizerCollectionsError("Could not load organizer collections.");
	    } finally {
	      setOrganizerCollectionsLoading(false);
	    }
	  }, [documentsOrganizerFetch, userId]);

  const loadOrganizerDuplicates = useCallback(async () => {
    try {
      setOrganizerDuplicatesLoading(true);
      setOrganizerDuplicatesError(null);
      const params = new URLSearchParams({
        user_id: userId,
        limit: "6",
        group_file_limit: "3",
        include_technical_files: organizerIncludeProjectDuplicates ? "true" : "false",
      });
      const payload = await documentsOrganizerFetch<unknown>(`/duplicates?${params.toString()}`);
      setOrganizerDuplicates(normalizeOrganizerDuplicatesResult(payload));
    } catch (err) {
      console.error("Failed to load organizer duplicate metadata:", err);
      setOrganizerDuplicatesError("Could not load duplicate metadata.");
    } finally {
      setOrganizerDuplicatesLoading(false);
    }
  }, [documentsOrganizerFetch, organizerIncludeProjectDuplicates, userId]);

  const loadOrganizerSavedViews = useCallback(async () => {
    try {
      setOrganizerSavedViewsLoading(true);
      setOrganizerSavedViewsError(null);
      const params = new URLSearchParams({ user_id: userId, limit: "8" });
      const payload = await documentsOrganizerFetch<unknown>(`/views?${params.toString()}`);
      setOrganizerSavedViews(normalizeOrganizerSavedViewsResult(payload).views);
    } catch (err) {
      console.error("Failed to load organizer saved views:", err);
      setOrganizerSavedViewsError("Could not load saved views.");
    } finally {
      setOrganizerSavedViewsLoading(false);
    }
  }, [documentsOrganizerFetch, userId]);

  const saveOrganizerCurrentView = useCallback(async () => {
    try {
      setOrganizerSavingView(true);
      setOrganizerSavedViewsError(null);
      setOrganizerError(null);
      const params = new URLSearchParams({ user_id: userId });
      const payload = await documentsOrganizerFetch<{ view?: unknown; message?: string }>(
        `/views?${params.toString()}`,
        {
          method: "POST",
          body: JSON.stringify({
	            folder_key: organizerSelectedFolderKey,
	            folder_name: organizerSelectedFolderName,
	            source_root: organizerSelectedSourceRoot.trim(),
	            search_query: organizerFileSearch.trim(),
	            sort_by: organizerFileSort,
          }),
        }
      );
      const savedView = normalizeOrganizerSavedView(payload.view);
      if (!savedView) {
        throw new Error("Saved view was not returned.");
      }
      setOrganizerSavedViews(current => [savedView, ...current.filter(view => view.id !== savedView.id)].slice(0, 8));
      setOrganizerScanStatus(payload.message || `Saved ${savedView.name}.`);
    } catch (err) {
      console.error("Failed to save organizer view:", err);
      setOrganizerSavedViewsError("Could not save this organizer view.");
    } finally {
      setOrganizerSavingView(false);
    }
  }, [
    documentsOrganizerFetch,
    organizerFileSearch,
	    organizerFileSort,
	    organizerSelectedFolderKey,
	    organizerSelectedFolderName,
	    organizerSelectedSourceRoot,
	    userId,
	  ]);

	  const applyOrganizerSavedView = useCallback(async (view: DocumentsOrganizerSavedView) => {
	    setOrganizerSelectedFolderKey(view.folder_key || "all");
	    setOrganizerSelectedSourceRoot(view.source_root || "");
	    setOrganizerFileSearch(view.search_query || "");
    setOrganizerFileSort(view.sort_by || DOCUMENTS_ORGANIZER_DEFAULT_FILE_SORT);
    setOrganizerSelectedFileIds(new Set());
    setOrganizerBulkImportConfirmation("");
    setOrganizerBulkImportResults([]);
    setOrganizerScanStatus(`Opened saved view "${view.name}".`);
    setOrganizerSavedViews(current => [
      { ...view, last_opened_at: new Date().toISOString() },
      ...current.filter(item => item.id !== view.id),
    ].slice(0, 8));

    try {
      const params = new URLSearchParams({ user_id: userId });
      const payload = await documentsOrganizerFetch<{ view?: unknown; message?: string }>(
        `/views/${encodeURIComponent(view.id)}/open?${params.toString()}`,
        { method: "PATCH" }
      );
      const openedView = normalizeOrganizerSavedView(payload.view);
      if (openedView) {
        setOrganizerSavedViews(current => [openedView, ...current.filter(item => item.id !== openedView.id)].slice(0, 8));
      }
    } catch (err) {
      console.error("Failed to update organizer saved view open time:", err);
      setOrganizerSavedViewsError("Opened locally, but could not update the saved view timestamp.");
    }
  }, [documentsOrganizerFetch, userId]);

  const applyOrganizerRecommendation = useCallback((recommendation: DocumentsOrganizerRecommendation) => {
    setOrganizerSelectedFolderKey(recommendation.folder_key || "all");
    setOrganizerSelectedSourceRoot("");
    setOrganizerFileSearch(recommendation.search_query || "");
    setOrganizerFileSort(recommendation.sort_by || DOCUMENTS_ORGANIZER_DEFAULT_FILE_SORT);
    setOrganizerSelectedFileIds(new Set());
    setOrganizerBulkImportConfirmation("");
    setOrganizerBulkImportResults([]);
    setOrganizerScanStatus(`Opened recommendation "${recommendation.name}".`);
  }, []);

  const applyOrganizerSourceCollection = useCallback((collection: DocumentsOrganizerSourceCollection) => {
    setOrganizerSelectedFolderKey("all");
    setOrganizerSelectedSourceRoot(collection.source_root);
    setOrganizerFileSearch("");
    setOrganizerFileSort(DOCUMENTS_ORGANIZER_DEFAULT_FILE_SORT);
    setOrganizerSelectedFileIds(new Set());
    setOrganizerBulkImportConfirmation("");
    setOrganizerBulkImportResults([]);
    setOrganizerScanStatus(`Opened source collection "${collection.source_display_root}".`);
  }, []);

  const applyOrganizerTypeCollection = useCallback((folder: DocumentsOrganizerFolder) => {
    setOrganizerSelectedFolderKey(folder.folder_key || "all");
    setOrganizerSelectedSourceRoot("");
    setOrganizerFileSearch("");
    setOrganizerFileSort(DOCUMENTS_ORGANIZER_DEFAULT_FILE_SORT);
    setOrganizerSelectedFileIds(new Set());
    setOrganizerBulkImportConfirmation("");
    setOrganizerBulkImportResults([]);
    setOrganizerScanStatus(`Opened type collection "${folder.folder_name}".`);
  }, []);

  const stageOrganizerCollectionFiles = useCallback(async ({
    id,
    name,
    folderKey = "all",
    sourceRoot = "",
  }: {
    id: string;
    name: string;
    folderKey?: string;
    sourceRoot?: string;
  }) => {
    if (organizerImportBusy || organizerStagingViewId || organizerStagingRecommendationId || organizerStagingCollectionId) {
      return;
    }

    try {
      setOrganizerStagingCollectionId(id);
      setOrganizerCollectionsError(null);
      setOrganizerFilesError(null);
      setOrganizerError(null);
      setOrganizerBulkImportConfirmation("");
      setOrganizerBulkImportResults([]);

      const normalizedFolderKey = folderKey || "all";
      const normalizedSourceRoot = sourceRoot || "";
      const normalizedSortBy = DOCUMENTS_ORGANIZER_DEFAULT_FILE_SORT;
      const params = new URLSearchParams({
        user_id: userId,
        limit: String(organizerSavedViewStageLimit),
        folder_key: normalizedFolderKey,
        sort_by: normalizedSortBy,
      });
      if (normalizedSourceRoot.trim()) {
        params.set("source_root", normalizedSourceRoot.trim());
      }

      setOrganizerSelectedFolderKey(normalizedFolderKey);
      setOrganizerSelectedSourceRoot(normalizedSourceRoot);
      setOrganizerFileSearch("");
      setOrganizerFileSort(normalizedSortBy);

      const filesPayload = await documentsOrganizerFetch<unknown>(`/files?${params.toString()}`);
      const filesResult = normalizeOrganizerFilesResult(filesPayload);
      const stagedFileIds = new Set(filesResult.files.map(file => file.id));
      organizerPendingStagedFileIdsRef.current = stagedFileIds;
      setOrganizerFiles(filesResult);
      setOrganizerSelectedFileIds(stagedFileIds);

      if (filesResult.files.length > 0) {
        setOrganizerScanStatus(
          `Staged ${filesResult.files.length.toLocaleString()} of ${filesResult.total_count.toLocaleString()} files from "${name}".`
        );
      } else {
        setOrganizerScanStatus(`Collection "${name}" has no indexed files to stage.`);
      }
    } catch (err) {
      console.error("Failed to stage organizer collection files:", err);
      setOrganizerCollectionsError("Could not stage this collection for import.");
    } finally {
      setOrganizerStagingCollectionId(null);
    }
  }, [
    documentsOrganizerFetch,
    organizerImportBusy,
    organizerSavedViewStageLimit,
    organizerStagingCollectionId,
    organizerStagingRecommendationId,
    organizerStagingViewId,
    userId,
  ]);

  const stageOrganizerRecommendationFiles = useCallback(async (recommendation: DocumentsOrganizerRecommendation) => {
    if (organizerImportBusy || organizerStagingViewId || organizerStagingRecommendationId || organizerStagingCollectionId) {
      return;
    }

    try {
      setOrganizerStagingRecommendationId(recommendation.id);
      setOrganizerRecommendationsError(null);
      setOrganizerFilesError(null);
      setOrganizerError(null);
      setOrganizerBulkImportConfirmation("");
      setOrganizerBulkImportResults([]);

      const normalizedFolderKey = recommendation.folder_key || "all";
      const normalizedSearchQuery = recommendation.search_query || "";
      const normalizedSortBy = recommendation.sort_by || DOCUMENTS_ORGANIZER_DEFAULT_FILE_SORT;
      const params = new URLSearchParams({
        user_id: userId,
        limit: String(organizerSavedViewStageLimit),
        folder_key: normalizedFolderKey,
        sort_by: normalizedSortBy,
      });
      if (normalizedSearchQuery.trim()) {
        params.set("q", normalizedSearchQuery.trim());
      }

      setOrganizerSelectedFolderKey(normalizedFolderKey);
      setOrganizerSelectedSourceRoot("");
      setOrganizerFileSearch(normalizedSearchQuery);
      setOrganizerFileSort(normalizedSortBy);

      const filesPayload = await documentsOrganizerFetch<unknown>(`/files?${params.toString()}`);
      const filesResult = normalizeOrganizerFilesResult(filesPayload);
      const stagedFileIds = new Set(filesResult.files.map(file => file.id));
      organizerPendingStagedFileIdsRef.current = stagedFileIds;
      setOrganizerFiles(filesResult);
      setOrganizerSelectedFileIds(stagedFileIds);

      if (filesResult.files.length > 0) {
        setOrganizerScanStatus(
          `Staged ${filesResult.files.length.toLocaleString()} of ${filesResult.total_count.toLocaleString()} files from "${recommendation.name}".`
        );
      } else {
        setOrganizerScanStatus(`Recommendation "${recommendation.name}" has no indexed files to stage.`);
      }
    } catch (err) {
      console.error("Failed to stage organizer recommendation files:", err);
      setOrganizerRecommendationsError("Could not stage this recommendation for import.");
    } finally {
      setOrganizerStagingRecommendationId(null);
    }
	  }, [
	    documentsOrganizerFetch,
	    organizerImportBusy,
	    organizerSavedViewStageLimit,
	    organizerStagingCollectionId,
	    organizerStagingRecommendationId,
	    organizerStagingViewId,
	    userId,
	  ]);

	  const stageOrganizerSavedViewFiles = useCallback(async (view: DocumentsOrganizerSavedView) => {
	    if (organizerImportBusy || organizerStagingViewId || organizerStagingRecommendationId || organizerStagingCollectionId) {
	      return;
	    }

    try {
      setOrganizerStagingViewId(view.id);
      setOrganizerSavedViewsError(null);
      setOrganizerFilesError(null);
      setOrganizerError(null);
      setOrganizerBulkImportConfirmation("");
      setOrganizerBulkImportResults([]);

	      const normalizedFolderKey = view.folder_key || "all";
	      const normalizedSourceRoot = view.source_root || "";
	      const normalizedSearchQuery = view.search_query || "";
      const normalizedSortBy = view.sort_by || DOCUMENTS_ORGANIZER_DEFAULT_FILE_SORT;
      const params = new URLSearchParams({
        user_id: userId,
        limit: String(organizerSavedViewStageLimit),
        folder_key: normalizedFolderKey,
        sort_by: normalizedSortBy,
      });
	      if (normalizedSearchQuery.trim()) {
	        params.set("q", normalizedSearchQuery.trim());
	      }
	      if (normalizedSourceRoot.trim()) {
	        params.set("source_root", normalizedSourceRoot.trim());
	      }

	      setOrganizerSelectedFolderKey(normalizedFolderKey);
	      setOrganizerSelectedSourceRoot(normalizedSourceRoot);
	      setOrganizerFileSearch(normalizedSearchQuery);
      setOrganizerFileSort(normalizedSortBy);

      const filesPayload = await documentsOrganizerFetch<unknown>(`/files?${params.toString()}`);
      const filesResult = normalizeOrganizerFilesResult(filesPayload);
      const stagedFileIds = new Set(filesResult.files.map(file => file.id));
      organizerPendingStagedFileIdsRef.current = stagedFileIds;
      setOrganizerFiles(filesResult);
      setOrganizerSelectedFileIds(stagedFileIds);

      const openParams = new URLSearchParams({ user_id: userId });
      documentsOrganizerFetch<{ view?: unknown }>(
        `/views/${encodeURIComponent(view.id)}/open?${openParams.toString()}`,
        { method: "PATCH" }
      ).then((payload) => {
        const openedView = normalizeOrganizerSavedView(payload.view);
        if (openedView) {
          setOrganizerSavedViews(current => [openedView, ...current.filter(item => item.id !== openedView.id)].slice(0, 8));
        }
      }).catch((err) => {
        console.warn("Failed to update organizer saved view open time:", err);
      });

      setOrganizerSavedViews(current => [
        { ...view, last_opened_at: new Date().toISOString() },
        ...current.filter(item => item.id !== view.id),
      ].slice(0, 8));
      if (filesResult.files.length > 0) {
        setOrganizerScanStatus(
          `Staged ${filesResult.files.length.toLocaleString()} of ${filesResult.total_count.toLocaleString()} files from "${view.name}".`
        );
      } else {
        setOrganizerScanStatus(`Saved view "${view.name}" has no indexed files to stage.`);
      }
    } catch (err) {
      console.error("Failed to stage saved view files:", err);
      setOrganizerSavedViewsError("Could not stage this saved view for import.");
    } finally {
      setOrganizerStagingViewId(null);
    }
  }, [
	    documentsOrganizerFetch,
	    organizerImportBusy,
	    organizerSavedViewStageLimit,
	    organizerStagingCollectionId,
	    organizerStagingRecommendationId,
	    organizerStagingViewId,
    userId,
  ]);

  const deleteOrganizerSavedView = useCallback(async (view: DocumentsOrganizerSavedView) => {
    try {
      setOrganizerDeletingViewId(view.id);
      setOrganizerSavedViewsError(null);
      const params = new URLSearchParams({ user_id: userId });
      await documentsOrganizerFetch<unknown>(
        `/views/${encodeURIComponent(view.id)}?${params.toString()}`,
        { method: "DELETE" }
      );
      setOrganizerSavedViews(current => current.filter(item => item.id !== view.id));
      setOrganizerScanStatus(`Deleted saved view "${view.name}".`);
    } catch (err) {
      console.error("Failed to delete organizer view:", err);
      setOrganizerSavedViewsError("Could not delete saved view.");
    } finally {
      setOrganizerDeletingViewId(null);
    }
  }, [documentsOrganizerFetch, userId]);

  const createOrganizerImportRun = useCallback(async (files: DocumentsOrganizerFile[]) => {
    const params = new URLSearchParams({ user_id: userId });
    const payload = await documentsOrganizerFetch<{ run?: unknown }>(
      `/imports/runs?${params.toString()}`,
      {
        method: "POST",
        body: JSON.stringify({ file_ids: files.map(file => file.id) }),
      }
    );
    const run = normalizeOrganizerImportRun(payload.run);
    if (!run) {
      throw new Error("Organizer import run was not returned.");
    }
    setOrganizerImportRuns(current => [run, ...current.filter(item => item.id !== run.id)].slice(0, 6));
    return run;
  }, [documentsOrganizerFetch, userId]);

  const updateOrganizerImportRunItem = useCallback(async (
    runId: string | null,
    fileId: string,
    payload: {
      status: DocumentsOrganizerImportRunItemStatus;
      document_id?: string;
      title?: string;
      error?: string;
    }
  ) => {
    if (!runId) {
      return null;
    }

    const params = new URLSearchParams({ user_id: userId });
    const response = await documentsOrganizerFetch<{ run?: unknown }>(
      `/imports/runs/${encodeURIComponent(runId)}/items/${encodeURIComponent(fileId)}?${params.toString()}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    );
    const run = normalizeOrganizerImportRun(response.run);
    if (run) {
      setOrganizerImportRuns(current => [run, ...current.filter(item => item.id !== run.id)].slice(0, 6));
    }
    return run;
  }, [documentsOrganizerFetch, userId]);

  const completeOrganizerImportRun = useCallback(async (runId: string | null) => {
    if (!runId) {
      return null;
    }

    const params = new URLSearchParams({ user_id: userId });
    const response = await documentsOrganizerFetch<{ run?: unknown }>(
      `/imports/runs/${encodeURIComponent(runId)}?${params.toString()}`,
      {
        method: "PATCH",
        body: JSON.stringify({}),
      }
    );
    const run = normalizeOrganizerImportRun(response.run);
    if (run) {
      setOrganizerImportRuns(current => [run, ...current.filter(item => item.id !== run.id)].slice(0, 6));
    }
    return run;
  }, [documentsOrganizerFetch, userId]);

  const runOrganizerScan = useCallback(async () => {
    try {
      setOrganizerScanning(true);
      setOrganizerError(null);
      setOrganizerFilesError(null);
      setOrganizerScanStatus(null);
      setOrganizerMoveStatus(null);
      setOrganizerImportStatus(null);
      const params = new URLSearchParams({ user_id: userId });
      const payload = await documentsOrganizerFetch<DocumentsOrganizerScanResult>(
        `/scan?${params.toString()}`,
        { method: "POST", body: JSON.stringify({}) }
      );
      const nextSummary = normalizeOrganizerSummary(payload.summary);
      setOrganizerSummary(nextSummary);
	      setOrganizerMovePlan(null);
	      setOrganizerMoveConfirmation("");
	      setOrganizerSelectedFolderKey("all");
	      setOrganizerSelectedSourceRoot("");
	      setOrganizerSelectedFileIds(new Set());
      setOrganizerBulkImportConfirmation("");
      setOrganizerBulkImportResults([]);
      setOrganizerFiles(null);
	      setOrganizerScanStatus(payload.message || `Indexed ${payload.indexed_file_count.toLocaleString()} local files.`);
	      void loadOrganizerDuplicates();
	      void loadOrganizerCollections();
	      void loadOrganizerRecommendations();
    } catch (err) {
      console.error("Failed to scan local documents:", err);
      setOrganizerError("Could not scan local document folders.");
    } finally {
      setOrganizerScanning(false);
    }
	  }, [documentsOrganizerFetch, loadOrganizerCollections, loadOrganizerDuplicates, loadOrganizerRecommendations, userId]);

  const loadOrganizerMovePlan = useCallback(async () => {
    try {
      setOrganizerMovePlanLoading(true);
      setOrganizerError(null);
      setOrganizerMoveStatus(null);
      setOrganizerMoveConfirmation("");
      const params = new URLSearchParams({ user_id: userId });
      const payload = await documentsOrganizerFetch<unknown>(
        `/plan-move?${params.toString()}`,
        { method: "POST", body: JSON.stringify({ sample_limit: 18 }) }
      );
      const plan = normalizeOrganizerMovePlan(payload);
      setOrganizerMovePlan(plan);
      setOrganizerMoveStatus(plan.message);
    } catch (err) {
      console.error("Failed to plan local document moves:", err);
      setOrganizerError("Could not preview local folder moves.");
    } finally {
      setOrganizerMovePlanLoading(false);
    }
  }, [documentsOrganizerFetch, userId]);

  const exportOrganizerMovePlan = useCallback(async () => {
    try {
      setOrganizerMoveExporting(true);
      setOrganizerError(null);
      setOrganizerMoveStatus(null);
      const params = new URLSearchParams({ user_id: userId });
      const payload = await documentsOrganizerFetch<DocumentsOrganizerMovePlanExport>(
        `/plan-move/export?${params.toString()}`,
        { method: "POST", body: JSON.stringify({}) }
      );
      const plan = normalizeOrganizerMovePlan(payload.plan);
      setOrganizerMovePlan(plan);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadBlob(blob, `documents-organizer-move-plan-${timestamp}.json`);
      setOrganizerMoveStatus(payload.message || `Exported ${payload.action_count.toLocaleString()} planned moves for review.`);
    } catch (err) {
      console.error("Failed to export local document move plan:", err);
      setOrganizerError("Could not export the local folder move plan.");
    } finally {
      setOrganizerMoveExporting(false);
    }
  }, [documentsOrganizerFetch, userId]);

  const applyOrganizerMovePlan = useCallback(async () => {
    try {
      setOrganizerMoveApplying(true);
      setOrganizerError(null);
      setOrganizerMoveStatus(null);
      const params = new URLSearchParams({ user_id: userId });
      const payload = await documentsOrganizerFetch<DocumentsOrganizerMoveResult>(
        `/apply-move?${params.toString()}`,
        {
          method: "POST",
          body: JSON.stringify({ confirmation: organizerMoveConfirmation }),
        }
      );
      const nextSummary = normalizeOrganizerSummary(payload.summary);
      setOrganizerSummary(nextSummary);
      setOrganizerMovePlan(null);
      setOrganizerMoveConfirmation("");
      setOrganizerImportStatus(null);
      setOrganizerSelectedFileIds(new Set());
	      setOrganizerBulkImportConfirmation("");
	      setOrganizerBulkImportResults([]);
	      setOrganizerMoveStatus(payload.message || `Moved ${payload.moved_count.toLocaleString()} files.`);
	      void loadOrganizerCollections();
	    } catch (err) {
      console.error("Failed to apply local document moves:", err);
      setOrganizerError("Could not move local documents.");
    } finally {
      setOrganizerMoveApplying(false);
    }
	  }, [documentsOrganizerFetch, loadOrganizerCollections, organizerMoveConfirmation, userId]);

  const loadSuggestions = useCallback(async (documentId: string) => {
    try {
      setSuggestionsLoading(true);
      setSuggestionsError(null);
      const result = await sbGet<SuggestionApiResponse[]>(
        `/api/documents/${documentId}/suggestions`,
        { status: "pending", limit: "100" }
      );
      setSuggestions(Array.isArray(result) ? result.map(transformSuggestion) : []);
    } catch (err) {
      console.error("Failed to load suggestions:", err);
      setSuggestions([]);
      setSuggestionsError("Could not load review changes.");
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  const loadComments = useCallback(async (documentId: string, metadata?: Record<string, unknown>) => {
    const metadataComments = reviewCommentsFromMetadata(metadata);
    try {
      setCommentsLoading(true);
      setCommentsError(null);
      const result = await sbGet<{ comments?: CommentApiResponse[] } | CommentApiResponse[]>(
        `/api/documents/${documentId}/comments`
      );
      const apiComments = Array.isArray(result) ? result : result.comments || [];
      setComments(mergeReviewComments(apiComments.map(transformComment), metadataComments));
    } catch (err) {
      console.error("Failed to load comments:", err);
      setComments(metadataComments);
      if (metadataComments.length === 0) {
        setCommentsError("Could not load comments.");
      }
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  const loadMentionOptions = useCallback(async (doc: DocumentDetail) => {
    try {
      setMentionOptionsLoading(true);
      setMentionOptionsError(null);

      const [workspaceMembers, documentShares] = await Promise.all([
        doc.workspace_id
          ? sbGet<WorkspaceMemberApiResponse[]>(
              `/api/documents/workspaces/${doc.workspace_id}/members`
            ).catch(() => [])
          : Promise.resolve([]),
        sbGet<DocumentShareApiResponse[] | { shares?: DocumentShareApiResponse[] }>(
          `/api/documents/${doc.id}/shares`
        ).catch(() => []),
      ]);

      const shares = Array.isArray(documentShares) ? documentShares : documentShares.shares || [];
      const nextMentions = mergeMentionOptions([
        ...workspaceMembers.map(mentionFromWorkspaceMember).filter((mention): mention is TiptapMentionOption => mention !== null),
        ...shares.map(mentionFromDocumentShare).filter((mention): mention is TiptapMentionOption => mention !== null),
      ]);

      setEditorMentionOptions(nextMentions);
    } catch (err) {
      console.error("Failed to load mention sources:", err);
      setEditorMentionOptions([]);
      setMentionOptionsError("Could not load document mention sources.");
    } finally {
      setMentionOptionsLoading(false);
    }
  }, []);

  const editingDocReviewCommentsSnapshot = useMemo(
    () => JSON.stringify(editingDoc?.metadata?.[REVIEW_COMMENTS_METADATA_KEY] || []),
    [editingDoc?.metadata]
  );

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    loadWorkspacesAndFolders();
  }, [loadWorkspacesAndFolders]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateViewportWidth = () => {
      setDocumentsViewportWidth(window.innerWidth);
    };

    updateViewportWidth();
    window.addEventListener("resize", updateViewportWidth);
    return () => window.removeEventListener("resize", updateViewportWidth);
  }, []);

	  useEffect(() => {
	    if (organizerOpen) {
	      void loadOrganizerSummary();
	      void loadOrganizerCollections();
	      void loadOrganizerRecommendations();
	      void loadOrganizerDuplicates();
	      void loadOrganizerImportRuns();
	      void loadOrganizerSavedViews();
	    }
	  }, [
	    loadOrganizerCollections,
	    loadOrganizerDuplicates,
	    loadOrganizerImportRuns,
	    loadOrganizerRecommendations,
    loadOrganizerSavedViews,
    loadOrganizerSummary,
    organizerOpen,
  ]);

  useEffect(() => {
    if (!organizerOpen || !organizerSummary?.scanned_file_count) {
      return;
    }

    void loadOrganizerFiles();
  }, [loadOrganizerFiles, organizerOpen, organizerSummary?.scanned_file_count]);

  useEffect(() => {
    const stagedFileIds = organizerPendingStagedFileIdsRef.current;
    if (stagedFileIds) {
      setOrganizerSelectedFileIds(new Set(stagedFileIds));
      organizerPendingStagedFileIdsRef.current = null;
      return;
    }

	    setOrganizerSelectedFileIds(new Set());
	    setOrganizerBulkImportConfirmation("");
	  }, [organizerFileSearch, organizerFileSort, organizerSelectedFolderKey, organizerSelectedSourceRoot]);

  useEffect(() => {
    if (!organizerOpen || organizerSelectedVisibleFiles.length === 0) {
      setOrganizerImportPreview(null);
      setOrganizerImportPreviewError(null);
      setOrganizerImportPreviewLoading(false);
      return;
    }

    const controller = new AbortController();
    const selectedFiles = organizerSelectedVisibleFiles;

    async function loadOrganizerImportPreview() {
      try {
        setOrganizerImportPreviewLoading(true);
        setOrganizerImportPreviewError(null);
        const params = new URLSearchParams({ user_id: userId });
        const payload = await documentsOrganizerFetch<unknown>(
          `/imports/preview?${params.toString()}`,
          {
            method: "POST",
            body: JSON.stringify({ file_ids: selectedFiles.map(file => file.id) }),
            signal: controller.signal,
          }
        );
        if (!controller.signal.aborted) {
          setOrganizerImportPreview(normalizeOrganizerImportPreview(payload));
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Failed to preview organizer import:", err);
          setOrganizerImportPreview(null);
          setOrganizerImportPreviewError("Could not preview this import batch.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setOrganizerImportPreviewLoading(false);
        }
      }
    }

    void loadOrganizerImportPreview();
    return () => controller.abort();
  }, [
    documentsOrganizerFetch,
    organizerOpen,
    organizerSelectedVisibleFileIdsKey,
    organizerSelectedVisibleFiles,
    userId,
  ]);

  useEffect(() => {
    if (!editingDoc) {
      setSuggestions([]);
      setSuggestionsError(null);
      setSuggestionsLoading(false);
      setComments([]);
      setCommentsError(null);
      setCommentsLoading(false);
      setEditorMentionOptions([]);
      setMentionOptionsError(null);
      setMentionOptionsLoading(false);
      return;
    }
    void loadSuggestions(editingDoc.id);
    void loadComments(editingDoc.id, editingDoc.metadata);
    void loadMentionOptions(editingDoc);
  }, [
    editingDoc?.id,
    editingDoc?.share_count,
    editingDoc?.workspace_id,
    editingDocReviewCommentsSnapshot,
    loadComments,
    loadMentionOptions,
    loadSuggestions,
  ]);

  // ── Actions ──

  const selectedTemplate = useMemo(
    () => getBuiltInDocumentTemplate(selectedTemplateId),
    [selectedTemplateId]
  );
  const createDocumentTitle =
    newDocTitle.trim() ||
    (newDocType === "document" ? selectedTemplate.suggestedTitle : defaultTitleForDocumentType(newDocType));

  const chooseDocumentTemplate = (template: BuiltInDocumentTemplate) => {
    const previousTemplate = getBuiltInDocumentTemplate(selectedTemplateId);
    setSelectedTemplateId(template.id);
    setNewDocTitle(currentTitle => {
      const trimmedTitle = currentTitle.trim();
      if (
        !trimmedTitle ||
        trimmedTitle === previousTemplate.suggestedTitle ||
        trimmedTitle === defaultTitleForDocumentType("document")
      ) {
        return template.suggestedTitle;
      }
      return currentTitle;
    });
  };

  const resetCreateDocumentForm = () => {
    setNewDocTitle("");
    setNewDocType("document");
    setSelectedTemplateId("blank");
  };

  const createDocument = async () => {
    if (!createDocumentTitle.trim()) return;
    try {
      const template = newDocType === "document" ? selectedTemplate : getBuiltInDocumentTemplate("blank");
      const content = newDocType === "document"
        ? cloneTiptapContent(template.content)
        : createEmptyTiptapContent();
      const contentText = newDocType === "document" ? template.contentText : "";
      const metadata = newDocType === "document"
        ? {
            [DOCUMENT_TEMPLATE_METADATA_KEY]: {
              id: template.id,
              title: template.title,
              category: template.category,
              created_at: new Date().toISOString(),
            },
          }
        : undefined;

      const newDoc = await sbPost<Document>(`/api/documents?user_id=${encodeURIComponent(userId)}`, {
        title: createDocumentTitle.trim(),
        document_type: newDocType,
        workspace_id: selectedWorkspaceId,
        folder_id: selectedFolderId,
        content,
        content_text: contentText,
        metadata,
        tags: newDocType === "document" ? template.tags : [],
      });
      rememberCreatedDocumentId(userId, newDoc.id);
      setDocuments(prev => [newDoc, ...prev]);
      resetCreateDocumentForm();
      setShowCreateDoc(false);
      // Open in editor
      openDocument(newDoc);
    } catch (err) {
      console.error("Failed to create document:", err);
      setError("Failed to create document");
    }
  };

  const syncDocumentLocation = useCallback((
    documentId: string | null,
    options: { preserveHash?: boolean } = {}
  ) => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    if (documentId) {
      url.searchParams.set("documentId", documentId);
      if (!options.preserveHash) {
        url.hash = "";
      }
    } else {
      url.searchParams.delete("documentId");
      url.hash = "";
    }

    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  const createFolder = async () => {
    if (!newFolderName.trim() || !selectedWorkspaceId) return;
    try {
      const newFolder = await sbPost<DocumentFolder>(
        `/api/document-workspaces/${selectedWorkspaceId}/folders?user_id=${encodeURIComponent(userId)}`,
        {
          name: newFolderName.trim(),
          parent_folder_id: selectedFolderId,
        }
      );
      setFolders(prev => [...prev, newFolder]);
      setNewFolderName("");
      setShowCreateFolder(false);
    } catch (err) {
      console.error("Failed to create folder:", err);
    }
  };

  const deleteDocument = async (doc: Document) => {
    try {
      await sbDelete(`/api/documents/${doc.id}?user_id=${encodeURIComponent(userId)}`);
      forgetCreatedDocumentId(userId, doc.id);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      setContextMenu(null);
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const toggleFavorite = async (doc: Document) => {
    try {
      if (doc.is_favorite) {
        await sbDelete(`/api/documents/${doc.id}/favorite?user_id=${encodeURIComponent(userId)}`);
      } else {
        await sbPost(`/api/documents/${doc.id}/favorite?user_id=${encodeURIComponent(userId)}`, {});
      }
      setDocuments(prev => prev.map(d =>
        d.id === doc.id ? { ...d, is_favorite: !d.is_favorite } : d
      ));
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  const openDocument = async (
    doc: Document,
    options: { updateUrl?: boolean; preserveHash?: boolean } = {}
  ) => {
    if (options.updateUrl !== false) {
      syncDocumentLocation(doc.id, { preserveHash: options.preserveHash });
    }
    setEditingDoc({ ...doc, content: createEmptyTiptapContent(), content_text: "" });
    setEditorLoading(true);
    setEditorError(null);
    try {
      const detail = await sbGet<DocumentDetail>(`/api/documents/${doc.id}`, { user_id: userId });
      setEditingDoc({ ...doc, ...detail });
    } catch (err) {
      console.error("Failed to load document detail:", err);
      setEditorError("Could not load the latest document content.");
    } finally {
      setEditorLoading(false);
    }
  };

  const openDocumentById = useCallback(async (
    documentId: string,
    options: { updateUrl?: boolean; preserveHash?: boolean } = {}
  ) => {
    if (!documentId.trim()) return;
    if (options.updateUrl !== false) {
      syncDocumentLocation(documentId, { preserveHash: options.preserveHash });
    }

    setEditorLoading(true);
    setEditorError(null);
    try {
      const detail = await sbGet<DocumentDetail>(`/api/documents/${documentId}`, { user_id: userId });
      rememberCreatedDocumentId(userId, detail.id);
      setDocuments(prev => mergeDocuments(prev, [detail]));
      setEditingDoc(detail);
    } catch (err) {
      console.error("Failed to load linked document:", err);
      setEditorError("Could not load the linked document.");
    } finally {
      setEditorLoading(false);
    }
  }, [syncDocumentLocation, userId]);

  const openImportedDocument = useCallback(async (documentId: string) => {
    const detail = await sbGet<DocumentDetail>(`/api/documents/${documentId}`, { user_id: userId });
    rememberCreatedDocumentId(userId, documentId);
    setDocuments(prev => mergeDocuments(prev, [detail]));
    await openDocument(detail);
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const openLinkedDocumentFromLocation = () => {
      const documentId = new URL(window.location.href).searchParams.get("documentId")?.trim();
      if (!documentId || editingDoc?.id === documentId) return;
      void openDocumentById(documentId, { updateUrl: false, preserveHash: true });
    };

    openLinkedDocumentFromLocation();
    window.addEventListener("popstate", openLinkedDocumentFromLocation);
    return () => window.removeEventListener("popstate", openLinkedDocumentFromLocation);
  }, [editingDoc?.id, openDocumentById]);

  const createDoclingDocumentFromResult = useCallback(async (
    doclingResult: DoclingImportResponse,
    source: DoclingImportSource,
    extraMetadata: Record<string, unknown> = {},
  ): Promise<{ document_id?: string; title?: string }> => {
    const markdown =
      doclingResult.exports?.markdown ||
      doclingResult.markdown ||
      doclingResult.exports?.text ||
      doclingResult.text ||
      "";
    if (!markdown.trim()) {
      throw new Error("Docling converted the file but did not return editable text.");
    }

    const importedTitle = doclingResult.title?.trim() || source.name.replace(/\.[^.]+$/, "");
    const safeImportedTitle = importedTitle.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 160) || "Imported document";
    const convertedDocument = convertMarkdownToTiptap(markdown);
    const doclingMetadata = buildDoclingImportMetadata(doclingResult, source, extraMetadata);
    const tags = ["docling-import"];
    if (extraMetadata.import_source === "documents-organizer") {
      tags.push("local-organizer");
    }

    try {
      const createdDoc = await sbPost<Document>(
        `/api/documents?user_id=${encodeURIComponent(userId)}`,
        {
          title: safeImportedTitle,
          document_type: "imported",
          workspace_id: selectedWorkspaceId,
          folder_id: selectedFolderId,
          content: convertedDocument.content,
          content_text: convertedDocument.contentText || markdown,
          metadata: doclingMetadata,
          tags,
        }
      );
      await sbPatch(
        `/api/documents/${createdDoc.id}?user_id=${encodeURIComponent(userId)}`,
        { metadata: doclingMetadata }
      ).catch(err => {
        console.warn("Docling metadata patch failed after structured import.", err);
      });
      return { document_id: createdDoc.id, title: createdDoc.title };
    } catch (createErr) {
      console.warn("Structured Docling document creation failed; falling back to Markdown import.", createErr);
      return sbPost<{ document_id?: string; title?: string }>(
        `/api/documents/import/markdown?user_id=${encodeURIComponent(userId)}`,
        {
          content: markdown,
          filename: `${safeImportedTitle}.md`,
          workspace_id: selectedWorkspaceId,
          folder_id: selectedFolderId,
          create_document: true,
        }
      );
    }
  }, [selectedFolderId, selectedWorkspaceId, userId]);

  const importFile = useCallback(async (file: File) => {
    setImporting(true);
    setImportError(null);

    try {
      const extension = extensionForImportFile(file);
      const params = new URLSearchParams({
        user_id: userId,
        create_document: "true",
      });
      if (selectedWorkspaceId) params.set("workspace_id", selectedWorkspaceId);
      if (selectedFolderId) params.set("folder_id", selectedFolderId);

      let result: { document_id?: string; title?: string };
      if (MARKDOWN_IMPORT_EXTENSIONS.has(extension)) {
        result = await sbPost<{ document_id?: string; title?: string }>(
          `/api/documents/import/markdown?user_id=${encodeURIComponent(userId)}`,
          {
            content: await file.text(),
            filename: file.name,
            workspace_id: selectedWorkspaceId,
            folder_id: selectedFolderId,
            create_document: true,
          }
        );
      } else if (DOCLING_IMPORT_EXTENSIONS.has(extension)) {
        const formData = new FormData();
        formData.append("file", file);
        params.set("exports", "markdown,text,html,json,doctags,vtt,tables,figures,multimodal");
        params.set("assets", "true");
        params.set("ocr", "true");
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 10 * 60 * 1000);
        let response: Response;
        try {
          response = await sbFetch(`/api/documents/import/docling?${params.toString()}`, {
            method: "POST",
            body: formData,
            signal: controller.signal,
          });
        } finally {
          window.clearTimeout(timeoutId);
        }
        if (!response.ok) {
          const errorPayload = await response.json().catch(() => null) as DoclingImportResponse | null;
          const errorText = errorPayload?.error || errorPayload?.detail || `Import failed: ${response.status}`;
          throw new Error(errorText);
        }
        const doclingResult = await response.json() as DoclingImportResponse;
        result = await createDoclingDocumentFromResult(doclingResult, {
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified,
        });
      } else {
        throw new Error("Unsupported import file type for Docling.");
      }

      if (result.document_id) {
        await openImportedDocument(result.document_id);
      } else {
        await loadDocuments();
        setImportError("Imported file did not return a document.");
      }
    } catch (err) {
      console.error("Failed to import document:", err);
      setImportError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }, [createDoclingDocumentFromResult, loadDocuments, openImportedDocument, selectedFolderId, selectedWorkspaceId, userId]);

  const toggleOrganizerFileSelection = useCallback((fileId: string, selected: boolean) => {
    setOrganizerSelectedFileIds(current => {
      const next = new Set(current);
      if (selected) {
        next.add(fileId);
      } else {
        next.delete(fileId);
      }
      return next;
    });
  }, []);

  const setOrganizerVisibleFileSelection = useCallback((selected: boolean) => {
    setOrganizerSelectedFileIds(current => {
      const next = new Set(current);
      for (const file of organizerVisibleFiles) {
        if (selected) {
          next.add(file.id);
        } else {
          next.delete(file.id);
        }
      }
      return next;
    });
  }, [organizerVisibleFiles]);

  const importOrganizerFileToDocument = useCallback(async (file: DocumentsOrganizerFile) => {
    const params = new URLSearchParams({ user_id: userId });
    const payload = await documentsOrganizerFetch<DocumentsOrganizerDoclingImportResult>(
      `/import/${encodeURIComponent(file.id)}?${params.toString()}`,
      {
        method: "POST",
        body: JSON.stringify({
          exports: "markdown,text,html,json,doctags,vtt,tables,figures,multimodal",
        }),
      }
    );
    const sourceFile = normalizeOrganizerFile(payload.source_file) || file;
    const result = await createDoclingDocumentFromResult(
      payload.docling,
      {
        name: sourceFile.filename,
        size: sourceFile.size_bytes,
        modifiedAt: sourceFile.modified_at,
      },
      {
        import_source: "documents-organizer",
        organizer_file_id: sourceFile.id,
        organizer_folder_key: sourceFile.folder_key,
        organizer_folder_name: sourceFile.folder_name,
        organizer_display_path: sourceFile.display_path,
        organizer_relative_path: sourceFile.relative_path,
        organizer_document_type: sourceFile.document_type,
        organizer_physical_move_performed: sourceFile.physical_move_performed === true,
      }
    );

    if (result.document_id) {
      rememberCreatedDocumentId(userId, result.document_id);
    }

    return { sourceFile, result };
  }, [createDoclingDocumentFromResult, documentsOrganizerFetch, userId]);

  const importOrganizerFile = useCallback(async (file: DocumentsOrganizerFile) => {
    if (organizerBulkImporting) {
      return;
    }

    let importRunId: string | null = null;
    try {
      setOrganizerImportingFileId(file.id);
      setOrganizerError(null);
      setOrganizerFilesError(null);
      setOrganizerImportStatus(null);
      setOrganizerBulkImportResults([]);
      const run = await createOrganizerImportRun([file]);
      importRunId = run.id;
      const preflightItem = run.items.find(item => item.file_id === file.id || item.path_hash === file.id);
      if (preflightItem?.status === "skipped") {
        await completeOrganizerImportRun(importRunId).catch((historyError) => {
          console.warn("Failed to complete skipped organizer import run:", historyError);
        });
        setOrganizerImportStatus(`${file.filename} was skipped before Docling import: ${preflightItem.error || "File is outside the import limits."}`);
        return;
      }
      await updateOrganizerImportRunItem(importRunId, file.id, { status: "importing" });
      const { sourceFile, result } = await importOrganizerFileToDocument(file);

      if (result.document_id) {
        await updateOrganizerImportRunItem(importRunId, sourceFile.id, {
          status: "imported",
          document_id: result.document_id,
          title: result.title,
        }).catch((historyError) => {
          console.warn("Failed to record organizer import success:", historyError);
        });
        await completeOrganizerImportRun(importRunId).catch((historyError) => {
          console.warn("Failed to complete organizer import run:", historyError);
        });
        await openImportedDocument(result.document_id);
        setOrganizerImportStatus(`Imported ${sourceFile.filename} as an editable document.`);
      } else {
        await updateOrganizerImportRunItem(importRunId, sourceFile.id, {
          status: "failed",
          error: "Docling converted the local file, but no document id was returned.",
        }).catch((historyError) => {
          console.warn("Failed to record organizer import failure:", historyError);
        });
        await completeOrganizerImportRun(importRunId).catch((historyError) => {
          console.warn("Failed to complete organizer import run:", historyError);
        });
        await loadDocuments();
        setOrganizerImportStatus("Docling converted the local file, but no document id was returned.");
      }
    } catch (err) {
      await updateOrganizerImportRunItem(importRunId, file.id, {
        status: "failed",
        error: err instanceof Error ? err.message : "Import failed.",
      }).catch((historyError) => {
        console.warn("Failed to record organizer import failure:", historyError);
      });
      await completeOrganizerImportRun(importRunId).catch((historyError) => {
        console.warn("Failed to complete organizer import run:", historyError);
      });
      console.error("Failed to import indexed local file:", err);
      setOrganizerError(err instanceof Error ? err.message : "Could not import indexed local file.");
    } finally {
      setOrganizerImportingFileId(null);
    }
  }, [
    completeOrganizerImportRun,
    createOrganizerImportRun,
    importOrganizerFileToDocument,
    loadDocuments,
    openImportedDocument,
    organizerBulkImporting,
    updateOrganizerImportRunItem,
  ]);

  const importSelectedOrganizerFiles = useCallback(async () => {
    const selectedFiles = organizerSelectedVisibleFiles;
    if (
      organizerBulkImporting ||
      selectedFiles.length === 0 ||
      organizerBulkImportConfirmation.trim() !== DOCUMENTS_ORGANIZER_IMPORT_CONFIRMATION ||
      !organizerSelectedImportPreviewReady
    ) {
      return;
    }

    const outcomes: DocumentsOrganizerBulkImportResult[] = [];
    let importRunId: string | null = null;
    try {
      setOrganizerBulkImporting(true);
      setOrganizerImportStatus(null);
      setOrganizerError(null);
      setOrganizerFilesError(null);
      setOrganizerBulkImportResults([]);
      setOrganizerBulkImportProgress({ completed: 0, total: selectedFiles.length });
      const importRun = await createOrganizerImportRun(selectedFiles);
      importRunId = importRun.id;
      const preflightItemsById = new Map<string, DocumentsOrganizerImportRunItem>();
      for (const item of importRun.items) {
        preflightItemsById.set(item.file_id, item);
        if (item.path_hash) {
          preflightItemsById.set(item.path_hash, item);
        }
      }

      for (const file of selectedFiles) {
        try {
          const preflightItem = preflightItemsById.get(file.id);
          if (preflightItem?.status === "skipped") {
            outcomes.push({
              file_id: file.id,
              filename: file.filename,
              status: "skipped",
              error: preflightItem.error || "Skipped by Docling import preflight.",
            });
            setOrganizerBulkImportResults([...outcomes]);
            setOrganizerBulkImportProgress({ completed: outcomes.length, total: selectedFiles.length });
            continue;
          }
          await updateOrganizerImportRunItem(importRunId, file.id, { status: "importing" });
          const { sourceFile, result } = await importOrganizerFileToDocument(file);
          if (!result.document_id) {
            throw new Error("No document id returned.");
          }
          await updateOrganizerImportRunItem(importRunId, sourceFile.id, {
            status: "imported",
            document_id: result.document_id,
            title: result.title,
          });

          outcomes.push({
            file_id: sourceFile.id,
            filename: sourceFile.filename,
            status: "imported",
            document_id: result.document_id,
            title: result.title,
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Import failed.";
          await updateOrganizerImportRunItem(importRunId, file.id, {
            status: "failed",
            error: errorMessage,
          }).catch((historyError) => {
            console.warn("Failed to record organizer import failure:", historyError);
          });
          outcomes.push({
            file_id: file.id,
            filename: file.filename,
            status: "failed",
            error: errorMessage,
          });
        }

        setOrganizerBulkImportResults([...outcomes]);
        setOrganizerBulkImportProgress({ completed: outcomes.length, total: selectedFiles.length });
      }

      await loadDocuments();
      const importedCount = outcomes.filter(result => result.status === "imported").length;
      const failedCount = outcomes.filter(result => result.status === "failed").length;
      const skippedCount = outcomes.filter(result => result.status === "skipped").length;
      setOrganizerSelectedFileIds(current => {
        const next = new Set(current);
        for (const file of selectedFiles) {
          next.delete(file.id);
        }
        return next;
      });
      setOrganizerBulkImportConfirmation("");
      const skippedSuffix = skippedCount > 0 ? ` and ${skippedCount} skipped` : "";
      setOrganizerImportStatus(
        failedCount > 0
          ? `Imported ${importedCount} of ${selectedFiles.length} selected files; ${failedCount} failed${skippedSuffix}.`
          : skippedCount > 0
            ? `Imported ${importedCount} selected files; ${skippedCount} skipped by preflight.`
          : `Imported ${importedCount} selected files as editable documents.`
      );
      await completeOrganizerImportRun(importRunId).catch((historyError) => {
        console.warn("Failed to complete organizer import run:", historyError);
      });
    } catch (err) {
      await completeOrganizerImportRun(importRunId).catch((historyError) => {
        console.warn("Failed to complete organizer import run:", historyError);
      });
      console.error("Failed to import selected indexed local files:", err);
      setOrganizerError(err instanceof Error ? err.message : "Could not import selected indexed files.");
    } finally {
      setOrganizerBulkImporting(false);
      setOrganizerBulkImportProgress(current => ({ completed: current.completed, total: 0 }));
    }
  }, [
    completeOrganizerImportRun,
    createOrganizerImportRun,
    importOrganizerFileToDocument,
    loadDocuments,
    organizerBulkImportConfirmation,
    organizerBulkImporting,
    organizerSelectedImportPreviewReady,
    organizerSelectedVisibleFiles,
    updateOrganizerImportRunItem,
  ]);

  const resumeOrganizerImportRun = useCallback(async (
    run: DocumentsOrganizerImportRun,
    mode: "unfinished" | "failed"
  ) => {
    if (organizerImportBusy) {
      return;
    }

    const importItems = run.items.filter(item => (
      mode === "failed"
        ? item.status === "failed"
        : item.status === "pending" || item.status === "importing"
    ));
    if (importItems.length === 0) {
      return;
    }

    const outcomes: DocumentsOrganizerBulkImportResult[] = [];
    try {
      setOrganizerResumingImportRunId(run.id);
      setOrganizerBulkImporting(true);
      setOrganizerImportStatus(null);
      setOrganizerError(null);
      setOrganizerFilesError(null);
      setOrganizerBulkImportResults([]);
      setOrganizerBulkImportProgress({ completed: 0, total: importItems.length });

      for (const item of importItems) {
        const file = organizerFileFromImportRunItem(item);
        try {
          await updateOrganizerImportRunItem(run.id, file.id, { status: "importing" });
          const { sourceFile, result } = await importOrganizerFileToDocument(file);
          if (!result.document_id) {
            throw new Error("No document id returned.");
          }

          await updateOrganizerImportRunItem(run.id, sourceFile.id, {
            status: "imported",
            document_id: result.document_id,
            title: result.title,
          });
          outcomes.push({
            file_id: sourceFile.id,
            filename: sourceFile.filename,
            status: "imported",
            document_id: result.document_id,
            title: result.title,
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Import failed.";
          await updateOrganizerImportRunItem(run.id, file.id, {
            status: "failed",
            error: errorMessage,
          }).catch((historyError) => {
            console.warn("Failed to record organizer import resume failure:", historyError);
          });
          outcomes.push({
            file_id: file.id,
            filename: file.filename,
            status: "failed",
            error: errorMessage,
          });
        }

        setOrganizerBulkImportResults([...outcomes]);
        setOrganizerBulkImportProgress({ completed: outcomes.length, total: importItems.length });
      }

      await completeOrganizerImportRun(run.id).catch((historyError) => {
        console.warn("Failed to complete organizer import run:", historyError);
      });
      await loadDocuments();
      const importedCount = outcomes.filter(result => result.status === "imported").length;
      const failedCount = outcomes.length - importedCount;
      setOrganizerImportStatus(
        failedCount > 0
          ? `Resumed import run: ${importedCount} imported, ${failedCount} failed.`
          : `Resumed import run: ${importedCount} files imported.`
      );
    } catch (err) {
      console.error("Failed to resume organizer import run:", err);
      setOrganizerError(err instanceof Error ? err.message : "Could not resume import run.");
    } finally {
      setOrganizerBulkImporting(false);
      setOrganizerBulkImportProgress(current => ({ completed: current.completed, total: 0 }));
      setOrganizerResumingImportRunId(null);
      void loadOrganizerImportRuns();
    }
  }, [
    completeOrganizerImportRun,
    importOrganizerFileToDocument,
    loadDocuments,
    loadOrganizerImportRuns,
    organizerImportBusy,
    updateOrganizerImportRunItem,
  ]);

  const uploadEditorMedia = useCallback(async (file: File): Promise<TiptapMediaUploadResult | null> => {
    const fileId = uuidv4();
    const isImage = file.type.startsWith("image/");
    const formData = new FormData();

    formData.append("endpoint", "default");
    formData.append("endpointType", "");
    formData.append("file", file, encodeURIComponent(file.name));
    formData.append("file_id", fileId);

    if (isImage) {
      const { width, height } = await getImageDimensions(file);
      formData.append("width", String(width));
      formData.append("height", String(height));
    } else {
      formData.append("message_file", "true");
    }

    const response = await sbFetch(isImage ? "/api/files/images" : "/api/files", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(errorText || `Media upload failed: ${response.status}`);
    }

    const uploaded = await response.json() as UploadedEditorMediaApiResponse;
    const src = uploadedMediaSource(uploaded, userId);
    if (!src) return null;

    return {
      src,
      fileId: uploaded.file_id || fileId,
      filename: uploaded.filename || file.name,
      contentType: uploaded.type || file.type,
      source: uploaded.source,
      bytes: uploaded.bytes,
      width: uploaded.width,
      height: uploaded.height,
    };
  }, [userId]);

  const saveEditingDocument = async (payload: TiptapSavePayload) => {
    if (!editingDoc) return;
    if (editorReadOnly) {
      throw new Error(editorReadOnlyReason || "Document is read only");
    }

    let latestDocForSave: DocumentDetail | null = null;

    if (payload.baseUpdatedAt) {
      const latestDoc = await sbGet<DocumentDetail>(
        `/api/documents/${editingDoc.id}`,
        { user_id: userId }
      );
      latestDocForSave = latestDoc;
      const latestUpdatedAt = latestDoc.updated_at || "";
      const latestContentMatchesPayload =
        latestDoc.title === payload.title &&
        JSON.stringify(latestDoc.content || null) === JSON.stringify(payload.content || null) &&
        (latestDoc.content_text || "") === payload.contentText;

      if (latestUpdatedAt && latestUpdatedAt !== payload.baseUpdatedAt && !latestContentMatchesPayload) {
        setEditingDoc(latestDoc);
        setDocuments(prev => prev.map(doc =>
          doc.id === latestDoc.id
            ? {
                ...doc,
                title: latestDoc.title,
                status: latestDoc.status,
                word_count: latestDoc.word_count,
                reading_time_minutes: latestDoc.reading_time_minutes,
                updated_at: latestDoc.updated_at,
              }
            : doc
        ));
        throw new TiptapDocumentSaveConflictError();
      }
    }

    const now = new Date().toISOString();
    const baseDoc = latestDocForSave || editingDoc;
    const nextPageSettings: TiptapPageSettings = payload.pageSettings;
    const nextMetadata = {
      ...(baseDoc.metadata || {}),
      [TIPTAP_PAGE_SETTINGS_METADATA_KEY]: nextPageSettings,
    };
    const updated = await sbPatch<DocumentDetail | undefined>(
      `/api/documents/${editingDoc.id}?user_id=${encodeURIComponent(userId)}`,
      {
        title: payload.title,
        document_type: baseDoc.document_type,
        status: baseDoc.status,
        content: payload.content,
        content_text: payload.contentText,
        metadata: nextMetadata,
        word_count: payload.wordCount,
        reading_time_minutes: Math.max(1, Math.ceil(payload.wordCount / 220)),
      }
    );

    const nextDoc: DocumentDetail = {
      ...baseDoc,
      ...updated,
      title: updated?.title || payload.title,
      content: (updated?.content as Record<string, unknown> | undefined) || payload.content,
      content_text: updated?.content_text || payload.contentText,
      metadata: updated?.metadata || nextMetadata,
      word_count: updated?.word_count ?? payload.wordCount,
      reading_time_minutes: updated?.reading_time_minutes ?? Math.max(1, Math.ceil(payload.wordCount / 220)),
      updated_at: updated?.updated_at || now,
    };

    writeLocalDocumentVersionSnapshot(nextDoc, {
      changeNote: "Saved from Tiptap editor",
      authorId: userId,
    });
    try {
      await persistDurableDocumentVersionSnapshot(nextDoc, userId, authToken, {
        changeNote: "Saved from Tiptap editor",
        changeType: "tiptap_snapshot",
        authorId: userId,
      });
    } catch (snapshotErr) {
      console.warn("Failed to persist durable document version snapshot:", snapshotErr);
    }
    setEditingDoc(nextDoc);
    setDocuments(prev => prev.map(doc =>
      doc.id === nextDoc.id
        ? {
            ...doc,
            title: nextDoc.title,
            status: nextDoc.status,
            word_count: nextDoc.word_count,
            reading_time_minutes: nextDoc.reading_time_minutes,
            updated_at: nextDoc.updated_at,
          }
        : doc
    ));
  };

  const createReviewSuggestion = useCallback(async (suggestion: SuggestionData) => {
    if (!editingDoc) return;

    const optimisticSuggestion = suggestionFromTrackChange(suggestion);
    setSuggestions(prev => upsertSuggestion(prev, optimisticSuggestion));
    setSuggestionsError(null);

    try {
      const created = await sbPost<SuggestionApiResponse>(
        `/api/documents/${editingDoc.id}/suggestions?user_id=${encodeURIComponent(userId)}`,
        {
          suggestion_id: suggestion.id,
          suggestion_type: suggestion.type,
          original_text: suggestion.type === "deletion" ? suggestion.originalText || suggestion.text : undefined,
          suggested_text: suggestion.type === "insertion" ? suggestion.text : undefined,
          anchor_from: suggestion.from,
          anchor_to: suggestion.to,
          author_name: suggestion.authorName,
          author_color: suggestion.authorColor,
        }
      );
      setSuggestions(prev => upsertSuggestion(prev, transformSuggestion(created)));
    } catch (err) {
      console.error("Failed to create review suggestion:", err);
      setSuggestionsError("Could not sync a review change.");
    }
  }, [editingDoc, userId]);

  const resolveReviewSuggestion = useCallback(async (suggestionId: string, action: "accept" | "reject") => {
    if (!editingDoc) return;

    const nextStatus = action === "accept" ? "accepted" : "rejected";
    setSuggestions(prev => prev.map(suggestion =>
      suggestion.suggestionId === suggestionId ? { ...suggestion, status: nextStatus } : suggestion
    ));
    setSuggestionsError(null);

    try {
      const resolved = await sbPost<SuggestionApiResponse>(
        `/api/documents/${editingDoc.id}/suggestions/${suggestionId}/${action}?user_id=${encodeURIComponent(userId)}`,
        {}
      );
      setSuggestions(prev => upsertSuggestion(prev, transformSuggestion(resolved)));
    } catch (err) {
      console.error("Failed to resolve review suggestion:", err);
      setSuggestionsError("Could not update a review change.");
      void loadSuggestions(editingDoc.id);
    }
  }, [editingDoc, loadSuggestions, userId]);

  const persistReviewCommentsMetadata = useCallback(async (
    documentId: string,
    nextMetadata: Record<string, unknown>
  ) => {
    try {
      await sbPatch<DocumentDetail | undefined>(
        `/api/documents/${documentId}?user_id=${encodeURIComponent(userId)}`,
        { metadata: nextMetadata }
      );
      return true;
    } catch (err) {
      console.error("Failed to persist review comments metadata:", err);
      setCommentsError("Could not sync comments metadata.");
      return false;
    }
  }, [userId]);

  const createReviewComment = useCallback(async (comment: TiptapCommentCreatePayload): Promise<TiptapReviewComment | void> => {
    if (!editingDoc) return undefined;

    setCommentsError(null);
    try {
      const created = await sbPost<CommentApiResponse>(
        `/api/documents/${editingDoc.id}/comments?user_id=${encodeURIComponent(userId)}`,
        {
          content: comment.content,
          anchor_type: comment.anchorType,
          anchor_from: comment.anchorFrom,
          anchor_to: comment.anchorTo,
          anchor_text: comment.anchorText,
        }
      );
      const nextComment = transformComment(created);
      const nextComments = upsertComment(comments, nextComment);
      const nextMetadata = metadataWithReviewComments(editingDoc.metadata, nextComments);
      const nextOpenCommentCount = openCommentCount(nextComments);

      setComments(nextComments);
      setEditingDoc(prev => prev ? {
        ...prev,
        metadata: nextMetadata,
        comment_count: nextOpenCommentCount,
      } : prev);
      setDocuments(prev => prev.map(doc =>
        doc.id === editingDoc.id ? { ...doc, comment_count: nextOpenCommentCount } : doc
      ));
      await persistReviewCommentsMetadata(editingDoc.id, nextMetadata);
      return nextComment;
    } catch (err) {
      console.error("Failed to create review comment:", err);
      setCommentsError("Could not sync a comment.");
      throw err;
    }
  }, [comments, editingDoc, persistReviewCommentsMetadata, userId]);

  const resolveReviewComment = useCallback(async (commentId: string) => {
    if (!editingDoc) return;

    const optimisticComments = comments.map(comment =>
      comment.id === commentId ? { ...comment, isResolved: true } : comment
    );
    const optimisticMetadata = metadataWithReviewComments(editingDoc.metadata, optimisticComments);
    const optimisticOpenCommentCount = openCommentCount(optimisticComments);

    setComments(optimisticComments);
    setEditingDoc(prev => prev ? {
      ...prev,
      metadata: optimisticMetadata,
      comment_count: optimisticOpenCommentCount,
    } : prev);
    setDocuments(prev => prev.map(doc =>
      doc.id === editingDoc.id ? { ...doc, comment_count: optimisticOpenCommentCount } : doc
    ));
    setCommentsError(null);

    try {
      const resolved = await sbPost<CommentApiResponse>(
        `/api/documents/${editingDoc.id}/comments/${commentId}/resolve?user_id=${encodeURIComponent(userId)}`,
        {}
      );
      const nextComment = transformComment(resolved);
      const nextComments = upsertComment(
        optimisticComments.filter(comment => comment.id !== commentId),
        nextComment
      );
      const nextMetadata = metadataWithReviewComments(editingDoc.metadata, nextComments);
      const nextOpenCommentCount = openCommentCount(nextComments);

      setComments(nextComments);
      setEditingDoc(prev => prev ? {
        ...prev,
        metadata: nextMetadata,
        comment_count: nextOpenCommentCount,
      } : prev);
      setDocuments(prev => prev.map(doc =>
        doc.id === editingDoc.id ? { ...doc, comment_count: nextOpenCommentCount } : doc
      ));
      await persistReviewCommentsMetadata(editingDoc.id, nextMetadata);
    } catch (err) {
      console.error("Failed to resolve comment:", err);
      setCommentsError("Could not resolve comment.");
      void loadComments(editingDoc.id, editingDoc.metadata);
    }
  }, [comments, editingDoc, loadComments, persistReviewCommentsMetadata, userId]);

  const exportEditingDocument = useCallback(async (format: DocumentExportFormat) => {
    if (!editingDoc) return;

    const option = DOCUMENT_EXPORT_OPTIONS.find(item => item.value === format);
    setExportingFormat(format);
    setExportError(null);

    try {
      const response = await sbFetch(
        `/api/documents/${editingDoc.id}/export?user_id=${encodeURIComponent(userId)}`,
        {
          method: "POST",
          body: JSON.stringify({
            format,
            include_metadata: true,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Export failed: ${response.status}`);
      }

      const blob = await response.blob();
      const fallbackFilename = `${sanitizeExportFilename(editingDoc.title)}${option?.extension || ""}`;
      downloadBlob(blob, filenameFromDisposition(response.headers.get("content-disposition")) || fallbackFilename);
      setExportMenuOpen(false);
    } catch (err) {
      console.error("Failed to export document:", err);
      setExportError("Export failed.");
    } finally {
      setExportingFormat(null);
    }
  }, [editingDoc, userId]);

  const loadCombinedHistoryVersions = useCallback(async (documentId: string) => {
    let serverVersions: DocumentVersion[] = [];
    let durableVersions: DocumentVersion[] = [];
    let retentionReport: DocumentVersionRetentionReport | null = null;
    let retentionTrendReport: DocumentVersionRetentionTrendReport | null = null;
    let serverError: unknown = null;
    let durableError: unknown = null;

    try {
      const payload = await sbGet<unknown>(`/api/documents/${documentId}/versions`);
      serverVersions = normalizeDocumentVersions(payload);
    } catch (err) {
      serverError = err;
      console.error("Failed to load document versions:", err);
    }

    try {
      const durableHistory = await loadDurableDocumentVersions(documentId, userId, authToken);
      durableVersions = durableHistory.versions;
      retentionReport = durableHistory.retentionReport;
    } catch (err) {
      durableError = err;
      console.warn("Failed to load durable document versions:", err);
    }

    if (authToken) {
      try {
        retentionTrendReport = await loadDurableDocumentRetentionTrends(documentId, userId, authToken);
      } catch (err) {
        console.warn("Failed to load durable document retention trends:", err);
      }
    }

    const localVersions = readLocalDocumentVersions(documentId).filter(restorableLocalVersion);

    if (localVersions.length > 0 && authToken) {
      try {
        const mirroredVersions = await persistDurableDocumentVersionSnapshots(
          documentId,
          localVersions,
          userId,
          authToken
        );
        durableVersions = normalizeDocumentVersions([...durableVersions, ...mirroredVersions])
          .map(version => ({ ...version, source: "durable" as const }));
        retentionReport = buildDocumentVersionRetentionReport(
          durableVersions,
          retentionReport?.max_snapshots
        );
        retentionTrendReport = buildDocumentVersionRetentionTrendReport(durableVersions, retentionReport);
      } catch (mirrorErr) {
        console.warn("Failed to mirror local document history to durable storage:", mirrorErr);
      }
    }

    const versions = combineDocumentVersions(documentId, serverVersions, durableVersions);
    const effectiveRetentionReport = retentionReport || buildDocumentVersionRetentionReport(versions);

    return {
      versions,
      retentionReport: retentionReport || effectiveRetentionReport,
      retentionTrendReport: retentionTrendReport || buildDocumentVersionRetentionTrendReport(
        versions,
        effectiveRetentionReport
      ),
      serverError,
      durableError,
    };
  }, [authToken, userId]);

  const openVersionHistory = useCallback(async (doc: Document | DocumentDetail) => {
    setHistoryDoc(doc);
    setHistoryVersions([]);
    setHistoryRetentionReport(null);
    setHistoryRetentionTrendReport(null);
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryNotice(null);
    setExpandedHistoryVersionId(null);
    setUpdatingRetentionVersionId(null);

    try {
      const { versions, retentionReport, retentionTrendReport, serverError, durableError } =
        await loadCombinedHistoryVersions(doc.id);
      const nextRetentionReport = retentionReport || buildDocumentVersionRetentionReport(versions);
      setHistoryVersions(versions);
      setHistoryRetentionReport(nextRetentionReport);
      setHistoryRetentionTrendReport(
        retentionTrendReport || buildDocumentVersionRetentionTrendReport(versions, nextRetentionReport)
      );

      if (serverError && durableError && versions.length === 0) {
        setHistoryError("Could not load version history.");
      }
    } catch (err) {
      console.error("Failed to load document versions:", err);
      setHistoryError("Could not load version history.");
    } finally {
      setHistoryLoading(false);
    }
  }, [loadCombinedHistoryVersions]);

  const closeVersionHistory = useCallback(() => {
    setHistoryDoc(null);
    setHistoryVersions([]);
    setHistoryRetentionReport(null);
    setHistoryRetentionTrendReport(null);
    setHistoryError(null);
    setHistoryNotice(null);
    setHistoryLoading(false);
    setExpandedHistoryVersionId(null);
    setRestoringVersionId(null);
    setUpdatingRetentionVersionId(null);
    setExportingRetentionReport(false);
  }, []);

  const openRetentionDashboard = useCallback(async () => {
    setShowRetentionDashboard(true);
    setRetentionDashboard(null);
    setRetentionDashboardError(null);
    setRetentionDashboardDispatchStatus(null);
    setRetentionBackupEvidenceStatus(null);
    setRetentionBackupEvidenceRecording(false);
    setRetentionEvidenceReminderNotifying(false);
    setRetentionEvidenceReminderNotifyStatus(null);
    setRetentionEvidenceReminderRetrying(false);
    setRetentionEvidenceReminderRetryStatus(null);
    setRetentionRestoreDownloadVerifying(false);
    setRetentionRestoreDownloadStatus(null);
    setRetentionRestoreDownloadResult(null);
    setRetentionPrunePreview(null);
    setRetentionPruneConfirmation("");
    setRetentionPruneStatus(null);
    setRetentionRestoreDrillConfirmation("");
    setRetentionRestoreDrillExecuting(false);
    setRetentionRestoreDrillStatus(null);
    setRetentionDashboardLoading(true);

    try {
      const adminDashboard = await loadAdminDocumentRetentionDashboard(userId, authToken);
      if (adminDashboard) {
        setRetentionDashboard(adminDashboard);
        setRetentionDashboardLoading(false);
        setRetentionPruneLoading(true);
        try {
          setRetentionPrunePreview(await loadAdminDocumentRetentionPrunePreview(userId, authToken));
        } catch (_pruneErr) {
          setRetentionPruneStatus("Prune preview unavailable.");
        } finally {
          setRetentionPruneLoading(false);
        }
        return;
      }
    } catch (_err) {
      // Non-admin users fall through to an accessible-document dashboard.
    }

    try {
      const accessibleDashboard = await loadAccessibleDocumentRetentionDashboard(documents, userId, authToken);
      if (accessibleDashboard) {
        setRetentionDashboard(accessibleDashboard);
        setRetentionDashboardLoading(false);
        return;
      }

      setRetentionDashboardError("No durable retention data is available for the current document set yet.");
    } catch (err) {
      console.error("Failed to load document retention dashboard:", err);
      setRetentionDashboardError("Could not load the retention dashboard.");
    } finally {
      setRetentionDashboardLoading(false);
    }
  }, [authToken, documents, userId]);

  const closeRetentionDashboard = useCallback(() => {
    setShowRetentionDashboard(false);
    setRetentionDashboard(null);
    setRetentionDashboardError(null);
    setRetentionDashboardLoading(false);
    setRetentionDashboardDispatching(false);
    setRetentionDashboardDispatchStatus(null);
    setRetentionBackupEvidenceRecording(false);
    setRetentionBackupEvidenceStatus(null);
    setRetentionEvidenceReminderNotifying(false);
    setRetentionEvidenceReminderNotifyStatus(null);
    setRetentionEvidenceReminderRetrying(false);
    setRetentionEvidenceReminderRetryStatus(null);
    setRetentionRestoreDownloadVerifying(false);
    setRetentionRestoreDownloadStatus(null);
    setRetentionRestoreDownloadResult(null);
    setRetentionPrunePreview(null);
    setRetentionPruneLoading(false);
    setRetentionPruneExecuting(false);
    setRetentionPruneConfirmation("");
    setRetentionPruneStatus(null);
    setRetentionRestoreDrillConfirmation("");
    setRetentionRestoreDrillExecuting(false);
    setRetentionRestoreDrillStatus(null);
  }, []);

  const dispatchRetentionDashboardExports = useCallback(async () => {
    if (!retentionDashboard || retentionDashboard.scope !== "admin") return;

    setRetentionDashboardDispatching(true);
    setRetentionDashboardDispatchStatus(null);
    setRetentionEvidenceReminderNotifyStatus(null);
    setRetentionEvidenceReminderRetryStatus(null);
    setRetentionRestoreDownloadStatus(null);
    setRetentionRestoreDownloadResult(null);
    setRetentionDashboardError(null);

    try {
      const dispatchResult = await dispatchAdminDocumentRetentionExports(userId, authToken);
      const refreshedDashboard = await loadAdminDocumentRetentionDashboard(
        userId,
        authToken,
        retentionDashboard.window.days
      );

      if (refreshedDashboard) {
        setRetentionDashboard(refreshedDashboard);
      }

      try {
        setRetentionPrunePreview(await loadAdminDocumentRetentionPrunePreview(userId, authToken));
      } catch (_pruneErr) {
        setRetentionPruneStatus("Prune preview unavailable.");
      }

      setRetentionDashboardDispatchStatus(
        dispatchResult.attempted_count > 0
          ? `${dispatchResult.dispatched_count} delivered / ${dispatchResult.failed_count} failed`
          : "No due delivery jobs."
      );
    } catch (err) {
      console.error("Failed to dispatch retention export jobs:", err);
      setRetentionDashboardError("Could not dispatch due retention export jobs.");
    } finally {
      setRetentionDashboardDispatching(false);
    }
  }, [authToken, retentionDashboard, userId]);

  const recordRetentionBackupEvidence = useCallback(async () => {
    if (!retentionDashboard || retentionDashboard.scope !== "admin") return;

    setRetentionBackupEvidenceRecording(true);
    setRetentionBackupEvidenceStatus(null);
    setRetentionDashboardError(null);

    try {
      const result = await recordAdminDocumentRetentionBackupEvidence(userId, authToken);
      setRetentionDashboard(previous => previous
        ? {
            ...previous,
            backup_verification: result.verification,
          }
        : previous
      );
      setRetentionBackupEvidenceStatus(
        result.created
          ? "Backup verification evidence recorded."
          : "Backup verification evidence was already recorded."
      );
    } catch (err) {
      console.error("Failed to record backup verification evidence:", err);
      setRetentionBackupEvidenceStatus("Could not record backup verification evidence.");
    } finally {
      setRetentionBackupEvidenceRecording(false);
    }
  }, [authToken, retentionDashboard, userId]);

  const notifyRetentionEvidenceReminder = useCallback(async () => {
    if (!retentionDashboard || retentionDashboard.scope !== "admin") return;

    setRetentionEvidenceReminderNotifying(true);
    setRetentionEvidenceReminderNotifyStatus(null);
    setRetentionEvidenceReminderRetryStatus(null);
    setRetentionDashboardError(null);

    try {
      const result = await notifyAdminDocumentRetentionEvidenceReminder(userId, authToken);
      setRetentionDashboard(previous => previous
        ? {
            ...previous,
            backup_verification: result.verification,
          }
        : previous
      );
      setRetentionEvidenceReminderNotifyStatus(
        result.delivered_count > 0
          ? "Evidence reminder notification recorded."
          : result.skipped_count > 0
            ? "Evidence reminder notification skipped; evidence is current."
            : result.message || "Evidence reminder notification needs attention."
      );
    } catch (err) {
      console.error("Failed to notify backup evidence reminder:", err);
      setRetentionEvidenceReminderNotifyStatus("Could not notify evidence reminder.");
    } finally {
      setRetentionEvidenceReminderNotifying(false);
    }
  }, [authToken, retentionDashboard, userId]);

  const retryRetentionEvidenceReminderNotifications = useCallback(async () => {
    if (!retentionDashboard || retentionDashboard.scope !== "admin") return;

    setRetentionEvidenceReminderRetrying(true);
    setRetentionEvidenceReminderRetryStatus(null);
    setRetentionEvidenceReminderNotifyStatus(null);
    setRetentionDashboardError(null);

    try {
      const result = await retryAdminDocumentRetentionEvidenceReminderNotifications(userId, authToken);
      setRetentionDashboard(previous => previous
        ? {
            ...previous,
            backup_verification: result.verification,
          }
        : previous
      );
      setRetentionEvidenceReminderRetryStatus(
        result.delivered_count > 0
          ? `Retried ${result.delivered_count} evidence reminder notification${result.delivered_count === 1 ? "" : "s"}.`
          : result.failed_count > 0
            ? "Retry attempted; evidence reminder notification still needs attention."
            : result.pending_retry_count > 0
              ? "No failed reminder notifications are due yet."
              : result.message || "No failed reminder notifications need retry."
      );
    } catch (err) {
      console.error("Failed to retry evidence reminder notifications:", err);
      setRetentionEvidenceReminderRetryStatus("Could not retry failed reminder notifications.");
    } finally {
      setRetentionEvidenceReminderRetrying(false);
    }
  }, [authToken, retentionDashboard, userId]);

  const verifyRetentionRestoreDownload = useCallback(async () => {
    if (!retentionDashboard || retentionDashboard.scope !== "admin") return;

    const manifestId = retentionDashboard.backup_verification.latest_manifest_id;
    setRetentionRestoreDownloadVerifying(true);
    setRetentionRestoreDownloadStatus(null);
    setRetentionRestoreDownloadResult(null);
    setRetentionDashboardError(null);

    try {
      const result = await verifyAdminDocumentRetentionRestoreDownload(userId, authToken, manifestId);
      setRetentionRestoreDownloadResult(result);
      setRetentionRestoreDownloadStatus(
        result?.status === "verified"
          ? "Restore-download verification passed."
          : result?.status === "metadata-only"
            ? "Latest manifest is metadata-only; use local-file or S3 storage to verify downloads."
            : result?.message || "Restore-download verification needs attention."
      );
    } catch (err) {
      console.error("Failed to verify retention restore download:", err);
      setRetentionRestoreDownloadStatus("Could not verify restore download.");
    } finally {
      setRetentionRestoreDownloadVerifying(false);
    }
  }, [authToken, retentionDashboard, userId]);

  const executeRetentionDashboardPrune = useCallback(async () => {
    if (!retentionDashboard || retentionDashboard.scope !== "admin" || !retentionPrunePreview) return;
    if (retentionPruneConfirmation.trim() !== retentionPrunePreview.confirmation_token) return;

    setRetentionPruneExecuting(true);
    setRetentionPruneStatus(null);
    setRetentionDashboardError(null);

    try {
      const execution = await executeAdminDocumentRetentionPrune(
        userId,
        authToken,
        retentionPruneConfirmation.trim(),
        retentionPrunePreview.candidate_limit
      );
      setRetentionPrunePreview(execution);
      setRetentionPruneConfirmation("");
      setRetentionRestoreDrillConfirmation("");
      setRetentionRestoreDrillStatus(null);
      setRetentionPruneStatus(
        execution.deleted_count && execution.deleted_count > 0
          ? `${execution.deleted_count.toLocaleString()} snapshots pruned.`
          : "No prune candidates were deleted."
      );
      const refreshedDashboard = await loadAdminDocumentRetentionDashboard(
        userId,
        authToken,
        retentionDashboard.window.days
      );
      if (refreshedDashboard) {
        setRetentionDashboard(refreshedDashboard);
      }
    } catch (err) {
      console.error("Failed to prune retention snapshots:", err);
      setRetentionPruneStatus("Could not prune retention snapshots.");
    } finally {
      setRetentionPruneExecuting(false);
    }
  }, [
    authToken,
    retentionDashboard,
    retentionPruneConfirmation,
    retentionPrunePreview,
    userId,
  ]);

  const executeRetentionDashboardRestoreDrill = useCallback(async () => {
    if (!retentionDashboard || retentionDashboard.scope !== "admin") return;

    const latestAudit = retentionPrunePreview?.audit ||
      retentionPrunePreview?.audit_history[0] ||
      retentionDashboard.prune_audit_history[0] ||
      null;

    if (!latestAudit || retentionRestoreDrillConfirmation.trim() !== DOCUMENTS_RETENTION_RESTORE_DRILL_CONFIRMATION) {
      return;
    }

    setRetentionRestoreDrillExecuting(true);
    setRetentionRestoreDrillStatus(null);
    setRetentionDashboardError(null);

    try {
      const drillExecution = await executeAdminDocumentRetentionRestoreDrill(
        userId,
        authToken,
        latestAudit.audit_id,
        retentionRestoreDrillConfirmation.trim()
      );
      setRetentionRestoreDrillConfirmation("");
      setRetentionRestoreDrillStatus(
        drillExecution.status === "completed"
          ? "Restore drill completed from backup/export handoff metadata."
          : "Restore drill is blocked."
      );

      const completedAudit = drillExecution.audit;
      if (completedAudit) {
        setRetentionPrunePreview(previous => previous
          ? {
              ...previous,
              audit: completedAudit,
              restore_drill: drillExecution.restore_drill || completedAudit.restore_drill || previous.restore_drill || null,
              scheduled_prune_automation: drillExecution.scheduled_prune_automation,
              audit_history: [
                completedAudit,
                ...previous.audit_history.filter(item => item.audit_id !== completedAudit.audit_id),
              ],
            }
          : previous
        );
      }

      const refreshedDashboard = await loadAdminDocumentRetentionDashboard(
        userId,
        authToken,
        retentionDashboard.window.days
      );
      if (refreshedDashboard) {
        setRetentionDashboard(refreshedDashboard);
      }
    } catch (err) {
      console.error("Failed to run retention restore drill:", err);
      setRetentionRestoreDrillStatus("Could not run restore drill.");
    } finally {
      setRetentionRestoreDrillExecuting(false);
    }
  }, [
    authToken,
    retentionDashboard,
    retentionPrunePreview,
    retentionRestoreDrillConfirmation,
    userId,
  ]);

  const exportVersionHistoryBackup = useCallback(() => {
    if (!historyDoc) return;

    const backup = createLocalDocumentVersionBackup(historyDoc);
    const versions = Array.isArray(backup.versions) ? backup.versions : [];
    setHistoryError(null);
    setHistoryNotice(null);

    if (versions.length === 0) {
      setHistoryError("No local history snapshots to export yet.");
      return;
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${sanitizeExportFilename(historyDoc.title)}-version-history.json`);
    setHistoryNotice(`Exported ${versions.length} local snapshots.`);
  }, [historyDoc]);

  const exportDocumentRetentionReport = useCallback(async () => {
    if (!historyDoc) return;

    const currentRetentionReport =
      historyRetentionReport || buildDocumentVersionRetentionReport(historyVersions);
    setExportingRetentionReport(true);
    setHistoryError(null);
    setHistoryNotice(null);

    try {
      let exportPayload: Record<string, unknown> | DocumentVersionRetentionExportPayload;

      try {
        const durablePayload = await loadDurableDocumentRetentionReport(historyDoc.id, userId, authToken);
        exportPayload = {
          ...durablePayload,
          document_title: historyDoc.title,
        };
      } catch (err) {
        console.warn("Failed to load durable retention export, using current panel state:", err);
        exportPayload = createDocumentVersionRetentionExportPayload(
          historyDoc,
          currentRetentionReport,
          historyVersions
        );
      }

      const exportRecord = recordFromUnknown(exportPayload);
      const exportedReport =
        normalizeDocumentVersionRetentionReport(exportRecord?.retention_report) || currentRetentionReport;
      const durableSnapshotCount = exportedReport.total_count;

      if (durableSnapshotCount <= 0) {
        setHistoryError("No durable snapshots to include in the retention report yet.");
        return;
      }

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
      downloadBlob(blob, `${sanitizeExportFilename(historyDoc.title)}-retention-report.json`);
      setHistoryNotice(
        `Exported retention report for ${durableSnapshotCount} durable ${durableSnapshotCount === 1 ? "snapshot" : "snapshots"}.`
      );
    } catch (err) {
      console.error("Failed to export document retention report:", err);
      setHistoryError("Could not export the retention report.");
    } finally {
      setExportingRetentionReport(false);
    }
  }, [authToken, historyDoc, historyRetentionReport, historyVersions, userId]);

  const importVersionHistoryBackup = useCallback(async (file: File | null) => {
    if (!historyDoc || !file) return;

    setHistoryError(null);
    setHistoryNotice(null);

    try {
      const payload = JSON.parse(await file.text()) as unknown;
      const { added, versions: localVersions } = mergeImportedLocalDocumentVersions(historyDoc.id, payload);
      let mirrored = false;

      try {
        await persistDurableDocumentVersionSnapshots(historyDoc.id, localVersions, userId, authToken);
        mirrored = true;
      } catch (persistErr) {
        console.warn("Failed to persist imported document history backup:", persistErr);
      }

      const { versions, retentionReport, retentionTrendReport } = await loadCombinedHistoryVersions(historyDoc.id);
      const nextRetentionReport = retentionReport || buildDocumentVersionRetentionReport(versions);
      setHistoryVersions(versions);
      setHistoryRetentionReport(nextRetentionReport);
      setHistoryRetentionTrendReport(
        retentionTrendReport || buildDocumentVersionRetentionTrendReport(versions, nextRetentionReport)
      );
      setHistoryNotice(
        added > 0 && mirrored
          ? `Imported ${added} local snapshots and mirrored them to durable history.`
          : added > 0
            ? `Imported ${added} local snapshots.`
            : "No new snapshots were imported."
      );
    } catch (err) {
      console.error("Failed to import document history backup:", err);
      setHistoryError("Could not import that history backup.");
    } finally {
      if (historyImportInputRef.current) {
        historyImportInputRef.current.value = "";
      }
    }
  }, [authToken, historyDoc, loadCombinedHistoryVersions, userId]);

  const updateDocumentVersionRetention = useCallback(async (
    version: DocumentVersion,
    retentionPolicy: DocumentVersionRetentionPolicy,
    retainedUntil?: string | null
  ) => {
    if (!historyDoc || version.source !== "durable") return;

    const retainedUntilValue = retentionPolicy === "retain-until"
      ? retainedUntil || version.retained_until || defaultDocumentVersionRetainedUntil()
      : null;

    setUpdatingRetentionVersionId(version.id);
    setHistoryError(null);
    setHistoryNotice(null);

    try {
      const { version: updated, retentionReport } = await updateDurableDocumentVersionRetention(
        historyDoc.id,
        version.id,
        userId,
        authToken,
        retentionPolicy,
        retainedUntilValue
      );

      if (!updated) {
        throw new Error("No updated version returned.");
      }

      const nextHistoryVersions = historyVersions
        .map(item => item.id === version.id ? updated : item)
        .sort(compareDocumentVersions);
      const nextRetentionReport = retentionReport || buildDocumentVersionRetentionReport(
        nextHistoryVersions,
        historyRetentionReport?.max_snapshots
      );
      setHistoryVersions(nextHistoryVersions);
      setHistoryRetentionReport(nextRetentionReport);
      setHistoryRetentionTrendReport(
        buildDocumentVersionRetentionTrendReport(nextHistoryVersions, nextRetentionReport)
      );
      setHistoryNotice(
        retentionPolicy === "keep-forever"
          ? `Version ${version.version_number} will be kept forever.`
          : retentionPolicy === "retain-until"
            ? `Version ${version.version_number} will be retained until ${new Date(retainedUntilValue || "").toLocaleDateString()}.`
            : `Version ${version.version_number} will follow keep-latest retention.`
      );
    } catch (err) {
      console.error("Failed to update document version retention:", err);
      setHistoryError("Could not update that retention policy.");
    } finally {
      setUpdatingRetentionVersionId(null);
    }
  }, [authToken, historyDoc, historyRetentionReport?.max_snapshots, historyVersions, userId]);

  const restoreDocumentVersion = useCallback(async (version: DocumentVersion) => {
    if (!historyDoc) return;

    setRestoringVersionId(version.id);
    setHistoryError(null);
    setHistoryNotice(null);

    try {
      const latestBeforeRestore = await sbGet<DocumentDetail>(
        `/api/documents/${historyDoc.id}`,
        { user_id: userId }
      );

      if (documentChangedSinceHistoryOpened(historyDoc, latestBeforeRestore)) {
        writeLocalDocumentVersionSnapshot(latestBeforeRestore, {
          changeNote: "Latest copy before restore",
          authorId: userId,
        });
        try {
          await persistDurableDocumentVersionSnapshot(latestBeforeRestore, userId, authToken, {
            changeNote: "Latest copy before restore",
            changeType: "pre_restore_snapshot",
            authorId: userId,
          });
        } catch (snapshotErr) {
          console.warn("Failed to persist pre-restore document snapshot:", snapshotErr);
        }
        setDocuments(prev => mergeDocuments(prev, [latestBeforeRestore]));
        setHistoryDoc(latestBeforeRestore);

        if (editingDoc?.id === latestBeforeRestore.id) {
          setEditingDoc(latestBeforeRestore);
        }

        const { versions, retentionReport, retentionTrendReport } = await loadCombinedHistoryVersions(historyDoc.id);
        const nextRetentionReport = retentionReport || buildDocumentVersionRetentionReport(versions);
        setHistoryVersions(versions);
        setHistoryRetentionReport(nextRetentionReport);
        setHistoryRetentionTrendReport(
          retentionTrendReport || buildDocumentVersionRetentionTrendReport(versions, nextRetentionReport)
        );
        setHistoryError("Document changed after History opened. Latest copy refreshed; restore again if this version is still intended.");
        return;
      }

      let detail: DocumentDetail;
      const restoreBaseDoc = latestBeforeRestore || historyDoc;

      if (documentVersionRestoresThroughPatch(version)) {
        const contentText = version.content_text || "";
        const wordCount = version.word_count ?? countWords(contentText);
        const now = new Date().toISOString();
        const updated = await sbPatch<DocumentDetail | undefined>(
          `/api/documents/${restoreBaseDoc.id}?user_id=${encodeURIComponent(userId)}`,
          {
            title: version.title,
            document_type: restoreBaseDoc.document_type,
            status: restoreBaseDoc.status,
            content: version.content || null,
            content_text: contentText,
            metadata: version.metadata || restoreBaseDoc.metadata || {},
            word_count: wordCount,
            reading_time_minutes: Math.max(1, Math.ceil(wordCount / 220)),
          }
        );
        detail = {
          ...restoreBaseDoc,
          ...updated,
          title: updated?.title || version.title,
          content: (updated?.content as Record<string, unknown> | undefined) || version.content || null,
          content_text: updated?.content_text || contentText,
          metadata: updated?.metadata || version.metadata || restoreBaseDoc.metadata || {},
          word_count: updated?.word_count ?? wordCount,
          reading_time_minutes: updated?.reading_time_minutes ?? Math.max(1, Math.ceil(wordCount / 220)),
          updated_at: updated?.updated_at || now,
        };
      } else {
        await sbPost(
          `/api/documents/${historyDoc.id}/restore/${encodeURIComponent(version.id)}?user_id=${encodeURIComponent(userId)}`,
          {}
        );
        detail = await sbGet<DocumentDetail>(`/api/documents/${historyDoc.id}`, { user_id: userId });
      }

      writeLocalDocumentVersionSnapshot(detail, {
        changeNote: `Restored ${version.title}`,
        authorId: userId,
      });
      try {
        await persistDurableDocumentVersionSnapshot(detail, userId, authToken, {
          changeNote: `Restored ${version.title}`,
          changeType: "restored_snapshot",
          authorId: userId,
        });
      } catch (snapshotErr) {
        console.warn("Failed to persist restored document snapshot:", snapshotErr);
      }
      setDocuments(prev => mergeDocuments(prev, [detail]));
      setHistoryDoc(detail);

      if (editingDoc?.id === detail.id) {
        setEditingDoc(detail);
      }

      const { versions, retentionReport, retentionTrendReport } = await loadCombinedHistoryVersions(historyDoc.id);
      const nextRetentionReport = retentionReport || buildDocumentVersionRetentionReport(versions);
      setHistoryVersions(versions);
      setHistoryRetentionReport(nextRetentionReport);
      setHistoryRetentionTrendReport(
        retentionTrendReport || buildDocumentVersionRetentionTrendReport(versions, nextRetentionReport)
      );
      setHistoryNotice(`Restored ${version.title}.`);
    } catch (err) {
      console.error("Failed to restore document version:", err);
      setHistoryError("Could not restore that version.");
    } finally {
      setRestoringVersionId(null);
    }
  }, [authToken, editingDoc?.id, historyDoc, loadCombinedHistoryVersions, userId]);

  const openOfficeFallback = async () => {
    if (!editingDoc) return;
    try {
      const config = await sbGet<{ document?: { url?: string } }>(
        `/api/documents/office/config/${editingDoc.id}`,
        { user_id: userId }
      );
      if (config?.document?.url) {
        window.open(
          `http://localhost:8088/web-apps/apps/documenteditor/main/index.html?url=${encodeURIComponent(config.document.url)}`,
          "_blank"
        );
        return;
      }
    } catch (err) {
      console.warn("Office config unavailable; opening fallback editor.", err);
    }
    window.open(OFFICE_EDITOR_BASE_URL, "_blank");
  };

  const closeEditor = () => {
    syncDocumentLocation(null);
    setEditingDoc(null);
    setEditorError(null);
    setEditorLoading(false);
    setSuggestions([]);
    setSuggestionsError(null);
    setSuggestionsLoading(false);
    setComments([]);
    setCommentsError(null);
    setCommentsLoading(false);
    closeVersionHistory();
    loadDocuments(); // Refresh to pick up changes
  };

  // ── Filtered & sorted docs ──

  const displayDocs = useMemo(() => {
    let filtered = [...documents];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.content_text?.toLowerCase().includes(q) ||
        d.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    filtered.sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "created") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    return filtered;
  }, [documents, searchQuery, sortBy]);

  // ── Close context menu on click outside ──
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu]);

  const historyLocalVersionCount = historyDoc
    ? readLocalDocumentVersions(historyDoc.id).filter(restorableLocalVersion).length
    : 0;
  const historyRetentionSummary = useMemo(
    () => historyRetentionReport || buildDocumentVersionRetentionReport(historyVersions),
    [historyRetentionReport, historyVersions]
  );
  const historyRetentionMetricItems = useMemo(() => [
    { label: "Durable", value: historyRetentionSummary.total_count.toLocaleString() },
    { label: "Protected", value: historyRetentionSummary.protected_count.toLocaleString() },
    { label: "Keep latest", value: historyRetentionSummary.keep_latest_count.toLocaleString() },
    { label: "Keep forever", value: historyRetentionSummary.keep_forever_count.toLocaleString() },
    { label: "Retain until", value: historyRetentionSummary.active_retain_until_count.toLocaleString() },
    { label: "Prunable", value: historyRetentionSummary.prunable_count.toLocaleString() },
    { label: "Over cap", value: historyRetentionSummary.over_limit_count.toLocaleString() },
    { label: "Cap", value: historyRetentionSummary.max_snapshots.toLocaleString() },
  ], [historyRetentionSummary]);
  const historyRetentionTrendSummary = useMemo(() => {
    const report = historyRetentionTrendReport || buildDocumentVersionRetentionTrendReport(
      historyVersions,
      historyRetentionSummary
    );
    const buckets = report.buckets || [];
    const visibleBuckets = buckets.slice(-10);
    const latestBucket = buckets[buckets.length - 1] || null;
    const capturedCount = buckets.reduce((total, bucket) => total + bucket.created_count, 0);
    const maxCreatedCount = Math.max(1, ...visibleBuckets.map(bucket => bucket.created_count));

    return {
      report,
      buckets: visibleBuckets,
      latestBucket,
      capturedCount,
      maxCreatedCount,
    };
  }, [historyRetentionSummary, historyRetentionTrendReport, historyVersions]);
  const retentionDashboardMetricItems = useMemo(() => {
    const report = retentionDashboard?.retention_report;
    if (!report) return [];

    return [
      { label: "Documents", value: retentionDashboard.documents_count.toLocaleString() },
      { label: "Snapshots", value: report.total_count.toLocaleString() },
      { label: "Protected", value: report.protected_count.toLocaleString() },
      { label: "Prunable", value: report.prunable_count.toLocaleString() },
      { label: "Over cap", value: report.over_limit_count.toLocaleString() },
      { label: "Expired", value: report.expired_retain_until_count.toLocaleString() },
    ];
  }, [retentionDashboard]);
  const retentionDashboardVisibleBuckets = useMemo(
    () => (retentionDashboard?.buckets || []).slice(-10),
    [retentionDashboard]
  );
  const retentionDashboardMaxCreated = useMemo(
    () => Math.max(1, ...retentionDashboardVisibleBuckets.map(bucket => bucket.created_count)),
    [retentionDashboardVisibleBuckets]
  );
  const retentionDashboardTopAlerts = useMemo(
    () => (retentionDashboard?.alerts || []).slice(0, 4),
    [retentionDashboard]
  );
  const retentionDashboardTopPolicyActions = useMemo(
    () => (retentionDashboard?.policy_automation.actions || []).slice(0, 3),
    [retentionDashboard]
  );
  const retentionDashboardDeliveryHistory = useMemo(
    () => {
      const history = retentionDashboard?.delivery_history || [];
      if (history.length > 0) return history.slice(0, 3);
      return retentionDashboard?.export_delivery ? [retentionDashboard.export_delivery] : [];
    },
    [retentionDashboard]
  );
  const retentionPruneTopDocuments = useMemo(
    () => (retentionPrunePreview?.documents || [])
      .filter(document => document.candidate_count > 0)
      .slice(0, 3),
    [retentionPrunePreview]
  );
  const retentionPruneLatestAudit = useMemo(
    () => retentionPrunePreview?.audit || retentionPrunePreview?.audit_history[0] || retentionDashboard?.prune_audit_history[0] || null,
    [retentionDashboard, retentionPrunePreview]
  );
  const retentionPruneRestoreDrill = retentionPrunePreview?.restore_drill || retentionPruneLatestAudit?.restore_drill || null;
  const retentionScheduledPruneAutomation = retentionPrunePreview?.scheduled_prune_automation ||
    retentionDashboard?.scheduled_prune_automation ||
    null;
  const retentionBackupVerification = retentionDashboard?.backup_verification || null;
  const retentionBackupVerificationColor = retentionBackupVerification?.status === "verified" ? "#0f766e" : "#b45309";
  const retentionBackupEvidenceReminder = retentionBackupVerification?.evidence_reminder || null;
  const retentionLatestReminderNotification = retentionBackupVerification?.latest_evidence_reminder_notification || null;
  const retentionBackupEvidenceReminderColor = retentionBackupEvidenceReminder?.severity === "critical"
    ? "#dc2626"
    : retentionBackupEvidenceReminder?.severity === "warning"
      ? "#b45309"
      : "#0f766e";
  const retentionBackupEvidenceReviewLabel = retentionBackupVerification
    ? retentionBackupVerification.evidence_review_status.replace("-", " ")
    : "";
  const retentionBackupEvidenceExpiryLabel = retentionBackupVerification?.latest_evidence_expires_at
    ? retentionBackupVerification.evidence_expired
      ? `expired ${new Date(retentionBackupVerification.latest_evidence_expires_at).toLocaleDateString()}`
      : typeof retentionBackupVerification.evidence_expires_in_days === "number"
        ? `expires in ${Math.max(0, retentionBackupVerification.evidence_expires_in_days).toLocaleString()}d`
        : `expires ${new Date(retentionBackupVerification.latest_evidence_expires_at).toLocaleDateString()}`
    : null;
  const retentionBackupEvidenceReminderDueLabel = retentionBackupEvidenceReminder?.due_at
    ? new Date(retentionBackupEvidenceReminder.due_at).toLocaleDateString()
    : null;
  const retentionRestoreDownloadColor = retentionRestoreDownloadResult?.status === "verified" ||
    retentionBackupVerification?.restore_download_status === "ready"
    ? "#0f766e"
    : retentionRestoreDownloadResult?.status === "failed"
      ? "#dc2626"
      : "#b45309";
  const retentionRestoreDownloadStatusLabel = retentionRestoreDownloadResult?.status ||
    retentionBackupVerification?.restore_download_status ||
    "blocked";
  const retentionReminderNotificationColor = retentionLatestReminderNotification?.status === "failed"
    ? "#dc2626"
    : retentionLatestReminderNotification?.status === "delivered"
      ? "#0f766e"
      : "#b45309";
  const retentionReminderRetryReadyCount = retentionBackupVerification?.evidence_reminder_notification_retry_ready_count || 0;
  const retentionReminderPendingRetryCount = retentionBackupVerification?.evidence_reminder_notification_pending_retry_count || 0;
  const retentionReminderFailedCount = retentionBackupVerification?.evidence_reminder_notification_failed_count || 0;
  const retentionRestoreDrillNeedsHandoff =
    Boolean(retentionPruneLatestAudit) &&
    (retentionPruneRestoreDrill?.status === "required" || retentionPruneRestoreDrill?.status === "blocked");
  const retentionRestoreDrillConfirmationMatches =
    retentionRestoreDrillConfirmation.trim() === DOCUMENTS_RETENTION_RESTORE_DRILL_CONFIRMATION;
  const retentionPruneConfirmationMatches =
    Boolean(retentionPrunePreview) &&
    retentionPruneConfirmation.trim() === retentionPrunePreview.confirmation_token;

  const retentionDashboardPanel = showRetentionDashboard ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Documents retention dashboard"
      onClick={closeRetentionDashboard}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2450,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "rgba(0,0,0,0.46)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
      }}
    >
      <div
        data-testid="streetbot-documents-retention-dashboard"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, calc(100vw - 28px))",
          maxHeight: "84vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: "10px",
          border: `1px solid ${colors.border}`,
          background: isDark ? "rgba(25,28,36,0.98)" : "rgba(255,255,255,0.98)",
          boxShadow: isDark ? "0 26px 70px rgba(0,0,0,0.55)" : "0 26px 70px rgba(15,23,42,0.22)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "14px 16px",
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isDark ? "rgba(20,184,166,0.16)" : "rgba(20,184,166,0.1)",
              color: "#0f766e",
              flexShrink: 0,
            }}
          >
            <BarChart3 size={17} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ margin: 0, color: colors.text, fontSize: "0.98rem", fontWeight: 800 }}>
              Retention Dashboard
            </h3>
            <div style={{ marginTop: "2px", color: colors.textMuted, fontSize: "0.76rem" }}>
              {retentionDashboard?.scope === "admin" ? "Admin scope" : "Accessible documents"}
              {retentionDashboard ? ` / ${retentionDashboard.window.days}d window` : ""}
            </div>
          </div>
          {retentionDashboard?.scope === "admin" ? (
            <button
              type="button"
              onClick={() => void dispatchRetentionDashboardExports()}
              disabled={retentionDashboardLoading || retentionDashboardDispatching}
              aria-label="Dispatch due retention exports"
              title="Dispatch due retention exports"
              style={{
                height: "30px",
                borderRadius: "6px",
                border: `1px solid ${colors.border}`,
                background: isDark ? "rgba(20,184,166,0.12)" : "rgba(20,184,166,0.09)",
                color: "#0f766e",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "0 9px",
                fontSize: "0.68rem",
                fontWeight: 850,
                cursor: retentionDashboardLoading || retentionDashboardDispatching ? "not-allowed" : "pointer",
                opacity: retentionDashboardLoading || retentionDashboardDispatching ? 0.55 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {retentionDashboardDispatching
                ? <Loader2 size={13} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                : <RefreshCw size={13} />}
              Dispatch due
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void openRetentionDashboard()}
            disabled={retentionDashboardLoading}
            aria-label="Refresh retention dashboard"
            title="Refresh retention dashboard"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "6px",
              border: `1px solid ${colors.border}`,
              background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.82)",
              color: colors.textMuted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: retentionDashboardLoading ? "not-allowed" : "pointer",
              opacity: retentionDashboardLoading ? 0.5 : 1,
            }}
          >
            {retentionDashboardLoading
              ? <Loader2 size={15} className="spin" style={{ animation: "spin 1s linear infinite" }} />
              : <RefreshCw size={15} />}
          </button>
          <button
            type="button"
            onClick={closeRetentionDashboard}
            aria-label="Close retention dashboard"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "6px",
              border: "none",
              background: "transparent",
              color: colors.textMuted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "14px", overflowY: "auto" }}>
          {retentionDashboardLoading ? (
            <div
              style={{
                minHeight: "220px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "9px",
                color: colors.textMuted,
                fontSize: "0.84rem",
                fontWeight: 650,
              }}
            >
              <Loader2 size={16} className="spin" style={{ animation: "spin 1s linear infinite" }} />
              Loading retention dashboard
            </div>
          ) : retentionDashboardError ? (
            <div
              role="alert"
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid rgba(220,38,38,0.28)",
                background: isDark ? "rgba(220,38,38,0.12)" : "rgba(254,226,226,0.8)",
                color: "#dc2626",
                fontSize: "0.82rem",
                fontWeight: 650,
              }}
            >
              {retentionDashboardError}
            </div>
          ) : retentionDashboard ? (
            <>
              {retentionDashboardDispatchStatus ? (
                <div
                  style={{
                    marginBottom: "10px",
                    borderRadius: "8px",
                    border: `1px solid ${colors.border}`,
                    background: isDark ? "rgba(20,184,166,0.11)" : "rgba(20,184,166,0.08)",
                    color: "#0f766e",
                    padding: "8px 10px",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                  }}
                >
                  {retentionDashboardDispatchStatus}
                </div>
              ) : null}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(104px, 1fr))",
                  gap: "8px",
                }}
              >
                {retentionDashboardMetricItems.map(item => (
                  <div
                    key={item.label}
                    style={{
                      minHeight: "56px",
                      borderRadius: "8px",
                      border: `1px solid ${colors.border}`,
                      padding: "8px",
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.025)",
                    }}
                  >
                    <div style={{ color: colors.textMuted, fontSize: "0.66rem", fontWeight: 800, textTransform: "uppercase" }}>
                      {item.label}
                    </div>
                    <div style={{ marginTop: "5px", color: colors.text, fontSize: "1rem", fontWeight: 850 }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: "12px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    borderRadius: "8px",
                    border: `1px solid ${colors.border}`,
                    padding: "10px",
                    background: isDark ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.66)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", color: colors.text, fontSize: "0.78rem", fontWeight: 850 }}>
                      <AlertTriangle size={14} />
                      Alerts
                    </div>
                    <span style={{ color: colors.textMuted, fontSize: "0.66rem", fontWeight: 850 }}>
                      {retentionDashboard.alerting.alert_count.toLocaleString()}
                    </span>
                  </div>

                  <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "7px" }}>
                    {retentionDashboardTopAlerts.length > 0 ? retentionDashboardTopAlerts.map(alert => {
                      const alertColor = alert.severity === "critical"
                        ? "#dc2626"
                        : alert.severity === "warning"
                          ? "#b45309"
                          : "#2563eb";

                      return (
                        <div
                          key={alert.id}
                          style={{
                            borderRadius: "7px",
                            border: `1px solid ${alertColor}33`,
                            background: isDark ? `${alertColor}14` : `${alertColor}0f`,
                            padding: "8px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                            <span style={{ color: alertColor, fontSize: "0.64rem", fontWeight: 900, textTransform: "uppercase" }}>
                              {alert.severity}
                            </span>
                            <span style={{ color: colors.textMuted, fontSize: "0.62rem", fontWeight: 850 }}>
                              {alert.count.toLocaleString()}
                            </span>
                          </div>
                          <div style={{ marginTop: "4px", color: colors.text, fontSize: "0.73rem", fontWeight: 760, lineHeight: 1.3 }}>
                            {alert.message}
                          </div>
                        </div>
                      );
                    }) : (
                      <div style={{ color: colors.textMuted, fontSize: "0.74rem", fontWeight: 700, lineHeight: 1.35 }}>
                        No active retention alerts.
                      </div>
                    )}
                  </div>
                </div>

                {retentionDashboard.scope === "admin" ? (
                  <div
                    style={{
                      borderRadius: "8px",
                      border: `1px solid ${colors.border}`,
                      padding: "10px",
                      background: isDark ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.66)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "7px", color: colors.text, fontSize: "0.78rem", fontWeight: 850 }}>
                        <Trash2 size={14} />
                        Prune Execution
                      </div>
                      <span style={{ color: colors.textMuted, fontSize: "0.66rem", fontWeight: 850 }}>
                        {retentionPruneLoading
                          ? "Loading"
                          : `${(retentionPrunePreview?.candidate_count || 0).toLocaleString()} ready`}
                      </span>
                    </div>

                    <div style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px" }}>
                      {[
                        ["Candidates", (retentionPrunePreview?.total_candidate_count || 0).toLocaleString()],
                        ["Documents", (retentionPrunePreview?.affected_documents_count || 0).toLocaleString()],
                        ["Max", (retentionPrunePreview?.max_snapshots || retentionDashboard.retention_report.max_snapshots).toLocaleString()],
                        ["Mode", retentionPrunePreview?.mode === "confirmed-delete" ? "Executed" : "Preview"],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          style={{
                            borderRadius: "7px",
                            background: isDark ? "rgba(255,255,255,0.055)" : "rgba(15,23,42,0.045)",
                            padding: "7px",
                            minWidth: 0,
                          }}
                        >
                          <div style={{ color: colors.textMuted, fontSize: "0.6rem", fontWeight: 850, textTransform: "uppercase" }}>
                            {label}
                          </div>
                          <div style={{ marginTop: "3px", color: colors.text, fontSize: "0.72rem", fontWeight: 800, overflowWrap: "anywhere" }}>
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>

                    {retentionPruneStatus ? (
                      <div style={{ marginTop: "8px", color: retentionPruneStatus.startsWith("Could not") ? "#dc2626" : "#0f766e", fontSize: "0.7rem", fontWeight: 800, lineHeight: 1.35 }}>
                        {retentionPruneStatus}
                      </div>
                    ) : null}

                    {retentionPruneLatestAudit ? (
                      <div
                        style={{
                          marginTop: "8px",
                          borderRadius: "7px",
                          background: isDark ? "rgba(20,184,166,0.1)" : "rgba(20,184,166,0.07)",
                          border: "1px solid rgba(20,184,166,0.22)",
                          padding: "8px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                          <span style={{ color: "#0f766e", fontSize: "0.64rem", fontWeight: 900, textTransform: "uppercase" }}>
                            Audit Trail
                          </span>
                          <span style={{ color: colors.textMuted, fontSize: "0.62rem", fontWeight: 850 }}>
                            {retentionPruneLatestAudit.deleted_count.toLocaleString()} deleted
                          </span>
                        </div>
                        <div style={{ marginTop: "4px", color: colors.textMuted, fontSize: "0.69rem", fontWeight: 730, lineHeight: 1.35, overflowWrap: "anywhere" }}>
                          {retentionPruneLatestAudit.audit_id}
                          {retentionPruneLatestAudit.executed_at ? ` / ${timeAgo(retentionPruneLatestAudit.executed_at)}` : ""}
                        </div>
                        {retentionPruneRestoreDrill ? (
                          <>
                            <div style={{ marginTop: "4px", color: retentionPruneRestoreDrill.status === "required" || retentionPruneRestoreDrill.status === "blocked" ? "#b45309" : colors.textMuted, fontSize: "0.68rem", fontWeight: 780, lineHeight: 1.35 }}>
                              Restore drill: {retentionPruneRestoreDrill.status.replace("-", " ")}
                              {retentionPruneRestoreDrill.sample?.content_hash
                                ? ` / ${retentionPruneRestoreDrill.sample.content_hash.slice(0, 12)}`
                                : ""}
                            </div>
                            {retentionPruneRestoreDrill.backup_handoff ? (
                              <div style={{ marginTop: "3px", color: colors.textMuted, fontSize: "0.66rem", fontWeight: 730, lineHeight: 1.35 }}>
                                Backup handoff: {retentionPruneRestoreDrill.backup_handoff.status.replace("-", " ")}
                                {retentionPruneRestoreDrill.primary_history_check
                                  ? ` / Primary check ${retentionPruneRestoreDrill.primary_history_check.status}`
                                  : ""}
                              </div>
                            ) : null}
                            {retentionRestoreDrillStatus ? (
                              <div style={{ marginTop: "5px", color: retentionRestoreDrillStatus.startsWith("Could not") ? "#dc2626" : "#0f766e", fontSize: "0.67rem", fontWeight: 800, lineHeight: 1.35 }}>
                                {retentionRestoreDrillStatus}
                              </div>
                            ) : null}
                            {retentionRestoreDrillNeedsHandoff ? (
                              <div style={{ marginTop: "7px", display: "flex", gap: "7px", alignItems: "center" }}>
                                <input
                                  value={retentionRestoreDrillConfirmation}
                                  onChange={(event) => setRetentionRestoreDrillConfirmation(event.target.value)}
                                  disabled={retentionRestoreDrillExecuting}
                                  aria-label="Restore drill confirmation"
                                  placeholder={DOCUMENTS_RETENTION_RESTORE_DRILL_CONFIRMATION}
                                  style={{
                                    minWidth: 0,
                                    flex: 1,
                                    height: "28px",
                                    borderRadius: "6px",
                                    border: `1px solid ${colors.border}`,
                                    background: isDark ? "rgba(15,23,42,0.52)" : "rgba(255,255,255,0.82)",
                                    color: colors.text,
                                    padding: "0 8px",
                                    fontSize: "0.66rem",
                                    fontWeight: 760,
                                    outline: "none",
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => void executeRetentionDashboardRestoreDrill()}
                                  disabled={retentionRestoreDrillExecuting || !retentionRestoreDrillConfirmationMatches}
                                  aria-label="Run restore drill"
                                  title="Run restore drill"
                                  style={{
                                    height: "28px",
                                    borderRadius: "6px",
                                    border: "1px solid rgba(20,184,166,0.28)",
                                    background: isDark ? "rgba(20,184,166,0.14)" : "rgba(20,184,166,0.08)",
                                    color: "#0f766e",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "6px",
                                    padding: "0 8px",
                                    fontSize: "0.65rem",
                                    fontWeight: 850,
                                    cursor: retentionRestoreDrillConfirmationMatches ? "pointer" : "not-allowed",
                                    opacity: retentionRestoreDrillConfirmationMatches ? 1 : 0.55,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {retentionRestoreDrillExecuting
                                    ? <Loader2 size={12} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                                    : <RotateCcw size={12} />}
                                  Drill
                                </button>
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    ) : null}

                    {retentionScheduledPruneAutomation ? (
                      <div
                        style={{
                          marginTop: "8px",
                          borderRadius: "7px",
                          background: isDark ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.08)",
                          border: "1px solid rgba(245,158,11,0.24)",
                          padding: "8px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                          <span style={{ color: "#b45309", fontSize: "0.64rem", fontWeight: 900, textTransform: "uppercase" }}>
                            Scheduled Prune
                          </span>
                          <span style={{ color: colors.textMuted, fontSize: "0.62rem", fontWeight: 850 }}>
                            {retentionScheduledPruneAutomation.status.replace("-", " ")}
                          </span>
                        </div>
                        <div style={{ marginTop: "4px", color: colors.textMuted, fontSize: "0.68rem", fontWeight: 740, lineHeight: 1.35 }}>
                          {retentionScheduledPruneAutomation.message}
                        </div>
                        <div style={{ marginTop: "3px", color: colors.textMuted, fontSize: "0.66rem", fontWeight: 730, lineHeight: 1.35 }}>
                          Required drills: {retentionScheduledPruneAutomation.required_restore_drill_count.toLocaleString()} / allowed: {retentionScheduledPruneAutomation.scheduled_prune_allowed ? "yes" : "no"}
                        </div>
                      </div>
                    ) : null}

                    {retentionBackupVerification ? (
                      <div
                        style={{
                          marginTop: "8px",
                          borderRadius: "7px",
                          background: isDark ? `${retentionBackupVerificationColor}18` : `${retentionBackupVerificationColor}0f`,
                          border: `1px solid ${retentionBackupVerificationColor}33`,
                          padding: "8px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                          <span style={{ color: retentionBackupVerificationColor, fontSize: "0.64rem", fontWeight: 900, textTransform: "uppercase" }}>
                            Backup Verification
                          </span>
                          <span style={{ color: colors.textMuted, fontSize: "0.62rem", fontWeight: 850 }}>
                            {retentionBackupVerification.status.replace("-", " ")}
                          </span>
                        </div>
                        <div style={{ marginTop: "4px", color: colors.textMuted, fontSize: "0.68rem", fontWeight: 740, lineHeight: 1.35 }}>
                          {retentionBackupVerification.message}
                        </div>
                        <div style={{ marginTop: "3px", color: colors.textMuted, fontSize: "0.66rem", fontWeight: 730, lineHeight: 1.35 }}>
                          Manifests: {retentionBackupVerification.delivered_manifest_count.toLocaleString()} / handoff: {retentionBackupVerification.backup_handoff_ready ? "ready" : "needed"}
                        </div>
                        <div style={{ marginTop: "3px", color: colors.textMuted, fontSize: "0.66rem", fontWeight: 730, lineHeight: 1.35, overflowWrap: "anywhere" }}>
                          Export store: {retentionBackupVerification.latest_storage_adapter || "database"} / {retentionBackupVerification.latest_storage_status || (retentionBackupVerification.backup_storage_ready ? "ready" : "pending")}
                        </div>
                        <div style={{ marginTop: "3px", color: colors.textMuted, fontSize: "0.66rem", fontWeight: 730, lineHeight: 1.35, overflowWrap: "anywhere" }}>
                          Restore download: {retentionRestoreDownloadStatusLabel.replace("-", " ")}
                          {retentionBackupVerification.latest_storage_hash ? ` / ${retentionBackupVerification.latest_storage_hash.slice(0, 12)}` : ""}
                        </div>
                        <div style={{ marginTop: "3px", color: colors.textMuted, fontSize: "0.66rem", fontWeight: 730, lineHeight: 1.35 }}>
                          Evidence: {retentionBackupVerification.evidence_count.toLocaleString()} / store: {retentionBackupVerification.evidence_storage_adapter}
                        </div>
                        <div style={{ marginTop: "3px", color: colors.textMuted, fontSize: "0.66rem", fontWeight: 730, lineHeight: 1.35 }}>
                          Evidence review: {retentionBackupEvidenceReviewLabel}{retentionBackupEvidenceExpiryLabel ? ` / ${retentionBackupEvidenceExpiryLabel}` : ""}
                        </div>
                        {retentionBackupEvidenceReminder ? (
                          <div
                            style={{
                              marginTop: "7px",
                              borderRadius: "6px",
                              border: `1px solid ${retentionBackupEvidenceReminderColor}2e`,
                              background: isDark ? `${retentionBackupEvidenceReminderColor}14` : `${retentionBackupEvidenceReminderColor}0d`,
                              padding: "7px",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                              <span style={{ color: retentionBackupEvidenceReminderColor, fontSize: "0.62rem", fontWeight: 900, textTransform: "uppercase" }}>
                                Evidence Reminder
                              </span>
                              <span style={{ color: colors.textMuted, fontSize: "0.6rem", fontWeight: 850 }}>
                                {retentionBackupEvidenceReminder.review_required ? "due" : "scheduled"}
                              </span>
                            </div>
                            <div style={{ marginTop: "4px", color: colors.textMuted, fontSize: "0.66rem", fontWeight: 730, lineHeight: 1.35 }}>
                              {retentionBackupEvidenceReminder.message}
                            </div>
                            <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "5px", color: colors.textMuted, fontSize: "0.63rem", fontWeight: 760, lineHeight: 1.35 }}>
                              <CalendarClock size={11} />
                              {retentionBackupEvidenceReminder.review_required ? "Review now" : "Next review"}
                              {retentionBackupEvidenceReminderDueLabel ? ` / ${retentionBackupEvidenceReminderDueLabel}` : ""}
                            </div>
                          </div>
                        ) : null}
                        <div style={{ marginTop: "3px", color: colors.textMuted, fontSize: "0.66rem", fontWeight: 730, lineHeight: 1.35, overflowWrap: "anywhere" }}>
                          Reminder delivery: {retentionLatestReminderNotification
                            ? `${retentionLatestReminderNotification.status.replace("-", " ")} / ${retentionLatestReminderNotification.delivery_adapter}`
                            : "not sent"}
                        </div>
                        {retentionLatestReminderNotification ? (
                          <div style={{ marginTop: "3px", color: retentionReminderNotificationColor, fontSize: "0.65rem", fontWeight: 780, lineHeight: 1.35, overflowWrap: "anywhere" }}>
                            Notification: {retentionLatestReminderNotification.notification_id || "recorded"}
                            {retentionLatestReminderNotification.delivered_at ? ` / ${timeAgo(retentionLatestReminderNotification.delivered_at)}` : ""}
                          </div>
                        ) : null}
                        {retentionReminderFailedCount > 0 || retentionReminderPendingRetryCount > 0 || retentionReminderRetryReadyCount > 0 ? (
                          <div style={{ marginTop: "3px", color: retentionReminderFailedCount > 0 ? "#dc2626" : colors.textMuted, fontSize: "0.65rem", fontWeight: 780, lineHeight: 1.35, overflowWrap: "anywhere" }}>
                            Reminder retry: {retentionReminderRetryReadyCount.toLocaleString()} due / {retentionReminderPendingRetryCount.toLocaleString()} waiting
                          </div>
                        ) : null}
                        {retentionDashboard?.scope === "admin" ? (
                          <div style={{ marginTop: "3px", color: colors.textMuted, fontSize: "0.65rem", fontWeight: 740, lineHeight: 1.35, overflowWrap: "anywhere" }}>
                            Retry worker: {retentionDashboard.reminder_notification_worker.scheduler_status} / due: {retentionDashboard.reminder_notification_worker.due_job_count.toLocaleString()}
                          </div>
                        ) : null}
                        {retentionEvidenceReminderNotifyStatus ? (
                          <div style={{ marginTop: "5px", color: retentionEvidenceReminderNotifyStatus.startsWith("Could not") ? "#dc2626" : "#0f766e", fontSize: "0.67rem", fontWeight: 800, lineHeight: 1.35 }}>
                            {retentionEvidenceReminderNotifyStatus}
                          </div>
                        ) : null}
                        {retentionEvidenceReminderRetryStatus ? (
                          <div style={{ marginTop: "5px", color: retentionEvidenceReminderRetryStatus.startsWith("Could not") || retentionEvidenceReminderRetryStatus.includes("still needs") ? "#dc2626" : "#0f766e", fontSize: "0.67rem", fontWeight: 800, lineHeight: 1.35 }}>
                            {retentionEvidenceReminderRetryStatus}
                          </div>
                        ) : null}
                        {retentionBackupVerification.latest_evidence_at ? (
                          <div style={{ marginTop: "3px", color: colors.textMuted, fontSize: "0.66rem", fontWeight: 730, lineHeight: 1.35, overflowWrap: "anywhere" }}>
                            Latest evidence: {retentionBackupVerification.latest_evidence_id || "recorded"} / {timeAgo(retentionBackupVerification.latest_evidence_at)}
                          </div>
                        ) : null}
                        {retentionBackupVerification.latest_payload_hash ? (
                          <div style={{ marginTop: "3px", color: colors.textMuted, fontSize: "0.66rem", fontWeight: 730, lineHeight: 1.35, overflowWrap: "anywhere" }}>
                            Manifest: {retentionBackupVerification.latest_manifest_id || "latest"} / {retentionBackupVerification.latest_payload_hash.slice(0, 12)}
                          </div>
                        ) : null}
                        {retentionRestoreDownloadStatus ? (
                          <div style={{ marginTop: "5px", color: retentionRestoreDownloadStatus.startsWith("Could not") || retentionRestoreDownloadResult?.status === "failed" ? "#dc2626" : retentionRestoreDownloadColor, fontSize: "0.67rem", fontWeight: 800, lineHeight: 1.35 }}>
                            {retentionRestoreDownloadStatus}
                          </div>
                        ) : null}
                        {retentionRestoreDownloadResult ? (
                          <div
                            style={{
                              marginTop: "6px",
                              borderRadius: "6px",
                              border: `1px solid ${retentionRestoreDownloadColor}2e`,
                              background: isDark ? `${retentionRestoreDownloadColor}12` : `${retentionRestoreDownloadColor}0b`,
                              padding: "7px",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                              <span style={{ color: retentionRestoreDownloadColor, fontSize: "0.62rem", fontWeight: 900, textTransform: "uppercase" }}>
                                Download Check
                              </span>
                              <span style={{ color: colors.textMuted, fontSize: "0.6rem", fontWeight: 850 }}>
                                {retentionRestoreDownloadResult.status.replace("-", " ")}
                              </span>
                            </div>
                            <div style={{ marginTop: "4px", color: colors.textMuted, fontSize: "0.65rem", fontWeight: 730, lineHeight: 1.35, overflowWrap: "anywhere" }}>
                              Hash: {retentionRestoreDownloadResult.storage_hash_actual?.slice(0, 12) || "unavailable"} / content-free: {retentionRestoreDownloadResult.content_free ? "yes" : "no"}
                            </div>
                          </div>
                        ) : null}
                        {retentionBackupEvidenceStatus ? (
                          <div style={{ marginTop: "5px", color: retentionBackupEvidenceStatus.startsWith("Could not") ? "#dc2626" : "#0f766e", fontSize: "0.67rem", fontWeight: 800, lineHeight: 1.35 }}>
                            {retentionBackupEvidenceStatus}
                          </div>
                        ) : null}
                        <div style={{ marginTop: "7px", display: "flex", flexWrap: "wrap", gap: "7px" }}>
                          <button
                            type="button"
                            onClick={() => void notifyRetentionEvidenceReminder()}
                            disabled={retentionEvidenceReminderNotifying || !retentionBackupEvidenceReminder}
                            aria-label="Notify evidence reminder"
                            title="Notify evidence reminder"
                            style={{
                              height: "28px",
                              borderRadius: "6px",
                              border: `1px solid ${retentionBackupEvidenceReminderColor}33`,
                              background: isDark ? `${retentionBackupEvidenceReminderColor}14` : `${retentionBackupEvidenceReminderColor}0f`,
                              color: retentionBackupEvidenceReminderColor,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                              padding: "0 8px",
                              fontSize: "0.65rem",
                              fontWeight: 850,
                              cursor: retentionEvidenceReminderNotifying || !retentionBackupEvidenceReminder ? "not-allowed" : "pointer",
                              opacity: retentionEvidenceReminderNotifying || !retentionBackupEvidenceReminder ? 0.55 : 1,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {retentionEvidenceReminderNotifying
                              ? <Loader2 size={12} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                              : <Bell size={12} />}
                            Notify reminder
                          </button>
                          <button
                            type="button"
                            onClick={() => void retryRetentionEvidenceReminderNotifications()}
                            disabled={retentionEvidenceReminderRetrying}
                            aria-label="Retry failed reminder notifications"
                            title="Retry failed reminder notifications"
                            style={{
                              height: "28px",
                              borderRadius: "6px",
                              border: `1px solid ${retentionReminderFailedCount > 0 ? "#dc2626" : colors.border}`,
                              background: isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(241, 245, 249, 0.92)",
                              color: retentionReminderFailedCount > 0 ? "#dc2626" : colors.textMuted,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                              padding: "0 8px",
                              fontSize: "0.65rem",
                              fontWeight: 850,
                              cursor: retentionEvidenceReminderRetrying ? "not-allowed" : "pointer",
                              opacity: retentionEvidenceReminderRetrying ? 0.55 : 1,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {retentionEvidenceReminderRetrying
                              ? <Loader2 size={12} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                              : <RotateCcw size={12} />}
                            Retry failed
                          </button>
                          <button
                            type="button"
                            onClick={() => void verifyRetentionRestoreDownload()}
                            disabled={retentionRestoreDownloadVerifying || !retentionBackupVerification.latest_manifest_id}
                            aria-label="Verify restore download"
                            title="Verify restore download"
                            style={{
                              height: "28px",
                              borderRadius: "6px",
                              border: `1px solid ${retentionRestoreDownloadColor}33`,
                              background: isDark ? `${retentionRestoreDownloadColor}14` : `${retentionRestoreDownloadColor}0f`,
                              color: retentionRestoreDownloadColor,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                              padding: "0 8px",
                              fontSize: "0.65rem",
                              fontWeight: 850,
                              cursor: retentionRestoreDownloadVerifying || !retentionBackupVerification.latest_manifest_id ? "not-allowed" : "pointer",
                              opacity: retentionRestoreDownloadVerifying || !retentionBackupVerification.latest_manifest_id ? 0.55 : 1,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {retentionRestoreDownloadVerifying
                              ? <Loader2 size={12} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                              : <Download size={12} />}
                            Verify download
                          </button>
                          <button
                            type="button"
                            onClick={() => void recordRetentionBackupEvidence()}
                            disabled={retentionBackupEvidenceRecording}
                            aria-label="Record backup verification evidence"
                            title="Record backup verification evidence"
                            style={{
                              height: "28px",
                              borderRadius: "6px",
                              border: `1px solid ${retentionBackupVerificationColor}33`,
                              background: isDark ? `${retentionBackupVerificationColor}14` : `${retentionBackupVerificationColor}0f`,
                              color: retentionBackupVerificationColor,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                              padding: "0 8px",
                              fontSize: "0.65rem",
                              fontWeight: 850,
                              cursor: retentionBackupEvidenceRecording ? "not-allowed" : "pointer",
                              opacity: retentionBackupEvidenceRecording ? 0.55 : 1,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {retentionBackupEvidenceRecording
                              ? <Loader2 size={12} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                              : <FileText size={12} />}
                            Record evidence
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {retentionPruneTopDocuments.length > 0 ? (
                      <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {retentionPruneTopDocuments.map(document => (
                          <div
                            key={document.document_id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "8px",
                              borderRadius: "7px",
                              background: isDark ? "rgba(255,255,255,0.055)" : "rgba(15,23,42,0.045)",
                              padding: "7px",
                            }}
                          >
                            <span style={{ minWidth: 0, color: colors.text, fontSize: "0.7rem", fontWeight: 820, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {document.title}
                            </span>
                            <span style={{ color: "#b45309", fontSize: "0.64rem", fontWeight: 900, whiteSpace: "nowrap" }}>
                              {document.candidate_count.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ marginTop: "8px", color: colors.textMuted, fontSize: "0.72rem", fontWeight: 730, lineHeight: 1.35 }}>
                        No over-cap prune candidates.
                      </div>
                    )}

                    <div style={{ marginTop: "8px", color: colors.textMuted, fontSize: "0.66rem", fontWeight: 760, lineHeight: 1.35 }}>
                      Type {retentionPrunePreview?.confirmation_token || "PRUNE_DOCUMENT_VERSION_SNAPSHOTS"} to confirm.
                    </div>
                    <div style={{ marginTop: "7px", display: "flex", gap: "7px", alignItems: "center" }}>
                      <input
                        value={retentionPruneConfirmation}
                        onChange={(event) => setRetentionPruneConfirmation(event.target.value)}
                        disabled={retentionPruneExecuting || retentionPruneLoading || !retentionPrunePreview || retentionPrunePreview.total_candidate_count === 0}
                        aria-label="Retention prune confirmation"
                        placeholder={retentionPrunePreview?.confirmation_token || "PRUNE_DOCUMENT_VERSION_SNAPSHOTS"}
                        style={{
                          minWidth: 0,
                          flex: 1,
                          height: "30px",
                          borderRadius: "6px",
                          border: `1px solid ${colors.border}`,
                          background: isDark ? "rgba(15,23,42,0.52)" : "rgba(255,255,255,0.82)",
                          color: colors.text,
                          padding: "0 8px",
                          fontSize: "0.7rem",
                          fontWeight: 760,
                          outline: "none",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void executeRetentionDashboardPrune()}
                        disabled={
                          retentionPruneExecuting ||
                          retentionPruneLoading ||
                          !retentionPrunePreview ||
                          retentionPrunePreview.total_candidate_count === 0 ||
                          !retentionPruneConfirmationMatches
                        }
                        aria-label="Prune retention snapshots"
                        title="Prune retention snapshots"
                        style={{
                          height: "30px",
                          borderRadius: "6px",
                          border: "1px solid rgba(220,38,38,0.32)",
                          background: isDark ? "rgba(220,38,38,0.14)" : "rgba(254,226,226,0.86)",
                          color: "#dc2626",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          padding: "0 9px",
                          fontSize: "0.68rem",
                          fontWeight: 850,
                          cursor: retentionPruneConfirmationMatches ? "pointer" : "not-allowed",
                          opacity: retentionPruneConfirmationMatches ? 1 : 0.55,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {retentionPruneExecuting
                          ? <Loader2 size={13} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                          : <Trash2 size={13} />}
                        Prune
                      </button>
                    </div>
                  </div>
                ) : null}

                <div
                  style={{
                    borderRadius: "8px",
                    border: `1px solid ${colors.border}`,
                    padding: "10px",
                    background: isDark ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.66)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "7px", color: colors.text, fontSize: "0.78rem", fontWeight: 850 }}>
                    <CalendarClock size={14} />
                    Export Schedule
                  </div>
                  <div style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px" }}>
                    {[
                      ["Cadence", retentionDashboard.export_schedule.cadence],
                      ["Format", retentionDashboard.export_schedule.content_free ? "Content-free JSON" : "JSON"],
                      [
                        "Next",
                        retentionDashboard.export_schedule.next_export_at
                          ? new Date(retentionDashboard.export_schedule.next_export_at).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "Pending",
                      ],
                      ["Window", `${retentionDashboard.export_schedule.retention_window_days}d`],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        style={{
                          borderRadius: "7px",
                          background: isDark ? "rgba(255,255,255,0.055)" : "rgba(15,23,42,0.045)",
                          padding: "7px",
                          minWidth: 0,
                        }}
                      >
                        <div style={{ color: colors.textMuted, fontSize: "0.6rem", fontWeight: 850, textTransform: "uppercase" }}>
                          {label}
                        </div>
                        <div style={{ marginTop: "3px", color: colors.text, fontSize: "0.72rem", fontWeight: 800, overflowWrap: "anywhere" }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    borderRadius: "8px",
                    border: `1px solid ${colors.border}`,
                    padding: "10px",
                    background: isDark ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.66)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", color: colors.text, fontSize: "0.78rem", fontWeight: 850 }}>
                      <RotateCcw size={14} />
                      Automation Plan
                    </div>
                    <span style={{ color: colors.textMuted, fontSize: "0.66rem", fontWeight: 850 }}>
                      {retentionDashboard.policy_automation.action_count.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "7px" }}>
                    {retentionDashboardTopPolicyActions.length > 0 ? retentionDashboardTopPolicyActions.map(action => (
                      <div
                        key={action.id}
                        style={{
                          borderRadius: "7px",
                          background: isDark ? "rgba(255,255,255,0.055)" : "rgba(15,23,42,0.045)",
                          padding: "8px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                          <span style={{ color: action.severity === "critical" ? "#dc2626" : "#b45309", fontSize: "0.64rem", fontWeight: 900, textTransform: "uppercase" }}>
                            {action.type.replace(/-/g, " ")}
                          </span>
                          <span style={{ color: colors.textMuted, fontSize: "0.62rem", fontWeight: 850 }}>
                            {action.count.toLocaleString()}
                          </span>
                        </div>
                        <div style={{ marginTop: "4px", color: colors.textMuted, fontSize: "0.71rem", fontWeight: 730, lineHeight: 1.3 }}>
                          {action.suggested_action}
                        </div>
                      </div>
                    )) : (
                      <div style={{ color: colors.textMuted, fontSize: "0.74rem", fontWeight: 700, lineHeight: 1.35 }}>
                        No policy automation actions queued.
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    borderRadius: "8px",
                    border: `1px solid ${colors.border}`,
                    padding: "10px",
                    background: isDark ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.66)",
                  }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", color: colors.text, fontSize: "0.78rem", fontWeight: 850 }}>
                      <Download size={14} />
                      Delivery Job
                    </div>
                    <div style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px" }}>
                      {[
                        ["Status", retentionDashboard.export_delivery.status],
                        ["Worker", retentionDashboard.export_delivery.background_worker],
                        ["Scheduler", retentionDashboard.export_worker.scheduler_status],
                        ["Health", retentionDashboard.export_worker.health],
                        ["Interval", retentionDashboard.export_worker.interval_label],
                        ["Due", retentionDashboard.export_worker.due_job_count.toLocaleString()],
                        ["Runs", retentionDashboard.export_worker.observability.run_count.toLocaleString()],
                        ["Duration", formatRetentionDashboardDuration(retentionDashboard.export_worker.observability.last_duration_ms)],
                        ["Attempts", retentionDashboard.export_delivery.attempt_count.toLocaleString()],
                        ["Failures", retentionDashboard.export_delivery.failure_count.toLocaleString()],
                        ["Backoff", formatRetentionDashboardBackoff(retentionDashboard.export_delivery.retry_backoff_seconds)],
                        [
                          "Retry",
                          retentionDashboard.export_delivery.next_retry_at
                            ? new Date(retentionDashboard.export_delivery.next_retry_at).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : "None",
                        ],
                        [
                          "Next run",
                          retentionDashboard.export_worker.next_run_at
                            ? new Date(retentionDashboard.export_worker.next_run_at).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : "Manual",
                        ],
                        ["Ledger", retentionDashboard.export_delivery.persisted ? "Persisted" : "Preview"],
                        ["Last", retentionDashboard.export_delivery.last_delivery_status || "None"],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          style={{
                          borderRadius: "7px",
                          background: isDark ? "rgba(255,255,255,0.055)" : "rgba(15,23,42,0.045)",
                          padding: "7px",
                          minWidth: 0,
                        }}
                      >
                        <div style={{ color: colors.textMuted, fontSize: "0.6rem", fontWeight: 850, textTransform: "uppercase" }}>
                          {label}
                        </div>
                          <div style={{ marginTop: "3px", color: colors.text, fontSize: "0.72rem", fontWeight: 800, overflowWrap: "anywhere" }}>
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: "8px", color: colors.textMuted, fontSize: "0.68rem", fontWeight: 760, lineHeight: 1.35 }}>
                      Reliability: {retentionDashboard.export_reliability.delivered_count.toLocaleString()} delivered /{" "}
                      {retentionDashboard.export_reliability.failed_count.toLocaleString()} failed /{" "}
                      {retentionDashboard.export_reliability.retry_ready_count.toLocaleString()} retry ready
                    </div>
                    <div style={{ marginTop: "4px", color: colors.textMuted, fontSize: "0.68rem", fontWeight: 760, lineHeight: 1.35 }}>
                      Worker scheduler: {retentionDashboard.export_worker.summary}
                    </div>
                    <div style={{ marginTop: "4px", color: colors.textMuted, fontSize: "0.68rem", fontWeight: 760, lineHeight: 1.35 }}>
                      Worker health: {retentionDashboard.export_worker.observability.summary}
                    </div>
                    <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ color: colors.textMuted, fontSize: "0.62rem", fontWeight: 850, textTransform: "uppercase" }}>
                        Delivery History
                      </div>
                    {retentionDashboardDeliveryHistory.map(job => (
                      <div
                        key={job.delivery_id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "8px",
                          borderRadius: "7px",
                          background: isDark ? "rgba(255,255,255,0.055)" : "rgba(15,23,42,0.045)",
                          padding: "7px",
                          minWidth: 0,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                            <div style={{ color: colors.text, fontSize: "0.7rem", fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {job.delivery_id}
                            </div>
                            <div style={{ marginTop: "2px", color: colors.textMuted, fontSize: "0.63rem", fontWeight: 730 }}>
                              {job.last_delivery_message
                                ? job.last_delivery_message
                                : job.last_failure_message
                                ? job.last_failure_message
                                : job.next_attempt_at
                                ? `Next ${new Date(job.next_attempt_at).toLocaleString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}`
                                : "No attempt scheduled"}
                            </div>
                            {job.next_retry_at ? (
                              <div style={{ marginTop: "2px", color: colors.textMuted, fontSize: "0.61rem", fontWeight: 760 }}>
                                Retry {new Date(job.next_retry_at).toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })} / Backoff {formatRetentionDashboardBackoff(job.retry_backoff_seconds)}
                              </div>
                            ) : null}
                            </div>
                        <span style={{ color: job.status === "failed" ? "#dc2626" : colors.textMuted, fontSize: "0.64rem", fontWeight: 850, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                          {job.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: "12px",
                  borderRadius: "8px",
                  border: `1px solid ${colors.border}`,
                  padding: "10px",
                  background: isDark ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.66)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "baseline" }}>
                  <div style={{ color: colors.text, fontSize: "0.78rem", fontWeight: 850 }}>
                    Capture trend
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: "0.68rem", fontWeight: 800 }}>
                    {retentionDashboard.buckets.reduce((total, bucket) => total + bucket.created_count, 0).toLocaleString()} captures
                  </div>
                </div>
                <div
                  style={{
                    marginTop: "9px",
                    height: "58px",
                    display: "grid",
                    gridTemplateColumns: `repeat(${retentionDashboardVisibleBuckets.length}, minmax(14px, 1fr))`,
                    gap: "6px",
                    alignItems: "end",
                  }}
                >
                  {retentionDashboardVisibleBuckets.map(bucket => {
                    const height = Math.max(
                      bucket.created_count > 0 ? 10 : 4,
                      Math.round((bucket.created_count / retentionDashboardMaxCreated) * 44)
                    );
                    const dateLabel = new Date(`${bucket.date}T00:00:00.000Z`).toLocaleDateString(undefined, {
                      month: "numeric",
                      day: "numeric",
                      timeZone: "UTC",
                    });

                    return (
                      <div
                        key={bucket.date}
                        title={`${bucket.date}: ${bucket.created_count} captures, ${bucket.cumulative_count} retained`}
                        style={{
                          minWidth: 0,
                          height: "58px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: "3px",
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            maxWidth: "28px",
                            height: `${height}px`,
                            borderRadius: "5px 5px 2px 2px",
                            background: bucket.created_count > 0
                              ? "linear-gradient(180deg, #0f766e, #2563eb)"
                              : isDark ? "rgba(255,255,255,0.13)" : "rgba(148,163,184,0.22)",
                            border: bucket.over_limit_count > 0
                              ? "1px solid rgba(220,38,38,0.42)"
                              : "1px solid rgba(20,184,166,0.18)",
                          }}
                        />
                        <div style={{ color: colors.textMuted, fontSize: "0.58rem", fontWeight: 750, lineHeight: 1, whiteSpace: "nowrap" }}>
                          {dateLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {retentionDashboard.document_summaries.slice(0, 8).map(summary => (
                  <div
                    key={summary.document_id}
                    style={{
                      borderRadius: "8px",
                      border: `1px solid ${colors.border}`,
                      padding: "10px",
                      background: isDark ? "rgba(255,255,255,0.035)" : "rgba(15,23,42,0.024)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: colors.text, fontSize: "0.82rem", fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {summary.title}
                        </div>
                        <div style={{ marginTop: "3px", color: colors.textMuted, fontSize: "0.68rem", fontWeight: 700 }}>
                          {summary.primary_origin ? documentVersionOriginLabel(summary.primary_origin) : "Mixed origin"}
                          {summary.latest_snapshot_at ? ` / ${timeAgo(summary.latest_snapshot_at)}` : ""}
                        </div>
                      </div>
                      <span
                        style={{
                          borderRadius: "999px",
                          border: `1px solid ${summary.risk_score > 0 ? "rgba(220,38,38,0.36)" : colors.border}`,
                          color: summary.risk_score > 0 ? "#dc2626" : colors.textMuted,
                          padding: "3px 7px",
                          fontSize: "0.66rem",
                          fontWeight: 850,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Risk {summary.risk_score.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {[
                        `Snapshots ${summary.snapshot_count}`,
                        `Protected ${summary.protected_count}`,
                        `Prunable ${summary.prunable_count}`,
                        `Over cap ${summary.over_limit_count}`,
                        `New ${summary.captured_in_window_count}`,
                      ].map(label => (
                        <span
                          key={label}
                          style={{
                            borderRadius: "999px",
                            background: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)",
                            color: colors.textMuted,
                            padding: "3px 7px",
                            fontSize: "0.64rem",
                            fontWeight: 800,
                          }}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  const versionHistoryPanel = historyDoc ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Version history for ${historyDoc.title}`}
      onClick={closeVersionHistory}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "rgba(0,0,0,0.46)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, calc(100vw - 28px))",
          maxHeight: "84vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: "10px",
          border: `1px solid ${colors.border}`,
          background: isDark ? "rgba(25,28,36,0.98)" : "rgba(255,255,255,0.98)",
          boxShadow: isDark ? "0 26px 70px rgba(0,0,0,0.55)" : "0 26px 70px rgba(15,23,42,0.22)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "14px 16px",
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isDark ? "rgba(59,130,246,0.16)" : "rgba(37,99,235,0.1)",
              color: "#2563eb",
              flexShrink: 0,
            }}
          >
            <History size={17} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ margin: 0, color: colors.text, fontSize: "0.98rem", fontWeight: 800 }}>
              Version History
            </h3>
            <div style={{ marginTop: "2px", color: colors.textMuted, fontSize: "0.76rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {historyDoc.title}
            </div>
          </div>
          {!historyLoading && historyVersions.length > 0 && (
            <span
              style={{
                padding: "4px 8px",
                borderRadius: "999px",
                border: `1px solid ${colors.border}`,
                color: colors.textMuted,
                fontSize: "0.72rem",
                fontWeight: 750,
                whiteSpace: "nowrap",
              }}
            >
              {historyVersions.length} {historyVersions.length === 1 ? "version" : "versions"}
            </span>
          )}
          <input
            ref={historyImportInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(event) => void importVersionHistoryBackup(event.currentTarget.files?.[0] || null)}
          />
          <button
            type="button"
            onClick={exportVersionHistoryBackup}
            disabled={historyLoading || historyLocalVersionCount === 0}
            aria-label="Export local history"
            title="Export local history"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "6px",
              border: `1px solid ${colors.border}`,
              background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.82)",
              color: colors.textMuted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: historyLoading || historyLocalVersionCount === 0 ? "not-allowed" : "pointer",
              opacity: historyLoading || historyLocalVersionCount === 0 ? 0.48 : 1,
            }}
          >
            <Download size={15} />
          </button>
          <button
            type="button"
            onClick={() => historyImportInputRef.current?.click()}
            disabled={historyLoading}
            aria-label="Import local history"
            title="Import local history"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "6px",
              border: `1px solid ${colors.border}`,
              background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.82)",
              color: colors.textMuted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: historyLoading ? "not-allowed" : "pointer",
              opacity: historyLoading ? 0.48 : 1,
            }}
          >
            <Upload size={15} />
          </button>
          <button
            type="button"
            onClick={closeVersionHistory}
            aria-label="Close version history"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "6px",
              border: "none",
              background: "transparent",
              color: colors.textMuted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {historyError && (
          <div
            role="alert"
            style={{
              margin: "12px 14px 0",
              padding: "9px 10px",
              borderRadius: "8px",
              border: "1px solid rgba(220,38,38,0.28)",
              background: isDark ? "rgba(220,38,38,0.12)" : "rgba(254,226,226,0.8)",
              color: "#dc2626",
              fontSize: "0.78rem",
              fontWeight: 650,
            }}
          >
            {historyError}
          </div>
        )}

        {historyNotice && (
          <div
            role="status"
            style={{
              margin: "12px 14px 0",
              padding: "9px 10px",
              borderRadius: "8px",
              border: "1px solid rgba(37,99,235,0.24)",
              background: isDark ? "rgba(37,99,235,0.14)" : "rgba(219,234,254,0.82)",
              color: isDark ? "#93c5fd" : "#1d4ed8",
              fontSize: "0.78rem",
              fontWeight: 650,
            }}
          >
            {historyNotice}
          </div>
        )}

        {!historyLoading && historyRetentionSummary.total_count > 0 && (
          <div
            data-testid="streetbot-document-version-retention-report"
            style={{
              margin: "12px 14px 0",
              padding: "10px",
              borderRadius: "8px",
              border: `1px solid ${colors.border}`,
              background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.025)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
              <div>
                <div style={{ color: colors.text, fontSize: "0.78rem", fontWeight: 850 }}>
                  Retention report
                </div>
                <div style={{ marginTop: "2px", color: colors.textMuted, fontSize: "0.7rem", lineHeight: 1.45 }}>
                  {historyRetentionSummary.expired_retain_until_count > 0
                    ? `${historyRetentionSummary.expired_retain_until_count} expired retain-until ${historyRetentionSummary.expired_retain_until_count === 1 ? "snapshot" : "snapshots"}`
                    : `Primary origin: ${retentionReportPrimaryOrigin(historyRetentionSummary)}`}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                {historyRetentionSummary.schema_version && (
                  <span
                    style={{
                      borderRadius: "999px",
                      border: `1px solid ${colors.border}`,
                      padding: "3px 7px",
                      color: colors.textMuted,
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                    }}
                  >
                    schema v{historyRetentionSummary.schema_version}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void exportDocumentRetentionReport()}
                  disabled={historyLoading || exportingRetentionReport || historyRetentionSummary.total_count === 0}
                  aria-label="Export retention report"
                  title="Export retention report"
                  data-testid="streetbot-document-version-retention-export"
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    border: `1px solid ${colors.border}`,
                    background: isDark ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.74)",
                    color: colors.textMuted,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: historyLoading || exportingRetentionReport || historyRetentionSummary.total_count === 0
                      ? "not-allowed"
                      : "pointer",
                    opacity: historyLoading || exportingRetentionReport || historyRetentionSummary.total_count === 0
                      ? 0.5
                      : 1,
                  }}
                >
                  {exportingRetentionReport
                    ? <Loader2 size={14} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                    : <Download size={14} />}
                </button>
              </div>
            </div>
            <div
              style={{
                marginTop: "9px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))",
                gap: "6px",
              }}
            >
              {historyRetentionMetricItems.map(item => (
                <div
                  key={item.label}
                  style={{
                    minHeight: "48px",
                    borderRadius: "7px",
                    border: `1px solid ${colors.border}`,
                    padding: "6px 7px",
                    background: isDark ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.68)",
                  }}
                >
                  <div style={{ color: colors.textMuted, fontSize: "0.66rem", fontWeight: 800, textTransform: "uppercase" }}>
                    {item.label}
                  </div>
                  <div style={{ marginTop: "4px", color: colors.text, fontSize: "0.88rem", fontWeight: 850 }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
            {historyRetentionTrendSummary.buckets.length > 0 && (
              <div
                data-testid="streetbot-document-version-retention-trend"
                style={{
                  marginTop: "9px",
                  borderRadius: "7px",
                  border: `1px solid ${colors.border}`,
                  padding: "8px",
                  background: isDark ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.62)",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" }}>
                  <div style={{ color: colors.text, fontSize: "0.72rem", fontWeight: 850 }}>
                    Retention trend
                  </div>
                  <div
                    style={{
                      color: colors.textMuted,
                      fontSize: "0.66rem",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {historyRetentionTrendSummary.report.window.days}d / {historyRetentionTrendSummary.capturedCount.toLocaleString()} captures
                  </div>
                </div>
                <div
                  style={{
                    marginTop: "8px",
                    height: "54px",
                    display: "grid",
                    gridTemplateColumns: `repeat(${historyRetentionTrendSummary.buckets.length}, minmax(12px, 1fr))`,
                    gap: "5px",
                    alignItems: "end",
                  }}
                >
                  {historyRetentionTrendSummary.buckets.map(bucket => {
                    const height = Math.max(
                      bucket.created_count > 0 ? 10 : 4,
                      Math.round((bucket.created_count / historyRetentionTrendSummary.maxCreatedCount) * 42)
                    );
                    const dateLabel = new Date(`${bucket.date}T00:00:00.000Z`).toLocaleDateString(undefined, {
                      month: "numeric",
                      day: "numeric",
                      timeZone: "UTC",
                    });

                    return (
                      <div
                        key={bucket.date}
                        title={`${bucket.date}: ${bucket.created_count} captures, ${bucket.cumulative_count} retained`}
                        aria-label={`${bucket.date} retention captures ${bucket.created_count}`}
                        style={{
                          minWidth: 0,
                          height: "54px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: "3px",
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            maxWidth: "24px",
                            height: `${height}px`,
                            borderRadius: "5px 5px 2px 2px",
                            background: bucket.created_count > 0
                              ? "linear-gradient(180deg, #2563eb, #14b8a6)"
                              : isDark ? "rgba(255,255,255,0.13)" : "rgba(148,163,184,0.22)",
                            border: bucket.over_limit_count > 0
                              ? "1px solid rgba(220,38,38,0.42)"
                              : "1px solid rgba(37,99,235,0.16)",
                          }}
                        />
                        <div
                          style={{
                            color: colors.textMuted,
                            fontSize: "0.58rem",
                            fontWeight: 750,
                            lineHeight: 1,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {dateLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {historyRetentionTrendSummary.latestBucket && (
                  <div
                    style={{
                      marginTop: "7px",
                      color: colors.textMuted,
                      fontSize: "0.66rem",
                      fontWeight: 750,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                    }}
                  >
                    <span>Retained {historyRetentionTrendSummary.latestBucket.cumulative_count.toLocaleString()}</span>
                    <span>Protected {historyRetentionTrendSummary.latestBucket.protected_count.toLocaleString()}</span>
                    <span>Prunable {historyRetentionTrendSummary.latestBucket.prunable_count.toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ padding: "12px", overflowY: "auto" }}>
          {historyLoading ? (
            <div
              style={{
                minHeight: "176px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "9px",
                color: colors.textMuted,
                fontSize: "0.84rem",
                fontWeight: 650,
              }}
            >
              <Loader2 size={16} className="spin" style={{ animation: "spin 1s linear infinite" }} />
              Loading versions
            </div>
          ) : historyVersions.length === 0 ? (
            <div
              style={{
                minHeight: "176px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "7px",
                textAlign: "center",
                color: colors.textMuted,
              }}
            >
              <History size={22} />
              <div style={{ color: colors.text, fontSize: "0.9rem", fontWeight: 750 }}>
                No saved versions yet
              </div>
              <div style={{ maxWidth: "320px", fontSize: "0.78rem", lineHeight: 1.5 }}>
                Server or imported snapshots will appear here.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {historyVersions.map(version => {
                const versionNote = version.change_note || version.change_type || "Saved version";
                const sourceLabel = documentVersionSourceLabel(version);
                const retentionLabel = documentVersionRetentionLabel(version);
                const retentionPolicy = documentVersionRetentionPolicyValue(version);
                const provenanceItems = documentVersionProvenanceItems(version);
                const isProvenanceExpanded = expandedHistoryVersionId === version.id;
                const isRestoring = restoringVersionId === version.id;
                const isUpdatingRetention = updatingRetentionVersionId === version.id;
                return (
                  <div
                    key={version.id}
                    data-testid="streetbot-document-version-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "46px minmax(0, 1fr) auto",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px",
                      borderRadius: "8px",
                      border: `1px solid ${colors.border}`,
                      background: isDark ? "rgba(255,255,255,0.035)" : "rgba(15,23,42,0.025)",
                    }}
                  >
                    <div
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: isDark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.06)",
                        color: colors.text,
                        fontSize: "0.74rem",
                        fontWeight: 850,
                      }}
                    >
                      v{version.version_number}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: colors.text, fontSize: "0.86rem", fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {version.title}
                      </div>
                      <div style={{ marginTop: "3px", color: colors.textMuted, fontSize: "0.74rem", lineHeight: 1.45 }}>
                        {versionNote} / {timeAgo(version.created_at)}
                        {typeof version.word_count === "number" ? ` / ${version.word_count.toLocaleString()} words` : ""}
                        {sourceLabel ? ` / ${sourceLabel}` : ""}
                        {retentionLabel ? ` / ${retentionLabel}` : ""}
                      </div>
                      {provenanceItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedHistoryVersionId(isProvenanceExpanded ? null : version.id)}
                          aria-expanded={isProvenanceExpanded}
                          aria-label={`${isProvenanceExpanded ? "Hide" : "Show"} provenance for version ${version.version_number}`}
                          data-testid="streetbot-document-version-provenance-toggle"
                          title={isProvenanceExpanded ? "Hide provenance" : "Show provenance"}
                          style={{
                            marginTop: "6px",
                            minHeight: "26px",
                            width: "fit-content",
                            maxWidth: "100%",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            border: "none",
                            background: "transparent",
                            color: colors.textMuted,
                            cursor: "pointer",
                            padding: 0,
                            fontSize: "0.72rem",
                            fontWeight: 750,
                          }}
                        >
                          {isProvenanceExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <span>Details</span>
                        </button>
                      )}
                      {version.source === "durable" && (
                        <div
                          style={{
                            marginTop: "6px",
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <label
                            htmlFor={`document-version-retention-${version.id}`}
                            style={{
                              color: colors.textMuted,
                              fontSize: "0.68rem",
                              fontWeight: 800,
                              textTransform: "uppercase",
                            }}
                          >
                            Retention
                          </label>
                          <select
                            id={`document-version-retention-${version.id}`}
                            value={retentionPolicy}
                            disabled={isUpdatingRetention}
                            aria-label={`Retention policy for version ${version.version_number}`}
                            data-testid="streetbot-document-version-retention-select"
                            onChange={(event) => {
                              const nextPolicy = event.currentTarget.value as DocumentVersionRetentionPolicy;
                              void updateDocumentVersionRetention(
                                version,
                                nextPolicy,
                                nextPolicy === "retain-until"
                                  ? version.retained_until || defaultDocumentVersionRetainedUntil()
                                  : null
                              );
                            }}
                            style={{
                              height: "28px",
                              minWidth: "118px",
                              borderRadius: "6px",
                              border: `1px solid ${colors.border}`,
                              background: isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
                              color: colors.text,
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              cursor: isUpdatingRetention ? "wait" : "pointer",
                            }}
                          >
                            <option value="keep-latest">Keep latest</option>
                            <option value="keep-forever">Keep forever</option>
                            <option value="retain-until">Retain until</option>
                          </select>
                          {retentionPolicy === "retain-until" && (
                            <input
                              type="date"
                              value={documentVersionRetainedUntilDateValue(version)}
                              disabled={isUpdatingRetention}
                              aria-label={`Retain version ${version.version_number} until`}
                              data-testid="streetbot-document-version-retained-until-input"
                              onChange={(event) => {
                                const retainedUntil = retainedUntilDateInputToIso(event.currentTarget.value);
                                if (retainedUntil) {
                                  void updateDocumentVersionRetention(version, "retain-until", retainedUntil);
                                }
                              }}
                              style={{
                                height: "28px",
                                borderRadius: "6px",
                                border: `1px solid ${colors.border}`,
                                background: isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
                                color: colors.text,
                                fontSize: "0.72rem",
                                fontWeight: 700,
                              }}
                            />
                          )}
                          {isUpdatingRetention && (
                            <Loader2 size={13} className="spin" style={{ animation: "spin 1s linear infinite", color: colors.textMuted }} />
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void restoreDocumentVersion(version)}
                      disabled={restoringVersionId !== null}
                      aria-label={`Restore version ${version.version_number}`}
                      style={{
                        minWidth: "88px",
                        height: "32px",
                        borderRadius: "7px",
                        border: `1px solid ${colors.border}`,
                        background: isRestoring ? `${colors.accent}33` : isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
                        color: isRestoring ? colors.accent : colors.text,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        cursor: restoringVersionId ? "default" : "pointer",
                        opacity: restoringVersionId && !isRestoring ? 0.52 : 1,
                        fontSize: "0.76rem",
                        fontWeight: 750,
                      }}
                    >
                      {isRestoring ? (
                        <Loader2 size={13} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                      ) : (
                        <RotateCcw size={13} />
                      )}
                      Restore
                    </button>
                    {isProvenanceExpanded && provenanceItems.length > 0 && (
                      <div
                        data-testid="streetbot-document-version-provenance"
                        style={{
                          gridColumn: "2 / -1",
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))",
                          gap: "8px",
                          paddingTop: "2px",
                        }}
                      >
                        {provenanceItems.map(item => (
                          <div key={item.label} style={{ minWidth: 0 }}>
                            <div
                              style={{
                                color: colors.textMuted,
                                fontSize: "0.66rem",
                                fontWeight: 800,
                                textTransform: "uppercase",
                              }}
                            >
                              {item.label}
                            </div>
                            <div
                              style={{
                                marginTop: "2px",
                                color: colors.text,
                                fontSize: "0.73rem",
                                fontWeight: 650,
                                overflowWrap: "anywhere",
                              }}
                            >
                              {item.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  // ── Styles ──

  const sidebarStyle: React.CSSProperties = {
    width: `${documentsSidebarWidth}px`,
    minWidth: `${documentsSidebarWidth}px`,
    height: "100%",
    borderRight: `1px solid ${colors.border}`,
    background: isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.5)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  const sidebarBtnStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: documentsSidebarCollapsed ? "center" : "flex-start",
    gap: documentsSidebarCollapsed ? "0" : "10px",
    width: "100%",
    padding: documentsSidebarCollapsed ? "10px 0" : "9px 14px",
    borderRadius: "8px",
    background: active ? (isDark ? "rgba(255,214,0,0.12)" : "rgba(59,130,246,0.1)") : "transparent",
    border: "none",
    cursor: "pointer",
    color: active ? colors.accent : colors.textSecondary,
    fontSize: "0.85rem",
    fontWeight: active ? 600 : 400,
    textAlign: "left" as const,
    transition: "background 0.15s",
  });

  // ── Render: Editor View ──

  if (editingDoc) {
    return (
      <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", background: colors.background }}>
        {/* Editor top bar */}
        <div
          style={{
            position: "relative",
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "8px 16px",
            borderBottom: `1px solid ${colors.border}`,
            background: isDark ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.7)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            minHeight: "48px",
          }}
        >
          <button
            onClick={closeEditor}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
              border: `1px solid ${colors.border}`,
              cursor: "pointer",
              color: colors.text,
              fontSize: "0.85rem",
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div style={{ width: "1px", height: "24px", background: colors.border }} />

          {/* Doc icon + title */}
          {(() => {
            const Icon = getDocIcon(editingDoc.document_type);
            const iconColor = getDocColor(editingDoc.document_type);
            return (
              <>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    background: `${iconColor}20`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={16} color={iconColor} />
                </div>
                <span style={{ fontSize: "0.9rem", fontWeight: 600, color: colors.text, flex: 1 }}>
                  {editingDoc.title}
                </span>
              </>
            );
          })()}

          {/* Status badge */}
          {(() => {
            const badge = STATUS_BADGES[editingDoc.status] || STATUS_BADGES.draft;
            return (
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: "12px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  background: `${badge.color}20`,
                  color: badge.color,
                  border: `1px solid ${badge.color}40`,
                }}
              >
                {badge.label}
              </span>
            );
          })()}

          {editingDoc.document_type === "document" && (
            <span
              title={collaborationLockBadgeLabel}
              aria-label={collaborationLockBadgeLabel}
              style={{
                minHeight: "26px",
                padding: "0 9px",
                borderRadius: "8px",
                border: `1px solid ${
                  collaborationLockStatus === "owned"
                    ? "rgba(34,197,94,0.38)"
                    : collaborationLockStatus === "blocked"
                      ? "rgba(245,158,11,0.5)"
                      : collaborationLockStatus === "unavailable"
                        ? "rgba(37,99,235,0.35)"
                      : colors.border
                }`,
                background: collaborationLockStatus === "owned"
                  ? isDark ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.1)"
                  : collaborationLockStatus === "blocked"
                    ? isDark ? "rgba(245,158,11,0.13)" : "rgba(245,158,11,0.1)"
                    : collaborationLockStatus === "unavailable"
                      ? isDark ? "rgba(37,99,235,0.13)" : "rgba(37,99,235,0.08)"
                    : isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)",
                color: collaborationLockStatus === "owned"
                  ? "#16a34a"
                  : collaborationLockStatus === "blocked"
                    ? "#b45309"
                    : collaborationLockStatus === "unavailable"
                      ? "#2563eb"
                      : colors.textMuted,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.74rem",
                fontWeight: 800,
                whiteSpace: "nowrap",
              }}
            >
              {collaborationLockStatus === "acquiring"
                ? <Loader2 size={13} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                : <Lock size={13} />}
              {collaborationLockStatus === "owned"
                ? "Editing"
                : collaborationLockStatus === "blocked"
                  ? "Locked"
                  : collaborationLockStatus === "unavailable"
                    ? "Solo"
                    : "Checking"}
            </span>
          )}

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {[
              { icon: Share2, label: "Share", action: () => {} },
              { icon: History, label: "History", action: () => void openVersionHistory(editingDoc) },
            ].map(({ icon: BtnIcon, label, action }) => (
              <button
                key={label}
                onClick={action}
                title={label}
                aria-label={label}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: colors.textMuted,
                  transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
                  e.currentTarget.style.color = colors.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = colors.textMuted;
                }}
              >
                <BtnIcon size={16} />
              </button>
            ))}

            <div style={{ position: "relative" }}>
              <button
                onClick={() => {
                  setExportMenuOpen(open => !open);
                  setExportError(null);
                }}
                title="Export"
                aria-label="Export"
                disabled={exportingFormat !== null}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  background: exportMenuOpen ? (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)") : "transparent",
                  border: "none",
                  cursor: exportingFormat ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: exportMenuOpen ? colors.text : colors.textMuted,
                  opacity: exportingFormat ? 0.7 : 1,
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {exportingFormat ? <Loader2 size={16} className="spin" style={{ animation: "spin 1s linear infinite" }} /> : <Download size={16} />}
              </button>

              {exportMenuOpen && (
                <div
                  role="menu"
                  aria-label="Export formats"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "38px",
                    width: "172px",
                    padding: "6px",
                    borderRadius: "8px",
                    border: `1px solid ${colors.border}`,
                    background: isDark ? "#171a21" : "#ffffff",
                    boxShadow: isDark ? "0 16px 42px rgba(0,0,0,0.42)" : "0 16px 42px rgba(15,23,42,0.14)",
                    zIndex: 200,
                  }}
                >
                  {DOCUMENT_EXPORT_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitem"
                      disabled={exportingFormat !== null}
                      onClick={() => void exportEditingDocument(option.value)}
                      style={{
                        width: "100%",
                        height: "32px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        border: "none",
                        borderRadius: "6px",
                        background: "transparent",
                        color: colors.text,
                        cursor: exportingFormat ? "default" : "pointer",
                        fontSize: "0.8rem",
                        fontWeight: 650,
                        padding: "0 9px",
                      }}
                    >
                      <span>{option.label}</span>
                      <span style={{ color: colors.textMuted, fontSize: "0.72rem", fontWeight: 700 }}>
                        {option.extension}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={openOfficeFallback}
              title="Open office fallback"
              aria-label="Open office fallback"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "6px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: colors.textMuted,
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
                e.currentTarget.style.color = colors.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = colors.textMuted;
              }}
            >
              <ExternalLink size={16} />
            </button>
          </div>
          {exportError && (
            <span style={{ color: "#dc2626", fontSize: "0.75rem", fontWeight: 650 }}>
              {exportError}
            </span>
          )}
          {collaborationTicketError && (
            <span style={{ color: "#dc2626", fontSize: "0.75rem", fontWeight: 650 }}>
              {collaborationTicketError}
            </span>
          )}
          {collaborationLockError && collaborationLockStatus !== "blocked" && collaborationLockStatus !== "unavailable" && (
            <span style={{ color: "#dc2626", fontSize: "0.75rem", fontWeight: 650 }}>
              {collaborationLockError}
            </span>
          )}
          {collaborationLockStatus === "unavailable" && collaborationLockError && (
            <span style={{ color: "#2563eb", fontSize: "0.75rem", fontWeight: 650 }}>
              {collaborationLockError}
            </span>
          )}
          {collaborationLockStatus === "blocked" && editorReadOnlyReason && (
            <span style={{ color: "#b45309", fontSize: "0.75rem", fontWeight: 650 }}>
              {editorReadOnlyReason}
            </span>
          )}
        </div>

        <TiptapDocumentEditor
          key={`${editingDoc.id}:${editorCollaboration?.enabled ? "live" : "solo"}`}
          document={editingDoc}
          userId={userId}
          userName={editorUserName}
          colors={colors}
          isDark={isDark}
          loading={editorLoading}
          error={editorError}
          onSave={saveEditingDocument}
          suggestions={suggestions}
          suggestionsLoading={suggestionsLoading}
          suggestionsError={suggestionsError}
          onSuggestionCreate={createReviewSuggestion}
          onSuggestionResolve={resolveReviewSuggestion}
          comments={comments}
          commentsLoading={commentsLoading}
          commentsError={commentsError}
          onCommentCreate={createReviewComment}
          onCommentResolve={resolveReviewComment}
          mentionOptions={editorMentionOptions}
          mentionOptionsLoading={mentionOptionsLoading}
          mentionOptionsError={mentionOptionsError}
          onMediaUpload={uploadEditorMedia}
          collaboration={editorCollaboration}
          readOnly={editorReadOnly}
          readOnlyReason={editorReadOnlyReason}
        />
        {versionHistoryPanel}
        {retentionDashboardPanel}
      </div>
    );
  }

  // ── Render: Document Browser ──

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        background: colors.background,
        fontFamily: "'Rubik', sans-serif",
        overflow: "hidden",
      }}
      onClick={() => setContextMenu(null)}
    >
      {/* Sidebar */}
      <aside style={sidebarStyle}>
        {/* Sidebar header */}
        <div style={{ padding: documentsSidebarCollapsed ? "12px 8px 8px" : "16px 14px 8px", borderBottom: `1px solid ${colors.border}` }}>
          {!documentsSidebarCollapsed && (
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: colors.text, margin: 0, marginBottom: "12px" }}>
              Documents
            </h2>
          )}

          {/* Quick actions */}
          <div style={{ display: "flex", flexDirection: documentsSidebarCollapsed ? "column" : "row", gap: "6px", marginBottom: "8px" }}>
            <button
              onClick={() => setShowCreateDoc(true)}
              title="New document"
              style={{
                flex: documentsSidebarCollapsed ? "unset" : 1,
                width: documentsSidebarCollapsed ? "100%" : undefined,
                height: documentsSidebarCollapsed ? "36px" : undefined,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: documentsSidebarCollapsed ? "0" : "6px",
                padding: "8px",
                borderRadius: "8px",
                background: colors.accent,
                border: "none",
                cursor: "pointer",
                color: "#000",
                fontSize: "0.8rem",
                fontWeight: 600,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            >
              <Plus size={14} />
              {!documentsSidebarCollapsed && "New"}
            </button>
            <button
              onClick={() => setShowCreateFolder(true)}
              style={{
                width: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "8px",
                background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                border: `1px solid ${colors.border}`,
                cursor: "pointer",
                color: colors.textMuted,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}
              title="New folder"
            >
              <FolderPlus size={14} />
            </button>
          </div>
        </div>

        {/* Navigation sections */}
        <div style={{ padding: "8px 6px", flex: 1, overflowY: "auto" }}>
          {[
            { id: "all" as const, icon: FileText, label: "All Documents" },
            { id: "recent" as const, icon: Clock, label: "Recent" },
            { id: "favorites" as const, icon: Star, label: "Favorites" },
            { id: "shared" as const, icon: Users, label: "Shared with Me" },
            { id: "trash" as const, icon: Trash2, label: "Trash" },
          ].map(({ id, icon: NavIcon, label }) => (
            <button
              key={id}
              title={label}
              onClick={() => {
                setActiveSection(id);
                setSelectedFolderId(null);
              }}
              style={sidebarBtnStyle(activeSection === id && !selectedFolderId)}
              onMouseEnter={(e) => {
                if (activeSection !== id || selectedFolderId) {
                  e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeSection !== id || selectedFolderId) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <NavIcon size={16} />
              {!documentsSidebarCollapsed && label}
            </button>
          ))}

          {/* Folders */}
          {folders.length > 0 && (
            <div style={{ marginTop: "16px" }}>
              {!documentsSidebarCollapsed && (
                <div
                  style={{
                    padding: "4px 14px",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: colors.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Folders
                </div>
              )}
              {folders.map(folder => {
                const isActive = selectedFolderId === folder.id;
                return (
                  <button
                    key={folder.id}
                    title={folder.name}
                    onClick={() => {
                      setSelectedFolderId(isActive ? null : folder.id);
                      setActiveSection("all");
                    }}
                    style={sidebarBtnStyle(isActive)}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {isActive ? <FolderOpen size={16} /> : <Folder size={16} />}
                    {!documentsSidebarCollapsed && (
                      <>
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {folder.name}
                        </span>
                        <span style={{ fontSize: "0.7rem", color: colors.textMuted }}>{folder.document_count}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </aside>

      {/* Main content area */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: documentsCompact ? "wrap" : "nowrap",
            gap: documentsCompact ? "8px" : "12px",
            padding: documentsVeryCompact ? "8px" : "10px 16px",
            borderBottom: `1px solid ${colors.border}`,
            background: isDark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.6)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {/* Search */}
          <div
            style={{
              flex: 1,
              flexBasis: documentsCompact ? "180px" : undefined,
              minWidth: documentsVeryCompact ? "100%" : "160px",
              maxWidth: documentsCompact ? "none" : "400px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "7px 12px",
              borderRadius: "8px",
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              border: `1px solid ${colors.border}`,
            }}
          >
            <Search size={15} color={colors.textMuted} />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                border: "none",
                background: "none",
                outline: "none",
                color: colors.text,
                fontSize: "0.85rem",
                fontFamily: "'Rubik', sans-serif",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: colors.textMuted, display: "flex", padding: 0 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            style={{
              padding: "7px 10px",
              flex: documentsVeryCompact ? "1 1 150px" : undefined,
              minWidth: documentsVeryCompact ? "0" : undefined,
              borderRadius: "8px",
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              border: `1px solid ${colors.border}`,
              color: colors.text,
              fontSize: "0.82rem",
              fontFamily: "'Rubik', sans-serif",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="updated">Last Modified</option>
            <option value="title">Title</option>
            <option value="created">Date Created</option>
          </select>

          {/* View toggle */}
          <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: `1px solid ${colors.border}` }}>
            {[
              { mode: "grid" as const, icon: Grid3X3 },
              { mode: "list" as const, icon: List },
            ].map(({ mode, icon: ViewIcon }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  width: "34px",
                  height: "34px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: viewMode === mode
                    ? (isDark ? "rgba(255,214,0,0.15)" : "rgba(59,130,246,0.12)")
                    : "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: viewMode === mode ? colors.accent : colors.textMuted,
                  transition: "background 0.15s",
                }}
              >
                <ViewIcon size={16} />
              </button>
            ))}
          </div>

          <input
            ref={importInputRef}
            type="file"
            accept={DOCUMENT_IMPORT_ACCEPT}
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
            }}
          />

          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            style={{
              width: "34px",
              height: "34px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "8px",
              background: "transparent",
              border: `1px solid ${colors.border}`,
              cursor: importing ? "default" : "pointer",
              color: colors.textMuted,
              opacity: importing ? 0.72 : 1,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!importing) e.currentTarget.style.color = colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = colors.textMuted;
            }}
            title="Import"
            aria-label="Import"
          >
            {importing ? <Loader2 size={15} className="spin" style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={15} />}
          </button>

          <button
            onClick={() => {
              setOrganizerOpen(open => !open);
              setOrganizerScanStatus(null);
              setOrganizerMoveStatus(null);
            }}
            disabled={organizerLoading || organizerScanning || organizerMovePlanLoading || organizerMoveExporting || organizerMoveApplying}
            data-testid="streetbot-documents-organizer-open"
            style={{
              width: "34px",
              height: "34px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "8px",
              background: organizerOpen
                ? (isDark ? "rgba(255,214,0,0.14)" : "rgba(59,130,246,0.12)")
                : "transparent",
              border: `1px solid ${organizerOpen ? colors.accent : colors.border}`,
              cursor: organizerLoading || organizerScanning || organizerMovePlanLoading || organizerMoveExporting || organizerMoveApplying ? "not-allowed" : "pointer",
              color: organizerOpen ? colors.accent : colors.textMuted,
              opacity: organizerLoading || organizerScanning || organizerMovePlanLoading || organizerMoveExporting || organizerMoveApplying ? 0.62 : 1,
              transition: "color 0.15s, border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!organizerLoading && !organizerScanning && !organizerMovePlanLoading && !organizerMoveExporting && !organizerMoveApplying) e.currentTarget.style.color = colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = organizerOpen ? colors.accent : colors.textMuted;
            }}
            title="Local organizer"
            aria-label="Local organizer"
          >
            {organizerLoading || organizerScanning || organizerMovePlanLoading || organizerMoveExporting || organizerMoveApplying
              ? <Loader2 size={15} className="spin" style={{ animation: "spin 1s linear infinite" }} />
              : <FolderOpen size={15} />}
          </button>

          {/* Refresh */}
          <button
            onClick={loadDocuments}
            style={{
              width: "34px",
              height: "34px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "8px",
              background: "transparent",
              border: `1px solid ${colors.border}`,
              cursor: "pointer",
              color: colors.textMuted,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = colors.text}
            onMouseLeave={(e) => e.currentTarget.style.color = colors.textMuted}
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>

          <button
            onClick={() => void openRetentionDashboard()}
            disabled={retentionDashboardLoading}
            data-testid="streetbot-documents-retention-dashboard-open"
            style={{
              width: "34px",
              height: "34px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "8px",
              background: "transparent",
              border: `1px solid ${colors.border}`,
              cursor: retentionDashboardLoading ? "not-allowed" : "pointer",
              color: colors.textMuted,
              opacity: retentionDashboardLoading ? 0.6 : 1,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!retentionDashboardLoading) e.currentTarget.style.color = colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = colors.textMuted;
            }}
            title="Retention dashboard"
            aria-label="Retention dashboard"
          >
            {retentionDashboardLoading
              ? <Loader2 size={15} className="spin" style={{ animation: "spin 1s linear infinite" }} />
              : <BarChart3 size={15} />}
          </button>

          {importError && (
            <span style={{ color: "#dc2626", fontSize: "0.75rem", fontWeight: 650 }}>
              {importError}
            </span>
          )}
        </header>

        {organizerOpen && (
          <section
            data-testid="streetbot-documents-organizer-panel"
            style={{
              borderBottom: `1px solid ${colors.border}`,
              background: isDark ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.78)",
              padding: documentsVeryCompact ? "10px" : "14px 16px",
              maxHeight: documentsCompact ? "calc(100vh - 104px)" : "min(64vh, 640px)",
              overflowY: "auto",
              overflowX: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: documentsCompact
                  ? "minmax(0, 1fr)"
                  : "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
                gap: documentsVeryCompact ? "10px" : "14px",
                alignItems: "start",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "0.95rem", color: colors.text }}>Local Organizer</h3>
                    <div style={{ marginTop: "4px", fontSize: "0.76rem", color: colors.textMuted }}>
                      {organizerSummary?.latest_scan_at
                        ? `Last scan ${timeAgo(organizerSummary.latest_scan_at)}`
                        : "Not scanned yet"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void runOrganizerScan()}
                    disabled={organizerScanning}
                    data-testid="streetbot-documents-organizer-scan"
                    style={{
                      height: "32px",
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      padding: "0 12px",
                      borderRadius: "8px",
                      border: `1px solid ${colors.border}`,
                      background: organizerScanning ? "transparent" : colors.accent,
                      color: organizerScanning ? colors.textMuted : "#000",
                      cursor: organizerScanning ? "not-allowed" : "pointer",
                      fontSize: "0.78rem",
                      fontWeight: 750,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {organizerScanning ? <Loader2 size={14} className="spin" style={{ animation: "spin 1s linear infinite" }} /> : <FolderPlus size={14} />}
                    Scan folders
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(86px, 1fr))", gap: "8px" }}>
                  {[
                    ["Files", organizerSummary?.scanned_file_count.toLocaleString() || "0"],
                    ["Folders", organizerSummary?.folder_count.toLocaleString() || "0"],
                    ["Size", formatBytes(organizerSummary?.total_size_bytes || 0)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        minHeight: "58px",
                        borderRadius: "8px",
                        border: `1px solid ${colors.border}`,
                        padding: "8px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                      }}
                    >
                      <span style={{ fontSize: "0.68rem", color: colors.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0 }}>
                        {label}
                      </span>
                      <span style={{ marginTop: "4px", fontSize: "0.95rem", fontWeight: 750, color: colors.text }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "0.72rem", color: colors.textMuted }}>
                  <span>MongoDB index</span>
                  <span>Content indexed: {organizerSummary?.content_indexed ? "yes" : "no"}</span>
                  <span>File moves: {organizerSummary?.physical_moves_performed ? "yes" : "no"}</span>
                </div>

	                {(organizerError || organizerScanStatus || organizerMoveStatus || organizerImportStatus) && (
	                  <div
                    style={{
                      borderRadius: "8px",
                      border: `1px solid ${organizerError ? "#dc262650" : "#22c55e50"}`,
                      color: organizerError ? "#dc2626" : "#16a34a",
                      padding: "8px 10px",
                      fontSize: "0.78rem",
                      fontWeight: 650,
                    }}
                  >
                    {organizerError || organizerScanStatus || organizerMoveStatus || organizerImportStatus}
	                  </div>
	                )}

	                <div
	                  data-testid="streetbot-documents-organizer-collections"
	                  style={{
	                    borderRadius: "8px",
	                    border: `1px solid ${colors.border}`,
	                    padding: "10px",
	                    display: "flex",
	                    flexDirection: "column",
	                    gap: "8px",
	                  }}
	                >
	                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
	                    <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
	                      <FolderOpen size={14} style={{ color: colors.textMuted, flexShrink: 0 }} />
	                      <div style={{ minWidth: 0 }}>
	                        <div style={{ fontSize: "0.78rem", color: colors.text, fontWeight: 800 }}>
	                          Collections
	                        </div>
	                        <div style={{ marginTop: "3px", fontSize: "0.68rem", color: colors.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
	                          MongoDB type and location groups
	                        </div>
	                      </div>
	                    </div>
	                    <button
	                      type="button"
	                      onClick={() => void loadOrganizerCollections()}
	                      disabled={organizerCollectionsLoading}
	                      data-testid="streetbot-documents-organizer-collections-refresh"
	                      aria-label="Refresh organizer collections"
	                      style={{
	                        width: "28px",
	                        height: "28px",
	                        borderRadius: "8px",
	                        border: `1px solid ${colors.border}`,
	                        background: "transparent",
	                        color: colors.textMuted,
	                        display: "inline-flex",
	                        alignItems: "center",
	                        justifyContent: "center",
	                        cursor: organizerCollectionsLoading ? "not-allowed" : "pointer",
	                      }}
	                    >
	                      {organizerCollectionsLoading
	                        ? <Loader2 size={13} className="spin" style={{ animation: "spin 1s linear infinite" }} />
	                        : <RefreshCw size={13} />}
	                    </button>
	                  </div>
	                  {organizerCollectionsError && (
	                    <div style={{ color: "#dc2626", fontSize: "0.72rem", fontWeight: 700 }}>
	                      {organizerCollectionsError}
	                    </div>
	                  )}
	                  <div style={{ display: "grid", gridTemplateColumns: documentsVeryCompact ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: "8px" }}>
	                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
	                      <div style={{ fontSize: "0.66rem", color: colors.textMuted, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>
	                        By type
	                      </div>
	                      {organizerCollections?.document_types.slice(0, 4).map(folder => {
	                        const isSelected = !organizerSelectedSourceRoot && organizerSelectedFolderKey === folder.folder_key;
	                        const stagingCollectionId = `type:${folder.folder_key}`;
	                        const isStagingCollection = organizerStagingCollectionId === stagingCollectionId;
	                        const collectionStageDisabled = organizerImportBusy ||
	                          organizerFilesLoading ||
	                          Boolean(organizerStagingViewId) ||
	                          Boolean(organizerStagingRecommendationId) ||
	                          Boolean(organizerStagingCollectionId) ||
	                          folder.count === 0;
	                        return (
	                          <div
	                            key={folder.folder_key}
	                            style={{
	                              minHeight: "32px",
	                              display: "grid",
	                              gridTemplateColumns: "minmax(0, 1fr) auto",
	                              gap: "7px",
	                              alignItems: "center",
	                              borderRadius: "8px",
	                              border: `1px solid ${isSelected ? colors.accent : colors.border}`,
	                              background: isSelected
	                                ? (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.035)")
	                                : "transparent",
	                              padding: "5px 6px",
	                            }}
	                          >
	                            <button
	                              type="button"
	                              onClick={() => applyOrganizerTypeCollection(folder)}
	                              disabled={
	                                organizerFilesLoading ||
	                                organizerImportBusy ||
	                                Boolean(organizerStagingViewId) ||
	                                Boolean(organizerStagingRecommendationId) ||
	                                Boolean(organizerStagingCollectionId)
	                              }
	                              data-testid={`streetbot-documents-organizer-collection-type-${folder.folder_key}`}
	                              style={{
	                                minWidth: 0,
	                                display: "grid",
	                                gridTemplateColumns: "minmax(0, 1fr) auto",
	                                alignItems: "center",
	                                gap: "7px",
	                                border: "none",
	                                background: "transparent",
	                                color: colors.text,
	                                padding: "1px 2px",
	                                textAlign: "left",
	                                cursor: organizerFilesLoading || organizerImportBusy || organizerStagingViewId || organizerStagingRecommendationId || organizerStagingCollectionId ? "not-allowed" : "pointer",
	                                opacity: (organizerStagingCollectionId && !isStagingCollection) || organizerStagingViewId || organizerStagingRecommendationId ? 0.52 : 1,
	                              }}
	                            >
	                              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.72rem", fontWeight: 750 }}>
	                                {folder.folder_name}
	                              </span>
	                              <span style={{ color: colors.textMuted, fontSize: "0.68rem", fontWeight: 800 }}>
	                                {folder.count.toLocaleString()}
	                              </span>
	                            </button>
	                            <button
	                              type="button"
	                              onClick={() => void stageOrganizerCollectionFiles({
	                                id: stagingCollectionId,
	                                name: folder.folder_name,
	                                folderKey: folder.folder_key,
	                              })}
	                              disabled={collectionStageDisabled}
	                              data-testid={`streetbot-documents-organizer-stage-collection-type-${folder.folder_key}`}
	                              title={`Stage ${folder.folder_name} collection`}
	                              aria-label={`Stage ${folder.folder_name} collection`}
	                              style={{
	                                width: "24px",
	                                height: "24px",
	                                borderRadius: "8px",
	                                border: `1px solid ${colors.border}`,
	                                background: isStagingCollection
	                                  ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)")
	                                  : "transparent",
	                                color: isStagingCollection ? colors.accent : colors.textMuted,
	                                display: "inline-flex",
	                                alignItems: "center",
	                                justifyContent: "center",
	                                cursor: collectionStageDisabled ? "not-allowed" : "pointer",
	                                opacity: (organizerStagingCollectionId && !isStagingCollection) || folder.count === 0 ? 0.45 : 1,
	                              }}
	                            >
	                              {isStagingCollection
	                                ? <Loader2 size={12} className="spin" style={{ animation: "spin 1s linear infinite" }} />
	                                : <List size={12} />}
	                            </button>
	                          </div>
	                        );
	                      })}
	                    </div>
	                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
	                      <div style={{ fontSize: "0.66rem", color: colors.textMuted, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>
	                        By location
	                      </div>
	                      {organizerCollections?.source_roots.slice(0, 4).map((collection, index) => {
	                        const isSelected = organizerSelectedSourceRoot === collection.source_root;
	                        const folderPreview = collection.folders.slice(0, 2).map(folder => folder.folder_name).join(", ");
	                        const stagingCollectionId = `source:${collection.source_root}`;
	                        const isStagingCollection = organizerStagingCollectionId === stagingCollectionId;
	                        const collectionStageDisabled = organizerImportBusy ||
	                          organizerFilesLoading ||
	                          Boolean(organizerStagingViewId) ||
	                          Boolean(organizerStagingRecommendationId) ||
	                          Boolean(organizerStagingCollectionId) ||
	                          collection.count === 0;
	                        return (
	                          <div
	                            key={collection.source_root}
	                            title={folderPreview || collection.source_display_root}
	                            style={{
	                              minHeight: "32px",
	                              display: "grid",
	                              gridTemplateColumns: "minmax(0, 1fr) auto",
	                              gap: "7px",
	                              alignItems: "center",
	                              borderRadius: "8px",
	                              border: `1px solid ${isSelected ? colors.accent : colors.border}`,
	                              background: isSelected
	                                ? (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.035)")
	                                : "transparent",
	                              padding: "5px 6px",
	                            }}
	                          >
	                            <button
	                              type="button"
	                              onClick={() => applyOrganizerSourceCollection(collection)}
	                              disabled={
	                                organizerFilesLoading ||
	                                organizerImportBusy ||
	                                Boolean(organizerStagingViewId) ||
	                                Boolean(organizerStagingRecommendationId) ||
	                                Boolean(organizerStagingCollectionId)
	                              }
	                              data-testid={`streetbot-documents-organizer-collection-source-${index}`}
	                              style={{
	                                minWidth: 0,
	                                display: "grid",
	                                gridTemplateColumns: "minmax(0, 1fr) auto",
	                                alignItems: "center",
	                                gap: "7px",
	                                border: "none",
	                                background: "transparent",
	                                color: colors.text,
	                                padding: "1px 2px",
	                                textAlign: "left",
	                                cursor: organizerFilesLoading || organizerImportBusy || organizerStagingViewId || organizerStagingRecommendationId || organizerStagingCollectionId ? "not-allowed" : "pointer",
	                                opacity: (organizerStagingCollectionId && !isStagingCollection) || organizerStagingViewId || organizerStagingRecommendationId ? 0.52 : 1,
	                              }}
	                            >
	                              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.72rem", fontWeight: 750 }}>
	                                {collection.source_display_root}
	                              </span>
	                              <span style={{ color: colors.textMuted, fontSize: "0.68rem", fontWeight: 800 }}>
	                                {collection.count.toLocaleString()}
	                              </span>
	                            </button>
	                            <button
	                              type="button"
	                              onClick={() => void stageOrganizerCollectionFiles({
	                                id: stagingCollectionId,
	                                name: collection.source_display_root,
	                                sourceRoot: collection.source_root,
	                              })}
	                              disabled={collectionStageDisabled}
	                              data-testid={`streetbot-documents-organizer-stage-collection-source-${index}`}
	                              title={`Stage ${collection.source_display_root} collection`}
	                              aria-label={`Stage ${collection.source_display_root} collection`}
	                              style={{
	                                width: "24px",
	                                height: "24px",
	                                borderRadius: "8px",
	                                border: `1px solid ${colors.border}`,
	                                background: isStagingCollection
	                                  ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)")
	                                  : "transparent",
	                                color: isStagingCollection ? colors.accent : colors.textMuted,
	                                display: "inline-flex",
	                                alignItems: "center",
	                                justifyContent: "center",
	                                cursor: collectionStageDisabled ? "not-allowed" : "pointer",
	                                opacity: (organizerStagingCollectionId && !isStagingCollection) || collection.count === 0 ? 0.45 : 1,
	                              }}
	                            >
	                              {isStagingCollection
	                                ? <Loader2 size={12} className="spin" style={{ animation: "spin 1s linear infinite" }} />
	                                : <List size={12} />}
	                            </button>
	                          </div>
	                        );
	                      })}
	                    </div>
	                  </div>
	                  {!organizerCollectionsLoading && (!organizerCollections || organizerCollections.source_roots.length === 0) && (
	                    <div style={{ color: colors.textMuted, fontSize: "0.74rem" }}>
	                      Scan local folders to build collections.
	                    </div>
	                  )}
	                </div>

	                <div
	                  data-testid="streetbot-documents-organizer-recommendations"
                  style={{
                    borderRadius: "8px",
                    border: `1px solid ${colors.border}`,
                    padding: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
                      <BarChart3 size={14} style={{ color: colors.textMuted, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "0.78rem", color: colors.text, fontWeight: 800 }}>
                          Suggested views
                        </div>
                        <div style={{ marginTop: "3px", fontSize: "0.68rem", color: colors.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          Metadata-only organization picks
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadOrganizerRecommendations()}
                      disabled={organizerRecommendationsLoading}
                      data-testid="streetbot-documents-organizer-recommendations-refresh"
                      aria-label="Refresh organizer recommendations"
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "8px",
                        border: `1px solid ${colors.border}`,
                        background: "transparent",
                        color: colors.textMuted,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: organizerRecommendationsLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {organizerRecommendationsLoading
                        ? <Loader2 size={13} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                        : <RefreshCw size={13} />}
                    </button>
                  </div>
                  {organizerRecommendationsError && (
                    <div style={{ color: "#dc2626", fontSize: "0.72rem", fontWeight: 700 }}>
                      {organizerRecommendationsError}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {organizerRecommendations?.recommendations.slice(0, 4).map(recommendation => {
                      const isStagingRecommendation = organizerStagingRecommendationId === recommendation.id;
                      const recommendationMeta = [
                        `${recommendation.matched_file_count.toLocaleString()} ${recommendation.matched_file_count === 1 ? "file" : "files"}`,
                        formatBytes(recommendation.total_size_bytes),
                        organizerFileSortLabel(recommendation.sort_by),
                      ];
                      const samplePath = recommendation.sample_files[0]?.display_path;
                      const viewLabel = recommendation.search_query
                        ? `${recommendation.folder_name} / ${recommendation.search_query}`
                        : recommendation.folder_name;
                      return (
                        <div
                          key={recommendation.id}
                          title={recommendation.reason || recommendation.description}
                          style={{
                            borderRadius: "8px",
                            border: `1px solid ${colors.border}`,
                            padding: "7px 8px",
                            display: "grid",
                            gridTemplateColumns: documentsVeryCompact ? "1fr" : "minmax(0, 1fr) auto",
                            gap: "8px",
                            alignItems: "center",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: colors.text, fontSize: "0.74rem", fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {recommendation.name}
                            </div>
                            <div style={{ marginTop: "3px", color: colors.textMuted, fontSize: "0.67rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {viewLabel} · {recommendationMeta.join(" · ")}
                            </div>
                            {samplePath && (
                              <div style={{ marginTop: "3px", color: colors.textMuted, fontSize: "0.66rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {samplePath}
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: documentsVeryCompact ? "flex-start" : "flex-end", gap: "6px", flexWrap: "wrap" }}>
	                            <button
	                              type="button"
	                              onClick={() => applyOrganizerRecommendation(recommendation)}
	                              disabled={
	                                organizerFilesLoading ||
	                                organizerImportBusy ||
	                                Boolean(organizerStagingViewId) ||
	                                Boolean(organizerStagingRecommendationId) ||
	                                Boolean(organizerStagingCollectionId)
	                              }
	                              data-testid={`streetbot-documents-organizer-recommendation-open-${recommendation.id}`}
                              style={{
                                height: "26px",
                                borderRadius: "8px",
                                border: `1px solid ${colors.border}`,
                                background: "transparent",
                                color: colors.text,
                                padding: "0 9px",
                                fontSize: "0.68rem",
                                fontWeight: 800,
	                                cursor: organizerFilesLoading || organizerImportBusy || organizerStagingViewId || organizerStagingRecommendationId || organizerStagingCollectionId ? "not-allowed" : "pointer",
	                                opacity: organizerStagingViewId || (organizerStagingRecommendationId && !isStagingRecommendation) || organizerStagingCollectionId ? 0.5 : 1,
                                whiteSpace: "nowrap",
                              }}
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() => void stageOrganizerRecommendationFiles(recommendation)}
                              disabled={
                                organizerImportBusy ||
                                organizerFilesLoading ||
	                                Boolean(organizerStagingViewId) ||
	                                Boolean(organizerStagingRecommendationId) ||
	                                Boolean(organizerStagingCollectionId) ||
	                                recommendation.matched_file_count === 0
                              }
                              data-testid={`streetbot-documents-organizer-recommendation-stage-${recommendation.id}`}
                              style={{
                                height: "26px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                borderRadius: "8px",
                                border: `1px solid ${colors.border}`,
                                background: "transparent",
                                color: colors.text,
                                padding: "0 9px",
                                fontSize: "0.68rem",
                                fontWeight: 800,
	                                cursor: organizerImportBusy || organizerFilesLoading || organizerStagingViewId || organizerStagingRecommendationId || organizerStagingCollectionId || recommendation.matched_file_count === 0
	                                  ? "not-allowed"
	                                  : "pointer",
	                                opacity: (organizerStagingRecommendationId && !isStagingRecommendation) || organizerStagingCollectionId ? 0.5 : 1,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {isStagingRecommendation && (
                                <Loader2 size={11} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                              )}
                              Stage
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {!organizerRecommendationsLoading && (!organizerRecommendations || organizerRecommendations.recommendations.length === 0) && (
                      <div style={{ color: colors.textMuted, fontSize: "0.74rem" }}>
                        Scan local folders to see suggested organizer views.
                      </div>
                    )}
                  </div>
                </div>

                <div
                  data-testid="streetbot-documents-organizer-import-history"
                  style={{
                    borderRadius: "8px",
                    border: `1px solid ${colors.border}`,
                    padding: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
                      <History size={14} style={{ color: colors.textMuted, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "0.78rem", color: colors.text, fontWeight: 800 }}>
                          Import history
                        </div>
                        <div style={{ marginTop: "3px", fontSize: "0.68rem", color: colors.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          MongoDB import runs
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadOrganizerImportRuns()}
                      disabled={organizerImportRunsLoading}
                      data-testid="streetbot-documents-organizer-import-history-refresh"
                      aria-label="Refresh import history"
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "8px",
                        border: `1px solid ${colors.border}`,
                        background: "transparent",
                        color: colors.textMuted,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: organizerImportRunsLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {organizerImportRunsLoading
                        ? <Loader2 size={13} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                        : <RefreshCw size={13} />}
                    </button>
                  </div>
                  {organizerImportRunsError && (
                    <div style={{ color: "#dc2626", fontSize: "0.72rem", fontWeight: 700 }}>
                      {organizerImportRunsError}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {organizerImportRuns.slice(0, 3).map(run => {
                      const unfinishedCount = run.items.filter(item => item.status === "pending" || item.status === "importing").length;
                      const failedCount = run.items.filter(item => item.status === "failed").length;
                      const resumeMode: "unfinished" | "failed" | null = unfinishedCount > 0
                        ? "unfinished"
                        : failedCount > 0 ? "failed" : null;
                      const isResumingRun = organizerResumingImportRunId === run.id;
                      return (
                      <div
                        key={run.id}
                        title={run.message}
                        style={{
                          borderRadius: "8px",
                          border: `1px solid ${colors.border}`,
                          padding: "7px 8px",
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: "8px",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: colors.text, fontSize: "0.74rem", fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {run.imported_count.toLocaleString()} imported / {run.failed_count.toLocaleString()} failed
                          </div>
                          <div style={{ color: colors.textMuted, fontSize: "0.68rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {run.started_at ? `${timeAgo(run.started_at)} · ${run.requested_count.toLocaleString()} files` : `${run.requested_count.toLocaleString()} files`}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span
                            style={{
                              color: run.status === "completed_with_errors" || run.status === "failed" ? "#dc2626" : colors.textMuted,
                              fontSize: "0.66rem",
                              fontWeight: 800,
                              textTransform: "uppercase",
                              letterSpacing: 0,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {run.status.replace(/_/g, " ")}
                          </span>
                          {resumeMode && (
                            <button
                              type="button"
                              onClick={() => void resumeOrganizerImportRun(run, resumeMode)}
                              disabled={organizerImportBusy}
                              data-testid={`streetbot-documents-organizer-resume-import-${run.id}`}
                              style={{
                                height: "24px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                borderRadius: "8px",
                                border: `1px solid ${colors.border}`,
                                background: "transparent",
                                color: colors.text,
                                padding: "0 7px",
                                fontSize: "0.66rem",
                                fontWeight: 800,
                                cursor: organizerImportBusy ? "not-allowed" : "pointer",
                                opacity: organizerImportBusy && !isResumingRun ? 0.5 : 1,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {isResumingRun
                                ? <Loader2 size={11} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                                : <RotateCcw size={11} />}
                              {resumeMode === "unfinished" ? "Resume" : "Retry"}
                            </button>
                          )}
                        </div>
                      </div>
                    );})}
                    {!organizerImportRunsLoading && organizerImportRuns.length === 0 && (
                      <div style={{ color: colors.textMuted, fontSize: "0.74rem" }}>
                        No imports recorded yet.
                      </div>
                    )}
                  </div>
                </div>

                <div
                  data-testid="streetbot-documents-organizer-duplicates"
                  style={{
                    borderRadius: "8px",
                    border: `1px solid ${colors.border}`,
                    padding: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
                      <AlertTriangle size={14} style={{ color: colors.textMuted, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "0.78rem", color: colors.text, fontWeight: 800 }}>
                          Duplicates
                        </div>
                        <div style={{ marginTop: "3px", fontSize: "0.68rem", color: colors.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {organizerDuplicates?.technical_filter_applied ? "Personal docs focus" : "Including technical artifacts"}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: documentsVeryCompact ? "wrap" : "nowrap", justifyContent: "flex-end" }}>
                      <label
                        title="Include technical, dependency, source-control, and project artifact duplicates"
                        style={{
                          minHeight: "28px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          borderRadius: "8px",
                          border: `1px solid ${colors.border}`,
                          padding: "0 8px",
                          color: colors.textMuted,
                          fontSize: "0.66rem",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                          cursor: organizerDuplicatesLoading ? "not-allowed" : "pointer",
                          opacity: organizerDuplicatesLoading ? 0.62 : 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={organizerIncludeProjectDuplicates}
                          disabled={organizerDuplicatesLoading}
                          onChange={(event) => setOrganizerIncludeProjectDuplicates(event.currentTarget.checked)}
                          data-testid="streetbot-documents-organizer-duplicates-include-projects"
                          aria-label="Include technical duplicates"
                          style={{ margin: 0 }}
                        />
                        Technical files
                      </label>
                      <button
                        type="button"
                        onClick={() => void loadOrganizerDuplicates()}
                        disabled={organizerDuplicatesLoading}
                        data-testid="streetbot-documents-organizer-duplicates-refresh"
                        aria-label="Refresh duplicate metadata"
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "8px",
                          border: `1px solid ${colors.border}`,
                          background: "transparent",
                          color: colors.textMuted,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: organizerDuplicatesLoading ? "not-allowed" : "pointer",
                        }}
                      >
                        {organizerDuplicatesLoading
                          ? <Loader2 size={13} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                          : <RefreshCw size={13} />}
                      </button>
                    </div>
                  </div>
                  {organizerDuplicatesError && (
                    <div style={{ color: "#dc2626", fontSize: "0.72rem", fontWeight: 700 }}>
                      {organizerDuplicatesError}
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))", gap: "8px" }}>
                    {[
                      ["Groups", organizerDuplicates?.duplicate_group_count.toLocaleString() || "0"],
                      ["Files", organizerDuplicates?.duplicate_file_count.toLocaleString() || "0"],
                      ["Possible cleanup", formatBytes(organizerDuplicates?.reclaimable_size_bytes || 0)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        style={{
                          borderRadius: "8px",
                          border: `1px solid ${colors.border}`,
                          padding: "7px 8px",
                          minWidth: 0,
                        }}
                      >
                        <div style={{ fontSize: "0.66rem", color: colors.textMuted, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>
                          {label}
                        </div>
                        <div style={{ marginTop: "4px", color: colors.text, fontSize: "0.78rem", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {organizerDuplicates?.groups.slice(0, 3).map(group => {
                      const duplicateCount = Math.max(0, Math.floor(group.count || group.files.length));
                      const visibleDuplicateFiles = group.files.slice(0, 2);
                      const duplicateMetaSegments = [
                        `${duplicateCount.toLocaleString()} ${duplicateCount === 1 ? "file" : "files"}`,
                        formatBytes(group.size_bytes),
                        group.latest_modified_at ? `Modified ${timeAgo(group.latest_modified_at)}` : null,
                      ].filter(Boolean);
                      return (
                        <div
                          key={group.duplicate_key}
                          title={group.filename}
                          style={{
                            borderRadius: "8px",
                            border: `1px solid ${colors.border}`,
                            padding: "7px 8px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "5px",
                            minWidth: 0,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", minWidth: 0 }}>
                            <div style={{ color: colors.text, fontSize: "0.74rem", fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {group.filename}
                            </div>
                            <div style={{ color: colors.textMuted, fontSize: "0.66rem", fontWeight: 800, whiteSpace: "nowrap" }}>
                              {formatBytes(group.duplicate_size_bytes)}
                            </div>
                          </div>
                          <div style={{ color: colors.textMuted, fontSize: "0.67rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {duplicateMetaSegments.join(" · ")}
                          </div>
                          {visibleDuplicateFiles.map(file => (
                            <div
                              key={file.id}
                              style={{
                                color: colors.textMuted,
                                fontSize: "0.66rem",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {file.display_path}
                            </div>
                          ))}
                          {group.hidden_file_count > 0 && (
                            <div style={{ color: colors.textMuted, fontSize: "0.66rem", fontWeight: 700 }}>
                              +{group.hidden_file_count.toLocaleString()} more
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {!organizerDuplicatesLoading && (!organizerDuplicates || organizerDuplicates.groups.length === 0) && (
                      <div style={{ color: colors.textMuted, fontSize: "0.74rem" }}>
                        No duplicate metadata found.
                      </div>
                    )}
                  </div>
                </div>

                <div
                  data-testid="streetbot-documents-organizer-saved-views"
                  style={{
                    borderRadius: "8px",
                    border: `1px solid ${colors.border}`,
                    padding: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
                      <Bookmark size={14} style={{ color: colors.textMuted, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "0.78rem", color: colors.text, fontWeight: 800 }}>
                          Saved views
                        </div>
                        <div style={{ marginTop: "3px", fontSize: "0.68rem", color: colors.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          MongoDB folder/search views
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: documentsVeryCompact ? "wrap" : "nowrap", justifyContent: "flex-end" }}>
                      <select
                        value={organizerSavedViewStageLimit}
                        onChange={(event) => {
                          const nextLimit = Number(event.target.value);
                          setOrganizerSavedViewStageLimit(
                            DOCUMENTS_ORGANIZER_STAGE_LIMIT_OPTIONS.includes(nextLimit as typeof DOCUMENTS_ORGANIZER_STAGE_LIMIT_OPTIONS[number])
                              ? nextLimit as typeof DOCUMENTS_ORGANIZER_STAGE_LIMIT_OPTIONS[number]
                              : 24
                          );
                        }}
	                        disabled={
	                          organizerImportBusy ||
	                          Boolean(organizerStagingViewId) ||
	                          Boolean(organizerStagingRecommendationId) ||
	                          Boolean(organizerStagingCollectionId)
	                        }
	                        data-testid="streetbot-documents-organizer-stage-limit"
	                        title="Organizer stage batch size"
	                        aria-label="Organizer stage batch size"
                        style={{
                          height: "28px",
                          borderRadius: "8px",
                          border: `1px solid ${colors.border}`,
                          background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.78)",
                          color: colors.text,
                          padding: "0 7px",
                          fontSize: "0.68rem",
                          fontWeight: 800,
                          outline: "none",
	                          cursor: organizerImportBusy || organizerStagingViewId || organizerStagingRecommendationId || organizerStagingCollectionId ? "not-allowed" : "pointer",
                        }}
                      >
                        {DOCUMENTS_ORGANIZER_STAGE_LIMIT_OPTIONS.map(limit => (
                          <option key={limit} value={limit}>
                            {limit}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void saveOrganizerCurrentView()}
                        disabled={organizerSavingView || organizerSavedViewsLoading || organizerCurrentViewSaved}
                        data-testid="streetbot-documents-organizer-save-view"
                        title={organizerCurrentViewSaved ? "Current view saved" : "Save current organizer view"}
                        aria-label="Save current organizer view"
                        style={{
                          height: "28px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          borderRadius: "8px",
                          border: `1px solid ${colors.border}`,
                          background: organizerCurrentViewSaved
                            ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)")
                            : "transparent",
                          color: organizerCurrentViewSaved ? colors.accent : colors.text,
                          padding: "0 8px",
                          fontSize: "0.66rem",
                          fontWeight: 800,
                          cursor: organizerSavingView || organizerSavedViewsLoading || organizerCurrentViewSaved ? "not-allowed" : "pointer",
                          opacity: organizerSavingView || organizerSavedViewsLoading ? 0.62 : 1,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {organizerSavingView
                          ? <Loader2 size={12} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                          : <BookmarkPlus size={12} />}
                        {organizerCurrentViewSaved ? "Saved" : "Save"}
                      </button>
                    </div>
                  </div>
                  {organizerSavedViewsError && (
                    <div style={{ color: "#dc2626", fontSize: "0.72rem", fontWeight: 700 }}>
                      {organizerSavedViewsError}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
	                    {organizerSavedViews.slice(0, 5).map(view => {
	                      const isActiveView = view.folder_key === organizerSelectedFolderKey &&
	                        (view.source_root || "") === organizerSelectedSourceRoot.trim() &&
	                        view.search_query.trim().replace(/\s+/g, " ").toLowerCase() === organizerFileSearch.trim().replace(/\s+/g, " ").toLowerCase() &&
	                        view.sort_by === organizerFileSort;
                      const isDeletingView = organizerDeletingViewId === view.id;
                      const isStagingView = organizerStagingViewId === view.id;
                      const matchedFileCount = Math.max(0, Math.floor(view.matched_file_count || 0));
                      const viewMetaSegments = [
                        `${matchedFileCount.toLocaleString()} ${matchedFileCount === 1 ? "file" : "files"}`,
                        organizerFileSortLabel(view.sort_by),
                        formatBytes(view.matched_size_bytes),
                        view.last_opened_at ? `Opened ${timeAgo(view.last_opened_at)}` : null,
                      ].filter(Boolean);
                      return (
                        <div
                          key={view.id}
	                          title={[view.folder_name, view.source_display_root, view.search_query].filter(Boolean).join(" / ")}
                          style={{
                            borderRadius: "8px",
                            border: `1px solid ${isActiveView ? colors.accent : colors.border}`,
                            padding: "7px 8px",
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            gap: "8px",
                            alignItems: "center",
                            background: isActiveView
                              ? (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.035)")
                              : "transparent",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => void applyOrganizerSavedView(view)}
                            data-testid={`streetbot-documents-organizer-saved-view-${view.id}`}
                            style={{
                              minWidth: 0,
                              border: "none",
                              background: "transparent",
                              padding: 0,
                              textAlign: "left",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ color: colors.text, fontSize: "0.74rem", fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {view.name}
                            </div>
	                            <div style={{ color: colors.textMuted, fontSize: "0.68rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
	                              {[view.folder_name, view.source_display_root, view.search_query].filter(Boolean).join(" · ")}
	                            </div>
                            <div style={{ color: colors.textMuted, fontSize: "0.66rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "3px" }}>
                              {viewMetaSegments.join(" · ")}
                            </div>
                          </button>
                          <div style={{ display: "flex", flexDirection: "column", gap: "5px", alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={() => void stageOrganizerSavedViewFiles(view)}
	                              disabled={
	                                organizerImportBusy ||
	                                Boolean(organizerStagingViewId) ||
	                                Boolean(organizerStagingRecommendationId) ||
	                                Boolean(organizerStagingCollectionId) ||
	                                matchedFileCount === 0
	                              }
                              data-testid={`streetbot-documents-organizer-stage-saved-view-${view.id}`}
                              title="Stage visible files from saved view"
                              aria-label={`Stage saved view ${view.name} for import`}
                              style={{
                                width: "24px",
                                height: "24px",
                                borderRadius: "8px",
                                border: `1px solid ${colors.border}`,
                                background: isStagingView
                                  ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)")
                                  : "transparent",
                                color: isStagingView ? colors.accent : colors.textMuted,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
	                                cursor: organizerImportBusy || organizerStagingViewId || organizerStagingRecommendationId || organizerStagingCollectionId || matchedFileCount === 0 ? "not-allowed" : "pointer",
	                                opacity: (organizerStagingViewId && !isStagingView) || organizerStagingRecommendationId || organizerStagingCollectionId || matchedFileCount === 0 ? 0.45 : 1,
                              }}
                            >
                              {isStagingView
                                ? <Loader2 size={12} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                                : <List size={12} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteOrganizerSavedView(view)}
                              disabled={Boolean(organizerDeletingViewId)}
                              data-testid={`streetbot-documents-organizer-delete-saved-view-${view.id}`}
                              title="Delete saved view"
                              aria-label={`Delete saved view ${view.name}`}
                              style={{
                                width: "24px",
                                height: "24px",
                                borderRadius: "8px",
                                border: `1px solid ${colors.border}`,
                                background: "transparent",
                                color: isDeletingView ? colors.accent : colors.textMuted,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: organizerDeletingViewId ? "not-allowed" : "pointer",
                                opacity: organizerDeletingViewId && !isDeletingView ? 0.45 : 1,
                              }}
                            >
                              {isDeletingView
                                ? <Loader2 size={12} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                                : <Trash2 size={12} />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {!organizerSavedViewsLoading && organizerSavedViews.length === 0 && (
                      <div style={{ color: colors.textMuted, fontSize: "0.74rem" }}>
                        No saved views yet.
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    borderRadius: "8px",
                    border: `1px solid ${colors.border}`,
                    padding: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "9px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <div>
                      <div style={{ fontSize: "0.78rem", color: colors.text, fontWeight: 800 }}>
                        Physical folders
                      </div>
                      <div style={{ marginTop: "3px", fontSize: "0.7rem", color: colors.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "210px" }}>
                        {organizerMovePlan?.target_display_root || "Preview destination"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: documentsVeryCompact ? "wrap" : "nowrap", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => void loadOrganizerMovePlan()}
                        disabled={organizerMovePlanLoading || organizerMoveExporting || organizerMoveApplying || !organizerSummary?.scanned_file_count}
                        data-testid="streetbot-documents-organizer-plan-move"
                        style={{
                          height: "30px",
                          display: "flex",
                          alignItems: "center",
                          gap: "7px",
                          padding: "0 10px",
                          borderRadius: "8px",
                          border: `1px solid ${colors.border}`,
                          background: "transparent",
                          color: colors.text,
                          cursor: organizerMovePlanLoading || organizerMoveExporting || organizerMoveApplying || !organizerSummary?.scanned_file_count ? "not-allowed" : "pointer",
                          opacity: organizerMovePlanLoading || organizerMoveExporting || organizerMoveApplying || !organizerSummary?.scanned_file_count ? 0.58 : 1,
                          fontSize: "0.74rem",
                          fontWeight: 750,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {organizerMovePlanLoading
                          ? <Loader2 size={13} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                          : <FolderOpen size={13} />}
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => void exportOrganizerMovePlan()}
                        disabled={organizerMovePlanLoading || organizerMoveExporting || organizerMoveApplying || !organizerSummary?.scanned_file_count}
                        data-testid="streetbot-documents-organizer-export-move-plan"
                        title="Export full move plan"
                        aria-label="Export full move plan"
                        style={{
                          height: "30px",
                          display: "flex",
                          alignItems: "center",
                          gap: "7px",
                          padding: "0 10px",
                          borderRadius: "8px",
                          border: `1px solid ${colors.border}`,
                          background: "transparent",
                          color: colors.text,
                          cursor: organizerMovePlanLoading || organizerMoveExporting || organizerMoveApplying || !organizerSummary?.scanned_file_count ? "not-allowed" : "pointer",
                          opacity: organizerMovePlanLoading || organizerMoveExporting || organizerMoveApplying || !organizerSummary?.scanned_file_count ? 0.58 : 1,
                          fontSize: "0.74rem",
                          fontWeight: 750,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {organizerMoveExporting
                          ? <Loader2 size={13} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                          : <Download size={13} />}
                        Export
                      </button>
                    </div>
                  </div>

                  {organizerMovePlan && (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(74px, 1fr))", gap: "7px" }}>
                        {[
                          ["Moves", organizerMovePlan.move_count.toLocaleString()],
                          ["Skipped", organizerMovePlan.skipped_count.toLocaleString()],
                          ["Collisions", organizerMovePlan.collision_count.toLocaleString()],
                          ["Project-safe", organizerMovePlan.project_file_skipped_count.toLocaleString()],
                          ["Already", organizerMovePlan.already_organized_count.toLocaleString()],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            style={{
                              borderRadius: "8px",
                              border: `1px solid ${colors.border}`,
                              padding: "7px",
                              minHeight: "48px",
                            }}
                          >
                            <div style={{ fontSize: "0.64rem", color: colors.textMuted, fontWeight: 750, textTransform: "uppercase", letterSpacing: 0 }}>
                              {label}
                            </div>
                            <div style={{ marginTop: "3px", fontSize: "0.82rem", color: colors.text, fontWeight: 800 }}>
                              {value}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {organizerMovePlan.actions.slice(0, 4).map(action => (
                          <div
                            key={`${action.file_id}:${action.target_display_path}`}
                            title={`${action.source_display_path} -> ${action.target_display_path}`}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              gap: "8px",
                              alignItems: "center",
                              borderRadius: "8px",
                              border: `1px solid ${colors.border}`,
                              padding: "7px 8px",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: "0.74rem", color: colors.text, fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {action.filename}
                              </div>
                              <div style={{ fontSize: "0.68rem", color: colors.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {action.target_display_path}
                              </div>
                            </div>
                            <span style={{ fontSize: "0.68rem", color: colors.textMuted, fontWeight: 700 }}>
                              {formatBytes(action.size_bytes)}
                            </span>
                          </div>
                        ))}
                        {organizerMovePlan.move_count > organizerMovePlan.actions.length && (
                          <div style={{ fontSize: "0.7rem", color: colors.textMuted, fontWeight: 650 }}>
                            {(organizerMovePlan.move_count - organizerMovePlan.actions.length).toLocaleString()} more
                          </div>
                        )}
                      </div>

                      {organizerMovePlan.move_count > 0 && (
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <input
                            value={organizerMoveConfirmation}
                            onChange={(event) => setOrganizerMoveConfirmation(event.target.value)}
                            placeholder={organizerMovePlan.confirmation_phrase}
                            data-testid="streetbot-documents-organizer-move-confirmation"
                            style={{
                              minWidth: 0,
                              flex: 1,
                              height: "30px",
                              borderRadius: "8px",
                              border: `1px solid ${colors.border}`,
                              background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.78)",
                              color: colors.text,
                              padding: "0 9px",
                              fontSize: "0.76rem",
                              outline: "none",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => void applyOrganizerMovePlan()}
                            disabled={organizerMoveApplying || organizerMoveConfirmation.trim() !== organizerMovePlan.confirmation_phrase}
                            data-testid="streetbot-documents-organizer-apply-move"
                            style={{
                              height: "30px",
                              display: "flex",
                              alignItems: "center",
                              gap: "7px",
                              padding: "0 10px",
                              borderRadius: "8px",
                              border: `1px solid ${colors.border}`,
                              background: organizerMoveConfirmation.trim() === organizerMovePlan.confirmation_phrase ? colors.accent : "transparent",
                              color: organizerMoveConfirmation.trim() === organizerMovePlan.confirmation_phrase ? "#000" : colors.textMuted,
                              cursor: organizerMoveApplying || organizerMoveConfirmation.trim() !== organizerMovePlan.confirmation_phrase ? "not-allowed" : "pointer",
                              fontSize: "0.74rem",
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {organizerMoveApplying
                              ? <Loader2 size={13} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                              : <FolderPlus size={13} />}
                            Move
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: documentsCompact
                    ? "minmax(0, 1fr)"
                    : "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ marginBottom: "7px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.76rem", color: colors.textMuted, fontWeight: 750, textTransform: "uppercase", letterSpacing: 0 }}>
                      Virtual folders
                    </span>
                    {organizerFiles?.total_count !== undefined && (
                      <span style={{ color: colors.textMuted, fontSize: "0.7rem", fontWeight: 700 }}>
                        {organizerVisibleFiles.length.toLocaleString()} / {organizerFiles.total_count.toLocaleString()} shown
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {[
                      {
                        folder_key: "all",
                        folder_name: "All local files",
                        document_type: "all",
                        count: organizerSummary?.scanned_file_count || 0,
                        total_size_bytes: organizerSummary?.total_size_bytes || 0,
                        latest_modified_at: organizerSummary?.latest_scan_at || null,
                      },
                      ...(organizerSummary?.folders || []).slice(0, 9),
                    ].map(folder => {
                      const isSelected = organizerSelectedFolderKey === folder.folder_key;
                      return (
                      <button
                        type="button"
                        key={folder.folder_key}
                        onClick={() => setOrganizerSelectedFolderKey(folder.folder_key)}
                        data-testid={`streetbot-documents-organizer-folder-${folder.folder_key}`}
                        style={{
                          minHeight: "34px",
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          alignItems: "center",
                          gap: "8px",
                          borderRadius: "8px",
                          border: `1px solid ${isSelected ? colors.accent : colors.border}`,
                          background: isSelected
                            ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.035)")
                            : "transparent",
                          padding: "7px 9px",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span style={{ color: colors.text, fontSize: "0.8rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {folder.folder_name}
                        </span>
                        <span style={{ color: colors.textMuted, fontSize: "0.75rem", fontWeight: 700 }}>
                          {folder.count.toLocaleString()}
                        </span>
                      </button>
                    );})}
                    {!organizerLoading && !organizerSummary?.folders.length && (
                      <div style={{ color: colors.textMuted, fontSize: "0.78rem", padding: "8px 0" }}>
                        No local folder index yet.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ marginBottom: "7px", display: "grid", gap: "8px" }}>
	                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
	                      <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, flexWrap: "wrap" }}>
	                        <span style={{ fontSize: "0.76rem", color: colors.textMuted, fontWeight: 750, textTransform: "uppercase", letterSpacing: 0 }}>
	                          Indexed files
	                        </span>
	                        {organizerSelectedSourceRoot && (
	                          <button
	                            type="button"
	                            onClick={() => setOrganizerSelectedSourceRoot("")}
	                            data-testid="streetbot-documents-organizer-clear-source-root"
	                            title="Clear location filter"
	                            style={{
	                              maxWidth: "180px",
	                              height: "24px",
	                              display: "inline-flex",
	                              alignItems: "center",
	                              gap: "5px",
	                              borderRadius: "8px",
	                              border: `1px solid ${colors.border}`,
	                              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.035)",
	                              color: colors.textMuted,
	                              padding: "0 7px",
	                              fontSize: "0.66rem",
	                              fontWeight: 800,
	                              cursor: "pointer",
	                              overflow: "hidden",
	                            }}
	                          >
	                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
	                              {organizerSelectedSourceLabel}
	                            </span>
	                            <X size={10} style={{ flexShrink: 0 }} />
	                          </button>
	                        )}
	                      </div>
	                      <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0, flexWrap: documentsVeryCompact ? "wrap" : "nowrap", justifyContent: "flex-end" }}>
                        <select
                          value={organizerFileSort}
                          onChange={(event) => setOrganizerFileSort(normalizeOrganizerFileSortKey(event.target.value))}
                          disabled={organizerFilesLoading || organizerImportBusy}
                          data-testid="streetbot-documents-organizer-file-sort"
                          title="Sort indexed files"
                          aria-label="Sort indexed files"
                          style={{
                            height: "26px",
                            borderRadius: "8px",
                            border: `1px solid ${colors.border}`,
                            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.78)",
                            color: colors.text,
                            padding: "0 7px",
                            fontSize: "0.68rem",
                            fontWeight: 800,
                            outline: "none",
                            cursor: organizerFilesLoading || organizerImportBusy ? "not-allowed" : "pointer",
                          }}
                        >
                          {DOCUMENTS_ORGANIZER_FILE_SORT_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {organizerSelectedVisibleFiles.length > 0 && (
                          <span style={{ color: colors.textMuted, fontSize: "0.68rem", fontWeight: 750, whiteSpace: "nowrap" }}>
                            {organizerSelectedVisibleFiles.length.toLocaleString()} selected
                          </span>
                        )}
                        {organizerVisibleFiles.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setOrganizerVisibleFileSelection(!organizerAllVisibleFilesSelected)}
                            disabled={organizerImportBusy}
                            style={{
                              height: "26px",
                              borderRadius: "8px",
                              border: `1px solid ${colors.border}`,
                              background: organizerAllVisibleFilesSelected
                                ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)")
                                : "transparent",
                              color: colors.textMuted,
                              padding: "0 8px",
                              fontSize: "0.68rem",
                              fontWeight: 750,
                              cursor: organizerImportBusy ? "not-allowed" : "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {organizerAllVisibleFilesSelected ? "Clear" : "Select shown"}
                          </button>
                        )}
                        {organizerFilesLoading && <Loader2 size={13} className="spin" style={{ animation: "spin 1s linear infinite", color: colors.textMuted }} />}
                      </div>
                    </div>
                    <div style={{ position: "relative" }}>
                      <Search size={13} style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)", color: colors.textMuted }} />
                      <input
                        value={organizerFileSearch}
                        onChange={(event) => setOrganizerFileSearch(event.target.value)}
                        placeholder="Search local index"
                        data-testid="streetbot-documents-organizer-file-search"
                        style={{
                          width: "100%",
                          height: "30px",
                          borderRadius: "8px",
                          border: `1px solid ${colors.border}`,
                          background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.78)",
                          color: colors.text,
                          padding: "0 9px 0 28px",
                          fontSize: "0.76rem",
                          outline: "none",
                        }}
                      />
                    </div>
                    {organizerSelectedVisibleFiles.length > 0 && (
                      <>
                        <div
                          data-testid="streetbot-documents-organizer-import-preview"
                          style={{
                            display: "grid",
                            gap: "8px",
                            borderRadius: "8px",
                            border: `1px solid ${colors.border}`,
                            background: isDark ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.72)",
                            padding: "9px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                            <span style={{ color: colors.text, fontSize: "0.76rem", fontWeight: 850 }}>
                              Import preview
                            </span>
                            <span style={{ color: colors.textMuted, fontSize: "0.68rem", fontWeight: 750 }}>
                              {organizerImportPreviewLoading
                                ? "Preparing metadata"
                                : organizerImportPreview
                                  ? `${organizerImportPreview.preview_file_count.toLocaleString()} files / ${formatBytes(organizerImportPreview.total_size_bytes)}`
                                  : `${organizerSelectedVisibleFiles.length.toLocaleString()} selected`}
                            </span>
                          </div>
                          {organizerImportPreviewError ? (
                            <div style={{ color: "#dc2626", fontSize: "0.72rem", fontWeight: 750 }}>
                              {organizerImportPreviewError}
                            </div>
                          ) : organizerImportPreview ? (
                            <>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: documentsVeryCompact ? "minmax(0, 1fr)" : "repeat(3, minmax(0, 1fr))",
                                  gap: "7px",
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ color: colors.textMuted, fontSize: "0.64rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>
                                    Provider
                                  </div>
                                  <div style={{ color: colors.text, fontSize: "0.74rem", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {organizerImportPreview.conversion_provider}
                                  </div>
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ color: colors.textMuted, fontSize: "0.64rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>
                                    Types
                                  </div>
                                  <div style={{ color: colors.text, fontSize: "0.74rem", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {organizerImportPreview.folders.slice(0, 3).map(folder => folder.folder_name).join(", ") || "Mixed"}
                                  </div>
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ color: colors.textMuted, fontSize: "0.64rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>
                                    Limit
                                  </div>
                                  <div style={{ color: organizerImportPreview.oversized_file_count > 0 ? "#dc2626" : colors.text, fontSize: "0.74rem", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {organizerImportPreview.oversized_file_count > 0
                                      ? `${organizerImportPreview.oversized_file_count.toLocaleString()} over ${formatBytes(organizerImportPreview.max_file_size_bytes)}`
                                      : `Under ${formatBytes(organizerImportPreview.max_file_size_bytes)}`}
                                  </div>
                                </div>
                              </div>
                              <div style={{ color: colors.textMuted, fontSize: "0.68rem", lineHeight: 1.35 }}>
                                {organizerImportPreview.source_roots.slice(0, 2).map(source => source.source_display_root).join(" / ") || "Local index"} - metadata only
                              </div>
                            </>
                          ) : (
                            <div style={{ color: colors.textMuted, fontSize: "0.72rem", fontWeight: 700 }}>
                              Preparing metadata-only preview...
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: documentsVeryCompact ? "minmax(0, 1fr)" : "minmax(0, 1fr) auto",
                            gap: "7px",
                            alignItems: "center",
                          }}
                        >
                        <input
                          value={organizerBulkImportConfirmation}
                          onChange={(event) => setOrganizerBulkImportConfirmation(event.target.value)}
                          placeholder={DOCUMENTS_ORGANIZER_IMPORT_CONFIRMATION}
                          disabled={organizerImportBusy}
                          data-testid="streetbot-documents-organizer-bulk-import-confirmation"
                          style={{
                            minWidth: 0,
                            height: "30px",
                            borderRadius: "8px",
                            border: `1px solid ${colors.border}`,
                            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.78)",
                            color: colors.text,
                            padding: "0 9px",
                            fontSize: "0.76rem",
                            outline: "none",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => void importSelectedOrganizerFiles()}
                          disabled={
                            organizerImportBusy ||
                            !organizerBulkImportReady
                          }
                          data-testid="streetbot-documents-organizer-bulk-import"
                          style={{
                            height: "30px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "7px",
                            borderRadius: "8px",
                            border: `1px solid ${colors.border}`,
                            background: organizerBulkImportReady
                              ? colors.accent
                              : "transparent",
                            color: organizerBulkImportReady
                              ? "#000"
                              : colors.textMuted,
                            padding: "0 10px",
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            cursor: organizerImportBusy || !organizerBulkImportReady
                              ? "not-allowed"
                              : "pointer",
                            whiteSpace: "nowrap",
                            justifyContent: "center",
                          }}
                        >
                          {organizerBulkImporting
                            ? <Loader2 size={13} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                            : <Upload size={13} />}
                          Import selected
                        </button>
                      </div>
                      </>
                    )}
                    {organizerBulkImporting && organizerBulkImportProgress.total > 0 && (
                      <div style={{ color: colors.textMuted, fontSize: "0.7rem", fontWeight: 700 }}>
                        {organizerBulkImportProgress.completed.toLocaleString()} / {organizerBulkImportProgress.total.toLocaleString()} imported
                      </div>
                    )}
                    {organizerBulkImportResults.length > 0 && !organizerBulkImporting && (
                      <div style={{ color: colors.textMuted, fontSize: "0.7rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {organizerBulkImportResults.filter(result => result.status === "imported").length.toLocaleString()} imported, {organizerBulkImportResults.filter(result => result.status === "failed").length.toLocaleString()} failed, {organizerBulkImportResults.filter(result => result.status === "skipped").length.toLocaleString()} skipped
                      </div>
                    )}
                  </div>
                  {organizerFilesError && (
                    <div style={{ marginBottom: "6px", color: "#dc2626", fontSize: "0.76rem", fontWeight: 700 }}>
                      {organizerFilesError}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {organizerVisibleFiles.map(file => {
                      const isOrganizerFileImporting = organizerImportingFileId === file.id;
                      const importDisabled = organizerImportBusy;
                      const isOrganizerFileSelected = organizerSelectedFileIds.has(file.id);
                      return (
                      <div
                        key={file.id}
                        title={file.display_path}
                        style={{
                          minHeight: "36px",
                          display: "grid",
                          gridTemplateColumns: documentsVeryCompact ? "auto minmax(0, 1fr) auto" : "auto minmax(0, 1fr) auto auto",
                          alignItems: "center",
                          gap: "8px",
                          borderRadius: "8px",
                          border: `1px solid ${colors.border}`,
                          padding: "7px 9px",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isOrganizerFileSelected}
                          onChange={(event) => toggleOrganizerFileSelection(file.id, event.currentTarget.checked)}
                          disabled={organizerImportBusy}
                          aria-label={`Select ${file.filename}`}
                          style={{
                            width: "16px",
                            height: "16px",
                            margin: 0,
                            accentColor: colors.accent,
                            cursor: organizerImportBusy ? "not-allowed" : "pointer",
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: colors.text, fontSize: "0.78rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {file.filename}
                          </div>
                          <div style={{ color: colors.textMuted, fontSize: "0.7rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {file.folder_name} / {file.display_path}
                          </div>
                        </div>
                        {!documentsVeryCompact && (
                          <span style={{ color: colors.textMuted, fontSize: "0.72rem", fontWeight: 700 }}>
                            {formatBytes(file.size_bytes)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => void importOrganizerFile(file)}
                          disabled={importDisabled}
                          title="Import with Docling"
                          aria-label={`Import ${file.filename} with Docling`}
                          data-testid={`streetbot-documents-organizer-import-${file.id}`}
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "8px",
                            border: `1px solid ${colors.border}`,
                            background: isOrganizerFileImporting
                              ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)")
                              : "transparent",
                            color: isOrganizerFileImporting ? colors.accent : colors.textMuted,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: importDisabled ? "not-allowed" : "pointer",
                            opacity: importDisabled && !isOrganizerFileImporting ? 0.46 : 1,
                          }}
                        >
                          {isOrganizerFileImporting
                            ? <Loader2 size={13} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                            : <Upload size={13} />}
                        </button>
                      </div>
                    );})}
                    {!organizerFilesLoading && !organizerLoading && !organizerVisibleFiles.length && (
                      <div style={{ color: colors.textMuted, fontSize: "0.78rem", padding: "8px 0" }}>
                        No local files indexed yet.
                      </div>
                    )}
                    {organizerFiles && organizerFiles.total_count > organizerVisibleFiles.length && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                          color: colors.textMuted,
                          fontSize: "0.7rem",
                          fontWeight: 650,
                          padding: "2px 0",
                        }}
                      >
                        <span>
                          {(organizerFiles.total_count - organizerVisibleFiles.length).toLocaleString()} more indexed files match this view
                        </span>
                        <button
                          type="button"
                          onClick={() => void loadMoreOrganizerFiles()}
                          disabled={organizerFilesLoading || !organizerFilesHasMore}
                          data-testid="streetbot-documents-organizer-load-more"
                          style={{
                            height: "26px",
                            borderRadius: "8px",
                            border: `1px solid ${colors.border}`,
                            background: "transparent",
                            color: colors.text,
                            padding: "0 8px",
                            fontSize: "0.68rem",
                            fontWeight: 800,
                            cursor: organizerFilesLoading || !organizerFilesHasMore ? "not-allowed" : "pointer",
                            whiteSpace: "nowrap",
                            opacity: organizerFilesLoading || !organizerFilesHasMore ? 0.56 : 1,
                          }}
                        >
                          {organizerFilesLoading ? "Loading" : "Load more"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Document area */}
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: documentsVeryCompact ? "10px" : "16px" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px", gap: "10px", color: colors.textMuted }}>
              <Loader2 size={20} className="spin" style={{ animation: "spin 1s linear infinite" }} />
              Loading documents...
            </div>
          ) : error ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "200px", gap: "8px", color: colors.textMuted }}>
              <span>{error}</span>
              <button onClick={loadDocuments} style={{ padding: "6px 16px", borderRadius: "6px", background: colors.accent, color: "#000", border: "none", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>
                Retry
              </button>
            </div>
          ) : displayDocs.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "300px", gap: "12px" }}>
              <FileText size={48} color={colors.textMuted} style={{ opacity: 0.3 }} />
              <span style={{ color: colors.textMuted, fontSize: "0.9rem" }}>
                {searchQuery ? "No documents match your search" : "No documents yet"}
              </span>
              <button
                onClick={() => setShowCreateDoc(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 20px",
                  borderRadius: "8px",
                  background: colors.accent,
                  color: "#000",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              >
                <Plus size={16} />
                Create Document
              </button>
            </div>
          ) : viewMode === "grid" ? (
            /* ── Grid View ── */
            <div
              style={{
                display: "grid",
                gridTemplateColumns: documentsVeryCompact
                  ? "minmax(0, 1fr)"
                  : "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              {displayDocs.map(doc => {
                const Icon = getDocIcon(doc.document_type);
                const iconColor = getDocColor(doc.document_type);
                const badge = STATUS_BADGES[doc.status] || STATUS_BADGES.draft;
                return (
                  <div
                    key={doc.id}
                    onClick={() => openDocument(doc)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({ doc, x: e.clientX, y: e.clientY });
                    }}
                    style={{
                      borderRadius: "12px",
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
                      border: `1px solid ${colors.border}`,
                      cursor: "pointer",
                      transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
                      overflow: "hidden",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.borderColor = `${iconColor}60`;
                      e.currentTarget.style.boxShadow = `0 8px 24px ${isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.08)"}`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "none";
                      e.currentTarget.style.borderColor = colors.border;
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {/* Colored header strip */}
                    <div
                      style={{
                        height: "80px",
                        background: `linear-gradient(135deg, ${iconColor}15, ${iconColor}08)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                      }}
                    >
                      <Icon size={32} color={iconColor} style={{ opacity: 0.6 }} />
                      {/* Favorite star */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(doc);
                        }}
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          width: "26px",
                          height: "26px",
                          borderRadius: "6px",
                          background: doc.is_favorite ? `${colors.accent}20` : "rgba(0,0,0,0.2)",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: doc.is_favorite ? colors.accent : "rgba(255,255,255,0.6)",
                        }}
                      >
                        <Star size={13} fill={doc.is_favorite ? colors.accent : "none"} />
                      </button>
                      {/* Lock indicator */}
                      {doc.is_locked && (
                        <Lock
                          size={12}
                          style={{
                            position: "absolute",
                            top: "10px",
                            left: "10px",
                            color: "#f59e0b",
                          }}
                        />
                      )}
                    </div>

                    {/* Card body */}
                    <div style={{ padding: "12px" }}>
                      <div style={{ fontSize: "0.88rem", fontWeight: 600, color: colors.text, marginBottom: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {doc.title}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "10px",
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            background: `${badge.color}18`,
                            color: badge.color,
                          }}
                        >
                          {badge.label}
                        </span>
                        {doc.word_count > 0 && (
                          <span style={{ fontSize: "0.7rem", color: colors.textMuted }}>
                            {doc.word_count.toLocaleString()} words
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.72rem", color: colors.textMuted }}>
                          {timeAgo(doc.updated_at)}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <CrossLink
                            icon={MessageSquare}
                            label=""
                            to={`/messages?share_doc=${encodeURIComponent(doc.id)}&doc_title=${encodeURIComponent(doc.title)}`}
                            variant="icon-only"
                            color="#FFD600"
                            title="Share via Message"
                          />
                          {doc.share_count > 0 && (
                            <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "0.7rem", color: colors.textMuted }}>
                              <Users size={11} /> {doc.share_count}
                            </span>
                          )}
                          {doc.comment_count > 0 && (
                            <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "0.7rem", color: colors.textMuted }}>
                              <Edit3 size={11} /> {doc.comment_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── List View ── */
            <div
              style={{
                borderRadius: "12px",
                background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.6)",
                border: `1px solid ${colors.border}`,
                overflowX: "auto",
                overflowY: "hidden",
              }}
            >
              {/* List header */}
              <div
                style={{
                  minWidth: documentsVeryCompact ? "520px" : undefined,
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 100px 100px 40px",
                  padding: "10px 16px",
                  borderBottom: `1px solid ${colors.border}`,
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: colors.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <span>Name</span>
                <span>Status</span>
                <span>Modified</span>
                <span>Words</span>
                <span />
              </div>
              {displayDocs.map(doc => {
                const Icon = getDocIcon(doc.document_type);
                const iconColor = getDocColor(doc.document_type);
                const badge = STATUS_BADGES[doc.status] || STATUS_BADGES.draft;
                return (
                  <div
                    key={doc.id}
                    onClick={() => openDocument(doc)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({ doc, x: e.clientX, y: e.clientY });
                    }}
                    style={{
                      minWidth: documentsVeryCompact ? "520px" : undefined,
                      display: "grid",
                      gridTemplateColumns: "1fr 100px 100px 100px 40px",
                      padding: "10px 16px",
                      alignItems: "center",
                      borderBottom: `1px solid ${colors.border}20`,
                      cursor: "pointer",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                      <Icon size={18} color={iconColor} />
                      <span style={{ fontSize: "0.85rem", fontWeight: 500, color: colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {doc.title}
                      </span>
                      {doc.is_favorite && <Star size={12} color={colors.accent} fill={colors.accent} />}
                      {doc.is_locked && <Lock size={12} color="#f59e0b" />}
                    </div>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "10px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        background: `${badge.color}18`,
                        color: badge.color,
                        width: "fit-content",
                      }}
                    >
                      {badge.label}
                    </span>
                    <span style={{ fontSize: "0.78rem", color: colors.textMuted }}>{timeAgo(doc.updated_at)}</span>
                    <span style={{ fontSize: "0.78rem", color: colors.textMuted }}>{doc.word_count > 0 ? doc.word_count.toLocaleString() : "—"}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setContextMenu({ doc, x: rect.left, y: rect.bottom });
                      }}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: colors.textMuted,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ── Context Menu ── */}
      {contextMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            minWidth: "180px",
            background: isDark ? "rgba(30,30,40,0.95)" : "rgba(255,255,255,0.95)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: `1px solid ${colors.border}`,
            borderRadius: "10px",
            boxShadow: isDark ? "0 12px 40px rgba(0,0,0,0.5)" : "0 12px 40px rgba(0,0,0,0.15)",
            zIndex: 1000,
            overflow: "hidden",
            padding: "4px 0",
          }}
        >
          {[
            { icon: Eye, label: "Open", action: () => { openDocument(contextMenu.doc); setContextMenu(null); } },
            { icon: Edit3, label: "Rename", action: () => setContextMenu(null) },
            { icon: Star, label: contextMenu.doc.is_favorite ? "Unfavorite" : "Favorite", action: () => { toggleFavorite(contextMenu.doc); setContextMenu(null); } },
            { icon: Share2, label: "Share", action: () => setContextMenu(null) },
            { icon: Download, label: "Export", action: () => setContextMenu(null) },
            { icon: History, label: "Version History", action: () => { void openVersionHistory(contextMenu.doc); setContextMenu(null); } },
            null, // divider
            { icon: Trash2, label: "Delete", action: () => deleteDocument(contextMenu.doc), danger: true },
          ].map((item, i) =>
            item === null ? (
              <div key={`div-${i}`} style={{ height: "1px", background: colors.border, margin: "4px 0" }} />
            ) : (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "9px 14px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: (item as any).danger ? "#ef4444" : colors.text,
                  fontSize: "0.83rem",
                  textAlign: "left",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = (item as any).danger ? "rgba(239,68,68,0.1)" : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)")}
                onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                <item.icon size={15} />
                {item.label}
              </button>
            )
          )}
        </div>
      )}

      {versionHistoryPanel}
      {retentionDashboardPanel}

      {/* ── Create Document Modal ── */}
      {showCreateDoc && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => setShowCreateDoc(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(680px, calc(100vw - 32px))",
              maxHeight: "88vh",
              overflowY: "auto",
              background: isDark ? "rgba(30,30,40,0.95)" : "rgba(255,255,255,0.97)",
              backdropFilter: "blur(24px)",
              border: `1px solid ${colors.border}`,
              borderRadius: "16px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
              padding: "24px",
            }}
          >
            <h3 style={{ margin: "0 0 20px", fontSize: "1.1rem", fontWeight: 700, color: colors.text }}>
              New Document
            </h3>

            <input
              type="text"
              placeholder={createDocumentTitle}
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createDocument();
                if (e.key === "Escape") setShowCreateDoc(false);
              }}
              autoFocus
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                border: `1px solid ${colors.border}`,
                color: colors.text,
                fontSize: "0.9rem",
                fontFamily: "'Rubik', sans-serif",
                outline: "none",
                marginBottom: "16px",
                boxSizing: "border-box",
              }}
            />

            {/* Type selector */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              {[
                { type: "document" as const, icon: FileText, label: "Document", color: "#3b82f6" },
                { type: "spreadsheet" as const, icon: FileSpreadsheet, label: "Spreadsheet", color: "#22c55e" },
                { type: "presentation" as const, icon: Presentation, label: "Slides", color: "#f59e0b" },
              ].map(({ type, icon: TypeIcon, label, color }) => (
                <button
                  key={type}
                  onClick={() => {
                    const previousDefault =
                      newDocType === "document" ? selectedTemplate.suggestedTitle : defaultTitleForDocumentType(newDocType);
                    const nextDefault =
                      type === "document" ? selectedTemplate.suggestedTitle : defaultTitleForDocumentType(type);
                    setNewDocType(type);
                    setNewDocTitle(currentTitle => {
                      const trimmedTitle = currentTitle.trim();
                      if (!trimmedTitle || trimmedTitle === previousDefault) return nextDefault;
                      return currentTitle;
                    });
                  }}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                    padding: "14px 8px",
                    borderRadius: "10px",
                    background: newDocType === type ? `${color}15` : "transparent",
                    border: `2px solid ${newDocType === type ? color : colors.border}`,
                    cursor: "pointer",
                    color: newDocType === type ? color : colors.textMuted,
                    transition: "all 0.15s",
                  }}
                >
                  <TypeIcon size={22} />
                  <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>{label}</span>
                </button>
              ))}
            </div>

            {newDocType === "document" && (
              <div style={{ marginBottom: "20px" }}>
                <div
                  style={{
                    marginBottom: "8px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: colors.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: 0,
                  }}
                >
                  Template
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                    gap: "8px",
                  }}
                >
                  {BUILT_IN_DOCUMENT_TEMPLATES.map(template => {
                    const isSelected = selectedTemplateId === template.id;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        aria-label={`Use ${template.title} template`}
                        aria-pressed={isSelected}
                        onClick={() => chooseDocumentTemplate(template)}
                        style={{
                          minHeight: "104px",
                          padding: "12px",
                          borderRadius: "8px",
                          border: `1px solid ${isSelected ? colors.accent : colors.border}`,
                          background: isSelected
                            ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)")
                            : "transparent",
                          cursor: "pointer",
                          textAlign: "left",
                          color: colors.text,
                          transition: "border-color 0.15s, background 0.15s",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            marginBottom: "5px",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            color: isSelected ? colors.accent : colors.textMuted,
                            textTransform: "uppercase",
                            letterSpacing: 0,
                          }}
                        >
                          {template.category}
                        </span>
                        <span
                          style={{
                            display: "block",
                            marginBottom: "5px",
                            fontSize: "0.9rem",
                            fontWeight: 700,
                            color: colors.text,
                          }}
                        >
                          {template.title}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.78rem",
                            lineHeight: 1.35,
                            color: colors.textMuted,
                          }}
                        >
                          {template.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCreateDoc(false)}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  background: "transparent",
                  border: `1px solid ${colors.border}`,
                  cursor: "pointer",
                  color: colors.textMuted,
                  fontSize: "0.85rem",
                }}
              >
                Cancel
              </button>
              <button
                onClick={createDocument}
                disabled={!createDocumentTitle.trim()}
                style={{
                  padding: "9px 24px",
                  borderRadius: "8px",
                  background: createDocumentTitle.trim() ? colors.accent : `${colors.accent}40`,
                  border: "none",
                  cursor: createDocumentTitle.trim() ? "pointer" : "default",
                  color: "#000",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Folder Modal ── */}
      {showCreateFolder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => setShowCreateFolder(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "360px",
              background: isDark ? "rgba(30,30,40,0.95)" : "rgba(255,255,255,0.97)",
              backdropFilter: "blur(24px)",
              border: `1px solid ${colors.border}`,
              borderRadius: "16px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
              padding: "24px",
            }}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: "1.05rem", fontWeight: 700, color: colors.text }}>
              New Folder
            </h3>
            <input
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createFolder();
                if (e.key === "Escape") setShowCreateFolder(false);
              }}
              autoFocus
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                border: `1px solid ${colors.border}`,
                color: colors.text,
                fontSize: "0.9rem",
                fontFamily: "'Rubik', sans-serif",
                outline: "none",
                marginBottom: "16px",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCreateFolder(false)}
                style={{ padding: "9px 18px", borderRadius: "8px", background: "transparent", border: `1px solid ${colors.border}`, cursor: "pointer", color: colors.textMuted, fontSize: "0.85rem" }}
              >
                Cancel
              </button>
              <button
                onClick={createFolder}
                disabled={!newFolderName.trim()}
                style={{ padding: "9px 24px", borderRadius: "8px", background: newFolderName.trim() ? colors.accent : `${colors.accent}40`, border: "none", cursor: newFolderName.trim() ? "pointer" : "default", color: "#000", fontSize: "0.85rem", fontWeight: 600 }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spinner keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default DocumentsPage;
export { DocumentsPage };

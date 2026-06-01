const crypto = require('crypto');
const { logger } = require('@librechat/data-schemas');
const {
  countDueDocumentsVersionRetentionExportJobs,
  countDueDocumentsVersionRetentionReminderNotifications,
  dispatchDocumentsVersionRetentionExportJobs,
  retryDocumentsVersionRetentionEvidenceReminderNotifications,
} = require('~/models/DocumentsVersionSnapshot');

const DOCUMENTS_RETENTION_EXPORT_WORKER_NAME = 'documents-retention-export';
const DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_NAME = 'documents-retention-reminder-notification';
const DEFAULT_DOCUMENTS_RETENTION_EXPORT_WORKER_INTERVAL_MS = 15 * 60 * 1000;
const MIN_DOCUMENTS_RETENTION_EXPORT_WORKER_INTERVAL_MS = 60 * 1000;
const DEFAULT_DOCUMENTS_RETENTION_EXPORT_WORKER_BATCH_LIMIT = 10;
const MAX_DOCUMENTS_RETENTION_EXPORT_WORKER_BATCH_LIMIT = 50;
const DEFAULT_DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_INTERVAL_MS = 15 * 60 * 1000;
const MIN_DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_INTERVAL_MS = 60 * 1000;
const DEFAULT_DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_BATCH_LIMIT = 10;
const MAX_DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_BATCH_LIMIT = 50;

let documentsRetentionExportWorkerScheduled = false;
let documentsRetentionExportWorkerRunning = false;
let documentsRetentionExportWorkerInterval = null;
let documentsRetentionExportWorkerFirstRun = null;
let documentsRetentionExportWorkerLastRun = null;
let documentsRetentionReminderNotificationWorkerScheduled = false;
let documentsRetentionReminderNotificationWorkerRunning = false;
let documentsRetentionReminderNotificationWorkerInterval = null;
let documentsRetentionReminderNotificationWorkerFirstRun = null;
let documentsRetentionReminderNotificationWorkerLastRun = null;
let documentsRetentionExportWorkerRuntime = {
  scheduled_at: null,
  stopped_at: null,
  heartbeat_at: null,
  next_run_at: null,
  last_started_at: null,
  last_completed_at: null,
  run_count: 0,
  completed_count: 0,
  failed_count: 0,
  skipped_count: 0,
  consecutive_failure_count: 0,
  last_duration_ms: 0,
  max_duration_ms: 0,
};
let documentsRetentionReminderNotificationWorkerRuntime = {
  scheduled_at: null,
  stopped_at: null,
  heartbeat_at: null,
  next_run_at: null,
  last_started_at: null,
  last_completed_at: null,
  run_count: 0,
  completed_count: 0,
  failed_count: 0,
  skipped_count: 0,
  consecutive_failure_count: 0,
  last_duration_ms: 0,
  max_duration_ms: 0,
};

function asDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function asPositiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? Math.min(number, maximum) : fallback;
}

function isEnvEnabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function isoNow(value = new Date()) {
  const date = asDate(value) || new Date();
  return date.toISOString();
}

function getDocumentsRetentionExportWorkerIntervalMs() {
  return Math.max(
    MIN_DOCUMENTS_RETENTION_EXPORT_WORKER_INTERVAL_MS,
    Number(process.env.DOCUMENTS_RETENTION_EXPORT_WORKER_INTERVAL_MS) ||
      DEFAULT_DOCUMENTS_RETENTION_EXPORT_WORKER_INTERVAL_MS,
  );
}

function getDocumentsRetentionExportWorkerBatchLimit(value = process.env.DOCUMENTS_RETENTION_EXPORT_WORKER_BATCH_LIMIT) {
  return asPositiveInteger(
    value,
    DEFAULT_DOCUMENTS_RETENTION_EXPORT_WORKER_BATCH_LIMIT,
    MAX_DOCUMENTS_RETENTION_EXPORT_WORKER_BATCH_LIMIT,
  );
}

function getDocumentsRetentionReminderNotificationWorkerIntervalMs() {
  return Math.max(
    MIN_DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_INTERVAL_MS,
    Number(process.env.DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_INTERVAL_MS) ||
      DEFAULT_DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_INTERVAL_MS,
  );
}

function getDocumentsRetentionReminderNotificationWorkerBatchLimit(
  value = process.env.DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_BATCH_LIMIT,
) {
  return asPositiveInteger(
    value,
    DEFAULT_DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_BATCH_LIMIT,
    MAX_DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_BATCH_LIMIT,
  );
}

function formatDurationMinutes(durationMs) {
  const minutes = Math.max(1, Math.round((Number(durationMs) || 0) / (60 * 1000)));
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

function summarizeWorkerRun(run) {
  if (!run) {
    return null;
  }

  return {
    run_id: run.run_id,
    status: run.status,
    source: run.source,
    started_at: run.started_at,
    completed_at: run.completed_at,
    attempted_count: run.attempted_count,
    dispatched_count: run.dispatched_count,
    failed_count: run.failed_count,
    duration_ms: run.duration_ms || 0,
    skipped: run.skipped === true,
    message: run.message || '',
  };
}

function summarizeWorkerObservability({ now = new Date(), environment } = {}) {
  const normalizedNow = asDate(now) || new Date();
  const nextRunAt = asDate(documentsRetentionExportWorkerRuntime.next_run_at);
  const nextRunInMs = nextRunAt ? Math.max(0, nextRunAt.getTime() - normalizedNow.getTime()) : null;
  const schedulerLagMs =
    documentsRetentionExportWorkerScheduled && nextRunAt && nextRunAt.getTime() < normalizedNow.getTime()
      ? normalizedNow.getTime() - nextRunAt.getTime()
      : 0;
  const consecutiveFailures = documentsRetentionExportWorkerRuntime.consecutive_failure_count;
  const health = documentsRetentionExportWorkerRunning
    ? 'running'
    : consecutiveFailures > 0
      ? 'degraded'
      : environment?.scheduler_enabled
        ? 'healthy'
        : 'manual';

  return {
    type: 'documents_retention_export_worker_observability',
    health,
    heartbeat_at: documentsRetentionExportWorkerRuntime.heartbeat_at,
    scheduled_at: documentsRetentionExportWorkerRuntime.scheduled_at,
    stopped_at: documentsRetentionExportWorkerRuntime.stopped_at,
    next_run_at: documentsRetentionExportWorkerRuntime.next_run_at,
    next_run_in_ms: nextRunInMs,
    scheduler_lag_ms: schedulerLagMs,
    last_started_at: documentsRetentionExportWorkerRuntime.last_started_at,
    last_completed_at: documentsRetentionExportWorkerRuntime.last_completed_at,
    run_count: documentsRetentionExportWorkerRuntime.run_count,
    completed_count: documentsRetentionExportWorkerRuntime.completed_count,
    failed_count: documentsRetentionExportWorkerRuntime.failed_count,
    skipped_count: documentsRetentionExportWorkerRuntime.skipped_count,
    consecutive_failure_count: consecutiveFailures,
    last_duration_ms: documentsRetentionExportWorkerRuntime.last_duration_ms,
    max_duration_ms: documentsRetentionExportWorkerRuntime.max_duration_ms,
    summary: health === 'manual'
      ? 'The scheduler is disabled; manual dispatch remains available.'
      : health === 'degraded'
        ? 'The worker has recent failures and needs operator review.'
        : health === 'running'
          ? 'The worker is currently dispatching due content-free export jobs.'
          : 'The worker scheduler is healthy.',
  };
}

function getDocumentsRetentionExportWorkerEnvironment() {
  const schedulerEnabled = isEnvEnabled(process.env.DOCUMENTS_RETENTION_EXPORT_WORKER_ENABLED);
  const intervalMs = getDocumentsRetentionExportWorkerIntervalMs();
  const batchLimit = getDocumentsRetentionExportWorkerBatchLimit();

  return {
    type: 'documents_retention_export_worker_environment',
    worker: DOCUMENTS_RETENTION_EXPORT_WORKER_NAME,
    scheduler_enabled: schedulerEnabled,
    scheduler_status: schedulerEnabled ? 'enabled' : 'disabled',
    interval_ms: intervalMs,
    interval_label: formatDurationMinutes(intervalMs),
    batch_limit: batchLimit,
    mode: schedulerEnabled ? 'interval-dispatch' : 'manual-dispatch-only',
    payload_content_free: true,
    summary: schedulerEnabled
      ? 'The documents retention export worker is enabled and can dispatch due content-free export jobs on an interval.'
      : 'The documents retention export worker interval is disabled. Admin manual dispatch remains available.',
    safeguards: [
      schedulerEnabled
        ? 'Server interval can wake due documents retention export jobs.'
        : 'Server interval is off until DOCUMENTS_RETENTION_EXPORT_WORKER_ENABLED=true.',
      'Worker dispatch only emits content-free delivery manifests.',
      'The worker does not prune snapshots or perform destructive retention actions.',
      'Failed jobs stay in the ledger with retry backoff metadata.',
    ],
  };
}

function summarizeReminderNotificationWorkerRun(run) {
  if (!run) {
    return null;
  }

  return {
    run_id: run.run_id,
    status: run.status,
    source: run.source,
    started_at: run.started_at,
    completed_at: run.completed_at,
    attempted_count: run.attempted_count,
    retried_count: run.retried_count,
    failed_count: run.failed_count,
    duration_ms: run.duration_ms || 0,
    skipped: run.skipped === true,
    message: run.message || '',
  };
}

function summarizeReminderNotificationWorkerObservability({ now = new Date(), environment } = {}) {
  const normalizedNow = asDate(now) || new Date();
  const nextRunAt = asDate(documentsRetentionReminderNotificationWorkerRuntime.next_run_at);
  const nextRunInMs = nextRunAt ? Math.max(0, nextRunAt.getTime() - normalizedNow.getTime()) : null;
  const schedulerLagMs =
    documentsRetentionReminderNotificationWorkerScheduled && nextRunAt && nextRunAt.getTime() < normalizedNow.getTime()
      ? normalizedNow.getTime() - nextRunAt.getTime()
      : 0;
  const consecutiveFailures = documentsRetentionReminderNotificationWorkerRuntime.consecutive_failure_count;
  const health = documentsRetentionReminderNotificationWorkerRunning
    ? 'running'
    : consecutiveFailures > 0
      ? 'degraded'
      : environment?.scheduler_enabled
        ? 'healthy'
        : 'manual';

  return {
    type: 'documents_retention_reminder_notification_worker_observability',
    health,
    heartbeat_at: documentsRetentionReminderNotificationWorkerRuntime.heartbeat_at,
    scheduled_at: documentsRetentionReminderNotificationWorkerRuntime.scheduled_at,
    stopped_at: documentsRetentionReminderNotificationWorkerRuntime.stopped_at,
    next_run_at: documentsRetentionReminderNotificationWorkerRuntime.next_run_at,
    next_run_in_ms: nextRunInMs,
    scheduler_lag_ms: schedulerLagMs,
    last_started_at: documentsRetentionReminderNotificationWorkerRuntime.last_started_at,
    last_completed_at: documentsRetentionReminderNotificationWorkerRuntime.last_completed_at,
    run_count: documentsRetentionReminderNotificationWorkerRuntime.run_count,
    completed_count: documentsRetentionReminderNotificationWorkerRuntime.completed_count,
    failed_count: documentsRetentionReminderNotificationWorkerRuntime.failed_count,
    skipped_count: documentsRetentionReminderNotificationWorkerRuntime.skipped_count,
    consecutive_failure_count: consecutiveFailures,
    last_duration_ms: documentsRetentionReminderNotificationWorkerRuntime.last_duration_ms,
    max_duration_ms: documentsRetentionReminderNotificationWorkerRuntime.max_duration_ms,
    summary: health === 'manual'
      ? 'The reminder retry scheduler is disabled; admin retry remains available.'
      : health === 'degraded'
        ? 'The reminder retry worker has recent failures and needs operator review.'
        : health === 'running'
          ? 'The worker is currently retrying failed content-free reminder notifications.'
          : 'The reminder retry scheduler is healthy.',
  };
}

function getDocumentsRetentionReminderNotificationWorkerEnvironment() {
  const schedulerEnabled = isEnvEnabled(process.env.DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_ENABLED);
  const intervalMs = getDocumentsRetentionReminderNotificationWorkerIntervalMs();
  const batchLimit = getDocumentsRetentionReminderNotificationWorkerBatchLimit();

  return {
    type: 'documents_retention_reminder_notification_worker_environment',
    worker: DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_NAME,
    scheduler_enabled: schedulerEnabled,
    scheduler_status: schedulerEnabled ? 'enabled' : 'disabled',
    interval_ms: intervalMs,
    interval_label: formatDurationMinutes(intervalMs),
    batch_limit: batchLimit,
    mode: schedulerEnabled ? 'interval-retry' : 'manual-retry-only',
    payload_content_free: true,
    summary: schedulerEnabled
      ? 'The evidence reminder notification retry worker is enabled and can retry due failed webhook notifications on an interval.'
      : 'The evidence reminder notification retry interval is disabled. Admin manual retry remains available.',
    safeguards: [
      schedulerEnabled
        ? 'Server interval can wake due failed evidence reminder notification retries.'
        : 'Server interval is off until DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_ENABLED=true.',
      'Worker retry payloads carry notification ids, hashes, timestamps, and statuses only.',
      'The worker does not read document body content or perform destructive retention actions.',
      'Failed webhook notifications stay in the ledger with retry backoff metadata.',
    ],
  };
}

async function getDocumentsRetentionExportWorkerStatus({ now = new Date() } = {}) {
  const normalizedNow = asDate(now) || new Date();
  const environment = getDocumentsRetentionExportWorkerEnvironment();
  const dueJobCount = await countDueDocumentsVersionRetentionExportJobs({ now: normalizedNow });
  const lastRun = summarizeWorkerRun(documentsRetentionExportWorkerLastRun);
  const observability = summarizeWorkerObservability({ now: normalizedNow, environment });

  return {
    ...environment,
    type: 'documents_retention_export_worker_status',
    scheduled: documentsRetentionExportWorkerScheduled,
    running: documentsRetentionExportWorkerRunning,
    due_job_count: dueJobCount,
    observability,
    health: observability.health,
    next_run_at: observability.next_run_at,
    last_run: lastRun,
    last_run_at: lastRun?.completed_at || lastRun?.started_at || null,
    last_run_status: lastRun?.status || null,
    last_run_message: lastRun?.message || '',
  };
}

async function getDocumentsRetentionReminderNotificationWorkerStatus({ now = new Date() } = {}) {
  const normalizedNow = asDate(now) || new Date();
  const environment = getDocumentsRetentionReminderNotificationWorkerEnvironment();
  const dueNotificationCount = await countDueDocumentsVersionRetentionReminderNotifications({ now: normalizedNow });
  const lastRun = summarizeReminderNotificationWorkerRun(documentsRetentionReminderNotificationWorkerLastRun);
  const observability = summarizeReminderNotificationWorkerObservability({ now: normalizedNow, environment });

  return {
    ...environment,
    type: 'documents_retention_reminder_notification_worker_status',
    scheduled: documentsRetentionReminderNotificationWorkerScheduled,
    running: documentsRetentionReminderNotificationWorkerRunning,
    due_notification_count: dueNotificationCount,
    due_job_count: dueNotificationCount,
    observability,
    health: observability.health,
    next_run_at: observability.next_run_at,
    last_run: lastRun,
    last_run_at: lastRun?.completed_at || lastRun?.started_at || null,
    last_run_status: lastRun?.status || null,
    last_run_message: lastRun?.message || '',
  };
}

async function runDocumentsRetentionExportWorkerPass({
  now = new Date(),
  limit,
  source = 'manual',
} = {}) {
  const normalizedNow = asDate(now) || new Date();
  const startedAt = normalizedNow.toISOString();
  const startedMs = Date.now();
  const batchLimit = getDocumentsRetentionExportWorkerBatchLimit(limit);
  const environment = getDocumentsRetentionExportWorkerEnvironment();
  const baseRun = {
    type: 'documents_retention_export_worker_run',
    run_id: `documents-retention-worker-${crypto.randomUUID()}`,
    mode: 'content-free-export-dispatch',
    worker: DOCUMENTS_RETENTION_EXPORT_WORKER_NAME,
    scheduler_enabled: environment.scheduler_enabled,
    source,
    started_at: startedAt,
    batch_limit: batchLimit,
    payload_content_free: true,
    policy: 'This worker dispatches due content-free retention export jobs only. It does not prune snapshots.',
  };

  if (documentsRetentionExportWorkerRunning) {
    const completedAt = isoNow();
    documentsRetentionExportWorkerRuntime.skipped_count += 1;
    documentsRetentionExportWorkerRuntime.heartbeat_at = completedAt;
    documentsRetentionExportWorkerRuntime.last_completed_at = completedAt;
    const skippedRun = {
      ...baseRun,
      status: 'skipped',
      skipped: true,
      completed_at: completedAt,
      attempted_count: 0,
      dispatched_count: 0,
      failed_count: 0,
      duration_ms: 0,
      message: 'A documents retention export worker pass is already running.',
    };
    documentsRetentionExportWorkerLastRun = skippedRun;
    return skippedRun;
  }

  documentsRetentionExportWorkerRunning = true;
  documentsRetentionExportWorkerRuntime.run_count += 1;
  documentsRetentionExportWorkerRuntime.heartbeat_at = startedAt;
  documentsRetentionExportWorkerRuntime.last_started_at = startedAt;
  try {
    const dispatch = await dispatchDocumentsVersionRetentionExportJobs({
      now: normalizedNow,
      limit: batchLimit,
    });
    const completedAt = isoNow();
    const durationMs = Math.max(0, Date.now() - startedMs);
    documentsRetentionExportWorkerRuntime.heartbeat_at = completedAt;
    documentsRetentionExportWorkerRuntime.last_completed_at = completedAt;
    documentsRetentionExportWorkerRuntime.last_duration_ms = durationMs;
    documentsRetentionExportWorkerRuntime.max_duration_ms = Math.max(
      documentsRetentionExportWorkerRuntime.max_duration_ms,
      durationMs,
    );
    if (dispatch.failed_count > 0) {
      documentsRetentionExportWorkerRuntime.failed_count += 1;
      documentsRetentionExportWorkerRuntime.consecutive_failure_count += 1;
    } else {
      documentsRetentionExportWorkerRuntime.completed_count += 1;
      documentsRetentionExportWorkerRuntime.consecutive_failure_count = 0;
    }
    const completedRun = {
      ...baseRun,
      status: dispatch.failed_count > 0 ? 'completed_with_failures' : 'completed',
      skipped: false,
      completed_at: completedAt,
      attempted_count: dispatch.attempted_count,
      dispatched_count: dispatch.dispatched_count,
      failed_count: dispatch.failed_count,
      deliveries_count: Array.isArray(dispatch.deliveries) ? dispatch.deliveries.length : 0,
      manifests_count: Array.isArray(dispatch.manifests) ? dispatch.manifests.length : 0,
      duration_ms: durationMs,
      message: dispatch.attempted_count > 0
        ? `${dispatch.dispatched_count} delivered / ${dispatch.failed_count} failed.`
        : 'No due retention export jobs.',
      dispatch,
    };
    documentsRetentionExportWorkerLastRun = completedRun;
    return completedRun;
  } catch (error) {
    const completedAt = isoNow();
    const durationMs = Math.max(0, Date.now() - startedMs);
    documentsRetentionExportWorkerRuntime.heartbeat_at = completedAt;
    documentsRetentionExportWorkerRuntime.last_completed_at = completedAt;
    documentsRetentionExportWorkerRuntime.last_duration_ms = durationMs;
    documentsRetentionExportWorkerRuntime.max_duration_ms = Math.max(
      documentsRetentionExportWorkerRuntime.max_duration_ms,
      durationMs,
    );
    documentsRetentionExportWorkerRuntime.failed_count += 1;
    documentsRetentionExportWorkerRuntime.consecutive_failure_count += 1;
    const failedRun = {
      ...baseRun,
      status: 'failed',
      skipped: false,
      completed_at: completedAt,
      attempted_count: 0,
      dispatched_count: 0,
      failed_count: 1,
      deliveries_count: 0,
      manifests_count: 0,
      duration_ms: durationMs,
      message: error.message || 'Documents retention export worker pass failed.',
    };
    documentsRetentionExportWorkerLastRun = failedRun;
    logger.warn('[DocumentsRetentionExportWorker] Worker pass failed', error);
    return failedRun;
  } finally {
    if (documentsRetentionExportWorkerScheduled) {
      documentsRetentionExportWorkerRuntime.next_run_at = new Date(
        Date.now() + environment.interval_ms,
      ).toISOString();
    }
    documentsRetentionExportWorkerRunning = false;
  }
}

async function runDocumentsRetentionReminderNotificationWorkerPass({
  now = new Date(),
  limit,
  source = 'manual',
  notificationClient,
} = {}) {
  const normalizedNow = asDate(now) || new Date();
  const startedAt = normalizedNow.toISOString();
  const startedMs = Date.now();
  const batchLimit = getDocumentsRetentionReminderNotificationWorkerBatchLimit(limit);
  const environment = getDocumentsRetentionReminderNotificationWorkerEnvironment();
  const baseRun = {
    type: 'documents_retention_reminder_notification_worker_run',
    run_id: `documents-retention-reminder-notification-worker-${crypto.randomUUID()}`,
    mode: 'content-free-reminder-notification-retry',
    worker: DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_NAME,
    scheduler_enabled: environment.scheduler_enabled,
    source,
    started_at: startedAt,
    batch_limit: batchLimit,
    payload_content_free: true,
    policy: 'This worker retries due failed content-free evidence reminder webhook notifications only. It does not read document bodies or prune snapshots.',
  };

  if (documentsRetentionReminderNotificationWorkerRunning) {
    const completedAt = isoNow();
    documentsRetentionReminderNotificationWorkerRuntime.skipped_count += 1;
    documentsRetentionReminderNotificationWorkerRuntime.heartbeat_at = completedAt;
    documentsRetentionReminderNotificationWorkerRuntime.last_completed_at = completedAt;
    const skippedRun = {
      ...baseRun,
      status: 'skipped',
      skipped: true,
      completed_at: completedAt,
      attempted_count: 0,
      retried_count: 0,
      failed_count: 0,
      duration_ms: 0,
      message: 'A documents retention reminder notification worker pass is already running.',
    };
    documentsRetentionReminderNotificationWorkerLastRun = skippedRun;
    return skippedRun;
  }

  documentsRetentionReminderNotificationWorkerRunning = true;
  documentsRetentionReminderNotificationWorkerRuntime.run_count += 1;
  documentsRetentionReminderNotificationWorkerRuntime.heartbeat_at = startedAt;
  documentsRetentionReminderNotificationWorkerRuntime.last_started_at = startedAt;
  try {
    const retry = await retryDocumentsVersionRetentionEvidenceReminderNotifications({
      now: normalizedNow,
      limit: batchLimit,
      ...(notificationClient ? { notificationClient } : {}),
    });
    const completedAt = isoNow();
    const durationMs = Math.max(0, Date.now() - startedMs);
    documentsRetentionReminderNotificationWorkerRuntime.heartbeat_at = completedAt;
    documentsRetentionReminderNotificationWorkerRuntime.last_completed_at = completedAt;
    documentsRetentionReminderNotificationWorkerRuntime.last_duration_ms = durationMs;
    documentsRetentionReminderNotificationWorkerRuntime.max_duration_ms = Math.max(
      documentsRetentionReminderNotificationWorkerRuntime.max_duration_ms,
      durationMs,
    );
    if (retry.failed_count > 0) {
      documentsRetentionReminderNotificationWorkerRuntime.failed_count += 1;
      documentsRetentionReminderNotificationWorkerRuntime.consecutive_failure_count += 1;
    } else {
      documentsRetentionReminderNotificationWorkerRuntime.completed_count += 1;
      documentsRetentionReminderNotificationWorkerRuntime.consecutive_failure_count = 0;
    }
    const completedRun = {
      ...baseRun,
      status: retry.failed_count > 0 ? 'completed_with_failures' : 'completed',
      skipped: false,
      completed_at: completedAt,
      attempted_count: retry.attempted_count,
      retried_count: retry.delivered_count,
      failed_count: retry.failed_count,
      skipped_count: retry.skipped_count,
      notifications_count: Array.isArray(retry.notifications) ? retry.notifications.length : 0,
      retry_ready_count: retry.retry_ready_count,
      pending_retry_count: retry.pending_retry_count,
      duration_ms: durationMs,
      message: retry.attempted_count > 0
        ? `${retry.delivered_count} retried / ${retry.failed_count} failed.`
        : 'No due failed reminder notifications.',
      retry,
    };
    documentsRetentionReminderNotificationWorkerLastRun = completedRun;
    return completedRun;
  } catch (error) {
    const completedAt = isoNow();
    const durationMs = Math.max(0, Date.now() - startedMs);
    documentsRetentionReminderNotificationWorkerRuntime.heartbeat_at = completedAt;
    documentsRetentionReminderNotificationWorkerRuntime.last_completed_at = completedAt;
    documentsRetentionReminderNotificationWorkerRuntime.last_duration_ms = durationMs;
    documentsRetentionReminderNotificationWorkerRuntime.max_duration_ms = Math.max(
      documentsRetentionReminderNotificationWorkerRuntime.max_duration_ms,
      durationMs,
    );
    documentsRetentionReminderNotificationWorkerRuntime.failed_count += 1;
    documentsRetentionReminderNotificationWorkerRuntime.consecutive_failure_count += 1;
    const failedRun = {
      ...baseRun,
      status: 'failed',
      skipped: false,
      completed_at: completedAt,
      attempted_count: 0,
      retried_count: 0,
      failed_count: 1,
      notifications_count: 0,
      duration_ms: durationMs,
      message: error.message || 'Documents retention reminder notification worker pass failed.',
    };
    documentsRetentionReminderNotificationWorkerLastRun = failedRun;
    logger.warn('[DocumentsRetentionReminderNotificationWorker] Worker pass failed', error);
    return failedRun;
  } finally {
    if (documentsRetentionReminderNotificationWorkerScheduled) {
      documentsRetentionReminderNotificationWorkerRuntime.next_run_at = new Date(
        Date.now() + environment.interval_ms,
      ).toISOString();
    }
    documentsRetentionReminderNotificationWorkerRunning = false;
  }
}

function startDocumentsRetentionExportWorker({ runOnStartup = true } = {}) {
  const environment = getDocumentsRetentionExportWorkerEnvironment();
  if (!environment.scheduler_enabled || documentsRetentionExportWorkerScheduled) {
    return environment;
  }

  documentsRetentionExportWorkerScheduled = true;
  documentsRetentionExportWorkerRuntime.scheduled_at = isoNow();
  documentsRetentionExportWorkerRuntime.stopped_at = null;
  documentsRetentionExportWorkerRuntime.heartbeat_at = documentsRetentionExportWorkerRuntime.scheduled_at;
  const runWorker = async () => {
    documentsRetentionExportWorkerRuntime.next_run_at = new Date(
      Date.now() + environment.interval_ms,
    ).toISOString();
    await runDocumentsRetentionExportWorkerPass({
      limit: environment.batch_limit,
      source: 'interval',
    });
  };

  documentsRetentionExportWorkerInterval = setInterval(runWorker, environment.interval_ms);
  if (typeof documentsRetentionExportWorkerInterval.unref === 'function') {
    documentsRetentionExportWorkerInterval.unref();
  }

  if (runOnStartup) {
    const firstRunDelay = Math.min(10 * 1000, environment.interval_ms);
    documentsRetentionExportWorkerRuntime.next_run_at = new Date(Date.now() + firstRunDelay).toISOString();
    documentsRetentionExportWorkerFirstRun = setTimeout(
      runWorker,
      firstRunDelay,
    );
    if (typeof documentsRetentionExportWorkerFirstRun.unref === 'function') {
      documentsRetentionExportWorkerFirstRun.unref();
    }
  } else {
    documentsRetentionExportWorkerRuntime.next_run_at = new Date(
      Date.now() + environment.interval_ms,
    ).toISOString();
  }

  logger.info('[DocumentsRetentionExportWorker] Scheduled documents retention export worker', {
    intervalMs: environment.interval_ms,
    batchLimit: environment.batch_limit,
  });
  return environment;
}

function startDocumentsRetentionReminderNotificationWorker({ runOnStartup = true } = {}) {
  const environment = getDocumentsRetentionReminderNotificationWorkerEnvironment();
  if (!environment.scheduler_enabled || documentsRetentionReminderNotificationWorkerScheduled) {
    return environment;
  }

  documentsRetentionReminderNotificationWorkerScheduled = true;
  documentsRetentionReminderNotificationWorkerRuntime.scheduled_at = isoNow();
  documentsRetentionReminderNotificationWorkerRuntime.stopped_at = null;
  documentsRetentionReminderNotificationWorkerRuntime.heartbeat_at =
    documentsRetentionReminderNotificationWorkerRuntime.scheduled_at;
  const runWorker = async () => {
    documentsRetentionReminderNotificationWorkerRuntime.next_run_at = new Date(
      Date.now() + environment.interval_ms,
    ).toISOString();
    await runDocumentsRetentionReminderNotificationWorkerPass({
      limit: environment.batch_limit,
      source: 'interval',
    });
  };

  documentsRetentionReminderNotificationWorkerInterval = setInterval(runWorker, environment.interval_ms);
  if (typeof documentsRetentionReminderNotificationWorkerInterval.unref === 'function') {
    documentsRetentionReminderNotificationWorkerInterval.unref();
  }

  if (runOnStartup) {
    const firstRunDelay = Math.min(10 * 1000, environment.interval_ms);
    documentsRetentionReminderNotificationWorkerRuntime.next_run_at = new Date(Date.now() + firstRunDelay).toISOString();
    documentsRetentionReminderNotificationWorkerFirstRun = setTimeout(
      runWorker,
      firstRunDelay,
    );
    if (typeof documentsRetentionReminderNotificationWorkerFirstRun.unref === 'function') {
      documentsRetentionReminderNotificationWorkerFirstRun.unref();
    }
  } else {
    documentsRetentionReminderNotificationWorkerRuntime.next_run_at = new Date(
      Date.now() + environment.interval_ms,
    ).toISOString();
  }

  logger.info('[DocumentsRetentionReminderNotificationWorker] Scheduled documents retention reminder notification worker', {
    intervalMs: environment.interval_ms,
    batchLimit: environment.batch_limit,
  });
  return environment;
}

function stopDocumentsRetentionExportWorker() {
  if (documentsRetentionExportWorkerInterval) {
    clearInterval(documentsRetentionExportWorkerInterval);
  }
  if (documentsRetentionExportWorkerFirstRun) {
    clearTimeout(documentsRetentionExportWorkerFirstRun);
  }
  documentsRetentionExportWorkerInterval = null;
  documentsRetentionExportWorkerFirstRun = null;
  documentsRetentionExportWorkerScheduled = false;
  documentsRetentionExportWorkerRunning = false;
  documentsRetentionExportWorkerRuntime.stopped_at = isoNow();
  documentsRetentionExportWorkerRuntime.next_run_at = null;
}

function stopDocumentsRetentionReminderNotificationWorker() {
  if (documentsRetentionReminderNotificationWorkerInterval) {
    clearInterval(documentsRetentionReminderNotificationWorkerInterval);
  }
  if (documentsRetentionReminderNotificationWorkerFirstRun) {
    clearTimeout(documentsRetentionReminderNotificationWorkerFirstRun);
  }
  documentsRetentionReminderNotificationWorkerInterval = null;
  documentsRetentionReminderNotificationWorkerFirstRun = null;
  documentsRetentionReminderNotificationWorkerScheduled = false;
  documentsRetentionReminderNotificationWorkerRunning = false;
  documentsRetentionReminderNotificationWorkerRuntime.stopped_at = isoNow();
  documentsRetentionReminderNotificationWorkerRuntime.next_run_at = null;
}

function resetDocumentsRetentionExportWorkerRuntime() {
  stopDocumentsRetentionExportWorker();
  documentsRetentionExportWorkerLastRun = null;
  documentsRetentionExportWorkerRuntime = {
    scheduled_at: null,
    stopped_at: null,
    heartbeat_at: null,
    next_run_at: null,
    last_started_at: null,
    last_completed_at: null,
    run_count: 0,
    completed_count: 0,
    failed_count: 0,
    skipped_count: 0,
    consecutive_failure_count: 0,
    last_duration_ms: 0,
    max_duration_ms: 0,
  };
}

function resetDocumentsRetentionReminderNotificationWorkerRuntime() {
  stopDocumentsRetentionReminderNotificationWorker();
  documentsRetentionReminderNotificationWorkerLastRun = null;
  documentsRetentionReminderNotificationWorkerRuntime = {
    scheduled_at: null,
    stopped_at: null,
    heartbeat_at: null,
    next_run_at: null,
    last_started_at: null,
    last_completed_at: null,
    run_count: 0,
    completed_count: 0,
    failed_count: 0,
    skipped_count: 0,
    consecutive_failure_count: 0,
    last_duration_ms: 0,
    max_duration_ms: 0,
  };
}

module.exports = {
  DOCUMENTS_RETENTION_EXPORT_WORKER_NAME,
  DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_NAME,
  getDocumentsRetentionExportWorkerBatchLimit,
  getDocumentsRetentionExportWorkerEnvironment,
  getDocumentsRetentionExportWorkerStatus,
  getDocumentsRetentionReminderNotificationWorkerBatchLimit,
  getDocumentsRetentionReminderNotificationWorkerEnvironment,
  getDocumentsRetentionReminderNotificationWorkerStatus,
  resetDocumentsRetentionExportWorkerRuntime,
  resetDocumentsRetentionReminderNotificationWorkerRuntime,
  runDocumentsRetentionExportWorkerPass,
  runDocumentsRetentionReminderNotificationWorkerPass,
  startDocumentsRetentionExportWorker,
  startDocumentsRetentionReminderNotificationWorker,
  stopDocumentsRetentionExportWorker,
  stopDocumentsRetentionReminderNotificationWorker,
};

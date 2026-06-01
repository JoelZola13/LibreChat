const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { GetObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');

const DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION = 2;
const DEFAULT_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS = 100;
const MAX_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS = 500;
const DEFAULT_DOCUMENTS_VERSION_RETENTION_TREND_DAYS = 30;
const MAX_DOCUMENTS_VERSION_RETENTION_TREND_DAYS = 365;
const DEFAULT_DOCUMENTS_VERSION_RETENTION_DASHBOARD_MAX_DOCUMENTS = 50;
const MAX_DOCUMENTS_VERSION_RETENTION_DASHBOARD_MAX_DOCUMENTS = 200;
const DEFAULT_DOCUMENTS_VERSION_RETENTION_ALERT_MAX_ALERTS = 20;
const MAX_DOCUMENTS_VERSION_RETENTION_ALERT_MAX_ALERTS = 100;
const DEFAULT_DOCUMENTS_VERSION_RETENTION_AUTOMATION_MAX_ACTIONS = 20;
const MAX_DOCUMENTS_VERSION_RETENTION_AUTOMATION_MAX_ACTIONS = 100;
const DEFAULT_DOCUMENTS_VERSION_RETENTION_EXPORT_RETRY_BACKOFF_SECONDS = 15 * 60;
const MAX_DOCUMENTS_VERSION_RETENTION_EXPORT_RETRY_BACKOFF_SECONDS = 4 * 60 * 60;
const DEFAULT_DOCUMENTS_VERSION_RETENTION_RUNBOOK_EVIDENCE_DAYS = 180;
const MAX_DOCUMENTS_VERSION_RETENTION_RUNBOOK_EVIDENCE_DAYS = 3650;
const DOCUMENTS_VERSION_RETENTION_EVIDENCE_EXPIRING_SOON_DAYS = 30;
const DEFAULT_DOCUMENTS_VERSION_RETENTION_REMINDER_RETRY_BACKOFF_SECONDS = 15 * 60;
const MAX_DOCUMENTS_VERSION_RETENTION_REMINDER_RETRY_BACKOFF_SECONDS = 4 * 60 * 60;
const DOCUMENTS_VERSION_RETENTION_EXPORT_STORAGE_ADAPTERS = new Set(['database', 'local-file', 's3']);
const DEFAULT_DOCUMENTS_VERSION_RETENTION_EXPORT_STORAGE_ADAPTER = 'database';
const DEFAULT_DOCUMENTS_VERSION_RETENTION_EXPORT_S3_PREFIX = 'documents-retention-exports';
const DEFAULT_DOCUMENTS_VERSION_RETENTION_EXPORT_STORAGE_DIR = path.join(
  process.cwd(),
  'data',
  'documents-retention-exports',
);
const DOCUMENTS_VERSION_RETENTION_POLICIES = new Set(['keep-latest', 'keep-forever', 'retain-until']);
const DOCUMENTS_VERSION_RETENTION_PRUNE_CONFIRMATION = 'PRUNE_DOCUMENT_VERSION_SNAPSHOTS';
const DOCUMENTS_VERSION_RETENTION_RESTORE_DRILL_CONFIRMATION = 'CONFIRM_RESTORE_DRILL_BACKUP_HANDOFF';
const DEFAULT_DOCUMENTS_VERSION_RETENTION_PRUNE_CANDIDATE_LIMIT = 100;
const MAX_DOCUMENTS_VERSION_RETENTION_PRUNE_CANDIDATE_LIMIT = 500;

const documentsVersionSnapshotSchema = new mongoose.Schema(
  {
    documentId: {
      type: String,
      required: true,
      index: true,
    },
    snapshotId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    versionNumber: {
      type: Number,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      default: 'Untitled Document',
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    changeNote: {
      type: String,
      default: 'Saved from Tiptap editor',
    },
    changeType: {
      type: String,
      default: 'tiptap_snapshot',
    },
    schemaVersion: {
      type: Number,
      default: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      index: true,
    },
    retentionPolicy: {
      type: String,
      default: 'keep-latest',
      index: true,
    },
    retainedUntil: {
      type: Date,
      default: null,
      index: true,
    },
    origin: {
      type: String,
      default: 'tiptap_editor',
      index: true,
    },
    clientSnapshotId: {
      type: String,
      default: '',
      index: true,
    },
    sourceVersionId: {
      type: String,
      default: '',
      index: true,
    },
    authorId: {
      type: String,
      default: '',
      index: true,
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    contentText: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    contentHash: {
      type: String,
      required: true,
      index: true,
    },
    sourceUpdatedAt: {
      type: Date,
      default: null,
      index: true,
    },
    savedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    minimize: false,
  },
);

documentsVersionSnapshotSchema.index({ documentId: 1, versionNumber: -1 });
documentsVersionSnapshotSchema.index({ documentId: 1, contentHash: 1 }, { unique: true });
documentsVersionSnapshotSchema.index({ documentId: 1, retentionPolicy: 1, versionNumber: -1 });
documentsVersionSnapshotSchema.index({ updatedAt: -1 });

const DocumentsVersionSnapshot =
  mongoose.models.DocumentsVersionSnapshot ||
  mongoose.model('DocumentsVersionSnapshot', documentsVersionSnapshotSchema);

const documentsVersionRetentionExportJobSchema = new mongoose.Schema(
  {
    deliveryId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      default: 'scheduled',
      index: true,
    },
    backgroundWorker: {
      type: String,
      default: 'documents-retention-export',
      index: true,
    },
    nextAttemptAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastDeliveryAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastFailureAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastFailureMessage: {
      type: String,
      default: '',
    },
    attemptCount: {
      type: Number,
      default: 0,
    },
    failureCount: {
      type: Number,
      default: 0,
    },
    retryBackoffSeconds: {
      type: Number,
      default: 0,
    },
    channels: {
      type: [String],
      default: () => ['admin-dashboard-download', 'background-export-worker'],
    },
    payloadType: {
      type: String,
      default: 'documents_version_retention_dashboard',
      index: true,
    },
    payloadContentFree: {
      type: Boolean,
      default: true,
    },
    retentionWindowDays: {
      type: Number,
      default: DEFAULT_DOCUMENTS_VERSION_RETENTION_TREND_DAYS,
      index: true,
    },
    maxDocuments: {
      type: Number,
      default: DEFAULT_DOCUMENTS_VERSION_RETENTION_DASHBOARD_MAX_DOCUMENTS,
    },
    pendingAlertCount: {
      type: Number,
      default: 0,
    },
    pendingPolicyActionCount: {
      type: Number,
      default: 0,
    },
    destructiveActionCount: {
      type: Number,
      default: 0,
    },
    requiresWorker: {
      type: Boolean,
      default: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    deliveryHistory: {
      type: [{
        status: {
          type: String,
          default: 'scheduled',
        },
        occurredAt: {
          type: Date,
          default: Date.now,
        },
        message: {
          type: String,
          default: '',
        },
        manifestId: {
          type: String,
          default: '',
        },
        payloadHash: {
          type: String,
          default: '',
        },
        storageAdapter: {
          type: String,
          default: '',
        },
        storageStatus: {
          type: String,
          default: '',
        },
        storageRef: {
          type: String,
          default: '',
        },
        storagePath: {
          type: String,
          default: '',
        },
        storageHash: {
          type: String,
          default: '',
        },
        storageContentFree: {
          type: Boolean,
          default: true,
        },
        storedAt: {
          type: Date,
          default: null,
        },
        pendingAlertCount: {
          type: Number,
          default: 0,
        },
        pendingPolicyActionCount: {
          type: Number,
          default: 0,
        },
        retryAfterAt: {
          type: Date,
          default: null,
        },
        retryBackoffSeconds: {
          type: Number,
          default: 0,
        },
      }],
      default: () => [],
    },
  },
  {
    timestamps: true,
    minimize: false,
  },
);

documentsVersionRetentionExportJobSchema.index({ status: 1, nextAttemptAt: 1 });
documentsVersionRetentionExportJobSchema.index({ status: 1, lastFailureAt: -1 });
documentsVersionRetentionExportJobSchema.index({ updatedAt: -1 });

const DocumentsVersionRetentionExportJob =
  mongoose.models.DocumentsVersionRetentionExportJob ||
  mongoose.model('DocumentsVersionRetentionExportJob', documentsVersionRetentionExportJobSchema);

const documentsVersionRetentionPruneAuditSchema = new mongoose.Schema(
  {
    auditId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    mode: {
      type: String,
      default: 'confirmed-delete',
      index: true,
    },
    status: {
      type: String,
      default: 'completed',
      index: true,
    },
    requestedBy: {
      type: String,
      default: '',
      index: true,
    },
    payloadContentFree: {
      type: Boolean,
      default: true,
    },
    confirmationToken: {
      type: String,
      default: DOCUMENTS_VERSION_RETENTION_PRUNE_CONFIRMATION,
    },
    confirmationMatched: {
      type: Boolean,
      default: true,
    },
    maxSnapshots: {
      type: Number,
      default: DEFAULT_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS,
    },
    candidateLimit: {
      type: Number,
      default: DEFAULT_DOCUMENTS_VERSION_RETENTION_PRUNE_CANDIDATE_LIMIT,
    },
    totalCandidateCount: {
      type: Number,
      default: 0,
    },
    candidateCount: {
      type: Number,
      default: 0,
    },
    affectedDocumentsCount: {
      type: Number,
      default: 0,
    },
    deletedCount: {
      type: Number,
      default: 0,
      index: true,
    },
    remainingCandidateCount: {
      type: Number,
      default: 0,
    },
    limited: {
      type: Boolean,
      default: false,
    },
    safeguards: {
      type: [String],
      default: () => [],
    },
    documents: {
      type: [mongoose.Schema.Types.Mixed],
      default: () => [],
    },
    candidates: {
      type: [mongoose.Schema.Types.Mixed],
      default: () => [],
    },
    restoreDrill: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    executedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    minimize: false,
  },
);

documentsVersionRetentionPruneAuditSchema.index({ executedAt: -1, createdAt: -1 });

const DocumentsVersionRetentionPruneAudit =
  mongoose.models.DocumentsVersionRetentionPruneAudit ||
  mongoose.model('DocumentsVersionRetentionPruneAudit', documentsVersionRetentionPruneAuditSchema);

const documentsVersionRetentionRunbookEvidenceSchema = new mongoose.Schema(
  {
    evidenceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    evidenceType: {
      type: String,
      default: 'backup-verification',
      index: true,
    },
    status: {
      type: String,
      default: 'export-required',
      index: true,
    },
    requestedBy: {
      type: String,
      default: '',
      index: true,
    },
    payloadContentFree: {
      type: Boolean,
      default: true,
    },
    storageAdapter: {
      type: String,
      default: 'database',
      index: true,
    },
    reportHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    latestManifestId: {
      type: String,
      default: '',
      index: true,
    },
    latestPayloadHash: {
      type: String,
      default: '',
      index: true,
    },
    latestDeliveryId: {
      type: String,
      default: '',
      index: true,
    },
    latestDeliveryAt: {
      type: Date,
      default: null,
      index: true,
    },
    backupStorageReady: {
      type: Boolean,
      default: false,
      index: true,
    },
    latestStorageAdapter: {
      type: String,
      default: '',
      index: true,
    },
    latestStorageStatus: {
      type: String,
      default: '',
      index: true,
    },
    latestStorageRef: {
      type: String,
      default: '',
    },
    latestStorageHash: {
      type: String,
      default: '',
      index: true,
    },
    latestStoredAt: {
      type: Date,
      default: null,
      index: true,
    },
    backupExportReady: {
      type: Boolean,
      default: false,
      index: true,
    },
    backupHandoffReady: {
      type: Boolean,
      default: false,
      index: true,
    },
    deliveredManifestCount: {
      type: Number,
      default: 0,
    },
    failedDeliveryCount: {
      type: Number,
      default: 0,
    },
    pendingDeliveryCount: {
      type: Number,
      default: 0,
    },
    pruneAuditCount: {
      type: Number,
      default: 0,
    },
    requiredRestoreDrillCount: {
      type: Number,
      default: 0,
    },
    completedRestoreDrillCount: {
      type: Number,
      default: 0,
    },
    scheduledPruneAllowed: {
      type: Boolean,
      default: false,
      index: true,
    },
    scheduledPruneStatus: {
      type: String,
      default: 'manual-only',
      index: true,
    },
    checks: {
      type: [String],
      default: () => [],
    },
    runbookSteps: {
      type: [String],
      default: () => [],
    },
    message: {
      type: String,
      default: '',
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    minimize: false,
  },
);

documentsVersionRetentionRunbookEvidenceSchema.index({ evidenceType: 1, recordedAt: -1 });
documentsVersionRetentionRunbookEvidenceSchema.index({ status: 1, recordedAt: -1 });

const DocumentsVersionRetentionRunbookEvidence =
  mongoose.models.DocumentsVersionRetentionRunbookEvidence ||
  mongoose.model('DocumentsVersionRetentionRunbookEvidence', documentsVersionRetentionRunbookEvidenceSchema);

const documentsVersionRetentionReminderNotificationSchema = new mongoose.Schema(
  {
    notificationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    reminderType: {
      type: String,
      default: 'documents_version_retention_evidence_reminder',
      index: true,
    },
    reminderStatus: {
      type: String,
      default: 'missing',
      index: true,
    },
    severity: {
      type: String,
      default: 'warning',
      index: true,
    },
    reviewRequired: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      default: 'scheduled',
      index: true,
    },
    deliveryAdapter: {
      type: String,
      default: 'internal-ledger',
      index: true,
    },
    deliveryTarget: {
      type: String,
      default: 'retention-dashboard',
    },
    channels: {
      type: [String],
      default: () => ['retention-dashboard', 'admin-runbook'],
    },
    payloadContentFree: {
      type: Boolean,
      default: true,
    },
    payloadHash: {
      type: String,
      required: true,
      index: true,
    },
    latestEvidenceId: {
      type: String,
      default: '',
      index: true,
    },
    latestManifestId: {
      type: String,
      default: '',
      index: true,
    },
    latestPayloadHash: {
      type: String,
      default: '',
      index: true,
    },
    dueAt: {
      type: Date,
      default: null,
      index: true,
    },
    nextReviewAt: {
      type: Date,
      default: null,
      index: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastFailureAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastFailureMessage: {
      type: String,
      default: '',
    },
    attemptCount: {
      type: Number,
      default: 0,
    },
    failureCount: {
      type: Number,
      default: 0,
    },
    retryAfterAt: {
      type: Date,
      default: null,
      index: true,
    },
    retryBackoffSeconds: {
      type: Number,
      default: 0,
    },
    responseStatus: {
      type: Number,
      default: 0,
    },
    responseBodyHash: {
      type: String,
      default: '',
    },
    message: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    minimize: false,
  },
);

documentsVersionRetentionReminderNotificationSchema.index({ status: 1, retryAfterAt: 1 });
documentsVersionRetentionReminderNotificationSchema.index({ generatedAt: -1, createdAt: -1 });

const DocumentsVersionRetentionReminderNotification =
  mongoose.models.DocumentsVersionRetentionReminderNotification ||
  mongoose.model(
    'DocumentsVersionRetentionReminderNotification',
    documentsVersionRetentionReminderNotificationSchema,
  );

function asPlainObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function asDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function asString(value, fallback = '') {
  const stringValue = String(value == null ? '' : value).trim();
  return stringValue || fallback;
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asBoolean(value, fallback = false) {
  if (value === true || value === 'true' || value === '1' || value === 1) {
    return true;
  }

  if (value === false || value === 'false' || value === '0' || value === 0) {
    return false;
  }

  return fallback;
}

function asPositiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? Math.min(number, maximum) : fallback;
}

function getDocumentsVersionHistoryMaxSnapshots(value = process.env.DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS) {
  return asPositiveInteger(
    value,
    DEFAULT_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS,
    MAX_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS,
  );
}

function getDocumentsVersionRetentionTrendDays(value) {
  return asPositiveInteger(
    value,
    DEFAULT_DOCUMENTS_VERSION_RETENTION_TREND_DAYS,
    MAX_DOCUMENTS_VERSION_RETENTION_TREND_DAYS,
  );
}

function getDocumentsVersionRetentionDashboardMaxDocuments(value) {
  return asPositiveInteger(
    value,
    DEFAULT_DOCUMENTS_VERSION_RETENTION_DASHBOARD_MAX_DOCUMENTS,
    MAX_DOCUMENTS_VERSION_RETENTION_DASHBOARD_MAX_DOCUMENTS,
  );
}

function getDocumentsVersionRetentionRetryBackoffSeconds(failureCount) {
  const normalizedFailureCount = asPositiveInteger(failureCount, 1, 12);
  const backoffSeconds = DEFAULT_DOCUMENTS_VERSION_RETENTION_EXPORT_RETRY_BACKOFF_SECONDS
    * (2 ** (normalizedFailureCount - 1));

  return Math.min(backoffSeconds, MAX_DOCUMENTS_VERSION_RETENTION_EXPORT_RETRY_BACKOFF_SECONDS);
}

function getDocumentsVersionRetentionReminderRetryBackoffSeconds(failureCount) {
  const normalizedFailureCount = asPositiveInteger(failureCount, 1, 12);
  const backoffSeconds = DEFAULT_DOCUMENTS_VERSION_RETENTION_REMINDER_RETRY_BACKOFF_SECONDS
    * (2 ** (normalizedFailureCount - 1));

  return Math.min(backoffSeconds, MAX_DOCUMENTS_VERSION_RETENTION_REMINDER_RETRY_BACKOFF_SECONDS);
}

function getDocumentsVersionRetentionAlertMaxAlerts(value) {
  return asPositiveInteger(
    value,
    DEFAULT_DOCUMENTS_VERSION_RETENTION_ALERT_MAX_ALERTS,
    MAX_DOCUMENTS_VERSION_RETENTION_ALERT_MAX_ALERTS,
  );
}

function getDocumentsVersionRetentionAutomationMaxActions(value) {
  return asPositiveInteger(
    value,
    DEFAULT_DOCUMENTS_VERSION_RETENTION_AUTOMATION_MAX_ACTIONS,
    MAX_DOCUMENTS_VERSION_RETENTION_AUTOMATION_MAX_ACTIONS,
  );
}

function getDocumentsVersionRetentionPruneCandidateLimit(value) {
  return asPositiveInteger(
    value,
    DEFAULT_DOCUMENTS_VERSION_RETENTION_PRUNE_CANDIDATE_LIMIT,
    MAX_DOCUMENTS_VERSION_RETENTION_PRUNE_CANDIDATE_LIMIT,
  );
}

function getDocumentsVersionRetentionRunbookEvidenceDays(
  value = process.env.DOCUMENTS_RETENTION_RUNBOOK_EVIDENCE_RETENTION_DAYS,
) {
  return asPositiveInteger(
    value,
    DEFAULT_DOCUMENTS_VERSION_RETENTION_RUNBOOK_EVIDENCE_DAYS,
    MAX_DOCUMENTS_VERSION_RETENTION_RUNBOOK_EVIDENCE_DAYS,
  );
}

function getDocumentsVersionRetentionExportStorageAdapter(environment = process.env) {
  const rawAdapter = asString(
    environment?.DOCUMENTS_RETENTION_EXPORT_STORAGE_ADAPTER,
    DEFAULT_DOCUMENTS_VERSION_RETENTION_EXPORT_STORAGE_ADAPTER,
  )
    .replace(/_/g, '-')
    .toLowerCase();
  const normalizedAdapter = rawAdapter === 'file' ? 'local-file' : rawAdapter;

  return DOCUMENTS_VERSION_RETENTION_EXPORT_STORAGE_ADAPTERS.has(normalizedAdapter)
    ? normalizedAdapter
    : DEFAULT_DOCUMENTS_VERSION_RETENTION_EXPORT_STORAGE_ADAPTER;
}

function getDocumentsVersionRetentionExportStorageDir(environment = process.env) {
  return path.resolve(asString(
    environment?.DOCUMENTS_RETENTION_EXPORT_STORAGE_DIR,
    DEFAULT_DOCUMENTS_VERSION_RETENTION_EXPORT_STORAGE_DIR,
  ));
}

function getDocumentsVersionRetentionExportS3Bucket(environment = process.env) {
  return asString(environment?.DOCUMENTS_RETENTION_EXPORT_S3_BUCKET || environment?.AWS_BUCKET_NAME);
}

function getDocumentsVersionRetentionExportS3Prefix(environment = process.env) {
  return asString(
    environment?.DOCUMENTS_RETENTION_EXPORT_S3_PREFIX,
    DEFAULT_DOCUMENTS_VERSION_RETENTION_EXPORT_S3_PREFIX,
  ).replace(/^\/+|\/+$/g, '');
}

function getDocumentsVersionRetentionExportS3Region(environment = process.env) {
  return asString(environment?.DOCUMENTS_RETENTION_EXPORT_S3_REGION || environment?.AWS_REGION);
}

function getDocumentsVersionRetentionExportS3Endpoint(environment = process.env) {
  return asString(environment?.DOCUMENTS_RETENTION_EXPORT_S3_ENDPOINT || environment?.AWS_ENDPOINT_URL);
}

function getDocumentsVersionRetentionExportS3ForcePathStyle(environment = process.env) {
  return asBoolean(
    environment?.DOCUMENTS_RETENTION_EXPORT_S3_FORCE_PATH_STYLE
      ?? environment?.AWS_S3_FORCE_PATH_STYLE
      ?? environment?.S3_FORCE_PATH_STYLE,
    false,
  );
}

function createDocumentsVersionRetentionExportS3Key({ manifest, environment = process.env } = {}) {
  const prefix = getDocumentsVersionRetentionExportS3Prefix(environment);
  const fileName = createDocumentsVersionRetentionDeliveryManifestStorageFileName(manifest);

  return prefix ? `${prefix}/${fileName}` : fileName;
}

function createDocumentsVersionRetentionExportS3Client(environment = process.env) {
  const region = getDocumentsVersionRetentionExportS3Region(environment);

  if (!region) {
    throw new Error('DOCUMENTS_RETENTION_EXPORT_S3_REGION or AWS_REGION is required for S3 retention export storage.');
  }

  const endpoint = getDocumentsVersionRetentionExportS3Endpoint(environment);
  const accessKeyId = asString(
    environment?.DOCUMENTS_RETENTION_EXPORT_S3_ACCESS_KEY_ID || environment?.AWS_ACCESS_KEY_ID,
  );
  const secretAccessKey = asString(
    environment?.DOCUMENTS_RETENTION_EXPORT_S3_SECRET_ACCESS_KEY || environment?.AWS_SECRET_ACCESS_KEY,
  );
  const sessionToken = asString(
    environment?.DOCUMENTS_RETENTION_EXPORT_S3_SESSION_TOKEN || environment?.AWS_SESSION_TOKEN,
  );
  const config = {
    region,
    ...(endpoint ? { endpoint } : {}),
    ...(getDocumentsVersionRetentionExportS3ForcePathStyle(environment) ? { forcePathStyle: true } : {}),
  };

  if (accessKeyId && secretAccessKey) {
    config.credentials = {
      accessKeyId,
      secretAccessKey,
      ...(sessionToken ? { sessionToken } : {}),
    };
  }

  return new S3Client(config);
}

function getDocumentsVersionRetentionExportStorageConfig(environment = process.env) {
  const adapter = getDocumentsVersionRetentionExportStorageAdapter(environment);
  const config = {
    adapter,
    content_free_only: true,
    directory: null,
    bucket: null,
    prefix: null,
    region: null,
    endpoint_configured: false,
    force_path_style: false,
  };

  if (adapter === 'local-file') {
    return {
      ...config,
      directory: getDocumentsVersionRetentionExportStorageDir(environment),
    };
  }

  if (adapter === 's3') {
    return {
      ...config,
      bucket: getDocumentsVersionRetentionExportS3Bucket(environment),
      prefix: getDocumentsVersionRetentionExportS3Prefix(environment),
      region: getDocumentsVersionRetentionExportS3Region(environment),
      endpoint_configured: Boolean(getDocumentsVersionRetentionExportS3Endpoint(environment)),
      force_path_style: getDocumentsVersionRetentionExportS3ForcePathStyle(environment),
    };
  }

  return config;
}

function normalizeRetentionPolicy(value) {
  const normalized = asString(value, 'keep-latest').replace(/_/g, '-').toLowerCase();
  return DOCUMENTS_VERSION_RETENTION_POLICIES.has(normalized) ? normalized : 'keep-latest';
}

function normalizeOrigin(value) {
  return asString(value, 'tiptap_editor').replace(/\s+/g, '_').toLowerCase();
}

function createDocumentsVersionSnapshotHash(snapshot = {}) {
  const payload = {
    title: asString(snapshot.title, 'Untitled Document'),
    content: snapshot.content === undefined ? null : snapshot.content,
    content_text: asString(snapshot.content_text ?? snapshot.contentText),
    metadata: asPlainObject(snapshot.metadata),
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

function serializeDocumentsVersionSnapshot(snapshot) {
  if (!snapshot) {
    return null;
  }

  return {
    id: snapshot.snapshotId,
    snapshot_id: snapshot.snapshotId,
    document_id: snapshot.documentId,
    version_number: snapshot.versionNumber,
    title: snapshot.title,
    word_count: snapshot.wordCount,
    change_note: snapshot.changeNote,
    change_type: snapshot.changeType,
    schema_version: snapshot.schemaVersion || DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
    retention_policy: snapshot.retentionPolicy || 'keep-latest',
    retained_until: snapshot.retainedUntil?.toISOString?.() || snapshot.retainedUntil || null,
    origin: snapshot.origin || 'tiptap_editor',
    client_snapshot_id: snapshot.clientSnapshotId || '',
    source_version_id: snapshot.sourceVersionId || '',
    author_id: snapshot.authorId,
    created_at: snapshot.savedAt?.toISOString?.() || snapshot.savedAt,
    source: 'durable',
    content: snapshot.content === undefined ? null : snapshot.content,
    content_text: snapshot.contentText || '',
    metadata: asPlainObject(snapshot.metadata),
    content_hash: snapshot.contentHash,
    updated_at: snapshot.sourceUpdatedAt?.toISOString?.() || snapshot.sourceUpdatedAt || snapshot.updatedAt,
  };
}

function serializeDocumentsVersionSnapshotRetentionRecord(snapshot) {
  if (!snapshot) {
    return null;
  }

  return {
    id: snapshot.snapshotId,
    snapshot_id: snapshot.snapshotId,
    document_id: snapshot.documentId,
    version_number: snapshot.versionNumber,
    title: snapshot.title,
    word_count: snapshot.wordCount,
    change_note: snapshot.changeNote,
    change_type: snapshot.changeType,
    schema_version: snapshot.schemaVersion || DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
    retention_policy: snapshot.retentionPolicy || 'keep-latest',
    retained_until: snapshot.retainedUntil?.toISOString?.() || snapshot.retainedUntil || null,
    origin: snapshot.origin || 'tiptap_editor',
    client_snapshot_id: snapshot.clientSnapshotId || '',
    source_version_id: snapshot.sourceVersionId || '',
    author_id: snapshot.authorId,
    content_hash: snapshot.contentHash,
    created_at: snapshot.savedAt?.toISOString?.() || snapshot.savedAt,
    source_updated_at: snapshot.sourceUpdatedAt?.toISOString?.() || snapshot.sourceUpdatedAt || null,
    updated_at: snapshot.updatedAt?.toISOString?.() || snapshot.updatedAt || null,
  };
}

function isDocumentsVersionSnapshotProtected(snapshot, now = new Date()) {
  if (!snapshot) {
    return false;
  }

  if (snapshot.retentionPolicy === 'keep-forever') {
    return true;
  }

  const retainedUntil = asDate(snapshot.retainedUntil);
  return Boolean(snapshot.retentionPolicy === 'retain-until' && retainedUntil && retainedUntil > now);
}

function countByValue(items, valueKey, fallback) {
  const counts = new Map();

  items.forEach((item) => {
    const rawValue = item?.[valueKey];
    const value = rawValue == null || rawValue === '' ? fallback : rawValue;
    counts.set(value, (counts.get(value) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
}

function serializeReportDate(value) {
  return value?.toISOString?.() || value || null;
}

function startOfUtcDay(value) {
  const date = asDate(value) || new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(value, days) {
  const date = new Date(value.getTime());
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function utcDayKey(value) {
  const date = asDate(value);
  return date ? startOfUtcDay(date).toISOString().slice(0, 10) : '';
}

function summarizeDocumentsVersionSnapshotRetention(snapshots, {
  maxSnapshots = getDocumentsVersionHistoryMaxSnapshots(),
  now = new Date(),
} = {}) {
  const normalizedMaxSnapshots = asPositiveInteger(
    maxSnapshots,
    DEFAULT_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS,
    MAX_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS,
  );
  const summary = {
    schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
    max_snapshots: normalizedMaxSnapshots,
    total_count: 0,
    keep_latest_count: 0,
    keep_forever_count: 0,
    retain_until_count: 0,
    active_retain_until_count: 0,
    expired_retain_until_count: 0,
    protected_count: 0,
    prunable_count: 0,
    over_limit_count: 0,
    oldest_snapshot_at: null,
    newest_snapshot_at: null,
    origins: [],
    schema_versions: [],
  };

  const records = Array.isArray(snapshots) ? snapshots : [];
  summary.total_count = records.length;
  summary.over_limit_count = Math.max(0, summary.total_count - normalizedMaxSnapshots);

  records.forEach((snapshot) => {
    const retentionPolicy = normalizeRetentionPolicy(snapshot?.retentionPolicy);
    const retainedUntil = asDate(snapshot?.retainedUntil);
    const savedAt = asDate(snapshot?.savedAt || snapshot?.createdAt || snapshot?.updatedAt);

    if (retentionPolicy === 'keep-forever') {
      summary.keep_forever_count += 1;
    } else if (retentionPolicy === 'retain-until') {
      summary.retain_until_count += 1;
      if (retainedUntil && retainedUntil > now) {
        summary.active_retain_until_count += 1;
      } else {
        summary.expired_retain_until_count += 1;
      }
    } else {
      summary.keep_latest_count += 1;
    }

    if (isDocumentsVersionSnapshotProtected({ ...snapshot, retentionPolicy }, now)) {
      summary.protected_count += 1;
    } else {
      summary.prunable_count += 1;
    }

    if (savedAt) {
      if (!summary.oldest_snapshot_at || savedAt < summary.oldest_snapshot_at) {
        summary.oldest_snapshot_at = savedAt;
      }
      if (!summary.newest_snapshot_at || savedAt > summary.newest_snapshot_at) {
        summary.newest_snapshot_at = savedAt;
      }
    }
  });

  summary.oldest_snapshot_at = serializeReportDate(summary.oldest_snapshot_at);
  summary.newest_snapshot_at = serializeReportDate(summary.newest_snapshot_at);
  summary.origins = countByValue(records, 'origin', 'legacy').map(({ value, count }) => ({
    origin: value,
    count,
  }));
  summary.schema_versions = countByValue(records, 'schemaVersion', DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION)
    .map(({ value, count }) => ({
      schema_version: asNumber(value, DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION),
      count,
    }));

  return summary;
}

function createDocumentsVersionSnapshotRetentionTrend(snapshots, {
  days = DEFAULT_DOCUMENTS_VERSION_RETENTION_TREND_DAYS,
  maxSnapshots = getDocumentsVersionHistoryMaxSnapshots(),
  now = new Date(),
} = {}) {
  const normalizedDays = getDocumentsVersionRetentionTrendDays(days);
  const normalizedMaxSnapshots = asPositiveInteger(
    maxSnapshots,
    DEFAULT_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS,
    MAX_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS,
  );
  const windowEnd = startOfUtcDay(now);
  const windowStart = addUtcDays(windowEnd, -(normalizedDays - 1));
  const records = Array.isArray(snapshots) ? snapshots : [];

  const buckets = Array.from({ length: normalizedDays }, (_item, index) => {
    const startAt = addUtcDays(windowStart, index);
    const endAt = addUtcDays(startAt, 1);
    const date = startAt.toISOString().slice(0, 10);
    const createdInBucket = records.filter((snapshot) => utcDayKey(snapshot?.savedAt || snapshot?.createdAt) === date);
    const cumulative = records.filter((snapshot) => {
      const savedAt = asDate(snapshot?.savedAt || snapshot?.createdAt || snapshot?.updatedAt);
      return savedAt && savedAt < endAt;
    });
    const cumulativeSummary = summarizeDocumentsVersionSnapshotRetention(cumulative, {
      maxSnapshots: normalizedMaxSnapshots,
      now,
    });
    const [primaryOrigin] = countByValue(createdInBucket, 'origin', 'legacy');

    return {
      date,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      created_count: createdInBucket.length,
      cumulative_count: cumulativeSummary.total_count,
      keep_latest_count: cumulativeSummary.keep_latest_count,
      keep_forever_count: cumulativeSummary.keep_forever_count,
      retain_until_count: cumulativeSummary.retain_until_count,
      active_retain_until_count: cumulativeSummary.active_retain_until_count,
      expired_retain_until_count: cumulativeSummary.expired_retain_until_count,
      protected_count: cumulativeSummary.protected_count,
      prunable_count: cumulativeSummary.prunable_count,
      over_limit_count: cumulativeSummary.over_limit_count,
      top_origin: primaryOrigin?.value || null,
      top_origin_count: primaryOrigin?.count || 0,
    };
  });

  return {
    days: normalizedDays,
    from: windowStart.toISOString(),
    to: addUtcDays(windowEnd, 1).toISOString(),
    bucket: 'day',
    buckets,
  };
}

function latestSnapshotBySavedAt(snapshots) {
  return [...(Array.isArray(snapshots) ? snapshots : [])]
    .sort((a, b) => {
      const savedAtDelta =
        (asDate(b?.savedAt || b?.createdAt || b?.updatedAt)?.getTime() || 0) -
        (asDate(a?.savedAt || a?.createdAt || a?.updatedAt)?.getTime() || 0);

      return savedAtDelta || asNumber(b?.versionNumber) - asNumber(a?.versionNumber);
    })[0] || null;
}

function summarizeDocumentsVersionSnapshotRetentionDashboardDocument(documentId, snapshots, {
  maxSnapshots = getDocumentsVersionHistoryMaxSnapshots(),
  now = new Date(),
  windowStart = addUtcDays(startOfUtcDay(now), -(DEFAULT_DOCUMENTS_VERSION_RETENTION_TREND_DAYS - 1)),
  windowEnd = addUtcDays(startOfUtcDay(now), 1),
} = {}) {
  const records = Array.isArray(snapshots) ? snapshots : [];
  const retentionReport = summarizeDocumentsVersionSnapshotRetention(records, { maxSnapshots, now });
  const latestSnapshot = latestSnapshotBySavedAt(records);
  const capturedInWindow = records.filter((snapshot) => {
    const savedAt = asDate(snapshot?.savedAt || snapshot?.createdAt || snapshot?.updatedAt);
    return savedAt && savedAt >= windowStart && savedAt < windowEnd;
  }).length;
  const riskScore =
    retentionReport.over_limit_count * 5 +
    retentionReport.expired_retain_until_count * 4 +
    retentionReport.prunable_count +
    Math.max(0, retentionReport.total_count - retentionReport.protected_count - maxSnapshots);
  const [primaryOrigin] = retentionReport.origins || [];
  const [primarySchemaVersion] = retentionReport.schema_versions || [];

  return {
    document_id: documentId,
    title: latestSnapshot?.title || 'Untitled Document',
    latest_version_number: latestSnapshot?.versionNumber || null,
    latest_snapshot_at: serializeReportDate(
      latestSnapshot?.savedAt || latestSnapshot?.createdAt || latestSnapshot?.updatedAt,
    ),
    snapshot_count: retentionReport.total_count,
    captured_in_window_count: capturedInWindow,
    protected_count: retentionReport.protected_count,
    prunable_count: retentionReport.prunable_count,
    over_limit_count: retentionReport.over_limit_count,
    expired_retain_until_count: retentionReport.expired_retain_until_count,
    keep_latest_count: retentionReport.keep_latest_count,
    keep_forever_count: retentionReport.keep_forever_count,
    retain_until_count: retentionReport.retain_until_count,
    primary_origin: primaryOrigin?.origin || null,
    primary_origin_count: primaryOrigin?.count || 0,
    schema_version: primarySchemaVersion?.schema_version || null,
    risk_score: Math.max(0, riskScore),
  };
}

const RETENTION_ALERT_SEVERITY_RANK = {
  critical: 3,
  warning: 2,
  info: 1,
};

function compactAlertDocumentTitle(title) {
  const normalized = asString(title, 'Untitled Document');
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

function createDocumentsVersionRetentionAlert({
  id,
  type,
  severity,
  scope = 'dashboard',
  count = 0,
  documentSummary = null,
  message,
  recommendedAction,
}) {
  const normalizedCount = Math.max(0, asNumber(count));

  return {
    id,
    type,
    severity,
    scope,
    document_id: documentSummary?.document_id || null,
    title: documentSummary ? compactAlertDocumentTitle(documentSummary.title) : null,
    count: normalizedCount,
    risk_score: Math.max(0, asNumber(documentSummary?.risk_score)),
    message,
    recommended_action: recommendedAction,
  };
}

function createDocumentsVersionSnapshotRetentionAlerts({
  retentionReport,
  documentSummaries = [],
  maxAlerts = DEFAULT_DOCUMENTS_VERSION_RETENTION_ALERT_MAX_ALERTS,
} = {}) {
  const normalizedMaxAlerts = getDocumentsVersionRetentionAlertMaxAlerts(maxAlerts);
  const report = retentionReport || {};
  const alerts = [];

  if (asNumber(report.expired_retain_until_count) > 0) {
    alerts.push(createDocumentsVersionRetentionAlert({
      id: 'dashboard-expired-retain-until',
      type: 'expired-retain-until',
      severity: 'critical',
      count: report.expired_retain_until_count,
      message: `${report.expired_retain_until_count} retained snapshot${report.expired_retain_until_count === 1 ? ' has' : 's have'} expired retain-until dates.`,
      recommendedAction: 'Review expired retained snapshots and move them to keep-latest or extend their retention date.',
    }));
  }

  if (asNumber(report.over_limit_count) > 0) {
    alerts.push(createDocumentsVersionRetentionAlert({
      id: 'dashboard-over-snapshot-cap',
      type: 'over-snapshot-cap',
      severity: 'warning',
      count: report.over_limit_count,
      message: `${report.over_limit_count} keep-latest snapshot${report.over_limit_count === 1 ? ' is' : 's are'} beyond the configured retention cap.`,
      recommendedAction: 'Export the retention report, then prune or protect snapshots that need explicit retention.',
    }));
  }

  const prunableCount = asNumber(report.prunable_count);
  if (prunableCount >= 10) {
    alerts.push(createDocumentsVersionRetentionAlert({
      id: 'dashboard-prunable-volume',
      type: 'prunable-volume',
      severity: 'info',
      count: prunableCount,
      message: `${prunableCount} snapshots are currently prunable under keep-latest retention.`,
      recommendedAction: 'Include prunable posture in the next scheduled retention export.',
    }));
  }

  documentSummaries.forEach((summary) => {
    if (summary.expired_retain_until_count > 0) {
      alerts.push(createDocumentsVersionRetentionAlert({
        id: `document-expired-retain-until:${summary.document_id}`,
        type: 'expired-retain-until',
        severity: 'critical',
        scope: 'document',
        count: summary.expired_retain_until_count,
        documentSummary: summary,
        message: `${summary.title} has ${summary.expired_retain_until_count} expired retain-until snapshot${summary.expired_retain_until_count === 1 ? '' : 's'}.`,
        recommendedAction: 'Open Version History for this document and update expired retain-until policies.',
      }));
    }

    if (summary.over_limit_count > 0) {
      alerts.push(createDocumentsVersionRetentionAlert({
        id: `document-over-snapshot-cap:${summary.document_id}`,
        type: 'over-snapshot-cap',
        severity: 'warning',
        scope: 'document',
        count: summary.over_limit_count,
        documentSummary: summary,
        message: `${summary.title} is ${summary.over_limit_count} snapshot${summary.over_limit_count === 1 ? '' : 's'} over the keep-latest cap.`,
        recommendedAction: 'Review document history and protect snapshots that should survive pruning.',
      }));
    }
  });

  return alerts
    .sort((a, b) => (
      (RETENTION_ALERT_SEVERITY_RANK[b.severity] || 0) - (RETENTION_ALERT_SEVERITY_RANK[a.severity] || 0) ||
      b.count - a.count ||
      b.risk_score - a.risk_score ||
      String(a.id).localeCompare(String(b.id))
    ))
    .slice(0, normalizedMaxAlerts);
}

function nextWeeklyRetentionExportAt(now = new Date()) {
  const normalizedNow = asDate(now) || new Date();
  const exportAt = new Date(Date.UTC(
    normalizedNow.getUTCFullYear(),
    normalizedNow.getUTCMonth(),
    normalizedNow.getUTCDate(),
    9,
    0,
    0,
    0,
  ));

  while (exportAt <= normalizedNow || exportAt.getUTCDay() !== 1) {
    exportAt.setUTCDate(exportAt.getUTCDate() + 1);
  }

  return exportAt;
}

function createDocumentsVersionRetentionExportSchedule({
  now = new Date(),
  days = DEFAULT_DOCUMENTS_VERSION_RETENTION_TREND_DAYS,
  maxDocuments = DEFAULT_DOCUMENTS_VERSION_RETENTION_DASHBOARD_MAX_DOCUMENTS,
} = {}) {
  const nextExportAt = nextWeeklyRetentionExportAt(now);

  return {
    cadence: 'weekly',
    next_export_at: nextExportAt.toISOString(),
    timezone: 'UTC',
    format: 'json',
    content_free: true,
    retention_window_days: getDocumentsVersionRetentionTrendDays(days),
    max_documents: getDocumentsVersionRetentionDashboardMaxDocuments(maxDocuments),
    includes: [
      'retention_report',
      'daily_buckets',
      'document_summaries',
      'alerts',
    ],
  };
}

function createDocumentsVersionRetentionAutomationAction({
  id,
  type,
  severity,
  scope = 'dashboard',
  count = 0,
  documentSummary = null,
  reason,
  suggestedAction,
  safeToAutoApply = false,
}) {
  return {
    id,
    type,
    severity,
    scope,
    document_id: documentSummary?.document_id || null,
    title: documentSummary ? compactAlertDocumentTitle(documentSummary.title) : null,
    count: Math.max(0, asNumber(count)),
    reason,
    suggested_action: suggestedAction,
    safe_to_auto_apply: Boolean(safeToAutoApply),
    requires_admin_confirmation: true,
  };
}

function createDocumentsVersionRetentionPolicyAutomationPlan({
  retentionReport,
  documentSummaries = [],
  maxActions = DEFAULT_DOCUMENTS_VERSION_RETENTION_AUTOMATION_MAX_ACTIONS,
} = {}) {
  const normalizedMaxActions = getDocumentsVersionRetentionAutomationMaxActions(maxActions);
  const report = retentionReport || {};
  const actions = [];

  if (asNumber(report.expired_retain_until_count) > 0) {
    actions.push(createDocumentsVersionRetentionAutomationAction({
      id: 'dashboard-review-expired-retain-until',
      type: 'review-expired-retain-until',
      severity: 'critical',
      count: report.expired_retain_until_count,
      reason: 'Expired retain-until snapshots require an explicit admin decision before retention is shortened or extended.',
      suggestedAction: 'Review expired retain-until snapshots and either extend retained_until or move them back to keep-latest.',
    }));
  }

  if (asNumber(report.over_limit_count) > 0) {
    actions.push(createDocumentsVersionRetentionAutomationAction({
      id: 'dashboard-prune-over-cap-preview',
      type: 'prune-over-cap-preview',
      severity: 'warning',
      count: report.over_limit_count,
      reason: 'The keep-latest retention cap has overflowed; pruning candidates should be reviewed before deletion.',
      suggestedAction: 'Run a prune preview, export the dashboard package, then prune unprotected over-cap snapshots.',
    }));
  }

  documentSummaries.forEach((summary) => {
    if (summary.expired_retain_until_count > 0) {
      actions.push(createDocumentsVersionRetentionAutomationAction({
        id: `document-review-expired-retain-until:${summary.document_id}`,
        type: 'review-expired-retain-until',
        severity: 'critical',
        scope: 'document',
        count: summary.expired_retain_until_count,
        documentSummary: summary,
        reason: 'This document has expired retain-until snapshots.',
        suggestedAction: 'Open the document Version History and update expired retain-until policies.',
      }));
    }

    if (summary.over_limit_count > 0) {
      actions.push(createDocumentsVersionRetentionAutomationAction({
        id: `document-prune-over-cap-preview:${summary.document_id}`,
        type: 'prune-over-cap-preview',
        severity: 'warning',
        scope: 'document',
        count: summary.over_limit_count,
        documentSummary: summary,
        reason: 'This document is over the keep-latest snapshot cap.',
        suggestedAction: 'Review document history and protect snapshots that should not be pruned.',
      }));
    }
  });

  const limitedActions = actions
    .sort((a, b) => (
      (RETENTION_ALERT_SEVERITY_RANK[b.severity] || 0) - (RETENTION_ALERT_SEVERITY_RANK[a.severity] || 0) ||
      b.count - a.count ||
      String(a.id).localeCompare(String(b.id))
    ))
    .slice(0, normalizedMaxActions);

  return {
    mode: 'dry-run',
    max_actions: normalizedMaxActions,
    action_count: limitedActions.length,
    destructive_action_count: limitedActions.filter((action) => action.type.includes('prune')).length,
    requires_admin_confirmation: limitedActions.length > 0,
    actions: limitedActions,
  };
}

function createDocumentsVersionRetentionExportDeliveryPlan({
  generatedAt,
  exportSchedule,
  alerts = [],
  policyAutomation,
} = {}) {
  const schedule = exportSchedule || createDocumentsVersionRetentionExportSchedule({ now: generatedAt });
  const nextAttemptAt = schedule.next_export_at;
  const idempotencySeed = [
    'documents-version-retention-dashboard',
    nextAttemptAt,
    schedule.retention_window_days,
    schedule.max_documents,
  ].join(':');
  const idempotencyKey = crypto.createHash('sha256').update(idempotencySeed).digest('hex');

  return {
    status: 'scheduled',
    background_worker: 'documents-retention-export',
    delivery_id: `documents-retention-${idempotencyKey.slice(0, 16)}`,
    idempotency_key: idempotencyKey,
    next_attempt_at: nextAttemptAt,
    last_delivery_at: null,
    channels: ['admin-dashboard-download', 'background-export-worker'],
    payload_type: 'documents_version_retention_dashboard',
    payload_content_free: true,
    pending_alert_count: alerts.length,
    pending_policy_action_count: policyAutomation?.action_count || 0,
    requires_worker: true,
  };
}

function serializeDocumentsVersionRetentionDeliveryEvent(event) {
  if (!event) {
    return null;
  }
  const storageAdapter = event.storageAdapter || event.storage_adapter || '';

  return {
    status: event.status || 'scheduled',
    occurred_at: event.occurredAt?.toISOString?.() || event.occurredAt || null,
    message: event.message || '',
    manifest_id: event.manifestId || '',
    payload_hash: event.payloadHash || '',
    storage_adapter: storageAdapter,
    storage_status: event.storageStatus || event.storage_status || '',
    storage_ref: event.storageRef || event.storage_ref || '',
    storage_path: event.storagePath || event.storage_path || null,
    storage_hash: event.storageHash || event.storage_hash || '',
    storage_content_free: storageAdapter
      ? event.storageContentFree !== false && event.storage_content_free !== false
      : null,
    stored_at: event.storedAt?.toISOString?.() || event.storedAt || event.stored_at || null,
    pending_alert_count: asNumber(event.pendingAlertCount),
    pending_policy_action_count: asNumber(event.pendingPolicyActionCount),
    retry_after_at: event.retryAfterAt?.toISOString?.() || event.retryAfterAt || null,
    retry_backoff_seconds: asNumber(event.retryBackoffSeconds),
  };
}

function serializeDocumentsVersionRetentionExportJob(job) {
  if (!job) {
    return null;
  }

  const deliveryEvents = Array.isArray(job.deliveryHistory)
    ? job.deliveryHistory.map(serializeDocumentsVersionRetentionDeliveryEvent).filter(Boolean)
    : [];
  const lastDeliveryEvent = deliveryEvents[deliveryEvents.length - 1] || null;
  const nextAttemptAt = job.nextAttemptAt?.toISOString?.() || job.nextAttemptAt || null;
  const lastFailureAt = job.lastFailureAt?.toISOString?.() || job.lastFailureAt || null;

  return {
    status: job.status || 'scheduled',
    background_worker: job.backgroundWorker || 'documents-retention-export',
    delivery_id: job.deliveryId,
    idempotency_key: job.idempotencyKey,
    next_attempt_at: nextAttemptAt,
    next_retry_at: job.status === 'failed' ? nextAttemptAt : null,
    last_delivery_at: job.lastDeliveryAt?.toISOString?.() || job.lastDeliveryAt || null,
    last_failure_at: lastFailureAt,
    last_failure_message: job.lastFailureMessage || '',
    attempt_count: asNumber(job.attemptCount),
    failure_count: asNumber(job.failureCount),
    retry_backoff_seconds: asNumber(job.retryBackoffSeconds),
    channels: Array.isArray(job.channels) ? job.channels : ['admin-dashboard-download', 'background-export-worker'],
    payload_type: job.payloadType || 'documents_version_retention_dashboard',
    payload_content_free: job.payloadContentFree !== false,
    pending_alert_count: asNumber(job.pendingAlertCount),
    pending_policy_action_count: asNumber(job.pendingPolicyActionCount),
    destructive_action_count: asNumber(job.destructiveActionCount),
    retention_window_days: asNumber(job.retentionWindowDays, DEFAULT_DOCUMENTS_VERSION_RETENTION_TREND_DAYS),
    max_documents: asNumber(job.maxDocuments, DEFAULT_DOCUMENTS_VERSION_RETENTION_DASHBOARD_MAX_DOCUMENTS),
    requires_worker: job.requiresWorker !== false,
    persisted: true,
    delivery_history_count: deliveryEvents.length,
    last_delivery_status: lastDeliveryEvent?.status || null,
    last_delivery_message: lastDeliveryEvent?.message || '',
    delivery_events: deliveryEvents.slice(-5),
    generated_at: job.generatedAt?.toISOString?.() || job.generatedAt || null,
    created_at: job.createdAt?.toISOString?.() || job.createdAt || null,
    updated_at: job.updatedAt?.toISOString?.() || job.updatedAt || null,
  };
}

function getDocumentsVersionRetentionDeliveredManifests(deliveryHistory = []) {
  const deliveries = (Array.isArray(deliveryHistory) ? deliveryHistory : [])
    .map((delivery) => delivery?.delivery_id ? delivery : serializeDocumentsVersionRetentionExportJob(delivery))
    .filter(Boolean);

  return deliveries
    .flatMap((delivery) => {
      const events = Array.isArray(delivery.delivery_events) ? delivery.delivery_events : [];

      return events
        .filter((event) => event?.status === 'delivered' && event?.manifest_id && event?.payload_hash)
        .map((event) => ({
          delivery_id: delivery.delivery_id,
          manifest_id: event.manifest_id,
          payload_hash: event.payload_hash,
          occurred_at: event.occurred_at || null,
          payload_content_free: delivery.payload_content_free !== false,
          storage_adapter: event.storage_adapter || 'database',
          storage_status: event.storage_status || 'metadata-only',
          storage_ref: event.storage_ref || null,
          storage_path: event.storage_path || null,
          storage_hash: event.storage_hash || event.payload_hash,
          storage_content_free: event.storage_content_free !== false,
          stored_at: event.stored_at || event.occurred_at || null,
        }));
    })
    .filter((manifest) => manifest.payload_content_free && manifest.storage_content_free)
    .sort((a, b) => (
      getDocumentsVersionRetentionTimestamp(b.occurred_at) - getDocumentsVersionRetentionTimestamp(a.occurred_at) ||
      String(b.manifest_id).localeCompare(String(a.manifest_id))
    ));
}

const getDocumentsVersionRetentionExportDeliveryReliability = async ({ now = new Date() } = {}) => {
  const normalizedNow = asDate(now) || new Date();
  const jobs = await DocumentsVersionRetentionExportJob.find({})
    .select('status nextAttemptAt lastDeliveryAt lastFailureAt attemptCount failureCount retryBackoffSeconds')
    .lean();
  const summary = jobs.reduce((acc, job) => {
    const status = job.status || 'scheduled';
    const nextAttemptAt = asDate(job.nextAttemptAt);
    const lastDeliveryAt = asDate(job.lastDeliveryAt);
    const lastFailureAt = asDate(job.lastFailureAt);
    const retryBackoffSeconds = asNumber(job.retryBackoffSeconds);

    acc.job_count += 1;
    acc.attempt_count += asNumber(job.attemptCount);
    acc.failure_count += asNumber(job.failureCount);
    acc.max_retry_backoff_seconds = Math.max(acc.max_retry_backoff_seconds, retryBackoffSeconds);

    if (status === 'delivered') {
      acc.delivered_count += 1;
    } else if (status === 'failed') {
      acc.failed_count += 1;
      if (nextAttemptAt && nextAttemptAt.getTime() <= normalizedNow.getTime()) {
        acc.retry_ready_count += 1;
      } else {
        acc.pending_retry_count += 1;
      }
    } else {
      acc.scheduled_count += 1;
    }

    if (lastDeliveryAt && (!acc.last_delivery_at || lastDeliveryAt > acc.last_delivery_at)) {
      acc.last_delivery_at = lastDeliveryAt;
    }

    if (lastFailureAt && (!acc.last_failure_at || lastFailureAt > acc.last_failure_at)) {
      acc.last_failure_at = lastFailureAt;
    }

    return acc;
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

  return {
    ...summary,
    last_failure_at: summary.last_failure_at?.toISOString?.() || null,
    last_delivery_at: summary.last_delivery_at?.toISOString?.() || null,
  };
};

function createDocumentsVersionRetentionDeliveryManifest(job, deliveredAt = new Date()) {
  const normalizedDeliveredAt = asDate(deliveredAt) || new Date();
  const manifestPayload = {
    type: 'documents_version_retention_delivery_manifest',
    schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
    delivered_at: normalizedDeliveredAt.toISOString(),
    delivery_id: job.deliveryId,
    idempotency_key: job.idempotencyKey,
    payload_type: job.payloadType || 'documents_version_retention_dashboard',
    payload_content_free: job.payloadContentFree !== false,
    retention_window_days: asNumber(job.retentionWindowDays, DEFAULT_DOCUMENTS_VERSION_RETENTION_TREND_DAYS),
    max_documents: asNumber(job.maxDocuments, DEFAULT_DOCUMENTS_VERSION_RETENTION_DASHBOARD_MAX_DOCUMENTS),
    pending_alert_count: asNumber(job.pendingAlertCount),
    pending_policy_action_count: asNumber(job.pendingPolicyActionCount),
    destructive_action_count: asNumber(job.destructiveActionCount),
    channels: Array.isArray(job.channels) ? job.channels : ['admin-dashboard-download', 'background-export-worker'],
  };
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(manifestPayload)).digest('hex');

  return {
    ...manifestPayload,
    manifest_id: `documents-retention-manifest-${payloadHash.slice(0, 16)}`,
    payload_hash: payloadHash,
  };
}

function createDocumentsVersionRetentionDeliveryManifestStorageFileName(manifest) {
  const manifestId = asString(manifest?.manifest_id, 'documents-retention-manifest');
  const safeManifestId = manifestId.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120);

  return `${safeManifestId || 'documents-retention-manifest'}.json`;
}

async function storeDocumentsVersionRetentionDeliveryManifest({
  manifest,
  deliveredAt = new Date(),
  environment = process.env,
  storageClientFactory = createDocumentsVersionRetentionExportS3Client,
} = {}) {
  const normalizedDeliveredAt = asDate(deliveredAt) || new Date();
  const storage = getDocumentsVersionRetentionExportStorageConfig(environment);
  const storagePayload = {
    ...manifest,
    storage_adapter: storage.adapter,
    storage_content_free: true,
    stored_at: normalizedDeliveredAt.toISOString(),
  };
  const storageBody = `${JSON.stringify(storagePayload, null, 2)}\n`;
  const storageHash = crypto.createHash('sha256').update(storageBody).digest('hex');

  if (storage.adapter === 'local-file') {
    const directory = storage.directory || DEFAULT_DOCUMENTS_VERSION_RETENTION_EXPORT_STORAGE_DIR;
    const storagePath = path.join(
      directory,
      createDocumentsVersionRetentionDeliveryManifestStorageFileName(manifest),
    );

    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(storagePath, storageBody, 'utf8');

    return {
      storage_adapter: storage.adapter,
      storage_status: 'stored',
      storage_ref: `local-file:${storagePath}`,
      storage_path: storagePath,
      storage_hash: storageHash,
      storage_content_free: true,
      stored_at: normalizedDeliveredAt.toISOString(),
      message: `Stored content-free retention dashboard manifest ${manifest.manifest_id} on local filesystem.`,
    };
  }

  if (storage.adapter === 's3') {
    const bucket = storage.bucket;

    if (!bucket) {
      throw new Error('DOCUMENTS_RETENTION_EXPORT_S3_BUCKET or AWS_BUCKET_NAME is required for S3 retention export storage.');
    }

    const storagePath = createDocumentsVersionRetentionExportS3Key({ manifest, environment });
    const storageRef = `s3://${bucket}/${storagePath}`;
    const serverSideEncryption = asString(environment?.DOCUMENTS_RETENTION_EXPORT_S3_SERVER_SIDE_ENCRYPTION);
    const kmsKeyId = asString(environment?.DOCUMENTS_RETENTION_EXPORT_S3_KMS_KEY_ID);
    const client = storageClientFactory(environment);

    if (!client?.send) {
      throw new Error('S3 retention export storage client is unavailable.');
    }

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: storagePath,
      Body: storageBody,
      ContentType: 'application/json',
      Metadata: {
        'payload-content-free': 'true',
        'payload-hash': manifest.payload_hash,
        'storage-hash': storageHash,
        'manifest-id': manifest.manifest_id,
      },
      ...(serverSideEncryption ? { ServerSideEncryption: serverSideEncryption } : {}),
      ...(kmsKeyId ? { SSEKMSKeyId: kmsKeyId } : {}),
    }));

    return {
      storage_adapter: storage.adapter,
      storage_status: 'stored',
      storage_ref: storageRef,
      storage_path: storagePath,
      storage_hash: storageHash,
      storage_content_free: true,
      stored_at: normalizedDeliveredAt.toISOString(),
      message: `Stored content-free retention dashboard manifest ${manifest.manifest_id} in S3-compatible storage.`,
    };
  }

  return {
    storage_adapter: 'database',
    storage_status: 'metadata-only',
    storage_ref: `database:DocumentsVersionRetentionExportJob:${manifest.delivery_id}`,
    storage_path: null,
    storage_hash: manifest.payload_hash,
    storage_content_free: true,
    stored_at: normalizedDeliveredAt.toISOString(),
    message: `Recorded content-free retention dashboard manifest ${manifest.manifest_id} metadata in delivery history.`,
  };
}

const upsertDocumentsVersionRetentionExportJob = async ({
  deliveryPlan,
  exportSchedule,
  generatedAt = new Date(),
  policyAutomation,
} = {}) => {
  const plan = deliveryPlan || createDocumentsVersionRetentionExportDeliveryPlan({
    generatedAt,
    exportSchedule,
    alerts: [],
    policyAutomation,
  });
  const normalizedGeneratedAt = asDate(generatedAt) || new Date();
  const nextAttemptAt = asDate(plan.next_attempt_at);
  const update = {
    deliveryId: plan.delivery_id,
    idempotencyKey: plan.idempotency_key,
    status: plan.status || 'scheduled',
    backgroundWorker: plan.background_worker || 'documents-retention-export',
    nextAttemptAt,
    channels: Array.isArray(plan.channels) ? plan.channels : ['admin-dashboard-download', 'background-export-worker'],
    payloadType: plan.payload_type || 'documents_version_retention_dashboard',
    payloadContentFree: plan.payload_content_free !== false,
    retentionWindowDays: asNumber(exportSchedule?.retention_window_days, DEFAULT_DOCUMENTS_VERSION_RETENTION_TREND_DAYS),
    maxDocuments: asNumber(exportSchedule?.max_documents, DEFAULT_DOCUMENTS_VERSION_RETENTION_DASHBOARD_MAX_DOCUMENTS),
    pendingAlertCount: asNumber(plan.pending_alert_count),
    pendingPolicyActionCount: asNumber(plan.pending_policy_action_count),
    destructiveActionCount: asNumber(policyAutomation?.destructive_action_count),
    requiresWorker: plan.requires_worker !== false,
    generatedAt: normalizedGeneratedAt,
  };

  const existing = await DocumentsVersionRetentionExportJob.findOne({ idempotencyKey: update.idempotencyKey })
    .select([
      '_id',
      'status',
      'nextAttemptAt',
      'lastDeliveryAt',
      'lastFailureAt',
      'lastFailureMessage',
      'attemptCount',
      'failureCount',
      'retryBackoffSeconds',
      'deliveryHistory',
      'requiresWorker',
    ].join(' '))
    .lean();

  if (existing) {
    const alreadyDelivered = existing.status === 'delivered';
    const awaitingRetry = existing.status === 'failed';
    const existingUpdate = {
      ...update,
      status: alreadyDelivered || awaitingRetry ? existing.status : update.status,
      requiresWorker: alreadyDelivered ? false : awaitingRetry ? true : update.requiresWorker,
      attemptCount: asNumber(existing.attemptCount),
      failureCount: asNumber(existing.failureCount),
      lastFailureAt: existing.lastFailureAt || null,
      lastFailureMessage: existing.lastFailureMessage || '',
      retryBackoffSeconds: asNumber(existing.retryBackoffSeconds),
    };

    if (alreadyDelivered) {
      existingUpdate.lastDeliveryAt = existing.lastDeliveryAt;
      existingUpdate.nextAttemptAt = null;
      existingUpdate.retryBackoffSeconds = 0;
    } else if (awaitingRetry) {
      existingUpdate.nextAttemptAt = existing.nextAttemptAt || update.nextAttemptAt;
    }

    return await DocumentsVersionRetentionExportJob.findOneAndUpdate(
      { _id: existing._id },
      { $set: existingUpdate },
      { new: true },
    ).lean();
  }

  return await DocumentsVersionRetentionExportJob.create({
    ...update,
    deliveryHistory: [{
      status: update.status,
      occurredAt: normalizedGeneratedAt,
      message: 'Scheduled content-free retention dashboard export.',
      pendingAlertCount: update.pendingAlertCount,
      pendingPolicyActionCount: update.pendingPolicyActionCount,
    }],
  });
};

const getDocumentsVersionRetentionExportDeliveryHistory = async ({ limit = 5 } = {}) => {
  const normalizedLimit = asPositiveInteger(limit, 5, 20);

  return await DocumentsVersionRetentionExportJob.find({})
    .sort({ updatedAt: -1, nextAttemptAt: -1 })
    .limit(normalizedLimit)
    .lean();
};

const countDueDocumentsVersionRetentionExportJobs = async ({ now = new Date() } = {}) => {
  const normalizedNow = asDate(now) || new Date();

  return await DocumentsVersionRetentionExportJob.countDocuments({
    status: { $in: ['scheduled', 'failed'] },
    nextAttemptAt: { $ne: null, $lte: normalizedNow },
  });
};

const recordDocumentsVersionRetentionExportJobFailure = async ({ job, failedAt, message }) => {
  const normalizedFailedAt = asDate(failedAt) || new Date();
  const nextFailureCount = asNumber(job.failureCount) + 1;
  const nextAttemptCount = asNumber(job.attemptCount) + 1;
  const retryBackoffSeconds = getDocumentsVersionRetentionRetryBackoffSeconds(nextFailureCount);
  const retryAt = new Date(normalizedFailedAt.getTime() + retryBackoffSeconds * 1000);
  const failureMessage = message || 'Retention dashboard export dispatch failed.';
  const event = {
    status: 'failed',
    occurredAt: normalizedFailedAt,
    message: failureMessage,
    pendingAlertCount: asNumber(job.pendingAlertCount),
    pendingPolicyActionCount: asNumber(job.pendingPolicyActionCount),
    retryAfterAt: retryAt,
    retryBackoffSeconds,
  };

  return await DocumentsVersionRetentionExportJob.findOneAndUpdate(
    { _id: job._id },
    {
      $set: {
        status: 'failed',
        nextAttemptAt: retryAt,
        lastFailureAt: normalizedFailedAt,
        lastFailureMessage: failureMessage,
        attemptCount: nextAttemptCount,
        failureCount: nextFailureCount,
        retryBackoffSeconds,
        requiresWorker: true,
      },
      $push: {
        deliveryHistory: {
          $each: [event],
          $slice: -20,
        },
      },
    },
    { new: true },
  ).lean();
};

const recordDocumentsVersionRetentionExportJobDelivery = async ({
  job,
  deliveredAt,
  environment = process.env,
  storageClientFactory = createDocumentsVersionRetentionExportS3Client,
}) => {
  const normalizedDeliveredAt = asDate(deliveredAt) || new Date();
  const nextAttemptCount = asNumber(job.attemptCount) + 1;
  const manifest = createDocumentsVersionRetentionDeliveryManifest(job, normalizedDeliveredAt);
  const storage = await storeDocumentsVersionRetentionDeliveryManifest({
    manifest,
    deliveredAt: normalizedDeliveredAt,
    environment,
    storageClientFactory,
  });
  const event = {
    status: 'delivered',
    occurredAt: normalizedDeliveredAt,
    message: storage.message || `Dispatched content-free retention dashboard manifest ${manifest.manifest_id}.`,
    manifestId: manifest.manifest_id,
    payloadHash: manifest.payload_hash,
    storageAdapter: storage.storage_adapter,
    storageStatus: storage.storage_status,
    storageRef: storage.storage_ref,
    storagePath: storage.storage_path,
    storageHash: storage.storage_hash,
    storageContentFree: storage.storage_content_free !== false,
    storedAt: asDate(storage.stored_at) || normalizedDeliveredAt,
    pendingAlertCount: asNumber(job.pendingAlertCount),
    pendingPolicyActionCount: asNumber(job.pendingPolicyActionCount),
  };
  const updatedJob = await DocumentsVersionRetentionExportJob.findOneAndUpdate(
    { _id: job._id },
    {
      $set: {
        status: 'delivered',
        lastDeliveryAt: normalizedDeliveredAt,
        nextAttemptAt: null,
        attemptCount: nextAttemptCount,
        retryBackoffSeconds: 0,
        requiresWorker: false,
      },
      $push: {
        deliveryHistory: {
          $each: [event],
          $slice: -20,
        },
      },
    },
    { new: true },
  ).lean();

  return {
    job: updatedJob,
    manifest: {
      ...manifest,
      ...storage,
    },
  };
};

const dispatchDocumentsVersionRetentionExportJobs = async ({
  now = new Date(),
  limit = 10,
  environment = process.env,
  storageClientFactory = createDocumentsVersionRetentionExportS3Client,
} = {}) => {
  const normalizedNow = asDate(now) || new Date();
  const normalizedLimit = asPositiveInteger(limit, 10, 50);
  const jobs = await DocumentsVersionRetentionExportJob.find({
    status: { $in: ['scheduled', 'failed'] },
    nextAttemptAt: { $ne: null, $lte: normalizedNow },
  })
    .sort({ nextAttemptAt: 1, updatedAt: 1 })
    .limit(normalizedLimit)
    .lean();
  const deliveries = [];
  const manifests = [];
  let failedCount = 0;

  for (const job of jobs) {
    if (job.payloadContentFree !== true) {
      const failedJob = await recordDocumentsVersionRetentionExportJobFailure({
        job,
        failedAt: normalizedNow,
        message: 'Blocked retention dashboard export because the payload was not marked content-free.',
      });
      failedCount += 1;
      deliveries.push(serializeDocumentsVersionRetentionExportJob(failedJob));
      continue;
    }

    try {
      const result = await recordDocumentsVersionRetentionExportJobDelivery({
        job,
        deliveredAt: normalizedNow,
        environment,
        storageClientFactory,
      });
      deliveries.push(serializeDocumentsVersionRetentionExportJob(result.job));
      manifests.push(result.manifest);
    } catch (error) {
      const failureMessage = `Retention dashboard export storage failed: ${asString(error?.message, 'unknown error')}`;
      logger.warn('[DocumentsVersionSnapshot] Failed to store retention export manifest', error);
      const failedJob = await recordDocumentsVersionRetentionExportJobFailure({
        job,
        failedAt: normalizedNow,
        message: failureMessage,
      });
      failedCount += 1;
      deliveries.push(serializeDocumentsVersionRetentionExportJob(failedJob));
    }
  }

  return {
    type: 'documents_version_retention_export_dispatch',
    schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
    generated_at: normalizedNow.toISOString(),
    worker: 'documents-retention-export',
    attempted_count: jobs.length,
    dispatched_count: manifests.length,
    failed_count: failedCount,
    payload_content_free: true,
    deliveries: deliveries.filter(Boolean),
    manifests,
  };
};

const pruneDocumentsVersionSnapshots = async ({
  documentId,
  maxSnapshots = getDocumentsVersionHistoryMaxSnapshots(),
} = {}) => {
  const normalizedDocumentId = asString(documentId);
  const normalizedMaxSnapshots = asPositiveInteger(
    maxSnapshots,
    DEFAULT_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS,
    MAX_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS,
  );

  if (!normalizedDocumentId) {
    throw new Error('documentId is required');
  }

  const snapshots = await DocumentsVersionSnapshot.find({ documentId: normalizedDocumentId })
    .sort({ versionNumber: -1, savedAt: -1 })
    .select('_id retentionPolicy retainedUntil')
    .lean();

  if (snapshots.length <= normalizedMaxSnapshots) {
    return {
      deletedCount: 0,
      keptCount: snapshots.length,
      maxSnapshots: normalizedMaxSnapshots,
    };
  }

  const now = new Date();
  const removable = snapshots
    .slice(normalizedMaxSnapshots)
    .filter((snapshot) => !isDocumentsVersionSnapshotProtected(snapshot, now));
  const removableIds = removable.map((snapshot) => snapshot._id).filter(Boolean);

  if (removableIds.length === 0) {
    return {
      deletedCount: 0,
      keptCount: snapshots.length,
      maxSnapshots: normalizedMaxSnapshots,
    };
  }

  const result = await DocumentsVersionSnapshot.deleteMany({ _id: { $in: removableIds } });

  return {
    deletedCount: result.deletedCount || 0,
    keptCount: snapshots.length - (result.deletedCount || 0),
    maxSnapshots: normalizedMaxSnapshots,
  };
};

function compareDocumentsVersionSnapshotRecency(a, b) {
  const versionDifference = asNumber(b?.versionNumber) - asNumber(a?.versionNumber);

  if (versionDifference !== 0) {
    return versionDifference;
  }

  const bSavedAt = asDate(b?.savedAt || b?.createdAt || b?.updatedAt)?.getTime() || 0;
  const aSavedAt = asDate(a?.savedAt || a?.createdAt || a?.updatedAt)?.getTime() || 0;

  if (bSavedAt !== aSavedAt) {
    return bSavedAt - aSavedAt;
  }

  return String(b?.snapshotId || '').localeCompare(String(a?.snapshotId || ''));
}

function compareDocumentsVersionPrunePriority(a, b) {
  const aSavedAt = asDate(a?.savedAt || a?.createdAt || a?.updatedAt)?.getTime() || 0;
  const bSavedAt = asDate(b?.savedAt || b?.createdAt || b?.updatedAt)?.getTime() || 0;

  if (aSavedAt !== bSavedAt) {
    return aSavedAt - bSavedAt;
  }

  return String(a?.documentId || '').localeCompare(String(b?.documentId || '')) ||
    asNumber(a?.versionNumber) - asNumber(b?.versionNumber) ||
    String(a?.snapshotId || '').localeCompare(String(b?.snapshotId || ''));
}

function serializeDocumentsVersionSnapshotPruneCandidate(snapshot) {
  if (!snapshot) {
    return null;
  }

  return {
    snapshot_id: snapshot.snapshotId,
    document_id: snapshot.documentId,
    title: snapshot.title || 'Untitled Document',
    version_number: asNumber(snapshot.versionNumber),
    retention_policy: normalizeRetentionPolicy(snapshot.retentionPolicy),
    retained_until: serializeReportDate(snapshot.retainedUntil),
    origin: snapshot.origin || 'legacy',
    schema_version: asNumber(snapshot.schemaVersion, DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION),
    content_hash: snapshot.contentHash || '',
    saved_at: serializeReportDate(snapshot.savedAt || snapshot.createdAt || snapshot.updatedAt),
    created_at: serializeReportDate(snapshot.createdAt),
    updated_at: serializeReportDate(snapshot.updatedAt),
  };
}

function buildDocumentsVersionSnapshotPrunePlan(snapshots, {
  maxSnapshots = getDocumentsVersionHistoryMaxSnapshots(),
  limit = DEFAULT_DOCUMENTS_VERSION_RETENTION_PRUNE_CANDIDATE_LIMIT,
  now = new Date(),
} = {}) {
  const normalizedNow = asDate(now) || new Date();
  const normalizedMaxSnapshots = asPositiveInteger(
    maxSnapshots,
    DEFAULT_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS,
    MAX_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS,
  );
  const normalizedLimit = getDocumentsVersionRetentionPruneCandidateLimit(limit);
  const groupedSnapshots = (Array.isArray(snapshots) ? snapshots : []).reduce((acc, snapshot) => {
    const documentId = asString(snapshot?.documentId);
    if (!documentId) return acc;
    if (!acc.has(documentId)) {
      acc.set(documentId, []);
    }
    acc.get(documentId).push(snapshot);
    return acc;
  }, new Map());
  const documentSummaries = [];
  const allCandidates = [];

  groupedSnapshots.forEach((documentSnapshots, documentId) => {
    const sortedSnapshots = [...documentSnapshots].sort(compareDocumentsVersionSnapshotRecency);
    const retentionReport = summarizeDocumentsVersionSnapshotRetention(sortedSnapshots, {
      maxSnapshots: normalizedMaxSnapshots,
      now: normalizedNow,
    });
    const candidates = sortedSnapshots
      .slice(normalizedMaxSnapshots)
      .filter((snapshot) => !isDocumentsVersionSnapshotProtected(snapshot, normalizedNow));

    if (candidates.length === 0 && retentionReport.over_limit_count === 0) {
      return;
    }

    const sortedCandidates = [...candidates].sort(compareDocumentsVersionPrunePriority);
    const oldestCandidate = sortedCandidates[0] || null;
    const newestCandidate = sortedCandidates[sortedCandidates.length - 1] || null;
    const latestSnapshot = sortedSnapshots[0] || null;

    sortedCandidates.forEach((candidate) => allCandidates.push(candidate));
    documentSummaries.push({
      document_id: documentId,
      title: latestSnapshot?.title || 'Untitled Document',
      snapshot_count: retentionReport.total_count,
      protected_count: retentionReport.protected_count,
      prunable_count: retentionReport.prunable_count,
      over_limit_count: retentionReport.over_limit_count,
      candidate_count: sortedCandidates.length,
      latest_snapshot_at: serializeReportDate(
        latestSnapshot?.savedAt || latestSnapshot?.createdAt || latestSnapshot?.updatedAt,
      ),
      oldest_candidate_at: serializeReportDate(
        oldestCandidate?.savedAt || oldestCandidate?.createdAt || oldestCandidate?.updatedAt,
      ),
      newest_candidate_at: serializeReportDate(
        newestCandidate?.savedAt || newestCandidate?.createdAt || newestCandidate?.updatedAt,
      ),
    });
  });

  const sortedCandidates = allCandidates.sort(compareDocumentsVersionPrunePriority);
  const limitedCandidates = sortedCandidates.slice(0, normalizedLimit);

  return {
    max_snapshots: normalizedMaxSnapshots,
    candidate_limit: normalizedLimit,
    total_candidate_count: sortedCandidates.length,
    candidate_count: limitedCandidates.length,
    limited: sortedCandidates.length > limitedCandidates.length,
    documents_count: groupedSnapshots.size,
    affected_documents_count: documentSummaries.filter((summary) => summary.candidate_count > 0).length,
    documents: documentSummaries
      .sort((a, b) => (
        b.candidate_count - a.candidate_count ||
        b.over_limit_count - a.over_limit_count ||
        String(a.document_id).localeCompare(String(b.document_id))
      )),
    candidates: limitedCandidates
      .map(serializeDocumentsVersionSnapshotPruneCandidate)
      .filter(Boolean),
  };
}

const previewDocumentsVersionSnapshotRetentionPrune = async ({
  maxSnapshots = getDocumentsVersionHistoryMaxSnapshots(),
  limit = DEFAULT_DOCUMENTS_VERSION_RETENTION_PRUNE_CANDIDATE_LIMIT,
  now = new Date(),
} = {}) => {
  const normalizedNow = asDate(now) || new Date();
  const snapshots = await DocumentsVersionSnapshot.find({})
    .sort({ documentId: 1, versionNumber: -1, savedAt: -1 })
    .select('documentId snapshotId title versionNumber retentionPolicy retainedUntil origin schemaVersion contentHash savedAt createdAt updatedAt')
    .lean();
  const plan = buildDocumentsVersionSnapshotPrunePlan(snapshots, {
    maxSnapshots,
    limit,
    now: normalizedNow,
  });

  return {
    type: 'documents_version_retention_prune_preview',
    schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
    generated_at: normalizedNow.toISOString(),
    scope: 'admin',
    mode: 'dry-run',
    payload_content_free: true,
    confirmation_required: true,
    confirmation_token: DOCUMENTS_VERSION_RETENTION_PRUNE_CONFIRMATION,
    safeguards: [
      'Deletes only unprotected snapshots beyond the keep-latest cap.',
      'Never deletes keep-forever snapshots or active retain-until snapshots.',
      'Returns only snapshot metadata, provenance, and hashes; document body content is excluded.',
    ],
    ...plan,
  };
};

function createDocumentsVersionRetentionRestoreDrill({
  preview,
  deletedCount = 0,
  remainingCandidateCount = 0,
  executedAt = new Date(),
} = {}) {
  const sampleCandidate = Array.isArray(preview?.candidates) ? preview.candidates[0] : null;
  const normalizedDeletedCount = asNumber(deletedCount);

  return {
    type: 'documents_version_retention_restore_drill',
    status: normalizedDeletedCount > 0 ? 'required' : 'not-required',
    payload_content_free: true,
    generated_at: serializeReportDate(executedAt),
    deleted_count: normalizedDeletedCount,
    remaining_candidate_count: asNumber(remainingCandidateCount),
    sample: sampleCandidate
      ? {
          snapshot_id: sampleCandidate.snapshot_id,
          document_id: sampleCandidate.document_id,
          version_number: sampleCandidate.version_number,
          content_hash: sampleCandidate.content_hash,
          saved_at: sampleCandidate.saved_at,
        }
      : null,
    checks: [
      'Audit captured snapshot ids, document ids, version numbers, timestamps, and content hashes for deleted candidates.',
      'Primary durable history no longer contains deleted snapshot body content after pruning.',
      'Restore drills must use an external backup, export, replica, or pre-prune backup package for any deleted snapshot body.',
      'Run a restore drill before enabling scheduled prune automation.',
    ],
    message: normalizedDeletedCount > 0
      ? 'Confirmed pruning completed. Run a restore drill from backup/export storage using the audit sample before automating pruning.'
      : 'No snapshots were deleted, so no restore drill is required for this pass.',
  };
}

function serializeDocumentsVersionRetentionPruneAudit(audit) {
  if (!audit) {
    return null;
  }

  return {
    audit_id: audit.auditId,
    type: 'documents_version_retention_prune_audit',
    mode: audit.mode || 'confirmed-delete',
    status: audit.status || 'completed',
    requested_by: audit.requestedBy || null,
    payload_content_free: audit.payloadContentFree !== false,
    confirmation_token: audit.confirmationToken || DOCUMENTS_VERSION_RETENTION_PRUNE_CONFIRMATION,
    confirmation_matched: audit.confirmationMatched !== false,
    max_snapshots: asNumber(audit.maxSnapshots, DEFAULT_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS),
    candidate_limit: asNumber(audit.candidateLimit, DEFAULT_DOCUMENTS_VERSION_RETENTION_PRUNE_CANDIDATE_LIMIT),
    total_candidate_count: asNumber(audit.totalCandidateCount),
    candidate_count: asNumber(audit.candidateCount),
    affected_documents_count: asNumber(audit.affectedDocumentsCount),
    deleted_count: asNumber(audit.deletedCount),
    remaining_candidate_count: asNumber(audit.remainingCandidateCount),
    limited: audit.limited === true,
    safeguards: Array.isArray(audit.safeguards) ? audit.safeguards : [],
    documents: Array.isArray(audit.documents) ? audit.documents : [],
    candidates: Array.isArray(audit.candidates) ? audit.candidates : [],
    restore_drill: asPlainObject(audit.restoreDrill, {}),
    generated_at: serializeReportDate(audit.generatedAt),
    executed_at: serializeReportDate(audit.executedAt),
    created_at: serializeReportDate(audit.createdAt),
    updated_at: serializeReportDate(audit.updatedAt),
  };
}

const recordDocumentsVersionRetentionPruneAudit = async ({
  preview,
  deletedCount = 0,
  remainingCandidateCount = 0,
  executedAt = new Date(),
  requestedBy = '',
} = {}) => {
  const normalizedExecutedAt = asDate(executedAt) || new Date();
  const restoreDrill = createDocumentsVersionRetentionRestoreDrill({
    preview,
    deletedCount,
    remainingCandidateCount,
    executedAt: normalizedExecutedAt,
  });

  const audit = await DocumentsVersionRetentionPruneAudit.create({
    auditId: `documents-retention-prune-${crypto.randomUUID()}`,
    mode: 'confirmed-delete',
    status: 'completed',
    requestedBy,
    payloadContentFree: true,
    confirmationToken: DOCUMENTS_VERSION_RETENTION_PRUNE_CONFIRMATION,
    confirmationMatched: true,
    maxSnapshots: asNumber(preview?.max_snapshots, DEFAULT_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS),
    candidateLimit: asNumber(preview?.candidate_limit, DEFAULT_DOCUMENTS_VERSION_RETENTION_PRUNE_CANDIDATE_LIMIT),
    totalCandidateCount: asNumber(preview?.total_candidate_count),
    candidateCount: asNumber(preview?.candidate_count),
    affectedDocumentsCount: asNumber(preview?.affected_documents_count),
    deletedCount,
    remainingCandidateCount,
    limited: preview?.limited === true,
    safeguards: Array.isArray(preview?.safeguards) ? preview.safeguards : [],
    documents: Array.isArray(preview?.documents) ? preview.documents : [],
    candidates: Array.isArray(preview?.candidates) ? preview.candidates : [],
    restoreDrill,
    generatedAt: asDate(preview?.generated_at) || normalizedExecutedAt,
    executedAt: normalizedExecutedAt,
  });

  return serializeDocumentsVersionRetentionPruneAudit(audit.toObject?.() || audit);
};

const getDocumentsVersionRetentionPruneAuditHistory = async ({ limit = 5 } = {}) => {
  const normalizedLimit = asPositiveInteger(limit, 5, 20);
  const audits = await DocumentsVersionRetentionPruneAudit.find({})
    .sort({ executedAt: -1, createdAt: -1 })
    .limit(normalizedLimit)
    .lean();

  return audits
    .map(serializeDocumentsVersionRetentionPruneAudit)
    .filter(Boolean);
};

function createDocumentsVersionRetentionError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function isDocumentsVersionRestoreDrillComplete(restoreDrill) {
  const drill = asPlainObject(restoreDrill, {});
  return drill.status === 'completed' ||
    drill?.execution?.status === 'completed' ||
    Boolean(drill.completed_at || drill.completedAt);
}

function getDocumentsVersionRetentionTimestamp(value) {
  const date = asDate(value);
  return date ? date.getTime() : 0;
}

function getDocumentsVersionRetentionScheduledPruneEnabled(environment = process.env) {
  return asBoolean(environment?.DOCUMENTS_RETENTION_SCHEDULED_PRUNE_ENABLED, false);
}

function summarizeDocumentsVersionRetentionScheduledPruneGuardrails({
  auditHistory = [],
  environment = process.env,
  now = new Date(),
} = {}) {
  const normalizedNow = asDate(now) || new Date();
  const audits = Array.isArray(auditHistory) ? auditHistory : [];
  const latestAudit = audits[0] || null;
  const requiredRestoreDrills = audits.filter((audit) => {
    const deletedCount = asNumber(audit?.deleted_count ?? audit?.deletedCount);
    return deletedCount > 0 && !isDocumentsVersionRestoreDrillComplete(audit?.restore_drill ?? audit?.restoreDrill);
  });
  const completedDrills = audits
    .map((audit) => asPlainObject(audit?.restore_drill ?? audit?.restoreDrill, {}))
    .filter(isDocumentsVersionRestoreDrillComplete);
  const latestCompletedDrill = completedDrills[0] || null;
  const enabledRequested = getDocumentsVersionRetentionScheduledPruneEnabled(environment);
  const hasRequiredDrill = requiredRestoreDrills.length > 0;
  const scheduledPruneAllowed = enabledRequested && !hasRequiredDrill && Boolean(latestCompletedDrill);
  const status = enabledRequested
    ? scheduledPruneAllowed
      ? 'ready'
      : 'blocked'
    : 'manual-only';

  return {
    type: 'documents_version_retention_scheduled_prune_guardrails',
    payload_content_free: true,
    generated_at: normalizedNow.toISOString(),
    enabled_requested: enabledRequested,
    status,
    scheduled_prune_allowed: scheduledPruneAllowed,
    required_restore_drill_count: requiredRestoreDrills.length,
    latest_audit_id: latestAudit?.audit_id || latestAudit?.auditId || null,
    latest_restore_drill_status: latestAudit?.restore_drill?.status || latestAudit?.restoreDrill?.status || null,
    last_completed_restore_drill_at: latestCompletedDrill?.completed_at ||
      latestCompletedDrill?.completedAt ||
      latestCompletedDrill?.execution?.executed_at ||
      latestCompletedDrill?.execution?.executedAt ||
      null,
    confirmation_token: DOCUMENTS_VERSION_RETENTION_PRUNE_CONFIRMATION,
    safeguards: [
      'No scheduled prune worker is registered by this guardrail report.',
      'Scheduled pruning stays blocked while any deleted-snapshot audit still requires a restore drill.',
      'Automation must keep using content-free prune preview metadata before any delete pass.',
      'Automation must still require an explicit admin confirmation token before pruning snapshots.',
    ],
    message: status === 'manual-only'
      ? 'Scheduled pruning is disabled; manual prune execution remains the only delete path.'
      : scheduledPruneAllowed
        ? 'Scheduled pruning guardrails are clear, but destructive automation still needs a separate scheduler implementation and admin confirmation gate.'
        : 'Scheduled pruning is blocked until the latest required restore drill is completed from backup/export storage.',
  };
}

const getDocumentsVersionRetentionScheduledPruneGuardrails = async ({
  auditHistory = null,
  environment = process.env,
  now = new Date(),
} = {}) => {
  const audits = Array.isArray(auditHistory)
    ? auditHistory
    : await getDocumentsVersionRetentionPruneAuditHistory({ limit: 20 });

  return summarizeDocumentsVersionRetentionScheduledPruneGuardrails({
    auditHistory: audits,
    environment,
    now,
  });
};

function serializeDocumentsVersionRetentionRunbookEvidence(evidence) {
  if (!evidence) {
    return null;
  }

  return {
    type: 'documents_version_retention_runbook_evidence',
    evidence_id: evidence.evidenceId || evidence.evidence_id || '',
    evidence_type: evidence.evidenceType || evidence.evidence_type || 'backup-verification',
    status: evidence.status || 'export-required',
    requested_by: evidence.requestedBy || evidence.requested_by || null,
    payload_content_free: evidence.payloadContentFree !== false && evidence.payload_content_free !== false,
    storage_adapter: evidence.storageAdapter || evidence.storage_adapter || 'database',
    report_hash: evidence.reportHash || evidence.report_hash || '',
    latest_manifest_id: evidence.latestManifestId || evidence.latest_manifest_id || null,
    latest_payload_hash: evidence.latestPayloadHash || evidence.latest_payload_hash || null,
    latest_delivery_id: evidence.latestDeliveryId || evidence.latest_delivery_id || null,
    latest_delivery_at: evidence.latestDeliveryAt?.toISOString?.() || evidence.latestDeliveryAt || evidence.latest_delivery_at || null,
    backup_storage_ready: evidence.backupStorageReady === true || evidence.backup_storage_ready === true,
    latest_storage_adapter: evidence.latestStorageAdapter || evidence.latest_storage_adapter || null,
    latest_storage_status: evidence.latestStorageStatus || evidence.latest_storage_status || null,
    latest_storage_ref: evidence.latestStorageRef || evidence.latest_storage_ref || null,
    latest_storage_hash: evidence.latestStorageHash || evidence.latest_storage_hash || null,
    latest_stored_at: evidence.latestStoredAt?.toISOString?.() || evidence.latestStoredAt || evidence.latest_stored_at || null,
    backup_export_ready: evidence.backupExportReady === true || evidence.backup_export_ready === true,
    backup_handoff_ready: evidence.backupHandoffReady === true || evidence.backup_handoff_ready === true,
    delivered_manifest_count: asNumber(evidence.deliveredManifestCount ?? evidence.delivered_manifest_count),
    failed_delivery_count: asNumber(evidence.failedDeliveryCount ?? evidence.failed_delivery_count),
    pending_delivery_count: asNumber(evidence.pendingDeliveryCount ?? evidence.pending_delivery_count),
    prune_audit_count: asNumber(evidence.pruneAuditCount ?? evidence.prune_audit_count),
    required_restore_drill_count: asNumber(evidence.requiredRestoreDrillCount ?? evidence.required_restore_drill_count),
    completed_restore_drill_count: asNumber(evidence.completedRestoreDrillCount ?? evidence.completed_restore_drill_count),
    scheduled_prune_allowed: evidence.scheduledPruneAllowed === true || evidence.scheduled_prune_allowed === true,
    scheduled_prune_status: evidence.scheduledPruneStatus || evidence.scheduled_prune_status || 'manual-only',
    checks: Array.isArray(evidence.checks) ? evidence.checks : [],
    runbook_steps: Array.isArray(evidence.runbookSteps)
      ? evidence.runbookSteps
      : Array.isArray(evidence.runbook_steps) ? evidence.runbook_steps : [],
    message: evidence.message || '',
    generated_at: evidence.generatedAt?.toISOString?.() || evidence.generatedAt || evidence.generated_at || null,
    recorded_at: evidence.recordedAt?.toISOString?.() || evidence.recordedAt || evidence.recorded_at || null,
    expires_at: evidence.expiresAt?.toISOString?.() || evidence.expiresAt || evidence.expires_at || null,
  };
}

function serializeDocumentsVersionRetentionReminderNotification(notification) {
  if (!notification) {
    return null;
  }

  return {
    type: 'documents_version_retention_evidence_reminder_notification',
    notification_id: notification.notificationId || notification.notification_id || '',
    idempotency_key: notification.idempotencyKey || notification.idempotency_key || '',
    reminder_type: notification.reminderType || notification.reminder_type || 'documents_version_retention_evidence_reminder',
    reminder_status: notification.reminderStatus || notification.reminder_status || 'missing',
    severity: notification.severity || 'warning',
    review_required: notification.reviewRequired === true || notification.review_required === true,
    status: notification.status || 'scheduled',
    delivery_adapter: notification.deliveryAdapter || notification.delivery_adapter || 'internal-ledger',
    delivery_target: notification.deliveryTarget || notification.delivery_target || 'retention-dashboard',
    channels: Array.isArray(notification.channels) ? notification.channels : ['retention-dashboard', 'admin-runbook'],
    payload_content_free: notification.payloadContentFree !== false && notification.payload_content_free !== false,
    payload_hash: notification.payloadHash || notification.payload_hash || '',
    latest_evidence_id: notification.latestEvidenceId || notification.latest_evidence_id || null,
    latest_manifest_id: notification.latestManifestId || notification.latest_manifest_id || null,
    latest_payload_hash: notification.latestPayloadHash || notification.latest_payload_hash || null,
    due_at: notification.dueAt?.toISOString?.() || notification.dueAt || notification.due_at || null,
    next_review_at: notification.nextReviewAt?.toISOString?.() || notification.nextReviewAt || notification.next_review_at || null,
    generated_at: notification.generatedAt?.toISOString?.() || notification.generatedAt || notification.generated_at || null,
    delivered_at: notification.deliveredAt?.toISOString?.() || notification.deliveredAt || notification.delivered_at || null,
    last_failure_at: notification.lastFailureAt?.toISOString?.() || notification.lastFailureAt || notification.last_failure_at || null,
    last_failure_message: notification.lastFailureMessage || notification.last_failure_message || '',
    attempt_count: asNumber(notification.attemptCount ?? notification.attempt_count),
    failure_count: asNumber(notification.failureCount ?? notification.failure_count),
    retry_after_at: notification.retryAfterAt?.toISOString?.() || notification.retryAfterAt || notification.retry_after_at || null,
    retry_backoff_seconds: asNumber(notification.retryBackoffSeconds ?? notification.retry_backoff_seconds),
    response_status: asNumber(notification.responseStatus ?? notification.response_status),
    response_body_hash: notification.responseBodyHash || notification.response_body_hash || '',
    message: notification.message || '',
    created_at: notification.createdAt?.toISOString?.() || notification.createdAt || null,
    updated_at: notification.updatedAt?.toISOString?.() || notification.updatedAt || null,
  };
}

function createDocumentsVersionRetentionEvidenceReminder({
  evidenceReviewStatus = 'missing',
  evidenceExpiresInDays = null,
  latestEvidence = null,
  latestEvidenceExpiresAt = null,
  now = new Date(),
} = {}) {
  const normalizedNow = asDate(now) || new Date();
  const expiresAt = asDate(latestEvidenceExpiresAt);
  const warningReviewAt = expiresAt
    ? new Date(expiresAt.getTime() - DOCUMENTS_VERSION_RETENTION_EVIDENCE_EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000)
    : null;
  const status = ['missing', 'current', 'expiring-soon', 'expired'].includes(evidenceReviewStatus)
    ? evidenceReviewStatus
    : 'missing';
  const reviewRequired = status !== 'current';
  const severity = status === 'expired'
    ? 'critical'
    : status === 'expiring-soon' || status === 'missing'
      ? 'warning'
      : 'info';
  const nextReviewAt = reviewRequired
    ? normalizedNow
    : warningReviewAt && warningReviewAt.getTime() > normalizedNow.getTime()
      ? warningReviewAt
      : normalizedNow;
  const dueAt = status === 'current'
    ? warningReviewAt || expiresAt
    : expiresAt || normalizedNow;
  const message = status === 'current'
    ? 'Runbook evidence is current; review it again before the expiry warning window opens.'
    : status === 'expiring-soon'
      ? 'Runbook evidence is nearing expiry; refresh evidence before scheduled-prune hardening advances.'
      : status === 'expired'
        ? 'Runbook evidence has expired; record fresh backup verification evidence before pruning work advances.'
        : 'No runbook evidence has been recorded; record backup verification evidence after export storage is ready.';
  const recommendedAction = status === 'current'
    ? 'Review evidence again before the warning window opens.'
    : status === 'missing'
      ? 'Dispatch or archive a content-free export manifest, then record backup verification evidence.'
      : 'Record fresh backup verification evidence from the current backup/export verification report.';

  return {
    type: 'documents_version_retention_evidence_reminder',
    payload_content_free: true,
    status,
    severity,
    review_required: reviewRequired,
    latest_evidence_id: latestEvidence?.evidence_id || latestEvidence?.evidenceId || null,
    latest_evidence_at: latestEvidence?.recorded_at || latestEvidence?.recordedAt || null,
    expires_at: expiresAt?.toISOString?.() || null,
    days_until_expiry: typeof evidenceExpiresInDays === 'number' ? evidenceExpiresInDays : null,
    next_review_at: nextReviewAt?.toISOString?.() || null,
    due_at: dueAt?.toISOString?.() || null,
    channels: ['retention-dashboard', 'admin-runbook'],
    recommended_action: recommendedAction,
    message,
  };
}

function createDocumentsVersionRetentionBackupVerificationHash(verification) {
  const report = verification || {};
  const canonicalPayload = {
    type: 'documents_version_retention_backup_verification',
    status: report.status || 'export-required',
    payload_content_free: report.payload_content_free !== false,
    backup_export_ready: report.backup_export_ready === true,
    backup_handoff_ready: report.backup_handoff_ready === true,
    latest_manifest_id: report.latest_manifest_id || null,
    latest_payload_hash: report.latest_payload_hash || null,
    latest_delivery_id: report.latest_delivery_id || null,
    latest_delivery_at: report.latest_delivery_at || null,
    backup_storage_ready: report.backup_storage_ready === true,
    latest_storage_adapter: report.latest_storage_adapter || null,
    latest_storage_status: report.latest_storage_status || null,
    latest_storage_ref: report.latest_storage_ref || null,
    latest_storage_hash: report.latest_storage_hash || null,
    latest_stored_at: report.latest_stored_at || null,
    delivered_manifest_count: asNumber(report.delivered_manifest_count),
    failed_delivery_count: asNumber(report.failed_delivery_count),
    pending_delivery_count: asNumber(report.pending_delivery_count),
    prune_audit_count: asNumber(report.prune_audit_count),
    required_restore_drill_count: asNumber(report.required_restore_drill_count),
    completed_restore_drill_count: asNumber(report.completed_restore_drill_count),
    scheduled_prune_allowed: report.scheduled_prune_allowed === true,
    scheduled_prune_status: report.scheduled_prune_status || 'manual-only',
    checks: Array.isArray(report.checks) ? report.checks : [],
    runbook_steps: Array.isArray(report.runbook_steps) ? report.runbook_steps : [],
    message: report.message || '',
  };

  return crypto.createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex');
}

const getDocumentsVersionRetentionRunbookEvidenceHistory = async ({
  limit = 5,
  evidenceType = 'backup-verification',
} = {}) => {
  const normalizedLimit = asPositiveInteger(limit, 5, 50);
  const normalizedEvidenceType = asString(evidenceType, 'backup-verification');
  const evidence = await DocumentsVersionRetentionRunbookEvidence.find({
    evidenceType: normalizedEvidenceType,
  })
    .sort({ recordedAt: -1, createdAt: -1 })
    .limit(normalizedLimit)
    .lean();

  return evidence
    .map(serializeDocumentsVersionRetentionRunbookEvidence)
    .filter(Boolean);
};

const getDocumentsVersionRetentionReminderNotificationHistory = async ({ limit = 5 } = {}) => {
  const normalizedLimit = asPositiveInteger(limit, 5, 50);
  const notifications = await DocumentsVersionRetentionReminderNotification.find({})
    .sort({ generatedAt: -1, createdAt: -1 })
    .limit(normalizedLimit)
    .lean();

  return notifications
    .map(serializeDocumentsVersionRetentionReminderNotification)
    .filter(Boolean);
};

const getDocumentsVersionRetentionReminderNotificationReliability = async ({ now = new Date() } = {}) => {
  const normalizedNow = asDate(now) || new Date();
  const notifications = await DocumentsVersionRetentionReminderNotification.find({})
    .select('status retryAfterAt deliveredAt lastFailureAt attemptCount failureCount retryBackoffSeconds')
    .lean();
  const summary = notifications.reduce((acc, notification) => {
    const status = notification.status || 'scheduled';
    const retryAfterAt = asDate(notification.retryAfterAt);
    const deliveredAt = asDate(notification.deliveredAt);
    const lastFailureAt = asDate(notification.lastFailureAt);
    const retryBackoffSeconds = asNumber(notification.retryBackoffSeconds);

    acc.notification_count += 1;
    acc.attempt_count += asNumber(notification.attemptCount);
    acc.failure_count += asNumber(notification.failureCount);
    acc.max_retry_backoff_seconds = Math.max(acc.max_retry_backoff_seconds, retryBackoffSeconds);

    if (status === 'delivered') {
      acc.delivered_count += 1;
    } else if (status === 'failed') {
      acc.failed_count += 1;
      if (retryAfterAt && retryAfterAt.getTime() <= normalizedNow.getTime()) {
        acc.retry_ready_count += 1;
      } else {
        acc.pending_retry_count += 1;
      }
    } else if (status === 'skipped') {
      acc.skipped_count += 1;
    } else {
      acc.scheduled_count += 1;
    }

    if (deliveredAt && (!acc.last_delivery_at || deliveredAt > acc.last_delivery_at)) {
      acc.last_delivery_at = deliveredAt;
    }

    if (lastFailureAt && (!acc.last_failure_at || lastFailureAt > acc.last_failure_at)) {
      acc.last_failure_at = lastFailureAt;
    }

    return acc;
  }, {
    notification_count: 0,
    delivered_count: 0,
    failed_count: 0,
    skipped_count: 0,
    scheduled_count: 0,
    retry_ready_count: 0,
    pending_retry_count: 0,
    attempt_count: 0,
    failure_count: 0,
    max_retry_backoff_seconds: 0,
    last_failure_at: null,
    last_delivery_at: null,
  });

  return {
    ...summary,
    last_failure_at: summary.last_failure_at?.toISOString?.() || null,
    last_delivery_at: summary.last_delivery_at?.toISOString?.() || null,
  };
};

const countDueDocumentsVersionRetentionReminderNotifications = async ({ now = new Date() } = {}) => {
  const normalizedNow = asDate(now) || new Date();

  return await DocumentsVersionRetentionReminderNotification.countDocuments({
    status: 'failed',
    deliveryAdapter: 'webhook',
    retryAfterAt: { $ne: null, $lte: normalizedNow },
  });
};

function getDocumentsVersionRetentionReminderNotificationWebhookUrl(environment = process.env) {
  return asString(environment?.DOCUMENTS_RETENTION_EVIDENCE_REMINDER_WEBHOOK_URL);
}

function getDocumentsVersionRetentionReminderNotificationConfig(environment = process.env) {
  const webhookUrl = getDocumentsVersionRetentionReminderNotificationWebhookUrl(environment);

  return {
    adapter: webhookUrl ? 'webhook' : 'internal-ledger',
    target: webhookUrl || 'retention-dashboard',
    content_free_only: true,
  };
}

function createDocumentsVersionRetentionEvidenceReminderNotificationPayload({
  reminder,
  verification,
  generatedAt = new Date(),
} = {}) {
  const normalizedGeneratedAt = asDate(generatedAt) || new Date();
  const payload = {
    type: 'documents_version_retention_evidence_reminder_notification',
    schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
    generated_at: normalizedGeneratedAt.toISOString(),
    payload_content_free: true,
    reminder: {
      type: reminder?.type || 'documents_version_retention_evidence_reminder',
      status: reminder?.status || 'missing',
      severity: reminder?.severity || 'warning',
      review_required: reminder?.review_required === true,
      latest_evidence_id: reminder?.latest_evidence_id || null,
      latest_evidence_at: reminder?.latest_evidence_at || null,
      expires_at: reminder?.expires_at || null,
      days_until_expiry: typeof reminder?.days_until_expiry === 'number' ? reminder.days_until_expiry : null,
      next_review_at: reminder?.next_review_at || null,
      due_at: reminder?.due_at || null,
      channels: Array.isArray(reminder?.channels) ? reminder.channels : ['retention-dashboard', 'admin-runbook'],
      recommended_action: reminder?.recommended_action || '',
      message: reminder?.message || '',
    },
    backup_verification: {
      status: verification?.status || 'export-required',
      generated_at: verification?.generated_at || null,
      latest_manifest_id: verification?.latest_manifest_id || null,
      latest_payload_hash: verification?.latest_payload_hash || null,
      latest_storage_adapter: verification?.latest_storage_adapter || null,
      latest_storage_status: verification?.latest_storage_status || null,
      latest_storage_hash: verification?.latest_storage_hash || null,
      restore_download_status: verification?.restore_download_status || null,
      backup_export_ready: verification?.backup_export_ready === true,
      backup_handoff_ready: verification?.backup_handoff_ready === true,
      evidence_review_status: verification?.evidence_review_status || 'missing',
      evidence_review_severity: verification?.evidence_review_severity || reminder?.severity || 'warning',
      evidence_review_due_at: verification?.evidence_review_due_at || reminder?.due_at || null,
      delivered_manifest_count: asNumber(verification?.delivered_manifest_count),
      required_restore_drill_count: asNumber(verification?.required_restore_drill_count),
      completed_restore_drill_count: asNumber(verification?.completed_restore_drill_count),
      scheduled_prune_status: verification?.scheduled_prune_status || 'manual-only',
    },
  };
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  return {
    ...payload,
    payload_hash: payloadHash,
  };
}

function createDocumentsVersionRetentionReminderNotificationIdempotencyKey({
  payload,
  config,
} = {}) {
  const reminderDueToken = payload?.reminder?.latest_evidence_id
    ? payload?.reminder?.due_at || 'none'
    : payload?.reminder?.status === 'missing'
      ? 'missing-evidence'
      : payload?.reminder?.due_at || 'none';
  const seed = [
    'documents-version-retention-evidence-reminder-notification',
    payload?.reminder?.status || 'missing',
    payload?.reminder?.latest_evidence_id || 'none',
    reminderDueToken,
    payload?.backup_verification?.latest_manifest_id || 'none',
    payload?.backup_verification?.latest_payload_hash || 'none',
    config?.adapter || 'internal-ledger',
    config?.target || 'retention-dashboard',
  ].join(':');

  return crypto.createHash('sha256').update(seed).digest('hex');
}

function createDocumentsVersionRetentionReminderNotificationRetryPayload({
  notification,
  verification = null,
  generatedAt = new Date(),
} = {}) {
  const serialized = serializeDocumentsVersionRetentionReminderNotification(notification);
  const normalizedGeneratedAt = asDate(generatedAt) || new Date();
  const payload = {
    type: 'documents_version_retention_evidence_reminder_notification_retry',
    schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
    generated_at: normalizedGeneratedAt.toISOString(),
    payload_content_free: true,
    original_notification_id: serialized?.notification_id || '',
    idempotency_key: serialized?.idempotency_key || '',
    original_payload_hash: serialized?.payload_hash || '',
    retry_attempt: asNumber(serialized?.attempt_count) + 1,
    reminder: {
      type: serialized?.reminder_type || 'documents_version_retention_evidence_reminder',
      status: serialized?.reminder_status || 'missing',
      severity: serialized?.severity || 'warning',
      review_required: serialized?.review_required === true,
      latest_evidence_id: serialized?.latest_evidence_id || null,
      due_at: serialized?.due_at || null,
      next_review_at: serialized?.next_review_at || null,
      channels: Array.isArray(serialized?.channels) ? serialized.channels : ['retention-dashboard', 'admin-runbook'],
    },
    backup_verification: {
      latest_manifest_id: serialized?.latest_manifest_id || verification?.latest_manifest_id || null,
      latest_payload_hash: serialized?.latest_payload_hash || verification?.latest_payload_hash || null,
      status: verification?.status || null,
      evidence_review_status: verification?.evidence_review_status || serialized?.reminder_status || 'missing',
      restore_download_status: verification?.restore_download_status || null,
      scheduled_prune_status: verification?.scheduled_prune_status || null,
    },
    delivery: {
      adapter: serialized?.delivery_adapter || 'webhook',
      target: serialized?.delivery_target || '',
      last_failure_at: serialized?.last_failure_at || null,
      last_failure_message: serialized?.last_failure_message || '',
      failure_count: asNumber(serialized?.failure_count),
      retry_after_at: serialized?.retry_after_at || null,
    },
  };
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  return {
    ...payload,
    payload_hash: payloadHash,
  };
}

async function defaultDocumentsVersionRetentionReminderNotificationClient({
  target,
  payload,
} = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is unavailable for evidence reminder webhook delivery.');
  }

  const response = await fetch(target, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Documents-Retention-Content-Free': 'true',
    },
    body: JSON.stringify(payload),
  });
  const body = await response.text();

  return {
    status: response.status,
    ok: response.ok,
    body,
  };
}

const dispatchDocumentsVersionRetentionEvidenceReminderNotifications = async ({
  verification = null,
  now = new Date(),
  environment = process.env,
  notificationClient = defaultDocumentsVersionRetentionReminderNotificationClient,
} = {}) => {
  const normalizedNow = asDate(now) || new Date();
  const report = verification || await getDocumentsVersionRetentionBackupVerification({
    now: normalizedNow,
  });
  const reminder = report?.evidence_reminder || createDocumentsVersionRetentionEvidenceReminder({
    evidenceReviewStatus: report?.evidence_review_status || 'missing',
    evidenceExpiresInDays: report?.evidence_expires_in_days ?? null,
    latestEvidence: {
      evidence_id: report?.latest_evidence_id || null,
      recorded_at: report?.latest_evidence_at || null,
    },
    latestEvidenceExpiresAt: report?.latest_evidence_expires_at || null,
    now: normalizedNow,
  });
  const config = getDocumentsVersionRetentionReminderNotificationConfig(environment);
  const payload = createDocumentsVersionRetentionEvidenceReminderNotificationPayload({
    reminder,
    verification: report,
    generatedAt: normalizedNow,
  });
  const getUpdatedVerification = () => getDocumentsVersionRetentionBackupVerification({
    now: normalizedNow,
  });
  const idempotencyKey = createDocumentsVersionRetentionReminderNotificationIdempotencyKey({
    payload,
    config,
  });
  const existing = await DocumentsVersionRetentionReminderNotification.findOne({ idempotencyKey }).lean();

  if (existing) {
    const serialized = serializeDocumentsVersionRetentionReminderNotification(existing);

    return {
      type: 'documents_version_retention_evidence_reminder_notification_dispatch',
      schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      generated_at: normalizedNow.toISOString(),
      payload_content_free: true,
      attempted_count: 0,
      delivered_count: serialized?.status === 'delivered' ? 1 : 0,
      failed_count: serialized?.status === 'failed' ? 1 : 0,
      skipped_count: serialized?.status === 'skipped' ? 1 : 0,
      created: false,
      notification: serialized,
      reminder,
      verification: await getUpdatedVerification(),
      message: 'Evidence reminder notification was already recorded for this state.',
    };
  }

  const baseNotification = {
    notificationId: `documents-retention-reminder-${idempotencyKey.slice(0, 16)}`,
    idempotencyKey,
    reminderType: reminder?.type || 'documents_version_retention_evidence_reminder',
    reminderStatus: reminder?.status || 'missing',
    severity: reminder?.severity || 'warning',
    reviewRequired: reminder?.review_required === true,
    deliveryAdapter: config.adapter,
    deliveryTarget: config.target,
    channels: Array.isArray(reminder?.channels) ? reminder.channels : ['retention-dashboard', 'admin-runbook'],
    payloadContentFree: true,
    payloadHash: payload.payload_hash,
    latestEvidenceId: asString(reminder?.latest_evidence_id),
    latestManifestId: asString(report?.latest_manifest_id),
    latestPayloadHash: asString(report?.latest_payload_hash),
    dueAt: asDate(reminder?.due_at),
    nextReviewAt: asDate(reminder?.next_review_at),
    generatedAt: normalizedNow,
  };

  if (!reminder?.review_required) {
    const notification = await DocumentsVersionRetentionReminderNotification.create({
      ...baseNotification,
      status: 'skipped',
      message: 'Runbook evidence is current; no reminder notification was dispatched.',
    });
    const serialized = serializeDocumentsVersionRetentionReminderNotification(notification.toObject?.() || notification);

    return {
      type: 'documents_version_retention_evidence_reminder_notification_dispatch',
      schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      generated_at: normalizedNow.toISOString(),
      payload_content_free: true,
      attempted_count: 0,
      delivered_count: 0,
      failed_count: 0,
      skipped_count: 1,
      created: true,
      notification: serialized,
      reminder,
      verification: await getUpdatedVerification(),
      message: serialized.message,
    };
  }

  if (config.adapter === 'internal-ledger') {
    const notification = await DocumentsVersionRetentionReminderNotification.create({
      ...baseNotification,
      status: 'delivered',
      deliveredAt: normalizedNow,
      attemptCount: 1,
      message: 'Recorded content-free evidence reminder notification in the internal retention ledger.',
    });
    const serialized = serializeDocumentsVersionRetentionReminderNotification(notification.toObject?.() || notification);

    return {
      type: 'documents_version_retention_evidence_reminder_notification_dispatch',
      schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      generated_at: normalizedNow.toISOString(),
      payload_content_free: true,
      attempted_count: 1,
      delivered_count: 1,
      failed_count: 0,
      skipped_count: 0,
      created: true,
      notification: serialized,
      reminder,
      verification: await getUpdatedVerification(),
      message: serialized.message,
    };
  }

  try {
    const response = await notificationClient({
      target: config.target,
      payload,
      payloadHash: payload.payload_hash,
    });
    const responseBody = asString(response?.body);
    const responseBodyHash = responseBody
      ? crypto.createHash('sha256').update(responseBody).digest('hex')
      : '';
    const responseStatus = asNumber(response?.status);
    const delivered = response?.ok === true || (responseStatus >= 200 && responseStatus < 400);
    const notification = await DocumentsVersionRetentionReminderNotification.create({
      ...baseNotification,
      status: delivered ? 'delivered' : 'failed',
      deliveredAt: delivered ? normalizedNow : null,
      lastFailureAt: delivered ? null : normalizedNow,
      lastFailureMessage: delivered ? '' : 'Evidence reminder webhook delivery failed.',
      attemptCount: 1,
      failureCount: delivered ? 0 : 1,
      retryAfterAt: delivered
        ? null
        : new Date(normalizedNow.getTime() + DEFAULT_DOCUMENTS_VERSION_RETENTION_REMINDER_RETRY_BACKOFF_SECONDS * 1000),
      retryBackoffSeconds: delivered ? 0 : DEFAULT_DOCUMENTS_VERSION_RETENTION_REMINDER_RETRY_BACKOFF_SECONDS,
      responseStatus,
      responseBodyHash,
      message: delivered
        ? 'Delivered content-free evidence reminder notification to the configured webhook.'
        : 'Evidence reminder webhook delivery failed and can be retried after backoff.',
    });
    const serialized = serializeDocumentsVersionRetentionReminderNotification(notification.toObject?.() || notification);

    return {
      type: 'documents_version_retention_evidence_reminder_notification_dispatch',
      schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      generated_at: normalizedNow.toISOString(),
      payload_content_free: true,
      attempted_count: 1,
      delivered_count: delivered ? 1 : 0,
      failed_count: delivered ? 0 : 1,
      skipped_count: 0,
      created: true,
      notification: serialized,
      reminder,
      verification: await getUpdatedVerification(),
      message: serialized.message,
    };
  } catch (error) {
    const notification = await DocumentsVersionRetentionReminderNotification.create({
      ...baseNotification,
      status: 'failed',
      lastFailureAt: normalizedNow,
      lastFailureMessage: asString(error?.message, 'Evidence reminder notification delivery failed.'),
      attemptCount: 1,
      failureCount: 1,
      retryAfterAt: new Date(normalizedNow.getTime() + DEFAULT_DOCUMENTS_VERSION_RETENTION_REMINDER_RETRY_BACKOFF_SECONDS * 1000),
      retryBackoffSeconds: DEFAULT_DOCUMENTS_VERSION_RETENTION_REMINDER_RETRY_BACKOFF_SECONDS,
      message: 'Evidence reminder notification delivery failed and can be retried after backoff.',
    });
    const serialized = serializeDocumentsVersionRetentionReminderNotification(notification.toObject?.() || notification);

    return {
      type: 'documents_version_retention_evidence_reminder_notification_dispatch',
      schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      generated_at: normalizedNow.toISOString(),
      payload_content_free: true,
      attempted_count: 1,
      delivered_count: 0,
      failed_count: 1,
      skipped_count: 0,
      created: true,
      notification: serialized,
      reminder,
      verification: await getUpdatedVerification(),
      message: serialized.message,
    };
  }
};

const retryDocumentsVersionRetentionEvidenceReminderNotifications = async ({
  now = new Date(),
  limit = 10,
  notificationClient = defaultDocumentsVersionRetentionReminderNotificationClient,
} = {}) => {
  const normalizedNow = asDate(now) || new Date();
  const normalizedLimit = asPositiveInteger(limit, 10, 50);
  const dueNotifications = await DocumentsVersionRetentionReminderNotification.find({
    status: 'failed',
    deliveryAdapter: 'webhook',
    retryAfterAt: { $ne: null, $lte: normalizedNow },
  })
    .sort({ retryAfterAt: 1, generatedAt: 1, createdAt: 1 })
    .limit(normalizedLimit)
    .lean();
  const currentVerification = await getDocumentsVersionRetentionBackupVerification({
    now: normalizedNow,
  });
  const results = [];
  let deliveredCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const notification of dueNotifications) {
    const target = asString(notification.deliveryTarget);

    if (!target) {
      skippedCount += 1;
      const skipped = await DocumentsVersionRetentionReminderNotification.findOneAndUpdate(
        { _id: notification._id },
        {
          $set: {
            status: 'failed',
            lastFailureAt: normalizedNow,
            lastFailureMessage: 'Evidence reminder retry target is unavailable.',
            message: 'Evidence reminder retry target is unavailable.',
          },
        },
        { new: true },
      ).lean();
      results.push(serializeDocumentsVersionRetentionReminderNotification(skipped));
      continue;
    }

    const retryPayload = createDocumentsVersionRetentionReminderNotificationRetryPayload({
      notification,
      verification: currentVerification,
      generatedAt: normalizedNow,
    });
    const nextAttemptCount = asNumber(notification.attemptCount) + 1;
    const nextFailureCountBase = asNumber(notification.failureCount);

    try {
      const response = await notificationClient({
        target,
        payload: retryPayload,
        payloadHash: retryPayload.payload_hash,
        notification: serializeDocumentsVersionRetentionReminderNotification(notification),
      });
      const responseBody = asString(response?.body);
      const responseBodyHash = responseBody
        ? crypto.createHash('sha256').update(responseBody).digest('hex')
        : '';
      const responseStatus = asNumber(response?.status);
      const delivered = response?.ok === true || (responseStatus >= 200 && responseStatus < 400);
      const nextFailureCount = delivered ? nextFailureCountBase : nextFailureCountBase + 1;
      const retryBackoffSeconds = delivered
        ? 0
        : getDocumentsVersionRetentionReminderRetryBackoffSeconds(nextFailureCount);
      const retryAfterAt = delivered
        ? null
        : new Date(normalizedNow.getTime() + retryBackoffSeconds * 1000);
      const updated = await DocumentsVersionRetentionReminderNotification.findOneAndUpdate(
        { _id: notification._id },
        {
          $set: {
            status: delivered ? 'delivered' : 'failed',
            deliveredAt: delivered ? normalizedNow : null,
            lastFailureAt: delivered ? notification.lastFailureAt || null : normalizedNow,
            lastFailureMessage: delivered ? '' : 'Evidence reminder webhook retry failed.',
            attemptCount: nextAttemptCount,
            failureCount: nextFailureCount,
            retryAfterAt,
            retryBackoffSeconds,
            responseStatus,
            responseBodyHash,
            message: delivered
              ? 'Retried and delivered content-free evidence reminder notification to the configured webhook.'
              : 'Evidence reminder webhook retry failed and can be retried after backoff.',
          },
        },
        { new: true },
      ).lean();

      if (delivered) {
        deliveredCount += 1;
      } else {
        failedCount += 1;
      }

      results.push(serializeDocumentsVersionRetentionReminderNotification(updated));
    } catch (error) {
      const nextFailureCount = nextFailureCountBase + 1;
      const retryBackoffSeconds = getDocumentsVersionRetentionReminderRetryBackoffSeconds(nextFailureCount);
      const updated = await DocumentsVersionRetentionReminderNotification.findOneAndUpdate(
        { _id: notification._id },
        {
          $set: {
            status: 'failed',
            deliveredAt: null,
            lastFailureAt: normalizedNow,
            lastFailureMessage: asString(error?.message, 'Evidence reminder webhook retry failed.'),
            attemptCount: nextAttemptCount,
            failureCount: nextFailureCount,
            retryAfterAt: new Date(normalizedNow.getTime() + retryBackoffSeconds * 1000),
            retryBackoffSeconds,
            message: 'Evidence reminder webhook retry failed and can be retried after backoff.',
          },
        },
        { new: true },
      ).lean();

      failedCount += 1;
      results.push(serializeDocumentsVersionRetentionReminderNotification(updated));
    }
  }

  const reliability = await getDocumentsVersionRetentionReminderNotificationReliability({
    now: normalizedNow,
  });

  return {
    type: 'documents_version_retention_evidence_reminder_notification_retry_dispatch',
    schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
    generated_at: normalizedNow.toISOString(),
    payload_content_free: true,
    attempted_count: dueNotifications.length,
    delivered_count: deliveredCount,
    failed_count: failedCount,
    skipped_count: skippedCount,
    retry_ready_count: reliability.retry_ready_count,
    pending_retry_count: reliability.pending_retry_count,
    notifications: results.filter(Boolean),
    verification: await getDocumentsVersionRetentionBackupVerification({
      now: normalizedNow,
    }),
    message: dueNotifications.length > 0
      ? 'Processed due failed evidence reminder notifications.'
      : 'No failed evidence reminder notifications are due for retry.',
  };
};

function summarizeDocumentsVersionRetentionBackupVerification({
  deliveryHistory = [],
  auditHistory = [],
  scheduledPruneAutomation = null,
  evidenceHistory = [],
  evidenceCount = 0,
  reminderNotificationHistory = [],
  reminderNotificationReliability = null,
  evidenceRetentionDays = getDocumentsVersionRetentionRunbookEvidenceDays(),
  now = new Date(),
} = {}) {
  const normalizedNow = asDate(now) || new Date();
  const deliveries = (Array.isArray(deliveryHistory) ? deliveryHistory : [])
    .map((delivery) => delivery?.delivery_id ? delivery : serializeDocumentsVersionRetentionExportJob(delivery))
    .filter(Boolean);
  const deliveredManifests = getDocumentsVersionRetentionDeliveredManifests(deliveries);
  const latestManifest = deliveredManifests[0] || null;
  const audits = Array.isArray(auditHistory) ? auditHistory : [];
  const pruneAuditsRequiringDrill = audits.filter((audit) => {
    const deletedCount = asNumber(audit?.deleted_count ?? audit?.deletedCount);
    return deletedCount > 0 && !isDocumentsVersionRestoreDrillComplete(audit?.restore_drill ?? audit?.restoreDrill);
  });
  const completedRestoreDrills = audits.filter((audit) => (
    asNumber(audit?.deleted_count ?? audit?.deletedCount) > 0 &&
    isDocumentsVersionRestoreDrillComplete(audit?.restore_drill ?? audit?.restoreDrill)
  ));
  const failedDeliveryCount = deliveries.filter((delivery) => delivery.status === 'failed').length;
  const pendingDeliveryCount = deliveries.filter((delivery) => (
    delivery.status === 'scheduled' ||
    (delivery.status === 'failed' && delivery.requires_worker !== false)
  )).length;
  const backupStorageReady = Boolean(latestManifest) &&
    ['metadata-only', 'stored'].includes(latestManifest.storage_status || '');
  const backupExportReady = Boolean(latestManifest) && backupStorageReady;
  const restoreDownloadReady = Boolean(latestManifest) &&
    latestManifest.storage_status === 'stored' &&
    ['local-file', 's3'].includes(latestManifest.storage_adapter || '');
  const restoreDownloadStatus = !latestManifest
    ? 'blocked'
    : restoreDownloadReady
      ? 'ready'
      : latestManifest.storage_status === 'metadata-only'
        ? 'metadata-only'
        : 'blocked';
  const backupHandoffReady = pruneAuditsRequiringDrill.length === 0;
  const scheduledPrune = scheduledPruneAutomation ||
    summarizeDocumentsVersionRetentionScheduledPruneGuardrails({
      auditHistory: audits,
      now: normalizedNow,
    });
  const status = backupExportReady && backupHandoffReady
    ? 'verified'
    : backupExportReady
      ? 'handoff-required'
      : 'export-required';
  const evidence = Array.isArray(evidenceHistory) ? evidenceHistory.filter(Boolean) : [];
  const latestEvidence = evidence[0] || null;
  const latestEvidenceExpiresAt = asDate(latestEvidence?.expires_at);
  const evidenceExpired = Boolean(
    latestEvidence &&
    latestEvidenceExpiresAt &&
    latestEvidenceExpiresAt.getTime() <= normalizedNow.getTime(),
  );
  const evidenceExpiresInDays = latestEvidenceExpiresAt
    ? Math.ceil((latestEvidenceExpiresAt.getTime() - normalizedNow.getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const evidenceReviewStatus = !latestEvidence
    ? 'missing'
    : evidenceExpired
      ? 'expired'
      : typeof evidenceExpiresInDays === 'number' &&
        evidenceExpiresInDays <= DOCUMENTS_VERSION_RETENTION_EVIDENCE_EXPIRING_SOON_DAYS
        ? 'expiring-soon'
        : 'current';
  const evidenceFresh = Boolean(latestEvidence) && !evidenceExpired && latestEvidenceExpiresAt !== null;
  const evidenceReviewCheck = evidenceReviewStatus === 'current'
    ? 'Latest runbook evidence is current within the retention review window.'
    : evidenceReviewStatus === 'expiring-soon'
      ? 'Latest runbook evidence expires within the review-warning window.'
      : evidenceReviewStatus === 'expired'
        ? 'Latest runbook evidence has expired and should be recorded again.'
        : 'No recorded runbook evidence exists yet.';
  const evidenceReminder = createDocumentsVersionRetentionEvidenceReminder({
    evidenceReviewStatus,
    evidenceExpiresInDays,
    latestEvidence,
    latestEvidenceExpiresAt,
    now: normalizedNow,
  });
  const reminderNotifications = Array.isArray(reminderNotificationHistory)
    ? reminderNotificationHistory.filter(Boolean)
    : [];
  const latestReminderNotification = reminderNotifications[0] || null;
  const reminderReliability = reminderNotificationReliability || {
    notification_count: reminderNotifications.length,
    delivered_count: reminderNotifications.filter((notification) => notification?.status === 'delivered').length,
    failed_count: reminderNotifications.filter((notification) => notification?.status === 'failed').length,
    retry_ready_count: 0,
    pending_retry_count: 0,
    attempt_count: reminderNotifications.reduce((sum, notification) => sum + asNumber(notification?.attempt_count), 0),
    failure_count: reminderNotifications.reduce((sum, notification) => sum + asNumber(notification?.failure_count), 0),
    max_retry_backoff_seconds: 0,
    last_failure_at: null,
    last_delivery_at: null,
  };

  return {
    type: 'documents_version_retention_backup_verification',
    payload_content_free: true,
    generated_at: normalizedNow.toISOString(),
    status,
    backup_export_ready: backupExportReady,
    backup_handoff_ready: backupHandoffReady,
    backup_storage_ready: backupStorageReady,
    latest_manifest_id: latestManifest?.manifest_id || null,
    latest_payload_hash: latestManifest?.payload_hash || null,
    latest_delivery_id: latestManifest?.delivery_id || null,
    latest_delivery_at: latestManifest?.occurred_at || null,
    latest_storage_adapter: latestManifest?.storage_adapter || null,
    latest_storage_status: latestManifest?.storage_status || null,
    latest_storage_ref: latestManifest?.storage_ref || null,
    latest_storage_path: latestManifest?.storage_path || null,
    latest_storage_hash: latestManifest?.storage_hash || null,
    latest_storage_content_free: latestManifest?.storage_content_free === true,
    latest_stored_at: latestManifest?.stored_at || null,
    restore_download_ready: restoreDownloadReady,
    restore_download_status: restoreDownloadStatus,
    delivered_manifest_count: deliveredManifests.length,
    failed_delivery_count: failedDeliveryCount,
    pending_delivery_count: pendingDeliveryCount,
    prune_audit_count: audits.length,
    required_restore_drill_count: pruneAuditsRequiringDrill.length,
    completed_restore_drill_count: completedRestoreDrills.length,
    scheduled_prune_allowed: scheduledPrune?.scheduled_prune_allowed === true,
    scheduled_prune_status: scheduledPrune?.status || 'manual-only',
    evidence_count: asNumber(evidenceCount, evidence.length),
    latest_evidence_id: latestEvidence?.evidence_id || null,
    latest_evidence_at: latestEvidence?.recorded_at || null,
    latest_evidence_expires_at: latestEvidence?.expires_at || null,
    evidence_storage_adapter: latestEvidence?.storage_adapter || 'database',
    evidence_retention_days: asPositiveInteger(evidenceRetentionDays, DEFAULT_DOCUMENTS_VERSION_RETENTION_RUNBOOK_EVIDENCE_DAYS),
    evidence_review_status: evidenceReviewStatus,
    evidence_fresh: evidenceFresh,
    evidence_expired: evidenceExpired,
    evidence_expires_in_days: evidenceExpiresInDays,
    evidence_review_required: evidenceReminder.review_required,
    evidence_review_severity: evidenceReminder.severity,
    evidence_next_review_at: evidenceReminder.next_review_at,
    evidence_review_due_at: evidenceReminder.due_at,
    evidence_reminder: evidenceReminder,
    evidence_reminder_notification_count: asNumber(reminderReliability.notification_count, reminderNotifications.length),
    evidence_reminder_notification_failed_count: asNumber(reminderReliability.failed_count),
    evidence_reminder_notification_retry_ready_count: asNumber(reminderReliability.retry_ready_count),
    evidence_reminder_notification_pending_retry_count: asNumber(reminderReliability.pending_retry_count),
    evidence_reminder_notification_attempt_count: asNumber(reminderReliability.attempt_count),
    evidence_reminder_notification_failure_count: asNumber(reminderReliability.failure_count),
    evidence_reminder_notification_max_retry_backoff_seconds: asNumber(reminderReliability.max_retry_backoff_seconds),
    latest_evidence_reminder_notification_failure_at: reminderReliability.last_failure_at || null,
    latest_evidence_reminder_notification_delivery_at: reminderReliability.last_delivery_at || null,
    latest_evidence_reminder_notification: latestReminderNotification,
    evidence_reminder_notification_history: reminderNotifications.slice(0, 3),
    evidence_history: evidence.slice(0, 3),
    checks: [
      backupExportReady
        ? 'At least one content-free retention export manifest has been delivered.'
        : 'No delivered content-free retention export manifest is available yet.',
      backupStorageReady
        ? `Latest manifest storage is content-free through ${latestManifest.storage_adapter}/${latestManifest.storage_status}.`
        : 'No content-free storage adapter has confirmed the latest export manifest yet.',
      restoreDownloadReady
        ? 'Latest stored manifest is ready for restore-download verification.'
        : backupExportReady
          ? 'Latest manifest is metadata-only or lacks a retrievable storage object for restore-download verification.'
          : 'No delivered manifest is available for restore-download verification yet.',
      backupHandoffReady
        ? 'All deleted-snapshot prune audits have completed or non-required restore drills.'
        : 'One or more deleted-snapshot prune audits still need backup/export handoff verification.',
      evidenceReviewCheck,
      'Verification payloads include ids, timestamps, hashes, counts, and statuses only.',
      'Document body content, content_text, and metadata are excluded from verification payloads.',
    ],
    runbook_steps: [
      'Dispatch or download the retention dashboard export and archive the content-free manifest hash and storage reference.',
      'For every prune audit with deleted snapshots, confirm backup/export handoff before enabling automation.',
      'Record backup verification evidence before its retention window expires.',
      'Confirm the audit sample is absent from primary history after pruning.',
      'Keep scheduled pruning disabled until export evidence and restore-drill evidence are both ready.',
    ],
    message: status === 'verified'
      ? 'Backup/export verification is ready: a content-free manifest exists and required restore drills are complete.'
      : status === 'handoff-required'
        ? 'Backup/export manifest evidence exists, but at least one prune audit still needs restore-drill handoff verification.'
        : 'Backup/export verification needs a delivered content-free retention export manifest before automation hardening can proceed.',
  };
}

const getDocumentsVersionRetentionBackupVerification = async ({
  deliveryHistory = null,
  auditHistory = null,
  scheduledPruneAutomation = null,
  includeEvidence = true,
  includeReminderNotifications = true,
  now = new Date(),
} = {}) => {
  const deliveries = Array.isArray(deliveryHistory)
    ? deliveryHistory
    : await getDocumentsVersionRetentionExportDeliveryHistory({ limit: 20 });
  const audits = Array.isArray(auditHistory)
    ? auditHistory
    : await getDocumentsVersionRetentionPruneAuditHistory({ limit: 20 });
  const scheduledPrune = scheduledPruneAutomation ||
    await getDocumentsVersionRetentionScheduledPruneGuardrails({
      auditHistory: audits,
      now,
    });
  const evidenceHistory = includeEvidence
    ? await getDocumentsVersionRetentionRunbookEvidenceHistory({ limit: 5 })
    : [];
  const evidenceCount = includeEvidence
    ? await DocumentsVersionRetentionRunbookEvidence.countDocuments({ evidenceType: 'backup-verification' })
    : 0;
  const reminderNotificationHistory = includeReminderNotifications
    ? await getDocumentsVersionRetentionReminderNotificationHistory({ limit: 5 })
    : [];
  const reminderNotificationReliability = includeReminderNotifications
    ? await getDocumentsVersionRetentionReminderNotificationReliability({ now })
    : null;

  return summarizeDocumentsVersionRetentionBackupVerification({
    deliveryHistory: deliveries,
    auditHistory: audits,
    scheduledPruneAutomation: scheduledPrune,
    evidenceHistory,
    evidenceCount,
    reminderNotificationHistory,
    reminderNotificationReliability,
    now,
  });
};

async function documentsVersionRetentionBodyToString(body) {
  if (body === undefined || body === null) {
    return '';
  }

  if (typeof body === 'string') {
    return body;
  }

  if (Buffer.isBuffer(body)) {
    return body.toString('utf8');
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body).toString('utf8');
  }

  if (typeof body.transformToString === 'function') {
    return await body.transformToString('utf8');
  }

  if (typeof body[Symbol.asyncIterator] === 'function') {
    const chunks = [];

    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString('utf8');
  }

  return String(body);
}

function parseDocumentsVersionRetentionS3Ref(storageRef) {
  const normalizedStorageRef = asString(storageRef);

  if (!normalizedStorageRef.startsWith('s3://')) {
    return { bucket: '', key: '' };
  }

  const withoutProtocol = normalizedStorageRef.slice(5);
  const separatorIndex = withoutProtocol.indexOf('/');

  if (separatorIndex < 0) {
    return { bucket: withoutProtocol, key: '' };
  }

  return {
    bucket: withoutProtocol.slice(0, separatorIndex),
    key: withoutProtocol.slice(separatorIndex + 1),
  };
}

function containsDocumentsVersionRetentionPayloadKeys(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(containsDocumentsVersionRetentionPayloadKeys);
  }

  return Object.entries(value).some(([key, nestedValue]) => (
    key === 'content' ||
    key === 'content_text' ||
    key === 'contentText' ||
    key === 'metadata' ||
    containsDocumentsVersionRetentionPayloadKeys(nestedValue)
  ));
}

function createDocumentsVersionRetentionRestoreDownloadResult({
  status,
  manifest = null,
  generatedAt = new Date(),
  downloadedAt = null,
  restoreDownloadReady = false,
  storageHashExpected = null,
  storageHashActual = null,
  manifestIdMatched = false,
  payloadHashMatched = false,
  storageHashMatched = false,
  contentFree = false,
  errorMessage = '',
  checks = [],
  message,
} = {}) {
  const latestManifest = manifest || {};

  return {
    type: 'documents_version_retention_restore_download_verification',
    schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
    generated_at: (asDate(generatedAt) || new Date()).toISOString(),
    downloaded_at: asDate(downloadedAt)?.toISOString?.() || null,
    payload_content_free: true,
    status,
    restore_download_ready: restoreDownloadReady,
    delivery_id: latestManifest.delivery_id || null,
    manifest_id: latestManifest.manifest_id || null,
    payload_hash: latestManifest.payload_hash || null,
    storage_adapter: latestManifest.storage_adapter || null,
    storage_status: latestManifest.storage_status || null,
    storage_ref: latestManifest.storage_ref || null,
    storage_path: latestManifest.storage_path || null,
    storage_hash_expected: storageHashExpected,
    storage_hash_actual: storageHashActual,
    manifest_id_matched: manifestIdMatched,
    payload_hash_matched: payloadHashMatched,
    storage_hash_matched: storageHashMatched,
    content_free: contentFree,
    error_message: errorMessage,
    checks,
    message: message || (
      restoreDownloadReady
        ? 'Restore-download verification passed for the latest content-free export manifest.'
        : 'Restore-download verification did not confirm a retrievable content-free export manifest.'
    ),
  };
}

async function readDocumentsVersionRetentionStoredManifest({
  manifest,
  environment = process.env,
  storageClientFactory = createDocumentsVersionRetentionExportS3Client,
} = {}) {
  const adapter = manifest?.storage_adapter || 'database';

  if (adapter === 'local-file') {
    const storagePath = asString(manifest?.storage_path) ||
      asString(manifest?.storage_ref).replace(/^local-file:/, '');

    if (!storagePath) {
      throw new Error('Local-file retention export storage path is unavailable.');
    }

    return await fs.readFile(storagePath, 'utf8');
  }

  if (adapter === 's3') {
    const parsedRef = parseDocumentsVersionRetentionS3Ref(manifest?.storage_ref);
    const bucket = parsedRef.bucket || getDocumentsVersionRetentionExportS3Bucket(environment);
    const key = asString(manifest?.storage_path) || parsedRef.key;

    if (!bucket || !key) {
      throw new Error('S3 retention export storage bucket or key is unavailable.');
    }

    const client = storageClientFactory(environment);

    if (!client?.send) {
      throw new Error('S3 retention export storage client is unavailable.');
    }

    const response = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }));

    return await documentsVersionRetentionBodyToString(response?.Body);
  }

  return null;
}

const verifyDocumentsVersionRetentionRestoreDownload = async ({
  manifestId = '',
  deliveryHistory = null,
  now = new Date(),
  environment = process.env,
  storageClientFactory = createDocumentsVersionRetentionExportS3Client,
} = {}) => {
  const normalizedNow = asDate(now) || new Date();
  const deliveries = Array.isArray(deliveryHistory)
    ? deliveryHistory
    : await getDocumentsVersionRetentionExportDeliveryHistory({ limit: 20 });
  const deliveredManifests = getDocumentsVersionRetentionDeliveredManifests(deliveries);
  const normalizedManifestId = asString(manifestId);
  const latestManifest = normalizedManifestId
    ? deliveredManifests.find((manifest) => manifest.manifest_id === normalizedManifestId) || null
    : deliveredManifests[0] || null;

  if (!latestManifest) {
    return createDocumentsVersionRetentionRestoreDownloadResult({
      status: 'blocked',
      generatedAt: normalizedNow,
      checks: [
        'No delivered content-free retention export manifest was available to download-verify.',
        'Document body content, content_text, and metadata are not included in this verification payload.',
      ],
      message: 'Dispatch a retention export before running restore-download verification.',
    });
  }

  if (latestManifest.storage_status === 'metadata-only' || latestManifest.storage_adapter === 'database') {
    return createDocumentsVersionRetentionRestoreDownloadResult({
      status: 'metadata-only',
      manifest: latestManifest,
      generatedAt: normalizedNow,
      restoreDownloadReady: false,
      storageHashExpected: latestManifest.storage_hash || latestManifest.payload_hash || null,
      storageHashActual: latestManifest.storage_hash || latestManifest.payload_hash || null,
      manifestIdMatched: true,
      payloadHashMatched: true,
      storageHashMatched: true,
      contentFree: latestManifest.payload_content_free !== false && latestManifest.storage_content_free !== false,
      checks: [
        'The latest manifest exists only as database delivery metadata.',
        'Metadata-only delivery can confirm ids and hashes, but it cannot prove a downloadable backup artifact.',
        'Document body content, content_text, and metadata are not included in this verification payload.',
      ],
      message: 'Restore-download verification needs local-file or S3 export storage; the latest manifest is metadata-only.',
    });
  }

  try {
    const body = await readDocumentsVersionRetentionStoredManifest({
      manifest: latestManifest,
      environment,
      storageClientFactory,
    });
    const storageHashActual = crypto.createHash('sha256').update(body || '').digest('hex');
    const storageHashExpected = latestManifest.storage_hash || null;
    let parsedManifest = null;

    try {
      parsedManifest = JSON.parse(body || '{}');
    } catch (_error) {
      parsedManifest = null;
    }

    const manifestIdMatched = parsedManifest?.manifest_id === latestManifest.manifest_id;
    const payloadHashMatched = parsedManifest?.payload_hash === latestManifest.payload_hash;
    const storageHashMatched = Boolean(storageHashExpected) && storageHashActual === storageHashExpected;
    const forbiddenKeysPresent = containsDocumentsVersionRetentionPayloadKeys(parsedManifest);
    const contentFree = parsedManifest?.payload_content_free === true &&
      parsedManifest?.storage_content_free !== false &&
      !forbiddenKeysPresent;
    const restoreDownloadReady = manifestIdMatched && payloadHashMatched && storageHashMatched && contentFree;

    return createDocumentsVersionRetentionRestoreDownloadResult({
      status: restoreDownloadReady ? 'verified' : 'failed',
      manifest: latestManifest,
      generatedAt: normalizedNow,
      downloadedAt: normalizedNow,
      restoreDownloadReady,
      storageHashExpected,
      storageHashActual,
      manifestIdMatched,
      payloadHashMatched,
      storageHashMatched,
      contentFree,
      checks: [
        manifestIdMatched
          ? 'Downloaded manifest id matches the latest delivered manifest.'
          : 'Downloaded manifest id did not match the latest delivered manifest.',
        payloadHashMatched
          ? 'Downloaded manifest payload hash matches the delivery event.'
          : 'Downloaded manifest payload hash did not match the delivery event.',
        storageHashMatched
          ? 'Downloaded manifest storage hash matches the recorded storage hash.'
          : 'Downloaded manifest storage hash did not match the recorded storage hash.',
        contentFree
          ? 'Downloaded manifest is content-free and excludes document body payload keys.'
          : 'Downloaded manifest failed the content-free payload-key check.',
      ],
      message: restoreDownloadReady
        ? 'Restore-download verification passed for the latest content-free export manifest.'
        : 'Restore-download verification failed; investigate export storage before pruning work advances.',
    });
  } catch (error) {
    return createDocumentsVersionRetentionRestoreDownloadResult({
      status: 'failed',
      manifest: latestManifest,
      generatedAt: normalizedNow,
      errorMessage: asString(error?.message, 'Unknown restore-download verification error.'),
      checks: [
        'The latest manifest has retrievable storage metadata, but the download/read check failed.',
        'Document body content, content_text, and metadata are not included in this verification payload.',
      ],
      message: 'Restore-download verification failed while reading the latest export manifest from storage.',
    });
  }
};

const recordDocumentsVersionRetentionBackupVerificationEvidence = async ({
  verification = null,
  requestedBy = '',
  now = new Date(),
  evidenceRetentionDays = getDocumentsVersionRetentionRunbookEvidenceDays(),
} = {}) => {
  const normalizedNow = asDate(now) || new Date();
  const report = verification || await getDocumentsVersionRetentionBackupVerification({
    includeEvidence: false,
    now: normalizedNow,
  });
  const reportHash = createDocumentsVersionRetentionBackupVerificationHash(report);
  const evidenceId = `documents-retention-evidence-${reportHash.slice(0, 16)}`;
  const normalizedRetentionDays = getDocumentsVersionRetentionRunbookEvidenceDays(evidenceRetentionDays);
  const expiresAt = new Date(normalizedNow.getTime() + normalizedRetentionDays * 24 * 60 * 60 * 1000);
  const existing = await DocumentsVersionRetentionRunbookEvidence.findOne({ reportHash }).lean();

  if (existing) {
    return {
      created: false,
      evidence: serializeDocumentsVersionRetentionRunbookEvidence(existing),
    };
  }

  try {
    const evidence = await DocumentsVersionRetentionRunbookEvidence.create({
      evidenceId,
      evidenceType: 'backup-verification',
      status: report.status || 'export-required',
      requestedBy: asString(requestedBy),
      payloadContentFree: true,
      storageAdapter: 'database',
      reportHash,
      latestManifestId: asString(report.latest_manifest_id),
      latestPayloadHash: asString(report.latest_payload_hash),
      latestDeliveryId: asString(report.latest_delivery_id),
      latestDeliveryAt: asDate(report.latest_delivery_at),
      backupStorageReady: report.backup_storage_ready === true,
      latestStorageAdapter: asString(report.latest_storage_adapter),
      latestStorageStatus: asString(report.latest_storage_status),
      latestStorageRef: asString(report.latest_storage_ref),
      latestStorageHash: asString(report.latest_storage_hash),
      latestStoredAt: asDate(report.latest_stored_at),
      backupExportReady: report.backup_export_ready === true,
      backupHandoffReady: report.backup_handoff_ready === true,
      deliveredManifestCount: asNumber(report.delivered_manifest_count),
      failedDeliveryCount: asNumber(report.failed_delivery_count),
      pendingDeliveryCount: asNumber(report.pending_delivery_count),
      pruneAuditCount: asNumber(report.prune_audit_count),
      requiredRestoreDrillCount: asNumber(report.required_restore_drill_count),
      completedRestoreDrillCount: asNumber(report.completed_restore_drill_count),
      scheduledPruneAllowed: report.scheduled_prune_allowed === true,
      scheduledPruneStatus: report.scheduled_prune_status || 'manual-only',
      checks: Array.isArray(report.checks) ? report.checks : [],
      runbookSteps: Array.isArray(report.runbook_steps) ? report.runbook_steps : [],
      message: report.message || '',
      generatedAt: asDate(report.generated_at) || normalizedNow,
      recordedAt: normalizedNow,
      expiresAt,
    });

    return {
      created: true,
      evidence: serializeDocumentsVersionRetentionRunbookEvidence(evidence.toObject?.() || evidence),
    };
  } catch (error) {
    if (error?.code === 11000 || error?.code === 11001) {
      const duplicate = await DocumentsVersionRetentionRunbookEvidence.findOne({ reportHash }).lean();

      if (duplicate) {
        return {
          created: false,
          evidence: serializeDocumentsVersionRetentionRunbookEvidence(duplicate),
        };
      }
    }

    throw error;
  }
};

const executeDocumentsVersionRetentionRestoreDrill = async ({
  auditId,
  confirmation,
  backupHandoffConfirmed = false,
  requestedBy = '',
  now = new Date(),
} = {}) => {
  const normalizedAuditId = asString(auditId);

  if (!normalizedAuditId) {
    throw createDocumentsVersionRetentionError('audit_id_required', 'audit_id is required');
  }

  const normalizedNow = asDate(now) || new Date();
  const audit = await DocumentsVersionRetentionPruneAudit.findOne({ auditId: normalizedAuditId }).lean();

  if (!audit) {
    throw createDocumentsVersionRetentionError('audit_not_found', 'Retention prune audit not found');
  }

  const deletedCount = asNumber(audit.deletedCount);
  const requiresBackupHandoff = deletedCount > 0;
  const confirmationMatched = asString(confirmation) === DOCUMENTS_VERSION_RETENTION_RESTORE_DRILL_CONFIRMATION;
  const backupHandoffMatched = asBoolean(backupHandoffConfirmed, false);

  if (requiresBackupHandoff && (!confirmationMatched || !backupHandoffMatched)) {
    throw createDocumentsVersionRetentionError(
      'restore_drill_confirmation_required',
      `confirmation must equal ${DOCUMENTS_VERSION_RETENTION_RESTORE_DRILL_CONFIRMATION} and backup_handoff_confirmed must be true`,
      {
        confirmation_required: true,
        confirmation_token: DOCUMENTS_VERSION_RETENTION_RESTORE_DRILL_CONFIRMATION,
        backup_handoff_required: true,
      },
    );
  }

  const currentRestoreDrill = asPlainObject(audit.restoreDrill, {});
  const sample = asPlainObject(currentRestoreDrill.sample, null) ||
    (Array.isArray(audit.candidates) && audit.candidates[0]
      ? {
          snapshot_id: audit.candidates[0].snapshot_id,
          document_id: audit.candidates[0].document_id,
          version_number: audit.candidates[0].version_number,
          content_hash: audit.candidates[0].content_hash,
          saved_at: audit.candidates[0].saved_at,
        }
      : null);
  const sampleSnapshotId = asString(sample?.snapshot_id);
  const sampleStillInPrimaryHistory = sampleSnapshotId
    ? Boolean(await DocumentsVersionSnapshot.exists({ snapshotId: sampleSnapshotId }))
    : false;
  const primaryHistoryPassed = !requiresBackupHandoff || !sampleStillInPrimaryHistory;
  const completed = !requiresBackupHandoff || (confirmationMatched && backupHandoffMatched && primaryHistoryPassed);
  const status = completed
    ? requiresBackupHandoff ? 'completed' : 'not-required'
    : 'blocked';
  const backupHandoffStatus = !requiresBackupHandoff
    ? 'not-required'
    : backupHandoffMatched ? 'confirmed' : 'required';
  const execution = {
    type: 'documents_version_retention_restore_drill_execution',
    drill_id: `documents-retention-restore-drill-${crypto.randomUUID()}`,
    audit_id: normalizedAuditId,
    status: completed ? 'completed' : 'blocked',
    requested_by: requestedBy || null,
    payload_content_free: true,
    confirmation_token: DOCUMENTS_VERSION_RETENTION_RESTORE_DRILL_CONFIRMATION,
    confirmation_matched: !requiresBackupHandoff || confirmationMatched,
    backup_handoff_confirmed: !requiresBackupHandoff || backupHandoffMatched,
    executed_at: normalizedNow.toISOString(),
  };
  const restoreDrill = {
    ...currentRestoreDrill,
    type: 'documents_version_retention_restore_drill',
    status,
    payload_content_free: true,
    generated_at: currentRestoreDrill.generated_at || currentRestoreDrill.generatedAt || serializeReportDate(audit.executedAt),
    completed_at: completed && requiresBackupHandoff ? normalizedNow.toISOString() : currentRestoreDrill.completed_at || null,
    deleted_count: deletedCount,
    remaining_candidate_count: asNumber(audit.remainingCandidateCount),
    sample,
    backup_handoff: {
      status: backupHandoffStatus,
      payload_content_free: true,
      source: requiresBackupHandoff ? 'external-backup-or-export' : 'primary-history-retained',
      required: requiresBackupHandoff,
      confirmed: !requiresBackupHandoff || backupHandoffMatched,
    },
    primary_history_check: {
      status: primaryHistoryPassed ? 'passed' : 'failed',
      payload_content_free: true,
      checked_at: normalizedNow.toISOString(),
      sample_snapshot_id: sampleSnapshotId || null,
      sample_snapshot_present: sampleStillInPrimaryHistory,
    },
    automation_clearance: {
      scheduled_prune_allowed: completed,
      reason: completed
        ? 'Restore drill evidence is content-free and complete for this audit.'
        : 'Restore drill is blocked until backup handoff is confirmed and the sample is absent from primary history.',
    },
    checks: [
      'Audit captured snapshot ids, document ids, version numbers, timestamps, and content hashes for deleted candidates.',
      primaryHistoryPassed
        ? 'Primary durable history check passed for the audit sample.'
        : 'Primary durable history still contains the audit sample; investigate before automation.',
      requiresBackupHandoff
        ? 'Backup/export handoff was confirmed without storing document body content.'
        : 'No deleted snapshots require an external backup/export handoff.',
      'Scheduled prune automation remains blocked unless restore-drill guardrails pass.',
    ],
    message: completed
      ? requiresBackupHandoff
        ? 'Restore drill completed from backup/export handoff metadata. No document body content was stored in the audit.'
        : 'No snapshots were deleted, so restore drill execution is not required.'
      : 'Restore drill blocked. Confirm the backup/export handoff and verify primary history before automating pruning.',
    execution,
  };
  const updatedAudit = await DocumentsVersionRetentionPruneAudit.findOneAndUpdate(
    { auditId: normalizedAuditId },
    {
      $set: {
        restoreDrill,
        updatedAt: normalizedNow,
      },
    },
    { new: true },
  ).lean();
  const serializedAudit = serializeDocumentsVersionRetentionPruneAudit(updatedAudit);
  const auditHistory = await getDocumentsVersionRetentionPruneAuditHistory({ limit: 20 });
  const scheduledPruneAutomation = summarizeDocumentsVersionRetentionScheduledPruneGuardrails({
    auditHistory,
    now: normalizedNow,
  });

  return {
    type: 'documents_version_retention_restore_drill_execution',
    schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
    audit_id: normalizedAuditId,
    status: execution.status,
    payload_content_free: true,
    requested_by: requestedBy || null,
    confirmation_required: requiresBackupHandoff,
    confirmation_token: DOCUMENTS_VERSION_RETENTION_RESTORE_DRILL_CONFIRMATION,
    backup_handoff_required: requiresBackupHandoff,
    backup_handoff_confirmed: !requiresBackupHandoff || backupHandoffMatched,
    restore_drill: serializedAudit?.restore_drill || restoreDrill,
    audit: serializedAudit,
    scheduled_prune_automation: scheduledPruneAutomation,
    executed_at: normalizedNow.toISOString(),
  };
};

const executeDocumentsVersionSnapshotRetentionPrune = async ({
  confirmation,
  maxSnapshots = getDocumentsVersionHistoryMaxSnapshots(),
  limit = DEFAULT_DOCUMENTS_VERSION_RETENTION_PRUNE_CANDIDATE_LIMIT,
  now = new Date(),
  requestedBy = '',
} = {}) => {
  if (asString(confirmation) !== DOCUMENTS_VERSION_RETENTION_PRUNE_CONFIRMATION) {
    throw new Error('Admin prune confirmation is required');
  }

  const normalizedNow = asDate(now) || new Date();
  const preview = await previewDocumentsVersionSnapshotRetentionPrune({
    maxSnapshots,
    limit,
    now: normalizedNow,
  });
  const snapshotIds = preview.candidates
    .map((candidate) => candidate.snapshot_id)
    .filter(Boolean);
  const result = snapshotIds.length > 0
    ? await DocumentsVersionSnapshot.deleteMany({ snapshotId: { $in: snapshotIds } })
    : { deletedCount: 0 };
  const postPrunePreview = await previewDocumentsVersionSnapshotRetentionPrune({
    maxSnapshots,
    limit,
    now: normalizedNow,
  });
  const deletedCount = result.deletedCount || 0;
  const audit = await recordDocumentsVersionRetentionPruneAudit({
    preview,
    deletedCount,
    remainingCandidateCount: postPrunePreview.total_candidate_count,
    executedAt: normalizedNow,
    requestedBy,
  });
  const auditHistory = await getDocumentsVersionRetentionPruneAuditHistory({ limit: 20 });
  const scheduledPruneAutomation = summarizeDocumentsVersionRetentionScheduledPruneGuardrails({
    auditHistory,
    now: normalizedNow,
  });

  return {
    ...preview,
    type: 'documents_version_retention_prune_execution',
    mode: 'confirmed-delete',
    confirmed: true,
    requested_by: requestedBy || null,
    audit_id: audit?.audit_id || null,
    deleted_count: deletedCount,
    remaining_candidate_count: postPrunePreview.total_candidate_count,
    remaining_limited: postPrunePreview.limited,
    restore_drill: audit?.restore_drill || null,
    audit,
    scheduled_prune_automation: scheduledPruneAutomation,
    executed_at: normalizedNow.toISOString(),
  };
};

const getDocumentsVersionSnapshots = async ({ documentId, limit = 50 } = {}) => {
  try {
    return await DocumentsVersionSnapshot.find({ documentId })
      .sort({ versionNumber: -1, savedAt: -1 })
      .limit(Math.max(1, Math.min(Number(limit) || 50, 100)))
      .lean();
  } catch (error) {
    logger.error('[getDocumentsVersionSnapshots] Error loading snapshots', error);
    throw new Error('Error loading document version snapshots');
  }
};

const getDocumentsVersionSnapshotRetentionReport = async ({
  documentId,
  maxSnapshots = getDocumentsVersionHistoryMaxSnapshots(),
} = {}) => {
  const normalizedDocumentId = asString(documentId);

  if (!normalizedDocumentId) {
    throw new Error('documentId is required');
  }

  try {
    const snapshots = await DocumentsVersionSnapshot.find({ documentId: normalizedDocumentId })
      .select('retentionPolicy retainedUntil origin schemaVersion savedAt createdAt updatedAt')
      .lean();

    return summarizeDocumentsVersionSnapshotRetention(snapshots, { maxSnapshots });
  } catch (error) {
    logger.error('[getDocumentsVersionSnapshotRetentionReport] Error summarizing snapshot retention', error);
    throw new Error('Error summarizing document version snapshot retention');
  }
};

const getDocumentsVersionSnapshotRetentionExport = async ({
  documentId,
  maxSnapshots = getDocumentsVersionHistoryMaxSnapshots(),
} = {}) => {
  const normalizedDocumentId = asString(documentId);
  const normalizedMaxSnapshots = asPositiveInteger(
    maxSnapshots,
    DEFAULT_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS,
    MAX_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS,
  );

  if (!normalizedDocumentId) {
    throw new Error('documentId is required');
  }

  try {
    const snapshots = await DocumentsVersionSnapshot.find({ documentId: normalizedDocumentId })
      .sort({ versionNumber: -1, savedAt: -1 })
      .select(
        [
          'snapshotId',
          'documentId',
          'versionNumber',
          'title',
          'wordCount',
          'changeNote',
          'changeType',
          'schemaVersion',
          'retentionPolicy',
          'retainedUntil',
          'origin',
          'clientSnapshotId',
          'sourceVersionId',
          'authorId',
          'contentHash',
          'savedAt',
          'sourceUpdatedAt',
          'updatedAt',
        ].join(' '),
      )
      .lean();
    const retentionReport = summarizeDocumentsVersionSnapshotRetention(snapshots, {
      maxSnapshots: normalizedMaxSnapshots,
    });

    return {
      type: 'documents_version_retention_report',
      schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      generated_at: new Date().toISOString(),
      document_id: normalizedDocumentId,
      retention: {
        max_snapshots: normalizedMaxSnapshots,
        policy: 'keep-latest',
      },
      retention_report: retentionReport,
      snapshots: snapshots.map(serializeDocumentsVersionSnapshotRetentionRecord).filter(Boolean),
    };
  } catch (error) {
    logger.error('[getDocumentsVersionSnapshotRetentionExport] Error exporting snapshot retention report', error);
    throw new Error('Error exporting document version snapshot retention report');
  }
};

const getDocumentsVersionSnapshotRetentionTrends = async ({
  documentId,
  days = DEFAULT_DOCUMENTS_VERSION_RETENTION_TREND_DAYS,
  maxSnapshots = getDocumentsVersionHistoryMaxSnapshots(),
  now = new Date(),
} = {}) => {
  const normalizedDocumentId = asString(documentId);
  const normalizedDays = getDocumentsVersionRetentionTrendDays(days);
  const normalizedMaxSnapshots = asPositiveInteger(
    maxSnapshots,
    DEFAULT_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS,
    MAX_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS,
  );

  if (!normalizedDocumentId) {
    throw new Error('documentId is required');
  }

  try {
    const normalizedNow = asDate(now) || new Date();
    const windowEnd = addUtcDays(startOfUtcDay(normalizedNow), 1);
    const snapshots = await DocumentsVersionSnapshot.find({
      documentId: normalizedDocumentId,
      savedAt: { $lt: windowEnd },
    })
      .sort({ savedAt: 1, versionNumber: 1 })
      .select('retentionPolicy retainedUntil origin schemaVersion savedAt createdAt updatedAt')
      .lean();
    const retentionReport = summarizeDocumentsVersionSnapshotRetention(snapshots, {
      maxSnapshots: normalizedMaxSnapshots,
      now: normalizedNow,
    });
    const trend = createDocumentsVersionSnapshotRetentionTrend(snapshots, {
      days: normalizedDays,
      maxSnapshots: normalizedMaxSnapshots,
      now: normalizedNow,
    });

    return {
      type: 'documents_version_retention_trends',
      schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      generated_at: normalizedNow.toISOString(),
      document_id: normalizedDocumentId,
      window: {
        days: trend.days,
        from: trend.from,
        to: trend.to,
        bucket: trend.bucket,
      },
      retention: {
        max_snapshots: normalizedMaxSnapshots,
        policy: 'keep-latest',
      },
      retention_report: retentionReport,
      buckets: trend.buckets,
    };
  } catch (error) {
    logger.error('[getDocumentsVersionSnapshotRetentionTrends] Error building snapshot retention trends', error);
    throw new Error('Error building document version snapshot retention trends');
  }
};

const getDocumentsVersionSnapshotRetentionDashboard = async ({
  days = DEFAULT_DOCUMENTS_VERSION_RETENTION_TREND_DAYS,
  maxDocuments = DEFAULT_DOCUMENTS_VERSION_RETENTION_DASHBOARD_MAX_DOCUMENTS,
  maxAlerts = DEFAULT_DOCUMENTS_VERSION_RETENTION_ALERT_MAX_ALERTS,
  maxAutomationActions = DEFAULT_DOCUMENTS_VERSION_RETENTION_AUTOMATION_MAX_ACTIONS,
  maxSnapshots = getDocumentsVersionHistoryMaxSnapshots(),
  now = new Date(),
} = {}) => {
  const normalizedDays = getDocumentsVersionRetentionTrendDays(days);
  const normalizedMaxDocuments = getDocumentsVersionRetentionDashboardMaxDocuments(maxDocuments);
  const normalizedMaxAlerts = getDocumentsVersionRetentionAlertMaxAlerts(maxAlerts);
  const normalizedMaxAutomationActions = getDocumentsVersionRetentionAutomationMaxActions(maxAutomationActions);
  const normalizedMaxSnapshots = asPositiveInteger(
    maxSnapshots,
    DEFAULT_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS,
    MAX_DOCUMENTS_VERSION_HISTORY_MAX_SNAPSHOTS,
  );

  try {
    const normalizedNow = asDate(now) || new Date();
    const windowEnd = addUtcDays(startOfUtcDay(normalizedNow), 1);
    const windowStart = addUtcDays(startOfUtcDay(normalizedNow), -(normalizedDays - 1));
    const snapshots = await DocumentsVersionSnapshot.find({
      savedAt: { $lt: windowEnd },
    })
      .sort({ documentId: 1, savedAt: 1, versionNumber: 1 })
      .select('documentId title versionNumber retentionPolicy retainedUntil origin schemaVersion savedAt createdAt updatedAt')
      .lean();
    const retentionReport = summarizeDocumentsVersionSnapshotRetention(snapshots, {
      maxSnapshots: normalizedMaxSnapshots,
      now: normalizedNow,
    });
    const trend = createDocumentsVersionSnapshotRetentionTrend(snapshots, {
      days: normalizedDays,
      maxSnapshots: normalizedMaxSnapshots,
      now: normalizedNow,
    });
    const groupedSnapshots = snapshots.reduce((acc, snapshot) => {
      const documentId = asString(snapshot?.documentId);
      if (!documentId) return acc;
      if (!acc.has(documentId)) {
        acc.set(documentId, []);
      }
      acc.get(documentId).push(snapshot);
      return acc;
    }, new Map());
    const documentSummaries = Array.from(groupedSnapshots.entries())
      .map(([documentId, documentSnapshots]) => summarizeDocumentsVersionSnapshotRetentionDashboardDocument(
        documentId,
        documentSnapshots,
        {
          maxSnapshots: normalizedMaxSnapshots,
          now: normalizedNow,
          windowStart,
          windowEnd,
        },
      ))
      .sort((a, b) => (
        b.risk_score - a.risk_score ||
        b.prunable_count - a.prunable_count ||
        b.snapshot_count - a.snapshot_count ||
        String(b.latest_snapshot_at || '').localeCompare(String(a.latest_snapshot_at || ''))
      ))
      .slice(0, normalizedMaxDocuments);
    const alerts = createDocumentsVersionSnapshotRetentionAlerts({
      retentionReport,
      documentSummaries,
      maxAlerts: normalizedMaxAlerts,
    });
    const exportSchedule = createDocumentsVersionRetentionExportSchedule({
      now: normalizedNow,
      days: normalizedDays,
      maxDocuments: normalizedMaxDocuments,
    });
    const policyAutomation = createDocumentsVersionRetentionPolicyAutomationPlan({
      retentionReport,
      documentSummaries,
      maxActions: normalizedMaxAutomationActions,
    });
    const exportDelivery = createDocumentsVersionRetentionExportDeliveryPlan({
      generatedAt: normalizedNow,
      exportSchedule,
      alerts,
      policyAutomation,
    });
    const persistedExportDelivery = await upsertDocumentsVersionRetentionExportJob({
      deliveryPlan: exportDelivery,
      exportSchedule,
      generatedAt: normalizedNow,
      policyAutomation,
    });
    const deliveryHistory = await getDocumentsVersionRetentionExportDeliveryHistory({ limit: 5 });
    const exportReliability = await getDocumentsVersionRetentionExportDeliveryReliability({ now: normalizedNow });
    const serializedExportDelivery = serializeDocumentsVersionRetentionExportJob(persistedExportDelivery) || {
      ...exportDelivery,
      persisted: false,
      delivery_history_count: 0,
    };

    return {
      type: 'documents_version_retention_dashboard',
      schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      generated_at: normalizedNow.toISOString(),
      scope: 'admin',
      window: {
        days: trend.days,
        from: trend.from,
        to: trend.to,
        bucket: trend.bucket,
      },
      retention: {
        max_snapshots: normalizedMaxSnapshots,
        policy: 'keep-latest',
      },
      documents_count: groupedSnapshots.size,
      returned_documents_count: documentSummaries.length,
      retention_report: retentionReport,
      buckets: trend.buckets,
      document_summaries: documentSummaries,
      alerting: {
        max_alerts: normalizedMaxAlerts,
        alert_count: alerts.length,
        critical_count: alerts.filter((alert) => alert.severity === 'critical').length,
        warning_count: alerts.filter((alert) => alert.severity === 'warning').length,
      },
      alerts,
      export_schedule: exportSchedule,
      policy_automation: policyAutomation,
      export_delivery: serializedExportDelivery,
      export_reliability: exportReliability,
      delivery_history: deliveryHistory
        .map(serializeDocumentsVersionRetentionExportJob)
        .filter(Boolean),
    };
  } catch (error) {
    logger.error('[getDocumentsVersionSnapshotRetentionDashboard] Error building retention dashboard', error);
    throw new Error('Error building document version snapshot retention dashboard');
  }
};

const updateDocumentsVersionSnapshotRetention = async ({
  documentId,
  snapshotId,
  retentionPolicy,
  retainedUntil,
} = {}) => {
  const normalizedDocumentId = asString(documentId);
  const normalizedSnapshotId = asString(snapshotId);
  const normalizedRetentionPolicy = normalizeRetentionPolicy(retentionPolicy);
  const normalizedRetainedUntil = asDate(retainedUntil);

  if (!normalizedDocumentId) {
    throw new Error('documentId is required');
  }

  if (!normalizedSnapshotId) {
    throw new Error('snapshotId is required');
  }

  if (normalizedRetentionPolicy === 'retain-until' && !normalizedRetainedUntil) {
    throw new Error('retainedUntil is required for retain-until retention');
  }

  try {
    return await DocumentsVersionSnapshot.findOneAndUpdate(
      {
        documentId: normalizedDocumentId,
        snapshotId: normalizedSnapshotId,
      },
      {
        $set: {
          retentionPolicy: normalizedRetentionPolicy,
          retainedUntil: normalizedRetentionPolicy === 'retain-until' ? normalizedRetainedUntil : null,
        },
      },
      { new: true, lean: true },
    );
  } catch (error) {
    logger.error('[updateDocumentsVersionSnapshotRetention] Error updating snapshot retention', error);
    throw new Error('Error updating document version snapshot retention');
  }
};

const saveDocumentsVersionSnapshot = async ({ documentId, userId, snapshot = {} } = {}) => {
  const normalizedDocumentId = asString(documentId);
  const normalizedUserId = asString(userId);
  const contentHash = createDocumentsVersionSnapshotHash(snapshot);

  if (!normalizedDocumentId) {
    throw new Error('documentId is required');
  }

  try {
    const existing = await DocumentsVersionSnapshot.findOne({
      documentId: normalizedDocumentId,
      contentHash,
    }).lean();

    if (existing) {
      return { snapshot: existing, created: false };
    }

    const latest = await DocumentsVersionSnapshot.findOne({ documentId: normalizedDocumentId })
      .sort({ versionNumber: -1 })
      .lean();
    const versionNumber = Math.max(asNumber(latest?.versionNumber), 0) + 1;
    const metadata = asPlainObject(snapshot.metadata);
    const retentionPolicy = normalizeRetentionPolicy(snapshot.retention_policy ?? snapshot.retentionPolicy);
    const retainedUntil = asDate(snapshot.retained_until ?? snapshot.retainedUntil);
    const origin = normalizeOrigin(snapshot.origin ?? snapshot.source);
    const clientSnapshotId = asString(
      snapshot.client_snapshot_id ?? snapshot.clientSnapshotId ?? snapshot.id ?? snapshot.snapshot_id,
    );
    const sourceVersionId = asString(snapshot.source_version_id ?? snapshot.sourceVersionId ?? snapshot.version_id);

    const created = await DocumentsVersionSnapshot.create({
      documentId: normalizedDocumentId,
      snapshotId: `documents-version-${crypto.randomUUID()}`,
      versionNumber,
      title: asString(snapshot.title, 'Untitled Document'),
      wordCount: asNumber(snapshot.word_count ?? snapshot.wordCount),
      changeNote: asString(snapshot.change_note ?? snapshot.changeNote, 'Saved from Tiptap editor'),
      changeType: asString(snapshot.change_type ?? snapshot.changeType, 'tiptap_snapshot'),
      schemaVersion: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      retentionPolicy,
      retainedUntil: retentionPolicy === 'retain-until' ? retainedUntil : null,
      origin,
      clientSnapshotId,
      sourceVersionId,
      authorId: asString(snapshot.author_id ?? snapshot.authorId, normalizedUserId),
      content: snapshot.content === undefined ? null : snapshot.content,
      contentText: asString(snapshot.content_text ?? snapshot.contentText),
      metadata,
      contentHash,
      sourceUpdatedAt: asDate(snapshot.updated_at ?? snapshot.updatedAt ?? snapshot.source_updated_at),
      savedAt: new Date(),
    });

    const retention = await pruneDocumentsVersionSnapshots({ documentId: normalizedDocumentId });

    return { snapshot: created.toObject(), created: true, retention };
  } catch (error) {
    if (error?.code === 11000 || error?.code === 11001) {
      const existing = await DocumentsVersionSnapshot.findOne({
        documentId: normalizedDocumentId,
        contentHash,
      }).lean();

      if (existing) {
        return { snapshot: existing, created: false };
      }
    }

    logger.error('[saveDocumentsVersionSnapshot] Error saving snapshot', error);
    throw new Error('Error saving document version snapshot');
  }
};

module.exports = {
  DocumentsVersionSnapshot,
  DocumentsVersionRetentionExportJob,
  DocumentsVersionRetentionPruneAudit,
  DocumentsVersionRetentionRunbookEvidence,
  DocumentsVersionRetentionReminderNotification,
  DOCUMENTS_VERSION_RETENTION_PRUNE_CONFIRMATION,
  DOCUMENTS_VERSION_RETENTION_RESTORE_DRILL_CONFIRMATION,
  DOCUMENTS_VERSION_RETENTION_POLICIES,
  DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
  createDocumentsVersionSnapshotRetentionTrend,
  createDocumentsVersionSnapshotHash,
  countDueDocumentsVersionRetentionExportJobs,
  countDueDocumentsVersionRetentionReminderNotifications,
  dispatchDocumentsVersionRetentionEvidenceReminderNotifications,
  dispatchDocumentsVersionRetentionExportJobs,
  executeDocumentsVersionRetentionRestoreDrill,
  executeDocumentsVersionSnapshotRetentionPrune,
  getDocumentsVersionSnapshotRetentionDashboard,
  getDocumentsVersionSnapshotRetentionExport,
  getDocumentsVersionSnapshotRetentionTrends,
  getDocumentsVersionSnapshots,
  getDocumentsVersionSnapshotRetentionReport,
  getDocumentsVersionHistoryMaxSnapshots,
  getDocumentsVersionRetentionAlertMaxAlerts,
  getDocumentsVersionRetentionAutomationMaxActions,
  getDocumentsVersionRetentionBackupVerification,
  getDocumentsVersionRetentionDashboardMaxDocuments,
  getDocumentsVersionRetentionExportDeliveryHistory,
  getDocumentsVersionRetentionPruneAuditHistory,
  getDocumentsVersionRetentionPruneCandidateLimit,
  getDocumentsVersionRetentionReminderNotificationHistory,
  getDocumentsVersionRetentionReminderNotificationReliability,
  getDocumentsVersionRetentionRunbookEvidenceHistory,
  getDocumentsVersionRetentionScheduledPruneGuardrails,
  getDocumentsVersionRetentionTrendDays,
  previewDocumentsVersionSnapshotRetentionPrune,
  pruneDocumentsVersionSnapshots,
  recordDocumentsVersionRetentionBackupVerificationEvidence,
  retryDocumentsVersionRetentionEvidenceReminderNotifications,
  saveDocumentsVersionSnapshot,
  serializeDocumentsVersionSnapshot,
  serializeDocumentsVersionRetentionExportJob,
  serializeDocumentsVersionRetentionReminderNotification,
  serializeDocumentsVersionRetentionRunbookEvidence,
  serializeDocumentsVersionSnapshotRetentionRecord,
  summarizeDocumentsVersionSnapshotRetention,
  updateDocumentsVersionSnapshotRetention,
  upsertDocumentsVersionRetentionExportJob,
  verifyDocumentsVersionRetentionRestoreDownload,
};

const express = require('express');
const { SystemRoles } = require('librechat-data-provider');
const { requireJwtAuth } = require('~/server/middleware');
const {
  DOCUMENTS_VERSION_RETENTION_PRUNE_CONFIRMATION,
  DOCUMENTS_VERSION_RETENTION_RESTORE_DRILL_CONFIRMATION,
  DOCUMENTS_VERSION_RETENTION_POLICIES,
  DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
  dispatchDocumentsVersionRetentionEvidenceReminderNotifications,
  dispatchDocumentsVersionRetentionExportJobs,
  executeDocumentsVersionRetentionRestoreDrill,
  executeDocumentsVersionSnapshotRetentionPrune,
  getDocumentsVersionHistoryMaxSnapshots,
  getDocumentsVersionSnapshotRetentionDashboard,
  getDocumentsVersionSnapshotRetentionExport,
  getDocumentsVersionSnapshotRetentionReport,
  getDocumentsVersionSnapshotRetentionTrends,
  getDocumentsVersionSnapshots,
  getDocumentsVersionRetentionBackupVerification,
  getDocumentsVersionRetentionPruneAuditHistory,
  getDocumentsVersionRetentionScheduledPruneGuardrails,
  previewDocumentsVersionSnapshotRetentionPrune,
  recordDocumentsVersionRetentionBackupVerificationEvidence,
  retryDocumentsVersionRetentionEvidenceReminderNotifications,
  saveDocumentsVersionSnapshot,
  serializeDocumentsVersionSnapshot,
  updateDocumentsVersionSnapshotRetention,
  verifyDocumentsVersionRetentionRestoreDownload,
} = require('~/models/DocumentsVersionSnapshot');
const {
  verifyDocumentsCollaborationDocumentAccess,
} = require('~/server/services/DocumentsCollaborationPermissions');
const {
  getDocumentsRetentionExportWorkerStatus,
  getDocumentsRetentionReminderNotificationWorkerStatus,
  runDocumentsRetentionExportWorkerPass,
  runDocumentsRetentionReminderNotificationWorkerPass,
} = require('~/server/services/DocumentsRetentionExportWorker');

const router = express.Router();

router.use(requireJwtAuth);

function getAuthenticatedUserId(req) {
  return req.user?.id;
}

function validateAuthenticatedUser(req, res) {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const requestedUserId = String(req.body?.user_id || req.query?.user_id || '').trim();

  if (!authenticatedUserId) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }

  if (requestedUserId && requestedUserId !== authenticatedUserId) {
    res.status(403).json({ message: 'Cannot act on behalf of another user' });
    return null;
  }

  return authenticatedUserId;
}

function requireAdminUser(req, res) {
  const role = String(req.user?.role || '').trim().toUpperCase();

  if (role === SystemRoles.ADMIN) {
    return true;
  }

  res.status(403).json({ message: 'Admin access required' });
  return false;
}

function validateDocumentId(req, res) {
  const documentId = String(req.params?.documentId || '').trim();

  if (!documentId) {
    res.status(400).json({ message: 'document_id is required' });
    return null;
  }

  return documentId;
}

function validateSnapshotId(req, res) {
  const snapshotId = String(req.params?.snapshotId || '').trim();

  if (!snapshotId) {
    res.status(400).json({ message: 'snapshot_id is required' });
    return null;
  }

  return snapshotId;
}

function validateRetentionPayload(req, res) {
  const rawPolicy = String(req.body?.retention_policy ?? req.body?.retentionPolicy ?? '').trim();
  const retentionPolicy = rawPolicy.replace(/_/g, '-').toLowerCase();

  if (!DOCUMENTS_VERSION_RETENTION_POLICIES.has(retentionPolicy)) {
    res.status(400).json({ message: 'retention_policy is invalid' });
    return null;
  }

  const rawRetainedUntil = req.body?.retained_until ?? req.body?.retainedUntil ?? null;
  const retainedUntil = rawRetainedUntil ? new Date(rawRetainedUntil) : null;

  if (retentionPolicy === 'retain-until' && (!retainedUntil || !Number.isFinite(retainedUntil.getTime()))) {
    res.status(400).json({ message: 'retained_until is required for retain-until retention' });
    return null;
  }

  return {
    retentionPolicy,
    retainedUntil,
  };
}

async function requireDocumentAccess(req, res, { documentId, authenticatedUserId }) {
  const documentAccess = await verifyDocumentsCollaborationDocumentAccess({
    documentId,
    userId: authenticatedUserId,
    authorizationHeader: req.get('authorization'),
  });

  if (documentAccess.ok) {
    return true;
  }

  const isAccessDenied = documentAccess.reason === 'access_denied';

  res.status(isAccessDenied ? 403 : 503).json({
    message: isAccessDenied
      ? 'Document access denied'
      : 'Document permission check unavailable',
  });
  return false;
}

function getSnapshotPayload(req) {
  return req.body?.version || req.body?.snapshot || req.body || {};
}

function retentionReportExportFilename(documentId) {
  const safeDocumentId = String(documentId || 'document')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'document';

  return `${safeDocumentId}-retention-report.json`;
}

function retentionDashboardExportFilename() {
  return `documents-retention-dashboard-${new Date().toISOString().slice(0, 10)}.json`;
}

router.get('/admin/retention-dashboard', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId || !requireAdminUser(req, res)) {
    return;
  }

  const payload = await getDocumentsVersionSnapshotRetentionDashboard({
    days: req.query?.days,
    maxDocuments: req.query?.max_documents ?? req.query?.maxDocuments,
    maxAlerts: req.query?.max_alerts ?? req.query?.maxAlerts,
    maxAutomationActions: req.query?.max_automation_actions ?? req.query?.maxAutomationActions,
  });
  const exportWorker = await getDocumentsRetentionExportWorkerStatus();
  const reminderNotificationWorker = await getDocumentsRetentionReminderNotificationWorkerStatus();
  const pruneAuditHistory = await getDocumentsVersionRetentionPruneAuditHistory({ limit: 5 });
  const scheduledPruneAutomation = await getDocumentsVersionRetentionScheduledPruneGuardrails({
    auditHistory: pruneAuditHistory,
  });
  const backupVerification = await getDocumentsVersionRetentionBackupVerification({
    deliveryHistory: payload.delivery_history,
    auditHistory: pruneAuditHistory,
    scheduledPruneAutomation,
  });

  if (req.query?.download === '1' || req.query?.download === 'true') {
    res.set({
      'Content-Disposition': `attachment; filename="${retentionDashboardExportFilename()}"`,
    });
  }

  return res.status(200).json({
    ...payload,
    export_worker: exportWorker,
    reminder_notification_worker: reminderNotificationWorker,
    prune_audit_history: pruneAuditHistory,
    scheduled_prune_automation: scheduledPruneAutomation,
    backup_verification: backupVerification,
  });
});

router.post('/admin/retention-dashboard/dispatch', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId || !requireAdminUser(req, res)) {
    return;
  }

  const payload = await dispatchDocumentsVersionRetentionExportJobs({
    limit: req.body?.limit ?? req.query?.limit,
  });
  const workerStatus = await getDocumentsRetentionExportWorkerStatus();

  return res.status(200).json({
    ...payload,
    worker_status: workerStatus,
  });
});

router.post('/admin/retention-dashboard/worker/run', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId || !requireAdminUser(req, res)) {
    return;
  }

  const payload = await runDocumentsRetentionExportWorkerPass({
    limit: req.body?.limit ?? req.query?.limit,
    source: 'admin-manual',
  });

  return res.status(200).json(payload);
});

router.post('/admin/retention-dashboard/backup-verification/evidence-reminder/retry-worker/run', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId || !requireAdminUser(req, res)) {
    return;
  }

  const payload = await runDocumentsRetentionReminderNotificationWorkerPass({
    limit: req.body?.limit ?? req.query?.limit,
    source: 'admin-manual',
  });

  return res.status(200).json(payload);
});

router.get('/admin/retention-dashboard/backup-verification', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId || !requireAdminUser(req, res)) {
    return;
  }

  const auditHistory = await getDocumentsVersionRetentionPruneAuditHistory({ limit: 20 });
  const scheduledPruneAutomation = await getDocumentsVersionRetentionScheduledPruneGuardrails({
    auditHistory,
  });
  const payload = await getDocumentsVersionRetentionBackupVerification({
    auditHistory,
    scheduledPruneAutomation,
  });

  return res.status(200).json(payload);
});

router.post('/admin/retention-dashboard/backup-verification/evidence', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId || !requireAdminUser(req, res)) {
    return;
  }

  const auditHistory = await getDocumentsVersionRetentionPruneAuditHistory({ limit: 20 });
  const scheduledPruneAutomation = await getDocumentsVersionRetentionScheduledPruneGuardrails({
    auditHistory,
  });
  const verification = await getDocumentsVersionRetentionBackupVerification({
    auditHistory,
    scheduledPruneAutomation,
    includeEvidence: false,
  });
  const result = await recordDocumentsVersionRetentionBackupVerificationEvidence({
    verification,
    requestedBy: authenticatedUserId,
  });
  const refreshedVerification = await getDocumentsVersionRetentionBackupVerification({
    auditHistory,
    scheduledPruneAutomation,
  });

  return res.status(result.created ? 201 : 200).json({
    type: 'documents_version_retention_backup_verification_evidence_record',
    payload_content_free: true,
    created: result.created,
    evidence: result.evidence,
    verification: refreshedVerification,
  });
});

router.post('/admin/retention-dashboard/backup-verification/restore-download', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId || !requireAdminUser(req, res)) {
    return;
  }

  const payload = await verifyDocumentsVersionRetentionRestoreDownload({
    manifestId: req.body?.manifest_id ?? req.body?.manifestId ?? req.query?.manifest_id ?? req.query?.manifestId,
  });

  return res.status(200).json(payload);
});

router.post('/admin/retention-dashboard/backup-verification/evidence-reminder/notify', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId || !requireAdminUser(req, res)) {
    return;
  }

  const payload = await dispatchDocumentsVersionRetentionEvidenceReminderNotifications();

  return res.status(payload.created ? 201 : 200).json(payload);
});

router.post('/admin/retention-dashboard/backup-verification/evidence-reminder/retry', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId || !requireAdminUser(req, res)) {
    return;
  }

  const payload = await retryDocumentsVersionRetentionEvidenceReminderNotifications();
  const workerStatus = await getDocumentsRetentionReminderNotificationWorkerStatus();

  return res.status(200).json({
    ...payload,
    worker_status: workerStatus,
  });
});

router.get('/admin/retention-dashboard/prune-preview', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId || !requireAdminUser(req, res)) {
    return;
  }

  const payload = await previewDocumentsVersionSnapshotRetentionPrune({
    maxSnapshots: req.query?.max_snapshots ?? req.query?.maxSnapshots,
    limit: req.query?.limit,
  });
  const auditHistory = await getDocumentsVersionRetentionPruneAuditHistory({ limit: 5 });
  const scheduledPruneAutomation = await getDocumentsVersionRetentionScheduledPruneGuardrails({
    auditHistory,
  });

  return res.status(200).json({
    ...payload,
    audit_history: auditHistory,
    scheduled_prune_automation: scheduledPruneAutomation,
  });
});

router.post('/admin/retention-dashboard/prune', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId || !requireAdminUser(req, res)) {
    return;
  }

  const confirmation = String(req.body?.confirmation ?? req.body?.confirm ?? '').trim();

  if (confirmation !== DOCUMENTS_VERSION_RETENTION_PRUNE_CONFIRMATION) {
    return res.status(400).json({
      message: `confirmation must equal ${DOCUMENTS_VERSION_RETENTION_PRUNE_CONFIRMATION}`,
      confirmation_required: true,
      confirmation_token: DOCUMENTS_VERSION_RETENTION_PRUNE_CONFIRMATION,
    });
  }

  const payload = await executeDocumentsVersionSnapshotRetentionPrune({
    confirmation,
    maxSnapshots: req.body?.max_snapshots ?? req.body?.maxSnapshots ?? req.query?.max_snapshots ?? req.query?.maxSnapshots,
    limit: req.body?.limit ?? req.query?.limit,
    requestedBy: authenticatedUserId,
  });

  return res.status(200).json(payload);
});

router.post('/admin/retention-dashboard/prune-audits/:auditId/restore-drill', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId || !requireAdminUser(req, res)) {
    return;
  }

  try {
    const payload = await executeDocumentsVersionRetentionRestoreDrill({
      auditId: req.params.auditId,
      confirmation: req.body?.confirmation ?? req.body?.confirm,
      backupHandoffConfirmed: req.body?.backup_handoff_confirmed ?? req.body?.backupHandoffConfirmed,
      requestedBy: authenticatedUserId,
    });

    return res.status(200).json(payload);
  } catch (error) {
    if (error?.code === 'audit_not_found') {
      return res.status(404).json({ message: error.message });
    }

    if (error?.code === 'audit_id_required') {
      return res.status(400).json({ message: error.message });
    }

    if (error?.code === 'restore_drill_confirmation_required') {
      return res.status(400).json({
        message: error.message,
        confirmation_required: true,
        confirmation_token: DOCUMENTS_VERSION_RETENTION_RESTORE_DRILL_CONFIRMATION,
        backup_handoff_required: true,
      });
    }

    throw error;
  }
});

router.get('/:documentId/retention-report', async (req, res) => {
  const documentId = validateDocumentId(req, res);
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!documentId || !authenticatedUserId) {
    return;
  }

  if (!(await requireDocumentAccess(req, res, { documentId, authenticatedUserId }))) {
    return;
  }

  const payload = await getDocumentsVersionSnapshotRetentionExport({ documentId });

  if (req.query?.download === '1' || req.query?.download === 'true') {
    res.set({
      'Content-Disposition': `attachment; filename="${retentionReportExportFilename(documentId)}"`,
    });
  }

  return res.status(200).json(payload);
});

router.get('/:documentId/retention-trends', async (req, res) => {
  const documentId = validateDocumentId(req, res);
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!documentId || !authenticatedUserId) {
    return;
  }

  if (!(await requireDocumentAccess(req, res, { documentId, authenticatedUserId }))) {
    return;
  }

  const payload = await getDocumentsVersionSnapshotRetentionTrends({
    documentId,
    days: req.query?.days,
  });

  return res.status(200).json(payload);
});

router.get('/:documentId/versions', async (req, res) => {
  const documentId = validateDocumentId(req, res);
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!documentId || !authenticatedUserId) {
    return;
  }

  if (!(await requireDocumentAccess(req, res, { documentId, authenticatedUserId }))) {
    return;
  }

  const snapshots = await getDocumentsVersionSnapshots({
    documentId,
    limit: req.query?.limit,
  });
  const retentionReport = await getDocumentsVersionSnapshotRetentionReport({ documentId });

  return res.status(200).json({
    schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
    retention: {
      max_snapshots: getDocumentsVersionHistoryMaxSnapshots(),
      policy: 'keep-latest',
    },
    retention_report: retentionReport,
    versions: snapshots.map(serializeDocumentsVersionSnapshot).filter(Boolean),
  });
});

router.post('/:documentId/versions', async (req, res) => {
  const documentId = validateDocumentId(req, res);
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!documentId || !authenticatedUserId) {
    return;
  }

  if (!(await requireDocumentAccess(req, res, { documentId, authenticatedUserId }))) {
    return;
  }

  const result = await saveDocumentsVersionSnapshot({
    documentId,
    userId: authenticatedUserId,
    snapshot: getSnapshotPayload(req),
  });
  const retentionReport = await getDocumentsVersionSnapshotRetentionReport({ documentId });

  return res.status(result.created ? 201 : 200).json({
    created: result.created,
    retention: result.retention
      ? {
          deleted_count: result.retention.deletedCount,
          kept_count: result.retention.keptCount,
          max_snapshots: result.retention.maxSnapshots,
        }
      : undefined,
    retention_report: retentionReport,
    version: serializeDocumentsVersionSnapshot(result.snapshot),
  });
});

router.patch('/:documentId/versions/:snapshotId/retention', async (req, res) => {
  const documentId = validateDocumentId(req, res);
  const snapshotId = validateSnapshotId(req, res);
  const authenticatedUserId = validateAuthenticatedUser(req, res);
  const retentionPayload = validateRetentionPayload(req, res);

  if (!documentId || !snapshotId || !authenticatedUserId || !retentionPayload) {
    return;
  }

  if (!(await requireDocumentAccess(req, res, { documentId, authenticatedUserId }))) {
    return;
  }

  const snapshot = await updateDocumentsVersionSnapshotRetention({
    documentId,
    snapshotId,
    retentionPolicy: retentionPayload.retentionPolicy,
    retainedUntil: retentionPayload.retainedUntil,
  });

  if (!snapshot) {
    return res.status(404).json({ message: 'Version snapshot not found' });
  }

  const retentionReport = await getDocumentsVersionSnapshotRetentionReport({ documentId });

  return res.status(200).json({
    retention_report: retentionReport,
    version: serializeDocumentsVersionSnapshot(snapshot),
  });
});

router.post('/:documentId/versions/import', async (req, res) => {
  const documentId = validateDocumentId(req, res);
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!documentId || !authenticatedUserId) {
    return;
  }

  if (!(await requireDocumentAccess(req, res, { documentId, authenticatedUserId }))) {
    return;
  }

  const versions = Array.isArray(req.body?.versions) ? req.body.versions : [];

  if (versions.length === 0) {
    return res.status(400).json({ message: 'versions are required' });
  }

  const savedVersions = [];
  let added = 0;
  let deletedCount = 0;
  let keptCount = 0;
  let maxSnapshots = getDocumentsVersionHistoryMaxSnapshots();

  for (const version of versions.slice(0, 100)) {
    const result = await saveDocumentsVersionSnapshot({
      documentId,
      userId: authenticatedUserId,
      snapshot: version,
    });

    if (result.created) {
      added += 1;
    }

    if (result.retention) {
      deletedCount += result.retention.deletedCount || 0;
      keptCount = result.retention.keptCount || keptCount;
      maxSnapshots = result.retention.maxSnapshots || maxSnapshots;
    }

    savedVersions.push(result.snapshot);
  }
  const retentionReport = await getDocumentsVersionSnapshotRetentionReport({ documentId });

  return res.status(200).json({
    added,
    retention: {
      deleted_count: deletedCount,
      kept_count: keptCount,
      max_snapshots: maxSnapshots,
    },
    retention_report: retentionReport,
    versions: savedVersions.map(serializeDocumentsVersionSnapshot).filter(Boolean),
  });
});

module.exports = router;

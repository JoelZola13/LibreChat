const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mockAuthenticatedUser = { id: 'user-1', role: 'USER' };

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, _res, next) => {
    req.user = mockAuthenticatedUser;
    next();
  },
}));

jest.mock('~/server/services/DocumentsCollaborationPermissions', () => ({
  verifyDocumentsCollaborationDocumentAccess: jest.fn(() => Promise.resolve({ ok: true })),
}));

const documentsHistory = require('./documentsHistory');
const {
  DOCUMENTS_VERSION_RETENTION_RESTORE_DRILL_CONFIRMATION,
  DocumentsVersionRetentionExportJob,
  DocumentsVersionRetentionPruneAudit,
  DocumentsVersionRetentionReminderNotification,
  DocumentsVersionRetentionRunbookEvidence,
  DocumentsVersionSnapshot,
  saveDocumentsVersionSnapshot,
} = require('~/models/DocumentsVersionSnapshot');
const {
  verifyDocumentsCollaborationDocumentAccess,
} = require('~/server/services/DocumentsCollaborationPermissions');
const {
  resetDocumentsRetentionExportWorkerRuntime,
  resetDocumentsRetentionReminderNotificationWorkerRuntime,
} = require('~/server/services/DocumentsRetentionExportWorker');

describe('documentsHistory route', () => {
  let app;
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    resetDocumentsRetentionExportWorkerRuntime();
    resetDocumentsRetentionReminderNotificationWorkerRuntime();
    mockAuthenticatedUser = { id: 'user-1', role: 'USER' };
    await DocumentsVersionSnapshot.deleteMany({});
    await DocumentsVersionRetentionExportJob.deleteMany({});
    await DocumentsVersionRetentionPruneAudit.deleteMany({});
    await DocumentsVersionRetentionRunbookEvidence.deleteMany({});
    await DocumentsVersionRetentionReminderNotification.deleteMany({});
    app = express();
    app.use(express.json());
    app.use('/api/documents/history', documentsHistory);
  });

  afterEach(() => {
    resetDocumentsRetentionExportWorkerRuntime();
    resetDocumentsRetentionReminderNotificationWorkerRuntime();
  });

  it('appends and lists durable document snapshots after checking document access', async () => {
    const createResponse = await request(app)
      .post('/api/documents/history/doc-1/versions?user_id=user-1')
      .send({
        title: 'History Route Test',
        word_count: 3,
        change_note: 'Saved from test',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        content_text: 'route test body',
        metadata: { page: 'letter' },
        updated_at: '2026-05-04T10:05:00.000Z',
      })
      .expect(201);

    expect(createResponse.body.created).toBe(true);
    expect(createResponse.body.retention).toMatchObject({
      max_snapshots: 100,
    });
    expect(createResponse.body.version).toMatchObject({
      document_id: 'doc-1',
      source: 'durable',
      schema_version: 2,
      retention_policy: 'keep-latest',
      origin: 'tiptap_editor',
      version_number: 1,
      title: 'History Route Test',
    });
    expect(verifyDocumentsCollaborationDocumentAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
        userId: 'user-1',
      }),
    );

    const duplicateResponse = await request(app)
      .post('/api/documents/history/doc-1/versions?user_id=user-1')
      .send({
        title: 'History Route Test',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        content_text: 'route test body',
        metadata: { page: 'letter' },
      })
      .expect(200);

    expect(duplicateResponse.body.created).toBe(false);
    expect(duplicateResponse.body.version.id).toBe(createResponse.body.version.id);

    const listResponse = await request(app)
      .get('/api/documents/history/doc-1/versions?user_id=user-1')
      .expect(200);

    expect(listResponse.body.versions).toHaveLength(1);
    expect(listResponse.body).toMatchObject({
      schema_version: 2,
      retention: {
        max_snapshots: 100,
        policy: 'keep-latest',
      },
      retention_report: {
        schema_version: 2,
        max_snapshots: 100,
        total_count: 1,
        keep_latest_count: 1,
        keep_forever_count: 0,
        retain_until_count: 0,
        protected_count: 0,
        prunable_count: 1,
      },
    });
    expect(listResponse.body.versions[0]).toMatchObject({
      id: createResponse.body.version.id,
      document_id: 'doc-1',
      source: 'durable',
    });

    const retentionResponse = await request(app)
      .patch(`/api/documents/history/doc-1/versions/${createResponse.body.version.id}/retention?user_id=user-1`)
      .send({
        retention_policy: 'keep-forever',
      })
      .expect(200);

    expect(retentionResponse.body.version).toMatchObject({
      id: createResponse.body.version.id,
      retention_policy: 'keep-forever',
      retained_until: null,
    });
    expect(retentionResponse.body.retention_report).toMatchObject({
      total_count: 1,
      keep_latest_count: 0,
      keep_forever_count: 1,
      protected_count: 1,
      prunable_count: 0,
    });

    const exportResponse = await request(app)
      .get('/api/documents/history/doc-1/retention-report?user_id=user-1&download=1')
      .expect(200);

    expect(exportResponse.headers['content-disposition']).toContain('doc-1-retention-report.json');
    expect(exportResponse.body).toMatchObject({
      type: 'documents_version_retention_report',
      schema_version: 2,
      document_id: 'doc-1',
      retention_report: {
        total_count: 1,
        keep_latest_count: 0,
        keep_forever_count: 1,
        protected_count: 1,
        prunable_count: 0,
      },
    });
    expect(exportResponse.body.snapshots).toHaveLength(1);
    expect(exportResponse.body.snapshots[0]).toMatchObject({
      id: createResponse.body.version.id,
      retention_policy: 'keep-forever',
      content_hash: expect.any(String),
    });
    expect(exportResponse.body.snapshots[0]).not.toHaveProperty('content');
    expect(exportResponse.body.snapshots[0]).not.toHaveProperty('content_text');
    expect(exportResponse.body.snapshots[0]).not.toHaveProperty('metadata');

    const trendResponse = await request(app)
      .get('/api/documents/history/doc-1/retention-trends?user_id=user-1&days=7')
      .expect(200);

    expect(trendResponse.body).toMatchObject({
      type: 'documents_version_retention_trends',
      schema_version: 2,
      document_id: 'doc-1',
      window: {
        days: 7,
        bucket: 'day',
      },
      retention_report: {
        total_count: 1,
        keep_forever_count: 1,
        protected_count: 1,
        prunable_count: 0,
      },
    });
    expect(trendResponse.body.buckets).toHaveLength(7);
    expect(trendResponse.body.buckets[trendResponse.body.buckets.length - 1]).toMatchObject({
      cumulative_count: 1,
      protected_count: 1,
      prunable_count: 0,
    });
    expect(trendResponse.body.buckets[0]).not.toHaveProperty('content');
    expect(trendResponse.body.buckets[0]).not.toHaveProperty('content_text');
    expect(trendResponse.body.buckets[0]).not.toHaveProperty('metadata');

    const invalidRetentionResponse = await request(app)
      .patch(`/api/documents/history/doc-1/versions/${createResponse.body.version.id}/retention?user_id=user-1`)
      .send({
        retention_policy: 'retain-until',
      })
      .expect(400);

    expect(invalidRetentionResponse.body).toMatchObject({
      message: 'retained_until is required for retain-until retention',
    });
  });

  it('gates and returns a content-free admin retention dashboard', async () => {
    await saveDocumentsVersionSnapshot({
      documentId: 'doc-a',
      userId: 'user-1',
      snapshot: {
        title: 'Admin Dashboard A',
        word_count: 2,
        retention_policy: 'keep-latest',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        content_text: 'dashboard a',
        metadata: { page: 'letter' },
      },
    });
    await saveDocumentsVersionSnapshot({
      documentId: 'doc-a',
      userId: 'user-1',
      snapshot: {
        title: 'Admin Dashboard A',
        word_count: 3,
        retention_policy: 'keep-forever',
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a2' }] }] },
        content_text: 'dashboard a two',
        metadata: { page: 'letter' },
      },
    });
    await saveDocumentsVersionSnapshot({
      documentId: 'doc-b',
      userId: 'user-2',
      snapshot: {
        title: 'Admin Dashboard B',
        word_count: 2,
        retention_policy: 'keep-latest',
        origin: 'local_history',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        content_text: 'dashboard b',
        metadata: { page: 'letter' },
      },
    });

    await request(app)
      .get('/api/documents/history/admin/retention-dashboard?user_id=user-1&days=7')
      .expect(403);

    mockAuthenticatedUser = { id: 'admin-1', role: 'ADMIN' };
    const response = await request(app)
      .get('/api/documents/history/admin/retention-dashboard?user_id=admin-1&days=7&max_documents=10&max_alerts=5&max_automation_actions=5')
      .expect(200);

    expect(response.body).toMatchObject({
      type: 'documents_version_retention_dashboard',
      schema_version: 2,
      scope: 'admin',
      window: {
        days: 7,
        bucket: 'day',
      },
      documents_count: 2,
      returned_documents_count: 2,
      retention_report: {
        total_count: 3,
        keep_latest_count: 2,
        keep_forever_count: 1,
        protected_count: 1,
        prunable_count: 2,
      },
      alerting: {
        max_alerts: 5,
        alert_count: 0,
        critical_count: 0,
        warning_count: 0,
      },
      export_schedule: {
        cadence: 'weekly',
        timezone: 'UTC',
        format: 'json',
        content_free: true,
        retention_window_days: 7,
        max_documents: 10,
      },
      policy_automation: {
        mode: 'dry-run',
        max_actions: 5,
        action_count: 0,
        destructive_action_count: 0,
        requires_admin_confirmation: false,
        actions: [],
      },
      export_delivery: {
        status: 'scheduled',
        background_worker: 'documents-retention-export',
        last_delivery_at: null,
        channels: ['admin-dashboard-download', 'background-export-worker'],
        payload_type: 'documents_version_retention_dashboard',
        payload_content_free: true,
        pending_alert_count: 0,
        pending_policy_action_count: 0,
        destructive_action_count: 0,
        requires_worker: true,
        persisted: true,
        delivery_history_count: 1,
        retention_window_days: 7,
        max_documents: 10,
      },
      export_worker: {
        type: 'documents_retention_export_worker_status',
        worker: 'documents-retention-export',
        scheduler_enabled: false,
        scheduler_status: 'disabled',
        mode: 'manual-dispatch-only',
        payload_content_free: true,
        scheduled: false,
        running: false,
        due_job_count: 0,
        last_run: null,
      },
      reminder_notification_worker: {
        type: 'documents_retention_reminder_notification_worker_status',
        worker: 'documents-retention-reminder-notification',
        scheduler_enabled: false,
        scheduler_status: 'disabled',
        mode: 'manual-retry-only',
        payload_content_free: true,
        scheduled: false,
        running: false,
        due_notification_count: 0,
        due_job_count: 0,
        last_run: null,
      },
      scheduled_prune_automation: {
        type: 'documents_version_retention_scheduled_prune_guardrails',
        payload_content_free: true,
        status: 'manual-only',
        scheduled_prune_allowed: false,
        required_restore_drill_count: 0,
      },
      backup_verification: {
        type: 'documents_version_retention_backup_verification',
        status: 'export-required',
        payload_content_free: true,
        backup_export_ready: false,
        backup_handoff_ready: true,
        delivered_manifest_count: 0,
        restore_download_ready: false,
        restore_download_status: 'blocked',
        evidence_review_status: 'missing',
        evidence_review_required: true,
        evidence_review_severity: 'warning',
      },
      delivery_history: [
        {
          status: 'scheduled',
          background_worker: 'documents-retention-export',
          payload_type: 'documents_version_retention_dashboard',
          payload_content_free: true,
          pending_alert_count: 0,
          pending_policy_action_count: 0,
          persisted: true,
          delivery_history_count: 1,
          retention_window_days: 7,
          max_documents: 10,
        },
      ],
    });
    expect(response.body.buckets).toHaveLength(7);
    expect(response.body.alerts).toEqual([]);
    expect(response.body.export_schedule.next_export_at).toEqual(expect.any(String));
    expect(response.body.export_delivery.next_attempt_at).toEqual(response.body.export_schedule.next_export_at);
    expect(response.body.export_delivery.delivery_id).toMatch(/^documents-retention-[a-f0-9]{16}$/);
    expect(response.body.export_delivery.idempotency_key).toMatch(/^[a-f0-9]{64}$/);
    expect(response.body.delivery_history[0].delivery_id).toEqual(response.body.export_delivery.delivery_id);
    expect(response.body.delivery_history[0].idempotency_key).toEqual(response.body.export_delivery.idempotency_key);
    expect(await DocumentsVersionRetentionExportJob.countDocuments({})).toBe(1);
    await DocumentsVersionRetentionExportJob.updateOne(
      { deliveryId: response.body.export_delivery.delivery_id },
      { $set: { nextAttemptAt: new Date('2020-01-01T00:00:00.000Z') } },
    );
    const dispatchResponse = await request(app)
      .post('/api/documents/history/admin/retention-dashboard/dispatch?user_id=admin-1')
      .send({ limit: 5 })
      .expect(200);

    expect(dispatchResponse.body).toMatchObject({
      type: 'documents_version_retention_export_dispatch',
      schema_version: 2,
      worker: 'documents-retention-export',
      attempted_count: 1,
      dispatched_count: 1,
      failed_count: 0,
      payload_content_free: true,
      worker_status: {
        type: 'documents_retention_export_worker_status',
        worker: 'documents-retention-export',
        due_job_count: 0,
        last_run: null,
      },
      deliveries: [
        {
          status: 'delivered',
          delivery_id: response.body.export_delivery.delivery_id,
          idempotency_key: response.body.export_delivery.idempotency_key,
          next_attempt_at: null,
          requires_worker: false,
          last_delivery_status: 'delivered',
        },
      ],
    });
    expect(dispatchResponse.body.manifests[0]).toMatchObject({
      type: 'documents_version_retention_delivery_manifest',
      delivery_id: response.body.export_delivery.delivery_id,
      idempotency_key: response.body.export_delivery.idempotency_key,
      payload_content_free: true,
      storage_adapter: 'database',
      storage_status: 'metadata-only',
      storage_content_free: true,
    });
    expect(dispatchResponse.body.manifests[0].manifest_id).toMatch(/^documents-retention-manifest-[a-f0-9]{16}$/);
    expect(dispatchResponse.body.manifests[0].storage_hash).toBe(dispatchResponse.body.manifests[0].payload_hash);
    expect(dispatchResponse.body.manifests[0]).not.toHaveProperty('content');

    const verificationResponse = await request(app)
      .get('/api/documents/history/admin/retention-dashboard/backup-verification?user_id=admin-1')
      .expect(200);

    expect(verificationResponse.body).toMatchObject({
      type: 'documents_version_retention_backup_verification',
      status: 'verified',
      payload_content_free: true,
      backup_export_ready: true,
      backup_handoff_ready: true,
      backup_storage_ready: true,
      delivered_manifest_count: 1,
      latest_manifest_id: dispatchResponse.body.manifests[0].manifest_id,
      latest_payload_hash: dispatchResponse.body.manifests[0].payload_hash,
      latest_storage_adapter: 'database',
      latest_storage_status: 'metadata-only',
      latest_storage_hash: dispatchResponse.body.manifests[0].payload_hash,
      restore_download_ready: false,
      restore_download_status: 'metadata-only',
      evidence_review_status: 'missing',
      evidence_review_required: true,
      evidence_review_severity: 'warning',
      evidence_reminder: {
        type: 'documents_version_retention_evidence_reminder',
        payload_content_free: true,
        status: 'missing',
        severity: 'warning',
        review_required: true,
      },
    });
    expect(verificationResponse.body).not.toHaveProperty('content');
    expect(verificationResponse.body).not.toHaveProperty('content_text');
    expect(verificationResponse.body).not.toHaveProperty('metadata');

    const restoreDownloadResponse = await request(app)
      .post('/api/documents/history/admin/retention-dashboard/backup-verification/restore-download?user_id=admin-1')
      .send({})
      .expect(200);

    expect(restoreDownloadResponse.body).toMatchObject({
      type: 'documents_version_retention_restore_download_verification',
      schema_version: 2,
      status: 'metadata-only',
      restore_download_ready: false,
      payload_content_free: true,
      delivery_id: response.body.export_delivery.delivery_id,
      manifest_id: dispatchResponse.body.manifests[0].manifest_id,
      payload_hash: dispatchResponse.body.manifests[0].payload_hash,
      storage_adapter: 'database',
      storage_status: 'metadata-only',
      storage_hash_expected: dispatchResponse.body.manifests[0].payload_hash,
      storage_hash_actual: dispatchResponse.body.manifests[0].payload_hash,
      manifest_id_matched: true,
      payload_hash_matched: true,
      storage_hash_matched: true,
      content_free: true,
    });
    expect(restoreDownloadResponse.body).not.toHaveProperty('content');
    expect(restoreDownloadResponse.body).not.toHaveProperty('content_text');
    expect(restoreDownloadResponse.body).not.toHaveProperty('metadata');

    const reminderNotificationResponse = await request(app)
      .post('/api/documents/history/admin/retention-dashboard/backup-verification/evidence-reminder/notify?user_id=admin-1')
      .send({})
      .expect(201);

    expect(reminderNotificationResponse.body).toMatchObject({
      type: 'documents_version_retention_evidence_reminder_notification_dispatch',
      schema_version: 2,
      payload_content_free: true,
      attempted_count: 1,
      delivered_count: 1,
      failed_count: 0,
      skipped_count: 0,
      created: true,
      notification: {
        type: 'documents_version_retention_evidence_reminder_notification',
        notification_id: expect.stringMatching(/^documents-retention-reminder-[a-f0-9]{16}$/),
        reminder_status: 'missing',
        severity: 'warning',
        review_required: true,
        status: 'delivered',
        delivery_adapter: 'internal-ledger',
        delivery_target: 'retention-dashboard',
        payload_content_free: true,
        latest_manifest_id: dispatchResponse.body.manifests[0].manifest_id,
        latest_payload_hash: dispatchResponse.body.manifests[0].payload_hash,
      },
      reminder: {
        type: 'documents_version_retention_evidence_reminder',
        status: 'missing',
        review_required: true,
      },
    });
    expect(reminderNotificationResponse.body.notification).not.toHaveProperty('content');
    expect(reminderNotificationResponse.body.notification).not.toHaveProperty('content_text');
    expect(reminderNotificationResponse.body.notification).not.toHaveProperty('metadata');
    expect(reminderNotificationResponse.body.verification).toMatchObject({
      evidence_reminder_notification_count: 1,
      latest_evidence_reminder_notification: {
        notification_id: reminderNotificationResponse.body.notification.notification_id,
        status: 'delivered',
        delivery_adapter: 'internal-ledger',
        payload_content_free: true,
      },
    });
    expect(await DocumentsVersionRetentionReminderNotification.countDocuments({})).toBe(1);

    const duplicateReminderNotificationResponse = await request(app)
      .post('/api/documents/history/admin/retention-dashboard/backup-verification/evidence-reminder/notify?user_id=admin-1')
      .send({})
      .expect(200);

    expect(duplicateReminderNotificationResponse.body).toMatchObject({
      attempted_count: 0,
      delivered_count: 1,
      created: false,
      notification: {
        notification_id: reminderNotificationResponse.body.notification.notification_id,
        status: 'delivered',
      },
      verification: {
        evidence_reminder_notification_count: 1,
        latest_evidence_reminder_notification: {
          notification_id: reminderNotificationResponse.body.notification.notification_id,
        },
      },
    });
    expect(await DocumentsVersionRetentionReminderNotification.countDocuments({})).toBe(1);

    const retryReminderNotificationResponse = await request(app)
      .post('/api/documents/history/admin/retention-dashboard/backup-verification/evidence-reminder/retry?user_id=admin-1')
      .send({})
      .expect(200);

    expect(retryReminderNotificationResponse.body).toMatchObject({
      type: 'documents_version_retention_evidence_reminder_notification_retry_dispatch',
      payload_content_free: true,
      attempted_count: 0,
      delivered_count: 0,
      failed_count: 0,
      skipped_count: 0,
      notifications: [],
      worker_status: {
        type: 'documents_retention_reminder_notification_worker_status',
        worker: 'documents-retention-reminder-notification',
        due_notification_count: 0,
      },
      verification: {
        evidence_reminder_notification_count: 1,
        evidence_reminder_notification_failed_count: 0,
        latest_evidence_reminder_notification: {
          notification_id: reminderNotificationResponse.body.notification.notification_id,
        },
      },
    });

    const evidenceResponse = await request(app)
      .post('/api/documents/history/admin/retention-dashboard/backup-verification/evidence?user_id=admin-1')
      .send({})
      .expect(201);

    expect(evidenceResponse.body).toMatchObject({
      type: 'documents_version_retention_backup_verification_evidence_record',
      payload_content_free: true,
      created: true,
      evidence: {
        type: 'documents_version_retention_runbook_evidence',
        evidence_id: expect.stringMatching(/^documents-retention-evidence-[a-f0-9]{16}$/),
        evidence_type: 'backup-verification',
        status: 'verified',
        requested_by: 'admin-1',
        payload_content_free: true,
        storage_adapter: 'database',
        latest_manifest_id: dispatchResponse.body.manifests[0].manifest_id,
        latest_payload_hash: dispatchResponse.body.manifests[0].payload_hash,
        backup_storage_ready: true,
        latest_storage_adapter: 'database',
        latest_storage_status: 'metadata-only',
        latest_storage_hash: dispatchResponse.body.manifests[0].payload_hash,
      },
      verification: {
        type: 'documents_version_retention_backup_verification',
        status: 'verified',
        evidence_count: 1,
        latest_evidence_id: expect.stringMatching(/^documents-retention-evidence-[a-f0-9]{16}$/),
        evidence_review_status: 'current',
        evidence_fresh: true,
        evidence_review_required: false,
        evidence_review_severity: 'info',
      },
    });
    expect(evidenceResponse.body.evidence).not.toHaveProperty('content');
    expect(evidenceResponse.body.evidence).not.toHaveProperty('content_text');
    expect(evidenceResponse.body.evidence).not.toHaveProperty('metadata');
    expect(await DocumentsVersionRetentionRunbookEvidence.countDocuments({})).toBe(1);

    const verificationWithEvidenceResponse = await request(app)
      .get('/api/documents/history/admin/retention-dashboard/backup-verification?user_id=admin-1')
      .expect(200);
    expect(verificationWithEvidenceResponse.body).toMatchObject({
      status: 'verified',
      evidence_count: 1,
      latest_evidence_id: evidenceResponse.body.evidence.evidence_id,
      evidence_review_status: 'current',
      evidence_fresh: true,
      evidence_history: [
        expect.objectContaining({
          evidence_id: evidenceResponse.body.evidence.evidence_id,
          payload_content_free: true,
        }),
      ],
    });

    expect(response.body.document_summaries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        document_id: 'doc-a',
        title: 'Admin Dashboard A',
        snapshot_count: 2,
        protected_count: 1,
      }),
      expect.objectContaining({
        document_id: 'doc-b',
        title: 'Admin Dashboard B',
        snapshot_count: 1,
        primary_origin: 'local_history',
      }),
    ]));
    expect(response.body.document_summaries[0]).not.toHaveProperty('content');
    expect(response.body.document_summaries[0]).not.toHaveProperty('content_text');
    expect(response.body.document_summaries[0]).not.toHaveProperty('metadata');
  });

  it('lets admins run a content-free retention export worker pass manually', async () => {
    mockAuthenticatedUser = { id: 'admin-1', role: 'ADMIN' };
    const dashboardResponse = await request(app)
      .get('/api/documents/history/admin/retention-dashboard?user_id=admin-1&days=7&max_documents=10')
      .expect(200);

    await DocumentsVersionRetentionExportJob.updateOne(
      { deliveryId: dashboardResponse.body.export_delivery.delivery_id },
      { $set: { nextAttemptAt: new Date('2020-01-01T00:00:00.000Z') } },
    );

    const workerResponse = await request(app)
      .post('/api/documents/history/admin/retention-dashboard/worker/run?user_id=admin-1')
      .send({ limit: 5 })
      .expect(200);

    expect(workerResponse.body).toMatchObject({
      type: 'documents_retention_export_worker_run',
      mode: 'content-free-export-dispatch',
      worker: 'documents-retention-export',
      source: 'admin-manual',
      batch_limit: 5,
      payload_content_free: true,
      status: 'completed',
      attempted_count: 1,
      dispatched_count: 1,
      failed_count: 0,
      dispatch: {
        type: 'documents_version_retention_export_dispatch',
        worker: 'documents-retention-export',
        payload_content_free: true,
      },
    });
    expect(workerResponse.body.dispatch.manifests[0]).toMatchObject({
      type: 'documents_version_retention_delivery_manifest',
      delivery_id: dashboardResponse.body.export_delivery.delivery_id,
      payload_content_free: true,
    });
    expect(workerResponse.body.dispatch.manifests[0]).not.toHaveProperty('content');
    expect(workerResponse.body.dispatch.manifests[0]).not.toHaveProperty('content_text');
    expect(workerResponse.body.dispatch.manifests[0]).not.toHaveProperty('metadata');
  });

  it('lets admins run a content-free reminder notification retry worker pass manually', async () => {
    mockAuthenticatedUser = { id: 'admin-1', role: 'ADMIN' };

    const workerResponse = await request(app)
      .post('/api/documents/history/admin/retention-dashboard/backup-verification/evidence-reminder/retry-worker/run?user_id=admin-1')
      .send({ limit: 5 })
      .expect(200);

    expect(workerResponse.body).toMatchObject({
      type: 'documents_retention_reminder_notification_worker_run',
      mode: 'content-free-reminder-notification-retry',
      worker: 'documents-retention-reminder-notification',
      source: 'admin-manual',
      batch_limit: 5,
      payload_content_free: true,
      status: 'completed',
      attempted_count: 0,
      retried_count: 0,
      failed_count: 0,
      retry: {
        type: 'documents_version_retention_evidence_reminder_notification_retry_dispatch',
        payload_content_free: true,
        attempted_count: 0,
        notifications: [],
      },
    });
  });

  it('requires explicit admin confirmation before pruning over-cap retention snapshots', async () => {
    for (let index = 1; index <= 4; index += 1) {
      await saveDocumentsVersionSnapshot({
        documentId: 'doc-prune-route',
        userId: 'user-1',
        snapshot: {
          title: `Route Prune ${index}`,
          word_count: index,
          retention_policy: index === 1 ? 'keep-forever' : 'keep-latest',
          origin: 'tiptap_editor',
          content: { type: 'doc', content: [{ type: 'paragraph' }] },
          content_text: `route prune ${index}`,
          metadata: { index },
          updated_at: `2026-05-04T12:0${index}:00.000Z`,
        },
      });
    }

    await request(app)
      .get('/api/documents/history/admin/retention-dashboard/prune-preview?user_id=user-1&max_snapshots=2')
      .expect(403);

    mockAuthenticatedUser = { id: 'admin-1', role: 'ADMIN' };
    const previewResponse = await request(app)
      .get('/api/documents/history/admin/retention-dashboard/prune-preview?user_id=admin-1&max_snapshots=2&limit=10')
      .expect(200);

    expect(previewResponse.body).toMatchObject({
      type: 'documents_version_retention_prune_preview',
      mode: 'dry-run',
      payload_content_free: true,
      confirmation_required: true,
      confirmation_token: 'PRUNE_DOCUMENT_VERSION_SNAPSHOTS',
      total_candidate_count: 1,
      candidate_count: 1,
      affected_documents_count: 1,
    });
    expect(previewResponse.body.candidates[0]).toMatchObject({
      document_id: 'doc-prune-route',
      version_number: 2,
      retention_policy: 'keep-latest',
      content_hash: expect.any(String),
    });
    expect(previewResponse.body.candidates[0]).not.toHaveProperty('content');
    expect(previewResponse.body.candidates[0]).not.toHaveProperty('content_text');
    expect(previewResponse.body.candidates[0]).not.toHaveProperty('metadata');

    const rejectedResponse = await request(app)
      .post('/api/documents/history/admin/retention-dashboard/prune?user_id=admin-1')
      .send({ max_snapshots: 2, limit: 10, confirmation: 'DELETE' })
      .expect(400);

    expect(rejectedResponse.body).toMatchObject({
      confirmation_required: true,
      confirmation_token: 'PRUNE_DOCUMENT_VERSION_SNAPSHOTS',
    });
    expect(await DocumentsVersionSnapshot.countDocuments({ documentId: 'doc-prune-route' })).toBe(4);

    const executionResponse = await request(app)
      .post('/api/documents/history/admin/retention-dashboard/prune?user_id=admin-1')
      .send({
        max_snapshots: 2,
        limit: 10,
        confirmation: 'PRUNE_DOCUMENT_VERSION_SNAPSHOTS',
      })
      .expect(200);

    expect(executionResponse.body).toMatchObject({
      type: 'documents_version_retention_prune_execution',
      mode: 'confirmed-delete',
      confirmed: true,
      requested_by: 'admin-1',
      audit_id: expect.stringMatching(/^documents-retention-prune-/),
      deleted_count: 1,
      remaining_candidate_count: 0,
      payload_content_free: true,
      restore_drill: {
        type: 'documents_version_retention_restore_drill',
        status: 'required',
        payload_content_free: true,
        deleted_count: 1,
      },
      audit: {
        type: 'documents_version_retention_prune_audit',
        requested_by: 'admin-1',
        deleted_count: 1,
        remaining_candidate_count: 0,
      },
      scheduled_prune_automation: {
        type: 'documents_version_retention_scheduled_prune_guardrails',
        scheduled_prune_allowed: false,
        required_restore_drill_count: 1,
      },
    });
    expect(await DocumentsVersionSnapshot.countDocuments({ documentId: 'doc-prune-route' })).toBe(3);
    expect(await DocumentsVersionRetentionPruneAudit.countDocuments({})).toBe(1);
    const rejectedDrillResponse = await request(app)
      .post(`/api/documents/history/admin/retention-dashboard/prune-audits/${executionResponse.body.audit_id}/restore-drill?user_id=admin-1`)
      .send({
        confirmation: 'nope',
        backup_handoff_confirmed: true,
      })
      .expect(400);
    expect(rejectedDrillResponse.body).toMatchObject({
      confirmation_required: true,
      confirmation_token: DOCUMENTS_VERSION_RETENTION_RESTORE_DRILL_CONFIRMATION,
      backup_handoff_required: true,
    });

    const drillResponse = await request(app)
      .post(`/api/documents/history/admin/retention-dashboard/prune-audits/${executionResponse.body.audit_id}/restore-drill?user_id=admin-1`)
      .send({
        confirmation: DOCUMENTS_VERSION_RETENTION_RESTORE_DRILL_CONFIRMATION,
        backup_handoff_confirmed: true,
      })
      .expect(200);
    expect(drillResponse.body).toMatchObject({
      type: 'documents_version_retention_restore_drill_execution',
      audit_id: executionResponse.body.audit_id,
      status: 'completed',
      payload_content_free: true,
      restore_drill: {
        status: 'completed',
        backup_handoff: {
          status: 'confirmed',
          payload_content_free: true,
        },
        primary_history_check: {
          status: 'passed',
          sample_snapshot_present: false,
        },
      },
      scheduled_prune_automation: {
        scheduled_prune_allowed: false,
        required_restore_drill_count: 0,
      },
    });
    expect(drillResponse.body.restore_drill).not.toHaveProperty('content');
    expect(drillResponse.body.restore_drill).not.toHaveProperty('content_text');
    expect(drillResponse.body.restore_drill).not.toHaveProperty('metadata');

    const dashboardAfterPrune = await request(app)
      .get('/api/documents/history/admin/retention-dashboard?user_id=admin-1&days=7')
      .expect(200);
    expect(dashboardAfterPrune.body.prune_audit_history[0]).toMatchObject({
      audit_id: executionResponse.body.audit_id,
      deleted_count: 1,
      payload_content_free: true,
      restore_drill: {
        status: 'completed',
      },
    });
    expect(dashboardAfterPrune.body.scheduled_prune_automation).toMatchObject({
      type: 'documents_version_retention_scheduled_prune_guardrails',
      scheduled_prune_allowed: false,
      required_restore_drill_count: 0,
    });
    expect(await DocumentsVersionSnapshot.exists({
      documentId: 'doc-prune-route',
      versionNumber: 1,
      retentionPolicy: 'keep-forever',
    })).toBeTruthy();
    expect(executionResponse.body.candidates[0]).not.toHaveProperty('content');
    expect(executionResponse.body.candidates[0]).not.toHaveProperty('content_text');
    expect(executionResponse.body.candidates[0]).not.toHaveProperty('metadata');
  });
});

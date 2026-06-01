const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const {
  DocumentsVersionRetentionExportJob,
  DocumentsVersionRetentionReminderNotification,
  DocumentsVersionSnapshot,
  dispatchDocumentsVersionRetentionEvidenceReminderNotifications,
  getDocumentsVersionRetentionBackupVerification,
  getDocumentsVersionSnapshotRetentionDashboard,
} = require('~/models/DocumentsVersionSnapshot');
const {
  getDocumentsRetentionExportWorkerEnvironment,
  getDocumentsRetentionExportWorkerStatus,
  getDocumentsRetentionReminderNotificationWorkerEnvironment,
  getDocumentsRetentionReminderNotificationWorkerStatus,
  resetDocumentsRetentionExportWorkerRuntime,
  resetDocumentsRetentionReminderNotificationWorkerRuntime,
  runDocumentsRetentionExportWorkerPass,
  runDocumentsRetentionReminderNotificationWorkerPass,
} = require('./DocumentsRetentionExportWorker');

describe('DocumentsRetentionExportWorker', () => {
  let mongoServer;
  const originalWorkerEnabled = process.env.DOCUMENTS_RETENTION_EXPORT_WORKER_ENABLED;
  const originalReminderWorkerEnabled = process.env.DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_ENABLED;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    if (originalWorkerEnabled === undefined) {
      delete process.env.DOCUMENTS_RETENTION_EXPORT_WORKER_ENABLED;
    } else {
      process.env.DOCUMENTS_RETENTION_EXPORT_WORKER_ENABLED = originalWorkerEnabled;
    }
    if (originalReminderWorkerEnabled === undefined) {
      delete process.env.DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_ENABLED;
    } else {
      process.env.DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_ENABLED = originalReminderWorkerEnabled;
    }
  });

  beforeEach(async () => {
    resetDocumentsRetentionExportWorkerRuntime();
    resetDocumentsRetentionReminderNotificationWorkerRuntime();
    delete process.env.DOCUMENTS_RETENTION_EXPORT_WORKER_ENABLED;
    delete process.env.DOCUMENTS_RETENTION_REMINDER_NOTIFICATION_WORKER_ENABLED;
    await DocumentsVersionSnapshot.deleteMany({});
    await DocumentsVersionRetentionExportJob.deleteMany({});
    await DocumentsVersionRetentionReminderNotification.deleteMany({});
  });

  afterEach(() => {
    resetDocumentsRetentionExportWorkerRuntime();
    resetDocumentsRetentionReminderNotificationWorkerRuntime();
  });

  it('reports a disabled interval scheduler by default', async () => {
    const environment = getDocumentsRetentionExportWorkerEnvironment();
    const status = await getDocumentsRetentionExportWorkerStatus({
      now: new Date('2026-05-04T15:00:00.000Z'),
    });

    expect(environment).toMatchObject({
      worker: 'documents-retention-export',
      scheduler_enabled: false,
      scheduler_status: 'disabled',
      mode: 'manual-dispatch-only',
      payload_content_free: true,
    });
    expect(status).toMatchObject({
      type: 'documents_retention_export_worker_status',
      scheduled: false,
      running: false,
      due_job_count: 0,
      health: 'manual',
      observability: {
        type: 'documents_retention_export_worker_observability',
        health: 'manual',
        run_count: 0,
        completed_count: 0,
        failed_count: 0,
        skipped_count: 0,
        consecutive_failure_count: 0,
      },
      last_run: null,
    });
  });

  it('reports a disabled reminder notification retry scheduler by default', async () => {
    const environment = getDocumentsRetentionReminderNotificationWorkerEnvironment();
    const status = await getDocumentsRetentionReminderNotificationWorkerStatus({
      now: new Date('2026-05-04T15:00:00.000Z'),
    });

    expect(environment).toMatchObject({
      worker: 'documents-retention-reminder-notification',
      scheduler_enabled: false,
      scheduler_status: 'disabled',
      mode: 'manual-retry-only',
      payload_content_free: true,
    });
    expect(status).toMatchObject({
      type: 'documents_retention_reminder_notification_worker_status',
      scheduled: false,
      running: false,
      due_notification_count: 0,
      due_job_count: 0,
      health: 'manual',
      observability: {
        type: 'documents_retention_reminder_notification_worker_observability',
        health: 'manual',
        run_count: 0,
        completed_count: 0,
        failed_count: 0,
        skipped_count: 0,
        consecutive_failure_count: 0,
      },
      last_run: null,
    });
  });

  it('runs a content-free worker pass for due retention export jobs', async () => {
    const dashboard = await getDocumentsVersionSnapshotRetentionDashboard({
      days: 4,
      maxDocuments: 10,
      maxSnapshots: 3,
      now: new Date('2026-05-04T15:00:00.000Z'),
    });

    await DocumentsVersionRetentionExportJob.updateOne(
      { deliveryId: dashboard.export_delivery.delivery_id },
      { $set: { nextAttemptAt: new Date('2026-05-04T15:01:00.000Z') } },
    );

    const beforeStatus = await getDocumentsRetentionExportWorkerStatus({
      now: new Date('2026-05-04T15:02:00.000Z'),
    });
    const run = await runDocumentsRetentionExportWorkerPass({
      now: new Date('2026-05-04T15:02:00.000Z'),
      limit: 5,
      source: 'test',
    });
    const afterStatus = await getDocumentsRetentionExportWorkerStatus({
      now: new Date('2026-05-04T15:03:00.000Z'),
    });

    expect(beforeStatus).toMatchObject({
      due_job_count: 1,
      last_run: null,
    });
    expect(run).toMatchObject({
      type: 'documents_retention_export_worker_run',
      mode: 'content-free-export-dispatch',
      worker: 'documents-retention-export',
      source: 'test',
      started_at: '2026-05-04T15:02:00.000Z',
      batch_limit: 5,
      payload_content_free: true,
      status: 'completed',
      attempted_count: 1,
      dispatched_count: 1,
      failed_count: 0,
      deliveries_count: 1,
      manifests_count: 1,
      duration_ms: expect.any(Number),
      message: '1 delivered / 0 failed.',
    });
    expect(run.run_id).toMatch(/^documents-retention-worker-/);
    expect(run.dispatch.manifests[0]).toMatchObject({
      type: 'documents_version_retention_delivery_manifest',
      delivery_id: dashboard.export_delivery.delivery_id,
      payload_content_free: true,
    });
    expect(run.dispatch.manifests[0]).not.toHaveProperty('content');
    expect(run.dispatch.manifests[0]).not.toHaveProperty('content_text');
    expect(run.dispatch.manifests[0]).not.toHaveProperty('metadata');
    expect(afterStatus).toMatchObject({
      due_job_count: 0,
      health: 'manual',
      last_run_status: 'completed',
      last_run_message: '1 delivered / 0 failed.',
      observability: {
        health: 'manual',
        run_count: 1,
        completed_count: 1,
        failed_count: 0,
        skipped_count: 0,
        consecutive_failure_count: 0,
        last_duration_ms: expect.any(Number),
        max_duration_ms: expect.any(Number),
      },
      last_run: {
        status: 'completed',
        attempted_count: 1,
        dispatched_count: 1,
        failed_count: 0,
        duration_ms: expect.any(Number),
      },
    });
  });

  it('runs a content-free worker pass for due failed reminder notifications', async () => {
    const verification = await getDocumentsVersionRetentionBackupVerification({
      now: new Date('2026-05-04T15:00:00.000Z'),
    });
    const failingNotificationClient = jest.fn(async () => ({ ok: false, status: 503, body: 'down' }));

    const failedNotification = await dispatchDocumentsVersionRetentionEvidenceReminderNotifications({
      verification,
      now: new Date('2026-05-04T15:01:00.000Z'),
      environment: {
        DOCUMENTS_RETENTION_EVIDENCE_REMINDER_WEBHOOK_URL: 'https://retention.example.test/hooks/retry-worker',
      },
      notificationClient: failingNotificationClient,
    });
    const beforeStatus = await getDocumentsRetentionReminderNotificationWorkerStatus({
      now: new Date('2026-05-04T15:16:00.000Z'),
    });
    const retryNotificationClient = jest.fn(async ({ payload, notification }) => {
      expect(notification.notification_id).toBe(failedNotification.notification.notification_id);
      expect(payload).toMatchObject({
        type: 'documents_version_retention_evidence_reminder_notification_retry',
        payload_content_free: true,
        original_notification_id: failedNotification.notification.notification_id,
      });
      expect(JSON.stringify(payload)).not.toContain('"content":');
      expect(JSON.stringify(payload)).not.toContain('"content_text":');
      expect(JSON.stringify(payload)).not.toContain('"metadata":');

      return { ok: true, status: 204, body: '' };
    });
    const run = await runDocumentsRetentionReminderNotificationWorkerPass({
      now: new Date('2026-05-04T15:16:00.000Z'),
      limit: 5,
      source: 'test',
      notificationClient: retryNotificationClient,
    });
    const afterStatus = await getDocumentsRetentionReminderNotificationWorkerStatus({
      now: new Date('2026-05-04T15:17:00.000Z'),
    });

    expect(beforeStatus).toMatchObject({
      due_notification_count: 1,
      last_run: null,
    });
    expect(run).toMatchObject({
      type: 'documents_retention_reminder_notification_worker_run',
      mode: 'content-free-reminder-notification-retry',
      worker: 'documents-retention-reminder-notification',
      source: 'test',
      started_at: '2026-05-04T15:16:00.000Z',
      batch_limit: 5,
      payload_content_free: true,
      status: 'completed',
      attempted_count: 1,
      retried_count: 1,
      failed_count: 0,
      notifications_count: 1,
      duration_ms: expect.any(Number),
      message: '1 retried / 0 failed.',
    });
    expect(run.run_id).toMatch(/^documents-retention-reminder-notification-worker-/);
    expect(run.retry.notifications[0]).toMatchObject({
      notification_id: failedNotification.notification.notification_id,
      status: 'delivered',
      payload_content_free: true,
    });
    expect(run.retry.notifications[0]).not.toHaveProperty('content');
    expect(run.retry.notifications[0]).not.toHaveProperty('content_text');
    expect(run.retry.notifications[0]).not.toHaveProperty('metadata');
    expect(afterStatus).toMatchObject({
      due_notification_count: 0,
      health: 'manual',
      last_run_status: 'completed',
      last_run_message: '1 retried / 0 failed.',
      observability: {
        health: 'manual',
        run_count: 1,
        completed_count: 1,
        failed_count: 0,
        skipped_count: 0,
        consecutive_failure_count: 0,
        last_duration_ms: expect.any(Number),
        max_duration_ms: expect.any(Number),
      },
      last_run: {
        status: 'completed',
        attempted_count: 1,
        retried_count: 1,
        failed_count: 0,
        duration_ms: expect.any(Number),
      },
    });
  });
});

const mongoose = require('mongoose');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');
const {
  DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
  DOCUMENTS_VERSION_RETENTION_RESTORE_DRILL_CONFIRMATION,
  DocumentsVersionRetentionExportJob,
  DocumentsVersionRetentionPruneAudit,
  DocumentsVersionRetentionReminderNotification,
  DocumentsVersionRetentionRunbookEvidence,
  DocumentsVersionSnapshot,
  dispatchDocumentsVersionRetentionEvidenceReminderNotifications,
  dispatchDocumentsVersionRetentionExportJobs,
  executeDocumentsVersionRetentionRestoreDrill,
  executeDocumentsVersionSnapshotRetentionPrune,
  getDocumentsVersionSnapshotRetentionDashboard,
  getDocumentsVersionSnapshotRetentionExport,
  getDocumentsVersionSnapshotRetentionReport,
  getDocumentsVersionSnapshotRetentionTrends,
  getDocumentsVersionSnapshots,
  getDocumentsVersionRetentionBackupVerification,
  getDocumentsVersionRetentionPruneAuditHistory,
  getDocumentsVersionRetentionScheduledPruneGuardrails,
  previewDocumentsVersionSnapshotRetentionPrune,
  pruneDocumentsVersionSnapshots,
  recordDocumentsVersionRetentionBackupVerificationEvidence,
  retryDocumentsVersionRetentionEvidenceReminderNotifications,
  saveDocumentsVersionSnapshot,
  serializeDocumentsVersionSnapshot,
  updateDocumentsVersionSnapshotRetention,
  verifyDocumentsVersionRetentionRestoreDownload,
} = require('./DocumentsVersionSnapshot');

describe('DocumentsVersionSnapshot', () => {
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
    await DocumentsVersionSnapshot.deleteMany({});
    await DocumentsVersionRetentionExportJob.deleteMany({});
    await DocumentsVersionRetentionPruneAudit.deleteMany({});
    await DocumentsVersionRetentionRunbookEvidence.deleteMany({});
    await DocumentsVersionRetentionReminderNotification.deleteMany({});
  });

  it('stores immutable snapshots, assigns document-scoped versions, and deduplicates identical content', async () => {
    const first = await saveDocumentsVersionSnapshot({
      documentId: 'doc-1',
      userId: 'user-1',
      snapshot: {
        title: 'Policy Memo',
        word_count: 2,
        change_note: 'Initial save',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        content_text: 'hello world',
        metadata: { page: 'letter' },
        updated_at: '2026-05-04T10:00:00.000Z',
      },
    });
    const duplicate = await saveDocumentsVersionSnapshot({
      documentId: 'doc-1',
      userId: 'user-1',
      snapshot: {
        title: 'Policy Memo',
        word_count: 2,
        change_note: 'Duplicate save',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        content_text: 'hello world',
        metadata: { page: 'letter' },
        updated_at: '2026-05-04T10:00:00.000Z',
      },
    });
    const second = await saveDocumentsVersionSnapshot({
      documentId: 'doc-1',
      userId: 'user-1',
      snapshot: {
        title: 'Policy Memo',
        word_count: 3,
        change_note: 'Second save',
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'new' }] }] },
        content_text: 'hello new world',
        metadata: { page: 'letter' },
        updated_at: '2026-05-04T10:01:00.000Z',
      },
    });

    expect(first.created).toBe(true);
    expect(first.snapshot.versionNumber).toBe(1);
    expect(duplicate.created).toBe(false);
    expect(duplicate.snapshot.snapshotId).toBe(first.snapshot.snapshotId);
    expect(second.created).toBe(true);
    expect(second.snapshot.versionNumber).toBe(2);

    const snapshots = await getDocumentsVersionSnapshots({ documentId: 'doc-1' });
    expect(snapshots).toHaveLength(2);
    expect(snapshots.map(snapshot => snapshot.versionNumber)).toEqual([2, 1]);

    const serialized = serializeDocumentsVersionSnapshot(snapshots[0]);
    expect(serialized).toMatchObject({
      document_id: 'doc-1',
      source: 'durable',
      schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      retention_policy: 'keep-latest',
      origin: 'tiptap_editor',
      version_number: 2,
      title: 'Policy Memo',
      content_text: 'hello new world',
    });
  });

  it('keeps protected snapshots while pruning older non-protected history', async () => {
    for (let index = 1; index <= 5; index += 1) {
      await saveDocumentsVersionSnapshot({
        documentId: 'doc-retention',
        userId: 'user-1',
        snapshot: {
          title: `Retention ${index}`,
          word_count: index,
          change_note: `Snapshot ${index}`,
          retention_policy: index === 1 ? 'keep-forever' : 'keep-latest',
          origin: 'local_history',
          client_snapshot_id: `local-${index}`,
          source_version_id: `source-${index}`,
          content: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: `snapshot ${index}` }] }],
          },
          content_text: `snapshot ${index}`,
          metadata: { page: 'letter', index },
          updated_at: `2026-05-04T10:0${index}:00.000Z`,
        },
      });
    }

    const retention = await pruneDocumentsVersionSnapshots({
      documentId: 'doc-retention',
      maxSnapshots: 3,
    });

    expect(retention).toMatchObject({
      deletedCount: 1,
      keptCount: 4,
      maxSnapshots: 3,
    });

    const snapshots = await getDocumentsVersionSnapshots({ documentId: 'doc-retention', limit: 10 });
    expect(snapshots.map(snapshot => snapshot.versionNumber)).toEqual([5, 4, 3, 1]);
    expect(snapshots.find(snapshot => snapshot.versionNumber === 1)).toMatchObject({
      retentionPolicy: 'keep-forever',
      origin: 'local_history',
      clientSnapshotId: 'local-1',
      sourceVersionId: 'source-1',
    });

    expect(serializeDocumentsVersionSnapshot(snapshots[0])).toMatchObject({
      retention_policy: 'keep-latest',
      origin: 'local_history',
      client_snapshot_id: 'local-5',
      source_version_id: 'source-5',
    });
  });

  it('updates durable snapshot retention policy without changing snapshot content', async () => {
    const saved = await saveDocumentsVersionSnapshot({
      documentId: 'doc-retention-control',
      userId: 'user-1',
      snapshot: {
        title: 'Retention Control',
        word_count: 2,
        change_note: 'Initial save',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        content_text: 'retention control',
        metadata: { page: 'letter' },
      },
    });

    const updated = await updateDocumentsVersionSnapshotRetention({
      documentId: 'doc-retention-control',
      snapshotId: saved.snapshot.snapshotId,
      retentionPolicy: 'keep-forever',
    });

    expect(updated).toMatchObject({
      snapshotId: saved.snapshot.snapshotId,
      retentionPolicy: 'keep-forever',
      retainedUntil: null,
      contentText: 'retention control',
    });
    expect(serializeDocumentsVersionSnapshot(updated)).toMatchObject({
      retention_policy: 'keep-forever',
      retained_until: null,
      content_text: 'retention control',
    });

    const retainedUntil = new Date('2026-06-01T00:00:00.000Z');
    const retained = await updateDocumentsVersionSnapshotRetention({
      documentId: 'doc-retention-control',
      snapshotId: saved.snapshot.snapshotId,
      retentionPolicy: 'retain-until',
      retainedUntil,
    });

    expect(serializeDocumentsVersionSnapshot(retained)).toMatchObject({
      retention_policy: 'retain-until',
      retained_until: retainedUntil.toISOString(),
    });
  });

  it('summarizes retention posture for document snapshots', async () => {
    const snapshotInputs = [
      {
        retention_policy: 'keep-latest',
        origin: 'tiptap_editor',
        content_text: 'latest one',
        updated_at: '2026-05-04T10:00:00.000Z',
      },
      {
        retention_policy: 'keep-forever',
        origin: 'local_history',
        content_text: 'forever one',
        updated_at: '2026-05-04T10:01:00.000Z',
      },
      {
        retention_policy: 'retain-until',
        retained_until: '2026-06-01T00:00:00.000Z',
        origin: 'version_history_panel',
        content_text: 'future retained',
        updated_at: '2026-05-04T10:02:00.000Z',
      },
      {
        retention_policy: 'retain-until',
        retained_until: '2026-04-01T00:00:00.000Z',
        origin: 'version_history_panel',
        content_text: 'expired retained',
        updated_at: '2026-05-04T10:03:00.000Z',
      },
    ];
    const savedSnapshots = [];

    for (const [index, snapshot] of snapshotInputs.entries()) {
      const saved = await saveDocumentsVersionSnapshot({
        documentId: 'doc-retention-report',
        userId: 'user-1',
        snapshot: {
          title: `Retention report ${index + 1}`,
          word_count: 2,
          change_note: `Snapshot ${index + 1}`,
          content: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: snapshot.content_text }] }],
          },
          metadata: { index },
          ...snapshot,
        },
      });
      savedSnapshots.push(saved.snapshot);
    }

    await Promise.all(savedSnapshots.map((snapshot, index) => DocumentsVersionSnapshot.updateOne(
      { snapshotId: snapshot.snapshotId },
      { $set: { savedAt: new Date(`2026-05-0${index + 1}T12:00:00.000Z`) } },
    )));

    const report = await getDocumentsVersionSnapshotRetentionReport({
      documentId: 'doc-retention-report',
      maxSnapshots: 3,
    });

    expect(report).toMatchObject({
      schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      max_snapshots: 3,
      total_count: 4,
      keep_latest_count: 1,
      keep_forever_count: 1,
      retain_until_count: 2,
      active_retain_until_count: 1,
      expired_retain_until_count: 1,
      protected_count: 2,
      prunable_count: 2,
      over_limit_count: 1,
    });
    expect(report.origins).toEqual(expect.arrayContaining([
      { origin: 'version_history_panel', count: 2 },
      { origin: 'local_history', count: 1 },
      { origin: 'tiptap_editor', count: 1 },
    ]));
    expect(report.schema_versions).toEqual([{ schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION, count: 4 }]);
    expect(report.oldest_snapshot_at).toEqual(expect.any(String));
    expect(report.newest_snapshot_at).toEqual(expect.any(String));

    const exported = await getDocumentsVersionSnapshotRetentionExport({
      documentId: 'doc-retention-report',
      maxSnapshots: 3,
    });

    expect(exported).toMatchObject({
      type: 'documents_version_retention_report',
      schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      document_id: 'doc-retention-report',
      retention: {
        max_snapshots: 3,
        policy: 'keep-latest',
      },
      retention_report: {
        total_count: 4,
        protected_count: 2,
        prunable_count: 2,
      },
    });
    expect(exported.generated_at).toEqual(expect.any(String));
    expect(exported.snapshots).toHaveLength(4);
    expect(exported.snapshots[0]).toMatchObject({
      document_id: 'doc-retention-report',
      version_number: 4,
      retention_policy: 'retain-until',
      origin: 'version_history_panel',
      content_hash: expect.any(String),
    });
    expect(exported.snapshots[0]).not.toHaveProperty('content');
    expect(exported.snapshots[0]).not.toHaveProperty('content_text');
    expect(exported.snapshots[0]).not.toHaveProperty('metadata');

    const trends = await getDocumentsVersionSnapshotRetentionTrends({
      documentId: 'doc-retention-report',
      days: 4,
      maxSnapshots: 3,
      now: new Date('2026-05-04T15:00:00.000Z'),
    });

    expect(trends).toMatchObject({
      type: 'documents_version_retention_trends',
      schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      document_id: 'doc-retention-report',
      window: {
        days: 4,
        bucket: 'day',
      },
      retention_report: {
        total_count: 4,
        protected_count: 2,
        prunable_count: 2,
      },
    });
    expect(trends.buckets).toHaveLength(4);
    expect(trends.buckets.map(bucket => bucket.date)).toEqual([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
      '2026-05-04',
    ]);
    expect(trends.buckets.map(bucket => bucket.created_count)).toEqual([1, 1, 1, 1]);
    expect(trends.buckets.map(bucket => bucket.cumulative_count)).toEqual([1, 2, 3, 4]);
    expect(trends.buckets[3]).toMatchObject({
      protected_count: 2,
      prunable_count: 2,
      over_limit_count: 1,
      top_origin: 'version_history_panel',
      top_origin_count: 1,
    });

    await saveDocumentsVersionSnapshot({
      documentId: 'doc-retention-dashboard-b',
      userId: 'user-2',
      snapshot: {
        title: 'Dashboard B',
        word_count: 1,
        retention_policy: 'keep-latest',
        origin: 'tiptap_editor',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        content_text: 'dashboard',
        metadata: { source: 'test' },
      },
    });
    await DocumentsVersionSnapshot.updateOne(
      { documentId: 'doc-retention-dashboard-b' },
      { $set: { savedAt: new Date('2026-05-04T14:00:00.000Z') } },
    );

    const dashboard = await getDocumentsVersionSnapshotRetentionDashboard({
      days: 4,
      maxDocuments: 10,
      maxSnapshots: 3,
      now: new Date('2026-05-04T15:00:00.000Z'),
    });

    expect(dashboard).toMatchObject({
      type: 'documents_version_retention_dashboard',
      schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      scope: 'admin',
      window: {
        days: 4,
        bucket: 'day',
      },
      retention_report: {
        total_count: 5,
        protected_count: 2,
        prunable_count: 3,
      },
      alerting: {
        max_alerts: 20,
        alert_count: 4,
        critical_count: 2,
        warning_count: 2,
      },
      export_schedule: {
        cadence: 'weekly',
        next_export_at: '2026-05-11T09:00:00.000Z',
        timezone: 'UTC',
        format: 'json',
        content_free: true,
        retention_window_days: 4,
        max_documents: 10,
      },
      policy_automation: {
        mode: 'dry-run',
        max_actions: 20,
        action_count: 4,
        destructive_action_count: 2,
        requires_admin_confirmation: true,
      },
      export_delivery: {
        status: 'scheduled',
        background_worker: 'documents-retention-export',
        next_attempt_at: '2026-05-11T09:00:00.000Z',
        last_delivery_at: null,
        next_retry_at: null,
        attempt_count: 0,
        failure_count: 0,
        retry_backoff_seconds: 0,
        channels: ['admin-dashboard-download', 'background-export-worker'],
        payload_type: 'documents_version_retention_dashboard',
        payload_content_free: true,
        pending_alert_count: 4,
        pending_policy_action_count: 4,
        destructive_action_count: 2,
        requires_worker: true,
        persisted: true,
        delivery_history_count: 1,
        retention_window_days: 4,
        max_documents: 10,
      },
      export_reliability: {
        job_count: 1,
        scheduled_count: 1,
        delivered_count: 0,
        failed_count: 0,
        retry_ready_count: 0,
        pending_retry_count: 0,
        attempt_count: 0,
        failure_count: 0,
        max_retry_backoff_seconds: 0,
        last_failure_at: null,
        last_delivery_at: null,
      },
      delivery_history: [
        {
          status: 'scheduled',
          background_worker: 'documents-retention-export',
          next_attempt_at: '2026-05-11T09:00:00.000Z',
          payload_type: 'documents_version_retention_dashboard',
          payload_content_free: true,
          pending_alert_count: 4,
          pending_policy_action_count: 4,
          persisted: true,
          delivery_history_count: 1,
        },
      ],
      documents_count: 2,
      returned_documents_count: 2,
    });
    expect(dashboard.buckets).toHaveLength(4);
    expect(dashboard.export_delivery.delivery_id).toMatch(/^documents-retention-[a-f0-9]{16}$/);
    expect(dashboard.export_delivery.idempotency_key).toMatch(/^[a-f0-9]{64}$/);
    expect(dashboard.delivery_history[0].delivery_id).toEqual(dashboard.export_delivery.delivery_id);
    expect(dashboard.delivery_history[0].idempotency_key).toEqual(dashboard.export_delivery.idempotency_key);
    expect(dashboard.delivery_history[0]).not.toHaveProperty('content');
    expect(dashboard.delivery_history[0]).not.toHaveProperty('content_text');
    expect(dashboard.delivery_history[0]).not.toHaveProperty('metadata');
    await getDocumentsVersionSnapshotRetentionDashboard({
      days: 4,
      maxDocuments: 10,
      maxSnapshots: 3,
      now: new Date('2026-05-04T15:05:00.000Z'),
    });
    expect(await DocumentsVersionRetentionExportJob.countDocuments({})).toBe(1);
    expect(dashboard.policy_automation.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'dashboard-review-expired-retain-until',
        type: 'review-expired-retain-until',
        severity: 'critical',
        safe_to_auto_apply: false,
        requires_admin_confirmation: true,
      }),
      expect.objectContaining({
        id: 'document-prune-over-cap-preview:doc-retention-report',
        type: 'prune-over-cap-preview',
        severity: 'warning',
        scope: 'document',
        document_id: 'doc-retention-report',
      }),
    ]));
    expect(dashboard.policy_automation.actions[0]).not.toHaveProperty('content');
    expect(dashboard.policy_automation.actions[0]).not.toHaveProperty('content_text');
    expect(dashboard.policy_automation.actions[0]).not.toHaveProperty('metadata');
    expect(dashboard.alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'dashboard-expired-retain-until',
        type: 'expired-retain-until',
        severity: 'critical',
        scope: 'dashboard',
        count: 1,
      }),
      expect.objectContaining({
        id: 'document-over-snapshot-cap:doc-retention-report',
        type: 'over-snapshot-cap',
        severity: 'warning',
        scope: 'document',
        document_id: 'doc-retention-report',
      }),
    ]));
    expect(dashboard.alerts[0]).not.toHaveProperty('content');
    expect(dashboard.alerts[0]).not.toHaveProperty('content_text');
    expect(dashboard.alerts[0]).not.toHaveProperty('metadata');
    expect(dashboard.document_summaries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        document_id: 'doc-retention-report',
        title: 'Retention report 4',
        snapshot_count: 4,
        over_limit_count: 1,
      }),
      expect.objectContaining({
        document_id: 'doc-retention-dashboard-b',
        title: 'Dashboard B',
        snapshot_count: 1,
      }),
    ]));
    expect(dashboard.document_summaries[0]).not.toHaveProperty('content');
    expect(dashboard.document_summaries[0]).not.toHaveProperty('content_text');
    expect(dashboard.document_summaries[0]).not.toHaveProperty('metadata');
  });

  it('dispatches due retention export jobs with content-free delivery manifests', async () => {
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

    const dispatch = await dispatchDocumentsVersionRetentionExportJobs({
      now: new Date('2026-05-04T15:02:00.000Z'),
    });

    expect(dispatch).toMatchObject({
      type: 'documents_version_retention_export_dispatch',
      schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      generated_at: '2026-05-04T15:02:00.000Z',
      worker: 'documents-retention-export',
      attempted_count: 1,
      dispatched_count: 1,
      failed_count: 0,
      payload_content_free: true,
    });
    expect(dispatch.manifests).toHaveLength(1);
    expect(dispatch.manifests[0]).toMatchObject({
      type: 'documents_version_retention_delivery_manifest',
      schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      delivered_at: '2026-05-04T15:02:00.000Z',
      delivery_id: dashboard.export_delivery.delivery_id,
      idempotency_key: dashboard.export_delivery.idempotency_key,
      payload_type: 'documents_version_retention_dashboard',
      payload_content_free: true,
      storage_adapter: 'database',
      storage_status: 'metadata-only',
      storage_content_free: true,
    });
    expect(dispatch.manifests[0].manifest_id).toMatch(/^documents-retention-manifest-[a-f0-9]{16}$/);
    expect(dispatch.manifests[0].payload_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(dispatch.manifests[0].storage_hash).toBe(dispatch.manifests[0].payload_hash);
    expect(dispatch.manifests[0].storage_ref).toEqual(
      `database:DocumentsVersionRetentionExportJob:${dispatch.manifests[0].delivery_id}`,
    );
    expect(dispatch.manifests[0]).not.toHaveProperty('content');
    expect(dispatch.manifests[0]).not.toHaveProperty('content_text');
    expect(dispatch.manifests[0]).not.toHaveProperty('metadata');
    expect(dispatch.deliveries[0]).toMatchObject({
      status: 'delivered',
      delivery_id: dashboard.export_delivery.delivery_id,
      last_delivery_at: '2026-05-04T15:02:00.000Z',
      next_attempt_at: null,
      next_retry_at: null,
      attempt_count: 1,
      failure_count: 0,
      retry_backoff_seconds: 0,
      requires_worker: false,
      last_delivery_status: 'delivered',
      delivery_history_count: 2,
    });
    expect(dispatch.deliveries[0].delivery_events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'delivered',
        manifest_id: dispatch.manifests[0].manifest_id,
        payload_hash: dispatch.manifests[0].payload_hash,
        storage_adapter: 'database',
        storage_status: 'metadata-only',
        storage_hash: dispatch.manifests[0].payload_hash,
        storage_content_free: true,
      }),
    ]));

    const verification = await getDocumentsVersionRetentionBackupVerification({
      now: new Date('2026-05-04T15:03:00.000Z'),
    });

    expect(verification).toMatchObject({
      type: 'documents_version_retention_backup_verification',
      status: 'verified',
      payload_content_free: true,
      backup_export_ready: true,
      backup_handoff_ready: true,
      backup_storage_ready: true,
      delivered_manifest_count: 1,
      required_restore_drill_count: 0,
      latest_manifest_id: dispatch.manifests[0].manifest_id,
      latest_payload_hash: dispatch.manifests[0].payload_hash,
      latest_storage_adapter: 'database',
      latest_storage_status: 'metadata-only',
      latest_storage_hash: dispatch.manifests[0].payload_hash,
      restore_download_ready: false,
      restore_download_status: 'metadata-only',
      scheduled_prune_status: 'manual-only',
      evidence_review_status: 'missing',
      evidence_fresh: false,
      evidence_review_required: true,
      evidence_review_severity: 'warning',
      evidence_next_review_at: '2026-05-04T15:03:00.000Z',
      evidence_review_due_at: '2026-05-04T15:03:00.000Z',
      evidence_reminder: {
        type: 'documents_version_retention_evidence_reminder',
        payload_content_free: true,
        status: 'missing',
        severity: 'warning',
        review_required: true,
        next_review_at: '2026-05-04T15:03:00.000Z',
        due_at: '2026-05-04T15:03:00.000Z',
      },
    });
    expect(verification).not.toHaveProperty('content');
    expect(verification).not.toHaveProperty('content_text');
    expect(verification).not.toHaveProperty('metadata');

    const metadataOnlyDownloadVerification = await verifyDocumentsVersionRetentionRestoreDownload({
      now: new Date('2026-05-04T15:03:30.000Z'),
    });

    expect(metadataOnlyDownloadVerification).toMatchObject({
      type: 'documents_version_retention_restore_download_verification',
      schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      generated_at: '2026-05-04T15:03:30.000Z',
      status: 'metadata-only',
      restore_download_ready: false,
      payload_content_free: true,
      delivery_id: dashboard.export_delivery.delivery_id,
      manifest_id: dispatch.manifests[0].manifest_id,
      payload_hash: dispatch.manifests[0].payload_hash,
      storage_adapter: 'database',
      storage_status: 'metadata-only',
      storage_hash_expected: dispatch.manifests[0].payload_hash,
      storage_hash_actual: dispatch.manifests[0].payload_hash,
      manifest_id_matched: true,
      payload_hash_matched: true,
      storage_hash_matched: true,
      content_free: true,
    });
    expect(metadataOnlyDownloadVerification).not.toHaveProperty('content');
    expect(metadataOnlyDownloadVerification).not.toHaveProperty('content_text');
    expect(metadataOnlyDownloadVerification).not.toHaveProperty('metadata');

    const evidenceRecord = await recordDocumentsVersionRetentionBackupVerificationEvidence({
      verification,
      requestedBy: 'admin-1',
      now: new Date('2026-05-04T15:04:00.000Z'),
    });

    expect(evidenceRecord).toMatchObject({
      created: true,
      evidence: {
        type: 'documents_version_retention_runbook_evidence',
        evidence_id: expect.stringMatching(/^documents-retention-evidence-[a-f0-9]{16}$/),
        evidence_type: 'backup-verification',
        status: 'verified',
        requested_by: 'admin-1',
        payload_content_free: true,
        storage_adapter: 'database',
        latest_manifest_id: dispatch.manifests[0].manifest_id,
        latest_payload_hash: dispatch.manifests[0].payload_hash,
        backup_storage_ready: true,
        latest_storage_adapter: 'database',
        latest_storage_status: 'metadata-only',
        latest_storage_hash: dispatch.manifests[0].payload_hash,
        backup_export_ready: true,
        backup_handoff_ready: true,
        delivered_manifest_count: 1,
        recorded_at: '2026-05-04T15:04:00.000Z',
        expires_at: '2026-10-31T15:04:00.000Z',
      },
    });
    expect(evidenceRecord.evidence).not.toHaveProperty('content');
    expect(evidenceRecord.evidence).not.toHaveProperty('content_text');
    expect(evidenceRecord.evidence).not.toHaveProperty('metadata');
    expect(await DocumentsVersionRetentionRunbookEvidence.countDocuments({})).toBe(1);

    const duplicateEvidenceRecord = await recordDocumentsVersionRetentionBackupVerificationEvidence({
      verification,
      requestedBy: 'admin-2',
      now: new Date('2026-05-04T15:05:00.000Z'),
    });
    expect(duplicateEvidenceRecord.created).toBe(false);
    expect(duplicateEvidenceRecord.evidence.evidence_id).toBe(evidenceRecord.evidence.evidence_id);
    expect(await DocumentsVersionRetentionRunbookEvidence.countDocuments({})).toBe(1);

    const verificationWithEvidence = await getDocumentsVersionRetentionBackupVerification({
      now: new Date('2026-05-04T15:06:00.000Z'),
    });
    expect(verificationWithEvidence).toMatchObject({
      status: 'verified',
      evidence_count: 1,
      latest_evidence_id: evidenceRecord.evidence.evidence_id,
      latest_evidence_at: '2026-05-04T15:04:00.000Z',
      latest_evidence_expires_at: '2026-10-31T15:04:00.000Z',
      evidence_storage_adapter: 'database',
      evidence_review_status: 'current',
      evidence_fresh: true,
      evidence_expired: false,
      evidence_expires_in_days: 180,
      evidence_review_required: false,
      evidence_review_severity: 'info',
      evidence_next_review_at: '2026-10-01T15:04:00.000Z',
      evidence_review_due_at: '2026-10-01T15:04:00.000Z',
      evidence_reminder: {
        type: 'documents_version_retention_evidence_reminder',
        payload_content_free: true,
        status: 'current',
        severity: 'info',
        review_required: false,
        latest_evidence_id: evidenceRecord.evidence.evidence_id,
        expires_at: '2026-10-31T15:04:00.000Z',
        days_until_expiry: 180,
        next_review_at: '2026-10-01T15:04:00.000Z',
        due_at: '2026-10-01T15:04:00.000Z',
      },
      evidence_history: [
        expect.objectContaining({
          evidence_id: evidenceRecord.evidence.evidence_id,
          payload_content_free: true,
        }),
      ],
    });
  });

  it('surfaces content-free evidence expiry reminders before destructive automation advances', async () => {
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

    await dispatchDocumentsVersionRetentionExportJobs({
      now: new Date('2026-05-04T15:02:00.000Z'),
    });

    const verification = await getDocumentsVersionRetentionBackupVerification({
      now: new Date('2026-05-04T15:03:00.000Z'),
    });
    const evidenceRecord = await recordDocumentsVersionRetentionBackupVerificationEvidence({
      verification,
      requestedBy: 'admin-1',
      now: new Date('2026-05-04T15:04:00.000Z'),
      evidenceRetentionDays: 10,
    });

    expect(evidenceRecord.evidence).toMatchObject({
      recorded_at: '2026-05-04T15:04:00.000Z',
      expires_at: '2026-05-14T15:04:00.000Z',
    });

    const expiringSoonVerification = await getDocumentsVersionRetentionBackupVerification({
      now: new Date('2026-05-05T15:04:00.000Z'),
    });

    expect(expiringSoonVerification).toMatchObject({
      evidence_review_status: 'expiring-soon',
      evidence_fresh: true,
      evidence_expired: false,
      evidence_expires_in_days: 9,
      evidence_review_required: true,
      evidence_review_severity: 'warning',
      evidence_next_review_at: '2026-05-05T15:04:00.000Z',
      evidence_review_due_at: '2026-05-14T15:04:00.000Z',
      evidence_reminder: {
        type: 'documents_version_retention_evidence_reminder',
        payload_content_free: true,
        status: 'expiring-soon',
        severity: 'warning',
        review_required: true,
        latest_evidence_id: evidenceRecord.evidence.evidence_id,
        expires_at: '2026-05-14T15:04:00.000Z',
        days_until_expiry: 9,
        next_review_at: '2026-05-05T15:04:00.000Z',
        due_at: '2026-05-14T15:04:00.000Z',
        channels: ['retention-dashboard', 'admin-runbook'],
      },
    });
    expect(expiringSoonVerification.evidence_reminder).not.toHaveProperty('content');
    expect(expiringSoonVerification.evidence_reminder).not.toHaveProperty('content_text');
    expect(expiringSoonVerification.evidence_reminder).not.toHaveProperty('metadata');

    const expiredVerification = await getDocumentsVersionRetentionBackupVerification({
      now: new Date('2026-05-15T15:04:00.000Z'),
    });

    expect(expiredVerification).toMatchObject({
      evidence_review_status: 'expired',
      evidence_fresh: false,
      evidence_expired: true,
      evidence_expires_in_days: -1,
      evidence_review_required: true,
      evidence_review_severity: 'critical',
      evidence_next_review_at: '2026-05-15T15:04:00.000Z',
      evidence_review_due_at: '2026-05-14T15:04:00.000Z',
      evidence_reminder: {
        status: 'expired',
        severity: 'critical',
        review_required: true,
        latest_evidence_id: evidenceRecord.evidence.evidence_id,
        expires_at: '2026-05-14T15:04:00.000Z',
        days_until_expiry: -1,
        next_review_at: '2026-05-15T15:04:00.000Z',
        due_at: '2026-05-14T15:04:00.000Z',
      },
    });
  });

  it('dispatches content-free evidence reminder notifications without document payloads', async () => {
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

    const dispatch = await dispatchDocumentsVersionRetentionExportJobs({
      now: new Date('2026-05-04T15:02:00.000Z'),
    });
    const verification = await getDocumentsVersionRetentionBackupVerification({
      now: new Date('2026-05-04T15:03:00.000Z'),
    });

    const internalNotification = await dispatchDocumentsVersionRetentionEvidenceReminderNotifications({
      verification,
      now: new Date('2026-05-04T15:04:00.000Z'),
    });

    expect(internalNotification).toMatchObject({
      type: 'documents_version_retention_evidence_reminder_notification_dispatch',
      schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
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
        latest_manifest_id: dispatch.manifests[0].manifest_id,
        latest_payload_hash: dispatch.manifests[0].payload_hash,
        delivered_at: '2026-05-04T15:04:00.000Z',
        attempt_count: 1,
        failure_count: 0,
      },
      reminder: {
        type: 'documents_version_retention_evidence_reminder',
        status: 'missing',
        review_required: true,
      },
    });
    expect(internalNotification.notification.payload_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(internalNotification.notification).not.toHaveProperty('content');
    expect(internalNotification.notification).not.toHaveProperty('content_text');
    expect(internalNotification.notification).not.toHaveProperty('metadata');
    expect(internalNotification.verification).toMatchObject({
      evidence_reminder_notification_count: 1,
      latest_evidence_reminder_notification: {
        notification_id: internalNotification.notification.notification_id,
        status: 'delivered',
        delivery_adapter: 'internal-ledger',
        payload_content_free: true,
      },
    });
    expect(await DocumentsVersionRetentionReminderNotification.countDocuments({})).toBe(1);

    const duplicateNotification = await dispatchDocumentsVersionRetentionEvidenceReminderNotifications({
      verification,
      now: new Date('2026-05-04T15:05:00.000Z'),
    });
    expect(duplicateNotification).toMatchObject({
      attempted_count: 0,
      delivered_count: 1,
      created: false,
    });
    expect(duplicateNotification.notification.notification_id).toBe(internalNotification.notification.notification_id);
    expect(await DocumentsVersionRetentionReminderNotification.countDocuments({})).toBe(1);

    const liveDuplicateNotification = await dispatchDocumentsVersionRetentionEvidenceReminderNotifications({
      now: new Date('2026-05-04T15:05:30.000Z'),
    });
    expect(liveDuplicateNotification).toMatchObject({
      attempted_count: 0,
      delivered_count: 1,
      created: false,
      verification: {
        evidence_reminder_notification_count: 1,
      },
    });
    expect(liveDuplicateNotification.notification.notification_id).toBe(internalNotification.notification.notification_id);
    expect(await DocumentsVersionRetentionReminderNotification.countDocuments({})).toBe(1);

    const notificationClient = jest.fn(async ({ payload }) => {
      const serializedPayload = JSON.stringify(payload);

      expect(payload).toMatchObject({
        type: 'documents_version_retention_evidence_reminder_notification',
        payload_content_free: true,
        reminder: {
          status: 'missing',
          review_required: true,
        },
        backup_verification: {
          latest_manifest_id: dispatch.manifests[0].manifest_id,
          latest_payload_hash: dispatch.manifests[0].payload_hash,
          evidence_review_status: 'missing',
        },
      });
      expect(serializedPayload).not.toContain('"content":');
      expect(serializedPayload).not.toContain('"content_text":');
      expect(serializedPayload).not.toContain('"metadata":');

      return { ok: true, status: 202, body: 'accepted' };
    });

    const webhookNotification = await dispatchDocumentsVersionRetentionEvidenceReminderNotifications({
      verification,
      now: new Date('2026-05-04T15:06:00.000Z'),
      environment: {
        DOCUMENTS_RETENTION_EVIDENCE_REMINDER_WEBHOOK_URL: 'https://retention.example.test/hooks/evidence',
      },
      notificationClient,
    });

    expect(notificationClient).toHaveBeenCalledTimes(1);
    expect(notificationClient.mock.calls[0][0]).toMatchObject({
      target: 'https://retention.example.test/hooks/evidence',
      payloadHash: webhookNotification.notification.payload_hash,
    });
    expect(webhookNotification).toMatchObject({
      attempted_count: 1,
      delivered_count: 1,
      failed_count: 0,
      created: true,
      notification: {
        status: 'delivered',
        delivery_adapter: 'webhook',
        delivery_target: 'https://retention.example.test/hooks/evidence',
        response_status: 202,
        response_body_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        delivered_at: '2026-05-04T15:06:00.000Z',
      },
    });
    expect(webhookNotification.verification).toMatchObject({
      evidence_reminder_notification_count: 2,
      latest_evidence_reminder_notification: {
        notification_id: webhookNotification.notification.notification_id,
        status: 'delivered',
        delivery_adapter: 'webhook',
        payload_content_free: true,
      },
    });
    expect(await DocumentsVersionRetentionReminderNotification.countDocuments({})).toBe(2);

    const failingNotificationClient = jest.fn(async ({ payload }) => {
      const serializedPayload = JSON.stringify(payload);

      expect(payload).toMatchObject({
        type: 'documents_version_retention_evidence_reminder_notification',
        payload_content_free: true,
      });
      expect(serializedPayload).not.toContain('"content":');
      expect(serializedPayload).not.toContain('"content_text":');
      expect(serializedPayload).not.toContain('"metadata":');

      return { ok: false, status: 503, body: 'down' };
    });
    const failedNotification = await dispatchDocumentsVersionRetentionEvidenceReminderNotifications({
      verification,
      now: new Date('2026-05-04T15:08:00.000Z'),
      environment: {
        DOCUMENTS_RETENTION_EVIDENCE_REMINDER_WEBHOOK_URL: 'https://retention.example.test/hooks/fail',
      },
      notificationClient: failingNotificationClient,
    });

    expect(failedNotification).toMatchObject({
      attempted_count: 1,
      delivered_count: 0,
      failed_count: 1,
      created: true,
      notification: {
        status: 'failed',
        delivery_adapter: 'webhook',
        delivery_target: 'https://retention.example.test/hooks/fail',
        response_status: 503,
        last_failure_at: '2026-05-04T15:08:00.000Z',
        retry_after_at: '2026-05-04T15:23:00.000Z',
        retry_backoff_seconds: 900,
      },
    });
    expect(await DocumentsVersionRetentionReminderNotification.countDocuments({})).toBe(3);

    const earlyRetry = await retryDocumentsVersionRetentionEvidenceReminderNotifications({
      now: new Date('2026-05-04T15:10:00.000Z'),
      notificationClient,
    });
    expect(earlyRetry).toMatchObject({
      attempted_count: 0,
      delivered_count: 0,
      failed_count: 0,
      retry_ready_count: 0,
      pending_retry_count: 1,
    });

    const retryNotificationClient = jest.fn(async ({ target, payload, payloadHash, notification }) => {
      const serializedPayload = JSON.stringify(payload);

      expect(target).toBe('https://retention.example.test/hooks/fail');
      expect(payloadHash).toBe(payload.payload_hash);
      expect(notification.notification_id).toBe(failedNotification.notification.notification_id);
      expect(payload).toMatchObject({
        type: 'documents_version_retention_evidence_reminder_notification_retry',
        payload_content_free: true,
        original_notification_id: failedNotification.notification.notification_id,
        original_payload_hash: failedNotification.notification.payload_hash,
        retry_attempt: 2,
      });
      expect(serializedPayload).not.toContain('"content":');
      expect(serializedPayload).not.toContain('"content_text":');
      expect(serializedPayload).not.toContain('"metadata":');

      return { ok: true, status: 204, body: '' };
    });
    const retryDispatch = await retryDocumentsVersionRetentionEvidenceReminderNotifications({
      now: new Date('2026-05-04T15:24:00.000Z'),
      notificationClient: retryNotificationClient,
    });

    expect(retryNotificationClient).toHaveBeenCalledTimes(1);
    expect(retryDispatch).toMatchObject({
      type: 'documents_version_retention_evidence_reminder_notification_retry_dispatch',
      payload_content_free: true,
      attempted_count: 1,
      delivered_count: 1,
      failed_count: 0,
      retry_ready_count: 0,
      pending_retry_count: 0,
      notifications: [
        expect.objectContaining({
          notification_id: failedNotification.notification.notification_id,
          status: 'delivered',
          delivery_adapter: 'webhook',
          delivered_at: '2026-05-04T15:24:00.000Z',
          attempt_count: 2,
          failure_count: 1,
          retry_after_at: null,
          retry_backoff_seconds: 0,
        }),
      ],
      verification: {
        evidence_reminder_notification_count: 3,
        evidence_reminder_notification_failed_count: 0,
        evidence_reminder_notification_retry_ready_count: 0,
      },
    });

    const verificationWithNotifications = await getDocumentsVersionRetentionBackupVerification({
      now: new Date('2026-05-04T15:25:00.000Z'),
    });

    expect(verificationWithNotifications).toMatchObject({
      evidence_reminder_notification_count: 3,
      evidence_reminder_notification_failed_count: 0,
      evidence_reminder_notification_retry_ready_count: 0,
      evidence_reminder_notification_pending_retry_count: 0,
      latest_evidence_reminder_notification: {
        notification_id: failedNotification.notification.notification_id,
        status: 'delivered',
        delivery_adapter: 'webhook',
        payload_content_free: true,
      },
      evidence_reminder_notification_history: [
        expect.objectContaining({
          notification_id: failedNotification.notification.notification_id,
          payload_content_free: true,
        }),
        expect.objectContaining({
          notification_id: webhookNotification.notification.notification_id,
          payload_content_free: true,
        }),
        expect.objectContaining({
          notification_id: internalNotification.notification.notification_id,
          payload_content_free: true,
        }),
      ],
    });
  });

  it('stores retention export manifests through a local-file content-free adapter', async () => {
    const dashboard = await getDocumentsVersionSnapshotRetentionDashboard({
      days: 4,
      maxDocuments: 10,
      maxSnapshots: 3,
      now: new Date('2026-05-04T15:00:00.000Z'),
    });
    const exportDir = await fs.mkdtemp(path.join(os.tmpdir(), 'documents-retention-exports-'));

    try {
      await DocumentsVersionRetentionExportJob.updateOne(
        { deliveryId: dashboard.export_delivery.delivery_id },
        { $set: { nextAttemptAt: new Date('2026-05-04T15:01:00.000Z') } },
      );

      const dispatch = await dispatchDocumentsVersionRetentionExportJobs({
        now: new Date('2026-05-04T15:02:00.000Z'),
        environment: {
          DOCUMENTS_RETENTION_EXPORT_STORAGE_ADAPTER: 'local-file',
          DOCUMENTS_RETENTION_EXPORT_STORAGE_DIR: exportDir,
        },
      });

      expect(dispatch).toMatchObject({
        attempted_count: 1,
        dispatched_count: 1,
        failed_count: 0,
      });
      expect(dispatch.manifests[0]).toMatchObject({
        type: 'documents_version_retention_delivery_manifest',
        delivery_id: dashboard.export_delivery.delivery_id,
        payload_content_free: true,
        storage_adapter: 'local-file',
        storage_status: 'stored',
        storage_content_free: true,
      });
      expect(dispatch.manifests[0].storage_path).toContain(exportDir);
      expect(dispatch.manifests[0].storage_hash).toMatch(/^[a-f0-9]{64}$/);

      const storedManifest = JSON.parse(await fs.readFile(dispatch.manifests[0].storage_path, 'utf8'));
      expect(storedManifest).toMatchObject({
        type: 'documents_version_retention_delivery_manifest',
        manifest_id: dispatch.manifests[0].manifest_id,
        payload_hash: dispatch.manifests[0].payload_hash,
        payload_content_free: true,
        storage_adapter: 'local-file',
        storage_content_free: true,
      });
      expect(storedManifest).not.toHaveProperty('content');
      expect(storedManifest).not.toHaveProperty('content_text');
      expect(storedManifest).not.toHaveProperty('metadata');

      const restoreDownloadVerification = await verifyDocumentsVersionRetentionRestoreDownload({
        now: new Date('2026-05-04T15:02:30.000Z'),
      });

      expect(restoreDownloadVerification).toMatchObject({
        type: 'documents_version_retention_restore_download_verification',
        schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
        generated_at: '2026-05-04T15:02:30.000Z',
        downloaded_at: '2026-05-04T15:02:30.000Z',
        status: 'verified',
        restore_download_ready: true,
        payload_content_free: true,
        delivery_id: dashboard.export_delivery.delivery_id,
        manifest_id: dispatch.manifests[0].manifest_id,
        payload_hash: dispatch.manifests[0].payload_hash,
        storage_adapter: 'local-file',
        storage_status: 'stored',
        storage_path: dispatch.manifests[0].storage_path,
        storage_hash_expected: dispatch.manifests[0].storage_hash,
        storage_hash_actual: dispatch.manifests[0].storage_hash,
        manifest_id_matched: true,
        payload_hash_matched: true,
        storage_hash_matched: true,
        content_free: true,
      });
      expect(restoreDownloadVerification).not.toHaveProperty('content');
      expect(restoreDownloadVerification).not.toHaveProperty('content_text');
      expect(restoreDownloadVerification).not.toHaveProperty('metadata');

      expect(dispatch.deliveries[0].delivery_events).toEqual(expect.arrayContaining([
        expect.objectContaining({
          status: 'delivered',
          manifest_id: dispatch.manifests[0].manifest_id,
          storage_adapter: 'local-file',
          storage_status: 'stored',
          storage_hash: dispatch.manifests[0].storage_hash,
          storage_content_free: true,
        }),
      ]));

      const verification = await getDocumentsVersionRetentionBackupVerification({
        now: new Date('2026-05-04T15:03:00.000Z'),
      });

      expect(verification).toMatchObject({
        status: 'verified',
        backup_export_ready: true,
        backup_storage_ready: true,
        latest_manifest_id: dispatch.manifests[0].manifest_id,
        latest_storage_adapter: 'local-file',
        latest_storage_status: 'stored',
        latest_storage_hash: dispatch.manifests[0].storage_hash,
        restore_download_ready: true,
        restore_download_status: 'ready',
      });
      expect(verification.latest_storage_ref).toContain(dispatch.manifests[0].storage_path);
    } finally {
      await fs.rm(exportDir, { recursive: true, force: true });
    }
  });

  it('stores retention export manifests through an S3-compatible content-free adapter', async () => {
    const dashboard = await getDocumentsVersionSnapshotRetentionDashboard({
      days: 4,
      maxDocuments: 10,
      maxSnapshots: 3,
      now: new Date('2026-05-04T15:00:00.000Z'),
    });
    const fakeSend = jest.fn(async () => ({ ETag: '"manifest-etag"' }));

    await DocumentsVersionRetentionExportJob.updateOne(
      { deliveryId: dashboard.export_delivery.delivery_id },
      { $set: { nextAttemptAt: new Date('2026-05-04T15:01:00.000Z') } },
    );

    const dispatch = await dispatchDocumentsVersionRetentionExportJobs({
      now: new Date('2026-05-04T15:02:00.000Z'),
      environment: {
        DOCUMENTS_RETENTION_EXPORT_STORAGE_ADAPTER: 's3',
        DOCUMENTS_RETENTION_EXPORT_S3_BUCKET: 'retention-bucket',
        DOCUMENTS_RETENTION_EXPORT_S3_PREFIX: 'exports/retention',
        DOCUMENTS_RETENTION_EXPORT_S3_REGION: 'us-east-1',
        DOCUMENTS_RETENTION_EXPORT_S3_ACCESS_KEY_ID: 'test-access-key',
        DOCUMENTS_RETENTION_EXPORT_S3_SECRET_ACCESS_KEY: 'test-secret-key',
      },
      storageClientFactory: () => ({ send: fakeSend }),
    });

    expect(dispatch).toMatchObject({
      attempted_count: 1,
      dispatched_count: 1,
      failed_count: 0,
    });
    expect(fakeSend).toHaveBeenCalledTimes(1);

    const commandInput = fakeSend.mock.calls[0][0].input;
    expect(commandInput).toMatchObject({
      Bucket: 'retention-bucket',
      ContentType: 'application/json',
      Metadata: expect.objectContaining({
        'payload-content-free': 'true',
        'manifest-id': dispatch.manifests[0].manifest_id,
        'payload-hash': dispatch.manifests[0].payload_hash,
      }),
    });
    expect(commandInput.Key).toMatch(
      /^exports\/retention\/documents-retention-manifest-[a-f0-9]{16}\.json$/,
    );

    const storedManifest = JSON.parse(commandInput.Body);
    expect(storedManifest).toMatchObject({
      type: 'documents_version_retention_delivery_manifest',
      manifest_id: dispatch.manifests[0].manifest_id,
      payload_hash: dispatch.manifests[0].payload_hash,
      payload_content_free: true,
      storage_adapter: 's3',
      storage_content_free: true,
    });
    expect(storedManifest).not.toHaveProperty('content');
    expect(storedManifest).not.toHaveProperty('content_text');
    expect(storedManifest).not.toHaveProperty('metadata');

    expect(dispatch.manifests[0]).toMatchObject({
      type: 'documents_version_retention_delivery_manifest',
      delivery_id: dashboard.export_delivery.delivery_id,
      payload_content_free: true,
      storage_adapter: 's3',
      storage_status: 'stored',
      storage_ref: `s3://retention-bucket/${commandInput.Key}`,
      storage_path: commandInput.Key,
      storage_content_free: true,
    });
    expect(dispatch.manifests[0].storage_hash).toMatch(/^[a-f0-9]{64}$/);

    expect(dispatch.deliveries[0].delivery_events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'delivered',
        manifest_id: dispatch.manifests[0].manifest_id,
        storage_adapter: 's3',
        storage_status: 'stored',
        storage_ref: `s3://retention-bucket/${commandInput.Key}`,
        storage_hash: dispatch.manifests[0].storage_hash,
        storage_content_free: true,
      }),
    ]));

    const verification = await getDocumentsVersionRetentionBackupVerification({
      now: new Date('2026-05-04T15:03:00.000Z'),
    });

    expect(verification).toMatchObject({
      status: 'verified',
      backup_export_ready: true,
      backup_storage_ready: true,
      latest_manifest_id: dispatch.manifests[0].manifest_id,
      latest_storage_adapter: 's3',
      latest_storage_status: 'stored',
      latest_storage_ref: `s3://retention-bucket/${commandInput.Key}`,
      latest_storage_hash: dispatch.manifests[0].storage_hash,
      restore_download_ready: true,
      restore_download_status: 'ready',
    });
  });

  it('records retryable retention export failures when S3 storage is misconfigured', async () => {
    const dashboard = await getDocumentsVersionSnapshotRetentionDashboard({
      days: 4,
      maxDocuments: 10,
      maxSnapshots: 3,
      now: new Date('2026-05-04T15:00:00.000Z'),
    });
    const fakeSend = jest.fn(async () => ({ ETag: '"manifest-etag"' }));

    await DocumentsVersionRetentionExportJob.updateOne(
      { deliveryId: dashboard.export_delivery.delivery_id },
      { $set: { nextAttemptAt: new Date('2026-05-04T15:01:00.000Z') } },
    );

    const dispatch = await dispatchDocumentsVersionRetentionExportJobs({
      now: new Date('2026-05-04T15:02:00.000Z'),
      environment: {
        DOCUMENTS_RETENTION_EXPORT_STORAGE_ADAPTER: 's3',
        DOCUMENTS_RETENTION_EXPORT_S3_REGION: 'us-east-1',
      },
      storageClientFactory: () => ({ send: fakeSend }),
    });

    expect(fakeSend).not.toHaveBeenCalled();
    expect(dispatch).toMatchObject({
      attempted_count: 1,
      dispatched_count: 0,
      failed_count: 1,
      manifests: [],
    });
    expect(dispatch.deliveries[0]).toMatchObject({
      status: 'failed',
      delivery_id: dashboard.export_delivery.delivery_id,
      next_attempt_at: '2026-05-04T15:17:00.000Z',
      last_failure_at: '2026-05-04T15:02:00.000Z',
      attempt_count: 1,
      failure_count: 1,
      retry_backoff_seconds: 900,
      requires_worker: true,
      last_delivery_status: 'failed',
    });
    expect(dispatch.deliveries[0].last_failure_message).toContain(
      'DOCUMENTS_RETENTION_EXPORT_S3_BUCKET or AWS_BUCKET_NAME is required',
    );
    expect(dispatch.deliveries[0].delivery_events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'failed',
        retry_after_at: '2026-05-04T15:17:00.000Z',
        retry_backoff_seconds: 900,
      }),
    ]));
  });

  it('records failed retention export dispatches with retry backoff metadata', async () => {
    const dashboard = await getDocumentsVersionSnapshotRetentionDashboard({
      days: 4,
      maxDocuments: 10,
      maxSnapshots: 3,
      now: new Date('2026-05-04T15:00:00.000Z'),
    });

    await DocumentsVersionRetentionExportJob.updateOne(
      { deliveryId: dashboard.export_delivery.delivery_id },
      {
        $set: {
          nextAttemptAt: new Date('2026-05-04T15:01:00.000Z'),
          payloadContentFree: false,
        },
      },
    );

    const dispatch = await dispatchDocumentsVersionRetentionExportJobs({
      now: new Date('2026-05-04T15:02:00.000Z'),
    });

    expect(dispatch).toMatchObject({
      type: 'documents_version_retention_export_dispatch',
      schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      generated_at: '2026-05-04T15:02:00.000Z',
      worker: 'documents-retention-export',
      attempted_count: 1,
      dispatched_count: 0,
      failed_count: 1,
      payload_content_free: true,
      manifests: [],
    });
    expect(dispatch.deliveries[0]).toMatchObject({
      status: 'failed',
      delivery_id: dashboard.export_delivery.delivery_id,
      next_attempt_at: '2026-05-04T15:17:00.000Z',
      next_retry_at: '2026-05-04T15:17:00.000Z',
      last_failure_at: '2026-05-04T15:02:00.000Z',
      last_failure_message: 'Blocked retention dashboard export because the payload was not marked content-free.',
      attempt_count: 1,
      failure_count: 1,
      retry_backoff_seconds: 900,
      requires_worker: true,
      last_delivery_status: 'failed',
      delivery_history_count: 2,
    });
    expect(dispatch.deliveries[0].delivery_events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'failed',
        retry_after_at: '2026-05-04T15:17:00.000Z',
        retry_backoff_seconds: 900,
      }),
    ]));

    const retryDashboard = await getDocumentsVersionSnapshotRetentionDashboard({
      days: 4,
      maxDocuments: 10,
      maxSnapshots: 3,
      now: new Date('2026-05-04T15:03:00.000Z'),
    });

    expect(retryDashboard.export_delivery).toMatchObject({
      status: 'failed',
      next_retry_at: '2026-05-04T15:17:00.000Z',
      last_failure_at: '2026-05-04T15:02:00.000Z',
      failure_count: 1,
      retry_backoff_seconds: 900,
      requires_worker: true,
    });
    expect(retryDashboard.export_reliability).toMatchObject({
      job_count: 1,
      scheduled_count: 0,
      delivered_count: 0,
      failed_count: 1,
      retry_ready_count: 0,
      pending_retry_count: 1,
      attempt_count: 1,
      failure_count: 1,
      max_retry_backoff_seconds: 900,
      last_failure_at: '2026-05-04T15:02:00.000Z',
      last_delivery_at: null,
    });
  });

  it('previews and executes confirmed retention pruning without returning document content', async () => {
    for (let index = 1; index <= 5; index += 1) {
      await saveDocumentsVersionSnapshot({
        documentId: 'doc-prune-a',
        userId: 'user-1',
        snapshot: {
          title: `Prune A ${index}`,
          word_count: index,
          retention_policy: index === 1 ? 'keep-forever' : 'keep-latest',
          origin: 'tiptap_editor',
          content: { type: 'doc', content: [{ type: 'paragraph' }] },
          content_text: `prune a ${index}`,
          metadata: { index },
          updated_at: `2026-05-04T10:0${index}:00.000Z`,
        },
      });
    }

    for (let index = 1; index <= 3; index += 1) {
      await saveDocumentsVersionSnapshot({
        documentId: 'doc-prune-b',
        userId: 'user-2',
        snapshot: {
          title: `Prune B ${index}`,
          word_count: index,
          retention_policy: 'keep-latest',
          origin: 'local_history',
          content: { type: 'doc', content: [{ type: 'paragraph' }] },
          content_text: `prune b ${index}`,
          metadata: { index },
          updated_at: `2026-05-04T11:0${index}:00.000Z`,
        },
      });
    }

    const preview = await previewDocumentsVersionSnapshotRetentionPrune({
      maxSnapshots: 2,
      limit: 10,
      now: new Date('2026-05-04T15:00:00.000Z'),
    });

    expect(preview).toMatchObject({
      type: 'documents_version_retention_prune_preview',
      schema_version: DOCUMENTS_VERSION_HISTORY_SCHEMA_VERSION,
      scope: 'admin',
      mode: 'dry-run',
      payload_content_free: true,
      confirmation_required: true,
      confirmation_token: 'PRUNE_DOCUMENT_VERSION_SNAPSHOTS',
      max_snapshots: 2,
      candidate_limit: 10,
      total_candidate_count: 3,
      candidate_count: 3,
      affected_documents_count: 2,
    });
    expect(preview.documents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        document_id: 'doc-prune-a',
        snapshot_count: 5,
        protected_count: 1,
        candidate_count: 2,
      }),
      expect.objectContaining({
        document_id: 'doc-prune-b',
        snapshot_count: 3,
        candidate_count: 1,
      }),
    ]));
    expect(preview.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        document_id: 'doc-prune-a',
        version_number: 2,
        retention_policy: 'keep-latest',
        content_hash: expect.any(String),
      }),
      expect.objectContaining({
        document_id: 'doc-prune-b',
        version_number: 1,
        origin: 'local_history',
      }),
    ]));
    expect(preview.candidates[0]).not.toHaveProperty('content');
    expect(preview.candidates[0]).not.toHaveProperty('content_text');
    expect(preview.candidates[0]).not.toHaveProperty('metadata');

    await expect(executeDocumentsVersionSnapshotRetentionPrune({
      confirmation: 'nope',
      maxSnapshots: 2,
      now: new Date('2026-05-04T15:00:00.000Z'),
    })).rejects.toThrow('Admin prune confirmation is required');

    const execution = await executeDocumentsVersionSnapshotRetentionPrune({
      confirmation: 'PRUNE_DOCUMENT_VERSION_SNAPSHOTS',
      maxSnapshots: 2,
      limit: 10,
      now: new Date('2026-05-04T15:05:00.000Z'),
      requestedBy: 'admin-1',
    });

    expect(execution).toMatchObject({
      type: 'documents_version_retention_prune_execution',
      mode: 'confirmed-delete',
      confirmed: true,
      requested_by: 'admin-1',
      audit_id: expect.stringMatching(/^documents-retention-prune-/),
      deleted_count: 3,
      remaining_candidate_count: 0,
      payload_content_free: true,
      restore_drill: {
        type: 'documents_version_retention_restore_drill',
        status: 'required',
        payload_content_free: true,
        deleted_count: 3,
      },
      audit: {
        type: 'documents_version_retention_prune_audit',
        mode: 'confirmed-delete',
        status: 'completed',
        requested_by: 'admin-1',
        payload_content_free: true,
        deleted_count: 3,
        remaining_candidate_count: 0,
      },
    });
    expect(execution.scheduled_prune_automation).toMatchObject({
      type: 'documents_version_retention_scheduled_prune_guardrails',
      payload_content_free: true,
      status: 'manual-only',
      scheduled_prune_allowed: false,
      required_restore_drill_count: 1,
    });
    expect(execution.audit.restore_drill.sample).toMatchObject({
      snapshot_id: expect.any(String),
      document_id: expect.any(String),
      content_hash: expect.any(String),
    });
    expect(execution.audit.restore_drill).not.toHaveProperty('content');
    expect(execution.audit.restore_drill).not.toHaveProperty('content_text');
    expect(execution.audit.restore_drill).not.toHaveProperty('metadata');
    const auditHistory = await getDocumentsVersionRetentionPruneAuditHistory({ limit: 5 });
    expect(auditHistory).toHaveLength(1);
    expect(auditHistory[0]).toMatchObject({
      audit_id: execution.audit_id,
      deleted_count: 3,
      payload_content_free: true,
      restore_drill: {
        status: 'required',
      },
    });
    expect(auditHistory[0].candidates[0]).not.toHaveProperty('content');
    expect(auditHistory[0].candidates[0]).not.toHaveProperty('content_text');
    expect(auditHistory[0].candidates[0]).not.toHaveProperty('metadata');
    expect(await getDocumentsVersionRetentionScheduledPruneGuardrails({
      auditHistory,
      environment: { DOCUMENTS_RETENTION_SCHEDULED_PRUNE_ENABLED: 'true' },
    })).toMatchObject({
      status: 'blocked',
      scheduled_prune_allowed: false,
      required_restore_drill_count: 1,
    });
    expect(await getDocumentsVersionRetentionBackupVerification({
      auditHistory,
      now: new Date('2026-05-04T15:06:00.000Z'),
    })).toMatchObject({
      status: 'export-required',
      backup_export_ready: false,
      backup_handoff_ready: false,
      required_restore_drill_count: 1,
    });

    await expect(executeDocumentsVersionRetentionRestoreDrill({
      auditId: execution.audit_id,
      confirmation: 'nope',
      backupHandoffConfirmed: true,
      requestedBy: 'admin-1',
      now: new Date('2026-05-04T15:10:00.000Z'),
    })).rejects.toMatchObject({
      code: 'restore_drill_confirmation_required',
      confirmation_token: DOCUMENTS_VERSION_RETENTION_RESTORE_DRILL_CONFIRMATION,
    });

    const drillExecution = await executeDocumentsVersionRetentionRestoreDrill({
      auditId: execution.audit_id,
      confirmation: DOCUMENTS_VERSION_RETENTION_RESTORE_DRILL_CONFIRMATION,
      backupHandoffConfirmed: true,
      requestedBy: 'admin-1',
      now: new Date('2026-05-04T15:15:00.000Z'),
    });

    expect(drillExecution).toMatchObject({
      type: 'documents_version_retention_restore_drill_execution',
      audit_id: execution.audit_id,
      status: 'completed',
      requested_by: 'admin-1',
      payload_content_free: true,
      backup_handoff_confirmed: true,
      restore_drill: {
        status: 'completed',
        payload_content_free: true,
        backup_handoff: {
          status: 'confirmed',
          payload_content_free: true,
          source: 'external-backup-or-export',
        },
        primary_history_check: {
          status: 'passed',
          payload_content_free: true,
          sample_snapshot_present: false,
        },
        automation_clearance: {
          scheduled_prune_allowed: true,
        },
      },
      audit: {
        audit_id: execution.audit_id,
        restore_drill: {
          status: 'completed',
        },
      },
    });
    expect(drillExecution.restore_drill).not.toHaveProperty('content');
    expect(drillExecution.restore_drill).not.toHaveProperty('content_text');
    expect(drillExecution.restore_drill).not.toHaveProperty('metadata');
    const completedAuditHistory = await getDocumentsVersionRetentionPruneAuditHistory({ limit: 5 });
    expect(completedAuditHistory[0].restore_drill).toMatchObject({
      status: 'completed',
      backup_handoff: {
        status: 'confirmed',
      },
    });
    expect(await getDocumentsVersionRetentionScheduledPruneGuardrails({
      auditHistory: completedAuditHistory,
      environment: { DOCUMENTS_RETENTION_SCHEDULED_PRUNE_ENABLED: 'true' },
    })).toMatchObject({
      status: 'ready',
      scheduled_prune_allowed: true,
      required_restore_drill_count: 0,
      latest_audit_id: execution.audit_id,
      latest_restore_drill_status: 'completed',
    });
    expect(await DocumentsVersionSnapshot.countDocuments({})).toBe(5);
    expect(await DocumentsVersionSnapshot.exists({
      documentId: 'doc-prune-a',
      versionNumber: 1,
      retentionPolicy: 'keep-forever',
    })).toBeTruthy();
    expect(execution.candidates[0]).not.toHaveProperty('content');
    expect(execution.candidates[0]).not.toHaveProperty('content_text');
    expect(execution.candidates[0]).not.toHaveProperty('metadata');
  });
});

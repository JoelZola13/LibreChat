const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { logger } = require('@librechat/data-schemas');
const paths = require('~/config/paths');
const { requireJwtAuth } = require('~/server/middleware');
const {
  getCaseManagementWorkspace,
  getCaseManagementWorkspacesWithActiveLocalArchiveAutomation,
  saveCaseManagementWorkspace,
  deleteCaseManagementWorkspace,
} = require('~/models/CaseManagementWorkspace');
const {
  createCaseManagementProvenanceLensExportAudit,
  deleteCaseManagementProvenanceLens,
  getCaseManagementProvenanceLens,
  getCaseManagementProvenanceLensExportAudits,
  getCaseManagementProvenanceLenses,
  saveCaseManagementProvenanceLens,
} = require('~/models/CaseManagementProvenanceLens');
const {
  getCaseManagementWikiIngestions,
  saveCaseManagementWikiIngestion,
  updateCaseManagementWikiIngestionReview,
} = require('~/models/CaseManagementWikiIngestion');
const {
  createCaseManagementWikiIngestJob,
  getCaseManagementWikiIngestJob,
  getCaseManagementWikiIngestJobsForUser,
  getPendingCaseManagementWikiIngestJobs,
  updateCaseManagementWikiIngestJob,
} = require('~/models/CaseManagementWikiIngestJob');
const {
  buildCaseWikiLocalArchiveCatalogRecord,
  buildCaseWikiLocalArchiveExtractionRecord,
  buildCaseWikiUpload,
  normalizeWikiIngestContext,
  writeCaseWikiGraphToNeo4j,
} = require('~/server/services/CaseManagementWikiIngestion');
const {
  deleteCaseWikiWeaviateObjects,
  prepareCaseWikiWeaviateDryRun,
  queryCaseWikiWeaviateHybridSearch,
  writeCaseWikiApprovedChunksToWeaviate,
} = require('~/server/services/CaseManagementWeaviate');
const {
  localArchiveConfig,
  scanLocalArchive,
  resolveLocalArchiveFile,
} = require('~/server/services/CaseManagementLocalArchive');
const {
  buildCaseWikiEmbeddingReviewGraph,
  buildCaseWikiFollowUpTaskReconciliationReviewGraph,
  buildCaseWikiGraphBrowser,
  buildCaseWikiLocalArchiveSourceFamilyDecisionGraph,
  buildCaseWikiGraphProvenanceLensGraph,
  buildCaseWikiGraphWorkspaceReviewGraph,
  buildCaseWikiGraphWorkspaceGraph,
  queryCaseWikiGraphWorkspaces,
  searchCaseWikiGraph,
} = require('~/server/services/CaseManagementWikiGraph');

const router = express.Router();
const WIKI_INGEST_FILE_LIMIT = 64;
const WIKI_LOCAL_ARCHIVE_CATALOG_LIMIT = 300;
const WIKI_LOCAL_ARCHIVE_EXTRACT_LIMIT = 12;
const CASE_WIKI_VECTOR_PROVIDER = 'weaviate';
const CASE_WIKI_LOCAL_ARCHIVE_DAEMON_ENABLED =
  process.env.CASE_WIKI_LOCAL_ARCHIVE_DAEMON_ENABLED === 'true';
const CASE_WIKI_LOCAL_ARCHIVE_DAEMON_EXECUTE =
  process.env.CASE_WIKI_LOCAL_ARCHIVE_DAEMON_EXECUTE === 'true';
const CASE_WIKI_LOCAL_ARCHIVE_DAEMON_INTERVAL_MS = Math.max(
  60 * 1000,
  Number(process.env.CASE_WIKI_LOCAL_ARCHIVE_DAEMON_INTERVAL_MS) || 15 * 60 * 1000,
);
const CASE_WIKI_LOCAL_ARCHIVE_DAEMON_BATCH_LIMIT = Math.min(
  100,
  Math.max(1, Number(process.env.CASE_WIKI_LOCAL_ARCHIVE_DAEMON_BATCH_LIMIT) || 25),
);
const terminalJobStatuses = new Set(['completed', 'completed_with_errors', 'failed']);
const activeWikiIngestJobIds = new Set();
let pendingJobsResumeScheduled = false;
let localArchiveCampaignDaemonScheduled = false;
let localArchiveCampaignDaemonRunning = false;

router.use(requireJwtAuth);

const caseWikiUploadStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const outputPath = path.join(paths.uploads, 'case-management', req.user.id);
    fs.mkdirSync(outputPath, { recursive: true });
    cb(null, outputPath);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').slice(0, 32);
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension}`);
  },
});

const caseWikiUpload = multer({
  storage: caseWikiUploadStorage,
  limits: {
    files: WIKI_INGEST_FILE_LIMIT,
    fileSize: 200 * 1024 * 1024,
  },
});

const readStringField = (body, key) => (typeof body?.[key] === 'string' ? body[key].trim() : '');

const slugifyTextForId = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const readUniqueStringArray = (body, key, limit = 100) => {
  if (!Array.isArray(body?.[key])) return [];
  return Array.from(
    new Set(
      body[key]
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  ).slice(0, limit);
};

const compactStringArray = (values = [], limit = 500) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  ).slice(0, limit);

const archiveReviewStatuses = new Set([
  'needs-human-review',
  'reviewed-standalone',
  'reviewed-for-attachment',
  'attached-to-record',
  'attached-to-current-record',
]);
const relationshipReviewStatuses = new Set(['approved', 'rejected']);
const archiveAttachmentTargetTypes = new Set(['client', 'case', 'service', 'project']);
const archiveBatchReviewActions = new Set([
  'keep-standalone',
  'mark-reviewed',
  'review-for-attachment',
  'reopen-review',
  'exclude-from-embedding',
  'mark-cleanup-review',
  'mark-duplicate',
]);
const localArchiveSourceFamilyDecisionActions = new Set([
  'merge-into-canonical',
  'keep-separate',
  'reject-duplicate',
]);
const normalizeLifeDomainMoveTarget = (target = {}) => {
  if (!target || typeof target !== 'object') return null;
  const lifeDomain = typeof target.lifeDomain === 'string' ? target.lifeDomain.trim() : '';
  const lifeDomainId = typeof target.lifeDomainId === 'string' ? target.lifeDomainId.trim() : '';
  const proposalId = typeof target.proposalId === 'string' ? target.proposalId.trim() : '';
  const reason = typeof target.reason === 'string' ? target.reason.trim() : '';
  if (!lifeDomain || !lifeDomainId) return null;
  return {
    lifeDomain,
    lifeDomainId,
    proposalId,
    reason,
  };
};
const caseWikiFollowUpTaskDependencyPrefix = 'case-wiki-inspection-follow-up:';
const taskPriorities = new Set(['low', 'medium', 'high', 'urgent']);
const taskStatuses = new Set(['open', 'in progress', 'blocked', 'complete']);
const followUpReconciliationStatuses = new Set([
  'active-task',
  'missing-task',
  'stale-task',
  'resolved-task',
  'completed-but-live',
]);
const followUpReconciliationDecisions = new Set([
  'created-missing-task',
  'completed-stale-task',
  'completed-live-recurring-task',
]);

const asString = (value, fallback = '') => (typeof value === 'string' ? value.trim() : fallback);

const normalizeCaseWikiFollowUpTask = (task = {}) => {
  if (!task || typeof task !== 'object' || Array.isArray(task)) return null;
  const id = asString(task.id);
  const title = asString(task.title);
  const dependency = asString(task.dependency);
  if (!id || !title || !dependency.startsWith(caseWikiFollowUpTaskDependencyPrefix)) return null;
  return {
    id,
    title,
    clientId: asString(task.clientId),
    caseId: asString(task.caseId),
    owner: asString(task.owner, 'Current worker'),
    dueDate: asString(task.dueDate, new Date().toISOString()),
    priority: taskPriorities.has(task.priority) ? task.priority : 'medium',
    status: taskStatuses.has(task.status) ? task.status : 'open',
    reminderRules: asString(task.reminderRules, 'Morning of due date'),
    dependency,
    completedAt: asString(task.completedAt),
    notes: asString(task.notes),
  };
};

const normalizeCaseWikiTimelineRecord = (record = {}) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const id = asString(record.id);
  const title = asString(record.title);
  if (!id || !title) return null;
  return {
    id,
    clientId: asString(record.clientId),
    caseId: asString(record.caseId),
    occurredAt: asString(record.occurredAt, new Date().toISOString()),
    type: asString(record.type, 'task created'),
    title,
    detail: asString(record.detail),
  };
};

const normalizeCaseWikiAuditRecord = (record = {}) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const id = asString(record.id);
  const action = asString(record.action);
  if (!id || !action) return null;
  const normalized = {
    id,
    actor: asString(record.actor, 'Case Wiki manager'),
    action,
    object: asString(record.object),
    timestamp: asString(record.timestamp, new Date().toISOString()),
  };
  [
    'category',
    'kind',
    'status',
    'decision',
    'detail',
    'taskId',
    'followUpId',
    'lensId',
    'repairType',
    'reviewPattern',
  ].forEach((key) => {
    const value = asString(record[key]);
    if (value) normalized[key] = value;
  });
  return normalized;
};

const mergeWorkspaceRecordsById = (existing = [], incoming = []) => {
  const merged = new Map();
  (Array.isArray(existing) ? existing : []).forEach((record) => {
    if (record?.id) merged.set(record.id, record);
  });
  (Array.isArray(incoming) ? incoming : []).forEach((record) => {
    if (record?.id) merged.set(record.id, record);
  });
  return Array.from(merged.values());
};

const mergePromotionRecordsByPageId = (existing = [], incoming = []) => {
  const merged = new Map();
  [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])].forEach((record) => {
    if (!record?.id) return;
    merged.set(record.pageId || record.id, record);
  });
  return Array.from(merged.values());
};

const isCaseWikiFollowUpReconciliationAuditRecord = (record = {}) =>
  Boolean(
    record &&
      typeof record === 'object' &&
      !Array.isArray(record) &&
      (record.category === 'case-wiki-follow-up-reconciliation' ||
        (typeof record.action === 'string' &&
          record.action.startsWith('case wiki follow-up reconciliation:'))),
  );

const makeCaseWikiFollowUpReconciliationHistory = (
  workspace = {},
  { actor = 'all', status = 'all', decision = 'all', limit = 50 } = {},
) => {
  const actorFilter = actor && actor !== 'all' ? String(actor).trim().toLowerCase() : '';
  const statusFilter = followUpReconciliationStatuses.has(status) ? status : 'all';
  const decisionFilter = followUpReconciliationDecisions.has(decision) ? decision : 'all';
  const maxResults = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const records = (Array.isArray(workspace.auditRecords) ? workspace.auditRecords : [])
    .filter(isCaseWikiFollowUpReconciliationAuditRecord)
    .filter((record) => {
      if (actorFilter && String(record.actor || '').trim().toLowerCase() !== actorFilter) return false;
      if (statusFilter !== 'all' && record.status !== statusFilter) return false;
      if (decisionFilter !== 'all' && record.decision !== decisionFilter) return false;
      return true;
    })
    .sort((left, right) => new Date(right.timestamp || 0).getTime() - new Date(left.timestamp || 0).getTime())
    .slice(0, maxResults);
  const statsSource = (Array.isArray(workspace.auditRecords) ? workspace.auditRecords : []).filter(
    isCaseWikiFollowUpReconciliationAuditRecord,
  );
  return {
    filters: {
      actor: actorFilter ? actor : 'all',
      status: statusFilter,
      decision: decisionFilter,
      limit: maxResults,
    },
    historyCount: records.length,
    totalCount: statsSource.length,
    stats: {
      missing: statsSource.filter((record) => record.status === 'missing-task').length,
      stale: statsSource.filter((record) => record.status === 'stale-task').length,
      recurring: statsSource.filter((record) => record.status === 'completed-but-live').length,
      createdMissing: statsSource.filter((record) => record.decision === 'created-missing-task').length,
      completedStale: statsSource.filter((record) => record.decision === 'completed-stale-task').length,
    },
    records,
  };
};

const defaultCaseManagementWorkspaceForPatch = () => ({
  version: 1,
  savedAt: new Date().toISOString(),
  caseRecords: [],
  taskRecords: [],
  noteRecords: [],
  timelineRecords: [],
  auditRecords: [],
});

const getPatchableCaseManagementWorkspace = async (userId) => {
  const record = await getCaseManagementWorkspace(userId);
  const workspace = record?.workspace && typeof record.workspace === 'object' && !Array.isArray(record.workspace)
    ? record.workspace
    : defaultCaseManagementWorkspaceForPatch();
  return {
    record,
    workspace: {
      ...defaultCaseManagementWorkspaceForPatch(),
      ...workspace,
    },
  };
};

const normalizeCanonicalSourceTarget = (target = {}) => {
  if (!target || typeof target !== 'object') return null;
  const sourceId = typeof target.sourceId === 'string' ? target.sourceId.trim() : '';
  const sourceLabel = typeof target.sourceLabel === 'string' ? target.sourceLabel.trim() : '';
  const sourcePageId = typeof target.sourcePageId === 'string' ? target.sourcePageId.trim() : '';
  const sourceHash = typeof target.sourceHash === 'string' ? target.sourceHash.trim() : '';
  if (!sourceId || !sourceLabel) return null;
  return {
    sourceId,
    sourceLabel,
    sourcePageId,
    sourceHash,
  };
};

const normalizeLocalArchiveSourceFamilyDecision = ({
  decision = {},
  candidate = {},
  candidateId = '',
  action = '',
  now = new Date().toISOString(),
} = {}) => {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) return null;
  const normalizedCandidateId = asString(decision.candidateId) || asString(candidateId) || asString(candidate.id);
  const normalizedAction = asString(decision.action) || asString(action);
  if (!normalizedCandidateId || !localArchiveSourceFamilyDecisionActions.has(normalizedAction)) return null;

  const sourceHistory =
    candidate?.sourceHistory && typeof candidate.sourceHistory === 'object' && !Array.isArray(candidate.sourceHistory)
      ? candidate.sourceHistory
      : {};
  const canonicalSource =
    normalizeCanonicalSourceTarget(decision.canonicalSource) ||
    normalizeCanonicalSourceTarget(sourceHistory.canonicalSource) ||
    normalizeCanonicalSourceTarget(sourceHistory.canonicalLineage?.canonicalSource) ||
    normalizeCanonicalSourceTarget(sourceHistory.matchedSource);
  const label =
    asString(decision.label) ||
    asString(candidate.suggestedWikiTitle) ||
    asString(candidate.fileName) ||
    normalizedCandidateId;
  return {
    candidateId: normalizedCandidateId,
    action: normalizedAction,
    label,
    decidedAt: asString(decision.decidedAt, now),
    ...(canonicalSource ? { canonicalSource } : {}),
    ...(asString(decision.canonicalLineageId) || asString(sourceHistory.canonicalLineage?.groupId)
      ? {
          canonicalLineageId:
            asString(decision.canonicalLineageId) || asString(sourceHistory.canonicalLineage?.groupId),
        }
      : {}),
    ...(asString(decision.note) ? { note: asString(decision.note).slice(0, 1000) } : {}),
  };
};

const buildLocalArchiveSourceFamilyLedgerRecord = ({
  decision = null,
  candidateId = '',
  action = '',
  label = '',
  userId = '',
  now = new Date().toISOString(),
} = {}) => {
  const resolvedCandidateId = asString(decision?.candidateId) || asString(candidateId);
  const resolvedAction = asString(decision?.action) || asString(action);
  const resolvedLabel = asString(decision?.label) || asString(label) || resolvedCandidateId;
  if (!resolvedCandidateId || !resolvedAction) return null;
  return {
    id: `source-family-review-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    candidateId: resolvedCandidateId,
    action: resolvedAction,
    label: resolvedLabel,
    canonicalSource: decision?.canonicalSource || null,
    canonicalLineageId: asString(decision?.canonicalLineageId),
    note: asString(decision?.note),
    decidedAt: asString(decision?.decidedAt, now),
    savedAt: now,
    savedBy: userId,
    sourceScope: 'standalone',
    reviewKind: 'local-archive-source-family',
    graphNodeId: `local-archive-source-family-decision:${resolvedCandidateId}`,
    graphWrite: false,
    vectorWrite: false,
    articleWrite: false,
    attachmentWrite: false,
    fileAction: false,
    policy:
      'This review only records source-family intent. It does not delete files, attach documents, write vectors, or promote source text.',
  };
};

const collectLocalArchiveSourceFamilyGraphReviewRecords = ({
  workspace = {},
  userId = '',
  now = new Date().toISOString(),
  includeSynced = false,
  limit = 25,
} = {}) => {
  const savedDecisions =
    workspace.localArchiveSourceFamilyDecisions &&
    typeof workspace.localArchiveSourceFamilyDecisions === 'object' &&
    !Array.isArray(workspace.localArchiveSourceFamilyDecisions)
      ? workspace.localArchiveSourceFamilyDecisions
      : {};
  const ledger = Array.isArray(workspace.localArchiveSourceFamilyReviewLedger)
    ? workspace.localArchiveSourceFamilyReviewLedger
    : [];
  const recordsByCandidateId = new Map();

  ledger.forEach((record) => {
    const candidateId = asString(record?.candidateId);
    const action = asString(record?.action);
    if (
      !candidateId ||
      recordsByCandidateId.has(candidateId) ||
      !localArchiveSourceFamilyDecisionActions.has(action)
    ) {
      return;
    }
    recordsByCandidateId.set(candidateId, record);
  });

  Object.entries(savedDecisions).forEach(([candidateId, decision]) => {
    const resolvedCandidateId = asString(decision?.candidateId) || candidateId;
    const action = asString(decision?.action);
    if (
      !resolvedCandidateId ||
      recordsByCandidateId.has(resolvedCandidateId) ||
      !localArchiveSourceFamilyDecisionActions.has(action)
    ) {
      return;
    }
    const ledgerRecord = buildLocalArchiveSourceFamilyLedgerRecord({
      decision,
      candidateId: resolvedCandidateId,
      action,
      label: decision?.label,
      userId,
      now,
    });
    if (ledgerRecord) {
      recordsByCandidateId.set(resolvedCandidateId, ledgerRecord);
    }
  });

  const records = Array.from(recordsByCandidateId.values())
    .filter((record) => includeSynced || record.graphWrite !== true)
    .slice(0, limit);

  return {
    savedDecisions,
    ledger,
    records,
    pendingCount: records.length,
    totalReviewCount: recordsByCandidateId.size,
  };
};

const canonicalLineageAliasKey = (value = '') =>
  asString(value)
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(copy|duplicate|final|draft|version|v\d+)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

const canonicalLineageAliasCandidatesForIngestion = (ingestion = {}, source = {}) => {
  const archive = archiveForWikiIngestion(ingestion);
  return [
    source.sourceLabel,
    archive.suggestedWikiTitle,
    ingestion.generatedRecords?.frontendRecord?.title,
    ingestion.generatedRecords?.frontendRecord?.fileName,
    ingestion.wikiPage?.title,
    ingestion.originalName,
    ingestion.fileName,
  ].filter((value) => asString(value));
};

const sourceSummaryForCanonicalLineage = (ingestion = {}, role = 'member', preferredSource = null) => {
  const archive = archiveForWikiIngestion(ingestion);
  const sourceHash = asString(
    preferredSource?.sourceHash || ingestion.sha256 || ingestion.generatedRecords?.frontendRecord?.sourceHash,
  );
  const sourceId = asString(preferredSource?.sourceId || ingestion.fileId || ingestion.id);
  const sourceLabel = asString(
    preferredSource?.sourceLabel ||
      archive.suggestedWikiTitle ||
      ingestion.generatedRecords?.frontendRecord?.title ||
      ingestion.originalName ||
      ingestion.fileName ||
      sourceId ||
      'Case Wiki source',
  );
  const sourcePageId = asString(
    preferredSource?.sourcePageId ||
      ingestion.generatedRecords?.frontendRecord?.pageId ||
      ingestion.wikiPage?.id ||
      (sourceId ? `ingest:${sourceId}` : ''),
  );
  return {
    sourceId,
    sourceLabel,
    sourcePageId,
    sourceHash,
    role,
    reviewStatus: asString(archive.reviewStatus),
    cleanupStatus: asString(archive.cleanupDecision?.status),
    duplicateGroupKey: asString(archive.duplicateGroupKey),
    aliases: canonicalLineageAliasCandidatesForIngestion(ingestion, {
      sourceId,
      sourceLabel,
      sourcePageId,
      sourceHash,
    }).slice(0, 8),
  };
};

const buildCanonicalLineageRecord = ({
  canonicalIngestion = {},
  canonicalSource = null,
  duplicateIngestions = [],
  existingLineage = null,
}) => {
  const now = new Date().toISOString();
  const canonicalMember = sourceSummaryForCanonicalLineage(canonicalIngestion, 'canonical', canonicalSource);
  const membersById = new Map();
  const addMember = (member) => {
    if (!member?.sourceId || membersById.has(member.sourceId)) return;
    membersById.set(member.sourceId, member);
  };
  addMember(canonicalMember);
  duplicateIngestions.forEach((ingestion) => addMember(sourceSummaryForCanonicalLineage(ingestion, 'superseded')));

  const existingMembers = Array.isArray(existingLineage?.members) ? existingLineage.members : [];
  existingMembers.forEach((member) => {
    const sourceId = asString(member?.sourceId);
    if (!sourceId || membersById.has(sourceId)) return;
    membersById.set(sourceId, {
      sourceId,
      sourceLabel: asString(member.sourceLabel, sourceId),
      sourcePageId: asString(member.sourcePageId),
      sourceHash: asString(member.sourceHash),
      role: asString(member.role, 'remembered'),
      reviewStatus: asString(member.reviewStatus),
      cleanupStatus: asString(member.cleanupStatus),
      duplicateGroupKey: asString(member.duplicateGroupKey),
      aliases: Array.isArray(member.aliases) ? member.aliases.map((alias) => asString(alias)).filter(Boolean).slice(0, 8) : [],
    });
  });

  const members = Array.from(membersById.values());
  const aliasByKey = new Map();
  const addAlias = (label, sourceId = '') => {
    const cleanLabel = asString(label);
    const key = canonicalLineageAliasKey(cleanLabel);
    const identity = `${key}::${cleanLabel.toLowerCase()}`;
    if (!cleanLabel || !key || aliasByKey.has(identity)) return;
    aliasByKey.set(identity, { label: cleanLabel, key, sourceId });
  };
  members.forEach((member) => {
    addAlias(member.sourceLabel, member.sourceId);
    member.aliases.forEach((alias) => addAlias(alias, member.sourceId));
  });
  const sourceIds = members.map((member) => member.sourceId).filter(Boolean);
  const sourceHashes = Array.from(new Set(members.map((member) => member.sourceHash).filter(Boolean))).slice(0, 40);
  const sourcePageIds = Array.from(new Set(members.map((member) => member.sourcePageId).filter(Boolean))).slice(0, 40);
  const duplicateGroupKeys = Array.from(new Set(members.map((member) => member.duplicateGroupKey).filter(Boolean))).slice(0, 10);
  const sourceLabels = members.map((member) => member.sourceLabel).filter(Boolean);
  const sameHashCount = canonicalMember.sourceHash
    ? members.filter((member) => member.sourceHash === canonicalMember.sourceHash).length
    : 0;
  const matchEvidence = [
    sameHashCount > 1
      ? {
          type: 'exact-content-hash',
          label: 'Exact content hash',
          detail: `${sameHashCount} source copies share the canonical hash.`,
        }
      : null,
    duplicateGroupKeys.length
      ? {
          type: 'scanner-duplicate-group',
          label: 'Scanner duplicate group',
          detail: `${duplicateGroupKeys.length} remembered scanner group${duplicateGroupKeys.length === 1 ? '' : 's'}.`,
        }
      : null,
    aliasByKey.size > members.length
      ? {
          type: 'remembered-aliases',
          label: 'Remembered aliases',
          detail: `${aliasByKey.size} titles or filenames kept for renamed/reformatted matches.`,
        }
      : null,
    sourceLabels.length > 1
      ? {
          type: 'reviewer-decision',
          label: 'Reviewer canonical decision',
          detail: `Reviewer grouped ${sourceLabels.length} source records under one canonical source.`,
        }
      : null,
  ].filter(Boolean);

  const groupSeed = [
    canonicalMember.sourceHash,
    canonicalMember.sourceId,
    ...sourceHashes,
    ...sourceIds,
    ...Array.from(aliasByKey.keys()).slice(0, 12),
  ].filter(Boolean).join('|') || crypto.randomUUID();

  return {
    groupId: asString(existingLineage?.groupId) || `canonical-lineage:${crypto.createHash('sha256').update(groupSeed).digest('hex').slice(0, 18)}`,
    canonicalSource: {
      sourceId: canonicalMember.sourceId,
      sourceLabel: canonicalMember.sourceLabel,
      sourcePageId: canonicalMember.sourcePageId,
      sourceHash: canonicalMember.sourceHash,
    },
    members,
    aliases: Array.from(aliasByKey.values()).slice(0, 50),
    sourceIds: Array.from(new Set(sourceIds)).slice(0, 50),
    sourceHashes,
    sourcePageIds,
    duplicateGroupKeys,
    matchEvidence,
    createdAt: asString(existingLineage?.createdAt) || now,
    updatedAt: now,
    updatedBy: 'Current worker',
    nonDestructive: true,
    articleWrite: false,
    vectorWrite: false,
    graphWrite: false,
    attachmentWrite: false,
    fileAction: false,
  };
};

const localArchiveSourceHistoryFromIngestions = (ingestions = []) =>
  ingestions
    .map((ingestion) => {
      const archive = ingestion.archive || ingestion.generatedRecords?.frontendRecord?.archive || ingestion.wikiPage?.archive || {};
      const sourceHash = ingestion.sha256 || ingestion.generatedRecords?.frontendRecord?.sourceHash || '';
      const cleanupDecision = archive.cleanupDecision || null;
      const canonicalLineage = archive.canonicalLineage || cleanupDecision?.canonicalLineage || null;
      if (!sourceHash && !canonicalLineage) return null;
      return {
        sourceHash,
        sourceId: ingestion.fileId,
        sourceLabel:
          archive.suggestedWikiTitle ||
          ingestion.generatedRecords?.frontendRecord?.title ||
          ingestion.originalName ||
          ingestion.fileId,
        sourcePageId:
          ingestion.generatedRecords?.frontendRecord?.pageId ||
          ingestion.wikiPage?.id ||
          '',
        reviewStatus: archive.reviewStatus || '',
        cleanupDecision,
        canonicalLineage,
      };
    })
    .filter(Boolean);

const normalizeLocalArchiveCatalogPath = (rootId = '', relativePath = '') =>
  `${asString(rootId).toLowerCase()}::${asString(relativePath).replace(/\\/g, '/').toLowerCase()}`;

const localArchiveCatalogArchiveForIngestion = (ingestion = {}) =>
  ingestion.archive || ingestion.generatedRecords?.frontendRecord?.archive || ingestion.wikiPage?.archive || {};

const findExistingLocalArchiveCatalogIngestion = (candidate = {}, ingestions = []) => {
  const candidateId = asString(candidate.id);
  const candidateFileId = candidateId ? `local-catalog-${candidateId}` : '';
  const candidatePathKey = normalizeLocalArchiveCatalogPath(candidate.rootId, candidate.relativePath);
  const candidateHash = asString(candidate.sourceHash);
  return ingestions.find((ingestion) => {
    if (!ingestion) return false;
    if (candidateFileId && ingestion.fileId === candidateFileId) return true;
    const archive = localArchiveCatalogArchiveForIngestion(ingestion);
    const localArchive = archive.localArchive || {};
    const existingPathKey = normalizeLocalArchiveCatalogPath(localArchive.rootId, localArchive.relativePath);
    if (candidatePathKey !== '::' && existingPathKey === candidatePathKey) return true;
    const existingHash = asString(ingestion.sha256 || ingestion.generatedRecords?.frontendRecord?.sourceHash);
    return Boolean(candidateHash && existingHash && candidateHash === existingHash);
  });
};

const normalizeLocalArchiveCampaignForSchedule = (campaign = {}) => {
  if (!campaign || typeof campaign !== 'object' || Array.isArray(campaign)) return null;
  const id = asString(campaign.id);
  const name = asString(campaign.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    status: asString(campaign.status, 'not-started'),
    query: asString(campaign.query),
    selectedCount: Array.isArray(campaign.selectedIds)
      ? campaign.selectedIds.length
      : Number.isFinite(Number(campaign.selectedCount))
        ? Number(campaign.selectedCount)
        : 0,
    importedCount: Number.isFinite(Number(campaign.importedCount)) ? Number(campaign.importedCount) : 0,
    totalCandidates: Number.isFinite(Number(campaign.totalCandidates)) ? Number(campaign.totalCandidates) : 0,
    reviewCount: Number.isFinite(Number(campaign.reviewCount)) ? Number(campaign.reviewCount) : 0,
    cleanupCount: Number.isFinite(Number(campaign.cleanupCount)) ? Number(campaign.cleanupCount) : 0,
    blockedCount: Number.isFinite(Number(campaign.blockedCount)) ? Number(campaign.blockedCount) : 0,
    lastScannedAt: asString(campaign.lastScannedAt),
    lastImportedAt: asString(campaign.lastImportedAt),
    updatedAt: asString(campaign.updatedAt),
    domains: Array.isArray(campaign.domains)
      ? campaign.domains.map((domain) => asString(domain)).filter(Boolean).slice(0, 8)
      : [],
    roots: Array.isArray(campaign.roots)
      ? campaign.roots.map((root) => asString(root)).filter(Boolean).slice(0, 8)
      : [],
  };
};

const normalizeLocalArchiveCampaignLaneTemplate = (template = {}, index = 0) => {
  if (!template || typeof template !== 'object' || Array.isArray(template)) return null;
  const id = asString(template.id);
  const name = asString(template.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    query: asString(template.query),
    description: asString(template.description),
    domainHint: asString(template.domainHint, 'General archive'),
    rootsHint: asString(template.rootsHint, 'Configured archive roots'),
    order: index + 1,
  };
};

const localArchiveCampaignStatusRank = {
  ingesting: 1,
  selecting: 2,
  scanned: 3,
  'needs-review': 4,
  ingested: 5,
  'not-started': 6,
};

const buildLocalArchiveCampaignScheduleLane = ({
  template,
  campaign,
  checkpoints = [],
  activeJob = null,
  order,
}) => {
  const checkpointCount = checkpoints.length;
  const selectedCount = campaign?.selectedCount || 0;
  const candidateCount = campaign?.totalCandidates || 0;
  const reviewCount = campaign?.reviewCount || 0;
  const blockedCount = campaign?.blockedCount || 0;
  const hasActiveJob = Boolean(activeJob && ['queued', 'processing', 'paused'].includes(activeJob.status));
  const activeJobStatus = hasActiveJob ? activeJob.status : '';
  const nextAction = hasActiveJob
    ? activeJobStatus === 'paused'
      ? 'Resume paused background ingest'
      : 'Monitor active background ingest'
    : selectedCount
      ? 'Start background ingest for selected sources'
      : reviewCount
        ? 'Open review queue before embedding'
        : candidateCount
          ? 'Select a guided source pass'
          : 'Scan computer archive for this lane';
  const safetyGate = blockedCount
    ? `${blockedCount} quarantined source${blockedCount === 1 ? '' : 's'} stay blocked`
    : reviewCount
      ? 'Human review required before attachment or embedding'
      : 'Source-first import, no automatic attachment';
  const priorityScore =
    (hasActiveJob ? 80 : 0) +
    selectedCount * 3 +
    reviewCount * 2 +
    Math.min(40, candidateCount / 10) +
    checkpointCount * 4 -
    blockedCount;

  return {
    id: template.id,
    name: template.name,
    order,
    query: campaign?.query || template.query,
    description: template.description,
    domainHint: template.domainHint,
    rootsHint: template.rootsHint,
    status: campaign?.status || 'not-started',
    priorityScore: Math.round(priorityScore),
    checkpointCount,
    candidateCount,
    selectedCount,
    importedCount: campaign?.importedCount || 0,
    reviewCount,
    cleanupCount: campaign?.cleanupCount || 0,
    blockedCount,
    activeJobStatus,
    nextAction,
    safetyGate,
    vectorGate: 'Weaviate writes stay blocked until chunk review approval',
    graphGate: 'Neo4j source graph is allowed for metadata and reviewed relationships',
    lastActivityAt:
      activeJob?.updatedAt ||
      campaign?.lastImportedAt ||
      campaign?.lastScannedAt ||
      campaign?.updatedAt ||
      '',
  };
};

const buildLocalArchiveCampaignSchedule = ({
  currentCampaign,
  checkpoints = [],
  laneTemplates = [],
  activeJob = null,
}) => {
  const generatedAt = new Date().toISOString();
  const templates = laneTemplates
    .map(normalizeLocalArchiveCampaignLaneTemplate)
    .filter(Boolean)
    .slice(0, 12);
  const normalizedCurrent = normalizeLocalArchiveCampaignForSchedule(currentCampaign);
  const normalizedCheckpoints = (Array.isArray(checkpoints) ? checkpoints : [])
    .map(normalizeLocalArchiveCampaignForSchedule)
    .filter(Boolean)
    .slice(0, 24);
  const campaignsByName = new Map();
  [...normalizedCheckpoints, normalizedCurrent].filter(Boolean).forEach((campaign) => {
    const key = campaign.name.toLowerCase();
    const existing = campaignsByName.get(key);
    if (
      !existing ||
      (localArchiveCampaignStatusRank[campaign.status] || 99) <
        (localArchiveCampaignStatusRank[existing.status] || 99)
    ) {
      campaignsByName.set(key, campaign);
    }
  });
  const lanes = templates.map((template, index) => {
    const campaign = campaignsByName.get(template.name.toLowerCase()) || null;
    const laneJob =
      normalizedCurrent && campaign?.id === normalizedCurrent.id && activeJob && typeof activeJob === 'object'
        ? activeJob
        : null;
    return buildLocalArchiveCampaignScheduleLane({
      template,
      campaign,
      checkpoints: normalizedCheckpoints.filter(
        (checkpoint) => checkpoint.name.toLowerCase() === template.name.toLowerCase(),
      ),
      activeJob: laneJob,
      order: index + 1,
    });
  });
  const sortedLanes = [...lanes].sort((left, right) => {
    if (right.priorityScore !== left.priorityScore) return right.priorityScore - left.priorityScore;
    return left.order - right.order;
  });
  const nextLane = sortedLanes[0] || null;

  return {
    scheduleId: `local-archive-campaign-schedule-${crypto.randomUUID()}`,
    generatedAt,
    mode: 'metadata-only',
    scheduleStatus: 'previewed',
    laneCount: lanes.length,
    checkpointCount: normalizedCheckpoints.length,
    totalEstimatedCandidates: lanes.reduce((sum, lane) => sum + lane.candidateCount, 0),
    totalSelectedSources: lanes.reduce((sum, lane) => sum + lane.selectedCount, 0),
    totalReviewSources: lanes.reduce((sum, lane) => sum + lane.reviewCount, 0),
    totalBlockedSources: lanes.reduce((sum, lane) => sum + lane.blockedCount, 0),
    nextLaneId: nextLane?.id || '',
    nextAction: nextLane
      ? `${nextLane.name}: ${nextLane.nextAction}`
      : 'Create a campaign lane before scheduling',
    policy:
      'Source-first campaign scheduling: scan, select, catalog or ingest, review, then approve graph/vector writes. No source text or vectors are written by this schedule preview.',
    lanes,
  };
};

const localArchiveCampaignAutomationCadences = new Set(['manual', 'hourly', 'daily', 'weekly']);
const localArchiveCampaignAutomationRunModes = new Set(['plan-only', 'start-selected-ingest']);
const localArchiveCampaignAutomationIntervals = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

const validIsoDateString = (value) => {
  const raw = asString(value);
  if (!raw) return '';
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
};

const nextLocalArchiveCampaignAutomationRunAt = (cadence, from = new Date()) => {
  const interval = localArchiveCampaignAutomationIntervals[cadence];
  if (!interval) return '';
  return new Date(from.getTime() + interval).toISOString();
};

const normalizeLocalArchiveCampaignAutomation = (automation = {}, now = new Date()) => {
  const cadence = localArchiveCampaignAutomationCadences.has(asString(automation.cadence))
    ? asString(automation.cadence)
    : 'daily';
  const status = asString(automation.status) === 'active' ? 'active' : 'paused';
  const runMode = localArchiveCampaignAutomationRunModes.has(asString(automation.runMode))
    ? asString(automation.runMode)
    : 'plan-only';
  const confirmationInput =
    automation.selectedSourceConfirmation &&
    typeof automation.selectedSourceConfirmation === 'object' &&
    !Array.isArray(automation.selectedSourceConfirmation)
      ? automation.selectedSourceConfirmation
      : null;
  const selectedSourceConfirmation = confirmationInput
    ? {
        signature: asString(confirmationInput.signature),
        count: Number.isFinite(Number(confirmationInput.count)) ? Math.max(0, Number(confirmationInput.count)) : 0,
        confirmedAt: validIsoDateString(confirmationInput.confirmedAt),
        source: asString(confirmationInput.source, 'operator'),
        confirmedBy: asString(confirmationInput.confirmedBy),
      }
    : null;
  const nextRunAt =
    validIsoDateString(automation.nextRunAt) ||
    (status === 'active' ? nextLocalArchiveCampaignAutomationRunAt(cadence, now) : '');

  return {
    id: asString(automation.id, `local-archive-campaign-automation-${crypto.randomUUID()}`),
    title: asString(automation.title, 'Whole-life import cadence'),
    status,
    cadence,
    runMode,
    allowIngest: runMode === 'start-selected-ingest' && automation.allowIngest === true,
    requireReviewBeforeRun: automation.requireReviewBeforeRun !== false,
    selectedSourceConfirmation:
      selectedSourceConfirmation?.signature && selectedSourceConfirmation.count
        ? selectedSourceConfirmation
        : null,
    lastRunAt: validIsoDateString(automation.lastRunAt),
    lastCheckedAt: validIsoDateString(automation.lastCheckedAt),
    nextRunAt,
    runCount: Number.isFinite(Number(automation.runCount)) ? Math.max(0, Number(automation.runCount)) : 0,
    lastAction:
      automation.lastAction && typeof automation.lastAction === 'object' && !Array.isArray(automation.lastAction)
        ? automation.lastAction
        : null,
  };
};

const selectedLocalArchiveFilesFromRequest = (files = []) =>
  (Array.isArray(files) ? files : [])
    .map((file) => ({
      rootId: typeof file?.rootId === 'string' ? file.rootId : '',
      relativePath: typeof file?.relativePath === 'string' ? file.relativePath : '',
      fileName: asString(file?.fileName),
      importReadiness: asString(file?.importReadiness),
      importPriority: asString(file?.importPriority),
      cleanupSignals: Array.isArray(file?.cleanupSignals)
        ? file.cleanupSignals.map((signal) => asString(signal)).filter(Boolean)
        : [],
      sourceHistory:
        file?.sourceHistory && typeof file.sourceHistory === 'object' && !Array.isArray(file.sourceHistory)
          ? {
              status: asString(file.sourceHistory.status),
              label: asString(file.sourceHistory.label),
              recommendation: asString(file.sourceHistory.recommendation),
              matchMethod: asString(file.sourceHistory.matchMethod),
              lineageScore: Number.isFinite(Number(file.sourceHistory.lineageScore))
                ? Number(file.sourceHistory.lineageScore)
                : null,
              matchedSource: file.sourceHistory.matchedSource || null,
              canonicalSource: file.sourceHistory.canonicalSource || null,
              canonicalLineage: file.sourceHistory.canonicalLineage || null,
            }
          : null,
      lane: asString(file?.lane),
      lifeDomainId: asString(file?.lifeDomainId),
    }))
    .filter((file) => file.rootId && file.relativePath)
    .slice(0, WIKI_INGEST_FILE_LIMIT);

const localArchiveDirectIngestBlockReason = (file = {}) => {
  const cleanupSignals = Array.isArray(file.cleanupSignals) ? file.cleanupSignals : [];
  if (cleanupSignals.includes('sensitive-credential-review') || file.importReadiness === 'blocked-sensitive') {
    return 'credential-like sources are quarantined';
  }
  if (!file.importReadiness) {
    return 'fresh scan metadata is required before extraction';
  }
  if (file.importReadiness !== 'ready-to-ingest') {
    return `${file.importReadiness} sources need review before extraction`;
  }
  if (cleanupSignals.length) {
    return 'cleanup signals need review before extraction';
  }
  if (file.sourceHistory?.status) {
    return 'existing source history needs canonical review before extraction';
  }
  if (file.lifeDomainId === 'development' || file.lane === 'Development and code archives') {
    return 'development/code archive sources need explicit review before extraction';
  }
  return '';
};

const getLocalArchiveDirectIngestBlockers = (files = []) =>
  files
    .map((file) => ({
      file,
      reason: localArchiveDirectIngestBlockReason(file),
    }))
    .filter((item) => item.reason);

const summarizeLocalArchiveDirectIngestBlockers = (blocked = []) =>
  blocked
    .slice(0, 3)
    .map((item) => `${item.file.fileName || item.file.relativePath}: ${item.reason}`)
    .join('; ');

const assertLocalArchiveDirectIngestAllowed = (files = []) => {
  const blocked = getLocalArchiveDirectIngestBlockers(files);
  if (!blocked.length) return;
  const error = new Error(
    `Review required before local archive extraction: ${summarizeLocalArchiveDirectIngestBlockers(blocked)}`,
  );
  error.status = 400;
  error.blocked = blocked.map((item) => ({
    fileName: item.file.fileName || '',
    relativePath: item.file.relativePath || '',
    reason: item.reason,
  }));
  throw error;
};

const selectedLocalArchiveFilesConfirmationSignature = (files = []) => {
  const selectedFiles = selectedLocalArchiveFilesFromRequest(files);
  if (!selectedFiles.length) return '';
  const fingerprint = selectedFiles
    .map((file) => `${file.rootId}\u0000${file.relativePath}`)
    .sort((left, right) => left.localeCompare(right))
    .join('\n');
  const digest = crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 16);
  return `${selectedFiles.length}:${digest}`;
};

const localArchiveSelectedSourcesConfirmed = (automation = {}, selectedFiles = []) => {
  const selectedSourceSignature = selectedLocalArchiveFilesConfirmationSignature(selectedFiles);
  if (!automation.requireReviewBeforeRun) {
    return {
      confirmed: true,
      selectedSourceSignature,
      confirmation: automation.selectedSourceConfirmation || null,
    };
  }
  const confirmation = automation.selectedSourceConfirmation || null;
  return {
    confirmed:
      Boolean(selectedSourceSignature) &&
      confirmation?.signature === selectedSourceSignature &&
      Number(confirmation?.count) === selectedFiles.length,
    selectedSourceSignature,
    confirmation,
  };
};

const localArchiveCampaignLaneTemplates = [
  {
    id: 'whole-life',
    name: 'Whole-life wiki import',
    query: '',
    description: 'Broad pass across Desktop, Documents, Downloads, and Projects for anything worth organizing.',
    domainHint: 'All life domains',
    rootsHint: 'Desktop, Documents, Downloads, Projects',
  },
  {
    id: 'street-voices-ops',
    name: 'Street Voices operations',
    query: 'street voices grant agreement partner invoice program',
    description: 'Street Voices documents, partner lists, grants, agreements, program files, and operations records.',
    domainHint: 'Street Voices operations',
    rootsHint: 'Documents, Projects, Downloads',
  },
  {
    id: 'case-management-evidence',
    name: 'Case-management evidence',
    query: 'case client referral intake service housing task note',
    description: 'Material that might become case wiki source pages, client evidence, service referrals, or review notes.',
    domainHint: 'Case Management',
    rootsHint: 'Documents, Downloads, Projects',
  },
  {
    id: 'research-web-links',
    name: 'Research and web links',
    query: 'bookmark research article url webloc html export',
    description: 'Bookmarks, saved links, research exports, article captures, web notes, and reference material.',
    domainHint: 'Research',
    rootsHint: 'Downloads, Documents, browser exports',
  },
  {
    id: 'media-transcripts',
    name: 'Media and transcripts',
    query: 'audio video transcript caption vtt srt mp3 mp4 mov podcast',
    description: 'Audio, video, caption files, transcripts, podcast material, and media sources needing transcription review.',
    domainHint: 'Media',
    rootsHint: 'Desktop, Documents, Downloads',
  },
  {
    id: 'personal-archive',
    name: 'Personal archive',
    query: 'personal resume cv letter application finance health family',
    description: 'Personal files that should stay standalone unless explicitly attached to another wiki record.',
    domainHint: 'Personal archive',
    rootsHint: 'Desktop, Documents, Downloads',
  },
];

const localArchiveSelectedIdsFromWorkspace = (workspace = {}, { includeRehearsal = true } = {}) => {
  const rehearsalSelection =
    workspace.localArchiveCampaign?.rehearsalSelection &&
    typeof workspace.localArchiveCampaign.rehearsalSelection === 'object' &&
    !Array.isArray(workspace.localArchiveCampaign.rehearsalSelection)
      ? workspace.localArchiveCampaign.rehearsalSelection
      : null;
  const rehearsalIds = Array.isArray(rehearsalSelection?.selectedIds)
    ? rehearsalSelection.selectedIds.map((id) => asString(id)).filter(Boolean)
    : [];
  if (includeRehearsal && rehearsalSelection?.enabled === true && rehearsalIds.length) {
    return {
      selectedIds: rehearsalIds,
      source: 'rehearsal-selection',
      rehearsalSelection,
    };
  }
  return {
    selectedIds: Array.from(
      new Set([
        ...(Array.isArray(workspace.localArchiveSelectedIds) ? workspace.localArchiveSelectedIds : []),
        ...(Array.isArray(workspace.localArchiveCampaign?.selectedIds) ? workspace.localArchiveCampaign.selectedIds : []),
      ].map((id) => asString(id)).filter(Boolean)),
    ),
    source: 'saved-selection',
    rehearsalSelection,
  };
};

const selectedLocalArchiveFilesFromWorkspace = (workspace = {}, options = {}) => {
  const { selectedIds } = localArchiveSelectedIdsFromWorkspace(workspace, options);
  const selectedIdSet = new Set(selectedIds);
  const candidates = Array.isArray(workspace.localArchiveScan?.candidates) ? workspace.localArchiveScan.candidates : [];
  return candidates
    .filter((candidate) => selectedIdSet.has(candidate.id))
    .map((candidate) => ({
      rootId: asString(candidate.rootId),
      relativePath: asString(candidate.relativePath),
      fileName: asString(candidate.fileName),
      importReadiness: asString(candidate.importReadiness),
      importPriority: asString(candidate.importPriority),
      cleanupSignals: Array.isArray(candidate.cleanupSignals)
        ? candidate.cleanupSignals.map((signal) => asString(signal)).filter(Boolean)
        : [],
      sourceHistory:
        candidate.sourceHistory && typeof candidate.sourceHistory === 'object' && !Array.isArray(candidate.sourceHistory)
          ? {
              status: asString(candidate.sourceHistory.status),
              label: asString(candidate.sourceHistory.label),
              recommendation: asString(candidate.sourceHistory.recommendation),
              matchMethod: asString(candidate.sourceHistory.matchMethod),
              lineageScore: Number.isFinite(Number(candidate.sourceHistory.lineageScore))
                ? Number(candidate.sourceHistory.lineageScore)
                : null,
              matchedSource: candidate.sourceHistory.matchedSource || null,
              canonicalSource: candidate.sourceHistory.canonicalSource || null,
              canonicalLineage: candidate.sourceHistory.canonicalLineage || null,
            }
          : null,
      lane: asString(candidate.lane),
      lifeDomainId: asString(candidate.lifeDomainId),
    }))
    .filter((file) => file.rootId && file.relativePath)
    .slice(0, WIKI_INGEST_FILE_LIMIT);
};

const makeLocalArchiveCampaignAutomationDueState = (automation = {}, nowDate = new Date(), force = false) => {
  const dueAt = automation.nextRunAt ? Date.parse(automation.nextRunAt) : NaN;
  const isActive = automation.status === 'active';
  const isDue =
    isActive &&
    (force ||
      automation.cadence === 'manual' ||
      !automation.nextRunAt ||
      (Number.isFinite(dueAt) && dueAt <= nowDate.getTime()));
  return {
    due: isDue,
    status: !isActive ? 'paused' : isDue ? 'due' : 'waiting',
    dueAt: automation.nextRunAt || '',
    message: !isActive
      ? 'Automation is paused.'
      : isDue
        ? 'Automation is due for a saved-workspace daemon check.'
        : `Next saved-workspace daemon check is scheduled for ${automation.nextRunAt || 'the next manual run'}.`,
  };
};

const formatDurationMinutes = (durationMs) => {
  const minutes = Math.max(1, Math.round((Number(durationMs) || 0) / (60 * 1000)));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
};

const buildLocalArchiveCampaignDaemonEnvironment = () => ({
  schedulerEnabled: CASE_WIKI_LOCAL_ARCHIVE_DAEMON_ENABLED,
  executeEnabled: CASE_WIKI_LOCAL_ARCHIVE_DAEMON_EXECUTE,
  intervalMs: CASE_WIKI_LOCAL_ARCHIVE_DAEMON_INTERVAL_MS,
  intervalLabel: formatDurationMinutes(CASE_WIKI_LOCAL_ARCHIVE_DAEMON_INTERVAL_MS),
  batchLimit: CASE_WIKI_LOCAL_ARCHIVE_DAEMON_BATCH_LIMIT,
  mode: CASE_WIKI_LOCAL_ARCHIVE_DAEMON_EXECUTE ? 'live-ingest-capable' : 'dry-run-only',
  schedulerStatus: CASE_WIKI_LOCAL_ARCHIVE_DAEMON_ENABLED ? 'enabled' : 'disabled',
  vectorProvider: CASE_WIKI_VECTOR_PROVIDER,
  vectorWritesEnabled: false,
  summary: CASE_WIKI_LOCAL_ARCHIVE_DAEMON_ENABLED
    ? CASE_WIKI_LOCAL_ARCHIVE_DAEMON_EXECUTE
      ? 'The saved-workspace daemon is enabled and the server environment allows guarded ingest jobs after all operator gates pass.'
      : 'The saved-workspace daemon is enabled, but this server is in dry-run mode. It can plan and audit; it cannot start ingest jobs.'
    : 'The saved-workspace daemon interval is disabled. Manual queue checks and plan-only daemon passes are still available from this page.',
  safeguards: [
    CASE_WIKI_LOCAL_ARCHIVE_DAEMON_ENABLED
      ? 'Server interval can wake active whole-life campaigns.'
      : 'Server interval is off until CASE_WIKI_LOCAL_ARCHIVE_DAEMON_ENABLED=true.',
    CASE_WIKI_LOCAL_ARCHIVE_DAEMON_EXECUTE
      ? 'Server execution can start selected-source ingest only after app-level gates pass.'
      : 'Server execution is dry-run only until CASE_WIKI_LOCAL_ARCHIVE_DAEMON_EXECUTE=true.',
    'Selected-source confirmation is required when review-before-run is enabled.',
    'Weaviate vector writes remain review-gated.',
  ],
});

const buildLocalArchiveCampaignDaemonHandoff = ({
  automation = {},
  dueState = {},
  selectedFileCount = 0,
  selectedSourcesConfirmed = false,
  confirmationRequired = false,
  queueItems = [],
  environment = {},
} = {}) => {
  const handoff = [];
  const push = (item) => {
    handoff.push({
      target: 'case-wiki-workflow-inbox',
      severity: 'info',
      actionLabel: 'Review',
      ...item,
    });
  };

  if (!environment.schedulerEnabled) {
    push({
      id: 'daemon-env-disabled',
      severity: 'warning',
      title: 'Daemon scheduler is disabled',
      detail: 'Closed-browser interval checks will not run until CASE_WIKI_LOCAL_ARCHIVE_DAEMON_ENABLED is true. Manual queue checks remain safe.',
      actionLabel: 'Enable env when ready',
    });
  }

  if (!environment.executeEnabled) {
    push({
      id: 'daemon-execute-dry-run',
      severity: 'warning',
      title: 'Daemon is dry-run only',
      detail: 'The server can plan and audit the whole-life campaign, but it cannot start ingest jobs until CASE_WIKI_LOCAL_ARCHIVE_DAEMON_EXECUTE is true.',
      actionLabel: 'Keep reviewing',
    });
  }

  if (automation.status !== 'active') {
    push({
      id: 'daemon-automation-paused',
      title: 'Campaign automation is paused',
      detail: 'Activate the saved cadence before any closed-browser run can be considered.',
      actionLabel: 'Activate cadence',
    });
  } else if (dueState.status === 'waiting') {
    push({
      id: 'daemon-not-due',
      title: 'Next check is scheduled',
      detail: dueState.message || 'The saved cadence is active but not due yet.',
      actionLabel: 'Wait or force check',
    });
  }

  if (automation.runMode !== 'start-selected-ingest') {
    push({
      id: 'daemon-plan-only-mode',
      title: 'Plan-only mode is on',
      detail: 'The daemon will only write plans and audit records until the mode is changed to start selected ingest.',
      actionLabel: 'Switch mode',
    });
  }

  if (!automation.allowIngest) {
    push({
      id: 'daemon-guarded-ingest-locked',
      title: 'Guarded ingest is locked',
      detail: 'A person still needs to allow server-started ingest for this campaign.',
      actionLabel: 'Review ingest gate',
    });
  }

  if (!selectedFileCount) {
    push({
      id: 'daemon-no-saved-selection',
      severity: 'warning',
      title: 'No saved selected-source batch',
      detail: 'Select sources in the local archive campaign and save the workspace before the daemon can resolve files from the server.',
      actionLabel: 'Select sources',
    });
  } else if (confirmationRequired || !selectedSourcesConfirmed) {
    push({
      id: 'daemon-source-confirmation-needed',
      severity: 'warning',
      title: 'Selected sources need confirmation',
      detail: `${selectedFileCount} saved source${selectedFileCount === 1 ? '' : 's'} are visible to the server, but review-before-run requires an operator confirmation for this exact batch.`,
      actionLabel: 'Confirm sources',
    });
  }

  const readyItems = queueItems.filter((item) => item.canStartIngest);
  if (readyItems.length) {
    push({
      id: environment.executeEnabled ? 'daemon-live-ready' : 'daemon-ready-dry-run',
      severity: environment.executeEnabled ? 'success' : 'info',
      title: environment.executeEnabled ? 'Live ingest gates are satisfied' : 'Ready after dry-run env unlock',
      detail: environment.executeEnabled
        ? `${readyItems.length} lane${readyItems.length === 1 ? '' : 's'} can start selected-source ingest when the daemon runs.`
        : `${readyItems.length} lane${readyItems.length === 1 ? '' : 's'} would be runnable after CASE_WIKI_LOCAL_ARCHIVE_DAEMON_EXECUTE is enabled.`,
      actionLabel: environment.executeEnabled ? 'Monitor run' : 'Enable live env',
    });
  }

  push({
    id: 'daemon-vector-review-gate',
    title: 'Embedding stays human-reviewed',
    detail: 'Ingested source pages can create graph records and review chunks, but Weaviate writes stay blocked until chunk review approval.',
    actionLabel: 'Open embedding review',
  });

  return handoff.slice(0, 8);
};

const buildLocalArchiveCampaignDaemonQueue = ({
  workspace = {},
  activeJob = null,
  selectedFiles = [],
  force = false,
  nowDate = new Date(),
} = {}) => {
  const automation = normalizeLocalArchiveCampaignAutomation(
    workspace.localArchiveCampaignAutomation || {},
    nowDate,
  );
  const schedule = buildLocalArchiveCampaignSchedule({
    currentCampaign: workspace.localArchiveCampaign || null,
    checkpoints: Array.isArray(workspace.localArchiveCampaigns) ? workspace.localArchiveCampaigns : [],
    laneTemplates: localArchiveCampaignLaneTemplates,
    activeJob,
  });
  const dueState = makeLocalArchiveCampaignAutomationDueState(automation, nowDate, force);
  const selectedFileCount = selectedFiles.length;
  const directIngestBlockers = getLocalArchiveDirectIngestBlockers(selectedFiles);
  const directIngestBlockedCount = directIngestBlockers.length;
  const {
    confirmed: selectedSourcesConfirmed,
    selectedSourceSignature,
    confirmation: selectedSourceConfirmation,
  } = localArchiveSelectedSourcesConfirmed(automation, selectedFiles);
  const queueItems = schedule.lanes.map((lane) => {
    const isNextLane = lane.id === schedule.nextLaneId;
    let queueStatus = dueState.status === 'paused' ? 'paused' : dueState.status === 'waiting' ? 'waiting' : 'planned';
    let guard = dueState.message;
    if (['queued', 'processing'].includes(lane.activeJobStatus || '')) {
      queueStatus = 'monitoring-job';
      guard = 'A background ingest job is already active for this lane.';
    } else if (dueState.due && lane.nextAction === 'Start background ingest for selected sources') {
      if (automation.runMode !== 'start-selected-ingest') {
        queueStatus = 'plan-only';
        guard = 'Plan-only mode is on, so the daemon can plan but cannot start ingest.';
      } else if (!automation.allowIngest) {
        queueStatus = 'approval-required';
        guard = 'Guarded ingest is disabled. A person must approve before the daemon can start local file ingest.';
      } else if (!selectedFileCount) {
        queueStatus = 'selection-required';
        guard = 'No selected source files are available in the saved workspace snapshot.';
      } else if (directIngestBlockedCount) {
        queueStatus = 'review-required';
        guard = `${directIngestBlockedCount} selected source${directIngestBlockedCount === 1 ? '' : 's'} need review before extraction: ${summarizeLocalArchiveDirectIngestBlockers(directIngestBlockers)}.`;
      } else if (!selectedSourcesConfirmed) {
        queueStatus = 'confirmation-required';
        guard = 'Review-before-run is enabled. Confirm the saved selected-source batch before the daemon can start local file ingest.';
      } else {
        queueStatus = dueState.due && isNextLane ? 'ready-to-run' : queueStatus;
        guard = dueState.due
          ? `${selectedFileCount} saved selected source${selectedFileCount === 1 ? '' : 's'} can be resolved by the server.`
          : dueState.message;
      }
    } else if (dueState.due && lane.nextAction === 'Open review queue before embedding') {
      queueStatus = 'review-required';
      guard = 'Human review is required before any Weaviate vector write.';
    } else if (dueState.due && lane.nextAction === 'Scan computer archive for this lane') {
      queueStatus = 'scan-required';
      guard = 'This lane needs a local archive scan before daemon ingest can run.';
    } else if (dueState.due && lane.nextAction === 'Select a guided source pass') {
      queueStatus = 'selection-required';
      guard = 'This lane needs a selected source pass before daemon ingest can run.';
    }

    return {
      queueId: `${automation.id}:${lane.id}`,
      laneId: lane.id,
      laneName: lane.name,
      isNextLane,
      queueStatus,
      guard,
      priorityScore: lane.priorityScore,
      nextAction: lane.nextAction,
      selectedCount: lane.selectedCount,
      serverSelectedFileCount: isNextLane ? selectedFileCount : 0,
      reviewCount: lane.reviewCount,
      blockedCount: lane.blockedCount,
      activeJobStatus: lane.activeJobStatus || '',
      canStartIngest:
        dueState.due &&
        isNextLane &&
        lane.nextAction === 'Start background ingest for selected sources' &&
        automation.runMode === 'start-selected-ingest' &&
        automation.allowIngest &&
        selectedFileCount > 0 &&
        directIngestBlockedCount === 0 &&
        selectedSourcesConfirmed &&
        !['queued', 'processing'].includes(lane.activeJobStatus || ''),
      vectorGate: lane.vectorGate,
      graphGate: lane.graphGate,
      safetyGate: lane.safetyGate,
    };
  });
  const runnableCount = queueItems.filter((item) => item.canStartIngest).length;
  const daemonEnvironment = buildLocalArchiveCampaignDaemonEnvironment();
  const notificationHandoff = buildLocalArchiveCampaignDaemonHandoff({
    automation,
    dueState,
    selectedFileCount,
    selectedSourcesConfirmed,
    confirmationRequired: automation.requireReviewBeforeRun && selectedFileCount > 0 && !selectedSourcesConfirmed,
    queueItems,
    environment: daemonEnvironment,
  });
  return {
    queueId: `case-wiki-daemon-${automation.id}`,
    generatedAt: nowDate.toISOString(),
    mode: 'saved-workspace-daemon-queue',
    source: 'server-saved-workspace',
    daemonEnvironment,
    notificationHandoff,
    dueState,
    automation,
    schedule,
    selectedFileCount,
    directIngestBlockedCount,
    directIngestBlockers: directIngestBlockers.map((item) => ({
      fileName: item.file.fileName || '',
      relativePath: item.file.relativePath || '',
      reason: item.reason,
    })),
    selectedSourceSignature,
    selectedSourcesConfirmed,
    selectedSourceConfirmation,
    confirmationRequired: automation.requireReviewBeforeRun && selectedFileCount > 0 && !selectedSourcesConfirmed,
    laneCount: queueItems.length,
    runnableCount,
    queueStatus: runnableCount ? 'ready-to-run' : dueState.status,
    policy:
      'Closed-browser daemon planning is metadata-first. Local file ingest only starts when cadence is active, due, start-selected-ingest is selected, guarded ingest is enabled, saved selected files resolve on the server, and the current selected-source batch has been confirmed when review-before-run is enabled. Weaviate remains review-gated.',
    items: queueItems,
  };
};

const makeLocalArchiveCampaignDaemonRehearsalCheck = ({
  id,
  label,
  status,
  detail,
  critical = false,
  actionLabel = 'Review',
}) => ({
  id,
  label,
  status,
  detail,
  critical,
  actionLabel,
});

const buildLocalArchiveCampaignWatchedLaunchChecklist = ({
  checks = [],
  automation = {},
  environment = {},
  selectedFileCount = 0,
  recommendedBatchMax = 3,
} = {}) => {
  const checkById = new Map(checks.map((check) => [check.id, check]));
  const smallBatchReady = checkById.get('small-rehearsal-batch')?.status === 'passed';
  const serverSourcesReady = checkById.get('server-source-resolution')?.status === 'passed';
  const confirmationReady = checkById.get('selected-source-confirmation')?.status === 'passed';
  const cadenceReady = checkById.get('automation-active')?.status === 'passed';
  const runModeReady = checkById.get('run-mode-start-selected-ingest')?.status === 'passed';
  const guardedIngestReady = checkById.get('guarded-ingest-enabled')?.status === 'passed';
  const noActiveJob = checkById.get('no-active-ingest-job')?.status === 'passed';
  const envReady = checkById.get('daemon-execute-env')?.status === 'passed';
  const vectorGateReady = checkById.get('weaviate-review-gate')?.status === 'passed';

  return [
    makeLocalArchiveCampaignDaemonRehearsalCheck({
      id: 'launch-tiny-server-resolved-batch',
      label: '1. Tiny server-resolved batch',
      status: selectedFileCount && smallBatchReady && serverSourcesReady ? 'passed' : 'blocked',
      critical: true,
      detail:
        selectedFileCount && smallBatchReady && serverSourcesReady
          ? `${selectedFileCount} source${selectedFileCount === 1 ? '' : 's'} are small enough for the first watched run and resolve from the server.`
          : `Create a ${recommendedBatchMax}-source rehearsal batch from resolved files before any live run.`,
      actionLabel: selectedFileCount && smallBatchReady && serverSourcesReady ? 'Ready' : 'Create tiny batch',
    }),
    makeLocalArchiveCampaignDaemonRehearsalCheck({
      id: 'launch-confirm-current-batch',
      label: '2. Confirm exact rehearsal batch',
      status: confirmationReady ? 'passed' : 'blocked',
      critical: true,
      detail: confirmationReady
        ? 'Review-before-run has a current confirmation signature for this exact selected-source batch.'
        : 'Confirm the current tiny batch after reviewing it. Changing the batch clears this confirmation again.',
      actionLabel: confirmationReady ? 'Ready' : 'Confirm sources',
    }),
    makeLocalArchiveCampaignDaemonRehearsalCheck({
      id: 'launch-operator-gates',
      label: '3. Operator run gates',
      status: cadenceReady && runModeReady && guardedIngestReady ? 'passed' : 'blocked',
      critical: true,
      detail:
        cadenceReady && runModeReady && guardedIngestReady
          ? 'Campaign cadence is active, run mode starts selected ingest, and guarded ingest is unlocked.'
          : `Still gated: ${[
              cadenceReady ? '' : 'activate cadence',
              runModeReady ? '' : 'switch to start-selected-ingest',
              guardedIngestReady ? '' : 'unlock guarded ingest',
            ].filter(Boolean).join(', ')}.`,
      actionLabel: cadenceReady && runModeReady && guardedIngestReady ? 'Ready' : 'Set gates',
    }),
    makeLocalArchiveCampaignDaemonRehearsalCheck({
      id: 'launch-live-env',
      label: '4. Live daemon environment',
      status: envReady ? 'passed' : 'blocked',
      critical: true,
      detail: envReady
        ? 'The server environment can start guarded selected-source ingest after all app gates pass.'
        : 'CASE_WIKI_LOCAL_ARCHIVE_DAEMON_EXECUTE is still off. Keep it off until the watched local/staging session.',
      actionLabel: envReady ? 'Monitor env' : 'Enable only for rehearsal',
    }),
    makeLocalArchiveCampaignDaemonRehearsalCheck({
      id: 'launch-one-watched-pass',
      label: '5. One watched daemon pass',
      status: envReady && confirmationReady && cadenceReady && runModeReady && guardedIngestReady && noActiveJob ? 'passed' : 'blocked',
      critical: true,
      detail:
        envReady && confirmationReady && cadenceReady && runModeReady && guardedIngestReady && noActiveJob
          ? 'The next live step is one watched daemon pass for this tiny batch only.'
          : 'Do not start a live pass until the batch, confirmation, operator gates, live env, and active-job check all pass.',
      actionLabel:
        envReady && confirmationReady && cadenceReady && runModeReady && guardedIngestReady && noActiveJob
          ? 'Run watched pass'
          : 'Hold',
    }),
    makeLocalArchiveCampaignDaemonRehearsalCheck({
      id: 'launch-inspect-before-scale',
      label: '6. Inspect before scaling',
      status: vectorGateReady ? 'passed' : 'warning',
      detail:
        'After the watched pass, inspect source pages, Neo4j graph records, source notebooks, audit ledger, and embedding review chunks before expanding beyond 3 files.',
      actionLabel: 'Inspect results',
    }),
  ];
};

const buildLocalArchiveCampaignDaemonRehearsal = async ({
  workspace = {},
  activeJob = null,
  selectedFiles = [],
  queue = null,
  recommendedBatchMax = 3,
} = {}) => {
  const generatedAt = new Date().toISOString();
  const activeJobStatus = asString(activeJob?.status);
  const hasActiveJob = ['queued', 'processing'].includes(activeJobStatus);
  const daemonQueue =
    queue ||
    buildLocalArchiveCampaignDaemonQueue({
      workspace,
      activeJob,
      selectedFiles,
      force: true,
    });
  const automation = daemonQueue.automation || {};
  const environment = daemonQueue.daemonEnvironment || buildLocalArchiveCampaignDaemonEnvironment();
  const selectedFileCount = selectedFiles.length;
  const sourceResults = await Promise.all(
    selectedFiles.slice(0, 12).map(async (file) => {
      try {
        const resolved = await resolveLocalArchiveFile(file);
        return {
          rootId: resolved.rootId,
          rootLabel: resolved.rootLabel,
          relativePath: resolved.relativePath,
          fileName: resolved.fileName,
          size: resolved.size,
          mimeType: resolved.mimeType,
          modifiedAt: resolved.modifiedAt,
          status: 'resolved',
        };
      } catch (error) {
        return {
          rootId: asString(file.rootId),
          relativePath: asString(file.relativePath),
          status: 'unresolved',
          error: error.message || 'Could not resolve this selected source from the server.',
        };
      }
    }),
  );
  const resolvedFileCount = sourceResults.filter((source) => source.status === 'resolved').length;
  const unresolvedFileCount = Math.max(0, selectedFileCount - resolvedFileCount);
  const readyQueueItems = daemonQueue.items.filter((item) => item.canStartIngest);
  const checks = [
    makeLocalArchiveCampaignDaemonRehearsalCheck({
      id: 'daemon-execute-env',
      label: 'Live ingest environment',
      status: environment.executeEnabled ? 'passed' : 'blocked',
      critical: true,
      detail: environment.executeEnabled
        ? 'CASE_WIKI_LOCAL_ARCHIVE_DAEMON_EXECUTE is enabled, so the server may start guarded ingest jobs after app gates pass.'
        : 'CASE_WIKI_LOCAL_ARCHIVE_DAEMON_EXECUTE is off. This is still safe for planning, but it blocks live daemon ingest.',
      actionLabel: environment.executeEnabled ? 'Monitor closely' : 'Enable only in staging',
    }),
    makeLocalArchiveCampaignDaemonRehearsalCheck({
      id: 'daemon-scheduler-env',
      label: 'Interval scheduler',
      status: environment.schedulerEnabled ? 'passed' : 'warning',
      detail: environment.schedulerEnabled
        ? 'CASE_WIKI_LOCAL_ARCHIVE_DAEMON_ENABLED is enabled for closed-browser interval checks.'
        : 'The interval scheduler is off. A manual rehearsal pass can still be checked from this page.',
      actionLabel: environment.schedulerEnabled ? 'Ready' : 'Manual rehearsal',
    }),
    makeLocalArchiveCampaignDaemonRehearsalCheck({
      id: 'automation-active',
      label: 'Campaign cadence',
      status: automation.status === 'active' ? 'passed' : 'blocked',
      critical: true,
      detail:
        automation.status === 'active'
          ? 'The saved campaign automation is active.'
          : 'The saved campaign automation is paused; activate it before a live rehearsal.',
      actionLabel: automation.status === 'active' ? 'Ready' : 'Activate cadence',
    }),
    makeLocalArchiveCampaignDaemonRehearsalCheck({
      id: 'run-mode-start-selected-ingest',
      label: 'Run mode',
      status: automation.runMode === 'start-selected-ingest' ? 'passed' : 'blocked',
      critical: true,
      detail:
        automation.runMode === 'start-selected-ingest'
          ? 'The daemon is configured to start only the saved selected-source batch.'
          : 'Plan-only mode is active; switch to start-selected-ingest for a controlled live rehearsal.',
      actionLabel: automation.runMode === 'start-selected-ingest' ? 'Ready' : 'Switch mode',
    }),
    makeLocalArchiveCampaignDaemonRehearsalCheck({
      id: 'guarded-ingest-enabled',
      label: 'Guarded ingest',
      status: automation.allowIngest ? 'passed' : 'blocked',
      critical: true,
      detail: automation.allowIngest
        ? 'The app-level guarded ingest gate is enabled.'
        : 'Guarded ingest is locked. Keep it locked until the selected batch is small and confirmed.',
      actionLabel: automation.allowIngest ? 'Ready' : 'Unlock deliberately',
    }),
    makeLocalArchiveCampaignDaemonRehearsalCheck({
      id: 'selected-source-batch',
      label: 'Saved selected-source batch',
      status: selectedFileCount ? 'passed' : 'blocked',
      critical: true,
      detail: selectedFileCount
        ? `${selectedFileCount} selected source${selectedFileCount === 1 ? '' : 's'} are saved in the workspace.`
        : 'No saved selected-source batch is available to rehearse.',
      actionLabel: selectedFileCount ? 'Inspect batch' : 'Select sources',
    }),
    makeLocalArchiveCampaignDaemonRehearsalCheck({
      id: 'selected-source-confirmation',
      label: 'Batch confirmation',
      status: daemonQueue.selectedSourcesConfirmed ? 'passed' : 'blocked',
      critical: true,
      detail: daemonQueue.selectedSourcesConfirmed
        ? 'The current selected-source signature has been explicitly confirmed.'
        : 'Review-before-run requires confirming this exact selected-source batch before live daemon ingest.',
      actionLabel: daemonQueue.selectedSourcesConfirmed ? 'Ready' : 'Confirm sources',
    }),
    makeLocalArchiveCampaignDaemonRehearsalCheck({
      id: 'small-rehearsal-batch',
      label: 'Small rehearsal batch',
      status:
        selectedFileCount > 0 && selectedFileCount <= recommendedBatchMax
          ? 'passed'
          : selectedFileCount > recommendedBatchMax
            ? 'blocked'
            : 'blocked',
      critical: true,
      detail:
        selectedFileCount > recommendedBatchMax
          ? `The saved batch has ${selectedFileCount} sources. First live rehearsal should use ${recommendedBatchMax} or fewer.`
          : selectedFileCount
            ? 'The selected batch is small enough for a first live rehearsal.'
            : `Choose ${recommendedBatchMax} or fewer sources for the first live rehearsal.`,
      actionLabel: selectedFileCount > recommendedBatchMax ? 'Shrink batch' : 'Ready',
    }),
    makeLocalArchiveCampaignDaemonRehearsalCheck({
      id: 'server-source-resolution',
      label: 'Server source resolution',
      status: selectedFileCount && unresolvedFileCount === 0 ? 'passed' : 'blocked',
      critical: true,
      detail:
        selectedFileCount && unresolvedFileCount === 0
          ? 'Every saved selected source can be resolved by the server without the browser.'
          : `${unresolvedFileCount || selectedFileCount} selected source${(unresolvedFileCount || selectedFileCount) === 1 ? '' : 's'} need a fresh scan or corrected root mapping.`,
      actionLabel: unresolvedFileCount ? 'Rescan roots' : 'Ready',
    }),
    makeLocalArchiveCampaignDaemonRehearsalCheck({
      id: 'no-active-ingest-job',
      label: 'No active ingest job',
      status: hasActiveJob ? 'blocked' : 'passed',
      critical: true,
      detail: hasActiveJob
        ? `A ${activeJobStatus} ingest job is already active. Let it finish before rehearsing daemon ingest.`
        : 'No queued or processing ingest job is blocking the rehearsal.',
      actionLabel: hasActiveJob ? 'Monitor job' : 'Ready',
    }),
    makeLocalArchiveCampaignDaemonRehearsalCheck({
      id: 'weaviate-review-gate',
      label: 'Weaviate review gate',
      status: environment.vectorWritesEnabled ? 'warning' : 'passed',
      detail: environment.vectorWritesEnabled
        ? 'Vector writes are enabled; only run after chunk review policy is fully ready.'
        : 'Weaviate writes remain blocked. Rehearsal ingest can create source pages and review chunks without writing vectors.',
      actionLabel: environment.vectorWritesEnabled ? 'Audit vector writes' : 'Safe for rehearsal',
    }),
  ];
  const liveBlockers = checks.filter((check) => check.critical && check.status === 'blocked');
  const warnings = checks.filter((check) => check.status === 'warning');
  const launchChecklist = buildLocalArchiveCampaignWatchedLaunchChecklist({
    checks,
    automation,
    environment,
    selectedFileCount,
    recommendedBatchMax,
  });
  const launchBlockers = launchChecklist.filter((check) => check.critical && check.status === 'blocked');
  return {
    rehearsalId: `case-wiki-daemon-rehearsal-${crypto.randomUUID()}`,
    generatedAt,
    mode: 'controlled-live-run-rehearsal',
    source: 'server-saved-workspace',
    recommendedBatchMax,
    selectedFileCount,
    resolvedFileCount,
    unresolvedFileCount,
    sampledSourceCount: sourceResults.length,
    readyQueueCount: readyQueueItems.length,
    readyForPlanOnlyPass: Boolean(daemonQueue),
    readyForLiveRehearsal: liveBlockers.length === 0,
    status: liveBlockers.length ? 'blocked' : 'ready',
    nextAction: liveBlockers.length
      ? liveBlockers[0].actionLabel
      : 'Run one watched live rehearsal against the confirmed selected-source batch.',
    summary: liveBlockers.length
      ? `${liveBlockers.length} blocker${liveBlockers.length === 1 ? '' : 's'} must be cleared before live daemon ingest.`
      : 'All live-rehearsal gates are satisfied for this small selected-source batch.',
    environment,
    queue: daemonQueue,
    checklist: checks,
    blockers: liveBlockers,
    warnings,
    launchChecklist,
    launchBlockers,
    launchSummary: launchBlockers.length
      ? `${launchBlockers.length} watched-launch step${launchBlockers.length === 1 ? '' : 's'} still need deliberate approval or configuration.`
      : 'The watched-launch path is clear for exactly one tiny-batch daemon pass.',
    launchPolicy:
      'The watched launch path is a checklist only. It does not start ingest, approve vector writes, delete files, move files, or expand beyond the current selected batch.',
    sampleSources: sourceResults,
    enablementSteps: [
      'Keep the selected batch tiny, ideally 1-3 sources.',
      'Confirm the selected-source signature after the final selection is saved.',
      'Enable CASE_WIKI_LOCAL_ARCHIVE_DAEMON_EXECUTE=true only in a local/staging rehearsal session.',
      'Run one watched daemon pass, then inspect the job ledger, source pages, Neo4j graph records, and embedding review chunks.',
      'Leave Weaviate vector writes behind human chunk approval.',
    ],
    policy:
      'This rehearsal check reads saved workspace metadata and local file stats only. It does not ingest files, write vectors, delete files, move files, or start a daemon job.',
  };
};

const parseWikiIngestContext = (req) =>
  normalizeWikiIngestContext({
    clientId: readStringField(req.body, 'clientId'),
    clientName: readStringField(req.body, 'clientName'),
    caseId: readStringField(req.body, 'caseId'),
    caseTitle: readStringField(req.body, 'caseTitle'),
    serviceName: readStringField(req.body, 'serviceName'),
    pageId: readStringField(req.body, 'pageId'),
    privacyLevel: readStringField(req.body, 'privacyLevel'),
    redactionMode: readStringField(req.body, 'redactionMode'),
    retentionPolicy: readStringField(req.body, 'retentionPolicy'),
    sourceScope: readStringField(req.body, 'sourceScope'),
    reviewBeforeGraphWrite: readStringField(req.body, 'reviewBeforeGraphWrite'),
  });

const parseWikiIngestContextObject = (context = {}) =>
  normalizeWikiIngestContext({
    clientId: typeof context.clientId === 'string' ? context.clientId.trim() : '',
    clientName: typeof context.clientName === 'string' ? context.clientName.trim() : '',
    caseId: typeof context.caseId === 'string' ? context.caseId.trim() : '',
    caseTitle: typeof context.caseTitle === 'string' ? context.caseTitle.trim() : '',
    serviceName: typeof context.serviceName === 'string' ? context.serviceName.trim() : '',
    pageId: typeof context.pageId === 'string' ? context.pageId.trim() : '',
    privacyLevel: typeof context.privacyLevel === 'string' ? context.privacyLevel.trim() : 'personal',
    redactionMode: typeof context.redactionMode === 'string' ? context.redactionMode.trim() : 'strict',
    retentionPolicy: typeof context.retentionPolicy === 'string' ? context.retentionPolicy.trim() : 'review-source',
    sourceScope: typeof context.sourceScope === 'string' ? context.sourceScope.trim() : 'standalone',
    reviewBeforeGraphWrite: context.reviewBeforeGraphWrite === true || context.reviewBeforeGraphWrite === 'true',
    campaignId: typeof context.campaignId === 'string' ? context.campaignId.trim() : '',
    campaignName: typeof context.campaignName === 'string' ? context.campaignName.trim() : '',
    candidateCount: Number.isFinite(Number(context.candidateCount)) ? Number(context.candidateCount) : 0,
    selectedCount: Number.isFinite(Number(context.selectedCount)) ? Number(context.selectedCount) : 0,
  });

const cleanupUploadedFiles = async (files = []) => {
  await Promise.allSettled(
    files
      .filter((file) => file?.path)
      .map((file) => fs.promises.unlink(file.path).catch((error) => {
        if (error.code !== 'ENOENT') {
          logger.warn('[caseManagement] Failed to clean up preview upload', { path: file.path, error: error.message });
        }
      })),
  );
};

const makeGraphPreviewRecord = (ingestion) => {
  const frontendRecord = ingestion.generatedRecords?.frontendRecord || {};
  return {
    id: frontendRecord.id || ingestion.fileId,
    fileName: ingestion.originalName,
    extractionStatus: ingestion.extraction?.status || frontendRecord.extractionStatus,
    extractionMethod: ingestion.extraction?.method || frontendRecord.extractionMethod,
    parserWarning: ingestion.extraction?.warning || frontendRecord.parserWarning || '',
    privacyLevel: ingestion.privacy?.privacyLevel || frontendRecord.privacyLevel,
    redactionMode: ingestion.privacy?.redactionMode || frontendRecord.redactionMode,
    retentionPolicy: ingestion.privacy?.retentionPolicy || frontendRecord.retentionPolicy,
    sourceScope: ingestion.privacy?.sourceScope || frontendRecord.sourceScope || ingestion.sourceScope,
    archive: ingestion.archive || frontendRecord.archive || ingestion.wikiPage?.archive,
    nodeCount: ingestion.graph?.nodes?.length || frontendRecord.nodeCount || 0,
    edgeCount: ingestion.graph?.edges?.length || frontendRecord.edgeCount || 0,
    graphSummary: ingestion.graphSummary || frontendRecord.graphSummary,
    graphPreview: ingestion.graph || frontendRecord.graphPreview,
    textPreview: ingestion.extraction?.textPreview || frontendRecord.textPreview || '',
    tableSummary: ingestion.extraction?.tableSummary || frontendRecord.tableSummary,
    entities: frontendRecord.entities || ingestion.wikiPage?.entities || [],
    embeddingReview: ingestion.embeddingReview || frontendRecord.embeddingReview,
    weaviateDryRun: ingestion.weaviateDryRun || frontendRecord.weaviateDryRun || ingestion.embeddingReview?.weaviateDryRun,
  };
};

const relationshipReviewRecordsForIngestion = (ingestion = {}) => {
  const frontendRecord = ingestion.generatedRecords?.frontendRecord || {};
  const records = Array.isArray(ingestion.relationshipReviewRecords)
    ? ingestion.relationshipReviewRecords
    : Array.isArray(frontendRecord.relationshipReviewRecords)
      ? frontendRecord.relationshipReviewRecords
      : [];
  return records.filter(
    (record) =>
      record &&
      typeof record.id === 'string' &&
      typeof record.relationshipKey === 'string' &&
      relationshipReviewStatuses.has(record.status),
  );
};

const makeFallbackEmbeddingReview = (ingestion = {}) => {
  const frontendRecord = ingestion.generatedRecords?.frontendRecord || {};
  const existingReview = ingestion.embeddingReview || frontendRecord.embeddingReview;
  if (existingReview?.chunks) return existingReview;

  const archive = ingestion.archive || frontendRecord.archive || ingestion.wikiPage?.archive || {};
  const textPreview = ingestion.extraction?.textPreview || frontendRecord.textPreview || '';
  const provider = CASE_WIKI_VECTOR_PROVIDER;
  const privacyLevel = ingestion.privacy?.privacyLevel || frontendRecord.privacyLevel || 'case-team';
  const redactionMode = ingestion.privacy?.redactionMode || frontendRecord.redactionMode || 'standard';
  const chunks = textPreview
    ? [
        {
          id: `embedding:${ingestion.fileId || frontendRecord.id || 'source'}:preview`,
          ordinal: 1,
          status: 'pending-review',
          embeddingAction: 'pending-review',
          privacyLevel,
          redactionMode,
          lifeDomain: archive.lifeDomain || 'Unknown',
          lifeDomainId: archive.lifeDomainId || 'unknown',
          sourceKind: archive.sourceKind || 'source',
          charCount: textPreview.length,
          tokenEstimate: Math.max(1, Math.ceil(textPreview.length / 4)),
          textPreview: textPreview.slice(0, 520),
          reviewNote: 'Legacy source preview chunk; review before embedding.',
        },
      ]
    : [];

  return {
    status: chunks.length ? 'awaiting-review' : 'metadata-only',
    writeMode: 'dry-run',
    writeEnabled: false,
    provider,
    targetClass: process.env.CASE_MANAGEMENT_WEAVIATE_CLASS || 'CaseWikiSourceChunk',
    embeddingModel: ingestion.vectorIndex?.embeddingModel || 'configured embeddings model',
    privacyLevel,
    redactionMode,
    reviewRequired: true,
    chunkCount: chunks.length,
    estimatedTotalChunks: frontendRecord.vectorChunkCount || chunks.length,
    approvedCount: 0,
    rejectedCount: 0,
    pendingCount: chunks.length,
    note: chunks.length
      ? 'Prepared a legacy preview chunk for embedding review. Re-ingest for a fuller chunk map.'
      : 'No readable text chunks are ready for embedding review yet.',
    reviewReason: 'Review chunks before embedding them into the vector database.',
    chunks,
  };
};

const normalizeRetrievalQuery = (value = '') => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

const retrievalSearchText = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(retrievalSearchText).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !['rawText', 'fullText', 'binary', 'buffer'].includes(key))
      .map(([, item]) => retrievalSearchText(item))
      .filter(Boolean)
      .join(' ');
  }
  return '';
};

const scoreRetrievalText = (value, normalizedQuery, weight = 1) => {
  const text = normalizeRetrievalQuery(retrievalSearchText(value));
  if (!text || !normalizedQuery) return 0;
  let score = 0;
  if (text === normalizedQuery) score += weight * 8;
  if (text.startsWith(normalizedQuery)) score += weight * 4;
  if (text.includes(normalizedQuery)) score += weight * 5;
  const terms = normalizedQuery.split(/\s+/).filter((term) => term.length > 1);
  if (terms.length) {
    const hits = terms.filter((term) => text.includes(term)).length;
    score += hits * weight;
    if (hits === terms.length && !text.includes(normalizedQuery)) score += weight * 2;
  }
  return score;
};

const truncateRetrievalText = (value = '', limit = 260) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text;
};

const buildCaseWikiReviewedChunkRetrieval = ({ ingestions = [], query = '', limit = 12 } = {}) => {
  const normalizedQuery = normalizeRetrievalQuery(query);
  const resultLimit = Math.max(1, Math.min(Number(limit) || 12, 40));
  if (!normalizedQuery || normalizedQuery.length < 2) {
    return {
      status: 'empty-query',
      query: normalizedQuery,
      resultCount: 0,
      approvedResultCount: 0,
      pendingResultCount: 0,
      results: [],
    };
  }

  const results = ingestions
    .flatMap((ingestion) => {
      const frontendRecord = ingestion.generatedRecords?.frontendRecord || {};
      const archive = ingestion.archive || frontendRecord.archive || ingestion.wikiPage?.archive || {};
      const review = makeFallbackEmbeddingReview(ingestion);
      const sourceTitle =
        archive.suggestedWikiTitle ||
        ingestion.wikiPage?.title ||
        frontendRecord.title ||
        ingestion.originalName ||
        frontendRecord.fileName ||
        'Case Wiki source';
      return (Array.isArray(review.chunks) ? review.chunks : []).map((chunk) => {
        const score =
          scoreRetrievalText(chunk.textPreview || chunk.text || '', normalizedQuery, 5) +
          scoreRetrievalText(chunk.reviewNote, normalizedQuery, 2) +
          scoreRetrievalText([chunk.lifeDomain, chunk.sourceKind, sourceTitle, ingestion.originalName], normalizedQuery, 2);
        if (!score) return null;
        return {
          id: `${ingestion.fileId || frontendRecord.id || 'source'}:${chunk.id || chunk.ordinal || 'chunk'}`,
          sourceDocumentId: ingestion.fileId || frontendRecord.id || '',
          pageId: frontendRecord.pageId || ingestion.wikiPage?.id || (ingestion.fileId ? `ingest:${ingestion.fileId}` : ''),
          chunkId: chunk.id || '',
          ordinal: chunk.ordinal || 0,
          sourceTitle,
          fileName: ingestion.originalName || frontendRecord.fileName || '',
          lifeDomain: chunk.lifeDomain || archive.lifeDomain || 'Unknown',
          sourceKind: chunk.sourceKind || archive.sourceKind || 'source',
          status: chunk.status || 'pending-review',
          eligibleForVector: chunk.status === 'approved-for-embedding',
          privacyLevel: chunk.privacyLevel || review.privacyLevel || frontendRecord.privacyLevel || 'case-team',
          redactionMode: chunk.redactionMode || review.redactionMode || frontendRecord.redactionMode || 'standard',
          reviewNote: chunk.reviewNote || '',
          textPreview: truncateRetrievalText(chunk.textPreview || chunk.text || ''),
          score,
        };
      });
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)
    .slice(0, resultLimit);

  const approvedResultCount = results.filter((result) => result.eligibleForVector).length;
  return {
    status: results.length ? 'ready' : 'empty',
    query: normalizedQuery,
    resultCount: results.length,
    approvedResultCount,
    pendingResultCount: results.length - approvedResultCount,
    results,
  };
};

const indexedSourceIdsForRetrieval = (ingestions = []) =>
  compactStringArray(
    ingestions
      .filter((ingestion) => ['written', 'partial'].includes(ingestion.vectorIndex?.status || ''))
      .flatMap((ingestion) => [
        ingestion.fileId,
        ingestion.generatedRecords?.frontendRecord?.id,
        ...(Array.isArray(ingestion.vectorIndex?.objectIds) && ingestion.vectorIndex.objectIds.length ? [ingestion.fileId] : []),
      ]),
    80,
  );

const buildRetrievalSummary = ({ graphSearch = {}, chunkSearch = {}, vectorSearch = {} } = {}) => {
  const vectorReady = vectorSearch.status === 'ready';
  const graphCount = graphSearch.resultCount || 0;
  const chunkCount = chunkSearch.resultCount || 0;
  const vectorCount = vectorSearch.resultCount || 0;
  const layers = compactStringArray([
    graphCount ? 'wiki index and graph' : '',
    chunkCount ? 'reviewed chunk workbench' : '',
    vectorReady ? 'Weaviate hybrid search' : '',
  ]);
  return {
    status: vectorReady || graphCount || chunkCount ? 'ready' : 'empty',
    layers,
    message: vectorReady
      ? `Retrieved ${vectorCount} vector hit${vectorCount === 1 ? '' : 's'} with ${graphCount} graph/source match${graphCount === 1 ? '' : 'es'} and ${chunkCount} chunk match${chunkCount === 1 ? '' : 'es'}.`
      : `Retrieved ${graphCount} graph/source match${graphCount === 1 ? '' : 'es'} and ${chunkCount} reviewed chunk match${chunkCount === 1 ? '' : 'es'}. Weaviate remains inactive until reviewed chunks are live-indexed.`,
  };
};

const parseRetrievalScore = (value, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const normalizeRetrievalRankingEntry = (entry = {}) => ({
  id: asString(entry.id),
  layer: asString(entry.layer),
  sourceTitle: asString(entry.sourceTitle, 'Case Wiki source'),
  sourceDocumentId: asString(entry.sourceDocumentId),
  pageId: asString(entry.pageId),
  chunkId: asString(entry.chunkId),
  objectId: asString(entry.objectId),
  evidenceState: asString(entry.evidenceState, 'context-only'),
  reviewState: asString(entry.reviewState),
  lifeDomain: asString(entry.lifeDomain),
  sourceKind: asString(entry.sourceKind),
  canUseInAnswer: Boolean(entry.canUseInAnswer),
  rankScore: Math.round(parseRetrievalScore(entry.rankScore, 0) * 100) / 100,
  confidence: asString(entry.confidence, 'needs-review'),
  why: compactStringArray(entry.why || [], 6),
  textPreview: truncateRetrievalText(entry.textPreview || '', 220),
});

const buildRetrievalRankingLedger = ({ query = '', graphSearch = {}, chunkSearch = {}, vectorSearch = {}, limit = 10 } = {}) => {
  const normalizedQuery = normalizeRetrievalQuery(query);
  const resultLimit = Math.max(1, Math.min(Number(limit) || 10, 20));
  const entries = [];

  if (vectorSearch.status === 'ready' && Array.isArray(vectorSearch.results)) {
    vectorSearch.results.forEach((result, index) => {
      const sourceTitle = result.sourceTitle || result.title || result.sourceDocumentId || `Reviewed vector ${index + 1}`;
      entries.push(
        normalizeRetrievalRankingEntry({
          id: `rank:vector:${result.objectId || result.chunkId || result.sourceDocumentId || index}`,
          layer: 'Weaviate hybrid',
          sourceTitle,
          sourceDocumentId: result.sourceDocumentId,
          pageId: result.wikiPageId || result.pageId || (result.sourceDocumentId ? `ingest:${result.sourceDocumentId}` : ''),
          chunkId: result.chunkId,
          objectId: result.objectId,
          evidenceState: 'reviewed-vector',
          reviewState: result.reviewStatus || 'reviewed-vector',
          lifeDomain: result.lifeDomain,
          sourceKind: result.sourceKind,
          canUseInAnswer: true,
          rankScore:
            90 +
            parseRetrievalScore(result.score, 0) +
            scoreRetrievalText([sourceTitle, result.chunkSummary, result.chunkText, result.explainScore], normalizedQuery, 1),
          confidence: 'reviewed-live-vector',
          why: [
            'Reviewed chunk already has a live vector object',
            result.objectId ? 'Weaviate object id is present' : '',
            'Eligible for cited answer draft and promotion preview',
          ],
          textPreview: result.chunkSummary || result.chunkText || result.explainScore || '',
        }),
      );
    });
  }

  if (Array.isArray(chunkSearch.results)) {
    chunkSearch.results.forEach((result, index) => {
      const reviewed = Boolean(result.eligibleForVector || result.status === 'approved-for-embedding');
      entries.push(
        normalizeRetrievalRankingEntry({
          id: `rank:chunk:${result.chunkId || result.id || index}`,
          layer: 'Reviewed chunk workbench',
          sourceTitle: result.sourceTitle || result.fileName || result.sourceDocumentId || `Chunk ${index + 1}`,
          sourceDocumentId: result.sourceDocumentId,
          pageId: result.pageId,
          chunkId: result.chunkId,
          evidenceState: reviewed ? 'reviewed-chunk' : 'candidate',
          reviewState: result.status || (reviewed ? 'approved-for-embedding' : 'pending-review'),
          lifeDomain: result.lifeDomain,
          sourceKind: result.sourceKind,
          canUseInAnswer: reviewed,
          rankScore: (reviewed ? 70 : 35) + parseRetrievalScore(result.score, 0),
          confidence: reviewed ? 'reviewed-source' : 'candidate-needs-review',
          why: [
            reviewed ? 'Chunk has been approved for retrieval use' : 'Chunk matched, but still needs human review',
            result.eligibleForVector ? 'Eligible for vector indexing' : '',
            result.privacyLevel ? `Privacy: ${result.privacyLevel}` : '',
          ],
          textPreview: result.textPreview || result.reviewNote || '',
        }),
      );
    });
  }

  if (Array.isArray(graphSearch.results)) {
    graphSearch.results.forEach((result, index) => {
      entries.push(
        normalizeRetrievalRankingEntry({
          id: `rank:graph:${result.id || result.pageId || index}`,
          layer: 'Neo4j/source graph',
          sourceTitle: result.title || result.fileName || `Graph match ${index + 1}`,
          sourceDocumentId: result.id,
          pageId: result.pageId,
          evidenceState: 'context-only',
          reviewState: result.reviewStatus || 'graph-context',
          lifeDomain: result.lifeDomain,
          sourceKind: result.sourceKind,
          canUseInAnswer: false,
          rankScore: 15 + parseRetrievalScore(result.score, 0),
          confidence: 'context-only',
          why: [
            'Graph/source index match',
            'Useful for navigation and review',
            'Needs reviewed chunk evidence before answer synthesis',
            ...(Array.isArray(result.matchReasons) ? result.matchReasons.slice(0, 2) : []),
          ],
          textPreview: result.textPreview || '',
        }),
      );
    });
  }

  const seen = new Set();
  const results = entries
    .filter((entry) => {
      const key = compactStringArray([entry.objectId, entry.chunkId, entry.sourceDocumentId, entry.pageId, entry.layer], 5).join(':') || entry.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      if (left.canUseInAnswer !== right.canUseInAnswer) return left.canUseInAnswer ? -1 : 1;
      return right.rankScore - left.rankScore;
    })
    .slice(0, resultLimit);
  const reviewedCount = results.filter((result) => result.canUseInAnswer).length;
  const candidateCount = results.filter((result) => result.evidenceState === 'candidate').length;
  const contextCount = results.filter((result) => result.evidenceState === 'context-only').length;

  return {
    status: results.length ? 'ready' : 'empty',
    strategy: 'reviewed evidence first, candidates second, graph context last',
    query: normalizedQuery,
    resultCount: results.length,
    reviewedCount,
    candidateCount,
    contextCount,
    results,
    message: reviewedCount
      ? `${reviewedCount} reviewed evidence item${reviewedCount === 1 ? '' : 's'} can support the draft. ${candidateCount + contextCount} item${candidateCount + contextCount === 1 ? '' : 's'} remain review/context only.`
      : results.length
        ? 'All matches are candidate or graph-context only. Review chunks before using them as wiki evidence.'
        : 'No ranked retrieval evidence is available for this query yet.',
  };
};

const normalizeDraftCitationKey = (value = {}) =>
  compactStringArray([value.objectId, value.chunkId, value.sourceDocumentId, value.pageId, value.id], 5).join(':');

const buildRetrievalDraftCitation = (result = {}, evidenceState = 'candidate') => {
  const sourceTitle = result.sourceTitle || result.title || result.fileName || result.sourceDocumentId || 'Case Wiki source';
  const chunkId = result.chunkId || '';
  const sourceDocumentId = result.sourceDocumentId || result.id || '';
  const citationId =
    result.objectId ||
    chunkId ||
    sourceDocumentId ||
    result.pageId ||
    `citation:${sourceTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  return {
    id: citationId,
    label: sourceTitle,
    sourceTitle,
    sourceDocumentId,
    pageId: result.pageId || result.wikiPageId || (sourceDocumentId ? `ingest:${sourceDocumentId}` : ''),
    chunkId,
    objectId: result.objectId || '',
    status: result.status || result.reviewStatus || (evidenceState === 'reviewed' ? 'approved-for-embedding' : 'pending-review'),
    evidenceState,
    lifeDomain: result.lifeDomain || '',
    sourceKind: result.sourceKind || '',
    textPreview: truncateRetrievalText(result.textPreview || result.chunkSummary || result.chunkText || result.explainScore || '', 220),
    score: result.score || '',
  };
};

const uniqueDraftCitations = (citations = [], limit = 6) => {
  const seen = new Set();
  return citations
    .filter((citation) => {
      const key = normalizeDraftCitationKey(citation);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
};

const buildReviewedCitationModelSynthesisPacket = ({
  normalizedQuery = '',
  synthesis = {},
  citations = [],
  candidateCitations = [],
  topGraphTitles = [],
} = {}) => {
  const allowedCitationIds = compactStringArray(synthesis.usedCitationIds || [], 30);
  const allowedCitationIdSet = new Set(allowedCitationIds);
  const citationContext = citations
    .filter((citation) => allowedCitationIdSet.has(citation.id))
    .map((citation, index) => ({
      marker: `[${index + 1}]`,
      id: citation.id,
      sourceTitle: citation.sourceTitle,
      sourceDocumentId: citation.sourceDocumentId,
      pageId: citation.pageId,
      chunkId: citation.chunkId,
      objectId: citation.objectId,
      evidenceState: citation.evidenceState,
      textPreview: truncateRetrievalText(citation.textPreview || citation.sourceTitle || citation.id, 480),
    }));
  const sectionPlan = (Array.isArray(synthesis.sections) ? synthesis.sections : []).map((section) => ({
    heading: asString(section.heading, 'Wiki section'),
    requiredCitationIds: compactStringArray(section.citationIds || [], 20),
  }));
  const excludedCandidateCitationIds = compactStringArray(candidateCitations.map((citation) => citation.id), 30);
  const excludedGraphContextTitles = compactStringArray(topGraphTitles, 10);
  const isReady = synthesis.status === 'ready' && citationContext.length > 0 && sectionPlan.length > 0;
  const guardrails = [
    'Use only reviewed citation context listed in this packet.',
    'Do not use candidate citations, graph-only context, or memory outside the packet as article evidence.',
    'Every generated paragraph must carry at least one reviewed citation id.',
    'If the citation context does not support a claim, write a gap instead of inventing prose.',
  ];

  return {
    status: isReady ? 'ready' : 'blocked',
    mode: 'reviewed-citation-model-packet',
    modelCallStatus: 'not-started',
    title: `Model synthesis packet: ${normalizedQuery || 'Case Wiki topic'}`,
    blockedReason: isReady
      ? ''
      : 'Model-backed prose is blocked until reviewed citation context and cited sections are available.',
    guardrails,
    allowedCitationIds,
    excludedCandidateCitationIds,
    excludedGraphContextTitles,
    citationContext,
    sectionPlan,
    promptMessages: isReady
      ? [
          {
            role: 'system',
            content:
              'You are drafting a Case Wiki article section. Use only the reviewed citations provided by the user. Do not use candidate evidence, graph-only context, or outside knowledge as evidence.',
          },
          {
            role: 'user',
            content: [
              `Topic: ${normalizedQuery}`,
              `Allowed citation ids: ${allowedCitationIds.join(', ')}`,
              `Section plan: ${sectionPlan
                .map((section) => `${section.heading} (${section.requiredCitationIds.join(', ')})`)
                .join('; ')}`,
              'Return concise wiki prose with citationIds for every section. Mark unsupported material as gaps.',
            ].join('\n'),
          },
        ]
      : [],
    outputContract: {
      format: 'wiki-sections-with-citationIds',
      requiredChecks: [
        'all-section-citation-ids-are-reviewed',
        'no-candidate-citation-ids-used',
        'no-graph-context-treated-as-evidence',
        'unsupported-claims-return-as-gaps',
      ],
    },
  };
};

const buildReviewedCitationSynthesis = ({
  normalizedQuery = '',
  citations = [],
  candidateCitations = [],
  outline = [],
  topGraphTitles = [],
} = {}) => {
  const reviewedCitationIds = new Set(citations.map((citation) => citation.id).filter(Boolean));
  const reviewedTitles = compactStringArray(citations.map((citation) => citation.sourceTitle), 5);
  const citedSections = (Array.isArray(outline) ? outline : []).filter((section) => {
    const citationIds = Array.isArray(section.citationIds) ? section.citationIds : [];
    return citationIds.length && citationIds.every((id) => reviewedCitationIds.has(id));
  });
  const blockedSections = (Array.isArray(outline) ? outline : [])
    .filter((section) => !citedSections.includes(section))
    .map((section) => ({
      heading: asString(section.heading, 'Uncited section'),
      reviewState: asString(section.reviewState, 'needs-human-review'),
      reason: section.citationIds?.length
        ? 'Contains candidate or unknown citation ids, so it cannot be synthesized yet.'
        : 'No reviewed citations are attached to this section.',
    }));
  const sourceDocumentIds = compactStringArray(citations.map((citation) => citation.sourceDocumentId), 20);
  const citationCoverage = {
    reviewedCitationCount: citations.length,
    candidateCitationCount: candidateCitations.length,
    citedSectionCount: citedSections.length,
    blockedSectionCount: blockedSections.length,
    reviewedSourceCount: sourceDocumentIds.length,
  };
  const coverageChecks = [
    {
      id: 'reviewed-citations',
      label: 'Reviewed citations available',
      status: citations.length ? 'pass' : 'blocked',
      detail: citations.length
        ? `${citations.length} reviewed citation${citations.length === 1 ? '' : 's'} can support synthesis.`
        : 'No reviewed citations are available, so synthesis stays blocked.',
    },
    {
      id: 'section-citation-coverage',
      label: 'Every synthesized section is cited',
      status: citedSections.length ? 'pass' : 'blocked',
      detail: citedSections.length
        ? `${citedSections.length} section${citedSections.length === 1 ? '' : 's'} have reviewed citation coverage.`
        : 'No article sections have reviewed citation coverage yet.',
    },
    {
      id: 'candidate-exclusion',
      label: 'Candidate evidence excluded',
      status: 'pass',
      detail: candidateCitations.length
        ? `${candidateCitations.length} candidate citation${candidateCitations.length === 1 ? '' : 's'} were kept out of synthesis.`
        : 'No candidate citations needed exclusion in this pass.',
    },
    {
      id: 'graph-context-boundary',
      label: 'Graph context is not treated as evidence',
      status: 'pass',
      detail: topGraphTitles.length
        ? `Graph-only matches such as ${topGraphTitles.slice(0, 3).join(', ')} remain context until reviewed chunks cite them.`
        : 'No graph-only context was added as article evidence.',
    },
  ];

  if (!citations.length) {
    const blockedSynthesis = {
      status: 'blocked',
      mode: 'reviewed-citation-constrained',
      title: `Citation-constrained synthesis: ${normalizedQuery || 'Case Wiki topic'}`,
      lead: '',
      sections: [],
      blockedSections,
      citationCoverage,
      coverageChecks,
      usedCitationIds: [],
      policy:
        'Synthesis is blocked until reviewed citations exist. Candidate chunks and graph-only clues cannot become article prose.',
    };
    return {
      ...blockedSynthesis,
      modelSynthesisPacket: buildReviewedCitationModelSynthesisPacket({
        normalizedQuery,
        synthesis: blockedSynthesis,
        citations,
        candidateCitations,
        topGraphTitles,
      }),
    };
  }

  const reviewedSynthesis = {
    status: citedSections.length ? 'ready' : 'blocked',
    mode: 'reviewed-citation-constrained',
    title: `Citation-constrained synthesis: ${normalizedQuery}`,
    lead: `${normalizedQuery} is currently supported by reviewed Case Wiki citations from ${reviewedTitles.join(', ') || 'the reviewed citation ledger'}. This synthesis uses only reviewed citation ids and keeps candidate material outside the article body.`,
    sections: citedSections.map((section) => ({
      heading: section.heading,
      text: section.text,
      citationIds: section.citationIds,
      reviewState: 'synthesized-from-reviewed-citations',
    })),
    blockedSections,
    citationCoverage,
    coverageChecks,
    usedCitationIds: compactStringArray(citedSections.flatMap((section) => section.citationIds || []), 20),
    policy:
      'Only reviewed citation ids are allowed into this synthesis. Candidate chunks, graph-only matches, and uncited claims stay out until separately reviewed.',
  };
  return {
    ...reviewedSynthesis,
    modelSynthesisPacket: buildReviewedCitationModelSynthesisPacket({
      normalizedQuery,
      synthesis: reviewedSynthesis,
      citations,
      candidateCitations,
      topGraphTitles,
    }),
  };
};

const buildPromotionCitationCoverageDiff = ({
  promotionStatus = '',
  sections = [],
  citationLedger = [],
  candidateCitations = [],
  topGraphTitles = [],
  synthesis = {},
} = {}) => {
  const reviewedCitationIds = new Set(citationLedger.map((citation) => citation.id).filter(Boolean));
  const candidateCitationIds = new Set(candidateCitations.map((citation) => citation.id).filter(Boolean));
  const normalizedSections = Array.isArray(sections) ? sections : [];
  const sectionDiffs = normalizedSections.map((section) => {
    const sectionCitationIds = compactStringArray(section.citationIds || [], 30);
    const reviewedIds = sectionCitationIds.filter((id) => reviewedCitationIds.has(id));
    const candidateIds = sectionCitationIds.filter((id) => candidateCitationIds.has(id));
    const unknownIds = sectionCitationIds.filter((id) => !reviewedCitationIds.has(id) && !candidateCitationIds.has(id));
    const reviewState = asString(section.reviewState, 'reviewed-evidence');
    const isExcluded = ['needs-human-review', 'context-only', 'action-required'].includes(reviewState);
    let status = 'promotable';
    let reason = 'Every citation in this section is reviewed and available in the promotion citation ledger.';

    if (isExcluded) {
      status = reviewState === 'context-only' ? 'excluded-context-only' : 'excluded-needs-review';
      reason =
        reviewState === 'context-only'
          ? 'This section can guide research, but graph context is not published as cited article prose.'
          : 'This section stays out of the promoted article until its evidence is reviewed.';
    } else if (!reviewedCitationIds.size) {
      status = 'blocked-no-reviewed-citations';
      reason = 'Promotion needs at least one reviewed citation before any section can publish.';
    } else if (!sectionCitationIds.length) {
      status = 'blocked-uncited-section';
      reason = 'Promoted sections need at least one reviewed citation.';
    } else if (candidateIds.length || unknownIds.length) {
      status = 'blocked-unreviewed-citations';
      reason = 'This section mixes reviewed evidence with candidate or unknown citation ids.';
    }

    return {
      heading: asString(section.heading, 'Untitled section'),
      reviewState,
      status,
      reason,
      willPublish: status === 'promotable',
      reviewedCitationIds: reviewedIds,
      candidateCitationIds: candidateIds,
      unknownCitationIds: unknownIds,
      citationCount: sectionCitationIds.length,
    };
  });
  const promotableSections = sectionDiffs.filter((section) => section.willPublish);
  const blockedSections = sectionDiffs.filter((section) => section.status.startsWith('blocked'));
  const excludedSections = sectionDiffs.filter((section) => section.status.startsWith('excluded'));
  const synthesisCitationIds = compactStringArray(synthesis.usedCitationIds || [], 30);
  const promotionCitationIds = compactStringArray(citationLedger.map((citation) => citation.id), 30);
  const missingFromPromotionCitationIds = synthesisCitationIds.filter((id) => !reviewedCitationIds.has(id));
  const extraPromotionCitationIds = promotionCitationIds.filter((id) => !synthesisCitationIds.includes(id));
  const status =
    promotionStatus === 'ready-to-promote' && promotableSections.length && !blockedSections.length ? 'pass' : 'blocked';

  return {
    status,
    mode: 'promotion-citation-coverage-diff',
    summary:
      status === 'pass'
        ? `${promotableSections.length} section${promotableSections.length === 1 ? '' : 's'} can be promoted with reviewed citations only. ${excludedSections.length} section${excludedSections.length === 1 ? '' : 's'} stay out for review or context.`
        : blockedSections.length
          ? `${blockedSections.length} promotion section${blockedSections.length === 1 ? '' : 's'} need reviewed citations before publishing.`
          : 'Promotion is blocked until reviewed citations are available.',
    promotableSectionCount: promotableSections.length,
    blockedSectionCount: blockedSections.length,
    excludedSectionCount: excludedSections.length,
    reviewedCitationCount: promotionCitationIds.length,
    candidateCitationCount: candidateCitations.length,
    graphContextCount: topGraphTitles.length,
    sectionDiffs,
    excludedEvidence: {
      candidateCitationIds: compactStringArray(candidateCitations.map((citation) => citation.id), 30),
      graphContextTitles: compactStringArray(topGraphTitles, 10),
    },
    synthesisComparison: {
      status: missingFromPromotionCitationIds.length ? 'missing-synthesis-citations' : 'aligned',
      usedCitationIds: synthesisCitationIds,
      promotionCitationIds,
      missingFromPromotionCitationIds,
      extraPromotionCitationIds,
    },
  };
};

const buildRetrievalPromotionPreview = ({
  normalizedQuery = '',
  citations = [],
  candidateCitations = [],
  topGraphTitles = [],
  synthesis = {},
} = {}) => {
  const safeTitle = normalizedQuery || 'Case Wiki article';
  const citedTitles = compactStringArray(citations.map((citation) => citation.sourceTitle), 5);
  const candidateTitles = compactStringArray(candidateCitations.map((citation) => citation.sourceTitle), 5);
  const citationLedger = citations.map((citation, index) => ({
    marker: `[${index + 1}]`,
    id: citation.id,
    sourceTitle: citation.sourceTitle,
    sourceDocumentId: citation.sourceDocumentId,
    pageId: citation.pageId,
    chunkId: citation.chunkId,
    objectId: citation.objectId,
    evidenceState: citation.evidenceState,
    textPreview: citation.textPreview,
  }));

  if (!citations.length) {
    const blockedSections = [
      {
        heading: 'Promotion blocker',
        text: candidateTitles.length
          ? `Review candidate chunks from ${candidateTitles.join(', ')} before promoting this topic into a permanent wiki section.`
          : 'No candidate citation can be promoted yet.',
        citationIds: candidateCitations.map((citation) => citation.id),
        reviewState: 'needs-human-review',
      },
      {
        heading: 'Graph clues',
        text: topGraphTitles.length
          ? `The graph can still guide research through ${topGraphTitles.join(', ')}, but graph hits alone are context, not cited article material.`
          : 'No graph clue is available for this topic yet.',
        citationIds: [],
        reviewState: 'context-only',
      },
    ];
    return {
      status: candidateCitations.length || topGraphTitles.length ? 'blocked-needs-reviewed-citations' : 'blocked-no-evidence',
      targetPageTitle: safeTitle,
      publishMode: 'preview-only',
      lead: candidateCitations.length
        ? `Promotion is blocked until "${safeTitle}" has at least one reviewed source chunk. Candidate chunks are visible for review, but they are not article evidence yet.`
        : `Promotion is blocked because "${safeTitle}" has no source-backed evidence in this retrieval pass.`,
      sections: blockedSections,
      citationLedger: [],
      citationCoverageDiff: buildPromotionCitationCoverageDiff({
        promotionStatus: 'blocked-needs-reviewed-citations',
        sections: blockedSections,
        citationLedger: [],
        candidateCitations,
        topGraphTitles,
        synthesis,
      }),
      blockedReasons: ['No reviewed citations are available for promotion.'],
      nextActions: ['Open candidate evidence', 'Approve or reject matching chunks', 'Refresh retrieval before promotion'],
    };
  }

  const promotableSections = [
    {
      heading: 'Lead',
      text: `${safeTitle} should be introduced as a reviewed topic supported by ${citations.length} approved citation${citations.length === 1 ? '' : 's'}.`,
      citationIds: citations.slice(0, 3).map((citation) => citation.id),
      reviewState: 'reviewed-evidence',
    },
    {
      heading: 'Reviewed evidence',
      text: citations
        .slice(0, 3)
        .map((citation, index) => `${index + 1}. ${citation.textPreview || citation.sourceTitle || citation.id}`)
        .join('\n'),
      citationIds: citations.slice(0, 3).map((citation) => citation.id),
      reviewState: 'citation-ledger',
    },
    {
      heading: 'Gaps before publication',
      text: candidateCitations.length
        ? `Candidate sources such as ${candidateTitles.join(', ')} are still pending review and should stay out of the promoted article until approved.`
        : 'No pending candidate citation gaps were found in this retrieval pass.',
      citationIds: candidateCitations.map((citation) => citation.id),
      reviewState: candidateCitations.length ? 'needs-human-review' : 'reviewed-evidence',
    },
  ];

  return {
    status: 'ready-to-promote',
    targetPageTitle: safeTitle,
    publishMode: 'preview-only',
    lead: `${safeTitle} is a reviewed Case Wiki topic currently grounded in ${citedTitles.join(', ')}. This promotion preview is deterministic and citation-first; it has not been published to the permanent wiki page yet.`,
    sections: promotableSections,
    citationLedger,
    citationCoverageDiff: buildPromotionCitationCoverageDiff({
      promotionStatus: 'ready-to-promote',
      sections: promotableSections,
      citationLedger,
      candidateCitations,
      topGraphTitles,
      synthesis,
    }),
    blockedReasons: [],
    nextActions: ['Review citation ledger', 'Confirm section wording', 'Promote into a permanent wiki section when ready'],
  };
};

const normalizePromotionSection = (section = {}, index = 0) => {
  const heading = asString(section.heading, index === 0 ? 'Lead' : `Section ${index + 1}`);
  const text = asString(section.text);
  if (!heading || !text) return null;
  return {
    id: `section-${slugifyTextForId(heading) || index + 1}`,
    heading,
    text: truncateRetrievalText(text, 1400),
    citationIds: compactStringArray(section.citationIds || [], 20),
    reviewState: asString(section.reviewState, 'reviewed-evidence'),
  };
};

const normalizePromotionCitation = (citation = {}, index = 0) => {
  const id = asString(citation.id || citation.objectId || citation.chunkId || citation.sourceDocumentId);
  const sourceTitle = asString(citation.sourceTitle || citation.label || citation.sourceDocumentId || `Citation ${index + 1}`);
  if (!id || !sourceTitle) return null;
  return {
    marker: asString(citation.marker, `[${index + 1}]`),
    id,
    sourceTitle,
    sourceDocumentId: asString(citation.sourceDocumentId),
    pageId: asString(citation.pageId || (citation.sourceDocumentId ? `ingest:${citation.sourceDocumentId}` : '')),
    chunkId: asString(citation.chunkId),
    objectId: asString(citation.objectId),
    evidenceState: asString(citation.evidenceState, 'reviewed'),
    textPreview: truncateRetrievalText(citation.textPreview || citation.chunkSummary || citation.chunkText || '', 520),
  };
};

const buildReviewedCitationModelDraftRecord = ({
  query = '',
  answerDraft = {},
  modelSynthesisPacket = {},
  actor = '',
} = {}) => {
  const packet =
    modelSynthesisPacket && typeof modelSynthesisPacket === 'object' && !Array.isArray(modelSynthesisPacket)
      ? modelSynthesisPacket
      : answerDraft?.synthesis?.modelSynthesisPacket || {};
  const normalizedQuery = normalizeRetrievalQuery(
    query ||
      answerDraft?.title?.replace(/^Draft article:\s*/i, '') ||
      packet.title?.replace(/^Model synthesis packet:\s*/i, '') ||
      '',
  );
  const title = normalizedQuery || 'Case Wiki model draft';
  const allowedCitationIds = compactStringArray(packet.allowedCitationIds || [], 30);
  const allowedCitationIdSet = new Set(allowedCitationIds);
  const excludedCandidateCitationIds = compactStringArray(packet.excludedCandidateCitationIds || [], 30);
  const candidateOverlapIds = excludedCandidateCitationIds.filter((id) => allowedCitationIdSet.has(id));
  const citationLedger = (Array.isArray(packet.citationContext) ? packet.citationContext : [])
    .map(normalizePromotionCitation)
    .filter(Boolean)
    .filter((citation) => allowedCitationIdSet.has(citation.id));
  const citationContextIds = new Set(citationLedger.map((citation) => citation.id));
  const missingCitationContextIds = allowedCitationIds.filter((id) => !citationContextIds.has(id));
  const rawSectionPlan = Array.isArray(packet.sectionPlan) ? packet.sectionPlan : [];
  const sections = rawSectionPlan
    .map((section, index) => {
      const heading = asString(section.heading, index === 0 ? 'Lead' : `Section ${index + 1}`);
      const citationIds = compactStringArray(section.requiredCitationIds || section.citationIds || [], 20).filter((id) =>
        allowedCitationIdSet.has(id),
      );
      if (!heading) return null;
      return {
        id: `section-${slugifyTextForId(heading) || index + 1}`,
        heading,
        text: truncateRetrievalText(
          `Ready for model-assisted drafting from reviewed citation id${citationIds.length === 1 ? '' : 's'} ${citationIds.join(
            ', ',
          )}. Unsupported claims must remain gaps until another chunk is reviewed.`,
          1400,
        ),
        citationIds,
        reviewState: 'model-draft-section',
      };
    })
    .filter(Boolean);
  const uncitedSections = sections.filter((section) => !section.citationIds.length);
  const unknownSectionCitationIds = compactStringArray(
    rawSectionPlan.flatMap((section) => section.requiredCitationIds || section.citationIds || []).filter((id) => !allowedCitationIdSet.has(id)),
    30,
  );

  if (packet.mode !== 'reviewed-citation-model-packet') {
    return {
      error: 'Model draft needs a reviewed citation model packet.',
      blockedReasons: ['Use the packet produced by citation-constrained retrieval synthesis.'],
    };
  }

  if (packet.status !== 'ready') {
    return {
      error: 'Model draft is blocked until the packet is ready.',
      blockedReasons: [packet.blockedReason || 'Reviewed citation context and cited sections are required before drafting.'],
    };
  }

  if (!allowedCitationIds.length || !citationLedger.length) {
    return {
      error: 'Model draft needs reviewed citation context.',
      blockedReasons: ['At least one allowed reviewed citation id and matching citation context record are required.'],
    };
  }

  if (candidateOverlapIds.length) {
    return {
      error: 'Model draft cannot use candidate evidence.',
      blockedReasons: [`Candidate citation ids appeared in the allowed set: ${candidateOverlapIds.join(', ')}`],
    };
  }

  if (missingCitationContextIds.length) {
    return {
      error: 'Model draft citation context is incomplete.',
      blockedReasons: [`Allowed citation ids missing from reviewed context: ${missingCitationContextIds.join(', ')}`],
    };
  }

  if (!sections.length || uncitedSections.length || unknownSectionCitationIds.length) {
    return {
      error: 'Model draft needs cited section plans.',
      blockedReasons: [
        uncitedSections.length
          ? `${uncitedSections.length} planned section${uncitedSections.length === 1 ? '' : 's'} had no reviewed citation ids.`
          : '',
        unknownSectionCitationIds.length
          ? `Section plan referenced citation ids outside the allowed packet: ${unknownSectionCitationIds.join(', ')}`
          : '',
        !sections.length ? 'No model draft sections were available in the packet.' : '',
      ].filter(Boolean),
    };
  }

  const citationCoverageDiff = buildPromotionCitationCoverageDiff({
    promotionStatus: 'ready-to-promote',
    sections,
    citationLedger,
    candidateCitations: Array.isArray(answerDraft?.candidateCitations) ? answerDraft.candidateCitations : [],
    topGraphTitles: packet.excludedGraphContextTitles || [],
    synthesis: answerDraft?.synthesis || {},
  });

  if (citationCoverageDiff.status !== 'pass') {
    return {
      error: 'Model draft coverage check failed.',
      blockedReasons: citationCoverageDiff.sectionDiffs?.length
        ? citationCoverageDiff.sectionDiffs
            .filter((section) => section.status?.startsWith('blocked'))
            .map((section) => `${section.heading}: ${section.reason}`)
        : ['Every model draft section needs reviewed citations before it can be reviewed.'],
      citationCoverageDiff,
    };
  }

  const sourceDocumentIds = compactStringArray(citationLedger.map((citation) => citation.sourceDocumentId), 50);
  const slug = slugifyTextForId(title) || 'case-wiki-model-draft';
  const packetHash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        title,
        allowedCitationIds,
        sections: sections.map((section) => [section.heading, section.citationIds]),
        citationLedger: citationLedger.map((citation) => normalizeDraftCitationKey(citation)),
      }),
    )
    .digest('hex')
    .slice(0, 16);
  const now = new Date().toISOString();

  return {
    id: `model-draft:${slug}:${packetHash}`,
    pageId: `model-draft:${slug}`,
    title: `Model draft: ${title}`,
    query: normalizedQuery,
    status: 'draft-ready-for-review',
    mode: 'disabled-model-call-reviewed-citations',
    modelCallStatus: 'disabled',
    externalModelCallMade: false,
    lead: `A model-writing packet is prepared for "${title}" from reviewed citation context only. The actual model prose step remains disabled until explicitly enabled and reviewed.`,
    sections,
    citationLedger,
    sourceDocumentIds,
    allowedCitationIds,
    excludedCandidateCitationIds,
    excludedGraphContextTitles: compactStringArray(packet.excludedGraphContextTitles || [], 10),
    guardrails: Array.isArray(packet.guardrails) ? packet.guardrails : [],
    promptMessages: Array.isArray(packet.promptMessages) ? packet.promptMessages : [],
    outputContract: packet.outputContract || null,
    citationCoverageDiff,
    requiresHumanPromotionConfirmation: true,
    promotionPolicy:
      'This draft is reviewable preparation only. A human still has to confirm promotion through the citation-gated promotion route before it becomes a permanent wiki section.',
    sourcePolicy:
      'Prepared from reviewed citation ids only. Candidate chunks, graph-only context, external memory, vector writes, file moves, and client/case attachments are excluded.',
    createdAt: now,
    updatedAt: now,
    createdBy: asString(actor, 'Current worker'),
    reviewState: 'awaiting-human-review',
  };
};

const CASE_WIKI_LOCAL_MODEL_DRAFT_ADAPTER_MODE = 'local-citation-contract-rehearsal';
const CASE_WIKI_EXTERNAL_MODEL_ADAPTER_READINESS_MODE = 'external-model-adapter-readiness-preview';
const CASE_WIKI_EXTERNAL_MODEL_ADAPTER_CONSENT_MODE = 'external-model-adapter-consent-packet';
const CASE_WIKI_EXTERNAL_MODEL_ADAPTER_REQUEST_REHEARSAL_MODE = 'external-model-adapter-request-rehearsal';
const CASE_WIKI_EXTERNAL_MODEL_ADAPTER_OUTPUT_VALIDATION_MODE = 'external-model-adapter-output-validation';
const CASE_WIKI_RETURNED_OUTPUT_EDITORIAL_REVIEW_MODE = 'returned-output-editorial-review-packet';

const buildModelDraftLocalExecutionRecord = ({
  modelDraftRecord = {},
  adapterMode = CASE_WIKI_LOCAL_MODEL_DRAFT_ADAPTER_MODE,
  actor = '',
} = {}) => {
  if (!modelDraftRecord || typeof modelDraftRecord !== 'object' || Array.isArray(modelDraftRecord)) {
    return {
      error: 'Model draft execution needs a saved model draft packet.',
      blockedReasons: ['Open a saved model draft page before running the adapter rehearsal.'],
    };
  }

  if (adapterMode !== CASE_WIKI_LOCAL_MODEL_DRAFT_ADAPTER_MODE) {
    return {
      error: 'External model execution is disabled for this adapter.',
      blockedReasons: [
        'Only the local citation-contract rehearsal is available. No source text is transmitted outside Street Voices.',
      ],
      policy:
        'External model calls require a separate transmission consent path, adapter configuration, and human confirmation before they can run.',
    };
  }

  const draftId = asString(modelDraftRecord.id || modelDraftRecord.pageId);
  const draftTitle = asString(modelDraftRecord.title, 'Model draft');
  const query = normalizeRetrievalQuery(modelDraftRecord.query || draftTitle.replace(/^Model draft:\s*/i, ''));
  const citationLedger = (Array.isArray(modelDraftRecord.citationLedger) ? modelDraftRecord.citationLedger : [])
    .map(normalizePromotionCitation)
    .filter(Boolean);
  const ledgerCitationIds = new Set(citationLedger.map((citation) => citation.id).filter(Boolean));
  const allowedCitationIds = compactStringArray(
    modelDraftRecord.allowedCitationIds?.length
      ? modelDraftRecord.allowedCitationIds
      : citationLedger.map((citation) => citation.id),
    60,
  );
  const allowedCitationIdSet = new Set(allowedCitationIds);
  const excludedCandidateCitationIds = compactStringArray(modelDraftRecord.excludedCandidateCitationIds || [], 60);
  const excludedCandidateCitationIdSet = new Set(excludedCandidateCitationIds);
  const rawSections = Array.isArray(modelDraftRecord.sections) ? modelDraftRecord.sections : [];
  const sections = rawSections
    .map((section, index) => {
      const normalized = normalizePromotionSection(section, index);
      if (!normalized) return null;
      return {
        ...normalized,
        text: truncateRetrievalText(
          normalized.text ||
            `Local adapter rehearsal confirmed "${normalized.heading}" can only be drafted from reviewed citation ids.`,
          1600,
        ),
        reviewState: 'model-adapter-local-output',
      };
    })
    .filter(Boolean);
  const sectionCitationIds = compactStringArray(
    sections.flatMap((section) => section.citationIds || []),
    100,
  );
  const uncitedSections = sections.filter((section) => !section.citationIds?.length);
  const unknownSectionCitationIds = sectionCitationIds.filter(
    (id) => !allowedCitationIdSet.has(id) || !ledgerCitationIds.has(id),
  );
  const candidateSectionCitationIds = sectionCitationIds.filter((id) => excludedCandidateCitationIdSet.has(id));
  const missingAllowedCitationContextIds = allowedCitationIds.filter((id) => !ledgerCitationIds.has(id));

  if (!draftId) {
    return {
      error: 'Model draft execution needs a saved draft id.',
      blockedReasons: ['The adapter can only run against a persisted model draft packet.'],
    };
  }

  if (!citationLedger.length || !allowedCitationIds.length) {
    return {
      error: 'Model draft execution needs reviewed citation context.',
      blockedReasons: ['At least one reviewed citation ledger item is required before any adapter rehearsal.'],
    };
  }

  if (!sections.length || uncitedSections.length || unknownSectionCitationIds.length || candidateSectionCitationIds.length) {
    return {
      error: 'Model draft execution failed citation contract validation.',
      blockedReasons: [
        !sections.length ? 'No draft sections were available to rehearse.' : '',
        uncitedSections.length
          ? `${uncitedSections.length} section${uncitedSections.length === 1 ? '' : 's'} had no citation ids.`
          : '',
        unknownSectionCitationIds.length
          ? `Section output referenced citation ids outside the reviewed ledger: ${compactStringArray(
              unknownSectionCitationIds,
              20,
            ).join(', ')}`
          : '',
        candidateSectionCitationIds.length
          ? `Section output attempted to use candidate citation ids: ${compactStringArray(
              candidateSectionCitationIds,
              20,
            ).join(', ')}`
          : '',
      ].filter(Boolean),
    };
  }

  if (missingAllowedCitationContextIds.length) {
    return {
      error: 'Model draft execution has incomplete reviewed citation context.',
      blockedReasons: [
        `Allowed citation ids missing from the reviewed ledger: ${compactStringArray(missingAllowedCitationContextIds, 20).join(', ')}`,
      ],
    };
  }

  const citationCoverageDiff = buildPromotionCitationCoverageDiff({
    promotionStatus: 'ready-to-promote',
    sections,
    citationLedger,
    candidateCitations: excludedCandidateCitationIds.map((id) => ({
      id,
      sourceTitle: `Candidate citation ${id}`,
      evidenceState: 'candidate',
    })),
    topGraphTitles: compactStringArray(modelDraftRecord.excludedGraphContextTitles || [], 10),
    synthesis: {
      usedCitationIds: compactStringArray(sectionCitationIds, 60),
    },
  });

  if (citationCoverageDiff.status !== 'pass') {
    return {
      error: 'Model draft execution coverage check failed.',
      blockedReasons: citationCoverageDiff.sectionDiffs?.length
        ? citationCoverageDiff.sectionDiffs
            .filter((section) => section.status?.startsWith('blocked'))
            .map((section) => `${section.heading}: ${section.reason}`)
        : ['The adapter output did not satisfy the reviewed citation coverage contract.'],
      citationCoverageDiff,
    };
  }

  const executionHash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        draftId,
        adapterMode,
        sections: sections.map((section) => [section.heading, section.citationIds]),
        citationLedger: citationLedger.map((citation) => normalizeDraftCitationKey(citation)),
      }),
    )
    .digest('hex')
    .slice(0, 16);
  const now = new Date().toISOString();
  const slug = slugifyTextForId(draftId || draftTitle) || 'model-draft';

  return {
    id: `model-execution:${slug}:${executionHash}`,
    pageId: `model-execution:${slug}`,
    modelDraftId: draftId,
    modelDraftPageId: asString(modelDraftRecord.pageId),
    title: `Local adapter check: ${draftTitle.replace(/^Model draft:\s*/i, '')}`,
    query,
    status: 'passed-local-contract',
    adapterMode: CASE_WIKI_LOCAL_MODEL_DRAFT_ADAPTER_MODE,
    modelCallStatus: 'local-rehearsal-only',
    externalModelCallMade: false,
    lead: `The saved model draft packet for "${query || draftTitle}" passed the local citation contract. No external model call was made.`,
    sections,
    citationLedger,
    allowedCitationIds,
    excludedCandidateCitationIds,
    citationCoverageDiff,
    requiresHumanPromotionConfirmation: true,
    outputContractStatus: 'all-output-citation-ids-reviewed',
    policy:
      'Local rehearsal only: no external model call, source text transmission, vector write, Neo4j write, promotion, file move, or client/case attachment happened.',
    sourcePolicy:
      'The adapter consumed the saved reviewed model draft packet and allowed citation ids only. Candidate evidence stayed excluded.',
    createdAt: now,
    updatedAt: now,
    createdBy: asString(actor, 'Current worker'),
    reviewState: 'awaiting-human-promotion-review',
  };
};

const buildModelDraftExternalAdapterReadinessPacket = ({
  modelDraftRecord = {},
  modelDraftExecutionRecords = [],
  provider = '',
  model = '',
} = {}) => {
  if (!modelDraftRecord || typeof modelDraftRecord !== 'object' || Array.isArray(modelDraftRecord)) {
    return {
      error: 'External adapter readiness needs a saved model draft packet.',
      blockedReasons: ['Open a saved model draft page before reviewing external adapter readiness.'],
    };
  }

  const draftId = asString(modelDraftRecord.id || modelDraftRecord.pageId);
  const draftTitle = asString(modelDraftRecord.title, 'Model draft');
  const citationLedger = (Array.isArray(modelDraftRecord.citationLedger) ? modelDraftRecord.citationLedger : [])
    .map(normalizePromotionCitation)
    .filter(Boolean);
  const allowedCitationIds = compactStringArray(
    modelDraftRecord.allowedCitationIds?.length
      ? modelDraftRecord.allowedCitationIds
      : citationLedger.map((citation) => citation.id),
    60,
  );
  const sectionCount = Array.isArray(modelDraftRecord.sections) ? modelDraftRecord.sections.length : 0;
  const promptMessageCount = Array.isArray(modelDraftRecord.promptMessages) ? modelDraftRecord.promptMessages.length : 0;
  const selectedProvider = asString(provider) || 'not-selected';
  const selectedModel = asString(model) || 'not-selected';
  const providerSelected = Boolean(selectedProvider && selectedProvider !== 'not-selected');
  const modelSelected = Boolean(selectedModel && selectedModel !== 'not-selected');
  const latestPassedLocalExecution = (Array.isArray(modelDraftExecutionRecords) ? modelDraftExecutionRecords : [])
    .filter(
      (execution) =>
        execution?.modelDraftId === draftId &&
        execution?.adapterMode === CASE_WIKI_LOCAL_MODEL_DRAFT_ADAPTER_MODE &&
        execution?.status === 'passed-local-contract' &&
        execution?.externalModelCallMade === false,
    )
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())[0];
  const blockers = [
    !draftId ? 'Saved model draft id is missing.' : '',
    !sectionCount ? 'Draft sections are missing.' : '',
    !citationLedger.length ? 'Reviewed citation ledger is missing.' : '',
    !allowedCitationIds.length ? 'Allowed citation ids are missing.' : '',
    !latestPassedLocalExecution ? 'Run and save the local citation-contract rehearsal first.' : '',
    !providerSelected ? 'Choose an external adapter provider before consent can be prepared.' : '',
    !modelSelected ? 'Name the model or endpoint label before consent can be prepared.' : '',
  ].filter(Boolean);
  const readinessHash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        draftId,
        allowedCitationIds,
        latestPassedLocalExecutionId: latestPassedLocalExecution?.id || '',
        provider: selectedProvider,
        model: selectedModel,
      }),
    )
    .digest('hex')
    .slice(0, 16);
  const now = new Date().toISOString();

  return {
    id: `adapter-readiness:${slugifyTextForId(draftId || draftTitle) || 'model-draft'}:${readinessHash}`,
    modelDraftId: draftId,
    modelDraftPageId: asString(modelDraftRecord.pageId),
    title: `External adapter readiness: ${draftTitle.replace(/^Model draft:\s*/i, '')}`,
    status: blockers.length ? 'blocked-before-consent' : 'ready-for-action-time-consent',
    mode: CASE_WIKI_EXTERNAL_MODEL_ADAPTER_READINESS_MODE,
    externalModelCallEnabled: false,
    externalModelCallMade: false,
    sourceTextTransmitted: false,
    vectorWriteMade: false,
    graphWriteMade: false,
    promotionMade: false,
    provider: selectedProvider,
    model: selectedModel,
    providerConfigStatus:
      providerSelected && modelSelected
        ? 'target-selected-secret-not-configured'
        : 'target-selection-required',
    localExecutionStatus: latestPassedLocalExecution?.status || 'missing',
    localExecutionId: latestPassedLocalExecution?.id || '',
    requiresActionTimeConsent: true,
    requiresSecretConfiguration: true,
    requiresHumanPromotionConfirmation: true,
    blockers,
    consentChecklist: [
      'Confirm the external model provider and model.',
      'Confirm exactly which reviewed citation excerpts may be transmitted.',
      'Confirm no candidate chunks, graph-only context, full files, client attachments, or unrelated sources are included.',
      'Confirm returned prose must preserve citation ids and pass the same coverage diff before any promotion.',
      'Confirm the model output is review-only until a separate human promotion action.',
    ],
    wouldTransmit: {
      fullSourceFiles: false,
      candidateEvidence: false,
      graphOnlyContext: false,
      unrelatedWorkspaceData: false,
      reviewedCitationExcerptCandidates: true,
      includedFields: [
        'draft title',
        'section headings',
        'section citation id requirements',
        'allowed reviewed citation ids',
        'reviewed citation source titles',
        'reviewed citation excerpts from the saved packet only',
        'output contract',
      ],
      excludedFields: [
        'full source files',
        'candidate chunks',
        'graph-only context',
        'unreviewed local files',
        'client/case attachments outside this draft packet',
        'browser history or telemetry',
        'secrets, credentials, and API keys',
      ],
      sectionCount,
      reviewedCitationCount: citationLedger.length,
      allowedCitationCount: allowedCitationIds.length,
      promptMessageCount,
      citationLedgerPreview: citationLedger.slice(0, 12).map((citation) => ({
        id: citation.id,
        sourceTitle: citation.sourceTitle,
        sourceDocumentId: citation.sourceDocumentId,
        evidenceState: citation.evidenceState,
        textPreviewLength: asString(citation.textPreview).length,
      })),
    },
    policy:
      'Readiness preview only. This does not call an external model, transmit source text, write vectors, write Neo4j graph data, promote a wiki page, move files, or attach documents.',
    nextActions: blockers.length
      ? ['Run local adapter check', 'Resolve reviewed citation blockers', 'Refresh external adapter readiness']
      : [
          'Choose provider/model configuration',
          'Ask for action-time source-transmission consent',
          'Run external adapter only after consent',
          'Validate returned citation ids before review or promotion',
        ],
    createdAt: now,
  };
};

const buildModelDraftExternalAdapterConsentPacket = ({
  modelDraftRecord = {},
  modelDraftExecutionRecords = [],
  provider = '',
  model = '',
  actor = '',
} = {}) => {
  const readiness = buildModelDraftExternalAdapterReadinessPacket({
    modelDraftRecord,
    modelDraftExecutionRecords,
    provider,
    model,
  });
  if (readiness.error) {
    return {
      error: readiness.error,
      blockedReasons: readiness.blockedReasons,
      readiness,
    };
  }
  if (readiness.status !== 'ready-for-action-time-consent') {
    return {
      error: 'External adapter consent packet is blocked until readiness passes.',
      blockedReasons: readiness.blockers?.length
        ? readiness.blockers
        : ['Run the local citation-contract rehearsal and refresh readiness first.'],
      readiness,
    };
  }

  const draftId = asString(modelDraftRecord.id || modelDraftRecord.pageId);
  const draftTitle = asString(modelDraftRecord.title, 'Model draft');
  const citationLedger = (Array.isArray(modelDraftRecord.citationLedger) ? modelDraftRecord.citationLedger : [])
    .map(normalizePromotionCitation)
    .filter(Boolean);
  const allowedCitationIds = new Set(
    compactStringArray(
      modelDraftRecord.allowedCitationIds?.length
        ? modelDraftRecord.allowedCitationIds
        : citationLedger.map((citation) => citation.id),
      60,
    ),
  );
  const reviewedCitationExcerptCandidates = citationLedger
    .filter((citation) => allowedCitationIds.has(citation.id))
    .slice(0, 60)
    .map((citation) => ({
      id: citation.id,
      sourceTitle: citation.sourceTitle,
      sourceDocumentId: citation.sourceDocumentId,
      pageId: citation.pageId,
      objectId: citation.objectId,
      evidenceState: citation.evidenceState,
      textPreview: asString(citation.textPreview).slice(0, 1000),
      textPreviewLength: asString(citation.textPreview).length,
    }));
  const sectionPlan = (Array.isArray(modelDraftRecord.sections) ? modelDraftRecord.sections : []).slice(0, 24).map((section) => ({
    heading: asString(section.heading, 'Untitled section'),
    citationIds: compactStringArray(section.citationIds, 24),
    reviewState: asString(section.reviewState, 'model-draft-section'),
  }));
  const transmissionFingerprint = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        draftId,
        readinessId: readiness.id,
        provider: readiness.provider,
        model: readiness.model,
        sections: sectionPlan,
        citations: reviewedCitationExcerptCandidates.map((citation) => [
          citation.id,
          citation.sourceDocumentId,
          citation.objectId,
          citation.textPreview,
        ]),
      }),
    )
    .digest('hex');
  const now = new Date().toISOString();
  const slug = slugifyTextForId(draftId || draftTitle) || 'model-draft';

  return {
    id: `adapter-consent:${slug}:${transmissionFingerprint.slice(0, 16)}`,
    pageId: `adapter-consent:${slug}`,
    modelDraftId: draftId,
    modelDraftPageId: asString(modelDraftRecord.pageId),
    title: `External adapter consent packet: ${draftTitle.replace(/^Model draft:\s*/i, '')}`,
    status: 'pending-action-time-consent',
    mode: CASE_WIKI_EXTERNAL_MODEL_ADAPTER_CONSENT_MODE,
    readinessId: readiness.id,
    readinessStatus: readiness.status,
    provider: readiness.provider,
    model: readiness.model,
    providerConfigStatus: readiness.providerConfigStatus,
    localExecutionId: readiness.localExecutionId,
    localExecutionStatus: readiness.localExecutionStatus,
    transmissionFingerprint,
    externalModelCallEnabled: false,
    externalModelCallMade: false,
    sourceTextTransmitted: false,
    vectorWriteMade: false,
    graphWriteMade: false,
    promotionMade: false,
    humanConsentStatus: 'not-requested',
    requiresActionTimeConsent: true,
    requiresSecretConfiguration: true,
    requiresHumanPromotionConfirmation: true,
    consentChecklist: readiness.consentChecklist,
    wouldTransmit: readiness.wouldTransmit,
    excludedFields: readiness.wouldTransmit?.excludedFields ?? [],
    transmissionPreview: {
      draftTitle,
      sectionPlan,
      reviewedCitationExcerptCandidates,
      reviewedCitationCount: reviewedCitationExcerptCandidates.length,
      fullSourceFiles: false,
      candidateEvidence: false,
      graphOnlyContext: false,
      unrelatedWorkspaceData: false,
    },
    policy:
      'Consent packet only. No external model call, source transmission, vector write, Neo4j graph write, promotion, file move, deletion, or client/case attachment happened.',
    nextActions: [
      'Choose provider/model configuration.',
      'Review exactly which citation excerpts are in this consent packet.',
      'Give action-time consent before any source transmission.',
      'Run the external adapter only after consent and provider secrets are configured.',
      'Validate returned citation ids before any human promotion step.',
    ],
    createdAt: now,
    updatedAt: now,
    createdBy: asString(actor, 'Current worker'),
  };
};

const buildModelDraftExternalAdapterRequestRehearsalRecord = ({
  modelDraftRecord = {},
  externalConsentPacketRecord = {},
  actor = '',
} = {}) => {
  if (!modelDraftRecord || typeof modelDraftRecord !== 'object' || Array.isArray(modelDraftRecord)) {
    return {
      error: 'External adapter request rehearsal needs a saved model draft packet.',
      blockedReasons: ['Open a saved model draft packet before rehearsing the external adapter request.'],
    };
  }
  if (
    !externalConsentPacketRecord ||
    typeof externalConsentPacketRecord !== 'object' ||
    Array.isArray(externalConsentPacketRecord)
  ) {
    return {
      error: 'External adapter request rehearsal needs a saved consent packet.',
      blockedReasons: ['Prepare and save a consent packet before rehearsing the external adapter request.'],
    };
  }
  if (!asString(externalConsentPacketRecord.id)) {
    return {
      error: 'External adapter request rehearsal needs a saved consent packet.',
      blockedReasons: ['Prepare and save a consent packet before rehearsing the external adapter request.'],
    };
  }

  const draftId = asString(modelDraftRecord.id || modelDraftRecord.pageId);
  const consentDraftId = asString(externalConsentPacketRecord.modelDraftId);
  const blockers = [
    !draftId ? 'Saved model draft id is missing.' : '',
    consentDraftId !== draftId ? 'Consent packet belongs to a different model draft.' : '',
    externalConsentPacketRecord.status !== 'pending-action-time-consent'
      ? 'Consent packet is not in pending action-time consent review.'
      : '',
    !externalConsentPacketRecord.transmissionPreview?.reviewedCitationCount
      ? 'Consent packet has no reviewed citation excerpts to rehearse.'
      : '',
    'Action-time source transmission consent has not been granted.',
    'External provider secret/config is not enabled.',
    'Returned citation validation cannot run until a real adapter output exists.',
  ].filter(Boolean);
  const draftTitle = asString(modelDraftRecord.title, 'Model draft');
  const sectionPlan = Array.isArray(externalConsentPacketRecord.transmissionPreview?.sectionPlan)
    ? externalConsentPacketRecord.transmissionPreview.sectionPlan.slice(0, 24).map((section) => ({
        heading: asString(section.heading, 'Untitled section'),
        citationIds: compactStringArray(section.citationIds, 24),
        reviewState: asString(section.reviewState, 'model-draft-section'),
      }))
    : [];
  const reviewedCitationExcerptCandidates = Array.isArray(
    externalConsentPacketRecord.transmissionPreview?.reviewedCitationExcerptCandidates,
  )
    ? externalConsentPacketRecord.transmissionPreview.reviewedCitationExcerptCandidates.slice(0, 60).map((citation) => ({
        id: asString(citation.id),
        sourceTitle: asString(citation.sourceTitle),
        sourceDocumentId: asString(citation.sourceDocumentId),
        pageId: asString(citation.pageId),
        objectId: asString(citation.objectId),
        evidenceState: asString(citation.evidenceState),
        textPreview: asString(citation.textPreview).slice(0, 1000),
        textPreviewLength: Number(citation.textPreviewLength) || asString(citation.textPreview).length,
      }))
    : [];
  const requestEnvelope = {
    provider: asString(externalConsentPacketRecord.provider, 'not-selected'),
    model: asString(externalConsentPacketRecord.model, 'not-selected'),
    mode: 'reviewed-citation-prose-draft',
    draftTitle,
    modelDraftId: draftId,
    consentPacketId: asString(externalConsentPacketRecord.id),
    transmissionFingerprint: asString(externalConsentPacketRecord.transmissionFingerprint),
    outputContract: modelDraftRecord.outputContract || {
      format: 'wiki sections with reviewed citation ids',
      requiredChecks: [
        'Every generated section must cite allowed reviewed citation ids.',
        'No candidate chunks, graph-only context, full files, or unreviewed sources may be used.',
        'Returned citation ids must pass the local coverage diff before promotion.',
      ],
    },
    sectionPlan,
    reviewedCitationExcerptCandidates,
  };
  const requestHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(requestEnvelope))
    .digest('hex');
  const now = new Date().toISOString();
  const slug = slugifyTextForId(draftId || draftTitle) || 'model-draft';

  return {
    id: `adapter-request-rehearsal:${slug}:${requestHash.slice(0, 16)}`,
    pageId: `adapter-request-rehearsal:${slug}`,
    modelDraftId: draftId,
    modelDraftPageId: asString(modelDraftRecord.pageId),
    consentPacketId: asString(externalConsentPacketRecord.id),
    title: `External adapter request rehearsal: ${draftTitle.replace(/^Model draft:\s*/i, '')}`,
    status: 'blocked-before-transmission',
    mode: CASE_WIKI_EXTERNAL_MODEL_ADAPTER_REQUEST_REHEARSAL_MODE,
    provider: requestEnvelope.provider,
    model: requestEnvelope.model,
    transmissionFingerprint: requestEnvelope.transmissionFingerprint,
    requestHash,
    externalModelCallEnabled: false,
    externalModelCallMade: false,
    sourceTextPreparedForTransmission: true,
    sourceTextTransmitted: false,
    vectorWriteMade: false,
    graphWriteMade: false,
    promotionMade: false,
    requiresActionTimeConsent: true,
    requiresSecretConfiguration: true,
    requiresReturnedCitationValidation: true,
    blockers,
    requestEnvelope,
    policy:
      'Request rehearsal only. The adapter request was assembled for local review but no source text was transmitted and no external model call, vector write, Neo4j write, promotion, file move, deletion, or attachment happened.',
    nextActions: [
      'Review this exact request envelope.',
      'Configure the provider/model and secret storage outside this rehearsal.',
      'Ask for action-time source-transmission consent before any external model call.',
      'Validate returned citation ids before any review or promotion path.',
    ],
    createdAt: now,
    updatedAt: now,
    createdBy: asString(actor, 'Current worker'),
  };
};

const normalizeAdapterOutputSection = (section = {}, index = 0) => {
  if (!section || typeof section !== 'object' || Array.isArray(section)) return null;
  const heading = asString(section.heading, `Section ${index + 1}`);
  const text = asString(section.text || section.body || section.content);
  const citationIds = compactStringArray(section.citationIds || section.citations, 24);
  if (!heading && !text && !citationIds.length) return null;
  return {
    id: asString(section.id, `adapter-output-section-${index + 1}`),
    heading,
    text,
    citationIds,
  };
};

const buildAdapterOutputFromRequestRehearsal = (requestRehearsalRecord = {}) => {
  const requestEnvelope = requestRehearsalRecord.requestEnvelope || {};
  const reviewedCitations = Array.isArray(requestEnvelope.reviewedCitationExcerptCandidates)
    ? requestEnvelope.reviewedCitationExcerptCandidates
    : [];
  const fallbackCitationId = asString(reviewedCitations[0]?.id);
  const sectionPlan = Array.isArray(requestEnvelope.sectionPlan) ? requestEnvelope.sectionPlan : [];
  const sections = sectionPlan.length
    ? sectionPlan.map((section, index) => {
        const citationIds = compactStringArray(section.citationIds, 24);
        const usableCitationIds = citationIds.length ? citationIds : fallbackCitationId ? [fallbackCitationId] : [];
        return {
          id: `local-sample-section-${index + 1}`,
          heading: asString(section.heading, `Section ${index + 1}`),
          text: `Local sample output for ${asString(section.heading, `section ${index + 1}`)}. This is validator-only prose and was not generated by an external model.`,
          citationIds: usableCitationIds,
        };
      })
    : fallbackCitationId
      ? [
          {
            id: 'local-sample-section-1',
            heading: 'Lead',
            text: 'Local sample output generated only to validate the citation contract.',
            citationIds: [fallbackCitationId],
          },
        ]
      : [];

  return {
    title: `Local sample output: ${asString(requestEnvelope.draftTitle, requestRehearsalRecord.title || 'model draft')}`,
    sections,
  };
};

const buildModelDraftExternalAdapterOutputValidationRecord = ({
  modelDraftRecord = {},
  requestRehearsalRecord = {},
  adapterOutput = null,
  validationMode = 'local-sample-output',
  actor = '',
} = {}) => {
  if (!modelDraftRecord || typeof modelDraftRecord !== 'object' || Array.isArray(modelDraftRecord)) {
    return {
      error: 'Output validation needs a saved model draft packet.',
      blockedReasons: ['Open a saved model draft packet before validating adapter output.'],
    };
  }
  if (!requestRehearsalRecord || typeof requestRehearsalRecord !== 'object' || Array.isArray(requestRehearsalRecord)) {
    return {
      error: 'Output validation needs a saved external request rehearsal.',
      blockedReasons: ['Run the request rehearsal before validating adapter output.'],
    };
  }
  if (!asString(requestRehearsalRecord.id)) {
    return {
      error: 'Output validation needs a saved external request rehearsal.',
      blockedReasons: ['Run the request rehearsal before validating adapter output.'],
    };
  }

  const draftId = asString(modelDraftRecord.id || modelDraftRecord.pageId);
  const requestDraftId = asString(requestRehearsalRecord.modelDraftId);
  const requestEnvelope = requestRehearsalRecord.requestEnvelope || {};
  const allowedCitationIds = compactStringArray(
    Array.isArray(requestEnvelope.reviewedCitationExcerptCandidates)
      ? requestEnvelope.reviewedCitationExcerptCandidates.map((citation) => citation?.id)
      : [],
    120,
  );
  const output =
    adapterOutput && typeof adapterOutput === 'object' && !Array.isArray(adapterOutput)
      ? adapterOutput
      : buildAdapterOutputFromRequestRehearsal(requestRehearsalRecord);
  const capturedExternalOutput =
    adapterOutput && typeof adapterOutput === 'object' && !Array.isArray(adapterOutput) && validationMode !== 'local-sample-output';
  const sections = (Array.isArray(output.sections) ? output.sections : [])
    .map(normalizeAdapterOutputSection)
    .filter(Boolean);
  const returnedCitationIds = compactStringArray(sections.flatMap((section) => section.citationIds), 120);
  const allowedSet = new Set(allowedCitationIds);
  const unknownCitationIds = returnedCitationIds.filter((citationId) => !allowedSet.has(citationId));
  const missingSectionCitationHeadings = sections
    .filter((section) => !section.citationIds.length)
    .map((section) => section.heading);
  const blockers = [
    !draftId ? 'Saved model draft id is missing.' : '',
    requestDraftId !== draftId ? 'Request rehearsal belongs to a different model draft.' : '',
    !allowedCitationIds.length ? 'Request rehearsal has no allowed reviewed citation ids.' : '',
    !sections.length ? 'Adapter output has no sections to validate.' : '',
    ...unknownCitationIds.map((citationId) => `Returned citation id is not allowed: ${citationId}`),
    ...missingSectionCitationHeadings.map((heading) => `Output section has no citation ids: ${heading}`),
  ].filter(Boolean);
  const validationHash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        draftId,
        requestRehearsalId: requestRehearsalRecord.id,
        validationMode,
        sections,
        allowedCitationIds,
      }),
    )
    .digest('hex');
  const now = new Date().toISOString();
  const slug = slugifyTextForId(draftId || modelDraftRecord.title) || 'model-draft';

  return {
    id: `adapter-output-validation:${slug}:${validationHash.slice(0, 16)}`,
    pageId: `adapter-output-validation:${slug}`,
    modelDraftId: draftId,
    modelDraftPageId: asString(modelDraftRecord.pageId),
    requestRehearsalId: asString(requestRehearsalRecord.id),
    consentPacketId: asString(requestRehearsalRecord.consentPacketId),
    title: `Output citation validation: ${asString(modelDraftRecord.title, 'Model draft').replace(/^Model draft:\s*/i, '')}`,
    status: blockers.length ? 'blocked-citation-contract' : 'passed-output-citation-contract',
    mode: CASE_WIKI_EXTERNAL_MODEL_ADAPTER_OUTPUT_VALIDATION_MODE,
    validationMode: asString(validationMode, 'local-sample-output'),
    provider: asString(requestRehearsalRecord.provider, 'not-selected'),
    model: asString(requestRehearsalRecord.model, 'not-selected'),
    externalModelCallMade: false,
    outputReceivedFromExternalModel: Boolean(capturedExternalOutput),
    sourceTextTransmitted: false,
    vectorWriteMade: false,
    graphWriteMade: false,
    promotionMade: false,
    requiresHumanPromotionConfirmation: true,
    allowedCitationIds,
    returnedCitationIds,
    unknownCitationIds,
    missingSectionCitationHeadings,
    sectionResults: sections.map((section) => ({
      heading: section.heading,
      citationIds: section.citationIds,
      unknownCitationIds: section.citationIds.filter((citationId) => !allowedSet.has(citationId)),
      status:
        section.citationIds.length && section.citationIds.every((citationId) => allowedSet.has(citationId))
          ? 'pass'
          : 'blocked',
    })),
    adapterOutput: {
      title: asString(output.title, 'Adapter output'),
      sections,
    },
    blockers,
    policy:
      'Output validation only. This does not call an external model, transmit source text, write vectors, write Neo4j graph data, promote a wiki page, move files, delete files, or attach documents.',
    nextActions: blockers.length
      ? ['Fix returned citation ids', 'Re-run output validation before review or promotion']
      : ['Review validated output', 'Run human promotion review separately'],
    createdAt: now,
    updatedAt: now,
    createdBy: asString(actor, 'Current worker'),
  };
};

const buildReturnedOutputEditorialReviewRecord = ({
  modelDraftRecord = {},
  outputValidationRecord = {},
  actor = '',
} = {}) => {
  if (!modelDraftRecord || typeof modelDraftRecord !== 'object' || Array.isArray(modelDraftRecord)) {
    return {
      error: 'Returned output review needs a saved model draft packet.',
      blockedReasons: ['Open a saved model draft packet before staging returned output review.'],
    };
  }
  if (
    !outputValidationRecord ||
    typeof outputValidationRecord !== 'object' ||
    Array.isArray(outputValidationRecord)
  ) {
    return {
      error: 'Returned output review needs a saved output validation.',
      blockedReasons: ['Validate returned output citations before staging editorial review.'],
    };
  }

  const draftId = asString(modelDraftRecord.id || modelDraftRecord.pageId);
  const validationDraftId = asString(outputValidationRecord.modelDraftId);
  const outputSections = Array.isArray(outputValidationRecord.adapterOutput?.sections)
    ? outputValidationRecord.adapterOutput.sections.map(normalizeAdapterOutputSection).filter(Boolean)
    : [];
  const sectionResults = Array.isArray(outputValidationRecord.sectionResults)
    ? outputValidationRecord.sectionResults
    : [];
  const blockers = [
    !draftId ? 'Saved model draft id is missing.' : '',
    validationDraftId !== draftId ? 'Output validation belongs to a different model draft.' : '',
    outputValidationRecord.status !== 'passed-output-citation-contract'
      ? 'Returned output citations must pass before editorial review.'
      : '',
    !outputValidationRecord.outputReceivedFromExternalModel
      ? 'Stage captured returned output, not a local sample output.'
      : '',
    !outputSections.length ? 'Returned output has no sections to review.' : '',
  ].filter(Boolean);

  if (blockers.length) {
    return {
      error: 'Returned output editorial review is blocked.',
      blockedReasons: blockers,
    };
  }

  const now = new Date().toISOString();
  const reviewHash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        draftId,
        outputValidationId: outputValidationRecord.id,
        sections: outputSections.map((section) => ({
          heading: section.heading,
          citationIds: section.citationIds,
          textHash: crypto.createHash('sha256').update(section.text || '').digest('hex').slice(0, 16),
        })),
      }),
    )
    .digest('hex');
  const slug = slugifyTextForId(draftId || modelDraftRecord.title) || 'model-draft';

  const sectionReviews = outputSections.map((section, index) => {
    const sectionResult =
      sectionResults.find((result) => asString(result.heading) === asString(section.heading)) || sectionResults[index] || {};
    return {
      id: asString(section.id, `returned-review-section-${index + 1}`),
      heading: section.heading,
      text: section.text,
      citationIds: section.citationIds,
      citationStatus: asString(sectionResult.status, 'pass'),
      unknownCitationIds: compactStringArray(sectionResult.unknownCitationIds, 24),
      editorialDecision: 'needs-human-review',
      privacyDecision: 'needs-review',
      toneDecision: 'needs-review',
      reviewerNote: '',
    };
  });

  return {
    id: `returned-output-review:${slug}:${reviewHash.slice(0, 16)}`,
    pageId: `returned-output-review:${slug}`,
    modelDraftId: draftId,
    modelDraftPageId: asString(modelDraftRecord.pageId),
    outputValidationId: asString(outputValidationRecord.id),
    requestRehearsalId: asString(outputValidationRecord.requestRehearsalId),
    consentPacketId: asString(outputValidationRecord.consentPacketId),
    title: `Returned draft review: ${asString(modelDraftRecord.title, 'Model draft').replace(/^Model draft:\s*/i, '')}`,
    status: 'awaiting-editorial-review',
    mode: CASE_WIKI_RETURNED_OUTPUT_EDITORIAL_REVIEW_MODE,
    provider: asString(outputValidationRecord.provider, 'not-selected'),
    model: asString(outputValidationRecord.model, 'not-selected'),
    externalModelCallMade: false,
    outputReceivedFromExternalModel: true,
    sourceTextTransmitted: false,
    vectorWriteMade: false,
    graphWriteMade: false,
    promotionMade: false,
    requiresHumanPromotionConfirmation: true,
    sectionCount: sectionReviews.length,
    returnedCitationIds: compactStringArray(outputValidationRecord.returnedCitationIds, 120),
    allowedCitationIds: compactStringArray(outputValidationRecord.allowedCitationIds, 120),
    sectionReviews,
    reviewChecklist: [
      'Check whether the returned prose is accurate to the cited source excerpts.',
      'Remove claims that are not directly supported by returned citation ids.',
      'Review privacy, tone, and case-management boundaries before promotion.',
      'Use a separate human-confirmed promotion step if this should become a permanent wiki section.',
    ],
    policy:
      'Returned output editorial review only. This does not call an external model, transmit source text, write vectors, write Neo4j graph data, promote a wiki page, move files, delete files, or attach documents.',
    nextActions: ['Review section wording', 'Mark sections ready or needs revision in a future decision step', 'Promote separately only after human confirmation'],
    createdAt: now,
    updatedAt: now,
    createdBy: asString(actor, 'Current worker'),
  };
};

const RETURNED_OUTPUT_EDITORIAL_DECISIONS = new Set([
  'needs-human-review',
  'ready-for-promotion-review',
  'needs-revision',
  'do-not-promote',
]);
const RETURNED_OUTPUT_PRIVACY_DECISIONS = new Set(['needs-review', 'approved-for-promotion', 'needs-redaction']);
const RETURNED_OUTPUT_TONE_DECISIONS = new Set(['needs-review', 'approved-for-promotion', 'needs-tone-edit']);

const normalizeReturnedOutputReviewDecision = (value, allowedValues, fallback) => {
  const decision = asString(value);
  return allowedValues.has(decision) ? decision : fallback;
};

const applyReturnedOutputEditorialDecisionRecord = ({
  returnedOutputReviewRecord = {},
  sectionDecisions = [],
  decisionMode = '',
  privacyDecision = '',
  toneDecision = '',
  reviewerNote = '',
  actor = '',
} = {}) => {
  if (
    !returnedOutputReviewRecord ||
    typeof returnedOutputReviewRecord !== 'object' ||
    Array.isArray(returnedOutputReviewRecord)
  ) {
    return {
      error: 'Returned output editorial decision needs a saved review packet.',
      blockedReasons: ['Stage returned output for editorial review before recording decisions.'],
    };
  }

  const sections = Array.isArray(returnedOutputReviewRecord.sectionReviews)
    ? returnedOutputReviewRecord.sectionReviews
    : [];
  if (!sections.length) {
    return {
      error: 'Returned output editorial decision is blocked.',
      blockedReasons: ['The returned output review packet has no section reviews.'],
    };
  }

  const requestedDecisions = Array.isArray(sectionDecisions) ? sectionDecisions : [];
  const decisionByKey = new Map();
  requestedDecisions.forEach((decision) => {
    if (!decision || typeof decision !== 'object' || Array.isArray(decision)) return;
    const id = asString(decision.id);
    const heading = asString(decision.heading);
    if (id) decisionByKey.set(`id:${id}`, decision);
    if (heading) decisionByKey.set(`heading:${heading}`, decision);
  });

  const now = new Date().toISOString();
  const defaultEditorialDecision = normalizeReturnedOutputReviewDecision(
    decisionMode,
    RETURNED_OUTPUT_EDITORIAL_DECISIONS,
    '',
  );
  const defaultPrivacyDecision = normalizeReturnedOutputReviewDecision(
    privacyDecision,
    RETURNED_OUTPUT_PRIVACY_DECISIONS,
    defaultEditorialDecision === 'ready-for-promotion-review' ? 'approved-for-promotion' : '',
  );
  const defaultToneDecision = normalizeReturnedOutputReviewDecision(
    toneDecision,
    RETURNED_OUTPUT_TONE_DECISIONS,
    defaultEditorialDecision === 'ready-for-promotion-review' ? 'approved-for-promotion' : '',
  );
  const reviewer = asString(actor, 'Current worker');
  const note = asString(reviewerNote);

  const updatedSectionReviews = sections.map((section, index) => {
    const sectionDecision =
      decisionByKey.get(`id:${asString(section.id)}`) ||
      decisionByKey.get(`heading:${asString(section.heading)}`) ||
      requestedDecisions[index] ||
      {};
    const editorial = normalizeReturnedOutputReviewDecision(
      sectionDecision.editorialDecision || defaultEditorialDecision,
      RETURNED_OUTPUT_EDITORIAL_DECISIONS,
      asString(section.editorialDecision, 'needs-human-review'),
    );
    const privacy = normalizeReturnedOutputReviewDecision(
      sectionDecision.privacyDecision || defaultPrivacyDecision,
      RETURNED_OUTPUT_PRIVACY_DECISIONS,
      asString(section.privacyDecision, 'needs-review'),
    );
    const tone = normalizeReturnedOutputReviewDecision(
      sectionDecision.toneDecision || defaultToneDecision,
      RETURNED_OUTPUT_TONE_DECISIONS,
      asString(section.toneDecision, 'needs-review'),
    );

    return {
      ...section,
      editorialDecision: editorial,
      privacyDecision: privacy,
      toneDecision: tone,
      reviewerNote: asString(sectionDecision.reviewerNote || note || section.reviewerNote),
      reviewedBy: reviewer,
      reviewedAt: now,
    };
  });

  const readySectionCount = updatedSectionReviews.filter(
    (section) =>
      section.editorialDecision === 'ready-for-promotion-review' &&
      section.privacyDecision === 'approved-for-promotion' &&
      section.toneDecision === 'approved-for-promotion',
  ).length;
  const revisionSectionCount = updatedSectionReviews.filter(
    (section) =>
      section.editorialDecision === 'needs-revision' ||
      section.editorialDecision === 'do-not-promote' ||
      section.privacyDecision === 'needs-redaction' ||
      section.toneDecision === 'needs-tone-edit',
  ).length;
  const pendingSectionCount = updatedSectionReviews.filter(
    (section) =>
      section.editorialDecision === 'needs-human-review' ||
      section.privacyDecision === 'needs-review' ||
      section.toneDecision === 'needs-review',
  ).length;
  const status =
    readySectionCount === updatedSectionReviews.length
      ? 'reviewed-ready-for-promotion-gate'
      : revisionSectionCount
        ? 'reviewed-needs-revision'
        : 'awaiting-editorial-review';
  const history = Array.isArray(returnedOutputReviewRecord.decisionHistory)
    ? returnedOutputReviewRecord.decisionHistory
    : [];

  return {
    ...returnedOutputReviewRecord,
    status,
    sectionReviews: updatedSectionReviews,
    readySectionCount,
    revisionSectionCount,
    pendingSectionCount,
    lastDecisionAt: now,
    lastDecisionBy: reviewer,
    reviewerNote: note,
    decisionHistory: [
      ...history.slice(-11),
      {
        id: `returned-output-decision:${asString(returnedOutputReviewRecord.id)}:${Date.now()}`,
        timestamp: now,
        actor: reviewer,
        status,
        readySectionCount,
        revisionSectionCount,
        pendingSectionCount,
        reviewerNote: note,
      },
    ],
    promotionMade: false,
    vectorWriteMade: false,
    graphWriteMade: false,
    sourceTextTransmitted: false,
    updatedAt: now,
  };
};

const buildReturnedOutputPromotionReadinessReview = ({
  modelDraftRecord = {},
  returnedOutputReviewRecord = {},
  actor = '',
} = {}) => {
  if (!modelDraftRecord || typeof modelDraftRecord !== 'object' || Array.isArray(modelDraftRecord)) {
    return {
      error: 'Returned output promotion readiness needs a saved model draft packet.',
      blockedReasons: ['Open a saved model draft packet before checking promotion readiness.'],
    };
  }
  if (
    !returnedOutputReviewRecord ||
    typeof returnedOutputReviewRecord !== 'object' ||
    Array.isArray(returnedOutputReviewRecord)
  ) {
    return {
      error: 'Returned output promotion readiness needs a saved editorial review packet.',
      blockedReasons: ['Stage returned output and record editorial decisions before checking promotion readiness.'],
    };
  }

  const now = new Date().toISOString();
  const draftId = asString(modelDraftRecord.id || modelDraftRecord.pageId);
  const reviewDraftId = asString(returnedOutputReviewRecord.modelDraftId);
  const sections = Array.isArray(returnedOutputReviewRecord.sectionReviews)
    ? returnedOutputReviewRecord.sectionReviews
    : [];
  const readySections = sections.filter(
    (section) =>
      section.editorialDecision === 'ready-for-promotion-review' &&
      section.privacyDecision === 'approved-for-promotion' &&
      section.toneDecision === 'approved-for-promotion',
  );
  const unsupportedSections = sections.filter(
    (section) =>
      section.editorialDecision !== 'ready-for-promotion-review' ||
      section.privacyDecision !== 'approved-for-promotion' ||
      section.toneDecision !== 'approved-for-promotion',
  );
  const missingTextSections = sections.filter((section) => !asString(section.text));
  const missingCitationSections = sections.filter((section) => !compactStringArray(section.citationIds, 20).length);
  const unknownCitationSections = sections.filter((section) =>
    compactStringArray(section.unknownCitationIds, 20).length,
  );
  const blockers = [
    !draftId ? 'Saved model draft id is missing.' : '',
    reviewDraftId !== draftId ? 'Returned output review belongs to a different model draft.' : '',
    !sections.length ? 'Returned output review has no section reviews.' : '',
    returnedOutputReviewRecord.status !== 'reviewed-ready-for-promotion-gate'
      ? 'Editorial decision must mark the returned output ready before promotion readiness.'
      : '',
    unsupportedSections.length ? `${unsupportedSections.length} section decisions are not ready for promotion review.` : '',
    missingTextSections.length ? `${missingTextSections.length} section has no returned prose.` : '',
    missingCitationSections.length ? `${missingCitationSections.length} section has no reviewed citation ids.` : '',
    unknownCitationSections.length ? `${unknownCitationSections.length} section still has unknown citation ids.` : '',
    returnedOutputReviewRecord.promotionMade ? 'This returned output review already records a promotion.' : '',
  ].filter(Boolean);
  const slug = slugifyTextForId(
    `${draftId || modelDraftRecord.title || 'model-draft'}-${returnedOutputReviewRecord.id || 'returned-output'}`,
  );
  const readinessRecord = {
    id: `returned-output-promotion-readiness:${slug}:${Date.now()}`,
    modelDraftId: draftId,
    returnedOutputReviewId: asString(returnedOutputReviewRecord.id),
    outputValidationId: asString(returnedOutputReviewRecord.outputValidationId),
    title: `Promotion readiness: ${asString(returnedOutputReviewRecord.title, modelDraftRecord.title || 'Returned draft')}`,
    status: blockers.length ? 'blocked-promotion-readiness' : 'ready-for-human-promotion-confirmation',
    readySectionCount: readySections.length,
    blockedSectionCount: unsupportedSections.length + missingTextSections.length + missingCitationSections.length,
    sectionCount: sections.length,
    blockers,
    sectionChecklist: sections.map((section, index) => {
      const citationIds = compactStringArray(section.citationIds, 20);
      const unknownCitationIds = compactStringArray(section.unknownCitationIds, 20);
      const ready =
        section.editorialDecision === 'ready-for-promotion-review' &&
        section.privacyDecision === 'approved-for-promotion' &&
        section.toneDecision === 'approved-for-promotion' &&
        Boolean(asString(section.text)) &&
        citationIds.length > 0 &&
        unknownCitationIds.length === 0;
      return {
        id: asString(section.id, `returned-promotion-section-${index + 1}`),
        heading: asString(section.heading, `Returned section ${index + 1}`),
        status: ready ? 'ready' : 'blocked',
        citationIds,
        unknownCitationIds,
        editorialDecision: asString(section.editorialDecision),
        privacyDecision: asString(section.privacyDecision),
        toneDecision: asString(section.toneDecision),
        textPreview: asString(section.text).slice(0, 240),
      };
    }),
    promotionMade: false,
    vectorWriteMade: false,
    graphWriteMade: false,
    sourceTextTransmitted: false,
    requiresHumanPromotionConfirmation: true,
    policy:
      'Returned output promotion readiness only. This does not publish article prose, call a model, transmit source text, write vectors, write Neo4j graph data, attach records, move files, delete files, or embed anything.',
    nextActions: blockers.length
      ? ['Resolve readiness blockers', 'Re-record editorial decisions if needed', 'Run promotion readiness again']
      : ['Open separate human promotion confirmation', 'Publish only approved sections in a later explicit step'],
    createdAt: now,
    updatedAt: now,
    createdBy: asString(actor, 'Current worker'),
  };

  return {
    ...returnedOutputReviewRecord,
    status: blockers.length ? 'promotion-readiness-blocked' : 'promotion-readiness-ready',
    promotionReadinessReview: readinessRecord,
    lastPromotionReadinessAt: now,
    lastPromotionReadinessStatus: readinessRecord.status,
    promotionMade: false,
    vectorWriteMade: false,
    graphWriteMade: false,
    sourceTextTransmitted: false,
    updatedAt: now,
  };
};

const findReturnedOutputCitationRecord = (citationLedger = [], citationId = '') => {
  const target = asString(citationId);
  if (!target) return null;
  return (
    (Array.isArray(citationLedger) ? citationLedger : []).find((citation) =>
      [citation?.id, citation?.objectId, citation?.chunkId, citation?.sourceDocumentId, citation?.pageId]
        .map(asString)
        .includes(target),
    ) || null
  );
};

const buildReturnedOutputPublicationCandidate = ({
  modelDraftRecord = {},
  returnedOutputReviewRecord = {},
  actor = '',
} = {}) => {
  if (!modelDraftRecord || typeof modelDraftRecord !== 'object' || Array.isArray(modelDraftRecord)) {
    return {
      error: 'Returned output publication needs a saved model draft packet.',
      blockedReasons: ['Open a saved model draft packet before publishing returned output.'],
    };
  }
  if (
    !returnedOutputReviewRecord ||
    typeof returnedOutputReviewRecord !== 'object' ||
    Array.isArray(returnedOutputReviewRecord)
  ) {
    return {
      error: 'Returned output publication needs a saved review packet.',
      blockedReasons: ['Stage and review returned output before publishing it into the Case Wiki.'],
    };
  }

  const draftId = asString(modelDraftRecord.id || modelDraftRecord.pageId);
  const reviewDraftId = asString(returnedOutputReviewRecord.modelDraftId);
  const readiness = returnedOutputReviewRecord.promotionReadinessReview || {};
  const sectionReviews = Array.isArray(returnedOutputReviewRecord.sectionReviews)
    ? returnedOutputReviewRecord.sectionReviews
    : [];
  const readySections = sectionReviews.filter(
    (section) =>
      section.editorialDecision === 'ready-for-promotion-review' &&
      section.privacyDecision === 'approved-for-promotion' &&
      section.toneDecision === 'approved-for-promotion' &&
      Boolean(asString(section.text)) &&
      compactStringArray(section.citationIds, 20).length > 0 &&
      !compactStringArray(section.unknownCitationIds, 20).length,
  );
  const citedSectionIds = compactStringArray(
    readySections.flatMap((section) => compactStringArray(section.citationIds, 20)),
    120,
  );
  const citationLedger = citedSectionIds
    .map((citationId, index) => {
      const citationRecord = findReturnedOutputCitationRecord(modelDraftRecord.citationLedger, citationId);
      return normalizePromotionCitation(
        citationRecord || {
          id: citationId,
          marker: `[${index + 1}]`,
          sourceTitle: `Reviewed citation ${citationId}`,
          evidenceState: 'reviewed-returned-output',
          textPreview: `Citation id ${citationId} was approved in the returned-output review packet.`,
        },
        index,
      );
    })
    .filter(Boolean);
  const blockers = [
    !draftId ? 'Saved model draft id is missing.' : '',
    reviewDraftId !== draftId ? 'Returned output review belongs to a different model draft.' : '',
    returnedOutputReviewRecord.status !== 'promotion-readiness-ready'
      ? 'Promotion readiness must be ready before publication.'
      : '',
    readiness.status !== 'ready-for-human-promotion-confirmation'
      ? 'Readiness packet must be ready for human promotion confirmation.'
      : '',
    !sectionReviews.length ? 'Returned output review has no section reviews.' : '',
    readySections.length !== sectionReviews.length
      ? `${sectionReviews.length - readySections.length} returned section is not ready for publication.`
      : '',
    !readySections.length ? 'No returned sections are ready for publication.' : '',
    !citationLedger.length ? 'Returned output publication needs at least one reviewed citation.' : '',
    returnedOutputReviewRecord.promotionMade ? 'This returned output review already records a publication.' : '',
  ].filter(Boolean);

  if (blockers.length) {
    return {
      error: 'Returned output publication is blocked.',
      blockedReasons: blockers,
    };
  }

  const now = new Date().toISOString();
  const title = asString(
    readiness.title || returnedOutputReviewRecord.title || modelDraftRecord.query || modelDraftRecord.title,
    'Returned output wiki topic',
  )
    .replace(/^Promotion readiness:\s*/i, '')
    .replace(/^Returned draft review:\s*/i, '')
    .replace(/^Model draft:\s*/i, '')
    .trim();
  const slug = slugifyTextForId(title || draftId) || 'returned-output-topic';
  const publicationHash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        draftId,
        reviewId: returnedOutputReviewRecord.id,
        citationIds: citedSectionIds,
        sections: readySections.map((section) => ({
          heading: section.heading,
          textHash: crypto.createHash('sha256').update(asString(section.text)).digest('hex').slice(0, 16),
        })),
      }),
    )
    .digest('hex')
    .slice(0, 16);
  const sections = readySections
    .map((section, index) =>
      normalizePromotionSection(
        {
          heading: section.heading,
          text: section.text,
          citationIds: section.citationIds,
          reviewState: 'human-approved-returned-output',
        },
        index,
      ),
    )
    .filter(Boolean);

  const promotionRecord = {
    id: `promotion:returned-output:${slug}:${publicationHash}`,
    pageId: `promotion:returned-output:${slug}`,
    title: title || 'Returned output wiki topic',
    query: asString(modelDraftRecord.query || title),
    status: 'published-section',
    publishMode: 'human-confirmed-returned-output',
    lead: truncateRetrievalText(
      sections[0]?.text ||
        `${title || 'This returned-output topic'} was promoted from a human-reviewed returned adapter output packet.`,
      1600,
    ),
    sections,
    citationLedger,
    citationCoverageDiff: {
      status: 'pass',
      reviewedSectionCount: sections.length,
      blockedSectionCount: 0,
      sectionDiffs: sections.map((section) => ({
        heading: section.heading,
        status: 'pass',
        reason: `${section.citationIds?.length || 0} reviewed returned-output citation id${
          section.citationIds?.length === 1 ? '' : 's'
        } preserved.`,
      })),
    },
    sourceDocumentIds: compactStringArray(citationLedger.map((citation) => citation.sourceDocumentId), 50),
    createdAt: now,
    updatedAt: now,
    createdBy: asString(actor, 'Current worker'),
    reviewState: 'human-approved-returned-output',
    sourcePolicy:
      'Promoted from human-reviewed returned adapter output. The publication preserved reviewed citation ids and did not transmit source text, write vectors, write Neo4j graph data, attach records, move files, or delete files.',
    modelDraftId: draftId,
    returnedOutputReviewId: asString(returnedOutputReviewRecord.id),
    outputValidationId: asString(returnedOutputReviewRecord.outputValidationId),
  };

  return {
    promotionRecord,
    citationIds: citedSectionIds,
    policy:
      'Human-confirmed returned-output publication only. This writes a Case Wiki topic record and audit trail; it does not call a model, transmit source text, write vectors, write Neo4j graph data, attach records, move files, delete files, or embed anything.',
  };
};

const PROMOTION_VERSION_HISTORY_LIMIT = 12;

const buildConfirmedRetrievalPromotionRecord = ({ query = '', promotionPreview = {}, answerDraft = {}, actor = '' } = {}) => {
  const normalizedQuery = normalizeRetrievalQuery(query || promotionPreview.targetPageTitle || answerDraft.title || '');
  const title = asString(promotionPreview.targetPageTitle || answerDraft.title || query || 'Case Wiki promoted topic');
  const citations = (Array.isArray(promotionPreview.citationLedger) ? promotionPreview.citationLedger : [])
    .map(normalizePromotionCitation)
    .filter(Boolean);
  const rawSections = Array.isArray(promotionPreview.sections) ? promotionPreview.sections : [];
  const sections = rawSections
    .map(normalizePromotionSection)
    .filter(Boolean)
    .filter((section) => !['needs-human-review', 'context-only', 'action-required'].includes(section.reviewState));
  const citationCoverageDiff =
    promotionPreview.citationCoverageDiff ||
    buildPromotionCitationCoverageDiff({
      promotionStatus: promotionPreview.status,
      sections: rawSections,
      citationLedger: citations,
      synthesis: answerDraft.synthesis || {},
    });
  const sourceDocumentIds = compactStringArray(citations.map((citation) => citation.sourceDocumentId), 50);
  const citationHash = crypto
    .createHash('sha256')
    .update(citations.map((citation) => normalizeDraftCitationKey(citation)).join('\n') || title)
    .digest('hex')
    .slice(0, 16);
  const slug = slugifyTextForId(normalizedQuery || title) || 'case-wiki-topic';
  const now = new Date().toISOString();

  if (promotionPreview.status !== 'ready-to-promote') {
    return {
      error: 'Promotion is blocked until reviewed citations are ready.',
      blockedReasons: promotionPreview.blockedReasons?.length
        ? promotionPreview.blockedReasons
        : ['No reviewed citations are available for promotion.'],
    };
  }

  if (!citations.length) {
    return {
      error: 'Promotion needs at least one reviewed citation.',
      blockedReasons: ['Add reviewed citation ledger entries before promotion.'],
    };
  }

  if (citationCoverageDiff.status !== 'pass') {
    return {
      error: 'Promotion coverage check failed.',
      blockedReasons: citationCoverageDiff.sectionDiffs?.length
        ? citationCoverageDiff.sectionDiffs
            .filter((section) => section.status?.startsWith('blocked'))
            .map((section) => `${section.heading}: ${section.reason}`)
        : ['Every promoted section needs reviewed citations before publication.'],
      citationCoverageDiff,
    };
  }

  return {
    id: `promotion:${slug}:${citationHash}`,
    pageId: `promotion:${slug}`,
    title,
    query: normalizedQuery,
    status: 'published-section',
    publishMode: 'human-confirmed',
    lead: truncateRetrievalText(promotionPreview.lead || answerDraft.lead || '', 1600),
    sections,
    citationLedger: citations,
    sourceDocumentIds,
    createdAt: now,
    updatedAt: now,
    createdBy: asString(actor, 'Current worker'),
    reviewState: 'reviewed-citations-only',
    citationCoverageDiff,
    sourcePolicy:
      'Promoted from reviewed Case Wiki citations only. Candidate citations and graph-only clues are excluded until separately reviewed.',
  };
};

const buildRetrievalPromotionSnapshot = (promotionRecord = {}, { capturedAt = new Date().toISOString(), reason = 'promotion revision' } = {}) => {
  if (!promotionRecord?.id) return null;
  return {
    revisionId:
      asString(promotionRecord.revisionId) ||
      `revision:${promotionRecord.id}:${promotionRecord.version || 1}:${crypto
        .createHash('sha256')
        .update(`${promotionRecord.updatedAt || promotionRecord.createdAt || capturedAt}:${promotionRecord.lead || ''}`)
        .digest('hex')
        .slice(0, 8)}`,
    promotionId: asString(promotionRecord.id),
    pageId: asString(promotionRecord.pageId),
    title: asString(promotionRecord.title),
    query: asString(promotionRecord.query),
    status: asString(promotionRecord.status),
    publishMode: asString(promotionRecord.publishMode),
    lead: asString(promotionRecord.lead),
    sections: Array.isArray(promotionRecord.sections) ? promotionRecord.sections : [],
    citationLedger: Array.isArray(promotionRecord.citationLedger) ? promotionRecord.citationLedger : [],
    sourceDocumentIds: Array.isArray(promotionRecord.sourceDocumentIds) ? promotionRecord.sourceDocumentIds : [],
    createdAt: asString(promotionRecord.createdAt),
    updatedAt: asString(promotionRecord.updatedAt),
    createdBy: asString(promotionRecord.createdBy),
    reviewState: asString(promotionRecord.reviewState),
    citationCoverageDiff: promotionRecord.citationCoverageDiff || null,
    sourcePolicy: asString(promotionRecord.sourcePolicy),
    neo4jStatus: asString(promotionRecord.neo4jStatus),
    neo4jMessage: asString(promotionRecord.neo4jMessage),
    version: Number.isFinite(Number(promotionRecord.version)) ? Number(promotionRecord.version) : 1,
    capturedAt,
    reason,
  };
};

const applyRetrievalPromotionVersioning = ({ existingPromotion, incomingPromotion, neo4j = {} } = {}) => {
  if (!incomingPromotion?.id) return incomingPromotion;
  const now = new Date().toISOString();
  const neo4jFields = {
    neo4jStatus: neo4j.status,
    neo4jMessage: neo4j.message || neo4j.skippedReason || '',
  };

  if (!existingPromotion?.id) {
    return {
      ...incomingPromotion,
      ...neo4jFields,
      version: 1,
      revisionId: `revision:${incomingPromotion.id}:1`,
      versionHistory: [],
    };
  }

  const previousSnapshot = buildRetrievalPromotionSnapshot(existingPromotion, {
    capturedAt: now,
    reason: 'superseded by confirmed promotion',
  });
  const nextVersion = (Number(existingPromotion.version) || 1) + 1;
  const existingHistory = Array.isArray(existingPromotion.versionHistory) ? existingPromotion.versionHistory : [];
  return {
    ...incomingPromotion,
    ...neo4jFields,
    id: existingPromotion.id,
    pageId: existingPromotion.pageId || incomingPromotion.pageId,
    createdAt: existingPromotion.createdAt || incomingPromotion.createdAt,
    createdBy: existingPromotion.createdBy || incomingPromotion.createdBy,
    updatedAt: now,
    version: nextVersion,
    revisionId: `revision:${existingPromotion.id}:${nextVersion}`,
    sourceRevisionId: incomingPromotion.id,
    versionHistory: [previousSnapshot, ...existingHistory].filter(Boolean).slice(0, PROMOTION_VERSION_HISTORY_LIMIT),
  };
};

const rollbackRetrievalPromotionToSnapshot = ({ promotionRecord, snapshot, actor = '' } = {}) => {
  if (!promotionRecord?.id || !snapshot?.revisionId) {
    return { error: 'Could not find a promoted topic revision to restore.' };
  }
  const now = new Date().toISOString();
  const currentSnapshot = buildRetrievalPromotionSnapshot(promotionRecord, {
    capturedAt: now,
    reason: `rolled back to ${snapshot.revisionId}`,
  });
  const nextVersion = (Number(promotionRecord.version) || 1) + 1;
  const existingHistory = Array.isArray(promotionRecord.versionHistory) ? promotionRecord.versionHistory : [];
  const remainingHistory = existingHistory.filter((item) => item?.revisionId !== snapshot.revisionId);
  const restoredPolicy =
    asString(snapshot.sourcePolicy) ||
    'Restored from a prior human-confirmed Case Wiki promotion revision. Candidate evidence remains excluded.';

  return {
    ...promotionRecord,
    title: asString(snapshot.title, promotionRecord.title),
    query: asString(snapshot.query, promotionRecord.query),
    status: asString(snapshot.status, promotionRecord.status || 'published-section'),
    publishMode: asString(snapshot.publishMode, promotionRecord.publishMode || 'human-confirmed'),
    lead: asString(snapshot.lead),
    sections: Array.isArray(snapshot.sections) ? snapshot.sections : [],
    citationLedger: Array.isArray(snapshot.citationLedger) ? snapshot.citationLedger : [],
    sourceDocumentIds: Array.isArray(snapshot.sourceDocumentIds) ? snapshot.sourceDocumentIds : [],
    reviewState: asString(snapshot.reviewState, promotionRecord.reviewState || 'reviewed-citations-only'),
    citationCoverageDiff: snapshot.citationCoverageDiff || promotionRecord.citationCoverageDiff || null,
    sourcePolicy: `${restoredPolicy} Restored from version ${snapshot.version || 'prior'} by human rollback.`,
    updatedAt: now,
    version: nextVersion,
    revisionId: `revision:${promotionRecord.id}:${nextVersion}`,
    rollbackOfRevisionId: snapshot.revisionId,
    rolledBackAt: now,
    rolledBackBy: asString(actor, 'Current worker'),
    versionHistory: [currentSnapshot, ...remainingHistory].filter(Boolean).slice(0, PROMOTION_VERSION_HISTORY_LIMIT),
  };
};

const buildRetrievalPromotionGraph = ({ promotionRecord, userId } = {}) => {
  if (!promotionRecord?.id) return null;
  const pageNodeId = `wiki:${promotionRecord.pageId || promotionRecord.id}`;
  const promotionNodeId = `promotion:${promotionRecord.id}`;
  const nodes = [
    {
      id: pageNodeId,
      kind: 'WikiPage',
      props: {
        title: promotionRecord.title,
        pageId: promotionRecord.pageId,
        query: promotionRecord.query,
        reviewState: promotionRecord.reviewState,
        promotedAt: promotionRecord.createdAt,
        updatedAt: promotionRecord.updatedAt,
        promotedBy: promotionRecord.createdBy,
        version: promotionRecord.version || 1,
        revisionId: promotionRecord.revisionId,
        userId,
      },
    },
    {
      id: promotionNodeId,
      kind: 'WikiPromotion',
      props: {
        name: promotionRecord.title,
        promotionId: promotionRecord.id,
        publishMode: promotionRecord.publishMode,
        citationCount: promotionRecord.citationLedger?.length || 0,
        sectionCount: promotionRecord.sections?.length || 0,
        version: promotionRecord.version || 1,
        revisionId: promotionRecord.revisionId,
      },
    },
  ];
  const edges = [
    {
      from: promotionNodeId,
      to: pageNodeId,
      kind: 'PROMOTED_WIKI_PAGE',
      props: {
        reviewState: promotionRecord.reviewState,
        promotedAt: promotionRecord.createdAt,
      },
    },
  ];

  (promotionRecord.sections || []).forEach((section, index) => {
    const sectionNodeId = `${pageNodeId}:section:${slugifyTextForId(section.heading) || index + 1}`;
    nodes.push({
      id: sectionNodeId,
      kind: 'WikiSection',
      props: {
        title: section.heading,
        textPreview: truncateRetrievalText(section.text, 500),
        reviewState: section.reviewState,
        ordinal: index + 1,
      },
    });
    edges.push({
      from: pageNodeId,
      to: sectionNodeId,
      kind: 'HAS_SECTION',
      props: { ordinal: index + 1, reviewState: section.reviewState },
    });
  });

  (promotionRecord.citationLedger || []).forEach((citation, index) => {
    const citationNodeId = citation.sourceDocumentId
      ? `source-document:${citation.sourceDocumentId}`
      : `citation:${slugifyTextForId(citation.id) || index + 1}`;
    nodes.push({
      id: citationNodeId,
      kind: 'SourceDocument',
      props: {
        title: citation.sourceTitle,
        sourceDocumentId: citation.sourceDocumentId,
        pageId: citation.pageId,
        chunkId: citation.chunkId,
        objectId: citation.objectId,
        evidenceState: citation.evidenceState,
      },
    });
    edges.push({
      from: pageNodeId,
      to: citationNodeId,
      kind: 'CITES',
      props: {
        marker: citation.marker || `[${index + 1}]`,
        chunkId: citation.chunkId,
        objectId: citation.objectId,
        evidenceState: citation.evidenceState,
      },
    });
  });

  return { nodes, edges };
};

const buildRetrievalAnswerDraft = ({ query = '', graphSearch = {}, chunkSearch = {}, vectorSearch = {} } = {}) => {
  const normalizedQuery = normalizeRetrievalQuery(query);
  if (!normalizedQuery || normalizedQuery.length < 2) {
    const emptySynthesis = buildReviewedCitationSynthesis();
    return {
      status: 'empty-query',
      trustLevel: 'no-query',
      title: 'Wiki answer draft',
      lead: 'Enter a search query to draft a wiki answer from reviewed Case Wiki sources.',
      outline: [],
      citations: [],
      candidateCitations: [],
      synthesis: emptySynthesis,
      promotionPreview: buildRetrievalPromotionPreview({ synthesis: emptySynthesis }),
      warnings: ['No retrieval query was provided.'],
      nextActions: ['Search for a person, project, service, claim, file, or topic.'],
    };
  }

  const chunkResults = Array.isArray(chunkSearch.results) ? chunkSearch.results : [];
  const vectorResults = vectorSearch.status === 'ready' && Array.isArray(vectorSearch.results) ? vectorSearch.results : [];
  const graphResults = Array.isArray(graphSearch.results) ? graphSearch.results : [];
  const reviewedChunkCitations = chunkResults
    .filter((result) => result.eligibleForVector || result.status === 'approved-for-embedding')
    .map((result) => buildRetrievalDraftCitation(result, 'reviewed'));
  const vectorCitations = vectorResults.map((result) => buildRetrievalDraftCitation(result, 'reviewed-vector'));
  const citations = uniqueDraftCitations([...vectorCitations, ...reviewedChunkCitations], 6);
  const candidateCitations = uniqueDraftCitations(
    chunkResults
      .filter((result) => !result.eligibleForVector && result.status !== 'approved-for-embedding')
      .map((result) => buildRetrievalDraftCitation(result, 'candidate')),
    6,
  );
  const topGraphTitles = compactStringArray(graphResults.map((result) => result.title || result.fileName), 5);
  const citedTitles = compactStringArray(citations.map((citation) => citation.sourceTitle), 5);
  const candidateTitles = compactStringArray(candidateCitations.map((citation) => citation.sourceTitle), 5);
  const hasReviewedEvidence = citations.length > 0;
  const hasCandidateEvidence = candidateCitations.length > 0 || topGraphTitles.length > 0;

  if (!hasReviewedEvidence) {
    const candidateOutline = [
      {
        heading: 'Review needed',
        text: candidateTitles.length
          ? `Candidate source pages include ${candidateTitles.join(', ')}. Review the chunks before using them as wiki evidence.`
          : 'No candidate chunks matched strongly enough to draft from source text.',
        citationIds: candidateCitations.map((citation) => citation.id),
        reviewState: 'needs-human-review',
      },
      {
        heading: 'Graph context',
        text: topGraphTitles.length
          ? `The graph/source index also points to ${topGraphTitles.join(', ')}. These links can guide review, but they are not enough for a cited answer by themselves.`
          : 'No graph/source context is available for this query yet.',
        citationIds: [],
        reviewState: 'context-only',
      },
      {
        heading: 'Next editorial action',
        text: 'Open the strongest candidate source, approve or reject its chunks, then rerun retrieval to produce a reviewed answer draft.',
        citationIds: [],
        reviewState: 'action-required',
      },
    ];
    const candidateSynthesis = buildReviewedCitationSynthesis({
      normalizedQuery,
      citations: [],
      candidateCitations,
      outline: candidateOutline,
      topGraphTitles,
    });
    return {
      status: hasCandidateEvidence ? 'needs-review' : 'empty',
      trustLevel: hasCandidateEvidence ? 'candidate-only' : 'no-evidence',
      title: `Draft article: ${normalizedQuery}`,
      lead: hasCandidateEvidence
        ? `The wiki found candidate material for "${normalizedQuery}", but no matching chunk has been approved for embedding or answer synthesis yet. Treat this as an editorial queue, not a settled article.`
        : `No source-backed draft can be created for "${normalizedQuery}" yet.`,
      outline: candidateOutline,
      citations: [],
      candidateCitations,
      synthesis: candidateSynthesis,
      promotionPreview: buildRetrievalPromotionPreview({
        normalizedQuery,
        citations: [],
        candidateCitations,
        topGraphTitles,
        synthesis: candidateSynthesis,
      }),
      warnings: ['Answer synthesis is blocked until at least one matching chunk is approved.'],
      nextActions: ['Open a candidate source', 'Review matching chunks', 'Approve only the chunks that should become searchable memory'],
    };
  }

  const reviewedOutline = [
    {
      heading: 'Definition and scope',
      text: `The reviewed evidence connects "${normalizedQuery}" to ${citedTitles.join(', ')}. This section should become the stable lead once citations are checked.`,
      citationIds: citations.slice(0, 3).map((citation) => citation.id),
      reviewState: 'reviewed-evidence',
    },
    {
      heading: 'Source trail',
      text: `The draft uses ${citations.length} reviewed citation${citations.length === 1 ? '' : 's'} and ${candidateCitations.length} candidate citation${candidateCitations.length === 1 ? '' : 's'} waiting for human review.`,
      citationIds: citations.map((citation) => citation.id),
      reviewState: 'citation-ledger',
    },
    {
      heading: 'Open questions',
      text: candidateCitations.length
        ? `Candidate sources such as ${candidateTitles.join(', ')} should be reviewed before they are folded into the article.`
        : 'No candidate source gaps are visible from this retrieval pass.',
      citationIds: candidateCitations.map((citation) => citation.id),
      reviewState: candidateCitations.length ? 'needs-human-review' : 'reviewed-evidence',
    },
  ];
  const reviewedSynthesis = buildReviewedCitationSynthesis({
    normalizedQuery,
    citations,
    candidateCitations,
    outline: reviewedOutline,
    topGraphTitles,
  });

  return {
    status: 'ready',
    trustLevel: vectorCitations.length ? 'reviewed-vector-backed' : 'reviewed-source-backed',
    title: `Draft article: ${normalizedQuery}`,
    lead: `Based on reviewed Case Wiki evidence, "${normalizedQuery}" is currently grounded in ${citedTitles.join(', ')}${topGraphTitles.length ? `, with related graph context from ${topGraphTitles.join(', ')}` : ''}.`,
    outline: reviewedOutline,
    citations,
    candidateCitations,
    synthesis: reviewedSynthesis,
    promotionPreview: buildRetrievalPromotionPreview({
      normalizedQuery,
      citations,
      candidateCitations,
      topGraphTitles,
      synthesis: reviewedSynthesis,
    }),
    warnings: candidateCitations.length ? ['Some matching sources are still pending review and are excluded from the reviewed lead.'] : [],
    nextActions: ['Check citation previews', 'Open candidate sources that still need review', 'Promote reviewed points into the article body'],
  };
};

const toIsoString = (value) => {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
};

const cleanFrontendAccessRole = (role = '') =>
  ['viewer', 'editor', 'manager'].includes(role) ? role : 'viewer';

const cleanFrontendAccessRoles = (roles = {}) => {
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) return {};
  return Object.fromEntries(
    Object.entries(roles)
      .map(([teammate, role]) => [String(teammate || '').trim(), cleanFrontendAccessRole(role)])
      .filter(([teammate]) => Boolean(teammate)),
  );
};

const cleanFrontendActivityRecords = (records = []) =>
  (Array.isArray(records) ? records : [])
    .filter((record) => record && typeof record === 'object' && !Array.isArray(record))
    .slice(0, 50);

const provenanceLensRoleRank = {
  viewer: 1,
  editor: 2,
  manager: 3,
};

const cleanProvenanceLensActor = (actor = '') => {
  const normalized = String(actor || '').trim();
  return normalized || 'Current worker';
};

const provenanceLensRecordRoleFor = (record = {}, actor = '') => {
  const viewer = cleanProvenanceLensActor(actor);
  const createdBy = cleanProvenanceLensActor(record.createdBy);
  const sharedWith = Array.isArray(record.sharedWith)
    ? record.sharedWith.map(cleanProvenanceLensActor).filter(Boolean)
    : [];
  const accessRole = cleanFrontendAccessRole(record.accessRole || 'viewer');
  const accessRoles = cleanFrontendAccessRoles(record.accessRoles);
  if (createdBy === viewer) return 'manager';
  if (sharedWith.includes(viewer)) return accessRoles[viewer] || accessRole || 'viewer';
  if (record.visibility === 'team' && !sharedWith.length) return accessRole || 'viewer';
  return null;
};

const provenanceLensRecordCan = (record = {}, actor = '', minimumRole = 'viewer') => {
  const role = provenanceLensRecordRoleFor(record, actor);
  return Boolean(role && provenanceLensRoleRank[role] >= provenanceLensRoleRank[minimumRole]);
};

const stableStringify = (value) => JSON.stringify(value || {});

const sharedProvenanceLensAccessChanged = (existingRecord = {}, nextLens = {}) => {
  const existingSharedWith = Array.isArray(existingRecord.sharedWith)
    ? existingRecord.sharedWith.map(cleanProvenanceLensActor).sort()
    : [];
  const nextSharedWith = Array.isArray(nextLens.sharedWith)
    ? nextLens.sharedWith.map(cleanProvenanceLensActor).sort()
    : [];
  return (
    stableStringify(existingSharedWith) !== stableStringify(nextSharedWith) ||
    cleanFrontendAccessRole(existingRecord.accessRole || 'viewer') !== cleanFrontendAccessRole(nextLens.accessRole || 'viewer') ||
    stableStringify(cleanFrontendAccessRoles(existingRecord.accessRoles)) !==
      stableStringify(cleanFrontendAccessRoles(nextLens.accessRoles))
  );
};

const cleanProvenanceLensExportFormat = (format = '') =>
  ['json', 'csv', 'markdown'].includes(format) ? format : 'json';

const cleanProvenanceLensExportAuditType = (exportType = '') =>
  [
    'graph-provenance-lens-activity',
    'graph-provenance-lens-activity-repair-ledger',
    'graph-provenance-lens-activity-inspection',
  ].includes(exportType)
    ? exportType
    : 'all';

const escapeCsvCell = (value = '') => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const rowsToCsv = (rows = []) => rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');

const makeProvenanceLensActivityExportRows = (records = []) =>
  records.flatMap((record) => {
    const activities = Array.isArray(record.activityRecords) ? record.activityRecords : [];
    return activities.map((activity) => ({
      lensId: record.lensId || record.id || '',
      lensName: record.name || 'Saved provenance lens',
      lensCreatedBy: record.createdBy || 'Current worker',
      lensVisibility: record.visibility || 'private',
      lensSharedWith: Array.isArray(record.sharedWith) ? record.sharedWith.join(', ') : '',
      lensDefaultAccessRole: cleanFrontendAccessRole(record.accessRole || 'manager'),
      activityId: activity.id || '',
      activityType: activity.type || 'activity',
      activityActor: activity.actor || 'Current worker',
      activityCreatedAt: toIsoString(activity.createdAt) || '',
      activityDetail: activity.detail || '',
      activitySharedWith: Array.isArray(activity.sharedWith) ? activity.sharedWith.join(', ') : '',
      activityAccessRole: activity.accessRole || '',
    }));
  });

const buildProvenanceLensActivityExport = ({ records = [], actor = 'Current worker', format = 'json' }) => {
  const rows = makeProvenanceLensActivityExportRows(records);
  const exportedAt = new Date().toISOString();
  const payload = {
    exportedFrom: 'Street Voices Case Wiki',
    exportedAt,
    exportType: 'graph-provenance-lens-activity',
    actor,
    privacyNote:
      'Metadata-only provenance lens activity export. Source text, source files, and graph payloads are not included.',
    lensCount: records.length,
    activityCount: rows.length,
    lenses: records.map((record) => ({
      id: record.lensId || record.id || '',
      name: record.name || 'Saved provenance lens',
      createdBy: record.createdBy || 'Current worker',
      visibility: record.visibility || 'private',
      sharedWith: Array.isArray(record.sharedWith) ? record.sharedWith : [],
      accessRole: cleanFrontendAccessRole(record.accessRole || 'manager'),
      updatedAt: toIsoString(record.lensUpdatedAt || record.updatedAt) || '',
      activityCount: Array.isArray(record.activityRecords) ? record.activityRecords.length : 0,
    })),
    activityRecords: rows,
  };
  if (format === 'csv') {
    return {
      payload,
      contentType: 'text/csv',
      extension: 'csv',
      content: rowsToCsv([
        [
          'lens_id',
          'lens_name',
          'lens_created_by',
          'lens_visibility',
          'lens_shared_with',
          'lens_default_access_role',
          'activity_id',
          'activity_type',
          'activity_actor',
          'activity_created_at',
          'activity_detail',
          'activity_shared_with',
          'activity_access_role',
        ],
        ...rows.map((row) => [
          row.lensId,
          row.lensName,
          row.lensCreatedBy,
          row.lensVisibility,
          row.lensSharedWith,
          row.lensDefaultAccessRole,
          row.activityId,
          row.activityType,
          row.activityActor,
          row.activityCreatedAt,
          row.activityDetail,
          row.activitySharedWith,
          row.activityAccessRole,
        ]),
      ]),
    };
  }
  if (format === 'markdown') {
    const activityRows = rows
      .map(
        (row) =>
          `| ${row.activityCreatedAt || 'unknown'} | ${row.lensName.replace(/\|/g, '\\|')} | ${row.activityType} | ${row.activityActor.replace(/\|/g, '\\|')} | ${row.activityDetail.replace(/\|/g, '\\|')} |`,
      )
      .join('\n');
    return {
      payload,
      contentType: 'text/markdown',
      extension: 'md',
      content: [
        '# Case Wiki Provenance Lens Activity',
        '',
        'Metadata-only provenance lens activity export. Source text, source files, and graph payloads are not included.',
        '',
        `- Exported: ${exportedAt}`,
        `- Manager: ${actor}`,
        `- Lenses: ${records.length}`,
        `- Activity records: ${rows.length}`,
        '',
        '| Activity time | Lens | Type | Actor | Detail |',
        '| --- | --- | --- | --- | --- |',
        activityRows || '| No activity records visible to this manager |  |  |  |  |',
        '',
      ].join('\n'),
    };
  }
  return {
    payload,
    contentType: 'application/json',
    extension: 'json',
    content: JSON.stringify(payload, null, 2),
  };
};

const makeFrontendProvenanceLensExportAudit = (record = {}) => ({
  id: record.auditId || record.id || '',
  exportType: record.exportType || 'graph-provenance-lens-activity',
  format: cleanProvenanceLensExportFormat(record.format || 'json'),
  filename: record.filename || '',
  contentType: record.contentType || '',
  createdAt: toIsoString(record.exportedAt || record.createdAt) || new Date().toISOString(),
  actor: record.actor || 'Current worker',
  privacyNote:
    record.privacyNote ||
    'Metadata-only provenance lens activity export. Source text, source files, and graph payloads are not included.',
  lensCount: Number(record.lensCount) || 0,
  activityCount: Number(record.activityCount) || 0,
  visibleLensIds: Array.isArray(record.visibleLensIds) ? record.visibleLensIds.filter(Boolean) : [],
});

const makeProvenanceLensActivityReviewQueue = (records = [], actor = 'Current worker') =>
  records
    .filter((record) => provenanceLensRecordCan(record, actor, 'manager'))
    .map((record) => {
      const activities = Array.isArray(record.activityRecords) ? record.activityRecords.filter(Boolean) : [];
      const activityTypes = new Set(activities.map((activity) => activity?.type).filter(Boolean));
      const backfilledRepairTypes = new Set(
        activities
          .filter((activity) => activity?.type === 'backfilled')
          .map((activity) => activity?.repairType)
          .filter(Boolean),
      );
      const hasActivityOrBackfill = (activityType) =>
        activityTypes.has(activityType) || backfilledRepairTypes.has(activityType);
      const reasons = [];
      if (!activities.length) reasons.push('No activity history has been captured yet');
      if (activities.length > 0 && !hasActivityOrBackfill('created')) reasons.push('Missing original created activity');
      if ((record.sharedWith || []).length && !hasActivityOrBackfill('shared')) reasons.push('Missing sharing activity');
      if (record.neo4jStatus && !hasActivityOrBackfill('server-synced')) reasons.push('Missing server sync activity');
      return {
        id: `provenance-lens-activity-review:${record.lensId || record.id || ''}`,
        lensId: record.lensId || record.id || '',
        lensName: record.name || 'Saved provenance lens',
        createdBy: record.createdBy || 'Current worker',
        updatedAt: toIsoString(record.lensUpdatedAt || record.updatedAt) || '',
        visibility: record.visibility || 'private',
        sharedWith: Array.isArray(record.sharedWith) ? record.sharedWith.filter(Boolean) : [],
        accessRole: cleanFrontendAccessRole(record.accessRole || 'manager'),
        activityCount: activities.length,
        reviewStatus: activities.length ? 'thin-activity-history' : 'missing-activity-history',
        priority: activities.length ? 'medium' : 'high',
        reasons,
      };
    })
    .filter((item) => item.lensId && item.reasons.length)
    .sort((left, right) => {
      if (left.priority !== right.priority) return left.priority === 'high' ? -1 : 1;
      return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
    })
    .slice(0, 12);

const buildProvenanceLensBackfillActivities = (record = {}, actor = 'Current worker') => {
  const lensId = record.lensId || record.id || '';
  const activities = Array.isArray(record.activityRecords) ? record.activityRecords.filter(Boolean) : [];
  const activityTypes = new Set(activities.map((activity) => activity?.type).filter(Boolean));
  const backfilledRepairTypes = new Set(
    activities
      .filter((activity) => activity?.type === 'backfilled')
      .map((activity) => activity?.repairType)
      .filter(Boolean),
  );
  const needsRepair = (activityType) => !activityTypes.has(activityType) && !backfilledRepairTypes.has(activityType);
  const repairs = [];
  if (!activities.length || needsRepair('created')) {
    repairs.push({
      repairType: 'created',
      reason: activities.length
        ? 'Missing original created activity'
        : 'No activity history has been captured yet',
      detail: `Backfilled missing created activity for ${record.name || 'saved provenance lens'}.`,
    });
  }
  if ((record.sharedWith || []).length && needsRepair('shared')) {
    repairs.push({
      repairType: 'shared',
      reason: 'Missing sharing activity',
      detail: `Backfilled sharing activity for ${record.name || 'saved provenance lens'}.`,
    });
  }
  if (record.neo4jStatus && needsRepair('server-synced')) {
    repairs.push({
      repairType: 'server-synced',
      reason: 'Missing server sync activity',
      detail: `Backfilled Neo4j sync activity for ${record.name || 'saved provenance lens'}.`,
    });
  }
  const repairedAt = new Date().toISOString();
  return repairs.map((repair, index) => ({
    id: `provenance-lens-backfill-${crypto.randomUUID()}`,
    type: 'backfilled',
    repairType: repair.repairType,
    backfilled: true,
    actor,
    detail: repair.detail,
    reason: repair.reason,
    createdAt: new Date(new Date(repairedAt).getTime() + index).toISOString(),
    sharedWith: Array.isArray(record.sharedWith) ? record.sharedWith.filter(Boolean) : [],
    accessRole: cleanFrontendAccessRole(record.accessRole || 'manager'),
    lensId,
  }));
};

const makeProvenanceLensSavePayloadFromRecord = (record = {}, updates = {}) => ({
  id: record.lensId || record.id || '',
  name: record.name || 'Saved provenance lens',
  query: record.query || '',
  reviewFilter: record.reviewFilter || 'all',
  domainFilter: record.domainFilter || 'all',
  browserScope: record.browserScope || 'active-domain',
  resultCount: Number(record.resultCount) || 0,
  matchingWorkspaceCount: Number(record.matchingWorkspaceCount) || 0,
  createdAt: toIsoString(record.lensCreatedAt || record.createdAt) || new Date().toISOString(),
  updatedAt: toIsoString(record.lensUpdatedAt || record.updatedAt) || new Date().toISOString(),
  createdBy: record.createdBy || 'Current worker',
  visibility: record.visibility || 'private',
  sharedWith: Array.isArray(record.sharedWith) ? record.sharedWith.filter(Boolean) : [],
  shareNote: record.shareNote || '',
  accessRole: cleanFrontendAccessRole(record.accessRole || 'manager'),
  accessRoles: cleanFrontendAccessRoles(record.accessRoles),
  activityRecords: Array.isArray(record.activityRecords) ? record.activityRecords.filter(Boolean) : [],
  ...updates,
});

const cleanProvenanceLensRepairType = (repairType = '') =>
  ['created', 'shared', 'server-synced'].includes(repairType) ? repairType : 'all';

const cleanProvenanceLensInspectionFilter = (inspectionFilter = '') =>
  ['all', 'inspected', 'needs-inspection'].includes(inspectionFilter) ? inspectionFilter : 'all';

const makeProvenanceLensActivityRepairLedger = (records = [], actor = 'Current worker', repairType = 'all') => {
  const selectedRepairType = cleanProvenanceLensRepairType(repairType);
  return records
    .filter((record) => provenanceLensRecordCan(record, actor, 'manager'))
    .flatMap((record) => {
      const lensId = record.lensId || record.id || '';
      return (Array.isArray(record.activityRecords) ? record.activityRecords : [])
        .filter((activity) => activity?.type === 'backfilled')
        .filter((activity) => selectedRepairType === 'all' || activity?.repairType === selectedRepairType)
        .map((activity) => ({
          id: activity.id || `repair-ledger:${lensId}:${activity.repairType || 'unknown'}`,
          lensId,
          lensName: record.name || 'Saved provenance lens',
          repairType: activity.repairType || 'unknown',
          reason: activity.reason || '',
          detail: activity.detail || '',
          actor: activity.actor || 'Current worker',
          createdAt: toIsoString(activity.createdAt) || '',
          sharedWith: Array.isArray(activity.sharedWith) ? activity.sharedWith.filter(Boolean) : [],
          accessRole: cleanFrontendAccessRole(activity.accessRole || record.accessRole || 'manager'),
        }));
    })
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
    .slice(0, 50);
};

const buildProvenanceLensActivityRepairLedgerExport = ({
  repairLedger = [],
  actor = 'Current worker',
  repairType = 'all',
  format = 'json',
}) => {
  const exportedAt = new Date().toISOString();
  const lensIds = Array.from(new Set(repairLedger.map((repair) => repair.lensId).filter(Boolean)));
  const payload = {
    exportedFrom: 'Street Voices Case Wiki',
    exportedAt,
    exportType: 'graph-provenance-lens-activity-repair-ledger',
    actor,
    repairType: cleanProvenanceLensRepairType(repairType),
    privacyNote:
      'Metadata-only provenance lens repair export. Source text, source files, and graph payloads are not included.',
    lensCount: lensIds.length,
    repairCount: repairLedger.length,
    repairs: repairLedger,
  };
  if (format === 'csv') {
    return {
      payload,
      contentType: 'text/csv',
      extension: 'csv',
      content: rowsToCsv([
        [
          'repair_id',
          'lens_id',
          'lens_name',
          'repair_type',
          'reason',
          'detail',
          'actor',
          'created_at',
          'shared_with',
          'access_role',
        ],
        ...repairLedger.map((repair) => [
          repair.id,
          repair.lensId,
          repair.lensName,
          repair.repairType,
          repair.reason,
          repair.detail,
          repair.actor,
          repair.createdAt,
          repair.sharedWith.join(', '),
          repair.accessRole,
        ]),
      ]),
    };
  }
  if (format === 'markdown') {
    return {
      payload,
      contentType: 'text/markdown',
      extension: 'md',
      content: [
        '# Case Wiki Provenance Lens Repair Ledger',
        '',
        'Metadata-only provenance lens repair export. Source text, source files, and graph payloads are not included.',
        '',
        `- Exported: ${exportedAt}`,
        `- Manager: ${actor}`,
        `- Repair filter: ${payload.repairType}`,
        `- Lenses: ${lensIds.length}`,
        `- Repairs: ${repairLedger.length}`,
        '',
        '| Repair time | Lens | Repair type | Actor | Reason |',
        '| --- | --- | --- | --- | --- |',
        ...(repairLedger.length
          ? repairLedger.map(
              (repair) =>
                `| ${repair.createdAt || 'unknown'} | ${repair.lensName.replace(/\|/g, '\\|')} | ${repair.repairType} | ${repair.actor.replace(/\|/g, '\\|')} | ${(repair.reason || repair.detail).replace(/\|/g, '\\|')} |`,
            )
          : ['| No repair records match this filter |  |  |  |  |']),
        '',
      ].join('\n'),
    };
  }
  return {
    payload,
    contentType: 'application/json',
    extension: 'json',
    content: JSON.stringify(payload, null, 2),
  };
};

const makeProvenanceLensActivityInspectionLedger = (records = [], actor = 'Current worker', repairType = 'all') => {
  const selectedRepairType = cleanProvenanceLensRepairType(repairType);
  return records
    .filter((record) => provenanceLensRecordCan(record, actor, 'manager'))
    .flatMap((record) => {
      const lensId = record.lensId || record.id || '';
      const activities = Array.isArray(record.activityRecords) ? record.activityRecords.filter(Boolean) : [];
      const repairedActivitiesById = new Map(
        activities
          .filter((activity) => activity?.type === 'backfilled')
          .map((activity) => [activity.id, activity]),
      );
      return activities
        .filter((activity) => activity?.type === 'opened' && activity?.inspectionType === 'repaired-edge-drilldown')
        .map((activity) => {
          const repairedActivity = repairedActivitiesById.get(activity.inspectedActivityId) || {};
          return {
            id: activity.id || `inspection-ledger:${lensId}:${activity.inspectedActivityId || 'unknown'}`,
            lensId,
            lensName: record.name || 'Saved provenance lens',
            inspectionType: activity.inspectionType || 'repaired-edge-drilldown',
            inspectedActivityId: activity.inspectedActivityId || '',
            inspectedEdgeId: activity.inspectedEdgeId || '',
            inspectedRelationshipKind: activity.inspectedRelationshipKind || '',
            inspectedVirtualRelationshipType: activity.inspectedVirtualRelationshipType || 'HAS_REPAIRED_ACTIVITY',
            repairType: activity.repairType || repairedActivity.repairType || 'unknown',
            repairedActivityReason: repairedActivity.reason || '',
            repairedActivityCreatedAt: toIsoString(repairedActivity.createdAt) || '',
            reason: activity.reason || '',
            detail: activity.detail || '',
            actor: activity.actor || 'Current worker',
            createdAt: toIsoString(activity.createdAt) || '',
            sharedWith: Array.isArray(activity.sharedWith) ? activity.sharedWith.filter(Boolean) : [],
            accessRole: cleanFrontendAccessRole(activity.accessRole || record.accessRole || 'manager'),
          };
        })
        .filter((inspection) => selectedRepairType === 'all' || inspection.repairType === selectedRepairType);
    })
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
    .slice(0, 100);
};

const makeProvenanceLensActivityInspectionSummary = (records = [], actor = 'Current worker', repairType = 'all') => {
  const inspectionLedger = makeProvenanceLensActivityInspectionLedger(records, actor, repairType);
  const summariesByKey = new Map();
  inspectionLedger.forEach((inspection) => {
    const key = [inspection.lensId, inspection.repairType, inspection.actor].join('::');
    const existing = summariesByKey.get(key) || {
      id: `inspection-summary:${inspection.lensId}:${inspection.repairType}:${inspection.actor}`,
      lensId: inspection.lensId,
      lensName: inspection.lensName,
      repairType: inspection.repairType,
      reviewer: inspection.actor,
      inspectionCount: 0,
      inspectedActivityIds: new Set(),
      inspectedEdgeIds: new Set(),
      relationshipTypes: new Set(),
      firstInspectedAt: inspection.createdAt,
      latestInspectedAt: inspection.createdAt,
      latestReason: '',
      latestDetail: '',
    };
    existing.inspectionCount += 1;
    if (inspection.inspectedActivityId) existing.inspectedActivityIds.add(inspection.inspectedActivityId);
    if (inspection.inspectedEdgeId) existing.inspectedEdgeIds.add(inspection.inspectedEdgeId);
    if (inspection.inspectedVirtualRelationshipType) {
      existing.relationshipTypes.add(inspection.inspectedVirtualRelationshipType);
    }
    const currentCreatedAt = new Date(inspection.createdAt || 0).getTime();
    if (currentCreatedAt < new Date(existing.firstInspectedAt || 0).getTime()) {
      existing.firstInspectedAt = inspection.createdAt;
    }
    if (currentCreatedAt >= new Date(existing.latestInspectedAt || 0).getTime()) {
      existing.latestInspectedAt = inspection.createdAt;
      existing.latestReason = inspection.reason || '';
      existing.latestDetail = inspection.detail || '';
    }
    summariesByKey.set(key, existing);
  });

  const summaries = Array.from(summariesByKey.values())
    .map((summary) => ({
      ...summary,
      inspectedActivityIds: Array.from(summary.inspectedActivityIds),
      inspectedEdgeIds: Array.from(summary.inspectedEdgeIds),
      relationshipTypes: Array.from(summary.relationshipTypes),
      reviewPattern:
        summary.inspectionCount >= 3
          ? 'repeated-handoff'
          : summary.inspectionCount === 2
            ? 'follow-up-handoff'
            : 'single-handoff',
    }))
    .sort((left, right) => new Date(right.latestInspectedAt || 0).getTime() - new Date(left.latestInspectedAt || 0).getTime())
    .slice(0, 24);

  return {
    actor,
    repairType: cleanProvenanceLensRepairType(repairType),
    generatedAt: new Date().toISOString(),
    summaryCount: summaries.length,
    inspectionCount: inspectionLedger.length,
    lensCount: new Set(summaries.map((summary) => summary.lensId)).size,
    reviewerCount: new Set(summaries.map((summary) => summary.reviewer)).size,
    repairTypeCount: new Set(summaries.map((summary) => summary.repairType)).size,
    summaries,
  };
};

const addDaysIso = (value, days) => {
  const baseDate = new Date(value || Date.now());
  const date = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
};

const makeProvenanceLensActivityInspectionWorkload = (records = [], actor = 'Current worker', repairType = 'all') => {
  const inspectionSummary = makeProvenanceLensActivityInspectionSummary(records, actor, repairType);
  const workloadsByReviewer = new Map();

  inspectionSummary.summaries.forEach((summary) => {
    const reviewer = cleanProvenanceLensActor(summary.reviewer);
    const existing = workloadsByReviewer.get(reviewer) || {
      id: `inspection-workload:${reviewer}`,
      reviewer,
      inspectionCount: 0,
      summaryCount: 0,
      lensIds: new Set(),
      repairTypes: new Set(),
      relationshipTypes: new Set(),
      singleHandoffCount: 0,
      followUpHandoffCount: 0,
      repeatedHandoffCount: 0,
      openFollowUpCount: 0,
      assignedFollowUps: [],
      latestInspectedAt: summary.latestInspectedAt,
    };

    existing.inspectionCount += summary.inspectionCount;
    existing.summaryCount += 1;
    if (summary.lensId) existing.lensIds.add(summary.lensId);
    if (summary.repairType) existing.repairTypes.add(summary.repairType);
    (summary.relationshipTypes || []).forEach((type) => existing.relationshipTypes.add(type));
    if (summary.reviewPattern === 'repeated-handoff') {
      existing.repeatedHandoffCount += 1;
    } else if (summary.reviewPattern === 'follow-up-handoff') {
      existing.followUpHandoffCount += 1;
    } else {
      existing.singleHandoffCount += 1;
    }
    if (new Date(summary.latestInspectedAt || 0).getTime() >= new Date(existing.latestInspectedAt || 0).getTime()) {
      existing.latestInspectedAt = summary.latestInspectedAt;
    }

    if (summary.inspectionCount >= 2) {
      const repeated = summary.inspectionCount >= 3;
      existing.openFollowUpCount += 1;
      existing.assignedFollowUps.push({
        id: `inspection-follow-up:${summary.id}`,
        reviewer,
        assignee: reviewer,
        lensId: summary.lensId,
        lensName: summary.lensName,
        repairType: summary.repairType,
        priority: repeated ? 'high' : 'medium',
        dueAt: addDaysIso(summary.latestInspectedAt, repeated ? 1 : 2),
        title: repeated
          ? `Escalate repeated repaired-edge handoff for ${summary.lensName}`
          : `Confirm repaired-edge handoff owner for ${summary.lensName}`,
        reason: repeated
          ? `${reviewer} inspected this repaired activity path ${summary.inspectionCount} times. Assign follow-up so the handoff becomes owned work.`
          : `${reviewer} reopened this repaired activity path. Confirm the owner before it becomes repeated handoff noise.`,
        reviewPattern: summary.reviewPattern,
        inspectionCount: summary.inspectionCount,
        relationshipTypes: summary.relationshipTypes || [],
        latestInspectedAt: summary.latestInspectedAt,
      });
    }

    workloadsByReviewer.set(reviewer, existing);
  });

  const workloads = Array.from(workloadsByReviewer.values())
    .map((workload) => {
      const escalationLevel =
        workload.repeatedHandoffCount >= 2 || workload.inspectionCount >= 6
          ? 'urgent-escalation'
          : workload.repeatedHandoffCount >= 1 || workload.followUpHandoffCount >= 2
            ? 'manager-review'
            : workload.openFollowUpCount >= 1
              ? 'watch'
              : 'clear';
      const capacityStatus =
        workload.openFollowUpCount >= 3 || workload.inspectionCount >= 8
          ? 'overloaded'
          : workload.openFollowUpCount >= 2 || workload.repeatedHandoffCount >= 1
            ? 'attention'
            : 'balanced';
      return {
        ...workload,
        lensIds: Array.from(workload.lensIds),
        repairTypes: Array.from(workload.repairTypes),
        relationshipTypes: Array.from(workload.relationshipTypes),
        lensCount: workload.lensIds.size,
        repairTypeCount: workload.repairTypes.size,
        escalationLevel,
        capacityStatus,
        assignedFollowUps: workload.assignedFollowUps.sort(
          (left, right) => new Date(left.dueAt || 0).getTime() - new Date(right.dueAt || 0).getTime(),
        ),
      };
    })
    .sort((left, right) => {
      const escalationRank = { 'urgent-escalation': 4, 'manager-review': 3, watch: 2, clear: 1 };
      return (
        (escalationRank[right.escalationLevel] || 0) - (escalationRank[left.escalationLevel] || 0) ||
        right.openFollowUpCount - left.openFollowUpCount ||
        new Date(right.latestInspectedAt || 0).getTime() - new Date(left.latestInspectedAt || 0).getTime()
      );
    });

  return {
    actor,
    repairType: cleanProvenanceLensRepairType(repairType),
    generatedAt: inspectionSummary.generatedAt,
    workloadCount: workloads.length,
    openFollowUpCount: workloads.reduce((total, workload) => total + workload.openFollowUpCount, 0),
    escalationCount: workloads.filter((workload) =>
      ['manager-review', 'urgent-escalation'].includes(workload.escalationLevel),
    ).length,
    highestEscalation: workloads[0]?.escalationLevel || 'clear',
    workloads,
  };
};

const buildProvenanceLensActivityInspectionExport = ({
  inspectionLedger = [],
  actor = 'Current worker',
  repairType = 'all',
  format = 'json',
}) => {
  const exportedAt = new Date().toISOString();
  const lensIds = Array.from(new Set(inspectionLedger.map((inspection) => inspection.lensId).filter(Boolean)));
  const payload = {
    exportedFrom: 'Street Voices Case Wiki',
    exportedAt,
    exportType: 'graph-provenance-lens-activity-inspection',
    actor,
    repairType: cleanProvenanceLensRepairType(repairType),
    privacyNote:
      'Metadata-only repaired-edge inspection export. Source text, source files, and graph payloads are not included.',
    lensCount: lensIds.length,
    inspectionCount: inspectionLedger.length,
    inspections: inspectionLedger,
  };
  if (format === 'csv') {
    return {
      payload,
      contentType: 'text/csv',
      extension: 'csv',
      content: rowsToCsv([
        [
          'inspection_id',
          'lens_id',
          'lens_name',
          'repair_type',
          'inspected_activity_id',
          'inspected_edge_id',
          'relationship_kind',
          'virtual_relationship_type',
          'actor',
          'created_at',
          'reason',
          'detail',
          'access_role',
        ],
        ...inspectionLedger.map((inspection) => [
          inspection.id,
          inspection.lensId,
          inspection.lensName,
          inspection.repairType,
          inspection.inspectedActivityId,
          inspection.inspectedEdgeId,
          inspection.inspectedRelationshipKind,
          inspection.inspectedVirtualRelationshipType,
          inspection.actor,
          inspection.createdAt,
          inspection.reason,
          inspection.detail,
          inspection.accessRole,
        ]),
      ]),
    };
  }
  if (format === 'markdown') {
    return {
      payload,
      contentType: 'text/markdown',
      extension: 'md',
      content: [
        '# Case Wiki Repaired Edge Inspection Ledger',
        '',
        'Metadata-only repaired-edge inspection export. Source text, source files, and graph payloads are not included.',
        '',
        `- Exported: ${exportedAt}`,
        `- Manager: ${actor}`,
        `- Repair filter: ${payload.repairType}`,
        `- Lenses: ${lensIds.length}`,
        `- Inspections: ${inspectionLedger.length}`,
        '',
        '| Inspection time | Lens | Repair type | Inspected activity | Actor |',
        '| --- | --- | --- | --- | --- |',
        ...(inspectionLedger.length
          ? inspectionLedger.map(
              (inspection) =>
                `| ${inspection.createdAt || 'unknown'} | ${inspection.lensName.replace(/\|/g, '\\|')} | ${inspection.repairType} | ${inspection.inspectedActivityId.replace(/\|/g, '\\|')} | ${inspection.actor.replace(/\|/g, '\\|')} |`,
            )
          : ['| No repaired-edge inspections match this filter |  |  |  |  |']),
        '',
      ].join('\n'),
    };
  }
  return {
    payload,
    contentType: 'application/json',
    extension: 'json',
    content: JSON.stringify(payload, null, 2),
  };
};

const makeProvenanceLensActivityTrailGraphLens = (
  records = [],
  actor = 'Current worker',
  { inspectionFilter = 'all' } = {},
) => {
  const selectedInspectionFilter = cleanProvenanceLensInspectionFilter(inspectionFilter);
  const generatedAt = new Date().toISOString();
  const rows = records
    .filter((record) => provenanceLensRecordCan(record, actor, 'manager'))
    .map((record) => {
      const lensId = record.lensId || record.id || '';
      const activities = (Array.isArray(record.activityRecords) ? record.activityRecords : [])
        .filter(Boolean)
        .map((activity) => ({
          id: activity.id || `activity:${lensId}:${activity.type || 'unknown'}`,
          type: activity.type || 'activity',
          repairType: activity.repairType || '',
          actor: activity.actor || 'Current worker',
          detail: activity.detail || '',
          reason: activity.reason || '',
          inspectionType: activity.inspectionType || '',
          inspectedActivityId: activity.inspectedActivityId || '',
          inspectedEdgeId: activity.inspectedEdgeId || '',
          inspectedFromNodeId: activity.inspectedFromNodeId || '',
          inspectedToNodeId: activity.inspectedToNodeId || '',
          inspectedRelationshipKind: activity.inspectedRelationshipKind || '',
          inspectedVirtualRelationshipType: activity.inspectedVirtualRelationshipType || '',
          createdAt: toIsoString(activity.createdAt) || '',
          source:
            activity.type === 'backfilled'
              ? 'repaired'
              : activity.type === 'opened' && activity.inspectionType === 'repaired-edge-drilldown'
                ? 'inspection'
                : 'native',
        }))
        .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
      const nativeActivities = activities.filter((activity) => activity.source === 'native');
      const repairedActivities = activities.filter((activity) => activity.source === 'repaired');
      const inspectionActivities = activities.filter((activity) => activity.source === 'inspection');
      const inspectedActivityIds = new Set(
        inspectionActivities.map((activity) => activity.inspectedActivityId).filter(Boolean),
      );
      const inspectedRepairCount = repairedActivities.filter((activity) => inspectedActivityIds.has(activity.id)).length;
      const uninspectedRepairCount = repairedActivities.filter((activity) => !inspectedActivityIds.has(activity.id)).length;
      const nativeTypes = Array.from(new Set(nativeActivities.map((activity) => activity.type).filter(Boolean)));
      const repairedTypes = Array.from(
        new Set(repairedActivities.map((activity) => activity.repairType || activity.type).filter(Boolean)),
      );
      const requiredTypes = [
        'created',
        ...((record.sharedWith || []).length ? ['shared'] : []),
        ...(record.neo4jStatus ? ['server-synced'] : []),
      ];
      const missingNativeTypes = requiredTypes.filter((type) => !nativeTypes.includes(type));
      const repairCoverageTypes = missingNativeTypes.filter((type) => repairedTypes.includes(type));
      const status =
        missingNativeTypes.length && repairCoverageTypes.length === missingNativeTypes.length
          ? 'repaired-complete'
          : missingNativeTypes.length
            ? 'needs-repair'
            : repairedActivities.length
              ? 'mixed'
              : 'native-complete';
      return {
        id: `provenance-lens-activity-trail:${lensId}`,
        lensId,
        lensName: record.name || 'Saved provenance lens',
        createdBy: record.createdBy || 'Current worker',
        visibility: record.visibility || 'private',
        sharedWith: Array.isArray(record.sharedWith) ? record.sharedWith.filter(Boolean) : [],
        accessRole: cleanFrontendAccessRole(record.accessRole || 'manager'),
        nativeActivityCount: nativeActivities.length,
        repairedActivityCount: repairedActivities.length,
        inspectionActivityCount: inspectionActivities.length,
        inspectedRepairCount,
        uninspectedRepairCount,
        inspectionStatus: !repairedActivities.length
          ? 'no-repairs'
          : uninspectedRepairCount
            ? inspectionActivities.length
              ? 'partially-inspected'
              : 'needs-inspection'
            : 'fully-inspected',
        nativeTypes,
        repairedTypes,
        requiredTypes,
        missingNativeTypes,
        repairCoverageTypes,
        status,
        latestActivityAt: activities[0]?.createdAt || toIsoString(record.lensUpdatedAt || record.updatedAt) || '',
        timeline: activities.slice(0, 12),
      };
    })
    .filter((row) => row.lensId)
    .filter((row) => {
      if (selectedInspectionFilter === 'inspected') return row.inspectionActivityCount > 0;
      if (selectedInspectionFilter === 'needs-inspection') return row.uninspectedRepairCount > 0;
      return true;
    })
    .sort((left, right) => new Date(right.latestActivityAt || 0).getTime() - new Date(left.latestActivityAt || 0).getTime())
    .slice(0, 24);
  const nodes = rows.flatMap((row) => [
    {
      id: `lens:${row.lensId}`,
      kind: 'GraphProvenanceLens',
      label: row.lensName,
      status: row.status,
      nativeActivityCount: row.nativeActivityCount,
      repairedActivityCount: row.repairedActivityCount,
    },
    ...row.timeline.map((activity) => ({
      id: `activity:${activity.id}`,
      kind:
        activity.source === 'repaired'
          ? 'GraphProvenanceLensRepairActivity'
          : activity.source === 'inspection'
            ? 'GraphProvenanceLensInspectionActivity'
            : 'GraphProvenanceLensNativeActivity',
      label: activity.repairType || activity.type,
      status: activity.source,
      createdAt: activity.createdAt,
    })),
  ]);
  const edges = rows.flatMap((row) =>
    row.timeline.map((activity) => ({
      id: `edge:${row.lensId}:${activity.id}`,
      from: `lens:${row.lensId}`,
      to: `activity:${activity.id}`,
      type:
        activity.source === 'repaired'
          ? 'HAS_REPAIRED_ACTIVITY'
          : activity.source === 'inspection'
            ? 'INSPECTED_REPAIRED_ACTIVITY'
            : 'HAS_NATIVE_ACTIVITY',
      label:
        activity.source === 'repaired'
          ? `repairs ${activity.repairType || 'activity'}`
          : activity.source === 'inspection'
            ? `inspected ${activity.inspectedActivityId || 'repaired activity'}`
            : activity.type,
    })),
  );
  return {
    actor,
    generatedAt,
    inspectionFilter: selectedInspectionFilter,
    lensCount: rows.length,
    nativeActivityCount: rows.reduce((total, row) => total + row.nativeActivityCount, 0),
    repairedActivityCount: rows.reduce((total, row) => total + row.repairedActivityCount, 0),
    inspectionActivityCount: rows.reduce((total, row) => total + row.inspectionActivityCount, 0),
    uninspectedRepairCount: rows.reduce((total, row) => total + row.uninspectedRepairCount, 0),
    needsRepairCount: rows.filter((row) => row.status === 'needs-repair').length,
    rows,
    graph: {
      nodes,
      edges,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    },
  };
};

const buildProvenanceLensRepairedEdgeCypherHandoff = ({
  lensNodeId = '',
  repairedActivityNodeId = '',
  inspectionActivityNodeId = '',
  lensId = '',
  repairedActivityId = '',
  inspectionActivityId = '',
  repairType = '',
} = {}) => ({
  description:
    'Neo4j Browser handoff for the repaired provenance activity relationship and the inspection event that opened it.',
  cypher: [
    'MATCH (lens:CaseManagementKnowledge {id: $lensNodeId})',
    'OPTIONAL MATCH (lens)-[repairedEdge:RELATED_TO {kind: $repairedRelationshipKind}]->(repairedActivity:CaseManagementKnowledge {id: $repairedActivityNodeId})',
    'OPTIONAL MATCH (lens)-[inspectionEdge:RELATED_TO {kind: $inspectionRelationshipKind}]->(inspectionActivity:CaseManagementKnowledge {id: $inspectionActivityNodeId})',
    'RETURN lens, repairedEdge, repairedActivity, inspectionEdge, inspectionActivity',
  ].join('\n'),
  params: {
    lensNodeId,
    repairedActivityNodeId,
    inspectionActivityNodeId,
    repairedRelationshipKind: 'HAS_LENS_ACTIVITY',
    inspectionRelationshipKind: 'HAS_LENS_ACTIVITY',
    virtualRelationshipType: 'HAS_REPAIRED_ACTIVITY',
    lensId,
    repairedActivityId,
    inspectionActivityId,
    repairType,
  },
});

const findGraphActivityNode = (graph = {}, activityId = '') =>
  (Array.isArray(graph.nodes) ? graph.nodes : []).find((node) => node?.props?.activityId === activityId) || null;

const recordProvenanceLensRepairedEdgeInspection = async ({
  userId,
  record,
  actor,
  inspectedActivityId,
  inspectedEdgeId,
  repairType,
  reason,
  detail,
}) => {
  const activities = Array.isArray(record.activityRecords) ? record.activityRecords.filter(Boolean) : [];
  const repairedActivity = activities.find((activity) => activity.id === inspectedActivityId);
  if (!repairedActivity) {
    const error = new Error('Choose a valid repaired provenance activity before recording an inspection');
    error.statusCode = 400;
    throw error;
  }
  if (repairedActivity.type !== 'backfilled') {
    const error = new Error('Only repaired provenance activity edges can be recorded as repaired-edge inspections');
    error.statusCode = 400;
    throw error;
  }

  const lensId = record.lensId || record.id || '';
  const now = new Date().toISOString();
  const safeRepairType = repairType || repairedActivity.repairType || 'activity';
  const inspectionActivity = {
    id: `provenance-lens-edge-inspection-${crypto.randomUUID()}`,
    type: 'opened',
    inspectionType: 'repaired-edge-drilldown',
    actor,
    detail:
      detail ||
      `Opened repaired ${safeRepairType} activity edge for ${record.name || 'saved provenance lens'}.`,
    reason:
      reason ||
      repairedActivity.reason ||
      `Inspection of repaired ${safeRepairType} provenance activity edge.`,
    repairType: safeRepairType,
    inspectedActivityId,
    inspectedEdgeId: inspectedEdgeId || `edge:${lensId}:${inspectedActivityId}`,
    inspectedRelationshipKind: 'HAS_LENS_ACTIVITY',
    inspectedVirtualRelationshipType: 'HAS_REPAIRED_ACTIVITY',
    createdAt: now,
  };
  const lens = makeProvenanceLensSavePayloadFromRecord(record, {
    updatedAt: now,
    activityRecords: [inspectionActivity, ...activities].slice(0, 50),
  });
  const builtLensGraph = buildCaseWikiGraphProvenanceLensGraph({
    lens,
    userId,
  });

  if (!builtLensGraph) {
    const error = new Error('Choose a valid provenance lens before recording an edge inspection');
    error.statusCode = 400;
    throw error;
  }

  const normalizedInspectionActivity =
    builtLensGraph.provenanceLens.activityRecords.find((activity) => activity.id === inspectionActivity.id) ||
    inspectionActivity;
  const normalizedRepairedActivity =
    builtLensGraph.provenanceLens.activityRecords.find((activity) => activity.id === inspectedActivityId) ||
    repairedActivity;
  const repairedActivityNode =
    findGraphActivityNode(builtLensGraph.graph, inspectedActivityId) || { id: normalizedRepairedActivity.nodeId || '' };
  const inspectionActivityNode =
    findGraphActivityNode(builtLensGraph.graph, inspectionActivity.id) || { id: normalizedInspectionActivity.nodeId || '' };
  const neo4jQuery = buildProvenanceLensRepairedEdgeCypherHandoff({
    lensNodeId: builtLensGraph.provenanceLens.nodeId,
    repairedActivityNodeId: repairedActivityNode.id,
    inspectionActivityNodeId: inspectionActivityNode.id,
    lensId,
    repairedActivityId: inspectedActivityId,
    inspectionActivityId: inspectionActivity.id,
    repairType: safeRepairType,
  });
  const neo4j = await writeCaseWikiGraphToNeo4j(builtLensGraph.graph);
  const savedRecord = await saveCaseManagementProvenanceLens(userId, {
    ...builtLensGraph.provenanceLens,
    neo4jNodeId: builtLensGraph.provenanceLens.nodeId,
    neo4jStatus: neo4j.status,
    neo4jMessage: neo4j.message || neo4j.skippedReason || '',
  });

  return {
    savedRecord,
    inspectionActivity: normalizedInspectionActivity,
    repairedActivity: normalizedRepairedActivity,
    graph: builtLensGraph.graph,
    neo4j,
    neo4jQuery,
  };
};

const backfillProvenanceLensActivityRecord = async ({ userId, record, actor }) => {
  const backfillActivities = buildProvenanceLensBackfillActivities(record, actor);
  if (!backfillActivities.length) {
    return {
      skipped: true,
      record,
      savedRecord: record,
      backfilledActivities: [],
      graph: null,
      neo4j: { status: 'skipped', message: 'No missing provenance lens activity to backfill.' },
    };
  }
  const nextActivityRecords = [
    ...backfillActivities,
    ...(Array.isArray(record.activityRecords) ? record.activityRecords.filter(Boolean) : []),
  ].slice(0, 50);
  const lens = makeProvenanceLensSavePayloadFromRecord(record, {
    updatedAt: new Date().toISOString(),
    activityRecords: nextActivityRecords,
  });
  const builtLensGraph = buildCaseWikiGraphProvenanceLensGraph({
    lens,
    userId,
  });

  if (!builtLensGraph) {
    const error = new Error('Choose a valid provenance lens before backfilling activity');
    error.statusCode = 400;
    throw error;
  }

  const neo4j = await writeCaseWikiGraphToNeo4j(builtLensGraph.graph);
  const savedRecord = await saveCaseManagementProvenanceLens(userId, {
    ...builtLensGraph.provenanceLens,
    neo4jNodeId: builtLensGraph.provenanceLens.nodeId,
    neo4jStatus: neo4j.status,
    neo4jMessage: neo4j.message || neo4j.skippedReason || '',
  });

  return {
    skipped: false,
    record,
    savedRecord,
    backfilledActivities: backfillActivities,
    graph: builtLensGraph.graph,
    neo4j,
  };
};

const makeFrontendProvenanceLens = (record = {}, actor = '') => ({
  id: record.lensId || record.id || '',
  name: record.name || 'Saved provenance lens',
  query: record.query || '',
  reviewFilter: record.reviewFilter || 'all',
  domainFilter: record.domainFilter || 'all',
  browserScope: record.browserScope || 'active-domain',
  resultCount: Number(record.resultCount) || 0,
  matchingWorkspaceCount: Number(record.matchingWorkspaceCount) || 0,
  createdAt: toIsoString(record.lensCreatedAt || record.createdAt) || new Date().toISOString(),
  updatedAt: toIsoString(record.lensUpdatedAt || record.updatedAt) || new Date().toISOString(),
  createdBy: record.createdBy || 'Current worker',
  visibility: record.visibility || 'private',
  sharedWith: Array.isArray(record.sharedWith) ? record.sharedWith.filter(Boolean) : [],
  shareNote: record.shareNote || '',
  accessRole: cleanFrontendAccessRole(record.accessRole || 'manager'),
  accessRoles: cleanFrontendAccessRoles(record.accessRoles),
  activityRecords: cleanFrontendActivityRecords(record.activityRecords),
  serverSyncedAt: toIsoString(record.serverSyncedAt || record.updatedAt),
  neo4jNodeId: record.neo4jNodeId || '',
  neo4jStatus: record.neo4jStatus || '',
  neo4jMessage: record.neo4jMessage || '',
  ...(actor ? { viewerRole: provenanceLensRecordRoleFor(record, actor) } : {}),
});

const makeFrontendIngestionRecord = (ingestion) => {
  if (!ingestion) return null;
  const frontendRecord = ingestion.generatedRecords?.frontendRecord || {};
  return {
    ...frontendRecord,
    sourceHash: frontendRecord.sourceHash || ingestion.sha256 || '',
    archive: ingestion.archive || frontendRecord.archive || ingestion.wikiPage?.archive || {},
    embeddingReview: makeFallbackEmbeddingReview(ingestion),
    weaviateDryRun: ingestion.weaviateDryRun || frontendRecord.weaviateDryRun || ingestion.embeddingReview?.weaviateDryRun,
    vectorIndex: ingestion.vectorIndex || frontendRecord.vectorIndex || null,
    relationshipReviewRecords: relationshipReviewRecordsForIngestion(ingestion),
    auditRecords: Array.isArray(ingestion.generatedRecords?.auditRecords) ? ingestion.generatedRecords.auditRecords : [],
  };
};

const normalizeArchiveAttachmentTarget = (target = {}) => {
  if (!target || typeof target !== 'object') return null;
  const targetType = typeof target.targetType === 'string' ? target.targetType.trim() : '';
  const targetId = typeof target.targetId === 'string' ? target.targetId.trim() : '';
  const targetLabel = typeof target.targetLabel === 'string' ? target.targetLabel.trim() : '';
  const targetHref = typeof target.targetHref === 'string' ? target.targetHref.trim() : '';
  const clientId = typeof target.clientId === 'string' ? target.clientId.trim() : '';
  const caseId = typeof target.caseId === 'string' ? target.caseId.trim() : '';
  const serviceName = typeof target.serviceName === 'string' ? target.serviceName.trim() : '';
  if (!archiveAttachmentTargetTypes.has(targetType) || !targetId || !targetLabel) return null;
  return {
    targetType,
    targetId,
    targetLabel,
    targetHref,
    clientId,
    caseId,
    serviceName,
  };
};

const normalizeRelationshipKeyPart = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 180);

const makeRelationshipReviewKey = (sourceId, relationship = {}) =>
  [sourceId, relationship.kind, relationship.from, relationship.label || relationship.kind, relationship.to]
    .map(normalizeRelationshipKeyPart)
    .join('::');

const stableRelationshipReviewId = (relationshipKey) =>
  `relationship-review-${crypto.createHash('sha256').update(relationshipKey).digest('hex').slice(0, 18)}`;

const stableGraphNodeIdForLabel = (label) =>
  `review-node:${crypto.createHash('sha256').update(String(label || 'unknown')).digest('hex').slice(0, 18)}`;

const normalizeRelationshipReviewTarget = (relationship = {}) => {
  if (!relationship || typeof relationship !== 'object') return null;
  const from = typeof relationship.from === 'string' ? relationship.from.trim() : '';
  const to = typeof relationship.to === 'string' ? relationship.to.trim() : '';
  const kind = typeof relationship.kind === 'string' ? relationship.kind.trim() : '';
  const label = typeof relationship.label === 'string' && relationship.label.trim()
    ? relationship.label.trim()
    : kind.replace(/_/g, ' ').toLowerCase();
  const fromNodeId = typeof relationship.fromNodeId === 'string' ? relationship.fromNodeId.trim() : '';
  const toNodeId = typeof relationship.toNodeId === 'string' ? relationship.toNodeId.trim() : '';
  if (!from || !to || !kind) return null;
  return {
    from,
    to,
    fromNodeId,
    toNodeId,
    kind,
    label,
  };
};

const sourceScopeForWikiIngestion = (ingestion = {}) =>
  ingestion.sourceScope ||
  ingestion.privacy?.sourceScope ||
  ingestion.generatedRecords?.frontendRecord?.sourceScope ||
  'standalone';

const archiveForWikiIngestion = (ingestion = {}) =>
  ingestion.archive || ingestion.generatedRecords?.frontendRecord?.archive || ingestion.wikiPage?.archive || {};

const isBatchReviewEligibleSource = (ingestion = {}) => {
  const archive = archiveForWikiIngestion(ingestion);
  const scope = sourceScopeForWikiIngestion(ingestion);
  return (
    scope !== 'current-record' &&
    archive.reviewStatus !== 'attached-to-record' &&
    archive.reviewStatus !== 'attached-to-current-record' &&
    !archive.attachmentTarget
  );
};

const archivePatchForAction = (
  action,
  existingArchive = {},
  attachmentTarget = null,
  canonicalSource = null,
  canonicalLineage = null,
  lifeDomainMoveTarget = null,
) => {
  const now = new Date().toISOString();
  const cleanupDecision = (status, label, recommendation, cleanupAction, extra = {}) => ({
    status,
    label,
    recommendation,
    cleanupAction,
    decidedAt: now,
    decidedBy: 'Current worker',
    nonDestructive: true,
    ...extra,
  });

  if (action === 'keep-standalone' || action === 'mark-reviewed') {
    return {
      ...existingArchive,
      reviewStatus: 'reviewed-standalone',
      reviewedAt: now,
      reviewedBy: 'Current worker',
      attachmentTarget: null,
      attachmentRecommendation:
        'Reviewed as a standalone source document. Keep separate from clients, cases, and services unless new evidence supports an attachment.',
    };
  }
  if (action === 'review-for-attachment') {
    return {
      ...existingArchive,
      reviewStatus: 'reviewed-for-attachment',
      reviewedAt: now,
      reviewedBy: 'Current worker',
      attachmentRecommendation:
        'Reviewed and flagged for a future attachment decision. Keep source separate until a specific client, case, service, or project target is selected.',
    };
  }
  if (action === 'attach-to-record' && attachmentTarget) {
    return {
      ...existingArchive,
      reviewStatus: 'attached-to-record',
      reviewedAt: now,
      reviewedBy: 'Current worker',
      attachmentTarget: {
        ...attachmentTarget,
        attachedAt: now,
      },
      attachmentRecommendation:
        `Attached to ${attachmentTarget.targetType} "${attachmentTarget.targetLabel}". This source should now appear with that live record and remain traceable as an original source document.`,
    };
  }
  if (action === 'reopen-review') {
    return {
      ...existingArchive,
      reviewStatus: 'needs-human-review',
      reviewedAt: '',
      reviewedBy: '',
      attachmentTarget: null,
      attachmentRecommendation:
        'Keep standalone until a person reviews whether this source belongs to a client, case, service, or project page.',
    };
  }
  if (action === 'apply-life-domain-move' && lifeDomainMoveTarget) {
    return {
      ...existingArchive,
      lifeDomain: lifeDomainMoveTarget.lifeDomain,
      lifeDomainId: lifeDomainMoveTarget.lifeDomainId,
      reviewStatus: existingArchive.reviewStatus || 'reviewed-standalone',
      reviewedAt: now,
      reviewedBy: 'Current worker',
      classificationReason:
        lifeDomainMoveTarget.reason ||
        `Human-applied Life Domain move into ${lifeDomainMoveTarget.lifeDomain}.`,
      lifeDomainMoveReceipt: {
        proposalId: lifeDomainMoveTarget.proposalId,
        fromDomain: existingArchive.lifeDomain || 'Unknown',
        toDomain: lifeDomainMoveTarget.lifeDomain,
        toDomainId: lifeDomainMoveTarget.lifeDomainId,
        appliedAt: now,
        appliedBy: 'Current worker',
        nonDestructive: true,
        vectorWrite: false,
        graphWrite: false,
        attachmentWrite: false,
        fileAction: false,
      },
    };
  }
  if (action === 'mark-cleanup-review') {
    return {
      ...existingArchive,
      reviewStatus: existingArchive.reviewStatus || 'needs-human-review',
      reviewedAt: now,
      reviewedBy: 'Current worker',
      cleanupDecision: cleanupDecision(
        'needs-cleanup-review',
        'Needs cleanup review',
        'Review this source before retention, attachment, or embedding. No file has been moved, renamed, or deleted.',
        'review-before-retention',
      ),
      attachmentRecommendation:
        existingArchive.attachmentRecommendation ||
        'Keep standalone until a person reviews whether this source belongs to a client, case, service, or project page.',
    };
  }
  if (action === 'mark-duplicate') {
    return {
      ...existingArchive,
      reviewStatus: existingArchive.reviewStatus || 'needs-human-review',
      reviewedAt: now,
      reviewedBy: 'Current worker',
      cleanupDecision: cleanupDecision(
        'possible-duplicate',
        'Possible duplicate',
        'Compare with related sources and choose a canonical copy before embedding or cleanup. No duplicate has been deleted.',
        'compare-before-embedding',
      ),
    };
  }
  if (action === 'mark-canonical-source') {
    return {
      ...existingArchive,
      reviewStatus: existingArchive.reviewStatus || 'reviewed-standalone',
      reviewedAt: now,
      reviewedBy: 'Current worker',
      ...(canonicalLineage ? { canonicalLineage } : {}),
      cleanupDecision: cleanupDecision(
        'canonical-source',
        'Canonical source',
        'Use this source as the preferred record for this duplicate set. Other copies can be compared or marked as superseded later. No file has been moved, renamed, or deleted.',
        'prefer-for-wiki',
        canonicalLineage ? { canonicalLineage } : {},
      ),
    };
  }
  if (action === 'mark-superseded-by-source' && canonicalSource) {
    return {
      ...existingArchive,
      reviewStatus: existingArchive.reviewStatus || 'reviewed-standalone',
      reviewedAt: now,
      reviewedBy: 'Current worker',
      ...(canonicalLineage ? { canonicalLineage } : {}),
      cleanupDecision: cleanupDecision(
        'superseded-by-canonical',
        'Superseded by canonical source',
        `Treat "${canonicalSource.sourceLabel}" as the preferred source. Keep this source for history until cleanup is explicitly confirmed.`,
        'superseded-by-source',
        { canonicalSource, ...(canonicalLineage ? { canonicalLineage } : {}) },
      ),
    };
  }
  if (action === 'mark-superseded') {
    return {
      ...existingArchive,
      reviewStatus: existingArchive.reviewStatus || 'reviewed-standalone',
      reviewedAt: now,
      reviewedBy: 'Current worker',
      cleanupDecision: cleanupDecision(
        'superseded-or-old-copy',
        'Superseded or old copy',
        'Keep this as historical source material until a canonical newer source is confirmed. No local file action has been taken.',
        'keep-as-history',
      ),
    };
  }
  if (action === 'exclude-from-embedding') {
    return {
      ...existingArchive,
      reviewStatus: existingArchive.reviewStatus || 'reviewed-standalone',
      reviewedAt: now,
      reviewedBy: 'Current worker',
      cleanupDecision: cleanupDecision(
        'excluded-from-embedding',
        'Excluded from embedding',
        'Keep the wiki source and graph context, but do not send this source into Weaviate unless it is reopened later.',
        'do-not-embed',
      ),
    };
  }
  if (action === 'clear-cleanup-decision') {
    return {
      ...existingArchive,
      reviewStatus: existingArchive.reviewStatus || 'needs-human-review',
      reviewedAt: now,
      reviewedBy: 'Current worker',
      cleanupDecision: null,
    };
  }
  return null;
};

const summarizeEmbeddingReview = (review = {}) => {
  const chunks = Array.isArray(review.chunks) ? review.chunks : [];
  const approvedCount = chunks.filter((chunk) => chunk.status === 'approved-for-embedding').length;
  const rejectedCount = chunks.filter((chunk) => chunk.status === 'do-not-embed').length;
  const pendingCount = chunks.filter((chunk) => chunk.status === 'pending-review').length;
  const status =
    chunks.length === 0
      ? 'metadata-only'
      : rejectedCount === chunks.length
        ? 'blocked'
        : pendingCount > 0
          ? 'awaiting-review'
          : approvedCount > 0
            ? 'ready-for-vector-dry-run'
            : 'awaiting-review';

  return {
    ...review,
    status,
    chunkCount: chunks.length,
    approvedCount,
    rejectedCount,
    pendingCount,
    reviewedAt: pendingCount === 0 && chunks.length > 0 ? new Date().toISOString() : review.reviewedAt || '',
    reviewedBy: pendingCount === 0 && chunks.length > 0 ? 'Current worker' : review.reviewedBy || '',
  };
};

const embeddingReviewPatchForAction = (action, existingReview = {}, chunkId = '', chunkIds = [], chunkPatch = {}) => {
  const chunks = Array.isArray(existingReview.chunks) ? existingReview.chunks : [];
  const selectedChunkIds = new Set(Array.isArray(chunkIds) ? chunkIds.filter(Boolean) : []);
  const now = new Date().toISOString();
  const allowedPrivacyLevels = new Set(['case-team', 'private', 'personal', 'public']);
  const allowedRedactionModes = new Set(['standard', 'strict', 'none']);
  const markChunk = (chunk, status, note) => ({
    ...chunk,
    status,
    embeddingAction: status,
    reviewedAt: now,
    reviewedBy: 'Current worker',
    reviewNote: note,
  });

  let nextChunks = chunks;
  if (action === 'approve-chunk') {
    nextChunks = chunks.map((chunk) =>
      chunk.id === chunkId ? markChunk(chunk, 'approved-for-embedding', 'Approved for a future dry-run Weaviate write.') : chunk,
    );
  } else if (action === 'approve-chunks') {
    nextChunks = chunks.map((chunk) =>
      selectedChunkIds.has(chunk.id)
        ? markChunk(chunk, 'approved-for-embedding', 'Approved in a filtered batch for a future dry-run Weaviate write.')
        : chunk,
    );
  } else if (action === 'skip-chunk') {
    nextChunks = chunks.map((chunk) =>
      chunk.id === chunkId ? markChunk(chunk, 'do-not-embed', 'Reviewer marked this chunk as do not embed.') : chunk,
    );
  } else if (action === 'skip-chunks') {
    nextChunks = chunks.map((chunk) =>
      selectedChunkIds.has(chunk.id) ? markChunk(chunk, 'do-not-embed', 'Reviewer marked this filtered chunk batch as do not embed.') : chunk,
    );
  } else if (action === 'reset-chunk') {
    nextChunks = chunks.map((chunk) =>
      chunk.id === chunkId
        ? {
            ...chunk,
            status: 'pending-review',
            embeddingAction: 'pending-review',
            reviewedAt: '',
            reviewedBy: '',
            reviewNote: existingReview.reviewReason || 'Review this chunk before embedding.',
          }
        : chunk,
    );
  } else if (action === 'reset-chunks') {
    nextChunks = chunks.map((chunk) =>
      selectedChunkIds.has(chunk.id)
        ? {
            ...chunk,
            status: 'pending-review',
            embeddingAction: 'pending-review',
            reviewedAt: '',
            reviewedBy: '',
            reviewNote: existingReview.reviewReason || 'Review this chunk before embedding.',
          }
        : chunk,
    );
  } else if (action === 'update-chunk') {
    const textPreview = typeof chunkPatch.textPreview === 'string' ? chunkPatch.textPreview.trim().slice(0, 6000) : '';
    const reviewNote = typeof chunkPatch.reviewNote === 'string' ? chunkPatch.reviewNote.trim().slice(0, 1200) : '';
    const privacyLevel = typeof chunkPatch.privacyLevel === 'string' && allowedPrivacyLevels.has(chunkPatch.privacyLevel)
      ? chunkPatch.privacyLevel
      : '';
    const redactionMode = typeof chunkPatch.redactionMode === 'string' && allowedRedactionModes.has(chunkPatch.redactionMode)
      ? chunkPatch.redactionMode
      : '';
    if (!textPreview) return null;
    nextChunks = chunks.map((chunk) =>
      chunk.id === chunkId
        ? {
            ...chunk,
            textPreview,
            charCount: textPreview.length,
            tokenEstimate: Math.max(1, Math.ceil(textPreview.length / 4)),
            reviewNote: reviewNote || 'Chunk text edited by reviewer. Review again before embedding.',
            privacyLevel: privacyLevel || chunk.privacyLevel || existingReview.privacyLevel || 'case-team',
            redactionMode: redactionMode || chunk.redactionMode || existingReview.redactionMode || 'standard',
            status: 'pending-review',
            embeddingAction: 'pending-review',
            reviewedAt: '',
            reviewedBy: '',
            editedAt: now,
            editedBy: 'Current worker',
            editReason: 'Reviewer edited the chunk before embedding approval.',
          }
        : chunk,
    );
  } else if (action === 'approve-all') {
    nextChunks = chunks.map((chunk) => markChunk(chunk, 'approved-for-embedding', 'Approved in batch for a future dry-run Weaviate write.'));
  } else if (action === 'do-not-embed-source') {
    nextChunks = chunks.map((chunk) => markChunk(chunk, 'do-not-embed', 'Reviewer marked the full source as do not embed.'));
  } else if (action === 'reset-source-embedding') {
    nextChunks = chunks.map((chunk) => ({
      ...chunk,
      status: 'pending-review',
      embeddingAction: 'pending-review',
      reviewedAt: '',
      reviewedBy: '',
      reviewNote: existingReview.reviewReason || 'Review this chunk before embedding.',
    }));
  } else {
    return null;
  }

  if (['approve-chunk', 'skip-chunk', 'reset-chunk', 'update-chunk'].includes(action) && chunkId && !chunks.some((chunk) => chunk.id === chunkId)) {
    return null;
  }
  if (['approve-chunks', 'skip-chunks', 'reset-chunks'].includes(action)) {
    if (!selectedChunkIds.size) return null;
    if (chunkIds.some((selectedId) => !chunks.some((chunk) => chunk.id === selectedId))) return null;
  }

  return summarizeEmbeddingReview({
    ...existingReview,
    chunks: nextChunks,
    writeMode: existingReview.writeMode || 'dry-run',
    writeEnabled: false,
    reviewRequired: true,
  });
};

const embeddingReviewAuditAction = (action, review = {}, dryRun = null) => {
  if (action === 'approve-all') {
    return dryRun?.status === 'prepared'
      ? `approved ${dryRun.objectCount} chunk${dryRun.objectCount === 1 ? '' : 's'} for Weaviate dry-run`
      : `approved ${review.approvedCount || 0} chunk${review.approvedCount === 1 ? '' : 's'} for embedding review`;
  }
  if (action === 'approve-chunk') return 'approved one chunk for embedding review';
  if (action === 'approve-chunks') return 'approved filtered chunks for embedding review';
  if (action === 'skip-chunk') return 'marked one chunk do not embed';
  if (action === 'skip-chunks') return 'marked filtered chunks do not embed';
  if (action === 'do-not-embed-source') return 'marked source do not embed';
  if (action === 'reset-source-embedding') return 'reset source embedding review';
  if (action === 'reset-chunk') return 'reset one embedding chunk';
  if (action === 'reset-chunks') return 'reset filtered embedding chunks';
  if (action === 'update-chunk') return 'edited one embedding chunk for review';
  return `updated embedding review (${review.status || 'pending'})`;
};

const syncCaseWikiEmbeddingReviewGraph = async ({
  ingestion,
  embeddingReview,
  weaviateDryRun = null,
  vectorWrite = null,
  action = '',
} = {}) => {
  const builtGraph = buildCaseWikiEmbeddingReviewGraph({
    ingestion,
    embeddingReview,
    weaviateDryRun,
    vectorWrite,
    action,
  });

  if (!builtGraph?.graph?.nodes?.length) {
    return {
      builtGraph: null,
      neo4j: {
        status: 'skipped',
        message: 'No embedding review graph nodes were available to sync.',
        nodeCount: 0,
        edgeCount: 0,
      },
      graphSync: {
        status: 'skipped',
        message: 'No embedding review graph nodes were available to sync.',
        nodeCount: 0,
        edgeCount: 0,
        syncedAt: new Date().toISOString(),
      },
    };
  }

  const neo4j = await writeCaseWikiGraphToNeo4j(builtGraph.graph);
  return {
    builtGraph,
    neo4j,
    graphSync: {
      status: neo4j.status || 'unknown',
      message: neo4j.message || neo4j.skippedReason || '',
      nodeCount: neo4j.nodeCount || builtGraph.graph.nodes.length,
      edgeCount: neo4j.edgeCount || builtGraph.graph.edges.length,
      reviewNodeId: builtGraph.reviewNodeId,
      sourceNodeId: builtGraph.sourceNodeId,
      vectorIndexNodeId: builtGraph.vectorIndexNodeId,
      syncedAt: new Date().toISOString(),
    },
  };
};

const archiveReviewAuditAction = (action, archive = {}, attachmentTarget = null) => {
  if (action === 'keep-standalone' || action === 'mark-reviewed') return 'kept source as standalone document';
  if (action === 'review-for-attachment') return 'flagged source for attachment review';
  if (action === 'reopen-review') return 'reopened source archive review';
  if (action === 'attach-to-record' && attachmentTarget) {
    return `attached source to ${attachmentTarget.targetType} ${attachmentTarget.targetLabel}`;
  }
  if (action === 'mark-cleanup-review') return 'marked source for cleanup review';
  if (action === 'mark-duplicate') return 'marked source as possible duplicate';
  if (action === 'mark-canonical-source') return 'marked source as canonical source';
  if (action === 'mark-superseded-by-source') {
    return `marked source as superseded by ${archive.cleanupDecision?.canonicalSource?.sourceLabel || 'canonical source'}`;
  }
  if (action === 'mark-superseded') return 'marked source as superseded or old copy';
  if (action === 'exclude-from-embedding') return 'excluded source from embedding';
  if (action === 'clear-cleanup-decision') return 'cleared source cleanup decision';
  if (action === 'apply-life-domain-move') {
    return `applied source Life Domain move to ${archive.lifeDomain || 'selected domain'}`;
  }
  return `updated archive review (${archive.reviewStatus || 'needs-human-review'})`;
};

const relationshipReviewStatusFromRequest = (body = {}) => {
  const status = typeof body.status === 'string' ? body.status.trim() : '';
  if (relationshipReviewStatuses.has(status)) return status;
  const action = typeof body.action === 'string' ? body.action.trim() : '';
  if (action === 'approve-relationship') return 'approved';
  if (action === 'reject-relationship') return 'rejected';
  return '';
};

const relationshipReviewAuditAction = (status) =>
  status === 'approved' ? 'approved graph relationship' : 'rejected graph relationship';

const relationshipReviewRecordForDecision = ({
  existing,
  archive,
  sourceTitle,
  relationship,
  relationshipKey,
  status,
  previousRecord = null,
  now = new Date().toISOString(),
}) => ({
  ...(previousRecord || {}),
  id: previousRecord?.id || stableRelationshipReviewId(relationshipKey),
  sourceId: existing.fileId,
  sourcePageId: existing.wikiPage?.id || existing.generatedRecords?.frontendRecord?.pageId || `ingest:${existing.fileId}`,
  sourceTitle,
  relationshipKey,
  from: relationship.from,
  to: relationship.to,
  fromNodeId: relationship.fromNodeId,
  toNodeId: relationship.toNodeId,
  kind: relationship.kind,
  label: relationship.label,
  status,
  reviewedAt: now,
  reviewedBy: 'Current worker',
  lifeDomain: archive.lifeDomain || 'Unknown',
});

const makeCaseWikiAuditRecord = ({ action, object, timestamp = new Date().toISOString() }) => ({
  id: `audit-case-wiki-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
  actor: 'Current worker',
  action,
  object,
  timestamp,
});

const wikiIngestionTitle = (ingestion = {}) => {
  const archive = archiveForWikiIngestion(ingestion);
  return (
    archive.suggestedWikiTitle ||
    ingestion.generatedRecords?.frontendRecord?.title ||
    ingestion.wikiPage?.title ||
    ingestion.originalName ||
    ingestion.fileId ||
    'Source document'
  );
};

const buildArticleConsolidationPlan = ({ baseIngestion, candidateIngestions = [], mode = 'merge-candidates' } = {}) => {
  const now = new Date().toISOString();
  const baseArchive = archiveForWikiIngestion(baseIngestion);
  const baseTitle = wikiIngestionTitle(baseIngestion);
  const candidateSummaries = candidateIngestions.map((ingestion) => {
    const archive = archiveForWikiIngestion(ingestion);
    const sharedCollections = compactStringArray([
      ...(Array.isArray(baseArchive.suggestedCollections) ? baseArchive.suggestedCollections : []),
      ...(Array.isArray(archive.suggestedCollections) ? archive.suggestedCollections : []),
    ], 8);
    const reasons = compactStringArray(
      [
        archive.lifeDomain && baseArchive.lifeDomain && archive.lifeDomain === baseArchive.lifeDomain
          ? `same life domain: ${archive.lifeDomain}`
          : '',
        archive.lane && baseArchive.lane && archive.lane === baseArchive.lane ? `same lane: ${archive.lane}` : '',
        archive.sourceKind && archive.sourceKind === baseArchive.sourceKind ? `same source kind: ${archive.sourceKind}` : '',
        archive.cleanupDecision?.canonicalSource?.sourceId === baseIngestion.fileId ? 'already points to this canonical source' : '',
        ingestion.sha256 && baseIngestion.sha256 && ingestion.sha256 === baseIngestion.sha256 ? 'same content hash' : '',
        sharedCollections.length ? `related collections: ${sharedCollections.slice(0, 3).join(', ')}` : '',
      ],
      6,
    );
    return {
      sourceId: ingestion.fileId,
      sourcePageId: ingestion.wikiPage?.id || ingestion.generatedRecords?.frontendRecord?.pageId || `ingest:${ingestion.fileId}`,
      sourceLabel: wikiIngestionTitle(ingestion),
      sourceHash: ingestion.sha256 || ingestion.generatedRecords?.frontendRecord?.sourceHash || '',
      reviewStatus: archive.reviewStatus || 'needs-human-review',
      lifeDomain: archive.lifeDomain || baseArchive.lifeDomain || 'Unknown',
      lane: archive.lane || 'Source documents',
      role: 'supporting-source',
      reasons,
    };
  });

  const sourceIds = compactStringArray([baseIngestion?.fileId, ...candidateSummaries.map((candidate) => candidate.sourceId)], 30);
  const planHash = crypto
    .createHash('sha256')
    .update(`${baseIngestion?.fileId || 'source'}:${sourceIds.join('|')}:${mode}`)
    .digest('hex')
    .slice(0, 18);

  return {
    id: `article-consolidation:${planHash}`,
    status: 'merge-plan-ready',
    mode,
    targetPageId: baseIngestion?.wikiPage?.id || baseIngestion?.generatedRecords?.frontendRecord?.pageId || `ingest:${baseIngestion?.fileId}`,
    targetSourceId: baseIngestion?.fileId || '',
    targetTitle: baseTitle,
    plannedAt: now,
    plannedBy: 'Current worker',
    sourceIds,
    sourceCount: sourceIds.length,
    candidateCount: candidateSummaries.length,
    candidateSummaries,
    nonDestructive: true,
    fileAction: false,
    articleWrite: false,
    vectorWrite: false,
    graphWrite: false,
    attachmentWrite: false,
    recommendation:
      candidateSummaries.length > 0
        ? `Use this as an editorial consolidation plan for "${baseTitle}". Review chunks and citations before promoting any merged article prose.`
        : `Keep "${baseTitle}" as its own article candidate until related standalone sources are selected.`,
  };
};

const buildArticleCitationReviewPacket = ({ targetIngestion, sourceIngestions = [], plan = {} } = {}) => {
  const now = new Date().toISOString();
  const targetTitle = plan.targetTitle || wikiIngestionTitle(targetIngestion);
  const sourceSummaries = [];
  const reviewedCitations = [];
  const pendingChunks = [];
  const blockedChunks = [];
  const metadataOnlySources = [];

  sourceIngestions.forEach((ingestion) => {
    const archive = archiveForWikiIngestion(ingestion);
    const review = summarizeEmbeddingReview(makeFallbackEmbeddingReview(ingestion));
    const chunks = Array.isArray(review.chunks) ? review.chunks : [];
    const sourceTitle = wikiIngestionTitle(ingestion);
    const sourcePageId = ingestion.wikiPage?.id || ingestion.generatedRecords?.frontendRecord?.pageId || `ingest:${ingestion.fileId}`;
    const approved = chunks.filter((chunk) => chunk.status === 'approved-for-embedding');
    const pending = chunks.filter((chunk) => chunk.status === 'pending-review');
    const blocked = chunks.filter((chunk) => chunk.status === 'do-not-embed');

    if (!chunks.length) {
      metadataOnlySources.push({
        sourceId: ingestion.fileId,
        sourcePageId,
        sourceTitle,
        reason: review.note || 'No readable review chunks are available yet.',
      });
    }

    sourceSummaries.push({
      sourceId: ingestion.fileId,
      sourcePageId,
      sourceTitle,
      lifeDomain: archive.lifeDomain || 'Unknown',
      lane: archive.lane || 'Source documents',
      reviewStatus: archive.reviewStatus || 'needs-human-review',
      chunkCount: chunks.length,
      approvedCount: approved.length,
      pendingCount: pending.length,
      blockedCount: blocked.length,
    });

    approved.forEach((chunk, index) => {
      const citationId = `citation:${ingestion.fileId}:${chunk.id}`;
      reviewedCitations.push({
        id: citationId,
        marker: `[${reviewedCitations.length + 1}]`,
        sourceDocumentId: ingestion.fileId,
        sourcePageId,
        sourceTitle,
        chunkId: chunk.id,
        ordinal: chunk.ordinal || index + 1,
        evidenceState: 'reviewed',
        status: chunk.status,
        textPreview: String(chunk.textPreview || '').slice(0, 900),
        privacyLevel: chunk.privacyLevel || review.privacyLevel || 'case-team',
        redactionMode: chunk.redactionMode || review.redactionMode || 'standard',
        reviewedAt: chunk.reviewedAt || review.reviewedAt || '',
        reviewedBy: chunk.reviewedBy || review.reviewedBy || '',
      });
    });

    pending.forEach((chunk, index) => {
      pendingChunks.push({
        sourceDocumentId: ingestion.fileId,
        sourcePageId,
        sourceTitle,
        chunkId: chunk.id,
        ordinal: chunk.ordinal || index + 1,
        status: chunk.status,
        textPreview: String(chunk.textPreview || '').slice(0, 600),
        reviewNote: chunk.reviewNote || review.reviewReason || 'Review before this can become article evidence.',
      });
    });

    blocked.forEach((chunk, index) => {
      blockedChunks.push({
        sourceDocumentId: ingestion.fileId,
        sourcePageId,
        sourceTitle,
        chunkId: chunk.id,
        ordinal: chunk.ordinal || index + 1,
        status: chunk.status,
        textPreview: String(chunk.textPreview || '').slice(0, 400),
        reviewNote: chunk.reviewNote || 'Marked do not embed.',
      });
    });
  });

  const status =
    reviewedCitations.length > 0 && pendingChunks.length === 0
      ? 'ready-for-article-draft'
      : reviewedCitations.length > 0
        ? 'partial-citations-needs-review'
        : pendingChunks.length > 0
          ? 'needs-citation-review'
          : 'metadata-only-no-citations';
  const promotionBlocked = status !== 'ready-for-article-draft';
  const packetHash = crypto
    .createHash('sha256')
    .update(`${plan.id || targetIngestion?.fileId || 'article'}:${sourceSummaries.map((source) => source.sourceId).join('|')}:${reviewedCitations.length}:${pendingChunks.length}`)
    .digest('hex')
    .slice(0, 18);

  return {
    id: `article-citation-review:${packetHash}`,
    status,
    targetTitle,
    targetSourceId: targetIngestion?.fileId || plan.targetSourceId || '',
    targetPageId: plan.targetPageId || targetIngestion?.wikiPage?.id || `ingest:${targetIngestion?.fileId}`,
    planId: plan.id || '',
    preparedAt: now,
    preparedBy: 'Current worker',
    sourceCount: sourceSummaries.length,
    chunkCount: reviewedCitations.length + pendingChunks.length + blockedChunks.length,
    reviewedCitationCount: reviewedCitations.length,
    pendingChunkCount: pendingChunks.length,
    blockedChunkCount: blockedChunks.length,
    metadataOnlySourceCount: metadataOnlySources.length,
    promotionBlocked,
    reviewedCitations,
    pendingChunks: pendingChunks.slice(0, 80),
    blockedChunks: blockedChunks.slice(0, 40),
    metadataOnlySources: metadataOnlySources.slice(0, 40),
    sourceSummaries,
    nextActions: promotionBlocked
      ? [
          reviewedCitations.length ? 'Review remaining pending chunks' : 'Approve at least one chunk as reviewed evidence',
          'Rebuild the citation review packet',
          'Only then prepare or promote merged article prose',
        ]
      : ['Prepare a reviewed article draft from this packet', 'Promote only citation-backed sections'],
    nonDestructive: true,
    articleWrite: false,
    vectorWrite: false,
    graphWrite: false,
    attachmentWrite: false,
    fileAction: false,
  };
};

const buildArticleDraftPreviewFromCitationPacket = ({ targetIngestion, plan = {}, packet = {} } = {}) => {
  const reviewedCitations = Array.isArray(packet.reviewedCitations) ? packet.reviewedCitations : [];
  const sourceSummaries = Array.isArray(packet.sourceSummaries) ? packet.sourceSummaries : [];
  const targetTitle = plan.targetTitle || packet.targetTitle || wikiIngestionTitle(targetIngestion);
  if (!packet.id) {
    return {
      error: 'Article draft preview needs a citation review packet.',
      blockedReasons: ['Prepare a citation review packet before drafting from source evidence.'],
    };
  }
  if (!reviewedCitations.length) {
    return {
      error: 'Article draft preview needs reviewed citations.',
      blockedReasons: ['Approve at least one source chunk before preparing an article draft preview.'],
    };
  }

  const now = new Date().toISOString();
  const sourceTitles = compactStringArray(
    sourceSummaries.map((source) => source.sourceTitle).filter(Boolean),
    8,
  );
  const citationIds = compactStringArray(reviewedCitations.map((citation) => citation.id), 80);
  const leadCitationIds = citationIds.slice(0, 3);
  const status = packet.pendingChunkCount > 0 ? 'draft-preview-needs-review' : 'draft-preview-ready-for-review';
  const reviewGapText = [
    packet.pendingChunkCount
      ? `${packet.pendingChunkCount} pending chunk${packet.pendingChunkCount === 1 ? '' : 's'} still need review.`
      : 'No pending chunks are blocking the current citation packet.',
    packet.blockedChunkCount
      ? `${packet.blockedChunkCount} blocked chunk${packet.blockedChunkCount === 1 ? '' : 's'} stay out of the article.`
      : '',
    packet.metadataOnlySourceCount
      ? `${packet.metadataOnlySourceCount} metadata-only source${packet.metadataOnlySourceCount === 1 ? '' : 's'} need stronger extraction before they can cite claims.`
      : '',
  ].filter(Boolean).join(' ');
  const evidenceLines = reviewedCitations
    .slice(0, 8)
    .map((citation) =>
      `${citation.marker || ''} ${citation.sourceTitle || citation.sourceDocumentId || 'Reviewed source'}: ${truncateRetrievalText(
        citation.textPreview || 'Reviewed evidence is available for this source.',
        360,
      )}`.trim(),
    );
  const coverageLines = sourceSummaries
    .slice(0, 8)
    .map((source) =>
      `${source.sourceTitle || source.sourceId}: ${source.approvedCount || 0} reviewed, ${source.pendingCount || 0} pending, ${
        source.blockedCount || 0
      } blocked chunk${(source.chunkCount || 0) === 1 ? '' : 's'}.`,
    );
  const sections = [
    {
      id: 'section-lead',
      heading: 'Lead',
      text: truncateRetrievalText(
        `${targetTitle} is a draft Case Wiki article built from reviewed source evidence${
          sourceTitles.length ? ` across ${sourceTitles.slice(0, 4).join(', ')}` : ''
        }. This preview is citation-first and has not been promoted to a permanent wiki article.`,
        1200,
      ),
      citationIds: leadCitationIds,
      reviewState: status === 'draft-preview-ready-for-review' ? 'reviewed-citation-preview' : 'reviewed-citation-preview-with-gaps',
    },
    {
      id: 'section-reviewed-evidence',
      heading: 'Reviewed evidence',
      text: truncateRetrievalText(evidenceLines.join('\n'), 2000),
      citationIds,
      reviewState: 'reviewed-evidence',
    },
    {
      id: 'section-source-coverage',
      heading: 'Source coverage',
      text: truncateRetrievalText(coverageLines.join('\n'), 1600),
      citationIds: [],
      reviewState: 'source-coverage-summary',
    },
    {
      id: 'section-review-gaps',
      heading: 'Review gaps',
      text: truncateRetrievalText(reviewGapText, 1200),
      citationIds: [],
      reviewState: packet.pendingChunkCount > 0 ? 'needs-human-review' : 'ready-for-human-wording-review',
    },
  ].filter((section) => section.text);
  const draftHash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        targetTitle,
        packetId: packet.id,
        citationIds,
        status,
      }),
    )
    .digest('hex')
    .slice(0, 18);

  return {
    id: `article-draft-preview:${draftHash}`,
    status,
    mode: 'deterministic-reviewed-citation-preview',
    targetTitle,
    targetSourceId: targetIngestion?.fileId || packet.targetSourceId || plan.targetSourceId || '',
    targetPageId: packet.targetPageId || plan.targetPageId || targetIngestion?.wikiPage?.id || `ingest:${targetIngestion?.fileId}`,
    planId: plan.id || packet.planId || '',
    citationPacketId: packet.id,
    preparedAt: now,
    preparedBy: 'Current worker',
    previewOnly: true,
    publishable: false,
    requiresHumanPromotionConfirmation: true,
    citationReviewStatus: packet.status || '',
    reviewedCitationCount: reviewedCitations.length,
    pendingChunkCount: packet.pendingChunkCount || 0,
    blockedChunkCount: packet.blockedChunkCount || 0,
    metadataOnlySourceCount: packet.metadataOnlySourceCount || 0,
    sourceCount: packet.sourceCount || sourceSummaries.length,
    lead: sections[0]?.text || '',
    sections,
    citationLedger: reviewedCitations,
    sourceSummaries,
    reviewGaps: {
      pendingChunkCount: packet.pendingChunkCount || 0,
      blockedChunkCount: packet.blockedChunkCount || 0,
      metadataOnlySourceCount: packet.metadataOnlySourceCount || 0,
      summary: reviewGapText,
    },
    nextActions:
      packet.pendingChunkCount > 0
        ? ['Review remaining pending chunks', 'Rebuild the citation packet', 'Refresh this draft preview']
        : ['Review wording', 'Decide whether to promote as a permanent article', 'Keep source pages attached as citations'],
    nonDestructive: true,
    articleWrite: false,
    vectorWrite: false,
    graphWrite: false,
    attachmentWrite: false,
    fileAction: false,
  };
};

const buildArticlePromotionReadinessReview = ({ targetIngestion, plan = {}, draftPreview = {} } = {}) => {
  const targetTitle = draftPreview.targetTitle || plan.targetTitle || wikiIngestionTitle(targetIngestion);
  if (!draftPreview.id) {
    return {
      error: 'Promotion readiness needs an article draft preview.',
      blockedReasons: ['Prepare a reviewed article draft preview before checking promotion readiness.'],
    };
  }

  const sections = Array.isArray(draftPreview.sections) ? draftPreview.sections : [];
  const citationLedger = Array.isArray(draftPreview.citationLedger) ? draftPreview.citationLedger : [];
  const citationIds = new Set(citationLedger.map((citation) => citation.id).filter(Boolean));
  const contextOnlyReviewStates = new Set(['source-coverage-summary', 'needs-human-review', 'ready-for-human-wording-review']);
  const publishableSections = sections.filter(
    (section) => !contextOnlyReviewStates.has(section.reviewState),
  );
  const uncitedPublishableSections = publishableSections.filter((section) => {
    const sectionCitationIds = compactStringArray(section.citationIds || [], 20);
    return !sectionCitationIds.length || sectionCitationIds.some((citationId) => !citationIds.has(citationId));
  });
  const pendingChunkCount = draftPreview.pendingChunkCount || draftPreview.reviewGaps?.pendingChunkCount || 0;
  const metadataOnlySourceCount = draftPreview.metadataOnlySourceCount || draftPreview.reviewGaps?.metadataOnlySourceCount || 0;
  const blockedChunkCount = draftPreview.blockedChunkCount || draftPreview.reviewGaps?.blockedChunkCount || 0;
  const blockedReasons = [
    !sections.length ? 'No draft preview sections are available.' : '',
    !citationLedger.length ? 'No reviewed citation ledger is attached to the draft preview.' : '',
    uncitedPublishableSections.length
      ? `${uncitedPublishableSections.length} publishable section${uncitedPublishableSections.length === 1 ? '' : 's'} need reviewed citation ids.`
      : '',
    pendingChunkCount
      ? `${pendingChunkCount} pending chunk${pendingChunkCount === 1 ? '' : 's'} must be reviewed or excluded before promotion.`
      : '',
  ].filter(Boolean);
  const warnings = [
    metadataOnlySourceCount
      ? `${metadataOnlySourceCount} metadata-only source${metadataOnlySourceCount === 1 ? '' : 's'} still need stronger extraction for full coverage.`
      : '',
    blockedChunkCount
      ? `${blockedChunkCount} blocked chunk${blockedChunkCount === 1 ? '' : 's'} stay excluded from the article.`
      : '',
  ].filter(Boolean);
  const status = blockedReasons.length ? 'needs-review-before-promotion' : 'ready-for-human-promotion';
  const now = new Date().toISOString();
  const reviewHash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        draftPreviewId: draftPreview.id,
        citationIds: Array.from(citationIds),
        sectionCount: sections.length,
        status,
      }),
    )
    .digest('hex')
    .slice(0, 18);
  const checklist = [
    {
      id: 'reviewed-citations',
      label: 'Reviewed citations attached',
      status: citationLedger.length ? 'pass' : 'blocked',
      detail: `${citationLedger.length} reviewed citation${citationLedger.length === 1 ? '' : 's'} available.`,
    },
    {
      id: 'section-citations',
      label: 'Publishable sections cite reviewed evidence',
      status: uncitedPublishableSections.length ? 'blocked' : 'pass',
      detail: uncitedPublishableSections.length
        ? uncitedPublishableSections.map((section) => section.heading || section.id).join(', ')
        : `${publishableSections.length} publishable section${publishableSections.length === 1 ? '' : 's'} passed citation checks.`,
    },
    {
      id: 'pending-chunks',
      label: 'Pending chunks resolved',
      status: pendingChunkCount ? 'blocked' : 'pass',
      detail: pendingChunkCount ? `${pendingChunkCount} pending chunk${pendingChunkCount === 1 ? '' : 's'} remain.` : 'No pending chunks remain.',
    },
    {
      id: 'blocked-chunks',
      label: 'Blocked chunks excluded',
      status: 'pass',
      detail: `${blockedChunkCount} blocked chunk${blockedChunkCount === 1 ? '' : 's'} excluded from promotion.`,
    },
    {
      id: 'human-confirmation',
      label: 'Human promotion confirmation required',
      status: 'required',
      detail: 'Promotion is still a separate human-confirmed step.',
    },
  ];

  return {
    id: `article-promotion-readiness:${reviewHash}`,
    status,
    targetTitle,
    targetSourceId: draftPreview.targetSourceId || targetIngestion?.fileId || plan.targetSourceId || '',
    targetPageId: draftPreview.targetPageId || plan.targetPageId || targetIngestion?.wikiPage?.id || `ingest:${targetIngestion?.fileId}`,
    planId: plan.id || draftPreview.planId || '',
    draftPreviewId: draftPreview.id,
    citationPacketId: draftPreview.citationPacketId || '',
    reviewedAt: now,
    reviewedBy: 'Current worker',
    checklist,
    blockedReasons,
    warnings,
    sectionReadiness: sections.map((section) => {
      const sectionCitationIds = compactStringArray(section.citationIds || [], 20);
      return {
        sectionId: section.id || '',
        heading: section.heading || 'Draft section',
        reviewState: section.reviewState || '',
        citationCount: sectionCitationIds.length,
        status:
          section.reviewState === 'source-coverage-summary'
            ? 'context-only'
            : section.reviewState === 'ready-for-human-wording-review'
              ? 'context-only'
            : section.reviewState === 'needs-human-review'
              ? 'needs-human-review'
              : sectionCitationIds.length && sectionCitationIds.every((citationId) => citationIds.has(citationId))
                ? 'ready'
                : 'missing-reviewed-citations',
      };
    }),
    reviewedCitationCount: citationLedger.length,
    sectionCount: sections.length,
    publishableSectionCount: publishableSections.length,
    blockedSectionCount: uncitedPublishableSections.length,
    pendingChunkCount,
    blockedChunkCount,
    metadataOnlySourceCount,
    readyForHumanPromotion: status === 'ready-for-human-promotion',
    requiresHumanPromotionConfirmation: true,
    nonDestructive: true,
    articleWrite: false,
    vectorWrite: false,
    graphWrite: false,
    attachmentWrite: false,
    fileAction: false,
    nextActions:
      status === 'ready-for-human-promotion'
        ? ['Review wording one last time', 'Confirm promotion in a separate action', 'Keep source pages as citations']
        : ['Resolve blocked checklist items', 'Refresh the draft preview', 'Run promotion readiness again'],
  };
};

const buildConfirmedArticlePromotionRecord = ({
  targetIngestion,
  plan = {},
  draftPreview = {},
  promotionReadiness = {},
  actor = '',
} = {}) => {
  if (!promotionReadiness.readyForHumanPromotion || promotionReadiness.status !== 'ready-for-human-promotion') {
    return {
      error: 'Article promotion is blocked until readiness passes.',
      blockedReasons: promotionReadiness.blockedReasons?.length
        ? promotionReadiness.blockedReasons
        : ['Run promotion readiness and resolve every blocker before publishing article prose.'],
    };
  }

  const title = asString(draftPreview.targetTitle || promotionReadiness.targetTitle || plan.targetTitle || wikiIngestionTitle(targetIngestion));
  const rawSections = Array.isArray(draftPreview.sections) ? draftPreview.sections : [];
  const excludedReviewStates = new Set(['source-coverage-summary', 'needs-human-review', 'ready-for-human-wording-review']);
  const rawPublishableSections = rawSections.filter((section) => !excludedReviewStates.has(section.reviewState));
  const citations = (Array.isArray(draftPreview.citationLedger) ? draftPreview.citationLedger : [])
    .map((citation, index) => {
      const sourceCitation = citation && typeof citation === 'object' ? citation : {};
      return normalizePromotionCitation(
        {
          ...sourceCitation,
          pageId: sourceCitation.pageId || sourceCitation.sourcePageId,
        },
        index,
      );
    })
    .filter(Boolean);
  const citationIds = new Set(citations.map((citation) => citation.id).filter(Boolean));
  const sections = rawPublishableSections
    .map(normalizePromotionSection)
    .filter(Boolean);
  const sectionDiffs = rawSections.map((section, index) => {
    const sectionCitationIds = compactStringArray(section.citationIds || [], 20);
    const isExcluded = excludedReviewStates.has(section.reviewState);
    const missingCitationIds = sectionCitationIds.filter((citationId) => !citationIds.has(citationId));
    const ready = !isExcluded && sectionCitationIds.length > 0 && missingCitationIds.length === 0;
    return {
      heading: section.heading || `Section ${index + 1}`,
      reviewState: section.reviewState || '',
      status: isExcluded ? 'excluded-context' : ready ? 'ready-to-publish' : 'blocked-missing-reviewed-citations',
      reason: isExcluded
        ? 'This section remains context or review material and is not promoted as article prose.'
        : ready
          ? 'Section cites reviewed evidence in the promotion citation ledger.'
          : 'Publishable article sections need reviewed citation ids before promotion.',
      willPublish: ready,
      reviewedCitationIds: sectionCitationIds.filter((citationId) => citationIds.has(citationId)),
      unknownCitationIds: missingCitationIds,
      citationCount: sectionCitationIds.length,
    };
  });
  const blockedSections = sectionDiffs.filter((section) => section.status === 'blocked-missing-reviewed-citations');
  const sourceDocumentIds = compactStringArray(citations.map((citation) => citation.sourceDocumentId), 50);
  const now = new Date().toISOString();
  const slug = slugifyTextForId(title) || 'case-wiki-article';
  const citationHash = crypto
    .createHash('sha256')
    .update(`${draftPreview.id || title}:${citations.map((citation) => normalizeDraftCitationKey(citation)).join('\n')}`)
    .digest('hex')
    .slice(0, 16);

  if (!citations.length) {
    return {
      error: 'Article promotion needs reviewed citations.',
      blockedReasons: ['Add a reviewed citation ledger before promoting this article.'],
    };
  }
  if (!sections.length) {
    return {
      error: 'Article promotion needs publishable sections.',
      blockedReasons: ['At least one citation-backed article section must be ready before promotion.'],
    };
  }
  if (blockedSections.length) {
    return {
      error: 'Article promotion coverage check failed.',
      blockedReasons: blockedSections.map((section) => `${section.heading}: ${section.reason}`),
      citationCoverageDiff: {
        status: 'blocked',
        mode: 'article-consolidation-promotion-coverage',
        sectionDiffs,
      },
    };
  }

  return {
    id: `promotion:${slug}:${citationHash}`,
    pageId: `promotion:${slug}`,
    title,
    query: title,
    status: 'published-section',
    publishMode: 'human-confirmed-article-consolidation',
    lead: truncateRetrievalText(draftPreview.lead || sections[0]?.text || '', 1600),
    sections,
    citationLedger: citations,
    sourceDocumentIds,
    createdAt: now,
    updatedAt: now,
    createdBy: asString(actor, 'Current worker'),
    reviewState: 'reviewed-article-consolidation',
    citationCoverageDiff: {
      status: 'pass',
      mode: 'article-consolidation-promotion-coverage',
      summary: `${sections.length} article section${sections.length === 1 ? '' : 's'} promoted with ${citations.length} reviewed citation${citations.length === 1 ? '' : 's'}. Context and review-gap sections stayed out.`,
      promotableSectionCount: sections.length,
      blockedSectionCount: 0,
      excludedSectionCount: sectionDiffs.filter((section) => section.status === 'excluded-context').length,
      reviewedCitationCount: citations.length,
      sectionDiffs,
    },
    sourcePolicy:
      'Promoted from a human-confirmed article consolidation draft. Source pages remain intact as citations; context-only and review-gap sections stayed out of article prose.',
    sourceArticlePageId: draftPreview.targetPageId || plan.targetPageId || targetIngestion?.wikiPage?.id || `ingest:${targetIngestion?.fileId}`,
    sourceArticleId: draftPreview.id || '',
    articleConsolidationPlanId: plan.id || '',
    articlePromotionReadinessId: promotionReadiness.id || '',
  };
};

const buildArticleSplitReviewPlan = ({ targetIngestion, plan = {}, draftPreview = {} } = {}) => {
  const targetTitle = asString(draftPreview.targetTitle || plan.targetTitle || wikiIngestionTitle(targetIngestion));
  if (!draftPreview.id) {
    return {
      error: 'Article split review needs an article draft preview.',
      blockedReasons: ['Prepare a reviewed article draft preview before deciding whether the source should split into multiple wiki articles.'],
    };
  }

  const sections = Array.isArray(draftPreview.sections) ? draftPreview.sections : [];
  if (!sections.length) {
    return {
      error: 'Article split review needs draft sections.',
      blockedReasons: ['The draft preview has no sections to evaluate for split-specific article candidates.'],
    };
  }

  const now = new Date().toISOString();
  const citationLedger = Array.isArray(draftPreview.citationLedger) ? draftPreview.citationLedger : [];
  const citationById = new Map(citationLedger.map((citation) => [citation.id, citation]).filter(([id]) => Boolean(id)));
  const sourceSummaries = Array.isArray(draftPreview.sourceSummaries) ? draftPreview.sourceSummaries : [];
  const contextOnlyReviewStates = new Set(['source-coverage-summary', 'needs-human-review', 'ready-for-human-wording-review']);
  const reviewOnlyHeadings = new Set(['source coverage', 'review gaps']);
  const publishableSections = sections.filter((section) => {
    const heading = asString(section.heading).toLowerCase();
    return !contextOnlyReviewStates.has(section.reviewState) && !reviewOnlyHeadings.has(heading);
  });
  const splitCandidates = publishableSections.map((section, index) => {
    const heading = asString(section.heading, `Section ${index + 1}`);
    const sectionCitationIds = compactStringArray(section.citationIds || [], 40);
    const knownCitations = sectionCitationIds.map((citationId) => citationById.get(citationId)).filter(Boolean);
    const missingCitationIds = sectionCitationIds.filter((citationId) => !citationById.has(citationId));
    const sourceDocumentIds = compactStringArray(knownCitations.map((citation) => citation.sourceDocumentId), 30);
    const sourceTitles = compactStringArray(knownCitations.map((citation) => citation.sourceTitle), 8);
    const isLead = slugifyTextForId(heading) === 'lead';
    const readiness = !sectionCitationIds.length
      ? 'needs-reviewed-citations'
      : missingCitationIds.length
        ? 'needs-citation-repair'
        : 'ready-for-split-review';
    const recommendedAction =
      readiness === 'ready-for-split-review' && !isLead
        ? 'promote-separate-article-candidate'
        : 'keep-in-parent-article';

    return {
      candidateId: `article-split-candidate:${slugifyTextForId(targetTitle) || 'article'}:${slugifyTextForId(heading) || index + 1}`,
      title: isLead ? targetTitle : `${targetTitle}: ${heading}`,
      reason: isLead
        ? 'The lead should usually stay with the parent article unless later reviewed as its own topic.'
        : sourceDocumentIds.length > 1
          ? `This section pulls reviewed citations from ${sourceDocumentIds.length} source documents and may deserve its own focused article.`
          : sourceDocumentIds.length === 1
            ? `This section is citation-backed by ${sourceTitles[0] || sourceDocumentIds[0]} and can be reviewed as a focused article candidate.`
            : 'This section needs stronger reviewed citation coverage before it can split cleanly.',
      sectionIds: compactStringArray([section.id || `section-${index + 1}`], 5),
      sectionHeadings: compactStringArray([heading], 5),
      citationIds: sectionCitationIds,
      missingCitationIds,
      sourceDocumentIds,
      sourceTitles,
      readiness,
      recommendedAction,
      reviewState: section.reviewState || '',
      textPreview: truncateRetrievalText(section.text || '', 520),
    };
  });
  const promotableSplitCount = splitCandidates.filter(
    (candidate) => candidate.recommendedAction === 'promote-separate-article-candidate',
  ).length;
  const blockedReasons = [
    !publishableSections.length ? 'No publishable draft sections are available for split review.' : '',
    splitCandidates.some((candidate) => candidate.missingCitationIds.length)
      ? 'Some candidate sections cite ids that are missing from the reviewed citation ledger.'
      : '',
  ].filter(Boolean);
  const keepTogetherReasons = [
    splitCandidates.length <= 1
      ? 'The current draft has one or fewer publishable sections, so the parent article should stay together for now.'
      : '',
    sourceSummaries.length <= 1
      ? 'Only one source summary is currently visible; broader source coverage may be needed before splitting.'
      : '',
    draftPreview.metadataOnlySourceCount
      ? `${draftPreview.metadataOnlySourceCount} metadata-only source${draftPreview.metadataOnlySourceCount === 1 ? '' : 's'} still need stronger extraction before they can shape split articles.`
      : '',
  ].filter(Boolean);
  const status = blockedReasons.length
    ? 'split-review-needs-draft-repair'
    : promotableSplitCount > 0
      ? 'split-review-ready'
      : 'split-review-keeps-parent';
  const reviewHash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        draftPreviewId: draftPreview.id,
        splitCandidates: splitCandidates.map((candidate) => [
          candidate.title,
          candidate.citationIds,
          candidate.recommendedAction,
        ]),
        status,
      }),
    )
    .digest('hex')
    .slice(0, 18);

  return {
    id: `article-split-review:${reviewHash}`,
    status,
    targetTitle,
    targetSourceId: draftPreview.targetSourceId || targetIngestion?.fileId || plan.targetSourceId || '',
    targetPageId: draftPreview.targetPageId || plan.targetPageId || targetIngestion?.wikiPage?.id || `ingest:${targetIngestion?.fileId}`,
    planId: plan.id || draftPreview.planId || '',
    draftPreviewId: draftPreview.id,
    citationPacketId: draftPreview.citationPacketId || '',
    reviewedAt: now,
    reviewedBy: 'Current worker',
    splitCandidates,
    splitCandidateCount: splitCandidates.length,
    promotableSplitCount,
    keepTogetherReasons,
    blockedReasons,
    sourceSummaries,
    sourceCount: sourceSummaries.length || draftPreview.sourceCount || 0,
    reviewedCitationCount: citationLedger.length,
    nextActions:
      status === 'split-review-ready'
        ? ['Review each split candidate title', 'Prepare citations for separate article candidates', 'Promote only after human confirmation']
        : ['Keep the parent article intact for now', 'Improve extraction or citation review', 'Refresh split review after the draft changes'],
    nonDestructive: true,
    articleWrite: false,
    vectorWrite: false,
    graphWrite: false,
    attachmentWrite: false,
    fileAction: false,
  };
};

const caseWikiReviewUpdates = (ingestion, archive, attachmentTarget = null) => {
  const set = {
    archive,
    'wikiPage.archive': archive,
    'generatedRecords.frontendRecord.archive': archive,
  };

  if (!attachmentTarget) {
    set.sourceScope = 'standalone';
    set.linkedClientId = '';
    set.linkedCaseId = '';
    set.linkedServiceName = '';
    set.sourcePageId = '';
    set['privacy.sourceScope'] = 'standalone';
    set['generatedRecords.frontendRecord.sourceScope'] = 'standalone';
    set['generatedRecords.frontendRecord.linkedClientId'] = '';
    set['generatedRecords.frontendRecord.linkedCaseId'] = '';
    set['generatedRecords.frontendRecord.linkedServiceName'] = '';
    set['generatedRecords.note.clientId'] = '';
    set['generatedRecords.note.caseId'] = '';
    set['generatedRecords.document.clientId'] = '';
    set['generatedRecords.document.caseId'] = '';
    set['generatedRecords.timeline.clientId'] = '';
    set['generatedRecords.timeline.caseId'] = '';
    return set;
  }

  const linkedClientId =
    attachmentTarget.targetType === 'client' ? attachmentTarget.targetId : attachmentTarget.clientId || '';
  const linkedCaseId =
    attachmentTarget.targetType === 'case' ? attachmentTarget.targetId : attachmentTarget.caseId || '';
  const linkedServiceName =
    attachmentTarget.targetType === 'service' ? attachmentTarget.targetLabel : attachmentTarget.serviceName || '';
  const sourcePageId =
    attachmentTarget.targetType === 'service'
      ? `service:${attachmentTarget.targetId}`
      : attachmentTarget.targetType === 'project'
        ? `workflow:${attachmentTarget.targetId}`
        : `${attachmentTarget.targetType}:${attachmentTarget.targetId}`;

  set.sourceScope = 'current-record';
  set.linkedClientId = linkedClientId;
  set.linkedCaseId = linkedCaseId;
  set.linkedServiceName = linkedServiceName;
  set.sourcePageId = sourcePageId;
  set['privacy.sourceScope'] = 'current-record';
  set['generatedRecords.frontendRecord.sourceScope'] = 'current-record';
  set['generatedRecords.frontendRecord.linkedClientId'] = linkedClientId;
  set['generatedRecords.frontendRecord.linkedCaseId'] = linkedCaseId;
  set['generatedRecords.frontendRecord.linkedServiceName'] = linkedServiceName;
  set['generatedRecords.note.clientId'] = linkedClientId;
  set['generatedRecords.note.caseId'] = linkedCaseId;
  set['generatedRecords.document.clientId'] = linkedClientId;
  set['generatedRecords.document.caseId'] = linkedCaseId;
  set['generatedRecords.timeline.clientId'] = linkedClientId;
  set['generatedRecords.timeline.caseId'] = linkedCaseId;
  set['generatedRecords.note.structuredFields'] = [
    ...(ingestion.generatedRecords?.note?.structuredFields || []),
    `Archive attachment: ${attachmentTarget.targetType} ${attachmentTarget.targetLabel}`,
  ];
  return set;
};

const attachmentGraphForReview = (ingestion, archive, attachmentTarget) => {
  if (!attachmentTarget) return null;
  const wikiPageId = ingestion.wikiPage?.id || ingestion.generatedRecords?.frontendRecord?.pageId || `ingest:${ingestion.fileId}`;
  const wikiNodeId = `wiki:${wikiPageId}`;
  const fileNodeId = `file:${ingestion.fileId}`;
  const targetNodeId =
    attachmentTarget.targetType === 'service'
      ? `service:${attachmentTarget.targetLabel}`
      : attachmentTarget.targetType === 'project'
        ? `workflow:${attachmentTarget.targetId}`
        : `${attachmentTarget.targetType}:${attachmentTarget.targetId}`;
  const targetKind =
    attachmentTarget.targetType === 'client'
      ? 'Client'
      : attachmentTarget.targetType === 'case'
        ? 'Case'
        : attachmentTarget.targetType === 'service'
          ? 'Service'
          : 'Workflow';
  const edgeKind =
    attachmentTarget.targetType === 'client'
      ? 'ABOUT_CLIENT'
      : attachmentTarget.targetType === 'case'
        ? 'ABOUT_CASE'
        : attachmentTarget.targetType === 'service'
          ? 'ABOUT_SERVICE'
          : 'ABOUT_WORKFLOW';

  return {
    nodes: [
      {
        id: fileNodeId,
        kind: 'SourceFile',
        props: {
          name: ingestion.originalName,
          archiveReviewStatus: archive.reviewStatus,
          sourceScope: 'current-record',
          attachedTargetLabel: attachmentTarget.targetLabel,
          attachedTargetType: attachmentTarget.targetType,
        },
      },
      {
        id: wikiNodeId,
        kind: 'WikiPage',
        props: {
          title: ingestion.wikiPage?.title || ingestion.generatedRecords?.frontendRecord?.title || ingestion.originalName,
          archiveReviewStatus: archive.reviewStatus,
          sourceScope: 'current-record',
          attachedTargetLabel: attachmentTarget.targetLabel,
          attachedTargetType: attachmentTarget.targetType,
        },
      },
      {
        id: targetNodeId,
        kind: targetKind,
        props: {
          name: attachmentTarget.targetLabel,
          source: 'Case Wiki archive review',
        },
      },
    ],
    edges: [
      {
        from: fileNodeId,
        to: wikiNodeId,
        kind: 'GENERATED_WIKI_PAGE',
        props: { reviewStatus: archive.reviewStatus },
      },
      {
        from: wikiNodeId,
        to: targetNodeId,
        kind: edgeKind,
        props: {
          reviewStatus: archive.reviewStatus,
          attachedAt: archive.attachmentTarget?.attachedAt || new Date().toISOString(),
          reviewedBy: archive.reviewedBy || 'Current worker',
        },
      },
    ],
  };
};

const relationshipReviewGraphForDecision = (ingestion, relationshipReviewRecord) => {
  if (!ingestion || !relationshipReviewRecord) return null;
  const wikiPageId = ingestion.wikiPage?.id || ingestion.generatedRecords?.frontendRecord?.pageId || `ingest:${ingestion.fileId}`;
  const wikiNodeId = `wiki:${wikiPageId}`;
  const fileNodeId = `file:${ingestion.fileId}`;
  const decisionNodeId = `relationship-review:${crypto
    .createHash('sha256')
    .update(relationshipReviewRecord.relationshipKey)
    .digest('hex')
    .slice(0, 18)}`;
  const fromNodeId = relationshipReviewRecord.fromNodeId || stableGraphNodeIdForLabel(relationshipReviewRecord.from);
  const toNodeId = relationshipReviewRecord.toNodeId || stableGraphNodeIdForLabel(relationshipReviewRecord.to);
  const reviewedAt = relationshipReviewRecord.reviewedAt || new Date().toISOString();
  const edgeKind = relationshipReviewRecord.status === 'approved' ? 'APPROVED_RELATIONSHIP' : 'REJECTED_RELATIONSHIP';
  const reviewProps = {
    relationshipKey: relationshipReviewRecord.relationshipKey,
    reviewStatus: relationshipReviewRecord.status,
    relationshipKind: relationshipReviewRecord.kind,
    relationshipLabel: relationshipReviewRecord.label,
    sourceId: ingestion.fileId,
    reviewedAt,
    reviewedBy: relationshipReviewRecord.reviewedBy || 'Current worker',
    lifeDomain: relationshipReviewRecord.lifeDomain || '',
  };

  return {
    nodes: [
      {
        id: fileNodeId,
        kind: 'SourceFile',
        props: {
          name: ingestion.originalName,
          sourceScope: ingestion.sourceScope || ingestion.privacy?.sourceScope || 'standalone',
        },
      },
      {
        id: wikiNodeId,
        kind: 'WikiPage',
        props: {
          title: ingestion.wikiPage?.title || ingestion.generatedRecords?.frontendRecord?.title || ingestion.originalName,
          sourceId: ingestion.fileId,
        },
      },
      {
        id: decisionNodeId,
        kind: 'RelationshipReviewDecision',
        props: {
          ...reviewProps,
          name: relationshipReviewRecord.status === 'approved' ? 'Approved relationship' : 'Rejected relationship',
          fromLabel: relationshipReviewRecord.from,
          toLabel: relationshipReviewRecord.to,
        },
      },
      {
        id: fromNodeId,
        kind: 'ReviewedRelationshipEndpoint',
        props: {
          name: relationshipReviewRecord.from,
          source: 'Case Wiki relationship review',
        },
      },
      {
        id: toNodeId,
        kind: 'ReviewedRelationshipEndpoint',
        props: {
          name: relationshipReviewRecord.to,
          source: 'Case Wiki relationship review',
        },
      },
    ],
    edges: [
      {
        from: fileNodeId,
        to: wikiNodeId,
        kind: 'GENERATED_WIKI_PAGE',
        props: { sourceId: ingestion.fileId },
      },
      {
        from: wikiNodeId,
        to: decisionNodeId,
        kind: 'HAS_RELATIONSHIP_REVIEW',
        props: reviewProps,
      },
      {
        from: decisionNodeId,
        to: fromNodeId,
        kind: 'REVIEWS_RELATIONSHIP_FROM',
        props: reviewProps,
      },
      {
        from: decisionNodeId,
        to: toNodeId,
        kind: 'REVIEWS_RELATIONSHIP_TO',
        props: reviewProps,
      },
      {
        from: fromNodeId,
        to: toNodeId,
        kind: edgeKind,
        props: reviewProps,
      },
    ],
  };
};

const mergeCaseWikiGraphs = (graphs = []) => {
  const nodes = new Map();
  const edges = new Map();
  graphs.filter(Boolean).forEach((graph) => {
    (graph.nodes || []).forEach((node) => {
      if (node?.id) nodes.set(node.id, node);
    });
    (graph.edges || []).forEach((edge) => {
      if (edge?.from && edge?.to && edge?.kind) edges.set(`${edge.from}|${edge.kind}|${edge.to}`, edge);
    });
  });
  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
  };
};

const normalizeJob = (job) => {
  const normalized = typeof job?.toObject === 'function' ? job.toObject() : { ...(job || {}) };
  return {
    ...normalized,
    items: Array.isArray(normalized.items) ? normalized.items : [],
    ingestions: Array.isArray(normalized.ingestions) ? normalized.ingestions : [],
    wikiIngestionRecords: Array.isArray(normalized.wikiIngestionRecords) ? normalized.wikiIngestionRecords : [],
    generatedRecords: {
      noteRecords: Array.isArray(normalized.generatedRecords?.noteRecords) ? normalized.generatedRecords.noteRecords : [],
      documentRecords: Array.isArray(normalized.generatedRecords?.documentRecords) ? normalized.generatedRecords.documentRecords : [],
      timelineRecords: Array.isArray(normalized.generatedRecords?.timelineRecords) ? normalized.generatedRecords.timelineRecords : [],
    },
    graphPreviews: Array.isArray(normalized.graphPreviews) ? normalized.graphPreviews : [],
    neo4j: Array.isArray(normalized.neo4j) ? normalized.neo4j : [],
  };
};

const serializeJobUpdate = (job) => ({
  status: job.status,
  context: job.context || {},
  items: job.items || [],
  ingestions: job.ingestions || [],
  wikiIngestionRecords: job.wikiIngestionRecords || [],
  generatedRecords: job.generatedRecords || {
    noteRecords: [],
    documentRecords: [],
    timelineRecords: [],
  },
  graphPreviews: job.graphPreviews || [],
  neo4j: job.neo4j || [],
  startedAt: job.startedAt || null,
  completedAt: job.completedAt || null,
  lastError: job.lastError || '',
});

const persistWikiIngestJob = async (job) =>
  normalizeJob(
    await updateCaseManagementWikiIngestJob(job.user, job.jobId, {
      $set: serializeJobUpdate(job),
    }),
  );

const fileFromJobItem = (item) => ({
  path: item.path,
  filename: item.storedName,
  originalname: item.fileName,
  mimetype: item.mimeType || 'application/octet-stream',
  size: item.size || 0,
});

const createLocalArchiveIngestJob = async ({ userId, files = [], context = {}, campaign = {} }) => {
  const requestedFiles = Array.isArray(files) ? files.slice(0, WIKI_INGEST_FILE_LIMIT) : [];
  if (!requestedFiles.length) {
    const error = new Error('Choose at least one local archive file to ingest');
    error.status = 400;
    throw error;
  }
  assertLocalArchiveDirectIngestAllowed(selectedLocalArchiveFilesFromRequest(requestedFiles));

  const localFiles = await Promise.all(
    requestedFiles.map((file) =>
      resolveLocalArchiveFile({
        rootId: typeof file?.rootId === 'string' ? file.rootId : '',
        relativePath: typeof file?.relativePath === 'string' ? file.relativePath : '',
      }),
    ),
  );

  const now = new Date().toISOString();
  const normalizedContext = parseWikiIngestContextObject(context || {});
  const job = {
    jobId: crypto.randomUUID(),
    context: {
      ...normalizedContext,
      campaignId: campaign.id || normalizedContext.campaignId || '',
      campaignName: campaign.name || normalizedContext.campaignName || 'Whole-life wiki import',
      sourceScope: 'standalone',
      privacyLevel: normalizedContext.privacyLevel || 'personal',
      redactionMode: normalizedContext.redactionMode || 'strict',
      retentionPolicy: normalizedContext.retentionPolicy || 'review-source',
      localArchiveIngest: true,
      campaignRunner: Boolean(campaign.runner),
    },
    status: 'queued',
    completedAt: null,
    ingestions: [],
    wikiIngestionRecords: [],
    generatedRecords: {
      noteRecords: [],
      documentRecords: [],
      timelineRecords: [],
    },
    graphPreviews: [],
    neo4j: [],
    items: localFiles.map((file) => ({
      itemId: crypto.randomUUID(),
      fileName: file.fileName,
      storedName: file.relativePath,
      path: file.path,
      size: file.size || 0,
      mimeType: file.mimeType || 'application/octet-stream',
      status: 'queued',
      error: '',
      pageId: '',
      fileId: '',
      neo4jStatus: '',
      queuedAt: now,
      localArchive: {
        rootId: file.rootId,
        rootLabel: file.rootLabel,
        relativePath: file.relativePath,
        modifiedAt: file.modifiedAt,
      },
    })),
  };

  const savedJob = normalizeJob(await createCaseManagementWikiIngestJob(userId, job));
  setImmediate(() => processWikiIngestJob(savedJob));
  return savedJob;
};

const makeJobSnapshot = (jobInput, { includeArtifacts = true } = {}) => {
  const job = normalizeJob(jobInput);
  return {
    jobId: job.jobId,
    status: job.status,
    context: job.context || {},
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt || null,
    total: job.items.length,
    processed: job.items.filter((item) => item.status === 'completed').length,
    failed: job.items.filter((item) => item.status === 'failed').length,
    items: job.items.map(({ path: _path, ...item }) => ({
      ...item,
      size: item.size || 0,
      mimeType: item.mimeType || 'application/octet-stream',
    })),
    wikiIngestionRecords: includeArtifacts ? job.wikiIngestionRecords : [],
    generatedRecords: includeArtifacts
      ? job.generatedRecords
      : {
          noteRecords: [],
          documentRecords: [],
          timelineRecords: [],
        },
    neo4j: includeArtifacts ? job.neo4j : job.neo4j.slice(-5),
    graphPreviews: includeArtifacts ? job.graphPreviews : [],
  };
};

const evaluateLocalArchiveCampaignAutomation = async ({
  userId,
  workspace = {},
  automationInput = {},
  currentCampaign = null,
  checkpoints = [],
  laneTemplates = localArchiveCampaignLaneTemplates,
  activeJob = null,
  selectedFiles = [],
  context = {},
  execute = false,
  force = false,
  source = 'page',
} = {}) => {
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const automation = normalizeLocalArchiveCampaignAutomation(automationInput || {}, nowDate);
  const {
    confirmed: selectedSourcesConfirmed,
    selectedSourceSignature,
  } = localArchiveSelectedSourcesConfirmed(automation, selectedFiles);
  const directIngestBlockers = getLocalArchiveDirectIngestBlockers(selectedFiles);
  const schedule = buildLocalArchiveCampaignSchedule({
    currentCampaign,
    checkpoints: Array.isArray(checkpoints) ? checkpoints : [],
    laneTemplates: Array.isArray(laneTemplates) && laneTemplates.length ? laneTemplates : localArchiveCampaignLaneTemplates,
    activeJob: activeJob || null,
  });
  const nextLane =
    schedule.lanes.find((lane) => lane.id === schedule.nextLaneId) ||
    [...schedule.lanes].sort((left, right) => right.priorityScore - left.priorityScore)[0] ||
    null;
  const dueAt = automation.nextRunAt ? Date.parse(automation.nextRunAt) : NaN;
  const isDue =
    automation.status === 'active' &&
    (force ||
      automation.cadence === 'manual' ||
      !automation.nextRunAt ||
      (Number.isFinite(dueAt) && dueAt <= nowDate.getTime()));
  let job = null;
  let actionExecution = {
    type: automation.status === 'active' ? 'not-due' : 'paused',
    status: automation.status,
    message:
      automation.status === 'active'
        ? `Next whole-life import automation check is scheduled for ${automation.nextRunAt || 'manual run'}.`
        : 'Whole-life import automation is paused.',
  };

  if (isDue && nextLane) {
    actionExecution = {
      type: 'due-plan',
      status: 'ready',
      laneId: nextLane.id,
      laneName: nextLane.name,
      action: nextLane.nextAction,
      message: `Due now: ${nextLane.name} should ${nextLane.nextAction.toLowerCase()}.`,
    };

    if (['queued', 'processing'].includes(nextLane.activeJobStatus || '')) {
      actionExecution = {
        type: 'job-monitor',
        status: nextLane.activeJobStatus,
        laneId: nextLane.id,
        laneName: nextLane.name,
        action: nextLane.nextAction,
        message: `${nextLane.name} already has a ${nextLane.activeJobStatus} ingest job. Monitoring instead of starting a duplicate.`,
      };
    } else if (nextLane.nextAction === 'Start background ingest for selected sources') {
      if (automation.runMode !== 'start-selected-ingest') {
        actionExecution = {
          type: 'plan-only',
          status: 'ready',
          laneId: nextLane.id,
          laneName: nextLane.name,
          action: nextLane.nextAction,
          selectedCount: selectedFiles.length,
          message: 'Automation is due in plan-only mode. The server saved the plan but did not start ingest.',
        };
      } else if (!automation.allowIngest) {
        actionExecution = {
          type: 'approval-required',
          status: 'blocked',
          laneId: nextLane.id,
          laneName: nextLane.name,
          action: nextLane.nextAction,
          message: 'Automation is due, but server-started ingest is disabled. Review the selected sources, then enable guarded ingest if you want this lane to run automatically.',
        };
      } else if (!selectedFiles.length) {
        actionExecution = {
          type: 'selection-required',
          status: 'blocked',
          laneId: nextLane.id,
          laneName: nextLane.name,
          action: nextLane.nextAction,
          message: 'Automation is due, but no selected source files were available to the server runner.',
        };
      } else if (directIngestBlockers.length) {
        actionExecution = {
          type: 'review-required',
          status: 'blocked',
          laneId: nextLane.id,
          laneName: nextLane.name,
          action: nextLane.nextAction,
          selectedCount: selectedFiles.length,
          blockedCount: directIngestBlockers.length,
          blockers: directIngestBlockers.slice(0, 12).map((item) => ({
            fileName: item.file.fileName || '',
            relativePath: item.file.relativePath || '',
            reason: item.reason,
          })),
          message: `Automation is due, but ${directIngestBlockers.length} selected source${directIngestBlockers.length === 1 ? '' : 's'} need review before extraction: ${summarizeLocalArchiveDirectIngestBlockers(directIngestBlockers)}.`,
        };
      } else if (!selectedSourcesConfirmed) {
        actionExecution = {
          type: 'confirmation-required',
          status: 'blocked',
          laneId: nextLane.id,
          laneName: nextLane.name,
          action: nextLane.nextAction,
          selectedCount: selectedFiles.length,
          message: 'Automation is due, but review-before-run is enabled. Confirm the current saved selected-source batch before the daemon can start local file ingest.',
        };
      } else if (execute) {
        const savedJob = await createLocalArchiveIngestJob({
          userId,
          files: selectedFiles,
          context: {
            ...(context || {}),
            sourceScope: 'standalone',
            privacyLevel: context?.privacyLevel || 'personal',
            redactionMode: context?.redactionMode || 'strict',
            retentionPolicy: context?.retentionPolicy || 'review-source',
          },
          campaign: {
            ...(currentCampaign || {}),
            runner: true,
          },
        });
        job = makeJobSnapshot(savedJob);
        actionExecution = {
          type: 'job-started',
          status: 'queued',
          laneId: nextLane.id,
          laneName: nextLane.name,
          action: nextLane.nextAction,
          jobId: job.jobId,
          message: `Cadence runner started ingest job ${job.jobId.slice(0, 8)} for ${selectedFiles.length} selected source${selectedFiles.length === 1 ? '' : 's'}.`,
        };
      } else {
        actionExecution = {
          type: 'job-ready',
          status: 'ready',
          laneId: nextLane.id,
          laneName: nextLane.name,
          action: nextLane.nextAction,
          selectedCount: selectedFiles.length,
          message: `${selectedFiles.length} selected source${selectedFiles.length === 1 ? '' : 's'} are ready. Run due automation to start the server job.`,
        };
      }
    }
  } else if (isDue && !nextLane) {
    actionExecution = {
      type: 'no-ready-lane',
      status: 'blocked',
      message: 'Automation is due, but no campaign lane exists yet. Create or scan a lane first.',
    };
  }

  const nextAutomation = {
    ...automation,
    lastCheckedAt: now,
    lastRunAt: isDue ? now : automation.lastRunAt,
    nextRunAt: automation.status === 'active'
      ? nextLocalArchiveCampaignAutomationRunAt(automation.cadence, nowDate) || automation.nextRunAt
      : automation.nextRunAt,
    runCount: automation.runCount + (isDue ? 1 : 0),
    lastAction: actionExecution,
  };
  const automationActor =
    source === 'server-tick'
      ? 'Case Wiki server automation tick'
      : source === 'daemon'
        ? 'Case Wiki closed-browser daemon'
        : 'Case Wiki campaign automation';
  const auditRecord = normalizeCaseWikiAuditRecord({
    id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    actor: automationActor,
    action:
      actionExecution.type === 'job-started'
        ? 'started due whole-life import automation job'
        : isDue
          ? 'evaluated due whole-life import automation'
          : 'checked whole-life import automation cadence',
    object: actionExecution.message,
    timestamp: now,
    category: 'case-wiki-local-archive',
    kind: 'campaign-automation',
    status: actionExecution.status,
    detail: `${nextAutomation.cadence} cadence · ${nextAutomation.runMode} · ${source} · Weaviate writes remain review-gated.`,
  });
  const daemonRunRecord =
    source === 'daemon'
      ? {
          id: `case-wiki-daemon-run-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
          checkedAt: now,
          status: actionExecution.status,
          type: actionExecution.type,
          message: actionExecution.message,
          laneId: actionExecution.laneId || '',
          laneName: actionExecution.laneName || '',
          action: actionExecution.action || '',
          cadence: nextAutomation.cadence,
          runMode: nextAutomation.runMode,
          execute,
          force,
          allowIngest: nextAutomation.allowIngest,
          requireReviewBeforeRun: nextAutomation.requireReviewBeforeRun,
          selectedSourceSignature,
          selectedSourcesConfirmed,
          selectedFileCount: selectedFiles.length,
          jobId: actionExecution.jobId || '',
          nextRunAt: nextAutomation.nextRunAt || '',
          startedIngest: actionExecution.type === 'job-started',
          vectorGate: 'Weaviate writes remain review-gated.',
        }
      : null;
  const nextWorkspace = {
    ...workspace,
    localArchiveCampaignAutomation: nextAutomation,
    localArchiveCampaignSchedule: schedule,
    ...(daemonRunRecord
      ? {
          localArchiveCampaignDaemonRuns: [
            daemonRunRecord,
            ...(Array.isArray(workspace.localArchiveCampaignDaemonRuns)
              ? workspace.localArchiveCampaignDaemonRuns
              : []),
          ].slice(0, 100),
        }
      : {}),
    auditRecords: [
      auditRecord,
      ...(Array.isArray(workspace.auditRecords) ? workspace.auditRecords : []),
    ].slice(0, 500),
  };
  await saveCaseManagementWorkspace(userId, nextWorkspace);

  return {
    statusCode: actionExecution.type === 'job-started' ? 202 : 200,
    automation: nextAutomation,
    schedule,
    actionExecution,
    job,
    auditRecord,
    daemonRunRecord,
    selectedFileCount: selectedFiles.length,
    workspaceSaved: true,
  };
};

const userIdFromWorkspaceRecord = (record = {}) => {
  const user = record.user || record.userId;
  if (typeof user === 'string') return user;
  if (user && typeof user === 'object') return asString(user._id || user.id);
  return '';
};

const runLocalArchiveCampaignDaemonPass = async ({
  records = null,
  execute = CASE_WIKI_LOCAL_ARCHIVE_DAEMON_EXECUTE,
  force = false,
  limit = CASE_WIKI_LOCAL_ARCHIVE_DAEMON_BATCH_LIMIT,
} = {}) => {
  const startedAt = new Date().toISOString();
  const safeLimit = Math.min(Math.max(Number(limit) || CASE_WIKI_LOCAL_ARCHIVE_DAEMON_BATCH_LIMIT, 1), 100);
  const workspaceRecords = Array.isArray(records)
    ? records.slice(0, safeLimit)
    : await getCaseManagementWorkspacesWithActiveLocalArchiveAutomation({ limit: safeLimit });
  const results = [];

  for (const record of workspaceRecords) {
    const userId = userIdFromWorkspaceRecord(record);
    const workspace = record?.workspace && typeof record.workspace === 'object' ? record.workspace : {};
    if (!userId) {
      results.push({
        userId: '',
        statusCode: 500,
        actionExecution: {
          type: 'daemon-error',
          status: 'failed',
          message: 'Saved workspace record is missing a user id.',
        },
        selectedFileCount: 0,
        jobId: '',
        workspaceSaved: false,
      });
      continue;
    }

    try {
      const activeJobId = asString(workspace.localArchiveCampaign?.activeJobId);
      const activeJob = activeJobId
        ? await getCaseManagementWikiIngestJob(userId, activeJobId)
        : null;
      const selectedFiles = selectedLocalArchiveFilesFromWorkspace(workspace);
      const result = await evaluateLocalArchiveCampaignAutomation({
        userId,
        workspace,
        automationInput: workspace.localArchiveCampaignAutomation || {},
        currentCampaign: workspace.localArchiveCampaign || null,
        checkpoints: Array.isArray(workspace.localArchiveCampaigns) ? workspace.localArchiveCampaigns : [],
        laneTemplates: localArchiveCampaignLaneTemplates,
        activeJob: activeJob ? makeJobSnapshot(activeJob, { includeArtifacts: false }) : null,
        selectedFiles,
        context: {
          sourceScope: 'standalone',
          privacyLevel: 'personal',
          redactionMode: 'strict',
          retentionPolicy: 'review-source',
          serverDaemon: true,
        },
        execute,
        force,
        source: 'daemon',
      });

      results.push({
        userId,
        statusCode: result.statusCode,
        actionExecution: result.actionExecution,
        selectedFileCount: result.selectedFileCount,
        jobId: result.job?.jobId || '',
        daemonRunRecord: result.daemonRunRecord || null,
        workspaceSaved: result.workspaceSaved,
      });
    } catch (error) {
      logger.warn('[caseManagement] Local archive campaign daemon item failed', {
        userId,
        error,
      });
      results.push({
        userId,
        statusCode: error.status || 500,
        actionExecution: {
          type: 'daemon-error',
          status: 'failed',
          message: error.message || 'Closed-browser daemon pass failed for this workspace.',
        },
        selectedFileCount: 0,
        jobId: '',
        workspaceSaved: false,
      });
    }
  }

  const countWhere = (predicate) => results.filter(predicate).length;
  const daemonEnvironment = buildLocalArchiveCampaignDaemonEnvironment();
  return {
    runId: `case-wiki-daemon-run-${crypto.randomUUID()}`,
    mode: 'closed-browser-daemon-pass',
    source: 'server-saved-workspace',
    daemonEnvironment,
    startedAt,
    completedAt: new Date().toISOString(),
    execute,
    force,
    batchLimit: safeLimit,
    scannedWorkspaceCount: workspaceRecords.length,
    checkedCount: results.length,
    startedJobCount: countWhere((result) => result.actionExecution?.type === 'job-started'),
    readyCount: countWhere((result) => result.actionExecution?.status === 'ready'),
    blockedCount: countWhere((result) => result.actionExecution?.status === 'blocked'),
    notDueCount: countWhere((result) => result.actionExecution?.type === 'not-due'),
    pausedCount: countWhere((result) => result.actionExecution?.type === 'paused'),
    failedCount: countWhere((result) => result.actionExecution?.status === 'failed'),
    selectedFileCount: results.reduce((sum, result) => sum + (Number(result.selectedFileCount) || 0), 0),
    policy:
      'The daemon pass evaluates saved whole-life campaign state from the server. It only starts local ingest when daemon execution is enabled and guarded ingest is approved; Weaviate writes remain review-gated.',
    results,
  };
};

const maybeResumeWikiIngestJob = (job) => {
  if (job && ['queued', 'processing'].includes(job.status) && !activeWikiIngestJobIds.has(job.jobId)) {
    setImmediate(() => processWikiIngestJob(job));
  }
};

const resumePendingWikiIngestJobs = async () => {
  try {
    const jobs = await getPendingCaseManagementWikiIngestJobs();
    jobs.forEach((job) => maybeResumeWikiIngestJob(job));
  } catch (error) {
    logger.warn('[caseManagement] Could not resume pending Case Wiki ingest jobs', error);
  }
};

const schedulePendingWikiIngestJobResume = () => {
  if (pendingJobsResumeScheduled) return;
  pendingJobsResumeScheduled = true;
  const resumeTimer = setTimeout(() => {
    resumePendingWikiIngestJobs().catch((error) => {
      logger.warn('[caseManagement] Pending Case Wiki ingest resume failed', error);
    });
  }, 5000);
  if (typeof resumeTimer.unref === 'function') {
    resumeTimer.unref();
  }
};

const scheduleLocalArchiveCampaignDaemon = () => {
  if (!CASE_WIKI_LOCAL_ARCHIVE_DAEMON_ENABLED || localArchiveCampaignDaemonScheduled) return;
  localArchiveCampaignDaemonScheduled = true;
  const runDaemon = async () => {
    if (localArchiveCampaignDaemonRunning) return;
    localArchiveCampaignDaemonRunning = true;
    try {
      await runLocalArchiveCampaignDaemonPass({
        execute: CASE_WIKI_LOCAL_ARCHIVE_DAEMON_EXECUTE,
        force: false,
        limit: CASE_WIKI_LOCAL_ARCHIVE_DAEMON_BATCH_LIMIT,
      });
    } catch (error) {
      logger.warn('[caseManagement] Local archive campaign daemon pass failed', error);
    } finally {
      localArchiveCampaignDaemonRunning = false;
    }
  };
  const interval = setInterval(runDaemon, CASE_WIKI_LOCAL_ARCHIVE_DAEMON_INTERVAL_MS);
  if (typeof interval.unref === 'function') {
    interval.unref();
  }
  const firstRun = setTimeout(runDaemon, Math.min(10 * 1000, CASE_WIKI_LOCAL_ARCHIVE_DAEMON_INTERVAL_MS));
  if (typeof firstRun.unref === 'function') {
    firstRun.unref();
  }
};

const processWikiIngestJob = async (jobInput) => {
  let job = normalizeJob(jobInput);
  if (!job?.jobId || activeWikiIngestJobIds.has(job.jobId)) return;
  activeWikiIngestJobIds.add(job.jobId);

  try {
    job = normalizeJob((await getCaseManagementWikiIngestJob(job.user, job.jobId)) || job);
    if (job.status === 'paused' || terminalJobStatuses.has(job.status)) return;

    job.status = 'processing';
    job.startedAt = job.startedAt || new Date();
    job.items = job.items.map((item) =>
      item.status === 'processing'
        ? {
            ...item,
            status: 'queued',
            resumedAt: new Date().toISOString(),
          }
        : item,
    );
    job = await persistWikiIngestJob(job);

    while (job.status !== 'paused') {
      const latestJob = await getCaseManagementWikiIngestJob(job.user, job.jobId);
      if (!latestJob) break;
      job = normalizeJob(latestJob);
      if (job.status === 'paused' || terminalJobStatuses.has(job.status)) break;

      const itemIndex = job.items.findIndex((candidate) => candidate.status === 'queued');
      if (itemIndex === -1) break;

      job.items[itemIndex].status = 'processing';
      job.items[itemIndex].startedAt = new Date().toISOString();
      job.status = 'processing';
      job = await persistWikiIngestJob(job);
      const item = job.items[itemIndex];

      try {
        if (!item.path || !fs.existsSync(item.path)) {
          throw new Error('Stored upload file is missing. Upload the source again or retry with a fresh file.');
        }

        const built = await buildCaseWikiUpload({
          file: fileFromJobItem(item),
          userId: job.userId || job.user,
          context: job.context,
        });
        const saved = await saveCaseManagementWikiIngestion(job.userId || job.user, built);

        job.items[itemIndex] = {
          ...item,
          status: 'completed',
          completedAt: new Date().toISOString(),
          fileId: built.fileId,
          pageId: built.generatedRecords?.frontendRecord?.pageId || built.wikiPage?.id,
          neo4jStatus: built.neo4j?.status || 'unknown',
        };
        job.ingestions.push(saved);
        job.wikiIngestionRecords.push(built.generatedRecords.frontendRecord);
        job.generatedRecords.noteRecords.push(built.generatedRecords.note);
        job.generatedRecords.documentRecords.push(built.generatedRecords.document);
        job.generatedRecords.timelineRecords.push(built.generatedRecords.timeline);
        job.neo4j.push(built.neo4j);
        job.graphPreviews.push(makeGraphPreviewRecord(built));
      } catch (error) {
        job.items[itemIndex] = {
          ...item,
          status: 'failed',
          error: error.message,
          completedAt: new Date().toISOString(),
        };
        job.lastError = error.message;
        logger.error('[caseManagement] Failed to process wiki ingest job item', {
          jobId: job.jobId,
          fileName: item.fileName,
          error,
        });
      }
      job = await persistWikiIngestJob(job);
    }

    if (job.status !== 'paused') {
      const failed = job.items.some((item) => item.status === 'failed');
      const queued = job.items.some((item) => item.status === 'queued' || item.status === 'processing');
      job.status = queued ? 'queued' : failed ? 'completed_with_errors' : 'completed';
      if (!queued) {
        job.completedAt = new Date();
      }
      await persistWikiIngestJob(job);
    }
  } finally {
    activeWikiIngestJobIds.delete(job.jobId);
    if (job.status === 'queued') {
      setImmediate(() => processWikiIngestJob(job));
    }
  }
};

schedulePendingWikiIngestJobResume();
scheduleLocalArchiveCampaignDaemon();

router.get('/workspace', async (req, res) => {
  try {
    const record = await getCaseManagementWorkspace(req.user.id);
    if (!record) {
      return res.status(200).json({
        version: 1,
        savedAt: null,
        workspace: null,
      });
    }
    return res.status(200).json({
      version: record.version,
      savedAt: record.savedAt,
      workspace: record.workspace,
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to load workspace', error);
    return res.status(500).json({ error: 'Failed to load case management workspace' });
  }
});

router.put('/workspace', async (req, res) => {
  try {
    const workspace = req.body?.workspace;
    if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)) {
      return res.status(400).json({ error: 'workspace must be an object' });
    }
    const record = await saveCaseManagementWorkspace(req.user.id, workspace);
    return res.status(200).json({
      version: record.version,
      savedAt: record.savedAt,
      workspace: record.workspace,
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to save workspace', error);
    return res.status(500).json({ error: 'Failed to save case management workspace' });
  }
});

router.post('/wiki/inspection-follow-up-tasks', async (req, res) => {
  try {
    const requestedTasks = Array.isArray(req.body?.tasks) ? req.body.tasks.slice(0, 50) : [];
    const tasks = requestedTasks.map(normalizeCaseWikiFollowUpTask).filter(Boolean);
    if (!tasks.length) {
      return res.status(400).json({ error: 'Choose at least one valid Case Wiki follow-up task' });
    }

    const timelineRecords = (Array.isArray(req.body?.timelineRecords) ? req.body.timelineRecords : [])
      .map(normalizeCaseWikiTimelineRecord)
      .filter(Boolean);
    const auditRecords = (Array.isArray(req.body?.auditRecords) ? req.body.auditRecords : [])
      .map(normalizeCaseWikiAuditRecord)
      .filter(Boolean);
    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const existingTasks = Array.isArray(workspace.taskRecords) ? workspace.taskRecords : [];
    const existingTaskKeys = new Set(
      existingTasks.flatMap((task) => [task?.id, task?.dependency].filter(Boolean)),
    );
    const createdTasks = tasks.filter(
      (task) => !existingTaskKeys.has(task.id) && !existingTaskKeys.has(task.dependency),
    );

    const nextWorkspace = {
      ...workspace,
      savedAt: new Date().toISOString(),
      taskRecords: [...createdTasks, ...existingTasks],
      timelineRecords: mergeWorkspaceRecordsById(workspace.timelineRecords, timelineRecords),
      auditRecords: mergeWorkspaceRecordsById(workspace.auditRecords, auditRecords),
    };

    const record = await saveCaseManagementWorkspace(req.user.id, nextWorkspace);
    return res.status(200).json({
      version: record.version,
      savedAt: record.savedAt,
      createdCount: createdTasks.length,
      skippedCount: tasks.length - createdTasks.length,
      taskRecords: record.workspace.taskRecords ?? [],
      timelineRecords: record.workspace.timelineRecords ?? [],
      auditRecords: record.workspace.auditRecords ?? [],
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to persist Case Wiki follow-up tasks', error);
    return res.status(500).json({ error: 'Failed to persist Case Wiki follow-up tasks' });
  }
});

router.patch('/wiki/inspection-follow-up-tasks/:taskId', async (req, res) => {
  try {
    const taskId = readStringField(req.params, 'taskId');
    const nextStatus = taskStatuses.has(req.body?.status) ? req.body.status : '';
    if (!taskId || !nextStatus) {
      return res.status(400).json({ error: 'Choose a valid Case Wiki follow-up task status' });
    }

    const timelineRecord = normalizeCaseWikiTimelineRecord(req.body?.timelineRecord);
    const auditRecords = [
      normalizeCaseWikiAuditRecord(req.body?.auditRecord),
      ...(Array.isArray(req.body?.auditRecords)
        ? req.body.auditRecords.map(normalizeCaseWikiAuditRecord)
        : []),
    ].filter(Boolean);
    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const existingTasks = Array.isArray(workspace.taskRecords) ? workspace.taskRecords : [];
    const taskIndex = existingTasks.findIndex(
      (task) =>
        task?.id === taskId &&
        typeof task.dependency === 'string' &&
        task.dependency.startsWith(caseWikiFollowUpTaskDependencyPrefix),
    );
    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Case Wiki follow-up task not found' });
    }

    const completedAt =
      nextStatus === 'complete'
        ? asString(req.body?.completedAt, new Date().toISOString())
        : asString(req.body?.completedAt);
    const nextTasks = [...existingTasks];
    nextTasks[taskIndex] = {
      ...nextTasks[taskIndex],
      status: nextStatus,
      completedAt: completedAt || nextTasks[taskIndex].completedAt,
    };
    if (nextStatus !== 'complete' && !completedAt) {
      delete nextTasks[taskIndex].completedAt;
    }

    const nextWorkspace = {
      ...workspace,
      savedAt: new Date().toISOString(),
      taskRecords: nextTasks,
      timelineRecords: timelineRecord
        ? mergeWorkspaceRecordsById(workspace.timelineRecords, [timelineRecord])
        : workspace.timelineRecords ?? [],
      auditRecords: auditRecords.length
        ? mergeWorkspaceRecordsById(workspace.auditRecords, auditRecords)
        : workspace.auditRecords ?? [],
    };

    const record = await saveCaseManagementWorkspace(req.user.id, nextWorkspace);
    return res.status(200).json({
      version: record.version,
      savedAt: record.savedAt,
      taskRecord: nextTasks[taskIndex],
      taskRecords: record.workspace.taskRecords ?? [],
      timelineRecords: record.workspace.timelineRecords ?? [],
      auditRecords: record.workspace.auditRecords ?? [],
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to update Case Wiki follow-up task', error);
    return res.status(500).json({ error: 'Failed to update Case Wiki follow-up task' });
  }
});

router.get('/wiki/inspection-follow-up-reconciliations', async (req, res) => {
  try {
    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const history = makeCaseWikiFollowUpReconciliationHistory(workspace, {
      actor: readStringField(req.query, 'actor') || 'all',
      status: readStringField(req.query, 'status') || 'all',
      decision: readStringField(req.query, 'decision') || 'all',
      limit: Number(req.query.limit) || 50,
    });
    return res.status(200).json({
      reconciliationHistory: history.records,
      historyCount: history.historyCount,
      totalCount: history.totalCount,
      stats: history.stats,
      filters: history.filters,
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to load Case Wiki follow-up reconciliation history', error);
    return res.status(500).json({ error: 'Failed to load Case Wiki follow-up reconciliation history' });
  }
});

router.post('/wiki/inspection-follow-up-reconciliations/:auditId/graph-review', async (req, res) => {
  try {
    const auditId = readStringField(req.params, 'auditId');
    const reviewer = readStringField(req.body, 'reviewer') || readStringField(req.body, 'actor') || 'Case Wiki manager';
    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const auditRecord = (Array.isArray(workspace.auditRecords) ? workspace.auditRecords : []).find(
      (record) => record?.id === auditId && isCaseWikiFollowUpReconciliationAuditRecord(record),
    );
    if (!auditRecord) {
      return res.status(404).json({ error: 'Case Wiki follow-up reconciliation audit record not found' });
    }

    const builtReviewGraph = buildCaseWikiFollowUpTaskReconciliationReviewGraph({
      auditRecord,
      reviewer,
      userId: req.user.id,
    });
    if (!builtReviewGraph) {
      return res.status(400).json({ error: 'Choose a valid reconciliation audit record before syncing to Neo4j' });
    }

    const neo4j = await writeCaseWikiGraphToNeo4j(builtReviewGraph.graph);
    return res.status(200).json({
      followUpReconciliationReview: {
        ...builtReviewGraph.followUpReconciliationReview,
        graphSummary: {
          nodeCount: builtReviewGraph.graph.nodes.length,
          edgeCount: builtReviewGraph.graph.edges.length,
        },
        neo4jStatus: neo4j.status,
        neo4jMessage: neo4j.message || neo4j.skippedReason || '',
      },
      graph: builtReviewGraph.graph,
      neo4j,
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to sync Case Wiki follow-up reconciliation review', error);
    return res.status(500).json({ error: 'Failed to sync Case Wiki follow-up reconciliation review' });
  }
});

router.get('/wiki/ingestions', async (req, res) => {
  try {
    const ingestions = await getCaseManagementWikiIngestions(req.user.id);
    const noteRecords = ingestions.map((ingestion) => ingestion.generatedRecords?.note).filter(Boolean);
    const documentRecords = ingestions.map((ingestion) => ingestion.generatedRecords?.document).filter(Boolean);
    const timelineRecords = ingestions.map((ingestion) => ingestion.generatedRecords?.timeline).filter(Boolean);
    return res.status(200).json({
      ingestions,
      wikiIngestionRecords: ingestions
        .map(makeFrontendIngestionRecord)
        .filter(Boolean),
      generatedRecords: {
        noteRecords,
        documentRecords,
        timelineRecords,
      },
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to load wiki ingestions', error);
    return res.status(500).json({ error: 'Failed to load case management wiki ingestions' });
  }
});

router.get('/wiki/graph/search', async (req, res) => {
  try {
    const ingestions = await getCaseManagementWikiIngestions(req.user.id);
    const workspaceRecord = await getCaseManagementWorkspace(req.user.id);
    const promotionRecords = Array.isArray(workspaceRecord?.workspace?.wikiPromotionRecords)
      ? workspaceRecord.workspace.wikiPromotionRecords
      : [];
    const rawLimit = Number(req.query.limit);
    const graphSearch = searchCaseWikiGraph({
      ingestions,
      promotionRecords,
      query: req.query.q || req.query.query || '',
      lifeDomainId: req.query.lifeDomainId || 'all',
      limit: Number.isFinite(rawLimit) ? rawLimit : undefined,
    });
    return res.status(200).json({ graphSearch });
  } catch (error) {
    logger.error('[caseManagement] Failed to search Case Wiki graph', error);
    return res.status(500).json({ error: 'Failed to search Case Wiki graph' });
  }
});

router.get('/wiki/retrieval/search', async (req, res) => {
  try {
    const query = readStringField(req.query, 'q') || readStringField(req.query, 'query');
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(rawLimit, 40)) : 12;
    const lifeDomainId = readStringField(req.query, 'lifeDomainId') || 'all';
    const ingestions = await getCaseManagementWikiIngestions(req.user.id);
    const workspaceRecord = await getCaseManagementWorkspace(req.user.id);
    const promotionRecords = Array.isArray(workspaceRecord?.workspace?.wikiPromotionRecords)
      ? workspaceRecord.workspace.wikiPromotionRecords
      : [];
    const normalizedQuery = normalizeRetrievalQuery(query);

    if (!normalizedQuery || normalizedQuery.length < 2) {
      const graphSearch = searchCaseWikiGraph({ ingestions, promotionRecords, query: '', lifeDomainId, limit });
      const chunkSearch = buildCaseWikiReviewedChunkRetrieval({ ingestions, query: '', limit });
      const vectorSearch = {
        status: 'empty-query',
        provider: CASE_WIKI_VECTOR_PROVIDER,
        resultCount: 0,
        results: [],
        message: 'Enter at least two characters before searching Weaviate.',
      };
      const ranking = buildRetrievalRankingLedger({
        query: normalizedQuery,
        graphSearch,
        chunkSearch,
        vectorSearch,
        limit,
      });
      return res.status(200).json({
        retrieval: {
          status: 'empty-query',
          query: normalizedQuery,
          lifeDomainId,
          resultCount: 0,
          summary: {
            status: 'empty-query',
            layers: [],
            message: 'Enter at least two characters to search the Case Wiki retrieval layer.',
          },
          ranking,
          graphSearch,
          chunkSearch,
          vectorSearch,
          answerDraft: buildRetrievalAnswerDraft({
            query: normalizedQuery,
            graphSearch,
            chunkSearch,
            vectorSearch,
          }),
          generatedAt: new Date().toISOString(),
        },
      });
    }

    const graphSearch = searchCaseWikiGraph({ ingestions, promotionRecords, query: normalizedQuery, lifeDomainId, limit });
    const chunkSearch = buildCaseWikiReviewedChunkRetrieval({ ingestions, query: normalizedQuery, limit });
    const vectorSourceIds = indexedSourceIdsForRetrieval(ingestions);
    const vectorSearch = await queryCaseWikiWeaviateHybridSearch({
      query: normalizedQuery,
      limit,
      sourceDocumentIds: vectorSourceIds,
    });
    const ranking = buildRetrievalRankingLedger({
      query: normalizedQuery,
      graphSearch,
      chunkSearch,
      vectorSearch,
      limit,
    });
    const summary = buildRetrievalSummary({ graphSearch, chunkSearch, vectorSearch });
    const answerDraft = buildRetrievalAnswerDraft({
      query: normalizedQuery,
      graphSearch,
      chunkSearch,
      vectorSearch,
    });

    return res.status(200).json({
      retrieval: {
        status: summary.status,
        query: normalizedQuery,
        lifeDomainId,
        resultCount:
          (graphSearch.resultCount || 0) +
          (chunkSearch.resultCount || 0) +
          (vectorSearch.resultCount || 0),
        sourceCount: ingestions.length,
        indexedSourceCount: vectorSourceIds.length,
        summary,
        answerDraft,
        ranking,
        graphSearch,
        chunkSearch,
        vectorSearch,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to search Case Wiki retrieval layer', error);
    return res.status(500).json({ error: 'Failed to search Case Wiki retrieval layer' });
  }
});

router.post('/wiki/retrieval/model-drafts', async (req, res) => {
  try {
    if (req.body?.confirmModelDraft !== true) {
      return res.status(400).json({
        error: 'Confirm model draft preparation before saving the reviewed packet.',
        policy: 'Model draft preparation is explicit, citation-gated, and does not call an external model.',
      });
    }

    const modelDraftRecord = buildReviewedCitationModelDraftRecord({
      query: readStringField(req.body, 'query'),
      answerDraft: req.body?.answerDraft,
      modelSynthesisPacket: req.body?.modelSynthesisPacket,
      actor: readStringField(req.body, 'actor') || 'Current worker',
    });

    if (modelDraftRecord.error) {
      return res.status(409).json({
        error: modelDraftRecord.error,
        blockedReasons: modelDraftRecord.blockedReasons,
        citationCoverageDiff: modelDraftRecord.citationCoverageDiff,
        policy:
          'Only ready reviewed-citation model packets can be saved as model drafts. Candidate evidence and uncited sections stay blocked.',
      });
    }

    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const auditRecord = normalizeCaseWikiAuditRecord({
      id: `audit:${modelDraftRecord.id}:${Date.now()}`,
      timestamp: modelDraftRecord.updatedAt || modelDraftRecord.createdAt,
      actor: readStringField(req.body, 'actor') || modelDraftRecord.createdBy,
      action: 'prepared reviewed model draft packet',
      object: modelDraftRecord.title,
      source: 'Case Wiki',
      status: 'completed',
      detail: `${modelDraftRecord.sections.length} cited model draft section${modelDraftRecord.sections.length === 1 ? '' : 's'} prepared from ${modelDraftRecord.citationLedger.length} reviewed citation${modelDraftRecord.citationLedger.length === 1 ? '' : 's'}. External model calls, vector writes, promotions, file moves, and attachments stayed disabled.`,
    });

    const nextWorkspace = {
      ...workspace,
      savedAt: new Date().toISOString(),
      wikiModelDraftRecords: mergeWorkspaceRecordsById(workspace.wikiModelDraftRecords, [modelDraftRecord]),
      auditRecords: mergeWorkspaceRecordsById(workspace.auditRecords, [auditRecord]),
    };
    const record = await saveCaseManagementWorkspace(req.user.id, nextWorkspace);

    return res.status(200).json({
      modelDraftRecord:
        record.workspace.wikiModelDraftRecords?.find((item) => item.id === modelDraftRecord.id) || modelDraftRecord,
      generatedRecords: {
        auditRecords: [auditRecord],
      },
      policy:
        'This write saved a reviewed model-draft packet only. It did not call a model, transmit source text, promote a wiki page, attach documents to clients/cases, write vectors, move files, or delete anything.',
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to prepare reviewed model draft packet', error);
    return res.status(500).json({ error: 'Failed to prepare reviewed model draft packet' });
  }
});

router.get('/wiki/retrieval/model-drafts/:draftId/external-adapter/readiness', async (req, res) => {
  try {
    const requestedDraftId = readStringField(req.params, 'draftId');
    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const modelDraftRecords = Array.isArray(workspace.wikiModelDraftRecords) ? workspace.wikiModelDraftRecords : [];
    const storedModelDraftRecord = modelDraftRecords.find(
      (draft) => draft?.id === requestedDraftId || draft?.pageId === requestedDraftId,
    );

    if (!storedModelDraftRecord) {
      return res.status(404).json({
        error: 'Saved model draft packet not found.',
        policy: 'External adapter readiness only runs against model draft packets already saved in this workspace.',
      });
    }

    const readiness = buildModelDraftExternalAdapterReadinessPacket({
      modelDraftRecord: storedModelDraftRecord,
      modelDraftExecutionRecords: workspace.wikiModelDraftExecutionRecords,
      provider: readStringField(req.query, 'provider'),
      model: readStringField(req.query, 'model'),
    });

    if (readiness.error) {
      return res.status(409).json({
        error: readiness.error,
        blockedReasons: readiness.blockedReasons,
        policy:
          'External adapter readiness is a read-only check. It does not call a model or transmit source text.',
      });
    }

    return res.status(200).json({
      readiness,
      policy:
        'Read-only external adapter readiness preview. It did not call a model, transmit source text, write vectors, write Neo4j graph data, promote a wiki page, move files, or attach documents.',
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to build external model adapter readiness', error);
    return res.status(500).json({ error: 'Failed to build external model adapter readiness' });
  }
});

router.post('/wiki/retrieval/model-drafts/:draftId/external-adapter/consent-packets', async (req, res) => {
  try {
    if (req.body?.confirmConsentPacket !== true) {
      return res.status(400).json({
        error: 'Confirm consent packet preparation before saving the external adapter review record.',
        policy:
          'Consent packet preparation is explicit and still does not call a model or transmit source text.',
      });
    }

    const requestedDraftId = readStringField(req.params, 'draftId');
    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const modelDraftRecords = Array.isArray(workspace.wikiModelDraftRecords) ? workspace.wikiModelDraftRecords : [];
    const storedModelDraftRecord = modelDraftRecords.find(
      (draft) => draft?.id === requestedDraftId || draft?.pageId === requestedDraftId,
    );

    if (!storedModelDraftRecord) {
      return res.status(404).json({
        error: 'Saved model draft packet not found.',
        policy:
          'External adapter consent packets only run against model draft packets already saved in this workspace.',
      });
    }

    const externalConsentPacketRecord = buildModelDraftExternalAdapterConsentPacket({
      modelDraftRecord: storedModelDraftRecord,
      modelDraftExecutionRecords: workspace.wikiModelDraftExecutionRecords,
      provider: readStringField(req.body, 'provider') || 'not-selected',
      model: readStringField(req.body, 'model') || 'not-selected',
      actor: readStringField(req.body, 'actor') || 'Current worker',
    });

    if (externalConsentPacketRecord.error) {
      return res.status(409).json({
        error: externalConsentPacketRecord.error,
        blockedReasons: externalConsentPacketRecord.blockedReasons,
        readiness: externalConsentPacketRecord.readiness,
        policy:
          'External adapter consent packets are blocked until the saved local rehearsal passes. No model call or source transmission happened.',
      });
    }

    const updatedModelDraftRecord = {
      ...storedModelDraftRecord,
      lastExternalConsentPacketId: externalConsentPacketRecord.id,
      lastExternalConsentPacketStatus: externalConsentPacketRecord.status,
      lastExternalConsentPacketAt: externalConsentPacketRecord.createdAt,
      externalConsentPacketCount: (Number(storedModelDraftRecord.externalConsentPacketCount) || 0) + 1,
      updatedAt: externalConsentPacketRecord.updatedAt,
    };
    const auditRecord = normalizeCaseWikiAuditRecord({
      id: `audit:${externalConsentPacketRecord.id}:${Date.now()}`,
      timestamp: externalConsentPacketRecord.updatedAt,
      actor: readStringField(req.body, 'actor') || externalConsentPacketRecord.createdBy,
      action: 'prepared external adapter consent packet',
      object: storedModelDraftRecord.title || externalConsentPacketRecord.title,
      source: 'Case Wiki',
      status: 'pending-consent',
      detail: `${externalConsentPacketRecord.transmissionPreview.reviewedCitationCount} reviewed citation excerpt candidate${
        externalConsentPacketRecord.transmissionPreview.reviewedCitationCount === 1 ? '' : 's'
      } staged for human consent review. No external model call, source transmission, vector write, graph write, promotion, file move, deletion, or attachment happened.`,
    });

    const nextWorkspace = {
      ...workspace,
      savedAt: new Date().toISOString(),
      wikiModelDraftRecords: mergeWorkspaceRecordsById(workspace.wikiModelDraftRecords, [updatedModelDraftRecord]),
      wikiModelDraftExternalConsentRecords: mergeWorkspaceRecordsById(
        workspace.wikiModelDraftExternalConsentRecords,
        [externalConsentPacketRecord],
      ),
      auditRecords: mergeWorkspaceRecordsById(workspace.auditRecords, [auditRecord]),
    };
    const record = await saveCaseManagementWorkspace(req.user.id, nextWorkspace);

    return res.status(200).json({
      modelDraftRecord:
        record.workspace.wikiModelDraftRecords?.find((item) => item.id === updatedModelDraftRecord.id) ||
        updatedModelDraftRecord,
      externalConsentPacketRecord:
        record.workspace.wikiModelDraftExternalConsentRecords?.find((item) => item.id === externalConsentPacketRecord.id) ||
        externalConsentPacketRecord,
      generatedRecords: {
        auditRecords: [auditRecord],
      },
      policy:
        'Saved an external adapter consent packet only. It did not call a model, transmit source text, promote a wiki page, attach documents to clients/cases, write vectors, write Neo4j graph data, move files, delete files, or embed anything.',
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to prepare external adapter consent packet', error);
    return res.status(500).json({ error: 'Failed to prepare external adapter consent packet' });
  }
});

router.post('/wiki/retrieval/model-drafts/:draftId/external-adapter/request-rehearsals', async (req, res) => {
  try {
    if (req.body?.confirmRequestRehearsal !== true) {
      return res.status(400).json({
        error: 'Confirm request rehearsal before assembling the external adapter request envelope.',
        policy:
          'External request rehearsals are local-only and do not call a model or transmit source text.',
      });
    }

    const requestedDraftId = readStringField(req.params, 'draftId');
    const requestedConsentPacketId = readStringField(req.body, 'consentPacketId');
    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const modelDraftRecords = Array.isArray(workspace.wikiModelDraftRecords) ? workspace.wikiModelDraftRecords : [];
    const storedModelDraftRecord = modelDraftRecords.find(
      (draft) => draft?.id === requestedDraftId || draft?.pageId === requestedDraftId,
    );

    if (!storedModelDraftRecord) {
      return res.status(404).json({
        error: 'Saved model draft packet not found.',
        policy:
          'External adapter request rehearsals only run against model draft packets already saved in this workspace.',
      });
    }

    const consentRecords = Array.isArray(workspace.wikiModelDraftExternalConsentRecords)
      ? workspace.wikiModelDraftExternalConsentRecords
      : [];
    const storedConsentPacketRecord =
      (requestedConsentPacketId
        ? consentRecords.find((record) => record?.id === requestedConsentPacketId)
        : null) ||
      consentRecords
        .filter((record) => record?.modelDraftId === storedModelDraftRecord.id)
        .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())[0];

    const requestRehearsalRecord = buildModelDraftExternalAdapterRequestRehearsalRecord({
      modelDraftRecord: storedModelDraftRecord,
      externalConsentPacketRecord: storedConsentPacketRecord,
      actor: readStringField(req.body, 'actor') || 'Current worker',
    });

    if (requestRehearsalRecord.error) {
      return res.status(409).json({
        error: requestRehearsalRecord.error,
        blockedReasons: requestRehearsalRecord.blockedReasons,
        policy:
          'External adapter request rehearsals require a saved consent packet. No model call or source transmission happened.',
      });
    }

    const updatedModelDraftRecord = {
      ...storedModelDraftRecord,
      lastExternalRequestRehearsalId: requestRehearsalRecord.id,
      lastExternalRequestRehearsalStatus: requestRehearsalRecord.status,
      lastExternalRequestRehearsalAt: requestRehearsalRecord.createdAt,
      externalRequestRehearsalCount: (Number(storedModelDraftRecord.externalRequestRehearsalCount) || 0) + 1,
      updatedAt: requestRehearsalRecord.updatedAt,
    };
    const auditRecord = normalizeCaseWikiAuditRecord({
      id: `audit:${requestRehearsalRecord.id}:${Date.now()}`,
      timestamp: requestRehearsalRecord.updatedAt,
      actor: readStringField(req.body, 'actor') || requestRehearsalRecord.createdBy,
      action: 'rehearsed external adapter request',
      object: storedModelDraftRecord.title || requestRehearsalRecord.title,
      source: 'Case Wiki',
      status: 'blocked-before-transmission',
      detail: `${requestRehearsalRecord.requestEnvelope.reviewedCitationExcerptCandidates.length} reviewed citation excerpt candidate${
        requestRehearsalRecord.requestEnvelope.reviewedCitationExcerptCandidates.length === 1 ? '' : 's'
      } assembled into a local request envelope. External provider config and action-time source-transmission consent are still required.`,
    });

    const nextWorkspace = {
      ...workspace,
      savedAt: new Date().toISOString(),
      wikiModelDraftRecords: mergeWorkspaceRecordsById(workspace.wikiModelDraftRecords, [updatedModelDraftRecord]),
      wikiModelDraftExternalRequestRehearsalRecords: mergeWorkspaceRecordsById(
        workspace.wikiModelDraftExternalRequestRehearsalRecords,
        [requestRehearsalRecord],
      ),
      auditRecords: mergeWorkspaceRecordsById(workspace.auditRecords, [auditRecord]),
    };
    const record = await saveCaseManagementWorkspace(req.user.id, nextWorkspace);

    return res.status(200).json({
      modelDraftRecord:
        record.workspace.wikiModelDraftRecords?.find((item) => item.id === updatedModelDraftRecord.id) ||
        updatedModelDraftRecord,
      requestRehearsalRecord:
        record.workspace.wikiModelDraftExternalRequestRehearsalRecords?.find((item) => item.id === requestRehearsalRecord.id) ||
        requestRehearsalRecord,
      generatedRecords: {
        auditRecords: [auditRecord],
      },
      policy:
        'Saved an external adapter request rehearsal only. It did not call a model, transmit source text, promote a wiki page, attach documents to clients/cases, write vectors, write Neo4j graph data, move files, delete files, or embed anything.',
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to rehearse external adapter request', error);
    return res.status(500).json({ error: 'Failed to rehearse external adapter request' });
  }
});

router.post(
  '/wiki/retrieval/model-drafts/:draftId/external-adapter/request-rehearsals/:rehearsalId/output-validations',
  async (req, res) => {
    try {
      if (req.body?.confirmOutputValidation !== true) {
        return res.status(400).json({
          error: 'Confirm output validation before checking adapter citation ids.',
          policy: 'Output validation is local-only and does not call a model or transmit source text.',
        });
      }

      const requestedDraftId = readStringField(req.params, 'draftId');
      const requestedRehearsalId = readStringField(req.params, 'rehearsalId');
      const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
      const modelDraftRecords = Array.isArray(workspace.wikiModelDraftRecords) ? workspace.wikiModelDraftRecords : [];
      const storedModelDraftRecord = modelDraftRecords.find(
        (draft) => draft?.id === requestedDraftId || draft?.pageId === requestedDraftId,
      );

      if (!storedModelDraftRecord) {
        return res.status(404).json({
          error: 'Saved model draft packet not found.',
          policy:
            'Output validation only runs against model draft packets already saved in this workspace.',
        });
      }

      const requestRehearsalRecords = Array.isArray(workspace.wikiModelDraftExternalRequestRehearsalRecords)
        ? workspace.wikiModelDraftExternalRequestRehearsalRecords
        : [];
      const storedRequestRehearsalRecord = requestRehearsalRecords.find(
        (record) => record?.id === requestedRehearsalId,
      );

      if (!storedRequestRehearsalRecord) {
        return res.status(404).json({
          error: 'Saved external request rehearsal not found.',
          policy: 'Output validation needs a saved request rehearsal envelope first.',
        });
      }

      const outputValidationRecord = buildModelDraftExternalAdapterOutputValidationRecord({
        modelDraftRecord: storedModelDraftRecord,
        requestRehearsalRecord: storedRequestRehearsalRecord,
        adapterOutput: req.body?.adapterOutput,
        validationMode: readStringField(req.body, 'validationMode') || 'local-sample-output',
        actor: readStringField(req.body, 'actor') || 'Current worker',
      });

      if (outputValidationRecord.error) {
        return res.status(409).json({
          error: outputValidationRecord.error,
          blockedReasons: outputValidationRecord.blockedReasons,
          policy:
            'Output validation is blocked until the saved request rehearsal and model draft line up. No model call or source transmission happened.',
        });
      }

      const updatedModelDraftRecord = {
        ...storedModelDraftRecord,
        lastExternalOutputValidationId: outputValidationRecord.id,
        lastExternalOutputValidationStatus: outputValidationRecord.status,
        lastExternalOutputValidationAt: outputValidationRecord.createdAt,
        externalOutputValidationCount: (Number(storedModelDraftRecord.externalOutputValidationCount) || 0) + 1,
        updatedAt: outputValidationRecord.updatedAt,
      };
      const updatedRequestRehearsalRecord = {
        ...storedRequestRehearsalRecord,
        lastOutputValidationId: outputValidationRecord.id,
        lastOutputValidationStatus: outputValidationRecord.status,
        lastOutputValidationAt: outputValidationRecord.createdAt,
        outputValidationCount: (Number(storedRequestRehearsalRecord.outputValidationCount) || 0) + 1,
        updatedAt: outputValidationRecord.updatedAt,
      };
      const auditRecord = normalizeCaseWikiAuditRecord({
        id: `audit:${outputValidationRecord.id}:${Date.now()}`,
        timestamp: outputValidationRecord.updatedAt,
        actor: readStringField(req.body, 'actor') || outputValidationRecord.createdBy,
        action: 'validated external adapter output citations',
        object: storedModelDraftRecord.title || outputValidationRecord.title,
        source: 'Case Wiki',
        status: outputValidationRecord.status,
        detail: `${outputValidationRecord.returnedCitationIds.length} returned citation id${
          outputValidationRecord.returnedCitationIds.length === 1 ? '' : 's'
        } checked against ${outputValidationRecord.allowedCitationIds.length} allowed reviewed citation id${
          outputValidationRecord.allowedCitationIds.length === 1 ? '' : 's'
        }. No external model call, source transmission, vector write, graph write, promotion, or attachment happened.`,
      });

      const nextWorkspace = {
        ...workspace,
        savedAt: new Date().toISOString(),
        wikiModelDraftRecords: mergeWorkspaceRecordsById(workspace.wikiModelDraftRecords, [updatedModelDraftRecord]),
        wikiModelDraftExternalRequestRehearsalRecords: mergeWorkspaceRecordsById(
          workspace.wikiModelDraftExternalRequestRehearsalRecords,
          [updatedRequestRehearsalRecord],
        ),
        wikiModelDraftExternalOutputValidationRecords: mergeWorkspaceRecordsById(
          workspace.wikiModelDraftExternalOutputValidationRecords,
          [outputValidationRecord],
        ),
        auditRecords: mergeWorkspaceRecordsById(workspace.auditRecords, [auditRecord]),
      };
      const record = await saveCaseManagementWorkspace(req.user.id, nextWorkspace);

      return res.status(200).json({
        modelDraftRecord:
          record.workspace.wikiModelDraftRecords?.find((item) => item.id === updatedModelDraftRecord.id) ||
          updatedModelDraftRecord,
        requestRehearsalRecord:
          record.workspace.wikiModelDraftExternalRequestRehearsalRecords?.find(
            (item) => item.id === updatedRequestRehearsalRecord.id,
          ) || updatedRequestRehearsalRecord,
        outputValidationRecord:
          record.workspace.wikiModelDraftExternalOutputValidationRecords?.find(
            (item) => item.id === outputValidationRecord.id,
          ) || outputValidationRecord,
        generatedRecords: {
          auditRecords: [auditRecord],
        },
        policy:
          'Saved an output citation validation only. It did not call a model, transmit source text, promote a wiki page, attach documents to clients/cases, write vectors, write Neo4j graph data, move files, delete files, or embed anything.',
      });
    } catch (error) {
      logger.error('[caseManagement] Failed to validate external adapter output citations', error);
      return res.status(500).json({ error: 'Failed to validate external adapter output citations' });
    }
  },
);

router.post(
  '/wiki/retrieval/model-drafts/:draftId/external-adapter/output-validations/:validationId/editorial-reviews',
  async (req, res) => {
    try {
      if (req.body?.confirmReturnedOutputReview !== true) {
        return res.status(400).json({
          error: 'Confirm returned output editorial review before staging the packet.',
          policy:
            'Returned output review is local-only and does not promote prose, write vectors, write graph data, or transmit source text.',
        });
      }

      const requestedDraftId = readStringField(req.params, 'draftId');
      const requestedValidationId = readStringField(req.params, 'validationId');
      const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
      const modelDraftRecords = Array.isArray(workspace.wikiModelDraftRecords) ? workspace.wikiModelDraftRecords : [];
      const storedModelDraftRecord = modelDraftRecords.find(
        (draft) => draft?.id === requestedDraftId || draft?.pageId === requestedDraftId,
      );

      if (!storedModelDraftRecord) {
        return res.status(404).json({
          error: 'Saved model draft packet not found.',
          policy: 'Returned output review only runs against saved model draft packets.',
        });
      }

      const outputValidationRecords = Array.isArray(workspace.wikiModelDraftExternalOutputValidationRecords)
        ? workspace.wikiModelDraftExternalOutputValidationRecords
        : [];
      const storedOutputValidationRecord = outputValidationRecords.find(
        (record) => record?.id === requestedValidationId,
      );

      if (!storedOutputValidationRecord) {
        return res.status(404).json({
          error: 'Saved output validation not found.',
          policy: 'Returned output review needs a saved, passing citation validation first.',
        });
      }

      const returnedOutputReviewRecord = buildReturnedOutputEditorialReviewRecord({
        modelDraftRecord: storedModelDraftRecord,
        outputValidationRecord: storedOutputValidationRecord,
        actor: readStringField(req.body, 'actor') || 'Current worker',
      });

      if (returnedOutputReviewRecord.error) {
        return res.status(409).json({
          error: returnedOutputReviewRecord.error,
          blockedReasons: returnedOutputReviewRecord.blockedReasons,
          policy:
            'Returned output editorial review is blocked until captured output passes citation validation. No promotion, vector write, graph write, or source transmission happened.',
        });
      }

      const updatedModelDraftRecord = {
        ...storedModelDraftRecord,
        lastReturnedOutputReviewId: returnedOutputReviewRecord.id,
        lastReturnedOutputReviewStatus: returnedOutputReviewRecord.status,
        lastReturnedOutputReviewAt: returnedOutputReviewRecord.createdAt,
        returnedOutputReviewCount: (Number(storedModelDraftRecord.returnedOutputReviewCount) || 0) + 1,
        updatedAt: returnedOutputReviewRecord.updatedAt,
      };
      const auditRecord = normalizeCaseWikiAuditRecord({
        id: `audit:${returnedOutputReviewRecord.id}:${Date.now()}`,
        timestamp: returnedOutputReviewRecord.updatedAt,
        actor: readStringField(req.body, 'actor') || returnedOutputReviewRecord.createdBy,
        action: 'staged returned adapter output for editorial review',
        object: storedModelDraftRecord.title || returnedOutputReviewRecord.title,
        source: 'Case Wiki',
        status: returnedOutputReviewRecord.status,
        detail: `${returnedOutputReviewRecord.sectionCount} returned section${
          returnedOutputReviewRecord.sectionCount === 1 ? '' : 's'
        } staged for human editorial review. No external model call, source transmission, vector write, graph write, promotion, file move, deletion, or attachment happened.`,
      });

      const nextWorkspace = {
        ...workspace,
        savedAt: new Date().toISOString(),
        wikiModelDraftRecords: mergeWorkspaceRecordsById(workspace.wikiModelDraftRecords, [updatedModelDraftRecord]),
        wikiModelDraftReturnedOutputReviewRecords: mergeWorkspaceRecordsById(
          workspace.wikiModelDraftReturnedOutputReviewRecords,
          [returnedOutputReviewRecord],
        ),
        auditRecords: mergeWorkspaceRecordsById(workspace.auditRecords, [auditRecord]),
      };
      const record = await saveCaseManagementWorkspace(req.user.id, nextWorkspace);

      return res.status(200).json({
        modelDraftRecord:
          record.workspace.wikiModelDraftRecords?.find((item) => item.id === updatedModelDraftRecord.id) ||
          updatedModelDraftRecord,
        returnedOutputReviewRecord:
          record.workspace.wikiModelDraftReturnedOutputReviewRecords?.find(
            (item) => item.id === returnedOutputReviewRecord.id,
          ) || returnedOutputReviewRecord,
        generatedRecords: {
          auditRecords: [auditRecord],
        },
        policy:
          'Saved a returned output editorial review packet only. It did not call a model, transmit source text, promote a wiki page, attach documents to clients/cases, write vectors, write Neo4j graph data, move files, delete files, or embed anything.',
      });
    } catch (error) {
      logger.error('[caseManagement] Failed to stage returned output editorial review', error);
      return res.status(500).json({ error: 'Failed to stage returned output editorial review' });
    }
  },
);

router.post(
  '/wiki/retrieval/model-drafts/:draftId/returned-output-reviews/:reviewId/editorial-decisions',
  async (req, res) => {
    try {
      if (req.body?.confirmReturnedOutputEditorialDecision !== true) {
        return res.status(400).json({
          error: 'Confirm returned output editorial decisions before saving them.',
          policy:
            'Editorial decisions update the review packet only. They do not promote prose, write vectors, write graph data, attach records, move files, delete files, or transmit source text.',
        });
      }

      const requestedDraftId = readStringField(req.params, 'draftId');
      const requestedReviewId = readStringField(req.params, 'reviewId');
      const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
      const modelDraftRecords = Array.isArray(workspace.wikiModelDraftRecords) ? workspace.wikiModelDraftRecords : [];
      const storedModelDraftRecord = modelDraftRecords.find(
        (draft) => draft?.id === requestedDraftId || draft?.pageId === requestedDraftId,
      );

      if (!storedModelDraftRecord) {
        return res.status(404).json({
          error: 'Saved model draft packet not found.',
          policy: 'Returned output editorial decisions only run against saved model draft packets.',
        });
      }

      const returnedOutputReviewRecords = Array.isArray(workspace.wikiModelDraftReturnedOutputReviewRecords)
        ? workspace.wikiModelDraftReturnedOutputReviewRecords
        : [];
      const storedReturnedOutputReviewRecord = returnedOutputReviewRecords.find(
        (record) => record?.id === requestedReviewId || record?.pageId === requestedReviewId,
      );

      if (!storedReturnedOutputReviewRecord) {
        return res.status(404).json({
          error: 'Returned output review packet not found.',
          policy: 'Stage a returned output review packet before recording section decisions.',
        });
      }

      if (asString(storedReturnedOutputReviewRecord.modelDraftId) !== asString(storedModelDraftRecord.id)) {
        return res.status(409).json({
          error: 'Returned output review packet belongs to a different model draft.',
          policy: 'Editorial decisions cannot cross model draft boundaries.',
        });
      }

      const updatedReturnedOutputReviewRecord = applyReturnedOutputEditorialDecisionRecord({
        returnedOutputReviewRecord: storedReturnedOutputReviewRecord,
        sectionDecisions: Array.isArray(req.body?.sectionDecisions) ? req.body.sectionDecisions : [],
        decisionMode: readStringField(req.body, 'decisionMode'),
        privacyDecision: readStringField(req.body, 'privacyDecision'),
        toneDecision: readStringField(req.body, 'toneDecision'),
        reviewerNote: readStringField(req.body, 'reviewerNote'),
        actor: readStringField(req.body, 'actor') || 'Current worker',
      });

      if (updatedReturnedOutputReviewRecord.error) {
        return res.status(409).json({
          error: updatedReturnedOutputReviewRecord.error,
          blockedReasons: updatedReturnedOutputReviewRecord.blockedReasons,
          policy:
            'Returned output editorial decisions were not saved. No promotion, vector write, graph write, attachment, file move, deletion, or source transmission happened.',
        });
      }

      const updatedModelDraftRecord = {
        ...storedModelDraftRecord,
        lastReturnedOutputReviewId: updatedReturnedOutputReviewRecord.id,
        lastReturnedOutputReviewStatus: updatedReturnedOutputReviewRecord.status,
        lastReturnedOutputReviewAt: updatedReturnedOutputReviewRecord.updatedAt,
        lastReturnedOutputDecisionAt: updatedReturnedOutputReviewRecord.lastDecisionAt,
        updatedAt: updatedReturnedOutputReviewRecord.updatedAt,
      };
      const auditRecord = normalizeCaseWikiAuditRecord({
        id: `audit:${updatedReturnedOutputReviewRecord.id}:decision:${Date.now()}`,
        timestamp: updatedReturnedOutputReviewRecord.updatedAt,
        actor: readStringField(req.body, 'actor') || updatedReturnedOutputReviewRecord.lastDecisionBy,
        action: 'recorded returned adapter output editorial decisions',
        object: storedModelDraftRecord.title || updatedReturnedOutputReviewRecord.title,
        source: 'Case Wiki',
        status: updatedReturnedOutputReviewRecord.status,
        detail: `${updatedReturnedOutputReviewRecord.readySectionCount || 0} ready, ${
          updatedReturnedOutputReviewRecord.revisionSectionCount || 0
        } revision, ${
          updatedReturnedOutputReviewRecord.pendingSectionCount || 0
        } pending returned section decisions saved. No article promotion, external model call, source transmission, vector write, graph write, file move, deletion, or attachment happened.`,
      });

      const nextWorkspace = {
        ...workspace,
        savedAt: new Date().toISOString(),
        wikiModelDraftRecords: mergeWorkspaceRecordsById(workspace.wikiModelDraftRecords, [updatedModelDraftRecord]),
        wikiModelDraftReturnedOutputReviewRecords: mergeWorkspaceRecordsById(
          workspace.wikiModelDraftReturnedOutputReviewRecords,
          [updatedReturnedOutputReviewRecord],
        ),
        auditRecords: mergeWorkspaceRecordsById(workspace.auditRecords, [auditRecord]),
      };
      const record = await saveCaseManagementWorkspace(req.user.id, nextWorkspace);

      return res.status(200).json({
        modelDraftRecord:
          record.workspace.wikiModelDraftRecords?.find((item) => item.id === updatedModelDraftRecord.id) ||
          updatedModelDraftRecord,
        returnedOutputReviewRecord:
          record.workspace.wikiModelDraftReturnedOutputReviewRecords?.find(
            (item) => item.id === updatedReturnedOutputReviewRecord.id,
          ) || updatedReturnedOutputReviewRecord,
        generatedRecords: {
          auditRecords: [auditRecord],
        },
        policy:
          'Saved returned output editorial decisions only. This did not call a model, transmit source text, promote a wiki page, attach documents to clients/cases, write vectors, write Neo4j graph data, move files, delete files, or embed anything.',
      });
    } catch (error) {
      logger.error('[caseManagement] Failed to record returned output editorial decisions', error);
      return res.status(500).json({ error: 'Failed to record returned output editorial decisions' });
    }
  },
);

router.post(
  '/wiki/retrieval/model-drafts/:draftId/returned-output-reviews/:reviewId/promotion-readiness',
  async (req, res) => {
    try {
      if (req.body?.confirmReturnedOutputPromotionReadiness !== true) {
        return res.status(400).json({
          error: 'Confirm returned output promotion readiness before saving the checklist.',
          policy:
            'Promotion readiness saves a checklist only. It does not publish prose, write vectors, write graph data, attach records, move files, delete files, or transmit source text.',
        });
      }

      const requestedDraftId = readStringField(req.params, 'draftId');
      const requestedReviewId = readStringField(req.params, 'reviewId');
      const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
      const modelDraftRecords = Array.isArray(workspace.wikiModelDraftRecords) ? workspace.wikiModelDraftRecords : [];
      const storedModelDraftRecord = modelDraftRecords.find(
        (draft) => draft?.id === requestedDraftId || draft?.pageId === requestedDraftId,
      );

      if (!storedModelDraftRecord) {
        return res.status(404).json({
          error: 'Saved model draft packet not found.',
          policy: 'Returned output promotion readiness only runs against saved model draft packets.',
        });
      }

      const returnedOutputReviewRecords = Array.isArray(workspace.wikiModelDraftReturnedOutputReviewRecords)
        ? workspace.wikiModelDraftReturnedOutputReviewRecords
        : [];
      const storedReturnedOutputReviewRecord = returnedOutputReviewRecords.find(
        (record) => record?.id === requestedReviewId || record?.pageId === requestedReviewId,
      );

      if (!storedReturnedOutputReviewRecord) {
        return res.status(404).json({
          error: 'Returned output review packet not found.',
          policy: 'Stage and review returned output before checking promotion readiness.',
        });
      }

      if (asString(storedReturnedOutputReviewRecord.modelDraftId) !== asString(storedModelDraftRecord.id)) {
        return res.status(409).json({
          error: 'Returned output review packet belongs to a different model draft.',
          policy: 'Promotion readiness cannot cross model draft boundaries.',
        });
      }

      const updatedReturnedOutputReviewRecord = buildReturnedOutputPromotionReadinessReview({
        modelDraftRecord: storedModelDraftRecord,
        returnedOutputReviewRecord: storedReturnedOutputReviewRecord,
        actor: readStringField(req.body, 'actor') || 'Current worker',
      });

      if (updatedReturnedOutputReviewRecord.error) {
        return res.status(409).json({
          error: updatedReturnedOutputReviewRecord.error,
          blockedReasons: updatedReturnedOutputReviewRecord.blockedReasons,
          policy:
            'Returned output promotion readiness was not saved. No promotion, vector write, graph write, attachment, file move, deletion, or source transmission happened.',
        });
      }

      const updatedModelDraftRecord = {
        ...storedModelDraftRecord,
        lastReturnedOutputReviewId: updatedReturnedOutputReviewRecord.id,
        lastReturnedOutputReviewStatus: updatedReturnedOutputReviewRecord.status,
        lastReturnedOutputReviewAt: updatedReturnedOutputReviewRecord.updatedAt,
        lastReturnedOutputPromotionReadinessAt: updatedReturnedOutputReviewRecord.lastPromotionReadinessAt,
        lastReturnedOutputPromotionReadinessStatus: updatedReturnedOutputReviewRecord.lastPromotionReadinessStatus,
        updatedAt: updatedReturnedOutputReviewRecord.updatedAt,
      };
      const readiness = updatedReturnedOutputReviewRecord.promotionReadinessReview || {};
      const auditRecord = normalizeCaseWikiAuditRecord({
        id: `audit:${updatedReturnedOutputReviewRecord.id}:promotion-readiness:${Date.now()}`,
        timestamp: updatedReturnedOutputReviewRecord.updatedAt,
        actor: readStringField(req.body, 'actor') || updatedReturnedOutputReviewRecord.lastDecisionBy || readiness.createdBy,
        action: 'prepared returned adapter output promotion readiness',
        object: storedModelDraftRecord.title || updatedReturnedOutputReviewRecord.title,
        source: 'Case Wiki',
        status: readiness.status || updatedReturnedOutputReviewRecord.status,
        detail: `${readiness.readySectionCount || 0} of ${
          readiness.sectionCount || 0
        } returned sections passed promotion readiness. No article promotion, external model call, source transmission, vector write, graph write, file move, deletion, or attachment happened.`,
      });

      const nextWorkspace = {
        ...workspace,
        savedAt: new Date().toISOString(),
        wikiModelDraftRecords: mergeWorkspaceRecordsById(workspace.wikiModelDraftRecords, [updatedModelDraftRecord]),
        wikiModelDraftReturnedOutputReviewRecords: mergeWorkspaceRecordsById(
          workspace.wikiModelDraftReturnedOutputReviewRecords,
          [updatedReturnedOutputReviewRecord],
        ),
        auditRecords: mergeWorkspaceRecordsById(workspace.auditRecords, [auditRecord]),
      };
      const record = await saveCaseManagementWorkspace(req.user.id, nextWorkspace);

      return res.status(200).json({
        modelDraftRecord:
          record.workspace.wikiModelDraftRecords?.find((item) => item.id === updatedModelDraftRecord.id) ||
          updatedModelDraftRecord,
        returnedOutputReviewRecord:
          record.workspace.wikiModelDraftReturnedOutputReviewRecords?.find(
            (item) => item.id === updatedReturnedOutputReviewRecord.id,
          ) || updatedReturnedOutputReviewRecord,
        generatedRecords: {
          auditRecords: [auditRecord],
        },
        policy:
          'Saved returned output promotion readiness only. This did not call a model, transmit source text, promote a wiki page, attach documents to clients/cases, write vectors, write Neo4j graph data, move files, delete files, or embed anything.',
      });
    } catch (error) {
      logger.error('[caseManagement] Failed to prepare returned output promotion readiness', error);
      return res.status(500).json({ error: 'Failed to prepare returned output promotion readiness' });
    }
  },
);

router.post(
  '/wiki/retrieval/model-drafts/:draftId/returned-output-reviews/:reviewId/publish',
  async (req, res) => {
    try {
      if (req.body?.confirmReturnedOutputPublication !== true) {
        return res.status(400).json({
          error: 'Confirm returned output publication before writing it into the Case Wiki.',
          policy:
            'Returned output publication is human-confirmed. It writes a wiki topic record only and does not write vectors, graph data, attachments, files, or source transmissions.',
        });
      }

      const requestedDraftId = readStringField(req.params, 'draftId');
      const requestedReviewId = readStringField(req.params, 'reviewId');
      const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
      const modelDraftRecords = Array.isArray(workspace.wikiModelDraftRecords) ? workspace.wikiModelDraftRecords : [];
      const storedModelDraftRecord = modelDraftRecords.find(
        (draft) => draft?.id === requestedDraftId || draft?.pageId === requestedDraftId,
      );

      if (!storedModelDraftRecord) {
        return res.status(404).json({
          error: 'Saved model draft packet not found.',
          policy: 'Returned output publication only runs against saved model draft packets.',
        });
      }

      const returnedOutputReviewRecords = Array.isArray(workspace.wikiModelDraftReturnedOutputReviewRecords)
        ? workspace.wikiModelDraftReturnedOutputReviewRecords
        : [];
      const storedReturnedOutputReviewRecord = returnedOutputReviewRecords.find(
        (record) => record?.id === requestedReviewId || record?.pageId === requestedReviewId,
      );

      if (!storedReturnedOutputReviewRecord) {
        return res.status(404).json({
          error: 'Returned output review packet not found.',
          policy: 'Stage, review, and readiness-check returned output before publishing it.',
        });
      }

      if (asString(storedReturnedOutputReviewRecord.modelDraftId) !== asString(storedModelDraftRecord.id)) {
        return res.status(409).json({
          error: 'Returned output review packet belongs to a different model draft.',
          policy: 'Returned output publication cannot cross model draft boundaries.',
        });
      }

      const publicationCandidate = buildReturnedOutputPublicationCandidate({
        modelDraftRecord: storedModelDraftRecord,
        returnedOutputReviewRecord: storedReturnedOutputReviewRecord,
        actor: readStringField(req.body, 'actor') || 'Current worker',
      });

      if (publicationCandidate.error) {
        return res.status(409).json({
          error: publicationCandidate.error,
          blockedReasons: publicationCandidate.blockedReasons,
          policy:
            'Returned output publication was not saved. No promotion, vector write, graph write, attachment, file move, deletion, or source transmission happened.',
        });
      }

      const existingPromotion = Array.isArray(workspace.wikiPromotionRecords)
        ? workspace.wikiPromotionRecords.find(
            (item) =>
              item?.pageId === publicationCandidate.promotionRecord.pageId ||
              item?.id === publicationCandidate.promotionRecord.id,
          )
        : null;
      const neo4j = {
        status: 'skipped',
        message:
          'Returned-output publication saved as a Case Wiki topic record only. Neo4j graph sync stays behind a separate review gate.',
      };
      const storedPromotionRecord = applyRetrievalPromotionVersioning({
        existingPromotion,
        incomingPromotion: publicationCandidate.promotionRecord,
        neo4j,
      });
      const now = new Date().toISOString();
      const publishedReturnedOutputArticle = {
        id: `returned-output-article:${storedPromotionRecord.id}`,
        promotionId: storedPromotionRecord.id,
        pageId: storedPromotionRecord.pageId,
        title: storedPromotionRecord.title,
        status: 'published-returned-output-topic',
        publishMode: storedPromotionRecord.publishMode,
        version: storedPromotionRecord.version || 1,
        revisionId: storedPromotionRecord.revisionId,
        modelDraftId: asString(storedModelDraftRecord.id),
        returnedOutputReviewId: asString(storedReturnedOutputReviewRecord.id),
        outputValidationId: asString(storedReturnedOutputReviewRecord.outputValidationId),
        sections: storedPromotionRecord.sections || [],
        citationIds: publicationCandidate.citationIds,
        citationLedger: storedPromotionRecord.citationLedger || [],
        sectionCount: storedPromotionRecord.sections?.length || 0,
        citationCount: storedPromotionRecord.citationLedger?.length || 0,
        createdAt: storedPromotionRecord.updatedAt || storedPromotionRecord.createdAt || now,
        createdBy: readStringField(req.body, 'actor') || storedPromotionRecord.createdBy || 'Current worker',
        promotionMade: true,
        vectorWriteMade: false,
        graphWriteMade: false,
        sourceTextTransmitted: false,
        attachmentMade: false,
        fileOperationMade: false,
        policy: publicationCandidate.policy,
      };
      const updatedReturnedOutputReviewRecord = {
        ...storedReturnedOutputReviewRecord,
        status: 'published-returned-output-topic',
        publishedPromotionId: storedPromotionRecord.id,
        publishedReturnedOutputArticle,
        lastPublishedAt: publishedReturnedOutputArticle.createdAt,
        lastPublicationStatus: publishedReturnedOutputArticle.status,
        promotionMade: true,
        vectorWriteMade: false,
        graphWriteMade: false,
        sourceTextTransmitted: false,
        updatedAt: publishedReturnedOutputArticle.createdAt,
      };
      const updatedModelDraftRecord = {
        ...storedModelDraftRecord,
        lastReturnedOutputReviewId: updatedReturnedOutputReviewRecord.id,
        lastReturnedOutputReviewStatus: updatedReturnedOutputReviewRecord.status,
        lastReturnedOutputReviewAt: updatedReturnedOutputReviewRecord.updatedAt,
        lastReturnedOutputPublicationAt: updatedReturnedOutputReviewRecord.lastPublishedAt,
        lastReturnedOutputPublicationStatus: updatedReturnedOutputReviewRecord.lastPublicationStatus,
        updatedAt: updatedReturnedOutputReviewRecord.updatedAt,
      };
      const auditRecord = normalizeCaseWikiAuditRecord({
        id: `audit:${updatedReturnedOutputReviewRecord.id}:publication:${Date.now()}`,
        timestamp: updatedReturnedOutputReviewRecord.updatedAt,
        actor: readStringField(req.body, 'actor') || publishedReturnedOutputArticle.createdBy,
        action: existingPromotion
          ? 'updated returned adapter output wiki topic'
          : 'published returned adapter output wiki topic',
        object: storedPromotionRecord.title,
        source: 'Case Wiki',
        status: publishedReturnedOutputArticle.status,
        detail: `${publishedReturnedOutputArticle.sectionCount} returned section${
          publishedReturnedOutputArticle.sectionCount === 1 ? '' : 's'
        } and ${publishedReturnedOutputArticle.citationCount} reviewed citation${
          publishedReturnedOutputArticle.citationCount === 1 ? '' : 's'
        } saved as ${storedPromotionRecord.pageId} v${storedPromotionRecord.version || 1}. No external model call, source transmission, vector write, graph write, attachment, file move, or deletion happened.`,
      });

      const nextWorkspace = {
        ...workspace,
        savedAt: new Date().toISOString(),
        wikiModelDraftRecords: mergeWorkspaceRecordsById(workspace.wikiModelDraftRecords, [updatedModelDraftRecord]),
        wikiModelDraftReturnedOutputReviewRecords: mergeWorkspaceRecordsById(
          workspace.wikiModelDraftReturnedOutputReviewRecords,
          [updatedReturnedOutputReviewRecord],
        ),
        wikiPromotionRecords: mergePromotionRecordsByPageId(workspace.wikiPromotionRecords, [storedPromotionRecord]),
        auditRecords: mergeWorkspaceRecordsById(workspace.auditRecords, [auditRecord]),
      };
      const record = await saveCaseManagementWorkspace(req.user.id, nextWorkspace);

      return res.status(200).json({
        modelDraftRecord:
          record.workspace.wikiModelDraftRecords?.find((item) => item.id === updatedModelDraftRecord.id) ||
          updatedModelDraftRecord,
        returnedOutputReviewRecord:
          record.workspace.wikiModelDraftReturnedOutputReviewRecords?.find(
            (item) => item.id === updatedReturnedOutputReviewRecord.id,
          ) || updatedReturnedOutputReviewRecord,
        promotionRecord:
          record.workspace.wikiPromotionRecords?.find((item) => item.id === storedPromotionRecord.id) ||
          storedPromotionRecord,
        publishedReturnedOutputArticle,
        generatedRecords: {
          auditRecords: [auditRecord],
        },
        neo4j,
        policy:
          'Saved a human-confirmed returned-output Case Wiki topic. This did not call a model, transmit source text, attach records, write Weaviate vectors, write Neo4j graph data, move files, delete files, or embed anything.',
      });
    } catch (error) {
      logger.error('[caseManagement] Failed to publish returned output wiki topic', error);
      return res.status(500).json({ error: 'Failed to publish returned output into the Case Wiki' });
    }
  },
);

router.post(
  '/wiki/retrieval/model-drafts/:draftId/returned-output-reviews/:reviewId/graph-sync',
  async (req, res) => {
    try {
      if (req.body?.confirmReturnedOutputGraphSync !== true) {
        return res.status(400).json({
          error: 'Confirm returned output graph sync before writing the topic into Neo4j.',
          policy:
            'Returned output graph sync writes only the already-published Case Wiki topic graph. It does not write vectors, attach records, move files, delete files, or transmit source text.',
        });
      }

      const requestedDraftId = readStringField(req.params, 'draftId');
      const requestedReviewId = readStringField(req.params, 'reviewId');
      const actor = readStringField(req.body, 'actor') || 'Current worker';
      const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
      const modelDraftRecords = Array.isArray(workspace.wikiModelDraftRecords) ? workspace.wikiModelDraftRecords : [];
      const storedModelDraftRecord = modelDraftRecords.find(
        (draft) => draft?.id === requestedDraftId || draft?.pageId === requestedDraftId,
      );

      if (!storedModelDraftRecord) {
        return res.status(404).json({
          error: 'Saved model draft packet not found.',
          policy: 'Returned output graph sync only runs against saved model draft packets.',
        });
      }

      const returnedOutputReviewRecords = Array.isArray(workspace.wikiModelDraftReturnedOutputReviewRecords)
        ? workspace.wikiModelDraftReturnedOutputReviewRecords
        : [];
      const storedReturnedOutputReviewRecord = returnedOutputReviewRecords.find(
        (record) => record?.id === requestedReviewId || record?.pageId === requestedReviewId,
      );

      if (!storedReturnedOutputReviewRecord) {
        return res.status(404).json({
          error: 'Returned output review packet not found.',
          policy: 'Publish returned output before syncing its topic graph.',
        });
      }

      if (asString(storedReturnedOutputReviewRecord.modelDraftId) !== asString(storedModelDraftRecord.id)) {
        return res.status(409).json({
          error: 'Returned output review packet belongs to a different model draft.',
          policy: 'Returned output graph sync cannot cross model draft boundaries.',
        });
      }

      const publishedArticle = storedReturnedOutputReviewRecord.publishedReturnedOutputArticle || {};
      const promotionId =
        asString(publishedArticle.promotionId) || asString(storedReturnedOutputReviewRecord.publishedPromotionId);
      if (!promotionId || storedReturnedOutputReviewRecord.status !== 'published-returned-output-topic') {
        return res.status(409).json({
          error: 'Returned output topic has not been published yet.',
          blockedReasons: ['Publish the reviewed returned output topic before syncing it to Neo4j.'],
          policy: 'Graph sync is blocked until there is a human-confirmed Case Wiki topic record.',
        });
      }

      const promotionRecords = Array.isArray(workspace.wikiPromotionRecords) ? workspace.wikiPromotionRecords : [];
      const storedPromotionRecord = promotionRecords.find(
        (promotion) =>
          promotion?.id === promotionId ||
          promotion?.pageId === asString(publishedArticle.pageId) ||
          promotion?.id === asString(storedReturnedOutputReviewRecord.publishedPromotionId),
      );

      if (!storedPromotionRecord) {
        return res.status(404).json({
          error: 'Published Case Wiki topic record not found.',
          policy: 'Graph sync needs the published wiki promotion record so Neo4j receives the exact topic content.',
        });
      }

      const graph = buildRetrievalPromotionGraph({ promotionRecord: storedPromotionRecord, userId: req.user.id });
      if (!graph?.nodes?.length) {
        return res.status(409).json({
          error: 'Published topic graph could not be built.',
          blockedReasons: ['The published returned-output topic has no graph nodes to sync.'],
          policy: 'No Neo4j write happened.',
        });
      }

      const neo4j = await writeCaseWikiGraphToNeo4j(graph);
      const now = new Date().toISOString();
      const graphSummary = {
        nodeCount: neo4j.nodeCount || graph.nodes.length,
        edgeCount: neo4j.edgeCount || graph.edges.length,
        status: neo4j.status,
        message: neo4j.message || neo4j.skippedReason || '',
      };
      const updatedPromotionRecord = {
        ...storedPromotionRecord,
        neo4jStatus: neo4j.status,
        neo4jMessage: neo4j.message || neo4j.skippedReason || '',
        graphSyncedAt: now,
        graphSyncedBy: actor,
        graphSummary,
        updatedAt: now,
      };
      const updatedPublishedArticle = {
        ...publishedArticle,
        graphWriteMade: neo4j.status === 'written',
        neo4jStatus: neo4j.status,
        neo4jMessage: neo4j.message || neo4j.skippedReason || '',
        graphSyncedAt: now,
        graphSyncedBy: actor,
        graphSummary,
        vectorWriteMade: false,
        sourceTextTransmitted: false,
        attachmentMade: false,
        fileOperationMade: false,
      };
      const updatedReturnedOutputReviewRecord = {
        ...storedReturnedOutputReviewRecord,
        publishedReturnedOutputArticle: updatedPublishedArticle,
        graphWriteMade: neo4j.status === 'written',
        vectorWriteMade: false,
        sourceTextTransmitted: false,
        lastReturnedOutputGraphSyncAt: now,
        lastReturnedOutputGraphSyncStatus: neo4j.status,
        updatedAt: now,
      };
      const updatedModelDraftRecord = {
        ...storedModelDraftRecord,
        lastReturnedOutputReviewId: updatedReturnedOutputReviewRecord.id,
        lastReturnedOutputReviewStatus: updatedReturnedOutputReviewRecord.status,
        lastReturnedOutputGraphSyncAt: now,
        lastReturnedOutputGraphSyncStatus: neo4j.status,
        updatedAt: now,
      };
      const auditRecord = normalizeCaseWikiAuditRecord({
        id: `audit:${updatedReturnedOutputReviewRecord.id}:graph-sync:${Date.now()}`,
        timestamp: now,
        actor,
        action: 'synced returned adapter output topic graph',
        object: storedPromotionRecord.title,
        source: 'Case Wiki',
        status: neo4j.status,
        detail: `${graphSummary.nodeCount} node${graphSummary.nodeCount === 1 ? '' : 's'} and ${
          graphSummary.edgeCount
        } edge${graphSummary.edgeCount === 1 ? '' : 's'} prepared for Neo4j from ${
          storedPromotionRecord.pageId
        }. No vectors, attachments, source transmission, file moves, or deletions happened.`,
      });

      const nextWorkspace = {
        ...workspace,
        savedAt: new Date().toISOString(),
        wikiModelDraftRecords: mergeWorkspaceRecordsById(workspace.wikiModelDraftRecords, [updatedModelDraftRecord]),
        wikiModelDraftReturnedOutputReviewRecords: mergeWorkspaceRecordsById(
          workspace.wikiModelDraftReturnedOutputReviewRecords,
          [updatedReturnedOutputReviewRecord],
        ),
        wikiPromotionRecords: mergePromotionRecordsByPageId(workspace.wikiPromotionRecords, [updatedPromotionRecord]),
        auditRecords: mergeWorkspaceRecordsById(workspace.auditRecords, [auditRecord]),
      };
      const record = await saveCaseManagementWorkspace(req.user.id, nextWorkspace);

      return res.status(200).json({
        modelDraftRecord:
          record.workspace.wikiModelDraftRecords?.find((item) => item.id === updatedModelDraftRecord.id) ||
          updatedModelDraftRecord,
        returnedOutputReviewRecord:
          record.workspace.wikiModelDraftReturnedOutputReviewRecords?.find(
            (item) => item.id === updatedReturnedOutputReviewRecord.id,
          ) || updatedReturnedOutputReviewRecord,
        promotionRecord:
          record.workspace.wikiPromotionRecords?.find((item) => item.id === updatedPromotionRecord.id) ||
          updatedPromotionRecord,
        publishedReturnedOutputArticle: updatedPublishedArticle,
        generatedRecords: {
          auditRecords: [auditRecord],
        },
        neo4j,
        graph,
        policy:
          'Synced the human-confirmed returned-output Case Wiki topic graph only. This did not call a model, transmit source text, attach records, write Weaviate vectors, move files, delete files, or embed anything.',
      });
    } catch (error) {
      logger.error('[caseManagement] Failed to sync returned output wiki topic graph', error);
      return res.status(500).json({ error: 'Failed to sync returned output topic graph to Neo4j' });
    }
  },
);

router.post('/wiki/retrieval/model-drafts/:draftId/executions', async (req, res) => {
  try {
    const adapterMode = readStringField(req.body, 'adapterMode') || CASE_WIKI_LOCAL_MODEL_DRAFT_ADAPTER_MODE;
    if (adapterMode !== CASE_WIKI_LOCAL_MODEL_DRAFT_ADAPTER_MODE) {
      return res.status(409).json({
        error: 'External model execution is disabled for this adapter.',
        blockedReasons: [
          'Only the local citation-contract rehearsal is available. No source text is transmitted outside Street Voices.',
        ],
        policy:
          'External model calls require a separate transmission consent path, adapter configuration, and human confirmation before they can run.',
      });
    }

    if (req.body?.confirmModelDraftExecution !== true) {
      return res.status(400).json({
        error: 'Confirm model draft execution before running the local adapter rehearsal.',
        policy:
          'The local adapter consumes only a saved reviewed model draft packet. It does not call an external model or write vectors.',
      });
    }

    const requestedDraftId = readStringField(req.params, 'draftId');
    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const modelDraftRecords = Array.isArray(workspace.wikiModelDraftRecords) ? workspace.wikiModelDraftRecords : [];
    const storedModelDraftRecord = modelDraftRecords.find(
      (draft) => draft?.id === requestedDraftId || draft?.pageId === requestedDraftId,
    );

    if (!storedModelDraftRecord) {
      return res.status(404).json({
        error: 'Saved model draft packet not found.',
        policy: 'The adapter only runs against model draft packets already saved in this workspace.',
      });
    }

    const modelDraftExecutionRecord = buildModelDraftLocalExecutionRecord({
      modelDraftRecord: storedModelDraftRecord,
      adapterMode,
      actor: readStringField(req.body, 'actor') || 'Current worker',
    });

    if (modelDraftExecutionRecord.error) {
      return res.status(409).json({
        error: modelDraftExecutionRecord.error,
        blockedReasons: modelDraftExecutionRecord.blockedReasons,
        citationCoverageDiff: modelDraftExecutionRecord.citationCoverageDiff,
        policy:
          modelDraftExecutionRecord.policy ||
          'The adapter rehearsal is blocked until the saved packet satisfies the reviewed citation contract.',
      });
    }

    const updatedModelDraftRecord = {
      ...storedModelDraftRecord,
      lastExecutionId: modelDraftExecutionRecord.id,
      lastExecutionStatus: modelDraftExecutionRecord.status,
      lastExecutedAt: modelDraftExecutionRecord.createdAt,
      executionCount: (Number(storedModelDraftRecord.executionCount) || 0) + 1,
      updatedAt: modelDraftExecutionRecord.updatedAt,
    };
    const auditRecord = normalizeCaseWikiAuditRecord({
      id: `audit:${modelDraftExecutionRecord.id}:${Date.now()}`,
      timestamp: modelDraftExecutionRecord.updatedAt,
      actor: readStringField(req.body, 'actor') || modelDraftExecutionRecord.createdBy,
      action: 'ran local model draft adapter rehearsal',
      object: storedModelDraftRecord.title || modelDraftExecutionRecord.title,
      source: 'Case Wiki',
      status: 'completed',
      detail: `${modelDraftExecutionRecord.sections.length} adapter section${
        modelDraftExecutionRecord.sections.length === 1 ? '' : 's'
      } passed the reviewed citation contract. No external model call, vector write, graph write, promotion, file move, or attachment happened.`,
    });

    const nextWorkspace = {
      ...workspace,
      savedAt: new Date().toISOString(),
      wikiModelDraftRecords: mergeWorkspaceRecordsById(workspace.wikiModelDraftRecords, [updatedModelDraftRecord]),
      wikiModelDraftExecutionRecords: mergeWorkspaceRecordsById(workspace.wikiModelDraftExecutionRecords, [
        modelDraftExecutionRecord,
      ]),
      auditRecords: mergeWorkspaceRecordsById(workspace.auditRecords, [auditRecord]),
    };
    const record = await saveCaseManagementWorkspace(req.user.id, nextWorkspace);

    return res.status(200).json({
      modelDraftRecord:
        record.workspace.wikiModelDraftRecords?.find((item) => item.id === updatedModelDraftRecord.id) ||
        updatedModelDraftRecord,
      modelDraftExecutionRecord:
        record.workspace.wikiModelDraftExecutionRecords?.find((item) => item.id === modelDraftExecutionRecord.id) ||
        modelDraftExecutionRecord,
      generatedRecords: {
        auditRecords: [auditRecord],
      },
      policy:
        'Local adapter rehearsal completed. It did not call a model, transmit source text, promote a wiki page, attach documents to clients/cases, write vectors, write Neo4j graph data, move files, or delete anything.',
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to run local model draft adapter rehearsal', error);
    return res.status(500).json({ error: 'Failed to run local model draft adapter rehearsal' });
  }
});

router.post('/wiki/retrieval/promotions', async (req, res) => {
  try {
    if (req.body?.confirmPromotion !== true) {
      return res.status(400).json({
        error: 'Confirm promotion before writing a reviewed section into the Case Wiki.',
        policy: 'Promotion writes are human-confirmed and citation-gated.',
      });
    }

    const promotionRecord = buildConfirmedRetrievalPromotionRecord({
      query: readStringField(req.body, 'query'),
      promotionPreview: req.body?.promotionPreview,
      answerDraft: req.body?.answerDraft,
      actor: readStringField(req.body, 'actor') || 'Current worker',
    });

    if (promotionRecord.error) {
      return res.status(409).json({
        error: promotionRecord.error,
        blockedReasons: promotionRecord.blockedReasons,
        citationCoverageDiff: promotionRecord.citationCoverageDiff,
        policy: 'Only reviewed citations can be promoted into permanent wiki sections.',
      });
    }

    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const existingPromotion = Array.isArray(workspace.wikiPromotionRecords)
      ? workspace.wikiPromotionRecords.find((item) => item?.pageId === promotionRecord.pageId || item?.id === promotionRecord.id)
      : null;
    const graphPreview = buildRetrievalPromotionGraph({
      promotionRecord: existingPromotion
        ? {
            ...promotionRecord,
            id: existingPromotion.id,
            pageId: existingPromotion.pageId || promotionRecord.pageId,
            createdAt: existingPromotion.createdAt || promotionRecord.createdAt,
            createdBy: existingPromotion.createdBy || promotionRecord.createdBy,
            version: (Number(existingPromotion.version) || 1) + 1,
            revisionId: `revision:${existingPromotion.id}:${(Number(existingPromotion.version) || 1) + 1}`,
          }
        : {
            ...promotionRecord,
            version: 1,
            revisionId: `revision:${promotionRecord.id}:1`,
          },
      userId: req.user.id,
    });
    const neo4j = graphPreview ? await writeCaseWikiGraphToNeo4j(graphPreview) : { status: 'skipped', message: 'No graph built' };
    const storedPromotionRecord = applyRetrievalPromotionVersioning({
      existingPromotion,
      incomingPromotion: promotionRecord,
      neo4j,
    });
    const graph = buildRetrievalPromotionGraph({ promotionRecord: storedPromotionRecord, userId: req.user.id });
    const auditRecord = normalizeCaseWikiAuditRecord({
      id: `audit:${storedPromotionRecord.id}:${Date.now()}`,
      timestamp: storedPromotionRecord.updatedAt || storedPromotionRecord.createdAt,
      actor: readStringField(req.body, 'actor') || storedPromotionRecord.createdBy,
      action: existingPromotion ? 'updated promoted wiki topic' : 'promoted reviewed retrieval draft',
      object: storedPromotionRecord.title,
      source: 'Case Wiki',
      status: 'completed',
      detail: `${storedPromotionRecord.citationLedger.length} reviewed citation${storedPromotionRecord.citationLedger.length === 1 ? '' : 's'} promoted into ${storedPromotionRecord.pageId} as version ${storedPromotionRecord.version || 1}. Candidate evidence stayed out.`,
    });

    const nextWorkspace = {
      ...workspace,
      savedAt: new Date().toISOString(),
      wikiPromotionRecords: mergePromotionRecordsByPageId(workspace.wikiPromotionRecords, [storedPromotionRecord]),
      auditRecords: mergeWorkspaceRecordsById(workspace.auditRecords, [auditRecord]),
    };
    const record = await saveCaseManagementWorkspace(req.user.id, nextWorkspace);

    return res.status(200).json({
      promotionRecord: record.workspace.wikiPromotionRecords.find((item) => item.id === storedPromotionRecord.id) || storedPromotionRecord,
      generatedRecords: {
        auditRecords: [auditRecord],
      },
      neo4j,
      graph,
      policy:
        'This write stored a human-confirmed Case Wiki promotion backed by reviewed citations. It did not attach source documents to clients/cases, approve candidate chunks, write vectors, move files, or delete anything.',
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to promote reviewed retrieval draft', error);
    return res.status(500).json({ error: 'Failed to promote reviewed retrieval draft into the Case Wiki' });
  }
});

router.post('/wiki/retrieval/promotions/:promotionId/rollback', async (req, res) => {
  try {
    if (req.body?.confirmRollback !== true) {
      return res.status(400).json({
        error: 'Confirm rollback before restoring a prior Case Wiki promotion revision.',
        policy: 'Rollback writes are human-confirmed and preserve the current version in history.',
      });
    }

    const requestedId = asString(req.params.promotionId);
    const requestedRevisionId = readStringField(req.body, 'revisionId');
    if (!requestedId || !requestedRevisionId) {
      return res.status(400).json({
        error: 'Rollback needs both a promotion id and a revision id.',
        policy: 'Only saved promotion revisions can be restored.',
      });
    }

    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const promotions = Array.isArray(workspace.wikiPromotionRecords) ? workspace.wikiPromotionRecords : [];
    const promotionRecord = promotions.find(
      (item) => item?.id === requestedId || item?.pageId === requestedId || item?.revisionId === requestedId,
    );
    if (!promotionRecord) {
      return res.status(404).json({ error: 'Promoted Case Wiki topic not found.' });
    }

    const versionHistory = Array.isArray(promotionRecord.versionHistory) ? promotionRecord.versionHistory : [];
    const snapshot = versionHistory.find(
      (item) => item?.revisionId === requestedRevisionId || String(item?.version || '') === requestedRevisionId,
    );
    if (!snapshot) {
      return res.status(404).json({ error: 'Promotion revision not found for rollback.' });
    }

    const restoredPromotionRecord = rollbackRetrievalPromotionToSnapshot({
      promotionRecord,
      snapshot,
      actor: readStringField(req.body, 'actor') || 'Current worker',
    });
    if (restoredPromotionRecord.error) {
      return res.status(409).json({ error: restoredPromotionRecord.error });
    }

    const graph = buildRetrievalPromotionGraph({ promotionRecord: restoredPromotionRecord, userId: req.user.id });
    const neo4j = graph ? await writeCaseWikiGraphToNeo4j(graph) : { status: 'skipped', message: 'No graph built' };
    const promotionWithGraphStatus = {
      ...restoredPromotionRecord,
      neo4jStatus: neo4j.status,
      neo4jMessage: neo4j.message || neo4j.skippedReason || '',
    };
    const auditRecord = normalizeCaseWikiAuditRecord({
      id: `audit:${promotionRecord.id}:rollback:${Date.now()}`,
      timestamp: promotionWithGraphStatus.updatedAt,
      actor: promotionWithGraphStatus.rolledBackBy,
      action: 'rolled back promoted wiki topic',
      object: promotionWithGraphStatus.title,
      source: 'Case Wiki',
      status: 'completed',
      detail: `Restored ${promotionWithGraphStatus.pageId} from ${requestedRevisionId}; the replaced current version was kept in version history. No files, client attachments, or vectors were changed.`,
    });

    const nextWorkspace = {
      ...workspace,
      savedAt: new Date().toISOString(),
      wikiPromotionRecords: mergePromotionRecordsByPageId(workspace.wikiPromotionRecords, [promotionWithGraphStatus]),
      auditRecords: mergeWorkspaceRecordsById(workspace.auditRecords, [auditRecord]),
    };
    const record = await saveCaseManagementWorkspace(req.user.id, nextWorkspace);

    return res.status(200).json({
      promotionRecord:
        record.workspace.wikiPromotionRecords.find((item) => item.id === promotionWithGraphStatus.id) ||
        promotionWithGraphStatus,
      generatedRecords: {
        auditRecords: [auditRecord],
      },
      neo4j,
      graph,
      policy:
        'Rollback restored a prior human-confirmed Case Wiki promotion revision and preserved the replaced version in history. It did not attach source documents to clients/cases, approve candidate chunks, write vectors, move files, or delete anything.',
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to roll back promoted wiki topic', error);
    return res.status(500).json({ error: 'Failed to roll back promoted Case Wiki topic' });
  }
});

router.get('/wiki/graph/provenance-lenses', async (req, res) => {
  try {
    const records = await getCaseManagementProvenanceLenses(req.user.id);
    const requestedActor = String(req.query.actor || req.query.viewer || '').trim();
    const actor = requestedActor ? cleanProvenanceLensActor(requestedActor) : '';
    const visibleRecords = actor
      ? records.filter((record) => provenanceLensRecordCan(record, actor, 'viewer'))
      : records;
    return res.status(200).json({
      actor: actor || null,
      totalCount: records.length,
      visibleCount: visibleRecords.length,
      provenanceLenses: visibleRecords.map((record) => makeFrontendProvenanceLens(record, actor)).filter((lens) => lens.id),
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to load Case Wiki provenance lenses', error);
    return res.status(500).json({ error: 'Failed to load Case Wiki provenance lenses' });
  }
});

router.get('/wiki/graph/provenance-lenses/activity-export', async (req, res) => {
  try {
    const actor = cleanProvenanceLensActor(req.query.actor || req.query.viewer);
    const format = cleanProvenanceLensExportFormat(req.query.format || 'json');
    const records = await getCaseManagementProvenanceLenses(req.user.id);
    const managerRecords = records.filter((record) => provenanceLensRecordCan(record, actor, 'manager'));
    const exportBundle = buildProvenanceLensActivityExport({
      records: managerRecords,
      actor,
      format,
    });
    const filename = `case-wiki-provenance-lens-activity-${new Date().toISOString().slice(0, 10)}.${exportBundle.extension}`;
    const auditRecord = await createCaseManagementProvenanceLensExportAudit(req.user.id, {
      id: `provenance-lens-export-audit-${crypto.randomUUID()}`,
      actor,
      exportType: 'graph-provenance-lens-activity',
      format,
      filename,
      contentType: exportBundle.contentType,
      privacyNote: exportBundle.payload.privacyNote,
      lensCount: exportBundle.payload.lensCount,
      activityCount: exportBundle.payload.activityCount,
      visibleLensIds: managerRecords.map((record) => record.lensId || record.id || '').filter(Boolean),
      exportedAt: exportBundle.payload.exportedAt,
    });
    return res.status(200).json({
      export: exportBundle.payload,
      auditRecord: makeFrontendProvenanceLensExportAudit(auditRecord),
      content: exportBundle.content,
      contentType: exportBundle.contentType,
      filename,
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to export Case Wiki provenance lens activity', error);
    return res.status(500).json({ error: 'Failed to export Case Wiki provenance lens activity' });
  }
});

router.get('/wiki/graph/provenance-lenses/activity-export/audits', async (req, res) => {
  try {
    const rawLimit = Number(req.query.limit);
    const exportType = cleanProvenanceLensExportAuditType(req.query.exportType || 'all');
    const records = await getCaseManagementProvenanceLensExportAudits(
      req.user.id,
      Number.isFinite(rawLimit) ? rawLimit : 20,
      exportType,
    );
    return res.status(200).json({
      exportType,
      auditRecords: records.map(makeFrontendProvenanceLensExportAudit).filter((record) => record.id),
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to load Case Wiki provenance lens export audits', error);
    return res.status(500).json({ error: 'Failed to load Case Wiki provenance lens export audits' });
  }
});

router.get('/wiki/graph/provenance-lenses/activity-review-queue', async (req, res) => {
  try {
    const actor = cleanProvenanceLensActor(req.query.actor || req.query.viewer);
    const records = await getCaseManagementProvenanceLenses(req.user.id);
    return res.status(200).json({
      actor,
      reviewQueue: makeProvenanceLensActivityReviewQueue(records, actor),
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to load Case Wiki provenance lens activity review queue', error);
    return res.status(500).json({ error: 'Failed to load Case Wiki provenance lens activity review queue' });
  }
});

router.get('/wiki/graph/provenance-lenses/activity-backfill/repairs', async (req, res) => {
  try {
    const actor = cleanProvenanceLensActor(req.query.actor || req.query.viewer);
    const repairType = cleanProvenanceLensRepairType(req.query.repairType || 'all');
    const records = await getCaseManagementProvenanceLenses(req.user.id);
    return res.status(200).json({
      actor,
      repairType,
      repairLedger: makeProvenanceLensActivityRepairLedger(records, actor, repairType),
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to load Case Wiki provenance lens activity repair ledger', error);
    return res.status(500).json({ error: 'Failed to load Case Wiki provenance lens activity repair ledger' });
  }
});

router.get('/wiki/graph/provenance-lenses/activity-backfill/repairs/export', async (req, res) => {
  try {
    const actor = cleanProvenanceLensActor(req.query.actor || req.query.viewer);
    const repairType = cleanProvenanceLensRepairType(req.query.repairType || 'all');
    const format = cleanProvenanceLensExportFormat(req.query.format || 'json');
    const records = await getCaseManagementProvenanceLenses(req.user.id);
    const repairLedger = makeProvenanceLensActivityRepairLedger(records, actor, repairType);
    const exportBundle = buildProvenanceLensActivityRepairLedgerExport({
      repairLedger,
      actor,
      repairType,
      format,
    });
    const filename = `case-wiki-provenance-lens-repairs-${repairType}-${new Date().toISOString().slice(0, 10)}.${exportBundle.extension}`;
    const auditRecord = await createCaseManagementProvenanceLensExportAudit(req.user.id, {
      id: `provenance-lens-repair-export-audit-${crypto.randomUUID()}`,
      actor,
      exportType: 'graph-provenance-lens-activity-repair-ledger',
      format,
      filename,
      contentType: exportBundle.contentType,
      privacyNote: exportBundle.payload.privacyNote,
      lensCount: exportBundle.payload.lensCount,
      activityCount: exportBundle.payload.repairCount,
      visibleLensIds: Array.from(new Set(repairLedger.map((repair) => repair.lensId).filter(Boolean))),
      exportedAt: exportBundle.payload.exportedAt,
    });
    return res.status(200).json({
      export: exportBundle.payload,
      auditRecord: makeFrontendProvenanceLensExportAudit(auditRecord),
      content: exportBundle.content,
      contentType: exportBundle.contentType,
      filename,
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to export Case Wiki provenance lens activity repair ledger', error);
    return res.status(500).json({ error: 'Failed to export Case Wiki provenance lens activity repair ledger' });
  }
});

router.get('/wiki/graph/provenance-lenses/activity-inspections', async (req, res) => {
  try {
    const actor = cleanProvenanceLensActor(req.query.actor || req.query.viewer);
    const repairType = cleanProvenanceLensRepairType(req.query.repairType || 'all');
    const records = await getCaseManagementProvenanceLenses(req.user.id);
    return res.status(200).json({
      actor,
      repairType,
      inspectionLedger: makeProvenanceLensActivityInspectionLedger(records, actor, repairType),
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to load Case Wiki provenance lens repaired-edge inspections', error);
    return res.status(500).json({ error: 'Failed to load Case Wiki provenance lens repaired-edge inspections' });
  }
});

router.get('/wiki/graph/provenance-lenses/activity-inspections/summary', async (req, res) => {
  try {
    const actor = cleanProvenanceLensActor(req.query.actor || req.query.viewer);
    const repairType = cleanProvenanceLensRepairType(req.query.repairType || 'all');
    const records = await getCaseManagementProvenanceLenses(req.user.id);
    return res.status(200).json({
      inspectionSummary: makeProvenanceLensActivityInspectionSummary(records, actor, repairType),
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to summarize Case Wiki provenance lens repaired-edge inspections', error);
    return res.status(500).json({ error: 'Failed to summarize Case Wiki provenance lens repaired-edge inspections' });
  }
});

router.get('/wiki/graph/provenance-lenses/activity-inspections/workload', async (req, res) => {
  try {
    const actor = cleanProvenanceLensActor(req.query.actor || req.query.viewer);
    const repairType = cleanProvenanceLensRepairType(req.query.repairType || 'all');
    const records = await getCaseManagementProvenanceLenses(req.user.id);
    return res.status(200).json({
      inspectionWorkload: makeProvenanceLensActivityInspectionWorkload(records, actor, repairType),
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to build Case Wiki provenance lens inspection workload', error);
    return res.status(500).json({ error: 'Failed to build Case Wiki provenance lens inspection workload' });
  }
});

router.get('/wiki/graph/provenance-lenses/activity-inspections/export', async (req, res) => {
  try {
    const actor = cleanProvenanceLensActor(req.query.actor || req.query.viewer);
    const repairType = cleanProvenanceLensRepairType(req.query.repairType || 'all');
    const format = cleanProvenanceLensExportFormat(req.query.format || 'json');
    const records = await getCaseManagementProvenanceLenses(req.user.id);
    const inspectionLedger = makeProvenanceLensActivityInspectionLedger(records, actor, repairType);
    const exportBundle = buildProvenanceLensActivityInspectionExport({
      inspectionLedger,
      actor,
      repairType,
      format,
    });
    const filename = `case-wiki-provenance-lens-inspections-${repairType}-${new Date().toISOString().slice(0, 10)}.${exportBundle.extension}`;
    const auditRecord = await createCaseManagementProvenanceLensExportAudit(req.user.id, {
      id: `provenance-lens-inspection-export-audit-${crypto.randomUUID()}`,
      actor,
      exportType: 'graph-provenance-lens-activity-inspection',
      format,
      filename,
      contentType: exportBundle.contentType,
      privacyNote: exportBundle.payload.privacyNote,
      lensCount: exportBundle.payload.lensCount,
      activityCount: exportBundle.payload.inspectionCount,
      visibleLensIds: Array.from(new Set(inspectionLedger.map((inspection) => inspection.lensId).filter(Boolean))),
      exportedAt: exportBundle.payload.exportedAt,
    });
    return res.status(200).json({
      export: exportBundle.payload,
      auditRecord: makeFrontendProvenanceLensExportAudit(auditRecord),
      content: exportBundle.content,
      contentType: exportBundle.contentType,
      filename,
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to export Case Wiki provenance lens repaired-edge inspections', error);
    return res.status(500).json({ error: 'Failed to export Case Wiki provenance lens repaired-edge inspections' });
  }
});

router.get('/wiki/graph/provenance-lenses/activity-trails', async (req, res) => {
  try {
    const actor = cleanProvenanceLensActor(req.query.actor || req.query.viewer);
    const inspectionFilter = cleanProvenanceLensInspectionFilter(req.query.inspectionFilter || 'all');
    const records = await getCaseManagementProvenanceLenses(req.user.id);
    return res.status(200).json({
      activityTrailGraphLens: makeProvenanceLensActivityTrailGraphLens(records, actor, { inspectionFilter }),
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to load Case Wiki provenance lens activity trail graph', error);
    return res.status(500).json({ error: 'Failed to load Case Wiki provenance lens activity trail graph' });
  }
});

router.post('/wiki/graph/provenance-lenses/:lensId/activity-inspections', async (req, res) => {
  try {
    const existingRecord = await getCaseManagementProvenanceLens(req.user.id, req.params.lensId);
    if (!existingRecord) {
      return res.status(404).json({ error: 'Case Wiki provenance lens not found' });
    }
    const actor = cleanProvenanceLensActor(req.body?.actor || req.query.actor || existingRecord.createdBy);
    if (!provenanceLensRecordCan(existingRecord, actor, 'manager')) {
      return res.status(403).json({
        error: `${actor} needs manager access to record provenance lens edge inspections`,
      });
    }
    const inspectedActivityId = String(req.body?.activityId || req.body?.inspectedActivityId || '').trim();
    const result = await recordProvenanceLensRepairedEdgeInspection({
      userId: req.user.id,
      record: existingRecord,
      actor,
      inspectedActivityId,
      inspectedEdgeId: String(req.body?.edgeId || '').trim(),
      repairType: String(req.body?.repairType || '').trim(),
      reason: String(req.body?.reason || '').trim(),
      detail: String(req.body?.detail || '').trim(),
    });

    return res.status(200).json({
      provenanceLens: makeFrontendProvenanceLens(result.savedRecord, actor),
      inspectionActivity: result.inspectionActivity,
      repairedActivity: result.repairedActivity,
      activityTrailGraphLens: makeProvenanceLensActivityTrailGraphLens([result.savedRecord], actor),
      graph: result.graph,
      neo4j: result.neo4j,
      neo4jQuery: result.neo4jQuery,
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to record Case Wiki provenance lens edge inspection', error);
    return res.status(error.statusCode || 500).json({
      error: error.statusCode
        ? error.message
        : 'Failed to record Case Wiki provenance lens edge inspection',
    });
  }
});

router.post('/wiki/graph/provenance-lenses/activity-backfill/batch', async (req, res) => {
  try {
    const actor = cleanProvenanceLensActor(req.body?.actor || req.query.actor);
    const requestedLensIds = new Set(
      (Array.isArray(req.body?.lensIds) ? req.body.lensIds : [])
        .map((lensId) => String(lensId || '').trim())
        .filter(Boolean),
    );
    const records = await getCaseManagementProvenanceLenses(req.user.id);
    const reviewQueue = makeProvenanceLensActivityReviewQueue(records, actor);
    const queuedLensIds = new Set(reviewQueue.map((item) => item.lensId));
    const repairCandidates = records
      .filter((record) => provenanceLensRecordCan(record, actor, 'manager'))
      .filter((record) => queuedLensIds.has(record.lensId || record.id || ''))
      .filter((record) => !requestedLensIds.size || requestedLensIds.has(record.lensId || record.id || ''))
      .slice(0, 12);

    const results = [];
    const recordsById = new Map(records.map((record) => [record.lensId || record.id || '', record]));
    for (const record of repairCandidates) {
      const result = await backfillProvenanceLensActivityRecord({
        userId: req.user.id,
        record,
        actor,
      });
      results.push(result);
      recordsById.set(result.savedRecord.lensId || result.savedRecord.id || record.lensId || record.id || '', result.savedRecord);
    }

    const nextRecords = Array.from(recordsById.values());
    const repairedResults = results.filter((result) => !result.skipped);

    return res.status(200).json({
      actor,
      requestedCount: requestedLensIds.size || reviewQueue.length,
      candidateCount: repairCandidates.length,
      repairedCount: repairedResults.length,
      skippedCount: results.length - repairedResults.length,
      backfilledActivityCount: repairedResults.reduce(
        (total, result) => total + result.backfilledActivities.length,
        0,
      ),
      provenanceLenses: repairedResults
        .map((result) => makeFrontendProvenanceLens(result.savedRecord, actor))
        .filter((lens) => lens.id),
      repairLedger: makeProvenanceLensActivityRepairLedger(nextRecords, actor, req.body?.repairType || 'all'),
      reviewQueue: makeProvenanceLensActivityReviewQueue(nextRecords, actor),
      neo4jWrites: repairedResults.map((result) => result.neo4j),
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to batch backfill Case Wiki provenance lens activity', error);
    return res.status(error.statusCode || 500).json({
      error: error.statusCode
        ? error.message
        : 'Failed to batch backfill Case Wiki provenance lens activity',
    });
  }
});

router.post('/wiki/graph/provenance-lenses/:lensId/activity-backfill', async (req, res) => {
  try {
    const existingRecord = await getCaseManagementProvenanceLens(req.user.id, req.params.lensId);
    if (!existingRecord) {
      return res.status(404).json({ error: 'Case Wiki provenance lens not found' });
    }
    const actor = cleanProvenanceLensActor(req.body?.actor || req.query.actor || existingRecord.createdBy);
    if (!provenanceLensRecordCan(existingRecord, actor, 'manager')) {
      return res.status(403).json({
        error: `${actor} needs manager access to backfill provenance lens activity`,
      });
    }

    const result = await backfillProvenanceLensActivityRecord({
      userId: req.user.id,
      record: existingRecord,
      actor,
    });

    return res.status(200).json({
      provenanceLens: makeFrontendProvenanceLens(result.savedRecord, actor),
      backfilledActivities: result.backfilledActivities,
      repairLedger: makeProvenanceLensActivityRepairLedger([result.savedRecord], actor),
      reviewQueue: makeProvenanceLensActivityReviewQueue([result.savedRecord], actor),
      graph: result.graph,
      neo4j: result.neo4j,
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to backfill Case Wiki provenance lens activity', error);
    return res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : 'Failed to backfill Case Wiki provenance lens activity',
    });
  }
});

router.post('/wiki/graph/provenance-lenses', async (req, res) => {
  try {
    const lens = req.body?.lens;
    if (!lens || typeof lens !== 'object' || Array.isArray(lens)) {
      return res.status(400).json({ error: 'lens must be an object' });
    }
    const actor = cleanProvenanceLensActor(req.body?.actor || lens.actor || lens.updatedBy || lens.createdBy);
    const existingRecord = lens.id
      ? await getCaseManagementProvenanceLens(req.user.id, lens.id)
      : null;
    if (existingRecord && !provenanceLensRecordCan(existingRecord, actor, 'editor')) {
      return res.status(403).json({
        error: `${actor} needs editor access to update this provenance lens`,
      });
    }
    if (existingRecord && sharedProvenanceLensAccessChanged(existingRecord, lens) && !provenanceLensRecordCan(existingRecord, actor, 'manager')) {
      return res.status(403).json({
        error: `${actor} needs manager access to change provenance lens sharing`,
      });
    }

    const builtLensGraph = buildCaseWikiGraphProvenanceLensGraph({
      lens: {
        ...lens,
        createdBy: existingRecord?.createdBy || lens.createdBy || actor,
      },
      userId: req.user.id,
    });

    if (!builtLensGraph) {
      return res.status(400).json({ error: 'Choose a valid provenance lens before syncing it' });
    }

    const neo4j = await writeCaseWikiGraphToNeo4j(builtLensGraph.graph);
    const savedRecord = await saveCaseManagementProvenanceLens(req.user.id, {
      ...builtLensGraph.provenanceLens,
      neo4jNodeId: builtLensGraph.provenanceLens.nodeId,
      neo4jStatus: neo4j.status,
      neo4jMessage: neo4j.message || neo4j.skippedReason || '',
    });

    return res.status(200).json({
      provenanceLens: makeFrontendProvenanceLens(savedRecord),
      graph: builtLensGraph.graph,
      neo4j,
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to save Case Wiki provenance lens', error);
    return res.status(500).json({ error: 'Failed to save Case Wiki provenance lens' });
  }
});

router.delete('/wiki/graph/provenance-lenses/:lensId', async (req, res) => {
  try {
    const requestedActor = req.query.actor || req.body?.actor;
    const existingRecord = await getCaseManagementProvenanceLens(req.user.id, req.params.lensId);
    if (!existingRecord) {
      return res.status(404).json({ error: 'Case Wiki provenance lens not found' });
    }
    const actor = cleanProvenanceLensActor(requestedActor || existingRecord.createdBy);
    if (!provenanceLensRecordCan(existingRecord, actor, 'manager')) {
      return res.status(403).json({
        error: `${actor} needs manager access to delete this provenance lens`,
      });
    }
    const deleted = await deleteCaseManagementProvenanceLens(req.user.id, req.params.lensId);
    return res.status(200).json({
      provenanceLens: makeFrontendProvenanceLens(deleted),
      deleted: true,
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to delete Case Wiki provenance lens', error);
    return res.status(500).json({ error: 'Failed to delete Case Wiki provenance lens' });
  }
});

router.get('/wiki/graph/workspaces', async (req, res) => {
  try {
    const rawLimit = Number(req.query.limit);
    const graphWorkspaceBrowser = await queryCaseWikiGraphWorkspaces({
      userId: req.user.id,
      pageId: readStringField(req.query, 'pageId'),
      lifeDomainId: readStringField(req.query, 'lifeDomainId') || 'all',
      limit: Number.isFinite(rawLimit) ? rawLimit : undefined,
    });
    return res.status(200).json({ graphWorkspaceBrowser });
  } catch (error) {
    logger.error('[caseManagement] Failed to load Case Wiki graph workspaces', error);
    return res.status(500).json({ error: 'Failed to load Case Wiki graph workspaces' });
  }
});

router.post('/wiki/graph/workspaces', async (req, res) => {
  try {
    const workspace = req.body?.workspace;
    if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)) {
      return res.status(400).json({ error: 'workspace must be an object' });
    }

    const builtWorkspaceGraph = buildCaseWikiGraphWorkspaceGraph({
      workspace,
      userId: req.user.id,
      action: readStringField(req.body, 'action') || 'saved',
      pageId: readStringField(req.body, 'pageId'),
      lifeDomainId: readStringField(req.body, 'lifeDomainId'),
    });

    if (!builtWorkspaceGraph) {
      return res.status(400).json({ error: 'Choose a valid graph workspace before syncing to Neo4j' });
    }

    const neo4j = await writeCaseWikiGraphToNeo4j(builtWorkspaceGraph.graph);
    return res.status(200).json({
      graphWorkspace: {
        ...builtWorkspaceGraph.graphWorkspace,
        graphSummary: {
          nodeCount: builtWorkspaceGraph.graph.nodes.length,
          edgeCount: builtWorkspaceGraph.graph.edges.length,
        },
        neo4jStatus: neo4j.status,
        neo4jMessage: neo4j.message || neo4j.skippedReason || '',
      },
      graph: builtWorkspaceGraph.graph,
      neo4j,
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to sync Case Wiki graph workspace', error);
    return res.status(500).json({ error: 'Failed to sync Case Wiki graph workspace' });
  }
});

router.post('/wiki/graph/workspaces/reviews', async (req, res) => {
  try {
    const decision = req.body?.decision;
    if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
      return res.status(400).json({ error: 'decision must be an object' });
    }

    const builtReviewGraph = buildCaseWikiGraphWorkspaceReviewGraph({
      decision,
      userId: req.user.id,
    });

    if (!builtReviewGraph) {
      return res.status(400).json({ error: 'Choose a valid graph workspace audit before saving a review' });
    }

    const neo4j = await writeCaseWikiGraphToNeo4j(builtReviewGraph.graph);
    return res.status(200).json({
      graphWorkspaceReview: {
        ...builtReviewGraph.graphWorkspaceReview,
        graphSummary: {
          nodeCount: builtReviewGraph.graph.nodes.length,
          edgeCount: builtReviewGraph.graph.edges.length,
        },
        neo4jStatus: neo4j.status,
        neo4jMessage: neo4j.message || neo4j.skippedReason || '',
      },
      graph: builtReviewGraph.graph,
      neo4j,
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to sync Case Wiki graph workspace review', error);
    return res.status(500).json({ error: 'Failed to sync Case Wiki graph workspace review' });
  }
});

router.get('/wiki/ingestions/:fileId/graph', async (req, res) => {
  try {
    const ingestions = await getCaseManagementWikiIngestions(req.user.id);
    const ingestion = ingestions.find((item) => item.fileId === req.params.fileId);
    if (!ingestion) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }

    const graphBrowser = await buildCaseWikiGraphBrowser({ ingestion, allIngestions: ingestions });
    return res.status(200).json({ graphBrowser });
  } catch (error) {
    logger.error('[caseManagement] Failed to load Case Wiki graph browser', error);
    return res.status(500).json({ error: 'Failed to load Case Wiki graph browser' });
  }
});

router.get('/wiki/local-archive/config', async (_req, res) => {
  try {
    return res.status(200).json(await localArchiveConfig());
  } catch (error) {
    logger.error('[caseManagement] Failed to load local archive config', error);
    return res.status(500).json({ error: 'Failed to load local archive configuration' });
  }
});

router.patch('/wiki/local-archive/source-family-decisions/:candidateId', async (req, res) => {
  try {
    const candidateId = readStringField(req.params, 'candidateId');
    const action = readStringField(req.body, 'action');
    if (!candidateId || (action !== 'clear' && !localArchiveSourceFamilyDecisionActions.has(action))) {
      return res.status(400).json({ error: 'Choose a valid source-family review decision' });
    }

    const now = new Date().toISOString();
    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const existingDecisions =
      workspace.localArchiveSourceFamilyDecisions &&
      typeof workspace.localArchiveSourceFamilyDecisions === 'object' &&
      !Array.isArray(workspace.localArchiveSourceFamilyDecisions)
        ? workspace.localArchiveSourceFamilyDecisions
        : {};
    const nextDecisions = { ...existingDecisions };
    const candidate = req.body?.candidate && typeof req.body.candidate === 'object' ? req.body.candidate : {};
    const selectedIds = Array.isArray(req.body?.selectedIds)
      ? compactStringArray(req.body.selectedIds, WIKI_INGEST_FILE_LIMIT)
      : null;
    const decision =
      action === 'clear'
        ? null
        : normalizeLocalArchiveSourceFamilyDecision({
            decision: req.body?.decision,
            candidate,
            candidateId,
            action,
            now,
          });

    if (action !== 'clear' && !decision) {
      return res.status(400).json({ error: 'source-family decision must include a candidate id and review action' });
    }

    if (action === 'clear') {
      delete nextDecisions[candidateId];
    } else {
      nextDecisions[decision.candidateId] = decision;
    }

    const label =
      decision?.label ||
      asString(req.body?.label) ||
      asString(candidate.suggestedWikiTitle) ||
      asString(candidate.fileName) ||
      candidateId;
    const ledgerRecord = buildLocalArchiveSourceFamilyLedgerRecord({
      decision,
      candidateId,
      action,
      label,
      userId: req.user.id,
      now,
    });
    const auditRecord = normalizeCaseWikiAuditRecord({
      id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      actor: 'Case Wiki source-family review',
      action:
        action === 'clear'
          ? 'cleared source-family review decision'
          : `reviewed source-family match as ${action.replace(/-/g, ' ')}`,
      object: label,
      timestamp: now,
      category: 'case-wiki-local-archive',
      kind: 'source-family-review',
      status: action === 'clear' ? 'cleared' : 'reviewed',
      decision: action,
      detail:
        action === 'clear'
          ? `Candidate ${candidateId} was returned to source-family review. No graph, vector, attachment, promotion, deletion, or file move was performed.`
          : `Candidate ${candidateId} was saved as ${action.replace(/-/g, ' ')}${
              decision?.canonicalSource?.sourceLabel ? ` against ${decision.canonicalSource.sourceLabel}` : ''
            }. This is graph-ready review metadata only; vectors, attachments, promotions, deletions, and file moves stayed off.`,
    });
    const existingCampaign =
      workspace.localArchiveCampaign &&
      typeof workspace.localArchiveCampaign === 'object' &&
      !Array.isArray(workspace.localArchiveCampaign)
        ? workspace.localArchiveCampaign
        : null;
    const nextCampaign =
      selectedIds && existingCampaign
        ? {
            ...existingCampaign,
            selectedIds,
            updatedAt: now,
          }
        : existingCampaign;
    const nextWorkspace = {
      ...workspace,
      savedAt: now,
      localArchiveSourceFamilyDecisions: nextDecisions,
      ...(selectedIds ? { localArchiveSelectedIds: selectedIds } : {}),
      ...(nextCampaign ? { localArchiveCampaign: nextCampaign } : {}),
      localArchiveSourceFamilyReviewLedger: [
        ...(ledgerRecord ? [ledgerRecord] : []),
        ...(Array.isArray(workspace.localArchiveSourceFamilyReviewLedger)
          ? workspace.localArchiveSourceFamilyReviewLedger
          : []),
      ].slice(0, 300),
      auditRecords: [
        auditRecord,
        ...(Array.isArray(workspace.auditRecords) ? workspace.auditRecords : []),
      ].slice(0, 500),
    };

    const record = await saveCaseManagementWorkspace(req.user.id, nextWorkspace);
    return res.status(200).json({
      localArchiveSourceFamilyDecisions: record.workspace.localArchiveSourceFamilyDecisions || {},
      localArchiveSourceFamilyReviewLedger: record.workspace.localArchiveSourceFamilyReviewLedger || [],
      localArchiveSelectedIds: record.workspace.localArchiveSelectedIds || [],
      localArchiveCampaign: record.workspace.localArchiveCampaign || null,
      auditRecord,
      ledgerRecord,
      workspaceSaved: true,
      policy:
        'Source-family decisions are saved as review metadata only. This endpoint does not write vectors, attach files to clients or cases, promote wiki articles, move local files, or delete anything.',
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to persist local archive source-family decision', error);
    return res.status(500).json({ error: 'Failed to save source-family review decision' });
  }
});

router.post('/wiki/local-archive/source-family-decisions/graph-review-batch', async (req, res) => {
  try {
    const rawLimit = Number(req.body?.limit);
    const limit = Math.min(50, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 25));
    const includeSynced = req.body?.includeSynced === true;
    const now = new Date().toISOString();
    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const { savedDecisions, ledger, records, totalReviewCount } =
      collectLocalArchiveSourceFamilyGraphReviewRecords({
        workspace,
        userId: req.user.id,
        now,
        includeSynced,
        limit,
      });

    if (!records.length) {
      return res.status(200).json({
        syncedCount: 0,
        skippedCount: totalReviewCount,
        localArchiveSourceFamilyDecisions: savedDecisions,
        localArchiveSourceFamilyReviewLedger: ledger,
        graph: { nodes: [], edges: [] },
        neo4j: {
          status: 'skipped',
          skippedReason: includeSynced
            ? 'No saved source-family review decisions are ready for graph sync.'
            : 'No unsynced source-family review decisions are waiting for Neo4j.',
          nodeCount: 0,
          edgeCount: 0,
        },
        policy:
          'Batch source-family graph review sync writes reviewed metadata into Neo4j only. It does not write vectors, attach documents, promote article text, move files, or delete anything.',
      });
    }

    const builtReviewGraphs = records
      .map((decisionRecord) => ({
        decisionRecord,
        builtReviewGraph: buildCaseWikiLocalArchiveSourceFamilyDecisionGraph({
          decisionRecord,
          userId: req.user.id,
        }),
      }))
      .filter((item) => item.builtReviewGraph?.graph?.nodes?.length);

    const graph = mergeCaseWikiGraphs(builtReviewGraphs.map((item) => item.builtReviewGraph.graph));
    const neo4j = graph.nodes.length
      ? await writeCaseWikiGraphToNeo4j(graph)
      : {
          status: 'skipped',
          skippedReason: 'No valid source-family review graph records were produced.',
          nodeCount: 0,
          edgeCount: 0,
        };
    const neo4jMessage = neo4j.message || neo4j.skippedReason || '';
    const syncedAt = now;
    const syncedLedgerRecords = builtReviewGraphs.map(({ decisionRecord, builtReviewGraph }) => ({
      ...decisionRecord,
      graphWrite: neo4j.status === 'written',
      neo4jStatus: neo4j.status,
      neo4jMessage,
      neo4jNodeCount: builtReviewGraph.graph.nodes.length,
      neo4jEdgeCount: builtReviewGraph.graph.edges.length,
      graphSyncedAt: syncedAt,
      graphNodeId: builtReviewGraph.sourceFamilyDecision.nodeId,
    }));
    const syncedCandidateIds = new Set(
      syncedLedgerRecords.map((record) => asString(record?.candidateId)).filter(Boolean),
    );
    const syncedLedgerIds = new Set(
      syncedLedgerRecords.map((record) => asString(record?.id)).filter(Boolean),
    );
    const nextSourceFamilyDecisions = { ...savedDecisions };
    syncedLedgerRecords.forEach((record) => {
      const candidateId = asString(record?.candidateId);
      if (!candidateId) return;
      nextSourceFamilyDecisions[candidateId] = {
        ...(nextSourceFamilyDecisions[candidateId] || {
          candidateId,
          action: record.action,
          label: record.label,
          decidedAt: record.decidedAt || record.savedAt || syncedAt,
          canonicalSource: record.canonicalSource || undefined,
          canonicalLineageId: record.canonicalLineageId || undefined,
          note: record.note || undefined,
        }),
        graphWrite: neo4j.status === 'written',
        neo4jStatus: neo4j.status,
        neo4jMessage,
        graphSyncedAt: syncedAt,
        graphNodeId: record.graphNodeId,
      };
    });

    const nextLedger = [
      ...syncedLedgerRecords,
      ...ledger.filter((record) => {
        const candidateId = asString(record?.candidateId);
        const ledgerId = asString(record?.id);
        return !syncedCandidateIds.has(candidateId) && !syncedLedgerIds.has(ledgerId);
      }),
    ].slice(0, 300);
    const auditRecord = normalizeCaseWikiAuditRecord({
      id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      actor: 'Case Wiki source-family graph sync',
      action:
        neo4j.status === 'written'
          ? 'batch synced source-family review decisions to Neo4j'
          : 'attempted batch source-family review graph sync',
      object: `${syncedLedgerRecords.length} source-family review decision${
        syncedLedgerRecords.length === 1 ? '' : 's'
      }`,
      timestamp: now,
      category: 'case-wiki-local-archive',
      kind: 'source-family-graph-review-batch',
      status: neo4j.status,
      decision: 'batch-source-family-review',
      detail: `${graph.nodes.length} node${graph.nodes.length === 1 ? '' : 's'} and ${graph.edges.length} edge${
        graph.edges.length === 1 ? '' : 's'
      } prepared for Neo4j across ${syncedLedgerRecords.length} reviewed source-family decision${
        syncedLedgerRecords.length === 1 ? '' : 's'
      }. ${neo4jMessage || 'Graph sync completed.'}`,
    });
    const nextWorkspace = {
      ...workspace,
      savedAt: now,
      localArchiveSourceFamilyDecisions: nextSourceFamilyDecisions,
      localArchiveSourceFamilyReviewLedger: nextLedger,
      auditRecords: [
        auditRecord,
        ...(Array.isArray(workspace.auditRecords) ? workspace.auditRecords : []),
      ].slice(0, 500),
    };
    const record = await saveCaseManagementWorkspace(req.user.id, nextWorkspace);
    return res.status(200).json({
      syncedCount: syncedLedgerRecords.length,
      skippedCount: Math.max(0, records.length - syncedLedgerRecords.length),
      ledgerRecords: syncedLedgerRecords,
      localArchiveSourceFamilyDecisions: record.workspace.localArchiveSourceFamilyDecisions || {},
      localArchiveSourceFamilyReviewLedger: record.workspace.localArchiveSourceFamilyReviewLedger || [],
      auditRecord,
      graph,
      neo4j,
      policy:
        'Batch source-family graph review sync writes reviewed metadata into Neo4j only. It does not write Weaviate vectors, attach documents, promote source text, move local files, or delete anything.',
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to batch sync local archive source-family decision graphs', error);
    return res.status(500).json({ error: 'Failed to batch sync source-family review graphs' });
  }
});

router.post('/wiki/local-archive/source-family-decisions/:candidateId/graph-review', async (req, res) => {
  try {
    const candidateId = readStringField(req.params, 'candidateId');
    if (!candidateId) {
      return res.status(400).json({ error: 'Choose a valid source-family review candidate' });
    }

    const now = new Date().toISOString();
    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const savedDecisions =
      workspace.localArchiveSourceFamilyDecisions &&
      typeof workspace.localArchiveSourceFamilyDecisions === 'object' &&
      !Array.isArray(workspace.localArchiveSourceFamilyDecisions)
        ? workspace.localArchiveSourceFamilyDecisions
        : {};
    const ledger = Array.isArray(workspace.localArchiveSourceFamilyReviewLedger)
      ? workspace.localArchiveSourceFamilyReviewLedger
      : [];
    const existingLedgerRecord = ledger.find((record) => asString(record?.candidateId) === candidateId);
    const savedDecision = savedDecisions[candidateId];
    const fallbackLedgerRecord = savedDecision
      ? buildLocalArchiveSourceFamilyLedgerRecord({
          decision: savedDecision,
          candidateId,
          action: savedDecision.action,
          label: savedDecision.label,
          userId: req.user.id,
          now,
        })
      : null;
    const decisionRecord = existingLedgerRecord || fallbackLedgerRecord;
    if (!decisionRecord || decisionRecord.action === 'clear') {
      return res.status(404).json({
        error: 'Save a merge, keep-separate, or duplicate rejection decision before syncing it to Neo4j',
      });
    }

    const builtReviewGraph = buildCaseWikiLocalArchiveSourceFamilyDecisionGraph({
      decisionRecord,
      userId: req.user.id,
    });
    if (!builtReviewGraph) {
      return res.status(400).json({ error: 'Choose a valid source-family review decision before syncing to Neo4j' });
    }

    const neo4j = await writeCaseWikiGraphToNeo4j(builtReviewGraph.graph);
    const syncedLedgerRecord = {
      ...decisionRecord,
      graphWrite: neo4j.status === 'written',
      neo4jStatus: neo4j.status,
      neo4jMessage: neo4j.message || neo4j.skippedReason || '',
      neo4jNodeCount: neo4j.nodeCount || builtReviewGraph.graph.nodes.length,
      neo4jEdgeCount: neo4j.edgeCount || builtReviewGraph.graph.edges.length,
      graphSyncedAt: now,
      graphNodeId: builtReviewGraph.sourceFamilyDecision.nodeId,
    };
    const nextSourceFamilyDecisions = {
      ...savedDecisions,
      ...(savedDecisions[candidateId]
        ? {
            [candidateId]: {
              ...savedDecisions[candidateId],
              graphWrite: neo4j.status === 'written',
              neo4jStatus: neo4j.status,
              neo4jMessage: neo4j.message || neo4j.skippedReason || '',
              graphSyncedAt: now,
              graphNodeId: builtReviewGraph.sourceFamilyDecision.nodeId,
            },
          }
        : {}),
    };
    const nextLedger = [
      syncedLedgerRecord,
      ...ledger.filter(
        (record) =>
          asString(record?.id) !== asString(decisionRecord.id) &&
          asString(record?.candidateId) !== candidateId,
      ),
    ].slice(0, 300);
    const auditRecord = normalizeCaseWikiAuditRecord({
      id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      actor: 'Case Wiki source-family graph sync',
      action:
        neo4j.status === 'written'
          ? 'synced source-family review decision to Neo4j'
          : 'attempted source-family review graph sync',
      object: decisionRecord.label || candidateId,
      timestamp: now,
      category: 'case-wiki-local-archive',
      kind: 'source-family-graph-review',
      status: neo4j.status,
      decision: decisionRecord.action,
      detail: `${builtReviewGraph.graph.nodes.length} node${builtReviewGraph.graph.nodes.length === 1 ? '' : 's'} and ${builtReviewGraph.graph.edges.length} edge${builtReviewGraph.graph.edges.length === 1 ? '' : 's'} prepared for Neo4j. ${neo4j.message || neo4j.skippedReason || 'Graph sync completed.'}`,
    });
    const nextWorkspace = {
      ...workspace,
      savedAt: now,
      localArchiveSourceFamilyDecisions: nextSourceFamilyDecisions,
      localArchiveSourceFamilyReviewLedger: nextLedger,
      auditRecords: [
        auditRecord,
        ...(Array.isArray(workspace.auditRecords) ? workspace.auditRecords : []),
      ].slice(0, 500),
    };
    const record = await saveCaseManagementWorkspace(req.user.id, nextWorkspace);
    return res.status(200).json({
      sourceFamilyDecision: {
        ...builtReviewGraph.sourceFamilyDecision,
        graphSummary: {
          nodeCount: builtReviewGraph.graph.nodes.length,
          edgeCount: builtReviewGraph.graph.edges.length,
        },
        neo4jStatus: neo4j.status,
        neo4jMessage: neo4j.message || neo4j.skippedReason || '',
      },
      ledgerRecord: syncedLedgerRecord,
      localArchiveSourceFamilyDecisions: record.workspace.localArchiveSourceFamilyDecisions || {},
      localArchiveSourceFamilyReviewLedger: record.workspace.localArchiveSourceFamilyReviewLedger || [],
      auditRecord,
      graph: builtReviewGraph.graph,
      neo4j,
      policy:
        'This endpoint syncs reviewed source-family metadata into Neo4j only. It does not write Weaviate vectors, attach documents, promote source text, move files, or delete anything.',
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to sync local archive source-family decision graph', error);
    return res.status(500).json({ error: 'Failed to sync source-family review graph' });
  }
});

router.post('/wiki/local-archive/campaign-schedule', async (req, res) => {
  try {
    const schedule = buildLocalArchiveCampaignSchedule({
      currentCampaign: req.body?.currentCampaign,
      checkpoints: Array.isArray(req.body?.checkpoints) ? req.body.checkpoints : [],
      laneTemplates: Array.isArray(req.body?.laneTemplates) ? req.body.laneTemplates : [],
      activeJob: req.body?.activeJob || null,
    });

    const auditRecord = normalizeCaseWikiAuditRecord({
      id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      actor: 'Case Wiki campaign scheduler',
      action: 'previewed whole-life campaign schedule',
      object: schedule.nextAction,
      timestamp: schedule.generatedAt,
      category: 'case-wiki-local-archive',
      kind: 'campaign-schedule',
      status: schedule.scheduleStatus,
      detail: `${schedule.laneCount} lane${schedule.laneCount === 1 ? '' : 's'} planned · ${schedule.totalSelectedSources} selected · ${schedule.totalReviewSources} need review · ${schedule.totalBlockedSources} quarantined.`,
    });

    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const nextWorkspace = {
      ...workspace,
      localArchiveCampaignSchedule: schedule,
      auditRecords: [
        auditRecord,
        ...(Array.isArray(workspace.auditRecords) ? workspace.auditRecords : []),
      ].slice(0, 500),
    };
    await saveCaseManagementWorkspace(req.user.id, nextWorkspace);

    return res.status(201).json({
      schedule,
      auditRecord,
      workspaceSaved: true,
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to create local archive campaign schedule', error);
    return res.status(500).json({ error: 'Failed to create local archive campaign schedule' });
  }
});

router.post('/wiki/local-archive/campaign-runner/next', async (req, res) => {
  try {
    const schedule = buildLocalArchiveCampaignSchedule({
      currentCampaign: req.body?.currentCampaign,
      checkpoints: Array.isArray(req.body?.checkpoints) ? req.body.checkpoints : [],
      laneTemplates: Array.isArray(req.body?.laneTemplates) ? req.body.laneTemplates : [],
      activeJob: req.body?.activeJob || null,
    });
    const nextLane =
      schedule.lanes.find((lane) => lane.id === schedule.nextLaneId) ||
      [...schedule.lanes].sort((left, right) => right.priorityScore - left.priorityScore)[0] ||
      null;
    const execute = req.body?.execute === true;
    const selectedFiles = selectedLocalArchiveFilesFromRequest(req.body?.selectedFiles);
    const directIngestBlockers = getLocalArchiveDirectIngestBlockers(selectedFiles);
    const now = new Date().toISOString();
    let job = null;
    let actionExecution = {
      type: 'no-ready-lane',
      status: 'blocked',
      message: 'No campaign lane is ready to run yet. Preview or scan the campaign first.',
    };

    if (nextLane) {
      actionExecution = {
        type: 'client-action-required',
        status: 'ready',
        laneId: nextLane.id,
        laneName: nextLane.name,
        action: nextLane.nextAction,
        message: nextLane.nextAction,
      };

      if (nextLane.nextAction === 'Resume paused background ingest') {
        const activeJobId = req.body?.activeJob?.jobId || req.body?.currentCampaign?.activeJobId || '';
        const existingJob = activeJobId ? await getCaseManagementWikiIngestJob(req.user.id, activeJobId) : null;
        if (!existingJob) {
          actionExecution = {
            type: 'job-not-found',
            status: 'blocked',
            laneId: nextLane.id,
            laneName: nextLane.name,
            message: 'The paused background job could not be found. Refresh the campaign job ledger.',
          };
        } else if (execute && existingJob.status === 'paused') {
          const items = normalizeJob(existingJob).items.map((item) =>
            item.status === 'processing' ? { ...item, status: 'queued', resumedAt: now } : item,
          );
          const updatedJob = await updateCaseManagementWikiIngestJob(req.user.id, activeJobId, {
            $set: { status: 'queued', items },
          });
          setImmediate(() => processWikiIngestJob(updatedJob));
          job = makeJobSnapshot(updatedJob);
          actionExecution = {
            type: 'job-resumed',
            status: 'running',
            laneId: nextLane.id,
            laneName: nextLane.name,
            jobId: job.jobId,
            message: `Resumed background ingest job ${job.jobId.slice(0, 8)}.`,
          };
        } else {
          job = makeJobSnapshot(existingJob, { includeArtifacts: false });
          actionExecution = {
            type: 'job-resume-ready',
            status: existingJob.status === 'paused' ? 'ready' : existingJob.status,
            laneId: nextLane.id,
            laneName: nextLane.name,
            jobId: job.jobId,
            message:
              existingJob.status === 'paused'
                ? 'Paused job is ready to resume from the server runner.'
                : `Job is ${existingJob.status}; no resume action was needed.`,
          };
        }
      } else if (nextLane.nextAction === 'Monitor active background ingest') {
        const activeJobId = req.body?.activeJob?.jobId || req.body?.currentCampaign?.activeJobId || '';
        const existingJob = activeJobId ? await getCaseManagementWikiIngestJob(req.user.id, activeJobId) : null;
        job = existingJob ? makeJobSnapshot(existingJob, { includeArtifacts: false }) : null;
        actionExecution = {
          type: 'job-monitor',
          status: job?.status || nextLane.activeJobStatus || 'processing',
          laneId: nextLane.id,
          laneName: nextLane.name,
          jobId: job?.jobId || activeJobId,
          message: job
            ? `Monitoring background ingest job ${job.jobId.slice(0, 8)}.`
            : 'The campaign says a job is active, but the runner could not load the saved job yet.',
        };
      } else if (nextLane.nextAction === 'Start background ingest for selected sources') {
        if (!selectedFiles.length) {
          actionExecution = {
            type: 'selection-required',
            status: 'blocked',
            laneId: nextLane.id,
            laneName: nextLane.name,
            message: 'Select source files before the server runner starts a background ingest job.',
          };
        } else if (directIngestBlockers.length) {
          actionExecution = {
            type: 'review-required',
            status: 'blocked',
            laneId: nextLane.id,
            laneName: nextLane.name,
            selectedCount: selectedFiles.length,
            blockedCount: directIngestBlockers.length,
            blockers: directIngestBlockers.slice(0, 12).map((item) => ({
              fileName: item.file.fileName || '',
              relativePath: item.file.relativePath || '',
              reason: item.reason,
            })),
            message: `${directIngestBlockers.length} selected source${directIngestBlockers.length === 1 ? '' : 's'} need review before extraction: ${summarizeLocalArchiveDirectIngestBlockers(directIngestBlockers)}.`,
          };
        } else if (execute) {
          const savedJob = await createLocalArchiveIngestJob({
            userId: req.user.id,
            files: selectedFiles,
            context: {
              ...(req.body?.context || {}),
              sourceScope: 'standalone',
              privacyLevel: req.body?.context?.privacyLevel || 'personal',
              redactionMode: req.body?.context?.redactionMode || 'strict',
              retentionPolicy: req.body?.context?.retentionPolicy || 'review-source',
            },
            campaign: {
              ...(req.body?.currentCampaign || {}),
              runner: true,
            },
          });
          job = makeJobSnapshot(savedJob);
          actionExecution = {
            type: 'job-started',
            status: 'queued',
            laneId: nextLane.id,
            laneName: nextLane.name,
            jobId: job.jobId,
            message: `Started server-owned background ingest job ${job.jobId.slice(0, 8)} for ${selectedFiles.length} selected source${selectedFiles.length === 1 ? '' : 's'}.`,
          };
        } else {
          actionExecution = {
            type: 'job-start-ready',
            status: 'ready',
            laneId: nextLane.id,
            laneName: nextLane.name,
            selectedCount: selectedFiles.length,
            message: `${selectedFiles.length} selected source${selectedFiles.length === 1 ? '' : 's'} are ready for the server runner.`,
          };
        }
      } else if (nextLane.nextAction === 'Open review queue before embedding') {
        actionExecution = {
          type: 'review-required',
          status: 'blocked',
          laneId: nextLane.id,
          laneName: nextLane.name,
          message: 'Human review is required before attachment or embedding.',
        };
      } else if (nextLane.nextAction === 'Select a guided source pass') {
        actionExecution = {
          type: 'selection-required',
          status: 'blocked',
          laneId: nextLane.id,
          laneName: nextLane.name,
          message: 'Choose a guided source pass before the runner starts ingest.',
        };
      } else if (nextLane.nextAction === 'Scan computer archive for this lane') {
        actionExecution = {
          type: 'scan-required',
          status: 'blocked',
          laneId: nextLane.id,
          laneName: nextLane.name,
          message: 'Scan the computer archive for this lane before the runner can start a job.',
        };
      }
    }

    const auditRecord = normalizeCaseWikiAuditRecord({
      id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      actor: 'Case Wiki campaign runner',
      action:
        actionExecution.type === 'job-started'
          ? 'started whole-life campaign runner job'
          : actionExecution.type === 'job-resumed'
            ? 'resumed whole-life campaign runner job'
            : 'evaluated whole-life campaign runner next step',
      object: actionExecution.message,
      timestamp: now,
      category: 'case-wiki-local-archive',
      kind: 'campaign-runner',
      status: actionExecution.status,
      detail: `${actionExecution.type}${nextLane ? ` · ${nextLane.name}` : ''}. Weaviate writes remain blocked until chunk review approval.`,
    });

    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const nextWorkspace = {
      ...workspace,
      localArchiveCampaignSchedule: schedule,
      localArchiveCampaignRunner: {
        lastRunAt: now,
        lastAction: actionExecution,
        activeJobId: job?.jobId || actionExecution.jobId || req.body?.currentCampaign?.activeJobId || '',
        mode: 'source-first-server-runner',
        vectorGate: 'Weaviate writes stay blocked until chunk review approval',
      },
      auditRecords: [
        auditRecord,
        ...(Array.isArray(workspace.auditRecords) ? workspace.auditRecords : []),
      ].slice(0, 500),
    };
    await saveCaseManagementWorkspace(req.user.id, nextWorkspace);

    return res.status(actionExecution.type === 'job-started' || actionExecution.type === 'job-resumed' ? 202 : 200).json({
      schedule,
      actionExecution,
      job,
      auditRecord,
      workspaceSaved: true,
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to run local archive campaign next step', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to run local archive campaign next step' });
  }
});

router.post('/wiki/local-archive/campaign-automation/due', async (req, res) => {
  try {
    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const result = await evaluateLocalArchiveCampaignAutomation({
      userId: req.user.id,
      workspace,
      automationInput: req.body?.automation || {},
      currentCampaign: req.body?.currentCampaign,
      checkpoints: Array.isArray(req.body?.checkpoints) ? req.body.checkpoints : [],
      laneTemplates: Array.isArray(req.body?.laneTemplates) ? req.body.laneTemplates : [],
      activeJob: req.body?.activeJob || null,
      selectedFiles: selectedLocalArchiveFilesFromRequest(req.body?.selectedFiles),
      context: req.body?.context || {},
      execute: req.body?.execute === true,
      force: req.body?.force === true,
      source: 'page',
    });
    return res.status(result.statusCode).json(result);
  } catch (error) {
    logger.error('[caseManagement] Failed to evaluate local archive campaign automation', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to evaluate local archive campaign automation' });
  }
});

router.post('/wiki/local-archive/campaign-automation/server-tick', async (req, res) => {
  try {
    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const activeJobId = asString(workspace.localArchiveCampaign?.activeJobId);
    const activeJob = activeJobId
      ? await getCaseManagementWikiIngestJob(req.user.id, activeJobId)
      : null;
    const result = await evaluateLocalArchiveCampaignAutomation({
      userId: req.user.id,
      workspace,
      automationInput: workspace.localArchiveCampaignAutomation || {},
      currentCampaign: workspace.localArchiveCampaign || null,
      checkpoints: Array.isArray(workspace.localArchiveCampaigns) ? workspace.localArchiveCampaigns : [],
      laneTemplates: localArchiveCampaignLaneTemplates,
      activeJob: activeJob ? makeJobSnapshot(activeJob, { includeArtifacts: false }) : null,
      selectedFiles: selectedLocalArchiveFilesFromWorkspace(workspace),
      context: {
        sourceScope: 'standalone',
        privacyLevel: 'personal',
        redactionMode: 'strict',
        retentionPolicy: 'review-source',
        serverTick: true,
      },
      execute: req.body?.execute === true,
      force: req.body?.force === true,
      source: 'server-tick',
    });
    return res.status(result.statusCode).json({
      ...result,
      source: 'server-saved-workspace',
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to run local archive campaign automation server tick', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to run local archive campaign automation server tick' });
  }
});

router.post('/wiki/local-archive/campaign-automation/confirm-selected-sources', async (req, res) => {
  try {
    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const selectedFiles = selectedLocalArchiveFilesFromWorkspace(workspace);
    if (!selectedFiles.length) {
      return res.status(400).json({
        error: 'No saved selected source files are available to confirm.',
      });
    }
    const now = new Date().toISOString();
    const selectedSourceSignature = selectedLocalArchiveFilesConfirmationSignature(selectedFiles);
    const automation = normalizeLocalArchiveCampaignAutomation(workspace.localArchiveCampaignAutomation || {});
    const nextAutomation = {
      ...automation,
      requireReviewBeforeRun: true,
      selectedSourceConfirmation: {
        signature: selectedSourceSignature,
        count: selectedFiles.length,
        confirmedAt: now,
        source: 'saved-workspace-operator',
        confirmedBy: req.user.id,
      },
    };
    const auditRecord = normalizeCaseWikiAuditRecord({
      id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      actor: 'Case Wiki campaign automation',
      action: 'confirmed whole-life daemon selected sources',
      object: `${selectedFiles.length} saved selected source${selectedFiles.length === 1 ? '' : 's'} confirmed for review-before-run automation.`,
      timestamp: now,
      category: 'case-wiki-local-archive',
      kind: 'campaign-automation',
      status: 'confirmed',
      detail: `Selected-source confirmation ${selectedSourceSignature}. Weaviate writes remain review-gated.`,
    });
    const nextWorkspace = {
      ...workspace,
      localArchiveCampaignAutomation: nextAutomation,
      auditRecords: [
        auditRecord,
        ...(Array.isArray(workspace.auditRecords) ? workspace.auditRecords : []),
      ].slice(0, 500),
    };
    await saveCaseManagementWorkspace(req.user.id, nextWorkspace);
    const activeJobId = asString(workspace.localArchiveCampaign?.activeJobId);
    const activeJob = activeJobId
      ? await getCaseManagementWikiIngestJob(req.user.id, activeJobId)
      : null;
    const queue = buildLocalArchiveCampaignDaemonQueue({
      workspace: nextWorkspace,
      activeJob: activeJob ? makeJobSnapshot(activeJob, { includeArtifacts: false }) : null,
      selectedFiles,
      force: true,
    });
    return res.status(200).json({
      automation: nextAutomation,
      auditRecord,
      queue,
      selectedFileCount: selectedFiles.length,
      selectedSourceSignature,
      workspaceSaved: true,
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to confirm local archive campaign selected sources', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to confirm selected source files' });
  }
});

router.post('/wiki/local-archive/campaign-automation/daemon-queue', async (req, res) => {
  try {
    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const activeJobId = asString(workspace.localArchiveCampaign?.activeJobId);
    const activeJob = activeJobId
      ? await getCaseManagementWikiIngestJob(req.user.id, activeJobId)
      : null;
    const selectedFiles = selectedLocalArchiveFilesFromWorkspace(workspace);
    const queue = buildLocalArchiveCampaignDaemonQueue({
      workspace,
      activeJob: activeJob ? makeJobSnapshot(activeJob, { includeArtifacts: false }) : null,
      selectedFiles,
      force: req.body?.force === true,
    });
    return res.status(200).json({
      queue,
      source: 'server-saved-workspace-daemon-queue',
      selectedFileCount: selectedFiles.length,
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to build local archive campaign daemon queue', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to build local archive campaign daemon queue' });
  }
});

router.post('/wiki/local-archive/campaign-automation/daemon/rehearsal', async (req, res) => {
  try {
    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const activeJobId = asString(workspace.localArchiveCampaign?.activeJobId);
    const activeJob = activeJobId
      ? await getCaseManagementWikiIngestJob(req.user.id, activeJobId)
      : null;
    const selectedFiles = selectedLocalArchiveFilesFromWorkspace(workspace);
    const queue = buildLocalArchiveCampaignDaemonQueue({
      workspace,
      activeJob: activeJob ? makeJobSnapshot(activeJob, { includeArtifacts: false }) : null,
      selectedFiles,
      force: true,
    });
    const rehearsal = await buildLocalArchiveCampaignDaemonRehearsal({
      workspace,
      activeJob: activeJob ? makeJobSnapshot(activeJob, { includeArtifacts: false }) : null,
      selectedFiles,
      queue,
      recommendedBatchMax: Math.min(12, Math.max(1, Number(req.body?.recommendedBatchMax) || 3)),
    });
    return res.status(200).json({
      rehearsal,
      queue,
      source: 'server-saved-workspace-daemon-rehearsal',
      selectedFileCount: selectedFiles.length,
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to build local archive campaign daemon rehearsal', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to build local archive campaign daemon rehearsal' });
  }
});

router.post('/wiki/local-archive/campaign-automation/daemon/rehearsal-batch', async (req, res) => {
  try {
    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const recommendedBatchMax = Math.min(3, Math.max(1, Number(req.body?.recommendedBatchMax || req.body?.max) || 3));
    const { selectedIds: savedSelectedIds } = localArchiveSelectedIdsFromWorkspace(workspace, {
      includeRehearsal: false,
    });
    const candidates = Array.isArray(workspace.localArchiveScan?.candidates) ? workspace.localArchiveScan.candidates : [];
    const candidatesById = new Map(candidates.map((candidate) => [asString(candidate.id), candidate]));
    const selectedCandidates = savedSelectedIds
      .map((candidateId) => candidatesById.get(candidateId))
      .filter(Boolean)
      .filter((candidate) => asString(candidate.rootId) && asString(candidate.relativePath));
    if (!selectedCandidates.length) {
      return res.status(400).json({ error: 'No saved whole-life source batch is available to shrink for rehearsal.' });
    }

    const chosen = [];
    const skipped = [];
    for (const candidate of selectedCandidates.slice(0, WIKI_INGEST_FILE_LIMIT)) {
      const candidateId = asString(candidate.id);
      const blocked =
        candidate?.importReadiness === 'blocked-sensitive' ||
        (Array.isArray(candidate?.cleanupSignals) && candidate.cleanupSignals.includes('sensitive-credential-review'));
      if (blocked) {
        skipped.push({ id: candidateId, reason: 'blocked-sensitive' });
        continue;
      }
      try {
        const resolved = await resolveLocalArchiveFile({
          rootId: asString(candidate.rootId),
          relativePath: asString(candidate.relativePath),
        });
        chosen.push({
          id: candidateId,
          rootId: resolved.rootId,
          rootLabel: resolved.rootLabel,
          relativePath: resolved.relativePath,
          fileName: resolved.fileName,
          size: resolved.size,
          mimeType: resolved.mimeType,
          modifiedAt: resolved.modifiedAt,
        });
        if (chosen.length >= recommendedBatchMax) break;
      } catch (error) {
        skipped.push({
          id: candidateId,
          reason: error.message || 'source-resolution-failed',
        });
      }
    }

    if (!chosen.length) {
      return res.status(400).json({
        error: 'No selected whole-life sources could be resolved for the rehearsal batch.',
        skipped,
      });
    }

    const now = new Date().toISOString();
    const rehearsalFiles = chosen.map((source) => ({
      rootId: source.rootId,
      relativePath: source.relativePath,
    }));
    const savedSelectedFiles = selectedCandidates
      .map((candidate) => ({
        rootId: asString(candidate.rootId),
        relativePath: asString(candidate.relativePath),
      }))
      .filter((file) => file.rootId && file.relativePath);
    const rehearsalSignature = selectedLocalArchiveFilesConfirmationSignature(rehearsalFiles);
    const savedSelectionSignature = selectedLocalArchiveFilesConfirmationSignature(savedSelectedFiles);
    const automation = normalizeLocalArchiveCampaignAutomation(workspace.localArchiveCampaignAutomation || {});
    const campaign = workspace.localArchiveCampaign && typeof workspace.localArchiveCampaign === 'object'
      ? workspace.localArchiveCampaign
      : {};
    const nextCampaign = {
      ...campaign,
      id: asString(campaign.id, 'whole-life-wiki-import'),
      name: asString(campaign.name, 'Whole-life wiki import'),
      status: asString(campaign.status, chosen.length ? 'selecting' : 'scanned'),
      selectedIds: Array.isArray(campaign.selectedIds) && campaign.selectedIds.length
        ? campaign.selectedIds
        : savedSelectedIds,
      updatedAt: now,
      rehearsalSelection: {
        enabled: true,
        strategy: 'first-resolved-safe-files',
        selectedIds: chosen.map((source) => source.id),
        selectedCount: chosen.length,
        sourceSelectedIds: savedSelectedIds,
        sourceSelectedCount: savedSelectedIds.length,
        recommendedBatchMax,
        selectedSourceSignature: rehearsalSignature,
        sourceSelectionSignature: savedSelectionSignature,
        createdAt: now,
        updatedAt: now,
        createdBy: req.user.id,
        preview: chosen.slice(0, 5).map((source) => source.fileName || source.relativePath),
        skipped: skipped.slice(0, 12),
      },
    };
    const nextAutomation = {
      ...automation,
      selectedSourceConfirmation: null,
      requireReviewBeforeRun: true,
    };
    const auditRecord = normalizeCaseWikiAuditRecord({
      id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      actor: 'Case Wiki daemon rehearsal',
      action: 'created controlled whole-life rehearsal batch',
      object: `${chosen.length} source${chosen.length === 1 ? '' : 's'} selected for a tiny live-run rehearsal; ${savedSelectedIds.length} source${savedSelectedIds.length === 1 ? '' : 's'} remain preserved in the full batch.`,
      timestamp: now,
      category: 'case-wiki-local-archive',
      kind: 'campaign-automation',
      status: 'prepared',
      detail: `Rehearsal signature ${rehearsalSignature}. Confirm sources again before any live daemon ingest.`,
    });
    const nextWorkspace = {
      ...workspace,
      savedAt: now,
      localArchiveCampaign: nextCampaign,
      localArchiveCampaignAutomation: nextAutomation,
      auditRecords: [
        auditRecord,
        ...(Array.isArray(workspace.auditRecords) ? workspace.auditRecords : []),
      ].slice(0, 500),
    };
    await saveCaseManagementWorkspace(req.user.id, nextWorkspace);
    const activeJobId = asString(nextWorkspace.localArchiveCampaign?.activeJobId);
    const activeJob = activeJobId
      ? await getCaseManagementWikiIngestJob(req.user.id, activeJobId)
      : null;
    const selectedFiles = selectedLocalArchiveFilesFromWorkspace(nextWorkspace);
    const queue = buildLocalArchiveCampaignDaemonQueue({
      workspace: nextWorkspace,
      activeJob: activeJob ? makeJobSnapshot(activeJob, { includeArtifacts: false }) : null,
      selectedFiles,
      force: true,
    });
    const rehearsal = await buildLocalArchiveCampaignDaemonRehearsal({
      workspace: nextWorkspace,
      activeJob: activeJob ? makeJobSnapshot(activeJob, { includeArtifacts: false }) : null,
      selectedFiles,
      queue,
      recommendedBatchMax,
    });

    return res.status(200).json({
      campaign: nextCampaign,
      automation: nextAutomation,
      auditRecord,
      queue,
      rehearsal,
      rehearsalSelection: nextCampaign.rehearsalSelection,
      selectedFileCount: selectedFiles.length,
      preservedSelectedCount: savedSelectedIds.length,
      skipped,
      source: 'server-saved-workspace-daemon-rehearsal-batch',
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to create local archive daemon rehearsal batch', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to create controlled rehearsal batch' });
  }
});

router.delete('/wiki/local-archive/campaign-automation/daemon/rehearsal-batch', async (req, res) => {
  try {
    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const now = new Date().toISOString();
    const campaign = workspace.localArchiveCampaign && typeof workspace.localArchiveCampaign === 'object'
      ? workspace.localArchiveCampaign
      : {};
    const previousRehearsal = campaign.rehearsalSelection || null;
    const nextCampaign = {
      ...campaign,
      rehearsalSelection: previousRehearsal
        ? {
            ...previousRehearsal,
            enabled: false,
            disabledAt: now,
            disabledBy: req.user.id,
          }
        : null,
      updatedAt: now,
    };
    const nextAutomation = {
      ...normalizeLocalArchiveCampaignAutomation(workspace.localArchiveCampaignAutomation || {}),
      selectedSourceConfirmation: null,
      requireReviewBeforeRun: true,
    };
    const auditRecord = normalizeCaseWikiAuditRecord({
      id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      actor: 'Case Wiki daemon rehearsal',
      action: 'restored full whole-life selected batch',
      object: 'Disabled the temporary rehearsal batch. The daemon will inspect the preserved full selected-source batch again.',
      timestamp: now,
      category: 'case-wiki-local-archive',
      kind: 'campaign-automation',
      status: 'restored',
      detail: 'Selected-source confirmation was cleared because the daemon selection changed.',
    });
    const nextWorkspace = {
      ...workspace,
      savedAt: now,
      localArchiveCampaign: nextCampaign,
      localArchiveCampaignAutomation: nextAutomation,
      auditRecords: [
        auditRecord,
        ...(Array.isArray(workspace.auditRecords) ? workspace.auditRecords : []),
      ].slice(0, 500),
    };
    await saveCaseManagementWorkspace(req.user.id, nextWorkspace);
    const activeJobId = asString(nextWorkspace.localArchiveCampaign?.activeJobId);
    const activeJob = activeJobId
      ? await getCaseManagementWikiIngestJob(req.user.id, activeJobId)
      : null;
    const selectedFiles = selectedLocalArchiveFilesFromWorkspace(nextWorkspace);
    const queue = buildLocalArchiveCampaignDaemonQueue({
      workspace: nextWorkspace,
      activeJob: activeJob ? makeJobSnapshot(activeJob, { includeArtifacts: false }) : null,
      selectedFiles,
      force: true,
    });
    const rehearsal = await buildLocalArchiveCampaignDaemonRehearsal({
      workspace: nextWorkspace,
      activeJob: activeJob ? makeJobSnapshot(activeJob, { includeArtifacts: false }) : null,
      selectedFiles,
      queue,
      recommendedBatchMax: 3,
    });
    return res.status(200).json({
      campaign: nextCampaign,
      automation: nextAutomation,
      auditRecord,
      queue,
      rehearsal,
      selectedFileCount: selectedFiles.length,
      source: 'server-saved-workspace-daemon-rehearsal-batch-restore',
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to restore local archive daemon rehearsal batch', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to restore full selected batch' });
  }
});

router.post('/wiki/local-archive/campaign-automation/daemon/run', async (req, res) => {
  try {
    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const run = await runLocalArchiveCampaignDaemonPass({
      records: [
        {
          user: req.user.id,
          workspace,
        },
      ],
      execute: req.body?.execute === true,
      force: req.body?.force === true,
      limit: 1,
    });
    return res.status(run.startedJobCount ? 202 : 200).json({
      run,
      source: 'server-saved-workspace-daemon-run',
      workspaceScope: 'current-user',
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to run local archive campaign daemon pass', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to run local archive campaign daemon pass' });
  }
});

router.post('/wiki/local-archive/scan', async (req, res) => {
  try {
    const ingestions = await getCaseManagementWikiIngestions(req.user.id);
    const scan = await scanLocalArchive({
      query: typeof req.body?.query === 'string' ? req.body.query : '',
      rootIds: Array.isArray(req.body?.rootIds) ? req.body.rootIds : [],
      limit: Number.isFinite(Number(req.body?.limit)) ? Math.max(1, Math.min(1000, Number(req.body.limit))) : 300,
      maxDepth: Number.isFinite(Number(req.body?.maxDepth)) ? Math.max(1, Math.min(8, Number(req.body.maxDepth))) : 5,
      includeHidden: req.body?.includeHidden === true,
      sourceHistory: localArchiveSourceHistoryFromIngestions(ingestions),
    });
    return res.status(200).json(scan);
  } catch (error) {
    logger.error('[caseManagement] Failed to scan local archive', error);
    return res.status(500).json({ error: 'Failed to scan local archive' });
  }
});

router.post('/wiki/local-archive/catalog', async (req, res) => {
  try {
    const requestedCandidates = Array.isArray(req.body?.candidates)
      ? req.body.candidates.slice(0, WIKI_LOCAL_ARCHIVE_CATALOG_LIMIT)
      : [];
    if (!requestedCandidates.length) {
      return res.status(400).json({ error: 'Choose at least one local archive candidate to catalog' });
    }

    const normalizedContext = parseWikiIngestContextObject(req.body?.context || {});
    const existingIngestions = await getCaseManagementWikiIngestions(req.user.id);
    const builtRecords = [];
    const reusedRecords = [];
    const skipped = [];

    for (const candidate of requestedCandidates) {
      const candidateId = typeof candidate?.id === 'string' ? candidate.id : '';
      if (
        candidate?.importReadiness === 'blocked-sensitive' ||
        (Array.isArray(candidate?.cleanupSignals) && candidate.cleanupSignals.includes('sensitive-credential-review'))
      ) {
        skipped.push({
          id: candidateId,
          fileName: candidate?.fileName || '',
          reason: 'blocked-sensitive',
        });
        continue;
      }
      const existingCatalogRecord = findExistingLocalArchiveCatalogIngestion(candidate, existingIngestions);
      if (existingCatalogRecord) {
        reusedRecords.push(existingCatalogRecord);
        skipped.push({
          id: candidateId,
          fileName: candidate?.fileName || existingCatalogRecord.originalName || '',
          reason: 'already-cataloged',
          existingSourceId: existingCatalogRecord.fileId,
          existingPageId:
            existingCatalogRecord.generatedRecords?.frontendRecord?.pageId ||
            existingCatalogRecord.wikiPage?.id ||
            '',
        });
        continue;
      }

      try {
        const localFile = await resolveLocalArchiveFile({
          rootId: typeof candidate?.rootId === 'string' ? candidate.rootId : '',
          relativePath: typeof candidate?.relativePath === 'string' ? candidate.relativePath : '',
        });
        builtRecords.push(
          await buildCaseWikiLocalArchiveCatalogRecord({
            candidate: {
              ...candidate,
              fileName: localFile.fileName,
              relativePath: localFile.relativePath,
              rootId: localFile.rootId,
              rootLabel: localFile.rootLabel,
              displayPath: candidate?.displayPath || path.join(localFile.rootLabel, localFile.relativePath),
              size: localFile.size,
              mimeType: localFile.mimeType,
              modifiedAt: localFile.modifiedAt,
            },
            userId: req.user.id,
            context: normalizedContext,
            writeGraph: false,
          }),
        );
      } catch (error) {
        skipped.push({
          id: candidateId,
          fileName: candidate?.fileName || '',
          reason: error.message || 'catalog-validation-failed',
        });
      }
    }

    if (!builtRecords.length) {
      if (reusedRecords.length) {
        const reusedFrontendRecords = reusedRecords.map(makeFrontendIngestionRecord).filter(Boolean);
        return res.status(200).json({
          ingestions: reusedRecords,
          wikiIngestionRecords: reusedFrontendRecords,
          generatedRecords: {
            noteRecords: reusedRecords.map((record) => record.generatedRecords?.note).filter(Boolean),
            documentRecords: reusedRecords.map((record) => record.generatedRecords?.document).filter(Boolean),
            timelineRecords: reusedRecords.map((record) => record.generatedRecords?.timeline).filter(Boolean),
          },
          neo4j: {
            status: 'reused',
            message: 'Selected local archive sources were already cataloged in the Case Wiki.',
            nodeCount: 0,
            edgeCount: 0,
          },
          skipped,
          catalogedCount: 0,
          reusedCount: reusedRecords.length,
          requestedCount: requestedCandidates.length,
        });
      }
      return res.status(400).json({
        error: 'No catalogable local archive sources were available after safety checks',
        skipped,
      });
    }

    const graphNodeMap = new Map();
    const graphEdgeMap = new Map();
    builtRecords.forEach((record) => {
      (record.graph?.nodes || []).forEach((node) => graphNodeMap.set(node.id, node));
      (record.graph?.edges || []).forEach((edge) => graphEdgeMap.set(`${edge.from}|${edge.kind}|${edge.to}`, edge));
    });
    const graph = {
      nodes: Array.from(graphNodeMap.values()),
      edges: Array.from(graphEdgeMap.values()),
    };
    const neo4j = await writeCaseWikiGraphToNeo4j(graph);
    const recordsWithNeo4j = builtRecords.map((record) => ({
      ...record,
      neo4j: {
        ...neo4j,
        nodeCount: record.graph?.nodes?.length || 0,
        edgeCount: record.graph?.edges?.length || 0,
      },
      generatedRecords: {
        ...record.generatedRecords,
        frontendRecord: {
          ...record.generatedRecords.frontendRecord,
          graphStatus: neo4j.status,
          graphMessage: neo4j.message || neo4j.skippedReason || '',
        },
      },
    }));
    const saved = await Promise.all(
      recordsWithNeo4j.map((record) => saveCaseManagementWikiIngestion(req.user.id, record)),
    );
    const reusedFrontendRecords = reusedRecords.map(makeFrontendIngestionRecord).filter(Boolean);

    return res.status(201).json({
      ingestions: [...saved, ...reusedRecords],
      wikiIngestionRecords: [
        ...recordsWithNeo4j.map((record) => record.generatedRecords.frontendRecord),
        ...reusedFrontendRecords,
      ],
      generatedRecords: {
        noteRecords: recordsWithNeo4j.map((record) => record.generatedRecords.note),
        documentRecords: recordsWithNeo4j.map((record) => record.generatedRecords.document),
        timelineRecords: recordsWithNeo4j.map((record) => record.generatedRecords.timeline),
      },
      neo4j,
      skipped,
      catalogedCount: recordsWithNeo4j.length,
      reusedCount: reusedRecords.length,
      requestedCount: requestedCandidates.length,
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to catalog local archive sources', error);
    return res.status(500).json({ error: error.message || 'Failed to catalog local archive sources' });
  }
});

router.post('/wiki/local-archive/ingest', async (req, res) => {
  try {
    const savedJob = await createLocalArchiveIngestJob({
      userId: req.user.id,
      files: req.body?.files,
      context: req.body?.context || {},
      campaign: {
        id: req.body?.context?.campaignId,
        name: req.body?.context?.campaignName,
      },
    });
    return res.status(202).json(makeJobSnapshot(savedJob));
  } catch (error) {
    logger.error('[caseManagement] Failed to create local archive ingest job', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to start local archive ingest job' });
  }
});

router.patch('/wiki/ingestions/archive/batch', async (req, res) => {
  try {
    const action = readStringField(req.body, 'action');
    const fileIds = readUniqueStringArray(req.body, 'fileIds', 100);
    if (!archiveBatchReviewActions.has(action)) {
      return res.status(400).json({ error: 'Unsupported batch archive review action' });
    }
    if (!fileIds.length) {
      return res.status(400).json({ error: 'Choose at least one source document for batch review' });
    }

    const existingIngestions = await getCaseManagementWikiIngestions(req.user.id);
    const existingByFileId = new Map(existingIngestions.map((ingestion) => [ingestion.fileId, ingestion]));
    const updated = [];
    const wikiIngestionRecords = [];
    const auditRecords = [];
    const skipped = [];
    const failed = [];

    for (const fileId of fileIds) {
      const existing = existingByFileId.get(fileId);
      if (!existing) {
        skipped.push({ fileId, reason: 'source-not-found' });
        continue;
      }
      if (!isBatchReviewEligibleSource(existing)) {
        skipped.push({ fileId, reason: 'already-attached-or-current-record' });
        continue;
      }

      const existingArchive = archiveForWikiIngestion(existing);
      const actionPatch = archivePatchForAction(action, existingArchive);
      if (!actionPatch || !archiveReviewStatuses.has(actionPatch.reviewStatus)) {
        failed.push({ fileId, reason: 'unsupported-review-state' });
        continue;
      }

      const auditRecord = makeCaseWikiAuditRecord({
        action: archiveReviewAuditAction(action, actionPatch),
        object: existing.originalName || existing.generatedRecords?.frontendRecord?.fileName || fileId,
      });
      const nextAuditRecords = [
        auditRecord,
        ...(Array.isArray(existing.generatedRecords?.auditRecords) ? existing.generatedRecords.auditRecords : []),
      ].slice(0, 120);
      const reviewUpdates =
        action === 'keep-standalone' || action === 'mark-reviewed' || action === 'reopen-review'
          ? caseWikiReviewUpdates(existing, actionPatch, null)
          : {
              archive: actionPatch,
              'wikiPage.archive': actionPatch,
              'generatedRecords.frontendRecord.archive': actionPatch,
            };
      reviewUpdates['generatedRecords.auditRecords'] = nextAuditRecords;
      if (action === 'exclude-from-embedding') {
        const embeddingReview = embeddingReviewPatchForAction('do-not-embed-source', makeFallbackEmbeddingReview(existing));
        if (embeddingReview) {
          reviewUpdates.embeddingReview = embeddingReview;
          reviewUpdates['generatedRecords.frontendRecord.embeddingReview'] = embeddingReview;
        }
      }

      try {
        const updatedIngestion = await updateCaseManagementWikiIngestionReview(req.user.id, fileId, reviewUpdates);
        if (!updatedIngestion) {
          skipped.push({ fileId, reason: 'source-not-found' });
          continue;
        }
        updated.push(updatedIngestion);
        wikiIngestionRecords.push(makeFrontendIngestionRecord(updatedIngestion));
        auditRecords.push(auditRecord);
      } catch (error) {
        logger.warn('[caseManagement] Failed to update batch archive review item', {
          fileId,
          action,
          error: error.message,
        });
        failed.push({ fileId, reason: 'update-failed' });
      }
    }

    return res.status(200).json({
      updated,
      wikiIngestionRecords,
      skipped,
      failed,
      summary: {
        requested: fileIds.length,
        updated: updated.length,
        skipped: skipped.length,
        failed: failed.length,
      },
      generatedRecords: {
        noteRecords: updated.map((ingestion) => ingestion.generatedRecords?.note).filter(Boolean),
        documentRecords: updated.map((ingestion) => ingestion.generatedRecords?.document).filter(Boolean),
        timelineRecords: updated.map((ingestion) => ingestion.generatedRecords?.timeline).filter(Boolean),
        auditRecords,
      },
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to batch update wiki archive review', error);
    return res.status(500).json({ error: 'Failed to batch update Case Wiki archive review' });
  }
});

router.patch('/wiki/ingestions/:fileId/archive/canonical-group', async (req, res) => {
  try {
    if (req.body?.confirmCanonicalGroupResolution !== true) {
      return res.status(400).json({ error: 'Confirm the canonical group decision before updating duplicate sources' });
    }

    const sourceIds = readUniqueStringArray(req.body, 'sourceIds', 25);
    if (!sourceIds.length) {
      return res.status(400).json({ error: 'Choose at least one duplicate source to resolve' });
    }

    const existingIngestions = await getCaseManagementWikiIngestions(req.user.id);
    const existingByFileId = new Map(existingIngestions.map((ingestion) => [ingestion.fileId, ingestion]));
    const canonicalIngestion = existingByFileId.get(req.params.fileId);
    if (!canonicalIngestion) {
      return res.status(404).json({ error: 'Canonical Case Wiki source document not found' });
    }

    const canonicalArchive = archiveForWikiIngestion(canonicalIngestion);
    if (!isBatchReviewEligibleSource(canonicalIngestion) && canonicalArchive.reviewStatus !== 'reviewed-standalone') {
      return res.status(400).json({ error: 'Choose a standalone source document before resolving a canonical group' });
    }

    const canonicalSource = {
      sourceId: canonicalIngestion.fileId,
      sourceLabel:
        canonicalArchive.suggestedWikiTitle ||
        canonicalIngestion.generatedRecords?.frontendRecord?.title ||
        canonicalIngestion.originalName ||
        canonicalIngestion.fileId,
      sourcePageId:
        canonicalIngestion.generatedRecords?.frontendRecord?.pageId ||
        canonicalIngestion.wikiPage?.id ||
        `ingest:${canonicalIngestion.fileId}`,
      sourceHash:
        canonicalIngestion.sha256 ||
        canonicalIngestion.generatedRecords?.frontendRecord?.sourceHash ||
        '',
    };
    const lineageDuplicateIngestions = sourceIds
      .filter((sourceId) => sourceId !== canonicalIngestion.fileId)
      .map((sourceId) => existingByFileId.get(sourceId))
      .filter((ingestion) => ingestion && isBatchReviewEligibleSource(ingestion));
    const canonicalLineage = buildCanonicalLineageRecord({
      canonicalIngestion,
      canonicalSource,
      duplicateIngestions: lineageDuplicateIngestions,
      existingLineage: canonicalArchive.canonicalLineage || canonicalArchive.cleanupDecision?.canonicalLineage || null,
    });
    const canonicalPatch = archivePatchForAction(
      'mark-canonical-source',
      canonicalArchive,
      null,
      null,
      canonicalLineage,
    );

    const updated = [];
    const wikiIngestionRecords = [];
    const auditRecords = [];
    const skipped = [];
    const failed = [];

    const canonicalAuditRecord = makeCaseWikiAuditRecord({
      action: 'marked source as canonical source for duplicate group',
      object: canonicalSource.sourceLabel,
    });
    const canonicalAuditRecords = [
      canonicalAuditRecord,
      ...(Array.isArray(canonicalIngestion.generatedRecords?.auditRecords)
        ? canonicalIngestion.generatedRecords.auditRecords
        : []),
    ].slice(0, 120);
    const canonicalUpdates = {
      archive: canonicalPatch,
      'wikiPage.archive': canonicalPatch,
      'generatedRecords.frontendRecord.archive': canonicalPatch,
      'generatedRecords.auditRecords': canonicalAuditRecords,
    };

    try {
      const updatedCanonical = await updateCaseManagementWikiIngestionReview(
        req.user.id,
        canonicalIngestion.fileId,
        canonicalUpdates,
      );
      if (updatedCanonical) {
        updated.push(updatedCanonical);
        wikiIngestionRecords.push(makeFrontendIngestionRecord(updatedCanonical));
        auditRecords.push(canonicalAuditRecord);
      } else {
        failed.push({ fileId: canonicalIngestion.fileId, reason: 'canonical-update-failed' });
      }
    } catch (error) {
      logger.warn('[caseManagement] Failed to mark canonical source for duplicate group', {
        fileId: canonicalIngestion.fileId,
        error: error.message,
      });
      failed.push({ fileId: canonicalIngestion.fileId, reason: 'canonical-update-failed' });
    }

    for (const sourceId of sourceIds) {
      if (sourceId === canonicalIngestion.fileId) {
        skipped.push({ fileId: sourceId, reason: 'canonical-source-selected' });
        continue;
      }

      const existing = existingByFileId.get(sourceId);
      if (!existing) {
        skipped.push({ fileId: sourceId, reason: 'source-not-found' });
        continue;
      }
      if (!isBatchReviewEligibleSource(existing)) {
        skipped.push({ fileId: sourceId, reason: 'already-attached-or-current-record' });
        continue;
      }

      const existingArchive = archiveForWikiIngestion(existing);
      if (existingArchive.cleanupDecision?.canonicalSource?.sourceId === canonicalIngestion.fileId) {
        skipped.push({ fileId: sourceId, reason: 'already-points-to-canonical' });
        continue;
      }

      const actionPatch = archivePatchForAction(
        'mark-superseded-by-source',
        existingArchive,
        null,
        canonicalSource,
        canonicalLineage,
      );
      if (!actionPatch || !archiveReviewStatuses.has(actionPatch.reviewStatus)) {
        failed.push({ fileId: sourceId, reason: 'unsupported-review-state' });
        continue;
      }

      const auditRecord = makeCaseWikiAuditRecord({
        action: archiveReviewAuditAction('mark-superseded-by-source', actionPatch),
        object: existing.originalName || existing.generatedRecords?.frontendRecord?.fileName || sourceId,
      });
      const nextAuditRecords = [
        auditRecord,
        ...(Array.isArray(existing.generatedRecords?.auditRecords) ? existing.generatedRecords.auditRecords : []),
      ].slice(0, 120);
      const reviewUpdates = {
        archive: actionPatch,
        'wikiPage.archive': actionPatch,
        'generatedRecords.frontendRecord.archive': actionPatch,
        'generatedRecords.auditRecords': nextAuditRecords,
      };

      try {
        const updatedIngestion = await updateCaseManagementWikiIngestionReview(req.user.id, sourceId, reviewUpdates);
        if (!updatedIngestion) {
          skipped.push({ fileId: sourceId, reason: 'source-not-found' });
          continue;
        }
        updated.push(updatedIngestion);
        wikiIngestionRecords.push(makeFrontendIngestionRecord(updatedIngestion));
        auditRecords.push(auditRecord);
      } catch (error) {
        logger.warn('[caseManagement] Failed to resolve canonical group item', {
          fileId: sourceId,
          error: error.message,
        });
        failed.push({ fileId: sourceId, reason: 'update-failed' });
      }
    }

    return res.status(200).json({
      updated,
      wikiIngestionRecords,
      skipped,
      failed,
      summary: {
        canonicalSourceId: canonicalIngestion.fileId,
        canonicalSourceLabel: canonicalSource.sourceLabel,
        requested: sourceIds.length,
        updated: updated.length,
        duplicateSourcesUpdated: Math.max(0, updated.length - 1),
        lineageId: canonicalLineage.groupId,
        lineageMemberCount: canonicalLineage.members.length,
        lineageAliasCount: canonicalLineage.aliases.length,
        lineageHashCount: canonicalLineage.sourceHashes.length,
        skipped: skipped.length,
        failed: failed.length,
        destructiveFileAction: false,
        vectorWrite: false,
        graphWrite: false,
        attachmentWrite: false,
      },
      generatedRecords: {
        noteRecords: updated.map((ingestion) => ingestion.generatedRecords?.note).filter(Boolean),
        documentRecords: updated.map((ingestion) => ingestion.generatedRecords?.document).filter(Boolean),
        timelineRecords: updated.map((ingestion) => ingestion.generatedRecords?.timeline).filter(Boolean),
        auditRecords,
      },
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to resolve canonical source group', error);
    return res.status(500).json({ error: 'Failed to resolve Case Wiki canonical source group' });
  }
});

router.patch('/wiki/ingestions/:fileId/archive/article-consolidation', async (req, res) => {
  try {
    if (req.body?.confirmArticleConsolidationPlan !== true) {
      return res.status(400).json({ error: 'Confirm the article consolidation plan before updating source metadata' });
    }

    const requestedMode = readStringField(req.body, 'mode');
    const mode =
      requestedMode === 'single-source-article'
        ? 'single-source-article'
        : requestedMode === 'split-review'
          ? 'split-review'
          : 'merge-candidates';
    const sourceIds = readUniqueStringArray(req.body, 'sourceIds', 20);
    if (!sourceIds.length && mode !== 'single-source-article') {
      return res.status(400).json({ error: 'Choose at least one related source for the consolidation plan' });
    }

    const existingIngestions = await getCaseManagementWikiIngestions(req.user.id);
    const existingByFileId = new Map(existingIngestions.map((ingestion) => [ingestion.fileId, ingestion]));
    const baseIngestion = existingByFileId.get(req.params.fileId);
    if (!baseIngestion) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }
    if (!isBatchReviewEligibleSource(baseIngestion)) {
      return res.status(400).json({ error: 'Choose a standalone source document before planning article consolidation' });
    }

    const skipped = [];
    const candidateIngestions = [];
    sourceIds.forEach((sourceId) => {
      if (sourceId === baseIngestion.fileId) {
        skipped.push({ fileId: sourceId, reason: 'base-source-selected' });
        return;
      }
      const existing = existingByFileId.get(sourceId);
      if (!existing) {
        skipped.push({ fileId: sourceId, reason: 'source-not-found' });
        return;
      }
      if (!isBatchReviewEligibleSource(existing)) {
        skipped.push({ fileId: sourceId, reason: 'already-attached-or-current-record' });
        return;
      }
      candidateIngestions.push(existing);
    });

    if (!candidateIngestions.length && mode !== 'single-source-article') {
      return res.status(400).json({
        error: 'No standalone related sources were eligible for article consolidation',
        skipped,
      });
    }

    const plan = buildArticleConsolidationPlan({ baseIngestion, candidateIngestions, mode });
    const updated = [];
    const wikiIngestionRecords = [];
    const auditRecords = [];
    const failed = [];

    const updateSourceWithPlan = async (ingestion, planPatch, action) => {
      const existingArchive = archiveForWikiIngestion(ingestion);
      const nextArchive = {
        ...existingArchive,
        reviewedAt: new Date().toISOString(),
        reviewedBy: 'Current worker',
        articleConsolidation: planPatch,
      };
      const auditRecord = makeCaseWikiAuditRecord({
        action,
        object: wikiIngestionTitle(ingestion),
      });
      const nextAuditRecords = [
        auditRecord,
        ...(Array.isArray(ingestion.generatedRecords?.auditRecords) ? ingestion.generatedRecords.auditRecords : []),
      ].slice(0, 120);
      try {
        const updatedIngestion = await updateCaseManagementWikiIngestionReview(req.user.id, ingestion.fileId, {
          archive: nextArchive,
          'wikiPage.archive': nextArchive,
          'generatedRecords.frontendRecord.archive': nextArchive,
          'generatedRecords.auditRecords': nextAuditRecords,
        });
        if (!updatedIngestion) {
          failed.push({ fileId: ingestion.fileId, reason: 'source-not-found' });
          return;
        }
        updated.push(updatedIngestion);
        wikiIngestionRecords.push(makeFrontendIngestionRecord(updatedIngestion));
        auditRecords.push(auditRecord);
      } catch (error) {
        logger.warn('[caseManagement] Failed to save article consolidation plan item', {
          fileId: ingestion.fileId,
          error: error.message,
        });
        failed.push({ fileId: ingestion.fileId, reason: 'update-failed' });
      }
    };

    await updateSourceWithPlan(
      baseIngestion,
      plan,
      mode === 'single-source-article'
        ? 'planned standalone article candidate'
        : `planned article consolidation for ${plan.candidateCount} related source${plan.candidateCount === 1 ? '' : 's'}`,
    );

    for (const candidate of candidateIngestions) {
      const candidatePlan = {
        ...plan,
        status: 'candidate-for-article-merge',
        targetSourceId: baseIngestion.fileId,
        targetSourceLabel: plan.targetTitle,
        recommendation:
          `This source is proposed as supporting material for "${plan.targetTitle}". Keep its source page intact until reviewed citations are promoted.`,
      };
      await updateSourceWithPlan(
        candidate,
        candidatePlan,
        `linked source to article consolidation plan for ${plan.targetTitle}`,
      );
    }

    return res.status(200).json({
      updated,
      wikiIngestionRecords,
      skipped,
      failed,
      articleConsolidationPlan: plan,
      summary: {
        planId: plan.id,
        targetSourceId: plan.targetSourceId,
        targetTitle: plan.targetTitle,
        sourceCount: plan.sourceCount,
        candidateCount: plan.candidateCount,
        updated: updated.length,
        skipped: skipped.length,
        failed: failed.length,
        destructiveFileAction: false,
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
        attachmentWrite: false,
      },
      generatedRecords: {
        noteRecords: updated.map((ingestion) => ingestion.generatedRecords?.note).filter(Boolean),
        documentRecords: updated.map((ingestion) => ingestion.generatedRecords?.document).filter(Boolean),
        timelineRecords: updated.map((ingestion) => ingestion.generatedRecords?.timeline).filter(Boolean),
        auditRecords,
      },
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to plan Case Wiki article consolidation', error);
    return res.status(500).json({ error: 'Failed to plan Case Wiki article consolidation' });
  }
});

router.patch('/wiki/ingestions/:fileId/archive/article-consolidation/citation-review', async (req, res) => {
  try {
    if (req.body?.confirmCitationReviewPacket !== true) {
      return res.status(400).json({ error: 'Confirm the citation review packet before updating source metadata' });
    }

    const existingIngestions = await getCaseManagementWikiIngestions(req.user.id);
    const existingByFileId = new Map(existingIngestions.map((ingestion) => [ingestion.fileId, ingestion]));
    const baseIngestion = existingByFileId.get(req.params.fileId);
    if (!baseIngestion) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }
    if (!isBatchReviewEligibleSource(baseIngestion)) {
      return res.status(400).json({ error: 'Choose a standalone source document before preparing citation review' });
    }

    const baseArchive = archiveForWikiIngestion(baseIngestion);
    const existingPlan = baseArchive.articleConsolidation || {};
    const plannedSourceIds = compactStringArray(existingPlan.sourceIds || [], 30);
    if (!existingPlan.id || !plannedSourceIds.length) {
      return res.status(400).json({ error: 'Plan article consolidation before preparing citation review packet' });
    }

    const requestedSourceIds = readUniqueStringArray(req.body, 'sourceIds', 30);
    const selectedSourceIds = compactStringArray(
      [baseIngestion.fileId, ...(requestedSourceIds.length ? requestedSourceIds : plannedSourceIds)],
      30,
    );
    const skipped = [];
    const sourceIngestions = [];
    selectedSourceIds.forEach((sourceId) => {
      const existing = existingByFileId.get(sourceId);
      if (!existing) {
        skipped.push({ fileId: sourceId, reason: 'source-not-found' });
        return;
      }
      if (!isBatchReviewEligibleSource(existing)) {
        skipped.push({ fileId: sourceId, reason: 'already-attached-or-current-record' });
        return;
      }
      sourceIngestions.push(existing);
    });

    if (!sourceIngestions.length) {
      return res.status(400).json({
        error: 'No standalone sources were eligible for citation review',
        skipped,
      });
    }

    const packet = buildArticleCitationReviewPacket({
      targetIngestion: baseIngestion,
      sourceIngestions,
      plan: existingPlan,
    });
    const nextArticleConsolidation = {
      ...existingPlan,
      status: packet.status === 'ready-for-article-draft' ? 'citation-packet-ready' : 'citation-review-needed',
      citationReviewPacket: packet,
    };
    const nextArchive = {
      ...baseArchive,
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'Current worker',
      articleConsolidation: nextArticleConsolidation,
    };
    const auditRecord = makeCaseWikiAuditRecord({
      action: 'prepared article consolidation citation review packet',
      object: wikiIngestionTitle(baseIngestion),
    });
    const nextAuditRecords = [
      auditRecord,
      ...(Array.isArray(baseIngestion.generatedRecords?.auditRecords) ? baseIngestion.generatedRecords.auditRecords : []),
    ].slice(0, 120);

    const updated = await updateCaseManagementWikiIngestionReview(req.user.id, baseIngestion.fileId, {
      archive: nextArchive,
      'wikiPage.archive': nextArchive,
      'generatedRecords.frontendRecord.archive': nextArchive,
      'generatedRecords.auditRecords': nextAuditRecords,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }

    return res.status(200).json({
      updated,
      wikiIngestionRecord: makeFrontendIngestionRecord(updated),
      articleCitationReviewPacket: packet,
      skipped,
      summary: {
        packetId: packet.id,
        status: packet.status,
        targetSourceId: packet.targetSourceId,
        targetTitle: packet.targetTitle,
        sourceCount: packet.sourceCount,
        reviewedCitationCount: packet.reviewedCitationCount,
        pendingChunkCount: packet.pendingChunkCount,
        blockedChunkCount: packet.blockedChunkCount,
        metadataOnlySourceCount: packet.metadataOnlySourceCount,
        promotionBlocked: packet.promotionBlocked,
        skipped: skipped.length,
        destructiveFileAction: false,
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
        attachmentWrite: false,
        fileAction: false,
      },
      generatedRecords: {
        noteRecords: [updated.generatedRecords?.note].filter(Boolean),
        documentRecords: [updated.generatedRecords?.document].filter(Boolean),
        timelineRecords: [updated.generatedRecords?.timeline].filter(Boolean),
        auditRecords: [auditRecord],
      },
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to prepare Case Wiki article citation review packet', error);
    return res.status(500).json({ error: 'Failed to prepare Case Wiki article citation review packet' });
  }
});

router.patch('/wiki/ingestions/:fileId/archive/article-consolidation/workup-preview', async (req, res) => {
  try {
    if (req.body?.confirmArticleWorkupPreview !== true) {
      return res.status(400).json({
        error: 'Confirm the source-to-article workup before updating source metadata',
        policy:
          'Article workups prepare plan, citation, draft-preview, and readiness metadata only. They do not promote prose, write vectors, attach records, move files, or delete anything.',
      });
    }

    const requestedMode = readStringField(req.body, 'mode');
    const requestedSourceIds = readUniqueStringArray(req.body, 'sourceIds', 30);
    const existingIngestions = await getCaseManagementWikiIngestions(req.user.id);
    const existingByFileId = new Map(existingIngestions.map((ingestion) => [ingestion.fileId, ingestion]));
    const baseIngestion = existingByFileId.get(req.params.fileId);
    if (!baseIngestion) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }
    if (!isBatchReviewEligibleSource(baseIngestion)) {
      return res.status(400).json({ error: 'Choose a standalone source document before preparing an article workup' });
    }

    const baseArchive = archiveForWikiIngestion(baseIngestion);
    const existingPlan = baseArchive.articleConsolidation || {};
    const mode =
      requestedMode === 'merge-candidates' && requestedSourceIds.length > 1
        ? 'merge-candidates'
        : existingPlan.mode === 'merge-candidates' && compactStringArray(existingPlan.sourceIds || [], 30).length > 1
          ? 'merge-candidates'
          : 'single-source-article';
    const plannedSourceIds = compactStringArray(
      requestedSourceIds.length
        ? [baseIngestion.fileId, ...requestedSourceIds]
        : existingPlan.id
          ? [baseIngestion.fileId, ...(existingPlan.sourceIds || [])]
          : [baseIngestion.fileId],
      30,
    );

    const skipped = [];
    const sourceIngestions = [];
    plannedSourceIds.forEach((sourceId) => {
      const existing = existingByFileId.get(sourceId);
      if (!existing) {
        skipped.push({ fileId: sourceId, reason: 'source-not-found' });
        return;
      }
      if (!isBatchReviewEligibleSource(existing)) {
        skipped.push({ fileId: sourceId, reason: 'already-attached-or-current-record' });
        return;
      }
      sourceIngestions.push(existing);
    });

    if (!sourceIngestions.length) {
      return res.status(400).json({
        error: 'No standalone sources were eligible for article workup',
        skipped,
      });
    }

    const candidateIngestions = sourceIngestions.filter((ingestion) => ingestion.fileId !== baseIngestion.fileId);
    const plan = existingPlan.id
      ? {
          ...existingPlan,
          mode: existingPlan.mode || mode,
          sourceIds: compactStringArray([baseIngestion.fileId, ...(existingPlan.sourceIds || plannedSourceIds)], 30),
        }
      : buildArticleConsolidationPlan({ baseIngestion, candidateIngestions, mode });
    const packet = buildArticleCitationReviewPacket({
      targetIngestion: baseIngestion,
      sourceIngestions,
      plan,
    });
    let draftPreview = null;
    let promotionReadiness = null;
    let workupStatus = packet.status === 'ready-for-article-draft' ? 'citation-packet-ready' : 'citation-review-needed';

    if (packet.reviewedCitationCount > 0) {
      const nextDraftPreview = buildArticleDraftPreviewFromCitationPacket({
        targetIngestion: baseIngestion,
        plan,
        packet,
      });
      if (!nextDraftPreview.error) {
        draftPreview = nextDraftPreview;
        workupStatus =
          draftPreview.status === 'draft-preview-ready-for-review'
            ? 'article-draft-preview-ready'
            : 'article-draft-preview-needs-review';
        const nextPromotionReadiness = buildArticlePromotionReadinessReview({
          targetIngestion: baseIngestion,
          plan,
          draftPreview,
        });
        if (!nextPromotionReadiness.error) {
          promotionReadiness = nextPromotionReadiness;
          workupStatus =
            promotionReadiness.status === 'ready-for-human-promotion'
              ? 'promotion-readiness-ready'
              : 'promotion-readiness-needs-review';
        }
      }
    }

    const nextArticleConsolidation = {
      ...plan,
      status: workupStatus,
      citationReviewPacket: packet,
      ...(draftPreview ? { articleDraftPreview: draftPreview } : {}),
      ...(promotionReadiness ? { articlePromotionReadiness: promotionReadiness } : {}),
      workupPreview: {
        id: `article-workup:${plan.id || baseIngestion.fileId}:${packet.id}`,
        status: workupStatus,
        preparedAt: new Date().toISOString(),
        preparedBy: 'Current worker',
        planPrepared: true,
        citationPacketPrepared: true,
        draftPreviewPrepared: Boolean(draftPreview),
        promotionReadinessPrepared: Boolean(promotionReadiness),
        promotionStillRequiresHumanConfirmation: true,
        nonDestructive: true,
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
        attachmentWrite: false,
        fileAction: false,
      },
    };
    const nextArchive = {
      ...baseArchive,
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'Current worker',
      articleConsolidation: nextArticleConsolidation,
    };
    const auditRecord = makeCaseWikiAuditRecord({
      action: 'prepared source-to-article workup preview',
      object: wikiIngestionTitle(baseIngestion),
    });
    const nextAuditRecords = [
      auditRecord,
      ...(Array.isArray(baseIngestion.generatedRecords?.auditRecords) ? baseIngestion.generatedRecords.auditRecords : []),
    ].slice(0, 120);

    const updated = await updateCaseManagementWikiIngestionReview(req.user.id, baseIngestion.fileId, {
      archive: nextArchive,
      'wikiPage.archive': nextArchive,
      'generatedRecords.frontendRecord.archive': nextArchive,
      'generatedRecords.auditRecords': nextAuditRecords,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }

    return res.status(200).json({
      updated,
      wikiIngestionRecord: makeFrontendIngestionRecord(updated),
      articleConsolidationPlan: plan,
      articleCitationReviewPacket: packet,
      ...(draftPreview ? { articleDraftPreview: draftPreview } : {}),
      ...(promotionReadiness ? { articlePromotionReadiness: promotionReadiness } : {}),
      skipped,
      summary: {
        status: workupStatus,
        targetSourceId: plan.targetSourceId,
        targetTitle: plan.targetTitle,
        sourceCount: sourceIngestions.length,
        reviewedCitationCount: packet.reviewedCitationCount,
        pendingChunkCount: packet.pendingChunkCount,
        blockedChunkCount: packet.blockedChunkCount,
        metadataOnlySourceCount: packet.metadataOnlySourceCount,
        draftPreviewPrepared: Boolean(draftPreview),
        promotionReadinessPrepared: Boolean(promotionReadiness),
        readyForHumanPromotion: Boolean(promotionReadiness?.readyForHumanPromotion),
        skipped: skipped.length,
        destructiveFileAction: false,
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
        attachmentWrite: false,
        fileAction: false,
      },
      generatedRecords: {
        noteRecords: [updated.generatedRecords?.note].filter(Boolean),
        documentRecords: [updated.generatedRecords?.document].filter(Boolean),
        timelineRecords: [updated.generatedRecords?.timeline].filter(Boolean),
        auditRecords: [auditRecord],
      },
      policy:
        'This prepared a source-to-article workup only. It did not promote article prose, call a model, write vectors, write Neo4j, attach records, move files, delete files, or clean up anything.',
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to prepare Case Wiki source-to-article workup preview', error);
    return res.status(500).json({ error: 'Failed to prepare Case Wiki source-to-article workup preview' });
  }
});

router.patch('/wiki/ingestions/:fileId/archive/article-consolidation/draft-preview', async (req, res) => {
  try {
    if (req.body?.confirmArticleDraftPreview !== true) {
      return res.status(400).json({ error: 'Confirm the article draft preview before updating source metadata' });
    }

    const existingIngestions = await getCaseManagementWikiIngestions(req.user.id);
    const existingByFileId = new Map(existingIngestions.map((ingestion) => [ingestion.fileId, ingestion]));
    const baseIngestion = existingByFileId.get(req.params.fileId);
    if (!baseIngestion) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }
    if (!isBatchReviewEligibleSource(baseIngestion)) {
      return res.status(400).json({ error: 'Choose a standalone source document before preparing an article draft preview' });
    }

    const baseArchive = archiveForWikiIngestion(baseIngestion);
    const existingPlan = baseArchive.articleConsolidation || {};
    const packet = existingPlan.citationReviewPacket || {};
    const draftPreview = buildArticleDraftPreviewFromCitationPacket({
      targetIngestion: baseIngestion,
      plan: existingPlan,
      packet,
    });
    if (draftPreview.error) {
      return res.status(409).json({
        error: draftPreview.error,
        blockedReasons: draftPreview.blockedReasons,
        policy: 'Article draft previews can only use reviewed citation chunks and stay metadata-only until human promotion.',
      });
    }

    const nextArticleConsolidation = {
      ...existingPlan,
      status:
        draftPreview.status === 'draft-preview-ready-for-review'
          ? 'article-draft-preview-ready'
          : 'article-draft-preview-needs-review',
      articleDraftPreview: draftPreview,
    };
    const nextArchive = {
      ...baseArchive,
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'Current worker',
      articleConsolidation: nextArticleConsolidation,
    };
    const auditRecord = makeCaseWikiAuditRecord({
      action: 'prepared article consolidation draft preview',
      object: wikiIngestionTitle(baseIngestion),
    });
    const nextAuditRecords = [
      auditRecord,
      ...(Array.isArray(baseIngestion.generatedRecords?.auditRecords) ? baseIngestion.generatedRecords.auditRecords : []),
    ].slice(0, 120);

    const updated = await updateCaseManagementWikiIngestionReview(req.user.id, baseIngestion.fileId, {
      archive: nextArchive,
      'wikiPage.archive': nextArchive,
      'generatedRecords.frontendRecord.archive': nextArchive,
      'generatedRecords.auditRecords': nextAuditRecords,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }

    return res.status(200).json({
      updated,
      wikiIngestionRecord: makeFrontendIngestionRecord(updated),
      articleDraftPreview: draftPreview,
      summary: {
        draftPreviewId: draftPreview.id,
        status: draftPreview.status,
        targetSourceId: draftPreview.targetSourceId,
        targetTitle: draftPreview.targetTitle,
        sectionCount: draftPreview.sections.length,
        reviewedCitationCount: draftPreview.reviewedCitationCount,
        pendingChunkCount: draftPreview.pendingChunkCount,
        blockedChunkCount: draftPreview.blockedChunkCount,
        metadataOnlySourceCount: draftPreview.metadataOnlySourceCount,
        requiresHumanPromotionConfirmation: true,
        destructiveFileAction: false,
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
        attachmentWrite: false,
        fileAction: false,
      },
      generatedRecords: {
        noteRecords: [updated.generatedRecords?.note].filter(Boolean),
        documentRecords: [updated.generatedRecords?.document].filter(Boolean),
        timelineRecords: [updated.generatedRecords?.timeline].filter(Boolean),
        auditRecords: [auditRecord],
      },
      policy:
        'This saved an article draft preview only. It did not publish article prose, call a model, write vectors, write Neo4j, attach records, move files, or delete anything.',
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to prepare Case Wiki article draft preview', error);
    return res.status(500).json({ error: 'Failed to prepare Case Wiki article draft preview' });
  }
});

router.patch('/wiki/ingestions/:fileId/archive/article-consolidation/promotion-readiness', async (req, res) => {
  try {
    if (req.body?.confirmArticlePromotionReadiness !== true) {
      return res.status(400).json({ error: 'Confirm the article promotion readiness review before updating source metadata' });
    }

    const existingIngestions = await getCaseManagementWikiIngestions(req.user.id);
    const existingByFileId = new Map(existingIngestions.map((ingestion) => [ingestion.fileId, ingestion]));
    const baseIngestion = existingByFileId.get(req.params.fileId);
    if (!baseIngestion) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }
    if (!isBatchReviewEligibleSource(baseIngestion)) {
      return res.status(400).json({ error: 'Choose a standalone source document before reviewing article promotion readiness' });
    }

    const baseArchive = archiveForWikiIngestion(baseIngestion);
    const existingPlan = baseArchive.articleConsolidation || {};
    const draftPreview = existingPlan.articleDraftPreview || {};
    const promotionReadiness = buildArticlePromotionReadinessReview({
      targetIngestion: baseIngestion,
      plan: existingPlan,
      draftPreview,
    });
    if (promotionReadiness.error) {
      return res.status(409).json({
        error: promotionReadiness.error,
        blockedReasons: promotionReadiness.blockedReasons,
        policy: 'Promotion readiness reviews need a saved draft preview and never publish article prose.',
      });
    }

    const nextArticleConsolidation = {
      ...existingPlan,
      status:
        promotionReadiness.status === 'ready-for-human-promotion'
          ? 'promotion-readiness-ready'
          : 'promotion-readiness-needs-review',
      articlePromotionReadiness: promotionReadiness,
    };
    const nextArchive = {
      ...baseArchive,
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'Current worker',
      articleConsolidation: nextArticleConsolidation,
    };
    const auditRecord = makeCaseWikiAuditRecord({
      action: 'prepared article promotion readiness review',
      object: wikiIngestionTitle(baseIngestion),
    });
    const nextAuditRecords = [
      auditRecord,
      ...(Array.isArray(baseIngestion.generatedRecords?.auditRecords) ? baseIngestion.generatedRecords.auditRecords : []),
    ].slice(0, 120);

    const updated = await updateCaseManagementWikiIngestionReview(req.user.id, baseIngestion.fileId, {
      archive: nextArchive,
      'wikiPage.archive': nextArchive,
      'generatedRecords.frontendRecord.archive': nextArchive,
      'generatedRecords.auditRecords': nextAuditRecords,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }

    return res.status(200).json({
      updated,
      wikiIngestionRecord: makeFrontendIngestionRecord(updated),
      articlePromotionReadiness: promotionReadiness,
      summary: {
        readinessId: promotionReadiness.id,
        status: promotionReadiness.status,
        targetSourceId: promotionReadiness.targetSourceId,
        targetTitle: promotionReadiness.targetTitle,
        checklistCount: promotionReadiness.checklist.length,
        blockedReasonCount: promotionReadiness.blockedReasons.length,
        warningCount: promotionReadiness.warnings.length,
        reviewedCitationCount: promotionReadiness.reviewedCitationCount,
        sectionCount: promotionReadiness.sectionCount,
        publishableSectionCount: promotionReadiness.publishableSectionCount,
        pendingChunkCount: promotionReadiness.pendingChunkCount,
        readyForHumanPromotion: promotionReadiness.readyForHumanPromotion,
        requiresHumanPromotionConfirmation: true,
        destructiveFileAction: false,
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
        attachmentWrite: false,
        fileAction: false,
      },
      generatedRecords: {
        noteRecords: [updated.generatedRecords?.note].filter(Boolean),
        documentRecords: [updated.generatedRecords?.document].filter(Boolean),
        timelineRecords: [updated.generatedRecords?.timeline].filter(Boolean),
        auditRecords: [auditRecord],
      },
      policy:
        'This saved a promotion readiness review only. It did not publish article prose, call a model, write vectors, write Neo4j, attach records, move files, or delete anything.',
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to prepare Case Wiki article promotion readiness review', error);
    return res.status(500).json({ error: 'Failed to prepare Case Wiki article promotion readiness review' });
  }
});

router.patch('/wiki/ingestions/:fileId/archive/article-consolidation/split-review', async (req, res) => {
  try {
    if (req.body?.confirmArticleSplitReview !== true) {
      return res.status(400).json({
        error: 'Confirm the article split review before updating source metadata',
        policy: 'Split review is metadata-only and keeps every source page intact.',
      });
    }

    const existingIngestions = await getCaseManagementWikiIngestions(req.user.id);
    const existingByFileId = new Map(existingIngestions.map((ingestion) => [ingestion.fileId, ingestion]));
    const baseIngestion = existingByFileId.get(req.params.fileId);
    if (!baseIngestion) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }
    if (!isBatchReviewEligibleSource(baseIngestion)) {
      return res.status(400).json({ error: 'Choose a standalone source document before preparing article split review' });
    }

    const baseArchive = archiveForWikiIngestion(baseIngestion);
    const existingPlan = baseArchive.articleConsolidation || {};
    const draftPreview = existingPlan.articleDraftPreview || {};
    const articleSplitReview = buildArticleSplitReviewPlan({
      targetIngestion: baseIngestion,
      plan: existingPlan,
      draftPreview,
    });
    if (articleSplitReview.error) {
      return res.status(409).json({
        error: articleSplitReview.error,
        blockedReasons: articleSplitReview.blockedReasons,
        policy: 'Article split reviews need a saved draft preview and never publish, embed, attach, move, or delete source records.',
      });
    }

    const nextArticleConsolidation = {
      ...existingPlan,
      status:
        articleSplitReview.status === 'split-review-ready'
          ? 'article-split-review-ready'
          : articleSplitReview.status === 'split-review-keeps-parent'
            ? 'article-split-review-keeps-parent'
            : 'article-split-review-needs-repair',
      articleSplitReview,
    };
    const nextArchive = {
      ...baseArchive,
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'Current worker',
      articleConsolidation: nextArticleConsolidation,
    };
    const auditRecord = makeCaseWikiAuditRecord({
      action: 'prepared article split review',
      object: wikiIngestionTitle(baseIngestion),
    });
    const nextAuditRecords = [
      auditRecord,
      ...(Array.isArray(baseIngestion.generatedRecords?.auditRecords) ? baseIngestion.generatedRecords.auditRecords : []),
    ].slice(0, 120);

    const updated = await updateCaseManagementWikiIngestionReview(req.user.id, baseIngestion.fileId, {
      archive: nextArchive,
      'wikiPage.archive': nextArchive,
      'generatedRecords.frontendRecord.archive': nextArchive,
      'generatedRecords.auditRecords': nextAuditRecords,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }

    return res.status(200).json({
      updated,
      wikiIngestionRecord: makeFrontendIngestionRecord(updated),
      articleSplitReview,
      summary: {
        splitReviewId: articleSplitReview.id,
        status: articleSplitReview.status,
        targetSourceId: articleSplitReview.targetSourceId,
        targetTitle: articleSplitReview.targetTitle,
        splitCandidateCount: articleSplitReview.splitCandidateCount,
        promotableSplitCount: articleSplitReview.promotableSplitCount,
        blockedReasonCount: articleSplitReview.blockedReasons.length,
        keepTogetherReasonCount: articleSplitReview.keepTogetherReasons.length,
        sourceCount: articleSplitReview.sourceCount,
        reviewedCitationCount: articleSplitReview.reviewedCitationCount,
        destructiveFileAction: false,
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
        attachmentWrite: false,
        fileAction: false,
      },
      generatedRecords: {
        noteRecords: [updated.generatedRecords?.note].filter(Boolean),
        documentRecords: [updated.generatedRecords?.document].filter(Boolean),
        timelineRecords: [updated.generatedRecords?.timeline].filter(Boolean),
        auditRecords: [auditRecord],
      },
      policy:
        'This saved a split-specific article review only. It did not publish article prose, call a model, write vectors, write Neo4j, attach records, move files, or delete anything.',
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to prepare Case Wiki article split review', error);
    return res.status(500).json({ error: 'Failed to prepare Case Wiki article split review' });
  }
});

router.post('/wiki/ingestions/:fileId/archive/article-consolidation/promotions', async (req, res) => {
  try {
    if (req.body?.confirmArticlePromotion !== true) {
      return res.status(400).json({
        error: 'Confirm article promotion before writing reviewed article prose into the Case Wiki.',
        policy: 'Article promotions are human-confirmed, citation-gated, and keep source documents intact.',
      });
    }

    const existingIngestions = await getCaseManagementWikiIngestions(req.user.id);
    const existingByFileId = new Map(existingIngestions.map((ingestion) => [ingestion.fileId, ingestion]));
    const baseIngestion = existingByFileId.get(req.params.fileId);
    if (!baseIngestion) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }
    if (!isBatchReviewEligibleSource(baseIngestion)) {
      return res.status(400).json({ error: 'Choose a standalone source document before promoting an article draft' });
    }

    const baseArchive = archiveForWikiIngestion(baseIngestion);
    const existingPlan = baseArchive.articleConsolidation || {};
    const draftPreview = existingPlan.articleDraftPreview || {};
    const promotionReadiness = existingPlan.articlePromotionReadiness || {};
    const promotionRecord = buildConfirmedArticlePromotionRecord({
      targetIngestion: baseIngestion,
      plan: existingPlan,
      draftPreview,
      promotionReadiness,
      actor: readStringField(req.body, 'actor') || 'Current worker',
    });

    if (promotionRecord.error) {
      return res.status(409).json({
        error: promotionRecord.error,
        blockedReasons: promotionRecord.blockedReasons,
        citationCoverageDiff: promotionRecord.citationCoverageDiff,
        policy: 'Only readiness-approved article drafts with reviewed citations can be promoted into permanent wiki sections.',
      });
    }

    const { workspace } = await getPatchableCaseManagementWorkspace(req.user.id);
    const existingPromotion = Array.isArray(workspace.wikiPromotionRecords)
      ? workspace.wikiPromotionRecords.find((item) => item?.pageId === promotionRecord.pageId || item?.id === promotionRecord.id)
      : null;
    const graphPreview = buildRetrievalPromotionGraph({
      promotionRecord: existingPromotion
        ? {
            ...promotionRecord,
            id: existingPromotion.id,
            pageId: existingPromotion.pageId || promotionRecord.pageId,
            createdAt: existingPromotion.createdAt || promotionRecord.createdAt,
            createdBy: existingPromotion.createdBy || promotionRecord.createdBy,
            version: (Number(existingPromotion.version) || 1) + 1,
            revisionId: `revision:${existingPromotion.id}:${(Number(existingPromotion.version) || 1) + 1}`,
          }
        : {
            ...promotionRecord,
            version: 1,
            revisionId: `revision:${promotionRecord.id}:1`,
          },
      userId: req.user.id,
    });
    const neo4j = graphPreview ? await writeCaseWikiGraphToNeo4j(graphPreview) : { status: 'skipped', message: 'No graph built' };
    const storedPromotionRecord = applyRetrievalPromotionVersioning({
      existingPromotion,
      incomingPromotion: promotionRecord,
      neo4j,
    });
    const graph = buildRetrievalPromotionGraph({ promotionRecord: storedPromotionRecord, userId: req.user.id });
    const actor = readStringField(req.body, 'actor') || storedPromotionRecord.createdBy || 'Current worker';
    const auditRecord = normalizeCaseWikiAuditRecord({
      id: `audit:${storedPromotionRecord.id}:article-promotion:${Date.now()}`,
      timestamp: storedPromotionRecord.updatedAt || storedPromotionRecord.createdAt,
      actor,
      action: existingPromotion ? 'updated promoted article consolidation topic' : 'promoted reviewed article consolidation draft',
      object: storedPromotionRecord.title,
      source: 'Case Wiki',
      status: 'completed',
      detail: `${storedPromotionRecord.citationLedger.length} reviewed citation${storedPromotionRecord.citationLedger.length === 1 ? '' : 's'} promoted into ${storedPromotionRecord.pageId} as version ${storedPromotionRecord.version || 1}. Source pages stayed intact.`,
    });

    const nextWorkspace = {
      ...workspace,
      savedAt: new Date().toISOString(),
      wikiPromotionRecords: mergePromotionRecordsByPageId(workspace.wikiPromotionRecords, [storedPromotionRecord]),
      auditRecords: mergeWorkspaceRecordsById(workspace.auditRecords, [auditRecord]),
    };
    const workspaceRecord = await saveCaseManagementWorkspace(req.user.id, nextWorkspace);
    const savedPromotionRecord =
      workspaceRecord.workspace?.wikiPromotionRecords?.find((item) => item.id === storedPromotionRecord.id) ||
      storedPromotionRecord;

    const articlePromotion = {
      promotionId: savedPromotionRecord.id,
      pageId: savedPromotionRecord.pageId,
      title: savedPromotionRecord.title,
      status: savedPromotionRecord.status,
      promotedAt: savedPromotionRecord.updatedAt || savedPromotionRecord.createdAt,
      promotedBy: actor,
      version: savedPromotionRecord.version || 1,
      revisionId: savedPromotionRecord.revisionId,
      sourceDocumentIds: savedPromotionRecord.sourceDocumentIds || [],
      citationCount: savedPromotionRecord.citationLedger?.length || 0,
      sectionCount: savedPromotionRecord.sections?.length || 0,
      neo4jStatus: savedPromotionRecord.neo4jStatus || neo4j.status,
      neo4jMessage: savedPromotionRecord.neo4jMessage || neo4j.message || neo4j.skippedReason || '',
      sourcePolicy: savedPromotionRecord.sourcePolicy,
      articleWrite: true,
      graphWrite: true,
      vectorWrite: false,
      attachmentWrite: false,
      fileAction: false,
    };
    const nextArticleConsolidation = {
      ...existingPlan,
      status: 'article-promoted',
      articlePromotion,
    };
    const nextArchive = {
      ...baseArchive,
      reviewedAt: new Date().toISOString(),
      reviewedBy: actor,
      articleConsolidation: nextArticleConsolidation,
    };
    const nextAuditRecords = [
      auditRecord,
      ...(Array.isArray(baseIngestion.generatedRecords?.auditRecords) ? baseIngestion.generatedRecords.auditRecords : []),
    ].slice(0, 120);
    const updatedIngestion = await updateCaseManagementWikiIngestionReview(req.user.id, baseIngestion.fileId, {
      archive: nextArchive,
      'wikiPage.archive': nextArchive,
      'generatedRecords.frontendRecord.archive': nextArchive,
      'generatedRecords.auditRecords': nextAuditRecords,
    });
    if (!updatedIngestion) {
      return res.status(404).json({ error: 'Case Wiki source document not found after promotion' });
    }

    return res.status(200).json({
      promotionRecord: savedPromotionRecord,
      wikiIngestionRecord: makeFrontendIngestionRecord(updatedIngestion),
      articlePromotion,
      generatedRecords: {
        auditRecords: [auditRecord],
      },
      neo4j,
      graph,
      summary: {
        promotionId: savedPromotionRecord.id,
        pageId: savedPromotionRecord.pageId,
        targetTitle: savedPromotionRecord.title,
        version: savedPromotionRecord.version || 1,
        citationCount: savedPromotionRecord.citationLedger?.length || 0,
        sectionCount: savedPromotionRecord.sections?.length || 0,
        articleWrite: true,
        graphWrite: true,
        vectorWrite: false,
        attachmentWrite: false,
        fileAction: false,
      },
      policy:
        'This write stored a human-confirmed Case Wiki article promotion and wrote its article graph. It kept source pages intact as citations and did not attach documents to clients/cases, approve candidate chunks, write vectors, move files, or delete anything.',
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to promote reviewed article consolidation draft', error);
    return res.status(500).json({ error: 'Failed to promote reviewed article consolidation draft into the Case Wiki' });
  }
});

router.patch('/wiki/ingestions/:fileId/archive', async (req, res) => {
  try {
    const action = readStringField(req.body, 'action');
    const existingIngestions = await getCaseManagementWikiIngestions(req.user.id);
    const existing = existingIngestions.find((ingestion) => ingestion.fileId === req.params.fileId);
    if (!existing) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }

    const attachmentTarget = action === 'attach-to-record' ? normalizeArchiveAttachmentTarget(req.body?.target) : null;
    if (action === 'attach-to-record' && !attachmentTarget) {
      return res.status(400).json({ error: 'Choose a valid client, case, service, or project target before attaching this source' });
    }
    let canonicalSource =
      action === 'mark-superseded-by-source' ? normalizeCanonicalSourceTarget(req.body?.source) : null;
    if (action === 'mark-superseded-by-source' && !canonicalSource) {
      return res.status(400).json({ error: 'Choose a valid canonical source before marking this source as superseded' });
    }
    const lifeDomainMoveTarget =
      action === 'apply-life-domain-move' ? normalizeLifeDomainMoveTarget(req.body?.target) : null;
    if (action === 'apply-life-domain-move' && req.body?.confirmLifeDomainMove !== true) {
      return res.status(400).json({ error: 'Confirm the Life Domain move before updating this source shelf' });
    }
    if (action === 'apply-life-domain-move' && !lifeDomainMoveTarget) {
      return res.status(400).json({ error: 'Choose a valid target Life Domain before applying this source move' });
    }
    let canonicalIngestion = null;
    if (canonicalSource) {
      canonicalIngestion = existingIngestions.find((ingestion) => ingestion.fileId === canonicalSource.sourceId);
      if (!canonicalIngestion || canonicalIngestion.fileId === existing.fileId) {
        return res.status(400).json({ error: 'Choose a different source from the current Case Wiki archive' });
      }
      canonicalSource = {
        sourceId: canonicalIngestion.fileId,
        sourceLabel:
          canonicalIngestion.archive?.suggestedWikiTitle ||
          canonicalIngestion.generatedRecords?.frontendRecord?.title ||
          canonicalIngestion.originalName ||
          canonicalSource.sourceLabel,
        sourcePageId:
          canonicalIngestion.generatedRecords?.frontendRecord?.pageId ||
          canonicalIngestion.wikiPage?.id ||
          canonicalSource.sourcePageId,
        sourceHash: canonicalIngestion.sha256 || canonicalIngestion.generatedRecords?.frontendRecord?.sourceHash || canonicalSource.sourceHash,
      };
    }
    const existingArchive = existing.archive || existing.generatedRecords?.frontendRecord?.archive || {};
    const existingLineage = existingArchive.canonicalLineage || existingArchive.cleanupDecision?.canonicalLineage || null;
    const canonicalArchiveForLineage = canonicalIngestion ? archiveForWikiIngestion(canonicalIngestion) : {};
    const canonicalLineage =
      action === 'mark-superseded-by-source' && canonicalIngestion
        ? buildCanonicalLineageRecord({
            canonicalIngestion,
            canonicalSource,
            duplicateIngestions: [existing],
            existingLineage:
              existingLineage ||
              canonicalArchiveForLineage.canonicalLineage ||
              canonicalArchiveForLineage.cleanupDecision?.canonicalLineage ||
              null,
          })
        : null;

    const actionPatch = archivePatchForAction(
      action,
      existingArchive,
      attachmentTarget,
      canonicalSource,
      canonicalLineage,
      lifeDomainMoveTarget,
    );
    if (!actionPatch) {
      return res.status(400).json({ error: 'Unsupported archive review action' });
    }
    if (!archiveReviewStatuses.has(actionPatch.reviewStatus)) {
      return res.status(400).json({ error: 'Unsupported archive review status' });
    }

    const auditRecord = makeCaseWikiAuditRecord({
      action: archiveReviewAuditAction(action, actionPatch, attachmentTarget),
      object: existing.originalName || existing.generatedRecords?.frontendRecord?.fileName || req.params.fileId,
    });
    const auditRecords = [
      auditRecord,
      ...(Array.isArray(existing.generatedRecords?.auditRecords) ? existing.generatedRecords.auditRecords : []),
    ].slice(0, 120);
    const reviewUpdates =
      action === 'attach-to-record' || action === 'keep-standalone' || action === 'mark-reviewed' || action === 'reopen-review'
        ? caseWikiReviewUpdates(existing, actionPatch, attachmentTarget)
        : {
            archive: actionPatch,
            'wikiPage.archive': actionPatch,
            'generatedRecords.frontendRecord.archive': actionPatch,
          };
    if (action === 'apply-life-domain-move') {
      reviewUpdates.lifeDomain = actionPatch.lifeDomain;
      reviewUpdates.lifeDomainId = actionPatch.lifeDomainId;
      reviewUpdates['wikiPage.lifeDomain'] = actionPatch.lifeDomain;
      reviewUpdates['wikiPage.lifeDomainId'] = actionPatch.lifeDomainId;
      reviewUpdates['generatedRecords.frontendRecord.lifeDomain'] = actionPatch.lifeDomain;
      reviewUpdates['generatedRecords.frontendRecord.lifeDomainId'] = actionPatch.lifeDomainId;
    }
    reviewUpdates['generatedRecords.auditRecords'] = auditRecords;
    if (action === 'exclude-from-embedding') {
      const embeddingReview = embeddingReviewPatchForAction('do-not-embed-source', makeFallbackEmbeddingReview(existing));
      if (embeddingReview) {
        reviewUpdates.embeddingReview = embeddingReview;
        reviewUpdates['generatedRecords.frontendRecord.embeddingReview'] = embeddingReview;
      }
    }

    const updated = await updateCaseManagementWikiIngestionReview(req.user.id, req.params.fileId, reviewUpdates);
    if (!updated) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }
    let reviewGraph = null;
    if (action === 'attach-to-record') {
      const graph = attachmentGraphForReview(updated, actionPatch, attachmentTarget);
      if (graph) {
        reviewGraph = await writeCaseWikiGraphToNeo4j(graph);
      }
    }
    return res.status(200).json({
      ingestion: updated,
      wikiIngestionRecord: makeFrontendIngestionRecord(updated),
      reviewGraph,
      generatedRecords: {
        noteRecords: updated.generatedRecords?.note ? [updated.generatedRecords.note] : [],
        documentRecords: updated.generatedRecords?.document ? [updated.generatedRecords.document] : [],
        timelineRecords: updated.generatedRecords?.timeline ? [updated.generatedRecords.timeline] : [],
        auditRecords: [auditRecord],
      },
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to update wiki archive review', error);
    return res.status(500).json({ error: 'Failed to update Case Wiki archive review' });
  }
});

router.patch('/wiki/ingestions/:fileId/relationship-review', async (req, res) => {
  try {
    const status = relationshipReviewStatusFromRequest(req.body);
    if (!relationshipReviewStatuses.has(status)) {
      return res.status(400).json({ error: 'Choose approve or reject before saving a relationship review' });
    }

    const relationship = normalizeRelationshipReviewTarget(req.body?.relationship);
    if (!relationship) {
      return res.status(400).json({ error: 'Choose a valid graph relationship before saving review' });
    }

    const existingIngestions = await getCaseManagementWikiIngestions(req.user.id);
    const existing = existingIngestions.find((ingestion) => ingestion.fileId === req.params.fileId);
    if (!existing) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }

    const archive = archiveForWikiIngestion(existing);
    const sourceTitle =
      archive.suggestedWikiTitle ||
      existing.wikiPage?.title ||
      existing.generatedRecords?.frontendRecord?.title ||
      existing.originalName ||
      req.params.fileId;
    const now = new Date().toISOString();
    const relationshipKey =
      typeof req.body?.relationshipKey === 'string' && req.body.relationshipKey.trim()
        ? req.body.relationshipKey.trim()
        : makeRelationshipReviewKey(existing.fileId, relationship);
    const existingReviewRecords = relationshipReviewRecordsForIngestion(existing);
    const previousRecord = existingReviewRecords.find((record) => record.relationshipKey === relationshipKey);
    const relationshipReviewRecord = relationshipReviewRecordForDecision({
      existing,
      archive,
      sourceTitle,
      relationship,
      relationshipKey,
      status,
      previousRecord,
      now,
    });
    const relationshipReviewRecords = [
      relationshipReviewRecord,
      ...existingReviewRecords.filter((record) => record.relationshipKey !== relationshipKey),
    ].slice(0, 300);

    const auditRecord = makeCaseWikiAuditRecord({
      action: relationshipReviewAuditAction(status),
      object: `${sourceTitle}: ${relationshipReviewRecord.from} -> ${relationshipReviewRecord.label} -> ${relationshipReviewRecord.to}`,
    });
    const auditRecords = [
      auditRecord,
      ...(Array.isArray(existing.generatedRecords?.auditRecords) ? existing.generatedRecords.auditRecords : []),
    ].slice(0, 120);

    const updated = await updateCaseManagementWikiIngestionReview(req.user.id, req.params.fileId, {
      relationshipReviewRecords,
      'generatedRecords.frontendRecord.relationshipReviewRecords': relationshipReviewRecords,
      'generatedRecords.auditRecords': auditRecords,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }

    const graph = relationshipReviewGraphForDecision(updated, relationshipReviewRecord);
    const reviewGraph = graph ? await writeCaseWikiGraphToNeo4j(graph) : null;
    return res.status(200).json({
      ingestion: updated,
      wikiIngestionRecord: makeFrontendIngestionRecord(updated),
      relationshipReviewRecord,
      reviewGraph,
      generatedRecords: {
        auditRecords: [auditRecord],
      },
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to update wiki relationship review', error);
    return res.status(500).json({ error: 'Failed to update Case Wiki relationship review' });
  }
});

router.patch('/wiki/ingestions/:fileId/relationship-review/batch', async (req, res) => {
  try {
    const status = relationshipReviewStatusFromRequest(req.body);
    if (!relationshipReviewStatuses.has(status)) {
      return res.status(400).json({ error: 'Choose approve or reject before saving relationship reviews' });
    }

    const relationshipInputs = Array.isArray(req.body?.relationships) ? req.body.relationships.slice(0, 80) : [];
    if (!relationshipInputs.length) {
      return res.status(400).json({ error: 'Choose at least one graph relationship before batch review' });
    }

    const normalizedRelationships = relationshipInputs
      .map((item) => {
        const relationship = normalizeRelationshipReviewTarget(item?.relationship || item);
        if (!relationship) return null;
        const relationshipKey = typeof item?.relationshipKey === 'string' && item.relationshipKey.trim()
          ? item.relationshipKey.trim()
          : '';
        return { relationship, relationshipKey };
      })
      .filter(Boolean);

    if (!normalizedRelationships.length) {
      return res.status(400).json({ error: 'Choose valid graph relationships before batch review' });
    }

    const existingIngestions = await getCaseManagementWikiIngestions(req.user.id);
    const existing = existingIngestions.find((ingestion) => ingestion.fileId === req.params.fileId);
    if (!existing) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }

    const archive = archiveForWikiIngestion(existing);
    const sourceTitle =
      archive.suggestedWikiTitle ||
      existing.wikiPage?.title ||
      existing.generatedRecords?.frontendRecord?.title ||
      existing.originalName ||
      req.params.fileId;
    const now = new Date().toISOString();
    const existingReviewRecords = relationshipReviewRecordsForIngestion(existing);
    const existingByKey = new Map(existingReviewRecords.map((record) => [record.relationshipKey, record]));
    const batchByKey = new Map();
    normalizedRelationships.forEach(({ relationship, relationshipKey }) => {
      const key = relationshipKey || makeRelationshipReviewKey(existing.fileId, relationship);
      if (!key) return;
      batchByKey.set(
        key,
        relationshipReviewRecordForDecision({
          existing,
          archive,
          sourceTitle,
          relationship,
          relationshipKey: key,
          status,
          previousRecord: existingByKey.get(key),
          now,
        }),
      );
    });

    const reviewedRecords = Array.from(batchByKey.values());
    if (!reviewedRecords.length) {
      return res.status(400).json({ error: 'Choose valid graph relationships before batch review' });
    }

    const reviewedKeys = new Set(reviewedRecords.map((record) => record.relationshipKey));
    const relationshipReviewRecords = [
      ...reviewedRecords,
      ...existingReviewRecords.filter((record) => !reviewedKeys.has(record.relationshipKey)),
    ].slice(0, 300);

    const auditRecordsForBatch = reviewedRecords.map((record) =>
      makeCaseWikiAuditRecord({
        action: relationshipReviewAuditAction(status),
        object: `${sourceTitle}: ${record.from} -> ${record.label} -> ${record.to}`,
      }),
    );
    const auditRecords = [
      ...auditRecordsForBatch,
      ...(Array.isArray(existing.generatedRecords?.auditRecords) ? existing.generatedRecords.auditRecords : []),
    ].slice(0, 120);

    const updated = await updateCaseManagementWikiIngestionReview(req.user.id, req.params.fileId, {
      relationshipReviewRecords,
      'generatedRecords.frontendRecord.relationshipReviewRecords': relationshipReviewRecords,
      'generatedRecords.auditRecords': auditRecords,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }

    const reviewGraphInput = mergeCaseWikiGraphs(
      reviewedRecords.map((record) => relationshipReviewGraphForDecision(updated, record)),
    );
    const reviewGraph = reviewGraphInput.nodes.length || reviewGraphInput.edges.length
      ? await writeCaseWikiGraphToNeo4j(reviewGraphInput)
      : null;

    return res.status(200).json({
      ingestion: updated,
      wikiIngestionRecord: makeFrontendIngestionRecord(updated),
      relationshipReviewRecords: reviewedRecords,
      reviewGraph,
      generatedRecords: {
        auditRecords: auditRecordsForBatch,
      },
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to batch update wiki relationship reviews', error);
    return res.status(500).json({ error: 'Failed to batch update Case Wiki relationship reviews' });
  }
});

router.post('/wiki/ingestions/archive/extract/batch', async (req, res) => {
  try {
    const fileIds = readUniqueStringArray(req.body, 'fileIds', WIKI_LOCAL_ARCHIVE_EXTRACT_LIMIT);
    if (!fileIds.length) {
      return res.status(400).json({ error: 'Choose at least one local archive source to extract' });
    }

    const existingIngestions = await getCaseManagementWikiIngestions(req.user.id);
    const existingByFileId = new Map(existingIngestions.map((ingestion) => [ingestion.fileId, ingestion]));
    const updated = [];
    const wikiIngestionRecords = [];
    const noteRecords = [];
    const documentRecords = [];
    const timelineRecords = [];
    const auditRecordsForBatch = [];
    const neo4jResults = [];
    const skipped = [];
    const failed = [];

    for (const fileId of fileIds) {
      const existing = existingByFileId.get(fileId);
      if (!existing) {
        skipped.push({ fileId, reason: 'source-not-found' });
        continue;
      }

      const archive = archiveForWikiIngestion(existing);
      const localArchive = archive.localArchive || existing.generatedRecords?.frontendRecord?.archive?.localArchive;
      if (!localArchive?.rootId || !localArchive?.relativePath) {
        skipped.push({ fileId, reason: 'not-linked-to-local-archive' });
        continue;
      }
      if (
        archive.importReadiness === 'blocked-sensitive' ||
        (Array.isArray(archive.cleanupSignals) && archive.cleanupSignals.includes('sensitive-credential-review'))
      ) {
        skipped.push({ fileId, reason: 'blocked-sensitive' });
        continue;
      }

      try {
        const localFile = await resolveLocalArchiveFile({
          rootId: localArchive.rootId,
          relativePath: localArchive.relativePath,
        });
        const normalizedContext = parseWikiIngestContextObject({
          ...(existing.privacy || {}),
          ...(req.body?.context || {}),
          sourceScope: 'standalone',
          privacyLevel: req.body?.context?.privacyLevel || existing.privacy?.privacyLevel || 'personal',
          redactionMode: req.body?.context?.redactionMode || existing.privacy?.redactionMode || 'strict',
          retentionPolicy: req.body?.context?.retentionPolicy || existing.privacy?.retentionPolicy || 'review-source',
        });
        const extracted = await buildCaseWikiLocalArchiveExtractionRecord({
          existing,
          localFile,
          userId: req.user.id,
          context: normalizedContext,
          writeGraph: true,
        });
        const auditRecord = makeCaseWikiAuditRecord({
          action: 'batch extracted local archive source for review',
          object: extracted.originalName || existing.originalName || fileId,
        });
        const auditRecords = [
          auditRecord,
          ...(Array.isArray(existing.generatedRecords?.auditRecords) ? existing.generatedRecords.auditRecords : []),
        ].slice(0, 120);
        const updatedGeneratedRecords = {
          ...(extracted.generatedRecords || {}),
          auditRecords,
        };
        const updatedIngestion = await updateCaseManagementWikiIngestionReview(req.user.id, fileId, {
          originalName: extracted.originalName,
          storedName: extracted.storedName,
          mimeType: extracted.mimeType,
          size: extracted.size,
          sha256: extracted.sha256,
          path: extracted.path,
          linkedClientId: '',
          linkedCaseId: '',
          linkedServiceName: '',
          sourceScope: 'standalone',
          sourcePageId: '',
          archive: extracted.archive,
          vectorIndex: extracted.vectorIndex,
          embeddingReview: extracted.embeddingReview,
          weaviateDryRun: null,
          privacy: extracted.privacy,
          extraction: extracted.extraction,
          wikiPage: extracted.wikiPage,
          generatedRecords: updatedGeneratedRecords,
          graph: extracted.graph,
          graphSummary: extracted.graphSummary,
          neo4j: extracted.neo4j,
        });
        if (!updatedIngestion) {
          skipped.push({ fileId, reason: 'source-not-found' });
          continue;
        }

        updated.push(updatedIngestion);
        wikiIngestionRecords.push(makeFrontendIngestionRecord(updatedIngestion));
        if (updatedIngestion.generatedRecords?.note) noteRecords.push(updatedIngestion.generatedRecords.note);
        if (updatedIngestion.generatedRecords?.document) documentRecords.push(updatedIngestion.generatedRecords.document);
        if (updatedIngestion.generatedRecords?.timeline) timelineRecords.push(updatedIngestion.generatedRecords.timeline);
        auditRecordsForBatch.push(auditRecord);
        neo4jResults.push({
          fileId,
          status: extracted.neo4j?.status || '',
          nodeCount: extracted.neo4j?.nodeCount || 0,
          edgeCount: extracted.neo4j?.edgeCount || 0,
        });
      } catch (error) {
        logger.warn('[caseManagement] Failed to batch extract local archive source', {
          fileId,
          error: error.message,
        });
        failed.push({ fileId, reason: error.message || 'extract-failed' });
      }
    }

    const chunkedCount = updated.filter((ingestion) => (ingestion.embeddingReview?.chunks || []).length > 0).length;
    const totalReviewChunks = updated.reduce(
      (total, ingestion) => total + (ingestion.embeddingReview?.chunks || []).length,
      0,
    );

    return res.status(200).json({
      updated,
      wikiIngestionRecords,
      skipped,
      failed,
      neo4j: neo4jResults,
      summary: {
        requested: fileIds.length,
        extracted: updated.length,
        chunked: chunkedCount,
        metadataOnly: Math.max(0, updated.length - chunkedCount),
        totalReviewChunks,
        skipped: skipped.length,
        failed: failed.length,
        limit: WIKI_LOCAL_ARCHIVE_EXTRACT_LIMIT,
      },
      generatedRecords: {
        noteRecords,
        documentRecords,
        timelineRecords,
        auditRecords: auditRecordsForBatch,
      },
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to batch extract local archive wiki sources', error);
    return res.status(500).json({ error: 'Failed to batch extract local archive wiki sources' });
  }
});

router.post('/wiki/ingestions/:fileId/extract', async (req, res) => {
  try {
    const existingIngestions = await getCaseManagementWikiIngestions(req.user.id);
    const existing = existingIngestions.find((ingestion) => ingestion.fileId === req.params.fileId);
    if (!existing) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }

    const archive = archiveForWikiIngestion(existing);
    const localArchive = archive.localArchive || existing.generatedRecords?.frontendRecord?.archive?.localArchive;
    if (!localArchive?.rootId || !localArchive?.relativePath) {
      return res.status(400).json({ error: 'This Case Wiki source is not linked to a local archive file' });
    }
    if (
      archive.importReadiness === 'blocked-sensitive' ||
      (Array.isArray(archive.cleanupSignals) && archive.cleanupSignals.includes('sensitive-credential-review'))
    ) {
      return res.status(400).json({ error: 'Credential-like local archive files are blocked from extraction' });
    }

    const localFile = await resolveLocalArchiveFile({
      rootId: localArchive.rootId,
      relativePath: localArchive.relativePath,
    });
    const normalizedContext = parseWikiIngestContextObject({
      ...(existing.privacy || {}),
      ...(req.body?.context || {}),
      sourceScope: 'standalone',
      privacyLevel: req.body?.context?.privacyLevel || existing.privacy?.privacyLevel || 'personal',
      redactionMode: req.body?.context?.redactionMode || existing.privacy?.redactionMode || 'strict',
      retentionPolicy: req.body?.context?.retentionPolicy || existing.privacy?.retentionPolicy || 'review-source',
    });
    const extracted = await buildCaseWikiLocalArchiveExtractionRecord({
      existing,
      localFile,
      userId: req.user.id,
      context: normalizedContext,
      writeGraph: true,
    });
    const auditRecord = makeCaseWikiAuditRecord({
      action: 'extracted local archive source for review',
      object: extracted.originalName || existing.originalName || req.params.fileId,
    });
    const auditRecords = [
      auditRecord,
      ...(Array.isArray(existing.generatedRecords?.auditRecords) ? existing.generatedRecords.auditRecords : []),
    ].slice(0, 120);
    const updatedGeneratedRecords = {
      ...(extracted.generatedRecords || {}),
      auditRecords,
    };

    const updated = await updateCaseManagementWikiIngestionReview(req.user.id, req.params.fileId, {
      originalName: extracted.originalName,
      storedName: extracted.storedName,
      mimeType: extracted.mimeType,
      size: extracted.size,
      sha256: extracted.sha256,
      path: extracted.path,
      linkedClientId: '',
      linkedCaseId: '',
      linkedServiceName: '',
      sourceScope: 'standalone',
      sourcePageId: '',
      archive: extracted.archive,
      vectorIndex: extracted.vectorIndex,
      embeddingReview: extracted.embeddingReview,
      weaviateDryRun: null,
      privacy: extracted.privacy,
      extraction: extracted.extraction,
      wikiPage: extracted.wikiPage,
      generatedRecords: updatedGeneratedRecords,
      graph: extracted.graph,
      graphSummary: extracted.graphSummary,
      neo4j: extracted.neo4j,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }

    return res.status(200).json({
      ingestion: updated,
      wikiIngestionRecord: makeFrontendIngestionRecord(updated),
      neo4j: extracted.neo4j,
      generatedRecords: {
        noteRecords: updated.generatedRecords?.note ? [updated.generatedRecords.note] : [],
        documentRecords: updated.generatedRecords?.document ? [updated.generatedRecords.document] : [],
        timelineRecords: updated.generatedRecords?.timeline ? [updated.generatedRecords.timeline] : [],
        auditRecords: [auditRecord],
      },
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to extract local archive wiki source', error);
    return res.status(500).json({ error: error.message || 'Failed to extract local archive wiki source' });
  }
});

router.patch('/wiki/ingestions/:fileId/embedding-review', async (req, res) => {
  try {
    const action = readStringField(req.body, 'action');
    const chunkId = readStringField(req.body, 'chunkId');
    const chunkIds = readUniqueStringArray(req.body, 'chunkIds', 500);
    const chunkPatch = {
      textPreview: readStringField(req.body, 'textPreview'),
      reviewNote: readStringField(req.body, 'reviewNote'),
      privacyLevel: readStringField(req.body, 'privacyLevel'),
      redactionMode: readStringField(req.body, 'redactionMode'),
    };
    const existingIngestions = await getCaseManagementWikiIngestions(req.user.id);
    const existing = existingIngestions.find((ingestion) => ingestion.fileId === req.params.fileId);
    if (!existing) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }

    const existingReview =
      existing.embeddingReview ||
      existing.generatedRecords?.frontendRecord?.embeddingReview ||
      makeFallbackEmbeddingReview(existing);
    if (action === 'sync-embedding-graph') {
      const existingDryRun =
        existing.weaviateDryRun ||
        existing.generatedRecords?.frontendRecord?.weaviateDryRun ||
        existingReview.weaviateDryRun ||
        null;
      const existingVectorWrite =
        existingReview.vectorWrite ||
        (existing.vectorIndex?.status && ['written', 'partial'].includes(existing.vectorIndex.status)
          ? existing.vectorIndex
          : null);
      const reviewForGraphSync = {
        ...summarizeEmbeddingReview(existingReview),
        weaviateDryRun: existingDryRun,
      };
      const embeddingReviewGraphSync = await syncCaseWikiEmbeddingReviewGraph({
        ingestion: existing,
        embeddingReview: reviewForGraphSync,
        weaviateDryRun: existingDryRun,
        vectorWrite: existingVectorWrite,
        action,
      });
      const reviewWithGraphSync = {
        ...reviewForGraphSync,
        graphSync: embeddingReviewGraphSync.graphSync,
      };
      const auditRecord = makeCaseWikiAuditRecord({
        action: 'refreshed embedding review graph sync',
        object: existing.originalName || existing.generatedRecords?.frontendRecord?.fileName || req.params.fileId,
        status: embeddingReviewGraphSync.graphSync.status,
        detail: embeddingReviewGraphSync.graphSync.message,
      });
      const auditRecords = [
        auditRecord,
        ...(Array.isArray(existing.generatedRecords?.auditRecords) ? existing.generatedRecords.auditRecords : []),
      ].slice(0, 120);

      const updated = await updateCaseManagementWikiIngestionReview(req.user.id, req.params.fileId, {
        embeddingReview: reviewWithGraphSync,
        'generatedRecords.frontendRecord.embeddingReview': reviewWithGraphSync,
        'generatedRecords.frontendRecord.embeddingReviewGraphStatus': embeddingReviewGraphSync.graphSync.status,
        'generatedRecords.frontendRecord.embeddingReviewGraphMessage': embeddingReviewGraphSync.graphSync.message,
        'generatedRecords.auditRecords': auditRecords,
      });
      if (!updated) {
        return res.status(404).json({ error: 'Case Wiki source document not found' });
      }

      return res.status(200).json({
        ingestion: updated,
        wikiIngestionRecord: makeFrontendIngestionRecord(updated),
        weaviateDryRun: existingDryRun,
        neo4j: embeddingReviewGraphSync.neo4j,
        embeddingReviewGraph: embeddingReviewGraphSync.builtGraph,
        generatedRecords: {
          auditRecords: [auditRecord],
        },
      });
    }

    if (action === 'delete-vector-chunks') {
      const vectorDelete = await deleteCaseWikiWeaviateObjects({
        ingestion: existing,
        vectorIndex: existing.vectorIndex || existing.generatedRecords?.frontendRecord?.vectorIndex || {},
        confirmDelete: req.body?.confirmVectorDelete === true,
      });

      if (!['deleted', 'partial'].includes(vectorDelete.status)) {
        return res.status(409).json({
          error: vectorDelete.message || 'Weaviate delete is blocked',
          vectorDelete,
          wikiIngestionRecord: makeFrontendIngestionRecord(existing),
        });
      }

      const now = new Date().toISOString();
      const existingDryRun =
        existing.weaviateDryRun ||
        existing.generatedRecords?.frontendRecord?.weaviateDryRun ||
        existingReview.weaviateDryRun ||
        prepareCaseWikiWeaviateDryRun({ ingestion: existing, embeddingReview: summarizeEmbeddingReview(existingReview) });
      const reviewForDelete = summarizeEmbeddingReview(existingReview);
      const reviewWithVectorDelete = {
        ...reviewForDelete,
        status: vectorDelete.status === 'deleted' ? reviewForDelete.status : 'partially-indexed-in-weaviate',
        writeMode: 'dry-run',
        writeEnabled: false,
        weaviateDryRun: existingDryRun,
        vectorWrite: null,
        vectorDelete,
        vectorDeletedAt: vectorDelete.deletedAt || now,
        vectorDeletedBy: vectorDelete.deletedBy || 'Current worker',
      };
      const embeddingReviewGraphSync = await syncCaseWikiEmbeddingReviewGraph({
        ingestion: existing,
        embeddingReview: reviewWithVectorDelete,
        weaviateDryRun: existingDryRun,
        action,
      });
      const reviewWithVectorDeleteAndGraph = {
        ...reviewWithVectorDelete,
        graphSync: embeddingReviewGraphSync.graphSync,
      };
      const remainingObjectIds =
        vectorDelete.status === 'deleted'
          ? []
          : compactStringArray(vectorDelete.failedObjectIds || existing.vectorIndex?.objectIds || []);
      const vectorIndex = {
        ...(existing.vectorIndex || {}),
        provider: vectorDelete.provider || CASE_WIKI_VECTOR_PROVIDER,
        status: vectorDelete.status === 'deleted' ? 'deleted' : 'partially-deleted',
        message: vectorDelete.message || '',
        chunkCount: remainingObjectIds.length,
        collection: vectorDelete.collection || existing.vectorIndex?.collection || '',
        endpoint: vectorDelete.endpoint || existing.vectorIndex?.endpoint || '',
        objectIds: remainingObjectIds,
        objectLedger: remainingObjectIds.length ? existing.vectorIndex?.objectLedger || [] : [],
        objectMap: remainingObjectIds.length ? existing.vectorIndex?.objectMap || {} : {},
        deletedObjectIds: vectorDelete.deletedObjectIds || [],
        failedObjectIds: vectorDelete.failedObjectIds || [],
        deletedAt: vectorDelete.deletedAt || now,
        deletedBy: vectorDelete.deletedBy || 'Current worker',
      };
      const auditRecord = makeCaseWikiAuditRecord({
        action: `deleted ${vectorDelete.deletedObjectCount || 0} Weaviate object${vectorDelete.deletedObjectCount === 1 ? '' : 's'}`,
        object: existing.originalName || existing.generatedRecords?.frontendRecord?.fileName || req.params.fileId,
        status: vectorDelete.status,
        detail: vectorDelete.message,
      });
      const auditRecords = [
        auditRecord,
        ...(Array.isArray(existing.generatedRecords?.auditRecords) ? existing.generatedRecords.auditRecords : []),
      ].slice(0, 120);

      const updated = await updateCaseManagementWikiIngestionReview(req.user.id, req.params.fileId, {
        embeddingReview: reviewWithVectorDeleteAndGraph,
        vectorIndex,
        weaviateDryRun: existingDryRun,
        'generatedRecords.frontendRecord.embeddingReview': reviewWithVectorDeleteAndGraph,
        'generatedRecords.frontendRecord.weaviateDryRun': existingDryRun,
        'generatedRecords.frontendRecord.vectorProvider': vectorIndex.provider,
        'generatedRecords.frontendRecord.vectorStatus': vectorIndex.status,
        'generatedRecords.frontendRecord.vectorMessage': vectorIndex.message,
        'generatedRecords.frontendRecord.vectorChunkCount': vectorIndex.chunkCount,
        'generatedRecords.frontendRecord.embeddingReviewGraphStatus': embeddingReviewGraphSync.graphSync.status,
        'generatedRecords.frontendRecord.embeddingReviewGraphMessage': embeddingReviewGraphSync.graphSync.message,
        'generatedRecords.auditRecords': auditRecords,
      });
      if (!updated) {
        return res.status(404).json({ error: 'Case Wiki source document not found' });
      }

      return res.status(200).json({
        ingestion: updated,
        wikiIngestionRecord: makeFrontendIngestionRecord(updated),
        weaviateDryRun: existingDryRun,
        vectorDelete,
        neo4j: embeddingReviewGraphSync.neo4j,
        embeddingReviewGraph: embeddingReviewGraphSync.builtGraph,
        generatedRecords: {
          auditRecords: [auditRecord],
        },
      });
    }

    if (action === 'write-approved-chunks') {
      const reviewForWrite = summarizeEmbeddingReview(existingReview);
      const vectorWrite = await writeCaseWikiApprovedChunksToWeaviate({
        ingestion: existing,
        embeddingReview: reviewForWrite,
        confirmWrite: req.body?.confirmVectorWrite === true,
      });

      if (!['written', 'partial'].includes(vectorWrite.status)) {
        return res.status(409).json({
          error: vectorWrite.message || 'Weaviate write is blocked',
          vectorWrite,
          wikiIngestionRecord: makeFrontendIngestionRecord(existing),
        });
      }

      const now = new Date().toISOString();
      const existingDryRun =
        existing.weaviateDryRun ||
        existing.generatedRecords?.frontendRecord?.weaviateDryRun ||
        existingReview.weaviateDryRun ||
        prepareCaseWikiWeaviateDryRun({ ingestion: existing, embeddingReview: reviewForWrite });
      const reviewWithVectorWrite = {
        ...reviewForWrite,
        status: vectorWrite.status === 'written' ? 'indexed-in-weaviate' : 'partially-indexed-in-weaviate',
        writeMode: 'live',
        writeEnabled: true,
        weaviateDryRun: existingDryRun,
        vectorWrite,
        vectorWrittenAt: vectorWrite.writtenAt || now,
        vectorWrittenBy: vectorWrite.writtenBy || 'Current worker',
      };
      const embeddingReviewGraphSync = await syncCaseWikiEmbeddingReviewGraph({
        ingestion: existing,
        embeddingReview: reviewWithVectorWrite,
        weaviateDryRun: existingDryRun,
        vectorWrite,
        action,
      });
      const reviewWithVectorWriteAndGraph = {
        ...reviewWithVectorWrite,
        graphSync: embeddingReviewGraphSync.graphSync,
      };
      const vectorIndex = {
        ...(existing.vectorIndex || {}),
        provider: vectorWrite.provider || CASE_WIKI_VECTOR_PROVIDER,
        status: vectorWrite.status,
        message: vectorWrite.message || '',
        chunkCount: vectorWrite.objectCount || 0,
        attemptedChunkCount: vectorWrite.attemptedObjectCount || vectorWrite.objectCount || 0,
        collection: vectorWrite.collection || vectorWrite.targetClass || '',
        endpoint: vectorWrite.endpoint || '',
        objectIds: vectorWrite.objectIds || [],
        objectLedger: vectorWrite.objectLedger || [],
        objectMap: vectorWrite.objectMap || {},
        objectFingerprint: vectorWrite.objectFingerprint || '',
        writtenAt: vectorWrite.writtenAt || now,
        writtenBy: vectorWrite.writtenBy || 'Current worker',
      };
      const auditRecord = makeCaseWikiAuditRecord({
        action: `wrote ${vectorWrite.objectCount || 0} approved chunk${vectorWrite.objectCount === 1 ? '' : 's'} to Weaviate`,
        object: existing.originalName || existing.generatedRecords?.frontendRecord?.fileName || req.params.fileId,
        status: vectorWrite.status,
        detail: vectorWrite.message,
      });
      const auditRecords = [
        auditRecord,
        ...(Array.isArray(existing.generatedRecords?.auditRecords) ? existing.generatedRecords.auditRecords : []),
      ].slice(0, 120);

      const updated = await updateCaseManagementWikiIngestionReview(req.user.id, req.params.fileId, {
        embeddingReview: reviewWithVectorWriteAndGraph,
        vectorIndex,
        weaviateDryRun: existingDryRun,
        'generatedRecords.frontendRecord.embeddingReview': reviewWithVectorWriteAndGraph,
        'generatedRecords.frontendRecord.weaviateDryRun': existingDryRun,
        'generatedRecords.frontendRecord.vectorProvider': vectorIndex.provider,
        'generatedRecords.frontendRecord.vectorStatus': vectorIndex.status,
        'generatedRecords.frontendRecord.vectorMessage': vectorIndex.message,
        'generatedRecords.frontendRecord.vectorChunkCount': vectorIndex.chunkCount,
        'generatedRecords.frontendRecord.embeddingReviewGraphStatus': embeddingReviewGraphSync.graphSync.status,
        'generatedRecords.frontendRecord.embeddingReviewGraphMessage': embeddingReviewGraphSync.graphSync.message,
        'generatedRecords.auditRecords': auditRecords,
      });
      if (!updated) {
        return res.status(404).json({ error: 'Case Wiki source document not found' });
      }

      return res.status(200).json({
        ingestion: updated,
        wikiIngestionRecord: makeFrontendIngestionRecord(updated),
        weaviateDryRun: existingDryRun,
        vectorWrite,
        neo4j: embeddingReviewGraphSync.neo4j,
        embeddingReviewGraph: embeddingReviewGraphSync.builtGraph,
        generatedRecords: {
          auditRecords: [auditRecord],
        },
      });
    }

    const nextReview = embeddingReviewPatchForAction(action, existingReview, chunkId, chunkIds, chunkPatch);
    if (!nextReview) {
      return res.status(400).json({ error: 'Unsupported embedding review action or chunk' });
    }

    const weaviateDryRun =
      nextReview.status === 'ready-for-vector-dry-run'
        ? prepareCaseWikiWeaviateDryRun({ ingestion: existing, embeddingReview: nextReview })
        : null;
    const reviewWithDryRun = {
      ...nextReview,
      weaviateDryRun,
    };
    const embeddingReviewGraphSync = await syncCaseWikiEmbeddingReviewGraph({
      ingestion: existing,
      embeddingReview: reviewWithDryRun,
      weaviateDryRun,
      action,
    });
    const reviewWithDryRunAndGraph = {
      ...reviewWithDryRun,
      graphSync: embeddingReviewGraphSync.graphSync,
    };
    const auditRecord = makeCaseWikiAuditRecord({
      action: embeddingReviewAuditAction(action, reviewWithDryRunAndGraph, weaviateDryRun),
      object: existing.originalName || existing.generatedRecords?.frontendRecord?.fileName || req.params.fileId,
    });
    const auditRecords = [
      auditRecord,
      ...(Array.isArray(existing.generatedRecords?.auditRecords) ? existing.generatedRecords.auditRecords : []),
    ].slice(0, 120);

    const updated = await updateCaseManagementWikiIngestionReview(req.user.id, req.params.fileId, {
      embeddingReview: reviewWithDryRunAndGraph,
      weaviateDryRun,
      'generatedRecords.frontendRecord.embeddingReview': reviewWithDryRunAndGraph,
      'generatedRecords.frontendRecord.weaviateDryRun': weaviateDryRun,
      'generatedRecords.frontendRecord.embeddingReviewGraphStatus': embeddingReviewGraphSync.graphSync.status,
      'generatedRecords.frontendRecord.embeddingReviewGraphMessage': embeddingReviewGraphSync.graphSync.message,
      'generatedRecords.auditRecords': auditRecords,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Case Wiki source document not found' });
    }

    return res.status(200).json({
      ingestion: updated,
      wikiIngestionRecord: makeFrontendIngestionRecord(updated),
      weaviateDryRun,
      neo4j: embeddingReviewGraphSync.neo4j,
      embeddingReviewGraph: embeddingReviewGraphSync.builtGraph,
      generatedRecords: {
        auditRecords: [auditRecord],
      },
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to update wiki embedding review', error);
    return res.status(500).json({ error: 'Failed to update Case Wiki embedding review' });
  }
});

router.post('/wiki/ingest/preview', caseWikiUpload.array('files', WIKI_INGEST_FILE_LIMIT), async (req, res) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ error: 'Upload at least one file for the Case Wiki to ingest' });
    }

    const context = parseWikiIngestContext(req);
    const builtIngestions = await Promise.all(
      req.files.map((file) =>
        buildCaseWikiUpload({
          file,
          userId: req.user.id,
          context: {
            ...context,
            reviewBeforeGraphWrite: true,
          },
          writeGraph: false,
        }),
      ),
    );
    const wikiIngestionRecords = builtIngestions.map((ingestion) => ingestion.generatedRecords.frontendRecord);

    return res.status(200).json({
      wikiIngestionRecords,
      graphPreviews: builtIngestions.map(makeGraphPreviewRecord),
      neo4j: builtIngestions.map((ingestion) => ingestion.neo4j),
      generatedRecords: {
        noteRecords: builtIngestions.map((ingestion) => ingestion.generatedRecords.note),
        documentRecords: builtIngestions.map((ingestion) => ingestion.generatedRecords.document),
        timelineRecords: builtIngestions.map((ingestion) => ingestion.generatedRecords.timeline),
      },
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to preview wiki source files', error);
    return res.status(500).json({ error: 'Failed to preview files for the Case Wiki' });
  } finally {
    await cleanupUploadedFiles(req.files);
  }
});

router.post('/wiki/ingest/jobs', caseWikiUpload.array('files', WIKI_INGEST_FILE_LIMIT), async (req, res) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ error: 'Upload at least one file for the Case Wiki to ingest' });
    }

    const now = new Date().toISOString();
    const job = {
      jobId: crypto.randomUUID(),
      context: parseWikiIngestContext(req),
      status: 'queued',
      completedAt: null,
      ingestions: [],
      wikiIngestionRecords: [],
      generatedRecords: {
        noteRecords: [],
        documentRecords: [],
        timelineRecords: [],
      },
      graphPreviews: [],
      neo4j: [],
      items: req.files.map((file) => ({
        itemId: crypto.randomUUID(),
        fileName: file.originalname,
        storedName: file.filename,
        path: file.path,
        size: file.size || 0,
        mimeType: file.mimetype || 'application/octet-stream',
        status: 'queued',
        error: '',
        pageId: '',
        fileId: '',
        neo4jStatus: '',
        queuedAt: now,
      })),
    };

    const savedJob = normalizeJob(await createCaseManagementWikiIngestJob(req.user.id, job));
    setImmediate(() => processWikiIngestJob(savedJob));

    return res.status(202).json(makeJobSnapshot(savedJob));
  } catch (error) {
    logger.error('[caseManagement] Failed to create wiki ingest job', error);
    return res.status(500).json({ error: 'Failed to start Case Wiki ingest job' });
  }
});

router.get('/wiki/ingest/jobs', async (req, res) => {
  try {
    const jobs = await getCaseManagementWikiIngestJobsForUser(req.user.id);
    jobs.forEach((job) => maybeResumeWikiIngestJob(job));
    return res.status(200).json({
      jobs: jobs.map((job) => makeJobSnapshot(job, { includeArtifacts: false })),
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to load wiki ingest jobs', error);
    return res.status(500).json({ error: 'Failed to load Case Wiki ingest jobs' });
  }
});

router.get('/wiki/ingest/jobs/:jobId', async (req, res) => {
  const job = await getCaseManagementWikiIngestJob(req.user.id, req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Case Wiki ingest job not found' });
  }
  maybeResumeWikiIngestJob(job);
  return res.status(200).json(makeJobSnapshot(job));
});

router.post('/wiki/ingest/jobs/:jobId/pause', async (req, res) => {
  const job = await getCaseManagementWikiIngestJob(req.user.id, req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Case Wiki ingest job not found' });
  }
  const updatedJob =
    job.status === 'processing' || job.status === 'queued'
      ? await updateCaseManagementWikiIngestJob(req.user.id, req.params.jobId, { $set: { status: 'paused' } })
      : job;
  return res.status(200).json(makeJobSnapshot(updatedJob));
});

router.post('/wiki/ingest/jobs/:jobId/resume', async (req, res) => {
  const job = await getCaseManagementWikiIngestJob(req.user.id, req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Case Wiki ingest job not found' });
  }
  let updatedJob = job;
  if (job.status === 'paused') {
    const items = normalizeJob(job).items.map((item) =>
      item.status === 'processing' ? { ...item, status: 'queued', resumedAt: new Date().toISOString() } : item,
    );
    updatedJob = await updateCaseManagementWikiIngestJob(req.user.id, req.params.jobId, {
      $set: { status: 'queued', items },
    });
    setImmediate(() => processWikiIngestJob(updatedJob));
  }
  return res.status(200).json(makeJobSnapshot(updatedJob));
});

router.post('/wiki/ingest/jobs/:jobId/retry', async (req, res) => {
  const jobRecord = await getCaseManagementWikiIngestJob(req.user.id, req.params.jobId);
  if (!jobRecord) {
    return res.status(404).json({ error: 'Case Wiki ingest job not found' });
  }
  const job = normalizeJob(jobRecord);
  job.items.forEach((item) => {
    if (item.status === 'failed') {
      item.status = 'queued';
      item.error = '';
      item.startedAt = null;
      item.completedAt = null;
    }
  });
  job.status = 'queued';
  job.completedAt = null;
  job.lastError = '';
  const updatedJob = await persistWikiIngestJob(job);
  setImmediate(() => processWikiIngestJob(updatedJob));
  return res.status(200).json(makeJobSnapshot(updatedJob));
});

router.post('/wiki/ingest', caseWikiUpload.array('files', WIKI_INGEST_FILE_LIMIT), async (req, res) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ error: 'Upload at least one file for the Case Wiki to ingest' });
    }

    const context = parseWikiIngestContext(req);
    const builtIngestions = await Promise.all(
      req.files.map((file) => buildCaseWikiUpload({ file, userId: req.user.id, context })),
    );
    const ingestions = await Promise.all(
      builtIngestions.map((ingestion) => saveCaseManagementWikiIngestion(req.user.id, ingestion)),
    );
    const notes = builtIngestions.map((ingestion) => ingestion.generatedRecords.note);
    const documents = builtIngestions.map((ingestion) => ingestion.generatedRecords.document);
    const timeline = builtIngestions.map((ingestion) => ingestion.generatedRecords.timeline);
    const wikiIngestionRecords = builtIngestions.map((ingestion) => ingestion.generatedRecords.frontendRecord);

    return res.status(201).json({
      ingestions,
      wikiIngestionRecords,
      generatedRecords: {
        noteRecords: notes,
        documentRecords: documents,
        timelineRecords: timeline,
      },
      neo4j: builtIngestions.map((ingestion) => ingestion.neo4j),
    });
  } catch (error) {
    logger.error('[caseManagement] Failed to ingest wiki source files', error);
    return res.status(500).json({ error: 'Failed to ingest files into the Case Wiki' });
  }
});

router.delete('/workspace', async (req, res) => {
  try {
    await deleteCaseManagementWorkspace(req.user.id);
    return res.status(204).end();
  } catch (error) {
    logger.error('[caseManagement] Failed to reset workspace', error);
    return res.status(500).json({ error: 'Failed to reset case management workspace' });
  }
});

module.exports = router;

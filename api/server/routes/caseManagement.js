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
  saveCaseManagementWorkspace,
  deleteCaseManagementWorkspace,
} = require('~/models/CaseManagementWorkspace');
const {
  getCaseManagementWikiIngestions,
  saveCaseManagementWikiIngestion,
} = require('~/models/CaseManagementWikiIngestion');
const {
  createCaseManagementWikiIngestJob,
  getCaseManagementWikiIngestJob,
  getCaseManagementWikiIngestJobsForUser,
  getPendingCaseManagementWikiIngestJobs,
  updateCaseManagementWikiIngestJob,
} = require('~/models/CaseManagementWikiIngestJob');
const {
  buildCaseWikiUpload,
  normalizeWikiIngestContext,
} = require('~/server/services/CaseManagementWikiIngestion');

const router = express.Router();
const WIKI_INGEST_FILE_LIMIT = 64;
const terminalJobStatuses = new Set(['completed', 'completed_with_errors', 'failed']);
const activeWikiIngestJobIds = new Set();
let pendingJobsResumeScheduled = false;

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
    reviewBeforeGraphWrite: readStringField(req.body, 'reviewBeforeGraphWrite'),
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
    nodeCount: ingestion.graph?.nodes?.length || frontendRecord.nodeCount || 0,
    edgeCount: ingestion.graph?.edges?.length || frontendRecord.edgeCount || 0,
    graphSummary: ingestion.graphSummary || frontendRecord.graphSummary,
    graphPreview: ingestion.graph || frontendRecord.graphPreview,
    textPreview: ingestion.extraction?.textPreview || frontendRecord.textPreview || '',
    tableSummary: ingestion.extraction?.tableSummary || frontendRecord.tableSummary,
    entities: frontendRecord.entities || ingestion.wikiPage?.entities || [],
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

const makeJobSnapshot = (jobInput, { includeArtifacts = true } = {}) => {
  const job = normalizeJob(jobInput);
  return {
    jobId: job.jobId,
    status: job.status,
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
  setTimeout(() => {
    resumePendingWikiIngestJobs().catch((error) => {
      logger.warn('[caseManagement] Pending Case Wiki ingest resume failed', error);
    });
  }, 5000);
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

router.get('/wiki/ingestions', async (req, res) => {
  try {
    const ingestions = await getCaseManagementWikiIngestions(req.user.id);
    const noteRecords = ingestions.map((ingestion) => ingestion.generatedRecords?.note).filter(Boolean);
    const documentRecords = ingestions.map((ingestion) => ingestion.generatedRecords?.document).filter(Boolean);
    const timelineRecords = ingestions.map((ingestion) => ingestion.generatedRecords?.timeline).filter(Boolean);
    return res.status(200).json({
      ingestions,
      wikiIngestionRecords: ingestions
        .map((ingestion) => ingestion.generatedRecords?.frontendRecord)
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

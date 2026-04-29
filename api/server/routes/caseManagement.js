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
const { buildCaseWikiUpload } = require('~/server/services/CaseManagementWikiIngestion');

const router = express.Router();

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
    files: 16,
    fileSize: 200 * 1024 * 1024,
  },
});

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

router.post('/wiki/ingest', caseWikiUpload.array('files', 16), async (req, res) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ error: 'Upload at least one file for the Case Wiki to ingest' });
    }

    const context = {
      clientId: typeof req.body?.clientId === 'string' ? req.body.clientId : '',
      clientName: typeof req.body?.clientName === 'string' ? req.body.clientName : '',
      caseId: typeof req.body?.caseId === 'string' ? req.body.caseId : '',
      caseTitle: typeof req.body?.caseTitle === 'string' ? req.body.caseTitle : '',
      serviceName: typeof req.body?.serviceName === 'string' ? req.body.serviceName : '',
      pageId: typeof req.body?.pageId === 'string' ? req.body.pageId : '',
    };

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

const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');
const {
  getCaseManagementWorkspace,
  saveCaseManagementWorkspace,
  deleteCaseManagementWorkspace,
} = require('~/models/CaseManagementWorkspace');

const router = express.Router();

router.use(requireJwtAuth);

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

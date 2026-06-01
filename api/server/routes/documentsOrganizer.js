const express = require('express');
const { requireJwtAuth } = require('~/server/middleware');
const {
  applyDocumentsOrganizerMovePlan,
  buildDocumentsOrganizerMovePlan,
  completeDocumentsOrganizerImportRun,
  createDocumentsOrganizerImportRun,
  createDocumentsOrganizerSavedView,
  deleteDocumentsOrganizerSavedView,
  DocumentsOrganizerUserError,
  exportDocumentsOrganizerMovePlan,
  getDocumentsOrganizerCollections,
  getDocumentsOrganizerDuplicates,
  getDocumentsOrganizerFiles,
  getDocumentsOrganizerImportRuns,
  getDocumentsOrganizerRecommendations,
  getDocumentsOrganizerSavedViews,
  getDocumentsOrganizerSummary,
  importDocumentsOrganizerFileWithDocling,
  openDocumentsOrganizerSavedView,
  previewDocumentsOrganizerImport,
  scanDocumentsOrganizer,
  updateDocumentsOrganizerImportRunItem,
} = require('~/server/services/DocumentsOrganizer');

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

function handleOrganizerRouteError(error, res) {
  if (error instanceof DocumentsOrganizerUserError) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }

  return res.status(500).json({ message: 'Documents organizer failed' });
}

router.get('/summary', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId) {
    return;
  }

  const payload = await getDocumentsOrganizerSummary({
    userId: authenticatedUserId,
    limit: req.query?.limit,
  });

  return res.status(200).json(payload);
});

router.get('/files', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId) {
    return;
  }

  const payload = await getDocumentsOrganizerFiles({
    userId: authenticatedUserId,
    folderKey: req.query?.folder_key,
    sourceRoot: req.query?.source_root || req.query?.sourceRoot,
    searchQuery: req.query?.q,
    sortBy: req.query?.sort_by || req.query?.sortBy,
    limit: req.query?.limit,
    offset: req.query?.offset,
  });

  return res.status(200).json(payload);
});

router.get('/recommendations', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId) {
    return;
  }

  const payload = await getDocumentsOrganizerRecommendations({
    userId: authenticatedUserId,
    limit: req.query?.limit,
  });

  return res.status(200).json(payload);
});

router.get('/collections', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId) {
    return;
  }

  const payload = await getDocumentsOrganizerCollections({
    userId: authenticatedUserId,
    limit: req.query?.limit,
  });

  return res.status(200).json(payload);
});

router.get('/duplicates', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId) {
    return;
  }

  const payload = await getDocumentsOrganizerDuplicates({
    userId: authenticatedUserId,
    limit: req.query?.limit,
    groupFileLimit: req.query?.group_file_limit || req.query?.groupFileLimit,
    includeProjectFiles: req.query?.include_project_files || req.query?.includeProjectFiles,
    includeTechnicalFiles: req.query?.include_technical_files || req.query?.includeTechnicalFiles,
  });

  return res.status(200).json(payload);
});

router.post('/plan-move', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId) {
    return;
  }

  try {
    const payload = await buildDocumentsOrganizerMovePlan({
      userId: authenticatedUserId,
      sampleLimit: req.body?.sample_limit || req.query?.sample_limit,
    });

    return res.status(200).json(payload);
  } catch (error) {
    return handleOrganizerRouteError(error, res);
  }
});

router.post('/plan-move/export', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId) {
    return;
  }

  try {
    const payload = await exportDocumentsOrganizerMovePlan({
      userId: authenticatedUserId,
    });

    return res.status(200).json(payload);
  } catch (error) {
    return handleOrganizerRouteError(error, res);
  }
});

router.post('/apply-move', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId) {
    return;
  }

  try {
    const payload = await applyDocumentsOrganizerMovePlan({
      userId: authenticatedUserId,
      confirmation: req.body?.confirmation,
    });

    return res.status(200).json(payload);
  } catch (error) {
    return handleOrganizerRouteError(error, res);
  }
});

router.post('/import/:fileId', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId) {
    return;
  }

  try {
    const payload = await importDocumentsOrganizerFileWithDocling({
      userId: authenticatedUserId,
      fileId: req.params.fileId,
      exports: req.body?.exports,
      enrichments: req.body?.enrichments,
    });

    return res.status(200).json(payload);
  } catch (error) {
    return handleOrganizerRouteError(error, res);
  }
});

router.get('/imports/runs', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId) {
    return;
  }

  try {
    const payload = await getDocumentsOrganizerImportRuns({
      userId: authenticatedUserId,
      limit: req.query?.limit,
    });

    return res.status(200).json(payload);
  } catch (error) {
    return handleOrganizerRouteError(error, res);
  }
});

router.post('/imports/preview', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId) {
    return;
  }

  try {
    const payload = await previewDocumentsOrganizerImport({
      userId: authenticatedUserId,
      fileIds: req.body?.file_ids || req.body?.fileIds,
    });

    return res.status(200).json(payload);
  } catch (error) {
    return handleOrganizerRouteError(error, res);
  }
});

router.post('/imports/runs', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId) {
    return;
  }

  try {
    const payload = await createDocumentsOrganizerImportRun({
      userId: authenticatedUserId,
      fileIds: req.body?.file_ids || req.body?.fileIds,
    });

    return res.status(201).json(payload);
  } catch (error) {
    return handleOrganizerRouteError(error, res);
  }
});

router.get('/views', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId) {
    return;
  }

  try {
    const payload = await getDocumentsOrganizerSavedViews({
      userId: authenticatedUserId,
      limit: req.query?.limit,
    });

    return res.status(200).json(payload);
  } catch (error) {
    return handleOrganizerRouteError(error, res);
  }
});

router.post('/views', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId) {
    return;
  }

  try {
    const payload = await createDocumentsOrganizerSavedView({
      userId: authenticatedUserId,
      name: req.body?.name,
      folderKey: req.body?.folder_key || req.body?.folderKey,
      folderName: req.body?.folder_name || req.body?.folderName,
      sourceRoot: req.body?.source_root || req.body?.sourceRoot,
      searchQuery: req.body?.search_query || req.body?.searchQuery,
      sortBy: req.body?.sort_by || req.body?.sortBy,
    });

    return res.status(201).json(payload);
  } catch (error) {
    return handleOrganizerRouteError(error, res);
  }
});

router.delete('/views/:viewId', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId) {
    return;
  }

  try {
    const payload = await deleteDocumentsOrganizerSavedView({
      userId: authenticatedUserId,
      viewId: req.params.viewId,
    });

    return res.status(200).json(payload);
  } catch (error) {
    return handleOrganizerRouteError(error, res);
  }
});

router.patch('/views/:viewId/open', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId) {
    return;
  }

  try {
    const payload = await openDocumentsOrganizerSavedView({
      userId: authenticatedUserId,
      viewId: req.params.viewId,
    });

    return res.status(200).json(payload);
  } catch (error) {
    return handleOrganizerRouteError(error, res);
  }
});

router.patch('/imports/runs/:runId/items/:fileId', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId) {
    return;
  }

  try {
    const payload = await updateDocumentsOrganizerImportRunItem({
      userId: authenticatedUserId,
      runId: req.params.runId,
      fileId: req.params.fileId,
      status: req.body?.status,
      documentId: req.body?.document_id || req.body?.documentId,
      title: req.body?.title,
      error: req.body?.error,
    });

    return res.status(200).json(payload);
  } catch (error) {
    return handleOrganizerRouteError(error, res);
  }
});

router.patch('/imports/runs/:runId', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId) {
    return;
  }

  try {
    const payload = await completeDocumentsOrganizerImportRun({
      userId: authenticatedUserId,
      runId: req.params.runId,
      status: req.body?.status,
    });

    return res.status(200).json(payload);
  } catch (error) {
    return handleOrganizerRouteError(error, res);
  }
});

router.post('/scan', async (req, res) => {
  const authenticatedUserId = validateAuthenticatedUser(req, res);

  if (!authenticatedUserId) {
    return;
  }

  const payload = await scanDocumentsOrganizer({
    userId: authenticatedUserId,
  });

  return res.status(200).json(payload);
});

module.exports = router;

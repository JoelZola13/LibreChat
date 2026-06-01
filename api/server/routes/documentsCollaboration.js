const express = require('express');
const { requireJwtAuth } = require('~/server/middleware');
const {
  createDocumentsCollaborationRoomToken,
  isValidDocumentsCollaborationRoomName,
} = require('~/server/services/DocumentsCollaborationServer');
const {
  verifyDocumentsCollaborationDocumentAccess,
} = require('~/server/services/DocumentsCollaborationPermissions');
const {
  acquireDocumentsCollaborationLock,
  getDocumentsCollaborationLockStatus,
  releaseDocumentsCollaborationLock,
  renewDocumentsCollaborationLock,
} = require('~/server/services/DocumentsCollaborationLocks');

const router = express.Router();

router.use(requireJwtAuth);

function getAuthenticatedUserId(req) {
  return req.user?.id;
}

function getAuthenticatedUserName(req) {
  const authenticatedUserId = getAuthenticatedUserId(req);
  return req.user?.name || req.user?.username || req.user?.email || authenticatedUserId;
}

function getLockRequestBody(req) {
  return {
    documentId: String(req.body?.document_id || req.params?.documentId || req.query?.document_id || '').trim(),
    roomName: String(req.body?.room_name || req.query?.room_name || '').trim(),
    lockId: String(req.body?.lock_id || req.params?.lockId || req.query?.lock_id || '').trim(),
    requestedUserId: String(req.body?.user_id || req.query?.user_id || '').trim(),
  };
}

function validateDocumentRoom(res, { documentId, roomName }) {
  if (!documentId || !roomName) {
    res.status(400).json({ message: 'document_id and room_name are required' });
    return false;
  }

  if (roomName !== `document-${documentId}` || !isValidDocumentsCollaborationRoomName(roomName)) {
    res.status(400).json({ message: 'Invalid collaboration room' });
    return false;
  }

  return true;
}

function validateAuthenticatedUser(req, res, requestedUserId) {
  const authenticatedUserId = getAuthenticatedUserId(req);

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

router.get('/locks/:documentId', async (req, res) => {
  const { documentId, requestedUserId } = getLockRequestBody(req);
  const roomName = String(req.query?.room_name || `document-${documentId}`).trim();
  const authenticatedUserId = validateAuthenticatedUser(req, res, requestedUserId);

  if (!authenticatedUserId || !validateDocumentRoom(res, { documentId, roomName })) {
    return;
  }

  if (!(await requireDocumentAccess(req, res, { documentId, authenticatedUserId }))) {
    return;
  }

  const status = await getDocumentsCollaborationLockStatus({ documentId });

  return res.status(200).json({
    document_id: documentId,
    room_name: roomName,
    lock: status.lock,
  });
});

router.post('/locks', async (req, res) => {
  const { documentId, roomName, lockId, requestedUserId } = getLockRequestBody(req);
  const authenticatedUserId = validateAuthenticatedUser(req, res, requestedUserId);

  if (!authenticatedUserId || !validateDocumentRoom(res, { documentId, roomName })) {
    return;
  }

  if (!lockId) {
    return res.status(400).json({ message: 'lock_id is required' });
  }

  if (!(await requireDocumentAccess(req, res, { documentId, authenticatedUserId }))) {
    return;
  }

  const result = await acquireDocumentsCollaborationLock({
    documentId,
    roomName,
    lockId,
    userId: authenticatedUserId,
    userName: getAuthenticatedUserName(req),
  });

  if (!result.ok) {
    return res.status(409).json({
      message: 'Document is locked',
      lock: result.lock,
    });
  }

  return res.status(200).json({
    document_id: documentId,
    room_name: roomName,
    lock: result.lock,
    ttl_ms: result.ttlMs,
  });
});

router.post('/locks/:lockId/heartbeat', async (req, res) => {
  const { documentId, roomName, lockId, requestedUserId } = getLockRequestBody(req);
  const authenticatedUserId = validateAuthenticatedUser(req, res, requestedUserId);

  if (!authenticatedUserId || !validateDocumentRoom(res, { documentId, roomName })) {
    return;
  }

  if (!lockId) {
    return res.status(400).json({ message: 'lock_id is required' });
  }

  if (!(await requireDocumentAccess(req, res, { documentId, authenticatedUserId }))) {
    return;
  }

  const result = await renewDocumentsCollaborationLock({
    documentId,
    roomName,
    lockId,
    userId: authenticatedUserId,
    userName: getAuthenticatedUserName(req),
  });

  if (!result.ok) {
    return res.status(409).json({
      message: result.reason === 'missing_or_expired'
        ? 'Document lock expired'
        : 'Document is locked',
      lock: result.lock,
    });
  }

  return res.status(200).json({
    document_id: documentId,
    room_name: roomName,
    lock: result.lock,
    ttl_ms: result.ttlMs,
  });
});

router.delete('/locks/:lockId', async (req, res) => {
  const { documentId, roomName, lockId, requestedUserId } = getLockRequestBody(req);
  const authenticatedUserId = validateAuthenticatedUser(req, res, requestedUserId);

  if (!authenticatedUserId || !validateDocumentRoom(res, { documentId, roomName })) {
    return;
  }

  if (!lockId) {
    return res.status(400).json({ message: 'lock_id is required' });
  }

  await releaseDocumentsCollaborationLock({
    documentId,
    lockId,
    userId: authenticatedUserId,
  });

  return res.status(204).send();
});

router.post('/token', async (req, res) => {
  const documentId = String(req.body?.document_id || '').trim();
  const roomName = String(req.body?.room_name || '').trim();
  const requestedUserId = String(req.body?.user_id || '').trim();
  const authenticatedUserId = getAuthenticatedUserId(req);

  if (!documentId || !roomName) {
    return res.status(400).json({ message: 'document_id and room_name are required' });
  }

  if (roomName !== `document-${documentId}` || !isValidDocumentsCollaborationRoomName(roomName)) {
    return res.status(400).json({ message: 'Invalid collaboration room' });
  }

  if (!authenticatedUserId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (requestedUserId && requestedUserId !== authenticatedUserId) {
    return res.status(403).json({ message: 'Cannot issue a collaboration token for another user' });
  }

  const documentAccess = await verifyDocumentsCollaborationDocumentAccess({
    documentId,
    userId: authenticatedUserId,
    authorizationHeader: req.get('authorization'),
  });

  if (!documentAccess.ok) {
    const isAccessDenied = documentAccess.reason === 'access_denied';

    return res.status(isAccessDenied ? 403 : 503).json({
      message: isAccessDenied
        ? 'Document access denied'
        : 'Document permission check unavailable',
    });
  }

  const userName = getAuthenticatedUserName(req);
  const grant = createDocumentsCollaborationRoomToken({
    roomName,
    documentId,
    userId: authenticatedUserId,
    userName,
  });

  return res.status(200).json({
    auth_required: grant.authRequired,
    document_id: documentId,
    room_name: roomName,
    token: grant.token,
    expires_at: grant.expiresAt ? new Date(grant.expiresAt).toISOString() : null,
  });
});

module.exports = router;

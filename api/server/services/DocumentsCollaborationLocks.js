const DEFAULT_LOCK_TTL_MS = 45 * 1000;

function parsePositiveInteger(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function getDocumentsCollaborationLockTtlMs(options = {}) {
  return parsePositiveInteger(
    options.ttlMs ?? process.env.DOCUMENTS_COLLABORATION_LOCK_TTL_MS,
    DEFAULT_LOCK_TTL_MS,
  );
}

function createDefaultLockStore() {
  return require('../../models/DocumentsCollaborationLock');
}

function getLockStore(options = {}) {
  return options.store || createDefaultLockStore();
}

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function isLockActive(lock, now = new Date()) {
  const expiresAt = toDate(lock?.expiresAt);
  return Boolean(expiresAt && expiresAt.getTime() > now.getTime());
}

function serializeDocumentsCollaborationLock(lock, now = new Date()) {
  if (!lock) {
    return null;
  }

  const acquiredAt = toDate(lock.acquiredAt);
  const renewedAt = toDate(lock.renewedAt);
  const expiresAt = toDate(lock.expiresAt);

  return {
    document_id: lock.documentId,
    room_name: lock.roomName,
    lock_id: lock.lockId,
    user_id: lock.userId,
    user_name: lock.userName || lock.userId,
    acquired_at: acquiredAt ? acquiredAt.toISOString() : null,
    renewed_at: renewedAt ? renewedAt.toISOString() : null,
    expires_at: expiresAt ? expiresAt.toISOString() : null,
    active: isLockActive(lock, now),
  };
}

async function getDocumentsCollaborationLockStatus({ documentId, now = new Date(), store } = {}) {
  const lockStore = getLockStore({ store });
  const lock = await lockStore.getDocumentsCollaborationLock(documentId);

  return {
    ok: true,
    lock: isLockActive(lock, now) ? serializeDocumentsCollaborationLock(lock, now) : null,
  };
}

async function acquireDocumentsCollaborationLock({
  documentId,
  roomName,
  lockId,
  userId,
  userName,
  ttlMs,
  now = new Date(),
  store,
} = {}) {
  const lockStore = getLockStore({ store });
  const safeTtlMs = getDocumentsCollaborationLockTtlMs({ ttlMs });

  await lockStore.deleteExpiredDocumentsCollaborationLocks?.(now);

  const existingLock = await lockStore.getDocumentsCollaborationLock(documentId);

  if (
    isLockActive(existingLock, now) &&
    existingLock.userId !== userId &&
    existingLock.lockId !== lockId
  ) {
    return {
      ok: false,
      reason: 'locked',
      lock: serializeDocumentsCollaborationLock(existingLock, now),
    };
  }

  const expiresAt = new Date(now.getTime() + safeTtlMs);
  const nextLock = {
    documentId,
    roomName,
    lockId,
    userId,
    userName: userName || userId,
    acquiredAt: existingLock?.userId === userId ? existingLock.acquiredAt || now : now,
    renewedAt: now,
    expiresAt,
  };
  const savedLock = await lockStore.saveDocumentsCollaborationLock(nextLock, {
    mode: 'acquire',
    now,
  });

  if (!savedLock) {
    const currentLock = await lockStore.getDocumentsCollaborationLock(documentId);

    return {
      ok: false,
      reason: 'locked',
      lock: serializeDocumentsCollaborationLock(currentLock, now),
    };
  }

  return {
    ok: true,
    lock: serializeDocumentsCollaborationLock(savedLock, now),
    ttlMs: safeTtlMs,
  };
}

async function renewDocumentsCollaborationLock({
  documentId,
  roomName,
  lockId,
  userId,
  userName,
  ttlMs,
  now = new Date(),
  store,
} = {}) {
  const lockStore = getLockStore({ store });
  const existingLock = await lockStore.getDocumentsCollaborationLock(documentId);

  if (!isLockActive(existingLock, now)) {
    return {
      ok: false,
      reason: 'missing_or_expired',
      lock: null,
    };
  }

  if (existingLock.lockId !== lockId || existingLock.userId !== userId) {
    return {
      ok: false,
      reason: 'locked',
      lock: serializeDocumentsCollaborationLock(existingLock, now),
    };
  }

  const safeTtlMs = getDocumentsCollaborationLockTtlMs({ ttlMs });
  const nextLock = {
    ...existingLock,
    roomName,
    userName: userName || existingLock.userName || userId,
    renewedAt: now,
    expiresAt: new Date(now.getTime() + safeTtlMs),
  };
  const savedLock = await lockStore.saveDocumentsCollaborationLock(nextLock, {
    mode: 'renew',
    now,
  });

  if (!savedLock) {
    const currentLock = await lockStore.getDocumentsCollaborationLock(documentId);

    return {
      ok: false,
      reason: isLockActive(currentLock, now) ? 'locked' : 'missing_or_expired',
      lock: isLockActive(currentLock, now) ? serializeDocumentsCollaborationLock(currentLock, now) : null,
    };
  }

  return {
    ok: true,
    lock: serializeDocumentsCollaborationLock(savedLock, now),
    ttlMs: safeTtlMs,
  };
}

async function releaseDocumentsCollaborationLock({
  documentId,
  lockId,
  userId,
  store,
} = {}) {
  const lockStore = getLockStore({ store });
  const deletedLock = await lockStore.deleteDocumentsCollaborationLock({
    documentId,
    lockId,
    userId,
  });

  return {
    ok: true,
    released: Boolean(deletedLock),
  };
}

module.exports = {
  acquireDocumentsCollaborationLock,
  getDocumentsCollaborationLockStatus,
  getDocumentsCollaborationLockTtlMs,
  isLockActive,
  releaseDocumentsCollaborationLock,
  renewDocumentsCollaborationLock,
  serializeDocumentsCollaborationLock,
};

const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');

const documentsCollaborationLockSchema = new mongoose.Schema(
  {
    documentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    roomName: {
      type: String,
      required: true,
      index: true,
    },
    lockId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      default: '',
    },
    acquiredAt: {
      type: Date,
      default: Date.now,
    },
    renewedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    minimize: false,
  },
);

const DocumentsCollaborationLock =
  mongoose.models.DocumentsCollaborationLock ||
  mongoose.model('DocumentsCollaborationLock', documentsCollaborationLockSchema);

function isDuplicateKeyError(error) {
  return error?.code === 11000 || error?.code === 11001;
}

const getDocumentsCollaborationLock = async (documentId) => {
  try {
    return await DocumentsCollaborationLock.findOne({ documentId }).lean();
  } catch (error) {
    logger.error('[getDocumentsCollaborationLock] Error loading lock', error);
    throw new Error('Error loading documents collaboration lock');
  }
};

const saveDocumentsCollaborationLock = async (lock, options = {}) => {
  const now = options.now || new Date();
  const update = {
    $set: {
      roomName: lock.roomName,
      lockId: lock.lockId,
      userId: lock.userId,
      userName: lock.userName,
      acquiredAt: lock.acquiredAt,
      renewedAt: lock.renewedAt,
      expiresAt: lock.expiresAt,
    },
    $setOnInsert: {
      documentId: lock.documentId,
    },
  };

  let filter = { documentId: lock.documentId };
  let upsert = true;

  if (options.mode === 'acquire') {
    filter = {
      documentId: lock.documentId,
      $or: [
        { expiresAt: { $lte: now } },
        { userId: lock.userId },
        { lockId: lock.lockId },
      ],
    };
  } else if (options.mode === 'renew') {
    filter = {
      documentId: lock.documentId,
      lockId: lock.lockId,
      userId: lock.userId,
      expiresAt: { $gt: now },
    };
    upsert = false;
  }

  try {
    return await DocumentsCollaborationLock.findOneAndUpdate(
      filter,
      update,
      {
        new: true,
        upsert,
        lean: true,
        setDefaultsOnInsert: true,
      },
    );
  } catch (error) {
    if (options.mode === 'acquire' && isDuplicateKeyError(error)) {
      return null;
    }

    logger.error('[saveDocumentsCollaborationLock] Error saving lock', error);
    throw new Error('Error saving documents collaboration lock');
  }
};

const deleteDocumentsCollaborationLock = async ({ documentId, lockId, userId } = {}) => {
  try {
    return await DocumentsCollaborationLock.findOneAndDelete({
      documentId,
      lockId,
      userId,
    }).lean();
  } catch (error) {
    logger.error('[deleteDocumentsCollaborationLock] Error deleting lock', error);
    throw new Error('Error deleting documents collaboration lock');
  }
};

const deleteExpiredDocumentsCollaborationLocks = async (now = new Date()) => {
  try {
    return await DocumentsCollaborationLock.deleteMany({ expiresAt: { $lte: now } });
  } catch (error) {
    logger.error('[deleteExpiredDocumentsCollaborationLocks] Error pruning locks', error);
    throw new Error('Error pruning documents collaboration locks');
  }
};

module.exports = {
  DocumentsCollaborationLock,
  getDocumentsCollaborationLock,
  saveDocumentsCollaborationLock,
  deleteDocumentsCollaborationLock,
  deleteExpiredDocumentsCollaborationLocks,
};

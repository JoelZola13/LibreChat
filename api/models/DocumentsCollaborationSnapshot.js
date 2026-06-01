const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');

const documentsCollaborationSnapshotSchema = new mongoose.Schema(
  {
    roomName: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    update: {
      type: Buffer,
      required: true,
      default: () => Buffer.alloc(0),
    },
    byteLength: {
      type: Number,
      default: 0,
    },
    savedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    minimize: false,
  },
);

documentsCollaborationSnapshotSchema.index({ updatedAt: -1 });

const DocumentsCollaborationSnapshot =
  mongoose.models.DocumentsCollaborationSnapshot ||
  mongoose.model('DocumentsCollaborationSnapshot', documentsCollaborationSnapshotSchema);

const getDocumentsCollaborationSnapshot = async (roomName) => {
  try {
    return await DocumentsCollaborationSnapshot.findOne({ roomName }).lean();
  } catch (error) {
    logger.error('[getDocumentsCollaborationSnapshot] Error loading snapshot', error);
    throw new Error('Error loading documents collaboration snapshot');
  }
};

const saveDocumentsCollaborationSnapshot = async (roomName, update) => {
  const snapshot = Buffer.from(update || []);

  try {
    return await DocumentsCollaborationSnapshot.findOneAndUpdate(
      { roomName },
      {
        roomName,
        update: snapshot,
        byteLength: snapshot.byteLength,
        savedAt: new Date(),
      },
      {
        new: true,
        upsert: true,
        lean: true,
        setDefaultsOnInsert: true,
      },
    );
  } catch (error) {
    logger.error('[saveDocumentsCollaborationSnapshot] Error saving snapshot', error);
    throw new Error('Error saving documents collaboration snapshot');
  }
};

const deleteDocumentsCollaborationSnapshot = async (roomName) => {
  try {
    return await DocumentsCollaborationSnapshot.findOneAndDelete({ roomName }).lean();
  } catch (error) {
    logger.error('[deleteDocumentsCollaborationSnapshot] Error deleting snapshot', error);
    throw new Error('Error deleting documents collaboration snapshot');
  }
};

module.exports = {
  DocumentsCollaborationSnapshot,
  getDocumentsCollaborationSnapshot,
  saveDocumentsCollaborationSnapshot,
  deleteDocumentsCollaborationSnapshot,
};

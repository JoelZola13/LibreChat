const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');

const caseManagementWikiIngestionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    ingestionId: {
      type: String,
      required: true,
      index: true,
    },
    fileId: {
      type: String,
      required: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    storedName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      default: 'application/octet-stream',
    },
    size: {
      type: Number,
      default: 0,
    },
    sha256: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    linkedClientId: String,
    linkedCaseId: String,
    linkedServiceName: String,
    sourcePageId: String,
    extraction: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    wikiPage: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    generatedRecords: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    graph: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    neo4j: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    minimize: false,
  },
);

caseManagementWikiIngestionSchema.index({ user: 1, fileId: 1 }, { unique: true });

const CaseManagementWikiIngestion =
  mongoose.models.CaseManagementWikiIngestion ||
  mongoose.model('CaseManagementWikiIngestion', caseManagementWikiIngestionSchema);

const getCaseManagementWikiIngestions = async (user) => {
  try {
    return await CaseManagementWikiIngestion.find({ user }).sort({ createdAt: -1 }).lean();
  } catch (error) {
    logger.error('[getCaseManagementWikiIngestions] Error loading wiki ingestions', error);
    throw new Error('Error loading case management wiki ingestions');
  }
};

const saveCaseManagementWikiIngestion = async (user, ingestion) => {
  try {
    return await CaseManagementWikiIngestion.findOneAndUpdate(
      { user, fileId: ingestion.fileId },
      {
        ...ingestion,
        user,
      },
      {
        new: true,
        upsert: true,
        lean: true,
        setDefaultsOnInsert: true,
      },
    );
  } catch (error) {
    logger.error('[saveCaseManagementWikiIngestion] Error saving wiki ingestion', error);
    throw new Error('Error saving case management wiki ingestion');
  }
};

module.exports = {
  CaseManagementWikiIngestion,
  getCaseManagementWikiIngestions,
  saveCaseManagementWikiIngestion,
};

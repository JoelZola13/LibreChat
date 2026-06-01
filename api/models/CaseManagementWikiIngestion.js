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
    sourceScope: {
      type: String,
      default: 'standalone',
    },
    sourcePageId: String,
    archive: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    embeddingReview: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    weaviateDryRun: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    relationshipReviewRecords: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    privacy: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
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
    graphSummary: {
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

const updateCaseManagementWikiIngestionArchive = async (user, fileId, archive) => {
  try {
    return await CaseManagementWikiIngestion.findOneAndUpdate(
      { user, fileId },
      {
        $set: {
          archive,
          'wikiPage.archive': archive,
          'generatedRecords.frontendRecord.archive': archive,
        },
      },
      {
        new: true,
        lean: true,
      },
    );
  } catch (error) {
    logger.error('[updateCaseManagementWikiIngestionArchive] Error updating wiki ingestion archive review', error);
    throw new Error('Error updating case management wiki archive review');
  }
};

const updateCaseManagementWikiIngestionReview = async (user, fileId, updates = {}) => {
  try {
    return await CaseManagementWikiIngestion.findOneAndUpdate(
      { user, fileId },
      {
        $set: updates,
      },
      {
        new: true,
        lean: true,
      },
    );
  } catch (error) {
    logger.error('[updateCaseManagementWikiIngestionReview] Error updating wiki ingestion review', error);
    throw new Error('Error updating case management wiki review');
  }
};

module.exports = {
  CaseManagementWikiIngestion,
  getCaseManagementWikiIngestions,
  saveCaseManagementWikiIngestion,
  updateCaseManagementWikiIngestionArchive,
  updateCaseManagementWikiIngestionReview,
};

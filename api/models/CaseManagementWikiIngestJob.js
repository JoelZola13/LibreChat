const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');

const caseManagementWikiIngestJobSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      default: 'queued',
      index: true,
    },
    context: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    items: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    ingestions: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    wikiIngestionRecords: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    generatedRecords: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        noteRecords: [],
        documentRecords: [],
        timelineRecords: [],
      },
    },
    graphPreviews: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    neo4j: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    startedAt: Date,
    completedAt: Date,
    lastError: String,
  },
  {
    timestamps: true,
    minimize: false,
  },
);

caseManagementWikiIngestJobSchema.index({ user: 1, createdAt: -1 });

const CaseManagementWikiIngestJob =
  mongoose.models.CaseManagementWikiIngestJob ||
  mongoose.model('CaseManagementWikiIngestJob', caseManagementWikiIngestJobSchema);

const createCaseManagementWikiIngestJob = async (user, job) => {
  try {
    return await CaseManagementWikiIngestJob.create({
      ...job,
      user,
    });
  } catch (error) {
    logger.error('[createCaseManagementWikiIngestJob] Error creating wiki ingest job', error);
    throw new Error('Error creating case management wiki ingest job');
  }
};

const getCaseManagementWikiIngestJob = async (user, jobId) => {
  try {
    return await CaseManagementWikiIngestJob.findOne({ user, jobId }).lean();
  } catch (error) {
    logger.error('[getCaseManagementWikiIngestJob] Error loading wiki ingest job', error);
    throw new Error('Error loading case management wiki ingest job');
  }
};

const getCaseManagementWikiIngestJobsForUser = async (user, limit = 8) => {
  try {
    return await CaseManagementWikiIngestJob.find({ user }).sort({ createdAt: -1 }).limit(limit).lean();
  } catch (error) {
    logger.error('[getCaseManagementWikiIngestJobsForUser] Error loading wiki ingest jobs', error);
    throw new Error('Error loading case management wiki ingest jobs');
  }
};

const getPendingCaseManagementWikiIngestJobs = async () => {
  try {
    return await CaseManagementWikiIngestJob.find({
      status: { $in: ['queued', 'processing'] },
    })
      .sort({ createdAt: 1 })
      .lean();
  } catch (error) {
    logger.error('[getPendingCaseManagementWikiIngestJobs] Error loading pending wiki ingest jobs', error);
    throw new Error('Error loading pending case management wiki ingest jobs');
  }
};

const updateCaseManagementWikiIngestJob = async (user, jobId, update) => {
  try {
    return await CaseManagementWikiIngestJob.findOneAndUpdate(
      { user, jobId },
      update,
      {
        new: true,
        lean: true,
        setDefaultsOnInsert: true,
      },
    );
  } catch (error) {
    logger.error('[updateCaseManagementWikiIngestJob] Error updating wiki ingest job', error);
    throw new Error('Error updating case management wiki ingest job');
  }
};

module.exports = {
  CaseManagementWikiIngestJob,
  createCaseManagementWikiIngestJob,
  getCaseManagementWikiIngestJob,
  getCaseManagementWikiIngestJobsForUser,
  getPendingCaseManagementWikiIngestJobs,
  updateCaseManagementWikiIngestJob,
};

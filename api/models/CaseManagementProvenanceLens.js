const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');

const provenanceLensSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    lensId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    query: {
      type: String,
      default: '',
    },
    reviewFilter: {
      type: String,
      default: 'all',
    },
    domainFilter: {
      type: String,
      default: 'all',
    },
    browserScope: {
      type: String,
      default: 'active-domain',
    },
    resultCount: {
      type: Number,
      default: 0,
    },
    matchingWorkspaceCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: String,
      default: 'Current worker',
    },
    visibility: {
      type: String,
      default: 'private',
    },
    sharedWith: {
      type: [String],
      default: [],
    },
    shareNote: {
      type: String,
      default: '',
    },
    accessRole: {
      type: String,
      default: 'manager',
    },
    accessRoles: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    activityRecords: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    lensCreatedAt: {
      type: Date,
      default: Date.now,
    },
    lensUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    serverSyncedAt: {
      type: Date,
      default: Date.now,
    },
    neo4jNodeId: String,
    neo4jStatus: String,
    neo4jMessage: String,
  },
  {
    timestamps: true,
    minimize: false,
  },
);

provenanceLensSchema.index({ user: 1, lensId: 1 }, { unique: true });

const provenanceLensExportAuditSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    auditId: {
      type: String,
      required: true,
      index: true,
    },
    actor: {
      type: String,
      default: 'Current worker',
      index: true,
    },
    exportType: {
      type: String,
      default: 'graph-provenance-lens-activity',
      index: true,
    },
    format: {
      type: String,
      default: 'json',
    },
    filename: {
      type: String,
      default: '',
    },
    contentType: {
      type: String,
      default: '',
    },
    privacyNote: {
      type: String,
      default: '',
    },
    lensCount: {
      type: Number,
      default: 0,
    },
    activityCount: {
      type: Number,
      default: 0,
    },
    visibleLensIds: {
      type: [String],
      default: [],
    },
    exportedAt: {
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

provenanceLensExportAuditSchema.index({ user: 1, auditId: 1 }, { unique: true });

const CaseManagementProvenanceLens =
  mongoose.models.CaseManagementProvenanceLens ||
  mongoose.model('CaseManagementProvenanceLens', provenanceLensSchema);

const CaseManagementProvenanceLensExportAudit =
  mongoose.models.CaseManagementProvenanceLensExportAudit ||
  mongoose.model('CaseManagementProvenanceLensExportAudit', provenanceLensExportAuditSchema);

const normalizeActivityRecords = (records = []) =>
  (Array.isArray(records) ? records : [])
    .filter((record) => record && typeof record === 'object' && !Array.isArray(record))
    .slice(0, 50);

const getCaseManagementProvenanceLenses = async (user) => {
  try {
    return await CaseManagementProvenanceLens.find({ user })
      .sort({ lensUpdatedAt: -1, updatedAt: -1 })
      .lean();
  } catch (error) {
    logger.error('[getCaseManagementProvenanceLenses] Error loading provenance lenses', error);
    throw new Error('Error loading case management provenance lenses');
  }
};

const getCaseManagementProvenanceLens = async (user, lensId) => {
  try {
    return await CaseManagementProvenanceLens.findOne({ user, lensId }).lean();
  } catch (error) {
    logger.error('[getCaseManagementProvenanceLens] Error loading provenance lens', error);
    throw new Error('Error loading case management provenance lens');
  }
};

const saveCaseManagementProvenanceLens = async (user, lens) => {
  try {
    return await CaseManagementProvenanceLens.findOneAndUpdate(
      { user, lensId: lens.id },
      {
        $set: {
          user,
          lensId: lens.id,
          name: lens.name,
          query: lens.query,
          reviewFilter: lens.reviewFilter,
          domainFilter: lens.domainFilter,
          browserScope: lens.browserScope,
          resultCount: lens.resultCount,
          matchingWorkspaceCount: lens.matchingWorkspaceCount,
          createdBy: lens.createdBy,
          visibility: lens.visibility,
          sharedWith: lens.sharedWith,
          shareNote: lens.shareNote,
          accessRole: lens.accessRole,
          accessRoles: lens.accessRoles,
          activityRecords: normalizeActivityRecords(lens.activityRecords),
          lensUpdatedAt: lens.updatedAt ? new Date(lens.updatedAt) : new Date(),
          serverSyncedAt: new Date(),
          neo4jNodeId: lens.neo4jNodeId,
          neo4jStatus: lens.neo4jStatus,
          neo4jMessage: lens.neo4jMessage,
        },
        $setOnInsert: {
          lensCreatedAt: lens.createdAt ? new Date(lens.createdAt) : new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        lean: true,
        setDefaultsOnInsert: true,
      },
    );
  } catch (error) {
    logger.error('[saveCaseManagementProvenanceLens] Error saving provenance lens', error);
    throw new Error('Error saving case management provenance lens');
  }
};

const deleteCaseManagementProvenanceLens = async (user, lensId) => {
  try {
    return await CaseManagementProvenanceLens.findOneAndDelete({ user, lensId }).lean();
  } catch (error) {
    logger.error('[deleteCaseManagementProvenanceLens] Error deleting provenance lens', error);
    throw new Error('Error deleting case management provenance lens');
  }
};

const createCaseManagementProvenanceLensExportAudit = async (user, audit) => {
  try {
    const record = await CaseManagementProvenanceLensExportAudit.create({
      user,
      auditId: audit.id,
      actor: audit.actor,
      exportType: audit.exportType,
      format: audit.format,
      filename: audit.filename,
      contentType: audit.contentType,
      privacyNote: audit.privacyNote,
      lensCount: audit.lensCount,
      activityCount: audit.activityCount,
      visibleLensIds: Array.isArray(audit.visibleLensIds) ? audit.visibleLensIds : [],
      exportedAt: audit.exportedAt ? new Date(audit.exportedAt) : new Date(),
    });
    return record.toObject();
  } catch (error) {
    logger.error('[createCaseManagementProvenanceLensExportAudit] Error saving provenance lens export audit', error);
    throw new Error('Error saving case management provenance lens export audit');
  }
};

const getCaseManagementProvenanceLensExportAudits = async (user, limit = 20, exportType = 'all') => {
  try {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const query = { user };
    if (exportType && exportType !== 'all') {
      query.exportType = exportType;
    }
    return await CaseManagementProvenanceLensExportAudit.find(query)
      .sort({ exportedAt: -1, createdAt: -1 })
      .limit(safeLimit)
      .lean();
  } catch (error) {
    logger.error('[getCaseManagementProvenanceLensExportAudits] Error loading provenance lens export audits', error);
    throw new Error('Error loading case management provenance lens export audits');
  }
};

module.exports = {
  CaseManagementProvenanceLens,
  CaseManagementProvenanceLensExportAudit,
  createCaseManagementProvenanceLensExportAudit,
  deleteCaseManagementProvenanceLens,
  getCaseManagementProvenanceLensExportAudits,
  getCaseManagementProvenanceLens,
  getCaseManagementProvenanceLenses,
  saveCaseManagementProvenanceLens,
};

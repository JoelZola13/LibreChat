const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');

const caseManagementWorkspaceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    workspace: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    minimize: false,
  },
);

const CaseManagementWorkspace =
  mongoose.models.CaseManagementWorkspace ||
  mongoose.model('CaseManagementWorkspace', caseManagementWorkspaceSchema);

const getCaseManagementWorkspace = async (user) => {
  try {
    return await CaseManagementWorkspace.findOne({ user }).lean();
  } catch (error) {
    logger.error('[getCaseManagementWorkspace] Error loading workspace', error);
    throw new Error('Error loading case management workspace');
  }
};

const saveCaseManagementWorkspace = async (user, workspace) => {
  try {
    return await CaseManagementWorkspace.findOneAndUpdate(
      { user },
      {
        user,
        version: 1,
        workspace,
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
    logger.error('[saveCaseManagementWorkspace] Error saving workspace', error);
    throw new Error('Error saving case management workspace');
  }
};

const deleteCaseManagementWorkspace = async (user) => {
  try {
    return await CaseManagementWorkspace.findOneAndDelete({ user }).lean();
  } catch (error) {
    logger.error('[deleteCaseManagementWorkspace] Error deleting workspace', error);
    throw new Error('Error deleting case management workspace');
  }
};

module.exports = {
  CaseManagementWorkspace,
  getCaseManagementWorkspace,
  saveCaseManagementWorkspace,
  deleteCaseManagementWorkspace,
};

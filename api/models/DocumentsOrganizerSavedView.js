const mongoose = require('mongoose');

const documentsOrganizerSavedViewSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    folderKey: { type: String, default: 'all', index: true },
    folderName: { type: String, default: 'All local files' },
    sourceRoot: { type: String, default: '' },
    searchQuery: { type: String, default: '' },
    sortBy: { type: String, default: 'modified_desc' },
    viewKey: { type: String, required: true },
    lastOpenedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

documentsOrganizerSavedViewSchema.index({ userId: 1, viewKey: 1 }, { unique: true });
documentsOrganizerSavedViewSchema.index({ userId: 1, updatedAt: -1 });
documentsOrganizerSavedViewSchema.index({ userId: 1, lastOpenedAt: -1 });

const DocumentsOrganizerSavedView =
  mongoose.models.DocumentsOrganizerSavedView ||
  mongoose.model('DocumentsOrganizerSavedView', documentsOrganizerSavedViewSchema);

module.exports = {
  DocumentsOrganizerSavedView,
};

const mongoose = require('mongoose');

const documentsOrganizerImportRunItemSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true },
    pathHash: { type: String, default: '' },
    filename: { type: String, required: true },
    displayPath: { type: String, default: '' },
    folderKey: { type: String, default: 'documents' },
    folderName: { type: String, default: 'Documents' },
    documentType: { type: String, default: 'document' },
    sizeBytes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'importing', 'imported', 'failed', 'skipped'],
      default: 'pending',
      index: true,
    },
    documentId: { type: String, default: '' },
    title: { type: String, default: '' },
    error: { type: String, default: '' },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { _id: false },
);

const documentsOrganizerImportRunSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'completed_with_errors', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    requestedCount: { type: Number, default: 0 },
    importedCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    source: { type: String, default: 'documents-organizer' },
    startedAt: { type: Date, required: true, index: true },
    completedAt: { type: Date, default: null },
    items: { type: [documentsOrganizerImportRunItemSchema], default: [] },
  },
  { timestamps: true },
);

documentsOrganizerImportRunSchema.index({ userId: 1, startedAt: -1 });

const DocumentsOrganizerImportRun =
  mongoose.models.DocumentsOrganizerImportRun ||
  mongoose.model('DocumentsOrganizerImportRun', documentsOrganizerImportRunSchema);

module.exports = {
  DocumentsOrganizerImportRun,
};

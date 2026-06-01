const mongoose = require('mongoose');

const documentsOrganizerFileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    scanId: { type: String, required: true, index: true },
    pathHash: { type: String, required: true },
    sourceRoot: { type: String, required: true, index: true },
    sourcePath: { type: String, required: true },
    displayPath: { type: String, required: true },
    relativePath: { type: String, required: true },
    filename: { type: String, required: true },
    basename: { type: String, required: true },
    extension: { type: String, required: true, index: true },
    documentType: { type: String, required: true, index: true },
    folderKey: { type: String, required: true, index: true },
    folderName: { type: String, required: true },
    sizeBytes: { type: Number, default: 0 },
    modifiedAt: { type: Date, default: null, index: true },
    createdOnDiskAt: { type: Date, default: null },
    discoveredAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ['indexed', 'missing'], default: 'indexed', index: true },
    contentIndexed: { type: Boolean, default: false },
    physicalMovePerformed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

documentsOrganizerFileSchema.index({ userId: 1, pathHash: 1 }, { unique: true });
documentsOrganizerFileSchema.index({ userId: 1, folderKey: 1, status: 1 });
documentsOrganizerFileSchema.index({ userId: 1, sourceRoot: 1, status: 1 });
documentsOrganizerFileSchema.index({ userId: 1, status: 1, filename: 1, sizeBytes: 1 });
documentsOrganizerFileSchema.index({ userId: 1, modifiedAt: -1 });

const DocumentsOrganizerFile =
  mongoose.models.DocumentsOrganizerFile ||
  mongoose.model('DocumentsOrganizerFile', documentsOrganizerFileSchema);

module.exports = {
  DocumentsOrganizerFile,
};

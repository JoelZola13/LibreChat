const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { DocumentsOrganizerFile } = require('~/models/DocumentsOrganizerFile');
const { DocumentsOrganizerImportRun } = require('~/models/DocumentsOrganizerImportRun');
const { DocumentsOrganizerSavedView } = require('~/models/DocumentsOrganizerSavedView');
const {
  DOCUMENTS_ORGANIZER_MOVE_CONFIRMATION,
  applyDocumentsOrganizerMovePlan,
  buildDocumentsOrganizerMovePlan,
  completeDocumentsOrganizerImportRun,
  createDocumentsOrganizerImportRun,
  createDocumentsOrganizerSavedView,
  deleteDocumentsOrganizerSavedView,
  exportDocumentsOrganizerMovePlan,
  getDocumentsOrganizerCollections,
  getDocumentsOrganizerDuplicates,
  getDocumentsOrganizerFiles,
  getDocumentsOrganizerImportRuns,
  getDocumentsOrganizerRecommendations,
  getDocumentsOrganizerSavedViews,
  getDocumentsOrganizerSummary,
  importDocumentsOrganizerFileWithDocling,
  openDocumentsOrganizerSavedView,
  previewDocumentsOrganizerImport,
  scanDocumentsOrganizer,
  updateDocumentsOrganizerImportRunItem,
} = require('./DocumentsOrganizer');

describe('DocumentsOrganizer', () => {
  let mongoServer;
  let tempRoot;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await DocumentsOrganizerFile.deleteMany({});
    await DocumentsOrganizerImportRun.deleteMany({});
    await DocumentsOrganizerSavedView.deleteMany({});
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'documents-organizer-'));
    await fs.mkdir(path.join(tempRoot, 'Nested'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'logs'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'Grant Proposal.docx'), 'word-body-not-read');
    await fs.writeFile(path.join(tempRoot, 'Budget.xlsx'), 'sheet-body-not-read');
    await fs.writeFile(path.join(tempRoot, 'Handbook.pdf'), 'pdf-body-not-read');
    await fs.writeFile(path.join(tempRoot, 'Nested', 'Notes.md'), '# notes-body-not-read');
    await fs.writeFile(path.join(tempRoot, '.hidden-audit.json'), '{"ignored":true}');
    await fs.writeFile(path.join(tempRoot, 'logs', 'runtime-audit.json'), '{"ignored":true}');
    await fs.writeFile(path.join(tempRoot, 'photo.png'), 'ignored');
  });

  afterEach(async () => {
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('scans document metadata into Mongo-backed virtual folders without indexing content', async () => {
    const result = await scanDocumentsOrganizer({
      userId: 'user-1',
      now: new Date('2026-05-04T20:00:00.000Z'),
      environment: {
        DOCUMENTS_ORGANIZER_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
        DOCUMENTS_ORGANIZER_MAX_FILES: '20',
        DOCUMENTS_ORGANIZER_MAX_DEPTH: '4',
      },
    });
    const summary = await getDocumentsOrganizerSummary({
      userId: 'user-1',
      environment: {
        DOCUMENTS_ORGANIZER_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
      },
    });

    expect(result).toMatchObject({
      type: 'documents_organizer_scan',
      storage: 'mongodb',
      scanned_file_count: 4,
      indexed_file_count: 4,
      content_indexed: false,
      physical_moves_performed: false,
      folders: expect.arrayContaining([
        expect.objectContaining({ folder_key: 'word-processing', folder_name: 'Word Processing', count: 1 }),
        expect.objectContaining({ folder_key: 'spreadsheets', folder_name: 'Spreadsheets', count: 1 }),
        expect.objectContaining({ folder_key: 'pdfs', folder_name: 'PDFs', count: 1 }),
        expect.objectContaining({ folder_key: 'notes-markdown', folder_name: 'Notes & Markdown', count: 1 }),
      ]),
    });
    expect(summary).toMatchObject({
      type: 'documents_organizer_summary',
      storage: 'mongodb',
      scanned_file_count: 4,
      folder_count: 4,
      content_indexed: false,
      physical_moves_performed: false,
    });
    expect(summary.recent_files[0]).not.toHaveProperty('content');
    expect(summary.recent_files[0]).not.toHaveProperty('content_text');
    expect(summary.recent_files[0]).not.toHaveProperty('metadata');

    const indexed = await DocumentsOrganizerFile.findOne({ filename: 'Grant Proposal.docx' }).lean();
    expect(indexed).toMatchObject({
      userId: 'user-1',
      documentType: 'word-processing',
      folderName: 'Word Processing',
      contentIndexed: false,
      physicalMovePerformed: false,
    });
    await expect(DocumentsOrganizerFile.exists({ filename: '.hidden-audit.json' })).resolves.toBeNull();
    await expect(DocumentsOrganizerFile.exists({ filename: 'runtime-audit.json' })).resolves.toBeNull();
  });

  it('lists indexed local files by virtual folder without reading content', async () => {
    await scanDocumentsOrganizer({
      userId: 'user-1',
      now: new Date('2026-05-04T20:00:00.000Z'),
      environment: {
        DOCUMENTS_ORGANIZER_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
        DOCUMENTS_ORGANIZER_MAX_FILES: '20',
        DOCUMENTS_ORGANIZER_MAX_DEPTH: '4',
      },
    });

    const result = await getDocumentsOrganizerFiles({
      userId: 'user-1',
      folderKey: 'pdfs',
      searchQuery: 'Handbook',
      limit: 10,
    });

    expect(result).toMatchObject({
      type: 'documents_organizer_files',
      storage: 'mongodb',
      folder_key: 'pdfs',
      query: 'Handbook',
      sort_by: 'modified_desc',
      limit: 10,
      offset: 0,
      next_offset: 1,
      has_more: false,
      total_count: 1,
      returned_count: 1,
      content_indexed: false,
    });
    expect(result.files[0]).toMatchObject({
      filename: 'Handbook.pdf',
      folder_key: 'pdfs',
      folder_name: 'PDFs',
    });
    expect(result.files[0]).not.toHaveProperty('content');
    expect(result.files[0]).not.toHaveProperty('content_text');
  });

  it('groups indexed metadata into source and type collections without reading content', async () => {
    await fs.mkdir(path.join(tempRoot, 'Downloads'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'Downloads', 'Recent Intake.docx'), 'download-body-not-read');

    await scanDocumentsOrganizer({
      userId: 'user-1',
      now: new Date('2026-05-04T20:00:00.000Z'),
      environment: {
        DOCUMENTS_ORGANIZER_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
        DOCUMENTS_ORGANIZER_MAX_FILES: '20',
        DOCUMENTS_ORGANIZER_MAX_DEPTH: '4',
      },
    });

    const collections = await getDocumentsOrganizerCollections({
      userId: 'user-1',
      limit: 5,
      environment: {
        DOCUMENTS_ORGANIZER_PHYSICAL_ROOT: path.join(tempRoot, 'Organized Documents'),
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
      },
    });

    expect(collections).toMatchObject({
      type: 'documents_organizer_collections',
      storage: 'mongodb',
      scanned_file_count: 5,
      source_root_count: 1,
      document_type_count: 4,
      content_indexed: false,
      physical_moves_performed: false,
      physical_target_root: path.join(tempRoot, 'Organized Documents'),
      source_roots: [
        expect.objectContaining({
          source_root: tempRoot,
          count: 5,
          folder_count: 4,
          folders: expect.arrayContaining([
            expect.objectContaining({ folder_key: 'word-processing', count: 2 }),
            expect.objectContaining({ folder_key: 'pdfs', count: 1 }),
          ]),
        }),
      ],
      document_types: expect.arrayContaining([
        expect.objectContaining({ folder_key: 'word-processing', count: 2 }),
        expect.objectContaining({ folder_key: 'spreadsheets', count: 1 }),
      ]),
    });
    expect(collections.source_roots[0]).not.toHaveProperty('content');
    expect(collections.document_types[0]).not.toHaveProperty('content_text');

    const sourceFiltered = await getDocumentsOrganizerFiles({
      userId: 'user-1',
      sourceRoot: tempRoot,
      folderKey: 'word-processing',
      limit: 10,
    });
    expect(sourceFiltered).toMatchObject({
      type: 'documents_organizer_files',
      source_root: tempRoot,
      folder_key: 'word-processing',
      total_count: 2,
      content_indexed: false,
    });
  });

  it('returns metadata-only organizer recommendation views', async () => {
    await fs.mkdir(path.join(tempRoot, 'Downloads'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'Downloads', 'Recent Intake.docx'), 'download-body-not-read');

    await scanDocumentsOrganizer({
      userId: 'user-1',
      now: new Date('2026-05-04T20:00:00.000Z'),
      environment: {
        DOCUMENTS_ORGANIZER_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
        DOCUMENTS_ORGANIZER_MAX_FILES: '20',
        DOCUMENTS_ORGANIZER_MAX_DEPTH: '4',
      },
    });

    const result = await getDocumentsOrganizerRecommendations({
      userId: 'user-1',
      limit: 5,
    });

    expect(result).toMatchObject({
      type: 'documents_organizer_recommendations',
      storage: 'mongodb',
      scanned_file_count: 5,
      returned_count: 5,
      content_indexed: false,
      physical_moves_performed: false,
      recommendations: expect.arrayContaining([
        expect.objectContaining({
          id: 'recent-downloads',
          search_query: 'Downloads',
          sort_by: 'modified_desc',
          matched_file_count: 1,
        }),
        expect.objectContaining({
          id: 'largest-pdfs',
          folder_key: 'pdfs',
          sort_by: 'size_desc',
          matched_file_count: 1,
        }),
        expect.objectContaining({
          id: 'office-drafts',
          folder_key: 'word-processing',
          matched_file_count: 2,
        }),
      ]),
    });
    expect(result.recommendations[0].sample_files[0]).not.toHaveProperty('content');
    expect(result.recommendations[0].sample_files[0]).not.toHaveProperty('content_text');
  });

  it('pages indexed local file metadata with offsets without reading content', async () => {
    await scanDocumentsOrganizer({
      userId: 'user-1',
      now: new Date('2026-05-04T20:00:00.000Z'),
      environment: {
        DOCUMENTS_ORGANIZER_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
        DOCUMENTS_ORGANIZER_MAX_FILES: '20',
        DOCUMENTS_ORGANIZER_MAX_DEPTH: '4',
      },
    });

    const result = await getDocumentsOrganizerFiles({
      userId: 'user-1',
      folderKey: 'all',
      sortBy: 'name_desc',
      limit: 2,
      offset: 1,
    });

    expect(result).toMatchObject({
      type: 'documents_organizer_files',
      storage: 'mongodb',
      folder_key: 'all',
      sort_by: 'name_desc',
      limit: 2,
      offset: 1,
      next_offset: 3,
      total_count: 4,
      returned_count: 2,
      has_more: true,
      content_indexed: false,
    });
    expect(result.files).toHaveLength(2);
    expect(result.files.map((file) => file.filename)).toEqual([
      'Handbook.pdf',
      'Grant Proposal.docx',
    ]);
    expect(result.files[0]).not.toHaveProperty('content');
    expect(result.files[0]).not.toHaveProperty('content_text');
  });

  it('finds possible duplicate local files from Mongo metadata without reading content', async () => {
    await fs.mkdir(path.join(tempRoot, 'Copies'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'Copies', 'Handbook.pdf'), 'pdf-body-not-read');

    await scanDocumentsOrganizer({
      userId: 'user-1',
      now: new Date('2026-05-04T20:00:00.000Z'),
      environment: {
        DOCUMENTS_ORGANIZER_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
        DOCUMENTS_ORGANIZER_MAX_FILES: '20',
        DOCUMENTS_ORGANIZER_MAX_DEPTH: '4',
      },
    });

    const result = await getDocumentsOrganizerDuplicates({
      userId: 'user-1',
      limit: 5,
      groupFileLimit: 1,
    });

    expect(result).toMatchObject({
      type: 'documents_organizer_duplicates',
      storage: 'mongodb',
      duplicate_group_count: 1,
      returned_group_count: 1,
      duplicate_file_count: 2,
      reclaimable_size_bytes: 17,
      include_project_files: false,
      include_technical_files: false,
      project_filter_applied: true,
      technical_filter_applied: true,
      content_indexed: false,
      groups: [
        expect.objectContaining({
          filename: 'Handbook.pdf',
          size_bytes: 17,
          count: 2,
          duplicate_size_bytes: 17,
          hidden_file_count: 1,
          files: [
            expect.objectContaining({
              filename: 'Handbook.pdf',
              folder_key: 'pdfs',
            }),
          ],
        }),
      ],
    });
    expect(result.groups[0].files[0]).not.toHaveProperty('content');
    expect(result.groups[0].files[0]).not.toHaveProperty('content_text');
  });

  it('filters technical and sensitive-looking duplicates by default and can include them on request', async () => {
    await fs.mkdir(path.join(tempRoot, 'nanobot-secrets'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'nanobot-secrets-share'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'nanobot-secrets', 'config.json'), '{"kind":"local-secret-config"}');
    await fs.writeFile(path.join(tempRoot, 'nanobot-secrets-share', 'config.json'), '{"kind":"local-secret-config"}');

    await scanDocumentsOrganizer({
      userId: 'user-1',
      now: new Date('2026-05-04T20:00:00.000Z'),
      environment: {
        DOCUMENTS_ORGANIZER_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
        DOCUMENTS_ORGANIZER_MAX_FILES: '20',
        DOCUMENTS_ORGANIZER_MAX_DEPTH: '5',
      },
    });

    const personalOnly = await getDocumentsOrganizerDuplicates({ userId: 'user-1' });
    expect(personalOnly).toMatchObject({
      duplicate_group_count: 0,
      duplicate_file_count: 0,
      include_technical_files: false,
      technical_filter_applied: true,
      groups: [],
    });

    const withTechnicalArtifacts = await getDocumentsOrganizerDuplicates({
      userId: 'user-1',
      includeTechnicalFiles: true,
    });
    expect(withTechnicalArtifacts).toMatchObject({
      duplicate_group_count: 1,
      duplicate_file_count: 2,
      include_technical_files: true,
      technical_filter_applied: false,
      groups: [
        expect.objectContaining({
          filename: 'config.json',
          count: 2,
        }),
      ],
    });
  });

  it('filters project artifact duplicates by default and can include them on request', async () => {
    await fs.mkdir(path.join(tempRoot, 'vendor', 'a'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'vendor', 'b'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'vendor', 'a', 'SECURITY.md'), 'dependency-security-note');
    await fs.writeFile(path.join(tempRoot, 'vendor', 'b', 'SECURITY.md'), 'dependency-security-note');

    await scanDocumentsOrganizer({
      userId: 'user-1',
      now: new Date('2026-05-04T20:00:00.000Z'),
      environment: {
        DOCUMENTS_ORGANIZER_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
        DOCUMENTS_ORGANIZER_MAX_FILES: '20',
        DOCUMENTS_ORGANIZER_MAX_DEPTH: '5',
      },
    });

    const personalOnly = await getDocumentsOrganizerDuplicates({ userId: 'user-1' });
    expect(personalOnly).toMatchObject({
      duplicate_group_count: 0,
      duplicate_file_count: 0,
      include_project_files: false,
      project_filter_applied: true,
      groups: [],
    });

    const withProjectArtifacts = await getDocumentsOrganizerDuplicates({
      userId: 'user-1',
      includeProjectFiles: true,
    });
    expect(withProjectArtifacts).toMatchObject({
      duplicate_group_count: 1,
      duplicate_file_count: 2,
      include_project_files: true,
      project_filter_applied: false,
      groups: [
        expect.objectContaining({
          filename: 'SECURITY.md',
          count: 2,
        }),
      ],
    });
  });

  it('saves, upserts, lists, and deletes Mongo-backed organizer views without indexing content', async () => {
    await scanDocumentsOrganizer({
      userId: 'user-1',
      now: new Date('2026-05-04T20:00:00.000Z'),
      environment: {
        DOCUMENTS_ORGANIZER_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
        DOCUMENTS_ORGANIZER_MAX_FILES: '20',
        DOCUMENTS_ORGANIZER_MAX_DEPTH: '4',
      },
    });

    const saved = await createDocumentsOrganizerSavedView({
      userId: 'user-1',
      folderKey: 'pdfs',
      folderName: 'PDFs',
      searchQuery: 'Handbook',
      sortBy: 'size_desc',
      now: new Date('2026-05-04T20:05:00.000Z'),
    });

    expect(saved).toMatchObject({
      type: 'documents_organizer_saved_view_saved',
      storage: 'mongodb',
      content_indexed: false,
      view: expect.objectContaining({
        name: 'PDFs: Handbook',
        folder_key: 'pdfs',
        folder_name: 'PDFs',
        search_query: 'Handbook',
        sort_by: 'size_desc',
        matched_file_count: 1,
        matched_size_bytes: 17,
        content_indexed: false,
      }),
    });
    expect(saved.view).not.toHaveProperty('content');
    expect(saved.view).not.toHaveProperty('content_text');

    const renamed = await createDocumentsOrganizerSavedView({
      userId: 'user-1',
      name: 'Policy PDFs',
      folderKey: 'pdfs',
      folderName: 'PDFs',
      searchQuery: 'Handbook',
      sortBy: 'size_desc',
      now: new Date('2026-05-04T20:06:00.000Z'),
    });
    expect(renamed.view.id).toBe(saved.view.id);
    expect(renamed.view.name).toBe('Policy PDFs');

    const list = await getDocumentsOrganizerSavedViews({ userId: 'user-1', limit: 5 });
    expect(list).toMatchObject({
      type: 'documents_organizer_saved_views',
      storage: 'mongodb',
      total_count: 1,
      returned_count: 1,
      views: [
        expect.objectContaining({
          id: saved.view.id,
          name: 'Policy PDFs',
          folder_key: 'pdfs',
          search_query: 'Handbook',
          sort_by: 'size_desc',
          matched_file_count: 1,
          matched_size_bytes: 17,
        }),
      ],
    });

    const opened = await openDocumentsOrganizerSavedView({
      userId: 'user-1',
      viewId: saved.view.id,
      now: new Date('2026-05-04T20:07:00.000Z'),
    });
    expect(opened).toMatchObject({
      type: 'documents_organizer_saved_view_opened',
      storage: 'mongodb',
      content_indexed: false,
      view: expect.objectContaining({
        id: saved.view.id,
        last_opened_at: '2026-05-04T20:07:00.000Z',
        matched_file_count: 1,
      }),
    });

    const deleted = await deleteDocumentsOrganizerSavedView({
      userId: 'user-1',
      viewId: saved.view.id,
    });
    expect(deleted).toMatchObject({
      type: 'documents_organizer_saved_view_deleted',
      storage: 'mongodb',
      content_indexed: false,
    });

    await expect(getDocumentsOrganizerSavedViews({ userId: 'user-1' })).resolves.toMatchObject({
      total_count: 0,
      returned_count: 0,
    });
  });

  it('converts an indexed local file through Docling without storing body content in the organizer index', async () => {
    await scanDocumentsOrganizer({
      userId: 'user-1',
      now: new Date('2026-05-04T20:00:00.000Z'),
      environment: {
        DOCUMENTS_ORGANIZER_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
        DOCUMENTS_ORGANIZER_MAX_FILES: '20',
        DOCUMENTS_ORGANIZER_MAX_DEPTH: '4',
      },
    });
    const indexed = await DocumentsOrganizerFile.findOne({ filename: 'Budget.xlsx' }).lean();
    const convertWithDocling = jest.fn(async ({ sourcePath, file, stats, exports, enrichments }) => {
      expect(sourcePath).toBe(path.join(tempRoot, 'Budget.xlsx'));
      expect(file.filename).toBe('Budget.xlsx');
      expect(stats.size).toBeGreaterThan(0);
      expect(exports).toBe('markdown,json,tables');
      expect(enrichments).toBe('code');

      return {
        converter: 'docling',
        filename: 'Budget.xlsx',
        title: 'Budget',
        exports: {
          markdown: '# Budget\n\n| Item | Amount |\n| --- | ---: |\n| Rent | 1200 |',
          json: { name: 'Budget' },
          tables: [{ index: 1, rows: 2 }],
        },
        metadata: { table_count: 1 },
      };
    });

    const result = await importDocumentsOrganizerFileWithDocling({
      userId: 'user-1',
      fileId: String(indexed._id),
      exports: 'markdown,json,tables',
      enrichments: 'code',
      environment: {
        DOCUMENTS_ORGANIZER_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
        DOCUMENTS_ORGANIZER_IMPORT_MAX_BYTES: String(10 * 1024 * 1024),
      },
      convertWithDocling,
    });

    expect(convertWithDocling).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      type: 'documents_organizer_docling_import',
      storage: 'filesystem+mongodb+docling',
      content_indexed: false,
      source_file: expect.objectContaining({
        filename: 'Budget.xlsx',
        folder_key: 'spreadsheets',
      }),
      docling: expect.objectContaining({
        converter: 'docling',
        title: 'Budget',
      }),
    });
    expect(result.source_file).not.toHaveProperty('content');
    expect(result.source_file).not.toHaveProperty('content_text');

    const stillIndexed = await DocumentsOrganizerFile.findById(indexed._id).lean();
    expect(stillIndexed).toMatchObject({
      filename: 'Budget.xlsx',
      contentIndexed: false,
      status: 'indexed',
    });
  });

  it('previews Docling import batches from Mongo metadata without reading content', async () => {
    await scanDocumentsOrganizer({
      userId: 'user-1',
      now: new Date('2026-05-04T20:00:00.000Z'),
      environment: {
        DOCUMENTS_ORGANIZER_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
        DOCUMENTS_ORGANIZER_MAX_FILES: '20',
        DOCUMENTS_ORGANIZER_MAX_DEPTH: '4',
      },
    });
    const indexedFiles = await DocumentsOrganizerFile.find({
      filename: { $in: ['Budget.xlsx', 'Handbook.pdf'] },
    }).sort({ filename: 1 }).lean();

    const preview = await previewDocumentsOrganizerImport({
      userId: 'user-1',
      fileIds: indexedFiles.map((file) => String(file._id)),
      environment: {
        DOCUMENTS_ORGANIZER_IMPORT_MAX_BYTES: '100',
      },
    });

    expect(preview).toMatchObject({
      type: 'documents_organizer_import_preview',
      storage: 'mongodb',
      requested_count: 2,
      preview_file_count: 2,
      missing_file_count: 0,
      estimated_docling_file_count: 2,
      conversion_provider: 'docling',
      requires_confirmation_phrase: 'IMPORT FILES',
      content_indexed: false,
      physical_moves_performed: false,
      folders: expect.arrayContaining([
        expect.objectContaining({ folder_key: 'spreadsheets', count: 1 }),
        expect.objectContaining({ folder_key: 'pdfs', count: 1 }),
      ]),
      source_roots: [
        expect.objectContaining({
          source_root: tempRoot,
          count: 2,
        }),
      ],
    });
    expect(preview.files[0]).not.toHaveProperty('content');
    expect(preview.files[0]).not.toHaveProperty('content_text');
    expect(preview.files[0]).not.toHaveProperty('metadata');
  });

  it('marks oversized import-run items skipped before Docling can read file bodies', async () => {
    await scanDocumentsOrganizer({
      userId: 'user-1',
      now: new Date('2026-05-04T20:00:00.000Z'),
      environment: {
        DOCUMENTS_ORGANIZER_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
        DOCUMENTS_ORGANIZER_MAX_FILES: '20',
        DOCUMENTS_ORGANIZER_MAX_DEPTH: '4',
      },
    });
    const indexed = await DocumentsOrganizerFile.findOne({ filename: 'Budget.xlsx' }).lean();

    const created = await createDocumentsOrganizerImportRun({
      userId: 'user-1',
      fileIds: [String(indexed._id)],
      environment: {
        DOCUMENTS_ORGANIZER_IMPORT_MAX_BYTES: '10',
      },
      now: new Date('2026-05-04T20:10:00.000Z'),
    });

    expect(created.run).toMatchObject({
      status: 'completed',
      requested_count: 1,
      imported_count: 0,
      failed_count: 0,
      skipped_count: 1,
      items: [
        expect.objectContaining({
          filename: 'Budget.xlsx',
          status: 'skipped',
          error: expect.stringContaining('Skipped before Docling import'),
        }),
      ],
    });
    expect(created.run.items[0]).not.toHaveProperty('content');
    expect(created.run.items[0]).not.toHaveProperty('content_text');
  });

  it('records Docling import runs and per-file outcomes without storing content', async () => {
    await scanDocumentsOrganizer({
      userId: 'user-1',
      now: new Date('2026-05-04T20:00:00.000Z'),
      environment: {
        DOCUMENTS_ORGANIZER_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
        DOCUMENTS_ORGANIZER_MAX_FILES: '20',
        DOCUMENTS_ORGANIZER_MAX_DEPTH: '4',
      },
    });
    const indexedFiles = await DocumentsOrganizerFile.find({
      filename: { $in: ['Budget.xlsx', 'Handbook.pdf'] },
    }).sort({ filename: 1 }).lean();

    const created = await createDocumentsOrganizerImportRun({
      userId: 'user-1',
      fileIds: indexedFiles.map((file) => String(file._id)),
      now: new Date('2026-05-04T20:10:00.000Z'),
    });

    expect(created).toMatchObject({
      type: 'documents_organizer_import_run_created',
      storage: 'mongodb',
      content_indexed: false,
      run: expect.objectContaining({
        status: 'running',
        requested_count: 2,
        imported_count: 0,
        failed_count: 0,
      }),
    });
    expect(created.run.items[0]).not.toHaveProperty('content');
    expect(created.run.items[0]).not.toHaveProperty('content_text');

    const runId = created.run.id;
    const budget = created.run.items.find((item) => item.filename === 'Budget.xlsx');
    const handbook = created.run.items.find((item) => item.filename === 'Handbook.pdf');

    await updateDocumentsOrganizerImportRunItem({
      userId: 'user-1',
      runId,
      fileId: budget.file_id,
      status: 'imported',
      documentId: 'document-1',
      title: 'Budget',
      now: new Date('2026-05-04T20:11:00.000Z'),
    });
    const failedUpdate = await updateDocumentsOrganizerImportRunItem({
      userId: 'user-1',
      runId,
      fileId: handbook.file_id,
      status: 'failed',
      error: 'Docling timed out',
      now: new Date('2026-05-04T20:12:00.000Z'),
    });

    expect(failedUpdate.run).toMatchObject({
      status: 'completed_with_errors',
      imported_count: 1,
      failed_count: 1,
    });

    const completed = await completeDocumentsOrganizerImportRun({
      userId: 'user-1',
      runId,
      now: new Date('2026-05-04T20:13:00.000Z'),
    });
    expect(completed.run).toMatchObject({
      status: 'completed_with_errors',
      requested_count: 2,
      imported_count: 1,
      failed_count: 1,
    });

    const reopened = await updateDocumentsOrganizerImportRunItem({
      userId: 'user-1',
      runId,
      fileId: handbook.file_id,
      status: 'importing',
      now: new Date('2026-05-04T20:14:00.000Z'),
    });
    expect(reopened.run).toMatchObject({
      status: 'running',
      imported_count: 1,
      failed_count: 0,
      completed_at: null,
    });
    expect(reopened.run.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        filename: 'Handbook.pdf',
        status: 'importing',
        error: '',
      }),
    ]));

    const history = await getDocumentsOrganizerImportRuns({ userId: 'user-1', limit: 3 });
    expect(history).toMatchObject({
      type: 'documents_organizer_import_runs',
      storage: 'mongodb',
      total_count: 1,
      returned_count: 1,
      runs: [
        expect.objectContaining({
          id: runId,
          content_indexed: false,
          items: expect.arrayContaining([
            expect.objectContaining({
              filename: 'Budget.xlsx',
              status: 'imported',
              document_id: 'document-1',
            }),
            expect.objectContaining({
              filename: 'Handbook.pdf',
              status: 'importing',
              error: '',
            }),
          ]),
        }),
      ],
    });
  });

  it('previews and applies collision-safe physical organization after explicit confirmation', async () => {
    const targetRoot = path.join(tempRoot, 'Organized Documents');
    await scanDocumentsOrganizer({
      userId: 'user-1',
      now: new Date('2026-05-04T20:00:00.000Z'),
      environment: {
        DOCUMENTS_ORGANIZER_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
        DOCUMENTS_ORGANIZER_MAX_FILES: '20',
        DOCUMENTS_ORGANIZER_MAX_DEPTH: '4',
      },
    });

    const plan = await buildDocumentsOrganizerMovePlan({
      userId: 'user-1',
      environment: {
        DOCUMENTS_ORGANIZER_PHYSICAL_ROOT: targetRoot,
        DOCUMENTS_ORGANIZER_PHYSICAL_SOURCE_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
        DOCUMENTS_ORGANIZER_MOVE_MAX_FILES: '20',
      },
    });

    expect(plan).toMatchObject({
      type: 'documents_organizer_move_plan',
      storage: 'filesystem+mongodb',
      target_root: targetRoot,
      confirmation_phrase: DOCUMENTS_ORGANIZER_MOVE_CONFIRMATION,
      requires_confirmation: true,
      move_count: 4,
      skipped_count: 0,
      physical_moves_performed: false,
      folders: expect.arrayContaining([
        expect.objectContaining({ folder_key: 'word-processing', folder_name: 'Word Processing', count: 1 }),
        expect.objectContaining({ folder_key: 'spreadsheets', folder_name: 'Spreadsheets', count: 1 }),
      ]),
    });
    expect(plan.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        filename: 'Grant Proposal.docx',
        target_display_path: expect.stringContaining('Organized Documents/Word Processing/Grant Proposal.docx'),
      }),
    ]));

    await expect(applyDocumentsOrganizerMovePlan({
      userId: 'user-1',
      confirmation: 'wrong',
      environment: {
        DOCUMENTS_ORGANIZER_PHYSICAL_ROOT: targetRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
      },
    })).rejects.toThrow(`Type ${DOCUMENTS_ORGANIZER_MOVE_CONFIRMATION} to move local files.`);

    const result = await applyDocumentsOrganizerMovePlan({
      userId: 'user-1',
      confirmation: DOCUMENTS_ORGANIZER_MOVE_CONFIRMATION,
      now: new Date('2026-05-04T20:05:00.000Z'),
      environment: {
        DOCUMENTS_ORGANIZER_PHYSICAL_ROOT: targetRoot,
        DOCUMENTS_ORGANIZER_PHYSICAL_SOURCE_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
        DOCUMENTS_ORGANIZER_MOVE_MAX_FILES: '20',
      },
    });

    expect(result).toMatchObject({
      type: 'documents_organizer_move_result',
      storage: 'filesystem+mongodb',
      moved_count: 4,
      failed_count: 0,
      physical_moves_performed: true,
      summary: expect.objectContaining({
        physical_moves_performed: true,
        moved_file_count: 4,
      }),
    });
    await expect(fs.stat(path.join(targetRoot, 'Word Processing', 'Grant Proposal.docx'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(targetRoot, 'Spreadsheets', 'Budget.xlsx'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(tempRoot, 'Grant Proposal.docx'))).rejects.toMatchObject({ code: 'ENOENT' });

    const moved = await DocumentsOrganizerFile.findOne({ filename: 'Grant Proposal.docx' }).lean();
    expect(moved).toMatchObject({
      sourceRoot: targetRoot,
      displayPath: expect.stringContaining('Organized Documents/Word Processing/Grant Proposal.docx'),
      physicalMovePerformed: true,
    });
  });

  it('exports a full content-free physical move plan manifest without moving files', async () => {
    const targetRoot = path.join(tempRoot, 'Organized Documents');
    const downloadedProjectRoot = path.join(tempRoot, 'downloaded-source-tree');
    await fs.mkdir(downloadedProjectRoot, { recursive: true });
    await fs.writeFile(path.join(downloadedProjectRoot, 'package.json'), '{"name":"do-not-move"}');
    await fs.writeFile(path.join(downloadedProjectRoot, 'Project Notes.md'), '# project-body-not-read');

    await scanDocumentsOrganizer({
      userId: 'user-1',
      now: new Date('2026-05-04T20:00:00.000Z'),
      environment: {
        DOCUMENTS_ORGANIZER_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
        DOCUMENTS_ORGANIZER_MAX_FILES: '20',
        DOCUMENTS_ORGANIZER_MAX_DEPTH: '4',
      },
    });

    const manifest = await exportDocumentsOrganizerMovePlan({
      userId: 'user-1',
      now: new Date('2026-05-04T20:06:00.000Z'),
      environment: {
        DOCUMENTS_ORGANIZER_PHYSICAL_ROOT: targetRoot,
        DOCUMENTS_ORGANIZER_PHYSICAL_SOURCE_ROOTS: tempRoot,
        DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
        DOCUMENTS_ORGANIZER_MOVE_MAX_FILES: '20',
      },
    });

    expect(manifest).toMatchObject({
      type: 'documents_organizer_move_plan_export',
      storage: 'filesystem+mongodb',
      format: 'json',
      schema_version: 1,
      generated_at: '2026-05-04T20:06:00.000Z',
      content_indexed: false,
      physical_moves_performed: false,
      action_count: 4,
      move_count: 4,
      skipped_count: 1,
      skipped_file_count: 1,
      project_file_skipped_count: 1,
      skipped_reason_counts: [
        expect.objectContaining({
          reason: 'inside-project-directory',
          count: 1,
        }),
      ],
      plan: expect.objectContaining({
        move_count: 4,
        action_sample_count: 4,
        skipped_file_sample_count: 1,
        skipped_reason_counts: [
          expect.objectContaining({
            reason: 'inside-project-directory',
            count: 1,
          }),
        ],
      }),
    });
    expect(manifest.manifest_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.plan.actions).toHaveLength(4);
    expect(manifest.plan.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        filename: 'Grant Proposal.docx',
        target_display_path: expect.stringContaining('Organized Documents/Word Processing/Grant Proposal.docx'),
      }),
    ]));
    expect(manifest.plan.actions[0]).not.toHaveProperty('content');
    expect(manifest.plan.actions[0]).not.toHaveProperty('content_text');
    expect(manifest.plan.actions[0]).not.toHaveProperty('metadata');
    expect(manifest.plan.skipped_files).toEqual([
      expect.objectContaining({
        filename: 'Project Notes.md',
        action: 'skip',
        reason: 'inside-project-directory',
      }),
    ]);
    expect(manifest.plan.skipped_files[0]).not.toHaveProperty('content_text');
    await expect(fs.stat(path.join(tempRoot, 'Grant Proposal.docx'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(targetRoot, 'Word Processing', 'Grant Proposal.docx'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('keeps project and structured-data files out of default physical move plans', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'documents-organizer-project-'));
    const downloadedProjectRoot = path.join(tempRoot, 'downloaded-source-tree');
    const targetRoot = path.join(tempRoot, 'Organized Documents');

    try {
      await fs.writeFile(path.join(projectRoot, 'package.json'), '{"name":"do-not-move"}');
      await fs.writeFile(path.join(projectRoot, 'Architecture.md'), '# project notes');
      await fs.mkdir(path.join(downloadedProjectRoot, 'docs'), { recursive: true });
      await fs.writeFile(path.join(downloadedProjectRoot, 'package.json'), '{"name":"also-do-not-move"}');
      await fs.writeFile(path.join(downloadedProjectRoot, 'AGENTS.md'), '# agent instructions');
      await fs.writeFile(path.join(downloadedProjectRoot, 'docs', 'Architecture.md'), '# downloaded project notes');
      await fs.writeFile(path.join(tempRoot, 'Personal Notes.md'), '# move this note');

      await scanDocumentsOrganizer({
        userId: 'user-1',
        now: new Date('2026-05-04T20:00:00.000Z'),
        environment: {
          DOCUMENTS_ORGANIZER_ROOTS: `${tempRoot},${projectRoot}`,
          DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
          DOCUMENTS_ORGANIZER_MAX_FILES: '20',
          DOCUMENTS_ORGANIZER_MAX_DEPTH: '6',
        },
      });

      const plan = await buildDocumentsOrganizerMovePlan({
        userId: 'user-1',
        environment: {
          DOCUMENTS_ORGANIZER_PHYSICAL_ROOT: targetRoot,
          DOCUMENTS_ORGANIZER_PHYSICAL_SOURCE_ROOTS: tempRoot,
          DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT: 'true',
          DOCUMENTS_ORGANIZER_MOVE_MAX_FILES: '20',
        },
      });

      expect(plan.move_count).toBe(5);
      expect(plan.source_roots).toEqual([tempRoot]);
      expect(plan.document_types).not.toContain('structured-data');
      expect(plan.project_file_skipped_count).toBe(2);
      const plannedFilenames = plan.actions.map((action) => action.filename);
      expect(plannedFilenames).toContain('Personal Notes.md');
      expect(plannedFilenames).not.toContain('package.json');
      expect(plannedFilenames).not.toContain('AGENTS.md');
      expect(plannedFilenames).not.toContain('Architecture.md');
    } finally {
      await fs.rm(projectRoot, { recursive: true, force: true });
    }
  });
});

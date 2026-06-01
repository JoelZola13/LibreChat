const express = require('express');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mockAuthenticatedUser = { id: 'user-1', role: 'USER' };

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, _res, next) => {
    req.user = mockAuthenticatedUser;
    next();
  },
}));

const documentsOrganizer = require('./documentsOrganizer');
const { DocumentsOrganizerFile } = require('~/models/DocumentsOrganizerFile');
const { DocumentsOrganizerImportRun } = require('~/models/DocumentsOrganizerImportRun');
const { DocumentsOrganizerSavedView } = require('~/models/DocumentsOrganizerSavedView');

describe('documentsOrganizer route', () => {
  let app;
  let mongoServer;
  let tempRoot;
  const originalRoots = process.env.DOCUMENTS_ORGANIZER_ROOTS;
  const originalAllowAnyRoot = process.env.DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT;
  const originalPhysicalRoot = process.env.DOCUMENTS_ORGANIZER_PHYSICAL_ROOT;
  const originalPhysicalSourceRoots = process.env.DOCUMENTS_ORGANIZER_PHYSICAL_SOURCE_ROOTS;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    if (originalRoots === undefined) {
      delete process.env.DOCUMENTS_ORGANIZER_ROOTS;
    } else {
      process.env.DOCUMENTS_ORGANIZER_ROOTS = originalRoots;
    }
    if (originalAllowAnyRoot === undefined) {
      delete process.env.DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT;
    } else {
      process.env.DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT = originalAllowAnyRoot;
    }
    if (originalPhysicalRoot === undefined) {
      delete process.env.DOCUMENTS_ORGANIZER_PHYSICAL_ROOT;
    } else {
      process.env.DOCUMENTS_ORGANIZER_PHYSICAL_ROOT = originalPhysicalRoot;
    }
    if (originalPhysicalSourceRoots === undefined) {
      delete process.env.DOCUMENTS_ORGANIZER_PHYSICAL_SOURCE_ROOTS;
    } else {
      process.env.DOCUMENTS_ORGANIZER_PHYSICAL_SOURCE_ROOTS = originalPhysicalSourceRoots;
    }
  });

  beforeEach(async () => {
    mockAuthenticatedUser = { id: 'user-1', role: 'USER' };
    await DocumentsOrganizerFile.deleteMany({});
    await DocumentsOrganizerImportRun.deleteMany({});
    await DocumentsOrganizerSavedView.deleteMany({});
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'documents-organizer-route-'));
    await fs.writeFile(path.join(tempRoot, 'Policy Memo.pdf'), 'pdf-body-not-read');
    await fs.writeFile(path.join(tempRoot, 'Roster.csv'), 'csv-body-not-read');
    process.env.DOCUMENTS_ORGANIZER_ROOTS = tempRoot;
    process.env.DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT = 'true';
    process.env.DOCUMENTS_ORGANIZER_PHYSICAL_ROOT = path.join(tempRoot, 'Organized Documents');
    process.env.DOCUMENTS_ORGANIZER_PHYSICAL_SOURCE_ROOTS = tempRoot;
    app = express();
    app.use(express.json());
    app.use('/api/documents/organizer', documentsOrganizer);
  });

  afterEach(async () => {
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('scans and returns a content-free Mongo-backed organizer summary', async () => {
    const scanResponse = await request(app)
      .post('/api/documents/organizer/scan?user_id=user-1')
      .expect(200);

    expect(scanResponse.body).toMatchObject({
      type: 'documents_organizer_scan',
      storage: 'mongodb',
      scanned_file_count: 2,
      indexed_file_count: 2,
      content_indexed: false,
      physical_moves_performed: false,
    });

    const summaryResponse = await request(app)
      .get('/api/documents/organizer/summary?user_id=user-1')
      .expect(200);

    expect(summaryResponse.body).toMatchObject({
      type: 'documents_organizer_summary',
      storage: 'mongodb',
      scanned_file_count: 2,
      folder_count: 2,
      content_indexed: false,
      physical_moves_performed: false,
      folders: expect.arrayContaining([
        expect.objectContaining({ folder_key: 'pdfs', folder_name: 'PDFs', count: 1 }),
        expect.objectContaining({ folder_key: 'spreadsheets', folder_name: 'Spreadsheets', count: 1 }),
      ]),
    });
    expect(summaryResponse.body.recent_files[0]).not.toHaveProperty('content');
    expect(summaryResponse.body.recent_files[0]).not.toHaveProperty('content_text');
    expect(summaryResponse.body.recent_files[0]).not.toHaveProperty('metadata');
  });

  it('returns folder-filtered local organizer files', async () => {
    await request(app)
      .post('/api/documents/organizer/scan?user_id=user-1')
      .expect(200);

    const response = await request(app)
      .get('/api/documents/organizer/files?user_id=user-1&folder_key=spreadsheets&q=Roster')
      .expect(200);

    expect(response.body).toMatchObject({
      type: 'documents_organizer_files',
      storage: 'mongodb',
      folder_key: 'spreadsheets',
      query: 'Roster',
      sort_by: 'modified_desc',
      offset: 0,
      next_offset: 1,
      has_more: false,
      total_count: 1,
      returned_count: 1,
      content_indexed: false,
    });
    expect(response.body.files).toEqual(expect.arrayContaining([
      expect.objectContaining({
        filename: 'Roster.csv',
        folder_key: 'spreadsheets',
      }),
    ]));
    expect(response.body.files[0]).not.toHaveProperty('content_text');
  });

  it('returns Mongo-backed organizer collections and filters files by source root', async () => {
    await request(app)
      .post('/api/documents/organizer/scan?user_id=user-1')
      .expect(200);

    const collectionsResponse = await request(app)
      .get('/api/documents/organizer/collections?user_id=user-1&limit=4')
      .expect(200);

    expect(collectionsResponse.body).toMatchObject({
      type: 'documents_organizer_collections',
      storage: 'mongodb',
      scanned_file_count: 2,
      source_root_count: 1,
      document_type_count: 2,
      content_indexed: false,
      physical_moves_performed: false,
      source_roots: [
        expect.objectContaining({
          source_root: tempRoot,
          count: 2,
          folders: expect.arrayContaining([
            expect.objectContaining({ folder_key: 'pdfs', count: 1 }),
            expect.objectContaining({ folder_key: 'spreadsheets', count: 1 }),
          ]),
        }),
      ],
      document_types: expect.arrayContaining([
        expect.objectContaining({ folder_key: 'pdfs', count: 1 }),
        expect.objectContaining({ folder_key: 'spreadsheets', count: 1 }),
      ]),
    });
    expect(collectionsResponse.body.source_roots[0]).not.toHaveProperty('content_text');

    const filesResponse = await request(app)
      .get(`/api/documents/organizer/files?user_id=user-1&source_root=${encodeURIComponent(tempRoot)}&folder_key=pdfs`)
      .expect(200);

    expect(filesResponse.body).toMatchObject({
      type: 'documents_organizer_files',
      source_root: tempRoot,
      folder_key: 'pdfs',
      total_count: 1,
      returned_count: 1,
      content_indexed: false,
      files: [
        expect.objectContaining({
          filename: 'Policy Memo.pdf',
          folder_key: 'pdfs',
        }),
      ],
    });
  });

  it('returns metadata-only organizer recommendation views', async () => {
    await fs.mkdir(path.join(tempRoot, 'Downloads'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'Downloads', 'Recent Intake.docx'), 'download-body-not-read');

    await request(app)
      .post('/api/documents/organizer/scan?user_id=user-1')
      .expect(200);

    const response = await request(app)
      .get('/api/documents/organizer/recommendations?user_id=user-1&limit=4')
      .expect(200);

    expect(response.body).toMatchObject({
      type: 'documents_organizer_recommendations',
      storage: 'mongodb',
      scanned_file_count: 3,
      returned_count: 4,
      content_indexed: false,
      physical_moves_performed: false,
      recommendations: expect.arrayContaining([
        expect.objectContaining({
          id: 'recent-downloads',
          search_query: 'Downloads',
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
          matched_file_count: 1,
        }),
      ]),
    });
    expect(response.body.recommendations[0].sample_files[0]).not.toHaveProperty('content_text');
  });

  it('returns paged local organizer files when an offset is provided', async () => {
    await request(app)
      .post('/api/documents/organizer/scan?user_id=user-1')
      .expect(200);

    const response = await request(app)
      .get('/api/documents/organizer/files?user_id=user-1&limit=1&offset=0&sort_by=name_desc')
      .expect(200);

    expect(response.body).toMatchObject({
      type: 'documents_organizer_files',
      storage: 'mongodb',
      folder_key: 'all',
      sort_by: 'name_desc',
      limit: 1,
      offset: 0,
      next_offset: 1,
      total_count: 2,
      returned_count: 1,
      has_more: true,
      content_indexed: false,
    });
    expect(response.body.files).toHaveLength(1);
    expect(response.body.files[0]).toMatchObject({ filename: 'Roster.csv' });
    expect(response.body.files[0]).not.toHaveProperty('content_text');
  });

  it('returns possible duplicate local files from metadata only', async () => {
    await fs.mkdir(path.join(tempRoot, 'Copies'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'Copies', 'Policy Memo.pdf'), 'pdf-body-not-read');

    await request(app)
      .post('/api/documents/organizer/scan?user_id=user-1')
      .expect(200);

    const response = await request(app)
      .get('/api/documents/organizer/duplicates?user_id=user-1&limit=4&group_file_limit=1')
      .expect(200);

    expect(response.body).toMatchObject({
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
          filename: 'Policy Memo.pdf',
          size_bytes: 17,
          count: 2,
          hidden_file_count: 1,
          files: [
            expect.objectContaining({
              filename: 'Policy Memo.pdf',
              folder_key: 'pdfs',
            }),
          ],
        }),
      ],
    });
    expect(response.body.groups[0].files[0]).not.toHaveProperty('content_text');
  });

  it('filters technical duplicate artifacts by default and can include them when requested', async () => {
    await fs.mkdir(path.join(tempRoot, 'nanobot-secrets'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'nanobot-secrets-share'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'nanobot-secrets', 'config.json'), '{"kind":"local-secret-config"}');
    await fs.writeFile(path.join(tempRoot, 'nanobot-secrets-share', 'config.json'), '{"kind":"local-secret-config"}');

    await request(app)
      .post('/api/documents/organizer/scan?user_id=user-1')
      .expect(200);

    const personalOnlyResponse = await request(app)
      .get('/api/documents/organizer/duplicates?user_id=user-1')
      .expect(200);
    expect(personalOnlyResponse.body).toMatchObject({
      duplicate_group_count: 0,
      duplicate_file_count: 0,
      include_technical_files: false,
      technical_filter_applied: true,
      groups: [],
    });

    const technicalResponse = await request(app)
      .get('/api/documents/organizer/duplicates?user_id=user-1&include_technical_files=true')
      .expect(200);
    expect(technicalResponse.body).toMatchObject({
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

  it('can include project artifact duplicates when requested', async () => {
    await fs.mkdir(path.join(tempRoot, 'vendor', 'a'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'vendor', 'b'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'vendor', 'a', 'SECURITY.md'), 'dependency-security-note');
    await fs.writeFile(path.join(tempRoot, 'vendor', 'b', 'SECURITY.md'), 'dependency-security-note');

    await request(app)
      .post('/api/documents/organizer/scan?user_id=user-1')
      .expect(200);

    const personalOnlyResponse = await request(app)
      .get('/api/documents/organizer/duplicates?user_id=user-1')
      .expect(200);
    expect(personalOnlyResponse.body).toMatchObject({
      duplicate_group_count: 0,
      duplicate_file_count: 0,
      include_project_files: false,
      project_filter_applied: true,
      groups: [],
    });

    const projectResponse = await request(app)
      .get('/api/documents/organizer/duplicates?user_id=user-1&include_project_files=true')
      .expect(200);
    expect(projectResponse.body).toMatchObject({
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

  it('previews file moves and requires confirmation before applying them', async () => {
    await request(app)
      .post('/api/documents/organizer/scan?user_id=user-1')
      .expect(200);

    const planResponse = await request(app)
      .post('/api/documents/organizer/plan-move?user_id=user-1')
      .expect(200);

    expect(planResponse.body).toMatchObject({
      type: 'documents_organizer_move_plan',
      storage: 'filesystem+mongodb',
      move_count: 2,
      requires_confirmation: true,
      confirmation_phrase: 'MOVE FILES',
      physical_moves_performed: false,
    });
    expect(planResponse.body.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        filename: 'Policy Memo.pdf',
        target_display_path: expect.stringContaining('Organized Documents/PDFs/Policy Memo.pdf'),
      }),
    ]));

    await request(app)
      .post('/api/documents/organizer/apply-move?user_id=user-1')
      .send({ confirmation: 'wrong' })
      .expect(400);

    const applyResponse = await request(app)
      .post('/api/documents/organizer/apply-move?user_id=user-1')
      .send({ confirmation: 'MOVE FILES' })
      .expect(200);

    expect(applyResponse.body).toMatchObject({
      type: 'documents_organizer_move_result',
      moved_count: 2,
      failed_count: 0,
      physical_moves_performed: true,
    });
    await expect(fs.stat(path.join(tempRoot, 'Organized Documents', 'PDFs', 'Policy Memo.pdf'))).resolves.toBeTruthy();
  });

  it('exports a full content-free move plan without applying it', async () => {
    await request(app)
      .post('/api/documents/organizer/scan?user_id=user-1')
      .expect(200);

    const response = await request(app)
      .post('/api/documents/organizer/plan-move/export?user_id=user-1')
      .expect(200);

    expect(response.body).toMatchObject({
      type: 'documents_organizer_move_plan_export',
      storage: 'filesystem+mongodb',
      format: 'json',
      schema_version: 1,
      action_count: 2,
      move_count: 2,
      skipped_count: 0,
      skipped_file_count: 0,
      skipped_reason_counts: [],
      content_indexed: false,
      physical_moves_performed: false,
      plan: expect.objectContaining({
        type: 'documents_organizer_move_plan',
        action_sample_count: 2,
        skipped_file_sample_count: 0,
        skipped_reason_counts: [],
        actions: expect.arrayContaining([
          expect.objectContaining({
            filename: 'Policy Memo.pdf',
            target_display_path: expect.stringContaining('Organized Documents/PDFs/Policy Memo.pdf'),
          }),
        ]),
      }),
    });
    expect(response.body.manifest_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(response.body.plan.actions[0]).not.toHaveProperty('content_text');
    await expect(fs.stat(path.join(tempRoot, 'Policy Memo.pdf'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(tempRoot, 'Organized Documents', 'PDFs', 'Policy Memo.pdf'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('creates, updates, completes, and lists organizer import run history', async () => {
    await request(app)
      .post('/api/documents/organizer/scan?user_id=user-1')
      .expect(200);
    const indexed = await DocumentsOrganizerFile.findOne({ filename: 'Policy Memo.pdf' }).lean();

    const createResponse = await request(app)
      .post('/api/documents/organizer/imports/runs?user_id=user-1')
      .send({ file_ids: [String(indexed._id)] })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      type: 'documents_organizer_import_run_created',
      storage: 'mongodb',
      content_indexed: false,
      run: expect.objectContaining({
        status: 'running',
        requested_count: 1,
        items: [
          expect.objectContaining({
            filename: 'Policy Memo.pdf',
            status: 'pending',
          }),
        ],
      }),
    });
    expect(createResponse.body.run.items[0]).not.toHaveProperty('content_text');

    const runId = createResponse.body.run.id;
    const fileId = createResponse.body.run.items[0].file_id;
    const updateResponse = await request(app)
      .patch(`/api/documents/organizer/imports/runs/${runId}/items/${fileId}?user_id=user-1`)
      .send({ status: 'imported', document_id: 'document-123', title: 'Policy Memo' })
      .expect(200);

    expect(updateResponse.body.run).toMatchObject({
      status: 'completed',
      imported_count: 1,
      failed_count: 0,
    });

    await request(app)
      .patch(`/api/documents/organizer/imports/runs/${runId}?user_id=user-1`)
      .send({})
      .expect(200);

    const listResponse = await request(app)
      .get('/api/documents/organizer/imports/runs?user_id=user-1')
      .expect(200);

    expect(listResponse.body).toMatchObject({
      type: 'documents_organizer_import_runs',
      storage: 'mongodb',
      total_count: 1,
      returned_count: 1,
      runs: [
        expect.objectContaining({
          id: runId,
          imported_count: 1,
          items: [
            expect.objectContaining({
              filename: 'Policy Memo.pdf',
              status: 'imported',
              document_id: 'document-123',
            }),
          ],
        }),
      ],
    });
  });

  it('previews selected organizer imports without content fields', async () => {
    await request(app)
      .post('/api/documents/organizer/scan?user_id=user-1')
      .expect(200);
    const indexed = await DocumentsOrganizerFile.find({
      filename: { $in: ['Policy Memo.pdf', 'Roster.csv'] },
    }).sort({ filename: 1 }).lean();

    const previewResponse = await request(app)
      .post('/api/documents/organizer/imports/preview?user_id=user-1')
      .send({ file_ids: indexed.map((file) => String(file._id)) })
      .expect(200);

    expect(previewResponse.body).toMatchObject({
      type: 'documents_organizer_import_preview',
      storage: 'mongodb',
      requested_count: 2,
      preview_file_count: 2,
      conversion_provider: 'docling',
      requires_confirmation_phrase: 'IMPORT FILES',
      content_indexed: false,
      physical_moves_performed: false,
      folders: expect.arrayContaining([
        expect.objectContaining({ folder_key: 'pdfs', count: 1 }),
        expect.objectContaining({ folder_key: 'spreadsheets', count: 1 }),
      ]),
    });
    expect(previewResponse.body.files[0]).not.toHaveProperty('content_text');
    expect(previewResponse.body.files[0]).not.toHaveProperty('metadata');
  });

  it('saves, lists, and deletes organizer views for the authenticated user', async () => {
    await request(app)
      .post('/api/documents/organizer/scan?user_id=user-1')
      .expect(200);

    const saveResponse = await request(app)
      .post('/api/documents/organizer/views?user_id=user-1')
      .send({
        folder_key: 'pdfs',
        folder_name: 'PDFs',
        search_query: 'Policy',
        sort_by: 'size_desc',
      })
      .expect(201);

    expect(saveResponse.body).toMatchObject({
      type: 'documents_organizer_saved_view_saved',
      storage: 'mongodb',
      content_indexed: false,
      view: expect.objectContaining({
        name: 'PDFs: Policy',
        folder_key: 'pdfs',
        folder_name: 'PDFs',
        search_query: 'Policy',
        sort_by: 'size_desc',
        matched_file_count: 1,
      }),
    });
    expect(saveResponse.body.view).not.toHaveProperty('content_text');

    const renamedResponse = await request(app)
      .post('/api/documents/organizer/views?user_id=user-1')
      .send({
        name: 'Policy PDFs',
        folder_key: 'pdfs',
        folder_name: 'PDFs',
        search_query: 'Policy',
        sort_by: 'size_desc',
      })
      .expect(201);

    expect(renamedResponse.body.view.id).toBe(saveResponse.body.view.id);
    expect(renamedResponse.body.view.name).toBe('Policy PDFs');

    const listResponse = await request(app)
      .get('/api/documents/organizer/views?user_id=user-1')
      .expect(200);

    expect(listResponse.body).toMatchObject({
      type: 'documents_organizer_saved_views',
      storage: 'mongodb',
      total_count: 1,
      returned_count: 1,
      views: [
        expect.objectContaining({
          id: saveResponse.body.view.id,
          name: 'Policy PDFs',
          folder_key: 'pdfs',
          search_query: 'Policy',
          sort_by: 'size_desc',
          matched_file_count: 1,
        }),
      ],
    });

    const openedResponse = await request(app)
      .patch(`/api/documents/organizer/views/${saveResponse.body.view.id}/open?user_id=user-1`)
      .expect(200);

    expect(openedResponse.body).toMatchObject({
      type: 'documents_organizer_saved_view_opened',
      storage: 'mongodb',
      content_indexed: false,
      view: expect.objectContaining({
        id: saveResponse.body.view.id,
        matched_file_count: 1,
      }),
    });
    expect(openedResponse.body.view.last_opened_at).toEqual(expect.any(String));

    await request(app)
      .delete(`/api/documents/organizer/views/${saveResponse.body.view.id}?user_id=user-1`)
      .expect(200);

    const emptyResponse = await request(app)
      .get('/api/documents/organizer/views?user_id=user-1')
      .expect(200);

    expect(emptyResponse.body).toMatchObject({
      total_count: 0,
      returned_count: 0,
      views: [],
    });
  });

  it('rejects attempts to scan as another user', async () => {
    const response = await request(app)
      .post('/api/documents/organizer/scan?user_id=other-user')
      .expect(403);

    expect(response.body).toMatchObject({
      message: 'Cannot act on behalf of another user',
    });
  });
});

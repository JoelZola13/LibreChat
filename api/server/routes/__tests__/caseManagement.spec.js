const express = require('express');
const crypto = require('crypto');
const request = require('supertest');

let wikiIngestions = [];
let wikiJobs = [];

const selectedSourceConfirmationSignature = (files) => {
  const fingerprint = files
    .map((file) => `${file.rootId}\u0000${file.relativePath}`)
    .sort((left, right) => left.localeCompare(right))
    .join('\n');
  return `${files.length}:${crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 16)}`;
};

const readyLocalArchiveFile = (file = {}) => ({
  ...file,
  fileName: file.fileName || String(file.relativePath || '').split('/').pop() || 'Source.md',
  importReadiness: file.importReadiness || 'ready-to-ingest',
  importPriority: file.importPriority || 'high',
  cleanupSignals: Array.isArray(file.cleanupSignals) ? file.cleanupSignals : [],
  sourceHistory: file.sourceHistory || null,
  lane: file.lane || 'Curated readable queue',
  lifeDomainId: file.lifeDomainId || 'street-voices',
});

const mockGetCaseManagementWikiIngestions = jest.fn();
const mockSaveCaseManagementWikiIngestion = jest.fn();
const mockUpdateCaseManagementWikiIngestionReview = jest.fn();
const mockBuildCaseWikiLocalArchiveCatalogRecord = jest.fn();
const mockBuildCaseWikiLocalArchiveExtractionRecord = jest.fn();
const mockBuildCaseWikiUpload = jest.fn();
const mockWriteCaseWikiGraphToNeo4j = jest.fn();
const mockPrepareCaseWikiWeaviateDryRun = jest.fn();
const mockDeleteCaseWikiWeaviateObjects = jest.fn();
const mockQueryCaseWikiWeaviateHybridSearch = jest.fn();
const mockWriteCaseWikiApprovedChunksToWeaviate = jest.fn();
const mockResolveLocalArchiveFile = jest.fn();
const mockBuildCaseWikiEmbeddingReviewGraph = jest.fn();
const mockBuildCaseWikiFollowUpTaskReconciliationReviewGraph = jest.fn();
const mockBuildCaseWikiLocalArchiveSourceFamilyDecisionGraph = jest.fn();
const mockBuildCaseWikiGraphWorkspaceReviewGraph = jest.fn();
const mockBuildCaseWikiGraphProvenanceLensGraph = jest.fn();
const mockSearchCaseWikiGraph = jest.fn();
const mockCreateCaseManagementProvenanceLensExportAudit = jest.fn();
const mockGetCaseManagementWorkspace = jest.fn();
const mockGetCaseManagementWorkspacesWithActiveLocalArchiveAutomation = jest.fn();
const mockGetCaseManagementProvenanceLens = jest.fn();
const mockGetCaseManagementProvenanceLensExportAudits = jest.fn();
const mockGetCaseManagementProvenanceLenses = jest.fn();
const mockSaveCaseManagementWorkspace = jest.fn();
const mockSaveCaseManagementProvenanceLens = jest.fn();
const mockDeleteCaseManagementProvenanceLens = jest.fn();
const mockCreateCaseManagementWikiIngestJob = jest.fn();
const mockGetCaseManagementWikiIngestJob = jest.fn();
const mockGetCaseManagementWikiIngestJobsForUser = jest.fn();
const mockUpdateCaseManagementWikiIngestJob = jest.fn();

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, _res, next) => next(),
}), { virtual: true });

jest.mock('~/config/paths', () => ({
  uploads: '/tmp/case-management-test-uploads',
}), { virtual: true });

jest.mock('~/models/CaseManagementWorkspace', () => ({
  getCaseManagementWorkspace: (...args) => mockGetCaseManagementWorkspace(...args),
  getCaseManagementWorkspacesWithActiveLocalArchiveAutomation: (...args) =>
    mockGetCaseManagementWorkspacesWithActiveLocalArchiveAutomation(...args),
  saveCaseManagementWorkspace: (...args) => mockSaveCaseManagementWorkspace(...args),
  deleteCaseManagementWorkspace: jest.fn(),
}), { virtual: true });

jest.mock('~/models/CaseManagementProvenanceLens', () => ({
  createCaseManagementProvenanceLensExportAudit: (...args) => mockCreateCaseManagementProvenanceLensExportAudit(...args),
  getCaseManagementProvenanceLens: (...args) => mockGetCaseManagementProvenanceLens(...args),
  getCaseManagementProvenanceLensExportAudits: (...args) => mockGetCaseManagementProvenanceLensExportAudits(...args),
  getCaseManagementProvenanceLenses: (...args) => mockGetCaseManagementProvenanceLenses(...args),
  saveCaseManagementProvenanceLens: (...args) => mockSaveCaseManagementProvenanceLens(...args),
  deleteCaseManagementProvenanceLens: (...args) => mockDeleteCaseManagementProvenanceLens(...args),
}), { virtual: true });

jest.mock('~/models/CaseManagementWikiIngestion', () => ({
  getCaseManagementWikiIngestions: (...args) => mockGetCaseManagementWikiIngestions(...args),
  saveCaseManagementWikiIngestion: (...args) => mockSaveCaseManagementWikiIngestion(...args),
  updateCaseManagementWikiIngestionReview: (...args) => mockUpdateCaseManagementWikiIngestionReview(...args),
}), { virtual: true });

jest.mock('~/models/CaseManagementWikiIngestJob', () => ({
  createCaseManagementWikiIngestJob: (...args) => mockCreateCaseManagementWikiIngestJob(...args),
  getCaseManagementWikiIngestJob: (...args) => mockGetCaseManagementWikiIngestJob(...args),
  getCaseManagementWikiIngestJobsForUser: (...args) => mockGetCaseManagementWikiIngestJobsForUser(...args),
  getPendingCaseManagementWikiIngestJobs: jest.fn().mockResolvedValue([]),
  updateCaseManagementWikiIngestJob: (...args) => mockUpdateCaseManagementWikiIngestJob(...args),
}), { virtual: true });

jest.mock('~/server/services/CaseManagementWikiIngestion', () => ({
  buildCaseWikiLocalArchiveCatalogRecord: (...args) => mockBuildCaseWikiLocalArchiveCatalogRecord(...args),
  buildCaseWikiLocalArchiveExtractionRecord: (...args) => mockBuildCaseWikiLocalArchiveExtractionRecord(...args),
  buildCaseWikiUpload: (...args) => mockBuildCaseWikiUpload(...args),
  normalizeWikiIngestContext: jest.fn((context = {}) => ({
    clientId: context.clientId || '',
    clientName: context.clientName || '',
    caseId: context.caseId || '',
    caseTitle: context.caseTitle || '',
    serviceName: context.serviceName || '',
    pageId: context.pageId || '',
    privacyLevel: context.privacyLevel || 'personal',
    redactionMode: context.redactionMode || 'strict',
    retentionPolicy: context.retentionPolicy || 'review-source',
    sourceScope: context.sourceScope || 'standalone',
    reviewBeforeGraphWrite: Boolean(context.reviewBeforeGraphWrite),
  })),
  writeCaseWikiGraphToNeo4j: (...args) => mockWriteCaseWikiGraphToNeo4j(...args),
}), { virtual: true });

jest.mock('~/server/services/CaseManagementWeaviate', () => ({
  deleteCaseWikiWeaviateObjects: (...args) => mockDeleteCaseWikiWeaviateObjects(...args),
  prepareCaseWikiWeaviateDryRun: (...args) => mockPrepareCaseWikiWeaviateDryRun(...args),
  queryCaseWikiWeaviateHybridSearch: (...args) => mockQueryCaseWikiWeaviateHybridSearch(...args),
  writeCaseWikiApprovedChunksToWeaviate: (...args) => mockWriteCaseWikiApprovedChunksToWeaviate(...args),
}), { virtual: true });

jest.mock('~/server/services/CaseManagementLocalArchive', () => ({
  localArchiveConfig: jest.fn(),
  scanLocalArchive: jest.fn(),
  resolveLocalArchiveFile: (...args) => mockResolveLocalArchiveFile(...args),
}), { virtual: true });

jest.mock('~/server/services/CaseManagementWikiGraph', () => ({
  buildCaseWikiEmbeddingReviewGraph: (...args) => mockBuildCaseWikiEmbeddingReviewGraph(...args),
  buildCaseWikiFollowUpTaskReconciliationReviewGraph: (...args) =>
    mockBuildCaseWikiFollowUpTaskReconciliationReviewGraph(...args),
  buildCaseWikiLocalArchiveSourceFamilyDecisionGraph: (...args) =>
    mockBuildCaseWikiLocalArchiveSourceFamilyDecisionGraph(...args),
  buildCaseWikiGraphBrowser: jest.fn(),
  buildCaseWikiGraphProvenanceLensGraph: (...args) => mockBuildCaseWikiGraphProvenanceLensGraph(...args),
  buildCaseWikiGraphWorkspaceGraph: jest.fn(),
  buildCaseWikiGraphWorkspaceReviewGraph: (...args) => mockBuildCaseWikiGraphWorkspaceReviewGraph(...args),
  queryCaseWikiGraphWorkspaces: jest.fn(),
  searchCaseWikiGraph: (...args) => mockSearchCaseWikiGraph(...args),
}), { virtual: true });

const setDotted = (target, key, value) => {
  const parts = key.split('.');
  let cursor = target;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      cursor[part] = value;
      return;
    }
    cursor[part] = cursor[part] && typeof cursor[part] === 'object' ? cursor[part] : {};
    cursor = cursor[part];
  });
};

const mergeReviewUpdates = (ingestion, updates) => {
  const next = JSON.parse(JSON.stringify(ingestion));
  Object.entries(updates).forEach(([key, value]) => {
    if (key.includes('.')) {
      setDotted(next, key, value);
    } else {
      next[key] = value;
    }
  });
  return next;
};

const makeIngestion = (overrides = {}) => ({
  fileId: 'source-001',
  originalName: 'Systems Innovation Partner List.csv',
  storedName: 'source-001.csv',
  sha256: 'hash-source-001',
  linkedClientId: '',
  linkedCaseId: '',
  linkedServiceName: '',
  sourceScope: 'standalone',
  privacy: {
    sourceScope: 'standalone',
    privacyLevel: 'personal',
    redactionMode: 'strict',
  },
  archive: {
    reviewStatus: 'needs-human-review',
    lifeDomain: 'Partners',
    sourceKind: 'table',
    suggestedWikiTitle: 'Systems Innovation Partner List',
    attachmentRecommendation:
      'Keep standalone until a person reviews whether this source belongs to a client, case, service, or project page.',
  },
  embeddingReview: {
    status: 'awaiting-review',
    chunks: [
      {
        id: 'embedding:source-001:1',
        status: 'pending-review',
        embeddingAction: 'pending-review',
        textPreview: 'Systems Innovation Lab partner list and follow-up notes.',
      },
    ],
  },
  wikiPage: {
    id: 'ingest:source-001',
    title: 'Systems Innovation Partner List',
    archive: {
      reviewStatus: 'needs-human-review',
      suggestedWikiTitle: 'Systems Innovation Partner List',
    },
  },
  generatedRecords: {
    frontendRecord: {
      id: 'source-001',
      pageId: 'ingest:source-001',
      title: 'Systems Innovation Partner List',
      fileName: 'Systems Innovation Partner List.csv',
      linkedClientId: '',
      linkedCaseId: '',
      linkedServiceName: '',
      sourceScope: 'standalone',
      sourceHash: 'hash-source-001',
      archive: {
        reviewStatus: 'needs-human-review',
        lifeDomain: 'Partners',
        sourceKind: 'table',
        suggestedWikiTitle: 'Systems Innovation Partner List',
      },
    },
    note: {
      id: 'note-source-001',
      clientId: '',
      caseId: '',
      structuredFields: ['Source boundary: standalone'],
    },
    document: {
      id: 'doc-source-001',
      clientId: '',
      caseId: '',
    },
    timeline: {
      id: 'timeline-source-001',
      clientId: '',
      caseId: '',
    },
    auditRecords: [],
  },
  graph: {
    nodes: [],
    edges: [],
  },
  ...overrides,
});

describe('Case Management archive review routes', () => {
  let app;

  beforeAll(() => {
    const caseManagementRouter = require('../caseManagement');
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: 'test-user-123' };
      next();
    });
    app.use('/api/case-management', caseManagementRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    wikiIngestions = [makeIngestion()];
    wikiJobs = [];
    mockGetCaseManagementWikiIngestions.mockImplementation(async () => wikiIngestions);
    mockSaveCaseManagementWikiIngestion.mockImplementation(async (_user, ingestion) => {
      wikiIngestions = [
        ingestion,
        ...wikiIngestions.filter((record) => record.fileId !== ingestion.fileId),
      ];
      return ingestion;
    });
    mockUpdateCaseManagementWikiIngestionReview.mockImplementation(async (_user, fileId, updates) => {
      const existing = wikiIngestions.find((ingestion) => ingestion.fileId === fileId);
      if (!existing) return null;
      const updated = mergeReviewUpdates(existing, updates);
      wikiIngestions = wikiIngestions.map((ingestion) => (ingestion.fileId === fileId ? updated : ingestion));
      return updated;
    });
    mockBuildCaseWikiLocalArchiveCatalogRecord.mockImplementation(async ({ candidate }) => ({
      fileId: `local-catalog-${candidate.id}`,
      originalName: candidate.fileName,
      storedName: candidate.relativePath,
      mimeType: candidate.mimeType || 'text/markdown',
      size: candidate.size || 0,
      sha256: candidate.sourceHash || `hash-${candidate.id}`,
      path: `local-archive://${candidate.rootLabel}/${candidate.relativePath}`,
      archive: {
        lifeDomain: candidate.lifeDomain || 'Projects',
        lifeDomainId: candidate.lifeDomainId || 'projects',
        sourceKind: candidate.sourceKind || 'document',
        lane: candidate.lane || 'Projects and strategy',
        reviewStatus: 'needs-human-review',
        localArchive: {
          rootId: candidate.rootId,
          rootLabel: candidate.rootLabel,
          relativePath: candidate.relativePath,
          displayPath: candidate.displayPath,
        },
      },
      extraction: {
        status: 'metadata-only',
        method: 'local archive metadata catalog',
        textPreview: 'catalog only',
      },
      wikiPage: {
        id: `ingest:local-catalog-${candidate.id}`,
        title: `Ingested source: ${candidate.fileName}`,
        archive: {
          reviewStatus: 'needs-human-review',
        },
      },
      generatedRecords: {
        frontendRecord: {
          id: `local-catalog-${candidate.id}`,
          fileName: candidate.fileName,
          pageId: `ingest:local-catalog-${candidate.id}`,
          title: `Ingested source: ${candidate.fileName}`,
          status: 'metadata-only',
          archive: {
            reviewStatus: 'needs-human-review',
            lifeDomain: candidate.lifeDomain || 'Projects',
            localArchive: {
              relativePath: candidate.relativePath,
            },
          },
          nodeCount: 2,
          edgeCount: 1,
        },
        note: { id: `note-${candidate.id}`, narrative: 'catalog only' },
        document: { id: `doc-${candidate.id}`, name: candidate.fileName },
        timeline: { id: `timeline-${candidate.id}`, title: `${candidate.fileName} cataloged` },
      },
      graph: {
        nodes: [
          { id: `file:local-catalog-${candidate.id}`, kind: 'SourceFile', props: {} },
          { id: `wiki:ingest:local-catalog-${candidate.id}`, kind: 'WikiPage', props: {} },
        ],
        edges: [
          {
            from: `file:local-catalog-${candidate.id}`,
            to: `wiki:ingest:local-catalog-${candidate.id}`,
            kind: 'GENERATED_WIKI_PAGE',
            props: {},
          },
        ],
      },
      neo4j: { status: 'preview' },
    }));
    mockBuildCaseWikiLocalArchiveExtractionRecord.mockImplementation(async ({ existing, localFile }) => ({
      ...existing,
      originalName: localFile.fileName,
      storedName: localFile.relativePath,
      mimeType: localFile.mimeType || existing.mimeType || 'text/markdown',
      size: localFile.size || existing.size || 2048,
      sha256: 'hash-extracted-local-source',
      path: `local-archive://${localFile.rootLabel}/${localFile.relativePath}`,
      sourceScope: 'standalone',
      archive: {
        ...(existing.archive || {}),
        catalogOnly: false,
        extractionStatus: 'ready',
        extractionMethod: 'utf8 text',
        localArchive: {
          rootId: localFile.rootId,
          rootLabel: localFile.rootLabel,
          relativePath: localFile.relativePath,
        },
      },
      vectorIndex: {
        provider: 'weaviate',
        status: 'planned',
        chunkCount: 1,
      },
      embeddingReview: {
        status: 'pending-review',
        writeMode: 'dry-run',
        writeEnabled: false,
        chunks: [{ id: 'embedding:local-catalog-candidate-001:1', status: 'pending-review', textPreview: 'extracted text' }],
        pendingCount: 1,
        approvedCount: 0,
        rejectedCount: 0,
      },
      weaviateDryRun: null,
      privacy: {
        sourceScope: 'standalone',
        privacyLevel: 'personal',
        redactionMode: 'strict',
        retentionPolicy: 'review-source',
      },
      extraction: {
        status: 'ready',
        method: 'utf8 text',
        textPreview: 'extracted text',
        textBytes: 14,
        rawTextBytes: 14,
      },
      wikiPage: {
        ...(existing.wikiPage || {}),
        id: existing.wikiPage?.id || `ingest:${existing.fileId}`,
        title: existing.wikiPage?.title || `Ingested source: ${localFile.fileName}`,
        summary: 'Extracted local archive source.',
        sections: [{ heading: 'Lead material', body: 'extracted text' }],
        entities: ['Projects'],
        archive: {
          ...(existing.archive || {}),
          catalogOnly: false,
        },
      },
      generatedRecords: {
        ...(existing.generatedRecords || {}),
        frontendRecord: {
          ...(existing.generatedRecords?.frontendRecord || {}),
          id: existing.fileId,
          fileName: localFile.fileName,
          pageId: existing.wikiPage?.id || `ingest:${existing.fileId}`,
          status: 'ready',
          extractionStatus: 'ready',
          extractionMethod: 'utf8 text',
          textPreview: 'extracted text',
          embeddingReview: {
            status: 'pending-review',
            chunks: [{ id: 'embedding:local-catalog-candidate-001:1', status: 'pending-review', textPreview: 'extracted text' }],
            pendingCount: 1,
          },
          archive: {
            ...(existing.archive || {}),
            catalogOnly: false,
            localArchive: {
              rootId: localFile.rootId,
              rootLabel: localFile.rootLabel,
              relativePath: localFile.relativePath,
            },
          },
        },
        note: { id: 'note-local-extract', narrative: 'Extracted local archive source.' },
        document: { id: 'doc-local-extract', name: localFile.fileName },
        timeline: { id: 'timeline-local-extract', title: `${localFile.fileName} extracted` },
      },
      graph: {
        nodes: [{ id: `file:${existing.fileId}`, kind: 'SourceFile', props: {} }],
        edges: [],
      },
      graphSummary: { nodeKinds: { SourceFile: 1 }, edgeKinds: {} },
      neo4j: { status: 'written', nodeCount: 1, edgeCount: 0 },
    }));
    mockResolveLocalArchiveFile.mockImplementation(async ({ rootId, relativePath }) => ({
      rootId,
      rootLabel: 'Documents',
      relativePath,
      fileName: relativePath.split('/').pop(),
      path: __filename,
      size: 2048,
      mimeType: 'text/markdown',
      modifiedAt: '2026-05-02T10:00:00.000Z',
    }));
    mockBuildCaseWikiUpload.mockImplementation(async ({ file }) => ({
      fileId: `uploaded-${file.originalname.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      generatedRecords: {
        frontendRecord: {
          id: `uploaded-${file.originalname}`,
          pageId: `ingest:uploaded-${file.originalname}`,
          title: file.originalname,
          fileName: file.originalname,
          sourceScope: 'standalone',
        },
        note: { id: `note-uploaded-${file.originalname}` },
        document: { id: `doc-uploaded-${file.originalname}` },
        timeline: { id: `timeline-uploaded-${file.originalname}` },
      },
      wikiPage: {
        id: `ingest:uploaded-${file.originalname}`,
        title: file.originalname,
      },
      neo4j: { status: 'written', nodeCount: 2, edgeCount: 1 },
      graph: {
        nodes: [{ id: `file:uploaded-${file.originalname}`, kind: 'SourceFile', props: {} }],
        edges: [],
      },
    }));
    mockBuildCaseWikiEmbeddingReviewGraph.mockImplementation(({ ingestion, embeddingReview, vectorWrite }) => ({
      reviewNodeId: `embedding-review:${ingestion.fileId || 'source-001'}`,
      sourceNodeId: `file:${ingestion.fileId || 'source-001'}`,
      vectorIndexNodeId: 'vector-index:weaviate:case-wiki-source-chunk',
      chunkNodeCount: embeddingReview?.chunks?.length || 0,
      graph: {
        nodes: [
          { id: `file:${ingestion.fileId || 'source-001'}`, kind: 'SourceFile', props: {} },
          { id: `embedding-review:${ingestion.fileId || 'source-001'}`, kind: 'EmbeddingReview', props: {} },
          { id: 'embedding-chunk:test', kind: 'EmbeddingChunk', props: {} },
          { id: 'vector-index:weaviate:case-wiki-source-chunk', kind: 'VectorIndex', props: {} },
        ],
        edges: [
          {
            from: `file:${ingestion.fileId || 'source-001'}`,
            to: `embedding-review:${ingestion.fileId || 'source-001'}`,
            kind: 'HAS_EMBEDDING_REVIEW',
            props: {},
          },
          {
            from: 'embedding-chunk:test',
            to: 'vector-index:weaviate:case-wiki-source-chunk',
            kind: vectorWrite ? 'INDEXED_IN' : 'READY_FOR_INDEX',
            props: {},
          },
        ],
      },
    }));
    mockWriteCaseWikiGraphToNeo4j.mockResolvedValue({ status: 'written', nodeCount: 3, edgeCount: 2 });
    mockCreateCaseManagementProvenanceLensExportAudit.mockImplementation(async (_user, audit) => ({
      auditId: audit.id,
      actor: audit.actor,
      exportType: audit.exportType,
      format: audit.format,
      filename: audit.filename,
      contentType: audit.contentType,
      privacyNote: audit.privacyNote,
      lensCount: audit.lensCount,
      activityCount: audit.activityCount,
      visibleLensIds: audit.visibleLensIds,
      exportedAt: audit.exportedAt,
    }));
    mockGetCaseManagementProvenanceLens.mockResolvedValue(null);
    mockGetCaseManagementProvenanceLensExportAudits.mockResolvedValue([]);
    mockGetCaseManagementProvenanceLenses.mockResolvedValue([]);
    mockGetCaseManagementWorkspace.mockResolvedValue({
      version: 1,
      savedAt: '2026-05-01T11:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-01T11:00:00.000Z',
        caseRecords: [],
        taskRecords: [],
        noteRecords: [],
        timelineRecords: [],
        auditRecords: [],
      },
    });
    mockGetCaseManagementWorkspacesWithActiveLocalArchiveAutomation.mockResolvedValue([]);
    mockSaveCaseManagementWorkspace.mockImplementation(async (_user, workspace) => ({
      version: 1,
      savedAt: workspace.savedAt || '2026-05-01T12:02:00.000Z',
      workspace,
    }));
    mockCreateCaseManagementWikiIngestJob.mockImplementation(async (_user, job) => {
      const created = JSON.parse(JSON.stringify({
        ...job,
        user: _user,
        createdAt: '2026-05-02T12:00:00.000Z',
        updatedAt: '2026-05-02T12:00:00.000Z',
      }));
      wikiJobs = [created, ...wikiJobs.filter((existing) => existing.jobId !== created.jobId)];
      return created;
    });
    mockGetCaseManagementWikiIngestJob.mockImplementation(async (_user, jobId) =>
      wikiJobs.find((job) => job.user === _user && job.jobId === jobId) || null,
    );
    mockGetCaseManagementWikiIngestJobsForUser.mockResolvedValue([]);
    mockUpdateCaseManagementWikiIngestJob.mockImplementation(async (_user, jobId, update) => {
      const existing =
        wikiJobs.find((job) => job.user === _user && job.jobId === jobId) || {
          user: _user,
          jobId,
          status: 'queued',
          context: {},
          items: [],
          ingestions: [],
          wikiIngestionRecords: [],
          generatedRecords: { noteRecords: [], documentRecords: [], timelineRecords: [] },
          graphPreviews: [],
          neo4j: [],
          createdAt: '2026-05-02T12:00:00.000Z',
        };
      const updated = {
        ...existing,
        ...(update?.$set || {}),
        updatedAt: '2026-05-02T12:00:00.000Z',
      };
      wikiJobs = [updated, ...wikiJobs.filter((job) => !(job.user === _user && job.jobId === jobId))];
      return updated;
    });
    mockSaveCaseManagementProvenanceLens.mockImplementation(async (_user, lens) => ({
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
      activityRecords: lens.activityRecords,
      lensCreatedAt: lens.createdAt,
      lensUpdatedAt: lens.updatedAt,
      serverSyncedAt: '2026-05-01T12:01:00.000Z',
      neo4jNodeId: lens.neo4jNodeId,
      neo4jStatus: lens.neo4jStatus,
      neo4jMessage: lens.neo4jMessage,
    }));
    mockDeleteCaseManagementProvenanceLens.mockResolvedValue({
      lensId: 'life-domain-graph-provenance-view-001',
      name: 'Approved graph lens',
      query: 'graph',
      reviewFilter: 'approved',
      domainFilter: 'all',
      browserScope: 'all-domains',
      lensCreatedAt: '2026-05-01T12:00:00.000Z',
      lensUpdatedAt: '2026-05-01T12:00:00.000Z',
      createdBy: 'Joel Zola',
    });
    mockBuildCaseWikiGraphProvenanceLensGraph.mockImplementation(({ lens, userId }) => ({
      provenanceLens: {
        id: lens.id,
        nodeId: `graph-provenance-lens:${lens.id}`,
        name: lens.name,
        query: lens.query,
        reviewFilter: lens.reviewFilter,
        domainFilter: lens.domainFilter,
        browserScope: lens.browserScope,
        resultCount: lens.resultCount,
        matchingWorkspaceCount: lens.matchingWorkspaceCount,
        createdAt: lens.createdAt,
        updatedAt: lens.updatedAt,
        createdBy: lens.createdBy,
      visibility: lens.visibility || 'private',
      sharedWith: lens.sharedWith || [],
      shareNote: lens.shareNote || '',
      accessRole: lens.accessRole || 'manager',
      accessRoles: lens.accessRoles || {},
      activityRecords: lens.activityRecords || [],
      userId,
    },
      graph: {
        nodes: [
          { id: `graph-provenance-lens:${lens.id}`, kind: 'GraphProvenanceLens' },
        ],
        edges: [],
      },
    }));
    mockBuildCaseWikiGraphWorkspaceReviewGraph.mockReturnValue({
      graphWorkspaceReview: {
        id: 'graph-workspace-audit-review-001',
        nodeId: 'graph-workspace-review:graph-workspace-audit-review-001',
        auditId: 'graph-workspace-audit:abc123',
        workspaceId: 'life-domain-graph-001',
        status: 'approved',
      },
      graph: {
        nodes: [
          { id: 'graph-workspace-review:graph-workspace-audit-review-001', kind: 'GraphWorkspaceReview' },
        ],
        edges: [
          {
            from: 'graph-workspace-audit:abc123',
            to: 'graph-workspace-review:graph-workspace-audit-review-001',
            kind: 'HAS_WORKSPACE_REVIEW',
          },
        ],
      },
    });
    mockBuildCaseWikiLocalArchiveSourceFamilyDecisionGraph.mockImplementation(({ decisionRecord }) => ({
      sourceFamilyDecision: {
        id: decisionRecord.id,
        nodeId: decisionRecord.graphNodeId || `local-archive-source-family-decision:${decisionRecord.candidateId}`,
        candidateId: decisionRecord.candidateId,
        action: decisionRecord.action,
        label: decisionRecord.label,
      },
      graph: {
        nodes: [
          {
            id: decisionRecord.graphNodeId || `local-archive-source-family-decision:${decisionRecord.candidateId}`,
            kind: 'SourceFamilyReviewDecision',
          },
          {
            id: `local-archive-candidate:${decisionRecord.candidateId}`,
            kind: 'LocalArchiveCandidate',
          },
        ],
        edges: [
          {
            from: `local-archive-candidate:${decisionRecord.candidateId}`,
            to: decisionRecord.graphNodeId || `local-archive-source-family-decision:${decisionRecord.candidateId}`,
            kind: 'HAS_SOURCE_FAMILY_REVIEW',
          },
        ],
      },
    }));
    mockBuildCaseWikiFollowUpTaskReconciliationReviewGraph.mockReturnValue({
      followUpReconciliationReview: {
        id: 'follow-up-reconciliation-review-001',
        nodeId: 'case-wiki-follow-up-reconciliation-review:follow-up-reconciliation-review-001',
        auditId: 'audit-case-wiki-follow-up-reconciliation-stale',
        status: 'stale-task',
        decision: 'completed-stale-task',
      },
      graph: {
        nodes: [
          {
            id: 'case-wiki-follow-up-reconciliation-review:follow-up-reconciliation-review-001',
            kind: 'CaseWikiFollowUpTaskReconciliationReview',
          },
        ],
        edges: [
          {
            from: 'case-wiki-follow-up-reconciliation-audit:audit-case-wiki-follow-up-reconciliation-stale',
            to: 'case-wiki-follow-up-reconciliation-review:follow-up-reconciliation-review-001',
            kind: 'HAS_FOLLOW_UP_RECONCILIATION_REVIEW',
          },
        ],
      },
    });
    mockPrepareCaseWikiWeaviateDryRun.mockReturnValue({
      status: 'prepared',
      objectCount: 1,
      message: 'Prepared 1 reviewed chunk for Weaviate dry-run. No vectors were written.',
    });
    mockSearchCaseWikiGraph.mockImplementation(({ query = '', lifeDomainId = 'all' } = {}) => ({
      status: query ? 'ready' : 'empty-query',
      query,
      lifeDomainId,
      resultCount: query ? 1 : 0,
      totalMatches: query ? 1 : 0,
      results: query
        ? [
            {
              id: 'source-001',
              pageId: 'ingest:source-001',
              title: 'Systems Innovation Partner List',
              fileName: 'Systems Innovation Partner List.docx',
              lifeDomain: 'Partners',
              lifeDomainId: 'partners',
              sourceKind: 'document',
              reviewStatus: 'reviewed-standalone',
              score: 42,
              matchReasons: ['wiki title'],
              textPreview: 'Systems innovation partner list',
              graph: { nodeCount: 2, edgeCount: 1 },
            },
          ]
        : [],
      generatedAt: '2026-05-02T12:00:00.000Z',
    }));
    mockQueryCaseWikiWeaviateHybridSearch.mockResolvedValue({
      status: 'skipped',
      provider: 'weaviate',
      collection: 'CaseWikiSourceChunk',
      query: 'systems innovation',
      resultCount: 0,
      results: [],
      message: 'No Case Wiki sources have live Weaviate object IDs yet.',
      warnings: ['no-indexed-sources'],
    });
    mockWriteCaseWikiApprovedChunksToWeaviate.mockResolvedValue({
      status: 'written',
      mode: 'live',
      provider: 'weaviate',
      collection: 'CaseWikiSourceChunk',
      targetClass: 'CaseWikiSourceChunk',
      endpoint: 'http://localhost:8080',
      objectCount: 1,
      attemptedObjectCount: 1,
      approvedChunkCount: 1,
      writtenAt: '2026-05-02T12:00:00.000Z',
      writtenBy: 'Current worker',
      message: 'Wrote 1 reviewed chunk to Weaviate.',
      warnings: [],
      objectIds: ['weaviate-object-001'],
      objectLedger: [
        {
          objectId: 'weaviate-object-001',
          chunkId: 'embedding:source-001:1',
          sourceDocumentId: 'source-001',
          wikiPageId: 'ingest:source-001',
          textHash: 'text-hash-001',
          propertyHash: 'property-hash-001',
        },
      ],
      objectMap: {
        'embedding:source-001:1': {
          objectId: 'weaviate-object-001',
          textHash: 'text-hash-001',
          propertyHash: 'property-hash-001',
        },
      },
      objectFingerprint: 'fingerprint-001',
    });
    mockDeleteCaseWikiWeaviateObjects.mockResolvedValue({
      status: 'deleted',
      mode: 'delete',
      provider: 'weaviate',
      collection: 'CaseWikiSourceChunk',
      targetClass: 'CaseWikiSourceChunk',
      endpoint: 'http://localhost:8080',
      requestedObjectCount: 1,
      deletedObjectCount: 1,
      failedObjectCount: 0,
      deletedObjectIds: ['weaviate-object-001'],
      failedObjectIds: [],
      objectIds: ['weaviate-object-001'],
      deletedAt: '2026-05-02T12:05:00.000Z',
      deletedBy: 'Current worker',
      message: 'Deleted 1 Weaviate object for this source.',
      warnings: [],
    });
  });

  it('returns unified retrieval results without requiring live vector writes', async () => {
    const response = await request(app)
      .get('/api/case-management/wiki/retrieval/search')
      .query({ query: 'systems innovation', limit: 8 });

    expect(response.status).toBe(200);
    expect(mockSearchCaseWikiGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'systems innovation',
        lifeDomainId: 'all',
        limit: 8,
      }),
    );
    expect(mockQueryCaseWikiWeaviateHybridSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'systems innovation',
        sourceDocumentIds: [],
      }),
    );
    expect(response.body.retrieval).toEqual(
      expect.objectContaining({
        status: 'ready',
        query: 'systems innovation',
        indexedSourceCount: 0,
        graphSearch: expect.objectContaining({ resultCount: 1 }),
        chunkSearch: expect.objectContaining({
          resultCount: 1,
          results: [
            expect.objectContaining({
              sourceDocumentId: 'source-001',
              chunkId: 'embedding:source-001:1',
              eligibleForVector: false,
            }),
          ],
        }),
        vectorSearch: expect.objectContaining({
          status: 'skipped',
          warnings: ['no-indexed-sources'],
        }),
        ranking: expect.objectContaining({
          status: 'ready',
          reviewedCount: 0,
          candidateCount: 1,
          results: expect.arrayContaining([
            expect.objectContaining({
              sourceDocumentId: 'source-001',
              evidenceState: 'candidate',
              canUseInAnswer: false,
              confidence: 'candidate-needs-review',
            }),
          ]),
        }),
        answerDraft: expect.objectContaining({
          status: 'needs-review',
          trustLevel: 'candidate-only',
          citations: [],
          synthesis: expect.objectContaining({
            status: 'blocked',
            mode: 'reviewed-citation-constrained',
            usedCitationIds: [],
            citationCoverage: expect.objectContaining({
              reviewedCitationCount: 0,
              candidateCitationCount: 1,
              blockedSectionCount: 3,
            }),
            coverageChecks: expect.arrayContaining([
              expect.objectContaining({
                id: 'reviewed-citations',
                status: 'blocked',
              }),
              expect.objectContaining({
                id: 'candidate-exclusion',
                status: 'pass',
              }),
            ]),
            modelSynthesisPacket: expect.objectContaining({
              status: 'blocked',
              mode: 'reviewed-citation-model-packet',
              modelCallStatus: 'not-started',
              allowedCitationIds: [],
              excludedCandidateCitationIds: expect.arrayContaining(['embedding:source-001:1']),
              promptMessages: [],
            }),
          }),
          promotionPreview: expect.objectContaining({
            status: 'blocked-needs-reviewed-citations',
            publishMode: 'preview-only',
            citationCoverageDiff: expect.objectContaining({
              status: 'blocked',
              mode: 'promotion-citation-coverage-diff',
              reviewedCitationCount: 0,
              candidateCitationCount: 1,
              promotableSectionCount: 0,
              excludedSectionCount: 2,
            }),
            blockedReasons: ['No reviewed citations are available for promotion.'],
          }),
          candidateCitations: [
            expect.objectContaining({
              sourceDocumentId: 'source-001',
              evidenceState: 'candidate',
            }),
          ],
        }),
      }),
    );
    expect(response.body.retrieval.summary.message).toContain('Weaviate remains inactive');
    expect(response.body.retrieval.answerDraft.lead).toContain('no matching chunk has been approved');
  });

  it('includes Weaviate hybrid results when reviewed chunks have live vector object IDs', async () => {
    wikiIngestions = [
      makeIngestion({
        vectorIndex: {
          status: 'written',
          objectIds: ['weaviate-object-001'],
          collection: 'CaseWikiSourceChunk',
        },
      }),
    ];
    mockQueryCaseWikiWeaviateHybridSearch.mockResolvedValueOnce({
      status: 'ready',
      provider: 'weaviate',
      collection: 'CaseWikiSourceChunk',
      query: 'systems innovation',
      resultCount: 1,
      results: [
        {
          objectId: 'weaviate-object-001',
          chunkId: 'embedding:source-001:1',
          sourceDocumentId: 'source-001',
          sourceTitle: 'Systems Innovation Partner List',
          chunkText: 'Systems innovation partner list and follow-up notes.',
        },
      ],
      message: 'Weaviate hybrid search returned 1 reviewed chunk.',
      warnings: [],
    });

    const response = await request(app)
      .get('/api/case-management/wiki/retrieval/search')
      .query({ query: 'systems innovation', limit: 8 });

    expect(response.status).toBe(200);
    expect(mockQueryCaseWikiWeaviateHybridSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'systems innovation',
        sourceDocumentIds: ['source-001'],
      }),
    );
    expect(response.body.retrieval).toEqual(
      expect.objectContaining({
        indexedSourceCount: 1,
        vectorSearch: expect.objectContaining({
          status: 'ready',
          resultCount: 1,
          results: [
            expect.objectContaining({
              objectId: 'weaviate-object-001',
              sourceDocumentId: 'source-001',
            }),
          ],
        }),
        ranking: expect.objectContaining({
          status: 'ready',
          reviewedCount: 1,
          results: expect.arrayContaining([
            expect.objectContaining({
              layer: 'Weaviate hybrid',
              objectId: 'weaviate-object-001',
              sourceDocumentId: 'source-001',
              evidenceState: 'reviewed-vector',
              canUseInAnswer: true,
              confidence: 'reviewed-live-vector',
            }),
          ]),
        }),
        answerDraft: expect.objectContaining({
          status: 'ready',
          trustLevel: 'reviewed-vector-backed',
          synthesis: expect.objectContaining({
            status: 'ready',
            mode: 'reviewed-citation-constrained',
            usedCitationIds: expect.arrayContaining(['weaviate-object-001']),
            citationCoverage: expect.objectContaining({
              reviewedCitationCount: 1,
              citedSectionCount: 2,
            }),
            coverageChecks: expect.arrayContaining([
              expect.objectContaining({
                id: 'reviewed-citations',
                status: 'pass',
              }),
              expect.objectContaining({
                id: 'section-citation-coverage',
                status: 'pass',
              }),
            ]),
            sections: expect.arrayContaining([
              expect.objectContaining({
                reviewState: 'synthesized-from-reviewed-citations',
                citationIds: expect.arrayContaining(['weaviate-object-001']),
              }),
            ]),
            modelSynthesisPacket: expect.objectContaining({
              status: 'ready',
              mode: 'reviewed-citation-model-packet',
              modelCallStatus: 'not-started',
              allowedCitationIds: expect.arrayContaining(['weaviate-object-001']),
              excludedCandidateCitationIds: expect.arrayContaining(['embedding:source-001:1']),
              citationContext: [
                expect.objectContaining({
                  id: 'weaviate-object-001',
                  sourceDocumentId: 'source-001',
                }),
              ],
              promptMessages: expect.arrayContaining([
                expect.objectContaining({ role: 'system' }),
                expect.objectContaining({ role: 'user' }),
              ]),
              outputContract: expect.objectContaining({
                format: 'wiki-sections-with-citationIds',
              }),
            }),
          }),
          promotionPreview: expect.objectContaining({
            status: 'ready-to-promote',
            publishMode: 'preview-only',
            citationCoverageDiff: expect.objectContaining({
              status: 'pass',
              mode: 'promotion-citation-coverage-diff',
              reviewedCitationCount: 1,
              promotableSectionCount: 2,
              blockedSectionCount: 0,
              sectionDiffs: expect.arrayContaining([
                expect.objectContaining({
                  heading: 'Lead',
                  status: 'promotable',
                  willPublish: true,
                  reviewedCitationIds: expect.arrayContaining(['weaviate-object-001']),
                }),
              ]),
            }),
            citationLedger: [
              expect.objectContaining({
                sourceDocumentId: 'source-001',
                objectId: 'weaviate-object-001',
              }),
            ],
          }),
          citations: [
            expect.objectContaining({
              objectId: 'weaviate-object-001',
              sourceDocumentId: 'source-001',
              evidenceState: 'reviewed-vector',
            }),
          ],
        }),
      }),
    );
    expect(response.body.retrieval.summary.layers).toContain('Weaviate hybrid search');
    expect(response.body.retrieval.answerDraft.lead).toContain('Based on reviewed Case Wiki evidence');
  });

  it('blocks model draft preparation when the packet is candidate-only', async () => {
    const response = await request(app)
      .post('/api/case-management/wiki/retrieval/model-drafts')
      .send({
        confirmModelDraft: true,
        query: 'systems innovation',
        modelSynthesisPacket: {
          status: 'blocked',
          mode: 'reviewed-citation-model-packet',
          blockedReason: 'Model-backed prose is blocked until reviewed citation context and cited sections are available.',
          allowedCitationIds: [],
          excludedCandidateCitationIds: ['embedding:source-001:1'],
          citationContext: [],
          sectionPlan: [],
        },
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: 'Model draft is blocked until the packet is ready.',
        blockedReasons: [
          'Model-backed prose is blocked until reviewed citation context and cited sections are available.',
        ],
      }),
    );
    expect(mockSaveCaseManagementWorkspace).not.toHaveBeenCalled();
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('stores a reviewed citation model draft without calling a model or writing graph vectors', async () => {
    const response = await request(app)
      .post('/api/case-management/wiki/retrieval/model-drafts')
      .send({
        confirmModelDraft: true,
        actor: 'Joel Zola',
        query: 'systems innovation',
        answerDraft: {
          title: 'Draft article: systems innovation',
          synthesis: {
            status: 'ready',
            usedCitationIds: ['weaviate-object-001'],
          },
          candidateCitations: [
            {
              id: 'embedding:source-001:1',
              sourceTitle: 'Systems Innovation Partner List',
              evidenceState: 'candidate',
            },
          ],
        },
        modelSynthesisPacket: {
          status: 'ready',
          mode: 'reviewed-citation-model-packet',
          modelCallStatus: 'not-started',
          allowedCitationIds: ['weaviate-object-001'],
          excludedCandidateCitationIds: ['embedding:source-001:1'],
          excludedGraphContextTitles: ['Partners graph clue'],
          guardrails: ['Use only reviewed citation context listed in this packet.'],
          citationContext: [
            {
              marker: '[1]',
              id: 'weaviate-object-001',
              sourceTitle: 'Systems Innovation Partner List',
              sourceDocumentId: 'source-001',
              objectId: 'weaviate-object-001',
              evidenceState: 'reviewed-vector',
              textPreview: 'Systems innovation partner list and follow-up notes.',
            },
          ],
          sectionPlan: [
            {
              heading: 'Lead',
              requiredCitationIds: ['weaviate-object-001'],
            },
          ],
          promptMessages: [
            { role: 'system', content: 'Use reviewed citations only.' },
            { role: 'user', content: 'Draft with citation ids.' },
          ],
          outputContract: {
            format: 'wiki-sections-with-citationIds',
            requiredChecks: ['all-section-citation-ids-are-reviewed'],
          },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.modelDraftRecord).toEqual(
      expect.objectContaining({
        pageId: 'model-draft:systems-innovation',
        title: 'Model draft: systems innovation',
        status: 'draft-ready-for-review',
        mode: 'disabled-model-call-reviewed-citations',
        modelCallStatus: 'disabled',
        externalModelCallMade: false,
        requiresHumanPromotionConfirmation: true,
        allowedCitationIds: ['weaviate-object-001'],
        excludedCandidateCitationIds: ['embedding:source-001:1'],
        citationCoverageDiff: expect.objectContaining({
          status: 'pass',
          reviewedCitationCount: 1,
          promotableSectionCount: 1,
        }),
        sections: [
          expect.objectContaining({
            heading: 'Lead',
            citationIds: ['weaviate-object-001'],
            reviewState: 'model-draft-section',
          }),
        ],
        citationLedger: [
          expect.objectContaining({
            id: 'weaviate-object-001',
            sourceDocumentId: 'source-001',
          }),
        ],
      }),
    );
    expect(response.body.policy).toContain('did not call a model');
    expect(mockSaveCaseManagementWorkspace).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        wikiModelDraftRecords: [
          expect.objectContaining({
            id: expect.stringContaining('model-draft:systems-innovation:'),
            externalModelCallMade: false,
          }),
        ],
        auditRecords: [
          expect.objectContaining({
            action: 'prepared reviewed model draft packet',
            object: 'Model draft: systems innovation',
          }),
        ],
      }),
    );
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('blocks external model draft adapter modes without saving or writing graph data', async () => {
    const response = await request(app)
      .post('/api/case-management/wiki/retrieval/model-drafts/model-draft%3Asystems-innovation/executions')
      .send({
        confirmModelDraftExecution: true,
        adapterMode: 'external-openai',
        actor: 'Joel Zola',
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: 'External model execution is disabled for this adapter.',
        policy: expect.stringContaining('External model calls require'),
      }),
    );
    expect(mockSaveCaseManagementWorkspace).not.toHaveBeenCalled();
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('stores a local model draft adapter rehearsal without calling a model or graph writes', async () => {
    const savedModelDraft = {
      id: 'model-draft:systems-innovation:abc123',
      pageId: 'model-draft:systems-innovation',
      title: 'Model draft: systems innovation',
      query: 'systems innovation',
      status: 'draft-ready-for-review',
      modelCallStatus: 'disabled',
      externalModelCallMade: false,
      sections: [
        {
          id: 'section-lead',
          heading: 'Lead',
          text: 'Ready for model-assisted drafting from reviewed citation ids weaviate-object-001.',
          citationIds: ['weaviate-object-001'],
          reviewState: 'model-draft-section',
        },
      ],
      citationLedger: [
        {
          marker: '[1]',
          id: 'weaviate-object-001',
          sourceTitle: 'Systems Innovation Partner List',
          sourceDocumentId: 'source-001',
          pageId: 'ingest:source-001',
          objectId: 'weaviate-object-001',
          evidenceState: 'reviewed-vector',
          textPreview: 'Systems innovation partner list and follow-up notes.',
        },
      ],
      allowedCitationIds: ['weaviate-object-001'],
      excludedCandidateCitationIds: ['embedding:source-001:1'],
      citationCoverageDiff: { status: 'pass' },
      requiresHumanPromotionConfirmation: true,
    };
    mockGetCaseManagementWorkspace.mockResolvedValueOnce({
      version: 1,
      savedAt: '2026-05-01T11:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-01T11:00:00.000Z',
        caseRecords: [],
        taskRecords: [],
        noteRecords: [],
        timelineRecords: [],
        auditRecords: [],
        wikiModelDraftRecords: [savedModelDraft],
        wikiModelDraftExecutionRecords: [],
      },
    });

    const response = await request(app)
      .post('/api/case-management/wiki/retrieval/model-drafts/model-draft%3Asystems-innovation%3Aabc123/executions')
      .send({
        confirmModelDraftExecution: true,
        adapterMode: 'local-citation-contract-rehearsal',
        actor: 'Joel Zola',
      });

    expect(response.status).toBe(200);
    expect(response.body.modelDraftExecutionRecord).toEqual(
      expect.objectContaining({
        modelDraftId: 'model-draft:systems-innovation:abc123',
        status: 'passed-local-contract',
        adapterMode: 'local-citation-contract-rehearsal',
        modelCallStatus: 'local-rehearsal-only',
        externalModelCallMade: false,
        requiresHumanPromotionConfirmation: true,
        allowedCitationIds: ['weaviate-object-001'],
        excludedCandidateCitationIds: ['embedding:source-001:1'],
        citationCoverageDiff: expect.objectContaining({
          status: 'pass',
          reviewedCitationCount: 1,
          promotableSectionCount: 1,
        }),
        sections: [
          expect.objectContaining({
            heading: 'Lead',
            citationIds: ['weaviate-object-001'],
            reviewState: 'model-adapter-local-output',
          }),
        ],
      }),
    );
    expect(response.body.modelDraftRecord).toEqual(
      expect.objectContaining({
        id: savedModelDraft.id,
        lastExecutionStatus: 'passed-local-contract',
        executionCount: 1,
      }),
    );
    expect(response.body.policy).toContain('did not call a model');
    expect(mockSaveCaseManagementWorkspace).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        wikiModelDraftRecords: [
          expect.objectContaining({
            id: savedModelDraft.id,
            lastExecutionStatus: 'passed-local-contract',
            executionCount: 1,
          }),
        ],
        wikiModelDraftExecutionRecords: [
          expect.objectContaining({
            modelDraftId: savedModelDraft.id,
            externalModelCallMade: false,
          }),
        ],
        auditRecords: [
          expect.objectContaining({
            action: 'ran local model draft adapter rehearsal',
            object: 'Model draft: systems innovation',
          }),
        ],
      }),
    );
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('keeps external model adapter readiness blocked until local rehearsal passes', async () => {
    const savedModelDraft = {
      id: 'model-draft:systems-innovation:abc123',
      pageId: 'model-draft:systems-innovation',
      title: 'Model draft: systems innovation',
      query: 'systems innovation',
      sections: [
        {
          heading: 'Lead',
          text: 'Ready for model-assisted drafting from reviewed citation ids weaviate-object-001.',
          citationIds: ['weaviate-object-001'],
        },
      ],
      citationLedger: [
        {
          id: 'weaviate-object-001',
          sourceTitle: 'Systems Innovation Partner List',
          sourceDocumentId: 'source-001',
          objectId: 'weaviate-object-001',
          evidenceState: 'reviewed-vector',
          textPreview: 'Systems innovation partner list and follow-up notes.',
        },
      ],
      allowedCitationIds: ['weaviate-object-001'],
    };
    mockGetCaseManagementWorkspace.mockResolvedValueOnce({
      version: 1,
      savedAt: '2026-05-01T11:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-01T11:00:00.000Z',
        wikiModelDraftRecords: [savedModelDraft],
        wikiModelDraftExecutionRecords: [],
      },
    });

    const response = await request(app)
      .get('/api/case-management/wiki/retrieval/model-drafts/model-draft%3Asystems-innovation%3Aabc123/external-adapter/readiness')
      .query({ provider: 'openai', model: 'gpt-5.2' });

    expect(response.status).toBe(200);
    expect(response.body.readiness).toEqual(
      expect.objectContaining({
        modelDraftId: savedModelDraft.id,
        status: 'blocked-before-consent',
        mode: 'external-model-adapter-readiness-preview',
        externalModelCallEnabled: false,
        externalModelCallMade: false,
        sourceTextTransmitted: false,
        localExecutionStatus: 'missing',
        requiresActionTimeConsent: true,
        blockers: expect.arrayContaining(['Run and save the local citation-contract rehearsal first.']),
      }),
    );
    expect(response.body.readiness.wouldTransmit).toEqual(
      expect.objectContaining({
        fullSourceFiles: false,
        candidateEvidence: false,
        reviewedCitationCount: 1,
      }),
    );
    expect(mockSaveCaseManagementWorkspace).not.toHaveBeenCalled();
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('previews external model adapter readiness after local rehearsal without transmitting source text', async () => {
    const savedModelDraft = {
      id: 'model-draft:systems-innovation:abc123',
      pageId: 'model-draft:systems-innovation',
      title: 'Model draft: systems innovation',
      query: 'systems innovation',
      promptMessages: [{ role: 'system', content: 'Use reviewed citations only.' }],
      sections: [
        {
          heading: 'Lead',
          text: 'Ready for model-assisted drafting from reviewed citation ids weaviate-object-001.',
          citationIds: ['weaviate-object-001'],
        },
      ],
      citationLedger: [
        {
          id: 'weaviate-object-001',
          sourceTitle: 'Systems Innovation Partner List',
          sourceDocumentId: 'source-001',
          objectId: 'weaviate-object-001',
          evidenceState: 'reviewed-vector',
          textPreview: 'Systems innovation partner list and follow-up notes.',
        },
      ],
      allowedCitationIds: ['weaviate-object-001'],
      excludedCandidateCitationIds: ['embedding:source-001:1'],
    };
    mockGetCaseManagementWorkspace.mockResolvedValueOnce({
      version: 1,
      savedAt: '2026-05-01T11:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-01T11:00:00.000Z',
        wikiModelDraftRecords: [savedModelDraft],
        wikiModelDraftExecutionRecords: [
          {
            id: 'model-execution:systems-innovation:abc123',
            modelDraftId: savedModelDraft.id,
            adapterMode: 'local-citation-contract-rehearsal',
            status: 'passed-local-contract',
            externalModelCallMade: false,
            createdAt: '2026-05-02T12:00:00.000Z',
          },
        ],
      },
    });

    const response = await request(app)
      .get('/api/case-management/wiki/retrieval/model-drafts/model-draft%3Asystems-innovation%3Aabc123/external-adapter/readiness')
      .query({ provider: 'openai', model: 'gpt-5.2' });

    expect(response.status).toBe(200);
    expect(response.body.readiness).toEqual(
      expect.objectContaining({
        modelDraftId: savedModelDraft.id,
        status: 'ready-for-action-time-consent',
        provider: 'openai',
        model: 'gpt-5.2',
        providerConfigStatus: 'target-selected-secret-not-configured',
        externalModelCallEnabled: false,
        externalModelCallMade: false,
        sourceTextTransmitted: false,
        vectorWriteMade: false,
        graphWriteMade: false,
        promotionMade: false,
        localExecutionStatus: 'passed-local-contract',
        localExecutionId: 'model-execution:systems-innovation:abc123',
        requiresActionTimeConsent: true,
        requiresSecretConfiguration: true,
        blockers: [],
      }),
    );
    expect(response.body.readiness.wouldTransmit).toEqual(
      expect.objectContaining({
        fullSourceFiles: false,
        candidateEvidence: false,
        graphOnlyContext: false,
        unrelatedWorkspaceData: false,
        sectionCount: 1,
        reviewedCitationCount: 1,
        allowedCitationCount: 1,
        promptMessageCount: 1,
      }),
    );
    expect(response.body.policy).toContain('did not call a model');
    expect(mockSaveCaseManagementWorkspace).not.toHaveBeenCalled();
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('keeps external adapter readiness blocked until a provider and model target are selected', async () => {
    const savedModelDraft = {
      id: 'model-draft:systems-innovation:abc123',
      pageId: 'model-draft:systems-innovation',
      title: 'Model draft: systems innovation',
      query: 'systems innovation',
      sections: [
        {
          heading: 'Lead',
          text: 'Ready for model-assisted drafting from reviewed citation ids weaviate-object-001.',
          citationIds: ['weaviate-object-001'],
        },
      ],
      citationLedger: [
        {
          id: 'weaviate-object-001',
          sourceTitle: 'Systems Innovation Partner List',
          sourceDocumentId: 'source-001',
          objectId: 'weaviate-object-001',
          evidenceState: 'reviewed-vector',
          textPreview: 'Systems innovation partner list and follow-up notes.',
        },
      ],
      allowedCitationIds: ['weaviate-object-001'],
    };
    mockGetCaseManagementWorkspace.mockResolvedValueOnce({
      version: 1,
      savedAt: '2026-05-01T11:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-01T11:00:00.000Z',
        wikiModelDraftRecords: [savedModelDraft],
        wikiModelDraftExecutionRecords: [
          {
            id: 'model-execution:systems-innovation:abc123',
            modelDraftId: savedModelDraft.id,
            adapterMode: 'local-citation-contract-rehearsal',
            status: 'passed-local-contract',
            externalModelCallMade: false,
            createdAt: '2026-05-02T12:00:00.000Z',
          },
        ],
      },
    });

    const response = await request(app)
      .get('/api/case-management/wiki/retrieval/model-drafts/model-draft%3Asystems-innovation%3Aabc123/external-adapter/readiness');

    expect(response.status).toBe(200);
    expect(response.body.readiness).toEqual(
      expect.objectContaining({
        modelDraftId: savedModelDraft.id,
        status: 'blocked-before-consent',
        provider: 'not-selected',
        model: 'not-selected',
        providerConfigStatus: 'target-selection-required',
        localExecutionStatus: 'passed-local-contract',
        externalModelCallMade: false,
        sourceTextTransmitted: false,
        blockers: expect.arrayContaining([
          'Choose an external adapter provider before consent can be prepared.',
          'Name the model or endpoint label before consent can be prepared.',
        ]),
      }),
    );
    expect(mockSaveCaseManagementWorkspace).not.toHaveBeenCalled();
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('blocks external adapter consent packets until local rehearsal passes', async () => {
    const savedModelDraft = {
      id: 'model-draft:systems-innovation:abc123',
      pageId: 'model-draft:systems-innovation',
      title: 'Model draft: systems innovation',
      query: 'systems innovation',
      sections: [
        {
          heading: 'Lead',
          text: 'Ready for model-assisted drafting from reviewed citation ids weaviate-object-001.',
          citationIds: ['weaviate-object-001'],
        },
      ],
      citationLedger: [
        {
          id: 'weaviate-object-001',
          sourceTitle: 'Systems Innovation Partner List',
          sourceDocumentId: 'source-001',
          objectId: 'weaviate-object-001',
          evidenceState: 'reviewed-vector',
          textPreview: 'Systems innovation partner list and follow-up notes.',
        },
      ],
      allowedCitationIds: ['weaviate-object-001'],
    };
    mockGetCaseManagementWorkspace.mockResolvedValueOnce({
      version: 1,
      savedAt: '2026-05-01T11:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-01T11:00:00.000Z',
        wikiModelDraftRecords: [savedModelDraft],
        wikiModelDraftExecutionRecords: [],
      },
    });

    const response = await request(app)
      .post('/api/case-management/wiki/retrieval/model-drafts/model-draft%3Asystems-innovation%3Aabc123/external-adapter/consent-packets')
      .send({
        confirmConsentPacket: true,
        provider: 'openai',
        model: 'gpt-5.2',
        actor: 'Joel Zola',
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: 'External adapter consent packet is blocked until readiness passes.',
        blockedReasons: expect.arrayContaining(['Run and save the local citation-contract rehearsal first.']),
        policy: expect.stringContaining('No model call or source transmission happened'),
      }),
    );
    expect(response.body.readiness).toEqual(
      expect.objectContaining({
        status: 'blocked-before-consent',
        externalModelCallMade: false,
        sourceTextTransmitted: false,
      }),
    );
    expect(mockSaveCaseManagementWorkspace).not.toHaveBeenCalled();
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('blocks external adapter consent packets until provider and model target are selected', async () => {
    const savedModelDraft = {
      id: 'model-draft:systems-innovation:abc123',
      pageId: 'model-draft:systems-innovation',
      title: 'Model draft: systems innovation',
      query: 'systems innovation',
      sections: [
        {
          heading: 'Lead',
          text: 'Ready for model-assisted drafting from reviewed citation ids weaviate-object-001.',
          citationIds: ['weaviate-object-001'],
        },
      ],
      citationLedger: [
        {
          id: 'weaviate-object-001',
          sourceTitle: 'Systems Innovation Partner List',
          sourceDocumentId: 'source-001',
          objectId: 'weaviate-object-001',
          evidenceState: 'reviewed-vector',
          textPreview: 'Systems innovation partner list and follow-up notes.',
        },
      ],
      allowedCitationIds: ['weaviate-object-001'],
    };
    mockGetCaseManagementWorkspace.mockResolvedValueOnce({
      version: 1,
      savedAt: '2026-05-01T11:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-01T11:00:00.000Z',
        wikiModelDraftRecords: [savedModelDraft],
        wikiModelDraftExecutionRecords: [
          {
            id: 'model-execution:systems-innovation:abc123',
            modelDraftId: savedModelDraft.id,
            adapterMode: 'local-citation-contract-rehearsal',
            status: 'passed-local-contract',
            externalModelCallMade: false,
            createdAt: '2026-05-02T12:00:00.000Z',
          },
        ],
      },
    });

    const response = await request(app)
      .post('/api/case-management/wiki/retrieval/model-drafts/model-draft%3Asystems-innovation%3Aabc123/external-adapter/consent-packets')
      .send({
        confirmConsentPacket: true,
        actor: 'Joel Zola',
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: 'External adapter consent packet is blocked until readiness passes.',
        blockedReasons: expect.arrayContaining([
          'Choose an external adapter provider before consent can be prepared.',
          'Name the model or endpoint label before consent can be prepared.',
        ]),
        policy: expect.stringContaining('No model call or source transmission happened'),
      }),
    );
    expect(response.body.readiness).toEqual(
      expect.objectContaining({
        status: 'blocked-before-consent',
        provider: 'not-selected',
        model: 'not-selected',
        providerConfigStatus: 'target-selection-required',
        externalModelCallMade: false,
        sourceTextTransmitted: false,
      }),
    );
    expect(mockSaveCaseManagementWorkspace).not.toHaveBeenCalled();
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('stores an external adapter consent packet after local rehearsal without transmitting source text', async () => {
    const savedModelDraft = {
      id: 'model-draft:systems-innovation:abc123',
      pageId: 'model-draft:systems-innovation',
      title: 'Model draft: systems innovation',
      query: 'systems innovation',
      sections: [
        {
          heading: 'Lead',
          text: 'Ready for model-assisted drafting from reviewed citation ids weaviate-object-001.',
          citationIds: ['weaviate-object-001'],
        },
      ],
      citationLedger: [
        {
          id: 'weaviate-object-001',
          sourceTitle: 'Systems Innovation Partner List',
          sourceDocumentId: 'source-001',
          pageId: 'ingest:source-001',
          objectId: 'weaviate-object-001',
          evidenceState: 'reviewed-vector',
          textPreview: 'Systems innovation partner list and follow-up notes.',
        },
      ],
      allowedCitationIds: ['weaviate-object-001'],
      excludedCandidateCitationIds: ['embedding:source-001:1'],
    };
    mockGetCaseManagementWorkspace.mockResolvedValueOnce({
      version: 1,
      savedAt: '2026-05-01T11:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-01T11:00:00.000Z',
        auditRecords: [],
        wikiModelDraftRecords: [savedModelDraft],
        wikiModelDraftExecutionRecords: [
          {
            id: 'model-execution:systems-innovation:abc123',
            modelDraftId: savedModelDraft.id,
            adapterMode: 'local-citation-contract-rehearsal',
            status: 'passed-local-contract',
            externalModelCallMade: false,
            createdAt: '2026-05-02T12:00:00.000Z',
          },
        ],
      },
    });

    const response = await request(app)
      .post('/api/case-management/wiki/retrieval/model-drafts/model-draft%3Asystems-innovation%3Aabc123/external-adapter/consent-packets')
      .send({
        confirmConsentPacket: true,
        provider: 'openai',
        model: 'gpt-5.2',
        actor: 'Joel Zola',
      });

    expect(response.status).toBe(200);
    expect(response.body.externalConsentPacketRecord).toEqual(
      expect.objectContaining({
        modelDraftId: savedModelDraft.id,
        status: 'pending-action-time-consent',
        mode: 'external-model-adapter-consent-packet',
        provider: 'openai',
        model: 'gpt-5.2',
        externalModelCallEnabled: false,
        externalModelCallMade: false,
        sourceTextTransmitted: false,
        vectorWriteMade: false,
        graphWriteMade: false,
        promotionMade: false,
        humanConsentStatus: 'not-requested',
        requiresActionTimeConsent: true,
        requiresSecretConfiguration: true,
        requiresHumanPromotionConfirmation: true,
      }),
    );
    expect(response.body.externalConsentPacketRecord.wouldTransmit).toEqual(
      expect.objectContaining({
        fullSourceFiles: false,
        candidateEvidence: false,
        graphOnlyContext: false,
        unrelatedWorkspaceData: false,
        reviewedCitationCount: 1,
      }),
    );
    expect(response.body.externalConsentPacketRecord.transmissionPreview).toEqual(
      expect.objectContaining({
        reviewedCitationCount: 1,
        fullSourceFiles: false,
        candidateEvidence: false,
        reviewedCitationExcerptCandidates: [
          expect.objectContaining({
            id: 'weaviate-object-001',
            sourceTitle: 'Systems Innovation Partner List',
            textPreview: 'Systems innovation partner list and follow-up notes.',
          }),
        ],
      }),
    );
    expect(response.body.modelDraftRecord).toEqual(
      expect.objectContaining({
        id: savedModelDraft.id,
        lastExternalConsentPacketStatus: 'pending-action-time-consent',
        externalConsentPacketCount: 1,
      }),
    );
    expect(response.body.policy).toContain('did not call a model');
    expect(mockSaveCaseManagementWorkspace).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        wikiModelDraftRecords: [
          expect.objectContaining({
            id: savedModelDraft.id,
            lastExternalConsentPacketStatus: 'pending-action-time-consent',
            externalConsentPacketCount: 1,
          }),
        ],
        wikiModelDraftExternalConsentRecords: [
          expect.objectContaining({
            modelDraftId: savedModelDraft.id,
            sourceTextTransmitted: false,
            externalModelCallMade: false,
          }),
        ],
        auditRecords: [
          expect.objectContaining({
            action: 'prepared external adapter consent packet',
            object: 'Model draft: systems innovation',
            status: 'pending-consent',
          }),
        ],
      }),
    );
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('blocks external adapter request rehearsals until a consent packet exists', async () => {
    const savedModelDraft = {
      id: 'model-draft:systems-innovation:abc123',
      pageId: 'model-draft:systems-innovation',
      title: 'Model draft: systems innovation',
      query: 'systems innovation',
      sections: [
        {
          heading: 'Lead',
          text: 'Ready for model-assisted drafting from reviewed citation ids weaviate-object-001.',
          citationIds: ['weaviate-object-001'],
        },
      ],
      citationLedger: [
        {
          id: 'weaviate-object-001',
          sourceTitle: 'Systems Innovation Partner List',
          sourceDocumentId: 'source-001',
          objectId: 'weaviate-object-001',
          evidenceState: 'reviewed-vector',
          textPreview: 'Systems innovation partner list and follow-up notes.',
        },
      ],
      allowedCitationIds: ['weaviate-object-001'],
    };
    mockGetCaseManagementWorkspace.mockResolvedValueOnce({
      version: 1,
      savedAt: '2026-05-01T11:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-01T11:00:00.000Z',
        wikiModelDraftRecords: [savedModelDraft],
        wikiModelDraftExternalConsentRecords: [],
      },
    });

    const response = await request(app)
      .post('/api/case-management/wiki/retrieval/model-drafts/model-draft%3Asystems-innovation%3Aabc123/external-adapter/request-rehearsals')
      .send({
        confirmRequestRehearsal: true,
        actor: 'Joel Zola',
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: 'External adapter request rehearsal needs a saved consent packet.',
        blockedReasons: expect.arrayContaining([
          'Prepare and save a consent packet before rehearsing the external adapter request.',
        ]),
        policy: expect.stringContaining('No model call or source transmission happened'),
      }),
    );
    expect(mockSaveCaseManagementWorkspace).not.toHaveBeenCalled();
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('stores an external adapter request rehearsal without model calls or source transmission', async () => {
    const savedModelDraft = {
      id: 'model-draft:systems-innovation:abc123',
      pageId: 'model-draft:systems-innovation',
      title: 'Model draft: systems innovation',
      query: 'systems innovation',
      outputContract: {
        format: 'wiki sections with reviewed citation ids',
        requiredChecks: ['citation coverage pass'],
      },
      sections: [
        {
          heading: 'Lead',
          text: 'Ready for model-assisted drafting from reviewed citation ids weaviate-object-001.',
          citationIds: ['weaviate-object-001'],
        },
      ],
      citationLedger: [
        {
          id: 'weaviate-object-001',
          sourceTitle: 'Systems Innovation Partner List',
          sourceDocumentId: 'source-001',
          pageId: 'ingest:source-001',
          objectId: 'weaviate-object-001',
          evidenceState: 'reviewed-vector',
          textPreview: 'Systems innovation partner list and follow-up notes.',
        },
      ],
      allowedCitationIds: ['weaviate-object-001'],
    };
    const consentPacket = {
      id: 'adapter-consent:model-draft-systems-innovation-abc123:abc123',
      modelDraftId: savedModelDraft.id,
      title: 'External adapter consent packet: systems innovation',
      status: 'pending-action-time-consent',
      provider: 'openai',
      model: 'gpt-5.2',
      transmissionFingerprint: 'fingerprint-abc123',
      transmissionPreview: {
        draftTitle: savedModelDraft.title,
        sectionPlan: [
          {
            heading: 'Lead',
            citationIds: ['weaviate-object-001'],
            reviewState: 'model-draft-section',
          },
        ],
        reviewedCitationExcerptCandidates: [
          {
            id: 'weaviate-object-001',
            sourceTitle: 'Systems Innovation Partner List',
            sourceDocumentId: 'source-001',
            pageId: 'ingest:source-001',
            objectId: 'weaviate-object-001',
            evidenceState: 'reviewed-vector',
            textPreview: 'Systems innovation partner list and follow-up notes.',
            textPreviewLength: 53,
          },
        ],
        reviewedCitationCount: 1,
        fullSourceFiles: false,
        candidateEvidence: false,
      },
    };
    mockGetCaseManagementWorkspace.mockResolvedValueOnce({
      version: 1,
      savedAt: '2026-05-01T11:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-01T11:00:00.000Z',
        auditRecords: [],
        wikiModelDraftRecords: [savedModelDraft],
        wikiModelDraftExternalConsentRecords: [consentPacket],
        wikiModelDraftExternalRequestRehearsalRecords: [],
      },
    });

    const response = await request(app)
      .post('/api/case-management/wiki/retrieval/model-drafts/model-draft%3Asystems-innovation%3Aabc123/external-adapter/request-rehearsals')
      .send({
        confirmRequestRehearsal: true,
        consentPacketId: consentPacket.id,
        actor: 'Joel Zola',
      });

    expect(response.status).toBe(200);
    expect(response.body.requestRehearsalRecord).toEqual(
      expect.objectContaining({
        modelDraftId: savedModelDraft.id,
        consentPacketId: consentPacket.id,
        status: 'blocked-before-transmission',
        mode: 'external-model-adapter-request-rehearsal',
        provider: 'openai',
        model: 'gpt-5.2',
        externalModelCallEnabled: false,
        externalModelCallMade: false,
        sourceTextPreparedForTransmission: true,
        sourceTextTransmitted: false,
        vectorWriteMade: false,
        graphWriteMade: false,
        promotionMade: false,
        requiresActionTimeConsent: true,
        requiresSecretConfiguration: true,
        requiresReturnedCitationValidation: true,
        blockers: expect.arrayContaining([
          'Action-time source transmission consent has not been granted.',
          'External provider secret/config is not enabled.',
        ]),
      }),
    );
    expect(response.body.requestRehearsalRecord.requestEnvelope).toEqual(
      expect.objectContaining({
        provider: 'openai',
        model: 'gpt-5.2',
        consentPacketId: consentPacket.id,
        reviewedCitationExcerptCandidates: [
          expect.objectContaining({
            id: 'weaviate-object-001',
            textPreview: 'Systems innovation partner list and follow-up notes.',
          }),
        ],
      }),
    );
    expect(response.body.modelDraftRecord).toEqual(
      expect.objectContaining({
        id: savedModelDraft.id,
        lastExternalRequestRehearsalStatus: 'blocked-before-transmission',
        externalRequestRehearsalCount: 1,
      }),
    );
    expect(response.body.policy).toContain('did not call a model');
    expect(mockSaveCaseManagementWorkspace).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        wikiModelDraftRecords: [
          expect.objectContaining({
            id: savedModelDraft.id,
            lastExternalRequestRehearsalStatus: 'blocked-before-transmission',
            externalRequestRehearsalCount: 1,
          }),
        ],
        wikiModelDraftExternalRequestRehearsalRecords: [
          expect.objectContaining({
            modelDraftId: savedModelDraft.id,
            sourceTextTransmitted: false,
            externalModelCallMade: false,
          }),
        ],
        auditRecords: [
          expect.objectContaining({
            action: 'rehearsed external adapter request',
            object: 'Model draft: systems innovation',
            status: 'blocked-before-transmission',
          }),
        ],
      }),
    );
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('stores a local output citation validation for a request rehearsal without model calls', async () => {
    const savedModelDraft = {
      id: 'model-draft:systems-innovation:abc123',
      pageId: 'model-draft:systems-innovation',
      title: 'Model draft: systems innovation',
      query: 'systems innovation',
      outputContract: {
        format: 'wiki sections with reviewed citation ids',
        requiredChecks: ['citation coverage pass'],
      },
    };
    const requestRehearsal = {
      id: 'adapter-request-rehearsal:model-draft-systems-innovation-abc123:abc123',
      modelDraftId: savedModelDraft.id,
      consentPacketId: 'adapter-consent:model-draft-systems-innovation-abc123:abc123',
      title: 'External adapter request rehearsal: systems innovation',
      status: 'blocked-before-transmission',
      provider: 'openai',
      model: 'gpt-5.2',
      requestEnvelope: {
        provider: 'openai',
        model: 'gpt-5.2',
        draftTitle: savedModelDraft.title,
        modelDraftId: savedModelDraft.id,
        consentPacketId: 'adapter-consent:model-draft-systems-innovation-abc123:abc123',
        transmissionFingerprint: 'fingerprint-abc123',
        sectionPlan: [
          {
            heading: 'Lead',
            citationIds: ['weaviate-object-001'],
            reviewState: 'model-draft-section',
          },
        ],
        reviewedCitationExcerptCandidates: [
          {
            id: 'weaviate-object-001',
            sourceTitle: 'Systems Innovation Partner List',
            sourceDocumentId: 'source-001',
            pageId: 'ingest:source-001',
            objectId: 'weaviate-object-001',
            evidenceState: 'reviewed-vector',
            textPreview: 'Systems innovation partner list and follow-up notes.',
            textPreviewLength: 53,
          },
        ],
      },
    };
    mockGetCaseManagementWorkspace.mockResolvedValueOnce({
      version: 1,
      savedAt: '2026-05-01T11:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-01T11:00:00.000Z',
        auditRecords: [],
        wikiModelDraftRecords: [savedModelDraft],
        wikiModelDraftExternalRequestRehearsalRecords: [requestRehearsal],
        wikiModelDraftExternalOutputValidationRecords: [],
      },
    });

    const response = await request(app)
      .post(
        '/api/case-management/wiki/retrieval/model-drafts/model-draft%3Asystems-innovation%3Aabc123/external-adapter/request-rehearsals/adapter-request-rehearsal%3Amodel-draft-systems-innovation-abc123%3Aabc123/output-validations',
      )
      .send({
        confirmOutputValidation: true,
        validationMode: 'local-sample-output',
        actor: 'Joel Zola',
      });

    expect(response.status).toBe(200);
    expect(response.body.outputValidationRecord).toEqual(
      expect.objectContaining({
        modelDraftId: savedModelDraft.id,
        requestRehearsalId: requestRehearsal.id,
        status: 'passed-output-citation-contract',
        mode: 'external-model-adapter-output-validation',
        validationMode: 'local-sample-output',
        provider: 'openai',
        model: 'gpt-5.2',
        externalModelCallMade: false,
        outputReceivedFromExternalModel: false,
        sourceTextTransmitted: false,
        vectorWriteMade: false,
        graphWriteMade: false,
        promotionMade: false,
        requiresHumanPromotionConfirmation: true,
        allowedCitationIds: ['weaviate-object-001'],
        returnedCitationIds: ['weaviate-object-001'],
        unknownCitationIds: [],
        missingSectionCitationHeadings: [],
      }),
    );
    expect(response.body.requestRehearsalRecord).toEqual(
      expect.objectContaining({
        id: requestRehearsal.id,
        lastOutputValidationStatus: 'passed-output-citation-contract',
        outputValidationCount: 1,
      }),
    );
    expect(response.body.modelDraftRecord).toEqual(
      expect.objectContaining({
        id: savedModelDraft.id,
        lastExternalOutputValidationStatus: 'passed-output-citation-contract',
        externalOutputValidationCount: 1,
      }),
    );
    expect(response.body.policy).toContain('did not call a model');
    expect(mockSaveCaseManagementWorkspace).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        wikiModelDraftExternalOutputValidationRecords: [
          expect.objectContaining({
            modelDraftId: savedModelDraft.id,
            sourceTextTransmitted: false,
            externalModelCallMade: false,
          }),
        ],
        auditRecords: [
          expect.objectContaining({
            action: 'validated external adapter output citations',
            object: 'Model draft: systems innovation',
            status: 'passed-output-citation-contract',
          }),
        ],
      }),
    );
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('blocks output validation when returned citations are outside the consent packet', async () => {
    const savedModelDraft = {
      id: 'model-draft:systems-innovation:abc123',
      pageId: 'model-draft:systems-innovation',
      title: 'Model draft: systems innovation',
      query: 'systems innovation',
    };
    const requestRehearsal = {
      id: 'adapter-request-rehearsal:model-draft-systems-innovation-abc123:abc123',
      modelDraftId: savedModelDraft.id,
      consentPacketId: 'adapter-consent:model-draft-systems-innovation-abc123:abc123',
      title: 'External adapter request rehearsal: systems innovation',
      status: 'blocked-before-transmission',
      provider: 'openai',
      model: 'gpt-5.2',
      requestEnvelope: {
        provider: 'openai',
        model: 'gpt-5.2',
        draftTitle: savedModelDraft.title,
        modelDraftId: savedModelDraft.id,
        reviewedCitationExcerptCandidates: [
          {
            id: 'weaviate-object-001',
            sourceTitle: 'Systems Innovation Partner List',
            textPreview: 'Systems innovation partner list and follow-up notes.',
          },
        ],
      },
    };
    mockGetCaseManagementWorkspace.mockResolvedValueOnce({
      version: 1,
      savedAt: '2026-05-01T11:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-01T11:00:00.000Z',
        auditRecords: [],
        wikiModelDraftRecords: [savedModelDraft],
        wikiModelDraftExternalRequestRehearsalRecords: [requestRehearsal],
      },
    });

    const response = await request(app)
      .post(
        '/api/case-management/wiki/retrieval/model-drafts/model-draft%3Asystems-innovation%3Aabc123/external-adapter/request-rehearsals/adapter-request-rehearsal%3Amodel-draft-systems-innovation-abc123%3Aabc123/output-validations',
      )
      .send({
        confirmOutputValidation: true,
        validationMode: 'manual-output-validation',
        actor: 'Joel Zola',
        adapterOutput: {
          title: 'External sample',
          sections: [
            {
              heading: 'Lead',
              text: 'This output cites a bad id.',
              citationIds: ['unreviewed-citation-999'],
            },
          ],
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.outputValidationRecord).toEqual(
      expect.objectContaining({
        status: 'blocked-citation-contract',
        validationMode: 'manual-output-validation',
        externalModelCallMade: false,
        sourceTextTransmitted: false,
        allowedCitationIds: ['weaviate-object-001'],
        returnedCitationIds: ['unreviewed-citation-999'],
        unknownCitationIds: ['unreviewed-citation-999'],
        blockers: expect.arrayContaining(['Returned citation id is not allowed: unreviewed-citation-999']),
      }),
    );
    expect(mockSaveCaseManagementWorkspace).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        wikiModelDraftExternalOutputValidationRecords: [
          expect.objectContaining({
            status: 'blocked-citation-contract',
            unknownCitationIds: ['unreviewed-citation-999'],
          }),
        ],
      }),
    );
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('blocks promotion when retrieval evidence is candidate-only', async () => {
    const response = await request(app)
      .post('/api/case-management/wiki/retrieval/promotions')
      .send({
        confirmPromotion: true,
        query: 'systems innovation',
        promotionPreview: {
          status: 'blocked-needs-reviewed-citations',
          targetPageTitle: 'systems innovation',
          blockedReasons: ['No reviewed citations are available for promotion.'],
          citationLedger: [],
        },
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: 'Promotion is blocked until reviewed citations are ready.',
        blockedReasons: ['No reviewed citations are available for promotion.'],
      }),
    );
    expect(mockSaveCaseManagementWorkspace).not.toHaveBeenCalled();
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('blocks ready promotion previews when a publishable section has no reviewed citation coverage', async () => {
    const response = await request(app)
      .post('/api/case-management/wiki/retrieval/promotions')
      .send({
        confirmPromotion: true,
        query: 'systems innovation',
        promotionPreview: {
          status: 'ready-to-promote',
          targetPageTitle: 'systems innovation',
          publishMode: 'preview-only',
          lead: 'systems innovation has a draft section.',
          sections: [
            {
              heading: 'Uncited lead',
              text: 'This should not publish without citations.',
              citationIds: [],
              reviewState: 'reviewed-evidence',
            },
          ],
          citationLedger: [
            {
              marker: '[1]',
              id: 'weaviate-object-001',
              sourceTitle: 'Systems Innovation Partner List',
              sourceDocumentId: 'source-001',
              evidenceState: 'reviewed-vector',
            },
          ],
        },
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: 'Promotion coverage check failed.',
        citationCoverageDiff: expect.objectContaining({
          status: 'blocked',
          blockedSectionCount: 1,
          sectionDiffs: [
            expect.objectContaining({
              heading: 'Uncited lead',
              status: 'blocked-uncited-section',
            }),
          ],
        }),
      }),
    );
    expect(mockSaveCaseManagementWorkspace).not.toHaveBeenCalled();
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('stores a human-confirmed promotion backed by reviewed citations', async () => {
    const response = await request(app)
      .post('/api/case-management/wiki/retrieval/promotions')
      .send({
        confirmPromotion: true,
        actor: 'Joel Zola',
        query: 'systems innovation',
        answerDraft: {
          title: 'Draft article: systems innovation',
          lead: 'Reviewed Case Wiki evidence supports this topic.',
        },
        promotionPreview: {
          status: 'ready-to-promote',
          targetPageTitle: 'systems innovation',
          publishMode: 'preview-only',
          lead: 'systems innovation is grounded in reviewed source material.',
          sections: [
            {
              heading: 'Lead',
              text: 'systems innovation should be introduced from reviewed evidence only.',
              citationIds: ['weaviate-object-001'],
              reviewState: 'reviewed-evidence',
            },
            {
              heading: 'Gaps before publication',
              text: 'Candidate notes still need human review.',
              citationIds: ['candidate-001'],
              reviewState: 'needs-human-review',
            },
          ],
          citationLedger: [
            {
              marker: '[1]',
              id: 'weaviate-object-001',
              sourceTitle: 'Systems Innovation Partner List',
              sourceDocumentId: 'source-001',
              pageId: 'ingest:source-001',
              chunkId: 'embedding:source-001:1',
              objectId: 'weaviate-object-001',
              evidenceState: 'reviewed-vector',
              textPreview: 'Systems innovation partner list and follow-up notes.',
            },
          ],
        },
      });

    expect(response.status).toBe(200);
    expect(mockWriteCaseWikiGraphToNeo4j).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ kind: 'WikiPage' }),
          expect.objectContaining({ kind: 'WikiPromotion' }),
          expect.objectContaining({ kind: 'SourceDocument' }),
        ]),
        edges: expect.arrayContaining([
          expect.objectContaining({ kind: 'CITES' }),
          expect.objectContaining({ kind: 'PROMOTED_WIKI_PAGE' }),
        ]),
      }),
    );
    expect(mockSaveCaseManagementWorkspace).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        wikiPromotionRecords: [
          expect.objectContaining({
            pageId: 'promotion:systems-innovation',
            title: 'systems innovation',
            publishMode: 'human-confirmed',
            reviewState: 'reviewed-citations-only',
            sourceDocumentIds: ['source-001'],
            citationCoverageDiff: expect.objectContaining({
              status: 'pass',
              promotableSectionCount: 1,
              excludedSectionCount: 1,
            }),
            citationLedger: [
              expect.objectContaining({
                sourceDocumentId: 'source-001',
                objectId: 'weaviate-object-001',
              }),
            ],
          }),
        ],
      }),
    );
    expect(response.body.promotionRecord).toEqual(
      expect.objectContaining({
        pageId: 'promotion:systems-innovation',
        neo4jStatus: 'written',
        citationCoverageDiff: expect.objectContaining({
          status: 'pass',
          reviewedCitationCount: 1,
        }),
      }),
    );
    expect(response.body.policy).toContain('did not attach source documents');
  });

  it('versions an existing promoted topic instead of duplicating the wiki page', async () => {
    const existingPromotion = {
      id: 'promotion:systems-innovation:oldhash',
      pageId: 'promotion:systems-innovation',
      title: 'systems innovation',
      query: 'systems innovation',
      lead: 'Original reviewed lead.',
      sections: [{ id: 'section-lead', heading: 'Lead', text: 'Original section.', reviewState: 'reviewed-evidence' }],
      citationLedger: [
        {
          id: 'weaviate-object-old',
          sourceTitle: 'Original Systems Innovation Source',
          sourceDocumentId: 'source-old',
          evidenceState: 'reviewed-vector',
        },
      ],
      sourceDocumentIds: ['source-old'],
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
      createdBy: 'Joel Zola',
      reviewState: 'reviewed-citations-only',
      publishMode: 'human-confirmed',
      version: 1,
      revisionId: 'revision:promotion:systems-innovation:oldhash:1',
      versionHistory: [],
    };
    mockGetCaseManagementWorkspace.mockResolvedValue({
      version: 1,
      savedAt: '2026-05-01T11:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-01T11:00:00.000Z',
        wikiPromotionRecords: [existingPromotion],
        auditRecords: [],
      },
    });

    const response = await request(app)
      .post('/api/case-management/wiki/retrieval/promotions')
      .send({
        confirmPromotion: true,
        actor: 'Joel Zola',
        query: 'systems innovation',
        promotionPreview: {
          status: 'ready-to-promote',
          targetPageTitle: 'systems innovation',
          lead: 'Updated reviewed lead.',
          sections: [
            {
              heading: 'Lead',
              text: 'Updated section grounded in new reviewed citation.',
              citationIds: ['weaviate-object-new'],
              reviewState: 'reviewed-evidence',
            },
          ],
          citationLedger: [
            {
              id: 'weaviate-object-new',
              sourceTitle: 'New Systems Innovation Source',
              sourceDocumentId: 'source-new',
              objectId: 'weaviate-object-new',
              evidenceState: 'reviewed-vector',
            },
          ],
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.promotionRecord).toEqual(
      expect.objectContaining({
        id: existingPromotion.id,
        pageId: 'promotion:systems-innovation',
        lead: 'Updated reviewed lead.',
        version: 2,
        sourceRevisionId: expect.stringContaining('promotion:systems-innovation:'),
        versionHistory: [
          expect.objectContaining({
            revisionId: existingPromotion.revisionId,
            lead: 'Original reviewed lead.',
            version: 1,
          }),
        ],
      }),
    );
    const savedWorkspace = mockSaveCaseManagementWorkspace.mock.calls[0][1];
    expect(savedWorkspace.wikiPromotionRecords).toHaveLength(1);
    expect(savedWorkspace.wikiPromotionRecords[0].id).toBe(existingPromotion.id);
    expect(savedWorkspace.wikiPromotionRecords[0].sourceDocumentIds).toEqual(['source-new']);
  });

  it('rolls a promoted topic back to a saved revision without changing sources or vectors', async () => {
    const existingPromotion = {
      id: 'promotion:systems-innovation:oldhash',
      pageId: 'promotion:systems-innovation',
      title: 'systems innovation',
      query: 'systems innovation',
      lead: 'Updated reviewed lead.',
      sections: [{ id: 'section-lead', heading: 'Lead', text: 'Updated section.', reviewState: 'reviewed-evidence' }],
      citationLedger: [
        {
          id: 'weaviate-object-new',
          sourceTitle: 'New Systems Innovation Source',
          sourceDocumentId: 'source-new',
          evidenceState: 'reviewed-vector',
        },
      ],
      sourceDocumentIds: ['source-new'],
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T12:00:00.000Z',
      createdBy: 'Joel Zola',
      reviewState: 'reviewed-citations-only',
      publishMode: 'human-confirmed',
      version: 2,
      revisionId: 'revision:promotion:systems-innovation:oldhash:2',
      versionHistory: [
        {
          revisionId: 'revision:promotion:systems-innovation:oldhash:1',
          promotionId: 'promotion:systems-innovation:oldhash',
          pageId: 'promotion:systems-innovation',
          title: 'systems innovation',
          query: 'systems innovation',
          lead: 'Original reviewed lead.',
          sections: [{ id: 'section-lead', heading: 'Lead', text: 'Original section.', reviewState: 'reviewed-evidence' }],
          citationLedger: [
            {
              id: 'weaviate-object-old',
              sourceTitle: 'Original Systems Innovation Source',
              sourceDocumentId: 'source-old',
              evidenceState: 'reviewed-vector',
            },
          ],
          sourceDocumentIds: ['source-old'],
          reviewState: 'reviewed-citations-only',
          publishMode: 'human-confirmed',
          version: 1,
        },
      ],
    };
    mockGetCaseManagementWorkspace.mockResolvedValue({
      version: 1,
      savedAt: '2026-05-01T11:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-01T11:00:00.000Z',
        wikiPromotionRecords: [existingPromotion],
        auditRecords: [],
      },
    });

    const response = await request(app)
      .post(`/api/case-management/wiki/retrieval/promotions/${encodeURIComponent(existingPromotion.id)}/rollback`)
      .send({
        confirmRollback: true,
        actor: 'Joel Zola',
        revisionId: 'revision:promotion:systems-innovation:oldhash:1',
      });

    expect(response.status).toBe(200);
    expect(response.body.promotionRecord).toEqual(
      expect.objectContaining({
        id: existingPromotion.id,
        pageId: 'promotion:systems-innovation',
        lead: 'Original reviewed lead.',
        sourceDocumentIds: ['source-old'],
        version: 3,
        rollbackOfRevisionId: 'revision:promotion:systems-innovation:oldhash:1',
        versionHistory: [
          expect.objectContaining({
            revisionId: existingPromotion.revisionId,
            lead: 'Updated reviewed lead.',
            version: 2,
          }),
        ],
      }),
    );
    expect(mockWriteCaseWikiGraphToNeo4j).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ kind: 'WikiPromotion' })]),
      }),
    );
    expect(response.body.policy).toContain('did not attach source documents');
    expect(response.body.policy).toContain('write vectors');
  });

  it('keeps a source standalone and clears any live-record attachment fields', async () => {
    wikiIngestions = [
      makeIngestion({
        linkedClientId: 'client-001',
        linkedCaseId: 'case-001',
        linkedServiceName: 'Toronto Harbour Light',
        sourceScope: 'current-record',
        privacy: { sourceScope: 'current-record', privacyLevel: 'case-team' },
      }),
    ];

    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/archive')
      .send({ action: 'keep-standalone' });

    expect(response.status).toBe(200);
    expect(mockUpdateCaseManagementWikiIngestionReview).toHaveBeenCalledWith(
      'test-user-123',
      'source-001',
      expect.objectContaining({
        sourceScope: 'standalone',
        linkedClientId: '',
        linkedCaseId: '',
        linkedServiceName: '',
        'privacy.sourceScope': 'standalone',
        'generatedRecords.frontendRecord.sourceScope': 'standalone',
        'generatedRecords.frontendRecord.linkedClientId': '',
        'generatedRecords.frontendRecord.linkedCaseId': '',
        'generatedRecords.frontendRecord.linkedServiceName': '',
        'generatedRecords.note.clientId': '',
        'generatedRecords.document.clientId': '',
        'generatedRecords.timeline.clientId': '',
      }),
    );
    expect(response.body.wikiIngestionRecord.archive).toEqual(
      expect.objectContaining({
        reviewStatus: 'reviewed-standalone',
        attachmentTarget: null,
      }),
    );
    expect(response.body.generatedRecords.auditRecords[0].action).toBe('kept source as standalone document');
  });

  it('applies a Life Domain move without graph, vector, attachment, or file side effects', async () => {
    const missingConfirmation = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/archive')
      .send({
        action: 'apply-life-domain-move',
        target: {
          lifeDomain: 'Creative and media',
          lifeDomainId: 'creative-media',
          proposalId: 'life-domain-move-source-001-creative-media',
        },
      });

    expect(missingConfirmation.status).toBe(400);
    expect(missingConfirmation.body.error).toBe('Confirm the Life Domain move before updating this source shelf');

    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/archive')
      .send({
        action: 'apply-life-domain-move',
        confirmLifeDomainMove: true,
        target: {
          lifeDomain: 'Creative and media',
          lifeDomainId: 'creative-media',
          proposalId: 'life-domain-move-source-001-creative-media',
          reason: 'Accepted receipt and source boundary reviewed.',
        },
      });

    expect(response.status).toBe(200);
    expect(mockUpdateCaseManagementWikiIngestionReview).toHaveBeenCalledWith(
      'test-user-123',
      'source-001',
      expect.objectContaining({
        lifeDomain: 'Creative and media',
        lifeDomainId: 'creative-media',
        'wikiPage.lifeDomain': 'Creative and media',
        'wikiPage.lifeDomainId': 'creative-media',
        'generatedRecords.frontendRecord.lifeDomain': 'Creative and media',
        'generatedRecords.frontendRecord.lifeDomainId': 'creative-media',
        archive: expect.objectContaining({
          lifeDomain: 'Creative and media',
          lifeDomainId: 'creative-media',
          lifeDomainMoveReceipt: expect.objectContaining({
            proposalId: 'life-domain-move-source-001-creative-media',
            fromDomain: 'Partners',
            toDomain: 'Creative and media',
            vectorWrite: false,
            graphWrite: false,
            attachmentWrite: false,
            fileAction: false,
          }),
        }),
      }),
    );
    expect(response.body.wikiIngestionRecord.archive).toEqual(
      expect.objectContaining({
        lifeDomain: 'Creative and media',
        lifeDomainId: 'creative-media',
      }),
    );
    expect(response.body.generatedRecords.auditRecords[0].action).toBe(
      'applied source Life Domain move to Creative and media',
    );
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
    expect(mockPrepareCaseWikiWeaviateDryRun).not.toHaveBeenCalled();
    expect(mockWriteCaseWikiApprovedChunksToWeaviate).not.toHaveBeenCalled();
  });

  it('loads server-synced provenance lenses for the Case Wiki graph', async () => {
    mockGetCaseManagementProvenanceLenses.mockResolvedValue([
      {
        lensId: 'life-domain-graph-provenance-view-001',
        name: 'Approved graph lens',
        query: 'graph',
        reviewFilter: 'approved',
        domainFilter: 'all',
        browserScope: 'all-domains',
        resultCount: 1,
        matchingWorkspaceCount: 1,
        lensCreatedAt: '2026-05-01T12:00:00.000Z',
        lensUpdatedAt: '2026-05-01T12:05:00.000Z',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        shareNote: 'Shared with Nia Patel inside Case Wiki.',
        accessRole: 'editor',
        accessRoles: { 'Nia Patel': 'editor' },
        activityRecords: [
          {
            id: 'activity-001',
            type: 'shared',
            actor: 'Joel Zola',
            detail: 'Shared with Nia Patel as editor.',
            createdAt: '2026-05-01T12:04:00.000Z',
          },
        ],
      },
    ]);

    const response = await request(app).get('/api/case-management/wiki/graph/provenance-lenses');

    expect(response.status).toBe(200);
    expect(mockGetCaseManagementProvenanceLenses).toHaveBeenCalledWith('test-user-123');
    expect(response.body.provenanceLenses).toEqual([
      expect.objectContaining({
        id: 'life-domain-graph-provenance-view-001',
        name: 'Approved graph lens',
        reviewFilter: 'approved',
        browserScope: 'all-domains',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'editor',
        accessRoles: { 'Nia Patel': 'editor' },
        activityRecords: [
          expect.objectContaining({ type: 'shared', actor: 'Joel Zola' }),
        ],
      }),
    ]);
  });

  it('filters server-synced provenance lenses by the requesting actor role', async () => {
    mockGetCaseManagementProvenanceLenses.mockResolvedValue([
      {
        lensId: 'life-domain-graph-provenance-view-001',
        name: 'Shared with Nia',
        query: 'housing',
        reviewFilter: 'approved',
        domainFilter: 'housing',
        browserScope: 'all-domains',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'viewer',
        accessRoles: { 'Nia Patel': 'viewer' },
      },
      {
        lensId: 'life-domain-graph-provenance-view-002',
        name: 'Joel private lens',
        query: 'employment',
        reviewFilter: 'all',
        domainFilter: 'employment',
        browserScope: 'active-domain',
        createdBy: 'Joel Zola',
        visibility: 'private',
        sharedWith: [],
        accessRole: 'manager',
        accessRoles: {},
      },
    ]);

    const response = await request(app)
      .get('/api/case-management/wiki/graph/provenance-lenses?actor=Nia%20Patel');

    expect(response.status).toBe(200);
    expect(response.body.totalCount).toBe(2);
    expect(response.body.visibleCount).toBe(1);
    expect(response.body.provenanceLenses).toEqual([
      expect.objectContaining({
        id: 'life-domain-graph-provenance-view-001',
        name: 'Shared with Nia',
        viewerRole: 'viewer',
      }),
    ]);
  });

  it('exports only manager-visible provenance lens activity metadata', async () => {
    mockGetCaseManagementProvenanceLenses.mockResolvedValue([
      {
        lensId: 'life-domain-graph-provenance-view-001',
        name: 'Shared manager lens',
        query: 'housing',
        reviewFilter: 'approved',
        domainFilter: 'housing',
        browserScope: 'all-domains',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'manager',
        accessRoles: { 'Nia Patel': 'manager' },
        activityRecords: [
          {
            id: 'activity-001',
            type: 'shared',
            actor: 'Joel Zola',
            detail: 'Shared with Nia Patel as manager.',
            createdAt: '2026-05-01T12:04:00.000Z',
            sharedWith: ['Nia Patel'],
            accessRole: 'manager',
          },
        ],
      },
      {
        lensId: 'life-domain-graph-provenance-view-002',
        name: 'Viewer-only lens',
        query: 'employment',
        reviewFilter: 'all',
        domainFilter: 'employment',
        browserScope: 'active-domain',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'viewer',
        accessRoles: { 'Nia Patel': 'viewer' },
        activityRecords: [
          {
            id: 'activity-002',
            type: 'opened',
            actor: 'Nia Patel',
            detail: 'Opened by Nia Patel.',
            createdAt: '2026-05-01T12:06:00.000Z',
          },
        ],
      },
    ]);

    const response = await request(app)
      .get('/api/case-management/wiki/graph/provenance-lenses/activity-export?actor=Nia%20Patel&format=csv');

    expect(response.status).toBe(200);
    expect(response.body.filename).toMatch(/case-wiki-provenance-lens-activity-/);
    expect(response.body.contentType).toBe('text/csv');
    expect(response.body.export).toEqual(
      expect.objectContaining({
        exportType: 'graph-provenance-lens-activity',
        actor: 'Nia Patel',
        lensCount: 1,
        activityCount: 1,
      }),
    );
    expect(response.body.content).toContain('Shared manager lens');
    expect(response.body.content).not.toContain('Viewer-only lens');
    expect(mockCreateCaseManagementProvenanceLensExportAudit).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        actor: 'Nia Patel',
        exportType: 'graph-provenance-lens-activity',
        format: 'csv',
        lensCount: 1,
        activityCount: 1,
        visibleLensIds: ['life-domain-graph-provenance-view-001'],
      }),
    );
    expect(response.body.auditRecord).toEqual(
      expect.objectContaining({
        exportType: 'graph-provenance-lens-activity',
        actor: 'Nia Patel',
        lensCount: 1,
        activityCount: 1,
      }),
    );
  });

  it('loads persisted provenance lens export audit records', async () => {
    mockGetCaseManagementProvenanceLensExportAudits.mockResolvedValue([
      {
        auditId: 'provenance-lens-export-audit-001',
        actor: 'Nia Patel',
        exportType: 'graph-provenance-lens-activity',
        format: 'json',
        filename: 'case-wiki-provenance-lens-activity-2026-05-01.json',
        contentType: 'application/json',
        privacyNote: 'Metadata-only provenance lens activity export.',
        lensCount: 2,
        activityCount: 5,
        visibleLensIds: ['life-domain-graph-provenance-view-001'],
        exportedAt: '2026-05-01T12:10:00.000Z',
      },
    ]);

    const response = await request(app)
      .get('/api/case-management/wiki/graph/provenance-lenses/activity-export/audits?limit=10');

    expect(response.status).toBe(200);
    expect(response.body.exportType).toBe('all');
    expect(mockGetCaseManagementProvenanceLensExportAudits).toHaveBeenCalledWith('test-user-123', 10, 'all');
    expect(response.body.auditRecords).toEqual([
      expect.objectContaining({
        id: 'provenance-lens-export-audit-001',
        exportType: 'graph-provenance-lens-activity',
        actor: 'Nia Patel',
        lensCount: 2,
        activityCount: 5,
      }),
    ]);
  });

  it('filters persisted provenance lens export audit records by export type', async () => {
    mockGetCaseManagementProvenanceLensExportAudits.mockResolvedValue([
      {
        auditId: 'provenance-lens-repair-export-audit-001',
        actor: 'Nia Patel',
        exportType: 'graph-provenance-lens-activity-repair-ledger',
        format: 'csv',
        filename: 'case-wiki-provenance-lens-repairs-all-2026-05-01.csv',
        contentType: 'text/csv',
        privacyNote: 'Metadata-only provenance lens repair export.',
        lensCount: 1,
        activityCount: 2,
        visibleLensIds: ['life-domain-graph-provenance-view-001'],
        exportedAt: '2026-05-01T12:20:00.000Z',
      },
    ]);

    const response = await request(app)
      .get(
        '/api/case-management/wiki/graph/provenance-lenses/activity-export/audits?limit=10&exportType=graph-provenance-lens-activity-repair-ledger',
      );

    expect(response.status).toBe(200);
    expect(response.body.exportType).toBe('graph-provenance-lens-activity-repair-ledger');
    expect(mockGetCaseManagementProvenanceLensExportAudits).toHaveBeenCalledWith(
      'test-user-123',
      10,
      'graph-provenance-lens-activity-repair-ledger',
    );
    expect(response.body.auditRecords).toEqual([
      expect.objectContaining({
        id: 'provenance-lens-repair-export-audit-001',
        exportType: 'graph-provenance-lens-activity-repair-ledger',
        actor: 'Nia Patel',
        lensCount: 1,
        activityCount: 2,
      }),
    ]);
  });

  it('builds a manager review queue for provenance lenses with missing activity history', async () => {
    mockGetCaseManagementProvenanceLenses.mockResolvedValue([
      {
        lensId: 'life-domain-graph-provenance-view-001',
        name: 'Legacy manager lens',
        query: 'housing',
        reviewFilter: 'approved',
        domainFilter: 'housing',
        browserScope: 'all-domains',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'manager',
        accessRoles: { 'Nia Patel': 'manager' },
        activityRecords: [],
        lensUpdatedAt: '2026-05-01T12:04:00.000Z',
      },
      {
        lensId: 'life-domain-graph-provenance-view-002',
        name: 'Viewer-only legacy lens',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'viewer',
        accessRoles: { 'Nia Patel': 'viewer' },
        activityRecords: [],
      },
      {
        lensId: 'life-domain-graph-provenance-view-003',
        name: 'Complete manager lens',
        createdBy: 'Nia Patel',
        visibility: 'private',
        sharedWith: [],
        accessRole: 'manager',
        accessRoles: {},
        activityRecords: [
          { id: 'activity-003', type: 'created', actor: 'Nia Patel', createdAt: '2026-05-01T12:00:00.000Z' },
        ],
      },
    ]);

    const response = await request(app)
      .get('/api/case-management/wiki/graph/provenance-lenses/activity-review-queue?actor=Nia%20Patel');

    expect(response.status).toBe(200);
    expect(response.body.reviewQueue).toEqual([
      expect.objectContaining({
        lensId: 'life-domain-graph-provenance-view-001',
        lensName: 'Legacy manager lens',
        reviewStatus: 'missing-activity-history',
        priority: 'high',
        reasons: expect.arrayContaining(['No activity history has been captured yet']),
      }),
    ]);
  });

  it('backfills missing provenance lens activity and writes the repair to Neo4j', async () => {
    mockGetCaseManagementProvenanceLens.mockResolvedValueOnce({
      lensId: 'life-domain-graph-provenance-view-001',
      name: 'Legacy manager lens',
      query: 'graph',
      reviewFilter: 'approved',
      domainFilter: 'partners',
      browserScope: 'all-domains',
      resultCount: 1,
      matchingWorkspaceCount: 1,
      lensCreatedAt: '2026-05-01T12:00:00.000Z',
      lensUpdatedAt: '2026-05-01T12:04:00.000Z',
      createdBy: 'Joel Zola',
      visibility: 'team',
      sharedWith: ['Nia Patel'],
      accessRole: 'manager',
      accessRoles: { 'Nia Patel': 'manager' },
      activityRecords: [],
      neo4jStatus: 'written',
    });

    const response = await request(app)
      .post('/api/case-management/wiki/graph/provenance-lenses/life-domain-graph-provenance-view-001/activity-backfill')
      .send({ actor: 'Nia Patel' });

    expect(response.status).toBe(200);
    expect(mockBuildCaseWikiGraphProvenanceLensGraph).toHaveBeenCalledWith({
      userId: 'test-user-123',
      lens: expect.objectContaining({
        id: 'life-domain-graph-provenance-view-001',
        activityRecords: expect.arrayContaining([
          expect.objectContaining({ type: 'backfilled', repairType: 'created', actor: 'Nia Patel' }),
          expect.objectContaining({ type: 'backfilled', repairType: 'shared', actor: 'Nia Patel' }),
          expect.objectContaining({ type: 'backfilled', repairType: 'server-synced', actor: 'Nia Patel' }),
        ]),
      }),
    });
    expect(mockWriteCaseWikiGraphToNeo4j).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ kind: 'GraphProvenanceLens' }),
        ]),
      }),
    );
    expect(mockSaveCaseManagementProvenanceLens).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        id: 'life-domain-graph-provenance-view-001',
        activityRecords: expect.arrayContaining([
          expect.objectContaining({ type: 'backfilled', repairType: 'created' }),
        ]),
        neo4jStatus: 'written',
      }),
    );
    expect(response.body.backfilledActivities).toHaveLength(3);
    expect(response.body.reviewQueue).toEqual([]);
    expect(response.body.provenanceLens.activityRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'backfilled', repairType: 'created' }),
      ]),
    );
  });

  it('blocks viewer-only provenance lens activity backfills server-side', async () => {
    mockGetCaseManagementProvenanceLens.mockResolvedValueOnce({
      lensId: 'life-domain-graph-provenance-view-001',
      name: 'Viewer legacy lens',
      createdBy: 'Joel Zola',
      visibility: 'team',
      sharedWith: ['Nia Patel'],
      accessRole: 'viewer',
      accessRoles: { 'Nia Patel': 'viewer' },
      activityRecords: [],
    });

    const response = await request(app)
      .post('/api/case-management/wiki/graph/provenance-lenses/life-domain-graph-provenance-view-001/activity-backfill')
      .send({ actor: 'Nia Patel' });

    expect(response.status).toBe(403);
    expect(mockBuildCaseWikiGraphProvenanceLensGraph).not.toHaveBeenCalled();
    expect(mockSaveCaseManagementProvenanceLens).not.toHaveBeenCalled();
  });

  it('batch backfills manager-visible provenance lens activity repair candidates', async () => {
    mockGetCaseManagementProvenanceLenses.mockResolvedValue([
      {
        lensId: 'life-domain-graph-provenance-view-001',
        name: 'Legacy manager lens',
        query: 'graph',
        reviewFilter: 'approved',
        domainFilter: 'partners',
        browserScope: 'all-domains',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'manager',
        accessRoles: { 'Nia Patel': 'manager' },
        activityRecords: [],
        neo4jStatus: 'written',
      },
      {
        lensId: 'life-domain-graph-provenance-view-002',
        name: 'Viewer-only legacy lens',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'viewer',
        accessRoles: { 'Nia Patel': 'viewer' },
        activityRecords: [],
      },
    ]);

    const response = await request(app)
      .post('/api/case-management/wiki/graph/provenance-lenses/activity-backfill/batch')
      .send({ actor: 'Nia Patel' });

    expect(response.status).toBe(200);
    expect(response.body.repairedCount).toBe(1);
    expect(response.body.backfilledActivityCount).toBe(3);
    expect(response.body.provenanceLenses).toEqual([
      expect.objectContaining({
        id: 'life-domain-graph-provenance-view-001',
        activityRecords: expect.arrayContaining([
          expect.objectContaining({ type: 'backfilled', repairType: 'created' }),
          expect.objectContaining({ type: 'backfilled', repairType: 'shared' }),
          expect.objectContaining({ type: 'backfilled', repairType: 'server-synced' }),
        ]),
      }),
    ]);
    expect(response.body.repairLedger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lensId: 'life-domain-graph-provenance-view-001',
          lensName: 'Legacy manager lens',
          repairType: 'created',
        }),
      ]),
    );
    expect(response.body.reviewQueue).toEqual([]);
    expect(mockWriteCaseWikiGraphToNeo4j).toHaveBeenCalledTimes(1);
  });

  it('loads a filtered provenance lens activity repair ledger', async () => {
    mockGetCaseManagementProvenanceLenses.mockResolvedValue([
      {
        lensId: 'life-domain-graph-provenance-view-001',
        name: 'Backfilled manager lens',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'manager',
        accessRoles: { 'Nia Patel': 'manager' },
        activityRecords: [
          {
            id: 'repair-created-001',
            type: 'backfilled',
            repairType: 'created',
            reason: 'Missing original created activity',
            actor: 'Nia Patel',
            detail: 'Backfilled missing created activity.',
            createdAt: '2026-05-01T12:10:00.000Z',
          },
          {
            id: 'repair-shared-001',
            type: 'backfilled',
            repairType: 'shared',
            reason: 'Missing sharing activity',
            actor: 'Nia Patel',
            detail: 'Backfilled sharing activity.',
            createdAt: '2026-05-01T12:11:00.000Z',
          },
        ],
      },
    ]);

    const response = await request(app)
      .get('/api/case-management/wiki/graph/provenance-lenses/activity-backfill/repairs?actor=Nia%20Patel&repairType=shared');

    expect(response.status).toBe(200);
    expect(response.body.repairType).toBe('shared');
    expect(response.body.repairLedger).toEqual([
      expect.objectContaining({
        id: 'repair-shared-001',
        lensId: 'life-domain-graph-provenance-view-001',
        repairType: 'shared',
        actor: 'Nia Patel',
      }),
    ]);
  });

  it('exports a filtered provenance lens activity repair ledger', async () => {
    mockGetCaseManagementProvenanceLenses.mockResolvedValue([
      {
        lensId: 'life-domain-graph-provenance-view-001',
        name: 'Backfilled manager lens',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'manager',
        accessRoles: { 'Nia Patel': 'manager' },
        activityRecords: [
          {
            id: 'repair-created-001',
            type: 'backfilled',
            repairType: 'created',
            reason: 'Missing original created activity',
            actor: 'Nia Patel',
            detail: 'Backfilled missing created activity.',
            createdAt: '2026-05-01T12:10:00.000Z',
          },
          {
            id: 'repair-shared-001',
            type: 'backfilled',
            repairType: 'shared',
            reason: 'Missing sharing activity',
            actor: 'Nia Patel',
            detail: 'Backfilled sharing activity.',
            createdAt: '2026-05-01T12:11:00.000Z',
          },
        ],
      },
      {
        lensId: 'life-domain-graph-provenance-view-002',
        name: 'Viewer repair lens',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'viewer',
        accessRoles: { 'Nia Patel': 'viewer' },
        activityRecords: [
          {
            id: 'repair-viewer-001',
            type: 'backfilled',
            repairType: 'shared',
            actor: 'Nia Patel',
            detail: 'Should not export.',
            createdAt: '2026-05-01T12:12:00.000Z',
          },
        ],
      },
    ]);

    const response = await request(app)
      .get('/api/case-management/wiki/graph/provenance-lenses/activity-backfill/repairs/export?actor=Nia%20Patel&repairType=shared&format=markdown');

    expect(response.status).toBe(200);
    expect(response.body.filename).toMatch(/case-wiki-provenance-lens-repairs-shared-/);
    expect(response.body.contentType).toBe('text/markdown');
    expect(response.body.export).toEqual(
      expect.objectContaining({
        exportType: 'graph-provenance-lens-activity-repair-ledger',
        actor: 'Nia Patel',
        repairType: 'shared',
        lensCount: 1,
        repairCount: 1,
      }),
    );
    expect(response.body.content).toContain('Backfilled manager lens');
    expect(response.body.content).toContain('Missing sharing activity');
    expect(response.body.content).not.toContain('Missing original created activity');
    expect(response.body.content).not.toContain('Viewer repair lens');
    expect(mockCreateCaseManagementProvenanceLensExportAudit).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        actor: 'Nia Patel',
        exportType: 'graph-provenance-lens-activity-repair-ledger',
        format: 'markdown',
        lensCount: 1,
        activityCount: 1,
        visibleLensIds: ['life-domain-graph-provenance-view-001'],
      }),
    );
  });

  it('loads a provenance lens activity trail graph comparing native and repaired activity', async () => {
    mockGetCaseManagementProvenanceLenses.mockResolvedValue([
      {
        lensId: 'life-domain-graph-provenance-view-001',
        name: 'Repaired trail lens',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'manager',
        accessRoles: { 'Nia Patel': 'manager' },
        neo4jStatus: 'written',
        activityRecords: [
          {
            id: 'activity-created-001',
            type: 'created',
            actor: 'Joel Zola',
            detail: 'Created the lens.',
            createdAt: '2026-05-01T12:00:00.000Z',
          },
          {
            id: 'repair-shared-001',
            type: 'backfilled',
            repairType: 'shared',
            reason: 'Missing sharing activity',
            actor: 'Nia Patel',
            detail: 'Backfilled sharing activity.',
            createdAt: '2026-05-01T12:11:00.000Z',
          },
          {
            id: 'repair-sync-001',
            type: 'backfilled',
            repairType: 'server-synced',
            reason: 'Missing server sync activity',
            actor: 'Nia Patel',
            detail: 'Backfilled Neo4j sync activity.',
            createdAt: '2026-05-01T12:12:00.000Z',
          },
        ],
      },
      {
        lensId: 'life-domain-graph-provenance-view-002',
        name: 'Viewer-only trail',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'viewer',
        accessRoles: { 'Nia Patel': 'viewer' },
        activityRecords: [],
      },
    ]);

    const response = await request(app)
      .get('/api/case-management/wiki/graph/provenance-lenses/activity-trails?actor=Nia%20Patel');

    expect(response.status).toBe(200);
    expect(response.body.activityTrailGraphLens).toEqual(
      expect.objectContaining({
        actor: 'Nia Patel',
        lensCount: 1,
        nativeActivityCount: 1,
        repairedActivityCount: 2,
        inspectionActivityCount: 0,
        uninspectedRepairCount: 2,
        needsRepairCount: 0,
      }),
    );
    expect(response.body.activityTrailGraphLens.rows).toEqual([
      expect.objectContaining({
        lensId: 'life-domain-graph-provenance-view-001',
        lensName: 'Repaired trail lens',
        nativeActivityCount: 1,
        repairedActivityCount: 2,
        status: 'repaired-complete',
        nativeTypes: ['created'],
        repairedTypes: expect.arrayContaining(['shared', 'server-synced']),
      }),
    ]);
    expect(response.body.activityTrailGraphLens.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'lens:life-domain-graph-provenance-view-001', kind: 'GraphProvenanceLens' }),
        expect.objectContaining({ id: 'activity:repair-sync-001', kind: 'GraphProvenanceLensRepairActivity' }),
      ]),
    );
    expect(response.body.activityTrailGraphLens.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'lens:life-domain-graph-provenance-view-001',
          to: 'activity:repair-sync-001',
          type: 'HAS_REPAIRED_ACTIVITY',
        }),
      ]),
    );
  });

  it('filters provenance lens activity trails by repaired edge inspection history', async () => {
    const records = [
      {
        lensId: 'life-domain-graph-provenance-view-inspected',
        name: 'Inspected repair lens',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'manager',
        accessRoles: { 'Nia Patel': 'manager' },
        activityRecords: [
          {
            id: 'repair-sync-001',
            type: 'backfilled',
            repairType: 'server-synced',
            reason: 'Missing server sync activity',
            actor: 'Nia Patel',
            detail: 'Backfilled Neo4j sync activity.',
            createdAt: '2026-05-01T12:12:00.000Z',
          },
          {
            id: 'inspection-001',
            type: 'opened',
            inspectionType: 'repaired-edge-drilldown',
            inspectedActivityId: 'repair-sync-001',
            inspectedEdgeId: 'edge:life-domain-graph-provenance-view-inspected:repair-sync-001',
            repairType: 'server-synced',
            actor: 'Nia Patel',
            detail: 'Opened repaired edge.',
            createdAt: '2026-05-01T12:13:00.000Z',
          },
        ],
      },
      {
        lensId: 'life-domain-graph-provenance-view-uninspected',
        name: 'Uninspected repair lens',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'manager',
        accessRoles: { 'Nia Patel': 'manager' },
        activityRecords: [
          {
            id: 'repair-shared-001',
            type: 'backfilled',
            repairType: 'shared',
            reason: 'Missing sharing activity',
            actor: 'Nia Patel',
            detail: 'Backfilled sharing activity.',
            createdAt: '2026-05-01T12:11:00.000Z',
          },
        ],
      },
    ];
    mockGetCaseManagementProvenanceLenses.mockResolvedValue(records);

    const inspectedResponse = await request(app)
      .get('/api/case-management/wiki/graph/provenance-lenses/activity-trails?actor=Nia%20Patel&inspectionFilter=inspected');
    const needsInspectionResponse = await request(app)
      .get('/api/case-management/wiki/graph/provenance-lenses/activity-trails?actor=Nia%20Patel&inspectionFilter=needs-inspection');

    expect(inspectedResponse.status).toBe(200);
    expect(inspectedResponse.body.activityTrailGraphLens).toEqual(
      expect.objectContaining({
        inspectionFilter: 'inspected',
        lensCount: 1,
        inspectionActivityCount: 1,
        uninspectedRepairCount: 0,
      }),
    );
    expect(inspectedResponse.body.activityTrailGraphLens.rows[0]).toEqual(
      expect.objectContaining({
        lensId: 'life-domain-graph-provenance-view-inspected',
        inspectionStatus: 'fully-inspected',
        inspectionActivityCount: 1,
      }),
    );
    expect(needsInspectionResponse.status).toBe(200);
    expect(needsInspectionResponse.body.activityTrailGraphLens).toEqual(
      expect.objectContaining({
        inspectionFilter: 'needs-inspection',
        lensCount: 1,
        inspectionActivityCount: 0,
        uninspectedRepairCount: 1,
      }),
    );
    expect(needsInspectionResponse.body.activityTrailGraphLens.rows[0]).toEqual(
      expect.objectContaining({
        lensId: 'life-domain-graph-provenance-view-uninspected',
        inspectionStatus: 'needs-inspection',
      }),
    );
  });

  it('persists repaired edge inspections and returns a Neo4j query handoff', async () => {
    mockGetCaseManagementProvenanceLens.mockResolvedValue({
      lensId: 'life-domain-graph-provenance-view-001',
      name: 'Repaired trail lens',
      createdBy: 'Joel Zola',
      visibility: 'team',
      sharedWith: ['Nia Patel'],
      accessRole: 'manager',
      accessRoles: { 'Nia Patel': 'manager' },
      activityRecords: [
        {
          id: 'repair-sync-001',
          type: 'backfilled',
          repairType: 'server-synced',
          reason: 'Missing server sync activity',
          actor: 'Nia Patel',
          detail: 'Backfilled Neo4j sync activity.',
          createdAt: '2026-05-01T12:12:00.000Z',
        },
      ],
    });
    mockBuildCaseWikiGraphProvenanceLensGraph.mockImplementationOnce(({ lens, userId }) => ({
      provenanceLens: {
        id: lens.id,
        nodeId: `graph-provenance-lens:${lens.id}`,
        name: lens.name,
        query: lens.query,
        reviewFilter: lens.reviewFilter,
        domainFilter: lens.domainFilter,
        browserScope: lens.browserScope,
        resultCount: lens.resultCount,
        matchingWorkspaceCount: lens.matchingWorkspaceCount,
        createdAt: lens.createdAt,
        updatedAt: lens.updatedAt,
        createdBy: lens.createdBy,
        visibility: lens.visibility || 'private',
        sharedWith: lens.sharedWith || [],
        shareNote: lens.shareNote || '',
        accessRole: lens.accessRole || 'manager',
        accessRoles: lens.accessRoles || {},
        activityRecords: (lens.activityRecords || []).map((activity) => ({
          ...activity,
          nodeId: `graph-provenance-lens-activity:${activity.id}`,
        })),
        userId,
      },
      graph: {
        nodes: [
          { id: `graph-provenance-lens:${lens.id}`, kind: 'GraphProvenanceLens', props: { lensId: lens.id } },
          ...(lens.activityRecords || []).map((activity) => ({
            id: `graph-provenance-lens-activity:${activity.id}`,
            kind: 'GraphProvenanceLensActivity',
            props: { activityId: activity.id },
          })),
        ],
        edges: [],
      },
    }));

    const response = await request(app)
      .post('/api/case-management/wiki/graph/provenance-lenses/life-domain-graph-provenance-view-001/activity-inspections')
      .send({
        actor: 'Nia Patel',
        activityId: 'repair-sync-001',
        edgeId: 'edge:life-domain-graph-provenance-view-001:repair-sync-001',
        repairType: 'server-synced',
      });

    expect(response.status).toBe(200);
    expect(mockSaveCaseManagementProvenanceLens).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        id: 'life-domain-graph-provenance-view-001',
        activityRecords: expect.arrayContaining([
          expect.objectContaining({
            type: 'opened',
            inspectionType: 'repaired-edge-drilldown',
            inspectedActivityId: 'repair-sync-001',
            inspectedVirtualRelationshipType: 'HAS_REPAIRED_ACTIVITY',
          }),
        ]),
      }),
    );
    expect(response.body.inspectionActivity).toEqual(
      expect.objectContaining({
        type: 'opened',
        inspectionType: 'repaired-edge-drilldown',
        inspectedActivityId: 'repair-sync-001',
      }),
    );
    expect(response.body.neo4jQuery).toEqual(
      expect.objectContaining({
        cypher: expect.stringContaining('MATCH (lens:CaseManagementKnowledge'),
        params: expect.objectContaining({
          lensNodeId: 'graph-provenance-lens:life-domain-graph-provenance-view-001',
          repairedActivityNodeId: 'graph-provenance-lens-activity:repair-sync-001',
          virtualRelationshipType: 'HAS_REPAIRED_ACTIVITY',
        }),
      }),
    );
  });

  it('exports repaired edge inspections as metadata-only audit bundles', async () => {
    mockGetCaseManagementProvenanceLenses.mockResolvedValue([
      {
        lensId: 'life-domain-graph-provenance-view-001',
        name: 'Inspected repair lens',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'manager',
        accessRoles: { 'Nia Patel': 'manager' },
        activityRecords: [
          {
            id: 'repair-sync-001',
            type: 'backfilled',
            repairType: 'server-synced',
            reason: 'Missing server sync activity',
            actor: 'Nia Patel',
            detail: 'Backfilled Neo4j sync activity.',
            createdAt: '2026-05-01T12:12:00.000Z',
          },
          {
            id: 'inspection-001',
            type: 'opened',
            inspectionType: 'repaired-edge-drilldown',
            inspectedActivityId: 'repair-sync-001',
            inspectedEdgeId: 'edge:life-domain-graph-provenance-view-001:repair-sync-001',
            inspectedVirtualRelationshipType: 'HAS_REPAIRED_ACTIVITY',
            repairType: 'server-synced',
            reason: 'Inspection of repaired server-synced provenance activity edge.',
            actor: 'Nia Patel',
            detail: 'Opened repaired server-synced activity edge.',
            createdAt: '2026-05-01T12:13:00.000Z',
          },
        ],
      },
      {
        lensId: 'life-domain-graph-provenance-view-002',
        name: 'Viewer-only inspected repair lens',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'viewer',
        accessRoles: { 'Nia Patel': 'viewer' },
        activityRecords: [
          {
            id: 'inspection-viewer-001',
            type: 'opened',
            inspectionType: 'repaired-edge-drilldown',
            inspectedActivityId: 'repair-viewer-001',
            repairType: 'server-synced',
            actor: 'Nia Patel',
            detail: 'Viewer inspection should not export.',
            createdAt: '2026-05-01T12:14:00.000Z',
          },
        ],
      },
    ]);

    const response = await request(app)
      .get('/api/case-management/wiki/graph/provenance-lenses/activity-inspections/export?actor=Nia%20Patel&repairType=server-synced&format=csv');

    expect(response.status).toBe(200);
    expect(response.body.export).toEqual(
      expect.objectContaining({
        exportType: 'graph-provenance-lens-activity-inspection',
        repairType: 'server-synced',
        lensCount: 1,
        inspectionCount: 1,
      }),
    );
    expect(response.body.content).toContain('inspection_id,lens_id,lens_name');
    expect(response.body.content).toContain('inspection-001');
    expect(response.body.content).toContain('HAS_REPAIRED_ACTIVITY');
    expect(response.body.content).not.toContain('inspection-viewer-001');
    expect(mockCreateCaseManagementProvenanceLensExportAudit).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        actor: 'Nia Patel',
        exportType: 'graph-provenance-lens-activity-inspection',
        format: 'csv',
        lensCount: 1,
        activityCount: 1,
        visibleLensIds: ['life-domain-graph-provenance-view-001'],
      }),
    );
  });

  it('summarizes repaired edge inspections by lens repair type and reviewer', async () => {
    mockGetCaseManagementProvenanceLenses.mockResolvedValue([
      {
        lensId: 'life-domain-graph-provenance-view-001',
        name: 'Inspected repair lens',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'manager',
        accessRoles: { 'Nia Patel': 'manager' },
        activityRecords: [
          {
            id: 'repair-sync-001',
            type: 'backfilled',
            repairType: 'server-synced',
            reason: 'Missing server sync activity',
            actor: 'Nia Patel',
            detail: 'Backfilled Neo4j sync activity.',
            createdAt: '2026-05-01T12:12:00.000Z',
          },
          {
            id: 'inspection-001',
            type: 'opened',
            inspectionType: 'repaired-edge-drilldown',
            inspectedActivityId: 'repair-sync-001',
            inspectedEdgeId: 'edge:life-domain-graph-provenance-view-001:repair-sync-001',
            inspectedVirtualRelationshipType: 'HAS_REPAIRED_ACTIVITY',
            repairType: 'server-synced',
            actor: 'Nia Patel',
            detail: 'Opened repaired server-synced activity edge.',
            createdAt: '2026-05-01T12:13:00.000Z',
          },
          {
            id: 'inspection-002',
            type: 'opened',
            inspectionType: 'repaired-edge-drilldown',
            inspectedActivityId: 'repair-sync-001',
            inspectedEdgeId: 'edge:life-domain-graph-provenance-view-001:repair-sync-001',
            inspectedVirtualRelationshipType: 'HAS_REPAIRED_ACTIVITY',
            repairType: 'server-synced',
            actor: 'Nia Patel',
            detail: 'Reopened repaired server-synced activity edge.',
            createdAt: '2026-05-01T12:14:00.000Z',
          },
          {
            id: 'inspection-other-reviewer-001',
            type: 'opened',
            inspectionType: 'repaired-edge-drilldown',
            inspectedActivityId: 'repair-sync-001',
            inspectedEdgeId: 'edge:life-domain-graph-provenance-view-001:repair-sync-001',
            repairType: 'server-synced',
            actor: 'Omar Williams',
            detail: 'Other reviewer should not be visible to this actor unless shared as manager.',
            createdAt: '2026-05-01T12:15:00.000Z',
          },
        ],
      },
    ]);

    const response = await request(app)
      .get('/api/case-management/wiki/graph/provenance-lenses/activity-inspections/summary?actor=Nia%20Patel&repairType=server-synced');

    expect(response.status).toBe(200);
    expect(response.body.inspectionSummary).toEqual(
      expect.objectContaining({
        actor: 'Nia Patel',
        repairType: 'server-synced',
        summaryCount: 2,
        inspectionCount: 3,
        lensCount: 1,
        reviewerCount: 2,
        repairTypeCount: 1,
      }),
    );
    expect(response.body.inspectionSummary.summaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lensId: 'life-domain-graph-provenance-view-001',
          repairType: 'server-synced',
          reviewer: 'Nia Patel',
          inspectionCount: 2,
          inspectedActivityIds: ['repair-sync-001'],
          relationshipTypes: ['HAS_REPAIRED_ACTIVITY'],
          reviewPattern: 'follow-up-handoff',
        }),
        expect.objectContaining({
          reviewer: 'Omar Williams',
          inspectionCount: 1,
          reviewPattern: 'single-handoff',
        }),
      ]),
    );
  });

  it('builds reviewer workload and escalation follow-ups for repeated repaired edge inspections', async () => {
    mockGetCaseManagementProvenanceLenses.mockResolvedValue([
      {
        lensId: 'life-domain-graph-provenance-view-001',
        name: 'Escalation repair lens',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'manager',
        accessRoles: { 'Nia Patel': 'manager' },
        activityRecords: [
          {
            id: 'repair-sync-001',
            type: 'backfilled',
            repairType: 'server-synced',
            reason: 'Missing server sync activity',
            actor: 'Nia Patel',
            detail: 'Backfilled Neo4j sync activity.',
            createdAt: '2026-05-01T12:12:00.000Z',
          },
          {
            id: 'inspection-001',
            type: 'opened',
            inspectionType: 'repaired-edge-drilldown',
            inspectedActivityId: 'repair-sync-001',
            inspectedEdgeId: 'edge:life-domain-graph-provenance-view-001:repair-sync-001',
            inspectedVirtualRelationshipType: 'HAS_REPAIRED_ACTIVITY',
            repairType: 'server-synced',
            actor: 'Nia Patel',
            detail: 'Opened repaired server-synced activity edge.',
            createdAt: '2026-05-01T12:13:00.000Z',
          },
          {
            id: 'inspection-002',
            type: 'opened',
            inspectionType: 'repaired-edge-drilldown',
            inspectedActivityId: 'repair-sync-001',
            inspectedEdgeId: 'edge:life-domain-graph-provenance-view-001:repair-sync-001',
            inspectedVirtualRelationshipType: 'HAS_REPAIRED_ACTIVITY',
            repairType: 'server-synced',
            actor: 'Nia Patel',
            detail: 'Reopened repaired server-synced activity edge.',
            createdAt: '2026-05-01T12:14:00.000Z',
          },
          {
            id: 'inspection-003',
            type: 'opened',
            inspectionType: 'repaired-edge-drilldown',
            inspectedActivityId: 'repair-sync-001',
            inspectedEdgeId: 'edge:life-domain-graph-provenance-view-001:repair-sync-001',
            inspectedVirtualRelationshipType: 'HAS_REPAIRED_ACTIVITY',
            repairType: 'server-synced',
            actor: 'Nia Patel',
            detail: 'Third repaired edge inspection should trigger escalation.',
            createdAt: '2026-05-01T12:15:00.000Z',
          },
          {
            id: 'repair-shared-001',
            type: 'backfilled',
            repairType: 'shared',
            reason: 'Missing share activity',
            actor: 'Omar Williams',
            detail: 'Backfilled sharing activity.',
            createdAt: '2026-05-01T12:16:00.000Z',
          },
          {
            id: 'inspection-omar-001',
            type: 'opened',
            inspectionType: 'repaired-edge-drilldown',
            inspectedActivityId: 'repair-shared-001',
            inspectedEdgeId: 'edge:life-domain-graph-provenance-view-001:repair-shared-001',
            inspectedVirtualRelationshipType: 'HAS_REPAIRED_ACTIVITY',
            repairType: 'shared',
            actor: 'Omar Williams',
            detail: 'Opened shared repair edge.',
            createdAt: '2026-05-01T12:17:00.000Z',
          },
          {
            id: 'inspection-omar-002',
            type: 'opened',
            inspectionType: 'repaired-edge-drilldown',
            inspectedActivityId: 'repair-shared-001',
            inspectedEdgeId: 'edge:life-domain-graph-provenance-view-001:repair-shared-001',
            inspectedVirtualRelationshipType: 'HAS_REPAIRED_ACTIVITY',
            repairType: 'shared',
            actor: 'Omar Williams',
            detail: 'Second shared repair edge inspection should create a follow-up.',
            createdAt: '2026-05-01T12:18:00.000Z',
          },
        ],
      },
    ]);

    const response = await request(app)
      .get('/api/case-management/wiki/graph/provenance-lenses/activity-inspections/workload?actor=Nia%20Patel&repairType=all');

    expect(response.status).toBe(200);
    expect(response.body.inspectionWorkload).toEqual(
      expect.objectContaining({
        actor: 'Nia Patel',
        repairType: 'all',
        workloadCount: 2,
        openFollowUpCount: 2,
        escalationCount: 1,
        highestEscalation: 'manager-review',
      }),
    );
    expect(response.body.inspectionWorkload.workloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reviewer: 'Nia Patel',
          inspectionCount: 3,
          summaryCount: 1,
          repeatedHandoffCount: 1,
          openFollowUpCount: 1,
          escalationLevel: 'manager-review',
          capacityStatus: 'attention',
          assignedFollowUps: [
            expect.objectContaining({
              assignee: 'Nia Patel',
              lensName: 'Escalation repair lens',
              priority: 'high',
              reviewPattern: 'repeated-handoff',
              inspectionCount: 3,
              relationshipTypes: ['HAS_REPAIRED_ACTIVITY'],
            }),
          ],
        }),
        expect.objectContaining({
          reviewer: 'Omar Williams',
          inspectionCount: 2,
          followUpHandoffCount: 1,
          openFollowUpCount: 1,
          escalationLevel: 'watch',
          assignedFollowUps: [
            expect.objectContaining({
              assignee: 'Omar Williams',
              priority: 'medium',
              reviewPattern: 'follow-up-handoff',
            }),
          ],
        }),
      ]),
    );
  });

  it('persists Case Wiki inspection follow-up tasks into the workspace with audit history', async () => {
    mockGetCaseManagementWorkspace.mockResolvedValue({
      version: 1,
      savedAt: '2026-05-01T11:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-01T11:00:00.000Z',
        caseRecords: [],
        taskRecords: [
          {
            id: 'task-existing',
            title: 'Existing follow-up',
            dependency: 'case-wiki-inspection-follow-up:inspection-follow-up:existing',
            status: 'open',
          },
        ],
        noteRecords: [],
        timelineRecords: [],
        auditRecords: [],
      },
    });

    const response = await request(app)
      .post('/api/case-management/wiki/inspection-follow-up-tasks')
      .send({
        tasks: [
          {
            id: 'task-inspection-follow-up-escalation',
            title: 'Escalate repeated repaired-edge handoff for Escalation repair lens',
            clientId: 'client-001',
            caseId: 'case-001',
            owner: 'Nia Patel',
            dueDate: '2026-05-02T12:18:00.000Z',
            priority: 'high',
            status: 'open',
            reminderRules: 'Immediate and morning of due date',
            dependency: 'case-wiki-inspection-follow-up:inspection-follow-up:summary-001',
            notes: 'Manager assignment: Joel Zola -> Nia Patel',
          },
          {
            id: 'task-existing',
            title: 'Existing follow-up',
            dependency: 'case-wiki-inspection-follow-up:inspection-follow-up:existing',
          },
        ],
        timelineRecords: [
          {
            id: 'tl-task-inspection-follow-up-escalation-created',
            clientId: 'client-001',
            caseId: 'case-001',
            occurredAt: '2026-05-01T12:30:00.000Z',
            type: 'task created',
            title: 'Escalate repeated repaired-edge handoff for Escalation repair lens',
            detail: 'Case Wiki inspection follow-up assigned to Nia Patel.',
          },
        ],
        auditRecords: [
          {
            id: 'audit-task-inspection-follow-up-escalation-created',
            actor: 'Joel Zola',
            action: 'assigned case wiki inspection follow-up',
            object: 'Escalate repeated repaired-edge handoff for Escalation repair lens',
            timestamp: '2026-05-01T12:30:00.000Z',
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.createdCount).toBe(1);
    expect(response.body.skippedCount).toBe(1);
    expect(mockSaveCaseManagementWorkspace).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        taskRecords: expect.arrayContaining([
          expect.objectContaining({
            id: 'task-inspection-follow-up-escalation',
            dependency: 'case-wiki-inspection-follow-up:inspection-follow-up:summary-001',
            owner: 'Nia Patel',
            priority: 'high',
          }),
          expect.objectContaining({ id: 'task-existing' }),
        ]),
        timelineRecords: expect.arrayContaining([
          expect.objectContaining({ id: 'tl-task-inspection-follow-up-escalation-created' }),
        ]),
        auditRecords: expect.arrayContaining([
          expect.objectContaining({
            id: 'audit-task-inspection-follow-up-escalation-created',
            action: 'assigned case wiki inspection follow-up',
          }),
        ]),
      }),
    );
  });

  it('persists completion state for Case Wiki inspection follow-up tasks', async () => {
    mockGetCaseManagementWorkspace.mockResolvedValue({
      version: 1,
      savedAt: '2026-05-01T11:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-01T11:00:00.000Z',
        caseRecords: [],
        taskRecords: [
          {
            id: 'task-inspection-follow-up-escalation',
            title: 'Escalate repeated repaired-edge handoff for Escalation repair lens',
            clientId: 'client-001',
            caseId: 'case-001',
            owner: 'Nia Patel',
            dependency: 'case-wiki-inspection-follow-up:inspection-follow-up:summary-001',
            status: 'open',
          },
        ],
        noteRecords: [],
        timelineRecords: [],
        auditRecords: [],
      },
    });

    const response = await request(app)
      .patch('/api/case-management/wiki/inspection-follow-up-tasks/task-inspection-follow-up-escalation')
      .send({
        status: 'complete',
        completedAt: '2026-05-01T13:00:00.000Z',
        timelineRecord: {
          id: 'tl-task-inspection-follow-up-escalation-complete',
          clientId: 'client-001',
          caseId: 'case-001',
          occurredAt: '2026-05-01T13:00:00.000Z',
          type: 'task completed',
          title: 'Escalate repeated repaired-edge handoff for Escalation repair lens',
          detail: 'Nia Patel marked this Case Wiki inspection follow-up complete.',
        },
        auditRecord: {
          id: 'audit-task-inspection-follow-up-escalation-complete',
          actor: 'Nia Patel',
          action: 'completed case wiki inspection follow-up',
          object: 'Escalate repeated repaired-edge handoff for Escalation repair lens',
          timestamp: '2026-05-01T13:00:00.000Z',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.taskRecord).toEqual(
      expect.objectContaining({
        id: 'task-inspection-follow-up-escalation',
        status: 'complete',
        completedAt: '2026-05-01T13:00:00.000Z',
      }),
    );
    expect(mockSaveCaseManagementWorkspace).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        taskRecords: [
          expect.objectContaining({
            id: 'task-inspection-follow-up-escalation',
            status: 'complete',
            completedAt: '2026-05-01T13:00:00.000Z',
          }),
        ],
        timelineRecords: expect.arrayContaining([
          expect.objectContaining({ id: 'tl-task-inspection-follow-up-escalation-complete' }),
        ]),
        auditRecords: expect.arrayContaining([
          expect.objectContaining({
            id: 'audit-task-inspection-follow-up-escalation-complete',
            action: 'completed case wiki inspection follow-up',
          }),
        ]),
      }),
    );
  });

  it('persists manager reconciliation audit records for Case Wiki follow-up tasks', async () => {
    mockGetCaseManagementWorkspace.mockResolvedValue({
      version: 1,
      savedAt: '2026-05-01T11:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-01T11:00:00.000Z',
        caseRecords: [],
        taskRecords: [
          {
            id: 'task-inspection-follow-up-stale',
            title: 'Review stale repaired-edge handoff',
            clientId: 'client-001',
            caseId: 'case-001',
            owner: 'Nia Patel',
            dependency: 'case-wiki-inspection-follow-up:inspection-follow-up:stale-001',
            status: 'open',
          },
        ],
        noteRecords: [],
        timelineRecords: [],
        auditRecords: [],
      },
    });

    const response = await request(app)
      .patch('/api/case-management/wiki/inspection-follow-up-tasks/task-inspection-follow-up-stale')
      .send({
        status: 'complete',
        completedAt: '2026-05-01T14:00:00.000Z',
        auditRecord: {
          id: 'audit-task-inspection-follow-up-stale-complete',
          actor: 'Nia Patel',
          action: 'completed case wiki inspection follow-up',
          object: 'Review stale repaired-edge handoff',
          timestamp: '2026-05-01T14:00:00.000Z',
        },
        auditRecords: [
          {
            id: 'audit-case-wiki-follow-up-reconciliation-stale',
            actor: 'Joel Zola',
            action: 'case wiki follow-up reconciliation: completed stale task',
            object: 'Review stale repaired-edge handoff',
            timestamp: '2026-05-01T14:00:00.000Z',
            category: 'case-wiki-follow-up-reconciliation',
            kind: 'CaseWikiFollowUpTaskReconciliation',
            status: 'stale-task',
            decision: 'completed-stale-task',
            detail: 'Manager completed a stale task that no longer appears in the live repaired-edge workload.',
            taskId: 'task-inspection-follow-up-stale',
            followUpId: 'inspection-follow-up:stale-001',
            lensId: 'life-domain-graph-provenance-view-001',
            repairType: 'backfilled',
            reviewPattern: 'repeated-handoff',
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(mockSaveCaseManagementWorkspace).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        auditRecords: expect.arrayContaining([
          expect.objectContaining({
            id: 'audit-task-inspection-follow-up-stale-complete',
            action: 'completed case wiki inspection follow-up',
          }),
          expect.objectContaining({
            id: 'audit-case-wiki-follow-up-reconciliation-stale',
            category: 'case-wiki-follow-up-reconciliation',
            kind: 'CaseWikiFollowUpTaskReconciliation',
            status: 'stale-task',
            decision: 'completed-stale-task',
            taskId: 'task-inspection-follow-up-stale',
            followUpId: 'inspection-follow-up:stale-001',
          }),
        ]),
      }),
    );
    expect(response.body.auditRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'audit-case-wiki-follow-up-reconciliation-stale',
          action: 'case wiki follow-up reconciliation: completed stale task',
        }),
      ]),
    );
  });

  it('loads manager-filtered Case Wiki follow-up reconciliation history', async () => {
    mockGetCaseManagementWorkspace.mockResolvedValue({
      version: 1,
      savedAt: '2026-05-01T11:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-01T11:00:00.000Z',
        auditRecords: [
          {
            id: 'audit-case-wiki-follow-up-reconciliation-stale',
            actor: 'Joel Zola',
            action: 'case wiki follow-up reconciliation: completed stale task',
            object: 'Review stale repaired-edge handoff',
            timestamp: '2026-05-01T14:00:00.000Z',
            category: 'case-wiki-follow-up-reconciliation',
            kind: 'CaseWikiFollowUpTaskReconciliation',
            status: 'stale-task',
            decision: 'completed-stale-task',
            taskId: 'task-inspection-follow-up-stale',
          },
          {
            id: 'audit-case-wiki-follow-up-reconciliation-missing',
            actor: 'Nia Patel',
            action: 'case wiki follow-up reconciliation: created missing task',
            object: 'Create missing repaired-edge task',
            timestamp: '2026-05-01T13:00:00.000Z',
            category: 'case-wiki-follow-up-reconciliation',
            kind: 'CaseWikiFollowUpTaskReconciliation',
            status: 'missing-task',
            decision: 'created-missing-task',
          },
        ],
      },
    });

    const response = await request(app)
      .get('/api/case-management/wiki/inspection-follow-up-reconciliations?actor=Joel%20Zola&status=stale-task&decision=completed-stale-task');

    expect(response.status).toBe(200);
    expect(response.body.reconciliationHistory).toEqual([
      expect.objectContaining({
        id: 'audit-case-wiki-follow-up-reconciliation-stale',
        actor: 'Joel Zola',
        status: 'stale-task',
        decision: 'completed-stale-task',
      }),
    ]);
    expect(response.body.stats).toEqual(
      expect.objectContaining({
        missing: 1,
        stale: 1,
        createdMissing: 1,
        completedStale: 1,
      }),
    );
  });

  it('syncs Case Wiki follow-up reconciliation history into a Neo4j review node', async () => {
    mockGetCaseManagementWorkspace.mockResolvedValue({
      version: 1,
      savedAt: '2026-05-01T11:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-01T11:00:00.000Z',
        auditRecords: [
          {
            id: 'audit-case-wiki-follow-up-reconciliation-stale',
            actor: 'Joel Zola',
            action: 'case wiki follow-up reconciliation: completed stale task',
            object: 'Review stale repaired-edge handoff',
            timestamp: '2026-05-01T14:00:00.000Z',
            category: 'case-wiki-follow-up-reconciliation',
            kind: 'CaseWikiFollowUpTaskReconciliation',
            status: 'stale-task',
            decision: 'completed-stale-task',
            taskId: 'task-inspection-follow-up-stale',
            followUpId: 'inspection-follow-up:stale-001',
            lensId: 'life-domain-graph-provenance-view-001',
          },
        ],
      },
    });

    const response = await request(app)
      .post('/api/case-management/wiki/inspection-follow-up-reconciliations/audit-case-wiki-follow-up-reconciliation-stale/graph-review')
      .send({ reviewer: 'Joel Zola' });

    expect(response.status).toBe(200);
    expect(mockBuildCaseWikiFollowUpTaskReconciliationReviewGraph).toHaveBeenCalledWith({
      userId: 'test-user-123',
      reviewer: 'Joel Zola',
      auditRecord: expect.objectContaining({
        id: 'audit-case-wiki-follow-up-reconciliation-stale',
        decision: 'completed-stale-task',
      }),
    });
    expect(mockWriteCaseWikiGraphToNeo4j).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ kind: 'CaseWikiFollowUpTaskReconciliationReview' }),
        ]),
        edges: expect.arrayContaining([
          expect.objectContaining({ kind: 'HAS_FOLLOW_UP_RECONCILIATION_REVIEW' }),
        ]),
      }),
    );
    expect(response.body.followUpReconciliationReview).toEqual(
      expect.objectContaining({
        nodeId: 'case-wiki-follow-up-reconciliation-review:follow-up-reconciliation-review-001',
        neo4jStatus: 'written',
      }),
    );
  });

  it('saves provenance lenses to Mongo and writes a Neo4j lens node', async () => {
    const lens = {
      id: 'life-domain-graph-provenance-view-001',
      name: 'Approved graph lens',
      query: 'graph',
      reviewFilter: 'approved',
      domainFilter: 'all',
      browserScope: 'all-domains',
      resultCount: 1,
      matchingWorkspaceCount: 1,
      createdAt: '2026-05-01T12:00:00.000Z',
      updatedAt: '2026-05-01T12:00:00.000Z',
      createdBy: 'Joel Zola',
      visibility: 'team',
      sharedWith: ['Nia Patel'],
      accessRole: 'editor',
      accessRoles: { 'Nia Patel': 'editor' },
      activityRecords: [
        {
          id: 'activity-001',
          type: 'shared',
          actor: 'Joel Zola',
          detail: 'Shared with Nia Patel as editor.',
          createdAt: '2026-05-01T12:04:00.000Z',
        },
      ],
    };

    const response = await request(app)
      .post('/api/case-management/wiki/graph/provenance-lenses')
      .send({ lens });

    expect(response.status).toBe(200);
    expect(mockBuildCaseWikiGraphProvenanceLensGraph).toHaveBeenCalledWith({ lens, userId: 'test-user-123' });
    expect(mockWriteCaseWikiGraphToNeo4j).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ kind: 'GraphProvenanceLens' }),
        ]),
      }),
    );
    expect(mockSaveCaseManagementProvenanceLens).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        id: 'life-domain-graph-provenance-view-001',
        neo4jNodeId: 'graph-provenance-lens:life-domain-graph-provenance-view-001',
        neo4jStatus: 'written',
        accessRole: 'editor',
      }),
    );
    expect(response.body.provenanceLens).toEqual(
      expect.objectContaining({
        id: 'life-domain-graph-provenance-view-001',
        neo4jStatus: 'written',
      }),
    );
  });

  it('deletes a saved provenance lens by id', async () => {
    mockGetCaseManagementProvenanceLens.mockResolvedValueOnce({
      lensId: 'life-domain-graph-provenance-view-001',
      name: 'Approved graph lens',
      createdBy: 'Joel Zola',
      visibility: 'team',
      sharedWith: ['Nia Patel'],
      accessRole: 'editor',
      accessRoles: { 'Nia Patel': 'editor' },
    });

    const response = await request(app)
      .delete('/api/case-management/wiki/graph/provenance-lenses/life-domain-graph-provenance-view-001');

    expect(response.status).toBe(200);
    expect(mockDeleteCaseManagementProvenanceLens).toHaveBeenCalledWith(
      'test-user-123',
      'life-domain-graph-provenance-view-001',
    );
    expect(response.body.deleted).toBe(true);
  });

  it('blocks viewer-only provenance lens updates server-side', async () => {
    mockGetCaseManagementProvenanceLens.mockResolvedValueOnce({
      lensId: 'life-domain-graph-provenance-view-001',
      name: 'Approved graph lens',
      query: 'graph',
      reviewFilter: 'approved',
      domainFilter: 'all',
      browserScope: 'all-domains',
      createdBy: 'Joel Zola',
      visibility: 'team',
      sharedWith: ['Nia Patel'],
      accessRole: 'viewer',
      accessRoles: { 'Nia Patel': 'viewer' },
    });

    const response = await request(app)
      .post('/api/case-management/wiki/graph/provenance-lenses')
      .send({
        actor: 'Nia Patel',
        lens: {
          id: 'life-domain-graph-provenance-view-001',
          name: 'Viewer edit attempt',
          query: 'graph',
          reviewFilter: 'approved',
          domainFilter: 'all',
          browserScope: 'all-domains',
          createdBy: 'Joel Zola',
          visibility: 'team',
          sharedWith: ['Nia Patel'],
          accessRole: 'viewer',
          accessRoles: { 'Nia Patel': 'viewer' },
        },
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('editor access');
    expect(mockBuildCaseWikiGraphProvenanceLensGraph).not.toHaveBeenCalled();
    expect(mockSaveCaseManagementProvenanceLens).not.toHaveBeenCalled();
  });

  it('blocks editor provenance lens sharing changes server-side', async () => {
    mockGetCaseManagementProvenanceLens.mockResolvedValueOnce({
      lensId: 'life-domain-graph-provenance-view-001',
      name: 'Approved graph lens',
      query: 'graph',
      reviewFilter: 'approved',
      domainFilter: 'all',
      browserScope: 'all-domains',
      createdBy: 'Joel Zola',
      visibility: 'team',
      sharedWith: ['Nia Patel'],
      accessRole: 'editor',
      accessRoles: { 'Nia Patel': 'editor' },
    });

    const response = await request(app)
      .post('/api/case-management/wiki/graph/provenance-lenses')
      .send({
        actor: 'Nia Patel',
        lens: {
          id: 'life-domain-graph-provenance-view-001',
          name: 'Editor sharing attempt',
          query: 'graph',
          reviewFilter: 'approved',
          domainFilter: 'all',
          browserScope: 'all-domains',
          createdBy: 'Joel Zola',
          visibility: 'team',
          sharedWith: ['Nia Patel', 'Omar Williams'],
          accessRole: 'editor',
          accessRoles: { 'Nia Patel': 'editor', 'Omar Williams': 'viewer' },
        },
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('manager access');
    expect(mockBuildCaseWikiGraphProvenanceLensGraph).not.toHaveBeenCalled();
    expect(mockSaveCaseManagementProvenanceLens).not.toHaveBeenCalled();
  });

  it('blocks non-manager provenance lens deletion server-side', async () => {
    mockGetCaseManagementProvenanceLens.mockResolvedValueOnce({
      lensId: 'life-domain-graph-provenance-view-001',
      name: 'Approved graph lens',
      createdBy: 'Joel Zola',
      visibility: 'team',
      sharedWith: ['Nia Patel'],
      accessRole: 'editor',
      accessRoles: { 'Nia Patel': 'editor' },
    });

    const response = await request(app)
      .delete('/api/case-management/wiki/graph/provenance-lenses/life-domain-graph-provenance-view-001?actor=Nia%20Patel');

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('manager access');
    expect(mockDeleteCaseManagementProvenanceLens).not.toHaveBeenCalled();
  });

  it('requires an explicit reviewed target before attaching a source to a live record', async () => {
    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/archive')
      .send({ action: 'attach-to-record' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Choose a valid client, case, service, or project target before attaching this source');
    expect(mockUpdateCaseManagementWikiIngestionReview).not.toHaveBeenCalled();
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('attaches reviewed sources to records and writes only the reviewed graph edge', async () => {
    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/archive')
      .send({
        action: 'attach-to-record',
        target: {
          targetType: 'service',
          targetId: '15420',
          targetLabel: 'Toronto Harbour Light',
          targetHref: '/directory/services/15420',
        },
      });

    expect(response.status).toBe(200);
    expect(mockUpdateCaseManagementWikiIngestionReview).toHaveBeenCalledWith(
      'test-user-123',
      'source-001',
      expect.objectContaining({
        sourceScope: 'current-record',
        linkedServiceName: 'Toronto Harbour Light',
        sourcePageId: 'service:15420',
        'generatedRecords.frontendRecord.sourceScope': 'current-record',
        'generatedRecords.frontendRecord.linkedServiceName': 'Toronto Harbour Light',
      }),
    );
    expect(response.body.wikiIngestionRecord.archive.attachmentTarget).toEqual(
      expect.objectContaining({
        targetType: 'service',
        targetId: '15420',
        targetLabel: 'Toronto Harbour Light',
      }),
    );
    expect(mockWriteCaseWikiGraphToNeo4j).toHaveBeenCalledWith(
      expect.objectContaining({
        edges: expect.arrayContaining([
          expect.objectContaining({ kind: 'ABOUT_SERVICE' }),
        ]),
      }),
    );
  });

  it('persists relationship review decisions and writes a Neo4j review layer', async () => {
    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/relationship-review')
      .send({
        status: 'approved',
        relationshipKey: 'source-001::mentions::systems innovation lab::mentions::partner network',
        relationship: {
          from: 'Systems Innovation Lab',
          to: 'Partner Network',
          fromNodeId: 'entity:systems-innovation-lab',
          toNodeId: 'entity:partner-network',
          kind: 'MENTIONS',
          label: 'mentions',
        },
      });

    expect(response.status).toBe(200);
    const updates = mockUpdateCaseManagementWikiIngestionReview.mock.calls[0][2];
    expect(updates.relationshipReviewRecords).toEqual([
      expect.objectContaining({
        sourceId: 'source-001',
        relationshipKey: 'source-001::mentions::systems innovation lab::mentions::partner network',
        from: 'Systems Innovation Lab',
        to: 'Partner Network',
        kind: 'MENTIONS',
        status: 'approved',
      }),
    ]);
    expect(updates['generatedRecords.frontendRecord.relationshipReviewRecords']).toBe(updates.relationshipReviewRecords);
    expect(updates['generatedRecords.auditRecords']).toEqual([
      expect.objectContaining({
        action: 'approved graph relationship',
      }),
    ]);
    expect(mockWriteCaseWikiGraphToNeo4j).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ kind: 'RelationshipReviewDecision' }),
          expect.objectContaining({ id: 'entity:systems-innovation-lab' }),
          expect.objectContaining({ id: 'entity:partner-network' }),
        ]),
        edges: expect.arrayContaining([
          expect.objectContaining({ kind: 'HAS_RELATIONSHIP_REVIEW' }),
          expect.objectContaining({ kind: 'APPROVED_RELATIONSHIP' }),
        ]),
      }),
    );
    expect(response.body.relationshipReviewRecord).toEqual(
      expect.objectContaining({
        status: 'approved',
        relationshipKey: 'source-001::mentions::systems innovation lab::mentions::partner network',
      }),
    );
    expect(response.body.wikiIngestionRecord.relationshipReviewRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'approved',
        }),
      ]),
    );
  });

  it('batch persists relationship review decisions and writes one Neo4j review layer', async () => {
    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/relationship-review/batch')
      .send({
        status: 'rejected',
        relationships: [
          {
            relationshipKey: 'source-001::mentions::systems innovation lab::mentions::partner network',
            relationship: {
              from: 'Systems Innovation Lab',
              to: 'Partner Network',
              fromNodeId: 'entity:systems-innovation-lab',
              toNodeId: 'entity:partner-network',
              kind: 'MENTIONS',
              label: 'mentions',
            },
          },
          {
            relationship: {
              from: 'Systems Innovation Partner List',
              to: 'Whole-life source documents',
              kind: 'PART_OF_ARCHIVE',
              label: 'part of archive',
            },
          },
        ],
      });

    expect(response.status).toBe(200);
    const updates = mockUpdateCaseManagementWikiIngestionReview.mock.calls[0][2];
    expect(updates.relationshipReviewRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relationshipKey: 'source-001::mentions::systems innovation lab::mentions::partner network',
          status: 'rejected',
        }),
        expect.objectContaining({
          from: 'Systems Innovation Partner List',
          to: 'Whole-life source documents',
          kind: 'PART_OF_ARCHIVE',
          status: 'rejected',
        }),
      ]),
    );
    expect(updates['generatedRecords.frontendRecord.relationshipReviewRecords']).toBe(updates.relationshipReviewRecords);
    expect(updates['generatedRecords.auditRecords']).toHaveLength(2);
    expect(mockWriteCaseWikiGraphToNeo4j).toHaveBeenCalledTimes(1);
    expect(mockWriteCaseWikiGraphToNeo4j).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ kind: 'RelationshipReviewDecision' }),
        ]),
        edges: expect.arrayContaining([
          expect.objectContaining({ kind: 'REJECTED_RELATIONSHIP' }),
        ]),
      }),
    );
    expect(response.body.relationshipReviewRecords).toHaveLength(2);
    expect(response.body.wikiIngestionRecord.relationshipReviewRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'rejected' }),
      ]),
    );
  });

  it('syncs graph workspace audit review decisions into Neo4j', async () => {
    const response = await request(app)
      .post('/api/case-management/wiki/graph/workspaces/reviews')
      .send({
        decision: {
          id: 'graph-workspace-audit-review-001',
          auditId: 'graph-workspace-audit:abc123',
          workspaceId: 'life-domain-graph-001',
          workspaceName: 'Housing archive review',
          status: 'approved',
          note: 'Approved for manager reporting.',
          reviewer: 'Joel Zola',
          reviewedAt: '2026-05-01T12:00:00.000Z',
        },
      });

    expect(response.status).toBe(200);
    expect(mockBuildCaseWikiGraphWorkspaceReviewGraph).toHaveBeenCalledWith({
      userId: 'test-user-123',
      decision: expect.objectContaining({
        auditId: 'graph-workspace-audit:abc123',
        workspaceId: 'life-domain-graph-001',
        status: 'approved',
      }),
    });
    expect(mockWriteCaseWikiGraphToNeo4j).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ kind: 'GraphWorkspaceReview' }),
        ]),
        edges: expect.arrayContaining([
          expect.objectContaining({ kind: 'HAS_WORKSPACE_REVIEW' }),
        ]),
      }),
    );
    expect(response.body.graphWorkspaceReview).toEqual(
      expect.objectContaining({
        nodeId: 'graph-workspace-review:graph-workspace-audit-review-001',
        neo4jStatus: 'written',
      }),
    );
  });

  it('marks a source do-not-embed when archive review excludes it from embedding', async () => {
    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/archive')
      .send({ action: 'exclude-from-embedding' });

    expect(response.status).toBe(200);
    const updates = mockUpdateCaseManagementWikiIngestionReview.mock.calls[0][2];
    expect(updates.archive.cleanupDecision).toEqual(
      expect.objectContaining({
        status: 'excluded-from-embedding',
        nonDestructive: true,
      }),
    );
    expect(updates.embeddingReview.chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'embedding:source-001:1',
          status: 'do-not-embed',
          embeddingAction: 'do-not-embed',
        }),
      ]),
    );
    expect(response.body.wikiIngestionRecord.embeddingReview.status).toBe('blocked');
  });

  it('approves a reviewed source chunk and prepares only a Weaviate dry-run preview', async () => {
    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/embedding-review')
      .send({ action: 'approve-chunk', chunkId: 'embedding:source-001:1' });

    expect(response.status).toBe(200);
    expect(mockPrepareCaseWikiWeaviateDryRun).toHaveBeenCalledWith({
      ingestion: expect.objectContaining({ fileId: 'source-001' }),
      embeddingReview: expect.objectContaining({
        status: 'ready-for-vector-dry-run',
        approvedCount: 1,
        pendingCount: 0,
        chunks: expect.arrayContaining([
          expect.objectContaining({
            id: 'embedding:source-001:1',
            status: 'approved-for-embedding',
            embeddingAction: 'approved-for-embedding',
          }),
        ]),
      }),
    });
    expect(mockBuildCaseWikiEmbeddingReviewGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        ingestion: expect.objectContaining({ fileId: 'source-001' }),
        embeddingReview: expect.objectContaining({ status: 'ready-for-vector-dry-run' }),
        weaviateDryRun: expect.objectContaining({ status: 'prepared', objectCount: 1 }),
        action: 'approve-chunk',
      }),
    );
    expect(mockWriteCaseWikiGraphToNeo4j).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ kind: 'EmbeddingReview' })]),
        edges: expect.arrayContaining([expect.objectContaining({ kind: 'READY_FOR_INDEX' })]),
      }),
    );
    const updates = mockUpdateCaseManagementWikiIngestionReview.mock.calls[0][2];
    expect(updates.embeddingReview).toEqual(
      expect.objectContaining({
        status: 'ready-for-vector-dry-run',
        writeEnabled: false,
        weaviateDryRun: expect.objectContaining({ status: 'prepared', objectCount: 1 }),
        graphSync: expect.objectContaining({ status: 'written', reviewNodeId: 'embedding-review:source-001' }),
      }),
    );
    expect(updates.weaviateDryRun).toEqual(expect.objectContaining({ status: 'prepared', objectCount: 1 }));
    expect(response.body.wikiIngestionRecord.embeddingReview.status).toBe('ready-for-vector-dry-run');
    expect(response.body.weaviateDryRun).toEqual(expect.objectContaining({ status: 'prepared', objectCount: 1 }));
    expect(response.body.neo4j).toEqual(expect.objectContaining({ status: 'written' }));
  });

  it('refreshes the embedding review Neo4j graph without changing chunk decisions or writing vectors', async () => {
    wikiIngestions = [
      makeIngestion({
        embeddingReview: {
          status: 'ready-for-vector-dry-run',
          approvedCount: 1,
          pendingCount: 0,
          rejectedCount: 0,
          chunks: [
            {
              id: 'embedding:source-001:1',
              status: 'approved-for-embedding',
              embeddingAction: 'approved-for-embedding',
              textPreview: 'Systems Innovation Lab partner list and follow-up notes.',
            },
          ],
        },
        weaviateDryRun: {
          status: 'prepared',
          provider: 'weaviate',
          collection: 'CaseWikiSourceChunk',
          objectCount: 1,
        },
      }),
    ];

    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/embedding-review')
      .send({ action: 'sync-embedding-graph' });

    expect(response.status).toBe(200);
    expect(mockPrepareCaseWikiWeaviateDryRun).not.toHaveBeenCalled();
    expect(mockWriteCaseWikiApprovedChunksToWeaviate).not.toHaveBeenCalled();
    expect(mockBuildCaseWikiEmbeddingReviewGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        ingestion: expect.objectContaining({ fileId: 'source-001' }),
        embeddingReview: expect.objectContaining({
          status: 'ready-for-vector-dry-run',
          approvedCount: 1,
          pendingCount: 0,
          chunks: expect.arrayContaining([
            expect.objectContaining({
              id: 'embedding:source-001:1',
              status: 'approved-for-embedding',
            }),
          ]),
        }),
        weaviateDryRun: expect.objectContaining({ status: 'prepared', objectCount: 1 }),
        action: 'sync-embedding-graph',
      }),
    );
    expect(mockWriteCaseWikiGraphToNeo4j).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ kind: 'EmbeddingReview' })]),
        edges: expect.arrayContaining([expect.objectContaining({ kind: 'READY_FOR_INDEX' })]),
      }),
    );
    const updates = mockUpdateCaseManagementWikiIngestionReview.mock.calls[0][2];
    expect(updates.embeddingReview).toEqual(
      expect.objectContaining({
        status: 'ready-for-vector-dry-run',
        graphSync: expect.objectContaining({
          status: 'written',
          reviewNodeId: 'embedding-review:source-001',
          vectorIndexNodeId: 'vector-index:weaviate:case-wiki-source-chunk',
        }),
        chunks: expect.arrayContaining([
          expect.objectContaining({
            id: 'embedding:source-001:1',
            status: 'approved-for-embedding',
          }),
        ]),
      }),
    );
    expect(updates.vectorIndex).toBeUndefined();
    expect(response.body.wikiIngestionRecord.embeddingReview.graphSync).toEqual(
      expect.objectContaining({ status: 'written' }),
    );
    expect(response.body.weaviateDryRun).toEqual(expect.objectContaining({ status: 'prepared', objectCount: 1 }));
    expect(response.body.neo4j).toEqual(expect.objectContaining({ status: 'written' }));
  });

  it('marks a reviewed source chunk do-not-embed without preparing Weaviate objects', async () => {
    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/embedding-review')
      .send({ action: 'skip-chunk', chunkId: 'embedding:source-001:1' });

    expect(response.status).toBe(200);
    expect(mockPrepareCaseWikiWeaviateDryRun).not.toHaveBeenCalled();
    const updates = mockUpdateCaseManagementWikiIngestionReview.mock.calls[0][2];
    expect(updates.embeddingReview).toEqual(
      expect.objectContaining({
        status: 'blocked',
        rejectedCount: 1,
        pendingCount: 0,
        weaviateDryRun: null,
        chunks: expect.arrayContaining([
          expect.objectContaining({
            id: 'embedding:source-001:1',
            status: 'do-not-embed',
            embeddingAction: 'do-not-embed',
          }),
        ]),
      }),
    );
    expect(updates.weaviateDryRun).toBeNull();
    expect(response.body.wikiIngestionRecord.embeddingReview.status).toBe('blocked');
    expect(response.body.weaviateDryRun).toBeNull();
  });

  it('batch approves only selected reviewed chunks and leaves unselected chunks pending', async () => {
    wikiIngestions = [
      makeIngestion({
        embeddingReview: {
          status: 'awaiting-review',
          chunks: [
            {
              id: 'embedding:source-001:1',
              status: 'pending-review',
              embeddingAction: 'pending-review',
              textPreview: 'Approved source paragraph.',
            },
            {
              id: 'embedding:source-001:2',
              status: 'pending-review',
              embeddingAction: 'pending-review',
              textPreview: 'Still waiting for human review.',
            },
          ],
        },
      }),
    ];

    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/embedding-review')
      .send({ action: 'approve-chunks', chunkIds: ['embedding:source-001:1'] });

    expect(response.status).toBe(200);
    expect(mockPrepareCaseWikiWeaviateDryRun).not.toHaveBeenCalled();
    const updates = mockUpdateCaseManagementWikiIngestionReview.mock.calls[0][2];
    expect(updates.embeddingReview).toEqual(
      expect.objectContaining({
        status: 'awaiting-review',
        approvedCount: 1,
        pendingCount: 1,
        chunks: [
          expect.objectContaining({
            id: 'embedding:source-001:1',
            status: 'approved-for-embedding',
          }),
          expect.objectContaining({
            id: 'embedding:source-001:2',
            status: 'pending-review',
          }),
        ],
      }),
    );
    expect(updates.weaviateDryRun).toBeNull();
  });

  it('edits one embedding chunk and resets that chunk to pending review', async () => {
    wikiIngestions = [
      makeIngestion({
        embeddingReview: {
          status: 'ready-for-vector-dry-run',
          approvedCount: 1,
          pendingCount: 0,
          rejectedCount: 0,
          writeMode: 'dry-run',
          chunks: [
            {
              id: 'embedding:source-001:1',
              status: 'approved-for-embedding',
              embeddingAction: 'approved-for-embedding',
              textPreview: 'Original text that had already been approved.',
              privacyLevel: 'personal',
              redactionMode: 'strict',
            },
          ],
        },
      }),
    ];

    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/embedding-review')
      .send({
        action: 'update-chunk',
        chunkId: 'embedding:source-001:1',
        textPreview: 'Redacted and corrected source text for review.',
        reviewNote: 'Removed personal detail before embedding.',
        privacyLevel: 'private',
        redactionMode: 'strict',
      });

    expect(response.status).toBe(200);
    expect(mockPrepareCaseWikiWeaviateDryRun).not.toHaveBeenCalled();
    const updates = mockUpdateCaseManagementWikiIngestionReview.mock.calls[0][2];
    expect(updates.embeddingReview).toEqual(
      expect.objectContaining({
        status: 'awaiting-review',
        approvedCount: 0,
        pendingCount: 1,
        weaviateDryRun: null,
        chunks: [
          expect.objectContaining({
            id: 'embedding:source-001:1',
            status: 'pending-review',
            embeddingAction: 'pending-review',
            textPreview: 'Redacted and corrected source text for review.',
            reviewNote: 'Removed personal detail before embedding.',
            privacyLevel: 'private',
            redactionMode: 'strict',
            editedBy: 'Current worker',
          }),
        ],
      }),
    );
    expect(updates.weaviateDryRun).toBeNull();
  });

  it('keeps live Weaviate writes blocked without explicit vector confirmation', async () => {
    wikiIngestions = [
      makeIngestion({
        embeddingReview: {
          status: 'ready-for-vector-dry-run',
          approvedCount: 1,
          pendingCount: 0,
          rejectedCount: 0,
          chunkCount: 1,
          chunks: [
            {
              id: 'embedding:source-001:1',
              status: 'approved-for-embedding',
              embeddingAction: 'approved-for-embedding',
              textPreview: 'Approved source paragraph.',
            },
          ],
        },
      }),
    ];
    mockWriteCaseWikiApprovedChunksToWeaviate.mockResolvedValueOnce({
      status: 'confirmation-required',
      objectCount: 0,
      message: 'Confirm the reviewed chunk list before writing approved chunks to Weaviate.',
      warnings: ['confirmation-required'],
    });

    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/embedding-review')
      .send({ action: 'write-approved-chunks' });

    expect(response.status).toBe(409);
    expect(mockWriteCaseWikiApprovedChunksToWeaviate).toHaveBeenCalledWith(
      expect.objectContaining({
        ingestion: expect.objectContaining({ fileId: 'source-001' }),
        confirmWrite: false,
      }),
    );
    expect(mockUpdateCaseManagementWikiIngestionReview).not.toHaveBeenCalled();
  });

  it('persists live Weaviate write metadata after confirmed approved-chunk write', async () => {
    wikiIngestions = [
      makeIngestion({
        embeddingReview: {
          status: 'ready-for-vector-dry-run',
          approvedCount: 1,
          pendingCount: 0,
          rejectedCount: 0,
          chunkCount: 1,
          chunks: [
            {
              id: 'embedding:source-001:1',
              status: 'approved-for-embedding',
              embeddingAction: 'approved-for-embedding',
              textPreview: 'Approved source paragraph.',
              reviewedAt: '2026-05-02T11:00:00.000Z',
              reviewedBy: 'Current worker',
            },
          ],
        },
        weaviateDryRun: {
          status: 'prepared',
          objectCount: 1,
        },
      }),
    ];

    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/embedding-review')
      .send({ action: 'write-approved-chunks', confirmVectorWrite: true });

    expect(response.status).toBe(200);
    expect(mockWriteCaseWikiApprovedChunksToWeaviate).toHaveBeenCalledWith(
      expect.objectContaining({
        ingestion: expect.objectContaining({ fileId: 'source-001' }),
        confirmWrite: true,
      }),
    );
    expect(mockBuildCaseWikiEmbeddingReviewGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        ingestion: expect.objectContaining({ fileId: 'source-001' }),
        embeddingReview: expect.objectContaining({ status: 'indexed-in-weaviate' }),
        vectorWrite: expect.objectContaining({ status: 'written', objectCount: 1 }),
        action: 'write-approved-chunks',
      }),
    );
    expect(mockWriteCaseWikiGraphToNeo4j).toHaveBeenCalledWith(
      expect.objectContaining({
        edges: expect.arrayContaining([expect.objectContaining({ kind: 'INDEXED_IN' })]),
      }),
    );
    const updates = mockUpdateCaseManagementWikiIngestionReview.mock.calls[0][2];
    expect(updates.embeddingReview).toEqual(
      expect.objectContaining({
        status: 'indexed-in-weaviate',
        writeMode: 'live',
        writeEnabled: true,
        vectorWrite: expect.objectContaining({ status: 'written', objectCount: 1 }),
        graphSync: expect.objectContaining({ status: 'written', vectorIndexNodeId: 'vector-index:weaviate:case-wiki-source-chunk' }),
      }),
    );
    expect(updates.vectorIndex).toEqual(
      expect.objectContaining({
        provider: 'weaviate',
        status: 'written',
        chunkCount: 1,
        collection: 'CaseWikiSourceChunk',
        objectIds: ['weaviate-object-001'],
        objectLedger: [
          expect.objectContaining({
            objectId: 'weaviate-object-001',
            chunkId: 'embedding:source-001:1',
          }),
        ],
        objectMap: expect.objectContaining({
          'embedding:source-001:1': expect.objectContaining({ objectId: 'weaviate-object-001' }),
        }),
      }),
    );
    expect(updates['generatedRecords.frontendRecord.vectorStatus']).toBe('written');
    expect(response.body.vectorWrite).toEqual(expect.objectContaining({ status: 'written', objectCount: 1 }));
    expect(response.body.neo4j).toEqual(expect.objectContaining({ status: 'written' }));
  });

  it('keeps Weaviate deletes blocked without explicit vector delete confirmation', async () => {
    wikiIngestions = [
      makeIngestion({
        embeddingReview: {
          status: 'indexed-in-weaviate',
          approvedCount: 1,
          pendingCount: 0,
          rejectedCount: 0,
          chunkCount: 1,
          chunks: [
            {
              id: 'embedding:source-001:1',
              status: 'approved-for-embedding',
              embeddingAction: 'approved-for-embedding',
              textPreview: 'Approved source paragraph.',
            },
          ],
        },
        vectorIndex: {
          provider: 'weaviate',
          status: 'written',
          collection: 'CaseWikiSourceChunk',
          endpoint: 'http://localhost:8080',
          objectIds: ['weaviate-object-001'],
        },
      }),
    ];
    mockDeleteCaseWikiWeaviateObjects.mockResolvedValueOnce({
      status: 'confirmation-required',
      objectIds: ['weaviate-object-001'],
      deletedObjectCount: 0,
      message: 'Confirm the stored Weaviate object IDs before deleting reviewed chunks from the vector index.',
      warnings: ['confirmation-required'],
    });

    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/embedding-review')
      .send({ action: 'delete-vector-chunks' });

    expect(response.status).toBe(409);
    expect(mockDeleteCaseWikiWeaviateObjects).toHaveBeenCalledWith(
      expect.objectContaining({
        ingestion: expect.objectContaining({ fileId: 'source-001' }),
        vectorIndex: expect.objectContaining({ objectIds: ['weaviate-object-001'] }),
        confirmDelete: false,
      }),
    );
    expect(mockUpdateCaseManagementWikiIngestionReview).not.toHaveBeenCalled();
  });

  it('persists reversible vector delete metadata after confirmed Weaviate deletion', async () => {
    wikiIngestions = [
      makeIngestion({
        embeddingReview: {
          status: 'indexed-in-weaviate',
          approvedCount: 1,
          pendingCount: 0,
          rejectedCount: 0,
          chunkCount: 1,
          chunks: [
            {
              id: 'embedding:source-001:1',
              status: 'approved-for-embedding',
              embeddingAction: 'approved-for-embedding',
              textPreview: 'Approved source paragraph.',
            },
          ],
        },
        weaviateDryRun: {
          status: 'prepared',
          objectCount: 1,
        },
        vectorIndex: {
          provider: 'weaviate',
          status: 'written',
          collection: 'CaseWikiSourceChunk',
          endpoint: 'http://localhost:8080',
          objectIds: ['weaviate-object-001'],
          objectLedger: [{ objectId: 'weaviate-object-001', chunkId: 'embedding:source-001:1' }],
          objectMap: { 'embedding:source-001:1': { objectId: 'weaviate-object-001' } },
        },
      }),
    ];

    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/embedding-review')
      .send({ action: 'delete-vector-chunks', confirmVectorDelete: true });

    expect(response.status).toBe(200);
    expect(mockDeleteCaseWikiWeaviateObjects).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmDelete: true,
      }),
    );
    const updates = mockUpdateCaseManagementWikiIngestionReview.mock.calls[0][2];
    expect(updates.embeddingReview).toEqual(
      expect.objectContaining({
        status: 'ready-for-vector-dry-run',
        writeMode: 'dry-run',
        writeEnabled: false,
        vectorWrite: null,
        vectorDelete: expect.objectContaining({ status: 'deleted', deletedObjectCount: 1 }),
        graphSync: expect.objectContaining({ status: 'written' }),
      }),
    );
    expect(updates.vectorIndex).toEqual(
      expect.objectContaining({
        status: 'deleted',
        objectIds: [],
        objectLedger: [],
        objectMap: {},
        deletedObjectIds: ['weaviate-object-001'],
      }),
    );
    expect(updates['generatedRecords.frontendRecord.vectorStatus']).toBe('deleted');
    expect(response.body.vectorDelete).toEqual(expect.objectContaining({ status: 'deleted', deletedObjectCount: 1 }));
  });

  it('requires a different existing canonical source before marking a source as superseded', async () => {
    const invalidResponse = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/archive')
      .send({
        action: 'mark-superseded-by-source',
        source: {
          sourceId: 'source-001',
          sourceLabel: 'Systems Innovation Partner List',
        },
      });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.error).toBe('Choose a different source from the current Case Wiki archive');

    wikiIngestions = [
      makeIngestion(),
      makeIngestion({
        fileId: 'source-canonical',
        originalName: 'Canonical Partner List.csv',
        sha256: 'hash-canonical',
        archive: {
          reviewStatus: 'reviewed-standalone',
          suggestedWikiTitle: 'Canonical Partner List',
        },
        generatedRecords: {
          ...makeIngestion().generatedRecords,
          frontendRecord: {
            ...makeIngestion().generatedRecords.frontendRecord,
            id: 'source-canonical',
            pageId: 'ingest:source-canonical',
            title: 'Canonical Partner List',
            sourceHash: 'hash-canonical',
          },
        },
        wikiPage: {
          id: 'ingest:source-canonical',
          title: 'Canonical Partner List',
        },
      }),
    ];

    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/archive')
      .send({
        action: 'mark-superseded-by-source',
        source: {
          sourceId: 'source-canonical',
          sourceLabel: 'Canonical Partner List',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.wikiIngestionRecord.archive.cleanupDecision).toEqual(
      expect.objectContaining({
        status: 'superseded-by-canonical',
        canonicalSource: expect.objectContaining({
          sourceId: 'source-canonical',
          sourceLabel: 'Canonical Partner List',
          sourceHash: 'hash-canonical',
        }),
      }),
    );
    expect(response.body.generatedRecords.auditRecords[0].action).toBe(
      'marked source as superseded by Canonical Partner List',
    );
  });

  it('resolves a visible canonical group without moving files or writing vectors', async () => {
    wikiIngestions = [
      makeIngestion(),
      makeIngestion({
        fileId: 'source-duplicate',
        originalName: 'Systems Innovation Partner List copy.csv',
        sha256: 'hash-source-001',
        archive: {
          reviewStatus: 'needs-human-review',
          lifeDomain: 'Partners',
          sourceKind: 'table',
          suggestedWikiTitle: 'Systems Innovation Partner List copy',
        },
        generatedRecords: {
          ...makeIngestion().generatedRecords,
          frontendRecord: {
            ...makeIngestion().generatedRecords.frontendRecord,
            id: 'source-duplicate',
            pageId: 'ingest:source-duplicate',
            title: 'Systems Innovation Partner List copy',
            fileName: 'Systems Innovation Partner List copy.csv',
            sourceHash: 'hash-source-001',
          },
        },
        wikiPage: {
          id: 'ingest:source-duplicate',
          title: 'Systems Innovation Partner List copy',
        },
      }),
      makeIngestion({
        fileId: 'source-attached',
        originalName: 'Attached case note.md',
        sourceScope: 'current-record',
        archive: {
          reviewStatus: 'attached-to-current-record',
          suggestedWikiTitle: 'Attached case note',
          attachmentTarget: {
            targetType: 'case',
            targetId: 'case-001',
            targetLabel: 'Housing Stability',
          },
        },
      }),
    ];

    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/archive/canonical-group')
      .send({
        confirmCanonicalGroupResolution: true,
        sourceIds: ['source-duplicate', 'source-attached', 'missing-source', 'source-001'],
      });

    expect(response.status).toBe(200);
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        canonicalSourceId: 'source-001',
        duplicateSourcesUpdated: 1,
        lineageMemberCount: 2,
        lineageHashCount: 1,
        destructiveFileAction: false,
        vectorWrite: false,
        graphWrite: false,
        attachmentWrite: false,
      }),
    );
    expect(response.body.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fileId: 'source-attached', reason: 'already-attached-or-current-record' }),
        expect.objectContaining({ fileId: 'missing-source', reason: 'source-not-found' }),
        expect.objectContaining({ fileId: 'source-001', reason: 'canonical-source-selected' }),
      ]),
    );
    const canonicalRecord = response.body.wikiIngestionRecords.find((record) => record.id === 'source-001');
    const duplicateRecord = response.body.wikiIngestionRecords.find((record) => record.id === 'source-duplicate');
    expect(canonicalRecord.archive.cleanupDecision).toEqual(
      expect.objectContaining({
        status: 'canonical-source',
        canonicalLineage: expect.objectContaining({
          canonicalSource: expect.objectContaining({ sourceId: 'source-001' }),
          sourceIds: expect.arrayContaining(['source-001', 'source-duplicate']),
          sourceHashes: expect.arrayContaining(['hash-source-001']),
          aliases: expect.arrayContaining([
            expect.objectContaining({ label: 'Systems Innovation Partner List' }),
          ]),
          matchEvidence: expect.arrayContaining([
            expect.objectContaining({ type: 'exact-content-hash' }),
            expect.objectContaining({ type: 'remembered-aliases' }),
          ]),
        }),
      }),
    );
    expect(canonicalRecord.archive.canonicalLineage).toEqual(
      expect.objectContaining({
        groupId: canonicalRecord.archive.cleanupDecision.canonicalLineage.groupId,
        nonDestructive: true,
        vectorWrite: false,
        graphWrite: false,
        fileAction: false,
      }),
    );
    expect(duplicateRecord.archive.cleanupDecision).toEqual(
      expect.objectContaining({
        status: 'superseded-by-canonical',
        canonicalSource: expect.objectContaining({
          sourceId: 'source-001',
          sourceHash: 'hash-source-001',
        }),
        canonicalLineage: expect.objectContaining({
          groupId: canonicalRecord.archive.cleanupDecision.canonicalLineage.groupId,
          members: expect.arrayContaining([
            expect.objectContaining({ sourceId: 'source-duplicate', role: 'superseded' }),
          ]),
        }),
      }),
    );
    expect(response.body.generatedRecords.auditRecords.map((record) => record.action)).toEqual(
      expect.arrayContaining([
        'marked source as canonical source for duplicate group',
        'marked source as superseded by Systems Innovation Partner List',
      ]),
    );
  });

  it('plans article consolidation while preserving source boundaries and blocking live writes', async () => {
    wikiIngestions = [
      makeIngestion({
        archive: {
          reviewStatus: 'reviewed-standalone',
          lifeDomain: 'Partners',
          lane: 'Partner and organization lists',
          sourceKind: 'table',
          suggestedWikiTitle: 'Systems Innovation Partner List',
          suggestedCollections: ['systems innovation', 'partners'],
        },
      }),
      makeIngestion({
        fileId: 'source-related',
        originalName: 'Systems Innovation Notes.md',
        sha256: 'hash-source-related',
        archive: {
          reviewStatus: 'reviewed-standalone',
          lifeDomain: 'Partners',
          lane: 'Partner and organization lists',
          sourceKind: 'note',
          suggestedWikiTitle: 'Systems Innovation Notes',
          suggestedCollections: ['systems innovation', 'follow-up'],
        },
        generatedRecords: {
          ...makeIngestion().generatedRecords,
          frontendRecord: {
            ...makeIngestion().generatedRecords.frontendRecord,
            id: 'source-related',
            pageId: 'ingest:source-related',
            title: 'Systems Innovation Notes',
            fileName: 'Systems Innovation Notes.md',
            sourceHash: 'hash-source-related',
          },
        },
        wikiPage: {
          id: 'ingest:source-related',
          title: 'Systems Innovation Notes',
        },
      }),
      makeIngestion({
        fileId: 'source-attached',
        originalName: 'Attached case note.md',
        sourceScope: 'current-record',
        archive: {
          reviewStatus: 'attached-to-current-record',
          suggestedWikiTitle: 'Attached case note',
          attachmentTarget: {
            targetType: 'case',
            targetId: 'case-001',
            targetLabel: 'Housing Stability',
          },
        },
      }),
    ];

    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/archive/article-consolidation')
      .send({
        confirmArticleConsolidationPlan: true,
        sourceIds: ['source-related', 'source-attached', 'missing-source', 'source-001'],
      });

    expect(response.status).toBe(200);
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        targetSourceId: 'source-001',
        targetTitle: 'Systems Innovation Partner List',
        candidateCount: 1,
        destructiveFileAction: false,
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
        attachmentWrite: false,
      }),
    );
    expect(response.body.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fileId: 'source-attached', reason: 'already-attached-or-current-record' }),
        expect.objectContaining({ fileId: 'missing-source', reason: 'source-not-found' }),
        expect.objectContaining({ fileId: 'source-001', reason: 'base-source-selected' }),
      ]),
    );
    const baseRecord = response.body.wikiIngestionRecords.find((record) => record.id === 'source-001');
    const relatedRecord = response.body.wikiIngestionRecords.find((record) => record.id === 'source-related');
    expect(baseRecord.archive.articleConsolidation).toEqual(
      expect.objectContaining({
        status: 'merge-plan-ready',
        sourceIds: expect.arrayContaining(['source-001', 'source-related']),
        nonDestructive: true,
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
      }),
    );
    expect(baseRecord.archive.reviewStatus).toBe('reviewed-standalone');
    expect(relatedRecord.archive.articleConsolidation).toEqual(
      expect.objectContaining({
        status: 'candidate-for-article-merge',
        targetSourceId: 'source-001',
        targetSourceLabel: 'Systems Innovation Partner List',
      }),
    );
    expect(response.body.generatedRecords.auditRecords.map((record) => record.action)).toEqual(
      expect.arrayContaining([
        'planned article consolidation for 1 related source',
        'linked source to article consolidation plan for Systems Innovation Partner List',
      ]),
    );
  });

  it('plans a standalone article candidate when no related source is selected', async () => {
    wikiIngestions = [
      makeIngestion({
        archive: {
          reviewStatus: 'reviewed-standalone',
          lifeDomain: 'Personal knowledge',
          lane: 'Standalone source documents',
          sourceKind: 'document',
          suggestedWikiTitle: 'Open Brain Notes',
          suggestedCollections: ['open brain', 'wiki architecture'],
        },
      }),
    ];

    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/archive/article-consolidation')
      .send({
        confirmArticleConsolidationPlan: true,
        mode: 'single-source-article',
        sourceIds: [],
      });

    expect(response.status).toBe(200);
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        targetSourceId: 'source-001',
        targetTitle: 'Open Brain Notes',
        sourceCount: 1,
        candidateCount: 0,
        destructiveFileAction: false,
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
        attachmentWrite: false,
      }),
    );
    expect(response.body.articleConsolidationPlan).toEqual(
      expect.objectContaining({
        mode: 'single-source-article',
        sourceIds: ['source-001'],
        candidateCount: 0,
        recommendation: expect.stringContaining('article candidate'),
      }),
    );
    expect(response.body.wikiIngestionRecords[0].archive.articleConsolidation).toEqual(
      expect.objectContaining({
        mode: 'single-source-article',
        sourceIds: ['source-001'],
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
      }),
    );
    expect(response.body.generatedRecords.auditRecords.map((record) => record.action)).toEqual(
      expect.arrayContaining(['planned standalone article candidate']),
    );
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('prepares a source-to-article workup preview without publishing or vectorizing', async () => {
    wikiIngestions = [
      makeIngestion({
        archive: {
          reviewStatus: 'reviewed-standalone',
          lifeDomain: 'Personal knowledge',
          lane: 'Standalone source documents',
          sourceKind: 'document',
          suggestedWikiTitle: 'Open Brain Notes',
          suggestedCollections: ['open brain', 'wiki architecture'],
        },
        embeddingReview: {
          status: 'ready-for-vector-dry-run',
          privacyLevel: 'personal',
          redactionMode: 'strict',
          chunks: [
            {
              id: 'embedding:source-001:approved-1',
              ordinal: 1,
              status: 'approved-for-embedding',
              textPreview: 'Open Brain notes describe source-first personal wiki organization.',
              reviewedAt: '2026-05-02T10:00:00.000Z',
              reviewedBy: 'Current worker',
            },
            {
              id: 'embedding:source-001:approved-2',
              ordinal: 2,
              status: 'approved-for-embedding',
              textPreview: 'The wiki should preserve provenance, citations, graph structure, and human review gates.',
              reviewedAt: '2026-05-02T10:05:00.000Z',
              reviewedBy: 'Current worker',
            },
          ],
        },
      }),
    ];

    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/archive/article-consolidation/workup-preview')
      .send({
        confirmArticleWorkupPreview: true,
        mode: 'single-source-article',
        sourceIds: [],
      });

    expect(response.status).toBe(200);
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        status: 'promotion-readiness-ready',
        targetSourceId: 'source-001',
        targetTitle: 'Open Brain Notes',
        sourceCount: 1,
        reviewedCitationCount: 2,
        pendingChunkCount: 0,
        draftPreviewPrepared: true,
        promotionReadinessPrepared: true,
        readyForHumanPromotion: true,
        destructiveFileAction: false,
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
        attachmentWrite: false,
        fileAction: false,
      }),
    );
    expect(response.body.articleConsolidationPlan).toEqual(
      expect.objectContaining({
        mode: 'single-source-article',
        sourceIds: ['source-001'],
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
      }),
    );
    expect(response.body.articleCitationReviewPacket).toEqual(
      expect.objectContaining({
        status: 'ready-for-article-draft',
        reviewedCitationCount: 2,
        promotionBlocked: false,
      }),
    );
    expect(response.body.articleDraftPreview).toEqual(
      expect.objectContaining({
        previewOnly: true,
        reviewedCitationCount: 2,
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
      }),
    );
    expect(response.body.articlePromotionReadiness).toEqual(
      expect.objectContaining({
        status: 'ready-for-human-promotion',
        readyForHumanPromotion: true,
        requiresHumanPromotionConfirmation: true,
      }),
    );
    expect(response.body.wikiIngestionRecord.archive.articleConsolidation).toEqual(
      expect.objectContaining({
        status: 'promotion-readiness-ready',
        workupPreview: expect.objectContaining({
          draftPreviewPrepared: true,
          promotionReadinessPrepared: true,
          articleWrite: false,
          vectorWrite: false,
          graphWrite: false,
        }),
      }),
    );
    expect(response.body.policy).toContain('did not promote article prose');
    expect(response.body.generatedRecords.auditRecords.map((record) => record.action)).toEqual(
      expect.arrayContaining(['prepared source-to-article workup preview']),
    );
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('prepares an article citation review packet without promoting prose or writing vectors', async () => {
    wikiIngestions = [
      makeIngestion({
        archive: {
          reviewStatus: 'reviewed-standalone',
          lifeDomain: 'Partners',
          sourceKind: 'table',
          suggestedWikiTitle: 'Systems Innovation Partner List',
          articleConsolidation: {
            id: 'article-consolidation:source-001',
            status: 'merge-plan-ready',
            targetSourceId: 'source-001',
            targetTitle: 'Systems Innovation Partner List',
            targetPageId: 'ingest:source-001',
            sourceIds: ['source-001', 'source-related'],
            sourceCount: 2,
            candidateCount: 1,
            nonDestructive: true,
            articleWrite: false,
            vectorWrite: false,
            graphWrite: false,
          },
        },
        embeddingReview: {
          status: 'awaiting-review',
          privacyLevel: 'personal',
          redactionMode: 'strict',
          chunks: [
            {
              id: 'embedding:source-001:approved',
              ordinal: 1,
              status: 'approved-for-embedding',
              textPreview: 'Partner list contains organizations and collaboration notes reviewed for article evidence.',
              reviewedAt: '2026-05-02T10:00:00.000Z',
              reviewedBy: 'Current worker',
            },
            {
              id: 'embedding:source-001:pending',
              ordinal: 2,
              status: 'pending-review',
              textPreview: 'Unreviewed partner note that still needs human confirmation before promotion.',
            },
          ],
        },
        wikiPage: {
          id: 'ingest:source-001',
          title: 'Systems Innovation Partner List',
          archive: {
            reviewStatus: 'reviewed-standalone',
            suggestedWikiTitle: 'Systems Innovation Partner List',
          },
        },
        generatedRecords: {
          ...makeIngestion().generatedRecords,
          frontendRecord: {
            ...makeIngestion().generatedRecords.frontendRecord,
            archive: {
              reviewStatus: 'reviewed-standalone',
              lifeDomain: 'Partners',
              sourceKind: 'table',
              suggestedWikiTitle: 'Systems Innovation Partner List',
              articleConsolidation: {
                id: 'article-consolidation:source-001',
                status: 'merge-plan-ready',
                targetSourceId: 'source-001',
                targetTitle: 'Systems Innovation Partner List',
                targetPageId: 'ingest:source-001',
                sourceIds: ['source-001', 'source-related'],
                sourceCount: 2,
                candidateCount: 1,
                nonDestructive: true,
                articleWrite: false,
                vectorWrite: false,
                graphWrite: false,
              },
            },
          },
        },
      }),
      makeIngestion({
        fileId: 'source-related',
        originalName: 'Systems Innovation Notes.md',
        storedName: 'source-related.md',
        sha256: 'hash-source-related',
        archive: {
          reviewStatus: 'reviewed-standalone',
          lifeDomain: 'Partners',
          sourceKind: 'document',
          suggestedWikiTitle: 'Systems Innovation Notes',
        },
        embeddingReview: {
          status: 'ready-for-vector-dry-run',
          chunks: [
            {
              id: 'embedding:source-related:approved',
              ordinal: 1,
              status: 'approved-for-embedding',
              textPreview: 'Notes describe the relationship between the innovation partner list and follow-up projects.',
              reviewedAt: '2026-05-02T11:00:00.000Z',
              reviewedBy: 'Current worker',
            },
          ],
        },
        generatedRecords: {
          ...makeIngestion().generatedRecords,
          frontendRecord: {
            ...makeIngestion().generatedRecords.frontendRecord,
            id: 'source-related',
            pageId: 'ingest:source-related',
            title: 'Systems Innovation Notes',
            fileName: 'Systems Innovation Notes.md',
            sourceHash: 'hash-source-related',
            archive: {
              reviewStatus: 'reviewed-standalone',
              lifeDomain: 'Partners',
              sourceKind: 'document',
              suggestedWikiTitle: 'Systems Innovation Notes',
            },
          },
        },
        wikiPage: {
          id: 'ingest:source-related',
          title: 'Systems Innovation Notes',
        },
      }),
    ];

    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/archive/article-consolidation/citation-review')
      .send({
        confirmCitationReviewPacket: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        targetSourceId: 'source-001',
        targetTitle: 'Systems Innovation Partner List',
        status: 'partial-citations-needs-review',
        sourceCount: 2,
        reviewedCitationCount: 2,
        pendingChunkCount: 1,
        destructiveFileAction: false,
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
        attachmentWrite: false,
        fileAction: false,
      }),
    );
    expect(response.body.articleCitationReviewPacket).toEqual(
      expect.objectContaining({
        status: 'partial-citations-needs-review',
        reviewedCitationCount: 2,
        pendingChunkCount: 1,
        promotionBlocked: true,
        reviewedCitations: expect.arrayContaining([
          expect.objectContaining({
            sourceDocumentId: 'source-001',
            marker: '[1]',
          }),
          expect.objectContaining({
            sourceDocumentId: 'source-related',
            marker: '[2]',
          }),
        ]),
      }),
    );
    expect(response.body.wikiIngestionRecord.archive.articleConsolidation).toEqual(
      expect.objectContaining({
        status: 'citation-review-needed',
        citationReviewPacket: expect.objectContaining({
          reviewedCitationCount: 2,
          pendingChunkCount: 1,
        }),
      }),
    );
    expect(response.body.generatedRecords.auditRecords.map((record) => record.action)).toEqual(
      expect.arrayContaining(['prepared article consolidation citation review packet']),
    );
  });

  it('prepares an article draft preview from reviewed citations without publishing prose', async () => {
    const citationPacket = {
      id: 'article-citation-review:source-001',
      status: 'partial-citations-needs-review',
      targetTitle: 'Systems Innovation Partner List',
      targetSourceId: 'source-001',
      targetPageId: 'ingest:source-001',
      planId: 'article-consolidation:source-001',
      sourceCount: 2,
      chunkCount: 3,
      reviewedCitationCount: 2,
      pendingChunkCount: 1,
      blockedChunkCount: 0,
      metadataOnlySourceCount: 0,
      promotionBlocked: true,
      reviewedCitations: [
        {
          id: 'citation:source-001:embedding:source-001:approved',
          marker: '[1]',
          sourceDocumentId: 'source-001',
          sourcePageId: 'ingest:source-001',
          sourceTitle: 'Systems Innovation Partner List',
          chunkId: 'embedding:source-001:approved',
          textPreview: 'Partner list contains organizations and collaboration notes reviewed for article evidence.',
          evidenceState: 'reviewed',
          status: 'approved-for-embedding',
        },
        {
          id: 'citation:source-related:embedding:source-related:approved',
          marker: '[2]',
          sourceDocumentId: 'source-related',
          sourcePageId: 'ingest:source-related',
          sourceTitle: 'Systems Innovation Notes',
          chunkId: 'embedding:source-related:approved',
          textPreview: 'Notes describe the relationship between the innovation partner list and follow-up projects.',
          evidenceState: 'reviewed',
          status: 'approved-for-embedding',
        },
      ],
      pendingChunks: [
        {
          sourceDocumentId: 'source-001',
          sourceTitle: 'Systems Innovation Partner List',
          chunkId: 'embedding:source-001:pending',
          textPreview: 'Unreviewed partner note that still needs human confirmation before promotion.',
        },
      ],
      sourceSummaries: [
        {
          sourceId: 'source-001',
          sourceTitle: 'Systems Innovation Partner List',
          chunkCount: 2,
          approvedCount: 1,
          pendingCount: 1,
          blockedCount: 0,
        },
        {
          sourceId: 'source-related',
          sourceTitle: 'Systems Innovation Notes',
          chunkCount: 1,
          approvedCount: 1,
          pendingCount: 0,
          blockedCount: 0,
        },
      ],
      nonDestructive: true,
      articleWrite: false,
      vectorWrite: false,
      graphWrite: false,
      attachmentWrite: false,
      fileAction: false,
    };

    wikiIngestions = [
      makeIngestion({
        archive: {
          reviewStatus: 'reviewed-standalone',
          lifeDomain: 'Partners',
          sourceKind: 'table',
          suggestedWikiTitle: 'Systems Innovation Partner List',
          articleConsolidation: {
            id: 'article-consolidation:source-001',
            status: 'citation-review-needed',
            targetSourceId: 'source-001',
            targetTitle: 'Systems Innovation Partner List',
            targetPageId: 'ingest:source-001',
            sourceIds: ['source-001', 'source-related'],
            sourceCount: 2,
            candidateCount: 1,
            citationReviewPacket: citationPacket,
            nonDestructive: true,
            articleWrite: false,
            vectorWrite: false,
            graphWrite: false,
          },
        },
        generatedRecords: {
          ...makeIngestion().generatedRecords,
          frontendRecord: {
            ...makeIngestion().generatedRecords.frontendRecord,
            archive: {
              reviewStatus: 'reviewed-standalone',
              lifeDomain: 'Partners',
              sourceKind: 'table',
              suggestedWikiTitle: 'Systems Innovation Partner List',
              articleConsolidation: {
                id: 'article-consolidation:source-001',
                status: 'citation-review-needed',
                targetSourceId: 'source-001',
                targetTitle: 'Systems Innovation Partner List',
                targetPageId: 'ingest:source-001',
                sourceIds: ['source-001', 'source-related'],
                sourceCount: 2,
                candidateCount: 1,
                citationReviewPacket: citationPacket,
                nonDestructive: true,
                articleWrite: false,
                vectorWrite: false,
                graphWrite: false,
              },
            },
          },
        },
      }),
    ];

    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/archive/article-consolidation/draft-preview')
      .send({
        confirmArticleDraftPreview: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        targetSourceId: 'source-001',
        targetTitle: 'Systems Innovation Partner List',
        status: 'draft-preview-needs-review',
        sectionCount: 4,
        reviewedCitationCount: 2,
        pendingChunkCount: 1,
        destructiveFileAction: false,
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
        attachmentWrite: false,
        fileAction: false,
      }),
    );
    expect(response.body.articleDraftPreview).toEqual(
      expect.objectContaining({
        mode: 'deterministic-reviewed-citation-preview',
        previewOnly: true,
        publishable: false,
        requiresHumanPromotionConfirmation: true,
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
        sections: expect.arrayContaining([
          expect.objectContaining({
            heading: 'Lead',
            citationIds: expect.arrayContaining(['citation:source-001:embedding:source-001:approved']),
          }),
          expect.objectContaining({
            heading: 'Reviewed evidence',
            citationIds: expect.arrayContaining([
              'citation:source-001:embedding:source-001:approved',
              'citation:source-related:embedding:source-related:approved',
            ]),
          }),
        ]),
      }),
    );
    expect(response.body.wikiIngestionRecord.archive.articleConsolidation).toEqual(
      expect.objectContaining({
        status: 'article-draft-preview-needs-review',
        articleDraftPreview: expect.objectContaining({
          reviewedCitationCount: 2,
          pendingChunkCount: 1,
        }),
      }),
    );
    expect(response.body.policy).toContain('did not publish article prose');
    expect(response.body.generatedRecords.auditRecords.map((record) => record.action)).toEqual(
      expect.arrayContaining(['prepared article consolidation draft preview']),
    );
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('prepares an article promotion readiness review without publishing the draft', async () => {
    const articleDraftPreview = {
      id: 'article-draft-preview:source-001',
      status: 'draft-preview-needs-review',
      mode: 'deterministic-reviewed-citation-preview',
      targetTitle: 'Systems Innovation Partner List',
      targetSourceId: 'source-001',
      targetPageId: 'ingest:source-001',
      planId: 'article-consolidation:source-001',
      citationPacketId: 'article-citation-review:source-001',
      previewOnly: true,
      publishable: false,
      requiresHumanPromotionConfirmation: true,
      reviewedCitationCount: 2,
      pendingChunkCount: 1,
      blockedChunkCount: 0,
      metadataOnlySourceCount: 0,
      sections: [
        {
          id: 'section-lead',
          heading: 'Lead',
          text: 'Systems Innovation Partner List is a draft Case Wiki article built from reviewed source evidence.',
          citationIds: ['citation:source-001:approved'],
          reviewState: 'reviewed-citation-preview-with-gaps',
        },
        {
          id: 'section-reviewed-evidence',
          heading: 'Reviewed evidence',
          text: 'Reviewed evidence from partner notes.',
          citationIds: ['citation:source-001:approved', 'citation:source-related:approved'],
          reviewState: 'reviewed-evidence',
        },
        {
          id: 'section-review-gaps',
          heading: 'Review gaps',
          text: '1 pending chunk still needs review.',
          citationIds: [],
          reviewState: 'needs-human-review',
        },
      ],
      citationLedger: [
        {
          id: 'citation:source-001:approved',
          sourceDocumentId: 'source-001',
          sourceTitle: 'Systems Innovation Partner List',
        },
        {
          id: 'citation:source-related:approved',
          sourceDocumentId: 'source-related',
          sourceTitle: 'Systems Innovation Notes',
        },
      ],
      reviewGaps: {
        pendingChunkCount: 1,
        blockedChunkCount: 0,
        metadataOnlySourceCount: 0,
        summary: '1 pending chunk still needs review.',
      },
      nonDestructive: true,
      articleWrite: false,
      vectorWrite: false,
      graphWrite: false,
      attachmentWrite: false,
      fileAction: false,
    };

    wikiIngestions = [
      makeIngestion({
        archive: {
          reviewStatus: 'reviewed-standalone',
          lifeDomain: 'Partners',
          sourceKind: 'table',
          suggestedWikiTitle: 'Systems Innovation Partner List',
          articleConsolidation: {
            id: 'article-consolidation:source-001',
            status: 'article-draft-preview-needs-review',
            targetSourceId: 'source-001',
            targetTitle: 'Systems Innovation Partner List',
            targetPageId: 'ingest:source-001',
            sourceIds: ['source-001', 'source-related'],
            sourceCount: 2,
            candidateCount: 1,
            articleDraftPreview,
            nonDestructive: true,
            articleWrite: false,
            vectorWrite: false,
            graphWrite: false,
          },
        },
        generatedRecords: {
          ...makeIngestion().generatedRecords,
          frontendRecord: {
            ...makeIngestion().generatedRecords.frontendRecord,
            archive: {
              reviewStatus: 'reviewed-standalone',
              lifeDomain: 'Partners',
              sourceKind: 'table',
              suggestedWikiTitle: 'Systems Innovation Partner List',
              articleConsolidation: {
                id: 'article-consolidation:source-001',
                status: 'article-draft-preview-needs-review',
                targetSourceId: 'source-001',
                targetTitle: 'Systems Innovation Partner List',
                targetPageId: 'ingest:source-001',
                sourceIds: ['source-001', 'source-related'],
                sourceCount: 2,
                candidateCount: 1,
                articleDraftPreview,
                nonDestructive: true,
                articleWrite: false,
                vectorWrite: false,
                graphWrite: false,
              },
            },
          },
        },
      }),
    ];

    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/archive/article-consolidation/promotion-readiness')
      .send({
        confirmArticlePromotionReadiness: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        targetSourceId: 'source-001',
        targetTitle: 'Systems Innovation Partner List',
        status: 'needs-review-before-promotion',
        checklistCount: 5,
        blockedReasonCount: 1,
        reviewedCitationCount: 2,
        pendingChunkCount: 1,
        readyForHumanPromotion: false,
        destructiveFileAction: false,
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
        attachmentWrite: false,
        fileAction: false,
      }),
    );
    expect(response.body.articlePromotionReadiness).toEqual(
      expect.objectContaining({
        status: 'needs-review-before-promotion',
        requiresHumanPromotionConfirmation: true,
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
        checklist: expect.arrayContaining([
          expect.objectContaining({
            id: 'pending-chunks',
            status: 'blocked',
          }),
          expect.objectContaining({
            id: 'human-confirmation',
            status: 'required',
          }),
        ]),
      }),
    );
    expect(response.body.wikiIngestionRecord.archive.articleConsolidation).toEqual(
      expect.objectContaining({
        status: 'promotion-readiness-needs-review',
        articlePromotionReadiness: expect.objectContaining({
          pendingChunkCount: 1,
          readyForHumanPromotion: false,
        }),
      }),
    );
    expect(response.body.policy).toContain('did not publish article prose');
    expect(response.body.generatedRecords.auditRecords.map((record) => record.action)).toEqual(
      expect.arrayContaining(['prepared article promotion readiness review']),
    );
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('prepares split-specific article candidates without publishing or embedding source material', async () => {
    const articleDraftPreview = {
      id: 'article-draft-preview:source-001',
      status: 'draft-preview-ready-for-review',
      mode: 'deterministic-reviewed-citation-preview',
      targetTitle: 'Systems Innovation Partner List',
      targetSourceId: 'source-001',
      targetPageId: 'ingest:source-001',
      planId: 'article-consolidation:source-001',
      citationPacketId: 'article-citation-review:source-001',
      previewOnly: true,
      publishable: false,
      requiresHumanPromotionConfirmation: true,
      reviewedCitationCount: 3,
      pendingChunkCount: 0,
      blockedChunkCount: 0,
      metadataOnlySourceCount: 0,
      sourceCount: 2,
      sections: [
        {
          id: 'section-lead',
          heading: 'Lead',
          text: 'Systems Innovation Partner List is a draft Case Wiki article built from reviewed source evidence.',
          citationIds: ['citation:source-001:overview'],
          reviewState: 'reviewed-citation-preview',
        },
        {
          id: 'section-partner-readiness',
          heading: 'Partner readiness',
          text: 'Partner readiness notes can stand alone as a focused article candidate for relationship follow-up.',
          citationIds: ['citation:source-001:partner-readiness', 'citation:source-related:partner-readiness'],
          reviewState: 'reviewed-evidence',
        },
        {
          id: 'section-funding-pathways',
          heading: 'Funding pathways',
          text: 'Funding pathway notes can become their own article candidate after human title review.',
          citationIds: ['citation:source-related:funding-pathways'],
          reviewState: 'reviewed-evidence',
        },
        {
          id: 'section-source-coverage',
          heading: 'Source coverage',
          text: 'Two sources contributed reviewed evidence.',
          citationIds: [],
          reviewState: 'source-coverage-summary',
        },
      ],
      citationLedger: [
        {
          id: 'citation:source-001:overview',
          sourceDocumentId: 'source-001',
          sourcePageId: 'ingest:source-001',
          sourceTitle: 'Systems Innovation Partner List',
          textPreview: 'Overview of systems innovation partners.',
        },
        {
          id: 'citation:source-001:partner-readiness',
          sourceDocumentId: 'source-001',
          sourcePageId: 'ingest:source-001',
          sourceTitle: 'Systems Innovation Partner List',
          textPreview: 'Partner readiness evidence from the table.',
        },
        {
          id: 'citation:source-related:partner-readiness',
          sourceDocumentId: 'source-related',
          sourcePageId: 'ingest:source-related',
          sourceTitle: 'Systems Innovation Notes',
          textPreview: 'Follow-up partner readiness notes.',
        },
        {
          id: 'citation:source-related:funding-pathways',
          sourceDocumentId: 'source-related',
          sourcePageId: 'ingest:source-related',
          sourceTitle: 'Systems Innovation Notes',
          textPreview: 'Funding pathway notes.',
        },
      ],
      sourceSummaries: [
        {
          sourceId: 'source-001',
          sourceTitle: 'Systems Innovation Partner List',
          chunkCount: 2,
          approvedCount: 2,
          pendingCount: 0,
          blockedCount: 0,
        },
        {
          sourceId: 'source-related',
          sourceTitle: 'Systems Innovation Notes',
          chunkCount: 2,
          approvedCount: 2,
          pendingCount: 0,
          blockedCount: 0,
        },
      ],
      reviewGaps: {
        pendingChunkCount: 0,
        blockedChunkCount: 0,
        metadataOnlySourceCount: 0,
        summary: 'No pending chunks remain.',
      },
      nonDestructive: true,
      articleWrite: false,
      vectorWrite: false,
      graphWrite: false,
      attachmentWrite: false,
      fileAction: false,
    };

    wikiIngestions = [
      makeIngestion({
        archive: {
          reviewStatus: 'reviewed-standalone',
          lifeDomain: 'Partners',
          sourceKind: 'table',
          suggestedWikiTitle: 'Systems Innovation Partner List',
          articleConsolidation: {
            id: 'article-consolidation:source-001',
            status: 'article-draft-preview-ready',
            targetSourceId: 'source-001',
            targetTitle: 'Systems Innovation Partner List',
            targetPageId: 'ingest:source-001',
            sourceIds: ['source-001', 'source-related'],
            sourceCount: 2,
            candidateCount: 1,
            articleDraftPreview,
            nonDestructive: true,
            articleWrite: false,
            vectorWrite: false,
            graphWrite: false,
          },
        },
        generatedRecords: {
          ...makeIngestion().generatedRecords,
          frontendRecord: {
            ...makeIngestion().generatedRecords.frontendRecord,
            archive: {
              reviewStatus: 'reviewed-standalone',
              lifeDomain: 'Partners',
              sourceKind: 'table',
              suggestedWikiTitle: 'Systems Innovation Partner List',
              articleConsolidation: {
                id: 'article-consolidation:source-001',
                status: 'article-draft-preview-ready',
                targetSourceId: 'source-001',
                targetTitle: 'Systems Innovation Partner List',
                targetPageId: 'ingest:source-001',
                sourceIds: ['source-001', 'source-related'],
                sourceCount: 2,
                candidateCount: 1,
                articleDraftPreview,
                nonDestructive: true,
                articleWrite: false,
                vectorWrite: false,
                graphWrite: false,
              },
            },
          },
        },
      }),
    ];

    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/source-001/archive/article-consolidation/split-review')
      .send({
        confirmArticleSplitReview: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        targetSourceId: 'source-001',
        targetTitle: 'Systems Innovation Partner List',
        status: 'split-review-ready',
        splitCandidateCount: 3,
        promotableSplitCount: 2,
        destructiveFileAction: false,
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
        attachmentWrite: false,
        fileAction: false,
      }),
    );
    expect(response.body.articleSplitReview).toEqual(
      expect.objectContaining({
        status: 'split-review-ready',
        nonDestructive: true,
        articleWrite: false,
        vectorWrite: false,
        graphWrite: false,
        splitCandidates: expect.arrayContaining([
          expect.objectContaining({
            title: 'Systems Innovation Partner List: Partner readiness',
            recommendedAction: 'promote-separate-article-candidate',
            readiness: 'ready-for-split-review',
            sourceDocumentIds: expect.arrayContaining(['source-001', 'source-related']),
          }),
          expect.objectContaining({
            title: 'Systems Innovation Partner List: Funding pathways',
            recommendedAction: 'promote-separate-article-candidate',
            readiness: 'ready-for-split-review',
          }),
        ]),
      }),
    );
    expect(response.body.wikiIngestionRecord.archive.articleConsolidation).toEqual(
      expect.objectContaining({
        status: 'article-split-review-ready',
        articleSplitReview: expect.objectContaining({
          splitCandidateCount: 3,
          promotableSplitCount: 2,
        }),
      }),
    );
    expect(response.body.policy).toContain('did not publish article prose');
    expect(response.body.generatedRecords.auditRecords.map((record) => record.action)).toEqual(
      expect.arrayContaining(['prepared article split review']),
    );
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });

  it('promotes a readiness-approved article draft while keeping source pages as citations', async () => {
    const articleDraftPreview = {
      id: 'article-draft-preview:source-001',
      status: 'draft-preview-ready-for-review',
      mode: 'deterministic-reviewed-citation-preview',
      targetTitle: 'Systems Innovation Partner List',
      targetSourceId: 'source-001',
      targetPageId: 'ingest:source-001',
      planId: 'article-consolidation:source-001',
      citationPacketId: 'article-citation-review:source-001',
      previewOnly: true,
      publishable: false,
      requiresHumanPromotionConfirmation: true,
      reviewedCitationCount: 2,
      pendingChunkCount: 0,
      blockedChunkCount: 0,
      metadataOnlySourceCount: 0,
      lead: 'Systems Innovation Partner List is a draft Case Wiki article built from reviewed partner evidence.',
      sections: [
        {
          id: 'section-lead',
          heading: 'Lead',
          text: 'Systems Innovation Partner List is built from reviewed partner evidence.',
          citationIds: ['citation:source-001:approved'],
          reviewState: 'reviewed-citation-preview',
        },
        {
          id: 'section-reviewed-evidence',
          heading: 'Reviewed evidence',
          text: 'Reviewed evidence from partner notes and outreach records.',
          citationIds: ['citation:source-001:approved', 'citation:source-related:approved'],
          reviewState: 'reviewed-evidence',
        },
        {
          id: 'section-source-coverage',
          heading: 'Source coverage',
          text: 'Two sources contributed reviewed evidence.',
          citationIds: [],
          reviewState: 'source-coverage-summary',
        },
      ],
      citationLedger: [
        {
          id: 'citation:source-001:approved',
          marker: '[1]',
          sourceDocumentId: 'source-001',
          sourcePageId: 'ingest:source-001',
          sourceTitle: 'Systems Innovation Partner List',
          chunkId: 'approved',
          textPreview: 'Primary partner table evidence.',
        },
        {
          id: 'citation:source-related:approved',
          marker: '[2]',
          sourceDocumentId: 'source-related',
          sourcePageId: 'ingest:source-related',
          sourceTitle: 'Systems Innovation Notes',
          chunkId: 'approved',
          textPreview: 'Follow-up partner notes.',
        },
      ],
      reviewGaps: {
        pendingChunkCount: 0,
        blockedChunkCount: 0,
        metadataOnlySourceCount: 0,
        summary: 'No pending chunks remain.',
      },
      nonDestructive: true,
      articleWrite: false,
      vectorWrite: false,
      graphWrite: false,
      attachmentWrite: false,
      fileAction: false,
    };
    const articlePromotionReadiness = {
      id: 'article-promotion-readiness:source-001',
      status: 'ready-for-human-promotion',
      targetTitle: 'Systems Innovation Partner List',
      targetSourceId: 'source-001',
      targetPageId: 'ingest:source-001',
      draftPreviewId: articleDraftPreview.id,
      citationPacketId: articleDraftPreview.citationPacketId,
      reviewedCitationCount: 2,
      sectionCount: 3,
      publishableSectionCount: 2,
      blockedSectionCount: 0,
      pendingChunkCount: 0,
      blockedChunkCount: 0,
      metadataOnlySourceCount: 0,
      readyForHumanPromotion: true,
      requiresHumanPromotionConfirmation: true,
      blockedReasons: [],
      warnings: [],
      checklist: [
        { id: 'reviewed-citations', status: 'pass', label: 'Reviewed citations attached' },
        { id: 'section-citations', status: 'pass', label: 'Publishable sections cite reviewed evidence' },
        { id: 'human-confirmation', status: 'required', label: 'Human promotion confirmation required' },
      ],
    };

    wikiIngestions = [
      makeIngestion({
        archive: {
          reviewStatus: 'reviewed-standalone',
          lifeDomain: 'Partners',
          sourceKind: 'table',
          suggestedWikiTitle: 'Systems Innovation Partner List',
          articleConsolidation: {
            id: 'article-consolidation:source-001',
            status: 'promotion-readiness-ready',
            targetSourceId: 'source-001',
            targetTitle: 'Systems Innovation Partner List',
            targetPageId: 'ingest:source-001',
            sourceIds: ['source-001', 'source-related'],
            sourceCount: 2,
            candidateCount: 1,
            articleDraftPreview,
            articlePromotionReadiness,
            nonDestructive: true,
            articleWrite: false,
            vectorWrite: false,
            graphWrite: false,
          },
        },
        generatedRecords: {
          ...makeIngestion().generatedRecords,
          frontendRecord: {
            ...makeIngestion().generatedRecords.frontendRecord,
            archive: {
              reviewStatus: 'reviewed-standalone',
              lifeDomain: 'Partners',
              sourceKind: 'table',
              suggestedWikiTitle: 'Systems Innovation Partner List',
              articleConsolidation: {
                id: 'article-consolidation:source-001',
                status: 'promotion-readiness-ready',
                targetSourceId: 'source-001',
                targetTitle: 'Systems Innovation Partner List',
                targetPageId: 'ingest:source-001',
                sourceIds: ['source-001', 'source-related'],
                sourceCount: 2,
                candidateCount: 1,
                articleDraftPreview,
                articlePromotionReadiness,
                nonDestructive: true,
                articleWrite: false,
                vectorWrite: false,
                graphWrite: false,
              },
            },
          },
        },
      }),
    ];

    const response = await request(app)
      .post('/api/case-management/wiki/ingestions/source-001/archive/article-consolidation/promotions')
      .send({
        confirmArticlePromotion: true,
        actor: 'Case Wiki manager',
      });

    expect(response.status).toBe(200);
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        targetTitle: 'Systems Innovation Partner List',
        citationCount: 2,
        sectionCount: 2,
        version: 1,
        articleWrite: true,
        graphWrite: true,
        vectorWrite: false,
        attachmentWrite: false,
        fileAction: false,
      }),
    );
    expect(response.body.promotionRecord).toEqual(
      expect.objectContaining({
        status: 'published-section',
        publishMode: 'human-confirmed-article-consolidation',
        reviewState: 'reviewed-article-consolidation',
        pageId: 'promotion:systems-innovation-partner-list',
        sourceDocumentIds: expect.arrayContaining(['source-001', 'source-related']),
        sourcePolicy: expect.stringContaining('Source pages remain intact'),
        citationCoverageDiff: expect.objectContaining({
          status: 'pass',
          excludedSectionCount: 1,
        }),
      }),
    );
    expect(response.body.wikiIngestionRecord.archive.articleConsolidation).toEqual(
      expect.objectContaining({
        status: 'article-promoted',
        articlePromotion: expect.objectContaining({
          pageId: 'promotion:systems-innovation-partner-list',
          citationCount: 2,
          sectionCount: 2,
          articleWrite: true,
          graphWrite: true,
          vectorWrite: false,
          attachmentWrite: false,
          fileAction: false,
        }),
      }),
    );
    expect(response.body.generatedRecords.auditRecords.map((record) => record.action)).toEqual(
      expect.arrayContaining(['promoted reviewed article consolidation draft']),
    );
    expect(mockSaveCaseManagementWorkspace).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        wikiPromotionRecords: expect.arrayContaining([
          expect.objectContaining({
            pageId: 'promotion:systems-innovation-partner-list',
          }),
        ]),
      }),
    );
    expect(mockWriteCaseWikiGraphToNeo4j).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ kind: 'WikiPromotion' })]),
        edges: expect.arrayContaining([expect.objectContaining({ kind: 'PROMOTED_WIKI_PAGE' })]),
      }),
    );
  });

  it('catalogs selected local archive candidates as standalone metadata-only wiki sources', async () => {
    const response = await request(app)
      .post('/api/case-management/wiki/local-archive/catalog')
      .send({
        candidates: [
          {
            id: 'candidate-001',
            rootId: 'root-docs',
            rootLabel: 'Documents',
            relativePath: 'Street Voices/System Innovation Partner List.docx',
            displayPath: 'Documents/Street Voices/System Innovation Partner List.docx',
            fileName: 'System Innovation Partner List.docx',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            size: 7112,
            modifiedAt: '2026-05-02T10:00:00.000Z',
            lane: 'Partner and organization lists',
            lifeDomain: 'Partners',
            lifeDomainId: 'partners',
            sourceKind: 'document',
            importReadiness: 'ready-to-ingest',
            cleanupSignals: [],
            suggestedCollections: ['Domain: Partners', 'Partner and organization lists'],
          },
          {
            id: 'candidate-secret',
            rootId: 'root-docs',
            rootLabel: 'Documents',
            relativePath: 'Secrets/api-key.txt',
            fileName: 'api-key.txt',
            importReadiness: 'blocked-sensitive',
            cleanupSignals: ['sensitive-credential-review'],
          },
        ],
        context: {
          privacyLevel: 'personal',
          redactionMode: 'strict',
          retentionPolicy: 'review-source',
        },
      });

    expect(response.status).toBe(201);
    expect(mockResolveLocalArchiveFile).toHaveBeenCalledTimes(1);
    expect(mockBuildCaseWikiLocalArchiveCatalogRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'test-user-123',
        writeGraph: false,
        candidate: expect.objectContaining({
          id: 'candidate-001',
          relativePath: 'Street Voices/System Innovation Partner List.docx',
        }),
      }),
    );
    expect(mockWriteCaseWikiGraphToNeo4j).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ kind: 'SourceFile' })]),
        edges: expect.arrayContaining([expect.objectContaining({ kind: 'GENERATED_WIKI_PAGE' })]),
      }),
    );
    expect(mockSaveCaseManagementWikiIngestion).toHaveBeenCalledTimes(1);
    expect(response.body).toEqual(
      expect.objectContaining({
        catalogedCount: 1,
        requestedCount: 2,
        skipped: [expect.objectContaining({ id: 'candidate-secret', reason: 'blocked-sensitive' })],
      }),
    );
    expect(response.body.wikiIngestionRecords[0]).toEqual(
      expect.objectContaining({
        id: 'local-catalog-candidate-001',
        status: 'metadata-only',
        graphStatus: 'written',
      }),
    );
  });

  it('reuses already cataloged local archive sources instead of duplicating source pages', async () => {
    wikiIngestions = [
      makeIngestion({
        fileId: 'local-catalog-candidate-001',
        originalName: 'System Innovation Partner List.docx',
        sha256: 'hash-candidate-001',
        archive: {
          reviewStatus: 'needs-human-review',
          lifeDomain: 'Partners',
          localArchive: {
            rootId: 'root-docs',
            relativePath: 'Street Voices/System Innovation Partner List.docx',
          },
        },
        generatedRecords: {
          ...makeIngestion().generatedRecords,
          frontendRecord: {
            id: 'local-catalog-candidate-001',
            fileName: 'System Innovation Partner List.docx',
            pageId: 'ingest:local-catalog-candidate-001',
            title: 'Ingested source: System Innovation Partner List.docx',
            status: 'metadata-only',
            sourceHash: 'hash-candidate-001',
            archive: {
              reviewStatus: 'needs-human-review',
              lifeDomain: 'Partners',
              localArchive: {
                rootId: 'root-docs',
                relativePath: 'Street Voices/System Innovation Partner List.docx',
              },
            },
          },
        },
      }),
    ];

    const response = await request(app)
      .post('/api/case-management/wiki/local-archive/catalog')
      .send({
        candidates: [
          {
            id: 'candidate-001',
            rootId: 'root-docs',
            rootLabel: 'Documents',
            relativePath: 'Street Voices/System Innovation Partner List.docx',
            displayPath: 'Documents/Street Voices/System Innovation Partner List.docx',
            fileName: 'System Innovation Partner List.docx',
            sourceHash: 'hash-candidate-001',
            importReadiness: 'cleanup-candidate',
            cleanupSignals: ['possible-copy'],
          },
        ],
        context: {
          privacyLevel: 'personal',
          redactionMode: 'strict',
          retentionPolicy: 'review-source',
        },
      });

    expect(response.status).toBe(200);
    expect(mockResolveLocalArchiveFile).not.toHaveBeenCalled();
    expect(mockBuildCaseWikiLocalArchiveCatalogRecord).not.toHaveBeenCalled();
    expect(mockSaveCaseManagementWikiIngestion).not.toHaveBeenCalled();
    expect(response.body).toEqual(
      expect.objectContaining({
        catalogedCount: 0,
        reusedCount: 1,
        requestedCount: 1,
        skipped: [
          expect.objectContaining({
            id: 'candidate-001',
            reason: 'already-cataloged',
            existingSourceId: 'local-catalog-candidate-001',
          }),
        ],
      }),
    );
    expect(response.body.wikiIngestionRecords[0]).toEqual(
      expect.objectContaining({
        id: 'local-catalog-candidate-001',
        pageId: 'ingest:local-catalog-candidate-001',
        archive: expect.objectContaining({ reviewStatus: 'needs-human-review' }),
      }),
    );
  });

  it('persists local archive source-family decisions into the workspace review ledger', async () => {
    mockGetCaseManagementWorkspace.mockResolvedValueOnce({
      version: 1,
      savedAt: '2026-05-02T12:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-02T12:00:00.000Z',
        localArchiveSelectedIds: ['candidate-source-family', 'candidate-ready'],
        localArchiveCampaign: {
          id: 'local-archive-campaign-whole-life',
          name: 'Whole-life wiki import',
          status: 'selecting',
          selectedIds: ['candidate-source-family', 'candidate-ready'],
        },
        localArchiveSourceFamilyDecisions: {},
        localArchiveSourceFamilyReviewLedger: [],
        auditRecords: [],
      },
    });

    const response = await request(app)
      .patch('/api/case-management/wiki/local-archive/source-family-decisions/candidate-source-family')
      .send({
        action: 'merge-into-canonical',
        selectedIds: ['candidate-ready'],
        candidate: {
          id: 'candidate-source-family',
          fileName: 'Systems Innovation Partner List final.csv',
          suggestedWikiTitle: 'Systems Innovation Partner List final',
          sourceHistory: {
            status: 'source-family-match',
            canonicalLineage: {
              groupId: 'lineage-systems-innovation',
              canonicalSource: {
                sourceId: 'local-catalog-canonical',
                sourceLabel: 'Systems Innovation Partner List',
                sourcePageId: 'ingest:local-catalog-canonical',
                sourceHash: 'hash-canonical',
              },
            },
          },
        },
        decision: {
          candidateId: 'candidate-source-family',
          action: 'merge-into-canonical',
          label: 'Systems Innovation Partner List final',
          decidedAt: '2026-05-02T12:05:00.000Z',
          canonicalLineageId: 'lineage-systems-innovation',
          note: 'Same source family; do not ingest separately yet.',
        },
      });

    expect(response.status).toBe(200);
    const savedWorkspace = mockSaveCaseManagementWorkspace.mock.calls[0][1];
    expect(savedWorkspace.localArchiveSourceFamilyDecisions['candidate-source-family']).toEqual(
      expect.objectContaining({
        action: 'merge-into-canonical',
        label: 'Systems Innovation Partner List final',
        canonicalSource: expect.objectContaining({
          sourceId: 'local-catalog-canonical',
          sourceLabel: 'Systems Innovation Partner List',
        }),
      }),
    );
    expect(savedWorkspace.localArchiveSelectedIds).toEqual(['candidate-ready']);
    expect(savedWorkspace.localArchiveCampaign).toEqual(
      expect.objectContaining({
        selectedIds: ['candidate-ready'],
      }),
    );
    expect(savedWorkspace.localArchiveSourceFamilyReviewLedger[0]).toEqual(
      expect.objectContaining({
        candidateId: 'candidate-source-family',
        action: 'merge-into-canonical',
        graphNodeId: 'local-archive-source-family-decision:candidate-source-family',
        graphWrite: false,
        vectorWrite: false,
        attachmentWrite: false,
        fileAction: false,
      }),
    );
    expect(savedWorkspace.auditRecords[0]).toEqual(
      expect.objectContaining({
        category: 'case-wiki-local-archive',
        kind: 'source-family-review',
        decision: 'merge-into-canonical',
      }),
    );
    expect(response.body.policy).toContain('does not write vectors');
  });

  it('syncs saved local archive source-family review decisions into Neo4j', async () => {
    mockGetCaseManagementWorkspace.mockResolvedValueOnce({
      version: 1,
      savedAt: '2026-05-02T12:10:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-02T12:10:00.000Z',
        localArchiveSourceFamilyDecisions: {
          'candidate-source-family': {
            candidateId: 'candidate-source-family',
            action: 'merge-into-canonical',
            label: 'Systems Innovation Partner List final',
            decidedAt: '2026-05-02T12:05:00.000Z',
          },
        },
        localArchiveSourceFamilyReviewLedger: [
          {
            id: 'source-family-review-001',
            candidateId: 'candidate-source-family',
            action: 'merge-into-canonical',
            label: 'Systems Innovation Partner List final',
            graphNodeId: 'local-archive-source-family-decision:candidate-source-family',
            graphWrite: false,
            vectorWrite: false,
            attachmentWrite: false,
            fileAction: false,
          },
        ],
        auditRecords: [],
      },
    });

    const response = await request(app)
      .post('/api/case-management/wiki/local-archive/source-family-decisions/candidate-source-family/graph-review')
      .send({});

    expect(response.status).toBe(200);
    expect(mockBuildCaseWikiLocalArchiveSourceFamilyDecisionGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'test-user-123',
        decisionRecord: expect.objectContaining({
          candidateId: 'candidate-source-family',
          action: 'merge-into-canonical',
        }),
      }),
    );
    expect(mockWriteCaseWikiGraphToNeo4j).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ kind: 'SourceFamilyReviewDecision' })]),
        edges: expect.arrayContaining([expect.objectContaining({ kind: 'HAS_SOURCE_FAMILY_REVIEW' })]),
      }),
    );
    const savedWorkspace = mockSaveCaseManagementWorkspace.mock.calls[0][1];
    expect(savedWorkspace.localArchiveSourceFamilyReviewLedger[0]).toEqual(
      expect.objectContaining({
        candidateId: 'candidate-source-family',
        graphWrite: true,
        neo4jStatus: 'written',
        neo4jNodeCount: 3,
        neo4jEdgeCount: 2,
      }),
    );
    expect(savedWorkspace.auditRecords[0]).toEqual(
      expect.objectContaining({
        kind: 'source-family-graph-review',
        status: 'written',
        decision: 'merge-into-canonical',
      }),
    );
    expect(response.body.sourceFamilyDecision).toEqual(
      expect.objectContaining({
        neo4jStatus: 'written',
        graphSummary: expect.objectContaining({
          nodeCount: 2,
          edgeCount: 1,
        }),
      }),
    );
    expect(response.body.policy).toContain('metadata into Neo4j only');
  });

  it('batch syncs reviewed local archive source-family decisions into Neo4j', async () => {
    mockGetCaseManagementWorkspace.mockResolvedValueOnce({
      version: 1,
      savedAt: '2026-05-02T12:20:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-02T12:20:00.000Z',
        localArchiveSourceFamilyDecisions: {
          'candidate-source-family-a': {
            candidateId: 'candidate-source-family-a',
            action: 'merge-into-canonical',
            label: 'Systems Innovation Partner List final',
            decidedAt: '2026-05-02T12:05:00.000Z',
          },
          'candidate-source-family-b': {
            candidateId: 'candidate-source-family-b',
            action: 'keep-separate',
            label: 'Street Voices archive notes',
            decidedAt: '2026-05-02T12:06:00.000Z',
          },
        },
        localArchiveSourceFamilyReviewLedger: [
          {
            id: 'source-family-review-a',
            candidateId: 'candidate-source-family-a',
            action: 'merge-into-canonical',
            label: 'Systems Innovation Partner List final',
            graphNodeId: 'local-archive-source-family-decision:candidate-source-family-a',
            graphWrite: false,
            vectorWrite: false,
            attachmentWrite: false,
            fileAction: false,
          },
          {
            id: 'source-family-review-b',
            candidateId: 'candidate-source-family-b',
            action: 'keep-separate',
            label: 'Street Voices archive notes',
            graphNodeId: 'local-archive-source-family-decision:candidate-source-family-b',
            graphWrite: false,
            vectorWrite: false,
            attachmentWrite: false,
            fileAction: false,
          },
        ],
        auditRecords: [],
      },
    });

    const response = await request(app)
      .post('/api/case-management/wiki/local-archive/source-family-decisions/graph-review-batch')
      .send({ limit: 10 });

    expect(response.status).toBe(200);
    expect(mockBuildCaseWikiLocalArchiveSourceFamilyDecisionGraph).toHaveBeenCalledTimes(2);
    expect(mockWriteCaseWikiGraphToNeo4j).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            id: 'local-archive-source-family-decision:candidate-source-family-a',
            kind: 'SourceFamilyReviewDecision',
          }),
          expect.objectContaining({
            id: 'local-archive-source-family-decision:candidate-source-family-b',
            kind: 'SourceFamilyReviewDecision',
          }),
        ]),
        edges: expect.arrayContaining([
          expect.objectContaining({ kind: 'HAS_SOURCE_FAMILY_REVIEW' }),
        ]),
      }),
    );
    const savedWorkspace = mockSaveCaseManagementWorkspace.mock.calls[0][1];
    expect(savedWorkspace.localArchiveSourceFamilyReviewLedger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          candidateId: 'candidate-source-family-a',
          graphWrite: true,
          neo4jStatus: 'written',
        }),
        expect.objectContaining({
          candidateId: 'candidate-source-family-b',
          graphWrite: true,
          neo4jStatus: 'written',
        }),
      ]),
    );
    expect(savedWorkspace.localArchiveSourceFamilyDecisions['candidate-source-family-a']).toEqual(
      expect.objectContaining({
        graphWrite: true,
        neo4jStatus: 'written',
      }),
    );
    expect(savedWorkspace.auditRecords[0]).toEqual(
      expect.objectContaining({
        kind: 'source-family-graph-review-batch',
        status: 'written',
        decision: 'batch-source-family-review',
      }),
    );
    expect(response.body.syncedCount).toBe(2);
    expect(response.body.policy).toContain('does not write Weaviate vectors');
  });

  it('creates a metadata-only local archive campaign schedule and audit record', async () => {
    const response = await request(app)
      .post('/api/case-management/wiki/local-archive/campaign-schedule')
      .send({
        currentCampaign: {
          id: 'local-archive-campaign-whole-life',
          name: 'Whole-life wiki import',
          status: 'selecting',
          query: '',
          selectedIds: ['candidate-001', 'candidate-002'],
          importedCount: 13,
          totalCandidates: 800,
          reviewCount: 84,
          cleanupCount: 21,
          blockedCount: 3,
          lastScannedAt: '2026-05-02T10:00:00.000Z',
        },
        checkpoints: [
          {
            id: 'checkpoint-ops',
            name: 'Street Voices operations',
            status: 'needs-review',
            selectedIds: ['candidate-ops'],
            totalCandidates: 42,
            reviewCount: 9,
            blockedCount: 1,
          },
        ],
        laneTemplates: [
          {
            id: 'whole-life',
            name: 'Whole-life wiki import',
            query: '',
            description: 'Broad pass across all archive roots.',
            domainHint: 'All life domains',
            rootsHint: 'Desktop, Documents, Downloads, Projects',
          },
          {
            id: 'street-voices-ops',
            name: 'Street Voices operations',
            query: 'street voices grant agreement',
            description: 'Street Voices operational records.',
            domainHint: 'Street Voices operations',
            rootsHint: 'Documents, Projects, Downloads',
          },
        ],
        activeJob: {
          jobId: 'job-123',
          status: 'processing',
          updatedAt: '2026-05-02T10:05:00.000Z',
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.workspaceSaved).toBe(true);
    expect(response.body.schedule).toEqual(
      expect.objectContaining({
        mode: 'metadata-only',
        scheduleStatus: 'previewed',
        laneCount: 2,
        totalSelectedSources: 3,
        totalReviewSources: 93,
        totalBlockedSources: 4,
      }),
    );
    expect(response.body.schedule.lanes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'whole-life',
          activeJobStatus: 'processing',
          nextAction: 'Monitor active background ingest',
          vectorGate: 'Weaviate writes stay blocked until chunk review approval',
        }),
        expect.objectContaining({
          id: 'street-voices-ops',
          checkpointCount: 1,
          nextAction: 'Start background ingest for selected sources',
        }),
      ]),
    );
    expect(response.body.auditRecord).toEqual(
      expect.objectContaining({
        action: 'previewed whole-life campaign schedule',
        kind: 'campaign-schedule',
        status: 'previewed',
      }),
    );
    expect(mockSaveCaseManagementWorkspace).toHaveBeenCalledWith(
      'test-user-123',
        expect.objectContaining({
          localArchiveCampaignSchedule: expect.objectContaining({
            scheduleStatus: 'previewed',
            nextAction: expect.stringContaining('Whole-life wiki import'),
          }),
          auditRecords: expect.arrayContaining([
            expect.objectContaining({ action: 'previewed whole-life campaign schedule' }),
          ]),
        }),
      );
  });

  it('starts a server-owned local archive campaign runner job for selected sources', async () => {
    const response = await request(app)
      .post('/api/case-management/wiki/local-archive/campaign-runner/next')
      .send({
        execute: true,
        currentCampaign: {
          id: 'local-archive-campaign-whole-life',
          name: 'Whole-life wiki import',
          status: 'selecting',
          selectedIds: ['candidate-001'],
          importedCount: 4,
          totalCandidates: 800,
          reviewCount: 12,
          cleanupCount: 4,
          blockedCount: 2,
          lastScannedAt: '2026-05-02T10:00:00.000Z',
        },
        laneTemplates: [
          {
            id: 'whole-life',
            name: 'Whole-life wiki import',
            query: '',
            description: 'Broad pass across all archive roots.',
            domainHint: 'All life domains',
            rootsHint: 'Desktop, Documents, Downloads, Projects',
          },
        ],
        selectedFiles: [
          readyLocalArchiveFile({
            rootId: 'root-docs',
            relativePath: 'Street Voices/System Innovation Partner List.docx',
          }),
        ],
        context: {
          privacyLevel: 'personal',
          redactionMode: 'strict',
          retentionPolicy: 'review-source',
        },
      });

    expect(response.status).toBe(202);
    expect(mockResolveLocalArchiveFile).toHaveBeenCalledWith({
      rootId: 'root-docs',
      relativePath: 'Street Voices/System Innovation Partner List.docx',
    });
    expect(mockCreateCaseManagementWikiIngestJob).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        status: 'queued',
        context: expect.objectContaining({
          localArchiveIngest: true,
          campaignRunner: true,
          sourceScope: 'standalone',
          privacyLevel: 'personal',
          redactionMode: 'strict',
          retentionPolicy: 'review-source',
        }),
        items: [
          expect.objectContaining({
            fileName: 'System Innovation Partner List.docx',
            storedName: 'Street Voices/System Innovation Partner List.docx',
            status: 'queued',
            localArchive: expect.objectContaining({
              rootId: 'root-docs',
              relativePath: 'Street Voices/System Innovation Partner List.docx',
            }),
          }),
        ],
      }),
    );
    expect(response.body.actionExecution).toEqual(
      expect.objectContaining({
        type: 'job-started',
        status: 'queued',
        laneId: 'whole-life',
      }),
    );
    expect(response.body.job).toEqual(
      expect.objectContaining({
        status: 'queued',
        total: 1,
      }),
    );
    expect(mockSaveCaseManagementWorkspace).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        localArchiveCampaignRunner: expect.objectContaining({
          mode: 'source-first-server-runner',
          lastAction: expect.objectContaining({ type: 'job-started' }),
        }),
        auditRecords: expect.arrayContaining([
          expect.objectContaining({
            action: 'started whole-life campaign runner job',
            kind: 'campaign-runner',
          }),
        ]),
      }),
    );
  });

  it('blocks campaign runner extraction when selected sources still need review', async () => {
    const response = await request(app)
      .post('/api/case-management/wiki/local-archive/campaign-runner/next')
      .send({
        execute: true,
        currentCampaign: {
          id: 'local-archive-campaign-whole-life',
          name: 'Whole-life wiki import',
          status: 'selecting',
          selectedIds: ['candidate-review-001'],
          totalCandidates: 800,
          reviewCount: 1,
          blockedCount: 0,
          lastScannedAt: '2026-05-02T10:00:00.000Z',
        },
        laneTemplates: [
          {
            id: 'whole-life',
            name: 'Whole-life wiki import',
            query: '',
            description: 'Broad pass across all archive roots.',
            domainHint: 'All life domains',
            rootsHint: 'Desktop, Documents, Downloads, Projects',
          },
        ],
        selectedFiles: [
          readyLocalArchiveFile({
            rootId: 'root-docs',
            relativePath: 'Street Voices/Needs Review Source.md',
            importReadiness: 'review-before-ingest',
            importPriority: 'review',
          }),
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.actionExecution).toEqual(
      expect.objectContaining({
        type: 'review-required',
        status: 'blocked',
        blockedCount: 1,
        message: expect.stringContaining('need review before extraction'),
      }),
    );
    expect(mockResolveLocalArchiveFile).not.toHaveBeenCalled();
    expect(mockCreateCaseManagementWikiIngestJob).not.toHaveBeenCalled();
  });

  it('runs a due local archive cadence automation without writing vectors', async () => {
    const response = await request(app)
      .post('/api/case-management/wiki/local-archive/campaign-automation/due')
      .send({
        execute: true,
        force: true,
        automation: {
          id: 'whole-life-hourly-runner',
          title: 'Whole-life hourly runner',
          status: 'active',
          cadence: 'hourly',
          runMode: 'start-selected-ingest',
          allowIngest: true,
          requireReviewBeforeRun: false,
          nextRunAt: '2026-05-02T10:00:00.000Z',
          runCount: 2,
        },
        currentCampaign: {
          id: 'local-archive-campaign-whole-life',
          name: 'Whole-life wiki import',
          status: 'selecting',
          selectedIds: ['candidate-001'],
          totalCandidates: 800,
          reviewCount: 12,
          blockedCount: 2,
          lastScannedAt: '2026-05-02T10:00:00.000Z',
        },
        laneTemplates: [
          {
            id: 'whole-life',
            name: 'Whole-life wiki import',
            query: '',
            description: 'Broad pass across all archive roots.',
            domainHint: 'All life domains',
            rootsHint: 'Desktop, Documents, Downloads, Projects',
          },
        ],
        selectedFiles: [
          readyLocalArchiveFile({
            rootId: 'root-docs',
            relativePath: 'Street Voices/System Innovation Partner List.docx',
          }),
        ],
        context: {
          privacyLevel: 'personal',
          redactionMode: 'strict',
          retentionPolicy: 'review-source',
        },
      });

    expect(response.status).toBe(202);
    expect(response.body.actionExecution).toEqual(
      expect.objectContaining({
        type: 'job-started',
        status: 'queued',
        laneId: 'whole-life',
      }),
    );
    expect(response.body.automation).toEqual(
      expect.objectContaining({
        id: 'whole-life-hourly-runner',
        status: 'active',
        cadence: 'hourly',
        runMode: 'start-selected-ingest',
        allowIngest: true,
        runCount: 3,
        lastAction: expect.objectContaining({ type: 'job-started' }),
      }),
    );
    expect(response.body.automation.nextRunAt).toBeTruthy();
    expect(mockCreateCaseManagementWikiIngestJob).toHaveBeenCalledTimes(1);
    expect(mockSaveCaseManagementWorkspace).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        localArchiveCampaignAutomation: expect.objectContaining({
          id: 'whole-life-hourly-runner',
          lastAction: expect.objectContaining({ type: 'job-started' }),
        }),
        auditRecords: expect.arrayContaining([
          expect.objectContaining({
            action: 'started due whole-life import automation job',
            kind: 'campaign-automation',
          }),
        ]),
      }),
    );
  });

  it('runs a saved-workspace local archive automation tick from persisted selected sources', async () => {
    const savedFiles = [
      {
        rootId: 'root-docs',
        relativePath: 'Street Voices/Saved Workspace Source.md',
      },
    ];
    const expectedSignature = selectedSourceConfirmationSignature(savedFiles);
    mockGetCaseManagementWorkspace.mockResolvedValue({
      version: 1,
      savedAt: '2026-05-02T10:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-02T10:00:00.000Z',
        auditRecords: [],
        localArchiveSelectedIds: ['candidate-saved-001'],
        localArchiveCampaignAutomation: {
          id: 'whole-life-saved-runner',
          title: 'Whole-life saved runner',
          status: 'active',
          cadence: 'daily',
          runMode: 'start-selected-ingest',
          allowIngest: true,
          selectedSourceConfirmation: {
            signature: expectedSignature,
            count: 1,
            confirmedAt: '2026-05-02T09:00:00.000Z',
            source: 'saved-workspace-operator',
          },
          nextRunAt: '2026-05-01T10:00:00.000Z',
          runCount: 1,
        },
        localArchiveCampaign: {
          id: 'local-archive-campaign-whole-life',
          name: 'Whole-life wiki import',
          status: 'selecting',
          selectedIds: ['candidate-saved-001'],
          totalCandidates: 800,
          reviewCount: 8,
          blockedCount: 1,
        },
        localArchiveScan: {
          candidates: [
            readyLocalArchiveFile({
              id: 'candidate-saved-001',
              rootId: savedFiles[0].rootId,
              relativePath: savedFiles[0].relativePath,
            }),
          ],
        },
      },
    });

    const response = await request(app)
      .post('/api/case-management/wiki/local-archive/campaign-automation/server-tick')
      .send({
        execute: true,
        force: true,
      });

    expect(response.status).toBe(202);
    expect(response.body.source).toBe('server-saved-workspace');
    expect(response.body.selectedFileCount).toBe(1);
    expect(response.body.actionExecution).toEqual(
      expect.objectContaining({
        type: 'job-started',
        status: 'queued',
        laneId: 'whole-life',
      }),
    );
    expect(mockResolveLocalArchiveFile).toHaveBeenCalledWith({
      rootId: 'root-docs',
      relativePath: 'Street Voices/Saved Workspace Source.md',
    });
    expect(mockCreateCaseManagementWikiIngestJob).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        context: expect.objectContaining({
          localArchiveIngest: true,
          campaignRunner: true,
          sourceScope: 'standalone',
          privacyLevel: 'personal',
          redactionMode: 'strict',
          retentionPolicy: 'review-source',
        }),
      }),
    );
    expect(mockSaveCaseManagementWorkspace).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        localArchiveCampaignAutomation: expect.objectContaining({
          id: 'whole-life-saved-runner',
          runCount: 2,
          lastAction: expect.objectContaining({ type: 'job-started' }),
        }),
        auditRecords: expect.arrayContaining([
          expect.objectContaining({
            actor: 'Case Wiki server automation tick',
            action: 'started due whole-life import automation job',
            kind: 'campaign-automation',
            detail: expect.stringContaining('server-tick'),
          }),
        ]),
      }),
    );
  });

  it('builds a saved-workspace daemon queue without starting ingest', async () => {
    mockGetCaseManagementWorkspace.mockResolvedValue({
      version: 1,
      savedAt: '2026-05-02T10:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-02T10:00:00.000Z',
        auditRecords: [],
        localArchiveSelectedIds: ['candidate-saved-001'],
        localArchiveCampaignAutomation: {
          id: 'whole-life-daemon-runner',
          title: 'Whole-life daemon runner',
          status: 'active',
          cadence: 'daily',
          runMode: 'start-selected-ingest',
          allowIngest: true,
          nextRunAt: '2026-05-01T10:00:00.000Z',
          runCount: 4,
        },
        localArchiveCampaign: {
          id: 'local-archive-campaign-whole-life',
          name: 'Whole-life wiki import',
          status: 'selecting',
          selectedIds: ['candidate-saved-001'],
          totalCandidates: 800,
          reviewCount: 8,
          blockedCount: 1,
        },
        localArchiveCampaigns: [
          {
            id: 'local-archive-campaign-street-voices-ops',
            name: 'Street Voices operations',
            status: 'needs-review',
            selectedIds: ['candidate-ops'],
            importedCount: 7,
            reviewCount: 14,
            blockedCount: 2,
            totalCandidates: 41,
          },
        ],
        localArchiveScan: {
          candidates: [
            readyLocalArchiveFile({
              id: 'candidate-saved-001',
              rootId: 'root-docs',
              relativePath: 'Street Voices/Saved Workspace Source.md',
            }),
          ],
        },
      },
    });

    const response = await request(app)
      .post('/api/case-management/wiki/local-archive/campaign-automation/daemon-queue')
      .send({ force: true });

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('server-saved-workspace-daemon-queue');
    expect(response.body.selectedFileCount).toBe(1);
    expect(response.body.queue).toEqual(
      expect.objectContaining({
        mode: 'saved-workspace-daemon-queue',
        queueStatus: 'due',
        runnableCount: 0,
        selectedFileCount: 1,
        confirmationRequired: true,
        selectedSourcesConfirmed: false,
        daemonEnvironment: expect.objectContaining({
          schedulerEnabled: false,
          executeEnabled: false,
          mode: 'dry-run-only',
          vectorProvider: 'weaviate',
          vectorWritesEnabled: false,
        }),
        notificationHandoff: expect.arrayContaining([
          expect.objectContaining({
            id: 'daemon-env-disabled',
            title: 'Daemon scheduler is disabled',
            target: 'case-wiki-workflow-inbox',
          }),
          expect.objectContaining({
            id: 'daemon-execute-dry-run',
            title: 'Daemon is dry-run only',
          }),
          expect.objectContaining({
            id: 'daemon-source-confirmation-needed',
            actionLabel: 'Confirm sources',
          }),
          expect.objectContaining({
            id: 'daemon-vector-review-gate',
          }),
        ]),
      }),
    );
    expect(response.body.queue.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          laneId: 'whole-life',
          queueStatus: 'confirmation-required',
          canStartIngest: false,
          serverSelectedFileCount: 1,
          guard: expect.stringContaining('Confirm the saved selected-source batch'),
        }),
        expect.objectContaining({
          laneId: 'street-voices-ops',
          canStartIngest: false,
        }),
      ]),
    );
    expect(mockResolveLocalArchiveFile).not.toHaveBeenCalled();
    expect(mockCreateCaseManagementWikiIngestJob).not.toHaveBeenCalled();
    expect(mockSaveCaseManagementWorkspace).not.toHaveBeenCalled();
  });

  it('blocks a saved-workspace daemon pass until selected sources are confirmed', async () => {
    mockGetCaseManagementWorkspace.mockResolvedValue({
      version: 1,
      savedAt: '2026-05-02T10:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-02T10:00:00.000Z',
        auditRecords: [],
        localArchiveSelectedIds: ['candidate-saved-001'],
        localArchiveCampaignAutomation: {
          id: 'whole-life-daemon-runner',
          title: 'Whole-life daemon runner',
          status: 'active',
          cadence: 'daily',
          runMode: 'start-selected-ingest',
          allowIngest: true,
          nextRunAt: '2026-05-01T10:00:00.000Z',
          runCount: 4,
        },
        localArchiveCampaign: {
          id: 'local-archive-campaign-whole-life',
          name: 'Whole-life wiki import',
          status: 'selecting',
          selectedIds: ['candidate-saved-001'],
          totalCandidates: 800,
          reviewCount: 8,
          blockedCount: 1,
        },
        localArchiveScan: {
          candidates: [
            readyLocalArchiveFile({
              id: 'candidate-saved-001',
              rootId: 'root-docs',
              relativePath: 'Street Voices/Saved Workspace Source.md',
            }),
          ],
        },
      },
    });

    const response = await request(app)
      .post('/api/case-management/wiki/local-archive/campaign-automation/daemon/run')
      .send({ force: true });

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('server-saved-workspace-daemon-run');
    expect(response.body.run).toEqual(
      expect.objectContaining({
        mode: 'closed-browser-daemon-pass',
        daemonEnvironment: expect.objectContaining({
          schedulerEnabled: false,
          executeEnabled: false,
          mode: 'dry-run-only',
        }),
        checkedCount: 1,
        startedJobCount: 0,
        readyCount: 0,
        blockedCount: 1,
        selectedFileCount: 1,
      }),
    );
    expect(response.body.run.results).toEqual([
      expect.objectContaining({
        userId: 'test-user-123',
        selectedFileCount: 1,
        daemonRunRecord: expect.objectContaining({
          type: 'confirmation-required',
          status: 'blocked',
          selectedFileCount: 1,
          startedIngest: false,
        }),
        actionExecution: expect.objectContaining({
          type: 'confirmation-required',
          status: 'blocked',
          laneId: 'whole-life',
        }),
      }),
    ]);
    expect(mockResolveLocalArchiveFile).not.toHaveBeenCalled();
    expect(mockCreateCaseManagementWikiIngestJob).not.toHaveBeenCalled();
    expect(mockSaveCaseManagementWorkspace).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        localArchiveCampaignAutomation: expect.objectContaining({
          id: 'whole-life-daemon-runner',
          runCount: 5,
          lastAction: expect.objectContaining({ type: 'confirmation-required' }),
        }),
        localArchiveCampaignDaemonRuns: [
          expect.objectContaining({
            type: 'confirmation-required',
            status: 'blocked',
            selectedFileCount: 1,
            startedIngest: false,
          }),
        ],
        auditRecords: expect.arrayContaining([
          expect.objectContaining({
            actor: 'Case Wiki closed-browser daemon',
            detail: expect.stringContaining('daemon'),
            kind: 'campaign-automation',
          }),
        ]),
      }),
    );
  });

  it('confirms a saved selected-source batch for daemon automation', async () => {
    const savedFiles = [
      {
        rootId: 'root-docs',
        relativePath: 'Street Voices/Saved Workspace Source.md',
      },
    ];
    const expectedSignature = selectedSourceConfirmationSignature(savedFiles);
    mockGetCaseManagementWorkspace.mockResolvedValue({
      version: 1,
      savedAt: '2026-05-02T10:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-02T10:00:00.000Z',
        auditRecords: [],
        localArchiveSelectedIds: ['candidate-saved-001'],
        localArchiveCampaignAutomation: {
          id: 'whole-life-daemon-runner',
          title: 'Whole-life daemon runner',
          status: 'active',
          cadence: 'daily',
          runMode: 'start-selected-ingest',
          allowIngest: true,
          nextRunAt: '2026-05-01T10:00:00.000Z',
          runCount: 4,
        },
        localArchiveCampaign: {
          id: 'local-archive-campaign-whole-life',
          name: 'Whole-life wiki import',
          status: 'selecting',
          selectedIds: ['candidate-saved-001'],
          totalCandidates: 800,
          reviewCount: 0,
          blockedCount: 0,
        },
        localArchiveScan: {
          candidates: [
            readyLocalArchiveFile({
              id: 'candidate-saved-001',
              rootId: savedFiles[0].rootId,
              relativePath: savedFiles[0].relativePath,
            }),
          ],
        },
      },
    });

    const response = await request(app)
      .post('/api/case-management/wiki/local-archive/campaign-automation/confirm-selected-sources')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.selectedFileCount).toBe(1);
    expect(response.body.selectedSourceSignature).toBe(expectedSignature);
    expect(response.body.automation).toEqual(
      expect.objectContaining({
        requireReviewBeforeRun: true,
        selectedSourceConfirmation: expect.objectContaining({
          signature: expectedSignature,
          count: 1,
          source: 'saved-workspace-operator',
        }),
      }),
    );
    expect(response.body.queue).toEqual(
      expect.objectContaining({
        runnableCount: 1,
        selectedSourcesConfirmed: true,
        confirmationRequired: false,
      }),
    );
    expect(mockSaveCaseManagementWorkspace).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        localArchiveCampaignAutomation: expect.objectContaining({
          selectedSourceConfirmation: expect.objectContaining({
            signature: expectedSignature,
            count: 1,
          }),
        }),
        auditRecords: expect.arrayContaining([
          expect.objectContaining({
            action: 'confirmed whole-life daemon selected sources',
            kind: 'campaign-automation',
            status: 'confirmed',
          }),
        ]),
      }),
    );
  });

  it('builds a controlled live-run rehearsal checklist without starting ingest', async () => {
    const savedFiles = [
      {
        rootId: 'root-docs',
        relativePath: 'Street Voices/Rehearsal Source A.md',
      },
      {
        rootId: 'root-docs',
        relativePath: 'Street Voices/Rehearsal Source B.md',
      },
    ];
    const expectedSignature = selectedSourceConfirmationSignature(savedFiles);
    mockGetCaseManagementWorkspace.mockResolvedValue({
      version: 1,
      savedAt: '2026-05-02T10:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-02T10:00:00.000Z',
        auditRecords: [],
        localArchiveSelectedIds: ['candidate-rehearsal-a', 'candidate-rehearsal-b'],
        localArchiveCampaignAutomation: {
          id: 'whole-life-daemon-runner',
          title: 'Whole-life daemon runner',
          status: 'active',
          cadence: 'daily',
          runMode: 'start-selected-ingest',
          allowIngest: true,
          requireReviewBeforeRun: true,
          nextRunAt: '2026-05-01T10:00:00.000Z',
          runCount: 4,
          selectedSourceConfirmation: {
            signature: expectedSignature,
            count: savedFiles.length,
            confirmedAt: '2026-05-02T10:02:00.000Z',
            source: 'saved-workspace-operator',
            confirmedBy: 'test-user-123',
          },
        },
        localArchiveCampaign: {
          id: 'local-archive-campaign-whole-life',
          name: 'Whole-life wiki import',
          status: 'selecting',
          selectedIds: ['candidate-rehearsal-a', 'candidate-rehearsal-b'],
          totalCandidates: 800,
          reviewCount: 0,
          blockedCount: 0,
        },
        localArchiveScan: {
          candidates: [
            readyLocalArchiveFile({
              id: 'candidate-rehearsal-a',
              rootId: savedFiles[0].rootId,
              relativePath: savedFiles[0].relativePath,
            }),
            readyLocalArchiveFile({
              id: 'candidate-rehearsal-b',
              rootId: savedFiles[1].rootId,
              relativePath: savedFiles[1].relativePath,
            }),
          ],
        },
      },
    });

    const response = await request(app)
      .post('/api/case-management/wiki/local-archive/campaign-automation/daemon/rehearsal')
      .send({ recommendedBatchMax: 3 });

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('server-saved-workspace-daemon-rehearsal');
    expect(response.body.selectedFileCount).toBe(2);
    expect(response.body.rehearsal).toEqual(
      expect.objectContaining({
        mode: 'controlled-live-run-rehearsal',
        selectedFileCount: 2,
        resolvedFileCount: 2,
        unresolvedFileCount: 0,
        readyQueueCount: 1,
        readyForPlanOnlyPass: true,
        readyForLiveRehearsal: false,
        status: 'blocked',
        recommendedBatchMax: 3,
      }),
    );
    expect(response.body.rehearsal.checklist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'daemon-execute-env',
          status: 'blocked',
          critical: true,
        }),
        expect.objectContaining({
          id: 'selected-source-confirmation',
          status: 'passed',
        }),
        expect.objectContaining({
          id: 'small-rehearsal-batch',
          status: 'passed',
        }),
        expect.objectContaining({
          id: 'server-source-resolution',
          status: 'passed',
        }),
        expect.objectContaining({
          id: 'weaviate-review-gate',
          status: 'passed',
        }),
      ]),
    );
    expect(response.body.rehearsal.launchChecklist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'launch-tiny-server-resolved-batch',
          status: 'passed',
        }),
        expect.objectContaining({
          id: 'launch-confirm-current-batch',
          status: 'passed',
        }),
        expect.objectContaining({
          id: 'launch-live-env',
          status: 'blocked',
          critical: true,
        }),
      ]),
    );
    expect(response.body.rehearsal.launchBlockers).toEqual([
      expect.objectContaining({ id: 'launch-live-env' }),
      expect.objectContaining({ id: 'launch-one-watched-pass' }),
    ]);
    expect(response.body.rehearsal.launchPolicy).toContain('does not start ingest');
    expect(response.body.rehearsal.blockers).toEqual([
      expect.objectContaining({ id: 'daemon-execute-env' }),
    ]);
    expect(response.body.rehearsal.sampleSources).toEqual([
      expect.objectContaining({
        relativePath: savedFiles[0].relativePath,
        status: 'resolved',
      }),
      expect.objectContaining({
        relativePath: savedFiles[1].relativePath,
        status: 'resolved',
      }),
    ]);
    expect(response.body.queue).toEqual(
      expect.objectContaining({
        runnableCount: 1,
        selectedSourcesConfirmed: true,
        confirmationRequired: false,
      }),
    );
    expect(mockResolveLocalArchiveFile).toHaveBeenCalledTimes(2);
    expect(mockCreateCaseManagementWikiIngestJob).not.toHaveBeenCalled();
    expect(mockSaveCaseManagementWorkspace).not.toHaveBeenCalled();
  });

  it('creates a tiny daemon rehearsal batch while preserving the full whole-life selection', async () => {
    const savedFiles = [
      { rootId: 'root-docs', relativePath: 'Street Voices/Rehearsal Source A.md' },
      { rootId: 'root-docs', relativePath: 'Street Voices/Rehearsal Source B.md' },
      { rootId: 'root-docs', relativePath: 'Street Voices/Rehearsal Source C.md' },
      { rootId: 'root-docs', relativePath: 'Street Voices/Full Batch Source D.md' },
    ];
    mockGetCaseManagementWorkspace.mockResolvedValue({
      version: 1,
      savedAt: '2026-05-02T10:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-02T10:00:00.000Z',
        auditRecords: [],
        localArchiveSelectedIds: [
          'candidate-rehearsal-a',
          'candidate-rehearsal-b',
          'candidate-rehearsal-c',
          'candidate-full-d',
        ],
        localArchiveCampaignAutomation: {
          id: 'whole-life-daemon-runner',
          title: 'Whole-life daemon runner',
          status: 'active',
          cadence: 'daily',
          runMode: 'start-selected-ingest',
          allowIngest: true,
          requireReviewBeforeRun: true,
          selectedSourceConfirmation: {
            signature: selectedSourceConfirmationSignature(savedFiles),
            count: savedFiles.length,
            confirmedAt: '2026-05-02T10:02:00.000Z',
            source: 'saved-workspace-operator',
            confirmedBy: 'test-user-123',
          },
        },
        localArchiveCampaign: {
          id: 'local-archive-campaign-whole-life',
          name: 'Whole-life wiki import',
          status: 'selecting',
          selectedIds: [
            'candidate-rehearsal-a',
            'candidate-rehearsal-b',
            'candidate-rehearsal-c',
            'candidate-full-d',
          ],
          totalCandidates: 800,
          reviewCount: 0,
          blockedCount: 0,
        },
        localArchiveScan: {
          candidates: [
            readyLocalArchiveFile({
              id: 'candidate-rehearsal-a',
              rootId: savedFiles[0].rootId,
              relativePath: savedFiles[0].relativePath,
            }),
            readyLocalArchiveFile({
              id: 'candidate-rehearsal-b',
              rootId: savedFiles[1].rootId,
              relativePath: savedFiles[1].relativePath,
            }),
            readyLocalArchiveFile({
              id: 'candidate-rehearsal-c',
              rootId: savedFiles[2].rootId,
              relativePath: savedFiles[2].relativePath,
            }),
            readyLocalArchiveFile({
              id: 'candidate-full-d',
              rootId: savedFiles[3].rootId,
              relativePath: savedFiles[3].relativePath,
            }),
          ],
        },
      },
    });

    const response = await request(app)
      .post('/api/case-management/wiki/local-archive/campaign-automation/daemon/rehearsal-batch')
      .send({ recommendedBatchMax: 3 });

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('server-saved-workspace-daemon-rehearsal-batch');
    expect(response.body.selectedFileCount).toBe(3);
    expect(response.body.preservedSelectedCount).toBe(4);
    expect(response.body.rehearsalSelection).toEqual(
      expect.objectContaining({
        enabled: true,
        selectedIds: ['candidate-rehearsal-a', 'candidate-rehearsal-b', 'candidate-rehearsal-c'],
        sourceSelectedCount: 4,
        selectedCount: 3,
        selectedSourceSignature: selectedSourceConfirmationSignature(savedFiles.slice(0, 3)),
      }),
    );
    expect(response.body.queue).toEqual(
      expect.objectContaining({
        selectedFileCount: 3,
        selectedSourcesConfirmed: false,
        confirmationRequired: true,
      }),
    );
    expect(response.body.rehearsal).toEqual(
      expect.objectContaining({
        selectedFileCount: 3,
        resolvedFileCount: 3,
        recommendedBatchMax: 3,
      }),
    );
    expect(response.body.rehearsal.launchChecklist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'launch-tiny-server-resolved-batch',
          status: 'passed',
        }),
        expect.objectContaining({
          id: 'launch-confirm-current-batch',
          status: 'blocked',
          actionLabel: 'Confirm sources',
        }),
      ]),
    );
    expect(mockResolveLocalArchiveFile).toHaveBeenCalledTimes(6);
    expect(mockCreateCaseManagementWikiIngestJob).not.toHaveBeenCalled();
    expect(mockSaveCaseManagementWorkspace).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        localArchiveSelectedIds: [
          'candidate-rehearsal-a',
          'candidate-rehearsal-b',
          'candidate-rehearsal-c',
          'candidate-full-d',
        ],
        localArchiveCampaign: expect.objectContaining({
          selectedIds: [
            'candidate-rehearsal-a',
            'candidate-rehearsal-b',
            'candidate-rehearsal-c',
            'candidate-full-d',
          ],
          rehearsalSelection: expect.objectContaining({
            enabled: true,
            selectedIds: ['candidate-rehearsal-a', 'candidate-rehearsal-b', 'candidate-rehearsal-c'],
          }),
        }),
        localArchiveCampaignAutomation: expect.objectContaining({
          requireReviewBeforeRun: true,
          selectedSourceConfirmation: null,
        }),
        auditRecords: expect.arrayContaining([
          expect.objectContaining({
            action: 'created controlled whole-life rehearsal batch',
            kind: 'campaign-automation',
            status: 'prepared',
          }),
        ]),
      }),
    );
  });

  it('restores the full daemon selection after a temporary rehearsal batch', async () => {
    const savedFiles = [
      { rootId: 'root-docs', relativePath: 'Street Voices/Rehearsal Source A.md' },
      { rootId: 'root-docs', relativePath: 'Street Voices/Rehearsal Source B.md' },
      { rootId: 'root-docs', relativePath: 'Street Voices/Rehearsal Source C.md' },
      { rootId: 'root-docs', relativePath: 'Street Voices/Full Batch Source D.md' },
    ];
    mockGetCaseManagementWorkspace.mockResolvedValue({
      version: 1,
      savedAt: '2026-05-02T10:00:00.000Z',
      workspace: {
        version: 1,
        savedAt: '2026-05-02T10:00:00.000Z',
        auditRecords: [],
        localArchiveSelectedIds: [
          'candidate-rehearsal-a',
          'candidate-rehearsal-b',
          'candidate-rehearsal-c',
          'candidate-full-d',
        ],
        localArchiveCampaignAutomation: {
          id: 'whole-life-daemon-runner',
          title: 'Whole-life daemon runner',
          status: 'active',
          cadence: 'daily',
          runMode: 'start-selected-ingest',
          allowIngest: true,
          requireReviewBeforeRun: true,
          selectedSourceConfirmation: {
            signature: selectedSourceConfirmationSignature(savedFiles.slice(0, 3)),
            count: 3,
            confirmedAt: '2026-05-02T10:02:00.000Z',
            source: 'saved-workspace-operator',
            confirmedBy: 'test-user-123',
          },
        },
        localArchiveCampaign: {
          id: 'local-archive-campaign-whole-life',
          name: 'Whole-life wiki import',
          status: 'selecting',
          selectedIds: [
            'candidate-rehearsal-a',
            'candidate-rehearsal-b',
            'candidate-rehearsal-c',
            'candidate-full-d',
          ],
          rehearsalSelection: {
            enabled: true,
            selectedIds: ['candidate-rehearsal-a', 'candidate-rehearsal-b', 'candidate-rehearsal-c'],
            sourceSelectedCount: 4,
            selectedCount: 3,
          },
          totalCandidates: 800,
          reviewCount: 0,
          blockedCount: 0,
        },
        localArchiveScan: {
          candidates: [
            readyLocalArchiveFile({
              id: 'candidate-rehearsal-a',
              rootId: savedFiles[0].rootId,
              relativePath: savedFiles[0].relativePath,
            }),
            readyLocalArchiveFile({
              id: 'candidate-rehearsal-b',
              rootId: savedFiles[1].rootId,
              relativePath: savedFiles[1].relativePath,
            }),
            readyLocalArchiveFile({
              id: 'candidate-rehearsal-c',
              rootId: savedFiles[2].rootId,
              relativePath: savedFiles[2].relativePath,
            }),
            readyLocalArchiveFile({
              id: 'candidate-full-d',
              rootId: savedFiles[3].rootId,
              relativePath: savedFiles[3].relativePath,
            }),
          ],
        },
      },
    });

    const response = await request(app)
      .delete('/api/case-management/wiki/local-archive/campaign-automation/daemon/rehearsal-batch')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('server-saved-workspace-daemon-rehearsal-batch-restore');
    expect(response.body.selectedFileCount).toBe(4);
    expect(response.body.campaign.rehearsalSelection).toEqual(
      expect.objectContaining({
        enabled: false,
      }),
    );
    expect(response.body.queue).toEqual(
      expect.objectContaining({
        selectedFileCount: 4,
        selectedSourcesConfirmed: false,
        confirmationRequired: true,
      }),
    );
    expect(mockSaveCaseManagementWorkspace).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        localArchiveCampaign: expect.objectContaining({
          rehearsalSelection: expect.objectContaining({
            enabled: false,
          }),
        }),
        localArchiveCampaignAutomation: expect.objectContaining({
          requireReviewBeforeRun: true,
          selectedSourceConfirmation: null,
        }),
        auditRecords: expect.arrayContaining([
          expect.objectContaining({
            action: 'restored full whole-life selected batch',
            kind: 'campaign-automation',
            status: 'restored',
          }),
        ]),
      }),
    );
  });

  it('refuses local archive catalog batches when every candidate is blocked', async () => {
    const response = await request(app)
      .post('/api/case-management/wiki/local-archive/catalog')
      .send({
        candidates: [
          {
            id: 'candidate-secret',
            rootId: 'root-docs',
            rootLabel: 'Documents',
            relativePath: 'Secrets/api-key.txt',
            fileName: 'api-key.txt',
            importReadiness: 'blocked-sensitive',
            cleanupSignals: ['sensitive-credential-review'],
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(mockBuildCaseWikiLocalArchiveCatalogRecord).not.toHaveBeenCalled();
    expect(response.body.skipped).toEqual([
      expect.objectContaining({ id: 'candidate-secret', reason: 'blocked-sensitive' }),
    ]);
  });

  it('extracts a cataloged local archive source into review chunks without vector writes', async () => {
    wikiIngestions = [
      makeIngestion({
        fileId: 'local-catalog-candidate-001',
        originalName: 'System Innovation Partner List.docx',
        archive: {
          reviewStatus: 'needs-human-review',
          lifeDomain: 'Partners',
          sourceKind: 'document',
          catalogOnly: true,
          cleanupSignals: [],
          localArchive: {
            rootId: 'root-docs',
            rootLabel: 'Documents',
            relativePath: 'Street Voices/System Innovation Partner List.docx',
          },
        },
        extraction: {
          status: 'metadata-only',
          method: 'local archive metadata catalog',
          textPreview: 'catalog only',
        },
        embeddingReview: {
          status: 'metadata-only',
          chunks: [],
          pendingCount: 0,
        },
        wikiPage: {
          id: 'ingest:local-catalog-candidate-001',
          title: 'Ingested source: System Innovation Partner List.docx',
        },
        generatedRecords: {
          ...makeIngestion().generatedRecords,
          frontendRecord: {
            ...makeIngestion().generatedRecords.frontendRecord,
            id: 'local-catalog-candidate-001',
            pageId: 'ingest:local-catalog-candidate-001',
            fileName: 'System Innovation Partner List.docx',
            status: 'metadata-only',
            archive: {
              reviewStatus: 'needs-human-review',
              catalogOnly: true,
              localArchive: {
                rootId: 'root-docs',
                rootLabel: 'Documents',
                relativePath: 'Street Voices/System Innovation Partner List.docx',
              },
            },
          },
          auditRecords: [],
        },
      }),
    ];

    const response = await request(app)
      .post('/api/case-management/wiki/ingestions/local-catalog-candidate-001/extract')
      .send({
        context: {
          privacyLevel: 'personal',
          redactionMode: 'strict',
          retentionPolicy: 'review-source',
        },
      });

    expect(response.status).toBe(200);
    expect(mockResolveLocalArchiveFile).toHaveBeenCalledWith({
      rootId: 'root-docs',
      relativePath: 'Street Voices/System Innovation Partner List.docx',
    });
    expect(mockBuildCaseWikiLocalArchiveExtractionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'test-user-123',
        existing: expect.objectContaining({ fileId: 'local-catalog-candidate-001' }),
        localFile: expect.objectContaining({
          relativePath: 'Street Voices/System Innovation Partner List.docx',
        }),
        writeGraph: true,
      }),
    );
    expect(mockUpdateCaseManagementWikiIngestionReview).toHaveBeenCalledWith(
      'test-user-123',
      'local-catalog-candidate-001',
      expect.objectContaining({
        sourceScope: 'standalone',
        weaviateDryRun: null,
        extraction: expect.objectContaining({ status: 'ready' }),
        embeddingReview: expect.objectContaining({ status: 'pending-review' }),
      }),
    );
    expect(response.body.wikiIngestionRecord).toEqual(
      expect.objectContaining({
        id: 'local-catalog-candidate-001',
        status: 'ready',
        embeddingReview: expect.objectContaining({ status: 'pending-review' }),
      }),
    );
    expect(response.body.generatedRecords.auditRecords[0].action).toBe('extracted local archive source for review');
  });

  it('batch extracts selected local archive sources into review chunks without vector writes', async () => {
    const makeLocalCatalog = (fileId, relativePath) =>
      makeIngestion({
        fileId,
        originalName: relativePath.split('/').pop(),
        storedName: relativePath,
        sourceScope: 'standalone',
        archive: {
          reviewStatus: 'needs-human-review',
          lifeDomain: 'Projects',
          sourceKind: 'document',
          suggestedWikiTitle: relativePath.split('/').pop(),
          catalogOnly: true,
          cleanupSignals: [],
          localArchive: {
            rootId: 'root-docs',
            rootLabel: 'Documents',
            relativePath,
          },
        },
        generatedRecords: {
          ...makeIngestion().generatedRecords,
          frontendRecord: {
            ...makeIngestion().generatedRecords.frontendRecord,
            id: fileId,
            pageId: `ingest:${fileId}`,
            fileName: relativePath.split('/').pop(),
            status: 'metadata-only',
            archive: {
              reviewStatus: 'needs-human-review',
              catalogOnly: true,
              localArchive: {
                rootId: 'root-docs',
                rootLabel: 'Documents',
                relativePath,
              },
            },
          },
          auditRecords: [],
        },
      });
    wikiIngestions = [
      makeLocalCatalog('local-catalog-001', 'Street Voices/Agreement One.md'),
      makeLocalCatalog('local-catalog-002', 'Street Voices/Agreement Two.md'),
      makeIngestion({
        fileId: 'blocked-local-catalog',
        archive: {
          reviewStatus: 'needs-human-review',
          catalogOnly: true,
          importReadiness: 'blocked-sensitive',
          cleanupSignals: ['sensitive-credential-review'],
          localArchive: {
            rootId: 'root-docs',
            rootLabel: 'Documents',
            relativePath: 'Secrets/API Keys.txt',
          },
        },
      }),
    ];

    const response = await request(app)
      .post('/api/case-management/wiki/ingestions/archive/extract/batch')
      .send({
        fileIds: ['local-catalog-001', 'local-catalog-002', 'blocked-local-catalog', 'missing-source'],
        context: {
          privacyLevel: 'personal',
          redactionMode: 'strict',
          retentionPolicy: 'review-source',
        },
      });

    expect(response.status).toBe(200);
    expect(mockResolveLocalArchiveFile).toHaveBeenCalledTimes(2);
    expect(mockBuildCaseWikiLocalArchiveExtractionRecord).toHaveBeenCalledTimes(2);
    expect(mockUpdateCaseManagementWikiIngestionReview).toHaveBeenCalledTimes(2);
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        requested: 4,
        extracted: 2,
        skipped: 2,
        failed: 0,
      }),
    );
    expect(response.body.wikiIngestionRecords).toHaveLength(2);
    expect(response.body.wikiIngestionRecords[0]).toEqual(
      expect.objectContaining({
        status: 'ready',
        embeddingReview: expect.objectContaining({ status: 'pending-review' }),
      }),
    );
    expect(response.body.generatedRecords.auditRecords).toHaveLength(2);
    expect(response.body.generatedRecords.auditRecords[0].action).toBe('batch extracted local archive source for review');
  });

  it('batch reviews only standalone source documents and skips already attached records', async () => {
    wikiIngestions = [
      makeIngestion({
        fileId: 'source-001',
        originalName: 'Standalone Source One.md',
        sha256: 'hash-source-001',
      }),
      makeIngestion({
        fileId: 'source-002',
        originalName: 'Standalone Source Two.md',
        sha256: 'hash-source-002',
        generatedRecords: {
          ...makeIngestion().generatedRecords,
          frontendRecord: {
            ...makeIngestion().generatedRecords.frontendRecord,
            id: 'source-002',
            pageId: 'ingest:source-002',
            title: 'Standalone Source Two',
            sourceHash: 'hash-source-002',
          },
        },
      }),
      makeIngestion({
        fileId: 'source-attached',
        originalName: 'Already Attached Source.md',
        sha256: 'hash-attached',
        sourceScope: 'current-record',
        linkedClientId: 'client-001',
        archive: {
          reviewStatus: 'attached-to-record',
          suggestedWikiTitle: 'Already Attached Source',
          attachmentTarget: {
            targetType: 'client',
            targetId: 'client-001',
            targetLabel: 'Maya Chen',
          },
        },
        generatedRecords: {
          ...makeIngestion().generatedRecords,
          frontendRecord: {
            ...makeIngestion().generatedRecords.frontendRecord,
            id: 'source-attached',
            pageId: 'ingest:source-attached',
            title: 'Already Attached Source',
            sourceScope: 'current-record',
            linkedClientId: 'client-001',
            archive: {
              reviewStatus: 'attached-to-record',
              suggestedWikiTitle: 'Already Attached Source',
              attachmentTarget: {
                targetType: 'client',
                targetId: 'client-001',
                targetLabel: 'Maya Chen',
              },
            },
          },
        },
      }),
    ];

    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/archive/batch')
      .send({
        action: 'review-for-attachment',
        fileIds: ['source-001', 'source-002', 'source-attached'],
      });

    expect(response.status).toBe(200);
    expect(response.body.summary).toEqual({
      requested: 3,
      updated: 2,
      skipped: 1,
      failed: 0,
    });
    expect(response.body.skipped).toEqual([
      { fileId: 'source-attached', reason: 'already-attached-or-current-record' },
    ]);
    expect(response.body.wikiIngestionRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'source-001',
          archive: expect.objectContaining({ reviewStatus: 'reviewed-for-attachment' }),
        }),
        expect.objectContaining({
          id: 'source-002',
          archive: expect.objectContaining({ reviewStatus: 'reviewed-for-attachment' }),
        }),
      ]),
    );
    expect(mockUpdateCaseManagementWikiIngestionReview).toHaveBeenCalledTimes(2);
    expect(mockUpdateCaseManagementWikiIngestionReview).not.toHaveBeenCalledWith(
      'test-user-123',
      'source-attached',
      expect.anything(),
    );
  });

  it('blocks unsafe batch archive actions that would attach sources without per-record review', async () => {
    const response = await request(app)
      .patch('/api/case-management/wiki/ingestions/archive/batch')
      .send({
        action: 'attach-to-record',
        fileIds: ['source-001'],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Unsupported batch archive review action');
    expect(mockUpdateCaseManagementWikiIngestionReview).not.toHaveBeenCalled();
    expect(mockWriteCaseWikiGraphToNeo4j).not.toHaveBeenCalled();
  });
});

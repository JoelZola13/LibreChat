const {
  buildCaseWikiWeaviateObjects,
  deleteCaseWikiWeaviateObjects,
  getCaseWikiWeaviateConfig,
  prepareCaseWikiWeaviateDryRun,
  queryCaseWikiWeaviateHybridSearch,
  writeCaseWikiApprovedChunksToWeaviate,
} = require('./CaseManagementWeaviate');

describe('CaseManagementWeaviate', () => {
  afterEach(() => {
    delete process.env.CASE_MANAGEMENT_VECTOR_PROVIDER;
    delete process.env.CASE_MANAGEMENT_VECTOR_WRITE_ENABLED;
    delete process.env.CASE_MANAGEMENT_WEAVIATE_DRY_RUN;
    delete process.env.CASE_MANAGEMENT_WEAVIATE_URL;
    delete process.env.CASE_MANAGEMENT_WEAVIATE_CLASS;
    delete process.env.VECTOR_DB_TYPE;
    delete process.env.WEAVIATE_URL;
    delete process.env.WEAVIATE_HOST;
    delete process.env.EMBEDDINGS_MODEL;
    delete process.env.CASE_MANAGEMENT_WEAVIATE_API_KEY;
  });

  const ingestion = {
    fileId: 'source-001',
    originalName: 'Systems Innovation Partner List.docx',
    sha256: 'abc123',
    path: '/Users/joel/Documents/Systems Innovation Partner List.docx',
    linkedClientId: '',
    linkedCaseId: '',
    linkedServiceName: '',
    archive: {
      lifeDomain: 'Partners',
      lifeDomainId: 'partners',
      sourceKind: 'document',
      suggestedWikiTitle: 'Systems Innovation Partner List',
      suggestedCollections: ['Domain: Partners', 'Systems innovation'],
      reviewStatus: 'reviewed-standalone',
      matchedKeywords: ['partner', 'systems innovation'],
    },
    privacy: {
      privacyLevel: 'personal',
      redactionMode: 'strict',
    },
    wikiPage: {
      id: 'ingest:source-001',
      title: 'Ingested source: Systems Innovation Partner List.docx',
    },
    graph: {
      nodes: [
        { id: 'archive-topic:systems-innovation-partner-list', kind: 'ArchiveTopic' },
        { id: 'organization:partner-a', kind: 'Organization' },
      ],
    },
    generatedRecords: {
      frontendRecord: {
        id: 'source-001',
        pageId: 'ingest:source-001',
        fileName: 'Systems Innovation Partner List.docx',
        entities: ['Partner A'],
        privacyLevel: 'personal',
        redactionMode: 'strict',
      },
    },
    createdAt: '2026-05-01T10:00:00.000Z',
  };

  const review = {
    status: 'ready-for-vector-dry-run',
    provider: 'weaviate',
    targetClass: 'CaseWikiSourceChunk',
    privacyLevel: 'personal',
    redactionMode: 'strict',
    reviewedAt: '2026-05-01T11:00:00.000Z',
    reviewedBy: 'Current worker',
    chunks: [
      {
        id: 'embedding:source-001:1',
        ordinal: 1,
        status: 'approved-for-embedding',
        textPreview: 'Partner A is listed as a systems innovation contact with follow-up context.',
        privacyLevel: 'personal',
        redactionMode: 'strict',
        lifeDomain: 'Partners',
        sourceKind: 'document',
        reviewedAt: '2026-05-01T11:00:00.000Z',
        reviewedBy: 'Current worker',
      },
      {
        id: 'embedding:source-001:2',
        ordinal: 2,
        status: 'pending-review',
        textPreview: 'This pending chunk should not be prepared for Weaviate.',
      },
    ],
  };

  it('defaults Case Wiki vectors to Weaviate even when the global vector DB is different', () => {
    process.env.VECTOR_DB_TYPE = 'pgvector';
    process.env.CASE_MANAGEMENT_WEAVIATE_URL = 'http://weaviate.test:8080';
    process.env.CASE_MANAGEMENT_WEAVIATE_CLASS = 'CaseWikiChunk';

    expect(getCaseWikiWeaviateConfig()).toEqual(
      expect.objectContaining({
        provider: 'weaviate',
        endpoint: 'http://weaviate.test:8080',
        collection: 'CaseWikiChunk',
        dryRun: true,
        writeEnabled: false,
      }),
    );
  });

  it('blocks a dry-run until at least one reviewed chunk is approved', () => {
    const dryRun = prepareCaseWikiWeaviateDryRun({
      ingestion,
      embeddingReview: {
        ...review,
        chunks: review.chunks.map((chunk) => ({ ...chunk, status: 'pending-review' })),
      },
    });

    expect(dryRun).toEqual(
      expect.objectContaining({
        status: 'blocked',
        provider: 'weaviate',
        objectCount: 0,
        message: expect.stringContaining('Approve at least one chunk'),
      }),
    );
  });

  it('builds dry-run Weaviate objects only from approved chunks without writing vectors', () => {
    const objects = buildCaseWikiWeaviateObjects({ ingestion, embeddingReview: review });
    expect(objects).toHaveLength(1);
    expect(objects[0]).toEqual(
      expect.objectContaining({
        className: 'CaseWikiSourceChunk',
        properties: expect.objectContaining({
          chunkId: 'embedding:source-001:1',
          sourceDocumentId: 'source-001',
          wikiPageId: 'ingest:source-001',
          sourceTitle: 'Systems Innovation Partner List',
          lifeDomain: 'Partners',
          privacyLevel: 'personal',
          redactionMode: 'strict',
          reviewStatus: 'reviewed-standalone',
          collections: ['Domain: Partners', 'Systems innovation'],
          entityIds: expect.arrayContaining(['organization:partner-a', 'Partner A']),
          topicIds: expect.arrayContaining(['archive-topic:systems-innovation-partner-list', 'systems innovation']),
        }),
      }),
    );
    expect(objects[0].properties.sourcePathHash).toMatch(/^[a-f0-9]{64}$/);

    const dryRun = prepareCaseWikiWeaviateDryRun({ ingestion, embeddingReview: review });
    expect(dryRun).toEqual(
      expect.objectContaining({
        status: 'prepared',
        mode: 'dry-run',
        provider: 'weaviate',
        collection: 'CaseWikiSourceChunk',
        objectCount: 1,
        writeEnabled: false,
        dryRun: true,
        message: expect.stringContaining('No vectors were written'),
      }),
    );
    expect(dryRun.objects).toHaveLength(1);
    expect(dryRun.objectLedger).toEqual([
      expect.objectContaining({
        objectId: objects[0].id,
        chunkId: 'embedding:source-001:1',
        sourceDocumentId: 'source-001',
        wikiPageId: 'ingest:source-001',
        textHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        propertyHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    ]);
    expect(dryRun.objectMap['embedding:source-001:1']).toEqual(
      expect.objectContaining({ objectId: objects[0].id }),
    );
  });

  it('blocks credential-like sources from vector preparation', () => {
    const dryRun = prepareCaseWikiWeaviateDryRun({
      ingestion: {
        ...ingestion,
        archive: {
          ...ingestion.archive,
          cleanupSignals: ['sensitive-credential-review'],
        },
      },
      embeddingReview: review,
    });

    expect(dryRun).toEqual(
      expect.objectContaining({
        status: 'blocked',
        objectCount: 0,
        warnings: ['credential-like-source'],
      }),
    );
  });

  it('blocks live writes while the Weaviate write gate is disabled', async () => {
    const fetchImpl = jest.fn();

    const result = await writeCaseWikiApprovedChunksToWeaviate({
      ingestion,
      embeddingReview: {
        ...review,
        chunkCount: 1,
        pendingCount: 0,
        chunks: [review.chunks[0]],
      },
      confirmWrite: true,
      fetchImpl,
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'blocked',
        objectCount: 0,
        warnings: ['vector-write-disabled'],
      }),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('writes approved chunks to Weaviate when the live gate and confirmation are present', async () => {
    process.env.CASE_MANAGEMENT_VECTOR_WRITE_ENABLED = 'true';
    process.env.CASE_MANAGEMENT_WEAVIATE_DRY_RUN = 'false';
    process.env.CASE_MANAGEMENT_WEAVIATE_URL = 'http://weaviate.test:8080';
    process.env.CASE_MANAGEMENT_WEAVIATE_CLASS = 'CaseWikiChunk';
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        objects: [{ id: 'weaviate-object-001', result: { status: 'SUCCESS' } }],
      }),
    });

    const result = await writeCaseWikiApprovedChunksToWeaviate({
      ingestion,
      embeddingReview: {
        ...review,
        chunkCount: 1,
        pendingCount: 0,
        chunks: [review.chunks[0]],
      },
      confirmWrite: true,
      fetchImpl,
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'written',
        objectCount: 1,
        attemptedObjectCount: 1,
        writeEnabled: true,
        endpoint: 'http://weaviate.test:8080',
        collection: 'CaseWikiChunk',
        objectIds: [expect.stringMatching(/^[a-f0-9]{32}$/)],
        objectLedger: [
          expect.objectContaining({
            chunkId: 'embedding:source-001:1',
            sourceDocumentId: 'source-001',
          }),
        ],
        objectFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://weaviate.test:8080/v1/batch/objects',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: expect.stringContaining('"class":"CaseWikiChunk"'),
      }),
    );
  });

  it('blocks vector deletes until stored object IDs are explicitly confirmed', async () => {
    const fetchImpl = jest.fn();

    const result = await deleteCaseWikiWeaviateObjects({
      ingestion,
      vectorIndex: {
        provider: 'weaviate',
        collection: 'CaseWikiChunk',
        endpoint: 'http://weaviate.test:8080',
        objectIds: ['object-001'],
      },
      confirmDelete: false,
      fetchImpl,
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'confirmation-required',
        deletedObjectCount: 0,
        objectIds: ['object-001'],
        warnings: ['confirmation-required'],
      }),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('deletes stored Weaviate object IDs only when live gates and confirmation are present', async () => {
    process.env.CASE_MANAGEMENT_VECTOR_WRITE_ENABLED = 'true';
    process.env.CASE_MANAGEMENT_WEAVIATE_DRY_RUN = 'false';
    process.env.CASE_MANAGEMENT_WEAVIATE_API_KEY = 'test-key';
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => null,
    });

    const result = await deleteCaseWikiWeaviateObjects({
      ingestion,
      vectorIndex: {
        provider: 'weaviate',
        collection: 'CaseWikiChunk',
        endpoint: 'http://weaviate.test:8080',
        objectIds: ['object-001', 'object-002'],
      },
      confirmDelete: true,
      fetchImpl,
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'deleted',
        requestedObjectCount: 2,
        deletedObjectCount: 2,
        deletedObjectIds: ['object-001', 'object-002'],
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'http://weaviate.test:8080/v1/objects/CaseWikiChunk/object-001',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );
  });

  it('skips hybrid search until at least one source has live vector object IDs', async () => {
    const fetchImpl = jest.fn();

    const result = await queryCaseWikiWeaviateHybridSearch({
      query: 'systems innovation',
      sourceDocumentIds: [],
      fetchImpl,
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'skipped',
        resultCount: 0,
        warnings: ['no-indexed-sources'],
      }),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('queries Weaviate hybrid search for reviewed indexed chunks', async () => {
    process.env.CASE_MANAGEMENT_WEAVIATE_URL = 'http://weaviate.test:8080';
    process.env.CASE_MANAGEMENT_WEAVIATE_CLASS = 'CaseWikiChunk';
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          Get: {
            CaseWikiChunk: [
              {
                chunkId: 'embedding:source-001:1',
                sourceDocumentId: 'source-001',
                wikiPageId: 'ingest:source-001',
                sourceTitle: 'Systems Innovation Partner List',
                chunkText: 'Partner A is listed as a systems innovation contact.',
                chunkSummary: 'Partner contact chunk',
                lifeDomain: 'Partners',
                sourceKind: 'document',
                privacyLevel: 'personal',
                reviewStatus: 'reviewed-standalone',
                entityIds: ['organization:partner-a'],
                topicIds: ['systems innovation'],
                caseIds: [],
                clientIds: [],
                serviceIds: [],
                projectIds: [],
                _additional: {
                  id: 'object-001',
                  score: '0.91',
                  explainScore: 'hybrid score',
                },
              },
            ],
          },
        },
      }),
    });

    const result = await queryCaseWikiWeaviateHybridSearch({
      query: 'systems innovation',
      sourceDocumentIds: ['source-001'],
      fetchImpl,
    });
    const graphqlBody = JSON.parse(fetchImpl.mock.calls[0][1].body).query;

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://weaviate.test:8080/v1/graphql',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      }),
    );
    expect(graphqlBody).toContain('hybrid: { query: "systems innovation"');
    expect(graphqlBody).toContain('valueTextArray: ["source-001"]');
    expect(result).toEqual(
      expect.objectContaining({
        status: 'ready',
        resultCount: 1,
        results: [
          expect.objectContaining({
            objectId: 'object-001',
            chunkId: 'embedding:source-001:1',
            sourceDocumentId: 'source-001',
            sourceTitle: 'Systems Innovation Partner List',
          }),
        ],
      }),
    );
  });
});

jest.mock('node-fetch', () => jest.fn());

const fetch = require('node-fetch');
const {
  buildCaseWikiEmbeddingReviewGraph,
  buildCaseWikiGraphBrowser,
  buildCaseWikiLocalArchiveSourceFamilyDecisionGraph,
  buildCaseWikiGraphProvenanceLensGraph,
  buildCaseWikiGraphWorkspaceReviewGraph,
  focusNodeIdsForIngestion,
  normalizeGraph,
  relatedSourcesForIngestion,
  relationshipReviewGraphDiffForIngestion,
  relationshipReviewSummaryForIngestion,
  searchCaseWikiGraph,
} = require('./CaseManagementWikiGraph');

describe('CaseManagementWikiGraph', () => {
  const selectedIngestion = {
    fileId: 'source-001',
    originalName: 'Systems Innovation Partner List.docx',
    archive: {
      lifeDomain: 'Partners',
      lifeDomainId: 'partners',
      sourceKind: 'document',
      suggestedWikiTitle: 'Systems Innovation Partner List',
      suggestedCollections: ['Domain: Partners', 'Systems innovation'],
      reviewStatus: 'reviewed-standalone',
    },
    wikiPage: {
      id: 'ingest:source-001',
      title: 'Ingested source: Systems Innovation Partner List.docx',
    },
    graph: {
      nodes: [
        { id: 'file:source-001', kind: 'SourceFile', props: { name: 'Systems Innovation Partner List.docx' } },
        { id: 'wiki:ingest:source-001', kind: 'WikiPage', props: { title: 'Ingested source: Systems Innovation Partner List.docx' } },
        { id: 'life-domain:partners', kind: 'LifeDomain', props: { name: 'Partners' } },
        { id: 'archive-topic:systems-innovation', kind: 'ArchiveTopic', props: { title: 'Systems Innovation' } },
      ],
      edges: [
        { from: 'file:source-001', to: 'wiki:ingest:source-001', kind: 'GENERATED_WIKI_PAGE', props: {} },
        { from: 'wiki:ingest:source-001', to: 'life-domain:partners', kind: 'IN_DOMAIN', props: {} },
        { from: 'wiki:ingest:source-001', to: 'archive-topic:systems-innovation', kind: 'SUGGESTED_WIKI_TOPIC', props: {} },
      ],
    },
    relationshipReviewRecords: [
      {
        id: 'relationship-review-reviewed123',
        relationshipKey: 'source-001::mentions::systems innovation::mentions::partner network',
        sourceId: 'source-001',
        sourceTitle: 'Systems Innovation Partner List',
        from: 'Systems Innovation',
        to: 'Partner Network',
        fromNodeId: 'archive-topic:systems-innovation',
        toNodeId: 'organization:partner-network',
        kind: 'MENTIONS',
        label: 'mentions',
        status: 'approved',
        reviewedAt: '2026-05-01T10:00:00.000Z',
        reviewedBy: 'Current worker',
      },
    ],
  };

  afterEach(() => {
    fetch.mockReset();
    delete process.env.CASE_MANAGEMENT_NEO4J_DISABLED;
  });

  it('normalizes graph nodes and edges for the browser panel', () => {
    const graph = normalizeGraph({
      nodes: [
        { id: 'a', kind: 'SourceFile', props: { name: 'A', id: 'ignored', long: 'x'.repeat(500) } },
        { id: 'a', kind: 'SourceFile', props: { name: 'A duplicate' } },
        { id: 'b', kind: 'WikiPage', props: { title: 'B' } },
      ],
      edges: [
        { from: 'a', to: 'b', kind: 'GENERATED_WIKI_PAGE', props: { id: 'ignored' } },
        { from: 'a', to: 'b', kind: 'GENERATED_WIKI_PAGE', props: {} },
      ],
    });

    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes[0]).toEqual(expect.objectContaining({ id: 'a', label: 'A duplicate' }));
    expect(graph.nodes[0].props.long).toBeUndefined();
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toEqual(expect.objectContaining({ label: 'generated wiki page' }));
  });

  it('builds Neo4j review nodes for embedding chunks before vector writes', () => {
    const graphLayer = buildCaseWikiEmbeddingReviewGraph({
      ingestion: selectedIngestion,
      embeddingReview: {
        status: 'ready-for-vector-dry-run',
        writeMode: 'dry-run',
        writeEnabled: false,
        chunkCount: 2,
        approvedCount: 1,
        pendingCount: 0,
        rejectedCount: 1,
        chunks: [
          {
            id: 'embedding:source-001:1',
            status: 'approved-for-embedding',
            embeddingAction: 'approved-for-embedding',
            textPreview: 'Systems Innovation Lab partner list approved for future retrieval.',
            reviewedAt: '2026-05-02T11:00:00.000Z',
            reviewedBy: 'Current worker',
          },
          {
            id: 'embedding:source-001:2',
            status: 'do-not-embed',
            embeddingAction: 'do-not-embed',
            textPreview: 'Private scratch line that should stay out of vectors.',
            reviewedAt: '2026-05-02T11:05:00.000Z',
            reviewedBy: 'Current worker',
          },
        ],
      },
      weaviateDryRun: {
        status: 'prepared',
        provider: 'weaviate',
        collection: 'CaseWikiSourceChunk',
        objects: [
          {
            id: 'weaviate-object-001',
            properties: { chunkId: 'embedding:source-001:1' },
          },
        ],
      },
      action: 'approve-chunk',
    });

    expect(graphLayer.reviewNodeId).toMatch(/^embedding-review:/);
    expect(graphLayer.vectorIndexNodeId).toBe('vector-index:weaviate:casewikisourcechunk');
    expect(graphLayer.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'EmbeddingReview' }),
        expect.objectContaining({ kind: 'EmbeddingChunk' }),
        expect.objectContaining({ kind: 'VectorIndex' }),
      ]),
    );
    expect(graphLayer.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'READY_FOR_INDEX' }),
        expect.objectContaining({ kind: 'EXCLUDED_FROM_INDEX' }),
      ]),
    );
  });

  it('marks approved embedding chunks as indexed after a live vector write', () => {
    const graphLayer = buildCaseWikiEmbeddingReviewGraph({
      ingestion: selectedIngestion,
      embeddingReview: {
        status: 'indexed-in-weaviate',
        writeMode: 'live',
        writeEnabled: true,
        chunkCount: 1,
        approvedCount: 1,
        pendingCount: 0,
        rejectedCount: 0,
        chunks: [
          {
            id: 'embedding:source-001:1',
            status: 'approved-for-embedding',
            embeddingAction: 'approved-for-embedding',
            textPreview: 'Approved chunk now written into Weaviate.',
          },
        ],
      },
      vectorWrite: {
        status: 'written',
        provider: 'weaviate',
        collection: 'CaseWikiSourceChunk',
        objectCount: 1,
        objectIds: ['weaviate-object-001'],
      },
      action: 'write-approved-chunks',
    });

    expect(graphLayer.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'INDEXED_IN',
          props: expect.objectContaining({ objectId: 'weaviate-object-001', status: 'written' }),
        }),
      ]),
    );
  });

  it('builds focus node ids for the selected source and wiki page', () => {
    expect(focusNodeIdsForIngestion(selectedIngestion)).toEqual(['file:source-001', 'wiki:ingest:source-001']);
  });

  it('finds related sources without attaching them to the selected source', () => {
    const related = relatedSourcesForIngestion(selectedIngestion, [
      selectedIngestion,
      {
        fileId: 'source-002',
        originalName: 'Innovation notes.md',
        archive: {
          lifeDomain: 'Partners',
          lifeDomainId: 'partners',
          sourceKind: 'note',
          suggestedWikiTitle: 'Innovation notes',
          suggestedCollections: ['Domain: Partners', 'Systems innovation'],
          reviewStatus: 'needs-human-review',
        },
        wikiPage: { id: 'ingest:source-002' },
        graph: {
          nodes: [
            { id: 'file:source-002', kind: 'SourceFile', props: { name: 'Innovation notes.md' } },
            { id: 'archive-topic:systems-innovation', kind: 'ArchiveTopic', props: { title: 'Systems Innovation' } },
          ],
          edges: [],
        },
      },
    ]);

    expect(related).toEqual([
      expect.objectContaining({
        id: 'source-002',
        title: 'Innovation notes',
        reasons: expect.arrayContaining([
          'shared node archive-topic:systems-innovation',
          'same collection Systems innovation',
          'same domain Partners',
        ]),
      }),
    ]);
  });

  it('searches source metadata and graph nodes without attaching documents to client records', () => {
    const graphSearch = searchCaseWikiGraph({
      query: 'systems innovation',
      lifeDomainId: 'partners',
      ingestions: [
        selectedIngestion,
        {
          fileId: 'client-source-001',
          originalName: 'Devon Brooks intake note.md',
          archive: {
            lifeDomain: 'Case Management',
            lifeDomainId: 'case-management',
            sourceKind: 'case-note',
            suggestedWikiTitle: 'Devon Brooks intake note',
            suggestedCollections: ['Domain: Case Management'],
            reviewStatus: 'reviewed-attached',
          },
          graph: {
            nodes: [
              { id: 'person:devon-brooks', kind: 'Person', props: { name: 'Devon Brooks' } },
              { id: 'case:case-003', kind: 'Case', props: { title: 'Employment bridge referral' } },
            ],
            edges: [],
          },
        },
      ],
    });

    expect(graphSearch.status).toBe('ready');
    expect(graphSearch.totalMatches).toBe(1);
    expect(graphSearch.results).toEqual([
      expect.objectContaining({
        id: 'source-001',
        title: 'Systems Innovation Partner List',
        lifeDomainId: 'partners',
        matchReasons: expect.arrayContaining([
          'wiki title',
          'collections',
          'graph node: ArchiveTopic Systems Innovation',
        ]),
      }),
    ]);
  });

  it('searches promoted wiki topics alongside source documents', () => {
    const graphSearch = searchCaseWikiGraph({
      query: 'case wiki chrome smoke',
      lifeDomainId: 'unknown',
      ingestions: [],
      promotionRecords: [
        {
          id: 'promotion:returned-output:case-wiki-chrome-smoke:abcd',
          pageId: 'promotion:returned-output:case-wiki-chrome-smoke',
          title: 'case wiki chrome smoke',
          query: 'case wiki chrome smoke',
          publishMode: 'human-confirmed-returned-output',
          reviewState: 'human-approved-returned-output',
          status: 'published-section',
          lead: 'A promoted returned-output topic for the Case Wiki smoke test.',
          sections: [
            {
              id: 'section-001',
              heading: 'Verified Chrome ingestion',
              text: 'Chrome ingestion can publish reviewed returned output into a durable wiki topic.',
              citationIds: ['source-001'],
              reviewState: 'human-approved-returned-output',
            },
          ],
          citationLedger: [
            {
              id: 'source-001',
              sourceDocumentId: 'source-001',
              sourceTitle: 'Case Wiki Chrome Smoke',
              textPreview: 'Reviewed citation from the Chrome smoke test.',
            },
          ],
          neo4jStatus: 'written',
          graphSummary: { nodeCount: 5, edgeCount: 4, status: 'written' },
          version: 2,
          updatedAt: '2026-05-03T12:00:00.000Z',
        },
      ],
    });

    expect(graphSearch.status).toBe('ready');
    expect(graphSearch.results).toEqual([
      expect.objectContaining({
        id: 'promotion:returned-output:case-wiki-chrome-smoke:abcd',
        resultType: 'promoted-topic',
        pageId: 'promotion:returned-output:case-wiki-chrome-smoke',
        publishMode: 'human-confirmed-returned-output',
        neo4jStatus: 'written',
        citationCount: 1,
        sectionCount: 1,
        graph: expect.objectContaining({ nodeCount: 5, edgeCount: 4 }),
        matchReasons: expect.arrayContaining(['promoted wiki topic', 'publication query', 'reviewed citation ledger']),
      }),
    ]);
  });

  it('searches graph relationships when no source title matches', () => {
    const graphSearch = searchCaseWikiGraph({
      query: 'generated wiki page',
      ingestions: [selectedIngestion],
    });

    expect(graphSearch.status).toBe('ready');
    expect(graphSearch.results[0]).toEqual(
      expect.objectContaining({
        id: 'source-001',
        edgeMatches: expect.arrayContaining([
          expect.objectContaining({ from: 'file:source-001', to: 'wiki:ingest:source-001' }),
        ]),
      }),
    );
  });

  it('returns an empty search response for blank queries', () => {
    expect(searchCaseWikiGraph({ query: '   ', ingestions: [selectedIngestion] })).toEqual(
      expect.objectContaining({
        status: 'empty-query',
        resultCount: 0,
        results: [],
      }),
    );
  });

  it('summarizes reviewed relationship decisions and exposes a graph diff', () => {
    expect(relationshipReviewSummaryForIngestion(selectedIngestion)).toEqual({
      total: 1,
      approved: 1,
      rejected: 0,
    });
    expect(relationshipReviewGraphDiffForIngestion(selectedIngestion)).toEqual([
      expect.objectContaining({
        relationshipKey: 'source-001::mentions::systems innovation::mentions::partner network',
        status: 'approved',
        before: expect.objectContaining({
          from: 'Systems Innovation',
          to: 'Partner Network',
          kind: 'MENTIONS',
        }),
        after: expect.objectContaining({
          decisionNodeId: 'relationship-review:reviewed123',
          decisionEdgeKind: 'HAS_RELATIONSHIP_REVIEW',
          relationshipEdgeKind: 'APPROVED_RELATIONSHIP',
        }),
      }),
    ]);
  });

  it('builds a Neo4j graph layer for graph workspace audit review decisions', () => {
    const reviewGraph = buildCaseWikiGraphWorkspaceReviewGraph({
      userId: 'test-user-123',
      decision: {
        id: 'graph-workspace-audit-review-001',
        auditId: 'graph-workspace-audit:abc123',
        workspaceId: 'life-domain-graph-001',
        workspaceName: 'Housing archive review',
        snapshotHash: 'snapshot-123',
        snapshotVersion: 2,
        status: 'revision-requested',
        note: 'Needs a narrower source lane before this becomes the manager-approved graph.',
        reviewer: 'Joel Zola',
        reviewedAt: '2026-05-01T12:00:00.000Z',
        narrativeHeadline: 'Changed the graph review lens',
      },
    });

    expect(reviewGraph.graphWorkspaceReview).toEqual(
      expect.objectContaining({
        nodeId: 'graph-workspace-review:graph-workspace-audit-review-001',
        auditNodeId: 'graph-workspace-audit:abc123',
        workspaceNodeId: 'graph-workspace:life-domain-graph-001',
        status: 'revision-requested',
      }),
    );
    expect(reviewGraph.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'GraphWorkspaceReview' }),
        expect.objectContaining({ id: 'graph-workspace-audit:abc123', kind: 'GraphWorkspaceAudit' }),
        expect.objectContaining({ id: 'graph-workspace:life-domain-graph-001', kind: 'GraphWorkspace' }),
      ]),
    );
    expect(reviewGraph.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'HAS_WORKSPACE_REVIEW', from: 'graph-workspace-audit:abc123' }),
        expect.objectContaining({ kind: 'REVIEWS_AUDIT' }),
      ]),
    );
  });

  it('builds a Neo4j graph layer for local archive source-family review decisions', () => {
    const decisionGraph = buildCaseWikiLocalArchiveSourceFamilyDecisionGraph({
      userId: 'test-user-123',
      decisionRecord: {
        id: 'source-family-review-001',
        candidateId: 'candidate-source-family',
        action: 'merge-into-canonical',
        label: 'Systems Innovation Partner List final',
        graphNodeId: 'local-archive-source-family-decision:candidate-source-family',
        canonicalSource: {
          sourceId: 'local-catalog-canonical',
          sourceLabel: 'Systems Innovation Partner List',
          sourcePageId: 'ingest:local-catalog-canonical',
          sourceHash: 'hash-canonical',
        },
        canonicalLineageId: 'lineage-systems-innovation',
        note: 'Same source family; do not ingest separately yet.',
        decidedAt: '2026-05-02T12:05:00.000Z',
        savedAt: '2026-05-02T12:06:00.000Z',
        savedBy: 'Joel Zola',
      },
    });

    expect(decisionGraph.sourceFamilyDecision).toEqual(
      expect.objectContaining({
        nodeId: 'local-archive-source-family-decision:candidate-source-family',
        candidateNodeId: 'local-archive-candidate:candidate-source-family',
        canonicalSourceNodeId: 'file:local-catalog-canonical',
        canonicalWikiNodeId: 'wiki:ingest:local-catalog-canonical',
        lineageNodeId: 'source-family-lineage:lineage-systems-innovation',
      }),
    );
    expect(decisionGraph.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'SourceFamilyReviewDecision' }),
        expect.objectContaining({ kind: 'LocalArchiveCandidate' }),
        expect.objectContaining({ kind: 'SourceFamilyLineage' }),
        expect.objectContaining({ id: 'file:local-catalog-canonical', kind: 'SourceFile' }),
        expect.objectContaining({ id: 'wiki:ingest:local-catalog-canonical', kind: 'WikiPage' }),
      ]),
    );
    expect(decisionGraph.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'HAS_SOURCE_FAMILY_REVIEW' }),
        expect.objectContaining({ kind: 'IN_SOURCE_FAMILY' }),
        expect.objectContaining({ kind: 'REVIEWS_CANONICAL_SOURCE' }),
        expect.objectContaining({ kind: 'REVIEWS_CANONICAL_WIKI_PAGE' }),
      ]),
    );
  });

  it('builds a Neo4j graph layer for saved graph provenance lenses', () => {
    const lensGraph = buildCaseWikiGraphProvenanceLensGraph({
      userId: 'test-user-123',
      lens: {
        id: 'life-domain-graph-provenance-view-001',
        name: 'Approved graph lens',
        query: 'graph',
        reviewFilter: 'approved',
        domainFilter: 'partners',
        browserScope: 'all-domains',
        resultCount: 2,
        matchingWorkspaceCount: 1,
        createdAt: '2026-05-01T12:00:00.000Z',
        updatedAt: '2026-05-01T12:05:00.000Z',
        createdBy: 'Joel Zola',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'editor',
        accessRoles: { 'Nia Patel': 'editor' },
        shareNote: 'Shared with Nia for recurring provenance review.',
        activityRecords: [
          {
            id: 'activity-001',
            type: 'shared',
            actor: 'Joel Zola',
            detail: 'Shared with Nia Patel as editor.',
            createdAt: '2026-05-01T12:04:00.000Z',
            sharedWith: ['Nia Patel'],
            accessRole: 'editor',
          },
          {
            id: 'activity-backfill-001',
            type: 'backfilled',
            repairType: 'created',
            reason: 'Missing original created activity',
            backfilled: true,
            actor: 'Nia Patel',
            detail: 'Backfilled missing created activity.',
            createdAt: '2026-05-01T12:05:00.000Z',
            accessRole: 'manager',
          },
        ],
      },
    });

    expect(lensGraph.provenanceLens).toEqual(
      expect.objectContaining({
        nodeId: 'graph-provenance-lens:life-domain-graph-provenance-view-001',
        reviewFilter: 'approved',
        browserScope: 'all-domains',
        visibility: 'team',
        sharedWith: ['Nia Patel'],
        accessRole: 'editor',
        accessRoles: { 'Nia Patel': 'editor' },
      }),
    );
    expect(lensGraph.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'GraphProvenanceLens' }),
        expect.objectContaining({
          kind: 'GraphProvenanceLensActivity',
          props: expect.objectContaining({
            activityId: 'activity-backfill-001',
            type: 'backfilled',
            repairType: 'created',
            reason: 'Missing original created activity',
            backfilled: true,
          }),
        }),
        expect.objectContaining({ id: 'life-domain:partners', kind: 'LifeDomain' }),
        expect.objectContaining({ kind: 'CaseWikiPerson', label: 'Nia Patel' }),
      ]),
    );
    expect(lensGraph.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'OWNED_BY' }),
        expect.objectContaining({ kind: 'FILTERS_DOMAIN' }),
        expect.objectContaining({ kind: 'SHARED_WITH', props: expect.objectContaining({ role: 'editor' }) }),
        expect.objectContaining({
          kind: 'HAS_LENS_ACTIVITY',
          props: expect.objectContaining({ repairType: 'created', backfilled: true }),
        }),
        expect.objectContaining({ kind: 'ACTIVITY_BY' }),
      ]),
    );
  });

  it('falls back to the saved source graph when Neo4j is disabled', async () => {
    process.env.CASE_MANAGEMENT_NEO4J_DISABLED = 'true';

    const browser = await buildCaseWikiGraphBrowser({
      ingestion: selectedIngestion,
      allIngestions: [selectedIngestion],
    });

    expect(browser).toEqual(
      expect.objectContaining({
        status: 'ready',
        source: 'persisted-source-graph',
        fileId: 'source-001',
        nodeCount: 4,
        edgeCount: 3,
        graph: expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({ id: 'life-domain:partners', kind: 'LifeDomain', label: 'Partners' }),
          ]),
        }),
        summary: expect.objectContaining({
          nodeKinds: expect.objectContaining({ SourceFile: 1, WikiPage: 1, LifeDomain: 1 }),
        }),
      }),
    );
  });

  it('uses Neo4j neighbor data when the query returns nodes', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            data: [
              {
                row: [
                  [
                    { id: 'wiki:ingest:source-001', kind: 'WikiPage', props: { title: 'Source 001' } },
                    { id: 'service:svc-1', kind: 'Service', props: { name: 'Service One' } },
                  ],
                  [
                    { from: 'wiki:ingest:source-001', to: 'service:svc-1', kind: 'ABOUT_SERVICE', props: {} },
                  ],
                ],
              },
            ],
          },
        ],
        errors: [],
      }),
    });

    const browser = await buildCaseWikiGraphBrowser({
      ingestion: selectedIngestion,
      allIngestions: [selectedIngestion],
    });

    expect(browser.source).toBe('neo4j');
    expect(browser.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'service:svc-1', kind: 'Service', label: 'Service One' }),
      ]),
    );
    expect(browser.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'wiki:ingest:source-001', to: 'service:svc-1', kind: 'ABOUT_SERVICE' }),
      ]),
    );
  });
});

const fs = require('fs/promises');
const os = require('os');
const path = require('path');

jest.mock('node-fetch', () => jest.fn());

const fetch = require('node-fetch');
const {
  buildCaseWikiUpload,
  normalizeWikiIngestContext,
} = require('./CaseManagementWikiIngestion');

describe('CaseManagementWikiIngestion', () => {
  const tempDirs = [];

  const makeUpload = async ({ name, body, mimetype = 'text/plain' }) => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'case-wiki-ingest-'));
    tempDirs.push(tempDir);
    const filePath = path.join(tempDir, name);
    await fs.writeFile(filePath, body);

    return {
      path: filePath,
      filename: `stored-${name}`,
      originalname: name,
      mimetype,
      size: Buffer.byteLength(body),
    };
  };

  beforeEach(() => {
    fetch.mockReset();
    process.env.CASE_MANAGEMENT_NEO4J_DISABLED = 'true';
  });

  afterEach(async () => {
    delete process.env.CASE_MANAGEMENT_NEO4J_DISABLED;
    delete process.env.NEO4J_HTTP_URL;
    delete process.env.CASE_MANAGEMENT_NEO4J_HTTP_URL;
    delete process.env.NEO4J_DATABASE;
    delete process.env.NEO4J_USERNAME;
    delete process.env.NEO4J_USER;
    delete process.env.NEO4J_PASSWORD;
    delete process.env.CASE_MANAGEMENT_NEO4J_PASSWORD;
    await Promise.all(
      tempDirs.splice(0).map((tempDir) => fs.rm(tempDir, { recursive: true, force: true })),
    );
  });

  it('normalizes privacy and review context with safe defaults', () => {
    expect(
      normalizeWikiIngestContext({
        privacyLevel: 'unknown',
        redactionMode: 'mystery',
        retentionPolicy: '',
        reviewBeforeGraphWrite: 'true',
      }),
    ).toEqual(
      expect.objectContaining({
        privacyLevel: 'case-team',
        redactionMode: 'standard',
        retentionPolicy: 'keep-source',
        reviewBeforeGraphWrite: true,
      }),
    );
  });

  it('turns a text upload into a redacted wiki page and Neo4j graph records', async () => {
    const file = await makeUpload({
      name: 'maya-intake-note.txt',
      body: [
        'Maya Chen asked for housing referral follow-up and consent review.',
        'Reach her at maya@example.test or 416-555-0199 before the shelter appointment.',
        'Toronto Harbour Light remains the service partner for the next handoff.',
      ].join('\n'),
    });

    const ingestion = await buildCaseWikiUpload({
      file,
      userId: 'user-123',
      context: {
        clientId: 'client-001',
        clientName: 'Maya Chen',
        caseId: 'case-001',
        caseTitle: 'Housing stability plan',
        serviceName: 'Toronto Harbour Light',
        privacyLevel: 'private',
        redactionMode: 'standard',
      },
    });

    expect(ingestion.neo4j).toEqual(
      expect.objectContaining({
        status: 'skipped',
        nodeCount: ingestion.graph.nodes.length,
        edgeCount: ingestion.graph.edges.length,
      }),
    );
    expect(ingestion.extraction).toEqual(
      expect.objectContaining({
        method: 'utf8 text',
        status: 'ready',
      }),
    );
    expect(ingestion.extraction.textPreview).toContain('[email redacted]');
    expect(ingestion.extraction.textPreview).toContain('[phone redacted]');
    expect(ingestion.extraction.textPreview).not.toContain('maya@example.test');
    expect(ingestion.generatedRecords.note).toEqual(
      expect.objectContaining({
        clientId: 'client-001',
        caseId: 'case-001',
        visibility: 'private',
        followUpRequired: true,
      }),
    );
    expect(ingestion.generatedRecords.frontendRecord).toEqual(
      expect.objectContaining({
        linkedClientId: 'client-001',
        linkedCaseId: 'case-001',
        linkedServiceName: 'Toronto Harbour Light',
        graphStatus: 'skipped',
        privacyLevel: 'private',
        redactionMode: 'standard',
      }),
    );
    expect(ingestion.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: expect.stringMatching(/^file:/), kind: 'SourceFile' }),
        expect.objectContaining({ id: expect.stringMatching(/^wiki:ingest:/), kind: 'WikiPage' }),
        expect.objectContaining({ id: 'client:client-001', kind: 'Client' }),
        expect.objectContaining({ id: 'case:case-001', kind: 'Case' }),
        expect.objectContaining({ id: 'service:Toronto Harbour Light', kind: 'Service' }),
      ]),
    );
    expect(ingestion.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'GENERATED_WIKI_PAGE' }),
        expect.objectContaining({ kind: 'ABOUT_CLIENT', to: 'client:client-001' }),
        expect.objectContaining({ kind: 'ABOUT_CASE', to: 'case:case-001' }),
        expect.objectContaining({ kind: 'ABOUT_SERVICE', to: 'service:Toronto Harbour Light' }),
      ]),
    );
  });

  it('summarizes CSV uploads and can produce a graph preview without writing to Neo4j', async () => {
    const file = await makeUpload({
      name: 'referrals.csv',
      mimetype: 'text/csv',
      body: [
        'client,email,need,status',
        'Devon Brooks,devon@example.test,employment referral,open',
        'Samir Haddad,samir@example.test,clinic paperwork,pending',
      ].join('\n'),
    });

    const ingestion = await buildCaseWikiUpload({
      file,
      userId: 'user-123',
      writeGraph: false,
      context: {
        privacyLevel: 'public',
        redactionMode: 'none',
        serviceName: 'Employment bridge support',
      },
    });

    expect(ingestion.neo4j).toEqual(
      expect.objectContaining({
        status: 'preview',
        message: 'Graph preview generated without writing to Neo4j',
      }),
    );
    expect(ingestion.extraction).toEqual(
      expect.objectContaining({
        method: 'csv text table parser',
        status: 'ready',
        tableSummary: expect.objectContaining({
          rowCount: 2,
          columnCount: 4,
          headers: ['client', 'email', 'need', 'status'],
        }),
      }),
    );
    expect(ingestion.extraction.textPreview).toContain('CSV table with 2 rows and 4 columns.');
    expect(ingestion.extraction.textPreview).toContain('devon@example.test');
    expect(ingestion.generatedRecords.frontendRecord).toEqual(
      expect.objectContaining({
        graphStatus: 'preview',
        status: 'ready',
        linkedServiceName: 'Employment bridge support',
      }),
    );
  });

  it('writes graph nodes and edges to the configured Neo4j HTTP endpoint', async () => {
    delete process.env.CASE_MANAGEMENT_NEO4J_DISABLED;
    process.env.NEO4J_HTTP_URL = 'http://neo4j.example.test:7474/';
    process.env.NEO4J_DATABASE = 'casewiki';
    process.env.NEO4J_USERNAME = 'case-user';
    process.env.NEO4J_PASSWORD = 'case-password';

    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ errors: [] }),
    });

    const file = await makeUpload({
      name: 'service-handoff.md',
      mimetype: 'text/markdown',
      body: 'Housing handoff note for Maya Chen with consent confirmed and referral appointment booked.',
    });

    const ingestion = await buildCaseWikiUpload({
      file,
      userId: 'user-123',
      context: {
        clientId: 'client-001',
        clientName: 'Maya Chen',
        caseId: 'case-001',
        caseTitle: 'Housing stability plan',
        serviceName: 'Toronto Harbour Light',
        privacyLevel: 'case-team',
      },
    });

    expect(ingestion.neo4j).toEqual(
      expect.objectContaining({
        status: 'written',
        message: 'Neo4j graph updated',
        nodeCount: ingestion.graph.nodes.length,
        edgeCount: ingestion.graph.edges.length,
      }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);

    const [endpoint, request] = fetch.mock.calls[0];
    expect(endpoint).toBe('http://neo4j.example.test:7474/db/casewiki/tx/commit');
    expect(request).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from('case-user:case-password').toString('base64')}`,
        }),
      }),
    );

    const body = JSON.parse(request.body);
    expect(body.statements).toHaveLength(2);
    expect(body.statements[0].statement).toContain(
      'MERGE (n:CaseManagementKnowledge {id: node.id})',
    );
    expect(body.statements[1].statement).toContain(
      'MERGE (from)-[r:RELATED_TO {kind: edge.kind}]->(to)',
    );
    expect(body.statements[0].parameters.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'client:client-001', kind: 'Client' }),
        expect.objectContaining({ id: 'case:case-001', kind: 'Case' }),
        expect.objectContaining({ id: 'service:Toronto Harbour Light', kind: 'Service' }),
      ]),
    );
    expect(body.statements[1].parameters.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'ABOUT_CLIENT', to: 'client:client-001' }),
        expect.objectContaining({ kind: 'ABOUT_CASE', to: 'case:case-001' }),
        expect.objectContaining({ kind: 'ABOUT_SERVICE', to: 'service:Toronto Harbour Light' }),
      ]),
    );
  });
});

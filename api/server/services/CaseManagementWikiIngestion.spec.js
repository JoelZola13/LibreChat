const fs = require('fs/promises');
const os = require('os');
const path = require('path');

jest.mock('node-fetch', () => jest.fn());

const fetch = require('node-fetch');
const {
  buildCaseWikiLocalArchiveCatalogRecord,
  buildCaseWikiLocalArchiveExtractionRecord,
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
    delete process.env.CASE_WIKI_PDF_TEXT_COMMAND;
    delete process.env.CASE_WIKI_PDF_RENDER_COMMAND;
    delete process.env.CASE_WIKI_OCR_COMMAND;
    delete process.env.CASE_WIKI_UNZIP_COMMAND;
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
        sourceScope: 'standalone',
        reviewBeforeGraphWrite: true,
      }),
    );
  });

  it('creates metadata-only local archive catalog records without embedding chunks', async () => {
    const ingestion = await buildCaseWikiLocalArchiveCatalogRecord({
      candidate: {
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
        pickyTier: 'import-now',
        pickyScore: 92,
        pickyAction: 'Stage as a standalone wiki source',
        pickyReasons: ['knowledge-wiki value signal', 'document source'],
      },
      userId: 'user-123',
      context: {
        privacyLevel: 'personal',
        redactionMode: 'strict',
        retentionPolicy: 'review-source',
      },
    });

    expect(ingestion.fileId).toBe('local-catalog-candidate-001');
    expect(ingestion.path).toBe('local-archive://Documents/Street Voices/System Innovation Partner List.docx');
    expect(ingestion.extraction).toEqual(
      expect.objectContaining({
        status: 'metadata-only',
        method: 'local archive metadata catalog',
      }),
    );
    expect(ingestion.embeddingReview).toEqual(
      expect.objectContaining({
        status: 'metadata-only',
        writeMode: 'dry-run',
        writeEnabled: false,
        pendingCount: 0,
      }),
    );
    expect(ingestion.archive).toEqual(
      expect.objectContaining({
        catalogOnly: true,
        lifeDomain: 'Partners',
        reviewStatus: 'needs-human-review',
        pickyImportDecision: expect.objectContaining({
          tier: 'import-now',
          score: 92,
          action: 'Stage as a standalone wiki source',
          reasons: expect.arrayContaining(['knowledge-wiki value signal']),
        }),
        localArchive: expect.objectContaining({
          relativePath: 'Street Voices/System Innovation Partner List.docx',
        }),
      }),
    );
    expect(ingestion.extraction.textPreview).toContain(
      'Picky import decision: import-now · Stage as a standalone wiki source · 92/100.',
    );
    expect(ingestion.generatedRecords.frontendRecord).toEqual(
      expect.objectContaining({
        status: 'metadata-only',
        sourceScope: 'standalone',
        archive: expect.objectContaining({
          sourceBoundary: 'standalone-source',
          catalogOnly: true,
          pickyImportDecision: expect.objectContaining({
            tier: 'import-now',
            action: 'Stage as a standalone wiki source',
          }),
        }),
      }),
    );
    expect(ingestion.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'SourceFile' }),
        expect.objectContaining({ kind: 'WikiPage' }),
        expect.objectContaining({ kind: 'LifeDomain', props: expect.objectContaining({ name: 'Partners' }) }),
      ]),
    );
  });

  it('extracts a cataloged local archive source into review chunks without writing vectors', async () => {
    const file = await makeUpload({
      name: 'systems-innovation-roadmap.md',
      body: [
        'The Systems Innovation roadmap connects Street Voices partner lists with case management workflows.',
        'Review the partner onboarding notes before anything is attached to a client or embedded in Weaviate.',
      ].join('\n\n'),
      mimetype: 'text/markdown',
    });
    const cataloged = await buildCaseWikiLocalArchiveCatalogRecord({
      candidate: {
        id: 'candidate-roadmap',
        rootId: 'root-docs',
        rootLabel: 'Documents',
        relativePath: 'Street Voices/systems-innovation-roadmap.md',
        fileName: 'systems-innovation-roadmap.md',
        mimeType: 'text/markdown',
        size: file.size,
        lane: 'Projects and strategy',
        lifeDomain: 'Projects',
        lifeDomainId: 'projects',
        sourceKind: 'note',
        suggestedCollections: ['Domain: Projects', 'Projects and strategy'],
      },
      userId: 'user-123',
      context: {
        privacyLevel: 'personal',
        redactionMode: 'strict',
        retentionPolicy: 'review-source',
      },
    });

    const extracted = await buildCaseWikiLocalArchiveExtractionRecord({
      existing: cataloged,
      localFile: {
        rootId: 'root-docs',
        rootLabel: 'Documents',
        relativePath: 'Street Voices/systems-innovation-roadmap.md',
        fileName: 'systems-innovation-roadmap.md',
        mimeType: 'text/markdown',
        size: file.size,
        modifiedAt: '2026-05-02T10:00:00.000Z',
        path: file.path,
      },
      userId: 'user-123',
      context: {
        privacyLevel: 'personal',
        redactionMode: 'strict',
        retentionPolicy: 'review-source',
      },
    });

    expect(extracted.fileId).toBe(cataloged.fileId);
    expect(extracted.archive).toEqual(
      expect.objectContaining({
        catalogOnly: false,
        sourceBoundary: 'standalone-source',
        extractionStatus: 'ready',
      }),
    );
    expect(extracted.extraction).toEqual(
      expect.objectContaining({
        status: 'ready',
        method: 'utf8 text',
      }),
    );
    expect(extracted.embeddingReview).toEqual(
      expect.objectContaining({
        status: 'awaiting-review',
        writeMode: 'dry-run',
        writeEnabled: false,
        pendingCount: expect.any(Number),
      }),
    );
    expect(extracted.embeddingReview.chunks.length).toBeGreaterThan(0);
    expect(extracted.generatedRecords.frontendRecord).toEqual(
      expect.objectContaining({
        id: cataloged.fileId,
        status: 'ready',
        vectorStatus: 'planned',
        sourceScope: 'standalone',
      }),
    );
    expect(extracted.weaviateDryRun).toBeNull();
  });

  it('falls back to OCR for scanned PDFs before leaving the source metadata-only', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'case-wiki-parser-bin-'));
    tempDirs.push(tempDir);
    const originalPath = process.env.PATH;
    const writeExecutable = async (name, source) => {
      const scriptPath = path.join(tempDir, name);
      await fs.writeFile(scriptPath, source, 'utf8');
      await fs.chmod(scriptPath, 0o755);
    };

    await writeExecutable(
      'pdftotext',
      '#!/usr/bin/env node\nprocess.exit(0);\n',
    );
    await writeExecutable(
      'pdftoppm',
      [
        '#!/usr/bin/env node',
        "const fs = require('fs');",
        "const prefix = process.argv[process.argv.length - 1];",
        "fs.writeFileSync(`${prefix}-1.png`, 'rendered page');",
        '',
      ].join('\n'),
    );
    await writeExecutable(
      'tesseract',
      [
        '#!/usr/bin/env node',
        "process.stdout.write('Scanned PDF text says Street Voices should review the partner agreement before embedding.');",
        '',
      ].join('\n'),
    );

    process.env.PATH = `${tempDir}${path.delimiter}${originalPath || ''}`;
    process.env.CASE_WIKI_PDF_TEXT_COMMAND = path.join(tempDir, 'pdftotext');
    process.env.CASE_WIKI_PDF_RENDER_COMMAND = path.join(tempDir, 'pdftoppm');
    process.env.CASE_WIKI_OCR_COMMAND = path.join(tempDir, 'tesseract');
    try {
      const file = await makeUpload({
        name: 'scanned-partner-agreement.pdf',
        mimetype: 'application/pdf',
        body: '%PDF-1.4\n% image-only scanned source\n',
      });

      const ingestion = await buildCaseWikiUpload({
        file,
        userId: 'user-123',
        context: {
          privacyLevel: 'personal',
          redactionMode: 'strict',
          retentionPolicy: 'review-source',
        },
      });

      expect(ingestion.extraction).toEqual(
        expect.objectContaining({
          method: 'pdf OCR (pdftoppm + tesseract)',
          status: 'ready',
          warning: expect.stringContaining('OCR fallback'),
        }),
      );
      expect(ingestion.extraction.textPreview).toContain('Scanned PDF text says Street Voices');
      expect(ingestion.embeddingReview).toEqual(
        expect.objectContaining({
          provider: 'weaviate',
          status: 'awaiting-review',
          pendingCount: expect.any(Number),
        }),
      );
      expect(ingestion.embeddingReview.chunks.length).toBeGreaterThan(0);
      expect(ingestion.generatedRecords.frontendRecord).toEqual(
        expect.objectContaining({
          status: 'ready',
          parserWarning: expect.stringContaining('OCR fallback'),
          extractionMethod: 'pdf OCR (pdftoppm + tesseract)',
        }),
      );
    } finally {
      process.env.PATH = originalPath;
    }
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
        sourceScope: 'current-record',
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
        sourceScope: 'current-record',
        archive: expect.objectContaining({
          reviewStatus: 'attached-to-current-record',
          sourceNamespace: 'Case management record',
          lifeDomain: 'Case Management',
          sourceKind: 'note',
        }),
      }),
    );
    expect(ingestion.embeddingReview).toEqual(
      expect.objectContaining({
        provider: 'weaviate',
        status: 'awaiting-review',
        writeMode: 'dry-run',
        writeEnabled: false,
        privacyLevel: 'private',
        pendingCount: expect.any(Number),
        chunks: expect.arrayContaining([
          expect.objectContaining({
            status: 'pending-review',
            privacyLevel: 'private',
            lifeDomain: 'Case Management',
            textPreview: expect.stringContaining('[email redacted]'),
          }),
        ]),
      }),
    );
    expect(ingestion.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: expect.stringMatching(/^file:/), kind: 'SourceFile' }),
        expect.objectContaining({ id: expect.stringMatching(/^wiki:ingest:/), kind: 'WikiPage' }),
        expect.objectContaining({ id: 'client:client-001', kind: 'Client' }),
        expect.objectContaining({ id: 'case:case-001', kind: 'Case' }),
        expect.objectContaining({ id: 'service:Toronto Harbour Light', kind: 'Service' }),
        expect.objectContaining({ kind: 'LifeDomain', props: expect.objectContaining({ name: 'Case Management' }) }),
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

  it('keeps code workspace documentation in the development lane before topic keyword matching', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'case-wiki-dev-doc-'));
    tempDirs.push(tempDir);
    const docsDir = path.join(tempDir, 'Projects', 'Nano-Claw', 'docs');
    await fs.mkdir(docsDir, { recursive: true });
    const filePath = path.join(docsDir, 'APPLE-CONTAINER-NETWORKING.md');
    const body = [
      '# Apple Container Networking Setup',
      '',
      'This project image and container networking note describes build verification, DNS, and debugging steps.',
    ].join('\n');
    await fs.writeFile(filePath, body);

    const ingestion = await buildCaseWikiUpload({
      file: {
        path: filePath,
        filename: 'Projects/Nano-Claw/docs/APPLE-CONTAINER-NETWORKING.md',
        originalname: 'APPLE-CONTAINER-NETWORKING.md',
        mimetype: 'text/markdown',
        size: Buffer.byteLength(body),
      },
      userId: 'user-123',
      writeGraph: false,
      context: {
        privacyLevel: 'personal',
        redactionMode: 'strict',
        retentionPolicy: 'review-source',
      },
    });

    expect(ingestion.generatedRecords.frontendRecord.archive).toEqual(
      expect.objectContaining({
        lane: 'Development and code archives',
        lifeDomain: 'Development',
        lifeDomainId: 'development',
        sourceKind: 'note',
        suggestedCollections: expect.arrayContaining(['Domain: Development', 'Development and code archives']),
        classificationReason: expect.stringContaining('code workspace path'),
      }),
    );
    expect(ingestion.embeddingReview.chunks.length).toBeGreaterThan(0);
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
        linkedServiceName: '',
        sourceScope: 'standalone',
        archive: expect.objectContaining({
          lane: 'Tables and datasets',
          lifeDomain: 'Case Management',
          sourceKind: 'table',
          reviewStatus: 'needs-human-review',
          attachmentRecommendation: expect.stringContaining('Keep standalone'),
        }),
        embeddingReview: expect.objectContaining({
          provider: 'weaviate',
          targetClass: 'CaseWikiSourceChunk',
          status: 'awaiting-review',
          chunkCount: expect.any(Number),
        }),
      }),
    );
    expect(ingestion.archive).toEqual(
      expect.objectContaining({
        lane: 'Tables and datasets',
        lifeDomain: 'Case Management',
        suggestedWikiTitle: 'Referrals',
        sourceNamespace: 'Whole-life source archive',
      }),
    );
    expect(ingestion.graph.nodes).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'service:Employment bridge support', kind: 'Service' }),
      ]),
    );
    expect(ingestion.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'ArchiveCollection' }),
        expect.objectContaining({ kind: 'ArchiveLane', props: expect.objectContaining({ name: 'Tables and datasets' }) }),
        expect.objectContaining({ kind: 'ArchiveTopic', props: expect.objectContaining({ title: 'Referrals' }) }),
        expect.objectContaining({ kind: 'LifeDomain', props: expect.objectContaining({ name: 'Case Management' }) }),
        expect.objectContaining({ kind: 'Collection', props: expect.objectContaining({ name: 'Domain: Case Management' }) }),
      ]),
    );
    expect(ingestion.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'PART_OF_ARCHIVE' }),
        expect.objectContaining({ kind: 'CLASSIFIED_AS' }),
        expect.objectContaining({ kind: 'IN_DOMAIN' }),
        expect.objectContaining({ kind: 'IN_COLLECTION' }),
        expect.objectContaining({ kind: 'SUGGESTED_WIKI_TOPIC' }),
      ]),
    );
  });

  it('parses structured life files into readable wiki source text before embedding review', async () => {
    const structuredSources = [
      {
        name: 'partner-followup.eml',
        mimetype: 'message/rfc822',
        method: 'email message parser',
        sourceKind: 'email',
        body: [
          'Subject: Systems Innovation partner follow-up',
          'From: Joel Zola <joel@streetvoices.test>',
          'To: Toronto Library <programs@example.test>',
          'Date: Fri, 1 May 2026 10:15:00 -0400',
          'Content-Type: text/plain; charset=utf-8',
          '',
          'Please confirm the Street Voices workshop dates before we attach this source to any case record.',
        ].join('\n'),
        expected: ['Email source', 'Subject: Systems Innovation partner follow-up', 'Body:', 'workshop dates'],
      },
      {
        name: 'street-voices-mailbox.mbox',
        mimetype: 'application/mbox',
        method: 'mbox email archive parser',
        sourceKind: 'email',
        body: [
          'From joel@example.test Fri May 01 10:00:00 2026',
          'Subject: Archive intake plan',
          'From: Joel Zola <joel@example.test>',
          'To: Case Wiki <wiki@example.test>',
          'Date: Fri, 1 May 2026 10:00:00 -0400',
          'Content-Type: text/plain; charset=utf-8',
          '',
          'First message about turning files into a wiki without attaching them to demo clients.',
          '',
          'From partner@example.test Fri May 01 11:00:00 2026',
          'Subject: Partner list export',
          'From: Partner Lead <partner@example.test>',
          'To: Joel Zola <joel@example.test>',
          'Date: Fri, 1 May 2026 11:00:00 -0400',
          'Content-Type: text/plain; charset=utf-8',
          '',
          'Second message about keeping source documents separate until a human reviews them.',
        ].join('\n'),
        expected: ['MBOX email archive with 2 messages.', 'Archive intake plan', 'Partner list export'],
      },
      {
        name: 'open-brain-bookmarks.html',
        mimetype: 'text/html',
        method: 'browser bookmark html parser',
        sourceKind: 'bookmark',
        body: [
          '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
          '<TITLE>Bookmarks</TITLE>',
          '<H1>Bookmarks</H1>',
          '<DL><p>',
          '<DT><H3 ADD_DATE="1770000000">Whole Life Wiki Research</H3>',
          '<DL><p>',
          '<DT><A HREF="https://openbrainsystem.com/index" ADD_DATE="1770000001">Open Brain System</A>',
          '<DT><A HREF="https://example.test/karpathy-wiki-notes" ADD_DATE="1770000002">Karpathy LLM Wiki Notes</A>',
          '</DL><p>',
          '</DL><p>',
        ].join('\n'),
        expected: ['Browser bookmark export with 2 saved links.', 'Whole Life Wiki Research', 'Open Brain System'],
      },
      {
        name: 'case-wiki-calendar.ics',
        mimetype: 'text/calendar',
        method: 'calendar event parser',
        sourceKind: 'calendar',
        body: [
          'BEGIN:VCALENDAR',
          'BEGIN:VEVENT',
          'SUMMARY:Case Wiki review board',
          'DTSTART:20260504T140000Z',
          'DTEND:20260504T150000Z',
          'LOCATION:Street Voices office',
          'DESCRIPTION:Review source chunks before Weaviate approval.',
          'END:VEVENT',
          'END:VCALENDAR',
        ].join('\n'),
        expected: ['Calendar source with 1 event.', 'Case Wiki review board', 'Starts: 2026-05-04 14:00'],
      },
      {
        name: 'partner-contact.vcf',
        mimetype: 'text/vcard',
        method: 'contact card parser',
        sourceKind: 'contact',
        body: [
          'BEGIN:VCARD',
          'VERSION:3.0',
          'FN:Alex Partner',
          'ORG:Toronto Public Library',
          'TITLE:Community Program Lead',
          'EMAIL:alex.partner@example.test',
          'TEL:416-555-0100',
          'NOTE:Ask before linking this contact to a client or case.',
          'END:VCARD',
        ].join('\n'),
        expected: ['Contact source with 1 card.', 'Alex Partner', 'Toronto Public Library'],
      },
      {
        name: 'browser-export.json',
        mimetype: 'application/json',
        method: 'browser bookmark json parser',
        sourceKind: 'bookmark',
        body: JSON.stringify({
          bookmarks: [
            {
              title: 'Open Brain notes',
              url: 'https://example.test/open-brain',
              tags: ['wiki', 'knowledge graph'],
            },
          ],
          exportedAt: '2026-05-02',
        }),
        expected: ['Browser bookmark JSON with 1 saved link.', 'Open Brain notes', 'https://example.test/open-brain'],
      },
      {
        name: 'case-wiki-shortcut.url',
        mimetype: 'text/plain',
        method: 'internet shortcut parser',
        sourceKind: 'bookmark',
        body: ['[InternetShortcut]', 'URL=https://streetvoices.ca/case-wiki', 'Name=Case Wiki'].join('\n'),
        expected: ['Internet shortcut source', 'URL: https://streetvoices.ca/case-wiki'],
      },
      {
        name: 'open-brain.webloc',
        mimetype: 'application/x-webloc',
        method: 'macOS webloc parser',
        sourceKind: 'bookmark',
        body: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<plist version="1.0"><dict><key>Name</key><string>Open Brain</string><key>URL</key><string>https://openbrainsystem.com/index</string></dict></plist>',
        ].join('\n'),
        expected: ['macOS web location source', 'Open Brain', 'https://openbrainsystem.com/index'],
      },
      {
        name: 'street-voices-interview.vtt',
        mimetype: 'text/vtt',
        method: 'subtitle transcript parser',
        sourceKind: 'transcript',
        body: [
          'WEBVTT',
          '',
          '00:00:00.000 --> 00:00:04.000',
          'Joel: This interview belongs in the whole-life wiki as a transcript first.',
          '',
          '00:00:04.000 --> 00:00:08.000',
          'Guest: Review it before attaching it to any case or client.',
        ].join('\n'),
        expected: ['Transcript source with 2 timed segments.', 'Joel: This interview belongs in the whole-life wiki', 'Review it before attaching'],
      },
    ];

    for (const source of structuredSources) {
      const file = await makeUpload({
        name: source.name,
        mimetype: source.mimetype,
        body: source.body,
      });

      const ingestion = await buildCaseWikiUpload({
        file,
        userId: 'user-123',
        writeGraph: false,
        context: {
          privacyLevel: 'public',
          redactionMode: 'none',
          retentionPolicy: 'review-source',
        },
      });

      expect(ingestion.extraction).toEqual(
        expect.objectContaining({
          method: source.method,
          status: 'ready',
          tableSummary: expect.objectContaining({
            parser: source.method,
            itemCount: expect.any(Number),
          }),
        }),
      );
      source.expected.forEach((expectedText) => {
        expect(ingestion.extraction.textPreview).toContain(expectedText);
      });
      expect(ingestion.generatedRecords.frontendRecord).toEqual(
        expect.objectContaining({
          status: 'ready',
          vectorStatus: 'planned',
          sourceScope: 'standalone',
          archive: expect.objectContaining({
            sourceKind: source.sourceKind,
            reviewStatus: 'needs-human-review',
          }),
          embeddingReview: expect.objectContaining({
            provider: 'weaviate',
            status: 'awaiting-review',
          }),
        }),
      );
      expect(ingestion.embeddingReview.chunks.length).toBeGreaterThan(0);
    }
  });

  it('turns Apple iWork packages into reviewable source pages instead of silent metadata-only records', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'case-wiki-unzip-'));
    tempDirs.push(tempDir);
    const unzipStub = path.join(tempDir, 'unzip');
    await fs.writeFile(
      unzipStub,
      [
        '#!/bin/sh',
        'if [ "$1" = "-Z1" ]; then',
        '  printf "%s\\n" "Metadata/Properties.plist" "Index/Document.iwa" "QuickLook/Preview.pdf"',
        '  exit 0',
        'fi',
        'if [ "$1" = "-p" ] && [ "$3" = "Metadata/Properties.plist" ]; then',
        '  printf "%s\\n" "<?xml version=\\"1.0\\"?><plist><dict><key>Title</key><string>Life operating notes</string><key>Author</key><string>Street Voices</string></dict></plist>"',
        '  exit 0',
        'fi',
        'exit 1',
        '',
      ].join('\n'),
    );
    await fs.chmod(unzipStub, 0o755);
    process.env.CASE_WIKI_UNZIP_COMMAND = unzipStub;

    const file = await makeUpload({
      name: 'life-operating-notes.pages',
      mimetype: 'application/vnd.apple.pages',
      body: 'fake iwork archive body handled by unzip test stub',
    });

    const ingestion = await buildCaseWikiUpload({
      file,
      userId: 'user-123',
      writeGraph: false,
      context: {
        privacyLevel: 'public',
        redactionMode: 'none',
        retentionPolicy: 'review-source',
      },
    });

    expect(ingestion.extraction).toEqual(
      expect.objectContaining({
        method: 'apple iwork package parser',
        status: 'ready',
      }),
    );
    expect(ingestion.extraction.textPreview).toContain('Apple iWork source: Apple Pages document.');
    expect(ingestion.extraction.textPreview).toContain('Metadata entries:');
    expect(ingestion.extraction.textPreview).toContain('Life operating notes');
    expect(ingestion.generatedRecords.frontendRecord).toEqual(
      expect.objectContaining({
        status: 'ready',
        sourceScope: 'standalone',
        archive: expect.objectContaining({
          sourceKind: 'document',
          reviewStatus: 'needs-human-review',
        }),
        embeddingReview: expect.objectContaining({
          provider: 'weaviate',
          status: 'awaiting-review',
        }),
      }),
    );
    expect(ingestion.embeddingReview.chunks.length).toBeGreaterThan(0);
  });

  it('stages audio and video files as media sources that need transcript review', async () => {
    const file = await makeUpload({
      name: 'street-voices-field-recording.mp3',
      mimetype: 'audio/mpeg',
      body: Buffer.from('fake audio bytes for metadata staging'),
    });

    const ingestion = await buildCaseWikiUpload({
      file,
      userId: 'user-123',
      writeGraph: false,
      context: {
        privacyLevel: 'public',
        redactionMode: 'none',
        retentionPolicy: 'review-source',
      },
    });

    expect(ingestion.extraction).toEqual(
      expect.objectContaining({
        method: 'audio media metadata',
        status: 'metadata-only',
        tableSummary: expect.objectContaining({
          sourceKind: 'audio',
          transcriptStatus: 'missing',
        }),
      }),
    );
    expect(ingestion.extraction.textPreview).toContain('Audio recording source staged for Case Wiki review.');
    expect(ingestion.extraction.textPreview).toContain('Transcript status: no transcript has been extracted yet.');
    expect(ingestion.generatedRecords.frontendRecord).toEqual(
      expect.objectContaining({
        status: 'metadata-only',
        sourceScope: 'standalone',
        archive: expect.objectContaining({
          lane: 'Media and creative assets',
          lifeDomain: 'Creative',
          sourceKind: 'audio',
          suggestedCollections: expect.arrayContaining(['Audio recordings', 'Needs transcript review']),
        }),
      }),
    );
  });

  it('keeps real-world source lists separate from demo clients until reviewed', async () => {
    const file = await makeUpload({
      name: 'Injustice Systems Innovation Partner List.csv',
      mimetype: 'text/csv',
      body: [
        'organization,contact,focus',
        'Systems Innovation Lab,partner@example.test,policy research',
        'Community Justice Network,justice@example.test,community partnership',
      ].join('\n'),
    });

    const ingestion = await buildCaseWikiUpload({
      file,
      userId: 'user-123',
      writeGraph: false,
      context: {
        privacyLevel: 'personal',
        redactionMode: 'strict',
        retentionPolicy: 'review-source',
        sourceScope: 'standalone',
      },
    });

    expect(ingestion.linkedClientId).toBe('');
    expect(ingestion.linkedCaseId).toBe('');
    expect(ingestion.generatedRecords.frontendRecord).toEqual(
      expect.objectContaining({
        linkedClientId: '',
        linkedCaseId: '',
        sourceScope: 'standalone',
        archive: expect.objectContaining({
          lane: 'Partner and organization lists',
          lifeDomain: 'Partners',
          sourceKind: 'table',
          reviewStatus: 'needs-human-review',
          suggestedWikiTitle: 'Injustice Systems Innovation Partner List',
        }),
      }),
    );
    expect(ingestion.generatedRecords.note.structuredFields).toEqual(
      expect.arrayContaining([
        'Source boundary: standalone',
        'Life domain: Partners',
        'Source kind: table',
        'Archive lane: Partner and organization lists',
        'Review status: needs-human-review',
        'Suggested page: Injustice Systems Innovation Partner List',
        'Embedding review: awaiting-review',
      ]),
    );
    expect(ingestion.embeddingReview.chunks[0]).toEqual(
      expect.objectContaining({
        status: 'pending-review',
        privacyLevel: 'personal',
        lifeDomain: 'Partners',
        sourceKind: 'table',
      }),
    );
    expect(ingestion.graph.nodes).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'Client' }),
        expect.objectContaining({ kind: 'Case' }),
      ]),
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
        sourceScope: 'current-record',
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

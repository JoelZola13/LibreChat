const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const { resolveLocalArchiveFile, scanLocalArchive } = require('./CaseManagementLocalArchive');

describe('CaseManagementLocalArchive', () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'case-local-archive-'));
    process.env.CASE_MANAGEMENT_LOCAL_ARCHIVE_ROOTS = tempRoot;
    process.env.CASE_MANAGEMENT_LOCAL_ARCHIVE_ENABLED = 'true';
  });

  const sha256Text = (value) => crypto.createHash('sha256').update(value).digest('hex');

  afterEach(async () => {
    delete process.env.CASE_MANAGEMENT_LOCAL_ARCHIVE_ROOTS;
    delete process.env.CASE_MANAGEMENT_LOCAL_ARCHIVE_ENABLED;
    delete process.env.CASE_MANAGEMENT_LOCAL_ARCHIVE_TEXT_SIMILARITY_THRESHOLD;
    delete process.env.CASE_MANAGEMENT_VECTOR_PROVIDER;
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('builds an organizer map for wiki-ready local files', async () => {
    await fs.mkdir(path.join(tempRoot, 'Partners'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'Copies'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'Projects'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'System Innovation Partner List.docx'), 'partner list');
    await fs.writeFile(path.join(tempRoot, 'Partners', 'Street Voices Strategy Plan.md'), 'strategy plan');
    await fs.writeFile(path.join(tempRoot, 'TPL Agreement.pdf'), 'agreement');
    await fs.writeFile(path.join(tempRoot, 'Copies', 'TPL Agreement.pdf'), 'agreement copy');
    await fs.writeFile(path.join(tempRoot, 'Copies', 'TPL Contract.pdf'), 'agreement');
    await fs.writeFile(
      path.join(tempRoot, 'Projects', 'Community Pantry Launch Plan.md'),
      'community pantry launch plan partner outreach intake table volunteer route delivery schedule food support',
    );
    await fs.writeFile(
      path.join(tempRoot, 'Projects', 'Community Pantry Revised Notes.txt'),
      'community pantry launch plan partner outreach intake table volunteer route delivery schedule grocery support',
    );

    const scan = await scanLocalArchive({ limit: 20, maxDepth: 3 });

    expect(scan.enabled).toBe(true);
    expect(scan.summary.totalCandidates).toBe(7);
    expect(scan.summary.readinessCounts).toEqual(
      expect.objectContaining({
        'ready-to-ingest': expect.any(Number),
        'cleanup-candidate': 5,
      }),
    );
    expect(scan.summary.cleanupCounts).toEqual(
      expect.objectContaining({
        'duplicate-content': 2,
        'near-duplicate-text': 2,
      }),
    );
    expect(scan.summary.hashSummary).toEqual(
      expect.objectContaining({
        hashedFiles: 7,
        contentDuplicateGroups: 1,
        contentDuplicateFiles: 2,
      }),
    );
    expect(scan.summary.textSimilaritySummary).toEqual(
      expect.objectContaining({
        fingerprintedFiles: 2,
        nearDuplicateGroups: 1,
        nearDuplicateFiles: 2,
      }),
    );
    expect(scan.summary.collectionCounts).toEqual(
      expect.objectContaining({
        'Systems innovation': expect.any(Number),
        'Readable documents': expect.any(Number),
      }),
    );
    expect(scan.campaignPlan).toEqual(
      expect.objectContaining({
        safeBatchLimit: 12,
        nextPassId: 'picky-recommended',
        policy: expect.stringContaining('do not attach sources to clients/cases'),
        passes: expect.arrayContaining([
          expect.objectContaining({
            id: 'picky-recommended',
            intent: 'picky-catalog-first',
            count: expect.any(Number),
            candidateIds: expect.any(Array),
          }),
          expect.objectContaining({
            id: 'clean-high-value',
            intent: 'catalog-first',
            count: expect.any(Number),
            candidateIds: expect.any(Array),
          }),
          expect.objectContaining({
            id: 'cleanup-and-canonical',
            intent: 'cleanup-review',
            count: expect.any(Number),
            candidateIds: expect.any(Array),
          }),
        ]),
      }),
    );
    expect(scan.summary.domainCounts).toEqual(
      expect.objectContaining({
        Partners: expect.any(Number),
        Projects: expect.any(Number),
      }),
    );

    const partnerList = scan.candidates.find((candidate) => candidate.fileName === 'System Innovation Partner List.docx');
    expect(partnerList).toEqual(
      expect.objectContaining({
        lane: 'Partner and organization lists',
        importReadiness: 'ready-to-ingest',
        lifeDomain: 'Partners',
        lifeDomainId: 'partners',
        sourceKind: 'document',
        suggestedWikiTitle: 'System Innovation Partner List',
        suggestedCollections: expect.arrayContaining(['Domain: Partners', 'Systems innovation', 'Partners and services']),
        pickyTier: 'import-now',
        pickyAction: 'Stage as a standalone wiki source',
        pickyReasons: expect.arrayContaining(['knowledge-wiki value signal']),
      }),
    );

    const duplicates = scan.candidates.filter((candidate) => candidate.fileName === 'TPL Agreement.pdf');
    expect(duplicates).toHaveLength(2);
    expect(duplicates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cleanupSignals: expect.arrayContaining(['duplicate-name']),
          duplicateGroupKey: 'same-name:tpl agreement.pdf',
          importReadiness: 'cleanup-candidate',
        }),
      ]),
    );

    const contentDuplicates = scan.candidates.filter((candidate) => candidate.cleanupSignals.includes('duplicate-content'));
    expect(contentDuplicates).toHaveLength(2);
    expect(new Set(contentDuplicates.map((candidate) => candidate.sourceHash)).size).toBe(1);
    expect(contentDuplicates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: 'TPL Agreement.pdf',
          sourceHashStatus: 'hashed',
          contentDuplicateCount: 2,
        }),
        expect.objectContaining({
          fileName: 'TPL Contract.pdf',
          sourceHashStatus: 'hashed',
          contentDuplicateCount: 2,
        }),
      ]),
    );

    const nearDuplicates = scan.candidates.filter((candidate) => candidate.cleanupSignals.includes('near-duplicate-text'));
    expect(nearDuplicates).toHaveLength(2);
    expect(new Set(nearDuplicates.map((candidate) => candidate.nearDuplicateGroupKey)).size).toBe(1);
    expect(nearDuplicates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: 'Community Pantry Launch Plan.md',
          textFingerprintStatus: 'fingerprinted',
          nearDuplicateCount: 2,
          nearDuplicateScore: expect.any(Number),
          nearDuplicateTerms: expect.arrayContaining(['community', 'pantry', 'partner']),
        }),
        expect.objectContaining({
          fileName: 'Community Pantry Revised Notes.txt',
          textFingerprintStatus: 'fingerprinted',
          nearDuplicateCount: 2,
        }),
      ]),
    );
  });

  it('discovers mailbox and Apple iWork sources as whole-life wiki candidates', async () => {
    await fs.mkdir(path.join(tempRoot, 'Life Archive'), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, 'Life Archive', 'Street Voices mailbox.mbox'),
      [
        'From joel@example.test Fri May 01 10:00:00 2026',
        'Subject: Whole life wiki inbox',
        '',
        'Mailbox archive belongs in correspondence until reviewed.',
      ].join('\n'),
    );
    await fs.writeFile(path.join(tempRoot, 'Life Archive', 'Life Operating Notes.pages'), 'fake pages package');

    const scan = await scanLocalArchive({ limit: 20, maxDepth: 3 });
    const mailbox = scan.candidates.find((candidate) => candidate.fileName === 'Street Voices mailbox.mbox');
    const pages = scan.candidates.find((candidate) => candidate.fileName === 'Life Operating Notes.pages');

    expect(mailbox).toEqual(
      expect.objectContaining({
        lane: 'Calendar, email, and correspondence',
        sourceKind: 'email',
        mimeType: 'application/mbox',
        suggestedCollections: expect.arrayContaining(['Calendar, email, and correspondence']),
      }),
    );
    expect(pages).toEqual(
      expect.objectContaining({
        lane: 'Source documents',
        sourceKind: 'document',
        mimeType: 'application/vnd.apple.pages',
        suggestedCollections: expect.arrayContaining(['Readable documents']),
      }),
    );
  });

  it('discovers browser bookmarks and saved web links as research sources', async () => {
    await fs.mkdir(path.join(tempRoot, 'Research'), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, 'Research', 'Open Brain Bookmarks.html'),
      [
        '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
        '<DL><p>',
        '<DT><H3>Whole Life Wiki Research</H3>',
        '<DT><A HREF="https://openbrainsystem.com/index">Open Brain System</A>',
        '</DL><p>',
      ].join('\n'),
    );
    await fs.writeFile(
      path.join(tempRoot, 'Research', 'Case Wiki.url'),
      ['[InternetShortcut]', 'URL=https://streetvoices.ca/case-wiki'].join('\n'),
    );
    await fs.writeFile(
      path.join(tempRoot, 'Research', 'Open Brain.webloc'),
      '<plist><dict><key>URL</key><string>https://openbrainsystem.com/index</string></dict></plist>',
    );

    const scan = await scanLocalArchive({ limit: 20, maxDepth: 3 });
    const bookmarks = scan.candidates.find((candidate) => candidate.fileName === 'Open Brain Bookmarks.html');
    const shortcut = scan.candidates.find((candidate) => candidate.fileName === 'Case Wiki.url');
    const webloc = scan.candidates.find((candidate) => candidate.fileName === 'Open Brain.webloc');

    [bookmarks, shortcut, webloc].forEach((candidate) => {
      expect(candidate).toEqual(
        expect.objectContaining({
          lane: 'Browser bookmarks and web research',
          lifeDomain: 'Research',
          sourceKind: 'bookmark',
          suggestedCollections: expect.arrayContaining(['Browser bookmarks and web research', 'Saved web links']),
        }),
      );
    });
    expect(shortcut).toEqual(expect.objectContaining({ mimeType: 'text/plain' }));
    expect(webloc).toEqual(expect.objectContaining({ mimeType: 'application/x-webloc' }));
  });

  it('discovers recordings and captions as media sources that need transcript review', async () => {
    await fs.mkdir(path.join(tempRoot, 'Recordings'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'Recordings', 'Street Voices Interview.mp3'), 'fake audio bytes');
    await fs.writeFile(path.join(tempRoot, 'Recordings', 'Community Workshop.mov'), 'fake video bytes');
    await fs.writeFile(
      path.join(tempRoot, 'Recordings', 'Community Workshop.vtt'),
      ['WEBVTT', '', '00:00:00.000 --> 00:00:02.000', 'Welcome to the workshop.'].join('\n'),
    );

    const scan = await scanLocalArchive({ limit: 20, maxDepth: 3 });
    const audio = scan.candidates.find((candidate) => candidate.fileName === 'Street Voices Interview.mp3');
    const video = scan.candidates.find((candidate) => candidate.fileName === 'Community Workshop.mov');
    const captions = scan.candidates.find((candidate) => candidate.fileName === 'Community Workshop.vtt');

    expect(audio).toEqual(
      expect.objectContaining({
        lane: 'Media and creative assets',
        lifeDomain: 'Creative',
        sourceKind: 'audio',
        mimeType: 'audio/mpeg',
        reviewAction: 'Review transcript value',
        suggestedCollections: expect.arrayContaining(['Audio recordings', 'Needs transcript review']),
      }),
    );
    expect(video).toEqual(
      expect.objectContaining({
        lane: 'Media and creative assets',
        lifeDomain: 'Creative',
        sourceKind: 'video',
        mimeType: 'video/quicktime',
        reviewAction: 'Review transcript value',
        suggestedCollections: expect.arrayContaining(['Video recordings', 'Needs transcript review']),
      }),
    );
    expect(captions).toEqual(
      expect.objectContaining({
        lane: 'Media and creative assets',
        lifeDomain: 'Creative',
        sourceKind: 'transcript',
        mimeType: 'text/vtt',
        suggestedCollections: expect.arrayContaining(['Transcripts and captions']),
      }),
    );
    expect(scan.campaignPlan.passes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'media-transcript-review',
          intent: 'transcript-needed',
          count: 2,
          candidateIds: expect.arrayContaining([audio.id, video.id]),
          safetyNote: expect.stringContaining('metadata-only'),
        }),
      ]),
    );
  });

  it('quarantines credential-looking files from normal wiki ingestion', async () => {
    await fs.mkdir(path.join(tempRoot, 'nanobot-secrets'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'nanobot-secrets', 'config.json'), '{"apiKey":"test"}');

    const scan = await scanLocalArchive({ limit: 20, maxDepth: 3 });
    const secretConfig = scan.candidates.find((candidate) => candidate.fileName === 'config.json');

    expect(secretConfig).toEqual(
      expect.objectContaining({
        cleanupSignals: expect.arrayContaining(['sensitive-credential-review']),
        importReadiness: 'blocked-sensitive',
        lifeDomain: 'Street Voices',
        sourceKind: 'source',
        reviewAction: 'Quarantine credentials before ingest',
      }),
    );
    await expect(
      resolveLocalArchiveFile({
        rootId: scan.roots[0].id,
        relativePath: path.join('nanobot-secrets', 'config.json'),
      }),
    ).rejects.toThrow('Sensitive credential-like local archive files are blocked from wiki ingest');
  });

  it('keeps runtime noise out of whole-life archive scans', async () => {
    await fs.mkdir(path.join(tempRoot, 'OrbStack', 'docker', 'containers', 'neo4j'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'Documents'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'OrbStack', 'docker', 'containers', 'neo4j', 'debug.log'), 'runtime log noise');
    await fs.writeFile(path.join(tempRoot, 'Documents', 'Whole Life Roadmap.md'), 'whole life wiki source document');

    const scan = await scanLocalArchive({ limit: 20, maxDepth: 5 });

    expect(scan.candidates.map((candidate) => candidate.fileName)).toContain('Whole Life Roadmap.md');
    expect(scan.candidates.map((candidate) => candidate.fileName)).not.toContain('debug.log');
    expect(scan.summary.skipped.directories).toBeGreaterThanOrEqual(1);
  });

  it('separates code project artifacts from life and case documents', async () => {
    await fs.mkdir(path.join(tempRoot, 'Projects', 'Nanobot', 'client'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'Projects', 'Nanobot', 'client', 'package.json'), '{"name":"nanobot"}');

    const scan = await scanLocalArchive({ limit: 20, maxDepth: 5 });
    const packageConfig = scan.candidates.find((candidate) => candidate.fileName === 'package.json');

    expect(packageConfig).toEqual(
      expect.objectContaining({
        lane: 'Development and code archives',
        lifeDomain: 'Development',
        lifeDomainId: 'development',
        importPriority: 'low',
        cleanupSignals: expect.arrayContaining(['technical-artifact-review']),
        reviewAction: 'Review project artifact',
      }),
    );
  });

  it('demotes generated web assets so they do not crowd out life documents', async () => {
    await fs.mkdir(path.join(tempRoot, 'Projects', 'Mautic', 'themes', 'streetvoices', 'assets'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'Documents'), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, 'Projects', 'Mautic', 'themes', 'streetvoices', 'assets', 'hero-image.png'),
      'generated image asset',
    );
    await fs.writeFile(path.join(tempRoot, 'Documents', 'Whole Life Strategy Notes.md'), 'systems innovation notes');

    const scan = await scanLocalArchive({ limit: 20, maxDepth: 7 });
    const webAsset = scan.candidates.find((candidate) => candidate.fileName === 'hero-image.png');
    const lifeDocument = scan.candidates.find((candidate) => candidate.fileName === 'Whole Life Strategy Notes.md');

    expect(webAsset).toEqual(
      expect.objectContaining({
        lane: 'Development and code archives',
        lifeDomain: 'Development',
        importPriority: 'low',
        cleanupSignals: expect.arrayContaining(['generated-project-asset-review']),
        reviewAction: 'Review generated project asset',
      }),
    );
    expect(lifeDocument.importPriority).toBe('high');
  });

  it('keeps project readmes and dependency docs out of first-pass life wiki selections', async () => {
    await fs.mkdir(path.join(tempRoot, 'Projects', 'LibreChat', 'client'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'Projects', 'Mautic', 'themes', '_showcase'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'Projects', 'Mautic', 'vendor', 'symfony', 'http-foundation'), {
      recursive: true,
    });
    await fs.mkdir(path.join(tempRoot, 'Documents'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'Projects', 'LibreChat', 'README.md'), 'repository readme');
    await fs.writeFile(path.join(tempRoot, 'Projects', 'Mautic', 'themes', '_showcase', 'README.md'), 'theme readme');
    await fs.writeFile(
      path.join(tempRoot, 'Projects', 'Mautic', 'vendor', 'symfony', 'http-foundation', 'CHANGELOG.md'),
      'dependency changelog',
    );
    await fs.writeFile(
      path.join(tempRoot, 'Documents', 'Systems Innovation Partner List.md'),
      'systems innovation partner list source for whole life wiki organization',
    );

    const scan = await scanLocalArchive({ limit: 20, maxDepth: 6 });
    const repoReadme = scan.candidates.find((candidate) => candidate.displayPath.endsWith('LibreChat/README.md'));
    const themeReadme = scan.candidates.find((candidate) => candidate.displayPath.endsWith('_showcase/README.md'));
    const cleanPass = scan.campaignPlan.passes.find((pass) => pass.id === 'clean-high-value');
    const readablePass = scan.campaignPlan.passes.find((pass) => pass.id === 'readable-extraction');
    const partnerList = scan.candidates.find((candidate) => candidate.fileName === 'Systems Innovation Partner List.md');

    expect(scan.candidates.map((candidate) => candidate.fileName)).not.toContain('CHANGELOG.md');
    expect(repoReadme).toEqual(
      expect.objectContaining({
        lane: 'Development and code archives',
        lifeDomain: 'Development',
        importPriority: 'low',
        cleanupSignals: expect.arrayContaining(['technical-artifact-review']),
      }),
    );
    expect(themeReadme).toEqual(
      expect.objectContaining({
        lane: 'Development and code archives',
        lifeDomain: 'Development',
        importPriority: 'low',
        cleanupSignals: expect.arrayContaining(['technical-artifact-review']),
      }),
    );
    expect(partnerList).toEqual(
      expect.objectContaining({
        importReadiness: 'ready-to-ingest',
        lifeDomain: 'Partners',
      }),
    );
    expect(cleanPass.candidateIds).toContain(partnerList.id);
    expect(cleanPass.candidateIds).not.toContain(repoReadme.id);
    expect(cleanPass.candidateIds).not.toContain(themeReadme.id);
    expect(readablePass.candidateIds).not.toContain(repoReadme.id);
    expect(readablePass.candidateIds).not.toContain(themeReadme.id);
  });

  it('keeps browser smoke-test files out of clean life-wiki import passes', async () => {
    await fs.mkdir(path.join(tempRoot, 'CaseWikiIngestSmoke'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'Street Voices'), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, 'CaseWikiIngestSmoke', 'case-wiki-chrome-smoke-20260430-110827.md'),
      'case wiki chrome smoke test source',
    );
    await fs.writeFile(
      path.join(tempRoot, 'Street Voices', 'Street Voices System Innovation Roles.docx'),
      'street voices system innovation roles',
    );

    const scan = await scanLocalArchive({ limit: 20, maxDepth: 7 });
    const smoke = scan.candidates.find((candidate) => candidate.fileName.includes('chrome-smoke'));
    const roles = scan.candidates.find((candidate) => candidate.fileName === 'Street Voices System Innovation Roles.docx');
    const cleanPass = scan.campaignPlan.passes.find((pass) => pass.id === 'clean-high-value');

    expect(smoke).toEqual(
      expect.objectContaining({
        lane: 'Development and code archives',
        importPriority: 'low',
        cleanupSignals: expect.arrayContaining(['technical-artifact-review']),
      }),
    );
    expect(roles).toEqual(expect.objectContaining({ importReadiness: 'ready-to-ingest' }));
    expect(cleanPass.candidateIds).toContain(roles.id);
    expect(cleanPass.candidateIds).not.toContain(smoke.id);
  });

  it('stages known code workspace notes separately from whole-life readable sources', async () => {
    await fs.mkdir(path.join(tempRoot, 'Nanobot'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'LibreChat', 'docs'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'Projects', 'List_Monk', 'docs'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'Projects', 'List_Monk', 'frontend', 'cypress', 'fixtures'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'Projects', 'Mautic', 'var', 'cache'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'Projects', 'Nano-Claw', 'docs'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'Downloads', 'plane-selfhost', 'apps', 'api', 'plane', 'tests'), {
      recursive: true,
    });
    await fs.mkdir(path.join(tempRoot, 'Downloads'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'Desktop'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'Nanobot', 'HANDOFF.md'), 'repo handoff for development work');
    await fs.writeFile(
      path.join(tempRoot, 'LibreChat', 'docs', 'streetvoices-news-aggregator.md'),
      'repo documentation for a product feature',
    );
    await fs.writeFile(
      path.join(tempRoot, 'Projects', 'List_Monk', 'docs', 'segmented-workflow-checklist.md'),
      'repo checklist for the Listmonk software workspace',
    );
    await fs.writeFile(
      path.join(tempRoot, 'Projects', 'List_Monk', 'frontend', 'cypress', 'fixtures', 'subs.csv'),
      'email,name\nfixture@example.test,Fixture User',
    );
    await fs.writeFile(
      path.join(tempRoot, 'Projects', 'Mautic', 'var', 'cache', 'saml_default.key'),
      '-----BEGIN PRIVATE KEY-----\nredacted test fixture\n-----END PRIVATE KEY-----',
    );
    await fs.writeFile(
      path.join(tempRoot, 'Projects', 'Nano-Claw', 'docs', 'APPLE-CONTAINER-NETWORKING.md'),
      'Apple container networking setup for a software project',
    );
    await fs.writeFile(
      path.join(tempRoot, 'Projects', 'Nano-Claw', 'docs', 'DEBUG_CHECKLIST.md'),
      'Debug checklist for a software project',
    );
    await fs.writeFile(
      path.join(tempRoot, 'Downloads', 'plane-selfhost', 'apps', 'api', 'plane', 'tests', 'TESTING_GUIDE.md'),
      'Testing guide for the Plane software workspace.',
    );
    await fs.writeFile(
      path.join(tempRoot, 'Downloads', 'listmonk_ultimate_implementation_guide.md'),
      'downloaded implementation guide that should remain a standalone readable source',
    );
    await fs.writeFile(
      path.join(tempRoot, 'Desktop', 'local3180-analytics-platform-plan.md'),
      'analytics platform plan for organizing whole life source documents',
    );

    const scan = await scanLocalArchive({ limit: 20, maxDepth: 7 });
    const handoff = scan.candidates.find((candidate) => candidate.displayPath.endsWith('Nanobot/HANDOFF.md'));
    const repoDoc = scan.candidates.find((candidate) => candidate.displayPath.endsWith('streetvoices-news-aggregator.md'));
    const listMonkRepoDoc = scan.candidates.find((candidate) =>
      candidate.displayPath.endsWith('List_Monk/docs/segmented-workflow-checklist.md'),
    );
    const listMonkFixture = scan.candidates.find((candidate) =>
      candidate.displayPath.endsWith('List_Monk/frontend/cypress/fixtures/subs.csv'),
    );
    const samlKey = scan.candidates.find((candidate) =>
      candidate.displayPath.endsWith('Mautic/var/cache/saml_default.key'),
    );
    const nanoClawNetworking = scan.candidates.find((candidate) =>
      candidate.displayPath.endsWith('Nano-Claw/docs/APPLE-CONTAINER-NETWORKING.md'),
    );
    const nanoClawDebug = scan.candidates.find((candidate) =>
      candidate.displayPath.endsWith('Nano-Claw/docs/DEBUG_CHECKLIST.md'),
    );
    const planeTestingGuide = scan.candidates.find((candidate) =>
      candidate.displayPath.endsWith('plane-selfhost/apps/api/plane/tests/TESTING_GUIDE.md'),
    );
    const downloadedGuide = scan.candidates.find((candidate) =>
      candidate.fileName === 'listmonk_ultimate_implementation_guide.md',
    );
    const desktopPlan = scan.candidates.find((candidate) => candidate.fileName === 'local3180-analytics-platform-plan.md');
    const readablePass = scan.campaignPlan.passes.find((pass) => pass.id === 'readable-extraction');
    const cleanupPass = scan.campaignPlan.passes.find((pass) => pass.id === 'cleanup-and-canonical');
    const developmentPass = scan.campaignPlan.passes.find((pass) => pass.id === 'development-code-review');

    expect(handoff).toEqual(
      expect.objectContaining({
        lane: 'Development and code archives',
        importPriority: 'low',
        cleanupSignals: expect.arrayContaining(['technical-artifact-review']),
      }),
    );
    expect(repoDoc).toEqual(
      expect.objectContaining({
        lane: 'Development and code archives',
        importPriority: 'low',
        cleanupSignals: expect.arrayContaining(['technical-artifact-review']),
      }),
    );
    expect(listMonkRepoDoc).toEqual(
      expect.objectContaining({
        lane: 'Development and code archives',
        importPriority: 'low',
        cleanupSignals: expect.arrayContaining(['technical-artifact-review']),
      }),
    );
    expect(listMonkFixture).toEqual(
      expect.objectContaining({
        lane: 'Development and code archives',
        importPriority: 'low',
        cleanupSignals: expect.arrayContaining(['technical-artifact-review']),
      }),
    );
    expect(samlKey).toEqual(
      expect.objectContaining({
        importReadiness: 'blocked-sensitive',
        cleanupSignals: expect.arrayContaining(['sensitive-credential-review']),
      }),
    );
    expect(nanoClawNetworking).toEqual(
      expect.objectContaining({
        lane: 'Development and code archives',
        importPriority: 'low',
        cleanupSignals: expect.arrayContaining(['technical-artifact-review']),
      }),
    );
    expect(nanoClawDebug).toEqual(
      expect.objectContaining({
        lane: 'Development and code archives',
        importPriority: 'low',
        cleanupSignals: expect.arrayContaining(['technical-artifact-review']),
      }),
    );
    expect(planeTestingGuide).toEqual(
      expect.objectContaining({
        lane: 'Development and code archives',
        importPriority: 'low',
        cleanupSignals: expect.arrayContaining(['technical-artifact-review']),
      }),
    );
    expect(downloadedGuide).toEqual(expect.objectContaining({ sourceKind: 'note' }));
    expect(desktopPlan).toEqual(expect.objectContaining({ sourceKind: 'note' }));
    expect(readablePass.candidateIds).toContain(desktopPlan.id);
    expect(readablePass.candidateIds).not.toContain(handoff.id);
    expect(readablePass.candidateIds).not.toContain(repoDoc.id);
    expect(readablePass.candidateIds).not.toContain(listMonkRepoDoc.id);
    expect(readablePass.candidateIds).not.toContain(listMonkFixture.id);
    expect(readablePass.candidateIds).not.toContain(samlKey.id);
    expect(readablePass.candidateIds).not.toContain(nanoClawNetworking.id);
    expect(readablePass.candidateIds).not.toContain(nanoClawDebug.id);
    expect(readablePass.candidateIds).not.toContain(planeTestingGuide.id);
    expect(cleanupPass.candidateIds).toContain(downloadedGuide.id);
    expect(developmentPass.candidateIds).toEqual(
      expect.arrayContaining([
        handoff.id,
        repoDoc.id,
        listMonkRepoDoc.id,
        listMonkFixture.id,
        nanoClawNetworking.id,
        nanoClawDebug.id,
        planeTestingGuide.id,
      ]),
    );
    expect(developmentPass.candidateIds).not.toContain(downloadedGuide.id);
  });

  it('keeps numbered agent chat exports out of clean readable ingestion batches', async () => {
    await fs.mkdir(path.join(tempRoot, 'Projects', 'Agent_0', 'usr', 'chats', '5ebdDTKH', 'messages'), {
      recursive: true,
    });
    await fs.mkdir(path.join(tempRoot, 'Projects', 'Agent_0', 'knowledge', 'custom'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'Projects', 'Agent_0', 'prompts'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'Documents', 'Obsidian Vault', 'Multi Agent System'), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, 'Projects', 'Agent_0', 'usr', 'chats', '5ebdDTKH', 'messages', '5.txt'),
      'Daily Bread food bank source export with links and snippets that needs a better title before it becomes a wiki page.',
    );
    await fs.writeFile(
      path.join(tempRoot, 'Projects', 'Agent_0', 'usr', 'chats', '5ebdDTKH', 'messages', 'agent.system.tool.openclaw.md'),
      'Tool prompt for an experimental agent.',
    );
    await fs.writeFile(
      path.join(tempRoot, 'Projects', 'Agent_0', 'knowledge', 'custom', 'streetvoices_editorial_guide.md'),
      'Editorial guide from an agent export that should be reviewed before becoming a wiki source.',
    );
    await fs.writeFile(
      path.join(tempRoot, 'Projects', 'Agent_0', 'prompts', 'memory.consolidation.sys.md'),
      'Prompt file from an agent export.',
    );
    await fs.writeFile(
      path.join(tempRoot, 'Documents', 'Obsidian Vault', 'Multi Agent System', 'Research Manager.md'),
      'research manager note for whole-life wiki source organization',
    );

    const scan = await scanLocalArchive({ limit: 20, maxDepth: 8 });
    const messageExport = scan.candidates.find((candidate) => candidate.displayPath.endsWith('Agent_0/usr/chats/5ebdDTKH/messages/5.txt'));
    const toolPrompt = scan.candidates.find((candidate) => candidate.fileName === 'agent.system.tool.openclaw.md');
    const customKnowledge = scan.candidates.find((candidate) => candidate.fileName === 'streetvoices_editorial_guide.md');
    const memoryPrompt = scan.candidates.find((candidate) => candidate.fileName === 'memory.consolidation.sys.md');
    const obsidianNote = scan.candidates.find((candidate) => candidate.fileName === 'Research Manager.md');
    const readablePass = scan.campaignPlan.passes.find((pass) => pass.id === 'readable-extraction');
    const cleanupPass = scan.campaignPlan.passes.find((pass) => pass.id === 'cleanup-and-canonical');

    expect(messageExport).toEqual(
      expect.objectContaining({
        lane: 'AI chat and agent exports',
        importPriority: 'low',
        importReadiness: 'ready-to-review',
        reviewAction: 'Review chat export before ingest',
        cleanupSignals: expect.arrayContaining(['agent-chat-export-review']),
      }),
    );
    expect(toolPrompt).toEqual(
      expect.objectContaining({
        lane: 'AI chat and agent exports',
        importPriority: 'low',
        importReadiness: 'ready-to-review',
        cleanupSignals: expect.arrayContaining(['agent-chat-export-review']),
      }),
    );
    expect(customKnowledge).toEqual(
      expect.objectContaining({
        lane: 'AI chat and agent exports',
        importPriority: 'low',
        importReadiness: 'ready-to-review',
        cleanupSignals: expect.arrayContaining(['agent-chat-export-review']),
      }),
    );
    expect(memoryPrompt).toEqual(
      expect.objectContaining({
        lane: 'AI chat and agent exports',
        importPriority: 'low',
        importReadiness: 'ready-to-review',
        cleanupSignals: expect.arrayContaining(['agent-chat-export-review']),
      }),
    );
    expect(obsidianNote).toEqual(expect.objectContaining({ sourceKind: 'note' }));
    expect(readablePass.candidateIds).toContain(obsidianNote.id);
    expect(readablePass.candidateIds).not.toContain(messageExport.id);
    expect(readablePass.candidateIds).not.toContain(toolPrompt.id);
    expect(readablePass.candidateIds).not.toContain(customKnowledge.id);
    expect(readablePass.candidateIds).not.toContain(memoryPrompt.id);
    expect(cleanupPass.candidateIds).toEqual(
      expect.arrayContaining([messageExport.id, toolPrompt.id, customKnowledge.id, memoryPrompt.id]),
    );
  });

  it('keeps the curated readable pass picky when only generic files are available', async () => {
    await fs.mkdir(path.join(tempRoot, 'Documents'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'Documents', 'hello.docx'), 'hello world');
    await fs.writeFile(path.join(tempRoot, 'Documents', 'contents.docx'), 'generic contents');
    await fs.writeFile(
      path.join(tempRoot, 'Documents', 'M Works Film Festival Support Materials.pdf'),
      'film festival support materials for the M Works creative portfolio and partnership record',
    );
    await fs.writeFile(
      path.join(tempRoot, 'Documents', 'Open Brain Life Wiki Roadmap.md'),
      'open brain life wiki roadmap for organizing personal and case-management knowledge sources',
    );

    const scan = await scanLocalArchive({ limit: 20, maxDepth: 3 });
    const hello = scan.candidates.find((candidate) => candidate.fileName === 'hello.docx');
    const contents = scan.candidates.find((candidate) => candidate.fileName === 'contents.docx');
    const supportMaterials = scan.candidates.find(
      (candidate) => candidate.fileName === 'M Works Film Festival Support Materials.pdf',
    );
    const roadmap = scan.candidates.find((candidate) => candidate.fileName === 'Open Brain Life Wiki Roadmap.md');
    const readablePass = scan.campaignPlan.passes.find((pass) => pass.id === 'readable-extraction');

    expect(hello).toEqual(expect.objectContaining({ sourceKind: 'document' }));
    expect(contents).toEqual(expect.objectContaining({ sourceKind: 'document' }));
    expect(supportMaterials).toEqual(expect.objectContaining({ sourceKind: 'document' }));
    expect(roadmap).toEqual(expect.objectContaining({ sourceKind: 'note' }));
    expect(readablePass).toEqual(
      expect.objectContaining({
        label: 'Curated readable queue',
        actionLabel: 'Select curated pass',
      }),
    );
    expect(readablePass.candidateIds).toEqual(expect.arrayContaining([supportMaterials.id, roadmap.id]));
    expect(readablePass.candidateIds).not.toContain(hello.id);
    expect(readablePass.candidateIds).not.toContain(contents.id);
  });

  it('skips generated build output directories during whole-life scans', async () => {
    await fs.mkdir(path.join(tempRoot, 'Projects', 'Nanobot', 'client', 'dist-streetbot', 'assets'), {
      recursive: true,
    });
    await fs.mkdir(path.join(tempRoot, 'Documents'), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, 'Projects', 'Nanobot', 'client', 'dist-streetbot', 'assets', 'anyscale.png'),
      'compiled app image asset',
    );
    await fs.writeFile(path.join(tempRoot, 'Documents', 'Whole Life Strategy Notes.md'), 'systems innovation notes');

    const scan = await scanLocalArchive({ limit: 20, maxDepth: 8 });

    expect(scan.candidates.map((candidate) => candidate.fileName)).toContain('Whole Life Strategy Notes.md');
    expect(scan.candidates.map((candidate) => candidate.fileName)).not.toContain('anyscale.png');
    expect(scan.summary.skipped.directories).toBeGreaterThanOrEqual(1);
  });

  it('carries canonical and superseded source history back into future scans', async () => {
    const canonicalText = 'street voices canonical strategy plan source retained for the whole life wiki archive';
    const oldText = 'street voices old strategy plan source superseded by the canonical wiki archive source';
    await fs.writeFile(path.join(tempRoot, 'Canonical Strategy.md'), canonicalText);
    await fs.writeFile(path.join(tempRoot, 'Old Strategy.md'), oldText);

    const scan = await scanLocalArchive({
      limit: 20,
      maxDepth: 2,
      sourceHistory: [
        {
          sourceHash: sha256Text(canonicalText),
          sourceId: 'source-canonical',
          sourceLabel: 'Canonical Strategy',
          sourcePageId: 'ingest:source-canonical',
          cleanupDecision: { status: 'canonical-source' },
        },
        {
          sourceHash: sha256Text(oldText),
          sourceId: 'source-old',
          sourceLabel: 'Old Strategy',
          sourcePageId: 'ingest:source-old',
          cleanupDecision: {
            status: 'superseded-by-canonical',
            canonicalSource: {
              sourceId: 'source-canonical',
              sourceLabel: 'Canonical Strategy',
              sourcePageId: 'ingest:source-canonical',
              sourceHash: sha256Text(canonicalText),
            },
          },
        },
      ],
    });

    expect(scan.summary.sourceHistorySummary).toEqual(
      expect.objectContaining({
        knownSources: 2,
        canonicalSources: 1,
        supersededSources: 1,
        matchedFiles: 2,
        canonicalMatches: 1,
        supersededMatches: 1,
      }),
    );
    expect(scan.candidates.find((candidate) => candidate.fileName === 'Canonical Strategy.md')).toEqual(
      expect.objectContaining({
        cleanupSignals: expect.arrayContaining(['known-canonical-source']),
        importReadiness: 'cleanup-candidate',
        sourceHistory: expect.objectContaining({
          status: 'canonical-source',
          label: 'Known canonical source',
          canonicalSource: expect.objectContaining({ sourceLabel: 'Canonical Strategy' }),
        }),
      }),
    );
    expect(scan.candidates.find((candidate) => candidate.fileName === 'Old Strategy.md')).toEqual(
      expect.objectContaining({
        cleanupSignals: expect.arrayContaining(['known-superseded-source']),
        importReadiness: 'cleanup-candidate',
        sourceHistory: expect.objectContaining({
          status: 'superseded-by-canonical',
          canonicalSource: expect.objectContaining({ sourceLabel: 'Canonical Strategy' }),
        }),
      }),
    );
  });

  it('flags renamed source-family matches from canonical lineage memory', async () => {
    const canonicalText = 'systems innovation partner list toronto shelter research street voices knowledge wiki';
    const renamedText =
      'systems innovation partner list toronto shelter research street voices knowledge wiki with updated formatting';
    await fs.writeFile(path.join(tempRoot, 'Systems Innovation Partner List Revised.md'), renamedText);

    const scan = await scanLocalArchive({
      limit: 20,
      maxDepth: 2,
      sourceHistory: [
        {
          sourceHash: sha256Text(canonicalText),
          sourceId: 'source-canonical',
          sourceLabel: 'Systems Innovation Partner List',
          sourcePageId: 'ingest:source-canonical',
          cleanupDecision: {
            status: 'canonical-source',
            canonicalLineage: {
              groupId: 'canonical-lineage:systems-innovation',
              canonicalSource: {
                sourceId: 'source-canonical',
                sourceLabel: 'Systems Innovation Partner List',
                sourcePageId: 'ingest:source-canonical',
                sourceHash: sha256Text(canonicalText),
              },
              aliases: [
                { label: 'Systems Innovation Partner List', key: 'systems innovation partner list' },
                { label: 'System Innovation Partners.csv', key: 'system innovation partners' },
              ],
              members: [
                {
                  sourceId: 'source-canonical',
                  sourceLabel: 'Systems Innovation Partner List',
                  sourcePageId: 'ingest:source-canonical',
                  sourceHash: sha256Text(canonicalText),
                  role: 'canonical',
                  aliases: ['System Innovation Partners.csv'],
                },
              ],
              sourceHashes: [sha256Text(canonicalText)],
              matchEvidence: [{ type: 'remembered-aliases', detail: '2 remembered aliases' }],
            },
          },
        },
      ],
    });

    const renamed = scan.candidates.find((candidate) => candidate.fileName === 'Systems Innovation Partner List Revised.md');
    const sourceFamilyPass = scan.campaignPlan.passes.find((pass) => pass.id === 'source-family-review');
    const cleanupPass = scan.campaignPlan.passes.find((pass) => pass.id === 'cleanup-and-canonical');
    expect(scan.summary.sourceHistorySummary).toEqual(
      expect.objectContaining({
        lineageSources: 1,
        lineageMatches: 1,
      }),
    );
    expect(renamed).toEqual(
      expect.objectContaining({
        cleanupSignals: expect.arrayContaining(['known-source-family']),
        importReadiness: 'cleanup-candidate',
        sourceHistory: expect.objectContaining({
          status: 'source-family-match',
          label: 'Known source family',
          matchMethod: 'lineage-alias',
          canonicalSource: expect.objectContaining({ sourceLabel: 'Systems Innovation Partner List' }),
          canonicalLineage: expect.objectContaining({ groupId: 'canonical-lineage:systems-innovation' }),
        }),
      }),
    );
    expect(sourceFamilyPass).toEqual(
      expect.objectContaining({
        label: 'Source-family review',
        intent: 'lineage-review',
        candidateIds: expect.arrayContaining([renamed.id]),
      }),
    );
    expect(cleanupPass?.candidateIds || []).not.toContain(renamed.id);
    expect(scan.campaignPlan.nextPassId).toBe('source-family-review');
  });
});

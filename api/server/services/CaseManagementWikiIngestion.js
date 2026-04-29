const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const fetch = require('node-fetch');

const MAX_TEXT_CHARS = 180000;
const PREVIEW_CHARS = 3200;

const TEXT_EXTENSIONS = new Set([
  '.csv',
  '.css',
  '.env',
  '.htm',
  '.html',
  '.ini',
  '.js',
  '.json',
  '.jsx',
  '.log',
  '.markdown',
  '.md',
  '.rtf',
  '.scss',
  '.sql',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

const normalizeWhitespace = (value = '') => value.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').trim();

const summarize = (text, fallback) => {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return fallback;
  const sentence = normalized.split(/(?<=[.!?])\s+/).find((part) => part.length > 40);
  return (sentence || normalized).slice(0, 420);
};

const sha256File = async (filePath) => {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

const isTextLikeFile = (file) => {
  const mimeType = file.mimetype || '';
  const extension = path.extname(file.originalname || '').toLowerCase();
  return (
    mimeType.startsWith('text/') ||
    mimeType.includes('json') ||
    mimeType.includes('xml') ||
    mimeType.includes('csv') ||
    mimeType.includes('yaml') ||
    TEXT_EXTENSIONS.has(extension)
  );
};

const extractTextFromFile = async (file) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const baseExtraction = {
    method: 'metadata',
    status: 'metadata-only',
    text: '',
    textPreview: '',
    textBytes: 0,
    warning: 'Binary extraction is queued. The file is stored, graphed, and represented as a wiki source record.',
  };

  if (!isTextLikeFile(file)) {
    return {
      ...baseExtraction,
      method: `${extension || file.mimetype || 'binary'} metadata`,
    };
  }

  const buffer = await fs.readFile(file.path);
  const text = normalizeWhitespace(buffer.toString('utf8')).slice(0, MAX_TEXT_CHARS);
  return {
    method: 'utf8 text',
    status: text ? 'ready' : 'metadata-only',
    text,
    textPreview: text.slice(0, PREVIEW_CHARS),
    textBytes: Buffer.byteLength(text, 'utf8'),
    warning: text.length >= MAX_TEXT_CHARS ? 'Text was truncated for the first wiki pass.' : '',
  };
};

const extractEntities = (text, originalName, context) => {
  const entities = new Set();
  const source = `${originalName}\n${text || ''}`;
  const emailMatches = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  emailMatches.slice(0, 12).forEach((email) => entities.add(email));

  const dateMatches =
    source.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/gi) || [];
  dateMatches.slice(0, 12).forEach((date) => entities.add(date));

  [
    'housing',
    'shelter',
    'employment',
    'identification',
    'legal',
    'health',
    'mental health',
    'food',
    'referral',
    'consent',
    'appointment',
    'benefits',
    'income support',
    'school',
    'youth',
  ].forEach((keyword) => {
    if (source.toLowerCase().includes(keyword)) entities.add(keyword);
  });

  if (context.clientName) entities.add(context.clientName);
  if (context.caseTitle) entities.add(context.caseTitle);
  if (context.serviceName) entities.add(context.serviceName);

  return Array.from(entities).slice(0, 24);
};

const buildSections = (text, fileName, extraction) => {
  if (!text) {
    return [
      {
        heading: 'Source file',
        body: `${fileName} was accepted into the Case Wiki as a source artifact. Full text extraction is not available for this file type yet, so the wiki page starts from metadata and graph links.`,
      },
      {
        heading: 'Next extraction pass',
        body: 'Add an OCR or document-parser worker to enrich this page with page text, tables, image captions, and embedded metadata while preserving the original upload as the source of truth.',
      },
    ];
  }

  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const firstParagraphs = paragraphs.slice(0, 5);
  const sections = firstParagraphs.map((paragraph, index) => ({
    heading: index === 0 ? 'Lead material' : `Source excerpt ${index + 1}`,
    body: paragraph.slice(0, 900),
  }));

  sections.push({
    heading: 'Ingestion notes',
    body: `The first pass used ${extraction.method}. ${extraction.warning || 'No parser warning was recorded.'}`,
  });

  return sections;
};

const buildGraph = ({ fileId, wikiPageId, file, extraction, context, entities, sha256 }) => {
  const nodes = [
    {
      id: `file:${fileId}`,
      kind: 'SourceFile',
      props: {
        name: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size || 0,
        sha256,
        extractionStatus: extraction.status,
      },
    },
    {
      id: `wiki:${wikiPageId}`,
      kind: 'WikiPage',
      props: {
        title: `Ingested source: ${file.originalname}`,
        source: file.originalname,
        generatedBy: 'Case Wiki ingestion',
      },
    },
  ];
  const edges = [
    {
      from: `file:${fileId}`,
      to: `wiki:${wikiPageId}`,
      kind: 'GENERATED_WIKI_PAGE',
      props: { extractionStatus: extraction.status },
    },
  ];

  if (context.clientId) {
    nodes.push({ id: `client:${context.clientId}`, kind: 'Client', props: { name: context.clientName || context.clientId } });
    edges.push({ from: `wiki:${wikiPageId}`, to: `client:${context.clientId}`, kind: 'ABOUT_CLIENT', props: {} });
  }
  if (context.caseId) {
    nodes.push({ id: `case:${context.caseId}`, kind: 'Case', props: { title: context.caseTitle || context.caseId } });
    edges.push({ from: `wiki:${wikiPageId}`, to: `case:${context.caseId}`, kind: 'ABOUT_CASE', props: {} });
  }
  if (context.serviceName) {
    nodes.push({ id: `service:${context.serviceName}`, kind: 'Service', props: { name: context.serviceName } });
    edges.push({ from: `wiki:${wikiPageId}`, to: `service:${context.serviceName}`, kind: 'ABOUT_SERVICE', props: {} });
  }

  entities.forEach((entity) => {
    const entityId = `entity:${entity.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    if (!entityId.endsWith(':')) {
      nodes.push({ id: entityId, kind: 'Mention', props: { name: entity } });
      edges.push({ from: `wiki:${wikiPageId}`, to: entityId, kind: 'MENTIONS', props: {} });
    }
  });

  const uniqueNodes = Array.from(new Map(nodes.map((node) => [node.id, node])).values());
  return { nodes: uniqueNodes, edges };
};

const writeToNeo4j = async (graph) => {
  if (process.env.CASE_MANAGEMENT_NEO4J_DISABLED === 'true') {
    return {
      status: 'skipped',
      skippedReason: 'CASE_MANAGEMENT_NEO4J_DISABLED is true',
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
    };
  }

  const neo4jUrl =
    process.env.NEO4J_HTTP_URL ||
    process.env.CASE_MANAGEMENT_NEO4J_HTTP_URL ||
    'http://case-management-neo4j:7474';
  const endpoint = `${neo4jUrl.replace(/\/$/, '')}/db/${encodeURIComponent(process.env.NEO4J_DATABASE || 'neo4j')}/tx/commit`;
  const headers = { 'Content-Type': 'application/json' };
  const username = process.env.NEO4J_USERNAME || process.env.NEO4J_USER || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || process.env.CASE_MANAGEMENT_NEO4J_PASSWORD || 'streetvoicescasewiki';
  if (username && password) {
    headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        statements: [
          {
            statement:
              'UNWIND $nodes AS node MERGE (n:CaseManagementKnowledge {id: node.id}) SET n += node.props, n.kind = node.kind, n.updatedAt = datetime()',
            parameters: { nodes: graph.nodes },
          },
          {
            statement:
              'UNWIND $edges AS edge MATCH (from:CaseManagementKnowledge {id: edge.from}) MATCH (to:CaseManagementKnowledge {id: edge.to}) MERGE (from)-[r:RELATED_TO {kind: edge.kind}]->(to) SET r += edge.props, r.updatedAt = datetime()',
            parameters: { edges: graph.edges },
          },
        ],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.errors?.length) {
      return {
        status: 'failed',
        message: payload.errors?.[0]?.message || `Neo4j returned ${response.status}`,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
      };
    }
    return {
      status: 'written',
      message: 'Neo4j graph updated',
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
    };
  } catch (error) {
    return {
      status: 'failed',
      message: error.message,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
    };
  }
};

const buildCaseWikiUpload = async ({ file, userId, context }) => {
  const createdAt = new Date().toISOString();
  const fileId = crypto.randomUUID();
  const ingestionId = `wiki-ingest-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const wikiPageId = `ingest:${fileId}`;
  const sha256 = await sha256File(file.path);
  const extraction = await extractTextFromFile(file);
  const entities = extractEntities(extraction.textPreview || extraction.text, file.originalname, context);
  const sections = buildSections(extraction.textPreview || extraction.text, file.originalname, extraction);
  const summary = summarize(
    extraction.textPreview || extraction.text,
    `${file.originalname} was uploaded into the Case Wiki and linked to the selected case-management context.`,
  );
  const graph = buildGraph({ fileId, wikiPageId, file, extraction, context, entities, sha256 });
  const neo4j = await writeToNeo4j(graph);
  const title = `Ingested source: ${file.originalname}`;

  const noteId = `note-ingest-${fileId}`;
  const documentId = `doc-ingest-${fileId}`;
  const timelineId = `timeline-ingest-${fileId}`;
  const linkedClientId = context.clientId || '';
  const linkedCaseId = context.caseId || '';

  return {
    ingestionId,
    fileId,
    originalName: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype || 'application/octet-stream',
    size: file.size || 0,
    sha256,
    path: file.path,
    linkedClientId,
    linkedCaseId,
    linkedServiceName: context.serviceName || '',
    sourcePageId: context.pageId || '',
    extraction: {
      method: extraction.method,
      status: extraction.status,
      textPreview: extraction.textPreview,
      textBytes: extraction.textBytes,
      warning: extraction.warning,
    },
    wikiPage: {
      id: wikiPageId,
      title,
      summary,
      sections,
      entities,
      sourceFileId: fileId,
      sourceFileName: file.originalname,
      uploadedAt: createdAt,
      generatedBy: 'Case Wiki ingestion',
    },
    generatedRecords: {
      note: {
        id: noteId,
        timestamp: createdAt,
        author: 'Case Wiki ingestion',
        clientId: linkedClientId,
        caseId: linkedCaseId,
        type: 'wiki source ingestion',
        narrative: summary,
        structuredFields: ['Uploaded source file', `Extraction: ${extraction.status}`, `Neo4j: ${neo4j.status}`],
        attachments: [file.originalname],
        followUpRequired: extraction.status !== 'ready' || neo4j.status !== 'written',
        visibility: 'team',
        aiSummary: `Generated wiki source page from ${file.originalname}.`,
        aiTags: ['wiki ingestion', 'source file', extraction.status],
      },
      document: {
        id: documentId,
        clientId: linkedClientId,
        caseId: linkedCaseId,
        name: file.originalname,
        type: path.extname(file.originalname || '').replace('.', '').toUpperCase() || file.mimetype || 'FILE',
        tag: 'Case Wiki source',
        uploadedAt: createdAt,
        permission: 'team',
        searchableText: extraction.textPreview || extraction.warning,
      },
      timeline: {
        id: timelineId,
        clientId: linkedClientId,
        caseId: linkedCaseId,
        occurredAt: createdAt,
        type: 'wiki file ingested',
        title: `${file.originalname} ingested into Case Wiki`,
        detail: `${file.originalname} generated a wiki page, ${graph.nodes.length} graph node${graph.nodes.length === 1 ? '' : 's'}, and ${graph.edges.length} graph edge${graph.edges.length === 1 ? '' : 's'}. Neo4j status: ${neo4j.status}.`,
      },
      frontendRecord: {
        id: fileId,
        fileName: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size || 0,
        uploadedAt: createdAt,
        status: extraction.status === 'ready' ? 'ready' : 'metadata-only',
        extractionStatus: extraction.status,
        extractionMethod: extraction.method,
        graphStatus: neo4j.status,
        graphMessage: neo4j.message || neo4j.skippedReason || '',
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        linkedClientId,
        linkedCaseId,
        linkedServiceName: context.serviceName || '',
        pageId: wikiPageId,
        title,
        summary,
        textPreview: extraction.textPreview,
        sections,
        entities,
        sourceFileId: fileId,
        noteId,
        documentId,
        timelineId,
      },
    },
    graph,
    neo4j,
    createdAt,
    userId,
  };
};

module.exports = {
  buildCaseWikiUpload,
};

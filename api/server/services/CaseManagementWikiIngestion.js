const crypto = require('crypto');
const { execFile } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const { promisify } = require('util');
const fetch = require('node-fetch');

const MAX_TEXT_CHARS = 180000;
const PREVIEW_CHARS = 3200;
const EXEC_BUFFER = 8 * 1024 * 1024;
const execFileAsync = promisify(execFile);

const TEXT_EXTENSIONS = new Set([
  '.csv',
  '.css',
  '.eml',
  '.env',
  '.htm',
  '.html',
  '.ics',
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
  '.vcf',
  '.xml',
  '.yaml',
  '.yml',
]);

const PDF_EXTENSIONS = new Set(['.pdf']);
const OFFICE_XML_EXTENSIONS = new Set(['.docx', '.pptx', '.xlsx']);
const OCR_EXTENSIONS = new Set(['.avif', '.bmp', '.gif', '.heic', '.jpeg', '.jpg', '.png', '.tif', '.tiff', '.webp']);
const PRIVACY_LEVELS = new Set(['case-team', 'private', 'personal', 'public']);
const REDACTION_MODES = new Set(['standard', 'strict', 'none']);

const normalizeWhitespace = (value = '') => value.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').trim();

const normalizeWikiIngestContext = (context = {}) => {
  const privacyLevel = PRIVACY_LEVELS.has(context.privacyLevel) ? context.privacyLevel : 'case-team';
  const redactionMode = REDACTION_MODES.has(context.redactionMode) ? context.redactionMode : 'standard';
  return {
    ...context,
    privacyLevel,
    redactionMode,
    retentionPolicy: typeof context.retentionPolicy === 'string' && context.retentionPolicy ? context.retentionPolicy : 'keep-source',
    reviewBeforeGraphWrite: context.reviewBeforeGraphWrite === true || context.reviewBeforeGraphWrite === 'true',
  };
};

const redactSensitiveText = (text = '', mode = 'standard') => {
  if (!text || mode === 'none') return text;
  let redacted = text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]')
    .replace(/\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g, '[phone redacted]')
    .replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, '[identifier redacted]')
    .replace(/\b(?:\d[ -]*?){13,16}\b/g, '[card redacted]');

  if (mode === 'strict') {
    redacted = redacted
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '[date redacted]')
      .replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/gi, '[date redacted]');
  }

  return redacted;
};

const runExtractor = async (command, args) => {
  try {
    const { stdout } = await execFileAsync(command, args, { maxBuffer: EXEC_BUFFER });
    return { ok: true, stdout };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

const xmlToText = (xml = '') =>
  normalizeWhitespace(
    xml
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br\/>/g, '\n')
      .replace(/<\/(?:w:p|a:p|row|c|si)>/g, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'"),
  );

const stripRtf = (text = '') =>
  normalizeWhitespace(
    text
      .replace(/\\'[0-9a-f]{2}/gi, ' ')
      .replace(/\\[a-z]+-?\d* ?/gi, ' ')
      .replace(/[{}]/g, ' '),
  );

const parseCsvPreview = (text = '') => {
  const lines = normalizeWhitespace(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  const delimiter = [',', '\t', ';', '|'].sort((left, right) => lines[0].split(right).length - lines[0].split(left).length)[0];
  const splitLine = (line) => {
    const cells = [];
    let current = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  };
  const headers = splitLine(lines[0]).filter(Boolean);
  const rows = lines.slice(1, 21).map(splitLine);
  const tableText = [
    `CSV table with ${Math.max(0, lines.length - 1)} rows and ${headers.length || rows[0]?.length || 0} columns.`,
    headers.length ? `Headers: ${headers.join(', ')}.` : '',
    ...rows.slice(0, 5).map((row, index) => `Row ${index + 1}: ${row.join(' | ')}`),
  ]
    .filter(Boolean)
    .join('\n');
  return {
    delimiter: delimiter === '\t' ? 'tab' : delimiter,
    rowCount: Math.max(0, lines.length - 1),
    columnCount: headers.length || rows[0]?.length || 0,
    headers,
    tableText,
  };
};

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

const extractPdfText = async (file) => {
  const extracted = await runExtractor('pdftotext', [file.path, '-']);
  if (extracted.ok) {
    const text = normalizeWhitespace(extracted.stdout).slice(0, MAX_TEXT_CHARS);
    if (text) {
      return {
        method: 'pdftotext',
        status: 'ready',
        text,
        warning: text.length >= MAX_TEXT_CHARS ? 'PDF text was truncated for the first wiki pass.' : '',
      };
    }
  }

  const buffer = await fs.readFile(file.path);
  const fallbackText = normalizeWhitespace(
    buffer
      .toString('latin1')
      .match(/\((?:\\.|[^\\)]){8,}\)/g)
      ?.map((match) => match.slice(1, -1).replace(/\\([()\\])/g, '$1'))
      .join('\n') || '',
  ).slice(0, MAX_TEXT_CHARS);

  if (fallbackText.length > 80) {
    return {
      method: 'pdf literal text fallback',
      status: 'ready',
      text: fallbackText,
      warning: 'Used a basic PDF literal-text fallback. Install pdftotext for stronger PDF extraction.',
    };
  }

  return {
    method: '.pdf metadata',
    status: 'metadata-only',
    text: '',
    warning: extracted.ok
      ? 'No embedded PDF text was found. OCR is needed for scanned pages.'
      : `PDF parser unavailable (${extracted.error}). Install pdftotext for full PDF extraction.`,
  };
};

const extractOfficeOpenXmlText = async (file, extension) => {
  const entriesByExtension = {
    '.docx': ['word/document.xml'],
    '.pptx': ['ppt/slides/*.xml'],
    '.xlsx': ['xl/sharedStrings.xml', 'xl/worksheets/*.xml'],
  };
  const entries = entriesByExtension[extension] || [];
  const chunks = [];
  const warnings = [];

  for (const entry of entries) {
    const extracted = await runExtractor('unzip', ['-p', file.path, entry]);
    if (extracted.ok && extracted.stdout) {
      chunks.push(xmlToText(extracted.stdout));
    } else if (!extracted.ok) {
      warnings.push(extracted.error);
    }
  }

  const text = normalizeWhitespace(chunks.join('\n')).slice(0, MAX_TEXT_CHARS);
  if (text) {
    return {
      method: `${extension} OpenXML`,
      status: 'ready',
      text,
      warning: text.length >= MAX_TEXT_CHARS ? 'Office document text was truncated for the first wiki pass.' : '',
    };
  }

  return {
    method: `${extension} metadata`,
    status: 'metadata-only',
    text: '',
    warning: warnings.length
      ? `Office parser could not read the document (${warnings[0]}).`
      : 'Office document text extraction found no readable text.',
  };
};

const extractImageText = async (file, extension) => {
  const extracted = await runExtractor('tesseract', [file.path, 'stdout']);
  if (extracted.ok) {
    const text = normalizeWhitespace(extracted.stdout).slice(0, MAX_TEXT_CHARS);
    if (text) {
      return {
        method: 'tesseract OCR',
        status: 'ready',
        text,
        warning: text.length >= MAX_TEXT_CHARS ? 'OCR text was truncated for the first wiki pass.' : '',
      };
    }
  }
  return {
    method: `${extension || 'image'} metadata`,
    status: 'metadata-only',
    text: '',
    warning: extracted.ok
      ? 'OCR found no readable text in this image.'
      : `OCR parser unavailable (${extracted.error}). Install tesseract for image and scan extraction.`,
  };
};

const extractTextFromFile = async (file, context = {}) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const baseExtraction = {
    method: 'metadata',
    status: 'metadata-only',
    text: '',
    textPreview: '',
    textBytes: 0,
    warning: 'Binary extraction is queued. The file is stored, graphed, and represented as a wiki source record.',
  };

  let extraction;
  let tableSummary = null;

  if (PDF_EXTENSIONS.has(extension)) {
    extraction = await extractPdfText(file);
  } else if (OFFICE_XML_EXTENSIONS.has(extension)) {
    extraction = await extractOfficeOpenXmlText(file, extension);
  } else if (OCR_EXTENSIONS.has(extension)) {
    extraction = await extractImageText(file, extension);
  } else if (!isTextLikeFile(file)) {
    extraction = {
      ...baseExtraction,
      method: `${extension || file.mimetype || 'binary'} metadata`,
    };
  } else {
    const buffer = await fs.readFile(file.path);
    let text = normalizeWhitespace(buffer.toString('utf8')).slice(0, MAX_TEXT_CHARS);
    if (extension === '.rtf') {
      text = stripRtf(text).slice(0, MAX_TEXT_CHARS);
    }
    if (extension === '.csv') {
      tableSummary = parseCsvPreview(text);
      if (tableSummary) {
        text = `${tableSummary.tableText}\n\n${text}`.slice(0, MAX_TEXT_CHARS);
      }
    }
    extraction = {
      method: extension === '.csv' ? 'csv text table parser' : 'utf8 text',
      status: text ? 'ready' : 'metadata-only',
      text,
      warning: text.length >= MAX_TEXT_CHARS ? 'Text was truncated for the first wiki pass.' : '',
    };
  }

  const redactedText = redactSensitiveText(extraction.text, context.redactionMode);
  return {
    ...baseExtraction,
    ...extraction,
    text: redactedText,
    textPreview: redactedText.slice(0, PREVIEW_CHARS),
    textBytes: Buffer.byteLength(redactedText, 'utf8'),
    rawTextBytes: Buffer.byteLength(extraction.text || '', 'utf8'),
    warning: extraction.warning || '',
    tableSummary,
    privacy: {
      privacyLevel: context.privacyLevel,
      redactionMode: context.redactionMode,
      redacted: context.redactionMode !== 'none' && redactedText !== extraction.text,
    },
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
        extractionMethod: extraction.method,
        privacyLevel: context.privacyLevel,
        redactionMode: context.redactionMode,
        retentionPolicy: context.retentionPolicy,
      },
    },
    {
      id: `wiki:${wikiPageId}`,
      kind: 'WikiPage',
      props: {
        title: `Ingested source: ${file.originalname}`,
        source: file.originalname,
        generatedBy: 'Case Wiki ingestion',
        privacyLevel: context.privacyLevel,
      },
    },
  ];
  const edges = [
    {
      from: `file:${fileId}`,
      to: `wiki:${wikiPageId}`,
      kind: 'GENERATED_WIKI_PAGE',
      props: { extractionStatus: extraction.status, privacyLevel: context.privacyLevel },
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

const summarizeGraph = (graph) => {
  const nodeKinds = graph.nodes.reduce((acc, node) => {
    acc[node.kind] = (acc[node.kind] || 0) + 1;
    return acc;
  }, {});
  const edgeKinds = graph.edges.reduce((acc, edge) => {
    acc[edge.kind] = (acc[edge.kind] || 0) + 1;
    return acc;
  }, {});
  return { nodeKinds, edgeKinds };
};

const buildCaseWikiUpload = async ({ file, userId, context, writeGraph = true }) => {
  const normalizedContext = normalizeWikiIngestContext(context);
  const createdAt = new Date().toISOString();
  const fileId = crypto.randomUUID();
  const ingestionId = `wiki-ingest-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const wikiPageId = `ingest:${fileId}`;
  const sha256 = await sha256File(file.path);
  const extraction = await extractTextFromFile(file, normalizedContext);
  const entities = extractEntities(extraction.textPreview || extraction.text, file.originalname, normalizedContext);
  const sections = buildSections(extraction.textPreview || extraction.text, file.originalname, extraction);
  const summary = summarize(
    extraction.textPreview || extraction.text,
    `${file.originalname} was uploaded into the Case Wiki and linked to the selected case-management context.`,
  );
  const graph = buildGraph({ fileId, wikiPageId, file, extraction, context: normalizedContext, entities, sha256 });
  const graphSummary = summarizeGraph(graph);
  const neo4j = writeGraph
    ? await writeToNeo4j(graph)
    : {
        status: 'preview',
        message: 'Graph preview generated without writing to Neo4j',
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
      };
  const title = `Ingested source: ${file.originalname}`;

  const noteId = `note-ingest-${fileId}`;
  const documentId = `doc-ingest-${fileId}`;
  const timelineId = `timeline-ingest-${fileId}`;
  const linkedClientId = normalizedContext.clientId || '';
  const linkedCaseId = normalizedContext.caseId || '';

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
    linkedServiceName: normalizedContext.serviceName || '',
    sourcePageId: normalizedContext.pageId || '',
    privacy: {
      privacyLevel: normalizedContext.privacyLevel,
      redactionMode: normalizedContext.redactionMode,
      retentionPolicy: normalizedContext.retentionPolicy,
    },
    extraction: {
      method: extraction.method,
      status: extraction.status,
      textPreview: extraction.textPreview,
      textBytes: extraction.textBytes,
      rawTextBytes: extraction.rawTextBytes,
      warning: extraction.warning,
      tableSummary: extraction.tableSummary,
      privacy: extraction.privacy,
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
        visibility: normalizedContext.privacyLevel === 'private' || normalizedContext.privacyLevel === 'personal' ? 'private' : 'team',
        aiSummary: `Generated wiki source page from ${file.originalname}.`,
        aiTags: ['wiki ingestion', 'source file', extraction.status, normalizedContext.privacyLevel],
      },
      document: {
        id: documentId,
        clientId: linkedClientId,
        caseId: linkedCaseId,
        name: file.originalname,
        type: path.extname(file.originalname || '').replace('.', '').toUpperCase() || file.mimetype || 'FILE',
        tag: 'Case Wiki source',
        uploadedAt: createdAt,
        permission: normalizedContext.privacyLevel === 'private' || normalizedContext.privacyLevel === 'personal' ? 'private' : 'team',
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
        linkedServiceName: normalizedContext.serviceName || '',
        pageId: wikiPageId,
        title,
        summary,
        textPreview: extraction.textPreview,
        sections,
        entities,
        privacyLevel: normalizedContext.privacyLevel,
        redactionMode: normalizedContext.redactionMode,
        retentionPolicy: normalizedContext.retentionPolicy,
        parserWarning: extraction.warning,
        tableSummary: extraction.tableSummary,
        graphSummary,
        graphPreview: graph,
        sourceFileId: fileId,
        noteId,
        documentId,
        timelineId,
      },
    },
    graph,
    graphSummary,
    neo4j,
    createdAt,
    userId,
  };
};

module.exports = {
  buildCaseWikiUpload,
  normalizeWikiIngestContext,
};

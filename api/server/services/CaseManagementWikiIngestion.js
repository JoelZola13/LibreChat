const crypto = require('crypto');
const { execFile } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { promisify } = require('util');
const fetch = require('node-fetch');

const MAX_TEXT_CHARS = 180000;
const PREVIEW_CHARS = 3200;
const EXEC_BUFFER = 8 * 1024 * 1024;
const PDF_OCR_PAGE_LIMIT = 6;
const execFileAsync = promisify(execFile);
const pdfTextCommand = () => process.env.CASE_WIKI_PDF_TEXT_COMMAND || 'pdftotext';
const pdfRenderCommand = () => process.env.CASE_WIKI_PDF_RENDER_COMMAND || 'pdftoppm';
const ocrCommand = () => process.env.CASE_WIKI_OCR_COMMAND || 'tesseract';
const unzipCommand = () => process.env.CASE_WIKI_UNZIP_COMMAND || 'unzip';

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
  '.mbox',
  '.md',
  '.rtf',
  '.scss',
  '.sql',
  '.srt',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.url',
  '.vcf',
  '.vtt',
  '.webloc',
  '.xml',
  '.yaml',
  '.yml',
]);

const PDF_EXTENSIONS = new Set(['.pdf']);
const OFFICE_XML_EXTENSIONS = new Set(['.docx', '.pptx', '.xlsx']);
const APPLE_IWORK_EXTENSIONS = new Set(['.pages', '.numbers', '.key']);
const OCR_EXTENSIONS = new Set(['.avif', '.bmp', '.gif', '.heic', '.jpeg', '.jpg', '.png', '.tif', '.tiff', '.webp']);
const AUDIO_EXTENSIONS = new Set(['.aac', '.aif', '.aiff', '.flac', '.m4a', '.mp3', '.wav']);
const VIDEO_EXTENSIONS = new Set(['.avi', '.m4v', '.mkv', '.mov', '.mp4', '.mpeg', '.mpg', '.webm']);
const TRANSCRIPT_EXTENSIONS = new Set(['.srt', '.vtt']);
const PRIVACY_LEVELS = new Set(['case-team', 'private', 'personal', 'public']);
const REDACTION_MODES = new Set(['standard', 'strict', 'none']);
const SOURCE_SCOPES = new Set(['standalone', 'current-record']);
const EMBEDDING_REVIEW_CHUNK_CHARS = 1200;
const EMBEDDING_REVIEW_CHUNK_PREVIEW_CHARS = 520;
const EMBEDDING_REVIEW_CHUNK_LIMIT = 24;
const CASE_WIKI_VECTOR_PROVIDER = 'weaviate';
const ARCHIVE_LANES = [
  {
    id: 'partner-and-organization-lists',
    label: 'Partner and organization lists',
    keywords: ['partner', 'partners', 'organization', 'organisation', 'directory', 'stakeholder', 'coalition', 'vendor', 'service provider', 'contact list'],
  },
  {
    id: 'projects-and-strategy',
    label: 'Projects and strategy',
    keywords: ['strategy', 'roadmap', 'proposal', 'innovation', 'systems', 'project', 'grant', 'program', 'plan', 'research'],
  },
  {
    id: 'case-management-material',
    label: 'Case management material',
    keywords: ['case', 'client', 'intake', 'referral', 'consent', 'appointment', 'housing', 'shelter', 'benefits', 'legal', 'clinic', 'outreach'],
  },
  {
    id: 'personal-admin-and-identity',
    label: 'Personal admin and identity',
    keywords: ['passport', 'driver', 'licence', 'license', 'birth certificate', 'tax', 'bank', 'insurance', 'lease', 'invoice', 'receipt', 'identification'],
  },
  {
    id: 'calendar-email-and-correspondence',
    label: 'Calendar, email, and correspondence',
    keywords: ['email', 'inbox', 'calendar', 'meeting', 'minutes', 'thread', 'memo', 'letter', 'message'],
  },
  {
    id: 'media-and-creative-assets',
    label: 'Media and creative assets',
    keywords: ['photo', 'image', 'video', 'audio', 'podcast', 'portfolio', 'gallery', 'recording', 'transcript'],
  },
  {
    id: 'tables-and-datasets',
    label: 'Tables and datasets',
    keywords: ['csv', 'spreadsheet', 'table', 'dataset', 'export', 'rows', 'columns', 'sheet', 'list'],
  },
  {
    id: 'browser-bookmarks-and-web-research',
    label: 'Browser bookmarks and web research',
    keywords: ['bookmark', 'bookmarks', 'favorite', 'favorites', 'favourite', 'browser', 'history', 'url', 'webloc', 'web research', 'reading list', 'chrome', 'safari', 'firefox', 'edge'],
  },
  {
    id: 'source-documents',
    label: 'Source documents',
    keywords: [],
  },
];

const LIFE_DOMAIN_KEYWORDS = [
  { id: 'street-voices', label: 'Street Voices', keywords: ['street voices', 'streetvoices', 'nanobot', 'librechat'] },
  { id: 'case-management', label: 'Case Management', keywords: ['case', 'client', 'intake', 'referral', 'consent', 'appointment', 'case management'] },
  { id: 'partners', label: 'Partners', keywords: ['partner', 'partners', 'stakeholder', 'coalition', 'organization', 'organisation', 'vendor'] },
  { id: 'services', label: 'Services', keywords: ['service', 'directory', 'resource', 'findhelp', '211', 'shelter', 'clinic', 'housing help'] },
  { id: 'projects', label: 'Projects', keywords: ['project', 'proposal', 'grant', 'agreement', 'roadmap', 'strategy', 'systems innovation', 'innovation'] },
  { id: 'creative', label: 'Creative', keywords: ['creative', 'media', 'podcast', 'photo', 'video', 'gallery', 'portfolio', 'recording'] },
  { id: 'research', label: 'Research', keywords: ['research', 'paper', 'study', 'article', 'wiki', 'notes', 'analysis'] },
  { id: 'admin', label: 'Admin', keywords: ['invoice', 'receipt', 'tax', 'insurance', 'lease', 'passport', 'license', 'licence', 'bank'] },
  { id: 'personal', label: 'Personal', keywords: ['personal', 'family', 'home', 'health', 'journal'] },
];

const DEVELOPMENT_SOURCE_PATH_PARTS = new Set([
  'api',
  'app',
  'client',
  'components',
  'docs',
  'lib',
  'librechat',
  'list_monk',
  'list-monk',
  'listmonk',
  'mautic',
  'modules',
  'moodle',
  'moodle_lms',
  'moodle-lms',
  'nano-claw',
  'nano_claw',
  'nanobot',
  'nanoclaw',
  'node_modules',
  'packages',
  'plugins',
  'src',
  'vendor',
]);

const DEVELOPMENT_SOURCE_FILENAMES = new Set([
  'apple-container-networking.md',
  'changelog.md',
  'debug_checklist.md',
  'license.md',
  'package-lock.json',
  'package.json',
  'readme.md',
  'tsconfig.json',
  'upgrading.md',
  'upgrade.txt',
]);

const sourceKindForFile = (extension = '', fileName = '') => {
  const lower = fileName.toLowerCase();
  if (['.csv', '.tsv', '.xlsx', '.xls', '.numbers'].includes(extension)) return 'table';
  if (['.jpg', '.jpeg', '.png', '.webp', '.heic', '.tif', '.tiff', '.bmp', '.avif'].includes(extension)) return 'image';
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio';
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (['.ppt', '.pptx', '.key'].includes(extension)) return 'presentation';
  if (['.eml', '.mbox'].includes(extension)) return 'email';
  if (extension === '.ics') return 'calendar';
  if (extension === '.vcf') return 'contact';
  if (TRANSCRIPT_EXTENSIONS.has(extension)) return 'transcript';
  if (['.url', '.webloc'].includes(extension) || (['.html', '.htm', '.json'].includes(extension) && /bookmark|favorite|history|reading list/i.test(lower))) {
    return 'bookmark';
  }
  if (['.pdf', '.doc', '.docx', '.odt', '.pages'].includes(extension)) return 'document';
  if (['.md', '.markdown', '.txt', '.rtf'].includes(extension) || lower.includes('note')) return 'note';
  return 'source';
};

const normalizedFilePathParts = (file = {}) =>
  [
    file.path,
    file.filename,
    file.originalname,
  ]
    .filter(Boolean)
    .join('/')
    .toLowerCase()
    .split(/[\\/]+/)
    .filter(Boolean);

const isDevelopmentSourceFile = (file = {}) => {
  const parts = normalizedFilePathParts(file);
  const fileName = String(file.originalname || file.filename || '').toLowerCase();
  const hasKnownWorkspace = parts.some((part) => DEVELOPMENT_SOURCE_PATH_PARTS.has(part));
  const isProjectPath = parts.includes('projects') || parts.includes('node_modules') || parts.includes('vendor');
  const isProjectDocumentation = DEVELOPMENT_SOURCE_FILENAMES.has(fileName);
  const isMarkdownInKnownWorkspace = hasKnownWorkspace && ['.md', '.markdown', '.txt', '.json', '.yml', '.yaml'].includes(path.extname(fileName));

  return (
    (isProjectPath && hasKnownWorkspace) ||
    (hasKnownWorkspace && isProjectDocumentation) ||
    isMarkdownInKnownWorkspace
  );
};

const lifeDomainForSource = ({ sourceText = '', selectedLane, extension = '', context = {} }) => {
  if (context.sourceScope === 'current-record') return { id: 'case-management', label: 'Case Management' };
  if (selectedLane?.id === 'browser-bookmarks-and-web-research') return { id: 'research', label: 'Research' };
  if (selectedLane?.id === 'media-and-creative-assets') return { id: 'creative', label: 'Creative' };
  const matched = LIFE_DOMAIN_KEYWORDS.find((domain) => domain.keywords.some((keyword) => sourceText.includes(keyword)));
  if (matched) return { id: matched.id, label: matched.label };
  if (selectedLane?.id === 'personal-admin-and-identity') return { id: 'admin', label: 'Admin' };
  if (selectedLane?.id === 'partner-and-organization-lists') return { id: 'partners', label: 'Partners' };
  if (selectedLane?.id === 'case-management-material') return { id: 'case-management', label: 'Case Management' };
  if (selectedLane?.id === 'projects-and-strategy') return { id: 'projects', label: 'Projects' };
  if (['.eml', '.mbox', '.ics', '.vcf'].includes(extension)) return { id: 'personal', label: 'Personal' };
  if (['.url', '.webloc'].includes(extension)) return { id: 'research', label: 'Research' };
  return { id: 'unknown', label: 'Unknown' };
};

const normalizeWhitespace = (value = '') => value.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').trim();

const slugifyArchiveId = (value = 'source') =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'source';

const splitEmbeddingReviewChunks = (text = '') => {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).filter(Boolean);
  const chunks = [];
  let current = '';

  const pushCurrent = () => {
    const chunk = normalizeWhitespace(current);
    if (chunk) chunks.push(chunk);
    current = '';
  };

  paragraphs.forEach((paragraph) => {
    if ((current ? `${current}\n\n${paragraph}` : paragraph).length <= EMBEDDING_REVIEW_CHUNK_CHARS) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      return;
    }

    pushCurrent();

    if (paragraph.length <= EMBEDDING_REVIEW_CHUNK_CHARS) {
      current = paragraph;
      return;
    }

    paragraph.split(/(?<=[.!?])\s+/).filter(Boolean).forEach((sentence) => {
      if ((current ? `${current} ${sentence}` : sentence).length <= EMBEDDING_REVIEW_CHUNK_CHARS) {
        current = current ? `${current} ${sentence}` : sentence;
      } else {
        pushCurrent();
        current = sentence.slice(0, EMBEDDING_REVIEW_CHUNK_CHARS);
      }
    });
  });

  pushCurrent();
  return chunks.slice(0, EMBEDDING_REVIEW_CHUNK_LIMIT);
};

const buildEmbeddingReviewPlan = ({ fileId, extraction, archive, vectorIndex, context }) => {
  const chunks = splitEmbeddingReviewChunks(extraction.text || extraction.textPreview || '');
  const hasMoreChunks = vectorIndex.chunkCount > chunks.length;
  const now = new Date().toISOString();
  const privacyLevel = context.privacyLevel || 'case-team';
  const redactionMode = context.redactionMode || 'standard';
  const reviewReason =
    archive.lifeDomainId === 'unknown'
      ? 'Unknown-domain sources must be reviewed before embedding.'
      : privacyLevel === 'public'
        ? 'Review the chunk list before public-safe vector indexing.'
        : 'Private, personal, or case-team material requires human approval before embedding.';

  return {
    status: chunks.length ? 'awaiting-review' : 'metadata-only',
    writeMode: 'dry-run',
    writeEnabled: false,
    provider: vectorIndex.provider,
    targetClass: process.env.CASE_MANAGEMENT_WEAVIATE_CLASS || 'CaseWikiSourceChunk',
    embeddingModel: vectorIndex.embeddingModel,
    privacyLevel,
    redactionMode,
    reviewRequired: true,
    reviewedAt: '',
    reviewedBy: '',
    chunkCount: chunks.length,
    estimatedTotalChunks: vectorIndex.chunkCount,
    truncatedForReview: hasMoreChunks,
    approvedCount: 0,
    rejectedCount: 0,
    pendingCount: chunks.length,
    note: chunks.length
      ? `Prepared ${chunks.length}${hasMoreChunks ? ` of about ${vectorIndex.chunkCount}` : ''} chunk${chunks.length === 1 ? '' : 's'} for ${vectorIndex.provider} review. No embeddings are written until chunks are approved.`
      : 'No readable text chunks are ready for embedding review yet; parser or OCR work is needed first.',
    reviewReason,
    chunks: chunks.map((chunk, index) => ({
      id: `embedding:${fileId}:${index + 1}`,
      ordinal: index + 1,
      status: 'pending-review',
      embeddingAction: 'pending-review',
      privacyLevel,
      redactionMode,
      lifeDomain: archive.lifeDomain || 'Unknown',
      lifeDomainId: archive.lifeDomainId || 'unknown',
      sourceKind: archive.sourceKind || 'source',
      charCount: chunk.length,
      tokenEstimate: Math.max(1, Math.ceil(chunk.length / 4)),
      textPreview: chunk.slice(0, EMBEDDING_REVIEW_CHUNK_PREVIEW_CHARS),
      reviewNote: reviewReason,
      createdAt: now,
    })),
  };
};

const titleFromFileName = (fileName = 'Source document') => {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  const words = withoutExtension
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!words) return 'Source document';
  return words
    .split(' ')
    .map((word) => (word.length <= 3 && word === word.toUpperCase() ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`))
    .join(' ');
};

const normalizeWikiIngestContext = (context = {}) => {
  const privacyLevel = PRIVACY_LEVELS.has(context.privacyLevel) ? context.privacyLevel : 'case-team';
  const redactionMode = REDACTION_MODES.has(context.redactionMode) ? context.redactionMode : 'standard';
  return {
    ...context,
    privacyLevel,
    redactionMode,
    retentionPolicy: typeof context.retentionPolicy === 'string' && context.retentionPolicy ? context.retentionPolicy : 'keep-source',
    sourceScope: SOURCE_SCOPES.has(context.sourceScope) ? context.sourceScope : 'standalone',
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

const pageNumberFromRenderedPdfImage = (fileName = '') => Number(fileName.match(/-(\d+)\.png$/i)?.[1] || 0);

const extractPdfOcrText = async (file) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'case-wiki-pdf-ocr-'));
  try {
    const prefix = path.join(tempDir, 'page');
    const rendered = await runExtractor(pdfRenderCommand(), [
      '-f',
      '1',
      '-l',
      String(PDF_OCR_PAGE_LIMIT),
      '-png',
      '-r',
      '180',
      file.path,
      prefix,
    ]);
    if (!rendered.ok) {
      return { ok: false, error: `PDF page renderer unavailable (${rendered.error})` };
    }

    const renderedFiles = (await fs.readdir(tempDir))
      .filter((fileName) => /^page-\d+\.png$/i.test(fileName))
      .sort((left, right) => pageNumberFromRenderedPdfImage(left) - pageNumberFromRenderedPdfImage(right));

    if (!renderedFiles.length) {
      return { ok: false, error: 'PDF page renderer produced no OCR images' };
    }

    const chunks = [];
    const warnings = [];
    for (const renderedFile of renderedFiles.slice(0, PDF_OCR_PAGE_LIMIT)) {
      const pagePath = path.join(tempDir, renderedFile);
      const pageNumber = pageNumberFromRenderedPdfImage(renderedFile) || chunks.length + 1;
      const ocr = await runExtractor(ocrCommand(), [pagePath, 'stdout', '-l', 'eng', '--psm', '6']);
      if (ocr.ok) {
        const pageText = normalizeWhitespace(ocr.stdout);
        if (pageText) chunks.push(`Page ${pageNumber}: ${pageText}`);
      } else {
        warnings.push(ocr.error);
      }
    }

    const text = normalizeWhitespace(chunks.join('\n\n')).slice(0, MAX_TEXT_CHARS);
    if (!text) {
      return {
        ok: false,
        error: warnings.length ? `OCR parser failed (${warnings[0]})` : 'OCR found no readable text in rendered PDF pages',
      };
    }

    return {
      ok: true,
      text,
      pageCount: renderedFiles.length,
      warning:
        text.length >= MAX_TEXT_CHARS
          ? 'PDF OCR text was truncated for the first wiki pass.'
          : `Used OCR fallback on the first ${Math.min(renderedFiles.length, PDF_OCR_PAGE_LIMIT)} PDF page${renderedFiles.length === 1 ? '' : 's'}.`,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
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

const decodeHtmlEntities = (value = '') =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)));

const stripHtml = (value = '') =>
  normalizeWhitespace(
    decodeHtmlEntities(
      value
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<\/(?:p|div|br|li|tr|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, ' '),
    ),
  );

const parseHtmlAttributes = (value = '') => {
  const attrs = {};
  value.replace(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g, (_match, key, doubleQuoted, singleQuoted, bare) => {
    attrs[key.toLowerCase()] = decodeHtmlEntities(doubleQuoted || singleQuoted || bare || '').trim();
    return _match;
  });
  return attrs;
};

const parseBookmarkHtmlPreview = (rawText = '') => {
  if (!/<a\b[^>]*href=/i.test(rawText)) return null;
  const chunks = rawText.replace(/<DT>/gi, '\n<DT>').split(/\r?\n/);
  let currentFolder = '';
  const folders = new Set();
  const links = [];

  chunks.forEach((chunk) => {
    const folderMatch = chunk.match(/<H3\b([^>]*)>([\s\S]*?)<\/H3>/i);
    if (folderMatch) {
      currentFolder = stripHtml(folderMatch[2]);
      if (currentFolder) folders.add(currentFolder);
    }

    const linkMatch = chunk.match(/<A\b([^>]*)>([\s\S]*?)<\/A>/i);
    if (!linkMatch) return;
    const attrs = parseHtmlAttributes(linkMatch[1]);
    const url = attrs.href || '';
    if (!url) return;
    links.push({
      title: stripHtml(linkMatch[2]) || url,
      url,
      folder: currentFolder,
      added: attrs.add_date || attrs.last_visit || attrs.last_modified || '',
    });
  });

  if (!links.length) return null;
  const linkLines = links.slice(0, 60).map((link, index) =>
    [
      `Link ${index + 1}: ${link.title}`,
      `URL: ${link.url}`,
      link.folder ? `Folder: ${link.folder}` : '',
      link.added ? `Timestamp: ${link.added}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  );

  return {
    itemCount: links.length,
    sourceKind: 'bookmark',
    method: 'browser bookmark html parser',
    text: [
      `Browser bookmark export with ${links.length} saved link${links.length === 1 ? '' : 's'}.`,
      folders.size ? `Folders seen: ${Array.from(folders).slice(0, 24).join(', ')}.` : '',
      ...linkLines,
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
};

const decodeQuotedPrintable = (value = '') =>
  value
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_match, hex) => String.fromCharCode(parseInt(hex, 16)));

const decodeHeaderValue = (value = '') =>
  value.replace(/=\?([^?]+)\?([bq])\?([^?]+)\?=/gi, (_match, _charset, encoding, encoded) => {
    try {
      if (encoding.toLowerCase() === 'b') return Buffer.from(encoded, 'base64').toString('utf8');
      return decodeQuotedPrintable(encoded.replace(/_/g, ' '));
    } catch (_error) {
      return encoded;
    }
  });

const unfoldStructuredText = (value = '') => value.replace(/\r?\n[ \t]+/g, ' ');

const parseHeaderBlock = (value = '') => {
  const headers = {};
  unfoldStructuredText(value)
    .split(/\r?\n/)
    .forEach((line) => {
      const separator = line.indexOf(':');
      if (separator <= 0) return;
      const key = line.slice(0, separator).trim().toLowerCase();
      const headerValue = decodeHeaderValue(line.slice(separator + 1).trim());
      if (!headers[key]) headers[key] = [];
      headers[key].push(headerValue);
    });
  return headers;
};

const firstHeader = (headers, key) => (headers[key]?.[0] || '').trim();

const parseEmailPreview = (rawText = '') => {
  const normalized = rawText.replace(/\r\n/g, '\n');
  const splitIndex = normalized.search(/\n\s*\n/);
  const headerBlock = splitIndex >= 0 ? normalized.slice(0, splitIndex) : '';
  const body = splitIndex >= 0 ? normalized.slice(splitIndex).trim() : normalized;
  const headers = parseHeaderBlock(headerBlock);
  const contentType = firstHeader(headers, 'content-type').toLowerCase();
  const transferEncoding = firstHeader(headers, 'content-transfer-encoding').toLowerCase();
  let bodyText = transferEncoding.includes('quoted-printable') ? decodeQuotedPrintable(body) : body;
  if (contentType.includes('text/html') || /<html|<body|<p[>\s]/i.test(bodyText)) {
    bodyText = stripHtml(bodyText);
  } else {
    bodyText = normalizeWhitespace(bodyText);
  }

  const fields = [
    ['Subject', firstHeader(headers, 'subject')],
    ['From', firstHeader(headers, 'from')],
    ['To', firstHeader(headers, 'to')],
    ['Cc', firstHeader(headers, 'cc')],
    ['Date', firstHeader(headers, 'date')],
  ].filter(([, value]) => value);

  const text = [
    'Email source',
    ...fields.map(([label, value]) => `${label}: ${value}`),
    bodyText ? `Body:\n${bodyText}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return text ? { text, itemCount: 1 } : null;
};

const parseMboxPreview = (rawText = '') => {
  const normalized = rawText.replace(/\r\n/g, '\n');
  const parts = normalized
    .split(/\n(?=From [^\n]+\n)/g)
    .map((part) => part.replace(/^From [^\n]+\n/, '').trim())
    .filter(Boolean);
  const messages = parts.length ? parts : [normalized.trim()].filter(Boolean);

  const messageLines = messages.slice(0, 12).map((message, index) => {
    const parsed = parseEmailPreview(message);
    const splitIndex = message.search(/\n\s*\n/);
    const headers = parseHeaderBlock(splitIndex >= 0 ? message.slice(0, splitIndex) : '');
    const subject = firstHeader(headers, 'subject') || 'Untitled email';
    const fields = [
      `Message ${index + 1}: ${subject}`,
      firstHeader(headers, 'from') ? `From: ${firstHeader(headers, 'from')}` : '',
      firstHeader(headers, 'to') ? `To: ${firstHeader(headers, 'to')}` : '',
      firstHeader(headers, 'date') ? `Date: ${firstHeader(headers, 'date')}` : '',
    ].filter(Boolean);
    const bodyPreview = parsed?.text
      ?.replace(/^Email source\s*/i, '')
      .replace(/^Subject:[\s\S]*?\n\nBody:\s*/i, '')
      .slice(0, 900);
    return [...fields, bodyPreview ? `Preview:\n${bodyPreview}` : 'Preview: No readable body text found.'].join('\n');
  });

  if (!messageLines.length) return null;
  return {
    itemCount: messages.length,
    text: [
      `MBOX email archive with ${messages.length} message${messages.length === 1 ? '' : 's'}.`,
      ...messageLines,
    ].join('\n\n'),
  };
};

const collectBookmarkJsonItems = (value, trail = [], items = [], depth = 0) => {
  if (depth > 8 || items.length >= 500 || value === null || value === undefined) return items;
  if (Array.isArray(value)) {
    value.forEach((item) => collectBookmarkJsonItems(item, trail, items, depth + 1));
    return items;
  }
  if (typeof value !== 'object') return items;

  const title = String(value.title || value.name || value.label || '').trim();
  const url = String(value.url || value.href || value.uri || '').trim();
  if (url && /^(https?:|file:|ftp:|mailto:)/i.test(url)) {
    items.push({
      title: title || url,
      url,
      folder: trail.filter(Boolean).join(' / '),
      added: value.date_added || value.addDate || value.addedAt || value.last_visited || value.lastVisitTime || '',
    });
  }

  const childTrail = title && !url ? [...trail, title] : trail;
  ['children', 'bookmarks', 'items'].forEach((key) => {
    if (value[key]) collectBookmarkJsonItems(value[key], childTrail, items, depth + 1);
  });
  ['roots', 'bookmark_bar', 'other', 'synced', 'mobile', 'readingList'].forEach((key) => {
    if (value[key]) collectBookmarkJsonItems(value[key], [...trail, key], items, depth + 1);
  });

  if (!items.length || depth < 2) {
    Object.entries(value).forEach(([key, child]) => {
      if (['children', 'bookmarks', 'items', 'roots', 'bookmark_bar', 'other', 'synced', 'mobile', 'readingList'].includes(key)) return;
      if (child && typeof child === 'object') collectBookmarkJsonItems(child, trail, items, depth + 1);
    });
  }
  return items;
};

const parseBrowserJsonPreview = (rawText = '') => {
  try {
    const parsed = JSON.parse(rawText);
    const links = collectBookmarkJsonItems(parsed);
    if (!links.length) return null;
    const linkLines = links.slice(0, 80).map((link, index) =>
      [
        `Link ${index + 1}: ${link.title}`,
        `URL: ${link.url}`,
        link.folder ? `Folder: ${link.folder}` : '',
        link.added ? `Timestamp: ${link.added}` : '',
      ]
      .filter(Boolean)
      .join('\n'),
    );
    return {
      itemCount: links.length,
      sourceKind: 'bookmark',
      method: 'browser bookmark json parser',
      text: [`Browser bookmark JSON with ${links.length} saved link${links.length === 1 ? '' : 's'}.`, ...linkLines].join('\n\n'),
    };
  } catch (_error) {
    return null;
  }
};

const parseIcsDate = (value = '') => {
  const compact = value.split(':').pop() || value;
  const match = compact.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);
  if (!match) return compact;
  const [, year, month, day, hour, minute] = match;
  return hour ? `${year}-${month}-${day} ${hour}:${minute}` : `${year}-${month}-${day}`;
};

const parseIcsPreview = (rawText = '') => {
  const lines = unfoldStructuredText(rawText).split(/\r?\n/);
  const events = [];
  let current = null;
  lines.forEach((line) => {
    if (line.trim() === 'BEGIN:VEVENT') {
      current = {};
      return;
    }
    if (line.trim() === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
      return;
    }
    if (!current) return;
    const separator = line.indexOf(':');
    if (separator <= 0) return;
    const key = line.slice(0, separator).split(';')[0].toUpperCase();
    const value = decodeQuotedPrintable(line.slice(separator + 1).replace(/\\n/g, '\n')).trim();
    if (!current[key]) current[key] = [];
    current[key].push(value);
  });

  if (!events.length) return null;
  const eventLines = events.slice(0, 12).map((event, index) => {
    const details = [
      `Event ${index + 1}: ${event.SUMMARY?.[0] || 'Untitled event'}`,
      event.DTSTART?.[0] ? `Starts: ${parseIcsDate(event.DTSTART[0])}` : '',
      event.DTEND?.[0] ? `Ends: ${parseIcsDate(event.DTEND[0])}` : '',
      event.LOCATION?.[0] ? `Location: ${event.LOCATION[0]}` : '',
      event.ORGANIZER?.[0] ? `Organizer: ${event.ORGANIZER[0]}` : '',
      event.DESCRIPTION?.[0] ? `Description: ${event.DESCRIPTION[0]}` : '',
    ].filter(Boolean);
    return details.join('\n');
  });

  return {
    itemCount: events.length,
    text: [`Calendar source with ${events.length} event${events.length === 1 ? '' : 's'}.`, ...eventLines].join('\n\n'),
  };
};

const parseVcfPreview = (rawText = '') => {
  const lines = unfoldStructuredText(rawText).split(/\r?\n/);
  const cards = [];
  let current = null;
  lines.forEach((line) => {
    if (line.trim() === 'BEGIN:VCARD') {
      current = {};
      return;
    }
    if (line.trim() === 'END:VCARD') {
      if (current) cards.push(current);
      current = null;
      return;
    }
    if (!current) return;
    const separator = line.indexOf(':');
    if (separator <= 0) return;
    const key = line.slice(0, separator).split(';')[0].toUpperCase();
    const value = decodeQuotedPrintable(line.slice(separator + 1).replace(/\\n/g, '\n')).trim();
    if (!current[key]) current[key] = [];
    current[key].push(value);
  });

  if (!cards.length) return null;
  const cardLines = cards.slice(0, 20).map((card, index) => {
    const details = [
      `Contact ${index + 1}: ${card.FN?.[0] || card.N?.[0] || 'Unnamed contact'}`,
      card.ORG?.[0] ? `Organization: ${card.ORG[0]}` : '',
      card.TITLE?.[0] ? `Title: ${card.TITLE[0]}` : '',
      card.EMAIL?.length ? `Email: ${card.EMAIL.join(', ')}` : '',
      card.TEL?.length ? `Phone: ${card.TEL.join(', ')}` : '',
      card.ADR?.[0] ? `Address: ${card.ADR[0].replace(/;/g, ', ')}` : '',
      card.NOTE?.[0] ? `Note: ${card.NOTE[0]}` : '',
    ].filter(Boolean);
    return details.join('\n');
  });

  return {
    itemCount: cards.length,
    text: [`Contact source with ${cards.length} card${cards.length === 1 ? '' : 's'}.`, ...cardLines].join('\n\n'),
  };
};

const summarizeJsonValue = (value, label = 'root', depth = 0) => {
  if (depth > 3) return [];
  if (Array.isArray(value)) {
    const lines = [`${label}: array with ${value.length} item${value.length === 1 ? '' : 's'}`];
    value.slice(0, 5).forEach((item, index) => {
      lines.push(...summarizeJsonValue(item, `${label}[${index}]`, depth + 1));
    });
    return lines;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    const lines = [`${label}: object with keys ${keys.slice(0, 18).join(', ')}${keys.length > 18 ? ', ...' : ''}`];
    keys.slice(0, 10).forEach((key) => {
      const child = value[key];
      if (child && typeof child === 'object') {
        lines.push(...summarizeJsonValue(child, `${label}.${key}`, depth + 1));
      } else if (child !== undefined && child !== null && String(child).trim()) {
        lines.push(`${label}.${key}: ${String(child).slice(0, 220)}`);
      }
    });
    return lines;
  }
  return value === undefined || value === null ? [] : [`${label}: ${String(value).slice(0, 220)}`];
};

const parseJsonPreview = (rawText = '') => {
  const bookmarks = parseBrowserJsonPreview(rawText);
  if (bookmarks) return bookmarks;
  try {
    const parsed = JSON.parse(rawText);
    const lines = summarizeJsonValue(parsed, 'JSON');
    const rootType = Array.isArray(parsed) ? 'array' : parsed && typeof parsed === 'object' ? 'object' : typeof parsed;
    return {
      itemCount: Array.isArray(parsed) ? parsed.length : parsed && typeof parsed === 'object' ? Object.keys(parsed).length : 1,
      text: [`JSON source parsed as ${rootType}.`, ...lines].join('\n').slice(0, MAX_TEXT_CHARS),
    };
  } catch (_error) {
    return null;
  }
};

const parseUrlShortcutPreview = (rawText = '') => {
  const lines = rawText.split(/\r?\n/);
  const url = lines.find((line) => /^URL=/i.test(line))?.replace(/^URL=/i, '').trim();
  if (!url) return null;
  const title = lines.find((line) => /^Name=/i.test(line))?.replace(/^Name=/i, '').trim();
  return {
    itemCount: 1,
    sourceKind: 'bookmark',
    method: 'internet shortcut parser',
    text: ['Internet shortcut source', title ? `Title: ${title}` : '', `URL: ${url}`].filter(Boolean).join('\n\n'),
  };
};

const parseWeblocPreview = (rawText = '') => {
  const url =
    rawText.match(/<key>URL<\/key>\s*<string>([^<]+)<\/string>/i)?.[1] ||
    rawText.match(/\bhttps?:\/\/[^\s<"]+/i)?.[0] ||
    '';
  if (!url) return null;
  const title = rawText.match(/<key>Name<\/key>\s*<string>([^<]+)<\/string>/i)?.[1] || '';
  return {
    itemCount: 1,
    sourceKind: 'bookmark',
    method: 'macOS webloc parser',
    text: ['macOS web location source', title ? `Title: ${decodeHtmlEntities(title)}` : '', `URL: ${decodeHtmlEntities(url)}`]
      .filter(Boolean)
      .join('\n\n'),
  };
};

const parseTranscriptPreview = (rawText = '') => {
  const normalized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/^\uFEFF/, '')
    .replace(/^WEBVTT[^\n]*\n+/i, '')
    .trim();
  if (!normalized) return null;

  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const segments = [];
  blocks.forEach((block) => {
    const lines = block
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const timeIndex = lines.findIndex((line) => line.includes('-->'));
    if (timeIndex < 0) return;
    const timing = lines[timeIndex].replace(/\s+/g, ' ');
    const text = normalizeWhitespace(lines.slice(timeIndex + 1).join(' '));
    if (text) segments.push({ timing, text });
  });

  const plainLines = normalized
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\d+$/.test(line) && !line.includes('-->') && !/^NOTE\b/i.test(line));
  const text = segments.length
    ? [
        `Transcript source with ${segments.length} timed segment${segments.length === 1 ? '' : 's'}.`,
        ...segments.slice(0, 80).map((segment, index) => `Segment ${index + 1} (${segment.timing}): ${segment.text}`),
      ].join('\n\n')
    : ['Transcript source with untimed text.', plainLines.slice(0, 120).join('\n')].join('\n\n');

  return {
    itemCount: segments.length || plainLines.length,
    sourceKind: 'transcript',
    method: 'subtitle transcript parser',
    text,
  };
};

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

const semanticIndexPlan = (extraction) => {
  const provider = CASE_WIKI_VECTOR_PROVIDER;
  const writeEnabled = process.env.CASE_MANAGEMENT_VECTOR_WRITE_ENABLED === 'true';
  return {
    provider,
    status: writeEnabled && extraction.status === 'ready' ? 'queued' : 'planned',
    chunkCount: extraction.text ? Math.max(1, Math.ceil(extraction.text.length / 1800)) : 0,
    embeddingModel: process.env.EMBEDDINGS_MODEL || 'configured embeddings model',
    note: writeEnabled
      ? `Ready to send source chunks to ${provider}.`
      : `Semantic/vector write is planned for ${provider}; Neo4j graph write remains the source-of-truth relationship layer.`,
  };
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
  const extracted = await runExtractor(pdfTextCommand(), [file.path, '-']);
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

  const ocr = await extractPdfOcrText(file);
  if (ocr.ok) {
    return {
      method: 'pdf OCR (pdftoppm + tesseract)',
      status: 'ready',
      text: ocr.text,
      warning: ocr.warning,
    };
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
      ? `No embedded PDF text was found. ${ocr.error || 'OCR did not produce text for scanned pages.'}`
      : `PDF parser unavailable (${extracted.error}). ${ocr.error || 'Install pdftotext and OCR tooling for full PDF extraction.'}`,
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
    const extracted = await runExtractor(unzipCommand(), ['-p', file.path, entry]);
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

const appleIWorkLabel = (extension = '') => {
  if (extension === '.pages') return 'Apple Pages document';
  if (extension === '.numbers') return 'Apple Numbers spreadsheet';
  if (extension === '.key') return 'Apple Keynote presentation';
  return 'Apple iWork source';
};

const extractAppleIWorkText = async (file, extension) => {
  const list = await runExtractor(unzipCommand(), ['-Z1', file.path]);
  const entries = list.ok
    ? list.stdout
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

  if (!entries.length) {
    return {
      method: `${extension} metadata`,
      status: 'metadata-only',
      text: '',
      warning: list.ok
        ? 'Apple iWork package parser found no readable package entries.'
        : `Apple iWork package parser unavailable (${list.error}).`,
    };
  }

  const metadataCandidates = [
    'Metadata/Properties.plist',
    'Metadata/DocumentIdentifier',
    'Metadata/BuildVersionHistory.plist',
  ];
  const metadataChunks = [];
  for (const entry of metadataCandidates) {
    if (!entries.includes(entry)) continue;
    const extracted = await runExtractor(unzipCommand(), ['-p', file.path, entry]);
    if (extracted.ok && extracted.stdout) {
      metadataChunks.push(`${entry}:\n${xmlToText(extracted.stdout) || normalizeWhitespace(extracted.stdout)}`);
    }
  }

  const interestingEntries = entries.filter(
    (entry) =>
      entry.startsWith('Metadata/') ||
      entry.startsWith('Index/') ||
      entry.startsWith('QuickLook/') ||
      /\.(iwa|plist|xml|json|txt|pdf|jpg|jpeg|png)$/i.test(entry),
  );

  const text = [
    `Apple iWork source: ${appleIWorkLabel(extension)}.`,
    `Package entries: ${entries.length}.`,
    interestingEntries.length
      ? `Notable package entries:\n${interestingEntries.slice(0, 80).map((entry) => `- ${entry}`).join('\n')}`
      : '',
    metadataChunks.length ? `Metadata entries:\n${metadataChunks.join('\n\n')}` : '',
    'Parser note: this first pass preserves the package manifest and metadata as a reviewable wiki source. Full Apple iWork body extraction will require a deeper iWork parser or export pass.',
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, MAX_TEXT_CHARS);

  return {
    method: 'apple iwork package parser',
    status: text ? 'ready' : 'metadata-only',
    text,
    warning: 'Apple iWork body text is not fully extracted yet; review the package metadata before embedding.',
  };
};

const extractImageText = async (file, extension) => {
  const extracted = await runExtractor(ocrCommand(), [file.path, 'stdout']);
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

const extractMediaMetadataText = (file, extension) => {
  const mediaKind = AUDIO_EXTENSIONS.has(extension) ? 'audio' : 'video';
  const text = [
    `${mediaKind === 'audio' ? 'Audio recording' : 'Video recording'} source staged for Case Wiki review.`,
    `File name: ${file.originalname || file.filename || 'media source'}.`,
    `MIME type: ${file.mimetype || 'unknown'}.`,
    `Size: ${file.size || 0} bytes.`,
    'Transcript status: no transcript has been extracted yet.',
    'Next review step: attach an existing transcript/caption file, run a transcription job, or keep this media source as metadata-only.',
  ].join('\n');

  return {
    method: `${mediaKind} media metadata`,
    status: 'metadata-only',
    text,
    warning: 'Media file was staged from metadata only. A transcript is needed before semantic embedding is useful.',
    tableSummary: {
      parser: `${mediaKind} media metadata`,
      itemCount: 1,
      sourceKind: mediaKind,
      transcriptStatus: 'missing',
    },
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
  } else if (APPLE_IWORK_EXTENSIONS.has(extension)) {
    extraction = await extractAppleIWorkText(file, extension);
  } else if (OCR_EXTENSIONS.has(extension)) {
    extraction = await extractImageText(file, extension);
  } else if (AUDIO_EXTENSIONS.has(extension) || VIDEO_EXTENSIONS.has(extension)) {
    extraction = extractMediaMetadataText(file, extension);
    tableSummary = extraction.tableSummary;
  } else if (!isTextLikeFile(file)) {
    extraction = {
      ...baseExtraction,
      method: `${extension || file.mimetype || 'binary'} metadata`,
    };
  } else {
    const buffer = await fs.readFile(file.path);
    const rawText = buffer.toString('utf8');
    let text = normalizeWhitespace(rawText).slice(0, MAX_TEXT_CHARS);
    if (extension === '.rtf') {
      text = stripRtf(text).slice(0, MAX_TEXT_CHARS);
    }
    if (extension === '.html' || extension === '.htm') {
      text = stripHtml(rawText).slice(0, MAX_TEXT_CHARS);
    }
    if (extension === '.csv') {
      tableSummary = parseCsvPreview(text);
      if (tableSummary) {
        text = `${tableSummary.tableText}\n\n${text}`.slice(0, MAX_TEXT_CHARS);
      }
    }
    const structuredParsers = {
      '.eml': { method: 'email message parser', parse: parseEmailPreview },
      '.mbox': { method: 'mbox email archive parser', parse: parseMboxPreview },
      '.html': { method: 'html text parser', parse: parseBookmarkHtmlPreview },
      '.htm': { method: 'html text parser', parse: parseBookmarkHtmlPreview },
      '.ics': { method: 'calendar event parser', parse: parseIcsPreview },
      '.srt': { method: 'subtitle transcript parser', parse: parseTranscriptPreview },
      '.url': { method: 'internet shortcut parser', parse: parseUrlShortcutPreview },
      '.vcf': { method: 'contact card parser', parse: parseVcfPreview },
      '.vtt': { method: 'subtitle transcript parser', parse: parseTranscriptPreview },
      '.webloc': { method: 'macOS webloc parser', parse: parseWeblocPreview },
      '.json': { method: 'json structure parser', parse: parseJsonPreview },
    };
    const structuredParser = structuredParsers[extension];
    if (structuredParser) {
      const structured = structuredParser.parse(rawText);
      if (structured?.text) {
        const parser = structured.method || structuredParser.method;
        text = structured.text.slice(0, MAX_TEXT_CHARS);
        tableSummary = {
          parser,
          itemCount: structured.itemCount || 0,
          sourceKind: structured.sourceKind || undefined,
        };
      }
    }
    extraction = {
      method: structuredParser && tableSummary?.parser
        ? tableSummary.parser
        : extension === '.csv'
          ? 'csv text table parser'
          : extension === '.html' || extension === '.htm'
            ? 'html text parser'
            : 'utf8 text',
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

const keywordInText = (sourceText = '', keyword = '') => {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(sourceText);
};

const classifyArchiveSource = ({ file, extraction, entities, context }) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (isDevelopmentSourceFile(file)) {
    const sourceKind = extraction.tableSummary?.sourceKind || sourceKindForFile(extension, file.originalname);
    const suggestedWikiTitle = titleFromFileName(file.originalname);
    const sourceScope = context.sourceScope || 'standalone';
    return {
      laneId: 'development-and-code-archives',
      lane: 'Development and code archives',
      lifeDomain: 'Development',
      lifeDomainId: 'development',
      sourceKind,
      suggestedWikiTitle,
      sourceNamespace: sourceScope === 'current-record' ? 'Case management record' : 'Whole-life source archive',
      reviewStatus: sourceScope === 'current-record' ? 'attached-to-current-record' : 'needs-human-review',
      attachmentRecommendation:
        sourceScope === 'current-record'
          ? 'Already attached to the selected case-management record.'
          : 'Keep standalone as development/source-code project material unless a person intentionally attaches it elsewhere.',
      confidence: 'medium',
      matchedKeywords: ['development'],
      suggestedCollections: ['Domain: Development', 'Development and code archives'],
      classificationReason:
        'Classified from a code workspace path or project documentation filename before topic keyword matching.',
    };
  }
  const sourceText = normalizeWhitespace(
    [
      file.originalname,
      extraction.textPreview,
      extraction.tableSummary?.headers?.join(' '),
      ...(entities || []),
    ]
      .filter(Boolean)
      .join('\n'),
  ).toLowerCase();
  const laneScores = ARCHIVE_LANES.map((lane) => ({
    ...lane,
    score: lane.keywords.reduce((score, keyword) => (keywordInText(sourceText, keyword) ? score + 1 : score), 0),
  }));

  if (['.csv', '.tsv', '.xlsx', '.xls', '.numbers'].includes(extension) || (extraction.tableSummary && !extraction.tableSummary.sourceKind)) {
    laneScores.find((lane) => lane.id === 'tables-and-datasets').score += 3;
  }
  if (
    ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.tif', '.tiff', '.bmp', '.avif'].includes(extension) ||
    AUDIO_EXTENSIONS.has(extension) ||
    VIDEO_EXTENSIONS.has(extension) ||
    TRANSCRIPT_EXTENSIONS.has(extension) ||
    ['audio', 'video', 'transcript'].includes(extraction.tableSummary?.sourceKind)
  ) {
    laneScores.find((lane) => lane.id === 'media-and-creative-assets').score += 5;
  }
  if (['.eml', '.mbox', '.ics', '.vcf'].includes(extension)) {
    laneScores.find((lane) => lane.id === 'calendar-email-and-correspondence').score += 3;
  }
  if (
    ['.url', '.webloc'].includes(extension) ||
    extraction.tableSummary?.sourceKind === 'bookmark' ||
    keywordInText(sourceText, 'bookmark') ||
    keywordInText(sourceText, 'browser') ||
    keywordInText(sourceText, 'reading list')
  ) {
    laneScores.find((lane) => lane.id === 'browser-bookmarks-and-web-research').score += 4;
  }
  if (keywordInText(sourceText, 'partner') && keywordInText(sourceText, 'list')) {
    laneScores.find((lane) => lane.id === 'partner-and-organization-lists').score += 6;
  }

  const bestLane =
    laneScores
      .filter((lane) => lane.id !== 'source-documents')
      .sort((left, right) => right.score - left.score)[0] || ARCHIVE_LANES[ARCHIVE_LANES.length - 1];
  const sourceDocumentsLane = ARCHIVE_LANES[ARCHIVE_LANES.length - 1];
  const selectedLane =
    extension === '.pages' && bestLane.score < 3
      ? sourceDocumentsLane
      : bestLane.score > 0
        ? bestLane
        : sourceDocumentsLane;
  const suggestedWikiTitle = titleFromFileName(file.originalname);
  const confidence = selectedLane.score >= 4 ? 'high' : selectedLane.score >= 2 ? 'medium' : 'low';
  const sourceScope = context.sourceScope || 'standalone';
  const reviewStatus = sourceScope === 'current-record' ? 'attached-to-current-record' : 'needs-human-review';
  const lifeDomain = lifeDomainForSource({ sourceText, selectedLane, extension, context });
  const sourceKind = extraction.tableSummary?.sourceKind || sourceKindForFile(extension, file.originalname);
  const attachmentRecommendation =
    sourceScope === 'current-record'
      ? 'Already attached to the selected case-management record.'
      : 'Keep standalone until a person reviews whether this source belongs to a client, case, service, or project page.';
  const matchedKeywords = selectedLane.keywords.filter((keyword) => keywordInText(sourceText, keyword)).slice(0, 5);

  return {
    laneId: selectedLane.id,
    lane: selectedLane.label,
    lifeDomain: lifeDomain.label,
    lifeDomainId: lifeDomain.id,
    sourceKind,
    suggestedWikiTitle,
    sourceNamespace: sourceScope === 'current-record' ? 'Case management record' : 'Whole-life source archive',
    reviewStatus,
    attachmentRecommendation,
    confidence,
    matchedKeywords,
    suggestedCollections: [
      `Domain: ${lifeDomain.label}`,
      selectedLane.label,
      ...(extraction.tableSummary && !extraction.tableSummary.sourceKind ? ['Tables and structured lists'] : []),
      ...(sourceKind === 'audio' ? ['Audio recordings', 'Needs transcript review'] : []),
      ...(sourceKind === 'video' ? ['Video recordings', 'Needs transcript review'] : []),
      ...(sourceKind === 'transcript' ? ['Transcripts and captions'] : []),
      ...(entities || []).slice(0, 4).map((entity) => `Topic: ${entity}`),
    ],
    classificationReason: matchedKeywords.length
      ? `Matched ${matchedKeywords.join(', ')} in the file name, extracted text, or detected entities.`
      : `Classified from file type ${extension || file.mimetype || 'unknown'} with no strong topic match yet.`,
  };
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

const buildGraph = ({ fileId, wikiPageId, file, extraction, context, entities, sha256, archive, vectorIndex }) => {
  const archiveLaneId = `archive-lane:${slugifyArchiveId(archive?.laneId || archive?.lane || 'source-documents')}`;
  const archiveTopicId = `archive-topic:${slugifyArchiveId(archive?.suggestedWikiTitle || file.originalname || fileId)}`;
  const lifeDomainId = `life-domain:${slugifyArchiveId(archive?.lifeDomainId || archive?.lifeDomain || 'unknown')}`;
  const archiveCollectionId = 'archive:whole-life-source-documents';
  const collectionIds = (archive?.suggestedCollections || [])
    .slice(0, 8)
    .map((collection) => ({
      id: `collection:${slugifyArchiveId(collection)}`,
      label: collection,
    }));
  const semanticIndexId = `semantic-index:${slugifyArchiveId(vectorIndex?.provider || 'weaviate')}`;
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
        sourceScope: context.sourceScope,
        lifeDomain: archive?.lifeDomain,
        lifeDomainId: archive?.lifeDomainId,
        sourceKind: archive?.sourceKind,
        archiveLane: archive?.lane,
        archiveReviewStatus: archive?.reviewStatus,
        vectorProvider: vectorIndex?.provider,
        vectorStatus: vectorIndex?.status,
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
        sourceScope: context.sourceScope,
        lifeDomain: archive?.lifeDomain,
        lifeDomainId: archive?.lifeDomainId,
        sourceKind: archive?.sourceKind,
        archiveLane: archive?.lane,
        suggestedWikiTitle: archive?.suggestedWikiTitle,
        archiveReviewStatus: archive?.reviewStatus,
        vectorProvider: vectorIndex?.provider,
        vectorStatus: vectorIndex?.status,
      },
    },
    {
      id: archiveCollectionId,
      kind: 'ArchiveCollection',
      props: {
        name: 'Whole-life source documents',
        purpose: 'Sources enter this collection before human-reviewed client, case, service, or project attachment.',
      },
    },
    {
      id: archiveLaneId,
      kind: 'ArchiveLane',
      props: {
        name: archive?.lane || 'Source documents',
        confidence: archive?.confidence || 'low',
        reviewStatus: archive?.reviewStatus || 'needs-human-review',
      },
    },
    {
      id: lifeDomainId,
      kind: 'LifeDomain',
      props: {
        name: archive?.lifeDomain || 'Unknown',
        domainId: archive?.lifeDomainId || 'unknown',
        sourceKind: archive?.sourceKind || 'source',
      },
    },
    {
      id: archiveTopicId,
      kind: 'ArchiveTopic',
      props: {
        title: archive?.suggestedWikiTitle || titleFromFileName(file.originalname),
        namespace: archive?.sourceNamespace || 'Whole-life source archive',
      },
    },
    {
      id: semanticIndexId,
      kind: 'SemanticIndex',
      props: {
        provider: vectorIndex?.provider || 'weaviate',
        status: vectorIndex?.status || 'planned',
        embeddingModel: vectorIndex?.embeddingModel || 'configured embeddings model',
      },
    },
  ];
  collectionIds.forEach((collection) => {
    nodes.push({
      id: collection.id,
      kind: 'Collection',
      props: {
        name: collection.label,
        lifeDomain: archive?.lifeDomain || 'Unknown',
      },
    });
  });
  const edges = [
    {
      from: `file:${fileId}`,
      to: `wiki:${wikiPageId}`,
      kind: 'GENERATED_WIKI_PAGE',
      props: { extractionStatus: extraction.status, privacyLevel: context.privacyLevel },
    },
    {
      from: `wiki:${wikiPageId}`,
      to: archiveCollectionId,
      kind: 'PART_OF_ARCHIVE',
      props: { sourceScope: context.sourceScope, reviewStatus: archive?.reviewStatus || 'needs-human-review' },
    },
    {
      from: `file:${fileId}`,
      to: archiveLaneId,
      kind: 'CLASSIFIED_AS',
      props: { confidence: archive?.confidence || 'low', reason: archive?.classificationReason || '' },
    },
    {
      from: `wiki:${wikiPageId}`,
      to: lifeDomainId,
      kind: 'IN_DOMAIN',
      props: { confidence: archive?.confidence || 'low', sourceKind: archive?.sourceKind || 'source' },
    },
    {
      from: `wiki:${wikiPageId}`,
      to: archiveTopicId,
      kind: 'SUGGESTED_WIKI_TOPIC',
      props: { reviewStatus: archive?.reviewStatus || 'needs-human-review' },
    },
    {
      from: `wiki:${wikiPageId}`,
      to: semanticIndexId,
      kind: 'QUEUED_FOR_SEMANTIC_INDEX',
      props: {
        provider: vectorIndex?.provider || 'weaviate',
        status: vectorIndex?.status || 'planned',
        chunkCount: vectorIndex?.chunkCount || 0,
      },
    },
  ];
  collectionIds.forEach((collection) => {
    edges.push({
      from: `wiki:${wikiPageId}`,
      to: collection.id,
      kind: 'IN_COLLECTION',
      props: { lifeDomain: archive?.lifeDomain || 'Unknown' },
    });
  });

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
  const linkToCurrentRecord = normalizedContext.sourceScope === 'current-record';
  const relationshipContext = linkToCurrentRecord
    ? normalizedContext
    : {
        ...normalizedContext,
        clientId: '',
        clientName: '',
        caseId: '',
        caseTitle: '',
        serviceName: '',
        pageId: '',
      };
  const createdAt = new Date().toISOString();
  const fileId = crypto.randomUUID();
  const ingestionId = `wiki-ingest-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const wikiPageId = `ingest:${fileId}`;
  const sha256 = await sha256File(file.path);
  const extraction = await extractTextFromFile(file, normalizedContext);
  const vectorIndex = semanticIndexPlan(extraction);
  const entities = extractEntities(extraction.textPreview || extraction.text, file.originalname, relationshipContext);
  const archive = classifyArchiveSource({ file, extraction, entities, context: normalizedContext });
  const embeddingReview = buildEmbeddingReviewPlan({ fileId, extraction, archive, vectorIndex, context: normalizedContext });
  const sections = buildSections(extraction.textPreview || extraction.text, file.originalname, extraction);
  const summary = summarize(
    extraction.textPreview || extraction.text,
    linkToCurrentRecord
      ? `${file.originalname} was uploaded into the Case Wiki and linked to the selected case-management context.`
      : `${file.originalname} was uploaded into the Case Wiki as a standalone source document for archive organization.`,
  );
  const graph = buildGraph({ fileId, wikiPageId, file, extraction, context: relationshipContext, entities, sha256, archive, vectorIndex });
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
  const linkedClientId = relationshipContext.clientId || '';
  const linkedCaseId = relationshipContext.caseId || '';

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
    linkedServiceName: relationshipContext.serviceName || '',
    sourceScope: normalizedContext.sourceScope,
    sourcePageId: relationshipContext.pageId || '',
    archive,
    vectorIndex,
    embeddingReview,
    privacy: {
      privacyLevel: normalizedContext.privacyLevel,
      redactionMode: normalizedContext.redactionMode,
      retentionPolicy: normalizedContext.retentionPolicy,
      sourceScope: normalizedContext.sourceScope,
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
      archive,
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
        structuredFields: [
          'Uploaded source file',
          `Source boundary: ${normalizedContext.sourceScope}`,
          `Life domain: ${archive.lifeDomain}`,
          `Source kind: ${archive.sourceKind}`,
          `Archive lane: ${archive.lane}`,
          `Review status: ${archive.reviewStatus}`,
          `Suggested page: ${archive.suggestedWikiTitle}`,
          `Extraction: ${extraction.status}`,
          `Embedding review: ${embeddingReview.status}`,
          `Neo4j: ${neo4j.status}`,
        ],
        attachments: [file.originalname],
        followUpRequired: extraction.status !== 'ready' || neo4j.status !== 'written',
        visibility: normalizedContext.privacyLevel === 'private' || normalizedContext.privacyLevel === 'personal' ? 'private' : 'team',
        aiSummary: `Generated wiki source page from ${file.originalname}.`,
        aiTags: ['wiki ingestion', 'source file', archive.lifeDomain, archive.sourceKind, extraction.status, normalizedContext.privacyLevel],
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
        sourceHash: sha256,
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size || 0,
        uploadedAt: createdAt,
        status: extraction.status === 'ready' ? 'ready' : 'metadata-only',
        extractionStatus: extraction.status,
        extractionMethod: extraction.method,
        graphStatus: neo4j.status,
        graphMessage: neo4j.message || neo4j.skippedReason || '',
        vectorProvider: vectorIndex.provider,
        vectorStatus: vectorIndex.status,
        vectorMessage: vectorIndex.note,
        vectorChunkCount: vectorIndex.chunkCount,
        embeddingReview,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        linkedClientId,
        linkedCaseId,
        linkedServiceName: relationshipContext.serviceName || '',
        pageId: wikiPageId,
        title,
        summary,
        textPreview: extraction.textPreview,
        sections,
        entities,
        privacyLevel: normalizedContext.privacyLevel,
        redactionMode: normalizedContext.redactionMode,
        retentionPolicy: normalizedContext.retentionPolicy,
        sourceScope: normalizedContext.sourceScope,
        parserWarning: extraction.warning,
        tableSummary: extraction.tableSummary,
        graphSummary,
        graphPreview: graph,
        archive,
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

const buildCaseWikiLocalArchiveCatalogRecord = async ({ candidate, userId, context = {}, writeGraph = true }) => {
  const normalizedContext = normalizeWikiIngestContext({
    ...context,
    sourceScope: 'standalone',
    privacyLevel: context.privacyLevel || 'personal',
    redactionMode: context.redactionMode || 'strict',
    retentionPolicy: context.retentionPolicy || 'review-source',
  });
  const createdAt = new Date().toISOString();
  const candidateId =
    typeof candidate?.id === 'string' && candidate.id
      ? candidate.id
      : crypto
          .createHash('sha1')
          .update(`${candidate?.rootId || 'root'}:${candidate?.relativePath || candidate?.fileName || createdAt}`)
          .digest('hex')
          .slice(0, 16);
  const fileId = `local-catalog-${candidateId}`;
  const ingestionId = `wiki-local-catalog-${candidateId}`;
  const wikiPageId = `ingest:${fileId}`;
  const fileName = candidate?.fileName || candidate?.suggestedWikiTitle || 'Local archive source';
  const extension = path.extname(fileName || '').toLowerCase();
  const metadataHash = crypto
    .createHash('sha256')
    .update(
      [
        candidate?.rootId || '',
        candidate?.rootLabel || '',
        candidate?.relativePath || '',
        fileName,
        candidate?.size || 0,
        candidate?.modifiedAt || '',
      ].join('|'),
    )
    .digest('hex');
  const sha256 = candidate?.sourceHash || metadataHash;
  const file = {
    originalname: fileName,
    mimetype: candidate?.mimeType || 'application/octet-stream',
    size: candidate?.size || 0,
  };
  const pickyScore = Number(candidate?.pickyScore);
  const pickyImportDecision = candidate?.pickyTier || candidate?.pickyAction || candidate?.pickyReasons?.length
    ? {
        tier: candidate?.pickyTier || 'review-first',
        score: Number.isFinite(pickyScore) ? Math.max(0, Math.min(100, pickyScore)) : null,
        action: candidate?.pickyAction || 'Review before selecting',
        reasons: Array.isArray(candidate?.pickyReasons)
          ? candidate.pickyReasons.map((reason) => String(reason || '').trim()).filter(Boolean).slice(0, 8)
          : [],
        decidedAt: createdAt,
        source: 'Case Wiki local archive picky selector',
      }
    : null;
  const title = `Ingested source: ${fileName}`;
  const archive = {
    laneId: slugifyArchiveId(candidate?.lane || 'source-documents'),
    lane: candidate?.lane || 'Source documents',
    lifeDomain: candidate?.lifeDomain || 'Unknown',
    lifeDomainId: candidate?.lifeDomainId || 'unknown',
    sourceKind: candidate?.sourceKind || sourceKindForFile(extension, fileName),
    suggestedWikiTitle: candidate?.suggestedWikiTitle || titleFromFileName(fileName),
    sourceNamespace: 'Whole-life source archive',
    reviewStatus: 'needs-human-review',
    attachmentRecommendation:
      'Cataloged as a standalone source. Keep it out of clients, cases, services, and projects until a human reviews the attachment.',
    confidence: candidate?.importPriority === 'high' ? 'medium' : 'low',
    matchedKeywords: [],
    suggestedCollections: Array.isArray(candidate?.suggestedCollections)
      ? candidate.suggestedCollections.slice(0, 8)
      : [`Domain: ${candidate?.lifeDomain || 'Unknown'}`, candidate?.lane || 'Source documents'],
    classificationReason:
      candidate?.importReason ||
      'Cataloged from the local archive scan as metadata first. Full extraction and embedding require a later review pass.',
    cleanupSignals: Array.isArray(candidate?.cleanupSignals) ? candidate.cleanupSignals : [],
    importReadiness: candidate?.importReadiness || 'ready-to-review',
    reviewAction: candidate?.reviewAction || 'Review before embedding',
    importReason:
      candidate?.importReason ||
      'This source has been cataloged so the wiki can organize it before any full-content extraction or vector indexing.',
    ...(pickyImportDecision ? { pickyImportDecision } : {}),
    localArchive: {
      rootId: candidate?.rootId || '',
      rootLabel: candidate?.rootLabel || '',
      relativePath: candidate?.relativePath || '',
      displayPath: candidate?.displayPath || candidate?.relativePath || fileName,
      modifiedAt: candidate?.modifiedAt || '',
    },
    sourceHashStatus: candidate?.sourceHashStatus || (candidate?.sourceHash ? 'hashed' : 'metadata-hash'),
    textFingerprintStatus: candidate?.textFingerprintStatus || 'not-scanned',
    contentDuplicateCount: candidate?.contentDuplicateCount || 0,
    contentDuplicateGroupKey: candidate?.contentDuplicateGroupKey || '',
    nearDuplicateCount: candidate?.nearDuplicateCount || 0,
    nearDuplicateGroupKey: candidate?.nearDuplicateGroupKey || '',
    nearDuplicateScore: candidate?.nearDuplicateScore || 0,
    nearDuplicateTerms: Array.isArray(candidate?.nearDuplicateTerms) ? candidate.nearDuplicateTerms.slice(0, 12) : [],
    sourceBoundary: 'standalone-source',
    catalogOnly: true,
  };
  const extraction = {
    method: 'local archive metadata catalog',
    status: 'metadata-only',
    text: '',
    textPreview: [
      `${fileName} was cataloged from ${archive.localArchive.displayPath || 'the local archive'} as a standalone source page.`,
      `Domain: ${archive.lifeDomain}. Lane: ${archive.lane}. Readiness: ${archive.importReadiness}.`,
      archive.pickyImportDecision
        ? `Picky import decision: ${archive.pickyImportDecision.tier} · ${archive.pickyImportDecision.action}${archive.pickyImportDecision.score !== null ? ` · ${archive.pickyImportDecision.score}/100` : ''}.`
        : '',
      archive.cleanupSignals.length ? `Cleanup signals: ${archive.cleanupSignals.join(', ')}.` : 'No cleanup signals were recorded.',
      'Full text extraction, attachment, and vector embedding remain review-gated.',
    ].filter(Boolean).join('\n'),
    textBytes: 0,
    rawTextBytes: 0,
    warning: 'Catalog-only record. Run a source extraction pass before embedding this file.',
    tableSummary: null,
    privacy: {
      privacyLevel: normalizedContext.privacyLevel,
      redactionMode: normalizedContext.redactionMode,
      redacted: false,
    },
  };
  const vectorIndex = {
    provider: CASE_WIKI_VECTOR_PROVIDER,
    status: 'planned',
    chunkCount: 0,
    embeddingModel: process.env.EMBEDDINGS_MODEL || 'configured embeddings model',
    note: 'Catalog-only source. No vector chunks are generated until the user approves extraction and embedding.',
  };
  const entities = [
    archive.lifeDomain,
    archive.lane,
    archive.sourceKind,
    ...archive.suggestedCollections.map((collection) => collection.replace(/^Domain:\s*/i, '')),
  ]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 12);
  const embeddingReview = {
    ...buildEmbeddingReviewPlan({ fileId, extraction, archive, vectorIndex, context: normalizedContext }),
    status: 'metadata-only',
    chunkCount: 0,
    estimatedTotalChunks: 0,
    approvedCount: 0,
    rejectedCount: 0,
    pendingCount: 0,
    chunks: [],
    note: 'Catalog-only source. Run extraction and human review before creating embedding chunks.',
    reviewReason: 'Cataloged metadata is not embedded. Full source text requires review before vector indexing.',
  };
  const sections = buildSections('', fileName, extraction);
  const summary = `${fileName} is cataloged as a standalone ${archive.lifeDomain} source. It is ready for human review before extraction, attachment, or embedding.`;
  const graph = buildGraph({
    fileId,
    wikiPageId,
    file,
    extraction,
    context: {
      ...normalizedContext,
      clientId: '',
      clientName: '',
      caseId: '',
      caseTitle: '',
      serviceName: '',
      pageId: '',
    },
    entities,
    sha256,
    archive,
    vectorIndex,
  });
  const graphSummary = summarizeGraph(graph);
  const neo4j = writeGraph
    ? await writeToNeo4j(graph)
    : {
        status: 'preview',
        message: 'Catalog graph generated without writing to Neo4j',
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
      };
  const noteId = `note-ingest-${fileId}`;
  const documentId = `doc-ingest-${fileId}`;
  const timelineId = `timeline-ingest-${fileId}`;

  return {
    ingestionId,
    fileId,
    originalName: fileName,
    storedName: archive.localArchive.relativePath || fileName,
    mimeType: file.mimetype,
    size: file.size,
    sha256,
    path: `local-archive://${archive.localArchive.rootLabel || 'root'}/${archive.localArchive.relativePath || fileName}`,
    linkedClientId: '',
    linkedCaseId: '',
    linkedServiceName: '',
    sourceScope: 'standalone',
    sourcePageId: '',
    archive,
    vectorIndex,
    embeddingReview,
    privacy: {
      privacyLevel: normalizedContext.privacyLevel,
      redactionMode: normalizedContext.redactionMode,
      retentionPolicy: normalizedContext.retentionPolicy,
      sourceScope: 'standalone',
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
      sourceFileName: fileName,
      uploadedAt: createdAt,
      generatedBy: 'Case Wiki local archive catalog',
      archive,
    },
    generatedRecords: {
      note: {
        id: noteId,
        timestamp: createdAt,
        author: 'Case Wiki local archive catalog',
        clientId: '',
        caseId: '',
        type: 'wiki source cataloged',
        narrative: summary,
        structuredFields: [
          'Cataloged local archive source',
          'Source boundary: standalone',
          `Life domain: ${archive.lifeDomain}`,
          `Source kind: ${archive.sourceKind}`,
          `Archive lane: ${archive.lane}`,
          `Review status: ${archive.reviewStatus}`,
          `Suggested page: ${archive.suggestedWikiTitle}`,
          archive.pickyImportDecision
            ? `Picky import: ${archive.pickyImportDecision.tier} · ${archive.pickyImportDecision.action}`
            : 'Picky import: not recorded',
          'Extraction: metadata-only',
          `Embedding review: ${embeddingReview.status}`,
          `Neo4j: ${neo4j.status}`,
        ],
        attachments: [fileName],
        followUpRequired: true,
        visibility: 'private',
        aiSummary: `Cataloged ${fileName} as a standalone Case Wiki source.`,
        aiTags: ['wiki catalog', 'local archive', archive.lifeDomain, archive.sourceKind, 'metadata-only'],
      },
      document: {
        id: documentId,
        clientId: '',
        caseId: '',
        name: fileName,
        type: extension.replace('.', '').toUpperCase() || file.mimetype || 'FILE',
        tag: 'Case Wiki source',
        uploadedAt: createdAt,
        permission: 'private',
        searchableText: extraction.textPreview,
      },
      timeline: {
        id: timelineId,
        clientId: '',
        caseId: '',
        occurredAt: createdAt,
        type: 'wiki source cataloged',
        title: `${fileName} cataloged into Case Wiki`,
        detail: `${fileName} generated a metadata-only wiki page, ${graph.nodes.length} graph node${graph.nodes.length === 1 ? '' : 's'}, and ${graph.edges.length} graph edge${graph.edges.length === 1 ? '' : 's'}. Neo4j status: ${neo4j.status}.`,
      },
      frontendRecord: {
        id: fileId,
        fileName,
        sourceHash: sha256,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: createdAt,
        status: 'metadata-only',
        extractionStatus: extraction.status,
        extractionMethod: extraction.method,
        graphStatus: neo4j.status,
        graphMessage: neo4j.message || neo4j.skippedReason || '',
        vectorProvider: vectorIndex.provider,
        vectorStatus: vectorIndex.status,
        vectorMessage: vectorIndex.note,
        vectorChunkCount: 0,
        embeddingReview,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        linkedClientId: '',
        linkedCaseId: '',
        linkedServiceName: '',
        pageId: wikiPageId,
        title,
        summary,
        textPreview: extraction.textPreview,
        sections,
        entities,
        privacyLevel: normalizedContext.privacyLevel,
        redactionMode: normalizedContext.redactionMode,
        retentionPolicy: normalizedContext.retentionPolicy,
        sourceScope: 'standalone',
        parserWarning: extraction.warning,
        tableSummary: null,
        graphSummary,
        graphPreview: graph,
        archive,
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

const buildCaseWikiLocalArchiveExtractionRecord = async ({ existing, localFile, userId, context = {}, writeGraph = true }) => {
  if (!existing?.fileId) {
    throw new Error('A cataloged Case Wiki source is required before extraction');
  }
  if (!localFile?.path) {
    throw new Error('A readable local archive file is required before extraction');
  }

  const existingArchive = existing.archive || existing.generatedRecords?.frontendRecord?.archive || existing.wikiPage?.archive || {};
  const existingPrivacy = existing.privacy || {};
  const normalizedContext = normalizeWikiIngestContext({
    ...existingPrivacy,
    ...context,
    sourceScope: 'standalone',
    privacyLevel: context.privacyLevel || existingPrivacy.privacyLevel || 'personal',
    redactionMode: context.redactionMode || existingPrivacy.redactionMode || 'strict',
    retentionPolicy: context.retentionPolicy || existingPrivacy.retentionPolicy || 'review-source',
  });
  const createdAt = new Date().toISOString();
  const fileId = existing.fileId;
  const ingestionId = existing.ingestionId || `wiki-local-extract-${fileId}`;
  const wikiPageId = existing.wikiPage?.id || existing.generatedRecords?.frontendRecord?.pageId || `ingest:${fileId}`;
  const fileName = localFile.fileName || existing.originalName || 'Local archive source';
  const file = {
    originalname: fileName,
    filename: localFile.relativePath || existing.storedName || fileName,
    mimetype: localFile.mimeType || existing.mimeType || 'application/octet-stream',
    size: localFile.size || existing.size || 0,
    path: localFile.path,
  };
  const sha256 = await sha256File(localFile.path);
  const extraction = await extractTextFromFile(file, normalizedContext);
  const vectorIndex = semanticIndexPlan(extraction);
  const relationshipContext = {
    ...normalizedContext,
    clientId: '',
    clientName: '',
    caseId: '',
    caseTitle: '',
    serviceName: '',
    pageId: '',
  };
  const freshArchive = classifyArchiveSource({
    file,
    extraction,
    entities: [],
    context: normalizedContext,
  });
  const archive = {
    ...freshArchive,
    ...existingArchive,
    suggestedCollections: Array.isArray(existingArchive.suggestedCollections) && existingArchive.suggestedCollections.length
      ? existingArchive.suggestedCollections
      : freshArchive.suggestedCollections,
    cleanupSignals: Array.isArray(existingArchive.cleanupSignals) ? existingArchive.cleanupSignals : [],
    reviewStatus: existingArchive.reviewStatus || freshArchive.reviewStatus || 'needs-human-review',
    attachmentRecommendation:
      existingArchive.attachmentRecommendation ||
      'Extracted as a standalone source. Keep it out of clients, cases, services, and projects until a human reviews the attachment.',
    localArchive: {
      ...(existingArchive.localArchive || {}),
      rootId: localFile.rootId || existingArchive.localArchive?.rootId || '',
      rootLabel: localFile.rootLabel || existingArchive.localArchive?.rootLabel || '',
      relativePath: localFile.relativePath || existingArchive.localArchive?.relativePath || '',
      displayPath:
        existingArchive.localArchive?.displayPath ||
        (localFile.rootLabel && localFile.relativePath ? `${localFile.rootLabel}/${localFile.relativePath}` : localFile.relativePath || fileName),
      modifiedAt: localFile.modifiedAt || existingArchive.localArchive?.modifiedAt || '',
    },
    sourceBoundary: 'standalone-source',
    catalogOnly: false,
    extractedAt: createdAt,
    extractionStatus: extraction.status,
    extractionMethod: extraction.method,
    importReason:
      existingArchive.importReason ||
      'This source was extracted only after it had already been cataloged as a standalone whole-life wiki source.',
  };
  const entities = extractEntities(extraction.textPreview || extraction.text, fileName, relationshipContext);
  const embeddingReview = buildEmbeddingReviewPlan({ fileId, extraction, archive, vectorIndex, context: normalizedContext });
  const sections = buildSections(extraction.textPreview || extraction.text, fileName, extraction);
  const summary = summarize(
    extraction.textPreview || extraction.text,
    `${fileName} was extracted from the local archive as a standalone source document. Attachment and embedding still require human review.`,
  );
  const graph = buildGraph({ fileId, wikiPageId, file, extraction, context: relationshipContext, entities, sha256, archive, vectorIndex });
  const graphSummary = summarizeGraph(graph);
  const neo4j = writeGraph
    ? await writeToNeo4j(graph)
    : {
        status: 'preview',
        message: 'Extraction graph generated without writing to Neo4j',
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
      };
  const title = existing.wikiPage?.title || existing.generatedRecords?.frontendRecord?.title || `Ingested source: ${fileName}`;
  const noteId = existing.generatedRecords?.note?.id || `note-ingest-${fileId}`;
  const documentId = existing.generatedRecords?.document?.id || `doc-ingest-${fileId}`;
  const timelineId = existing.generatedRecords?.timeline?.id || `timeline-ingest-${fileId}`;
  const generatedRecords = {
    ...(existing.generatedRecords || {}),
    note: {
      id: noteId,
      timestamp: createdAt,
      author: 'Case Wiki local archive extraction',
      clientId: '',
      caseId: '',
      type: 'wiki source extracted',
      narrative: summary,
      structuredFields: [
        'Extracted cataloged local archive source',
        'Source boundary: standalone',
        `Life domain: ${archive.lifeDomain}`,
        `Source kind: ${archive.sourceKind}`,
        `Archive lane: ${archive.lane}`,
        `Review status: ${archive.reviewStatus}`,
        `Extraction: ${extraction.status}`,
        `Embedding review: ${embeddingReview.status}`,
        `Neo4j: ${neo4j.status}`,
      ],
      attachments: [fileName],
      followUpRequired: embeddingReview.pendingCount > 0 || extraction.status !== 'ready',
      visibility: 'private',
      aiSummary: `Extracted ${fileName} from the local archive for Case Wiki review.`,
      aiTags: ['wiki extraction', 'local archive', archive.lifeDomain, archive.sourceKind, extraction.status],
    },
    document: {
      id: documentId,
      clientId: '',
      caseId: '',
      name: fileName,
      type: path.extname(fileName || '').replace('.', '').toUpperCase() || file.mimetype || 'FILE',
      tag: 'Case Wiki source',
      uploadedAt: existing.generatedRecords?.document?.uploadedAt || createdAt,
      permission: 'private',
      searchableText: extraction.textPreview || extraction.warning,
    },
    timeline: {
      id: timelineId,
      clientId: '',
      caseId: '',
      occurredAt: createdAt,
      type: 'wiki source extracted',
      title: `${fileName} extracted for Case Wiki review`,
      detail: `${fileName} now has ${embeddingReview.chunkCount || 0} review chunk${embeddingReview.chunkCount === 1 ? '' : 's'}, ${graph.nodes.length} graph node${graph.nodes.length === 1 ? '' : 's'}, and ${graph.edges.length} graph edge${graph.edges.length === 1 ? '' : 's'}. Neo4j status: ${neo4j.status}.`,
    },
    frontendRecord: {
      ...(existing.generatedRecords?.frontendRecord || {}),
      id: fileId,
      fileName,
      sourceHash: sha256,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: existing.generatedRecords?.frontendRecord?.uploadedAt || existing.createdAt || createdAt,
      status: extraction.status === 'ready' ? 'ready' : 'metadata-only',
      extractionStatus: extraction.status,
      extractionMethod: extraction.method,
      graphStatus: neo4j.status,
      graphMessage: neo4j.message || neo4j.skippedReason || '',
      vectorProvider: vectorIndex.provider,
      vectorStatus: vectorIndex.status,
      vectorMessage: vectorIndex.note,
      vectorChunkCount: vectorIndex.chunkCount,
      embeddingReview,
      weaviateDryRun: null,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      linkedClientId: '',
      linkedCaseId: '',
      linkedServiceName: '',
      pageId: wikiPageId,
      title,
      summary,
      textPreview: extraction.textPreview,
      sections,
      entities,
      privacyLevel: normalizedContext.privacyLevel,
      redactionMode: normalizedContext.redactionMode,
      retentionPolicy: normalizedContext.retentionPolicy,
      sourceScope: 'standalone',
      parserWarning: extraction.warning,
      tableSummary: extraction.tableSummary,
      graphSummary,
      graphPreview: graph,
      archive,
      sourceFileId: fileId,
      noteId,
      documentId,
      timelineId,
    },
  };

  return {
    ...(existing || {}),
    ingestionId,
    fileId,
    originalName: fileName,
    storedName: localFile.relativePath || existing.storedName || fileName,
    mimeType: file.mimetype,
    size: file.size,
    sha256,
    path: `local-archive://${archive.localArchive.rootLabel || 'root'}/${archive.localArchive.relativePath || fileName}`,
    linkedClientId: '',
    linkedCaseId: '',
    linkedServiceName: '',
    sourceScope: 'standalone',
    sourcePageId: '',
    archive,
    vectorIndex,
    embeddingReview,
    weaviateDryRun: null,
    privacy: {
      privacyLevel: normalizedContext.privacyLevel,
      redactionMode: normalizedContext.redactionMode,
      retentionPolicy: normalizedContext.retentionPolicy,
      sourceScope: 'standalone',
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
      ...(existing.wikiPage || {}),
      id: wikiPageId,
      title,
      summary,
      sections,
      entities,
      sourceFileId: fileId,
      sourceFileName: fileName,
      uploadedAt: existing.wikiPage?.uploadedAt || existing.createdAt || createdAt,
      generatedBy: 'Case Wiki local archive extraction',
      archive,
    },
    generatedRecords,
    graph,
    graphSummary,
    neo4j,
    createdAt: existing.createdAt || createdAt,
    userId,
  };
};

module.exports = {
  buildCaseWikiUpload,
  buildCaseWikiLocalArchiveCatalogRecord,
  buildCaseWikiLocalArchiveExtractionRecord,
  normalizeWikiIngestContext,
  writeCaseWikiGraphToNeo4j: writeToNeo4j,
};

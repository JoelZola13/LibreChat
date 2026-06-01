const crypto = require('crypto');
const { constants: fsConstants, createReadStream } = require('fs');
const fs = require('fs/promises');
const path = require('path');
const FormData = require('form-data');
const { logger } = require('@librechat/data-schemas');
const { createAxiosInstance, logAxiosError } = require('@librechat/api');
const { DocumentsOrganizerFile } = require('~/models/DocumentsOrganizerFile');
const { DocumentsOrganizerImportRun } = require('~/models/DocumentsOrganizerImportRun');
const { DocumentsOrganizerSavedView } = require('~/models/DocumentsOrganizerSavedView');

const axios = createAxiosInstance();

const DEFAULT_DOCUMENTS_ORGANIZER_ROOTS = '/host-home/Documents,/host-home/Desktop,/host-home/Downloads,/host-home/Projects';
const DEFAULT_DOCUMENTS_ORGANIZER_PHYSICAL_ROOT = '/host-home/Documents/Nanobot Organized Documents';
const DEFAULT_DOCUMENTS_ORGANIZER_PHYSICAL_SOURCE_ROOTS = '/host-home/Documents,/host-home/Desktop,/host-home/Downloads';
const DEFAULT_DOCUMENTS_ORGANIZER_MAX_FILES = 2500;
const DEFAULT_DOCUMENTS_ORGANIZER_MAX_DEPTH = 8;
const MAX_DOCUMENTS_ORGANIZER_MAX_FILES = 20000;
const DEFAULT_DOCUMENTS_ORGANIZER_IMPORT_MAX_BYTES = 100 * 1024 * 1024;
const DEFAULT_DOCUMENTS_ORGANIZER_IMPORT_RUN_LIMIT = 6;
const DEFAULT_DOCUMENTS_ORGANIZER_IMPORT_RUN_MAX_FILES = 100;
const DEFAULT_DOCUMENTS_ORGANIZER_SAVED_VIEW_LIMIT = 8;
const DEFAULT_DOCUMENTS_ORGANIZER_COLLECTION_LIMIT = 8;
const DOCUMENTS_ORGANIZER_MOVE_CONFIRMATION = 'MOVE FILES';
const HOST_HOME_PREFIX = '/host-home';
const DEFAULT_DOCUMENTS_ORGANIZER_DOCLING_EXPORTS = [
  'markdown',
  'text',
  'html',
  'json',
  'doctags',
  'vtt',
  'tables',
  'figures',
  'multimodal',
];
const DEFAULT_DOCUMENTS_ORGANIZER_PHYSICAL_DOCUMENT_TYPES = [
  'word-processing',
  'pdf',
  'spreadsheet',
  'presentation',
  'markdown',
  'text',
];
const PROJECT_MARKER_FILENAMES = [
  '.git',
  'Cargo.toml',
  'Dockerfile',
  'Gemfile',
  'build.gradle',
  'bun.lockb',
  'composer.json',
  'go.mod',
  'lerna.json',
  'mix.exs',
  'next.config.js',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'pom.xml',
  'pyproject.toml',
  'requirements.txt',
  'settings.gradle',
  'tsconfig.json',
  'turbo.json',
  'vite.config.js',
  'yarn.lock',
];
const PROJECT_METADATA_FILENAMES = new Set([
  'agents.md',
  'changelog.md',
  'codeowners',
  'contributing.md',
  'license',
  'license.md',
  'readme',
  'readme.md',
  'security.md',
]);
const PROJECT_ARTIFACT_DUPLICATE_FILENAMES = new Set([
  ...PROJECT_METADATA_FILENAMES,
  ...PROJECT_MARKER_FILENAMES.map((filename) => filename.toLowerCase()),
  'docker-compose.yml',
  'package-lock.json',
  'uv.lock',
]);
const TECHNICAL_ARTIFACT_DUPLICATE_FILENAMES = new Set([
  ...PROJECT_ARTIFACT_DUPLICATE_FILENAMES,
  '.env',
  '.env.local',
  '.env.production',
  'components.json',
  'config.json',
  'credentials.json',
  'secrets.json',
  'settings.json',
  'token.json',
  'tokens.json',
]);
const TECHNICAL_ARTIFACT_DUPLICATE_FILENAME_REGEX = createExactFilenameRegex(TECHNICAL_ARTIFACT_DUPLICATE_FILENAMES);
const TECHNICAL_ARTIFACT_PATH_SEGMENT_REGEX =
  /(^|[/\\])(?:\.git|\.pnpm|\.venv|\.yarn|__pycache__|build|coverage|dist|node_modules|pods|projects|site-packages|target|tmp|vendor|venv)([/\\]|$)/i;
const SENSITIVE_TECHNICAL_PATH_SEGMENT_REGEX =
  /(^|[/\\])[^/\\]*(?:api[-_ ]?key|credential|private[-_ ]?key|secret|token)[^/\\]*(?:[/\\]|$)/i;

class DocumentsOrganizerUserError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'DocumentsOrganizerUserError';
    this.statusCode = statusCode;
  }
}

const DOCUMENT_TYPE_BY_EXTENSION = new Map([
  ['.doc', { documentType: 'word-processing', folderKey: 'word-processing', folderName: 'Word Processing' }],
  ['.docx', { documentType: 'word-processing', folderKey: 'word-processing', folderName: 'Word Processing' }],
  ['.odt', { documentType: 'word-processing', folderKey: 'word-processing', folderName: 'Word Processing' }],
  ['.rtf', { documentType: 'word-processing', folderKey: 'word-processing', folderName: 'Word Processing' }],
  ['.pages', { documentType: 'word-processing', folderKey: 'word-processing', folderName: 'Word Processing' }],
  ['.pdf', { documentType: 'pdf', folderKey: 'pdfs', folderName: 'PDFs' }],
  ['.md', { documentType: 'markdown', folderKey: 'notes-markdown', folderName: 'Notes & Markdown' }],
  ['.markdown', { documentType: 'markdown', folderKey: 'notes-markdown', folderName: 'Notes & Markdown' }],
  ['.txt', { documentType: 'text', folderKey: 'text-files', folderName: 'Text Files' }],
  ['.rst', { documentType: 'text', folderKey: 'text-files', folderName: 'Text Files' }],
  ['.csv', { documentType: 'spreadsheet', folderKey: 'spreadsheets', folderName: 'Spreadsheets' }],
  ['.tsv', { documentType: 'spreadsheet', folderKey: 'spreadsheets', folderName: 'Spreadsheets' }],
  ['.xls', { documentType: 'spreadsheet', folderKey: 'spreadsheets', folderName: 'Spreadsheets' }],
  ['.xlsx', { documentType: 'spreadsheet', folderKey: 'spreadsheets', folderName: 'Spreadsheets' }],
  ['.ods', { documentType: 'spreadsheet', folderKey: 'spreadsheets', folderName: 'Spreadsheets' }],
  ['.ppt', { documentType: 'presentation', folderKey: 'presentations', folderName: 'Presentations' }],
  ['.pptx', { documentType: 'presentation', folderKey: 'presentations', folderName: 'Presentations' }],
  ['.odp', { documentType: 'presentation', folderKey: 'presentations', folderName: 'Presentations' }],
  ['.key', { documentType: 'presentation', folderKey: 'presentations', folderName: 'Presentations' }],
  ['.json', { documentType: 'structured-data', folderKey: 'structured-data', folderName: 'Structured Data' }],
  ['.yaml', { documentType: 'structured-data', folderKey: 'structured-data', folderName: 'Structured Data' }],
  ['.yml', { documentType: 'structured-data', folderKey: 'structured-data', folderName: 'Structured Data' }],
  ['.xml', { documentType: 'structured-data', folderKey: 'structured-data', folderName: 'Structured Data' }],
]);

const IGNORED_DIRECTORY_NAMES = new Set([
  '.cache',
  '.git',
  '.hg',
  '.next',
  '.venv',
  'Applications',
  'Library',
  'Movies',
  'Music',
  'Pictures',
  'Public',
  'build',
  'coverage',
  'dist',
  'logs',
  'node_modules',
  'target',
  'tmp',
  'venv',
]);

const DOCUMENTS_ORGANIZER_DEFAULT_FILE_SORT = 'modified_desc';
const DOCUMENTS_ORGANIZER_FILE_SORTS = new Set([
  'modified_desc',
  'modified_asc',
  'name_asc',
  'name_desc',
  'size_desc',
  'size_asc',
  'type_asc',
]);
const DOCUMENTS_ORGANIZER_FILE_SORT_MONGO = {
  modified_desc: { modifiedAt: -1, lastSeenAt: -1, filename: 1, _id: 1 },
  modified_asc: { modifiedAt: 1, lastSeenAt: 1, filename: 1, _id: 1 },
  name_asc: { filename: 1, modifiedAt: -1, _id: 1 },
  name_desc: { filename: -1, modifiedAt: -1, _id: 1 },
  size_desc: { sizeBytes: -1, filename: 1, _id: 1 },
  size_asc: { sizeBytes: 1, filename: 1, _id: 1 },
  type_asc: { documentType: 1, filename: 1, modifiedAt: -1, _id: 1 },
};
const DOCUMENTS_ORGANIZER_RECOMMENDATION_BLUEPRINTS = [
  {
    id: 'recent-downloads',
    name: 'Recent downloads',
    description: 'Inbox-style cleanup for files still sitting in Downloads.',
    reason: 'Downloads often holds unfiled documents that should be imported, saved as a view, or moved later.',
    folderKey: 'all',
    folderName: 'All local files',
    searchQuery: 'Downloads',
    sortBy: 'modified_desc',
  },
  {
    id: 'desktop-cleanup',
    name: 'Desktop cleanup',
    description: 'Desktop files sorted oldest first for quick filing.',
    reason: 'Desktop documents are usually active clutter and good candidates for organizer review.',
    folderKey: 'all',
    folderName: 'All local files',
    searchQuery: 'Desktop',
    sortBy: 'modified_asc',
  },
  {
    id: 'largest-pdfs',
    name: 'Largest PDFs',
    description: 'PDFs sorted by size so heavy files surface first.',
    reason: 'Large PDFs are good candidates for Docling import previews, OCR checks, or storage cleanup.',
    folderKey: 'pdfs',
    folderName: 'PDFs',
    searchQuery: '',
    sortBy: 'size_desc',
  },
  {
    id: 'office-drafts',
    name: 'Office drafts',
    description: 'Word-processing files ready for Docling-backed import.',
    reason: 'These are likely editable documents that can become native Tiptap records.',
    folderKey: 'word-processing',
    folderName: 'Word Processing',
    searchQuery: '',
    sortBy: 'modified_desc',
  },
  {
    id: 'spreadsheet-review',
    name: 'Spreadsheet review',
    description: 'Spreadsheets grouped for table-aware import decisions.',
    reason: 'Docling can preserve tables and structure for import planning.',
    folderKey: 'spreadsheets',
    folderName: 'Spreadsheets',
    searchQuery: '',
    sortBy: 'modified_desc',
  },
  {
    id: 'presentation-review',
    name: 'Presentation review',
    description: 'Presentation files that may need conversion or archiving.',
    reason: 'Decks often belong in reusable project or reporting collections.',
    folderKey: 'presentations',
    folderName: 'Presentations',
    searchQuery: '',
    sortBy: 'modified_desc',
  },
  {
    id: 'markdown-notes',
    name: 'Markdown notes',
    description: 'Markdown and note files ready for native editing.',
    reason: 'Markdown imports map cleanly into structured Tiptap documents.',
    folderKey: 'notes-markdown',
    folderName: 'Notes & Markdown',
    searchQuery: '',
    sortBy: 'modified_desc',
  },
  {
    id: 'oldest-local-files',
    name: 'Oldest local files',
    description: 'The oldest indexed documents across every folder.',
    reason: 'Older documents are useful for archive, retention, or cleanup decisions.',
    folderKey: 'all',
    folderName: 'All local files',
    searchQuery: '',
    sortBy: 'modified_asc',
  },
];

function asPositiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? Math.min(number, maximum) : fallback;
}

function escapeRegexLiteral(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createExactFilenameRegex(filenames) {
  const escapedFilenames = Array.from(filenames || [])
    .map((filename) => escapeRegexLiteral(filename))
    .filter(Boolean);

  return escapedFilenames.length > 0
    ? new RegExp(`^(?:${escapedFilenames.join('|')})$`, 'i')
    : /^$/;
}

function normalizeDocumentsOrganizerFileSort(value) {
  const normalizedSort = String(value || '').trim().toLowerCase();
  return DOCUMENTS_ORGANIZER_FILE_SORTS.has(normalizedSort)
    ? normalizedSort
    : DOCUMENTS_ORGANIZER_DEFAULT_FILE_SORT;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value || '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function isEnvEnabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function normalizeRoots(value = '') {
  return String(value || '')
    .split(',')
    .map((root) => root.trim())
    .filter(Boolean)
    .map((root) => path.resolve(root))
    .filter((root, index, roots) => roots.indexOf(root) === index);
}

function getDocumentsOrganizerRoots(environment = process.env) {
  const configuredRoots =
    environment.DOCUMENTS_ORGANIZER_ROOTS ||
    environment.CASE_MANAGEMENT_LOCAL_ARCHIVE_ROOTS ||
    DEFAULT_DOCUMENTS_ORGANIZER_ROOTS;
  const allowAnyRoot = isEnvEnabled(environment.DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT);

  return normalizeRoots(configuredRoots).filter((root) => (
    allowAnyRoot ||
    root === HOST_HOME_PREFIX ||
    root.startsWith(`${HOST_HOME_PREFIX}${path.sep}`)
  ));
}

function isOrganizerRootAllowed(root, environment = process.env) {
  const allowAnyRoot = isEnvEnabled(environment.DOCUMENTS_ORGANIZER_ALLOW_ANY_ROOT);
  const resolvedRoot = path.resolve(String(root || ''));

  return Boolean(
    resolvedRoot &&
      (allowAnyRoot ||
        resolvedRoot === HOST_HOME_PREFIX ||
        resolvedRoot.startsWith(`${HOST_HOME_PREFIX}${path.sep}`)),
  );
}

function getDocumentsOrganizerPhysicalRoot(environment = process.env) {
  const configuredRoot =
    environment.DOCUMENTS_ORGANIZER_PHYSICAL_ROOT ||
    DEFAULT_DOCUMENTS_ORGANIZER_PHYSICAL_ROOT;
  const [physicalRoot] = normalizeRoots(configuredRoot);

  if (!physicalRoot || !isOrganizerRootAllowed(physicalRoot, environment)) {
    return null;
  }

  return physicalRoot;
}

function getDocumentsOrganizerPhysicalSourceRoots(environment = process.env) {
  const configuredRoots =
    environment.DOCUMENTS_ORGANIZER_PHYSICAL_SOURCE_ROOTS ||
    DEFAULT_DOCUMENTS_ORGANIZER_PHYSICAL_SOURCE_ROOTS;

  return normalizeRoots(configuredRoots).filter((root) => isOrganizerRootAllowed(root, environment));
}

function getDocumentsOrganizerPhysicalDocumentTypes(environment = process.env) {
  const configuredTypes = String(environment.DOCUMENTS_ORGANIZER_PHYSICAL_DOCUMENT_TYPES || '').trim();

  if (!configuredTypes) {
    return [...DEFAULT_DOCUMENTS_ORGANIZER_PHYSICAL_DOCUMENT_TYPES];
  }

  if (configuredTypes === '*') {
    return ['*'];
  }

  const allowedTypes = new Set(Array.from(DOCUMENT_TYPE_BY_EXTENSION.values()).map((item) => item.documentType));
  return configuredTypes
    .split(',')
    .map((type) => type.trim().toLowerCase())
    .filter((type, index, types) => allowedTypes.has(type) && types.indexOf(type) === index);
}

function getDocumentsOrganizerMaxFiles(value = process.env.DOCUMENTS_ORGANIZER_MAX_FILES) {
  return asPositiveInteger(
    value,
    DEFAULT_DOCUMENTS_ORGANIZER_MAX_FILES,
    MAX_DOCUMENTS_ORGANIZER_MAX_FILES,
  );
}

function getDocumentsOrganizerMaxDepth(value = process.env.DOCUMENTS_ORGANIZER_MAX_DEPTH) {
  return asPositiveInteger(value, DEFAULT_DOCUMENTS_ORGANIZER_MAX_DEPTH, 32);
}

function getDocumentsOrganizerImportMaxBytes(value = process.env.DOCUMENTS_ORGANIZER_IMPORT_MAX_BYTES) {
  return asPositiveInteger(value, DEFAULT_DOCUMENTS_ORGANIZER_IMPORT_MAX_BYTES, 1024 * 1024 * 1024);
}

function getDocumentsOrganizerDoclingImportUrl(environment = process.env) {
  const explicitUrl = String(
    environment.DOCUMENTS_ORGANIZER_DOCLING_IMPORT_URL ||
      environment.DOCUMENTS_DOCLING_IMPORT_URL ||
      '',
  ).trim();

  if (explicitUrl) {
    return explicitUrl;
  }

  const baseUrl = String(environment.NANOBOT_API_URL || 'http://nanobot-api:18790')
    .trim()
    .replace(/\/v1\/?$/, '')
    .replace(/\/$/, '');

  return `${baseUrl}/api/documents/import/docling`;
}

function normalizeDocumentsOrganizerDoclingCsv(value, fallback = []) {
  const rawValue = Array.isArray(value) ? value.join(',') : String(value || '').trim();
  if (!rawValue) {
    return fallback;
  }

  return rawValue
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item, index, items) => item && items.indexOf(item) === index);
}

function shouldSkipDirectory(dirent) {
  const name = dirent?.name || '';
  return name.startsWith('.') || IGNORED_DIRECTORY_NAMES.has(name);
}

function shouldSkipFile(dirent) {
  const name = dirent?.name || '';
  return name.startsWith('.');
}

function sanitizeDocumentsOrganizerFolderName(value) {
  return String(value || 'Documents')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'Documents';
}

function sanitizeDocumentsOrganizerSavedViewName(value) {
  return String(value || '')
    .replace(/[\u0000-\u001F<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function sanitizeDocumentsOrganizerFolderKey(value) {
  return String(value || 'all')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'all';
}

function normalizeDocumentsOrganizerSearchQuery(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

function normalizeDocumentsOrganizerSourceRoot(value) {
  const normalizedSourceRoot = String(value || '').trim();
  return normalizedSourceRoot ? path.resolve(normalizedSourceRoot) : '';
}

function createDocumentsOrganizerSourceRootKey(sourceRoot) {
  const normalizedSourceRoot = normalizeDocumentsOrganizerSourceRoot(sourceRoot);
  return normalizedSourceRoot
    ? crypto.createHash('sha1').update(normalizedSourceRoot).digest('hex').slice(0, 16)
    : '';
}

function createDocumentsOrganizerSavedViewKey(
  folderKey,
  searchQuery,
  sortBy = DOCUMENTS_ORGANIZER_DEFAULT_FILE_SORT,
  sourceRoot = '',
) {
  const baseKey = `${sanitizeDocumentsOrganizerFolderKey(folderKey)}:${normalizeDocumentsOrganizerSearchQuery(searchQuery).toLowerCase()}`;
  const normalizedSortBy = normalizeDocumentsOrganizerFileSort(sortBy);
  const sortedKey = normalizedSortBy === DOCUMENTS_ORGANIZER_DEFAULT_FILE_SORT
    ? baseKey
    : `${baseKey}:sort:${normalizedSortBy}`;
  const sourceRootKey = createDocumentsOrganizerSourceRootKey(sourceRoot);

  return sourceRootKey ? `${sortedKey}:root:${sourceRootKey}` : sortedKey;
}

function createDocumentsOrganizerSavedViewName({
  name,
  folderName,
  folderKey,
  searchQuery,
  sourceRoot,
} = {}) {
  const sanitizedName = sanitizeDocumentsOrganizerSavedViewName(name);
  if (sanitizedName) {
    return sanitizedName;
  }

  const sanitizedFolderName = sanitizeDocumentsOrganizerFolderName(
    folderName || (folderKey === 'all' ? 'All local files' : folderKey),
  );
  const normalizedSearchQuery = normalizeDocumentsOrganizerSearchQuery(searchQuery);
  const normalizedSourceRoot = normalizeDocumentsOrganizerSourceRoot(sourceRoot);
  const sourceRootLabel = normalizedSourceRoot ? toDisplayPath(normalizedSourceRoot) : '';

  if (sourceRootLabel && normalizedSearchQuery) {
    return `${sanitizedFolderName}: ${sourceRootLabel} / ${normalizedSearchQuery}`.slice(0, 80);
  }
  if (sourceRootLabel) {
    return `${sanitizedFolderName}: ${sourceRootLabel}`.slice(0, 80);
  }
  return normalizedSearchQuery
    ? `${sanitizedFolderName}: ${normalizedSearchQuery}`.slice(0, 80)
    : sanitizedFolderName;
}

function createDocumentsOrganizerFileMatch({
  userId,
  folderKey,
  sourceRoot,
  searchQuery,
} = {}) {
  const normalizedFolderKey = sanitizeDocumentsOrganizerFolderKey(folderKey);
  const normalizedSourceRoot = normalizeDocumentsOrganizerSourceRoot(sourceRoot);
  const normalizedSearchQuery = normalizeDocumentsOrganizerSearchQuery(searchQuery);
  const searchRegex = createCaseInsensitiveContainsRegex(normalizedSearchQuery);
  const match = {
    userId,
    status: 'indexed',
  };

  if (normalizedFolderKey && normalizedFolderKey !== 'all') {
    match.folderKey = normalizedFolderKey;
  }

  if (normalizedSourceRoot) {
    match.sourceRoot = normalizedSourceRoot;
  }

  if (searchRegex) {
    match.$or = [
      { filename: searchRegex },
      { basename: searchRegex },
      { displayPath: searchRegex },
      { relativePath: searchRegex },
      { folderName: searchRegex },
      { extension: searchRegex },
      { sourceRoot: searchRegex },
    ];
  }

  return {
    match,
    normalizedFolderKey,
    normalizedSourceRoot,
    normalizedSearchQuery: searchRegex ? normalizedSearchQuery : '',
  };
}

async function getDocumentsOrganizerRecommendationStats({
  userId,
  folderKey,
  searchQuery,
  sortBy,
  sampleLimit = 2,
} = {}) {
  const normalizedSortBy = normalizeDocumentsOrganizerFileSort(sortBy);
  const { match, normalizedFolderKey, normalizedSearchQuery } = createDocumentsOrganizerFileMatch({
    userId,
    folderKey,
    searchQuery,
  });
  const normalizedSampleLimit = asPositiveInteger(sampleLimit, 2, 4);
  const [statsRows, sampleFiles] = await Promise.all([
    DocumentsOrganizerFile.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          matchedFileCount: { $sum: 1 },
          totalSizeBytes: { $sum: '$sizeBytes' },
          latestModifiedAt: { $max: '$modifiedAt' },
        },
      },
    ]),
    DocumentsOrganizerFile.find(match)
      .sort(DOCUMENTS_ORGANIZER_FILE_SORT_MONGO[normalizedSortBy])
      .limit(normalizedSampleLimit)
      .lean(),
  ]);
  const stats = Array.isArray(statsRows) ? statsRows[0] : null;

  return {
    folderKey: normalizedFolderKey || 'all',
    searchQuery: normalizedSearchQuery,
    sortBy: normalizedSortBy,
    matchedFileCount: stats?.matchedFileCount || 0,
    totalSizeBytes: stats?.totalSizeBytes || 0,
    latestModifiedAt: stats?.latestModifiedAt || null,
    sampleFiles,
  };
}

function classifyDocumentsOrganizerFile(filename) {
  const extension = path.extname(filename || '').toLowerCase();
  return DOCUMENT_TYPE_BY_EXTENSION.get(extension) || null;
}

function createDocumentsOrganizerPathHash(userId, sourcePath) {
  return crypto
    .createHash('sha256')
    .update(`${userId}:${sourcePath}`)
    .digest('hex');
}

function toDisplayPath(sourcePath) {
  if (sourcePath === HOST_HOME_PREFIX) {
    return '~';
  }

  if (sourcePath.startsWith(`${HOST_HOME_PREFIX}${path.sep}`)) {
    return `~/${sourcePath.slice(HOST_HOME_PREFIX.length + 1)}`;
  }

  return sourcePath;
}

function isPathInside(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return Boolean(relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function isPathInsideAny(parentPaths, childPath) {
  return parentPaths.some((parentPath) => (
    path.resolve(parentPath) === path.resolve(childPath) ||
    isPathInside(parentPath, childPath)
  ));
}

function getContainingPathRoot(parentPaths, childPath) {
  const resolvedChildPath = path.resolve(childPath);
  return parentPaths.find((parentPath) => (
    path.resolve(parentPath) === resolvedChildPath ||
    isPathInside(parentPath, resolvedChildPath)
  )) || null;
}

function isDocumentsOrganizerProjectMetadataFilename(filename) {
  return PROJECT_METADATA_FILENAMES.has(path.basename(filename || '').toLowerCase());
}

async function directoryHasProjectMarker(directory, projectMarkerCache) {
  const resolvedDirectory = path.resolve(directory);

  if (projectMarkerCache.has(resolvedDirectory)) {
    return projectMarkerCache.get(resolvedDirectory);
  }

  for (const markerFilename of PROJECT_MARKER_FILENAMES) {
    if (await pathExists(path.join(resolvedDirectory, markerFilename))) {
      projectMarkerCache.set(resolvedDirectory, true);
      return true;
    }
  }

  projectMarkerCache.set(resolvedDirectory, false);
  return false;
}

async function isInsideDocumentsOrganizerProjectDirectory({
  sourcePath,
  sourceRoots,
  projectMarkerCache,
}) {
  const containingRoot = getContainingPathRoot(sourceRoots, sourcePath);

  if (!containingRoot) {
    return false;
  }

  const resolvedRoot = path.resolve(containingRoot);
  let currentDirectory = path.dirname(path.resolve(sourcePath));

  while (currentDirectory !== resolvedRoot && isPathInside(resolvedRoot, currentDirectory)) {
    if (await directoryHasProjectMarker(currentDirectory, projectMarkerCache)) {
      return true;
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      break;
    }
    currentDirectory = parentDirectory;
  }

  return false;
}

async function pathExists(sourcePath) {
  try {
    await fs.lstat(sourcePath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function createDocumentsOrganizerTargetPath({
  file,
  targetRoot,
  reservedTargets,
}) {
  const targetFolder = path.join(targetRoot, sanitizeDocumentsOrganizerFolderName(file.folderName));
  const extension = file.extension || path.extname(file.filename || '').toLowerCase();
  const basename = path.basename(file.filename || 'Document', extension);
  let collisionIndex = 0;

  while (collisionIndex < 1000) {
    const suffix = collisionIndex === 0 ? '' : ` (${collisionIndex + 1})`;
    const targetFilename = `${basename}${suffix}${extension}`;
    const targetPath = path.join(targetFolder, targetFilename);

    if (reservedTargets.has(targetPath)) {
      collisionIndex += 1;
      continue;
    }

    const targetAlreadyExists = await pathExists(targetPath);
    if (!targetAlreadyExists || path.resolve(targetPath) === path.resolve(file.sourcePath)) {
      reservedTargets.add(targetPath);
      return {
        targetFolder,
        targetPath,
        collisionIndex,
      };
    }

    collisionIndex += 1;
  }

  return null;
}

async function moveFileWithoutOverwrite(sourcePath, targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });

  try {
    await fs.link(sourcePath, targetPath);
    await fs.unlink(sourcePath);
    return 'linked';
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw error;
    }

    if (!['EXDEV', 'EPERM', 'ENOTSUP', 'EACCES'].includes(error?.code)) {
      throw error;
    }
  }

  await fs.copyFile(sourcePath, targetPath, fsConstants.COPYFILE_EXCL);
  await fs.unlink(sourcePath);
  return 'copied';
}

async function getIndexedDocumentsOrganizerFileForImport({
  userId,
  fileId,
  environment = process.env,
} = {}) {
  const normalizedFileId = String(fileId || '').trim();
  if (!normalizedFileId) {
    throw new DocumentsOrganizerUserError('A local organizer file id is required.');
  }

  const objectIdIsValid = DocumentsOrganizerFile.db.base.Types.ObjectId.isValid(normalizedFileId);
  let file = objectIdIsValid
    ? await DocumentsOrganizerFile.findOne({ _id: normalizedFileId, userId, status: 'indexed' }).lean()
    : null;

  if (!file) {
    file = await DocumentsOrganizerFile.findOne({ pathHash: normalizedFileId, userId, status: 'indexed' }).lean();
  }

  if (!file) {
    throw new DocumentsOrganizerUserError('Indexed local file was not found.', 404);
  }

  const sourcePath = file.sourcePath ? path.resolve(file.sourcePath) : '';
  if (!sourcePath || !isOrganizerRootAllowed(sourcePath, environment)) {
    throw new DocumentsOrganizerUserError('Indexed local file is outside allowed organizer roots.', 403);
  }

  const allowedRoots = [
    ...getDocumentsOrganizerRoots(environment),
    getDocumentsOrganizerPhysicalRoot(environment),
  ].filter(Boolean);

  if (allowedRoots.length > 0 && !isPathInsideAny(allowedRoots, sourcePath)) {
    throw new DocumentsOrganizerUserError('Indexed local file is outside the current organizer roots.', 403);
  }

  let stats = null;
  try {
    stats = await fs.lstat(sourcePath);
  } catch (_error) {
    await DocumentsOrganizerFile.updateOne(
      { _id: file._id, userId },
      { $set: { status: 'missing', lastSeenAt: new Date() } },
    );
    throw new DocumentsOrganizerUserError('Indexed local file is no longer available.', 404);
  }

  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new DocumentsOrganizerUserError('Indexed local path is not a regular file.');
  }

  const maxBytes = getDocumentsOrganizerImportMaxBytes(environment.DOCUMENTS_ORGANIZER_IMPORT_MAX_BYTES);
  if (stats.size > maxBytes) {
    throw new DocumentsOrganizerUserError('Indexed local file is too large for Docling import.', 413);
  }

  return { file, sourcePath, stats };
}

async function convertDocumentsOrganizerFileWithDocling({
  sourcePath,
  file,
  stats,
  environment = process.env,
  exports: requestedExports,
  enrichments,
  httpClient = axios,
} = {}) {
  const doclingImportUrl = getDocumentsOrganizerDoclingImportUrl(environment);
  const exports = normalizeDocumentsOrganizerDoclingCsv(
    requestedExports || environment.DOCUMENTS_ORGANIZER_DOCLING_EXPORTS,
    DEFAULT_DOCUMENTS_ORGANIZER_DOCLING_EXPORTS,
  );
  const enrich = normalizeDocumentsOrganizerDoclingCsv(
    enrichments || environment.DOCUMENTS_ORGANIZER_DOCLING_ENRICHMENTS,
    [],
  );
  const params = new URLSearchParams({
    exports: exports.join(','),
    assets: 'true',
    audio: 'true',
  });

  if (enrich.length > 0) {
    params.set('enrich', enrich.join(','));
  }

  const form = new FormData();
  form.append('file', createReadStream(sourcePath), {
    filename: file.filename || path.basename(sourcePath),
    knownLength: stats?.size,
  });

  try {
    const response = await httpClient.post(`${doclingImportUrl}?${params.toString()}`, form, {
      headers: form.getHeaders(),
      maxBodyLength: getDocumentsOrganizerImportMaxBytes(environment.DOCUMENTS_ORGANIZER_IMPORT_MAX_BYTES),
      maxContentLength: getDocumentsOrganizerImportMaxBytes(environment.DOCUMENTS_ORGANIZER_IMPORT_MAX_BYTES),
      timeout: asPositiveInteger(environment.DOCUMENTS_ORGANIZER_DOCLING_TIMEOUT_MS, 10 * 60 * 1000, 60 * 60 * 1000),
    });

    return response.data || {};
  } catch (error) {
    throw new Error(
      logAxiosError({
        message: `Docling import failed for indexed local file ${file.filename || sourcePath}: ${error.message}`,
        error,
      }),
    );
  }
}

async function importDocumentsOrganizerFileWithDocling({
  userId,
  fileId,
  environment = process.env,
  exports: requestedExports,
  enrichments,
  convertWithDocling = convertDocumentsOrganizerFileWithDocling,
} = {}) {
  const { file, sourcePath, stats } = await getIndexedDocumentsOrganizerFileForImport({
    userId,
    fileId,
    environment,
  });

  const docling = await convertWithDocling({
    sourcePath,
    file,
    stats,
    environment,
    exports: requestedExports,
    enrichments,
  });
  const serializedFile = serializeDocumentsOrganizerFile(file);

  return {
    type: 'documents_organizer_docling_import',
    storage: 'filesystem+mongodb+docling',
    source_file: serializedFile,
    docling,
    content_indexed: false,
    physical_moves_performed: serializedFile?.physical_move_performed === true,
    safeguards: [
      'The organizer lookup uses the authenticated user id and an indexed file id.',
      'The file must still live inside configured organizer roots.',
      'The file is streamed to the local Docling converter and is not embedded in the organizer MongoDB record.',
    ],
    message: `Converted ${file.filename || path.basename(sourcePath)} with Docling.`,
  };
}

function normalizeDocumentsOrganizerImportFileIds(fileIds, maxFiles = DEFAULT_DOCUMENTS_ORGANIZER_IMPORT_RUN_MAX_FILES) {
  return (Array.isArray(fileIds) ? fileIds : [])
    .map((fileId) => String(fileId || '').trim())
    .filter((fileId, index, ids) => fileId && ids.indexOf(fileId) === index)
    .slice(0, maxFiles);
}

async function getIndexedDocumentsOrganizerFilesForIds({
  userId,
  fileIds,
  maxFiles = DEFAULT_DOCUMENTS_ORGANIZER_IMPORT_RUN_MAX_FILES,
} = {}) {
  const normalizedFileIds = normalizeDocumentsOrganizerImportFileIds(fileIds, maxFiles);
  const objectIds = normalizedFileIds
    .filter((fileId) => DocumentsOrganizerFile.db.base.Types.ObjectId.isValid(fileId));
  const query = {
    userId,
    status: 'indexed',
    $or: [
      ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : []),
      { pathHash: { $in: normalizedFileIds } },
    ],
  };
  const files = normalizedFileIds.length > 0
    ? await DocumentsOrganizerFile.find(query).lean()
    : [];
  const filesById = new Map();

  for (const file of files) {
    filesById.set(String(file._id), file);
    if (file.pathHash) {
      filesById.set(file.pathHash, file);
    }
  }

  return {
    normalizedFileIds,
    files,
    orderedFiles: normalizedFileIds
      .map((fileId) => filesById.get(fileId))
      .filter(Boolean),
  };
}

function summarizeDocumentsOrganizerImportSources(files) {
  const sources = new Map();

  for (const file of files) {
    const sourceRoot = file.sourceRoot || file.source_root || '';
    if (!sourceRoot) {
      continue;
    }

    const current = sources.get(sourceRoot) || {
      source_root: sourceRoot,
      source_display_root: toDisplayPath(sourceRoot),
      count: 0,
      total_size_bytes: 0,
      latest_modified_at: null,
    };
    const sizeBytes = Number(file.sizeBytes ?? file.size_bytes) || 0;
    const modifiedAt = file.modifiedAt || file.modified_at || null;

    current.count += 1;
    current.total_size_bytes += sizeBytes;

    if (modifiedAt && (!current.latest_modified_at || new Date(modifiedAt) > new Date(current.latest_modified_at))) {
      current.latest_modified_at = modifiedAt?.toISOString?.() || modifiedAt;
    }

    sources.set(sourceRoot, current);
  }

  return Array.from(sources.values()).sort((left, right) => (
    right.count - left.count || left.source_display_root.localeCompare(right.source_display_root)
  ));
}

async function previewDocumentsOrganizerImport({
  userId,
  fileIds,
  environment = process.env,
} = {}) {
  const { normalizedFileIds, orderedFiles } = await getIndexedDocumentsOrganizerFilesForIds({
    userId,
    fileIds,
  });

  if (normalizedFileIds.length === 0) {
    throw new DocumentsOrganizerUserError('At least one indexed local file id is required.');
  }

  if (orderedFiles.length === 0) {
    throw new DocumentsOrganizerUserError('No indexed local files were found for import preview.', 404);
  }

  const serializedFiles = orderedFiles.map(serializeDocumentsOrganizerFile).filter(Boolean);
  const maxFileSizeBytes = getDocumentsOrganizerImportMaxBytes(environment.DOCUMENTS_ORGANIZER_IMPORT_MAX_BYTES);
  const oversizedFiles = serializedFiles.filter((file) => file.size_bytes > maxFileSizeBytes);
  const folderSummary = summarizeDocumentsOrganizerFolders(orderedFiles);
  const conversionExports = normalizeDocumentsOrganizerDoclingCsv(
    environment.DOCUMENTS_ORGANIZER_DOCLING_EXPORTS,
    DEFAULT_DOCUMENTS_ORGANIZER_DOCLING_EXPORTS,
  );

  return {
    type: 'documents_organizer_import_preview',
    storage: 'mongodb',
    requested_count: normalizedFileIds.length,
    preview_file_count: serializedFiles.length,
    missing_file_count: Math.max(0, normalizedFileIds.length - serializedFiles.length),
    total_size_bytes: folderSummary.totalSizeBytes,
    max_file_size_bytes: maxFileSizeBytes,
    oversized_file_count: oversizedFiles.length,
    estimated_docling_file_count: Math.max(0, serializedFiles.length - oversizedFiles.length),
    conversion_provider: 'docling',
    conversion_exports: conversionExports,
    requires_confirmation_phrase: 'IMPORT FILES',
    content_indexed: false,
    physical_moves_performed: false,
    folders: folderSummary.folders,
    source_roots: summarizeDocumentsOrganizerImportSources(orderedFiles),
    files: serializedFiles.slice(0, 12),
    file_sample_count: Math.min(serializedFiles.length, 12),
    oversized_files: oversizedFiles.slice(0, 6),
    safeguards: [
      'The preview is built from MongoDB file metadata only.',
      'No local file body is read during import preview.',
      'Docling conversion starts only after the explicit IMPORT FILES confirmation.',
    ],
    message: `Previewed ${serializedFiles.length.toLocaleString()} indexed local files for Docling import.`,
  };
}

async function createDocumentsOrganizerImportRun({
  userId,
  fileIds,
  environment = process.env,
  now = new Date(),
} = {}) {
  const { normalizedFileIds, orderedFiles } = await getIndexedDocumentsOrganizerFilesForIds({
    userId,
    fileIds,
  });

  if (normalizedFileIds.length === 0) {
    throw new DocumentsOrganizerUserError('At least one indexed local file id is required.');
  }

  const normalizedNow = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const maxFileSizeBytes = getDocumentsOrganizerImportMaxBytes(environment.DOCUMENTS_ORGANIZER_IMPORT_MAX_BYTES);
  const items = orderedFiles.map((file) => ({
      fileId: String(file._id || ''),
      pathHash: file.pathHash || '',
      filename: file.filename || '',
      displayPath: file.displayPath || '',
      folderKey: file.folderKey || 'documents',
      folderName: file.folderName || 'Documents',
      documentType: file.documentType || 'document',
      sizeBytes: file.sizeBytes || 0,
      status: Number(file.sizeBytes || 0) > maxFileSizeBytes ? 'skipped' : 'pending',
      documentId: '',
      title: '',
      error: Number(file.sizeBytes || 0) > maxFileSizeBytes
        ? `Skipped before Docling import because the file exceeds ${maxFileSizeBytes.toLocaleString()} bytes.`
        : '',
      startedAt: Number(file.sizeBytes || 0) > maxFileSizeBytes ? normalizedNow : null,
      completedAt: Number(file.sizeBytes || 0) > maxFileSizeBytes ? normalizedNow : null,
  }));

  if (items.length === 0) {
    throw new DocumentsOrganizerUserError('No indexed local files were found for import.', 404);
  }

  const counts = countDocumentsOrganizerImportRunItems(items);
  const runStatus = inferDocumentsOrganizerImportRunStatus({ items });
  const run = await DocumentsOrganizerImportRun.create({
    userId,
    status: runStatus,
    requestedCount: items.length,
    importedCount: counts.importedCount,
    failedCount: counts.failedCount,
    skippedCount: counts.skippedCount,
    source: 'documents-organizer',
    startedAt: normalizedNow,
    completedAt: runStatus === 'running' ? null : normalizedNow,
    items,
  });

  return {
    type: 'documents_organizer_import_run_created',
    storage: 'mongodb',
    run: serializeDocumentsOrganizerImportRun(run.toObject()),
    content_indexed: false,
    message: `Prepared ${items.length.toLocaleString()} indexed local files for Docling import.`,
  };
}

async function updateDocumentsOrganizerImportRunItem({
  userId,
  runId,
  fileId,
  status,
  documentId,
  title,
  error,
  now = new Date(),
} = {}) {
  const normalizedRunId = String(runId || '').trim();
  const normalizedFileId = String(fileId || '').trim();
  const normalizedStatus = String(status || '').trim();
  const allowedStatuses = new Set(['pending', 'importing', 'imported', 'failed', 'skipped']);

  if (!normalizedRunId || !DocumentsOrganizerImportRun.db.base.Types.ObjectId.isValid(normalizedRunId)) {
    throw new DocumentsOrganizerUserError('A valid import run id is required.');
  }

  if (!normalizedFileId) {
    throw new DocumentsOrganizerUserError('An import run file id is required.');
  }

  if (!allowedStatuses.has(normalizedStatus)) {
    throw new DocumentsOrganizerUserError('A valid import item status is required.');
  }

  const run = await DocumentsOrganizerImportRun.findOne({ _id: normalizedRunId, userId });
  if (!run) {
    throw new DocumentsOrganizerUserError('Import run was not found.', 404);
  }

  const item = run.items.find((candidate) => (
    candidate.fileId === normalizedFileId ||
    candidate.pathHash === normalizedFileId
  ));
  if (!item) {
    throw new DocumentsOrganizerUserError('Import run item was not found.', 404);
  }

  const normalizedNow = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  item.status = normalizedStatus;
  if (normalizedStatus === 'pending' || normalizedStatus === 'importing') {
    item.completedAt = null;
    item.error = '';
    if (normalizedStatus === 'pending') {
      item.startedAt = null;
    }
    run.completedAt = null;
  }
  if (normalizedStatus === 'importing' && !item.startedAt) {
    item.startedAt = normalizedNow;
  }
  if (normalizedStatus === 'imported' || normalizedStatus === 'failed' || normalizedStatus === 'skipped') {
    if (!item.startedAt) {
      item.startedAt = normalizedNow;
    }
    item.completedAt = normalizedNow;
  }
  item.documentId = String(documentId || item.documentId || '');
  item.title = String(title || item.title || '').slice(0, 240);
  if (normalizedStatus === 'failed') {
    item.error = String(error || '').slice(0, 1000);
  }

  const counts = countDocumentsOrganizerImportRunItems(run.items);
  run.importedCount = counts.importedCount;
  run.failedCount = counts.failedCount;
  run.skippedCount = counts.skippedCount;
  run.status = inferDocumentsOrganizerImportRunStatus({ items: run.items });

  await run.save();

  return {
    type: 'documents_organizer_import_run_item_updated',
    storage: 'mongodb',
    run: serializeDocumentsOrganizerImportRun(run.toObject()),
    content_indexed: false,
    message: `Marked ${item.filename} as ${normalizedStatus}.`,
  };
}

async function completeDocumentsOrganizerImportRun({
  userId,
  runId,
  status,
  now = new Date(),
} = {}) {
  const normalizedRunId = String(runId || '').trim();
  const normalizedStatus = String(status || '').trim();
  const allowedStatuses = new Set(['completed', 'completed_with_errors', 'failed', 'cancelled']);

  if (!normalizedRunId || !DocumentsOrganizerImportRun.db.base.Types.ObjectId.isValid(normalizedRunId)) {
    throw new DocumentsOrganizerUserError('A valid import run id is required.');
  }

  if (normalizedStatus && !allowedStatuses.has(normalizedStatus)) {
    throw new DocumentsOrganizerUserError('A valid import run status is required.');
  }

  const run = await DocumentsOrganizerImportRun.findOne({ _id: normalizedRunId, userId });
  if (!run) {
    throw new DocumentsOrganizerUserError('Import run was not found.', 404);
  }

  const normalizedNow = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const counts = countDocumentsOrganizerImportRunItems(run.items);
  run.importedCount = counts.importedCount;
  run.failedCount = counts.failedCount;
  run.skippedCount = counts.skippedCount;
  run.completedAt = normalizedNow;
  run.status = normalizedStatus || inferDocumentsOrganizerImportRunStatus({
    items: run.items,
    completedAt: normalizedNow,
  });

  await run.save();

  return {
    type: 'documents_organizer_import_run_completed',
    storage: 'mongodb',
    run: serializeDocumentsOrganizerImportRun(run.toObject()),
    content_indexed: false,
    message: createDocumentsOrganizerImportRunMessage(run),
  };
}

async function getDocumentsOrganizerImportRuns({
  userId,
  limit = DEFAULT_DOCUMENTS_ORGANIZER_IMPORT_RUN_LIMIT,
} = {}) {
  const normalizedLimit = asPositiveInteger(limit, DEFAULT_DOCUMENTS_ORGANIZER_IMPORT_RUN_LIMIT, 50);
  const runs = await DocumentsOrganizerImportRun.find({ userId })
    .sort({ startedAt: -1, createdAt: -1 })
    .limit(normalizedLimit)
    .lean();

  return {
    type: 'documents_organizer_import_runs',
    storage: 'mongodb',
    limit: normalizedLimit,
    total_count: await DocumentsOrganizerImportRun.countDocuments({ userId }),
    returned_count: runs.length,
    runs: runs.map(serializeDocumentsOrganizerImportRun).filter(Boolean),
    content_indexed: false,
    message: runs.length > 0
      ? `Loaded ${runs.length.toLocaleString()} recent Docling import runs.`
      : 'No organizer Docling import runs have been recorded yet.',
  };
}

async function getDocumentsOrganizerSavedViews({
  userId,
  limit = DEFAULT_DOCUMENTS_ORGANIZER_SAVED_VIEW_LIMIT,
} = {}) {
  const normalizedLimit = asPositiveInteger(limit, DEFAULT_DOCUMENTS_ORGANIZER_SAVED_VIEW_LIMIT, 50);
  const views = await DocumentsOrganizerSavedView.find({ userId })
    .sort({ lastOpenedAt: -1, updatedAt: -1, createdAt: -1 })
    .limit(normalizedLimit)
    .lean();
  const serializedViews = await Promise.all(
    views.map((view) => serializeDocumentsOrganizerSavedViewWithStats(view)),
  );

  return {
    type: 'documents_organizer_saved_views',
    storage: 'mongodb',
    limit: normalizedLimit,
    total_count: await DocumentsOrganizerSavedView.countDocuments({ userId }),
    returned_count: views.length,
    views: serializedViews.filter(Boolean),
    content_indexed: false,
    message: views.length > 0
      ? `Loaded ${views.length.toLocaleString()} saved organizer views.`
      : 'No organizer views have been saved yet.',
  };
}

async function createDocumentsOrganizerSavedView({
  userId,
  name,
  folderKey = 'all',
  folderName = 'All local files',
  sourceRoot = '',
  searchQuery = '',
  sortBy = DOCUMENTS_ORGANIZER_DEFAULT_FILE_SORT,
  now = new Date(),
} = {}) {
  const normalizedFolderKey = sanitizeDocumentsOrganizerFolderKey(folderKey);
  const normalizedSourceRoot = normalizeDocumentsOrganizerSourceRoot(sourceRoot);
  const normalizedSearchQuery = normalizeDocumentsOrganizerSearchQuery(searchQuery);
  const normalizedSortBy = normalizeDocumentsOrganizerFileSort(sortBy);
  const normalizedFolderName = sanitizeDocumentsOrganizerFolderName(
    folderName || (normalizedFolderKey === 'all' ? 'All local files' : normalizedFolderKey),
  );
  const normalizedName = createDocumentsOrganizerSavedViewName({
    name,
    folderName: normalizedFolderName,
    folderKey: normalizedFolderKey,
    searchQuery: normalizedSearchQuery,
    sourceRoot: normalizedSourceRoot,
  });
  const viewKey = createDocumentsOrganizerSavedViewKey(
    normalizedFolderKey,
    normalizedSearchQuery,
    normalizedSortBy,
    normalizedSourceRoot,
  );
  const normalizedNow = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();

  const view = await DocumentsOrganizerSavedView.findOneAndUpdate(
    { userId, viewKey },
    {
      $set: {
        name: normalizedName,
        folderKey: normalizedFolderKey,
        folderName: normalizedFolderName,
        sourceRoot: normalizedSourceRoot,
        searchQuery: normalizedSearchQuery,
        sortBy: normalizedSortBy,
        lastOpenedAt: normalizedNow,
      },
      $setOnInsert: {
        userId,
        viewKey,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  ).lean();

  return {
    type: 'documents_organizer_saved_view_saved',
    storage: 'mongodb',
    view: await serializeDocumentsOrganizerSavedViewWithStats(view),
    content_indexed: false,
    message: `Saved organizer view "${normalizedName}".`,
  };
}

async function openDocumentsOrganizerSavedView({
  userId,
  viewId,
  now = new Date(),
} = {}) {
  const normalizedViewId = String(viewId || '').trim();
  if (!normalizedViewId || !DocumentsOrganizerSavedView.db.base.Types.ObjectId.isValid(normalizedViewId)) {
    throw new DocumentsOrganizerUserError('A valid saved view id is required.');
  }

  const normalizedNow = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const view = await DocumentsOrganizerSavedView.findOneAndUpdate(
    { _id: normalizedViewId, userId },
    { $set: { lastOpenedAt: normalizedNow } },
    { new: true },
  ).lean();

  if (!view) {
    throw new DocumentsOrganizerUserError('Saved organizer view was not found.', 404);
  }

  return {
    type: 'documents_organizer_saved_view_opened',
    storage: 'mongodb',
    view: await serializeDocumentsOrganizerSavedViewWithStats(view),
    content_indexed: false,
    message: `Opened organizer view "${view.name}".`,
  };
}

async function deleteDocumentsOrganizerSavedView({
  userId,
  viewId,
} = {}) {
  const normalizedViewId = String(viewId || '').trim();
  if (!normalizedViewId || !DocumentsOrganizerSavedView.db.base.Types.ObjectId.isValid(normalizedViewId)) {
    throw new DocumentsOrganizerUserError('A valid saved view id is required.');
  }

  const deleted = await DocumentsOrganizerSavedView.findOneAndDelete({
    _id: normalizedViewId,
    userId,
  }).lean();

  if (!deleted) {
    throw new DocumentsOrganizerUserError('Saved organizer view was not found.', 404);
  }

  return {
    type: 'documents_organizer_saved_view_deleted',
    storage: 'mongodb',
    view: await serializeDocumentsOrganizerSavedViewWithStats(deleted),
    content_indexed: false,
    message: `Deleted organizer view "${deleted.name}".`,
  };
}

function serializeDocumentsOrganizerFile(file) {
  if (!file) {
    return null;
  }

  return {
    id: String(file._id || file.id || ''),
    type: 'documents_organizer_file',
    user_id: file.userId || file.user_id || '',
    scan_id: file.scanId || file.scan_id || '',
    path_hash: file.pathHash || file.path_hash || '',
    source_root: file.sourceRoot || file.source_root || '',
    source_path: file.sourcePath || file.source_path || '',
    display_path: file.displayPath || file.display_path || '',
    relative_path: file.relativePath || file.relative_path || '',
    filename: file.filename || '',
    basename: file.basename || '',
    extension: file.extension || '',
    document_type: file.documentType || file.document_type || '',
    folder_key: file.folderKey || file.folder_key || '',
    folder_name: file.folderName || file.folder_name || '',
    size_bytes: asPositiveInteger(file.sizeBytes ?? file.size_bytes, 0),
    modified_at: file.modifiedAt?.toISOString?.() || file.modifiedAt || file.modified_at || null,
    created_on_disk_at: file.createdOnDiskAt?.toISOString?.() || file.createdOnDiskAt || file.created_on_disk_at || null,
    discovered_at: file.discoveredAt?.toISOString?.() || file.discoveredAt || file.discovered_at || null,
    last_seen_at: file.lastSeenAt?.toISOString?.() || file.lastSeenAt || file.last_seen_at || null,
    status: file.status || 'indexed',
    content_indexed: file.contentIndexed === true || file.content_indexed === true,
    physical_move_performed: file.physicalMovePerformed === true || file.physical_move_performed === true,
  };
}

function serializeDocumentsOrganizerSavedView(view) {
  if (!view) {
    return null;
  }

  return {
    id: String(view._id || view.id || ''),
    type: 'documents_organizer_saved_view',
    storage: 'mongodb',
    user_id: view.userId || view.user_id || '',
    name: view.name || '',
    folder_key: view.folderKey || view.folder_key || 'all',
    folder_name: view.folderName || view.folder_name || 'All local files',
    source_root: view.sourceRoot || view.source_root || '',
    source_display_root: view.sourceRoot || view.source_root
      ? toDisplayPath(view.sourceRoot || view.source_root)
      : '',
    search_query: view.searchQuery || view.search_query || '',
    sort_by: normalizeDocumentsOrganizerFileSort(view.sortBy || view.sort_by),
    view_key: view.viewKey || view.view_key || '',
    last_opened_at: view.lastOpenedAt?.toISOString?.() || view.lastOpenedAt || view.last_opened_at || null,
    created_at: view.createdAt?.toISOString?.() || view.createdAt || view.created_at || null,
    updated_at: view.updatedAt?.toISOString?.() || view.updatedAt || view.updated_at || null,
    content_indexed: false,
  };
}

async function getDocumentsOrganizerSavedViewStats(view) {
  if (!view) {
    return {
      matched_file_count: 0,
      matched_size_bytes: 0,
      latest_modified_at: null,
    };
  }

  const userId = view.userId || view.user_id;
  if (!userId) {
    return {
      matched_file_count: 0,
      matched_size_bytes: 0,
      latest_modified_at: null,
    };
  }

  const { match } = createDocumentsOrganizerFileMatch({
    userId,
    folderKey: view.folderKey || view.folder_key,
    sourceRoot: view.sourceRoot || view.source_root,
    searchQuery: view.searchQuery || view.search_query,
  });
  const [stats] = await DocumentsOrganizerFile.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        matchedFileCount: { $sum: 1 },
        matchedSizeBytes: { $sum: '$sizeBytes' },
        latestModifiedAt: { $max: '$modifiedAt' },
      },
    },
  ]);

  return {
    matched_file_count: stats?.matchedFileCount || 0,
    matched_size_bytes: stats?.matchedSizeBytes || 0,
    latest_modified_at: stats?.latestModifiedAt?.toISOString?.() || stats?.latestModifiedAt || null,
  };
}

async function serializeDocumentsOrganizerSavedViewWithStats(view) {
  const serializedView = serializeDocumentsOrganizerSavedView(view);
  if (!serializedView) {
    return null;
  }

  const stats = await getDocumentsOrganizerSavedViewStats(view);

  return {
    ...serializedView,
    ...stats,
  };
}

function serializeDocumentsOrganizerImportRunItem(item) {
  if (!item) {
    return null;
  }

  return {
    file_id: String(item.fileId || item.file_id || ''),
    path_hash: item.pathHash || item.path_hash || '',
    filename: item.filename || '',
    display_path: item.displayPath || item.display_path || '',
    folder_key: item.folderKey || item.folder_key || 'documents',
    folder_name: item.folderName || item.folder_name || 'Documents',
    document_type: item.documentType || item.document_type || 'document',
    size_bytes: asPositiveInteger(item.sizeBytes ?? item.size_bytes, 0),
    status: item.status || 'pending',
    document_id: item.documentId || item.document_id || '',
    title: item.title || '',
    error: item.error || '',
    started_at: item.startedAt?.toISOString?.() || item.startedAt || item.started_at || null,
    completed_at: item.completedAt?.toISOString?.() || item.completedAt || item.completed_at || null,
  };
}

function serializeDocumentsOrganizerImportRun(run) {
  if (!run) {
    return null;
  }

  const items = Array.isArray(run.items) ? run.items : [];

  return {
    id: String(run._id || run.id || ''),
    type: 'documents_organizer_import_run',
    storage: 'mongodb',
    user_id: run.userId || run.user_id || '',
    status: run.status || 'pending',
    requested_count: asPositiveInteger(run.requestedCount ?? run.requested_count, items.length),
    imported_count: asPositiveInteger(run.importedCount ?? run.imported_count, 0),
    failed_count: asPositiveInteger(run.failedCount ?? run.failed_count, 0),
    skipped_count: asPositiveInteger(run.skippedCount ?? run.skipped_count, 0),
    source: run.source || 'documents-organizer',
    started_at: run.startedAt?.toISOString?.() || run.startedAt || run.started_at || null,
    completed_at: run.completedAt?.toISOString?.() || run.completedAt || run.completed_at || null,
    items: items.map(serializeDocumentsOrganizerImportRunItem).filter(Boolean),
    content_indexed: false,
    message: createDocumentsOrganizerImportRunMessage(run),
  };
}

function createDocumentsOrganizerImportRunMessage(run) {
  if (!run) {
    return 'No import run is available.';
  }

  const requestedCount = asPositiveInteger(run.requestedCount ?? run.requested_count, 0);
  const importedCount = asPositiveInteger(run.importedCount ?? run.imported_count, 0);
  const failedCount = asPositiveInteger(run.failedCount ?? run.failed_count, 0);
  const skippedCount = asPositiveInteger(run.skippedCount ?? run.skipped_count, 0);

  if (run.status === 'running') {
    if (skippedCount > 0) {
      return `Importing ${requestedCount.toLocaleString()} local files with Docling; ${skippedCount.toLocaleString()} skipped by preflight.`;
    }
    return `Importing ${requestedCount.toLocaleString()} local files with Docling.`;
  }

  if (failedCount > 0) {
    const skippedSuffix = skippedCount > 0
      ? ` and ${skippedCount.toLocaleString()} skipped`
      : '';
    return `Imported ${importedCount.toLocaleString()} of ${requestedCount.toLocaleString()} local files; ${failedCount.toLocaleString()} failed${skippedSuffix}.`;
  }

  if (importedCount > 0) {
    if (skippedCount > 0) {
      return `Imported ${importedCount.toLocaleString()} local files with Docling; ${skippedCount.toLocaleString()} skipped by preflight.`;
    }
    return `Imported ${importedCount.toLocaleString()} local files with Docling.`;
  }

  if (skippedCount > 0) {
    return `${skippedCount.toLocaleString()} local files were skipped by Docling import preflight.`;
  }

  return `Prepared ${requestedCount.toLocaleString()} local files for Docling import.`;
}

function countDocumentsOrganizerImportRunItems(items = []) {
  const counts = {
    importedCount: 0,
    failedCount: 0,
    skippedCount: 0,
  };

  for (const item of items) {
    if (item.status === 'imported') {
      counts.importedCount += 1;
    } else if (item.status === 'failed') {
      counts.failedCount += 1;
    } else if (item.status === 'skipped') {
      counts.skippedCount += 1;
    }
  }

  return counts;
}

function inferDocumentsOrganizerImportRunStatus({
  items = [],
  requestedStatus,
  completedAt,
} = {}) {
  if (requestedStatus === 'cancelled') {
    return 'cancelled';
  }

  const finishedItems = items.filter((item) => (
    item.status === 'imported' ||
    item.status === 'failed' ||
    item.status === 'skipped'
  ));

  if (finishedItems.length < items.length && !completedAt) {
    return 'running';
  }

  const failedCount = items.filter((item) => item.status === 'failed').length;
  if (failedCount > 0) {
    return 'completed_with_errors';
  }

  if (items.length > 0 && finishedItems.length === items.length) {
    return 'completed';
  }

  return requestedStatus || 'pending';
}

function serializeDocumentsOrganizerMoveAction(action) {
  if (!action) {
    return null;
  }

  return {
    file_id: String(action.fileId || action.file_id || ''),
    filename: action.filename || '',
    folder_key: action.folderKey || action.folder_key || '',
    folder_name: action.folderName || action.folder_name || '',
    source_path: action.sourcePath || action.source_path || '',
    source_display_path: action.sourceDisplayPath || action.source_display_path || '',
    target_path: action.targetPath || action.target_path || '',
    target_display_path: action.targetDisplayPath || action.target_display_path || '',
    target_folder: action.targetFolder || action.target_folder || '',
    target_display_folder: action.targetDisplayFolder || action.target_display_folder || '',
    size_bytes: asPositiveInteger(action.sizeBytes ?? action.size_bytes, 0),
    collision_index: asPositiveInteger(action.collisionIndex ?? action.collision_index, 0),
    action: action.action || 'move',
    reason: action.reason || null,
  };
}

function serializeDocumentsOrganizerMoveSkippedItem(item) {
  const file = item?.file;
  if (!file) {
    return null;
  }

  const sourcePath = path.resolve(file.sourcePath || '');

  return {
    file_id: String(file._id || file.id || ''),
    filename: file.filename || path.basename(sourcePath),
    folder_key: file.folderKey || 'documents',
    folder_name: file.folderName || 'Documents',
    document_type: file.documentType || 'document',
    source_path: sourcePath,
    source_display_path: sourcePath ? toDisplayPath(sourcePath) : '',
    size_bytes: asPositiveInteger(file.sizeBytes, 0),
    action: 'skip',
    reason: item.reason || 'skipped',
  };
}

function summarizeDocumentsOrganizerMoveSkipReasons(skipped = []) {
  const reasons = new Map();

  for (const item of skipped) {
    const reason = item?.reason || 'skipped';
    const current = reasons.get(reason) || {
      reason,
      count: 0,
      total_size_bytes: 0,
    };
    current.count += 1;
    current.total_size_bytes += asPositiveInteger(item?.file?.sizeBytes, 0);
    reasons.set(reason, current);
  }

  return Array.from(reasons.values()).sort((left, right) => (
    right.count - left.count || left.reason.localeCompare(right.reason)
  ));
}

function createCaseInsensitiveContainsRegex(value) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return null;
  }

  return new RegExp(normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

async function collectDocumentsOrganizerFiles({
  root,
  userId,
  scanId,
  now,
  maxDepth,
  remaining,
}) {
  const discovered = [];

  async function walk(directory, depth) {
    if (remaining.count <= 0 || depth > maxDepth) {
      return;
    }

    let entries = [];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      logger.debug('[DocumentsOrganizer] Skipping unreadable directory', {
        directory,
        message: error.message,
      });
      return;
    }

    for (const entry of entries) {
      if (remaining.count <= 0) {
        break;
      }

      const sourcePath = path.join(directory, entry.name);

      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        if (!shouldSkipDirectory(entry)) {
          await walk(sourcePath, depth + 1);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (shouldSkipFile(entry)) {
        continue;
      }

      const classification = classifyDocumentsOrganizerFile(entry.name);
      if (!classification) {
        continue;
      }

      let stats = null;
      try {
        stats = await fs.stat(sourcePath);
      } catch (_error) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      discovered.push({
        userId,
        scanId,
        pathHash: createDocumentsOrganizerPathHash(userId, sourcePath),
        sourceRoot: root,
        sourcePath,
        displayPath: toDisplayPath(sourcePath),
        relativePath: path.relative(root, sourcePath),
        filename: entry.name,
        basename: path.basename(entry.name, extension),
        extension,
        documentType: classification.documentType,
        folderKey: classification.folderKey,
        folderName: classification.folderName,
        sizeBytes: stats.size || 0,
        modifiedAt: stats.mtime || null,
        createdOnDiskAt: stats.birthtime || null,
        discoveredAt: now,
        lastSeenAt: now,
        status: 'indexed',
        contentIndexed: false,
        physicalMovePerformed: false,
      });
      remaining.count -= 1;
    }
  }

  await walk(root, 0);
  return discovered;
}

function summarizeDocumentsOrganizerFolders(files) {
  const folders = new Map();
  let totalSizeBytes = 0;

  for (const file of files) {
    const folderKey = file.folderKey || file.folder_key;
    const current = folders.get(folderKey) || {
      folder_key: folderKey,
      folder_name: file.folderName || file.folder_name,
      document_type: file.documentType || file.document_type,
      count: 0,
      total_size_bytes: 0,
      latest_modified_at: null,
    };
    const sizeBytes = Number(file.sizeBytes ?? file.size_bytes) || 0;
    const modifiedAt = file.modifiedAt || file.modified_at || null;

    current.count += 1;
    current.total_size_bytes += sizeBytes;
    totalSizeBytes += sizeBytes;

    if (modifiedAt && (!current.latest_modified_at || new Date(modifiedAt) > new Date(current.latest_modified_at))) {
      current.latest_modified_at = modifiedAt?.toISOString?.() || modifiedAt;
    }

    folders.set(folderKey, current);
  }

  return {
    folders: Array.from(folders.values()).sort((left, right) => (
      right.count - left.count || left.folder_name.localeCompare(right.folder_name)
    )),
    totalSizeBytes,
  };
}

async function getDocumentsOrganizerSummary({
  userId,
  environment = process.env,
  limit = 12,
} = {}) {
  const normalizedLimit = asPositiveInteger(limit, 12, 50);
  const roots = getDocumentsOrganizerRoots(environment);
  const folderRows = await DocumentsOrganizerFile.aggregate([
    { $match: { userId, status: 'indexed' } },
    {
      $group: {
        _id: {
          folderKey: '$folderKey',
          folderName: '$folderName',
          documentType: '$documentType',
        },
        count: { $sum: 1 },
        totalSizeBytes: { $sum: '$sizeBytes' },
        latestModifiedAt: { $max: '$modifiedAt' },
      },
    },
    { $sort: { count: -1, '_id.folderName': 1 } },
  ]);
  const stats = await DocumentsOrganizerFile.aggregate([
    { $match: { userId, status: 'indexed' } },
    {
      $group: {
        _id: null,
        scannedFileCount: { $sum: 1 },
        totalSizeBytes: { $sum: '$sizeBytes' },
        latestScanAt: { $max: '$lastSeenAt' },
      },
    },
  ]);
  const recentFiles = await DocumentsOrganizerFile.find({ userId, status: 'indexed' })
    .sort({ modifiedAt: -1, lastSeenAt: -1 })
    .limit(normalizedLimit)
    .lean();
  const missingCount = await DocumentsOrganizerFile.countDocuments({ userId, status: 'missing' });
  const movedCount = await DocumentsOrganizerFile.countDocuments({
    userId,
    status: 'indexed',
    physicalMovePerformed: true,
  });

  return {
    type: 'documents_organizer_summary',
    storage: 'mongodb',
    roots,
    content_indexed: false,
    physical_moves_performed: movedCount > 0,
    moved_file_count: movedCount,
    scanned_file_count: stats[0]?.scannedFileCount || 0,
    missing_file_count: missingCount,
    folder_count: folderRows.length,
    total_size_bytes: stats[0]?.totalSizeBytes || 0,
    latest_scan_at: stats[0]?.latestScanAt?.toISOString?.() || stats[0]?.latestScanAt || null,
    folders: folderRows.map((row) => ({
      folder_key: row._id.folderKey,
      folder_name: row._id.folderName,
      document_type: row._id.documentType,
      count: row.count,
      total_size_bytes: row.totalSizeBytes || 0,
      latest_modified_at: row.latestModifiedAt?.toISOString?.() || row.latestModifiedAt || null,
    })),
    recent_files: recentFiles.map(serializeDocumentsOrganizerFile).filter(Boolean),
    safeguards: [
      'Only file metadata is indexed: path, name, extension, size, and timestamps.',
      'Document body content is not read or embedded.',
      'Physical file moves require the in-app MOVE FILES confirmation.',
      'Folder assignments are virtual records in MongoDB for the Documents UI.',
    ],
    message: stats[0]?.scannedFileCount > 0
      ? 'Local document metadata is organized into virtual folders.'
      : 'No local document metadata has been indexed yet.',
  };
}

function serializeDocumentsOrganizerCollectionFolder(folder) {
  if (!folder) {
    return null;
  }

  return {
    folder_key: folder.folderKey || folder.folder_key || '',
    folder_name: folder.folderName || folder.folder_name || 'Documents',
    document_type: folder.documentType || folder.document_type || 'document',
    count: asPositiveInteger(folder.count, 0),
    total_size_bytes: asPositiveInteger(folder.totalSizeBytes ?? folder.total_size_bytes, 0),
    latest_modified_at: folder.latestModifiedAt?.toISOString?.() || folder.latestModifiedAt || folder.latest_modified_at || null,
  };
}

async function getDocumentsOrganizerCollections({
  userId,
  environment = process.env,
  limit = DEFAULT_DOCUMENTS_ORGANIZER_COLLECTION_LIMIT,
} = {}) {
  const normalizedLimit = asPositiveInteger(limit, DEFAULT_DOCUMENTS_ORGANIZER_COLLECTION_LIMIT, 24);
  const match = { userId, status: 'indexed' };
  const [rootRows, rootFolderRows, documentTypeRows, stats] = await Promise.all([
    DocumentsOrganizerFile.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$sourceRoot',
          count: { $sum: 1 },
          totalSizeBytes: { $sum: '$sizeBytes' },
          latestModifiedAt: { $max: '$modifiedAt' },
          folderKeys: { $addToSet: '$folderKey' },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      { $limit: normalizedLimit },
    ]),
    DocumentsOrganizerFile.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            sourceRoot: '$sourceRoot',
            folderKey: '$folderKey',
            folderName: '$folderName',
            documentType: '$documentType',
          },
          count: { $sum: 1 },
          totalSizeBytes: { $sum: '$sizeBytes' },
          latestModifiedAt: { $max: '$modifiedAt' },
        },
      },
      { $sort: { '_id.sourceRoot': 1, count: -1, '_id.folderName': 1 } },
    ]),
    DocumentsOrganizerFile.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            folderKey: '$folderKey',
            folderName: '$folderName',
            documentType: '$documentType',
          },
          count: { $sum: 1 },
          totalSizeBytes: { $sum: '$sizeBytes' },
          latestModifiedAt: { $max: '$modifiedAt' },
          sourceRoots: { $addToSet: '$sourceRoot' },
        },
      },
      { $sort: { count: -1, '_id.folderName': 1 } },
      { $limit: normalizedLimit },
    ]),
    DocumentsOrganizerFile.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          scannedFileCount: { $sum: 1 },
          totalSizeBytes: { $sum: '$sizeBytes' },
          latestScanAt: { $max: '$lastSeenAt' },
          sourceRoots: { $addToSet: '$sourceRoot' },
        },
      },
    ]),
  ]);

  const foldersByRoot = new Map();
  for (const row of rootFolderRows) {
    const sourceRoot = row?._id?.sourceRoot || '';
    const folders = foldersByRoot.get(sourceRoot) || [];
    folders.push(serializeDocumentsOrganizerCollectionFolder({
      folderKey: row._id.folderKey,
      folderName: row._id.folderName,
      documentType: row._id.documentType,
      count: row.count,
      totalSizeBytes: row.totalSizeBytes,
      latestModifiedAt: row.latestModifiedAt,
    }));
    foldersByRoot.set(sourceRoot, folders);
  }

  const rootCollections = rootRows.map((row) => {
    const sourceRoot = row._id || '';
    const folders = (foldersByRoot.get(sourceRoot) || []).filter(Boolean);

    return {
      source_root: sourceRoot,
      source_display_root: sourceRoot ? toDisplayPath(sourceRoot) : '',
      count: row.count || 0,
      total_size_bytes: row.totalSizeBytes || 0,
      latest_modified_at: row.latestModifiedAt?.toISOString?.() || row.latestModifiedAt || null,
      folder_count: Array.isArray(row.folderKeys) ? row.folderKeys.filter(Boolean).length : folders.length,
      folders: folders.slice(0, 5),
    };
  });
  const collectionStats = stats[0] || {};
  const documentTypes = documentTypeRows
    .map((row) => serializeDocumentsOrganizerCollectionFolder({
      folderKey: row._id.folderKey,
      folderName: row._id.folderName,
      documentType: row._id.documentType,
      count: row.count,
      totalSizeBytes: row.totalSizeBytes,
      latestModifiedAt: row.latestModifiedAt,
    }))
    .filter(Boolean);
  const physicalRoot = getDocumentsOrganizerPhysicalRoot(environment);

  return {
    type: 'documents_organizer_collections',
    storage: 'mongodb',
    content_indexed: false,
    physical_moves_performed: false,
    scanned_file_count: collectionStats.scannedFileCount || 0,
    total_size_bytes: collectionStats.totalSizeBytes || 0,
    source_root_count: Array.isArray(collectionStats.sourceRoots)
      ? collectionStats.sourceRoots.filter(Boolean).length
      : rootCollections.length,
    document_type_count: documentTypes.length,
    returned_source_root_count: rootCollections.length,
    returned_document_type_count: documentTypes.length,
    latest_scan_at: collectionStats.latestScanAt?.toISOString?.() || collectionStats.latestScanAt || null,
    physical_target_root: physicalRoot || '',
    physical_target_display_root: physicalRoot ? toDisplayPath(physicalRoot) : '',
    source_roots: rootCollections,
    document_types: documentTypes,
    safeguards: [
      'Collections are MongoDB metadata views over indexed local files.',
      'Opening a collection filters the index; it does not read file bodies.',
      'Physical organization into folders remains behind the MOVE FILES confirmation.',
    ],
    message: rootCollections.length > 0
      ? 'Local document metadata is grouped into source and type collections.'
      : 'No local document collections are available yet.',
  };
}

async function getDocumentsOrganizerFiles({
  userId,
  folderKey,
  sourceRoot,
  searchQuery,
  sortBy = DOCUMENTS_ORGANIZER_DEFAULT_FILE_SORT,
  limit = 24,
  offset = 0,
} = {}) {
  const normalizedLimit = asPositiveInteger(limit, 24, 100);
  const normalizedSortBy = normalizeDocumentsOrganizerFileSort(sortBy);
  const normalizedOffsetNumber = Math.floor(Number(offset));
  const normalizedOffset = Number.isFinite(normalizedOffsetNumber) && normalizedOffsetNumber > 0
    ? Math.min(normalizedOffsetNumber, 100000)
    : 0;
  const { match, normalizedFolderKey, normalizedSearchQuery } = createDocumentsOrganizerFileMatch({
    userId,
    folderKey,
    sourceRoot,
    searchQuery,
  });
  const normalizedSourceRoot = normalizeDocumentsOrganizerSourceRoot(sourceRoot);

  const [files, totalCount] = await Promise.all([
    DocumentsOrganizerFile.find(match)
      .sort(DOCUMENTS_ORGANIZER_FILE_SORT_MONGO[normalizedSortBy])
      .skip(normalizedOffset)
      .limit(normalizedLimit)
      .lean(),
    DocumentsOrganizerFile.countDocuments(match),
  ]);
  const nextOffset = normalizedOffset + files.length;

  return {
    type: 'documents_organizer_files',
    storage: 'mongodb',
    folder_key: normalizedFolderKey || 'all',
    source_root: normalizedSourceRoot,
    source_display_root: normalizedSourceRoot ? toDisplayPath(normalizedSourceRoot) : '',
    query: normalizedSearchQuery,
    sort_by: normalizedSortBy,
    limit: normalizedLimit,
    offset: normalizedOffset,
    next_offset: nextOffset,
    has_more: nextOffset < totalCount,
    total_count: totalCount,
    returned_count: files.length,
    files: files.map(serializeDocumentsOrganizerFile).filter(Boolean),
    content_indexed: false,
    message: totalCount > 0
      ? `Found ${totalCount} indexed local files.`
      : 'No indexed local files match this view.',
  };
}

async function getDocumentsOrganizerRecommendations({
  userId,
  limit = 6,
} = {}) {
  const normalizedLimit = asPositiveInteger(limit, 6, 12);
  const scannedFileCount = await DocumentsOrganizerFile.countDocuments({ userId, status: 'indexed' });
  const recommendationCandidates = await Promise.all(
    DOCUMENTS_ORGANIZER_RECOMMENDATION_BLUEPRINTS.map(async (blueprint, index) => {
      const stats = await getDocumentsOrganizerRecommendationStats({
        userId,
        folderKey: blueprint.folderKey,
        searchQuery: blueprint.searchQuery,
        sortBy: blueprint.sortBy,
      });

      if (stats.matchedFileCount <= 0) {
        return null;
      }

      return {
        id: blueprint.id,
        name: blueprint.name,
        description: blueprint.description,
        reason: blueprint.reason,
        folder_key: stats.folderKey,
        folder_name: blueprint.folderName,
        search_query: stats.searchQuery,
        sort_by: stats.sortBy,
        matched_file_count: stats.matchedFileCount,
        total_size_bytes: stats.totalSizeBytes,
        latest_modified_at: stats.latestModifiedAt?.toISOString?.() || stats.latestModifiedAt || null,
        priority: index + 1,
        sample_files: (stats.sampleFiles || []).map(serializeDocumentsOrganizerFile).filter(Boolean),
      };
    }),
  );
  const recommendations = recommendationCandidates
    .filter(Boolean)
    .slice(0, normalizedLimit);

  return {
    type: 'documents_organizer_recommendations',
    storage: 'mongodb',
    scanned_file_count: scannedFileCount,
    total_candidate_count: recommendationCandidates.filter(Boolean).length,
    returned_count: recommendations.length,
    recommendations,
    content_indexed: false,
    physical_moves_performed: false,
    safeguards: [
      'Recommendations are generated from MongoDB file metadata only.',
      'Opening a recommendation only changes the organizer folder/search/sort view.',
      'No document body content is read, imported, moved, or deleted.',
    ],
    message: recommendations.length > 0
      ? `Prepared ${recommendations.length.toLocaleString()} organizer recommendation views.`
      : 'No organizer recommendation views are available yet.',
  };
}

async function getDocumentsOrganizerDuplicates({
  userId,
  limit = 8,
  groupFileLimit = 4,
  includeProjectFiles = false,
  includeTechnicalFiles,
} = {}) {
  const normalizedLimit = asPositiveInteger(limit, 8, 25);
  const normalizedGroupFileLimit = asPositiveInteger(groupFileLimit, 4, 10);
  const normalizedIncludeTechnicalFiles = normalizeBoolean(
    includeTechnicalFiles,
    normalizeBoolean(includeProjectFiles, false),
  );
  const match = {
    userId,
    status: 'indexed',
    sizeBytes: { $gt: 0 },
    filename: { $exists: true, $ne: '' },
  };

  if (!normalizedIncludeTechnicalFiles) {
    match.$and = [
      { filename: { $not: TECHNICAL_ARTIFACT_DUPLICATE_FILENAME_REGEX } },
      { sourcePath: { $not: TECHNICAL_ARTIFACT_PATH_SEGMENT_REGEX } },
      { relativePath: { $not: TECHNICAL_ARTIFACT_PATH_SEGMENT_REGEX } },
      { displayPath: { $not: TECHNICAL_ARTIFACT_PATH_SEGMENT_REGEX } },
      { sourcePath: { $not: SENSITIVE_TECHNICAL_PATH_SEGMENT_REGEX } },
      { relativePath: { $not: SENSITIVE_TECHNICAL_PATH_SEGMENT_REGEX } },
      { displayPath: { $not: SENSITIVE_TECHNICAL_PATH_SEGMENT_REGEX } },
    ];
  }

  const [result = {}] = await DocumentsOrganizerFile.aggregate([
    {
      $match: match,
    },
    {
      $group: {
        _id: {
          filename: { $toLower: '$filename' },
          sizeBytes: '$sizeBytes',
        },
        filename: { $first: '$filename' },
        sizeBytes: { $first: '$sizeBytes' },
        count: { $sum: 1 },
        latestModifiedAt: { $max: '$modifiedAt' },
        files: { $push: '$$ROOT' },
      },
    },
    { $match: { count: { $gt: 1 } } },
    {
      $addFields: {
        duplicateSizeBytes: {
          $multiply: [{ $subtract: ['$count', 1] }, '$sizeBytes'],
        },
      },
    },
    { $sort: { count: -1, duplicateSizeBytes: -1, latestModifiedAt: -1, filename: 1 } },
    {
      $facet: {
        groups: [{ $limit: normalizedLimit }],
        summary: [
          {
            $group: {
              _id: null,
              duplicateGroupCount: { $sum: 1 },
              duplicateFileCount: { $sum: '$count' },
              reclaimableSizeBytes: { $sum: '$duplicateSizeBytes' },
            },
          },
        ],
      },
    },
  ]);
  const groups = Array.isArray(result.groups) ? result.groups : [];
  const summary = Array.isArray(result.summary) ? result.summary[0] : null;

  return {
    type: 'documents_organizer_duplicates',
    storage: 'mongodb',
    duplicate_group_count: summary?.duplicateGroupCount || 0,
    returned_group_count: groups.length,
    duplicate_file_count: summary?.duplicateFileCount || 0,
    reclaimable_size_bytes: summary?.reclaimableSizeBytes || 0,
    include_project_files: normalizedIncludeTechnicalFiles,
    include_technical_files: normalizedIncludeTechnicalFiles,
    project_filter_applied: !normalizedIncludeTechnicalFiles,
    technical_filter_applied: !normalizedIncludeTechnicalFiles,
    groups: groups.map((group) => {
      const files = Array.isArray(group.files) ? group.files : [];
      const serializedFiles = files
        .slice(0, normalizedGroupFileLimit)
        .map(serializeDocumentsOrganizerFile)
        .filter(Boolean);

      return {
        duplicate_key: `${group._id?.filename || String(group.filename || '').toLowerCase()}:${group.sizeBytes || 0}`,
        filename: group.filename || '',
        size_bytes: group.sizeBytes || 0,
        count: group.count || files.length,
        duplicate_size_bytes: group.duplicateSizeBytes || 0,
        latest_modified_at: group.latestModifiedAt?.toISOString?.() || group.latestModifiedAt || null,
        hidden_file_count: Math.max(0, files.length - serializedFiles.length),
        files: serializedFiles,
      };
    }),
    content_indexed: false,
    safeguards: normalizedIncludeTechnicalFiles
      ? ['Technical, project, dependency, source-control, and build artifact paths are included in this duplicate view.']
      : ['Technical, project, dependency, source-control, and build artifact paths are filtered out of this duplicate view.'],
    message: summary?.duplicateGroupCount > 0
      ? `Found ${summary.duplicateGroupCount.toLocaleString()} possible duplicate metadata groups${normalizedIncludeTechnicalFiles ? '' : ' in personal document paths'}.`
      : 'No possible duplicate metadata groups were found.',
  };
}

async function buildDocumentsOrganizerMovePlan({
  userId,
  environment = process.env,
  sampleLimit = 18,
  includeAllActions = false,
} = {}) {
  const targetRoot = getDocumentsOrganizerPhysicalRoot(environment);

  if (!targetRoot) {
    throw new DocumentsOrganizerUserError('No allowed documents organizer destination is configured.');
  }

  const normalizedSampleLimit = asPositiveInteger(sampleLimit, 18, 100);
  const maxFiles = getDocumentsOrganizerMaxFiles(environment.DOCUMENTS_ORGANIZER_MOVE_MAX_FILES);
  const sourceRoots = getDocumentsOrganizerPhysicalSourceRoots(environment);
  const documentTypes = getDocumentsOrganizerPhysicalDocumentTypes(environment);
  const fileQuery = {
    userId,
    status: 'indexed',
    sourceRoot: { $in: sourceRoots },
  };

  if (!documentTypes.includes('*')) {
    fileQuery.documentType = { $in: documentTypes };
  }

  const files = sourceRoots.length > 0 ? await DocumentsOrganizerFile.find(fileQuery)
    .sort({ folderName: 1, filename: 1, modifiedAt: -1 })
    .limit(maxFiles)
    .lean() : [];
  const reservedTargets = new Set();
  const actions = [];
  const skipped = [];
  const folders = new Map();
  const projectMarkerCache = new Map();
  const skipProjectFiles = !isEnvEnabled(environment.DOCUMENTS_ORGANIZER_PHYSICAL_INCLUDE_PROJECT_FILES);
  let totalSizeBytes = 0;

  for (const file of files) {
    const sourcePath = path.resolve(file.sourcePath || '');

    if (!file.sourcePath || !isOrganizerRootAllowed(sourcePath, environment)) {
      skipped.push({ file, reason: 'source-outside-allowed-roots' });
      continue;
    }

    if (!isPathInsideAny(sourceRoots, sourcePath)) {
      skipped.push({ file, reason: 'source-outside-physical-roots' });
      continue;
    }

    if (sourcePath === targetRoot || isPathInside(targetRoot, sourcePath)) {
      skipped.push({ file, reason: 'already-in-destination' });
      continue;
    }

    if (skipProjectFiles && isDocumentsOrganizerProjectMetadataFilename(file.filename || path.basename(sourcePath))) {
      skipped.push({ file, reason: 'project-metadata-file' });
      continue;
    }

    if (
      skipProjectFiles &&
      await isInsideDocumentsOrganizerProjectDirectory({ sourcePath, sourceRoots, projectMarkerCache })
    ) {
      skipped.push({ file, reason: 'inside-project-directory' });
      continue;
    }

    let sourceStats = null;
    try {
      sourceStats = await fs.lstat(sourcePath);
    } catch (_error) {
      skipped.push({ file, reason: 'source-missing' });
      continue;
    }

    if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) {
      skipped.push({ file, reason: 'not-regular-file' });
      continue;
    }

    const target = await createDocumentsOrganizerTargetPath({
      file,
      targetRoot,
      reservedTargets,
    });

    if (!target) {
      skipped.push({ file, reason: 'target-name-exhausted' });
      continue;
    }

    const action = {
      fileId: String(file._id || file.id || ''),
      filename: file.filename || path.basename(sourcePath),
      folderKey: file.folderKey,
      folderName: file.folderName,
      sourcePath,
      sourceDisplayPath: toDisplayPath(sourcePath),
      targetPath: target.targetPath,
      targetDisplayPath: toDisplayPath(target.targetPath),
      targetFolder: target.targetFolder,
      targetDisplayFolder: toDisplayPath(target.targetFolder),
      sizeBytes: sourceStats.size || file.sizeBytes || 0,
      collisionIndex: target.collisionIndex,
      action: 'move',
      reason: null,
    };

    actions.push(action);
    totalSizeBytes += action.sizeBytes;

    const folderKey = file.folderKey || 'documents';
    const currentFolder = folders.get(folderKey) || {
      folder_key: folderKey,
      folder_name: file.folderName || 'Documents',
      document_type: file.documentType || folderKey,
      count: 0,
      total_size_bytes: 0,
      latest_modified_at: null,
    };
    currentFolder.count += 1;
    currentFolder.total_size_bytes += action.sizeBytes;
    if (file.modifiedAt && (!currentFolder.latest_modified_at || new Date(file.modifiedAt) > new Date(currentFolder.latest_modified_at))) {
      currentFolder.latest_modified_at = file.modifiedAt?.toISOString?.() || file.modifiedAt;
    }
    folders.set(folderKey, currentFolder);
  }

  const serializedActions = actions
    .slice(0, includeAllActions ? actions.length : normalizedSampleLimit)
    .map(serializeDocumentsOrganizerMoveAction)
    .filter(Boolean);
  const collisionCount = actions.filter((action) => action.collisionIndex > 0).length;
  const alreadyOrganizedCount = skipped.filter((item) => item.reason === 'already-in-destination').length;
  const serializedSkipped = skipped
    .slice(0, includeAllActions ? skipped.length : normalizedSampleLimit)
    .map(serializeDocumentsOrganizerMoveSkippedItem)
    .filter(Boolean);

  return {
    type: 'documents_organizer_move_plan',
    storage: 'filesystem+mongodb',
    target_root: targetRoot,
    target_display_root: toDisplayPath(targetRoot),
    source_roots: sourceRoots,
    source_display_roots: sourceRoots.map(toDisplayPath),
    document_types: documentTypes,
    confirmation_phrase: DOCUMENTS_ORGANIZER_MOVE_CONFIRMATION,
    requires_confirmation: true,
    scanned_file_count: files.length,
    move_count: actions.length,
    skipped_count: skipped.length,
    already_organized_count: alreadyOrganizedCount,
    project_file_skipped_count: skipped.filter((item) => (
      item.reason === 'project-metadata-file' ||
      item.reason === 'inside-project-directory'
    )).length,
    collision_count: collisionCount,
    folder_count: folders.size,
    total_size_bytes: totalSizeBytes,
    content_indexed: false,
    physical_moves_performed: false,
    folders: Array.from(folders.values()).sort((left, right) => (
      right.count - left.count || left.folder_name.localeCompare(right.folder_name)
    )),
    actions: serializedActions,
    action_sample_count: serializedActions.length,
    skipped_reason_counts: summarizeDocumentsOrganizerMoveSkipReasons(skipped),
    skipped_files: serializedSkipped,
    skipped_file_sample_count: serializedSkipped.length,
    safeguards: [
      'The plan previews moves before changing files.',
      'Physical moves default to Documents, Desktop, and Downloads; Projects stay virtual unless explicitly configured.',
      'Structured data stays virtual by default so source and config files are not relocated.',
      'Source-control and code-project metadata stays virtual by default, even from Downloads.',
      'Target filenames are collision-safe and never overwrite existing files.',
      'The app updates MongoDB paths after each successful move.',
    ],
    message: actions.length > 0
      ? `Prepared ${actions.length} user document moves into ${toDisplayPath(targetRoot)}.`
      : 'No file moves are needed for the current organizer index.',
  };
}

async function exportDocumentsOrganizerMovePlan({
  userId,
  environment = process.env,
  now = new Date(),
} = {}) {
  const normalizedNow = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const plan = await buildDocumentsOrganizerMovePlan({
    userId,
    environment,
    includeAllActions: true,
  });
  const manifestWithoutHash = {
    type: 'documents_organizer_move_plan_export',
    storage: 'filesystem+mongodb',
    format: 'json',
    schema_version: 1,
    generated_at: normalizedNow.toISOString(),
    user_id: userId,
    content_indexed: false,
    physical_moves_performed: false,
    action_count: plan.actions.length,
    move_count: plan.move_count,
    skipped_count: plan.skipped_count,
    skipped_reason_counts: plan.skipped_reason_counts,
    skipped_file_count: plan.skipped_files.length,
    already_organized_count: plan.already_organized_count,
    project_file_skipped_count: plan.project_file_skipped_count,
    collision_count: plan.collision_count,
    total_size_bytes: plan.total_size_bytes,
    plan: {
      ...plan,
      actions: plan.actions,
      action_sample_count: plan.actions.length,
      skipped_files: plan.skipped_files,
      skipped_file_sample_count: plan.skipped_files.length,
    },
    safeguards: [
      'This export is a content-free physical move plan.',
      'No local file bodies are read to generate the export.',
      'No files are moved unless the separate MOVE FILES confirmation is submitted.',
      'The manifest includes local paths so the destination plan can be audited before moving files.',
    ],
    message: `Exported ${plan.actions.length.toLocaleString()} planned local document moves for review.`,
  };
  const manifestHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(manifestWithoutHash))
    .digest('hex');

  return {
    ...manifestWithoutHash,
    manifest_hash: manifestHash,
  };
}

async function applyDocumentsOrganizerMovePlan({
  userId,
  confirmation,
  environment = process.env,
  now = new Date(),
} = {}) {
  if (String(confirmation || '').trim() !== DOCUMENTS_ORGANIZER_MOVE_CONFIRMATION) {
    throw new DocumentsOrganizerUserError(`Type ${DOCUMENTS_ORGANIZER_MOVE_CONFIRMATION} to move local files.`);
  }

  const normalizedNow = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const plan = await buildDocumentsOrganizerMovePlan({
    userId,
    environment,
    includeAllActions: true,
  });
  const moveId = `documents-organizer-move-${crypto.randomUUID()}`;
  const moved = [];
  const failed = [];

  for (const action of plan.actions) {
    const sourcePath = path.resolve(action.source_path);
    const targetPath = path.resolve(action.target_path);

    try {
      const sourceStats = await fs.lstat(sourcePath);
      if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) {
        failed.push({ ...action, reason: 'not-regular-file' });
        continue;
      }

      await moveFileWithoutOverwrite(sourcePath, targetPath);

      const filename = path.basename(targetPath);
      const extension = path.extname(filename).toLowerCase();
      await DocumentsOrganizerFile.updateOne(
        { _id: action.file_id, userId },
        {
          $set: {
            scanId: moveId,
            pathHash: createDocumentsOrganizerPathHash(userId, targetPath),
            sourceRoot: plan.target_root,
            sourcePath: targetPath,
            displayPath: toDisplayPath(targetPath),
            relativePath: path.relative(plan.target_root, targetPath),
            filename,
            basename: path.basename(filename, extension),
            extension,
            sizeBytes: sourceStats.size || action.size_bytes || 0,
            modifiedAt: sourceStats.mtime || null,
            lastSeenAt: normalizedNow,
            status: 'indexed',
            physicalMovePerformed: true,
          },
        },
      );

      moved.push(action);
    } catch (error) {
      logger.warn('[DocumentsOrganizer] Failed to move local document file', {
        sourcePath,
        targetPath,
        message: error.message,
      });
      failed.push({
        ...action,
        reason: error?.code || 'move-failed',
      });
    }
  }

  const summary = await getDocumentsOrganizerSummary({ userId, environment });

  return {
    type: 'documents_organizer_move_result',
    move_id: moveId,
    storage: 'filesystem+mongodb',
    target_root: plan.target_root,
    target_display_root: plan.target_display_root,
    requested_move_count: plan.move_count,
    moved_count: moved.length,
    failed_count: failed.length,
    skipped_count: plan.skipped_count,
    content_indexed: false,
    physical_moves_performed: moved.length > 0,
    moved_files: moved.slice(0, 18).map(serializeDocumentsOrganizerMoveAction).filter(Boolean),
    failed_files: failed.slice(0, 18).map(serializeDocumentsOrganizerMoveAction).filter(Boolean),
    completed_at: normalizedNow.toISOString(),
    summary,
    message: failed.length > 0
      ? `Moved ${moved.length} files; ${failed.length} files could not be moved.`
      : `Moved ${moved.length} files into organized folders.`,
  };
}

async function scanDocumentsOrganizer({
  userId,
  environment = process.env,
  now = new Date(),
} = {}) {
  const normalizedNow = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const scanId = `documents-organizer-scan-${crypto.randomUUID()}`;
  const roots = getDocumentsOrganizerRoots(environment);
  const maxFiles = getDocumentsOrganizerMaxFiles(environment.DOCUMENTS_ORGANIZER_MAX_FILES);
  const maxDepth = getDocumentsOrganizerMaxDepth(environment.DOCUMENTS_ORGANIZER_MAX_DEPTH);
  const remaining = { count: maxFiles };
  const files = [];
  const skippedRoots = [];

  for (const root of roots) {
    try {
      const stats = await fs.stat(root);
      if (!stats.isDirectory()) {
        skippedRoots.push({ root, reason: 'not-directory' });
        continue;
      }
    } catch (_error) {
      skippedRoots.push({ root, reason: 'unavailable' });
      continue;
    }

    const discovered = await collectDocumentsOrganizerFiles({
      root,
      userId,
      scanId,
      now: normalizedNow,
      maxDepth,
      remaining,
    });
    files.push(...discovered);

    if (remaining.count <= 0) {
      break;
    }
  }

  if (files.length > 0) {
    await DocumentsOrganizerFile.bulkWrite(
      files.map((file) => {
        const { discoveredAt: _discoveredAt, ...fileUpdate } = file;

        return {
          updateOne: {
            filter: { userId, pathHash: file.pathHash },
            update: {
              $set: fileUpdate,
              $setOnInsert: { discoveredAt: normalizedNow },
            },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );
  }

  if (roots.length > 0) {
    await DocumentsOrganizerFile.updateMany(
      {
        userId,
        sourceRoot: { $in: roots },
        scanId: { $ne: scanId },
        status: 'indexed',
      },
      {
        $set: {
          status: 'missing',
          lastSeenAt: normalizedNow,
        },
      },
    );
  }

  const folderSummary = summarizeDocumentsOrganizerFolders(files);
  const summary = await getDocumentsOrganizerSummary({ userId, environment });

  return {
    type: 'documents_organizer_scan',
    scan_id: scanId,
    storage: 'mongodb',
    roots,
    skipped_roots: skippedRoots,
    max_files: maxFiles,
    max_depth: maxDepth,
    scanned_file_count: files.length,
    indexed_file_count: files.length,
    folder_count: folderSummary.folders.length,
    folders: folderSummary.folders,
    content_indexed: false,
    physical_moves_performed: false,
    completed_at: normalizedNow.toISOString(),
    summary,
    message: files.length > 0
      ? `Indexed ${files.length} local document metadata records into virtual folders.`
      : 'No matching local document files were found in the configured organizer roots.',
  };
}

module.exports = {
  DOCUMENTS_ORGANIZER_MOVE_CONFIRMATION,
  DocumentsOrganizerUserError,
  applyDocumentsOrganizerMovePlan,
  buildDocumentsOrganizerMovePlan,
  classifyDocumentsOrganizerFile,
  completeDocumentsOrganizerImportRun,
  createDocumentsOrganizerImportRun,
  createDocumentsOrganizerSavedView,
  deleteDocumentsOrganizerSavedView,
  exportDocumentsOrganizerMovePlan,
  openDocumentsOrganizerSavedView,
  getDocumentsOrganizerMaxDepth,
  getDocumentsOrganizerMaxFiles,
  getDocumentsOrganizerPhysicalDocumentTypes,
  getDocumentsOrganizerPhysicalRoot,
  getDocumentsOrganizerPhysicalSourceRoots,
  getDocumentsOrganizerRoots,
  getDocumentsOrganizerDuplicates,
  getDocumentsOrganizerFiles,
  getDocumentsOrganizerImportRuns,
  getDocumentsOrganizerCollections,
  getDocumentsOrganizerRecommendations,
  getDocumentsOrganizerSavedViews,
  getDocumentsOrganizerSummary,
  importDocumentsOrganizerFileWithDocling,
  previewDocumentsOrganizerImport,
  scanDocumentsOrganizer,
  serializeDocumentsOrganizerFile,
  serializeDocumentsOrganizerSavedView,
  serializeDocumentsOrganizerSavedViewWithStats,
  updateDocumentsOrganizerImportRunItem,
};

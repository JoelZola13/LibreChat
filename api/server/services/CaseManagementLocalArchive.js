const crypto = require('crypto');
const { createReadStream } = require('fs');
const fs = require('fs/promises');
const path = require('path');

const DEFAULT_LOCAL_ARCHIVE_ROOTS = [
  '/host-home/Desktop',
  '/host-home/Documents',
  '/host-home/Downloads',
  '/host-home/Projects',
];
const SCAN_CANDIDATE_BUFFER = 5000;
const DEFAULT_LOCAL_ARCHIVE_HASH_LIMIT = 240;
const DEFAULT_LOCAL_ARCHIVE_HASH_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_LOCAL_ARCHIVE_TEXT_FINGERPRINT_LIMIT = 180;
const DEFAULT_LOCAL_ARCHIVE_TEXT_FINGERPRINT_MAX_BYTES = 512 * 1024;
const DEFAULT_LOCAL_ARCHIVE_TEXT_SIMILARITY_THRESHOLD = 0.62;

const TEXT_FINGERPRINT_STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'also',
  'and',
  'another',
  'are',
  'because',
  'been',
  'before',
  'being',
  'between',
  'but',
  'can',
  'case',
  'client',
  'could',
  'does',
  'done',
  'each',
  'from',
  'have',
  'into',
  'more',
  'need',
  'needs',
  'not',
  'one',
  'only',
  'other',
  'our',
  'page',
  'record',
  'records',
  'source',
  'that',
  'the',
  'their',
  'there',
  'this',
  'through',
  'use',
  'was',
  'were',
  'when',
  'where',
  'wiki',
  'will',
  'with',
  'would',
  'your',
]);

const SKIPPED_DIRECTORIES = new Set([
  '.cache',
  '.git',
  '.next',
  '.npm',
  '.pnpm-store',
  '.venv',
  '.yarn',
  '.Trash',
  'Applications',
  'build',
  'coverage',
  'dist',
  'Docker',
  'Docker Desktop',
  'Library',
  'Movies',
  'Music',
  'node_modules',
  'OrbStack',
  'Parallels',
  'pods',
  'vendor',
  'venv',
  'Virtual Machines.localized',
]);

const SKIPPED_DIRECTORY_PATTERNS = [
  /^build[-_.].*/i,
  /^dist[-_.].*/i,
  /^out$/i,
  /^storybook-static$/i,
  /^\.output$/i,
  /^\.turbo$/i,
  /^\.vite$/i,
];

const IMPORTANT_EXTENSIONS = new Set([
  '.csv',
  '.doc',
  '.docx',
  '.eml',
  '.aac',
  '.aif',
  '.aiff',
  '.avi',
  '.flac',
  '.gif',
  '.heic',
  '.html',
  '.ics',
  '.jpeg',
  '.jpg',
  '.json',
  '.key',
  '.m4a',
  '.m4v',
  '.mbox',
  '.md',
  '.mkv',
  '.mov',
  '.mp3',
  '.mp4',
  '.mpeg',
  '.mpg',
  '.numbers',
  '.odt',
  '.pages',
  '.pdf',
  '.png',
  '.ppt',
  '.pptx',
  '.rtf',
  '.srt',
  '.tsv',
  '.txt',
  '.url',
  '.vcf',
  '.vtt',
  '.wav',
  '.webm',
  '.webp',
  '.webloc',
  '.xls',
  '.xlsx',
]);

const TEXT_MIME_BY_EXTENSION = {
  '.csv': 'text/csv',
  '.eml': 'message/rfc822',
  '.html': 'text/html',
  '.ics': 'text/calendar',
  '.json': 'application/json',
  '.mbox': 'application/mbox',
  '.md': 'text/markdown',
  '.rtf': 'application/rtf',
  '.srt': 'application/x-subrip',
  '.tsv': 'text/tab-separated-values',
  '.txt': 'text/plain',
  '.url': 'text/plain',
  '.vcf': 'text/vcard',
  '.vtt': 'text/vtt',
  '.webloc': 'application/x-webloc',
};

const GENERATED_PROJECT_ASSET_DIRECTORIES = new Set([
  'app',
  'assets',
  'build',
  'client',
  'coverage',
  'dist',
  'frontend',
  'i18n',
  'media',
  'public',
  'static',
  'themes',
  'uploads',
  'vendor',
  'webui',
]);

const GENERATED_PROJECT_ASSET_EXTENSIONS = new Set([
  '.html',
  '.jpeg',
  '.jpg',
  '.json',
  '.png',
  '.webp',
]);

const PROJECT_DOCUMENTATION_FILENAMES = new Set([
  'authors',
  'authors.md',
  'changes',
  'changes.md',
  'changelog',
  'changelog.md',
  'code_of_conduct.md',
  'contributing.md',
  'copying',
  'copying.md',
  'license',
  'license.md',
  'readme',
  'readme.md',
  'security.md',
  'testing_guide.md',
  'testing-guide.md',
  'testing guide.md',
  'upgrade.md',
]);

const PROJECT_OR_DEPENDENCY_PATH_PARTS = new Set([
  'api',
  'app',
  'bundle',
  'bundles',
  'client',
  'components',
  'composer',
  'dist',
  'lib',
  'librechat',
  'mautic',
  'modules',
  'nanobot',
  'node_modules',
  'packages',
  'plugins',
  'src',
  'symfony',
  'themes',
  'vendor',
]);

const KNOWLEDGE_WIKI_VALUE_KEYWORDS = [
  'academy',
  'agreement',
  'analysis',
  'bio',
  'case management',
  'client',
  'coalition',
  'compliance',
  'contract',
  'curriculum',
  'declaration',
  'directory',
  'employment',
  'festival',
  'grant',
  'guideline',
  'housing',
  'innovation',
  'injustice',
  'intake',
  'm works',
  'm_works',
  'media',
  'open brain',
  'partner',
  'plan',
  'playbook',
  'platform',
  'policy',
  'portfolio',
  'program',
  'proposal',
  'referral',
  'research',
  'roadmap',
  'script',
  'service',
  'street voices',
  'streetvoices',
  'strategy',
  'support materials',
  'systems',
  'training',
  'wiki',
];

const WEAK_GENERIC_SOURCE_TITLES = new Set([
  'content',
  'contents',
  'copy',
  'document',
  'draft',
  'hello',
  'index',
  'main',
  'new document',
  'note',
  'notes',
  'readme',
  'source',
  'test',
  'untitled',
]);

const KNOWN_CODE_WORKSPACE_ROOTS = new Set([
  'librechat',
  'list_monk',
  'list-monk',
  'listmonk',
  'mautic',
  'moodle',
  'moodle_lms',
  'moodle-lms',
  'nano-claw',
  'nano_claw',
  'nanoclaw',
  'nanobot',
  'plane',
  'plane-selfhost',
  'streetbot-0.1',
  'streetbot-0-1',
]);

const MIME_BY_EXTENSION = {
  ...TEXT_MIME_BY_EXTENSION,
  '.aac': 'audio/aac',
  '.aif': 'audio/aiff',
  '.aiff': 'audio/aiff',
  '.avi': 'video/x-msvideo',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.flac': 'audio/flac',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.key': 'application/vnd.apple.keynote',
  '.m4a': 'audio/mp4',
  '.m4v': 'video/x-m4v',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpeg',
  '.numbers': 'application/vnd.apple.numbers',
  '.pages': 'application/vnd.apple.pages',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.webloc': 'application/x-webloc',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const LIFE_DOMAIN_KEYWORDS = [
  {
    id: 'development',
    label: 'Development',
    keywords: ['package.json', 'tsconfig', 'source code', 'repository', 'github', 'dockerfile'],
  },
  {
    id: 'street-voices',
    label: 'Street Voices',
    keywords: ['street voices', 'streetvoices', 'nanobot', 'librechat'],
  },
  {
    id: 'case-management',
    label: 'Case Management',
    keywords: ['case', 'client', 'intake', 'referral', 'consent', 'appointment', 'case management'],
  },
  {
    id: 'partners',
    label: 'Partners',
    keywords: ['partner', 'partners', 'stakeholder', 'coalition', 'organization', 'organisation', 'vendor'],
  },
  {
    id: 'services',
    label: 'Services',
    keywords: ['service', 'directory', 'resource', 'findhelp', '211', 'shelter', 'clinic', 'housing help'],
  },
  {
    id: 'projects',
    label: 'Projects',
    keywords: ['project', 'proposal', 'grant', 'agreement', 'roadmap', 'strategy', 'systems innovation', 'innovation'],
  },
  {
    id: 'creative',
    label: 'Creative',
    keywords: ['creative', 'media', 'podcast', 'photo', 'video', 'gallery', 'portfolio', 'recording'],
  },
  {
    id: 'research',
    label: 'Research',
    keywords: ['research', 'paper', 'study', 'article', 'wiki', 'notes', 'analysis'],
  },
  {
    id: 'admin',
    label: 'Admin',
    keywords: ['invoice', 'receipt', 'tax', 'insurance', 'lease', 'passport', 'license', 'licence', 'bank'],
  },
  {
    id: 'personal',
    label: 'Personal',
    keywords: ['personal', 'family', 'home', 'health', 'journal'],
  },
];

const sourceKindForFile = (extension = '', fileName = '') => {
  const lower = fileName.toLowerCase();
  if (['.csv', '.tsv', '.xlsx', '.xls', '.numbers'].includes(extension)) return 'table';
  if (['.jpg', '.jpeg', '.png', '.webp', '.heic'].includes(extension)) return 'image';
  if (['.aac', '.aif', '.aiff', '.flac', '.m4a', '.mp3', '.wav'].includes(extension)) return 'audio';
  if (['.avi', '.m4v', '.mkv', '.mov', '.mp4', '.mpeg', '.mpg', '.webm'].includes(extension)) return 'video';
  if (['.ppt', '.pptx', '.key'].includes(extension)) return 'presentation';
  if (['.eml', '.mbox'].includes(extension)) return 'email';
  if (['.ics'].includes(extension)) return 'calendar';
  if (['.vcf'].includes(extension)) return 'contact';
  if (['.srt', '.vtt'].includes(extension)) return 'transcript';
  if (['.url', '.webloc'].includes(extension) || (['.html', '.htm', '.json'].includes(extension) && /bookmark|favorite|history|reading list/i.test(lower))) {
    return 'bookmark';
  }
  if (['.pdf', '.doc', '.docx', '.odt', '.pages'].includes(extension)) return 'document';
  if (['.md', '.txt', '.rtf'].includes(extension) || lower.includes('note')) return 'note';
  return 'source';
};

const lifeDomainForFile = ({ relativePath = '', fileName = '', lane = '', extension = '' }) => {
  const source = `${relativePath} ${fileName} ${lane}`.toLowerCase();
  if (lane === 'Development and code archives') return { id: 'development', label: 'Development' };
  if (lane === 'Browser bookmarks and web research') return { id: 'research', label: 'Research' };
  if (lane === 'Media and creative assets') return { id: 'creative', label: 'Creative' };
  const matched = LIFE_DOMAIN_KEYWORDS.find((domain) => domain.keywords.some((keyword) => source.includes(keyword)));
  if (matched) return { id: matched.id, label: matched.label };
  if (lane === 'Personal admin and identity') return { id: 'admin', label: 'Admin' };
  if (lane === 'Partner and organization lists') return { id: 'partners', label: 'Partners' };
  if (lane === 'Case management material') return { id: 'case-management', label: 'Case Management' };
  if (lane === 'Projects and strategy') return { id: 'projects', label: 'Projects' };
  if (['.eml', '.mbox', '.ics', '.vcf'].includes(extension)) return { id: 'personal', label: 'Personal' };
  if (['.url', '.webloc'].includes(extension)) return { id: 'research', label: 'Research' };
  return { id: 'unknown', label: 'Unknown' };
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toBoundedNumber = (value, fallback, min = 0, max = 1) => {
  const parsed = Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const parseRoots = () =>
  (process.env.CASE_MANAGEMENT_LOCAL_ARCHIVE_ROOTS || DEFAULT_LOCAL_ARCHIVE_ROOTS.join(','))
    .split(',')
    .map((root) => root.trim())
    .filter(Boolean);

const rootLabel = (rootPath) => {
  const name = path.basename(rootPath);
  if (!name || name === 'host-home') return 'Home';
  return name;
};

const rootIdForPath = (rootPath) => crypto.createHash('sha1').update(path.resolve(rootPath)).digest('hex').slice(0, 12);

const hashLocalId = (rootId, relativePath) =>
  crypto.createHash('sha1').update(`${rootId}:${relativePath}`).digest('hex').slice(0, 16);

const normalizeTitle = (value = 'Source document') => {
  const withoutExtension = value.replace(/\.[^.]+$/, '');
  const cleaned = withoutExtension
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Source document';
  return cleaned
    .split(' ')
    .map((word) => {
      if (/^[A-Z0-9]{2,}$/.test(word)) return word;
      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(' ');
};

const getConfiguredRoots = async () => {
  const roots = [];
  for (const rootPath of parseRoots()) {
    const resolvedRoot = path.resolve(rootPath);
    try {
      const stat = await fs.stat(resolvedRoot);
      if (stat.isDirectory()) {
        roots.push({
          id: rootIdForPath(resolvedRoot),
          label: rootLabel(resolvedRoot),
          path: resolvedRoot,
        });
      }
    } catch {
      // Ignore roots that are not mounted on this machine.
    }
  }
  return roots;
};

const extensionForName = (fileName = '') => path.extname(fileName).toLowerCase();

const mimeTypeForName = (fileName = '') => MIME_BY_EXTENSION[extensionForName(fileName)] || 'application/octet-stream';

const hashLocalFileSha256 = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });

const hashStableKey = (value) => crypto.createHash('sha1').update(value).digest('hex').slice(0, 16);

const readLocalFilePrefix = async (filePath, maxBytes) => {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    await handle.close();
  }
};

const normalizeTextForFingerprint = (value = '') =>
  String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\[a-z]+-?\d* ?/gi, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');

const textFingerprintForContent = (value = '') => {
  const tokenCounts = normalizeTextForFingerprint(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !TEXT_FINGERPRINT_STOP_WORDS.has(token))
    .reduce((counts, token) => {
      counts[token] = (counts[token] || 0) + 1;
      return counts;
    }, Object.create(null));
  const terms = Object.entries(tokenCounts)
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })
    .slice(0, 48)
    .map(([term]) => term);
  return {
    terms,
    tokenCount: Object.values(tokenCounts).reduce((sum, count) => sum + count, 0),
    signature: terms.length ? hashStableKey([...terms].sort().join('|')) : '',
  };
};

const jaccardSimilarity = (leftTerms = [], rightTerms = []) => {
  const left = new Set(leftTerms);
  const right = new Set(rightTerms);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  left.forEach((term) => {
    if (right.has(term)) intersection += 1;
  });
  const union = left.size + right.size - intersection;
  return union ? intersection / union : 0;
};

const buildNearDuplicateTextGroups = (textFingerprintById, sourceHashById, threshold) => {
  const ids = Object.keys(textFingerprintById);
  const parent = new Map(ids.map((id) => [id, id]));
  const edgesById = {};

  const find = (id) => {
    const current = parent.get(id);
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };

  const union = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };

  for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < ids.length; rightIndex += 1) {
      const leftId = ids[leftIndex];
      const rightId = ids[rightIndex];
      const leftHash = sourceHashById[leftId];
      const rightHash = sourceHashById[rightId];
      if (leftHash && rightHash && leftHash === rightHash) continue;
      const score = jaccardSimilarity(textFingerprintById[leftId].terms, textFingerprintById[rightId].terms);
      if (score < threshold) continue;
      union(leftId, rightId);
      edgesById[leftId] = [...(edgesById[leftId] || []), { id: rightId, score }];
      edgesById[rightId] = [...(edgesById[rightId] || []), { id: leftId, score }];
    }
  }

  const components = ids.reduce((groups, id) => {
    if (!edgesById[id]?.length) return groups;
    const root = find(id);
    groups[root] = [...(groups[root] || []), id];
    return groups;
  }, {});

  return Object.values(components).reduce((groups, componentIds) => {
    if (componentIds.length < 2) return groups;
    const sortedIds = [...componentIds].sort();
    const groupKey = `near-text:${hashStableKey(sortedIds.join('|'))}`;
    const termCounts = Object.create(null);
    sortedIds.forEach((id) => {
      textFingerprintById[id].terms.slice(0, 24).forEach((term) => {
        termCounts[term] = (termCounts[term] || 0) + 1;
      });
    });
    const sharedTerms = Object.entries(termCounts)
      .filter(([, count]) => count > 1)
      .sort((left, right) => {
        if (right[1] !== left[1]) return right[1] - left[1];
        return left[0].localeCompare(right[0]);
      })
      .slice(0, 10)
      .map(([term]) => term);
    sortedIds.forEach((id) => {
      const maxScore = Math.max(...(edgesById[id] || []).map((edge) => edge.score));
      groups[id] = {
        groupKey,
        count: sortedIds.length,
        maxScore: Number((Number.isFinite(maxScore) ? maxScore : 0).toFixed(2)),
        sharedTerms,
      };
    });
    return groups;
  }, {});
};

const normalizeSourceHistoryAliasKey = (value = '') =>
  normalizeTextForFingerprint(String(value || '').replace(/\.[a-z0-9]+$/i, ' '))
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !TEXT_FINGERPRINT_STOP_WORDS.has(token))
    .slice(0, 12)
    .join(' ')
    .trim()
    .slice(0, 180);

const sourceHistoryTermsForValues = (values = []) =>
  Array.from(
    new Set(
      normalizeTextForFingerprint(values.filter(Boolean).join(' '))
        .split(/\s+/)
        .filter((token) => token.length >= 3 && !TEXT_FINGERPRINT_STOP_WORDS.has(token)),
    ),
  ).slice(0, 72);

const canonicalLineageAliasValues = (lineage = {}) => {
  const values = [];
  if (lineage?.canonicalSource?.sourceLabel) values.push(lineage.canonicalSource.sourceLabel);
  if (Array.isArray(lineage?.aliases)) {
    lineage.aliases.forEach((alias) => {
      if (typeof alias === 'string') values.push(alias);
      else if (alias?.label) values.push(alias.label);
      else if (alias?.key) values.push(alias.key);
    });
  }
  if (Array.isArray(lineage?.members)) {
    lineage.members.forEach((member) => {
      if (member?.sourceLabel) values.push(member.sourceLabel);
      if (Array.isArray(member?.aliases)) {
        member.aliases.forEach((alias) => values.push(alias));
      }
    });
  }
  return values.filter(Boolean);
};

const normalizeSourceHistoryRecord = (record = {}) => {
  const archive = record.archive || record.generatedRecords?.frontendRecord?.archive || record.wikiPage?.archive || {};
  const cleanupDecision = record.cleanupDecision || archive.cleanupDecision || {};
  const canonicalLineage = record.canonicalLineage || archive.canonicalLineage || cleanupDecision.canonicalLineage || null;
  const sourceHash = String(record.sourceHash || record.sha256 || record.generatedRecords?.frontendRecord?.sourceHash || '').trim();
  const sourceId = String(record.sourceId || record.fileId || record.id || '').trim();
  const sourceLabel = String(
    record.sourceLabel ||
      archive.suggestedWikiTitle ||
      record.generatedRecords?.frontendRecord?.title ||
      record.title ||
      record.originalName ||
      record.fileName ||
      sourceId ||
      'Case Wiki source',
  ).trim();
  if (!sourceHash && !canonicalLineage && !sourceId && !sourceLabel) return null;
  const sourcePageId = String(
    record.sourcePageId ||
      record.generatedRecords?.frontendRecord?.pageId ||
      record.wikiPage?.id ||
      '',
  ).trim();
  return {
    sourceHash,
    sourceId,
    sourceLabel,
    sourcePageId,
    reviewStatus: archive.reviewStatus || record.reviewStatus || '',
    cleanupDecision,
    canonicalLineage,
  };
};

const buildSourceHistoryByHash = (records = []) => {
  const historyByHash = {};
  const lineageMatchers = [];
  const summary = {
    knownSources: 0,
    canonicalSources: 0,
    supersededSources: 0,
    alreadyInWikiSources: 0,
    lineageSources: 0,
  };

  records
    .map(normalizeSourceHistoryRecord)
    .filter(Boolean)
    .forEach((record) => {
      summary.knownSources += 1;
      const baseSource = {
        sourceId: record.sourceId,
        sourceLabel: record.sourceLabel,
        sourcePageId: record.sourcePageId,
        sourceHash: record.sourceHash,
      };
      const cleanupStatus = record.cleanupDecision?.status || '';
      const alreadyInWiki = {
        status: 'already-in-wiki',
        label: 'Already in Case Wiki',
        recommendation:
          'This exact content already has a Case Wiki source page. Review before ingesting another copy.',
        matchedSource: baseSource,
      };

      if (record.canonicalLineage) {
        const aliasValues = [
          record.sourceLabel,
          record.sourcePageId,
          record.cleanupDecision?.canonicalSource?.sourceLabel,
          ...canonicalLineageAliasValues(record.canonicalLineage),
        ].filter(Boolean);
        const aliasKeys = Array.from(new Set(aliasValues.map(normalizeSourceHistoryAliasKey).filter(Boolean))).slice(0, 80);
        const lineageTerms = sourceHistoryTermsForValues(aliasValues);
        if (aliasKeys.length || lineageTerms.length) {
          lineageMatchers.push({
            aliasKeys,
            terms: lineageTerms,
            canonicalLineage: record.canonicalLineage,
            matchedSource: baseSource,
            canonicalSource: record.canonicalLineage.canonicalSource || record.cleanupDecision?.canonicalSource || baseSource,
          });
          summary.lineageSources += 1;
        }
      }

      if (!record.sourceHash) return;

      const existing = historyByHash[record.sourceHash];
      if (!existing) {
        historyByHash[record.sourceHash] = alreadyInWiki;
        summary.alreadyInWikiSources += 1;
      }

      if (cleanupStatus === 'canonical-source') {
        historyByHash[record.sourceHash] = {
          status: 'canonical-source',
          label: 'Known canonical source',
          recommendation:
            'This exact content matches a source already marked canonical. Prefer linking to that wiki source before ingesting another copy.',
          matchedSource: baseSource,
          canonicalSource: baseSource,
        };
        summary.canonicalSources += 1;
        return;
      }

      if (cleanupStatus === 'superseded-by-canonical' && record.cleanupDecision?.canonicalSource) {
        historyByHash[record.sourceHash] = {
          status: 'superseded-by-canonical',
          label: 'Known superseded source',
          recommendation:
            'This exact content was previously marked superseded by a canonical source. Keep it out of new ingest batches unless you are reviewing history.',
          matchedSource: baseSource,
          canonicalSource: record.cleanupDecision.canonicalSource,
        };
        summary.supersededSources += 1;
        return;
      }

      if (cleanupStatus === 'superseded-or-old-copy') {
        historyByHash[record.sourceHash] = {
          status: 'superseded-or-old-copy',
          label: 'Known old copy',
          recommendation:
            'This exact content was previously marked as an old or superseded copy. Review before ingesting or embedding it again.',
          matchedSource: baseSource,
        };
        summary.supersededSources += 1;
      }
    });

  return { historyByHash, lineageMatchers, summary };
};

const sourceHistoryLineageMatchForFile = (candidate = {}, fingerprint = null, lineageMatchers = []) => {
  if (!lineageMatchers.length) return null;
  const candidateAliasKeys = Array.from(
    new Set(
      [candidate.fileName, candidate.relativePath, candidate.suggestedWikiTitle]
        .map(normalizeSourceHistoryAliasKey)
        .filter(Boolean),
    ),
  );
  const fingerprintTerms = Array.isArray(fingerprint?.terms) ? fingerprint.terms : [];
  const candidateTerms = sourceHistoryTermsForValues([
    candidate.fileName,
    candidate.relativePath,
    ...(Array.isArray(fingerprintTerms) ? fingerprintTerms : []),
  ]);

  let bestMatch = null;
  lineageMatchers.forEach((matcher) => {
    const titleMatched = candidateAliasKeys.some((candidateKey) =>
      matcher.aliasKeys.some((aliasKey) => {
        if (!candidateKey || !aliasKey || Math.min(candidateKey.length, aliasKey.length) < 8) return false;
        return candidateKey === aliasKey || candidateKey.includes(aliasKey) || aliasKey.includes(candidateKey);
      }),
    );
    const termScore = jaccardSimilarity(candidateTerms, matcher.terms || []);
    const score = Math.max(titleMatched ? 0.92 : 0, termScore);
    if (score < 0.32) return;
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        matcher,
        score,
        matchMethod: titleMatched ? 'lineage-alias' : 'lineage-terms',
      };
    }
  });

  if (!bestMatch) return null;
  return {
    status: 'source-family-match',
    label: 'Known source family',
    recommendation:
      'This file looks connected to a remembered canonical source family. Review that source history before extracting, embedding, or creating another wiki source page.',
    matchedSource: bestMatch.matcher.matchedSource,
    canonicalSource: bestMatch.matcher.canonicalSource,
    canonicalLineage: bestMatch.matcher.canonicalLineage,
    matchMethod: bestMatch.matchMethod,
    lineageScore: Number(bestMatch.score.toFixed(2)),
  };
};

const hasSensitivePathSignal = (relativePath = '', fileName = '') => {
  const source = `${relativePath} ${fileName}`.toLowerCase();
  const baseName = fileName.toLowerCase();
  const extension = extensionForName(fileName);
  if (['id_rsa', 'id_ed25519', 'authorized_keys', 'known_hosts'].includes(baseName)) return true;
  if (['.pem', '.p12', '.pfx'].includes(extension)) return true;
  if (extension === '.key' && /(saml|private|secret|cert|credential|oauth|token|jwt|rsa|dsa|ed25519|signing)/i.test(source)) {
    return true;
  }
  return [
    'api-key',
    'api_key',
    'apikey',
    'auth token',
    'auth-token',
    'auth_token',
    'credential',
    'credentials',
    'keychain',
    'oauth',
    'password',
    'passwd',
    'private-key',
    'private_key',
    'recovery code',
    'saml',
    'secret',
    'secrets',
    'seed phrase',
    'token',
  ].some((keyword) => source.includes(keyword));
};

const isSkippedDirectoryName = (name = '') => {
  const normalizedName = String(name || '').toLowerCase();
  return (
    SKIPPED_DIRECTORIES.has(name) ||
    SKIPPED_DIRECTORIES.has(normalizedName) ||
    SKIPPED_DIRECTORY_PATTERNS.some((pattern) => pattern.test(name))
  );
};

const isProjectOrDependencyPath = (relativePath = '') =>
  String(relativePath || '')
    .toLowerCase()
    .split(/[\\/]+/)
    .filter(Boolean)
    .some((part) => PROJECT_OR_DEPENDENCY_PATH_PARTS.has(part));

const isKnownCodeWorkspacePath = (relativePath = '') => {
  const pathParts = String(relativePath || '')
    .toLowerCase()
    .split(/[\\/]+/)
    .filter(Boolean);
  return pathParts.some((part) => KNOWN_CODE_WORKSPACE_ROOTS.has(part));
};

const hasTechnicalArtifactSignal = (relativePath = '', fileName = '') => {
  const lowerPath = relativePath.toLowerCase();
  const lowerName = fileName.toLowerCase();
  const lowerSource = `${lowerPath} ${lowerName}`;
  if (
    lowerSource.includes('casewikiingestsmoke') ||
    lowerSource.includes('browser-smoke') ||
    lowerSource.includes('chrome-smoke') ||
    lowerSource.includes('smoke-test') ||
    lowerSource.includes('smoke test')
  ) {
    return true;
  }
  if (
    [
      'package.json',
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
      'tsconfig.json',
      'tsconfig.node.json',
      'tsconfig.test.json',
      'vite.config.js',
      'vite.config.ts',
      'next.config.js',
      'tailwind.config.js',
      'postcss.config.js',
      'robots.txt',
    ].includes(lowerName)
  ) {
    return true;
  }
  if (/^tsconfig\.[a-z0-9-]+\.json$/.test(lowerName)) return true;
  if (lowerName === 'index.html' && /(^|\/)(client|public|dist|build|packages|api)(\/|$)/.test(lowerPath)) return true;
  if (lowerName === 'manifest.json' && /(^|\/)(client|public|dist|build|packages)(\/|$)/.test(lowerPath)) return true;
  if (PROJECT_DOCUMENTATION_FILENAMES.has(lowerName) && isProjectOrDependencyPath(relativePath)) return true;
  if (isKnownCodeWorkspacePath(relativePath)) {
    return true;
  }
  return false;
};

const hasGeneratedProjectAssetSignal = (relativePath = '', fileName = '') => {
  const extension = extensionForName(fileName);
  if (!GENERATED_PROJECT_ASSET_EXTENSIONS.has(extension)) return false;
  const lowerName = fileName.toLowerCase();
  if (
    [
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'tsconfig.node.json',
      'tsconfig.test.json',
      'vite.config.js',
      'vite.config.ts',
      'next.config.js',
      'tailwind.config.js',
      'postcss.config.js',
    ].includes(lowerName) ||
    /^tsconfig\.[a-z0-9-]+\.json$/.test(lowerName)
  ) {
    return false;
  }

  const lowerParts = relativePath
    .toLowerCase()
    .split(/[\\/]+/)
    .filter(Boolean);
  return lowerParts.some((part) => GENERATED_PROJECT_ASSET_DIRECTORIES.has(part));
};

const hasScreenshotSignal = (relativePath = '', fileName = '') => {
  const lower = `${relativePath} ${fileName}`.toLowerCase();
  return lower.includes('screenshot') || lower.includes('screen shot');
};

const hasAgentChatExportSignal = (relativePath = '', fileName = '') => {
  const lowerPath = String(relativePath || '').toLowerCase();
  const lowerName = String(fileName || '').toLowerCase();
  const pathParts = lowerPath.split(/[\\/]+/).filter(Boolean);
  if (pathParts.includes('agent_0')) {
    return true;
  }
  const hasAgentChatPath =
    pathParts.includes('agent_0') &&
    pathParts.includes('usr') &&
    pathParts.includes('chats') &&
    pathParts.includes('messages');

  return (
    (hasAgentChatPath && (lowerName === 'message.txt' || /^[0-9]+\.txt$/.test(lowerName))) ||
    /^agent\.system\.tool\.[a-z0-9._-]+\.md$/.test(lowerName)
  );
};

const laneForLocalFile = (relativePath = '', fileName = '') => {
  const extension = extensionForName(fileName);
  const source = `${relativePath} ${fileName}`.toLowerCase();

  if (hasAgentChatExportSignal(relativePath, fileName)) {
    return 'AI chat and agent exports';
  }
  if (hasTechnicalArtifactSignal(relativePath, fileName) || hasGeneratedProjectAssetSignal(relativePath, fileName)) {
    return 'Development and code archives';
  }
  if (
    source.includes('bookmark') ||
    source.includes('favorite') ||
    source.includes('favourite') ||
    source.includes('browser') ||
    source.includes('history') ||
    source.includes('reading list') ||
    ['.url', '.webloc'].includes(extension)
  ) {
    return 'Browser bookmarks and web research';
  }
  if (source.includes('partner') || source.includes('organization') || source.includes('directory') || source.includes('stakeholder')) {
    return 'Partner and organization lists';
  }
  if (source.includes('strategy') || source.includes('proposal') || source.includes('grant') || source.includes('project')) {
    return 'Projects and strategy';
  }
  if (source.includes('case') || source.includes('client') || source.includes('intake') || source.includes('referral')) {
    return 'Case management material';
  }
  if (source.includes('invoice') || source.includes('receipt') || source.includes('tax') || source.includes('passport') || source.includes('license')) {
    return 'Personal admin and identity';
  }
  if (['.csv', '.tsv', '.xlsx', '.xls', '.numbers'].includes(extension)) return 'Tables and datasets';
  if (
    [
      '.aac',
      '.aif',
      '.aiff',
      '.avi',
      '.flac',
      '.gif',
      '.heic',
      '.jpg',
      '.jpeg',
      '.m4a',
      '.m4v',
      '.mkv',
      '.mov',
      '.mp3',
      '.mp4',
      '.mpeg',
      '.mpg',
      '.png',
      '.srt',
      '.vtt',
      '.wav',
      '.webm',
      '.webp',
    ].includes(extension)
  ) return 'Media and creative assets';
  if (['.eml', '.mbox', '.ics', '.vcf'].includes(extension)) return 'Calendar, email, and correspondence';
  return 'Source documents';
};

const cleanupSignalsForFile = (
  { fileName, relativePath, size, mtimeMs },
  duplicateNameCount,
  duplicateContentCount = 0,
  nearDuplicateTextCount = 0,
  sourceHistoryStatus = '',
) => {
  const lower = `${relativePath} ${fileName}`.toLowerCase();
  const signals = [];
  if (hasSensitivePathSignal(relativePath, fileName)) signals.push('sensitive-credential-review');
  const technicalArtifact = hasTechnicalArtifactSignal(relativePath, fileName);
  if (technicalArtifact) signals.push('technical-artifact-review');
  if (hasGeneratedProjectAssetSignal(relativePath, fileName)) {
    signals.push('generated-project-asset-review');
  }
  if (duplicateNameCount > 1) signals.push('duplicate-name');
  if (duplicateContentCount > 1) signals.push('duplicate-content');
  if (nearDuplicateTextCount > 1) signals.push('near-duplicate-text');
  if (sourceHistoryStatus === 'canonical-source') signals.push('known-canonical-source');
  if (sourceHistoryStatus === 'already-in-wiki') signals.push('already-ingested-source');
  if (sourceHistoryStatus === 'source-family-match') signals.push('known-source-family');
  if (sourceHistoryStatus === 'superseded-by-canonical' || sourceHistoryStatus === 'superseded-or-old-copy') {
    signals.push('known-superseded-source');
  }
  if (size > 50 * 1024 * 1024) signals.push('large-file');
  if (hasScreenshotSignal(relativePath, fileName)) signals.push('screenshot-review');
  if (hasAgentChatExportSignal(relativePath, fileName)) signals.push('agent-chat-export-review');
  if (lower.includes('copy') || lower.includes('duplicate') || lower.match(/\(\d+\)/)) signals.push('possible-copy');
  if (lower.includes('download') || lower.includes('export')) signals.push('download-export-review');
  if (Date.now() - mtimeMs > 1000 * 60 * 60 * 24 * 365 * 3) signals.push('old-file');
  return signals;
};

const suggestedCollectionsForFile = ({ rootLabel, relativePath, fileName, extension, lane, cleanupSignals, lifeDomain }) => {
  const collections = new Set([`Domain: ${lifeDomain}`, lane, `Folder: ${rootLabel}`]);
  const folderParts = relativePath
    .split(path.sep)
    .slice(0, -1)
    .filter(Boolean)
    .slice(0, 2);
  folderParts.forEach((folder) => collections.add(`Folder: ${folder}`));
  if (['.csv', '.tsv', '.xlsx', '.xls', '.numbers'].includes(extension)) {
    collections.add('Tables and structured lists');
  }
  if (['.pdf', '.doc', '.docx', '.rtf', '.odt', '.pages'].includes(extension)) {
    collections.add('Readable documents');
  }
  if (['.ppt', '.pptx', '.key'].includes(extension)) {
    collections.add('Presentations and decks');
  }
  if (['.eml', '.mbox', '.ics', '.vcf'].includes(extension)) {
    collections.add('Calendar, email, and correspondence');
  }
  if (['.url', '.webloc'].includes(extension) || lane === 'Browser bookmarks and web research') {
    collections.add('Browser bookmarks and web research');
    collections.add('Saved web links');
  }
  if (['.jpg', '.jpeg', '.png', '.webp', '.heic'].includes(extension)) {
    collections.add('Images and screenshots');
  }
  if (['.aac', '.aif', '.aiff', '.flac', '.m4a', '.mp3', '.wav'].includes(extension)) {
    collections.add('Audio recordings');
    collections.add('Needs transcript review');
  }
  if (['.avi', '.m4v', '.mkv', '.mov', '.mp4', '.mpeg', '.mpg', '.webm'].includes(extension)) {
    collections.add('Video recordings');
    collections.add('Needs transcript review');
  }
  if (['.srt', '.vtt'].includes(extension)) {
    collections.add('Transcripts and captions');
  }
  if (cleanupSignals.includes('agent-chat-export-review') || lane === 'AI chat and agent exports') {
    collections.add('AI chat exports');
    collections.add('Review before source-page creation');
  }
  if (cleanupSignals.length) {
    collections.add('Needs cleanup review');
  }
  const source = `${relativePath} ${fileName}`.toLowerCase();
  [
    ['Street Voices', 'street voices'],
    ['Systems innovation', 'innovation'],
    ['Partners and services', 'partner'],
    ['Grants and agreements', 'grant'],
    ['Grants and agreements', 'agreement'],
    ['Case management build', 'case management'],
  ].forEach(([label, keyword]) => {
    if (source.includes(keyword)) collections.add(label);
  });
  return Array.from(collections).slice(0, 8);
};

const readinessForLocalFile = ({ lane, importPriority, cleanupSignals, size, extension }) => {
  if (cleanupSignals.includes('sensitive-credential-review')) {
    return {
      importReadiness: 'blocked-sensitive',
      reviewAction: 'Quarantine credentials before ingest',
      importReason:
        'This path or filename looks like it may contain secrets, credentials, tokens, or private keys. It stays visible for cleanup, but normal wiki ingestion is blocked until a dedicated redaction flow exists.',
    };
  }
  if (lane === 'Personal admin and identity') {
    return {
      importReadiness: 'review-before-ingest',
      reviewAction: 'Human review first',
      importReason:
        'This looks personal or identity-related, so the wiki should stage it as a private standalone source before anyone attaches it elsewhere.',
    };
  }
  if (cleanupSignals.includes('technical-artifact-review') || cleanupSignals.includes('generated-project-asset-review')) {
    return {
      importReadiness: 'ready-to-review',
      reviewAction: cleanupSignals.includes('generated-project-asset-review')
        ? 'Review generated project asset'
        : 'Review project artifact',
      importReason:
        'This looks like a code, build, web asset, or project configuration artifact. Keep it separate from human/business documents unless you intentionally want development history in the wiki.',
    };
  }
  if (cleanupSignals.includes('agent-chat-export-review')) {
    return {
      importReadiness: 'ready-to-review',
      reviewAction: 'Review chat export before ingest',
      importReason:
        'This looks like a numbered chat message export or agent tool prompt. Keep it visible, but review and title it before making it a standalone wiki page.',
    };
  }
  if (cleanupSignals.includes('known-superseded-source')) {
    return {
      importReadiness: 'cleanup-candidate',
      reviewAction: 'Known superseded source',
      importReason:
        'This exact content matches a source that was previously marked superseded or old. Review the remembered canonical source before ingesting another copy.',
    };
  }
  if (cleanupSignals.includes('known-canonical-source') || cleanupSignals.includes('already-ingested-source')) {
    return {
      importReadiness: 'cleanup-candidate',
      reviewAction: 'Already represented in Case Wiki',
      importReason:
        'This exact content already appears in the Case Wiki source archive. Prefer the existing source page or canonical decision before creating another source page.',
    };
  }
  if (cleanupSignals.includes('known-source-family')) {
    return {
      importReadiness: 'cleanup-candidate',
      reviewAction: 'Review remembered source family',
      importReason:
        'This file looks connected to a remembered canonical source family. Compare it with the canonical source before extracting, embedding, or making another wiki page.',
    };
  }
  if (
    cleanupSignals.includes('duplicate-content') ||
    cleanupSignals.includes('duplicate-name') ||
    cleanupSignals.includes('near-duplicate-text') ||
    cleanupSignals.includes('possible-copy')
  ) {
    return {
      importReadiness: 'cleanup-candidate',
      reviewAction: cleanupSignals.includes('near-duplicate-text')
        ? 'Review similar sources before ingesting'
        : 'Compare before ingesting duplicates',
      importReason:
        cleanupSignals.includes('duplicate-content')
          ? 'This file has the same content hash as another source. Choose a canonical copy before ingestion, embedding, or cleanup.'
          : cleanupSignals.includes('near-duplicate-text')
            ? 'This file has a similar text fingerprint to another source. Review the overlap before attaching it, embedding it, or treating it as a separate wiki page.'
            : 'This file appears to overlap with another source. Keep it visible for cleanup and choose the best copy before bulk ingestion.',
    };
  }
  if (
    size > 50 * 1024 * 1024 ||
    ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.gif'].includes(extension) ||
    ['.aac', '.aif', '.aiff', '.avi', '.flac', '.m4a', '.m4v', '.mkv', '.mov', '.mp3', '.mp4', '.mpeg', '.mpg', '.wav', '.webm'].includes(extension)
  ) {
    return {
      importReadiness: 'review-before-ingest',
      reviewAction: ['.aac', '.aif', '.aiff', '.avi', '.flac', '.m4a', '.m4v', '.mkv', '.mov', '.mp3', '.mp4', '.mpeg', '.mpg', '.wav', '.webm'].includes(extension)
        ? 'Review transcript value'
        : 'Review parser/OCR value',
      importReason:
        'This source may need OCR, transcript extraction, metadata extraction, or a slower parser pass before it becomes a useful wiki page.',
    };
  }
  if (importPriority === 'high' || importPriority === 'medium') {
    return {
      importReadiness: 'ready-to-ingest',
      reviewAction: 'Good first wiki source',
      importReason:
        'This looks connected to Street Voices, systems work, partners, grants, or case-management planning and is a strong first-pass wiki candidate.',
    };
  }
  return {
    importReadiness: 'ready-to-review',
    reviewAction: 'Review when this topic matters',
    importReason:
      'This source is supported by the wiki pipeline, but it is not a top-priority first-pass document.',
  };
};

const priorityForFile = ({ fileName, relativePath, size }) => {
  const source = `${relativePath} ${fileName}`.toLowerCase();
  if (
    hasTechnicalArtifactSignal(relativePath, fileName) ||
    hasGeneratedProjectAssetSignal(relativePath, fileName) ||
    hasAgentChatExportSignal(relativePath, fileName) ||
    hasScreenshotSignal(relativePath, fileName)
  ) {
    return 'low';
  }
  if (source.includes('injustice') || source.includes('street voices') || source.includes('strategy') || source.includes('partner')) {
    return 'high';
  }
  if (source.includes('case') || source.includes('client') || source.includes('grant') || source.includes('proposal')) {
    return 'medium';
  }
  if (size > 120 * 1024 * 1024) return 'low';
  return 'normal';
};

const sortCandidates = (left, right) => {
  const priorityWeight = { high: 4, medium: 3, normal: 2, low: 1 };
  const weightDifference = (priorityWeight[right.importPriority] || 0) - (priorityWeight[left.importPriority] || 0);
  if (weightDifference) return weightDifference;
  return new Date(right.modifiedAt).getTime() - new Date(left.modifiedAt).getTime();
};

const DEFAULT_LOCAL_ARCHIVE_CAMPAIGN_BATCH_LIMIT = 12;

const isBlockedLocalArchiveCandidate = (candidate = {}) =>
  candidate.importReadiness === 'blocked-sensitive' ||
  (Array.isArray(candidate.cleanupSignals) && candidate.cleanupSignals.includes('sensitive-credential-review'));

const isWeakGenericSourceTitle = (candidate = {}) => {
  const baseName = String(candidate.fileName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!baseName) return true;
  if (/^[0-9]+$/.test(baseName)) return true;
  if (/^copy of /.test(baseName)) return true;
  return WEAK_GENERIC_SOURCE_TITLES.has(baseName);
};

const hasKnowledgeWikiValueSignal = (candidate = {}) => {
  if (['high', 'medium'].includes(candidate.importPriority)) return true;
  if (candidate.importPriority === 'low') return false;
  if (isWeakGenericSourceTitle(candidate)) return false;
  if (
    candidate.lifeDomainId &&
    !['unknown', 'development'].includes(candidate.lifeDomainId) &&
    candidate.lane !== 'Personal admin and identity'
  ) {
    return true;
  }
  if (['presentation', 'table', 'transcript'].includes(candidate.sourceKind)) return true;
  const source = `${candidate.relativePath || ''} ${candidate.fileName || ''} ${candidate.suggestedWikiTitle || ''}`
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
  return KNOWLEDGE_WIKI_VALUE_KEYWORDS.some((keyword) => source.includes(keyword));
};

const uniquePickyReasons = (values, limit = 6) =>
  Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean))).slice(0, limit);

const buildPickyImportReview = (candidate = {}) => {
  const cleanupSignals = Array.isArray(candidate.cleanupSignals) ? candidate.cleanupSignals : [];
  const sourceHistoryStatus = candidate.sourceHistory?.status || '';
  const hasCleanupSignal = cleanupSignals.length > 0;
  const isDevelopmentArtifact =
    candidate.lifeDomainId === 'development' ||
    candidate.lane === 'Development and code archives' ||
    cleanupSignals.includes('technical-artifact-review') ||
    cleanupSignals.includes('generated-project-asset-review');
  const isReadableSource = [
    'bookmark',
    'calendar',
    'contact',
    'document',
    'email',
    'note',
    'presentation',
    'table',
    'transcript',
  ].includes(candidate.sourceKind);

  if (isBlockedLocalArchiveCandidate(candidate)) {
    return {
      pickyTier: 'quarantine',
      pickyScore: 0,
      pickyAction: 'Do not ingest yet',
      pickyReasons: uniquePickyReasons([
        'credential-like path or filename',
        'needs redaction/quarantine before source-page creation',
      ]),
    };
  }

  if (sourceHistoryStatus === 'source-family-match') {
    return {
      pickyTier: 'lineage-review',
      pickyScore: 35,
      pickyAction: 'Compare with remembered source family',
      pickyReasons: uniquePickyReasons([
        'renamed or reformatted source-family match',
        candidate.sourceHistory?.canonicalSource?.sourceLabel
          ? `canonical source: ${candidate.sourceHistory.canonicalSource.sourceLabel}`
          : '',
        'review lineage before another wiki page is created',
      ]),
    };
  }

  if (sourceHistoryStatus) {
    return {
      pickyTier: 'cleanup-first',
      pickyScore: 25,
      pickyAction: 'Use existing source history first',
      pickyReasons: uniquePickyReasons([
        candidate.sourceHistory?.label || 'known Case Wiki source',
        candidate.sourceHistory?.recommendation || 'avoid re-importing an already represented source',
      ]),
    };
  }

  if (
    candidate.importReadiness === 'cleanup-candidate' ||
    cleanupSignals.includes('duplicate-content') ||
    cleanupSignals.includes('duplicate-name') ||
    cleanupSignals.includes('near-duplicate-text') ||
    cleanupSignals.includes('possible-copy')
  ) {
    return {
      pickyTier: 'cleanup-first',
      pickyScore: cleanupSignals.includes('duplicate-content') ? 30 : 38,
      pickyAction: cleanupSignals.includes('near-duplicate-text')
        ? 'Review similar sources before ingesting'
        : 'Choose a canonical copy before ingesting',
      pickyReasons: uniquePickyReasons([
        cleanupSignals.includes('duplicate-content') ? 'same content hash appears more than once' : '',
        cleanupSignals.includes('near-duplicate-text') ? 'similar text fingerprint found' : '',
        cleanupSignals.includes('duplicate-name') ? 'duplicate filename found' : '',
        cleanupSignals.includes('possible-copy') ? 'filename looks like a copy' : '',
      ]),
    };
  }

  if (isDevelopmentArtifact) {
    return {
      pickyTier: 'defer',
      pickyScore: 15,
      pickyAction: 'Keep in development archive lane',
      pickyReasons: uniquePickyReasons([
        'code or generated project artifact',
        'not a first-pass life-wiki source',
      ]),
    };
  }

  if (cleanupSignals.includes('agent-chat-export-review')) {
    return {
      pickyTier: 'review-first',
      pickyScore: 36,
      pickyAction: 'Title and review chat export first',
      pickyReasons: uniquePickyReasons([
        'agent/chat export needs human naming',
        'candidate can become useful after review',
      ]),
    };
  }

  if (candidate.importReadiness === 'review-before-ingest' || candidate.lane === 'Personal admin and identity') {
    return {
      pickyTier: 'review-first',
      pickyScore: 45,
      pickyAction: candidate.lane === 'Personal admin and identity' ? 'Privacy review first' : 'Review parser value first',
      pickyReasons: uniquePickyReasons([
        candidate.lane === 'Personal admin and identity' ? 'personal/admin material' : '',
        ['audio', 'video'].includes(candidate.sourceKind) ? 'transcript needed before wiki page value is clear' : '',
        candidate.sourceKind === 'image' ? 'OCR or visual review needed' : '',
        'keep standalone until reviewed',
      ]),
    };
  }

  let score = 0;
  if (candidate.importPriority === 'high') score += 40;
  else if (candidate.importPriority === 'medium') score += 30;
  else if (candidate.importPriority === 'normal') score += 12;
  if (candidate.importReadiness === 'ready-to-ingest') score += 25;
  if (isReadableSource) score += 15;
  if (hasKnowledgeWikiValueSignal(candidate)) score += 25;
  if (candidate.lifeDomainId && !['unknown', 'development'].includes(candidate.lifeDomainId)) score += 10;
  if (isWeakGenericSourceTitle(candidate)) score -= 35;
  if (hasCleanupSignal) score -= 20;
  const boundedScore = Math.max(0, Math.min(100, score));

  if (boundedScore >= 70) {
    return {
      pickyTier: 'import-now',
      pickyScore: boundedScore,
      pickyAction: 'Stage as a standalone wiki source',
      pickyReasons: uniquePickyReasons([
        `${candidate.importPriority || 'normal'} priority`,
        candidate.lifeDomain ? `${candidate.lifeDomain} domain` : '',
        isReadableSource ? `${candidate.sourceKind} source` : '',
        hasKnowledgeWikiValueSignal(candidate) ? 'knowledge-wiki value signal' : '',
        'no cleanup/source-history block',
      ]),
    };
  }

  if (boundedScore >= 45) {
    return {
      pickyTier: 'review-first',
      pickyScore: boundedScore,
      pickyAction: 'Review before selecting for ingest',
      pickyReasons: uniquePickyReasons([
        candidate.importPriority ? `${candidate.importPriority} priority` : '',
        candidate.lifeDomain ? `${candidate.lifeDomain} domain` : '',
        isReadableSource ? `${candidate.sourceKind} source` : '',
        hasKnowledgeWikiValueSignal(candidate) ? 'potential wiki value' : '',
      ]),
    };
  }

  return {
    pickyTier: 'defer',
    pickyScore: boundedScore,
    pickyAction: 'Defer until higher-value sources are organized',
    pickyReasons: uniquePickyReasons([
      isWeakGenericSourceTitle(candidate) ? 'generic title' : '',
      candidate.lifeDomainId === 'unknown' ? 'unknown domain' : '',
      candidate.importPriority === 'low' ? 'low priority' : '',
      'not a first-pass wiki source',
    ]),
  };
};

const makeCampaignPass = ({
  id,
  label,
  intent,
  description,
  candidates,
  actionLabel,
  safetyNote,
  batchLimit,
}) => {
  const visibleCandidates = (Array.isArray(candidates) ? candidates : []).filter(
    (candidate) => candidate && candidate.id && !isBlockedLocalArchiveCandidate(candidate),
  );
  return {
    id,
    label,
    intent,
    description,
    actionLabel,
    safetyNote,
    count: visibleCandidates.length,
    candidateIds: visibleCandidates.slice(0, batchLimit).map((candidate) => candidate.id),
    sampleTitles: visibleCandidates
      .slice(0, 4)
      .map((candidate) => candidate.suggestedWikiTitle || candidate.fileName)
      .filter(Boolean),
  };
};

const buildLocalArchiveCampaignPlan = (candidates = []) => {
  const batchLimit = toPositiveInteger(
    process.env.CASE_MANAGEMENT_LOCAL_ARCHIVE_CAMPAIGN_BATCH_LIMIT,
    DEFAULT_LOCAL_ARCHIVE_CAMPAIGN_BATCH_LIMIT,
  );
  const selectable = candidates.filter((candidate) => !isBlockedLocalArchiveCandidate(candidate));
  const hasSourceHistory = (candidate) => Boolean(candidate.sourceHistory?.status);
  const isSourceFamilyMatch = (candidate) => candidate.sourceHistory?.status === 'source-family-match';
  const hasCleanupSignal = (candidate) => Array.isArray(candidate.cleanupSignals) && candidate.cleanupSignals.length > 0;
  const isDevelopmentArtifact = (candidate) =>
    candidate.lifeDomainId === 'development' ||
    candidate.lane === 'Development and code archives' ||
    (Array.isArray(candidate.cleanupSignals) &&
      (candidate.cleanupSignals.includes('technical-artifact-review') ||
        candidate.cleanupSignals.includes('generated-project-asset-review')));
  const isReadableSource = (candidate) =>
    [
      'bookmark',
      'calendar',
      'contact',
      'document',
      'email',
      'note',
      'presentation',
      'table',
      'transcript',
    ].includes(candidate.sourceKind);

  const cleanHighValue = selectable.filter(
    (candidate) =>
      !hasSourceHistory(candidate) &&
      !hasCleanupSignal(candidate) &&
      !isDevelopmentArtifact(candidate) &&
      candidate.importReadiness === 'ready-to-ingest' &&
      ['high', 'medium'].includes(candidate.importPriority),
  );
  const cleanupReview = selectable.filter(
    (candidate) =>
      !hasSourceHistory(candidate) &&
      !isDevelopmentArtifact(candidate) &&
      (candidate.importReadiness === 'cleanup-candidate' ||
        hasCleanupSignal(candidate) ||
        candidate.duplicateGroupKey ||
        candidate.nearDuplicateGroupKey),
  );
  const sourceFamilyReview = selectable.filter(
    (candidate) => !isDevelopmentArtifact(candidate) && isSourceFamilyMatch(candidate),
  );
  const transcriptReview = selectable.filter((candidate) => ['audio', 'video'].includes(candidate.sourceKind));
  const personalReview = selectable.filter(
    (candidate) =>
      !isDevelopmentArtifact(candidate) &&
      (['Admin', 'Personal'].includes(candidate.lifeDomain) ||
        candidate.lane === 'Personal admin and identity'),
  );
  const sourceHistoryReview = selectable.filter(
    (candidate) => !isDevelopmentArtifact(candidate) && hasSourceHistory(candidate) && !isSourceFamilyMatch(candidate),
  );
  const readableExtraction = selectable.filter(
    (candidate) =>
      !hasSourceHistory(candidate) &&
      !hasCleanupSignal(candidate) &&
      !isDevelopmentArtifact(candidate) &&
      hasKnowledgeWikiValueSignal(candidate) &&
      isReadableSource(candidate) &&
      candidate.importReadiness !== 'review-before-ingest',
  );
  const pickyRecommended = selectable.filter(
    (candidate) =>
      candidate.pickyTier === 'import-now' &&
      !hasSourceHistory(candidate) &&
      !hasCleanupSignal(candidate) &&
      !isDevelopmentArtifact(candidate),
  );
  const visualOcrReview = selectable.filter(
    (candidate) =>
      !isDevelopmentArtifact(candidate) &&
      (candidate.sourceKind === 'image' ||
        (Array.isArray(candidate.cleanupSignals) && candidate.cleanupSignals.includes('screenshot-review'))),
  );
  const developmentReview = selectable.filter(isDevelopmentArtifact);
  const pickedCandidates = new Set([
    ...pickyRecommended,
    ...cleanHighValue,
    ...cleanupReview,
    ...sourceFamilyReview,
    ...transcriptReview,
    ...personalReview,
    ...sourceHistoryReview,
    ...readableExtraction,
    ...visualOcrReview,
    ...developmentReview,
  ]);
  const longTailReview = selectable.filter(
    (candidate) =>
      !pickedCandidates.has(candidate),
  );

  const passes = [
    makeCampaignPass({
      id: 'picky-recommended',
      label: 'Picky recommended sources',
      intent: 'picky-catalog-first',
      description:
        'Best first-pass whole-life wiki candidates: high signal, readable, source-first, and not blocked by duplicate, source-history, privacy, or cleanup warnings.',
      actionLabel: 'Select picky pass',
      safetyNote: 'Catalog as standalone source pages first. This pass avoids duplicates, source-family matches, generic files, and private review items.',
      candidates: pickyRecommended,
      batchLimit,
    }),
    makeCampaignPass({
      id: 'clean-high-value',
      label: 'Clean high-value sources',
      intent: 'catalog-first',
      description:
        'Start here: strong Street Voices, partner, strategy, grant, or case-management candidates with no cleanup flags.',
      actionLabel: 'Select clean pass',
      safetyNote: 'Catalog as standalone source pages first; no client/case attachment and no vector write.',
      candidates: cleanHighValue,
      batchLimit,
    }),
    makeCampaignPass({
      id: 'readable-extraction',
      label: 'Curated readable queue',
      intent: 'extract-after-catalog',
      description:
        'Readable sources that appear useful for the life/case wiki. Generic notes, test files, and low-value artifacts stay out of this pass.',
      actionLabel: 'Select curated pass',
      safetyNote: 'Extract into review chunks, then approve chunks before any Weaviate dry-run.',
      candidates: readableExtraction,
      batchLimit,
    }),
    makeCampaignPass({
      id: 'cleanup-and-canonical',
      label: 'Cleanup and canonical review',
      intent: 'cleanup-review',
      description:
        'Duplicates, near-matches, screenshots, downloads, exports, old copies, and source-history conflicts that need a human decision before ingesting.',
      actionLabel: 'Select cleanup pass',
      safetyNote: 'Use this to choose canonical copies. The system still does not move, rename, or delete local files.',
      candidates: cleanupReview,
      batchLimit,
    }),
    makeCampaignPass({
      id: 'source-family-review',
      label: 'Source-family review',
      intent: 'lineage-review',
      description:
        'Renamed or lightly reformatted files that look connected to remembered canonical source families. Confirm lineage before cataloging, extraction, or embedding.',
      actionLabel: 'Select source-family pass',
      safetyNote: 'Compare with the remembered canonical source first. No vectors, attachments, file moves, or deletes happen in this pass.',
      candidates: sourceFamilyReview,
      batchLimit,
    }),
    makeCampaignPass({
      id: 'media-transcript-review',
      label: 'Media transcript review',
      intent: 'transcript-needed',
      description:
        'Audio and video files should become wiki pages only after transcript value is confirmed or a transcript is attached.',
      actionLabel: 'Select media pass',
      safetyNote: 'Raw media is staged metadata-only until transcription exists.',
      candidates: transcriptReview,
      batchLimit,
    }),
    makeCampaignPass({
      id: 'personal-admin-review',
      label: 'Personal and admin review',
      intent: 'privacy-review',
      description:
        'Personal, identity, admin, receipt, tax, health, or family-adjacent files need privacy review before extraction or embedding.',
      actionLabel: 'Select private pass',
      safetyNote: 'Keep strict redaction and standalone source boundaries on this pass.',
      candidates: personalReview,
      batchLimit,
    }),
    makeCampaignPass({
      id: 'known-source-history',
      label: 'Already-known source history',
      intent: 'source-history-review',
      description:
        'Files matching existing Case Wiki hashes, canonical sources, or superseded sources should be linked to existing wiki history before new ingestion.',
      actionLabel: 'Select known-source pass',
      safetyNote: 'Prefer existing canonical source pages instead of creating duplicate wiki records.',
      candidates: sourceHistoryReview,
      batchLimit,
    }),
    makeCampaignPass({
      id: 'visual-ocr-review',
      label: 'Visual OCR review',
      intent: 'ocr-needed',
      description:
        'Images and screenshots likely need OCR or metadata review before they become useful wiki pages.',
      actionLabel: 'Select visual pass',
      safetyNote: 'Stage these separately so screenshots do not flood the source archive.',
      candidates: visualOcrReview,
      batchLimit,
    }),
    makeCampaignPass({
      id: 'development-code-review',
      label: 'Development and code archive review',
      intent: 'development-review',
      description:
        'Repository documentation, dependency metadata, generated web assets, package configs, and code-adjacent files stay in a separate lane.',
      actionLabel: 'Select development pass',
      safetyNote: 'Only use this when you intentionally want software project history in the wiki.',
      candidates: developmentReview,
      batchLimit,
    }),
    makeCampaignPass({
      id: 'long-tail-review',
      label: 'Long-tail archive review',
      intent: 'review-later',
      description:
        'Supported but lower-priority files that can wait until the core life domains are organized.',
      actionLabel: 'Select long-tail pass',
      safetyNote: 'Use after the high-value, cleanup, and privacy passes are under control.',
      candidates: longTailReview,
      batchLimit,
    }),
  ].filter((pass) => pass.count > 0);

  const nextPass =
    passes.find((pass) => pass.id === 'source-family-review') ||
    passes.find((pass) => pass.id === 'picky-recommended') ||
    passes.find((pass) => pass.id === 'clean-high-value') ||
    passes.find((pass) => pass.id === 'readable-extraction') ||
    passes.find((pass) => pass.id === 'media-transcript-review') ||
    passes.find((pass) => pass.id === 'personal-admin-review') ||
    passes.find((pass) => pass.id === 'known-source-history') ||
    passes.find((pass) => pass.id === 'cleanup-and-canonical') ||
    passes[0] ||
    null;

  return {
    generatedAt: new Date().toISOString(),
    safeBatchLimit: batchLimit,
    selectableCount: selectable.length,
    blockedCount: candidates.filter(isBlockedLocalArchiveCandidate).length,
    passCount: passes.length,
    nextPassId: nextPass?.id || '',
    nextAction: nextPass
      ? `${nextPass.label}: ${nextPass.description}`
      : 'No selectable source files were found in this scan.',
    policy:
      'Campaign passes select source candidates only. They do not attach sources to clients/cases, write vectors, rename local files, or delete local files.',
    passes,
  };
};

const localArchiveConfig = async () => {
  const roots = await getConfiguredRoots();
  const vectorProvider = process.env.CASE_MANAGEMENT_VECTOR_PROVIDER || 'weaviate';
  return {
    enabled: toBoolean(process.env.CASE_MANAGEMENT_LOCAL_ARCHIVE_ENABLED, true) && roots.length > 0,
    roots: roots.map(({ id, label }) => ({ id, label })),
    graphProvider: 'neo4j',
    vectorProvider,
    semanticIndexMode: process.env.CASE_MANAGEMENT_VECTOR_WRITE_ENABLED === 'true' ? 'write-enabled' : 'planned',
  };
};

const scanLocalArchive = async ({
  query = '',
  rootIds = [],
  limit = 160,
  maxDepth = 5,
  includeHidden = false,
  maxBytes = 200 * 1024 * 1024,
  sourceHistory = [],
} = {}) => {
  const roots = await getConfiguredRoots();
  const allowedRootIds = new Set(Array.isArray(rootIds) ? rootIds.filter(Boolean) : []);
  const selectedRoots = allowedRootIds.size ? roots.filter((root) => allowedRootIds.has(root.id)) : roots;
  const queryText = String(query || '').trim().toLowerCase();
  const candidates = [];
  const skipped = {
    directories: 0,
    hidden: 0,
    unsupported: 0,
    tooLarge: 0,
    unreadable: 0,
  };

  const visit = async (root, currentPath, depth) => {
    if (candidates.length >= SCAN_CANDIDATE_BUFFER || depth > maxDepth) return;
    let entries = [];
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      skipped.unreadable += 1;
      return;
    }

    for (const entry of entries) {
      if (candidates.length >= SCAN_CANDIDATE_BUFFER) break;
      if (!includeHidden && entry.name.startsWith('.')) {
        skipped.hidden += 1;
        continue;
      }

      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (isSkippedDirectoryName(entry.name)) {
          skipped.directories += 1;
          continue;
        }
        await visit(root, entryPath, depth + 1);
        continue;
      }

      if (!entry.isFile()) continue;
      const extension = extensionForName(entry.name);
      if (!IMPORTANT_EXTENSIONS.has(extension)) {
        skipped.unsupported += 1;
        continue;
      }

      let stat;
      try {
        stat = await fs.stat(entryPath);
      } catch {
        skipped.unreadable += 1;
        continue;
      }
      if (stat.size > maxBytes) {
        skipped.tooLarge += 1;
        continue;
      }

      const relativePath = path.relative(root.path, entryPath);
      if (queryText && !`${relativePath} ${entry.name}`.toLowerCase().includes(queryText)) continue;
      candidates.push({
        id: hashLocalId(root.id, relativePath),
        absolutePath: entryPath,
        rootId: root.id,
        rootLabel: root.label,
        relativePath,
        displayPath: path.join(root.label, relativePath),
        fileName: entry.name,
        extension,
        mimeType: mimeTypeForName(entry.name),
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        lane: laneForLocalFile(relativePath, entry.name),
        importPriority: priorityForFile({ fileName: entry.name, relativePath, size: stat.size }),
      });
    }
  };

  for (const root of selectedRoots) {
    await visit(root, root.path, 0);
  }

  const duplicateNames = candidates.reduce((counts, candidate) => {
    const key = candidate.fileName.toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  const hashMaxBytes = toPositiveInteger(
    process.env.CASE_MANAGEMENT_LOCAL_ARCHIVE_HASH_MAX_BYTES,
    DEFAULT_LOCAL_ARCHIVE_HASH_MAX_BYTES,
  );
  const hashLimit = toPositiveInteger(
    process.env.CASE_MANAGEMENT_LOCAL_ARCHIVE_HASH_LIMIT,
    Math.max(limit, DEFAULT_LOCAL_ARCHIVE_HASH_LIMIT),
  );
  const hashEligibleCandidates = candidates
    .filter((candidate) => candidate.size <= hashMaxBytes)
    .filter((candidate) => !hasSensitivePathSignal(candidate.relativePath, candidate.fileName))
    .sort(sortCandidates)
    .slice(0, hashLimit);
  const hashEligibleIds = new Set(hashEligibleCandidates.map((candidate) => candidate.id));
  const sourceHashById = {};
  let hashUnreadable = 0;

  for (const candidate of hashEligibleCandidates) {
    try {
      sourceHashById[candidate.id] = await hashLocalFileSha256(candidate.absolutePath);
    } catch {
      hashUnreadable += 1;
    }
  }

  const sourceHashCounts = Object.values(sourceHashById).reduce((counts, sourceHash) => {
    counts[sourceHash] = (counts[sourceHash] || 0) + 1;
    return counts;
  }, {});
  const {
    historyByHash: sourceHistoryByHash,
    lineageMatchers: sourceHistoryLineageMatchers,
    summary: sourceHistoryRecordSummary,
  } =
    buildSourceHistoryByHash(sourceHistory);

  const textFingerprintMaxBytes = toPositiveInteger(
    process.env.CASE_MANAGEMENT_LOCAL_ARCHIVE_TEXT_FINGERPRINT_MAX_BYTES,
    DEFAULT_LOCAL_ARCHIVE_TEXT_FINGERPRINT_MAX_BYTES,
  );
  const textFingerprintLimit = toPositiveInteger(
    process.env.CASE_MANAGEMENT_LOCAL_ARCHIVE_TEXT_FINGERPRINT_LIMIT,
    Math.max(limit, DEFAULT_LOCAL_ARCHIVE_TEXT_FINGERPRINT_LIMIT),
  );
  const textSimilarityThreshold = toBoundedNumber(
    process.env.CASE_MANAGEMENT_LOCAL_ARCHIVE_TEXT_SIMILARITY_THRESHOLD,
    DEFAULT_LOCAL_ARCHIVE_TEXT_SIMILARITY_THRESHOLD,
    0.1,
    0.95,
  );
  const textFingerprintEligibleCandidates = candidates
    .filter((candidate) => Boolean(TEXT_MIME_BY_EXTENSION[candidate.extension]))
    .filter((candidate) => candidate.size <= textFingerprintMaxBytes)
    .filter((candidate) => !hasSensitivePathSignal(candidate.relativePath, candidate.fileName))
    .sort(sortCandidates)
    .slice(0, textFingerprintLimit);
  const textFingerprintEligibleIds = new Set(textFingerprintEligibleCandidates.map((candidate) => candidate.id));
  const textFingerprintById = {};
  const textFingerprintStatusById = {};
  let textFingerprintUnreadable = 0;
  let textFingerprintInsufficient = 0;

  for (const candidate of textFingerprintEligibleCandidates) {
    try {
      const content = await readLocalFilePrefix(candidate.absolutePath, textFingerprintMaxBytes);
      const fingerprint = textFingerprintForContent(content);
      if (fingerprint.terms.length < 8) {
        textFingerprintStatusById[candidate.id] = 'insufficient-text';
        textFingerprintInsufficient += 1;
      } else {
        textFingerprintById[candidate.id] = fingerprint;
        textFingerprintStatusById[candidate.id] = 'fingerprinted';
      }
    } catch {
      textFingerprintStatusById[candidate.id] = 'unreadable';
      textFingerprintUnreadable += 1;
    }
  }

  const nearDuplicateTextById = buildNearDuplicateTextGroups(
    textFingerprintById,
    sourceHashById,
    textSimilarityThreshold,
  );

  const enriched = candidates
    .map((candidate) => {
      const duplicateCount = duplicateNames[candidate.fileName.toLowerCase()] || 0;
      const sourceHash = sourceHashById[candidate.id] || '';
      const contentDuplicateCount = sourceHash ? sourceHashCounts[sourceHash] || 0 : 0;
      const nearDuplicateText = nearDuplicateTextById[candidate.id];
      const nearDuplicateTextCount = nearDuplicateText?.count || 0;
      const sourceHistoryExactMatch = sourceHash ? sourceHistoryByHash[sourceHash] : null;
      const sourceHistoryMatch =
        sourceHistoryExactMatch ||
        sourceHistoryLineageMatchForFile(candidate, textFingerprintById[candidate.id], sourceHistoryLineageMatchers);
      const cleanupSignals = cleanupSignalsForFile(
        {
          fileName: candidate.fileName,
          relativePath: candidate.relativePath,
          size: candidate.size,
          mtimeMs: new Date(candidate.modifiedAt).getTime(),
        },
        duplicateCount,
        contentDuplicateCount,
        nearDuplicateTextCount,
        sourceHistoryMatch?.status || '',
      );
      const readiness = readinessForLocalFile({
        lane: candidate.lane,
        importPriority: candidate.importPriority,
        cleanupSignals,
        size: candidate.size,
        extension: candidate.extension,
      });
      const lifeDomain = lifeDomainForFile({
        relativePath: candidate.relativePath,
        fileName: candidate.fileName,
        lane: candidate.lane,
        extension: candidate.extension,
      });
      const sourceKind = sourceKindForFile(candidate.extension, candidate.fileName);
      const suggestedCollections = suggestedCollectionsForFile({
        rootLabel: candidate.rootLabel,
        relativePath: candidate.relativePath,
        fileName: candidate.fileName,
        extension: candidate.extension,
        lane: candidate.lane,
        cleanupSignals,
        lifeDomain: lifeDomain.label,
      });
      const { absolutePath, ...publicCandidate } = candidate;
      const sourceHashStatus = sourceHash
        ? 'hashed'
        : hasSensitivePathSignal(candidate.relativePath, candidate.fileName)
          ? 'skipped-sensitive'
          : candidate.size > hashMaxBytes
            ? 'skipped-large-file'
            : hashEligibleIds.has(candidate.id)
              ? 'unreadable'
              : 'not-scanned';
      const textFingerprintStatus = textFingerprintById[candidate.id]
        ? 'fingerprinted'
        : hasSensitivePathSignal(candidate.relativePath, candidate.fileName)
          ? 'skipped-sensitive'
          : !TEXT_MIME_BY_EXTENSION[candidate.extension]
            ? 'unsupported'
            : candidate.size > textFingerprintMaxBytes
              ? 'skipped-large-file'
              : textFingerprintStatusById[candidate.id] || (textFingerprintEligibleIds.has(candidate.id) ? 'unreadable' : 'not-scanned');
      const enrichedCandidate = {
        ...publicCandidate,
        lifeDomain: lifeDomain.label,
        lifeDomainId: lifeDomain.id,
        sourceKind,
        cleanupSignals,
        duplicateCount: Math.max(duplicateCount, contentDuplicateCount, nearDuplicateTextCount),
        duplicateGroupKey:
          contentDuplicateCount > 1
            ? `same-content:${sourceHash.slice(0, 16)}`
            : duplicateCount > 1
              ? `same-name:${candidate.fileName.toLowerCase()}`
              : nearDuplicateText?.groupKey || '',
        sourceHash,
        sourceHashStatus,
        contentDuplicateCount,
        contentDuplicateGroupKey: contentDuplicateCount > 1 ? `same-content:${sourceHash.slice(0, 16)}` : '',
        textFingerprintStatus,
        textFingerprintTerms: textFingerprintById[candidate.id]?.terms.slice(0, 12) || [],
        nearDuplicateCount: nearDuplicateTextCount,
        nearDuplicateGroupKey: nearDuplicateText?.groupKey || '',
        nearDuplicateScore: nearDuplicateText?.maxScore || 0,
        nearDuplicateTerms: nearDuplicateText?.sharedTerms || [],
        sourceHistory: sourceHistoryMatch || null,
        suggestedWikiTitle: normalizeTitle(candidate.fileName),
        suggestedCollections,
        ...readiness,
        graphTarget: 'Neo4j CaseManagementKnowledge',
        vectorTarget: process.env.CASE_MANAGEMENT_VECTOR_PROVIDER || 'weaviate',
        sourceBoundary: 'standalone-source',
      };
      return {
        ...enrichedCandidate,
        ...buildPickyImportReview(enrichedCandidate),
      };
    })
    .sort(sortCandidates)
    .slice(0, limit);

  const laneCounts = enriched.reduce((counts, candidate) => {
    counts[candidate.lane] = (counts[candidate.lane] || 0) + 1;
    return counts;
  }, {});
  const cleanupCounts = enriched.reduce((counts, candidate) => {
    candidate.cleanupSignals.forEach((signal) => {
      counts[signal] = (counts[signal] || 0) + 1;
    });
    return counts;
  }, {});
  const priorityCounts = enriched.reduce((counts, candidate) => {
    counts[candidate.importPriority] = (counts[candidate.importPriority] || 0) + 1;
    return counts;
  }, {});
  const readinessCounts = enriched.reduce((counts, candidate) => {
    counts[candidate.importReadiness] = (counts[candidate.importReadiness] || 0) + 1;
    return counts;
  }, {});
  const rootCounts = enriched.reduce((counts, candidate) => {
    counts[candidate.rootLabel] = (counts[candidate.rootLabel] || 0) + 1;
    return counts;
  }, {});
  const collectionCounts = enriched.reduce((counts, candidate) => {
    candidate.suggestedCollections.forEach((collection) => {
      counts[collection] = (counts[collection] || 0) + 1;
    });
    return counts;
  }, {});
  const domainCounts = enriched.reduce((counts, candidate) => {
    counts[candidate.lifeDomain] = (counts[candidate.lifeDomain] || 0) + 1;
    return counts;
  }, {});
  const sourceKindCounts = enriched.reduce((counts, candidate) => {
    counts[candidate.sourceKind] = (counts[candidate.sourceKind] || 0) + 1;
    return counts;
  }, {});
  const pickyTierCounts = enriched.reduce((counts, candidate) => {
    counts[candidate.pickyTier || 'defer'] = (counts[candidate.pickyTier || 'defer'] || 0) + 1;
    return counts;
  }, {});
  const pickyRecommendedCount = enriched.filter((candidate) => candidate.pickyTier === 'import-now').length;
  const contentDuplicateGroups = Object.values(sourceHashCounts).filter((count) => count > 1).length;
  const contentDuplicateFiles = enriched.filter((candidate) => candidate.contentDuplicateCount > 1).length;
  const nearDuplicateTextGroups = new Set(
    enriched.map((candidate) => candidate.nearDuplicateGroupKey).filter(Boolean),
  ).size;
  const nearDuplicateTextFiles = enriched.filter((candidate) => candidate.nearDuplicateCount > 1).length;
  const sourceHistoryMatches = enriched.filter((candidate) => candidate.sourceHistory?.status).length;
  const sourceHistoryCanonicalMatches = enriched.filter(
    (candidate) => candidate.sourceHistory?.status === 'canonical-source',
  ).length;
  const sourceHistorySupersededMatches = enriched.filter(
    (candidate) =>
      candidate.sourceHistory?.status === 'superseded-by-canonical' ||
      candidate.sourceHistory?.status === 'superseded-or-old-copy',
  ).length;
  const sourceHistoryLineageMatches = enriched.filter(
    (candidate) => candidate.sourceHistory?.status === 'source-family-match',
  ).length;

  return {
    ...(await localArchiveConfig()),
    scannedAt: new Date().toISOString(),
    query: queryText,
    limit,
    candidates: enriched,
    campaignPlan: buildLocalArchiveCampaignPlan(enriched),
    summary: {
      totalCandidates: enriched.length,
      discoveredCandidates: candidates.length,
      returnedCandidates: enriched.length,
      limitApplied: candidates.length > enriched.length,
      totalBytes: enriched.reduce((sum, candidate) => sum + candidate.size, 0),
      laneCounts,
      cleanupCounts,
      priorityCounts,
      readinessCounts,
      rootCounts,
      collectionCounts,
      domainCounts,
      sourceKindCounts,
      pickyTierCounts,
      pickyRecommendedCount,
      hashSummary: {
        enabled: true,
        hashedFiles: Object.keys(sourceHashById).length,
        hashLimit,
        hashMaxBytes,
        skippedLarge: enriched.filter((candidate) => candidate.sourceHashStatus === 'skipped-large-file').length,
        skippedSensitive: enriched.filter((candidate) => candidate.sourceHashStatus === 'skipped-sensitive').length,
        unreadable: hashUnreadable,
        contentDuplicateGroups,
        contentDuplicateFiles,
      },
      textSimilaritySummary: {
        enabled: true,
        fingerprintedFiles: Object.keys(textFingerprintById).length,
        fingerprintLimit: textFingerprintLimit,
        fingerprintMaxBytes: textFingerprintMaxBytes,
        threshold: textSimilarityThreshold,
        skippedLarge: enriched.filter((candidate) => candidate.textFingerprintStatus === 'skipped-large-file').length,
        skippedSensitive: enriched.filter((candidate) => candidate.textFingerprintStatus === 'skipped-sensitive').length,
        unsupported: enriched.filter((candidate) => candidate.textFingerprintStatus === 'unsupported').length,
        unreadable: textFingerprintUnreadable,
        insufficientText: textFingerprintInsufficient,
        nearDuplicateGroups: nearDuplicateTextGroups,
        nearDuplicateFiles: nearDuplicateTextFiles,
      },
      sourceHistorySummary: {
        enabled: true,
        knownSources: sourceHistoryRecordSummary.knownSources,
        canonicalSources: sourceHistoryRecordSummary.canonicalSources,
        supersededSources: sourceHistoryRecordSummary.supersededSources,
        alreadyInWikiSources: sourceHistoryRecordSummary.alreadyInWikiSources,
        lineageSources: sourceHistoryRecordSummary.lineageSources,
        matchedFiles: sourceHistoryMatches,
        canonicalMatches: sourceHistoryCanonicalMatches,
        supersededMatches: sourceHistorySupersededMatches,
        lineageMatches: sourceHistoryLineageMatches,
      },
      skipped,
    },
  };
};

const resolveLocalArchiveFile = async ({ rootId, relativePath: requestedRelativePath }) => {
  const roots = await getConfiguredRoots();
  const root = roots.find((candidate) => candidate.id === rootId);
  if (!root) throw new Error('Local archive root is not available');
  const resolved = path.resolve(root.path, requestedRelativePath || '');
  if (!resolved.startsWith(`${root.path}${path.sep}`) && resolved !== root.path) {
    throw new Error('Local archive file is outside the allowed root');
  }
  const stat = await fs.stat(resolved);
  if (!stat.isFile()) throw new Error('Local archive path is not a file');
  if (stat.size > 200 * 1024 * 1024) throw new Error('Local archive file exceeds the ingest size limit');
  const relativePath = path.relative(root.path, resolved);
  const fileName = path.basename(resolved);
  const cleanupSignals = cleanupSignalsForFile(
    {
      fileName,
      relativePath,
      size: stat.size,
      mtimeMs: stat.mtime.getTime(),
    },
    1,
  );
  const readiness = readinessForLocalFile({
    lane: laneForLocalFile(relativePath, fileName),
    importPriority: priorityForFile({ fileName, relativePath, size: stat.size }),
    cleanupSignals,
    size: stat.size,
    extension: extensionForName(fileName),
  });
  if (readiness.importReadiness === 'blocked-sensitive') {
    throw new Error('Sensitive credential-like local archive files are blocked from wiki ingest');
  }

  return {
    path: resolved,
    fileName,
    relativePath,
    rootId: root.id,
    rootLabel: root.label,
    size: stat.size,
    mimeType: mimeTypeForName(resolved),
    modifiedAt: stat.mtime.toISOString(),
  };
};

module.exports = {
  localArchiveConfig,
  scanLocalArchive,
  resolveLocalArchiveFile,
};

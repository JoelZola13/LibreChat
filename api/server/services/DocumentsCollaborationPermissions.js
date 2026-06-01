const DEFAULT_DOCUMENTS_API_BASE = 'https://librechat-api-production.up.railway.app';
const DEFAULT_DOCUMENTS_API_PREFIX = '/sbapi';
const DEFAULT_PERMISSION_TIMEOUT_MS = 8 * 1000;
const ACCESS_DENIED_STATUSES = new Set([401, 403, 404]);

function parsePositiveInteger(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function isExplicitlyDisabled(value) {
  return ['0', 'false', 'off', 'no', 'disabled'].includes(String(value || '').toLowerCase().trim());
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeDocumentsApiBase(value) {
  const trimmed = String(value || '').trim();

  return (trimmed || DEFAULT_DOCUMENTS_API_BASE).replace(/\/+$/, '');
}

function normalizeDocumentsApiPrefix(value) {
  const trimmed = String(value == null ? DEFAULT_DOCUMENTS_API_PREFIX : value).trim();

  if (!trimmed || trimmed === '/') {
    return '';
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

function getDocumentsApiBase() {
  return normalizeDocumentsApiBase(
    process.env.DOCUMENTS_COLLABORATION_DOCUMENTS_API_BASE ||
      process.env.SBAPI_TARGET ||
      DEFAULT_DOCUMENTS_API_BASE,
  );
}

function getDocumentsApiPrefix() {
  return normalizeDocumentsApiPrefix(
    hasOwn(process.env, 'DOCUMENTS_COLLABORATION_DOCUMENTS_API_PREFIX')
      ? process.env.DOCUMENTS_COLLABORATION_DOCUMENTS_API_PREFIX
      : DEFAULT_DOCUMENTS_API_PREFIX,
  );
}

function getPermissionTimeoutMs() {
  return parsePositiveInteger(
    process.env.DOCUMENTS_COLLABORATION_PERMISSION_TIMEOUT_MS,
    DEFAULT_PERMISSION_TIMEOUT_MS,
  );
}

function isDocumentsCollaborationPermissionCheckEnabled() {
  return !isExplicitlyDisabled(process.env.DOCUMENTS_COLLABORATION_PERMISSION_CHECK_ENABLED);
}

function appendPath(baseUrl, segments) {
  const url = new URL(baseUrl);
  const basePath = url.pathname.replace(/\/+$/, '');
  const suffix = segments
    .map((segment) => String(segment || '').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');

  url.pathname = `${basePath}/${suffix}`.replace(/\/{2,}/g, '/');
  return url;
}

function createDocumentsApiDocumentAccessUrl(options = {}) {
  const documentsApiBase = normalizeDocumentsApiBase(
    hasOwn(options, 'documentsApiBase') ? options.documentsApiBase : getDocumentsApiBase(),
  );
  const configuredPrefix = normalizeDocumentsApiPrefix(
    hasOwn(options, 'documentsApiPrefix') ? options.documentsApiPrefix : getDocumentsApiPrefix(),
  );
  const baseUrl = new URL(documentsApiBase);
  const basePath = baseUrl.pathname.replace(/\/+$/, '');
  const documentsApiPrefix =
    configuredPrefix && basePath.endsWith(configuredPrefix) ? '' : configuredPrefix;
  const url = appendPath(documentsApiBase, [
    documentsApiPrefix,
    'api',
    'documents',
    options.documentId,
  ]);

  url.searchParams.set('user_id', options.userId);
  return url.toString();
}

function getDocumentAccessFailureReason(status) {
  if (ACCESS_DENIED_STATUSES.has(status)) {
    return 'access_denied';
  }

  if (status >= 500) {
    return 'documents_api_unavailable';
  }

  return 'documents_api_rejected';
}

async function verifyDocumentsCollaborationDocumentAccess(options = {}) {
  const permissionCheckEnabled = hasOwn(options, 'permissionCheckEnabled')
    ? options.permissionCheckEnabled
    : isDocumentsCollaborationPermissionCheckEnabled();

  if (!permissionCheckEnabled) {
    return { ok: true, skipped: true, reason: 'permission_check_disabled' };
  }

  const documentId = String(options.documentId || '').trim();
  const userId = String(options.userId || '').trim();

  if (!documentId || !userId) {
    return { ok: false, status: 400, reason: 'missing_document_or_user' };
  }

  let url;

  try {
    const accessUrlOptions = { documentId, userId };

    if (hasOwn(options, 'documentsApiBase')) {
      accessUrlOptions.documentsApiBase = options.documentsApiBase;
    }

    if (hasOwn(options, 'documentsApiPrefix')) {
      accessUrlOptions.documentsApiPrefix = options.documentsApiPrefix;
    }

    url = createDocumentsApiDocumentAccessUrl(accessUrlOptions);
  } catch (_error) {
    return { ok: false, status: 503, reason: 'invalid_documents_api_url' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    parsePositiveInteger(options.timeoutMs, getPermissionTimeoutMs()),
  );
  const headers = {
    Accept: 'application/json',
  };

  if (options.authorizationHeader) {
    headers.Authorization = options.authorizationHeader;
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    return response.ok
      ? { ok: true, status: response.status }
      : {
          ok: false,
          status: response.status,
          reason: getDocumentAccessFailureReason(response.status),
        };
  } catch (error) {
    return {
      ok: false,
      status: 503,
      reason: error?.name === 'AbortError' ? 'documents_api_timeout' : 'documents_api_request_failed',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  createDocumentsApiDocumentAccessUrl,
  isDocumentsCollaborationPermissionCheckEnabled,
  verifyDocumentsCollaborationDocumentAccess,
};

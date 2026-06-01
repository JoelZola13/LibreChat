const crypto = require('crypto');

const DEFAULT_WEAVIATE_ENDPOINT = 'http://localhost:8080';
const DEFAULT_WEAVIATE_COLLECTION = 'CaseWikiSourceChunk';
const DRY_RUN_OBJECT_LIMIT = 24;

const caseWikiVectorProvider = () => {
  return 'weaviate';
};

const sha256Text = (value = '') => crypto.createHash('sha256').update(String(value)).digest('hex');

const compactStringArray = (values = []) =>
  [...new Set(values.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean))];

const objectLedgerFor = (objects = []) =>
  (Array.isArray(objects) ? objects : []).map((object) => ({
    objectId: object.id || '',
    className: object.className || object.class || '',
    chunkId: object.properties?.chunkId || '',
    sourceDocumentId: object.properties?.sourceDocumentId || '',
    wikiPageId: object.properties?.wikiPageId || '',
    textHash: sha256Text(object.properties?.chunkText || ''),
    propertyHash: sha256Text(JSON.stringify(object.properties || {})),
  })).filter((entry) => entry.objectId && entry.chunkId);

const objectMapFor = (ledger = []) =>
  (Array.isArray(ledger) ? ledger : []).reduce((map, entry) => {
    if (entry?.chunkId && entry?.objectId) {
      map[entry.chunkId] = {
        objectId: entry.objectId,
        textHash: entry.textHash || '',
        propertyHash: entry.propertyHash || '',
      };
    }
    return map;
  }, {});

const graphIdsByKind = (ingestion = {}, kind) =>
  compactStringArray(
    (Array.isArray(ingestion.graph?.nodes) ? ingestion.graph.nodes : [])
      .filter((node) => node?.kind === kind)
      .map((node) => node.id),
  );

const getCaseWikiWeaviateConfig = () => {
  const provider = caseWikiVectorProvider();
  const collection =
    process.env.CASE_MANAGEMENT_WEAVIATE_CLASS ||
    process.env.CASE_MANAGEMENT_WEAVIATE_COLLECTION ||
    DEFAULT_WEAVIATE_COLLECTION;
  const endpoint =
    process.env.CASE_MANAGEMENT_WEAVIATE_URL ||
    process.env.WEAVIATE_URL ||
    process.env.WEAVIATE_HOST ||
    DEFAULT_WEAVIATE_ENDPOINT;
  const writeEnabled =
    provider === 'weaviate' &&
    process.env.CASE_MANAGEMENT_VECTOR_WRITE_ENABLED === 'true' &&
    process.env.CASE_MANAGEMENT_WEAVIATE_DRY_RUN === 'false';

  return {
    provider,
    endpoint,
    collection,
    targetClass: collection,
    embeddingModel: process.env.EMBEDDINGS_MODEL || 'configured embeddings model',
    dryRun: !writeEnabled,
    writeEnabled,
    configuredProvider: process.env.CASE_MANAGEMENT_VECTOR_PROVIDER || process.env.VECTOR_DB_TYPE || '',
  };
};

const approvedEmbeddingChunks = (embeddingReview = {}) =>
  (Array.isArray(embeddingReview.chunks) ? embeddingReview.chunks : []).filter(
    (chunk) => chunk?.status === 'approved-for-embedding',
  );

const isCredentialLikeSource = (ingestion = {}) => {
  const archive = ingestion.archive || ingestion.generatedRecords?.frontendRecord?.archive || {};
  const signals = [
    ...(Array.isArray(archive.cleanupSignals) ? archive.cleanupSignals : []),
    ...(Array.isArray(ingestion.generatedRecords?.frontendRecord?.cleanupSignals)
      ? ingestion.generatedRecords.frontendRecord.cleanupSignals
      : []),
  ];
  const sourceText = [archive.sourceKind, archive.laneId, archive.lane, archive.sourceNamespace, archive.classificationReason, ...signals]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return sourceText.includes('credential') || sourceText.includes('secret') || sourceText.includes('api key');
};

const buildCaseWikiWeaviateObjects = ({ ingestion = {}, embeddingReview = {}, config = getCaseWikiWeaviateConfig() }) => {
  const frontendRecord = ingestion.generatedRecords?.frontendRecord || {};
  const archive = ingestion.archive || frontendRecord.archive || ingestion.wikiPage?.archive || {};
  const approvedChunks = approvedEmbeddingChunks(embeddingReview);
  const sourceDocumentId = ingestion.fileId || frontendRecord.id || '';
  const wikiPageId = ingestion.wikiPage?.id || frontendRecord.pageId || ingestion.sourcePageId || '';
  const attachmentTarget = archive.attachmentTarget || {};
  const sourceTitle =
    archive.suggestedWikiTitle ||
    ingestion.wikiPage?.title ||
    frontendRecord.title ||
    ingestion.originalName ||
    frontendRecord.fileName ||
    'Case Wiki source';
  const sourcePathHash = sha256Text(ingestion.path || ingestion.sha256 || sourceDocumentId || sourceTitle);
  const entityIds = compactStringArray([
    ...graphIdsByKind(ingestion, 'Person'),
    ...graphIdsByKind(ingestion, 'Organization'),
    ...graphIdsByKind(ingestion, 'ArchiveTopic'),
    ...(Array.isArray(frontendRecord.entities) ? frontendRecord.entities : []),
  ]);
  const topicIds = compactStringArray([
    ...graphIdsByKind(ingestion, 'Topic'),
    ...graphIdsByKind(ingestion, 'ArchiveTopic'),
    ...(Array.isArray(archive.matchedKeywords) ? archive.matchedKeywords : []),
  ]);
  const caseIds = compactStringArray([
    ingestion.linkedCaseId,
    frontendRecord.linkedCaseId,
    attachmentTarget.targetType === 'case' ? attachmentTarget.targetId : '',
    attachmentTarget.caseId,
    ...graphIdsByKind(ingestion, 'Case'),
  ]);
  const clientIds = compactStringArray([
    ingestion.linkedClientId,
    frontendRecord.linkedClientId,
    attachmentTarget.targetType === 'client' ? attachmentTarget.targetId : '',
    attachmentTarget.clientId,
    ...graphIdsByKind(ingestion, 'Client'),
  ]);
  const serviceIds = compactStringArray([
    ingestion.linkedServiceName,
    frontendRecord.linkedServiceName,
    attachmentTarget.targetType === 'service' ? attachmentTarget.targetId : '',
    attachmentTarget.serviceName,
    ...graphIdsByKind(ingestion, 'Service'),
  ]);
  const projectIds = compactStringArray([
    attachmentTarget.targetType === 'project' ? attachmentTarget.targetId : '',
    ...graphIdsByKind(ingestion, 'Project'),
  ]);
  const collections = compactStringArray(archive.suggestedCollections || []);
  const now = new Date().toISOString();

  return approvedChunks.slice(0, DRY_RUN_OBJECT_LIMIT).map((chunk) => {
    const chunkText = chunk.text || chunk.textPreview || '';
    const chunkId = chunk.id || `embedding:${sourceDocumentId}:${chunk.ordinal || 1}`;
    return {
      id: sha256Text(`${sourceDocumentId}:${chunkId}`).slice(0, 32),
      className: config.collection,
      properties: {
        chunkId,
        sourceDocumentId,
        wikiPageId,
        sectionId: chunk.sectionId || '',
        chunkText,
        chunkSummary: chunk.reviewNote || '',
        sourceTitle,
        sourcePathHash,
        lifeDomain: chunk.lifeDomain || archive.lifeDomain || 'Unknown',
        collections,
        sourceKind: chunk.sourceKind || archive.sourceKind || 'source',
        privacyLevel: chunk.privacyLevel || embeddingReview.privacyLevel || frontendRecord.privacyLevel || 'case-team',
        redactionMode: chunk.redactionMode || embeddingReview.redactionMode || frontendRecord.redactionMode || 'standard',
        reviewStatus: archive.reviewStatus || 'needs-human-review',
        embeddingApprovedBy: chunk.reviewedBy || embeddingReview.reviewedBy || 'Current worker',
        embeddingApprovedAt: chunk.reviewedAt || embeddingReview.reviewedAt || now,
        entityIds,
        topicIds,
        caseIds,
        clientIds,
        serviceIds,
        projectIds,
        createdAt: ingestion.createdAt || frontendRecord.uploadedAt || now,
        updatedAt: now,
      },
    };
  });
};

const prepareCaseWikiWeaviateDryRun = ({ ingestion = {}, embeddingReview = {} }) => {
  const config = getCaseWikiWeaviateConfig();
  const sourceDocumentId = ingestion.fileId || ingestion.generatedRecords?.frontendRecord?.id || '';
  const approvedChunks = approvedEmbeddingChunks(embeddingReview);
  const preparedAt = new Date().toISOString();

  if (isCredentialLikeSource(ingestion)) {
    return {
      status: 'blocked',
      mode: 'dry-run',
      provider: config.provider,
      collection: config.collection,
      targetClass: config.collection,
      endpoint: config.endpoint,
      writeEnabled: false,
      dryRun: true,
      objectCount: 0,
      approvedChunkCount: approvedChunks.length,
      preparedAt,
      preparedBy: 'Current worker',
      sourceDocumentId,
      message: 'Credential-like sources stay blocked from Weaviate until the quarantine/redaction workflow is complete.',
      warnings: ['credential-like-source'],
      objects: [],
    };
  }

  if (!approvedChunks.length) {
    return {
      status: 'blocked',
      mode: 'dry-run',
      provider: config.provider,
      collection: config.collection,
      targetClass: config.collection,
      endpoint: config.endpoint,
      writeEnabled: false,
      dryRun: true,
      objectCount: 0,
      approvedChunkCount: 0,
      preparedAt,
      preparedBy: 'Current worker',
      sourceDocumentId,
      message: 'Approve at least one chunk before preparing a Weaviate dry-run.',
      warnings: ['no-approved-chunks'],
      objects: [],
    };
  }

  const objects = buildCaseWikiWeaviateObjects({ ingestion, embeddingReview, config });
  const objectLedger = objectLedgerFor(objects);

  return {
    status: 'prepared',
    mode: 'dry-run',
    provider: config.provider,
    collection: config.collection,
    targetClass: config.collection,
    endpoint: config.endpoint,
    embeddingModel: config.embeddingModel,
    writeEnabled: false,
    dryRun: true,
    objectCount: objects.length,
    approvedChunkCount: approvedChunks.length,
    truncatedObjectPreview: approvedChunks.length > objects.length,
    preparedAt,
    preparedBy: 'Current worker',
    sourceDocumentId,
    message: `Prepared ${objects.length} reviewed chunk${objects.length === 1 ? '' : 's'} for Weaviate dry-run. No vectors were written.`,
    warnings: compactStringArray([
      config.writeEnabled ? 'live-write-disabled-for-review-route' : '',
      config.configuredProvider && config.configuredProvider !== 'weaviate'
        ? `legacy-provider-ignored:${config.configuredProvider}`
        : '',
    ]),
    objectIds: objectLedger.map((entry) => entry.objectId),
    objectLedger,
    objectMap: objectMapFor(objectLedger),
    objectFingerprint: sha256Text(JSON.stringify(objectLedger)),
    objects,
  };
};

const parseWeaviateJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const graphqlString = (value = '') => JSON.stringify(String(value || ''));

const graphqlStringArray = (values = []) =>
  `[${compactStringArray(values).slice(0, 50).map((value) => graphqlString(value)).join(', ')}]`;

const normalizeWeaviateHybridHit = (hit = {}) => {
  const additional = hit._additional || {};
  return {
    objectId: additional.id || hit.id || '',
    score: additional.score || additional.certainty || '',
    explainScore: additional.explainScore || '',
    chunkId: hit.chunkId || '',
    sourceDocumentId: hit.sourceDocumentId || '',
    wikiPageId: hit.wikiPageId || '',
    sourceTitle: hit.sourceTitle || '',
    lifeDomain: hit.lifeDomain || '',
    sourceKind: hit.sourceKind || '',
    privacyLevel: hit.privacyLevel || '',
    reviewStatus: hit.reviewStatus || '',
    chunkSummary: hit.chunkSummary || '',
    chunkText: hit.chunkText || '',
    entityIds: Array.isArray(hit.entityIds) ? hit.entityIds : [],
    topicIds: Array.isArray(hit.topicIds) ? hit.topicIds : [],
    caseIds: Array.isArray(hit.caseIds) ? hit.caseIds : [],
    clientIds: Array.isArray(hit.clientIds) ? hit.clientIds : [],
    serviceIds: Array.isArray(hit.serviceIds) ? hit.serviceIds : [],
    projectIds: Array.isArray(hit.projectIds) ? hit.projectIds : [],
  };
};

const queryCaseWikiWeaviateHybridSearch = async ({
  query = '',
  limit = 8,
  sourceDocumentIds = [],
  fetchImpl = globalThis.fetch,
} = {}) => {
  const config = getCaseWikiWeaviateConfig();
  const normalizedQuery = String(query || '').replace(/\s+/g, ' ').trim();
  const resultLimit = Math.max(1, Math.min(Number(limit) || 8, 24));
  const sourceIds = compactStringArray(sourceDocumentIds);

  const baseResult = {
    status: 'skipped',
    provider: config.provider,
    collection: config.collection,
    targetClass: config.collection,
    endpoint: config.endpoint,
    query: normalizedQuery,
    resultCount: 0,
    results: [],
    generatedAt: new Date().toISOString(),
  };

  if (!normalizedQuery || normalizedQuery.length < 2) {
    return {
      ...baseResult,
      status: 'empty-query',
      message: 'Enter at least two characters before searching the vector layer.',
      warnings: ['empty-query'],
    };
  }

  if (!sourceIds.length) {
    return {
      ...baseResult,
      status: 'skipped',
      message: 'No Case Wiki sources have live Weaviate object IDs yet. Retrieval is using the wiki index, reviewed chunks, and Neo4j graph context.',
      warnings: ['no-indexed-sources'],
    };
  }

  if (typeof fetchImpl !== 'function') {
    return {
      ...baseResult,
      status: 'failed',
      message: 'No fetch implementation is available for Weaviate search.',
      warnings: ['fetch-unavailable'],
    };
  }

  const headers = { 'Content-Type': 'application/json' };
  if (process.env.CASE_MANAGEMENT_WEAVIATE_API_KEY) {
    headers.Authorization = `Bearer ${process.env.CASE_MANAGEMENT_WEAVIATE_API_KEY}`;
  }

  const whereFilter = sourceIds.length
    ? `, where: { path: ["sourceDocumentId"], operator: ContainsAny, valueTextArray: ${graphqlStringArray(sourceIds)} }`
    : '';
  const graphqlQuery = `{
    Get {
      ${config.collection}(hybrid: { query: ${graphqlString(normalizedQuery)}, alpha: 0.55 }, limit: ${resultLimit}${whereFilter}) {
        chunkId
        sourceDocumentId
        wikiPageId
        chunkText
        chunkSummary
        sourceTitle
        lifeDomain
        sourceKind
        privacyLevel
        reviewStatus
        entityIds
        topicIds
        caseIds
        clientIds
        serviceIds
        projectIds
        _additional {
          id
          score
          explainScore
        }
      }
    }
  }`;

  try {
    const response = await fetchImpl(`${config.endpoint.replace(/\/$/, '')}/v1/graphql`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: graphqlQuery }),
    });
    const payload = await parseWeaviateJson(response);
    if (!response.ok || payload?.errors?.length) {
      return {
        ...baseResult,
        status: 'failed',
        message: payload?.errors?.[0]?.message || `Weaviate hybrid search failed with HTTP ${response.status}.`,
        warnings: ['weaviate-search-failed'],
        response: payload,
      };
    }

    const hits = Array.isArray(payload?.data?.Get?.[config.collection])
      ? payload.data.Get[config.collection].map(normalizeWeaviateHybridHit)
      : [];

    return {
      ...baseResult,
      status: hits.length ? 'ready' : 'empty',
      resultCount: hits.length,
      message: hits.length
        ? `Weaviate hybrid search returned ${hits.length} reviewed chunk${hits.length === 1 ? '' : 's'}.`
        : 'Weaviate hybrid search ran, but no reviewed vector chunks matched.',
      warnings: [],
      results: hits,
      responseStatus: response.status,
    };
  } catch (error) {
    return {
      ...baseResult,
      status: 'failed',
      message: error instanceof Error ? error.message : 'Weaviate hybrid search failed.',
      warnings: ['weaviate-search-error'],
    };
  }
};

const writeCaseWikiApprovedChunksToWeaviate = async ({
  ingestion = {},
  embeddingReview = {},
  confirmWrite = false,
  fetchImpl = globalThis.fetch,
} = {}) => {
  const config = getCaseWikiWeaviateConfig();
  const sourceDocumentId = ingestion.fileId || ingestion.generatedRecords?.frontendRecord?.id || '';
  const approvedChunks = approvedEmbeddingChunks(embeddingReview);
  const writtenAt = new Date().toISOString();

  const baseResult = {
    mode: 'live',
    provider: config.provider,
    collection: config.collection,
    targetClass: config.collection,
    endpoint: config.endpoint,
    embeddingModel: config.embeddingModel,
    writeEnabled: config.writeEnabled,
    dryRun: false,
    approvedChunkCount: approvedChunks.length,
    sourceDocumentId,
    writtenAt,
    writtenBy: 'Current worker',
  };

  if (isCredentialLikeSource(ingestion)) {
    return {
      ...baseResult,
      status: 'blocked',
      objectCount: 0,
      message: 'Credential-like sources stay blocked from live Weaviate writes until the quarantine/redaction workflow is complete.',
      warnings: ['credential-like-source'],
      objectIds: [],
    };
  }

  if (!approvedChunks.length) {
    return {
      ...baseResult,
      status: 'blocked',
      objectCount: 0,
      message: 'Approve at least one chunk before writing to Weaviate.',
      warnings: ['no-approved-chunks'],
      objectIds: [],
    };
  }

  if (embeddingReview.pendingCount > 0 || approvedChunks.length !== (embeddingReview.chunkCount || approvedChunks.length)) {
    return {
      ...baseResult,
      status: 'blocked',
      objectCount: 0,
      message: 'All chunks for this source must be reviewed before a live Weaviate write.',
      warnings: ['pending-review-chunks'],
      objectIds: [],
    };
  }

  if (!confirmWrite) {
    return {
      ...baseResult,
      status: 'confirmation-required',
      objectCount: 0,
      message: 'Confirm the reviewed chunk list before writing approved chunks to Weaviate.',
      warnings: ['confirmation-required'],
      objectIds: [],
    };
  }

  if (!config.writeEnabled) {
    return {
      ...baseResult,
      status: 'blocked',
      objectCount: 0,
      message: 'Live Weaviate writes are disabled. Set CASE_MANAGEMENT_VECTOR_WRITE_ENABLED=true and CASE_MANAGEMENT_WEAVIATE_DRY_RUN=false to allow reviewed writes.',
      warnings: ['vector-write-disabled'],
      objectIds: [],
    };
  }

  if (typeof fetchImpl !== 'function') {
    return {
      ...baseResult,
      status: 'failed',
      objectCount: 0,
      message: 'No fetch implementation is available for the Weaviate write.',
      warnings: ['fetch-unavailable'],
      objectIds: [],
    };
  }

  const objects = buildCaseWikiWeaviateObjects({ ingestion, embeddingReview, config });
  const objectLedger = objectLedgerFor(objects);
  const batchObjects = objects.map((object) => ({
    id: object.id,
    class: object.className || config.collection,
    properties: object.properties || {},
  }));
  const headers = {
    'Content-Type': 'application/json',
  };
  if (process.env.CASE_MANAGEMENT_WEAVIATE_API_KEY) {
    headers.Authorization = `Bearer ${process.env.CASE_MANAGEMENT_WEAVIATE_API_KEY}`;
  }

  try {
    const response = await fetchImpl(`${config.endpoint.replace(/\/$/, '')}/v1/batch/objects`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ objects: batchObjects }),
    });
    const payload = await parseWeaviateJson(response);
    if (!response.ok) {
      return {
        ...baseResult,
        status: 'failed',
        objectCount: 0,
        attemptedObjectCount: objects.length,
        message: `Weaviate write failed with HTTP ${response.status}.`,
        warnings: ['weaviate-write-failed'],
        objectIds: [],
        objectLedger: [],
        objectMap: {},
        response: payload,
      };
    }

    const responseObjects = Array.isArray(payload) ? payload : Array.isArray(payload?.objects) ? payload.objects : [];
    const failedObjects = responseObjects.filter((object) => object?.result?.errors || object?.errors);
    const status = failedObjects.length
      ? failedObjects.length === objects.length
        ? 'failed'
        : 'partial'
      : 'written';

    return {
      ...baseResult,
      status,
      objectCount: status === 'failed' ? 0 : objects.length - failedObjects.length,
      attemptedObjectCount: objects.length,
      failedObjectCount: failedObjects.length,
      message:
        status === 'written'
          ? `Wrote ${objects.length} reviewed chunk${objects.length === 1 ? '' : 's'} to Weaviate.`
          : `Weaviate accepted ${objects.length - failedObjects.length}/${objects.length} reviewed chunk${objects.length === 1 ? '' : 's'}.`,
      warnings: failedObjects.length ? ['weaviate-object-errors'] : [],
      objectIds: objects.map((object) => object.id),
      objectLedger,
      objectMap: objectMapFor(objectLedger),
      objectFingerprint: sha256Text(JSON.stringify(objectLedger)),
      response: payload,
    };
  } catch (error) {
    return {
      ...baseResult,
      status: 'failed',
      objectCount: 0,
      attemptedObjectCount: objects.length,
      message: error instanceof Error ? error.message : 'Weaviate write failed.',
      warnings: ['weaviate-write-error'],
      objectIds: [],
      objectLedger: [],
      objectMap: {},
    };
  }
};

const deleteCaseWikiWeaviateObjects = async ({
  ingestion = {},
  vectorIndex = {},
  confirmDelete = false,
  fetchImpl = globalThis.fetch,
} = {}) => {
  const config = getCaseWikiWeaviateConfig();
  const sourceDocumentId = ingestion.fileId || ingestion.generatedRecords?.frontendRecord?.id || vectorIndex.sourceDocumentId || '';
  const objectIds = compactStringArray(vectorIndex.objectIds || vectorIndex.vectorObjectIds || []);
  const collection = vectorIndex.collection || vectorIndex.targetClass || config.collection;
  const deletedAt = new Date().toISOString();
  const baseResult = {
    mode: 'delete',
    provider: config.provider,
    collection,
    targetClass: collection,
    endpoint: vectorIndex.endpoint || config.endpoint,
    writeEnabled: config.writeEnabled,
    sourceDocumentId,
    requestedObjectCount: objectIds.length,
    deletedAt,
    deletedBy: 'Current worker',
  };

  if (!objectIds.length) {
    return {
      ...baseResult,
      status: 'blocked',
      deletedObjectCount: 0,
      failedObjectCount: 0,
      message: 'No stored Weaviate object IDs were found for this source.',
      warnings: ['no-vector-object-ids'],
      objectIds: [],
      deletedObjectIds: [],
      failedObjectIds: [],
    };
  }

  if (!confirmDelete) {
    return {
      ...baseResult,
      status: 'confirmation-required',
      deletedObjectCount: 0,
      failedObjectCount: 0,
      message: 'Confirm the stored Weaviate object IDs before deleting reviewed chunks from the vector index.',
      warnings: ['confirmation-required'],
      objectIds,
      deletedObjectIds: [],
      failedObjectIds: [],
    };
  }

  if (!config.writeEnabled) {
    return {
      ...baseResult,
      status: 'blocked',
      deletedObjectCount: 0,
      failedObjectCount: 0,
      message: 'Live Weaviate deletes are disabled. Set CASE_MANAGEMENT_VECTOR_WRITE_ENABLED=true and CASE_MANAGEMENT_WEAVIATE_DRY_RUN=false to allow reviewed vector deletes.',
      warnings: ['vector-write-disabled'],
      objectIds,
      deletedObjectIds: [],
      failedObjectIds: [],
    };
  }

  if (typeof fetchImpl !== 'function') {
    return {
      ...baseResult,
      status: 'failed',
      deletedObjectCount: 0,
      failedObjectCount: objectIds.length,
      message: 'No fetch implementation is available for the Weaviate delete.',
      warnings: ['fetch-unavailable'],
      objectIds,
      deletedObjectIds: [],
      failedObjectIds: objectIds,
    };
  }

  const headers = {};
  if (process.env.CASE_MANAGEMENT_WEAVIATE_API_KEY) {
    headers.Authorization = `Bearer ${process.env.CASE_MANAGEMENT_WEAVIATE_API_KEY}`;
  }
  const endpoint = (vectorIndex.endpoint || config.endpoint).replace(/\/$/, '');
  const deletedObjectIds = [];
  const failedObjectIds = [];
  const responses = [];

  for (const objectId of objectIds) {
    try {
      const response = await fetchImpl(`${endpoint}/v1/objects/${encodeURIComponent(collection)}/${encodeURIComponent(objectId)}`, {
        method: 'DELETE',
        headers,
      });
      const payload = await parseWeaviateJson(response);
      responses.push({ objectId, status: response.status, ok: response.ok, response: payload });
      if (response.ok || response.status === 404) {
        deletedObjectIds.push(objectId);
      } else {
        failedObjectIds.push(objectId);
      }
    } catch (error) {
      responses.push({ objectId, status: 0, ok: false, error: error instanceof Error ? error.message : 'delete failed' });
      failedObjectIds.push(objectId);
    }
  }

  const status = failedObjectIds.length
    ? failedObjectIds.length === objectIds.length
      ? 'failed'
      : 'partial'
    : 'deleted';

  return {
    ...baseResult,
    status,
    deletedObjectCount: deletedObjectIds.length,
    failedObjectCount: failedObjectIds.length,
    message:
      status === 'deleted'
        ? `Deleted ${deletedObjectIds.length} Weaviate object${deletedObjectIds.length === 1 ? '' : 's'} for this source.`
        : `Deleted ${deletedObjectIds.length}/${objectIds.length} Weaviate object${objectIds.length === 1 ? '' : 's'} for this source.`,
    warnings: failedObjectIds.length ? ['weaviate-delete-errors'] : [],
    objectIds,
    deletedObjectIds,
    failedObjectIds,
    responses,
  };
};

module.exports = {
  buildCaseWikiWeaviateObjects,
  deleteCaseWikiWeaviateObjects,
  getCaseWikiWeaviateConfig,
  objectLedgerFor,
  prepareCaseWikiWeaviateDryRun,
  queryCaseWikiWeaviateHybridSearch,
  writeCaseWikiApprovedChunksToWeaviate,
};

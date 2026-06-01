const crypto = require('crypto');
const fetch = require('node-fetch');

const GRAPH_NODE_LIMIT = 80;
const GRAPH_EDGE_LIMIT = 140;
const GRAPH_SEARCH_DEFAULT_LIMIT = 40;
const GRAPH_SEARCH_MATCH_LIMIT = 8;
const GRAPH_SEARCH_TEXT_LIMIT = 220;
const GRAPH_PROVENANCE_LENS_ACTIVITY_LIMIT = 12;

const compactStringArray = (values = []) =>
  [...new Set(values.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean))];

const stableHash = (value = '') =>
  crypto.createHash('sha256').update(String(value || 'case-wiki')).digest('hex').slice(0, 18);

const slugGraphValue = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const jsonProp = (value) => {
  if (value === undefined || value === null) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text;
};

const parseJsonProp = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const cleanProps = (props = {}) => {
  const cleaned = {};
  Object.entries(props || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key === 'id' || key === 'kind') return;
    if (typeof value === 'string') {
      if (key.endsWith('Json')) {
        cleaned[key] = value;
        return;
      }
      cleaned[key] = value.length > 420 ? `${value.slice(0, 420)}...` : value;
      return;
    }
    cleaned[key] = value;
  });
  return cleaned;
};

const normalizeGraphNode = (node = {}) => {
  const props = cleanProps(node.props || node.properties || {});
  const id = typeof node.id === 'string' ? node.id : props.id;
  const kind = typeof node.kind === 'string' ? node.kind : props.kind || 'Node';
  return id
    ? {
        id,
        kind,
        label: props.name || props.title || props.source || props.label || id.replace(/^[^:]+:/, ''),
        props,
      }
    : null;
};

const normalizeGraphEdge = (edge = {}) => {
  const from = typeof edge.from === 'string' ? edge.from : '';
  const to = typeof edge.to === 'string' ? edge.to : '';
  const kind = typeof edge.kind === 'string' ? edge.kind : 'RELATED_TO';
  if (!from || !to) return null;
  return {
    from,
    to,
    kind,
    label: kind.replace(/_/g, ' ').toLowerCase(),
    props: cleanProps(edge.props || edge.properties || {}),
  };
};

const summarizeGraph = (graph = {}) => {
  const nodeKinds = {};
  const edgeKinds = {};
  (graph.nodes || []).forEach((node) => {
    nodeKinds[node.kind] = (nodeKinds[node.kind] || 0) + 1;
  });
  (graph.edges || []).forEach((edge) => {
    edgeKinds[edge.kind] = (edgeKinds[edge.kind] || 0) + 1;
  });
  return { nodeKinds, edgeKinds };
};

const normalizeGraph = (graph = {}) => {
  const nodeMap = new Map();
  const edgeMap = new Map();
  (Array.isArray(graph.nodes) ? graph.nodes : [])
    .map(normalizeGraphNode)
    .filter(Boolean)
    .forEach((node) => nodeMap.set(node.id, node));
  (Array.isArray(graph.edges) ? graph.edges : [])
    .map(normalizeGraphEdge)
    .filter(Boolean)
    .forEach((edge) => {
      edgeMap.set(`${edge.from}->${edge.kind}->${edge.to}`, edge);
    });

  return {
    nodes: Array.from(nodeMap.values()).slice(0, GRAPH_NODE_LIMIT),
    edges: Array.from(edgeMap.values()).slice(0, GRAPH_EDGE_LIMIT),
  };
};

const ingestionGraph = (ingestion = {}) =>
  normalizeGraph(ingestion.graph || ingestion.generatedRecords?.frontendRecord?.graphPreview || {});

const ingestionWikiNodeId = (ingestion = {}) => {
  const pageId = ingestion.wikiPage?.id || ingestion.generatedRecords?.frontendRecord?.pageId || ingestion.sourcePageId || '';
  return pageId ? `wiki:${pageId}` : '';
};

const focusNodeIdsForIngestion = (ingestion = {}) =>
  compactStringArray([`file:${ingestion.fileId}`, ingestionWikiNodeId(ingestion)]);

const graphLabelsForIngestion = (ingestion = {}) => {
  const frontendRecord = ingestion.generatedRecords?.frontendRecord || {};
  const archive = ingestion.archive || frontendRecord.archive || ingestion.wikiPage?.archive || {};
  return {
    fileId: ingestion.fileId || frontendRecord.id || '',
    pageId: ingestion.wikiPage?.id || frontendRecord.pageId || ingestion.sourcePageId || '',
    title: archive.suggestedWikiTitle || ingestion.wikiPage?.title || frontendRecord.title || ingestion.originalName || 'Case Wiki source',
    fileName: ingestion.originalName || frontendRecord.fileName || '',
    lifeDomain: archive.lifeDomain || 'Unknown',
    lifeDomainId: archive.lifeDomainId || 'unknown',
    sourceKind: archive.sourceKind || 'source',
    reviewStatus: archive.reviewStatus || 'needs-human-review',
    collections: archive.suggestedCollections || [],
  };
};

const truncateText = (value = '', limit = GRAPH_SEARCH_TEXT_LIMIT) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text;
};

const normalizeSearchQuery = (value = '') => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

const searchableText = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(searchableText).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !['rawText', 'fullText', 'binary', 'buffer'].includes(key))
      .map(([, item]) => searchableText(item))
      .filter(Boolean)
      .join(' ');
  }
  return '';
};

const scoreSearchValue = (value, query, weight = 1) => {
  const text = normalizeSearchQuery(searchableText(value));
  if (!query || !text) return 0;
  let score = 0;
  if (text === query) score += weight * 8;
  if (text.startsWith(query)) score += weight * 4;
  if (text.includes(query)) score += weight * 5;

  const terms = query.split(/\s+/).filter((term) => term.length > 1);
  if (terms.length) {
    const hits = terms.filter((term) => text.includes(term)).length;
    score += hits * weight;
    if (hits === terms.length && !text.includes(query)) score += weight * 2;
  }
  return score;
};

const searchFieldMatches = (fields = [], query = '') => {
  const matches = [];
  let score = 0;
  fields.forEach((field) => {
    const fieldScore = scoreSearchValue(field.value, query, field.weight ?? 1);
    if (!fieldScore) return;
    score += fieldScore;
    matches.push({
      reason: field.reason || field.label || 'source field',
      score: fieldScore,
      preview: truncateText(searchableText(field.value), field.previewLimit || GRAPH_SEARCH_TEXT_LIMIT),
    });
  });
  return { score, matches };
};

const graphNodeMatches = (graph, query) =>
  (graph.nodes || [])
    .map((node) => {
      const score = scoreSearchValue([node.id, node.kind, node.label, node.props], query, 3);
      return score
        ? {
            id: node.id,
            kind: node.kind,
            label: node.label,
            score,
            reason: `graph node: ${node.kind} ${node.label}`,
          }
        : null;
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)
    .slice(0, GRAPH_SEARCH_MATCH_LIMIT);

const graphEdgeMatches = (graph, query) => {
  const nodeLabels = new Map((graph.nodes || []).map((node) => [node.id, node.label]));
  return (graph.edges || [])
    .map((edge) => {
      const fromLabel = nodeLabels.get(edge.from) || edge.from;
      const toLabel = nodeLabels.get(edge.to) || edge.to;
      const score = scoreSearchValue([edge.kind, edge.label, edge.props, fromLabel, toLabel], query, 2);
      return score
        ? {
            from: edge.from,
            to: edge.to,
            kind: edge.kind,
            label: edge.label,
            fromLabel,
            toLabel,
            score,
            reason: `graph edge: ${fromLabel} ${edge.label || edge.kind} ${toLabel}`,
          }
        : null;
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)
    .slice(0, GRAPH_SEARCH_MATCH_LIMIT);
};

const embeddingReviewSearchText = (ingestion = {}) => {
  const review =
    ingestion.embeddingReview ||
    ingestion.generatedRecords?.frontendRecord?.embeddingReview ||
    ingestion.weaviateDryRun ||
    ingestion.generatedRecords?.frontendRecord?.weaviateDryRun ||
    {};
  return searchableText(review);
};

const graphLabelsForPromotion = (promotion = {}) => {
  const promotionLifeDomain = promotion.lifeDomain && typeof promotion.lifeDomain === 'object' ? promotion.lifeDomain : {};
  const lifeDomainId = promotion.lifeDomainId || promotionLifeDomain.id || promotion.domainId || 'unknown';
  const lifeDomain =
    (typeof promotion.lifeDomain === 'string' ? promotion.lifeDomain : promotionLifeDomain.name) ||
    promotion.lifeDomainName ||
    promotion.domainName ||
    'Promoted topics';
  return {
    id: promotion.id || promotion.pageId || '',
    pageId: promotion.pageId || promotion.id || '',
    title: promotion.title || promotion.query || 'Promoted Case Wiki topic',
    lifeDomain,
    lifeDomainId,
    sourceKind:
      promotion.publishMode === 'human-confirmed-returned-output'
        ? 'promoted-returned-output-topic'
        : 'promoted-wiki-topic',
    reviewStatus: promotion.reviewState || promotion.status || 'published-section',
    collections: compactStringArray([
      ...(Array.isArray(promotion.collections) ? promotion.collections : []),
      promotion.publishMode === 'human-confirmed-returned-output' ? 'Returned output' : 'Promoted topic',
      promotion.neo4jStatus ? `Neo4j ${promotion.neo4jStatus}` : '',
    ]),
  };
};

const promotionGraph = (promotion = {}) => {
  const labels = graphLabelsForPromotion(promotion);
  const sectionNodes = (Array.isArray(promotion.sections) ? promotion.sections : []).map((section, index) => ({
    id: `${labels.pageId || labels.id}:section:${section.id || index + 1}`,
    kind: 'WikiSection',
    label: section.heading || `Section ${index + 1}`,
    props: {
      title: section.heading || `Section ${index + 1}`,
      reviewState: section.reviewState || '',
      textPreview: truncateText(section.text || '', 180),
    },
  }));
  const citationNodes = (Array.isArray(promotion.citationLedger) ? promotion.citationLedger : [])
    .map((citation, index) => {
      const sourceDocumentId = citation.sourceDocumentId || citation.id || citation.objectId || `citation-${index + 1}`;
      return {
        id: `source-document:${sourceDocumentId}`,
        kind: 'SourceDocument',
        label: citation.sourceTitle || citation.title || sourceDocumentId,
        props: {
          title: citation.sourceTitle || citation.title || sourceDocumentId,
          sourceDocumentId,
          evidenceState: citation.evidenceState || citation.reviewState || '',
          textPreview: truncateText(citation.textPreview || citation.chunkText || '', 180),
        },
      };
    })
    .filter(Boolean);
  const pageNode = {
    id: `wiki:${labels.pageId || labels.id}`,
    kind: 'WikiPage',
    label: labels.title,
    props: {
      title: labels.title,
      pageId: labels.pageId,
      promotionId: labels.id,
      publishMode: promotion.publishMode || '',
      reviewState: promotion.reviewState || '',
      neo4jStatus: promotion.neo4jStatus || '',
      version: Number(promotion.version) || 1,
    },
  };
  const nodes = [pageNode, ...sectionNodes, ...citationNodes];
  const sectionEdges = sectionNodes.map((sectionNode) => ({
    from: pageNode.id,
    to: sectionNode.id,
    kind: 'HAS_SECTION',
    label: 'has section',
    props: {},
  }));
  const citationEdges = citationNodes.map((citationNode) => ({
    from: pageNode.id,
    to: citationNode.id,
    kind: 'CITES_SOURCE',
    label: 'cites source',
    props: {},
  }));

  return normalizeGraph({
    nodes,
    edges: [...sectionEdges, ...citationEdges],
  });
};

const searchPromotionRecords = ({ promotionRecords = [], normalizedQuery = '', normalizedLifeDomainId = 'all' } = {}) =>
  (Array.isArray(promotionRecords) ? promotionRecords : [])
    .map((promotion) => {
      const labels = graphLabelsForPromotion(promotion);
      if (
        normalizedLifeDomainId &&
        normalizedLifeDomainId !== 'all' &&
        normalizeSearchQuery(labels.lifeDomainId || 'unknown') !== normalizedLifeDomainId
      ) {
        return null;
      }

      const sections = Array.isArray(promotion.sections) ? promotion.sections : [];
      const citationLedger = Array.isArray(promotion.citationLedger) ? promotion.citationLedger : [];
      const graph = promotionGraph(promotion);
      const fieldMatches = searchFieldMatches(
        [
          { label: 'promoted wiki topic', reason: 'promoted wiki topic', value: labels.title, weight: 7 },
          { label: 'publication query', value: promotion.query, weight: 4 },
          { label: 'publication mode', value: promotion.publishMode, weight: 3 },
          { label: 'review state', value: [promotion.reviewState, promotion.status], weight: 3 },
          { label: 'source policy', value: promotion.sourcePolicy, weight: 2 },
          { label: 'life domain', value: [labels.lifeDomain, labels.lifeDomainId], weight: 2 },
          { label: 'promoted lead', value: promotion.lead, weight: 3 },
          { label: 'promoted sections', value: sections, weight: 2 },
          { label: 'reviewed citation ledger', value: citationLedger, weight: 3 },
          { label: 'Neo4j graph sync', value: [promotion.neo4jStatus, promotion.neo4jMessage, promotion.graphSummary], weight: 2 },
          { label: 'promotion version history', value: promotion.versionHistory, weight: 1 },
        ],
        normalizedQuery,
      );
      const nodeMatches = graphNodeMatches(graph, normalizedQuery);
      const edgeMatches = graphEdgeMatches(graph, normalizedQuery);
      const score =
        fieldMatches.score +
        nodeMatches.reduce((total, match) => total + match.score, 0) +
        edgeMatches.reduce((total, match) => total + match.score, 0);

      if (!score) return null;

      const matchReasons = compactStringArray([
        ...fieldMatches.matches.map((match) => match.reason),
        ...nodeMatches.map((match) => match.reason),
        ...edgeMatches.map((match) => match.reason),
      ]).slice(0, GRAPH_SEARCH_MATCH_LIMIT);
      const graphSummary = promotion.graphSummary || {};
      const nodeCount = Number(graphSummary.nodeCount) || graph.nodes.length;
      const edgeCount = Number(graphSummary.edgeCount) || graph.edges.length;

      return {
        id: labels.id,
        resultType: 'promoted-topic',
        promotionId: labels.id,
        pageId: labels.pageId,
        title: labels.title,
        fileName: '',
        lifeDomain: labels.lifeDomain,
        lifeDomainId: labels.lifeDomainId,
        sourceKind: labels.sourceKind,
        reviewStatus: labels.reviewStatus,
        collections: labels.collections,
        publishMode: promotion.publishMode || '',
        version: Number(promotion.version) || 1,
        revisionId: promotion.revisionId || '',
        neo4jStatus: promotion.neo4jStatus || graphSummary.status || '',
        neo4jMessage: promotion.neo4jMessage || graphSummary.message || '',
        graphSyncedAt: promotion.graphSyncedAt || '',
        citationCount: citationLedger.length,
        sectionCount: sections.length,
        score,
        matchReasons,
        textPreview: truncateText(
          fieldMatches.matches.find((match) => ['promoted lead', 'promoted sections', 'reviewed citation ledger'].includes(match.reason))
            ?.preview ||
            promotion.lead ||
            sections[0]?.text ||
            promotion.sourcePolicy ||
            labels.title,
        ),
        graph: {
          nodeCount,
          edgeCount,
          summary: summarizeGraph(graph),
        },
        nodeMatches: nodeMatches.map(({ score: _score, ...match }) => match),
        edgeMatches: edgeMatches.map(({ score: _score, ...match }) => match),
        uploadedAt: promotion.graphSyncedAt || promotion.updatedAt || promotion.createdAt || '',
      };
    })
    .filter(Boolean);

const searchCaseWikiGraph = ({
  ingestions = [],
  promotionRecords = [],
  query = '',
  lifeDomainId = 'all',
  limit = GRAPH_SEARCH_DEFAULT_LIMIT,
} = {}) => {
  const normalizedQuery = normalizeSearchQuery(query);
  const normalizedLifeDomainId = normalizeSearchQuery(lifeDomainId || 'all');
  const resultLimit = Math.max(1, Math.min(Number(limit) || GRAPH_SEARCH_DEFAULT_LIMIT, 80));

  if (!normalizedQuery) {
    return {
      status: 'empty-query',
      query: '',
      lifeDomainId: normalizedLifeDomainId || 'all',
      resultCount: 0,
      totalMatches: 0,
      results: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const ingestionResults = ingestions
    .map((ingestion) => {
      const labels = graphLabelsForIngestion(ingestion);
      if (
        normalizedLifeDomainId &&
        normalizedLifeDomainId !== 'all' &&
        normalizeSearchQuery(labels.lifeDomainId || 'unknown') !== normalizedLifeDomainId
      ) {
        return null;
      }

      const graph = ingestionGraph(ingestion);
      const archive = ingestion.archive || ingestion.generatedRecords?.frontendRecord?.archive || ingestion.wikiPage?.archive || {};
      const relationshipReviewRecords = relationshipReviewRecordsForIngestion(ingestion);
      const fieldMatches = searchFieldMatches(
        [
          { label: 'wiki title', value: labels.title, weight: 5 },
          { label: 'file name', value: labels.fileName, weight: 4 },
          { label: 'life domain', value: [labels.lifeDomain, labels.lifeDomainId], weight: 3 },
          { label: 'source kind', value: labels.sourceKind, weight: 2 },
          { label: 'review status', value: labels.reviewStatus, weight: 2 },
          { label: 'collections', value: labels.collections, weight: 3 },
          { label: 'archive review', value: archive, weight: 2 },
          { label: 'source text', value: ingestion.extractedText || ingestion.textPreview || ingestion.summary, weight: 1 },
          { label: 'parser notes', value: ingestion.parserWarning || ingestion.extractionStatus || ingestion.extractionMethod, weight: 1 },
          { label: 'relationship review', value: relationshipReviewRecords, weight: 2 },
          { label: 'embedding review', value: embeddingReviewSearchText(ingestion), weight: 1 },
        ],
        normalizedQuery,
      );
      const nodeMatches = graphNodeMatches(graph, normalizedQuery);
      const edgeMatches = graphEdgeMatches(graph, normalizedQuery);
      const score =
        fieldMatches.score +
        nodeMatches.reduce((total, match) => total + match.score, 0) +
        edgeMatches.reduce((total, match) => total + match.score, 0);

      if (!score) return null;

      const matchReasons = compactStringArray([
        ...fieldMatches.matches.map((match) => match.reason),
        ...nodeMatches.map((match) => match.reason),
        ...edgeMatches.map((match) => match.reason),
      ]).slice(0, GRAPH_SEARCH_MATCH_LIMIT);

      return {
        id: labels.fileId,
        pageId: labels.pageId || (labels.fileId ? `ingest:${labels.fileId}` : ''),
        title: labels.title,
        fileName: labels.fileName,
        lifeDomain: labels.lifeDomain,
        lifeDomainId: labels.lifeDomainId,
        sourceKind: labels.sourceKind,
        reviewStatus: labels.reviewStatus,
        collections: labels.collections,
        score,
        matchReasons,
        textPreview: truncateText(
          fieldMatches.matches.find((match) => match.reason === 'source text')?.preview ||
            ingestion.textPreview ||
            ingestion.extractedText ||
            labels.fileName,
        ),
        graph: {
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length,
          summary: summarizeGraph(graph),
        },
        nodeMatches: nodeMatches.map(({ score: _score, ...match }) => match),
        edgeMatches: edgeMatches.map(({ score: _score, ...match }) => match),
        uploadedAt: ingestion.uploadedAt || ingestion.createdAt || '',
      };
    })
    .filter(Boolean);
  const promotionResults = searchPromotionRecords({
    promotionRecords,
    normalizedQuery,
    normalizedLifeDomainId,
  });
  const scoredResults = [...ingestionResults, ...promotionResults]
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return new Date(right.uploadedAt || 0).getTime() - new Date(left.uploadedAt || 0).getTime();
    });

  const results = scoredResults.slice(0, resultLimit);

  return {
    status: results.length ? 'ready' : 'empty',
    query: normalizedQuery,
    lifeDomainId: normalizedLifeDomainId || 'all',
    resultCount: results.length,
    totalMatches: scoredResults.length,
    results,
    generatedAt: new Date().toISOString(),
  };
};

const normalizeGraphWorkspaceAccessRole = (role = '') =>
  ['viewer', 'editor', 'manager'].includes(role) ? role : 'viewer';

const normalizeGraphWorkspaceSlice = (slice = {}) => {
  if (!slice || typeof slice !== 'object' || Array.isArray(slice)) return null;
  const nodes = Array.isArray(slice.nodes)
    ? slice.nodes
        .map((node) => {
          if (!node || typeof node !== 'object' || Array.isArray(node)) return null;
          const id = typeof node.id === 'string' && node.id.trim() ? node.id.trim() : '';
          const label = typeof node.label === 'string' && node.label.trim() ? node.label.trim() : '';
          if (!id || !label) return null;
          return {
            id,
            type: node.type === 'source' ? 'source' : 'entity',
            label,
            subtitle: typeof node.subtitle === 'string' ? node.subtitle : '',
            kind: typeof node.kind === 'string' ? node.kind : '',
            sourceId: typeof node.sourceId === 'string' ? node.sourceId : '',
            pageId: typeof node.pageId === 'string' ? node.pageId : '',
            entityKey: typeof node.entityKey === 'string' ? node.entityKey : '',
          };
        })
        .filter(Boolean)
    : [];
  const edges = Array.isArray(slice.edges)
    ? slice.edges
        .map((edge) => {
          if (!edge || typeof edge !== 'object' || Array.isArray(edge)) return null;
          const id = typeof edge.id === 'string' && edge.id.trim() ? edge.id.trim() : '';
          if (!id) return null;
          return {
            id,
            sourceId: typeof edge.sourceId === 'string' ? edge.sourceId : '',
            entityKey: typeof edge.entityKey === 'string' ? edge.entityKey : '',
            sourceLabel: typeof edge.sourceLabel === 'string' ? edge.sourceLabel : '',
            entityLabel: typeof edge.entityLabel === 'string' ? edge.entityLabel : '',
            label: typeof edge.label === 'string' ? edge.label : 'mentions',
            status: ['pending-review', 'approved', 'rejected', 'mixed'].includes(edge.status)
              ? edge.status
              : 'pending-review',
            count: Number(edge.count) || 1,
          };
        })
        .filter(Boolean)
    : [];
  const sourceGroups = Array.isArray(slice.sourceGroups)
    ? slice.sourceGroups
        .map((group) => {
          if (!group || typeof group !== 'object' || Array.isArray(group)) return null;
          const key = typeof group.key === 'string' && group.key.trim() ? group.key.trim() : '';
          const label = typeof group.label === 'string' && group.label.trim() ? group.label.trim() : '';
          if (!key || !label) return null;
          return { key, label, count: Number(group.count) || 0 };
        })
        .filter(Boolean)
    : [];

  return {
    capturedAt: typeof slice.capturedAt === 'string' && slice.capturedAt ? slice.capturedAt : new Date().toISOString(),
    pageId: typeof slice.pageId === 'string' ? slice.pageId : '',
    lifeDomainId: typeof slice.lifeDomainId === 'string' ? slice.lifeDomainId : 'all',
    layout: typeof slice.layout === 'string' ? slice.layout : 'compact',
    scope: typeof slice.scope === 'string' ? slice.scope : 'focused',
    filter: typeof slice.filter === 'string' ? slice.filter : 'all',
    relationshipStatusFilter:
      typeof slice.relationshipStatusFilter === 'string' ? slice.relationshipStatusFilter : 'all',
    relationshipKindFilter: typeof slice.relationshipKindFilter === 'string' ? slice.relationshipKindFilter : 'all',
    relationshipEntityFilter:
      typeof slice.relationshipEntityFilter === 'string' ? slice.relationshipEntityFilter : 'all',
    entityKindFilter: typeof slice.entityKindFilter === 'string' ? slice.entityKindFilter : 'all',
    searchQuery: typeof slice.searchQuery === 'string' ? slice.searchQuery : '',
    viewWidth: Number(slice.viewWidth) || 0,
    viewHeight: Number(slice.viewHeight) || 0,
    nodeCount: Number(slice.nodeCount) || nodes.length,
    edgeCount: Number(slice.edgeCount) || edges.length,
    sourceGroupCount: Number(slice.sourceGroupCount) || sourceGroups.length,
    hiddenEntityCount: Number(slice.hiddenEntityCount) || 0,
    hiddenSourceCount: Number(slice.hiddenSourceCount) || 0,
    nodes,
    edges,
    sourceGroups,
  };
};

const normalizeCaseWikiGraphWorkspace = ({ workspace = {}, userId = '', action = 'saved', pageId = '', lifeDomainId = '' } = {}) => {
  if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)) return null;
  const id =
    typeof workspace.id === 'string' && workspace.id.trim()
      ? workspace.id.trim()
      : `life-domain-graph-${stableHash(`${userId}:${workspace.name || Date.now()}`)}`;
  const name = typeof workspace.name === 'string' && workspace.name.trim() ? workspace.name.trim() : 'Saved graph workspace';
  const owner = typeof workspace.owner === 'string' && workspace.owner.trim() ? workspace.owner.trim() : 'Current worker';
  const sharedWith = compactStringArray(workspace.sharedWith || []);
  const accessRoles =
    workspace.accessRoles && typeof workspace.accessRoles === 'object' && !Array.isArray(workspace.accessRoles)
      ? Object.fromEntries(
          Object.entries(workspace.accessRoles)
            .filter(([teammate]) => typeof teammate === 'string' && teammate.trim())
            .map(([teammate, role]) => [teammate.trim(), normalizeGraphWorkspaceAccessRole(role)]),
        )
      : {};
  const savedAt =
    typeof workspace.savedAt === 'string' && workspace.savedAt.trim()
      ? workspace.savedAt.trim()
      : new Date().toISOString();
  const normalizedPageId = typeof pageId === 'string' && pageId.trim() ? pageId.trim() : '';
  const inferredLifeDomainId = normalizedPageId.startsWith('domain:')
    ? normalizedPageId.replace(/^domain:/, '') || 'unknown'
    : '';
  const normalizedLifeDomainId =
    typeof lifeDomainId === 'string' && lifeDomainId.trim()
      ? lifeDomainId.trim()
      : inferredLifeDomainId || 'all';

  return {
    id,
    nodeId: `graph-workspace:${id}`,
    name,
    owner,
    visibility: workspace.visibility === 'team' ? 'team' : 'private',
    sharedWith,
    accessRole: normalizeGraphWorkspaceAccessRole(workspace.accessRole || 'manager'),
    accessRoles,
    action: typeof action === 'string' && action.trim() ? action.trim() : 'saved',
    savedAt,
    pageId: normalizedPageId,
    lifeDomainId: normalizedLifeDomainId,
    duplicatedFromId: typeof workspace.duplicatedFromId === 'string' ? workspace.duplicatedFromId : '',
    shareNote: typeof workspace.shareNote === 'string' ? workspace.shareNote : '',
    graphSlice: normalizeGraphWorkspaceSlice(workspace.graphSlice),
    viewState: {
      graphFilter: typeof workspace.graphFilter === 'string' ? workspace.graphFilter : 'all',
      graphSearchQuery: typeof workspace.graphSearchQuery === 'string' ? workspace.graphSearchQuery : '',
      relationshipStatusFilter:
        typeof workspace.relationshipStatusFilter === 'string' ? workspace.relationshipStatusFilter : 'all',
      relationshipKindFilter:
        typeof workspace.relationshipKindFilter === 'string' ? workspace.relationshipKindFilter : 'all',
      relationshipEntityFilter:
        typeof workspace.relationshipEntityFilter === 'string' ? workspace.relationshipEntityFilter : 'all',
      entityKindFilter: typeof workspace.entityKindFilter === 'string' ? workspace.entityKindFilter : 'all',
      graphZoom: Number(workspace.graphZoom) || 100,
      graphShowLabels: workspace.graphShowLabels !== false,
      graphLayout: typeof workspace.graphLayout === 'string' ? workspace.graphLayout : 'compact',
      graphScope: typeof workspace.graphScope === 'string' ? workspace.graphScope : 'focused',
      graphPinnedPositions:
        workspace.graphPinnedPositions && typeof workspace.graphPinnedPositions === 'object'
          ? workspace.graphPinnedPositions
          : {},
    },
  };
};

const graphWorkspaceSnapshotForAudit = (graphWorkspace, { auditNodeId = '', syncedAt = '' } = {}) => ({
  id: graphWorkspace.id,
  name: graphWorkspace.name,
  savedAt: graphWorkspace.savedAt,
  owner: graphWorkspace.owner,
  visibility: graphWorkspace.visibility,
  sharedWith: graphWorkspace.sharedWith,
  accessRole: graphWorkspace.accessRole,
  accessRoles: graphWorkspace.accessRoles,
  duplicatedFromId: graphWorkspace.duplicatedFromId,
  shareNote: graphWorkspace.shareNote,
  graphWorkspaceNodeId: graphWorkspace.nodeId,
  graphWorkspaceAuditId: auditNodeId,
  graphWorkspaceSyncedAt: syncedAt,
  graphWorkspaceSyncStatus: 'written',
  graphWorkspaceSyncMessage: 'Restorable graph workspace snapshot stored in Neo4j.',
  graphWorkspaceSyncAction: graphWorkspace.action,
  graphFilter: graphWorkspace.viewState.graphFilter,
  graphSearchQuery: graphWorkspace.viewState.graphSearchQuery,
  relationshipStatusFilter: graphWorkspace.viewState.relationshipStatusFilter,
  relationshipKindFilter: graphWorkspace.viewState.relationshipKindFilter,
  relationshipEntityFilter: graphWorkspace.viewState.relationshipEntityFilter,
  entityKindFilter: graphWorkspace.viewState.entityKindFilter,
  graphZoom: graphWorkspace.viewState.graphZoom,
  graphShowLabels: graphWorkspace.viewState.graphShowLabels,
  graphLayout: graphWorkspace.viewState.graphLayout,
  graphScope: graphWorkspace.viewState.graphScope,
  graphPinnedPositions: graphWorkspace.viewState.graphPinnedPositions,
  graphSlice: graphWorkspace.graphSlice,
});

const buildCaseWikiGraphWorkspaceGraph = ({ workspace, userId, action, pageId, lifeDomainId } = {}) => {
  const graphWorkspace = normalizeCaseWikiGraphWorkspace({ workspace, userId, action, pageId, lifeDomainId });
  if (!graphWorkspace) return null;

  const syncedAt = new Date().toISOString();
  const ownerNodeId = `case-wiki-person:${slugGraphValue(graphWorkspace.owner) || stableHash(graphWorkspace.owner)}`;
  const auditNodeId = `graph-workspace-audit:${stableHash(`${graphWorkspace.id}:${syncedAt}:${graphWorkspace.action}`)}`;
  const domainNodeId =
    graphWorkspace.lifeDomainId && graphWorkspace.lifeDomainId !== 'all'
      ? `life-domain:${slugGraphValue(graphWorkspace.lifeDomainId) || 'unknown'}`
      : '';
  const sharedNodes = graphWorkspace.sharedWith.map((teammate) => ({
    teammate,
    nodeId: `case-wiki-person:${slugGraphValue(teammate) || stableHash(teammate)}`,
    role: graphWorkspace.accessRoles[teammate] || graphWorkspace.accessRole || 'viewer',
  }));
  const graphWorkspaceSnapshot = graphWorkspaceSnapshotForAudit(graphWorkspace, { auditNodeId, syncedAt });
  const graphWorkspaceSnapshotJson = jsonProp(graphWorkspaceSnapshot, 16000);
  const graphWorkspaceSnapshotHash = stableHash(graphWorkspaceSnapshotJson);
  const graphWorkspaceSliceJson = jsonProp(graphWorkspace.graphSlice);
  const graphWorkspaceSliceHash = graphWorkspace.graphSlice ? stableHash(graphWorkspaceSliceJson) : '';

  const nodes = [
    {
      id: graphWorkspace.nodeId,
      kind: 'GraphWorkspace',
      props: {
        id: graphWorkspace.nodeId,
        workspaceId: graphWorkspace.id,
        name: graphWorkspace.name,
        owner: graphWorkspace.owner,
        visibility: graphWorkspace.visibility,
        accessRole: graphWorkspace.accessRole,
        sharedWith: graphWorkspace.sharedWith,
        accessRolesJson: jsonProp(graphWorkspace.accessRoles),
        duplicatedFromId: graphWorkspace.duplicatedFromId,
        shareNote: graphWorkspace.shareNote,
        pageId: graphWorkspace.pageId,
        lifeDomainId: graphWorkspace.lifeDomainId,
        graphFilter: graphWorkspace.viewState.graphFilter,
        graphSearchQuery: graphWorkspace.viewState.graphSearchQuery,
        relationshipStatusFilter: graphWorkspace.viewState.relationshipStatusFilter,
        relationshipKindFilter: graphWorkspace.viewState.relationshipKindFilter,
        relationshipEntityFilter: graphWorkspace.viewState.relationshipEntityFilter,
        entityKindFilter: graphWorkspace.viewState.entityKindFilter,
        graphZoom: graphWorkspace.viewState.graphZoom,
        graphShowLabels: graphWorkspace.viewState.graphShowLabels,
        graphLayout: graphWorkspace.viewState.graphLayout,
        graphScope: graphWorkspace.viewState.graphScope,
        pinnedPositionsJson: jsonProp(graphWorkspace.viewState.graphPinnedPositions),
        graphSliceJson: graphWorkspaceSliceJson,
        savedAt: graphWorkspace.savedAt,
        syncedAt,
        userId: String(userId || ''),
        source: 'Case Wiki graph workspace',
      },
    },
    {
      id: ownerNodeId,
      kind: 'CaseWikiPerson',
      props: {
        id: ownerNodeId,
        name: graphWorkspace.owner,
        role: 'owner',
        source: 'Case Wiki graph workspace',
      },
    },
    {
      id: auditNodeId,
      kind: 'GraphWorkspaceAudit',
      props: {
        id: auditNodeId,
        name: `${graphWorkspace.action} ${graphWorkspace.name}`,
        action: graphWorkspace.action,
        workspaceId: graphWorkspace.id,
        workspaceName: graphWorkspace.name,
        actor: graphWorkspace.owner,
        syncedAt,
        visibility: graphWorkspace.visibility,
        sharedCount: graphWorkspace.sharedWith.length,
        graphFilter: graphWorkspace.viewState.graphFilter,
        graphSearchQuery: graphWorkspace.viewState.graphSearchQuery,
        relationshipStatusFilter: graphWorkspace.viewState.relationshipStatusFilter,
        graphLayout: graphWorkspace.viewState.graphLayout,
        graphScope: graphWorkspace.viewState.graphScope,
        pinnedNodeCount: Object.keys(graphWorkspace.viewState.graphPinnedPositions || {}).length,
        graphNodeCount: graphWorkspace.graphSlice?.nodeCount || graphWorkspace.graphSlice?.nodes?.length || 0,
        graphEdgeCount: graphWorkspace.graphSlice?.edgeCount || graphWorkspace.graphSlice?.edges?.length || 0,
        graphHiddenEntityCount: graphWorkspace.graphSlice?.hiddenEntityCount || 0,
        graphHiddenSourceCount: graphWorkspace.graphSlice?.hiddenSourceCount || 0,
        graphSliceHash: graphWorkspaceSliceHash,
        graphSliceJson: graphWorkspaceSliceJson,
        snapshotVersion: 2,
        snapshotHash: graphWorkspaceSnapshotHash,
        snapshotJson: graphWorkspaceSnapshotJson,
        source: 'Case Wiki graph workspace',
      },
    },
    ...(domainNodeId
      ? [
          {
            id: domainNodeId,
            kind: 'LifeDomain',
            props: {
              id: domainNodeId,
              name: graphWorkspace.lifeDomainId,
              lifeDomainId: graphWorkspace.lifeDomainId,
              source: 'Case Wiki graph workspace',
            },
          },
        ]
      : []),
    ...sharedNodes.map(({ teammate, nodeId, role }) => ({
      id: nodeId,
      kind: 'CaseWikiPerson',
      props: {
        id: nodeId,
        name: teammate,
        role,
        source: 'Case Wiki graph workspace',
      },
    })),
  ];

  const edges = [
    {
      from: graphWorkspace.nodeId,
      to: ownerNodeId,
      kind: 'OWNED_BY',
      props: {
        workspaceId: graphWorkspace.id,
        role: 'manager',
        source: 'Case Wiki graph workspace',
      },
    },
    {
      from: auditNodeId,
      to: graphWorkspace.nodeId,
      kind: 'SYNCED_WORKSPACE',
      props: {
        workspaceId: graphWorkspace.id,
        action: graphWorkspace.action,
        syncedAt,
        source: 'Case Wiki graph workspace',
      },
    },
    ...(domainNodeId
      ? [
          {
            from: graphWorkspace.nodeId,
            to: domainNodeId,
            kind: 'FOCUSES_ON',
            props: {
              workspaceId: graphWorkspace.id,
              pageId: graphWorkspace.pageId,
              source: 'Case Wiki graph workspace',
            },
          },
        ]
      : []),
    ...sharedNodes.map(({ nodeId, role }) => ({
      from: graphWorkspace.nodeId,
      to: nodeId,
      kind: 'SHARED_WITH',
      props: {
        workspaceId: graphWorkspace.id,
        role,
        source: 'Case Wiki graph workspace',
      },
    })),
  ];

  return {
    graphWorkspace: {
      ...graphWorkspace,
      auditNodeId,
      ownerNodeId,
      lifeDomainNodeId: domainNodeId,
      syncedAt,
    },
    graph: normalizeGraph({ nodes, edges }),
  };
};

const normalizeGraphWorkspaceAuditReviewStatus = (status = '') =>
  ['pending-review', 'approved', 'rejected', 'revision-requested'].includes(status)
    ? status
    : 'pending-review';

const graphWorkspaceNodeIdFor = (workspaceId = '') =>
  String(workspaceId || '').startsWith('graph-workspace:')
    ? String(workspaceId)
    : `graph-workspace:${String(workspaceId || '').trim()}`;

const graphWorkspaceAuditNodeIdFor = (auditId = '') => {
  const normalizedAuditId = String(auditId || '').trim();
  if (!normalizedAuditId) return '';
  return normalizedAuditId.startsWith('graph-workspace-audit:')
    ? normalizedAuditId
    : `graph-workspace-audit:${slugGraphValue(normalizedAuditId) || stableHash(normalizedAuditId)}`;
};

const graphWorkspaceReviewNodeIdFor = (reviewId = '') => {
  const normalizedReviewId = String(reviewId || '').trim();
  if (!normalizedReviewId) return '';
  return normalizedReviewId.startsWith('graph-workspace-review:')
    ? normalizedReviewId
    : `graph-workspace-review:${slugGraphValue(normalizedReviewId) || stableHash(normalizedReviewId)}`;
};

const graphProvenanceLensNodeIdFor = (lensId = '') => {
  const normalizedLensId = String(lensId || '').trim();
  if (!normalizedLensId) return '';
  return normalizedLensId.startsWith('graph-provenance-lens:')
    ? normalizedLensId
    : `graph-provenance-lens:${slugGraphValue(normalizedLensId) || stableHash(normalizedLensId)}`;
};

const graphProvenanceLensActivityNodeIdFor = (lensId = '', activityId = '') => {
  const normalizedLensId = String(lensId || '').trim();
  const normalizedActivityId = String(activityId || '').trim();
  if (!normalizedLensId || !normalizedActivityId) return '';
  return `graph-provenance-lens-activity:${slugGraphValue(`${normalizedLensId}-${normalizedActivityId}`) || stableHash(`${normalizedLensId}:${normalizedActivityId}`)}`;
};

const followUpReconciliationAuditNodeIdFor = (auditId = '') => {
  const normalizedAuditId = String(auditId || '').trim();
  if (!normalizedAuditId) return '';
  return normalizedAuditId.startsWith('case-wiki-follow-up-reconciliation-audit:')
    ? normalizedAuditId
    : `case-wiki-follow-up-reconciliation-audit:${slugGraphValue(normalizedAuditId) || stableHash(normalizedAuditId)}`;
};

const followUpReconciliationReviewNodeIdFor = (reviewId = '') => {
  const normalizedReviewId = String(reviewId || '').trim();
  if (!normalizedReviewId) return '';
  return normalizedReviewId.startsWith('case-wiki-follow-up-reconciliation-review:')
    ? normalizedReviewId
    : `case-wiki-follow-up-reconciliation-review:${slugGraphValue(normalizedReviewId) || stableHash(normalizedReviewId)}`;
};

const normalizeGraphProvenanceLensReviewFilter = (reviewFilter = '') =>
  ['all', 'pending-review', 'approved', 'rejected', 'revision-requested'].includes(reviewFilter)
    ? reviewFilter
    : 'all';

const normalizeGraphProvenanceLensBrowserScope = (browserScope = '') =>
  browserScope === 'all-domains' ? 'all-domains' : 'active-domain';

const normalizeGraphProvenanceLensAccessRole = (role = '') =>
  ['viewer', 'editor', 'manager'].includes(role) ? role : 'viewer';

const normalizeGraphProvenanceLensAccessRoles = (roles = {}) => {
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) return {};
  return Object.fromEntries(
    Object.entries(roles)
      .map(([teammate, role]) => [String(teammate || '').trim(), normalizeGraphProvenanceLensAccessRole(role)])
      .filter(([teammate]) => Boolean(teammate)),
  );
};

const normalizeGraphProvenanceLensActivityRecords = (records = [], lensId = '') =>
  (Array.isArray(records) ? records : [])
    .filter((record) => record && typeof record === 'object' && !Array.isArray(record))
    .map((record, index) => {
      const createdAt =
        typeof record.createdAt === 'string' && record.createdAt.trim()
          ? record.createdAt.trim()
          : new Date().toISOString();
      const id =
        typeof record.id === 'string' && record.id.trim()
          ? record.id.trim()
          : `graph-provenance-lens-activity-${stableHash(`${lensId}:${record.type || 'activity'}:${createdAt}:${index}`)}`;
      return {
        id,
        nodeId: graphProvenanceLensActivityNodeIdFor(lensId, id),
        type:
          typeof record.type === 'string' && record.type.trim()
            ? record.type.trim()
            : 'updated',
        actor:
          typeof record.actor === 'string' && record.actor.trim()
            ? record.actor.trim()
            : 'Current worker',
        detail:
          typeof record.detail === 'string' && record.detail.trim()
            ? record.detail.trim()
            : 'Updated provenance lens.',
        createdAt,
        sharedWith: compactStringArray(Array.isArray(record.sharedWith) ? record.sharedWith : []),
        accessRole: normalizeGraphProvenanceLensAccessRole(record.accessRole),
        repairType:
          typeof record.repairType === 'string' && record.repairType.trim()
            ? record.repairType.trim()
            : '',
        reason:
          typeof record.reason === 'string' && record.reason.trim()
            ? record.reason.trim()
            : '',
        inspectionType:
          typeof record.inspectionType === 'string' && record.inspectionType.trim()
            ? record.inspectionType.trim()
            : '',
        inspectedActivityId:
          typeof record.inspectedActivityId === 'string' && record.inspectedActivityId.trim()
            ? record.inspectedActivityId.trim()
            : '',
        inspectedEdgeId:
          typeof record.inspectedEdgeId === 'string' && record.inspectedEdgeId.trim()
            ? record.inspectedEdgeId.trim()
            : '',
        inspectedFromNodeId:
          typeof record.inspectedFromNodeId === 'string' && record.inspectedFromNodeId.trim()
            ? record.inspectedFromNodeId.trim()
            : '',
        inspectedToNodeId:
          typeof record.inspectedToNodeId === 'string' && record.inspectedToNodeId.trim()
            ? record.inspectedToNodeId.trim()
            : '',
        inspectedRelationshipKind:
          typeof record.inspectedRelationshipKind === 'string' && record.inspectedRelationshipKind.trim()
            ? record.inspectedRelationshipKind.trim()
            : '',
        inspectedVirtualRelationshipType:
          typeof record.inspectedVirtualRelationshipType === 'string' && record.inspectedVirtualRelationshipType.trim()
            ? record.inspectedVirtualRelationshipType.trim()
            : '',
        backfilled: Boolean(record.backfilled || record.type === 'backfilled'),
      };
    })
    .filter((record) => record.nodeId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, GRAPH_PROVENANCE_LENS_ACTIVITY_LIMIT);

const normalizeCaseWikiGraphProvenanceLens = ({ lens = {}, userId = '' } = {}) => {
  if (!lens || typeof lens !== 'object' || Array.isArray(lens)) return null;
  const id =
    typeof lens.id === 'string' && lens.id.trim()
      ? lens.id.trim()
      : `life-domain-graph-provenance-view-${stableHash(`${lens.name || 'lens'}:${Date.now()}`)}`;
  const name = typeof lens.name === 'string' && lens.name.trim() ? lens.name.trim() : 'Saved provenance lens';
  const createdAt = typeof lens.createdAt === 'string' && lens.createdAt.trim() ? lens.createdAt.trim() : new Date().toISOString();
  const updatedAt = typeof lens.updatedAt === 'string' && lens.updatedAt.trim() ? lens.updatedAt.trim() : new Date().toISOString();
  const sharedWith = compactStringArray(Array.isArray(lens.sharedWith) ? lens.sharedWith : []);
  const visibility = lens.visibility === 'team' || sharedWith.length ? 'team' : 'private';
  const accessRole = normalizeGraphProvenanceLensAccessRole(lens.accessRole || (sharedWith.length ? 'viewer' : 'manager'));
  const accessRoles = normalizeGraphProvenanceLensAccessRoles(lens.accessRoles);
  const activityRecords = normalizeGraphProvenanceLensActivityRecords(lens.activityRecords, id);

  return {
    id,
    nodeId: graphProvenanceLensNodeIdFor(id),
    name,
    query: typeof lens.query === 'string' ? lens.query.trim() : '',
    reviewFilter: normalizeGraphProvenanceLensReviewFilter(lens.reviewFilter),
    domainFilter: typeof lens.domainFilter === 'string' && lens.domainFilter.trim() ? lens.domainFilter.trim() : 'all',
    browserScope: normalizeGraphProvenanceLensBrowserScope(lens.browserScope),
    resultCount: Math.max(0, Number(lens.resultCount) || 0),
    matchingWorkspaceCount: Math.max(0, Number(lens.matchingWorkspaceCount) || 0),
    createdAt,
    updatedAt,
    createdBy: typeof lens.createdBy === 'string' && lens.createdBy.trim() ? lens.createdBy.trim() : 'Current worker',
    visibility,
    sharedWith,
    shareNote: typeof lens.shareNote === 'string' ? lens.shareNote.trim() : '',
    accessRole,
    accessRoles,
    activityRecords,
    userId: String(userId || ''),
  };
};

const normalizeCaseWikiGraphWorkspaceReviewDecision = ({ decision = {}, userId = '' } = {}) => {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) return null;
  const auditId = typeof decision.auditId === 'string' ? decision.auditId.trim() : '';
  const workspaceId = typeof decision.workspaceId === 'string' ? decision.workspaceId.trim() : '';
  if (!auditId || !workspaceId) return null;

  const reviewedAt =
    typeof decision.reviewedAt === 'string' && decision.reviewedAt.trim()
      ? decision.reviewedAt.trim()
      : new Date().toISOString();
  const reviewId =
    typeof decision.id === 'string' && decision.id.trim()
      ? decision.id.trim()
      : `graph-workspace-audit-review-${stableHash(`${auditId}:${workspaceId}:${reviewedAt}`)}`;
  const status = normalizeGraphWorkspaceAuditReviewStatus(decision.status);

  return {
    id: reviewId,
    nodeId: graphWorkspaceReviewNodeIdFor(reviewId),
    auditId,
    auditNodeId: graphWorkspaceAuditNodeIdFor(auditId),
    workspaceId,
    workspaceNodeId: graphWorkspaceNodeIdFor(workspaceId),
    workspaceName:
      typeof decision.workspaceName === 'string' && decision.workspaceName.trim()
        ? decision.workspaceName.trim()
        : 'Saved graph workspace',
    snapshotHash: typeof decision.snapshotHash === 'string' ? decision.snapshotHash.trim() : '',
    snapshotVersion: Number(decision.snapshotVersion) || 0,
    status,
    note: typeof decision.note === 'string' ? decision.note.trim() : '',
    reviewer:
      typeof decision.reviewer === 'string' && decision.reviewer.trim()
        ? decision.reviewer.trim()
        : 'Current worker',
    reviewedAt,
    narrativeHeadline:
      typeof decision.narrativeHeadline === 'string' && decision.narrativeHeadline.trim()
        ? decision.narrativeHeadline.trim()
        : '',
    userId: String(userId || ''),
  };
};

const normalizeLocalArchiveSourceFamilyGraphDecision = ({ decisionRecord = {}, userId = '' } = {}) => {
  if (!decisionRecord || typeof decisionRecord !== 'object' || Array.isArray(decisionRecord)) return null;
  const candidateId = typeof decisionRecord.candidateId === 'string' ? decisionRecord.candidateId.trim() : '';
  const action = typeof decisionRecord.action === 'string' ? decisionRecord.action.trim() : '';
  if (!candidateId || !action) return null;
  const label =
    typeof decisionRecord.label === 'string' && decisionRecord.label.trim()
      ? decisionRecord.label.trim()
      : candidateId;
  const canonicalSource =
    decisionRecord.canonicalSource &&
    typeof decisionRecord.canonicalSource === 'object' &&
    !Array.isArray(decisionRecord.canonicalSource)
      ? decisionRecord.canonicalSource
      : {};
  const canonicalSourceId =
    typeof canonicalSource.sourceId === 'string' && canonicalSource.sourceId.trim()
      ? canonicalSource.sourceId.trim()
      : '';
  const canonicalSourceLabel =
    typeof canonicalSource.sourceLabel === 'string' && canonicalSource.sourceLabel.trim()
      ? canonicalSource.sourceLabel.trim()
      : canonicalSourceId;
  const canonicalSourcePageId =
    typeof canonicalSource.sourcePageId === 'string' && canonicalSource.sourcePageId.trim()
      ? canonicalSource.sourcePageId.trim()
      : '';
  const canonicalSourceHash =
    typeof canonicalSource.sourceHash === 'string' && canonicalSource.sourceHash.trim()
      ? canonicalSource.sourceHash.trim()
      : '';
  const canonicalLineageId =
    typeof decisionRecord.canonicalLineageId === 'string' && decisionRecord.canonicalLineageId.trim()
      ? decisionRecord.canonicalLineageId.trim()
      : canonicalSourceId;
  const decisionNodeId =
    typeof decisionRecord.graphNodeId === 'string' && decisionRecord.graphNodeId.trim()
      ? decisionRecord.graphNodeId.trim()
      : `local-archive-source-family-decision:${slugGraphValue(candidateId) || stableHash(candidateId)}`;

  return {
    id: typeof decisionRecord.id === 'string' && decisionRecord.id.trim()
      ? decisionRecord.id.trim()
      : `source-family-review-${stableHash(`${candidateId}:${action}`)}`,
    nodeId: decisionNodeId,
    candidateId,
    candidateNodeId: `local-archive-candidate:${slugGraphValue(candidateId) || stableHash(candidateId)}`,
    action,
    label,
    canonicalSourceId,
    canonicalSourceLabel,
    canonicalSourcePageId,
    canonicalSourceHash,
    canonicalSourceNodeId: canonicalSourceId ? `file:${canonicalSourceId}` : '',
    canonicalWikiNodeId: canonicalSourcePageId ? `wiki:${canonicalSourcePageId}` : '',
    canonicalLineageId,
    lineageNodeId: canonicalLineageId
      ? `source-family-lineage:${slugGraphValue(canonicalLineageId) || stableHash(canonicalLineageId)}`
      : '',
    note: typeof decisionRecord.note === 'string' ? decisionRecord.note.trim() : '',
    decidedAt: typeof decisionRecord.decidedAt === 'string' && decisionRecord.decidedAt.trim()
      ? decisionRecord.decidedAt.trim()
      : '',
    savedAt: typeof decisionRecord.savedAt === 'string' && decisionRecord.savedAt.trim()
      ? decisionRecord.savedAt.trim()
      : new Date().toISOString(),
    savedBy: typeof decisionRecord.savedBy === 'string' && decisionRecord.savedBy.trim()
      ? decisionRecord.savedBy.trim()
      : 'Current worker',
    userId: String(userId || ''),
    policy:
      typeof decisionRecord.policy === 'string' && decisionRecord.policy.trim()
        ? decisionRecord.policy.trim()
        : 'Source-family review metadata only. No vectors, attachments, promotions, file moves, or deletes.',
  };
};

const buildCaseWikiLocalArchiveSourceFamilyDecisionGraph = ({ decisionRecord, userId = '' } = {}) => {
  const decision = normalizeLocalArchiveSourceFamilyGraphDecision({ decisionRecord, userId });
  if (!decision || !decision.nodeId || !decision.candidateNodeId) return null;

  const reviewerNodeId = `case-wiki-person:${slugGraphValue(decision.savedBy) || stableHash(decision.savedBy)}`;
  const nodes = [
    {
      id: decision.nodeId,
      kind: 'SourceFamilyReviewDecision',
      props: {
        id: decision.nodeId,
        reviewId: decision.id,
        candidateId: decision.candidateId,
        action: decision.action,
        label: decision.label,
        canonicalSourceId: decision.canonicalSourceId,
        canonicalSourceLabel: decision.canonicalSourceLabel,
        canonicalSourcePageId: decision.canonicalSourcePageId,
        canonicalLineageId: decision.canonicalLineageId,
        note: decision.note,
        decidedAt: decision.decidedAt,
        savedAt: decision.savedAt,
        savedBy: decision.savedBy,
        userId: decision.userId,
        policy: decision.policy,
        graphWrite: true,
        vectorWrite: false,
        attachmentWrite: false,
        fileAction: false,
        source: 'Case Wiki local archive source-family review',
      },
    },
    {
      id: decision.candidateNodeId,
      kind: 'LocalArchiveCandidate',
      props: {
        id: decision.candidateNodeId,
        candidateId: decision.candidateId,
        label: decision.label,
        userId: decision.userId,
        source: 'Case Wiki local archive source-family review',
      },
    },
    {
      id: reviewerNodeId,
      kind: 'CaseWikiPerson',
      props: {
        id: reviewerNodeId,
        name: decision.savedBy,
        role: 'source-family-reviewer',
        source: 'Case Wiki local archive source-family review',
      },
    },
    ...(decision.lineageNodeId
      ? [
          {
            id: decision.lineageNodeId,
            kind: 'SourceFamilyLineage',
            props: {
              id: decision.lineageNodeId,
              canonicalLineageId: decision.canonicalLineageId,
              label: decision.canonicalSourceLabel || decision.canonicalLineageId,
              source: 'Case Wiki local archive source-family review',
            },
          },
        ]
      : []),
    ...(decision.canonicalSourceNodeId
      ? [
          {
            id: decision.canonicalSourceNodeId,
            kind: 'SourceFile',
            props: {
              id: decision.canonicalSourceNodeId,
              sourceId: decision.canonicalSourceId,
              name: decision.canonicalSourceLabel,
              sourceHash: decision.canonicalSourceHash,
              source: 'Case Wiki local archive source-family review',
            },
          },
        ]
      : []),
    ...(decision.canonicalWikiNodeId
      ? [
          {
            id: decision.canonicalWikiNodeId,
            kind: 'WikiPage',
            props: {
              id: decision.canonicalWikiNodeId,
              pageId: decision.canonicalSourcePageId,
              title: decision.canonicalSourceLabel,
              source: 'Case Wiki local archive source-family review',
            },
          },
        ]
      : []),
  ];

  const edges = [
    {
      from: decision.candidateNodeId,
      to: decision.nodeId,
      kind: 'HAS_SOURCE_FAMILY_REVIEW',
      props: {
        candidateId: decision.candidateId,
        action: decision.action,
        source: 'Case Wiki local archive source-family review',
      },
    },
    {
      from: decision.nodeId,
      to: reviewerNodeId,
      kind: 'REVIEWED_BY',
      props: {
        candidateId: decision.candidateId,
        action: decision.action,
        reviewedAt: decision.decidedAt || decision.savedAt,
        source: 'Case Wiki local archive source-family review',
      },
    },
    ...(decision.lineageNodeId
      ? [
          {
            from: decision.nodeId,
            to: decision.lineageNodeId,
            kind: 'IN_SOURCE_FAMILY',
            props: {
              candidateId: decision.candidateId,
              canonicalLineageId: decision.canonicalLineageId,
              action: decision.action,
              source: 'Case Wiki local archive source-family review',
            },
          },
        ]
      : []),
    ...(decision.canonicalSourceNodeId
      ? [
          {
            from: decision.nodeId,
            to: decision.canonicalSourceNodeId,
            kind: 'REVIEWS_CANONICAL_SOURCE',
            props: {
              candidateId: decision.candidateId,
              canonicalSourceId: decision.canonicalSourceId,
              action: decision.action,
              source: 'Case Wiki local archive source-family review',
            },
          },
          ...(decision.lineageNodeId
            ? [
                {
                  from: decision.lineageNodeId,
                  to: decision.canonicalSourceNodeId,
                  kind: 'HAS_CANONICAL_SOURCE',
                  props: {
                    canonicalLineageId: decision.canonicalLineageId,
                    canonicalSourceId: decision.canonicalSourceId,
                    source: 'Case Wiki local archive source-family review',
                  },
                },
              ]
            : []),
        ]
      : []),
    ...(decision.canonicalWikiNodeId
      ? [
          {
            from: decision.nodeId,
            to: decision.canonicalWikiNodeId,
            kind: 'REVIEWS_CANONICAL_WIKI_PAGE',
            props: {
              candidateId: decision.candidateId,
              pageId: decision.canonicalSourcePageId,
              action: decision.action,
              source: 'Case Wiki local archive source-family review',
            },
          },
          ...(decision.canonicalSourceNodeId
            ? [
                {
                  from: decision.canonicalSourceNodeId,
                  to: decision.canonicalWikiNodeId,
                  kind: 'GENERATED_WIKI_PAGE',
                  props: {
                    canonicalSourceId: decision.canonicalSourceId,
                    pageId: decision.canonicalSourcePageId,
                    source: 'Case Wiki local archive source-family review',
                  },
                },
              ]
            : []),
        ]
      : []),
  ];

  return {
    sourceFamilyDecision: decision,
    graph: normalizeGraph({ nodes, edges }),
  };
};

const buildCaseWikiGraphProvenanceLensGraph = ({ lens, userId = '' } = {}) => {
  const provenanceLens = normalizeCaseWikiGraphProvenanceLens({ lens, userId });
  if (!provenanceLens || !provenanceLens.nodeId) return null;

  const ownerNodeId = `case-wiki-person:${slugGraphValue(provenanceLens.createdBy) || stableHash(provenanceLens.createdBy)}`;
  const domainNodeId =
    provenanceLens.domainFilter && provenanceLens.domainFilter !== 'all'
      ? `life-domain:${slugGraphValue(provenanceLens.domainFilter) || 'unknown'}`
      : '';
  const sharedNodes = provenanceLens.sharedWith.map((teammate) => ({
    teammate,
    role: provenanceLens.accessRoles[teammate] || provenanceLens.accessRole || 'viewer',
    nodeId: `case-wiki-person:${slugGraphValue(teammate) || stableHash(teammate)}`,
  }));
  const activityActorNodes = provenanceLens.activityRecords.map((activity) => ({
    activity,
    nodeId: `case-wiki-person:${slugGraphValue(activity.actor) || stableHash(activity.actor)}`,
  }));
  const activityNodes = provenanceLens.activityRecords.map((activity) => ({
    id: activity.nodeId,
    kind: 'GraphProvenanceLensActivity',
    props: {
      id: activity.nodeId,
      activityId: activity.id,
      lensId: provenanceLens.id,
      type: activity.type,
      actor: activity.actor,
      detail: activity.detail,
      createdAt: activity.createdAt,
      sharedWith: activity.sharedWith,
      sharedWithJson: jsonProp(activity.sharedWith),
      accessRole: activity.accessRole,
      repairType: activity.repairType,
      reason: activity.reason,
      inspectionType: activity.inspectionType,
      inspectedActivityId: activity.inspectedActivityId,
      inspectedEdgeId: activity.inspectedEdgeId,
      inspectedFromNodeId: activity.inspectedFromNodeId,
      inspectedToNodeId: activity.inspectedToNodeId,
      inspectedRelationshipKind: activity.inspectedRelationshipKind,
      inspectedVirtualRelationshipType: activity.inspectedVirtualRelationshipType,
      backfilled: activity.backfilled,
      source: 'Case Wiki graph provenance lens activity',
    },
  }));
  const lastActivity = provenanceLens.activityRecords[0] ?? null;

  const nodes = [
    {
      id: provenanceLens.nodeId,
      kind: 'GraphProvenanceLens',
      props: {
        id: provenanceLens.nodeId,
        lensId: provenanceLens.id,
        name: provenanceLens.name,
        query: provenanceLens.query,
        reviewFilter: provenanceLens.reviewFilter,
        domainFilter: provenanceLens.domainFilter,
        browserScope: provenanceLens.browserScope,
        resultCount: provenanceLens.resultCount,
        matchingWorkspaceCount: provenanceLens.matchingWorkspaceCount,
        createdAt: provenanceLens.createdAt,
        updatedAt: provenanceLens.updatedAt,
        createdBy: provenanceLens.createdBy,
        visibility: provenanceLens.visibility,
        sharedWith: provenanceLens.sharedWith,
        sharedWithJson: jsonProp(provenanceLens.sharedWith),
        shareNote: provenanceLens.shareNote,
        accessRole: provenanceLens.accessRole,
        accessRolesJson: jsonProp(provenanceLens.accessRoles),
        activityRecordsJson: jsonProp(provenanceLens.activityRecords),
        activityCount: provenanceLens.activityRecords.length,
        lastActivityAt: lastActivity?.createdAt || '',
        lastActivityType: lastActivity?.type || '',
        lastActivityActor: lastActivity?.actor || '',
        userId: provenanceLens.userId,
        source: 'Case Wiki graph provenance lens',
      },
    },
    {
      id: ownerNodeId,
      kind: 'CaseWikiPerson',
      props: {
        id: ownerNodeId,
        name: provenanceLens.createdBy,
        role: 'owner',
        source: 'Case Wiki graph provenance lens',
      },
    },
    ...(domainNodeId
      ? [
          {
            id: domainNodeId,
            kind: 'LifeDomain',
            props: {
              id: domainNodeId,
              name: provenanceLens.domainFilter,
              lifeDomainId: provenanceLens.domainFilter,
              source: 'Case Wiki graph provenance lens',
            },
          },
        ]
      : []),
    ...sharedNodes.map(({ teammate, nodeId, role }) => ({
      id: nodeId,
      kind: 'CaseWikiPerson',
      props: {
        id: nodeId,
        name: teammate,
        role,
        source: 'Case Wiki graph provenance lens',
      },
    })),
    ...activityActorNodes.map(({ activity, nodeId }) => ({
      id: nodeId,
      kind: 'CaseWikiPerson',
      props: {
        id: nodeId,
        name: activity.actor,
        role: 'activity-actor',
        source: 'Case Wiki graph provenance lens activity',
      },
    })),
    ...activityNodes,
  ];

  const edges = [
    {
      from: provenanceLens.nodeId,
      to: ownerNodeId,
      kind: 'OWNED_BY',
      props: {
        lensId: provenanceLens.id,
        source: 'Case Wiki graph provenance lens',
      },
    },
    ...(domainNodeId
      ? [
          {
            from: provenanceLens.nodeId,
            to: domainNodeId,
            kind: 'FILTERS_DOMAIN',
            props: {
              lensId: provenanceLens.id,
              domainFilter: provenanceLens.domainFilter,
              source: 'Case Wiki graph provenance lens',
            },
          },
        ]
      : []),
    ...sharedNodes.map(({ nodeId, role }) => ({
      from: provenanceLens.nodeId,
      to: nodeId,
      kind: 'SHARED_WITH',
      props: {
        lensId: provenanceLens.id,
        role,
        source: 'Case Wiki graph provenance lens',
      },
    })),
    ...provenanceLens.activityRecords.map((activity) => ({
      from: provenanceLens.nodeId,
      to: activity.nodeId,
      kind: 'HAS_LENS_ACTIVITY',
      props: {
        lensId: provenanceLens.id,
        activityId: activity.id,
        type: activity.type,
        repairType: activity.repairType,
        backfilled: activity.backfilled,
        source: 'Case Wiki graph provenance lens activity',
      },
    })),
    ...activityActorNodes.map(({ activity, nodeId }) => ({
      from: activity.nodeId,
      to: nodeId,
      kind: 'ACTIVITY_BY',
      props: {
        lensId: provenanceLens.id,
        activityId: activity.id,
        actor: activity.actor,
        source: 'Case Wiki graph provenance lens activity',
      },
    })),
  ];

  return {
    provenanceLens,
    graph: normalizeGraph({ nodes, edges }),
  };
};

const buildCaseWikiGraphWorkspaceReviewGraph = ({ decision, userId = '' } = {}) => {
  const review = normalizeCaseWikiGraphWorkspaceReviewDecision({ decision, userId });
  if (!review || !review.auditNodeId || !review.workspaceNodeId || !review.nodeId) return null;

  const nodes = [
    {
      id: review.nodeId,
      kind: 'GraphWorkspaceReview',
      props: {
        id: review.nodeId,
        reviewId: review.id,
        auditId: review.auditId,
        auditNodeId: review.auditNodeId,
        workspaceId: review.workspaceId,
        workspaceName: review.workspaceName,
        snapshotHash: review.snapshotHash,
        snapshotVersion: review.snapshotVersion,
        status: review.status,
        note: review.note,
        reviewer: review.reviewer,
        reviewedAt: review.reviewedAt,
        narrativeHeadline: review.narrativeHeadline,
        userId: review.userId,
        source: 'Case Wiki graph workspace review',
      },
    },
    {
      id: review.auditNodeId,
      kind: 'GraphWorkspaceAudit',
      props: {
        id: review.auditNodeId,
        workspaceId: review.workspaceId,
        workspaceName: review.workspaceName,
        source: 'Case Wiki graph workspace review',
      },
    },
    {
      id: review.workspaceNodeId,
      kind: 'GraphWorkspace',
      props: {
        id: review.workspaceNodeId,
        workspaceId: review.workspaceId,
        name: review.workspaceName,
        userId: review.userId,
        source: 'Case Wiki graph workspace review',
      },
    },
  ];

  const edges = [
    {
      from: review.auditNodeId,
      to: review.nodeId,
      kind: 'HAS_WORKSPACE_REVIEW',
      props: {
        auditId: review.auditId,
        workspaceId: review.workspaceId,
        status: review.status,
        reviewer: review.reviewer,
        reviewedAt: review.reviewedAt,
        source: 'Case Wiki graph workspace review',
      },
    },
    {
      from: review.workspaceNodeId,
      to: review.nodeId,
      kind: 'HAS_WORKSPACE_REVIEW',
      props: {
        auditId: review.auditId,
        workspaceId: review.workspaceId,
        status: review.status,
        reviewer: review.reviewer,
        reviewedAt: review.reviewedAt,
        source: 'Case Wiki graph workspace review',
      },
    },
    {
      from: review.nodeId,
      to: review.auditNodeId,
      kind: 'REVIEWS_AUDIT',
      props: {
        auditId: review.auditId,
        workspaceId: review.workspaceId,
        status: review.status,
        source: 'Case Wiki graph workspace review',
      },
    },
  ];

  return {
    graphWorkspaceReview: review,
    graph: normalizeGraph({ nodes, edges }),
  };
};

const normalizeCaseWikiFollowUpTaskReconciliationReview = ({
  auditRecord = {},
  reviewer = '',
  userId = '',
} = {}) => {
  if (!auditRecord || typeof auditRecord !== 'object' || Array.isArray(auditRecord)) return null;
  const auditId = typeof auditRecord.id === 'string' ? auditRecord.id.trim() : '';
  if (!auditId) return null;
  const reviewedAt = new Date().toISOString();
  const reviewId = `follow-up-reconciliation-review-${stableHash(`${auditId}:${reviewer}:${reviewedAt}`)}`;
  const taskId = typeof auditRecord.taskId === 'string' ? auditRecord.taskId.trim() : '';
  const followUpId = typeof auditRecord.followUpId === 'string' ? auditRecord.followUpId.trim() : '';
  const lensId = typeof auditRecord.lensId === 'string' ? auditRecord.lensId.trim() : '';
  const actor =
    typeof auditRecord.actor === 'string' && auditRecord.actor.trim()
      ? auditRecord.actor.trim()
      : 'Case Wiki manager';
  return {
    id: reviewId,
    nodeId: followUpReconciliationReviewNodeIdFor(reviewId),
    auditId,
    auditNodeId: followUpReconciliationAuditNodeIdFor(auditId),
    taskId,
    taskNodeId: taskId ? `case-wiki-task:${slugGraphValue(taskId) || stableHash(taskId)}` : '',
    followUpId,
    followUpNodeId: followUpId ? `case-wiki-inspection-follow-up:${slugGraphValue(followUpId) || stableHash(followUpId)}` : '',
    lensId,
    lensNodeId: lensId ? graphProvenanceLensNodeIdFor(lensId) : '',
    actor,
    actorNodeId: `case-wiki-person:${slugGraphValue(actor) || stableHash(actor)}`,
    reviewer: typeof reviewer === 'string' && reviewer.trim() ? reviewer.trim() : actor,
    reviewedAt,
    object: typeof auditRecord.object === 'string' ? auditRecord.object.trim() : '',
    action: typeof auditRecord.action === 'string' ? auditRecord.action.trim() : '',
    status: typeof auditRecord.status === 'string' ? auditRecord.status.trim() : '',
    decision: typeof auditRecord.decision === 'string' ? auditRecord.decision.trim() : '',
    detail: typeof auditRecord.detail === 'string' ? auditRecord.detail.trim() : '',
    timestamp: typeof auditRecord.timestamp === 'string' ? auditRecord.timestamp.trim() : '',
    repairType: typeof auditRecord.repairType === 'string' ? auditRecord.repairType.trim() : '',
    reviewPattern: typeof auditRecord.reviewPattern === 'string' ? auditRecord.reviewPattern.trim() : '',
    userId: String(userId || ''),
  };
};

const buildCaseWikiFollowUpTaskReconciliationReviewGraph = ({
  auditRecord,
  reviewer = '',
  userId = '',
} = {}) => {
  const review = normalizeCaseWikiFollowUpTaskReconciliationReview({ auditRecord, reviewer, userId });
  if (!review || !review.nodeId || !review.auditNodeId) return null;

  const nodes = [
    {
      id: review.nodeId,
      kind: 'CaseWikiFollowUpTaskReconciliationReview',
      props: {
        id: review.nodeId,
        reviewId: review.id,
        auditId: review.auditId,
        taskId: review.taskId,
        followUpId: review.followUpId,
        lensId: review.lensId,
        action: review.action,
        object: review.object,
        status: review.status,
        decision: review.decision,
        detail: review.detail,
        reviewer: review.reviewer,
        reviewedAt: review.reviewedAt,
        userId: review.userId,
        source: 'Case Wiki follow-up reconciliation review',
      },
    },
    {
      id: review.auditNodeId,
      kind: 'CaseWikiFollowUpTaskReconciliationAudit',
      props: {
        id: review.auditNodeId,
        auditId: review.auditId,
        action: review.action,
        object: review.object,
        actor: review.actor,
        timestamp: review.timestamp,
        status: review.status,
        decision: review.decision,
        repairType: review.repairType,
        reviewPattern: review.reviewPattern,
        source: 'Case Wiki follow-up reconciliation audit',
      },
    },
    {
      id: review.actorNodeId,
      kind: 'Person',
      props: {
        id: review.actorNodeId,
        name: review.actor,
        source: 'Case Wiki follow-up reconciliation review',
      },
    },
    ...(review.taskNodeId
      ? [
          {
            id: review.taskNodeId,
            kind: 'CaseWikiTask',
            props: {
              id: review.taskNodeId,
              taskId: review.taskId,
              title: review.object,
              source: 'Case Wiki follow-up reconciliation review',
            },
          },
        ]
      : []),
    ...(review.followUpNodeId
      ? [
          {
            id: review.followUpNodeId,
            kind: 'CaseWikiInspectionFollowUp',
            props: {
              id: review.followUpNodeId,
              followUpId: review.followUpId,
              repairType: review.repairType,
              reviewPattern: review.reviewPattern,
              source: 'Case Wiki follow-up reconciliation review',
            },
          },
        ]
      : []),
    ...(review.lensNodeId
      ? [
          {
            id: review.lensNodeId,
            kind: 'GraphProvenanceLens',
            props: {
              id: review.lensNodeId,
              lensId: review.lensId,
              source: 'Case Wiki follow-up reconciliation review',
            },
          },
        ]
      : []),
  ];

  const edges = [
    {
      from: review.auditNodeId,
      to: review.nodeId,
      kind: 'HAS_FOLLOW_UP_RECONCILIATION_REVIEW',
      props: {
        auditId: review.auditId,
        status: review.status,
        decision: review.decision,
        reviewer: review.reviewer,
        reviewedAt: review.reviewedAt,
        source: 'Case Wiki follow-up reconciliation review',
      },
    },
    {
      from: review.nodeId,
      to: review.auditNodeId,
      kind: 'REVIEWS_RECONCILIATION_AUDIT',
      props: {
        auditId: review.auditId,
        source: 'Case Wiki follow-up reconciliation review',
      },
    },
    {
      from: review.actorNodeId,
      to: review.nodeId,
      kind: 'RECORDED_RECONCILIATION_REVIEW',
      props: {
        actor: review.actor,
        reviewer: review.reviewer,
        source: 'Case Wiki follow-up reconciliation review',
      },
    },
    ...(review.taskNodeId
      ? [
          {
            from: review.nodeId,
            to: review.taskNodeId,
            kind: 'RECONCILES_TASK',
            props: { taskId: review.taskId, source: 'Case Wiki follow-up reconciliation review' },
          },
        ]
      : []),
    ...(review.followUpNodeId
      ? [
          {
            from: review.nodeId,
            to: review.followUpNodeId,
            kind: 'RECONCILES_FOLLOW_UP',
            props: { followUpId: review.followUpId, source: 'Case Wiki follow-up reconciliation review' },
          },
        ]
      : []),
    ...(review.lensNodeId
      ? [
          {
            from: review.nodeId,
            to: review.lensNodeId,
            kind: 'REVIEWS_PROVENANCE_LENS_WORKLOAD',
            props: { lensId: review.lensId, source: 'Case Wiki follow-up reconciliation review' },
          },
        ]
      : []),
  ];

  return {
    followUpReconciliationReview: review,
    graph: normalizeGraph({ nodes, edges }),
  };
};

const relatedSourcesForIngestion = (selected = {}, allIngestions = []) => {
  const selectedGraph = ingestionGraph(selected);
  const selectedLabels = graphLabelsForIngestion(selected);
  const selectedNodeIds = new Set(selectedGraph.nodes.map((node) => node.id));
  const selectedCollections = new Set(selectedLabels.collections);

  return allIngestions
    .filter((ingestion) => ingestion.fileId && ingestion.fileId !== selected.fileId)
    .map((ingestion) => {
      const graph = ingestionGraph(ingestion);
      const labels = graphLabelsForIngestion(ingestion);
      const sharedNodes = graph.nodes.filter((node) => selectedNodeIds.has(node.id)).map((node) => node.id);
      const sharedCollections = labels.collections.filter((collection) => selectedCollections.has(collection));
      const sameDomain = labels.lifeDomainId === selectedLabels.lifeDomainId && labels.lifeDomainId !== 'unknown';
      const score = sharedNodes.length * 3 + sharedCollections.length * 2 + (sameDomain ? 1 : 0);
      return {
        id: ingestion.fileId,
        pageId: labels.pageId,
        title: labels.title,
        fileName: labels.fileName,
        lifeDomain: labels.lifeDomain,
        sourceKind: labels.sourceKind,
        reviewStatus: labels.reviewStatus,
        score,
        reasons: compactStringArray([
          ...sharedNodes.slice(0, 4).map((nodeId) => `shared node ${nodeId}`),
          ...sharedCollections.slice(0, 3).map((collection) => `same collection ${collection}`),
          sameDomain ? `same domain ${labels.lifeDomain}` : '',
        ]),
      };
    })
    .filter((source) => source.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);
};

const relationshipReviewRecordsForIngestion = (ingestion = {}) => {
  const records = Array.isArray(ingestion.relationshipReviewRecords)
    ? ingestion.relationshipReviewRecords
    : Array.isArray(ingestion.generatedRecords?.frontendRecord?.relationshipReviewRecords)
      ? ingestion.generatedRecords.frontendRecord.relationshipReviewRecords
      : [];
  return records.filter(
    (record) =>
      record &&
      typeof record.relationshipKey === 'string' &&
      ['approved', 'rejected'].includes(record.status),
  );
};

const relationshipReviewNodeId = (record = {}) =>
  typeof record.id === 'string' && record.id.startsWith('relationship-review-')
    ? record.id.replace('relationship-review-', 'relationship-review:')
    : `relationship-review:${Buffer.from(record.relationshipKey || record.id || 'relationship-review')
        .toString('hex')
        .slice(0, 18)}`;

const relationshipReviewSummaryForIngestion = (ingestion = {}) => {
  const records = relationshipReviewRecordsForIngestion(ingestion);
  return records.reduce(
    (summary, record) => {
      summary.total += 1;
      if (record.status === 'approved') summary.approved += 1;
      if (record.status === 'rejected') summary.rejected += 1;
      return summary;
    },
    { total: 0, approved: 0, rejected: 0 },
  );
};

const relationshipReviewGraphDiffForIngestion = (ingestion = {}) =>
  relationshipReviewRecordsForIngestion(ingestion)
    .map((record) => ({
      id: record.id,
      relationshipKey: record.relationshipKey,
      status: record.status,
      reviewedAt: record.reviewedAt,
      reviewedBy: record.reviewedBy,
      sourceId: record.sourceId || ingestion.fileId || '',
      sourceTitle: record.sourceTitle || graphLabelsForIngestion(ingestion).title,
      before: {
        from: record.from,
        to: record.to,
        kind: record.kind,
        label: record.label || String(record.kind || '').replace(/_/g, ' ').toLowerCase(),
      },
      after: {
        decisionNodeId: relationshipReviewNodeId(record),
        decisionEdgeKind: 'HAS_RELATIONSHIP_REVIEW',
        relationshipEdgeKind: record.status === 'approved' ? 'APPROVED_RELATIONSHIP' : 'REJECTED_RELATIONSHIP',
        fromNodeId: record.fromNodeId || '',
        toNodeId: record.toNodeId || '',
      },
    }))
    .slice(0, 20);

const embeddingReviewNodeIdForIngestion = (ingestion = {}) =>
  `embedding-review:${stableHash(ingestion.fileId || ingestion.generatedRecords?.frontendRecord?.id || 'source')}`;

const embeddingChunkNodeIdFor = (ingestion = {}, chunk = {}) =>
  `embedding-chunk:${stableHash(`${ingestion.fileId || ingestion.generatedRecords?.frontendRecord?.id || 'source'}:${chunk.id || chunk.ordinal || 'chunk'}`)}`;

const vectorIndexNodeIdFor = (provider = 'weaviate', collection = 'CaseWikiSourceChunk') =>
  `vector-index:${slugGraphValue(provider) || 'vector'}:${slugGraphValue(collection) || 'case-wiki-source-chunk'}`;

const chunkTextForGraph = (chunk = {}) =>
  typeof chunk.text === 'string' && chunk.text.trim()
    ? chunk.text
    : typeof chunk.textPreview === 'string'
      ? chunk.textPreview
      : '';

const buildCaseWikiEmbeddingReviewGraph = ({
  ingestion = {},
  embeddingReview = {},
  weaviateDryRun = null,
  vectorWrite = null,
  action = '',
} = {}) => {
  const labels = graphLabelsForIngestion(ingestion);
  const sourceId = labels.fileId || ingestion.fileId || ingestion.generatedRecords?.frontendRecord?.id || '';
  if (!sourceId) return null;

  const chunks = Array.isArray(embeddingReview.chunks) ? embeddingReview.chunks : [];
  const reviewedAt = new Date().toISOString();
  const sourceNodeId = `file:${sourceId}`;
  const wikiNodeId = labels.pageId ? `wiki:${labels.pageId}` : ingestionWikiNodeId(ingestion);
  const reviewNodeId = embeddingReviewNodeIdForIngestion(ingestion);
  const provider = vectorWrite?.provider || weaviateDryRun?.provider || 'weaviate';
  const collection =
    vectorWrite?.collection ||
    vectorWrite?.targetClass ||
    weaviateDryRun?.collection ||
    weaviateDryRun?.targetClass ||
    'CaseWikiSourceChunk';
  const vectorIndexNodeId = vectorIndexNodeIdFor(provider, collection);
  const dryRunObjects = Array.isArray(weaviateDryRun?.objects) ? weaviateDryRun.objects : [];
  const dryRunObjectByChunk = new Map(
    dryRunObjects
      .map((object) => [object?.properties?.chunkId, object])
      .filter(([chunkId, object]) => chunkId && object?.id),
  );
  const writtenObjectIds = Array.isArray(vectorWrite?.objectIds) ? vectorWrite.objectIds : [];

  const nodes = [
    {
      id: sourceNodeId,
      kind: 'SourceFile',
      props: {
        id: sourceNodeId,
        sourceDocumentId: sourceId,
        name: labels.fileName || labels.title,
        title: labels.title,
        lifeDomain: labels.lifeDomain,
        lifeDomainId: labels.lifeDomainId,
        sourceKind: labels.sourceKind,
        reviewStatus: labels.reviewStatus,
        source: 'Case Wiki embedding review',
      },
    },
    ...(wikiNodeId
      ? [
          {
            id: wikiNodeId,
            kind: 'WikiPage',
            props: {
              id: wikiNodeId,
              pageId: labels.pageId,
              title: labels.title,
              sourceDocumentId: sourceId,
              source: 'Case Wiki embedding review',
            },
          },
        ]
      : []),
    {
      id: reviewNodeId,
      kind: 'EmbeddingReview',
      props: {
        id: reviewNodeId,
        sourceDocumentId: sourceId,
        status: embeddingReview.status || 'awaiting-review',
        action,
        writeMode: embeddingReview.writeMode || 'dry-run',
        writeEnabled: Boolean(embeddingReview.writeEnabled),
        chunkCount: Number(embeddingReview.chunkCount) || chunks.length,
        pendingCount: Number(embeddingReview.pendingCount) || 0,
        approvedCount: Number(embeddingReview.approvedCount) || 0,
        rejectedCount: Number(embeddingReview.rejectedCount) || 0,
        dryRunStatus: weaviateDryRun?.status || '',
        dryRunObjectCount: Number(weaviateDryRun?.objectCount) || 0,
        vectorWriteStatus: vectorWrite?.status || '',
        vectorObjectCount: Number(vectorWrite?.objectCount) || 0,
        provider,
        collection,
        reviewedAt,
        source: 'Case Wiki embedding review',
      },
    },
    {
      id: vectorIndexNodeId,
      kind: 'VectorIndex',
      props: {
        id: vectorIndexNodeId,
        name: collection,
        provider,
        collection,
        endpoint: vectorWrite?.endpoint || weaviateDryRun?.endpoint || '',
        embeddingModel: vectorWrite?.embeddingModel || weaviateDryRun?.embeddingModel || '',
        status: vectorWrite?.status || weaviateDryRun?.status || 'planned',
        source: 'Case Wiki embedding review',
      },
    },
  ];

  const edges = [
    {
      from: sourceNodeId,
      to: reviewNodeId,
      kind: 'HAS_EMBEDDING_REVIEW',
      props: {
        action,
        status: embeddingReview.status || 'awaiting-review',
        reviewedAt,
        source: 'Case Wiki embedding review',
      },
    },
    ...(wikiNodeId
      ? [
          {
            from: reviewNodeId,
            to: wikiNodeId,
            kind: 'REVIEWS_WIKI_PAGE',
            props: {
              sourceDocumentId: sourceId,
              source: 'Case Wiki embedding review',
            },
          },
        ]
      : []),
  ];

  chunks.slice(0, 500).forEach((chunk, index) => {
    const chunkNodeId = embeddingChunkNodeIdFor(ingestion, chunk);
    const chunkText = chunkTextForGraph(chunk);
    const dryRunObject = dryRunObjectByChunk.get(chunk.id);
    const vectorObjectId = dryRunObject?.id || writtenObjectIds[index] || '';
    const chunkStatus = chunk.status || chunk.embeddingAction || 'pending-review';

    nodes.push({
      id: chunkNodeId,
      kind: 'EmbeddingChunk',
      props: {
        id: chunkNodeId,
        chunkId: chunk.id || '',
        sourceDocumentId: sourceId,
        wikiPageId: labels.pageId,
        sectionId: chunk.sectionId || '',
        ordinal: Number(chunk.ordinal) || index + 1,
        status: chunkStatus,
        embeddingAction: chunk.embeddingAction || chunkStatus,
        privacyLevel: chunk.privacyLevel || embeddingReview.privacyLevel || '',
        redactionMode: chunk.redactionMode || embeddingReview.redactionMode || '',
        reviewedBy: chunk.reviewedBy || '',
        reviewedAt: chunk.reviewedAt || '',
        reviewNote: chunk.reviewNote || '',
        editedAt: chunk.editedAt || '',
        editedBy: chunk.editedBy || '',
        textHash: chunkText ? stableHash(chunkText) : '',
        textPreview: truncateText(chunkText, 260),
        tokenEstimate: Number(chunk.tokenEstimate) || 0,
        charCount: Number(chunk.charCount) || chunkText.length,
        vectorObjectId,
        provider,
        collection,
        source: 'Case Wiki embedding review',
      },
    });

    edges.push(
      {
        from: reviewNodeId,
        to: chunkNodeId,
        kind: 'HAS_REVIEW_CHUNK',
        props: {
          chunkId: chunk.id || '',
          status: chunkStatus,
          source: 'Case Wiki embedding review',
        },
      },
      {
        from: chunkNodeId,
        to: sourceNodeId,
        kind: 'CHUNK_OF_SOURCE',
        props: {
          chunkId: chunk.id || '',
          source: 'Case Wiki embedding review',
        },
      },
    );

    if (wikiNodeId) {
      edges.push({
        from: chunkNodeId,
        to: wikiNodeId,
        kind: 'CHUNK_OF_PAGE',
        props: {
          chunkId: chunk.id || '',
          source: 'Case Wiki embedding review',
        },
      });
    }

    if (chunkStatus === 'approved-for-embedding') {
      edges.push({
        from: chunkNodeId,
        to: vectorIndexNodeId,
        kind: vectorWrite?.status === 'written' || vectorWrite?.status === 'partial' ? 'INDEXED_IN' : 'READY_FOR_INDEX',
        props: {
          chunkId: chunk.id || '',
          objectId: vectorObjectId,
          provider,
          collection,
          status: vectorWrite?.status || weaviateDryRun?.status || 'prepared',
          source: 'Case Wiki embedding review',
        },
      });
    } else if (chunkStatus === 'do-not-embed') {
      edges.push({
        from: chunkNodeId,
        to: vectorIndexNodeId,
        kind: 'EXCLUDED_FROM_INDEX',
        props: {
          chunkId: chunk.id || '',
          provider,
          collection,
          status: chunkStatus,
          source: 'Case Wiki embedding review',
        },
      });
    } else {
      edges.push({
        from: chunkNodeId,
        to: reviewNodeId,
        kind: 'AWAITING_EMBEDDING_REVIEW',
        props: {
          chunkId: chunk.id || '',
          status: chunkStatus,
          source: 'Case Wiki embedding review',
        },
      });
    }
  });

  const graph = normalizeGraph({ nodes, edges });
  return {
    reviewNodeId,
    sourceNodeId,
    wikiNodeId,
    vectorIndexNodeId,
    chunkNodeCount: chunks.length,
    graph,
    summary: summarizeGraph(graph),
  };
};

const neo4jConfig = () => {
  const neo4jUrl =
    process.env.NEO4J_HTTP_URL ||
    process.env.CASE_MANAGEMENT_NEO4J_HTTP_URL ||
    'http://case-management-neo4j:7474';
  const database = process.env.NEO4J_DATABASE || 'neo4j';
  const username = process.env.NEO4J_USERNAME || process.env.NEO4J_USER || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || process.env.CASE_MANAGEMENT_NEO4J_PASSWORD || 'streetvoicescasewiki';
  return {
    endpoint: `${neo4jUrl.replace(/\/$/, '')}/db/${encodeURIComponent(database)}/tx/commit`,
    username,
    password,
  };
};

const queryNeo4jNeighbors = async ({ focusNodeIds = [] }) => {
  if (process.env.CASE_MANAGEMENT_NEO4J_DISABLED === 'true') {
    return { status: 'skipped', message: 'CASE_MANAGEMENT_NEO4J_DISABLED is true', graph: null };
  }
  if (!focusNodeIds.length) {
    return { status: 'skipped', message: 'No focus nodes available for graph query', graph: null };
  }

  const config = neo4jConfig();
  const headers = { 'Content-Type': 'application/json' };
  if (config.username && config.password) {
    headers.Authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
  }

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        statements: [
          {
            statement: `
              MATCH (focus:CaseManagementKnowledge)
              WHERE focus.id IN $focusNodeIds
              OPTIONAL MATCH (focus)-[rel:RELATED_TO]-(neighbor:CaseManagementKnowledge)
              WITH collect(DISTINCT focus) + collect(DISTINCT neighbor) AS rawNodes, collect(DISTINCT rel) AS rawRels
              UNWIND rawNodes AS node
              WITH collect(DISTINCT node) AS nodes, rawRels
              RETURN
                [node IN nodes WHERE node IS NOT NULL | { id: node.id, kind: node.kind, props: properties(node) }] AS nodes,
                [rel IN rawRels WHERE rel IS NOT NULL | { from: startNode(rel).id, to: endNode(rel).id, kind: rel.kind, props: properties(rel) }] AS edges
            `,
            parameters: { focusNodeIds },
          },
        ],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.errors?.length) {
      return {
        status: 'failed',
        message: payload.errors?.[0]?.message || `Neo4j returned ${response.status}`,
        graph: null,
      };
    }
    const row = payload.results?.[0]?.data?.[0]?.row;
    const graph = normalizeGraph({ nodes: row?.[0] || [], edges: row?.[1] || [] });
    return {
      status: graph.nodes.length ? 'ready' : 'empty',
      message: graph.nodes.length ? 'Neo4j graph query returned neighbors' : 'Neo4j had no neighbors for this source yet',
      graph,
    };
  } catch (error) {
    return { status: 'failed', message: error.message, graph: null };
  }
};

const normalizeNeo4jGraphWorkspaceRecord = (record = {}) => {
  const workspace = record.workspace || {};
  const audits = Array.isArray(record.audits) ? record.audits : [];
  const workspaceId =
    typeof workspace.workspaceId === 'string' && workspace.workspaceId
      ? workspace.workspaceId
      : String(workspace.id || workspace.nodeId || '').replace(/^graph-workspace:/, '');
  const latestAudit = audits[0] || {};
  const normalizeAuditSnapshot = (audit = {}) => {
    const snapshot = parseJsonProp(audit.snapshotJson, null);
    return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot : null;
  };
  const normalizeAuditReview = (review = {}) => ({
    id: typeof review.reviewId === 'string' && review.reviewId ? review.reviewId : String(review.id || ''),
    nodeId: typeof review.id === 'string' ? review.id : '',
    auditId: typeof review.auditId === 'string' ? review.auditId : '',
    workspaceId: typeof review.workspaceId === 'string' ? review.workspaceId : workspaceId,
    workspaceName: typeof review.workspaceName === 'string' ? review.workspaceName : workspace.name || '',
    snapshotHash: typeof review.snapshotHash === 'string' ? review.snapshotHash : '',
    snapshotVersion: Number(review.snapshotVersion) || 0,
    status: normalizeGraphWorkspaceAuditReviewStatus(review.status),
    note: typeof review.note === 'string' ? review.note : '',
    reviewer: typeof review.reviewer === 'string' ? review.reviewer : '',
    reviewedAt: typeof review.reviewedAt === 'string' ? review.reviewedAt : '',
    narrativeHeadline: typeof review.narrativeHeadline === 'string' ? review.narrativeHeadline : '',
  });
  const graphWorkspaceAuditReviews = audits
    .flatMap((audit) => (Array.isArray(audit.reviews) ? audit.reviews : []))
    .map(normalizeAuditReview)
    .filter((review) => review.id && review.auditId);

  return {
    id: workspaceId,
    name: typeof workspace.name === 'string' && workspace.name.trim() ? workspace.name.trim() : 'Saved graph workspace',
    savedAt:
      typeof workspace.savedAt === 'string' && workspace.savedAt
        ? workspace.savedAt
        : typeof workspace.syncedAt === 'string' && workspace.syncedAt
          ? workspace.syncedAt
          : new Date().toISOString(),
    owner: typeof workspace.owner === 'string' && workspace.owner ? workspace.owner : 'Current worker',
    visibility: workspace.visibility === 'team' ? 'team' : 'private',
    sharedWith: compactStringArray(Array.isArray(workspace.sharedWith) ? workspace.sharedWith : []),
    accessRole: normalizeGraphWorkspaceAccessRole(workspace.accessRole || 'manager'),
    accessRoles: parseJsonProp(workspace.accessRolesJson, {}),
    duplicatedFromId: typeof workspace.duplicatedFromId === 'string' ? workspace.duplicatedFromId : '',
    shareNote: typeof workspace.shareNote === 'string' ? workspace.shareNote : '',
    graphWorkspaceNodeId: typeof workspace.nodeId === 'string' ? workspace.nodeId : workspace.id || '',
    graphWorkspaceAuditId: typeof latestAudit.id === 'string' ? latestAudit.id : '',
    graphWorkspaceSyncedAt: typeof workspace.syncedAt === 'string' ? workspace.syncedAt : '',
    graphWorkspaceSyncStatus: 'written',
    graphWorkspaceSyncMessage: `Loaded from Neo4j with ${audits.length} audit event${audits.length === 1 ? '' : 's'}.`,
    graphWorkspaceSyncAction: typeof latestAudit.action === 'string' ? latestAudit.action : '',
    graphFilter: typeof workspace.graphFilter === 'string' ? workspace.graphFilter : 'all',
    graphSearchQuery: typeof workspace.graphSearchQuery === 'string' ? workspace.graphSearchQuery : '',
    relationshipStatusFilter:
      typeof workspace.relationshipStatusFilter === 'string' ? workspace.relationshipStatusFilter : 'all',
    relationshipKindFilter:
      typeof workspace.relationshipKindFilter === 'string' ? workspace.relationshipKindFilter : 'all',
    relationshipEntityFilter:
      typeof workspace.relationshipEntityFilter === 'string' ? workspace.relationshipEntityFilter : 'all',
    entityKindFilter: typeof workspace.entityKindFilter === 'string' ? workspace.entityKindFilter : 'all',
    graphZoom: Number(workspace.graphZoom) || 100,
    graphShowLabels: workspace.graphShowLabels !== false,
    graphLayout: typeof workspace.graphLayout === 'string' ? workspace.graphLayout : 'compact',
    graphScope: typeof workspace.graphScope === 'string' ? workspace.graphScope : 'focused',
    graphPinnedPositions: parseJsonProp(workspace.pinnedPositionsJson, {}),
    graphSlice: normalizeGraphWorkspaceSlice(parseJsonProp(workspace.graphSliceJson, null)) || undefined,
    pageId: typeof workspace.pageId === 'string' ? workspace.pageId : '',
    lifeDomainId: typeof workspace.lifeDomainId === 'string' ? workspace.lifeDomainId : 'all',
    updatedAt: typeof workspace.updatedAt === 'string' ? workspace.updatedAt : '',
    graphWorkspaceAuditReviews,
    graphWorkspaceAuditHistory: audits.map((audit) => ({
      id: typeof audit.id === 'string' ? audit.id : '',
      action: typeof audit.action === 'string' ? audit.action : 'synced',
      workspaceId: typeof audit.workspaceId === 'string' ? audit.workspaceId : workspaceId,
      workspaceName: typeof audit.workspaceName === 'string' ? audit.workspaceName : workspace.name || '',
      actor: typeof audit.actor === 'string' ? audit.actor : '',
      syncedAt: typeof audit.syncedAt === 'string' ? audit.syncedAt : '',
      graphFilter: typeof audit.graphFilter === 'string' ? audit.graphFilter : '',
      graphSearchQuery: typeof audit.graphSearchQuery === 'string' ? audit.graphSearchQuery : '',
      relationshipStatusFilter:
        typeof audit.relationshipStatusFilter === 'string' ? audit.relationshipStatusFilter : '',
      graphLayout: typeof audit.graphLayout === 'string' ? audit.graphLayout : '',
      graphScope: typeof audit.graphScope === 'string' ? audit.graphScope : '',
      pinnedNodeCount: Number(audit.pinnedNodeCount) || 0,
      graphNodeCount: Number(audit.graphNodeCount) || 0,
      graphEdgeCount: Number(audit.graphEdgeCount) || 0,
      graphHiddenEntityCount: Number(audit.graphHiddenEntityCount) || 0,
      graphHiddenSourceCount: Number(audit.graphHiddenSourceCount) || 0,
      graphSliceHash: typeof audit.graphSliceHash === 'string' ? audit.graphSliceHash : '',
      graphSlice: normalizeGraphWorkspaceSlice(parseJsonProp(audit.graphSliceJson, null)) || undefined,
      visibility: typeof audit.visibility === 'string' ? audit.visibility : '',
      sharedCount: Number(audit.sharedCount) || 0,
      snapshotVersion: Number(audit.snapshotVersion) || 0,
      snapshotHash: typeof audit.snapshotHash === 'string' ? audit.snapshotHash : '',
      snapshot: normalizeAuditSnapshot(audit),
      reviews: (Array.isArray(audit.reviews) ? audit.reviews : []).map(normalizeAuditReview),
    })),
  };
};

const queryCaseWikiGraphWorkspaces = async ({ userId = '', pageId = '', lifeDomainId = 'all', limit = 24 } = {}) => {
  if (process.env.CASE_MANAGEMENT_NEO4J_DISABLED === 'true') {
    return { status: 'skipped', message: 'CASE_MANAGEMENT_NEO4J_DISABLED is true', workspaces: [] };
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 24, 60));
  const config = neo4jConfig();
  const headers = { 'Content-Type': 'application/json' };
  if (config.username && config.password) {
    headers.Authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
  }

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        statements: [
          {
            statement: `
              MATCH (workspace:CaseManagementKnowledge)
              WHERE workspace.kind = 'GraphWorkspace'
                AND ($userId = '' OR workspace.userId = $userId)
                AND ($lifeDomainId = 'all' OR workspace.lifeDomainId = $lifeDomainId)
                AND ($pageId = '' OR workspace.pageId = $pageId)
              OPTIONAL MATCH (audit:CaseManagementKnowledge)-[auditRel:RELATED_TO]->(workspace)
              WHERE audit.kind = 'GraphWorkspaceAudit' AND auditRel.kind = 'SYNCED_WORKSPACE'
              OPTIONAL MATCH (audit)-[reviewRel:RELATED_TO]->(review:CaseManagementKnowledge)
              WHERE review.kind = 'GraphWorkspaceReview' AND reviewRel.kind = 'HAS_WORKSPACE_REVIEW'
              WITH workspace, audit, review
              ORDER BY review.reviewedAt DESC
              WITH workspace, audit, [entry IN collect({
                id: review.id,
                reviewId: review.reviewId,
                auditId: review.auditId,
                workspaceId: review.workspaceId,
                workspaceName: review.workspaceName,
                snapshotHash: review.snapshotHash,
                snapshotVersion: review.snapshotVersion,
                status: review.status,
                note: review.note,
                reviewer: review.reviewer,
                reviewedAt: review.reviewedAt,
                narrativeHeadline: review.narrativeHeadline
              }) WHERE entry.id IS NOT NULL][0..4] AS reviews
              ORDER BY audit.syncedAt DESC
              WITH workspace, [entry IN collect({
                id: audit.id,
                action: audit.action,
                workspaceId: audit.workspaceId,
                workspaceName: audit.workspaceName,
                actor: audit.actor,
                syncedAt: audit.syncedAt,
                graphFilter: audit.graphFilter,
                graphSearchQuery: audit.graphSearchQuery,
                relationshipStatusFilter: audit.relationshipStatusFilter,
                graphLayout: audit.graphLayout,
                graphScope: audit.graphScope,
                pinnedNodeCount: audit.pinnedNodeCount,
                graphNodeCount: audit.graphNodeCount,
                graphEdgeCount: audit.graphEdgeCount,
                graphHiddenEntityCount: audit.graphHiddenEntityCount,
                graphHiddenSourceCount: audit.graphHiddenSourceCount,
                graphSliceHash: audit.graphSliceHash,
                graphSliceJson: audit.graphSliceJson,
                visibility: audit.visibility,
                sharedCount: audit.sharedCount,
                snapshotVersion: audit.snapshotVersion,
                snapshotHash: audit.snapshotHash,
                snapshotJson: audit.snapshotJson,
                reviews: reviews
              }) WHERE entry.id IS NOT NULL][0..8] AS audits
              WITH workspace, audits
              ORDER BY coalesce(workspace.syncedAt, workspace.savedAt, '') DESC
              LIMIT $limit
              RETURN collect({
                workspace: {
                  id: workspace.id,
                  nodeId: workspace.id,
                  workspaceId: workspace.workspaceId,
                  name: workspace.name,
                  owner: workspace.owner,
                  visibility: workspace.visibility,
                  sharedWith: workspace.sharedWith,
                  accessRole: workspace.accessRole,
                  accessRolesJson: workspace.accessRolesJson,
                  duplicatedFromId: workspace.duplicatedFromId,
                  shareNote: workspace.shareNote,
                  pageId: workspace.pageId,
                  lifeDomainId: workspace.lifeDomainId,
                  graphFilter: workspace.graphFilter,
                  graphSearchQuery: workspace.graphSearchQuery,
                  relationshipStatusFilter: workspace.relationshipStatusFilter,
                  relationshipKindFilter: workspace.relationshipKindFilter,
                  relationshipEntityFilter: workspace.relationshipEntityFilter,
                  entityKindFilter: workspace.entityKindFilter,
                  graphZoom: workspace.graphZoom,
                  graphShowLabels: workspace.graphShowLabels,
                  graphLayout: workspace.graphLayout,
                  graphScope: workspace.graphScope,
                  pinnedPositionsJson: workspace.pinnedPositionsJson,
                  graphSliceJson: workspace.graphSliceJson,
                  savedAt: workspace.savedAt,
                  syncedAt: workspace.syncedAt,
                  userId: workspace.userId,
                  updatedAt: CASE WHEN workspace.updatedAt IS NULL THEN '' ELSE toString(workspace.updatedAt) END
                },
                audits: audits
              }) AS workspaces
            `,
            parameters: {
              userId: String(userId || ''),
              pageId: String(pageId || ''),
              lifeDomainId: String(lifeDomainId || 'all'),
              limit: safeLimit,
            },
          },
        ],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.errors?.length) {
      return {
        status: 'failed',
        message: payload.errors?.[0]?.message || `Neo4j returned ${response.status}`,
        workspaces: [],
      };
    }

    const records = payload.results?.[0]?.data?.[0]?.row?.[0] || [];
    const workspaces = records.map(normalizeNeo4jGraphWorkspaceRecord).filter((workspace) => workspace.id);
    return {
      status: workspaces.length ? 'ready' : 'empty',
      message: workspaces.length
        ? 'Neo4j graph workspaces loaded'
        : 'Neo4j has no graph workspaces for this filter yet',
      workspaces,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    return { status: 'failed', message: error.message, workspaces: [] };
  }
};

const buildCaseWikiGraphBrowser = async ({ ingestion, allIngestions = [] }) => {
  const persistedGraph = ingestionGraph(ingestion);
  const focusNodeIds = focusNodeIdsForIngestion(ingestion);
  const labels = graphLabelsForIngestion(ingestion);
  const neo4j = await queryNeo4jNeighbors({ focusNodeIds });
  const graph = neo4j.graph?.nodes?.length ? neo4j.graph : persistedGraph;
  const source = neo4j.graph?.nodes?.length ? 'neo4j' : 'persisted-source-graph';
  const summary = summarizeGraph(graph);
  return {
    status: graph.nodes.length ? 'ready' : 'empty',
    source,
    message:
      source === 'neo4j'
        ? neo4j.message
        : neo4j.status === 'failed'
          ? `Using saved source graph because Neo4j query failed: ${neo4j.message}`
          : 'Using saved source graph while Neo4j neighbor data warms up.',
    neo4j,
    focusNodeIds,
    ...labels,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    summary,
    graph,
    relatedSources: relatedSourcesForIngestion(ingestion, allIngestions),
    relationshipReviewSummary: relationshipReviewSummaryForIngestion(ingestion),
    relationshipReviewGraphDiff: relationshipReviewGraphDiffForIngestion(ingestion),
    generatedAt: new Date().toISOString(),
  };
};

module.exports = {
  buildCaseWikiEmbeddingReviewGraph,
  buildCaseWikiFollowUpTaskReconciliationReviewGraph,
  buildCaseWikiLocalArchiveSourceFamilyDecisionGraph,
  buildCaseWikiGraphProvenanceLensGraph,
  buildCaseWikiGraphWorkspaceReviewGraph,
  buildCaseWikiGraphWorkspaceGraph,
  buildCaseWikiGraphBrowser,
  focusNodeIdsForIngestion,
  ingestionGraph,
  normalizeGraph,
  queryCaseWikiGraphWorkspaces,
  queryNeo4jNeighbors,
  relatedSourcesForIngestion,
  relationshipReviewGraphDiffForIngestion,
  relationshipReviewSummaryForIngestion,
  searchCaseWikiGraph,
};

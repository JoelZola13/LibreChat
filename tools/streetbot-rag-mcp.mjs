#!/usr/bin/env node
import crypto from 'node:crypto';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const DEFAULT_WEAVIATE_URL =
  process.env.STREETBOT_DIRECTORY_WEAVIATE_URL ||
  process.env.APP_WEAVIATE_URL ||
  process.env.WEAVIATE_URL ||
  'http://weaviate:8080';
const WEAVIATE_URL = String(DEFAULT_WEAVIATE_URL).trim().replace(/\/+$/, '');
const COHERE_API_KEY = String(process.env.COHERE_API_KEY || '').trim();
const COHERE_BASE_URL = String(process.env.COHERE_BASE_URL || '').trim();
const CLASS_NAME = 'StreetBotService';
const CHUNK_CLASS_NAME = 'StreetBotServiceChunk';
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const MAX_FETCH_LIMIT = 200;
const DEFAULT_SESSION_ID = 'default';
const COLLECTION_SCHEMA_TTL_MS = 60_000;
const NAMED_VECTOR_PRIORITY = ['service_identity', 'service_content', 'service_access'];
const CHUNK_NAMED_VECTOR_PRIORITY = ['chunk_content', 'chunk_identity', 'chunk_access'];
const SEARCH_CORE_FIELDS =
  'serviceId name slug city province postalCode serviceType overview description address website phone email imageUrl locationLabel geoCoordinates{latitude longitude} tags tagsText categoryNames categoryNamesText agesServed genderServed serviceIdentityText serviceContentText serviceAccessText isActive isVerified rating ratingCount';
const DETAIL_FIELDS =
  'serviceId name slug city province postalCode serviceType overview description detailText address website phone email imageUrl locationLabel geoCoordinates{latitude longitude} tags tagsText categoryNames categoryNamesText agesServed genderServed serviceIdentityText serviceContentText serviceAccessText isActive isVerified sourceIndex rating ratingCount _additional{id score explainScore distance}';
const CHUNK_CORE_FIELDS =
  'chunkId serviceId name slug chunkIndex chunkKind chunkText chunkPreview serviceType city province postalCode address locationLabel tagsText categoryNamesText agesServed genderServed chunkIdentityText chunkAccessText isActive isVerified sourceIndex';
const SEARCH_INSTRUCTION =
  'CRITICAL RULE — The UI renders the service cards. Reply with one short warm companion sentence that frames the cards without copying them, then a fenced code block labeled streetbot-service-results containing only valid JSON from the final search payload. Do not list service details outside that code block. Avoid boilerplate like "I checked the service directory" or "not a guess" unless the user is directly challenging accuracy.';
const paginationState = new Map();
const collectionSchemaCache = new Map();
const collectionSchemaCachedAt = new Map();
const MAX_CHUNK_RESULTS = 48;
const MAX_CHUNK_DOCUMENTS = 8;
const CHUNK_SNIPPET_CHARS = 180;
const NUMBER_WORDS = new Map([
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
  ['ten', 10],
  ['eleven', 11],
  ['twelve', 12],
]);
const PROVINCE_ALIASES = new Map([
  ['on', 'Ontario'],
  ['ontario', 'Ontario'],
  ['qc', 'Quebec'],
  ['quebec', 'Quebec'],
  ['bc', 'British Columbia'],
  ['british columbia', 'British Columbia'],
  ['ab', 'Alberta'],
  ['alberta', 'Alberta'],
  ['mb', 'Manitoba'],
  ['manitoba', 'Manitoba'],
  ['sk', 'Saskatchewan'],
  ['saskatchewan', 'Saskatchewan'],
  ['ns', 'Nova Scotia'],
  ['nova scotia', 'Nova Scotia'],
  ['nb', 'New Brunswick'],
  ['new brunswick', 'New Brunswick'],
  ['nl', 'Newfoundland and Labrador'],
  ['newfoundland', 'Newfoundland and Labrador'],
  ['newfoundland and labrador', 'Newfoundland and Labrador'],
  ['pe', 'Prince Edward Island'],
  ['pei', 'Prince Edward Island'],
  ['prince edward island', 'Prince Edward Island'],
]);
const LOCALITY_PROVINCES = new Map([
  ['toronto', 'Ontario'],
  ['scarborough', 'Ontario'],
  ['etobicoke', 'Ontario'],
  ['north york', 'Ontario'],
  ['york', 'Ontario'],
  ['east york', 'Ontario'],
  ['mississauga', 'Ontario'],
  ['brampton', 'Ontario'],
  ['hamilton', 'Ontario'],
  ['ottawa', 'Ontario'],
  ['london', 'Ontario'],
  ['windsor', 'Ontario'],
  ['barrie', 'Ontario'],
  ['guelph', 'Ontario'],
  ['oshawa', 'Ontario'],
  ['kingston', 'Ontario'],
  ['sudbury', 'Ontario'],
  ['thunder bay', 'Ontario'],
  ['markham', 'Ontario'],
  ['vaughan', 'Ontario'],
  ['richmond hill', 'Ontario'],
  ['oakville', 'Ontario'],
  ['burlington', 'Ontario'],
  ['ajax', 'Ontario'],
  ['pickering', 'Ontario'],
  ['newmarket', 'Ontario'],
  ['waterloo', 'Ontario'],
  ['kitchener', 'Ontario'],
  ['cambridge', 'Ontario'],
]);
const QUERY_STOP_WORDS = new Set([
  'a',
  'an',
  'about',
  'and',
  'do',
  'does',
  'find',
  'for',
  'i',
  'im',
  "i'm",
  'in',
  'help',
  'me',
  'my',
  'need',
  'needs',
  'of',
  'option',
  'options',
  'please',
  'program',
  'programs',
  'look',
  'looking',
  'kind',
  'kinds',
  'know',
  'recall',
  'remember',
  'resource',
  'resources',
  'result',
  'results',
  'search',
  'searched',
  'searches',
  'searching',
  'service',
  'services',
  'some',
  'support',
  'supports',
  'the',
  'to',
  'just',
  'what',
  'with',
  'want',
  'wants',
  'which',
  'you',
  'your',
]);
const URGENT_SERVICE_TRIGGERS = [
  'tonight',
  'right now',
  'now',
  'urgent',
  'asap',
  'immediately',
  'emergency',
  'safe tonight',
];
const EMOTIONAL_CONTEXT_TRIGGERS = [
  'overwhelmed',
  'panic',
  'panicking',
  'anxious',
  'scared',
  'unsafe',
  'really hard day',
];
const LOW_SIGNAL_META_QUERY_TERMS = new Set([
  'about',
  'ask',
  'asked',
  'asking',
  'did',
  'do',
  'does',
  'far',
  'have',
  'history',
  'kind',
  'kinds',
  'know',
  'normally',
  'previous',
  'recall',
  'remember',
  'search',
  'searched',
  'searches',
  'searching',
  'so',
  'tell',
  'tend',
  'usually',
  'what',
  'which',
  'you',
  'your',
]);
const CHUNK_HYDRATE_TOP_RESULTS = 5;
const CHUNK_HYDRATE_SCAN_RESULTS = 20;
const CHUNK_HYDRATE_DOCUMENT_LIMIT = 2;
const INTENT_PRECISION_STOP_WORDS = new Set([
  'all',
  'assistance',
  'basic',
  'care',
  'center',
  'centre',
  'community',
  'crisis',
  'emergency',
  'family',
  'help',
  'needs',
  'program',
  'programs',
  'service',
  'services',
  'support',
  'supports',
]);
const SERVICE_INTENT_PRIORS = [
  {
    family: 'Health',
    triggers: [
      'doctor',
      'doctors',
      'medical',
      'clinic',
      'healthcare',
      'health care',
      'physician',
      'pharmacy',
      'medication',
    ],
    categories: ['Health'],
    serviceTypes: ['Health Centre', 'Community Health Centre', 'Medical Clinic'],
    tags: ['health', 'medical', 'clinic', 'doctor'],
  },
  {
    family: 'Mental Health',
    triggers: [
      'mental health',
      'therapy',
      'therapist',
      'counselling',
      'counseling',
      'anxiety',
      'depression',
      'depressed',
      'overwhelmed',
    ],
    categories: ['Mental Health', 'Counselling'],
    serviceTypes: ['Counselling', 'Mental Health'],
    tags: ['mental health', 'therapy', 'counselling'],
  },
  {
    family: 'Housing',
    triggers: ['housing', 'rent', 'rental', 'apartment', 'room'],
    categories: ['Housing'],
    serviceTypes: ['Housing', 'Housing Help'],
    tags: ['housing', 'rent'],
  },
  {
    family: 'Shelter',
    triggers: ['shelter', 'homeless', 'safe place', 'emergency housing'],
    categories: ['Shelter', 'Housing'],
    serviceTypes: ['Shelter', 'Emergency Shelter'],
    tags: ['shelter', 'emergency shelter', 'homeless'],
  },
  {
    family: 'Food',
    triggers: ['food', 'hungry', 'meal', 'meals', 'grocery', 'groceries', 'food bank'],
    categories: ['Food'],
    serviceTypes: ['Food Bank', 'Meal Program'],
    tags: ['food', 'food bank', 'meal', 'grocery'],
  },
  {
    family: 'Legal',
    triggers: ['legal', 'lawyer', 'eviction', 'tenant', 'landlord', 'court', 'rights'],
    categories: ['Legal'],
    serviceTypes: ['Legal', 'Legal Clinic'],
    tags: ['legal', 'eviction', 'tenant', 'landlord'],
  },
  {
    family: 'Employment',
    triggers: ['job', 'jobs', 'work', 'employment', 'resume', 'career'],
    categories: ['Employment'],
    serviceTypes: ['Employment', 'Employment Support'],
    tags: ['employment', 'job', 'resume'],
  },
  {
    family: 'Benefits',
    triggers: [
      'benefit',
      'benefits',
      'odsp',
      'ontario works',
      'ow',
      'income help',
      'income assistance',
      'income support',
      'ei',
      'welfare',
    ],
    categories: ['Benefits', 'Disability'],
    serviceTypes: ['Benefits', 'Income Support'],
    tags: ['benefits', 'income support', 'odsp', 'ontario works'],
  },
  {
    family: 'Disability',
    triggers: ['disability', 'disabled', 'vision', 'blind', 'hearing', 'wheelchair'],
    categories: ['Disability'],
    serviceTypes: ['Disability', 'Accessibility'],
    tags: ['disability', 'accessible', 'vision', 'hearing'],
  },
  {
    family: 'Newcomer',
    triggers: ['newcomer', 'immigrant', 'refugee', 'settlement'],
    categories: ['Newcomer'],
    serviceTypes: ['Settlement', 'Newcomer'],
    tags: ['newcomer', 'settlement', 'refugee', 'immigrant'],
  },
];
const KNOWN_CITIES = [
  'toronto',
  'scarborough',
  'east york',
  'etobicoke',
  'north york',
  'york',
  'mississauga',
  'brampton',
  'hamilton',
  'ottawa',
  'london',
  'windsor',
  'barrie',
  'guelph',
  'oshawa',
  'kingston',
  'sudbury',
  'thunder bay',
  'markham',
  'vaughan',
  'richmond hill',
  'oakville',
  'burlington',
  'ajax',
  'pickering',
  'newmarket',
  'waterloo',
  'kitchener',
  'cambridge',
];
const PROVINCES = [
  'ontario',
  'quebec',
  'british columbia',
  'alberta',
  'manitoba',
  'saskatchewan',
  'nova scotia',
  'new brunswick',
  'newfoundland',
  'pei',
  'prince edward island',
];
const LOCALITY_GROUPS = [
  ['toronto', 'north york', 'scarborough', 'etobicoke', 'york', 'east york'],
  ['mississauga', 'brampton', 'oakville', 'burlington', 'milton'],
  ['markham', 'vaughan', 'richmond hill', 'newmarket', 'aurora'],
  ['ajax', 'pickering', 'oshawa', 'whitby'],
  ['kitchener', 'waterloo', 'cambridge'],
];
const WIDER_REGION_GROUPS = [
  [
    'toronto',
    'north york',
    'scarborough',
    'etobicoke',
    'york',
    'east york',
    'mississauga',
    'brampton',
    'vaughan',
    'markham',
    'richmond hill',
    'newmarket',
    'aurora',
    'ajax',
    'pickering',
    'oshawa',
    'whitby',
    'oakville',
    'burlington',
    'milton',
  ],
  ['kitchener', 'waterloo', 'cambridge'],
];
const CATEGORY_KEYWORDS = [
  ['legal', 'Legal'],
  ['eviction', 'Legal'],
  ['tenant', 'Legal'],
  ['landlord', 'Legal'],
  ['housing', 'Housing'],
  ['shelter', 'Shelter'],
  ['food', 'Food'],
  ['meal', 'Food'],
  ['meals', 'Food'],
  ['hungry', 'Food'],
  ['hunger', 'Food'],
  ['grocery', 'Food'],
  ['groceries', 'Food'],
  ['food bank', 'Food'],
  ['bank', 'Food'],
  ['doctor', 'Health'],
  ['doctors', 'Health'],
  ['medical', 'Health'],
  ['healthcare', 'Health'],
  ['dentist', 'Health'],
  ['dental', 'Health'],
  ['pharmacy', 'Health'],
  ['medication', 'Health'],
  ['mental health', 'Mental Health'],
  ['counselling', 'Counselling'],
  ['counseling', 'Counselling'],
  ['employment', 'Employment'],
  ['job', 'Employment'],
  ['benefit', 'Benefits'],
  ['benefits', 'Benefits'],
  ['youth', 'Youth'],
  ['senior', 'Seniors'],
  ['seniors', 'Seniors'],
  ['addiction', 'Addictions'],
  ['disability', 'Disability'],
  ['newcomer', 'Newcomer'],
];
const SEARCH_QUERY_PROPERTIES = [
  'name^8',
  'nameSearch^10',
  'serviceIdentityText^6',
  'serviceType^5',
  'categoryNamesText^4',
  'tagsText^4',
  'serviceAccessText^4',
  'city^3',
  'province^2',
  'locationLabel^3',
  'overview^2',
  'description^2',
  'serviceContentText^2',
  'detailText^2',
  'address',
  'agesServed',
  'genderServed',
];
const CHUNK_QUERY_PROPERTIES = [
  'chunkText^9',
  'chunkPreview^6',
  'name^6',
  'chunkIdentityText^5',
  'serviceType^5',
  'categoryNamesText^4',
  'tagsText^4',
  'chunkAccessText^4',
  'locationLabel^3',
  'city^3',
  'province^2',
  'address',
  'agesServed',
  'genderServed',
];

function rerankAdditionalField(property, query) {
  const normalizedProperty = text(property);
  const normalizedQuery = text(query);
  if (!COHERE_API_KEY || !normalizedProperty || !normalizedQuery) {
    return '';
  }
  return ` rerank(property:${JSON.stringify(normalizedProperty)},query:${JSON.stringify(normalizedQuery)}){score}`;
}

function buildSearchFields(rerankQuery = '') {
  return `${SEARCH_CORE_FIELDS} _additional{id score explainScore distance${rerankAdditionalField('serviceContentText', rerankQuery)}}`;
}

function buildChunkFields(rerankQuery = '') {
  return `${CHUNK_CORE_FIELDS} _additional{id score explainScore distance${rerankAdditionalField('chunkText', rerankQuery)}}`;
}

const TOOL_DEFINITIONS = [
  {
    name: 'services_search',
    description:
      'Searches the Street Bot service directory in Weaviate and returns full service-card payloads. Supports limits, city/province, service type, categories, tags, and light personalization via user_context.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language service search query.' },
        session_id: { type: 'string', description: 'Optional pagination session id.' },
        limit: { type: 'number', description: 'Result count to return (default 5, max 20).' },
        offset: { type: 'number', description: 'Optional offset for direct paging.' },
        city: { type: 'string', description: 'Optional city filter.' },
        province: { type: 'string', description: 'Optional province filter.' },
        latitude: {
          type: 'number',
          description: 'Optional preferred latitude for nearby ranking.',
        },
        longitude: {
          type: 'number',
          description: 'Optional preferred longitude for nearby ranking.',
        },
        category: { type: 'string', description: 'Optional single category filter.' },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional category filters.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tag filters.',
        },
        service_type: { type: 'string', description: 'Optional service type filter.' },
        ages_served: { type: 'string', description: 'Optional age-group filter.' },
        gender_served: { type: 'string', description: 'Optional gender filter.' },
        mode: {
          type: 'string',
          description: 'Retrieval mode: auto, hybrid, keyword, or semantic.',
          enum: ['auto', 'hybrid', 'keyword', 'semantic'],
        },
        active_only: { type: 'boolean', description: 'Exclude inactive services (default true).' },
        user_context: {
          type: 'object',
          description: 'Optional light personalization hints from memory.',
          properties: {
            preferred_city: { type: 'string' },
            preferred_province: { type: 'string' },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            needs: { type: 'array', items: { type: 'string' } },
            ages: { type: 'string' },
            gender: { type: 'string' },
            languages: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'services_more',
    description: 'Returns the next page from the last Street Bot service search session.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'Pagination session id from a prior services_search call.',
        },
      },
    },
  },
  {
    name: 'services_documents',
    description:
      'Returns the full record for a specific service by service id, object id, slug, or name, plus grounded document chunks when available.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: 'Service reference: service id, object id, slug, or name.',
        },
        query: {
          type: 'string',
          description: 'Optional detail question used to rank the most relevant service chunks.',
        },
        limit: {
          type: 'number',
          description: 'Optional maximum document chunks to return (default 5, max 8).',
        },
        active_only: { type: 'boolean', description: 'Exclude inactive services (default true).' },
      },
      required: ['ref'],
    },
  },
  {
    name: 'services_categories',
    description:
      'Returns browse facets for cities, service types, categories, and tags from the Street Bot service corpus.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum values to return per facet (default 10, max 50).',
        },
        active_only: { type: 'boolean', description: 'Exclude inactive services (default true).' },
      },
    },
  },
];

function text(value) {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function isPlaceholderValue(value) {
  const normalized = text(value).toLowerCase();
  return (
    !normalized ||
    normalized === 'n/a' ||
    normalized === 'na' ||
    normalized === 'none' ||
    normalized === 'null' ||
    normalized === 'undefined' ||
    normalized === 'not available' ||
    normalized === 'unknown'
  );
}

function cleanTextValue(value) {
  return isPlaceholderValue(value) ? '' : text(value);
}

function truncateText(value, limit) {
  const current = cleanTextValue(value);
  if (!current || current.length <= limit) {
    return current;
  }
  return `${current.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function toList(value) {
  if (value == null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => text(item)).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeText(value) {
  return cleanTextValue(value).toLowerCase();
}

function normalizeLabelKey(value) {
  return (normalizeText(value).match(/[a-z0-9]+/g) || []).join(' ');
}

function structuredLabelOverlapCount(expectedLabels = [], actualLabels = []) {
  const normalizedExpected = (expectedLabels || [])
    .map((value) => normalizeLabelKey(value))
    .filter(Boolean);
  const normalizedActual = (actualLabels || [])
    .map((value) => normalizeLabelKey(value))
    .filter(Boolean);
  if (!normalizedExpected.length || !normalizedActual.length) {
    return 0;
  }
  let hits = 0;
  for (const expected of normalizedExpected) {
    if (
      normalizedActual.some(
        (actual) => expected === actual || expected.includes(actual) || actual.includes(expected),
      )
    ) {
      hits += 1;
    }
  }
  return hits;
}

function normalizeProvinceLabel(value) {
  const normalized = normalizeText(value).replace(/[^a-z]/g, '');
  if (!normalized) {
    return '';
  }
  for (const [alias, label] of PROVINCE_ALIASES.entries()) {
    if (normalized === alias.replace(/[^a-z]/g, '')) {
      return label;
    }
  }
  return text(value);
}

function inferProvinceFromAddress(address) {
  const rawAddress = text(address);
  if (!rawAddress) {
    return '';
  }
  const normalized = normalizeText(rawAddress);
  for (const [alias, label] of PROVINCE_ALIASES.entries()) {
    const pattern =
      alias.length <= 2
        ? new RegExp(`(^|[^a-z])${alias}([^a-z]|$)`, 'i')
        : new RegExp(`(^|[^a-z])${alias.replace(/\s+/g, '\\s+')}([^a-z]|$)`, 'i');
    if (pattern.test(normalized)) {
      return label;
    }
  }
  return '';
}

function inferProvinceFromCity(city) {
  return LOCALITY_PROVINCES.get(normalizeText(city)) || '';
}

function normalizeServiceLocation(rawCity, rawProvince, rawAddress) {
  const city = text(rawCity);
  const explicitProvince = normalizeProvinceLabel(rawProvince);
  const inferredProvince =
    explicitProvince || inferProvinceFromAddress(rawAddress) || inferProvinceFromCity(city);
  return {
    city,
    province: inferredProvince,
    location_label: [city, inferredProvince].filter(Boolean).join(', '),
  };
}

function normalizeGeoCoordinates(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const latitude = finiteNumber(value.latitude ?? value.lat);
  const longitude = finiteNumber(value.longitude ?? value.lng ?? value.lon);
  if (latitude == null || longitude == null) {
    return null;
  }
  return { latitude, longitude };
}

function queryTerms(value) {
  return Array.from(
    new Set(
      (normalizeText(value).match(/[a-z0-9]{2,}/g) || []).filter(
        (term) => !QUERY_STOP_WORDS.has(term),
      ),
    ),
  );
}

function rawQueryTerms(value) {
  return Array.from(new Set(normalizeText(value).match(/[a-z0-9]{2,}/g) || []));
}

function phraseQuery(value) {
  return (normalizeText(value).match(/[a-z0-9]{2,}/g) || []).join(' ');
}

function serviceIntentProfile(query) {
  const normalizedQuery = ` ${phraseQuery(query)} `;
  const baseTerms = new Set(queryTerms(query));
  const matchedPriors = [];

  for (const [index, prior] of SERVICE_INTENT_PRIORS.entries()) {
    const positions = prior.triggers
      .map((trigger) => {
        const normalizedTrigger = phraseQuery(trigger);
        if (!normalizedTrigger) {
          return -1;
        }
        return normalizedQuery.indexOf(` ${normalizedTrigger} `);
      })
      .filter((value) => value >= 0);
    if (!positions.length) {
      continue;
    }
    matchedPriors.push({
      prior,
      index,
      firstMatch: Math.min(...positions),
    });
  }

  matchedPriors.sort(
    (left, right) => left.firstMatch - right.firstMatch || left.index - right.index,
  );

  const families = [];
  const categories = [];
  const serviceTypes = [];
  const tags = [];
  const expansionTerms = [];

  for (const { prior } of matchedPriors) {
    families.push(prior.family);
    categories.push(...prior.categories);
    serviceTypes.push(...prior.serviceTypes);
    tags.push(...prior.tags);
    for (const value of [...prior.categories, ...prior.tags]) {
      for (const term of queryTerms(value)) {
        if (!baseTerms.has(term)) {
          expansionTerms.push(term);
        }
      }
    }
  }

  return {
    priors: matchedPriors.map((entry) => entry.prior),
    families: uniqueStrings(families),
    categories: uniqueStrings(categories),
    serviceTypes: uniqueStrings(serviceTypes),
    tags: uniqueStrings(tags),
    queryTerms: uniqueStrings(expansionTerms),
  };
}

function queryHasTrigger(query, triggers = []) {
  const normalizedQuery = ` ${phraseQuery(query)} `;
  return (triggers || []).some((trigger) => {
    const normalizedTrigger = phraseQuery(trigger);
    return normalizedTrigger && normalizedQuery.includes(` ${normalizedTrigger} `);
  });
}

function structuredFilterCount(args = {}) {
  let count = 0;
  for (const value of [
    args.city,
    args.province,
    args.service_type,
    args.ages_served,
    args.gender_served,
  ]) {
    if (text(value)) {
      count += 1;
    }
  }
  count += (args.tags || []).filter((value) => text(value)).length;
  count += (args.categories || []).filter((value) => text(value)).length;
  if (finiteNumber(args.latitude) != null && finiteNumber(args.longitude) != null) {
    count += 1;
  }
  return count;
}

function weightedQueryProperties(baseProperties = [], boosts = {}) {
  const weighted = (baseProperties || []).map((rawProperty, index) => {
    const [name, weightText] = String(rawProperty).split('^');
    const parsedWeight = Number(weightText);
    return {
      name,
      weight: Number.isFinite(parsedWeight) ? parsedWeight : 1,
      index,
    };
  });

  for (const [boostName, boostValue] of Object.entries(boosts || {})) {
    const currentName = text(boostName);
    const numericBoost = Number(boostValue);
    if (!currentName || !Number.isFinite(numericBoost) || numericBoost === 0) {
      continue;
    }
    const existing = weighted.find((item) => item.name === currentName);
    if (existing) {
      existing.weight += numericBoost;
    } else {
      weighted.push({ name: currentName, weight: numericBoost, index: weighted.length });
    }
  }

  return weighted
    .sort((left, right) => right.weight - left.weight || left.index - right.index)
    .map((item) => {
      if (Math.abs(item.weight - 1) < 0.001) {
        return item.name;
      }
      const rounded = Math.round(item.weight);
      const weightText =
        Math.abs(item.weight - rounded) < 0.001
          ? String(rounded)
          : item.weight.toFixed(1).replace(/\.0$/, '');
      return `${item.name}^${weightText}`;
    });
}

function buildRetrievalPlan(args = {}) {
  const intent = serviceIntentProfile(args.query);
  const families = [...(intent.families || [])];
  const familyCount = families.length;
  const multiNeed = familyCount >= 2;
  const keywordStyle = looksKeywordStyleQuery(args.query);
  const urgent = queryHasTrigger(args.query, URGENT_SERVICE_TRIGGERS);
  const emotionalContext = queryHasTrigger(args.query, EMOTIONAL_CONTEXT_TRIGGERS);
  const filterCount = structuredFilterCount(args);
  const structured = filterCount > 0;
  const locationAware = Boolean(
    text(args.city) ||
      text(args.province) ||
      finiteNumber(args.latitude) != null ||
      finiteNumber(args.longitude) != null,
  );
  const preciseFamily = families.some((family) =>
    ['Benefits', 'Legal', 'Employment', 'Disability', 'Newcomer'].includes(family),
  );

  const servicePropertyBoosts = {};
  const chunkPropertyBoosts = {};
  if (multiNeed) {
    Object.assign(servicePropertyBoosts, {
      serviceAccessText: 2,
      categoryNamesText: 2,
      tagsText: 1,
      serviceType: 1,
    });
    Object.assign(chunkPropertyBoosts, {
      chunkAccessText: 2,
      categoryNamesText: 2,
      tagsText: 1,
      serviceType: 1,
    });
  }
  if (urgent) {
    servicePropertyBoosts.serviceAccessText = (servicePropertyBoosts.serviceAccessText || 0) + 2;
    servicePropertyBoosts.locationLabel = (servicePropertyBoosts.locationLabel || 0) + 1;
    servicePropertyBoosts.city = (servicePropertyBoosts.city || 0) + 1;
    chunkPropertyBoosts.chunkAccessText = (chunkPropertyBoosts.chunkAccessText || 0) + 2;
    chunkPropertyBoosts.locationLabel = (chunkPropertyBoosts.locationLabel || 0) + 1;
    chunkPropertyBoosts.city = (chunkPropertyBoosts.city || 0) + 1;
  }
  if (keywordStyle || preciseFamily) {
    servicePropertyBoosts.serviceIdentityText =
      (servicePropertyBoosts.serviceIdentityText || 0) + 1.5;
    servicePropertyBoosts.serviceType = (servicePropertyBoosts.serviceType || 0) + 1;
    servicePropertyBoosts.nameSearch = (servicePropertyBoosts.nameSearch || 0) + 1;
    chunkPropertyBoosts.chunkIdentityText = (chunkPropertyBoosts.chunkIdentityText || 0) + 1.5;
    chunkPropertyBoosts.serviceType = (chunkPropertyBoosts.serviceType || 0) + 1;
    chunkPropertyBoosts.name = (chunkPropertyBoosts.name || 0) + 1;
  }
  if (emotionalContext && !multiNeed) {
    servicePropertyBoosts.serviceContentText = (servicePropertyBoosts.serviceContentText || 0) + 1;
    chunkPropertyBoosts.chunkText = (chunkPropertyBoosts.chunkText || 0) + 1;
  }

  let serviceTargetVectors;
  let chunkTargetVectors;
  if (multiNeed || urgent) {
    serviceTargetVectors = uniqueStrings(['service_access', 'service_content', 'service_identity']);
    chunkTargetVectors = uniqueStrings(['chunk_access', 'chunk_content', 'chunk_identity']);
  } else if (keywordStyle || preciseFamily) {
    serviceTargetVectors = uniqueStrings([
      'service_identity',
      locationAware || structured ? 'service_access' : '',
      'service_content',
    ]);
    chunkTargetVectors = uniqueStrings([
      'chunk_identity',
      locationAware || structured ? 'chunk_access' : '',
      'chunk_content',
    ]);
  } else {
    serviceTargetVectors = uniqueStrings([
      'service_content',
      'service_identity',
      locationAware || structured ? 'service_access' : '',
    ]);
    chunkTargetVectors = uniqueStrings([
      'chunk_content',
      'chunk_identity',
      locationAware || structured ? 'chunk_access' : '',
    ]);
  }

  let hybridAlpha = 0.55;
  if (keywordStyle) {
    hybridAlpha = 0.35;
  } else if (multiNeed) {
    hybridAlpha = 0.48;
  } else if (urgent) {
    hybridAlpha = 0.46;
  }

  const expansionTerms = uniqueStrings([
    ...(intent.queryTerms || []).slice(0, 6),
    ...(args.tags || []).map((value) => text(value)).filter(Boolean),
    ...(args.categories || []).map((value) => text(value)).filter(Boolean),
    text(args.ages_served),
    text(args.gender_served),
    ...(args.needs || []).map((value) => text(value)).filter(Boolean),
    ...(args.languages || []).map((value) => text(value)).filter(Boolean),
  ]);
  const expandedQuery = uniqueStrings([args.query, ...expansionTerms.slice(0, 8)])
    .join(' ')
    .trim();
  const familyQuota = multiNeed
    ? Math.max(1, Math.min(Number(args.limit || DEFAULT_LIMIT), MAX_LIMIT))
    : Math.max(1, Math.min(Number(args.limit || DEFAULT_LIMIT), MAX_LIMIT));
  const pageLimitTotal = multiNeed
    ? Math.max(1, Math.min(MAX_LIMIT, familyQuota * Math.max(1, familyCount)))
    : familyQuota;
  const coverageGoal = multiNeed ? pageLimitTotal : 1;

  return {
    families,
    family_count: familyCount,
    family_quota: familyQuota,
    page_limit_total: pageLimitTotal,
    multi_need: multiNeed,
    urgent,
    emotional_context: emotionalContext,
    keyword_style: keywordStyle,
    structured_filter_count: filterCount,
    query_terms: expansionTerms,
    expanded_query: expandedQuery || text(args.query),
    service_target_vectors: serviceTargetVectors,
    chunk_target_vectors: chunkTargetVectors,
    service_query_properties: weightedQueryProperties(
      SEARCH_QUERY_PROPERTIES,
      servicePropertyBoosts,
    ),
    chunk_query_properties: weightedQueryProperties(CHUNK_QUERY_PROPERTIES, chunkPropertyBoosts),
    hybrid_alpha: hybridAlpha,
    fetch_multiplier: multiNeed ? 12 : 10,
    chunk_fetch_multiplier: multiNeed || urgent ? 10 : 8,
    coverage_goal: coverageGoal,
    diversify_families: multiNeed,
    intent,
  };
}

function publicRetrievalPlan(plan = {}) {
  return {
    families: [...(plan.families || [])],
    family_count: Number(plan.family_count || 0),
    family_quota: Number(plan.family_quota || 0),
    page_limit_total: Number(plan.page_limit_total || 0),
    multi_need: Boolean(plan.multi_need),
    urgent: Boolean(plan.urgent),
    emotional_context: Boolean(plan.emotional_context),
    keyword_style: Boolean(plan.keyword_style),
    structured_filter_count: Number(plan.structured_filter_count || 0),
    query_terms: [...(plan.query_terms || [])],
    expanded_query: text(plan.expanded_query),
    service_target_vectors: [...(plan.service_target_vectors || [])],
    chunk_target_vectors: [...(plan.chunk_target_vectors || [])],
    service_query_properties: [...(plan.service_query_properties || [])],
    chunk_query_properties: [...(plan.chunk_query_properties || [])],
    hybrid_alpha: Number(plan.hybrid_alpha || 0),
    fetch_multiplier: Number(plan.fetch_multiplier || 0),
    chunk_fetch_multiplier: Number(plan.chunk_fetch_multiplier || 0),
    coverage_goal: Number(plan.coverage_goal || 0),
  };
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function finiteNumber(value) {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function titleCase(value) {
  return text(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function stripSearchScaffolding(userText) {
  let value = text(userText);
  if (!value) {
    return '';
  }

  value = value
    .replace(/^\s*(i am|i'm|im)\s+/i, '')
    .replace(
      /^\s*(i need|i'm looking for|im looking for|looking for|can you find|could you find|find me|show me|give me|list|show|give|return|recommend)\s+/i,
      '',
    )
    .replace(/^\s*(need|want)\s+/i, '')
    .replace(/^\s*(what about|how about)\s+/i, '')
    .replace(/^\s*(a|an|the|some)\s+/i, '')
    .replace(/\bplease\b/gi, ' ')
    .replace(
      /\b(show|give|list|return)\s+\d{1,2}\s+(?:results?|services?|options?|matches?|cards?)\b/gi,
      ' ',
    )
    .replace(
      /\b(show|give|list|return)\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:results?|services?|options?|matches?|cards?)\b/gi,
      ' ',
    )
    .replace(/\b\d{1,2}\s+more\b/gi, ' ')
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+more\b/gi, ' ')
    .replace(/\b(?:results?|services?|options?|matches?|cards?)\b/gi, ' ')
    .replace(/[!?.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const city of KNOWN_CITIES) {
    value = value.replace(new RegExp(`\\bin\\s+${city}\\b`, 'ig'), ' ');
    value = value.replace(new RegExp(`\\b${city}\\b`, 'ig'), ' ');
  }
  for (const province of PROVINCES) {
    value = value.replace(new RegExp(`\\bin\\s+${province}\\b`, 'ig'), ' ');
    value = value.replace(new RegExp(`\\b${province}\\b`, 'ig'), ' ');
  }

  return value.replace(/\s+/g, ' ').trim();
}

function detectRequestedLimit(userText, fallback = DEFAULT_LIMIT) {
  const normalized = normalizeText(userText);
  if (!normalized) {
    return fallback;
  }

  const exactMoreMatch = normalized.match(
    /\b(?:show|give|list|find|return|need|want|top)?\s*(\d{1,2})\s+more\b/,
  );
  if (exactMoreMatch) {
    return clampNumber(exactMoreMatch[1], fallback, 1, MAX_LIMIT);
  }

  const exactMatch = normalized.match(
    /\b(?:show|give|list|find|return|need|want|top)?\s*(\d{1,2})\s+(?:results?|services?|options?|matches?|cards?)\b/,
  );
  if (exactMatch) {
    return clampNumber(exactMatch[1], fallback, 1, MAX_LIMIT);
  }

  const wordMoreMatch = normalized.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+more\b/,
  );
  if (wordMoreMatch) {
    return clampNumber(NUMBER_WORDS.get(wordMoreMatch[1]) ?? fallback, fallback, 1, MAX_LIMIT);
  }

  const wordMatch = normalized.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:results?|services?|options?|matches?|cards?)\b/,
  );
  if (wordMatch) {
    return clampNumber(NUMBER_WORDS.get(wordMatch[1]) ?? fallback, fallback, 1, MAX_LIMIT);
  }

  return fallback;
}

function inferCity(userText) {
  const normalized = normalizeText(userText);
  for (const city of KNOWN_CITIES) {
    if (normalized.includes(city)) {
      return titleCase(city);
    }
  }
  return '';
}

function inferProvince(userText) {
  const normalized = normalizeText(userText);
  for (const province of PROVINCES) {
    if (normalized.includes(province)) {
      return titleCase(province);
    }
  }
  return '';
}

function inferCategories(userText) {
  const normalized = normalizeText(userText);
  const categories = [];
  for (const [keyword, category] of CATEGORY_KEYWORDS) {
    if (normalized.includes(keyword)) {
      categories.push(category);
    }
  }
  return uniqueStrings(categories);
}

function buildSearchArgsFromUserText(userText, overrides = {}) {
  const rawQuery = text(overrides.query || userText);
  const strippedQuery = text(stripSearchScaffolding(rawQuery) || rawQuery);
  const userContext =
    overrides.user_context && typeof overrides.user_context === 'object'
      ? overrides.user_context
      : {};
  const latitude = finiteNumber(
    overrides.latitude ?? userContext.latitude ?? userContext.preferred_latitude,
  );
  const longitude = finiteNumber(
    overrides.longitude ?? userContext.longitude ?? userContext.preferred_longitude,
  );
  const query = hasMeaningfulServiceQuery(strippedQuery) ? strippedQuery : '';
  return {
    query,
    session_id: text(overrides.session_id),
    limit: clampNumber(
      overrides.limit,
      detectRequestedLimit(rawQuery, DEFAULT_LIMIT),
      1,
      MAX_LIMIT,
    ),
    offset: clampNumber(overrides.offset, 0, 0, 10_000),
    city: text(overrides.city || inferCity(rawQuery)),
    province: text(overrides.province || userContext.preferred_province || inferProvince(rawQuery)),
    service_type: text(overrides.service_type),
    latitude,
    longitude,
    categories: uniqueStrings([
      ...toList(overrides.category),
      ...toList(overrides.categories),
      ...inferCategories(rawQuery),
    ]),
    tags: uniqueStrings(toList(overrides.tags)),
    ages_served: text(overrides.ages_served),
    gender_served: text(overrides.gender_served),
    active_only: boolValue(overrides.active_only, true),
    user_context: userContext,
  };
}

function boolValue(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function buildCorpus(item) {
  return [
    item.name,
    item.location_label,
    item.overview,
    item.description,
    item.detail_text,
    item.service_identity_text,
    item.service_content_text,
    item.service_access_text,
    item.service_type,
    item.city,
    item.province,
    item.address,
    item.category_names_text,
    item.tags_text,
    item.ages_served,
    item.gender_served,
    item.chunk_evidence_preview,
    ...(Array.isArray(item.chunk_match_terms) ? item.chunk_match_terms : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function serviceItemFamilyHits(item, priors) {
  if (!Array.isArray(priors) || !priors.length) {
    return [];
  }
  const categoryValues = item.category_names?.length
    ? item.category_names
    : [item.category_names_text];
  const tagValues = item.tags?.length ? item.tags : [item.tags_text];
  const normalizedCorpus = ` ${phraseQuery(buildCorpus(item))} `;
  const hits = [];
  for (const prior of priors) {
    const family = text(prior?.family);
    if (!family) {
      continue;
    }
    const triggerMatch = (prior?.triggers || []).some((trigger) => {
      const normalizedTrigger = phraseQuery(trigger);
      return normalizedTrigger && normalizedCorpus.includes(` ${normalizedTrigger} `);
    });
    const labelMatch =
      structuredLabelOverlapCount(prior?.serviceTypes || [], [item.service_type]) > 0 ||
      structuredLabelOverlapCount(prior?.categories || [], categoryValues) > 0 ||
      structuredLabelOverlapCount(prior?.tags || [], tagValues) > 0;
    if (triggerMatch || labelMatch) {
      hits.push(family);
    }
  }
  return uniqueStrings(hits);
}

function needFamilySummary(items = []) {
  const counts = new Map();
  const labels = new Map();
  for (const item of items) {
    for (const family of item?.matched_need_families || item?._intent_family_hits || []) {
      const current = text(family);
      if (!current) {
        continue;
      }
      const key = current.toLowerCase();
      counts.set(key, Number(counts.get(key) || 0) + 1);
      if (!labels.has(key)) {
        labels.set(key, current);
      }
    }
  }
  return [...counts.entries()]
    .sort(
      (left, right) =>
        Number(right[1] || 0) - Number(left[1] || 0) ||
        String(left[0]).localeCompare(String(right[0])),
    )
    .map(([id, count]) => ({
      id,
      label: labels.get(id) || titleCase(id),
      count: Number(count || 0),
    }));
}

function needGroups(items = [], retrievalPlan = {}) {
  const families = Array.isArray(retrievalPlan?.families)
    ? retrievalPlan.families.map((value) => text(value)).filter(Boolean)
    : [];
  const familyQuota = Math.max(1, Number(retrievalPlan?.family_quota || 0));
  if (families.length < 2 || familyQuota < 1) {
    return [];
  }
  const hasExplicitGroups = items.some((item) => text(item?.need_group));

  return families
    .map((family) => {
      const familyKey = normalizeText(family);
      const matches = items
        .filter((item) => {
          const directGroup = normalizeText(item?.need_group);
          if (hasExplicitGroups) {
            return directGroup === familyKey;
          }
          return (item?.matched_need_families || item?._intent_family_hits || []).some(
            (value) => normalizeText(value) === familyKey,
          );
        })
        .slice(0, familyQuota);
      if (!matches.length) {
        return null;
      }
      return {
        id: familyKey,
        label: family,
        count: matches.length,
        requested_count: familyQuota,
        items: matches,
      };
    })
    .filter(Boolean);
}

function publicNeedGroups(items = [], retrievalPlan = {}) {
  return needGroups(items, retrievalPlan).map((group) => ({
    id: group.id,
    label: group.label,
    count: group.count,
    requested_count: group.requested_count,
    item_ids: (Array.isArray(group.items) ? group.items : [])
      .map((item) => rankedItemKey(item))
      .filter(Boolean),
  }));
}

function selectGroupedPageItems(
  items = [],
  retrievalPlan = {},
  requestedOffset = 0,
  pageLimitTotal = null,
) {
  if (!retrievalPlan?.multi_need) {
    const effectivePageLimit = Math.max(
      1,
      Number(pageLimitTotal || retrievalPlan?.page_limit_total || DEFAULT_LIMIT),
    );
    return items.slice(requestedOffset, requestedOffset + effectivePageLimit);
  }
  const families = Array.isArray(retrievalPlan?.families)
    ? retrievalPlan.families.map((value) => text(value)).filter(Boolean)
    : [];
  const familyQuota = Math.max(1, Number(retrievalPlan?.family_quota || 0));
  const effectivePageLimit = Math.max(
    1,
    Number(
      pageLimitTotal ||
        retrievalPlan?.page_limit_total ||
        familyQuota * Math.max(1, families.length),
    ),
  );
  if (families.length < 2 || requestedOffset > 0) {
    return items.slice(requestedOffset, requestedOffset + effectivePageLimit);
  }

  const selected = [];
  const usedKeys = new Set();
  for (const family of families) {
    const familyKey = normalizeText(family);
    let familySelected = 0;
    for (const item of items) {
      const itemKey = rankedItemKey(item);
      const familyHits = new Set(
        (item?.matched_need_families || item?._intent_family_hits || [])
          .map((value) => normalizeText(value))
          .filter(Boolean),
      );
      if (itemKey && !usedKeys.has(itemKey) && familyHits.has(familyKey)) {
        selected.push({
          ...item,
          _need_group_family: text(item?._need_group_family || family),
        });
        usedKeys.add(itemKey);
        familySelected += 1;
        if (familySelected >= familyQuota) {
          break;
        }
      }
    }
  }

  if (selected.length < effectivePageLimit) {
    for (const item of items) {
      const itemKey = rankedItemKey(item);
      if (itemKey && !usedKeys.has(itemKey)) {
        selected.push(item);
        usedKeys.add(itemKey);
      }
      if (selected.length >= effectivePageLimit) {
        break;
      }
    }
  }

  return selected.slice(0, effectivePageLimit);
}

function splitTextList(value) {
  return toList(value)
    .map((entry) => entry.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function normalizeServiceItem(item) {
  const extra = item?._additional || {};
  const rerankValue = Array.isArray(extra?.rerank) ? extra.rerank[0]?.score : extra?.rerank?.score;
  const categoryNames = splitTextList(
    item?.categoryNames?.length ? item?.categoryNames : item?.categoryNamesText,
  );
  const tags = splitTextList(item?.tags?.length ? item?.tags : item?.tagsText);
  const location = normalizeServiceLocation(item?.city, item?.province, item?.address);
  const geoCoordinates = normalizeGeoCoordinates(item?.geoCoordinates);
  return {
    id: item?.serviceId || extra.id || '',
    service_id: item?.serviceId || '',
    object_id: extra.id || '',
    name: cleanTextValue(item?.name),
    slug: cleanTextValue(item?.slug),
    city: location.city,
    province: location.province,
    location_label: location.location_label,
    geo_coordinates: geoCoordinates,
    latitude: geoCoordinates?.latitude ?? null,
    longitude: geoCoordinates?.longitude ?? null,
    postal_code: cleanTextValue(item?.postalCode),
    service_type: cleanTextValue(item?.serviceType),
    category: categoryNames[0] || cleanTextValue(item?.serviceType),
    category_names: categoryNames,
    category_names_text: cleanTextValue(item?.categoryNamesText),
    tags,
    tags_text: cleanTextValue(item?.tagsText),
    overview: cleanTextValue(item?.overview),
    description: cleanTextValue(item?.description),
    detail_text: cleanTextValue(item?.detailText),
    service_identity_text: cleanTextValue(item?.serviceIdentityText),
    service_content_text: cleanTextValue(item?.serviceContentText),
    service_access_text: cleanTextValue(item?.serviceAccessText),
    address: cleanTextValue(item?.address),
    website: cleanTextValue(item?.website),
    url: cleanTextValue(item?.website),
    phone: cleanTextValue(item?.phone),
    email: cleanTextValue(item?.email),
    image_url: cleanTextValue(item?.imageUrl),
    logo: cleanTextValue(item?.imageUrl),
    ages_served: cleanTextValue(item?.agesServed),
    gender_served: cleanTextValue(item?.genderServed),
    is_active: item?.isActive !== false,
    is_verified: item?.isVerified === true,
    rating: Number(item?.rating || 0),
    rating_count: Number(item?.ratingCount || 0),
    distance: typeof extra.distance === 'number' ? extra.distance : null,
    distance_km: typeof extra.distance === 'number' ? extra.distance : null,
    vector_distance: typeof extra.distance === 'number' ? extra.distance : null,
    geo_distance_km: null,
    certainty: Number.isFinite(Number(extra.certainty)) ? Number(extra.certainty) : null,
    score: Number.isFinite(Number(extra.score)) ? Number(extra.score) : null,
    rerank_score: Number.isFinite(Number(rerankValue)) ? Number(rerankValue) : null,
    explain_score: cleanTextValue(extra.explainScore),
    source_index: item?.sourceIndex || '',
  };
}

function normalizeChunkItem(item) {
  const extra = item?._additional || {};
  const rerankValue = Array.isArray(extra?.rerank) ? extra.rerank[0]?.score : extra?.rerank?.score;
  return {
    id: cleanTextValue(item?.chunkId || extra.id),
    object_id: cleanTextValue(extra.id),
    chunk_id: cleanTextValue(item?.chunkId),
    service_id: cleanTextValue(item?.serviceId),
    name: cleanTextValue(item?.name),
    slug: cleanTextValue(item?.slug),
    chunk_index: Number.isFinite(Number(item?.chunkIndex)) ? Number(item.chunkIndex) : 0,
    chunk_kind: cleanTextValue(item?.chunkKind),
    chunk_text: cleanTextValue(item?.chunkText),
    chunk_preview: cleanTextValue(item?.chunkPreview),
    service_type: cleanTextValue(item?.serviceType),
    city: cleanTextValue(item?.city),
    province: cleanTextValue(item?.province),
    postal_code: cleanTextValue(item?.postalCode),
    address: cleanTextValue(item?.address),
    location_label: cleanTextValue(item?.locationLabel),
    tags_text: cleanTextValue(item?.tagsText),
    category_names_text: cleanTextValue(item?.categoryNamesText),
    ages_served: cleanTextValue(item?.agesServed),
    gender_served: cleanTextValue(item?.genderServed),
    chunk_identity_text: cleanTextValue(item?.chunkIdentityText),
    chunk_access_text: cleanTextValue(item?.chunkAccessText),
    is_active: item?.isActive !== false,
    is_verified: item?.isVerified === true,
    source_index: cleanTextValue(item?.sourceIndex),
    distance: typeof extra.distance === 'number' ? extra.distance : null,
    certainty: Number.isFinite(Number(extra.certainty)) ? Number(extra.certainty) : null,
    score: Number.isFinite(Number(extra.score)) ? Number(extra.score) : null,
    rerank_score: Number.isFinite(Number(rerankValue)) ? Number(rerankValue) : null,
    explain_score: cleanTextValue(extra.explainScore),
  };
}

function uniqueStrings(values) {
  const seen = new Set();
  const ordered = [];
  for (const value of values) {
    const current = text(value);
    if (!current) continue;
    const key = current.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(current);
  }
  return ordered;
}

function fitReasonValue(value) {
  return text(value).replace(/\s+/g, ' ').trim();
}

function quotedFitReasonValue(value) {
  const current = fitReasonValue(value);
  return current ? `"${current}"` : '';
}

function semanticFitReason(value) {
  const score = Number(value);
  return Number.isFinite(score) ? `Semantic match ${score.toFixed(2)}` : 'Semantic match';
}

function intentFitReason(value) {
  const family = fitReasonValue(value);
  if (!family) {
    return '';
  }
  const lowerFamily = family.toLowerCase();
  if (lowerFamily === 'health') {
    return 'Fits a health-related request';
  }
  return `Fits ${family} needs`;
}

function facetKey(value) {
  return text(value).replace(/\s+/g, ' ').trim().toLowerCase();
}

function preferFacetLabel(current, candidate) {
  if (!current) {
    return candidate;
  }
  if (current === current.toUpperCase() && candidate !== candidate.toUpperCase()) {
    return candidate;
  }
  if (current === current.toLowerCase() && /[A-Z]/.test(candidate)) {
    return candidate;
  }
  return current;
}

function incrementFacetCount(map, value) {
  const normalized = text(value).replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return;
  }
  const key = facetKey(normalized);
  const current = map.get(key) || { value: normalized, count: 0 };
  current.value = preferFacetLabel(current.value, normalized);
  current.count += 1;
  map.set(key, current);
}

function buildMatchReasons(item, args) {
  const queryReasons = [];
  const filterReasons = [];
  const tagReasons = [];
  const intent = serviceIntentProfile(args.query);
  for (const tag of args.tags) tagReasons.push(`Tagged for ${fitReasonValue(tag)}`);
  if (args.ages_served && item.ages_served)
    filterReasons.push(`Serves ${fitReasonValue(item.ages_served)}`);
  if (args.gender_served && item.gender_served)
    filterReasons.push(`Serves ${fitReasonValue(item.gender_served)}`);
  const corpus = buildCorpus(item);
  for (const term of queryTerms(args.query)) {
    if (corpus.includes(term)) {
      queryReasons.push(`Mentions ${quotedFitReasonValue(term)}`);
    }
  }
  for (const family of serviceItemFamilyHits(item, intent.priors)) {
    queryReasons.push(intentFitReason(family));
  }
  if (Array.isArray(item.chunk_match_terms) && item.chunk_match_terms.length) {
    queryReasons.push(`Detailed notes mention ${quotedFitReasonValue(item.chunk_match_terms[0])}`);
  } else if (item.chunk_hits) {
    queryReasons.push('Detailed service notes match this request');
  }
  const reasons = uniqueStrings([...queryReasons, ...filterReasons, ...tagReasons]);
  if (!reasons.length && item.score != null) {
    reasons.push(semanticFitReason(item.score));
  } else if (!reasons.length && item.certainty != null) {
    reasons.push(semanticFitReason(item.certainty));
  }
  return reasons.slice(0, 6);
}

function termMatchCount(item, args) {
  const corpus = buildCorpus(item);
  let count = 0;
  for (const term of searchTermsForArgs(args)) {
    if (corpus.includes(term)) {
      count += 1;
    }
  }
  return count;
}

function fieldMatchScore(terms, textValue, { termWeight, phraseWeight = 0, allTermsBonus = 0 }) {
  const text = normalizeText(textValue);
  if (!terms.length || !text) {
    return 0;
  }
  let score = 0;
  for (const term of terms) {
    if (text.includes(term)) {
      score += termWeight;
    }
  }
  if (terms.length >= 2) {
    const phrase = terms.join(' ');
    if (phrase && text.includes(phrase)) {
      score += phraseWeight;
    }
  }
  if (terms.every((term) => text.includes(term))) {
    score += allTermsBonus;
  }
  return score;
}

function scoreItem(item, args) {
  const terms = queryTerms(args.query);
  const intent = serviceIntentProfile(args.query);
  const explicitServiceTypeHits = structuredLabelOverlapCount(intent.serviceTypes, [
    item.service_type,
  ]);
  const explicitCategoryHits = structuredLabelOverlapCount(
    intent.categories,
    item.category_names?.length ? item.category_names : [item.category_names_text],
  );
  const explicitTagHits = structuredLabelOverlapCount(
    intent.tags,
    item.tags?.length ? item.tags : [item.tags_text],
  );
  const locationText = [
    item.city,
    item.province,
    item.location_label,
    item.address,
    item.postal_code,
    item.service_access_text,
  ]
    .filter(Boolean)
    .join(' ');
  const bodyText = [
    item.overview,
    item.description,
    item.detail_text,
    item.service_content_text,
    item.ages_served,
    item.gender_served,
  ]
    .filter(Boolean)
    .join(' ');
  const identityText = [
    item.name,
    item.service_type,
    item.category_names_text,
    item.tags_text,
    item.service_identity_text,
  ]
    .filter(Boolean)
    .join(' ');
  let score = 0;
  score += fieldMatchScore(terms, item.name, {
    termWeight: 40,
    phraseWeight: 80,
    allTermsBonus: 30,
  });
  score += fieldMatchScore(terms, identityText, {
    termWeight: 24,
    phraseWeight: 40,
    allTermsBonus: 16,
  });
  score += fieldMatchScore(terms, item.service_type, {
    termWeight: 28,
    phraseWeight: 48,
    allTermsBonus: 18,
  });
  score += fieldMatchScore(terms, item.category_names_text, {
    termWeight: 24,
    phraseWeight: 36,
    allTermsBonus: 14,
  });
  score += fieldMatchScore(terms, item.tags_text, {
    termWeight: 20,
    phraseWeight: 32,
    allTermsBonus: 12,
  });
  score += fieldMatchScore(terms, locationText, {
    termWeight: 16,
    phraseWeight: 24,
    allTermsBonus: 10,
  });
  score += fieldMatchScore(terms, bodyText, { termWeight: 10, phraseWeight: 14, allTermsBonus: 6 });
  score += fieldMatchScore(queryTerms(intent.serviceTypes.join(' ')), item.service_type, {
    termWeight: 20,
    phraseWeight: 24,
    allTermsBonus: 12,
  });
  score += fieldMatchScore(queryTerms(intent.categories.join(' ')), item.category_names_text, {
    termWeight: 18,
    phraseWeight: 22,
    allTermsBonus: 10,
  });
  score += fieldMatchScore(queryTerms(intent.tags.join(' ')), item.tags_text, {
    termWeight: 14,
    phraseWeight: 18,
    allTermsBonus: 8,
  });
  score += fieldMatchScore(queryTerms(intent.tags.join(' ')), bodyText, {
    termWeight: 6,
    phraseWeight: 10,
    allTermsBonus: 4,
  });
  score += explicitServiceTypeHits * 24;
  score += explicitCategoryHits * 18;
  score += explicitTagHits * 10;
  const corpus = buildCorpus(item);
  for (const need of args.needs) {
    if (corpus.includes(need.toLowerCase())) {
      score += 12;
    }
  }
  for (const language of args.languages) {
    if (corpus.includes(language.toLowerCase())) {
      score += 8;
    }
  }
  if (item.is_verified) {
    score += 6;
  }
  score += (item.rating || 0) / 10;
  if (item.score != null) {
    score += item.score;
  }
  if (item.rerank_score != null) {
    score += item.rerank_score * 120;
  }
  if (item.certainty != null) {
    score += item.certainty * 10;
  }
  if (item.chunk_relevance != null) {
    score += Math.min(36, Number(item.chunk_relevance || 0));
  }
  if (item.chunk_hits) {
    score += Math.min(10, Number(item.chunk_hits || 0) * 2);
  }
  return score;
}

function scoreChunkItem(item, args) {
  const terms = queryTerms(args.query);
  const intent = serviceIntentProfile(args.query);
  const bodyText = [item.chunk_text, item.chunk_preview].filter(Boolean).join(' ');
  const identityText = [
    item.name,
    item.service_type,
    item.category_names_text,
    item.tags_text,
    item.chunk_identity_text,
  ]
    .filter(Boolean)
    .join(' ');
  const accessText = [
    item.city,
    item.province,
    item.location_label,
    item.address,
    item.chunk_access_text,
    item.ages_served,
    item.gender_served,
  ]
    .filter(Boolean)
    .join(' ');
  let score = 0;
  score += fieldMatchScore(terms, bodyText, {
    termWeight: 18,
    phraseWeight: 28,
    allTermsBonus: 14,
  });
  score += fieldMatchScore(terms, identityText, {
    termWeight: 10,
    phraseWeight: 18,
    allTermsBonus: 8,
  });
  score += fieldMatchScore(terms, accessText, {
    termWeight: 8,
    phraseWeight: 12,
    allTermsBonus: 6,
  });
  score += fieldMatchScore(queryTerms(intent.serviceTypes.join(' ')), item.service_type, {
    termWeight: 8,
    phraseWeight: 10,
    allTermsBonus: 4,
  });
  score += fieldMatchScore(queryTerms(intent.categories.join(' ')), item.category_names_text, {
    termWeight: 8,
    phraseWeight: 10,
    allTermsBonus: 4,
  });
  score += fieldMatchScore(queryTerms(intent.tags.join(' ')), `${item.tags_text} ${bodyText}`, {
    termWeight: 6,
    phraseWeight: 8,
    allTermsBonus: 4,
  });
  if (item.is_verified) {
    score += 2;
  }
  if (item.score != null) {
    score += item.score;
  }
  if (item.rerank_score != null) {
    score += item.rerank_score * 120;
  }
  if (item.certainty != null) {
    score += item.certainty * 6;
  }
  return score;
}

function hasChunkEvidence(item) {
  return Boolean(
    Number(item?.chunk_hits || 0) > 0 ||
      Number(item?.chunk_relevance || 0) > 0 ||
      (Array.isArray(item?.chunk_match_terms) && item.chunk_match_terms.length) ||
      cleanTextValue(item?.chunk_evidence_preview),
  );
}

function buildChunkEvidenceFromDocuments(documents, args) {
  const normalizedDocuments = Array.isArray(documents) ? documents.filter(Boolean) : [];
  if (!normalizedDocuments.length) {
    return null;
  }
  const terms = queryTerms(args.query);
  let chunkRelevance = 0;
  let chunkHits = 0;
  let chunkMatchTerms = [];
  let chunkEvidencePreview = '';
  let chunkEvidenceKind = '';
  let topScore = Number.NEGATIVE_INFINITY;

  for (const document of normalizedDocuments) {
    const score = Number(document.score || 0);
    const corpus = `${document.preview || ''} ${document.text || ''}`.toLowerCase();
    const matchTerms = terms.filter((term) => corpus.includes(term));
    chunkRelevance += Math.max(0, score);
    chunkHits += 1;
    chunkMatchTerms = uniqueStrings([...chunkMatchTerms, ...matchTerms]).slice(0, 4);
    if (score > topScore || !chunkEvidencePreview) {
      topScore = score;
      chunkEvidencePreview = cleanTextValue(document.preview || document.text);
      chunkEvidenceKind = cleanTextValue(document.chunk_kind);
    }
  }

  return {
    chunk_relevance: chunkRelevance,
    chunk_hits: chunkHits,
    chunk_match_terms: chunkMatchTerms,
    chunk_evidence_preview: chunkEvidencePreview,
    chunk_evidence_kind: chunkEvidenceKind,
  };
}

async function hydrateChunkEvidenceForRankedItems(ranked, args) {
  if (
    !Array.isArray(ranked) ||
    !ranked.length ||
    !args.query ||
    !hasMeaningfulServiceQuery(args.query)
  ) {
    return ranked;
  }
  const targetCount = Math.min(
    ranked.length,
    Math.max(args.limit + args.offset, CHUNK_HYDRATE_SCAN_RESULTS),
  );
  const candidates = ranked
    .slice(0, targetCount)
    .filter((item) => item?.service_id && !hasChunkEvidence(item))
    .slice(0, CHUNK_HYDRATE_TOP_RESULTS);
  if (!candidates.length) {
    return ranked;
  }

  let chunkDocumentsByService = new Map();
  try {
    chunkDocumentsByService = await fetchChunksForServicesDirect(
      candidates.map((item) => item.service_id),
      {
        query: args.query,
        active_only: args.active_only,
        limit: CHUNK_HYDRATE_DOCUMENT_LIMIT,
      },
    );
  } catch (error) {
    console.error(`[streetbot-rag] chunk hydrate batch failed: ${error.message}`);
    return ranked;
  }

  const evidenceByService = new Map(
    candidates
      .map((item) => {
        const documents = chunkDocumentsByService.get(item.service_id) || [];
        const evidence = buildChunkEvidenceFromDocuments(documents, args);
        return evidence ? [item.service_id, evidence] : null;
      })
      .filter(Boolean),
  );
  if (!evidenceByService.size) {
    return ranked;
  }

  const updated = ranked.map((item) => {
    const evidence = evidenceByService.get(item.service_id);
    if (!evidence) {
      return item;
    }
    const merged = { ...item, ...evidence };
    const hydrated = {
      ...merged,
      match_reasons: buildMatchReasons(merged, args),
      _term_matches: termMatchCount(merged, args),
      _ranking: scoreItem(merged, args),
      _geo_distance_km: geographicDistanceKm(args, merged),
      _geo_band: geographicBandForItem(args, merged),
      _backfill_precision: universalPrecisionScore(merged, args),
    };
    if (args.debug_rank) {
      hydrated.rank_debug = buildRankDebug(hydrated, args);
    }
    return hydrated;
  });

  return sortRankedCandidates(updated, args);
}

function chunkSnippet(item, args) {
  const source = cleanTextValue(item?.chunk_text || item?.chunk_preview);
  if (!source) {
    return '';
  }
  const normalized = source.replace(/\s+/g, ' ').trim();
  const lowered = normalized.toLowerCase();
  const matchedTerm = queryTerms(args.query).find((term) => lowered.includes(term));
  if (!matchedTerm) {
    return truncateText(normalized, CHUNK_SNIPPET_CHARS);
  }
  const index = lowered.indexOf(matchedTerm);
  const start = Math.max(0, index - 60);
  const end = Math.min(normalized.length, index + matchedTerm.length + 100);
  const snippet = normalized.slice(start, end).trim();
  const prefixed = start > 0 ? `…${snippet}` : snippet;
  return end < normalized.length ? `${prefixed}…` : prefixed;
}

function buildChunkEvidenceMap(rawChunks, args) {
  const byService = new Map();
  for (const rawChunk of rawChunks || []) {
    const chunk = normalizeChunkItem(rawChunk);
    if (!chunk.service_id || !chunk.is_active) {
      continue;
    }
    const chunkScore = scoreChunkItem(chunk, args);
    const matchTerms = queryTerms(args.query).filter((term) =>
      `${chunk.chunk_text} ${chunk.chunk_preview}`.toLowerCase().includes(term),
    );
    const current = byService.get(chunk.service_id) || {
      chunk_relevance: 0,
      chunk_hits: 0,
      chunk_match_terms: [],
      chunk_evidence_preview: '',
      chunk_evidence_kind: '',
      _top_chunk_score: Number.NEGATIVE_INFINITY,
    };
    current.chunk_relevance += chunkScore;
    current.chunk_hits += 1;
    current.chunk_match_terms = uniqueStrings([...current.chunk_match_terms, ...matchTerms]).slice(
      0,
      4,
    );
    if (chunkScore > current._top_chunk_score) {
      current._top_chunk_score = chunkScore;
      current.chunk_evidence_preview = chunkSnippet(chunk, args);
      current.chunk_evidence_kind = chunk.chunk_kind;
    }
    byService.set(chunk.service_id, current);
  }
  for (const value of byService.values()) {
    delete value._top_chunk_score;
  }
  return byService;
}

function precisionSignals(item, args) {
  const anchors = intentAnchorTerms(args);
  if (!anchors.length) {
    return {
      anchors,
      name: false,
      serviceType: false,
      category: false,
      tag: false,
      body: false,
      strongFieldCount: 0,
    };
  }

  const bodyText = [item.overview, item.description, item.detail_text].filter(Boolean).join(' ');
  const signals = {
    anchors,
    name: fieldMatchScore(anchors, item.name, { termWeight: 1, phraseWeight: 2 }) > 0,
    serviceType:
      fieldMatchScore(anchors, item.service_type, { termWeight: 1, phraseWeight: 2 }) > 0,
    category:
      fieldMatchScore(anchors, item.category_names_text, { termWeight: 1, phraseWeight: 2 }) > 0,
    tag: fieldMatchScore(anchors, item.tags_text, { termWeight: 1, phraseWeight: 2 }) > 0,
    body: fieldMatchScore(anchors, bodyText, { termWeight: 1, phraseWeight: 1 }) > 0,
  };
  signals.strongFieldCount = [
    signals.name,
    signals.serviceType,
    signals.category,
    signals.tag,
  ].filter(Boolean).length;
  return signals;
}

function backfillPrecisionScore(item, args) {
  const signals = precisionSignals(item, args);
  return (
    (signals.serviceType ? 6 : 0) +
    (signals.name ? 4 : 0) +
    (signals.category ? 3 : 0) +
    (signals.tag ? 2 : 0) +
    (signals.body ? 1 : 0)
  );
}

function isPrecisionBackfillCandidate(item, args) {
  const signals = precisionSignals(item, args);
  if (!signals.anchors.length) {
    return true;
  }
  if (signals.serviceType) {
    return true;
  }
  if (signals.strongFieldCount >= 2) {
    return true;
  }
  return signals.strongFieldCount >= 1 && signals.body;
}

function universalPrecisionScore(item, args) {
  const intent = serviceIntentProfile(args.query);
  const explicitServiceTypeHits = structuredLabelOverlapCount(intent.serviceTypes, [
    item.service_type,
  ]);
  const explicitCategoryHits = structuredLabelOverlapCount(
    intent.categories,
    item.category_names?.length ? item.category_names : [item.category_names_text],
  );
  const explicitTagHits = structuredLabelOverlapCount(
    intent.tags,
    item.tags?.length ? item.tags : [item.tags_text],
  );
  return (
    backfillPrecisionScore(item, args) +
    explicitServiceTypeHits * 8 +
    explicitCategoryHits * 6 +
    explicitTagHits * 4
  );
}

function precisionScoreBreakdown(item, args) {
  const signals = precisionSignals(item, args);
  const intent = serviceIntentProfile(args.query);
  const explicitServiceTypeHits = structuredLabelOverlapCount(intent.serviceTypes, [
    item.service_type,
  ]);
  const explicitCategoryHits = structuredLabelOverlapCount(
    intent.categories,
    item.category_names?.length ? item.category_names : [item.category_names_text],
  );
  const explicitTagHits = structuredLabelOverlapCount(
    intent.tags,
    item.tags?.length ? item.tags : [item.tags_text],
  );
  const components = {
    service_type_signal: signals.serviceType ? 6 : 0,
    name_signal: signals.name ? 4 : 0,
    category_signal: signals.category ? 3 : 0,
    tag_signal: signals.tag ? 2 : 0,
    body_signal: signals.body ? 1 : 0,
    explicit_service_type: explicitServiceTypeHits * 8,
    explicit_category: explicitCategoryHits * 6,
    explicit_tag: explicitTagHits * 4,
  };
  return {
    anchors: [...signals.anchors],
    strong_field_count: signals.strongFieldCount,
    explicit_service_type_hits: explicitServiceTypeHits,
    explicit_category_hits: explicitCategoryHits,
    explicit_tag_hits: explicitTagHits,
    components,
    total: Object.values(components).reduce((sum, value) => sum + Number(value || 0), 0),
  };
}

function rankScoreBreakdown(item, args) {
  const terms = queryTerms(args.query);
  const intent = serviceIntentProfile(args.query);
  const matchedIntentFamilies = serviceItemFamilyHits(item, intent.priors);
  const explicitServiceTypeHits = structuredLabelOverlapCount(intent.serviceTypes, [
    item.service_type,
  ]);
  const explicitCategoryHits = structuredLabelOverlapCount(
    intent.categories,
    item.category_names?.length ? item.category_names : [item.category_names_text],
  );
  const explicitTagHits = structuredLabelOverlapCount(
    intent.tags,
    item.tags?.length ? item.tags : [item.tags_text],
  );
  const locationText = [
    item.city,
    item.province,
    item.location_label,
    item.address,
    item.postal_code,
    item.service_access_text,
  ]
    .filter(Boolean)
    .join(' ');
  const bodyText = [
    item.overview,
    item.description,
    item.detail_text,
    item.service_content_text,
    item.ages_served,
    item.gender_served,
  ]
    .filter(Boolean)
    .join(' ');
  const identityText = [
    item.name,
    item.service_type,
    item.category_names_text,
    item.tags_text,
    item.service_identity_text,
  ]
    .filter(Boolean)
    .join(' ');
  const corpus = buildCorpus(item);
  const components = {
    query_name: fieldMatchScore(terms, item.name, {
      termWeight: 40,
      phraseWeight: 80,
      allTermsBonus: 30,
    }),
    query_identity: fieldMatchScore(terms, identityText, {
      termWeight: 24,
      phraseWeight: 40,
      allTermsBonus: 16,
    }),
    query_service_type: fieldMatchScore(terms, item.service_type, {
      termWeight: 28,
      phraseWeight: 48,
      allTermsBonus: 18,
    }),
    query_category: fieldMatchScore(terms, item.category_names_text, {
      termWeight: 24,
      phraseWeight: 36,
      allTermsBonus: 14,
    }),
    query_tags: fieldMatchScore(terms, item.tags_text, {
      termWeight: 20,
      phraseWeight: 32,
      allTermsBonus: 12,
    }),
    query_location: fieldMatchScore(terms, locationText, {
      termWeight: 16,
      phraseWeight: 24,
      allTermsBonus: 10,
    }),
    query_body: fieldMatchScore(terms, bodyText, {
      termWeight: 10,
      phraseWeight: 14,
      allTermsBonus: 6,
    }),
    intent_service_type: fieldMatchScore(
      queryTerms(intent.serviceTypes.join(' ')),
      item.service_type,
      {
        termWeight: 20,
        phraseWeight: 24,
        allTermsBonus: 12,
      },
    ),
    intent_category: fieldMatchScore(
      queryTerms(intent.categories.join(' ')),
      item.category_names_text,
      {
        termWeight: 18,
        phraseWeight: 22,
        allTermsBonus: 10,
      },
    ),
    intent_tag: fieldMatchScore(queryTerms(intent.tags.join(' ')), item.tags_text, {
      termWeight: 14,
      phraseWeight: 18,
      allTermsBonus: 8,
    }),
    intent_body: fieldMatchScore(queryTerms(intent.tags.join(' ')), bodyText, {
      termWeight: 6,
      phraseWeight: 10,
      allTermsBonus: 4,
    }),
    explicit_service_type: explicitServiceTypeHits * 24,
    explicit_category: explicitCategoryHits * 18,
    explicit_tag: explicitTagHits * 10,
    needs: (args.needs || []).reduce(
      (sum, need) => sum + (corpus.includes(String(need).toLowerCase()) ? 12 : 0),
      0,
    ),
    languages: (args.languages || []).reduce(
      (sum, language) => sum + (corpus.includes(String(language).toLowerCase()) ? 8 : 0),
      0,
    ),
    verified: item.is_verified ? 6 : 0,
    rating: (item.rating || 0) / 10,
    vector_score: item.score != null ? Number(item.score || 0) : 0,
    rerank: item.rerank_score != null ? item.rerank_score * 120 : 0,
    certainty: item.certainty != null ? item.certainty * 10 : 0,
    chunk_relevance:
      item.chunk_relevance != null ? Math.min(36, Number(item.chunk_relevance || 0)) : 0,
    chunk_hits: item.chunk_hits ? Math.min(10, Number(item.chunk_hits || 0) * 2) : 0,
  };
  return {
    terms: [...terms],
    intent_families: [...intent.families],
    matched_intent_families: matchedIntentFamilies,
    explicit_service_type_hits: explicitServiceTypeHits,
    explicit_category_hits: explicitCategoryHits,
    explicit_tag_hits: explicitTagHits,
    components,
    total: Object.values(components).reduce((sum, value) => sum + Number(value || 0), 0),
  };
}

function buildRankDebug(item, args) {
  const precision = precisionScoreBreakdown(item, args);
  return {
    rank: rankScoreBreakdown(item, args),
    sort: {
      geo_distance_km: geographicDistanceKm(args, item),
      geo_band: Number(item?._geo_band ?? geographicBandForItem(args, item)),
      precision,
      is_verified: Boolean(item?.is_verified),
      ranking_total: Number(item?._ranking || 0),
    },
  };
}

function findLocationGroup(city, groups) {
  const normalizedCity = normalizeText(city);
  if (!normalizedCity) {
    return null;
  }
  return groups.find((group) => group.includes(normalizedCity)) || null;
}

function haversineDistanceKm(leftLatitude, leftLongitude, rightLatitude, rightLongitude) {
  const lat1 = finiteNumber(leftLatitude);
  const lon1 = finiteNumber(leftLongitude);
  const lat2 = finiteNumber(rightLatitude);
  const lon2 = finiteNumber(rightLongitude);
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return null;
  }

  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(lat2 - lat1);
  const deltaLongitude = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLongitude / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function geographicDistanceKm(args, item) {
  return haversineDistanceKm(args?.latitude, args?.longitude, item?.latitude, item?.longitude);
}

function geographicDistanceBand(distanceKm) {
  if (!Number.isFinite(distanceKm)) {
    return null;
  }
  if (distanceKm <= 5) {
    return 0;
  }
  if (distanceKm <= 15) {
    return 1;
  }
  if (distanceKm <= 40) {
    return 2;
  }
  if (distanceKm <= 100) {
    return 3;
  }
  return 4;
}

function geographicBandForItem(args, item) {
  const exactDistanceKm = geographicDistanceKm(args, item);
  const exactDistanceBand = geographicDistanceBand(exactDistanceKm);
  if (exactDistanceBand != null) {
    return exactDistanceBand;
  }

  const targetCity = normalizeText(args.city);
  const targetProvince = normalizeText(args.province);
  const itemCity = normalizeText(item?.city);
  const itemProvince = normalizeText(item?.province);

  if (targetCity && itemCity && targetCity === itemCity) {
    return 0;
  }

  const localityGroup = findLocationGroup(targetCity, LOCALITY_GROUPS);
  if (localityGroup && itemCity && localityGroup.includes(itemCity)) {
    return 1;
  }

  const widerRegionGroup = findLocationGroup(targetCity, WIDER_REGION_GROUPS);
  if (widerRegionGroup && itemCity && widerRegionGroup.includes(itemCity)) {
    return 2;
  }

  if (targetProvince && itemProvince && targetProvince === itemProvince) {
    return 3;
  }

  if (targetCity || targetProvince) {
    return 4;
  }

  return 0;
}

function sortRankedCandidates(candidates, args) {
  const ordered = [...(candidates || [])].sort((left, right) => {
    const leftGeo = Number(left?._geo_band ?? geographicBandForItem(args, left));
    const rightGeo = Number(right?._geo_band ?? geographicBandForItem(args, right));
    const geographicDelta = leftGeo - rightGeo;
    if (geographicDelta !== 0) {
      return geographicDelta;
    }

    const leftDistanceKm = finiteNumber(left?._geo_distance_km ?? geographicDistanceKm(args, left));
    const rightDistanceKm = finiteNumber(
      right?._geo_distance_km ?? geographicDistanceKm(args, right),
    );
    if (leftDistanceKm != null || rightDistanceKm != null) {
      const exactDistanceDelta =
        (leftDistanceKm ?? Number.POSITIVE_INFINITY) -
        (rightDistanceKm ?? Number.POSITIVE_INFINITY);
      if (Math.abs(exactDistanceDelta) > 0.05) {
        return exactDistanceDelta;
      }
    }

    const leftPrecision = Number(left?._backfill_precision ?? universalPrecisionScore(left, args));
    const rightPrecision = Number(
      right?._backfill_precision ?? universalPrecisionScore(right, args),
    );
    const precisionDelta = rightPrecision - leftPrecision;
    if (precisionDelta !== 0) {
      return precisionDelta;
    }

    const verificationDelta =
      Number(Boolean(right?.is_verified)) - Number(Boolean(left?.is_verified));
    if (verificationDelta !== 0) {
      return verificationDelta;
    }

    return Number(right?._ranking || 0) - Number(left?._ranking || 0);
  });
  return diversifyMultiFamilyCandidates(ordered, args);
}

function diversifyMultiFamilyCandidates(candidates, args) {
  const retrievalPlan = args.retrieval_plan || buildRetrievalPlan(args);
  const intent = retrievalPlan.intent || serviceIntentProfile(args.query);
  if (intent.families.length < 2 || !candidates?.length) {
    return candidates || [];
  }
  const familyQuota = Math.max(
    1,
    Number(retrievalPlan.family_quota || args.limit || DEFAULT_LIMIT),
  );
  const pageLimitTotal = Math.max(
    1,
    Math.min(
      candidates.length,
      Number(
        retrievalPlan.page_limit_total ||
          familyQuota * Math.max(1, intent.families.length) ||
          args.limit ||
          DEFAULT_LIMIT,
      ),
    ),
  );
  const focusSize = Math.max(
    1,
    Math.min(
      candidates.length,
      Math.max(
        (pageLimitTotal + args.offset) * 8,
        familyQuota * Math.max(1, intent.families.length) * 8,
        48,
      ),
    ),
  );
  const head = candidates.slice(0, focusSize).map((item) => ({
    ...item,
    _intent_family_hits: Array.isArray(item?._intent_family_hits)
      ? item._intent_family_hits
      : serviceItemFamilyHits(item, intent.priors),
  }));
  const tail = candidates.slice(focusSize);
  if (!head.length) {
    return candidates;
  }
  let remaining = [...head];
  const selected = [];
  const usedKeys = new Set();

  for (const family of intent.families) {
    if (selected.length >= pageLimitTotal) {
      break;
    }
    const familyKey = normalizeText(family);
    let familySelected = 0;
    const nextRemaining = [];
    for (const item of remaining) {
      const itemKey = rankedItemKey(item);
      const familyHits = new Set(
        (item?._intent_family_hits || []).map((value) => normalizeText(value)),
      );
      if (
        familySelected < familyQuota &&
        familyHits.has(familyKey) &&
        itemKey &&
        !usedKeys.has(itemKey) &&
        selected.length < pageLimitTotal
      ) {
        selected.push({ ...item, _need_group_family: family });
        usedKeys.add(itemKey);
        familySelected += 1;
        continue;
      }
      nextRemaining.push(item);
    }
    remaining = nextRemaining;
  }

  return [...selected, ...remaining, ...tail];
}

function refineBackfillCandidates(candidates, args) {
  const ranked = sortRankedCandidates(
    (candidates || []).map((item) => ({
      ...item,
      _geo_distance_km: geographicDistanceKm(args, item),
      _geo_band: geographicBandForItem(args, item),
      _backfill_precision: backfillPrecisionScore(item, args),
      _backfill_allowed: isPrecisionBackfillCandidate(item, args),
    })),
    args,
  );

  const allowed = ranked.filter((item) => item._backfill_allowed);
  return allowed.length ? allowed : ranked;
}

function rankedItemKey(item) {
  return normalizeText(
    item?.service_id ||
      item?.id ||
      item?.object_id ||
      item?.slug ||
      [item?.name, item?.address, item?.city, item?.province].filter(Boolean).join('|'),
  );
}

function rankedEntityKey(item) {
  const name = normalizeText(item?.name);
  if (!name) {
    return '';
  }
  return normalizeText(
    [item?.name, item?.city, item?.province, item?.service_type, item?.website]
      .filter(Boolean)
      .join('|'),
  );
}

function dedupeRankedItems(items) {
  const seen = new Set();
  const deduped = [];
  for (const item of items || []) {
    const keys = [rankedItemKey(item), rankedEntityKey(item)].filter(Boolean);
    if (keys.some((key) => seen.has(key))) {
      continue;
    }
    for (const key of keys) {
      seen.add(key);
    }
    deduped.push(item);
  }
  return deduped;
}

function mergeRankedItems(...groups) {
  return dedupeRankedItems(groups.flatMap((group) => group || []));
}

function stripRankedItem(item) {
  const {
    _ranking,
    _term_matches,
    _geo_band,
    _geo_distance_km,
    _backfill_precision,
    _backfill_allowed,
    _intent_family_hits,
    _need_group_family,
    detail_text,
    service_identity_text,
    service_content_text,
    service_access_text,
    chunk_id,
    chunk_index,
    chunk_kind,
    chunk_text,
    chunk_preview,
    chunk_identity_text,
    chunk_access_text,
    chunk_evidence_preview,
    chunk_evidence_kind,
    rank_debug,
    ...rest
  } = item || {};
  const needGroup = text(rest.need_group || _need_group_family);
  return {
    ...rest,
    ...(needGroup ? { need_group: needGroup } : {}),
    geo_distance_km: finiteNumber(rest.geo_distance_km) ?? finiteNumber(_geo_distance_km),
  };
}

async function weaviateJson(method, path, payload = undefined) {
  const headers = payload ? { 'Content-Type': 'application/json' } : {};
  if (COHERE_API_KEY) {
    headers['X-Cohere-Api-Key'] = COHERE_API_KEY;
  }
  if (COHERE_BASE_URL) {
    headers['X-Cohere-Baseurl'] = COHERE_BASE_URL;
  }
  const response = await fetch(`${WEAVIATE_URL}${path}`, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Weaviate ${method} ${path} failed with ${response.status}: ${body}`);
  }
  const textBody = await response.text();
  return textBody ? JSON.parse(textBody) : {};
}

async function getCollectionSchema(className = CLASS_NAME, force = false) {
  const now = Date.now();
  const cached = collectionSchemaCache.get(className);
  const cachedAt = collectionSchemaCachedAt.get(className) || 0;
  if (!force && cached && now - cachedAt < COLLECTION_SCHEMA_TTL_MS) {
    return cached;
  }
  try {
    const schema = await weaviateJson('GET', `/v1/schema/${className}`);
    collectionSchemaCache.set(className, schema);
    collectionSchemaCachedAt.set(className, now);
    return schema;
  } catch (error) {
    console.error(`[streetbot-rag] failed to load ${className} schema: ${error.message}`);
    collectionSchemaCache.delete(className);
    collectionSchemaCachedAt.delete(className);
    return null;
  }
}

async function availableTargetVectors(className = CLASS_NAME) {
  const schema = await getCollectionSchema(className);
  const vectorConfig = schema?.vectorConfig;
  if (!vectorConfig || typeof vectorConfig !== 'object') {
    return [];
  }
  return Object.keys(vectorConfig);
}

function preferredTargetVectors(args, operatorQuery = args?.query || '') {
  const looksKeyword = looksKeywordStyleQuery(operatorQuery);
  const locationAware = Boolean(
    args?.city || args?.province || args?.ages_served || args?.gender_served,
  );
  const structured = hasStructuredFilters(args || {});
  if (looksKeyword) {
    return uniqueStrings([
      'service_identity',
      locationAware || structured ? 'service_access' : '',
      'service_content',
    ]);
  }
  return uniqueStrings([
    'service_content',
    'service_identity',
    locationAware || structured ? 'service_access' : '',
  ]);
}

async function resolveTargetVectors(args, operatorQuery = args?.query || '') {
  const available = await availableTargetVectors(CLASS_NAME);
  if (!available.length) {
    return [];
  }
  const preferred = preferredTargetVectors(args, operatorQuery);
  const availableSet = new Set(available);
  const selected = preferred.filter((name) => availableSet.has(name));
  return selected.length
    ? selected
    : NAMED_VECTOR_PRIORITY.filter((name) => availableSet.has(name));
}

function preferredChunkTargetVectors(args, operatorQuery = args?.query || '') {
  const looksKeyword = looksKeywordStyleQuery(operatorQuery);
  const locationAware = Boolean(
    args?.city || args?.province || args?.ages_served || args?.gender_served,
  );
  const structured = hasStructuredFilters(args || {});
  if (looksKeyword) {
    return uniqueStrings([
      'chunk_identity',
      locationAware || structured ? 'chunk_access' : '',
      'chunk_content',
    ]);
  }
  return uniqueStrings([
    'chunk_content',
    'chunk_identity',
    locationAware || structured ? 'chunk_access' : '',
  ]);
}

async function resolveChunkTargetVectors(args, operatorQuery = args?.query || '') {
  const available = await availableTargetVectors(CHUNK_CLASS_NAME);
  if (!available.length) {
    return [];
  }
  const preferred = preferredChunkTargetVectors(args, operatorQuery);
  const availableSet = new Set(available);
  const selected = preferred.filter((name) => availableSet.has(name));
  return selected.length
    ? selected
    : CHUNK_NAMED_VECTOR_PRIORITY.filter((name) => availableSet.has(name));
}

async function graphqlGet(query, className = CLASS_NAME) {
  const payload = await weaviateJson('POST', '/v1/graphql', { query });
  if (Array.isArray(payload?.errors) && payload.errors.length) {
    throw new Error(payload.errors.map((error) => error?.message || 'GraphQL error').join('; '));
  }
  return payload?.data?.Get?.[className] || [];
}

function graphqlList(values = []) {
  return `[${values.map((value) => JSON.stringify(value)).join(',')}]`;
}

function filterTerms(value) {
  return uniqueStrings(queryTerms(value).filter((term) => !INTENT_PRECISION_STOP_WORDS.has(term)));
}

function textFilterOperand(field, value) {
  const terms = filterTerms(value);
  if (!terms.length) {
    return '';
  }
  const operator = terms.length > 1 ? 'ContainsAll' : 'ContainsAny';
  return `{path:[${JSON.stringify(field)}],operator:${operator},valueText:${graphqlList(terms)}}`;
}

function textFilterGroup(field, values = []) {
  const operands = values.map((value) => textFilterOperand(field, value)).filter(Boolean);
  if (!operands.length) {
    return '';
  }
  if (operands.length === 1) {
    return operands[0];
  }
  return `{operator:Or,operands:[${operands.join(',')}]}`;
}

function whereClause(args) {
  const operands = [];
  if (args.active_only) {
    operands.push('{path:["isActive"],operator:Equal,valueBoolean:true}');
  }
  if (args.city) {
    operands.push(`{path:["city"],operator:Equal,valueText:${JSON.stringify(args.city)}}`);
  }
  if (args.province) {
    operands.push(`{path:["province"],operator:Equal,valueText:${JSON.stringify(args.province)}}`);
  }
  if (args.service_type) {
    const operand = textFilterGroup('serviceType', [args.service_type]);
    if (operand) operands.push(operand);
  }
  if (args.tags?.length) {
    const operand = textFilterGroup('tagsText', args.tags);
    if (operand) operands.push(operand);
  }
  if (args.categories?.length) {
    const operand = textFilterGroup('categoryNamesText', args.categories);
    if (operand) operands.push(operand);
  }
  if (args.ages_served) {
    const operand = textFilterGroup('agesServed', [args.ages_served]);
    if (operand) operands.push(operand);
  }
  if (args.gender_served) {
    const operand = textFilterGroup('genderServed', [args.gender_served]);
    if (operand) operands.push(operand);
  }
  if (!operands.length) {
    return '';
  }
  if (operands.length === 1) {
    return ` where:${operands[0]}`;
  }
  return ` where:{operator:And,operands:[${operands.join(',')}]}`;
}

function serviceIdWhereOperand(serviceId = '') {
  const serviceIds = uniqueStrings(
    (Array.isArray(serviceId) ? serviceId : [serviceId]).filter(Boolean),
  );
  if (!serviceIds.length) {
    return '';
  }
  const operands = serviceIds.map(
    (value) => `{path:["serviceId"],operator:Equal,valueText:${JSON.stringify(value)}}`,
  );
  if (operands.length === 1) {
    return operands[0];
  }
  return `{operator:Or,operands:[${operands.join(',')}]}`;
}

function chunkWhereClause(args, serviceId = '') {
  const operands = [];
  if (args?.active_only ?? true) {
    operands.push('{path:["isActive"],operator:Equal,valueBoolean:true}');
  }
  const serviceOperand = serviceIdWhereOperand(serviceId);
  if (serviceOperand) {
    operands.push(serviceOperand);
  }
  if (args?.city) {
    operands.push(`{path:["city"],operator:Equal,valueText:${JSON.stringify(args.city)}}`);
  }
  if (args?.province) {
    operands.push(`{path:["province"],operator:Equal,valueText:${JSON.stringify(args.province)}}`);
  }
  if (args?.service_type) {
    const operand = textFilterGroup('serviceType', [args.service_type]);
    if (operand) operands.push(operand);
  }
  if (args?.tags?.length) {
    const operand = textFilterGroup('tagsText', args.tags);
    if (operand) operands.push(operand);
  }
  if (args?.categories?.length) {
    const operand = textFilterGroup('categoryNamesText', args.categories);
    if (operand) operands.push(operand);
  }
  if (args?.ages_served) {
    const operand = textFilterGroup('agesServed', [args.ages_served]);
    if (operand) operands.push(operand);
  }
  if (args?.gender_served) {
    const operand = textFilterGroup('genderServed', [args.gender_served]);
    if (operand) operands.push(operand);
  }
  if (!operands.length) {
    return '';
  }
  if (operands.length === 1) {
    return ` where:${operands[0]}`;
  }
  return ` where:{operator:And,operands:[${operands.join(',')}]}`;
}

function targetVectorsClause(targetVectors = []) {
  return targetVectors.length ? `,targetVectors:${JSON.stringify(targetVectors)}` : '';
}

function buildSearchQuery({
  className = CLASS_NAME,
  query,
  fetchLimit,
  where = '',
  operatorQuery = query,
  targetVectors = [],
  searchFields = buildSearchFields(operatorQuery),
  queryProperties = SEARCH_QUERY_PROPERTIES,
  alpha = looksKeywordStyleQuery(operatorQuery) ? 0.35 : 0.55,
}) {
  return `{Get{${className}(hybrid:{query:${JSON.stringify(query)},alpha:${alpha},properties:${JSON.stringify(queryProperties)}${targetVectorsClause(targetVectors)}${bm25SearchOperatorClause(operatorQuery, true)}}${where} limit:${fetchLimit}){${searchFields}}}}`;
}

function buildNearTextQuery({
  className = CLASS_NAME,
  query,
  fetchLimit,
  where = '',
  targetVectors = [],
  searchFields = buildSearchFields(query),
}) {
  const semanticTargets = targetVectors.length ? [targetVectors[0]] : [];
  return `{Get{${className}(nearText:{concepts:[${JSON.stringify(query)}]${targetVectorsClause(semanticTargets)}}${where} limit:${fetchLimit}){${searchFields}}}}`;
}

function buildBm25Query({
  className = CLASS_NAME,
  query,
  fetchLimit,
  where = '',
  operatorQuery = query,
  searchFields = buildSearchFields(operatorQuery),
  queryProperties = SEARCH_QUERY_PROPERTIES,
}) {
  return `{Get{${className}(bm25:{query:${JSON.stringify(query)} properties:${JSON.stringify(queryProperties)}${bm25SearchOperatorClause(operatorQuery, false)}}${where} limit:${fetchLimit}){${searchFields}}}}`;
}

function whereQuery(pathField, value, fields = DETAIL_FIELDS, className = CLASS_NAME) {
  return `{Get{${className}(where:{path:[${JSON.stringify(pathField)}],operator:Equal,valueText:${JSON.stringify(value)}}){${fields}}}}`;
}

function looksKeywordStyleQuery(query) {
  const terms = rawQueryTerms(query);
  if (!terms.length || terms.length > 4) {
    return false;
  }
  return !terms.some((term) => QUERY_STOP_WORDS.has(term));
}

function bm25SearchOperatorClause(query, hybrid = false) {
  const terms = queryTerms(query);
  if (terms.length < 2) {
    return '';
  }
  const minimumOrTokensMatch = Math.min(2, terms.length);
  const key = hybrid ? 'bm25SearchOperator' : 'searchOperator';
  return `,${key}:{operator:Or,minimumOrTokensMatch:${minimumOrTokensMatch}}`;
}

function resolveSearchMode(requestedMode, query) {
  const normalized = text(requestedMode).toLowerCase();
  if (normalized === 'hybrid' || normalized === 'keyword' || normalized === 'semantic') {
    return normalized;
  }
  return looksKeywordStyleQuery(query) ? 'keyword' : 'hybrid';
}

async function fetchSearchCandidates(
  query,
  fetchLimit,
  requestedMode = 'auto',
  where = '',
  operatorQuery = query,
  targetVectors = [],
  queryProperties = SEARCH_QUERY_PROPERTIES,
  alpha = looksKeywordStyleQuery(operatorQuery) ? 0.35 : 0.55,
) {
  const mode = resolveSearchMode(requestedMode, operatorQuery);
  const order =
    mode === 'keyword'
      ? ['keyword', 'hybrid', 'semantic']
      : mode === 'semantic'
        ? ['semantic']
        : ['hybrid', 'keyword', 'semantic'];

  let lastError = null;
  for (const currentMode of order) {
    try {
      if (currentMode === 'keyword') {
        const items = await graphqlGet(
          buildBm25Query({ query, fetchLimit, where, operatorQuery, queryProperties }),
          CLASS_NAME,
        );
        if (items.length || currentMode === order[order.length - 1]) {
          return { mode: currentMode, items };
        }
        continue;
      }
      if (currentMode === 'semantic') {
        const items = await graphqlGet(
          buildNearTextQuery({ query, fetchLimit, where, targetVectors }),
          CLASS_NAME,
        );
        if (items.length || currentMode === order[order.length - 1]) {
          return { mode: currentMode, items };
        }
        continue;
      }
      const items = await graphqlGet(
        buildSearchQuery({
          query,
          fetchLimit,
          where,
          operatorQuery,
          targetVectors,
          queryProperties,
          alpha,
        }),
        CLASS_NAME,
      );
      if (items.length || currentMode === order[order.length - 1]) {
        return { mode: currentMode, items };
      }
    } catch (error) {
      lastError = error;
      console.error(
        `[streetbot-rag] ${currentMode} search failed, trying fallback: ${error.message}`,
      );
    }
  }
  throw lastError || new Error('Weaviate search failed');
}

async function fetchChunkCandidates(
  query,
  fetchLimit,
  requestedMode = 'auto',
  where = '',
  operatorQuery = query,
  targetVectors = [],
  queryProperties = CHUNK_QUERY_PROPERTIES,
  alpha = looksKeywordStyleQuery(operatorQuery) ? 0.35 : 0.55,
) {
  const mode = resolveSearchMode(requestedMode, operatorQuery);
  const order =
    mode === 'keyword'
      ? ['keyword', 'hybrid', 'semantic']
      : mode === 'semantic'
        ? ['semantic']
        : ['hybrid', 'keyword', 'semantic'];

  let lastError = null;
  for (const currentMode of order) {
    try {
      if (currentMode === 'keyword') {
        const items = await graphqlGet(
          buildBm25Query({
            className: CHUNK_CLASS_NAME,
            query,
            fetchLimit,
            where,
            operatorQuery,
            searchFields: buildChunkFields(operatorQuery),
            queryProperties,
          }),
          CHUNK_CLASS_NAME,
        );
        if (items.length || currentMode === order[order.length - 1]) {
          return { mode: currentMode, items };
        }
        continue;
      }
      if (currentMode === 'semantic') {
        const items = await graphqlGet(
          buildNearTextQuery({
            className: CHUNK_CLASS_NAME,
            query,
            fetchLimit,
            where,
            targetVectors,
            searchFields: buildChunkFields(query),
          }),
          CHUNK_CLASS_NAME,
        );
        if (items.length || currentMode === order[order.length - 1]) {
          return { mode: currentMode, items };
        }
        continue;
      }
      const items = await graphqlGet(
        buildSearchQuery({
          className: CHUNK_CLASS_NAME,
          query,
          fetchLimit,
          where,
          operatorQuery,
          targetVectors,
          searchFields: buildChunkFields(operatorQuery),
          queryProperties,
          alpha,
        }),
        CHUNK_CLASS_NAME,
      );
      if (items.length || currentMode === order[order.length - 1]) {
        return { mode: currentMode, items };
      }
    } catch (error) {
      lastError = error;
      console.error(
        `[streetbot-rag] ${currentMode} chunk search failed, trying fallback: ${error.message}`,
      );
    }
  }
  throw lastError || new Error('Weaviate chunk search failed');
}

function normalizeArgs(rawArgs = {}) {
  const userContext =
    rawArgs.user_context && typeof rawArgs.user_context === 'object' ? rawArgs.user_context : {};
  const categoryValues = uniqueStrings([
    ...toList(rawArgs.category),
    ...toList(rawArgs.categories),
  ]);
  const needs = uniqueStrings(toList(userContext.needs));
  const languages = uniqueStrings(toList(userContext.languages));
  const latitude = finiteNumber(
    rawArgs.latitude ?? userContext.latitude ?? userContext.preferred_latitude,
  );
  const longitude = finiteNumber(
    rawArgs.longitude ?? userContext.longitude ?? userContext.preferred_longitude,
  );
  return {
    query: text(rawArgs.query),
    session_id: text(rawArgs.session_id),
    limit: clampNumber(rawArgs.limit, DEFAULT_LIMIT, 1, MAX_LIMIT),
    offset: clampNumber(rawArgs.offset, 0, 0, 10_000),
    mode: text(rawArgs.mode || 'auto'),
    city: text(rawArgs.city || userContext.preferred_city),
    province: text(rawArgs.province || userContext.preferred_province),
    latitude,
    longitude,
    service_type: text(rawArgs.service_type),
    categories: categoryValues,
    tags: uniqueStrings(toList(rawArgs.tags)),
    ages_served: text(rawArgs.ages_served || userContext.ages),
    gender_served: text(rawArgs.gender_served || userContext.gender),
    active_only: boolValue(rawArgs.active_only, true),
    debug_rank: boolValue(rawArgs.debug_rank, false),
    needs,
    languages,
    user_context: userContext,
  };
}

function effectiveSearchText(args) {
  const plan = args.retrieval_plan || buildRetrievalPlan(args);
  return text(plan.expanded_query || args.query);
}

function searchTermsForArgs(args) {
  const intent = serviceIntentProfile(args.query);
  const expanded = [
    ...queryTerms(args.query),
    ...queryTerms(intent.categories.join(' ')),
    ...queryTerms(intent.serviceTypes.join(' ')),
    ...queryTerms(intent.tags.join(' ')),
  ];
  for (const need of args.needs || []) {
    expanded.push(...queryTerms(need));
  }
  for (const language of args.languages || []) {
    expanded.push(...queryTerms(language));
  }
  return uniqueStrings(expanded);
}

function intentAnchorTerms(args) {
  const intent = serviceIntentProfile(args.query);
  const anchors = uniqueStrings([
    ...queryTerms(intent.categories.join(' ')),
    ...queryTerms(intent.serviceTypes.join(' ')),
    ...queryTerms(intent.tags.join(' ')),
    ...args.categories.flatMap((value) => queryTerms(value)),
    ...queryTerms(args.service_type),
    ...args.tags.flatMap((value) => queryTerms(value)),
  ]).filter((term) => !INTENT_PRECISION_STOP_WORDS.has(term));

  return anchors.length
    ? anchors
    : searchTermsForArgs(args).filter((term) => !INTENT_PRECISION_STOP_WORDS.has(term));
}

function hasMeaningfulServiceQuery(query) {
  const terms = queryTerms(query);
  if (!terms.length) {
    return false;
  }

  const intent = serviceIntentProfile(query);
  if (
    intent.families.length ||
    intent.categories.length ||
    intent.serviceTypes.length ||
    intent.tags.length
  ) {
    return true;
  }

  return terms.some((term) => !LOW_SIGNAL_META_QUERY_TERMS.has(term));
}

function hasStructuredFilters(args) {
  return Boolean(
    (args?.tags || []).length ||
      (args?.categories || []).length ||
      args?.service_type ||
      args?.ages_served ||
      args?.gender_served,
  );
}

async function searchChunkEvidence(args, queryText) {
  const retrievalPlan = args.retrieval_plan || buildRetrievalPlan(args);
  const targetVectors = (retrievalPlan.chunk_target_vectors || []).length
    ? retrievalPlan.chunk_target_vectors
    : await resolveChunkTargetVectors(args, args.query);
  const result = await fetchChunkCandidates(
    queryText,
    Math.min(
      MAX_FETCH_LIMIT,
      Math.max(MAX_CHUNK_RESULTS, args.limit * Number(retrievalPlan.chunk_fetch_multiplier || 8)),
    ),
    args.mode,
    chunkWhereClause(args),
    args.query,
    targetVectors,
    retrievalPlan.chunk_query_properties || CHUNK_QUERY_PROPERTIES,
    Number(retrievalPlan.hybrid_alpha || 0.55),
  );
  return {
    retrieval_mode: result.mode,
    evidence: buildChunkEvidenceMap(result.items, args),
  };
}

function buildRelaxedSearchStages(args) {
  const stages = [];
  const seen = new Set();
  const attributeDrops = ['tags', 'categories', 'service_type', 'ages_served', 'gender_served'];
  const attributeRelaxedArgs = {
    ...args,
    tags: [],
    categories: [],
    service_type: '',
    ages_served: '',
    gender_served: '',
  };

  const addStage = (stageArgs, droppedFilters) => {
    const key = JSON.stringify({
      city: stageArgs.city || '',
      province: stageArgs.province || '',
      service_type: stageArgs.service_type || '',
      tags: stageArgs.tags || [],
      categories: stageArgs.categories || [],
      ages_served: stageArgs.ages_served || '',
      gender_served: stageArgs.gender_served || '',
    });
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    stages.push({
      args: stageArgs,
      dropped_filters: droppedFilters,
    });
  };

  if (args.city) {
    addStage({ ...args, city: '' }, ['city']);
  }
  if (args.province) {
    addStage({ ...args, city: '', province: '' }, args.city ? ['city', 'province'] : ['province']);
  }
  if (hasStructuredFilters(args)) {
    addStage(attributeRelaxedArgs, attributeDrops);
    if (args.city) {
      addStage({ ...attributeRelaxedArgs, city: '' }, ['city', ...attributeDrops]);
    }
    addStage(
      { ...attributeRelaxedArgs, city: '', province: '' },
      args.city ? ['city', 'province', ...attributeDrops] : ['province', ...attributeDrops],
    );
  }

  return stages;
}

function itemMatches(item, args) {
  if (args.active_only && !item.is_active) return false;
  if (args.city && !normalizeText(item.city).includes(normalizeText(args.city))) return false;
  if (args.province && !normalizeText(item.province).includes(normalizeText(args.province)))
    return false;
  if (
    args.service_type &&
    !normalizeText(item.service_type).includes(normalizeText(args.service_type))
  )
    return false;
  if (
    args.ages_served &&
    !normalizeText(item.ages_served).includes(normalizeText(args.ages_served))
  )
    return false;
  if (
    args.gender_served &&
    !normalizeText(item.gender_served).includes(normalizeText(args.gender_served))
  )
    return false;

  const tagCorpus = normalizeText(item.tags.join(' '));
  const categoryCorpus = normalizeText(item.category_names.join(' '));
  for (const tag of args.tags) {
    if (!tagCorpus.includes(normalizeText(tag))) return false;
  }
  for (const category of args.categories) {
    if (!categoryCorpus.includes(normalizeText(category))) return false;
  }
  return true;
}

async function executeRankedSearch(args, options = {}) {
  const skipChunkEvidence = Boolean(options?.skipChunkEvidence);
  const retrievalPlan = buildRetrievalPlan(args);
  const plannedArgs = { ...args, retrieval_plan: retrievalPlan };
  const fetchLimit = Math.min(
    MAX_FETCH_LIMIT,
    Math.max((args.limit + args.offset) * Number(retrievalPlan.fetch_multiplier || 10), 60),
  );
  const targetVectors = (retrievalPlan.service_target_vectors || []).length
    ? retrievalPlan.service_target_vectors
    : await resolveTargetVectors(args, args.query);
  const searchText = effectiveSearchText(plannedArgs);
  const resultPromise = fetchSearchCandidates(
    searchText,
    fetchLimit,
    args.mode,
    whereClause(args),
    args.query,
    targetVectors,
    retrievalPlan.service_query_properties || SEARCH_QUERY_PROPERTIES,
    Number(retrievalPlan.hybrid_alpha || 0.55),
  );
  const chunkEvidencePromise = skipChunkEvidence
    ? Promise.resolve({ retrieval_mode: null, evidence: new Map() })
    : searchChunkEvidence(plannedArgs, searchText).catch((error) => {
        console.error(`[streetbot-rag] chunk evidence fallback: ${error.message}`);
        return { retrieval_mode: null, evidence: new Map() };
      });
  const [result, chunkEvidence] = await Promise.all([resultPromise, chunkEvidencePromise]);
  const rawItems = result.items;
  const intentPriors = retrievalPlan.intent?.priors || serviceIntentProfile(args.query).priors;
  const filtered = rawItems
    .map(normalizeServiceItem)
    .map((item) => {
      const evidence = chunkEvidence.evidence.get(item.service_id) || null;
      return evidence ? { ...item, ...evidence } : item;
    })
    .filter((item) => itemMatches(item, args))
    .map((item) => {
      const matchedNeedFamilies = serviceItemFamilyHits(item, intentPriors);
      return {
        ...item,
        match_reasons: buildMatchReasons(item, args),
        _intent_family_hits: matchedNeedFamilies,
        matched_need_families: matchedNeedFamilies,
        _term_matches: termMatchCount(item, args),
        _ranking: scoreItem(item, args),
        _geo_distance_km: geographicDistanceKm(args, item),
      };
    })
    .sort((left, right) => right._ranking - left._ranking);

  const lexicalFiltered =
    result.mode === 'keyword'
      ? filtered.filter((item) => Number(item._term_matches || 0) > 0)
      : filtered;
  const ranked = sortRankedCandidates(
    (lexicalFiltered.length ? lexicalFiltered : filtered).map((item) => {
      const enriched = {
        ...item,
        _geo_distance_km: geographicDistanceKm(args, item),
        _geo_band: geographicBandForItem(args, item),
        _backfill_precision: universalPrecisionScore(item, args),
      };
      if (plannedArgs.debug_rank) {
        enriched.rank_debug = buildRankDebug(enriched, plannedArgs);
      }
      return enriched;
    }),
    plannedArgs,
  );
  const dedupedRanked = dedupeRankedItems(ranked);
  const hydratedRanked = skipChunkEvidence
    ? dedupedRanked
    : await hydrateChunkEvidenceForRankedItems(dedupedRanked, plannedArgs);

  return {
    ranked: dedupeRankedItems(hydratedRanked),
    retrieval_mode: result.mode,
    chunk_retrieval_mode: chunkEvidence.retrieval_mode,
    base_url: WEAVIATE_URL,
    retrieval_plan: retrievalPlan,
  };
}

function buildSearchPayload(args, ranked, meta = {}, relaxed = null) {
  const retrievalPlan = meta.retrieval_plan || args.retrieval_plan || buildRetrievalPlan(args);
  const pageLimitTotal = Math.max(
    1,
    Number(retrievalPlan.page_limit_total || args.limit || DEFAULT_LIMIT),
  );
  const pageItems = selectGroupedPageItems(ranked, retrievalPlan, args.offset, pageLimitTotal);
  const sliced = pageItems.map(stripRankedItem);
  const groupedNeedResults = publicNeedGroups(pageItems, retrievalPlan);
  return {
    ok: true,
    query: args.query,
    count: ranked.length,
    requested_limit: args.limit,
    page_limit_total: pageLimitTotal,
    family_quota: Number(retrievalPlan.family_quota || 0),
    returned_count: sliced.length,
    has_more: ranked.length > args.offset + pageLimitTotal,
    offset: args.offset,
    city: args.city || null,
    province: args.province || null,
    latitude: args.latitude ?? null,
    longitude: args.longitude ?? null,
    service_type: args.service_type || null,
    tags: args.tags,
    categories: args.categories,
    ages_served: args.ages_served || null,
    gender_served: args.gender_served || null,
    active_only: args.active_only,
    class: CLASS_NAME,
    base_url: meta.base_url || WEAVIATE_URL,
    mode: args.mode || 'auto',
    retrieval_mode: meta.retrieval_mode || args.mode || 'auto',
    chunk_retrieval_mode: meta.chunk_retrieval_mode || null,
    relaxed,
    intent_families: serviceIntentProfile(args.query).families,
    need_family_summary: needFamilySummary(sliced),
    need_groups: groupedNeedResults,
    query_properties: [...(retrievalPlan.service_query_properties || SEARCH_QUERY_PROPERTIES)],
    retrieval_plan: publicRetrievalPlan(retrievalPlan),
    group_results_by_need: groupedNeedResults.length >= 2,
    items: sliced,
  };
}

async function executeSearch(args, relaxed = null) {
  const search = await executeRankedSearch(args);
  return buildSearchPayload(args, search.ranked, search, relaxed);
}

async function searchServicesInternal(rawArgs) {
  const args = normalizeArgs(rawArgs);
  if (!args.query) {
    throw new Error('query is required');
  }
  if (!hasMeaningfulServiceQuery(args.query)) {
    const facets = await categoriesInternal({
      limit: Math.max(8, Math.min(args.limit || 8, 12)),
      active_only: args.active_only,
      city: args.city,
      province: args.province,
      service_type: args.service_type,
      categories: args.categories,
      tags: args.tags,
      ages_served: args.ages_served,
      gender_served: args.gender_served,
    });
    return {
      ok: true,
      browse: true,
      query: args.query,
      message: `I can help with that. Tell me what kind of service you want${args.city ? ` in ${args.city}` : args.province ? ` in ${args.province}` : ''}, like ${
        (facets.category_facets || [])
          .slice(0, 5)
          .map((entry) => entry?.value)
          .filter(Boolean)
          .join(', ') || 'housing, food, health, legal, or employment'
      }.`,
      count: 0,
      requested_limit: args.limit,
      returned_count: 0,
      has_more: false,
      offset: args.offset,
      city: args.city || null,
      province: args.province || null,
      service_type: args.service_type || null,
      tags: args.tags,
      categories: args.categories,
      ages_served: args.ages_served || null,
      gender_served: args.gender_served || null,
      active_only: args.active_only,
      class: CLASS_NAME,
      base_url: WEAVIATE_URL,
      mode: 'browse',
      retrieval_mode: 'browse',
      relaxed: null,
      items: [],
      facets: {
        city_facets: facets.city_facets || [],
        service_type_facets: facets.service_type_facets || [],
        category_facets: facets.category_facets || [],
        tag_facets: facets.tag_facets || [],
      },
    };
  }

  const primarySearch = await executeRankedSearch(args);
  const localCount = primarySearch.ranked.length;
  let ranked = primarySearch.ranked;
  let retrievalMode = primarySearch.retrieval_mode;
  let chunkRetrievalMode = primarySearch.chunk_retrieval_mode;
  let relaxed = null;

  if (ranked.length < args.limit) {
    const droppedFilters = new Set();
    for (const stage of buildRelaxedSearchStages(args)) {
      if (ranked.length >= args.limit) {
        break;
      }
      const stageSearch = await executeRankedSearch(stage.args, { skipChunkEvidence: true });
      const refinedStageRanked = refineBackfillCandidates(stageSearch.ranked, args);
      const merged = mergeRankedItems(ranked, refinedStageRanked);
      if (merged.length === ranked.length) {
        continue;
      }
      ranked = merged;
      for (const filterName of stage.dropped_filters) {
        droppedFilters.add(filterName);
      }
      if (!primarySearch.ranked.length && stageSearch.ranked.length) {
        retrievalMode = stageSearch.retrieval_mode;
        chunkRetrievalMode = stageSearch.chunk_retrieval_mode;
      }
    }

    if (ranked.some((item) => !hasChunkEvidence(item))) {
      ranked = await hydrateChunkEvidenceForRankedItems(dedupeRankedItems(ranked), args);
    }

    const broaderCount = Math.max(0, ranked.length - localCount);
    if (droppedFilters.size || broaderCount > 0) {
      relaxed = {
        dropped_filters: Array.from(droppedFilters),
        ...(broaderCount > 0
          ? {
              backfilled: true,
              local_count: localCount,
              broader_count: broaderCount,
            }
          : {}),
      };
    }
  }

  const payload = buildSearchPayload(
    args,
    ranked,
    {
      retrieval_mode: retrievalMode,
      chunk_retrieval_mode: chunkRetrievalMode,
      base_url: WEAVIATE_URL,
    },
    relaxed,
  );

  const sessionId =
    args.session_id ||
    crypto
      .createHash('sha1')
      .update(
        JSON.stringify({
          query: args.query,
          city: args.city,
          province: args.province,
          latitude: args.latitude,
          longitude: args.longitude,
          service_type: args.service_type,
          categories: args.categories,
          tags: args.tags,
          at: Date.now(),
        }),
      )
      .digest('hex')
      .slice(0, 12);

  paginationState.set(sessionId, {
    ...args,
    offset: args.offset + Number(payload.page_limit_total || payload.returned_count || args.limit),
  });

  return {
    ...payload,
    session_id: sessionId,
  };
}

async function buildMoreResults(sessionId, overrideLimit = null, overrideArgs = null) {
  const resolvedSessionId =
    text(sessionId) ||
    (paginationState.size === 1 ? Array.from(paginationState.keys())[0] : DEFAULT_SESSION_ID);
  const state = paginationState.get(resolvedSessionId);
  if (!state || !state.query) {
    return {
      ok: false,
      session_id: resolvedSessionId,
      message: 'No previous Street Bot service search is available for more results yet.',
      items: [],
      count: 0,
      returned_count: 0,
      has_more: false,
    };
  }

  const pageLimit =
    overrideLimit == null
      ? clampNumber(state.limit, DEFAULT_LIMIT, 1, MAX_LIMIT)
      : clampNumber(overrideLimit, state.limit, 1, MAX_LIMIT);
  const nextSearchArgs = {
    ...state,
    ...(overrideArgs && typeof overrideArgs === 'object' ? overrideArgs : {}),
    session_id: resolvedSessionId,
    offset: state.offset,
    limit: pageLimit,
  };
  const payload = await searchServicesInternal(nextSearchArgs);
  paginationState.set(resolvedSessionId, {
    ...nextSearchArgs,
    limit: pageLimit,
    offset: state.offset + Number(payload.page_limit_total || payload.returned_count || pageLimit),
  });
  return payload;
}

async function fetchObjectById(objectId) {
  try {
    const payload = await weaviateJson(
      'GET',
      `/v1/objects/${encodeURIComponent(objectId)}?include=vector=false`,
    );
    if (!payload?.properties) return null;
    return normalizeServiceItem({
      ...payload.properties,
      _additional: { id: payload.id },
    });
  } catch (error) {
    if (String(error.message || '').includes('404')) {
      return null;
    }
    throw error;
  }
}

async function fetchChunksForService(
  serviceId,
  { query = '', active_only = true, limit = 5 } = {},
) {
  const grouped = await fetchChunksForServices([serviceId], { query, active_only, limit });
  return grouped.get(serviceId) || [];
}

async function fetchChunksForServicesDirect(
  serviceIds,
  { query = '', active_only = true, limit = 5 } = {},
) {
  const resolvedLimit = clampNumber(limit, 5, 1, MAX_CHUNK_DOCUMENTS);
  const normalizedServiceIds = uniqueStrings((serviceIds || []).filter(Boolean));
  if (!normalizedServiceIds.length) {
    return new Map();
  }
  const baseArgs = {
    query,
    city: '',
    province: '',
    service_type: '',
    tags: [],
    categories: [],
    ages_served: '',
    gender_served: '',
    active_only,
    mode: 'auto',
  };
  const items = await graphqlGet(
    `{Get{${CHUNK_CLASS_NAME}(${chunkWhereClause(baseArgs, normalizedServiceIds)} limit:${Math.max(
      resolvedLimit * normalizedServiceIds.length * 4,
      resolvedLimit,
    )}){${buildChunkFields('')}}}}`,
    CHUNK_CLASS_NAME,
  );
  const serviceIdSet = new Set(normalizedServiceIds);
  const grouped = new Map(normalizedServiceIds.map((id) => [id, []]));
  items
    .map(normalizeChunkItem)
    .filter((item) => serviceIdSet.has(item.service_id) && (!active_only || item.is_active))
    .map((item) => ({
      ...item,
      _chunk_score: scoreChunkItem(item, { ...baseArgs, query }),
    }))
    .forEach((item) => {
      grouped.get(item.service_id)?.push(item);
    });
  for (const [id, chunkItems] of grouped.entries()) {
    grouped.set(
      id,
      chunkItems
        .sort((left, right) => Number(right._chunk_score || 0) - Number(left._chunk_score || 0))
        .slice(0, resolvedLimit)
        .map((item) => ({
          chunk_id: item.chunk_id,
          chunk_index: item.chunk_index,
          chunk_kind: item.chunk_kind,
          preview: chunkSnippet(item, { ...baseArgs, query }),
          text: item.chunk_text,
          score: item._chunk_score,
        })),
    );
  }
  return grouped;
}

async function fetchChunksForServices(
  serviceIds,
  { query = '', active_only = true, limit = 5 } = {},
) {
  const resolvedLimit = clampNumber(limit, 5, 1, MAX_CHUNK_DOCUMENTS);
  const normalizedServiceIds = uniqueStrings((serviceIds || []).filter(Boolean));
  if (!normalizedServiceIds.length) {
    return new Map();
  }
  const baseArgs = {
    query,
    city: '',
    province: '',
    service_type: '',
    tags: [],
    categories: [],
    ages_served: '',
    gender_served: '',
    active_only,
    mode: 'auto',
  };

  if (query && hasMeaningfulServiceQuery(query)) {
    const targetVectors = await resolveChunkTargetVectors(baseArgs, query);
    const result = await fetchChunkCandidates(
      query,
      Math.min(MAX_FETCH_LIMIT, Math.max(normalizedServiceIds.length * resolvedLimit * 4, 16)),
      'auto',
      chunkWhereClause(baseArgs, normalizedServiceIds),
      query,
      targetVectors,
    );
    const serviceIdSet = new Set(normalizedServiceIds);
    const grouped = new Map(normalizedServiceIds.map((id) => [id, []]));
    result.items
      .map(normalizeChunkItem)
      .filter((item) => serviceIdSet.has(item.service_id) && (!active_only || item.is_active))
      .map((item) => ({
        ...item,
        _chunk_score: scoreChunkItem(item, { ...baseArgs, query }),
      }))
      .forEach((item) => {
        grouped.get(item.service_id)?.push(item);
      });
    for (const [id, items] of grouped.entries()) {
      grouped.set(
        id,
        items
          .sort((left, right) => Number(right._chunk_score || 0) - Number(left._chunk_score || 0))
          .slice(0, resolvedLimit)
          .map((item) => ({
            chunk_id: item.chunk_id,
            chunk_index: item.chunk_index,
            chunk_kind: item.chunk_kind,
            preview: chunkSnippet(item, { ...baseArgs, query }),
            text: item.chunk_text,
            score: item._chunk_score,
          })),
      );
    }
    return grouped;
  }

  const items = await graphqlGet(
    `{Get{${CHUNK_CLASS_NAME}(${chunkWhereClause(baseArgs, normalizedServiceIds)} limit:${Math.max(
      resolvedLimit * normalizedServiceIds.length,
      resolvedLimit,
    )}){${buildChunkFields('')}}}}`,
    CHUNK_CLASS_NAME,
  );
  const serviceIdSet = new Set(normalizedServiceIds);
  const grouped = new Map(normalizedServiceIds.map((id) => [id, []]));
  items
    .map(normalizeChunkItem)
    .filter((item) => serviceIdSet.has(item.service_id) && (!active_only || item.is_active))
    .forEach((item) => {
      grouped.get(item.service_id)?.push(item);
    });
  for (const [id, chunkItems] of grouped.entries()) {
    grouped.set(
      id,
      chunkItems
        .sort((left, right) => Number(left.chunk_index || 0) - Number(right.chunk_index || 0))
        .slice(0, resolvedLimit)
        .map((item) => ({
          chunk_id: item.chunk_id,
          chunk_index: item.chunk_index,
          chunk_kind: item.chunk_kind,
          preview: truncateText(item.chunk_preview || item.chunk_text, CHUNK_SNIPPET_CHARS),
          text: item.chunk_text,
        })),
    );
  }
  return grouped;
}

async function inspectServiceInternal(rawArgs) {
  const ref = text(rawArgs.ref || rawArgs.service_id || rawArgs.id || rawArgs.slug || rawArgs.name);
  const query = text(rawArgs.query);
  const documentLimit = clampNumber(rawArgs.limit, 5, 1, MAX_CHUNK_DOCUMENTS);
  const activeOnly = boolValue(rawArgs.active_only, true);
  if (!ref) {
    throw new Error('ref is required');
  }

  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(ref)) {
    const objectItem = await fetchObjectById(ref);
    if (objectItem && (!activeOnly || objectItem.is_active)) {
      const documents = objectItem.service_id
        ? await fetchChunksForService(objectItem.service_id, {
            query,
            active_only: activeOnly,
            limit: documentLimit,
          })
        : [];
      return {
        ok: true,
        ref,
        match_type: 'object_id',
        base_url: WEAVIATE_URL,
        item: objectItem,
        documents,
        document_count: documents.length,
      };
    }
  }

  const exactQueries = [];
  if (/^\d+$/.test(ref)) exactQueries.push(['serviceId', ref]);
  exactQueries.push(['slug', ref], ['name', ref]);

  for (const [field, value] of exactQueries) {
    const items = await graphqlGet(whereQuery(field, value));
    if (!items.length) continue;
    const item = normalizeServiceItem(items[0]);
    if (activeOnly && !item.is_active) continue;
    const documents = item.service_id
      ? await fetchChunksForService(item.service_id, {
          query,
          active_only: activeOnly,
          limit: documentLimit,
        })
      : [];
    return {
      ok: true,
      ref,
      match_type: field,
      base_url: WEAVIATE_URL,
      item,
      documents,
      document_count: documents.length,
    };
  }

  const fallback = await searchServicesInternal({ query: ref, limit: 1, active_only: activeOnly });
  const item = fallback.items?.[0] || null;
  const documents = item?.service_id
    ? await fetchChunksForService(item.service_id, {
        query,
        active_only: activeOnly,
        limit: documentLimit,
      })
    : [];
  return {
    ok: Boolean(item),
    ref,
    match_type: item ? 'semantic' : null,
    base_url: WEAVIATE_URL,
    item,
    documents,
    document_count: documents.length,
  };
}

async function categoriesInternal(rawArgs) {
  const args = normalizeArgs(rawArgs);
  const limit = clampNumber(rawArgs.limit, 10, 1, 50);
  const activeOnly = boolValue(rawArgs.active_only, true);
  const items = await graphqlGet(
    `{Get{${CLASS_NAME}(limit:2000){serviceId city serviceType categoryNamesText tagsText agesServed genderServed isActive}}}`,
  );

  const cityCounts = new Map();
  const typeCounts = new Map();
  const categoryCounts = new Map();
  const tagCounts = new Map();
  let totalCount = 0;
  let activeCount = 0;

  for (const raw of items) {
    const item = normalizeServiceItem(raw);
    const isActive = raw?.isActive !== false;
    totalCount += 1;
    if (isActive) {
      activeCount += 1;
    }
    if (activeOnly && !isActive) continue;
    if (!itemMatches(item, args)) continue;

    const city = text(raw?.city);
    if (city) incrementFacetCount(cityCounts, city);
    const serviceType = text(raw?.serviceType);
    if (serviceType) incrementFacetCount(typeCounts, serviceType);
    for (const category of splitTextList(raw?.categoryNamesText)) {
      incrementFacetCount(categoryCounts, category);
    }
    for (const tag of splitTextList(raw?.tagsText)) {
      incrementFacetCount(tagCounts, tag);
    }
  }

  const top = (map) =>
    Array.from(map.values())
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
      .slice(0, limit)
      .map(({ value, count }) => ({ value, count }));

  return {
    ok: true,
    class: CLASS_NAME,
    base_url: WEAVIATE_URL,
    active_only: activeOnly,
    total_count: totalCount,
    active_count: activeCount,
    city_facets: top(cityCounts),
    service_type_facets: top(typeCounts),
    category_facets: top(categoryCounts),
    tag_facets: top(tagCounts),
  };
}

function stripSearchItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const stripped = { ...item };
    delete stripped.detail_text;
    return stripped;
  });
}

function wrapResponse(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const count = items.length || Number(payload?.count || payload?.returned_count || 0);
  return {
    content: [
      { type: 'text', text: `[INSTRUCTION] ${SEARCH_INSTRUCTION} Result count: ${count}.` },
      { type: 'text', text: JSON.stringify(payload, null, 2) },
    ],
  };
}

function wrapSearchResponse(payload) {
  const items = stripSearchItems(payload?.items);
  const count = Array.isArray(items) ? items.length : 0;
  return {
    content: [
      {
        type: 'text',
        text: `[INSTRUCTION] ${SEARCH_INSTRUCTION} Result count: ${count}, total available: ${payload?.count || count}.`,
      },
      {
        type: 'text',
        text: JSON.stringify({ ...payload, items }, null, 2),
      },
    ],
  };
}

async function main() {
  const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const { CallToolRequestSchema, ListToolsRequestSchema } = await import(
    '@modelcontextprotocol/sdk/types.js'
  );

  console.error(`[streetbot-rag] Weaviate URL: ${WEAVIATE_URL}`);

  const server = new Server(
    { name: 'streetbot-rag', version: '0.3.0-weaviate' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    if (!TOOL_DEFINITIONS.find((tool) => tool.name === name)) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const args = rawArgs && typeof rawArgs === 'object' ? rawArgs : {};
    console.error(`[streetbot-rag] tool_call name=${name} args=${JSON.stringify(args)}`);
    if (name === 'services_search') {
      return wrapSearchResponse(await searchServicesInternal(args));
    }
    if (name === 'services_more') {
      return wrapSearchResponse(
        await buildMoreResults(args.session_id, args.limit, args.fallback_search_args),
      );
    }
    if (name === 'services_documents') {
      return wrapResponse(await inspectServiceInternal(args));
    }
    if (name === 'services_categories') {
      return wrapResponse(await categoriesInternal(args));
    }

    throw new Error(`Unhandled tool: ${name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  main().catch((error) => {
    console.error('[streetbot-rag] fatal', error);
    process.exit(1);
  });
}

export {
  CLASS_NAME,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  SEARCH_INSTRUCTION,
  WEAVIATE_URL,
  buildMoreResults,
  buildSearchArgsFromUserText,
  categoriesInternal,
  inspectServiceInternal,
  searchServicesInternal,
};

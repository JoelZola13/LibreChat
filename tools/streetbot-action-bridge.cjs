const childProcess = require('child_process');
const fs = require('fs');
const pathLib = require('path');
const { logger } = require('@librechat/data-schemas');

let PgPool;
try {
  ({ Pool: PgPool } = require('pg'));
} catch (_) {
  PgPool = null;
}

const NANOBOT_BASES = [
  process.env.STREETBOT_ACTIONS_NANOBOT_URL,
  process.env.NANOBOT_LOCAL_API_BASE,
  'http://host.docker.internal:18790',
  'http://localhost:18790',
].filter(Boolean);

const SOCIAL_DB_URLS = [
  process.env.STREETBOT_ACTIONS_SOCIAL_DATABASE_URL,
  process.env.STREET_PROFILE_SOCIAL_DATABASE_URL,
  process.env.SV_SOCIAL_DATABASE_URL,
  process.env.SOCIAL_DATABASE_URL,
  'postgresql://social:social_password@nanobot-social-postgres:5432/social',
  'postgresql://social:social_password@localhost:5432/social',
].filter(Boolean);

let socialPool;
let socialPoolKey = '';

const DEFAULT_ACTION_STATE_DIR = fs.existsSync('/app')
  ? '/app/uploads/streetbot-actions'
  : pathLib.resolve(__dirname, '../uploads/streetbot-actions');
const GRANT_ACTION_STATE_DIR =
  process.env.STREETBOT_ACTION_STATE_DIR || DEFAULT_ACTION_STATE_DIR;
const GRANT_ACTION_STATE_FILE =
  process.env.STREETBOT_GRANT_WORKSPACE_FILE ||
  pathLib.join(GRANT_ACTION_STATE_DIR, 'grant-workspace.json');

const VALID_GRANT_STAGES = new Set([
  'identified',
  'evaluating',
  'pursuing',
  'drafting',
  'review',
  'submitted',
  'awarded',
  'declined',
  'active',
  'closed',
]);

const DEFAULT_GRANT_OPPORTUNITIES = [
  {
    id: 'yof-scale-2026',
    name: 'Youth Innovations Scale Grant',
    funder: 'Ontario Trillium Foundation',
    funderAbbrev: 'OTF',
    amount: 'Up to $150K/yr x 2-3 years',
    deadline: 'April 15, 2026 (EOI)',
    stage: 'identified',
    url: 'https://otf.ca/our-grants/youth-opportunities-fund/youth-innovations-scale-grant',
    assessment: { recommendation: 'pursue' },
    documents: { opportunity: true, narrative: false, budget: false, projectPlan: false },
  },
  {
    id: 'nba-foundation-2026',
    name: 'NBA Foundation Grant',
    funder: 'NBA Foundation',
    funderAbbrev: 'NBA',
    amount: 'Avg $250K (range $25K-$500K)',
    deadline: 'Rolling',
    stage: 'identified',
    url: 'https://nbafoundation.fluxx.io',
    assessment: { recommendation: 'pursue' },
    documents: { opportunity: true, narrative: false, budget: false, projectPlan: false },
  },
  {
    id: 'tgrip-extension',
    name: 'TGRIP - Organizational Capacity Development',
    funder: 'Toronto Grants',
    funderAbbrev: 'TGRIP',
    amount: 'Capacity-building stream',
    deadline: 'Pipeline active',
    stage: 'active',
    documents: { opportunity: true, narrative: true, budget: true, projectPlan: true },
  },
];

function required(value, name) {
  if (value === undefined || value === null || String(value).trim() === '') {
    const error = new Error(`${name} is required`);
    error.status = 400;
    throw error;
  }
  return value;
}

function omitUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

const ACTIONS = [
  {
    id: 'jobs.favorite',
    label: 'Save job',
    domain: 'jobs',
    agents: ['agent/job_search_agent', 'streetbot'],
    method: 'POST',
    path: ({ job_id, user_id }) =>
      `/jobs/${encodeURIComponent(required(job_id, 'job_id'))}/favorite?user_id=${encodeURIComponent(user_id)}`,
    required: ['job_id'],
    mutates: true,
    requiresConfirmation: false,
  },
  {
    id: 'jobs.unfavorite',
    label: 'Unsave job',
    domain: 'jobs',
    agents: ['agent/job_search_agent', 'streetbot'],
    method: 'DELETE',
    path: ({ job_id, user_id }) =>
      `/jobs/${encodeURIComponent(required(job_id, 'job_id'))}/favorite?user_id=${encodeURIComponent(user_id)}`,
    required: ['job_id'],
    mutates: true,
    requiresConfirmation: false,
  },
  {
    id: 'groups.send_message',
    label: 'Post group message',
    domain: 'groups',
    agents: ['agent/groups_agent', 'agent/street_profile_agent', 'streetbot'],
    method: 'POST',
    path: ({ group_id }) => `/groups/${encodeURIComponent(required(group_id, 'group_id'))}/messages`,
    body: ({ content, agents, user_id, user_name, user_email, user_avatar, agent }) => ({
      content: required(content, 'content'),
      agents: Array.isArray(agents) ? agents : undefined,
      user_id,
      user_name,
      user_email,
      user_avatar,
      agent,
      source: 'streetbot_action_bridge',
    }),
    required: ['group_id', 'content'],
    mutates: true,
    requiresConfirmation: true,
  },
  {
    id: 'gallery.favorite',
    label: 'Favorite artwork',
    domain: 'gallery',
    agents: ['agent/gallery_agent', 'streetbot'],
    method: 'POST',
    path: ({ artwork_id, user_id }) =>
      `/gallery/artworks/${encodeURIComponent(required(artwork_id, 'artwork_id'))}/favorites?user_id=${encodeURIComponent(user_id)}`,
    required: ['artwork_id'],
    mutates: true,
    requiresConfirmation: false,
  },
  {
    id: 'gallery.unfavorite',
    label: 'Unfavorite artwork',
    domain: 'gallery',
    agents: ['agent/gallery_agent', 'streetbot'],
    method: 'DELETE',
    path: ({ artwork_id, user_id }) =>
      `/gallery/artworks/${encodeURIComponent(required(artwork_id, 'artwork_id'))}/favorites?user_id=${encodeURIComponent(user_id)}`,
    required: ['artwork_id'],
    mutates: true,
    requiresConfirmation: false,
  },
  {
    id: 'gallery.comment',
    label: 'Comment on artwork',
    domain: 'gallery',
    agents: ['agent/gallery_agent', 'streetbot'],
    method: 'POST',
    path: () => '/gallery/comments',
    body: ({ artwork_id, body, parent_id, user_id, user_name, user_avatar }) => ({
      artwork_id: required(artwork_id, 'artwork_id'),
      body: required(body, 'body'),
      parent_id: parent_id || undefined,
      user_id,
      user_name,
      user_avatar,
    }),
    required: ['artwork_id', 'body'],
    mutates: true,
    requiresConfirmation: true,
  },
  {
    id: 'gallery.create_artwork',
    label: 'Create artwork',
    domain: 'gallery',
    agents: ['agent/gallery_agent', 'streetbot'],
    method: 'POST',
    path: () => '/gallery/artworks',
    body: ({ title, description, image_url, artist_id, artist_name, medium, style, tags }) => ({
      title: required(title, 'title'),
      description: description || '',
      image_url: image_url || '',
      artist_id,
      artist_name,
      medium: medium || '',
      style: style || '',
      tags: tags || '',
    }),
    required: ['title'],
    mutates: true,
    requiresConfirmation: true,
  },
  {
    id: 'gallery.update_artwork',
    label: 'Update artwork',
    domain: 'gallery',
    agents: ['agent/gallery_agent', 'streetbot'],
    method: 'PATCH',
    path: ({ artwork_id, user_id }) =>
      `/gallery/artworks/${encodeURIComponent(required(artwork_id, 'artwork_id'))}?user_id=${encodeURIComponent(user_id)}`,
    body: ({ price, is_for_sale, is_sold, currency }) =>
      omitUndefined({ price, is_for_sale, is_sold, currency }),
    required: ['artwork_id'],
    mutates: true,
    requiresConfirmation: true,
  },
  {
    id: 'gallery.delete_artwork',
    label: 'Delete artwork',
    domain: 'gallery',
    agents: ['agent/gallery_agent', 'streetbot'],
    method: 'DELETE',
    path: ({ artwork_id, user_id }) =>
      `/gallery/artworks/${encodeURIComponent(required(artwork_id, 'artwork_id'))}?user_id=${encodeURIComponent(user_id)}`,
    required: ['artwork_id'],
    mutates: true,
    destructive: true,
    requiresConfirmation: true,
  },
  {
    id: 'word.create_article',
    label: 'Create Word on the Street article',
    domain: 'word_on_the_street',
    agents: ['agent/word_on_the_street_agent', 'agent/street_profile_agent', 'streetbot'],
    method: 'POST',
    path: () => '/news/articles',
    body: ({ title, excerpt, content, content_blocks, category, tags, image_url, status, source_urls }) => ({
      title: required(title, 'title'),
      excerpt: excerpt || '',
      content: content || '',
      content_blocks: Array.isArray(content_blocks) ? content_blocks : [],
      category: category || '',
      tags: Array.isArray(tags) ? tags : [],
      image_url: image_url || '',
      status: status || 'draft',
      source_urls: Array.isArray(source_urls) ? source_urls : [],
      ai_generated: true,
    }),
    required: ['title'],
    mutates: true,
    requiresConfirmation: true,
  },
  {
    id: 'word.update_article',
    label: 'Update Word on the Street article',
    domain: 'word_on_the_street',
    agents: ['agent/word_on_the_street_agent', 'agent/street_profile_agent', 'streetbot'],
    method: 'PATCH',
    path: ({ article_id }) => `/news/articles/${encodeURIComponent(required(article_id, 'article_id'))}`,
    body: (params) =>
      omitUndefined({
        title: params.title,
        slug: params.slug,
        excerpt: params.excerpt,
        content: params.content,
        content_blocks: params.content_blocks,
        category: params.category,
        tags: params.tags,
        image_url: params.image_url,
        status: params.status,
        source_urls: params.source_urls,
      }),
    required: ['article_id'],
    mutates: true,
    requiresConfirmation: true,
  },
  {
    id: 'word.delete_article',
    label: 'Delete Word on the Street article',
    domain: 'word_on_the_street',
    agents: ['agent/word_on_the_street_agent', 'agent/street_profile_agent', 'streetbot'],
    method: 'DELETE',
    path: ({ article_id }) => `/news/articles/${encodeURIComponent(required(article_id, 'article_id'))}`,
    required: ['article_id'],
    mutates: true,
    destructive: true,
    requiresConfirmation: true,
  },
  {
    id: 'academy.enroll_course',
    label: 'Enroll in Academy course',
    domain: 'academy',
    agents: ['agent/academy_agent', 'streetbot'],
    method: 'POST',
    path: () => '/api/academy/enrollments',
    body: ({ course_id, user_id }) => ({
      course_id: required(course_id, 'course_id'),
      user_id,
      status: 'active',
      progress_percent: 0,
    }),
    required: ['course_id'],
    mutates: true,
    requiresConfirmation: true,
  },
  {
    id: 'academy.unenroll_course',
    label: 'Drop Academy course',
    domain: 'academy',
    agents: ['agent/academy_agent', 'streetbot'],
    executor: unenrollAcademyCourse,
    required: ['course_id'],
    mutates: true,
    destructive: true,
    requiresConfirmation: true,
  },
  {
    id: 'academy.create_course',
    label: 'Create Academy course',
    domain: 'academy',
    agents: ['agent/academy_agent', 'streetbot'],
    method: 'POST',
    path: () => '/api/academy/courses',
    body: ({ title, topic, description, category, level, duration, instructor_name }) => ({
      title: required(title || topic, 'title'),
      description: description || '',
      category: category || 'Street Voices Academy',
      level: level || 'beginner',
      duration: duration || '',
      instructor_name: instructor_name || 'Street Voices Academy',
      state: 'published',
    }),
    required: ['title'],
    mutates: true,
    requiresConfirmation: true,
  },
  {
    id: 'academy.create_assignment',
    label: 'Create Academy assignment',
    domain: 'academy',
    agents: ['agent/academy_agent', 'streetbot'],
    method: 'POST',
    path: ({ course_id }) =>
      `/api/academy/courses/${encodeURIComponent(required(course_id, 'course_id'))}/assignments`,
    body: ({ title, description, instructions, max_points, is_published }) => ({
      title: required(title, 'title'),
      description: description || '',
      instructions: instructions || description || '',
      max_points: max_points || 100,
      is_published: is_published !== false,
    }),
    required: ['course_id', 'title'],
    mutates: true,
    requiresConfirmation: true,
  },
  {
    id: 'grant.create_opportunity',
    label: 'Create grant opportunity',
    domain: 'grants',
    agents: ['agent/grant_manager', 'streetbot'],
    executor: createGrantOpportunity,
    required: ['name'],
    mutates: true,
    requiresConfirmation: true,
  },
  {
    id: 'grant.update_stage',
    label: 'Update grant stage',
    domain: 'grants',
    agents: ['agent/grant_manager', 'streetbot'],
    executor: updateGrantStage,
    required: ['grant_id', 'stage'],
    mutates: true,
    requiresConfirmation: true,
  },
  {
    id: 'grant.archive',
    label: 'Archive grant opportunity',
    domain: 'grants',
    agents: ['agent/grant_manager', 'streetbot'],
    executor: archiveGrantOpportunity,
    required: ['grant_id'],
    mutates: true,
    destructive: true,
    requiresConfirmation: true,
  },
  {
    id: 'profile.send_dm',
    label: 'Send profile direct message',
    domain: 'messages',
    agents: [
      'agent/messaging_agent',
      'agent/profiles_agent',
      'agent/street_profile_agent',
      'streetbot',
    ],
    executor: sendProfileDirectMessage,
    required: ['recipient', 'content'],
    mutates: true,
    requiresConfirmation: true,
  },
];

const ACTION_MAP = new Map(ACTIONS.map((action) => [action.id, action]));

function getStreetBotActionManifest() {
  return {
    ok: true,
    localOnly: true,
    actions: ACTIONS.map((action) => ({
      id: action.id,
      label: action.label,
      domain: action.domain,
      agents: action.agents,
      required: action.required || [],
      mutates: Boolean(action.mutates),
      destructive: Boolean(action.destructive),
      requiresConfirmation: Boolean(action.requiresConfirmation),
    })),
  };
}

async function executeStreetBotAction(req, input = {}) {
  const actionId = String(input.actionId || input.action || '').trim();
  const action = ACTION_MAP.get(actionId);
  if (!action) {
    const error = new Error(`Unknown StreetBot action: ${actionId || '(missing)'}`);
    error.status = 404;
    throw error;
  }

  const params = normalizeParams(req, input.params || {});
  validateRequired(action, params);

  if (action.requiresConfirmation && input.confirm !== true && input.confirmed !== true) {
    return {
      ok: true,
      status: 'needs_confirmation',
      localOnly: true,
      action: summarizeAction(action, params),
      message: `${action.label} is ready, but it needs explicit confirmation before I change local data.`,
    };
  }

  if (typeof action.executor === 'function') {
    return action.executor(req, params, action);
  }

  const result = await callLocalNanobot(
    action.method,
    action.path(params),
    typeof action.body === 'function' ? action.body(params) : undefined,
  );
  return {
    ok: true,
    status: 'executed',
    localOnly: true,
    action: summarizeAction(action, params),
    result,
  };
}

function normalizeParams(req, params) {
  const user = req?.user || {};
  const userId = String(params.user_id || user.id || user._id || user.email || 'local-3180-user');
  const userName = String(params.user_name || user.name || user.username || user.email || 'Joel Zola');
  const userEmail = String(params.user_email || user.email || '').trim();
  return {
    ...params,
    user_id: userId,
    user_email: userEmail,
    artist_id: params.artist_id || userId,
    artist_name: params.artist_name || userName,
    user_name: userName,
    user_avatar: params.user_avatar || user.avatar || user.image || '',
  };
}

function validateRequired(action, params) {
  for (const key of action.required || []) {
    required(params[key], key);
  }
}

function summarizeAction(action, params) {
  const safeParams = { ...params };
  for (const key of ['content', 'body', 'description']) {
    if (typeof safeParams[key] === 'string' && safeParams[key].length > 160) {
      safeParams[key] = `${safeParams[key].slice(0, 160)}...`;
    }
  }
  return {
    id: action.id,
    label: action.label,
    domain: action.domain,
    destructive: Boolean(action.destructive),
    requiresConfirmation: Boolean(action.requiresConfirmation),
    params: safeParams,
  };
}

async function callLocalNanobot(method, path, body) {
  const headers = {};
  const init = { method, headers };
  if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let lastError;
  for (const base of NANOBOT_BASES) {
    const url = `${base.replace(/\/$/, '')}${path}`;
    try {
      const response = await fetch(url, init);
      const text = await response.text();
      const parsed = parseJsonMaybe(text);
      if (!response.ok) {
        const error = new Error(
          `Local Nanobot action failed (${response.status}) for ${method} ${path}`,
        );
        error.status = response.status;
        error.details = parsed || text;
        throw error;
      }
      return parsed ?? { ok: true };
    } catch (error) {
      lastError = error;
      logger.warn('[streetbot-actions] local Nanobot action attempt failed', {
        method,
        path,
        base,
        error: error?.message || String(error || ''),
      });
    }
  }
  throw lastError || new Error(`Local Nanobot action failed for ${method} ${path}`);
}

async function unenrollAcademyCourse(req, params, action) {
  const courseId = String(required(params.course_id, 'course_id')).trim();
  const userId = String(params.user_id || 'local-3180-user');
  const enrollments = await callLocalNanobot(
    'GET',
    `/api/academy/enrollments?user_id=${encodeURIComponent(userId)}&course_id=${encodeURIComponent(courseId)}`,
  );
  const enrollment = Array.isArray(enrollments) ? enrollments[0] : null;
  if (!enrollment?.id) {
    const error = new Error('No active local Academy enrollment matched that course.');
    error.status = 404;
    throw error;
  }
  const result = await callLocalNanobot(
    'DELETE',
    `/api/academy/enrollments/${encodeURIComponent(enrollment.id)}`,
  );
  return {
    ok: true,
    status: 'executed',
    localOnly: true,
    action: summarizeAction(action, params),
    result: result || { enrollment_id: enrollment.id, course_id: courseId, status: 'dropped' },
  };
}

function readGrantWorkspace() {
  try {
    const saved = fs.readFileSync(GRANT_ACTION_STATE_FILE, 'utf8');
    const parsed = JSON.parse(saved);
    return {
      grants: Array.isArray(parsed?.grants) ? parsed.grants : cloneDefaultGrants(),
      archived: Array.isArray(parsed?.archived) ? parsed.archived : [],
      updatedAt: parsed?.updatedAt || null,
    };
  } catch (_) {
    return { grants: cloneDefaultGrants(), archived: [], updatedAt: null };
  }
}

function writeGrantWorkspace(workspace) {
  fs.mkdirSync(pathLib.dirname(GRANT_ACTION_STATE_FILE), { recursive: true });
  const next = {
    grants: Array.isArray(workspace?.grants) ? workspace.grants : [],
    archived: Array.isArray(workspace?.archived) ? workspace.archived : [],
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(GRANT_ACTION_STATE_FILE, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

function cloneDefaultGrants() {
  return JSON.parse(JSON.stringify(DEFAULT_GRANT_OPPORTUNITIES));
}

function slugGrantId(value) {
  const base = String(value || 'grant')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${base || 'grant'}-${Date.now().toString(36)}`;
}

function normalizeGrantStage(stage) {
  const normalized = String(stage || 'identified').trim().toLowerCase().replace(/\s+/g, '-');
  if (!VALID_GRANT_STAGES.has(normalized)) {
    const error = new Error(`Unsupported grant stage: ${stage}`);
    error.status = 400;
    throw error;
  }
  return normalized;
}

function createGrantOpportunity(req, params, action) {
  const workspace = readGrantWorkspace();
  const name = String(required(params.name || params.title, 'name')).trim();
  const id = String(params.grant_id || params.id || slugGrantId(name)).trim();
  const grant = {
    id,
    name,
    funder: String(params.funder || 'Unknown Funder').trim(),
    funderAbbrev: params.funderAbbrev || params.funder_abbrev || undefined,
    amount: params.amount || undefined,
    deadline: params.deadline || undefined,
    stage: normalizeGrantStage(params.stage || 'identified'),
    url: params.url || undefined,
    assessment: params.recommendation
      ? { recommendation: String(params.recommendation).toLowerCase() }
      : undefined,
    documents: params.documents || {
      opportunity: true,
      narrative: false,
      budget: false,
      projectPlan: false,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  workspace.grants = [
    grant,
    ...workspace.grants.filter((item) => String(item.id) !== id),
  ];
  const saved = writeGrantWorkspace(workspace);
  return {
    ok: true,
    status: 'executed',
    localOnly: true,
    action: summarizeAction(action, params),
    result: { grant, workspace_file: GRANT_ACTION_STATE_FILE, total: saved.grants.length },
  };
}

function updateGrantStage(req, params, action) {
  const workspace = readGrantWorkspace();
  const grantId = String(required(params.grant_id, 'grant_id')).trim();
  const stage = normalizeGrantStage(params.stage);
  const grant = workspace.grants.find((item) => String(item.id) === grantId);
  if (!grant) {
    const error = new Error(`No active grant matched ${grantId}`);
    error.status = 404;
    throw error;
  }
  grant.stage = stage;
  grant.updated_at = new Date().toISOString();
  const saved = writeGrantWorkspace(workspace);
  return {
    ok: true,
    status: 'executed',
    localOnly: true,
    action: summarizeAction(action, params),
    result: { grant, workspace_file: GRANT_ACTION_STATE_FILE, total: saved.grants.length },
  };
}

function archiveGrantOpportunity(req, params, action) {
  const workspace = readGrantWorkspace();
  const grantId = String(required(params.grant_id, 'grant_id')).trim();
  const grant = workspace.grants.find((item) => String(item.id) === grantId);
  if (!grant) {
    const error = new Error(`No active grant matched ${grantId}`);
    error.status = 404;
    throw error;
  }
  grant.stage = grant.stage || 'closed';
  grant.archived_at = new Date().toISOString();
  workspace.grants = workspace.grants.filter((item) => String(item.id) !== grantId);
  workspace.archived = [
    grant,
    ...workspace.archived.filter((item) => String(item.id) !== grantId),
  ];
  const saved = writeGrantWorkspace(workspace);
  return {
    ok: true,
    status: 'executed',
    localOnly: true,
    action: summarizeAction(action, params),
    result: {
      grant,
      workspace_file: GRANT_ACTION_STATE_FILE,
      active_total: saved.grants.length,
      archived_total: saved.archived.length,
    },
  };
}

function parseJsonMaybe(text) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
}

function getSocialDockerPgUrls() {
  try {
    const output = childProcess.execFileSync(
      'docker',
      ['inspect', 'nanobot-social-postgres', '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1200 },
    );
    return output
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((host) => `postgresql://social:social_password@${host}:5432/social`);
  } catch (_) {
    return [];
  }
}

async function withSocialClient(work) {
  if (!PgPool) {
    const error = new Error('pg is not available in this runtime');
    error.status = 500;
    throw error;
  }

  const candidates = [...new Set([...SOCIAL_DB_URLS, ...getSocialDockerPgUrls()].filter(Boolean))];
  if (socialPool && socialPoolKey) {
    candidates.unshift(socialPoolKey);
  }

  let lastError;
  for (const connectionString of [...new Set(candidates)]) {
    let pool = socialPoolKey === connectionString ? socialPool : null;
    try {
      if (!pool) {
        pool = new PgPool({
          connectionString,
          max: 1,
          connectionTimeoutMillis: 1500,
          idleTimeoutMillis: 10_000,
          query_timeout: 5000,
        });
      }
      const client = await pool.connect();
      try {
        const result = await work(client);
        socialPool = pool;
        socialPoolKey = connectionString;
        return result;
      } finally {
        client.release();
      }
    } catch (error) {
      lastError = error;
      if (pool && pool !== socialPool) {
        await pool.end().catch(() => {});
      }
      logger.warn('[streetbot-actions] social DB action attempt failed', {
        host: connectionString.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@'),
        error: error?.message || String(error || ''),
      });
    }
  }
  throw lastError || new Error('Could not connect to local social database');
}

async function sendProfileDirectMessage(req, params, action) {
  if (PgPool) {
    try {
      const sender = await ensureLocalSocialUser(req);
      const recipient = await findLocalRecipient(params.recipient, sender.id);
      if (!recipient) {
        const error = new Error(`No local Messages profile matched "${params.recipient}"`);
        error.status = 404;
        throw error;
      }
      const sent = await ensureDmChannelAndSendMessage(sender.id, recipient.id, params.content, {
        source: 'streetbot_action_bridge',
        agent: params.agent || null,
      });
      return {
        ok: true,
        status: 'executed',
        localOnly: true,
        action: summarizeAction(action, params),
        result: {
          channel_id: sent.channelId,
          message_id: sent.message?.id,
          recipient: sanitizeRecipient(recipient),
        },
      };
    } catch (error) {
      logger.warn('[streetbot-actions] direct social DB DM failed, trying local API fallback', {
        error: error?.message || String(error || ''),
      });
    }
  }

  const result = await callLocalNanobot('POST', '/messages/dm', {
    recipient: params.recipient,
    content: params.content,
    agent: params.agent || null,
    user_id: params.user_id,
    user_name: params.user_name,
    user_email: params.user_email,
    user_avatar: params.user_avatar,
    source: 'streetbot_action_bridge',
  });
  return {
    ok: true,
    status: 'executed',
    localOnly: true,
    action: summarizeAction(action, params),
    result,
  };
}

function getLibreChatIdentity(req) {
  const user = req?.user || {};
  const id = String(user.id || user._id || '').trim();
  const email = String(user.email || '').trim();
  const name = String(user.name || user.username || email || 'Street Profile User').trim();
  return {
    casdoorId: String(user.openidId || user.idOnTheSource || id || email).trim(),
    username: String(user.username || email || name).trim(),
    displayName: name,
    email: email || `${(id || name).replace(/[^a-zA-Z0-9._-]/g, '_')}@streetvoices.local`,
    avatarUrl: String(user.avatar || user.image || '').trim() || null,
  };
}

async function ensureLocalSocialUser(req) {
  const identity = getLibreChatIdentity(req);
  if (!identity.casdoorId) {
    const error = new Error('No authenticated local user identity was available');
    error.status = 401;
    throw error;
  }

  return withSocialClient(async (client) => {
    const existing = await client.query(
      `SELECT id, username, display_name, email, avatar_url
       FROM users
       WHERE casdoor_id = $1 OR email = $2
       LIMIT 1`,
      [identity.casdoorId, identity.email],
    );
    if (existing.rows[0]) {
      const updated = await client.query(
        `UPDATE users
         SET casdoor_id = $2,
             display_name = $3,
             email = $4,
             avatar_url = $5,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, username, display_name, email, avatar_url`,
        [
          existing.rows[0].id,
          identity.casdoorId,
          identity.displayName,
          identity.email,
          identity.avatarUrl,
        ],
      );
      return updated.rows[0] || existing.rows[0];
    }

    const username = await uniqueUsername(client, identity.username || identity.displayName);
    const inserted = await client.query(
      `INSERT INTO users (id, casdoor_id, username, display_name, email, avatar_url, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, username, display_name, email, avatar_url`,
      [identity.casdoorId, username, identity.displayName, identity.email, identity.avatarUrl],
    );
    return inserted.rows[0];
  });
}

async function uniqueUsername(client, baseUsername) {
  const base = String(baseUsername || 'street-profile-user')
    .trim()
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
  let candidate = base || 'street-profile-user';
  for (let index = 0; index < 50; index += 1) {
    const { rows } = await client.query('SELECT id FROM users WHERE username = $1 LIMIT 1', [
      candidate,
    ]);
    if (!rows.length) {
      return candidate;
    }
    candidate = `${base}-${index + 2}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function findLocalRecipient(query, senderId) {
  const normalized = String(query || '').trim();
  const handle = normalized.replace(/^@/, '').toLowerCase();
  return withSocialClient(async (client) => {
    const { rows } = await client.query(
      `SELECT id, username, display_name, email, avatar_url, is_agent
       FROM users
       WHERE id <> COALESCE($2, '')
         AND (
           lower(username) = lower($1)
           OR lower(display_name) = lower($1)
           OR lower(email) = lower($1)
           OR username ILIKE $3
           OR display_name ILIKE $3
           OR email ILIKE $3
         )
       ORDER BY
         CASE
           WHEN lower(username) = lower($1) THEN 0
           WHEN lower(display_name) = lower($1) THEN 1
           WHEN lower(email) = lower($1) THEN 2
           ELSE 3
         END,
         is_agent ASC,
         display_name ASC
       LIMIT 1`,
      [handle || normalized, senderId, `%${normalized}%`],
    );
    return rows[0] || null;
  });
}

async function ensureDmChannelAndSendMessage(senderId, recipientId, content, metadata = {}) {
  return withSocialClient(async (client) => {
    await client.query('BEGIN');
    try {
      const existing = await client.query(
        `SELECT c.id
         FROM channels c
         WHERE c.type = 'DM'
           AND c.is_archived = false
           AND EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = $1)
           AND EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = $2)
         LIMIT 1`,
        [senderId, recipientId],
      );

      let channelId = existing.rows[0]?.id;
      if (!channelId) {
        const created = await client.query(
          `INSERT INTO channels (id, name, slug, type, created_at, updated_at)
           VALUES (gen_random_uuid()::text, NULL, $1, 'DM', NOW(), NOW())
           RETURNING id`,
          [`dm-${senderId}-${recipientId}`],
        );
        channelId = created.rows[0].id;
        await client.query(
          `INSERT INTO channel_members (id, channel_id, user_id, role, joined_at)
           VALUES
             (gen_random_uuid()::text, $1, $2, 'member', NOW()),
             (gen_random_uuid()::text, $1, $3, 'member', NOW())
           ON CONFLICT (channel_id, user_id) DO NOTHING`,
          [channelId, senderId, recipientId],
        );
      }

      const message = await client.query(
        `INSERT INTO messages (id, channel_id, author_id, content, metadata, created_at, updated_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4::jsonb, NOW(), NOW())
         RETURNING id, channel_id, author_id, content, created_at`,
        [channelId, senderId, content, JSON.stringify(metadata || {})],
      );
      await client.query('UPDATE channels SET updated_at = NOW() WHERE id = $1', [channelId]);
      await client.query('COMMIT');
      return { channelId, message: message.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    }
  });
}

function sanitizeRecipient(recipient) {
  return {
    id: recipient.id,
    username: recipient.username,
    display_name: recipient.display_name,
    email: recipient.email,
    avatar_url: recipient.avatar_url,
    is_agent: recipient.is_agent,
  };
}

module.exports = {
  executeStreetBotAction,
  getStreetBotActionManifest,
};

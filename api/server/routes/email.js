const axios = require('axios');
const express = require('express');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

const LISTMONK_BASE_URL = (process.env.LISTMONK_BASE_URL || 'http://host.docker.internal:9001').replace(
  /\/+$/,
  '',
);
const LISTMONK_ADMIN_USER = process.env.LISTMONK_ADMIN_USER || 'admin';
const LISTMONK_ADMIN_PASSWORD = process.env.LISTMONK_ADMIN_PASSWORD || '$treetvoices26';
const LISTMONK_TIMEOUT_MS = Number(process.env.LISTMONK_TIMEOUT_MS || 10000);

function cookieHeaderFrom(setCookie) {
  if (!Array.isArray(setCookie) || setCookie.length === 0) {
    return '';
  }
  return setCookie.map((cookie) => cookie.split(';')[0]).join('; ');
}

async function getListmonkSessionCookie() {
  const body = new URLSearchParams({
    username: LISTMONK_ADMIN_USER,
    password: LISTMONK_ADMIN_PASSWORD,
  });

  const response = await axios.post(`${LISTMONK_BASE_URL}/admin/login`, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    maxRedirects: 0,
    timeout: LISTMONK_TIMEOUT_MS,
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const cookie = cookieHeaderFrom(response.headers['set-cookie']);
  if (!cookie) {
    throw new Error('Listmonk login succeeded without returning a session cookie');
  }
  return cookie;
}

async function listmonkGet(path, cookie) {
  const response = await axios.get(`${LISTMONK_BASE_URL}${path}`, {
    headers: { Cookie: cookie },
    timeout: LISTMONK_TIMEOUT_MS,
  });
  return response.data?.data;
}

async function listmonkRequest(method, path, cookie, data) {
  const response = await axios({
    method,
    url: `${LISTMONK_BASE_URL}${path}`,
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
    },
    data,
    timeout: LISTMONK_TIMEOUT_MS,
  });
  return response.data?.data;
}

function results(data) {
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.results)) {
    return data.results;
  }
  return [];
}

function countBy(items, predicate) {
  return items.reduce((total, item) => (predicate(item) ? total + 1 : total), 0);
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item?.[key] || 0), 0);
}

function statusCounts(campaigns) {
  return campaigns.reduce((counts, campaign) => {
    const status = campaign.status || 'unknown';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

function recentCampaignTotals(campaigns) {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = campaigns.filter((campaign) => {
    const value = campaign.started_at || campaign.updated_at || campaign.created_at;
    return value && new Date(value).getTime() > sevenDaysAgo;
  });

  return {
    campaigns: recent.length,
    sent: sum(recent, 'sent'),
    opens: sum(recent, 'views'),
    clicks: sum(recent, 'clicks'),
  };
}

function cleanList(list) {
  return {
    id: list.id,
    name: list.name,
    type: list.type,
    status: list.status,
    optin: list.optin,
    tags: Array.isArray(list.tags) ? list.tags : [],
    description: list.description || '',
    subscriberCount: Number(list.subscriber_count || 0),
    confirmedCount: Number(list.subscriber_statuses?.confirmed || 0),
    updatedAt: list.updated_at || list.created_at || null,
  };
}

function cleanSubscriber(subscriber) {
  return {
    id: subscriber.id,
    email: subscriber.email,
    name: subscriber.name || '',
    status: subscriber.status,
    lists: Array.isArray(subscriber.lists)
      ? subscriber.lists.map((list) => ({ id: list.id, name: list.name, status: list.subscription_status }))
      : [],
    createdAt: subscriber.created_at || null,
    updatedAt: subscriber.updated_at || null,
  };
}

function cleanCampaign(campaign) {
  return {
    id: campaign.id,
    name: campaign.name,
    subject: campaign.subject || campaign.name,
    fromEmail: campaign.from_email || '',
    status: campaign.status,
    type: campaign.type || 'regular',
    contentType: campaign.content_type || 'richtext',
    body: campaign.body || '',
    bodySource: campaign.body_source || '',
    altbody: campaign.altbody || '',
    sendAt: campaign.send_at || null,
    templateId: campaign.template_id || 0,
    messenger: campaign.messenger || 'email',
    sent: Number(campaign.sent || 0),
    toSend: Number(campaign.to_send || 0),
    views: Number(campaign.views || 0),
    clicks: Number(campaign.clicks || 0),
    bounces: Number(campaign.bounces || 0),
    listIds: Array.isArray(campaign.lists) ? campaign.lists.map((list) => list.id).filter(Boolean) : [],
    lists: Array.isArray(campaign.lists) ? campaign.lists.map((list) => list.name) : [],
    tags: Array.isArray(campaign.tags) ? campaign.tags : [],
    createdAt: campaign.created_at || null,
    updatedAt: campaign.updated_at || campaign.created_at || null,
    startedAt: campaign.started_at || null,
    endedAt: campaign.ended_at || campaign.finished_at || (campaign.status === 'finished' ? campaign.updated_at : null),
  };
}

function cleanTemplate(template) {
  return {
    id: template.id,
    name: template.name,
    subject: template.subject || '',
    type: template.type || 'campaign',
    body: template.body || '',
    updatedAt: template.updated_at || template.created_at || null,
    createdAt: template.created_at || null,
  };
}

function cleanUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name || user.username,
    email: user.email,
    status: user.status,
    role: user.user_role?.name || 'User',
    loggedInAt: user.loggedin_at || null,
  };
}

function cleanSettings(settings = {}) {
  return {
    siteName: settings['app.site_name'] || 'Street Voices',
    rootUrl: settings['app.root_url'] || '',
    logoUrl: settings['app.logo_url'] || '',
    fromEmail: settings['app.from_email'] || '',
    publicSubscriptionPage: Boolean(settings['app.enable_public_subscription_page']),
    publicArchive: Boolean(settings['app.enable_public_archive']),
    language: settings['app.lang'] || 'en',
    smtpEnabled: Array.isArray(settings.smtp) ? settings.smtp.some((smtp) => smtp.enabled) : false,
    smtpHosts: Array.isArray(settings.smtp)
      ? settings.smtp.filter((smtp) => smtp.enabled).map((smtp) => smtp.host)
      : [],
  };
}

function asString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asNumberArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0);
}

function asStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function campaignPayload(body = {}) {
  const lists = asNumberArray(body.lists);
  const name = asString(body.name);
  const subject = asString(body.subject);
  const contentType = asString(body.content_type || body.contentType, 'richtext');
  const payload = {
    name,
    subject,
    lists,
    from_email: asString(body.from_email || body.fromEmail),
    type: asString(body.type, 'regular'),
    content_type: contentType,
    body: typeof body.body === 'string' ? body.body : '',
    body_source: typeof body.body_source === 'string' ? body.body_source : typeof body.bodySource === 'string' ? body.bodySource : '',
    altbody: typeof body.altbody === 'string' ? body.altbody : '',
    send_at: asString(body.send_at || body.sendAt) || null,
    messenger: asString(body.messenger, 'email'),
    tags: asStringArray(body.tags),
  };

  const templateId = Number(body.template_id || body.templateId || 0);
  if (Number.isFinite(templateId) && templateId > 0) {
    payload.template_id = templateId;
  }

  if (!payload.from_email) {
    delete payload.from_email;
  }
  if (!payload.send_at) {
    delete payload.send_at;
  }

  return payload;
}

function templatePayload(body = {}) {
  return {
    name: asString(body.name),
    subject: asString(body.subject),
    type: asString(body.type, 'campaign'),
    body: typeof body.body === 'string' ? body.body : '',
  };
}

function validateCampaignPayload(payload) {
  if (!payload.name) {
    return 'Campaign name is required';
  }
  if (!payload.subject) {
    return 'Campaign subject is required';
  }
  if (!Array.isArray(payload.lists) || payload.lists.length === 0) {
    return 'At least one Listmonk list is required';
  }
  if (!payload.body && payload.content_type !== 'visual') {
    return 'Campaign body is required';
  }
  return null;
}

function validateTemplatePayload(payload) {
  if (!payload.name) {
    return 'Template name is required';
  }
  if (!payload.body) {
    return 'Template body is required';
  }
  return null;
}

function validateCampaignStatus(status) {
  if (!['draft', 'scheduled', 'running', 'paused', 'cancelled'].includes(status)) {
    return 'Unsupported campaign status';
  }
  return null;
}

function sendListmonkError(res, error, fallbackMessage) {
  const status = error?.response?.status && error.response.status >= 400 ? error.response.status : 502;
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.data ||
    (error instanceof Error ? error.message : String(error));

  res.status(status).send({
    connected: false,
    message: fallbackMessage,
    error: typeof message === 'string' ? message : JSON.stringify(message),
    source: {
      label: 'Listmonk',
      baseUrl: LISTMONK_BASE_URL,
    },
  });
}

router.get('/dashboard', requireJwtAuth, async (_req, res) => {
  try {
    const cookie = await getListmonkSessionCookie();
    const [listsData, subscribersData, campaignsData, templatesData, usersData, settingsData] = await Promise.all([
      listmonkGet('/api/lists?per_page=all', cookie),
      listmonkGet('/api/subscribers?per_page=all', cookie),
      listmonkGet('/api/campaigns?per_page=all', cookie),
      listmonkGet('/api/templates?per_page=all', cookie),
      listmonkGet('/api/users', cookie),
      listmonkGet('/api/settings', cookie),
    ]);

    const lists = results(listsData);
    const subscribers = results(subscribersData);
    const campaigns = results(campaignsData);
    const templates = results(templatesData);
    const users = results(usersData);
    const recentTotals = recentCampaignTotals(campaigns);

    res.status(200).send({
      connected: true,
      source: {
        label: 'Listmonk',
        baseUrl: LISTMONK_BASE_URL,
      },
      metrics: {
        lists: {
          total: lists.length,
          public: countBy(lists, (list) => list.type === 'public'),
          private: countBy(lists, (list) => list.type === 'private'),
        },
        subscribers: {
          total: subscribers.length,
          enabled: countBy(subscribers, (subscriber) => subscriber.status === 'enabled'),
          blocklisted: countBy(subscribers, (subscriber) => subscriber.status === 'blocklisted'),
          orphans: countBy(
            subscribers,
            (subscriber) => !Array.isArray(subscriber.lists) || subscriber.lists.length === 0,
          ),
        },
        campaigns: {
          total: campaigns.length,
          byStatus: statusCounts(campaigns),
        },
        messagesSent: sum(campaigns, 'sent'),
        opens: sum(campaigns, 'views'),
        clicks: sum(campaigns, 'clicks'),
        lastSevenDays: recentTotals,
      },
      lists: lists.map(cleanList),
      subscribers: subscribers.map(cleanSubscriber),
      campaigns: campaigns.map(cleanCampaign),
      templates: templates.map(cleanTemplate),
      users: users.map(cleanUser),
      settings: cleanSettings(settingsData),
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(502).send({
      connected: false,
      message: 'Could not load Listmonk data',
      error: error instanceof Error ? error.message : String(error),
      source: {
        label: 'Listmonk',
        baseUrl: LISTMONK_BASE_URL,
      },
    });
  }
});

router.get('/templates/:templateId', requireJwtAuth, async (req, res) => {
  try {
    const templateId = Number(req.params.templateId);
    if (!Number.isFinite(templateId)) {
      return res.status(400).send({ message: 'Invalid template id' });
    }
    const cookie = await getListmonkSessionCookie();
    const template = await listmonkGet(`/api/templates/${templateId}`, cookie);
    res.status(200).send({ template: cleanTemplate(template) });
  } catch (error) {
    sendListmonkError(res, error, 'Could not load template');
  }
});

router.post('/templates', requireJwtAuth, async (req, res) => {
  try {
    const payload = templatePayload(req.body);
    const validationError = validateTemplatePayload(payload);
    if (validationError) {
      return res.status(400).send({ message: validationError });
    }
    const cookie = await getListmonkSessionCookie();
    const template = await listmonkRequest('post', '/api/templates', cookie, payload);
    res.status(201).send({ template: cleanTemplate(template) });
  } catch (error) {
    sendListmonkError(res, error, 'Could not create template');
  }
});

router.put('/templates/:templateId', requireJwtAuth, async (req, res) => {
  try {
    const templateId = Number(req.params.templateId);
    if (!Number.isFinite(templateId)) {
      return res.status(400).send({ message: 'Invalid template id' });
    }
    const payload = templatePayload(req.body);
    const validationError = validateTemplatePayload(payload);
    if (validationError) {
      return res.status(400).send({ message: validationError });
    }
    const cookie = await getListmonkSessionCookie();
    const template = await listmonkRequest('put', `/api/templates/${templateId}`, cookie, payload);
    res.status(200).send({ template: cleanTemplate(template) });
  } catch (error) {
    sendListmonkError(res, error, 'Could not update template');
  }
});

router.delete('/templates/:templateId', requireJwtAuth, async (req, res) => {
  try {
    const templateId = Number(req.params.templateId);
    if (!Number.isFinite(templateId)) {
      return res.status(400).send({ message: 'Invalid template id' });
    }
    const cookie = await getListmonkSessionCookie();
    await listmonkRequest('delete', `/api/templates/${templateId}`, cookie);
    res.status(200).send({ ok: true });
  } catch (error) {
    sendListmonkError(res, error, 'Could not delete template');
  }
});

router.get('/campaigns/:campaignId', requireJwtAuth, async (req, res) => {
  try {
    const campaignId = Number(req.params.campaignId);
    if (!Number.isFinite(campaignId)) {
      return res.status(400).send({ message: 'Invalid campaign id' });
    }
    const cookie = await getListmonkSessionCookie();
    const campaign = await listmonkGet(`/api/campaigns/${campaignId}`, cookie);
    res.status(200).send({ campaign: cleanCampaign(campaign) });
  } catch (error) {
    sendListmonkError(res, error, 'Could not load campaign');
  }
});

router.post('/campaigns', requireJwtAuth, async (req, res) => {
  try {
    const payload = campaignPayload(req.body);
    const validationError = validateCampaignPayload(payload);
    if (validationError) {
      return res.status(400).send({ message: validationError });
    }
    const cookie = await getListmonkSessionCookie();
    const campaign = await listmonkRequest('post', '/api/campaigns', cookie, payload);
    res.status(201).send({ campaign: cleanCampaign(campaign) });
  } catch (error) {
    sendListmonkError(res, error, 'Could not create campaign');
  }
});

router.put('/campaigns/:campaignId', requireJwtAuth, async (req, res) => {
  try {
    const campaignId = Number(req.params.campaignId);
    if (!Number.isFinite(campaignId)) {
      return res.status(400).send({ message: 'Invalid campaign id' });
    }
    const payload = campaignPayload(req.body);
    const validationError = validateCampaignPayload(payload);
    if (validationError) {
      return res.status(400).send({ message: validationError });
    }
    const cookie = await getListmonkSessionCookie();
    const campaign = await listmonkRequest('put', `/api/campaigns/${campaignId}`, cookie, payload);
    res.status(200).send({ campaign: cleanCampaign(campaign) });
  } catch (error) {
    sendListmonkError(res, error, 'Could not update campaign');
  }
});

router.put('/campaigns/:campaignId/status', requireJwtAuth, async (req, res) => {
  try {
    const campaignId = Number(req.params.campaignId);
    if (!Number.isFinite(campaignId)) {
      return res.status(400).send({ message: 'Invalid campaign id' });
    }
    const status = asString(req.body?.status).toLowerCase();
    const validationError = validateCampaignStatus(status);
    if (validationError) {
      return res.status(400).send({ message: validationError });
    }
    const cookie = await getListmonkSessionCookie();
    await listmonkRequest('put', `/api/campaigns/${campaignId}/status`, cookie, { status });
    const campaign = await listmonkGet(`/api/campaigns/${campaignId}`, cookie);
    res.status(200).send({ campaign: cleanCampaign(campaign) });
  } catch (error) {
    sendListmonkError(res, error, 'Could not update campaign status');
  }
});

router.delete('/campaigns/:campaignId', requireJwtAuth, async (req, res) => {
  try {
    const campaignId = Number(req.params.campaignId);
    if (!Number.isFinite(campaignId)) {
      return res.status(400).send({ message: 'Invalid campaign id' });
    }
    const cookie = await getListmonkSessionCookie();
    await listmonkRequest('delete', `/api/campaigns/${campaignId}`, cookie);
    res.status(200).send({ ok: true });
  } catch (error) {
    sendListmonkError(res, error, 'Could not delete campaign');
  }
});

module.exports = router;

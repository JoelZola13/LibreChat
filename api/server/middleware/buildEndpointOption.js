const { handleError } = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const {
  Constants,
  EndpointURLs,
  EModelEndpoint,
  isAgentsEndpoint,
  parseCompactConvo,
} = require('librechat-data-provider');
const azureAssistants = require('~/server/services/Endpoints/azureAssistants');
const assistants = require('~/server/services/Endpoints/assistants');
const { getEndpointsConfig } = require('~/server/services/Config');
const agents = require('~/server/services/Endpoints/agents');
const { updateFilesUsage } = require('~/models');
const { getMessages } = require('~/models/Message');
let streetBotFastPathTools;
try {
  streetBotFastPathTools = require('/app/tools/streetbot-fastpath.cjs');
} catch (_) {
  streetBotFastPathTools = require('../../../tools/streetbot-fastpath.cjs');
}
const { detectStreetBotIntent, isStreetBotEndpoint } = streetBotFastPathTools;
let streetBotTelemetry;
try {
  streetBotTelemetry = require('/app/tools/streetbot-telemetry.cjs');
} catch (_) {
  streetBotTelemetry = require('../../../tools/streetbot-telemetry.cjs');
}
const {
  annotateStreetBotRequestTrace,
  runInStreetBotTrace,
  startStreetBotRequestTrace,
} = streetBotTelemetry;

const buildFunction = {
  [EModelEndpoint.agents]: agents.buildOptions,
  [EModelEndpoint.assistants]: assistants.buildOptions,
  [EModelEndpoint.azureAssistants]: azureAssistants.buildOptions,
};

const getDefaultParamsEndpointCompat = (endpointsConfig, endpoint) => {
  const customEndpoints = Array.isArray(endpointsConfig?.custom) ? endpointsConfig.custom : [];
  const endpointConfig = customEndpoints.find(
    (config) =>
      String(config?.name || '').trim().toLowerCase() ===
      String(endpoint || '').trim().toLowerCase(),
  );
  return endpointConfig?.customParams?.defaultParamsEndpoint || endpoint;
};

const applyStreetBotModelDefaults = (endpoint, endpointsConfig, appConfig, parsedBody) => {
  if (!isStreetBotEndpoint(endpoint) || !parsedBody || typeof parsedBody !== 'object') {
    return parsedBody;
  }

  const customEndpoints = Array.isArray(endpointsConfig?.custom)
    ? endpointsConfig.custom
    : Array.isArray(appConfig?.endpoints?.custom)
      ? appConfig.endpoints.custom
      : [];

  const endpointConfig = customEndpoints.find(
    (config) => String(config?.name || '').trim().toLowerCase() === String(endpoint || '').trim().toLowerCase(),
  );
  if (!endpointConfig) {
    return parsedBody;
  }

  const defaultModel = Array.isArray(endpointConfig?.models?.default)
    ? String(endpointConfig.models.default[0] || '').trim()
    : '';
  if (defaultModel && !String(parsedBody.model || '').trim()) {
    parsedBody.model = defaultModel;
  }

  const modelLabel = String(endpointConfig?.modelDisplayLabel || '').trim();
  if (modelLabel && !String(parsedBody.modelLabel || '').trim()) {
    parsedBody.modelLabel = modelLabel;
  }

  return parsedBody;
};

const extractMessageText = (message) => {
  if (!message) {
    return '';
  }
  if (typeof message.text === 'string') {
    return message.text;
  }
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (!part) {
          return '';
        }
        if (typeof part.text === 'string') {
          return part.text;
        }
        if (part.text && typeof part.text.value === 'string') {
          return part.text.value;
        }
        if (typeof part.value === 'string') {
          return part.value;
        }
        return '';
      })
      .join(' ')
      .trim();
  }
  return '';
};

const getLastUserMessageText = (payload) => {
  const messages = payload?.messages ?? payload?.conversation?.messages ?? [];
  if (!Array.isArray(messages)) {
    return '';
  }
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message) {
      continue;
    }
    const role = message.role ?? (message.isCreatedByUser ? 'user' : message.author);
    if (role === 'user' || message.isCreatedByUser === true) {
      const text = extractMessageText(message);
      if (text) {
        return text;
      }
    }
  }
  return '';
};

const parseStreetBotServicePayload = (value) => {
  const raw = String(value || '');
  const marker = 'streetbot-service-results';
  const markerIndex = raw.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const jsonStart = raw.indexOf('{', markerIndex);
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const buildStreetBotServiceContext = (payload) => {
  if (!payload || typeof payload !== 'object' || !String(payload.session_id || '').trim()) {
    return {};
  }

  return {
    session_id: String(payload.session_id || '').trim(),
    has_more: Boolean(payload.has_more),
    count: typeof payload.count === 'number' ? payload.count : null,
    returned_count: typeof payload.returned_count === 'number' ? payload.returned_count : null,
    offset: typeof payload.offset === 'number' ? payload.offset : 0,
    query: typeof payload.query === 'string' ? payload.query.trim() : '',
    city: typeof payload.city === 'string' ? payload.city.trim() : '',
    province: typeof payload.province === 'string' ? payload.province.trim() : '',
    service_type: typeof payload.service_type === 'string' ? payload.service_type.trim() : '',
    categories: Array.isArray(payload.categories) ? payload.categories.filter(Boolean) : [],
    tags: Array.isArray(payload.tags) ? payload.tags.filter(Boolean) : [],
    ages_served: typeof payload.ages_served === 'string' ? payload.ages_served.trim() : '',
    gender_served:
      typeof payload.gender_served === 'string' ? payload.gender_served.trim() : '',
    active_only:
      typeof payload.active_only === 'boolean' ? payload.active_only : true,
  };
};

const loadStreetBotServiceContextFromConversation = async (req, conversationId) => {
  const convoId = String(conversationId || '').trim();
  if (!req?.user?.id || !convoId || convoId === 'new') {
    return {};
  }

  try {
    const messages = await getMessages(
      { conversationId: convoId, user: req.user.id },
      'sender text content createdAt',
    );

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (!message || /^user$/i.test(String(message.sender || ''))) {
        continue;
      }

      const candidates = [];
      if (typeof message.text === 'string') {
        candidates.push(message.text);
      }
      if (Array.isArray(message.content)) {
        for (const part of message.content) {
          if (!part || typeof part !== 'object') {
            continue;
          }
          if (typeof part.text === 'string') {
            candidates.push(part.text);
          } else if (part.text && typeof part.text.value === 'string') {
            candidates.push(part.text.value);
          }
        }
      }

      for (const candidate of candidates) {
        const payload = parseStreetBotServicePayload(candidate);
        const context = buildStreetBotServiceContext(payload);
        if (context.session_id) {
          return context;
        }
      }
    }
  } catch (error) {
    logger.warn(`[streetbot-rag] failed to hydrate service context for ${convoId}: ${error.message}`);
  }

  return {};
};

const buildStreetBotUserContext = (req, parsedBody = null) => {
  const existing =
    req.body?._streetbotUserContext && typeof req.body._streetbotUserContext === 'object'
      ? req.body._streetbotUserContext
      : parsedBody?._streetbotUserContext && typeof parsedBody._streetbotUserContext === 'object'
      ? parsedBody._streetbotUserContext
      : req.body?.endpointOption?._streetbotUserContext &&
          typeof req.body.endpointOption._streetbotUserContext === 'object'
      ? req.body.endpointOption._streetbotUserContext
      : {};
  const locationCandidates = [
    req.body?.streetbotLocation,
    parsedBody?.streetbotLocation,
    req.body?.endpointOption?.streetbotLocation,
    existing?.streetbotLocation,
  ];
  const location =
    locationCandidates.find((candidate) => candidate && typeof candidate === 'object') || {};

  const radiusKm = Number(
    existing.radiusKm ?? existing.radius_km ?? location.radiusKm ?? location.radius_km,
  );

  const source = String(existing.source || location.source || 'streetbot_location').trim();

  const updatedAt = String(
    existing.updated_at || existing.updatedAt || location.updated_at || location.updatedAt || '',
  ).trim();

  const preferredCity = String(
    existing.preferred_city || existing.city || location.preferred_city || location.city || '',
  ).trim();

  const preferredProvince = String(
    existing.preferred_province ||
      existing.province ||
      location.preferred_province ||
      location.province ||
      '',
  ).trim();

  const latitude = Number(existing.latitude ?? existing.lat ?? location.lat ?? location.latitude);
  const longitude = Number(existing.longitude ?? existing.lon ?? location.lon ?? location.longitude);
  const locationLabel = String(
    existing.location_label ?? existing.label ?? location.label ?? '',
  ).trim();

  const context = {
    ...existing,
    ...(Number.isFinite(latitude) ? { latitude } : {}),
    ...(Number.isFinite(longitude) ? { longitude } : {}),
    ...(Number.isFinite(radiusKm) ? { radius_km: radiusKm } : {}),
    ...(locationLabel ? { location_label: locationLabel } : {}),
    ...(preferredCity ? { preferred_city: preferredCity } : {}),
    ...(preferredProvince ? { preferred_province: preferredProvince } : {}),
    ...(source ? { source } : {}),
    ...(updatedAt ? { updated_at: updatedAt } : {}),
  };

  req.body._streetbotUserContext = context;
  return context;
};

const maybeApplyStreetBotServiceToolChoice = async (req, parsedBody) => {
  const endpoint = String(
    req.params?.endpoint ??
      req.body?.endpoint ??
      req.body?.endpointOption?.endpoint ??
      parsedBody?.endpoint ??
      '',
  ).trim();
  if (!isStreetBotEndpoint(endpoint)) {
    return;
  }

  const userText = String(
    req.body?.text ??
      extractMessageText(req.body) ??
      getLastUserMessageText(req.body) ??
      '',
  ).trim();
  if (!userText) {
    return;
  }

  startStreetBotRequestTrace(req, {
    endpoint,
    userText,
    conversationId: req.body?.conversationId ?? parsedBody?.conversationId,
    phase: 'tool-choice',
  });

  const existingServiceContext =
    req.body?._streetbotServiceContext && typeof req.body._streetbotServiceContext === 'object'
      ? req.body._streetbotServiceContext
      : {};
  const conversationId = req.body?.conversationId ?? parsedBody?.conversationId;
  const serviceContext =
    existingServiceContext.session_id || existingServiceContext.query
      ? existingServiceContext
      : await loadStreetBotServiceContextFromConversation(req, conversationId);
  req._streetbotServiceContext = serviceContext;
  const userContext = buildStreetBotUserContext(req, parsedBody);

  const detectedIntent = await detectStreetBotIntent(
    userText,
    serviceContext,
    userContext,
  );
  const fastPath = Boolean(detectedIntent?.fastPath);
  const toolBase = fastPath ? String(detectedIntent?.toolBase || 'conversation') : 'conversation';

  req._streetbotFastPath = {
    endpoint,
    selectedSpec: parsedBody?.spec || req.body?.spec || '',
    selectedModel: parsedBody?.model || req.body?.model || '',
    selectedLabel:
      parsedBody?.modelLabel ||
      parsedBody?.modelDisplayLabel ||
      req.body?.modelLabel ||
      req.body?.modelDisplayLabel ||
      '',
    userText,
    normalized: String(detectedIntent?.normalized || '').trim(),
    toolBase,
    responseText: fastPath ? String(detectedIntent?.responseText || '').trim() : '',
    smalltalkKind: detectedIntent?.smalltalkKind || null,
  };
  req._streetbotSearchArgs = fastPath ? detectedIntent?.searchArgs || null : null;
  req._streetbotMoreArgs = fastPath ? detectedIntent?.moreArgs || null : null;
  req._streetbotCategoryArgs = fastPath ? detectedIntent?.categoryArgs || null : null;
  annotateStreetBotRequestTrace(req, {
    observation: {
      metadata: {
        toolBase,
        intentFastPath: fastPath,
        intentEmotional: Boolean(detectedIntent?.isEmotional),
        routeMode: fastPath ? 'fastpath' : 'deepagents_only',
      },
    },
    attributes: {
      'streetbot.intent.fast_path': fastPath,
      'streetbot.intent.is_emotional': Boolean(detectedIntent?.isEmotional),
      'streetbot.intent.tool_base': toolBase,
      'streetbot.route.deepagents_only': !fastPath,
    },
  });
  if (!fastPath) {
    logger.info(
      `[streetbot-deepagents] routing endpoint=${endpoint} through Deep Agents conversation path text=${userText.slice(0, 120)}`,
    );
  } else {
    logger.info(
      `[streetbot-fastpath] pre-routed endpoint=${endpoint} toolBase=${toolBase} text=${userText.slice(0, 120)}`,
    );
  }
  return;
};

async function buildEndpointOption(req, res, next) {
  const { endpoint, endpointType } = req.body;

  let endpointsConfig;
  try {
    endpointsConfig = await getEndpointsConfig(req);
  } catch (error) {
    logger.error('Error fetching endpoints config in buildEndpointOption', error);
  }

  const defaultParamsEndpoint = getDefaultParamsEndpointCompat(endpointsConfig, endpoint);

  let parsedBody;
  try {
    parsedBody = parseCompactConvo({
      endpoint,
      endpointType,
      conversation: req.body,
      defaultParamsEndpoint,
    });
    parsedBody = applyStreetBotModelDefaults(endpoint, endpointsConfig, req.config, parsedBody);
  } catch (error) {
    logger.error(`Error parsing compact conversation for endpoint ${endpoint}`, error);
    logger.debug({
      'Error parsing compact conversation': { endpoint, endpointType, conversation: req.body },
    });
    return handleError(res, { text: 'Error parsing conversation' });
  }

  await maybeApplyStreetBotServiceToolChoice(req, parsedBody);

  const appConfig = req.config;
  if (appConfig.modelSpecs?.list && appConfig.modelSpecs?.enforce) {
    const { list } = appConfig.modelSpecs;
    const { spec } = parsedBody;

    if (!spec) {
      return handleError(res, { text: 'No model spec selected' });
    }

    const currentModelSpec = list.find((s) => s.name === spec);
    if (!currentModelSpec) {
      return handleError(res, { text: 'Invalid model spec' });
    }

    if (endpoint !== currentModelSpec.preset.endpoint) {
      return handleError(res, { text: 'Model spec mismatch' });
    }

    try {
      currentModelSpec.preset.spec = spec;
      parsedBody = parseCompactConvo({
        endpoint,
        endpointType,
        conversation: currentModelSpec.preset,
        defaultParamsEndpoint,
      });
      parsedBody = applyStreetBotModelDefaults(endpoint, endpointsConfig, req.config, parsedBody);
      parsedBody.modelLabel =
        currentModelSpec.preset?.modelLabel ??
        currentModelSpec.label ??
        parsedBody.modelLabel;
      await maybeApplyStreetBotServiceToolChoice(req, parsedBody);
      const specIconURL = currentModelSpec.iconURL || currentModelSpec.preset?.iconURL;
      if (specIconURL != null && specIconURL !== '') {
        parsedBody.iconURL = specIconURL;
      }
    } catch (error) {
      logger.error(`Error parsing model spec for endpoint ${endpoint}`, error);
      return handleError(res, { text: 'Error parsing model spec' });
    }
  } else if (parsedBody.spec && appConfig.modelSpecs?.list) {
    const modelSpec = appConfig.modelSpecs.list.find((s) => s.name === parsedBody.spec);
    parsedBody.modelLabel =
      modelSpec?.preset?.modelLabel ??
      modelSpec?.label ??
      parsedBody.modelLabel;
    const specIconURL = modelSpec?.iconURL || modelSpec?.preset?.iconURL;
    if (specIconURL) {
      parsedBody.iconURL = specIconURL;
    }
  }

  try {
    const isAgents =
      isAgentsEndpoint(endpoint) || req.baseUrl.startsWith(EndpointURLs[EModelEndpoint.agents]);
    const builder = isAgents
      ? (...args) => buildFunction[EModelEndpoint.agents](req, ...args)
      : buildFunction[endpointType ?? endpoint];

    req.body = req.body || {};
    req.body.endpointOption = await builder(endpoint, parsedBody, endpointType);

    if (req.body.files && !isAgents) {
      req.body.endpointOption.attachments = updateFilesUsage(req.body.files);
    }

    next();
  } catch (error) {
    logger.error(
      `Error building endpoint option for endpoint ${endpoint} with type ${endpointType}`,
      error,
    );
    return handleError(res, { text: 'Error building endpoint option' });
  }
}

module.exports = buildEndpointOption;

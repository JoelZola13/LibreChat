const crypto = require('crypto');
const https = require('https');
const { logger } = require('@librechat/data-schemas');
const { context, trace, SpanStatusCode } = require('@opentelemetry/api');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { LangfuseSpanProcessor } = require('@langfuse/otel');
const { createObservationAttributes, createTraceAttributes } = require('@langfuse/tracing');

const TELEMETRY_SCOPE = 'streetbot.telemetry';
const TELEMETRY_VERSION = process.env.STREETBOT_OTEL_SERVICE_VERSION || '0.1.0';
const REWARD_SIGNALS_VERSION = 'v1';
const ROOT_SPAN_NAME = 'streetbot.chat.request';
const REQUEST_TRACE_KEY = '_streetbotTelemetryTrace';
const GLOBAL_STATE_KEY = '__streetBotTelemetryState';
const SENSITIVE_KEYWORDS = [
  'address',
  'api_key',
  'apikey',
  'authorization',
  'cookie',
  'email',
  'name',
  'phone',
  'refresh_token',
  'secret',
  'session',
  'token',
];

const state =
  globalThis[GLOBAL_STATE_KEY] ||
  (globalThis[GLOBAL_STATE_KEY] = {
    initialized: false,
    enabled: false,
    initError: null,
    sdk: null,
    loggedDisabledReason: false,
    posthogLastErrorAt: 0,
  });

function isTruthy(value, defaultValue = false) {
  if (value == null || value === '') {
    return defaultValue;
  }
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

function isTelemetryEnabled() {
  return isTruthy(process.env.STREETBOT_TELEMETRY_ENABLED, true);
}

function isLangfuseConfigured() {
  return Boolean(
    String(process.env.LANGFUSE_PUBLIC_KEY || '').trim() &&
      String(process.env.LANGFUSE_SECRET_KEY || '').trim(),
  );
}

function isPostHogConfigured() {
  return Boolean(String(process.env.STREETBOT_POSTHOG_KEY || '').trim());
}

function isPostHogLlmAnalyticsEnabled() {
  return isTruthy(process.env.STREETBOT_POSTHOG_LLM_ANALYTICS_ENABLED, true);
}

function shouldCaptureContent() {
  return isTruthy(process.env.STREETBOT_LANGFUSE_CAPTURE_CONTENT, false);
}

function shouldCapturePostHogContent() {
  return isTruthy(process.env.STREETBOT_POSTHOG_CAPTURE_CONTENT, false);
}

function scrubString(value) {
  return String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g, '[redacted-phone]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]+\b/gi, 'Bearer [redacted]')
    .replace(/\b(sk|pk)_[A-Za-z0-9_-]+\b/g, '[redacted-key]');
}

function scrubData(value, depth = 0) {
  if (value == null) {
    return value;
  }

  if (depth > 4) {
    return '[truncated]';
  }

  if (typeof value === 'string') {
    return scrubString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => scrubData(entry, depth + 1));
  }

  if (typeof value === 'object') {
    const output = {};
    for (const [key, entry] of Object.entries(value).slice(0, 40)) {
      const lowered = String(key || '').trim().toLowerCase();
      if (SENSITIVE_KEYWORDS.some((candidate) => lowered.includes(candidate))) {
        output[key] = '[redacted]';
      } else {
        output[key] = scrubData(entry, depth + 1);
      }
    }
    return output;
  }

  return String(value);
}

function summarizeStreetBotText(value) {
  const text = String(value || '').trim();
  const words = text ? text.split(/\s+/).filter(Boolean) : [];
  return {
    length: text.length,
    wordCount: words.length,
    startsWithSlash: text.startsWith('/'),
    hasQuestion: text.includes('?'),
    preview: shouldCaptureContent() ? scrubString(text).slice(0, 280) : undefined,
  };
}

function summarizePostHogText(value) {
  const summary = summarizeStreetBotText(value);
  if (shouldCapturePostHogContent()) {
    return scrubString(String(value || '')).slice(0, 2000);
  }
  return `[summary] length=${summary.length} words=${summary.wordCount} question=${summary.hasQuestion}`;
}

function buildPostHogTextMessage(role, value) {
  return {
    role: String(role || 'user'),
    content: summarizePostHogText(value),
  };
}

function normalizePostHogHost() {
  return String(process.env.STREETBOT_POSTHOG_HOST || 'https://us.i.posthog.com')
    .trim()
    .replace(/\/+$/, '');
}

function normalizePostHogDistinctId(value, fallback = 'streetbot-anonymous') {
  const text = String(value || '').trim();
  return text || fallback;
}

function maybeLogPostHogError(message, error) {
  const now = Date.now();
  if (now - Number(state.posthogLastErrorAt || 0) < 60000) {
    return;
  }
  state.posthogLastErrorAt = now;
  logger.error(message, error);
}

function postHogCapture(event, distinctId, properties = {}) {
  if (!isPostHogConfigured() || !isPostHogLlmAnalyticsEnabled()) {
    return Promise.resolve(false);
  }

  const apiKey = String(process.env.STREETBOT_POSTHOG_KEY || '').trim();
  const host = normalizePostHogHost();
  const url = new URL('/i/v0/e/', host);
  const payload = JSON.stringify({
    api_key: apiKey,
    event,
    properties: {
      distinct_id: normalizePostHogDistinctId(distinctId),
      ...scrubData(properties),
    },
  });

  return new Promise((resolve) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 4000,
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve(res.statusCode >= 200 && res.statusCode < 300));
      },
    );

    req.on('timeout', () => {
      req.destroy(new Error('PostHog request timeout'));
    });
    req.on('error', (error) => {
      maybeLogPostHogError('[streetbot-telemetry] PostHog LLM analytics capture failed', error);
      resolve(false);
    });
    req.write(payload);
    req.end();
  });
}

function captureStreetBotPostHogGeneration(options = {}) {
  const distinctId = normalizePostHogDistinctId(
    options.distinctId,
    options.sessionId || options.traceId || 'streetbot-anonymous',
  );
  return postHogCapture('$ai_generation', distinctId, {
    $ai_trace_id: options.traceId,
    $ai_session_id: options.sessionId,
    $ai_span_id: options.spanId,
    $ai_parent_id: options.parentId,
    $ai_span_name: options.spanName || 'streetbot_generation',
    $ai_model: options.model || 'streetbot-fastpath',
    $ai_provider: options.provider || 'streetbot',
    $ai_input: options.input,
    $ai_output_choices: options.outputChoices,
    $ai_latency: options.latencySeconds,
    $ai_http_status: options.httpStatus,
    $ai_is_error: Boolean(options.isError),
    $ai_error: options.error || undefined,
    ...normalizeAttributes(options.properties || {}),
  });
}

function captureStreetBotPostHogSpan(options = {}) {
  const distinctId = normalizePostHogDistinctId(
    options.distinctId,
    options.sessionId || options.traceId || 'streetbot-anonymous',
  );
  return postHogCapture('$ai_span', distinctId, {
    $ai_trace_id: options.traceId,
    $ai_session_id: options.sessionId,
    $ai_span_id: options.spanId,
    $ai_parent_id: options.parentId,
    $ai_span_name: options.spanName || 'streetbot_span',
    $ai_input_state: options.inputState,
    $ai_output_state: options.outputState,
    $ai_latency: options.latencySeconds,
    $ai_is_error: Boolean(options.isError),
    $ai_error: options.error || undefined,
    ...normalizeAttributes(options.properties || {}),
  });
}

function toOtelAttributeValue(value) {
  if (value == null) {
    return undefined;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    if (
      value.every(
        (entry) =>
          typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean',
      )
    ) {
      return value;
    }
    return JSON.stringify(scrubData(value));
  }

  return JSON.stringify(scrubData(value));
}

function normalizeAttributes(attributes = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(attributes || {})) {
    const next = toOtelAttributeValue(value);
    if (next !== undefined) {
      normalized[key] = next;
    }
  }
  return normalized;
}

function normalizeObservationAttributes(observation = {}) {
  const next = { ...observation };
  if (next.input !== undefined) {
    next.input = scrubData(next.input);
  }
  if (next.output !== undefined) {
    next.output = scrubData(next.output);
  }
  if (next.metadata !== undefined) {
    next.metadata = scrubData(next.metadata);
  }
  return next;
}

function normalizeTraceAttributes(traceAttributes = {}) {
  const next = { ...traceAttributes };
  if (next.input !== undefined) {
    next.input = scrubData(next.input);
  }
  if (next.output !== undefined) {
    next.output = scrubData(next.output);
  }
  if (next.metadata !== undefined) {
    next.metadata = scrubData(next.metadata);
  }
  if (Array.isArray(next.tags)) {
    next.tags = next.tags.filter(Boolean).map((entry) => String(entry));
  }
  return next;
}

function buildSpanAttributes(options = {}) {
  const attributes = {};

  Object.assign(attributes, normalizeAttributes(options.attributes));

  if (options.traceAttributes) {
    Object.assign(attributes, createTraceAttributes(normalizeTraceAttributes(options.traceAttributes)));
  }

  if (options.observation) {
    Object.assign(
      attributes,
      createObservationAttributes(
        options.observationType || 'span',
        normalizeObservationAttributes(options.observation),
      ),
    );
  }

  return attributes;
}

function getTelemetryTracer() {
  return trace.getTracer(TELEMETRY_SCOPE, TELEMETRY_VERSION);
}

function generateLocalTraceIdentifiers() {
  return {
    traceId: crypto.randomBytes(16).toString('hex'),
    spanId: crypto.randomBytes(8).toString('hex'),
    traceFlags: 0,
  };
}

function initStreetBotTelemetry() {
  if (state.initialized) {
    return state.enabled;
  }

  state.initialized = true;

  if (!isTelemetryEnabled()) {
    if (!state.loggedDisabledReason) {
      state.loggedDisabledReason = true;
      logger.info('[streetbot-telemetry] disabled by STREETBOT_TELEMETRY_ENABLED');
    }
    return false;
  }

  if (!isLangfuseConfigured()) {
    if (!state.loggedDisabledReason) {
      state.loggedDisabledReason = true;
      logger.info('[streetbot-telemetry] Langfuse keys not configured; server tracing is idle');
    }
    return false;
  }

  try {
    const processor = new LangfuseSpanProcessor({
      publicKey: String(process.env.LANGFUSE_PUBLIC_KEY || '').trim(),
      secretKey: String(process.env.LANGFUSE_SECRET_KEY || '').trim(),
      baseUrl: String(process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com').trim(),
      environment: String(
        process.env.LANGFUSE_TRACING_ENVIRONMENT ||
          process.env.NODE_ENV ||
          'development',
      ).trim(),
      release: String(
        process.env.LANGFUSE_RELEASE ||
          process.env.STREETBOT_OTEL_SERVICE_VERSION ||
          'streetbot-0.1',
      ).trim(),
      exportMode: isTruthy(process.env.STREETBOT_LANGFUSE_IMMEDIATE_EXPORT, false)
        ? 'immediate'
        : 'batched',
      shouldExportSpan: ({ otelSpan }) => String(otelSpan?.name || '').startsWith('streetbot.'),
      mask: ({ data }) => scrubData(data),
    });

    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [SemanticResourceAttributes.SERVICE_NAME]:
          process.env.STREETBOT_OTEL_SERVICE_NAME || 'streetbot-librechat',
        [SemanticResourceAttributes.SERVICE_VERSION]: TELEMETRY_VERSION,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
          process.env.LANGFUSE_TRACING_ENVIRONMENT ||
          process.env.NODE_ENV ||
          'development',
      }),
      spanProcessors: [processor],
    });

    const startResult = sdk.start();
    if (startResult && typeof startResult.catch === 'function') {
      startResult.catch((error) => {
        logger.error('[streetbot-telemetry] failed to start Langfuse NodeSDK', error);
      });
    }

    state.enabled = true;
    state.sdk = sdk;
    logger.info('[streetbot-telemetry] Langfuse tracing enabled');
    return true;
  } catch (error) {
    state.enabled = false;
    state.initError = error;
    logger.error('[streetbot-telemetry] failed to initialize Langfuse tracing', error);
    return false;
  }
}

function getStreetBotTelemetryStatus() {
  const enabledByEnv = isTelemetryEnabled();
  const langfuseConfigured = isLangfuseConfigured();
  const posthogConfigured = isPostHogConfigured();
  const posthogLlmAnalyticsEnabled = isPostHogLlmAnalyticsEnabled();
  const posthogProjectId = String(process.env.STREETBOT_POSTHOG_PROJECT_ID || '').trim();
  const posthogHost = String(
    process.env.STREETBOT_POSTHOG_HOST || 'https://us.i.posthog.com',
  ).trim();
  const posthogDefaults = String(process.env.STREETBOT_POSTHOG_DEFAULTS || '2026-01-30').trim();

  initStreetBotTelemetry();

  return {
    enabled_by_env: enabledByEnv,
    langfuse_configured: langfuseConfigured,
    langfuse_active: Boolean(state.enabled),
    langfuse_capture_content: shouldCaptureContent(),
    langfuse_export_mode: isTruthy(process.env.STREETBOT_LANGFUSE_IMMEDIATE_EXPORT, false)
      ? 'immediate'
      : 'batched',
    langfuse_base_url: String(process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com').trim(),
    langfuse_environment: String(
      process.env.LANGFUSE_TRACING_ENVIRONMENT || process.env.NODE_ENV || 'development',
    ).trim(),
    langfuse_release: String(
      process.env.LANGFUSE_RELEASE || process.env.STREETBOT_OTEL_SERVICE_VERSION || 'streetbot-0.1',
    ).trim(),
    posthog_configured: posthogConfigured,
    posthog_llm_analytics_enabled: posthogLlmAnalyticsEnabled,
    posthog_capture_content: shouldCapturePostHogContent(),
    posthog_project_id: posthogProjectId,
    posthog_host: posthogHost,
    posthog_defaults: posthogDefaults,
    service_name: String(process.env.STREETBOT_OTEL_SERVICE_NAME || 'streetbot-librechat').trim(),
    service_version: TELEMETRY_VERSION,
    reward_signals_version: REWARD_SIGNALS_VERSION,
    init_error: state.initError ? String(state.initError.message || state.initError) : '',
  };
}

function applyStreetBotSpanAttributes(span, options = {}) {
  if (!span) {
    return;
  }

  const attributes = buildSpanAttributes(options);
  if (Object.keys(attributes).length > 0) {
    span.setAttributes(attributes);
  }
}

function startStreetBotRequestTrace(req, info = {}) {
  initStreetBotTelemetry();

  if (!req) {
    return null;
  }

  if (req[REQUEST_TRACE_KEY]?.span || req[REQUEST_TRACE_KEY]?.traceId) {
    return req?.[REQUEST_TRACE_KEY] || null;
  }

  const endpoint = String(
    info.endpoint ||
      req.params?.endpoint ||
      req.body?.endpoint ||
      req.body?.endpointOption?.endpoint ||
      '',
  ).trim();
  const userText = String(info.userText || req.body?.text || '').trim();
  const conversationId = String(
    info.conversationId || req.body?.conversationId || '',
  ).trim();
  const routeKind = info.routeKind || (req._streetbotFastPath ? 'fastpath' : 'agent');
  const userId = req.user?.id ? String(req.user.id) : undefined;
  const promptSummary = summarizeStreetBotText(userText);
  const isOwnerEndpoint = /^Street Bot(?: 0\.1 Pro| Pro)$/i.test(endpoint);

  if (!state.enabled) {
    req[REQUEST_TRACE_KEY] = {
      ...generateLocalTraceIdentifiers(),
      span: null,
      context: null,
      finalized: false,
      synthetic: true,
    };
    return req[REQUEST_TRACE_KEY];
  }

  const span = getTelemetryTracer().startSpan(ROOT_SPAN_NAME, {
    attributes: buildSpanAttributes({
      traceAttributes: {
        name: ROOT_SPAN_NAME,
        userId,
        sessionId: conversationId && conversationId !== 'new' ? conversationId : undefined,
        input: promptSummary,
        metadata: {
          endpoint,
          routeKind,
          phase: info.phase || 'request',
          hasServiceContext: Boolean(req._streetbotServiceContext?.session_id),
          hasAgentId: Boolean(req.body?.agent_id),
          isProEndpoint: isOwnerEndpoint,
        },
        tags: ['streetbot', routeKind, isOwnerEndpoint ? 'pro' : 'public'].filter(Boolean),
      },
      observation: {
        input: promptSummary,
        metadata: {
          endpoint,
          routeKind,
          phase: info.phase || 'request',
        },
      },
      attributes: {
        'streetbot.endpoint': endpoint || 'unknown',
        'streetbot.route.kind': routeKind,
        'streetbot.prompt.length': promptSummary.length,
        'streetbot.prompt.word_count': promptSummary.wordCount,
        'streetbot.service_context': Boolean(req._streetbotServiceContext?.session_id),
      },
    }),
  });

  const spanContext = span.spanContext();
  req[REQUEST_TRACE_KEY] = {
    traceId: String(spanContext?.traceId || '').trim(),
    spanId: String(spanContext?.spanId || '').trim(),
    traceFlags: spanContext?.traceFlags ?? undefined,
    span,
    context: trace.setSpan(context.active(), span),
    finalized: false,
    synthetic: false,
  };

  return req[REQUEST_TRACE_KEY];
}

function runInStreetBotTrace(req, fn) {
  const traceState = req?.[REQUEST_TRACE_KEY];
  if (!traceState?.span || !traceState?.context) {
    return fn();
  }
  return context.with(traceState.context, fn);
}

function getStreetBotTraceIdentifiers(req) {
  const traceState = req?.[REQUEST_TRACE_KEY];
  if (traceState?.traceId || traceState?.spanId) {
    return {
      traceId: String(traceState?.traceId || '').trim(),
      spanId: String(traceState?.spanId || '').trim(),
      traceFlags: traceState?.traceFlags ?? undefined,
      synthetic: Boolean(traceState?.synthetic),
    };
  }
  const spanContext =
    traceState?.span && typeof traceState.span.spanContext === 'function'
      ? traceState.span.spanContext()
      : null;
  return {
    traceId: String(spanContext?.traceId || '').trim(),
    spanId: String(spanContext?.spanId || '').trim(),
    traceFlags: spanContext?.traceFlags ?? undefined,
    synthetic: false,
  };
}

function annotateStreetBotRequestTrace(req, options = {}) {
  const traceState = req?.[REQUEST_TRACE_KEY];
  if (!traceState?.span || traceState.finalized) {
    return;
  }
  applyStreetBotSpanAttributes(traceState.span, options);
}

function finalizeStreetBotRequestTrace(req, options = {}) {
  const traceState = req?.[REQUEST_TRACE_KEY];
  if (!traceState?.span || traceState.finalized) {
    return;
  }

  applyStreetBotSpanAttributes(traceState.span, {
    observationType: options.observationType || 'span',
    observation: {
      output: options.output,
      metadata: options.metadata,
    },
    attributes: options.attributes,
    traceAttributes: options.traceOutput
      ? {
          output: options.traceOutput,
          metadata: options.traceMetadata,
        }
      : undefined,
  });
  traceState.span.setStatus({ code: SpanStatusCode.OK });
  traceState.span.end();
  traceState.finalized = true;
}

function failStreetBotRequestTrace(req, error, options = {}) {
  const traceState = req?.[REQUEST_TRACE_KEY];
  if (!traceState?.span || traceState.finalized) {
    return;
  }

  const message = error instanceof Error ? error.message : String(error || 'Unknown error');
  applyStreetBotSpanAttributes(traceState.span, {
    observationType: options.observationType || 'span',
    observation: {
      level: 'ERROR',
      statusMessage: message,
      metadata: options.metadata,
    },
    attributes: options.attributes,
  });
  traceState.span.recordException(error instanceof Error ? error : new Error(message));
  traceState.span.setStatus({ code: SpanStatusCode.ERROR, message });
  traceState.span.end();
  traceState.finalized = true;
}

async function withStreetBotSpan(name, options, fn) {
  if (typeof options === 'function') {
    fn = options;
    options = {};
  }

  initStreetBotTelemetry();

  if (!state.enabled) {
    return fn(null);
  }

  return getTelemetryTracer().startActiveSpan(
    name,
    { attributes: buildSpanAttributes(options || {}) },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || 'Unknown error');
        applyStreetBotSpanAttributes(span, {
          observationType: options?.observationType || 'span',
          observation: {
            level: 'ERROR',
            statusMessage: message,
          },
        });
        span.recordException(error instanceof Error ? error : new Error(message));
        span.setStatus({ code: SpanStatusCode.ERROR, message });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}

module.exports = {
  annotateStreetBotRequestTrace,
  applyStreetBotSpanAttributes,
  buildPostHogTextMessage,
  captureStreetBotPostHogGeneration,
  captureStreetBotPostHogSpan,
  failStreetBotRequestTrace,
  finalizeStreetBotRequestTrace,
  getStreetBotTraceIdentifiers,
  getStreetBotTelemetryStatus,
  initStreetBotTelemetry,
  REWARD_SIGNALS_VERSION,
  runInStreetBotTrace,
  startStreetBotRequestTrace,
  summarizeStreetBotText,
  withStreetBotSpan,
};

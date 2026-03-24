import { Constants, ContentTypes, type Agents, type TMessage } from 'librechat-data-provider';

export const SERVICE_TOOL_NAMES = new Set([
  'services.search',
  'services.documents',
  'services.more',
  'services.categories',
  'services_search',
  'services_documents',
  'services_more',
  'services_categories',
]);

const normalizeValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (value == null) {
    return '';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export type ServiceToolCallInfo = {
  input: string;
  output: string;
  functionName: string;
};

export type ServiceResultPayload = {
  count?: number;
  items?: unknown[];
  results?: unknown[];
  services?: unknown[];
  data?: unknown[];
};

type ServiceLookupContext = {
  messageById: Map<string, TMessage>;
  indexById: Map<string, number>;
  directToolCallById: Map<string, ServiceToolCallInfo>;
  siblingServiceByParentId: Map<string, ServiceToolCallInfo>;
  previousServiceByIndex: Array<ServiceToolCallInfo | null>;
  nextServiceByIndex: Array<ServiceToolCallInfo | null>;
};

const payloadCache = new Map<string, ServiceResultPayload | null>();
const serviceLookupCache = new WeakMap<TMessage[], ServiceLookupContext>();

const safeParseJson = (value: string): any | null => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const setCachedPayload = (output: string, payload: ServiceResultPayload | null) => {
  payloadCache.set(output, payload);
  if (payloadCache.size > 100) {
    const oldestKey = payloadCache.keys().next().value;
    if (oldestKey) {
      payloadCache.delete(oldestKey);
    }
  }
  return payload;
};

export const extractServicePayload = (output: string): ServiceResultPayload | null => {
  if (payloadCache.has(output)) {
    return payloadCache.get(output) ?? null;
  }

  const direct = safeParseJson(output);
  if (direct && typeof direct === 'object') {
    if ('result' in direct && direct.result != null) {
      if (Array.isArray(direct.result)) {
        return setCachedPayload(output, {
          items: direct.result,
          count: direct.result.length,
        });
      }
      if (typeof direct.result === 'object') {
        return setCachedPayload(output, direct.result as ServiceResultPayload);
      }
    }
    if ('content' in direct && Array.isArray(direct.content)) {
      const text = direct.content
        .map((entry: { text?: string }) => entry?.text)
        .filter(Boolean)
        .join('\n');
      return setCachedPayload(
        output,
        text ? extractServicePayload(text) : (direct as ServiceResultPayload),
      );
    }
    if (Array.isArray(direct)) {
      if (direct.length > 0 && direct[0]?.text) {
        return setCachedPayload(output, extractServicePayload(String(direct[0].text)));
      }
      return setCachedPayload(output, {
        items: direct,
        count: direct.length,
      });
    }
    return setCachedPayload(output, direct as ServiceResultPayload);
  }

  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return setCachedPayload(output, safeParseJson(jsonMatch[0]) as ServiceResultPayload | null);
  }

  return setCachedPayload(output, null);
};

export const pickServiceItems = (payload: ServiceResultPayload | null): unknown[] => {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload.items)) {
    return payload.items;
  }
  if (Array.isArray(payload.results)) {
    return payload.results;
  }
  if (Array.isArray(payload.services)) {
    return payload.services;
  }
  if (Array.isArray(payload.data)) {
    return payload.data;
  }
  return [];
};

export const hasServiceResults = (output?: string | null): boolean => {
  if (!output || typeof output !== 'string') {
    return false;
  }
  const payload = extractServicePayload(output);
  if (!payload) {
    return false;
  }
  if (typeof payload.count === 'number') {
    return payload.count > 0;
  }
  return pickServiceItems(payload).length > 0;
};

export const extractServiceToolCall = (message?: TMessage): ServiceToolCallInfo | null => {
  if (!message?.content || !Array.isArray(message.content)) {
    return null;
  }

  for (const part of message.content) {
    if (!part || part.type !== ContentTypes.TOOL_CALL) {
      continue;
    }
    const toolCall = part[ContentTypes.TOOL_CALL] as
      | (Agents.ToolCall & {
          function?: {
            name?: unknown;
            arguments?: unknown;
            output?: unknown;
          };
        })
      | undefined;
    if (!toolCall) {
      continue;
    }

    let name: string | undefined;
    let args: unknown;
    let output: unknown;

    if ('name' in toolCall && typeof toolCall.name === 'string') {
      name = toolCall.name;
      args = toolCall.args;
      output = toolCall.output;
    } else if (typeof toolCall.function?.name === 'string') {
      name = toolCall.function.name;
      args = toolCall.function.arguments;
      output = toolCall.function.output;
    }

    if (!name) {
      continue;
    }

    const baseName = name.split(Constants.mcp_delimiter)[0];
    if (!SERVICE_TOOL_NAMES.has(baseName)) {
      continue;
    }

    return {
      input: normalizeValue(args),
      output: normalizeValue(output),
      functionName: baseName,
    };
  }

  return null;
};

const getMessageRole = (message: TMessage | undefined): string | undefined => {
  if (!message) {
    return undefined;
  }
  const roleCarrier = message as TMessage & { role?: string; author?: string };
  return message.isCreatedByUser ? 'user' : (roleCarrier.role ?? roleCarrier.author);
};

const buildServiceLookupContext = (messages: TMessage[]): ServiceLookupContext => {
  const messageById = new Map<string, TMessage>();
  const indexById = new Map<string, number>();
  const directToolCallById = new Map<string, ServiceToolCallInfo>();
  const siblingServiceByParentId = new Map<string, ServiceToolCallInfo>();
  const previousServiceByIndex: Array<ServiceToolCallInfo | null> = new Array(messages.length).fill(
    null,
  );
  const nextServiceByIndex: Array<ServiceToolCallInfo | null> = new Array(messages.length).fill(
    null,
  );

  let previousService: ServiceToolCallInfo | null = null;
  messages.forEach((message, index) => {
    if (!message) {
      return;
    }

    if (getMessageRole(message) === 'user') {
      previousService = null;
    }

    previousServiceByIndex[index] = previousService;

    if (message.messageId) {
      messageById.set(message.messageId, message);
      indexById.set(message.messageId, index);
    }

    const directToolCall = extractServiceToolCall(message);
    if (!directToolCall) {
      return;
    }

    if (message.messageId) {
      directToolCallById.set(message.messageId, directToolCall);
    }

    if (message.parentMessageId && !siblingServiceByParentId.has(message.parentMessageId)) {
      siblingServiceByParentId.set(message.parentMessageId, directToolCall);
    }

    previousService = directToolCall;
  });

  let nextService: ServiceToolCallInfo | null = null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) {
      continue;
    }

    if (getMessageRole(message) === 'user') {
      nextService = null;
    }

    nextServiceByIndex[index] = nextService;

    const directToolCall = message.messageId
      ? (directToolCallById.get(message.messageId) ?? extractServiceToolCall(message))
      : extractServiceToolCall(message);

    if (directToolCall) {
      nextService = directToolCall;
    }
  }

  return {
    messageById,
    indexById,
    directToolCallById,
    siblingServiceByParentId,
    previousServiceByIndex,
    nextServiceByIndex,
  };
};

const getServiceLookupContext = (messages: TMessage[]): ServiceLookupContext => {
  const cachedContext = serviceLookupCache.get(messages);
  if (cachedContext) {
    return cachedContext;
  }

  const nextContext = buildServiceLookupContext(messages);
  serviceLookupCache.set(messages, nextContext);
  return nextContext;
};

export const findRelatedServiceToolCall = (
  messages: TMessage[],
  message: TMessage,
): ServiceToolCallInfo | null => {
  if (!messages || messages.length === 0) {
    return null;
  }

  const {
    messageById,
    indexById,
    directToolCallById,
    siblingServiceByParentId,
    previousServiceByIndex,
    nextServiceByIndex,
  } = getServiceLookupContext(messages);

  const direct = message.messageId
    ? directToolCallById.get(message.messageId)
    : extractServiceToolCall(message);
  if (direct) {
    return direct;
  }

  const parentId = message.parentMessageId;
  if (parentId) {
    const parentMessage = messageById.get(parentId);
    const parentResult =
      (parentMessage?.messageId && directToolCallById.get(parentMessage.messageId)) ??
      extractServiceToolCall(parentMessage);
    if (parentResult) {
      return parentResult;
    }
    const siblingResult = siblingServiceByParentId.get(parentId);
    if (siblingResult) {
      return siblingResult;
    }
  }

  if (!message.messageId) {
    return null;
  }

  const currentIndex = indexById.get(message.messageId);
  if (currentIndex == null) {
    return null;
  }

  const previous = messages[currentIndex - 1];
  if (previous?.messageId) {
    const previousResult = directToolCallById.get(previous.messageId);
    if (previousResult) {
      return previousResult;
    }
  }

  const next = messages[currentIndex + 1];
  if (next?.messageId) {
    const nextResult = directToolCallById.get(next.messageId);
    if (nextResult) {
      return nextResult;
    }
  }

  return previousServiceByIndex[currentIndex] ?? nextServiceByIndex[currentIndex] ?? null;
};

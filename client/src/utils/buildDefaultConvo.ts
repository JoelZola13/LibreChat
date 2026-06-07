import {
  parseConvo,
  EModelEndpoint,
  isAgentsEndpoint,
  isEphemeralAgentId,
  isAssistantsEndpoint,
} from 'librechat-data-provider';
import type { TConversation, EndpointSchemaKey } from 'librechat-data-provider';
import { clearModelForNonEphemeralAgent } from './endpoints';
import { getLocalStorageItems } from './localStorage';

const buildDefaultConvo = ({
  models,
  conversation,
  endpoint = null,
  lastConversationSetup,
  defaultParamsEndpoint,
}: {
  models: string[];
  conversation: TConversation;
  endpoint?: EModelEndpoint | null;
  lastConversationSetup: TConversation | null;
  defaultParamsEndpoint?: string | null;
}): TConversation => {
  const { lastSelectedModel, lastSelectedTools } = getLocalStorageItems();
  const setupForParsing = lastConversationSetup ?? conversation ?? {};
  const endpointType =
    lastConversationSetup?.endpointType ??
    conversation?.endpointType ??
    (endpoint === 'Street Bot' ? EModelEndpoint.custom : undefined);

  if (!endpoint) {
    return {
      ...conversation,
      endpointType,
      endpoint,
    };
  }

  const pinnedSpecModel =
    setupForParsing?.spec && setupForParsing?.model ? String(setupForParsing.model) : '';
  const availableModels =
    pinnedSpecModel && !models.includes(pinnedSpecModel) ? [pinnedSpecModel, ...models] : models;
  const model = setupForParsing?.model ?? lastSelectedModel?.[endpoint] ?? '';

  let possibleModels: string[];

  if (availableModels.includes(model)) {
    possibleModels = [model, ...availableModels];
  } else {
    possibleModels = [...availableModels];
  }

  const convo = parseConvo({
    endpoint: endpoint as EndpointSchemaKey,
    endpointType: endpointType as EndpointSchemaKey,
    conversation: setupForParsing,
    possibleValues: {
      models: possibleModels,
    },
    defaultParamsEndpoint,
  });

  const defaultConvo = {
    ...conversation,
    ...convo,
    endpointType,
    endpoint,
  };

  // Ensures assistant_id is always defined
  const assistantId = convo?.assistant_id ?? conversation?.assistant_id ?? '';
  const defaultAssistantId = setupForParsing?.assistant_id ?? '';
  if (isAssistantsEndpoint(endpoint) && !defaultAssistantId && assistantId) {
    defaultConvo.assistant_id = assistantId;
  }

  // Ensures agent_id is always defined
  const agentId = convo?.agent_id ?? '';
  const defaultAgentId = setupForParsing?.agent_id ?? '';
  if (
    isAgentsEndpoint(endpoint) &&
    agentId &&
    (!defaultAgentId || isEphemeralAgentId(defaultAgentId))
  ) {
    defaultConvo.agent_id = agentId;
  }

  // Clear model for non-ephemeral agents - agents use their configured model internally
  clearModelForNonEphemeralAgent(defaultConvo);

  defaultConvo.tools = setupForParsing?.tools ?? lastSelectedTools ?? defaultConvo.tools;

  return defaultConvo;
};

export default buildDefaultConvo;

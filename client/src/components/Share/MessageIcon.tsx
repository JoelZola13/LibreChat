import { useMemo } from 'react';
import { UserIcon } from '@librechat/client';
import type { TMessage, Assistant, Agent } from 'librechat-data-provider';
import type { TMessageProps } from '~/common';
import MessageEndpointIcon from '../Endpoints/MessageEndpointIcon';
import ConvoIconURL from '~/components/Endpoints/ConvoIconURL';
import { getIconEndpoint, logger } from '~/utils';
import StreetAgentIcon, {
  getMarketplaceAgentIconId,
  isStreetBotModelId,
} from '~/components/Agents/StreetAgentIcon';
import StreetBotMarketplaceIcon from '~/components/Agents/StreetBotMarketplaceIcon';

export default function MessageIcon(
  props: Pick<TMessageProps, 'message' | 'conversation'> & {
    assistant?: false | Assistant;
    agent?: false | Agent;
  },
) {
  const { message, conversation, assistant, agent } = props;

  const messageSettings = useMemo(
    () => ({
      ...(conversation ?? {}),
      ...({
        ...message,
        iconURL: message?.iconURL ?? '',
      } as TMessage),
    }),
    [conversation, message],
  );

  const iconURL = messageSettings.iconURL ?? '';
  let endpoint = messageSettings.endpoint;
  endpoint = getIconEndpoint({ endpointsConfig: undefined, iconURL, endpoint });
  const assistantName = (assistant ? assistant.name : '') ?? '';
  const assistantAvatar = (assistant ? assistant.metadata?.avatar : '') ?? '';
  const agentName = (agent ? agent.name : '') ?? '';
  const agentAvatar = (agent ? agent?.avatar?.filepath : '') ?? '';
  const selectedModel = String(message?.model ?? conversation?.model ?? '');
  const messageSettingsRecord = messageSettings as Record<string, unknown>;
  const selectedAgentIconId = getMarketplaceAgentIconId(
    String((conversation as { spec?: string | null } | null)?.spec ?? ''),
    String(message?.sender ?? ''),
    String(messageSettingsRecord.sender ?? ''),
    String(messageSettingsRecord.chatGptLabel ?? ''),
    String(messageSettingsRecord.modelLabel ?? ''),
    String(message?.modelLabel ?? conversation?.modelLabel ?? ''),
    selectedModel,
    iconURL,
  );
  const avatarURL = useMemo(() => {
    let result = '';
    if (assistant) {
      result = assistantAvatar;
    } else if (agent) {
      result = agentAvatar;
    }
    return result;
  }, [assistant, agent, assistantAvatar, agentAvatar]);
  logger.log('MessageIcon', {
    endpoint,
    iconURL,
    assistantName,
    assistantAvatar,
    agentName,
    agentAvatar,
  });
  if (message?.isCreatedByUser !== true && iconURL) {
    if (selectedAgentIconId) {
      return (
        <span className="flex h-[28.8px] w-[28.8px] items-center justify-center">
          <StreetAgentIcon id={selectedAgentIconId} className="h-5 w-5" />
        </span>
      );
    }

    if (isStreetBotModelId(selectedModel)) {
      return <StreetBotMarketplaceIcon className="h-[28.8px] w-[28.8px]" />;
    }

    return (
      <ConvoIconURL
        iconURL={iconURL}
        modelLabel={messageSettings.chatGptLabel ?? messageSettings.modelLabel ?? ''}
        context="message"
        assistantAvatar={assistantAvatar}
        assistantName={assistantName}
        agentAvatar={agentAvatar}
        agentName={agentName}
      />
    );
  }

  if (message?.isCreatedByUser === true) {
    return (
      <div
        style={{
          backgroundColor: 'rgb(121, 137, 255)',
          width: '20px',
          height: '20px',
          boxShadow: 'rgba(240, 246, 252, 0.1) 0px 0px 0px 1px',
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-sm p-1 text-white"
      >
        <UserIcon />
      </div>
    );
  }

  if (selectedAgentIconId) {
    return (
      <span className="flex h-[28.8px] w-[28.8px] items-center justify-center">
        <StreetAgentIcon id={selectedAgentIconId} className="h-5 w-5" />
      </span>
    );
  }

  if (isStreetBotModelId(selectedModel)) {
    return <StreetBotMarketplaceIcon className="h-[28.8px] w-[28.8px]" />;
  }

  return (
    <MessageEndpointIcon
      {...messageSettings}
      endpoint={endpoint}
      iconURL={avatarURL || iconURL}
      model={message?.model ?? conversation?.model}
      assistantName={assistantName}
      agentName={agentName}
      size={28.8}
    />
  );
}

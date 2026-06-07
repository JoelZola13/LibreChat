import React, { useMemo, memo } from 'react';
import { getEndpointField } from 'librechat-data-provider';
import type { Assistant, Agent } from 'librechat-data-provider';
import type { TMessageIcon } from '~/common';
import ConvoIconURL from '~/components/Endpoints/ConvoIconURL';
import { useGetEndpointsQuery, useGetStartupConfig } from '~/data-provider';
import { getIconEndpoint, getModelSpecIconURL, logger } from '~/utils';
import Icon from '~/components/Endpoints/Icon';
import StreetAgentIcon, {
  getMarketplaceAgentIconId,
  isStreetBotModelId,
} from '~/components/Agents/StreetAgentIcon';
import StreetBotMarketplaceIcon from '~/components/Agents/StreetBotMarketplaceIcon';

const MessageIcon = memo(
  ({
    iconData,
    assistant,
    agent,
  }: {
    iconData?: TMessageIcon;
    assistant?: Assistant;
    agent?: Agent;
  }) => {
    logger.log('icon_data', iconData, assistant, agent);
    const { data: endpointsConfig } = useGetEndpointsQuery();
    const { data: startupConfig } = useGetStartupConfig();

    const agentName = useMemo(() => agent?.name ?? '', [agent]);
    const agentAvatar = useMemo(() => agent?.avatar?.filepath ?? '', [agent]);
    const assistantName = useMemo(() => assistant?.name ?? '', [assistant]);
    const assistantAvatar = useMemo(() => assistant?.metadata?.avatar ?? '', [assistant]);

    const avatarURL = useMemo(() => {
      let result = '';
      if (assistant) {
        result = assistantAvatar;
      } else if (agent) {
        result = agentAvatar;
      }
      return result;
    }, [assistant, agent, assistantAvatar, agentAvatar]);

    const iconURL = iconData?.iconURL;
    const specIconURL = useMemo(() => {
      const modelSpecs = startupConfig?.modelSpecs?.list ?? [];
      const model = iconData?.model ?? '';
      const label = iconData?.modelLabel ?? '';
      const spec = modelSpecs.find(
        (modelSpec) =>
          modelSpec.name === model ||
          modelSpec.preset?.model === model ||
          modelSpec.label === label ||
          modelSpec.preset?.modelLabel === label,
      );

      return spec ? getModelSpecIconURL(spec) : '';
    }, [startupConfig?.modelSpecs?.list, iconData?.model, iconData?.modelLabel]);
    const displayIconURL = iconURL || specIconURL;
    const selectedModel = String(iconData?.model ?? '');
    const iconRecord = (iconData ?? {}) as Record<string, unknown>;
    const selectedAgentIconId = getMarketplaceAgentIconId(
      selectedModel,
      String(iconRecord.sender ?? ''),
      String(iconRecord.chatGptLabel ?? ''),
      String(iconData?.modelLabel ?? ''),
      iconURL,
      specIconURL,
    );
    const endpoint = useMemo(
      () => getIconEndpoint({ endpointsConfig, iconURL: displayIconURL, endpoint: iconData?.endpoint }),
      [endpointsConfig, displayIconURL, iconData?.endpoint],
    );

    const endpointIconURL = useMemo(
      () => getEndpointField(endpointsConfig, endpoint, 'iconURL'),
      [endpointsConfig, endpoint],
    );

    if (iconData?.isCreatedByUser !== true && selectedAgentIconId) {
      return (
        <span className="flex h-[28.8px] w-[28.8px] items-center justify-center">
          <StreetAgentIcon id={selectedAgentIconId} className="h-5 w-5" />
        </span>
      );
    }

    if (iconData?.isCreatedByUser !== true && isStreetBotModelId(selectedModel)) {
      return <StreetBotMarketplaceIcon className="h-[28.8px] w-[28.8px]" />;
    }

    if (iconData?.isCreatedByUser !== true && displayIconURL != null && displayIconURL !== '') {
      return (
        <ConvoIconURL
          iconURL={displayIconURL}
          modelLabel={iconData?.modelLabel}
          context="message"
          assistantAvatar={assistantAvatar}
          agentAvatar={agentAvatar}
          endpointIconURL={endpointIconURL}
          assistantName={assistantName}
          agentName={agentName}
        />
      );
    }

    return (
      <Icon
        isCreatedByUser={iconData?.isCreatedByUser ?? false}
        endpoint={endpoint}
        iconURL={avatarURL || displayIconURL || endpointIconURL}
        model={iconData?.model}
        assistantName={assistantName}
        agentName={agentName}
        size={28.8}
      />
    );
  },
);

MessageIcon.displayName = 'MessageIcon';

export default MessageIcon;

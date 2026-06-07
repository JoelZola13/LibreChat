import React, { memo } from 'react';
import { getEndpointField } from 'librechat-data-provider';
import type { TModelSpec, TEndpointsConfig } from 'librechat-data-provider';
import type { IconMapProps } from '~/common';
import { getModelSpecIconURL, getIconKey } from '~/utils';
import { URLIcon } from '~/components/Endpoints/URLIcon';
import { icons } from '~/hooks/Endpoint/Icons';
import StreetAgentIcon, {
  getMarketplaceAgentIconId,
} from '~/components/Agents/StreetAgentIcon';
import StreetBotMarketplaceIcon from '~/components/Agents/StreetBotMarketplaceIcon';

interface SpecIconProps {
  currentSpec: TModelSpec;
  endpointsConfig: TEndpointsConfig;
}

type IconType = (props: IconMapProps) => React.JSX.Element;

const SpecIcon: React.FC<SpecIconProps> = ({ currentSpec, endpointsConfig }) => {
  const iconURL = getModelSpecIconURL(currentSpec);
  const { endpoint } = currentSpec.preset;
  const preset = currentSpec.preset as Record<string, unknown>;
  const specIds = [
    currentSpec.name,
    currentSpec.label,
    String(preset.spec ?? ''),
    String(preset.model ?? ''),
    String(preset.agent_id ?? ''),
    iconURL,
  ];
  const hasStreetBotSpec = specIds.some((id) => /^(streetbot-0\.1|streetbot-1-0)$/i.test(id));
  const marketplaceIconId = getMarketplaceAgentIconId(...specIds);

  if (marketplaceIconId) {
    return <StreetAgentIcon id={marketplaceIconId} className="h-5 w-5" />;
  }

  if (hasStreetBotSpec) {
    return <StreetBotMarketplaceIcon className="h-5 w-5" />;
  }

  const endpointIconURL = getEndpointField(endpointsConfig, endpoint, 'iconURL');
  const iconKey = getIconKey({ endpoint, endpointsConfig, endpointIconURL });
  let Icon: IconType;

  if (iconURL && (iconURL.includes('http') || iconURL.startsWith('/images/'))) {
    return (
      <URLIcon
        iconURL={iconURL}
        altName={currentSpec.name}
        containerStyle={{ width: 20, height: 20 }}
        className="icon-md shrink-0 overflow-hidden"
        endpoint={endpoint || undefined}
      />
    );
  }

  if (iconURL) {
    Icon = (icons[iconURL] ?? icons[iconKey] ?? icons.unknown) as IconType;
  } else {
    Icon = (icons[endpoint ?? ''] ?? icons[iconKey] ?? icons.unknown) as IconType;
  }

  return (
    <Icon
      size={20}
      endpoint={endpoint}
      context="menu-item"
      iconURL={endpointIconURL}
      className="icon-md shrink-0 text-text-primary"
    />
  );
};

export default memo(SpecIcon);

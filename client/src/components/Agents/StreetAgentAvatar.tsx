import React from 'react';
import { cn } from '~/utils';
import StreetBotMarketplaceIcon from './StreetBotMarketplaceIcon';
import StreetAgentIcon from './StreetAgentIcon';
import { type StreetAgent } from './streetCatalog';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'h-7 w-7',
  sm: 'h-11 w-11',
  md: 'h-14 w-14',
  lg: 'h-20 w-20',
};

const ICON_SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'h-[18px] w-[18px]',
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-12 w-12',
};

interface StreetAgentAvatarProps {
  agent: StreetAgent;
  size?: AvatarSize;
  className?: string;
}

/**
 * StreetBot mirrors the home/new-chat mascot.
 * Every other marketplace agent uses the same white outline language as the side panel.
 */
const StreetAgentAvatar: React.FC<StreetAgentAvatarProps> = ({ agent, size = 'sm', className }) => {
  const isStreetBot = agent.id === 'streetbot-1-0';

  return (
    <div
      className={cn(
        'relative flex shrink-0 select-none items-center justify-center leading-none',
        SIZE_CLASSES[size],
        className,
      )}
      aria-hidden="true"
    >
      {isStreetBot ? (
        <StreetBotMarketplaceIcon className={SIZE_CLASSES[size]} />
      ) : (
        <StreetAgentIcon id={agent.id} className={ICON_SIZE_CLASSES[size]} />
      )}
    </div>
  );
};

export default StreetAgentAvatar;

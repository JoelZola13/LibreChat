import React from 'react';
import { cn } from '~/utils';

const ICON_SRC = '/assets/streetbot-icon-home-dark-animated.svg?v=20260423k';

interface StreetBotMarketplaceIconProps {
  className?: string;
}

const StreetBotMarketplaceIcon: React.FC<StreetBotMarketplaceIconProps> = ({ className }) => (
  <span
    className={cn('flex shrink-0 items-center justify-center overflow-visible', className)}
    aria-label="Street Bot"
    title="Street Bot"
  >
    <img
      src={ICON_SRC}
      className="h-full w-full object-contain"
      alt=""
      aria-hidden="true"
    />
  </span>
);

export default StreetBotMarketplaceIcon;

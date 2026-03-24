import type { TStartupConfig } from 'librechat-data-provider';
import { isStreetBot } from '~/config/appVariant';

export function isBalanceFeatureEnabled(startupConfig?: TStartupConfig | null): boolean {
  return !!startupConfig?.balance?.enabled && !isStreetBot;
}

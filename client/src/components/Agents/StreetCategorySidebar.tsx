import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { cn } from '~/utils';
import StreetBotMarketplaceIcon from './StreetBotMarketplaceIcon';
import StreetAgentIcon from './StreetAgentIcon';
import { STREET_CATEGORIES, categoryCount } from './streetCatalog';

const LUCIDE: Record<string, React.ComponentType<{ className?: string }>> = {
  grid: LayoutGrid,
};

interface SidebarItem {
  value: string;
  label: string;
  lucide: string | null;
  emoji: string | null;
}

/** Home + All, then one category per top-level agent (with its emoji). */
export const SIDEBAR_ITEMS: SidebarItem[] = [
  { value: 'all', label: 'All', lucide: 'grid', emoji: null },
  ...STREET_CATEGORIES.map((c) => ({
    value: c.value,
    label: c.label,
    lucide: null,
    emoji: c.emoji,
  })),
];

interface StreetCategorySidebarProps {
  active: string;
  onChange: (value: string) => void;
}

/** LobeHub-style vertical category rail — mirrors the agent tree. */
const StreetCategorySidebar: React.FC<StreetCategorySidebarProps> = ({ active, onChange }) => (
  <nav className="flex w-full flex-col gap-0.5" aria-label="Agent categories">
    {SIDEBAR_ITEMS.map((item) => {
      const Lucide = item.lucide ? LUCIDE[item.lucide] : null;
      const isActive = active === item.value;
      const count = item.value === 'home' ? null : categoryCount(item.value);
      return (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          aria-current={isActive ? 'page' : undefined}
          className={cn(
            'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
            isActive
              ? 'bg-surface-tertiary font-semibold text-text-primary'
              : 'text-text-secondary hover:bg-surface-tertiary/60 hover:text-text-primary',
          )}
        >
          {isActive && (
            <span
              className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#FFD600]"
              aria-hidden="true"
            />
          )}
          {Lucide ? (
            <Lucide
              className={cn(
                'h-[18px] w-[18px] shrink-0',
                isActive ? 'text-[#FFD600]' : 'text-text-tertiary group-hover:text-text-secondary',
              )}
            />
          ) : (
            <span
              className="flex h-[18px] w-[18px] shrink-0 items-center justify-center leading-none"
              aria-hidden="true"
            >
              {item.value === 'streetbot-1-0' ? (
                <StreetBotMarketplaceIcon className="h-[18px] w-[18px]" />
              ) : (
                <StreetAgentIcon
                  id={item.value}
                  className={cn(
                    'h-[18px] w-[18px]',
                    isActive ? 'text-[#FFD600]' : 'text-text-tertiary group-hover:text-text-secondary',
                  )}
                />
              )}
            </span>
          )}
          <span className="flex-1 truncate text-left">{item.label}</span>
          {count != null && (
            <span
              className={cn(
                'text-xs tabular-nums',
                isActive ? 'text-text-secondary' : 'text-text-tertiary',
              )}
            >
              {count}
            </span>
          )}
        </button>
      );
    })}
  </nav>
);

export default StreetCategorySidebar;

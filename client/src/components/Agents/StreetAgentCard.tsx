import React from 'react';
import { MessageSquare, Boxes, Bookmark, Clock } from 'lucide-react';
import { cn } from '~/utils';
import StreetAgentAvatar from './StreetAgentAvatar';
import {
  CATEGORY_GRADIENTS,
  getAgentStats,
  getAgentDateLabel,
  getCardCategoryLabel,
  formatStat,
  type StreetAgent,
} from './streetCatalog';

interface StreetAgentCardProps {
  agent: StreetAgent;
  onSelect: (agent: StreetAgent) => void;
  className?: string;
}

/**
 * LobeHub-style agent tile: avatar + title + author, multi-line description,
 * a 3-metric stats row, then a divider with the updated date + category tag.
 * Themed to Street Voices gold/dark.
 */
const StreetAgentCard: React.FC<StreetAgentCardProps> = ({ agent, onSelect, className }) => {
  const stats = getAgentStats(agent);
  const [from] = CATEGORY_GRADIENTS[agent.category];

  return (
    <button
      type="button"
      onClick={() => onSelect(agent)}
      aria-label={`${agent.name} — ${agent.description}`}
      className={cn(
        'sv-card flex h-full w-full flex-col rounded-2xl border border-border-light bg-presentation p-4 text-left',
        className,
      )}
      style={{ backgroundImage: `linear-gradient(135deg, ${from}2b, transparent 62%)` }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <StreetAgentAvatar agent={agent} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-text-primary">
            {agent.name}
          </h3>
          <p className="truncate text-[13px] text-text-tertiary">by {agent.author}</p>
        </div>
      </div>

      {/* Description */}
      <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-text-secondary">
        {agent.description}
      </p>

      {/* Stats */}
      <div className="mt-3 flex items-center gap-4 text-xs text-text-tertiary">
        <span className="inline-flex items-center gap-1" title="Conversations">
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          {formatStat(stats.conversations)}
        </span>
        <span className="inline-flex items-center gap-1" title="Capabilities">
          <Boxes className="h-3.5 w-3.5" aria-hidden="true" />
          {stats.capabilities}
        </span>
        <span className="inline-flex items-center gap-1" title="Saves">
          <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
          {formatStat(stats.saves)}
        </span>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-border-light pt-2.5">
        <span className="inline-flex items-center gap-1 text-[11px] text-text-tertiary">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {getAgentDateLabel(agent)}
        </span>
        <span className="rounded-md bg-surface-hover px-2 py-0.5 text-[11px] font-medium text-text-secondary">
          {getCardCategoryLabel(agent)}
        </span>
      </div>
    </button>
  );
};

export default StreetAgentCard;

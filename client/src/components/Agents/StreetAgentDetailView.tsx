import React, { useMemo, useState } from 'react';
import {
  ChevronRight,
  MessageSquare,
  Boxes,
  Bookmark,
  Share2,
  Sparkles,
  ArrowUpRight,
  Users,
} from 'lucide-react';
import { useToastContext } from '@librechat/client';
import { cn } from '~/utils';
import StreetAgentAvatar from './StreetAgentAvatar';
import {
  getAgentStats,
  getAgentDateLabel,
  getCardCategoryLabel,
  getConversationStarters,
  getSystemRole,
  getRelatedAgents,
  getMembers,
  formatStat,
  type StreetAgent,
} from './streetCatalog';

interface StreetAgentDetailViewProps {
  agent: StreetAgent;
  onBack: () => void;
  onSelectAgent: (agent: StreetAgent) => void;
  onStartChat: (agent: StreetAgent) => void;
}

/** Minimal markdown renderer for the synthetic system role (headings, bullets, paragraphs). */
const SystemRole: React.FC<{ text: string }> = ({ text }) => (
  <div className="space-y-2">
    {text.split('\n').map((line, i) => {
      if (line.trim() === '') {
        return <div key={i} className="h-1" />;
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <h4 key={i} className="pt-2 text-sm font-semibold text-text-primary">
            {line.replace(/\*\*/g, '')}
          </h4>
        );
      }
      if (line.startsWith('- ')) {
        return (
          <div key={i} className="flex gap-2 text-sm text-text-secondary">
            <span className="text-[#FFD600]">•</span>
            <span>{line.slice(2)}</span>
          </div>
        );
      }
      return (
        <p key={i} className="text-sm leading-relaxed text-text-secondary">
          {line}
        </p>
      );
    })}
  </div>
);

const StatPills: React.FC<{ agent: StreetAgent }> = ({ agent }) => {
  const stats = getAgentStats(agent);
  return (
    <div className="flex items-center gap-4 text-sm text-text-tertiary">
      <span className="inline-flex items-center gap-1.5" title="Conversations">
        <MessageSquare className="h-4 w-4" aria-hidden="true" />
        {formatStat(stats.conversations)}
      </span>
      <span className="inline-flex items-center gap-1.5" title="Capabilities">
        <Boxes className="h-4 w-4" aria-hidden="true" />
        {stats.capabilities}
      </span>
      <span className="inline-flex items-center gap-1.5" title="Saves">
        <Bookmark className="h-4 w-4" aria-hidden="true" />
        {formatStat(stats.saves)}
      </span>
    </div>
  );
};

const StreetAgentDetailView: React.FC<StreetAgentDetailViewProps> = ({
  agent,
  onBack,
  onSelectAgent,
  onStartChat,
}) => {
  const { showToast } = useToastContext();
  const members = useMemo(() => getMembers(agent), [agent]);
  const related = useMemo(() => getRelatedAgents(agent, 6), [agent]);
  const starters = useMemo(() => getConversationStarters(agent), [agent]);

  type Tab = 'overview' | 'settings' | 'team';
  const tabs = useMemo(() => {
    const base: { value: Tab; label: string }[] = [
      { value: 'overview', label: 'Overview' },
      { value: 'settings', label: 'Agent Settings' },
    ];
    if (members.length > 0) {
      base.push({ value: 'team', label: `Team Agents` });
    }
    return base;
  }, [members.length]);
  const [tab, setTab] = useState<Tab>('overview');

  // Reset to overview whenever the agent changes
  React.useEffect(() => {
    setTab('overview');
  }, [agent.id]);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/agents?agent=${agent.id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => showToast({ message: 'Link copied to clipboard' }))
      .catch(() => showToast({ message: 'Could not copy link', status: 'error' }));
  };

  return (
    <div className="sv-market sv-fade-up mx-auto max-w-6xl px-4 pb-16 pt-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-text-tertiary" aria-label="Breadcrumb">
        <button type="button" onClick={onBack} className="transition-colors hover:text-text-primary">
          Street Bot
        </button>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <button type="button" onClick={onBack} className="transition-colors hover:text-text-primary">
          Agents
        </button>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="truncate text-text-secondary">{agent.name}</span>
      </nav>

      {/* Header */}
      <div className="mt-5 flex items-start gap-4">
        <StreetAgentAvatar agent={agent} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-text-primary md:text-3xl">{agent.name}</h1>
          <p className="mt-1 text-sm text-text-tertiary">
            by <span className="font-medium text-[#FFD600]">{agent.author}</span>
            <span className="mx-1.5">•</span>
            {getAgentDateLabel(agent)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <span className="sv-chip-gold inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold">
              {getCardCategoryLabel(agent)}
            </span>
            <StatPills agent={agent} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex items-center gap-6 border-b border-border-light">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              'relative -mb-px border-b-2 px-0.5 pb-3 text-sm font-medium transition-colors',
              tab === t.value
                ? 'border-[#FFD600] text-text-primary'
                : 'border-transparent text-text-tertiary hover:text-text-secondary',
            )}
          >
            {t.label}
            {t.value === 'team' && members.length > 0 && (
              <span className="ml-1.5 rounded-full bg-surface-hover px-1.5 py-0.5 text-[10px] text-text-secondary">
                {members.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column */}
        <div className="min-w-0">
          {tab === 'overview' && (
            <div className="space-y-8">
              {/* What can you do */}
              <section>
                <h2 className="mb-2 text-lg font-semibold text-text-primary">
                  What can you do with this agent?
                </h2>
                <p className="text-[15px] leading-relaxed text-text-secondary">
                  {agent.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {agent.tags.map((tg) => (
                    <span
                      key={tg}
                      className="rounded-full bg-surface-tertiary px-2.5 py-0.5 text-xs font-medium text-text-secondary"
                    >
                      {tg}
                    </span>
                  ))}
                </div>
              </section>

              {/* Conversation starters */}
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-text-primary">
                  <Sparkles className="h-4 w-4 text-[#FFD600]" aria-hidden="true" />
                  Conversation Starters
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {starters.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onStartChat(agent)}
                      className="group flex items-center justify-between gap-2 rounded-xl border border-border-light bg-surface-tertiary px-4 py-3 text-left text-sm text-text-secondary transition-all hover:-translate-y-0.5 hover:border-[#FFD600]/40 hover:text-text-primary"
                    >
                      <span className="line-clamp-2">{s}</span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-text-tertiary transition-colors group-hover:text-[#FFD600]" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </section>

              {/* Agent demo */}
              <section>
                <h2 className="mb-3 text-lg font-semibold text-text-primary">Agent Demo</h2>
                <div className="space-y-3 rounded-2xl border border-border-light bg-surface-tertiary/50 p-5">
                  <div className="flex items-start gap-2.5">
                    <StreetAgentAvatar agent={agent} size="sm" />
                    <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-surface-secondary px-4 py-2.5 text-sm text-text-primary">
                      Hi! I&apos;m the {agent.name}. {agent.description.split('—')[0].trim()} — how can
                      I help?
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[#FFD600] px-4 py-2.5 text-sm font-medium text-[#1a1c24]">
                      {starters[0]}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {tab === 'settings' && (
            <div className="rounded-2xl border border-border-light bg-surface-tertiary/50 p-5">
              <h2 className="mb-3 text-lg font-semibold text-text-primary">System Role</h2>
              <SystemRole text={getSystemRole(agent)} />
            </div>
          )}

          {tab === 'team' && (
            <div>
              <p className="mb-3 text-sm text-text-secondary">
                {agent.name} coordinates {members.length} specialist agents. Open any of them to dive
                in.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelectAgent(m)}
                    className="flex items-start gap-3 rounded-xl border border-border-light bg-surface-tertiary p-3 text-left transition-all hover:-translate-y-0.5 hover:border-[#FFD600]/40"
                  >
                    <StreetAgentAvatar agent={m} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">{m.name}</p>
                      <p className="line-clamp-2 text-xs text-text-tertiary">{m.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right rail */}
        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onStartChat(agent)}
              className="sv-cta flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm"
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Start Conversation
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              title="Share"
              aria-label="Share"
              className="flex items-center justify-center rounded-xl border border-border-light bg-surface-tertiary px-3 text-text-secondary transition-colors hover:border-[#FFD600]/40 hover:text-text-primary"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="rounded-2xl border border-border-light bg-surface-tertiary/40 p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
              <Users className="h-4 w-4 text-[#FFD600]" aria-hidden="true" />
              Related Agents
            </h3>
            <div className="space-y-1">
              {related.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelectAgent(r)}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-surface-hover"
                >
                  <StreetAgentAvatar agent={r} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{r.name}</p>
                    <p className="truncate text-xs text-text-tertiary">
                      {getCardCategoryLabel(r)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default StreetAgentDetailView;

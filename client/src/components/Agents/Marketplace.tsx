import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Boxes, ChevronRight } from 'lucide-react';
import { QueryKeys } from 'librechat-data-provider';
import JobBoardTopNav from '~/components/streetbot/jobs/JobBoardTopNav';
import { useDocumentTitle } from '~/hooks';
import { useChatContext } from '~/Providers';
import { clearMessagesCache } from '~/utils';
import StreetAgentCard from './StreetAgentCard';
import StreetAgentDetailView from './StreetAgentDetailView';
import StreetCategorySidebar from './StreetCategorySidebar';
import {
  STREET_AGENTS,
  STREET_CATEGORIES,
  filterAgents,
  sortAgents,
  getAgentById,
  getAgentModelId,
  getCategoryDisplayLabel,
  categoryCount,
  type StreetAgent,
} from './streetCatalog';
import './streetMarketplace.css';

interface AgentMarketplaceProps {
  className?: string;
}

/**
 * AgentMarketplace — Street Bot 1.0 agent marketplace.
 *
 * Product-page layout (Street Voices top nav + hero + a bordered content panel
 * holding the agent-tree category rail, a Featured grid, and the orchestrator
 * Hub cards), themed to the Street Voices gold/dark brand and populated with the
 * full Street Bot agent fleet.
 */
const AgentMarketplace: React.FC<AgentMarketplaceProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { conversation } = useChatContext();

  const [category, setCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState<StreetAgent | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useDocumentTitle('Agent Marketplace | Street Bot');

  // Deep-link support: /agents?agent=<id> opens that agent's detail view
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const agent = getAgentById(params.get('agent') || undefined);
    if (agent) {
      setSelectedAgent(agent);
    }
  }, []);

  const trimmedQuery = searchQuery.trim();
  const results = useMemo(() => {
    if (trimmedQuery) {
      return filterAgents('all', searchQuery);
    }
    return category === 'all' ? sortAgents(STREET_AGENTS, 'recommended') : filterAgents(category, '');
  }, [category, searchQuery, trimmedQuery]);

  const openAgent = (agent: StreetAgent) => {
    setSelectedAgent(agent);
    scrollContainerRef.current?.scrollTo({ top: 0 });
  };
  const handleCategory = (value: string) => {
    setSelectedAgent(null);
    setCategory(value);
    setSearchQuery('');
    scrollContainerRef.current?.scrollTo({ top: 0 });
  };

  const handleStartChat = (agent: StreetAgent) => {
    const agentModel = getAgentModelId(agent);
    clearMessagesCache(queryClient, conversation?.conversationId);
    queryClient.invalidateQueries([QueryKeys.messages]);
    setSelectedAgent(null);
    const encodedAgentModel = encodeURIComponent(agentModel);
    navigate(`/c/new?spec=${encodedAgentModel}&agentModel=${encodedAgentModel}`);
  };

  const sectionHeader = (title: string, icon: React.ReactNode, viewAll?: () => void) => (
    <div className="mb-5 flex items-center justify-between">
      <h2 className="flex items-center gap-2.5 text-xl font-bold text-text-primary">
        {icon}
        {title}
      </h2>
      {viewAll && (
        <button
          type="button"
          onClick={viewAll}
          className="flex items-center gap-0.5 text-sm text-text-tertiary transition-colors hover:text-[#FFD600]"
        >
          View all
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );

  const cardGrid = (agents: StreetAgent[]) => (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[2240px]:grid-cols-5">
      {agents.map((agent) => (
        <StreetAgentCard key={agent.id} agent={agent} onSelect={openAgent} />
      ))}
    </div>
  );

  return (
    <div
      className={`relative flex w-full grow flex-col overflow-hidden bg-presentation ${className}`}
    >
      <JobBoardTopNav
        placeholder="Search agents..."
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={setSearchQuery}
      />
      <div
        ref={scrollContainerRef}
        className="sv-market relative flex-1 overflow-y-auto overflow-x-hidden"
      >
        {selectedAgent ? (
          <div className="pt-4">
            <StreetAgentDetailView
              agent={selectedAgent}
              onBack={() => setSelectedAgent(null)}
              onSelectAgent={openAgent}
              onStartChat={handleStartChat}
            />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[2400px] px-6 pb-16 pt-7 lg:px-10">
            {/* Hero */}
            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#FFD600]/25 bg-[#FFD600]/10">
                <LayoutGrid className="h-7 w-7 text-[#FFD600]" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
                  Agent Marketplace
                </h1>
                <p className="mt-1 text-base text-text-secondary md:text-lg">
                  Discover and connect with AI agents built to support your mission.
                </p>
              </div>
            </div>

            {/* Content — blended into the page background (no boxed panel) */}
            <div>
              <div className="flex">
                <aside className="hidden w-64 shrink-0 border-r border-border-light pr-4 lg:block">
                  <div className="scrollbar-hide sticky top-4 max-h-[calc(100vh-88px)] overflow-y-auto">
                    <StreetCategorySidebar active={category} onChange={handleCategory} />
                  </div>
                </aside>

                <div className="min-w-0 flex-1 lg:pl-9">
                  {trimmedQuery ? (
                    <section>
                      <div className="mb-4">
                        <h2 className="text-xl font-bold text-text-primary">
                          Results for “{trimmedQuery}”
                        </h2>
                        <p className="mt-1 text-sm text-text-secondary">
                          {results.length} agent{results.length === 1 ? '' : 's'} found
                        </p>
                      </div>
                      {results.length > 0 ? (
                        cardGrid(results)
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
                          <div className="text-4xl" aria-hidden="true">
                            🔍
                          </div>
                          <h3 className="text-lg font-semibold text-text-primary">No agents found</h3>
                          <p className="max-w-sm text-sm text-text-secondary">
                            Try a different search term or browse a category.
                          </p>
                        </div>
                      )}
                    </section>
                  ) : category === 'all' ? (
                    <section>
                      {sectionHeader(
                        'All Agents',
                        <Boxes className="h-5 w-5 text-[#FFD600]" aria-hidden="true" />,
                      )}
                      {cardGrid(sortAgents(STREET_AGENTS, 'recommended'))}
                    </section>
                  ) : (
                    <section>
                      <div className="mb-4">
                        <h2 className="text-xl font-bold text-text-primary">
                          {getCategoryDisplayLabel(category)}
                        </h2>
                        <p className="mt-1 text-sm text-text-secondary">
                          {categoryCount(category)} agent{categoryCount(category) === 1 ? '' : 's'} ·{' '}
                          {STREET_CATEGORIES.find((c) => c.value === category)?.description ?? ''}
                        </p>
                      </div>
                      {cardGrid(results)}
                    </section>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentMarketplace;

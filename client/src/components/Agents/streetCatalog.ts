/**
 * Street Bot 1.0 — Agent Marketplace catalog.
 *
 * A curated, front-end catalog of every agent in the Street Bot mind map.
 * Used by the redesigned (LobeHub-style) Agent Marketplace at /agents.
 *
 * This is intentionally self-contained so the marketplace renders the full
 * Street Bot agent fleet without depending on backend-seeded marketplace agents.
 */

/** Visual palette — drives the avatar gradient only (not navigation). */
export type AgentPalette =
  | 'brand'
  | 'productivity'
  | 'career'
  | 'finance'
  | 'marketing'
  | 'creative'
  | 'engineering'
  | 'knowledge';

/**
 * A marketplace category. Categories mirror the agent tree: there is one
 * category per top-level agent (value = that agent's id), plus the synthetic
 * "all". Selecting a category shows the agent and any of its sub-agents.
 */
export interface StreetCategory {
  /** 'all' or a top-level agent id. */
  value: string;
  label: string;
  /** Emoji shown as the category icon in the rail. */
  emoji: string;
  /** Short blurb shown under the section heading. */
  description: string;
}

export interface StreetAgent {
  id: string;
  name: string;
  /** Emoji used as the avatar glyph. */
  emoji: string;
  /** Visual palette — drives the avatar gradient only. */
  category: AgentPalette;
  author: string;
  description: string;
  tags: string[];
  /** Curated highlight on the landing view. */
  featured?: boolean;
  /** Parent hub id for member (sub) agents. */
  parent?: string;
  /** Member agent ids for manager hubs. */
  members?: string[];
  /** Named grouping category (e.g. 'social') for peer agents not tied to a hub. */
  group?: string;
}

export const AGENT_MODEL_IDS: Record<string, string> = {
  'streetbot-1-0': 'streetbot-0.1',
  'project-manager': 'agent/project_manager_agent',
  'employment-counsellor': 'agent/employment_counsellor',
  'grant-manager': 'agent/grant_manager',
  'marketing-manager': 'agent/marketing_manager',
  'personal-assistant': 'agent/personal_assistant',
  brain: 'agent/brain_agent',
  evaluation: 'agent/evaluation_agent',
  directory: 'agent/directory_agent',
  accounting: 'agent/accounting_agent',
  'cyber-security': 'agent/cyber_security_agent',
  'services-rag': 'agent/services_rag_agent',
  'dev-ops': 'agent/dev_ops_agent',
  analytics: 'agent/analytics_agent',
  academy: 'agent/academy_agent',
  health: 'agent/health_agent',
  legal: 'agent/legal_agent',
  'art-curator': 'agent/gallery_agent',
  storage: 'agent/storage_agent',
  documents: 'agent/documents_agent',
  calendar: 'agent/calendar_agent',
  messaging: 'agent/messaging_agent',
  task: 'agent/task_agent',
  groups: 'agent/groups_agent',
  'resume-cover-letter': 'agent/resume_cover_letter_agent',
  'employment-client': 'agent/employment_client_agent',
  'job-search': 'agent/job_search_agent',
  'grant-writer': 'agent/grant_writer',
  'project-plan': 'agent/project_plan_agent',
  budget: 'agent/budget_agent',
  'grant-researcher': 'agent/grant_researcher_agent',
  designer: 'agent/designer_agent',
  'market-research': 'agent/market_research_agent',
  videography: 'agent/videography_agent',
  'local-news': 'agent/local_news_agent',
  'national-news': 'agent/national_news_agent',
  'international-news': 'agent/international_news_agent',
  contract: 'agent/contract_agent',
  'market-analysis': 'agent/market_analysis_agent',
  'copy-writer': 'agent/copy_writer_agent',
  'city-of-toronto': 'agent/city_of_toronto_agent',
  'homeless-hub': 'agent/homeless_hub_agent',
  counseling: 'agent/counseling_agent',
  'open-data': 'agent/open_data_agent',
  conversational: 'agent/conversational_agent',
  'street-profile': 'agent/street_profile_agent',
  profiles: 'agent/profiles_agent',
  'word-on-the-street': 'agent/word_on_the_street_agent',
};

/** Palette → avatar gradient, for visual variety across the grid. */
export const CATEGORY_GRADIENTS: Record<AgentPalette, [string, string]> = {
  brand: ['#FFD600', '#D4A017'],
  productivity: ['#3B82F6', '#2563EB'],
  career: ['#8B5CF6', '#6D28D9'],
  finance: ['#10B981', '#047857'],
  marketing: ['#F97316', '#C2410C'],
  creative: ['#EC4899', '#BE185D'],
  engineering: ['#06B6D4', '#0E7490'],
  knowledge: ['#6366F1', '#4338CA'],
};

const AUTHOR = 'Street Voices';

export const STREET_AGENTS: StreetAgent[] = [
  /* ───────────────────────── Flagship ───────────────────────── */
  {
    id: 'streetbot-1-0',
    name: 'Streetbot 1.0',
    emoji: '🤖',
    category: 'brand',
    author: AUTHOR,
    description:
      'The flagship Street Bot — your all-in-one AI companion that ties the whole agent fleet together and helps with anything, anytime.',
    tags: ['Flagship', 'All-in-One', 'Street Bot'],
  },

  /* ───────────────────────── Orchestrator hubs ───────────────────────── */
  {
    id: 'project-manager',
    name: 'Project Manager Agent',
    emoji: '📋',
    category: 'productivity',
    author: AUTHOR,
    featured: true,
    members: ['storage', 'documents', 'calendar', 'task'],
    description:
      'Plans, tracks, and coordinates your projects end-to-end — delegating to a team of specialist agents to assign tasks, set deadlines, and keep everyone aligned.',
    tags: ['Planning', 'Coordination', 'Delegation'],
  },
  {
    id: 'employment-counsellor',
    name: 'Employment Counsellor Agent',
    emoji: '💼',
    category: 'career',
    author: AUTHOR,
    featured: true,
    members: ['resume-cover-letter', 'employment-client', 'job-search'],
    description:
      'Guides your whole job search — tailored advice, application support, and interview prep — backed by a crew of employment specialists.',
    tags: ['Careers', 'Coaching', 'Jobs'],
  },
  {
    id: 'grant-manager',
    name: 'Grant Manager Agent',
    emoji: '🏛️',
    category: 'finance',
    author: AUTHOR,
    featured: true,
    members: ['grant-writer', 'project-plan', 'budget', 'grant-researcher'],
    description:
      'Runs the full grant lifecycle — opportunity discovery, proposal writing, project planning, and budgeting — so funding gets won and tracked.',
    tags: ['Grants', 'Funding', 'Proposals'],
  },
  {
    id: 'marketing-manager',
    name: 'Marketing Manager Agent',
    emoji: '📣',
    category: 'marketing',
    author: AUTHOR,
    featured: true,
    members: [
      'designer',
      'market-research',
      'videography',
      'local-news',
      'national-news',
      'international-news',
      'contract',
      'market-analysis',
      'copy-writer',
    ],
    description:
      'Orchestrates campaigns across content, design, research, and news — directing nine specialist agents to grow your reach and tell your story.',
    tags: ['Campaigns', 'Content', 'Growth'],
  },

  /* ───────────────────────── Core standalone agents ───────────────────────── */
  {
    id: 'personal-assistant',
    name: 'Personal Assistant Agent',
    emoji: '🤖',
    category: 'productivity',
    author: AUTHOR,
    featured: true,
    description:
      'Your everyday AI aide — reminders, quick answers, drafting, and getting small things done without the busywork.',
    tags: ['Assistant', 'Everyday', 'Reminders'],
  },
  {
    id: 'brain',
    name: 'Brain Agent',
    emoji: '🧠',
    category: 'engineering',
    author: AUTHOR,
    featured: true,
    description:
      'The reasoning core of Street Bot — routes requests to the right agent, recalls context, and connects the fleet so everything works as one.',
    tags: ['Reasoning', 'Memory', 'Routing'],
  },
  {
    id: 'evaluation',
    name: 'Evaluation Agent',
    emoji: '📊',
    category: 'knowledge',
    author: AUTHOR,
    description:
      'Assesses performance, scores submissions against rubrics, and delivers clear, structured feedback you can act on.',
    tags: ['Scoring', 'Feedback', 'Quality'],
  },
  {
    id: 'directory',
    name: 'Directory Agent',
    emoji: '📒',
    category: 'engineering',
    author: AUTHOR,
    description:
      'Searches and surfaces people, services, and resources from the Street Voices directory in seconds.',
    tags: ['Search', 'Services', 'Lookup'],
  },
  {
    id: 'accounting',
    name: 'Accounting Agent',
    emoji: '🧾',
    category: 'finance',
    author: AUTHOR,
    description:
      'Handles bookkeeping, expense tracking, invoicing, and tidy financial summaries so the numbers always add up.',
    tags: ['Bookkeeping', 'Expenses', 'Invoices'],
  },
  {
    id: 'cyber-security',
    name: 'Cyber Security Agent',
    emoji: '🛡️',
    category: 'engineering',
    author: AUTHOR,
    description:
      'Monitors threats, audits configurations, and hardens your security posture before problems become incidents.',
    tags: ['Security', 'Threats', 'Audits'],
  },
  {
    id: 'services-rag',
    name: 'Services RAG Agent',
    emoji: '📚',
    category: 'engineering',
    author: AUTHOR,
    group: 'social',
    description:
      'Retrieval-augmented answers grounded in your services knowledge base — accurate, sourced, and always up to date.',
    tags: ['RAG', 'Knowledge Base', 'Retrieval'],
  },
  {
    id: 'dev-ops',
    name: 'Dev Ops Agent',
    emoji: '⚙️',
    category: 'engineering',
    author: AUTHOR,
    description:
      'Automates deployments, watches infrastructure, and manages CI/CD pipelines so releases ship smoothly.',
    tags: ['CI/CD', 'Infra', 'Automation'],
  },
  {
    id: 'analytics',
    name: 'Analytics Agent',
    emoji: '📈',
    category: 'engineering',
    author: AUTHOR,
    description:
      'Turns raw data into dashboards, trends, and plain-language insights that drive better decisions.',
    tags: ['Dashboards', 'Insights', 'Reporting'],
  },
  {
    id: 'academy',
    name: 'Academy Agent',
    emoji: '🎓',
    category: 'knowledge',
    author: AUTHOR,
    description:
      'Delivers courses, lessons, and personalised learning paths straight from the Street Academy.',
    tags: ['Learning', 'Courses', 'Coaching'],
  },
  {
    id: 'health',
    name: 'Health Agent',
    emoji: '🩺',
    category: 'knowledge',
    author: AUTHOR,
    description:
      'Provides wellbeing guidance, trusted health resources, and care navigation when you need a hand.',
    tags: ['Wellbeing', 'Health', 'Care'],
  },
  {
    id: 'legal',
    name: 'Legal Agent',
    emoji: '⚖️',
    category: 'knowledge',
    author: AUTHOR,
    description:
      'Explains your rights in plain English, reviews documents, and points you to the right legal resources.',
    tags: ['Legal', 'Rights', 'Documents'],
  },
  {
    id: 'art-curator',
    name: 'Art Curator Agent',
    emoji: '🎨',
    category: 'creative',
    author: AUTHOR,
    description:
      'Curates galleries, recommends artwork, and tells the story behind every piece in the Street Gallery.',
    tags: ['Art', 'Gallery', 'Curation'],
  },

  /* ───────────────────────── Project Manager members ───────────────────────── */
  {
    id: 'storage',
    name: 'Storage Agent',
    emoji: '🗄️',
    category: 'productivity',
    author: AUTHOR,
    parent: 'project-manager',
    description: 'Organises, stores, and retrieves your files and assets so nothing gets lost.',
    tags: ['Files', 'Storage', 'Assets'],
  },
  {
    id: 'documents',
    name: 'Documents Agent',
    emoji: '📄',
    category: 'productivity',
    author: AUTHOR,
    parent: 'project-manager',
    description:
      'Drafts, formats, and manages documents and records with a consistent house style.',
    tags: ['Documents', 'Drafting', 'Records'],
  },
  {
    id: 'calendar',
    name: 'Calendar Agent',
    emoji: '📅',
    category: 'productivity',
    author: AUTHOR,
    parent: 'project-manager',
    description: 'Schedules events, sends reminders, and keeps your calendar conflict-free.',
    tags: ['Scheduling', 'Reminders', 'Calendar'],
  },
  {
    id: 'messaging',
    name: 'Messaging Agent',
    emoji: '💬',
    category: 'productivity',
    author: AUTHOR,
    group: 'street-profile',
    description: 'Sends, sorts, and summarises messages across all your channels.',
    tags: ['Messaging', 'Inbox', 'Summaries'],
  },
  {
    id: 'task',
    name: 'Task Agent',
    emoji: '✅',
    category: 'productivity',
    author: AUTHOR,
    parent: 'project-manager',
    description: 'Creates, assigns, and tracks tasks all the way to done.',
    tags: ['Tasks', 'To-dos', 'Tracking'],
  },
  {
    id: 'groups',
    name: 'Groups Agent',
    emoji: '👥',
    category: 'productivity',
    author: AUTHOR,
    group: 'street-profile',
    description: 'Manages groups, memberships, and collaborative spaces for your community.',
    tags: ['Groups', 'Members', 'Collaboration'],
  },

  /* ───────────────────────── Employment Counsellor members ───────────────────────── */
  {
    id: 'resume-cover-letter',
    name: 'Resume & Cover Letter Agent',
    emoji: '📝',
    category: 'career',
    author: AUTHOR,
    parent: 'employment-counsellor',
    description: 'Writes and tailors resumes and cover letters that actually land interviews.',
    tags: ['Resume', 'Cover Letter', 'Applications'],
  },
  {
    id: 'employment-client',
    name: 'Employment Client Agent',
    emoji: '🤝',
    category: 'career',
    author: AUTHOR,
    parent: 'employment-counsellor',
    description: 'Manages client relationships and employment case files from intake to placement.',
    tags: ['Clients', 'Case Files', 'Support'],
  },
  {
    id: 'job-search',
    name: 'Job Search Agent',
    emoji: '🔎',
    category: 'career',
    author: AUTHOR,
    parent: 'employment-counsellor',
    description: 'Finds and matches roles to your skills, goals, and location.',
    tags: ['Jobs', 'Matching', 'Search'],
  },

  /* ───────────────────────── Grant Manager members ───────────────────────── */
  {
    id: 'grant-writer',
    name: 'Grant Writer Agent',
    emoji: '✍️',
    category: 'finance',
    author: AUTHOR,
    parent: 'grant-manager',
    description: 'Researches funders and writes compelling, requirement-perfect grant proposals.',
    tags: ['Grants', 'Writing', 'Proposals'],
  },
  {
    id: 'project-plan',
    name: 'Project Plan Agent',
    emoji: '🗺️',
    category: 'finance',
    author: AUTHOR,
    parent: 'grant-manager',
    description: 'Builds detailed project plans, timelines, and milestones funders love to see.',
    tags: ['Planning', 'Timelines', 'Milestones'],
  },
  {
    id: 'budget',
    name: 'Budget Agent',
    emoji: '💰',
    category: 'finance',
    author: AUTHOR,
    parent: 'grant-manager',
    description: 'Creates and tracks budgets and funding allocations down to the line item.',
    tags: ['Budgets', 'Allocations', 'Tracking'],
  },
  {
    id: 'grant-researcher',
    name: 'Grant Researcher Agent',
    emoji: '🔍',
    category: 'finance',
    author: AUTHOR,
    parent: 'grant-manager',
    description:
      'Scouts and shortlists funding opportunities, eligibility criteria, and deadlines matched to your mission.',
    tags: ['Research', 'Funders', 'Eligibility'],
  },

  /* ───────────────────────── Marketing Manager members ───────────────────────── */
  {
    id: 'designer',
    name: 'Designer Agent',
    emoji: '🖌️',
    category: 'creative',
    author: AUTHOR,
    parent: 'marketing-manager',
    description: 'Designs graphics, layouts, and on-brand visuals for any channel.',
    tags: ['Design', 'Graphics', 'Branding'],
  },
  {
    id: 'market-research',
    name: 'Market Research Agent',
    emoji: '🔬',
    category: 'marketing',
    author: AUTHOR,
    parent: 'marketing-manager',
    description: 'Researches markets, audiences, and competitors to sharpen your strategy.',
    tags: ['Research', 'Audience', 'Competitors'],
  },
  {
    id: 'videography',
    name: 'Videography Agent',
    emoji: '🎥',
    category: 'creative',
    author: AUTHOR,
    parent: 'marketing-manager',
    description: 'Plans, scripts, and edits video content that stops the scroll.',
    tags: ['Video', 'Editing', 'Scripts'],
  },
  {
    id: 'local-news',
    name: 'Local News Agent',
    emoji: '🗞️',
    category: 'marketing',
    author: AUTHOR,
    parent: 'marketing-manager',
    description: 'Curates and writes local news and community stories that matter.',
    tags: ['News', 'Local', 'Community'],
  },
  {
    id: 'national-news',
    name: 'National News Agent',
    emoji: '📰',
    category: 'marketing',
    author: AUTHOR,
    parent: 'marketing-manager',
    description: 'Covers national headlines and trends with a Street Voices lens.',
    tags: ['News', 'National', 'Trends'],
  },
  {
    id: 'international-news',
    name: 'International News Agent',
    emoji: '🌍',
    category: 'marketing',
    author: AUTHOR,
    parent: 'marketing-manager',
    description: 'Tracks global news and world events relevant to your audience.',
    tags: ['News', 'Global', 'World'],
  },
  {
    id: 'contract',
    name: 'Contract Agent',
    emoji: '📜',
    category: 'knowledge',
    author: AUTHOR,
    parent: 'marketing-manager',
    description: 'Drafts, reviews, and manages contracts and agreements with confidence.',
    tags: ['Contracts', 'Agreements', 'Review'],
  },
  {
    id: 'market-analysis',
    name: 'Market Analysis Agent',
    emoji: '📊',
    category: 'marketing',
    author: AUTHOR,
    parent: 'marketing-manager',
    description: 'Analyses campaign performance and market data to find what works.',
    tags: ['Analysis', 'Performance', 'Data'],
  },
  {
    id: 'copy-writer',
    name: 'Copy Writer Agent',
    emoji: '🖊️',
    category: 'creative',
    author: AUTHOR,
    parent: 'marketing-manager',
    description: 'Writes punchy, persuasive copy for ads, posts, emails, and pages.',
    tags: ['Copywriting', 'Ads', 'Content'],
  },

  /* ───────────────────────── Social (civic & community) ───────────────────────── */
  {
    id: 'city-of-toronto',
    name: 'City of Toronto Agent',
    emoji: '🏙️',
    category: 'engineering',
    author: AUTHOR,
    group: 'social',
    description:
      'Navigate City of Toronto services, programs, bylaws, and 311 requests in plain language.',
    tags: ['City Services', '311', 'Toronto'],
  },
  {
    id: 'homeless-hub',
    name: 'Homeless Hub Agent',
    emoji: '🏠',
    category: 'knowledge',
    author: AUTHOR,
    group: 'social',
    description:
      'Connects people to shelters, drop-ins, housing, and emergency supports across the city.',
    tags: ['Shelters', 'Housing', 'Support'],
  },
  {
    id: 'counseling',
    name: 'Counseling Agent',
    emoji: '🫂',
    category: 'career',
    author: AUTHOR,
    group: 'social',
    description:
      'Offers a supportive, listening space and connects you to mental-health and crisis resources.',
    tags: ['Mental Health', 'Support', 'Crisis'],
  },
  {
    id: 'open-data',
    name: 'Open Data Agent',
    emoji: '🗂️',
    category: 'productivity',
    author: AUTHOR,
    group: 'social',
    description:
      'Explores, queries, and visualises open datasets from the City of Toronto and beyond.',
    tags: ['Open Data', 'Datasets', 'Insights'],
  },
  {
    id: 'conversational',
    name: 'Conversational Agent',
    emoji: '🗣️',
    category: 'creative',
    author: AUTHOR,
    group: 'social',
    description:
      'A friendly, natural conversation partner — chat, ask questions, and get help on anything, anytime.',
    tags: ['Conversation', 'Chat', 'Q&A'],
  },

  /* ───────────────────────── Street Profile (community) ───────────────────────── */
  {
    id: 'street-profile',
    name: 'Street Profile Agent',
    emoji: '👤',
    category: 'productivity',
    author: AUTHOR,
    group: 'street-profile',
    description:
      'Coordinates profile, messaging, groups, and Word on the Street actions for Street Profile.',
    tags: ['Street Profile', 'Coordinator', 'Community'],
  },
  {
    id: 'profiles',
    name: 'Profiles Agent',
    emoji: '🪪',
    category: 'career',
    author: AUTHOR,
    group: 'street-profile',
    description:
      'Builds and manages your Street Profile — bio, links, posts, and your public presence.',
    tags: ['Profile', 'Bio', 'Presence'],
  },
  {
    id: 'word-on-the-street',
    name: 'Word on the Street Agent',
    emoji: '📢',
    category: 'marketing',
    author: AUTHOR,
    group: 'street-profile',
    description: "Shares community news, posts, and what's happening on the street.",
    tags: ['Community', 'News', 'Posts'],
  },
];

/* ───────────────────────── Helpers ───────────────────────── */

export const getAgentById = (id?: string): StreetAgent | undefined =>
  id ? STREET_AGENTS.find((a) => a.id === id) : undefined;

export const getAgentModelId = (agent: StreetAgent): string => AGENT_MODEL_IDS[agent.id];

const normalizeAgentModelId = (modelId?: string | null) => {
  if (!modelId) {
    return '';
  }
  const withoutQuery = modelId.trim().split('?')[0];
  try {
    return decodeURIComponent(withoutQuery)
      .trim()
      .replace(/^spec-agent\//, 'agent/');
  } catch {
    return withoutQuery.trim().replace(/^spec-agent\//, 'agent/');
  }
};

export const getAgentByModelId = (modelId?: string | null): StreetAgent | undefined => {
  const normalizedModelId = normalizeAgentModelId(modelId);
  const agentId = Object.entries(AGENT_MODEL_IDS).find(
    ([, agentModelId]) => agentModelId === normalizedModelId,
  )?.[0];

  return getAgentById(agentId);
};

export const getAgentDisplayNameByModelId = (modelId?: string | null): string | undefined =>
  getAgentByModelId(modelId)?.name;

export const getMembers = (agent: StreetAgent): StreetAgent[] =>
  (agent.members ?? []).map(getAgentById).filter((a): a is StreetAgent => Boolean(a));

/* ───────────────────────── Category tree (one per top-level agent) ───────────────────────── */

/** Top-level agents — each is its own marketplace category (grouped agents are excluded). */
export const TOP_LEVEL_AGENTS: StreetAgent[] = STREET_AGENTS.filter((a) => !a.parent && !a.group);

/** Concise category labels for the manager hubs + named groups (others derive from the name). */
const GROUP_LABEL_OVERRIDES: Record<string, string> = {
  'streetbot-1-0': 'Streetbot',
  'project-manager': 'Project Management',
  'employment-counsellor': 'Employment',
  'grant-manager': 'Grants',
  'marketing-manager': 'Marketing',
  social: 'Social',
  'street-profile': 'Street Profile',
};

/** Short label for a top-level agent's category. */
export const getGroupLabel = (agentId: string): string =>
  GROUP_LABEL_OVERRIDES[agentId] ?? getAgentById(agentId)?.name.replace(/\s*Agent$/, '') ?? agentId;

/** The category an agent belongs to: its parent hub, its named group, or itself if top-level. */
export const getAgentGroupId = (agent: StreetAgent): string =>
  agent.parent ?? agent.group ?? agent.id;

/** Category label shown on an agent's card / detail (its group). */
export const getCardCategoryLabel = (agent: StreetAgent): string =>
  getGroupLabel(getAgentGroupId(agent));

/** Named grouping categories that aren't backed by a single top-level agent. */
export const GROUP_CATEGORIES: StreetCategory[] = [
  {
    value: 'social',
    label: 'Social',
    emoji: '🤝',
    description: 'Civic, community, and social-services agents.',
  },
  {
    value: 'street-profile',
    label: 'Street Profile',
    emoji: '👤',
    description: 'Your profile, messaging, posts, and community groups.',
  },
];

/** One category per top-level agent, plus the named group categories. */
export const STREET_CATEGORIES: StreetCategory[] = [
  ...TOP_LEVEL_AGENTS.map((agent) => ({
    value: agent.id,
    label: getGroupLabel(agent.id),
    emoji: agent.emoji,
    description: agent.description,
  })),
  ...GROUP_CATEGORIES,
];

/** Display label for a category value used in the rail / headings. */
export const getCategoryDisplayLabel = (value: string): string =>
  value === 'all' ? 'All' : value === 'featured' ? 'Featured' : getGroupLabel(value);

/** Count of real (selectable) agents, useful for the hero stat. */
export const TOTAL_AGENTS = STREET_AGENTS.length;

/**
 * Resolve a category value to its agent set, honouring the tree:
 *  - 'all'      → every agent
 *  - 'featured' → curated highlights
 *  - <agentId>  → that top-level agent followed by its sub-agents
 */
const GROUP_CATEGORY_VALUES = new Set(GROUP_CATEGORIES.map((c) => c.value));

export const agentsForCategory = (category: string): StreetAgent[] => {
  if (category === 'all') {
    return STREET_AGENTS;
  }
  if (category === 'featured') {
    return STREET_AGENTS.filter((a) => a.featured);
  }
  if (GROUP_CATEGORY_VALUES.has(category)) {
    return STREET_AGENTS.filter((a) => a.group === category);
  }
  const agent = getAgentById(category);
  return agent ? [agent, ...getMembers(agent)] : [];
};

/** Filter the catalog by category + free-text search. */
export const filterAgents = (category: string, query: string): StreetAgent[] => {
  const q = query.trim().toLowerCase();
  return agentsForCategory(category).filter((agent) => {
    if (!q) {
      return true;
    }
    return (
      agent.name.toLowerCase().includes(q) ||
      agent.description.toLowerCase().includes(q) ||
      agent.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
};

/* ───────────────────────── Stats, dates & sorting (LobeHub-style) ───────────────────────── */

/** Stable FNV-1a hash so synthetic stats stay constant between renders. */
const hashString = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export interface AgentStats {
  /** Conversations started with this agent. */
  conversations: number;
  /** Tools / capabilities the agent can call (member count for hubs). */
  capabilities: number;
  /** Times saved to a workspace. */
  saves: number;
}

export const getAgentStats = (agent: StreetAgent): AgentStats => {
  const h = hashString(agent.id);
  return {
    conversations: 900 + (h % 9300),
    capabilities: agent.members?.length ?? 2 + ((h >>> 4) % 7),
    saves: 80 + ((h >>> 9) % 4700),
  };
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] as const;
const agentDateParts = (agent: StreetAgent) => {
  const h = hashString(`${agent.id}:date`);
  return { month: h % MONTHS.length, day: 1 + (h % 27) };
};
export const getAgentDateLabel = (agent: StreetAgent): string => {
  const { month, day } = agentDateParts(agent);
  return `${MONTHS[month]} ${day}, 2026`;
};
const getAgentDateValue = (agent: StreetAgent): number => {
  const { month, day } = agentDateParts(agent);
  return month * 100 + day;
};

/** Compact number formatting: 9300 → "9.3k". */
export const formatStat = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${n}`;

export const categoryCount = (value: string): number => agentsForCategory(value).length;

export type SortValue = 'recommended' | 'popular' | 'newest' | 'az';
export const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'newest', label: 'Recently Added' },
  { value: 'az', label: 'A – Z' },
];

export const sortAgents = (agents: StreetAgent[], sort: SortValue): StreetAgent[] => {
  const arr = [...agents];
  switch (sort) {
    case 'popular':
      return arr.sort((a, b) => getAgentStats(b).conversations - getAgentStats(a).conversations);
    case 'newest':
      return arr.sort((a, b) => getAgentDateValue(b) - getAgentDateValue(a));
    case 'az':
      return arr.sort((a, b) => a.name.localeCompare(b.name));
    case 'recommended':
    default:
      return arr.sort(
        (a, b) =>
          Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
          getAgentStats(b).conversations - getAgentStats(a).conversations,
      );
  }
};

/** Example prompts shown on the detail "Overview" tab. */
export const getConversationStarters = (agent: StreetAgent): string[] => {
  const short = agent.name.replace(/\s*Agent$/, '');
  const tag = (agent.tags[0] ?? 'this').toLowerCase();
  const tag2 = (agent.tags[1] ?? agent.tags[0] ?? 'getting started').toLowerCase();
  const starters = [
    `What can you help me with as the ${short}?`,
    `Show me a quick example of ${tag} you can handle.`,
    `Walk me through ${tag2} step by step.`,
  ];
  if (agent.members?.length) {
    starters.splice(1, 0, `Which of your team agents is best for ${tag}?`);
  }
  return starters.slice(0, 4);
};

/** A synthetic "system role" blurb for the Agent Settings tab. */
export const getSystemRole = (agent: StreetAgent): string => {
  const short = agent.name.replace(/\s*Agent$/, '');
  const label = agent.members?.length
    ? '**Coordination**'
    : agent.parent
      ? '**Reports to**'
      : '**Operating style**';
  const body = agent.members?.length
    ? `You coordinate a team of ${agent.members.length} specialist agents, route each request to the right one, and synthesise their work into a single result.`
    : agent.parent
      ? `You operate as part of the ${
          getAgentById(agent.parent)?.name ?? 'team'
        } team and hand finished work back up the chain.`
      : `You work directly with the user, ask clarifying questions when needed, and keep ${short.toLowerCase()} tasks moving to completion.`;
  return [
    `You are the ${agent.name}, a specialist member of the Street Bot 1.0 agent fleet.`,
    '',
    '**Role**',
    agent.description,
    '',
    '**Focus areas**',
    ...agent.tags.map((t) => `- ${t}`),
    '',
    label,
    body,
  ].join('\n');
};

/** Related agents: members / siblings / parent first, then same-category peers, then featured. */
export const getRelatedAgents = (agent: StreetAgent, n = 6): StreetAgent[] => {
  const pool: StreetAgent[] = [];
  if (agent.members?.length) {
    pool.push(...getMembers(agent));
  }
  if (agent.parent) {
    const parent = getAgentById(agent.parent);
    if (parent) {
      pool.push(parent, ...getMembers(parent));
    }
  }
  pool.push(...STREET_AGENTS.filter((a) => a.category === agent.category));
  pool.push(...STREET_AGENTS.filter((a) => a.featured));

  const seen = new Set<string>([agent.id]);
  const out: StreetAgent[] = [];
  for (const a of pool) {
    if (!seen.has(a.id)) {
      seen.add(a.id);
      out.push(a);
    }
  }
  return out.slice(0, n);
};

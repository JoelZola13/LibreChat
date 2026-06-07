import React from 'react';
import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileBadge,
  FilePenLine,
  FileText,
  FolderOpen,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Megaphone,
  MessageCircle,
  Microscope,
  Network,
  Palette,
  PenLine,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '~/utils';

const AGENT_ICONS: Record<string, LucideIcon> = {
  'project-manager': ClipboardCheck,
  'employment-counsellor': Briefcase,
  'grant-manager': Landmark,
  'marketing-manager': Megaphone,
  'personal-assistant': Sparkles,
  brain: Brain,
  evaluation: BarChart3,
  directory: BookOpen,
  accounting: FileText,
  'cyber-security': ShieldCheck,
  'services-rag': Database,
  'dev-ops': Network,
  analytics: BarChart3,
  academy: GraduationCap,
  health: Stethoscope,
  legal: Scale,
  'art-curator': Palette,
  storage: FolderOpen,
  documents: FileText,
  calendar: CalendarDays,
  messaging: MessageCircle,
  task: ClipboardList,
  groups: Users,
  'resume-cover-letter': FilePenLine,
  'employment-client': BadgeCheck,
  'job-search': Briefcase,
  'grant-writer': PenLine,
  'project-plan': ClipboardCheck,
  budget: FileText,
  'grant-researcher': Search,
  designer: Palette,
  'market-research': Microscope,
  videography: Video,
  'local-news': MessageCircle,
  'national-news': FileText,
  'international-news': Network,
  contract: FileBadge,
  'market-analysis': BarChart3,
  'copy-writer': PenLine,
  'city-of-toronto': Building2,
  'homeless-hub': Home,
  counseling: HeartPulse,
  'open-data': Database,
  conversational: MessageCircle,
  profiles: FileBadge,
  'word-on-the-street': Megaphone,
  social: Network,
  'street-profile': Users,
};

const MODEL_TO_MARKETPLACE_AGENT_ID: Record<string, string> = {
  'agent/street_profile_agent': 'street-profile',
  'agent/project_manager_agent': 'project-manager',
  'agent/employment_counsellor': 'employment-counsellor',
  'agent/grant_manager': 'grant-manager',
  'agent/marketing_manager': 'marketing-manager',
  'agent/personal_assistant': 'personal-assistant',
  'agent/brain_agent': 'brain',
  'agent/evaluation_agent': 'evaluation',
  'agent/directory_agent': 'directory',
  'agent/accounting_agent': 'accounting',
  'agent/cyber_security_agent': 'cyber-security',
  'agent/services_rag_agent': 'services-rag',
  'agent/dev_ops_agent': 'dev-ops',
  'agent/analytics_agent': 'analytics',
  'agent/academy_agent': 'academy',
  'agent/health_agent': 'health',
  'agent/legal_agent': 'legal',
  'agent/art_curator_agent': 'art-curator',
  'agent/storage_agent': 'storage',
  'agent/documents_agent': 'documents',
  'agent/calendar_agent': 'calendar',
  'agent/messaging_agent': 'messaging',
  'agent/task_agent': 'task',
  'agent/groups_agent': 'groups',
  'agent/resume_cover_letter_agent': 'resume-cover-letter',
  'agent/employment_client_agent': 'employment-client',
  'agent/job_search_agent': 'job-search',
  'agent/grant_writer': 'grant-writer',
  'agent/project_plan_agent': 'project-plan',
  'agent/budget_agent': 'budget',
  'agent/grant_researcher_agent': 'grant-researcher',
  'agent/designer_agent': 'designer',
  'agent/market_research_agent': 'market-research',
  'agent/videography_agent': 'videography',
  'agent/local_news_agent': 'local-news',
  'agent/national_news_agent': 'national-news',
  'agent/international_news_agent': 'international-news',
  'agent/contract_agent': 'contract',
  'agent/market_analysis_agent': 'market-analysis',
  'agent/copy_writer_agent': 'copy-writer',
  'agent/city_of_toronto_agent': 'city-of-toronto',
  'agent/homeless_hub_agent': 'homeless-hub',
  'agent/counseling_agent': 'counseling',
  'agent/open_data_agent': 'open-data',
  'agent/conversational_agent': 'conversational',
  'agent/profiles_agent': 'profiles',
  'agent/word_on_the_street_agent': 'word-on-the-street',
};

const LABEL_TO_MARKETPLACE_AGENT_ID: Record<string, string> = {
  'street profile': 'street-profile',
  'street profile agent': 'street-profile',
  'messaging': 'messaging',
  'messaging agent': 'messaging',
  'messages agent': 'messaging',
  'groups': 'groups',
  'groups agent': 'groups',
  'profiles': 'profiles',
  'profiles agent': 'profiles',
  'word on the street': 'word-on-the-street',
  'word on the street agent': 'word-on-the-street',
  'project manager agent': 'project-manager',
  'employment counsellor agent': 'employment-counsellor',
  'employment counselor agent': 'employment-counsellor',
  'grant manager agent': 'grant-manager',
  'marketing manager agent': 'marketing-manager',
  'personal assistant agent': 'personal-assistant',
  'brain agent': 'brain',
  'evaluation agent': 'evaluation',
  'directory agent': 'directory',
  'accounting agent': 'accounting',
  'cyber security agent': 'cyber-security',
  'dev ops agent': 'dev-ops',
  'analytics agent': 'analytics',
  'academy agent': 'academy',
  'health agent': 'health',
  'legal agent': 'legal',
  'art curator agent': 'art-curator',
  'storage agent': 'storage',
  'documents agent': 'documents',
  'calendar agent': 'calendar',
  'task agent': 'task',
  'resume & cover letter agent': 'resume-cover-letter',
  'resume and cover letter agent': 'resume-cover-letter',
  'job search agent': 'job-search',
  'grant writer agent': 'grant-writer',
  'grant researcher agent': 'grant-researcher',
  'designer agent': 'designer',
  'market research agent': 'market-research',
  'videography agent': 'videography',
  'local news agent': 'local-news',
  'national news agent': 'national-news',
  'international news agent': 'international-news',
  'contract agent': 'contract',
  'market analysis agent': 'market-analysis',
  'copy writer agent': 'copy-writer',
  'open data agent': 'open-data',
};

const COMPACT_LABEL_TO_MARKETPLACE_AGENT_ID = Object.fromEntries(
  Object.entries(LABEL_TO_MARKETPLACE_AGENT_ID).map(([label, iconId]) => [
    label.replace(/[^a-z0-9]/g, ''),
    iconId,
  ]),
);

export const STREETBOT_MODEL_IDS = new Set(['streetbot-0.1', 'streetbot-1-0']);

export const isStreetBotModelId = (modelId: string | null | undefined) => {
  if (!modelId) {
    return false;
  }
  return STREETBOT_MODEL_IDS.has(modelId.trim().toLowerCase());
};

const normalizeAgentCandidate = (modelId: string) => {
  const withoutQuery = modelId.trim().split('?')[0];
  let decoded = withoutQuery;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    decoded = withoutQuery;
  }
  return decoded.trim().replace(/^spec-agent\//, 'agent/');
};

export const getMarketplaceAgentIconId = (...modelIds: Array<string | null | undefined>) => {
  for (const modelId of modelIds) {
    if (!modelId) {
      continue;
    }
    const normalizedModelId = normalizeAgentCandidate(modelId);
    const iconId = MODEL_TO_MARKETPLACE_AGENT_ID[normalizedModelId];
    if (iconId) {
      return iconId;
    }

    const lowerModelId = normalizedModelId.toLowerCase();
    const labelIconId = LABEL_TO_MARKETPLACE_AGENT_ID[lowerModelId];
    if (labelIconId) {
      return labelIconId;
    }

    const compactLabelIconId =
      COMPACT_LABEL_TO_MARKETPLACE_AGENT_ID[lowerModelId.replace(/[^a-z0-9]/g, '')];
    if (compactLabelIconId) {
      return compactLabelIconId;
    }

    const iconUrlMatch = lowerModelId.match(/agent-marketplace-icons\/([a-z0-9-]+)\.svg/);
    if (iconUrlMatch?.[1] && AGENT_ICONS[iconUrlMatch[1]]) {
      return iconUrlMatch[1];
    }
  }
  return undefined;
};

interface StreetAgentIconProps {
  id: string;
  className?: string;
  fallback?: LucideIcon;
}

const StreetAgentIcon: React.FC<StreetAgentIconProps> = ({
  id,
  className,
  fallback: Fallback = Bot,
}) => {
  const Icon = AGENT_ICONS[id] ?? Fallback;

  return (
    <Icon
      aria-hidden="true"
      strokeWidth={2.2}
      className={cn('shrink-0 text-white', className)}
    />
  );
};

export default StreetAgentIcon;

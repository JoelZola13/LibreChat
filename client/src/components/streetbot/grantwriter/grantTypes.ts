// Grant Writer App — Types

export type PipelineStage =
  | 'identified'
  | 'evaluating'
  | 'pursuing'
  | 'drafting'
  | 'review'
  | 'submitted'
  | 'awarded'
  | 'declined'
  | 'active'
  | 'closed';

export const PIPELINE_STAGES: { id: PipelineStage; label: string; color: string }[] = [
  { id: 'identified', label: 'Identified', color: '#6b7280' },
  { id: 'evaluating', label: 'Evaluating', color: '#8b5cf6' },
  { id: 'pursuing', label: 'Pursuing', color: '#3b82f6' },
  { id: 'drafting', label: 'Drafting', color: '#eab308' },
  { id: 'review', label: 'Review', color: '#f97316' },
  { id: 'submitted', label: 'Submitted', color: '#14b8a6' },
  { id: 'awarded', label: 'Awarded', color: '#22c55e' },
  { id: 'declined', label: 'Declined', color: '#ef4444' },
  { id: 'active', label: 'Active', color: '#22c55e' },
  { id: 'closed', label: 'Closed', color: '#6b7280' },
];

export interface GrantOpportunity {
  id: string;
  name: string;
  funder: string;
  funderAbbrev?: string;
  amount?: string;
  deadline?: string;
  stage: PipelineStage;
  url?: string;
  assessment?: {
    missionAlignment?: number;
    competitiveness?: number;
    effortToReward?: number;
    strategicValue?: number;
    capacity?: number;
    recommendation?: 'pursue' | 'maybe' | 'pass';
  };
  documents?: {
    opportunity: boolean;
    narrative: boolean;
    budget: boolean;
    projectPlan: boolean;
  };
  intelligence?: GrantIntelligence;
}

export interface GrantIntelligence {
  // Funder overview
  funderMission?: string;
  funderPriorities?: string[];
  funderHistory?: string; // brief history / what they've funded before

  // Scoring & evaluation
  scoringCriteria?: { criterion: string; weight?: string; description?: string }[];
  evaluationProcess?: string; // how apps get reviewed
  reviewTimeline?: string;

  // Eligibility deep-dive
  eligibilityRequirements?: string[];
  ineligible?: string[];
  geoRestrictions?: string;

  // Key stats
  averageGrantSize?: string;
  acceptanceRate?: string;
  totalFunding?: string; // total $ awarded annually
  pastGrantees?: string[];

  // Important dates
  keyDates?: { date: string; label: string }[];
  reportingRequirements?: string;

  // Tips & insights
  tips?: string[];
  commonMistakes?: string[];
  whatMakesStrong?: string; // what makes a strong application

  // Supporting docs
  guidelinesPdfUrl?: string;
  faqUrl?: string;
  webinarUrl?: string;
  additionalResources?: { label: string; url: string }[];

  // Raw notes
  notes?: string;
  lastUpdated?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: string[];
  timestamp: number;
  isStreaming?: boolean;
}

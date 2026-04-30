import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BellRing,
  Bot,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock,
  Download,
  FileText,
  Filter,
  Flag,
  FolderOpen,
  History,
  LayoutGrid,
  ListTodo,
  Lock,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  UserPlus,
  Users,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useGlassStyles } from '../shared/useGlassStyles';
import { useAuthContext } from '~/hooks/AuthContext';

type TabId =
  | 'overview'
  | 'knowledge'
  | 'clients'
  | 'cases'
  | 'tasks'
  | 'calendar'
  | 'referrals'
  | 'documents'
  | 'reports'
  | 'settings';

type RiskLevel = 'low' | 'medium' | 'high' | 'urgent';
type Priority = 'low' | 'medium' | 'high' | 'urgent';
type CaseView = 'table' | 'kanban' | 'calendar';
type TaskView = 'my' | 'all' | 'today' | 'overdue' | 'by worker';
type ActivityFilter =
  | 'all'
  | 'follow-up today'
  | 'overdue follow-up'
  | 'no contact 14 days'
  | 'document expiring'
  | 'unresolved referral';
type SavedViewId = 'all' | 'urgent' | 'today' | 'stale' | 'documents' | 'referrals' | 'custom';
type ProfileAction = 'case' | 'referral' | 'appointment' | null;
type NotificationType =
  | 'task due today'
  | 'task overdue'
  | 'follow-up due'
  | 'missed appointment'
  | 'referral response'
  | 'no contact'
  | 'document expiring'
  | 'urgent pattern';
type CaseStatus =
  | 'intake'
  | 'active'
  | 'pending documents'
  | 'awaiting partner response'
  | 'follow-up needed'
  | 'on hold'
  | 'resolved'
  | 'closed'
  | 'archived';
type ReferralStatus =
  | 'draft'
  | 'sent'
  | 'acknowledged'
  | 'scheduled'
  | 'completed'
  | 'declined'
  | 'no response'
  | 'closed';

interface ClientRecord {
  id: string;
  fullName: string;
  preferredName: string;
  alias: string;
  clientId: string;
  dob: string;
  age: number;
  phone: string;
  email: string;
  location: string;
  demographicDetails: string;
  emergencyContact: string;
  language: string;
  communicationPreference: string;
  consentStatus: 'signed' | 'pending' | 'expired';
  riskLevel: RiskLevel;
  riskFlags: string[];
  serviceHistory: string;
  activeCasesCount: number;
  assignedWorker: string;
  assignedTeam: string;
  pronouns: string;
  accessibilityNeeds: string;
  transportationNeeds: string;
  housingStatus: string;
  incomeStatus: string;
  benefitsStatus: string;
  status: 'active' | 'inactive';
  latestContact: string;
  nextFollowUp: string;
}

interface CaseRecord {
  id: string;
  caseId: string;
  clientId: string;
  title: string;
  type: string;
  status: CaseStatus;
  priority: Priority;
  assignedStaff: string;
  assignedTeam: string;
  openedDate: string;
  targetResolutionDate: string;
  closedDate?: string;
  closureReason?: string;
  referralSource: string;
  tags: string[];
  summary: string;
  goals: string[];
  barriers: string[];
  nextAction: string;
  nextFollowUp: string;
}

interface NoteRecord {
  id: string;
  timestamp: string;
  author: string;
  clientId: string;
  caseId: string;
  type: string;
  narrative: string;
  structuredFields: string[];
  attachments: string[];
  followUpRequired: boolean;
  visibility: 'internal' | 'team' | 'restricted';
  aiSummary: string;
  aiTags: string[];
}

interface TaskRecord {
  id: string;
  title: string;
  clientId: string;
  caseId: string;
  owner: string;
  dueDate: string;
  priority: Priority;
  status: 'open' | 'in progress' | 'blocked' | 'complete';
  reminderRules: string;
  dependency: string;
  completedAt?: string;
  notes: string;
}

interface ReferralRecord {
  id: string;
  clientId: string;
  caseId: string;
  organization: string;
  serviceCategory: string;
  referralDate: string;
  status: ReferralStatus;
  contactPerson: string;
  contact: string;
  appointmentDate: string;
  outcome: string;
  followUpRequired: boolean;
  supportingDocuments: string[];
}

interface DocumentRecord {
  id: string;
  clientId: string;
  caseId: string;
  name: string;
  type: string;
  tag: string;
  uploadedAt: string;
  expiresAt?: string;
  permission: 'team' | 'restricted' | 'manager only';
  searchableText: string;
}

interface AppointmentRecord {
  id: string;
  clientId: string;
  caseId: string;
  dateTime: string;
  location: string;
  serviceProvider: string;
  purpose: string;
  attendanceStatus: 'scheduled' | 'attended' | 'missed' | 'rescheduled';
  reminders: string;
  prepChecklist: string[];
  outcomeNotes: string;
}

interface TimelineEvent {
  id: string;
  clientId: string;
  caseId: string;
  occurredAt: string;
  type: string;
  title: string;
  detail: string;
}

interface ClientWikiSourceNoteSeed {
  caseId: string;
  timestamp: string;
  author: string;
  type: string;
  narrative: string;
  structuredFields: string[];
  attachments: string[];
  followUpRequired: boolean;
  visibility: NoteRecord['visibility'];
  aiSummary: string;
  aiTags: string[];
}

interface ClientWikiMilestone {
  caseId: string;
  occurredAt: string;
  type: string;
  title: string;
  detail: string;
  source: string;
}

interface ClientWikiProfile {
  clientId: string;
  lead: string;
  profileContext: string[];
  workingSynthesis: string[];
  sourceNotes: ClientWikiSourceNoteSeed[];
  milestones: ClientWikiMilestone[];
  retrievalHints: string[];
  openQuestions: string[];
}

interface WikiIngestionRecord {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  status: 'ready' | 'metadata-only' | 'failed';
  extractionStatus: string;
  extractionMethod: string;
  graphStatus: string;
  graphMessage: string;
  nodeCount: number;
  edgeCount: number;
  linkedClientId?: string;
  linkedCaseId?: string;
  linkedServiceName?: string;
  pageId: string;
  title: string;
  summary: string;
  textPreview: string;
  sections: Array<{ heading: string; body: string }>;
  entities: string[];
  sourceFileId?: string;
  noteId?: string;
  documentId?: string;
  timelineId?: string;
}

interface BotAlert {
  id: string;
  caseId: string;
  clientId: string;
  title: string;
  prompt: string;
  severity: RiskLevel;
}

interface CaseNotification {
  id: string;
  type: NotificationType;
  title: string;
  detail: string;
  severity: RiskLevel;
  clientId: string;
  caseId: string;
  dueAt: string;
  actionTab: TabId;
  source: 'Street Bot' | 'Automation';
}

interface CaseType {
  id: string;
  name: string;
  workflow: string[];
  successCriteria: string;
}

interface OrganizationRecord {
  id: string;
  name: string;
  serviceCategories: string[];
  contactPerson: string;
  contact: string;
  phone: string;
  address: string;
  eligibility: string;
  notes: string;
  preferred: boolean;
  active: boolean;
  averageTurnaroundDays: number;
}

interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  object: string;
  timestamp: string;
}

interface ClientIntakeDraft {
  fullName: string;
  preferredName: string;
  dob: string;
  phone: string;
  email: string;
  location: string;
  assignedWorker: string;
  assignedTeam: string;
  language: string;
  communicationPreference: string;
  consentStatus: ClientRecord['consentStatus'];
  riskLevel: RiskLevel;
  riskFlags: string;
  pronouns: string;
  emergencyContact: string;
  demographicDetails: string;
  accessibilityNeeds: string;
  transportationNeeds: string;
  housingStatus: string;
  incomeStatus: string;
  benefitsStatus: string;
  serviceHistory: string;
}

interface CaseQuickDraft {
  title: string;
  type: string;
  priority: Priority;
  targetResolutionDate: string;
  summary: string;
  nextAction: string;
}

interface ReferralQuickDraft {
  organization: string;
  serviceCategory: string;
  contactPerson: string;
  contact: string;
  appointmentDate: string;
  supportingDocuments: string;
}

interface AppointmentQuickDraft {
  dateTime: string;
  location: string;
  serviceProvider: string;
  purpose: string;
  prepChecklist: string;
}

interface CaseTypeDraft {
  name: string;
  workflow: string;
  successCriteria: string;
}

interface OrganizationDraft {
  name: string;
  serviceCategories: string;
  contactPerson: string;
  contact: string;
  phone: string;
  address: string;
  eligibility: string;
  notes: string;
  averageTurnaroundDays: string;
}

interface WikiIngestContext {
  clientId?: string;
  clientName?: string;
  caseId?: string;
  caseTitle?: string;
  serviceName?: string;
  pageId?: string;
}

const tabs: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'knowledge', label: 'Knowledge', icon: Sparkles },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'cases', label: 'Cases', icon: Briefcase },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'referrals', label: 'Referrals', icon: ArrowRight },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const tabIds = new Set<TabId>(tabs.map((tab) => tab.id));

const directoryServiceIds: Record<string, string> = {
  'Harbour Shelter Intake': '15420',
  'Toronto Harbour Light': '15420',
  'Bridge Works Employment': '3199',
  'Yonge Street Mission Employment Centre': '3199',
  'Downtown Legal Clinic': '3577',
  'Artists\' Legal Advice Services': '15609',
  'Mobile Health Outreach': '2957',
  'Regent Park Community Health Centre': '2957',
  'City ID Desk': '3623',
  'Parkdale Site ID Clinic': '3623',
  'Parkdale Site Id Clinic': '3623',
  'Community Food Bank': '15432',
  'Safe Steps Counseling': '2988',
  'Youth Futures Studio': '2988',
  'Benefits Navigator Desk': '3498',
  'WTCLS Income Assistance': '3498',
  'Wtcls Income Assistance': '3498',
  'Tenant Rights Hub': '15623',
};

function slugifyRoute(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function profilePathForName(name: string) {
  return `/creatives/${slugifyRoute(name)}`;
}

function directoryPathForOrganization(name: string) {
  const serviceId = directoryServiceIds[name];
  if (serviceId) return `/directory/service/${serviceId}`;
  return `/directory?q=${encodeURIComponent(name)}`;
}

function caseManagementTabFromPath(): TabId | null {
  if (typeof window === 'undefined') return null;
  const segment = window.location.pathname.replace(/^\/case-management\/?/, '').split('/')[0] as TabId | '';
  return segment && tabIds.has(segment as TabId) ? (segment as TabId) : null;
}

const initialClients: ClientRecord[] = [
  {
    id: 'client-001',
    fullName: 'Maya Chen',
    preferredName: 'Maya',
    alias: 'MC',
    clientId: 'SV-C-1001',
    dob: '1994-08-18',
    age: 31,
    phone: '555-0142',
    email: 'maya@example.org',
    location: 'Queen and Spadina outreach route',
    demographicDetails: 'Adult, voluntary self-report on file',
    emergencyContact: 'Ari Chen, sibling',
    language: 'English, Cantonese',
    communicationPreference: 'Text first, phone after 4 PM',
    consentStatus: 'signed',
    riskLevel: 'high',
    riskFlags: ['urgent housing need', 'document missing', 'medical vulnerability'],
    serviceHistory: 'Housing intake, ID replacement, harm-reduction kit, benefits screening',
    activeCasesCount: 3,
    assignedWorker: 'Nia Patel',
    assignedTeam: 'Outreach East',
    pronouns: 'she/her',
    accessibilityNeeds: 'Low-stimulation meetings preferred',
    transportationNeeds: 'Transit fare support',
    housingStatus: 'Unsheltered',
    incomeStatus: 'No stable income',
    benefitsStatus: 'Application in progress',
    status: 'active',
    latestContact: '2026-04-14T09:30:00',
    nextFollowUp: '2026-04-14T15:00:00',
  },
  {
    id: 'client-002',
    fullName: 'Devon Brooks',
    preferredName: 'Dev',
    alias: 'DB',
    clientId: 'SV-C-1002',
    dob: '1988-02-02',
    age: 38,
    phone: '555-0178',
    email: 'devon@example.org',
    location: 'Parkdale drop-in',
    demographicDetails: 'Adult, consented program intake',
    emergencyContact: 'No contact listed',
    language: 'English',
    communicationPreference: 'Phone',
    consentStatus: 'pending',
    riskLevel: 'medium',
    riskFlags: ['consent not completed', 'missed appointment'],
    serviceHistory: 'Employment support, clinic referral, emergency food support',
    activeCasesCount: 2,
    assignedWorker: 'Omar Williams',
    assignedTeam: 'Drop-in Team',
    pronouns: 'he/him',
    accessibilityNeeds: 'None listed',
    transportationNeeds: 'Occasional fare support',
    housingStatus: 'Temporary shelter',
    incomeStatus: 'Part-time casual work',
    benefitsStatus: 'Needs review',
    status: 'active',
    latestContact: '2026-04-12T13:15:00',
    nextFollowUp: '2026-04-15T10:00:00',
  },
  {
    id: 'client-003',
    fullName: 'Alina Morgan',
    preferredName: 'Alina',
    alias: 'AM',
    clientId: 'SV-C-1003',
    dob: '2002-11-26',
    age: 23,
    phone: '555-0191',
    email: 'alina@example.org',
    location: 'Scarborough mobile visit',
    demographicDetails: 'Youth program participant',
    emergencyContact: 'Tara Morgan, aunt',
    language: 'English',
    communicationPreference: 'Email or WhatsApp',
    consentStatus: 'signed',
    riskLevel: 'low',
    riskFlags: ['benefits expiring soon'],
    serviceHistory: 'Youth media lab referral, benefits renewal, counseling intake',
    activeCasesCount: 1,
    assignedWorker: 'Nia Patel',
    assignedTeam: 'Youth Outreach',
    pronouns: 'they/them',
    accessibilityNeeds: 'Hybrid meetings preferred',
    transportationNeeds: 'None listed',
    housingStatus: 'Couch surfing',
    incomeStatus: 'Youth stipend',
    benefitsStatus: 'Renewal due',
    status: 'active',
    latestContact: '2026-04-10T16:45:00',
    nextFollowUp: '2026-04-17T12:00:00',
  },
  {
    id: 'client-004',
    fullName: 'Samir Ahmed',
    preferredName: 'Samir',
    alias: 'SA',
    clientId: 'SV-C-1004',
    dob: '1979-05-03',
    age: 46,
    phone: '555-0116',
    email: 'samir@example.org',
    location: 'Downtown legal clinic',
    demographicDetails: 'Adult, voluntary self-report on file',
    emergencyContact: 'Leila Ahmed, cousin',
    language: 'Arabic, English',
    communicationPreference: 'Phone with interpreter if complex',
    consentStatus: 'expired',
    riskLevel: 'urgent',
    riskFlags: ['legal deadline', 'no contact in 14 days', 'high-priority case'],
    serviceHistory: 'Legal support, medical coordination, shelter placement',
    activeCasesCount: 2,
    assignedWorker: 'Priya Singh',
    assignedTeam: 'Case Management',
    pronouns: 'he/him',
    accessibilityNeeds: 'Interpreter support',
    transportationNeeds: 'Clinic travel support',
    housingStatus: 'Shelter placement at risk',
    incomeStatus: 'No stable income',
    benefitsStatus: 'Unknown',
    status: 'active',
    latestContact: '2026-03-30T11:20:00',
    nextFollowUp: '2026-04-14T11:00:00',
  },
  {
    id: 'client-005',
    fullName: 'Rosa Martinez',
    preferredName: 'Rosa',
    alias: 'RM',
    clientId: 'SV-C-1005',
    dob: '1983-09-12',
    age: 42,
    phone: '555-0137',
    email: 'rosa@example.org',
    location: 'Kensington community meal program',
    demographicDetails: 'Adult, newcomer settlement intake in progress',
    emergencyContact: 'Ana Martinez, sister',
    language: 'Spanish, English',
    communicationPreference: 'WhatsApp with Spanish summary',
    consentStatus: 'signed',
    riskLevel: 'medium',
    riskFlags: ['ID replacement', 'newcomer supports', 'family reunification'],
    serviceHistory: 'Settlement support, ID replacement, food security referral',
    activeCasesCount: 2,
    assignedWorker: 'Priya Singh',
    assignedTeam: 'Case Management',
    pronouns: 'she/her',
    accessibilityNeeds: 'Interpreter for legal or benefits language',
    transportationNeeds: 'Transit fare support for appointments',
    housingStatus: 'Staying with family temporarily',
    incomeStatus: 'Occasional cleaning work',
    benefitsStatus: 'Needs eligibility review',
    status: 'active',
    latestContact: '2026-04-13T10:20:00',
    nextFollowUp: '2026-04-16T09:30:00',
  },
  {
    id: 'client-006',
    fullName: 'Jordan Lee',
    preferredName: 'Jay',
    alias: 'JL',
    clientId: 'SV-C-1006',
    dob: '1997-01-21',
    age: 29,
    phone: '555-0162',
    email: 'jordan@example.org',
    location: 'West end harm reduction route',
    demographicDetails: 'Adult, consented outreach support',
    emergencyContact: 'No contact listed',
    language: 'English',
    communicationPreference: 'Text only unless urgent',
    consentStatus: 'pending',
    riskLevel: 'high',
    riskFlags: ['missed appointment', 'mental health support', 'phone instability'],
    serviceHistory: 'Harm reduction outreach, counseling referral, clinic warm handoff',
    activeCasesCount: 2,
    assignedWorker: 'Omar Williams',
    assignedTeam: 'Outreach West',
    pronouns: 'they/them',
    accessibilityNeeds: 'Short meetings and written recap',
    transportationNeeds: 'Taxi chit for clinic visits when escalated',
    housingStatus: 'Encampment',
    incomeStatus: 'No stable income',
    benefitsStatus: 'Application not started',
    status: 'active',
    latestContact: '2026-04-11T18:15:00',
    nextFollowUp: '2026-04-14T18:00:00',
  },
  {
    id: 'client-007',
    fullName: 'Keisha Thompson',
    preferredName: 'Keisha',
    alias: 'KT',
    clientId: 'SV-C-1007',
    dob: '1974-06-04',
    age: 51,
    phone: '555-0186',
    email: 'keisha@example.org',
    location: 'North clinic lobby',
    demographicDetails: 'Adult, medical coordination consent signed',
    emergencyContact: 'Marcus Thompson, son',
    language: 'English',
    communicationPreference: 'Phone before noon',
    consentStatus: 'signed',
    riskLevel: 'medium',
    riskFlags: ['medical follow-up', 'mobility limitation'],
    serviceHistory: 'Clinic coordination, prescription pickup, housing form review',
    activeCasesCount: 1,
    assignedWorker: 'Nia Patel',
    assignedTeam: 'Health Navigation',
    pronouns: 'she/her',
    accessibilityNeeds: 'Low-walking routes and seated waiting areas',
    transportationNeeds: 'Accessible transit route planning',
    housingStatus: 'Supportive housing waitlist',
    incomeStatus: 'Disability support pending',
    benefitsStatus: 'Medical verification required',
    status: 'active',
    latestContact: '2026-04-09T09:05:00',
    nextFollowUp: '2026-04-15T09:00:00',
  },
  {
    id: 'client-008',
    fullName: 'Tariq Johnson',
    preferredName: 'Tariq',
    alias: 'TJ',
    clientId: 'SV-C-1008',
    dob: '2005-12-15',
    age: 20,
    phone: '555-0104',
    email: 'tariq@example.org',
    location: 'Youth drop-in media room',
    demographicDetails: 'Youth program participant',
    emergencyContact: 'Denise Johnson, aunt',
    language: 'English',
    communicationPreference: 'DM through youth program account',
    consentStatus: 'pending',
    riskLevel: 'low',
    riskFlags: ['youth employment', 'school re-entry'],
    serviceHistory: 'Youth program intake, job readiness, digital media referral',
    activeCasesCount: 1,
    assignedWorker: 'Leah Fraser',
    assignedTeam: 'Youth Outreach',
    pronouns: 'he/him',
    accessibilityNeeds: 'Evening appointments preferred',
    transportationNeeds: 'Transit pass support',
    housingStatus: 'Staying with aunt',
    incomeStatus: 'No income',
    benefitsStatus: 'Youth supports screening',
    status: 'active',
    latestContact: '2026-04-13T17:40:00',
    nextFollowUp: '2026-04-21T16:00:00',
  },
  {
    id: 'client-009',
    fullName: 'Marion Green',
    preferredName: 'Marion',
    alias: 'MG',
    clientId: 'SV-C-1009',
    dob: '1966-03-07',
    age: 60,
    phone: '555-0155',
    email: 'marion@example.org',
    location: 'Etobicoke housing office',
    demographicDetails: 'Older adult, closure review complete',
    emergencyContact: 'No contact listed',
    language: 'English',
    communicationPreference: 'Phone',
    consentStatus: 'signed',
    riskLevel: 'low',
    riskFlags: ['stabilized placement'],
    serviceHistory: 'Housing stabilization, benefits confirmation, closure planning',
    activeCasesCount: 0,
    assignedWorker: 'Priya Singh',
    assignedTeam: 'Housing Stability',
    pronouns: 'she/her',
    accessibilityNeeds: 'Large-print documents',
    transportationNeeds: 'None listed',
    housingStatus: 'Housed',
    incomeStatus: 'Income support active',
    benefitsStatus: 'Active',
    status: 'inactive',
    latestContact: '2026-04-07T14:25:00',
    nextFollowUp: '2026-05-12T10:00:00',
  },
  {
    id: 'client-010',
    fullName: 'Eli Novak',
    preferredName: 'Eli',
    alias: 'EN',
    clientId: 'SV-C-1010',
    dob: '1991-10-30',
    age: 34,
    phone: '555-0199',
    email: 'eli@example.org',
    location: 'Central library outreach desk',
    demographicDetails: 'Adult, document recovery intake',
    emergencyContact: 'Mira Novak, friend',
    language: 'English, Ukrainian',
    communicationPreference: 'Email first, phone for appointments',
    consentStatus: 'signed',
    riskLevel: 'medium',
    riskFlags: ['document recovery', 'benefits delay'],
    serviceHistory: 'ID replacement, benefits appeal prep, food support',
    activeCasesCount: 1,
    assignedWorker: 'Leah Fraser',
    assignedTeam: 'Outreach East',
    pronouns: 'he/him',
    accessibilityNeeds: 'Plain-language written steps',
    transportationNeeds: 'Transit fare for government office',
    housingStatus: 'Rooming house',
    incomeStatus: 'Benefits interrupted',
    benefitsStatus: 'Appeal prep',
    status: 'active',
    latestContact: '2026-04-12T12:10:00',
    nextFollowUp: '2026-04-15T13:30:00',
  },
];

const initialCases: CaseRecord[] = [
  {
    id: 'case-001',
    caseId: 'SV-CASE-2401',
    clientId: 'client-001',
    title: 'Housing stabilization',
    type: 'housing',
    status: 'follow-up needed',
    priority: 'urgent',
    assignedStaff: 'Nia Patel',
    assignedTeam: 'Outreach East',
    openedDate: '2026-04-02',
    targetResolutionDate: '2026-05-30',
    referralSource: 'Street outreach',
    tags: ['housing', 'ID', 'urgent'],
    summary: 'Client needs emergency housing support and a current ID scan before the shelter referral can be finalized.',
    goals: ['Confirm safe placement', 'Replace ID', 'Schedule housing intake'],
    barriers: ['No current ID', 'Phone access is intermittent', 'Medical vulnerability'],
    nextAction: 'Call shelter intake line and confirm document alternatives',
    nextFollowUp: '2026-04-14T15:00:00',
  },
  {
    id: 'case-002',
    caseId: 'SV-CASE-2402',
    clientId: 'client-001',
    title: 'Benefits application',
    type: 'benefits / income support',
    status: 'pending documents',
    priority: 'high',
    assignedStaff: 'Nia Patel',
    assignedTeam: 'Outreach East',
    openedDate: '2026-04-06',
    targetResolutionDate: '2026-04-28',
    referralSource: 'Worker follow-up',
    tags: ['benefits', 'forms'],
    summary: 'Application is drafted but requires signed consent and bank statement before submission.',
    goals: ['Complete application package', 'Submit to benefits office', 'Confirm follow-up date'],
    barriers: ['Bank statement missing', 'Consent packet partially signed'],
    nextAction: 'Upload signed consent and review missing fields',
    nextFollowUp: '2026-04-16T10:00:00',
  },
  {
    id: 'case-003',
    caseId: 'SV-CASE-2403',
    clientId: 'client-002',
    title: 'Employment bridge referral',
    type: 'employment',
    status: 'awaiting partner response',
    priority: 'medium',
    assignedStaff: 'Omar Williams',
    assignedTeam: 'Drop-in Team',
    openedDate: '2026-03-22',
    targetResolutionDate: '2026-05-01',
    referralSource: 'Drop-in intake',
    tags: ['employment', 'referral'],
    summary: 'Partner employment program has referral packet and is reviewing placement fit.',
    goals: ['Confirm intake slot', 'Update resume', 'Schedule orientation'],
    barriers: ['Missed first orientation', 'Needs phone reminders'],
    nextAction: 'Follow up with employment coordinator',
    nextFollowUp: '2026-04-15T10:00:00',
  },
  {
    id: 'case-004',
    caseId: 'SV-CASE-2404',
    clientId: 'client-003',
    title: 'Benefits renewal',
    type: 'benefits / income support',
    status: 'active',
    priority: 'low',
    assignedStaff: 'Nia Patel',
    assignedTeam: 'Youth Outreach',
    openedDate: '2026-04-08',
    targetResolutionDate: '2026-04-25',
    referralSource: 'Youth program',
    tags: ['benefits', 'youth'],
    summary: 'Renewal documents are ready for review with client before submission.',
    goals: ['Review renewal', 'Submit package', 'Confirm confirmation number'],
    barriers: ['Needs quiet space for document review'],
    nextAction: 'Review renewal form together',
    nextFollowUp: '2026-04-17T12:00:00',
  },
  {
    id: 'case-005',
    caseId: 'SV-CASE-2405',
    clientId: 'client-004',
    title: 'Legal support deadline',
    type: 'legal support',
    status: 'follow-up needed',
    priority: 'urgent',
    assignedStaff: 'Priya Singh',
    assignedTeam: 'Case Management',
    openedDate: '2026-03-18',
    targetResolutionDate: '2026-04-18',
    referralSource: 'Legal clinic',
    tags: ['legal', 'deadline', 'interpreter'],
    summary: 'Client has a legal clinic deadline and has not been reached since late March.',
    goals: ['Reconnect with client', 'Confirm clinic appointment', 'Update consent'],
    barriers: ['No contact in 14 days', 'Consent expired', 'Interpreter needed'],
    nextAction: 'Try shelter desk contact and interpreter-supported phone call',
    nextFollowUp: '2026-04-14T11:00:00',
  },
  {
    id: 'case-006',
    caseId: 'SV-CASE-2406',
    clientId: 'client-002',
    title: 'Consent and clinic paperwork',
    type: 'medical coordination',
    status: 'pending documents',
    priority: 'medium',
    assignedStaff: 'Omar Williams',
    assignedTeam: 'Drop-in Team',
    openedDate: '2026-04-09',
    targetResolutionDate: '2026-04-30',
    referralSource: 'Drop-in nurse',
    tags: ['medical', 'consent', 'clinic'],
    summary: 'Clinic will hold the appointment slot if consent and health card copy arrive this week.',
    goals: ['Complete consent', 'Upload health card copy', 'Confirm clinic appointment'],
    barriers: ['Consent pending', 'Client missed first document review'],
    nextAction: 'Complete consent packet during drop-in hours',
    nextFollowUp: '2026-04-15T14:00:00',
  },
  {
    id: 'case-007',
    caseId: 'SV-CASE-2407',
    clientId: 'client-005',
    title: 'ID replacement and settlement support',
    type: 'id replacement',
    status: 'active',
    priority: 'medium',
    assignedStaff: 'Priya Singh',
    assignedTeam: 'Case Management',
    openedDate: '2026-04-04',
    targetResolutionDate: '2026-05-08',
    referralSource: 'Community meal program',
    tags: ['ID', 'settlement', 'newcomer'],
    summary: 'Client needs replacement provincial ID before settlement and benefits appointments can advance.',
    goals: ['Gather proof documents', 'Book ID desk appointment', 'Create benefits eligibility plan'],
    barriers: ['Translation needed', 'Proof of address uncertain'],
    nextAction: 'Confirm acceptable proof of address with City ID Desk',
    nextFollowUp: '2026-04-16T09:30:00',
  },
  {
    id: 'case-008',
    caseId: 'SV-CASE-2408',
    clientId: 'client-005',
    title: 'Food security bridge',
    type: 'community resources',
    status: 'resolved',
    priority: 'low',
    assignedStaff: 'Priya Singh',
    assignedTeam: 'Case Management',
    openedDate: '2026-04-05',
    targetResolutionDate: '2026-04-20',
    closedDate: '2026-04-12',
    closureReason: 'Weekly hamper pickup confirmed',
    referralSource: 'Worker follow-up',
    tags: ['food security', 'community resources'],
    summary: 'Community food bank registration is active and pickup instructions were confirmed.',
    goals: ['Register household', 'Confirm pickup day', 'Document closure'],
    barriers: ['Language support required for first visit'],
    nextAction: 'Check in after first pickup',
    nextFollowUp: '2026-04-22T11:00:00',
  },
  {
    id: 'case-009',
    caseId: 'SV-CASE-2409',
    clientId: 'client-006',
    title: 'Counseling warm handoff',
    type: 'mental health navigation',
    status: 'follow-up needed',
    priority: 'high',
    assignedStaff: 'Omar Williams',
    assignedTeam: 'Outreach West',
    openedDate: '2026-04-01',
    targetResolutionDate: '2026-04-29',
    referralSource: 'Harm reduction route',
    tags: ['counseling', 'warm handoff', 'missed appointment'],
    summary: 'Client missed first counseling intake and wants a lower-barrier reschedule with text reminders.',
    goals: ['Reschedule intake', 'Create reminder plan', 'Confirm safe contact window'],
    barriers: ['Phone battery instability', 'Client avoids morning appointments'],
    nextAction: 'Ask partner for afternoon intake slot and text-friendly reminder',
    nextFollowUp: '2026-04-14T18:00:00',
  },
  {
    id: 'case-010',
    caseId: 'SV-CASE-2410',
    clientId: 'client-007',
    title: 'Medical verification for disability support',
    type: 'medical coordination',
    status: 'awaiting partner response',
    priority: 'medium',
    assignedStaff: 'Nia Patel',
    assignedTeam: 'Health Navigation',
    openedDate: '2026-04-03',
    targetResolutionDate: '2026-05-10',
    referralSource: 'North clinic',
    tags: ['medical', 'benefits', 'accessibility'],
    summary: 'Clinic is preparing medical verification needed for disability support application.',
    goals: ['Collect verification', 'Upload medical form', 'Submit benefits package'],
    barriers: ['Clinic turnaround time', 'Mobility limitation'],
    nextAction: 'Check clinic document status and book accessible route',
    nextFollowUp: '2026-04-15T09:00:00',
  },
  {
    id: 'case-011',
    caseId: 'SV-CASE-2411',
    clientId: 'client-008',
    title: 'Youth employment and school re-entry',
    type: 'employment',
    status: 'intake',
    priority: 'low',
    assignedStaff: 'Leah Fraser',
    assignedTeam: 'Youth Outreach',
    openedDate: '2026-04-13',
    targetResolutionDate: '2026-05-31',
    referralSource: 'Youth drop-in',
    tags: ['youth', 'employment', 'school'],
    summary: 'Client wants evening job readiness sessions and support reconnecting with school credits.',
    goals: ['Complete readiness intake', 'Book youth employment orientation', 'Map school credit options'],
    barriers: ['Evening availability only', 'Needs transit pass'],
    nextAction: 'Book youth employment orientation and confirm school contact',
    nextFollowUp: '2026-04-21T16:00:00',
  },
  {
    id: 'case-012',
    caseId: 'SV-CASE-2412',
    clientId: 'client-009',
    title: 'Housing placement closure review',
    type: 'housing',
    status: 'closed',
    priority: 'low',
    assignedStaff: 'Priya Singh',
    assignedTeam: 'Housing Stability',
    openedDate: '2026-02-18',
    targetResolutionDate: '2026-04-10',
    closedDate: '2026-04-10',
    closureReason: 'Housing stabilized and benefits active',
    referralSource: 'Housing office',
    tags: ['housing', 'closure', 'benefits'],
    summary: 'Client moved into stable placement and confirmed benefits activation.',
    goals: ['Confirm placement', 'Verify benefits activation', 'Close case with aftercare plan'],
    barriers: ['Large-print documents needed'],
    nextAction: 'Optional 30-day aftercare call',
    nextFollowUp: '2026-05-12T10:00:00',
  },
  {
    id: 'case-013',
    caseId: 'SV-CASE-2413',
    clientId: 'client-010',
    title: 'Benefits appeal document recovery',
    type: 'benefits / income support',
    status: 'active',
    priority: 'medium',
    assignedStaff: 'Leah Fraser',
    assignedTeam: 'Outreach East',
    openedDate: '2026-04-07',
    targetResolutionDate: '2026-05-05',
    referralSource: 'Library outreach desk',
    tags: ['benefits', 'appeal', 'documents'],
    summary: 'Client needs recovered documents and a plain-language appeal timeline before benefits can resume.',
    goals: ['Recover ID copy', 'Draft appeal timeline', 'Book benefits navigator'],
    barriers: ['Lost documents', 'Complex appeal language'],
    nextAction: 'Create appeal timeline and request ID copy from desk',
    nextFollowUp: '2026-04-15T13:30:00',
  },
];

const initialNotes: NoteRecord[] = [
  {
    id: 'note-001',
    timestamp: '2026-04-14T09:30:00',
    author: 'Nia Patel',
    clientId: 'client-001',
    caseId: 'case-001',
    type: 'outreach contact',
    narrative: 'Met Maya on outreach route. Discussed shelter options and consent packet status.',
    structuredFields: ['Location confirmed', 'Consent reviewed', 'Follow-up required'],
    attachments: ['consent-photo.pdf'],
    followUpRequired: true,
    visibility: 'team',
    aiSummary: 'Housing referral can move forward if ID alternative is accepted.',
    aiTags: ['housing', 'consent', 'urgent'],
  },
  {
    id: 'note-002',
    timestamp: '2026-04-12T13:15:00',
    author: 'Omar Williams',
    clientId: 'client-002',
    caseId: 'case-003',
    type: 'phone call',
    narrative: 'Client confirmed interest in employment bridge program and asked for reminder before orientation.',
    structuredFields: ['Reminder requested', 'Referral active'],
    attachments: [],
    followUpRequired: true,
    visibility: 'internal',
    aiSummary: 'Send SMS reminder the morning of orientation.',
    aiTags: ['employment', 'reminder'],
  },
  {
    id: 'note-003',
    timestamp: '2026-04-10T16:45:00',
    author: 'Nia Patel',
    clientId: 'client-003',
    caseId: 'case-004',
    type: 'office visit',
    narrative: 'Reviewed renewal checklist. Client prefers hybrid follow-up and has all documents in email.',
    structuredFields: ['Documents ready', 'Hybrid follow-up'],
    attachments: ['renewal-checklist.docx'],
    followUpRequired: false,
    visibility: 'team',
    aiSummary: 'Benefits renewal is low risk if submitted by Apr 25.',
    aiTags: ['benefits', 'renewal'],
  },
  {
    id: 'note-004',
    timestamp: '2026-03-30T11:20:00',
    author: 'Priya Singh',
    clientId: 'client-004',
    caseId: 'case-005',
    type: 'legal support',
    narrative: 'Client attended clinic intake. Legal team requested updated consent and appointment confirmation.',
    structuredFields: ['Consent expired', 'Interpreter recommended'],
    attachments: ['clinic-intake.pdf'],
    followUpRequired: true,
    visibility: 'restricted',
    aiSummary: 'Legal deadline risk is increasing because contact has gone stale.',
    aiTags: ['legal', 'deadline', 'risk'],
  },
  {
    id: 'note-005',
    timestamp: '2026-04-13T10:20:00',
    author: 'Priya Singh',
    clientId: 'client-005',
    caseId: 'case-007',
    type: 'intake update',
    narrative: 'Rosa brought a lease letter and photo of prior ID. She asked for Spanish-language appointment instructions.',
    structuredFields: ['Proof document reviewed', 'Interpreter requested', 'Referral ready'],
    attachments: ['lease-letter-photo.jpg'],
    followUpRequired: true,
    visibility: 'team',
    aiSummary: 'ID replacement can advance once City ID Desk confirms the proof of address.',
    aiTags: ['ID replacement', 'settlement', 'Spanish'],
  },
  {
    id: 'note-006',
    timestamp: '2026-04-12T15:45:00',
    author: 'Priya Singh',
    clientId: 'client-005',
    caseId: 'case-008',
    type: 'closure note',
    narrative: 'Food bank registration completed. Client knows Tuesday pickup window and has translated directions.',
    structuredFields: ['Registration completed', 'Closure criteria met'],
    attachments: ['food-bank-registration.pdf'],
    followUpRequired: false,
    visibility: 'team',
    aiSummary: 'Food security bridge is stable and ready for closure monitoring only.',
    aiTags: ['food security', 'resolved'],
  },
  {
    id: 'note-007',
    timestamp: '2026-04-11T18:15:00',
    author: 'Omar Williams',
    clientId: 'client-006',
    caseId: 'case-009',
    type: 'outreach contact',
    narrative: 'Jordan wants counseling support but prefers afternoon appointments and text reminders due to phone battery limits.',
    structuredFields: ['Appointment preference noted', 'Reminder plan needed'],
    attachments: [],
    followUpRequired: true,
    visibility: 'restricted',
    aiSummary: 'Reschedule counseling intake with low-barrier reminder plan.',
    aiTags: ['counseling', 'missed appointment', 'high risk'],
  },
  {
    id: 'note-008',
    timestamp: '2026-04-09T09:05:00',
    author: 'Nia Patel',
    clientId: 'client-007',
    caseId: 'case-010',
    type: 'clinic coordination',
    narrative: 'Clinic confirmed medical verification request. Keisha needs an accessible route and seated waiting area.',
    structuredFields: ['Clinic contacted', 'Accessibility need confirmed'],
    attachments: ['medical-verification-request.pdf'],
    followUpRequired: true,
    visibility: 'team',
    aiSummary: 'Medical verification is waiting on clinic turnaround and accessible appointment planning.',
    aiTags: ['medical', 'benefits', 'accessibility'],
  },
  {
    id: 'note-009',
    timestamp: '2026-04-13T17:40:00',
    author: 'Leah Fraser',
    clientId: 'client-008',
    caseId: 'case-011',
    type: 'youth intake',
    narrative: 'Tariq wants job readiness sessions that do not conflict with family responsibilities and is open to school credit mapping.',
    structuredFields: ['Youth intake started', 'School re-entry interest'],
    attachments: ['youth-readiness-checklist.docx'],
    followUpRequired: true,
    visibility: 'team',
    aiSummary: 'Youth employment orientation and school contact can be bundled into next follow-up.',
    aiTags: ['youth', 'employment', 'school'],
  },
  {
    id: 'note-010',
    timestamp: '2026-04-10T13:10:00',
    author: 'Priya Singh',
    clientId: 'client-009',
    caseId: 'case-012',
    type: 'closure review',
    narrative: 'Marion confirmed stable placement, active income support, and no immediate case management needs.',
    structuredFields: ['Housing confirmed', 'Benefits active', 'Aftercare optional'],
    attachments: ['closure-summary.pdf'],
    followUpRequired: false,
    visibility: 'team',
    aiSummary: 'Case closure criteria are met with optional 30-day aftercare call.',
    aiTags: ['housing', 'closure', 'stabilized'],
  },
  {
    id: 'note-011',
    timestamp: '2026-04-12T12:10:00',
    author: 'Leah Fraser',
    clientId: 'client-010',
    caseId: 'case-013',
    type: 'document recovery',
    narrative: 'Eli has partial appeal paperwork and needs a plain-language timeline before the benefits navigator appointment.',
    structuredFields: ['Appeal paperwork reviewed', 'Timeline needed'],
    attachments: ['appeal-letter-scan.pdf'],
    followUpRequired: true,
    visibility: 'team',
    aiSummary: 'Benefits appeal needs a timeline, recovered ID copy, and navigator booking.',
    aiTags: ['benefits', 'appeal', 'documents'],
  },
  {
    id: 'note-012',
    timestamp: '2026-04-14T08:40:00',
    author: 'Street Bot',
    clientId: 'client-006',
    caseId: 'case-009',
    type: 'risk pattern',
    narrative: 'Detected missed appointment plus pending consent and high-risk outreach notes across the past week.',
    structuredFields: ['Pattern detected', 'Worker review requested'],
    attachments: [],
    followUpRequired: true,
    visibility: 'restricted',
    aiSummary: 'Escalate reminder plan and partner reschedule today.',
    aiTags: ['automation', 'urgent pattern', 'counseling'],
  },
];

const initialTasks: TaskRecord[] = [
  {
    id: 'task-001',
    title: 'Call shelter intake line',
    clientId: 'client-001',
    caseId: 'case-001',
    owner: 'Nia Patel',
    dueDate: '2026-04-14T13:00:00',
    priority: 'urgent',
    status: 'open',
    reminderRules: '30 minutes before due',
    dependency: 'ID alternative confirmation',
    notes: 'Ask whether consent photo can temporarily satisfy referral packet.',
  },
  {
    id: 'task-002',
    title: 'Upload signed consent',
    clientId: 'client-001',
    caseId: 'case-002',
    owner: 'Nia Patel',
    dueDate: '2026-04-16T10:00:00',
    priority: 'high',
    status: 'in progress',
    reminderRules: 'Morning of due date',
    dependency: 'Client signature',
    notes: 'Scan and tag as consent.',
  },
  {
    id: 'task-003',
    title: 'Employment partner follow-up',
    clientId: 'client-002',
    caseId: 'case-003',
    owner: 'Omar Williams',
    dueDate: '2026-04-15T10:00:00',
    priority: 'medium',
    status: 'open',
    reminderRules: '1 day before due',
    dependency: 'Partner response',
    notes: 'Confirm orientation reschedule and SMS reminder.',
  },
  {
    id: 'task-004',
    title: 'Interpreter-supported outreach call',
    clientId: 'client-004',
    caseId: 'case-005',
    owner: 'Priya Singh',
    dueDate: '2026-04-14T11:00:00',
    priority: 'urgent',
    status: 'blocked',
    reminderRules: 'At start of day',
    dependency: 'Interpreter availability',
    notes: 'Try shelter desk first if phone is unreachable.',
  },
  {
    id: 'task-005',
    title: 'Complete clinic consent packet',
    clientId: 'client-002',
    caseId: 'case-006',
    owner: 'Omar Williams',
    dueDate: '2026-04-15T14:00:00',
    priority: 'medium',
    status: 'open',
    reminderRules: 'Morning of due date',
    dependency: 'Client drop-in availability',
    notes: 'Bring printed clinic form and explain release language.',
  },
  {
    id: 'task-006',
    title: 'Confirm proof of address rules',
    clientId: 'client-005',
    caseId: 'case-007',
    owner: 'Priya Singh',
    dueDate: '2026-04-16T09:30:00',
    priority: 'medium',
    status: 'in progress',
    reminderRules: '1 day before due',
    dependency: 'City ID Desk response',
    notes: 'Ask whether family letter plus meal program letter is enough.',
  },
  {
    id: 'task-007',
    title: 'Translate food bank pickup instructions',
    clientId: 'client-005',
    caseId: 'case-008',
    owner: 'Priya Singh',
    dueDate: '2026-04-12T12:00:00',
    priority: 'low',
    status: 'complete',
    reminderRules: 'None',
    dependency: 'Registration complete',
    completedAt: '2026-04-12T15:40:00',
    notes: 'Instructions sent in Spanish over WhatsApp.',
  },
  {
    id: 'task-008',
    title: 'Reschedule afternoon counseling intake',
    clientId: 'client-006',
    caseId: 'case-009',
    owner: 'Omar Williams',
    dueDate: '2026-04-13T16:00:00',
    priority: 'high',
    status: 'blocked',
    reminderRules: 'Every weekday until scheduled',
    dependency: 'Partner afternoon slot',
    notes: 'Partner voicemail left; waiting for appointment options.',
  },
  {
    id: 'task-009',
    title: 'Send low-battery SMS reminder plan',
    clientId: 'client-006',
    caseId: 'case-009',
    owner: 'Omar Williams',
    dueDate: '2026-04-14T17:30:00',
    priority: 'high',
    status: 'open',
    reminderRules: '2 hours before due',
    dependency: 'Counseling slot response',
    notes: 'Use brief text and include charging station location.',
  },
  {
    id: 'task-010',
    title: 'Check medical verification status',
    clientId: 'client-007',
    caseId: 'case-010',
    owner: 'Nia Patel',
    dueDate: '2026-04-15T09:00:00',
    priority: 'medium',
    status: 'open',
    reminderRules: 'At start of day',
    dependency: 'Clinic admin response',
    notes: 'Ask whether form can be faxed directly to benefits office.',
  },
  {
    id: 'task-011',
    title: 'Book youth employment orientation',
    clientId: 'client-008',
    caseId: 'case-011',
    owner: 'Leah Fraser',
    dueDate: '2026-04-21T16:00:00',
    priority: 'low',
    status: 'open',
    reminderRules: '2 days before due',
    dependency: 'Youth availability after 4 PM',
    notes: 'Confirm evening-friendly program slot.',
  },
  {
    id: 'task-012',
    title: 'Create benefits appeal timeline',
    clientId: 'client-010',
    caseId: 'case-013',
    owner: 'Leah Fraser',
    dueDate: '2026-04-15T13:30:00',
    priority: 'medium',
    status: 'in progress',
    reminderRules: 'Morning of due date',
    dependency: 'Appeal letter scan',
    notes: 'Use plain-language timeline with missing dates highlighted.',
  },
  {
    id: 'task-013',
    title: 'Run closure QA for stabilized housing case',
    clientId: 'client-009',
    caseId: 'case-012',
    owner: 'Priya Singh',
    dueDate: '2026-04-10T16:00:00',
    priority: 'low',
    status: 'complete',
    reminderRules: 'None',
    dependency: 'Closure summary',
    completedAt: '2026-04-10T16:15:00',
    notes: 'Closure QA complete. Aftercare call optional.',
  },
  {
    id: 'task-014',
    title: 'Review legal consent expiry with supervisor',
    clientId: 'client-004',
    caseId: 'case-005',
    owner: 'Priya Singh',
    dueDate: '2026-04-13T11:00:00',
    priority: 'urgent',
    status: 'open',
    reminderRules: 'Escalate if not complete by noon',
    dependency: 'Supervisor availability',
    notes: 'Consent expiry intersects with legal deadline.',
  },
];

const initialReferrals: ReferralRecord[] = [
  {
    id: 'ref-001',
    clientId: 'client-001',
    caseId: 'case-001',
    organization: 'Harbour Shelter Intake',
    serviceCategory: 'Shelter placement',
    referralDate: '2026-04-13',
    status: 'sent',
    contactPerson: 'Intake Desk',
    contact: 'intake@example.org',
    appointmentDate: '2026-04-15T09:00:00',
    outcome: 'Waiting for document alternative decision',
    followUpRequired: true,
    supportingDocuments: ['consent-photo.pdf'],
  },
  {
    id: 'ref-002',
    clientId: 'client-002',
    caseId: 'case-003',
    organization: 'Bridge Works Employment',
    serviceCategory: 'Employment',
    referralDate: '2026-04-05',
    status: 'acknowledged',
    contactPerson: 'M. Rivera',
    contact: 'programs@example.org',
    appointmentDate: '2026-04-18T10:30:00',
    outcome: 'Orientation slot pending',
    followUpRequired: true,
    supportingDocuments: ['resume-draft.docx'],
  },
  {
    id: 'ref-003',
    clientId: 'client-004',
    caseId: 'case-005',
    organization: 'Downtown Legal Clinic',
    serviceCategory: 'Legal support',
    referralDate: '2026-03-28',
    status: 'scheduled',
    contactPerson: 'Clinic coordinator',
    contact: 'legal@example.org',
    appointmentDate: '2026-04-18T14:00:00',
    outcome: 'Deadline review scheduled',
    followUpRequired: true,
    supportingDocuments: ['clinic-intake.pdf', 'expired-consent.pdf'],
  },
  {
    id: 'ref-004',
    clientId: 'client-002',
    caseId: 'case-006',
    organization: 'Mobile Health Outreach',
    serviceCategory: 'Medical coordination',
    referralDate: '2026-04-09',
    status: 'sent',
    contactPerson: 'Clinic navigator',
    contact: 'health@example.org',
    appointmentDate: '2026-04-17T11:30:00',
    outcome: 'Consent packet required before slot confirmation',
    followUpRequired: true,
    supportingDocuments: ['clinic-consent-draft.pdf'],
  },
  {
    id: 'ref-005',
    clientId: 'client-005',
    caseId: 'case-007',
    organization: 'City ID Desk',
    serviceCategory: 'ID replacement',
    referralDate: '2026-04-13',
    status: 'acknowledged',
    contactPerson: 'ID intake worker',
    contact: 'id-desk@example.org',
    appointmentDate: '2026-04-22T10:00:00',
    outcome: 'Proof of address review pending',
    followUpRequired: true,
    supportingDocuments: ['lease-letter-photo.jpg', 'prior-id-photo.jpg'],
  },
  {
    id: 'ref-006',
    clientId: 'client-005',
    caseId: 'case-008',
    organization: 'Community Food Bank',
    serviceCategory: 'Food security',
    referralDate: '2026-04-05',
    status: 'completed',
    contactPerson: 'Food bank coordinator',
    contact: 'foodbank@example.org',
    appointmentDate: '2026-04-12T15:00:00',
    outcome: 'Weekly hamper pickup confirmed',
    followUpRequired: false,
    supportingDocuments: ['food-bank-registration.pdf'],
  },
  {
    id: 'ref-007',
    clientId: 'client-006',
    caseId: 'case-009',
    organization: 'Safe Steps Counseling',
    serviceCategory: 'Mental health navigation',
    referralDate: '2026-04-02',
    status: 'no response',
    contactPerson: 'Intake therapist',
    contact: 'counseling@example.org',
    appointmentDate: '2026-04-13T16:00:00',
    outcome: 'Voicemail left for afternoon reschedule',
    followUpRequired: true,
    supportingDocuments: ['warm-handoff-note.pdf'],
  },
  {
    id: 'ref-008',
    clientId: 'client-007',
    caseId: 'case-010',
    organization: 'Mobile Health Outreach',
    serviceCategory: 'Medical verification',
    referralDate: '2026-04-03',
    status: 'scheduled',
    contactPerson: 'Clinic admin',
    contact: 'health@example.org',
    appointmentDate: '2026-04-16T09:30:00',
    outcome: 'Verification form queued for clinician signature',
    followUpRequired: true,
    supportingDocuments: ['medical-verification-request.pdf'],
  },
  {
    id: 'ref-009',
    clientId: 'client-008',
    caseId: 'case-011',
    organization: 'Youth Futures Studio',
    serviceCategory: 'Youth employment',
    referralDate: '2026-04-14',
    status: 'draft',
    contactPerson: 'Youth coordinator',
    contact: 'youth@example.org',
    appointmentDate: '2026-04-23T17:30:00',
    outcome: 'Draft referral waiting for consent completion',
    followUpRequired: true,
    supportingDocuments: ['youth-readiness-checklist.docx'],
  },
  {
    id: 'ref-010',
    clientId: 'client-010',
    caseId: 'case-013',
    organization: 'Benefits Navigator Desk',
    serviceCategory: 'Benefits appeal',
    referralDate: '2026-04-12',
    status: 'sent',
    contactPerson: 'Appeals navigator',
    contact: 'benefits@example.org',
    appointmentDate: '2026-04-19T13:00:00',
    outcome: 'Navigator requested appeal timeline before appointment',
    followUpRequired: true,
    supportingDocuments: ['appeal-letter-scan.pdf'],
  },
  {
    id: 'ref-011',
    clientId: 'client-009',
    caseId: 'case-012',
    organization: 'Tenant Rights Hub',
    serviceCategory: 'Housing aftercare',
    referralDate: '2026-04-08',
    status: 'closed',
    contactPerson: 'Aftercare desk',
    contact: 'tenant-rights@example.org',
    appointmentDate: '2026-04-10T15:00:00',
    outcome: 'Aftercare resources delivered during closure call',
    followUpRequired: false,
    supportingDocuments: ['tenant-rights-aftercare.pdf'],
  },
];

const initialDocuments: DocumentRecord[] = [
  {
    id: 'doc-001',
    clientId: 'client-001',
    caseId: 'case-001',
    name: 'Signed consent photo',
    type: 'PDF',
    tag: 'Consent',
    uploadedAt: '2026-04-14T09:45:00',
    expiresAt: '2026-07-14',
    permission: 'team',
    searchableText: 'Consent for referral and case coordination.',
  },
  {
    id: 'doc-002',
    clientId: 'client-001',
    caseId: 'case-002',
    name: 'Benefits application draft',
    type: 'DOCX',
    tag: 'Benefits',
    uploadedAt: '2026-04-12T14:00:00',
    permission: 'team',
    searchableText: 'Draft income support application.',
  },
  {
    id: 'doc-003',
    clientId: 'client-004',
    caseId: 'case-005',
    name: 'Legal clinic intake packet',
    type: 'PDF',
    tag: 'Legal',
    uploadedAt: '2026-03-30T11:40:00',
    permission: 'restricted',
    searchableText: 'Clinic intake and legal timeline.',
  },
  {
    id: 'doc-004',
    clientId: 'client-002',
    caseId: 'case-006',
    name: 'Clinic consent draft',
    type: 'PDF',
    tag: 'Medical',
    uploadedAt: '2026-04-09T13:30:00',
    expiresAt: '2026-05-09',
    permission: 'team',
    searchableText: 'Medical clinic release draft for Mobile Health Outreach.',
  },
  {
    id: 'doc-005',
    clientId: 'client-005',
    caseId: 'case-007',
    name: 'Prior ID photo',
    type: 'JPG',
    tag: 'ID',
    uploadedAt: '2026-04-13T10:35:00',
    permission: 'restricted',
    searchableText: 'Photo of expired provincial ID for replacement appointment.',
  },
  {
    id: 'doc-006',
    clientId: 'client-005',
    caseId: 'case-007',
    name: 'Address support letter',
    type: 'PDF',
    tag: 'ID',
    uploadedAt: '2026-04-13T10:40:00',
    permission: 'team',
    searchableText: 'Letter confirming temporary address and family support.',
  },
  {
    id: 'doc-007',
    clientId: 'client-005',
    caseId: 'case-008',
    name: 'Food bank registration',
    type: 'PDF',
    tag: 'Community resource',
    uploadedAt: '2026-04-12T15:35:00',
    permission: 'team',
    searchableText: 'Community Food Bank weekly pickup registration.',
  },
  {
    id: 'doc-008',
    clientId: 'client-006',
    caseId: 'case-009',
    name: 'Warm handoff note',
    type: 'PDF',
    tag: 'Mental health',
    uploadedAt: '2026-04-11T18:45:00',
    expiresAt: '2026-04-30',
    permission: 'restricted',
    searchableText: 'Counseling warm handoff summary and reminder preferences.',
  },
  {
    id: 'doc-009',
    clientId: 'client-007',
    caseId: 'case-010',
    name: 'Medical verification request',
    type: 'PDF',
    tag: 'Benefits',
    uploadedAt: '2026-04-09T09:20:00',
    expiresAt: '2026-04-28',
    permission: 'restricted',
    searchableText: 'Medical verification request for disability support application.',
  },
  {
    id: 'doc-010',
    clientId: 'client-008',
    caseId: 'case-011',
    name: 'Youth readiness checklist',
    type: 'DOCX',
    tag: 'Employment',
    uploadedAt: '2026-04-13T17:55:00',
    permission: 'team',
    searchableText: 'Youth employment and school re-entry readiness checklist.',
  },
  {
    id: 'doc-011',
    clientId: 'client-009',
    caseId: 'case-012',
    name: 'Housing closure summary',
    type: 'PDF',
    tag: 'Closure',
    uploadedAt: '2026-04-10T16:15:00',
    permission: 'team',
    searchableText: 'Housing stabilized, benefits active, and aftercare plan shared.',
  },
  {
    id: 'doc-012',
    clientId: 'client-010',
    caseId: 'case-013',
    name: 'Appeal letter scan',
    type: 'PDF',
    tag: 'Benefits',
    uploadedAt: '2026-04-12T12:30:00',
    expiresAt: '2026-05-01',
    permission: 'team',
    searchableText: 'Benefits appeal letter and partial timeline details.',
  },
];

const initialAppointments: AppointmentRecord[] = [
  {
    id: 'appt-001',
    clientId: 'client-001',
    caseId: 'case-001',
    dateTime: '2026-04-15T09:00:00',
    location: 'Harbour Shelter Intake',
    serviceProvider: 'Harbour Shelter',
    purpose: 'Emergency housing intake',
    attendanceStatus: 'scheduled',
    reminders: 'SMS reminder evening before and morning of',
    prepChecklist: ['Confirm ID alternative', 'Bring consent copy', 'Confirm transit route'],
    outcomeNotes: 'Pending',
  },
  {
    id: 'appt-002',
    clientId: 'client-002',
    caseId: 'case-003',
    dateTime: '2026-04-18T10:30:00',
    location: 'Bridge Works Employment',
    serviceProvider: 'Bridge Works',
    purpose: 'Orientation reschedule',
    attendanceStatus: 'scheduled',
    reminders: 'Phone reminder morning of',
    prepChecklist: ['Resume draft', 'Work availability', 'Transit directions'],
    outcomeNotes: 'Pending',
  },
  {
    id: 'appt-003',
    clientId: 'client-004',
    caseId: 'case-005',
    dateTime: '2026-04-18T14:00:00',
    location: 'Downtown Legal Clinic',
    serviceProvider: 'Legal Clinic',
    purpose: 'Deadline review',
    attendanceStatus: 'scheduled',
    reminders: 'Interpreter-supported call before appointment',
    prepChecklist: ['Updated consent', 'Interpreter booking', 'Clinic packet'],
    outcomeNotes: 'Pending',
  },
  {
    id: 'appt-004',
    clientId: 'client-002',
    caseId: 'case-006',
    dateTime: '2026-04-17T11:30:00',
    location: 'Mobile Health Outreach clinic room',
    serviceProvider: 'Mobile Health Outreach',
    purpose: 'Clinic paperwork and appointment confirmation',
    attendanceStatus: 'scheduled',
    reminders: 'Phone reminder morning of and printed slip at drop-in',
    prepChecklist: ['Consent packet', 'Health card copy', 'Medication list if available'],
    outcomeNotes: 'Pending',
  },
  {
    id: 'appt-005',
    clientId: 'client-005',
    caseId: 'case-007',
    dateTime: '2026-04-22T10:00:00',
    location: 'City ID Desk',
    serviceProvider: 'City ID Desk',
    purpose: 'ID replacement intake',
    attendanceStatus: 'scheduled',
    reminders: 'WhatsApp in Spanish one day before',
    prepChecklist: ['Proof of address', 'Prior ID photo', 'Interpreter request'],
    outcomeNotes: 'Pending proof review.',
  },
  {
    id: 'appt-006',
    clientId: 'client-006',
    caseId: 'case-009',
    dateTime: '2026-04-13T16:00:00',
    location: 'Safe Steps Counseling',
    serviceProvider: 'Safe Steps Counseling',
    purpose: 'Initial counseling intake',
    attendanceStatus: 'missed',
    reminders: 'Text reminder sent two hours before',
    prepChecklist: ['Warm handoff note', 'Consent discussion', 'Charging station option'],
    outcomeNotes: 'Client did not attend. Partner asked for reschedule request.',
  },
  {
    id: 'appt-007',
    clientId: 'client-007',
    caseId: 'case-010',
    dateTime: '2026-04-16T09:30:00',
    location: 'North clinic accessible exam room',
    serviceProvider: 'Mobile Health Outreach',
    purpose: 'Medical verification signature',
    attendanceStatus: 'scheduled',
    reminders: 'Phone reminder before noon day prior',
    prepChecklist: ['Accessible route', 'Medical verification request', 'Benefits form'],
    outcomeNotes: 'Pending',
  },
  {
    id: 'appt-008',
    clientId: 'client-008',
    caseId: 'case-011',
    dateTime: '2026-04-23T17:30:00',
    location: 'Youth Futures Studio',
    serviceProvider: 'Youth Futures Studio',
    purpose: 'Employment orientation',
    attendanceStatus: 'scheduled',
    reminders: 'DM reminder two days before and day of',
    prepChecklist: ['Youth consent', 'Transit pass', 'School credit questions'],
    outcomeNotes: 'Draft referral waiting for consent.',
  },
  {
    id: 'appt-009',
    clientId: 'client-009',
    caseId: 'case-012',
    dateTime: '2026-04-10T15:00:00',
    location: 'Etobicoke housing office',
    serviceProvider: 'Tenant Rights Hub',
    purpose: 'Housing aftercare and closure review',
    attendanceStatus: 'attended',
    reminders: 'Phone reminder morning of',
    prepChecklist: ['Closure summary', 'Aftercare contacts', 'Benefits confirmation'],
    outcomeNotes: 'Attended. Resources delivered and case closed.',
  },
  {
    id: 'appt-010',
    clientId: 'client-010',
    caseId: 'case-013',
    dateTime: '2026-04-19T13:00:00',
    location: 'Benefits Navigator Desk',
    serviceProvider: 'Benefits Navigator Desk',
    purpose: 'Benefits appeal navigator appointment',
    attendanceStatus: 'scheduled',
    reminders: 'Email reminder and phone call the day before',
    prepChecklist: ['Appeal timeline', 'ID copy', 'Plain-language questions'],
    outcomeNotes: 'Pending',
  },
];

const initialTimelineEvents: TimelineEvent[] = [
  {
    id: 'tl-001',
    clientId: 'client-001',
    caseId: 'case-001',
    occurredAt: '2026-04-14T09:45:00',
    type: 'document uploaded',
    title: 'Consent document added',
    detail: 'Signed consent photo was uploaded and tagged for shelter referral.',
  },
  {
    id: 'tl-002',
    clientId: 'client-001',
    caseId: 'case-001',
    occurredAt: '2026-04-14T09:30:00',
    type: 'note added',
    title: 'Outreach contact logged',
    detail: 'Worker logged outreach note and marked follow-up required.',
  },
  {
    id: 'tl-003',
    clientId: 'client-001',
    caseId: 'case-001',
    occurredAt: '2026-04-13T11:00:00',
    type: 'referral sent',
    title: 'Shelter referral sent',
    detail: 'Referral packet sent to Harbour Shelter Intake.',
  },
  {
    id: 'tl-004',
    clientId: 'client-004',
    caseId: 'case-005',
    occurredAt: '2026-04-14T08:00:00',
    type: 'Street Bot summary added',
    title: 'No-contact risk raised',
    detail: 'Street Bot flagged legal deadline and stale contact pattern.',
  },
  {
    id: 'tl-005',
    clientId: 'client-005',
    caseId: 'case-007',
    occurredAt: '2026-04-13T10:40:00',
    type: 'document uploaded',
    title: 'ID proof documents added',
    detail: 'Prior ID photo and address support letter were attached for City ID Desk review.',
  },
  {
    id: 'tl-006',
    clientId: 'client-005',
    caseId: 'case-008',
    occurredAt: '2026-04-12T15:40:00',
    type: 'case resolved',
    title: 'Food bank support resolved',
    detail: 'Weekly hamper pickup confirmed and translated instructions shared.',
  },
  {
    id: 'tl-007',
    clientId: 'client-006',
    caseId: 'case-009',
    occurredAt: '2026-04-13T16:00:00',
    type: 'missed appointment',
    title: 'Counseling intake missed',
    detail: 'Partner requested a reschedule with clearer afternoon reminder plan.',
  },
  {
    id: 'tl-008',
    clientId: 'client-006',
    caseId: 'case-009',
    occurredAt: '2026-04-14T08:40:00',
    type: 'Street Bot pattern',
    title: 'Reschedule risk pattern detected',
    detail: 'Street Bot linked missed intake, pending consent, and high-risk outreach notes.',
  },
  {
    id: 'tl-009',
    clientId: 'client-007',
    caseId: 'case-010',
    occurredAt: '2026-04-09T09:20:00',
    type: 'referral scheduled',
    title: 'Medical verification queued',
    detail: 'Clinic accepted verification request and scheduled a signature review.',
  },
  {
    id: 'tl-010',
    clientId: 'client-008',
    caseId: 'case-011',
    occurredAt: '2026-04-13T17:55:00',
    type: 'intake started',
    title: 'Youth employment intake opened',
    detail: 'Readiness checklist completed and orientation slot identified.',
  },
  {
    id: 'tl-011',
    clientId: 'client-009',
    caseId: 'case-012',
    occurredAt: '2026-04-10T16:15:00',
    type: 'case closed',
    title: 'Housing case closed',
    detail: 'Stable placement, benefits activation, and aftercare resources were confirmed.',
  },
  {
    id: 'tl-012',
    clientId: 'client-010',
    caseId: 'case-013',
    occurredAt: '2026-04-12T12:30:00',
    type: 'document uploaded',
    title: 'Benefits appeal letter added',
    detail: 'Appeal letter scan uploaded and flagged for plain-language timeline work.',
  },
  {
    id: 'tl-013',
    clientId: 'client-002',
    caseId: 'case-006',
    occurredAt: '2026-04-09T13:30:00',
    type: 'clinic referral sent',
    title: 'Mobile Health referral sent',
    detail: 'Referral sent with draft consent and request for appointment hold.',
  },
  {
    id: 'tl-014',
    clientId: 'client-004',
    caseId: 'case-005',
    occurredAt: '2026-04-13T11:00:00',
    type: 'supervisor escalation',
    title: 'Legal consent expiry escalated',
    detail: 'Supervisor review task opened because consent expiry overlaps legal deadline.',
  },
];

const clientWikiProfiles: ClientWikiProfile[] = [
  {
    clientId: 'client-001',
    lead:
      'Maya Chen is an active housing and benefits client whose case history shows a shift from urgent street outreach toward document stabilization, shelter referral readiness, and benefits package completion.',
    profileContext: [
      'Contact works best by text first, with phone follow-up after 4 PM when the device is charged and reachable.',
      'Housing work and benefits work are linked because missing ID and consent paperwork affect both referral pathways.',
      'Medical vulnerability should remain visible in triage notes so shelter placement decisions do not treat the case as a routine vacancy request.',
    ],
    workingSynthesis: [
      'The strongest current pattern is document dependency: the same missing ID proof appears in housing, benefits, and appointment prep.',
      'When contact is successful, Maya completes concrete steps quickly; the system should turn each contact into a short checklist before the next outreach window.',
      'The case is ready for cross-team handoff only if the shelter referral, consent packet, and benefits document list are shown together.',
    ],
    sourceNotes: [
      {
        caseId: 'case-001',
        timestamp: '2026-03-29T15:20:00',
        author: 'Nia Patel',
        type: 'street outreach baseline',
        narrative:
          'Initial wiki baseline created after Maya identified housing as the first priority and benefits as the second priority. Worker noted that document recovery has to be treated as part of the housing plan rather than a separate administrative task.',
        structuredFields: ['Housing first priority', 'Benefits linked', 'Document recovery dependency'],
        attachments: ['outreach-baseline-maya.pdf'],
        followUpRequired: true,
        visibility: 'team',
        aiSummary: 'Maya needs one combined plan for housing, ID, and benefits rather than parallel disconnected tasks.',
        aiTags: ['wiki baseline', 'housing', 'document dependency'],
      },
      {
        caseId: 'case-002',
        timestamp: '2026-04-08T16:35:00',
        author: 'Street Bot',
        type: 'wiki synthesis',
        narrative:
          'Compared notes, tasks, and referrals and found that the next best action is to gather acceptable alternate ID proof before the benefits appointment. The wiki should surface shelter intake rules, benefits documents, and consent status together.',
        structuredFields: ['Cross-case synthesis', 'Alternate ID rule', 'Benefits prep'],
        attachments: [],
        followUpRequired: true,
        visibility: 'internal',
        aiSummary: 'Surface alternate ID requirements across Maya housing and benefits cases.',
        aiTags: ['automation', 'cross-case', 'retrieval hint'],
      },
    ],
    milestones: [
      {
        caseId: 'case-001',
        occurredAt: '2026-03-29T15:20:00',
        type: 'wiki baseline',
        title: 'Housing and benefits baseline captured',
        detail: 'The first client wiki snapshot connected housing urgency with ID recovery and benefits preparation.',
        source: 'street outreach baseline',
      },
      {
        caseId: 'case-001',
        occurredAt: '2026-04-02T10:00:00',
        type: 'case opened',
        title: 'Housing stabilization case opened',
        detail: 'Case opened from outreach source with emergency housing, ID replacement, and intake scheduling goals.',
        source: 'case record SV-CASE-2401',
      },
      {
        caseId: 'case-002',
        occurredAt: '2026-04-08T16:35:00',
        type: 'knowledge synthesis',
        title: 'Benefits and housing dependencies linked',
        detail: 'Street Bot connected missing ID proof across both open cases and recommended a shared checklist.',
        source: 'wiki synthesis',
      },
      {
        caseId: 'case-001',
        occurredAt: '2026-04-14T09:45:00',
        type: 'document uploaded',
        title: 'Consent document added',
        detail: 'Signed consent photo was uploaded and tagged for shelter referral review.',
        source: 'document record',
      },
    ],
    retrievalHints: [
      'Ask: What documents block Maya Chen housing and benefits work?',
      'Retrieve notes tagged housing, consent, urgent, alternate ID, and benefits.',
      'When Maya is selected, return the shelter referral and benefits checklist together.',
    ],
    openQuestions: [
      'Will Toronto Harbour Light accept the consent photo while ID recovery is in progress?',
      'Which benefits fields still require bank statement confirmation?',
      'Is there a safer contact window than after 4 PM for urgent shelter updates?',
    ],
  },
  {
    clientId: 'client-002',
    lead:
      'Devon Brooks has two active threads: employment bridge support and clinic paperwork. The wiki record shows a client who engages when reminders are specific but loses momentum when consent language and appointment logistics are split across teams.',
    profileContext: [
      'Phone contact is preferred, but reminders need to be plain and tied to appointment purpose.',
      'Employment support and clinic paperwork both depend on consent being completed in a low-pressure setting.',
      'Missed orientation should be read as a workflow design issue first, not disengagement.',
    ],
    workingSynthesis: [
      'Devon responds well to concrete next steps and short reminders; vague partner follow-up creates delay.',
      'Clinic consent and employment orientation should be scheduled around drop-in hours to reduce missed appointments.',
      'The wiki should keep partner response status, orientation timing, and consent status on one page.',
    ],
    sourceNotes: [
      {
        caseId: 'case-003',
        timestamp: '2026-03-25T11:05:00',
        author: 'Omar Williams',
        type: 'employment history note',
        narrative:
          'Devon described casual work history and asked for help turning recent short jobs into a resume story. Worker noted that job readiness should start with confidence and communication before applications.',
        structuredFields: ['Resume story needed', 'Confidence building', 'Orientation pending'],
        attachments: ['devon-work-history.docx'],
        followUpRequired: true,
        visibility: 'team',
        aiSummary: 'Employment support should begin with resume narrative and reminder scaffolding.',
        aiTags: ['employment', 'resume', 'confidence'],
      },
      {
        caseId: 'case-006',
        timestamp: '2026-04-09T13:50:00',
        author: 'Omar Williams',
        type: 'clinic consent debrief',
        narrative:
          'Devon asked for more time with the clinic consent form and wanted the health card copy request explained line by line. Worker marked consent review as a case management task rather than a document upload only.',
        structuredFields: ['Consent needs explanation', 'Health card copy pending', 'Drop-in review preferred'],
        attachments: ['clinic-consent-draft.pdf'],
        followUpRequired: true,
        visibility: 'internal',
        aiSummary: 'Consent completion needs a guided review during drop-in hours.',
        aiTags: ['medical coordination', 'consent', 'paperwork'],
      },
    ],
    milestones: [
      {
        caseId: 'case-003',
        occurredAt: '2026-03-22T10:00:00',
        type: 'case opened',
        title: 'Employment bridge case opened',
        detail: 'Drop-in intake identified orientation, resume update, and reminder support as the first workflow.',
        source: 'case record SV-CASE-2403',
      },
      {
        caseId: 'case-003',
        occurredAt: '2026-03-25T11:05:00',
        type: 'wiki note',
        title: 'Work history converted into resume story',
        detail: 'Wiki note captured recent casual work, confidence goals, and communication support.',
        source: 'employment history note',
      },
      {
        caseId: 'case-006',
        occurredAt: '2026-04-09T13:30:00',
        type: 'clinic referral sent',
        title: 'Clinic appointment hold requested',
        detail: 'Referral sent with draft consent and request for the clinic to hold an appointment slot.',
        source: 'timeline record',
      },
      {
        caseId: 'case-006',
        occurredAt: '2026-04-12T13:15:00',
        type: 'phone call',
        title: 'Reminder pattern confirmed',
        detail: 'Devon confirmed interest and asked for reminder before employment orientation.',
        source: 'phone call note',
      },
    ],
    retrievalHints: [
      'Ask: What reminders does Devon need before appointments?',
      'Retrieve employment, consent, clinic, orientation, and resume notes together.',
      'When Devon is selected, return both employment partner status and clinic consent status.',
    ],
    openQuestions: [
      'Can the employment partner offer an orientation after drop-in hours?',
      'Does the clinic accept a later health card copy if consent is completed first?',
      'Which reminder channel has the best response rate for Devon?',
    ],
  },
  {
    clientId: 'client-003',
    lead:
      'Alina Morgan is a youth participant whose benefits renewal is low risk but time sensitive. The wiki shows a strong documentation pattern and a preference for hybrid, low-stimulation review.',
    profileContext: [
      'Hybrid meetings are preferred and help keep document review manageable.',
      'Benefits renewal is connected to youth program stability because income continuity supports participation.',
      'Email and WhatsApp are better than phone calls for follow-up unless the issue is urgent.',
    ],
    workingSynthesis: [
      'Alina has the needed documents but benefits from quiet review time and a written recap.',
      'The wiki should keep renewal due dates, youth program goals, and counseling intake context together.',
      'The main risk is not missing information; it is losing the submission window.',
    ],
    sourceNotes: [
      {
        caseId: 'case-004',
        timestamp: '2026-04-04T14:20:00',
        author: 'Nia Patel',
        type: 'benefits renewal prep',
        narrative:
          'Alina forwarded document screenshots and asked for a quiet hybrid review before submission. Worker noted that the renewal package is complete enough for a final check.',
        structuredFields: ['Documents forwarded', 'Hybrid review requested', 'Final check needed'],
        attachments: ['alina-renewal-screenshots.zip'],
        followUpRequired: true,
        visibility: 'team',
        aiSummary: 'Benefits renewal is ready for a quiet final review before submission.',
        aiTags: ['benefits', 'youth', 'hybrid review'],
      },
      {
        caseId: 'case-004',
        timestamp: '2026-04-11T12:30:00',
        author: 'Street Bot',
        type: 'deadline watch',
        narrative:
          'Deadline watch added because the benefits renewal due date is approaching while the case is low priority. Wiki should keep the due date visible even when risk is low.',
        structuredFields: ['Deadline watch', 'Low risk but time sensitive'],
        attachments: [],
        followUpRequired: true,
        visibility: 'internal',
        aiSummary: 'Low-risk renewal still needs due-date visibility.',
        aiTags: ['deadline', 'benefits', 'automation'],
      },
    ],
    milestones: [
      {
        caseId: 'case-004',
        occurredAt: '2026-04-04T14:20:00',
        type: 'documents gathered',
        title: 'Renewal screenshots received',
        detail: 'Client sent document screenshots and asked for a hybrid final review.',
        source: 'benefits renewal prep',
      },
      {
        caseId: 'case-004',
        occurredAt: '2026-04-08T10:00:00',
        type: 'case opened',
        title: 'Benefits renewal case opened',
        detail: 'Youth program referral created renewal support case with submission due by Apr 25.',
        source: 'case record SV-CASE-2404',
      },
      {
        caseId: 'case-004',
        occurredAt: '2026-04-10T16:45:00',
        type: 'office visit',
        title: 'Checklist reviewed',
        detail: 'Renewal checklist reviewed; all documents are available in email.',
        source: 'office visit note',
      },
      {
        caseId: 'case-004',
        occurredAt: '2026-04-11T12:30:00',
        type: 'automation',
        title: 'Deadline watch added',
        detail: 'Street Bot marked low-risk renewal as time sensitive because the submission window is narrowing.',
        source: 'deadline watch',
      },
    ],
    retrievalHints: [
      'Ask: What is still needed for Alina Morgan benefits renewal?',
      'Retrieve renewal checklist, youth program participation, and due-date watch records.',
      'Prioritize notes with hybrid review and document screenshots.',
    ],
    openQuestions: [
      'Has the final renewal review been booked in a quiet meeting window?',
      'Which confirmation number should be recorded after submission?',
      'Should counseling intake context be linked to the same youth support page?',
    ],
  },
  {
    clientId: 'client-004',
    lead:
      'Samir Ahmed is an urgent legal-support client with interpreter needs, expired consent, and stale contact. The wiki needs to preserve legal deadlines, outreach attempts, and consent status in one readable chronology.',
    profileContext: [
      'Interpreter support is required for complex legal or benefits language.',
      'Consent expiry is not just compliance context; it blocks partner communication close to a legal deadline.',
      'No-contact periods should trigger escalation because the case has deadline and placement risk.',
    ],
    workingSynthesis: [
      'The case risk comes from three items compounding: legal deadline, expired consent, and limited contact.',
      'The wiki should make the latest confirmed location and interpreter plan immediately visible.',
      'Supervisor escalation is appropriate until consent and appointment confirmation are both updated.',
    ],
    sourceNotes: [
      {
        caseId: 'case-005',
        timestamp: '2026-03-21T10:10:00',
        author: 'Priya Singh',
        type: 'legal timeline reconstruction',
        narrative:
          'Built a plain-language legal timeline from clinic intake notes. Key dates were translated into Arabic summary language and flagged for interpreter-supported confirmation.',
        structuredFields: ['Timeline reconstructed', 'Interpreter summary needed', 'Legal deadline visible'],
        attachments: ['samir-legal-timeline.pdf'],
        followUpRequired: true,
        visibility: 'restricted',
        aiSummary: 'Legal timeline exists but must be confirmed with interpreter support.',
        aiTags: ['legal', 'timeline', 'interpreter'],
      },
      {
        caseId: 'case-005',
        timestamp: '2026-04-13T11:05:00',
        author: 'Street Bot',
        type: 'escalation synthesis',
        narrative:
          'Street Bot linked expired consent, no contact in 14 days, and legal deadline proximity. Recommended shelter desk contact before closing the outreach loop.',
        structuredFields: ['Expired consent', 'No contact pattern', 'Shelter desk route'],
        attachments: [],
        followUpRequired: true,
        visibility: 'restricted',
        aiSummary: 'Escalate Samir case until contact and consent are updated.',
        aiTags: ['urgent', 'legal', 'no contact'],
      },
    ],
    milestones: [
      {
        caseId: 'case-005',
        occurredAt: '2026-03-18T09:00:00',
        type: 'case opened',
        title: 'Legal support case opened',
        detail: 'Legal clinic referral opened with interpreter need and consent monitoring.',
        source: 'case record SV-CASE-2405',
      },
      {
        caseId: 'case-005',
        occurredAt: '2026-03-21T10:10:00',
        type: 'wiki source',
        title: 'Legal timeline reconstructed',
        detail: 'Worker created a plain-language timeline and marked interpreter confirmation as required.',
        source: 'legal timeline reconstruction',
      },
      {
        caseId: 'case-005',
        occurredAt: '2026-03-30T11:20:00',
        type: 'legal support',
        title: 'Clinic intake completed',
        detail: 'Clinic requested updated consent and appointment confirmation.',
        source: 'legal support note',
      },
      {
        caseId: 'case-005',
        occurredAt: '2026-04-13T11:05:00',
        type: 'supervisor escalation',
        title: 'Consent and no-contact escalation',
        detail: 'Street Bot and supervisor review connected stale contact to legal deadline risk.',
        source: 'escalation synthesis',
      },
    ],
    retrievalHints: [
      'Ask: Why is Samir Ahmed urgent today?',
      'Retrieve legal deadline, expired consent, interpreter plan, and last confirmed contact.',
      'Use restricted visibility notes before summarizing partner-facing content.',
    ],
    openQuestions: [
      'Has the shelter desk confirmed a contact route?',
      'Can updated consent be completed with interpreter support before the legal appointment?',
      'What is the final legal clinic deadline date and who owns it?',
    ],
  },
  {
    clientId: 'client-005',
    lead:
      'Rosa Martinez has an active ID and settlement support case plus a resolved food security bridge. The wiki demonstrates how closed support can remain useful context for active document and language-access work.',
    profileContext: [
      'Spanish-language summaries improve follow-through and reduce repeated explanations.',
      'ID replacement, settlement support, and benefits screening all rely on proof-of-address clarity.',
      'Food bank closure is stable but remains relevant because location, language, and family context inform other appointments.',
    ],
    workingSynthesis: [
      'Rosa makes progress when instructions are translated and appointment expectations are written.',
      'Proof of address is the bottleneck; once accepted, several downstream referrals can move together.',
      'Closed case knowledge should not disappear because it contains successful communication patterns.',
    ],
    sourceNotes: [
      {
        caseId: 'case-007',
        timestamp: '2026-04-06T09:45:00',
        author: 'Priya Singh',
        type: 'language access note',
        narrative:
          'Rosa asked that all appointment instructions include a Spanish-language summary and a short list of documents to bring. Worker added translation as a standing wiki preference.',
        structuredFields: ['Spanish summary required', 'Appointment checklist', 'Standing preference'],
        attachments: ['rosa-spanish-instructions-template.docx'],
        followUpRequired: true,
        visibility: 'team',
        aiSummary: 'Spanish summaries are a standing support need for Rosa appointments.',
        aiTags: ['language access', 'ID replacement', 'settlement'],
      },
      {
        caseId: 'case-008',
        timestamp: '2026-04-12T16:05:00',
        author: 'Street Bot',
        type: 'closure reuse note',
        narrative:
          'Closed food bank case contains useful navigation details: Tuesday pickup, translated directions, and household registration status. Wiki should reuse these details when planning future community referrals.',
        structuredFields: ['Closed case reusable', 'Translated directions', 'Community referral context'],
        attachments: [],
        followUpRequired: false,
        visibility: 'internal',
        aiSummary: 'Closed food security case provides reusable language and location context.',
        aiTags: ['closure', 'food security', 'knowledge reuse'],
      },
    ],
    milestones: [
      {
        caseId: 'case-007',
        occurredAt: '2026-04-04T10:00:00',
        type: 'case opened',
        title: 'ID replacement case opened',
        detail: 'Settlement and ID replacement plan opened from community meal program referral.',
        source: 'case record SV-CASE-2407',
      },
      {
        caseId: 'case-007',
        occurredAt: '2026-04-06T09:45:00',
        type: 'language access',
        title: 'Spanish appointment summary added',
        detail: 'Spanish-language appointment instructions became a standing wiki preference.',
        source: 'language access note',
      },
      {
        caseId: 'case-008',
        occurredAt: '2026-04-12T15:40:00',
        type: 'case resolved',
        title: 'Food security bridge resolved',
        detail: 'Weekly hamper pickup confirmed and translated instructions shared.',
        source: 'closure note',
      },
      {
        caseId: 'case-007',
        occurredAt: '2026-04-13T10:40:00',
        type: 'document uploaded',
        title: 'ID proof documents added',
        detail: 'Prior ID photo and address support letter attached for City ID Desk review.',
        source: 'document upload',
      },
    ],
    retrievalHints: [
      'Ask: What proof of address does Rosa Martinez need?',
      'Retrieve ID replacement, Spanish instructions, proof documents, and closed food bank context.',
      'When planning a new referral, include the translated directions preference.',
    ],
    openQuestions: [
      'Will City ID Desk accept the family letter plus meal program letter?',
      'Should settlement support proceed before ID appointment confirmation?',
      'Was the first food bank pickup completed without additional language support?',
    ],
  },
  {
    clientId: 'client-006',
    lead:
      'Jordan Lee is a high-risk outreach client whose counseling referral is affected by missed appointment history, phone battery instability, pending consent, and timing preferences.',
    profileContext: [
      'Short meetings and written recaps reduce friction.',
      'Text reminders should include practical details such as charging station options and appointment time.',
      'Mental health navigation is connected to outreach stability; missed intake should trigger reschedule design, not case closure.',
    ],
    workingSynthesis: [
      'The main barrier is not willingness; it is appointment fit and communication reliability.',
      'Afternoon slots and low-battery reminder language are critical to the next handoff.',
      'Restricted notes should stay visible to workers but not over-shared with external partners.',
    ],
    sourceNotes: [
      {
        caseId: 'case-009',
        timestamp: '2026-04-05T18:20:00',
        author: 'Omar Williams',
        type: 'reminder design note',
        narrative:
          'Jordan explained that morning appointments are hard to keep and phone battery is often below 10 percent by late afternoon. Worker drafted reminder language with charging station information.',
        structuredFields: ['Afternoon appointments only', 'Phone battery barrier', 'Reminder language drafted'],
        attachments: ['jordan-sms-reminder-template.txt'],
        followUpRequired: true,
        visibility: 'restricted',
        aiSummary: 'Reminder plan should include appointment time, charging station, and short written recap.',
        aiTags: ['mental health', 'reminder design', 'phone instability'],
      },
      {
        caseId: 'case-009',
        timestamp: '2026-04-14T08:55:00',
        author: 'Street Bot',
        type: 'risk synthesis',
        narrative:
          'Pattern synthesis connected missed counseling intake, pending consent, and high-risk outreach notes. Suggested same-day partner callback and SMS plan before another appointment is booked.',
        structuredFields: ['Missed intake', 'Pending consent', 'Same-day callback'],
        attachments: [],
        followUpRequired: true,
        visibility: 'restricted',
        aiSummary: 'Do not rebook counseling without a reminder and consent plan.',
        aiTags: ['automation', 'risk', 'counseling'],
      },
    ],
    milestones: [
      {
        caseId: 'case-009',
        occurredAt: '2026-04-01T10:00:00',
        type: 'case opened',
        title: 'Counseling warm handoff case opened',
        detail: 'Harm reduction route opened a mental health navigation case with warm handoff goals.',
        source: 'case record SV-CASE-2409',
      },
      {
        caseId: 'case-009',
        occurredAt: '2026-04-05T18:20:00',
        type: 'wiki note',
        title: 'Low-battery reminder plan drafted',
        detail: 'Worker documented phone battery barrier and afternoon appointment preference.',
        source: 'reminder design note',
      },
      {
        caseId: 'case-009',
        occurredAt: '2026-04-13T16:00:00',
        type: 'missed appointment',
        title: 'Counseling intake missed',
        detail: 'Partner requested reschedule with a clearer afternoon reminder plan.',
        source: 'timeline record',
      },
      {
        caseId: 'case-009',
        occurredAt: '2026-04-14T08:55:00',
        type: 'risk synthesis',
        title: 'Same-day reschedule plan recommended',
        detail: 'Street Bot recommended partner callback before any new counseling appointment is booked.',
        source: 'risk synthesis',
      },
    ],
    retrievalHints: [
      'Ask: What failed in Jordan Lee counseling referral?',
      'Retrieve missed intake, reminder template, consent status, and phone barrier notes.',
      'Use restricted notes for internal planning and summarize carefully for partner communication.',
    ],
    openQuestions: [
      'Which partner afternoon slot is available?',
      'Has consent been completed enough for a warm handoff?',
      'What charging station or contact backup should be included in reminders?',
    ],
  },
  {
    clientId: 'client-007',
    lead:
      'Keisha Thompson is waiting on medical verification for disability support. The wiki record highlights accessibility planning, clinic turnaround, and the need to keep mobility context attached to benefits paperwork.',
    profileContext: [
      'Phone before noon is preferred.',
      'Accessible route planning and seated waiting areas should be treated as appointment requirements.',
      'Medical verification and disability support are one workflow; document status should stay linked to travel planning.',
    ],
    workingSynthesis: [
      'The case is stable if the clinic returns verification on time and the route is accessible.',
      'A benefits package can be prepared in parallel while the medical form is pending.',
      'The wiki should preserve practical access details because they determine whether appointments are realistic.',
    ],
    sourceNotes: [
      {
        caseId: 'case-010',
        timestamp: '2026-04-03T12:15:00',
        author: 'Nia Patel',
        type: 'access planning note',
        narrative:
          'Keisha described pain after long standing waits and asked for routes with seated transfer points. Worker linked accessibility planning to clinic and benefits appointments.',
        structuredFields: ['Seated waiting area needed', 'Accessible route planning', 'Benefits package parallel prep'],
        attachments: ['keisha-access-route-notes.pdf'],
        followUpRequired: true,
        visibility: 'team',
        aiSummary: 'Accessibility needs affect clinic verification and benefits submission planning.',
        aiTags: ['accessibility', 'medical verification', 'benefits'],
      },
      {
        caseId: 'case-010',
        timestamp: '2026-04-11T09:35:00',
        author: 'Street Bot',
        type: 'clinic turnaround watch',
        narrative:
          'No verification document has arrived yet. Street Bot suggested checking clinic status and preparing the benefits package shell so submission can happen quickly once the form arrives.',
        structuredFields: ['Verification pending', 'Prepare benefits shell', 'Clinic status check'],
        attachments: [],
        followUpRequired: true,
        visibility: 'internal',
        aiSummary: 'Prepare disability support package while waiting for clinic verification.',
        aiTags: ['clinic', 'benefits', 'automation'],
      },
    ],
    milestones: [
      {
        caseId: 'case-010',
        occurredAt: '2026-04-03T10:00:00',
        type: 'case opened',
        title: 'Medical verification case opened',
        detail: 'North clinic referral created medical verification workflow for disability support.',
        source: 'case record SV-CASE-2410',
      },
      {
        caseId: 'case-010',
        occurredAt: '2026-04-03T12:15:00',
        type: 'access planning',
        title: 'Accessible route requirement documented',
        detail: 'Wiki note linked mobility needs to clinic appointment planning.',
        source: 'access planning note',
      },
      {
        caseId: 'case-010',
        occurredAt: '2026-04-09T09:20:00',
        type: 'referral scheduled',
        title: 'Medical verification queued',
        detail: 'Clinic accepted verification request and scheduled signature review.',
        source: 'timeline record',
      },
      {
        caseId: 'case-010',
        occurredAt: '2026-04-11T09:35:00',
        type: 'automation',
        title: 'Clinic turnaround watch added',
        detail: 'Street Bot recommended preparing benefits package shell while waiting on verification.',
        source: 'clinic turnaround watch',
      },
    ],
    retrievalHints: [
      'Ask: What accessibility support does Keisha need for appointments?',
      'Retrieve clinic verification, route planning, disability support, and seated waiting notes.',
      'Return practical appointment constraints alongside medical document status.',
    ],
    openQuestions: [
      'Can the clinic fax verification directly to the benefits office?',
      'Which route has the least standing time?',
      'Is a support person needed for the clinic appointment?',
    ],
  },
  {
    clientId: 'client-008',
    lead:
      'Tariq Johnson is a youth employment and school re-entry client. The wiki tracks readiness, evening availability, transit support, and school credit mapping over time.',
    profileContext: [
      'Evening appointments are preferred because of family responsibilities.',
      'Youth employment orientation should be paired with school credit mapping instead of treated as separate goals.',
      'Transit pass support is a practical requirement for reliable attendance.',
    ],
    workingSynthesis: [
      'Tariq is engaged and future oriented; the case should protect momentum by bundling orientation and school contact.',
      'The wiki should show youth program identity, employment goals, and school re-entry next steps together.',
      'Low risk does not mean low value; this is a prevention and stabilization workflow.',
    ],
    sourceNotes: [
      {
        caseId: 'case-011',
        timestamp: '2026-04-13T18:05:00',
        author: 'Leah Fraser',
        type: 'youth goal mapping',
        narrative:
          'Tariq identified evening work, school credit recovery, and media room participation as connected goals. Worker captured a combined youth plan instead of separate program notes.',
        structuredFields: ['Evening work goal', 'Credit recovery', 'Media room participation'],
        attachments: ['tariq-youth-goals.docx'],
        followUpRequired: true,
        visibility: 'team',
        aiSummary: 'Tariq needs a bundled employment and school re-entry plan.',
        aiTags: ['youth', 'employment', 'school re-entry'],
      },
      {
        caseId: 'case-011',
        timestamp: '2026-04-15T16:30:00',
        author: 'Street Bot',
        type: 'opportunity match',
        narrative:
          'Street Bot matched Tariq with evening-friendly youth employment orientation and suggested adding transit pass support before the appointment is confirmed.',
        structuredFields: ['Evening orientation match', 'Transit support needed', 'Opportunity match'],
        attachments: [],
        followUpRequired: true,
        visibility: 'internal',
        aiSummary: 'Book evening orientation only after transit support is confirmed.',
        aiTags: ['automation', 'orientation', 'transit'],
      },
    ],
    milestones: [
      {
        caseId: 'case-011',
        occurredAt: '2026-04-13T17:55:00',
        type: 'intake started',
        title: 'Youth employment intake opened',
        detail: 'Readiness checklist completed and orientation slot identified.',
        source: 'timeline record',
      },
      {
        caseId: 'case-011',
        occurredAt: '2026-04-13T18:05:00',
        type: 'goal mapping',
        title: 'School and work goals linked',
        detail: 'Wiki note connected employment orientation, school credit recovery, and media room participation.',
        source: 'youth goal mapping',
      },
      {
        caseId: 'case-011',
        occurredAt: '2026-04-15T16:30:00',
        type: 'opportunity match',
        title: 'Evening-friendly orientation matched',
        detail: 'Street Bot suggested confirming transit support before booking orientation.',
        source: 'opportunity match',
      },
      {
        caseId: 'case-011',
        occurredAt: '2026-04-21T16:00:00',
        type: 'planned follow-up',
        title: 'Youth orientation follow-up due',
        detail: 'Case task is due to book orientation and confirm school contact.',
        source: 'task record',
      },
    ],
    retrievalHints: [
      'Ask: How do Tariq Johnson employment and school goals connect?',
      'Retrieve youth readiness, orientation, school credit, media room, and transit notes.',
      'Show prevention-oriented context even though risk level is low.',
    ],
    openQuestions: [
      'Which school contact can confirm credit recovery options?',
      'Is transit pass support approved before orientation?',
      'Should media room participation be part of the employment readiness plan?',
    ],
  },
  {
    clientId: 'client-009',
    lead:
      'Marion Green is a closed housing stabilization client. The wiki demonstrates aftercare memory: stable placement, active income support, large-print documents, and optional 30-day follow-up remain available after closure.',
    profileContext: [
      'Large-print documents should remain a standing accessibility preference.',
      'Closure does not erase knowledge; aftercare context helps prevent re-intake from starting from zero.',
      'Phone contact is preferred for the optional 30-day check-in.',
    ],
    workingSynthesis: [
      'The closure is strong because housing, benefits, and aftercare resources were all confirmed.',
      'The wiki should make clear what changed from active crisis work to aftercare monitoring.',
      'Future reactivation should begin from the closure summary and accessibility preferences.',
    ],
    sourceNotes: [
      {
        caseId: 'case-012',
        timestamp: '2026-03-18T13:25:00',
        author: 'Priya Singh',
        type: 'housing stabilization checkpoint',
        narrative:
          'Marion confirmed the unit felt safe and asked that future paperwork be printed large enough to read without strain. Worker marked large-print documents as a permanent profile preference.',
        structuredFields: ['Placement feels safe', 'Large-print preference', 'Aftercare context'],
        attachments: ['marion-housing-checkpoint.pdf'],
        followUpRequired: false,
        visibility: 'team',
        aiSummary: 'Housing stabilization is strong; keep large-print preference in aftercare.',
        aiTags: ['housing', 'accessibility', 'aftercare'],
      },
      {
        caseId: 'case-012',
        timestamp: '2026-04-10T16:25:00',
        author: 'Street Bot',
        type: 'closure synthesis',
        narrative:
          'Street Bot summarized closure evidence: stable placement, income support active, benefits confirmation documented, and no immediate case management need. Suggested optional 30-day check-in.',
        structuredFields: ['Stable placement', 'Benefits active', 'Optional aftercare'],
        attachments: [],
        followUpRequired: false,
        visibility: 'internal',
        aiSummary: 'Marion case is closed with aftercare memory preserved.',
        aiTags: ['closure', 'aftercare', 'stabilized'],
      },
    ],
    milestones: [
      {
        caseId: 'case-012',
        occurredAt: '2026-02-18T10:00:00',
        type: 'case opened',
        title: 'Housing placement case opened',
        detail: 'Housing office referral opened with placement confirmation and benefits verification goals.',
        source: 'case record SV-CASE-2412',
      },
      {
        caseId: 'case-012',
        occurredAt: '2026-03-18T13:25:00',
        type: 'stabilization checkpoint',
        title: 'Safe placement confirmed',
        detail: 'Marion confirmed placement felt safe and large-print documents were needed.',
        source: 'housing stabilization checkpoint',
      },
      {
        caseId: 'case-012',
        occurredAt: '2026-04-10T16:15:00',
        type: 'case closed',
        title: 'Housing case closed',
        detail: 'Stable placement, benefits activation, and aftercare resources were confirmed.',
        source: 'timeline record',
      },
      {
        caseId: 'case-012',
        occurredAt: '2026-05-12T10:00:00',
        type: 'planned aftercare',
        title: 'Optional aftercare call scheduled',
        detail: 'Closure plan keeps a 30-day aftercare call visible without reopening the case.',
        source: 'case follow-up date',
      },
    ],
    retrievalHints: [
      'Ask: Why was Marion Green case closed?',
      'Retrieve closure summary, housing confirmation, benefits activation, and large-print preference.',
      'Use aftercare memory before opening any new case.',
    ],
    openQuestions: [
      'Did Marion complete the optional 30-day aftercare call?',
      'Are large-print forms available for future benefits updates?',
      'Should closure evidence be included in monthly outcomes reporting?',
    ],
  },
  {
    clientId: 'client-010',
    lead:
      'Eli Novak is rebuilding a benefits appeal from partial documents. The wiki follows document recovery, plain-language timeline creation, ID copy retrieval, and food support context.',
    profileContext: [
      'Email first works best; phone should be reserved for appointments.',
      'Plain-language written steps are necessary because appeal language is complex.',
      'ID copy recovery, benefits appeal, and food support are connected stabilization tasks.',
    ],
    workingSynthesis: [
      'Eli has enough partial paperwork to begin a timeline but not enough to submit confidently.',
      'The next useful wiki output is a chronological appeal map with missing dates highlighted.',
      'Food support should stay linked because benefits interruption affects immediate stability.',
    ],
    sourceNotes: [
      {
        caseId: 'case-013',
        timestamp: '2026-04-07T14:10:00',
        author: 'Leah Fraser',
        type: 'appeal intake baseline',
        narrative:
          'Eli arrived with partial appeal paperwork and described several missing dates. Worker created a wiki baseline so recovered documents, appeal events, and benefits navigator questions can be added over time.',
        structuredFields: ['Partial paperwork', 'Missing dates', 'Appeal baseline'],
        attachments: ['eli-appeal-baseline.pdf'],
        followUpRequired: true,
        visibility: 'team',
        aiSummary: 'Appeal timeline should start now and mark missing dates clearly.',
        aiTags: ['benefits appeal', 'document recovery', 'baseline'],
      },
      {
        caseId: 'case-013',
        timestamp: '2026-04-14T13:20:00',
        author: 'Street Bot',
        type: 'retrieval prep',
        narrative:
          'Street Bot identified likely retrieval targets for AI search: appeal letter scan, ID copy request, benefits navigator appointment, and plain-language timeline task.',
        structuredFields: ['Retrieval targets', 'Timeline task', 'Navigator appointment'],
        attachments: [],
        followUpRequired: true,
        visibility: 'internal',
        aiSummary: 'Use appeal letter, ID recovery, and navigator appointment as retrieval anchors.',
        aiTags: ['retrieval', 'appeal', 'documents'],
      },
    ],
    milestones: [
      {
        caseId: 'case-013',
        occurredAt: '2026-04-07T10:00:00',
        type: 'case opened',
        title: 'Benefits appeal case opened',
        detail: 'Library outreach desk opened benefits appeal document recovery case.',
        source: 'case record SV-CASE-2413',
      },
      {
        caseId: 'case-013',
        occurredAt: '2026-04-07T14:10:00',
        type: 'wiki baseline',
        title: 'Appeal baseline created',
        detail: 'Worker captured missing dates and partial paperwork as a starting wiki timeline.',
        source: 'appeal intake baseline',
      },
      {
        caseId: 'case-013',
        occurredAt: '2026-04-12T12:30:00',
        type: 'document uploaded',
        title: 'Benefits appeal letter added',
        detail: 'Appeal letter scan uploaded and flagged for plain-language timeline work.',
        source: 'timeline record',
      },
      {
        caseId: 'case-013',
        occurredAt: '2026-04-14T13:20:00',
        type: 'retrieval prep',
        title: 'AI retrieval anchors identified',
        detail: 'Street Bot listed appeal letter, ID copy, navigator appointment, and timeline task as retrieval anchors.',
        source: 'retrieval prep',
      },
    ],
    retrievalHints: [
      'Ask: What is missing from Eli Novak benefits appeal?',
      'Retrieve appeal letter scan, ID copy request, navigator appointment, and missing-date notes.',
      'Return a chronological appeal map with missing facts marked instead of hidden.',
    ],
    openQuestions: [
      'Which appeal dates are confirmed by documents versus memory?',
      'Has the ID copy request been accepted?',
      'What questions should Eli bring to the benefits navigator appointment?',
    ],
  },
];

const clientWikiSourceNotes: NoteRecord[] = clientWikiProfiles.flatMap((profile) =>
  profile.sourceNotes.map((note, index) => ({
    id: `wiki-note-${profile.clientId}-${index + 1}`,
    timestamp: note.timestamp,
    author: note.author,
    clientId: profile.clientId,
    caseId: note.caseId,
    type: note.type,
    narrative: note.narrative,
    structuredFields: note.structuredFields,
    attachments: note.attachments,
    followUpRequired: note.followUpRequired,
    visibility: note.visibility,
    aiSummary: note.aiSummary,
    aiTags: note.aiTags,
  })),
);

const clientWikiTimelineEvents: TimelineEvent[] = clientWikiProfiles.flatMap((profile) =>
  profile.milestones.map((milestone, index) => ({
    id: `wiki-tl-${profile.clientId}-${index + 1}`,
    clientId: profile.clientId,
    caseId: milestone.caseId,
    occurredAt: milestone.occurredAt,
    type: milestone.type,
    title: milestone.title,
    detail: milestone.detail,
  })),
);

const caseManagementSeedNotes: NoteRecord[] = [...initialNotes, ...clientWikiSourceNotes];
const caseManagementSeedTimelineEvents: TimelineEvent[] = [...initialTimelineEvents, ...clientWikiTimelineEvents];

const botAlerts: BotAlert[] = [
  {
    id: 'bot-001',
    clientId: 'client-001',
    caseId: 'case-001',
    title: 'Shelter referral can advance today',
    prompt: 'Summarize missing referral fields and draft the intake call note.',
    severity: 'high',
  },
  {
    id: 'bot-002',
    clientId: 'client-004',
    caseId: 'case-005',
    title: 'Legal support case needs escalation review',
    prompt: 'Prepare a 30-day timeline summary and identify missing consent requirements.',
    severity: 'urgent',
  },
  {
    id: 'bot-003',
    clientId: 'client-002',
    caseId: 'case-003',
    title: 'Reminder automation recommended',
    prompt: 'Create a task from the missed orientation note and schedule a phone reminder.',
    severity: 'medium',
  },
  {
    id: 'bot-004',
    clientId: 'client-006',
    caseId: 'case-009',
    title: 'Counseling reschedule needs same-day review',
    prompt: 'Draft a low-barrier reschedule note with afternoon availability and text reminder language.',
    severity: 'high',
  },
  {
    id: 'bot-005',
    clientId: 'client-005',
    caseId: 'case-007',
    title: 'ID desk referral can move if proof rules are confirmed',
    prompt: "Summarize Rosa's proof documents and prepare questions for the City ID Desk.",
    severity: 'medium',
  },
  {
    id: 'bot-006',
    clientId: 'client-007',
    caseId: 'case-010',
    title: 'Medical verification approaching benefits window',
    prompt: 'Create a clinic follow-up script and identify accessibility travel steps.',
    severity: 'medium',
  },
  {
    id: 'bot-007',
    clientId: 'client-010',
    caseId: 'case-013',
    title: 'Benefits appeal document set needs timeline',
    prompt: 'Turn uploaded appeal notes into a plain-language timeline for the navigator appointment.',
    severity: 'medium',
  },
  {
    id: 'bot-008',
    clientId: 'client-004',
    caseId: 'case-005',
    title: 'Legal consent expiry intersects urgent deadline',
    prompt: 'List missing consent steps and draft an escalation note for supervisor review.',
    severity: 'urgent',
  },
];

const initialCaseTypes: CaseType[] = [
  {
    id: 'housing',
    name: 'Housing',
    workflow: ['Intake', 'Eligibility check', 'Referral packet', 'Placement follow-up', 'Closure summary'],
    successCriteria: 'Safe placement confirmed and follow-up plan documented.',
  },
  {
    id: 'benefits',
    name: 'Benefits / Income Support',
    workflow: ['Screening', 'Document collection', 'Application review', 'Submission', 'Outcome tracking'],
    successCriteria: 'Application submitted and confirmation number recorded.',
  },
  {
    id: 'legal',
    name: 'Legal Support',
    workflow: ['Consent check', 'Clinic referral', 'Interpreter booking', 'Deadline review', 'Outcome note'],
    successCriteria: 'Clinic appointment attended and next legal step documented.',
  },
  {
    id: 'medical-coordination',
    name: 'Medical Coordination',
    workflow: ['Health consent', 'Referral request', 'Appointment prep', 'Provider confirmation', 'Benefits linkage'],
    successCriteria: 'Medical form or provider handoff completed and benefits impact documented.',
  },
  {
    id: 'id-replacement',
    name: 'ID Replacement',
    workflow: ['Proof review', 'Partner confirmation', 'Appointment booking', 'Replacement submission', 'Pickup follow-up'],
    successCriteria: 'Replacement ID application submitted or pickup date confirmed.',
  },
  {
    id: 'mental-health-navigation',
    name: 'Mental Health Navigation',
    workflow: ['Warm handoff', 'Consent review', 'Appointment fit check', 'Reminder plan', 'Post-intake follow-up'],
    successCriteria: 'Client attends intake or an alternative low-barrier support plan is documented.',
  },
  {
    id: 'community-resources',
    name: 'Community Resources',
    workflow: ['Need confirmed', 'Eligibility match', 'Referral or registration', 'First service check', 'Closure note'],
    successCriteria: 'Client has a confirmed community resource and practical access instructions.',
  },
];

const initialOrganizations: OrganizationRecord[] = [
  {
    id: 'org-harbour-shelter',
    name: 'Harbour Shelter Intake',
    serviceCategories: ['Shelter placement', 'Housing'],
    contactPerson: 'Intake coordinator',
    contact: 'intake@example.org',
    phone: '555-0198',
    address: 'Harbour Shelter, intake desk',
    eligibility: 'Emergency housing referral with consent and ID alternative.',
    notes: 'Accepts ID alternatives when a worker attests to identity.',
    preferred: true,
    active: true,
    averageTurnaroundDays: 2,
  },
  {
    id: 'org-bridge-works',
    name: 'Bridge Works Employment',
    serviceCategories: ['Employment', 'Training'],
    contactPerson: 'M. Rivera',
    contact: 'programs@example.org',
    phone: '555-0173',
    address: 'Bridge Works employment hub',
    eligibility: 'Open to clients ready for orientation and resume support.',
    notes: 'Morning reminder improves orientation attendance.',
    preferred: true,
    active: true,
    averageTurnaroundDays: 5,
  },
  {
    id: 'org-downtown-legal',
    name: 'Downtown Legal Clinic',
    serviceCategories: ['Legal support', 'Consent review'],
    contactPerson: 'Clinic coordinator',
    contact: 'legal@example.org',
    phone: '555-0124',
    address: 'Downtown Legal Clinic',
    eligibility: 'Deadline-sensitive cases and consent-supported referrals.',
    notes: 'Book interpreter before appointment when needed.',
    preferred: false,
    active: true,
    averageTurnaroundDays: 7,
  },
  {
    id: 'org-mobile-health',
    name: 'Mobile Health Outreach',
    serviceCategories: ['Medical coordination', 'Medical verification', 'Benefits'],
    contactPerson: 'Clinic navigator',
    contact: 'health@example.org',
    phone: '555-0188',
    address: 'Rotating clinic rooms and outreach van',
    eligibility: 'Clients needing low-barrier medical forms, clinic coordination, or health verification.',
    notes: 'Send consent language and mobility needs in the first referral.',
    preferred: true,
    active: true,
    averageTurnaroundDays: 4,
  },
  {
    id: 'org-city-id-desk',
    name: 'City ID Desk',
    serviceCategories: ['ID replacement', 'Document recovery'],
    contactPerson: 'ID intake worker',
    contact: 'id-desk@example.org',
    phone: '555-0148',
    address: 'City services counter, west office',
    eligibility: 'Clients replacing provincial or municipal ID with worker-supported proof documents.',
    notes: 'Proof of address rules vary; call before sending clients with alternate documentation.',
    preferred: true,
    active: true,
    averageTurnaroundDays: 6,
  },
  {
    id: 'org-safe-steps-counseling',
    name: 'Safe Steps Counseling',
    serviceCategories: ['Mental health navigation', 'Counseling'],
    contactPerson: 'Intake therapist',
    contact: 'counseling@example.org',
    phone: '555-0109',
    address: 'Safe Steps counseling office',
    eligibility: 'Clients who consent to a warm handoff and can identify a preferred appointment window.',
    notes: 'Afternoon slots book faster when reminder preferences are included.',
    preferred: false,
    active: true,
    averageTurnaroundDays: 8,
  },
  {
    id: 'org-community-food-bank',
    name: 'Community Food Bank',
    serviceCategories: ['Food security', 'Community resources'],
    contactPerson: 'Food bank coordinator',
    contact: 'foodbank@example.org',
    phone: '555-0133',
    address: 'Community Food Bank east entrance',
    eligibility: 'Households needing weekly hamper pickup or emergency food access.',
    notes: 'Translated pickup instructions can be requested with one business day notice.',
    preferred: false,
    active: true,
    averageTurnaroundDays: 1,
  },
  {
    id: 'org-youth-futures',
    name: 'Youth Futures Studio',
    serviceCategories: ['Youth employment', 'School re-entry', 'Training'],
    contactPerson: 'Youth coordinator',
    contact: 'youth@example.org',
    phone: '555-0169',
    address: 'Youth Futures Studio media room',
    eligibility: 'Youth and young adults seeking job readiness, school credit mapping, or creative training.',
    notes: 'Evening sessions are available twice per week.',
    preferred: true,
    active: true,
    averageTurnaroundDays: 3,
  },
  {
    id: 'org-benefits-navigator',
    name: 'Benefits Navigator Desk',
    serviceCategories: ['Benefits appeal', 'Income support', 'Document recovery'],
    contactPerson: 'Appeals navigator',
    contact: 'benefits@example.org',
    phone: '555-0129',
    address: 'Central library outreach desk',
    eligibility: 'Clients with interrupted benefits, appeal timelines, or missing income support documents.',
    notes: 'Bring a timeline and any letters, even if the set is incomplete.',
    preferred: true,
    active: true,
    averageTurnaroundDays: 5,
  },
  {
    id: 'org-tenant-rights',
    name: 'Tenant Rights Hub',
    serviceCategories: ['Housing aftercare', 'Tenant rights'],
    contactPerson: 'Aftercare desk',
    contact: 'tenant-rights@example.org',
    phone: '555-0119',
    address: 'Tenant Rights Hub',
    eligibility: 'Clients stabilizing housing who need aftercare planning, tenant rights basics, or closure resources.',
    notes: 'Useful for closing housing cases without leaving clients unsupported.',
    preferred: false,
    active: true,
    averageTurnaroundDays: 4,
  },
];

const initialAuditEvents: AuditEvent[] = [
  {
    id: 'audit-001',
    actor: 'Nia Patel',
    action: 'viewed client profile',
    object: 'SV-C-1001',
    timestamp: '2026-04-14T09:28:00',
  },
  {
    id: 'audit-002',
    actor: 'Street Bot',
    action: 'generated case summary suggestion',
    object: 'SV-CASE-2405',
    timestamp: '2026-04-14T08:00:00',
  },
  {
    id: 'audit-003',
    actor: 'Priya Singh',
    action: 'updated case ownership',
    object: 'SV-CASE-2405',
    timestamp: '2026-04-11T15:20:00',
  },
  {
    id: 'audit-004',
    actor: 'Omar Williams',
    action: 'updated referral follow-up',
    object: 'SV-CASE-2409',
    timestamp: '2026-04-14T08:45:00',
  },
  {
    id: 'audit-005',
    actor: 'Leah Fraser',
    action: 'created youth intake case',
    object: 'SV-CASE-2411',
    timestamp: '2026-04-13T17:52:00',
  },
  {
    id: 'audit-006',
    actor: 'Priya Singh',
    action: 'closed case after placement review',
    object: 'SV-CASE-2412',
    timestamp: '2026-04-10T16:15:00',
  },
  {
    id: 'audit-007',
    actor: 'Nia Patel',
    action: 'requested medical verification',
    object: 'SV-CASE-2410',
    timestamp: '2026-04-09T09:20:00',
  },
  {
    id: 'audit-008',
    actor: 'Street Bot',
    action: 'flagged missed appointment pattern',
    object: 'SV-CASE-2409',
    timestamp: '2026-04-14T08:40:00',
  },
  {
    id: 'audit-009',
    actor: 'Leah Fraser',
    action: 'uploaded appeal letter',
    object: 'SV-CASE-2413',
    timestamp: '2026-04-12T12:30:00',
  },
  {
    id: 'audit-010',
    actor: 'Priya Singh',
    action: 'updated partner resource directory',
    object: 'City ID Desk',
    timestamp: '2026-04-13T10:50:00',
  },
];

const weeklyActivity = [
  { label: 'Mon', notes: 18, tasks: 14 },
  { label: 'Tue', notes: 22, tasks: 17 },
  { label: 'Wed', notes: 15, tasks: 19 },
  { label: 'Thu', notes: 26, tasks: 16 },
  { label: 'Fri', notes: 20, tasks: 21 },
];

const roles = [
  { role: 'Admin', permission: 'Manage users, workflows, case types, audit settings' },
  { role: 'Program Manager', permission: 'View all cases, assign staff, run reports, manage escalations' },
  { role: 'Case Manager', permission: 'Full access to assigned clients and cases' },
  { role: 'Outreach Worker', permission: 'Create clients, notes, quick tasks, and field updates' },
  { role: 'Volunteer', permission: 'Limited profile visibility and non-sensitive notes' },
  { role: 'Read-only Analyst', permission: 'Reporting access with unnecessary private detail minimized' },
];

const emptyClientIntake: ClientIntakeDraft = {
  fullName: '',
  preferredName: '',
  dob: '',
  phone: '',
  email: '',
  location: '',
  assignedWorker: 'Nia Patel',
  assignedTeam: 'Outreach East',
  language: 'English',
  communicationPreference: 'Text first, phone if urgent',
  consentStatus: 'pending',
  riskLevel: 'medium',
  riskFlags: '',
  pronouns: '',
  emergencyContact: '',
  demographicDetails: '',
  accessibilityNeeds: '',
  transportationNeeds: '',
  housingStatus: 'Needs assessment',
  incomeStatus: 'Needs assessment',
  benefitsStatus: 'Needs review',
  serviceHistory: 'Intake started in Case Management.',
};

const emptyCaseQuickDraft: CaseQuickDraft = {
  title: '',
  type: 'housing',
  priority: 'medium',
  targetResolutionDate: '',
  summary: '',
  nextAction: '',
};

const emptyReferralQuickDraft: ReferralQuickDraft = {
  organization: '',
  serviceCategory: 'Housing',
  contactPerson: '',
  contact: '',
  appointmentDate: '',
  supportingDocuments: '',
};

const emptyAppointmentQuickDraft: AppointmentQuickDraft = {
  dateTime: '',
  location: '',
  serviceProvider: '',
  purpose: '',
  prepChecklist: '',
};

const emptyCaseTypeDraft: CaseTypeDraft = {
  name: '',
  workflow: '',
  successCriteria: '',
};

const emptyOrganizationDraft: OrganizationDraft = {
  name: '',
  serviceCategories: '',
  contactPerson: '',
  contact: '',
  phone: '',
  address: '',
  eligibility: '',
  notes: '',
  averageTurnaroundDays: '3',
};

function formatDateTime(value: string): string {
  return toDate(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(value: string): string {
  return toDate(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(value: string): boolean {
  const timestamp = toDate(value).getTime();
  return Number.isFinite(timestamp) && timestamp < Date.now();
}

function toDate(value: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
}

function getLocalDateKey(value: string | Date = new Date()): string {
  const date = typeof value === 'string' ? toDate(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function getDaysSince(value: string): number {
  const timestamp = toDate(value).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
}

function getDaysUntil(value: string): number {
  const timestamp = toDate(value).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.ceil((timestamp - Date.now()) / (24 * 60 * 60 * 1000));
}

function getPriorityMeta(priority: Priority): { color: string; background: string; label: string } {
  switch (priority) {
    case 'urgent':
      return { color: '#fee2e2', background: 'rgba(239, 68, 68, 0.36)', label: 'Urgent' };
    case 'high':
      return { color: '#fed7aa', background: 'rgba(249, 115, 22, 0.24)', label: 'High' };
    case 'medium':
      return { color: '#fef3c7', background: 'rgba(234, 179, 8, 0.22)', label: 'Medium' };
    default:
      return { color: '#d1fae5', background: 'rgba(34, 197, 94, 0.20)', label: 'Low' };
  }
}

function getRiskMeta(risk: RiskLevel): { color: string; background: string; label: string } {
  switch (risk) {
    case 'urgent':
      return { color: '#fee2e2', background: 'rgba(220, 38, 38, 0.42)', label: 'Urgent' };
    case 'high':
      return { color: '#fed7aa', background: 'rgba(249, 115, 22, 0.28)', label: 'High risk' };
    case 'medium':
      return { color: '#fef3c7', background: 'rgba(234, 179, 8, 0.22)', label: 'Medium risk' };
    default:
      return { color: '#d1fae5', background: 'rgba(34, 197, 94, 0.20)', label: 'Low risk' };
  }
}

function getStatusMeta(status: CaseStatus | TaskRecord['status'] | ReferralStatus) {
  const map: Record<string, { color: string; background: string }> = {
    intake: { color: '#e0f2fe', background: 'rgba(14, 165, 233, 0.22)' },
    active: { color: '#d1fae5', background: 'rgba(34, 197, 94, 0.20)' },
    'pending documents': { color: '#fef3c7', background: 'rgba(234, 179, 8, 0.22)' },
    'awaiting partner response': { color: '#dbeafe', background: 'rgba(59, 130, 246, 0.22)' },
    'follow-up needed': { color: '#fed7aa', background: 'rgba(249, 115, 22, 0.24)' },
    'on hold': { color: '#e5e7eb', background: 'rgba(148, 163, 184, 0.22)' },
    resolved: { color: '#d1fae5', background: 'rgba(34, 197, 94, 0.22)' },
    closed: { color: '#e5e7eb', background: 'rgba(107, 114, 128, 0.22)' },
    archived: { color: '#e5e7eb', background: 'rgba(107, 114, 128, 0.22)' },
    open: { color: '#dbeafe', background: 'rgba(59, 130, 246, 0.22)' },
    'in progress': { color: '#fef3c7', background: 'rgba(234, 179, 8, 0.22)' },
    blocked: { color: '#fee2e2', background: 'rgba(239, 68, 68, 0.28)' },
    complete: { color: '#d1fae5', background: 'rgba(34, 197, 94, 0.22)' },
    draft: { color: '#e5e7eb', background: 'rgba(107, 114, 128, 0.22)' },
    sent: { color: '#dbeafe', background: 'rgba(59, 130, 246, 0.22)' },
    acknowledged: { color: '#fef3c7', background: 'rgba(234, 179, 8, 0.22)' },
    scheduled: { color: '#e0f2fe', background: 'rgba(14, 165, 233, 0.22)' },
    completed: { color: '#d1fae5', background: 'rgba(34, 197, 94, 0.22)' },
    declined: { color: '#fee2e2', background: 'rgba(239, 68, 68, 0.28)' },
    'no response': { color: '#fed7aa', background: 'rgba(249, 115, 22, 0.24)' },
  };
  return map[status] ?? { color: '#e5e7eb', background: 'rgba(107, 114, 128, 0.22)' };
}

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function makeAlias(fullName: string): string {
  const letters = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return letters || 'SV';
}

function getAgeFromDob(dob: string): number {
  if (!dob) return 0;
  const birthday = new Date(dob);
  if (Number.isNaN(birthday.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const monthDelta = today.getMonth() - birthday.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthday.getDate())) age -= 1;
  return Math.max(age, 0);
}

function nextClientCode(records: ClientRecord[]): string {
  return `SV-C-${1001 + records.length}`;
}

function nextCaseCode(records: CaseRecord[]): string {
  return `SV-CASE-${2401 + records.length}`;
}

function StatusBadge({ label }: { label: CaseStatus | TaskRecord['status'] | ReferralStatus }) {
  const meta = getStatusMeta(label);
  return (
    <span
      style={{
        color: meta.color,
        background: meta.background,
        borderRadius: 8,
        padding: '5px 8px',
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = getPriorityMeta(priority);
  return (
    <span
      style={{
        color: meta.color,
        background: meta.background,
        borderRadius: 8,
        padding: '5px 8px',
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {meta.label}
    </span>
  );
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const meta = getRiskMeta(risk);
  return (
    <span
      style={{
        color: meta.color,
        background: meta.background,
        borderRadius: 8,
        padding: '5px 8px',
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {meta.label}
    </span>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: React.ReactNode;
}) {
  const { colors } = useGlassStyles();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <Icon size={18} color={colors.accent} />
        <h2 style={{ margin: 0, color: colors.text, fontSize: 18, fontWeight: 750 }}>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  const { colors } = useGlassStyles();
  return <p style={{ margin: 0, color: colors.textMuted, fontSize: 13 }}>{text}</p>;
}

const CASE_MANAGEMENT_STORAGE_KEY = 'streetvoices:case-management:v1';
const CASE_MANAGEMENT_API_PATH = '/api/case-management/workspace';
const CASE_MANAGEMENT_WIKI_INGEST_PATH = '/api/case-management/wiki/ingest';
const CASE_MANAGEMENT_WIKI_INGESTIONS_PATH = '/api/case-management/wiki/ingestions';

interface CaseManagementDraft {
  version: 1;
  savedAt: string;
  clientRecords: ClientRecord[];
  caseRecords: CaseRecord[];
  taskRecords: TaskRecord[];
  noteRecords: NoteRecord[];
  referralRecords: ReferralRecord[];
  appointmentRecords: AppointmentRecord[];
  documentRecords: DocumentRecord[];
  timelineRecords: TimelineEvent[];
  wikiIngestionRecords: WikiIngestionRecord[];
  auditRecords: AuditEvent[];
  caseTypeRecords: CaseType[];
  organizationRecords: OrganizationRecord[];
  activeTab?: TabId;
  selectedClientId?: string;
  selectedCaseId?: string;
  caseView?: CaseView;
  taskView?: TaskView;
  riskFilter?: 'all' | RiskLevel;
  workerFilter?: string;
  caseStatusFilter?: 'all' | CaseStatus;
  caseTypeFilter?: string;
  priorityFilter?: 'all' | Priority;
  consentFilter?: 'all' | ClientRecord['consentStatus'];
  activityFilter?: ActivityFilter;
  savedViewId?: SavedViewId;
  reportStartDate?: string;
  reportEndDate?: string;
  dismissedNotificationIds?: string[];
}

function mergeSeedRecords<T extends { id: string }>(records: T[], seedRecords: T[]) {
  const seen = new Set(records.map((record) => record.id));
  return [...records, ...seedRecords.filter((record) => !seen.has(record.id))];
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]) {
  const merged = new Map(existing.map((record) => [record.id, record]));
  incoming.forEach((record) => merged.set(record.id, record));
  return Array.from(merged.values());
}

function parseCaseManagementDraft(value: unknown): CaseManagementDraft | null {
  if (!value || typeof value !== 'object') return null;
  const draft = value as Partial<CaseManagementDraft> & {
    referrals?: unknown;
    appointments?: unknown;
    timelineEvents?: unknown;
    auditEvents?: unknown;
    caseTypes?: unknown;
    organizations?: unknown;
  };
  if (!Array.isArray(draft.caseRecords) || !Array.isArray(draft.taskRecords) || !Array.isArray(draft.noteRecords)) {
    return null;
  }
  return {
    version: 1,
    savedAt: typeof draft.savedAt === 'string' ? draft.savedAt : new Date().toISOString(),
    clientRecords: mergeSeedRecords(Array.isArray(draft.clientRecords) ? draft.clientRecords : [], initialClients),
    caseRecords: mergeSeedRecords(draft.caseRecords, initialCases),
    taskRecords: mergeSeedRecords(draft.taskRecords, initialTasks),
    noteRecords: mergeSeedRecords(draft.noteRecords, caseManagementSeedNotes),
    referralRecords: Array.isArray(draft.referralRecords)
      ? mergeSeedRecords(draft.referralRecords, initialReferrals)
      : Array.isArray(draft.referrals)
        ? mergeSeedRecords(draft.referrals as ReferralRecord[], initialReferrals)
        : initialReferrals,
    appointmentRecords: Array.isArray(draft.appointmentRecords)
      ? mergeSeedRecords(draft.appointmentRecords, initialAppointments)
      : Array.isArray(draft.appointments)
        ? mergeSeedRecords(draft.appointments as AppointmentRecord[], initialAppointments)
        : initialAppointments,
    documentRecords: Array.isArray(draft.documentRecords)
      ? mergeSeedRecords(draft.documentRecords, initialDocuments)
      : initialDocuments,
    timelineRecords: Array.isArray(draft.timelineRecords)
      ? mergeSeedRecords(draft.timelineRecords, caseManagementSeedTimelineEvents)
      : Array.isArray(draft.timelineEvents)
        ? mergeSeedRecords(draft.timelineEvents as TimelineEvent[], caseManagementSeedTimelineEvents)
        : caseManagementSeedTimelineEvents,
    wikiIngestionRecords: Array.isArray(draft.wikiIngestionRecords)
      ? (draft.wikiIngestionRecords as WikiIngestionRecord[])
      : [],
    auditRecords: Array.isArray(draft.auditRecords)
      ? mergeSeedRecords(draft.auditRecords, initialAuditEvents)
      : Array.isArray(draft.auditEvents)
        ? mergeSeedRecords(draft.auditEvents as AuditEvent[], initialAuditEvents)
        : initialAuditEvents,
    caseTypeRecords: Array.isArray(draft.caseTypeRecords)
      ? mergeSeedRecords(draft.caseTypeRecords, initialCaseTypes)
      : Array.isArray(draft.caseTypes)
        ? mergeSeedRecords(draft.caseTypes as CaseType[], initialCaseTypes)
        : initialCaseTypes,
    organizationRecords: Array.isArray(draft.organizationRecords)
      ? mergeSeedRecords(draft.organizationRecords, initialOrganizations)
      : Array.isArray(draft.organizations)
        ? mergeSeedRecords(draft.organizations as OrganizationRecord[], initialOrganizations)
        : initialOrganizations,
    activeTab: draft.activeTab,
    selectedClientId: draft.selectedClientId,
    selectedCaseId: draft.selectedCaseId,
    caseView: draft.caseView,
    taskView: draft.taskView,
    riskFilter: draft.riskFilter ?? 'all',
    workerFilter: typeof draft.workerFilter === 'string' ? draft.workerFilter : 'all',
    caseStatusFilter: draft.caseStatusFilter ?? 'all',
    caseTypeFilter: typeof draft.caseTypeFilter === 'string' ? draft.caseTypeFilter : 'all',
    priorityFilter: draft.priorityFilter ?? 'all',
    consentFilter: draft.consentFilter ?? 'all',
    activityFilter: draft.activityFilter ?? 'all',
    savedViewId: draft.savedViewId ?? 'all',
    reportStartDate: typeof draft.reportStartDate === 'string' ? draft.reportStartDate : '',
    reportEndDate: typeof draft.reportEndDate === 'string' ? draft.reportEndDate : '',
    dismissedNotificationIds: Array.isArray(draft.dismissedNotificationIds) ? draft.dismissedNotificationIds : [],
  };
}

function readCaseManagementDraft(): CaseManagementDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CASE_MANAGEMENT_STORAGE_KEY);
    return raw ? parseCaseManagementDraft(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function downloadJson(filename: string, payload: unknown) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const href = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(href);
}

async function saveServerCaseManagementDraft(draft: CaseManagementDraft, token: string) {
  const response = await fetch(CASE_MANAGEMENT_API_PATH, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workspace: draft }),
  });
  if (!response.ok) {
    throw new Error(`Save failed with ${response.status}`);
  }
  return response.json() as Promise<{ savedAt?: string }>;
}

export default function CaseManagementPage() {
  const { token } = useAuthContext();
  const {
    colors,
    isDark,
    glassCard,
    glassSurface,
    glassInput,
    glassButton,
    accentButton,
    buttonHoverHandlers,
    accentButtonHoverHandlers,
  } = useGlassStyles();
  const savedDraft = useMemo(readCaseManagementDraft, []);
  const importInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const wikiIngestHeroInputRef = useRef<HTMLInputElement>(null);
  const wikiIngestInputRef = useRef<HTMLInputElement>(null);
  const serverSaveTimerRef = useRef<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>(() => caseManagementTabFromPath() ?? savedDraft?.activeTab ?? 'overview');
  const [selectedWikiPageId, setSelectedWikiPageId] = useState(() => {
    if (typeof window === 'undefined') return 'client:client-001';
    return new URLSearchParams(window.location.search).get('page') ?? 'client:client-001';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | RiskLevel>(savedDraft?.riskFilter ?? 'all');
  const [workerFilter, setWorkerFilter] = useState(savedDraft?.workerFilter ?? 'all');
  const [caseStatusFilter, setCaseStatusFilter] = useState<'all' | CaseStatus>(savedDraft?.caseStatusFilter ?? 'all');
  const [caseTypeFilter, setCaseTypeFilter] = useState(savedDraft?.caseTypeFilter ?? 'all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>(savedDraft?.priorityFilter ?? 'all');
  const [consentFilter, setConsentFilter] = useState<'all' | ClientRecord['consentStatus']>(savedDraft?.consentFilter ?? 'all');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>(savedDraft?.activityFilter ?? 'all');
  const [savedViewId, setSavedViewId] = useState<SavedViewId>(savedDraft?.savedViewId ?? 'all');
  const [reportStartDate, setReportStartDate] = useState(savedDraft?.reportStartDate ?? '');
  const [reportEndDate, setReportEndDate] = useState(savedDraft?.reportEndDate ?? '');
  const [caseView, setCaseView] = useState<CaseView>(savedDraft?.caseView ?? 'table');
  const [taskView, setTaskView] = useState<TaskView>(savedDraft?.taskView ?? 'my');
  const [selectedClientId, setSelectedClientId] = useState(savedDraft?.selectedClientId ?? initialClients[0].id);
  const [selectedCaseId, setSelectedCaseId] = useState(savedDraft?.selectedCaseId ?? initialCases[0].id);
  const [clientRecords, setClientRecords] = useState(savedDraft?.clientRecords ?? initialClients);
  const [caseRecords, setCaseRecords] = useState(savedDraft?.caseRecords ?? initialCases);
  const [taskRecords, setTaskRecords] = useState(savedDraft?.taskRecords ?? initialTasks);
  const [noteRecords, setNoteRecords] = useState(savedDraft?.noteRecords ?? caseManagementSeedNotes);
  const [referralRecords, setReferralRecords] = useState(savedDraft?.referralRecords ?? initialReferrals);
  const [appointmentRecords, setAppointmentRecords] = useState(savedDraft?.appointmentRecords ?? initialAppointments);
  const [documentRecords, setDocumentRecords] = useState(savedDraft?.documentRecords ?? initialDocuments);
  const [timelineRecords, setTimelineRecords] = useState(savedDraft?.timelineRecords ?? caseManagementSeedTimelineEvents);
  const [wikiIngestionRecords, setWikiIngestionRecords] = useState(savedDraft?.wikiIngestionRecords ?? []);
  const [auditRecords, setAuditRecords] = useState(savedDraft?.auditRecords ?? initialAuditEvents);
  const [caseTypeRecords, setCaseTypeRecords] = useState(savedDraft?.caseTypeRecords ?? initialCaseTypes);
  const [organizationRecords, setOrganizationRecords] = useState(savedDraft?.organizationRecords ?? initialOrganizations);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState(savedDraft?.dismissedNotificationIds ?? []);
  const [clientIntakeOpen, setClientIntakeOpen] = useState(false);
  const [clientIntake, setClientIntake] = useState<ClientIntakeDraft>(emptyClientIntake);
  const [profileAction, setProfileAction] = useState<ProfileAction>(null);
  const [caseQuickDraft, setCaseQuickDraft] = useState<CaseQuickDraft>(emptyCaseQuickDraft);
  const [referralQuickDraft, setReferralQuickDraft] = useState<ReferralQuickDraft>(emptyReferralQuickDraft);
  const [appointmentQuickDraft, setAppointmentQuickDraft] = useState<AppointmentQuickDraft>(emptyAppointmentQuickDraft);
  const [caseTypeDraft, setCaseTypeDraft] = useState<CaseTypeDraft>(emptyCaseTypeDraft);
  const [organizationDraft, setOrganizationDraft] = useState<OrganizationDraft>(emptyOrganizationDraft);
  const [quickNote, setQuickNote] = useState('');
  const [structuredNoteType, setStructuredNoteType] = useState('outreach contact');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [wikiIngestPendingFiles, setWikiIngestPendingFiles] = useState<File[]>([]);
  const [wikiIngestDragActive, setWikiIngestDragActive] = useState(false);
  const [wikiIngestText, setWikiIngestText] = useState('');
  const [wikiIngestSourceName, setWikiIngestSourceName] = useState('');
  const [wikiIngesting, setWikiIngesting] = useState(false);
  const [wikiIngestStatus, setWikiIngestStatus] = useState('');
  const [draftNotice, setDraftNotice] = useState(
    savedDraft ? `Local draft restored from ${formatDateTime(savedDraft.savedAt)}.` : 'Changes save locally in this browser.',
  );
  const [serverPersistenceReady, setServerPersistenceReady] = useState(false);

  const selectedClient = clientRecords.find((client) => client.id === selectedClientId) ?? clientRecords[0] ?? initialClients[0];
  const selectedCase =
    caseRecords.find((caseItem) => caseItem.id === selectedCaseId) ??
    caseRecords.find((caseItem) => caseItem.clientId === selectedClient.id) ??
    caseRecords[0];

  const todayKey = getLocalDateKey();
  const workerOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...clientRecords.map((client) => client.assignedWorker),
          ...caseRecords.map((caseItem) => caseItem.assignedStaff),
          ...taskRecords.map((task) => task.owner),
        ]),
      )
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [caseRecords, clientRecords, taskRecords],
  );
  const caseTypeOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...caseRecords.map((caseItem) => normalize(caseItem.type)),
          ...caseTypeRecords.map((type) => normalize(type.name)),
        ]),
      )
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [caseRecords, caseTypeRecords],
  );

  const clientSearchHaystack = (client: ClientRecord) =>
    [
      client.fullName,
      client.preferredName,
      client.alias,
      client.clientId,
      client.phone,
      client.email,
      client.assignedWorker,
      client.assignedTeam,
      client.location,
      client.housingStatus,
      client.incomeStatus,
      client.benefitsStatus,
      client.consentStatus,
      ...client.riskFlags,
      ...caseRecords
        .filter((caseItem) => caseItem.clientId === client.id)
        .flatMap((caseItem) => [caseItem.caseId, caseItem.title, caseItem.type, caseItem.status, caseItem.tags.join(' '), caseItem.nextAction]),
      ...noteRecords.filter((note) => note.clientId === client.id).map((note) => note.narrative),
      ...referralRecords.filter((referral) => referral.clientId === client.id).map((referral) => `${referral.organization} ${referral.serviceCategory} ${referral.status}`),
      ...organizationRecords
        .filter((organization) =>
          referralRecords.some((referral) => referral.clientId === client.id && referral.organization === organization.name),
        )
        .map((organization) => `${organization.name} ${organization.serviceCategories.join(' ')} ${organization.eligibility}`),
      ...documentRecords.filter((document) => document.clientId === client.id).map((document) => `${document.name} ${document.tag} ${document.searchableText}`),
    ]
      .join(' ')
      .toLowerCase();

  const caseSearchHaystack = (caseItem: CaseRecord) => {
    const client = clientRecords.find((candidate) => candidate.id === caseItem.clientId);
    return [
      caseItem.caseId,
      caseItem.title,
      caseItem.type,
      caseItem.status,
      caseItem.priority,
      caseItem.assignedStaff,
      caseItem.assignedTeam,
      caseItem.referralSource,
      caseItem.tags.join(' '),
      caseItem.summary,
      caseItem.nextAction,
      client?.fullName,
      client?.clientId,
      client?.phone,
      client?.email,
      ...(client?.riskFlags ?? []),
      ...noteRecords.filter((note) => note.caseId === caseItem.id).map((note) => note.narrative),
      ...referralRecords.filter((referral) => referral.caseId === caseItem.id).map((referral) => `${referral.organization} ${referral.serviceCategory} ${referral.status}`),
      ...organizationRecords
        .filter((organization) =>
          referralRecords.some((referral) => referral.caseId === caseItem.id && referral.organization === organization.name),
        )
        .map((organization) => `${organization.name} ${organization.serviceCategories.join(' ')} ${organization.eligibility}`),
      ...documentRecords.filter((document) => document.caseId === caseItem.id).map((document) => `${document.name} ${document.tag} ${document.searchableText}`),
    ]
      .join(' ')
      .toLowerCase();
  };

  const clientMatchesActivityFilter = (client: ClientRecord) => {
    if (activityFilter === 'all') return true;
    if (activityFilter === 'follow-up today') {
      return (
        getLocalDateKey(client.nextFollowUp) === todayKey ||
        caseRecords.some((caseItem) => caseItem.clientId === client.id && getLocalDateKey(caseItem.nextFollowUp) === todayKey)
      );
    }
    if (activityFilter === 'overdue follow-up') {
      return (
        caseRecords.some((caseItem) => caseItem.clientId === client.id && !['closed', 'archived'].includes(caseItem.status) && isOverdue(caseItem.nextFollowUp)) ||
        taskRecords.some((task) => task.clientId === client.id && task.status !== 'complete' && isOverdue(task.dueDate))
      );
    }
    if (activityFilter === 'no contact 14 days') return getDaysSince(client.latestContact) >= 14;
    if (activityFilter === 'document expiring') {
      return documentRecords.some((document) => document.clientId === client.id && document.expiresAt && getDaysUntil(document.expiresAt) <= 30);
    }
    if (activityFilter === 'unresolved referral') {
      return referralRecords.some((referral) => referral.clientId === client.id && referral.followUpRequired && !['completed', 'closed', 'declined'].includes(referral.status));
    }
    return true;
  };

  const caseMatchesActivityFilter = (caseItem: CaseRecord, client?: ClientRecord) => {
    if (activityFilter === 'all') return true;
    if (activityFilter === 'follow-up today') return getLocalDateKey(caseItem.nextFollowUp) === todayKey;
    if (activityFilter === 'overdue follow-up') {
      return (
        (!['closed', 'archived'].includes(caseItem.status) && isOverdue(caseItem.nextFollowUp)) ||
        taskRecords.some((task) => task.caseId === caseItem.id && task.status !== 'complete' && isOverdue(task.dueDate))
      );
    }
    if (activityFilter === 'no contact 14 days') return client ? getDaysSince(client.latestContact) >= 14 : false;
    if (activityFilter === 'document expiring') {
      return documentRecords.some((document) => document.caseId === caseItem.id && document.expiresAt && getDaysUntil(document.expiresAt) <= 30);
    }
    if (activityFilter === 'unresolved referral') {
      return referralRecords.some((referral) => referral.caseId === caseItem.id && referral.followUpRequired && !['completed', 'closed', 'declined'].includes(referral.status));
    }
    return true;
  };

  const clientMatchesFilters = (client: ClientRecord) => {
    const q = normalize(searchQuery);
    const matchesSearch = !q || clientSearchHaystack(client).includes(q);
    const matchesRisk = riskFilter === 'all' || client.riskLevel === riskFilter;
    const matchesWorker =
      workerFilter === 'all' ||
      client.assignedWorker === workerFilter ||
      caseRecords.some((caseItem) => caseItem.clientId === client.id && caseItem.assignedStaff === workerFilter);
    const matchesConsent = consentFilter === 'all' || client.consentStatus === consentFilter;
    const matchesStatus = caseStatusFilter === 'all' || caseRecords.some((caseItem) => caseItem.clientId === client.id && caseItem.status === caseStatusFilter);
    const matchesCaseType = caseTypeFilter === 'all' || caseRecords.some((caseItem) => caseItem.clientId === client.id && caseItem.type === caseTypeFilter);
    const matchesPriority = priorityFilter === 'all' || caseRecords.some((caseItem) => caseItem.clientId === client.id && caseItem.priority === priorityFilter);
    return matchesSearch && matchesRisk && matchesWorker && matchesConsent && matchesStatus && matchesCaseType && matchesPriority && clientMatchesActivityFilter(client);
  };

  const caseMatchesFilters = (caseItem: CaseRecord) => {
    const q = normalize(searchQuery);
    const client = clientRecords.find((candidate) => candidate.id === caseItem.clientId);
    const matchesSearch = !q || caseSearchHaystack(caseItem).includes(q);
    const matchesRisk = riskFilter === 'all' || client?.riskLevel === riskFilter;
    const matchesWorker = workerFilter === 'all' || caseItem.assignedStaff === workerFilter;
    const matchesConsent = consentFilter === 'all' || client?.consentStatus === consentFilter;
    const matchesStatus = caseStatusFilter === 'all' || caseItem.status === caseStatusFilter;
    const matchesCaseType = caseTypeFilter === 'all' || caseItem.type === caseTypeFilter;
    const matchesPriority = priorityFilter === 'all' || caseItem.priority === priorityFilter;
    return matchesSearch && matchesRisk && matchesWorker && matchesConsent && matchesStatus && matchesCaseType && matchesPriority && caseMatchesActivityFilter(caseItem, client);
  };

  const relatedRecordMatchesFilters = (clientId: string, caseId: string) => {
    const client = clientRecords.find((candidate) => candidate.id === clientId);
    const caseItem = caseRecords.find((candidate) => candidate.id === caseId);
    return (!client || clientMatchesFilters(client)) && (!caseItem || caseMatchesFilters(caseItem));
  };

  const searchableClients = useMemo(() => {
    return clientRecords.filter(clientMatchesFilters);
  }, [activityFilter, caseRecords, caseStatusFilter, caseTypeFilter, clientRecords, consentFilter, documentRecords, noteRecords, organizationRecords, priorityFilter, referralRecords, riskFilter, searchQuery, taskRecords, todayKey, workerFilter]);

  const searchableCases = useMemo(() => {
    return caseRecords.filter(caseMatchesFilters);
  }, [activityFilter, caseRecords, caseStatusFilter, caseTypeFilter, clientRecords, consentFilter, documentRecords, noteRecords, organizationRecords, priorityFilter, referralRecords, riskFilter, searchQuery, taskRecords, todayKey, workerFilter]);

  useEffect(() => {
    if (searchableClients.length === 0 || searchableClients.some((client) => client.id === selectedClientId)) return;
    const nextClient = searchableClients[0];
    if (!nextClient) return;
    setSelectedClientId(nextClient.id);
  }, [searchableClients, selectedClientId]);

  useEffect(() => {
    if (searchableCases.length === 0 || searchableCases.some((caseItem) => caseItem.id === selectedCaseId)) return;
    const nextCase = searchableCases[0];
    if (!nextCase) return;
    setSelectedCaseId(nextCase.id);
    setSelectedClientId(nextCase.clientId);
  }, [searchableCases, selectedCaseId]);

  const selectedClientCases = caseRecords.filter((caseItem) => caseItem.clientId === selectedClient.id);
  const selectedClientNotes = noteRecords.filter((note) => note.clientId === selectedClient.id);
  const selectedClientTasks = taskRecords.filter((task) => task.clientId === selectedClient.id);
  const selectedClientReferrals = referralRecords.filter((referral) => referral.clientId === selectedClient.id);
  const selectedClientDocuments = documentRecords.filter((document) => document.clientId === selectedClient.id);
  const selectedClientAppointments = appointmentRecords.filter((appointment) => appointment.clientId === selectedClient.id);

  const selectedCaseNotes = noteRecords.filter((note) => note.caseId === selectedCase.id);
  const selectedCaseTasks = taskRecords.filter((task) => task.caseId === selectedCase.id);
  const selectedCaseReferrals = referralRecords.filter((referral) => referral.caseId === selectedCase.id);
  const selectedCaseDocuments = documentRecords.filter((document) => document.caseId === selectedCase.id);
  const selectedCaseAppointments = appointmentRecords.filter((appointment) => appointment.caseId === selectedCase.id);
  const selectedCaseTimeline = timelineRecords.filter((event) => event.caseId === selectedCase.id);
  const selectedCaseBotAlerts = botAlerts.filter((alert) => alert.caseId === selectedCase.id);

  const overdueTasks = taskRecords.filter((task) => task.status !== 'complete' && isOverdue(task.dueDate));
  const urgentCases = caseRecords.filter((caseItem) => caseItem.priority === 'urgent' && caseItem.status !== 'closed');
  const todaysFollowUps = caseRecords.filter((caseItem) => getLocalDateKey(caseItem.nextFollowUp) === todayKey);
  const upcomingAppointments = appointmentRecords.filter((appointment) => appointment.attendanceStatus === 'scheduled');
  const activeCaseCountForClient = (clientId: string) =>
    caseRecords.filter((caseItem) => caseItem.clientId === clientId && !['closed', 'archived'].includes(caseItem.status)).length;
  const hasReportDateRange = Boolean(reportStartDate || reportEndDate);
  const reportRangeLabel = hasReportDateRange
    ? `${reportStartDate || 'Any start'} to ${reportEndDate || 'Any end'}`
    : 'All dates';
  const isWithinReportRange = (value?: string) => {
    if (!hasReportDateRange) return true;
    if (!value) return false;
    const key = getLocalDateKey(value);
    if (!key) return false;
    if (reportStartDate && key < reportStartDate) return false;
    if (reportEndDate && key > reportEndDate) return false;
    return true;
  };
  const recordTouchesReportRange = (...dates: Array<string | undefined>) =>
    !hasReportDateRange || dates.some((date) => isWithinReportRange(date));

  const automationNotifications = useMemo<CaseNotification[]>(() => {
    const notifications: CaseNotification[] = [];
    const severityWeight: Record<RiskLevel, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    const addNotification = (notification: CaseNotification) => notifications.push(notification);
    const clientName = (clientId: string) => clientRecords.find((client) => client.id === clientId)?.fullName ?? 'Client';
    const caseTitle = (caseId: string) => caseRecords.find((caseItem) => caseItem.id === caseId)?.title ?? 'case';

    taskRecords
      .filter((task) => task.status !== 'complete' && isOverdue(task.dueDate))
      .forEach((task) => {
        addNotification({
          id: `task-overdue-${task.id}`,
          type: 'task overdue',
          title: `Overdue task: ${task.title}`,
          detail: `${clientName(task.clientId)} · ${caseTitle(task.caseId)} · due ${formatDateTime(task.dueDate)}`,
          severity: task.priority === 'low' ? 'medium' : task.priority,
          clientId: task.clientId,
          caseId: task.caseId,
          dueAt: task.dueDate,
          actionTab: 'tasks',
          source: 'Automation',
        });
      });

    taskRecords
      .filter((task) => task.status !== 'complete' && getLocalDateKey(task.dueDate) === todayKey && !isOverdue(task.dueDate))
      .forEach((task) => {
        addNotification({
          id: `task-today-${task.id}`,
          type: 'task due today',
          title: `Task due today: ${task.title}`,
          detail: `${clientName(task.clientId)} · ${caseTitle(task.caseId)} · reminder ${task.reminderRules}`,
          severity: task.priority,
          clientId: task.clientId,
          caseId: task.caseId,
          dueAt: task.dueDate,
          actionTab: 'tasks',
          source: 'Automation',
        });
      });

    caseRecords
      .filter((caseItem) => !['closed', 'archived'].includes(caseItem.status) && isOverdue(caseItem.nextFollowUp))
      .forEach((caseItem) => {
        addNotification({
          id: `follow-up-due-${caseItem.id}`,
          type: 'follow-up due',
          title: `Follow-up due: ${caseItem.title}`,
          detail: `${clientName(caseItem.clientId)} · next action: ${caseItem.nextAction}`,
          severity: caseItem.priority,
          clientId: caseItem.clientId,
          caseId: caseItem.id,
          dueAt: caseItem.nextFollowUp,
          actionTab: 'cases',
          source: 'Automation',
        });
      });

    appointmentRecords
      .filter((appointment) => appointment.attendanceStatus === 'missed')
      .forEach((appointment) => {
        addNotification({
          id: `missed-appointment-${appointment.id}`,
          type: 'missed appointment',
          title: `Missed appointment: ${appointment.purpose}`,
          detail: `${clientName(appointment.clientId)} · ${appointment.location} · ${formatDateTime(appointment.dateTime)}`,
          severity: 'high',
          clientId: appointment.clientId,
          caseId: appointment.caseId,
          dueAt: appointment.dateTime,
          actionTab: 'calendar',
          source: 'Automation',
        });
      });

    referralRecords
      .filter((referral) => referral.followUpRequired && ['sent', 'acknowledged', 'no response'].includes(referral.status))
      .forEach((referral) => {
        addNotification({
          id: `referral-response-${referral.id}`,
          type: 'referral response',
          title: `Referral follow-up: ${referral.organization}`,
          detail: `${clientName(referral.clientId)} · ${referral.status} · outcome: ${referral.outcome}`,
          severity: referral.status === 'no response' ? 'high' : 'medium',
          clientId: referral.clientId,
          caseId: referral.caseId,
          dueAt: referral.appointmentDate,
          actionTab: 'referrals',
          source: 'Automation',
        });
      });

    clientRecords
      .filter((client) => client.status === 'active' && getDaysSince(client.latestContact) >= 14)
      .forEach((client) => {
        const caseItem = caseRecords.find((candidate) => candidate.clientId === client.id) ?? selectedCase;
        addNotification({
          id: `no-contact-${client.id}`,
          type: 'no contact',
          title: `No contact threshold: ${client.fullName}`,
          detail: `${getDaysSince(client.latestContact)} days since last contact · ${client.communicationPreference}`,
          severity: client.riskLevel === 'low' ? 'medium' : client.riskLevel,
          clientId: client.id,
          caseId: caseItem.id,
          dueAt: client.latestContact,
          actionTab: 'clients',
          source: 'Automation',
        });
      });

    documentRecords
      .filter((document) => document.expiresAt && getDaysUntil(document.expiresAt) <= 30)
      .forEach((document) => {
        addNotification({
          id: `document-expiring-${document.id}`,
          type: 'document expiring',
          title: `Document expiring: ${document.name}`,
          detail: `${clientName(document.clientId)} · ${document.tag} · expires ${document.expiresAt ? formatDate(document.expiresAt) : 'soon'}`,
          severity: document.permission === 'restricted' ? 'high' : 'medium',
          clientId: document.clientId,
          caseId: document.caseId,
          dueAt: document.expiresAt ?? new Date().toISOString(),
          actionTab: 'documents',
          source: 'Automation',
        });
      });

    botAlerts
      .filter((alert) => ['urgent', 'high'].includes(alert.severity))
      .forEach((alert) => {
        addNotification({
          id: `bot-alert-${alert.id}`,
          type: 'urgent pattern',
          title: alert.title,
          detail: alert.prompt,
          severity: alert.severity,
          clientId: alert.clientId,
          caseId: alert.caseId,
          dueAt: new Date().toISOString(),
          actionTab: 'cases',
          source: 'Street Bot',
        });
      });

    return notifications.sort((left, right) => {
      const severityDelta = severityWeight[left.severity] - severityWeight[right.severity];
      if (severityDelta !== 0) return severityDelta;
      return toDate(left.dueAt).getTime() - toDate(right.dueAt).getTime();
    });
  }, [appointmentRecords, caseRecords, clientRecords, documentRecords, referralRecords, selectedCase, taskRecords, todayKey]);

  const visibleNotifications = automationNotifications.filter((notification) => !dismissedNotificationIds.includes(notification.id));
  const activeFilterCount = [
    searchQuery.trim() ? 'search' : 'all',
    riskFilter,
    workerFilter,
    caseStatusFilter,
    caseTypeFilter,
    priorityFilter,
    consentFilter,
    activityFilter,
  ].filter((filter) => filter !== 'all').length;

  const markFiltersCustom = () => {
    if (savedViewId !== 'custom') setSavedViewId('custom');
  };

  const clearFilters = () => {
    setSearchQuery('');
    setRiskFilter('all');
    setWorkerFilter('all');
    setCaseStatusFilter('all');
    setCaseTypeFilter('all');
    setPriorityFilter('all');
    setConsentFilter('all');
    setActivityFilter('all');
    setSavedViewId('all');
    setDraftNotice('Filters cleared. Showing the full case management workspace.');
  };

  const applySavedView = (view: SavedViewId) => {
    setSearchQuery('');
    setRiskFilter('all');
    setWorkerFilter('all');
    setCaseStatusFilter('all');
    setCaseTypeFilter('all');
    setPriorityFilter('all');
    setConsentFilter('all');
    setActivityFilter('all');
    setSavedViewId(view);

    if (view === 'urgent') {
      setPriorityFilter('urgent');
      handleTabChange('cases');
      setDraftNotice('Saved view applied: urgent work.');
      return;
    }
    if (view === 'today') {
      setActivityFilter('follow-up today');
      handleTabChange('overview');
      setDraftNotice('Saved view applied: follow-ups due today.');
      return;
    }
    if (view === 'stale') {
      setActivityFilter('no contact 14 days');
      handleTabChange('clients');
      setDraftNotice('Saved view applied: no contact in 14 days.');
      return;
    }
    if (view === 'documents') {
      setActivityFilter('document expiring');
      handleTabChange('documents');
      setDraftNotice('Saved view applied: expiring documents.');
      return;
    }
    if (view === 'referrals') {
      setActivityFilter('unresolved referral');
      handleTabChange('referrals');
      setDraftNotice('Saved view applied: unresolved referrals.');
      return;
    }
    setDraftNotice('Saved view applied: all work.');
  };

  const updateClientIntake = <K extends keyof ClientIntakeDraft>(field: K, value: ClientIntakeDraft[K]) => {
    setClientIntake((draft) => ({ ...draft, [field]: value }));
  };

  const updateCaseQuickDraft = <K extends keyof CaseQuickDraft>(field: K, value: CaseQuickDraft[K]) => {
    setCaseQuickDraft((draft) => ({ ...draft, [field]: value }));
  };

  const updateReferralQuickDraft = <K extends keyof ReferralQuickDraft>(field: K, value: ReferralQuickDraft[K]) => {
    setReferralQuickDraft((draft) => ({ ...draft, [field]: value }));
  };

  const updateAppointmentQuickDraft = <K extends keyof AppointmentQuickDraft>(field: K, value: AppointmentQuickDraft[K]) => {
    setAppointmentQuickDraft((draft) => ({ ...draft, [field]: value }));
  };

  const updateCaseTypeDraft = <K extends keyof CaseTypeDraft>(field: K, value: CaseTypeDraft[K]) => {
    setCaseTypeDraft((draft) => ({ ...draft, [field]: value }));
  };

  const updateOrganizationDraft = <K extends keyof OrganizationDraft>(field: K, value: OrganizationDraft[K]) => {
    setOrganizationDraft((draft) => ({ ...draft, [field]: value }));
  };

  const addTimelineEvent = (event: Omit<TimelineEvent, 'id' | 'occurredAt'> & { occurredAt?: string }) => {
    setTimelineRecords((records) => [
      {
        id: `tl-${Date.now()}`,
        occurredAt: event.occurredAt ?? new Date().toISOString(),
        clientId: event.clientId,
        caseId: event.caseId,
        type: event.type,
        title: event.title,
        detail: event.detail,
      },
      ...records,
    ]);
  };

  const addAuditEvent = (event: Omit<AuditEvent, 'id' | 'timestamp'> & { timestamp?: string }) => {
    setAuditRecords((records) => [
      {
        id: `audit-${Date.now()}-${records.length}`,
        timestamp: event.timestamp ?? new Date().toISOString(),
        actor: event.actor,
        action: event.action,
        object: event.object,
      },
      ...records,
    ]);
  };

  const saveCaseTypeDraft = () => {
    const name = caseTypeDraft.name.trim();
    if (!name) {
      setDraftNotice('Add a case type name before saving the workflow.');
      return;
    }
    const workflow = caseTypeDraft.workflow
      .split(',')
      .map((step) => step.trim())
      .filter(Boolean);
    const normalizedName = normalize(name);
    const existing = caseTypeRecords.find((type) => normalize(type.name) === normalizedName);
    const record: CaseType = {
      id: existing?.id ?? `case-type-${Date.now()}`,
      name,
      workflow: workflow.length > 0 ? workflow : ['Intake', 'Service plan', 'Follow-up', 'Closure summary'],
      successCriteria: caseTypeDraft.successCriteria.trim() || 'Goal, barriers, next action, and closure criteria are documented.',
    };

    setCaseTypeRecords((records) => [record, ...records.filter((type) => type.id !== record.id)]);
    addAuditEvent({
      actor: 'Current worker',
      action: existing ? 'updated case type workflow' : 'created case type workflow',
      object: record.name,
    });
    setCaseTypeDraft(emptyCaseTypeDraft);
    setDraftNotice(`${record.name} workflow saved.`);
  };

  const removeCaseType = (caseType: CaseType) => {
    const typeInUse = caseRecords.some((caseItem) => normalize(caseItem.type) === normalize(caseType.name));
    if (typeInUse) {
      setDraftNotice(`${caseType.name} is used by active case records and cannot be removed.`);
      return;
    }
    setCaseTypeRecords((records) => records.filter((record) => record.id !== caseType.id));
    addAuditEvent({
      actor: 'Current worker',
      action: 'removed case type workflow',
      object: caseType.name,
    });
    setDraftNotice(`${caseType.name} removed from workflow settings.`);
  };

  const saveOrganizationDraft = () => {
    const name = organizationDraft.name.trim();
    if (!name) {
      setDraftNotice('Add an organization name before saving the partner resource.');
      return;
    }
    const serviceCategories = organizationDraft.serviceCategories
      .split(',')
      .map((category) => category.trim())
      .filter(Boolean);
    const normalizedName = normalize(name);
    const existing = organizationRecords.find((organization) => normalize(organization.name) === normalizedName);
    const turnaroundDays = Number.parseInt(organizationDraft.averageTurnaroundDays, 10);
    const record: OrganizationRecord = {
      id: existing?.id ?? `org-${Date.now()}`,
      name,
      serviceCategories: serviceCategories.length > 0 ? serviceCategories : ['General support'],
      contactPerson: organizationDraft.contactPerson.trim() || 'Intake desk',
      contact: organizationDraft.contact.trim() || 'Contact pending',
      phone: organizationDraft.phone.trim() || 'Phone pending',
      address: organizationDraft.address.trim() || 'Address pending',
      eligibility: organizationDraft.eligibility.trim() || 'Eligibility to be confirmed by worker.',
      notes: organizationDraft.notes.trim() || 'No partner notes yet.',
      preferred: existing?.preferred ?? false,
      active: true,
      averageTurnaroundDays: Number.isFinite(turnaroundDays) ? Math.max(turnaroundDays, 0) : 3,
    };

    setOrganizationRecords((records) => [record, ...records.filter((organization) => organization.id !== record.id)]);
    addAuditEvent({
      actor: 'Current worker',
      action: existing ? 'updated organization resource' : 'created organization resource',
      object: record.name,
    });
    setOrganizationDraft(emptyOrganizationDraft);
    setDraftNotice(`${record.name} saved to the referral resource directory.`);
  };

  const removeOrganization = (organization: OrganizationRecord) => {
    const organizationInUse = referralRecords.some((referral) => referral.organization === organization.name);
    if (organizationInUse) {
      setOrganizationRecords((records) =>
        records.map((record) => (record.id === organization.id ? { ...record, active: false } : record)),
      );
      addAuditEvent({
        actor: 'Current worker',
        action: 'archived organization resource',
        object: organization.name,
      });
      setDraftNotice(`${organization.name} is used in referral history, so it was archived instead of removed.`);
      return;
    }
    setOrganizationRecords((records) => records.filter((record) => record.id !== organization.id));
    addAuditEvent({
      actor: 'Current worker',
      action: 'removed organization resource',
      object: organization.name,
    });
    setDraftNotice(`${organization.name} removed from the referral resource directory.`);
  };

  const startReferralWithOrganization = (organization: OrganizationRecord) => {
    setReferralQuickDraft({
      organization: organization.name,
      serviceCategory: organization.serviceCategories[0] ?? selectedCase.type,
      contactPerson: organization.contactPerson,
      contact: organization.contact,
      appointmentDate: '',
      supportingDocuments: '',
    });
    setProfileAction('referral');
    handleTabChange('clients');
    setDraftNotice(`${organization.name} loaded into the referral quick action for ${selectedClient.fullName}.`);
  };

  const openNotification = (notification: CaseNotification) => {
    setSelectedClientId(notification.clientId);
    setSelectedCaseId(notification.caseId);
    handleTabChange(notification.actionTab);
    setDraftNotice(`Opened ${notification.title}.`);
  };

  const dismissNotification = (notificationId: string) => {
    setDismissedNotificationIds((ids) => (ids.includes(notificationId) ? ids : [notificationId, ...ids]));
  };

  const createFollowUpFromNotification = (notification: CaseNotification) => {
    const caseItem = caseRecords.find((candidate) => candidate.id === notification.caseId) ?? selectedCase;
    const client = clientRecords.find((candidate) => candidate.id === notification.clientId) ?? selectedClient;
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 1);
    dueAt.setHours(9, 0, 0, 0);
    const task: TaskRecord = {
      id: `task-${Date.now()}`,
      title: `Follow up: ${notification.title}`,
      clientId: client.id,
      caseId: caseItem.id,
      owner: caseItem.assignedStaff,
      dueDate: dueAt.toISOString(),
      priority: notification.severity === 'low' ? 'medium' : notification.severity,
      status: 'open',
      reminderRules: 'Morning of due date',
      dependency: notification.type,
      notes: notification.detail,
    };

    setTaskRecords((records) => [task, ...records]);
    addTimelineEvent({
      clientId: client.id,
      caseId: caseItem.id,
      type: 'task created',
      title: task.title,
      detail: `${task.owner} created this follow-up from a ${notification.type} notification.`,
    });
    addAuditEvent({
      actor: task.owner,
      action: 'created task from notification',
      object: notification.title,
    });
    dismissNotification(notification.id);
    setSelectedClientId(client.id);
    setSelectedCaseId(caseItem.id);
    handleTabChange('tasks');
    setTaskView('all');
    setDraftNotice(`Created follow-up task from "${notification.title}".`);
  };

  const createClientFromIntake = () => {
    const fullName = clientIntake.fullName.trim();
    if (!fullName) {
      setDraftNotice('Add a client name before creating the intake record.');
      return;
    }

    const now = new Date();
    const followUpAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const targetDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const clientId = `client-${Date.now()}`;
    const caseId = `case-${Date.now()}`;
    const preferredName = clientIntake.preferredName.trim() || fullName.split(/\s+/)[0] || fullName;
    const riskFlags = clientIntake.riskFlags
      .split(',')
      .map((flag) => flag.trim())
      .filter(Boolean);

    const client: ClientRecord = {
      id: clientId,
      fullName,
      preferredName,
      alias: makeAlias(fullName),
      clientId: nextClientCode(clientRecords),
      dob: clientIntake.dob || now.toISOString().slice(0, 10),
      age: getAgeFromDob(clientIntake.dob),
      phone: clientIntake.phone.trim() || 'Not recorded',
      email: clientIntake.email.trim() || 'Not recorded',
      location: clientIntake.location.trim() || 'Last known location pending',
      demographicDetails: clientIntake.demographicDetails.trim() || 'Not recorded',
      emergencyContact: clientIntake.emergencyContact.trim() || 'Not recorded',
      language: clientIntake.language.trim() || 'English',
      communicationPreference: clientIntake.communicationPreference.trim() || 'Worker follow-up',
      consentStatus: clientIntake.consentStatus,
      riskLevel: clientIntake.riskLevel,
      riskFlags,
      serviceHistory: clientIntake.serviceHistory.trim() || 'Intake started in Case Management.',
      activeCasesCount: 1,
      assignedWorker: clientIntake.assignedWorker.trim() || 'Current worker',
      assignedTeam: clientIntake.assignedTeam.trim() || 'Case Management',
      pronouns: clientIntake.pronouns.trim() || 'Not recorded',
      accessibilityNeeds: clientIntake.accessibilityNeeds.trim() || 'Not recorded',
      transportationNeeds: clientIntake.transportationNeeds.trim() || 'Not recorded',
      housingStatus: clientIntake.housingStatus.trim() || 'Needs assessment',
      incomeStatus: clientIntake.incomeStatus.trim() || 'Needs assessment',
      benefitsStatus: clientIntake.benefitsStatus.trim() || 'Needs review',
      status: 'active',
      latestContact: now.toISOString(),
      nextFollowUp: followUpAt.toISOString(),
    };

    const intakeCase: CaseRecord = {
      id: caseId,
      caseId: nextCaseCode(caseRecords),
      clientId,
      title: 'Initial intake',
      type: 'intake / needs assessment',
      status: 'intake',
      priority: client.riskLevel === 'urgent' ? 'urgent' : client.riskLevel === 'high' ? 'high' : 'medium',
      assignedStaff: client.assignedWorker,
      assignedTeam: client.assignedTeam,
      openedDate: now.toISOString().slice(0, 10),
      targetResolutionDate: targetDate.toISOString().slice(0, 10),
      referralSource: 'Case management intake',
      tags: ['intake', client.riskLevel],
      summary: 'New client intake record created. Complete needs assessment, consent review, and first follow-up plan.',
      goals: ['Complete intake assessment', 'Confirm consent status', 'Set service plan'],
      barriers: riskFlags.length > 0 ? riskFlags : ['Needs assessment'],
      nextAction: 'Complete intake checklist',
      nextFollowUp: followUpAt.toISOString(),
    };

    const intakeTask: TaskRecord = {
      id: `task-${Date.now()}`,
      title: 'Complete intake checklist',
      clientId,
      caseId,
      owner: client.assignedWorker,
      dueDate: followUpAt.toISOString(),
      priority: intakeCase.priority,
      status: 'open',
      reminderRules: 'Morning of due date',
      dependency: client.consentStatus === 'signed' ? 'None' : 'Consent review',
      notes: 'Auto-created when the client intake record was added.',
    };

    setClientRecords((records) => [client, ...records]);
    setCaseRecords((records) => [intakeCase, ...records]);
    setTaskRecords((records) => [intakeTask, ...records]);
    addTimelineEvent({
      clientId,
      caseId,
      type: 'case opened',
      title: 'Intake case opened',
      detail: `${client.fullName} was added with an intake case and first follow-up task.`,
    });
    addAuditEvent({
      actor: client.assignedWorker,
      action: 'created client intake',
      object: `${client.clientId} / ${intakeCase.caseId}`,
    });
    setSelectedClientId(clientId);
    setSelectedCaseId(caseId);
    setClientIntake(emptyClientIntake);
    setClientIntakeOpen(false);
    setDraftNotice(`Created ${client.fullName} with an intake case and follow-up task.`);
  };

  const createCaseFromProfile = () => {
    const title = caseQuickDraft.title.trim();
    if (!title) {
      setDraftNotice('Add a case title before creating the case.');
      return;
    }

    const now = new Date();
    const followUpAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const targetDate =
      caseQuickDraft.targetResolutionDate ||
      new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const caseId = `case-${Date.now()}`;
    const caseRecord: CaseRecord = {
      id: caseId,
      caseId: nextCaseCode(caseRecords),
      clientId: selectedClient.id,
      title,
      type: caseQuickDraft.type.trim() || 'general support',
      status: 'active',
      priority: caseQuickDraft.priority,
      assignedStaff: selectedClient.assignedWorker,
      assignedTeam: selectedClient.assignedTeam,
      openedDate: now.toISOString().slice(0, 10),
      targetResolutionDate: targetDate,
      referralSource: 'Client profile quick action',
      tags: [caseQuickDraft.type.trim() || 'general support', caseQuickDraft.priority],
      summary: caseQuickDraft.summary.trim() || 'Case opened from the client profile quick action.',
      goals: ['Confirm service goal', 'Document barriers', 'Set next follow-up'],
      barriers: selectedClient.riskFlags.length > 0 ? selectedClient.riskFlags : ['Needs assessment'],
      nextAction: caseQuickDraft.nextAction.trim() || 'Confirm next action with client',
      nextFollowUp: followUpAt.toISOString(),
    };

    setCaseRecords((records) => [caseRecord, ...records]);
    addTimelineEvent({
      clientId: selectedClient.id,
      caseId,
      type: 'case opened',
      title: `${caseRecord.title} opened`,
      detail: `${caseRecord.assignedStaff} opened this case from the client profile quick action.`,
    });
    addAuditEvent({
      actor: caseRecord.assignedStaff,
      action: 'created case',
      object: caseRecord.caseId,
    });
    setSelectedCaseId(caseId);
    handleTabChange('cases');
    setProfileAction(null);
    setCaseQuickDraft(emptyCaseQuickDraft);
    setDraftNotice(`Created ${caseRecord.title} for ${selectedClient.fullName}.`);
  };

  const createReferralFromProfile = () => {
    const organization = referralQuickDraft.organization.trim();
    if (!organization) {
      setDraftNotice('Add an organization before creating the referral.');
      return;
    }

    const now = new Date();
    const followUpAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const appointmentDate = referralQuickDraft.appointmentDate || followUpAt.toISOString().slice(0, 16);
    const supportingDocuments = referralQuickDraft.supportingDocuments
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const matchedOrganization = organizationRecords.find((record) => normalize(record.name) === normalize(organization));
    const referral: ReferralRecord = {
      id: `ref-${Date.now()}`,
      clientId: selectedClient.id,
      caseId: selectedCase.id,
      organization,
      serviceCategory: referralQuickDraft.serviceCategory.trim() || matchedOrganization?.serviceCategories[0] || selectedCase.type,
      referralDate: now.toISOString().slice(0, 10),
      status: 'sent',
      contactPerson: referralQuickDraft.contactPerson.trim() || matchedOrganization?.contactPerson || 'Intake desk',
      contact: referralQuickDraft.contact.trim() || matchedOrganization?.contact || 'Contact pending',
      appointmentDate: new Date(appointmentDate).toISOString(),
      outcome: 'Waiting for partner response',
      followUpRequired: true,
      supportingDocuments,
    };
    const task: TaskRecord = {
      id: `task-${Date.now()}`,
      title: `Follow up with ${organization}`,
      clientId: selectedClient.id,
      caseId: selectedCase.id,
      owner: selectedCase.assignedStaff,
      dueDate: followUpAt.toISOString(),
      priority: selectedCase.priority,
      status: 'open',
      reminderRules: 'Morning of due date',
      dependency: supportingDocuments.length > 0 ? 'Partner response' : 'Supporting documents',
      notes: 'Auto-created when the referral was sent.',
    };

    setReferralRecords((records) => [referral, ...records]);
    setTaskRecords((records) => [task, ...records]);
    addTimelineEvent({
      clientId: selectedClient.id,
      caseId: selectedCase.id,
      type: 'referral sent',
      title: `${organization} referral sent`,
      detail: `Referral created for ${referral.serviceCategory}. Follow-up task due ${formatDateTime(task.dueDate)}.`,
    });
    addAuditEvent({
      actor: selectedCase.assignedStaff,
      action: 'created referral and follow-up task',
      object: organization,
    });
    handleTabChange('referrals');
    setProfileAction(null);
    setReferralQuickDraft(emptyReferralQuickDraft);
    setDraftNotice(`Referral to ${organization} created with a follow-up task.`);
  };

  const createAppointmentFromProfile = () => {
    const purpose = appointmentQuickDraft.purpose.trim();
    if (!purpose) {
      setDraftNotice('Add an appointment purpose before scheduling.');
      return;
    }

    const now = new Date();
    const appointmentAt =
      appointmentQuickDraft.dateTime ||
      new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    const prepChecklist = appointmentQuickDraft.prepChecklist
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const appointment: AppointmentRecord = {
      id: `appt-${Date.now()}`,
      clientId: selectedClient.id,
      caseId: selectedCase.id,
      dateTime: new Date(appointmentAt).toISOString(),
      location: appointmentQuickDraft.location.trim() || 'Location pending',
      serviceProvider: appointmentQuickDraft.serviceProvider.trim() || selectedCase.assignedTeam,
      purpose,
      attendanceStatus: 'scheduled',
      reminders: 'Evening before and morning of',
      prepChecklist: prepChecklist.length > 0 ? prepChecklist : ['Confirm appointment details', 'Bring relevant documents'],
      outcomeNotes: 'Pending',
    };
    const task: TaskRecord = {
      id: `task-${Date.now()}`,
      title: `Prepare for ${purpose}`,
      clientId: selectedClient.id,
      caseId: selectedCase.id,
      owner: selectedCase.assignedStaff,
      dueDate: appointment.dateTime,
      priority: selectedCase.priority,
      status: 'open',
      reminderRules: 'Morning of appointment',
      dependency: 'Appointment confirmed',
      notes: 'Auto-created from appointment scheduling.',
    };

    setAppointmentRecords((records) => [appointment, ...records]);
    setTaskRecords((records) => [task, ...records]);
    addTimelineEvent({
      clientId: selectedClient.id,
      caseId: selectedCase.id,
      type: 'appointment scheduled',
      title: purpose,
      detail: `${appointment.serviceProvider} appointment scheduled for ${formatDateTime(appointment.dateTime)}.`,
    });
    addAuditEvent({
      actor: selectedCase.assignedStaff,
      action: 'scheduled appointment',
      object: purpose,
    });
    handleTabChange('calendar');
    setProfileAction(null);
    setAppointmentQuickDraft(emptyAppointmentQuickDraft);
    setDraftNotice(`Scheduled ${purpose} for ${selectedClient.fullName}.`);
  };

  const generateStreetBotSummary = () => {
    const activeCases = selectedClientCases.filter((caseItem) => !['closed', 'archived'].includes(caseItem.status));
    const openTasks = selectedClientTasks.filter((task) => task.status !== 'complete');
    const summary = `${selectedClient.fullName} has ${activeCases.length} active case${activeCases.length === 1 ? '' : 's'}, ${openTasks.length} open task${openTasks.length === 1 ? '' : 's'}, ${selectedClientReferrals.length} referral${selectedClientReferrals.length === 1 ? '' : 's'}, and ${selectedClientAppointments.length} appointment${selectedClientAppointments.length === 1 ? '' : 's'}. Priority is ${selectedClient.riskLevel}; next action is ${selectedCase.nextAction}.`;
    const note: NoteRecord = {
      id: `note-${Date.now()}`,
      timestamp: new Date().toISOString(),
      author: 'Street Bot',
      clientId: selectedClient.id,
      caseId: selectedCase.id,
      type: 'Street Bot conversation summary',
      narrative: summary,
      structuredFields: ['Generated summary', 'Human review required'],
      attachments: [],
      followUpRequired: openTasks.length > 0 || selectedCase.priority === 'urgent',
      visibility: 'team',
      aiSummary: summary,
      aiTags: ['street bot', 'summary', selectedClient.riskLevel],
    };

    setNoteRecords((records) => [note, ...records]);
    addTimelineEvent({
      clientId: selectedClient.id,
      caseId: selectedCase.id,
      type: 'Street Bot summary added',
      title: 'Street Bot summary drafted',
      detail: summary,
    });
    addAuditEvent({
      actor: 'Street Bot',
      action: 'generated case summary draft',
      object: selectedCase.caseId,
    });
    handleTabChange('cases');
    setProfileAction(null);
    setDraftNotice(`Street Bot summary drafted for ${selectedClient.fullName}.`);
  };

  const handleProfileAction = (action: string) => {
    if (action === 'Add case') {
      setProfileAction('case');
      return;
    }
    if (action === 'Add note') {
      handleTabChange('cases');
      setProfileAction(null);
      setDraftNotice('Use quick note mode in the selected case to add the note.');
      return;
    }
    if (action === 'Assign task') {
      handleTabChange('cases');
      setProfileAction(null);
      setDraftNotice('Use Create task in the selected case to assign a follow-up.');
      return;
    }
    if (action === 'Upload file') {
      setProfileAction(null);
      handleTabChange('documents');
      documentInputRef.current?.click();
      return;
    }
    if (action === 'Refer client') {
      setProfileAction('referral');
      return;
    }
    if (action === 'Schedule appointment') {
      setProfileAction('appointment');
      return;
    }
    if (action === 'Generate summary') {
      generateStreetBotSummary();
    }
  };

  const addQuickNote = () => {
    const text = quickNote.trim();
    if (!text) return;
    const note: NoteRecord = {
      id: `note-${Date.now()}`,
      timestamp: new Date().toISOString(),
      author: 'Current worker',
      clientId: selectedClient.id,
      caseId: selectedCase.id,
      type: structuredNoteType,
      narrative: text,
      structuredFields: ['Quick note mode', 'Needs worker review'],
      attachments: [],
      followUpRequired: text.toLowerCase().includes('follow'),
      visibility: 'internal',
      aiSummary: 'Street Bot draft summary will appear after review.',
      aiTags: ['draft', structuredNoteType],
    };
    setNoteRecords((records) => [note, ...records]);
    addTimelineEvent({
      clientId: selectedClient.id,
      caseId: selectedCase.id,
      type: 'note added',
      title: `${structuredNoteType} note added`,
      detail: text,
    });
    addAuditEvent({
      actor: note.author,
      action: `added ${structuredNoteType} note`,
      object: selectedCase.caseId,
    });
    setQuickNote('');
    setDraftNotice(`Added a ${structuredNoteType} note for ${selectedClient.fullName}.`);
  };

  const addTask = () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    const task: TaskRecord = {
      id: `task-${Date.now()}`,
      title,
      clientId: selectedClient.id,
      caseId: selectedCase.id,
      owner: selectedCase.assignedStaff,
      dueDate: '2026-04-17T09:00:00',
      priority: selectedCase.priority,
      status: 'open',
      reminderRules: 'Morning of due date',
      dependency: 'None',
      notes: 'Created from case management quick action.',
    };
    setTaskRecords((records) => [task, ...records]);
    addTimelineEvent({
      clientId: selectedClient.id,
      caseId: selectedCase.id,
      type: 'task created',
      title,
      detail: `Task assigned to ${task.owner} and due ${formatDateTime(task.dueDate)}.`,
    });
    addAuditEvent({
      actor: task.owner,
      action: 'created task',
      object: task.title,
    });
    setNewTaskTitle('');
    setDraftNotice(`Created task "${title}" for ${selectedClient.fullName}.`);
  };

  const completeTask = (taskId: string) => {
    const completedTask = taskRecords.find((task) => task.id === taskId);
    setTaskRecords((records) =>
      records.map((task) =>
        task.id === taskId
          ? { ...task, status: 'complete', completedAt: new Date().toISOString() }
          : task,
      ),
    );
    if (completedTask) {
      addTimelineEvent({
        clientId: completedTask.clientId,
        caseId: completedTask.caseId,
        type: 'task completed',
        title: completedTask.title,
        detail: `${completedTask.owner} marked this task complete.`,
      });
      addAuditEvent({
        actor: completedTask.owner,
        action: 'completed task',
        object: completedTask.title,
      });
      setDraftNotice(`Completed task "${completedTask.title}".`);
    }
  };

  const updateCaseStatus = (status: CaseStatus) => {
    setCaseRecords((records) =>
      records.map((caseItem) =>
        caseItem.id === selectedCase.id
          ? {
              ...caseItem,
              status,
              closedDate: status === 'closed' ? new Date().toISOString().slice(0, 10) : caseItem.closedDate,
              closureReason: status === 'closed' ? 'Administrative closure pending review' : caseItem.closureReason,
            }
          : caseItem,
      ),
    );
    addTimelineEvent({
      clientId: selectedCase.clientId,
      caseId: selectedCase.id,
      type: 'case status changed',
      title: `Status changed to ${status}`,
      detail: `${selectedCase.title} was updated from ${selectedCase.status} to ${status}.`,
    });
    addAuditEvent({
      actor: selectedCase.assignedStaff,
      action: `changed case status to ${status}`,
      object: selectedCase.caseId,
    });
    setDraftNotice(`Updated ${selectedCase.title} to ${status}.`);
  };

  const createDraftSnapshot = (): CaseManagementDraft => ({
    version: 1,
    savedAt: new Date().toISOString(),
    clientRecords,
    caseRecords,
    taskRecords,
    noteRecords,
    referralRecords,
    appointmentRecords,
    documentRecords,
    timelineRecords,
    wikiIngestionRecords,
    auditRecords,
    caseTypeRecords,
    organizationRecords,
    activeTab,
    selectedClientId,
    selectedCaseId,
    caseView,
    taskView,
    riskFilter,
    workerFilter,
    caseStatusFilter,
    caseTypeFilter,
    priorityFilter,
    consentFilter,
    activityFilter,
    savedViewId,
    reportStartDate,
    reportEndDate,
    dismissedNotificationIds,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(CASE_MANAGEMENT_STORAGE_KEY, JSON.stringify(createDraftSnapshot()));
    } catch {
      setDraftNotice('Local draft storage is unavailable in this browser.');
    }
  }, [
    activeTab,
    auditRecords,
    appointmentRecords,
    activityFilter,
    caseRecords,
    caseStatusFilter,
    caseTypeFilter,
    caseTypeRecords,
    caseView,
    clientRecords,
    consentFilter,
    dismissedNotificationIds,
    documentRecords,
    noteRecords,
    organizationRecords,
    priorityFilter,
    reportEndDate,
    reportStartDate,
    referralRecords,
    riskFilter,
    savedViewId,
    selectedCaseId,
    selectedClientId,
    taskRecords,
    taskView,
    timelineRecords,
    wikiIngestionRecords,
    workerFilter,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadServerDraft = async () => {
      if (!token) return;
      try {
        const response = await fetch(CASE_MANAGEMENT_API_PATH, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status === 404) {
          if (!cancelled) {
            setServerPersistenceReady(true);
            setDraftNotice(
              savedDraft
                ? `Local draft restored from ${formatDateTime(savedDraft.savedAt)} and will sync to Street Voices.`
                : 'Street Voices persistence is ready. Changes save to the server.',
            );
          }
          return;
        }
        if (!response.ok) throw new Error(`Load failed with ${response.status}`);

        const payload = (await response.json()) as { savedAt?: string | null; workspace?: unknown };
        if (!payload.workspace) {
          if (!cancelled) {
            setServerPersistenceReady(true);
            setDraftNotice(
              savedDraft
                ? `Local draft restored from ${formatDateTime(savedDraft.savedAt)} and will sync to Street Voices.`
                : 'Street Voices persistence is ready. Changes save to the server.',
            );
          }
          return;
        }

        const draft = parseCaseManagementDraft(payload.workspace);
        if (!draft) throw new Error('Invalid server workspace');
        if (cancelled) return;

        setClientRecords(draft.clientRecords);
        setCaseRecords(draft.caseRecords);
        setTaskRecords(draft.taskRecords);
        setNoteRecords(draft.noteRecords);
        setReferralRecords(draft.referralRecords);
        setAppointmentRecords(draft.appointmentRecords);
        setDocumentRecords(draft.documentRecords);
        setTimelineRecords(draft.timelineRecords);
        setWikiIngestionRecords(draft.wikiIngestionRecords);
        setAuditRecords(draft.auditRecords);
        setCaseTypeRecords(draft.caseTypeRecords);
        setOrganizationRecords(draft.organizationRecords);
        setActiveTab(caseManagementTabFromPath() ?? draft.activeTab ?? 'overview');
        setCaseView(draft.caseView ?? 'table');
        setTaskView(draft.taskView ?? 'my');
        setRiskFilter(draft.riskFilter ?? 'all');
        setWorkerFilter(draft.workerFilter ?? 'all');
        setCaseStatusFilter(draft.caseStatusFilter ?? 'all');
        setCaseTypeFilter(draft.caseTypeFilter ?? 'all');
        setPriorityFilter(draft.priorityFilter ?? 'all');
        setConsentFilter(draft.consentFilter ?? 'all');
        setActivityFilter(draft.activityFilter ?? 'all');
        setSavedViewId(draft.savedViewId ?? 'all');
        setReportStartDate(draft.reportStartDate ?? '');
        setReportEndDate(draft.reportEndDate ?? '');
        setDismissedNotificationIds(draft.dismissedNotificationIds ?? []);
        setSelectedClientId(draft.selectedClientId ?? draft.clientRecords[0]?.id ?? initialClients[0].id);
        setSelectedCaseId(draft.selectedCaseId ?? draft.caseRecords[0]?.id ?? initialCases[0].id);
        setServerPersistenceReady(true);
        setDraftNotice(`Server workspace restored from ${formatDateTime(payload.savedAt ?? draft.savedAt)}.`);
      } catch {
        if (!cancelled) {
          setServerPersistenceReady(false);
          setDraftNotice('Street Voices server save is unavailable; changes are saved locally in this browser.');
        }
      }
    };

    loadServerDraft();
    return () => {
      cancelled = true;
    };
  }, [savedDraft, token]);

  useEffect(() => {
    let cancelled = false;

    const loadWikiIngestions = async () => {
      if (!token || !serverPersistenceReady) return;
      try {
        const response = await fetch(CASE_MANAGEMENT_WIKI_INGESTIONS_PATH, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          wikiIngestionRecords?: WikiIngestionRecord[];
          generatedRecords?: {
            noteRecords?: NoteRecord[];
            documentRecords?: DocumentRecord[];
            timelineRecords?: TimelineEvent[];
          };
        };
        if (!cancelled && Array.isArray(payload.wikiIngestionRecords)) {
          setWikiIngestionRecords((records) => mergeById(records, payload.wikiIngestionRecords ?? []));
          setNoteRecords((records) => mergeById(records, payload.generatedRecords?.noteRecords ?? []));
          setDocumentRecords((records) => mergeById(records, payload.generatedRecords?.documentRecords ?? []));
          setTimelineRecords((records) => mergeById(records, payload.generatedRecords?.timelineRecords ?? []));
        }
      } catch {
        if (!cancelled) {
          setWikiIngestStatus('Stored wiki ingestions are unavailable; the local wiki still works.');
        }
      }
    };

    loadWikiIngestions();
    return () => {
      cancelled = true;
    };
  }, [serverPersistenceReady, token]);

  useEffect(() => {
    if (!serverPersistenceReady || !token || typeof window === 'undefined') return;
    if (serverSaveTimerRef.current) {
      window.clearTimeout(serverSaveTimerRef.current);
    }

    serverSaveTimerRef.current = window.setTimeout(() => {
      saveServerCaseManagementDraft(createDraftSnapshot(), token)
        .then((payload) => {
          setDraftNotice(`Saved to Street Voices at ${formatDateTime(payload.savedAt ?? new Date().toISOString())}.`);
        })
        .catch(() => {
          setDraftNotice('Server save failed; the local browser draft is still saved.');
        });
    }, 800);

    return () => {
      if (serverSaveTimerRef.current) {
        window.clearTimeout(serverSaveTimerRef.current);
      }
    };
  }, [
    activeTab,
    auditRecords,
    appointmentRecords,
    activityFilter,
    caseRecords,
    caseStatusFilter,
    caseTypeFilter,
    caseTypeRecords,
    caseView,
    clientRecords,
    consentFilter,
    dismissedNotificationIds,
    documentRecords,
    noteRecords,
    organizationRecords,
    priorityFilter,
    reportEndDate,
    reportStartDate,
    referralRecords,
    riskFilter,
    savedViewId,
    selectedCaseId,
    selectedClientId,
    serverPersistenceReady,
    taskRecords,
    taskView,
    timelineRecords,
    wikiIngestionRecords,
    token,
    workerFilter,
  ]);

  const buildReportPayload = (title: string): Record<string, unknown> => {
    const generatedAt = new Date().toISOString();
    const clientName = (clientId: string) => clientRecords.find((client) => client.id === clientId)?.fullName ?? clientId;
    const caseTitle = (caseId: string) => caseRecords.find((caseItem) => caseItem.id === caseId)?.title ?? caseId;
    const openCaseRecords = caseRecords.filter((caseItem) => !['closed', 'archived'].includes(caseItem.status));
    const visibleCaseRecords = searchableCases.filter((caseItem) =>
      recordTouchesReportRange(caseItem.openedDate, caseItem.targetResolutionDate, caseItem.nextFollowUp, caseItem.closedDate),
    );
    const visibleOpenCaseRecords = visibleCaseRecords.filter((caseItem) => !['closed', 'archived'].includes(caseItem.status));
    const visibleTaskRecords = taskRecords.filter((task) =>
      relatedRecordMatchesFilters(task.clientId, task.caseId) && recordTouchesReportRange(task.dueDate, task.completedAt),
    );
    const visibleNoteRecords = noteRecords.filter((note) => relatedRecordMatchesFilters(note.clientId, note.caseId) && isWithinReportRange(note.timestamp));
    const visibleReferralRecords = referralRecords.filter((referral) =>
      relatedRecordMatchesFilters(referral.clientId, referral.caseId) && recordTouchesReportRange(referral.referralDate, referral.appointmentDate),
    );
    const visibleAppointmentRecords = appointmentRecords.filter((appointment) =>
      relatedRecordMatchesFilters(appointment.clientId, appointment.caseId) && isWithinReportRange(appointment.dateTime),
    );
    const visibleDocumentRecords = documentRecords.filter((document) =>
      relatedRecordMatchesFilters(document.clientId, document.caseId) && recordTouchesReportRange(document.uploadedAt, document.expiresAt),
    );
    const visibleTimelineRecords = timelineRecords.filter((event) =>
      relatedRecordMatchesFilters(event.clientId, event.caseId) && isWithinReportRange(event.occurredAt),
    );
    const visibleAuditRecords = auditRecords.filter((event) => isWithinReportRange(event.timestamp));
    const reportBase = {
      report: title,
      generatedAt,
      generatedBy: 'Current worker',
      workspace: 'Street Voices Case Management',
      dateRange: {
        label: reportRangeLabel,
        start: reportStartDate || null,
        end: reportEndDate || null,
      },
      totals: {
        clients: clientRecords.length,
        cases: caseRecords.length,
        openCases: openCaseRecords.length,
        tasks: taskRecords.length,
        referrals: referralRecords.length,
        appointments: appointmentRecords.length,
        documents: documentRecords.length,
        organizations: organizationRecords.length,
        caseTypes: caseTypeRecords.length,
        notifications: visibleNotifications.length,
      },
      visibleScope: {
        clients: searchableClients.length,
        cases: visibleCaseRecords.length,
        savedView: savedViewId,
      },
      appliedFilters: {
        search: searchQuery.trim() || null,
        risk: riskFilter,
        worker: workerFilter,
        caseStatus: caseStatusFilter,
        caseType: caseTypeFilter,
        priority: priorityFilter,
        consent: consentFilter,
        activity: activityFilter,
      },
    };

    if (title === 'Caseload report') {
      return {
        ...reportBase,
        rows: visibleOpenCaseRecords.map((caseItem) => ({
          caseId: caseItem.caseId,
          title: caseItem.title,
          client: clientName(caseItem.clientId),
          worker: caseItem.assignedStaff,
          team: caseItem.assignedTeam,
          type: caseItem.type,
          status: caseItem.status,
          priority: caseItem.priority,
          openedDate: caseItem.openedDate,
          targetResolutionDate: caseItem.targetResolutionDate,
          nextFollowUp: caseItem.nextFollowUp,
          nextAction: caseItem.nextAction,
        })),
      };
    }

    if (title === 'Case outcome report') {
      return {
        ...reportBase,
        rows: visibleCaseRecords.map((caseItem) => ({
          caseId: caseItem.caseId,
          title: caseItem.title,
          client: clientName(caseItem.clientId),
          status: caseItem.status,
          closureReason: caseItem.closureReason ?? 'Not closed',
          openedDate: caseItem.openedDate,
          closedDate: caseItem.closedDate ?? null,
          goals: caseItem.goals,
          barriers: caseItem.barriers,
        })),
      };
    }

    if (title === 'Overdue follow-up report') {
      return {
        ...reportBase,
        rows: {
          tasks: overdueTasks.filter((task) => relatedRecordMatchesFilters(task.clientId, task.caseId)).map((task) => ({
            title: task.title,
            client: clientName(task.clientId),
            case: caseTitle(task.caseId),
            owner: task.owner,
            dueDate: task.dueDate,
            priority: task.priority,
            status: task.status,
            dependency: task.dependency,
          })),
          cases: visibleCaseRecords
            .filter((caseItem) => caseItem.status !== 'closed' && isOverdue(caseItem.nextFollowUp))
            .map((caseItem) => ({
              caseId: caseItem.caseId,
              title: caseItem.title,
              client: clientName(caseItem.clientId),
              nextFollowUp: caseItem.nextFollowUp,
              nextAction: caseItem.nextAction,
            })),
          appointments: visibleAppointmentRecords
            .filter((appointment) => appointment.attendanceStatus === 'scheduled' && isOverdue(appointment.dateTime))
            .map((appointment) => ({
              purpose: appointment.purpose,
              client: clientName(appointment.clientId),
              case: caseTitle(appointment.caseId),
              dateTime: appointment.dateTime,
              location: appointment.location,
            })),
        },
      };
    }

    if (title === 'Referral status report') {
      return {
        ...reportBase,
        rows: visibleReferralRecords.map((referral) => ({
          organization: referral.organization,
          category: referral.serviceCategory,
          client: clientName(referral.clientId),
          case: caseTitle(referral.caseId),
          referralDate: referral.referralDate,
          status: referral.status,
          contactPerson: referral.contactPerson,
          contact: referral.contact,
          appointmentDate: referral.appointmentDate,
          outcome: referral.outcome,
          followUpRequired: referral.followUpRequired,
          supportingDocuments: referral.supportingDocuments,
        })),
      };
    }

    if (title === 'Staff activity report') {
      const actors = Array.from(new Set([
        ...caseRecords.map((caseItem) => caseItem.assignedStaff),
        ...taskRecords.map((task) => task.owner),
        ...noteRecords.map((note) => note.author),
        ...auditRecords.map((event) => event.actor),
      ]));
      return {
        ...reportBase,
        rows: actors.map((actor) => ({
          actor,
          assignedCases: caseRecords.filter((caseItem) => caseItem.assignedStaff === actor).length,
          ownedTasks: visibleTaskRecords.filter((task) => task.owner === actor).length,
          notesWritten: visibleNoteRecords.filter((note) => note.author === actor).length,
          auditEvents: visibleAuditRecords.filter((event) => event.actor === actor).length,
        })),
      };
    }

    return {
      ...reportBase,
      rows: {
        clients: searchableClients,
        cases: visibleCaseRecords,
        tasks: visibleTaskRecords,
        notes: visibleNoteRecords,
        referrals: visibleReferralRecords,
        appointments: visibleAppointmentRecords,
        documents: visibleDocumentRecords,
        organizations: organizationRecords,
        caseTypes: caseTypeRecords,
        timeline: visibleTimelineRecords,
        audit: visibleAuditRecords,
        notifications: visibleNotifications,
      },
    };
  };

  const exportReport = (title: string) => {
    const payload = buildReportPayload(title);
    downloadJson(`street-voices-${normalize(title).replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`, payload);
    addAuditEvent({
      actor: 'Current worker',
      action: 'exported report',
      object: title,
    });
    setDraftNotice(`${title} exported as JSON.`);
  };

  const exportWorkspace = () => {
    const snapshot = {
      ...createDraftSnapshot(),
      clients: clientRecords,
      referrals: referralRecords,
      appointments: appointmentRecords,
      timelineEvents: timelineRecords,
      caseTypes: caseTypeRecords,
      organizations: organizationRecords,
      auditEvents: auditRecords,
      notifications: visibleNotifications,
      botAlerts,
      exportedFrom: 'Street Voices Case Management',
    };
    downloadJson(`street-voices-case-management-${new Date().toISOString().slice(0, 10)}.json`, snapshot);
    addAuditEvent({
      actor: 'Current worker',
      action: 'exported workspace',
      object: 'Case Management JSON',
    });
    setDraftNotice('Case management workspace exported as JSON.');
  };

  const importWorkspace = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const draft = parseCaseManagementDraft(JSON.parse(await file.text()));
      if (!draft) throw new Error('Invalid case management export');
      setClientRecords(draft.clientRecords);
      setCaseRecords(draft.caseRecords);
      setTaskRecords(draft.taskRecords);
      setNoteRecords(draft.noteRecords);
      setReferralRecords(draft.referralRecords);
      setAppointmentRecords(draft.appointmentRecords);
      setDocumentRecords(draft.documentRecords);
      setTimelineRecords(draft.timelineRecords);
      setWikiIngestionRecords(draft.wikiIngestionRecords);
      setCaseTypeRecords(draft.caseTypeRecords);
      setOrganizationRecords(draft.organizationRecords);
      setAuditRecords([
        {
          id: `audit-${Date.now()}`,
          actor: 'Current worker',
          action: 'imported workspace',
          object: file.name,
          timestamp: new Date().toISOString(),
        },
        ...draft.auditRecords,
      ]);
      setActiveTab(draft.activeTab ?? 'overview');
      setCaseView(draft.caseView ?? 'table');
      setTaskView(draft.taskView ?? 'my');
      setRiskFilter(draft.riskFilter ?? 'all');
      setWorkerFilter(draft.workerFilter ?? 'all');
      setCaseStatusFilter(draft.caseStatusFilter ?? 'all');
      setCaseTypeFilter(draft.caseTypeFilter ?? 'all');
      setPriorityFilter(draft.priorityFilter ?? 'all');
      setConsentFilter(draft.consentFilter ?? 'all');
      setActivityFilter(draft.activityFilter ?? 'all');
      setSavedViewId(draft.savedViewId ?? 'all');
      setReportStartDate(draft.reportStartDate ?? '');
      setReportEndDate(draft.reportEndDate ?? '');
      setDismissedNotificationIds(draft.dismissedNotificationIds ?? []);
      setSelectedClientId(draft.selectedClientId ?? draft.clientRecords[0]?.id ?? initialClients[0].id);
      setSelectedCaseId(draft.selectedCaseId ?? draft.caseRecords[0]?.id ?? initialCases[0].id);
      setDraftNotice(`Imported ${file.name}. Changes will sync to Street Voices.`);
    } catch {
      setDraftNotice('Import failed. Choose a Street Voices case management JSON export.');
    } finally {
      event.target.value = '';
    }
  };

  const resetWorkspace = () => {
    setClientRecords(initialClients);
    setCaseRecords(initialCases);
    setTaskRecords(initialTasks);
    setNoteRecords(caseManagementSeedNotes);
    setReferralRecords(initialReferrals);
    setAppointmentRecords(initialAppointments);
    setDocumentRecords(initialDocuments);
    setTimelineRecords(caseManagementSeedTimelineEvents);
    setWikiIngestionRecords([]);
    setCaseTypeRecords(initialCaseTypes);
    setOrganizationRecords(initialOrganizations);
    setAuditRecords([
      {
        id: `audit-${Date.now()}`,
        actor: 'Current worker',
        action: 'reset workspace',
        object: 'Case Management starter data',
        timestamp: new Date().toISOString(),
      },
      ...initialAuditEvents,
    ]);
    setSelectedClientId(initialClients[0].id);
    setSelectedCaseId(initialCases[0].id);
    handleTabChange('overview');
    setCaseView('table');
    setTaskView('my');
    setRiskFilter('all');
    setWorkerFilter('all');
    setCaseStatusFilter('all');
    setCaseTypeFilter('all');
    setPriorityFilter('all');
    setConsentFilter('all');
    setActivityFilter('all');
    setSavedViewId('all');
    setReportStartDate('');
    setReportEndDate('');
    setDismissedNotificationIds([]);
    setClientIntake(emptyClientIntake);
    setClientIntakeOpen(false);
    setProfileAction(null);
    setCaseQuickDraft(emptyCaseQuickDraft);
    setReferralQuickDraft(emptyReferralQuickDraft);
    setAppointmentQuickDraft(emptyAppointmentQuickDraft);
    setCaseTypeDraft(emptyCaseTypeDraft);
    setOrganizationDraft(emptyOrganizationDraft);
    setWikiIngestStatus('');
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CASE_MANAGEMENT_STORAGE_KEY);
    }
    setDraftNotice('Case management workspace reset to the starter data.');
  };

  const addDocumentsFromFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const uploadedAt = new Date().toISOString();
    const records: DocumentRecord[] = Array.from(files).map((file, index) => ({
      id: `doc-${Date.now()}-${index}`,
      clientId: selectedClient.id,
      caseId: selectedCase.id,
      name: file.name,
      type: file.name.split('.').pop()?.toUpperCase() || file.type || 'FILE',
      tag: 'Field upload',
      uploadedAt,
      permission: 'team',
      searchableText: 'Pending OCR and searchable text extraction.',
    }));
    setDocumentRecords((current) => [...records, ...current]);
    addTimelineEvent({
      clientId: selectedClient.id,
      caseId: selectedCase.id,
      type: 'document uploaded',
      title: `${records.length} document${records.length === 1 ? '' : 's'} uploaded`,
      detail: records.map((record) => record.name).join(', '),
    });
    addAuditEvent({
      actor: selectedCase.assignedStaff,
      action: `uploaded ${records.length} document${records.length === 1 ? '' : 's'}`,
      object: selectedCase.caseId,
    });
    handleTabChange('documents');
    setDraftNotice(`${records.length} document${records.length === 1 ? '' : 's'} added to the local draft catalog.`);
  };

  const ingestWikiFiles = async (files: FileList | File[] | null, context: WikiIngestContext) => {
    if (!files?.length) return false;
    if (!token) {
      setWikiIngestStatus('Sign in before ingesting files into the Case Wiki.');
      setDraftNotice('Case Wiki ingestion needs a Street Voices session.');
      return false;
    }

    const uploadedFiles = Array.from(files);
    const formData = new FormData();
    uploadedFiles.forEach((file) => formData.append('files', file));
    Object.entries(context).forEach(([key, value]) => {
      if (value) formData.append(key, value);
    });

    setWikiIngesting(true);
    setWikiIngestStatus(`Ingesting ${uploadedFiles.length} file${uploadedFiles.length === 1 ? '' : 's'} into the Case Wiki...`);

    try {
      const response = await fetch(CASE_MANAGEMENT_WIKI_INGEST_PATH, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) throw new Error(`Upload failed with ${response.status}`);

      const payload = (await response.json()) as {
        wikiIngestionRecords?: WikiIngestionRecord[];
        generatedRecords?: {
          noteRecords?: NoteRecord[];
          documentRecords?: DocumentRecord[];
          timelineRecords?: TimelineEvent[];
        };
        neo4j?: Array<{ status?: string; message?: string; skippedReason?: string }>;
      };
      const incomingWikiRecords = payload.wikiIngestionRecords ?? [];
      const incomingNotes = payload.generatedRecords?.noteRecords ?? [];
      const incomingDocuments = payload.generatedRecords?.documentRecords ?? [];
      const incomingTimeline = payload.generatedRecords?.timelineRecords ?? [];

      setWikiIngestionRecords((records) => mergeById(records, incomingWikiRecords));
      setNoteRecords((records) => mergeById(records, incomingNotes));
      setDocumentRecords((records) => mergeById(records, incomingDocuments));
      setTimelineRecords((records) => mergeById(records, incomingTimeline));

      const firstIngestion = incomingWikiRecords[0];
      if (firstIngestion?.pageId) {
        setSelectedWikiPageId(firstIngestion.pageId);
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          params.set('page', firstIngestion.pageId);
          window.history.replaceState(null, '', `/case-management/knowledge?${params.toString()}`);
        }
      }

      const graphStatuses = Array.from(new Set((payload.neo4j ?? []).map((item) => item.status ?? 'unknown')));
      const graphLabel = graphStatuses.length ? graphStatuses.join(', ') : 'not reported';
      setWikiIngestStatus(`Ingested ${incomingWikiRecords.length} file${incomingWikiRecords.length === 1 ? '' : 's'}. Neo4j status: ${graphLabel}.`);
      setDraftNotice(`Case Wiki generated ${incomingWikiRecords.length} source page${incomingWikiRecords.length === 1 ? '' : 's'} from uploaded files.`);
      addAuditEvent({
        actor: 'Case Wiki ingestion',
        action: `ingested ${incomingWikiRecords.length} wiki source file${incomingWikiRecords.length === 1 ? '' : 's'}`,
        object: context.clientName || context.caseTitle || context.serviceName || 'Case Wiki',
      });
      return true;
    } catch {
      setWikiIngestStatus('File ingestion failed. The current wiki remains unchanged.');
      setDraftNotice('Case Wiki ingestion failed; try again or check the server logs.');
      return false;
    } finally {
      setWikiIngesting(false);
    }
  };

  const panelStyle = {
    ...glassCard,
    borderRadius: 8,
    padding: 18,
  } satisfies React.CSSProperties;

  const surfaceStyle = {
    ...glassSurface,
    borderRadius: 8,
    padding: 14,
  } satisfies React.CSSProperties;

  const buttonStyle = {
    ...glassButton,
    borderRadius: 8,
    padding: '9px 12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 700,
  } satisfies React.CSSProperties;

  const primaryButtonStyle = {
    ...accentButton,
    borderRadius: 8,
    padding: '10px 14px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 750,
  } satisfies React.CSSProperties;

  const routeLinkStyle = {
    color: colors.text,
    fontWeight: 800,
    textDecoration: 'none',
    borderBottom: `1px solid ${colors.accent}`,
  } satisfies React.CSSProperties;

  const wikiRouteLinkStyle = {
    color: '#174ea6',
    fontWeight: 800,
    textDecoration: 'none',
    borderBottom: '1px solid rgba(23, 78, 166, 0.35)',
  } satisfies React.CSSProperties;

  const openInAppStyle = {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: 750,
    textDecoration: 'none',
  } satisfies React.CSSProperties;

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    if (typeof window !== 'undefined') {
      const nextPath = tabId === 'overview' ? '/case-management' : `/case-management/${tabId}`;
      window.history.replaceState(null, '', nextPath);
    }
  };

  const renderProfileLink = (name: string, label = name, style: React.CSSProperties = routeLinkStyle) => (
    <a href={profilePathForName(name)} style={style} onClick={(event) => event.stopPropagation()}>
      {label}
    </a>
  );

  const renderDirectoryLink = (organization: string, label = organization, style: React.CSSProperties = routeLinkStyle) => (
    <a href={directoryPathForOrganization(organization)} style={style} onClick={(event) => event.stopPropagation()}>
      {label}
    </a>
  );

  return (
    <div
      style={{
        minHeight: '100%',
        padding: '24px clamp(16px, 4vw, 40px) 44px',
        color: colors.text,
        fontFamily: 'Rubik, system-ui, sans-serif',
        background: isDark
          ? 'linear-gradient(180deg, rgba(18, 18, 18, 0.96) 0%, rgba(12, 12, 12, 0.98) 100%)'
          : 'linear-gradient(180deg, rgba(248, 250, 252, 0.96) 0%, rgba(239, 246, 255, 0.72) 100%)',
      }}
    >
      <div style={{ maxWidth: 1480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <header
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
            gap: 18,
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <img
              src="/images/sidebar-icons/case-management-suitcase.svg"
              alt=""
              width={54}
              height={54}
              style={{
                width: 54,
                height: 54,
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: colors.cardBg,
                padding: 10,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: '0 0 5px', color: colors.textSecondary, fontSize: 13 }}>Street Voices operations</p>
              <h1 style={{ margin: 0, color: colors.text, fontSize: 34, lineHeight: 1.12, fontWeight: 850 }}>
                Case Management
              </h1>
              <p style={{ margin: '8px 0 0', color: colors.textSecondary, fontSize: 14, maxWidth: 760 }}>
                Track clients, cases, notes, tasks, referrals, documents, appointments, outcomes, and Street Bot support in one field-ready workspace.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" style={buttonStyle} onClick={exportWorkspace} {...buttonHoverHandlers}>
              <Download size={16} />
              Export
            </button>
            <button type="button" style={buttonStyle} onClick={() => importInputRef.current?.click()} {...buttonHoverHandlers}>
              <Upload size={16} />
              Import
            </button>
            <button
              type="button"
              style={primaryButtonStyle}
              onClick={() => {
                handleTabChange('clients');
                setClientIntakeOpen(true);
                setDraftNotice('Client intake is open. Creating a client also creates an intake case and follow-up task.');
              }}
              {...accentButtonHoverHandlers}
            >
              <UserPlus size={16} />
              Add client
            </button>
          </div>
        </header>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          onChange={importWorkspace}
          style={{ display: 'none' }}
        />
        <input
          ref={documentInputRef}
          type="file"
          multiple
          onChange={(event) => {
            addDocumentsFromFiles(event.target.files);
            event.target.value = '';
          }}
          style={{ display: 'none' }}
        />
        <div
          role="status"
          style={{
            ...surfaceStyle,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            color: colors.textSecondary,
            fontSize: 13,
          }}
        >
          <ShieldCheck size={16} color={colors.accent} />
          {draftNotice}
        </div>

        <nav
          aria-label="Case management sections"
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 2,
          }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                style={{
                  ...buttonStyle,
                  background: selected ? colors.accent : colors.surface,
                  color: selected ? '#000' : colors.text,
                  borderColor: selected ? colors.accent : colors.border,
                  whiteSpace: 'nowrap',
                  flex: '0 0 auto',
                }}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12 }}>
          <label
            style={{
              ...glassInput,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
            }}
          >
            <Search size={18} color={colors.textMuted} />
            <input
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                markFiltersCustom();
              }}
              placeholder="Search clients, cases, notes, referrals, documents"
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: colors.text,
                fontSize: 14,
              }}
            />
          </label>
          <label
            style={{
              ...glassInput,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
            }}
          >
            <Filter size={18} color={colors.textMuted} />
            <select
              value={riskFilter}
              onChange={(event) => {
                setRiskFilter(event.target.value as 'all' | RiskLevel);
                markFiltersCustom();
              }}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: colors.text,
                fontSize: 14,
              }}
            >
              <option value="all">All risk levels</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>
        {renderFilterBar()}

        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'knowledge' && renderKnowledge()}
        {activeTab === 'clients' && renderClients()}
        {activeTab === 'cases' && renderCases()}
        {activeTab === 'tasks' && renderTasks()}
        {activeTab === 'calendar' && renderCalendar()}
        {activeTab === 'referrals' && renderReferrals()}
        {activeTab === 'documents' && renderDocuments()}
        {activeTab === 'reports' && renderReports()}
        {activeTab === 'settings' && renderSettings()}
      </div>
    </div>
  );

  function renderFilterBar() {
    const fieldStyle = {
      ...glassInput,
      borderRadius: 8,
      padding: '9px 10px',
      color: colors.text,
      width: '100%',
    } satisfies React.CSSProperties;
    const labelStyle = { display: 'grid', gap: 6, color: colors.textMuted, fontSize: 12, fontWeight: 700 } satisfies React.CSSProperties;
    const savedViews: Array<{ id: SavedViewId; label: string; detail: string }> = [
      { id: 'all', label: 'All work', detail: 'Full workspace' },
      { id: 'urgent', label: 'Urgent work', detail: 'Urgent priority cases' },
      { id: 'today', label: 'Today', detail: 'Follow-ups due today' },
      { id: 'stale', label: 'No contact', detail: '14 days without contact' },
      { id: 'documents', label: 'Expiring docs', detail: 'Documents due soon' },
      { id: 'referrals', label: 'Referrals', detail: 'Needs partner follow-up' },
    ];
    const caseStatuses: Array<'all' | CaseStatus> = [
      'all',
      'intake',
      'active',
      'pending documents',
      'awaiting partner response',
      'follow-up needed',
      'on hold',
      'resolved',
      'closed',
      'archived',
    ];

    return (
      <section style={{ ...surfaceStyle, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <strong style={{ display: 'block', color: colors.text }}>Saved views and filters</strong>
            <span style={{ display: 'block', marginTop: 4, color: colors.textMuted, fontSize: 12 }}>
              {searchableClients.length} client{searchableClients.length === 1 ? '' : 's'} · {searchableCases.length} case{searchableCases.length === 1 ? '' : 's'} visible · {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}
            </span>
          </div>
          <button type="button" style={{ ...buttonStyle, padding: '7px 10px' }} onClick={clearFilters} {...buttonHoverHandlers}>
            <X size={14} />
            Clear filters
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {savedViews.map((view) => {
            const selected = savedViewId === view.id;
            return (
              <button
                type="button"
                key={view.id}
                onClick={() => applySavedView(view.id)}
                style={{
                  ...buttonStyle,
                  padding: '7px 10px',
                  background: selected ? colors.accent : colors.surface,
                  color: selected ? '#000' : colors.text,
                  alignItems: 'flex-start',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <span>{view.label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: selected ? 'rgba(0,0,0,0.72)' : colors.textMuted }}>{view.detail}</span>
              </button>
            );
          })}
          {savedViewId === 'custom' && (
            <span style={{ color: colors.textSecondary, background: colors.surface, borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 700 }}>
              Custom view
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 10 }}>
          <label style={labelStyle}>
            Worker
            <select
              value={workerFilter}
              onChange={(event) => {
                setWorkerFilter(event.target.value);
                markFiltersCustom();
              }}
              style={fieldStyle}
            >
              <option value="all">All workers</option>
              {workerOptions.map((worker) => (
                <option key={worker} value={worker}>{worker}</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Case status
            <select
              value={caseStatusFilter}
              onChange={(event) => {
                setCaseStatusFilter(event.target.value as 'all' | CaseStatus);
                markFiltersCustom();
              }}
              style={fieldStyle}
            >
              {caseStatuses.map((status) => (
                <option key={status} value={status}>{status === 'all' ? 'All statuses' : status}</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Case type
            <select
              value={caseTypeFilter}
              onChange={(event) => {
                setCaseTypeFilter(event.target.value);
                markFiltersCustom();
              }}
              style={fieldStyle}
            >
              <option value="all">All case types</option>
              {caseTypeOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Priority
            <select
              value={priorityFilter}
              onChange={(event) => {
                setPriorityFilter(event.target.value as 'all' | Priority);
                markFiltersCustom();
              }}
              style={fieldStyle}
            >
              <option value="all">All priorities</option>
              {(['urgent', 'high', 'medium', 'low'] as const).map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Consent
            <select
              value={consentFilter}
              onChange={(event) => {
                setConsentFilter(event.target.value as 'all' | ClientRecord['consentStatus']);
                markFiltersCustom();
              }}
              style={fieldStyle}
            >
              <option value="all">All consent statuses</option>
              {(['signed', 'pending', 'expired'] as const).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Activity
            <select
              value={activityFilter}
              onChange={(event) => {
                setActivityFilter(event.target.value as ActivityFilter);
                markFiltersCustom();
              }}
              style={fieldStyle}
            >
              <option value="all">All activity</option>
              <option value="follow-up today">Follow-up today</option>
              <option value="overdue follow-up">Overdue follow-up</option>
              <option value="no contact 14 days">No contact in 14 days</option>
              <option value="document expiring">Document expiring</option>
              <option value="unresolved referral">Unresolved referral</option>
            </select>
          </label>
        </div>
      </section>
    );
  }

  function renderKnowledge() {
    type WikiPage = {
      id: string;
      kind: 'Client' | 'Case' | 'Service' | 'Workflow' | 'Ingested file';
      title: string;
      subtitle: string;
      updatedAt: string;
      summary: string;
      clientId?: string;
      caseId?: string;
      organizationName?: string;
      caseTypeName?: string;
      ingestionId?: string;
    };

    const wikiPages: WikiPage[] = [
      ...clientRecords.map((client) => ({
        id: `client:${client.id}`,
        kind: 'Client' as const,
        title: client.fullName,
        subtitle: `${client.clientId} · ${client.assignedWorker}`,
        updatedAt: client.latestContact,
        summary: `${client.serviceHistory}. Current risk is ${client.riskLevel}; next follow-up is ${formatDateTime(client.nextFollowUp)}.`,
        clientId: client.id,
      })),
      ...caseRecords.map((caseItem) => {
        const client = clientRecords.find((candidate) => candidate.id === caseItem.clientId);
        return {
          id: `case:${caseItem.id}`,
          kind: 'Case' as const,
          title: caseItem.title,
          subtitle: `${caseItem.caseId} · ${client?.fullName ?? 'No client'} · ${caseItem.assignedStaff}`,
          updatedAt: caseItem.nextFollowUp,
          summary: caseItem.summary,
          clientId: caseItem.clientId,
          caseId: caseItem.id,
        };
      }),
      ...organizationRecords.map((organization) => ({
        id: `service:${organization.id}`,
        kind: 'Service' as const,
        title: organization.name,
        subtitle: `${organization.serviceCategories.join(', ')} · ${organization.contactPerson}`,
        updatedAt: `${organization.averageTurnaroundDays} day turnaround`,
        summary: `${organization.eligibility} ${organization.notes}`,
        organizationName: organization.name,
      })),
      ...caseTypeRecords.map((caseType) => ({
        id: `workflow:${caseType.id}`,
        kind: 'Workflow' as const,
        title: caseType.name,
        subtitle: `${caseType.workflow.length} workflow steps`,
        updatedAt: 'Workflow library',
        summary: caseType.successCriteria,
        caseTypeName: caseType.name,
      })),
      ...wikiIngestionRecords.map((ingestion) => ({
        id: ingestion.pageId || `ingest:${ingestion.id}`,
        kind: 'Ingested file' as const,
        title: ingestion.title || ingestion.fileName,
        subtitle: `${ingestion.fileName} · ${ingestion.extractionStatus} · Neo4j ${ingestion.graphStatus}`,
        updatedAt: ingestion.uploadedAt,
        summary: ingestion.summary,
        clientId: ingestion.linkedClientId,
        caseId: ingestion.linkedCaseId,
        organizationName: ingestion.linkedServiceName,
        ingestionId: ingestion.id,
      })),
    ];
    const selectedPage = wikiPages.find((page) => page.id === selectedWikiPageId) ?? wikiPages[0];
    const selectedIngestion = selectedPage?.ingestionId
      ? wikiIngestionRecords.find((ingestion) => ingestion.id === selectedPage.ingestionId)
      : null;
    const selectedPageClient = selectedPage?.clientId ? clientRecords.find((client) => client.id === selectedPage.clientId) : null;
    const selectedPageCase = selectedPage?.caseId ? caseRecords.find((caseItem) => caseItem.id === selectedPage.caseId) : null;
    const selectedPageOrganization = selectedPage?.organizationName
      ? organizationRecords.find((organization) => organization.name === selectedPage.organizationName)
      : null;
	    const selectedPageWorkflow = selectedPage?.caseTypeName
	      ? caseTypeRecords.find((caseType) => caseType.name === selectedPage.caseTypeName)
	      : null;
	    const selectedPageCaseClient = selectedPageCase
	      ? clientRecords.find((client) => client.id === selectedPageCase.clientId)
	      : null;
	    const selectedWikiClient = selectedPageClient ?? selectedPageCaseClient ?? null;
	    const selectedClientWiki = selectedWikiClient
	      ? clientWikiProfiles.find((profile) => profile.clientId === selectedWikiClient.id)
	      : null;
	    const linkedCases = selectedPageClient
	      ? caseRecords.filter((caseItem) => caseItem.clientId === selectedPageClient.id)
      : selectedPageWorkflow
        ? caseRecords.filter((caseItem) => caseItem.type === selectedPageWorkflow.name)
        : selectedPageCase
          ? [selectedPageCase]
          : [];
    const linkedNotes = noteRecords.filter((note) =>
      (selectedPageClient && note.clientId === selectedPageClient.id) ||
      (selectedPageCase && note.caseId === selectedPageCase.id) ||
      (selectedIngestion && selectedIngestion.noteId === note.id) ||
      (selectedPageWorkflow && linkedCases.some((caseItem) => caseItem.id === note.caseId)),
    );
    const linkedReferrals = referralRecords.filter((referral) =>
      (selectedPageClient && referral.clientId === selectedPageClient.id) ||
      (selectedPageCase && referral.caseId === selectedPageCase.id) ||
      (selectedPageOrganization && referral.organization === selectedPageOrganization.name) ||
      (selectedPageWorkflow && linkedCases.some((caseItem) => caseItem.id === referral.caseId)),
    );
    const linkedDocuments = documentRecords.filter((document) =>
      (selectedPageClient && document.clientId === selectedPageClient.id) ||
      (selectedPageCase && document.caseId === selectedPageCase.id) ||
      (selectedIngestion && selectedIngestion.documentId === document.id) ||
      (selectedPageWorkflow && linkedCases.some((caseItem) => caseItem.id === document.caseId)),
    );
	    const linkedTimeline = timelineRecords.filter((event) =>
	      (selectedPageClient && event.clientId === selectedPageClient.id) ||
	      (selectedPageCase && event.caseId === selectedPageCase.id) ||
	      (selectedIngestion && selectedIngestion.timelineId === event.id) ||
	      (selectedPageWorkflow && linkedCases.some((caseItem) => caseItem.id === event.caseId)),
	    );
	    const sortedLinkedNotes = [...linkedNotes].sort((first, second) => toDate(second.timestamp).getTime() - toDate(first.timestamp).getTime());
	    const sortedLinkedTimeline = [...linkedTimeline].sort(
	      (first, second) => toDate(second.occurredAt).getTime() - toDate(first.occurredAt).getTime(),
	    );
	    const linkedTimelineDates = sortedLinkedTimeline
	      .map((event) => toDate(event.occurredAt).getTime())
	      .filter((timestamp) => Number.isFinite(timestamp));
	    const timelineStart = linkedTimelineDates.length ? new Date(Math.min(...linkedTimelineDates)).toISOString() : null;
	    const timelineEnd = linkedTimelineDates.length ? new Date(Math.max(...linkedTimelineDates)).toISOString() : null;
    const pageGroups = [
      ['Clients', wikiPages.filter((page) => page.kind === 'Client')],
      ['Cases', wikiPages.filter((page) => page.kind === 'Case')],
      ['Services', wikiPages.filter((page) => page.kind === 'Service')],
      ['Workflows', wikiPages.filter((page) => page.kind === 'Workflow')],
      ['Ingested files', wikiPages.filter((page) => page.kind === 'Ingested file')],
    ] as const;
    const selectedPageLiveHref = selectedPageClient
      ? profilePathForName(selectedPageClient.fullName)
      : selectedPageOrganization
        ? directoryPathForOrganization(selectedPageOrganization.name)
        : null;
    const ingestContextCase = selectedPageCase ?? linkedCases[0] ?? selectedCase;
    const ingestContextClient =
      selectedWikiClient ??
      (ingestContextCase ? clientRecords.find((client) => client.id === ingestContextCase.clientId) : null) ??
      selectedClient;
    const wikiIngestContext: WikiIngestContext = {
      clientId: ingestContextClient?.id,
      clientName: ingestContextClient?.fullName,
      caseId: ingestContextCase?.id,
      caseTitle: ingestContextCase?.title,
      serviceName: selectedPageOrganization?.name,
      pageId: selectedPage?.id,
    };
    const handleWikiIngestFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.currentTarget.files ?? []);
      setWikiIngestPendingFiles(files);
      setWikiIngestStatus(
        files.length
          ? `${files.length} file${files.length === 1 ? '' : 's'} ready for Case Wiki ingestion.`
          : 'Choose one or more files before ingesting into the Case Wiki.',
      );
    };
    const handleWikiIngestDrop = (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setWikiIngestDragActive(false);
      const files = Array.from(event.dataTransfer.files ?? []);
      if (!files.length) {
        setWikiIngestStatus('Drop one or more files before ingesting into the Case Wiki.');
        return;
      }
      setWikiIngestPendingFiles(files);
      setWikiIngestStatus(`${files.length} file${files.length === 1 ? '' : 's'} ready for Case Wiki ingestion.`);
    };
    const submitWikiIngestModal = async () => {
      const pastedText = wikiIngestText.trim();
      let filesToIngest = wikiIngestPendingFiles;

      if (!filesToIngest.length && pastedText) {
        const sourceBaseName =
          wikiIngestSourceName
            .trim()
            .replace(/[^a-z0-9-_]+/gi, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 64) || `case-wiki-pasted-source-${new Date().toISOString().slice(0, 10)}`;
        filesToIngest = [
          new File([pastedText], `${sourceBaseName}.txt`, {
            type: 'text/plain',
          }),
        ];
      }

      if (!filesToIngest.length) {
        setWikiIngestStatus('Choose files, drop files here, or paste source text before ingesting into the Case Wiki.');
        return;
      }
      const ingested = await ingestWikiFiles(filesToIngest, wikiIngestContext);
      if (ingested) {
        setWikiIngestPendingFiles([]);
        setWikiIngestDragActive(false);
        setWikiIngestText('');
        setWikiIngestSourceName('');
        if (wikiIngestHeroInputRef.current) {
          wikiIngestHeroInputRef.current.value = '';
        }
        if (wikiIngestInputRef.current) {
          wikiIngestInputRef.current.value = '';
        }
      }
    };
    const clearWikiIngestDraft = () => {
      setWikiIngestPendingFiles([]);
      setWikiIngestDragActive(false);
      setWikiIngestText('');
      setWikiIngestSourceName('');
      setWikiIngestStatus('');
      if (wikiIngestHeroInputRef.current) {
        wikiIngestHeroInputRef.current.value = '';
      }
      if (wikiIngestInputRef.current) {
        wikiIngestInputRef.current.value = '';
      }
    };
    const hasWikiIngestDraft = wikiIngestPendingFiles.length > 0 || Boolean(wikiIngestText.trim());

    return (
      <>
      <section style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'start' }}>
          <span>
            <SectionTitle icon={Sparkles} title="Case Wiki" />
            <p style={{ margin: '8px 0 0', color: colors.textSecondary, fontSize: 13, maxWidth: 820 }}>
              Wikipedia-style case notes, live source records, linked Street Profiles, and directory services for the current Case Management workspace.
            </p>
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ ...surfaceStyle, padding: '7px 10px', color: colors.textSecondary, fontSize: 12, fontWeight: 800 }}>
              {wikiPages.length} wiki pages
            </span>
            <span style={{ ...surfaceStyle, padding: '7px 10px', color: colors.textSecondary, fontSize: 12, fontWeight: 800 }}>
              {noteRecords.length} source notes
            </span>
            <span style={{ ...surfaceStyle, padding: '7px 10px', color: colors.textSecondary, fontSize: 12, fontWeight: 800 }}>
              {wikiIngestionRecords.length} ingested files
            </span>
            <div
              data-testid="case-wiki-ingest-button"
              style={{
                ...surfaceStyle,
                alignItems: 'center',
                display: 'flex',
                gap: 10,
                minHeight: 40,
                opacity: wikiIngesting ? 0.76 : 1,
                padding: '8px 10px',
              }}
              aria-disabled={wikiIngesting}
            >
              <Upload size={16} color={colors.accent} />
              <input
                ref={wikiIngestHeroInputRef}
                data-testid="case-wiki-ingest-top-input"
                type="file"
                multiple
                disabled={wikiIngesting}
                aria-label="Ingest files into Case Wiki"
                onChange={handleWikiIngestFileSelection}
                onClick={() => setWikiIngestStatus('Choose one or more files for Case Wiki ingestion.')}
                style={{
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  color: colors.text,
                  cursor: wikiIngesting ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 900,
                  maxWidth: 280,
                  minHeight: 30,
                  padding: 3,
                  width: '100%',
                }}
              />
            </div>
          </div>
        </div>

        {wikiIngestStatus && (
          <div style={{ ...surfaceStyle, marginTop: 12, color: colors.textSecondary, fontSize: 13 }}>
            <strong style={{ color: colors.text }}>Wiki ingestion:</strong> {wikiIngestStatus}
          </div>
        )}

        <div
          data-testid="case-wiki-inline-ingest-panel"
          style={{
            ...surfaceStyle,
            marginTop: 12,
            display: 'grid',
            gap: 12,
            borderColor: wikiIngestDragActive ? colors.accent : colors.border,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'start' }}>
            <div>
              <strong style={{ color: colors.text, fontSize: 15 }}>Ingest into Case Wiki</strong>
              <p style={{ margin: '5px 0 0', color: colors.textSecondary, fontSize: 13, lineHeight: 1.45 }}>
                Add files, drop sources here, or paste source text. The wiki will create source notes, documents, timeline entries, and graph records.
              </p>
            </div>
            <span style={{ ...surfaceStyle, padding: '6px 9px', color: colors.textSecondary, fontSize: 12, fontWeight: 800 }}>
              {wikiIngestPendingFiles.length
                ? `${wikiIngestPendingFiles.length} file${wikiIngestPendingFiles.length === 1 ? '' : 's'} ready`
                : wikiIngestText.trim()
                  ? 'Text source ready'
                  : 'Waiting for source'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 0.7fr) minmax(260px, 1fr)', gap: 12 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gap: 8, color: colors.textMuted, fontSize: 12, fontWeight: 800 }}>
                Source files
                <div
                  style={{
                    ...glassButton,
                    borderRadius: 8,
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <input
                    ref={wikiIngestInputRef}
                    id="case-wiki-inline-ingest-file-input"
                    data-testid="case-wiki-inline-ingest-input"
                    type="file"
                    multiple
                    disabled={wikiIngesting}
                    aria-label="Choose files for Case Wiki ingestion"
                    onChange={handleWikiIngestFileSelection}
                    onClick={() => setWikiIngestStatus('Choose one or more files for Case Wiki ingestion.')}
                    style={{
                      color: colors.text,
                      cursor: wikiIngesting ? 'not-allowed' : 'pointer',
                      flex: '1 1 260px',
                      fontSize: 13,
                      fontWeight: 800,
                      maxWidth: '100%',
                    }}
                  />
                  <span style={{ color: colors.textSecondary, fontSize: 13, fontWeight: 800 }}>
                    {wikiIngestPendingFiles.length
                      ? `${wikiIngestPendingFiles.length} selected source${wikiIngestPendingFiles.length === 1 ? '' : 's'}`
                      : 'No files selected yet'}
                  </span>
                </div>
              </div>

              <div
                data-testid="case-wiki-inline-ingest-dropzone"
                onDragEnter={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setWikiIngestDragActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setWikiIngestDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setWikiIngestDragActive(false);
                }}
                onDrop={handleWikiIngestDrop}
                style={{
                  ...surfaceStyle,
                  display: 'grid',
                  gap: 7,
                  minHeight: 90,
                  alignContent: 'center',
                  borderStyle: 'dashed',
                  borderColor: wikiIngestDragActive ? colors.accent : colors.border,
                  background: wikiIngestDragActive ? colors.surfaceHover : surfaceStyle.background,
                }}
              >
                <strong style={{ color: colors.text, fontSize: 13 }}>
                  {wikiIngestPendingFiles.length
                    ? `${wikiIngestPendingFiles.length} selected source${wikiIngestPendingFiles.length === 1 ? '' : 's'}`
                    : 'Drop files here'}
                </strong>
                {wikiIngestPendingFiles.length > 0 ? (
                  <div style={{ display: 'grid', gap: 5 }}>
                    {wikiIngestPendingFiles.slice(0, 5).map((file) => (
                      <span key={`${file.name}-${file.size}`} style={{ color: colors.textSecondary, fontSize: 12 }}>
                        {file.name} · {Math.max(1, Math.round(file.size / 1024))} KB
                      </span>
                    ))}
                    {wikiIngestPendingFiles.length > 5 && (
                      <span style={{ color: colors.textMuted, fontSize: 12 }}>
                        +{wikiIngestPendingFiles.length - 5} more
                      </span>
                    )}
                  </div>
                ) : (
                  <span style={{ color: colors.textMuted, fontSize: 12 }}>PDFs, images, docs, spreadsheets, exports, and notes are accepted.</span>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ display: 'grid', gap: 6, color: colors.textMuted, fontSize: 12, fontWeight: 800 }}>
                Paste source text
                <input
                  data-testid="case-wiki-inline-source-name"
                  type="text"
                  value={wikiIngestSourceName}
                  onChange={(event) => setWikiIngestSourceName(event.currentTarget.value)}
                  placeholder="Optional source name"
                  style={{
                    ...glassButton,
                    borderRadius: 8,
                    color: colors.text,
                    padding: '10px 12px',
                  }}
                />
              </label>
              <textarea
                data-testid="case-wiki-inline-source-text"
                value={wikiIngestText}
                onChange={(event) => {
                  setWikiIngestText(event.currentTarget.value);
                  if (event.currentTarget.value.trim()) {
                    setWikiIngestStatus('Pasted source text ready for Case Wiki ingestion.');
                  }
                }}
                placeholder="Paste notes, copied PDF text, email text, intake details, or any other source content here."
                rows={5}
                style={{
                  ...glassButton,
                  borderRadius: 8,
                  color: colors.text,
                  lineHeight: 1.5,
                  minHeight: 116,
                  padding: 12,
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: colors.textSecondary, fontSize: 12 }}>
              {wikiIngesting ? 'Ingesting source material...' : hasWikiIngestDraft ? 'Ready to ingest into the wiki.' : 'Choose files, drop files, or paste text first.'}
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={buttonStyle} onClick={clearWikiIngestDraft} disabled={wikiIngesting} {...buttonHoverHandlers}>
                Clear
              </button>
              {!hasWikiIngestDraft ? (
                <span
                  style={{
                    ...surfaceStyle,
                    alignItems: 'center',
                    color: colors.textSecondary,
                    display: 'inline-flex',
                    fontSize: 13,
                    fontWeight: 900,
                    minHeight: 40,
                    padding: '0 12px',
                  }}
                >
                  Select a file above or paste text
                </span>
              ) : (
                <button
                  type="button"
                  data-testid="case-wiki-inline-ingest-submit"
                  style={{
                    ...primaryButtonStyle,
                    opacity: wikiIngesting ? 0.62 : 1,
                    cursor: wikiIngesting ? 'not-allowed' : 'pointer',
                  }}
                  onClick={() => void submitWikiIngestModal()}
                  disabled={wikiIngesting}
                  {...accentButtonHoverHandlers}
                >
                  <Upload size={16} />
                  {wikiIngesting
                    ? 'Ingesting...'
                    : wikiIngestPendingFiles.length
                      ? 'Ingest selected files'
                      : 'Ingest pasted source'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 0.34fr) minmax(0, 1fr)', gap: 16, marginTop: 16 }}>
          <aside style={{ ...surfaceStyle, display: 'grid', gap: 12, alignContent: 'start', maxHeight: 'min(72vh, 920px)', overflowY: 'auto' }}>
            <strong style={{ color: colors.text }}>Wiki index</strong>
            {pageGroups.map(([groupLabel, pages]) => (
              <div key={groupLabel} style={{ display: 'grid', gap: 6 }}>
                <span style={{ color: colors.textMuted, fontSize: 11, fontWeight: 800, letterSpacing: 0.2, textTransform: 'uppercase' }}>
                  {groupLabel}
                </span>
                {pages.map((page) => (
                  <button
                    type="button"
                    key={page.id}
                    onClick={() => {
                      setSelectedWikiPageId(page.id);
                      if (typeof window !== 'undefined') {
                        const params = new URLSearchParams(window.location.search);
                        params.set('page', page.id);
                        window.history.replaceState(null, '', `/case-management/knowledge?${params.toString()}`);
                      }
                    }}
                    style={{
                      border: `1px solid ${page.id === selectedPage?.id ? colors.accent : colors.border}`,
                      background: page.id === selectedPage?.id ? colors.surfaceHover : 'transparent',
                      borderRadius: 8,
                      color: colors.text,
                      padding: 10,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: 13 }}>{page.title}</strong>
                    <span style={{ display: 'block', marginTop: 4, color: colors.textMuted, fontSize: 12 }}>{page.subtitle}</span>
                  </button>
                ))}
              </div>
            ))}
          </aside>

          <article style={{ ...surfaceStyle, background: isDark ? 'rgba(255,255,255,0.92)' : '#fff', color: '#111827' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid rgba(17, 24, 39, 0.18)', paddingBottom: 14 }}>
              <div>
                <span style={{ display: 'inline-flex', border: '1px solid rgba(17,24,39,0.18)', borderRadius: 8, padding: '5px 8px', fontSize: 12, fontWeight: 800 }}>
                  {selectedPage?.kind} article
                </span>
                <h2 style={{ margin: '12px 0 6px', color: '#111827', fontSize: 34, fontFamily: 'Georgia, serif' }}>{selectedPage?.title}</h2>
                <p style={{ margin: 0, color: '#4b5563', fontSize: 14 }}>{selectedPage?.subtitle}</p>
              </div>
              {selectedPageLiveHref && (
                <a href={selectedPageLiveHref} style={{ ...openInAppStyle, color: '#174ea6' }}>
                  Open live record
                </a>
              )}
            </div>

	            <p style={{ margin: '16px 0', color: '#111827', lineHeight: 1.65 }}>
	              {selectedClientWiki?.lead ?? selectedPage?.summary} This wiki entry preserves the operational story around the record so staff can see
	              source notes, referrals, documents, chronology, and backlinks before moving back into the live application.
	            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: 14 }}>
              <div style={{ display: 'grid', gap: 14 }}>
                <section style={{ border: '1px solid rgba(17,24,39,0.16)', borderRadius: 8, padding: 14 }}>
                  <h3 style={{ margin: '0 0 8px', color: '#111827', fontFamily: 'Georgia, serif' }}>In brief</h3>
	                  <ul style={{ margin: 0, paddingLeft: 18, color: '#1f2937', lineHeight: 1.6 }}>
	                    <li>{linkedCases.length} linked case{linkedCases.length === 1 ? '' : 's'} in this topic.</li>
	                    <li>{linkedNotes.length} note{linkedNotes.length === 1 ? '' : 's'} and {linkedDocuments.length} document{linkedDocuments.length === 1 ? '' : 's'} are available as sources.</li>
	                    <li>{linkedReferrals.length} referral{linkedReferrals.length === 1 ? '' : 's'} connect this page to the service directory.</li>
	                    {timelineStart && timelineEnd && (
	                      <li>
	                        Timeline coverage runs from {formatDate(timelineStart)} to {formatDate(timelineEnd)}.
	                      </li>
	                    )}
	                    {selectedClientWiki && <li>{selectedClientWiki.retrievalHints.length} AI retrieval hint{selectedClientWiki.retrievalHints.length === 1 ? '' : 's'} are documented for this client.</li>}
	                  </ul>
	                </section>

	                {selectedIngestion && (
	                  <section style={{ border: '1px solid rgba(17,24,39,0.16)', borderRadius: 8, padding: 14 }}>
	                    <h3 style={{ margin: '0 0 8px', color: '#111827', fontFamily: 'Georgia, serif' }}>Generated from upload</h3>
	                    <p style={{ margin: '0 0 12px', color: '#1f2937', lineHeight: 1.55 }}>
	                      {selectedIngestion.fileName} was accepted as a wiki source, converted into a source note, linked document, chronology item,
	                      and graph-ready knowledge nodes for retrieval.
	                    </p>
	                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 12 }}>
	                      {[
	                        ['File type', selectedIngestion.mimeType || 'unknown'],
	                        ['Extraction', `${selectedIngestion.extractionStatus} via ${selectedIngestion.extractionMethod}`],
	                        ['Neo4j', `${selectedIngestion.graphStatus}${selectedIngestion.graphMessage ? `: ${selectedIngestion.graphMessage}` : ''}`],
	                        ['Graph shape', `${selectedIngestion.nodeCount} nodes · ${selectedIngestion.edgeCount} edges`],
	                      ].map(([label, value]) => (
	                        <div key={label} style={{ border: '1px solid rgba(17,24,39,0.14)', borderRadius: 8, padding: 10 }}>
	                          <strong style={{ display: 'block', color: '#111827', fontSize: 12 }}>{label}</strong>
	                          <span style={{ display: 'block', marginTop: 4, color: '#4b5563', fontSize: 12, lineHeight: 1.4 }}>{value}</span>
	                        </div>
	                      ))}
	                    </div>
	                    {selectedIngestion.entities.length > 0 && (
	                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
	                        {selectedIngestion.entities.map((entity) => (
	                          <span key={entity} style={{ background: 'rgba(23,78,166,0.08)', borderRadius: 8, padding: '4px 7px', color: '#174ea6', fontSize: 11, fontWeight: 800 }}>
	                            {entity}
	                          </span>
	                        ))}
	                      </div>
	                    )}
	                    <div style={{ display: 'grid', gap: 10 }}>
	                      {selectedIngestion.sections.map((section) => (
	                        <div key={`${selectedIngestion.id}-${section.heading}`} style={{ borderTop: '1px solid rgba(17,24,39,0.12)', paddingTop: 10 }}>
	                          <strong style={{ color: '#174ea6' }}>{section.heading}</strong>
	                          <p style={{ margin: '5px 0 0', color: '#1f2937', lineHeight: 1.6 }}>{section.body}</p>
	                        </div>
	                      ))}
	                    </div>
	                  </section>
	                )}

	                {selectedClientWiki && (
	                  <section style={{ border: '1px solid rgba(17,24,39,0.16)', borderRadius: 8, padding: 14 }}>
	                    <h3 style={{ margin: '0 0 8px', color: '#111827', fontFamily: 'Georgia, serif' }}>Longitudinal client wiki</h3>
	                    <div style={{ display: 'grid', gap: 12 }}>
	                      <div>
	                        <strong style={{ color: '#174ea6' }}>Profile context</strong>
	                        <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#1f2937', lineHeight: 1.55 }}>
	                          {selectedClientWiki.profileContext.map((item) => (
	                            <li key={item}>{item}</li>
	                          ))}
	                        </ul>
	                      </div>
	                      <div>
	                        <strong style={{ color: '#174ea6' }}>Working synthesis</strong>
	                        <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#1f2937', lineHeight: 1.55 }}>
	                          {selectedClientWiki.workingSynthesis.map((item) => (
	                            <li key={item}>{item}</li>
	                          ))}
	                        </ul>
	                      </div>
	                    </div>
	                  </section>
	                )}

	                {selectedClientWiki && (
	                  <section style={{ border: '1px solid rgba(17,24,39,0.16)', borderRadius: 8, padding: 14 }}>
	                    <h3 style={{ margin: '0 0 8px', color: '#111827', fontFamily: 'Georgia, serif' }}>Change over time</h3>
	                    <div style={{ display: 'grid', gap: 10 }}>
	                      {selectedClientWiki.milestones.map((milestone) => (
	                        <div key={`${milestone.caseId}-${milestone.occurredAt}-${milestone.title}`} style={{ borderBottom: '1px solid rgba(17,24,39,0.12)', paddingBottom: 10 }}>
	                          <span style={{ display: 'block', color: '#6b7280', fontSize: 12 }}>{formatDateTime(milestone.occurredAt)} · {milestone.type}</span>
	                          <strong style={{ display: 'block', color: '#111827', marginTop: 3 }}>{milestone.title}</strong>
	                          <p style={{ margin: '4px 0', color: '#1f2937', lineHeight: 1.55 }}>{milestone.detail}</p>
	                          <span style={{ color: '#6b7280', fontSize: 12 }}>Source: {milestone.source}</span>
	                        </div>
	                      ))}
	                    </div>
	                  </section>
	                )}

	                <section style={{ border: '1px solid rgba(17,24,39,0.16)', borderRadius: 8, padding: 14 }}>
	                  <h3 style={{ margin: '0 0 8px', color: '#111827', fontFamily: 'Georgia, serif' }}>Detailed case notes</h3>
	                  <div style={{ display: 'grid', gap: 10 }}>
	                    {sortedLinkedNotes.slice(0, 12).map((note) => {
	                      const client = clientRecords.find((candidate) => candidate.id === note.clientId);
	                      return (
	                        <div key={note.id} style={{ borderBottom: '1px solid rgba(17,24,39,0.12)', paddingBottom: 10 }}>
	                          <strong style={{ color: '#174ea6' }}>{note.type}</strong>
	                          <p style={{ margin: '5px 0', color: '#1f2937', lineHeight: 1.55 }}>{note.narrative}</p>
	                          <p style={{ margin: '5px 0', color: '#374151', lineHeight: 1.5, fontSize: 13 }}>
	                            <strong>Wiki synthesis:</strong> {note.aiSummary}
	                          </p>
	                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
	                            {note.structuredFields.map((field) => (
	                              <span key={field} style={{ border: '1px solid rgba(17,24,39,0.18)', borderRadius: 8, padding: '3px 6px', color: '#4b5563', fontSize: 11 }}>
	                                {field}
	                              </span>
	                            ))}
	                            {note.aiTags.map((tag) => (
	                              <span key={tag} style={{ background: 'rgba(23,78,166,0.08)', borderRadius: 8, padding: '3px 6px', color: '#174ea6', fontSize: 11 }}>
	                                {tag}
	                              </span>
	                            ))}
	                          </div>
	                          <span style={{ color: '#6b7280', fontSize: 12 }}>
	                            {formatDateTime(note.timestamp)} · {renderProfileLink(note.author, note.author, wikiRouteLinkStyle)} · {client ? renderProfileLink(client.fullName, client.fullName, wikiRouteLinkStyle) : 'No client'}
	                            {note.attachments.length > 0 ? ` · ${note.attachments.join(', ')}` : ''}
	                          </span>
	                        </div>
	                      );
	                    })}
                    {linkedNotes.length === 0 && <p style={{ margin: 0, color: '#6b7280' }}>No notes are linked to this wiki page yet.</p>}
                  </div>
                </section>

	                <section style={{ border: '1px solid rgba(17,24,39,0.16)', borderRadius: 8, padding: 14 }}>
	                  <h3 style={{ margin: '0 0 8px', color: '#111827', fontFamily: 'Georgia, serif' }}>Connected services and referrals</h3>
	                  <div style={{ display: 'grid', gap: 8 }}>
                    {linkedReferrals.slice(0, 5).map((referral) => {
                      const client = clientRecords.find((candidate) => candidate.id === referral.clientId);
                      return (
                        <div key={referral.id} style={{ color: '#1f2937', lineHeight: 1.55 }}>
                          {renderDirectoryLink(referral.organization, referral.organization, wikiRouteLinkStyle)} · {referral.serviceCategory} · {referral.status}
                          {client && <span> · {renderProfileLink(client.fullName, client.fullName, wikiRouteLinkStyle)}</span>}
                        </div>
                      );
                    })}
	                    {linkedReferrals.length === 0 && <p style={{ margin: 0, color: '#6b7280' }}>No referrals are linked to this wiki page yet.</p>}
	                  </div>
	                </section>

	                {selectedClientWiki && (
	                  <section style={{ border: '1px solid rgba(17,24,39,0.16)', borderRadius: 8, padding: 14 }}>
	                    <h3 style={{ margin: '0 0 8px', color: '#111827', fontFamily: 'Georgia, serif' }}>Retrieval and open questions</h3>
	                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
	                      <div>
	                        <strong style={{ color: '#174ea6' }}>AI retrieval hints</strong>
	                        <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#1f2937', lineHeight: 1.55 }}>
	                          {selectedClientWiki.retrievalHints.map((hint) => (
	                            <li key={hint}>{hint}</li>
	                          ))}
	                        </ul>
	                      </div>
	                      <div>
	                        <strong style={{ color: '#174ea6' }}>Open questions</strong>
	                        <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#1f2937', lineHeight: 1.55 }}>
	                          {selectedClientWiki.openQuestions.map((question) => (
	                            <li key={question}>{question}</li>
	                          ))}
	                        </ul>
	                      </div>
	                    </div>
	                  </section>
	                )}
	              </div>

              <aside style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
                <div style={{ border: '1px solid rgba(17,24,39,0.16)', borderRadius: 8, padding: 12 }}>
	                  <strong style={{ color: '#111827' }}>Live links</strong>
	                  <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>
	                    {selectedWikiClient && <a href={profilePathForName(selectedWikiClient.fullName)} style={wikiRouteLinkStyle}>Street Profile: {selectedWikiClient.fullName}</a>}
	                    {selectedPageCase && <button type="button" onClick={() => { setSelectedCaseId(selectedPageCase.id); handleTabChange('cases'); }} style={{ ...buttonStyle, color: colors.text }}>Open case record</button>}
	                    {selectedPageOrganization && <a href={directoryPathForOrganization(selectedPageOrganization.name)} style={wikiRouteLinkStyle}>Directory: {selectedPageOrganization.name}</a>}
                    {linkedCases.slice(0, 4).map((caseItem) => (
                      <button key={caseItem.id} type="button" onClick={() => { setSelectedCaseId(caseItem.id); setSelectedClientId(caseItem.clientId); handleTabChange('cases'); }} style={{ ...buttonStyle, color: colors.text }}>
                        {caseItem.caseId}
                      </button>
                    ))}
                  </div>
                </div>

	                <div style={{ border: '1px solid rgba(17,24,39,0.16)', borderRadius: 8, padding: 12 }}>
	                  <strong style={{ color: '#111827' }}>Chronology</strong>
	                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
	                    {sortedLinkedTimeline.slice(0, 10).map((event) => (
	                      <div key={event.id}>
	                        <span style={{ display: 'block', color: '#6b7280', fontSize: 12 }}>{formatDateTime(event.occurredAt)}</span>
	                        <strong style={{ color: '#111827', fontSize: 13 }}>{event.title}</strong>
	                        <p style={{ margin: '3px 0 0', color: '#4b5563', fontSize: 12, lineHeight: 1.4 }}>{event.detail}</p>
	                      </div>
	                    ))}
                    {linkedTimeline.length === 0 && <span style={{ color: '#6b7280', fontSize: 13 }}>No timeline events yet.</span>}
                  </div>
                </div>

                <div style={{ border: '1px solid rgba(17,24,39,0.16)', borderRadius: 8, padding: 12 }}>
	                  <strong style={{ color: '#111827' }}>Sources</strong>
	                  <p style={{ margin: '8px 0 0', color: '#4b5563', fontSize: 13, lineHeight: 1.5 }}>
	                    Compiled from {linkedNotes.length} notes, {linkedReferrals.length} referrals, {linkedDocuments.length} documents, and {linkedTimeline.length} timeline entries.
	                  </p>
	                  {selectedClientWiki && (
	                    <p style={{ margin: '8px 0 0', color: '#4b5563', fontSize: 13, lineHeight: 1.5 }}>
	                      Includes {selectedClientWiki.sourceNotes.length} synthetic wiki source notes and {selectedClientWiki.milestones.length} time-based milestones for demo retrieval.
	                    </p>
	                  )}
	                  {selectedIngestion && (
	                    <p style={{ margin: '8px 0 0', color: '#4b5563', fontSize: 13, lineHeight: 1.5 }}>
	                      Upload source: {selectedIngestion.fileName}. Graph persistence: {selectedIngestion.graphStatus}
	                      {selectedIngestion.graphMessage ? ` (${selectedIngestion.graphMessage})` : ''}.
	                    </p>
	                  )}
	                </div>
              </aside>
            </div>
          </article>
        </div>
      </section>
      </>
    );
  }

  function renderOverview() {
    const stats = [
      { label: 'Active clients', value: clientRecords.filter((client) => client.status === 'active').length, icon: Users, detail: 'in this workspace' },
      { label: 'Active cases', value: caseRecords.filter((caseItem) => caseItem.status !== 'closed').length, icon: Briefcase, detail: 'across outreach teams' },
      { label: 'Overdue tasks', value: overdueTasks.length, icon: AlertTriangle, detail: 'needs action today' },
      { label: 'Follow-ups today', value: todaysFollowUps.length, icon: Clock, detail: `scheduled for ${formatDate(todayKey)}` },
      { label: 'Urgent cases', value: urgentCases.length, icon: Flag, detail: 'priority review' },
      { label: 'Appointments', value: upcomingAppointments.length, icon: Calendar, detail: 'upcoming scheduled' },
      { label: 'Workflow inbox', value: visibleNotifications.length, icon: BellRing, detail: 'automation notifications' },
    ];
    const chartColors = ['#14b8a6', '#facc15', '#60a5fa', '#ef4444', '#a3e635', '#f472b6'];
    const caseTypeDistribution = Object.entries(
      caseRecords.reduce<Record<string, number>>((counts, caseItem) => {
        counts[caseItem.type] = (counts[caseItem.type] ?? 0) + 1;
        return counts;
      }, {}),
    ).map(([label, value], index) => ({ label, value, color: chartColors[index % chartColors.length] ?? '#14b8a6' }));
    const maxCaseTypeCount = Math.max(1, ...caseTypeDistribution.map((item) => item.value));
    const workerNames = Array.from(new Set(caseRecords.map((caseItem) => caseItem.assignedStaff))).sort((left, right) => left.localeCompare(right));
    const maxWorkerCaseCount = Math.max(
      1,
      ...workerNames.map((worker) => caseRecords.filter((caseItem) => caseItem.assignedStaff === worker).length),
    );
    const lifecycleCounts = [
      { label: 'Open', value: caseRecords.filter((caseItem) => !['closed', 'archived'].includes(caseItem.status)).length, color: '#14b8a6' },
      { label: 'Closed / archived', value: caseRecords.filter((caseItem) => ['closed', 'archived'].includes(caseItem.status)).length, color: '#60a5fa' },
    ];
    const maxLifecycleCount = Math.max(1, ...lifecycleCounts.map((item) => item.value));
    const recentCaseUpdates = caseRecords
      .map((caseItem) => {
        const latestTimelineEvent = timelineRecords
          .filter((event) => event.caseId === caseItem.id)
          .sort((left, right) => toDate(right.occurredAt).getTime() - toDate(left.occurredAt).getTime())[0];
        return {
          caseItem,
          client: clientRecords.find((candidate) => candidate.id === caseItem.clientId),
          occurredAt: latestTimelineEvent?.occurredAt ?? caseItem.openedDate,
          label: latestTimelineEvent?.title ?? 'Case opened',
        };
      })
      .sort((left, right) => toDate(right.occurredAt).getTime() - toDate(left.occurredAt).getTime())
      .slice(0, 4);
    const recentReferrals = [...referralRecords]
      .sort((left, right) => toDate(right.referralDate).getTime() - toDate(left.referralDate).getTime())
      .slice(0, 3);
    const recentNotes = [...noteRecords]
      .sort((left, right) => toDate(right.timestamp).getTime() - toDate(left.timestamp).getTime())
      .slice(0, 3);

    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <button
                key={stat.label}
                type="button"
                style={{ ...surfaceStyle, textAlign: 'left', cursor: 'pointer' }}
                onClick={() => {
                  if (stat.label.includes('client')) handleTabChange('clients');
                  if (stat.label.includes('case') || stat.label.includes('Urgent')) handleTabChange('cases');
                  if (stat.label.includes('task')) handleTabChange('tasks');
                  if (stat.label.includes('Appointment')) handleTabChange('calendar');
                  if (stat.label.includes('Workflow')) handleTabChange('overview');
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <Icon size={20} color={colors.accent} />
                  <ArrowRight size={16} color={colors.textMuted} />
                </div>
                <strong style={{ display: 'block', marginTop: 16, fontSize: 30, color: colors.text }}>{stat.value}</strong>
                <span style={{ display: 'block', marginTop: 4, color: colors.text, fontWeight: 750, fontSize: 14 }}>{stat.label}</span>
                <span style={{ display: 'block', marginTop: 4, color: colors.textMuted, fontSize: 12 }}>{stat.detail}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 16 }}>
          <section style={panelStyle}>
            <SectionTitle icon={BellRing} title="Workflow Inbox" />
            {renderNotificationInbox(true)}
          </section>

          <section style={panelStyle}>
            <SectionTitle icon={Sparkles} title="Cases Needing Attention" />
            <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
              {urgentCases.concat(caseRecords.filter((caseItem) => caseItem.status === 'pending documents')).slice(0, 4).map((caseItem) => {
                const client = clientRecords.find((candidate) => candidate.id === caseItem.clientId);
                return (
                  <button
                    key={caseItem.id}
                    type="button"
                    onClick={() => {
                      setSelectedCaseId(caseItem.id);
                      setSelectedClientId(caseItem.clientId);
                      handleTabChange('cases');
                    }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto',
                      alignItems: 'center',
                      gap: 12,
                      textAlign: 'left',
                      border: `1px solid ${colors.border}`,
                      background: 'transparent',
                      borderRadius: 8,
                      padding: 12,
                      color: colors.text,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', fontSize: 14 }}>{caseItem.title}</strong>
                      <span style={{ display: 'block', marginTop: 4, color: colors.textSecondary, fontSize: 12 }}>
                        {client ? renderProfileLink(client.fullName) : 'No client'} · next action: {caseItem.nextAction}
                      </span>
                    </span>
                    <PriorityBadge priority={caseItem.priority} />
                  </button>
                );
              })}
            </div>
          </section>

          <section style={panelStyle}>
            <SectionTitle icon={Bot} title="Street Bot Alerts" />
            <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
              {botAlerts.map((alert) => {
                const caseItem = caseRecords.find((candidate) => candidate.id === alert.caseId);
                return (
                  <div key={alert.id} style={{ borderBottom: `1px solid ${colors.border}`, paddingBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                      <strong style={{ color: colors.text, fontSize: 14 }}>{alert.title}</strong>
                      <RiskBadge risk={alert.severity} />
                    </div>
                    <p style={{ margin: '6px 0 8px', color: colors.textSecondary, fontSize: 13 }}>{alert.prompt}</p>
                    <button
                      type="button"
                      style={{ ...buttonStyle, padding: '7px 10px' }}
                      onClick={() => {
                        if (caseItem) {
                          setSelectedCaseId(caseItem.id);
                          setSelectedClientId(caseItem.clientId);
                          handleTabChange('cases');
                        }
                      }}
                    >
                      Open case
                      <ChevronRight size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
          <section style={panelStyle}>
            <SectionTitle icon={History} title="Recently Updated Cases" />
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {recentCaseUpdates.map(({ caseItem, client, occurredAt, label }) => (
                <button
                  type="button"
                  key={caseItem.id}
                  style={{ ...surfaceStyle, textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedCaseId(caseItem.id);
                    setSelectedClientId(caseItem.clientId);
                    handleTabChange('cases');
                  }}
                >
                  <strong style={{ display: 'block', color: colors.text }}>{caseItem.title}</strong>
                  <span style={{ display: 'block', marginTop: 4, color: colors.textSecondary, fontSize: 12 }}>
                    {client ? renderProfileLink(client.fullName) : 'No client'} · {label}
                  </span>
                  <span style={{ display: 'block', marginTop: 6, color: colors.textMuted, fontSize: 12 }}>{formatDateTime(occurredAt)}</span>
                </button>
              ))}
            </div>
          </section>

          <section style={panelStyle}>
            <SectionTitle icon={ArrowRight} title="New Referrals" />
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {recentReferrals.map((referral) => {
                const client = clientRecords.find((candidate) => candidate.id === referral.clientId);
                return (
                  <button
                    type="button"
                    key={referral.id}
                    style={{ ...surfaceStyle, textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedCaseId(referral.caseId);
                      setSelectedClientId(referral.clientId);
                      handleTabChange('referrals');
                    }}
                  >
                    <strong style={{ display: 'block', color: colors.text }}>{renderDirectoryLink(referral.organization)}</strong>
                    <span style={{ display: 'block', marginTop: 4, color: colors.textSecondary, fontSize: 12 }}>
                      {client ? renderProfileLink(client.fullName) : 'No client'} · {referral.serviceCategory}
                    </span>
                    <span style={{ display: 'block', marginTop: 6, color: colors.textMuted, fontSize: 12 }}>
                      {formatDate(referral.referralDate)} · {referral.status}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section style={panelStyle}>
            <SectionTitle icon={MessageSquare} title="Recent Notes" />
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {recentNotes.map((note) => {
                const client = clientRecords.find((candidate) => candidate.id === note.clientId);
                return (
                  <button
                    type="button"
                    key={note.id}
                    style={{ ...surfaceStyle, textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedCaseId(note.caseId);
                      setSelectedClientId(note.clientId);
                      handleTabChange('cases');
                    }}
                  >
                    <strong style={{ display: 'block', color: colors.text }}>{note.type}</strong>
                    <span style={{ display: 'block', marginTop: 4, color: colors.textSecondary, fontSize: 12 }}>
                      {client ? renderProfileLink(client.fullName) : 'No client'} · {renderProfileLink(note.author)}
                    </span>
                    <span style={{ display: 'block', marginTop: 6, color: colors.textMuted, fontSize: 12 }}>{note.aiSummary}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          <section style={panelStyle}>
            <SectionTitle icon={BarChart3} title="Case Types Distribution" />
            <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
              {caseTypeDistribution.map((item) => (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: colors.textSecondary }}>
                    <span>{item.label}</span>
                    <strong style={{ color: colors.text }}>{item.value}</strong>
                  </div>
                  <div style={{ height: 9, borderRadius: 8, background: colors.surface, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${(item.value / maxCaseTypeCount) * 100}%`, maxWidth: '100%', height: '100%', background: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={panelStyle}>
            <SectionTitle icon={ClipboardCheck} title="Open vs Closed Cases" />
            <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
              {lifecycleCounts.map((item) => (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: colors.textSecondary }}>
                    <span>{item.label}</span>
                    <strong style={{ color: colors.text }}>{item.value}</strong>
                  </div>
                  <div style={{ height: 12, borderRadius: 8, background: colors.surface, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${(item.value / maxLifecycleCount) * 100}%`, maxWidth: '100%', height: '100%', background: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={panelStyle}>
            <SectionTitle icon={Users} title="Caseload by Worker" />
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              {workerNames.map((worker) => {
                const count = caseRecords.filter((caseItem) => caseItem.assignedStaff === worker).length;
                return (
                  <div key={worker} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: colors.textSecondary, fontSize: 13 }}>
                        <span>{renderProfileLink(worker)}</span>
                        <strong style={{ color: colors.text }}>{count}</strong>
                      </div>
                      <div style={{ height: 9, borderRadius: 8, background: colors.surface, marginTop: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${(count / maxWorkerCaseCount) * 100}%`, height: '100%', background: '#14b8a6' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section style={panelStyle}>
            <SectionTitle icon={History} title="Weekly Activity Trend" />
            <div style={{ display: 'flex', alignItems: 'end', gap: 10, height: 170, marginTop: 16 }}>
              {weeklyActivity.map((day) => (
                <div key={day.label} style={{ flex: 1, display: 'grid', gap: 6, alignItems: 'end' }}>
                  <div style={{ height: day.notes * 8, borderRadius: 8, background: '#14b8a6' }} title={`${day.notes} notes`} />
                  <div style={{ height: day.tasks * 7, borderRadius: 8, background: '#facc15' }} title={`${day.tasks} tasks`} />
                  <span style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>{day.label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  function renderNotificationInbox(compact = false) {
    const inboxItems = visibleNotifications.slice(0, compact ? 5 : 12);
    return (
      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        {inboxItems.map((notification) => {
          const canCreateFollowUp = !['task due today', 'task overdue'].includes(notification.type);
          return (
            <article
              key={notification.id}
              style={{
                ...surfaceStyle,
                display: 'grid',
                gap: 10,
                borderColor: notification.severity === 'urgent' ? 'rgba(239, 68, 68, 0.72)' : colors.border,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', color: colors.text, fontSize: 14 }}>{notification.title}</strong>
                  <span style={{ display: 'block', marginTop: 4, color: colors.textMuted, fontSize: 12 }}>
                    {notification.source} · {notification.type}
                  </span>
                </span>
                <RiskBadge risk={notification.severity} />
              </div>
              <p style={{ margin: 0, color: colors.textSecondary, fontSize: 13 }}>{notification.detail}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" style={{ ...buttonStyle, padding: '7px 10px' }} onClick={() => openNotification(notification)}>
                  Open item
                  <ChevronRight size={14} />
                </button>
                {canCreateFollowUp && (
                  <button
                    type="button"
                    style={{ ...buttonStyle, padding: '7px 10px' }}
                    onClick={() => createFollowUpFromNotification(notification)}
                  >
                    <Plus size={14} />
                    Create follow-up
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Dismiss ${notification.title}`}
                  style={{ ...buttonStyle, padding: '7px 10px' }}
                  onClick={() => dismissNotification(notification.id)}
                >
                  <X size={14} />
                  Dismiss
                </button>
              </div>
            </article>
          );
        })}
        {inboxItems.length === 0 && <EmptyHint text="No workflow notifications need attention." />}
      </div>
    );
  }

  function renderClients() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 16 }}>
        <section style={panelStyle}>
          <SectionTitle
            icon={Users}
            title="Clients List"
            action={
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={() => setClientIntakeOpen((open) => !open)}
                {...accentButtonHoverHandlers}
              >
                <Plus size={16} />
                {clientIntakeOpen ? 'Close intake' : 'Add client'}
              </button>
            }
          />
          {clientIntakeOpen && renderClientIntakeForm()}
          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
              <thead>
                <tr style={{ color: colors.textMuted, fontSize: 12, textAlign: 'left' }}>
                  {['Client', 'ID', 'Worker', 'Cases', 'Latest contact', 'Risk', 'Next follow-up', 'Status'].map((head) => (
                    <th key={head} style={{ padding: '10px 8px', borderBottom: `1px solid ${colors.border}` }}>
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {searchableClients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => {
                      setSelectedClientId(client.id);
                      const firstCase = caseRecords.find((caseItem) => caseItem.clientId === client.id);
                      if (firstCase) setSelectedCaseId(firstCase.id);
                    }}
                    style={{
                      cursor: 'pointer',
                      background: client.id === selectedClient.id ? colors.surface : 'transparent',
                    }}
                  >
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                      <strong style={{ display: 'block' }}>{renderProfileLink(client.fullName)}</strong>
                      <span style={{ color: colors.textMuted, fontSize: 12 }}>
                        {client.preferredName} · {client.pronouns}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{client.clientId}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{renderProfileLink(client.assignedWorker)}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.text }}>{activeCaseCountForClient(client.id)}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{formatDateTime(client.latestContact)}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}><RiskBadge risk={client.riskLevel} /></td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{formatDateTime(client.nextFollowUp)}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}><StatusBadge label={client.status === 'active' ? 'active' : 'archived'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        {renderClientProfile()}
      </div>
    );
  }

  function renderClientIntakeForm() {
    const fieldStyle = {
      ...glassInput,
      borderRadius: 8,
      padding: '10px 11px',
      color: colors.text,
      width: '100%',
    } satisfies React.CSSProperties;
    const labelStyle = { display: 'grid', gap: 6, color: colors.textMuted, fontSize: 12, fontWeight: 700 } satisfies React.CSSProperties;

    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          createClientFromIntake();
        }}
        style={{
          borderTop: `1px solid ${colors.border}`,
          marginTop: 14,
          paddingTop: 14,
          display: 'grid',
          gap: 12,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 10 }}>
          <label style={labelStyle}>
            Full name
            <input
              value={clientIntake.fullName}
              onChange={(event) => updateClientIntake('fullName', event.target.value)}
              placeholder="Client legal or recorded name"
              style={fieldStyle}
            />
          </label>
          <label style={labelStyle}>
            Preferred name
            <input
              value={clientIntake.preferredName}
              onChange={(event) => updateClientIntake('preferredName', event.target.value)}
              placeholder="Name used in the field"
              style={fieldStyle}
            />
          </label>
          <label style={labelStyle}>
            Date of birth
            <input
              type="date"
              value={clientIntake.dob}
              onChange={(event) => updateClientIntake('dob', event.target.value)}
              style={fieldStyle}
            />
          </label>
          <label style={labelStyle}>
            Pronouns
            <input
              value={clientIntake.pronouns}
              onChange={(event) => updateClientIntake('pronouns', event.target.value)}
              placeholder="Optional"
              style={fieldStyle}
            />
          </label>
          <label style={labelStyle}>
            Phone
            <input
              value={clientIntake.phone}
              onChange={(event) => updateClientIntake('phone', event.target.value)}
              placeholder="Phone or not recorded"
              style={fieldStyle}
            />
          </label>
          <label style={labelStyle}>
            Email
            <input
              type="email"
              value={clientIntake.email}
              onChange={(event) => updateClientIntake('email', event.target.value)}
              placeholder="Email or not recorded"
              style={fieldStyle}
            />
          </label>
          <label style={labelStyle}>
            Last known location
            <input
              value={clientIntake.location}
              onChange={(event) => updateClientIntake('location', event.target.value)}
              placeholder="Route, drop-in, shelter, clinic"
              style={fieldStyle}
            />
          </label>
          <label style={labelStyle}>
            Emergency contact
            <input
              value={clientIntake.emergencyContact}
              onChange={(event) => updateClientIntake('emergencyContact', event.target.value)}
              placeholder="Name and relationship"
              style={fieldStyle}
            />
          </label>
          <label style={labelStyle}>
            Assigned worker
            <input
              value={clientIntake.assignedWorker}
              onChange={(event) => updateClientIntake('assignedWorker', event.target.value)}
              style={fieldStyle}
            />
          </label>
          <label style={labelStyle}>
            Team
            <input
              value={clientIntake.assignedTeam}
              onChange={(event) => updateClientIntake('assignedTeam', event.target.value)}
              style={fieldStyle}
            />
          </label>
          <label style={labelStyle}>
            Risk level
            <select
              value={clientIntake.riskLevel}
              onChange={(event) => updateClientIntake('riskLevel', event.target.value as RiskLevel)}
              style={fieldStyle}
            >
              {(['low', 'medium', 'high', 'urgent'] as const).map((risk) => (
                <option key={risk} value={risk}>{risk}</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Consent status
            <select
              value={clientIntake.consentStatus}
              onChange={(event) => updateClientIntake('consentStatus', event.target.value as ClientRecord['consentStatus'])}
              style={fieldStyle}
            >
              {(['signed', 'pending', 'expired'] as const).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Language
            <input
              value={clientIntake.language}
              onChange={(event) => updateClientIntake('language', event.target.value)}
              style={fieldStyle}
            />
          </label>
          <label style={labelStyle}>
            Communication preference
            <input
              value={clientIntake.communicationPreference}
              onChange={(event) => updateClientIntake('communicationPreference', event.target.value)}
              style={fieldStyle}
            />
          </label>
          <label style={labelStyle}>
            Housing status
            <input
              value={clientIntake.housingStatus}
              onChange={(event) => updateClientIntake('housingStatus', event.target.value)}
              style={fieldStyle}
            />
          </label>
          <label style={labelStyle}>
            Benefits status
            <input
              value={clientIntake.benefitsStatus}
              onChange={(event) => updateClientIntake('benefitsStatus', event.target.value)}
              style={fieldStyle}
            />
          </label>
        </div>
        <label style={labelStyle}>
          Risk flags
          <input
            value={clientIntake.riskFlags}
            onChange={(event) => updateClientIntake('riskFlags', event.target.value)}
            placeholder="urgent housing need, document missing"
            style={fieldStyle}
          />
        </label>
        <label style={labelStyle}>
          Intake service history
          <textarea
            value={clientIntake.serviceHistory}
            onChange={(event) => updateClientIntake('serviceHistory', event.target.value)}
            rows={3}
            style={{ ...fieldStyle, resize: 'vertical' }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            type="button"
            style={buttonStyle}
            onClick={() => {
              setClientIntake(emptyClientIntake);
              setClientIntakeOpen(false);
            }}
            {...buttonHoverHandlers}
          >
            Cancel
          </button>
          <button type="submit" style={primaryButtonStyle} {...accentButtonHoverHandlers}>
            <UserPlus size={16} />
            Create client and intake case
          </button>
        </div>
      </form>
    );
  }

  function renderClientProfile() {
    return (
      <aside style={{ ...panelStyle, display: 'grid', gap: 16, alignContent: 'start' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ margin: 0, color: colors.textMuted, fontSize: 12 }}>{selectedClient.clientId}</p>
            <h2 style={{ margin: '4px 0 6px', color: colors.text, fontSize: 24 }}>{renderProfileLink(selectedClient.fullName)}</h2>
            <RiskBadge risk={selectedClient.riskLevel} />
          </div>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: colors.accent,
              color: '#000',
              fontWeight: 850,
            }}
          >
            {selectedClient.alias}
          </div>
        </div>

        {selectedClient.riskFlags.length > 0 && (
          <div style={{ ...surfaceStyle, display: 'grid', gap: 8 }}>
            <strong style={{ color: colors.text, fontSize: 14 }}>Alert banners</strong>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {selectedClient.riskFlags.map((flag) => (
                <span key={flag} style={{ color: '#fee2e2', background: 'rgba(239, 68, 68, 0.24)', borderRadius: 8, padding: '5px 8px', fontSize: 12, fontWeight: 700 }}>
                  {flag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {[
            ['Preferred name', selectedClient.preferredName],
            ['DOB / age', `${formatDate(selectedClient.dob)} · ${selectedClient.age}`],
            ['Phone', selectedClient.phone],
            ['Email', selectedClient.email],
            ['Language', selectedClient.language],
            ['Consent', selectedClient.consentStatus],
            ['Housing', selectedClient.housingStatus],
            ['Benefits', selectedClient.benefitsStatus],
          ].map(([label, value]) => (
            <div key={label} style={{ ...surfaceStyle, padding: 10 }}>
              <span style={{ display: 'block', color: colors.textMuted, fontSize: 11 }}>{label}</span>
              <strong style={{ display: 'block', marginTop: 3, color: colors.text, fontSize: 13 }}>{value}</strong>
            </div>
          ))}
        </div>

        <div style={surfaceStyle}>
          <strong style={{ color: colors.text }}>Service history snapshot</strong>
          <p style={{ margin: '8px 0 0', color: colors.textSecondary, fontSize: 13 }}>{selectedClient.serviceHistory}</p>
        </div>

        <div style={surfaceStyle}>
          <strong style={{ color: colors.text }}>Quick actions</strong>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {['Add case', 'Add note', 'Assign task', 'Upload file', 'Refer client', 'Schedule appointment', 'Generate summary'].map((action) => (
              <button
                type="button"
                key={action}
                style={{ ...buttonStyle, padding: '7px 9px' }}
                onClick={() => handleProfileAction(action)}
              >
                {action}
              </button>
            ))}
          </div>
          {profileAction && renderProfileActionForm()}
        </div>

        <div style={surfaceStyle}>
          <strong style={{ color: colors.text }}>Active cases</strong>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {selectedClientCases.map((caseItem) => (
              <button
                type="button"
                key={caseItem.id}
                onClick={() => {
                  setSelectedCaseId(caseItem.id);
                  handleTabChange('cases');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  background: 'transparent',
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  padding: 10,
                  textAlign: 'left',
                }}
              >
                <span>
                  <strong style={{ display: 'block', fontSize: 13 }}>{caseItem.title}</strong>
                  <span style={{ color: colors.textMuted, fontSize: 12 }}>{caseItem.type}</span>
                </span>
                <PriorityBadge priority={caseItem.priority} />
              </button>
            ))}
          </div>
        </div>

        <div style={surfaceStyle}>
          <strong style={{ color: colors.text }}>Records</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
            {[
              ['Notes', selectedClientNotes.length],
              ['Tasks', selectedClientTasks.length],
              ['Referrals', selectedClientReferrals.length],
              ['Docs', selectedClientDocuments.length],
              ['Appts', selectedClientAppointments.length],
              ['Cases', selectedClientCases.length],
            ].map(([label, value]) => (
              <div key={label} style={{ border: `1px solid ${colors.border}`, borderRadius: 8, padding: 8 }}>
                <span style={{ display: 'block', color: colors.textMuted, fontSize: 11 }}>{label}</span>
                <strong style={{ color: colors.text, fontSize: 18 }}>{value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div style={surfaceStyle}>
          <strong style={{ color: colors.text }}>Street Bot insights</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: colors.textSecondary, fontSize: 13 }}>
            <li>Missing document risk is tied to the housing referral.</li>
            <li>Suggested prompt: summarize this client’s referrals.</li>
            <li>Automation candidate: create follow-up task after referral response.</li>
          </ul>
        </div>
      </aside>
    );
  }

  function renderProfileActionForm() {
    const fieldStyle = {
      ...glassInput,
      borderRadius: 8,
      padding: '9px 10px',
      color: colors.text,
      width: '100%',
    } satisfies React.CSSProperties;
    const labelStyle = { display: 'grid', gap: 6, color: colors.textMuted, fontSize: 12, fontWeight: 700 } satisfies React.CSSProperties;

    if (profileAction === 'case') {
      return (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            createCaseFromProfile();
          }}
          style={{ borderTop: `1px solid ${colors.border}`, marginTop: 12, paddingTop: 12, display: 'grid', gap: 10 }}
        >
          <label style={labelStyle}>
            Case title
            <input
              value={caseQuickDraft.title}
              onChange={(event) => updateCaseQuickDraft('title', event.target.value)}
              placeholder="Housing stabilization, ID replacement, benefits renewal"
              style={fieldStyle}
            />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            <label style={labelStyle}>
              Type
              <input
                list="case-type-draft-options"
                value={caseQuickDraft.type}
                onChange={(event) => updateCaseQuickDraft('type', event.target.value)}
                style={fieldStyle}
              />
              <datalist id="case-type-draft-options">
                {caseTypeRecords.map((type) => (
                  <option key={type.id} value={normalize(type.name)} />
                ))}
              </datalist>
            </label>
            <label style={labelStyle}>
              Priority
              <select
                value={caseQuickDraft.priority}
                onChange={(event) => updateCaseQuickDraft('priority', event.target.value as Priority)}
                style={fieldStyle}
              >
                {(['low', 'medium', 'high', 'urgent'] as const).map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </label>
          </div>
          <label style={labelStyle}>
            Target date
            <input
              type="date"
              value={caseQuickDraft.targetResolutionDate}
              onChange={(event) => updateCaseQuickDraft('targetResolutionDate', event.target.value)}
              style={fieldStyle}
            />
          </label>
          <label style={labelStyle}>
            Next action
            <input
              value={caseQuickDraft.nextAction}
              onChange={(event) => updateCaseQuickDraft('nextAction', event.target.value)}
              placeholder="Call intake desk, collect ID, submit application"
              style={fieldStyle}
            />
          </label>
          <label style={labelStyle}>
            Summary
            <textarea
              value={caseQuickDraft.summary}
              onChange={(event) => updateCaseQuickDraft('summary', event.target.value)}
              rows={3}
              placeholder="Brief service goal and current context"
              style={{ ...fieldStyle, resize: 'vertical' }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" style={buttonStyle} onClick={() => setProfileAction(null)} {...buttonHoverHandlers}>
              Cancel
            </button>
            <button type="submit" style={primaryButtonStyle} {...accentButtonHoverHandlers}>
              <Briefcase size={16} />
              Create case
            </button>
          </div>
        </form>
      );
    }

    if (profileAction === 'referral') {
      return (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            createReferralFromProfile();
          }}
          style={{ borderTop: `1px solid ${colors.border}`, marginTop: 12, paddingTop: 12, display: 'grid', gap: 10 }}
        >
          <label style={labelStyle}>
            Organization
            <input
              list="organization-draft-options"
              value={referralQuickDraft.organization}
              onChange={(event) => updateReferralQuickDraft('organization', event.target.value)}
              placeholder="Partner agency or program"
              style={fieldStyle}
            />
            <datalist id="organization-draft-options">
              {organizationRecords.filter((organization) => organization.active).map((organization) => (
                <option key={organization.id} value={organization.name} />
              ))}
            </datalist>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            <label style={labelStyle}>
              Category
              <input
                value={referralQuickDraft.serviceCategory}
                onChange={(event) => updateReferralQuickDraft('serviceCategory', event.target.value)}
                style={fieldStyle}
              />
            </label>
            <label style={labelStyle}>
              Appointment
              <input
                type="datetime-local"
                value={referralQuickDraft.appointmentDate}
                onChange={(event) => updateReferralQuickDraft('appointmentDate', event.target.value)}
                style={fieldStyle}
              />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            <label style={labelStyle}>
              Contact person
              <input
                value={referralQuickDraft.contactPerson}
                onChange={(event) => updateReferralQuickDraft('contactPerson', event.target.value)}
                style={fieldStyle}
              />
            </label>
            <label style={labelStyle}>
              Contact
              <input
                value={referralQuickDraft.contact}
                onChange={(event) => updateReferralQuickDraft('contact', event.target.value)}
                placeholder="phone or email"
                style={fieldStyle}
              />
            </label>
          </div>
          <label style={labelStyle}>
            Supporting documents
            <input
              value={referralQuickDraft.supportingDocuments}
              onChange={(event) => updateReferralQuickDraft('supportingDocuments', event.target.value)}
              placeholder="consent.pdf, intake-form.pdf"
              style={fieldStyle}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" style={buttonStyle} onClick={() => setProfileAction(null)} {...buttonHoverHandlers}>
              Cancel
            </button>
            <button type="submit" style={primaryButtonStyle} {...accentButtonHoverHandlers}>
              <ArrowRight size={16} />
              Create referral
            </button>
          </div>
        </form>
      );
    }

    if (profileAction === 'appointment') {
      return (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            createAppointmentFromProfile();
          }}
          style={{ borderTop: `1px solid ${colors.border}`, marginTop: 12, paddingTop: 12, display: 'grid', gap: 10 }}
        >
          <label style={labelStyle}>
            Purpose
            <input
              value={appointmentQuickDraft.purpose}
              onChange={(event) => updateAppointmentQuickDraft('purpose', event.target.value)}
              placeholder="Clinic intake, shelter meeting, benefits review"
              style={fieldStyle}
            />
          </label>
          <label style={labelStyle}>
            Date and time
            <input
              type="datetime-local"
              value={appointmentQuickDraft.dateTime}
              onChange={(event) => updateAppointmentQuickDraft('dateTime', event.target.value)}
              style={fieldStyle}
            />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            <label style={labelStyle}>
              Location
              <input
                value={appointmentQuickDraft.location}
                onChange={(event) => updateAppointmentQuickDraft('location', event.target.value)}
                style={fieldStyle}
              />
            </label>
            <label style={labelStyle}>
              Service provider
              <input
                value={appointmentQuickDraft.serviceProvider}
                onChange={(event) => updateAppointmentQuickDraft('serviceProvider', event.target.value)}
                style={fieldStyle}
              />
            </label>
          </div>
          <label style={labelStyle}>
            Prep checklist
            <input
              value={appointmentQuickDraft.prepChecklist}
              onChange={(event) => updateAppointmentQuickDraft('prepChecklist', event.target.value)}
              placeholder="ID, consent copy, transit route"
              style={fieldStyle}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" style={buttonStyle} onClick={() => setProfileAction(null)} {...buttonHoverHandlers}>
              Cancel
            </button>
            <button type="submit" style={primaryButtonStyle} {...accentButtonHoverHandlers}>
              <Calendar size={16} />
              Schedule
            </button>
          </div>
        </form>
      );
    }

    return null;
  }

  function renderCases() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: 16 }}>
        <section style={panelStyle}>
          <SectionTitle
            icon={Briefcase}
            title="Cases List"
            action={
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['table', 'kanban', 'calendar'] as const).map((view) => (
                  <button
                    type="button"
                    key={view}
                    onClick={() => setCaseView(view)}
                    style={{
                      ...buttonStyle,
                      padding: '7px 10px',
                      background: caseView === view ? colors.accent : colors.surface,
                      color: caseView === view ? '#000' : colors.text,
                    }}
                  >
                    {view}
                  </button>
                ))}
              </div>
            }
          />
          {caseView === 'table' && (
            <div style={{ overflowX: 'auto', marginTop: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr style={{ color: colors.textMuted, fontSize: 12, textAlign: 'left' }}>
                    {['Case ID', 'Client', 'Title', 'Type', 'Status', 'Priority', 'Worker', 'Opened', 'Next action'].map((head) => (
                      <th key={head} style={{ padding: '10px 8px', borderBottom: `1px solid ${colors.border}` }}>{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {searchableCases.map((caseItem) => {
                    const client = clientRecords.find((candidate) => candidate.id === caseItem.clientId);
                    return (
                      <tr
                        key={caseItem.id}
                        onClick={() => {
                          setSelectedCaseId(caseItem.id);
                          setSelectedClientId(caseItem.clientId);
                        }}
                        style={{ cursor: 'pointer', background: caseItem.id === selectedCase.id ? colors.surface : 'transparent' }}
                      >
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{caseItem.caseId}</td>
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.text }}>{client ? renderProfileLink(client.fullName) : 'No client'}</td>
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                          <strong style={{ color: colors.text }}>{caseItem.title}</strong>
                        </td>
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{caseItem.type}</td>
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}><StatusBadge label={caseItem.status} /></td>
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}><PriorityBadge priority={caseItem.priority} /></td>
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{renderProfileLink(caseItem.assignedStaff)}</td>
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{formatDate(caseItem.openedDate)}</td>
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{formatDateTime(caseItem.nextFollowUp)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {caseView === 'kanban' && renderCaseKanban()}
          {caseView === 'calendar' && (
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {searchableCases.map((caseItem) => (
                <button
                  type="button"
                  key={caseItem.id}
                  style={{
                    ...surfaceStyle,
                    display: 'grid',
                    gridTemplateColumns: '150px minmax(0, 1fr) auto',
                    gap: 12,
                    alignItems: 'center',
                    textAlign: 'left',
                  }}
                  onClick={() => {
                    setSelectedCaseId(caseItem.id);
                    setSelectedClientId(caseItem.clientId);
                  }}
                >
                  <strong style={{ color: colors.accent }}>{formatDateTime(caseItem.nextFollowUp)}</strong>
                  <span>
                    <strong style={{ display: 'block', color: colors.text }}>{caseItem.title}</strong>
                    <span style={{ color: colors.textSecondary, fontSize: 12 }}>{caseItem.nextAction}</span>
                  </span>
                  <PriorityBadge priority={caseItem.priority} />
                </button>
              ))}
            </div>
          )}
        </section>
        {renderCaseDetail()}
      </div>
    );
  }

  function renderCaseKanban() {
    const statuses: CaseStatus[] = ['intake', 'active', 'pending documents', 'awaiting partner response', 'follow-up needed', 'resolved'];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginTop: 14 }}>
        {statuses.map((status) => {
          const items = searchableCases.filter((caseItem) => caseItem.status === status);
          return (
            <div key={status} style={{ ...surfaceStyle, minHeight: 160 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <StatusBadge label={status} />
                <span style={{ color: colors.textMuted, fontSize: 12 }}>{items.length}</span>
              </div>
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                {items.map((caseItem) => (
                  <button
                    type="button"
                    key={caseItem.id}
                    onClick={() => {
                      setSelectedCaseId(caseItem.id);
                      setSelectedClientId(caseItem.clientId);
                    }}
                    style={{
                      textAlign: 'left',
                      border: `1px solid ${colors.border}`,
                      borderRadius: 8,
                      background: 'transparent',
                      color: colors.text,
                      padding: 10,
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: 13 }}>{caseItem.title}</strong>
                    <span style={{ display: 'block', marginTop: 4, color: colors.textMuted, fontSize: 12 }}>{renderProfileLink(caseItem.assignedStaff)}</span>
                  </button>
                ))}
                {items.length === 0 && <EmptyHint text="No cases in this status." />}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderCaseDetail() {
    const client = clientRecords.find((candidate) => candidate.id === selectedCase.clientId) ?? selectedClient;
    const detailFields = [
      { label: 'Client', value: renderProfileLink(client.fullName) },
      { label: 'Owner', value: renderProfileLink(selectedCase.assignedStaff) },
      { label: 'Team', value: selectedCase.assignedTeam },
      { label: 'Target date', value: formatDate(selectedCase.targetResolutionDate) },
      { label: 'Opened', value: formatDate(selectedCase.openedDate) },
      { label: 'Next follow-up', value: formatDateTime(selectedCase.nextFollowUp) },
    ];

    return (
      <aside style={{ ...panelStyle, display: 'grid', gap: 16, alignContent: 'start' }}>
        <div>
          <p style={{ margin: 0, color: colors.textMuted, fontSize: 12 }}>{selectedCase.caseId}</p>
          <h2 style={{ margin: '4px 0 8px', color: colors.text, fontSize: 24 }}>{selectedCase.title}</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatusBadge label={selectedCase.status} />
            <PriorityBadge priority={selectedCase.priority} />
            <span style={{ color: colors.textSecondary, background: colors.surface, borderRadius: 8, padding: '5px 8px', fontSize: 12, fontWeight: 700 }}>
              {selectedCase.type}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {detailFields.map(({ label, value }) => (
            <div key={label} style={{ ...surfaceStyle, padding: 10 }}>
              <span style={{ display: 'block', color: colors.textMuted, fontSize: 11 }}>{label}</span>
              <strong style={{ display: 'block', marginTop: 3, color: colors.text, fontSize: 13 }}>{value}</strong>
            </div>
          ))}
        </div>

        <div style={surfaceStyle}>
          <strong style={{ color: colors.text }}>Summary</strong>
          <p style={{ margin: '8px 0 0', color: colors.textSecondary, fontSize: 13 }}>{selectedCase.summary}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={surfaceStyle}>
            <strong style={{ color: colors.text }}>Goals</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: colors.textSecondary, fontSize: 13 }}>
              {selectedCase.goals.map((goal) => <li key={goal}>{goal}</li>)}
            </ul>
          </div>
          <div style={surfaceStyle}>
            <strong style={{ color: colors.text }}>Barriers</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: colors.textSecondary, fontSize: 13 }}>
              {selectedCase.barriers.map((barrier) => <li key={barrier}>{barrier}</li>)}
            </ul>
          </div>
        </div>

        <div style={surfaceStyle}>
          <strong style={{ color: colors.text }}>Quick actions</strong>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {(['active', 'pending documents', 'awaiting partner response', 'follow-up needed', 'resolved', 'closed'] as CaseStatus[]).map((status) => (
              <button
                type="button"
                key={status}
                onClick={() => updateCaseStatus(status)}
                style={{ ...buttonStyle, padding: '7px 9px' }}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div style={surfaceStyle}>
          <strong style={{ color: colors.text }}>Quick note mode</strong>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            <select
              value={structuredNoteType}
              onChange={(event) => setStructuredNoteType(event.target.value)}
              style={{ ...glassInput, borderRadius: 8, padding: 10, color: colors.text }}
            >
              {['outreach contact', 'office visit', 'phone call', 'text / chat', 'referral made', 'document received', 'missed appointment', 'incident / safety note', 'internal case note'].map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <textarea
              value={quickNote}
              onChange={(event) => setQuickNote(event.target.value)}
              placeholder="Type a fast field note. Use structured note mode when compliance fields are required."
              rows={4}
              style={{ ...glassInput, borderRadius: 8, padding: 10, color: colors.text, resize: 'vertical' }}
            />
            <button type="button" style={primaryButtonStyle} onClick={addQuickNote} {...accentButtonHoverHandlers}>
              <MessageSquare size={16} />
              Add note
            </button>
          </div>
        </div>

        <div style={surfaceStyle}>
          <strong style={{ color: colors.text }}>Create task</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, marginTop: 10 }}>
            <input
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              placeholder="Next action"
              style={{ ...glassInput, borderRadius: 8, padding: 10, color: colors.text }}
            />
            <button type="button" style={primaryButtonStyle} onClick={addTask}>
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>

        <div style={surfaceStyle}>
          <strong style={{ color: colors.text }}>Timeline</strong>
          <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>
            {selectedCaseTimeline.map((event) => (
              <div key={event.id} style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', gap: 10 }}>
                <Circle size={10} fill={colors.accent} color={colors.accent} style={{ marginTop: 5 }} />
                <div>
                  <strong style={{ display: 'block', color: colors.text, fontSize: 13 }}>{event.title}</strong>
                  <span style={{ display: 'block', color: colors.textMuted, fontSize: 12 }}>{formatDateTime(event.occurredAt)} · {event.type}</span>
                  <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: 12 }}>{event.detail}</p>
                </div>
              </div>
            ))}
            {selectedCaseTimeline.length === 0 && <EmptyHint text="No timeline events yet." />}
          </div>
        </div>

        <div style={surfaceStyle}>
          <strong style={{ color: colors.text }}>Case panels</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
            {[
              ['Tasks', selectedCaseTasks.length],
              ['Notes', selectedCaseNotes.length],
              ['Referrals', selectedCaseReferrals.length],
              ['Documents', selectedCaseDocuments.length],
              ['Appointments', selectedCaseAppointments.length],
              ['AI alerts', selectedCaseBotAlerts.length],
            ].map(([label, value]) => (
              <div key={label} style={{ border: `1px solid ${colors.border}`, borderRadius: 8, padding: 10 }}>
                <span style={{ display: 'block', color: colors.textMuted, fontSize: 11 }}>{label}</span>
                <strong style={{ color: colors.text, fontSize: 20 }}>{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  function renderTasks() {
    let visibleTasks = taskRecords.filter((task) => relatedRecordMatchesFilters(task.clientId, task.caseId));
    if (taskView === 'my') visibleTasks = taskRecords.filter((task) => task.owner === selectedCase.assignedStaff && relatedRecordMatchesFilters(task.clientId, task.caseId));
    if (taskView === 'today') visibleTasks = taskRecords.filter((task) => getLocalDateKey(task.dueDate) === todayKey && relatedRecordMatchesFilters(task.clientId, task.caseId));
    if (taskView === 'overdue') visibleTasks = overdueTasks.filter((task) => relatedRecordMatchesFilters(task.clientId, task.caseId));
    if (taskView === 'by worker') visibleTasks = taskRecords.filter((task) => relatedRecordMatchesFilters(task.clientId, task.caseId));

    return (
      <section style={panelStyle}>
        <SectionTitle
          icon={ListTodo}
          title="Tasks, Follow-Ups, and Deadlines"
          action={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['my', 'all', 'today', 'overdue', 'by worker'] as const).map((view) => (
                <button
                  type="button"
                  key={view}
                  onClick={() => setTaskView(view)}
                  style={{ ...buttonStyle, padding: '7px 10px', background: taskView === view ? colors.accent : colors.surface, color: taskView === view ? '#000' : colors.text }}
                >
                  {view}
                </button>
              ))}
            </div>
          }
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 16 }}>
          {visibleTasks.map((task) => {
            const client = clientRecords.find((candidate) => candidate.id === task.clientId);
            const caseItem = caseRecords.find((candidate) => candidate.id === task.caseId);
            return (
              <article key={task.id} style={surfaceStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <ListTodo size={18} color={colors.accent} />
                  <PriorityBadge priority={task.priority} />
                </div>
                <h3 style={{ margin: '12px 0 6px', color: colors.text, fontSize: 16 }}>{task.title}</h3>
                <p style={{ margin: 0, color: colors.textSecondary, fontSize: 13 }}>{client ? renderProfileLink(client.fullName) : 'No client'} · {caseItem?.title}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <StatusBadge label={task.status} />
                  <span style={{ color: isOverdue(task.dueDate) ? '#fee2e2' : colors.textSecondary, background: isOverdue(task.dueDate) ? 'rgba(239, 68, 68, 0.24)' : colors.surface, borderRadius: 8, padding: '5px 8px', fontSize: 12, fontWeight: 700 }}>
                    {formatDateTime(task.dueDate)}
                  </span>
                </div>
                <p style={{ margin: '12px 0 0', color: colors.textMuted, fontSize: 12 }}>
                  Owner: {renderProfileLink(task.owner)} · Reminder: {task.reminderRules}
                </p>
                <p style={{ margin: '6px 0 0', color: colors.textMuted, fontSize: 12 }}>Blocker: {task.dependency}</p>
                <button
                  type="button"
                  style={{ ...buttonStyle, marginTop: 12, width: '100%' }}
                  onClick={() => completeTask(task.id)}
                  disabled={task.status === 'complete'}
                >
                  <CheckCircle2 size={16} />
                  {task.status === 'complete' ? 'Completed' : 'Mark complete'}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  function renderCalendar() {
    const visibleAppointments = appointmentRecords.filter((appointment) => relatedRecordMatchesFilters(appointment.clientId, appointment.caseId));
    return (
      <section style={panelStyle}>
        <SectionTitle icon={Calendar} title="Appointments and Calendar Links" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 16 }}>
          {visibleAppointments.map((appointment) => {
            const client = clientRecords.find((candidate) => candidate.id === appointment.clientId);
            const caseItem = caseRecords.find((candidate) => candidate.id === appointment.caseId);
            return (
              <article key={appointment.id} style={surfaceStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <Calendar size={18} color={colors.accent} />
                  <StatusBadge label={appointment.attendanceStatus === 'attended' ? 'complete' : appointment.attendanceStatus === 'missed' ? 'follow-up needed' : 'scheduled'} />
                </div>
                <h3 style={{ margin: '12px 0 6px', color: colors.text, fontSize: 16 }}>{appointment.purpose}</h3>
                <p style={{ margin: 0, color: colors.textSecondary, fontSize: 13 }}>
                  {client ? renderProfileLink(client.fullName) : 'No client'} · {caseItem?.title}
                </p>
                <p style={{ margin: '10px 0 0', color: colors.text, fontSize: 14, fontWeight: 750 }}>{formatDateTime(appointment.dateTime)}</p>
                <p style={{ margin: '6px 0 0', color: colors.textMuted, fontSize: 12 }}>
                  {renderDirectoryLink(appointment.location)} · {renderDirectoryLink(appointment.serviceProvider)}
                </p>
                <strong style={{ display: 'block', marginTop: 12, color: colors.text, fontSize: 13 }}>Preparation checklist</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: colors.textSecondary, fontSize: 12 }}>
                  {appointment.prepChecklist.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>
            );
          })}
          {visibleAppointments.length === 0 && <EmptyHint text="No appointments match the current filters." />}
        </div>
      </section>
    );
  }

  function renderReferrals() {
    const visibleReferrals = referralRecords.filter((referral) => relatedRecordMatchesFilters(referral.clientId, referral.caseId));
    return (
      <section style={panelStyle}>
        <SectionTitle icon={ArrowRight} title="Referral and Resource Tracking" />
        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
            <thead>
              <tr style={{ color: colors.textMuted, fontSize: 12, textAlign: 'left' }}>
                {['Organization', 'Category', 'Client', 'Referral date', 'Status', 'Contact', 'Appointment', 'Outcome', 'Documents'].map((head) => (
                  <th key={head} style={{ padding: '10px 8px', borderBottom: `1px solid ${colors.border}` }}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleReferrals.map((referral) => {
                const client = clientRecords.find((candidate) => candidate.id === referral.clientId);
                return (
                  <tr key={referral.id}>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.text }}><strong>{renderDirectoryLink(referral.organization)}</strong></td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{referral.serviceCategory}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{client ? renderProfileLink(client.fullName) : 'No client'}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{formatDate(referral.referralDate)}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}><StatusBadge label={referral.status} /></td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{referral.contactPerson}<br />{referral.contact}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{formatDateTime(referral.appointmentDate)}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{referral.outcome}</td>
                    <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>{referral.supportingDocuments.join(', ')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleReferrals.length === 0 && <div style={{ padding: 12 }}><EmptyHint text="No referrals match the current filters." /></div>}
        </div>
        <div style={{ marginTop: 18 }}>
          <SectionTitle icon={Building2} title="Partner Resource Directory" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 12, marginTop: 14 }}>
            {organizationRecords.map((organization) => (
              <article key={organization.id} style={{ ...surfaceStyle, opacity: organization.active ? 1 : 0.62 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block' }}>{renderDirectoryLink(organization.name)}</strong>
                    <span style={{ display: 'block', marginTop: 4, color: colors.textMuted, fontSize: 12 }}>
                      {organization.contactPerson} · {organization.contact}
                    </span>
                  </span>
                  <span style={{ color: organization.preferred ? '#d1fae5' : colors.textSecondary, background: organization.preferred ? 'rgba(34, 197, 94, 0.20)' : colors.surface, borderRadius: 8, padding: '5px 8px', fontSize: 12, fontWeight: 700 }}>
                    {organization.preferred ? 'Preferred' : organization.active ? 'Active' : 'Archived'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {organization.serviceCategories.map((category) => (
                    <span key={category} style={{ color: colors.textSecondary, background: colors.surface, borderRadius: 8, padding: '5px 8px', fontSize: 12 }}>
                      {category}
                    </span>
                  ))}
                </div>
                <p style={{ margin: '10px 0 0', color: colors.textSecondary, fontSize: 13 }}>{organization.eligibility}</p>
                <p style={{ margin: '8px 0 0', color: colors.textMuted, fontSize: 12 }}>
                  {organization.phone} · average turnaround {organization.averageTurnaroundDays} day{organization.averageTurnaroundDays === 1 ? '' : 's'}
                </p>
                <button
                  type="button"
                  style={{ ...buttonStyle, marginTop: 12, width: '100%' }}
                  onClick={() => startReferralWithOrganization(organization)}
                  disabled={!organization.active}
                >
                  <ArrowRight size={14} />
                  Start referral
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function renderDocuments() {
    const visibleDocuments = documentRecords.filter((document) => relatedRecordMatchesFilters(document.clientId, document.caseId));
    return (
      <section style={panelStyle}>
        <SectionTitle
          icon={FolderOpen}
          title="Documents and Files"
          action={
            <button
              type="button"
              style={primaryButtonStyle}
              onClick={() => documentInputRef.current?.click()}
              {...accentButtonHoverHandlers}
            >
              <Upload size={16} />
              Upload file
            </button>
          }
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 16, marginTop: 16 }}>
          <div
            style={{
              ...surfaceStyle,
              borderStyle: 'dashed',
              minHeight: 220,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: 10,
            }}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              addDocumentsFromFiles(event.dataTransfer.files);
            }}
          >
            <Paperclip size={28} color={colors.accent} />
            <strong style={{ color: colors.text }}>Drag and drop documents</strong>
            <p style={{ margin: 0, color: colors.textSecondary, fontSize: 13, maxWidth: 260 }}>
              Upload ID scans, signed consent, referral letters, benefits paperwork, care plans, and discharge forms.
            </p>
            <button type="button" style={buttonStyle} onClick={() => documentInputRef.current?.click()}>Browse files</button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {visibleDocuments.map((document) => {
              const client = clientRecords.find((candidate) => candidate.id === document.clientId);
              return (
                <article key={document.id} style={{ ...surfaceStyle, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: 12, alignItems: 'center' }}>
                  <FileText size={22} color={colors.accent} />
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', color: colors.text, fontSize: 14 }}>{document.name}</strong>
                    <span style={{ display: 'block', color: colors.textSecondary, fontSize: 12 }}>
                      {client ? renderProfileLink(client.fullName) : 'No client'} · {document.type} · {document.tag} · {document.permission}
                    </span>
                    <span style={{ display: 'block', color: colors.textMuted, fontSize: 12 }}>
                      OCR searchable: {document.searchableText}
                    </span>
                  </span>
                  <span style={{ color: colors.textMuted, fontSize: 12 }}>{formatDateTime(document.uploadedAt)}</span>
                </article>
              );
            })}
            {visibleDocuments.length === 0 && <EmptyHint text="No documents match the current filters." />}
          </div>
        </div>
      </section>
    );
  }

  function renderReports() {
    const reports = [
      ['Caseload report', 'Open caseload by worker, team, type, priority, and age'],
      ['Case outcome report', 'Resolved and closed cases with closure reasons'],
      ['Overdue follow-up report', 'Tasks, appointments, and cases that need action'],
      ['Referral status report', 'Referral turnaround, completion rate, and stalled partners'],
      ['Staff activity report', 'Notes, tasks, handoffs, and document changes by staff'],
      ['Custom date range exports', 'Operational and impact data by program period'],
    ];
    const reportCaseRecords = searchableCases.filter((caseItem) =>
      recordTouchesReportRange(caseItem.openedDate, caseItem.targetResolutionDate, caseItem.nextFollowUp, caseItem.closedDate),
    );
    const reportReferralRecords = referralRecords.filter((referral) =>
      relatedRecordMatchesFilters(referral.clientId, referral.caseId) && recordTouchesReportRange(referral.referralDate, referral.appointmentDate),
    );
    const reportAppointmentRecords = appointmentRecords.filter((appointment) =>
      relatedRecordMatchesFilters(appointment.clientId, appointment.caseId) && isWithinReportRange(appointment.dateTime),
    );
    const caseTypeCounts = reportCaseRecords.reduce<Record<string, number>>((counts, caseItem) => {
      counts[caseItem.type] = (counts[caseItem.type] ?? 0) + 1;
      return counts;
    }, {});
    const topCaseTypes = Object.entries(caseTypeCounts)
      .sort(([, left], [, right]) => right - left)
      .slice(0, 3)
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ');
    const completedReferralCount = reportReferralRecords.filter((referral) => ['completed', 'closed', 'scheduled'].includes(referral.status)).length;
    const referralCompletionRate = reportReferralRecords.length ? Math.round((completedReferralCount / reportReferralRecords.length) * 100) : 0;
    const attendedAppointmentCount = reportAppointmentRecords.filter((appointment) => appointment.attendanceStatus === 'attended').length;
    const appointmentAttendanceRate = reportAppointmentRecords.length ? Math.round((attendedAppointmentCount / reportAppointmentRecords.length) * 100) : 0;
    const topBarriers =
      Object.entries(
        reportCaseRecords.flatMap((caseItem) => caseItem.barriers).reduce<Record<string, number>>((counts, barrier) => {
          counts[barrier] = (counts[barrier] ?? 0) + 1;
          return counts;
        }, {}),
      )
        .sort(([, left], [, right]) => right - left)
        .slice(0, 4)
        .map(([barrier]) => barrier)
        .join(', ') || 'No barriers recorded';
    const reportMetrics = [
      ['Active cases by type', topCaseTypes || 'No active case types yet'],
      ['Referral completion rate', `${referralCompletionRate}% completed, scheduled, or closed`],
      ['Appointment attendance rate', `${appointmentAttendanceRate}% attended in visible appointments`],
      ['Top barriers', topBarriers],
    ];
    const reportFieldStyle = {
      ...glassInput,
      borderRadius: 8,
      color: colors.text,
      padding: '9px 10px',
      width: '100%',
    } satisfies React.CSSProperties;
    const reportLabelStyle = { display: 'grid', gap: 6, color: colors.textMuted, fontSize: 12, fontWeight: 700 } satisfies React.CSSProperties;

    return (
      <section style={panelStyle}>
        <SectionTitle icon={BarChart3} title="Reporting and Outcomes" />
        <div style={{ ...surfaceStyle, display: 'grid', gap: 12, marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>
              <strong style={{ display: 'block', color: colors.text }}>Custom report range</strong>
              <span style={{ display: 'block', marginTop: 4, color: colors.textMuted, fontSize: 12 }}>
                Exports use {reportRangeLabel.toLowerCase()} and the active saved view filters.
              </span>
            </span>
            <button
              type="button"
              style={{ ...buttonStyle, padding: '7px 10px' }}
              onClick={() => {
                setReportStartDate('');
                setReportEndDate('');
                setDraftNotice('Report date range cleared.');
              }}
            >
              <X size={14} />
              Clear range
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 10 }}>
            <label style={reportLabelStyle}>
              Start date
              <input
                type="date"
                value={reportStartDate}
                onChange={(event) => {
                  setReportStartDate(event.target.value);
                  setDraftNotice('Report date range updated.');
                }}
                style={reportFieldStyle}
              />
            </label>
            <label style={reportLabelStyle}>
              End date
              <input
                type="date"
                value={reportEndDate}
                onChange={(event) => {
                  setReportEndDate(event.target.value);
                  setDraftNotice('Report date range updated.');
                }}
                style={reportFieldStyle}
              />
            </label>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 16 }}>
          {reportMetrics.map(([title, detail]) => (
            <div key={title} style={surfaceStyle}>
              <BarChart3 size={18} color={colors.accent} />
              <strong style={{ display: 'block', marginTop: 10, color: colors.text }}>{title}</strong>
              <p style={{ margin: '6px 0 0', color: colors.textSecondary, fontSize: 13 }}>{detail}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 16 }}>
          {reports.map(([title, detail]) => (
            <article key={title} style={surfaceStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <ClipboardCheck size={18} color={colors.accent} />
                <button type="button" style={{ ...buttonStyle, padding: '6px 8px' }} onClick={() => exportReport(title)}>
                  <Download size={14} />
                  Export
                </button>
              </div>
              <strong style={{ display: 'block', marginTop: 10, color: colors.text }}>{title}</strong>
              <p style={{ margin: '6px 0 0', color: colors.textSecondary, fontSize: 13 }}>{detail}</p>
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderSettings() {
    const settingsFieldStyle = {
      ...glassInput,
      borderRadius: 8,
      color: colors.text,
      padding: '9px 10px',
      width: '100%',
    } satisfies React.CSSProperties;
    const settingsLabelStyle = { display: 'grid', gap: 6, color: colors.textMuted, fontSize: 12, fontWeight: 700 } satisfies React.CSSProperties;

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <section style={panelStyle}>
          <SectionTitle icon={ShieldCheck} title="Roles and Permissions" />
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {roles.map((item) => (
              <div key={item.role} style={surfaceStyle}>
                <strong style={{ color: colors.text }}>{item.role}</strong>
                <p style={{ margin: '6px 0 0', color: colors.textSecondary, fontSize: 13 }}>{item.permission}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={panelStyle}>
          <SectionTitle icon={Workflow} title="Case Types and Workflows" />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveCaseTypeDraft();
            }}
            style={{ ...surfaceStyle, display: 'grid', gap: 10, marginTop: 14 }}
          >
            <label style={settingsLabelStyle}>
              Case type name
              <input
                value={caseTypeDraft.name}
                onChange={(event) => updateCaseTypeDraft('name', event.target.value)}
                placeholder="Medical coordination"
                style={settingsFieldStyle}
              />
            </label>
            <label style={settingsLabelStyle}>
              Workflow steps
              <input
                value={caseTypeDraft.workflow}
                onChange={(event) => updateCaseTypeDraft('workflow', event.target.value)}
                placeholder="Intake, consent check, referral, follow-up, closure"
                style={settingsFieldStyle}
              />
            </label>
            <label style={settingsLabelStyle}>
              Success criteria
              <textarea
                value={caseTypeDraft.successCriteria}
                onChange={(event) => updateCaseTypeDraft('successCriteria', event.target.value)}
                rows={3}
                placeholder="What must be true before this case type can close?"
                style={{ ...settingsFieldStyle, resize: 'vertical' }}
              />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" style={buttonStyle} onClick={() => setCaseTypeDraft(emptyCaseTypeDraft)} {...buttonHoverHandlers}>
                Clear
              </button>
              <button type="submit" style={primaryButtonStyle} {...accentButtonHoverHandlers}>
                <Plus size={16} />
                Save workflow
              </button>
            </div>
          </form>
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {caseTypeRecords.map((type) => (
              <article key={type.id} style={surfaceStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
                  <strong style={{ color: colors.text }}>{type.name}</strong>
                  <button
                    type="button"
                    style={{ ...buttonStyle, padding: '5px 8px' }}
                    onClick={() => {
                      setCaseTypeDraft({
                        name: type.name,
                        workflow: type.workflow.join(', '),
                        successCriteria: type.successCriteria,
                      });
                    }}
                  >
                    Edit
                  </button>
                </div>
                <p style={{ margin: '6px 0', color: colors.textSecondary, fontSize: 13 }}>{type.successCriteria}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {type.workflow.map((step) => (
                    <span key={step} style={{ color: colors.textSecondary, background: colors.surface, borderRadius: 8, padding: '5px 8px', fontSize: 12 }}>{step}</span>
                  ))}
                </div>
                <button type="button" style={{ ...buttonStyle, marginTop: 10, padding: '6px 8px' }} onClick={() => removeCaseType(type)}>
                  <X size={14} />
                  Remove
                </button>
              </article>
            ))}
          </div>
        </section>

        <section style={panelStyle}>
          <SectionTitle icon={Building2} title="Partner Organization Directory" />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveOrganizationDraft();
            }}
            style={{ ...surfaceStyle, display: 'grid', gap: 10, marginTop: 14 }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 10 }}>
              <label style={settingsLabelStyle}>
                Organization
                <input
                  value={organizationDraft.name}
                  onChange={(event) => updateOrganizationDraft('name', event.target.value)}
                  placeholder="Partner agency or program"
                  style={settingsFieldStyle}
                />
              </label>
              <label style={settingsLabelStyle}>
                Categories
                <input
                  value={organizationDraft.serviceCategories}
                  onChange={(event) => updateOrganizationDraft('serviceCategories', event.target.value)}
                  placeholder="Housing, ID replacement"
                  style={settingsFieldStyle}
                />
              </label>
              <label style={settingsLabelStyle}>
                Contact person
                <input
                  value={organizationDraft.contactPerson}
                  onChange={(event) => updateOrganizationDraft('contactPerson', event.target.value)}
                  placeholder="Intake desk"
                  style={settingsFieldStyle}
                />
              </label>
              <label style={settingsLabelStyle}>
                Email or contact
                <input
                  value={organizationDraft.contact}
                  onChange={(event) => updateOrganizationDraft('contact', event.target.value)}
                  placeholder="intake@example.org"
                  style={settingsFieldStyle}
                />
              </label>
              <label style={settingsLabelStyle}>
                Phone
                <input
                  value={organizationDraft.phone}
                  onChange={(event) => updateOrganizationDraft('phone', event.target.value)}
                  placeholder="555-0100"
                  style={settingsFieldStyle}
                />
              </label>
              <label style={settingsLabelStyle}>
                Turnaround days
                <input
                  type="number"
                  min="0"
                  value={organizationDraft.averageTurnaroundDays}
                  onChange={(event) => updateOrganizationDraft('averageTurnaroundDays', event.target.value)}
                  style={settingsFieldStyle}
                />
              </label>
            </div>
            <label style={settingsLabelStyle}>
              Address or location
              <input
                value={organizationDraft.address}
                onChange={(event) => updateOrganizationDraft('address', event.target.value)}
                placeholder="Program location or service area"
                style={settingsFieldStyle}
              />
            </label>
            <label style={settingsLabelStyle}>
              Eligibility
              <textarea
                value={organizationDraft.eligibility}
                onChange={(event) => updateOrganizationDraft('eligibility', event.target.value)}
                rows={2}
                placeholder="Who should be referred and what is required?"
                style={{ ...settingsFieldStyle, resize: 'vertical' }}
              />
            </label>
            <label style={settingsLabelStyle}>
              Partner notes
              <textarea
                value={organizationDraft.notes}
                onChange={(event) => updateOrganizationDraft('notes', event.target.value)}
                rows={2}
                placeholder="Useful context for case managers"
                style={{ ...settingsFieldStyle, resize: 'vertical' }}
              />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" style={buttonStyle} onClick={() => setOrganizationDraft(emptyOrganizationDraft)} {...buttonHoverHandlers}>
                Clear
              </button>
              <button type="submit" style={primaryButtonStyle} {...accentButtonHoverHandlers}>
                <Plus size={16} />
                Save resource
              </button>
            </div>
          </form>
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {organizationRecords.map((organization) => (
              <article key={organization.id} style={{ ...surfaceStyle, opacity: organization.active ? 1 : 0.62 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
                  <span>
                    <strong style={{ display: 'block', color: colors.text }}>{renderDirectoryLink(organization.name)}</strong>
                    <span style={{ display: 'block', marginTop: 4, color: colors.textMuted, fontSize: 12 }}>
                      {organization.contactPerson} · {organization.contact} · {organization.phone}
                    </span>
                  </span>
                  <span style={{ color: organization.active ? colors.textSecondary : '#fed7aa', background: colors.surface, borderRadius: 8, padding: '5px 8px', fontSize: 12, fontWeight: 700 }}>
                    {organization.active ? 'Active' : 'Archived'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {organization.serviceCategories.map((category) => (
                    <span key={category} style={{ color: colors.textSecondary, background: colors.surface, borderRadius: 8, padding: '5px 8px', fontSize: 12 }}>
                      {category}
                    </span>
                  ))}
                </div>
                <p style={{ margin: '10px 0 0', color: colors.textSecondary, fontSize: 13 }}>{organization.eligibility}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  <button
                    type="button"
                    style={{ ...buttonStyle, padding: '6px 8px' }}
                    onClick={() => {
                      setOrganizationDraft({
                        name: organization.name,
                        serviceCategories: organization.serviceCategories.join(', '),
                        contactPerson: organization.contactPerson,
                        contact: organization.contact,
                        phone: organization.phone,
                        address: organization.address,
                        eligibility: organization.eligibility,
                        notes: organization.notes,
                        averageTurnaroundDays: String(organization.averageTurnaroundDays),
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    style={{ ...buttonStyle, padding: '6px 8px' }}
                    onClick={() => {
                      setOrganizationRecords((records) =>
                        records.map((record) => (record.id === organization.id ? { ...record, preferred: !record.preferred } : record)),
                      );
                      addAuditEvent({
                        actor: 'Current worker',
                        action: organization.preferred ? 'unmarked preferred organization' : 'marked preferred organization',
                        object: organization.name,
                      });
                    }}
                  >
                    {organization.preferred ? 'Unmark preferred' : 'Mark preferred'}
                  </button>
                  <button type="button" style={{ ...buttonStyle, padding: '6px 8px' }} onClick={() => removeOrganization(organization)}>
                    <X size={14} />
                    {referralRecords.some((referral) => referral.organization === organization.name) ? 'Archive' : 'Remove'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section style={panelStyle}>
          <SectionTitle icon={Bot} title="Street Bot Automation Rules" />
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {[
              'When case created -> auto-create intake checklist',
              'When referral sent -> create follow-up task in 3 days',
              'When no contact for 14 days -> flag as dormant',
              'When note mentions urgent housing need -> raise priority suggestion',
              'When case closed -> request closure summary',
            ].map((rule) => (
              <div key={rule} style={{ ...surfaceStyle, display: 'flex', gap: 10, alignItems: 'center' }}>
                <Sparkles size={16} color={colors.accent} />
                <span style={{ color: colors.textSecondary, fontSize: 13 }}>{rule}</span>
              </div>
            ))}
            <div style={{ ...surfaceStyle, display: 'grid', gap: 8 }}>
              <strong style={{ color: colors.text }}>Active automation signals</strong>
              <p style={{ margin: 0, color: colors.textSecondary, fontSize: 13 }}>
                {visibleNotifications.length} workflow notification{visibleNotifications.length === 1 ? '' : 's'} currently need review.
              </p>
            </div>
          </div>
        </section>

        <section style={panelStyle}>
          <SectionTitle icon={Lock} title="Privacy, Audit, and Compliance" />
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {[
              'Role-based access control',
              'Encrypted document storage',
              'Sensitive note visibility controls',
              'Soft delete and archive by default',
              'Consent tracking',
              'Session timeout and export controls',
            ].map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, color: colors.textSecondary, fontSize: 13 }}>
                <CheckCircle2 size={16} color="#22c55e" />
                {item}
              </div>
            ))}
          </div>
          <button type="button" style={{ ...buttonStyle, marginTop: 16 }} onClick={resetWorkspace}>
            <History size={16} />
            Reset local draft
          </button>
          <strong style={{ display: 'block', marginTop: 18, color: colors.text }}>Recent audit log</strong>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {auditRecords.map((event) => (
              <div key={event.id} style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 8, color: colors.textSecondary, fontSize: 12 }}>
                <strong style={{ color: colors.text }}>{event.actor}</strong> {event.action} · {event.object}
                <span style={{ display: 'block', color: colors.textMuted }}>{formatDateTime(event.timestamp)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }
}

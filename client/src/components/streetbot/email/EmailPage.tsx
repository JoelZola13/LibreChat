import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Ban,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Copy,
  Eye,
  FileText,
  FileSearch,
  Globe2,
  LayoutDashboard,
  Mail,
  MessageSquareText,
  MousePointerClick,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useResponsive } from '../hooks/useResponsive';
import { useGlassStyles } from '../shared/useGlassStyles';
import { useAuthContext } from '~/hooks/AuthContext';

type EmailSectionId = 'dashboard' | 'analytics' | 'campaigns' | 'templates' | 'lists' | 'subscribers' | 'users' | 'settings';

type EmailSection = {
  id: EmailSectionId;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

type EmailList = {
  id: number;
  name: string;
  type: string;
  status: string;
  optin: string;
  tags: string[];
  description: string;
  subscriberCount: number;
  confirmedCount: number;
  updatedAt: string | null;
};

type EmailSubscriber = {
  id: number;
  email: string;
  name: string;
  status: string;
  lists: Array<{ id: number; name: string; status: string }>;
  createdAt: string | null;
  updatedAt: string | null;
};

type EmailCampaign = {
  id: number;
  name: string;
  subject: string;
  fromEmail: string;
  status: string;
  type: string;
  contentType: string;
  body: string;
  bodySource: string;
  altbody: string;
  sendAt: string | null;
  templateId: number;
  messenger: string;
  sent: number;
  toSend: number;
  views: number;
  clicks: number;
  bounces: number;
  listIds: number[];
  lists: string[];
  tags: string[];
  createdAt: string | null;
  updatedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
};

type CampaignEditorMode = 'create' | 'edit';
type TemplateEditorMode = 'create' | 'edit';

type CampaignFormState = {
  id?: number;
  name: string;
  subject: string;
  fromEmail: string;
  type: string;
  contentType: string;
  body: string;
  altbody: string;
  sendAt: string;
  messenger: string;
  templateId: string;
  tags: string;
  lists: number[];
};

type EmailTemplate = {
  id: number;
  name: string;
  subject: string;
  type: string;
  body: string;
  updatedAt: string | null;
  createdAt: string | null;
};

type TemplateFormState = {
  id?: number;
  name: string;
  subject: string;
  type: string;
  body: string;
};

type EmailUser = {
  id: number;
  username: string;
  name: string;
  email: string;
  status: string;
  role: string;
  loggedInAt: string | null;
};

type EmailSettings = {
  siteName: string;
  rootUrl: string;
  logoUrl: string;
  fromEmail: string;
  publicSubscriptionPage: boolean;
  publicArchive: boolean;
  language: string;
  smtpEnabled: boolean;
  smtpHosts: string[];
};

type EmailDashboardData = {
  connected: boolean;
  source?: {
    label: string;
    baseUrl: string;
  };
  metrics: {
    lists: {
      total: number;
      public: number;
      private: number;
    };
    subscribers: {
      total: number;
      enabled: number;
      blocklisted: number;
      orphans: number;
    };
    campaigns: {
      total: number;
      byStatus: Record<string, number>;
    };
    messagesSent: number;
    opens: number;
    clicks: number;
    lastSevenDays: {
      campaigns: number;
      sent: number;
      opens: number;
      clicks: number;
    };
  };
  lists: EmailList[];
  subscribers: EmailSubscriber[];
  campaigns: EmailCampaign[];
  templates: EmailTemplate[];
  users: EmailUser[];
  settings: EmailSettings;
  refreshedAt?: string;
  message?: string;
  error?: string;
};

type TableColumn<T> = {
  label: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
};

type TableOptions<T> = {
  rowLabel?: (row: T) => string;
  onRowClick?: (row: T) => void;
  isSelected?: (row: T) => boolean;
};

const sections: EmailSection[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Campaign health, recent sends, and email activity from Listmonk.',
    href: '/email',
    icon: LayoutDashboard,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Opens, clicks, send progress, and per-campaign performance.',
    href: '/email/analytics',
    icon: BarChart3,
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    description: 'Drafts, scheduled sends, and completed broadcasts.',
    href: '/email/campaigns',
    icon: Rocket,
  },
  {
    id: 'templates',
    label: 'Templates',
    description: 'Reusable Listmonk campaign templates and sender layouts.',
    href: '/email/templates',
    icon: FileText,
  },
  {
    id: 'lists',
    label: 'Lists',
    description: 'Audience groups and consent-ready list segments.',
    href: '/email/lists',
    icon: ClipboardList,
  },
  {
    id: 'subscribers',
    label: 'Subscribers',
    description: 'Contacts, imports, and audience status.',
    href: '/email/subscribers',
    icon: Users,
  },
  {
    id: 'users',
    label: 'Users',
    description: 'Team members and sender permissions.',
    href: '/email/users',
    icon: MessageSquareText,
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Branding, delivery, and compliance defaults.',
    href: '/email/settings',
    icon: Settings,
  },
];

const fallbackData: EmailDashboardData = {
  connected: false,
  metrics: {
    lists: { total: 6, public: 2, private: 4 },
    subscribers: { total: 3, enabled: 3, blocklisted: 0, orphans: 0 },
    campaigns: { total: 2, byStatus: { finished: 2 } },
    messagesSent: 4,
    opens: 0,
    clicks: 0,
    lastSevenDays: { campaigns: 0, sent: 0, opens: 0, clicks: 0 },
  },
  lists: [],
  subscribers: [],
  campaigns: [],
  templates: [],
  users: [],
  settings: {
    siteName: 'Street Voices',
    rootUrl: '',
    logoUrl: '',
    fromEmail: '',
    publicSubscriptionPage: false,
    publicArchive: false,
    language: 'en',
    smtpEnabled: false,
    smtpHosts: [],
  },
};

const trendPoints = [18, 31, 47, 56, 52, 61, 73, 71];

function sectionFromPath(pathname: string): EmailSectionId {
  const [, first, second] = pathname.split('/');
  if (first !== 'email') {
    return 'dashboard';
  }
  return sections.some((section) => section.id === second)
    ? (second as EmailSectionId)
    : 'dashboard';
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value || 0);
}

function formatPercent(numerator: number, denominator: number) {
  if (!denominator) {
    return '0%';
  }
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Not yet';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not yet';
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Not yet';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not yet';
  }
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDuration(start: string | null, end: string | null) {
  if (!start || !end) {
    return '';
  }
  const seconds = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  if (!Number.isFinite(seconds)) {
    return '';
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  return `${Math.round(minutes / 60)}h`;
}

function statusLine(byStatus: Record<string, number>) {
  const entries = Object.entries(byStatus || {});
  if (entries.length === 0) {
    return 'No statuses yet';
  }
  return entries.map(([status, count]) => `${formatNumber(count)} ${status}`).join(', ');
}

function joinOrFallback(values: string[], fallback = 'None') {
  return values.length > 0 ? values.join(', ') : fallback;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function campaignFormFromCampaign(campaign: EmailCampaign): CampaignFormState {
  return {
    id: campaign.id,
    name: campaign.name,
    subject: campaign.subject,
    fromEmail: campaign.fromEmail || '',
    type: campaign.type || 'regular',
    contentType: campaign.contentType || 'richtext',
    body: campaign.body || '',
    altbody: campaign.altbody || '',
    sendAt: campaign.sendAt || '',
    messenger: campaign.messenger || 'email',
    templateId: campaign.templateId ? String(campaign.templateId) : '',
    tags: campaign.tags.join(', '),
    lists: campaign.listIds || [],
  };
}

function emptyCampaignForm(lists: EmailList[], fromEmail = ''): CampaignFormState {
  return {
    name: '',
    subject: '',
    fromEmail,
    type: 'regular',
    contentType: 'richtext',
    body: '',
    altbody: '',
    sendAt: '',
    messenger: 'email',
    templateId: '',
    tags: '',
    lists: lists[0]?.id ? [lists[0].id] : [],
  };
}

function templateFormFromTemplate(template: EmailTemplate): TemplateFormState {
  return {
    id: template.id,
    name: template.name,
    subject: template.subject || '',
    type: template.type || 'campaign',
    body: template.body || '',
  };
}

function emptyTemplateForm(): TemplateFormState {
  return {
    name: '',
    subject: '',
    type: 'campaign',
    body: '',
  };
}

function MiniTrend() {
  const width = 620;
  const height = 170;
  const max = Math.max(...trendPoints);
  const min = Math.min(...trendPoints);
  const range = max - min || 1;
  const points = trendPoints
    .map((value, index) => {
      const x = (index / (trendPoints.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 38) - 18;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Campaign activity trend">
      <defs>
        <linearGradient id="email-trend-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#FFD600" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#FFD600" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[38, 78, 118, 158].map((y) => (
        <line
          key={y}
          x1="0"
          x2={width}
          y1={y}
          y2={y}
          stroke="currentColor"
          strokeDasharray="7 10"
          strokeOpacity="0.14"
        />
      ))}
      <polygon points={`0,${height} ${points} ${width},${height}`} fill="url(#email-trend-fill)" />
      <polyline points={points} fill="none" stroke="#FFD600" strokeWidth="4" strokeLinecap="round" />
      {trendPoints.map((value, index) => {
        const x = (index / (trendPoints.length - 1)) * width;
        const y = height - ((value - min) / range) * (height - 38) - 18;
        return <circle key={`${value}-${index}`} cx={x} cy={y} r="5" fill="#FFD600" />;
      })}
    </svg>
  );
}

export default function EmailPage() {
  const { colors, glassCard, glassButton, accentButton } = useGlassStyles();
  const { isMobile, isTablet, width } = useResponsive();
  const compactComposer = isMobile || isTablet || width < 1320;
  const campaignComposerUsesInternalScroll = !compactComposer;
  const { token } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const activeSectionId = sectionFromPath(location.pathname);
  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeSectionId) ?? sections[0],
    [activeSectionId],
  );
  const isCampaignsView = activeSectionId === 'campaigns';
  const compactEmailNav = isMobile || width < 980;
  const emailNavText = isCampaignsView ? '#262626' : colors.text;
  const emailNavSecondary = isCampaignsView ? '#343434' : colors.textSecondary;
  const emailNavMuted = isCampaignsView ? '#777' : colors.textMuted;
  const [dashboard, setDashboard] = useState<EmailDashboardData>(fallbackData);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [selectedSubscriberId, setSelectedSubscriberId] = useState<number | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [campaignEditorMode, setCampaignEditorMode] = useState<CampaignEditorMode | null>(null);
  const [campaignForm, setCampaignForm] = useState<CampaignFormState>(() => emptyCampaignForm([]));
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignPreview, setCampaignPreview] = useState<EmailCampaign | null>(null);
  const [campaignFeedback, setCampaignFeedback] = useState<string | null>(null);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [isSavingCampaign, setIsSavingCampaign] = useState(false);
  const [templateEditorMode, setTemplateEditorMode] = useState<TemplateEditorMode | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(() => emptyTemplateForm());
  const [templateFeedback, setTemplateFeedback] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const refreshDashboard = async () => {
    setIsLoading(true);
    setLoadError(null);
    if (!token) {
      return;
    }
    try {
      const response = await fetch('/api/email/dashboard', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as EmailDashboardData;
      if (!response.ok || !payload.connected) {
        throw new Error(payload.error || payload.message || 'Listmonk data is unavailable');
      }
      setDashboard(payload);
      setSelectedListId((current) => current ?? payload.lists[0]?.id ?? null);
      setSelectedSubscriberId((current) => current ?? payload.subscribers[0]?.id ?? null);
      setSelectedCampaignId((current) => current ?? payload.campaigns[0]?.id ?? null);
      setSelectedTemplateId((current) => current ?? payload.templates[0]?.id ?? null);
      setSelectedUserId((current) => current ?? payload.users[0]?.id ?? null);
    } catch (error) {
      setDashboard((current) => ({ ...fallbackData, ...current, connected: false }));
      setLoadError(error instanceof Error ? error.message : 'Listmonk data is unavailable');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshDashboard();
  }, [token]);

  useEffect(() => {
    if (!campaignEditorMode) {
      setCampaignForm((current) =>
        current.lists.length > 0 ? current : emptyCampaignForm(dashboard.lists, dashboard.settings.fromEmail),
      );
    }
  }, [campaignEditorMode, dashboard.lists, dashboard.settings.fromEmail]);

  const metricCards = [
    {
      label: 'Lists',
      value: dashboard.metrics.lists.total,
      detail: `${dashboard.metrics.lists.public} public, ${dashboard.metrics.lists.private} private`,
      icon: ClipboardList,
      color: '#FFD600',
    },
    {
      label: 'Subscribers',
      value: dashboard.metrics.subscribers.total,
      detail: `${dashboard.metrics.subscribers.blocklisted} blocklisted, ${dashboard.metrics.subscribers.orphans} orphans`,
      icon: Users,
      color: '#38BDF8',
    },
    {
      label: 'Campaigns',
      value: dashboard.metrics.campaigns.total,
      detail: statusLine(dashboard.metrics.campaigns.byStatus),
      icon: Rocket,
      color: '#F97316',
    },
    {
      label: 'Messages sent',
      value: dashboard.metrics.messagesSent,
      detail: dashboard.connected ? 'Live Listmonk total' : 'Local fallback total',
      icon: Mail,
      color: '#A78BFA',
    },
  ];

  const badge = (label: string, tone: 'accent' | 'muted' | 'success' = 'muted') => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        border: `1px solid ${tone === 'accent' ? colors.accent : colors.border}`,
        borderRadius: 999,
        color: tone === 'accent' ? colors.accent : tone === 'success' ? colors.success : colors.textMuted,
        padding: '3px 8px',
        fontSize: 11,
        fontWeight: 750,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );

  const panel = (title: string, children: ReactNode, icon?: LucideIcon) => {
    const Icon = icon;
    return (
      <section style={{ ...glassCard, padding: 22, borderRadius: 18 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            marginBottom: 16,
          }}
        >
          <h2 style={{ color: colors.text, fontSize: 20, margin: 0 }}>{title}</h2>
          {Icon ? <Icon size={20} style={{ color: colors.accent, flexShrink: 0 }} /> : null}
        </div>
        {children}
      </section>
    );
  };

  const selectedList = dashboard.lists.find((row) => row.id === selectedListId) ?? dashboard.lists[0];
  const selectedSubscriber =
    dashboard.subscribers.find((row) => row.id === selectedSubscriberId) ?? dashboard.subscribers[0];
  const selectedCampaign =
    dashboard.campaigns.find((row) => row.id === selectedCampaignId) ?? dashboard.campaigns[0];
  const selectedTemplate =
    dashboard.templates.find((row) => row.id === selectedTemplateId) ?? dashboard.templates[0];
  const selectedUser = dashboard.users.find((row) => row.id === selectedUserId) ?? dashboard.users[0];
  const visibleCampaigns = useMemo(() => {
    const query = campaignSearch.trim().toLowerCase();
    if (!query) {
      return dashboard.campaigns;
    }
    return dashboard.campaigns.filter((campaign) =>
      [
        campaign.name,
        campaign.subject,
        campaign.status,
        campaign.lists.join(' '),
        campaign.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [campaignSearch, dashboard.campaigns]);

  const emailApi = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    if (!token) {
      throw new Error('You need to be signed in before managing email');
    }
    const response = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(payload.error || payload.message || 'Email campaign request failed');
    }
    return payload as T;
  };

  const loadCampaign = async (campaignId: number) => {
    const payload = await emailApi<{ campaign: EmailCampaign }>(`/api/email/campaigns/${campaignId}`);
    return payload.campaign;
  };

  const startNewCampaign = () => {
    setCampaignError(null);
    setCampaignFeedback(null);
    setCampaignEditorMode('create');
    setCampaignForm(emptyCampaignForm(dashboard.lists, dashboard.settings.fromEmail));
    navigate('/email/campaigns');
  };

  const startEditCampaign = async (campaign: EmailCampaign) => {
    setCampaignError(null);
    setCampaignFeedback(null);
    if (campaign.status !== 'draft') {
      setCampaignError('Sent campaigns are locked by Listmonk. Duplicate this campaign to create an editable draft.');
      return;
    }
    try {
      const fullCampaign = await loadCampaign(campaign.id);
      setSelectedCampaignId(fullCampaign.id);
      setCampaignForm(campaignFormFromCampaign(fullCampaign));
      setCampaignEditorMode('edit');
      navigate('/email/campaigns');
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : 'Could not load campaign for editing');
    }
  };

  const duplicateCampaign = async (campaign: EmailCampaign) => {
    setCampaignError(null);
    setCampaignFeedback(null);
    try {
      const fullCampaign = await loadCampaign(campaign.id);
      setCampaignForm({
        ...campaignFormFromCampaign(fullCampaign),
        id: undefined,
        name: `Copy of ${fullCampaign.name}`,
      });
      setCampaignEditorMode('create');
      navigate('/email/campaigns');
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : 'Could not duplicate campaign');
    }
  };

  const previewCampaign = async (campaign: EmailCampaign) => {
    setCampaignError(null);
    setCampaignFeedback(null);
    try {
      const fullCampaign = await loadCampaign(campaign.id);
      setCampaignPreview(fullCampaign);
      setSelectedCampaignId(fullCampaign.id);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : 'Could not load campaign preview');
    }
  };

  const campaignPayloadFromForm = () => ({
    name: campaignForm.name,
    subject: campaignForm.subject,
    from_email: campaignForm.fromEmail,
    type: campaignForm.type,
    content_type: campaignForm.contentType,
    body: campaignForm.body,
    altbody: campaignForm.altbody,
    send_at: campaignForm.sendAt || null,
    messenger: campaignForm.messenger,
    template_id: campaignForm.templateId ? Number(campaignForm.templateId) : undefined,
    tags: campaignForm.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    lists: campaignForm.lists,
  });

  const saveCampaign = async () => {
    setIsSavingCampaign(true);
    setCampaignError(null);
    setCampaignFeedback(null);
    try {
      const isEdit = campaignEditorMode === 'edit' && campaignForm.id;
      const payload = await emailApi<{ campaign: EmailCampaign }>(
        isEdit ? `/api/email/campaigns/${campaignForm.id}` : '/api/email/campaigns',
        {
          method: isEdit ? 'PUT' : 'POST',
          body: JSON.stringify(campaignPayloadFromForm()),
        },
      );
      await refreshDashboard();
      setSelectedCampaignId(payload.campaign.id);
      setCampaignEditorMode(null);
      setCampaignFeedback(isEdit ? 'Campaign draft saved.' : 'Campaign draft created.');
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : 'Could not save campaign');
    } finally {
      setIsSavingCampaign(false);
    }
  };

  const deleteDraftCampaign = async (campaign: EmailCampaign) => {
    if (campaign.status !== 'draft') {
      setCampaignError('Only draft campaigns can be deleted here.');
      return;
    }
    setIsSavingCampaign(true);
    setCampaignError(null);
    setCampaignFeedback(null);
    try {
      await emailApi(`/api/email/campaigns/${campaign.id}`, { method: 'DELETE' });
      setSelectedCampaignId(null);
      setCampaignEditorMode(null);
      await refreshDashboard();
      setCampaignFeedback('Draft campaign deleted.');
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : 'Could not delete draft campaign');
    } finally {
      setIsSavingCampaign(false);
    }
  };

  const changeCampaignStatus = async (campaign: EmailCampaign, status: 'running' | 'cancelled') => {
    if (
      status === 'running' &&
      !window.confirm(`Send "${campaign.name}" now through Listmonk? This will email the selected lists.`)
    ) {
      return;
    }
    setIsSavingCampaign(true);
    setCampaignError(null);
    setCampaignFeedback(null);
    try {
      const payload = await emailApi<{ campaign: EmailCampaign }>(`/api/email/campaigns/${campaign.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      setSelectedCampaignId(payload.campaign.id);
      await refreshDashboard();
      setCampaignFeedback(status === 'running' ? 'Campaign send started.' : 'Campaign stopped.');
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : 'Could not update campaign status');
    } finally {
      setIsSavingCampaign(false);
    }
  };

  const loadTemplate = async (templateId: number) => {
    const payload = await emailApi<{ template: EmailTemplate }>(`/api/email/templates/${templateId}`);
    return payload.template;
  };

  const startNewTemplate = () => {
    setTemplateError(null);
    setTemplateFeedback(null);
    setTemplateEditorMode('create');
    setTemplateForm(emptyTemplateForm());
    navigate('/email/templates');
  };

  const startEditTemplate = async (template: EmailTemplate) => {
    setTemplateError(null);
    setTemplateFeedback(null);
    try {
      const fullTemplate = await loadTemplate(template.id);
      setSelectedTemplateId(fullTemplate.id);
      setTemplateForm(templateFormFromTemplate(fullTemplate));
      setTemplateEditorMode('edit');
      navigate('/email/templates');
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : 'Could not load template for editing');
    }
  };

  const saveTemplate = async () => {
    setIsSavingTemplate(true);
    setTemplateError(null);
    setTemplateFeedback(null);
    try {
      const isEdit = templateEditorMode === 'edit' && templateForm.id;
      const payload = await emailApi<{ template: EmailTemplate }>(
        isEdit ? `/api/email/templates/${templateForm.id}` : '/api/email/templates',
        {
          method: isEdit ? 'PUT' : 'POST',
          body: JSON.stringify({
            name: templateForm.name,
            subject: templateForm.subject,
            type: templateForm.type,
            body: templateForm.body,
          }),
        },
      );
      await refreshDashboard();
      setSelectedTemplateId(payload.template.id);
      setTemplateEditorMode(null);
      setTemplateFeedback(isEdit ? 'Template saved.' : 'Template created.');
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : 'Could not save template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const deleteTemplate = async (template: EmailTemplate) => {
    setIsSavingTemplate(true);
    setTemplateError(null);
    setTemplateFeedback(null);
    try {
      await emailApi(`/api/email/templates/${template.id}`, { method: 'DELETE' });
      setSelectedTemplateId(null);
      setTemplateEditorMode(null);
      await refreshDashboard();
      setTemplateFeedback('Template deleted.');
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : 'Could not delete template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const table = <T,>(
    columns: TableColumn<T>[],
    rows: T[],
    emptyText: string,
    options: TableOptions<T> = {},
  ) => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.label}
                style={{
                  color: colors.textMuted,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.7,
                  padding: '0 10px 10px',
                  textAlign: column.align || 'left',
                  textTransform: 'uppercase',
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  color: colors.textSecondary,
                  padding: '22px 10px',
                  textAlign: 'center',
                }}
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={index}
                tabIndex={options.onRowClick ? 0 : undefined}
                role={options.onRowClick ? 'button' : undefined}
                aria-label={options.rowLabel ? options.rowLabel(row) : undefined}
                onClick={options.onRowClick ? () => options.onRowClick?.(row) : undefined}
                onKeyDown={
                  options.onRowClick
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          options.onRowClick?.(row);
                        }
                      }
                    : undefined
                }
                style={{
                  background: options.isSelected?.(row) ? 'rgba(255, 214, 0, 0.12)' : 'transparent',
                  cursor: options.onRowClick ? 'pointer' : 'default',
                  outline: 'none',
                }}
              >
                {columns.map((column) => (
                  <td
                    key={column.label}
                    style={{
                      color: colors.text,
                      fontSize: 14,
                      padding: '13px 10px',
                      textAlign: column.align || 'left',
                      borderBottom: `1px solid ${colors.border}`,
                      verticalAlign: 'top',
                    }}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const renderStatus = () => {
    if (isLoading) {
      return badge('Loading', 'accent');
    }
    if (dashboard.connected) {
      return badge('Connected', 'success');
    }
    return badge('Offline fallback', 'muted');
  };

  const renderDashboard = () => (
    <>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 14,
          marginBottom: 18,
        }}
      >
        {metricCards.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} style={{ ...glassCard, padding: 18, borderRadius: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `${row.color}1F`,
                    color: row.color,
                  }}
                >
                  <Icon size={19} />
                </div>
                <span style={{ color: colors.textMuted, fontSize: 12, textAlign: 'right' }}>{row.detail}</span>
              </div>
              <div style={{ color: colors.text, fontSize: 32, fontWeight: 850, marginTop: 14 }}>
                {formatNumber(row.value)}
              </div>
              <div
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                }}
              >
                {row.label}
              </div>
            </div>
          );
        })}
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile || isTablet ? '1fr' : 'minmax(0, 1.2fr) minmax(280px, 0.8fr)',
          gap: 18,
          alignItems: 'stretch',
        }}
      >
        {panel(
          'Campaign views',
          <>
            <div style={{ color: colors.text }}>
              <MiniTrend />
            </div>
            <div
              style={{
                borderTop: `1px solid ${colors.border}`,
                marginTop: 16,
                paddingTop: 14,
                color: colors.textSecondary,
                fontSize: 14,
              }}
            >
              {formatNumber(dashboard.metrics.opens)} opens and {formatNumber(dashboard.metrics.clicks)} clicks
              across {formatNumber(dashboard.metrics.campaigns.total)} campaigns.
            </div>
          </>,
          BarChart3,
        )}

        <div style={{ display: 'grid', gap: 18 }}>
          {panel(
            'Quick actions',
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                { label: 'New campaign', icon: Plus, to: '/email/campaigns', onClick: startNewCampaign },
                { label: 'View analytics', icon: BarChart3, to: '/email/analytics' },
                { label: 'Manage templates', icon: FileText, to: '/email/templates' },
                { label: 'Add subscriber', icon: Users, to: '/email/subscribers' },
                { label: 'Manage lists', icon: ClipboardList, to: '/email/lists' },
                { label: 'Search audience', icon: Search, to: '/email/subscribers' },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick || (() => navigate(action.to))}
                    style={{
                      ...glassButton,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '13px 14px',
                      fontSize: 14,
                      fontWeight: 700,
                      textAlign: 'left',
                    }}
                  >
                    <Icon size={17} style={{ color: colors.accent }} />
                    {action.label}
                  </button>
                );
              })}
            </div>,
          )}

          {panel(
            'Last 7 days',
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  ['Sent', dashboard.metrics.lastSevenDays.sent, Mail],
                  ['Opens', dashboard.metrics.lastSevenDays.opens, Eye],
                  ['Clicks', dashboard.metrics.lastSevenDays.clicks, MousePointerClick],
                ].map(([label, value, Icon]) => {
                  const MetricIcon = Icon as LucideIcon;
                  return (
                    <div key={String(label)} style={{ textAlign: 'center' }}>
                      <MetricIcon size={17} style={{ color: colors.accent, margin: '0 auto 8px' }} />
                      <div style={{ color: colors.text, fontSize: 30, fontWeight: 850 }}>
                        {formatNumber(value as number)}
                      </div>
                      <div style={{ color: colors.textMuted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                        {label as string}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ color: colors.textMuted, fontSize: 12, marginTop: 14, textAlign: 'center' }}>
                across {formatNumber(dashboard.metrics.lastSevenDays.campaigns)} campaigns
              </div>
            </>,
          )}
        </div>
      </section>
    </>
  );

  const renderLists = () =>
    panel(
      'Lists',
      <>
        {table<EmailList>(
          [
            {
              label: 'Name',
              render: (row) => (
                <div>
                  <div style={{ fontWeight: 800 }}>{row.name}</div>
                  <div style={{ color: colors.textMuted, fontSize: 12, marginTop: 3 }}>{row.description || 'No description'}</div>
                </div>
              ),
            },
            { label: 'Type', render: (row) => badge(row.type, row.type === 'public' ? 'accent' : 'muted') },
            { label: 'Status', render: (row) => badge(row.status, row.status === 'active' ? 'success' : 'muted') },
            { label: 'Subscribers', align: 'right', render: (row) => formatNumber(row.subscriberCount) },
            { label: 'Opt-in', render: (row) => row.optin || 'single' },
            { label: 'Updated', render: (row) => formatDate(row.updatedAt) },
          ],
          dashboard.lists,
          'No Listmonk lists returned.',
          {
            rowLabel: (row) => `Open list ${row.name}`,
            onRowClick: (row) => setSelectedListId(row.id),
            isSelected: (row) => row.id === selectedList?.id,
          },
        )}
        {selectedList ? (
          <div style={{ ...glassButton, marginTop: 16, padding: 16 }}>
            <div style={{ color: colors.text, fontSize: 18, fontWeight: 850 }}>{selectedList.name}</div>
            <div style={{ color: colors.textSecondary, marginTop: 6 }}>{selectedList.description || 'No description'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {badge(`${formatNumber(selectedList.subscriberCount)} subscribers`, 'accent')}
              {badge(`${formatNumber(selectedList.confirmedCount)} confirmed`, 'success')}
              {badge(selectedList.optin || 'single opt-in')}
              {badge(joinOrFallback(selectedList.tags, 'No tags'))}
            </div>
          </div>
        ) : null}
      </>,
      ClipboardList,
    );

  const renderSubscribers = () =>
    panel(
      'Subscribers',
      <>
        {table<EmailSubscriber>(
          [
            {
              label: 'Subscriber',
              render: (row) => (
                <div>
                  <div style={{ fontWeight: 800 }}>{row.name || 'Unnamed subscriber'}</div>
                  <div style={{ color: colors.textMuted, fontSize: 12, marginTop: 3 }}>{row.email}</div>
                </div>
              ),
            },
            { label: 'Status', render: (row) => badge(row.status, row.status === 'enabled' ? 'success' : 'muted') },
            {
              label: 'Lists',
              render: (row) => row.lists.map((list) => list.name).join(', ') || 'No lists',
            },
            { label: 'Created', render: (row) => formatDate(row.createdAt) },
            { label: 'Updated', render: (row) => formatDate(row.updatedAt) },
          ],
          dashboard.subscribers,
          'No Listmonk subscribers returned.',
          {
            rowLabel: (row) => `Open subscriber ${row.name || row.email}`,
            onRowClick: (row) => setSelectedSubscriberId(row.id),
            isSelected: (row) => row.id === selectedSubscriber?.id,
          },
        )}
        {selectedSubscriber ? (
          <div style={{ ...glassButton, marginTop: 16, padding: 16 }}>
            <div style={{ color: colors.text, fontSize: 18, fontWeight: 850 }}>
              {selectedSubscriber.name || 'Unnamed subscriber'}
            </div>
            <div style={{ color: colors.textSecondary, marginTop: 6 }}>{selectedSubscriber.email}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {badge(selectedSubscriber.status, selectedSubscriber.status === 'enabled' ? 'success' : 'muted')}
              {badge(`Lists: ${selectedSubscriber.lists.map((list) => list.name).join(', ') || 'none'}`, 'accent')}
              {badge(`Created ${formatDate(selectedSubscriber.createdAt)}`)}
              {badge(`Updated ${formatDate(selectedSubscriber.updatedAt)}`)}
            </div>
          </div>
        ) : null}
      </>,
      Users,
    );

  const fieldStyle = {
    width: '100%',
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    background: 'rgba(255, 255, 255, 0.04)',
    color: colors.text,
    padding: '11px 12px',
    fontSize: 14,
    outline: 'none',
  };

  const fieldLabel = (label: string, children: ReactNode) => (
    <label style={{ display: 'grid', gap: 7, color: colors.textSecondary, fontSize: 12, fontWeight: 800 }}>
      <span style={{ textTransform: 'uppercase' }}>{label}</span>
      {children}
    </label>
  );

  const renderAnalytics = () =>
    panel(
      'Analytics',
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            ['Messages sent', formatNumber(dashboard.metrics.messagesSent), Mail],
            ['Opens', formatNumber(dashboard.metrics.opens), Eye],
            ['Clicks', formatNumber(dashboard.metrics.clicks), MousePointerClick],
            ['Open rate', formatPercent(dashboard.metrics.opens, dashboard.metrics.messagesSent), BarChart3],
          ].map(([label, value, Icon]) => {
            const MetricIcon = Icon as LucideIcon;
            return (
              <div key={String(label)} style={{ ...glassButton, padding: 14 }}>
                <MetricIcon size={17} style={{ color: colors.accent }} />
                <div style={{ color: colors.text, fontSize: 26, fontWeight: 850, marginTop: 10 }}>{value as string}</div>
                <div style={{ color: colors.textMuted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                  {label as string}
                </div>
              </div>
            );
          })}
        </div>
        {table<EmailCampaign>(
          [
            {
              label: 'Campaign',
              render: (row) => (
                <div>
                  <div style={{ fontWeight: 800 }}>{row.name}</div>
                  <div style={{ color: colors.textMuted, fontSize: 12, marginTop: 3 }}>{row.subject}</div>
                </div>
              ),
            },
            { label: 'Status', render: (row) => badge(row.status, row.status === 'finished' ? 'success' : 'muted') },
            { label: 'Sent', align: 'right', render: (row) => `${formatNumber(row.sent)} / ${formatNumber(row.toSend)}` },
            { label: 'Open rate', align: 'right', render: (row) => formatPercent(row.views, row.sent) },
            { label: 'Click rate', align: 'right', render: (row) => formatPercent(row.clicks, row.sent) },
            { label: 'Bounces', align: 'right', render: (row) => formatNumber(row.bounces) },
            { label: 'Started', render: (row) => formatDate(row.startedAt) },
          ],
          dashboard.campaigns,
          'No Listmonk campaign analytics returned.',
          {
            rowLabel: (row) => `Open analytics for ${row.name}`,
            onRowClick: (row) => setSelectedCampaignId(row.id),
            isSelected: (row) => row.id === selectedCampaign?.id,
          },
        )}
        {selectedCampaign ? (
          <div style={{ ...glassButton, marginTop: 16, padding: 16 }}>
            <div style={{ color: colors.text, fontSize: 18, fontWeight: 850 }}>{selectedCampaign.name}</div>
            <div style={{ color: colors.textSecondary, marginTop: 6 }}>{selectedCampaign.subject}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 14 }}>
              {[
                ['Sent', `${formatNumber(selectedCampaign.sent)} / ${formatNumber(selectedCampaign.toSend)}`],
                ['Opens', formatNumber(selectedCampaign.views)],
                ['Clicks', formatNumber(selectedCampaign.clicks)],
                ['Bounces', formatNumber(selectedCampaign.bounces)],
                ['Open rate', formatPercent(selectedCampaign.views, selectedCampaign.sent)],
                ['Click rate', formatPercent(selectedCampaign.clicks, selectedCampaign.sent)],
              ].map(([label, value]) => (
                <div key={label} style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 10 }}>
                  <div style={{ color: colors.textMuted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                    {label}
                  </div>
                  <div style={{ color: colors.text, fontSize: 16, fontWeight: 800, marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </>,
      BarChart3,
    );

  const renderTemplateComposer = () =>
    templateEditorMode ? (
      <div style={{ ...glassButton, marginBottom: 16, padding: isMobile ? 14 : 18 }}>
        <div
          style={{
            display: 'flex',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 14,
            flexDirection: isMobile ? 'column' : 'row',
          }}
        >
          <div>
            <div style={{ color: colors.text, fontSize: 18, fontWeight: 850 }}>
              {templateEditorMode === 'edit' ? 'Edit template' : 'Create template'}
            </div>
            <div style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
              Templates are saved directly to Listmonk and can be selected while composing campaigns.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setTemplateEditorMode(null);
              setTemplateError(null);
            }}
            style={{ ...glassButton, padding: '9px 12px', fontSize: 13, fontWeight: 800 }}
          >
            Close
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: compactComposer ? '1fr' : 'minmax(220px, 0.36fr) minmax(420px, 0.64fr)', gap: 14 }}>
          <div style={{ display: 'grid', gap: 12, alignSelf: 'start' }}>
            {fieldLabel(
              'Template name',
              <input
                value={templateForm.name}
                onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Street Voices newsletter"
                style={fieldStyle}
              />,
            )}
            {fieldLabel(
              'Subject fallback',
              <input
                value={templateForm.subject}
                onChange={(event) => setTemplateForm((current) => ({ ...current, subject: event.target.value }))}
                placeholder="Optional default subject"
                style={fieldStyle}
              />,
            )}
            {fieldLabel(
              'Type',
              <select
                value={templateForm.type}
                onChange={(event) => setTemplateForm((current) => ({ ...current, type: event.target.value }))}
                style={fieldStyle}
              >
                <option value="campaign">Campaign</option>
                <option value="tx">Transactional</option>
              </select>,
            )}
          </div>
          {fieldLabel(
            'Template HTML',
            <textarea
              value={templateForm.body}
              onChange={(event) => setTemplateForm((current) => ({ ...current, body: event.target.value }))}
              placeholder="Paste or edit the template HTML."
              rows={14}
              style={{ ...fieldStyle, minHeight: 320, resize: 'vertical', lineHeight: 1.5, fontFamily: 'monospace' }}
            />,
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${colors.border}` }}>
          <button
            type="button"
            disabled={isSavingTemplate}
            onClick={() => void saveTemplate()}
            style={{ ...accentButton, padding: '11px 14px', fontSize: 14, fontWeight: 850, opacity: isSavingTemplate ? 0.6 : 1 }}
          >
            {isSavingTemplate ? 'Saving...' : templateEditorMode === 'edit' ? 'Save template' : 'Create template'}
          </button>
          <button
            type="button"
            onClick={() => setTemplateEditorMode(null)}
            style={{ ...glassButton, padding: '11px 14px', fontSize: 14, fontWeight: 800 }}
          >
            Cancel
          </button>
        </div>
      </div>
    ) : null;

  const renderTemplates = () =>
    panel(
      'Templates',
      <>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button
            type="button"
            onClick={startNewTemplate}
            style={{ ...accentButton, padding: '10px 13px', fontSize: 14, fontWeight: 850 }}
          >
            New template
          </button>
          {templateFeedback ? <span style={{ color: colors.success, fontSize: 13, fontWeight: 750 }}>{templateFeedback}</span> : null}
          {templateError ? <span style={{ color: colors.error, fontSize: 13, fontWeight: 750 }}>{templateError}</span> : null}
        </div>
        {renderTemplateComposer()}
        {table<EmailTemplate>(
          [
            {
              label: 'Template',
              render: (row) => (
                <div>
                  <div style={{ fontWeight: 800 }}>{row.name}</div>
                  <div style={{ color: colors.textMuted, fontSize: 12, marginTop: 3 }}>{row.subject || 'No subject fallback'}</div>
                </div>
              ),
            },
            { label: 'Type', render: (row) => badge(row.type, row.type === 'campaign' ? 'accent' : 'muted') },
            { label: 'Updated', render: (row) => formatDate(row.updatedAt) },
            {
              label: 'Actions',
              render: (row) => (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void startEditTemplate(row);
                  }}
                  style={{ ...glassButton, padding: '8px 11px', fontSize: 13, fontWeight: 800 }}
                >
                  Edit template
                </button>
              ),
            },
          ],
          dashboard.templates,
          'No Listmonk templates returned.',
          {
            rowLabel: (row) => `Open template ${row.name}`,
            onRowClick: (row) => setSelectedTemplateId(row.id),
            isSelected: (row) => row.id === selectedTemplate?.id,
          },
        )}
        {selectedTemplate ? (
          <div style={{ ...glassButton, marginTop: 16, padding: 16 }}>
            <div style={{ color: colors.text, fontSize: 18, fontWeight: 850 }}>{selectedTemplate.name}</div>
            <div style={{ color: colors.textSecondary, marginTop: 6 }}>{selectedTemplate.subject || 'No subject fallback'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {badge(selectedTemplate.type, selectedTemplate.type === 'campaign' ? 'accent' : 'muted')}
              {badge(`Updated ${formatDate(selectedTemplate.updatedAt)}`)}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => void startEditTemplate(selectedTemplate)}
                style={{ ...accentButton, padding: '10px 13px', fontSize: 14, fontWeight: 850 }}
              >
                Edit template
              </button>
              <button
                type="button"
                disabled={isSavingTemplate}
                onClick={() => {
                  if (window.confirm(`Delete template "${selectedTemplate.name}" from Listmonk?`)) {
                    void deleteTemplate(selectedTemplate);
                  }
                }}
                style={{
                  ...glassButton,
                  borderColor: colors.error,
                  color: colors.error,
                  padding: '10px 13px',
                  fontSize: 14,
                  fontWeight: 850,
                  opacity: isSavingTemplate ? 0.6 : 1,
                }}
              >
                Delete template
              </button>
            </div>
            <pre
              style={{
                margin: '14px 0 0',
                maxHeight: 260,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                color: colors.textSecondary,
                borderTop: `1px solid ${colors.border}`,
                paddingTop: 12,
                fontSize: 12,
              }}
            >
              {selectedTemplate.body || 'Empty template'}
            </pre>
          </div>
        ) : null}
      </>,
      FileText,
    );

  const renderCampaignComposer = () =>
    campaignEditorMode ? (
      <div
        style={{
          ...glassButton,
          marginBottom: 16,
          padding: isMobile ? 14 : 18,
          maxHeight: campaignComposerUsesInternalScroll ? 'min(720px, calc(100vh - 350px))' : 'none',
          display: campaignComposerUsesInternalScroll ? 'grid' : 'block',
          gridTemplateRows: campaignComposerUsesInternalScroll ? 'auto minmax(0, 1fr) auto' : undefined,
          overflow: campaignComposerUsesInternalScroll ? 'hidden' : 'visible',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 14,
            flexDirection: isMobile ? 'column' : 'row',
          }}
        >
          <div>
            <div style={{ color: colors.text, fontSize: 18, fontWeight: 850 }}>
              {campaignEditorMode === 'edit' ? 'Edit draft campaign' : 'Create campaign draft'}
            </div>
            <div style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
              Drafts are saved to Listmonk and can be scheduled or sent from Listmonk when ready.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setCampaignEditorMode(null);
              setCampaignError(null);
            }}
            style={{ ...glassButton, padding: '9px 12px', fontSize: 13, fontWeight: 800 }}
          >
            Close
          </button>
        </div>

        <div
          style={{
            minHeight: campaignComposerUsesInternalScroll ? 0 : undefined,
            overflowY: campaignComposerUsesInternalScroll ? 'auto' : 'visible',
            overflowX: 'hidden',
            paddingRight: campaignComposerUsesInternalScroll ? 6 : 0,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: compactComposer ? '1fr' : 'minmax(240px, 0.36fr) minmax(420px, 0.64fr)',
              gap: compactComposer ? 14 : 18,
              alignItems: 'start',
            }}
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                {fieldLabel(
                  'Campaign name',
                  <input
                    value={campaignForm.name}
                    onChange={(event) => setCampaignForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="May community update"
                    style={fieldStyle}
                  />,
                )}
                {fieldLabel(
                  'Email subject',
                  <input
                    value={campaignForm.subject}
                    onChange={(event) => setCampaignForm((current) => ({ ...current, subject: event.target.value }))}
                    placeholder="What should subscribers see in their inbox?"
                    style={fieldStyle}
                  />,
                )}
                {fieldLabel(
                  'From email',
                  <input
                    value={campaignForm.fromEmail}
                    onChange={(event) => setCampaignForm((current) => ({ ...current, fromEmail: event.target.value }))}
                    placeholder={dashboard.settings.fromEmail || 'Use Listmonk default'}
                    style={fieldStyle}
                  />,
                )}
                {fieldLabel(
                  'Tags',
                  <input
                    value={campaignForm.tags}
                    onChange={(event) => setCampaignForm((current) => ({ ...current, tags: event.target.value }))}
                    placeholder="newsletter, spring"
                    style={fieldStyle}
                  />,
                )}
                {fieldLabel(
                  'Content type',
                  <select
                    value={campaignForm.contentType}
                    onChange={(event) => setCampaignForm((current) => ({ ...current, contentType: event.target.value }))}
                    style={fieldStyle}
                  >
                    <option value="richtext">Rich text</option>
                    <option value="html">HTML</option>
                    <option value="markdown">Markdown</option>
                    <option value="plain">Plain text</option>
                  </select>,
                )}
                {fieldLabel(
                  'Template',
                  <select
                    value={campaignForm.templateId}
                    onChange={(event) => setCampaignForm((current) => ({ ...current, templateId: event.target.value }))}
                    style={fieldStyle}
                  >
                    <option value="">Listmonk default</option>
                    {dashboard.templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>,
                )}
                {fieldLabel(
                  'Send at',
                  <input
                    type="datetime-local"
                    value={campaignForm.sendAt ? campaignForm.sendAt.slice(0, 16) : ''}
                    onChange={(event) => setCampaignForm((current) => ({ ...current, sendAt: event.target.value }))}
                    style={fieldStyle}
                  />,
                )}
              </div>

              {fieldLabel(
                'Lists',
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {dashboard.lists.map((list) => {
                    const checked = campaignForm.lists.includes(list.id);
                    return (
                      <label
                        key={list.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          border: `1px solid ${checked ? colors.accent : colors.border}`,
                          borderRadius: 999,
                          color: checked ? colors.text : colors.textSecondary,
                          padding: '8px 10px',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setCampaignForm((current) => ({
                              ...current,
                              lists: event.target.checked
                                ? [...current.lists, list.id]
                                : current.lists.filter((id) => id !== list.id),
                            }))
                          }
                        />
                        {list.name}
                      </label>
                    );
                  })}
                </div>,
              )}
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {fieldLabel(
                'Campaign body',
                <textarea
                  value={campaignForm.body}
                  onChange={(event) => setCampaignForm((current) => ({ ...current, body: event.target.value }))}
                  placeholder="Write the campaign body here."
                  rows={compactComposer ? 10 : 8}
                  style={{
                    ...fieldStyle,
                    height: compactComposer ? undefined : 'clamp(240px, calc(100vh - 570px), 320px)',
                    minHeight: compactComposer ? 220 : 220,
                    resize: 'vertical',
                    lineHeight: 1.5,
                  }}
                />,
              )}

              {fieldLabel(
                'Plain text fallback',
                <textarea
                  value={campaignForm.altbody}
                  onChange={(event) => setCampaignForm((current) => ({ ...current, altbody: event.target.value }))}
                  placeholder="Optional plain text version."
                  rows={compactComposer ? 4 : 5}
                  style={{ ...fieldStyle, minHeight: compactComposer ? 110 : 120, resize: 'vertical', lineHeight: 1.5 }}
                />,
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            marginTop: 16,
            paddingTop: 14,
            borderTop: `1px solid ${colors.border}`,
            background: colors.cardBg,
            backdropFilter: 'blur(18px)',
          }}
        >
          <button
            type="button"
            disabled={isSavingCampaign}
            onClick={() => void saveCampaign()}
            style={{ ...accentButton, padding: '11px 14px', fontSize: 14, fontWeight: 850, opacity: isSavingCampaign ? 0.6 : 1 }}
          >
            {isSavingCampaign ? 'Saving...' : campaignEditorMode === 'edit' ? 'Save draft' : 'Create draft'}
          </button>
          <button
            type="button"
            onClick={() => setCampaignEditorMode(null)}
            style={{ ...glassButton, padding: '11px 14px', fontSize: 14, fontWeight: 800 }}
          >
            Cancel
          </button>
        </div>
      </div>
    ) : null;

  const renderCampaigns = () => {
    const campaignActionButton = (
      label: string,
      Icon: LucideIcon,
      onClick: () => void,
      disabled = false,
    ) => (
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) {
            onClick();
          }
        }}
        style={{
          width: 28,
          height: 28,
          border: 0,
          borderRadius: 4,
          background: 'transparent',
          color: disabled ? '#b8b8b8' : '#0068ff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        <Icon size={16} />
      </button>
    );

    const pager = (
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
        <button
          type="button"
          style={{
            width: 38,
            height: 38,
            border: 0,
            borderRadius: 5,
            background: '#ffd600',
            color: '#111',
            fontSize: 16,
            fontWeight: 800,
          }}
        >
          1
        </button>
        <button
          type="button"
          disabled
          style={{ width: 46, height: 38, border: 0, borderRadius: 5, color: '#b7b7b7', background: '#ececec' }}
        >
          ‹
        </button>
        <button
          type="button"
          disabled
          style={{ width: 46, height: 38, border: 0, borderRadius: 5, color: '#b7b7b7', background: '#ececec' }}
        >
          ›
        </button>
      </div>
    );

    return (
      <>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            marginBottom: 18,
          }}
        >
          <h2 style={{ color: '#111', fontSize: isMobile ? 26 : 31, fontWeight: 850, margin: 0, lineHeight: 1.15 }}>
            Campaigns ({formatNumber(dashboard.campaigns.length)})
          </h2>
          <button
            type="button"
            onClick={startNewCampaign}
            style={{
              ...accentButton,
              borderRadius: 999,
              padding: '12px 22px',
              fontSize: 16,
              fontWeight: 850,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Plus size={17} />
            New
          </button>
        </div>

        {(campaignFeedback || campaignError) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            {campaignFeedback ? <span style={{ color: colors.success, fontSize: 13, fontWeight: 750 }}>{campaignFeedback}</span> : null}
            {campaignError ? <span style={{ color: colors.error, fontSize: 13, fontWeight: 750 }}>{campaignError}</span> : null}
          </div>
        )}

        {renderCampaignComposer()}

        <section
          style={{
            background: '#fff',
            border: '1px solid #e7dfd0',
            borderRadius: 8,
            boxShadow: '0 6px 16px rgba(0, 0, 0, 0.07)',
            color: '#111',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '14px 18px 0' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'minmax(240px, 490px) 52px minmax(130px, 1fr)',
                gap: 0,
                alignItems: 'center',
              }}
            >
              <input
                value={campaignSearch}
                onChange={(event) => setCampaignSearch(event.target.value)}
                placeholder="Name or subject"
                style={{
                  height: 39,
                  border: '1px solid #e7dfd0',
                  borderRadius: '10px 0 0 10px',
                  padding: '0 14px',
                  fontSize: 15,
                  color: '#333',
                  outline: 'none',
                  minWidth: 0,
                }}
              />
              <button
                type="button"
                aria-label="Search campaigns"
                style={{
                  height: 40,
                  border: 0,
                  borderRadius: isMobile ? '0 10px 10px 0' : '0 999px 999px 0',
                  background: '#ffd600',
                  color: '#111',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Search size={17} />
              </button>
              {!isMobile ? <div>{pager}</div> : null}
            </div>
          </div>

          <div style={{ overflowX: 'auto', padding: isMobile ? '26px 18px 12px' : '86px 24px 14px' }}>
            <table style={{ width: '100%', minWidth: 930, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: 50, padding: '0 14px 14px', borderBottom: '1px solid #e8dfcd' }}>
                    <input type="checkbox" aria-label="Select all campaigns" />
                  </th>
                  {['Status', 'Name', 'Lists', 'Timestamps', 'Stats', ''].map((heading) => (
                    <th
                      key={heading || 'actions'}
                      style={{
                        color: '#747474',
                        fontSize: 11,
                        letterSpacing: 0.7,
                        textAlign: 'left',
                        textTransform: 'uppercase',
                        padding: '0 14px 14px',
                        borderBottom: '1px solid #e8dfcd',
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ color: '#777', padding: 28, textAlign: 'center' }}>
                      No campaigns match that search.
                    </td>
                  </tr>
                ) : (
                  visibleCampaigns.map((campaign) => (
                    <tr key={campaign.id} style={{ borderBottom: '1px solid #e8dfcd' }}>
                      <td style={{ width: 50, padding: '18px 14px', verticalAlign: 'middle' }}>
                        <input
                          type="checkbox"
                          aria-label={`Select campaign ${campaign.name}`}
                          checked={selectedCampaignId === campaign.id}
                          onChange={() => setSelectedCampaignId(campaign.id)}
                        />
                      </td>
                      <td style={{ padding: '18px 14px', verticalAlign: 'middle' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedCampaignId(campaign.id)}
                          style={{
                            border: 0,
                            borderRadius: 999,
                            background: campaign.status === 'finished' ? '#d7f8df' : '#eef2f7',
                            color: campaign.status === 'finished' ? '#269353' : '#667085',
                            padding: '5px 20px',
                            fontSize: 12,
                            fontWeight: 850,
                            textTransform: 'capitalize',
                            cursor: 'pointer',
                          }}
                        >
                          {campaign.status}
                        </button>
                      </td>
                      <td style={{ padding: '18px 14px', verticalAlign: 'top', maxWidth: 300 }}>
                        <button
                          type="button"
                          onClick={() => void (campaign.status === 'draft' ? startEditCampaign(campaign) : duplicateCampaign(campaign))}
                          style={{
                            border: 0,
                            background: 'transparent',
                            color: '#005cff',
                            cursor: 'pointer',
                            fontSize: 16,
                            fontWeight: 500,
                            padding: 0,
                            textAlign: 'left',
                            lineHeight: 1.35,
                          }}
                        >
                          {campaign.name}
                        </button>
                        <div style={{ color: '#777', fontSize: 12, marginTop: 6, lineHeight: 1.35 }}>{campaign.subject}</div>
                        {campaign.tags.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                            {campaign.tags.map((tag) => (
                              <span
                                key={tag}
                                style={{
                                  borderRadius: 999,
                                  background: '#eeeeee',
                                  color: '#777',
                                  fontSize: 12,
                                  fontWeight: 750,
                                  padding: '4px 18px',
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ padding: '18px 14px', verticalAlign: 'top', minWidth: 160 }}>
                        <ul style={{ margin: 0, paddingLeft: 16, color: '#005cff', fontSize: 16, lineHeight: 1.55 }}>
                          {campaign.lists.map((list) => (
                            <li key={list}>{list}</li>
                          ))}
                        </ul>
                      </td>
                      <td style={{ padding: '18px 14px', verticalAlign: 'top', minWidth: 190, color: '#222', fontSize: 12 }}>
                        {[
                          ['Created', campaign.createdAt],
                          ['Started', campaign.startedAt],
                          ['Ended', campaign.endedAt],
                        ].map(([label, value]) => (
                          <div key={label} style={{ marginBottom: 4 }}>
                            <div style={{ fontWeight: 850 }}>{label}</div>
                            <div>{formatDateTime(value)}</div>
                          </div>
                        ))}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>◷</span>
                          <span>{formatDuration(campaign.startedAt, campaign.endedAt)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '18px 14px', verticalAlign: 'top', minWidth: 130, color: '#222', fontSize: 12 }}>
                        {[
                          ['Views', formatNumber(campaign.views)],
                          ['Clicks', formatNumber(campaign.clicks)],
                          ['Sent', `${formatNumber(campaign.sent)} / ${formatNumber(campaign.toSend)}`],
                          ['Bounces', formatNumber(campaign.bounces)],
                        ].map(([label, value]) => (
                          <div key={label} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 8, lineHeight: 1.3 }}>
                            <strong>{label}</strong>
                            <span style={{ color: label === 'Bounces' ? '#005cff' : '#222' }}>{value}</span>
                          </div>
                        ))}
                      </td>
                      <td style={{ padding: '18px 0 18px 14px', verticalAlign: 'middle', minWidth: 118 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 28px)', gap: 6, justifyContent: 'end' }}>
                          {campaignActionButton(
                            'Send campaign',
                            Rocket,
                            () => void changeCampaignStatus(campaign, 'running'),
                            campaign.status !== 'draft',
                          )}
                          {campaignActionButton(
                            'Stop campaign',
                            Ban,
                            () => void changeCampaignStatus(campaign, 'cancelled'),
                            campaign.status !== 'running',
                          )}
                          {campaignActionButton('Preview', FileSearch, () => void previewCampaign(campaign))}
                          {campaignActionButton('Clone', Copy, () => void duplicateCampaign(campaign))}
                          {campaignActionButton('Analytics', BarChart3, () => {
                            setSelectedCampaignId(campaign.id);
                            navigate('/email/analytics');
                          })}
                          {campaignActionButton(
                            'Delete',
                            Trash2,
                            () => void deleteDraftCampaign(campaign),
                            campaign.status !== 'draft',
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '10px 24px 24px' }}>{pager}</div>
        </section>

        {campaignPreview ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Preview ${campaignPreview.name}`}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              display: 'grid',
              placeItems: 'center',
              padding: isMobile ? 16 : 28,
              background: 'rgba(0, 0, 0, 0.38)',
            }}
          >
            <section
              style={{
                width: 'min(920px, 100%)',
                maxHeight: 'min(760px, calc(100vh - 48px))',
                display: 'grid',
                gridTemplateRows: 'auto minmax(260px, 1fr)',
                overflow: 'hidden',
                borderRadius: 8,
                border: '1px solid #e7dfd0',
                background: '#fff',
                boxShadow: '0 24px 70px rgba(0, 0, 0, 0.24)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 18,
                  padding: 18,
                  borderBottom: '1px solid #e7dfd0',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#777', fontSize: 12, fontWeight: 850, textTransform: 'uppercase' }}>
                    Campaign preview
                  </div>
                  <h3 style={{ color: '#111', fontSize: 22, lineHeight: 1.2, margin: '6px 0 0' }}>
                    {campaignPreview.name}
                  </h3>
                  <p style={{ color: '#666', margin: '6px 0 0', overflowWrap: 'anywhere' }}>{campaignPreview.subject}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCampaignPreview(null)}
                  style={{
                    border: '1px solid #e7dfd0',
                    borderRadius: 6,
                    background: '#fff',
                    color: '#111',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 750,
                    padding: '9px 14px',
                  }}
                >
                  Close
                </button>
              </div>
              <iframe
                title={`Preview ${campaignPreview.name}`}
                sandbox=""
                srcDoc={
                  campaignPreview.body ||
                  `<pre style="font: 14px/1.5 system-ui; white-space: pre-wrap; padding: 20px;">${escapeHtml(campaignPreview.altbody || 'No campaign body returned.')}</pre>`
                }
                style={{ width: '100%', height: '100%', minHeight: 360, border: 0, background: '#fff' }}
              />
            </section>
          </div>
        ) : null}
      </>
    );
  };

  const renderUsers = () =>
    panel(
      'Users',
      <>
        {table<EmailUser>(
          [
            {
              label: 'User',
              render: (row) => (
                <div>
                  <div style={{ fontWeight: 800 }}>{row.name || row.username}</div>
                  <div style={{ color: colors.textMuted, fontSize: 12, marginTop: 3 }}>{row.email}</div>
                </div>
              ),
            },
            { label: 'Username', render: (row) => row.username },
            { label: 'Role', render: (row) => row.role },
            { label: 'Status', render: (row) => badge(row.status, row.status === 'enabled' ? 'success' : 'muted') },
            { label: 'Last login', render: (row) => formatDate(row.loggedInAt) },
          ],
          dashboard.users,
          'No Listmonk users returned.',
          {
            rowLabel: (row) => `Open user ${row.name || row.email}`,
            onRowClick: (row) => setSelectedUserId(row.id),
            isSelected: (row) => row.id === selectedUser?.id,
          },
        )}
        {selectedUser ? (
          <div style={{ ...glassButton, marginTop: 16, padding: 16 }}>
            <div style={{ color: colors.text, fontSize: 18, fontWeight: 850 }}>
              {selectedUser.name || selectedUser.username}
            </div>
            <div style={{ color: colors.textSecondary, marginTop: 6 }}>{selectedUser.email}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {badge(selectedUser.role, 'accent')}
              {badge(selectedUser.status, selectedUser.status === 'enabled' ? 'success' : 'muted')}
              {badge(`Last login ${formatDate(selectedUser.loggedInAt)}`)}
            </div>
          </div>
        ) : null}
      </>,
      MessageSquareText,
    );

  const renderSettings = () =>
    panel(
      'Settings',
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
        {[
          ['Site name', dashboard.settings.siteName],
          ['Root URL', dashboard.settings.rootUrl || 'Not set'],
          ['From email', dashboard.settings.fromEmail || 'Not set'],
          ['Language', dashboard.settings.language],
          ['Public subscription', dashboard.settings.publicSubscriptionPage ? 'Enabled' : 'Disabled'],
          ['Public archive', dashboard.settings.publicArchive ? 'Enabled' : 'Disabled'],
          ['SMTP', dashboard.settings.smtpEnabled ? dashboard.settings.smtpHosts.join(', ') || 'Enabled' : 'Disabled'],
        ].map(([label, value]) => (
          <div key={label} style={{ ...glassButton, padding: 14 }}>
            <div style={{ color: colors.textMuted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ color: colors.text, fontSize: 15, fontWeight: 750, marginTop: 6, overflowWrap: 'anywhere' }}>
              {value}
            </div>
          </div>
        ))}
      </div>,
      Globe2,
    );

  const renderActiveSection = () => {
    if (activeSectionId === 'analytics') {
      return renderAnalytics();
    }
    if (activeSectionId === 'lists') {
      return renderLists();
    }
    if (activeSectionId === 'subscribers') {
      return renderSubscribers();
    }
    if (activeSectionId === 'campaigns') {
      return renderCampaigns();
    }
    if (activeSectionId === 'templates') {
      return renderTemplates();
    }
    if (activeSectionId === 'users') {
      return renderUsers();
    }
    if (activeSectionId === 'settings') {
      return renderSettings();
    }
    return renderDashboard();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'visible',
        background: isCampaignsView ? '#fafaf8' : colors.bg,
      }}
    >
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: isMobile || width < 980 ? '1fr' : 'minmax(190px, 240px) minmax(0, 1fr)',
          gap: isMobile ? 16 : width < 1180 ? 18 : 24,
          maxWidth: 1440,
          margin: '0 auto',
          padding: isMobile ? '14px 12px 48px' : width < 1180 ? '20px 16px 56px' : '28px 22px 64px',
        }}
      >
        <aside
          style={{
            ...(isCampaignsView
              ? {
                  background: '#fff',
                  border: '1px solid #e8dfcd',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)',
                }
              : glassCard),
            alignSelf: 'start',
            padding: 14,
            position: isMobile || width < 980 ? 'relative' : 'sticky',
            top: 20,
            borderRadius: isCampaignsView ? 8 : 18,
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          <div style={{ padding: '8px 10px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: colors.accent,
                  color: '#000',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Mail size={17} />
              </span>
              <div>
                <div style={{ color: emailNavText, fontSize: 14, fontWeight: 800 }}>Email</div>
                <div style={{ color: emailNavMuted, fontSize: 12 }}>Street Voices</div>
              </div>
            </div>
          </div>

          <nav
            style={{
              display: 'flex',
              flexDirection: compactEmailNav ? 'row' : 'column',
              gap: compactEmailNav ? 8 : 6,
              overflowX: compactEmailNav ? 'auto' : 'visible',
              paddingBottom: compactEmailNav ? 4 : 0,
              width: '100%',
              minWidth: 0,
            }}
          >
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeSectionId;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => navigate(section.href)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: compactEmailNav ? 'auto' : '100%',
                    flex: compactEmailNav ? '0 0 auto' : undefined,
                    border: `1px solid ${isActive ? colors.accent : 'transparent'}`,
                    borderRadius: 12,
                    background: isActive ? 'rgba(255, 214, 0, 0.14)' : 'transparent',
                    color: isActive ? emailNavText : emailNavSecondary,
                    cursor: 'pointer',
                    padding: '11px 12px',
                    textAlign: 'left',
                    fontSize: 14,
                    fontWeight: 650,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Icon size={17} style={{ color: isActive ? colors.accent : emailNavMuted }} />
                  {section.label}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            style={{
              ...glassButton,
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              width: compactEmailNav ? 'auto' : '100%',
              marginTop: compactEmailNav ? 10 : 14,
              padding: '11px 12px',
              fontSize: 13,
              fontWeight: 700,
              textAlign: 'left',
              color: emailNavText,
            }}
          >
            <LayoutDashboard size={16} />
            LibreChat Dashboard
          </button>
        </aside>

        <main style={{ minWidth: 0 }}>
          {!isCampaignsView ? (
            <section
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 18,
                marginBottom: 22,
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                    color: colors.accent,
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                  }}
                >
                  <span>Local 3180 workspace</span>
                  {renderStatus()}
                </div>
                <h1
                  style={{
                    color: colors.text,
                    fontSize: 'clamp(28px, 4vw, 46px)',
                    lineHeight: 1.05,
                    margin: '8px 0 0',
                    fontWeight: 850,
                  }}
                >
                  {activeSection.label}
                </h1>
                <p
                  style={{
                    color: colors.textSecondary,
                    margin: '10px 0 0',
                    maxWidth: 720,
                    fontSize: 16,
                    lineHeight: 1.6,
                  }}
                >
                  {activeSection.description}
                </p>
                {loadError ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: '#B45309',
                      fontSize: 13,
                      marginTop: 10,
                    }}
                  >
                    <CircleAlert size={15} />
                    {loadError}
                  </div>
                ) : dashboard.refreshedAt ? (
                  <div style={{ color: colors.textMuted, fontSize: 12, marginTop: 10 }}>
                    Refreshed {formatDate(dashboard.refreshedAt)}
                  </div>
                ) : null}
              </div>

              <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => void refreshDashboard()}
                  style={{
                    ...glassButton,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 14px',
                  }}
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/c/new')}
                  style={{
                    ...accentButton,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '12px 16px',
                  }}
                >
                  <Sparkles size={17} />
                  AI Composer
                </button>
              </div>
            </section>
          ) : null}

          {dashboard.connected && !isCampaignsView ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: colors.textSecondary,
                fontSize: 13,
                marginBottom: 18,
              }}
            >
              <CheckCircle2 size={16} style={{ color: colors.success }} />
              {dashboard.source?.label || 'Listmonk'} is connected under the LibreChat app shell.
            </div>
          ) : null}

          {renderActiveSection()}
        </main>
      </div>
    </div>
  );
}

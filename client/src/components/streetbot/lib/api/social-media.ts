/**
 * Social Media Management API Client
 *
 * Comprehensive API client for social media management features including
 * accounts, posts, campaigns, inbox, analytics, and AI content generation.
 */

// ============================================================================
// TYPES - Platform & Status Enums
// ============================================================================

export type Platform =
  | "twitter"
  | "facebook"
  | "instagram"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "threads"
  | "pinterest";

export type AccountStatus = "active" | "expired" | "revoked" | "error" | "pending";
export type HealthStatus = "healthy" | "warning" | "error";
export type PostStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";
export type ApprovalStatus = "none" | "pending" | "approved" | "rejected" | "changes_requested";
export type CampaignStatus = "draft" | "active" | "paused" | "completed" | "cancelled";
export type InboxStatus = "unread" | "read" | "replied" | "archived" | "spam" | "escalated";
export type Priority = "low" | "normal" | "high" | "urgent";
export type Sentiment = "positive" | "neutral" | "negative" | "unknown";

// ============================================================================
// TYPES - API Response Types (snake_case from backend)
// ============================================================================

interface SocialAccountApi {
  id: string;
  platform: Platform;
  platform_username?: string;
  display_name?: string;
  profile_image_url?: string;
  account_type: string;
  status: AccountStatus;
  health_status: HealthStatus;
  health_message?: string;
  created_at: string;
}

interface SocialCampaignApi {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  campaign_type: string;
  status: CampaignStatus;
  start_date?: string;
  end_date?: string;
  sponsor_name?: string;
  required_disclosure?: string;
  color: string;
  cms_tags: string[];
  cms_categories: string[];
  created_at: string;
  updated_at: string;
}

interface SocialPostApi {
  id: string;
  user_id: string;
  title?: string;
  content: string;
  media_urls: string[];
  media_types: string[];
  platforms: Platform[];
  hashtags: string[];
  mentions: string[];
  link_url?: string;
  status: PostStatus;
  scheduled_at?: string;
  published_at?: string;
  campaign_id?: string;
  cms_article_id?: string;
  cms_headline?: string;
  cms_url?: string;
  cms_category?: string;
  cms_tags: string[];
  approval_status: ApprovalStatus;
  is_evergreen: boolean;
  ai_generated: boolean;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

interface PostVariantApi {
  id: string;
  post_id: string;
  platform: Platform;
  account_id?: string;
  content: string;
  hashtags: string[];
  status: string;
  platform_post_id?: string;
  platform_post_url?: string;
  published_at?: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  engagement_rate: number;
}

interface InboxItemApi {
  id: string;
  account_id: string;
  platform: Platform;
  item_type: string;
  content?: string;
  author_username?: string;
  author_display_name?: string;
  author_profile_image?: string;
  status: InboxStatus;
  sentiment?: Sentiment;
  priority: Priority;
  assigned_to?: string;
  response_text?: string;
  internal_notes?: string;
  platform_created_at?: string;
  created_at: string;
}

interface TemplateApi {
  id: string;
  name: string;
  description?: string;
  category?: string;
  content: string;
  variables: string[];
  platforms: Platform[];
  default_hashtags: string[];
  usage_count: number;
  is_active: boolean;
  created_at: string;
}

// ============================================================================
// TYPES - Frontend Types (camelCase)
// ============================================================================

export interface SocialAccount {
  id: string;
  platform: Platform;
  platformUsername?: string;
  displayName?: string;
  profileImageUrl?: string;
  accountType: string;
  status: AccountStatus;
  healthStatus: HealthStatus;
  healthMessage?: string;
  createdAt: string;
}

export interface SocialCampaign {
  id: string;
  userId: string;
  name: string;
  description?: string;
  campaignType: string;
  status: CampaignStatus;
  startDate?: string;
  endDate?: string;
  sponsorName?: string;
  requiredDisclosure?: string;
  color: string;
  cmsTags: string[];
  cmsCategories: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SocialPost {
  id: string;
  userId: string;
  title?: string;
  content: string;
  mediaUrls: string[];
  mediaTypes: string[];
  platforms: Platform[];
  hashtags: string[];
  mentions: string[];
  linkUrl?: string;
  status: PostStatus;
  scheduledAt?: string;
  publishedAt?: string;
  campaignId?: string;
  cmsArticleId?: string;
  cmsHeadline?: string;
  cmsUrl?: string;
  cmsCategory?: string;
  cmsTags: string[];
  approvalStatus: ApprovalStatus;
  isEvergreen: boolean;
  aiGenerated: boolean;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  variants?: PostVariant[];
}

export interface PostVariant {
  id: string;
  postId: string;
  platform: Platform;
  accountId?: string;
  content: string;
  hashtags: string[];
  status: string;
  platformPostId?: string;
  platformPostUrl?: string;
  publishedAt?: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  engagementRate: number;
}

export interface InboxItem {
  id: string;
  accountId: string;
  platform: Platform;
  itemType: string;
  content?: string;
  authorUsername?: string;
  authorDisplayName?: string;
  authorProfileImage?: string;
  status: InboxStatus;
  sentiment?: Sentiment;
  priority: Priority;
  assignedTo?: string;
  responseText?: string;
  internalNotes?: string;
  platformCreatedAt?: string;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  category?: string;
  content: string;
  variables: string[];
  platforms: Platform[];
  defaultHashtags: string[];
  usageCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalAccounts: number;
  activeAccounts: number;
  totalPosts: number;
  scheduledPosts: number;
  publishedPosts: number;
  draftPosts: number;
  totalCampaigns: number;
  activeCampaigns: number;
  inboxUnread: number;
  inboxPending: number;
}

export interface InboxSummary {
  totalUnread: number;
  totalPending: number;
  totalEscalated: number;
  byPlatform: Record<string, number>;
  byType: Record<string, number>;
}

export interface CalendarDay {
  date: string;
  posts: ScheduleSlot[];
  totalScheduled: number;
}

export interface ScheduleSlot {
  id: string;
  title?: string;
  contentPreview: string;
  platforms: Platform[];
  scheduledAt: string;
  status: PostStatus;
  campaignId?: string;
  campaignName?: string;
}

export interface AnalyticsOverview {
  periodStart: string;
  periodEnd: string;
  totalFollowers: number;
  followersChange: number;
  followersChangePct: number;
  totalPosts: number;
  totalImpressions: number;
  totalEngagements: number;
  avgEngagementRate: number;
  byPlatform: Record<string, Record<string, number>>;
}

export interface AIGeneratedContent {
  platform: Platform;
  content: string;
  hashtags: string[];
  characterCount: number;
  withinLimit: boolean;
  confidenceScore: number;
}

export interface AIGenerateResponse {
  variants: AIGeneratedContent[];
  suggestedPostingTimes: string[];
  modelUsed: string;
  promptUsed: string;
}

// ============================================================================
// TRANSFORMERS
// ============================================================================

function transformAccount(api: SocialAccountApi): SocialAccount {
  return {
    id: api.id,
    platform: api.platform,
    platformUsername: api.platform_username,
    displayName: api.display_name,
    profileImageUrl: api.profile_image_url,
    accountType: api.account_type,
    status: api.status,
    healthStatus: api.health_status,
    healthMessage: api.health_message,
    createdAt: api.created_at,
  };
}

function transformCampaign(api: SocialCampaignApi): SocialCampaign {
  return {
    id: api.id,
    userId: api.user_id,
    name: api.name,
    description: api.description,
    campaignType: api.campaign_type,
    status: api.status,
    startDate: api.start_date,
    endDate: api.end_date,
    sponsorName: api.sponsor_name,
    requiredDisclosure: api.required_disclosure,
    color: api.color,
    cmsTags: api.cms_tags || [],
    cmsCategories: api.cms_categories || [],
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

function transformPost(api: SocialPostApi): SocialPost {
  return {
    id: api.id,
    userId: api.user_id,
    title: api.title,
    content: api.content,
    mediaUrls: api.media_urls || [],
    mediaTypes: api.media_types || [],
    platforms: api.platforms || [],
    hashtags: api.hashtags || [],
    mentions: api.mentions || [],
    linkUrl: api.link_url,
    status: api.status,
    scheduledAt: api.scheduled_at,
    publishedAt: api.published_at,
    campaignId: api.campaign_id,
    cmsArticleId: api.cms_article_id,
    cmsHeadline: api.cms_headline,
    cmsUrl: api.cms_url,
    cmsCategory: api.cms_category,
    cmsTags: api.cms_tags || [],
    approvalStatus: api.approval_status,
    isEvergreen: api.is_evergreen,
    aiGenerated: api.ai_generated,
    errorMessage: api.error_message,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

function transformVariant(api: PostVariantApi): PostVariant {
  return {
    id: api.id,
    postId: api.post_id,
    platform: api.platform,
    accountId: api.account_id,
    content: api.content,
    hashtags: api.hashtags || [],
    status: api.status,
    platformPostId: api.platform_post_id,
    platformPostUrl: api.platform_post_url,
    publishedAt: api.published_at,
    impressions: api.impressions,
    reach: api.reach,
    likes: api.likes,
    comments: api.comments,
    shares: api.shares,
    clicks: api.clicks,
    engagementRate: api.engagement_rate,
  };
}

function transformInboxItem(api: InboxItemApi): InboxItem {
  return {
    id: api.id,
    accountId: api.account_id,
    platform: api.platform,
    itemType: api.item_type,
    content: api.content,
    authorUsername: api.author_username,
    authorDisplayName: api.author_display_name,
    authorProfileImage: api.author_profile_image,
    status: api.status,
    sentiment: api.sentiment,
    priority: api.priority,
    assignedTo: api.assigned_to,
    responseText: api.response_text,
    internalNotes: api.internal_notes,
    platformCreatedAt: api.platform_created_at,
    createdAt: api.created_at,
  };
}

function transformTemplate(api: TemplateApi): Template {
  return {
    id: api.id,
    name: api.name,
    description: api.description,
    category: api.category,
    content: api.content,
    variables: api.variables || [],
    platforms: api.platforms || [],
    defaultHashtags: api.default_hashtags || [],
    usageCount: api.usage_count,
    isActive: api.is_active,
    createdAt: api.created_at,
  };
}

// ============================================================================
// API ERROR CLASS
// ============================================================================

export class SocialMediaApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "SocialMediaApiError";
  }
}

// ============================================================================
// API HELPER
// ============================================================================

async function apiCall<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorDetail;
    try {
      errorDetail = await response.json();
    } catch {
      errorDetail = await response.text();
    }
    throw new SocialMediaApiError(
      `API error: ${response.statusText}`,
      response.status,
      errorDetail
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ============================================================================
// DASHBOARD API
// ============================================================================

export async function fetchDashboardStats(userId: string): Promise<DashboardStats> {
  const data = await apiCall<{
    total_accounts: number;
    active_accounts: number;
    total_posts: number;
    scheduled_posts: number;
    published_posts: number;
    draft_posts: number;
    total_campaigns: number;
    active_campaigns: number;
    inbox_unread: number;
    inbox_pending: number;
  }>(`/api/social-media/dashboard?user_id=${userId}`);

  return {
    totalAccounts: data.total_accounts,
    activeAccounts: data.active_accounts,
    totalPosts: data.total_posts,
    scheduledPosts: data.scheduled_posts,
    publishedPosts: data.published_posts,
    draftPosts: data.draft_posts,
    totalCampaigns: data.total_campaigns,
    activeCampaigns: data.active_campaigns,
    inboxUnread: data.inbox_unread,
    inboxPending: data.inbox_pending,
  };
}

// ============================================================================
// ACCOUNTS API
// ============================================================================

export async function fetchAccounts(
  userId: string,
  platform?: Platform,
  status?: AccountStatus
): Promise<SocialAccount[]> {
  const params = new URLSearchParams({ user_id: userId });
  if (platform) params.append("platform", platform);
  if (status) params.append("status", status);

  const data = await apiCall<SocialAccountApi[]>(`/api/social-media/accounts?${params}`);
  return data.map(transformAccount);
}

export async function getOAuthUrl(
  platform: Platform,
  userId: string
): Promise<{ url: string; state: string }> {
  const data = await apiCall<{ url: string; state: string }>(
    `/api/social-media/accounts/connect/${platform}?user_id=${userId}`
  );
  return data;
}

export async function disconnectAccount(accountId: string, userId: string): Promise<void> {
  await apiCall<void>(`/api/social-media/accounts/${accountId}?user_id=${userId}`, {
    method: "DELETE",
  });
}

export async function refreshAccountTokens(
  accountId: string,
  userId: string
): Promise<SocialAccount> {
  const data = await apiCall<SocialAccountApi>(
    `/api/social-media/accounts/${accountId}/refresh?user_id=${userId}`,
    { method: "POST" }
  );
  return transformAccount(data);
}

// ============================================================================
// CAMPAIGNS API
// ============================================================================

export async function fetchCampaigns(
  userId: string,
  status?: CampaignStatus
): Promise<SocialCampaign[]> {
  const params = new URLSearchParams({ user_id: userId });
  if (status) params.append("status", status);

  const data = await apiCall<SocialCampaignApi[]>(`/api/social-media/campaigns?${params}`);
  return data.map(transformCampaign);
}

export async function fetchCampaign(campaignId: string): Promise<SocialCampaign> {
  const data = await apiCall<SocialCampaignApi>(`/api/social-media/campaigns/${campaignId}`);
  return transformCampaign(data);
}

export async function createCampaign(
  userId: string,
  campaign: {
    name: string;
    description?: string;
    campaignType?: string;
    startDate?: string;
    endDate?: string;
    sponsorName?: string;
    requiredDisclosure?: string;
    targetPlatforms?: Platform[];
    color?: string;
  }
): Promise<SocialCampaign> {
  const data = await apiCall<SocialCampaignApi>("/api/social-media/campaigns", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      name: campaign.name,
      description: campaign.description,
      campaign_type: campaign.campaignType || "general",
      start_date: campaign.startDate,
      end_date: campaign.endDate,
      sponsor_name: campaign.sponsorName,
      required_disclosure: campaign.requiredDisclosure,
      target_platforms: campaign.targetPlatforms || [],
      color: campaign.color || "#6366f1",
    }),
  });
  return transformCampaign(data);
}

export async function updateCampaign(
  campaignId: string,
  userId: string,
  updates: Partial<{
    name: string;
    description: string;
    status: CampaignStatus;
    startDate: string;
    endDate: string;
  }>
): Promise<SocialCampaign> {
  const data = await apiCall<SocialCampaignApi>(
    `/api/social-media/campaigns/${campaignId}?user_id=${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        name: updates.name,
        description: updates.description,
        status: updates.status,
        start_date: updates.startDate,
        end_date: updates.endDate,
      }),
    }
  );
  return transformCampaign(data);
}

// ============================================================================
// POSTS API
// ============================================================================

export interface FetchPostsOptions {
  status?: PostStatus;
  campaignId?: string;
  platform?: Platform;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export async function fetchPosts(
  userId: string,
  options: FetchPostsOptions = {}
): Promise<{ posts: SocialPost[]; total: number }> {
  const params = new URLSearchParams({ user_id: userId });
  if (options.status) params.append("status", options.status);
  if (options.campaignId) params.append("campaign_id", options.campaignId);
  if (options.platform) params.append("platform", options.platform);
  if (options.startDate) params.append("start_date", options.startDate);
  if (options.endDate) params.append("end_date", options.endDate);
  if (options.limit) params.append("limit", options.limit.toString());
  if (options.offset) params.append("offset", options.offset.toString());

  const data = await apiCall<{
    posts: SocialPostApi[];
    total: number;
    limit: number;
    offset: number;
  }>(`/api/social-media/posts?${params}`);

  return {
    posts: data.posts.map(transformPost),
    total: data.total,
  };
}

export async function fetchPost(
  postId: string,
  includeVariants = true
): Promise<SocialPost> {
  const data = await apiCall<SocialPostApi & { variants?: PostVariantApi[] }>(
    `/api/social-media/posts/${postId}?include_variants=${includeVariants}`
  );
  const post = transformPost(data);
  if (data.variants) {
    post.variants = data.variants.map(transformVariant);
  }
  return post;
}

export async function createPost(
  userId: string,
  post: {
    content: string;
    platforms: Platform[];
    title?: string;
    mediaUrls?: string[];
    mediaTypes?: string[];
    linkUrl?: string;
    hashtags?: string[];
    scheduledAt?: string;
    campaignId?: string;
    cmsArticleId?: string;
    cmsHeadline?: string;
    cmsUrl?: string;
    isEvergreen?: boolean;
  }
): Promise<SocialPost> {
  const data = await apiCall<SocialPostApi>("/api/social-media/posts", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      content: post.content,
      platforms: post.platforms,
      title: post.title,
      media_urls: post.mediaUrls || [],
      media_types: post.mediaTypes || [],
      link_url: post.linkUrl,
      hashtags: post.hashtags || [],
      scheduled_at: post.scheduledAt,
      campaign_id: post.campaignId,
      cms_article_id: post.cmsArticleId,
      cms_headline: post.cmsHeadline,
      cms_url: post.cmsUrl,
      is_evergreen: post.isEvergreen || false,
    }),
  });
  return transformPost(data);
}

export async function updatePost(
  postId: string,
  userId: string,
  updates: Partial<{
    content: string;
    platforms: Platform[];
    status: PostStatus;
    scheduledAt: string;
    hashtags: string[];
  }>
): Promise<SocialPost> {
  const data = await apiCall<SocialPostApi>(
    `/api/social-media/posts/${postId}?user_id=${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        content: updates.content,
        platforms: updates.platforms,
        status: updates.status,
        scheduled_at: updates.scheduledAt,
        hashtags: updates.hashtags,
      }),
    }
  );
  return transformPost(data);
}

export async function deletePost(postId: string, userId: string): Promise<void> {
  await apiCall<void>(`/api/social-media/posts/${postId}?user_id=${userId}`, {
    method: "DELETE",
  });
}

export async function schedulePost(
  postId: string,
  userId: string,
  scheduledAt: string
): Promise<SocialPost> {
  const data = await apiCall<SocialPostApi>(
    `/api/social-media/posts/${postId}/schedule?user_id=${userId}&scheduled_at=${encodeURIComponent(scheduledAt)}`,
    { method: "POST" }
  );
  return transformPost(data);
}

export async function publishPostNow(postId: string, userId: string): Promise<SocialPost> {
  const data = await apiCall<SocialPostApi>(
    `/api/social-media/posts/${postId}/publish?user_id=${userId}`,
    { method: "POST" }
  );
  return transformPost(data);
}

// ============================================================================
// TEMPLATES API
// ============================================================================

export async function fetchTemplates(
  userId: string,
  category?: string,
  platform?: Platform
): Promise<Template[]> {
  const params = new URLSearchParams({ user_id: userId });
  if (category) params.append("category", category);
  if (platform) params.append("platform", platform);

  const data = await apiCall<TemplateApi[]>(`/api/social-media/templates?${params}`);
  return data.map(transformTemplate);
}

export async function createTemplate(
  userId: string,
  template: {
    name: string;
    content: string;
    category?: string;
    platforms?: Platform[];
    variables?: string[];
    defaultHashtags?: string[];
  }
): Promise<Template> {
  const data = await apiCall<TemplateApi>("/api/social-media/templates", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      name: template.name,
      content: template.content,
      category: template.category,
      platforms: template.platforms || [],
      variables: template.variables || [],
      default_hashtags: template.defaultHashtags || [],
    }),
  });
  return transformTemplate(data);
}

export async function applyTemplate(
  templateId: string,
  variables: Record<string, string>
): Promise<string> {
  const data = await apiCall<{ content: string }>("/api/social-media/templates/apply", {
    method: "POST",
    body: JSON.stringify({
      template_id: templateId,
      variables,
    }),
  });
  return data.content;
}

// ============================================================================
// INBOX API
// ============================================================================

export async function fetchInboxItems(
  userId: string,
  options: {
    status?: InboxStatus;
    platform?: Platform;
    priority?: Priority;
    assignedTo?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ items: InboxItem[]; total: number }> {
  const params = new URLSearchParams({ user_id: userId });
  if (options.status) params.append("status", options.status);
  if (options.platform) params.append("platform", options.platform);
  if (options.priority) params.append("priority", options.priority);
  if (options.assignedTo) params.append("assigned_to", options.assignedTo);
  if (options.limit) params.append("limit", options.limit.toString());
  if (options.offset) params.append("offset", options.offset.toString());

  const data = await apiCall<{
    items: InboxItemApi[];
    total: number;
  }>(`/api/social-media/inbox?${params}`);

  return {
    items: data.items.map(transformInboxItem),
    total: data.total,
  };
}

export async function fetchInboxSummary(userId: string): Promise<InboxSummary> {
  const data = await apiCall<{
    total_unread: number;
    total_pending: number;
    total_escalated: number;
    by_platform: Record<string, number>;
    by_type: Record<string, number>;
  }>(`/api/social-media/inbox/summary?user_id=${userId}`);

  return {
    totalUnread: data.total_unread,
    totalPending: data.total_pending,
    totalEscalated: data.total_escalated,
    byPlatform: data.by_platform,
    byType: data.by_type,
  };
}

export async function updateInboxItem(
  itemId: string,
  userId: string,
  updates: Partial<{
    status: InboxStatus;
    assignedTo: string;
    priority: Priority;
    internalNotes: string;
  }>
): Promise<InboxItem> {
  const data = await apiCall<InboxItemApi>(
    `/api/social-media/inbox/${itemId}?user_id=${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: updates.status,
        assigned_to: updates.assignedTo,
        priority: updates.priority,
        internal_notes: updates.internalNotes,
      }),
    }
  );
  return transformInboxItem(data);
}

export async function replyToInboxItem(
  itemId: string,
  userId: string,
  replyText: string
): Promise<InboxItem> {
  const data = await apiCall<InboxItemApi>(
    `/api/social-media/inbox/${itemId}/reply?user_id=${userId}&reply_text=${encodeURIComponent(replyText)}`,
    { method: "POST" }
  );
  return transformInboxItem(data);
}

// ============================================================================
// CALENDAR API
// ============================================================================

export async function fetchCalendar(
  userId: string,
  startDate: string,
  endDate: string
): Promise<CalendarDay[]> {
  const params = new URLSearchParams({
    user_id: userId,
    start_date: startDate,
    end_date: endDate,
  });

  const data = await apiCall<
    Array<{
      date: string;
      posts: Array<{
        id: string;
        title?: string;
        content_preview: string;
        platforms: Platform[];
        scheduled_at: string;
        status: PostStatus;
        campaign_id?: string;
        campaign_name?: string;
      }>;
      total_scheduled: number;
    }>
  >(`/api/social-media/calendar?${params}`);

  return data.map((day) => ({
    date: day.date,
    posts: day.posts.map((p) => ({
      id: p.id,
      title: p.title,
      contentPreview: p.content_preview,
      platforms: p.platforms,
      scheduledAt: p.scheduled_at,
      status: p.status,
      campaignId: p.campaign_id,
      campaignName: p.campaign_name,
    })),
    totalScheduled: day.total_scheduled,
  }));
}

// ============================================================================
// ANALYTICS API
// ============================================================================

export async function fetchAnalyticsOverview(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<AnalyticsOverview> {
  const params = new URLSearchParams({ user_id: userId });
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);

  const data = await apiCall<{
    period_start: string;
    period_end: string;
    total_followers: number;
    followers_change: number;
    followers_change_pct: number;
    total_posts: number;
    total_impressions: number;
    total_engagements: number;
    avg_engagement_rate: number;
    by_platform: Record<string, Record<string, number>>;
  }>(`/api/social-media/analytics/overview?${params}`);

  return {
    periodStart: data.period_start,
    periodEnd: data.period_end,
    totalFollowers: data.total_followers,
    followersChange: data.followers_change,
    followersChangePct: data.followers_change_pct,
    totalPosts: data.total_posts,
    totalImpressions: data.total_impressions,
    totalEngagements: data.total_engagements,
    avgEngagementRate: data.avg_engagement_rate,
    byPlatform: data.by_platform,
  };
}

// ============================================================================
// AI API
// ============================================================================

export async function generateContent(
  userId: string,
  options: {
    prompt?: string;
    cmsArticleId?: string;
    cmsHeadline?: string;
    cmsSummary?: string;
    cmsUrl?: string;
    platforms?: Platform[];
    tone?: string;
    includeHashtags?: boolean;
    includeCta?: boolean;
  }
): Promise<AIGenerateResponse> {
  const data = await apiCall<{
    variants: Array<{
      platform: Platform;
      content: string;
      hashtags: string[];
      character_count: number;
      within_limit: boolean;
      confidence_score: number;
    }>;
    suggested_posting_times: string[];
    model_used: string;
    prompt_used: string;
  }>(`/api/social-media/ai/generate?user_id=${userId}`, {
    method: "POST",
    body: JSON.stringify({
      prompt: options.prompt,
      cms_article_id: options.cmsArticleId,
      cms_headline: options.cmsHeadline,
      cms_summary: options.cmsSummary,
      cms_url: options.cmsUrl,
      platforms: options.platforms || [],
      tone: options.tone || "professional",
      include_hashtags: options.includeHashtags ?? true,
      include_cta: options.includeCta ?? false,
    }),
  });

  return {
    variants: data.variants.map((v) => ({
      platform: v.platform,
      content: v.content,
      hashtags: v.hashtags,
      characterCount: v.character_count,
      withinLimit: v.within_limit,
      confidenceScore: v.confidence_score,
    })),
    suggestedPostingTimes: data.suggested_posting_times,
    modelUsed: data.model_used,
    promptUsed: data.prompt_used,
  };
}

export async function suggestHashtags(
  content: string,
  platform?: Platform,
  limit = 10
): Promise<string[]> {
  const data = await apiCall<{ hashtags: string[] }>(
    "/api/social-media/ai/suggest-hashtags",
    {
      method: "POST",
      body: JSON.stringify({
        content,
        platform,
        limit,
      }),
    }
  );
  return data.hashtags;
}

export async function optimizeContent(
  content: string,
  platform: Platform
): Promise<{
  content: string;
  characterCount: number;
  withinLimit: boolean;
  suggestions: string[];
}> {
  const data = await apiCall<{
    content: string;
    character_count: number;
    within_limit: boolean;
    suggestions: string[];
  }>("/api/social-media/ai/optimize", {
    method: "POST",
    body: JSON.stringify({ content, platform }),
  });

  return {
    content: data.content,
    characterCount: data.character_count,
    withinLimit: data.within_limit,
    suggestions: data.suggestions,
  };
}

// ============================================================================
// CMS INTEGRATION API
// ============================================================================

export async function distributeArticle(
  userId: string,
  article: {
    cmsArticleId: string;
    cmsHeadline: string;
    cmsSummary?: string;
    cmsUrl: string;
    cmsAuthorId?: string;
    cmsCategory?: string;
    cmsTags?: string[];
    platforms: Platform[];
    scheduleAt?: string;
    campaignId?: string;
  }
): Promise<SocialPost> {
  const data = await apiCall<SocialPostApi>(
    `/api/social-media/cms/distribute?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({
        cms_article_id: article.cmsArticleId,
        cms_headline: article.cmsHeadline,
        cms_summary: article.cmsSummary,
        cms_url: article.cmsUrl,
        cms_author_id: article.cmsAuthorId,
        cms_category: article.cmsCategory,
        cms_tags: article.cmsTags || [],
        platforms: article.platforms,
        schedule_at: article.scheduleAt,
        campaign_id: article.campaignId,
      }),
    }
  );
  return transformPost(data);
}

// ============================================================================
// MEDIA ASSETS API
// ============================================================================

export type AssetType = "image" | "video" | "gif" | "audio";
export type UsageRights = "owned" | "licensed" | "stock" | "ugc" | "unknown";
// ApprovalStatus is already defined at the top of this file

export interface MediaAsset {
  id: string;
  userId: string;
  filename: string;
  fileUrl: string;
  fileType: AssetType;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  altText?: string;
  title?: string;
  description?: string;
  tags: string[];
  usageRights: UsageRights;
  licenseInfo?: string;
  expirationDate?: string;
  attributionRequired: boolean;
  attributionText?: string;
  approvalStatus: ApprovalStatus;
  approvedBy?: string;
  cmsAssetId?: string;
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface MediaAssetApi {
  id: string;
  user_id: string;
  filename: string;
  file_url: string;
  file_type: AssetType;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration_seconds?: number;
  alt_text?: string;
  title?: string;
  description?: string;
  tags: string[];
  usage_rights: string;
  license_info?: string;
  expiration_date?: string;
  attribution_required: boolean;
  attribution_text?: string;
  approval_status: string;
  approved_by?: string;
  cms_asset_id?: string;
  usage_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

function transformAsset(api: MediaAssetApi): MediaAsset {
  return {
    id: api.id,
    userId: api.user_id,
    filename: api.filename,
    fileUrl: api.file_url,
    fileType: api.file_type,
    mimeType: api.mime_type,
    fileSize: api.file_size,
    width: api.width,
    height: api.height,
    durationSeconds: api.duration_seconds,
    altText: api.alt_text,
    title: api.title,
    description: api.description,
    tags: api.tags || [],
    usageRights: api.usage_rights as UsageRights,
    licenseInfo: api.license_info,
    expirationDate: api.expiration_date,
    attributionRequired: api.attribution_required,
    attributionText: api.attribution_text,
    approvalStatus: api.approval_status as ApprovalStatus,
    approvedBy: api.approved_by,
    cmsAssetId: api.cms_asset_id,
    usageCount: api.usage_count,
    lastUsedAt: api.last_used_at,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

export interface AssetListResponse {
  assets: MediaAsset[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchAssets(
  userId: string,
  options?: {
    fileType?: AssetType;
    approvalStatus?: ApprovalStatus;
    tags?: string[];
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<AssetListResponse> {
  const params = new URLSearchParams({ user_id: userId });
  if (options?.fileType) params.append("file_type", options.fileType);
  if (options?.approvalStatus) params.append("approval_status", options.approvalStatus);
  if (options?.tags?.length) params.append("tags", options.tags.join(","));
  if (options?.search) params.append("search", options.search);
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());

  const data = await apiCall<{
    assets: MediaAssetApi[];
    total: number;
    limit: number;
    offset: number;
  }>(`/api/social-media/assets?${params}`);

  return {
    assets: data.assets.map(transformAsset),
    total: data.total,
    limit: data.limit,
    offset: data.offset,
  };
}

export async function fetchAssetTags(userId: string): Promise<string[]> {
  return apiCall<string[]>(`/api/social-media/assets/tags?user_id=${userId}`);
}

export async function fetchAsset(assetId: string): Promise<MediaAsset> {
  const data = await apiCall<MediaAssetApi>(`/api/social-media/assets/${assetId}`);
  return transformAsset(data);
}

export async function createAsset(
  userId: string,
  asset: {
    filename: string;
    fileUrl: string;
    fileType: AssetType;
    mimeType?: string;
    fileSize?: number;
    width?: number;
    height?: number;
    durationSeconds?: number;
    altText?: string;
    title?: string;
    description?: string;
    tags?: string[];
    usageRights?: UsageRights;
    licenseInfo?: string;
    expirationDate?: string;
    attributionRequired?: boolean;
    attributionText?: string;
    cmsAssetId?: string;
  }
): Promise<MediaAsset> {
  const data = await apiCall<MediaAssetApi>(
    `/api/social-media/assets?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({
        filename: asset.filename,
        file_url: asset.fileUrl,
        file_type: asset.fileType,
        mime_type: asset.mimeType,
        file_size: asset.fileSize,
        width: asset.width,
        height: asset.height,
        duration_seconds: asset.durationSeconds,
        alt_text: asset.altText,
        title: asset.title,
        description: asset.description,
        tags: asset.tags || [],
        usage_rights: asset.usageRights || "owned",
        license_info: asset.licenseInfo,
        expiration_date: asset.expirationDate,
        attribution_required: asset.attributionRequired || false,
        attribution_text: asset.attributionText,
        cms_asset_id: asset.cmsAssetId,
      }),
    }
  );
  return transformAsset(data);
}

export async function updateAsset(
  assetId: string,
  userId: string,
  updates: {
    altText?: string;
    title?: string;
    description?: string;
    tags?: string[];
    usageRights?: UsageRights;
    licenseInfo?: string;
    expirationDate?: string;
    attributionRequired?: boolean;
    attributionText?: string;
    approvalStatus?: ApprovalStatus;
  }
): Promise<MediaAsset> {
  const data = await apiCall<MediaAssetApi>(
    `/api/social-media/assets/${assetId}?user_id=${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        alt_text: updates.altText,
        title: updates.title,
        description: updates.description,
        tags: updates.tags,
        usage_rights: updates.usageRights,
        license_info: updates.licenseInfo,
        expiration_date: updates.expirationDate,
        attribution_required: updates.attributionRequired,
        attribution_text: updates.attributionText,
        approval_status: updates.approvalStatus,
      }),
    }
  );
  return transformAsset(data);
}

export async function deleteAsset(assetId: string, userId: string): Promise<void> {
  await apiCall<void>(`/api/social-media/assets/${assetId}?user_id=${userId}`, {
    method: "DELETE",
  });
}

export async function recordAssetUsage(assetId: string): Promise<void> {
  await apiCall<void>(`/api/social-media/assets/${assetId}/use`, {
    method: "POST",
  });
}

// ============================================================================
// STREAMS (Monitoring) API
// ============================================================================

export type StreamType = "mentions" | "keywords" | "hashtags" | "list" | "account" | "inbox" | "custom";
export type ColumnWidth = "narrow" | "medium" | "wide";
// Sentiment is already defined at the top of this file

export interface Stream {
  id: string;
  userId: string;
  name: string;
  description?: string;
  streamType: StreamType;
  platforms: Platform[];
  accountIds: string[];
  keywords: string[];
  hashtags: string[];
  excludeKeywords: string[];
  columnWidth: ColumnWidth;
  position: number;
  isVisible: boolean;
  refreshIntervalSeconds: number;
  createdAt: string;
  updatedAt: string;
}

interface StreamApi {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  stream_type: StreamType;
  platforms: Platform[];
  account_ids: string[];
  keywords: string[];
  hashtags: string[];
  exclude_keywords: string[];
  column_width: ColumnWidth;
  position: number;
  is_visible: boolean;
  refresh_interval_seconds: number;
  created_at: string;
  updated_at: string;
}

function transformStream(api: StreamApi): Stream {
  return {
    id: api.id,
    userId: api.user_id,
    name: api.name,
    description: api.description,
    streamType: api.stream_type,
    platforms: api.platforms || [],
    accountIds: api.account_ids || [],
    keywords: api.keywords || [],
    hashtags: api.hashtags || [],
    excludeKeywords: api.exclude_keywords || [],
    columnWidth: api.column_width,
    position: api.position,
    isVisible: api.is_visible,
    refreshIntervalSeconds: api.refresh_interval_seconds,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

export interface StreamItem {
  id: string;
  streamId: string;
  platform: Platform;
  itemType: string;
  content: string;
  authorUsername?: string;
  authorDisplayName?: string;
  authorProfileImage?: string;
  authorVerified: boolean;
  mediaUrls: string[];
  platformUrl?: string;
  sentiment?: Sentiment;
  engagementCount: number;
  platformCreatedAt: string;
  fetchedAt: string;
}

interface StreamItemApi {
  id: string;
  stream_id: string;
  platform: Platform;
  item_type: string;
  content: string;
  author_username?: string;
  author_display_name?: string;
  author_profile_image?: string;
  author_verified: boolean;
  media_urls: string[];
  platform_url?: string;
  sentiment?: Sentiment;
  engagement_count: number;
  platform_created_at: string;
  fetched_at: string;
}

function transformStreamItem(api: StreamItemApi): StreamItem {
  return {
    id: api.id,
    streamId: api.stream_id,
    platform: api.platform,
    itemType: api.item_type,
    content: api.content,
    authorUsername: api.author_username,
    authorDisplayName: api.author_display_name,
    authorProfileImage: api.author_profile_image,
    authorVerified: api.author_verified,
    mediaUrls: api.media_urls || [],
    platformUrl: api.platform_url,
    sentiment: api.sentiment,
    engagementCount: api.engagement_count,
    platformCreatedAt: api.platform_created_at,
    fetchedAt: api.fetched_at,
  };
}

export async function fetchStreams(
  userId: string,
  options?: {
    streamType?: StreamType;
    isVisible?: boolean;
  }
): Promise<Stream[]> {
  const params = new URLSearchParams({ user_id: userId });
  if (options?.streamType) params.append("stream_type", options.streamType);
  if (options?.isVisible !== undefined) params.append("is_visible", String(options.isVisible));

  const data = await apiCall<StreamApi[]>(`/api/social-media/streams?${params}`);
  return data.map(transformStream);
}

export async function fetchStream(streamId: string): Promise<Stream> {
  const data = await apiCall<StreamApi>(`/api/social-media/streams/${streamId}`);
  return transformStream(data);
}

export async function createStream(
  userId: string,
  stream: {
    name: string;
    streamType: StreamType;
    description?: string;
    platforms?: Platform[];
    accountIds?: string[];
    keywords?: string[];
    hashtags?: string[];
    excludeKeywords?: string[];
    columnWidth?: ColumnWidth;
    position?: number;
    isVisible?: boolean;
    refreshIntervalSeconds?: number;
  }
): Promise<Stream> {
  const data = await apiCall<StreamApi>(
    `/api/social-media/streams?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({
        name: stream.name,
        stream_type: stream.streamType,
        description: stream.description,
        platforms: stream.platforms || [],
        account_ids: stream.accountIds || [],
        keywords: stream.keywords || [],
        hashtags: stream.hashtags || [],
        exclude_keywords: stream.excludeKeywords || [],
        column_width: stream.columnWidth || "medium",
        position: stream.position || 0,
        is_visible: stream.isVisible ?? true,
        refresh_interval_seconds: stream.refreshIntervalSeconds || 300,
      }),
    }
  );
  return transformStream(data);
}

export async function updateStream(
  streamId: string,
  userId: string,
  updates: {
    name?: string;
    description?: string;
    streamType?: StreamType;
    platforms?: Platform[];
    accountIds?: string[];
    keywords?: string[];
    hashtags?: string[];
    excludeKeywords?: string[];
    columnWidth?: ColumnWidth;
    position?: number;
    isVisible?: boolean;
    refreshIntervalSeconds?: number;
  }
): Promise<Stream> {
  const data = await apiCall<StreamApi>(
    `/api/social-media/streams/${streamId}?user_id=${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        name: updates.name,
        description: updates.description,
        stream_type: updates.streamType,
        platforms: updates.platforms,
        account_ids: updates.accountIds,
        keywords: updates.keywords,
        hashtags: updates.hashtags,
        exclude_keywords: updates.excludeKeywords,
        column_width: updates.columnWidth,
        position: updates.position,
        is_visible: updates.isVisible,
        refresh_interval_seconds: updates.refreshIntervalSeconds,
      }),
    }
  );
  return transformStream(data);
}

export async function deleteStream(streamId: string, userId: string): Promise<void> {
  await apiCall<void>(`/api/social-media/streams/${streamId}?user_id=${userId}`, {
    method: "DELETE",
  });
}

export async function reorderStreams(userId: string, streamIds: string[]): Promise<Stream[]> {
  const data = await apiCall<StreamApi[]>(
    `/api/social-media/streams/reorder?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({ stream_ids: streamIds }),
    }
  );
  return data.map(transformStream);
}

export async function fetchStreamItems(
  streamId: string,
  limit: number = 50
): Promise<StreamItem[]> {
  const data = await apiCall<StreamItemApi[]>(
    `/api/social-media/streams/${streamId}/items?limit=${limit}`
  );
  return data.map(transformStreamItem);
}

// ============================================================================
// APPROVAL WORKFLOWS API
// ============================================================================

export type ApprovalDecision = "approved" | "rejected" | "changes_requested" | "skipped";

export interface WorkflowStep {
  step: number;
  name: string;
  requiredRoles: string[];
  timeoutHours?: number;
  optional: boolean;
}

export interface ApprovalWorkflow {
  id: string;
  userId: string;
  name: string;
  description?: string;
  appliesToPlatforms: Platform[];
  appliesToAccounts: string[];
  appliesToCampaignTypes: string[];
  steps: WorkflowStep[];
  requiredFields: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowStepApi {
  step: number;
  name: string;
  required_roles: string[];
  timeout_hours?: number;
  optional: boolean;
}

interface ApprovalWorkflowApi {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  applies_to_platforms: Platform[];
  applies_to_accounts: string[];
  applies_to_campaign_types: string[];
  steps: WorkflowStepApi[];
  required_fields: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function transformWorkflow(api: ApprovalWorkflowApi): ApprovalWorkflow {
  return {
    id: api.id,
    userId: api.user_id,
    name: api.name,
    description: api.description,
    appliesToPlatforms: api.applies_to_platforms || [],
    appliesToAccounts: api.applies_to_accounts || [],
    appliesToCampaignTypes: api.applies_to_campaign_types || [],
    steps: (api.steps || []).map((s) => ({
      step: s.step,
      name: s.name,
      requiredRoles: s.required_roles || [],
      timeoutHours: s.timeout_hours,
      optional: s.optional,
    })),
    requiredFields: api.required_fields || [],
    isActive: api.is_active,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

export interface PendingApproval {
  postId: string;
  postTitle?: string;
  postContent: string;
  postPlatforms: string[];
  workflowId?: string;
  currentStep: number;
  currentStepName?: string;
  submittedBy: string;
  submittedAt: string;
}

interface PendingApprovalApi {
  post_id: string;
  post_title?: string;
  post_content: string;
  post_platforms: string[];
  workflow_id?: string;
  current_step: number;
  current_step_name?: string;
  submitted_by: string;
  submitted_at: string;
}

function transformPendingApproval(api: PendingApprovalApi): PendingApproval {
  return {
    postId: api.post_id,
    postTitle: api.post_title,
    postContent: api.post_content,
    postPlatforms: api.post_platforms || [],
    workflowId: api.workflow_id,
    currentStep: api.current_step,
    currentStepName: api.current_step_name,
    submittedBy: api.submitted_by,
    submittedAt: api.submitted_at,
  };
}

export interface ApprovalHistoryEntry {
  id: string;
  postId: string;
  workflowId?: string;
  step: number;
  decision: string;
  reviewerId: string;
  comment?: string;
  createdAt: string;
}

interface ApprovalHistoryApi {
  id: string;
  post_id: string;
  workflow_id?: string;
  step: number;
  decision: string;
  reviewer_id: string;
  comment?: string;
  created_at: string;
}

function transformApprovalHistory(api: ApprovalHistoryApi): ApprovalHistoryEntry {
  return {
    id: api.id,
    postId: api.post_id,
    workflowId: api.workflow_id,
    step: api.step,
    decision: api.decision,
    reviewerId: api.reviewer_id,
    comment: api.comment,
    createdAt: api.created_at,
  };
}

export async function fetchWorkflows(
  userId: string,
  isActive?: boolean
): Promise<ApprovalWorkflow[]> {
  const params = new URLSearchParams({ user_id: userId });
  if (isActive !== undefined) params.append("is_active", String(isActive));

  const data = await apiCall<ApprovalWorkflowApi[]>(`/api/social-media/workflows?${params}`);
  return data.map(transformWorkflow);
}

export async function fetchWorkflow(workflowId: string): Promise<ApprovalWorkflow> {
  const data = await apiCall<ApprovalWorkflowApi>(`/api/social-media/workflows/${workflowId}`);
  return transformWorkflow(data);
}

export async function createWorkflow(
  userId: string,
  workflow: {
    name: string;
    description?: string;
    appliesToPlatforms?: Platform[];
    appliesToAccounts?: string[];
    appliesToCampaignTypes?: string[];
    steps: Array<{
      step?: number;
      name: string;
      requiredRoles?: string[];
      timeoutHours?: number;
      optional?: boolean;
    }>;
    requiredFields?: string[];
    isActive?: boolean;
  }
): Promise<ApprovalWorkflow> {
  const data = await apiCall<ApprovalWorkflowApi>(
    `/api/social-media/workflows?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({
        name: workflow.name,
        description: workflow.description,
        applies_to_platforms: workflow.appliesToPlatforms || [],
        applies_to_accounts: workflow.appliesToAccounts || [],
        applies_to_campaign_types: workflow.appliesToCampaignTypes || [],
        steps: workflow.steps.map((s, i) => ({
          step: s.step || i + 1,
          name: s.name,
          required_roles: s.requiredRoles || [],
          timeout_hours: s.timeoutHours,
          optional: s.optional || false,
        })),
        required_fields: workflow.requiredFields || [],
        is_active: workflow.isActive ?? true,
      }),
    }
  );
  return transformWorkflow(data);
}

export async function updateWorkflow(
  workflowId: string,
  userId: string,
  updates: {
    name?: string;
    description?: string;
    appliesToPlatforms?: Platform[];
    appliesToAccounts?: string[];
    appliesToCampaignTypes?: string[];
    steps?: Array<{
      step?: number;
      name: string;
      requiredRoles?: string[];
      timeoutHours?: number;
      optional?: boolean;
    }>;
    requiredFields?: string[];
    isActive?: boolean;
  }
): Promise<ApprovalWorkflow> {
  const body: Record<string, unknown> = {};

  if (updates.name !== undefined) body.name = updates.name;
  if (updates.description !== undefined) body.description = updates.description;
  if (updates.appliesToPlatforms !== undefined) body.applies_to_platforms = updates.appliesToPlatforms;
  if (updates.appliesToAccounts !== undefined) body.applies_to_accounts = updates.appliesToAccounts;
  if (updates.appliesToCampaignTypes !== undefined) body.applies_to_campaign_types = updates.appliesToCampaignTypes;
  if (updates.steps !== undefined) {
    body.steps = updates.steps.map((s, i) => ({
      step: s.step || i + 1,
      name: s.name,
      required_roles: s.requiredRoles || [],
      timeout_hours: s.timeoutHours,
      optional: s.optional || false,
    }));
  }
  if (updates.requiredFields !== undefined) body.required_fields = updates.requiredFields;
  if (updates.isActive !== undefined) body.is_active = updates.isActive;

  const data = await apiCall<ApprovalWorkflowApi>(
    `/api/social-media/workflows/${workflowId}?user_id=${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  );
  return transformWorkflow(data);
}

export async function deleteWorkflow(workflowId: string, userId: string): Promise<void> {
  await apiCall<void>(`/api/social-media/workflows/${workflowId}?user_id=${userId}`, {
    method: "DELETE",
  });
}

export async function fetchPendingApprovals(
  userId: string,
  approverRole?: string
): Promise<PendingApproval[]> {
  const params = new URLSearchParams({ user_id: userId });
  if (approverRole) params.append("approver_role", approverRole);

  const data = await apiCall<PendingApprovalApi[]>(`/api/social-media/approvals/pending?${params}`);
  return data.map(transformPendingApproval);
}

export async function submitForApproval(
  postId: string,
  userId: string,
  workflowId?: string
): Promise<SocialPost> {
  const data = await apiCall<SocialPostApi>(
    `/api/social-media/posts/${postId}/submit-approval?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({ workflow_id: workflowId }),
    }
  );
  return transformPost(data);
}

export async function makeApprovalDecision(
  postId: string,
  userId: string,
  decision: ApprovalDecision,
  comment?: string
): Promise<SocialPost> {
  const data = await apiCall<SocialPostApi>(
    `/api/social-media/posts/${postId}/approve?user_id=${userId}`,
    {
      method: "POST",
      body: JSON.stringify({ decision, comment }),
    }
  );
  return transformPost(data);
}

export async function fetchApprovalHistory(
  options?: {
    postId?: string;
    workflowId?: string;
    limit?: number;
  }
): Promise<ApprovalHistoryEntry[]> {
  const params = new URLSearchParams();
  if (options?.postId) params.append("post_id", options.postId);
  if (options?.workflowId) params.append("workflow_id", options.workflowId);
  if (options?.limit) params.append("limit", options.limit.toString());

  const data = await apiCall<ApprovalHistoryApi[]>(`/api/social-media/approvals/history?${params}`);
  return data.map(transformApprovalHistory);
}

// ============================================================================
// PLATFORM HELPERS
// ============================================================================

export const PLATFORM_INFO: Record<
  Platform,
  {
    name: string;
    color: string;
    icon: string;
    characterLimit: number;
    supportsMedia: boolean;
    supportsLinks: boolean;
    supportsHashtags: boolean;
  }
> = {
  twitter: {
    name: "X (Twitter)",
    color: "#000000",
    icon: "x",
    characterLimit: 280,
    supportsMedia: true,
    supportsLinks: true,
    supportsHashtags: true,
  },
  facebook: {
    name: "Facebook",
    color: "#1877F2",
    icon: "facebook",
    characterLimit: 63206,
    supportsMedia: true,
    supportsLinks: true,
    supportsHashtags: true,
  },
  instagram: {
    name: "Instagram",
    color: "#E4405F",
    icon: "instagram",
    characterLimit: 2200,
    supportsMedia: true,
    supportsLinks: false,
    supportsHashtags: true,
  },
  linkedin: {
    name: "LinkedIn",
    color: "#0A66C2",
    icon: "linkedin",
    characterLimit: 3000,
    supportsMedia: true,
    supportsLinks: true,
    supportsHashtags: true,
  },
  tiktok: {
    name: "TikTok",
    color: "#000000",
    icon: "tiktok",
    characterLimit: 2200,
    supportsMedia: true,
    supportsLinks: false,
    supportsHashtags: true,
  },
  youtube: {
    name: "YouTube",
    color: "#FF0000",
    icon: "youtube",
    characterLimit: 5000,
    supportsMedia: true,
    supportsLinks: true,
    supportsHashtags: true,
  },
  threads: {
    name: "Threads",
    color: "#000000",
    icon: "threads",
    characterLimit: 500,
    supportsMedia: true,
    supportsLinks: true,
    supportsHashtags: true,
  },
  pinterest: {
    name: "Pinterest",
    color: "#E60023",
    icon: "pinterest",
    characterLimit: 500,
    supportsMedia: true,
    supportsLinks: true,
    supportsHashtags: true,
  },
};

export function getPlatformInfo(platform: Platform) {
  return PLATFORM_INFO[platform];
}

export function getCharacterCount(content: string, platform: Platform): {
  count: number;
  limit: number;
  remaining: number;
  isOver: boolean;
} {
  const limit = PLATFORM_INFO[platform].characterLimit;
  const count = content.length;
  return {
    count,
    limit,
    remaining: limit - count,
    isOver: count > limit,
  };
}

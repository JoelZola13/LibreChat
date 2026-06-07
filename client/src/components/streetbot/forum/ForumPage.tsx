import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDebounce } from 'use-debounce';
import {
  Search,
  Plus,
  MessageSquare,
  Eye,
  Heart,
  Pin,
  Star,
  Filter,
  TrendingUp,
  Clock,
  HelpCircle,
  Lightbulb,
  Trophy,
  Shield,
  Megaphone,
  MessageCircle,
  ArrowLeft,
  Send,
  Play,
  Film,
  Bookmark,
  MoreHorizontal,
  Users,
  Flame,
  SlidersHorizontal,
  Repeat2,
  Scale,
  Grid3X3,
} from 'lucide-react';
import { SB_API_BASE } from '~/components/streetbot/shared/apiConfig';
import { useGlassStyles } from '../shared/useGlassStyles';
import { GlassBackground } from '../shared/GlassBackground';
import { useResponsive } from '../hooks/useResponsive';
import { useAuthContext } from '~/hooks/AuthContext';
import { getSeamlessNavBarStyle } from '../shared/glassNav';
import { useTopNavScrolled } from '../shared/useTopNavScrolled';
import NavDropdown from '../shared/NavDropdown';
import {
  STREET_PROFILE_NAV_ITEMS,
  isStreetProfileNavActive,
} from '../shared/streetProfileNavItems';
import { getOrCreateUserId } from '@/lib/userId';
import {
  SOCIAL_SAMPLE_FORUM_POSTS,
  getGroupMessagesHref,
  getProfileMessageHref,
  getSampleAuthorProfilesMap,
  mergeSocialItems,
} from '../shared/socialNetworkSamples';

// Author profile type for enrichment
type AuthorProfile = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  is_featured: boolean;
  primary_roles: string[];
};

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string;
  display_order: number;
  is_restricted: boolean;
  post_count: number;
};

type Post = {
  id: string;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  title: string;
  content_preview: string;
  author_id: string | null;
  author_name: string | null;
  author_username?: string;
  is_anonymous: boolean;
  anonymous_name: string | null;
  post_type: string;
  tags: string[];
  status: string;
  is_pinned: boolean;
  is_featured: boolean;
  view_count: number;
  reply_count: number;
  like_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  last_activity_at: string;
  created_at: string;
  related_group_id?: number;
  related_group_name?: string;
  related_channel_id?: string;
  media?: Array<{
    type: 'image' | 'meme' | 'video';
    url?: string;
    videoSrc?: string;
    alt?: string;
    caption?: string;
    topText?: string;
    bottomText?: string;
    title?: string;
    duration?: string;
  }>;
};

type PostSort = 'last_activity_at' | 'created_at' | 'like_count';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  lightbulb: <Lightbulb size={18} />,
  star: <Star size={18} />,
  trophy: <Trophy size={18} />,
  'question-circle': <HelpCircle size={18} />,
  heart: <Heart size={18} />,
  shield: <Shield size={18} />,
  megaphone: <Megaphone size={18} />,
  chat: <MessageCircle size={18} />,
};

const POST_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  discussion: { label: 'Discussion', color: '#FFD600' },
  question: { label: 'Question', color: '#3B82F6' },
  story: { label: 'Story', color: '#10B981' },
  resource: { label: 'Resource', color: '#F59E0B' },
  announcement: { label: 'Announcement', color: '#EF4444' },
};

const LOCAL_FORUM_POSTS_KEY = 'streetvoices:word-on-the-street:posts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getStringField(source: unknown, keys: string[]) {
  if (!isRecord(source)) return '';
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function readLocalForumPosts(): Post[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_FORUM_POSTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(
          (post): post is Post =>
            isRecord(post) && typeof post.id === 'string' && typeof post.title === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

function writeLocalForumPosts(posts: Post[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_FORUM_POSTS_KEY, JSON.stringify(posts.slice(0, 80)));
  } catch {
    // Local persistence is a convenience fallback; the UI still updates in memory.
  }
}

function normalizePostTags(input: string) {
  return input
    .split(',')
    .map((tag) => tag.trim().replace(/^#/, ''))
    .filter(Boolean)
    .slice(0, 8);
}

function getAuthorDisplayName(authUser: unknown) {
  const candidate = getStringField(authUser, ['name', 'displayName', 'username', 'email']);
  if (!candidate) return 'Street Voices member';
  return candidate.includes('@') ? candidate.split('@')[0] : candidate;
}

function getAuthorUsername(authUser: unknown, userId: string) {
  const candidate = getStringField(authUser, ['username', 'email', 'name', 'displayName']);
  const base = candidate.includes('@') ? candidate.split('@')[0] : candidate;
  const normalized = base
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || `member_${userId.slice(0, 8)}`;
}

function postMatchesFilters(
  post: Post,
  filters: {
    category: string | null;
    author: string | null;
    group: string | null;
    search: string;
  },
) {
  if (filters.category && post.category_slug !== filters.category) return false;
  if (filters.author && post.author_username !== filters.author) return false;
  if (filters.group && String(post.related_group_id) !== filters.group) return false;
  if (!filters.search) return true;

  const query = filters.search.toLowerCase();
  const searchable = [
    post.title,
    post.content_preview,
    post.author_name,
    post.related_group_name,
    ...post.tags,
  ]
    .join(' ')
    .toLowerCase();
  return searchable.includes(query);
}

function sortForumPosts(posts: Post[], sortBy: PostSort) {
  return [...posts].sort((a, b) => {
    if (sortBy === 'like_count') return b.like_count - a.like_count;
    return new Date(b[sortBy]).getTime() - new Date(a[sortBy]).getTime();
  });
}

export default function ForumPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const {
    isDark,
    colors: baseColors,
    glassCard: baseGlassCard,
    glassSurface: baseGlassSurface,
    glassTag,
    cardHoverHandlers,
  } = useGlassStyles();
  const colors = useMemo(
    () => ({
      ...baseColors,
      bg: isDark
        ? 'linear-gradient(135deg, #10131d 0%, #211d31 47%, #2a1830 100%)'
        : 'linear-gradient(135deg, #f7f7fb 0%, #f0eef7 52%, #fff8d6 100%)',
      surface: isDark ? 'rgba(49, 48, 63, 0.62)' : 'rgba(255, 255, 255, 0.78)',
      surfaceHover: isDark ? 'rgba(66, 64, 82, 0.78)' : 'rgba(255, 255, 255, 0.9)',
      surfaceActive: isDark ? 'rgba(255, 214, 0, 0.18)' : 'rgba(255, 214, 0, 0.28)',
      border: isDark ? 'rgba(236, 238, 255, 0.16)' : 'rgba(17, 24, 39, 0.1)',
      borderHover: isDark ? 'rgba(255, 214, 0, 0.42)' : 'rgba(255, 214, 0, 0.72)',
      borderActive: isDark ? 'rgba(255, 214, 0, 0.72)' : 'rgba(255, 214, 0, 0.86)',
      text: isDark ? '#F8F8FF' : '#111827',
      textSecondary: isDark ? 'rgba(248, 248, 255, 0.76)' : '#4b5563',
      textMuted: isDark ? 'rgba(248, 248, 255, 0.54)' : '#6b7280',
      accent: '#FFD600',
      accentHover: '#F2C900',
      accentGlow: 'rgba(255, 214, 0, 0.36)',
      cardBg: isDark ? 'rgba(39, 38, 52, 0.68)' : 'rgba(255, 255, 255, 0.74)',
      cardBgHover: isDark ? 'rgba(53, 51, 69, 0.82)' : 'rgba(255, 255, 255, 0.92)',
      glassShadow: isDark
        ? '0 28px 72px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255,255,255,0.05)'
        : '0 18px 48px rgba(17, 24, 39, 0.12), inset 0 1px 0 rgba(255,255,255,0.72)',
      glassShadowHover: isDark
        ? '0 34px 88px rgba(0, 0, 0, 0.48), 0 0 28px rgba(255, 214, 0, 0.12)'
        : '0 24px 56px rgba(17, 24, 39, 0.16)',
      heroBg: isDark
        ? 'linear-gradient(135deg, rgba(42, 41, 58, 0.86), rgba(54, 46, 66, 0.72))'
        : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 248, 214, 0.62))',
    }),
    [baseColors, isDark],
  );
  const glassCard = useMemo(
    () => ({
      ...baseGlassCard,
      background: colors.cardBg,
      border: `1px solid ${colors.border}`,
      borderRadius: 20,
      boxShadow: colors.glassShadow,
      backdropFilter: 'blur(28px) saturate(165%)',
      WebkitBackdropFilter: 'blur(28px) saturate(165%)',
    }),
    [baseGlassCard, colors],
  );
  const glassSurface = useMemo(
    () => ({
      ...baseGlassSurface,
      background: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: 16,
      boxShadow: colors.glassShadow,
      backdropFilter: 'blur(22px) saturate(165%)',
      WebkitBackdropFilter: 'blur(22px) saturate(165%)',
    }),
    [baseGlassSurface, colors],
  );
  const { isMobile, width: viewportWidth } = useResponsive();
  const accentTextColor = isDark ? colors.accent : '#111827';
  const isCompactDesktopNav = !isMobile && viewportWidth < 1180;
  const isTopNavScrolled = useTopNavScrolled();
  const { user: authUser } = useAuthContext();
  const userId = getOrCreateUserId(authUser?.id);
  const [categories, setCategories] = useState<Category[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebounce(searchQuery, 250);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    searchParams.get('category'),
  );
  const selectedAuthor = searchParams.get('author');
  const selectedGroup = searchParams.get('group');
  const selectedPost = searchParams.get('post');
  const [sortBy, setSortBy] = useState<PostSort>('last_activity_at');
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCategory, setNewPostCategory] = useState('');
  const [newPostType, setNewPostType] = useState<keyof typeof POST_TYPE_LABELS>('discussion');
  const [newPostTags, setNewPostTags] = useState('');
  const [newPostError, setNewPostError] = useState('');
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [activeVideo, setActiveVideo] = useState<{
    src: string;
    poster?: string;
    title: string;
    caption?: string;
  } | null>(null);

  const routePostMatch = location.pathname.match(/\/(?:word-on-the-street|forum)\/post\/([^/?#]+)/);
  const routePostId = routePostMatch?.[1] ? decodeURIComponent(routePostMatch[1]) : null;
  const isComposerRoute = /\/(?:word-on-the-street|forum)\/new\/?$/.test(location.pathname);
  const focusedPostId = routePostId ?? selectedPost;
  const isFeedRoute = !isComposerRoute && !focusedPostId;

  // Author profiles for enrichment (keyed by user_id)
  const [authorProfiles, setAuthorProfiles] = useState<Record<string, AuthorProfile>>({});

  const loadCategories = useCallback(async () => {
    const categorySourcePosts = [...SOCIAL_SAMPLE_FORUM_POSTS, ...readLocalForumPosts()];
    const categoryMap = new Map<string, Post>();
    categorySourcePosts.forEach((post) => {
      if (post.category_slug && !categoryMap.has(post.category_slug)) {
        categoryMap.set(post.category_slug, post as Post);
      }
    });
    const sampleCategories = Array.from(categoryMap.values()).map((post) => ({
      id: `sample-category-${post.category_slug}`,
      name: post.category_name || 'Community',
      slug: post.category_slug || 'community',
      description: 'Sample Street Voices social network content',
      icon: 'chat',
      color: '#FFD600',
      display_order: 99,
      is_restricted: false,
      post_count: categorySourcePosts.filter((item) => item.category_slug === post.category_slug)
        .length,
    }));

    try {
      const resp = await fetch(`${SB_API_BASE}/forum/categories?user_id=${userId}`);
      if (resp.ok) {
        const data = await resp.json();
        setCategories(
          mergeSocialItems(
            Array.isArray(data) ? data : [],
            sampleCategories,
            (category) => category.slug,
          ),
        );
      } else {
        setCategories(sampleCategories);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
      setCategories(sampleCategories);
    }
  }, [userId]);

  const loadPosts = useCallback(async () => {
    const filters = {
      category: selectedCategory,
      author: selectedAuthor,
      group: selectedGroup,
      search: debouncedSearchQuery,
    };
    const samplePosts = SOCIAL_SAMPLE_FORUM_POSTS.filter((post) =>
      postMatchesFilters(post as Post, filters),
    );
    const localPosts = readLocalForumPosts().filter((post) => {
      if (focusedPostId && post.id === focusedPostId) return true;
      return postMatchesFilters(post, filters);
    });

    try {
      setLoading(true);
      const params = new URLSearchParams({ user_id: userId, sort_by: sortBy });
      if (selectedCategory) params.append('category_slug', selectedCategory);
      if (debouncedSearchQuery) params.append('search', debouncedSearchQuery);

      const resp = await fetch(`${SB_API_BASE}/forum/posts?${params}`);
      if (resp.ok) {
        const data = await resp.json();
        const apiPosts = (Array.isArray(data) ? data : []) as Post[];
        const filteredApiPosts = apiPosts.filter((post) => {
          if (selectedAuthor && post.author_username !== selectedAuthor) return false;
          if (selectedGroup && String(post.related_group_id) !== selectedGroup) return false;
          return true;
        });
        const mergedSeedPosts = mergeSocialItems(
          filteredApiPosts,
          samplePosts as Post[],
          (post) => post.id,
        );
        setPosts(
          sortForumPosts(
            mergeSocialItems(localPosts, mergedSeedPosts, (post) => post.id),
            sortBy,
          ),
        );
      } else {
        setPosts(
          sortForumPosts(
            mergeSocialItems(localPosts, samplePosts as Post[], (post) => post.id),
            sortBy,
          ),
        );
      }
    } catch (error) {
      console.error('Failed to load posts:', error);
      setPosts(
        sortForumPosts(
          mergeSocialItems(localPosts, samplePosts as Post[], (post) => post.id),
          sortBy,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [
    userId,
    selectedCategory,
    selectedAuthor,
    selectedGroup,
    debouncedSearchQuery,
    sortBy,
    focusedPostId,
  ]);

  // Batch load author profiles for posts
  const loadAuthorProfiles = useCallback(async (postList: Post[]) => {
    const authorIds = [
      ...new Set(
        postList
          .filter((p) => !p.is_anonymous)
          .map((p) => p.author_id)
          .filter((id): id is string => id !== null && id !== ''),
      ),
    ];

    if (authorIds.length === 0) return;

    try {
      const resp = await fetch(`${SB_API_BASE}/street-profiles/batch-lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: authorIds }),
      });
      if (!resp.ok) {
        setAuthorProfiles((prev) => ({ ...getSampleAuthorProfilesMap(), ...prev }));
        return;
      }
      const profiles = await resp.json();
      setAuthorProfiles({ ...getSampleAuthorProfilesMap(), ...profiles });
    } catch {
      setAuthorProfiles(getSampleAuthorProfilesMap());
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Fetch author profiles when posts change
  useEffect(() => {
    if (posts.length > 0) {
      loadAuthorProfiles(posts);
    }
  }, [posts, loadAuthorProfiles]);

  useEffect(() => {
    if (!newPostCategory && categories.length > 0) {
      setNewPostCategory(categories[0].slug);
    }
  }, [categories, newPostCategory]);

  const handleCreatePost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newPostTitle.trim();
    const content = newPostContent.trim();
    if (!title || !content) {
      setNewPostError('Add a title and a post before publishing.');
      return;
    }

    const category = categories.find((item) => item.slug === newPostCategory) ||
      categories[0] || {
        id: 'local-category-community',
        name: 'Community',
        slug: 'community',
        description: null,
        icon: 'chat',
        color: '#FFD600',
        display_order: 99,
        is_restricted: false,
        post_count: 0,
      };
    const now = new Date().toISOString();
    const draftPost: Post = {
      id: `local-post-${Date.now()}`,
      category_id: category.id,
      category_name: category.name,
      category_slug: category.slug,
      title,
      content_preview: content,
      author_id: userId,
      author_name: getAuthorDisplayName(authUser),
      author_username: getAuthorUsername(authUser, userId),
      is_anonymous: false,
      anonymous_name: null,
      post_type: newPostType,
      tags: normalizePostTags(newPostTags),
      status: 'published',
      is_pinned: false,
      is_featured: false,
      view_count: 1,
      reply_count: 0,
      like_count: 0,
      is_liked: false,
      is_bookmarked: false,
      last_activity_at: now,
      created_at: now,
    };

    setIsSubmittingPost(true);
    setNewPostError('');
    let createdPost = draftPost;

    try {
      const resp = await fetch(`${SB_API_BASE}/forum/posts?user_id=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          category_slug: category.slug,
          post_type: newPostType,
          tags: draftPost.tags,
          user_id: userId,
        }),
      });
      if (resp.ok) {
        const data = await resp.json().catch(() => null);
        if (isRecord(data) && typeof data.id === 'string') {
          createdPost = {
            ...draftPost,
            ...(data as Partial<Post>),
            content_preview:
              typeof data.content_preview === 'string'
                ? data.content_preview
                : typeof data.content === 'string'
                  ? data.content
                  : draftPost.content_preview,
          };
        }
      }
    } catch (error) {
      console.info('Forum API was unavailable; saved the post locally.', error);
    }

    const storedPosts = readLocalForumPosts();
    writeLocalForumPosts([
      createdPost,
      ...storedPosts.filter((post) => post.id !== createdPost.id),
    ]);
    setPosts((prev) =>
      sortForumPosts(
        mergeSocialItems([createdPost], prev, (post) => post.id),
        sortBy,
      ),
    );
    setNewPostTitle('');
    setNewPostContent('');
    setNewPostTags('');
    setIsSubmittingPost(false);
    navigate(`/word-on-the-street/post/${createdPost.id}`);
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    const applyLike = () => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                is_liked: !isLiked,
                like_count: Math.max(0, isLiked ? p.like_count - 1 : p.like_count + 1),
              }
            : p,
        ),
      );
      const storedPosts = readLocalForumPosts();
      if (storedPosts.some((post) => post.id === postId)) {
        writeLocalForumPosts(
          storedPosts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  is_liked: !isLiked,
                  like_count: Math.max(0, isLiked ? post.like_count - 1 : post.like_count + 1),
                }
              : post,
          ),
        );
      }
    };

    try {
      const method = isLiked ? 'DELETE' : 'POST';
      const resp = await fetch(`${SB_API_BASE}/forum/posts/${postId}/like?user_id=${userId}`, {
        method,
      });
      if (!resp.ok && !postId.startsWith('local-post-')) {
        console.info('Forum like API returned a non-OK response; applying local feedback.');
      }
    } catch (error) {
      console.info('Forum like API was unavailable; applying local feedback.', error);
    }
    applyLike();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  // Helper: show a readable name, not a UUID
  const displayAuthorName = (name: string | null) => {
    if (!name) return 'Unknown';
    // If the name looks like a UUID, show "Community Member" instead
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name)) {
      return 'Community Member';
    }
    return name;
  };

  const visiblePosts = focusedPostId
    ? [...posts].sort((a, b) => {
        if (a.id === focusedPostId) return -1;
        if (b.id === focusedPostId) return 1;
        return 0;
      })
    : posts;
  const focusedPost = focusedPostId ? posts.find((post) => post.id === focusedPostId) : null;
  const sortOptions = [
    { key: 'last_activity_at' as const, icon: <TrendingUp size={16} />, label: 'Active' },
    { key: 'created_at' as const, icon: <Clock size={16} />, label: 'New' },
    { key: 'like_count' as const, icon: <Heart size={16} />, label: 'Popular' },
  ];
  const selectedCategoryLabel = selectedCategory
    ? (categories.find((category) => category.slug === selectedCategory)?.name ?? 'Category')
    : 'All posts';
  const selectedSortLabel = sortOptions.find((option) => option.key === sortBy)?.label ?? 'Active';
  const mainNavLinks = [
    { label: 'Street Profile', to: '/profiles' },
    { label: 'Street Gallery', to: '/gallery' },
    { label: 'Academy', to: '/academy' },
    { label: 'Job Board', to: '/jobs' },
    { label: 'Directory', to: '/directory' },
    { label: 'News', to: '/news' },
  ];
  const feedCategoryPills = [
    { slug: null, label: 'All Posts', icon: <Grid3X3 size={15} /> },
    { slug: 'success-stories', label: 'Success Stories', icon: <Trophy size={15} /> },
    {
      slug: 'creative-collaborations',
      label: 'Creative Collaborations',
      icon: <Lightbulb size={15} />,
    },
    { slug: 'rights-advocacy', label: 'Rights & Advocacy', icon: <Scale size={15} /> },
    { slug: 'off-topic', label: 'Off Topic', icon: <MessageCircle size={15} /> },
  ];

  const getPostAuthorProfile = (post: Post) =>
    post.author_id ? authorProfiles[post.author_id] : undefined;

  const getPostAuthorName = (post: Post) => {
    if (post.is_anonymous) return post.anonymous_name || 'Anonymous';
    return getPostAuthorProfile(post)?.display_name || displayAuthorName(post.author_name);
  };

  const renderFeedAvatar = (post: Post, size = 44) => {
    const profile = getPostAuthorProfile(post);
    const name = getPostAuthorName(post);
    const initial = name.charAt(0) || '?';
    const avatar = profile?.avatar_url;

    const avatarNode = avatar ? (
      <img
        src={avatar}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: `1px solid ${colors.border}`,
          boxShadow: '0 10px 24px rgba(0,0,0,0.28)',
          display: 'block',
        }}
      />
    ) : (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: isDark
            ? 'linear-gradient(135deg, rgba(255,214,0,0.92), rgba(255,166,0,0.72))'
            : 'linear-gradient(135deg, rgba(255,214,0,0.96), rgba(255,180,0,0.78))',
          border: `1px solid ${colors.border}`,
          boxShadow: '0 10px 24px rgba(0,0,0,0.28)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#050505',
          fontWeight: 900,
          fontSize: Math.max(13, Math.round(size * 0.34)),
        }}
      >
        {initial}
      </div>
    );

    if (!profile?.username || post.is_anonymous) return avatarNode;

    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          navigate(`/profiles/${profile.username}`);
        }}
        style={{
          border: 'none',
          background: 'transparent',
          padding: 0,
          cursor: 'pointer',
          flexShrink: 0,
        }}
        aria-label={`Open ${name}'s profile`}
      >
        {avatarNode}
      </button>
    );
  };

  const renderFeedMediaPreview = (post: Post, mode: 'featured' | 'compact') => {
    const media = post.media?.[0];
    if (!media) return null;

    const isFeatured = mode === 'featured';
    const openVideo = (event: React.MouseEvent | React.KeyboardEvent) => {
      if (media.type !== 'video' || !media.videoSrc) return;
      event.stopPropagation();
      setActiveVideo({
        src: media.videoSrc,
        poster: media.url,
        title: media.title || post.title,
        caption: media.caption,
      });
    };

    return (
      <div
        role={media.type === 'video' ? 'button' : undefined}
        tabIndex={media.type === 'video' ? 0 : undefined}
        onClick={media.type === 'video' ? openVideo : undefined}
        onKeyDown={
          media.type === 'video'
            ? (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                openVideo(event);
              }
            : undefined
        }
        style={{
          position: 'relative',
          width: '100%',
          minHeight: isMobile ? 220 : isFeatured ? 420 : 340,
          aspectRatio: '16 / 9',
          borderRadius: 14,
          overflow: 'hidden',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,39,0.12)'}`,
          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
          cursor: media.type === 'video' ? 'pointer' : 'default',
        }}
      >
        {media.type === 'meme' ? (
          <div
            aria-label={media.caption || 'Community meme'}
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: isFeatured ? 22 : 14,
              boxSizing: 'border-box',
              background:
                'linear-gradient(135deg, rgba(255,214,0,0.94), rgba(22,25,42,0.96) 52%, rgba(78,64,70,0.92))',
              color: '#fff',
              fontFamily: 'Impact, Rubik, sans-serif',
              textAlign: 'center',
              textTransform: 'uppercase',
              textShadow: '0 3px 0 rgba(0,0,0,0.54)',
              fontSize: isFeatured ? '1.8rem' : '1.05rem',
              lineHeight: 1.04,
              letterSpacing: 0,
            }}
          >
            <span>{media.topText}</span>
            <span>{media.bottomText}</span>
          </div>
        ) : (
          <img
            src={media.url}
            alt={media.alt || media.title || post.title}
            loading="lazy"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              filter: media.type === 'video' ? 'saturate(0.8) contrast(1.08)' : undefined,
            }}
          />
        )}

        {media.type === 'video' && (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.66))',
              }}
            />
            <span
              style={{
                position: 'absolute',
                inset: 0,
                margin: 'auto',
                width: isFeatured ? 58 : 42,
                height: isFeatured ? 58 : 42,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.92)',
                color: '#0f172a',
                boxShadow: '0 14px 36px rgba(0,0,0,0.34)',
              }}
            >
              <Play size={isFeatured ? 28 : 20} fill="currentColor" />
            </span>
            <div
              style={{
                position: 'absolute',
                left: 12,
                right: 12,
                bottom: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#fff',
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 8px',
                  borderRadius: 999,
                  background: 'rgba(0,0,0,0.58)',
                }}
              >
                <Film size={12} /> Reel
              </span>
              {media.duration && (
                <span
                  style={{
                    padding: '5px 8px',
                    borderRadius: 999,
                    background: 'rgba(0,0,0,0.58)',
                  }}
                >
                  {media.duration}
                </span>
              )}
            </div>
          </>
        )}

        {post.media && post.media.length > 1 && media.type !== 'video' && (
          <span
            style={{
              position: 'absolute',
              right: 8,
              bottom: 8,
              padding: '5px 8px',
              borderRadius: 999,
              background: 'rgba(0,0,0,0.58)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            +{post.media.length - 1}
          </span>
        )}
      </div>
    );
  };

  const renderFeedPostCard = (post: Post, index: number) => {
    const isFeaturedPost = index === 0;
    const profile = getPostAuthorProfile(post);
    const authorName = getPostAuthorName(post);
    const mediaPreview = renderFeedMediaPreview(post, isFeaturedPost ? 'featured' : 'compact');

    return (
      <article
        key={post.id}
        onClick={() => navigate(`/word-on-the-street/post/${post.id}`)}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: isFeaturedPost ? 14 : 12,
          padding: isMobile ? 12 : isFeaturedPost ? 14 : 12,
          borderRadius: 16,
          border: isFeaturedPost ? '1px solid rgba(255,214,0,0.56)' : `1px solid ${colors.border}`,
          background: isFeaturedPost
            ? 'linear-gradient(135deg, rgba(39,38,52,0.88), rgba(58,50,62,0.72), rgba(17,20,31,0.88))'
            : isDark
              ? 'linear-gradient(135deg, rgba(34,35,49,0.76), rgba(45,39,52,0.66))'
              : 'rgba(255,255,255,0.74)',
          boxShadow: isFeaturedPost
            ? '0 0 0 1px rgba(255,214,0,0.14), 0 20px 46px rgba(0,0,0,0.28)'
            : colors.glassShadow,
          cursor: 'pointer',
          overflow: 'hidden',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 14,
              marginBottom: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {renderFeedAvatar(post, isFeaturedPost ? 44 : 42)}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                    color: colors.textSecondary,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <span style={{ color: colors.text, fontWeight: 900 }}>{authorName}</span>
                  {profile?.is_verified && (
                    <span style={{ color: colors.accent, fontSize: 13 }}>●</span>
                  )}
                  <span>·</span>
                  <span>{formatTime(post.last_activity_at)}</span>
                  {post.related_group_name && (
                    <>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/groups/${post.related_group_id}`);
                        }}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: colors.accent,
                          fontWeight: 900,
                          cursor: 'pointer',
                          padding: 0,
                          fontFamily: 'inherit',
                        }}
                      >
                        {post.related_group_name}
                      </button>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {post.is_featured && (
                    <span
                      style={{
                        ...glassTag,
                        color: '#10B981',
                        background: 'rgba(16,185,129,0.16)',
                        borderColor: 'rgba(16,185,129,0.2)',
                        fontWeight: 900,
                      }}
                    >
                      <Star size={12} /> Featured
                    </span>
                  )}
                  {post.category_name && (
                    <span
                      style={{
                        ...glassTag,
                        color: colors.accent,
                        background: 'rgba(255,214,0,0.14)',
                        borderColor: 'rgba(255,214,0,0.24)',
                        fontWeight: 800,
                      }}
                    >
                      {post.category_name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: colors.textSecondary,
              }}
            >
              <Bookmark size={18} />
              <MoreHorizontal size={20} />
            </div>
          </div>

          <h3
            style={{
              margin: '0 0 7px',
              color: colors.text,
              fontSize: isFeaturedPost ? '1.12rem' : '1.05rem',
              lineHeight: 1.25,
              fontWeight: 900,
            }}
          >
            {post.title}
          </h3>
          <p
            style={{
              margin: '0 0 10px',
              color: colors.textSecondary,
              fontSize: 14,
              lineHeight: 1.48,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {post.content_preview}
          </p>

          {post.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {post.tags.slice(0, 3).map((tag) => (
                <span key={tag} style={{ color: '#A855F7', fontSize: 13, fontWeight: 900 }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {mediaPreview && (
            <div style={{ margin: post.tags.length > 0 ? '0 0 12px' : '10px 0 12px' }}>
              {mediaPreview}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? 16 : 28,
              color: colors.textSecondary,
              fontSize: 13,
              fontWeight: 700,
              marginTop: isFeaturedPost ? 4 : 12,
            }}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleLike(post.id, post.is_liked);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                border: 'none',
                background: 'transparent',
                color: post.is_liked ? '#ff386e' : '#ff4d7f',
                padding: 0,
                cursor: 'pointer',
                fontWeight: 800,
                fontFamily: 'inherit',
              }}
            >
              <Heart size={17} fill={post.is_liked ? 'currentColor' : 'none'} />
              {post.like_count}
            </button>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <MessageSquare size={17} /> {post.reply_count}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Eye size={17} /> {post.view_count}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Repeat2 size={17} /> {Math.max(4, Math.round(post.reply_count * 0.66))}
            </span>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div>
      <style>{`
        .word-street-category-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .word-street-category-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .word-street-category-scroll::-webkit-scrollbar-thumb {
          background: ${isDark ? 'rgba(255,255,255,0.24)' : 'rgba(17,24,39,0.24)'};
          border-radius: 999px;
        }
        .word-street-category-scroll::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? 'rgba(255,255,255,0.36)' : 'rgba(17,24,39,0.36)'};
        }
        .word-street-feed-sidebar::-webkit-scrollbar {
          width: 6px;
        }
        .word-street-feed-sidebar::-webkit-scrollbar-track {
          background: transparent;
        }
        .word-street-feed-sidebar::-webkit-scrollbar-thumb {
          background: ${isDark ? 'rgba(255,255,255,0.24)' : 'rgba(17,24,39,0.24)'};
          border-radius: 999px;
        }
        .word-street-feed-sidebar::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? 'rgba(255,255,255,0.36)' : 'rgba(17,24,39,0.36)'};
        }
      `}</style>
      {/* GLASSMORPHISM Background - Vivid colors that show through glass */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: colors.bg,
        }}
      />
      <GlassBackground />

      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          ...getSeamlessNavBarStyle(isDark, isTopNavScrolled),
          padding: isMobile ? '58px 14px 10px' : '8px clamp(160px, 16.45vw, 220px)',
          boxSizing: 'border-box',
        }}
      >
        <nav
          aria-label="Word On The Street navigation, search, and filters"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMobile ? 'center' : 'flex-start',
            gap: isMobile ? 8 : 4,
            height: isMobile ? 'auto' : 48,
            maxWidth: '859px',
            width: isMobile ? '100%' : 'min(859px, calc(100vw - 320px))',
            margin: '0 auto',
            overflow: 'visible',
            whiteSpace: 'nowrap',
            position: 'relative',
          }}
        >
          {!isMobile && !isCompactDesktopNav && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 4,
                minWidth: 0,
                flexShrink: 0,
              }}
            >
              {mainNavLinks.map((item) => {
                const isActive =
                  item.label === 'Street Profile'
                    ? isStreetProfileNavActive(location.pathname)
                    : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

                if (item.label === 'Street Profile') {
                  return (
                    <NavDropdown
                      key={item.to}
                      label={item.label}
                      href={item.to}
                      items={STREET_PROFILE_NAV_ITEMS}
                      textColor={
                        isActive ? (isDark ? '#FFD600' : '#111827') : isDark ? '#E6E7F2' : '#1f2937'
                      }
                      fontSize={14}
                      buttonStyle={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        fontWeight: isActive ? 900 : 700,
                        lineHeight: 1.25,
                      }}
                      menuMinWidth={170}
                    />
                  );
                }

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    style={{
                      color: isActive
                        ? isDark
                          ? '#FFD600'
                          : '#111827'
                        : isDark
                          ? '#E6E7F2'
                          : '#1f2937',
                      fontFamily: 'Rubik, sans-serif',
                      fontSize: 14,
                      fontWeight: isActive ? 900 : 700,
                      lineHeight: 1.25,
                      textDecoration: 'none',
                      padding: '8px 12px',
                      borderRadius: 8,
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}

          {!isMobile && (
            <form
              role="search"
              aria-label="Search Word On The Street posts"
              onSubmit={(event) => event.preventDefault()}
              style={{
                flex: '0 0 clamp(260px, calc(50vw - 386px), 372px)',
                minWidth: 260,
                maxWidth: 372,
                height: 41,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '4px 4px 4px 14px',
                borderRadius: 999,
                border: isDark
                  ? '1px solid rgba(255,255,255,0.16)'
                  : '1px solid rgba(17,24,39,0.12)',
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)',
                boxShadow: isDark
                  ? '0 8px 24px rgba(0,0,0,0.16)'
                  : '0 8px 20px rgba(17,24,39,0.08)',
                backdropFilter: 'blur(18px) saturate(160%)',
                WebkitBackdropFilter: 'blur(18px) saturate(160%)',
                boxSizing: 'border-box',
                transform: 'translateY(-1px)',
              }}
            >
              <Search size={17} color={isDark ? 'rgba(230,231,242,0.64)' : 'rgba(31,41,55,0.56)'} />
              <input
                type="search"
                placeholder="Search posts, people, topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: isDark ? '#fff' : '#111827',
                  fontSize: 14,
                  fontFamily: 'Rubik, sans-serif',
                }}
              />
              <button
                type="submit"
                style={{
                  height: '100%',
                  minWidth: 86,
                  padding: '0 12px',
                  border: 'none',
                  borderRadius: 30,
                  background: '#FFD600',
                  color: '#000',
                  fontFamily: 'inherit',
                  fontSize: 'var(--sv-search-bar-font-size)',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  flexShrink: 0,
                  position: 'relative',
                  zIndex: 1,
                  boxShadow: '0 7px 16px rgba(0,0,0,0.20)',
                }}
              >
                Search
              </button>
            </form>
          )}
        </nav>
      </div>

      <div
        style={{
          padding: isMobile ? '118px 0 20px' : isFeedRoute ? '92px 0 28px' : '82px 0 20px',
          minHeight: '100vh',
          color: colors.text,
          position: 'relative',
          zIndex: 1,
          overflowX: 'clip',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: isFeedRoute ? 1600 : 'none',
            margin: isFeedRoute ? '0 auto' : 0,
            padding: isMobile ? '0 12px' : isFeedRoute ? '0 28px' : '0 48px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile || isFeedRoute ? '1fr' : '320px minmax(0, 900px)',
              gap: isMobile ? 18 : isFeedRoute ? 0 : 72,
              alignItems: 'start',
              justifyContent: isMobile ? 'stretch' : 'center',
            }}
          >
            <div
              style={{
                minWidth: 0,
                width: isMobile ? 'auto' : 320,
                display: isFeedRoute ? 'none' : undefined,
              }}
            >
              <aside
                style={{
                  position: isMobile ? 'relative' : 'fixed',
                  top: isMobile ? undefined : 82,
                  left: isMobile ? undefined : 'max(24px, calc(50vw - 720px))',
                  width: isMobile ? undefined : 320,
                  overflowY: 'visible',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  minWidth: 0,
                }}
              >
                <h1
                  style={{
                    margin: 0,
                    color: colors.text,
                    fontFamily: 'Rubik, sans-serif',
                    fontSize: isMobile ? '1.35rem' : '1.55rem',
                    fontWeight: 800,
                    lineHeight: 1.2,
                  }}
                >
                  Word On The Street
                </h1>

                {!isMobile && (
                  <button
                    onClick={() => navigate('/word-on-the-street/new')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      width: 142,
                      height: 42,
                      padding: '0 14px',
                      borderRadius: '999px',
                      background: colors.accent,
                      color: '#000',
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(255, 214, 0, 0.36)',
                      fontFamily: 'Rubik, sans-serif',
                      fontSize: 14,
                      whiteSpace: 'nowrap',
                      boxSizing: 'border-box',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 18px rgba(255, 214, 0, 0.46)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(255, 214, 0, 0.36)';
                    }}
                  >
                    <Plus size={16} strokeWidth={2.5} />
                    Submit Post
                  </button>
                )}

                {isMobile && (
                  <div
                    style={{
                      ...glassSurface,
                      height: 56,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '0 18px',
                      borderRadius: 18,
                      boxSizing: 'border-box',
                    }}
                  >
                    <Search size={20} color={colors.textSecondary} />
                    <input
                      type="text"
                      placeholder="Search posts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        height: '100%',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: colors.text,
                        fontSize: '1rem',
                        fontFamily: 'Rubik, sans-serif',
                      }}
                    />
                  </div>
                )}

                <div
                  style={{
                    ...glassCard,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    maxHeight: isMobile ? undefined : 'calc(100vh - 220px)',
                    overflow: 'hidden',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        color: colors.textSecondary,
                        fontSize: 12,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: 10,
                      }}
                    >
                      <Filter size={14} />
                      Filters
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {sortOptions.map(({ key, icon, label }) => (
                        <button
                          key={key}
                          onClick={() => setSortBy(key)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '9px 12px',
                            borderRadius: 999,
                            background: sortBy === key ? colors.accent : colors.cardBg,
                            color: sortBy === key ? '#000' : colors.text,
                            border: `1px solid ${sortBy === key ? colors.accent : colors.border}`,
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: sortBy === key ? 800 : 600,
                          }}
                        >
                          {icon}
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <div
                      style={{
                        color: colors.textSecondary,
                        fontSize: 12,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: 10,
                      }}
                    >
                      Categories
                    </div>
                    <div
                      className="word-street-category-scroll"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        overflowY: 'auto',
                        paddingRight: 4,
                        maxHeight: isMobile ? undefined : 'calc(100vh - 430px)',
                        scrollbarWidth: 'thin',
                        scrollbarColor: `${isDark ? 'rgba(255,255,255,0.28)' : 'rgba(17,24,39,0.28)'} transparent`,
                      }}
                    >
                      <button
                        onClick={() => setSelectedCategory(null)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 12px',
                          borderRadius: 12,
                          background: !selectedCategory ? 'rgba(255, 214, 0, 0.16)' : colors.cardBg,
                          color: !selectedCategory ? accentTextColor : colors.text,
                          border: `1px solid ${!selectedCategory ? colors.accent : colors.border}`,
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontWeight: !selectedCategory ? 800 : 600,
                        }}
                      >
                        <MessageSquare size={16} />
                        <span style={{ flex: 1 }}>All posts</span>
                      </button>
                      {categories.map((category) => (
                        <button
                          key={category.id}
                          onClick={() => setSelectedCategory(category.slug)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 12px',
                            borderRadius: 12,
                            background:
                              selectedCategory === category.slug
                                ? `${category.color}20`
                                : colors.cardBg,
                            color:
                              selectedCategory === category.slug
                                ? isDark
                                  ? category.color
                                  : '#111827'
                                : colors.text,
                            border: `1px solid ${
                              selectedCategory === category.slug ? category.color : colors.border
                            }`,
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontWeight: selectedCategory === category.slug ? 800 : 600,
                          }}
                        >
                          <span
                            style={{
                              color:
                                selectedCategory === category.slug && !isDark
                                  ? '#111827'
                                  : category.color,
                              display: 'inline-flex',
                            }}
                          >
                            {CATEGORY_ICONS[category.icon || 'chat'] || <MessageCircle size={16} />}
                          </span>
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {category.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      borderTop: `1px solid ${colors.border}`,
                      paddingTop: 12,
                    }}
                  >
                    <span style={{ color: colors.textSecondary, fontSize: 12 }}>
                      {selectedCategoryLabel} · {selectedSortLabel}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedCategory(null);
                        setSortBy('last_activity_at');
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: accentTextColor,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {isMobile && (
                  <button
                    onClick={() => navigate('/word-on-the-street/new')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px 24px',
                      borderRadius: '999px',
                      background: colors.accent,
                      color: '#000',
                      fontWeight: 'bold',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(255, 214, 0, 0.4)',
                    }}
                  >
                    <Plus size={20} /> New Post
                  </button>
                )}
              </aside>
            </div>

            <main style={{ minWidth: 0, marginTop: isMobile || isFeedRoute ? 0 : 44 }}>
              {/* Posts List with Glassmorphism */}
              {isFeedRoute ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                  <header
                    style={{
                      position: isMobile ? 'relative' : 'sticky',
                      top: isMobile ? undefined : 64,
                      zIndex: 12,
                      display: 'flex',
                      alignItems: isMobile ? 'flex-start' : 'center',
                      justifyContent: 'space-between',
                      gap: 18,
                      flexDirection: isMobile ? 'column' : 'row',
                      padding: isMobile ? 0 : '10px 0 12px',
                      margin: isMobile ? 0 : '-10px 0 0',
                      background: isDark
                        ? 'linear-gradient(180deg, rgba(16,19,29,0.96) 0%, rgba(16,19,29,0.84) 70%, rgba(16,19,29,0) 100%)'
                        : 'linear-gradient(180deg, rgba(247,247,251,0.96) 0%, rgba(247,247,251,0.84) 70%, rgba(247,247,251,0) 100%)',
                      backdropFilter: isMobile ? undefined : 'blur(16px) saturate(150%)',
                      WebkitBackdropFilter: isMobile ? undefined : 'blur(16px) saturate(150%)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
                      <div
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: colors.accent,
                          background:
                            'linear-gradient(135deg, rgba(255,214,0,0.18), rgba(49,48,63,0.74))',
                          border: '1px solid rgba(255,214,0,0.34)',
                          boxShadow: '0 0 32px rgba(255,214,0,0.14)',
                          flexShrink: 0,
                        }}
                      >
                        <MessageCircle size={30} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h1
                          style={{
                            margin: 0,
                            color: colors.text,
                            fontFamily: 'Rubik, sans-serif',
                            fontSize: isMobile ? '1.8rem' : '2rem',
                            lineHeight: 1.05,
                            fontWeight: 900,
                          }}
                        >
                          Word On The Street
                        </h1>
                        <p
                          style={{
                            margin: '8px 0 0',
                            color: colors.textSecondary,
                            fontSize: isMobile ? 14 : 15,
                            lineHeight: 1.4,
                            fontWeight: 600,
                          }}
                        >
                          Real conversations. Community updates. Stories that inspire.
                          Collaborations that create change.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate('/word-on-the-street/new')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        minWidth: isMobile ? '100%' : undefined,
                        width: isMobile ? '100%' : 142,
                        height: 42,
                        padding: '0 14px',
                        borderRadius: 999,
                        background: colors.accent,
                        color: '#050505',
                        border: 'none',
                        boxShadow: '0 4px 14px rgba(255,214,0,0.36)',
                        fontFamily: 'Rubik, sans-serif',
                        fontWeight: 800,
                        fontSize: 14,
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Plus size={16} strokeWidth={2.5} />
                      Submit Post
                    </button>
                  </header>

                  <section
                    style={{
                      borderRadius: 18,
                      border: `1px solid ${colors.border}`,
                      background: isDark
                        ? 'linear-gradient(135deg, rgba(39,38,52,0.72), rgba(52,45,62,0.58))'
                        : 'rgba(255,255,255,0.68)',
                      boxShadow: colors.glassShadow,
                      backdropFilter: 'blur(26px) saturate(170%)',
                      WebkitBackdropFilter: 'blur(26px) saturate(170%)',
                      padding: isMobile ? 12 : 16,
                      overflow: 'visible',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile
                          ? '1fr'
                          : 'minmax(252px, 292px) minmax(0, 1fr)',
                        gap: isMobile ? 14 : 18,
                        alignItems: 'start',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        {loading ? (
                          <div
                            style={{
                              ...glassCard,
                              padding: 60,
                              textAlign: 'center',
                              color: colors.textSecondary,
                            }}
                          >
                            Loading posts...
                          </div>
                        ) : visiblePosts.length === 0 ? (
                          <div
                            style={{
                              ...glassCard,
                              padding: 60,
                              textAlign: 'center',
                              color: colors.textSecondary,
                            }}
                          >
                            <MessageSquare size={48} style={{ marginBottom: 16 }} />
                            <p style={{ margin: 0 }}>No posts match this feed yet.</p>
                            <button
                              onClick={() => {
                                setSelectedCategory(null);
                                setSearchQuery('');
                              }}
                              style={{
                                marginTop: 16,
                                border: 'none',
                                borderRadius: 999,
                                padding: '12px 20px',
                                background: colors.accent,
                                color: '#000',
                                fontWeight: 900,
                                cursor: 'pointer',
                              }}
                            >
                              Reset feed
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {visiblePosts.map(renderFeedPostCard)}
                          </div>
                        )}
                      </div>

                      <aside
                        data-testid="word-feed-sidebar"
                        aria-label="Word On The Street feed navigation"
                        className="word-street-feed-sidebar"
                        style={{
                          position: isMobile ? 'relative' : 'sticky',
                          top: isMobile ? undefined : 90,
                          order: -1,
                          alignSelf: 'start',
                          zIndex: 10,
                          borderRadius: 16,
                          border: `1px solid ${colors.border}`,
                          background: isDark
                            ? 'linear-gradient(180deg, rgba(35,34,48,0.82), rgba(49,43,58,0.64))'
                            : 'rgba(255,255,255,0.78)',
                          boxShadow: colors.glassShadow,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 14,
                          maxHeight: isMobile ? undefined : 'calc(100dvh - 114px)',
                          overflowY: isMobile ? 'visible' : 'auto',
                          overscrollBehavior: 'contain',
                          scrollbarWidth: 'thin',
                          scrollbarColor: `${isDark ? 'rgba(255,255,255,0.28)' : 'rgba(17,24,39,0.28)'} transparent`,
                        }}
                      >
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 9,
                            height: 38,
                            width: '100%',
                            padding: '0 12px',
                            borderRadius: 999,
                            border: `1px solid ${colors.border}`,
                            background: isDark
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(255,255,255,0.72)',
                            color: colors.textSecondary,
                            boxSizing: 'border-box',
                          }}
                        >
                          <Search size={15} />
                          <input
                            type="search"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search in feed..."
                            style={{
                              minWidth: 0,
                              width: '100%',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              color: colors.text,
                              fontFamily: 'Rubik, sans-serif',
                              fontWeight: 700,
                            }}
                          />
                        </label>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px', gap: 8 }}>
                          <select
                            value={sortBy}
                            onChange={(event) => setSortBy(event.target.value as PostSort)}
                            aria-label="Sort Word On The Street posts"
                            style={{
                              height: 38,
                              width: '100%',
                              padding: '0 22px 0 12px',
                              borderRadius: 12,
                              border: `1px solid ${colors.border}`,
                              background: isDark
                                ? 'rgba(255,255,255,0.07)'
                                : 'rgba(255,255,255,0.72)',
                              color: colors.text,
                              fontFamily: 'Rubik, sans-serif',
                              fontWeight: 800,
                              fontSize: 12,
                              outline: 'none',
                            }}
                          >
                            <option value="last_activity_at">Most Recent</option>
                            <option value="created_at">Latest</option>
                            <option value="like_count">Most Popular</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategory(null);
                              setSearchQuery('');
                              setSortBy('last_activity_at');
                            }}
                            aria-label="Reset feed filters"
                            style={{
                              width: 40,
                              height: 38,
                              borderRadius: 12,
                              border: `1px solid ${colors.border}`,
                              background: isDark
                                ? 'rgba(255,255,255,0.06)'
                                : 'rgba(255,255,255,0.72)',
                              color: colors.textSecondary,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <SlidersHorizontal size={17} />
                          </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {[
                            {
                              label: 'For You',
                              icon: <Star size={15} />,
                              sort: 'last_activity_at' as const,
                            },
                            {
                              label: 'Latest',
                              icon: <Clock size={15} />,
                              sort: 'created_at' as const,
                            },
                            {
                              label: 'Popular',
                              icon: <Flame size={15} />,
                              sort: 'like_count' as const,
                            },
                            {
                              label: 'Following',
                              icon: <Users size={15} />,
                              sort: 'last_activity_at' as const,
                            },
                          ].map((tab) => {
                            const isActive =
                              (tab.label === 'For You' && sortBy === 'last_activity_at') ||
                              (tab.label === 'Latest' && sortBy === 'created_at') ||
                              (tab.label === 'Popular' && sortBy === 'like_count');
                            return (
                              <button
                                key={tab.label}
                                type="button"
                                onClick={() => setSortBy(tab.sort)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 9,
                                  height: 38,
                                  width: '100%',
                                  padding: '0 12px',
                                  borderRadius: 12,
                                  border: `1px solid ${isActive ? colors.borderActive : colors.border}`,
                                  background: isActive
                                    ? 'rgba(255,214,0,0.16)'
                                    : isDark
                                      ? 'rgba(255,255,255,0.05)'
                                      : 'rgba(255,255,255,0.66)',
                                  color: isActive ? colors.accent : colors.textSecondary,
                                  fontWeight: 800,
                                  fontSize: 12,
                                  fontFamily: 'Rubik, sans-serif',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                              >
                                {tab.icon}
                                {tab.label}
                              </button>
                            );
                          })}
                        </div>

                        <div
                          style={{
                            height: 1,
                            background: colors.border,
                          }}
                        />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {feedCategoryPills.map((pill) => {
                            const isActive =
                              pill.slug === selectedCategory || (!pill.slug && !selectedCategory);
                            return (
                              <button
                                key={pill.label}
                                type="button"
                                onClick={() => setSelectedCategory(pill.slug)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 9,
                                  height: 38,
                                  width: '100%',
                                  padding: '0 12px',
                                  borderRadius: 999,
                                  border: `1px solid ${isActive ? colors.accent : colors.border}`,
                                  background: isActive
                                    ? 'rgba(255,214,0,0.12)'
                                    : isDark
                                      ? 'rgba(255,255,255,0.045)'
                                      : 'rgba(255,255,255,0.66)',
                                  color: isActive ? colors.accent : colors.textSecondary,
                                  fontWeight: 800,
                                  fontSize: 12,
                                  fontFamily: 'Rubik, sans-serif',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                              >
                                {pill.icon}
                                {pill.label}
                              </button>
                            );
                          })}
                        </div>
                      </aside>
                    </div>
                  </section>
                </div>
              ) : isComposerRoute ? (
                <form
                  onSubmit={handleCreatePost}
                  style={{
                    ...glassCard,
                    padding: isMobile ? '20px' : '28px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '18px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => navigate('/word-on-the-street')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      alignSelf: 'flex-start',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '12px',
                      background: colors.cardBg,
                      color: colors.text,
                      padding: '10px 14px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    <ArrowLeft size={16} /> Back to Word On The Street
                  </button>

                  <div>
                    <h2 style={{ margin: '0 0 8px 0', color: colors.text, fontSize: '1.8rem' }}>
                      Create a new post
                    </h2>
                    <p style={{ margin: 0, color: colors.textSecondary }}>
                      Share a question, story, opportunity, or update with the Street Voices
                      community.
                    </p>
                  </div>

                  {newPostError && (
                    <div
                      role="alert"
                      style={{
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        background: 'rgba(239, 68, 68, 0.12)',
                        color: isDark ? '#fecaca' : '#991b1b',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        fontWeight: 600,
                      }}
                    >
                      {newPostError}
                    </div>
                  )}

                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      color: colors.text,
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>Title</span>
                    <input
                      value={newPostTitle}
                      onChange={(event) => setNewPostTitle(event.target.value)}
                      placeholder="What do you want to talk about?"
                      style={{
                        ...glassSurface,
                        borderRadius: '14px',
                        padding: '14px 16px',
                        color: colors.text,
                        fontSize: '1rem',
                        outline: 'none',
                      }}
                    />
                  </label>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                      gap: '14px',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        color: colors.text,
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>Category</span>
                      <select
                        value={newPostCategory}
                        onChange={(event) => setNewPostCategory(event.target.value)}
                        style={{
                          ...glassSurface,
                          borderRadius: '14px',
                          padding: '14px 16px',
                          color: colors.text,
                          fontSize: '1rem',
                          outline: 'none',
                        }}
                      >
                        {categories.map((category) => (
                          <option key={category.slug} value={category.slug}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        color: colors.text,
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>Post type</span>
                      <select
                        value={newPostType}
                        onChange={(event) =>
                          setNewPostType(event.target.value as keyof typeof POST_TYPE_LABELS)
                        }
                        style={{
                          ...glassSurface,
                          borderRadius: '14px',
                          padding: '14px 16px',
                          color: colors.text,
                          fontSize: '1rem',
                          outline: 'none',
                        }}
                      >
                        {Object.entries(POST_TYPE_LABELS).map(([key, value]) => (
                          <option key={key} value={key}>
                            {value.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      color: colors.text,
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>Post</span>
                    <textarea
                      value={newPostContent}
                      onChange={(event) => setNewPostContent(event.target.value)}
                      placeholder="Write the full post here..."
                      rows={8}
                      style={{
                        ...glassSurface,
                        borderRadius: '14px',
                        padding: '14px 16px',
                        color: colors.text,
                        fontSize: '1rem',
                        lineHeight: 1.6,
                        outline: 'none',
                        resize: 'vertical',
                        minHeight: '180px',
                        fontFamily: 'inherit',
                      }}
                    />
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      color: colors.text,
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>Tags</span>
                    <input
                      value={newPostTags}
                      onChange={(event) => setNewPostTags(event.target.value)}
                      placeholder="documentary, collaboration, portfolio"
                      style={{
                        ...glassSurface,
                        borderRadius: '14px',
                        padding: '14px 16px',
                        color: colors.text,
                        fontSize: '1rem',
                        outline: 'none',
                      }}
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmittingPost}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      alignSelf: 'flex-start',
                      border: 'none',
                      borderRadius: '999px',
                      background: colors.accent,
                      color: '#000',
                      padding: '13px 24px',
                      cursor: isSubmittingPost ? 'wait' : 'pointer',
                      fontWeight: 800,
                      boxShadow: '0 4px 14px rgba(255, 214, 0, 0.4)',
                      opacity: isSubmittingPost ? 0.7 : 1,
                    }}
                  >
                    <Send size={18} /> {isSubmittingPost ? 'Publishing...' : 'Publish Post'}
                  </button>
                </form>
              ) : focusedPostId ? (
                <article
                  style={{
                    ...glassCard,
                    padding: isMobile ? '20px' : '28px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '18px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => navigate('/word-on-the-street')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      alignSelf: 'flex-start',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '12px',
                      background: colors.cardBg,
                      color: colors.text,
                      padding: '10px 14px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    <ArrowLeft size={16} /> Back to Word On The Street
                  </button>

                  {loading ? (
                    <p style={{ color: colors.textSecondary, margin: 0 }}>Loading post...</p>
                  ) : focusedPost ? (
                    <>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            background: `${POST_TYPE_LABELS[focusedPost.post_type]?.color || '#6366F1'}20`,
                            color: POST_TYPE_LABELS[focusedPost.post_type]?.color || '#6366F1',
                            fontWeight: 700,
                          }}
                        >
                          {POST_TYPE_LABELS[focusedPost.post_type]?.label || focusedPost.post_type}
                        </span>
                        {focusedPost.category_name && (
                          <span style={{ fontSize: '0.9rem', color: colors.textSecondary }}>
                            in {focusedPost.category_name}
                          </span>
                        )}
                        <span style={{ color: colors.textMuted }}>|</span>
                        <span style={{ fontSize: '0.9rem', color: colors.textSecondary }}>
                          {formatTime(focusedPost.last_activity_at)}
                        </span>
                      </div>

                      <h2
                        style={{
                          margin: 0,
                          color: colors.text,
                          fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
                        }}
                      >
                        {focusedPost.title}
                      </h2>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          color: colors.textSecondary,
                        }}
                      >
                        <span style={{ fontWeight: 700, color: colors.text }}>
                          {focusedPost.is_anonymous
                            ? focusedPost.anonymous_name || 'Anonymous'
                            : displayAuthorName(focusedPost.author_name)}
                        </span>
                        {focusedPost.author_username && (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(getProfileMessageHref(focusedPost.author_username))
                            }
                            style={{
                              border: `1px solid ${colors.border}`,
                              borderRadius: '999px',
                              background: 'transparent',
                              color: colors.textSecondary,
                              padding: '6px 10px',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                          >
                            Message author
                          </button>
                        )}
                      </div>

                      <p
                        style={{
                          margin: 0,
                          color: colors.text,
                          lineHeight: 1.75,
                          fontSize: '1rem',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {focusedPost.content_preview}
                      </p>

                      {focusedPost.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {focusedPost.tags.map((tag) => (
                            <span key={tag} style={glassTag}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {(focusedPost.related_group_name || focusedPost.related_channel_id) && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {focusedPost.related_group_name && focusedPost.related_group_id && (
                            <button
                              type="button"
                              onClick={() => navigate(`/groups/${focusedPost.related_group_id}`)}
                              style={{
                                border: `1px solid ${colors.border}`,
                                borderRadius: '999px',
                                background: isDark ? 'rgba(255,214,0,0.1)' : 'rgba(255,214,0,0.18)',
                                color: colors.accent,
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontWeight: 700,
                              }}
                            >
                              Open {focusedPost.related_group_name}
                            </button>
                          )}
                          {focusedPost.related_group_id && focusedPost.related_channel_id && (
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  getGroupMessagesHref({
                                    id: focusedPost.related_group_id!,
                                    channel_id: focusedPost.related_channel_id,
                                  }),
                                )
                              }
                              style={{
                                border: `1px solid ${colors.border}`,
                                borderRadius: '999px',
                                background: colors.cardBg,
                                color: colors.text,
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontWeight: 700,
                              }}
                            >
                              Open Messages
                            </button>
                          )}
                        </div>
                      )}

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          borderTop: `1px solid ${colors.border}`,
                          paddingTop: '16px',
                          color: colors.textSecondary,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleLike(focusedPost.id, focusedPost.is_liked)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            border: 'none',
                            borderRadius: '10px',
                            background: focusedPost.is_liked
                              ? 'rgba(233, 30, 99, 0.15)'
                              : 'transparent',
                            color: focusedPost.is_liked ? '#E91E63' : colors.textSecondary,
                            padding: '8px 10px',
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          <Heart size={16} fill={focusedPost.is_liked ? '#E91E63' : 'none'} />
                          {focusedPost.like_count}
                        </button>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <MessageSquare size={16} /> {focusedPost.reply_count}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Eye size={16} /> {focusedPost.view_count}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: colors.textSecondary }}>
                      <h2 style={{ color: colors.text, margin: '0 0 8px 0' }}>Post not found</h2>
                      <p style={{ margin: 0 }}>
                        This post is not available yet. It may have been removed or never synced
                        from the imported social app.
                      </p>
                    </div>
                  )}
                </article>
              ) : loading ? (
                <div
                  style={{
                    ...glassCard,
                    textAlign: 'center',
                    padding: '60px',
                    color: colors.textSecondary,
                  }}
                >
                  Loading posts...
                </div>
              ) : visiblePosts.length === 0 ? (
                <div
                  style={{
                    ...glassCard,
                    textAlign: 'center',
                    padding: '60px',
                  }}
                >
                  <MessageSquare
                    size={48}
                    color={colors.textSecondary}
                    style={{ marginBottom: 16 }}
                  />
                  <p style={{ color: colors.textSecondary, margin: 0 }}>
                    No posts yet. Be the first to start a conversation!
                  </p>
                  <button
                    onClick={() => navigate('/word-on-the-street/new')}
                    style={{
                      marginTop: '16px',
                      padding: '12px 24px',
                      borderRadius: '999px',
                      background: colors.accent,
                      color: '#000',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(255, 214, 0, 0.4)',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 214, 0, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(255, 214, 0, 0.4)';
                    }}
                  >
                    Create First Post
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {visiblePosts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => navigate(`/word-on-the-street/post/${post.id}`)}
                      style={{
                        background: colors.cardBg,
                        backdropFilter: 'blur(24px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                        border: `1px solid ${colors.border}`,
                        borderRadius: isMobile ? '16px' : '20px',
                        padding: isMobile ? '14px' : '20px',
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        borderLeft: post.is_pinned ? `3px solid ${colors.accent}` : undefined,
                        boxShadow: colors.glassShadow,
                      }}
                      {...cardHoverHandlers}
                    >
                      <div style={{ display: 'flex', gap: '14px' }}>
                        {/* Author Avatar - inline profile badge for non-anonymous posts */}
                        {post.is_anonymous ? (
                          <div
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '50%',
                              background:
                                'linear-gradient(135deg, rgba(99, 102, 241, 0.8), rgba(139, 92, 246, 0.8))',
                              backdropFilter: 'blur(8px)',
                              WebkitBackdropFilter: 'blur(8px)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              fontSize: '1.1rem',
                              fontWeight: 600,
                              color: '#fff',
                              border: `1px solid ${colors.border}`,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                            }}
                          >
                            {post.anonymous_name?.charAt(0) || '?'}
                          </div>
                        ) : post.author_id && authorProfiles[post.author_id] ? (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/profiles/${authorProfiles[post.author_id!].username}`);
                            }}
                            style={{
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              cursor: 'pointer',
                            }}
                          >
                            {authorProfiles[post.author_id].avatar_url ? (
                              <img
                                src={authorProfiles[post.author_id].avatar_url!}
                                alt={authorProfiles[post.author_id].display_name}
                                style={{
                                  width: '44px',
                                  height: '44px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: `1px solid ${colors.border}`,
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: '44px',
                                  height: '44px',
                                  borderRadius: '50%',
                                  background:
                                    'linear-gradient(135deg, rgba(55, 65, 81, 0.8), rgba(75, 85, 99, 0.8))',
                                  backdropFilter: 'blur(8px)',
                                  WebkitBackdropFilter: 'blur(8px)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '1.1rem',
                                  fontWeight: 600,
                                  color: '#fff',
                                  border: `1px solid ${colors.border}`,
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                }}
                              >
                                {authorProfiles[post.author_id].display_name?.charAt(0) || '?'}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '50%',
                              background:
                                'linear-gradient(135deg, rgba(55, 65, 81, 0.8), rgba(75, 85, 99, 0.8))',
                              backdropFilter: 'blur(8px)',
                              WebkitBackdropFilter: 'blur(8px)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              fontSize: '1.1rem',
                              fontWeight: 600,
                              color: '#fff',
                              border: `1px solid ${colors.border}`,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                            }}
                          >
                            {post.author_name?.charAt(0) || '?'}
                          </div>
                        )}

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Meta row */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '8px',
                              flexWrap: 'wrap',
                            }}
                          >
                            {post.is_pinned && (
                              <span
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  color: colors.accent,
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: 'rgba(255, 214, 0, 0.15)',
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                  backdropFilter: 'blur(8px)',
                                  WebkitBackdropFilter: 'blur(8px)',
                                }}
                              >
                                <Pin size={12} /> Pinned
                              </span>
                            )}
                            {post.is_featured && (
                              <span
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  color: '#10B981',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                  backdropFilter: 'blur(8px)',
                                  WebkitBackdropFilter: 'blur(8px)',
                                }}
                              >
                                <Star size={12} /> Featured
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '4px 10px',
                                borderRadius: '8px',
                                background: `${POST_TYPE_LABELS[post.post_type]?.color || '#6366F1'}20`,
                                backdropFilter: 'blur(8px)',
                                WebkitBackdropFilter: 'blur(8px)',
                                color: POST_TYPE_LABELS[post.post_type]?.color || '#6366F1',
                                fontWeight: 500,
                              }}
                            >
                              {POST_TYPE_LABELS[post.post_type]?.label || post.post_type}
                            </span>
                            {post.category_name && (
                              <span style={{ fontSize: '0.8rem', color: colors.textSecondary }}>
                                in {post.category_name}
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <h3
                            style={{
                              fontSize: '1.15rem',
                              fontWeight: 600,
                              margin: '0 0 8px 0',
                              color: colors.text,
                            }}
                          >
                            {post.title}
                          </h3>

                          {/* Preview */}
                          <p
                            style={{
                              fontSize: '0.9rem',
                              color: colors.textSecondary,
                              margin: '0 0 12px 0',
                              lineHeight: 1.6,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {post.content_preview}
                          </p>

                          {post.media && post.media.length > 0 && (
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns:
                                  post.media.length === 1 ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                                gap: 8,
                                marginBottom: '12px',
                                borderRadius: 16,
                                overflow: 'hidden',
                                border: `1px solid ${colors.border}`,
                                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                              }}
                            >
                              {post.media.slice(0, 4).map((item, index) => (
                                <div
                                  key={`${item.url || item.topText || item.title || item.type}-${index}`}
                                  role={item.type === 'video' ? 'button' : undefined}
                                  tabIndex={item.type === 'video' ? 0 : undefined}
                                  onClick={
                                    item.type === 'video' && item.videoSrc
                                      ? (event) => {
                                          event.stopPropagation();
                                          setActiveVideo({
                                            src: item.videoSrc!,
                                            poster: item.url,
                                            title: item.title || post.title,
                                            caption: item.caption,
                                          });
                                        }
                                      : undefined
                                  }
                                  onKeyDown={
                                    item.type === 'video' && item.videoSrc
                                      ? (event) => {
                                          if (event.key !== 'Enter' && event.key !== ' ') return;
                                          event.preventDefault();
                                          event.stopPropagation();
                                          setActiveVideo({
                                            src: item.videoSrc!,
                                            poster: item.url,
                                            title: item.title || post.title,
                                            caption: item.caption,
                                          });
                                        }
                                      : undefined
                                  }
                                  style={{
                                    position: 'relative',
                                    width: '100%',
                                    maxWidth:
                                      item.type === 'video'
                                        ? 360
                                        : item.type === 'meme'
                                          ? 560
                                          : 'none',
                                    justifySelf:
                                      item.type === 'video' || item.type === 'meme'
                                        ? 'center'
                                        : 'stretch',
                                    minHeight:
                                      item.type === 'meme'
                                        ? 320
                                        : post.media!.length === 1
                                          ? 220
                                          : 150,
                                    aspectRatio:
                                      item.type === 'meme'
                                        ? '4 / 3'
                                        : item.type === 'video'
                                          ? '9 / 13'
                                          : post.media!.length === 1
                                            ? '16 / 8'
                                            : '16 / 10',
                                    overflow: 'hidden',
                                    cursor:
                                      item.type === 'video' && item.videoSrc
                                        ? 'pointer'
                                        : 'default',
                                  }}
                                >
                                  {item.type === 'meme' ? (
                                    <div
                                      aria-label={item.caption || 'Community meme'}
                                      style={{
                                        minHeight: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        padding: isMobile ? 18 : 24,
                                        boxSizing: 'border-box',
                                        background:
                                          'linear-gradient(135deg, rgba(255,214,0,0.92), rgba(17,24,39,0.96) 52%, rgba(67,56,202,0.92))',
                                        color: '#fff',
                                        textAlign: 'center',
                                        textTransform: 'uppercase',
                                        textShadow: '0 3px 0 rgba(0,0,0,0.55)',
                                        fontFamily: 'Impact, Rubik, sans-serif',
                                        fontSize: isMobile ? '1.45rem' : '2rem',
                                        lineHeight: 1.05,
                                        letterSpacing: 0,
                                      }}
                                    >
                                      <span>{item.topText}</span>
                                      <span>{item.bottomText}</span>
                                    </div>
                                  ) : (
                                    <img
                                      src={item.url}
                                      alt={item.alt || item.title || 'Post media'}
                                      loading="lazy"
                                      style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        display: 'block',
                                      }}
                                    />
                                  )}
                                  {item.type === 'video' && (
                                    <>
                                      <div
                                        style={{
                                          position: 'absolute',
                                          inset: 0,
                                          background:
                                            'linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.62))',
                                        }}
                                      />
                                      <div
                                        style={{
                                          position: 'absolute',
                                          inset: 0,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                        }}
                                      >
                                        <span
                                          style={{
                                            width: 64,
                                            height: 64,
                                            borderRadius: '50%',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: 'rgba(255,255,255,0.92)',
                                            color: '#111827',
                                            boxShadow: '0 12px 30px rgba(0,0,0,0.32)',
                                          }}
                                        >
                                          <Play size={30} fill="currentColor" />
                                        </span>
                                      </div>
                                      <div
                                        style={{
                                          position: 'absolute',
                                          left: 12,
                                          right: 12,
                                          bottom: 10,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: 10,
                                          color: '#fff',
                                          fontSize: '0.78rem',
                                          fontWeight: 800,
                                        }}
                                      >
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            padding: '7px 10px',
                                            borderRadius: 999,
                                            background: 'rgba(0,0,0,0.56)',
                                            backdropFilter: 'blur(10px)',
                                            WebkitBackdropFilter: 'blur(10px)',
                                          }}
                                        >
                                          <Film size={14} /> Reel
                                        </span>
                                        {item.duration && (
                                          <span
                                            style={{
                                              padding: '7px 10px',
                                              borderRadius: 999,
                                              background: 'rgba(0,0,0,0.56)',
                                            }}
                                          >
                                            {item.duration}
                                          </span>
                                        )}
                                      </div>
                                    </>
                                  )}
                                  {index === 3 && post.media!.length > 4 && (
                                    <div
                                      style={{
                                        position: 'absolute',
                                        inset: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'rgba(0,0,0,0.48)',
                                        color: '#fff',
                                        fontSize: '1.1rem',
                                        fontWeight: 800,
                                      }}
                                    >
                                      +{post.media!.length - 4}
                                    </div>
                                  )}
                                  {item.caption &&
                                    post.media!.length === 1 &&
                                    item.type !== 'video' && (
                                      <div
                                        style={{
                                          position: 'absolute',
                                          left: 12,
                                          right: 12,
                                          bottom: 10,
                                          padding: '8px 10px',
                                          borderRadius: 10,
                                          background: 'rgba(0,0,0,0.55)',
                                          color: '#fff',
                                          fontSize: '0.78rem',
                                          fontWeight: 600,
                                          backdropFilter: 'blur(10px)',
                                          WebkitBackdropFilter: 'blur(10px)',
                                        }}
                                      >
                                        {item.caption}
                                      </div>
                                    )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Tags with glass effect */}
                          {post.tags.length > 0 && (
                            <div
                              style={{
                                display: 'flex',
                                gap: '8px',
                                flexWrap: 'wrap',
                                marginBottom: '12px',
                              }}
                            >
                              {post.tags.slice(0, 3).map((tag) => (
                                <span key={tag} style={glassTag}>
                                  #{tag}
                                </span>
                              ))}
                              {post.tags.length > 3 && (
                                <span style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                                  +{post.tags.length - 3} more
                                </span>
                              )}
                            </div>
                          )}

                          {(post.related_group_name || post.author_username) && (
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '8px',
                                marginBottom: '12px',
                              }}
                            >
                              {post.related_group_name && post.related_group_id && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/groups/${post.related_group_id}`);
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 10px',
                                    borderRadius: '999px',
                                    border: `1px solid ${colors.border}`,
                                    background: isDark
                                      ? 'rgba(255,214,0,0.1)'
                                      : 'rgba(255,214,0,0.18)',
                                    color: colors.accent,
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <MessageCircle size={13} /> {post.related_group_name}
                                </button>
                              )}
                              {post.related_group_id && post.related_channel_id && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(
                                      getGroupMessagesHref({
                                        id: post.related_group_id!,
                                        channel_id: post.related_channel_id,
                                      }),
                                    );
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 10px',
                                    borderRadius: '999px',
                                    border: `1px solid ${colors.border}`,
                                    background: isDark
                                      ? 'rgba(255,255,255,0.06)'
                                      : 'rgba(0,0,0,0.04)',
                                    color: colors.text,
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <MessageSquare size={13} /> Open Messages
                                </button>
                              )}
                              {post.author_username && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(getProfileMessageHref(post.author_username));
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 10px',
                                    borderRadius: '999px',
                                    border: `1px solid ${colors.border}`,
                                    background: 'transparent',
                                    color: colors.textSecondary,
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Message author
                                </button>
                              )}
                            </div>
                          )}

                          {/* Footer */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '16px',
                              fontSize: '0.85rem',
                              color: colors.textSecondary,
                              paddingTop: '12px',
                              borderTop: `1px solid ${colors.border}`,
                            }}
                          >
                            {post.is_anonymous ? (
                              <span style={{ fontWeight: 500, fontStyle: 'italic' }}>
                                {post.anonymous_name || 'Anonymous'}
                              </span>
                            ) : post.author_id && authorProfiles[post.author_id] ? (
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/profiles/${authorProfiles[post.author_id!].username}`);
                                }}
                                style={{
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  color: colors.accent,
                                  transition: 'opacity 0.2s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                              >
                                {authorProfiles[post.author_id!].display_name}
                              </span>
                            ) : (
                              <span style={{ fontWeight: 500 }}>
                                {displayAuthorName(post.author_name)}
                              </span>
                            )}
                            <span style={{ color: colors.textMuted }}>|</span>
                            <span>{formatTime(post.last_activity_at)}</span>
                            <div style={{ flex: 1 }} />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLike(post.id, post.is_liked);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: post.is_liked
                                  ? 'rgba(233, 30, 99, 0.15)'
                                  : 'transparent',
                                backdropFilter: post.is_liked ? 'blur(8px)' : 'none',
                                WebkitBackdropFilter: post.is_liked ? 'blur(8px)' : 'none',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '6px 10px',
                                cursor: 'pointer',
                                color: post.is_liked ? '#E91E63' : colors.textSecondary,
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <Heart size={16} fill={post.is_liked ? '#E91E63' : 'none'} />
                              {post.like_count}
                            </button>
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 10px',
                              }}
                            >
                              <MessageSquare size={16} />
                              {post.reply_count}
                            </span>
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 10px',
                              }}
                            >
                              <Eye size={16} />
                              {post.view_count}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </main>
          </div>
        </div>
      </div>

      {activeVideo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activeVideo.title}
          onClick={() => setActiveVideo(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? 16 : 32,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(420px, 100%)',
              maxHeight: 'calc(100vh - 64px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                color: '#fff',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{activeVideo.title}</div>
                {activeVideo.caption && (
                  <div
                    style={{ marginTop: 4, color: 'rgba(255,255,255,0.72)', fontSize: '0.85rem' }}
                  >
                    {activeVideo.caption}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveVideo(null)}
                aria-label="Close video"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.24)',
                  background: 'rgba(255,255,255,0.12)',
                  color: '#fff',
                  fontSize: 24,
                  lineHeight: 1,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
            <video
              src={activeVideo.src}
              poster={activeVideo.poster}
              controls
              autoPlay
              playsInline
              style={{
                width: '100%',
                maxHeight: 'calc(100vh - 160px)',
                borderRadius: 18,
                background: '#000',
                boxShadow: '0 24px 80px rgba(0,0,0,0.42)',
              }}
            >
              <track kind="captions" />
            </video>
          </div>
        </div>
      )}
    </div>
  );
}

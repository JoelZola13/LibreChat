import { useEffect, useState, useCallback, useContext, useMemo, useRef, memo } from 'react';
import { isDarkTheme, useTheme } from '../shared/theme-provider';
import { ThemeContext } from '../shared/theme-provider';
import { useOutletContext } from 'react-router-dom';
import type { ContextType } from '~/common';
import { isDirectory } from '~/config/appVariant';
import SiteFooter from '~/components/Chat/SiteFooter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  PenSquare,
  Search as SearchIcon,
  X as XIcon,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SB_API_BASE } from '~/components/streetbot/shared/apiConfig';
import { prefetchNews, getPrefetchedSync } from './newsPrefetch';
import { useGlassStyles } from '../shared/useGlassStyles';
import { useAuthContext } from '~/hooks';
import { useUserRole } from '../lib/auth/useUserRole';
import { useActiveUser } from '../shared/useActiveUser';
import { useResponsive } from '../hooks/useResponsive';
import { getSeamlessNavBarStyle } from '../shared/glassNav';
import { useTopNavScrolled } from '../shared/useTopNavScrolled';
import MobileMenuDrawer, {
  getMobileNavLinkStyle,
  getMobileDividerStyle,
  HamburgerButton,
} from '../shared/MobileMenuDrawer';
import AuthPopupModal from '../shared/AuthPopupModal';
import NavDropdown from '../shared/NavDropdown';
import {
  STREET_PROFILE_NAV_ITEMS,
  isStreetProfileNavActive,
} from '../shared/streetProfileNavItems';
import StreetPagination from '../shared/StreetPagination';
import { readStoredBoolean } from '../shared/safeStorage';
import { prefetchArticle, prefetchTopArticles } from './articlePrefetch';

import type { Article, SectionId } from './newsTypes';
import {
  NEWS_T,
  FALLBACK_IMAGE,
  ARTICLES_PER_PAGE,
  EASE_OUT_EXPO,
  staggerContainer,
  staggerItem,
  getOrCreateUserId,
  formatDate,
  getInitials,
} from './newsConstants';

const formatYellowNewsBadgeLabel = (value: string) =>
  value
    .trim()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getYellowNewsBadgeLabels = (article: Article) => {
  const labels =
    article.categories && article.categories.length > 0
      ? article.categories
      : (article.category?.split(',') ?? []);
  const seen = new Set<string>();

  return labels
    .filter((label): label is string => typeof label === 'string')
    .map(formatYellowNewsBadgeLabel)
    .filter((label) => {
      const key = label.toLowerCase();
      if (!label || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const YellowNewsBadges: React.FC<{
  article: Article;
  className?: string;
  size?: 'default' | 'featured';
}> = ({ article, className = '', size = 'default' }) => {
  const labels = getYellowNewsBadgeLabels(article);
  if (labels.length === 0) return null;
  const badgeClassName =
    size === 'featured'
      ? 'inline-flex h-[26px] flex-none items-center whitespace-nowrap rounded-full px-[13px] text-[13px] font-black leading-none'
      : 'inline-flex h-[22px] flex-none items-center whitespace-nowrap rounded-full px-[11px] text-[11px] font-black leading-none';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {labels.map((label) => (
        <span
          key={label}
          className={badgeClassName}
          style={{
            backgroundColor: '#FDD30B',
            color: '#000000',
            fontFamily: 'Rubik, sans-serif',
            fontWeight: 900,
            textShadow: '0.18px 0 0 #000000, -0.18px 0 0 #000000',
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
};

/* ─── StoryCard ─── */
interface StoryCardProps {
  article: Article;
  variant?: 'default' | 'large';
  isBookmarked?: boolean;
  onToggleBookmark?: (articleId: string) => void;
  index?: number;
}

const hasUsableImageSrc = (value?: string) => {
  const trimmed = String(value || '').trim();
  return Boolean(trimmed && trimmed !== 'null' && trimmed !== 'undefined');
};

const getNewsImageSrc = (value?: string) =>
  hasUsableImageSrc(value) ? String(value).trim() : FALLBACK_IMAGE;

interface ArticleImageProps {
  article: Article;
  className: string;
  loading?: 'eager' | 'lazy';
  width?: number;
  height?: number;
  animated?: boolean;
  hoverScale?: number;
  transitionDuration?: number;
}

const ArticleImage: React.FC<ArticleImageProps> = ({
  article,
  className,
  loading = 'lazy',
  width,
  height,
  animated = false,
  hoverScale = 1.05,
  transitionDuration = 0.6,
}) => {
  const [imgSrc, setImgSrc] = useState(() => getNewsImageSrc(article.image_url));
  const [fallbackFailed, setFallbackFailed] = useState(false);

  useEffect(() => {
    setImgSrc(getNewsImageSrc(article.image_url));
    setFallbackFailed(false);
  }, [article.id, article.image_url]);

  const handleImageError = () => {
    if (imgSrc !== FALLBACK_IMAGE) {
      setImgSrc(FALLBACK_IMAGE);
      return;
    }
    setFallbackFailed(true);
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if ((e.currentTarget as HTMLImageElement).naturalWidth === 0) {
      handleImageError();
    }
  };

  if (fallbackFailed) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-[#111827]`}
        aria-label={article.title}
        role="img"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,214,0,0.28),transparent_32%),linear-gradient(135deg,#111827,#0b0f14_55%,#050505)]" />
        <div className="relative flex flex-col items-center gap-3 text-center">
          <span className="rounded-full bg-[#FFD600] px-4 py-1 text-xs font-black uppercase tracking-wider text-black">
            Street Voices
          </span>
          <span className="text-lg font-bold uppercase tracking-wider text-white">
            {article.category || 'News'}
          </span>
        </div>
      </div>
    );
  }

  const props = {
    src: imgSrc,
    alt: article.title,
    loading,
    width,
    height,
    onError: handleImageError,
    onLoad: handleImageLoad,
    referrerPolicy: 'no-referrer' as const,
    className,
  };

  return animated ? (
    <motion.img
      {...props}
      whileHover={{ scale: hoverScale }}
      transition={{ duration: transitionDuration, ease: EASE_OUT_EXPO }}
    />
  ) : (
    <img {...props} />
  );
};

const StoryCard: React.FC<StoryCardProps> = memo(
  ({ article, variant = 'default', isBookmarked = false, onToggleBookmark, index = 0 }) => {
    const { isDark, colors } = useGlassStyles();
    const isAggregated = article.source_type === 'aggregated';
    const href =
      isAggregated && article.source_url
        ? article.source_url
        : article.slug
          ? `/news/${article.slug}`
          : `/news/${article.id}`;
    const canBookmark = Boolean(onToggleBookmark) && !isAggregated;
    const articleRef = article.slug || String(article.id);
    const primeArticle = () => {
      if (!isAggregated && articleRef) {
        prefetchArticle(articleRef);
      }
    };

    const aspectClass = variant === 'large' ? 'aspect-[16/9]' : 'aspect-[16/10]';
    const titleClamp = variant === 'large' ? 'line-clamp-3' : 'line-clamp-2';

    const inner = (
      <>
        {/* Image */}
        <div className={`relative overflow-hidden ${aspectClass} bg-stone-900`}>
          <ArticleImage
            article={article}
            loading={index === 0 ? 'eager' : 'lazy'}
            width={600}
            height={375}
            className="absolute inset-0 h-full w-full object-cover"
            animated
            hoverScale={1.1}
            transitionDuration={0.6}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0C0A09]/60 via-transparent to-transparent" />
          {article.category && (
            <span
              className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider backdrop-blur-md ${
                isDark
                  ? 'border border-white/10 bg-black/50 text-[#A8A29E]'
                  : 'border border-black/10 bg-white/80 text-gray-600'
              }`}
            >
              {article.category}
            </span>
          )}
          {/* Read Article overlay on hover */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="flex items-center gap-2 rounded-full bg-[#FACC15] px-4 py-2 text-sm font-semibold text-[#0C0A09]">
              Read Article <ArrowRight size={14} />
            </span>
          </div>
        </div>
        {/* Content */}
        <div className="flex flex-1 flex-col p-5">
          <h3
            className={`mb-2 font-semibold leading-snug transition-colors duration-200 group-hover:text-[#FACC15] ${titleClamp}`}
            style={{
              fontFamily: 'Rubik, sans-serif',
              color: colors.text,
              fontSize: variant === 'large' ? '1.25rem' : '1rem',
            }}
          >
            {article.title}
          </h3>
          {article.excerpt && (
            <p
              className="mb-4 line-clamp-2 text-sm leading-relaxed"
              style={{ color: colors.textSecondary }}
            >
              {article.excerpt}
            </p>
          )}
          <div
            className="mt-auto flex items-center gap-3 border-t pt-3 text-xs"
            style={{ color: colors.textMuted, borderColor: colors.border }}
          >
            {/* Author initials */}
            <div
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(250,204,21,0.15)', color: colors.accent }}
            >
              {getInitials(article.author)}
            </div>
            <span style={{ color: colors.textSecondary }}>{article.author || 'Staff'}</span>
            {article.published_at && (
              <>
                <span style={{ color: colors.textMuted }}>|</span>
                <span className="flex items-center gap-1">
                  <Calendar size={11} />
                  {formatDate(article.published_at)}
                </span>
              </>
            )}
          </div>
        </div>
      </>
    );

    return (
      <motion.article
        variants={staggerItem}
        className={`group relative flex h-full flex-col overflow-hidden rounded-2xl backdrop-blur-xl transition-all duration-500 ${
          isDark
            ? 'border border-white/10 bg-black/50 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:border-yellow-400/50 hover:bg-black/60 hover:shadow-[0_8px_40px_rgba(250,204,21,0.2)]'
            : 'border border-yellow-300/60 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)] hover:border-yellow-400 hover:shadow-[0_8px_32px_rgba(250,204,21,0.15)]'
        }`}
        whileHover={{ scale: 1.02, y: -4 }}
        whileTap={{ scale: 0.98 }}
      >
        {canBookmark && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleBookmark?.(String(article.id));
            }}
            className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition-colors"
            style={{
              borderColor: colors.border,
              background: isBookmarked
                ? colors.accent
                : isDark
                  ? 'rgba(0,0,0,0.5)'
                  : 'rgba(255,255,255,0.8)',
              color: isBookmarked ? NEWS_T.bgDeep : isDark ? '#fff' : '#666',
            }}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
          >
            <Bookmark size={15} fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>
        )}
        {isAggregated && article.source_url ? (
          <a href={href} className="flex h-full flex-col" aria-label={`Read ${article.title}`}>
            {inner}
          </a>
        ) : (
          <Link
            to={href}
            className="flex h-full flex-col"
            onMouseEnter={primeArticle}
            onFocus={primeArticle}
            onTouchStart={primeArticle}
            onPointerDown={primeArticle}
          >
            {inner}
          </Link>
        )}
      </motion.article>
    );
  },
);

StoryCard.displayName = 'StoryCard';

/* ─── NewsPageHeader (React.memo — stops re-renders on article/pagination changes) ─── */
interface NewsPageHeaderProps {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  navLeft: number;
  dark: boolean;
  navTextColor: string;
  authUser: ReturnType<typeof useAuthContext>['user'];
  canEditNews: boolean;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  setAuthModalOpen: (open: boolean) => void;
  sessionResolved: boolean;
  toggleTheme: () => void;
  sections: { id: SectionId; label: string }[];
  activeSection: SectionId;
  onCategoryChange: (id: SectionId) => void;
  colors: ReturnType<typeof useGlassStyles>['colors'];
}

const NewsPageHeader = memo<NewsPageHeaderProps>(
  ({
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    navLeft,
    dark,
    navTextColor,
    authUser,
    canEditNews,
    mobileNavOpen,
    setMobileNavOpen,
    setAuthModalOpen,
    sessionResolved,
    toggleTheme,
    sections,
    activeSection,
    onCategoryChange,
    colors,
  }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [localSearch, setLocalSearch] = useState(
      () => new URLSearchParams(location.search).get('q') || '',
    );
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const [avatarLoadError, setAvatarLoadError] = useState(false);
    const [hoveredSection, setHoveredSection] = useState<SectionId | null>(null);
    const isTopNavScrolled = useTopNavScrolled();
    const showMobileSearchHeader = isMobile && mobileSearchOpen;
    const navSearchStrokeWidth = 0.5;
    const mobileSearchBarHeight = 41;
    const mobileSearchButtonSize = 31;
    const mobileSearchButtonInset = 5;
    const mobileSearchInputPadding = 14;
    const navSearchGlassBg = dark
      ? 'linear-gradient(90deg, rgba(84, 109, 132, 0.42), rgba(83, 87, 126, 0.34), rgba(96, 72, 112, 0.30))'
      : 'rgba(255, 255, 255, 0.70)';
    const navSearchBorderColor = dark ? 'rgba(210, 216, 238, 0.34)' : 'rgba(43, 48, 64, 0.18)';
    const navSearchTextColor = dark ? '#F6F7FB' : '#111318';
    const navSearchPlaceholderColor = dark ? 'rgba(246, 247, 251, 0.78)' : 'rgba(17, 19, 24, 0.62)';
    const navSearchIconColor = dark ? 'rgba(236, 239, 250, 0.78)' : 'rgba(24, 28, 38, 0.58)';
    const navSearchShadow = dark
      ? '0 14px 38px rgba(0,0,0,0.28)'
      : '0 14px 32px rgba(31,41,55,0.10)';
    const directoryLogoSrc = dark
      ? '/assets/streetvoices-text.svg'
      : '/assets/streetvoices-text-dark.svg';
    const mainNavLinks = [
      { label: 'Street Profile', to: '/profiles' },
      { label: 'Street Gallery', to: '/gallery' },
      { label: 'Academy', to: '/academy' },
      { label: 'Job Board', to: '/jobs' },
      { label: 'Directory', to: '/directory' },
      { label: 'News', to: '/news' },
    ];

    useEffect(() => {
      if (!isMobile && mobileSearchOpen) {
        setMobileSearchOpen(false);
      }
    }, [isMobile, mobileSearchOpen]);

    useEffect(() => {
      setAvatarLoadError(false);
    }, [(authUser as any)?.avatar]);

    useEffect(() => {
      setLocalSearch(new URLSearchParams(location.search).get('q') || '');
    }, [location.search]);

    const handleNewsSearch = (event?: React.FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      const params = new URLSearchParams();
      const trimmedSearch = localSearch.trim();
      if (trimmedSearch) params.set('q', trimmedSearch);
      navigate(`/news${params.toString() ? `?${params}` : ''}`);
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleNewsSearch();
    };

    return (
      <>
        <style>{`
	      .sv-search-input::placeholder {
	        color: ${navSearchPlaceholderColor} !important;
	        opacity: 1;
	      }
	      .sv-news-mobile-search-input {
	        color: ${navSearchTextColor} !important;
	        -webkit-text-fill-color: ${navSearchTextColor} !important;
	        caret-color: ${navSearchTextColor} !important;
	      }
	      .sv-news-mobile-search-input::placeholder {
	        color: ${navSearchPlaceholderColor} !important;
	        opacity: 1;
	      }
	      .sv-page-top-nav-link {
	        display: inline-flex;
	        align-items: center;
	        gap: 4px;
	        border-radius: 8px;
	        padding: 8px 8px;
	        transition: background-color 160ms ease, color 160ms ease;
	      }
	      .sv-page-top-nav-link:hover,
	      .sv-page-top-nav-link:focus-visible {
	        background: rgba(255, 255, 255, 0.12);
        }
        html.light .sv-page-top-nav-link:hover,
        html.light .sv-page-top-nav-link:focus-visible {
          background: rgba(17, 19, 24, 0.08);
	      }
	      @media (min-width: 1280px) {
	        .sv-page-top-nav-link { padding-left: 12px; padding-right: 12px; }
	      }
	    `}</style>
        {/* Site Nav */}
        <div
          className="relative z-20"
          style={{
            position: 'fixed',
            top: 0,
            left: isMobile || isTablet ? 0 : isDesktop ? 0 : navLeft,
            right: 0,
            ...getSeamlessNavBarStyle(dark, isTopNavScrolled),
            padding: showMobileSearchHeader
              ? '0 15px'
              : isMobile
                ? '0 24px'
                : isTablet
                  ? '0 16px'
                  : '8px clamp(160px, 16.45vw, 220px)',
            height: isMobile ? 71 : isTablet ? 62 : 64,
            display: 'flex',
            alignItems: 'center',
            boxSizing: 'border-box',
            transition: 'left 0.2s ease-out',
          }}
        >
          {!showMobileSearchHeader && !isDesktop && (
            <Link
              to="/home"
              aria-label="Street Voices home"
              title="Street Voices home"
              style={{ flexShrink: 0, marginRight: isMobile ? 10 : 24 }}
            >
              <img
                src={directoryLogoSrc}
                alt="Street Voices"
                style={{
                  height: isMobile ? 38 : isTablet ? 30 : 38,
                  maxWidth: isMobile ? 105 : isTablet ? 113 : 143,
                }}
              />
            </Link>
          )}

          {!isDesktop ? (
            <>
              {(!isMobile || mobileSearchOpen) && (
                <form
                  role="search"
                  aria-label="Search news"
                  onSubmit={handleNewsSearch}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flex: 1,
                    minWidth: 0,
                    marginLeft: 0,
                    marginRight: 0,
                    height: mobileSearchBarHeight,
                    overflow: 'visible',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flex: 1,
                      minWidth: 0,
                      height: '100%',
                      background: navSearchGlassBg,
                      border: `${navSearchStrokeWidth}px solid ${navSearchBorderColor}`,
                      borderRadius: 999,
                      boxShadow: navSearchShadow,
                      backdropFilter: 'blur(26px) saturate(150%)',
                      WebkitBackdropFilter: 'blur(26px) saturate(150%)',
                      overflow: 'hidden',
                      position: 'relative',
                      padding: 5,
                    }}
                  >
                    {/* Search input */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flex: 1,
                        minWidth: 0,
                        height: '100%',
                        background: 'transparent',
                        borderRadius: 999,
                        padding: `0 ${mobileSearchInputPadding}px`,
                        gap: 10,
                      }}
                    >
                      <SearchIcon
                        size={16}
                        strokeWidth={2.1}
                        style={{ color: navSearchIconColor, flexShrink: 0 }}
                        aria-hidden="true"
                      />
                      <input
                        type="text"
                        className="sv-search-input sv-mobile-search-input sv-news-mobile-search-input"
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        placeholder="Search news..."
                        style={{
                          width: '100%',
                          minWidth: 0,
                          height: '100%',
                          padding: 0,
                          border: 'none',
                          background: 'transparent',
                          color: navSearchTextColor,
                          fontSize: 'var(--sv-search-bar-font-size)',
                          fontWeight: 500,
                          lineHeight: `${mobileSearchBarHeight}px`,
                          outline: 'none',
                          fontFamily: 'inherit',
                        }}
                      />
                    </div>
                    {/* Search button */}
                    <button
                      type="submit"
                      aria-label="Search news"
                      style={{
                        position: 'absolute',
                        top: mobileSearchButtonInset,
                        right: mobileSearchButtonInset,
                        height: mobileSearchButtonSize,
                        width: mobileSearchButtonSize,
                        borderRadius: 25,
                        border: 'none',
                        background: '#FFD600',
                        color: '#000',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        flexShrink: 0,
                        zIndex: 1,
                        boxShadow: '0 6px 14px rgba(0,0,0,0.18)',
                      }}
                    >
                      <SearchIcon size={22} />
                    </button>
                  </div>
                  {isMobile && (
                    <button
                      onClick={() => setMobileSearchOpen(false)}
                      aria-label="Close search"
                      style={{
                        marginLeft: 24,
                        border: 'none',
                        background: 'none',
                        color: dark ? '#FFD600' : '#2D2D2D',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        width: 16,
                        height: 16,
                      }}
                    >
                      <XIcon size={16} />
                    </button>
                  )}
                </form>
              )}
              {isMobile && !mobileSearchOpen && <div style={{ flex: 1 }} />}
              {authUser && (!isMobile || !mobileSearchOpen) && (
                <Link
                  to="/myprofile"
                  aria-label="Profile"
                  style={{ display: 'inline-flex', alignItems: 'center', marginRight: 8 }}
                >
                  {(authUser as any).avatar && !avatarLoadError ? (
                    <img
                      src={(authUser as any).avatar}
                      alt={(authUser as any).name || 'Profile'}
                      style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                      onError={() => setAvatarLoadError(true)}
                    />
                  ) : (
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: '#7c3aed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {(authUser as any).name?.charAt(0)?.toUpperCase() ||
                        (authUser as any).username?.charAt(0)?.toUpperCase() ||
                        '?'}
                    </div>
                  )}
                </Link>
              )}
              {isMobile && !mobileSearchOpen && (
                <button
                  onClick={() => {
                    setMobileNavOpen(false);
                    setMobileSearchOpen(true);
                  }}
                  aria-label="Open search"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'none',
                    color: dark ? '#fff' : '#1a1c24',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  <SearchIcon size={18} />
                </button>
              )}
              {(!isMobile || !mobileSearchOpen) && (
                <>
                  <HamburgerButton onClick={() => setMobileNavOpen(true)} dark={dark} />
                  <MobileMenuDrawer isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)}>
                    <Link
                      to="/directory"
                      style={getMobileNavLinkStyle(dark)}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      Directory
                    </Link>
                    <a
                      href="https://airtable.com/appBQoHCfq4nfspKj/shrVEiMPGLqetHMfw"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={getMobileNavLinkStyle(dark)}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      Programs
                    </a>
                    <Link
                      to="/news"
                      style={getMobileNavLinkStyle(dark)}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      News
                    </Link>
                    <Link
                      to="/about"
                      style={{ ...getMobileNavLinkStyle(dark), borderBottom: 'none' }}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      About Us
                    </Link>
                    <div style={getMobileDividerStyle(dark)} />
                    {!authUser && sessionResolved && (
                      <button
                        onClick={() => {
                          setMobileNavOpen(false);
                          setAuthModalOpen(true);
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '13px 16px',
                          color: dark ? '#E6E7F2' : '#1f2937',
                          fontSize: 14,
                          fontWeight: 700,
                          fontFamily: 'Rubik, sans-serif',
                          textAlign: 'center',
                          borderRadius: 10,
                          background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                          border: dark
                            ? '1px solid rgba(255,255,255,0.08)'
                            : '1px solid rgba(0,0,0,0.08)',
                          marginBottom: 10,
                          cursor: 'pointer',
                          letterSpacing: '0.01em',
                        }}
                      >
                        Login
                      </button>
                    )}
                    <a
                      href="/donate"
                      className="sv-donate-nav-label"
                      onClick={() => setMobileNavOpen(false)}
                      style={{
                        display: 'block',
                        padding: '13px 16px',
                        color: '#000',
                        fontSize: 14,
                        fontWeight: 900,
                        fontFamily: 'Rubik, sans-serif',
                        textDecoration: 'none',
                        textAlign: 'center',
                        borderRadius: 10,
                        background: '#FFD600',
                        letterSpacing: '0.01em',
                      }}
                    >
                      Donate
                    </a>
                  </MobileMenuDrawer>
                </>
              )}
            </>
          ) : (
            <nav
              aria-label="News main navigation"
              style={{
                display: 'flex',
                justifyContent: 'flex-start',
                alignItems: 'center',
                gap: 4,
                height: 48,
                whiteSpace: 'nowrap',
                maxWidth: '859px',
                width: 'min(859px, calc(100vw - 320px))',
                margin: '0 auto',
              }}
            >
              {/* Search bar */}
              <form
                role="search"
                aria-label="Search news"
                onSubmit={handleNewsSearch}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  order: 2,
                  flex: '0 0 clamp(260px, calc(50vw - 386px), 372px)',
                  maxWidth: 372,
                  minWidth: 260,
                  overflow: 'visible',
                  height: 41,
                  position: 'relative',
                  gap: 10,
                  background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)',
                  border: dark
                    ? '1px solid rgba(255,255,255,0.16)'
                    : '1px solid rgba(17,24,39,0.12)',
                  borderRadius: 999,
                  boxShadow: dark
                    ? '0 8px 24px rgba(0,0,0,0.16)'
                    : '0 8px 20px rgba(17,24,39,0.08)',
                  backdropFilter: 'blur(18px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(18px) saturate(160%)',
                  padding: '4px 4px 4px 14px',
                }}
              >
                <SearchIcon
                  size={17}
                  style={{
                    color: dark ? 'rgba(230,231,242,0.64)' : 'rgba(31,41,55,0.56)',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                />
                <label
                  htmlFor="news-search"
                  style={{
                    position: 'absolute',
                    width: '1px',
                    height: '1px',
                    padding: 0,
                    margin: '-1px',
                    overflow: 'hidden',
                    clip: 'rect(0,0,0,0)',
                    whiteSpace: 'nowrap',
                    borderWidth: 0,
                  }}
                >
                  Search news
                </label>
                <input
                  id="news-search"
                  type="search"
                  className="sv-search-input"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search news..."
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: '100%',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: dark ? '#fff' : '#111827',
                    fontSize: 14,
                    outline: 'none',
                    fontFamily: 'Rubik, sans-serif',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    height: '100%',
                    minWidth: 86,
                    padding: '0 12px',
                    borderRadius: 30,
                    border: 'none',
                    background: '#FFD600',
                    color: '#000',
                    fontSize: 'var(--sv-search-bar-font-size)',
                    fontWeight: 700,
                    fontFamily: 'inherit',
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

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  order: 1,
                  justifyContent: 'flex-start',
                  gap: 4,
                  flexShrink: 0,
                }}
              >
                {mainNavLinks.map((item) => {
                  const isActive =
                    item.label === 'Street Profile'
                      ? isStreetProfileNavActive(location.pathname)
                      : location.pathname === item.to ||
                        location.pathname.startsWith(`${item.to}/`);

                  if (item.label === 'Street Profile') {
                    return (
                      <NavDropdown
                        key={item.to}
                        label={item.label}
                        href={item.to}
                        items={STREET_PROFILE_NAV_ITEMS}
                        textColor={isActive ? (dark ? '#FFD600' : '#111827') : navTextColor}
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
                      className="sv-page-top-nav-link"
                      style={{
                        color: isActive ? (dark ? '#FFD600' : '#111827') : navTextColor,
                        fontSize: 14,
                        fontWeight: isActive ? 900 : 700,
                        lineHeight: 1.25,
                        textDecoration: 'none',
                        fontFamily: 'Rubik, sans-serif',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </nav>
          )}
        </div>

        {/* Page Title + Create button */}
        <motion.div
          className="flex items-center justify-center gap-4 py-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
        >
          <h1
            className="font-bold"
            style={{
              fontFamily: 'Rubik, sans-serif',
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              color: colors.text,
            }}
          >
            News
          </h1>
          {canEditNews && (
            <Link
              to="/news/editor"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 hover:scale-105"
              style={{
                background: colors.accent,
                color: '#0C0A09',
                boxShadow: '0 4px 14px rgba(250,204,21,0.4)',
              }}
            >
              <PenSquare size={15} />
              Create Article
            </Link>
          )}
        </motion.div>

        {/* Category Tabs */}
        <nav
          className={`flex items-center ${isMobile ? 'justify-center gap-0.5' : 'justify-center gap-1'} overflow-x-auto pb-2`}
          aria-label="News categories"
          style={{ scrollbarWidth: 'none' }}
        >
          {sections.map((section) => {
            const isActive = section.id === activeSection;
            const isHovered = section.id === hoveredSection;
            const tabClassName = isMobile
              ? 'relative px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-all duration-200 rounded-lg'
              : 'relative px-4 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200 rounded-lg';
            return (
              <button
                key={section.id}
                onClick={() => onCategoryChange(section.id)}
                onMouseEnter={() => setHoveredSection(section.id)}
                onMouseLeave={() => setHoveredSection(null)}
                onFocus={() => setHoveredSection(section.id)}
                onBlur={() => setHoveredSection(null)}
                className={tabClassName}
                style={{
                  color: isActive || isHovered ? colors.accent : colors.textSecondary,
                  background: isActive ? 'rgba(250,204,21,0.1)' : 'transparent',
                }}
              >
                {isActive && (
                  <motion.span
                    layoutId="active-news-tab"
                    className="absolute inset-0 rounded-lg"
                    style={{
                      background: 'rgba(250,204,21,0.1)',
                      border: `1px solid rgba(250,204,21,0.3)`,
                      zIndex: -1,
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                {section.label}
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div
          className="my-4 h-px"
          style={{
            background: `linear-gradient(to right, transparent, ${colors.border}, transparent)`,
          }}
        />
      </>
    );
  },
);

NewsPageHeader.displayName = 'NewsPageHeader';

/* ═══════════════════════════════════════════════════════════
   NewsListing — Main listing view
   ═══════════════════════════════════════════════════════════ */

export default function NewsListing() {
  const { colors, gradientOrbs } = useGlassStyles();
  const { canEditNews } = useUserRole();
  const navigate = useNavigate();
  const { activeUser: authUser, resolved: sessionResolved } = useActiveUser();
  const { theme } = useTheme();
  const { setTheme } = useContext(ThemeContext);
  const dark = isDarkTheme(theme);
  const navTextColor = dark ? '#fff' : '#1a1c24';
  const { isMobile, isTablet, isDesktop, isLargeDesktop } = useResponsive();
  const toggleTheme = useCallback(() => {
    setTheme(dark ? 'light' : 'dark');
  }, [dark, setTheme]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { navVisible } = useOutletContext<ContextType>() ?? { navVisible: false };
  const sidebarMinimized = readStoredBoolean('sidebarMinimized', true);
  const navLeft =
    isMobile || isTablet ? 0 : isDirectory ? 0 : navVisible ? (sidebarMinimized ? 80 : 275) : 0;
  const newsSearchQuery = useMemo(
    () => new URLSearchParams(location.search).get('q')?.trim().toLowerCase() || '',
    [location.search],
  );

  // Hydrate from cache or prefetch synchronously so the page renders instantly
  const prefetched = useMemo(() => getPrefetchedSync(), []);
  const [internalArticles, setInternalArticles] = useState<Article[]>(
    () => prefetched?.internal ?? [],
  );
  const [aggregatedArticles, setAggregatedArticles] = useState<Article[]>(
    () => prefetched?.aggregated ?? [],
  );
  const hasCachedData = internalArticles.length > 0 || aggregatedArticles.length > 0;
  const [loading, setLoading] = useState(!hasCachedData);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('all');
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [sliderHovered, setSliderHovered] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const fetchedRef = useRef(false);

  // Memoized merged + sorted articles
  const articles = useMemo(() => {
    const merged = [...internalArticles, ...aggregatedArticles];
    merged.sort((a, b) => {
      if (a.source_type === 'aggregated' && b.source_type === 'aggregated') {
        return (a.feed_rank ?? Number.MAX_SAFE_INTEGER) - (b.feed_rank ?? Number.MAX_SAFE_INTEGER);
      }
      const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
      const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
      return dateB - dateA;
    });
    return merged;
  }, [internalArticles, aggregatedArticles]);

  const toggleBookmark = useCallback(
    async (articleId: string) => {
      if (!authUser) {
        if (!sessionResolved) return;
        sessionStorage.setItem('streetbot:postLoginRedirect', '/news');
        setAuthModalOpen(true);
        return;
      }
      const userId = getOrCreateUserId();
      if (!userId) return;

      const isSaved = bookmarkedIds.has(articleId);
      try {
        if (isSaved) {
          const resp = await fetch(
            `${SB_API_BASE}/news/articles/${encodeURIComponent(articleId)}/bookmark/${encodeURIComponent(userId)}`,
            { method: 'DELETE' },
          );
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        } else {
          const resp = await fetch(
            `${SB_API_BASE}/news/articles/${encodeURIComponent(articleId)}/bookmark`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: userId }),
            },
          );
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        }

        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          if (isSaved) next.delete(articleId);
          else next.add(articleId);
          return next;
        });
      } catch (error) {
        console.error('Failed to toggle bookmark:', error);
      }
    },
    [bookmarkedIds, authUser, navigate, sessionResolved],
  );

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let cancelled = false;

    // If we already hydrated from cache/prefetch, skip loading state
    if (!hasCachedData) {
      setLoading(true);
    }
    setError(null);

    // Consume the module-level prefetch (already in-flight or resolved)
    prefetchNews()
      .then(({ internal, aggregated }) => {
        if (cancelled) return;
        if (internal.length > 0) setInternalArticles(internal);
        if (aggregated.length > 0) setAggregatedArticles(aggregated);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load news');
          setLoading(false);
        }
      });

    // Fetch bookmarks in parallel (non-blocking)
    const userId = getOrCreateUserId();
    if (userId) {
      fetch(`${SB_API_BASE}/news/bookmarks/${encodeURIComponent(userId)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((bookmarksData) => {
          if (!cancelled && Array.isArray(bookmarksData)) {
            setBookmarkedIds(
              new Set(bookmarksData.map((a: { id?: string | number }) => String(a?.id))),
            );
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, []);

  // Memoized filter function
  const filterBySection = useCallback(
    (article: Article) => {
      if (activeSection === 'all') return true;
      const cats = (article.categories || []).map((c) => c.toLowerCase());
      const legacyCat = article.category?.toLowerCase() || '';
      if (legacyCat) cats.push(legacyCat);
      const allCatsStr = cats.join(' ');
      if (activeSection === 'street-voices') {
        return article.source_type === 'internal' && allCatsStr.includes('street');
      }
      const categoryMap: Record<string, string[]> = {
        local: ['local', 'toronto', 'ontario', 'gta'],
        national: ['national', 'canada', 'canadian'],
        international: ['international', 'world', 'global'],
      };
      const matchCategories = categoryMap[activeSection] || [activeSection];
      // Use word-boundary matching to avoid "national" matching "international"
      return matchCategories.some((cat) => {
        const regex = new RegExp(`\\b${cat}\\b`, 'i');
        return regex.test(allCatsStr);
      });
    },
    [activeSection],
  );

  const sections: { id: SectionId; label: string }[] = [
    { id: 'street-voices', label: 'Street Voices' },
    { id: 'local', label: 'Local' },
    { id: 'national', label: 'National' },
    { id: 'international', label: 'International' },
  ];

  /* ── Derived article slices ── */
  const filteredArticles = useMemo(() => {
    const sectionArticles = articles.filter(filterBySection);
    if (!newsSearchQuery) return sectionArticles;

    return sectionArticles.filter((article) => {
      const searchableText = [
        article.title,
        article.excerpt,
        article.content,
        article.author,
        article.author_name,
        article.category,
        article.source,
        article.source_name,
        ...(article.categories || []),
        ...(article.tags || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(newsSearchQuery);
    });
  }, [articles, filterBySection, newsSearchQuery]);

  const isFeaturedView = activeSection === 'all' || activeSection === 'street-voices';

  const featured = useMemo(() => {
    if (!isFeaturedView) return null; // carousel handles category tabs
    return filteredArticles.find((a) => a.is_featured) || filteredArticles[0];
  }, [filteredArticles, isFeaturedView]);

  const SLIDER_COUNT = 3;
  const sliderArticles = useMemo(() => {
    if (isFeaturedView) return [];
    return filteredArticles.slice(0, SLIDER_COUNT);
  }, [filteredArticles, isFeaturedView]);

  const SIDEBAR_COUNT = 4;
  const sidebarArticles = useMemo(() => {
    if (isFeaturedView) return [];
    return filteredArticles.slice(SLIDER_COUNT, SLIDER_COUNT + SIDEBAR_COUNT);
  }, [filteredArticles, isFeaturedView]);

  const moreArticlesPool = useMemo(() => {
    if (isFeaturedView) {
      return filteredArticles.filter((a) => a.id !== featured?.id);
    }
    // Exclude slider + sidebar articles from the grid
    const excludeIds = new Set([...sliderArticles, ...sidebarArticles].map((a) => a.id));
    return filteredArticles.filter((a) => !excludeIds.has(a.id));
  }, [filteredArticles, featured, sliderArticles, sidebarArticles, isFeaturedView]);

  const totalPages = Math.ceil(moreArticlesPool.length / ARTICLES_PER_PAGE);
  const paginatedArticles = useMemo(() => {
    const start = (currentPage - 1) * ARTICLES_PER_PAGE;
    return moreArticlesPool.slice(start, start + ARTICLES_PER_PAGE);
  }, [moreArticlesPool, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
    setSliderIndex(0);
  }, [newsSearchQuery]);

  // Keep detail pages warm for what the user is currently looking at.
  useEffect(() => {
    const candidates = [
      ...(featured ? [featured] : []),
      ...sliderArticles,
      ...sidebarArticles,
      ...paginatedArticles.slice(0, 6),
    ];
    prefetchTopArticles(candidates, 10);
  }, [featured, sliderArticles, sidebarArticles, paginatedArticles]);

  const handleCategoryChange = useCallback((id: SectionId) => {
    setActiveSection(id);
    setCurrentPage(1);
    setSliderIndex(0);
  }, []);

  /* ── Auto-slide: advance every 4 seconds, pause on hover ── */
  useEffect(() => {
    if (sliderArticles.length <= 1 || sliderHovered) return;
    const timer = setInterval(() => {
      setSliderIndex((prev) => (prev + 1) % sliderArticles.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [sliderArticles.length, sliderHovered]);

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="relative min-h-screen">
        <div style={gradientOrbs.purple} aria-hidden="true" />
        <div style={gradientOrbs.pink} aria-hidden="true" />
        <div style={gradientOrbs.cyan} aria-hidden="true" />
        <div style={gradientOrbs.gold} aria-hidden="true" />
        <div className="relative z-10 flex min-h-[60vh] items-center justify-center">
          <div
            className="rounded-2xl p-8 text-center"
            style={{
              background: NEWS_T.glassSubtle,
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: `1px solid ${colors.border}`,
            }}
          >
            <div
              className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-t-transparent"
              style={{ borderColor: colors.accent, borderTopColor: 'transparent' }}
            />
            <p style={{ color: colors.textSecondary }}>Loading articles...</p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="relative min-h-screen">
        <div style={gradientOrbs.purple} aria-hidden="true" />
        <div style={gradientOrbs.pink} aria-hidden="true" />
        <div style={gradientOrbs.cyan} aria-hidden="true" />
        <div style={gradientOrbs.gold} aria-hidden="true" />
        <div className="relative z-10 flex min-h-[60vh] items-center justify-center">
          <div
            className="max-w-md rounded-2xl p-8 text-center"
            style={{
              background: NEWS_T.glassSubtle,
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: `1px solid ${colors.border}`,
            }}
          >
            <div className="mb-4 text-6xl">&#9888;&#65039;</div>
            <h2 className="mb-2 text-xl font-bold" style={{ color: colors.text }}>
              Failed to load news
            </h2>
            <p className="mb-4" style={{ color: colors.textSecondary }}>
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-full px-4 py-2 font-medium transition-all duration-200 hover:scale-105"
              style={{
                background: colors.accent,
                color: NEWS_T.bgDeep,
                boxShadow: '0 4px 14px rgba(250,204,21,0.4)',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main layout ── */
  return (
    <div className="absolute inset-0 overflow-y-auto">
      <style>{`.sv-search-input::placeholder { color: #000; opacity: 1; } .sv-mobile-search-input::placeholder { color: #000; opacity: 1; }`}</style>
      <div className="relative min-h-full">
        <div style={gradientOrbs.purple} aria-hidden="true" />
        <div style={gradientOrbs.pink} aria-hidden="true" />
        <div style={gradientOrbs.cyan} aria-hidden="true" />
        <div style={gradientOrbs.gold} aria-hidden="true" />

        <div
          className="relative z-10 mx-auto max-w-[1200px] px-4"
          style={{ paddingTop: isMobile ? 85 : 70 }}
        >
          <NewsPageHeader
            isMobile={isMobile}
            isTablet={isTablet}
            isDesktop={isDesktop}
            isLargeDesktop={isLargeDesktop}
            navLeft={navLeft}
            dark={dark}
            navTextColor={navTextColor}
            authUser={authUser}
            canEditNews={canEditNews}
            mobileNavOpen={mobileNavOpen}
            setMobileNavOpen={setMobileNavOpen}
            setAuthModalOpen={setAuthModalOpen}
            sessionResolved={sessionResolved}
            toggleTheme={toggleTheme}
            sections={sections}
            activeSection={activeSection}
            onCategoryChange={handleCategoryChange}
            colors={colors}
          />

          {/* Featured News (Street Voices / all) or Top Stories carousel (category) */}
          {isFeaturedView && featured ? (
            <section className="mb-10">
              <div className="mb-6 flex items-center gap-3">
                <div className="h-8 w-1.5 rounded-full" style={{ background: colors.accent }} />
                <h2
                  className="font-semibold"
                  style={{
                    fontFamily: 'Rubik, sans-serif',
                    fontSize: '1.5rem',
                    color: colors.text,
                  }}
                >
                  Featured News
                </h2>
              </div>

              {(() => {
                const isAgg = featured.source_type === 'aggregated';
                const href =
                  isAgg && featured.source_url
                    ? featured.source_url
                    : featured.slug
                      ? `/news/${featured.slug}`
                      : `/news/${featured.id}`;
                const cardContent = (
                  <motion.div
                    className="group relative w-full cursor-pointer overflow-hidden rounded-2xl"
                    style={{ height: isMobile ? 300 : isTablet ? 380 : 456 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
                    whileHover={{ scale: 1.005 }}
                  >
                    <ArticleImage
                      article={featured}
                      loading="eager"
                      width={1200}
                      height={456}
                      className="absolute inset-0 h-full w-full object-cover"
                      animated
                      hoverScale={1.05}
                      transitionDuration={0.8}
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.7))',
                      }}
                    />
                    <div className={`absolute bottom-0 left-0 right-0 ${isMobile ? 'p-4' : 'p-8'}`}>
                      <YellowNewsBadges article={featured} className="mb-4" size="featured" />
                      <h3
                        className="line-clamp-3 font-bold leading-tight transition-colors group-hover:text-[#FACC15]"
                        style={{
                          fontFamily: 'Rubik, sans-serif',
                          fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
                          color: '#fff',
                        }}
                      >
                        {featured.title}
                      </h3>
                      {featured.published_at && (
                        <p
                          className="mt-3 flex items-center gap-2 text-sm"
                          style={{ color: 'rgba(255,255,255,0.7)' }}
                        >
                          <Calendar size={13} />
                          {formatDate(featured.published_at)}
                        </p>
                      )}
                    </div>
                    <div
                      className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      style={{
                        boxShadow:
                          'inset 0 0 0 2px rgba(250,204,21,0.4), 0 8px 40px rgba(250,204,21,0.15)',
                      }}
                    />
                  </motion.div>
                );
                return isAgg ? (
                  <a href={href} className="block" aria-label={`Read ${featured.title}`}>
                    {cardContent}
                  </a>
                ) : (
                  <Link
                    to={href}
                    className="block"
                    onMouseEnter={() => {
                      const s = featured.slug || String(featured.id);
                      if (s) prefetchArticle(s);
                    }}
                    onFocus={() => {
                      const s = featured.slug || String(featured.id);
                      if (s) prefetchArticle(s);
                    }}
                    onTouchStart={() => {
                      const s = featured.slug || String(featured.id);
                      if (s) prefetchArticle(s);
                    }}
                    onPointerDown={() => {
                      const s = featured.slug || String(featured.id);
                      if (s) prefetchArticle(s);
                    }}
                  >
                    {cardContent}
                  </Link>
                );
              })()}
            </section>
          ) : (
            sliderArticles.length > 0 && (
              <section className="mb-10">
                <div className="mb-6 flex items-center gap-3">
                  <div className="h-8 w-1.5 rounded-full" style={{ background: colors.accent }} />
                  <h2
                    className="font-semibold"
                    style={{
                      fontFamily: 'Rubik, sans-serif',
                      fontSize: '1.5rem',
                      color: colors.text,
                    }}
                  >
                    Top Stories
                  </h2>
                </div>

                {/* Split layout: carousel left + sidebar right */}
                <div
                  className={`flex ${isMobile || isTablet ? 'flex-col' : ''} gap-4`}
                  style={{ height: isMobile || isTablet ? 'auto' : 456 }}
                >
                  {/* LEFT — Main carousel (60%) */}
                  <div
                    className="relative overflow-hidden rounded-2xl"
                    style={{
                      flex: isMobile || isTablet ? 'none' : '0 0 60%',
                      height: isMobile ? 320 : isTablet ? 360 : '100%',
                    }}
                    onMouseEnter={() => setSliderHovered(true)}
                    onMouseLeave={() => setSliderHovered(false)}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {(() => {
                        const slide = sliderArticles[sliderIndex];
                        if (!slide) return null;
                        const isAgg = slide.source_type === 'aggregated';
                        const href =
                          isAgg && slide.source_url
                            ? slide.source_url
                            : slide.slug
                              ? `/news/${slide.slug}`
                              : `/news/${slide.id}`;
                        const inner = (
                          <motion.div
                            key={slide.id}
                            className="group absolute inset-0 cursor-pointer"
                            initial={{ opacity: 0, x: 60 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -60 }}
                            transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
                          >
                            <ArticleImage
                              article={slide}
                              loading="eager"
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                            <div
                              className="absolute inset-0"
                              style={{
                                background:
                                  'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.8))',
                              }}
                            />
                            <div
                              className={`absolute bottom-0 left-0 right-0 ${isMobile ? 'p-4' : 'p-8 pb-12'}`}
                            >
                              <YellowNewsBadges article={slide} className="mb-3" />
                              <h3
                                className="line-clamp-3 font-bold leading-tight transition-colors group-hover:text-[#FACC15]"
                                style={{
                                  fontFamily: 'Rubik, sans-serif',
                                  fontSize: 'clamp(1.25rem, 2.5vw, 2.25rem)',
                                  color: '#fff',
                                }}
                              >
                                {slide.title}
                              </h3>
                              {slide.excerpt && (
                                <p
                                  className="mt-2 line-clamp-2 text-sm"
                                  style={{ color: 'rgba(255,255,255,0.7)' }}
                                >
                                  {slide.excerpt}
                                </p>
                              )}
                              <div
                                className="mt-3 flex items-center gap-3 text-sm"
                                style={{ color: 'rgba(255,255,255,0.6)' }}
                              >
                                {slide.author && <span>{slide.author}</span>}
                                {slide.published_at && (
                                  <span className="flex items-center gap-1">
                                    <Calendar size={13} />
                                    {formatDate(slide.published_at)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div
                              className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                              style={{
                                boxShadow:
                                  'inset 0 0 0 2px rgba(250,204,21,0.4), 0 8px 40px rgba(250,204,21,0.15)',
                              }}
                            />
                          </motion.div>
                        );
                        return isAgg ? (
                          <a
                            href={href}
                            className="absolute inset-0"
                            aria-label={`Read ${slide.title}`}
                          >
                            {inner}
                          </a>
                        ) : (
                          <Link
                            to={href}
                            className="absolute inset-0"
                            onMouseEnter={() => {
                              const s = slide.slug || String(slide.id);
                              if (s) prefetchArticle(s);
                            }}
                            onFocus={() => {
                              const s = slide.slug || String(slide.id);
                              if (s) prefetchArticle(s);
                            }}
                            onTouchStart={() => {
                              const s = slide.slug || String(slide.id);
                              if (s) prefetchArticle(s);
                            }}
                            onPointerDown={() => {
                              const s = slide.slug || String(slide.id);
                              if (s) prefetchArticle(s);
                            }}
                          >
                            {inner}
                          </Link>
                        );
                      })()}
                    </AnimatePresence>

                    {/* Prev / Next arrows — inside carousel */}
                    {sliderArticles.length > 1 && (
                      <>
                        <button
                          onClick={() =>
                            setSliderIndex(
                              (prev) => (prev - 1 + sliderArticles.length) % sliderArticles.length,
                            )
                          }
                          className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full backdrop-blur-md transition-colors hover:bg-white/30"
                          style={{
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.15)',
                          }}
                          aria-label="Previous slide"
                        >
                          <ChevronLeft size={20} color="#fff" />
                        </button>
                        <button
                          onClick={() =>
                            setSliderIndex((prev) => (prev + 1) % sliderArticles.length)
                          }
                          className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full backdrop-blur-md transition-colors hover:bg-white/30"
                          style={{
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.15)',
                          }}
                          aria-label="Next slide"
                        >
                          <ChevronRight size={20} color="#fff" />
                        </button>
                      </>
                    )}

                    {/* Dot indicators — inside carousel at bottom */}
                    {sliderArticles.length > 1 && (
                      <div className="absolute bottom-3 left-0 right-0 z-10 flex items-center justify-center gap-2">
                        {sliderArticles.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setSliderIndex(i)}
                            className="rounded-full transition-all duration-300"
                            style={{
                              width: i === sliderIndex ? 24 : 8,
                              height: 8,
                              background:
                                i === sliderIndex ? colors.accent : 'rgba(255,255,255,0.3)',
                            }}
                            aria-label={`Go to slide ${i + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* RIGHT — Sidebar (38%) */}
                  {sidebarArticles.length > 0 && (
                    <div
                      className="flex flex-col justify-start overflow-hidden rounded-2xl"
                      style={{
                        flex: isMobile || isTablet ? 'none' : '0 0 38%',
                        background: 'rgba(255,255,255,0.08)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      {sidebarArticles.map((article, idx) => {
                        const isAgg = article.source_type === 'aggregated';
                        const href =
                          isAgg && article.source_url
                            ? article.source_url
                            : article.slug
                              ? `/news/${article.slug}`
                              : `/news/${article.id}`;
                        const card = (
                          <div
                            className="flex cursor-pointer gap-3 p-3 transition-colors"
                            style={{
                              borderBottom:
                                idx < sidebarArticles.length - 1
                                  ? '1px solid rgba(255,255,255,0.06)'
                                  : 'none',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(250,204,21,0.05)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <ArticleImage
                              article={article}
                              className="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
                            />
                            <div className="flex min-w-0 flex-1 flex-col justify-center">
                              <h4
                                className="line-clamp-2 text-sm font-semibold leading-snug"
                                style={{ color: colors.text, fontFamily: 'Rubik, sans-serif' }}
                              >
                                {article.title}
                              </h4>
                              {article.published_at && (
                                <span
                                  className="mt-1.5 flex items-center gap-1 text-xs"
                                  style={{ color: colors.textMuted }}
                                >
                                  <Calendar size={11} />
                                  {formatDate(article.published_at)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                        return isAgg ? (
                          <a
                            key={article.id}
                            href={href}
                            className="flex"
                            aria-label={`Read ${article.title}`}
                          >
                            {card}
                          </a>
                        ) : (
                          <Link
                            key={article.id}
                            to={href}
                            className="flex"
                            onMouseEnter={() => {
                              const s = article.slug || String(article.id);
                              if (s) prefetchArticle(s);
                            }}
                            onFocus={() => {
                              const s = article.slug || String(article.id);
                              if (s) prefetchArticle(s);
                            }}
                            onTouchStart={() => {
                              const s = article.slug || String(article.id);
                              if (s) prefetchArticle(s);
                            }}
                            onPointerDown={() => {
                              const s = article.slug || String(article.id);
                              if (s) prefetchArticle(s);
                            }}
                          >
                            {card}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            )
          )}

          {/* Latest Post — 3-column grid */}
          {(paginatedArticles.length > 0 || filteredArticles.length === 0) && (
            <section className="py-8">
              <div className="mb-8 flex items-center gap-3">
                <div className="h-8 w-1.5 rounded-full" style={{ background: colors.accent }} />
                <h2
                  className="font-semibold"
                  style={{
                    fontFamily: 'Rubik, sans-serif',
                    fontSize: '1.5rem',
                    color: colors.text,
                  }}
                >
                  Latest Post
                </h2>
              </div>

              <motion.div
                key={`${activeSection}-${currentPage}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {paginatedArticles.length > 0 ? (
                  <motion.div
                    className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                  >
                    {paginatedArticles.map((article, i) => (
                      <StoryCard
                        key={article.id}
                        article={article}
                        isBookmarked={bookmarkedIds.has(String(article.id))}
                        onToggleBookmark={toggleBookmark}
                        index={i}
                      />
                    ))}
                  </motion.div>
                ) : (
                  <div
                    className="rounded-2xl border border-dashed py-20 text-center"
                    style={{
                      borderColor: colors.border,
                      background: NEWS_T.glassSubtle,
                      backdropFilter: 'blur(16px)',
                    }}
                  >
                    <p style={{ color: colors.textSecondary }}>
                      No articles found in this category.
                    </p>
                    <button
                      onClick={() => handleCategoryChange('street-voices')}
                      className="mt-4 px-4 py-2 text-sm font-medium hover:underline"
                      style={{ color: colors.accent }}
                    >
                      View Street Voices articles
                    </button>
                  </div>
                )}
              </motion.div>

              <StreetPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                colors={colors}
                marginTop={40}
              />
            </section>
          )}
        </div>
      </div>

      <SiteFooter />
      <AuthPopupModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialTab="login"
      />
    </div>
  );
}

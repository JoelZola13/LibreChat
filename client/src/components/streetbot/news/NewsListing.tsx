import { useEffect, useState, useCallback, useContext, useMemo, useRef, memo } from "react";
import { isDarkTheme, useTheme } from '../shared/theme-provider';
import { ThemeContext } from '../shared/theme-provider';
import { useOutletContext } from "react-router-dom";
import type { ContextType } from '~/common';
import { isDirectory } from '~/config/appVariant';
import SiteFooter from "~/components/Chat/SiteFooter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  PenSquare,
  Search as SearchIcon,
  X as XIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { SB_API_BASE } from "~/components/streetbot/shared/apiConfig";
import { prefetchNews, getPrefetchedSync } from './newsPrefetch';
import { useGlassStyles } from '../shared/useGlassStyles';
import { useAuthContext } from '~/hooks';
import { useUserRole } from '../lib/auth/useUserRole';
import { useActiveUser } from '../shared/useActiveUser';
import { useResponsive } from '../hooks/useResponsive';
import MobileMenuDrawer, { getMobileNavLinkStyle, getMobileDividerStyle, HamburgerButton } from '../shared/MobileMenuDrawer';
import AuthPopupModal from '../shared/AuthPopupModal';
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

/* ─── StoryCard ─── */
interface StoryCardProps {
  article: Article;
  variant?: "default" | "large";
  isBookmarked?: boolean;
  onToggleBookmark?: (articleId: string) => void;
  index?: number;
}

const StoryCard: React.FC<StoryCardProps> = memo(({
  article,
  variant = "default",
  isBookmarked = false,
  onToggleBookmark,
  index = 0,
}) => {
  const { isDark, colors } = useGlassStyles();
  const [imgSrc, setImgSrc] = useState(article.image_url || FALLBACK_IMAGE);
  const isAggregated = article.source_type === "aggregated";
  const href =
    isAggregated && article.source_url
      ? article.source_url
      : article.slug
        ? `/news/${article.slug}`
        : `/news/${article.id}`;
  const linkTarget = isAggregated ? "_blank" : undefined;
  const linkRel = isAggregated ? "noopener noreferrer" : undefined;
  const canBookmark = Boolean(onToggleBookmark) && !isAggregated;
  const articleRef = article.slug || String(article.id);
  const primeArticle = () => {
    if (!isAggregated && articleRef) {
      prefetchArticle(articleRef);
    }
  };

  const aspectClass = variant === "large" ? "aspect-[16/9]" : "aspect-[16/10]";
  const titleClamp = variant === "large" ? "line-clamp-3" : "line-clamp-2";

  const inner = (
    <>
      {/* Image */}
      <div className={`relative overflow-hidden ${aspectClass} bg-stone-900`}>
        <motion.img
          src={imgSrc}
          alt={article.title}
          loading={index === 0 ? "eager" : "lazy"}
          width={600}
          height={375}
          onError={() => setImgSrc(FALLBACK_IMAGE)}
          onLoad={(e) => { if ((e.target as HTMLImageElement).naturalWidth === 0) setImgSrc(FALLBACK_IMAGE); }}
          className="absolute inset-0 w-full h-full object-cover"
          whileHover={{ scale: 1.1 }}
          transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0C0A09]/60 via-transparent to-transparent" />
        {article.category && (
          <span
            className={`absolute top-3 left-3 px-3 py-1 text-xs font-medium uppercase tracking-wider rounded-full backdrop-blur-md ${
              isDark
                ? 'bg-black/50 border border-white/10 text-[#A8A29E]'
                : 'bg-white/80 border border-black/10 text-gray-600'
            }`}
          >
            {article.category}
          </span>
        )}
        {/* Read Article overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="px-4 py-2 rounded-full bg-[#FACC15] text-[#0C0A09] text-sm font-semibold flex items-center gap-2">
            Read Article <ArrowRight size={14} />
          </span>
        </div>
      </div>
      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <h3
          className={`font-semibold leading-snug mb-2 transition-colors duration-200 group-hover:text-[#FACC15] ${titleClamp}`}
          style={{ fontFamily: "Rubik, sans-serif", color: colors.text, fontSize: variant === "large" ? "1.25rem" : "1rem" }}
        >
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="text-sm mb-4 line-clamp-2 leading-relaxed" style={{ color: colors.textSecondary }}>
            {article.excerpt}
          </p>
        )}
        <div
          className="mt-auto flex items-center gap-3 text-xs pt-3 border-t"
          style={{ color: colors.textMuted, borderColor: colors.border }}
        >
          {/* Author initials */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
            style={{ background: "rgba(250,204,21,0.15)", color: colors.accent }}
          >
            {getInitials(article.author)}
          </div>
          <span style={{ color: colors.textSecondary }}>{article.author || "Staff"}</span>
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
      className={`group relative flex flex-col overflow-hidden rounded-2xl backdrop-blur-xl transition-all duration-500 h-full ${
        isDark
          ? 'bg-black/50 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:border-yellow-400/50 hover:shadow-[0_8px_40px_rgba(250,204,21,0.2)] hover:bg-black/60'
          : 'bg-white border border-yellow-300/60 shadow-[0_4px_24px_rgba(0,0,0,0.06)] hover:border-yellow-400 hover:shadow-[0_8px_32px_rgba(250,204,21,0.15)]'
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
          className="absolute top-3 right-3 z-20 inline-flex items-center justify-center w-9 h-9 rounded-full backdrop-blur-md border transition-colors"
          style={{
            borderColor: colors.border,
            background: isBookmarked ? colors.accent : isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.8)",
            color: isBookmarked ? NEWS_T.bgDeep : isDark ? "#fff" : "#666",
          }}
          aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}
        >
          <Bookmark size={15} fill={isBookmarked ? "currentColor" : "none"} />
        </button>
      )}
      {isAggregated && article.source_url ? (
        <a href={href} target={linkTarget} rel={linkRel} className="flex flex-col h-full">
          {inner}
        </a>
      ) : (
        <Link to={href} target={linkTarget} rel={linkRel ?? undefined} className="flex flex-col h-full"
          onMouseEnter={primeArticle}
          onFocus={primeArticle}
          onTouchStart={primeArticle}
          onPointerDown={primeArticle}>
          {inner}
        </Link>
      )}
    </motion.article>
  );
});

StoryCard.displayName = "StoryCard";

/* ─── PaginationBar ─── */
interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const generatePageNumbers = (current: number, total: number): (number | "...")[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
};

const PaginationBar: React.FC<PaginationBarProps> = ({ currentPage, totalPages, onPageChange }) => {
  const { isDark, colors } = useGlassStyles();
  if (totalPages <= 1) return null;
  const pages = generatePageNumbers(currentPage, totalPages);
  const btnBg = isDark ? NEWS_T.glassMedium : 'rgba(0,0,0,0.08)';
  const pillBg = isDark ? NEWS_T.glassSubtle : 'rgba(0,0,0,0.04)';

  return (
    <div className="flex items-center justify-center gap-2 pt-10">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="w-10 h-10 rounded-full flex items-center justify-center border transition-colors disabled:opacity-30"
        style={{ background: btnBg, borderColor: colors.border, color: colors.text }}
      >
        <ChevronLeft size={18} />
      </button>

      <div
        className="flex items-center gap-1 px-2 py-1 rounded-full"
        style={{ background: pillBg, backdropFilter: "blur(20px)", border: `1px solid ${colors.border}` }}
      >
        <AnimatePresence mode="popLayout">
          {pages.map((page, i) =>
            page === "..." ? (
              <span key={`ellipsis-${i}`} className="w-10 h-10 flex items-center justify-center text-sm" style={{ color: colors.textMuted }}>
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className="relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors"
                style={{
                  color: page === currentPage ? NEWS_T.bgDeep : colors.textSecondary,
                  fontWeight: page === currentPage ? 700 : 500,
                }}
              >
                {page === currentPage && (
                  <motion.span
                    layoutId="active-page"
                    className="absolute inset-0 rounded-full"
                    style={{ background: colors.accent, zIndex: -1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                {page}
              </button>
            ),
          )}
        </AnimatePresence>
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="w-10 h-10 rounded-full flex items-center justify-center border transition-colors disabled:opacity-30"
        style={{ background: btnBg, borderColor: colors.border, color: colors.text }}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
};

/* ─── NewsPageHeader (React.memo — stops re-renders on article/pagination changes) ─── */
interface NewsPageHeaderProps {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  navLeft: number;
  dark: boolean;
  navTextColor: string;
  authUser: ReturnType<typeof useAuthContext>["user"];
  canEditNews: boolean;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  setAuthModalOpen: (open: boolean) => void;
  sessionResolved: boolean;
  toggleTheme: () => void;
  sections: { id: SectionId; label: string }[];
  activeSection: SectionId;
  onCategoryChange: (id: SectionId) => void;
  colors: ReturnType<typeof useGlassStyles>["colors"];
}

const NewsPageHeader = memo<NewsPageHeaderProps>(({
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
  const [localSearch, setLocalSearch] = useState("");
  const [localCity, setLocalCity] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const showMobileSearchHeader = isMobile && mobileSearchOpen;
  const mobileSearchBarHeight = 50;
  const mobileSearchButtonSize = 40;
  const mobileSearchButtonInset = 5;
  const mobileSearchInputPadding = 20;
  const newsSearchPrimaryBg = dark ? "rgba(63,66,84,0.62)" : "#fff";
  const newsSearchSecondaryBg = dark ? "rgba(124,129,152,0.5)" : "#D9D9D9";
  const directoryLogoSrc = dark ? "/assets/streetvoices-text.svg" : "/assets/streetvoices-text-dark.svg";

  useEffect(() => {
    if (!isMobile && mobileSearchOpen) {
      setMobileSearchOpen(false);
    }
  }, [isMobile, mobileSearchOpen]);

  useEffect(() => {
    setAvatarLoadError(false);
  }, [(authUser as any)?.avatar]);

  const handleMobileSearch = () => {
    const params = new URLSearchParams();
    if (localSearch) params.set("q", localSearch);
    if (localCity) params.set("city", localCity);
    navigate(`/directory${params.toString() ? `?${params}` : ""}`);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleMobileSearch();
  };

  return (
  <>
    <style>{`
      @media (max-width: 767px) {
        .sv-news-mobile-search-input {
          color: #000 !important;
          -webkit-text-fill-color: #000 !important;
          caret-color: #000 !important;
        }
        .sv-news-mobile-search-input::placeholder {
          color: #000 !important;
          opacity: 1;
        }
      }
    `}</style>
    {/* Site Nav */}
    <div
      className="relative z-20"
      style={{
        position: "fixed",
        top: 0,
        left: (isMobile || isTablet) ? 0 : navLeft,
        right: 0,
        background: "transparent",
        backdropFilter: "blur(40px)",
        WebkitBackdropFilter: "blur(40px)",
        padding: showMobileSearchHeader ? "0 15px" : isMobile ? "0 24px" : isTablet ? "0 16px" : "0 24px",
        height: isMobile ? 71 : isTablet ? 62 : 70,
        display: "flex",
        alignItems: "center",
        transition: "left 0.2s ease-out",
      }}
    >
      {!showMobileSearchHeader && (
        <Link to="/home" style={{ flexShrink: 0, marginRight: isMobile ? 10 : 24 }}>
          <img
            src={directoryLogoSrc}
            alt="Street Voices"
            style={{ height: isMobile ? 50 : isTablet ? 40 : 50, maxWidth: isMobile ? 140 : isTablet ? 150 : 190 }}
          />
        </Link>
      )}

      {!isDesktop ? (
        <>
          {(!isMobile || mobileSearchOpen) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flex: 1,
                minWidth: 0,
                marginLeft: 0,
                marginRight: 0,
                height: mobileSearchBarHeight,
                overflow: "visible",
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flex: 1,
                  minWidth: 0,
                  height: "100%",
                  background: newsSearchPrimaryBg,
                  borderRadius: 30,
                  boxShadow: dark ? "none" : "0 0 10px rgba(0, 0, 0, 0.05)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {/* Search input */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flex: 1,
                    minWidth: 0,
                    height: "100%",
                    background: newsSearchPrimaryBg,
                    borderRadius: "30px 0 0 30px",
                    padding: `0 ${mobileSearchInputPadding}px`,
                  }}
                >
                  <input
                    type="text"
                    className="sv-search-input sv-mobile-search-input sv-news-mobile-search-input"
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search for service"
                    style={{
                      width: "100%",
                      minWidth: 0,
                      height: "100%",
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      color: "#000",
                      fontSize: 16,
                      fontWeight: 400,
                      lineHeight: "50px",
                      outline: "none",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
                {/* City input */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flex: 1,
                    minWidth: 0,
                    height: "100%",
                    background: newsSearchSecondaryBg,
                    borderRadius: "0 30px 30px 0",
                    padding: `0 ${mobileSearchInputPadding}px`,
                  }}
                >
                  <input
                    type="text"
                    className="sv-search-input sv-mobile-search-input sv-news-mobile-search-input"
                    value={localCity}
                    onChange={(e) => setLocalCity(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="City"
                    style={{
                      width: "100%",
                      minWidth: 0,
                      height: "100%",
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      color: "#000",
                      fontSize: 16,
                      fontWeight: 600,
                      lineHeight: "50px",
                      outline: "none",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
                {/* Search button */}
                <button
                  onClick={handleMobileSearch}
                  aria-label="Search directory"
                  style={{
                    position: "absolute",
                    top: mobileSearchButtonInset,
                    right: mobileSearchButtonInset,
                    height: mobileSearchButtonSize,
                    width: mobileSearchButtonSize,
                    borderRadius: 25,
                    border: "none",
                    background: "#FFD600",
                    color: "#000",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    flexShrink: 0,
                    zIndex: 1,
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
                    border: "none",
                    background: "none",
                    color: dark ? "#FFD600" : "#2D2D2D",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    width: 16,
                    height: 16,
                  }}
                >
                  <XIcon size={16} />
                </button>
              )}
            </div>
          )}
          {isMobile && !mobileSearchOpen && <div style={{ flex: 1 }} />}
          {authUser && (!isMobile || !mobileSearchOpen) && (
            <Link
              to="/settings"
              aria-label="Profile"
              style={{ display: "inline-flex", alignItems: "center", marginRight: 8 }}
            >
              {(authUser as any).avatar && !avatarLoadError ? (
                <img
                  src={(authUser as any).avatar}
                  alt={(authUser as any).name || "Profile"}
                  style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
                  onError={() => setAvatarLoadError(true)}
                />
              ) : (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "#7c3aed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {(authUser as any).name?.charAt(0)?.toUpperCase() || (authUser as any).username?.charAt(0)?.toUpperCase() || "?"}
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
                borderRadius: "50%",
                border: "none",
                background: "none",
                color: dark ? "#fff" : "#1a1c24",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
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
            <Link to="/directory" style={getMobileNavLinkStyle(dark)} onClick={() => setMobileNavOpen(false)}>Directory</Link>
            <a href="https://airtable.com/appBQoHCfq4nfspKj/shrVEiMPGLqetHMfw" target="_blank" rel="noopener noreferrer" style={getMobileNavLinkStyle(dark)} onClick={() => setMobileNavOpen(false)}>Programs</a>
            <Link to="/news" style={getMobileNavLinkStyle(dark)} onClick={() => setMobileNavOpen(false)}>News</Link>
            <Link to="/about" style={{...getMobileNavLinkStyle(dark), borderBottom: 'none'}} onClick={() => setMobileNavOpen(false)}>About Us</Link>
            <div style={getMobileDividerStyle(dark)} />
            {!authUser && sessionResolved && (
              <button
                onClick={() => { setMobileNavOpen(false); setAuthModalOpen(true); }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "13px 16px",
                  color: dark ? "#E6E7F2" : "#1f2937",
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: "Rubik, sans-serif",
                  textAlign: "center",
                  borderRadius: 10,
                  background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                  border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
                  marginBottom: 10,
                  cursor: "pointer",
                  letterSpacing: "0.01em",
                }}
              >
                Login
              </button>
            )}
            <a
              href="/donate"
              onClick={() => setMobileNavOpen(false)}
              style={{
                display: "block",
                padding: "13px 16px",
                color: "#000",
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "Rubik, sans-serif",
                textDecoration: "none",
                textAlign: "center",
                borderRadius: 10,
                background: "#FFD600",
                letterSpacing: "0.01em",
              }}
            >
              Donate
            </a>
              </MobileMenuDrawer>
            </>
          )}
        </>
      ) : (
        <>
          {/* Search bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flex: 1,
              maxWidth: isLargeDesktop ? 540 : 400,
              overflow: "visible",
              height: 40,
              position: "relative",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", flex: 3, height: "100%", background: newsSearchPrimaryBg, borderRadius: "30px 0 0 30px" }}>
              <input
                type="text"
                className="sv-search-input"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search for service"
                style={{
                  width: "100%",
                  height: "100%",
                  padding: "0 0 0 18px",
                  border: "none",
                  background: "transparent",
                  color: "#000",
                  fontSize: 13,
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", flex: 2, height: "100%", background: newsSearchSecondaryBg, borderRadius: "0 30px 30px 0", paddingRight: 60, marginRight: -60 }}>
              <input
                type="text"
                className="sv-search-input"
                value={localCity}
                onChange={(e) => setLocalCity(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="City"
                style={{
                  width: "100%",
                  height: "100%",
                  padding: "0 14px",
                  border: "none",
                  background: "transparent",
                  color: "#000",
                  fontSize: 13,
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
            </div>
            <button
              onClick={handleMobileSearch}
              style={{
                height: "100%",
                padding: "0 24px",
                borderRadius: 30,
                border: "none",
                background: "#FFD600",
                color: "#000",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                cursor: "pointer",
                flexShrink: 0,
                position: "relative",
                zIndex: 1,
              }}
            >
              Search
            </button>
          </div>

          <nav style={{ display: "flex", alignItems: "center", gap: isLargeDesktop ? 16 : 8, marginLeft: "auto" }}>
            <Link to="/directory" style={{ color: navTextColor, fontSize: isLargeDesktop ? 15 : 13, textDecoration: "none", fontFamily: "Rubik, sans-serif", whiteSpace: "nowrap" }}>Directory</Link>
            <a href="https://airtable.com/appBQoHCfq4nfspKj/shrVEiMPGLqetHMfw" target="_blank" rel="noopener noreferrer" style={{ color: navTextColor, fontSize: isLargeDesktop ? 15 : 13, textDecoration: "none", fontFamily: "Rubik, sans-serif", whiteSpace: "nowrap" }}>Programs</a>
            <Link to="/news" style={{ color: navTextColor, fontSize: isLargeDesktop ? 15 : 13, textDecoration: "none", fontFamily: "Rubik, sans-serif", whiteSpace: "nowrap" }}>News</Link>
            <Link to="/about" style={{ color: navTextColor, fontSize: isLargeDesktop ? 15 : 13, textDecoration: "none", fontFamily: "Rubik, sans-serif", whiteSpace: "nowrap" }}>About Us</Link>
            {!authUser && sessionResolved && (
              <button
                onClick={() => setAuthModalOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: isLargeDesktop ? 40 : 34,
                  padding: isLargeDesktop ? "0 22px" : "0 14px",
                  borderRadius: 50,
                  border: "2px solid #FFD600",
                  background: "transparent",
                  color: navTextColor,
                  fontSize: isLargeDesktop ? 15 : 13,
                  fontWeight: 600,
                  fontFamily: "Rubik, sans-serif",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                Login
              </button>
            )}
            <a
              href="/donate"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: isLargeDesktop ? 40 : 34,
                padding: isLargeDesktop ? "0 22px" : "0 14px",
                borderRadius: 50,
                border: "none",
                background: "#FFD600",
                color: "#000",
                fontSize: isLargeDesktop ? 15 : 13,
                fontWeight: 600,
                textDecoration: "none",
                fontFamily: "Rubik, sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              Donate
            </a>
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: isLargeDesktop ? 36 : 30,
                height: isLargeDesktop ? 36 : 30,
                borderRadius: "50%",
                border: "none",
                background: "none",
                color: navTextColor,
                cursor: "pointer",
                flexShrink: 0,
              }}
              aria-label="Toggle theme"
            >
              {dark ? (
                <svg width={isLargeDesktop ? 18 : 16} height={isLargeDesktop ? 18 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width={isLargeDesktop ? 18 : 16} height={isLargeDesktop ? 18 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            {/* Profile avatar */}
            {authUser && (
              <Link
                to="/settings"
                aria-label="Profile"
                style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
              >
                {authUser.avatar && !avatarLoadError ? (
                  <img
                    src={authUser.avatar}
                    alt={authUser.name || "Profile"}
                    style={{ width: isLargeDesktop ? 32 : 28, height: isLargeDesktop ? 32 : 28, borderRadius: "50%", objectFit: "cover" }}
                    onError={() => setAvatarLoadError(true)}
                  />
                ) : (
                  <div
                    style={{
                      width: isLargeDesktop ? 32 : 28,
                      height: isLargeDesktop ? 32 : 28,
                      borderRadius: "50%",
                      background: "#7c3aed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: isLargeDesktop ? 12 : 10,
                      fontWeight: 700,
                    }}
                  >
                    {authUser.name?.charAt(0)?.toUpperCase() || authUser.username?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}
              </Link>
            )}
          </nav>
        </>
      )}
    </div>

    {/* Page Title + Create button */}
    <motion.div
      className="py-8 flex items-center justify-center gap-4"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
    >
      <h1
        className="font-bold"
        style={{
          fontFamily: "Rubik, sans-serif",
          fontSize: "clamp(2rem, 5vw, 3rem)",
          color: colors.text,
        }}
      >
        News
      </h1>
      {canEditNews && (
        <Link
          to="/news/editor"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 hover:scale-105"
          style={{
            background: colors.accent,
            color: "#0C0A09",
            boxShadow: "0 4px 14px rgba(250,204,21,0.4)",
          }}
        >
          <PenSquare size={15} />
          Create Article
        </Link>
      )}
    </motion.div>

    {/* Category Tabs */}
    <nav
      className={`flex items-center ${isMobile ? 'gap-0.5 justify-center' : 'gap-1 justify-center'} overflow-x-auto pb-2`}
      aria-label="News categories"
      style={{ scrollbarWidth: "none" }}
    >
      {sections.map((section) => {
        const isActive = section.id === activeSection;
        const tabClassName = isMobile
          ? "relative px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-all duration-200 rounded-lg"
          : "relative px-4 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200 rounded-lg";
        return (
          <button
            key={section.id}
            onClick={() => onCategoryChange(section.id)}
            className={tabClassName}
            style={{
              color: isActive ? colors.accent : colors.textSecondary,
              background: isActive ? "rgba(250,204,21,0.1)" : "transparent",
            }}
          >
            {isActive && (
              <motion.span
                layoutId="active-news-tab"
                className="absolute inset-0 rounded-lg"
                style={{
                  background: "rgba(250,204,21,0.1)",
                  border: `1px solid rgba(250,204,21,0.3)`,
                  zIndex: -1,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            {section.label}
          </button>
        );
      })}
    </nav>

    {/* Divider */}
    <div
      className="h-px my-4"
      style={{
        background: `linear-gradient(to right, transparent, ${colors.border}, transparent)`,
      }}
    />
  </>
  );
});

NewsPageHeader.displayName = "NewsPageHeader";

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
  const { navVisible } = (useOutletContext<ContextType>() ?? { navVisible: false });
  const sidebarMinimized = JSON.parse(localStorage.getItem('sidebarMinimized') ?? 'true');
  const navLeft = (isMobile || isTablet) ? 0 : isDirectory ? 0 : navVisible ? (sidebarMinimized ? 80 : 275) : 0;

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
  const [activeSection, setActiveSection] = useState<SectionId>("all");
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
        sessionStorage.setItem("streetbot:postLoginRedirect", "/news");
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
            { method: "DELETE" },
          );
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        } else {
          const resp = await fetch(`${SB_API_BASE}/news/articles/${encodeURIComponent(articleId)}/bookmark`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId }),
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        }

        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          if (isSaved) next.delete(articleId);
          else next.add(articleId);
          return next;
        });
      } catch (error) {
        console.error("Failed to toggle bookmark:", error);
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
            setBookmarkedIds(new Set(bookmarksData.map((a: { id?: string | number }) => String(a?.id))));
          }
        })
        .catch(() => {});
    }

    return () => { cancelled = true; };
  }, []);

  // Memoized filter function
  const filterBySection = useCallback((article: Article) => {
    if (activeSection === "all") return true;
    const cats = (article.categories || []).map(c => c.toLowerCase());
    const legacyCat = article.category?.toLowerCase() || "";
    if (legacyCat) cats.push(legacyCat);
    const allCatsStr = cats.join(' ');
    if (activeSection === "street-voices") {
      return article.source_type === "internal" && allCatsStr.includes("street");
    }
    const categoryMap: Record<string, string[]> = {
      local: ["local", "toronto", "ontario", "gta"],
      national: ["national", "canada", "canadian"],
      international: ["international", "world", "global"],
    };
    const matchCategories = categoryMap[activeSection] || [activeSection];
    // Use word-boundary matching to avoid "national" matching "international"
    return matchCategories.some((cat) => {
      const regex = new RegExp(`\\b${cat}\\b`, 'i');
      return regex.test(allCatsStr);
    });
  }, [activeSection]);

  const sections: { id: SectionId; label: string }[] = [
    { id: "street-voices", label: "Street Voices" },
    { id: "local", label: "Local" },
    { id: "national", label: "National" },
    { id: "international", label: "International" },
  ];

  /* ── Derived article slices ── */
  const filteredArticles = useMemo(() => articles.filter(filterBySection), [articles, filterBySection]);

  const isFeaturedView = activeSection === "all" || activeSection === "street-voices";

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
        <div className="relative z-10 min-h-[60vh] flex items-center justify-center">
          <div
            className="text-center p-8 rounded-2xl"
            style={{
              background: NEWS_T.glassSubtle,
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: `1px solid ${colors.border}`,
            }}
          >
            <div
              className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
              style={{ borderColor: colors.accent, borderTopColor: "transparent" }}
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
        <div className="relative z-10 min-h-[60vh] flex items-center justify-center">
          <div
            className="text-center max-w-md p-8 rounded-2xl"
            style={{
              background: NEWS_T.glassSubtle,
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: `1px solid ${colors.border}`,
            }}
          >
            <div className="text-6xl mb-4">&#9888;&#65039;</div>
            <h2 className="text-xl font-bold mb-2" style={{ color: colors.text }}>
              Failed to load news
            </h2>
            <p className="mb-4" style={{ color: colors.textSecondary }}>
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-full font-medium transition-all duration-200 hover:scale-105"
              style={{ background: colors.accent, color: NEWS_T.bgDeep, boxShadow: "0 4px 14px rgba(250,204,21,0.4)" }}
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

        <div className="relative z-10 max-w-[1200px] mx-auto px-4" style={{ paddingTop: isMobile ? 85 : 70 }}>
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
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1.5 h-8 rounded-full" style={{ background: colors.accent }} />
                <h2
                  className="font-semibold"
                  style={{ fontFamily: "Rubik, sans-serif", fontSize: "1.5rem", color: colors.text }}
                >
                  Featured News
                </h2>
              </div>

              {(() => {
                const isAgg = featured.source_type === "aggregated";
                const href = isAgg && featured.source_url
                  ? featured.source_url
                  : featured.slug ? `/news/${featured.slug}` : `/news/${featured.id}`;
                const cardContent = (
                  <motion.div
                    className="relative w-full rounded-2xl overflow-hidden group cursor-pointer"
                    style={{ height: isMobile ? 300 : isTablet ? 380 : 456 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
                    whileHover={{ scale: 1.005 }}
                  >
                    <motion.img
                      src={featured.image_url || FALLBACK_IMAGE}
                      alt={featured.title}
                      loading="eager"
                      width={1200}
                      height={456}
                      onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                      onLoad={(e) => { if ((e.target as HTMLImageElement).naturalWidth === 0) (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                      className="absolute inset-0 w-full h-full object-cover"
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.8, ease: EASE_OUT_EXPO }}
                    />
                    <div
                      className="absolute inset-0"
                      style={{ background: "linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.7))" }}
                    />
                    <div className={`absolute bottom-0 left-0 right-0 ${isMobile ? 'p-4' : 'p-8'}`}>
                      {featured.category && (
                        <span
                          className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full mb-4"
                          style={{ background: colors.accent, color: NEWS_T.bgDeep }}
                        >
                          {featured.category}
                        </span>
                      )}
                      <h3
                        className="font-bold leading-tight line-clamp-3 transition-colors group-hover:text-[#FACC15]"
                        style={{ fontFamily: "Rubik, sans-serif", fontSize: "clamp(1.5rem, 3vw, 2.5rem)", color: "#fff" }}
                      >
                        {featured.title}
                      </h3>
                      {featured.published_at && (
                        <p className="mt-3 text-sm flex items-center gap-2" style={{ color: "rgba(255,255,255,0.7)" }}>
                          <Calendar size={13} />
                          {formatDate(featured.published_at)}
                        </p>
                      )}
                    </div>
                    <div
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                      style={{ boxShadow: "inset 0 0 0 2px rgba(250,204,21,0.4), 0 8px 40px rgba(250,204,21,0.15)" }}
                    />
                  </motion.div>
                );
                return isAgg ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="block">{cardContent}</a>
                ) : (
                  <Link
                    to={href}
                    className="block"
                    onMouseEnter={() => { const s = featured.slug || String(featured.id); if (s) prefetchArticle(s); }}
                    onFocus={() => { const s = featured.slug || String(featured.id); if (s) prefetchArticle(s); }}
                    onTouchStart={() => { const s = featured.slug || String(featured.id); if (s) prefetchArticle(s); }}
                    onPointerDown={() => { const s = featured.slug || String(featured.id); if (s) prefetchArticle(s); }}
                  >
                    {cardContent}
                  </Link>
                );
              })()}
            </section>
          ) : sliderArticles.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1.5 h-8 rounded-full" style={{ background: colors.accent }} />
                <h2
                  className="font-semibold"
                  style={{ fontFamily: "Rubik, sans-serif", fontSize: "1.5rem", color: colors.text }}
                >
                  Top Stories
                </h2>
              </div>

              {/* Split layout: carousel left + sidebar right */}
              <div className={`flex ${(isMobile || isTablet) ? 'flex-col' : ''} gap-4`} style={{ height: (isMobile || isTablet) ? 'auto' : 456 }}>

                {/* LEFT — Main carousel (60%) */}
                <div
                  className="relative rounded-2xl overflow-hidden"
                  style={{ flex: (isMobile || isTablet) ? 'none' : '0 0 60%', height: isMobile ? 320 : isTablet ? 360 : '100%' }}
                  onMouseEnter={() => setSliderHovered(true)}
                  onMouseLeave={() => setSliderHovered(false)}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {(() => {
                      const slide = sliderArticles[sliderIndex];
                      if (!slide) return null;
                      const isAgg = slide.source_type === "aggregated";
                      const href = isAgg && slide.source_url
                        ? slide.source_url
                        : slide.slug ? `/news/${slide.slug}` : `/news/${slide.id}`;
                      const inner = (
                        <motion.div
                          key={slide.id}
                          className="absolute inset-0 group cursor-pointer"
                          initial={{ opacity: 0, x: 60 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -60 }}
                          transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
                        >
                          <img
                            src={slide.image_url || FALLBACK_IMAGE}
                            alt={slide.title}
                            loading="eager"
                            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                          <div
                            className="absolute inset-0"
                            style={{ background: "linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.8))" }}
                          />
                          <div className={`absolute bottom-0 left-0 right-0 ${isMobile ? 'p-4' : 'p-8 pb-12'}`}>
                            {slide.category && (
                              <span
                                className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full mb-3"
                                style={{ background: colors.accent, color: NEWS_T.bgDeep }}
                              >
                                {slide.category}
                              </span>
                            )}
                            <h3
                              className="font-bold leading-tight line-clamp-3 transition-colors group-hover:text-[#FACC15]"
                              style={{ fontFamily: "Rubik, sans-serif", fontSize: "clamp(1.25rem, 2.5vw, 2.25rem)", color: "#fff" }}
                            >
                              {slide.title}
                            </h3>
                            {slide.excerpt && (
                              <p className="mt-2 text-sm line-clamp-2" style={{ color: "rgba(255,255,255,0.7)" }}>
                                {slide.excerpt}
                              </p>
                            )}
                            <div className="mt-3 flex items-center gap-3 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
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
                            className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                            style={{ boxShadow: "inset 0 0 0 2px rgba(250,204,21,0.4), 0 8px 40px rgba(250,204,21,0.15)" }}
                          />
                        </motion.div>
                      );
                      return isAgg ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="absolute inset-0">{inner}</a>
                      ) : (
                        <Link
                          to={href}
                          className="absolute inset-0"
                          onMouseEnter={() => { const s = slide.slug || String(slide.id); if (s) prefetchArticle(s); }}
                          onFocus={() => { const s = slide.slug || String(slide.id); if (s) prefetchArticle(s); }}
                          onTouchStart={() => { const s = slide.slug || String(slide.id); if (s) prefetchArticle(s); }}
                          onPointerDown={() => { const s = slide.slug || String(slide.id); if (s) prefetchArticle(s); }}
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
                        onClick={() => setSliderIndex((prev) => (prev - 1 + sliderArticles.length) % sliderArticles.length)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-10 h-10 rounded-full backdrop-blur-md transition-colors hover:bg-white/30"
                        style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.15)" }}
                        aria-label="Previous slide"
                      >
                        <ChevronLeft size={20} color="#fff" />
                      </button>
                      <button
                        onClick={() => setSliderIndex((prev) => (prev + 1) % sliderArticles.length)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-10 h-10 rounded-full backdrop-blur-md transition-colors hover:bg-white/30"
                        style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.15)" }}
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
                            background: i === sliderIndex ? colors.accent : "rgba(255,255,255,0.3)",
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
                    className="flex flex-col justify-start rounded-2xl overflow-hidden"
                    style={{
                      flex: (isMobile || isTablet) ? 'none' : '0 0 38%',
                      background: 'rgba(255,255,255,0.08)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {sidebarArticles.map((article, idx) => {
                      const isAgg = article.source_type === "aggregated";
                      const href = isAgg && article.source_url
                        ? article.source_url
                        : article.slug ? `/news/${article.slug}` : `/news/${article.id}`;
                      const card = (
                        <div
                          className="flex gap-3 p-3 transition-colors cursor-pointer"
                          style={{
                            borderBottom: idx < sidebarArticles.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(250,204,21,0.05)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <img
                            src={article.image_url || FALLBACK_IMAGE}
                            alt={article.title}
                            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                            className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                          />
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <h4
                              className="font-semibold text-sm leading-snug line-clamp-2"
                              style={{ color: colors.text, fontFamily: "Rubik, sans-serif" }}
                            >
                              {article.title}
                            </h4>
                            {article.published_at && (
                              <span className="flex items-center gap-1 text-xs mt-1.5" style={{ color: colors.textMuted }}>
                                <Calendar size={11} />
                                {formatDate(article.published_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                      return isAgg ? (
                        <a key={article.id} href={href} target="_blank" rel="noopener noreferrer" className="flex">{card}</a>
                      ) : (
                        <Link
                          key={article.id}
                          to={href}
                          className="flex"
                          onMouseEnter={() => { const s = article.slug || String(article.id); if (s) prefetchArticle(s); }}
                          onFocus={() => { const s = article.slug || String(article.id); if (s) prefetchArticle(s); }}
                          onTouchStart={() => { const s = article.slug || String(article.id); if (s) prefetchArticle(s); }}
                          onPointerDown={() => { const s = article.slug || String(article.id); if (s) prefetchArticle(s); }}
                        >
                          {card}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Latest Post — 3-column grid */}
          <section className="py-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-1.5 h-8 rounded-full" style={{ background: colors.accent }} />
              <h2
                className="font-semibold"
                style={{ fontFamily: "Rubik, sans-serif", fontSize: "1.5rem", color: colors.text }}
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
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
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
                  className="text-center py-20 rounded-2xl border border-dashed"
                  style={{ borderColor: colors.border, background: NEWS_T.glassSubtle, backdropFilter: "blur(16px)" }}
                >
                  <p style={{ color: colors.textSecondary }}>No articles found in this category.</p>
                  <button
                    onClick={() => handleCategoryChange("street-voices")}
                    className="mt-4 px-4 py-2 text-sm font-medium hover:underline"
                    style={{ color: colors.accent }}
                  >
                      View Street Voices articles
                    </button>
                  </div>
                )}
            </motion.div>

            <PaginationBar currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </section>
        </div>
      </div>

      <SiteFooter />
      <AuthPopupModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} initialTab="login" />
    </div>
  );
}

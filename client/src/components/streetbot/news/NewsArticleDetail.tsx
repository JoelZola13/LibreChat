import { useEffect, useLayoutEffect, useState, useRef, useMemo } from "react";
import { isDarkTheme, useTheme } from '../shared/theme-provider';
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
  Heart,
  MessageCircle,
  Share2,
  Send,
  ArrowLeft,
  Eye,
  PenSquare,
  Check,
  Clock,
  Loader2,
  Play,
  Pause,
  Volume2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { SB_API_BASE } from "~/components/streetbot/shared/apiConfig";
import { readSessionCache, writeSessionCache } from '../shared/perfCache';
import { useGlassStyles } from '../shared/useGlassStyles';
import { useAuthContext } from '~/hooks';
import { useUserRole } from '../lib/auth/useUserRole';
import { useResponsive } from '../hooks/useResponsive';
import AuthPopupModal from '../shared/AuthPopupModal';

import type { Article, Comment, GalleryImage } from './newsTypes';
import {
  NEWS_T,
  FALLBACK_IMAGE,
  EASE_OUT_EXPO,
  staggerContainer,
  staggerItem,
  getOrCreateUserId,
  formatDate,
  getInitials,
  normalizeArticle,
} from './newsConstants';

/* ─── CSS fade-in for comments (replaces framer-motion) ─── */
const fadeInStyle = `
@keyframes newsDetailFadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.news-comment-fade {
  animation: newsDetailFadeIn 0.3s ease-out both;
}
`;

/* ─── Listen to Article (OpenAI-style TTS) ─── */
function ListenBar({ articleTitle, articleContent, colors }: {
  articleTitle: string;
  articleContent: string;
  colors: ReturnType<typeof useGlassStyles>["colors"];
}) {
  const [state, setState] = useState<'idle' | 'generating' | 'playing' | 'paused'>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Estimate read time (average 150 wpm for speech)
  const wordCount = articleContent.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
  const estimatedMins = Math.ceil(wordCount / 150);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const generateAudio = async () => {
    setState('generating');
    try {
      // Strip HTML tags for clean text
      const plainText = articleContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      // Keep text very short for local Qwen TTS (slow on MPS for long text)
      // ~50 words generates in ~10-15 seconds
      const truncated = plainText.split(/\s+/).slice(0, 50).join(' ');
      const fullText = `${articleTitle}. ${truncated}`;

      // Call local TTS endpoint
      const resp = await fetch('/sbapi/v1/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: fullText,
          voice: 'Vivian',
          model: 'qwen-tts',
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error('TTS endpoint error:', resp.status, errText);
        setState('idle');
        return;
      }

      // The endpoint returns the audio file directly as binary
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('audio') || contentType.includes('octet-stream')) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState('playing');
      } else {
        // JSON response with a file path
        const data = await resp.json();
        if (data.file) {
          setAudioUrl(`/sbapi/audio/${data.file}`);
          setState('playing');
        } else if (data.url) {
          setAudioUrl(data.url);
          setState('playing');
        } else {
          console.error('Unexpected TTS response:', data);
          setState('idle');
        }
      }
    } catch (err) {
      console.error('TTS generation failed:', err);
      setState('idle');
    }
  };

  useEffect(() => {
    if (!audioUrl || state !== 'playing') return;
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.playbackRate = playbackRate;

    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
    audio.addEventListener('ended', () => setState('idle'));
    audio.play().catch(() => setState('paused'));

    return () => { audio.pause(); audio.src = ''; };
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  const togglePlay = () => {
    if (!audioUrl) { generateAudio(); return; }
    if (state === 'playing') {
      audioRef.current?.pause();
      setState('paused');
    } else {
      audioRef.current?.play();
      setState('playing');
    }
  };

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !audioRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
  };

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isActive = state !== 'idle';

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 0', margin: '8px 0 4px',
        borderTop: `1px solid ${colors.border}`,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        disabled={state === 'generating'}
        style={{
          width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: state === 'generating' ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.06)',
          color: colors.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
      >
        {state === 'generating' ? (
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        ) : state === 'playing' ? (
          <Pause size={16} fill="currentColor" />
        ) : (
          <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />
        )}
      </button>

      {/* Label */}
      <span style={{ fontSize: '0.82rem', fontWeight: 500, color: colors.text, whiteSpace: 'nowrap' }}>
        {state === 'generating' ? 'Generating audio...' : 'Listen to article'}
      </span>

      {/* Progress bar (only when audio is active) */}
      {isActive && duration > 0 ? (
        <div
          ref={progressRef}
          onClick={seekTo}
          style={{
            flex: 1, height: 4, borderRadius: 2, cursor: 'pointer',
            background: 'rgba(255,255,255,0.1)',
            position: 'relative',
          }}
        >
          <div style={{
            height: '100%', borderRadius: 2,
            background: colors.accent,
            width: `${pct}%`,
            transition: 'width 0.1s linear',
          }} />
        </div>
      ) : (
        <div style={{ flex: 1 }} />
      )}

      {/* Time */}
      <span style={{ fontSize: '0.75rem', color: colors.textMuted, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {isActive && duration > 0
          ? `${formatTime(currentTime)} / ${formatTime(duration)}`
          : `~${estimatedMins} min`
        }
      </span>

      {/* Speed control */}
      {isActive && (
        <button
          onClick={() => setPlaybackRate(r => r >= 2 ? 0.75 : +(r + 0.25).toFixed(2))}
          style={{
            padding: '2px 8px', borderRadius: 10, border: `1px solid ${colors.border}`,
            background: 'transparent', color: colors.textMuted,
            fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          {playbackRate}x
        </button>
      )}

      {/* Volume icon */}
      {isActive && (
        <Volume2 size={16} style={{ color: colors.textMuted, flexShrink: 0 }} />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ─── EditorialImage ─── */
interface EditorialImageProps {
  image: GalleryImage;
  colors: ReturnType<typeof useGlassStyles>["colors"];
}

const EditorialImage: React.FC<EditorialImageProps> = ({ image, colors }) => {
  const [src, setSrc] = useState(image.url);
  return (
    <figure className="my-0">
      <div className="rounded-2xl overflow-hidden border border-white/10">
        <img
          src={src}
          alt={image.caption || ""}
          loading="lazy"
          width={800}
          height={450}
          onError={() => setSrc(FALLBACK_IMAGE)}
          onLoad={(e) => { if ((e.target as HTMLImageElement).naturalWidth === 0) setSrc(FALLBACK_IMAGE); }}
          className="w-full h-auto object-cover"
        />
      </div>
      {(image.caption || image.credit) && (
        <figcaption className="mt-2 px-1">
          {image.caption && (
            <span className="text-sm italic block" style={{ color: colors.textSecondary }}>
              {image.caption}
            </span>
          )}
          {image.credit && (
            <span className="text-xs block mt-0.5" style={{ color: colors.textMuted }}>
              {image.credit}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
};

/* ─── EditorialPair ─── */
interface EditorialPairProps {
  images: GalleryImage[];
  colors: ReturnType<typeof useGlassStyles>["colors"];
}

const EditorialPair: React.FC<EditorialPairProps> = ({ images, colors }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-0">
    {images.map((img, i) => (
      <EditorialImage key={i} image={img} colors={colors} />
    ))}
  </div>
);

/* ─── EditorialArticleBody ─── */
interface EditorialArticleBodyProps {
  content: string;
  galleryImages?: GalleryImage[];
  colors: ReturnType<typeof useGlassStyles>["colors"];
}

const EditorialArticleBody: React.FC<EditorialArticleBodyProps> = ({
  content,
  galleryImages,
  colors,
}) => {
  if (!galleryImages || galleryImages.length === 0) {
    return (
      <div
        dangerouslySetInnerHTML={{ __html: content }}
        style={{ wordBreak: "break-word" }}
        className="news-article-prose"
      />
    );
  }

  const splitContent = (html: string): string[] => {
    const blockPattern = /(<\/(?:p|h[1-6]|div|blockquote|ul|ol|figure|pre|hr)>)/gi;
    const parts: string[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = blockPattern.exec(html)) !== null) {
      const end = match.index + match[0].length;
      const chunk = html.slice(lastIdx, end).trim();
      if (chunk) parts.push(chunk);
      lastIdx = end;
    }
    const remainder = html.slice(lastIdx).trim();
    if (remainder) parts.push(remainder);

    if (parts.length <= 1 && !html.includes("<")) {
      return html.split(/\n\n+/).filter(Boolean).map((p) => `<p>${p}</p>`);
    }

    return parts.length > 0 ? parts : [html];
  };

  const blocks = splitContent(content);

  type ImageSlot = { type: "single"; image: GalleryImage } | { type: "pair"; images: GalleryImage[] };
  const imageSlots: ImageSlot[] = [];
  let i = 0;
  while (i < galleryImages.length) {
    const img = galleryImages[i];
    if (img.layout_hint === "pair" && i + 1 < galleryImages.length && galleryImages[i + 1].layout_hint === "pair") {
      imageSlots.push({ type: "pair", images: [galleryImages[i], galleryImages[i + 1]] });
      i += 2;
    } else {
      imageSlots.push({ type: "single", image: img });
      i++;
    }
  }

  const insertionPoints: number[] = [];
  if (blocks.length > 1 && imageSlots.length > 0) {
    let nextInsert = Math.min(1, blocks.length - 1);
    while (insertionPoints.length < imageSlots.length && nextInsert < blocks.length) {
      insertionPoints.push(nextInsert);
      nextInsert += 3;
    }
  }
  const slotsToShow = imageSlots.slice(0, Math.max(insertionPoints.length, 1));
  const insertAfter = new Set(insertionPoints);

  const elements: React.ReactNode[] = [];
  let currentSlotIdx = 0;

  const renderSlot = (slot: (typeof imageSlots)[0], keyPrefix: string) => {
    const isWide = slot.type === "single" && slot.image.layout_hint === "wide";
    return (
      <motion.div
        key={keyPrefix}
        className={`my-8 ${isWide ? "lg:mx-[-120px]" : ""}`}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
      >
        {slot.type === "pair" ? (
          <EditorialPair images={slot.images} colors={colors} />
        ) : (
          <EditorialImage image={slot.image} colors={colors} />
        )}
      </motion.div>
    );
  };

  blocks.forEach((block, blockIdx) => {
    elements.push(
      <div
        key={`block-${blockIdx}`}
        dangerouslySetInnerHTML={{ __html: block }}
        className="news-article-prose"
        style={{ wordBreak: "break-word" }}
      />
    );

    if (insertAfter.has(blockIdx) && currentSlotIdx < slotsToShow.length) {
      elements.push(renderSlot(slotsToShow[currentSlotIdx], `gallery-${currentSlotIdx}`));
      currentSlotIdx++;
    }
  });

  if (currentSlotIdx === 0 && slotsToShow.length > 0) {
    elements.push(renderSlot(slotsToShow[0], "gallery-0"));
  }

  return <>{elements}</>;
};

/* ═══════════════════════════════════════════════════════════
   NewsArticleDetail — Full article view
   ═══════════════════════════════════════════════════════════ */

interface NewsArticleDetailProps {
  slug: string;
}

const NewsArticleDetail: React.FC<NewsArticleDetailProps> = ({ slug }) => {
  const { colors, gradientOrbs } = useGlassStyles();
  const { canEditNews } = useUserRole();
  const navigate = useNavigate();
  const { user: authUser } = useAuthContext();
  const { theme } = useTheme();
  const dark = isDarkTheme(theme);
  const { isMobile, isTablet } = useResponsive();
  const { navVisible } = (useOutletContext<ContextType>() ?? { navVisible: false });
  const sidebarMinimized = JSON.parse(localStorage.getItem('sidebarMinimized') ?? 'true');
  const navLeft = (isMobile || isTablet) ? 0 : isDirectory ? 0 : navVisible ? (sidebarMinimized ? 80 : 275) : 0;

  // Memoized styles for list renders (tags, comments)
  const tagStyle = useMemo(() => ({
    background: NEWS_T.glassSubtle,
    color: colors.textSecondary,
    border: `1px solid ${colors.border}`,
  }), [colors.textSecondary, colors.border]);

  const commentCardStyle = useMemo(() => ({
    background: NEWS_T.glassSubtle,
    backdropFilter: "blur(16px)",
    border: `1px solid ${colors.border}`,
  }), [colors.border]);

  const ARTICLE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min for individual articles
  const articleCacheKey = slug ? `streetbot:news:article:${slug}` : '';
  const cachedArticle = articleCacheKey ? readSessionCache<Article>(articleCacheKey, ARTICLE_CACHE_TTL_MS) : null;

  const [article, setArticle] = useState<Article | null>(cachedArticle);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(!cachedArticle);

  // Scroll to top whenever page content appears (loading → false).
  // The app uses an overflow-y-auto div as its scroll container, not the window.
  useLayoutEffect(() => {
    if (loading) return;
    window.scrollTo(0, 0);
    document.querySelectorAll('*').forEach((el) => {
      const s = window.getComputedStyle(el);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollTop > 0) {
        (el as HTMLElement).scrollTop = 0;
      }
    });
  }, [loading]);
  const [error, setError] = useState<string | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imgSrc, setImgSrc] = useState(cachedArticle?.image_url || "");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const detailFetchedRef = useRef<string | null>(null);

  const userId = getOrCreateUserId();

  // Fetch article — parallel slug+ID attempt via Promise.allSettled
  useEffect(() => {
    if (detailFetchedRef.current === slug) return;
    detailFetchedRef.current = slug;

    const warmCached = articleCacheKey ? readSessionCache<Article>(articleCacheKey, ARTICLE_CACHE_TTL_MS) : null;
    if (warmCached) {
      setArticle(warmCached);
      setImgSrc(warmCached.image_url || FALLBACK_IMAGE);
      setLikeCount(warmCached.like_count || 0);
      setLoading(false);
      setError(null);
    } else {
      setArticle(null);
      setImgSrc("");
      setLikeCount(0);
      setLoading(true);
      setError(null);
    }

    const controller = new AbortController();
    const { signal } = controller;

    const fetchArticle = async () => {
      const shouldBlockUi = !warmCached;
      if (shouldBlockUi) {
        setLoading(true);
      }
      try {
        const encoded = encodeURIComponent(slug);
        const looksLikeId = /^[0-9]+$/.test(slug);

        const slugUrl = `${SB_API_BASE}/news/articles/slug/${encoded}`;
        const idUrl = `${SB_API_BASE}/news/articles/${encoded}`;

        // Fire both requests in parallel, take the first success
        const results = await Promise.allSettled([
          fetch(looksLikeId ? idUrl : slugUrl, { signal }).then(async (r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          }),
          fetch(looksLikeId ? slugUrl : idUrl, { signal }).then(async (r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          }),
        ]);

        const data = results[0].status === "fulfilled"
          ? results[0].value
          : results[1].status === "fulfilled"
            ? results[1].value
            : null;

        if (!data) throw new Error("Article not found");
        if (signal.aborted) return;

        const normalized = normalizeArticle(data, "internal");
        setArticle(normalized);
        if (articleCacheKey) writeSessionCache(articleCacheKey, normalized);
        if (normalized.slug && normalized.slug !== slug) {
          writeSessionCache(`streetbot:news:article:${normalized.slug}`, normalized);
        }
        if (normalized.id != null && String(normalized.id) !== slug) {
          writeSessionCache(`streetbot:news:article:${String(normalized.id)}`, normalized);
        }
        setImgSrc(normalized.image_url || FALLBACK_IMAGE);
        setLikeCount(normalized.like_count || 0);

        // Fetch comments
        if (data.id) {
          fetch(`${SB_API_BASE}/news/articles/${encodeURIComponent(data.id)}/comments`, { signal })
            .then((r) => (r.ok ? r.json() : []))
            .then((c) => { if (!signal.aborted && Array.isArray(c)) setComments(c); })
            .catch(() => {});
        }

        // Check bookmark status
        if (userId && data.id) {
          fetch(`${SB_API_BASE}/news/bookmarks/${encodeURIComponent(userId)}`, { signal })
            .then((r) => (r.ok ? r.json() : []))
            .then((bookmarks) => {
              if (!signal.aborted && Array.isArray(bookmarks)) {
                setIsBookmarked(bookmarks.some((b: { id?: string | number }) => String(b?.id) === String(data.id)));
              }
            })
            .catch(() => {});
        }
      } catch (err) {
        if (signal.aborted) return;
        if (!warmCached) {
          setError(err instanceof Error ? err.message : "Failed to load article");
        }
      } finally {
        if (!signal.aborted && shouldBlockUi) setLoading(false);
      }
    };
    fetchArticle();
    return () => controller.abort();
  }, [slug, articleCacheKey]);

  const toggleBookmark = async () => {
    if (!article) return;
    if (!authUser) {
      sessionStorage.setItem("streetbot:postLoginRedirect", `/news/${slug}`);
      setAuthModalOpen(true);
      return;
    }
    try {
      if (isBookmarked) {
        await fetch(
          `${SB_API_BASE}/news/articles/${encodeURIComponent(article.id)}/bookmark/${encodeURIComponent(userId)}`,
          { method: "DELETE" },
        );
      } else {
        await fetch(`${SB_API_BASE}/news/articles/${encodeURIComponent(article.id)}/bookmark`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        });
      }
      setIsBookmarked((prev) => !prev);
    } catch (err) {
      console.error("Failed to toggle bookmark:", err);
    }
  };

  const toggleLike = async () => {
    if (!article) return;
    if (!authUser) {
      sessionStorage.setItem("streetbot:postLoginRedirect", `/news/${slug}`);
      setAuthModalOpen(true);
      return;
    }
    try {
      if (isLiked) {
        const res = await fetch(
          `${SB_API_BASE}/news/articles/${encodeURIComponent(article.id)}/unlike`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId }) },
        );
        if (res.ok) { setIsLiked(false); setLikeCount((c) => Math.max(0, c - 1)); }
      } else {
        const res = await fetch(
          `${SB_API_BASE}/news/articles/${encodeURIComponent(article.id)}/like`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId }) },
        );
        if (res.ok) { setIsLiked(true); setLikeCount((c) => c + 1); }
      }
    } catch (err) {
      console.error("Failed to toggle like:", err);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePostComment = async () => {
    if (!article || !newComment.trim()) return;
    if (!authUser) {
      sessionStorage.setItem("streetbot:postLoginRedirect", `/news/${slug}`);
      setAuthModalOpen(true);
      return;
    }
    setPostingComment(true);
    try {
      const res = await fetch(`${SB_API_BASE}/news/articles/${encodeURIComponent(article.id)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, content: newComment.trim() }),
      });
      if (res.ok) {
        const posted = await res.json();
        setComments((prev) => [posted, ...prev]);
        setNewComment("");
      }
    } catch (err) {
      console.error("Failed to post comment:", err);
    } finally {
      setPostingComment(false);
    }
  };

  const hasHeroImage = Boolean(article?.image_url);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="absolute inset-0 overflow-y-auto">
        <div className="relative min-h-full">
          <div style={gradientOrbs.purple} aria-hidden="true" />
          <div style={gradientOrbs.pink} aria-hidden="true" />
          <div style={gradientOrbs.cyan} aria-hidden="true" />
          <div style={gradientOrbs.gold} aria-hidden="true" />
          <div className="relative z-10 min-h-[80vh] flex items-center justify-center">
            <div className="text-center p-8 rounded-2xl" style={{ background: NEWS_T.glassSubtle, backdropFilter: "blur(24px)", border: `1px solid ${colors.border}` }}>
              <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: colors.accent, borderTopColor: "transparent" }} />
              <p style={{ color: colors.textSecondary }}>Loading article...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error / 404 ── */
  if (error || !article) {
    return (
      <div className="absolute inset-0 overflow-y-auto">
        <div className="relative min-h-full">
          <div style={gradientOrbs.purple} aria-hidden="true" />
          <div style={gradientOrbs.pink} aria-hidden="true" />
          <div style={gradientOrbs.cyan} aria-hidden="true" />
          <div style={gradientOrbs.gold} aria-hidden="true" />
          <div className="relative z-10 min-h-[80vh] flex items-center justify-center">
            <div className="text-center max-w-md p-8 rounded-2xl" style={{ background: NEWS_T.glassSubtle, backdropFilter: "blur(24px)", border: `1px solid ${colors.border}` }}>
              <div className="text-6xl mb-4">&#128240;</div>
              <h2 className="text-xl font-bold mb-2" style={{ color: colors.text }}>Article not found</h2>
              <p className="mb-6" style={{ color: colors.textSecondary }}>{error || "The article you're looking for doesn't exist or has been removed."}</p>
              <button
                onClick={() => navigate("/news")}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all duration-200 hover:scale-105"
                style={{ background: colors.accent, color: NEWS_T.bgDeep }}
              >
                <ArrowLeft size={16} /> Back to News
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main article view ── */
  return (
    <div className="absolute inset-0 overflow-y-auto">
      <style>{fadeInStyle}</style>
      <div className="relative min-h-full">
        <div style={gradientOrbs.purple} aria-hidden="true" />
        <div style={gradientOrbs.pink} aria-hidden="true" />
        <div style={gradientOrbs.cyan} aria-hidden="true" />
        <div style={gradientOrbs.gold} aria-hidden="true" />

        {/* Floating back bar — CSS transition instead of framer-motion */}
        <div
          className="fixed z-30 news-comment-fade"
          style={{ top: 80, left: (isMobile || isTablet) ? 16 : navLeft + 24, transition: "left 0.2s ease-out" }}
        >
          <button
            onClick={() => navigate("/news")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105"
            style={{
              background: NEWS_T.glassSubtle,
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: `1px solid ${colors.border}`,
              color: colors.text,
            }}
          >
            <ArrowLeft size={16} />
            Back to News
          </button>
        </div>

        {/* Hero image */}
        {hasHeroImage && (
          <div
            className="relative w-full overflow-hidden news-comment-fade"
            style={{ maxHeight: "60vh" }}
          >
            <img
              src={imgSrc}
              alt={article.title}
              loading="eager"
              width={1200}
              height={600}
              onError={() => setImgSrc(FALLBACK_IMAGE)}
              onLoad={(e) => { if ((e.target as HTMLImageElement).naturalWidth === 0) setImgSrc(FALLBACK_IMAGE); }}
              className="w-full h-full object-cover"
              style={{ maxHeight: "60vh", width: "100%" }}
            />
            {/* Bottom gradient fade */}
            <div className="absolute inset-0" style={{ background: "linear-gradient(transparent 40%, rgba(12,10,9,0.8) 80%, #0C0A09 100%)" }} />
            {/* Category badge top-left */}
            {article.category && (
              <span
                className="absolute top-6 left-6 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full"
                style={{ background: colors.accent, color: NEWS_T.bgDeep }}
              >
                {article.category}
              </span>
            )}
            {/* Bookmark top-right */}
            <button
              onClick={toggleBookmark}
              className="absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={{
                background: isBookmarked ? colors.accent : "rgba(0,0,0,0.5)",
                backdropFilter: "blur(12px)",
                border: `1px solid ${colors.border}`,
                color: isBookmarked ? NEWS_T.bgDeep : "#fff",
              }}
              aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}
            >
              <Bookmark size={18} fill={isBookmarked ? "currentColor" : "none"} />
            </button>
          </div>
        )}

        {/* Article content */}
        <div className="relative z-10" style={{ marginTop: hasHeroImage ? -60 : 100 }}>
          <motion.article
            className="max-w-[720px] mx-auto px-6"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {/* Header */}
            <motion.header variants={staggerItem} className="mb-10">
              {/* Category pill (if no hero) */}
              {!hasHeroImage && article.category && (
                <span
                  className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full mb-5"
                  style={{ background: colors.accent, color: NEWS_T.bgDeep }}
                >
                  {article.category}
                </span>
              )}

              {/* Title */}
              <h1
                className="font-bold leading-[1.1] tracking-tight mb-6"
                style={{
                  fontFamily: "Rubik, sans-serif",
                  fontSize: "clamp(2rem, 5vw, 3.25rem)",
                  color: colors.text,
                  letterSpacing: "-0.02em",
                }}
              >
                {article.title}
              </h1>

              {/* Meta row */}
              <div className="flex items-center gap-4 flex-wrap mb-6">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: "rgba(250,204,21,0.15)", color: colors.accent }}
                >
                  {getInitials(article.author)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={{ color: colors.text }}>
                    {article.author || "Staff Writer"}
                  </div>
                  <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: colors.textMuted }}>
                    {article.published_at && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDate(article.published_at)}
                      </span>
                    )}
                    {article.read_time && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {article.read_time}
                      </span>
                    )}
                    {article.view_count != null && (
                      <span className="flex items-center gap-1">
                        <Eye size={12} />
                        {article.view_count.toLocaleString()} views
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action bar */}
              <div
                className="flex items-center gap-3 py-4 border-y"
                style={{ borderColor: colors.border }}
              >
                {/* Like */}
                <button
                  onClick={toggleLike}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105"
                  style={{
                    background: isLiked ? "rgba(239,68,68,0.15)" : NEWS_T.glassSubtle,
                    border: `1px solid ${isLiked ? "rgba(239,68,68,0.3)" : colors.border}`,
                    color: isLiked ? "#EF4444" : colors.textSecondary,
                  }}
                >
                  <Heart size={16} fill={isLiked ? "currentColor" : "none"} />
                  {likeCount > 0 && likeCount}
                </button>

                {/* Comments scroll-to */}
                <button
                  onClick={() => commentRef.current?.scrollIntoView({ behavior: "smooth" })}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105"
                  style={{ background: NEWS_T.glassSubtle, border: `1px solid ${colors.border}`, color: colors.textSecondary }}
                >
                  <MessageCircle size={16} />
                  {comments.length > 0 && comments.length}
                </button>

                {/* Bookmark */}
                <button
                  onClick={toggleBookmark}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105"
                  style={{
                    background: isBookmarked ? "rgba(250,204,21,0.15)" : NEWS_T.glassSubtle,
                    border: `1px solid ${isBookmarked ? NEWS_T.borderAccent : colors.border}`,
                    color: isBookmarked ? colors.accent : colors.textSecondary,
                  }}
                >
                  <Bookmark size={16} fill={isBookmarked ? "currentColor" : "none"} />
                </button>

                {/* Share */}
                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ml-auto"
                  style={{
                    background: copied ? "rgba(34,197,94,0.15)" : NEWS_T.glassSubtle,
                    border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : colors.border}`,
                    color: copied ? "#22C55E" : colors.textSecondary,
                  }}
                >
                  {copied ? <Check size={16} /> : <Share2 size={16} />}
                  {copied ? "Copied!" : "Share"}
                </button>

                {/* Edit */}
                {canEditNews && (
                  <Link
                    to={`/news/editor/${article.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105"
                    style={{
                      background: "rgba(250,204,21,0.1)",
                      border: `1px solid rgba(250,204,21,0.3)`,
                      color: colors.accent,
                    }}
                  >
                    <PenSquare size={14} />
                    Edit
                  </Link>
                )}
              </div>
            </motion.header>

            {/* Listen to article — OpenAI style */}
            {article.content && (
              <ListenBar
                articleTitle={article.title}
                articleContent={article.content}
                colors={colors}
              />
            )}

            {/* Article body */}
            <motion.div
              variants={staggerItem}
              className="mb-12"
              style={{
                fontFamily: "Rubik, sans-serif",
                color: colors.text,
                fontSize: "1.125rem",
                lineHeight: 1.8,
              }}
            >
              {article.content ? (
                <EditorialArticleBody
                  content={article.content}
                  galleryImages={article.gallery_images}
                  colors={colors}
                />
              ) : (
                <p style={{ color: colors.textSecondary, fontStyle: "italic" }}>
                  {article.excerpt || "No content available for this article."}
                </p>
              )}
            </motion.div>

            {/* Tags */}
            {article.tags && article.tags.length > 0 && (
              <motion.div variants={staggerItem} className="flex flex-wrap gap-2 mb-12 pb-8 border-b" style={{ borderColor: colors.border }}>
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 text-xs rounded-full"
                    style={tagStyle}
                  >
                    #{tag}
                  </span>
                ))}
              </motion.div>
            )}

            {/* Comments section */}
            <motion.section variants={staggerItem} className="mb-20">
              <h2
                className="font-semibold mb-6 flex items-center gap-3"
                style={{ fontFamily: "Rubik, sans-serif", fontSize: "1.5rem", color: colors.text }}
              >
                <MessageCircle size={22} style={{ color: colors.accent }} />
                Comments {comments.length > 0 && `(${comments.length})`}
              </h2>

              {/* New comment form */}
              <div
                className="rounded-2xl p-5 mb-8"
                style={{
                  background: NEWS_T.glassSubtle,
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  border: `1px solid ${colors.border}`,
                }}
              >
                <textarea
                  ref={commentRef}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Share your thoughts..."
                  rows={3}
                  className="w-full resize-none outline-none text-sm rounded-xl p-4 mb-3 transition-colors focus:border-yellow-400/40"
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                    fontFamily: "Rubik, sans-serif",
                  }}
                />
                <div className="flex justify-end">
                  <button
                    onClick={handlePostComment}
                    disabled={postingComment || !newComment.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                    style={{ background: colors.accent, color: NEWS_T.bgDeep }}
                  >
                    {postingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {postingComment ? "Posting..." : "Post Comment"}
                  </button>
                </div>
              </div>

              {/* Comments list — CSS transitions instead of framer-motion */}
              <div className="space-y-4">
                {comments.length === 0 && (
                  <p className="text-center py-8 text-sm" style={{ color: colors.textMuted }}>
                    No comments yet. Be the first to share your thoughts.
                  </p>
                )}
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="rounded-xl p-4 news-comment-fade"
                    style={commentCardStyle}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "rgba(250,204,21,0.15)", color: colors.accent }}
                      >
                        {getInitials(comment.user_name)}
                      </div>
                      <span className="text-sm font-medium" style={{ color: colors.text }}>
                        {comment.user_name || "Anonymous"}
                      </span>
                      {comment.created_at && (
                        <span className="text-xs ml-auto" style={{ color: colors.textMuted }}>
                          {formatDate(comment.created_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed pl-11" style={{ color: colors.textSecondary }}>
                      {comment.content}
                    </p>
                  </div>
                ))}
              </div>
            </motion.section>
          </motion.article>
        </div>
      </div>

      {/* Prose styles for article HTML content */}
      <style>{`
        .news-article-prose h1,
        .news-article-prose h2,
        .news-article-prose h3,
        .news-article-prose h4 {
          font-family: Rubik, sans-serif;
          font-weight: 600;
          line-height: 1.3;
          margin-top: 2em;
          margin-bottom: 0.75em;
        }
        .news-article-prose h1 { font-size: 2rem; }
        .news-article-prose h2 { font-size: 1.625rem; }
        .news-article-prose h3 { font-size: 1.375rem; }
        .news-article-prose h4 { font-size: 1.125rem; }
        .news-article-prose p {
          margin-bottom: 1.5em;
        }
        .news-article-prose a {
          color: #FACC15;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .news-article-prose a:hover {
          color: #FDE68A;
        }
        .news-article-prose img {
          max-width: 100%;
          height: auto;
          border-radius: 12px;
          margin: 2em 0;
        }
        .news-article-prose blockquote {
          border-left: 3px solid #FACC15;
          padding-left: 1.25em;
          margin: 1.5em 0;
          font-style: italic;
          opacity: 0.85;
        }
        .news-article-prose ul,
        .news-article-prose ol {
          padding-left: 1.5em;
          margin-bottom: 1.5em;
        }
        .news-article-prose li {
          margin-bottom: 0.5em;
        }
        .news-article-prose ul li { list-style: disc; }
        .news-article-prose ol li { list-style: decimal; }
        .news-article-prose pre {
          background: rgba(0,0,0,0.4);
          border-radius: 8px;
          padding: 1em;
          overflow-x: auto;
          margin: 1.5em 0;
          font-size: 0.875rem;
        }
        .news-article-prose code {
          background: rgba(0,0,0,0.3);
          padding: 0.15em 0.4em;
          border-radius: 4px;
          font-size: 0.9em;
        }
        .news-article-prose pre code {
          background: none;
          padding: 0;
        }
        .news-article-prose hr {
          border: none;
          height: 1px;
          background: rgba(255,255,255,0.1);
          margin: 2em 0;
        }
        .news-article-prose figure {
          margin: 2em 0;
        }
        .news-article-prose figcaption {
          text-align: center;
          font-size: 0.875rem;
          opacity: 0.6;
          margin-top: 0.5em;
        }
      `}</style>

      <SiteFooter />
      <AuthPopupModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} initialTab="login" />
    </div>
  );
};

export default NewsArticleDetail;

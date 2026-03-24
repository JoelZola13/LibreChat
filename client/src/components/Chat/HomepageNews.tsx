import { memo, useState, useContext, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ThemeContext, isDark as checkDark } from '@librechat/client';
import { isDirectory } from '~/config/appVariant';
import { prefetchHomepageNews, getHomepageNewsSync } from '~/components/streetbot/shared/homepageNewsPrefetch';
import { prefetchNews } from '~/components/streetbot/news/newsPrefetch';
import { prefetchArticle } from '~/components/streetbot/news/articlePrefetch';
import { prefetchDirectory } from '~/components/streetbot/directory/directoryPrefetch';
import { prefetchJobs } from '~/components/streetbot/jobs/jobsPrefetch';
import { preloadAllRoutes } from '~/components/streetbot/shared/routePreloader';

type NewsItem = {
  id: string;
  title: string;
  image: string;
  category: string;
  isInternal: boolean;
  href: string;
  publishedAt?: string;
};

function getArticleRefFromHref(href: string): string | null {
  if (!href || !href.startsWith('/news/')) return null;
  const ref = href.slice('/news/'.length).split(/[?#]/)[0];
  return ref || null;
}

function HomepageNews() {
  const { theme } = useContext(ThemeContext);
  const dark = checkDark(theme);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  );
  const [slideIndex, setSlideIndex] = useState(0);
  const [newsItems, setNewsItems] = useState<NewsItem[]>(
    () => getHomepageNewsSync() ?? [],
  );
  const [isLoading, setIsLoading] = useState(() => {
    const cached = getHomepageNewsSync();
    return !cached || cached.length === 0;
  });
  const itemsPerPage = isMobile ? 1 : 3;
  const maxIndex = useMemo(() => Math.max(0, newsItems.length - itemsPerPage), [newsItems.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onResize = () => setIsMobile(window.innerWidth < 640);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Consume the already-in-flight homepage news prefetch (started at app startup).
  // If cache was warm, newsItems is already populated via useState initializer above.
  // This effect handles the case where the prefetch was in-flight when the component mounted.
  useEffect(() => {
    let cancelled = false;

    // Use synchronous cache immediately, then still refresh in background for latest items.
    const sync = getHomepageNewsSync();
    if (sync && sync.length > 0) {
      setNewsItems(sync);
      setIsLoading(false);
    }

    // Await prefetch promise (already started at app startup import).
    prefetchHomepageNews().then((items) => {
      if (!cancelled && items.length > 0) {
        setNewsItems(items);
        setSlideIndex(0);
      }
      if (!cancelled) {
        setIsLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, []);

  // Keep homepage render fast: schedule non-critical route/data preloads in idle time.
  useEffect(() => {
    let timeoutId: number | undefined;
    let idleId: number | undefined;

    // Prioritize news data so /news and /news/:slug feel instant from homepage.
    prefetchNews();

    const startBackgroundPreloads = () => {
      prefetchDirectory();
      prefetchJobs();
      preloadAllRoutes();
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number })
        .requestIdleCallback(startBackgroundPreloads, { timeout: 1500 });
    } else if (typeof window !== 'undefined') {
      timeoutId = window.setTimeout(startBackgroundPreloads, 220);
    }

    return () => {
      if (typeof window !== 'undefined') {
        if (timeoutId) window.clearTimeout(timeoutId);
        if (idleId && 'cancelIdleCallback' in window) {
          (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
        }
      }
    };
  }, []);

  // Warm first visible card images quickly for near-instant paint.
  useEffect(() => {
    newsItems.slice(0, 3).forEach((item) => {
      const img = new Image();
      img.src = item.image;
    });
  }, [newsItems]);

  // Prefetch details for top cards so first taps on mobile open immediately.
  useEffect(() => {
    newsItems.slice(0, 6).forEach((item, index) => {
      const ref = getArticleRefFromHref(item.href);
      if (!ref) return;
      window.setTimeout(() => prefetchArticle(ref), index * 120);
    });
  }, [newsItems]);

  useEffect(() => {
    setSlideIndex((prev) => Math.min(prev, maxIndex));
  }, [maxIndex]);

  const handlePrev = () => {
    setSlideIndex((prev) => Math.max(0, prev - itemsPerPage));
  };

  const handleNext = () => {
    setSlideIndex((prev) => Math.min(maxIndex, prev + itemsPerPage));
  };

  const canGoPrev = slideIndex > 0;
  const canGoNext = slideIndex < maxIndex;
  const visibleItems = newsItems.slice(slideIndex, slideIndex + itemsPerPage);

  return (
    <div className={`relative z-10 mt-6 w-full px-4 pb-6 ${isDirectory ? 'sm:px-6 sm:pb-6 lg:absolute lg:bottom-[52px] lg:left-0 lg:right-0 lg:mt-0 lg:pb-0 2xl:bottom-[82px]' : 'sm:absolute sm:bottom-[82px] sm:left-0 sm:right-0 sm:mt-0 sm:px-6 sm:pb-0'}`}>
      <div className="mx-auto" style={{ maxWidth: 1100 }}>
        {/* Header with "Latest News" label and line */}
        <div className="mb-6 flex items-center gap-4">
          <div
            className="shrink-0 rounded px-5 py-2"
            style={{ backgroundColor: dark ? 'rgba(40, 41, 51, 0.9)' : 'rgba(0, 0, 0, 0.05)' }}
          >
            <span
              className="text-sm font-medium"
              style={{ color: dark ? '#E6E7F2' : '#1a1c24', fontFamily: 'Rubik, sans-serif' }}
            >
              Latest News
            </span>
          </div>
          <div className="h-px flex-1" style={{ backgroundColor: dark ? 'rgba(188, 189, 208, 0.2)' : 'rgba(0, 0, 0, 0.1)' }} />
        </div>

        {/* News Cards with Navigation Arrows */}
        <div className="relative">
          {/* Left Arrow */}
          <button
            type="button"
            onClick={handlePrev}
            disabled={!canGoPrev}
            aria-label="Previous news"
            className="absolute left-2 top-1/2 z-20 flex items-center justify-center transition-opacity sm:-left-10"
            style={{
              transform: 'translateY(-50%)',
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: dark ? '1px solid rgba(188, 189, 208, 0.3)' : '1px solid rgba(0, 0, 0, 0.15)',
              backgroundColor: 'transparent',
              color: dark ? '#E6E7F2' : '#374151',
              fontSize: 20,
              cursor: canGoPrev ? 'pointer' : 'not-allowed',
              opacity: canGoPrev ? 1 : 0.4,
            }}
          >
            ‹
          </button>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {visibleItems.length === 0 && (
              <div
                style={{
                  height: 220,
                  borderRadius: 16,
                  border: dark ? '1px solid rgba(188, 189, 208, 0.24)' : '1px solid rgba(0, 0, 0, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: dark ? '#E6E7F2' : '#1a1c24',
                  fontFamily: 'Rubik, sans-serif',
                  fontSize: 14,
                }}
              >
                {isLoading ? 'Loading latest news...' : 'No Street Voices news available right now.'}
              </div>
            )}
            {visibleItems.map((item) => {
              const articleRef = getArticleRefFromHref(item.href);
              const primeArticle = () => {
                if (articleRef) prefetchArticle(articleRef);
              };
              return (
              <Link
                key={item.id}
                to={item.href}
                className="group relative block h-[220px] overflow-hidden rounded-xl"
                onMouseEnter={primeArticle}
                onFocus={primeArticle}
                onTouchStart={primeArticle}
                onPointerDown={primeArticle}
              >
                {/* Background Image */}
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                  style={{ backgroundImage: `url(${item.image})` }}
                />

                {/* Gradient Overlay */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.15) 100%)',
                  }}
                />

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  {/* Tags */}
                  <div className="mb-3 flex gap-2">
                    <span
                      className="rounded px-2.5 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: '#4A90D9',
                        color: '#FFFFFF',
                        fontFamily: 'Rubik, sans-serif',
                      }}
                    >
                      {item.category}
                    </span>
                    {item.isInternal && item.category.trim().toLowerCase() !== 'street voices' && (
                      <span
                        className="rounded px-2.5 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: '#FDD30B',
                          color: '#000000',
                          fontFamily: 'Rubik, sans-serif',
                        }}
                      >
                        Street Voices
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <p
                    className="line-clamp-3 text-sm font-medium leading-relaxed"
                    style={{
                      color: '#FFFFFF',
                      fontFamily: 'Rubik, sans-serif',
                    }}
                  >
                    {item.title}
                  </p>
                </div>
              </Link>
            )})}
          </div>

          {/* Right Arrow */}
          <button
            type="button"
            onClick={handleNext}
            disabled={!canGoNext}
            aria-label="Next news"
            className="absolute right-2 top-1/2 z-20 flex items-center justify-center transition-opacity sm:-right-10"
            style={{
              transform: 'translateY(-50%)',
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: dark ? '1px solid rgba(188, 189, 208, 0.3)' : '1px solid rgba(0, 0, 0, 0.15)',
              backgroundColor: 'transparent',
              color: dark ? '#E6E7F2' : '#374151',
              fontSize: 20,
              cursor: canGoNext ? 'pointer' : 'not-allowed',
              opacity: canGoNext ? 1 : 0.4,
            }}
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(HomepageNews);
